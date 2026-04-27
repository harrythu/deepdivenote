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

## Live Conference (v2)

Real-time conference assistant integrated into DeepDiveNote at `/live`. Captures microphone audio, transcribes locally via GLM-ASR-Nano, and provides an AI copilot powered by a local LLM — all on-device, zero cloud dependency.

### Architecture

```
DeepDiveNote (/live)  ←──Socket.IO──→  conference-ai backend (port 3456)
                                            │
                                     ┌──────┼──────┐
                                     ▼      ▼      ▼
                                  ffmpeg  GLM-ASR  Ollama
                                  (mic)   (STT)   (LLM)
```

The `/live` page is a Next.js client component that connects to a separate conference-ai backend via Socket.IO. The backend handles audio capture, transcription, and LLM interaction. When a session ends, the transcript can be exported into DeepDive for cloud-grade summarization and permanent storage.

### Prerequisites (Live Conference only)

| Dependency | Purpose | Install |
|------------|---------|---------|
| **ffmpeg** | Microphone audio capture | `brew install ffmpeg` |
| **Ollama** | Local LLM (analysis engine) | [ollama.com](https://ollama.com), then `ollama pull gemma4:e4b` |
| **Python 3.9+** | GLM-ASR server runtime | System Python or pyenv |
| **mlx-audio** | Local speech-to-text (Apple Silicon) | `pip install mlx-audio` |
| **fastapi + uvicorn** | ASR server framework | `pip install fastapi uvicorn soundfile numpy` |
| **Node.js 18+** | Conference-ai backend | Already required by DeepDiveNote |

### Setup

```bash
# 1. Clone the conference-ai backend (sibling directory)
git clone https://github.com/zhentianashen-tech/conference-ai.git ../conference-assistant
cd ../conference-assistant
npm install

# 2. Configure the backend
cp .env.example .env
# Edit .env — set your LLM backend:
#   Option A (local): MOONSHOT_API_KEY=ollama / ANALYSIS_MODEL=gemma4:e4b / ANALYSIS_BASE_URL=http://localhost:11434/v1
#   Option B (cloud): MOONSHOT_API_KEY=sk-your-key / ANALYSIS_MODEL=kimi-k2.5

# 3. Install ASR dependencies
pip install mlx-audio fastapi uvicorn soundfile numpy
```

### Running

```bash
# Terminal 1: GLM-ASR server (local speech-to-text)
HF_HUB_OFFLINE=1 python3 conference-assistant/scripts/glm-asr-server.py

# Terminal 2: Conference-ai backend
cd conference-assistant && npm start

# Terminal 3: DeepDiveNote
cd deepdivenote && npm run dev
```

Open **http://localhost:3000/live**

### Configuration

The conference-ai backend is configured via `conference-assistant/.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `MOONSHOT_API_KEY` | — | LLM API key (set to `ollama` for local) |
| `ANALYSIS_MODEL` | `kimi-k2.5` | LLM model (`gemma4:e4b` for Ollama) |
| `ANALYSIS_BASE_URL` | `https://api.moonshot.cn/v1` | LLM endpoint (`http://localhost:11434/v1` for Ollama) |
| `ASR_PROVIDER` | `glm-local` | ASR backend: `glm-local` / `openai` / `qwen` |
| `GLM_ASR_MODEL` | `mlx-community/GLM-ASR-Nano-2512-4bit` | Local ASR model (Apple Silicon, ~300MB) |
| `GLM_ASR_PORT` | `8765` | ASR server port |
| `AUDIO_DEVICE` | `:0` | Microphone device (`npm run devices` to list) |
| `UI_PORT` | `3456` | Conference-ai web UI / Socket.IO port |

DeepDiveNote connects to the conference-ai backend via:

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_CONFERENCE_WS_URL` | `http://localhost:3456` | Conference-ai Socket.IO endpoint |

### LLM Backend Options

| Backend | Local? | Config |
|---------|--------|--------|
| **Ollama** | Yes | `ANALYSIS_BASE_URL=http://localhost:11434/v1`, `MOONSHOT_API_KEY=ollama`, `ANALYSIS_MODEL=gemma4:e4b` |
| **Kimi/Moonshot** | No | `ANALYSIS_BASE_URL=https://api.moonshot.cn/v1`, `MOONSHOT_API_KEY=sk-...`, `ANALYSIS_MODEL=kimi-k2.5` |
| **LM Studio** | Yes | `ANALYSIS_BASE_URL=http://localhost:1234/v1`, `MOONSHOT_API_KEY=lm-studio` |
| **OpenRouter** | No | `ANALYSIS_BASE_URL=https://openrouter.ai/api/v1`, `MOONSHOT_API_KEY=sk-or-...` |

### Export to DeepDive

When a live session ends, click **Export to DeepDive** to send the transcript to DeepDiveNote's cloud pipeline for summarization (Claude/GPT), vocabulary correction, and permanent storage. The transcript is posted to `/api/text-upload` and appears in the user's history.

## 许可证

MIT
