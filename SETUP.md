# 环境配置指南

本文档将指导您完成 DeepDiveNote 项目的完整环境配置。

## 📋 前置要求检查清单

在开始之前，请确保您已安装以下软件：

- [ ] Node.js 18+ 和 npm
- [ ] Docker Desktop (Mac/Windows) 或 Docker Engine (Linux)
- [ ] Git
- [ ] 代码编辑器（推荐 VS Code）

## 1️⃣ 安装 Docker

### macOS

1. 下载 [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/)
2. 安装并启动 Docker Desktop
3. 验证安装：

```bash
docker --version
docker compose version
```

### Windows

1. 下载 [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
2. 启动 WSL2（Docker Desktop 会提示）
3. 安装并启动 Docker Desktop
4. 验证安装：

```bash
docker --version
docker compose version
```

### Linux (Ubuntu/Debian)

```bash
# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 添加当前用户到 docker 组
sudo usermod -aG docker $USER

# 安装 Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin

# 重新登录以使组权限生效
```

## 2️⃣ 获取 API Keys

### OpenAI API Key (Whisper)

1. 访问 [OpenAI Platform](https://platform.openai.com/)
2. 注册/登录账号
3. 前往 [API Keys 页面](https://platform.openai.com/api-keys)
4. 点击 "Create new secret key"
5. 复制并保存 API Key（格式：`sk-...`）
6. **重要**: 确保账户有余额（至少 $5），可在 [Billing 页面](https://platform.openai.com/account/billing) 充值

### Anthropic API Key (Claude)

1. 访问 [Anthropic Console](https://console.anthropic.com/)
2. 注册/登录账号
3. 前往 [API Keys](https://console.anthropic.com/settings/keys)
4. 点击 "Create Key"
5. 复制并保存 API Key（格式：`sk-ant-...`）
6. **重要**: 确保账户有余额，可在 Billing 页面充值

## 3️⃣ 项目设置步骤

### Step 1: 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 使用编辑器打开 .env 文件
code .env  # 或使用你喜欢的编辑器
```

编辑 `.env` 文件，填入您的 API Keys：

```env
# ========================================
# Database Configuration
# ========================================
DATABASE_URL="postgresql://deepdivenote:deepdivenote_dev_password@localhost:5432/deepdivenote?schema=public"

# ========================================
# Redis Configuration
# ========================================
REDIS_URL="redis://localhost:6379"

# ========================================
# AI Service API Keys (必须填写)
# ========================================
OPENAI_API_KEY="sk-proj-..."        # 👈 填入您的 OpenAI API Key
ANTHROPIC_API_KEY="sk-ant-..."     # 👈 填入您的 Anthropic API Key

# ========================================
# Application Settings
# ========================================
PORT=3000
MAX_FILE_SIZE=2147483648  # 2GB
UPLOAD_DIR="./uploads"

# ========================================
# Optional: Feature Flags
# ========================================
DEBUG=false
ENABLE_EXPERIMENTAL_FEATURES=false
```

### Step 2: 启动 Docker 服务

```bash
# 启动 PostgreSQL 和 Redis（后台运行）
docker compose up -d

# 查看服务状态
docker compose ps

# 预期输出：
# NAME                        IMAGE               STATUS
# deepdivenote-postgres       postgres:16-alpine  Up
# deepdivenote-redis          redis:7-alpine      Up
```

### Step 3: 初始化数据库

```bash
# 运行数据库迁移（创建表结构）
npx prisma migrate dev --name init

# 生成 Prisma Client
npx prisma generate
```

### Step 4: 创建上传目录

```bash
# 创建音频文件上传目录
mkdir -p uploads
```

### Step 5: 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 🎉

## 4️⃣ 验证环境

### 检查 Docker 服务

```bash
# 查看日志
docker compose logs -f

# 测试 PostgreSQL 连接
docker exec -it deepdivenote-postgres psql -U deepdivenote -c "SELECT version();"

# 测试 Redis 连接
docker exec -it deepdivenote-redis redis-cli ping
# 预期输出: PONG
```

### 检查数据库

```bash
# 打开 Prisma Studio 可视化管理数据库
npx prisma studio
```

在浏览器中访问 [http://localhost:5555](http://localhost:5555)，您应该能看到 `meetings`, `transcriptions`, `summaries` 三张表。

### 检查 API Keys

创建测试文件 `test-api-keys.js`:

```javascript
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

async function testKeys() {
  try {
    // 测试 OpenAI
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const models = await openai.models.list();
    console.log('✅ OpenAI API Key 有效');

    // 测试 Anthropic
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    });
    console.log('✅ Anthropic API Key 有效');
  } catch (error) {
    console.error('❌ API Key 验证失败:', error.message);
  }
}

testKeys();
```

运行测试：

```bash
node test-api-keys.js
```

## 🐛 常见问题

### Docker 服务无法启动

**问题**: `Error: Cannot connect to the Docker daemon`

**解决**:
1. 确保 Docker Desktop 正在运行
2. 检查 Docker 图标是否在系统托盘中
3. 尝试重启 Docker Desktop

---

**问题**: `port is already allocated`

**解决**:
```bash
# 查看端口占用
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :3000  # Next.js

# 杀死占用进程或修改 docker-compose.yml 中的端口映射
```

### Prisma 迁移失败

**问题**: `P1001: Can't reach database server`

**解决**:
1. 确保 Docker 服务正在运行：`docker compose ps`
2. 检查 .env 中的 `DATABASE_URL` 是否正确
3. 尝试重启数据库：
   ```bash
   docker compose restart postgres
   ```

---

**问题**: `P3005: Database 'deepdivenote' does not exist`

**解决**:
```bash
# 手动创建数据库
docker exec -it deepdivenote-postgres psql -U deepdivenote -c "CREATE DATABASE deepdivenote;"
```

### API Key 错误

**问题**: `401 Unauthorized` 或 `Invalid API Key`

**解决**:
1. 检查 `.env` 文件中的 API Key 是否正确（没有多余空格/引号）
2. 确认账户有足够余额
3. 检查 API Key 权限设置

---

**问题**: `API key not found`

**解决**:
```bash
# 确保 .env 文件存在
ls -la .env

# 重启开发服务器以加载新的环境变量
npm run dev
```

## 📊 资源监控

### Docker 资源使用

```bash
# 查看容器资源使用情况
docker stats

# 查看磁盘使用
docker system df
```

### 数据库大小

```bash
# 进入 PostgreSQL
docker exec -it deepdivenote-postgres psql -U deepdivenote -d deepdivenote

# 查询数据库大小
SELECT pg_size_pretty(pg_database_size('deepdivenote'));

# 查询表大小
SELECT
  table_name,
  pg_size_pretty(pg_total_relation_size(quote_ident(table_name)))
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC;
```

## 🧹 清理命令

### 停止服务

```bash
# 停止 Docker 服务
docker compose down

# 停止并删除卷（⚠️ 会清空数据）
docker compose down -v
```

### 清理开发数据

```bash
# 清理 Next.js 缓存
rm -rf .next

# 清理 node_modules（如需重新安装）
rm -rf node_modules package-lock.json
npm install
```

## 🚀 下一步

环境配置完成后，您可以：

1. 查看 [README.md](README.md) 了解项目功能
2. 查看 [prisma/schema.prisma](prisma/schema.prisma) 了解数据模型
3. 开始开发文件上传功能（参考计划文档）
4. 阅读 Next.js 官方文档学习 App Router

---

**如有其他问题，请提交 GitHub Issue 或查看项目文档。**
