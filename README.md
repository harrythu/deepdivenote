# DeepDiveNote - AI 会议录音转写系统

一个现代化的会议录音转写和纪要生成工具，利用大语言模型自动将长达 6 小时的会议录音转换为结构化的逐字稿和会议纪要。

## 特性

- **音频转写**: 支持多种音频格式（MP3, WAV, M4A, AAC, FLAC, OGG），最长支持 6 小时
- **文字稿上传**: 支持直接上传 .txt, .md, .docx, .pdf 格式的文字稿
- **智能纪要**: 自动提取关键要点、待办事项和参与者信息
- **实时进度**: Server-Sent Events (SSE) 实时推送处理进度
- **后台处理**: BullMQ 任务队列，支持长时间音频处理
- **云端存储**: 阿里云 OSS 存储音频文件
- **Docker 部署**: 一键启动所有服务
- **用户系统**: 支持用户注册登录，管理个人模板和词汇

## 技术栈

- **前端**: Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- **UI 组件**: shadcn/ui
- **数据库**: PostgreSQL 16 + Prisma 6 ORM
- **任务队列**: BullMQ + Redis 7
- **AI 服务**:
  - 阿里云通义千问 ASR (语音转文字)
  - OpenAI GPT (文字稿纠错 + 纪要生成)
- **存储**: 阿里云 OSS

## 前置要求

- Docker 和 Docker Compose
- 阿里云账号 (OSS + 通义千问 API)
- OpenAI API Key

---

## 阿里云服务器部署指南

### 一、服务器选购建议

| 配置项 | 推荐规格 |
|--------|----------|
| CPU | 2 核以上 |
| 内存 | 4 GB 以上 |
| 系统盘 | 40 GB SSD |
| 数据盘 | 100 GB SSD（可选，用于数据备份） |
| 操作系统 | Ubuntu 22.04 LTS 或 CentOS 8 |

### 二、域名准备

1. 在阿里云购买域名（如 `mydeepdive.cn`）
2. 申请 SSL 证书（免费 DV 证书）
3. 配置 DNS 解析，指向服务器 IP

### 三、部署步骤

#### 1. 连接服务器

```bash
ssh root@你的服务器IP
```

#### 2. 安装 Docker 和 Docker Compose

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh
systemctl start docker
systemctl enable docker

# 安装 Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

#### 3. 上传项目文件

在本地项目目录执行：

```bash
# 打包项目（排除 node_modules 和 .next）
tar --exclude='node_modules' --exclude='.next' --exclude='.git' -czvf deepdivenote.tar.gz .

# 上传到服务器
scp deepdivenote.tar.gz root@你的服务器IP:/root/
```

在服务器上解压：

```bash
cd /root
tar -xzvf deepdivenote.tar.gz
mv deepdivenote /var/www/deepdivenote
```

#### 4. 配置 SSL 证书

```bash
# 创建证书目录
mkdir -p /var/www/deepdivenote/deploy/ssl

# 上传 SSL 证书到服务器（将证书文件上传到此目录）
# 需要以下两个文件：
# - www.yourdomain.com.pem  (证书公钥)
# - www.yourdomain.com.key  (证书私钥)
```

#### 5. 配置环境变量

```bash
cd /var/www/deepdivenote
cp .env.production.example .env
nano .env
```

填写以下配置：

```env
# 数据库（使用 docker-compose 自带的 PostgreSQL）
DATABASE_URL="postgresql://deepdivenote:your_secure_password@postgres:5432/deepdivenote"

# Redis（使用 docker-compose 自带的 Redis）
REDIS_URL="redis://redis:6379"

# 阿里云通义千问 ASR（用于音频转写）
QWEN_API_KEY="sk-xxxxxxxxxxxxxxxxxxxx"

# ZenMux OpenAI API（用于纪要生成和纠错）
ZENMUX_API_KEY="sk-xxxxxxxxxxxxxxxxxxxx"

# 阿里云 OSS（用于存储音频文件）
ALIYUN_ACCESS_KEY_ID="LTAI5txxxxxxxxxxxxxxxx"
ALIYUN_ACCESS_KEY_SECRET="xxxxxxxxxxxxxxxxxxxxxxxx"
ALIYUN_OSS_REGION="oss-cn-beijing"
ALIYUN_OSS_BUCKET="your-bucket-name"
ALIYUN_OSS_ENDPOINT="oss-cn-beijing.aliyuncs.com"
```

#### 6. 配置 Nginx

编辑 `/var/www/deepdivenote/deploy/nginx.conf`，将 `mydeepdive.cn` 替换为你的域名：

```bash
nano /var/www/deepdivenote/deploy/nginx.conf
```

将 `server_name` 替换为你的实际域名。

#### 7. 启动服务

```bash
cd /var/www/deepdivenote

# 构建并启动所有服务
docker-compose -f docker-compose.prod.yml up -d --build

# 查看服务状态
docker-compose -f docker-compose.prod.yml ps

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f
```

#### 8. 初始化数据库

```bash
# 进入 app 容器执行 Prisma 命令
docker exec -it deepdivenote-app npx prisma db push
```

#### 9. 配置防火墙

```bash
# 开放端口
ufw allow 22    # SSH
ufw allow 80     # HTTP
ufw allow 443    # HTTPS
ufw enable
```

### 四、验证部署

访问 `https://你的域名`，应该能看到应用首页。

### 五、日常维护

```bash
# 查看所有服务状态
docker-compose -f docker-compose.prod.yml ps

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f

# 重启所有服务
docker-compose -f docker-compose.prod.yml restart

# 更新部署
cd /var/www/deepdivenote
git pull
docker-compose -f docker-compose.prod.yml up -d --build

# 备份数据库
docker exec deepdivenote-postgres pg_dump -U deepdivenote deepdivenote > backup_$(date +%Y%m%d).sql
```

---

## 本地开发

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

### 3. 启动依赖服务

```bash
docker-compose up -d postgres redis
```

### 4. 初始化数据库

```bash
npx prisma db push
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

---

## 项目结构

```
deepdivenote/
├── app/                      # Next.js App Router
│   ├── page.tsx             # 首页（上传页面）
│   ├── meetings/            # 会议详情页面
│   ├── settings/            # 设置页面（词汇、模板）
│   ├── history/             # 历史记录页面
│   └── api/                 # API 路由
│       ├── upload/          # 文件上传
│       ├── text-upload/     # 文字稿上传
│       ├── meetings/        # 会议数据
│       └── templates/       # 模板管理
├── components/
│   ├── ui/                  # shadcn/ui 组件
│   └── auth/                # 认证组件
├── hooks/
│   └── useAuth.ts           # 认证 hook
├── lib/
│   ├── db/
│   │   └── prisma.ts        # Prisma 客户端
│   ├── services/
│   │   ├── summary-gpt.ts   # OpenAI 纪要生成服务
│   │   └── qwen-asr.ts      # 通义千问 ASR 服务
│   └── auth/                # 认证相关
├── prisma/
│   └── schema.prisma        # 数据库模型
├── deploy/                   # 部署配置文件
│   ├── nginx.conf           # Nginx 配置
│   ├── deploy.sh            # 部署脚本
│   └── *.service            # systemd 服务文件
├── docker-compose.yml        # 本地开发 Docker 配置
├── docker-compose.prod.yml   # 生产环境 Docker 配置
├── Dockerfile.app            # Next.js 应用镜像
└── Dockerfile.worker         # Worker 镜像
```

---

## 阿里云 OSS 数据备份方案

### 方案概述

用户上传的音频文件存储在阿里云 OSS，数据库存储在服务器本地 PostgreSQL。

### 备份策略建议

#### 1. OSS 数据备份

**方式一：OSS 跨区域复制**
- 在 OSS 控制台配置跨区域复制规则
- 自动将数据复制到另一个地域的 bucket
- 适合异地容灾

**方式二：定期备份到本地**
```bash
# 使用 ossutil 同步数据到本地
./ossutil cp oss://your-bucket/ local-backup/ --recursive --parallel=10

# 配合 cron 定时执行
0 2 * * * /path/to/ossutil cp oss://your-bucket/ /backup/oss/ --recursive
```

**方式三：OSS 生命周期管理**
- 配置冷存储策略，将历史数据自动转为低频访问
- 降低存储成本

#### 2. 数据库备份

**方式一：定期 SQL 导出**
```bash
# 每日凌晨 3 点备份
0 3 * * * docker exec deepdivenote-postgres pg_dump -U deepdivenote deepdivenote > /backup/db_$(date +\%Y\%m%d).sql
```

**方式二：上传备份到 OSS**
```bash
# 将数据库备份文件上传到 OSS
./ossutil cp /backup/db_$(date +\%Y\%m%d).sql oss://your-bucket/backups/
```

#### 3. 完整备份脚本示例

创建 `/root/backup.sh`：

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup"
OSS_BUCKET="your-bucket"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 1. 备份数据库
docker exec deepdivenote-postgres pg_dump -U deepdivenote deepdivenote > $BACKUP_DIR/db_$DATE.sql

# 2. 压缩备份
tar -czvf $BACKUP_DIR/full_backup_$DATE.tar.gz $BACKUP_DIR/db_$DATE.sql

# 3. 上传到 OSS（需要先安装 ossutil）
./ossutil cp $BACKUP_DIR/full_backup_$DATE.tar.gz oss://$OSS_BUCKET/backups/

# 4. 清理本地 7 天前的备份
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "备份完成: $DATE"
```

添加定时任务：
```bash
crontab -e
# 每日凌晨 3 点执行备份
0 3 * * * /root/backup.sh >> /var/log/backup.log 2>&1
```

#### 4. 恢复数据

```bash
# 从 OSS 下载备份
./ossutil cp oss://your-bucket/backups/full_backup_20240101_030000.tar.gz /tmp/

# 解压
tar -xzvf /tmp/full_backup_20240101_030000.tar.gz -C /tmp/

# 恢复数据库
cat /tmp/db_20240101_030000.sql | docker exec -i deepdivenote-postgres psql -U deepdivenote deepdivenote
```

---

## 故障排除

### Docker 磁盘空间不足

```bash
docker system prune -a -f
df -h
```

### 数据库表不存在

```bash
docker exec -it deepdivenote-app npx prisma db push
```

### 容器无法访问外网

在 `docker-compose.prod.yml` 的 app 和 worker 服务中添加 DNS 配置：

```yaml
services:
  app:
    dns:
      - 8.8.8.8
      - 114.114.114.114
```

---

## 许可证

MIT
