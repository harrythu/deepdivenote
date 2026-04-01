# DeepDiveNote - AI 会议录音转写系统

一个现代化的会议录音转写和纪要生成工具，利用大语言模型自动将长达 6 小时的会议录音转换为结构化的逐字稿和会议纪要。

## 特性

- **音频转写**: 支持多种音频格式（MP3, WAV, M4A, AAC, FLAC, OGG），最长支持 6 小时
- **智能纪要**: 自动提取关键要点、待办事项和参与者信息
- **实时进度**: Server-Sent Events (SSE) 实时推送处理进度
- **后台处理**: BullMQ 任务队列，支持长时间音频处理
- **云端存储**: 阿里云 OSS 存储音频文件
- **Docker 部署**: 一键启动所有服务

## 技术栈

- **前端**: Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- **UI 组件**: shadcn/ui
- **数据库**: PostgreSQL 16 + Prisma 6 ORM
- **任务队列**: BullMQ + Redis 7
- **AI 服务**:
  - 阿里云通义千问 ASR (语音转文字)
  - Anthropic Claude (会议纪要生成)
  - GPT (文字稿纠错)
- **存储**: 阿里云 OSS

## 前置要求

- Node.js 20+
- Docker 和 Docker Compose
- 阿里云账号 (OSS + 通义千问 API)
- Anthropic API Key

## 快速开始

### 1. 克隆项目并安装依赖

```bash
git clone <repo-url>
cd deepdivenote
npm install
```

### 2. 配置环境变量

复制 `.env.production.example` 到 `.env` 并填写配置:

```bash
cp .env.production.example .env
```

编辑 `.env` 文件:

```env
# 数据库
DATABASE_URL="postgresql://deepdivenote:your_password@localhost:5432/deepdivenote"

# Redis
REDIS_URL="redis://localhost:6379"

# 阿里云通义千问 ASR
QWEN_API_KEY="sk-..."

# Anthropic Claude
ANTHROPIC_API_KEY="sk-ant-..."

# 阿里云 OSS
ALIYUN_ACCESS_KEY_ID="LTAI..."
ALIYUN_ACCESS_KEY_SECRET="..."
ALIYUN_OSS_REGION="oss-cn-beijing"
ALIYUN_OSS_BUCKET="your-bucket"
ALIYUN_OSS_ENDPOINT="oss-cn-beijing.aliyuncs.com"
```

### 3. 本地开发

启动 PostgreSQL 和 Redis:

```bash
docker-compose up -d
```

初始化数据库:

```bash
npx prisma db push
```

启动开发服务器:

```bash
npm run dev
```

启动 Worker (新终端):

```bash
npm run worker
```

访问 [http://localhost:3000](http://localhost:3000)

## 生产部署 (Docker)

### 1. 服务器准备

确保服务器已安装 Docker 和 Docker Compose。

### 2. 配置环境变量

在服务器上创建 `.env` 文件，填入所有必要的环境变量。

### 3. 构建并启动

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

### 4. 初始化数据库

首次部署需要创建数据库表:

```bash
docker exec -it deepdivenote-postgres psql -U deepdivenote -d deepdivenote
```

执行 SQL 创建表（见 [prisma/schema.prisma](prisma/schema.prisma) 中的模型定义）。

### 5. 查看日志

```bash
# 查看所有服务日志
docker-compose -f docker-compose.prod.yml logs -f

# 查看特定服务
docker logs -f deepdivenote-app
docker logs -f deepdivenote-worker
```

## 项目结构

```
deepdivenote/
├── app/                      # Next.js App Router
│   ├── page.tsx             # 首页（上传页面）
│   ├── meetings/            # 会议详情页面
│   └── api/                 # API 路由
│       ├── upload/          # 文件上传
│       ├── meetings/        # 会议数据
│       └── templates/       # 模板管理
├── components/
│   ├── ui/                  # shadcn/ui 组件
│   └── FileUploader.tsx     # 文件上传组件
├── lib/
│   ├── db/
│   │   └── prisma.ts        # Prisma 客户端
│   └── services/
│       ├── oss.ts           # 阿里云 OSS 服务
│       ├── qwen-asr.ts      # 通义千问 ASR 服务
│       ├── summary.ts       # Claude 纪要生成
│       ├── correction.ts    # GPT 文字纠错
│       └── transcription-worker.ts  # 后台转写 Worker
├── prisma/
│   └── schema.prisma        # 数据库模型
├── scripts/
│   └── start-worker.ts      # Worker 启动脚本
├── docker-compose.yml       # 本地开发 Docker 配置
├── docker-compose.prod.yml  # 生产环境 Docker 配置
├── Dockerfile.app           # Next.js 应用镜像
└── Dockerfile.worker        # Worker 镜像
```

## 数据库模型

### Meeting (会议记录)

存储会议基本信息、音频文件路径、处理状态。

状态流转: `PENDING` -> `UPLOADING` -> `TRANSCRIBING` -> `SUMMARIZING` -> `COMPLETED`

### Transcription (转写结果)

存储完整逐字稿和分段数据（时间轴），包含语言检测、字数统计等元数据。

### Summary (会议纪要)

存储结构化纪要内容，包含关键要点、待办事项、参与者、标签等。

## 常用命令

```bash
# 开发
npm run dev          # 启动开发服务器
npm run worker       # 启动后台 Worker
npm run build        # 构建生产版本

# 数据库
npx prisma studio    # 打开 Prisma Studio
npx prisma db push   # 推送 schema 到数据库

# Docker (生产)
docker-compose -f docker-compose.prod.yml up -d --build   # 构建并启动
docker-compose -f docker-compose.prod.yml down            # 停止服务
docker-compose -f docker-compose.prod.yml logs -f         # 查看日志

# Docker 维护
docker system prune -a -f    # 清理未使用的资源
docker logs <container> --tail 100    # 查看最近日志
```

## 故障排除

### Docker 磁盘空间不足

```bash
docker system prune -a -f
df -h
```

### 数据库表不存在

手动连接 PostgreSQL 创建表:

```bash
docker exec -it deepdivenote-postgres psql -U deepdivenote -d deepdivenote
```

### 容器无法访问外网

在 `docker-compose.prod.yml` 中添加 DNS 配置:

```yaml
services:
  app:
    dns:
      - 8.8.8.8
      - 114.114.114.114
```

### 查看容器内环境变量

```bash
docker exec -it deepdivenote-app sh
echo $ALIYUN_ACCESS_KEY_ID
```

## 许可证

MIT
