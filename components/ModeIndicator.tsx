'use client'

import { useMode } from '@/lib/context/mode-context'
import { Badge } from '@/components/ui/badge'

export function ModeIndicator() {
  const { mode, isAuthenticated, userApiKey } = useMode()

  if (mode === 'external') {
    return null
  }

  return (
    <Badge
      variant="outline"
      className="bg-blue-600/10 text-blue-600 border-blue-300 text-xs"
    >
      内部版
    </Badge>
  )
}

// 内部版模式指示器（带警告）
export function ModeAccessWarning() {
  const { mode, isAuthenticated, userApiKey } = useMode()

  if (mode === 'internal' && (!isAuthenticated || !userApiKey)) {
    return (
      <div className="w-full p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 mb-4">
        <p className="text-sm text-amber-700 dark:text-amber-300">
          {!isAuthenticated
            ? '请先登录后再使用蚂蚁内部版'
            : '请先配置您的 Theta API KEY'}
        </p>
      </div>
    )
  }

  return null
}
