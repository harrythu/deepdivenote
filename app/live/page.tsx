'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { UserMenu } from '@/components/auth/UserMenu'
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  Send,
  FileText,
  Pin,
  Mic,
  Bot,
  Upload,
  Loader2,
} from 'lucide-react'
import { io, Socket } from 'socket.io-client'

const CONFERENCE_WS_URL =
  process.env.NEXT_PUBLIC_CONFERENCE_WS_URL || 'http://localhost:3456'

interface TranscriptLine {
  text: string
  time: string
}

interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'error'
  text: string
}

type RecordingState = 'idle' | 'recording' | 'paused'

export default function LiveConferencePage() {
  const { isLoading, isAuthenticated } = useAuth()
  const router = useRouter()

  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [status, setStatus] = useState('Connecting...')
  const [transcript, setTranscript] = useState<TranscriptLine[]>([])
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [query, setQuery] = useState('')
  const [sessionEnded, setSessionEnded] = useState(false)
  const [exporting, setExporting] = useState(false)

  const transcriptRef = useRef<HTMLDivElement>(null)
  const agentRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auth guard — disabled for testing
  // useEffect(() => {
  //   if (!isLoading && !isAuthenticated) {
  //     router.push('/login')
  //   }
  // }, [isLoading, isAuthenticated, router])

  // Socket.IO connection
  useEffect(() => {

    const s = io(CONFERENCE_WS_URL, {
      transports: ['websocket', 'polling'],
    })

    s.on('connect', () => {
      setConnected(true)
      setStatus('Connected')
    })

    s.on('disconnect', () => {
      setConnected(false)
      setStatus('Disconnected')
    })

    s.on('state', ({ recordingState: rs }: { recordingState: RecordingState }) => {
      setRecordingState(rs)
    })

    s.on('status', ({ text }: { text: string }) => {
      setStatus(text)
    })

    s.on('transcript', ({ text, time }: TranscriptLine) => {
      setTranscript(prev => [...prev, { text, time }])
    })

    s.on('agent', ({ role, text }: AgentMessage) => {
      setMessages(prev => [...prev, { role, text }])
    })

    setSocket(s)

    return () => {
      s.disconnect()
    }
  }, [isAuthenticated])

  // Auto-scroll
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcript])

  useEffect(() => {
    if (agentRef.current) {
      agentRef.current.scrollTop = agentRef.current.scrollHeight
    }
  }, [messages])

  const sendQuery = useCallback(() => {
    const text = query.trim()
    if (!text || !socket) return
    setQuery('')
    socket.emit('query', text)
  }, [query, socket])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      sendQuery()
    }
  }

  const handleEnd = useCallback(() => {
    socket?.emit('end')
    setSessionEnded(true)
  }, [socket])

  const exportToDeepDive = useCallback(async () => {
    if (transcript.length === 0) {
      toast.error('No transcript to export')
      return
    }

    setExporting(true)
    try {
      const fullText = transcript
        .map(line => `[${line.time}] ${line.text}`)
        .join('\n')

      const title = `Live Session ${new Date().toLocaleDateString('zh-CN')} ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`

      const res = await fetch('/api/text-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content: fullText }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Exported to DeepDive!')
        router.push(`/meetings/${data.data.meetingId}`)
      } else {
        toast.error(data.error || 'Export failed')
      }
    } catch (err) {
      toast.error('Export failed — is the DeepDive backend running?')
    } finally {
      setExporting(false)
    }
  }, [transcript, router])

  const dismissExport = useCallback(() => {
    setSessionEnded(false)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  // if (!isAuthenticated) return null  // disabled for testing

  const roleLabel: Record<string, string> = {
    user: 'You',
    assistant: 'Agent',
    system: 'System',
    error: 'Error',
  }

  const roleColor: Record<string, string> = {
    user: 'text-blue-700 dark:text-blue-400',
    assistant: 'text-emerald-700 dark:text-emerald-400',
    system: 'text-amber-700 dark:text-amber-400',
    error: 'text-red-600 dark:text-red-400',
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <Toaster />

      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>

        <div className="flex items-center gap-2">
          <Mic className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            Live Conference
          </h1>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 ml-4">
          <Button
            size="sm"
            variant={recordingState === 'idle' || recordingState === 'paused' ? 'default' : 'secondary'}
            disabled={recordingState === 'recording' || !connected}
            onClick={() => socket?.emit('start')}
          >
            <Play className="w-4 h-4 mr-1" />
            {recordingState === 'paused' ? 'Resume' : 'Start'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={recordingState !== 'recording' || !connected}
            onClick={() => socket?.emit('pause')}
          >
            <Pause className="w-4 h-4 mr-1" />
            Pause
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={recordingState === 'idle' || !connected}
            onClick={handleEnd}
          >
            <Square className="w-4 h-4 mr-1" />
            End
          </Button>
        </div>

        {/* Status */}
        <Badge
          variant={
            connected
              ? recordingState === 'recording'
                ? 'default'
                : 'secondary'
              : 'destructive'
          }
          className="ml-2"
        >
          {connected
            ? recordingState === 'recording'
              ? 'Recording'
              : recordingState === 'paused'
                ? 'Paused'
                : 'Ready'
            : 'Disconnected'}
        </Badge>
        <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px] hidden md:block">
          {status}
        </span>

        {/* Quick actions */}
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            disabled={!connected}
            onClick={() => socket?.emit('summary')}
            title="Generate Summary"
          >
            <FileText className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!connected}
            onClick={() => socket?.emit('note')}
            title="Pin Last Transcript"
          >
            <Pin className="w-4 h-4" />
          </Button>
          <div className="ml-2 border-l border-slate-200 dark:border-slate-700 pl-3">
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Two-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* Transcript panel */}
        <div className="flex-1 flex flex-col border-r border-slate-200 dark:border-slate-700 min-w-0">
          <div className="px-4 py-2 bg-white/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              <Mic className="w-4 h-4 text-cyan-600" />
              Live Transcript
              {transcript.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {transcript.length}
                </Badge>
              )}
            </div>
          </div>
          <div
            ref={transcriptRef}
            className="flex-1 overflow-y-auto px-4 py-2 space-y-1"
          >
            {transcript.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic mt-4 text-center">
                Waiting for audio...
              </p>
            ) : (
              transcript.map((line, i) => (
                <div key={i} className="text-sm leading-relaxed">
                  <span className="text-xs text-slate-400 dark:text-slate-500 mr-2 font-mono">
                    [{line.time}]
                  </span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {line.text}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Agent panel */}
        <div className="w-[40%] flex flex-col min-w-0">
          <div className="px-4 py-2 bg-white/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              <Bot className="w-4 h-4 text-emerald-600" />
              AI Assistant
              {messages.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {messages.length}
                </Badge>
              )}
            </div>
          </div>
          <div
            ref={agentRef}
            className="flex-1 overflow-y-auto px-4 py-2 space-y-3"
          >
            {messages.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic mt-4 text-center">
                Press Start and ask a question...
              </p>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`text-sm leading-relaxed ${
                    msg.role === 'error' ? 'bg-red-50 dark:bg-red-900/20 rounded p-2' : ''
                  }`}
                >
                  <span className={`font-semibold mr-1.5 ${roleColor[msg.role] || ''}`}>
                    {roleLabel[msg.role] || msg.role}:
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {msg.text}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Export banner — shown after session ends */}
      {sessionEnded && transcript.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-t border-emerald-200 dark:border-emerald-800 flex-shrink-0">
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Session ended — {transcript.length} transcript segments captured
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
              Export to DeepDive for cloud-grade summarization, correction, and permanent storage.
            </p>
          </div>
          <Button
            size="sm"
            disabled={exporting}
            onClick={exportToDeepDive}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-1" />
            )}
            {exporting ? 'Exporting...' : 'Export to DeepDive'}
          </Button>
          <Button variant="ghost" size="sm" onClick={dismissExport}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
        <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
          Ask:
        </label>
        <Input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a question or /command..."
          disabled={!connected}
          className="flex-1"
          autoComplete="off"
        />
        <Button
          size="sm"
          disabled={!connected || !query.trim()}
          onClick={sendQuery}
        >
          <Send className="w-4 h-4 mr-1" />
          Send
        </Button>
      </div>
    </div>
  )
}
