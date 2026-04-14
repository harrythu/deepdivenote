import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCorrectionService } from '@/lib/services/correction'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/meetings/[id]/correction
 * 对会议转写文字稿进行纠错
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { topic, vocabulary, model, maxTokens } = body

    // 获取会议及转写内容
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        transcription: true,
      },
    })

    if (!meeting) {
      return NextResponse.json(
        { success: false, error: '会议未找到' },
        { status: 404 }
      )
    }

    if (!meeting.transcription) {
      return NextResponse.json(
        { success: false, error: '该会议没有转写记录' },
        { status: 400 }
      )
    }

    // 调用纠错服务
    const correctionService = getCorrectionService()
    const result = await correctionService.correct(meeting.transcription.fullText, {
      topic,
      vocabulary: vocabulary || [],
      model,
      maxTokens,
    })

    return NextResponse.json({
      success: true,
      data: {
        meetingId: id,
        correctedText: result.correctedText,
        corrections: result.corrections,
        tokensUsed: result.tokensUsed,
      },
    })
  } catch (error) {
    console.error('纠错失败:', error)
    const message = error instanceof Error ? error.message : '纠错失败'
    // 识别上游模型风控拦截错误，给出友好提示
    const isHighRisk = message.includes('high risk') || message.includes('rejected')
    return NextResponse.json(
      {
        success: false,
        error: isHighRisk
          ? '所选模型拒绝了本次请求（内容安全风控），请换用其他模型重试'
          : message,
      },
      { status: 500 }
    )
  }
}
