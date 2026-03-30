# DeepDiveNote - AI 会议录音转写系统

一个现代化的会议录音转写和纪要生成工具，利用大语言模型自动将长达 6 小时的会议录音转换为结构化的逐字稿和会议纪要。

## ✨ 特性

- 🎙️ **音频转写**: 支持多种音频格式（MP3, WAV, M4A 等），最长支持 6 小时
- 📝 **智能纪要**: 自动提取关键要点、待办事项和参与者信息
- ⚡ **实时进度**: Server-Sent Events (SSE) 实时推送处理进度
- 🎨 **现代 UI**: 基于 shadcn/ui 的清爽界面
- 🔄 **后台处理**: BullMQ 任务队列，支持长时间音频处理
- 🐳 **Docker 部署**: 一键启动所有服务
- 🔌 **可扩展**: 抽象层设计，未来可切换到本地模型

## 🏗️ 技术栈

- **前端**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **UI 组件**: shadcn/ui
- **数据库**: PostgreSQL 16 + Prisma ORM
- **任务队列**: BullMQ + Redis
- **AI 服务**:
  - OpenAI Whisper API (语音转文字)
  - Anthropic Claude 3.5 Sonnet (会议纪要生成)

## 📋 前置要求

- Node.js 18+
- Docker 和 Docker Compose
- OpenAI API Key
- Anthropic API Key

## 🚀 快速开始

### 1. 克隆项目并安装依赖

```bash
# 安装依赖
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并填写您的 API Keys:

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入您的 API Keys:

```env
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
```

### 3. 启动 Docker 服务

启动 PostgreSQL 和 Redis:

```bash
docker-compose up -d
```

查看服务状态:

```bash
docker-compose ps
```

### 4. 初始化数据库

运行 Prisma 迁移创建数据库表:

```bash
npx prisma migrate dev --name init
```

生成 Prisma Client:

```bash
npx prisma generate
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 🎉

## 📁 项目结构

```
deepdivenote/
├── app/                      # Next.js App Router
│   ├── page.tsx             # 首页（上传页面）
│   ├── meetings/            # 会议详情页面
│   └── api/                 # API 路由
│       ├── upload/          # 文件上传
│       ├── transcribe/      # 转写处理
│       └── summarize/       # 纪要生成
├── components/
│   ├── ui/                  # shadcn/ui 组件
│   ├── FileUploader.tsx     # 文件上传组件
│   ├── ProgressTracker.tsx  # 进度跟踪组件
│   └── TranscriptViewer.tsx # 逐字稿查看器
├── lib/
│   ├── db/
│   │   └── prisma.ts        # Prisma 客户端
│   ├── services/
│   │   ├── transcription.ts # 转写服务抽象层
│   │   └── summary.ts       # 摘要服务抽象层
│   ├── queue/               # BullMQ 任务队列配置
│   └── types/               # TypeScript 类型定义
├── prisma/
│   └── schema.prisma        # 数据库模型
├── docker-compose.yml       # Docker 服务配置
└── .env                     # 环境变量（不提交到 Git）
```

## 🗄️ 数据库模型

### Meeting (会议记录)

- 存储会议基本信息、音频文件路径、处理状态
- 状态流转: `PENDING` → `UPLOADING` → `TRANSCRIBING` → `SUMMARIZING` → `COMPLETED`

### Transcription (转写结果)

- 存储完整逐字稿和分段数据（时间轴）
- 包含语言检测、字数统计、置信度等元数据

### Summary (会议纪要)

- 存储结构化纪要内容
- 包含关键要点、待办事项、参与者、标签等

详细模型定义见 [prisma/schema.prisma](prisma/schema.prisma)

## 🔧 可用命令

```bash
# 开发
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run start        # 启动生产服务器

# 数据库
npx prisma studio    # 打开 Prisma Studio 可视化管理数据库
npx prisma migrate dev    # 创建新的迁移
npx prisma db push        # 直接推送 schema 到数据库（开发环境）

# Docker
docker-compose up -d      # 启动服务
docker-compose down       # 停止服务
docker-compose logs -f    # 查看日志
```

## 📊 API 使用成本估算

基于 MVP 阶段每天处理 10 小时音频的估算：

| 服务 | 用量 | 单价 | 日成本 | 月成本 |
|------|------|------|--------|--------|
| OpenAI Whisper | 600 分钟/天 | $0.006/分钟 | $3.60 | $108 |
| Claude 3.5 Sonnet | ~100K tokens/天 | $3/M input + $15/M output | $0.33 | $10 |
| **总计** | - | - | **$3.93** | **$118** |

### 成本优化建议

1. **后期切换到本地 Whisper 模型**: 可降低 90%+ 转写成本
2. **批量处理**: 合并多个短音频减少 API 调用次数
3. **缓存策略**: 相同音频文件避免重复转写

## 🛠️ 开发路线图

### ✅ MVP (Week 1-4)

- [x] 项目初始化和技术栈搭建
- [x] 数据库设计和服务抽象层
- [ ] 文件上传功能
- [ ] Whisper API 集成
- [ ] 实时进度推送 (SSE)
- [ ] 逐字稿展示页面
- [ ] Claude API 集成
- [ ] 会议纪要生成和展示
- [ ] 历史记录列表

### 🔜 V2 (用户系统)

- [ ] 用户认证和授权 (NextAuth.js)
- [ ] 多用户数据隔离
- [ ] 团队共享功能

### 🚀 V3 (高级功能)

- [ ] 音频播放器同步高亮
- [ ] 说话人识别 (Speaker Diarization)
- [ ] 实时转写 (流式处理)
- [ ] 导出为 PDF

### 🏢 V4 (本地化部署)

- [ ] 自部署 Whisper 模型
- [ ] 集成本地 LLM (Llama 3)
- [ ] GPU 加速支持

## 🐛 故障排除

### Docker 服务无法启动

```bash
# 检查端口占用
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis

# 重置 Docker 服务
docker-compose down -v
docker-compose up -d
```

### Prisma 迁移失败

```bash
# 重置数据库 (⚠️ 会清空所有数据)
npx prisma migrate reset

# 手动创建数据库
docker exec -it deepdivenote-postgres psql -U deepdivenote -c "CREATE DATABASE deepdivenote;"
```

### API Key 配置问题

确保 `.env` 文件中的 API Keys 正确填写，且没有多余的引号或空格：

```env
# ❌ 错误
OPENAI_API_KEY='sk-...'

# ✅ 正确
OPENAI_API_KEY=sk-...
```

## 📝 许可证

MIT

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📧 联系方式

如有问题，请通过 GitHub Issues 联系。

---

**Built with ❤️ using Next.js, Prisma, and Claude**
