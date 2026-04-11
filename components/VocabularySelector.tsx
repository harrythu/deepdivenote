'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Check, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useMode } from '@/lib/context/mode-context'

interface SystemVocabulary {
  id: string
  name: string
  words: string[]
}

interface UserVocabulary {
  id: string
  name: string
  wordCount: number
  words: string[]
  availableMode?: string
}

interface VocabularySelectorProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (selectedWords: string[]) => void
  initialSelected?: string[]
}

export function VocabularySelector({
  isOpen,
  onClose,
  onConfirm,
  initialSelected = [],
}: VocabularySelectorProps) {
  const [systemVocabularies, setSystemVocabularies] = useState<Record<string, SystemVocabulary>>({})
  const [userVocabularies, setUserVocabularies] = useState<UserVocabulary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSystemIds, setSelectedSystemIds] = useState<string[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [customWords, setCustomWords] = useState<string[]>([])
  const [newWord, setNewWord] = useState('')
  const [activeTab, setActiveTab] = useState<'system' | 'user'>('system')
  const router = useRouter()
  const { mode: appMode } = useMode()

  useEffect(() => {
    if (isOpen) {
      loadTemplates()
    }
  }, [isOpen, appMode])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      // 加载系统词汇表
      const systemRes = await fetch('/api/vocabulary')
      const systemData = await systemRes.json()
      if (systemData.success) {
        setSystemVocabularies(systemData.data)
      }

      // 加载用户词汇表（根据当前模式过滤）
      const userRes = await fetch(`/api/user/vocabularies?mode=${appMode}`)
      const userData = await userRes.json()
      if (userData.success) {
        setUserVocabularies(userData.data)
      }
    } catch (error) {
      console.error('Failed to load vocabularies:', error)
      toast.error('加载词汇模板失败')
    } finally {
      setLoading(false)
    }
  }

  const toggleSystemTemplate = (id: string) => {
    setSelectedSystemIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleUserTemplate = (id: string) => {
    setSelectedUserIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleWord = (word: string) => {
    setCustomWords(prev =>
      prev.includes(word) ? prev.filter(w => w !== word) : [...prev, word]
    )
  }

  const addCustomWord = () => {
    const word = newWord.trim()
    if (word && !customWords.includes(word)) {
      setCustomWords(prev => [...prev, word])
      setNewWord('')
    }
  }

  const removeCustomWord = (word: string) => {
    setCustomWords(prev => prev.filter(w => w !== word))
  }

  const handleConfirm = () => {
    const allWords: string[] = [...customWords]

    // 添加选中的系统模板词汇
    for (const id of selectedSystemIds) {
      if (systemVocabularies[id]) {
        allWords.push(...systemVocabularies[id].words)
      }
    }

    // 添加选中的用户模板词汇
    for (const id of selectedUserIds) {
      const userVocab = userVocabularies.find(v => v.id === id)
      if (userVocab) {
        allWords.push(...userVocab.words)
      }
    }

    // 去重
    const uniqueWords = [...new Set(allWords)]
    onConfirm(uniqueWords)
    onClose()
  }

  const goToMyVocabularies = () => {
    onClose()
    window.open('/settings/vocabularies', '_blank')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            选择常用词汇
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <>
              {/* Tab Switcher */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab('system')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === 'system'
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    系统模板 ({Object.keys(systemVocabularies).length})
                  </button>
                  <button
                    onClick={() => setActiveTab('user')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === 'user'
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    我的词汇 ({userVocabularies.length})
                  </button>
                </div>
                {activeTab === 'user' && (
                  <button
                    onClick={goToMyVocabularies}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    构建我的词汇
                  </button>
                )}
              </div>

              {/* System Templates */}
              {activeTab === 'system' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.values(systemVocabularies).map(template => (
                    <Card
                      key={template.id}
                      className={`cursor-pointer transition-all ${
                        selectedSystemIds.includes(template.id)
                          ? 'ring-2 ring-blue-500 border-blue-500'
                          : 'hover:border-slate-400 dark:hover:border-slate-600'
                      }`}
                      onClick={() => toggleSystemTemplate(template.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                selectedSystemIds.includes(template.id)
                                  ? 'bg-blue-500 border-blue-500'
                                  : 'border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {selectedSystemIds.includes(template.id) && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </div>
                            <span className="font-medium text-slate-900 dark:text-white">
                              {template.name}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {template.words.length} 词
                          </Badge>
                        </div>

                        {/* Preview words */}
                        <div className="mt-3 flex flex-wrap gap-1">
                          {template.words.slice(0, 5).map((word, i) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            >
                              {word}
                            </span>
                          ))}
                          {template.words.length > 5 && (
                            <span className="text-xs text-slate-400">
                              +{template.words.length - 5} 更多
                            </span>
                          )}
                        </div>

                        {/* Expand button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedId(expandedId === template.id ? null : template.id)
                          }}
                          className="mt-3 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700"
                        >
                          {expandedId === template.id ? (
                            <>
                              <ChevronUp className="w-3 h-3" />
                              收起
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" />
                              查看全部
                            </>
                          )}
                        </button>

                        {/* Expanded word list */}
                        {expandedId === template.id && (
                          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                            <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
                              {template.words.map((word, i) => (
                                <span
                                  key={i}
                                  className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                >
                                  {word}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* User Vocabularies */}
              {activeTab === 'user' && (
                <>
                  {userVocabularies.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-slate-500 mb-4">您还没有创建常用词汇</p>
                      <Button onClick={goToMyVocabularies} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />
                        创建我的词汇表
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {userVocabularies.map(vocab => (
                        <Card
                          key={vocab.id}
                          className={`cursor-pointer transition-all ${
                            selectedUserIds.includes(vocab.id)
                              ? 'ring-2 ring-blue-500 border-blue-500'
                              : 'hover:border-slate-400 dark:hover:border-slate-600'
                          }`}
                          onClick={() => toggleUserTemplate(vocab.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                    selectedUserIds.includes(vocab.id)
                                      ? 'bg-blue-500 border-blue-500'
                                      : 'border-slate-300 dark:border-slate-600'
                                  }`}
                                >
                                  {selectedUserIds.includes(vocab.id) && (
                                    <Check className="w-3 h-3 text-white" />
                                  )}
                                </div>
                                <span className="font-medium text-slate-900 dark:text-white">
                                  {vocab.name}
                                </span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {vocab.wordCount} 词
                              </Badge>
                            </div>

                            {/* Preview words */}
                            <div className="mt-3 flex flex-wrap gap-1">
                              {vocab.words.slice(0, 5).map((word, i) => (
                                <span
                                  key={i}
                                  className="text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                >
                                  {word}
                                </span>
                              ))}
                              {vocab.words.length > 5 && (
                                <span className="text-xs text-slate-400">
                                  +{vocab.words.length - 5} 更多
                                </span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Custom Words Section */}
              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
                  添加自定义词汇
                </h3>
                <div className="flex gap-2 mb-3">
                  <Input
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addCustomWord()
                      }
                    }}
                    placeholder="输入自定义词汇后按 Enter 添加"
                    className="flex-1"
                  />
                  <Button onClick={addCustomWord} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {customWords.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 min-h-[80px]">
                    {customWords.map((word, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="flex items-center gap-1 px-3 py-1"
                      >
                        {word}
                        <button
                          onClick={() => removeCustomWord(word)}
                          className="ml-1 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <div className="text-sm text-slate-500">
            已选择 {selectedSystemIds.length + selectedUserIds.length} 个模板，{customWords.length} 个自定义词汇
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700">
              确认选择
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
