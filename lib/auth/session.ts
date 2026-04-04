import { redis } from '@/lib/db/redis'
import { randomUUID } from 'crypto'

const SESSION_PREFIX = 'session:'
const USER_SESSIONS_PREFIX = 'user_sessions:'
const SESSION_TTL = 60 * 60 * 24 * 7 // 7 days

export interface SessionData {
  userId: string
  createdAt: number
  userAgent?: string
  ip?: string
}

export async function createSession(
  userId: string,
  meta?: { userAgent?: string; ip?: string }
): Promise<string> {
  const token = randomUUID()
  const data: SessionData = {
    userId,
    createdAt: Date.now(),
    ...meta,
  }

  await Promise.all([
    redis.setex(`${SESSION_PREFIX}${token}`, SESSION_TTL, JSON.stringify(data)),
    redis.sadd(`${USER_SESSIONS_PREFIX}${userId}`, token),
  ])

  return token
}

export async function getSession(token: string): Promise<SessionData | null> {
  const data = await redis.get(`${SESSION_PREFIX}${token}`)
  return data ? JSON.parse(data) : null
}

export async function deleteSession(token: string): Promise<void> {
  const session = await getSession(token)
  if (session) {
    await Promise.all([
      redis.del(`${SESSION_PREFIX}${token}`),
      redis.srem(`${USER_SESSIONS_PREFIX}${session.userId}`, token),
    ])
  }
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  const tokens = await redis.smembers(`${USER_SESSIONS_PREFIX}${userId}`)
  if (tokens.length > 0) {
    const pipeline = redis.pipeline()
    pipeline.del(...tokens.map(t => `${SESSION_PREFIX}${t}`))
    pipeline.del(`${USER_SESSIONS_PREFIX}${userId}`)
    await pipeline.exec()
  }
}

export const SESSION_COOKIE = {
  name: 'ddn_session',
  options: {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL,
    domain: process.env.COOKIE_DOMAIN,
  },
}
