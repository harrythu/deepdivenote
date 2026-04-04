import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireUser } from '@/lib/auth/get-user'

// 获取用户历史记录列表
export async function GET() {
  try {
    const user = await requireUser()

    const histories = await prisma.meetingHistory.findMany({
      where: {
        meeting: {
          userId: user.id,
        },
      },
      include: {
        meeting: {
          select: {
            id: true,
            title: true,
            audioFormat: true,
            audioSize: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      data: histories,
    })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      )
    }
    console.error('获取历史记录失败:', error)
    return NextResponse.json(
      { success: false, error: '获取历史记录失败' },
      { status: 500 }
    )
  }
}