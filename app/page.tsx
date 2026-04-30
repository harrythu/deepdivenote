'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { VocabularySelector } from '@/components/VocabularySelector'
import { UserMenu } from '@/components/auth/UserMenu'
import { Plus, X, Copy, Check, User } from 'lucide-react'

// 富文本分段类型（与数据库 RichSegment 对应）
interface RichSegment {
  begin_time: number
  end_time: number
  speaker_id?: number
  channel_id?: number
  original_text: string
  corrected_text?: string
}

// 发言人名称映射
type SpeakerMap = Record<string, string>

/** 获取 segment 的展示文本（优先纠错后） */
function getDisplayText(seg: RichSegment): string {
  return seg.corrected_text ?? seg.original_text
}

/** 获取发言人展示名称 */
function getSpeakerName(speakerId: number | undefined, speakerMap: SpeakerMap): string | null {
  if (speakerId === undefined || speakerId === null) return null
  return speakerMap[String(speakerId)] ?? `发言人${speakerId}`
}

/** 毫秒 → mm:ss 或 hh:mm:ss */
function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const SPEAKER_COLORS = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
  'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
]

function getSpeakerColor(speakerId: string | number | undefined): string {
  if (speakerId === undefined || speakerId === null) return SPEAKER_COLORS[0]
  return SPEAKER_COLORS[Number(speakerId) % SPEAKER_COLORS.length]
}

/** 分段列表展示组件 */
function SegmentList({
  segments,
  speakerMap = {},
  showCorrected = false,
}: {
  segments: RichSegment[]
  speakerMap?: SpeakerMap
  showCorrected?: boolean
}) {
  return (
    <div className="space-y-2">
      {segments.map((seg, idx) => {
        const speakerName = getSpeakerName(seg.speaker_id, speakerMap)
        const text = showCorrected ? getDisplayText(seg) : seg.original_text
        return (
          <div key={idx} className="flex gap-3 items-start">
            <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500 font-mono mt-1 w-12 text-right">
              {formatTimestamp(seg.begin_time)}
            </span>
            {speakerName && (
              <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mt-0.5 ${getSpeakerColor(seg.speaker_id)}`}>
                <User className="w-3 h-3" />
                {speakerName}
              </span>
            )}
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed flex-1">
              {text}
            </p>
          </div>
        )
      })}
    </div>
  )
}

// 深海主题 Logo
function DeepDiveLogo({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <Image
      src="/logo-a.png"
      alt="DeepDive Logo"
      width={48}
      height={48}
      className={className}
      priority
    />
  )
}

// 气泡动画 - 使用固定位置避免水合错误
const BUBBLES_DATA = [
  { size: 18, left: 10, delay: 0, duration: 20 },
  { size: 14, left: 25, delay: 3, duration: 18 },
  { size: 22, left: 40, delay: 7, duration: 22 },
  { size: 12, left: 55, delay: 2, duration: 16 },
  { size: 16, left: 70, delay: 5, duration: 19 },
  { size: 20, left: 85, delay: 8, duration: 21 },
  { size: 15, left: 5, delay: 4, duration: 17 },
  { size: 24, left: 95, delay: 1, duration: 23 },
]

function Bubbles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {BUBBLES_DATA.map((bubble, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 opacity-10 animate-float"
          style={{
            width: `${bubble.size}px`,
            height: `${bubble.size}px`,
            left: `${bubble.left}%`,
            bottom: '-20px',
            animationDelay: `${bubble.delay}s`,
            animationDuration: `${bubble.duration}s`,
          }}
        />
      ))}
    </div>
  )
}

export default function Home() {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // 模式选择：audio=音频转写模式, text=文字稿模式
  const [mode, setMode] = useState<'audio' | 'text'>('audio')

  // 文字稿模式相关状态
  const [textContent, setTextContent] = useState('')
  const [textFile, setTextFile] = useState<File | null>(null)

  // 纠错相关状态
  const [vocabulary, setVocabulary] = useState('')
  const [selectedVocabulary, setSelectedVocabulary] = useState<string[]>([])
  const [showVocabularySelector, setShowVocabularySelector] = useState(false)
  const [correcting, setCorrecting] = useState(false)
  const [originalText, setOriginalText] = useState('')
  const [segments, setSegments] = useState<RichSegment[]>([]) // 富文本分段（含 original_text / corrected_text）
  const [correctedText, setCorrectedText] = useState('')      // 降级路径：无 segments 时的纯文本纠错结果
  const [corrections, setCorrections] = useState<any[]>([])
  const [meetingId, setMeetingId] = useState('')
  const [meetingTitle, setMeetingTitle] = useState('')
  const [meetingStatus, setMeetingStatus] = useState<string>('')
  const [loadingMeeting, setLoadingMeeting] = useState(false)
  const [transcribing, setTranscribing] = useState(false)

  // 发言人名称映射
  const [speakerMap, setSpeakerMap] = useState<SpeakerMap>({})
  // 发言人编辑面板是否展开
  const [showSpeakerEditor, setShowSpeakerEditor] = useState(false)
  // 编辑中的临时 speakerMap（未保存）
  const [editingSpeakerMap, setEditingSpeakerMap] = useState<SpeakerMap>({})
  const [savingSpeakers, setSavingSpeakers] = useState(false)

  // 纪要相关状态
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [summaryResult, setSummaryResult] = useState<{
    content: string
    keyPoints: string[]
    actionItems: any[]
    participants: string[]
    tags: string[]
  } | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState('interview')
  const [templateContent, setTemplateContent] = useState<Record<string, { name: string; content: string }>>({})
  const [userTemplates, setUserTemplates] = useState<{id: string; name: string; content: string}[]>([])
  const [showUserTemplatePicker, setShowUserTemplatePicker] = useState<{ show: boolean; x: number; y: number }>({ show: false, x: 0, y: 0 })

  // 模型选择相关状态
  const [availableModels, setAvailableModels] = useState<{id: string; name: string; category: string; description: string; maxTokens: number}[]>([])
  const [selectedModel, setSelectedModel] = useState('openai/gpt-5.4-mini')
  const [selectedCorrectionModel, setSelectedCorrectionModel] = useState('openai/gpt-5.4')
  const [summaryCopied, setSummaryCopied] = useState(false)

  // 获取当前选中模型的分类
  const getSelectedModelCategory = () => {
    const model = availableModels.find(m => `openai/${m.id}` === selectedModel || m.id === selectedModel)
    return model?.category || 'closed-source'
  }

  // 加载模板内容
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const res = await fetch('/api/templates')
        const data = await res.json()
        if (data.success) {
          setTemplateContent(data.data)
        }
      } catch (error) {
        console.error('加载模板失败:', error)
      }
    }
    loadTemplates()
  }, [])

  // 加载用户模板
  // 加载用户模板
  const loadUserTemplates = async () => {
    try {
      const res = await fetch('/api/user/templates')
      const data = await res.json()
      if (data.success) {
        setUserTemplates(data.data.map((t: any) => ({
          id: t.id,
          name: t.name,
          content: t.content
        })))
      }
    } catch (error) {
      console.error('加载用户模板失败:', error)
    }
  }

  useEffect(() => {
    loadUserTemplates()
  }, [])

  // 页面可见性变化时刷新用户模板（从其他标签页返回时）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadUserTemplates()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // 加载模型列表
  useEffect(() => {
    const loadModels = async () => {
      try {
        const res = await fetch('/api/models')
        const data = await res.json()
        if (data.success) {
          setAvailableModels(data.data.models)
          // 设置默认模型
          const defaultModel = data.data.models.find((m: any) => m.id === data.data.default)
          if (defaultModel) {
            setSelectedModel(defaultModel.id)
          }
        }
      } catch (error) {
        console.error('加载模型列表失败:', error)
      }
    }
    loadModels()
  }, [])

  // 模型变化
  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId)
  }

  // 复制纪要内容到剪贴板
  const copySummaryToClipboard = async () => {
    if (!summaryResult?.content) return
    try {
      await navigator.clipboard.writeText(summaryResult.content)
      setSummaryCopied(true)
      toast.success('已复制到剪贴板')
      setTimeout(() => setSummaryCopied(false), 2000)
    } catch (error) {
      toast.error('复制失败')
    }
  }

  // 同步滚动（挂载到分段列表容器 div 上）
  const originalRef = useRef<HTMLDivElement>(null)
  const correctedRef = useRef<HTMLDivElement>(null)
  const originalTextareaRef = useRef<HTMLTextAreaElement>(null)
  const correctedTextareaRef = useRef<HTMLTextAreaElement>(null)
  // 用 ref 追踪转写是否完成，避免 setInterval 闭包里读到 stale state
  const transcriptionDoneRef = useRef(false)

  /**
   * 将 API 返回的 segments 标准化为 RichSegment[]
   * 兼容旧的 QwenSegment 格式（有 text 字段但无 original_text）
   */
  const normalizeSegments = (rawSegs: any[]): RichSegment[] => {
    return rawSegs.map((seg) => {
      if (typeof seg.original_text === 'string') {
        return seg as RichSegment
      }
      return {
        begin_time: seg.begin_time ?? 0,
        end_time: seg.end_time ?? 0,
        speaker_id: seg.speaker_id !== undefined ? Number(seg.speaker_id) : undefined,
        channel_id: seg.channel_id,
        words: seg.words,
        original_text: seg.text ?? '',
        corrected_text: undefined,
      } as RichSegment
    })
  }

  /** 从 segments 中提取所有出现过的 speaker_id */
  const extractSpeakerIds = (segs: RichSegment[]): number[] => {
    const ids = new Set<number>()
    segs.forEach((seg) => {
      if (seg.speaker_id !== undefined && seg.speaker_id !== null) {
        ids.add(Number(seg.speaker_id))
      }
    })
    return Array.from(ids).sort((a, b) => a - b)
  }

  /** 保存发言人名称到数据库 */
  const saveSpeakerMap = async () => {
    if (!meetingId) return
    setSavingSpeakers(true)
    try {
      // 输入框为空时，回退为默认名称"发言人N"
      const finalMap: SpeakerMap = {}
      extractSpeakerIds(segments).forEach((id) => {
        const name = editingSpeakerMap[String(id)]?.trim()
        finalMap[String(id)] = name || `发言人${id}`
      })
      const res = await fetch(`/api/meetings/${meetingId}/speakers`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speakerMap: finalMap }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSpeakerMap(finalMap)
      setEditingSpeakerMap(finalMap)
      setShowSpeakerEditor(false)
      toast.success('发言人名称已保存')
    } catch (error) {
      toast.error('保存失败')
    } finally {
      setSavingSpeakers(false)
    }
  }

  useEffect(() => {
    if (!meetingId) return

    let isMounted = true
    transcriptionDoneRef.current = false

    const pollMeeting = async () => {
      try {
        // 触发服务端去千问 API 拉取最新转写结果
        fetch('/api/meetings/poll', { method: 'POST' }).catch(() => {})

        const res = await fetch(`/api/meetings/${meetingId}`)
        const data = await res.json()
        if (data.success && isMounted) {
          setMeetingStatus(data.data.status)
          setMeetingTitle(data.data.title)
          if (data.data.transcription) {
            setOriginalText(data.data.transcription.fullText)
            // segments：只在首次加载时从服务端拉取，不覆盖纠错后的 corrected_text
            setSegments(prev => {
              if (prev.length > 0) return prev
              const rawSegs = Array.isArray(data.data.transcription.segments)
                ? data.data.transcription.segments
                : []
              return normalizeSegments(rawSegs)
            })
            // speakerMap：只在本地无数据时从服务端加载，不覆盖用户正在编辑的内容
            setSpeakerMap(prev => {
              if (Object.keys(prev).length > 0) return prev
              return data.data.transcription.speakerMap ?? {}
            })
            setTranscribing(false)
            transcriptionDoneRef.current = true  // 标记转写完成，停止轮询
          } else if (data.data.status === 'COMPLETED') {
            setOriginalText('(转写完成，但未返回内容)')
            setSegments([])
            setTranscribing(false)
            transcriptionDoneRef.current = true
          }
        }
      } catch (error) {
        console.error('获取会议状态失败:', error)
      }
    }

    // 立即查询一次
    pollMeeting()

    // 轮询：转写完成后自动停止
    const interval = setInterval(() => {
      if (transcriptionDoneRef.current) {
        clearInterval(interval)
        return
      }
      pollMeeting()
    }, 3000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [meetingId])

  const handleScroll = (source: 'original' | 'corrected') => {
    // 支持 div（分段列表）和 textarea（纯文本降级）两种容器
    const sourceEl = source === 'original'
      ? (originalRef.current ?? originalTextareaRef.current)
      : (correctedRef.current ?? correctedTextareaRef.current)
    const targetEl = source === 'original'
      ? (correctedRef.current ?? correctedTextareaRef.current)
      : (originalRef.current ?? originalTextareaRef.current)
    if (sourceEl && targetEl) {
      // 按比例同步：两侧内容长度不同，按滚动比例对齐
      const ratio = sourceEl.scrollTop / (sourceEl.scrollHeight - sourceEl.clientHeight || 1)
      targetEl.scrollTop = ratio * (targetEl.scrollHeight - targetEl.clientHeight)
    }
  }

  // 拖拽配置
  const acceptedFormats = {
    'audio/mpeg': ['.mp3'],
    'audio/wav': ['.wav'],
    'audio/mp4': ['.m4a'],
    'audio/x-m4a': ['.m4a'],
    'audio/aac': ['.aac'],
    'audio/flac': ['.flac'],
    'audio/ogg': ['.ogg'],
  }
  const maxSize = 500 * 1024 * 1024

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      setSelectedFile(file)
      toast.success(`已选择: ${file.name}`)
    }
  }, [])

  // 重置所有状态以开始新的上传
  const resetForNewUpload = () => {
    setOriginalText('')
    setSegments([])
    setCorrectedText('')
    setCorrections([])
    setSummaryResult(null)
    setMeetingId('')
    setTranscribing(false)
    setSelectedFile(null)
    setSelectedVocabulary([])
    setSpeakerMap({})
    setEditingSpeakerMap({})
    setShowSpeakerEditor(false)
    toast.success('已准备开始新上传')
  }

  const onDropRejected = useCallback((fileRejections: any[]) => {
    const error = fileRejections[0]?.errors[0]
    if (error?.code === 'file-too-large') {
      toast.error('文件过大，最大支持 500MB')
    } else {
      toast.error('不支持的文件格式')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: acceptedFormats,
    maxSize,
    multiple: false,
    disabled: uploading || mode !== 'audio',
  })

  // 文字稿模式文件上传
  const textAcceptedFormats = {
    'text/plain': ['.txt'],
    'text/markdown': ['.md'],
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  }

  const onTextDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      setTextFile(file)

      // 使用 API 解析文件
      const formData = new FormData()
      formData.append('file', file)

      toast.promise(
        fetch('/api/parse-file', {
          method: 'POST',
          body: formData,
        }).then(async (res) => {
          const data = await res.json()
          if (!data.success) {
            throw new Error(data.error || '文件解析失败')
          }
          setTextContent(data.data.text)
        }),
        {
          loading: '正在解析文件...',
          success: `已加载: ${file.name}`,
          error: (err) => err.message || '文件解析失败',
        }
      )
    }
  }, [])

  const onTextDropRejected = useCallback((fileRejections: any[]) => {
    toast.error('不支持的文件格式，请上传 .txt, .md, .docx 或 .pdf 文件')
  }, [])

  const { getRootProps: getTextRootProps, getInputProps: getTextInputProps, isDragActive: isTextDragActive } = useDropzone({
    onDrop: onTextDrop,
    onDropRejected: onTextDropRejected,
    accept: textAcceptedFormats,
    multiple: false,
    disabled: mode !== 'text',
  })

  // 处理文字稿上传
  const handleTextUpload = async () => {
    const content = textContent.trim()
    if (!content) {
      toast.error('请输入或上传文字稿内容')
      return
    }

    setUploading(true)
    setProgress(0)
    setMeetingId('')
    setOriginalText('')
    setCorrectedText('')
    setCorrections([])
    setSummaryResult(null)

    try {
      const res = await fetch('/api/text-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '文字稿',
          content: content,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success('文字稿上传成功！')
      setMeetingId(data.data.meetingId)
      setOriginalText(content)
      setTranscribing(false)
      setTextContent('')
      setTextFile(null)
    } catch (error) {
      console.error('文字稿上传失败:', error)
      toast.error(error instanceof Error ? error.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  // 加载会议
  const loadMeeting = async () => {
    if (!meetingId.trim()) {
      toast.error('请输入会议ID')
      return
    }
    setLoadingMeeting(true)
    try {
      const res = await fetch(`/api/meetings/${meetingId}`)
      const data = await res.json()
      if (data.success) {
        setMeetingTitle(data.data.title)
        if (data.data.transcription) {
          setOriginalText(data.data.transcription.fullText)
          const rawSegs = Array.isArray(data.data.transcription.segments)
            ? data.data.transcription.segments
            : []
          setSegments(normalizeSegments(rawSegs))
          const sm = data.data.transcription.speakerMap ?? {}
          setSpeakerMap(sm)
          setEditingSpeakerMap(sm)
          setCorrectedText('')
          setCorrections([])
          setTranscribing(false)
          toast.success('加载成功')
        } else if (data.data.status === 'TRANSCRIBING' || data.data.status === 'PENDING' || data.data.status === 'UPLOADING') {
          setOriginalText('')
          setSegments([])
          setCorrectedText('')
          setTranscribing(true)
          toast.success('转写进行中...')
        } else {
          setOriginalText('')
          setSegments([])
          setCorrectedText('')
          setTranscribing(false)
          toast.error('该会议暂无转写记录')
        }
      } else {
        toast.error('会议不存在')
      }
    } catch {
      toast.error('加载失败')
    } finally {
      setLoadingMeeting(false)
    }
  }

  // 纠错处理
  const handleCorrection = async () => {
    console.log('【纠错】开始处理', { meetingId, originalTextLength: originalText.length, correcting })
    if (!originalText || !meetingId) {
      toast.error('请先加载会议')
      console.log('【纠错】校验失败: originalText或meetingId为空')
      return
    }
    setCorrecting(true)
    console.log('【纠错】发送请求...')
    try {
      const res = await fetch(`/api/meetings/${meetingId}/correction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            vocabulary: selectedVocabulary,
            model: selectedCorrectionModel,
            maxTokens: availableModels.find(m => m.id === selectedCorrectionModel)?.maxTokens || 128000,
          }),
      })
      console.log('【纠错】响应状态:', res.status)
      const data = await res.json()
      console.log('��纠错】响应数据:', data)
      if (!res.ok) throw new Error(data.error)

      // 主路径：API 返回了 correctedSegments（按 segment 纠错）
      if (data.data.correctedSegments && Array.isArray(data.data.correctedSegments)) {
        setSegments(data.data.correctedSegments as RichSegment[])
        setCorrectedText(data.data.correctedText || '')
      } else {
        // 降级路径：无 segments，使用纯文本
        setCorrectedText(data.data.correctedText || '')
      }
      setCorrections(data.data.corrections || [])
      toast.success('纠错完成')
    } catch (error) {
      console.error('【纠错】错误:', error)
      toast.error(error instanceof Error ? error.message : '纠错失败')
    } finally {
      setCorrecting(false)
    }
  }

  // 纪要生成处理
  const handleGenerateSummary = async () => {
    // 优先级：① segments 有 corrected_text → 拼接纠错后全文
    //         ② correctedText（降级路径纯文本纠错结果）
    //         ③ originalText（未纠错）
    const hasCorrectedSegments = segments.some(s => s.corrected_text !== undefined)
    const textToSummarize = hasCorrectedSegments
      ? segments.map(s => s.corrected_text ?? s.original_text).join('')
      : (correctedText || originalText)

    if (!textToSummarize) {
      toast.error('请先进行转写和纠错')
      return
    }

    setGeneratingSummary(true)
    console.log('【纪要】开始生成，使用模型:', selectedModel, '模板:', selectedTemplate)
    try {
      // 检查是否选择了用户模板（investor是系统模板，不是用户模板）
      const isUserTemplate = selectedTemplate !== 'interview' && selectedTemplate !== 'interview-less' && selectedTemplate !== 'investor'
      const customPrompt = isUserTemplate
        ? userTemplates.find(t => t.id === selectedTemplate)?.content
        : undefined

      const res = await fetch(`/api/meetings/${meetingId}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription: textToSummarize,
          template: isUserTemplate ? 'custom' : selectedTemplate,
          customPrompt,
          model: selectedModel,
          maxTokens: availableModels.find(m => m.id === selectedModel)?.maxTokens || 64000,
          speakerMap,  // 传入发言人名称映射
        }),
      })
      console.log('【纪要】响应状态:', res.status)
      const data = await res.json()
      console.log('【纪要】响应数据:', data)
      if (!res.ok) throw new Error(data.error)
      setSummaryResult(data.data)
      toast.success('纪要生成完成')
    } catch (error) {
      console.error('【纪要】错误:', error)
      toast.error(error instanceof Error ? error.message : '纪要生成失败')
    } finally {
      setGeneratingSummary(false)
    }
  }

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
    return `${(bytes / 1024).toFixed(2)} KB`
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 relative overflow-x-hidden">
        <Bubbles />

      {/* 顶部导航栏 */}
      <nav className="relative z-10 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          {/* 左侧 Logo */}
          <div className="flex items-center gap-3">
            <DeepDiveLogo className="w-10 h-10" />
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">DeepDive</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">录音转写专家</p>
            </div>
          </div>

          {/* 中间导航链接 */}
          <div className="flex items-center gap-10">
            <a
              href="/settings/vocabularies"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              常用词汇
            </a>
            <a
              href="/settings/templates"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              我的模板
            </a>
            <a
              href="/history"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              历史记录
            </a>
          </div>

          {/* 右侧用户菜单 */}
          <div className="flex items-center gap-3">
            <UserMenu />
            {(originalText || meetingId) && (
              <Button
                onClick={resetForNewUpload}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                开始新上传
              </Button>
            )}
            <span className="text-xs text-slate-400 hidden sm:inline">最大 500MB</span>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="relative z-10 py-16">
        <div className="container mx-auto px-6 max-w-6xl">
          {/* 标题 */}
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight">
              深入每一场会议
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              上传录音，自动转写，智能纠错
            </p>
          </div>

          {/* 上传区域 */}
          <div className="max-w-2xl mx-auto mb-16">
            {/* 模式选择器 */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-900 p-1">
                <button
                  onClick={() => { setMode('audio'); setTextContent(''); setTextFile(null); setSelectedFile(null); }}
                  className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                    mode === 'audio'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    </svg>
                    上传音频
                  </span>
                </button>
                <button
                  onClick={() => { setMode('text'); setSelectedFile(null); }}
                  className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                    mode === 'text'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    上传文字稿
                  </span>
                </button>
              </div>
            </div>

            {/* 音频模式上传 */}
            {mode === 'audio' && (
              <div
                {...getRootProps()}
                className={`
                  p-12 rounded-2xl border-2 border-dashed cursor-pointer
                  transition-all duration-300
                  ${isDragActive
                    ? 'border-slate-400 bg-slate-100 dark:bg-slate-900'
                    : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                  }
                  ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center">
                  <div className={`
                    w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center mb-4
                    transition-transform duration-300 ${isDragActive ? 'scale-110 rotate-6' : ''}
                  `}>
                    <svg className="w-8 h-8 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  {isDragActive ? (
                    <p className="text-lg font-medium text-slate-900 dark:text-white">松开以上传录音...</p>
                  ) : (
                    <>
                      <p className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                        拖拽录音文件到这里
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        或点击选择文件 · 支持 MP3, WAV, M4A, FLAC
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                        最大 500MB
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 文字稿模式上传 */}
            {mode === 'text' && (
              <div className="space-y-4">
                {/* 功能限制提示 */}
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50">
                  <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                    文字稿模式下，不支持区分发言人、多人会议总结功能，如需使用请上传音频。
                  </p>
                </div>
                {/* 文字稿拖拽上传 */}
                <div
                  {...getTextRootProps()}
                  className={`
                    p-8 rounded-2xl border-2 border-dashed cursor-pointer
                    transition-all duration-300 text-center
                    ${isTextDragActive
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                    }
                    ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <input {...getTextInputProps()} />
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    {isTextDragActive ? (
                      <p className="text-blue-600 font-medium">松开以上传文字稿...</p>
                    ) : (
                      <>
                        <p className="text-slate-900 dark:text-white font-medium mb-1">
                          支持 .txt, .md, .docx, .pdf 文件
                        </p>
                        <p className="text-sm text-slate-500">
                          或点击选择文件
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* 已选文件 */}
                {textFile && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">{textFile.name}</span>
                    <button onClick={() => { setTextFile(null); setTextContent(''); }} className="text-slate-400 hover:text-slate-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* 文字内容输入 */}
                <div className="relative">
                  <textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="或者直接在这里粘贴文字稿内容..."
                    className="w-full h-64 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <div className="absolute bottom-3 right-3 text-xs text-slate-400">
                    {textContent.length} 字符
                  </div>
                </div>

                {/* 上传按钮 */}
                <Button
                  onClick={handleTextUpload}
                  disabled={uploading || !textContent.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {uploading ? '上传中...' : '开始处理'}
                </Button>
              </div>
            )}

            {/* 已选文件 - 仅音频模式 */}
            {mode === 'audio' && selectedFile && (
              <Card className="mt-4 border-slate-200 dark:border-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                        <svg className="w-6 h-6 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white truncate max-w-[200px]">{selectedFile.name}</p>
                        <p className="text-sm text-slate-500">{formatFileSize(selectedFile.size)}</p>
                      </div>
                    </div>
                    {!uploading && (
                      <button onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {uploading && (
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600 dark:text-slate-400">上传中...</span>
                        <span className="font-medium text-slate-900 dark:text-white">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>
                  )}
                  {!uploading && selectedFile && (
                    <Button
                      onClick={() => {
                        if (!selectedFile) {
                          toast.error('请先选择文件')
                          return
                        }
                        setUploading(true)
                        setProgress(0)
                        const fileToUpload = selectedFile
                        const formData = new FormData()
                        formData.append('file', fileToUpload)
                        const xhr = new XMLHttpRequest()
                        xhr.upload.addEventListener('progress', (e) => {
                          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
                        })
                        xhr.addEventListener('load', () => {
                          if (xhr.status === 200) {
                            const response = JSON.parse(xhr.responseText)
                            if (response.success) {
                              // 上传成功，显示"转写中"状态，清空文件选择
                              toast.success('上传成功！转写进行中...')
                              setMeetingId(response.data.meetingId)
                              setOriginalText('')
                              setSegments([])
                              setCorrectedText('')
                              setCorrections([])
                              setSummaryResult(null)
                              setTranscribing(true)
                              setSelectedFile(null) // 清空文件选择
                            } else {
                              toast.error(response.error || '上传失败')
                              setSelectedFile(null)
                            }
                          } else {
                            toast.error(`上传失败: ${xhr.status}`)
                            setSelectedFile(null)
                          }
                          setUploading(false)
                        })
                        xhr.addEventListener('error', () => {
                          toast.error('网络错误')
                          setUploading(false)
                          setSelectedFile(null)
                        })
                        xhr.open('POST', '/api/upload')
                        xhr.send(formData)
                      }}
                      className="w-full mt-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100"
                    >
                      开始转写
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 转写中状态 - 仅音频模式 */}
            {mode === 'audio' && !selectedFile && transcribing && (
              <Card className="mt-4 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <div className="flex-1">
                      <p className="font-medium text-blue-900 dark:text-blue-100">转写中...</p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">千问AI正在处理您的音频文件</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 纠错对比区域 */}
          {(originalText || correctedText || transcribing) && (
            <div className="animate-fade-in">
              {/* 纠错参数 */}
              <Card className="mb-6 border-slate-200 dark:border-slate-800">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                        常用词汇
                      </label>
                      {selectedVocabulary.length > 0 ? (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-100 dark:bg-slate-800 min-h-[42px]">
                          <div className="flex flex-wrap gap-1 flex-1">
                            {selectedVocabulary.slice(0, 5).map((word, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                                {word}
                              </span>
                            ))}
                            {selectedVocabulary.length > 5 && (
                              <span className="text-xs text-slate-500">
                                +{selectedVocabulary.length - 5} 更多
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => setShowVocabularySelector(true)}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                            title="修改常用词汇"
                          >
                            <Plus className="w-4 h-4 text-slate-500" />
                          </button>
                          <button
                            onClick={() => setSelectedVocabulary([])}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                            title="清除常用词汇"
                          >
                            <X className="w-4 h-4 text-slate-500" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => setShowVocabularySelector(true)}
                          className="w-full justify-start text-left h-10"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          选择常用词汇模板
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        选择模型
                      </label>
                      <select
                        value={selectedCorrectionModel}
                        onChange={(e) => setSelectedCorrectionModel(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      >
                        <optgroup label="闭源模型">
                          {availableModels.filter(m => m.category === 'closed-source').map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="开源模型">
                          {availableModels.filter(m => m.category === 'open-source').map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.name}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={handleCorrection}
                        disabled={correcting || !originalText}
                        className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 whitespace-nowrap"
                      >
                        {correcting ? '纠错中...' : '开始纠错'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 双栏对比 */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* 原文 */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-slate-400"></span>
                      原始转写
                    </h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-blue-300 text-blue-600 text-xs">
                        fun-asr
                      </Badge>
                      {transcribing ? (
                        <Badge variant="outline" className="border-blue-300 text-blue-600 animate-pulse">
                          转写中...
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-slate-300 dark:border-slate-700">
                          {originalText.length} 字
                        </Badge>
                      )}
                      {/* 发言人设置入口 - 转写完成后显示 */}
                      {segments.length > 0 && extractSpeakerIds(segments).length > 0 && (
                        <button
                          onClick={() => {
                            setEditingSpeakerMap({ ...speakerMap })
                            setShowSpeakerEditor(true)
                          }}
                          className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium transition-all ${
                            Object.keys(speakerMap).length > 0
                              ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-300 dark:border-violet-600 hover:bg-violet-200 dark:hover:bg-violet-900/60'
                              : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/50 animate-pulse-subtle'
                          }`}
                        >
                          <User className="w-3 h-3" />
                          {Object.keys(speakerMap).length > 0
                            ? `已设置 ${Object.keys(speakerMap).length} 位发言人`
                            : '设置发言人名称'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                    {transcribing ? (
                      <div className="w-full h-80 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400 mx-auto mb-3"></div>
                          <p className="text-slate-500">千问AI正在转写中，请稍候...</p>
                          <p className="text-xs text-slate-400 mt-2">通常需要几分钟至几十分钟</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {segments.length > 0 ? (
                          <div
                            ref={originalRef}
                            onScroll={() => handleScroll('original')}
                            className="w-full min-h-80 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-dashed border-slate-300 dark:border-slate-700 overflow-y-auto max-h-80"
                          >
                            <SegmentList segments={segments} speakerMap={speakerMap} showCorrected={false} />
                          </div>
                        ) : (
                          <textarea
                            ref={originalTextareaRef}
                            onScroll={() => handleScroll('original')}
                            value={originalText}
                            readOnly
                            placeholder="加载会议后显示原始转写..."
                            className="w-full h-80 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-dashed border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-600 cursor-text"
                            title="此文本为只读模式，仅可复制"
                          />
                        )}
                        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          只读内容，无法编辑
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* 纠错后 */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                      纠错后文字
                    </h3>
                    <div className="flex items-center gap-2">
                      {/* 判断是否有纠错后内容 */}
                      {(() => {
                        const hasCorrected = segments.some(s => s.corrected_text !== undefined) || !!correctedText
                        return (
                          <Badge
                            variant="outline"
                            className={`border-slate-300 dark:border-slate-700 ${hasCorrected ? 'text-emerald-600 border-emerald-300' : ''}`}
                          >
                            {hasCorrected ? '已纠错' : '待纠错'}
                          </Badge>
                        )
                      })()}
                    </div>
                  </div>
                  <div className="relative">
                    {transcribing ? (
                      <div className="w-full h-80 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                        <p className="text-slate-500 text-sm">等待原始转写完成...</p>
                      </div>
                    ) : correcting ? (
                      <div className="w-full h-80 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400"></div>
                        <p className="text-slate-600 dark:text-slate-400 text-sm">纠错进行中，请耐心等待</p>
                      </div>
                    ) : segments.some(s => s.corrected_text !== undefined) ? (
                      /* 主路径：segments 有 corrected_text，展示纠错后分段 */
                      <>
                        <div
                          ref={correctedRef}
                          onScroll={() => handleScroll('corrected')}
                          className="w-full min-h-80 p-4 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 overflow-y-auto max-h-80"
                        >
                          <SegmentList segments={segments} speakerMap={speakerMap} showCorrected={true} />
                        </div>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          时间戳保留原始值，文字已纠错
                        </p>
                      </>
                    ) : correctedText ? (
                      /* 降级路径：无 segments，使用纯文本 */
                      <>
                        <textarea
                          ref={correctedTextareaRef}
                          onScroll={() => handleScroll('corrected')}
                          value={correctedText}
                          onChange={(e) => setCorrectedText(e.target.value)}
                          placeholder="纠错后显示在这里，可以手动编辑..."
                          className="w-full h-80 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-600 hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
                        />
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          可以手动编辑，生成纪要时将使用最新内容
                        </p>
                      </>
                    ) : segments.length > 0 ? (
                      /* 纠错前预览：展示原始分段 */
                      <div
                        ref={correctedRef}
                        onScroll={() => handleScroll('corrected')}
                        className="w-full min-h-80 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 overflow-y-auto max-h-80"
                      >
                        <p className="text-xs text-slate-400 mb-3">点击「开始纠错」后，纠错结果将在此处显示</p>
                        <SegmentList segments={segments} speakerMap={speakerMap} showCorrected={false} />
                      </div>
                    ) : (
                      <textarea
                        ref={correctedTextareaRef}
                        onScroll={() => handleScroll('corrected')}
                        value={correctedText}
                        onChange={(e) => setCorrectedText(e.target.value)}
                        placeholder="纠错后显示在这里，可以手动编辑..."
                        className="w-full h-80 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-600 hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* 纠错详情 */}
              {corrections.length > 0 && (
                <Card className="mt-6 border-slate-200 dark:border-slate-800">
                  <CardContent className="p-6">
                    <h4 className="text-slate-900 dark:text-white font-medium mb-4">
                      纠错详情（共 {corrections.length} 处）
                    </h4>
                    <div className="grid gap-3 max-h-60 overflow-y-auto">
                      {corrections.map((c, i) => (
                        <div key={i} className="flex items-start gap-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                          <span className="px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm line-through min-w-[80px] text-center">
                            {c.original}
                          </span>
                          <span className="text-slate-400">→</span>
                          <span className="px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-sm min-w-[80px] text-center">
                            {c.corrected}
                          </span>
                          <span className="text-slate-500 text-sm flex-1">{c.reason}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {correctedText && corrections.length === 0 && (
                <Card className="mt-6 border-slate-200 dark:border-slate-800">
                  <CardContent className="p-6 text-center">
                    <p className="text-slate-500">✨ 文字稿已经很完善，无需纠错！</p>
                  </CardContent>
                </Card>
              )}

              {/* 会议纪要生成 */}
              <Card className="mt-6 border-amber-200 dark:border-amber-800">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        生成会议纪要
                      </h3>
                      <Badge variant="outline" className="border-amber-300 text-amber-600">
                        基于纠错后文字稿
                      </Badge>
                    </div>
                    {/* 模型选择 */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-500">选择模型:</label>
                        <select
                          value={selectedModel}
                          onChange={(e) => handleModelChange(e.target.value)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                          <optgroup label="闭源模型">
                            {availableModels.filter(m => m.category === 'closed-source').map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.name}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="开源模型">
                            {availableModels.filter(m => m.category === 'open-source').map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.name}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 模板选择 */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        选择提示词模板
                      </label>
                      <a
                        href="/settings/templates"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        创作我的模板
                      </a>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {/* 系统模板 */}
                      <button
                        onClick={() => setSelectedTemplate('interview')}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          selectedTemplate === 'interview'
                            ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-transparent hover:bg-slate-200'
                        }`}
                      >
                        专家访谈-逐字稿
                      </button>
                      <button
                        onClick={() => setSelectedTemplate('interview-less')}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          selectedTemplate === 'interview-less'
                            ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-transparent hover:bg-slate-200'
                        }`}
                      >
                        专家访谈-精炼版
                      </button>
                      <button
                        onClick={() => setSelectedTemplate('investor')}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          selectedTemplate === 'investor'
                            ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-transparent hover:bg-slate-200'
                        }`}
                      >
                        创业公司访谈
                      </button>
                      {/* 用户模板（最多显示5个） */}
                      {userTemplates.slice(0, 5).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTemplate(t.id)}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            selectedTemplate === t.id
                              ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-300'
                              : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-transparent hover:bg-blue-100'
                          }`}
                        >
                          {t.name}
                        </button>
                      ))}
                      {/* 更多用户模板按钮 */}
                      {userTemplates.length > 5 && (
                        <button
                          onClick={() => setShowUserTemplatePicker({ show: true, x: 0, y: 0 })}
                          className="px-3 py-1.5 rounded-lg text-sm transition-colors bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-transparent hover:bg-slate-200"
                        >
                          + 更多 ({userTemplates.length - 5})
                        </button>
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerateSummary}
                    disabled={generatingSummary || (!correctedText && !originalText)}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {generatingSummary ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        纪要生成中...
                      </>
                    ) : (
                      '📋 生成纪要'
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* 纪要结果显示 */}
              {generatingSummary && (
                <Card className="mt-6 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                  <CardContent className="p-8">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600"></div>
                      <p className="text-amber-800 dark:text-amber-200 font-medium">生成纪要进行中，请耐心等待</p>
                      <p className="text-amber-600 dark:text-amber-400 text-sm">正在基于纠错后的文字稿生成会议纪要</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {summaryResult && (
                <Card className="mt-6 border-slate-200 dark:border-slate-800">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        会议纪要
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-amber-300 text-amber-600">
                          {summaryResult.content.length} 字
                        </Badge>
                        <Button
                          onClick={copySummaryToClipboard}
                          size="sm"
                          variant="outline"
                          className="border-amber-300 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                        >
                          {summaryCopied ? (
                            <>
                              <Check className="w-4 h-4 mr-1" />
                              已复制
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 mr-1" />
                              一键复制
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* 摘要 - Markdown 内容 */}
                    {summaryResult.content && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-slate-500 mb-2">纪要内容</h4>
                        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 markdown-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {summaryResult.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {/* 关键要点 */}
                    {summaryResult.keyPoints && summaryResult.keyPoints.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-slate-500 mb-2">关键要点</h4>
                        <ul className="space-y-2">
                          {summaryResult.keyPoints.map((point, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                              <span className="text-slate-700 dark:text-slate-300">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 待办事项 */}
                    {summaryResult.actionItems && summaryResult.actionItems.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-slate-500 mb-2">待办事项</h4>
                        <div className="space-y-2">
                          {summaryResult.actionItems.map((item: any, i: number) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                              <input type="checkbox" className="mt-1 rounded border-slate-300" />
                              <div className="flex-1">
                                <p className="text-slate-700 dark:text-slate-300">{item.description}</p>
                                <div className="flex gap-2 mt-1">
                                  {item.assignee && (
                                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600">
                                      {item.assignee}
                                    </span>
                                  )}
                                  {item.deadline && (
                                    <span className="text-xs px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/50 text-purple-600">
                                      {item.deadline}
                                    </span>
                                  )}
                                  {item.priority && (
                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                      item.priority === 'high' ? 'bg-red-100 dark:bg-red-900/50 text-red-600' :
                                      item.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600' :
                                      'bg-green-100 dark:bg-green-900/50 text-green-600'
                                    }`}>
                                      {item.priority}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 参与者和标签 */}
                    <div className="flex flex-wrap gap-4">
                      {summaryResult.participants && summaryResult.participants.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-slate-500 mb-2">参与者</h4>
                          <div className="flex flex-wrap gap-1">
                            {summaryResult.participants.map((p: string, i: number) => (
                              <span key={i} className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {summaryResult.tags && summaryResult.tags.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-slate-500 mb-2">标签</h4>
                          <div className="flex flex-wrap gap-1">
                            {summaryResult.tags.map((tag: string, i: number) => (
                              <span key={i} className="text-xs px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-600">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>

      {/* 页脚 */}
      <footer className="py-8 border-t border-slate-200/10 bg-slate-50 dark:bg-slate-950">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <DeepDiveLogo className="w-6 h-6" />
            <span className="text-slate-500 text-sm">DeepDive</span>
          </div>
          <p className="text-xs text-slate-400">
            录音转写专家 · AI 驱动的智能会议记录系统
          </p>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes float {
          0% { transform: translateY(0) scale(1); opacity: 0.1; }
          50% { transform: translateY(-50vh) scale(1.1); opacity: 0.15; }
          100% { transform: translateY(-100vh) scale(1); opacity: 0; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-float {
          animation: float 20s linear infinite;
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s ease-in-out infinite;
        }
        /* 嵌套列表样式 */
        .markdown-content ul {
          list-style-type: disc;
          padding-left: 1.5rem;
        }
        .markdown-content ul ul {
          list-style-type: circle;
          padding-left: 1.5rem;
        }
        .markdown-content ul ul ul {
          list-style-type: square;
          padding-left: 1.5rem;
        }
        .markdown-content li {
          margin: 0.25rem 0;
        }
        .markdown-content li > p {
          margin: 0.25rem 0;
        }
      `}</style>
      </div>
      <Toaster />

      {/* 发言人名称编辑弹窗 */}
      {showSpeakerEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowSpeakerEditor(false)}
          />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <User className="w-5 h-5" />
                设置发言人名称
              </h2>
              <button
                onClick={() => setShowSpeakerEditor(false)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                将自动识别的发言人编号替换为真实姓名，修改后原始稿和纠错稿均会更新。
              </p>
              {extractSpeakerIds(segments).map((id) => (
                <div key={id} className="flex items-center gap-3">
                  <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${getSpeakerColor(id)}`}>
                    <User className="w-3 h-3" />
                    发言人{id}
                  </span>
                  <span className="text-slate-400 text-sm">→</span>
                  <input
                    type="text"
                    value={editingSpeakerMap[String(id)] ?? ''}
                    onChange={(e) => {
                      const val = e.target.value
                      setEditingSpeakerMap((prev) => ({
                        ...prev,
                        [String(id)]: val,
                      }))
                    }}
                    placeholder={`发言人${id} 的真实姓名`}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <Button
                variant="outline"
                onClick={() => setShowSpeakerEditor(false)}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                onClick={saveSpeakerMap}
                disabled={savingSpeakers}
                className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900"
              >
                {savingSpeakers ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 词汇选择弹窗 */}
      <VocabularySelector
        isOpen={showVocabularySelector}
        onClose={() => setShowVocabularySelector(false)}
        onConfirm={(words) => setSelectedVocabulary(words)}
        initialSelected={selectedVocabulary}
      />

      {/* 用户模板选择弹窗 */}
      {showUserTemplatePicker.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowUserTemplatePicker({ show: false, x: 0, y: 0 })}
          />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                选择我的模板
              </h2>
              <button
                onClick={() => setShowUserTemplatePicker({ show: false, x: 0, y: 0 })}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 max-h-64 overflow-y-auto">
              {userTemplates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTemplate(t.id)
                    setShowUserTemplatePicker({ show: false, x: 0, y: 0 })
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-colors mb-2 ${
                    selectedTemplate === t.id
                      ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-slate-500 mt-1 truncate">{t.content.slice(0, 50)}...</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
