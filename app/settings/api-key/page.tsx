'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Save, Trash2, Eye, EyeOff, Check } from 'lucide-react'
import { useMode } from '@/lib/context/mode-context'

export default function ApiKeyPage() {
  const { isLoading, isAuthenticated } = useAuth()
  const { setMode, mode } = useMode()
  const router = useRouter()

  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [maskedApiKey, setMaskedApiKey] = useState('')
  const [preferredMode, setPreferredMode] = useState('EXTERNAL')

  // 加载 API KEY 信息
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
      return
    }
    if (isAuthenticated) {
      loadApiKey()
    }
  }, [isLoading, isAuthenticated, router])

  const loadApiKey = async () => {
    try {
      const res = await fetch('/api/user/api-key')
      const data = await res.json()
      if (data.success) {
        setHasApiKey(data.data.hasApiKey)
        setMaskedApiKey(data.data.maskedApiKey || '')
        setPreferredMode(data.data.preferredMode || 'EXTERNAL')
      }
    } catch (error) {
      console.error('加载 API KEY 失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 保存 API KEY
  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error('请输入 API KEY')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/user/api-key', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          preferredMode,
        }),
      })
      const data = await res.json()

      if (data.success) {
        toast.success('API KEY 保存成功')
        setApiKey('')
        setHasApiKey(true)
        setMaskedApiKey('已保存')
        // 更新 ModeContext 中的 userApiKey
        window.location.reload()
      } else {
        toast.error(data.error || '保存失败')
      }
    } catch (error) {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 删除 API KEY
  const handleDelete = async () => {
    if (!confirm('确定要删除您的 API KEY 吗？删除后将无法使用蚂蚁内部版。')) {
      return
    }

    try {
      const res = await fetch('/api/user/api-key', { method: 'DELETE' })
      const data = await res.json()

      if (data.success) {
        toast.success('API KEY 已删除')
        setHasApiKey(false)
        setMaskedApiKey('')
      } else {
        toast.error(data.error || '删除失败')
      }
    } catch (error) {
      toast.error('删除失败')
    }
  }

  // 保存偏好模式
  const handleSavePreferredMode = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/user/api-key', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredMode }),
      })
      const data = await res.json()

      if (data.success) {
        toast.success('偏好设置已保存')
        // 如果设置了内部版偏好，切换到内部版
        if (preferredMode === 'INTERNAL') {
          setMode('internal')
        }
      } else {
        toast.error(data.error || '保存失败')
      }
    } catch (error) {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12">
        <div className="container mx-auto px-6 max-w-2xl">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12">
      <div className="container mx-auto px-6 max-w-2xl">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            API KEY 管理
          </h1>
          <p className="text-slate-500">
            创建和管理您的 Theta API KEY，请在处于蚂蚁内网模式下，访问 Theta 网址：
            <a
              href="https://theta.alipay.com/work/systemManagement/token"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 underline ml-1"
            >
              https://theta.alipay.com/work/systemManagement/token
            </a>
          </p>
        </div>

        {/* Theta API KEY */}
        <Card className="mb-6 border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Theta API KEY
              {hasApiKey && (
                <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                  <Check className="w-3 h-3 mr-1" />
                  已配置
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              用于访问蚂蚁内部版的大模型服务（Theta API）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasApiKey ? (
              <>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400 font-mono">
                    {showApiKey ? maskedApiKey : maskedApiKey.replace(/\*/g, '•')}
                  </span>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleDelete}
                    variant="outline"
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    删除
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="请输入您的 Theta API KEY"
                    className="font-mono"
                  />
                </div>
                <Button
                  onClick={handleSave}
                  disabled={saving || !apiKey.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? '保存中...' : '保存'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* 偏好设置 */}
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle>使用偏好</CardTitle>
            <CardDescription>
              选择您偏好的默认版本（登录后将自动切换到对应版本）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                <input
                  type="radio"
                  name="preferredMode"
                  value="EXTERNAL"
                  checked={preferredMode === 'EXTERNAL'}
                  onChange={(e) => setPreferredMode(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">外部版（默认）</div>
                  <div className="text-sm text-slate-500">使用 ZenMux API，无需额外配置</div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                <input
                  type="radio"
                  name="preferredMode"
                  value="INTERNAL"
                  checked={preferredMode === 'INTERNAL'}
                  onChange={(e) => setPreferredMode(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">蚂蚁内部版</div>
                  <div className="text-sm text-slate-500">使用 Theta API，需要配置您的 API KEY</div>
                </div>
              </label>
            </div>
            <Button
              onClick={handleSavePreferredMode}
              disabled={saving}
              variant="outline"
            >
              <Save className="w-4 h-4 mr-2" />
              保存偏好设置
            </Button>
          </CardContent>
        </Card>

        {/* 说明 */}
        <div className="mt-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">关于 API KEY</h3>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>• 您的 API KEY 将加密存储，不会被泄露</li>
            <li>• 内部版调用 Theta API 产生的费用由您自行承担</li>
            <li>• 外部版使用系统默认的 ZenMux API 配额</li>
            <li>• 切换版本后，模型列表将自动更新为对应版本可用模型</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
