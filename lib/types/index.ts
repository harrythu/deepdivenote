// 从 Prisma 导出的类型
export type { Meeting, Transcription, Summary, MeetingStatus } from '@prisma/client'

// ========================================
// API 响应类型
// ========================================

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// ========================================
// 转写相关类型
// ========================================

// Whisper API 分段数据
export interface TranscriptionSegment {
  id: number
  seek: number
  start: number       // 开始时间（秒）
  end: number         // 结束时间（秒）
  text: string        // 文本内容
  tokens: number[]
  temperature: number
  avg_logprob: number
  compression_ratio: number
  no_speech_prob: number
}

// 转写服务接口
export interface ITranscriptionService {
  transcribe(audioFile: File | Buffer, options?: TranscriptionOptions): Promise<TranscriptionResult>
}

export interface TranscriptionOptions {
  language?: string       // 语言代码，如 'zh', 'en'
  prompt?: string        // 提示词，提高准确性
  temperature?: number   // 采样温度 0-1
  timestampGranularity?: 'word' | 'segment'
}

export interface TranscriptionResult {
  text: string                        // 完整文本
  segments?: TranscriptionSegment[]   // 分段数据
  language?: string                   // 检测到的语言
  duration?: number                   // 音频时长
  confidence?: number                 // 平均置信度
}

// ========================================
// 摘要生成相关类型
// ========================================

// 摘要服务接口
export interface ISummaryService {
  generateSummary(transcription: string, options?: SummaryOptions): Promise<SummaryResult>
}

export interface SummaryOptions {
  language?: 'zh' | 'en' | 'auto'    // 输出语言
  format?: 'markdown' | 'plain'      // 输出格式
  includeTimestamps?: boolean        // 是否包含时间戳
}

export interface SummaryResult {
  content: string                    // 完整纪要（Markdown格式）
  keyPoints: string[]                // 关键要点
  actionItems: ActionItem[]          // 待办事项
  participants?: string[]            // 参与者（如果识别到）
  tags?: string[]                    // 标签/关键词
  tokensUsed?: number               // 使用的 Token 数量
}

export interface ActionItem {
  description: string                // 待办事项描述
  assignee?: string                  // 负责人（如果识别到）
  deadline?: string                  // 截止日期（如果提到）
  priority?: 'high' | 'medium' | 'low'
}

// ========================================
// 文件上传相关类型
// ========================================

export interface UploadResult {
  meetingId: string
  fileName: string
  filePath: string
  fileSize: number
  duration?: number
}

// ========================================
// 进度推送相关类型
// ========================================

export type ProgressEventType =
  | 'upload_started'
  | 'upload_progress'
  | 'upload_completed'
  | 'transcription_started'
  | 'transcription_progress'
  | 'transcription_completed'
  | 'summary_started'
  | 'summary_progress'
  | 'summary_completed'
  | 'error'
  | 'completed'

export interface ProgressEvent {
  type: ProgressEventType
  progress: number        // 0-100
  message: string
  timestamp: number
  data?: any             // 额外数据
}

// ========================================
// 任务队列相关类型
// ========================================

export interface TranscriptionJobData {
  meetingId: string
  audioPath: string
  language?: string
}

export interface SummaryJobData {
  meetingId: string
  transcriptionId: string
  fullText: string
}
