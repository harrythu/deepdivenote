import { NextResponse } from 'next/server'
import {
  verifyAdminPassword,
  createAdminSession,
  ADMIN_SESSION_COOKIE,
} from '@/lib/auth/admin'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { password } = body

    if (!password) {
      return NextResponse.json(
        { success: false, error: '请输入密码' },
        { status: 400 }
      )
    }

    const isValid = verifyAdminPassword(password)
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: '密码错误' },
        { status: 401 }
      )
    }

    const token = await createAdminSession()

    const response = NextResponse.json({ success: true })

    response.cookies.set(
      ADMIN_SESSION_COOKIE.name,
      token,
      ADMIN_SESSION_COOKIE.options
    )

    return response
  } catch (error) {
    console.error('管理员登录失败:', error)
    return NextResponse.json(
      { success: false, error: '登录失败，请稍后重试' },
      { status: 500 }
    )
  }
}
