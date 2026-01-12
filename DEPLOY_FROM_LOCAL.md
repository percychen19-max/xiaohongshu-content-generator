# 🚀 从 Cursor 本地项目直接部署到 Zeabur

## 🎯 目标
直接从 Cursor 中的本地项目部署到 Zeabur，**不经过 GitHub**，支持快速迭代。

## 📋 部署方案

### 方案 1：使用 Zeabur CLI（最推荐）

#### 安装 Zeabur CLI

```bash
# 方法 1: 使用 npm（需要权限）
npm install -g @zeabur/cli

# 方法 2: 使用官方安装脚本
curl -fsSL https://zeabur.com/cli.sh | sh

# 方法 3: 使用 Homebrew（macOS）
brew install zeabur/tap/zeabur
```

#### 部署步骤

```bash
# 1. 登录 Zeabur
zeabur login

# 2. 进入项目目录
cd /Users/percy/xhs/xiaohongshu-content-generator/web

# 3. 部署（CLI 会引导你完成）
zeabur deploy
```

CLI 会：
- 让你选择或创建项目（选择 "xhs"）
- 让你选择或创建服务
- 自动检测 Dockerfile
- 引导你配置环境变量
- 开始部署

---

### 方案 2：使用 Docker + Zeabur（如果支持镜像上传）

#### 步骤

```bash
# 1. 构建 Docker 镜像
cd /Users/percy/xhs/xiaohongshu-content-generator/web
docker build -t xhs-content-platform:latest .

# 2. 登录到容器镜像仓库（如果 Zeabur 支持）
# 或者导出镜像
docker save xhs-content-platform:latest -o xhs-content-platform.tar

# 3. 在 Zeabur 控制台上传镜像
```

---

### 方案 3：使用 Zeabur 控制台直接上传（最可靠）

#### 步骤

1. **在 Cursor 中创建部署包**
```bash
cd /Users/percy/xhs/xiaohongshu-content-generator
./create_deploy_package.sh
```

2. **在 Zeabur 控制台**
   - 登录 https://zeabur.com
   - 进入项目 "xhs"
   - 点击 "Add Service"
   - 选择 "Upload from Local" 或 "Deploy from Archive"
   - 上传 `deploy.tar.gz`
   - 配置环境变量
   - 部署

---

## 🔄 快速迭代工作流

### 每次修改代码后的部署流程

```bash
# 1. 在 Cursor 中修改代码

# 2. 创建新的部署包
cd /Users/percy/xhs/xiaohongshu-content-generator
./create_deploy_package.sh

# 3. 使用 Zeabur CLI 部署（如果已安装）
cd web
zeabur deploy

# 或者
# 3. 在 Zeabur 控制台上传新的 deploy.tar.gz
```

---

## 📝 创建部署包脚本

让我为你创建一个自动化脚本，方便每次快速打包部署。

