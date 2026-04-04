'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export interface User {
  id: string
  email: string
  name: string | null
}

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  })
  const router = useRouter()

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      if (data.success && data.data) {
        setState({
          user: data.data,
          isLoading: false,
          isAuthenticated: true,
        })
      } else {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        })
      }
    } catch {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      })
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const login = async (email: string, password: string): Promise<void> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!data.success) {
      throw new Error(data.error || '登录失败')
    }
    setState({
      user: data.data,
      isLoading: false,
      isAuthenticated: true,
    })
  }

  const register = async (email: string, password: string, name?: string): Promise<void> => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })
    const data = await res.json()
    if (!data.success) {
      throw new Error(data.error || '注册失败')
    }
    setState({
      user: data.data,
      isLoading: false,
      isAuthenticated: true,
    })
  }

  const logout = async (): Promise<void> => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (e) {
      console.error('Logout API error:', e)
    }
    // 使用 location.replace 替换当前页面历史，避免回退
    window.location.replace('/')
  }

  return {
    ...state,
    login,
    register,
    logout,
    refresh: fetchUser,
  }
}
