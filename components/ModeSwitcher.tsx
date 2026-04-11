'use client'

import { useMode } from '@/lib/context/mode-context'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function ModeSwitcher() {
  const { mode, setMode, isAuthenticated, userApiKey } = useMode()

  const handleSwitchToInternal = () => {
    if (!isAuthenticated) {
      toast.error('请先登录后再使用蚂蚁内部版')
      window.location.href = '/login'
      return
    }
    setMode('internal')
    if (!userApiKey) {
      toast.warning('切换成功，但您尚未配置 Theta API KEY，部分功能可能无法使用')
    } else {
      toast.success('已切换到蚂蚁内部版')
    }
  }

  const handleSwitchToExternal = () => {
    setMode('external')
    toast.success('已切换到外部版')
  }

  if (mode === 'external') {
    return (
      <Button
        onClick={handleSwitchToInternal}
        size="sm"
        className="bg-blue-600 hover:bg-blue-700 text-white"
      >
        切换到蚂蚁内部版
      </Button>
    )
  }

  return (
    <Button
      onClick={handleSwitchToExternal}
      size="sm"
      className="text-white border border-white/30 hover:border-white/50"
      style={{
        backgroundColor: 'oklch(0.45 0.18 250)',
      }}
    >
      切换到外部版
    </Button>
  )
}
