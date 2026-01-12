# 🚀 从 Cursor 直接部署到 Zeabur - 操作步骤

## ✅ 已完成的准备工作

1. ✅ 项目代码已准备好
2. ✅ Dockerfile 已配置
3. ✅ 部署包已创建：`deploy.tar.gz`

## 📋 部署步骤（请在 Zeabur 控制台操作）

### 第一步：登录 Zeabur

1. 打开浏览器，访问：https://zeabur.com
2. 登录你的账号

### 第二步：创建项目（如果还没有）

1. 点击 "New Project" 或选择现有项目
2. 输入项目名称（例如：content-production-platform）

### 第三步：创建 PostgreSQL 数据库

1. 在项目中点击 "Add Service"
2. 选择 "PostgreSQL"
3. 等待数据库创建完成（约 1-2 分钟）
4. **重要**：记录数据库的连接信息，稍后需要用到

### 第四步：部署应用服务

#### 方法 A：从 GitHub 部署（推荐，但只读）

1. 点击 "Add Service"
2. 选择 "Deploy from GitHub"
3. 连接你的 GitHub 账号（如果还没连接）
4. 选择仓库：`percychen19-max/xiaohongshu-content-generator`
5. **设置根目录为：`web`**（非常重要！）
6. 等待服务创建

#### 方法 B：手动上传（如果不想用 GitHub）

1. 点击 "Add Service"
2. 选择 "Upload from Local" 或 "Deploy from Archive"
3. 上传文件：`/Users/percy/xhs/xiaohongshu-content-generator/deploy.tar.gz`
4. 等待服务创建

### 第五步：配置环境变量

在应用服务的设置中，点击 "Environment Variables"，添加以下变量：

#### 核心配置
```
DATABASE_URL=从PostgreSQL服务中获取的连接字符串
JWT_SECRET=请设置一个强随机字符串（例如：xhs_secure_2026_$(openssl rand -hex 32)）
NODE_ENV=production
PORT=3000
```

#### 管理员配置
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=请设置一个强密码
```

#### Google API 配置（文案生成）
```
COPY_ENGINE_VENDOR=google
COPY_ENGINE_MODEL_ID=gemini-1.5-pro-latest
COPY_ENGINE_BASE_URL=https://gitaigc.com/v1
GOOGLE_API_KEY=你的Google_API_密钥
```

#### Google API 配置（图片生成）
```
IMAGE_ENGINE_VENDOR=google
IMAGE_ENGINE_MODEL_ID=gemini-2.5-flash-image
IMAGE_ENGINE_BASE_URL=https://gitaigc.com/v1
```

#### 阿里云配置（可选）
```
DASHSCOPE_API_KEY=你的阿里云API密钥
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/api/v1
```

### 第六步：配置构建和启动命令

在服务设置中，找到 "Build & Deploy" 部分：

**Build Command:**
```bash
npm run build
```

**Start Command:**
```bash
sh -c "npx prisma migrate deploy --schema=./prisma/schema.prisma && node server.js"
```

### 第七步：连接数据库服务

1. 在应用服务的设置中，找到 "Service Dependencies" 或 "Connected Services"
2. 点击 "Connect Service"
3. 选择之前创建的 PostgreSQL 服务
4. Zeabur 会自动将 `DATABASE_URL` 环境变量注入到应用服务

### 第八步：开始部署

1. 点击 "Deploy" 或 "Redeploy"
2. 等待构建完成（约 5-10 分钟）
3. 查看构建日志，确保没有错误

### 第九步：验证部署

1. 部署完成后，Zeabur 会自动分配一个域名
2. 访问该域名，测试以下功能：
   - 注册/登录功能
   - 内容生成功能
   - 图片生成功能

## 🔧 如何获取 DATABASE_URL

在 PostgreSQL 服务的设置中：
1. 找到 "Environment Variables" 或 "Connection Info"
2. 复制 `DATABASE_URL` 的值
3. 格式类似：`postgresql://user:password@host:port/database`

## ⚠️ 常见问题

### 构建失败

- 检查 Node.js 版本（需要 20+）
- 查看构建日志中的错误信息
- 确保所有依赖都已正确安装

### 数据库连接失败

- 检查 `DATABASE_URL` 是否正确
- 确保 PostgreSQL 服务已启动
- 检查服务之间的连接关系

### API 调用失败

- 检查 API 密钥是否正确
- 检查网络连接
- 查看服务日志

## 📝 部署包位置

部署包已创建在：
```
/Users/percy/xhs/xiaohongshu-content-generator/deploy.tar.gz
```

如果需要重新创建：
```bash
cd /Users/percy/xhs/xiaohongshu-content-generator
tar -czf deploy.tar.gz \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='*.db' \
  --exclude='.env*' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  web/
```

## 🎉 完成！

部署完成后，你的应用就可以通过 Zeabur 分配的域名访问了！

