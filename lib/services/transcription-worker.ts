/**
 * 转写任务轮询Worker
 * 定期检查待处理的Meeting并轮询千问API获取结果
 */

import { prisma } from '@/lib/db/prisma'
import { MeetingStatus } from '@prisma/client'
import { createQwenASRService, QwenTranscriptionResult } from './qwen-asr'
import { RichSegment, QwenSegment } from '@/lib/types'

/**
 * 将 Fun-ASR 返回的 QwenSegment[] 转换为 RichSegment[] 存储格式
 */
function toRichSegments(rawSegments: QwenSegment[]): RichSegment[] {
  return rawSegments.map((seg) => ({
    begin_time: seg.begin_time ?? 0,
    end_time: seg.end_time ?? 0,
    speaker_id: seg.speaker_id !== undefined ? Number(seg.speaker_id) : undefined,
    channel_id: seg.channel_id,
    words: seg.words,
    original_text: seg.text ?? '',
    corrected_text: undefined,
  }))
}

export class TranscriptionWorker {
  private qwenService = createQwenASRService()
  private isRunning = false
  private pollInterval = 10000 // 10秒检查一次数据库

  /**
   * 启动Worker
   */
  async start() {
    if (this.isRunning) {
      console.log('Worker已在运行中')
      return
    }

    this.isRunning = true
    console.log('🚀 转写Worker已启动')

    while (this.isRunning) {
      try {
        await this.processPendingMeetings()
      } catch (error) {
        console.error('处理失败:', error)
      }

      // 等待后继续
      await new Promise(resolve => setTimeout(resolve, this.pollInterval))
    }
  }

  /**
   * 停止Worker
   */
  stop() {
    this.isRunning = false
    console.log('Worker已停止')
  }

  /**
   * 处理待转写的会议
   */
  private async processPendingMeetings() {
    // 查找所有正在转写中的会议
    const meetings = await prisma.meeting.findMany({
      where: {
        status: MeetingStatus.TRANSCRIBING,
        errorMessage: {
          startsWith: 'TASK_ID:', // 包含任务ID
        },
      },
    })

    if (meetings.length === 0) {
      return
    }

    console.log(`📋 发现 ${meetings.length} 个待处理的转写任务`)

    for (const meeting of meetings) {
      try {
        await this.processMeeting(meeting)
      } catch (error) {
        console.error(`处理Meeting ${meeting.id} 失败:`, error)

        // 更新为失败状态
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: {
            status: MeetingStatus.FAILED,
            errorMessage: error instanceof Error ? error.message : '处理失败',
          },
        })
      }
    }
  }

  /**
   * 处理单个会议
   */
  private async processMeeting(meeting: any) {
    // 从errorMessage中提取任务ID
    const taskId = meeting.errorMessage?.replace('TASK_ID:', '')
    if (!taskId) {
      throw new Error('未找到任务ID')
    }

    console.log(`📝 处理Meeting ${meeting.id}, 任务ID: ${taskId}`)

    // 查询任务状态
    const result = await this.qwenService.getTaskStatus(taskId)
    const status = result.output.task_status?.toUpperCase()

    console.log(`   状态: ${status}`)

    if (status === 'RUNNING' || status === 'PENDING') {
      // 仍在处理中，更新进度
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          progress: 50, // 可以根据实际情况调整
        },
      })
      return
    }

    if (status === 'SUCCEEDED') {
      console.log(`   ✅ 转写完成`)

      // 解析转写结果
      const transcriptionResult = await this.qwenService.parseTranscriptionResult(result)

      // 将 QwenSegment[] 转为 RichSegment[] 存储（含 original_text，corrected_text 为 undefined）
      const richSegments = transcriptionResult.segments.length > 0
        ? toRichSegments(transcriptionResult.segments)
        : []

      // 保存转写结果到数据库
      await prisma.transcription.create({
        data: {
          meetingId: meeting.id,
          fullText: transcriptionResult.text,
          segments: richSegments as any,
          language: transcriptionResult.language,
          wordCount: transcriptionResult.text.length,
          model: 'fun-asr',
        },
      })

      // 更新Meeting状态
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          status: MeetingStatus.COMPLETED,
          progress: 100,
          duration: result.usage?.duration,
          errorMessage: null, // 清除任务ID
        },
      })

      console.log(`   💾 结果已保存`)
    } else {
      // 任务失败
      throw new Error(`千问任务失败，状态: ${status}`)
    }
  }
}

// 导出单例
let workerInstance: TranscriptionWorker | null = null

export function getTranscriptionWorker(): TranscriptionWorker {
  if (!workerInstance) {
    workerInstance = new TranscriptionWorker()
  }
  return workerInstance
}
