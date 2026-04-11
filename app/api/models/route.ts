import { NextRequest, NextResponse } from 'next/server'
import { getModelConfig, ModelConfig } from '@/lib/services/llm-client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode') || 'external'

    // 验证 mode 参数
    if (mode !== 'external' && mode !== 'internal') {
      return NextResponse.json(
        { success: false, error: '无效的模式参数' },
        { status: 400 }
      )
    }

    // 根据模式加载对应的配置
    const config: ModelConfig = getModelConfig(mode)

    return NextResponse.json({
      success: true,
      data: {
        models: config.models,
        default: config.default,
        provider: config.provider,
        baseURL: config.baseURL,
      },
    })
  } catch (error) {
    console.error('Failed to load models config:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load models' },
      { status: 500 }
    )
  }
}
