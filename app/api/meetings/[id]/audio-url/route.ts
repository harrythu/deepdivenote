import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getOssService } from '@/lib/services/oss'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/meetings/[id]/audio-url
 * 返回音频文件的 OSS 签名临时 URL（有效期 2 小时）
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      select: { audioPath: true },
    })

    if (!meeting) {
      return NextResponse.json({ success: false, error: '会议未找到' }, { status: 404 })
    }

    if (!meeting.audioPath) {
      return NextResponse.json({ success: false, error: '该会议没有音频文件' }, { status: 404 })
    }

    const ossService = getOssService()
    const url = await ossService.getSignedUrl(meeting.audioPath, 7200) // 2小时有效

    return NextResponse.json({ success: true, data: { url } })
  } catch (error) {
    console.error('获取音频 URL 失败:', error)
    return NextResponse.json(
      { success: false, error: '获取音频 URL 失败' },
      { status: 500 }
    )
  }
}
