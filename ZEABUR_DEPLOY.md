# Zeabur 部署指南

本指南将帮助你将内容生产平台部署到 Zeabur。

## 📋 前置准备

1. **Zeabur 账号**：访问 [zeabur.com](https://zeabur.com) 注册账号
2. **GitHub 仓库**：确保代码已推送到 GitHub
3. **环境变量清单**：准备好所有需要的 API Key 和配置

## 🚀 部署步骤

### 第一步：在 Zeabur 创建项目

1. 登录 Zeabur 控制台
2. 点击 "New Project" 创建新项目
3. 选择 "Deploy from GitHub" 并授权 GitHub
4. 选择你的仓库：`xiaohongshu-content-generator`
5. 选择根目录：**`web 2`**（重要！注意 `web` 和 `2` 之间有空格）

### 第二步：添加 PostgreSQL 数据库

1. 在项目页面点击 "Add Service"
2. 选择 "PostgreSQL"
3. Zeabur 会自动创建数据库实例
4. 记录数据库连接信息（会自动注入到环境变量）

### 第三步：配置环境变量

在 Zeabur 项目设置中添加以下环境变量：

#### 必需的环境变量

```bash
# 数据库（Zeabur 会自动注入，但也可以手动设置）
DATABASE_URL=postgresql://user:password@host:5432/dbname

# JWT 密钥（用于用户登录会话）
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# 管理员账号
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-admin-password

# 开发环境固定验证码（生产环境建议关闭或使用真实短信）
DEV_FIXED_CODE=1234

# 文案生成引擎（Google 第三方）
COPY_ENGINE_VENDOR=google
COPY_ENGINE_MODEL_ID=gemini-1.5-pro
COPY_ENGINE_BASE_URL=https://gitaigc.com/v1
GOOGLE_API_KEY=sk-your-google-api-key

# 图片生成引擎（Google 第三方）
IMAGE_ENGINE_VENDOR=google
IMAGE_ENGINE_MODEL_ID=gemini-2.5-flash-image
IMAGE_ENGINE_BASE_URL=https://gitaigc.com/v1

# 阿里云 DashScope（用于图片处理，可选）
DASHSCOPE_API_KEY=sk-your-dashscope-api-key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/api/v1

# 阿里云图片分割（可选，如果不需要抠图功能可跳过）
ALIBABA_CLOUD_ACCESS_KEY_ID=your-access-key-id
ALIBABA_CLOUD_ACCESS_KEY_SECRET=your-access-key-secret

# 跳过图片分割（如果不需要抠图）
SKIP_IMAGE_SEGMENT=true
```

#### 可选的环境变量

```bash
# 短信服务（如果需要在生产环境发送真实验证码）
ALIYUN_SMS_SIGN_NAME=内容生产平台
ALIYUN_SMS_TEMPLATE_CODE=SMS_xxxxx
ALIYUN_ACCESS_KEY_ID=your-aliyun-key
ALIYUN_ACCESS_KEY_SECRET=your-aliyun-secret

# 管理员手机号（多个用逗号分隔）
ADMIN_PHONES=13800138000,13900139000
```

### 第四步：修改数据库配置

在 Zeabur 部署前，需要将 Prisma schema 从 SQLite 改为 PostgreSQL：

1. 修改 `web 2/prisma/schema.prisma`：
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. 创建新的迁移：
   ```bash
   cd web\ 2
   npx prisma migrate dev --name init_postgresql
   ```

3. 提交并推送代码到 GitHub

### 第五步：部署配置

Zeabur 会自动检测到 Dockerfile，但需要确保：

1. **根目录设置**：在 Zeabur 项目设置中，将 "Root Directory" 设置为 `web 2`
2. **构建命令**：Zeabur 会自动使用 Dockerfile，无需额外配置
3. **启动命令**：已在 Dockerfile 中配置，会自动运行数据库迁移

### 第六步：连接数据库服务

1. 在 Zeabur 项目页面，找到 PostgreSQL 服务
2. 点击 "Connect" 或 "Environment Variables"
3. 确保 `DATABASE_URL` 已自动注入到 Web 服务
4. 如果未自动注入，手动添加 `DATABASE_URL` 环境变量

### 第七步：部署

1. 点击 "Deploy" 或等待自动部署
2. 等待构建完成（通常 5-10 分钟）
3. 查看部署日志，确认没有错误

## 🔍 验证部署

部署成功后：

1. 访问 Zeabur 提供的域名（如 `your-project.zeabur.app`）
2. 测试登录功能（使用任意手机号 + 验证码 1234）
3. 测试内容生成功能
4. 访问管理后台：`/admin/login`（使用配置的管理员账号密码）

## 📝 常见问题

### 问题 1：数据库连接失败

**解决方案**：
- 确认 PostgreSQL 服务已启动
- 检查 `DATABASE_URL` 环境变量是否正确
- 查看部署日志中的数据库连接错误

### 问题 2：Prisma 迁移失败

**解决方案**：
- 确认 `DATABASE_URL` 格式正确
- 检查数据库权限
- 手动运行迁移：`npx prisma migrate deploy`

### 问题 3：构建失败

**解决方案**：
- 检查 Node.js 版本（需要 20+）
- 查看构建日志中的具体错误
- 确认所有依赖都已正确安装

### 问题 4：环境变量未生效

**解决方案**：
- 在 Zeabur 项目设置中重新设置环境变量
- 重启服务
- 确认环境变量名称拼写正确

## 🔄 更新部署

每次代码更新后：

1. 推送到 GitHub
2. Zeabur 会自动检测并重新部署
3. 或手动点击 "Redeploy"

## 📊 监控和维护

- **日志查看**：在 Zeabur 控制台查看实时日志
- **性能监控**：Zeabur 提供基础的性能指标
- **数据库备份**：建议定期备份 PostgreSQL 数据

## 🎯 下一步

部署成功后，你可以：

1. 配置自定义域名
2. 设置 HTTPS（Zeabur 自动提供）
3. 配置 CDN（可选）
4. 接入真实的短信服务（替换固定验证码）
5. 接入支付系统（实现收入统计）

---

**需要帮助？** 查看 Zeabur 官方文档或项目 Issues。

