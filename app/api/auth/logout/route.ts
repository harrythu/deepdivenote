import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { deleteSession, SESSION_COOKIE } from '@/lib/auth/session'

export async function POST() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE.name)?.value

    if (token) {
      await deleteSession(token)
    }

    const response = NextResponse.json({
      success: true,
      message: '已退出登录',
    })

    // 清除 Session Cookie
    response.cookies.set(
      SESSION_COOKIE.name,
      '',
      {
        ...SESSION_COOKIE.options,
        maxAge: 0,
      }
    )

    return response
  } catch (error) {
    console.error('退出登录失败:', error)
    return NextResponse.json(
      { success: false, error: '退出登录失败' },
      { status: 500 }
    )
  }
}
