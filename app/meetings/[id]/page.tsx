'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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

  // 纠错相关状态
  const [topic, setTopic] = useState('')
  const [vocabulary, setVocabulary] = useState('')
  const [correcting, setCorrecting] = useState(false)
  const [correctedText, setCorrectedText] = useState<string | null>(null)
  const [corrections, setCorrections] = useState<any[]>([])
  const [showCorrectionPanel, setShowCorrectionPanel] = useState(false)
  const [meetingId, setMeetingId] = useState<string | null>(null)

  // 获取 meetingId
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
      console.log('开始轮询，状态:', meeting.status)
      const interval = setInterval(async () => {
        console.log('轮询触发...')
        // 先调用轮询API获取最新状态
        try {
          await fetch('/api/meetings/poll', { method: 'POST' })
          console.log('轮询API调用成功')
        } catch (e) {
          console.error('轮询失败:', e)
        }
        // 然后刷新会议数据
        fetchMeeting()
        console.log('刷新会议数据完成')
      }, 3000)
      return () => {
        console.log('停止轮询')
        clearInterval(interval)
      }
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

  const handleCorrection = async () => {
    if (!meeting?.transcription) return

    setCorrecting(true)
    setShowCorrectionPanel(true)

    try {
      const vocabList = vocabulary
        .split(',')
        .map(v => v.trim())
        .filter(v => v.length > 0)

      const res = await fetch(`/api/meetings/${meeting.id}/correction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, vocabulary: vocabList }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '纠错失败')

      setCorrectedText(data.data.correctedText)
      setCorrections(data.data.corrections || [])
      toast.success('纠错完成')
    } catch (error) {
      console.error('纠错失败:', error)
      toast.error(error instanceof Error ? error.message : '纠错失败')
    } finally {
      setCorrecting(false)
    }
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
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
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

          {/* 转写结果 */}
          {meeting.transcription && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  转写结果
                  <Badge variant="outline" className="border-blue-300 text-blue-600 text-xs">
                    qwen3-asr-flash-filetrans
                  </Badge>
                  <Badge variant="outline" className="border-slate-300 dark:border-slate-700 text-xs">
                    {(correctedText || meeting.transcription.fullText).length} 字
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap text-sm break-words overflow-wrap-anywhere">
                    {correctedText || meeting.transcription.fullText}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 纠错功能 */}
          {meeting.transcription && (
            <Card className="mb-6 border-purple-200 dark:border-purple-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>文字稿纠错</span>
                  <Badge variant="outline" className="border-purple-300 text-purple-600 text-xs">
                    gpt-5.4-mini
                  </Badge>
                  {correctedText && (
                    <Badge variant="default" className="bg-purple-600">已完成</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 纠错输入 */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                      会议主题（可选）
                    </label>
                    <Input
                      placeholder="如：产品需求评审会议"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      disabled={correcting}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                      常用词汇列表（可选，逗号分隔）
                    </label>
                    <Input
                      placeholder="如：需求评审、UI设计、技术方案"
                      value={vocabulary}
                      onChange={(e) => setVocabulary(e.target.value)}
                      disabled={correcting}
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleCorrection}
                    disabled={correcting}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {correcting ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        纠错中...
                      </>
                    ) : (
                      '开始纠错'
                    )}
                  </Button>
                  {correctedText && (
                    <Button
                      variant="outline"
                      onClick={() => setShowCorrectionPanel(!showCorrectionPanel)}
                    >
                      {showCorrectionPanel ? '隐藏' : '查看'}纠错详情
                    </Button>
                  )}
                </div>

                {/* 纠错详情 */}
                {showCorrectionPanel && corrections.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="text-sm font-medium mb-3">纠错详情（共 {corrections.length} 处）</h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {corrections.map((c, i) => (
                        <div key={i} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-sm">
                          <div className="flex items-start gap-2">
                            <span className="text-red-500 line-through min-w-[80px]">{c.original}</span>
                            <span className="text-slate-400">→</span>
                            <span className="text-green-600 dark:text-green-400">{c.corrected}</span>
                          </div>
                          <p className="text-slate-500 mt-1 text-xs">{c.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {showCorrectionPanel && corrections.length === 0 && correctedText && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-slate-500">没有发现需要纠错的地方，文字稿已经很完善了！</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 会议纪要 */}
          {meeting.summary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  会议纪要
                  <Badge variant="outline" className="border-amber-300 text-amber-600 text-xs">
                    gpt-5.4-mini
                  </Badge>
                  <Badge variant="outline" className="border-slate-300 dark:border-slate-700 text-xs">
                    {meeting.summary.content.length} 字
                  </Badge>
                </CardTitle>
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

          {/* 操作按钮 */}
          <div className="mt-8 flex gap-4">
            <a
              href="/upload"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              上传新文件
            </a>
            <a
              href="/"
              className="px-6 py-3 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
            >
              返回首页
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
