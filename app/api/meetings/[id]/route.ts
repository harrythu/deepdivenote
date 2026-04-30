import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 获取会议详情
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        transcription: true,
        summary: true,
      },
    })

    if (!meeting) {
      return NextResponse.json(
        { success: false, error: '会议未找到' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: meeting.id,
        title: meeting.title,
        status: meeting.status,
        progress: meeting.progress,
        audioFormat: meeting.audioFormat,
        audioSize: meeting.audioSize,
        duration: meeting.duration,
        errorMessage: meeting.errorMessage,
        createdAt: meeting.createdAt.toISOString(),
        transcription: meeting.transcription
          ? {
              id: meeting.transcription.id,
              fullText: meeting.transcription.fullText,
              segments: meeting.transcription.segments ?? [],
              speakerMap: (meeting.transcription.speakerMap as Record<string, string>) ?? {},
            }
          : null,
        summary: meeting.summary
          ? {
              id: meeting.summary.id,
              content: meeting.summary.content,
            }
          : null,
      },
    })
  } catch (error) {
    console.error('获取会议失败:', error)
    return NextResponse.json(
      { success: false, error: '获取会议失败' },
      { status: 500 }
    )
  }
}
