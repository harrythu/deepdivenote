'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Trash2, Edit2, Save, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Vocabulary {
  id: string
  name: string
  description: string | null
  words: string[]
  wordCount: number
  availableMode?: string
  createdAt: string
}

export default function VocabulariesPage() {
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // 表单状态
  const [name, setName] = useState('')
  const [words, setWords] = useState('')
  const [availableMode, setAvailableMode] = useState('BOTH')
  const [saving, setSaving] = useState(false)

  // 限制常量
  const MAX_COUNT = 50
  const MAX_WORDS = 1000
  const MAX_NAME_LENGTH = 20

  // 加载用户词汇表
  const loadVocabularies = async () => {
    if (!isAuthenticated) return
    try {
      const res = await fetch('/api/user/vocabularies')
      const data = await res.json()
      if (data.success) {
        setVocabularies(data.data)
      }
    } catch (error) {
      console.error('加载词汇表失败:', error)
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
      loadVocabularies()
    }
  }, [isLoading, isAuthenticated, router])

  // 创建/更新词汇表
  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('请输入词汇表名称')
      return
    }

    if (name.length > MAX_NAME_LENGTH) {
      toast.error(`词汇表名称不能超过${MAX_NAME_LENGTH}字`)
      return
    }

    const wordList = words.split('\n').map(w => w.trim()).filter(Boolean)
    if (wordList.length === 0) {
      toast.error('请输入至少一个词汇')
      return
    }

    if (wordList.length > MAX_WORDS) {
      toast.error(`每个词汇表最多${MAX_WORDS}个词汇`)
      return
    }

    if (vocabularies.length >= MAX_COUNT && !editingId) {
      toast.error(`最多只能创建${MAX_COUNT}个词汇表`)
      return
    }

    setSaving(true)
    try {
      const url = editingId ? `/api/user/vocabularies/${editingId}` : '/api/user/vocabularies'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, words: wordList, availableMode }),
      })
      const data = await res.json()

      if (data.success) {
        toast.success(editingId ? '词汇表已更新' : '词汇表已创建')
        resetForm()
        loadVocabularies()
      } else {
        toast.error(data.error || '保存失败')
      }
    } catch (error) {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 删除词汇表
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个词汇表吗？')) return

    try {
      const res = await fetch(`/api/user/vocabularies/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast.success('词汇表已删除')
        loadVocabularies()
      } else {
        toast.error(data.error || '删除失败')
      }
    } catch {
      toast.error('删除失败')
    }
  }

  // 编辑词汇表
  const handleEdit = (vocab: Vocabulary) => {
    setEditingId(vocab.id)
    setName(vocab.name)
    setWords(vocab.words.join('\n'))
    setAvailableMode(vocab.availableMode || 'BOTH')
    setShowForm(true)
  }

  // 重置表单
  const resetForm = () => {
    setName('')
    setWords('')
    setAvailableMode('BOTH')
    setEditingId(null)
    setShowForm(false)
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12">
        <div className="container mx-auto px-6 max-w-4xl">
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

  const wordList = words.split('\n').map(w => w.trim()).filter(Boolean)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12">
      <div className="container mx-auto px-6 max-w-6xl">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            我的常用词汇
          </h1>
          <p className="text-slate-500">
            创建和管理您的纠错词汇模板，最多 {MAX_COUNT} 个模板，每个模板最多 {MAX_WORDS} 个词汇
          </p>
        </div>

        {/* 左右两栏布局 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左侧：已词汇表 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              已有的词汇表 ({vocabularies.length}/{MAX_COUNT})
            </h2>
            {vocabularies.length === 0 ? (
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-8 text-center">
                  <p className="text-slate-500">还没有创建词汇表</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {vocabularies.map((vocab) => (
                  <Card key={vocab.id} className="border-slate-200 dark:border-slate-800">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium text-slate-900 dark:text-white">
                              {vocab.name}
                            </h3>
                            <Badge variant="outline" className="text-xs">
                              {vocab.wordCount} 词
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {vocab.words.slice(0, 10).map((word, i) => (
                              <span
                                key={i}
                                className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              >
                                {word}
                              </span>
                            ))}
                            {vocab.words.length > 10 && (
                              <span className="text-xs text-slate-400">
                                +{vocab.words.length - 10} 更多
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleEdit(vocab)}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(vocab.id)}
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

          {/* 右侧：创建/编辑表单 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              {editingId ? '编辑词汇表' : '创建新词汇表'}
            </h2>
            {(editingId || showForm) ? (
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        词汇表名称
                      </label>
                      <span className={`text-xs ${name.length > MAX_NAME_LENGTH ? 'text-red-500' : 'text-slate-400'}`}>
                        {name.length} / {MAX_NAME_LENGTH} 字
                      </span>
                    </div>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="如：金融术语、技术词汇"
                      className={`bg-white dark:bg-slate-900 ${name.length > MAX_NAME_LENGTH ? 'border-red-500 focus:ring-red-400' : ''}`}
                    />
                    {name.length > MAX_NAME_LENGTH && (
                      <p className="text-sm text-red-500 mt-1">
                        词汇表名称不能超过{MAX_NAME_LENGTH}字
                      </p>
                    )}
                    {name.trim() === '' && showForm && (
                      <p className="text-sm text-red-500 mt-1">
                        请输入词汇表名称
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        词汇列表
                      </label>
                      <span className={`text-xs ${wordList.length > MAX_WORDS ? 'text-red-500' : 'text-slate-400'}`}>
                        {wordList.length} / {MAX_WORDS} 词
                      </span>
                    </div>
                    <textarea
                      value={words}
                      onChange={(e) => setWords(e.target.value)}
                      placeholder={`输入词汇，每行一个，例如：\n人工智能\n机器学习\n深度学习`}
                      className="w-full h-64 p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    {wordList.length > MAX_WORDS && (
                      <p className="text-sm text-red-500 mt-1">
                        词汇数量超过限制，请减少至 {MAX_WORDS} 个以内
                      </p>
                    )}
                    {words.trim() === '' && showForm && (
                      <p className="text-sm text-red-500 mt-1">
                        请输入至少一个词汇
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                      可用范围
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="availableMode"
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
                          name="availableMode"
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
                      disabled={saving || wordList.length > MAX_WORDS}
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
            ) : (
              <Card
                className="border-dashed border-2 border-slate-300 dark:border-slate-600 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
                onClick={() => { resetForm(); setShowForm(true); }}
              >
                <CardContent className="p-8 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <Plus className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-slate-500">
                      点击此处创建新的词汇表
                    </p>
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
