/**
 * Fun-ASR API 测试脚本
 *
 * 运行方式:
 * npm run test:qwen
 */

import 'dotenv/config'

const QWEN_API_KEY = process.env.QWEN_API_KEY
const TEST_AUDIO_URL = 'https://dashscope.oss-cn-beijing.aliyuncs.com/samples/audio/paraformer/hello_world_female2.wav'

async function testFunASR() {
  console.log('🧪 测试 Fun-ASR API\n')

  if (!QWEN_API_KEY || QWEN_API_KEY === 'your_qwen_api_key_here') {
    console.error('❌ QWEN_API_KEY 未配置！')
    process.exit(1)
  }

  console.log('✅ API Key 已配置')
  console.log(`   Key: ${QWEN_API_KEY.substring(0, 10)}...`)

  // 提交任务
  console.log('\n📤 步骤 1: 提交 Fun-ASR 转写任务...')

  const submitUrl = 'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription'

  const payload = {
    model: 'fun-asr',
    input: {
      file_urls: [TEST_AUDIO_URL],  // Fun-ASR 使用 file_urls 数组
    },
    parameters: {
      channel_id: [0],
      diarization_enabled: true,    // 测试说话人分离
    },
  }

  console.log(`   音频URL: ${TEST_AUDIO_URL}`)
  console.log(`   Payload: ${JSON.stringify(payload, null, 2)}`)

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

    // 查询任务（Fun-ASR 查询接口使用 POST）
    console.log('\n📥 步骤 2: 轮询任务状态（POST 方式）...')

    const queryUrl = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`
    let attempts = 0
    const maxAttempts = 60 // 最多查询60次（2分钟）

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000))

      const queryResponse = await fetch(queryUrl, {
        method: 'POST',  // Fun-ASR 查询使用 POST
        headers: {
          'Authorization': `Bearer ${QWEN_API_KEY}`,
        },
      })

      const queryData = await queryResponse.json()
      const status = queryData.output?.task_status

      console.log(`   [${attempts + 1}/${maxAttempts}] 状态: ${status}`)

      if (status === 'SUCCEEDED') {
        console.log('\n✅ 转写任务完成!')
        console.log('\n任务响应:')
        console.log(JSON.stringify(queryData, null, 2))

        // 下载转写结果
        const results = queryData.output?.results || []
        for (const result of results) {
          if (result.subtask_status === 'SUCCEEDED' && result.transcription_url) {
            console.log(`\n📄 下载转写结果: ${result.transcription_url}`)

            const transcriptionResponse = await fetch(result.transcription_url)
            const transcriptionData = await transcriptionResponse.json()

            console.log('\n📝 转写结果 JSON:')
            console.log(JSON.stringify(transcriptionData, null, 2))

            if (transcriptionData.transcripts?.[0]) {
              const t = transcriptionData.transcripts[0]
              console.log('\n📄 完整文本:', t.text)
              console.log('\n🕐 分句（含时间戳）:')
              t.sentences?.forEach((s: any) => {
                const ts = `${String(Math.floor(s.begin_time / 60000)).padStart(2,'0')}:${String(Math.floor((s.begin_time % 60000) / 1000)).padStart(2,'0')}`
                const speakerInfo = s.speaker_id !== undefined ? ` [发言人${s.speaker_id}]` : ''
                console.log(`  ${ts}${speakerInfo} ${s.text}`)
              })
            }
          } else if (result.subtask_status === 'FAILED') {
            console.error(`❌ 子任务失败: ${result.code} - ${result.message}`)
          }
        }

        process.exit(0)
      }

      if (status === 'FAILED') {
        console.error('\n❌ 任务失败!')
        console.error(JSON.stringify(queryData, null, 2))
        process.exit(1)
      }

      attempts++
    }

    console.log('\n⚠️  任务仍在处理中，已查询60次')
    console.log(`   可手动查询: POST ${queryUrl}`)

  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  }
}

testFunASR()
