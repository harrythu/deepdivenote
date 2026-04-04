import { NextRequest, NextResponse } from 'next/server'
import 'server-only'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function parseFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase()
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
    return buffer.toString('utf-8')
  }

  if (fileName.endsWith('.docx')) {
    const mammoth = await import('mammoth')
    const result = await mammoth.default.extractRawText({ buffer })
    return result.value
  }

  if (fileName.endsWith('.pdf')) {
    // 使用 pdfjs-dist 解析 PDF
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const loadingTask = pdfjs.getDocument({ data: buffer })
    const pdf = await loadingTask.promise

    let text = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item: any) => item.str)
        .join(' ')
      text += pageText + '\n'
    }
    return text
  }

  throw new Error('不支持的文件格式')
}

/**
 * 解析文件内容
 * 支持 .txt, .md, .docx, .pdf
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: '未找到文件' },
        { status: 400 }
      )
    }

    const text = await parseFile(file)

    return NextResponse.json({
      success: true,
      data: {
        text,
        fileName: file.name,
      },
    })
  } catch (error) {
    console.error('文件解析失败:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '文件解析失败' },
      { status: 500 }
    )
  }
}