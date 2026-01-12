# 从 Cursor 直接部署到 Zeabur 指南

## 📋 方案概述

由于网络限制，无法通过 API 自动部署。以下是手动部署步骤，你可以在 Cursor 中操作，也可以直接在 Zeabur 控制台操作。

## 🚀 部署步骤

### 方法 1：使用 Zeabur CLI（推荐，如果网络允许）

#### 1. 安装 Zeabur CLI

```bash
# 方法 A: 使用 npm（需要权限）
npm install -g @zeabur/cli

# 方法 B: 使用官方安装脚本
curl -fsSL https://zeabur.com/cli.sh | sh

# 方法 C: 使用 Homebrew（macOS）
brew install zeabur/tap/zeabur
```

#### 2. 登录 Zeabur

```bash
zeabur login
```

这会打开浏览器让你登录。

#### 3. 部署项目

```bash
cd /Users/percy/xhs/xiaohongshu-content-generator/web
zeabur deploy
```

CLI 会引导你：
- 选择或创建项目
- 选择或创建服务
- 配置环境变量
- 开始部署

### 方法 2：使用 Zeabur 控制台（最可靠）

#### 1. 准备项目压缩包

在 Cursor 终端中执行：

```bash
cd /Users/percy/xhs/xiaohongshu-content-generator
# 创建部署包（排除不需要的文件）
tar -czf deploy.tar.gz \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='*.db' \
  --exclude='.env*' \
  --exclude='*.log' \
  web/
```

#### 2. 在 Zeabur 控制台操作

1. 登录 https://zeabur.com
2. 创建新项目或选择现有项目
3. 点击 "Add Service" → "Upload from Local"
4. 上传 `deploy.tar.gz` 文件
5. 设置根目录为：`web`（如果解压后需要）
6. 配置环境变量（见下方）
7. 创建 PostgreSQL 服务
8. 连接数据库服务到应用服务
9. 点击部署

### 方法 3：使用 Docker + Zeabur（如果支持）

如果 Zeabur 支持直接上传 Docker 镜像：

```bash
cd /Users/percy/xhs/xiaohongshu-content-generator/web

# 构建 Docker 镜像
docker build -t content-platform:latest .

# 导出镜像
docker save content-platform:latest -o content-platform.tar

# 在 Zeabur 控制台上传镜像
```

## 🔧 必需的环境变量配置

在 Zeabur 控制台的服务设置中，添加以下环境变量：

### 核心配置
```
DATABASE_URL=从PostgreSQL服务获取的连接字符串
JWT_SECRET=请设置一个强随机字符串
NODE_ENV=production
PORT=3000
```

### 管理员配置
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=请设置强密码
```

### Google API 配置（文案生成）
```
COPY_ENGINE_VENDOR=google
COPY_ENGINE_MODEL_ID=gemini-1.5-pro-latest
COPY_ENGINE_BASE_URL=https://gitaigc.com/v1
GOOGLE_API_KEY=你的Google_API_密钥
```

### Google API 配置（图片生成）
```
IMAGE_ENGINE_VENDOR=google
IMAGE_ENGINE_MODEL_ID=gemini-2.5-flash-image
IMAGE_ENGINE_BASE_URL=https://gitaigc.com/v1
```

### 阿里云配置（可选）
```
DASHSCOPE_API_KEY=你的阿里云API密钥
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/api/v1
```

## 📝 构建和启动命令

在 Zeabur 服务设置中配置：

**Build Command:**
```bash
npm run build
```

**Start Command:**
```bash
sh -c "npx prisma migrate deploy --schema=./prisma/schema.prisma && node server.js"
```

## ⚠️ 关于 API 密钥安全

**重要**：当前代码中**没有硬编码**的 API 密钥，所有密钥都从环境变量读取。

但是，GitHub 历史记录中可能包含之前提交的密钥。建议：

1. **立即轮换所有 API 密钥**（最安全）
2. 使用新的密钥在 Zeabur 环境变量中配置
3. 不要将 `.env` 文件提交到 Git

## 🔍 检查 API 密钥泄露

如果你想检查 GitHub 历史记录中是否有泄露：

```bash
cd /Users/percy/xhs/xiaohongshu-content-generator
# 检查所有历史提交
git log --all --full-history -p | grep -E "sk-[a-zA-Z0-9]{20,}"
```

如果发现泄露，可以：
1. 轮换密钥（推荐）
2. 使用 `git filter-branch` 清理历史（会重写历史，需谨慎）

## 💡 推荐方案

**最简单可靠的方式**：
1. 使用 Zeabur CLI（如果网络允许）
2. 或者直接在 Zeabur 控制台创建服务
3. 连接 GitHub 仓库（但只读，不推送敏感信息）
4. 在 Zeabur 控制台配置所有环境变量

这样既安全又方便！

