import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/db/prisma'

export async function GET() {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json(
      { success: false, error: '未授权访问' },
      { status: 401 }
    )
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // 并行执行所有统计查询
    const [
      totalUsers,
      anonymousUses,
      totalSummaries,
      totalMeetings,
      totalTemplates,
      totalVocabularies,
      recentUsers,
      recentSummaries,
      recentMeetings,
      topUsers,
    ] = await Promise.all([
      // 累计统计
      prisma.user.count(),
      prisma.meeting.count({ where: { userId: null } }),
      prisma.summary.count(),
      prisma.meeting.count(),
      prisma.userTemplate.count(),
      prisma.userVocabulary.count(),

      // 近7天统计
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.summary.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.meeting.count({ where: { createdAt: { gte: sevenDaysAgo } } }),

      // Top 100 用户（按纪要生成数量排序）
      prisma.user.findMany({
        select: {
          email: true,
          name: true,
          _count: {
            select: {
              meetings: {
                where: {
                  summary: { isNot: null },
                },
              },
            },
          },
        },
        orderBy: {
          meetings: {
            _count: 'desc',
          },
        },
        take: 100,
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        totals: {
          users: totalUsers,
          anonymousUses: anonymousUses,
          summaries: totalSummaries,
          meetings: totalMeetings,
          templates: totalTemplates,
          vocabularies: totalVocabularies,
        },
        recent7Days: {
          users: recentUsers,
          summaries: recentSummaries,
          meetings: recentMeetings,
        },
        topUsers: topUsers.map((u, i) => ({
          rank: i + 1,
          email: u.email,
          name: u.name,
          summaryCount: u._count.meetings,
        })),
      },
    })
  } catch (error) {
    console.error('获取统计数据失败:', error)
    return NextResponse.json(
      { success: false, error: '获取统计数据失败' },
      { status: 500 }
    )
  }
}
