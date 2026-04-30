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

// Whisper API 分段数据（旧格式，保留兼容）
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

// 通义 ASR 词级时间戳
export interface QwenWord {
  text: string
  begin_time: number  // 毫秒
  end_time: number    // 毫秒
}

// 通义 ASR 句子级分段（含说话人）- 原始 ASR 输出格式，用于 transcription-worker
export interface QwenSegment {
  text: string
  begin_time: number  // 毫秒
  end_time: number    // 毫秒
  speaker_id?: string | number  // 说话人 ID（启用 diarization 后返回）
  words?: QwenWord[]  // 词级时间戳（可选）
  channel_id?: number // 声道 ID
}

/**
 * 富文本分段 - 数据库存储格式（segments 字段）
 * 包含原始文本和纠错后文本两个版本，时间戳和说话人永远不变
 */
export interface RichSegment {
  // ASR 原始元数据（只读，永不修改）
  begin_time: number        // 毫秒
  end_time: number          // 毫秒
  speaker_id?: number       // 说话人数字 ID，如 0、1、2
  channel_id?: number
  words?: QwenWord[]

  // 文本双版本
  original_text: string     // ASR 原始转写，只读
  corrected_text?: string   // 纠错后文本，undefined 表示未纠错
}

/**
 * 发言人名称映射
 * key 为 speaker_id 的字符串形式，value 为用户设置的真实名称
 * 例如: { "0": "张三", "1": "李四" }
 */
export type SpeakerMap = Record<string, string>

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
  segments?: RichSegment[]            // 富文本分段（含时间戳、说话人、双版本文本）
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
