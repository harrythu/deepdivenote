'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  Users,
  FileText,
  Upload,
  LayoutTemplate,
  BookOpen,
  UserPlus,
  TrendingUp,
  BarChart3,
  Lock,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react'

interface StatsData {
  totals: {
    users: number
    anonymousUses: number
    summaries: number
    meetings: number
    templates: number
    vocabularies: number
  }
  recent7Days: {
    users: number
    summaries: number
    meetings: number
  }
  topUsers: {
    rank: number
    email: string
    name: string | null
    summaryCount: number
  }[]
}

export default function AdminDashboard() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<StatsData | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await fetch('/api/admin/stats')
      if (res.status === 401) {
        setIsLoggedIn(false)
        toast.error('登录已过期，请重新登录')
        return
      }
      const data = await res.json()
      if (data.success) {
        setStats(data.data)
      } else {
        toast.error(data.error || '获取统计数据失败')
      }
    } catch {
      toast.error('网络错误，请稍后重试')
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isLoggedIn) {
      fetchStats()
    }
  }, [isLoggedIn, fetchStats])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) {
      toast.error('请输入密码')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (data.success) {
        setIsLoggedIn(true)
        setPassword('')
        toast.success('登录成功')
      } else {
        toast.error(data.error || '登录失败')
      }
    } catch {
      toast.error('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  // 登录表单
  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">管理员登录</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="请输入管理员密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    登录中...
                  </>
                ) : (
                  '登录'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 统计面板
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* 页面标题 */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">管理员统计面板</h1>
          <p className="mt-1 text-sm text-gray-500">
            DeepDiveNote 平台数据概览
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStats}
          disabled={statsLoading}
        >
          {statsLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <TrendingUp className="h-4 w-4" />
          )}
          刷新数据
        </Button>
      </div>

      {statsLoading && !stats ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : stats ? (
        <>
          {/* 累计统计卡片 */}
          <div className="mb-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              累计统计
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                icon={<Users className="h-5 w-5 text-blue-600" />}
                label="注册用户数"
                value={stats.totals.users}
                bgColor="bg-blue-50"
              />
              <StatCard
                icon={<Eye className="h-5 w-5 text-gray-600" />}
                label="匿名使用次数"
                value={stats.totals.anonymousUses}
                bgColor="bg-gray-50"
              />
              <StatCard
                icon={<FileText className="h-5 w-5 text-green-600" />}
                label="纪要生成次数"
                value={stats.totals.summaries}
                bgColor="bg-green-50"
              />
              <StatCard
                icon={<Upload className="h-5 w-5 text-purple-600" />}
                label="文件上传数量"
                value={stats.totals.meetings}
                bgColor="bg-purple-50"
              />
              <StatCard
                icon={<LayoutTemplate className="h-5 w-5 text-orange-600" />}
                label="纪要模板数量"
                value={stats.totals.templates}
                bgColor="bg-orange-50"
              />
              <StatCard
                icon={<BookOpen className="h-5 w-5 text-teal-600" />}
                label="常用词模板数量"
                value={stats.totals.vocabularies}
                bgColor="bg-teal-50"
              />
            </div>
          </div>

          {/* 近7天统计卡片 */}
          <div className="mb-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              近 7 天
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                icon={<UserPlus className="h-5 w-5 text-indigo-600" />}
                label="新注册用户"
                value={stats.recent7Days.users}
                bgColor="bg-indigo-50"
              />
              <StatCard
                icon={<BarChart3 className="h-5 w-5 text-emerald-600" />}
                label="纪要生成次数"
                value={stats.recent7Days.summaries}
                bgColor="bg-emerald-50"
              />
              <StatCard
                icon={<TrendingUp className="h-5 w-5 text-rose-600" />}
                label="文件上传数量"
                value={stats.recent7Days.meetings}
                bgColor="bg-rose-50"
              />
            </div>
          </div>

          {/* Top 100 用户表格 */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              Top 100 用户（按纪要生成数量）
            </h2>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50/80">
                        <th className="px-4 py-3 text-left font-medium text-gray-600">
                          排名
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">
                          邮箱
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">
                          姓名
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">
                          纪要数量
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topUsers.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-4 py-8 text-center text-gray-400"
                          >
                            暂无数据
                          </td>
                        </tr>
                      ) : (
                        stats.topUsers.map((user) => (
                          <tr
                            key={user.email}
                            className="border-b last:border-b-0 hover:bg-gray-50/50"
                          >
                            <td className="px-4 py-3 text-gray-500">
                              {user.rank <= 3 ? (
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-100 text-xs font-bold text-yellow-700">
                                  {user.rank}
                                </span>
                              ) : (
                                user.rank
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-gray-700">
                              {user.email}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {user.name || '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">
                              {user.summaryCount}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  bgColor,
}: {
  icon: React.ReactNode
  label: string
  value: number
  bgColor: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${bgColor}`}
        >
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        </div>
      </CardContent>
    </Card>
  )
}
