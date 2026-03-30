import Anthropic from '@anthropic-ai/sdk'

export interface CorrectionOptions {
  topic?: string           // 会议主题
  vocabulary?: string[]     // 常用词汇列表
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
 * ZenMux API 纠错服务
 * 使用 GPT-5.4-Mini 模型对转写文字稿进行纠错
 */
export class CorrectionService {
  private client: Anthropic

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ZENMUX_API_KEY,
      baseURL: 'https://zenmux.ai/api/anthropic',
    })
  }

  async correct(
    transcription: string,
    options: CorrectionOptions = {}
  ): Promise<CorrectionResult> {
    const { topic, vocabulary = [] } = options

    // GPT-5.4-Mini 配置
    // Context window: 400K tokens
    // 输入限制：约 300K 字符（留空间给 prompt 和 JSON 输出）
    // 输出限制：128K tokens (131072)
    const MAX_INPUT_CHARS = 300000
    const MAX_OUTPUT_TOKENS = 131072 // 128K

    let textToCorrect = transcription
    let wasTruncated = false

    if (transcription.length > MAX_INPUT_CHARS) {
      console.warn(`【警告】文字稿过长 (${transcription.length} 字符)，已截断至 ${MAX_INPUT_CHARS} 字符`)
      textToCorrect = transcription.slice(0, MAX_INPUT_CHARS)
      wasTruncated = true
    }

    const prompt = this.buildPrompt(textToCorrect, topic, vocabulary)

    console.log(`【纠错请求】文字长度: ${textToCorrect.length} 字符, 使用流式模式`)

    try {
      // 使用流式响应处理长文本
      const stream = await this.client.messages.stream({
        model: 'openai/gpt-5.4-mini',
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      let fullText = ''
      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          const delta = event.delta as any
          if (delta.type === 'text_delta' || delta.text) {
            fullText += delta.text || ''
          }
        }
      }

      console.log(`【纠错响应】流式响应完成，长度: ${fullText.length} 字符`)
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
    let context = ''

    if (topic) {
      context += `会议主题：${topic}\n`
    }

    if (vocabulary && vocabulary.length > 0) {
      context += `会议常用词汇（请优先使用这些词汇，不要随意替换）：\n`
      vocabulary.forEach((word, i) => {
        context += `${i + 1}. ${word}\n`
      })
      context += '\n'
    }

    return `你是一个专业的会议逐字稿纠错助手。请对以下转写文字稿进行纠错，包括：

1. 错别字修正
2. 同音字/近音字错误（如"帐"和"账"、"的地得"的用法）
3. 口语化表达转换为书面语（如"那个那个"删除、"嗯嗯啊啊"删除）
4. 重复语句精简
5. 基于会议主题和专业词汇进行术语规范化
6. 语义不通顺的句子修正

${context ? `参考背景信息：\n${context}` : ''}

转写文字稿：
"""
${transcription}
"""

请按照以下 JSON 格式输出纠错结果（只输出 JSON，不要其他内容）：

{
  "correctedText": "纠错后的完整文字稿（保持原有段落结构）",
  "corrections": [
    {
      "original": "原文片段",
      "corrected": "纠错后片段",
      "reason": "纠错原因：错别字/口语化/语义不通顺/术语规范化等"
    }
  ]
}

注意事项：
1. correctedText 是纠错后的完整文字稿，请保持原有段落结构和格式
2. corrections 数组列出所有具体纠错，每个纠错包含原文、纠错后和原因
3. 如果没有需要纠错的地方，corrections 为空数组，correctedText 与原文相同
4. 保持原文的语气和说话风格，不要过度修改
`
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

// 导出单例
let correctionServiceInstance: CorrectionService | null = null

export function getCorrectionService(): CorrectionService {
  if (!correctionServiceInstance) {
    correctionServiceInstance = new CorrectionService()
  }
  return correctionServiceInstance
}
