'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Clock, FileAudio, FileText, ArrowLeft, ExternalLink } from 'lucide-react'

interface HistoryRecord {
  id: string
  meetingId: string
  uploadDate: string
  uploadTime: string
  fileName: string
  summaryDate: string | null
  summaryTime: string | null
  summaryContent: string | null
  createdAt: string
  meeting: {
    id: string
    title: string
    audioFormat: string | null
    audioSize: number | null
  }
}

export default function HistoryPage() {
  const { isLoading, isAuthenticated } = useAuth()
  const router = useRouter()
  const [histories, setHistories] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(true)

  // 加载历史记录
  const loadHistories = async () => {
    try {
      const res = await fetch('/api/user/history')
      const data = await res.json()
      if (data.success) {
        setHistories(data.data)
      } else {
        toast.error(data.error || '获取历史记录失败')
      }
    } catch (error) {
      console.error('加载历史记录失败:', error)
      toast.error('加载历史记录失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
      return
    }
    if (isAuthenticated) {
      loadHistories()
    }
  }, [isLoading, isAuthenticated, router])

  // 格式化日期时间
  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '未生成'
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(dateStr))
  }

  // 格式化文件大小
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A'
    const kb = bytes / 1024
    const mb = kb / 1024
    if (mb >= 1) return `${mb.toFixed(2)} MB`
    return `${kb.toFixed(2)} KB`
  }

  // 获取文件图标
  const getFileIcon = (format: string | null) => {
    if (format && ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'].includes(format.toLowerCase())) {
      return <FileAudio className="w-4 h-4" />
    }
    return <FileText className="w-4 h-4" />
  }

  if (isLoading || loading) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        {/* 头部 */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首页
            </Button>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            历史记录
          </h1>
          <p className="text-slate-500 mt-2">
            查看您所有生成的会议纪要
          </p>
        </div>

        {/* 历史记录列表 */}
        <div className="max-w-4xl mx-auto space-y-4">
          {histories.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Clock className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
                  暂无历史记录
                </h3>
                <p className="text-slate-500 mb-4">
                  您还没有生成过任何会议纪要
                </p>
                <Button onClick={() => router.push('/')}>
                  开始一个新纪要
                </Button>
              </CardContent>
            </Card>
          ) : (
            histories.map((history) => (
              <Card key={history.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        {getFileIcon(history.meeting.audioFormat)}
                        <span className="font-medium text-slate-900 dark:text-white">
                          {history.fileName}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {history.meeting.audioFormat?.toUpperCase() || 'TXT'}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(`/meetings/${history.meetingId}`, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      查看详情
                    </Button>
                  </div>
                  {/* 时间信息 */}
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">上传日期：</span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {formatDateTime(history.uploadDate).split(' ')[0]}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">上传时间：</span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {formatDateTime(history.uploadTime).split(' ')[1]}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">文件大小：</span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {formatFileSize(history.meeting.audioSize)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">纪要生成：</span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {history.summaryDate ? formatDateTime(history.summaryDate).split(' ')[0] : '未生成'}
                      </span>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}