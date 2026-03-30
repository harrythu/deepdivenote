import OpenAI, { Uploadable } from 'openai'
import {
  ITranscriptionService,
  TranscriptionOptions,
  TranscriptionResult
} from '@/lib/types'

/**
 * Whisper API 转写服务
 * 使用 OpenAI Whisper API 进行音频转文字
 */
export class WhisperAPIService implements ITranscriptionService {
  private client: OpenAI

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    })
  }

  async transcribe(
    audioFile: File | Buffer,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    try {
      // 将 Buffer 或 File 转换为 OpenAI SDK 需要的格式
      let file: Uploadable
      if (audioFile instanceof Buffer) {
        file = new File([audioFile.buffer as ArrayBuffer], 'audio.mp3', { type: 'audio/mpeg' }) as Uploadable
      } else {
        file = audioFile as Uploadable
      }

      // 调用 Whisper API
      const response = await this.client.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        language: options?.language,
        prompt: options?.prompt,
        temperature: options?.temperature,
        response_format: options?.timestampGranularity ? 'verbose_json' : 'json',
        timestamp_granularities: options?.timestampGranularity
          ? [options.timestampGranularity]
          : undefined,
      })

      // 处理响应
      if (typeof response === 'string') {
        return {
          text: response,
        }
      }

      const resp = response as any
      return {
        text: response.text,
        segments: resp.segments,
        language: resp.language,
        duration: resp.duration,
      }
    } catch (error) {
      console.error('Whisper API 转写失败:', error)
      throw new Error(`转写失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }
}

/**
 * 本地 Whisper 模型服务 (未来实现)
 * 用于后期切换到自部署模型
 */
export class WhisperLocalService implements ITranscriptionService {
  async transcribe(
    audioFile: File | Buffer,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    // TODO: 实现本地 Whisper 模型调用
    throw new Error('本地 Whisper 服务尚未实现')
  }
}

/**
 * 转写服务工厂
 * 根据配置返回对应的服务实例
 */
export function createTranscriptionService(): ITranscriptionService {
  const serviceType = process.env.TRANSCRIPTION_SERVICE || 'whisper-api'

  switch (serviceType) {
    case 'whisper-api':
      return new WhisperAPIService()
    case 'whisper-local':
      return new WhisperLocalService()
    default:
      throw new Error(`未知的转写服务类型: ${serviceType}`)
  }
}
