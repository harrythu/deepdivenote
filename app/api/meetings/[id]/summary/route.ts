import { NextRequest, NextResponse } from 'next/server'
import { SummaryService } from '@/lib/services/summary-gpt'
import { prisma } from '@/lib/db/prisma'
import { getFullUser } from '@/lib/auth/get-user'
import { MeetingStatus, Prisma } from '@prisma/client'
import { AppMode } from '@/lib/context/mode-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/meetings/[id]/summary
 * 获取可用的提示词模板列表
 */
export async function GET(req: NextRequest) {
  try {
    const summaryService = new SummaryService()
    const templates = summaryService.getTemplates()

    return NextResponse.json({
      success: true,
      data: { templates },
    })
  } catch (error) {
    console.error('获取模板列表失败:', error)
    return NextResponse.json(
      { success: false, error: '获取模板列表失败' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/meetings/[id]/summary
 * 生成会议纪要
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let appMode: AppMode = 'external'

  try {
    const { id } = await params
    const body = await req.json()
    const {
      transcription,
      template = 'interview',
      customPrompt,
      model,
      maxTokens,
      mode,
    } = body

    console.log('【纪要API】接收到的模式:', mode, '模型参数:', model, 'maxTokens:', maxTokens)

    if (!transcription) {
      return NextResponse.json(
        { success: false, error: '请提供转写文字稿' },
        { status: 400 }
      )
    }

    // 获取当前用户
    const currentUser = await getFullUser()

    // 确定使用的模式
    appMode = mode === 'internal' ? 'internal' : 'external'

    // 如果是内部版但未登录，返回错误
    if (appMode === 'internal' && !currentUser) {
      return NextResponse.json(
        { success: false, error: '内部版需要登录后才能使用' },
        { status: 401 }
      )
    }

    // 如果用户已登录，关联会议与用户
    if (currentUser) {
      await prisma.meeting.update({
        where: { id },
        data: { userId: currentUser.id },
      }).catch(() => {
        // 忽略错误，可能会议已有关联
      })
    }

    // 获取用户的 API KEY（内部版）
    const userApiKey = currentUser?.thetaApiKey || undefined

    // 创建纪要服务实例
    const summaryService = new SummaryService(appMode, userApiKey)

    // 如果选择自定义模板，使用用户提供的提示词
    let templateId = template
    if (template === 'custom' && customPrompt) {
      templateId = `custom_${Date.now()}`
      // 在用户提供的提示词前添加前缀
      const fullPrompt = `基于{{transcription}}形成一篇会议纪要，并且要求：\n\n${customPrompt}`
      summaryService.addTemplate(templateId, fullPrompt, false) // 自定义模板输出 Markdown
    }

    const result = await summaryService.generateSummary(transcription, {
      template: templateId,
      model,
      maxTokens,
    })

    // 保存纪要到数据库
    const summary = await prisma.summary.upsert({
      where: { meetingId: id },
      update: {
        content: result.content,
        keyPoints: result.keyPoints,
        actionItems: result.actionItems as unknown as Prisma.InputJsonValue,
        participants: result.participants,
        tags: result.tags,
        model: model || 'default',
      },
      create: {
        meetingId: id,
        content: result.content,
        keyPoints: result.keyPoints,
        actionItems: result.actionItems as unknown as Prisma.InputJsonValue,
        participants: result.participants,
        tags: result.tags,
        model: model || 'default',
      },
    })

    // 更新会议状态为已完成
    await prisma.meeting.update({
      where: { id },
      data: { status: MeetingStatus.COMPLETED },
    }).catch(() => {
      // 忽略错误
    })

    // 如果用户已登录，更新历史记录中的纪要信息
    if (currentUser) {
      const now = new Date()
      await prisma.meetingHistory.upsert({
        where: { meetingId: id },
        update: {
          summaryDate: now,
          summaryTime: now,
          summaryContent: result.content,
        },
        create: {
          meetingId: id,
          uploadDate: now,
          uploadTime: now,
          fileName: '未知文件',
          summaryDate: now,
          summaryTime: now,
          summaryContent: result.content,
        },
      }).catch((error) => {
        console.error('更新历史记录失败:', error)
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        meetingId: id,
        id: summary.id,
        ...result,
      },
    })
  } catch (error) {
    console.error('生成纪要失败:', error)

    // 检查是否是超时错误（使用正则表达式匹配多种超时变体）
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorMessageLower = errorMessage.toLowerCase()
    const isTimeout = errorMessageLower.includes('timeout') ||
                      errorMessageLower.includes('time out') ||
                      errorMessageLower.includes('timed out') ||
                      errorMessage.includes('AbortError') ||
                      errorMessage.includes('ECONNRESET') ||
                      errorMessage.includes('socket hang up')

    // 如果是内部版且超时，返回特定错误提示
    if (appMode === 'internal' && isTimeout) {
      return NextResponse.json(
        { success: false, error: 'INTERNAL_TIMEOUT', message: '目前蚂蚁内部版无法工作，请检查：1、您是否处于蚂蚁内网或者开启内网VPN；2、您配置的Theta API key是否有效' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { success: false, error: errorMessage || '生成纪要失败' },
      { status: 500 }
    )
  }
}
