import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { CorrectionService } from '@/lib/services/correction'
import { getFullUser } from '@/lib/auth/get-user'
import { AppMode } from '@/lib/context/mode-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/meetings/[id]/correction
 * 对会议转写文字稿进行纠错
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let appMode: AppMode = 'external'

  try {
    const { id } = await params
    const body = await req.json()
    const { topic, vocabulary, model, maxTokens, mode } = body

    // 获取当前用户（用于内部版 API KEY）
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

    // 获取会议及转写内容
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        transcription: true,
      },
    })

    if (!meeting) {
      return NextResponse.json(
        { success: false, error: '会议未找到' },
        { status: 404 }
      )
    }

    if (!meeting.transcription) {
      return NextResponse.json(
        { success: false, error: '该会议没有转写记录' },
        { status: 400 }
      )
    }

    // 获取用户的 API KEY（内部版）
    const userApiKey = currentUser?.thetaApiKey || undefined

    // 创建纠错服务实例
    const correctionService = new CorrectionService(appMode, userApiKey)

    const result = await correctionService.correct(meeting.transcription.fullText, {
      topic,
      vocabulary: vocabulary || [],
      model,
      maxTokens,
    })

    return NextResponse.json({
      success: true,
      data: {
        meetingId: id,
        correctedText: result.correctedText,
        corrections: result.corrections,
        tokensUsed: result.tokensUsed,
      },
    })
  } catch (error) {
    console.error('纠错失败:', error)

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
      { success: false, error: errorMessage || '纠错失败' },
      { status: 500 }
    )
  }
}
