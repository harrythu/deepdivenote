#!/bin/bash

# DeepDiveNote 开发环境快速配置脚本

set -e  # 遇到错误立即退出

echo "🚀 DeepDiveNote 开发环境配置"
echo "================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 Node.js
echo "📦 检查 Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js 未安装${NC}"
    echo "请访问 https://nodejs.org/ 下载安装"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v)${NC}"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm 未安装${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm $(npm -v)${NC}"

# 检查 Docker
echo ""
echo "🐳 检查 Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装${NC}"
    echo "请访问 https://www.docker.com/products/docker-desktop/ 下载安装"
    exit 1
fi
echo -e "${GREEN}✅ Docker $(docker -v)${NC}"

# 检查 Docker Compose
if ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose 未安装${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker Compose$(docker compose version)${NC}"

# 检查 .env 文件
echo ""
echo "📝 检查环境变量配置..."
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env 文件不存在，正在从 .env.example 复制...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ .env 文件已创建${NC}"
    echo -e "${YELLOW}⚠️  请编辑 .env 文件，填入您的 API Keys${NC}"
    echo ""
    read -p "是否现在编辑 .env 文件？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ${EDITOR:-nano} .env
    fi
else
    echo -e "${GREEN}✅ .env 文件已存在${NC}"
fi

# 检查 API Keys
echo ""
echo "🔑 检查 API Keys..."
source .env

if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "your_openai_api_key_here" ]; then
    echo -e "${RED}❌ OPENAI_API_KEY 未配置${NC}"
    API_KEY_MISSING=true
else
    echo -e "${GREEN}✅ OPENAI_API_KEY 已配置${NC}"
fi

if [ -z "$ANTHROPIC_API_KEY" ] || [ "$ANTHROPIC_API_KEY" = "your_anthropic_api_key_here" ]; then
    echo -e "${RED}❌ ANTHROPIC_API_KEY 未配置${NC}"
    API_KEY_MISSING=true
else
    echo -e "${GREEN}✅ ANTHROPIC_API_KEY 已配置${NC}"
fi

if [ "$API_KEY_MISSING" = true ]; then
    echo -e "${YELLOW}⚠️  请在 .env 文件中配置 API Keys 后再继续${NC}"
    echo ""
    read -p "是否现在编辑 .env 文件？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ${EDITOR:-nano} .env
    else
        exit 1
    fi
fi

# 安装依赖
echo ""
echo "📦 安装 npm 依赖..."
npm install

# 启动 Docker 服务
echo ""
echo "🐳 启动 Docker 服务..."
docker compose up -d

# 等待数据库就绪
echo ""
echo "⏳ 等待数据库启动..."
sleep 5

# 运行数据库迁移
echo ""
echo "🗄️ 运行数据库迁移..."
npx prisma migrate dev --name init || {
    echo -e "${YELLOW}⚠️  迁移可能已存在，跳过...${NC}"
}

# 生成 Prisma Client
echo ""
echo "🔧 生成 Prisma Client..."
npx prisma generate

# 创建上传目录
echo ""
echo "📁 创建上传目录..."
mkdir -p uploads

echo ""
echo "================================"
echo -e "${GREEN}✅ 开发环境配置完成！${NC}"
echo ""
echo "🎉 接下来的步骤："
echo "  1. 启动开发服务器: npm run dev"
echo "  2. 访问 http://localhost:3000"
echo "  3. 打开 Prisma Studio: npx prisma studio"
echo ""
echo "📚 查看文档:"
echo "  - README.md: 项目概览"
echo "  - SETUP.md: 详细配置指南"
echo ""
