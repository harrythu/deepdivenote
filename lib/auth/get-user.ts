import { cookies } from 'next/headers'
import { getSession, SESSION_COOKIE } from './session'
import { prisma } from '@/lib/db/prisma'

export interface PublicUser {
  id: string
  email: string
  name: string | null
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE.name)?.value

    if (!token) return null

    const session = await getSession(token)
    if (!session) return null

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, name: true },
    })

    return user
  } catch (error) {
    console.error('获取当前用户失败:', error)
    return null
  }
}

export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}
