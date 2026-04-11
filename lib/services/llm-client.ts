import OpenAI from 'openai'
import * as fs from 'fs'
import * as path from 'path'
import { AppMode } from '@/lib/context/mode-context'

export interface ModelConfig {
  provider: string
  baseURL: string
  apiKeyEnv: string
  models: Array<{
    id: string
    name: string
    category: string
    description: string
    maxTokens: number
  }>
  default: string
  defaultMaxTokens: number
}

// 加载对应模式的配置
function loadConfig(mode: AppMode): ModelConfig {
  const configFileName = mode === 'internal'
    ? 'models-internal.json'
    : 'models-external.json'

  try {
    const configPath = path.join(process.cwd(), configFileName)
    const configContent = fs.readFileSync(configPath, 'utf-8')
    return JSON.parse(configContent)
  } catch (error) {
    console.error(`加载配置失败: ${configFileName}`, error)
    throw new Error(`无法加载 ${configFileName} 配置`)
  }
}

export interface LLMClientConfig {
  mode: AppMode
  userApiKey?: string  // 内部版需要用户提供自己的 key
}

let externalClient: OpenAI | null = null
let internalClients: Map<string, OpenAI> = new Map()

export function createLLMClient(config: LLMClientConfig): OpenAI {
  const { mode, userApiKey } = config

  if (mode === 'external') {
    // 外部版：使用系统默认 API KEY
    if (!externalClient) {
      const modelConfig = loadConfig('external')
      externalClient = new OpenAI({
        apiKey: process.env[modelConfig.apiKeyEnv] || process.env.ZENMUX_API_KEY,
        baseURL: modelConfig.baseURL,
      })
    }
    return externalClient
  } else {
    // 内部版：使用用户自己的 API KEY
    if (!userApiKey) {
      throw new Error('内部版需要配置 API KEY，请在设置中填写您的 Theta API KEY')
    }

    // 缓存用户的 client（按 API KEY 缓存）
    if (!internalClients.has(userApiKey)) {
      const modelConfig = loadConfig('internal')
      internalClients.set(userApiKey, new OpenAI({
        apiKey: userApiKey,
        baseURL: modelConfig.baseURL,
      }))
    }
    return internalClients.get(userApiKey)!
  }
}

// 获取指定模式的模型列表配置
export function getModelConfig(mode: AppMode): ModelConfig {
  return loadConfig(mode)
}

// 清除内部版客户端缓存（登出时调用）
export function clearInternalClients() {
  internalClients.clear()
}

// 获取当前模式对应的 baseURL
export function getBaseURL(mode: AppMode): string {
  const config = loadConfig(mode)
  return config.baseURL
}

// 获取当前模式对应的 provider 名称
export function getProviderName(mode: AppMode): string {
  const config = loadConfig(mode)
  return config.provider === 'zenmux' ? 'ZenMux' : 'Theta'
}
