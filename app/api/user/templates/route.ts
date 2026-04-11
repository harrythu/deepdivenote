import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireUser } from '@/lib/auth/get-user'
import { LIMITS } from '@/lib/constants/limits'
import { AppMode } from '@/lib/context/mode-context'

// 获取用户模板列表
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

    // 如果指定了模式，只返回兼容该模式的模板
    if (mode === 'internal') {
      where.availableMode = {
        in: ['INTERNAL', 'BOTH'],
      }
    } else if (mode === 'external') {
      where.availableMode = {
        in: ['EXTERNAL', 'BOTH'],
      }
    }
    // 如果没有指定模式，返回所有模板（包括两种模式都适用的）

    const templates = await prisma.userTemplate.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json({
      success: true,
      data: templates,
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

// 创建模板
export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const body = await request.json()
    const { name, description, content, category, availableMode = 'BOTH' } = body

    // 验证必填字段
    if (!name) {
      return NextResponse.json(
        { success: false, error: '模板名称不能为空' },
        { status: 400 }
      )
    }

    if (!content) {
      return NextResponse.json(
        { success: false, error: '模板内容不能为空' },
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

    // 检查模板数量限制
    const count = await prisma.userTemplate.count({
      where: {
        userId: user.id,
        isActive: true,
      },
    })

    if (count >= LIMITS.TEMPLATE_MAX_COUNT) {
      return NextResponse.json(
        { success: false, error: `最多只能创建${LIMITS.TEMPLATE_MAX_COUNT}个模板` },
        { status: 400 }
      )
    }

    // 验证模板内容字数
    if (content.length > LIMITS.TEMPLATE_MAX_LENGTH) {
      return NextResponse.json(
        { success: false, error: `模板内容不能超过${LIMITS.TEMPLATE_MAX_LENGTH}字` },
        { status: 400 }
      )
    }

    const template = await prisma.userTemplate.create({
      data: {
        userId: user.id,
        name,
        description: description || null,
        content,
        category: category || null,
        availableMode: availableMode,
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
    console.error('创建模板失败:', error)
    return NextResponse.json(
      { success: false, error: '创建模板失败' },
      { status: 500 }
    )
  }
}
