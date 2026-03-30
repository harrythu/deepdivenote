/**
 * 千问ASR API 测试脚本
 *
 * 运行方式:
 * npx tsx scripts/test-qwen-api.ts
 */

import 'dotenv/config'

const QWEN_API_KEY = process.env.QWEN_API_KEY
const TEST_AUDIO_URL = 'https://dashscope.oss-cn-beijing.aliyuncs.com/audios/welcome.mp3'

async function testQwenAPI() {
  console.log('🧪 测试千问ASR API配置\n')

  // 检查API Key
  if (!QWEN_API_KEY || QWEN_API_KEY === 'your_qwen_api_key_here') {
    console.error('❌ QWEN_API_KEY 未配置！')
    console.log('\n请在 .env 文件中配置:')
    console.log('QWEN_API_KEY="sk-xxx"\n')
    console.log('获取API Key: https://dashscope.console.aliyun.com/')
    process.exit(1)
  }

  console.log('✅ API Key 已配置')
  console.log(`   Key: ${QWEN_API_KEY.substring(0, 10)}...`)

  // 测试提交任务
  console.log('\n📤 步骤 1: 提交转写任务...')

  const submitUrl = 'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription'

  const payload = {
    model: 'qwen3-asr-flash-filetrans',
    input: {
      file_url: TEST_AUDIO_URL,
    },
    parameters: {
      channel_id: [0],
      enable_itn: false,
    },
  }

  console.log(`   音频URL: ${TEST_AUDIO_URL}`)

  try {
    const response = await fetch(submitUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${QWEN_API_KEY}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('❌ 提交任务失败!')
      console.error('   状态码:', response.status)
      console.error('   响应:', JSON.stringify(data, null, 2))
      process.exit(1)
    }

    if (!data.output?.task_id) {
      console.error('❌ 未获取到任务ID!')
      console.error('   响应:', JSON.stringify(data, null, 2))
      process.exit(1)
    }

    const taskId = data.output.task_id
    console.log('✅ 任务提交成功!')
    console.log(`   任务ID: ${taskId}`)

    // 测试查询任务
    console.log('\n📥 步骤 2: 查询任务状态...')

    const queryUrl = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`
    let attempts = 0
    const maxAttempts = 30 // 最多查询30次（1分钟）

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)) // 等待2秒

      const queryResponse = await fetch(queryUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${QWEN_API_KEY}`,
        },
      })

      const queryData = await queryResponse.json()
      const status = queryData.output?.task_status

      console.log(`   [${attempts + 1}/${maxAttempts}] 状态: ${status}`)

      if (status === 'SUCCEEDED') {
        console.log('\n✅ 转写任务完成!')
        console.log('\n完整结果:')
        console.log(JSON.stringify(queryData, null, 2))

        // 下载转写结果
        const transcriptionUrl = queryData.output?.result?.transcription_url || queryData.output?.url

        if (transcriptionUrl) {
          console.log(`\n📄 转写结果URL: ${transcriptionUrl}`)
          console.log('\n正在下载转写结果...')

          try {
            const transcriptionResponse = await fetch(transcriptionUrl)
            const transcriptionData = await transcriptionResponse.json()

            console.log('\n📝 转写内容:')
            console.log(JSON.stringify(transcriptionData, null, 2))

            if (transcriptionData.transcripts && transcriptionData.transcripts.length > 0) {
              const text = transcriptionData.transcripts[0].text
              console.log('\n📄 转写文本:')
              console.log(text)
            }
          } catch (error) {
            console.error('下载转写结果失败:', error)
          }
        }

        process.exit(0)
      }

      if (status === 'FAILED' || status === 'UNKNOWN') {
        console.error('\n❌ 任务失败!')
        console.error(JSON.stringify(queryData, null, 2))
        process.exit(1)
      }

      attempts++
    }

    console.log('\n⚠️  任务仍在处理中，已查询30次')
    console.log('   您可以稍后访问以下URL查询结果:')
    console.log(`   ${queryUrl}`)

  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  }
}

testQwenAPI()
