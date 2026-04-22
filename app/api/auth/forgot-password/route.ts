import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { redis } from '@/lib/db/redis'
import { randomUUID } from 'crypto'
import { sendEmail, buildPasswordResetEmail } from '@/lib/email/directmail'

const RESET_TOKEN_PREFIX = 'reset_token:'
const RESET_TOKEN_TTL = 60 * 15 // 15 分钟
// 发送频率限制：同一邮箱 60 秒内只能发一次
const RATE_LIMIT_PREFIX = 'reset_ratelimit:'
const RATE_LIMIT_TTL = 60

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: '请输入邮箱地址' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()

    // 频率限制：防止短时间内重复发送
    const rateLimitKey = `${RATE_LIMIT_PREFIX}${normalizedEmail}`
    const isLimited = await redis.get(rateLimitKey)
    if (isLimited) {
      // 统一返回成功，防止用户枚举 + 给出友好提示
      return NextResponse.json({ success: true })
    }

    // 查询用户（不存在也返回成功，防止邮箱枚举攻击）
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, name: true },
    })

    if (user) {
      // 生成 token 并存入 Redis
      const token = randomUUID()
      await redis.setex(
        `${RESET_TOKEN_PREFIX}${token}`,
        RESET_TOKEN_TTL,
        user.id
      )

      // 构建重置链接
      const appUrl = process.env.APP_URL || 'https://mydeepdive.cn'
      const resetUrl = `${appUrl}/reset-password?token=${token}`

      // 发送邮件
      await sendEmail({
        to: user.email,
        subject: '【DeepDiveNote】重置您的登录密码',
        htmlBody: buildPasswordResetEmail(resetUrl),
      })
    }

    // 设置频率限制
    await redis.setex(rateLimitKey, RATE_LIMIT_TTL, '1')

    // 无论用户是否存在，统一返回成功
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('发送重置密码邮件失败:', error)
    return NextResponse.json(
      { success: false, error: '发送失败，请稍后重试' },
      { status: 500 }
    )
  }
}
