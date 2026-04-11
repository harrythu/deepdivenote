'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Trash2, Edit2, Save, X, Sparkles, FileText, Upload, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Template {
  id: string
  name: string
  description: string | null
  content: string
  category: string | null
  usageCount: number
  availableMode?: string
  createdAt: string
}

interface Model {
  id: string
  name: string
  category: string
  description: string
  maxTokens: number
}

export default function TemplatesPage() {
  const { isLoading, isAuthenticated } = useAuth()
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // 创建模式：manual = 手工创建, ai = AI辅助创建
  const [createMode, setCreateMode] = useState<'manual' | 'ai' | null>(null)

  // AI辅助创建状态
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [referenceFile, setReferenceFile] = useState<File | null>(null)
  const [originalText, setOriginalText] = useState('')
  const [referenceText, setReferenceText] = useState('')
  const [selectedModel, setSelectedModel] = useState('openai/gpt-5.4-mini')
  const [generating, setGenerating] = useState(false)
  const [generatedTemplate, setGeneratedTemplate] = useState('')

  // 手工创建状态
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [availableMode, setAvailableMode] = useState('BOTH')
  const [saving, setSaving] = useState(false)

  const originalFileRef = useRef<HTMLInputElement>(null)
  const referenceFileRef = useRef<HTMLInputElement>(null)

  // 加载模型列表
  const [models, setModels] = useState<Model[]>([])

  useEffect(() => {
    fetch('/api/models')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data.models) {
          setModels(data.data.models)
        }
      })
      .catch(console.error)
  }, [])

  // 限制常量
  const MAX_COUNT = 50
  const MAX_LENGTH = 5000
  const MAX_NAME_LENGTH = 20

  // 加载用户模板
  const loadTemplates = async () => {
    if (!isAuthenticated) return
    try {
      const res = await fetch('/api/user/templates')
      const data = await res.json()
      if (data.success) {
        setTemplates(data.data)
      }
    } catch (error) {
      console.error('加载模板失败:', error)
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
      loadTemplates()
    }
  }, [isLoading, isAuthenticated, router])

  // 处理文件上传
  const handleFileUpload = async (file: File, type: 'original' | 'reference') => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/parse-file', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!data.success) {
        toast.error(data.error || '文件解析失败')
        return
      }

      if (type === 'original') {
        setOriginalFile(file)
        setOriginalText(data.data.text)
      } else {
        setReferenceFile(file)
        setReferenceText(data.data.text)
      }
      toast.success(`已加载: ${file.name}`)
    } catch (error) {
      toast.error('文件读取失败')
    }
  }

  // AI生成模板
  const handleAIGenerate = async () => {
    if (!originalText.trim()) {
      toast.error('请上传原始文档')
      return
    }
    if (!referenceText.trim()) {
      toast.error('请上传参考结果')
      return
    }

    setGenerating(true)
    try {
      const res = await fetch('/api/user/templates/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalText,
          referenceSummary: referenceText,
          model: selectedModel,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setGeneratedTemplate(data.data.template)
      toast.success('提示词模板已生成')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '生成失败'
      // 检查是否是内部版超时错误
      if (errorMessage === 'INTERNAL_TIMEOUT' || errorMessage.includes('timeout')) {
        toast.error('目前蚂蚁内部版无法工作，请检查：1、您是否处于蚂蚁内网或者开启内网VPN；2、您配置的Theta API key是否有效')
      } else {
        toast.error(errorMessage)
      }
    } finally {
      setGenerating(false)
    }
  }

  // 错误状态（用于实时显示）
  const [nameError, setNameError] = useState('')
  const [contentError, setContentError] = useState('')

  // 验证模板名称
  const validateName = (value: string) => {
    if (!value.trim()) {
      setNameError('请输入模板名称')
      return false
    }
    if (value.length > MAX_NAME_LENGTH) {
      setNameError(`模板名称不能超过${MAX_NAME_LENGTH}字`)
      return false
    }
    setNameError('')
    return true
  }

  // 验证模板内容
  const validateContent = (value: string) => {
    const templateContent = generatedTemplate || value
    if (!templateContent.trim()) {
      setContentError('请输入模板内容')
      return false
    }
    if (templateContent.length > MAX_LENGTH) {
      setContentError(`模板内容不能超过${MAX_LENGTH}字`)
      return false
    }
    setContentError('')
    return true
  }

  const handleSave = async () => {
    const templateContent = generatedTemplate || content

    const isNameValid = validateName(name)
    const isContentValid = validateContent(content)
    if (!isNameValid || !isContentValid) {
      return
    }

    if (templates.length >= MAX_COUNT && !editingId) {
      toast.error(`最多只能创建${MAX_COUNT}个模板`)
      return
    }

    setSaving(true)
    try {
      const url = editingId ? `/api/user/templates/${editingId}` : '/api/user/templates'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, content: templateContent, availableMode }),
      })
      const data = await res.json()

      if (data.success) {
        toast.success(editingId ? '模板已更新' : '模板已创建')
        resetForm()
        loadTemplates()
      } else {
        toast.error(data.error || '保存失败')
      }
    } catch (error) {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 删除模板
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个模板吗？')) return

    try {
      const res = await fetch(`/api/user/templates/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast.success('模板已删除')
        loadTemplates()
      } else {
        toast.error(data.error || '删除失败')
      }
    } catch {
      toast.error('删除失败')
    }
  }

  // 编辑模板
  const handleEdit = (template: Template) => {
    setEditingId(template.id)
    setName(template.name)
    setContent(template.content)
    setAvailableMode(template.availableMode || 'BOTH')
    setGeneratedTemplate('')
    setCreateMode('manual')
    setShowForm(true)
  }

  // 重置表单
  const resetForm = () => {
    setName('')
    setContent('')
    setAvailableMode('BOTH')
    setEditingId(null)
    setShowForm(false)
    setCreateMode(null)
    setOriginalFile(null)
    setReferenceFile(null)
    setOriginalText('')
    setReferenceText('')
    setGeneratedTemplate('')
    setSelectedModel('openai/gpt-5.4-mini')
  }

  // 选择创建模式
  const handleSelectCreateMode = (mode: 'manual' | 'ai') => {
    setCreateMode(mode)
    setShowForm(true)
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12">
        <div className="container mx-auto px-6 max-w-6xl">
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

  const contentLength = (generatedTemplate || content).length

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12">
      <div className="container mx-auto px-6 max-w-6xl">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            我的纪要模板
          </h1>
          <p className="text-slate-500">
            创建和管理您的纪要生成提示词模板，最多 {MAX_COUNT} 个模板，每个模板最多 {MAX_LENGTH} 字
          </p>
        </div>

        {/* 左右两栏布局 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左侧：已创建的模板 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              已有的模板 ({templates.length}/{MAX_COUNT})
            </h2>
            {templates.length === 0 ? (
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-8 text-center">
                  <p className="text-slate-500">还没有创建模板</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <Card key={template.id} className="border-slate-200 dark:border-slate-800">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium text-slate-900 dark:text-white">
                              {template.name}
                            </h3>
                            <Badge variant="outline" className="text-xs">
                              {template.content.length} 字
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-500 line-clamp-2">
                            {template.content.slice(0, 100)}...
                          </p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleEdit(template)}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(template.id)}
                            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* 右侧：创建/编辑模板 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              {editingId ? '编辑模板' : showForm ? '创建新模板' : '创建新模板'}
            </h2>

            {/* 模式选择 */}
            {!showForm && !editingId && (
              <div className="space-y-4">
                {/* AI辅助创建 */}
                <Card
                  className="border-dashed border-2 border-purple-300 dark:border-purple-600 cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors"
                  onClick={() => handleSelectCreateMode('ai')}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-900 dark:text-white">
                          AI辅助创建
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                          提供原始文档和参考纪要，AI帮你创作提示词
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 手工创建 */}
                <Card
                  className="border-dashed border-2 border-slate-300 dark:border-slate-600 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
                  onClick={() => handleSelectCreateMode('manual')}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-slate-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-900 dark:text-white">
                          手工创建
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                          自己编写提示词模板内容
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* AI辅助创建表单 */}
            {showForm && createMode === 'ai' && (
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="space-y-6">
                  {/* 模型选择 */}
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                      选择大模型
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {models.map(model => (
                        <button
                          key={model.id}
                          onClick={() => setSelectedModel(model.id)}
                          className={`p-2 rounded-lg border text-left transition-colors ${
                            selectedModel === model.id
                              ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20'
                              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {model.name}
                          </div>
                          <div className="text-xs text-slate-500">{model.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 原始文档上传 */}
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                      原始文档（会议录音转写内容）
                    </label>
                    <input
                      ref={originalFileRef}
                      type="file"
                      accept=".txt,.md,.doc,.docx,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFileUpload(file, 'original')
                      }}
                    />
                    <div
                      className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                        originalFile
                          ? 'border-green-400 bg-green-50 dark:bg-green-900/10'
                          : 'border-slate-300 dark:border-slate-600 hover:border-slate-400'
                      }`}
                      onClick={() => originalFileRef.current?.click()}
                    >
                      {originalFile ? (
                        <div className="flex items-center justify-center gap-2">
                          <Check className="w-5 h-5 text-green-600" />
                          <span className="text-green-700 dark:text-green-400">{originalFile.name}</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 mx-auto text-slate-400 mb-2" />
                          <p className="text-sm text-slate-500">点击上传 .txt, .md, .docx, .pdf 文件</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 参考结果上传 */}
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                      参考结果（整理好的会议纪要）
                    </label>
                    <input
                      ref={referenceFileRef}
                      type="file"
                      accept=".txt,.md,.doc,.docx,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFileUpload(file, 'reference')
                      }}
                    />
                    <div
                      className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                        referenceFile
                          ? 'border-green-400 bg-green-50 dark:bg-green-900/10'
                          : 'border-slate-300 dark:border-slate-600 hover:border-slate-400'
                      }`}
                      onClick={() => referenceFileRef.current?.click()}
                    >
                      {referenceFile ? (
                        <div className="flex items-center justify-center gap-2">
                          <Check className="w-5 h-5 text-green-600" />
                          <span className="text-green-700 dark:text-green-400">{referenceFile.name}</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 mx-auto text-slate-400 mb-2" />
                          <p className="text-sm text-slate-500">点击上传 .txt, .md, .docx, .pdf 文件</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* AI生成按钮 */}
                  <Button
                    onClick={handleAIGenerate}
                    disabled={generating || !originalText || !referenceText}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    {generating ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        AI创作中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        AI辅助创建
                      </>
                    )}
                  </Button>

                  {/* AI生成的提示词 */}
                  {generatedTemplate && (
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          AI创作的提示词模板
                        </label>
                        <Badge variant="outline" className="text-xs">
                          {generatedTemplate.length} 字
                        </Badge>
                      </div>
                      <textarea
                        value={generatedTemplate}
                        onChange={(e) => setGeneratedTemplate(e.target.value)}
                        className="w-full h-64 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>
                  )}

                  {/* 模板名称 */}
                  {generatedTemplate && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          模板名称
                        </label>
                        <span className={`text-xs ${name.length > MAX_NAME_LENGTH ? 'text-red-500' : 'text-slate-400'}`}>
                          {name.length} / {MAX_NAME_LENGTH} 字
                        </span>
                      </div>
                      <Input
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value)
                          validateName(e.target.value)
                        }}
                        onBlur={() => validateName(name)}
                        placeholder="如：产品评审纪要"
                        className={nameError ? 'border-red-500 focus:ring-red-400' : ''}
                      />
                      {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
                    </div>
                  )}

                  {/* 保存按钮 */}
                  {generatedTemplate && (
                    <>
                      {/* 模板可见性 */}
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                          模板可见性
                        </label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="aiTemplateAvailableMode"
                              value="BOTH"
                              checked={availableMode === 'BOTH'}
                              onChange={(e) => setAvailableMode(e.target.value)}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              外部版和内部版均可使用
                            </span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="aiTemplateAvailableMode"
                              value="INTERNAL"
                              checked={availableMode === 'INTERNAL'}
                              onChange={(e) => setAvailableMode(e.target.value)}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              仅蚂蚁内部版可用
                            </span>
                          </label>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button
                          onClick={handleSave}
                          disabled={saving || contentLength > MAX_LENGTH}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {saving ? '保存中...' : '保存'}
                        </Button>
                        <Button
                          onClick={resetForm}
                          variant="outline"
                          disabled={saving}
                        >
                          <X className="w-4 h-4 mr-2" />
                          取消
                        </Button>
                      </div>
                    </>
                  )}

                  {/* 取消按钮 */}
                  {!generatedTemplate && (
                    <Button
                      onClick={resetForm}
                      variant="outline"
                      className="w-full"
                    >
                      <X className="w-4 h-4 mr-2" />
                      取消
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 手工创建表单 */}
            {showForm && createMode === 'manual' && (
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        模板名称
                      </label>
                      <span className={`text-xs ${name.length > MAX_NAME_LENGTH ? 'text-red-500' : 'text-slate-400'}`}>
                        {name.length} / {MAX_NAME_LENGTH} 字
                      </span>
                    </div>
                    <Input
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value)
                        validateName(e.target.value)
                      }}
                      onBlur={() => validateName(name)}
                      placeholder="如：产品评审纪要"
                      className={`bg-white dark:bg-slate-900 ${nameError ? 'border-red-500 focus:ring-red-400' : ''}`}
                    />
                    {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        模板内容
                      </label>
                      <span className={`text-xs ${contentLength > MAX_LENGTH ? 'text-red-500' : 'text-slate-400'}`}>
                        {contentLength} / {MAX_LENGTH} 字
                      </span>
                    </div>
                    <textarea
                      value={content}
                      onChange={(e) => {
                        setContent(e.target.value)
                        validateContent(e.target.value)
                      }}
                      onBlur={() => validateContent(content)}
                      placeholder="输入模板内容，使用 {{transcription}} 占位转写内容..."
                      className={`w-full h-80 p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 ${contentError ? 'border-red-500 focus:ring-red-400' : ''}`}
                    />
                    {contentError && <p className="text-xs text-red-500 mt-1">{contentError}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                      可用范围
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="templateAvailableMode"
                          value="BOTH"
                          checked={availableMode === 'BOTH'}
                          onChange={(e) => setAvailableMode(e.target.value)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          外部版和内部版均可使用
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="templateAvailableMode"
                          value="INTERNAL"
                          checked={availableMode === 'INTERNAL'}
                          onChange={(e) => setAvailableMode(e.target.value)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          仅蚂蚁内部版可用
                        </span>
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={handleSave}
                      disabled={saving || contentLength > MAX_LENGTH}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {saving ? '保存中...' : '保存'}
                    </Button>
                    <Button
                      onClick={resetForm}
                      variant="outline"
                      disabled={saving}
                    >
                      <X className="w-4 h-4 mr-2" />
                      取消
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}