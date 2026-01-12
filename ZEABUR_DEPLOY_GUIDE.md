# Zeabur 部署指南

## 📋 部署步骤

### 1. 准备项目

确保项目已推送到 GitHub，Zeabur 可以从 GitHub 仓库部署。

### 2. 在 Zeabur 创建项目和服务

1. 登录 [Zeabur 控制台](https://zeabur.com)
2. 点击 "New Project" 创建新项目
3. 选择 "Deploy from GitHub" 并连接你的仓库
4. 选择 `xiaohongshu-content-generator` 仓库
5. **Root Directory（根目录）选择 `web 2`**（注意 `web` 和 `2` 之间有一个空格）
6. 本项目已提供 `web 2/zeabur.json` + `web 2/Dockerfile`，建议使用 **DOCKERFILE** 方式构建/启动（Zeabur 通常会自动识别）

### 3. 创建 PostgreSQL 数据库

1. 在项目中点击 "Add Service"
2. 选择 "PostgreSQL"
3. 等待数据库创建完成
4. 记录数据库的连接信息（DATABASE_URL）

### 4. 配置环境变量

在服务设置中，添加以下环境变量：

#### 核心配置
```
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=xhs_secure_percy_2026_change_in_production
NODE_ENV=production
PORT=3000
```

#### 管理员配置
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

#### Google API 配置（推荐：文案 + 生图都走 Google 代理平台）
```
COPY_ENGINE_VENDOR=google
COPY_ENGINE_MODEL_ID=gemini-1.5-pro-latest
COPY_ENGINE_BASE_URL=https://gitaigc.com/v1
GOOGLE_API_KEY=你的Google_API_密钥
```

#### Google API 配置（图片生成，可选覆盖默认）
```
IMAGE_ENGINE_MODEL_ID=gemini-2.5-flash-image
IMAGE_ENGINE_BASE_URL=https://gitaigc.com/v1
```

#### 抠图（可选）
默认会跳过抠图（`IMAGESEG_SKIP` 配置中心默认 true）；如你需要更高的“参考图一致性”，可开启抠图并配置阿里云 ImageSeg 凭证。

（可选）强制跳过抠图：
```
IMAGESEG_SKIP=true
SKIP_IMAGE_SEGMENT=true
```

启用抠图（可选，用于参考图抠图 / 阿里云 ImageSeg）：
```
ALIBABA_CLOUD_ACCESS_KEY_ID=你的阿里云 AccessKeyId
ALIBABA_CLOUD_ACCESS_KEY_SECRET=你的阿里云 AccessKeySecret
```

⚠️ 注意：抠图流程会调用你自己的 `/api/temp-image` 生成临时 URL 给阿里云拉取。若你开启抠图，建议同时配置：
```
NEXT_PUBLIC_BASE_URL=https://你的线上域名（Zeabur 分配的域名或自定义域名）
```

### 5. 配置 Dockerfile

确保 `web/Dockerfile` 存在且配置正确。项目已包含 Dockerfile。

### 6. 配置构建和启动命令

如果你使用 **DOCKERFILE**（推荐），构建与启动命令由 `web 2/Dockerfile` 和 `web 2/zeabur.json` 管理，一般无需手动填写。

如果你没有走 DOCKERFILE（不推荐），可使用：

**Build Command（构建）**
```bash
npm run build
```

**Start Command（启动）**
```bash
npm run start
```

### 7. 部署

1. 点击 "Deploy" 开始部署
2. 等待构建完成（约 5-10 分钟）
3. 部署完成后，Zeabur 会自动分配域名

### 8. 验证部署

1. 访问分配的域名
2. 测试注册功能
3. 测试内容生成功能

## 🔧 故障排查

### 数据库连接失败

- 检查 `DATABASE_URL` 是否正确
- 确保 PostgreSQL 服务已启动
- 检查数据库权限设置

### 构建失败

- 检查 Node.js 版本（需要 20+）
- 查看构建日志中的错误信息
- 确保所有依赖都已正确安装

### API 调用失败

- 检查 API 密钥是否正确
- 检查网络连接
- 查看服务日志

## 📝 注意事项

1. **生产环境安全**：
   - 修改 `JWT_SECRET` 为强随机字符串
   - 修改 `ADMIN_PASSWORD` 为强密码
   - 不要将 API 密钥提交到代码仓库

2. **数据库迁移**：
   - 首次部署会自动运行 `prisma migrate deploy`
   - 后续更新 schema 后需要重新部署

3. **环境变量**：
   - 所有环境变量都需要在 Zeabur 控制台配置
   - 不要使用 `.env` 文件（不会被打包）

4. **域名配置**：
   - Zeabur 会自动分配域名
   - 可以配置自定义域名

## 🚀 快速部署命令（如果 API 可用）

如果网络允许，可以使用提供的 Python 脚本：

```bash
cd /Users/percy/xhs/xiaohongshu-content-generator
python3 deploy_zeabur.py
```

脚本会自动：
1. 获取项目和服务信息
2. 配置所有环境变量
3. 触发重新部署

## 📞 需要帮助？

如果遇到问题，请检查：
1. Zeabur 服务日志
2. 构建日志
3. 数据库连接状态
4. API 密钥有效性

