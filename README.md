# DeepDiveNote

AI 驱动的会议录音转写与纪要生成工具，支持长达 6 小时的录音，自动生成结构化逐字稿和会议纪要。

## 功能

- **音频转写**：支持 MP3、WAV、M4A、AAC、FLAC、OGG，最长 6 小时，基于阿里云通义千问 ASR
- **文字稿上传**：支持直接上传 .txt、.md、.docx、.pdf 格式
- **文字纠错**：基于大模型对转写稿进行智能纠错，支持自定义词汇表
- **纪要生成**：多种模板（逐字稿、精炼版、投资人版），支持自定义提示词
- **模型选择**：转写纠错和纪要生成均可独立选择模型
- **用户系统**：注册登录，管理个人词汇表和提示词模板

## 技术栈

- **前端**：Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- **数据库**：PostgreSQL 16 + Prisma 6
- **AI 服务**：阿里云通义千问 ASR + ZenMux API（纠错/纪要）
- **存储**：阿里云 OSS

## 本地开发

### 前置要求

- Node.js 20+
- Docker & Docker Compose
- 阿里云账号（OSS + 通义千问 API Key）
- ZenMux API Key

### 1. 克隆并安装依赖

```bash
git clone https://github.com/harrythu/deepdivenote.git
cd deepdivenote
npm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```env
# 数据库
DATABASE_URL="postgresql://deepdivenote:deepdivenote_dev_password@localhost:5432/deepdivenote"

# Redis
REDIS_URL="redis://localhost:6379"

# 阿里云通义千问 ASR
QWEN_API_KEY="sk-xxxxxxxxxxxxxxxxxxxx"

# ZenMux API（纪要生成 + 纠错）
ZENMUX_API_KEY="sk-xxxxxxxxxxxxxxxxxxxx"

# 阿里云 OSS
ALIYUN_ACCESS_KEY_ID="LTAI5txxxxxxxxxxxxxxxx"
ALIYUN_ACCESS_KEY_SECRET="xxxxxxxxxxxxxxxxxxxxxxxx"
ALIYUN_OSS_REGION="oss-cn-beijing"
ALIYUN_OSS_BUCKET="your-bucket-name"
ALIYUN_OSS_ENDPOINT="oss-cn-beijing.aliyuncs.com"
```

### 3. 启动数据库

```bash
docker compose up -d postgres redis
```

### 4. 初始化数据库

```bash
npx prisma migrate deploy
# 或首次开发时：
npx prisma db push
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

## 项目结构

```
deepdivenote/
├── app/
│   ├── page.tsx                  # 首页（转写 + 纠错 + 纪要）
│   ├── history/                  # 历史记录
│   ├── settings/                 # 词汇表 & 模板管理
│   └── api/
│       ├── upload/               # 音频上传 & 提交千问任务
│       ├── text-upload/          # 文字稿上传
│       ├── meetings/
│       │   ├── poll/             # 轮询千问转写结果
│       │   └── [id]/
│       │       ├── correction/   # 文字纠错
│       │       └── summary/      # 纪要生成
│       ├── vocabulary/           # 系统词汇表
│       ├── user/vocabularies/    # 用户词汇表
│       ├── templates/            # 系统提示词模板
│       ├── user/templates/       # 用户提示词模板
│       └── models/               # 可用模型列表
├── components/                   # UI 组件
├── lib/
│   ├── db/prisma.ts
│   └── services/
│       ├── qwen-asr.ts           # 通义千问 ASR
│       ├── correction.ts         # 文字纠错服务
│       └── summary-gpt.ts        # 纪要生成服务
├── prisma/schema.prisma
├── models.json                   # 可用模型配置
├── default_summary_prompt.txt    # 纪要模板（逐字稿）
├── default_summary_less_prompt.txt # 纪要模板（精炼版）
├── default_investor_prompt.txt   # 纪要模板（投资人）
├── default_correct_prompt.txt    # 纠错提示词
├── voca-model.txt                # 系统词汇：大模型常用词汇
├── voca-llm.txt                  # 系统词汇：大模型技术词汇
├── voca-techstrategy.txt         # 系统词汇：技术战略词汇
└── voca-aiorg.txt                # 系统词汇：大模型关键组织与人物
```

## 许可证

MIT
