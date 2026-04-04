#!/bin/bash

# Docker 安装验证脚本

set -e

echo "🔍 验证 Docker Desktop 安装..."
echo "================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查 Docker 命令
echo "📦 检查 Docker 命令..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo -e "${GREEN}✅ Docker 已安装: ${DOCKER_VERSION}${NC}"
else
    echo -e "${RED}❌ Docker 命令未找到${NC}"
    echo -e "${YELLOW}请确保:${NC}"
    echo "  1. Docker Desktop 已从 Applications 文件夹启动"
    echo "  2. 状态栏中的 Docker 图标是绿色的"
    echo "  3. 重新打开终端窗口"
    exit 1
fi

# 检查 Docker Compose
echo ""
echo "🔧 检查 Docker Compose..."
if docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version)
    echo -e "${GREEN}✅ Docker Compose 已安装: ${COMPOSE_VERSION}${NC}"
else
    echo -e "${RED}❌ Docker Compose 未找到${NC}"
    exit 1
fi

# 检查 Docker 守护进程
echo ""
echo "🐳 检查 Docker 守护进程..."
if docker info &> /dev/null; then
    echo -e "${GREEN}✅ Docker 守护进程运行中${NC}"
else
    echo -e "${RED}❌ Docker 守护进程未运行${NC}"
    echo -e "${YELLOW}请启动 Docker Desktop 应用${NC}"
    exit 1
fi

# 运行测试容器
echo ""
echo "🧪 运行测试容器..."
if docker run --rm hello-world &> /tmp/docker-test.log; then
    echo -e "${GREEN}✅ Docker 运行正常！${NC}"
else
    echo -e "${RED}❌ Docker 测试失败${NC}"
    cat /tmp/docker-test.log
    exit 1
fi

# 检查项目目录
echo ""
echo "📁 检查项目配置..."
if [ -f "docker-compose.yml" ]; then
    echo -e "${GREEN}✅ docker-compose.yml 存在${NC}"
else
    echo -e "${RED}❌ docker-compose.yml 未找到${NC}"
    echo "请确保在项目根目录运行此脚本"
    exit 1
fi

# 检查 .env 文件
if [ -f ".env" ]; then
    echo -e "${GREEN}✅ .env 文件存在${NC}"

    # 检查 API Keys
    source .env
    if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "your_openai_api_key_here" ]; then
        echo -e "${YELLOW}⚠️  OPENAI_API_KEY 未配置${NC}"
    else
        echo -e "${GREEN}✅ OPENAI_API_KEY 已配置${NC}"
    fi

    if [ -z "$ANTHROPIC_API_KEY" ] || [ "$ANTHROPIC_API_KEY" = "your_anthropic_api_key_here" ]; then
        echo -e "${YELLOW}⚠️  ANTHROPIC_API_KEY 未配置${NC}"
    else
        echo -e "${GREEN}✅ ANTHROPIC_API_KEY 已配置${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  .env 文件不存在${NC}"
fi

echo ""
echo "================================"
echo -e "${GREEN}🎉 Docker Desktop 安装验证成功！${NC}"
echo ""
echo -e "${BLUE}接下来的步骤:${NC}"
echo ""
echo "1️⃣  启动项目服务:"
echo "   ${GREEN}docker compose up -d${NC}"
echo ""
echo "2️⃣  查看服务状态:"
echo "   ${GREEN}docker compose ps${NC}"
echo ""
echo "3️⃣  查看服务日志:"
echo "   ${GREEN}docker compose logs -f${NC}"
echo ""
echo "4️⃣  初始化数据库:"
echo "   ${GREEN}npx prisma migrate dev --name init${NC}"
echo ""
echo "5️⃣  启动开发服务器:"
echo "   ${GREEN}npm run dev${NC}"
echo ""

# 询问是否立即启动服务
read -p "是否现在启动 Docker 服务？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 启动 Docker 服务..."
    docker compose up -d

    echo ""
    echo "⏳ 等待服务就绪..."
    sleep 5

    echo ""
    echo "📊 服务状态:"
    docker compose ps

    echo ""
    echo -e "${GREEN}✅ 服务已启动！${NC}"
    echo ""
    echo "下一步: 运行数据库迁移"
    echo "  ${GREEN}npx prisma migrate dev --name init${NC}"
fi
