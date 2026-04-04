import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireUser } from '@/lib/auth/get-user'
import { LIMITS } from '@/lib/constants/limits'

// 获取用户词汇表列表
export async function GET() {
  try {
    const user = await requireUser()

    const vocabularies = await prisma.userVocabulary.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json({
      success: true,
      data: vocabularies,
    })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      )
    }
    console.error('获取词汇表失败:', error)
    return NextResponse.json(
      { success: false, error: '获取词汇表失败' },
      { status: 500 }
    )
  }
}

// 创建词汇表
export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const body = await request.json()
    const { name, description, words } = body

    // 验证必填字段
    if (!name) {
      return NextResponse.json(
        { success: false, error: '词汇表名称不能为空' },
        { status: 400 }
      )
    }

    // 检查词汇表数量限制
    const count = await prisma.userVocabulary.count({
      where: {
        userId: user.id,
        isActive: true,
      },
    })

    if (count >= LIMITS.VOCABULARY_MAX_COUNT) {
      return NextResponse.json(
        { success: false, error: `最多只能创建${LIMITS.VOCABULARY_MAX_COUNT}张词汇表` },
        { status: 400 }
      )
    }

    // 处理词汇
    const wordList: string[] = Array.isArray(words) ? words : []
    if (wordList.length > LIMITS.VOCABULARY_MAX_WORDS) {
      return NextResponse.json(
        { success: false, error: `每个词汇表最多${LIMITS.VOCABULARY_MAX_WORDS}个词汇` },
        { status: 400 }
      )
    }

    // 去重
    const uniqueWords = [...new Set(wordList.map(w => w.trim()).filter(Boolean))]

    const vocabulary = await prisma.userVocabulary.create({
      data: {
        userId: user.id,
        name,
        description: description || null,
        words: uniqueWords,
        wordCount: uniqueWords.length,
      },
    })

    return NextResponse.json({
      success: true,
      data: vocabulary,
    })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      )
    }
    console.error('创建词汇表失败:', error)
    return NextResponse.json(
      { success: false, error: '创建词汇表失败' },
      { status: 500 }
    )
  }
}
