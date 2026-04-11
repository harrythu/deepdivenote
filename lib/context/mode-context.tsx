'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

export type AppMode = 'external' | 'internal'
export type ThemeType = 'slate' | 'blue'

interface ModeContextValue {
  mode: AppMode
  setMode: (mode: AppMode) => void
  toggleMode: () => void
  isInternal: boolean
  theme: ThemeType
  isAuthenticated: boolean
  userApiKey: string | null
  setUserApiKey: (key: string | null) => void
}

const ModeContext = createContext<ModeContextValue | undefined>(undefined)

const STORAGE_KEY = 'deepdive-mode'

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>('external')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userApiKey, setUserApiKeyState] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  // 从 localStorage 恢复模式并标记水合完成
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'external' || stored === 'internal') {
      setModeState(stored)
    }
    setIsLoaded(true)
  }, [])

  // 从 API 获取用户信息
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.data) {
            setIsAuthenticated(true)
            // 如果用户有 thetaApiKey，存储它
            if (data.data.thetaApiKey) {
              setUserApiKeyState(data.data.thetaApiKey)
            }
            // 如果用户有偏好的模式，使用偏好
            if (data.data.preferredMode === 'INTERNAL' || data.data.preferredMode === 'EXTERNAL') {
              const modeFromServer = data.data.preferredMode.toLowerCase() as AppMode
              setModeState(modeFromServer)
              localStorage.setItem(STORAGE_KEY, modeFromServer)
            }
          }
        }
      } catch (error) {
        console.error('检查认证状态失败:', error)
      }
    }
    checkAuth()
  }, [])

  const setMode = useCallback((newMode: AppMode) => {
    // 如果切换到内部版但未登录，跳转登录
    if (newMode === 'internal' && !isAuthenticated) {
      // 存储目标模式，登录后恢复
      localStorage.setItem('deepdive-mode', 'internal')
      window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname)
      return
    }
    setModeState(newMode)
    localStorage.setItem(STORAGE_KEY, newMode)
  }, [isAuthenticated])

  const toggleMode = useCallback(() => {
    setMode(mode === 'external' ? 'internal' : 'external')
  }, [mode, setMode])

  const setUserApiKey = useCallback((key: string | null) => {
    setUserApiKeyState(key)
  }, [])

  const theme: ThemeType = mode === 'internal' ? 'blue' : 'slate'

  const value: ModeContextValue = {
    mode,
    setMode,
    toggleMode,
    isInternal: mode === 'internal',
    theme,
    isAuthenticated,
    userApiKey,
    setUserApiKey,
  }

  // 在水合完成且数据加载前，显示初始状态避免 hydration mismatch
  if (!isLoaded) {
    return (
      <ModeContext.Provider value={value}>
        <div data-mode={mode} data-theme={theme} suppressHydrationWarning>
          {children}
        </div>
      </ModeContext.Provider>
    )
  }

  return (
    <ModeContext.Provider value={value}>
      <div data-mode={mode} data-theme={theme}>
        {children}
      </div>
    </ModeContext.Provider>
  )
}

export function useMode() {
  const context = useContext(ModeContext)
  // 如果没有 provider，返回默认值（外部版）
  if (context === undefined) {
    return {
      mode: 'external' as AppMode,
      setMode: () => {},
      toggleMode: () => {},
      isInternal: false,
      theme: 'slate' as ThemeType,
      isAuthenticated: false,
      userApiKey: null,
      setUserApiKey: () => {},
    }
  }
  return context
}

// 便捷的 hook：检查是否可以访问内部版
export function useInternalAccess() {
  const { isInternal, isAuthenticated, userApiKey } = useMode()

  return {
    canUseInternal: isAuthenticated && !!userApiKey,
    needsApiKey: isInternal && !userApiKey,
  }
}
