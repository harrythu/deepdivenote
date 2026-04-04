import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/get-user'

/**
 * 更新会议历史记录
 * 当纪要生成完成时调用，更新历史记录中的纪要信息
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params
    const body = await req.json()
    const { summaryContent } = body

    // 查找历史记录
    const history = await prisma.meetingHistory.findUnique({
      where: { meetingId },
    })

    if (!history) {
      return NextResponse.json(
        { success: false, error: '历史记录不存在' },
        { status: 404 }
      )
    }

    // 更新历史记录
    const now = new Date()
    await prisma.meetingHistory.update({
      where: { id: history.id },
      data: {
        summaryDate: now,
        summaryTime: now,
        summaryContent: summaryContent || null,
      },
    })

    return NextResponse.json({
      success: true,
      data: { updated: true },
    })
  } catch (error) {
    console.error('更新历史记录失败:', error)
    return NextResponse.json(
      { success: false, error: '更新历史记录失败' },
      { status: 500 }
    )
  }
}