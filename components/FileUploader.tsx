'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface FileUploaderProps {
  onUploadSuccess?: (meetingId: string) => void
  onUploadError?: (error: string) => void
}

export function FileUploader({ onUploadSuccess, onUploadError }: FileUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // 支持的音频格式
  const acceptedFormats = {
    'audio/mpeg': ['.mp3'],
    'audio/wav': ['.wav'],
    'audio/mp4': ['.m4a'],
    'audio/x-m4a': ['.m4a'],
    'audio/aac': ['.aac'],
    'audio/flac': ['.flac'],
    'audio/ogg': ['.ogg'],
  }

  // 最大文件大小：500MB
  const maxSize = 500 * 1024 * 1024 // 500MB

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      setSelectedFile(file)
      toast.success(`已选择文件: ${file.name}`)
    }
  }, [])

  const onDropRejected = useCallback((fileRejections: any[]) => {
    if (fileRejections.length > 0) {
      const error = fileRejections[0].errors[0]
      if (error.code === 'file-too-large') {
        toast.error('文件过大！最大支持 500MB')
      } else if (error.code === 'file-invalid-type') {
        toast.error('不支持的文件格式！请上传音频文件')
      } else {
        toast.error(`文件验证失败: ${error.message}`)
      }
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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`
    }
    return `${minutes}分钟`
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('请先选择文件')
      return
    }

    setUploading(true)
    setProgress(0)

    try {
      // 创建 FormData
      const formData = new FormData()
      formData.append('file', selectedFile)

      // 使用 XMLHttpRequest 以支持进度追踪
      const xhr = new XMLHttpRequest()

      // 监听上传进度
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100)
          setProgress(percentComplete)
        }
      })

      // 处理响应
      xhr.addEventListener('load', () => {
        try {
          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText)
            if (response.success) {
              toast.success('文件上传成功！开始转写...')
              onUploadSuccess?.(response.data.meetingId)
              setSelectedFile(null)
            } else {
              throw new Error(response.error || '上传失败')
            }
          } else {
            // 检查是否返回了 HTML 而不是 JSON
            if (xhr.responseText.startsWith('<!DOCTYPE') || xhr.responseText.startsWith('<html')) {
              console.error('服务器返回了HTML页面而非JSON:', xhr.status, xhr.responseText.substring(0, 500))
              throw new Error(`API路由错误 (HTTP ${xhr.status})，请检查服务器是否正常运行`)
            }
            throw new Error(`上传失败: HTTP ${xhr.status}`)
          }
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : '解析响应失败'
          console.error('上传响应处理失败:', errorMsg, 'Response:', xhr.responseText.substring(0, 500))
          toast.error(errorMsg)
          onUploadError?.(errorMsg)
        }
        setUploading(false)
      })

      xhr.addEventListener('error', () => {
        const error = '网络错误，请检查连接'
        toast.error(error)
        onUploadError?.(error)
        setUploading(false)
      })

      // 发送请求
      xhr.open('POST', '/api/upload')
      xhr.send(formData)
    } catch (error) {
      console.error('上传失败:', error)
      const errorMsg = error instanceof Error ? error.message : '上传失败'
      toast.error(errorMsg)
      onUploadError?.(errorMsg)
      setUploading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* 拖拽上传区域 */}
      <Card
        {...getRootProps()}
        className={`border-2 border-dashed cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
            : 'border-gray-300 dark:border-gray-700 hover:border-gray-400'
        } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <CardContent className="p-12">
          <input {...getInputProps()} />
          <div className="text-center">
            <div className="mb-4">
              <svg
                className="mx-auto h-16 w-16 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            {isDragActive ? (
              <p className="text-lg font-medium text-blue-600">
                松开以上传文件...
              </p>
            ) : (
              <>
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                  拖拽音频文件到此处，或点击选择
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  支持 MP3, WAV, M4A, AAC, FLAC, OGG 格式
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  最大支持 500MB
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 已选文件信息 */}
      {selectedFile && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  {selectedFile.name}
                </h3>
                <div className="mt-2 flex items-center gap-3">
                  <Badge variant="secondary">
                    {formatFileSize(selectedFile.size)}
                  </Badge>
                  <Badge variant="secondary">
                    {selectedFile.type || '未知格式'}
                  </Badge>
                </div>
              </div>
              {!uploading && (
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* 上传进度 */}
            {uploading && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    上传中...
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {progress}%
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {/* 上传按钮 */}
            {!uploading && (
              <button
                onClick={handleUpload}
                className="mt-4 w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                开始上传并转写
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* 提示信息 */}
      <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <svg
              className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium">处理说明</p>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>上传后会自动开始转写，这是一个异步过程</li>
                <li>转写时间取决于音频长度，通常为音频时长的 1/10</li>
                <li>您可以在转写期间离开页面，稍后回来查看结果</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
