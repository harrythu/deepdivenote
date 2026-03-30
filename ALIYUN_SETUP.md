# 阿里云服务配置指南

本文档将指导您完成阿里云 OSS 和千问 ASR API 的配置。

## 📋 前置要求

- 阿里云账号
- 已完成实名认证

## 1️⃣ 开通阿里云 OSS

### 步骤 1: 创建 Bucket

1. 访问 [阿里云 OSS 控制台](https://oss.console.aliyun.com/)
2. 点击"创建 Bucket"
3. 配置 Bucket:
   ```
   Bucket 名称: deepdivenote (或其他名称)
   地域: 华东1（杭州）(推荐)
   存储类型: 标准存储
   读写权限: 公共读 (重要！千问API需要公网访问)
   ```
4. 点击"确定"创建

### 步骤 2: 获取访问凭证

1. 访问 [RAM 访问控制](https://ram.console.aliyun.com/)
2. 左侧菜单选择"用户" → 点击"创建用户"
3. 设置用户名: `deepdivenote-api`
4. 访问方式: 勾选"OpenAPI 调用访问"
5. 点击"确定"
6. **重要**: 保存显示的 AccessKey ID 和 AccessKey Secret（只显示一次）

### 步骤 3: 授予 OSS 权限

1. 在用户列表找到刚创建的用户，点击"添加权限"
2. 选择权限: `AliyunOSSFullAccess`（OSS完全访问权限）
3. 点击"确定"

---

## 2️⃣ 开通千问 ASR API

### 步骤 1: 开通灵积服务

1. 访问 [阿里云灵积控制台](https://dashscope.console.aliyun.com/)
2. 首次访问需要开通服务，点击"立即开通"
3. 阅读并同意服务协议

### 步骤 2: 获取 API Key

1. 进入控制台后，点击右上角头像
2. 选择"API-KEY 管理"
3. 点击"创建新的 API-KEY"
4. **重要**: 保存显示的 API Key（格式类似: `sk-xxx`）

### 步骤 3: 查看配额和定价

1. 访问 [千问定价页面](https://help.aliyun.com/zh/dashscope/developer-reference/tongyi-qianwen-metering-and-billing)
2. 新用户通常有免费额度
3. ASR 计费方式:
   - 按音频时长计费
   - 约 ¥0.02/分钟（具体以官网为准）

---

## 3️⃣ 配置项目环境变量

编辑 `.env` 文件，填入以下信息：

```env
# ========================================
# 阿里云 OSS 配置
# ========================================
ALIYUN_ACCESS_KEY_ID="你的AccessKey ID"
ALIYUN_ACCESS_KEY_SECRET="你的AccessKey Secret"
ALIYUN_OSS_REGION="oss-cn-hangzhou"
ALIYUN_OSS_BUCKET="deepdivenote"
ALIYUN_OSS_ENDPOINT="oss-cn-hangzhou.aliyuncs.com"

# ========================================
# AI Service API Keys
# ========================================
# 阿里云通义千问 ASR API
QWEN_API_KEY="你的千问API Key"
QWEN_API_URL="https://dashscope.aliyuncs.com/api/v1/services/audio/asr"
```

### 配置说明

| 配置项 | 说明 | 示例 |
|--------|------|------|
| ALIYUN_ACCESS_KEY_ID | RAM 用户的 AccessKey ID | `LTAI5t...` |
| ALIYUN_ACCESS_KEY_SECRET | RAM 用户的 AccessKey Secret | `iW8x...` |
| ALIYUN_OSS_REGION | OSS 地域 | `oss-cn-hangzhou` |
| ALIYUN_OSS_BUCKET | Bucket 名称 | `deepdivenote` |
| ALIYUN_OSS_ENDPOINT | OSS 访问域名 | `oss-cn-hangzhou.aliyuncs.com` |
| QWEN_API_KEY | 千问 API Key | `sk-xxx` |

---

## 4️⃣ 验证配置

### 测试 OSS 连接

创建测试文件 `test-oss.js`:

```javascript
const OSS = require('ali-oss')

const client = new OSS({
  region: 'oss-cn-hangzhou',
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
  bucket: process.env.ALIYUN_OSS_BUCKET,
})

async function test() {
  try {
    const result = await client.list({ 'max-keys': 1 })
    console.log('✅ OSS连接成功！')
    console.log('Bucket:', result.name)
  } catch (error) {
    console.error('❌ OSS连接失败:', error.message)
  }
}

test()
```

运行测试:
```bash
node test-oss.js
```

### 测试千问 API

创建测试文件 `test-qwen.js`:

```javascript
async function test() {
  const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/audio/asr', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.QWEN_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen3-asr-flash-filetrans',
      input: {
        file_urls: ['https://example.com/test.mp3'], // 测试URL
      },
    }),
  })

  if (response.ok) {
    console.log('✅ 千问API连接成功！')
  } else {
    console.error('❌ 千问API连接失败:', response.status)
    console.error(await response.text())
  }
}

test()
```

运行测试:
```bash
node test-qwen.js
```

---

## 5️⃣ OSS 安全配置（可选但推荐）

### 配置防盗链

1. OSS 控制台 → 选择 Bucket → "访问控制" → "防盗链"
2. 添加白名单: 您的域名
3. 启用空 Referer 访问（允许千问API访问）

### 配置生命周期规则

自动删除旧文件以节省成本:

1. OSS 控制台 → 选择 Bucket → "基础设置" → "生命周期"
2. 创建规则:
   ```
   规则名称: auto-delete-old-files
   前缀: audio/
   文件过期时间: 30天
   ```

---

## 🔧 常见问题

### Q: OSS 上传失败，提示"NoSuchBucket"

A: 检查 Bucket 名称和地域是否正确配置

### Q: 千问API返回"InvalidApiKey"

A: 检查 API Key 是否正确，注意不要有多余空格

### Q: 文件上传到OSS后，千问API无法访问

A: 检查 Bucket 读写权限是否设置为"公共读"

### Q: 如何查看 OSS 存储用量和费用？

A: 访问 [阿里云费用中心](https://expense.console.aliyun.com/)

---

## 💰 成本估算

### OSS 存储成本 (华东1杭州)

- 标准存储: ¥0.12/GB/月
- 外网流出流量: ¥0.50/GB

示例计算（按100个会议，每个500MB）:
- 存储: 50GB × ¥0.12 = ¥6/月
- 流量: 50GB × ¥0.50 = ¥25（一次性，转写时下载）
- **总计约**: ¥31/月

### 千问 ASR 成本

- 计费方式: ¥0.02/分钟
- 示例: 每天处理10小时音频
  - 10小时 = 600分钟
  - 600 × ¥0.02 = ¥12/天
  - **月成本约**: ¥360/月

### 优化建议

1. **使用生命周期规则**: 30天后自动删除旧文件
2. **压缩音频**: 使用较低比特率（如64kbps）可减少存储和流量成本
3. **批量处理**: 合并多个短音频减少API调用次数

---

## 📚 参考文档

- [阿里云 OSS 文档](https://help.aliyun.com/zh/oss/)
- [千问 ASR API 文档](https://help.aliyun.com/zh/dashscope/developer-reference/speech-to-text-api-details)
- [灵积平台](https://dashscope.console.aliyun.com/)

---

**配置完成后，访问 http://localhost:3001/upload 开始上传音频！** 🎉
