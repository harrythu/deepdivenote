import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireUser } from '@/lib/auth/get-user'
import { LIMITS } from '@/lib/constants/limits'

type RouteParams = { params: Promise<{ id: string }> }

// 获取单个词汇表
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await requireUser()
    const { id } = await params

    const vocabulary = await prisma.userVocabulary.findFirst({
      where: {
        id,
        userId: user.id,
        isActive: true,
      },
    })

    if (!vocabulary) {
      return NextResponse.json(
        { success: false, error: '词汇表不存在' },
        { status: 404 }
      )
    }

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
    console.error('获取词汇表失败:', error)
    return NextResponse.json(
      { success: false, error: '获取词汇表失败' },
      { status: 500 }
    )
  }
}

// 更新词汇表
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await requireUser()
    const { id } = await params
    const body = await request.json()
    const { name, description, words, sortOrder, availableMode } = body

    // 检查词汇表是否存在且属于当前用户
    const existing = await prisma.userVocabulary.findFirst({
      where: {
        id,
        userId: user.id,
        isActive: true,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '词汇表不存在' },
        { status: 404 }
      )
    }

    // 验证 availableMode
    if (availableMode !== undefined && !['EXTERNAL', 'INTERNAL', 'BOTH'].includes(availableMode)) {
      return NextResponse.json(
        { success: false, error: '无效的可用模式' },
        { status: 400 }
      )
    }

    // 处理词汇
    let wordList: string[] = existing.words as string[]
    if (words !== undefined) {
      wordList = Array.isArray(words) ? words : []
      if (wordList.length > LIMITS.VOCABULARY_MAX_WORDS) {
        return NextResponse.json(
          { success: false, error: `每个词汇表最多${LIMITS.VOCABULARY_MAX_WORDS}个词汇` },
          { status: 400 }
        )
      }
      wordList = [...new Set(wordList.map(w => w.trim()).filter(Boolean))]
    }

    const vocabulary = await prisma.userVocabulary.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(words !== undefined && { words: wordList, wordCount: wordList.length }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(availableMode !== undefined && { availableMode }),
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
    console.error('更新词汇表失败:', error)
    return NextResponse.json(
      { success: false, error: '更新词汇表失败' },
      { status: 500 }
    )
  }
}

// 删除词汇表（软删除）
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await requireUser()
    const { id } = await params

    const existing = await prisma.userVocabulary.findFirst({
      where: {
        id,
        userId: user.id,
        isActive: true,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '词汇表不存在' },
        { status: 404 }
      )
    }

    await prisma.userVocabulary.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({
      success: true,
      message: '词汇表已删除',
    })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      )
    }
    console.error('删除词汇表失败:', error)
    return NextResponse.json(
      { success: false, error: '删除词汇表失败' },
      { status: 500 }
    )
  }
}
