# 🚀 部署项目 "xhs" 到 Zeabur - 详细步骤

## ✅ 当前状态
- ✅ 项目 "xhs" 已创建
- ✅ 部署包已准备：`deploy.tar.gz`

## 📋 操作步骤（请在 Zeabur 控制台执行）

### 第一步：创建 PostgreSQL 数据库

1. 在项目 "xhs" 中，点击 **"Add Service"**
2. 选择 **"PostgreSQL"**
3. 等待创建完成（约 1-2 分钟）
4. **重要**：创建完成后，点击 PostgreSQL 服务，在设置中找到 `DATABASE_URL`，复制它（稍后需要）

---

### 第二步：创建应用服务

#### 方式 A：从 GitHub 部署（推荐）

1. 在项目 "xhs" 中，点击 **"Add Service"**
2. 选择 **"Deploy from GitHub"**
3. 如果还没连接 GitHub，先连接你的 GitHub 账号
4. 选择仓库：`percychen19-max/xiaohongshu-content-generator`
5. **⚠️ 重要**：在设置中找到 **"Root Directory"** 或 **"Working Directory"**，设置为：`web`
6. 点击 **"Deploy"** 或 **"Create"**

#### 方式 B：手动上传（如果不想用 GitHub）

1. 在项目 "xhs" 中，点击 **"Add Service"**
2. 选择 **"Upload from Local"** 或 **"Deploy from Archive"**
3. 上传文件：`/Users/percy/xhs/xiaohongshu-content-generator/deploy.tar.gz`
4. 点击 **"Deploy"**

---

### 第三步：配置环境变量

在应用服务的设置中：

1. 点击服务名称进入服务详情
2. 找到 **"Environment Variables"** 或 **"Variables"** 标签
3. 点击 **"Add Variable"** 或 **"Edit Variables"**
4. 逐个添加以下环境变量：

#### 核心配置（必需）
```
DATABASE_URL = 从PostgreSQL服务复制的连接字符串
JWT_SECRET = xhs_secure_2026_production_key_change_me
NODE_ENV = production
PORT = 3000
```

#### 管理员配置
```
ADMIN_USERNAME = admin
ADMIN_PASSWORD = admin123
```

#### Google API 配置（文案生成）
```
COPY_ENGINE_VENDOR = google
COPY_ENGINE_MODEL_ID = gemini-1.5-pro-latest
COPY_ENGINE_BASE_URL = https://gitaigc.com/v1
GOOGLE_API_KEY = 你的Google_API_密钥
```

#### Google API 配置（图片生成）
```
IMAGE_ENGINE_VENDOR = google
IMAGE_ENGINE_MODEL_ID = gemini-2.5-flash-image
IMAGE_ENGINE_BASE_URL = https://gitaigc.com/v1
```

#### 阿里云配置（可选）
```
DASHSCOPE_API_KEY = 你的阿里云API密钥
DASHSCOPE_BASE_URL = https://dashscope.aliyuncs.com/api/v1
```

---

### 第四步：配置构建和启动命令

在应用服务的设置中：

1. 找到 **"Build & Deploy"** 或 **"Settings"** 标签
2. 设置 **Build Command**：
   ```
   npm run build
   ```
3. 设置 **Start Command**：
   ```
   sh -c "npx prisma migrate deploy --schema=./prisma/schema.prisma && node server.js"
   ```

---

### 第五步：连接数据库服务

1. 在应用服务的设置中，找到 **"Service Dependencies"** 或 **"Connected Services"**
2. 点击 **"Connect Service"** 或 **"Add Dependency"**
3. 选择之前创建的 PostgreSQL 服务
4. Zeabur 会自动将 `DATABASE_URL` 注入到应用服务（如果还没手动设置的话）

---

### 第六步：开始部署

1. 确保所有环境变量都已配置
2. 确保构建和启动命令已设置
3. 点击 **"Deploy"** 或 **"Redeploy"**
4. 等待构建完成（约 5-10 分钟）
5. 查看构建日志，确保没有错误

---

### 第七步：验证部署

1. 部署完成后，Zeabur 会自动分配一个域名
2. 在服务详情页面可以看到域名（格式类似：`xxx.zeabur.app`）
3. 访问该域名，测试以下功能：
   - ✅ 注册功能（手机号+密码）
   - ✅ 登录功能
   - ✅ 内容生成功能
   - ✅ 图片生成功能

---

## 🔍 如何获取 DATABASE_URL

1. 在项目 "xhs" 中，点击 PostgreSQL 服务
2. 进入服务详情页面
3. 找到 **"Environment Variables"** 或 **"Connection Info"**
4. 复制 `DATABASE_URL` 的值
5. 格式类似：`postgresql://user:password@host:port/database`

---

## ⚠️ 常见问题

### 构建失败
- 检查 Node.js 版本（需要 20+）
- 查看构建日志中的错误信息
- 确保根目录设置为 `web`（如果从 GitHub 部署）

### 数据库连接失败
- 检查 `DATABASE_URL` 是否正确
- 确保 PostgreSQL 服务已启动
- 检查服务之间的连接关系

### API 调用失败
- 检查 API 密钥是否正确配置
- 检查环境变量名称是否正确
- 查看服务日志

### 找不到根目录
- 如果从 GitHub 部署，确保设置了 **Root Directory: `web`**
- 如果手动上传，确保压缩包结构正确

---

## 📝 快速检查清单

部署前确认：
- [ ] PostgreSQL 服务已创建
- [ ] 应用服务已创建
- [ ] 根目录设置为 `web`（如果从 GitHub）
- [ ] 所有环境变量已配置
- [ ] 构建和启动命令已设置
- [ ] 数据库服务已连接到应用服务
- [ ] 已点击部署

---

## 🎉 完成！

部署完成后，你的应用就可以通过 Zeabur 分配的域名访问了！

如果遇到任何问题，请查看服务日志或联系我。

