'use client'

import { useState, useEffect } from 'react'
import { X, Check, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface VocabularyTemplate {
  id: string
  name: string
  words: string[]
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
  const [templates, setTemplates] = useState<Record<string, VocabularyTemplate>>({})
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [customWords, setCustomWords] = useState<string[]>([])
  const [newWord, setNewWord] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadTemplates()
    }
  }, [isOpen])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/vocabulary')
      const data = await res.json()
      if (data.success) {
        setTemplates(data.data)
      }
    } catch (error) {
      console.error('Failed to load vocabularies:', error)
      toast.error('加载词汇模板失败')
    } finally {
      setLoading(false)
    }
  }

  const toggleTemplate = (id: string) => {
    setSelectedIds(prev =>
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
    // 合并所有选中的词汇
    const allWords: string[] = [...customWords]

    // 添加选中模板的词汇
    for (const id of selectedIds) {
      if (templates[id]) {
        allWords.push(...templates[id].words)
      }
    }

    // 去重
    const uniqueWords = [...new Set(allWords)]
    onConfirm(uniqueWords)
    onClose()
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
              {/* Templates Section */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
                  选择词汇模板
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.values(templates).map(template => (
                    <Card
                      key={template.id}
                      className={`cursor-pointer transition-all ${
                        selectedIds.includes(template.id)
                          ? 'ring-2 ring-blue-500 border-blue-500'
                          : 'hover:border-slate-400 dark:hover:border-slate-600'
                      }`}
                      onClick={() => toggleTemplate(template.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                selectedIds.includes(template.id)
                                  ? 'bg-blue-500 border-blue-500'
                                  : 'border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {selectedIds.includes(template.id) && (
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
              </div>

              {/* Custom Words Section */}
              <div>
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
            已选择 {selectedIds.length} 个模板，{customWords.length} 个自定义词汇
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