'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { User, LogOut, Settings } from 'lucide-react'
import { useMode } from '@/lib/context/mode-context'

export function UserMenu() {
  const router = useRouter()
  const { user, isLoading, isAuthenticated, logout } = useAuth()
  const { mode: appMode } = useMode()
  const [showDropdown, setShowDropdown] = useState(false)
  const [mounted, setMounted] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 })

  // 客户端挂载后才渲染 Portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // 计算下拉菜单位置
  useEffect(() => {
    if (showDropdown && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      })
    }
  }, [showDropdown])

  const handleLogout = () => {
    console.log('【调试】handleLogout 被调用')
    setShowDropdown(false)
    logout()
  }

  const navigateTo = (path: string) => {
    console.log('【调试】navigateTo 被调用，路径:', path)
    setShowDropdown(false)
    router.push(path)
  }

  if (isLoading) {
    return (
      <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse" />
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/login')}
          className="px-3 py-1.5 text-sm text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/20 rounded-md transition-colors"
        >
          登录
        </button>
        <button
          onClick={() => router.push('/register')}
          className="px-3 py-1.5 text-sm bg-white text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
        >
          注册
        </button>
      </div>
    )
  }

  const isInternal = appMode === 'internal'

  // 下拉菜单内容
  const dropdownContent = (
    <>
      {/* 遮罩层 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
        }}
        onClick={() => {
          console.log('【调试】遮罩层被点击')
          setShowDropdown(false)
        }}
      />
      {/* 菜单 */}
      <div
        style={{
          position: 'fixed',
          top: dropdownPosition.top,
          right: dropdownPosition.right,
          zIndex: 9999,
          width: '14rem',
        }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden"
      >
        {/* 用户信息 */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
            {user?.name || user?.email?.split('@')[0]}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {user?.email}
          </p>
        </div>

        {/* 菜单项 */}
        <div className="py-1">
          <button
            type="button"
            onClick={() => {
              console.log('【调试】API KEY 按钮被点击')
              navigateTo('/settings/api-key')
            }}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            API KEY 设置
          </button>
          <button
            type="button"
            onClick={() => {
              console.log('【调试】常用词汇按钮被点击')
              navigateTo('/settings/vocabularies')
            }}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            常用词汇
          </button>
          <button
            type="button"
            onClick={() => {
              console.log('【调试】我的模板按钮被点击')
              navigateTo('/settings/templates')
            }}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
            我的模板
          </button>
        </div>

        {/* 退出登录 */}
        <div className="border-t border-slate-200 dark:border-slate-700 py-1">
          <button
            type="button"
            onClick={() => {
              console.log('【调试】退出登录按钮被点击')
              handleLogout()
            }}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* 用户头像按钮 */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          console.log('【调试】头像按钮被点击，当前状态:', showDropdown)
          setShowDropdown(!showDropdown)
        }}
        className={`
          w-10 h-10 rounded-full flex items-center justify-center transition-all
          ${isInternal
            ? 'bg-white/20 hover:bg-white/30 text-white'
            : 'bg-blue-100 hover:bg-blue-200 text-blue-600'
          }
        `}
      >
        <User className="w-5 h-5" />
      </button>

      {/* 使用 Portal 将下拉菜单渲染到 body */}
      {mounted && showDropdown && createPortal(dropdownContent, document.body)}
    </>
  )
}
