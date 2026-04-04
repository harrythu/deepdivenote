import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { ossService } from '@/lib/services/oss'
import { createQwenASRService } from '@/lib/services/qwen-asr'
import { prisma } from '@/lib/db/prisma'
import { MeetingStatus } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth/get-user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// 配置最大请求体大小为500MB (App Router 使用 bodyParser 和 maxDuration)
export const maxDuration = 300 // 最大执行时间 5 分钟

/**
 * 上传音频文件API
 * 流程:
 * 1. 接收文件上传
 * 2. 保存到临时目录
 * 3. 上传到阿里云OSS获取公网URL
 * 4. 创建Meeting记录
 * 5. 提交千问ASR任务
 * 6. 返回会议ID
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: '未找到上传文件' },
        { status: 400 }
      )
    }

    // 验证文件类型
    const allowedTypes = [
      'audio/mpeg',
      'audio/wav',
      'audio/mp4',
      'audio/x-m4a',
      'audio/aac',
      'audio/flac',
      'audio/ogg',
    ]

    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|aac|flac|ogg)$/i)) {
      return NextResponse.json(
        { success: false, error: '不支持的文件格式' },
        { status: 400 }
      )
    }

    // 验证文件大小（500MB）
    const maxSize = 500 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: '文件过大，最大支持 500MB' },
        { status: 400 }
      )
    }

    console.log(`接收到文件: ${file.name}, 大小: ${file.size} bytes`)

    // 获取当前用户（如果已登录）
    const currentUser = await getCurrentUser()

    // 1. 创建Meeting记录
    const meeting = await prisma.meeting.create({
      data: {
        title: file.name.replace(/\.[^/.]+$/, ''), // 移除扩展名
        audioFormat: path.extname(file.name).toLowerCase().replace('.', ''),
        audioSize: file.size,
        status: MeetingStatus.UPLOADING,
        progress: 0,
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
          fileName: file.name,
        },
      }).catch((error) => {
        console.error('创建历史记录失败:', error)
      })
    }

    try {
      // 2. 转换文件为Buffer
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // 3. 上传到阿里云OSS
      console.log('开始上传到OSS...')
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { progress: 10 },
      })

      const { url: ossUrl, key: ossKey } = await ossService.uploadFile(
        buffer,
        file.name
      )

      console.log(`文件上传到OSS成功: ${ossUrl}`)

      // 4. 更新Meeting记录
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          audioPath: ossKey,
          status: MeetingStatus.TRANSCRIBING,
          progress: 20,
        },
      })

      // 5. 提交千问ASR转写任务
      console.log('提交千问ASR任务...')
      const qwenService = createQwenASRService()
      const taskId = await qwenService.submitTask(ossUrl)

      console.log(`千问任务ID: ${taskId}`)

      // 6. 保存任务ID到数据库（使用 errorMessage 字段临时存储）
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          errorMessage: `TASK_ID:${taskId}`, // 临时存储任务ID
          progress: 30,
        },
      })

      // TODO: 这里应该将任务加入BullMQ队列进行异步轮询
      // 目前暂时返回成功，后续实现后台轮询

      return NextResponse.json({
        success: true,
        data: {
          meetingId: meeting.id,
          taskId,
          message: '文件上传成功，转写任务已提交',
        },
      })
    } catch (error) {
      // 如果上传或转写失败，更新状态
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          status: MeetingStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : '未知错误',
        },
      })

      throw error
    }
  } catch (error) {
    console.error('上传处理失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '上传失败',
      },
      { status: 500 }
    )
  }
}
