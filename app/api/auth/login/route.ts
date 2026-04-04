import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifyPassword } from '@/lib/auth/password'
import { createSession, SESSION_COOKIE } from '@/lib/auth/session'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    // 验证必填字段
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: '邮箱和密码不能为空' },
        { status: 400 }
      )
    }

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: '邮箱或密码错误' },
        { status: 401 }
      )
    }

    // 检查用户是否激活
    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: '账户已被禁用' },
        { status: 403 }
      )
    }

    // 验证密码
    const isValid = await verifyPassword(password, user.passwordHash)
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: '邮箱或密码错误' },
        { status: 401 }
      )
    }

    // 更新最后登录时间
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    // 创建 Session
    const userAgent = request.headers.get('user-agent') || undefined
    const token = await createSession(user.id, { userAgent })

    const response = NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    })

    // 设置 Session Cookie
    response.cookies.set(
      SESSION_COOKIE.name,
      token,
      SESSION_COOKIE.options
    )

    return response
  } catch (error) {
    console.error('登录失败:', error)
    return NextResponse.json(
      { success: false, error: '登录失败，请稍后重试' },
      { status: 500 }
    )
  }
}
