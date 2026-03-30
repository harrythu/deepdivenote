#!/bin/bash
set -e

echo "=========================================="
echo "  DeepDiveNote 部署脚本"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查必要的命令
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo -e "${YELLOW}检查环境...${NC}"

if ! command_exists docker; then
    echo -e "${RED}错误: Docker 未安装${NC}"
    exit 1
fi

if ! command_exists docker-compose; then
    echo -e "${RED}错误: Docker Compose 未安装${NC}"
    exit 1
fi

# 检查 .env 文件
if [ ! -f .env ]; then
    echo -e "${YELLOW}警告: .env 文件不存在${NC}"
    echo -e "${YELLOW}请复制 .env.production.example 为 .env 并配置${NC}"
    echo -e "${YELLOW}cp .env.production.example .env${NC}"
    exit 1
fi

echo -e "${GREEN}环境检查通过${NC}"

# 拉取最新代码 (如果有git)
if [ -d .git ]; then
    echo -e "${YELLOW}拉取最新代码...${NC}"
    git pull
fi

# 安装依赖
echo -e "${YELLOW}安装依赖...${NC}"
npm ci

# 生成 Prisma Client
echo -e "${YELLOW}生成 Prisma Client...${NC}"
npx prisma generate

# 构建 Docker 镜像
echo -e "${YELLOW}构建 Docker 镜像...${NC}"
docker-compose -f docker-compose.prod.yml build

# 停止旧容器
echo -e "${YELLOW}停止旧容器...${NC}"
docker-compose -f docker-compose.prod.yml down

# 启动新容器
echo -e "${YELLOW}启动新容器...${NC}"
docker-compose -f docker-compose.prod.yml up -d

# 等待服务启动
echo -e "${YELLOW}等待服务启动...${NC}"
sleep 10

# 检查容器状态
echo -e "${YELLOW}检查容器状态...${NC}"
docker-compose -f docker-compose.prod.yml ps

# 检查日志
echo -e "${YELLOW}最近日志:${NC}"
docker-compose -f docker-compose.prod.yml logs --tail=50

echo ""
echo -e "${GREEN}=========================================="
echo -e "  部署完成！"
echo -e "==========================================${NC}"
echo ""
echo "应用地址: http://localhost:3000"
echo "查看日志: docker-compose -f docker-compose.prod.yml logs -f"
echo "停止服务: docker-compose -f docker-compose.prod.yml down"
