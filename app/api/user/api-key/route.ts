import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getFullUser, requireUser } from '@/lib/auth/get-user'

export const dynamic = 'force-dynamic'

/**
 * GET /api/user/api-key
 * 获取用户的 API KEY（脱敏显示）
 */
export async function GET() {
  try {
    const user = await getFullUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      )
    }

    // 脱敏显示 API KEY
    let maskedKey = ''
    if (user.thetaApiKey) {
      const key = user.thetaApiKey
      if (key.length > 8) {
        maskedKey = key.slice(0, 4) + '****' + key.slice(-4)
      } else {
        maskedKey = '****'
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        hasApiKey: !!user.thetaApiKey,
        maskedApiKey: maskedKey,
        preferredMode: user.preferredMode,
      },
    })
  } catch (error) {
    console.error('获取 API KEY 失败:', error)
    return NextResponse.json(
      { success: false, error: '获取失败' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/user/api-key
 * 更新用户的 API KEY
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser()
    const body = await req.json()
    const { apiKey, preferredMode } = body

    // 验证 API KEY 格式（如果提供）
    if (apiKey !== undefined) {
      if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'API KEY 不能为空' },
          { status: 400 }
        )
      }
      if (apiKey.length > 500) {
        return NextResponse.json(
          { success: false, error: 'API KEY 长度超出限制' },
          { status: 400 }
        )
      }
    }

    // 验证 preferredMode（如果提供）
    if (preferredMode !== undefined) {
      if (!['EXTERNAL', 'INTERNAL'].includes(preferredMode)) {
        return NextResponse.json(
          { success: false, error: '无效的模式值' },
          { status: 400 }
        )
      }
    }

    // 更新数据库
    const updateData: Record<string, unknown> = {}
    if (apiKey !== undefined) {
      updateData.thetaApiKey = apiKey.trim()
    }
    if (preferredMode !== undefined) {
      updateData.preferredMode = preferredMode
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        message: '更新成功',
      },
    })
  } catch (error) {
    console.error('更新 API KEY 失败:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '更新失败' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/user/api-key
 * 删除用户的 API KEY
 */
export async function DELETE() {
  try {
    const user = await requireUser()

    await prisma.user.update({
      where: { id: user.id },
      data: { thetaApiKey: null },
    })

    return NextResponse.json({
      success: true,
      data: {
        message: 'API KEY 已删除',
      },
    })
  } catch (error) {
    console.error('删除 API KEY 失败:', error)
    return NextResponse.json(
      { success: false, error: '删除失败' },
      { status: 500 }
    )
  }
}
