'use client'

import { FileUploader } from '@/components/FileUploader'
import { useRouter } from 'next/navigation'
import { Toaster } from '@/components/ui/sonner'

export default function UploadPage() {
  const router = useRouter()

  const handleUploadSuccess = (meetingId: string) => {
    // 上传成功后跳转到会议详情页
    router.push(`/meetings/${meetingId}`)
  }

  const handleUploadError = (error: string) => {
    console.error('上传失败:', error)
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-16">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-4">
              上传会议录音
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              支持音频转写，自动生成逐字稿和会议纪要（最大 500MB）
            </p>
          </div>

          {/* File Uploader */}
          <FileUploader
            onUploadSuccess={handleUploadSuccess}
            onUploadError={handleUploadError}
          />

          {/* Back Link */}
          <div className="mt-8 text-center">
            <a
              href="/"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              ← 返回首页
            </a>
          </div>
        </div>
      </div>
      <Toaster />
    </>
  )
}
