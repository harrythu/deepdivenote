import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getFullUser } from '@/lib/auth/get-user'
import { getModelConfig } from '@/lib/services/llm-client'
import { AppMode } from '@/lib/context/mode-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * AI辅助创建模板
 * POST /api/user/templates/ai-generate
 * Body: { originalText, referenceSummary, model, mode }
 */
export async function POST(req: NextRequest) {
  let appMode: AppMode = 'external'

  try {
    const body = await req.json()
    const { originalText, referenceSummary, model, mode } = body

    if (!originalText || !referenceSummary) {
      return NextResponse.json(
        { success: false, error: '请提供原始文档和参考结果' },
        { status: 400 }
      )
    }

    // 获取当前用户
    const currentUser = await getFullUser()

    // 确定使用的模式
    appMode = mode === 'internal' ? 'internal' : 'external'

    // 如果是内部版但未登录，返回错误
    if (appMode === 'internal' && !currentUser) {
      return NextResponse.json(
        { success: false, error: '内部版需要登录后才能使用' },
        { status: 401 }
      )
    }

    // 获取配置
    const config = getModelConfig(appMode)

    // 确定使用的模型
    const selectedModel = model || config.default

    // 获取用户的 API KEY（内部版）
    const userApiKey = currentUser?.thetaApiKey || undefined

    console.log('【AI模板生成】模式:', appMode, '使用模型:', selectedModel)
    console.log('【AI模板生成】原始文档长度:', originalText.length)
    console.log('【AI模板生成】参考结果长度:', referenceSummary.length)

    // 创建客户端
    let apiKey: string
    if (appMode === 'internal') {
      if (!userApiKey) {
        return NextResponse.json(
          { success: false, error: '内部版需要配置您的 API KEY' },
          { status: 400 }
        )
      }
      apiKey = userApiKey
    } else {
      apiKey = process.env[config.apiKeyEnv] || process.env.ZENMUX_API_KEY || ''
    }

    const client = new OpenAI({
      apiKey,
      baseURL: config.baseURL,
    })

    const systemPrompt = `你有两份内容，第一份文档是会议原始录音转写内容，第二份文档是我整理好的会议纪要。请阅读并总结我的会议纪要写作的内容格式、内容审美、写作习惯、写作思路。然后帮我创作一版给大模型的提示词，当我把类似第一份原始文档给到大模型的时候，大模型可以帮忙生成会议纪要。

请直接输出提示词内容，不要添加其他解释说明。提示词中需要包含对输出格式的具体要求。`

    const response = await client.chat.completions.create({
      model: selectedModel,
      max_tokens: 8000,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `第一份文档（会议原始录音转写内容）：\n${originalText}\n\n第二份文档（参考会议纪要）：\n${referenceSummary}`,
        },
      ],
    })

    const generatedTemplate = response.choices[0]?.message?.content || ''

    console.log('【AI模板生成】生成结果长度:', generatedTemplate.length)

    return NextResponse.json({
      success: true,
      data: {
        template: generatedTemplate,
      },
    })
  } catch (error) {
    console.error('【AI模板生成】失败:', error)

    // 检查是否是超时错误（使用正则表达式匹配多种超时变体）
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorMessageLower = errorMessage.toLowerCase()
    const isTimeout = errorMessageLower.includes('timeout') ||
                      errorMessageLower.includes('time out') ||
                      errorMessageLower.includes('timed out') ||
                      errorMessage.includes('AbortError') ||
                      errorMessage.includes('ECONNRESET') ||
                      errorMessage.includes('socket hang up')

    // 如果是内部版且超时，返回特定错误提示
    if (appMode === 'internal' && isTimeout) {
      return NextResponse.json(
        { success: false, error: 'INTERNAL_TIMEOUT', message: '目前蚂蚁内部版无法工作，请检查：1、您是否处于蚂蚁内网或者开启内网VPN；2、您配置的Theta API key是否有效' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { success: false, error: errorMessage || '生成失败' },
      { status: 500 }
    )
  }
}
