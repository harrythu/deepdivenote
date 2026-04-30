import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { SpeakerMap } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/meetings/[id]/speakers
 * 保存发言人名称映射
 * Body: { speakerMap: { "0": "张三", "1": "李四" } }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { speakerMap } = body as { speakerMap: SpeakerMap }

    if (!speakerMap || typeof speakerMap !== 'object') {
      return NextResponse.json({ success: false, error: 'speakerMap 格式错误' }, { status: 400 })
    }

    // 验证会议存在
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

    // 保存 speakerMap
    await prisma.transcription.update({
      where: { meetingId: id },
      data: { speakerMap: speakerMap as any },
    })

    return NextResponse.json({ success: true, data: { speakerMap } })
  } catch (error) {
    console.error('保存发言人名称失败:', error)
    return NextResponse.json(
      { success: false, error: '保存失败' },
      { status: 500 }
    )
  }
}
