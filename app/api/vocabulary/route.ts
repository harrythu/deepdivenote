import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const VOCABULARY_FILES: Record<string, { name: string; file: string }> = {
  'model': { name: '大模型常用词汇', file: 'voca-model.txt' },
  'llm': { name: '大模型技术词汇', file: 'voca-llm.txt' },
  'techstrategy': { name: '技术战略常用词汇', file: 'voca-techstrategy.txt' },
  'aiorg': { name: '大模型关键组织与人物', file: 'voca-aiorg.txt' },
}

function parseVocabularyFile(content: string): string[] {
  // 移除注释行（--- 开头的行）和空行
  const lines = content.split('\n')
  const words: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('---') && !trimmed.includes('(') || (trimmed && trimmed.startsWith('中文') || trimmed.startsWith('英文'))) {
      // 保留标题行作为分组标识
      if (trimmed.includes('中文词汇') || trimmed.includes('English')) {
        continue
      }
      if (trimmed && !trimmed.includes('(')) {
        words.push(trimmed)
      }
    }
  }

  return words
}

export async function GET() {
  try {
    const vocabularies: Record<string, { id: string; name: string; words: string[] }> = {}

    for (const [id, config] of Object.entries(VOCABULARY_FILES)) {
      const filePath = path.join(process.cwd(), config.file)
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        // 按行分割并清理
        const words = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0 && !line.startsWith('---') && !line.match(/^[A-Za-z]+ [A-Za-z]+/))
        vocabularies[id] = {
          id,
          name: config.name,
          words,
        }
      } catch {
        console.error(`Failed to read vocabulary file: ${config.file}`)
        vocabularies[id] = {
          id,
          name: config.name,
          words: [],
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: vocabularies,
    })
  } catch (error) {
    console.error('Failed to load vocabularies:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load vocabularies' },
      { status: 500 }
    )
  }
}