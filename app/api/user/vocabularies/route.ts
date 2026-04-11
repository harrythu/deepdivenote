import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireUser } from '@/lib/auth/get-user'
import { LIMITS } from '@/lib/constants/limits'
import { AppMode } from '@/lib/context/mode-context'

// 获取用户词汇表列表
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode') as AppMode | null

    // 构建查询条件
    const where: Record<string, unknown> = {
      userId: user.id,
      isActive: true,
    }

    // 如果指定了模式，只返回兼容该模式的词汇表
    if (mode === 'internal') {
      where.availableMode = {
        in: ['INTERNAL', 'BOTH'],
      }
    } else if (mode === 'external') {
      where.availableMode = {
        in: ['EXTERNAL', 'BOTH'],
      }
    }
    // 如果没有指定模式，返回所有词汇表（包括两种模式都适用的）

    const vocabularies = await prisma.userVocabulary.findMany({
      where,
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
    const { name, description, words, availableMode = 'BOTH' } = body

    // 验证必填字段
    if (!name) {
      return NextResponse.json(
        { success: false, error: '词汇表名称不能为空' },
        { status: 400 }
      )
    }

    // 验证 availableMode
    if (!['EXTERNAL', 'INTERNAL', 'BOTH'].includes(availableMode)) {
      return NextResponse.json(
        { success: false, error: '无效的可用模式' },
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
        availableMode: availableMode,
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
