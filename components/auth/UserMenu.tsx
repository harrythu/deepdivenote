'use client'

import { useAuth } from '@/hooks/useAuth'
import { User, LogOut } from 'lucide-react'

export function UserMenu() {
  const { user, isLoading, isAuthenticated, logout } = useAuth()

  const handleLogout = () => {
    console.log('Logout clicked')
    logout()
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
        <div className="w-16 h-4 bg-slate-200 animate-pulse rounded" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-3">
        <a
          href="/login"
          className="px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
        >
          登录
        </a>
        <a
          href="/register"
          className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors"
        >
          注册
        </a>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
          <User className="w-4 h-4 text-blue-600" />
        </div>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {user?.name || user?.email?.split('@')[0]}
        </span>
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
      >
        <LogOut className="w-4 h-4" />
        <span className="hidden sm:inline">退出</span>
      </button>
    </div>
  )
}
