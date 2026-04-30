import {
  ITranscriptionService,
  TranscriptionOptions,
  QwenSegment,
} from '@/lib/types'

/**
 * Fun-ASR parseTranscriptionResult 的返回类型
 * 使用 QwenSegment（原始 ASR 格式），由 transcription-worker 转为 RichSegment 存储
 */
export interface QwenTranscriptionResult {
  text: string
  segments: QwenSegment[]
  language: string
  duration?: number
}

/**
 * Fun-ASR 任务状态
 */
export enum QwenTaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Fun-ASR 任务响应（与 paraformer/qwen-asr 共用同一套 DashScope 任务接口）
 */
export interface QwenTaskResponse {
  output: {
    task_id?: string
    task_status?: string
    submit_time?: string
    scheduled_time?: string
    end_time?: string
    // Fun-ASR 结果通过 results 数组返回（每个文件一条）
    results?: Array<{
      file_url?: string
      transcription_url?: string
      subtask_status?: string
      code?: string
      message?: string
    }>
    task_metrics?: {
      TOTAL: number
      SUCCEEDED: number
      FAILED: number
    }
  }
  usage?: {
    duration?: number
  }
  request_id: string
}

/**
 * Fun-ASR 录音文件识别服务
 *
 * 官方文档：
 * - 提交任务: POST https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription
 * - 查询任务: POST https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}
 *
 * 与 qwen3-asr-flash-filetrans 的主要差异：
 * - model 名称：fun-asr
 * - input 字段：file_urls（数组），而非 file_url（字符串）
 * - 查询接口：POST（而非 GET）
 * - 结果路径：output.results[0].transcription_url
 * - 明确支持 diarization_enabled（单声道音频）
 */
export class QwenASRService implements ITranscriptionService {
  private apiKey: string
  private submitUrl: string
  private queryUrlBase: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.QWEN_API_KEY || ''
    this.submitUrl = 'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription'
    this.queryUrlBase = 'https://dashscope.aliyuncs.com/api/v1/tasks/'

    if (!this.apiKey) {
      throw new Error('QWEN_API_KEY 未配置')
    }
  }

  /**
   * 提交 Fun-ASR 转写任务
   * @param audioUrl 公网可访问的音频文件 URL
   * @param options 转写选项
   * @returns 任务 ID
   */
  async submitTask(
    audioUrl: string,
    options?: TranscriptionOptions
  ): Promise<string> {
    try {
      console.log('提交 Fun-ASR 任务，音频URL:', audioUrl)

      const payload = {
        model: 'fun-asr',
        input: {
          // Fun-ASR 使用 file_urls 数组（与 qwen3-asr 的 file_url 字符串不同）
          file_urls: [audioUrl],
        },
        parameters: {
          channel_id: [0],
          diarization_enabled: true, // 启用说话人分离（仅单声道有效）
          ...(options?.language ? { language_hints: [options.language] } : {}),
        },
      }

      console.log('请求payload:', JSON.stringify(payload, null, 2))

      const response = await fetch(this.submitUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable',
        },
        body: JSON.stringify(payload),
      })

      const responseText = await response.text()
      console.log('Fun-ASR API 响应状态:', response.status)
      console.log('Fun-ASR API 响应内容:', responseText)

      if (!response.ok) {
        throw new Error(`Fun-ASR API 请求失败: ${response.status} - ${responseText}`)
      }

      const data: QwenTaskResponse = JSON.parse(responseText)

      if (!data.output?.task_id) {
        console.error('Fun-ASR API 返回数据:', data)
        throw new Error('Fun-ASR API 返回的任务ID为空')
      }

      console.log('Fun-ASR 任务提交成功，task_id:', data.output.task_id)
      return data.output.task_id
    } catch (error) {
      console.error('提交 Fun-ASR 转写任务失败:', error)
      throw new Error(`提交转写任务失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 查询任务状态
   * 注意：Fun-ASR 查询接口使用 POST 方法（与 qwen3-asr 的 GET 不同）
   * @param taskId 任务 ID
   * @returns 任务状态和结果
   */
  async getTaskStatus(taskId: string): Promise<QwenTaskResponse> {
    try {
      const queryUrl = `${this.queryUrlBase}${taskId}`
      console.log('查询 Fun-ASR 任务状态，URL:', queryUrl)

      // Fun-ASR 查询接口使用 POST（官方文档明确说明）
      const response = await fetch(queryUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      })

      const responseText = await response.text()
      console.log('查询响应状态:', response.status)
      console.log('查询响应内容:', responseText)

      if (!response.ok) {
        throw new Error(`查询任务状态失败: ${response.status} - ${responseText}`)
      }

      const data: QwenTaskResponse = JSON.parse(responseText)
      return data
    } catch (error) {
      console.error('查询 Fun-ASR 任务状态失败:', error)
      throw new Error(`查询任务状态失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 轮询等待任务完成
   */
  async pollTaskCompletion(
    taskId: string,
    maxAttempts: number = 360,
    intervalMs: number = 2000
  ): Promise<QwenTaskResponse> {
    let attempts = 0
    console.log(`开始轮询 Fun-ASR 任务 ${taskId}，最大尝试次数: ${maxAttempts}`)

    while (attempts < maxAttempts) {
      const result = await this.getTaskStatus(taskId)
      const status = result.output.task_status?.toUpperCase()

      console.log(`轮询第 ${attempts + 1} 次，状态: ${status}`)

      if (status === 'SUCCEEDED') {
        console.log('Fun-ASR 任务成功完成')
        return result
      }

      if (status === 'FAILED' || status === 'UNKNOWN') {
        console.error('Fun-ASR 任务失败:', result)
        throw new Error(`转写任务失败，状态: ${status}`)
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs))
      attempts++
    }

    throw new Error(`转写任务超时，已轮询 ${maxAttempts} 次`)
  }

  /**
   * 实现 ITranscriptionService 接口（兼容性方法，不直接使用）
   */
  async transcribe(
    audioFile: File | Buffer,
    options?: TranscriptionOptions
  ): Promise<never> {
    throw new Error(
      'Fun-ASR 不支持直接上传文件，请使用 submitTask 方法并传入公网 URL'
    )
  }

  /**
   * 从 URL 下载转写结果 JSON
   */
  async downloadTranscriptionResult(url: string): Promise<any> {
    try {
      console.log('下载 Fun-ASR 转写结果:', url)
      const response = await fetch(url)

      if (!response.ok) {
        const text = await response.text()
        console.error(`下载失败 HTTP ${response.status}:`, text.substring(0, 500))
        throw new Error(`下载转写结果失败: HTTP ${response.status}`)
      }

      const text = await response.text()
      const contentType = response.headers.get('content-type')
      console.log('下载响应类型:', contentType, '内容前500字符:', text.substring(0, 500))

      // 尝试解析为 JSON（OSS 有时不返回正确 content-type）
      try {
        return JSON.parse(text)
      } catch {
        // JSON 解析失败，可能是 XML 错误响应
        console.error('JSON 解析失败，原始内容:', text.substring(0, 1000))
        throw new Error(`转写结果不是有效 JSON，内容: ${text.substring(0, 200)}`)
      }
    } catch (error) {
      console.error('下载转写结果失败:', error)
      throw error
    }
  }

  /**
   * 解析 Fun-ASR 转写结果
   *
   * Fun-ASR 结果结构：
   * output.results[].transcription_url → 下载后得到：
   * {
   *   transcripts: [{
   *     channel_id: 0,
   *     text: "完整文本",
   *     sentences: [{
   *       begin_time: 100,   // 毫秒
   *       end_time: 3820,    // 毫秒
   *       text: "句子文本",
   *       sentence_id: 1,
   *       speaker_id: 0,     // 仅 diarization_enabled=true 时出现
   *       words: [...]
   *     }]
   *   }]
   * }
   */
  async parseTranscriptionResult(response: QwenTaskResponse): Promise<QwenTranscriptionResult> {
    let transcriptionText = ''
    let segments: QwenSegment[] = []

    // Fun-ASR 结果通过 output.results 数组返回
    const results = response.output.results
    if (results && results.length > 0) {
      // 找到第一个成功的子任务
      const successResult = results.find(r => r.subtask_status === 'SUCCEEDED')
      if (!successResult?.transcription_url) {
        // 检查是否有失败信息
        const failedResult = results.find(r => r.subtask_status === 'FAILED')
        if (failedResult) {
          throw new Error(`子任务失败: ${failedResult.code} - ${failedResult.message}`)
        }
        throw new Error('未找到有效的转写结果 URL')
      }

      console.log('Fun-ASR 转写结果URL:', successResult.transcription_url)
      const resultData = await this.downloadTranscriptionResult(successResult.transcription_url)
      console.log('Fun-ASR 转写结果数据类型:', typeof resultData, '顶层字段:', Object.keys(resultData || {}))
      console.log('Fun-ASR 转写结果数据（前500字符）:', JSON.stringify(resultData).substring(0, 500))

      if (resultData && typeof resultData === 'object') {
        // Fun-ASR 标准格式：transcripts 数组
        if (Array.isArray(resultData.transcripts) && resultData.transcripts.length > 0) {
          const transcript = resultData.transcripts[0]
          transcriptionText = transcript.text || ''

          if (Array.isArray(transcript.sentences)) {
            segments = transcript.sentences.map((s: any) => ({
              text: s.text || '',
              begin_time: s.begin_time ?? 0,
              end_time: s.end_time ?? 0,
              speaker_id: s.speaker_id !== undefined ? s.speaker_id : undefined,
              words: s.words,
              channel_id: transcript.channel_id,
            }))
          }
        }
        // 降级：直接有 text 字段
        else if (resultData.text) {
          transcriptionText = resultData.text
          if (Array.isArray(resultData.sentences)) {
            segments = resultData.sentences.map((s: any) => ({
              text: s.text || '',
              begin_time: s.begin_time ?? 0,
              end_time: s.end_time ?? 0,
              speaker_id: s.speaker_id !== undefined ? s.speaker_id : undefined,
              words: s.words,
            }))
          }
        }
      }
    }

    if (!transcriptionText) {
      console.error('无法解析 Fun-ASR 转写结果，原始响应:', JSON.stringify(response).substring(0, 500))
      throw new Error('转写结果为空，无法解析')
    }

    return {
      text: transcriptionText,
      segments,
      language: 'auto',
      duration: response.usage?.duration,
    }
  }
}

/**
 * 创建 Fun-ASR 服务实例
 */
export function createQwenASRService(): QwenASRService {
  return new QwenASRService()
}
