/**
 * 启动转写任务Worker
 *
 * 运行方式:
 * npm run worker
 */

import 'dotenv/config'
import { getTranscriptionWorker } from '../lib/services/transcription-worker'

console.log('🚀 启动转写任务Worker...\n')

const worker = getTranscriptionWorker()

// 处理退出信号
process.on('SIGINT', () => {
  console.log('\n\n⚠️  收到退出信号，正在停止Worker...')
  worker.stop()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  收到终止信号，正在停止Worker...')
  worker.stop()
  process.exit(0)
})

// 启动Worker
worker.start().catch(error => {
  console.error('❌ Worker启动失败:', error)
  process.exit(1)
})
