import { redis } from '@/lib/db/redis'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'

const ADMIN_SESSION_PREFIX = 'admin_session:'
const ADMIN_SESSION_TTL = 60 * 60 * 24 // 24 hours

export const ADMIN_SESSION_COOKIE = {
  name: 'ddn_admin_session',
  options: {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: ADMIN_SESSION_TTL,
    domain: process.env.COOKIE_DOMAIN,
  },
}

export function verifyAdminPassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    console.error('ADMIN_PASSWORD 环境变量未设置')
    return false
  }
  return password === adminPassword
}

export async function createAdminSession(): Promise<string> {
  const token = randomUUID()
  const data = {
    role: 'admin',
    createdAt: Date.now(),
  }
  await redis.setex(
    `${ADMIN_SESSION_PREFIX}${token}`,
    ADMIN_SESSION_TTL,
    JSON.stringify(data)
  )
  return token
}

export async function getAdminSession(
  token: string
): Promise<{ role: string; createdAt: number } | null> {
  const data = await redis.get(`${ADMIN_SESSION_PREFIX}${token}`)
  return data ? JSON.parse(data) : null
}

export async function deleteAdminSession(token: string): Promise<void> {
  await redis.del(`${ADMIN_SESSION_PREFIX}${token}`)
}

export async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_SESSION_COOKIE.name)?.value

  if (!token) {
    throw new Error('AdminUnauthorized')
  }

  const session = await getAdminSession(token)
  if (!session) {
    throw new Error('AdminUnauthorized')
  }
}
