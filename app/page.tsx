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
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

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

  // 纠错相关状态
  const [topic, setTopic] = useState('')
  const [vocabulary, setVocabulary] = useState('')
  const [correcting, setCorrecting] = useState(false)
  const [originalText, setOriginalText] = useState('')
  const [correctedText, setCorrectedText] = useState('')
  const [corrections, setCorrections] = useState<any[]>([])
  const [meetingId, setMeetingId] = useState('')
  const [meetingTitle, setMeetingTitle] = useState('')
  const [meetingStatus, setMeetingStatus] = useState<string>('')
  const [loadingMeeting, setLoadingMeeting] = useState(false)
  const [transcribing, setTranscribing] = useState(false)

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
  const [customPrompt, setCustomPrompt] = useState('')
  const [showTemplatePreview, setShowTemplatePreview] = useState(false)
  const [templateContent, setTemplateContent] = useState<Record<string, { name: string; content: string }>>({})
  const [templates, setTemplates] = useState<{id: string; name: string}[]>([
    { id: 'interview', name: '访谈纪要模板' },
    { id: 'meeting', name: '会议纪要模板' },
    { id: 'custom', name: '自定义模板' },
  ])

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

  // 同步滚动
  const originalRef = useRef<HTMLTextAreaElement>(null)
  const correctedRef = useRef<HTMLTextAreaElement>(null)

  // 轮询获取会议状态和转写结果
  useEffect(() => {
    if (!meetingId) return

    let isMounted = true

    const pollMeeting = async () => {
      try {
        const res = await fetch(`/api/meetings/${meetingId}`)
        const data = await res.json()
        if (data.success && isMounted) {
          setMeetingStatus(data.data.status)
          setMeetingTitle(data.data.title)
          if (data.data.transcription) {
            setOriginalText(data.data.transcription.fullText)
            setTranscribing(false)
          } else if (data.data.status === 'COMPLETED') {
            // 转写完成但没有内容
            setOriginalText('(转写完成，但未返回内容)')
            setTranscribing(false)
          }
        }
      } catch (error) {
        console.error('获取会议状态失败:', error)
      }
    }

    // 立即查询一次
    pollMeeting()

    // 轮询直到转写完成
    const interval = setInterval(pollMeeting, 3000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [meetingId])

  const handleScroll = (source: 'original' | 'corrected') => {
    const sourceEl = source === 'original' ? originalRef.current : correctedRef.current
    const targetEl = source === 'original' ? correctedRef.current : originalRef.current
    if (sourceEl && targetEl) {
      targetEl.scrollTop = sourceEl.scrollTop
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
  const maxSize = 3 * 1024 * 1024 * 1024

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
    setCorrectedText('')
    setCorrections([])
    setSummaryResult(null)
    setMeetingId('')
    setTranscribing(false)
    setSelectedFile(null)
    toast.success('已准备开始新上传')
  }

  const onDropRejected = useCallback((fileRejections: any[]) => {
    const error = fileRejections[0]?.errors[0]
    if (error?.code === 'file-too-large') {
      toast.error('文件过大，最大支持3GB')
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
    disabled: uploading,
  })

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
          setCorrectedText('')
          setCorrections([])
          setTranscribing(false)
          toast.success('加载成功')
        } else if (data.data.status === 'TRANSCRIBING' || data.data.status === 'PENDING' || data.data.status === 'UPLOADING') {
          setOriginalText('')
          setCorrectedText('')
          setTranscribing(true)
          toast.success('转写进行中...')
        } else {
          setOriginalText('')
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
      const vocabList = vocabulary.split(',').map(v => v.trim()).filter(v => v.length > 0)
      const res = await fetch(`/api/meetings/${meetingId}/correction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, vocabulary: vocabList }),
      })
      console.log('【纠错】响应状态:', res.status)
      const data = await res.json()
      console.log('【纠错】响应数据:', data)
      if (!res.ok) throw new Error(data.error)
      setCorrectedText(data.data.correctedText)
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
    // 使用纠错后的文字稿，如果没有则使用原文
    const textToSummarize = correctedText || originalText
    if (!textToSummarize) {
      toast.error('请先进行转写和纠错')
      return
    }

    setGeneratingSummary(true)
    console.log('【纪要】开始生成，使用模板:', selectedTemplate)
    try {
      const res = await fetch(`/api/meetings/${meetingId}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription: textToSummarize,
          template: selectedTemplate,
          customPrompt: selectedTemplate === 'custom' ? customPrompt : undefined
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

      {/* 导航栏 */}
      <nav className="relative z-10 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DeepDiveLogo className="w-10 h-10" />
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">DeepDive</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">录音转写专家</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
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
            <span className="text-xs text-slate-400">支持最长12小时录音</span>
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
                      最大 3GB · 约12小时录音
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* 已选文件 */}
            {selectedFile && (
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

            {/* 转写中状态 - 当没有选中文件但正在转写时显示 */}
            {!selectedFile && transcribing && (
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
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                        会议主题（可选）
                      </label>
                      <Input
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="如：产品需求评审"
                        className="bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                        常用词汇（逗号分隔）
                      </label>
                      <Input
                        value={vocabulary}
                        onChange={(e) => setVocabulary(e.target.value)}
                        placeholder="如：需求评审、UI设计"
                        className="bg-white dark:bg-slate-900"
                      />
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
                        qwen3-asr-flash-filetrans
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
                      <textarea
                        ref={originalRef}
                        onScroll={() => handleScroll('original')}
                        value={originalText}
                        onChange={(e) => setOriginalText(e.target.value)}
                        placeholder="加载会议后显示原始转写..."
                        className="w-full h-80 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400"
                      />
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
                      <Badge variant="outline" className="border-purple-300 text-purple-600 text-xs">
                        gpt-5.4-mini
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`border-slate-300 dark:border-slate-700 ${correctedText ? 'text-emerald-600 border-emerald-300' : ''}`}
                      >
                        {correctedText ? `${correctedText.length} 字` : '待纠错'}
                      </Badge>
                    </div>
                  </div>
                  <div className="relative">
                    {transcribing ? (
                      <div className="w-full h-80 p-4 rounded-xl bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 flex items-center justify-center">
                        <p className="text-slate-500 text-sm">等待原始转写完成...</p>
                      </div>
                    ) : (
                      <textarea
                        ref={correctedRef}
                        onScroll={() => handleScroll('corrected')}
                        value={correctedText}
                        onChange={(e) => setCorrectedText(e.target.value)}
                        placeholder="纠错后显示在这里..."
                        className="w-full h-80 p-4 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900 text-slate-700 dark:text-slate-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
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
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      生成会议纪要
                    </h3>
                    <Badge variant="outline" className="border-amber-300 text-amber-600">
                      gpt-5.4-mini
                    </Badge>
                    <Badge variant="outline" className="border-amber-300 text-amber-600">
                      基于纠错后文字稿
                    </Badge>
                  </div>

                  {/* 模板选择 */}
                  <div className="mb-4">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                      选择提示词模板
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {templates.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTemplate(t.id)}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            selectedTemplate === t.id
                              ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-transparent hover:bg-slate-200'
                          }`}
                        >
                          {t.name}
                        </button>
                      ))}
                      <button
                        onClick={() => setShowTemplatePreview(!showTemplatePreview)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                          showTemplatePreview
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-200'
                        }`}
                      >
                        {showTemplatePreview ? '收起模板' : '查看模板内容'}
                      </button>
                    </div>

                    {/* 模板内容预览 */}
                    {showTemplatePreview && selectedTemplate !== 'custom' && templateContent[selectedTemplate] && (
                      <div className="mt-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-500">
                            {templateContent[selectedTemplate].name} - 提示词内容
                          </span>
                          <span className="text-xs text-slate-400">
                            {templateContent[selectedTemplate].content.length} 字
                          </span>
                        </div>
                        <pre className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
                          {templateContent[selectedTemplate].content}
                        </pre>
                      </div>
                    )}

                    {showTemplatePreview && selectedTemplate === 'custom' && (
                      <div className="mt-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-500">
                            自定义模板
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          使用下方文本框输入自定义提示词，使用 {"{{transcription}}"} 占位转写内容。
                        </p>
                      </div>
                    )}

                    {/* 自定义模板输入 */}
                    {selectedTemplate === 'custom' && (
                      <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="输入自定义提示词模板，使用 {{transcription}} 占位转写内容..."
                        className="w-full h-32 p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    )}
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
                      '📋 生成会议纪要'
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* 纪要结果显示 */}
              {summaryResult && (
                <Card className="mt-6 border-slate-200 dark:border-slate-800">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        会议纪要
                      </h3>
                      <Badge variant="outline" className="border-amber-300 text-amber-600">
                        {summaryResult.content.length} 字
                      </Badge>
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
      `}</style>
      </div>
      <Toaster />
    </>
  )
}
