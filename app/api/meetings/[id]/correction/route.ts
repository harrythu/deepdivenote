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
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '纠错失败' },
      { status: 500 }
    )
  }
}
