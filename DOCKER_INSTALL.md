# Docker Desktop 安装指南 (macOS)

## 方法 1: 官方下载安装 ⭐ 推荐

### 步骤 1: 下载 Docker Desktop

1. 访问官方下载页面: **https://www.docker.com/products/docker-desktop/**

2. 点击 "Download for Mac" 按钮

3. 选择适合您 Mac 芯片的版本:
   - **Apple Silicon (M1/M2/M3)**: 选择 "Mac with Apple chip"
   - **Intel 芯片**: 选择 "Mac with Intel chip"

   不确定？在终端运行:
   ```bash
   uname -m
   # arm64 = Apple Silicon
   # x86_64 = Intel
   ```

### 步骤 2: 安装

1. 打开下载的 `Docker.dmg` 文件
2. 将 Docker 图标拖拽到 Applications 文件夹
3. 从 Applications 文件夹打开 Docker Desktop
4. 首次启动会请求权限，点击 "允许"
5. 等待 Docker Desktop 启动完成（状态栏图标变绿）

### 步骤 3: 验证安装

打开终端，运行:

```bash
docker --version
docker compose version
```

应该看到类似输出:
```
Docker version 24.0.x, build xxxxx
Docker Compose version v2.x.x
```

---

## 方法 2: 使用 Homebrew 安装

### 前提条件: 安装 Homebrew

如果您还没有安装 Homebrew，请先安装它:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

安装过程中会要求输入密码，按提示操作即可。

### 安装 Docker Desktop

```bash
# 使用 Homebrew Cask 安装 Docker Desktop
brew install --cask docker

# 启动 Docker Desktop
open -a Docker
```

### 验证安装

```bash
docker --version
docker compose version
```

---

## 方法 3: 直接下载链接（快速）

### Apple Silicon (M1/M2/M3) Mac:
```bash
# 在浏览器中打开
open "https://desktop.docker.com/mac/main/arm64/Docker.dmg"
```

### Intel Mac:
```bash
# 在浏览器中打开
open "https://desktop.docker.com/mac/main/amd64/Docker.dmg"
```

---

## 安装后配置

### 1. Docker Desktop 设置

1. 打开 Docker Desktop
2. 点击右上角 ⚙️ (设置)
3. 推荐配置:
   - **Resources > Advanced**:
     - CPUs: 4 (或更多，如果您的 Mac 性能好)
     - Memory: 4 GB (或更多)
     - Swap: 1 GB
     - Disk image size: 60 GB

   - **General**:
     - ✅ Start Docker Desktop when you sign in to your computer
     - ✅ Use Docker Compose V2

### 2. 测试 Docker 是否正常工作

```bash
# 运行测试容器
docker run hello-world

# 应该看到 "Hello from Docker!" 消息
```

---

## 启动 DeepDiveNote 项目

安装完成后，回到项目目录:

```bash
cd /Users/harry/deepdivenote

# 启动 PostgreSQL 和 Redis
docker compose up -d

# 查看服务状态
docker compose ps

# 预期输出:
# NAME                        IMAGE               STATUS
# deepdivenote-postgres       postgres:16-alpine  Up
# deepdivenote-redis          redis:7-alpine      Up

# 查看日志
docker compose logs -f
```

---

## 常见问题

### ❌ "Docker daemon is not running"

**解决**:
1. 确保 Docker Desktop 应用正在运行
2. 查看状态栏是否有 Docker 图标
3. 如果图标是灰色的，点击它并选择 "Restart Docker Desktop"

### ❌ "Cannot connect to the Docker daemon"

**解决**:
```bash
# 检查 Docker 是否运行
docker ps

# 如果失败，重启 Docker Desktop
killall Docker && open -a Docker
```

### ❌ 端口被占用

**解决**:
```bash
# 检查端口 5432 (PostgreSQL)
lsof -i :5432

# 检查端口 6379 (Redis)
lsof -i :6379

# 如果被占用，可以修改 docker-compose.yml 中的端口映射
```

### ❌ 权限问题

**解决**:
```bash
# 将当前用户添加到 docker 组（可能不需要，macOS 通常自动处理）
sudo dscl . -append /Groups/docker GroupMembership $USER
```

---

## 卸载 Docker Desktop

如果需要卸载:

### Homebrew 安装的:
```bash
brew uninstall --cask docker
```

### 手动安装的:
1. 退出 Docker Desktop
2. 从 Applications 文件夹删除 Docker
3. 清理残留文件:
   ```bash
   rm -rf ~/Library/Group\ Containers/group.com.docker
   rm -rf ~/Library/Containers/com.docker.docker
   rm -rf ~/.docker
   ```

---

## 下一步

安装完成后，继续 DeepDiveNote 项目配置:

1. ✅ Docker Desktop 已安装
2. ⏭️ 运行 `docker compose up -d` 启动数据库
3. ⏭️ 运行 `npx prisma migrate dev --name init` 初始化数据库
4. ⏭️ 运行 `npm run dev` 启动开发服务器

查看完整配置指南: [SETUP.md](SETUP.md)

---

**需要帮助？** 查看官方文档: https://docs.docker.com/desktop/install/mac-install/
