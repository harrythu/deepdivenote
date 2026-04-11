import OpenAI from 'openai'
import * as fs from 'fs'
import * as path from 'path'
import { AppMode } from '@/lib/context/mode-context'
import { getModelConfig } from './llm-client'

export interface SummaryOptions {
  template?: string  // 模板ID或自定义提示词
  language?: 'zh' | 'en' | 'auto'
  model?: string     // 模型ID
  maxTokens?: number // 最大输出token数
  mode?: AppMode     // 应用模式
  userApiKey?: string // 用户自己的 API KEY（内部版使用）
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
 * 创建纪要服务的客户端
 */
function createClient(options: { mode: AppMode; userApiKey?: string }): OpenAI {
  const { mode, userApiKey } = options

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
 * 会议纪要生成服务
 */
export class SummaryService {
  private mode: AppMode
  private userApiKey?: string
  private templates: Map<string, { prompt: string; needsJson: boolean }> = new Map()

  constructor(mode: AppMode = 'external', userApiKey?: string) {
    this.mode = mode
    this.userApiKey = userApiKey
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
        result.push({ id, name: '访谈纪要模板', isCustom: false })
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
  async generateSummary(transcription: string, options: Omit<SummaryOptions, 'mode' | 'userApiKey'> = {}): Promise<SummaryResult> {
    const { template: templateId = 'interview', model, maxTokens } = options

    // 获取对应的模型配置
    const config = getModelConfig(this.mode)
    const defaultModel = model || config.default
    const defaultMaxTokens = maxTokens || config.defaultMaxTokens

    // 获取模板
    let promptTemplate = ''
    let needsJsonOutput = false

    if (templateId === 'custom') {
      throw new Error('请提供自定义提示词')
    } else if (this.templates.has(templateId)) {
      const template = this.templates.get(templateId)!
      promptTemplate = template.prompt
      needsJsonOutput = template.needsJson
    } else {
      const defaultTemplate = this.templates.get('interview')
      if (defaultTemplate) {
        promptTemplate = defaultTemplate.prompt
        needsJsonOutput = defaultTemplate.needsJson
      } else {
        throw new Error('未找到可用模板')
      }
    }

    const prompt = promptTemplate.replace('{{transcription}}', transcription)
    const client = createClient({ mode: this.mode, userApiKey: this.userApiKey })

    console.log(`【纪要生成】模式: ${this.mode}, 模型: ${defaultModel}, 模板: ${templateId}, 文字长度: ${transcription.length}`)

    try {
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
      console.log(`【纪要生成】收到 ${chunkCount} 个 chunk, 最终文本长度: ${fullText.length}`)

      if (!needsJsonOutput) {
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

// 导出单例（仅用于外部版）
let summaryServiceInstance: SummaryService | null = null

export function getSummaryService(mode?: AppMode, userApiKey?: string): SummaryService {
  // 如果指定了 mode 或 userApiKey，创建新的实例
  if (mode || userApiKey) {
    return new SummaryService(mode, userApiKey)
  }
  // 否则返回外部版的单例
  if (!summaryServiceInstance) {
    summaryServiceInstance = new SummaryService('external')
  }
  return summaryServiceInstance
}
