import { NextRequest, NextResponse } from 'next/server'
import { getSummaryService } from '@/lib/services/summary-gpt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/meetings/[id]/summary
 * 获取可用的提示词模板列表
 */
export async function GET(req: NextRequest) {
  try {
    const summaryService = getSummaryService()
    const templates = summaryService.getTemplates()

    return NextResponse.json({
      success: true,
      data: { templates },
    })
  } catch (error) {
    console.error('获取模板列表失败:', error)
    return NextResponse.json(
      { success: false, error: '获取模板列表失败' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/meetings/[id]/summary
 * 生成会议纪要
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { transcription, template = 'interview', customPrompt, model = 'openai/gpt-5.4-mini', maxTokens } = body

    console.log('【纪要API】接收到的模型参数:', model, 'maxTokens:', maxTokens)

    if (!transcription) {
      return NextResponse.json(
        { success: false, error: '请提供转写文字稿' },
        { status: 400 }
      )
    }

    const summaryService = getSummaryService()

    // 如果选择自定义模板，使用用户提供的提示词
    let templateId = template
    if (template === 'custom' && customPrompt) {
      templateId = `custom_${Date.now()}`
      // 在用户提供的提示词前添加前缀
      const fullPrompt = `基于{{transcription}}形成一篇会议纪要，并且要求：\n\n${customPrompt}`
      summaryService.addTemplate(templateId, fullPrompt, false) // 自定义模板输出 Markdown
    }

    const result = await summaryService.generateSummary(transcription, { template: templateId, model, maxTokens })

    return NextResponse.json({
      success: true,
      data: {
        meetingId: id,
        ...result,
      },
    })
  } catch (error) {
    console.error('生成纪要失败:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '生成纪要失败' },
      { status: 500 }
    )
  }
}
