import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireUser } from '@/lib/auth/get-user'
import { LIMITS } from '@/lib/constants/limits'

type RouteParams = { params: Promise<{ id: string }> }

// 获取单个模板
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await requireUser()
    const { id } = await params

    const template = await prisma.userTemplate.findFirst({
      where: {
        id,
        userId: user.id,
        isActive: true,
      },
    })

    if (!template) {
      return NextResponse.json(
        { success: false, error: '模板不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: template,
    })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      )
    }
    console.error('获取模板失败:', error)
    return NextResponse.json(
      { success: false, error: '获取模板失败' },
      { status: 500 }
    )
  }
}

// 更新模板
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await requireUser()
    const { id } = await params
    const body = await request.json()
    const { name, description, content, category, sortOrder } = body

    // 检查模板是否存在且属于当前用户
    const existing = await prisma.userTemplate.findFirst({
      where: {
        id,
        userId: user.id,
        isActive: true,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '模板不存在' },
        { status: 404 }
      )
    }

    // 验证模板内容字数
    if (content !== undefined && content.length > LIMITS.TEMPLATE_MAX_LENGTH) {
      return NextResponse.json(
        { success: false, error: `模板内容不能超过${LIMITS.TEMPLATE_MAX_LENGTH}字` },
        { status: 400 }
      )
    }

    const template = await prisma.userTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(content !== undefined && { content }),
        ...(category !== undefined && { category }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    })

    return NextResponse.json({
      success: true,
      data: template,
    })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      )
    }
    console.error('更新模板失败:', error)
    return NextResponse.json(
      { success: false, error: '更新模板失败' },
      { status: 500 }
    )
  }
}

// 删除模板（软删除）
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await requireUser()
    const { id } = await params

    const existing = await prisma.userTemplate.findFirst({
      where: {
        id,
        userId: user.id,
        isActive: true,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '模板不存在' },
        { status: 404 }
      )
    }

    await prisma.userTemplate.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({
      success: true,
      message: '模板已删除',
    })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      )
    }
    console.error('删除模板失败:', error)
    return NextResponse.json(
      { success: false, error: '删除模板失败' },
      { status: 500 }
    )
  }
}
