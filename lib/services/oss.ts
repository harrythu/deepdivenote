import OSS from 'ali-oss'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'

/**
 * 阿里云OSS服务
 * 用于上传音频文件到公网可访问的存储
 */
export class AliyunOSSService {
  private client: OSS

  constructor() {
    this.client = new OSS({
      region: process.env.ALIYUN_OSS_REGION || 'oss-cn-hangzhou',
      accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
      accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
      bucket: process.env.ALIYUN_OSS_BUCKET || 'deepdivenote',
    })
  }

  /**
   * 上传文件到OSS
   * @param file 文件Buffer或路径
   * @param originalFilename 原始文件名
   * @returns 公网可访问的URL
   */
  async uploadFile(
    file: Buffer | string,
    originalFilename: string
  ): Promise<{ url: string; key: string }> {
    try {
      // 生成唯一的文件key
      const ext = path.extname(originalFilename)
      const timestamp = Date.now()
      const uuid = uuidv4().split('-')[0]
      const key = `audio/${timestamp}-${uuid}${ext}`

      // 上传到OSS
      const result = await this.client.put(key, file)

      // 返回公网URL
      return {
        url: result.url,
        key: result.name,
      }
    } catch (error) {
      console.error('OSS上传失败:', error)
      throw new Error(`文件上传失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 删除OSS文件
   * @param key 文件key
   */
  async deleteFile(key: string): Promise<void> {
    try {
      await this.client.delete(key)
    } catch (error) {
      console.error('OSS删除文件失败:', error)
      throw new Error(`文件删除失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 获取文件签名URL（临时访问链接）
   * @param key 文件key
   * @param expires 过期时间（秒），默认1小时
   * @returns 签名URL
   */
  async getSignedUrl(key: string, expires: number = 3600): Promise<string> {
    try {
      const url = this.client.signatureUrl(key, {
        expires,
      })
      return url
    } catch (error) {
      console.error('生成签名URL失败:', error)
      throw new Error(`生成签名URL失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 检查文件是否存在
   * @param key 文件key
   * @returns 是否存在
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      await this.client.head(key)
      return true
    } catch (error) {
      return false
    }
  }
}

// 导出单例
export const ossService = new AliyunOSSService()
