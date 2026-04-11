import { NextResponse } from 'next/server'
import { getFullUser } from '@/lib/auth/get-user'

export async function GET() {
  try {
    const user = await getFullUser()

    if (!user) {
      return NextResponse.json({
        success: false,
        error: '未登录',
      }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      data: user,
    })
  } catch (error) {
    console.error('获取用户信息失败:', error)
    return NextResponse.json(
      { success: false, error: '获取用户信息失败' },
      { status: 500 }
    )
  }
}
