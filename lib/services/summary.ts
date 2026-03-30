import Anthropic from '@anthropic-ai/sdk'
import {
  ISummaryService,
  SummaryOptions,
  SummaryResult,
  ActionItem,
} from '@/lib/types'

/**
 * Claude API 摘要服务
 * 使用 Anthropic Claude API 生成会议纪要
 */
export class ClaudeAPIService implements ISummaryService {
  private client: Anthropic

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    })
  }

  async generateSummary(
    transcription: string,
    options?: SummaryOptions
  ): Promise<SummaryResult> {
    try {
      const language = options?.language || 'zh'
      const prompt = this.buildPrompt(transcription, language)

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      const content = response.content[0]
      if (content.type !== 'text') {
        throw new Error('意外的响应类型')
      }

      // 解析 Claude 的响应
      const result = this.parseClaudeResponse(content.text)

      return {
        ...result,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      }
    } catch (error) {
      console.error('Claude API 生成纪要失败:', error)
      throw new Error(`生成纪要失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  private buildPrompt(transcription: string, language: string): string {
    const languageInstruction = language === 'zh'
      ? '请用中文回复'
      : 'Please respond in English'

    return `你是一个专业的会议纪要助手。请根据以下会议逐字稿，生成一份结构化的会议纪要。${languageInstruction}。

会议逐字稿：
"""
${transcription}
"""

请按照以下 JSON 格式输出（只输出 JSON，不要其他内容）：

{
  "summary": "会议的整体摘要（2-3段落，Markdown格式）",
  "keyPoints": [
    "关键要点1",
    "关键要点2",
    "关键要点3"
  ],
  "actionItems": [
    {
      "description": "待办事项描述",
      "assignee": "负责人（如果提到）",
      "deadline": "截止日期（如果提到）",
      "priority": "high|medium|low"
    }
  ],
  "participants": ["参与者1", "参与者2"],
  "tags": ["标签1", "标签2"]
}

注意事项：
1. summary 使用 Markdown 格式，可包含标题、列表等
2. keyPoints 提取最重要的3-5个要点
3. actionItems 提取所有待办事项和决策
4. participants 尝试识别参与者（如果逐字稿中有名字）
5. tags 提取3-5个关键词标签
6. 如果某个字段无法确定，使用空数组或 null
`
  }

  private parseClaudeResponse(text: string): Omit<SummaryResult, 'tokensUsed'> {
    try {
      // 尝试提取 JSON（Claude 可能会在前后添加一些说明文字）
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('无法从响应中提取 JSON')
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
      console.error('解析 Claude 响应失败:', error)
      // 降级处理：返回原始文本
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

/**
 * 本地 LLM 摘要服务 (未来实现)
 * 用于后期切换到自部署模型
 */
export class LocalLLMService implements ISummaryService {
  async generateSummary(
    transcription: string,
    options?: SummaryOptions
  ): Promise<SummaryResult> {
    // TODO: 实现本地 LLM 调用（如 Ollama + Llama 3）
    throw new Error('本地 LLM 服务尚未实现')
  }
}

/**
 * 摘要服务工厂
 * 根据配置返回对应的服务实例
 */
export function createSummaryService(): ISummaryService {
  const serviceType = process.env.SUMMARY_SERVICE || 'claude-api'

  switch (serviceType) {
    case 'claude-api':
      return new ClaudeAPIService()
    case 'local-llm':
      return new LocalLLMService()
    default:
      throw new Error(`未知的摘要服务类型: ${serviceType}`)
  }
}
