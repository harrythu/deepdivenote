import {
  ITranscriptionService,
  TranscriptionOptions,
  TranscriptionResult,
} from '@/lib/types'

/**
 * 千问ASR任务状态
 */
export enum QwenTaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  UNKNOWN = 'UNKNOWN',
}

/**
 * 千问ASR任务响应
 */
export interface QwenTaskResponse {
  output: {
    task_id?: string
    task_status?: string
    submit_time?: string
    scheduled_time?: string
    end_time?: string
    url?: string // 转写结果URL（旧格式）
    result?: {
      transcription_url?: string // 转写结果JSON文件URL
    }
    results?: Array<{
      transcription_url?: string
      subtask_status?: string
      transcription?: string
    }>
  }
  usage?: {
    duration?: number
    seconds?: number // 实际处理秒数
  }
  request_id: string
}

/**
 * 千问3-ASR-Flash-Filetrans 服务
 * 支持最长12小时录音的异步转写
 * 要求输入为公网可访问的音频文件URL
 *
 * 官方API文档参考：
 * - 提交任务: POST https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription
 * - 查询任务: GET https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}
 */
export class QwenASRService implements ITranscriptionService {
  private apiKey: string
  private submitUrl: string
  private queryUrlBase: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.QWEN_API_KEY || ''
    // 正确的API端点
    this.submitUrl = 'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription'
    this.queryUrlBase = 'https://dashscope.aliyuncs.com/api/v1/tasks/'

    if (!this.apiKey) {
      throw new Error('QWEN_API_KEY 未配置')
    }
  }

  /**
   * 提交转写任务
   * @param audioUrl 公网可访问的音频文件URL
   * @param options 转写选项
   * @returns 任务ID
   */
  async submitTask(
    audioUrl: string,
    options?: TranscriptionOptions
  ): Promise<string> {
    try {
      console.log('提交千问ASR任务，音频URL:', audioUrl)

      const payload = {
        model: 'qwen3-asr-flash-filetrans',
        input: {
          file_url: audioUrl, // 注意：是 file_url 不是 file_urls
        },
        parameters: {
          channel_id: [0],
          language: options?.language,
          enable_itn: false,
        },
      }

      console.log('请求payload:', JSON.stringify(payload, null, 2))

      const response = await fetch(this.submitUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable', // 重要：启用异步模式
        },
        body: JSON.stringify(payload),
      })

      const responseText = await response.text()
      console.log('千问API响应状态:', response.status)
      console.log('千问API响应内容:', responseText)

      if (!response.ok) {
        throw new Error(`千问API请求失败: ${response.status} - ${responseText}`)
      }

      const data: QwenTaskResponse = JSON.parse(responseText)

      if (!data.output?.task_id) {
        console.error('千问API返回数据:', data)
        throw new Error('千问API返回的任务ID为空')
      }

      console.log('千问任务提交成功，task_id:', data.output.task_id)
      return data.output.task_id
    } catch (error) {
      console.error('提交千问转写任务失败:', error)
      throw new Error(`提交转写任务失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 查询任务状态
   * @param taskId 任务ID
   * @returns 任务状态和结果
   */
  async getTaskStatus(taskId: string): Promise<QwenTaskResponse> {
    try {
      const queryUrl = `${this.queryUrlBase}${taskId}`
      console.log('查询任务状态，URL:', queryUrl)

      const response = await fetch(queryUrl, {
        method: 'GET',
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
      console.error('查询千问任务状态失败:', error)
      throw new Error(`查询任务状态失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 轮询等待任务完成
   * @param taskId 任务ID
   * @param maxAttempts 最大轮询次数（默认360次，约12小时）
   * @param intervalMs 轮询间隔（毫秒，默认2秒，与官方示例一致）
   * @returns 转写结果
   */
  async pollTaskCompletion(
    taskId: string,
    maxAttempts: number = 360, // 12小时音频，保守估计需要2-3小时处理
    intervalMs: number = 2000 // 每2秒查询一次（官方示例）
  ): Promise<QwenTaskResponse> {
    let attempts = 0

    console.log(`开始轮询任务 ${taskId}，最大尝试次数: ${maxAttempts}`)

    while (attempts < maxAttempts) {
      const result = await this.getTaskStatus(taskId)
      const status = result.output.task_status?.toUpperCase()

      console.log(`轮询第 ${attempts + 1} 次，状态: ${status}`)

      if (status === 'SUCCEEDED') {
        console.log('任务成功完成')
        return result
      }

      if (status === 'FAILED' || status === 'UNKNOWN') {
        console.error('任务失败或状态未知:', result)
        throw new Error(`转写任务失败，状态: ${status}`)
      }

      // 等待后重试
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
      attempts++
    }

    throw new Error(`转写任务超时，已轮询 ${maxAttempts} 次`)
  }

  /**
   * 实现 ITranscriptionService 接口（兼容性方法）
   * 注意：此方法不适用于千问ASR，因为它需要URL而不是File对象
   * 实际使用时应该使用 submitTask 方法
   */
  async transcribe(
    audioFile: File | Buffer,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    throw new Error(
      '千问ASR不支持直接上传文件，请使用 submitTask 方法并传入公网URL'
    )
  }

  /**
   * 从URL下载转写结果
   * @param url 转写结果URL
   * @returns 转写文本
   */
  async downloadTranscriptionResult(url: string): Promise<any> {
    try {
      console.log('下载转写结果:', url)
      const response = await fetch(url)

      if (!response.ok) {
        // 获取响应内容以便调试
        const text = await response.text()
        console.error(`下载失败 HTTP ${response.status}:`, text.substring(0, 500))
        throw new Error(`下载转写结果失败: HTTP ${response.status}`)
      }

      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        return await response.json()
      } else {
        const text = await response.text()
        console.log('响应类型:', contentType, '内容:', text.substring(0, 200))
        return { text }
      }
    } catch (error) {
      console.error('下载转写结果失败:', error)
      throw error
    }
  }

  /**
   * 从千问响应解析转写结果
   * @param response 千问任务响应
   * @returns 标准化的转写结果
   */
  async parseTranscriptionResult(response: QwenTaskResponse): Promise<TranscriptionResult> {
    let transcriptionText = ''
    let segments: any[] = []

    // 千问返回的是转写结果URL
    if (response.output.result?.transcription_url) {
      const url = response.output.result.transcription_url
      console.log('转写结果URL:', url)

      // 下载转写结果JSON
      const resultData = await this.downloadTranscriptionResult(url)
      console.log('转写结果数据:', JSON.stringify(resultData))

      // 解析转写文本和分段信息 - 检查多种可能的格式
      if (resultData && typeof resultData === 'object') {
        // 格式1: transcripts 数组
        if (resultData.transcripts && Array.isArray(resultData.transcripts) && resultData.transcripts.length > 0) {
          const transcript = resultData.transcripts[0]
          transcriptionText = transcript.text || ''
          segments = transcript.sentences || []
        }
        // 格式2: 直接有 text 字段
        else if (resultData.text) {
          transcriptionText = resultData.text
        }
        // 格式3: sentences 数组（每个句子有自己的text）
        else if (resultData.sentences && Array.isArray(resultData.sentences)) {
          transcriptionText = resultData.sentences.map((s: any) => s.text || '').join('')
          segments = resultData.sentences
        }
        // 格式4: 遍历所有key找text
        else {
          const keys = Object.keys(resultData)
          for (const key of keys) {
            if (typeof resultData[key] === 'object' && resultData[key]?.text) {
              transcriptionText = resultData[key].text
              if (resultData[key].sentences) {
                segments = resultData[key].sentences
              }
              break
            }
          }
        }
      }
    } else if (response.output.url) {
      // 旧版API可能直接返回url字段
      console.log('转写结果URL (旧格式):', response.output.url)
      const resultData = await this.downloadTranscriptionResult(response.output.url)
      transcriptionText = resultData.text || JSON.stringify(resultData)
    } else if (response.output.results && response.output.results.length > 0) {
      // 某些情况下可能直接返回结果
      const result = response.output.results[0]
      transcriptionText = result.transcription || ''
    }

    if (!transcriptionText) {
      console.error('无法解析转写结果，原始响应:', JSON.stringify(response))
      throw new Error('转写结果为空，无法解析')
    }

    return {
      text: transcriptionText,
      segments,
      language: 'auto', // 千问会自动检测语言
      duration: response.usage?.duration,
    }
  }
}

/**
 * 创建千问ASR服务实例
 */
export function createQwenASRService(): QwenASRService {
  return new QwenASRService()
}
