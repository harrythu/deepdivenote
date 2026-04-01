#!/bin/bash
set -e

# ===========================================
# 跨平台 Docker 镜像构建脚本
# 从 macOS (Apple Silicon) 构建推送到阿里云
# ===========================================

# 配置区域 - 请根据实际情况修改
REGISTRY_URL="registry.cn-hangzhou.aliyuncs.com"
REGISTRY_NAMESPACE="your-namespace"  # 替换为你的命名空间
REGISTRY_PASSWORD="your-password"     # 替换为你的镜像密码

# 镜像版本
APP_TAG="${REGISTRY_URL}/${REGISTRY_NAMESPACE}/deepdovenote-app:latest"
WORKER_TAG="${REGISTRY_URL}/${REGISTRY_NAMESPACE}/deepdovenote-worker:latest"

echo "=========================================="
echo "  跨平台 Docker 镜像构建"
echo "  构建目标: linux/amd64"
echo "=========================================="
echo ""

# 登录阿里云容器镜像服务
echo ">> 登录阿里云容器镜像服务..."
echo "${REGISTRY_PASSWORD}" | docker login --username="${REGISTRY_NAMESPACE}" --password-stdin "${REGISTRY_URL}"

# 启用 buildx
echo ">> 启用 Docker buildx..."
docker buildx create --use --name=cross-build 2>/dev/null || docker buildx use cross-build
docker buildx inspect --bootstrap

# 构建并推送 App 镜像
echo ""
echo ">> 构建 deepdovenote-app (linux/amd64)..."
docker buildx build \
  --platform linux/amd64 \
  --builder=cross-build \
  --push \
  -t "${APP_TAG}" \
  -f Dockerfile.app .

# 构建并推送 Worker 镜像
echo ""
echo ">> 构建 deepdovenote-worker (linux/amd64)..."
docker buildx build \
  --platform linux/amd64 \
  --builder=cross-build \
  --push \
  -t "${WORKER_TAG}" \
  -f Dockerfile.worker .

echo ""
echo "=========================================="
echo "  构建完成!"
echo "=========================================="
echo ""
echo "镜像地址:"
echo "  App:    ${APP_TAG}"
echo "  Worker: ${WORKER_TAG}"
echo ""
echo "在阿里云服务器上使用时，更新 docker-compose.prod.yml:"
echo "  app:"
echo "    image: ${APP_TAG}"
echo "  worker:"
echo "    image: ${WORKER_TAG}"
