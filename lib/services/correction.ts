import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import { RichSegment } from '@/lib/types'

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
  vocabulary?: string[]     // 常用词汇列表
  model?: string           // 模型ID，如 openai/gpt-5.4-mini
  maxTokens?: number       // 最大输出token数
}

export interface CorrectionResult {
  correctedText: string       // 纠错后的完整文字稿（向后兼容）
  correctedSegments?: RichSegment[]  // 纠错后的分段（按 segment 纠错时返回）
  corrections: Correction[]   // 纠错详情列表
  tokensUsed: number          // 使用的 Token 数量
}

export interface Correction {
  original: string          // 原文
  corrected: string         // 纠错后
  reason: string            // 纠错原因
}

/**
 * ZenMux API 纠错服务
 * 使用 OpenAI SDK 调用大模型对转写文字稿进行纠错
 */
export class CorrectionService {
  private client: OpenAI

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.ZENMUX_API_KEY,
      baseURL: 'https://zenmux.ai/api/v1',
    })
  }

  /**
   * 按 RichSegment[] 逐条纠错（新主路径）
   * LLM 按 [index] 格式接收，按 index 回填 corrected_text
   */
  async correctSegments(
    segments: RichSegment[],
    options: CorrectionOptions = {}
  ): Promise<CorrectionResult> {
    if (!segments.length) {
      return { correctedText: '', correctedSegments: [], corrections: [], tokensUsed: 0 }
    }

    const { topic, vocabulary = [], model = 'openai/gpt-5.4', maxTokens = 128000 } = options

    // 构造带编号的分段文本
    const numberedText = segments
      .map((seg, idx) => `[${idx}] ${seg.original_text}`)
      .join('\n')

    const prompt = this.buildSegmentPrompt(numberedText, topic, vocabulary)
    console.log(`【分段纠错请求】模型: ${model}, 分段数: ${segments.length}, 文字长度: ${numberedText.length}`)

    try {
      const stream = await this.client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      })

      let fullText = ''
      let chunkCount = 0
      for await (const chunk of stream) {
        chunkCount++
        const content = chunk.choices[0]?.delta?.content
        if (content) fullText += content
      }
      console.log(`【分段纠错响应】收到 ${chunkCount} 个 chunk, 长度: ${fullText.length}`)

      return this.parseSegmentResponse(fullText, segments)
    } catch (error) {
      console.error('【分段纠错请求失败】:', error)
      throw error
    }
  }

  /**
   * 原有纯文本纠错（降级路径，无 segments 时使用）
   */
  async correct(
    transcription: string,
    options: CorrectionOptions = {}
  ): Promise<CorrectionResult> {
    const { topic, vocabulary = [], model = 'openai/gpt-5.4', maxTokens = 128000 } = options

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

    console.log(`【纠错请求】模型: ${model}, 文字长度: ${textToCorrect.length} 字符`)

    try {
      // 使用 OpenAI SDK 流式响应
      const stream = await this.client.chat.completions.create({
        model: model,
        max_tokens: maxTokens,
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

  /**
   * 构造分段纠错 prompt
   * 要求 LLM 按 [index] 格式返回每条纠错结果
   */
  private buildSegmentPrompt(numberedText: string, topic?: string, vocabulary?: string[]): string {
    let context = ''
    if (topic) context += `会议主题：${topic}\n`
    if (vocabulary && vocabulary.length > 0) {
      context += `会议常用词汇（当原文中出现同样或者类似发音词汇时，使用以下词汇替换）：\n`
      vocabulary.forEach((word, i) => { context += `${i + 1}. ${word}\n` })
      context += '\n'
    }

    return `你是一个专业的会议转写纠错助手。以下是一段会议录音的转写文字稿，按句子编号排列。
${context ? `\n参考背景信息：\n${context}` : ''}
请对每一条句子进行纠错，修正错别字、同音字、专有名词等错误，保持原意不变，不要合并或拆分句子。

转写文字稿：
${numberedText}

请严格按照以下 JSON 格式返回，不要输出任何其他内容：
{
  "segments": [
    {"index": 0, "text": "纠错后的句子"},
    {"index": 1, "text": "纠错后的句子"}
  ],
  "corrections": [
    {"original": "原文片段", "corrected": "纠错后片段", "reason": "纠错原因"}
  ]
}`
  }

  /**
   * 解析分段纠错响应，回填 corrected_text
   */
  private parseSegmentResponse(
    text: string,
    originalSegments: RichSegment[]
  ): CorrectionResult {
    console.log('【分段纠错原始响应长度】:', text.length)

    let trimmedText = text.trim()
    const codeBlockMatch = trimmedText.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
    if (codeBlockMatch) {
      trimmedText = codeBlockMatch[1].trim()
    }

    const hasCompleteJson = trimmedText.startsWith('{') && trimmedText.endsWith('}')
    if (!hasCompleteJson) {
      console.error('【分段纠错解析失败】JSON 不完整，返回原始 segments')
      return {
        correctedText: originalSegments.map(s => s.original_text).join(''),
        correctedSegments: originalSegments,
        corrections: [],
        tokensUsed: 0,
      }
    }

    try {
      const parsed = JSON.parse(trimmedText)
      const segmentResults: { index: number; text: string }[] = parsed.segments || []

      // 按 index 回填 corrected_text，保留所有元数据
      const correctedSegments: RichSegment[] = originalSegments.map((seg, idx) => {
        const found = segmentResults.find(r => r.index === idx)
        return {
          ...seg,
          corrected_text: found ? found.text : seg.original_text,
        }
      })

      const correctedText = correctedSegments
        .map(s => s.corrected_text ?? s.original_text)
        .join('')

      console.log(`【分段纠错解析结果】corrections 数量: ${parsed.corrections?.length || 0}`)

      return {
        correctedText,
        correctedSegments,
        corrections: (parsed.corrections || []) as Correction[],
        tokensUsed: 0,
      }
    } catch (error) {
      console.error('【分段纠错解析异常】:', error)
      return {
        correctedText: originalSegments.map(s => s.original_text).join(''),
        correctedSegments: originalSegments,
        corrections: [],
        tokensUsed: 0,
      }
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

    // 剥离 Markdown 代码块包裹（部分模型如 DeepSeek 会返回 ```json ... ``` 格式）
    const codeBlockMatch = trimmedText.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
    if (codeBlockMatch) {
      trimmedText = codeBlockMatch[1].trim()
      console.log('【纠错解析】检测到 Markdown 代码块，已剥离')
    }

    // 检查响应是否被截断（检查 JSON 是否完整）
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

// 导出单例
let correctionServiceInstance: CorrectionService | null = null

export function getCorrectionService(): CorrectionService {
  if (!correctionServiceInstance) {
    correctionServiceInstance = new CorrectionService()
  }
  return correctionServiceInstance
}
