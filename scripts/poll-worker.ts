#!/usr/bin/env tsx
/**
 * 后台轮询 worker
 * 不依赖前端，独立运行
 * 使用方法: npx tsx -r dotenv/config scripts/poll-worker.ts
 * 或持续运行: npx tsx -r dotenv/config -e "while true; do npx tsx -r dotenv/config scripts/poll-worker.ts; sleep 5; done"
 */

import { prisma } from '../lib/db/prisma'
import { createQwenASRService } from '../lib/services/qwen-asr'
import { MeetingStatus } from '@prisma/client'

async function pollTranscriptions() {
  try {
    // 查找所有处于 TRANSCRIBING 状态的任务
    const meetings = await prisma.meeting.findMany({
      where: {
        status: MeetingStatus.TRANSCRIBING,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 10,
    })

    if (meetings.length === 0) {
      return
    }

    console.log(`[${new Date().toISOString()}] 发现 ${meetings.length} 个待处理任务`)

    const qwenService = createQwenASRService()
    let processed = 0

    for (const meeting of meetings) {
      try {
        // 从 errorMessage 中提取 task_id
        const taskIdMatch = meeting.errorMessage?.match(/TASK_ID:(.+)/)
        if (!taskIdMatch) {
          continue
        }

        const taskId = taskIdMatch[1]

        // 查询千问任务状态
        const result = await qwenService.getTaskStatus(taskId)
        const taskStatus = result.output.task_status?.toUpperCase()

        if (taskStatus === 'SUCCEEDED') {
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

          console.log(`✓ 会议 ${meeting.id} 转写完成`)
          processed++
        } else if (taskStatus === 'FAILED') {
          await prisma.meeting.update({
            where: { id: meeting.id },
            data: {
              status: MeetingStatus.FAILED,
              errorMessage: `转写失败`,
            },
          })
          console.log(`✗ 会议 ${meeting.id} 转写失败`)
          processed++
        }
      } catch (error) {
        console.error(`处理会议 ${meeting.id} 出错:`, error)
      }
    }

    if (processed > 0) {
      console.log(`[${new Date().toISOString()}] 处理完成: ${processed}/${meetings.length}`)
    }
  } catch (error) {
    console.error('轮询出错:', error)
  }
}

// 如果有 --watch 参数则持续运行，否则只执行一次
if (process.argv.includes('--watch')) {
  console.log('启动轮询 worker (持续运行，每5秒检查一次)...')
  setInterval(pollTranscriptions, 5000)
} else {
  pollTranscriptions()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}
