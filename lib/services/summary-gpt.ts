import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs'
import * as path from 'path'

export interface SummaryOptions {
  template?: string  // 模板ID或自定义提示词
  language?: 'zh' | 'en' | 'auto'
}

export interface SummaryResult {
  content: string
  keyPoints: string[]
  actionItems: ActionItem[]
  participants: string[]
  tags: string[]
}

export interface ActionItem {
  description: string
  assignee?: string
  deadline?: string
  priority?: 'high' | 'medium' | 'low'
}

/**
 * ZenMux GPT-5.4-Mini 会议纪要生成服务
 */
export class SummaryService {
  private client: Anthropic
  private templates: Map<string, { prompt: string; needsJson: boolean }> = new Map()

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ZENMUX_API_KEY,
      baseURL: 'https://zenmux.ai/api/anthropic',
    })
    this.loadTemplates()
  }

  /**
   * 加载模板文件
   */
  private loadTemplates() {
    // 加载访谈纪要模板 (Markdown 输出)
    try {
      const interviewPath = path.join(process.cwd(), 'default_summary_prompt.txt')
      if (fs.existsSync(interviewPath)) {
        const prompt = fs.readFileSync(interviewPath, 'utf-8')
        this.templates.set('interview', { prompt, needsJson: false })
        console.log('【纪要服务】已加载访谈纪要模板')
      }
    } catch (error) {
      console.warn('【纪要服务】加载访谈纪要模板失败:', error)
    }

    // 加载会议纪要模板 (JSON 输出)
    try {
      const meetingPath = path.join(process.cwd(), 'default_meeting_prompt.txt')
      if (fs.existsSync(meetingPath)) {
        const prompt = fs.readFileSync(meetingPath, 'utf-8')
        this.templates.set('meeting', { prompt, needsJson: true })
        console.log('【纪要服务】已加载会议纪要模板')
      }
    } catch (error) {
      console.warn('【纪要服务】加载会议纪要模板失败:', error)
    }
  }

  /**
   * 获取所有可用模板
   */
  getTemplates(): { id: string; name: string; isCustom: boolean }[] {
    const result: { id: string; name: string; isCustom: boolean }[] = []

    for (const [id, config] of this.templates) {
      if (id === 'interview') {
        result.push({ id, name: '访谈纪要模板', isCustom: false })
      } else if (id === 'meeting') {
        result.push({ id, name: '会议纪要模板', isCustom: false })
      } else {
        result.push({ id, name: `${id} (自定义)`, isCustom: true })
      }
    }

    result.push({ id: 'custom', name: '自定义模板', isCustom: true })

    return result
  }

  /**
   * 添加自定义模板
   */
  addTemplate(id: string, prompt: string, needsJson: boolean = false) {
    this.templates.set(id, { prompt, needsJson })
  }

  /**
   * 生成会议纪要
   */
  async generateSummary(transcription: string, options: SummaryOptions = {}): Promise<SummaryResult> {
    const { template: templateId = 'interview' } = options

    // 获取模板
    let promptTemplate = ''
    let needsJsonOutput = false

    if (templateId === 'custom') {
      // 自定义模板由前端提供，这里不应该直接调用
      throw new Error('请提供自定义提示词')
    } else if (this.templates.has(templateId)) {
      const template = this.templates.get(templateId)!
      promptTemplate = template.prompt
      needsJsonOutput = template.needsJson
    } else {
      // 默认使用访谈纪要模板
      const defaultTemplate = this.templates.get('interview')
      if (defaultTemplate) {
        promptTemplate = defaultTemplate.prompt
        needsJsonOutput = defaultTemplate.needsJson
      } else {
        throw new Error('未找到可用模板')
      }
    }

    // 替换转写内容
    const prompt = promptTemplate.replace('{{transcription}}', transcription)

    console.log(`【纪要生成】使用模板: ${templateId}, 需要JSON解析: ${needsJsonOutput}, 文字长度: ${transcription.length}`)

    try {
      // 使用流式响应
      const stream = await this.client.messages.stream({
        model: 'openai/gpt-5.4-mini',
        max_tokens: 131072, // 128K
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

      console.log(`【纪要生成】响应长度: ${fullText.length}`)

      // 如果不需要 JSON 输出，直接返回 Markdown 内容
      if (!needsJsonOutput) {
        console.log('【纪要生成】Markdown 格式输出')
        return {
          content: fullText,
          keyPoints: [],
          actionItems: [],
          participants: [],
          tags: [],
        }
      }

      return this.parseJsonResponse(fullText)
    } catch (error) {
      console.error('【纪要生成失败】:', error)
      throw error
    }
  }

  /**
   * 解析 JSON 响应
   */
  private parseJsonResponse(text: string): SummaryResult {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('【纪要解析失败】无法匹配 JSON')
        return {
          content: text,
          keyPoints: [],
          actionItems: [],
          participants: [],
          tags: [],
        }
      }

      const parsed = JSON.parse(jsonMatch[0])

      return {
        content: parsed.summary || '',
        keyPoints: parsed.keyPoints || [],
        actionItems: (parsed.actionItems || []) as ActionItem[],
        participants: parsed.participants || [],
        tags: parsed.tags || [],
      }
    } catch (error) {
      console.error('【纪要解析异常】:', error)
      return {
        content: text,
        keyPoints: [],
        actionItems: [],
        participants: [],
        tags: [],
      }
    }
  }
}

// 导出单例
let summaryServiceInstance: SummaryService | null = null

export function getSummaryService(): SummaryService {
  if (!summaryServiceInstance) {
    summaryServiceInstance = new SummaryService()
  }
  return summaryServiceInstance
}
