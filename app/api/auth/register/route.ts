import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { hashPassword } from '@/lib/auth/password'
import { createSession, SESSION_COOKIE } from '@/lib/auth/session'
import { LIMITS } from '@/lib/constants/limits'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, name } = body

    // 验证必填字段
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: '邮箱和密码不能为空' },
        { status: 400 }
      )
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: '邮箱格式不正确' },
        { status: 400 }
      )
    }

    // 验证密码长度
    if (password.length < LIMITS.PASSWORD_MIN_LENGTH) {
      return NextResponse.json(
        { success: false, error: `密码至少${LIMITS.PASSWORD_MIN_LENGTH}位` },
        { status: 400 }
      )
    }

    if (password.length > LIMITS.PASSWORD_MAX_LENGTH) {
      return NextResponse.json(
        { success: false, error: `密码最多${LIMITS.PASSWORD_MAX_LENGTH}位` },
        { status: 400 }
      )
    }

    // 检查邮箱是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: '该邮箱已被注册' },
        { status: 409 }
      )
    }

    // 哈希密码
    const passwordHash = await hashPassword(password)

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    })

    // 自动登录，创建 Session
    const userAgent = request.headers.get('user-agent') || undefined
    const token = await createSession(user.id, { userAgent })

    const response = NextResponse.json({
      success: true,
      data: user,
    })

    // 设置 Session Cookie
    response.cookies.set(
      SESSION_COOKIE.name,
      token,
      SESSION_COOKIE.options
    )

    return response
  } catch (error) {
    console.error('注册失败:', error)
    return NextResponse.json(
      { success: false, error: '注册失败，请稍后重试' },
      { status: 500 }
    )
  }
}
