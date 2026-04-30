import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCorrectionService } from '@/lib/services/correction'
import { RichSegment } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/meetings/[id]/correction
 * 对会议转写文字稿进行纠错
 *
 * 主路径：若 transcription.segments 为 RichSegment[]，按 segment 逐条纠错，
 *         结果回填 corrected_text，保留时间戳和说话人不变。
 * 降级路径：无 segments 时，对 fullText 整体纠错。
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
      include: { transcription: true },
    })

    if (!meeting) {
      return NextResponse.json({ success: false, error: '会议未找到' }, { status: 404 })
    }

    if (!meeting.transcription) {
      return NextResponse.json({ success: false, error: '该会议没有转写记录' }, { status: 400 })
    }

    const correctionService = getCorrectionService()
    const rawSegments = meeting.transcription.segments

    // 判断是否为 RichSegment[] 格式（有 original_text 字段）
    // 兼容旧的 QwenSegment 格式（有 text 字段但无 original_text）
    let richSegments: RichSegment[] = []
    const hasSegments = Array.isArray(rawSegments) && rawSegments.length > 0

    if (hasSegments) {
      const first = rawSegments[0] as any
      if (typeof first.original_text === 'string') {
        // 已经是 RichSegment 格式
        richSegments = rawSegments as unknown as RichSegment[]
      } else if (typeof first.text === 'string') {
        // 旧的 QwenSegment 格式，转换为 RichSegment
        console.log('【纠错 API】检测到旧格式 QwenSegment，自动转换为 RichSegment')
        richSegments = (rawSegments as any[]).map((seg: any) => ({
          begin_time: seg.begin_time ?? 0,
          end_time: seg.end_time ?? 0,
          speaker_id: seg.speaker_id !== undefined ? Number(seg.speaker_id) : undefined,
          channel_id: seg.channel_id,
          words: seg.words,
          original_text: seg.text ?? '',
          corrected_text: undefined,
        }))
      }
    }

    let result

    if (richSegments.length > 0) {
      // 主路径：按 segment 逐条纠错
      console.log(`【纠错 API】使用分段纠错，共 ${richSegments.length} 段`)
      result = await correctionService.correctSegments(richSegments, {
        topic,
        vocabulary: vocabulary || [],
        model,
        maxTokens,
      })

      // 将纠错后的 segments 持久化到数据库
      if (result.correctedSegments) {
        await prisma.transcription.update({
          where: { meetingId: id },
          data: {
            segments: result.correctedSegments as any,
            correctedAt: new Date(),
          },
        })
      }
    } else {
      // 降级路径：整体纠错
      console.log('【纠错 API】无 RichSegment，使用全文纠错')
      result = await correctionService.correct(meeting.transcription.fullText, {
        topic,
        vocabulary: vocabulary || [],
        model,
        maxTokens,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        meetingId: id,
        correctedText: result.correctedText,
        correctedSegments: result.correctedSegments ?? null,
        corrections: result.corrections,
        tokensUsed: result.tokensUsed,
      },
    })
  } catch (error) {
    console.error('纠错失败:', error)
    const message = error instanceof Error ? error.message : '纠错失败'
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
