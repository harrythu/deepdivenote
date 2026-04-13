import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import { AppMode } from '@/lib/context/mode-context'
import { getModelConfig } from './llm-client'

/**
 * 修复 JSON 字符串值中的裸控制字符
 * 逐字符扫描，在字符串值内部遇到裸换行/回车/制表符时，替换为合法的 JSON 转义序列
 * 解决 MiniMax 等模型直接在 JSON 字符串值里输出原始换行符的问题
 */
function fixBareControlChars(json: string): string {
  let result = ''
  let inString = false
  let escaped = false

  for (let i = 0; i < json.length; i++) {
    const ch = json[i]

    if (escaped) {
      // 上一个字符是反斜杠，当前字符是转义序列的一部分，直接输出
      result += ch
      escaped = false
      continue
    }

    if (ch === '\\' && inString) {
      // 反斜杠：标记下一个字符为转义
      result += ch
      escaped = true
      continue
    }

    if (ch === '"') {
      // 引号：切换字符串内/外状态
      inString = !inString
      result += ch
      continue
    }

    if (inString) {
      // 在字符串值内部，修复裸控制字符
      if (ch === '\n') {
        result += '\\n'
      } else if (ch === '\r') {
        result += '\\r'
      } else if (ch === '\t') {
        result += '\\t'
      } else if (ch.charCodeAt(0) < 0x20) {
        // 其他控制字符（0x00-0x1F）转为 \uXXXX
        result += `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`
      } else {
        result += ch
      }
    } else {
      result += ch
    }
  }

  return result
}

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
      console.log('【纠错响应开头200字符】:', JSON.stringify(fullText.slice(0, 200)))
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

    let trimmedText = text.trim()

    // 剥离 <think>...</think> 思考链（Qwen3 等思考模型会输出推理过程）
    const thinkMatch = trimmedText.match(/^<think>[\s\S]*?<\/think>\s*/i)
    if (thinkMatch) {
      trimmedText = trimmedText.slice(thinkMatch[0].length).trim()
      console.log('【纠错解析】检测到 <think> 思考链，已剥离，剩余长度:', trimmedText.length)
    }

    // 剥离 markdown 代码块包裹（DeepSeek/MiniMax 等模型会输出 ```json ... ``` 格式）
    // 不使用 ^ $ 锚点，兼容 <think> 剥离后仍有前后空白/残留的情况
    const codeBlockMatch = trimmedText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (codeBlockMatch) {
      trimmedText = codeBlockMatch[1].trim()
      console.log('【纠错解析】检测到 markdown 代码块，已剥离，剩余长度:', trimmedText.length)
    }

    // 修复三引号问题（Qwen3.5 等模型会输出 """value""" 形式的非法 JSON 字符串）
    // 将 : """内容""" 替换为 : "内容"（内容中的双引号转义为 \"）
    if (trimmedText.includes('"""')) {
      trimmedText = trimmedText.replace(/"""([\s\S]*?)"""/g, (_match, inner) => {
        // 对内容中已有的双引号转义，避免破坏 JSON 结构
        const escaped = inner.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
        return `"${escaped}"`
      })
      console.log('【纠错解析】检测到三引号，已修复，剩余长度:', trimmedText.length)
    }

    // 修复 JSON 字符串值中的裸控制字符（MiniMax 等模型会在字符串值里直接输出原始换行符/回车符/制表符）
    // 逐字符扫描：在字符串值内部遇到裸控制字符时，替换为合法的转义序列
    trimmedText = fixBareControlChars(trimmedText)

    // 检查响应是否被截断（检查 JSON 是否完整）
    const hasCompleteJson = trimmedText.startsWith('{') && trimmedText.endsWith('}')

    if (!hasCompleteJson) {
      console.error('【纠错解析失败】JSON 不完整或格式错误')
      console.error('【原始响应开头】:', text.slice(0, 100))
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
      // 精确定位：打印出错位置附近内容
      if (error instanceof SyntaxError) {
        const posMatch = error.message.match(/position (\d+)/)
        if (posMatch) {
          const pos = parseInt(posMatch[1])
          console.error(`【出错位置 ${pos} 附近】:`, JSON.stringify(trimmedText.slice(Math.max(0, pos - 80), pos + 80)))
        }
      }

      // 降级策略：JSON.parse 失败时，用正则逐字段提取
      // 使用能正确跳过转义引号 \" 的正则：(?:\\.|[^"]) 匹配转义字符或非引号字符
      console.warn('【纠错解析】尝试降级提取...')

      // 1. 提取 correctedText
      let extractedCorrectedText = originalText
      const correctedTextMatch = trimmedText.match(/"correctedText"\s*:\s*"((?:\\.|[^"])*)"/)
      if (correctedTextMatch) {
        try {
          extractedCorrectedText = JSON.parse(`"${correctedTextMatch[1]}"`) || originalText
          console.warn('【纠错解析】降级提取 correctedText 成功，长度:', extractedCorrectedText.length)
        } catch {
          extractedCorrectedText = correctedTextMatch[1] || originalText
          console.warn('【纠错解析】降级提取 correctedText（原始），长度:', extractedCorrectedText.length)
        }
      } else {
        console.warn('【纠错解析】降级提取 correctedText 失败，使用原文')
      }

      // 2. 逐个提取 corrections 数组中的每个对象
      const extractedCorrections: Correction[] = []
      const correctionItemRegex = /\{\s*"original"\s*:\s*"((?:\\.|[^"])*)"\s*,\s*"corrected"\s*:\s*"((?:\\.|[^"])*)"\s*,\s*"reason"\s*:\s*"((?:\\.|[^"])*)"\s*\}/g
      let itemMatch
      while ((itemMatch = correctionItemRegex.exec(trimmedText)) !== null) {
        try {
          extractedCorrections.push({
            original: JSON.parse(`"${itemMatch[1]}"`),
            corrected: JSON.parse(`"${itemMatch[2]}"`),
            reason: JSON.parse(`"${itemMatch[3]}"`),
          })
        } catch {
          extractedCorrections.push({
            original: itemMatch[1],
            corrected: itemMatch[2],
            reason: itemMatch[3],
          })
        }
      }
      console.warn('【纠错解析】降级提取 corrections 数量:', extractedCorrections.length)

      return {
        correctedText: extractedCorrectedText,
        corrections: extractedCorrections,
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
