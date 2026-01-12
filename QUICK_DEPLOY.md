# ⚡ 从 Cursor 快速部署到 Zeabur（不经过 GitHub）

## 🎯 工作流程

每次在 Cursor 中修改代码后，直接部署到 Zeabur：

```bash
# 1. 重新打包（如果代码有修改）
cd /Users/percy/xhs/xiaohongshu-content-generator
./create_deploy_package.sh

# 2. 部署到 Zeabur
# 方式 A: 使用 Zeabur CLI（如果已安装）
cd web
zeabur deploy

# 方式 B: 在 Zeabur 控制台上传 deploy.tar.gz
```

---

## 📋 首次部署步骤

### 步骤 1：安装 Zeabur CLI（推荐）

```bash
npm install -g @zeabur/cli
```

如果权限不足，尝试：
```bash
sudo npm install -g @zeabur/cli
```

### 步骤 2：登录 Zeabur

```bash
zeabur login
```

这会打开浏览器让你登录。

### 步骤 3：部署项目

```bash
cd /Users/percy/xhs/xiaohongshu-content-generator/web
zeabur deploy
```

CLI 会引导你：
- 选择项目 "xhs"
- 创建或选择服务
- 配置环境变量
- 开始部署

---

## 🔄 日常迭代流程

### 每次修改代码后：

```bash
# 1. 在 Cursor 中修改代码并保存

# 2. 重新打包（可选，如果文件结构有变化）
cd /Users/percy/xhs/xiaohongshu-content-generator
./create_deploy_package.sh

# 3. 使用 CLI 重新部署
cd web
zeabur deploy --project xhs
```

或者：

```bash
# 如果 CLI 不可用，在 Zeabur 控制台：
# 1. 进入项目 "xhs"
# 2. 选择应用服务
# 3. 点击 "Redeploy" 或上传新的 deploy.tar.gz
```

---

## 🛠️ 如果 Zeabur CLI 安装失败

### 使用控制台上传方式：

1. **创建部署包**
```bash
cd /Users/percy/xhs/xiaohongshu-content-generator
./create_deploy_package.sh
```

2. **在 Zeabur 控制台**
   - 登录 https://zeabur.com
   - 进入项目 "xhs"
   - 如果服务已存在：点击服务 → "Settings" → "Redeploy" → 上传新的 `deploy.tar.gz`
   - 如果服务不存在：点击 "Add Service" → "Upload from Local" → 上传 `deploy.tar.gz`

3. **配置环境变量**（首次部署需要）
   - 在服务设置中添加所有必需的环境变量
   - 参考 `DEPLOY_XHS_PROJECT.md` 中的环境变量列表

---

## 📝 环境变量配置

首次部署时，需要在 Zeabur 控制台配置以下环境变量：

```
DATABASE_URL=从PostgreSQL服务获取
JWT_SECRET=xhs_secure_2026_production_key
NODE_ENV=production
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=你的管理员密码
COPY_ENGINE_VENDOR=google
COPY_ENGINE_MODEL_ID=gemini-1.5-pro-latest
COPY_ENGINE_BASE_URL=https://gitaigc.com/v1
GOOGLE_API_KEY=你的Google_API_密钥
IMAGE_ENGINE_VENDOR=google
IMAGE_ENGINE_MODEL_ID=gemini-2.5-flash-image
IMAGE_ENGINE_BASE_URL=https://gitaigc.com/v1
DASHSCOPE_API_KEY=你的阿里云API密钥（可选）
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/api/v1
```

---

## ✅ 优势

- ✅ **不经过 GitHub**：直接从本地部署
- ✅ **快速迭代**：修改代码后立即部署
- ✅ **版本控制**：本地 Git 管理，不影响部署
- ✅ **灵活**：可以选择 CLI 或控制台方式

---

## 🚀 现在开始

1. 安装 Zeabur CLI（如果还没安装）
2. 运行 `zeabur login`
3. 运行 `cd web && zeabur deploy`
4. 按照提示完成部署

