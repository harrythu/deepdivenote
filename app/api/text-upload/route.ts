import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { MeetingStatus } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth/get-user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 上传录音逐字稿API
 * 流程:
 * 1. 接收文本内容和标题
 * 2. 创建Meeting记录和Transcription记录
 * 3. 直接返回会议ID（无需转写）
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, content } = body

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { success: false, error: '请提供文字稿内容' },
        { status: 400 }
      )
    }

    // 获取当前用户（如果已登录）
    const currentUser = await getCurrentUser()

    const meetingTitle = title?.trim() || '未命名逐字稿'
    const fileName = `${meetingTitle}.txt`

    console.log(`接收到文字稿: ${meetingTitle}, 长度: ${content.length} 字符`)

    // 1. 创建Meeting记录
    const meeting = await prisma.meeting.create({
      data: {
        title: meetingTitle,
        status: MeetingStatus.COMPLETED,
        progress: 100,
        userId: currentUser?.id, // 关联用户
      },
    })

    console.log(`创建Meeting记录: ${meeting.id}`)

    // 如果用户已登录，创建历史记录
    if (currentUser) {
      const now = new Date()
      await prisma.meetingHistory.create({
        data: {
          meetingId: meeting.id,
          uploadDate: now,
          uploadTime: now,
          fileName: fileName,
        },
      }).catch((error) => {
        console.error('创建历史记录失败:', error)
      })
    }

    // 2. 创建Transcription记录（直接存储文字稿）
    await prisma.transcription.create({
      data: {
        meetingId: meeting.id,
        fullText: content,
        wordCount: content.length,
        model: 'manual',
      },
    })

    console.log(`创建Transcription记录完成`)

    return NextResponse.json({
      success: true,
      data: {
        meetingId: meeting.id,
        message: '文字稿上传成功',
      },
    })
  } catch (error) {
    console.error('文字稿上传处理失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '上传失败',
      },
      { status: 500 }
    )
  }
}