# 🎯 一步步部署指南（适合代码小白）

## 📋 整体流程概览

1. ✅ 在 Zeabur 创建数据库
2. ✅ 在 Zeabur 创建应用服务
3. ✅ 配置环境变量
4. ✅ 开始部署

---

## 第一步：在 Zeabur 创建数据库

### 操作步骤：

1. **打开浏览器**，访问：https://zeabur.com
2. **登录**你的账号
3. **找到项目 "xhs"**，点击进入
4. **点击 "Add Service"** 按钮（通常在页面右上角或中间）
5. **选择 "PostgreSQL"**（数据库服务）
6. **等待创建完成**（约 1-2 分钟，会显示一个绿色的勾）

### ✅ 完成后：
- 你会看到一个 PostgreSQL 服务出现在项目列表中
- **重要**：点击这个 PostgreSQL 服务，在设置中找到 `DATABASE_URL`，**复制它**（稍后需要用到）

---

## 第二步：在 Zeabur 创建应用服务

### 操作步骤：

1. **在项目 "xhs" 中**，再次点击 **"Add Service"**
2. **选择 "Upload from Local"** 或 **"Deploy from Archive"**（不要选 GitHub）
3. **点击上传按钮**，选择文件：
   ```
   /Users/percy/xhs/xiaohongshu-content-generator/deploy.tar.gz
   ```
4. **等待上传完成**

### ✅ 完成后：
- 你会看到一个新的服务（可能叫 "web" 或类似的名字）
- 这个服务就是你的应用

---

## 第三步：配置环境变量

### 操作步骤：

1. **点击刚才创建的应用服务**（不是数据库服务）
2. **找到 "Environment Variables"** 或 **"Variables"** 标签，点击
3. **点击 "Add Variable"** 或 **"Edit Variables"** 按钮
4. **逐个添加**以下环境变量（每行一个，格式：`变量名 = 值`）：

```
DATABASE_URL = 粘贴你从PostgreSQL服务复制的连接字符串
JWT_SECRET = xhs_secure_2026_production_key
NODE_ENV = production
PORT = 3000
ADMIN_USERNAME = admin
ADMIN_PASSWORD = admin123
COPY_ENGINE_VENDOR = google
COPY_ENGINE_MODEL_ID = gemini-1.5-pro-latest
COPY_ENGINE_BASE_URL = https://gitaigc.com/v1
GOOGLE_API_KEY = 你的Google_API_密钥
IMAGE_ENGINE_VENDOR = google
IMAGE_ENGINE_MODEL_ID = gemini-2.5-flash-image
IMAGE_ENGINE_BASE_URL = https://gitaigc.com/v1
DASHSCOPE_API_KEY = 你的阿里云API密钥
DASHSCOPE_BASE_URL = https://dashscope.aliyuncs.com/api/v1
```

### ⚠️ 重要提示：
- `DATABASE_URL` 要从 PostgreSQL 服务中复制
- `GOOGLE_API_KEY` 和 `DASHSCOPE_API_KEY` 需要你提供真实的密钥
- 其他值可以直接复制上面的

---

## 第四步：配置构建命令

### 操作步骤：

1. **在应用服务的设置中**，找到 **"Build & Deploy"** 或 **"Settings"** 标签
2. **找到 "Build Command"**，输入：
   ```
   npm run build
   ```
3. **找到 "Start Command"**，输入：
   ```
   sh -c "npx prisma migrate deploy --schema=./prisma/schema.prisma && node server.js"
   ```
4. **保存设置**

---

## 第五步：连接数据库

### 操作步骤：

1. **在应用服务的设置中**，找到 **"Service Dependencies"** 或 **"Connected Services"**
2. **点击 "Connect Service"** 或 **"Add Dependency"**
3. **选择之前创建的 PostgreSQL 服务**
4. **确认连接**

### ✅ 完成后：
- Zeabur 会自动将数据库连接信息注入到应用服务

---

## 第六步：开始部署

### 操作步骤：

1. **确保所有环境变量都已添加**
2. **确保构建和启动命令已设置**
3. **点击 "Deploy"** 或 **"Redeploy"** 按钮
4. **等待构建完成**（约 5-10 分钟）
5. **查看构建日志**，确保没有红色错误信息

### ✅ 完成后：
- 你会看到一个绿色的 "Deployed" 状态
- Zeabur 会分配一个域名（格式类似：`xxx.zeabur.app`）
- 点击这个域名就可以访问你的应用了！

---

## 🎉 完成！

部署完成后，你可以：
- 访问分配的域名测试应用
- 测试注册/登录功能
- 测试内容生成功能

---

## 🔄 以后修改代码后如何重新部署？

### 简单两步：

1. **在 Cursor 终端运行**（我已经为你准备好了脚本）：
   ```bash
   cd /Users/percy/xhs/xiaohongshu-content-generator
   ./create_deploy_package.sh
   ```

2. **在 Zeabur 控制台**：
   - 进入项目 "xhs"
   - 点击应用服务
   - 点击 "Redeploy" 或 "Settings"
   - 上传新的 `deploy.tar.gz` 文件
   - 等待重新部署完成

---

## ❓ 遇到问题？

如果在任何一步遇到问题，告诉我：
- 你在第几步
- 看到了什么错误信息
- 我会帮你解决！

