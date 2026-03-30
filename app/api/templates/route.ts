import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

/**
 * 获取模板内容
 */
export async function GET() {
  try {
    const templates: Record<string, { name: string; content: string }> = {}

    // 加载访谈纪要模板
    try {
      const interviewPath = path.join(process.cwd(), 'default_summary_prompt.txt')
      if (fs.existsSync(interviewPath)) {
        const content = fs.readFileSync(interviewPath, 'utf-8')
        templates.interview = {
          name: '访谈纪要模板',
          content: content
        }
      }
    } catch (error) {
      console.error('加载访谈纪要模板失败:', error)
    }

    // 加载会议纪要模板
    try {
      const meetingPath = path.join(process.cwd(), 'default_meeting_prompt.txt')
      if (fs.existsSync(meetingPath)) {
        const content = fs.readFileSync(meetingPath, 'utf-8')
        templates.meeting = {
          name: '会议纪要模板',
          content: content
        }
      }
    } catch (error) {
      console.error('加载会议纪要模板失败:', error)
    }

    return NextResponse.json({
      success: true,
      data: templates
    })
  } catch (error) {
    console.error('获取模板失败:', error)
    return NextResponse.json(
      { success: false, error: '获取模板失败' },
      { status: 500 }
    )
  }
}
