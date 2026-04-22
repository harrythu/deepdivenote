import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { redis } from '@/lib/db/redis'
import { hashPassword } from '@/lib/auth/password'

const RESET_TOKEN_PREFIX = 'reset_token:'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { token, newPassword } = body

    if (!token || !newPassword) {
      return NextResponse.json(
        { success: false, error: '参数不完整' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: '新密码不能少于 6 位' },
        { status: 400 }
      )
    }

    if (newPassword.length > 100) {
      return NextResponse.json(
        { success: false, error: '新密码不能超过 100 位' },
        { status: 400 }
      )
    }

    // 从 Redis 查找 token
    const userId = await redis.get(`${RESET_TOKEN_PREFIX}${token}`)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '重置链接已失效或已使用，请重新申请' },
        { status: 400 }
      )
    }

    // 更新密码
    const newHash = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    })

    // 立即删除 token（一次性使用）
    await redis.del(`${RESET_TOKEN_PREFIX}${token}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('重置密码失败:', error)
    return NextResponse.json(
      { success: false, error: '重置失败，请稍后重试' },
      { status: 500 }
    )
  }
}
