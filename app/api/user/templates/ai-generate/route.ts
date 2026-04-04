import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * AI辅助创建模板
 * POST /api/user/templates/ai-generate
 * Body: { originalText, referenceSummary, model }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { originalText, referenceSummary, model = 'openai/gpt-5.4-mini' } = body

    if (!originalText || !referenceSummary) {
      return NextResponse.json(
        { success: false, error: '请提供原始文档和参考结果' },
        { status: 400 }
      )
    }

    console.log('【AI模板生成】使用模型:', model)
    console.log('【AI模板生成】原始文档长度:', originalText.length)
    console.log('【AI模板生成】参考结果长度:', referenceSummary.length)

    // 调用 ZenMux API
    const client = new OpenAI({
      apiKey: process.env.ZENMUX_API_KEY,
      baseURL: 'https://zenmux.ai/api/v1',
    })

    const systemPrompt = `你有两份内容，第一份文档是会议原始录音转写内容，第二份文档是我整理好的会议纪要。请阅读并总结我的会议纪要写作的内容格式、内容审美、写作习惯、写作思路。然后帮我创作一版给大模型的提示词，当我把类似第一份原始文档给到大模型的时候，大模型可以帮忙生成会议纪要。

请直接输出提示词内容，不要添加其他解释说明。提示词中需要包含对输出格式的具体要求。`

    const response = await client.chat.completions.create({
      model: model,
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
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '生成失败' },
      { status: 500 }
    )
  }
}