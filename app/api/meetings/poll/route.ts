import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { createQwenASRService } from '@/lib/services/qwen-asr'
import { MeetingStatus } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 轮询转写任务状态
 * 这个API会被前端定期调用，检查TRANSCRIBING状态的任务
 */
export async function POST(req: NextRequest) {
  try {
    // 查找所有处于 TRANSCRIBING 状态的任务
    const meetings = await prisma.meeting.findMany({
      where: {
        status: MeetingStatus.TRANSCRIBING,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 10, // 每次最多处理10个
    })

    if (meetings.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有待处理的任务',
        processed: 0,
      })
    }

    console.log(`发现 ${meetings.length} 个待轮询的转写任务`)

    const qwenService = createQwenASRService()
    let processed = 0

    for (const meeting of meetings) {
      try {
        // 从 errorMessage 中提取 task_id
        const taskIdMatch = meeting.errorMessage?.match(/TASK_ID:(.+)/)
        if (!taskIdMatch) {
          console.log(`会议 ${meeting.id} 没有任务ID，跳过`)
          continue
        }

        const taskId = taskIdMatch[1]
        console.log(`查询任务 ${taskId} 的状态...`)

        // 查询千问任务状态
        const result = await qwenService.getTaskStatus(taskId)
        const taskStatus = result.output.task_status?.toUpperCase()

        console.log(`任务 ${taskId} 状态: ${taskStatus}`)

        if (taskStatus === 'SUCCEEDED') {
          console.log(`任务 ${taskId} 已完成，开始下载转写结果...`)

          // 下载并保存转写结果
          const transcriptionResult = await qwenService.parseTranscriptionResult(result)

          // 更新数据库
          await prisma.meeting.update({
            where: { id: meeting.id },
            data: {
              status: MeetingStatus.COMPLETED,
              progress: 100,
            },
          })

          // 创建转写记录
          await prisma.transcription.create({
            data: {
              meetingId: meeting.id,
              fullText: transcriptionResult.text,
              segments: transcriptionResult.segments,
              language: transcriptionResult.language,
              wordCount: transcriptionResult.text.length,
            },
          })

          console.log(`会议 ${meeting.id} 转写完成！`)
          processed++
        } else if (taskStatus === 'FAILED') {
          console.error(`任务 ${taskId} 失败:`, result)

          await prisma.meeting.update({
            where: { id: meeting.id },
            data: {
              status: MeetingStatus.FAILED,
              errorMessage: `转写失败: ${JSON.stringify(result)}`,
            },
          })

          processed++
        } else if (taskStatus === 'PENDING' || taskStatus === 'RUNNING') {
          // 任务还在处理中，更新进度
          const progress = taskStatus === 'PENDING' ? 30 : 60
          await prisma.meeting.update({
            where: { id: meeting.id },
            data: { progress },
          })
        }
      } catch (error) {
        console.error(`处理会议 ${meeting.id} 时出错:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      total: meetings.length,
    })
  } catch (error) {
    console.error('轮询失败:', error)
    return NextResponse.json(
      { success: false, error: '轮询失败' },
      { status: 500 }
    )
  }
}
