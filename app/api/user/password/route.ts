import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/get-user'
import { verifyPassword, hashPassword } from '@/lib/auth/password'
import { prisma } from '@/lib/db/prisma'

export async function POST(request: Request) {
  try {
    const user = await requireUser()

    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: '请填写所有字段' },
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

    // 从数据库获取完整用户信息（含密码哈希）
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    })

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      )
    }

    // 验证当前密码
    const isValid = await verifyPassword(currentPassword, dbUser.passwordHash)
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: '当前密码不正确' },
        { status: 401 }
      )
    }

    // 更新密码
    const newHash = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      )
    }
    console.error('修改密码失败:', error)
    return NextResponse.json(
      { success: false, error: '修改失败，请稍后重试' },
      { status: 500 }
    )
  }
}
