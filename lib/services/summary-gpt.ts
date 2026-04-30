import OpenAI from 'openai'
import * as fs from 'fs'
import * as path from 'path'
import { RichSegment, SpeakerMap } from '@/lib/types'

export interface SummaryOptions {
  template?: string  // 模板ID或自定义提示词
  language?: 'zh' | 'en' | 'auto'
  model?: string     // 模型ID，如 openai/gpt-5.4-mini
  maxTokens?: number // 最大输出token数
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
 * ZenMux OpenAI SDK 会议纪要生成服务
 */
export class SummaryService {
  private client: OpenAI
  private templates: Map<string, { prompt: string; needsJson: boolean }> = new Map()

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.ZENMUX_API_KEY,
      baseURL: 'https://zenmux.ai/api/v1',
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

    // 加载访谈纪要精炼版模板 (Markdown 输出)
    try {
      const interviewLessPath = path.join(process.cwd(), 'default_summary_less_prompt.txt')
      if (fs.existsSync(interviewLessPath)) {
        const prompt = fs.readFileSync(interviewLessPath, 'utf-8')
        this.templates.set('interview-less', { prompt, needsJson: false })
        console.log('【纪要服务】已加载访谈纪要精炼版模板')
      }
    } catch (error) {
      console.warn('【纪要服务】加载访谈纪要精炼版模板失败:', error)
    }

    // 加载投资人模板 (Markdown 输出)
    try {
      const investorPath = path.join(process.cwd(), 'default_investor_prompt.txt')
      if (fs.existsSync(investorPath)) {
        const prompt = fs.readFileSync(investorPath, 'utf-8')
        this.templates.set('investor', { prompt, needsJson: false })
        console.log('【纪要服务】已加载投资人模板')
      }
    } catch (error) {
      console.warn('【纪要服务】加载投资人模板失败:', error)
    }
  }

  /**
   * 获取所有可用模板
   */
  getTemplates(): { id: string; name: string; isCustom: boolean }[] {
    const result: { id: string; name: string; isCustom: boolean }[] = []

    for (const [id] of this.templates) {
      if (id === 'interview') {
        result.push({ id, name: '访谈纪要模板（逐字稿）', isCustom: false })
      } else if (id === 'interview-less') {
        result.push({ id, name: '访谈纪要模板（精炼版）', isCustom: false })
      } else if (id === 'investor') {
        result.push({ id, name: '投资人模板', isCustom: false })
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
    const { template: templateId = 'interview', model = 'openai/gpt-5.4-mini', maxTokens = 64000 } = options

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

    console.log(`【纪要生成】使用模型: ${model}, maxTokens: ${maxTokens}, 模板: ${templateId}, 需要JSON解析: ${needsJsonOutput}, 文字长度: ${transcription.length}`)

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
      console.log(`【纪要生成】收到 ${chunkCount} 个 chunk, 最终文本长度: ${fullText.length}`)

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

/**
 * 将 RichSegment[] 格式化为带发言人名称和时间戳的对话文本
 * 用于区分发言人的纪要生成
 *
 * 输出格式：
 * [00:01] 张三：我看一下，理解了。
 * [00:05] 李四：好的，然后还有一块...
 */
export function formatSegmentsWithSpeakers(
  segments: RichSegment[],
  speakerMap: SpeakerMap = {}
): string {
  return segments
    .map((seg) => {
      const displayText = seg.corrected_text ?? seg.original_text
      const speakerName =
        seg.speaker_id !== undefined
          ? (speakerMap[String(seg.speaker_id)] ?? `发言人${seg.speaker_id}`)
          : null
      const timestamp = formatMs(seg.begin_time)
      if (speakerName) {
        return `[${timestamp}] ${speakerName}：${displayText}`
      }
      return `[${timestamp}] ${displayText}`
    })
    .join('\n')
}

/**
 * 将 RichSegment[] 格式化为纯文本（不区分发言人）
 */
export function formatSegmentsAsPlainText(segments: RichSegment[]): string {
  return segments.map((seg) => seg.corrected_text ?? seg.original_text).join('')
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}