import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

// 模板定义类型
interface Template {
  id: string
  name: string
  content: string
  category: 'expert-interview' | 'multi-meeting' | 'investor-interview' | 'user-custom'
}

// 场景分类定义
interface TemplateCategory {
  id: string
  name: string
  templates: Template[]
}

/**
 * 获取模板内容（按场景分类）
 */
export async function GET() {
  try {
    const templates: Template[] = []

    // 专家访谈场景模板
    const expertTemplates = [
      { id: 'interview', file: 'default_summary_prompt.txt', name: '专家访谈-详细版' },
      { id: 'interview-less', file: 'default_summary_less_prompt.txt', name: '专家访谈-精炼版' },
      { id: 'interview-raw', file: 'default_nosummary_prompt.txt', name: '专家访谈-原始逐字稿' },
    ]

    for (const tpl of expertTemplates) {
      try {
        const filePath = path.join(process.cwd(), tpl.file)
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8')
          templates.push({
            id: tpl.id,
            name: tpl.name,
            content,
            category: 'expert-interview'
          })
        }
      } catch (error) {
        console.error(`加载模板 ${tpl.name} 失败:`, error)
      }
    }

    // 多人会议场景模板
    try {
      const meetingPath = path.join(process.cwd(), 'default_meeting_prompt.txt')
      if (fs.existsSync(meetingPath)) {
        const content = fs.readFileSync(meetingPath, 'utf-8')
        templates.push({
          id: 'meeting',
          name: '多人会议-观点梳理',
          content,
          category: 'multi-meeting'
        })
      }
    } catch (error) {
      console.error('加载多人会议模板失败:', error)
    }

    // 投资访谈场景模板
    try {
      const investorPath = path.join(process.cwd(), 'default_investor_prompt.txt')
      if (fs.existsSync(investorPath)) {
        const content = fs.readFileSync(investorPath, 'utf-8')
        templates.push({
          id: 'investor',
          name: '创业公司访谈',
          content,
          category: 'investor-interview'
        })
      }
    } catch (error) {
      console.error('加载投资访谈模板失败:', error)
    }

    // 按场景分类组织
    const categories: TemplateCategory[] = [
      {
        id: 'expert-interview',
        name: '专家访谈',
        templates: templates.filter(t => t.category === 'expert-interview')
      },
      {
        id: 'multi-meeting',
        name: '多人会议',
        templates: templates.filter(t => t.category === 'multi-meeting')
      },
      {
        id: 'investor-interview',
        name: '投资访谈',
        templates: templates.filter(t => t.category === 'investor-interview')
      }
    ]

    return NextResponse.json({
      success: true,
      data: {
        templates,
        categories
      }
    })
  } catch (error) {
    console.error('获取模板失败:', error)
    return NextResponse.json(
      { success: false, error: '获取模板失败' },
      { status: 500 }
    )
  }
}