import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import { AppMode } from '@/lib/context/mode-context'
import { getModelConfig } from './llm-client'

/**
 * 从文件加载纠错提示词模板
 */
function loadCorrectionPromptTemplate(): string {
  const templatePath = path.join(process.cwd(), 'default_correct_prompt.txt')
  try {
    return fs.readFileSync(templatePath, 'utf-8')
  } catch (error) {
    console.error('加载纠错提示词模板失败:', error)
    throw new Error('无法加载 default_correct_prompt.txt 文件')
  }
}

export interface CorrectionOptions {
  topic?: string           // 会议主题
  vocabulary?: string[]    // 常用词汇列表
  model?: string          // 模型ID，如 openai/gpt-5.4-mini
  maxTokens?: number      // 最大输出token数
  mode?: AppMode          // 应用模式
  userApiKey?: string     // 用户自己的 API KEY（内部版使用）
}

export interface CorrectionResult {
  correctedText: string     // 纠错后的文字稿
  corrections: Correction[] // 纠错详情列表
  tokensUsed: number        // 使用的 Token 数量
}

export interface Correction {
  original: string          // 原文
  corrected: string         // 纠错后
  reason: string            // 纠错原因
}

/**
 * 创建纠错服务的客户端
 */
function createClient(options: CorrectionOptions): OpenAI {
  const { mode = 'external', userApiKey } = options

  if (mode === 'internal') {
    // 内部版：使用 Theta API
    if (!userApiKey) {
      throw new Error('内部版需要配置您的 API KEY')
    }
    const config = getModelConfig('internal')
    return new OpenAI({
      apiKey: userApiKey,
      baseURL: config.baseURL,
    })
  } else {
    // 外部版：使用 ZenMux API
    const config = getModelConfig('external')
    return new OpenAI({
      apiKey: process.env[config.apiKeyEnv] || process.env.ZENMUX_API_KEY,
      baseURL: config.baseURL,
    })
  }
}

/**
 * 纠错服务
 */
export class CorrectionService {
  private mode: AppMode
  private userApiKey?: string

  constructor(mode: AppMode = 'external', userApiKey?: string) {
    this.mode = mode
    this.userApiKey = userApiKey
  }

  async correct(
    transcription: string,
    options: Omit<CorrectionOptions, 'mode' | 'userApiKey'> = {}
  ): Promise<CorrectionResult> {
    const { topic, vocabulary = [], model, maxTokens } = options

    // 获取对应的模型配置
    const config = getModelConfig(this.mode)
    const defaultModel = model || config.default
    const defaultMaxTokens = maxTokens || config.defaultMaxTokens

    // 输入限制：约 300K 字符（留空间给 prompt 和 JSON 输出）
    const MAX_INPUT_CHARS = 300000

    let textToCorrect = transcription
    let wasTruncated = false

    if (transcription.length > MAX_INPUT_CHARS) {
      console.warn(`【警告】文字稿过长 (${transcription.length} 字符)，已截断至 ${MAX_INPUT_CHARS} 字符`)
      textToCorrect = transcription.slice(0, MAX_INPUT_CHARS)
      wasTruncated = true
    }

    const prompt = this.buildPrompt(textToCorrect, topic, vocabulary)
    const client = createClient({ mode: this.mode, userApiKey: this.userApiKey })

    console.log(`【纠错请求】模式: ${this.mode}, 模型: ${defaultModel}, 文字长度: ${textToCorrect.length} 字符`)

    try {
      // 使用 OpenAI SDK 流式响应
      const stream = await client.chat.completions.create({
        model: defaultModel,
        max_tokens: defaultMaxTokens,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: true,
      })

      let fullText = ''
      let chunkCount = 0
      for await (const chunk of stream) {
        chunkCount++
        const content = chunk.choices[0]?.delta?.content
        if (content) {
          fullText += content
        }
      }
      console.log(`【纠错响应】收到 ${chunkCount} 个 chunk, 最终文本长度: ${fullText.length} 字符`)
      const result = this.parseResponse(fullText, textToCorrect)

      if (wasTruncated) {
        console.warn('【警告】纠错基于截断后的文字稿，完整转写请分段处理')
      }

      return {
        ...result,
        tokensUsed: 0, // 流式响应不返回 usage
      }
    } catch (error) {
      console.error('【纠错请求失败】:', error)
      throw error
    }
  }

  private buildPrompt(transcription: string, topic?: string, vocabulary?: string[]): string {
    // 从文件加载提示词模板
    const template = loadCorrectionPromptTemplate()

    let context = ''

    if (topic) {
      context += `会议主题：${topic}\n`
    }

    if (vocabulary && vocabulary.length > 0) {
      context += `会议常用词汇（当原文中出现同样或者类似发音词汇时，使用以下词汇替换）：\n`
      vocabulary.forEach((word, i) => {
        context += `${i + 1}. ${word}\n`
      })
      context += '\n'
    }

    // 替换模板中的占位符
    return template
      .replace('{{CONTEXT}}', context ? `参考背景信息：\n${context}` : '')
      .replace('{{TRANSCRIPTION}}', transcription)
  }

  private parseResponse(text: string, originalText: string): Omit<CorrectionResult, 'tokensUsed'> {
    console.log('【纠错原始响应长度】:', text.length, '字符')

    // 检查响应是否被截断（检查 JSON 是否完整）
    const trimmedText = text.trim()
    const hasCompleteJson = trimmedText.startsWith('{') && trimmedText.endsWith('}')

    if (!hasCompleteJson) {
      console.error('【纠错解析失败】JSON 不完整或格式错误')
      console.error('【原始响应末尾】:', text.slice(-200))
      return {
        correctedText: originalText,
        corrections: [],
      }
    }

    try {
      const parsed = JSON.parse(trimmedText)
      console.log('【纠错解析结果】corrections 数量:', parsed.corrections?.length || 0)

      return {
        correctedText: parsed.correctedText || originalText,
        corrections: (parsed.corrections || []) as Correction[],
      }
    } catch (error) {
      console.error('【纠错解析异常】:', error)
      console.error('【原始响应末尾】:', text.slice(-200))
      return {
        correctedText: originalText,
        corrections: [],
      }
    }
  }
}

// 导出单例（仅用于外部版）
let correctionServiceInstance: CorrectionService | null = null

export function getCorrectionService(mode?: AppMode, userApiKey?: string): CorrectionService {
  // 如果指定了 mode 或 userApiKey，创建新的实例
  if (mode || userApiKey) {
    return new CorrectionService(mode, userApiKey)
  }
  // 否则返回外部版的单例
  if (!correctionServiceInstance) {
    correctionServiceInstance = new CorrectionService('external')
  }
  return correctionServiceInstance
}
