import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

interface ModelConfig {
  id: string
  name: string
  provider: string
  description: string
}

interface ModelsJson {
  models: ModelConfig[]
  default: string
}

export async function GET() {
  try {
    const configPath = path.join(process.cwd(), 'models.json')
    const content = fs.readFileSync(configPath, 'utf-8')
    const config: ModelsJson = JSON.parse(content)

    return NextResponse.json({
      success: true,
      data: {
        models: config.models,
        default: config.default,
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