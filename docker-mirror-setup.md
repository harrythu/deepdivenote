# Docker 镜像加速器配置

## 方法：通过 Docker Desktop 配置

1. **打开 Docker Desktop**
2. **点击右上角 ⚙️ (Settings)**
3. **选择 Docker Engine**
4. **在 JSON 配置中添加以下内容**：

```json
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://docker.1panel.live",
    "https://docker.linkedbus.com"
  ]
}
```

5. **点击 "Apply & Restart"**
6. **等待 Docker Desktop 重启完成**

## 验证配置

重启后，运行：

```bash
docker info | grep -A 10 "Registry Mirrors"
```

应该看到配置的镜像地址。

## 然后重试

```bash
docker compose up -d
```

---

## 备选方案：使用 SQLite（临时开发）

如果镜像下载一直有问题，可以暂时使用 SQLite 数据库进行开发：

1. 修改 `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "sqlite"
     url      = "file:./dev.db"
   }
   ```

2. 更新 `prisma.config.ts`:
   ```typescript
   datasource: {
     url: "file:./prisma/dev.db"
   }
   ```

3. 运行迁移:
   ```bash
   npx prisma migrate dev --name init
   ```

4. 启动开发服务器:
   ```bash
   npm run dev
   ```

后期再切换回 PostgreSQL。
