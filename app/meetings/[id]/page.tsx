'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Copy, Check, ArrowLeft, User } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useRouter } from 'next/navigation'

interface QwenSegment {
  text: string
  begin_time: number   // 毫秒
  end_time: number     // 毫秒
  speaker_id?: string | number
  words?: Array<{ text: string; begin_time: number; end_time: number }>
  channel_id?: number
}

interface MeetingData {
  id: string
  title: string
  status: string
  progress: number
  audioFormat: string | null
  audioSize: number | null
  duration: number | null
  errorMessage: string | null
  createdAt: string
  transcription: {
    id: string
    fullText: string
    segments: QwenSegment[]
  } | null
  summary: {
    id: string
    content: string
  } | null
}

export default function MeetingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [meeting, setMeeting] = useState<MeetingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [meetingId, setMeetingId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('已复制到剪贴板')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('复制失败')
    }
  }

  useEffect(() => {
    params.then(({ id }) => setMeetingId(id))
  }, [params])

  const fetchMeeting = useCallback(async () => {
    if (!meetingId) return
    try {
      const res = await fetch(`/api/meetings/${meetingId}`)
      if (res.status === 404) {
        setNotFound(true)
        return
      }
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setMeeting(data.data)
    } catch (error) {
      console.error('获取会议失败:', error)
    } finally {
      setLoading(false)
    }
  }, [meetingId])

  useEffect(() => {
    if (meetingId) {
      fetchMeeting()
    }
  }, [meetingId, fetchMeeting])

  // 轮询：转写中状态每3秒刷新一次
  useEffect(() => {
    if (!meetingId || !meeting) return

    if (meeting.status === 'TRANSCRIBING' || meeting.status === 'PENDING' || meeting.status === 'UPLOADING') {
      const interval = setInterval(async () => {
        try {
          await fetch('/api/meetings/poll', { method: 'POST' })
        } catch (e) {
          console.error('轮询失败:', e)
        }
        fetchMeeting()
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [meetingId, meeting, fetchMeeting])

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: any }> = {
      PENDING: { label: '等待中', variant: 'secondary' },
      UPLOADING: { label: '上传中', variant: 'secondary' },
      TRANSCRIBING: { label: '转写中', variant: 'default' },
      SUMMARIZING: { label: '生成纪要中', variant: 'default' },
      COMPLETED: { label: '已完成', variant: 'default' },
      FAILED: { label: '失败', variant: 'destructive' },
    }
    const config = statusMap[status] || { label: status, variant: 'secondary' }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A'
    const kb = bytes / 1024
    const mb = kb / 1024
    const gb = mb / 1024

    if (gb >= 1) return `${gb.toFixed(2)} GB`
    if (mb >= 1) return `${mb.toFixed(2)} MB`
    return `${kb.toFixed(2)} KB`
  }

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(dateStr))
  }

  /**
   * 将毫秒转换为 mm:ss 或 hh:mm:ss 格式
   */
  const formatTimestamp = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  /**
   * 根据 speaker_id 生成固定颜色
   */
  const getSpeakerColor = (speakerId: string | number | undefined): string => {
    const colors = [
      'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
      'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
      'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
      'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
      'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
      'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
    ]
    if (speakerId === undefined || speakerId === null) return colors[0]
    const idx = Number(speakerId) % colors.length
    return colors[idx]
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-300">加载中...</p>
          </div>
        </div>
      </div>
    )
  }

  if (notFound || !meeting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
              会议未找到
            </h1>
            <a href="/" className="text-blue-600 hover:text-blue-700">
              返回首页
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* 返回按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回首页
          </Button>

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              {meeting.title}
            </h1>
            <div className="flex items-center gap-3">
              {getStatusBadge(meeting.status)}
              <span className="text-sm text-slate-500">
                创建于 {formatDate(meeting.createdAt)}
              </span>
            </div>
          </div>

          {/* 基本信息 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-slate-500">文件格式</dt>
                  <dd className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                    {meeting.audioFormat?.toUpperCase() || 'N/A'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">文件大小</dt>
                  <dd className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                    {formatFileSize(meeting.audioSize)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">音频时长</dt>
                  <dd className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                    {meeting.duration
                      ? `${Math.floor(meeting.duration / 60)} 分钟`
                      : '处理中...'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">处理进度</dt>
                  <dd className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                    {meeting.progress}%
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* 处理状态 - 转写中 */}
          {meeting.status === 'TRANSCRIBING' && (
            <Card className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      转写进行中...
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      千问AI正在处理您的音频文件，这可能需要几分钟到几十分钟
                    </p>
                  </div>
                </div>
                <Progress value={meeting.progress} className="h-2" />
              </CardContent>
            </Card>
          )}

          {/* 错误信息 */}
          {meeting.status === 'FAILED' && meeting.errorMessage && (
            <Card className="mb-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <CardContent className="p-6">
                <p className="font-medium text-red-900 dark:text-red-100 mb-2">
                  处理失败
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  {meeting.errorMessage}
                </p>
              </CardContent>
            </Card>
          )}

          {/* 会议纪要生成中 */}
          {meeting.status === 'SUMMARIZING' && (
            <Card className="mb-6 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600"></div>
                  <div>
                    <p className="font-medium text-amber-900 dark:text-amber-100">
                      生成纪要进行中，请耐心等待
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      正在生成会议纪要，请稍候
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 转写文字稿 */}
          {meeting.transcription && (
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    转写文字稿
                    <Badge variant="outline" className="border-slate-300 dark:border-slate-700 text-xs">
                      {meeting.transcription.fullText.length} 字
                    </Badge>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyText(meeting.transcription!.fullText)}
                  >
                    {copied ? (
                      <Check className="w-4 h-4 mr-1 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 mr-1" />
                    )}
                    {copied ? '已复制' : '复制'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* 有 segments 时按说话人+时间戳展示 */}
                {meeting.transcription.segments && meeting.transcription.segments.length > 0 ? (
                  <div className="space-y-3">
                    {meeting.transcription.segments.map((seg, idx) => {
                      const hasSpeaker = seg.speaker_id !== undefined && seg.speaker_id !== null
                      const speakerLabel = hasSpeaker ? `发言人 ${seg.speaker_id}` : null
                      const colorClass = getSpeakerColor(seg.speaker_id)
                      return (
                        <div key={idx} className="flex gap-3 items-start">
                          {/* 时间戳 */}
                          <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500 font-mono mt-1 w-14 text-right">
                            {formatTimestamp(seg.begin_time)}
                          </span>
                          {/* 说话人标签：仅在有 speaker_id 时显示 */}
                          {hasSpeaker && (
                            <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mt-0.5 ${colorClass}`}>
                              <User className="w-3 h-3" />
                              {speakerLabel}
                            </span>
                          )}
                          {/* 文本内容 */}
                          <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed flex-1">
                            {seg.text}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  /* 无 segments 时降级为纯文本展示 */
                  <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {meeting.transcription.fullText}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* 会议纪要 */}
          {meeting.summary && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    会议纪要
                    <Badge variant="outline" className="border-amber-300 text-amber-600 text-xs">
                      gpt-5.4-mini
                    </Badge>
                    <Badge variant="outline" className="border-slate-300 dark:border-slate-700 text-xs">
                      {meeting.summary.content.length} 字
                    </Badge>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyText(meeting.summary!.content)}
                  >
                    {copied ? (
                      <Check className="w-4 h-4 mr-1 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 mr-1" />
                    )}
                    {copied ? '已复制' : '复制'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose dark:prose-invert max-w-none markdown-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({children}) => <p className="break-words overflow-wrap-anywhere">{children}</p>,
                      li: ({children}) => <li className="break-words overflow-wrap-anywhere">{children}</li>,
                      td: ({children}) => <td className="break-words overflow-wrap-anywhere">{children}</td>,
                    }}
                  >
                    {meeting.summary.content}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}