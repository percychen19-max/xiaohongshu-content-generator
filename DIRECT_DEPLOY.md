# 从 Cursor 直接部署到 Zeabur（不通过 GitHub）

## 🎯 目标
直接从本地 Cursor 项目部署到 Zeabur，不经过 GitHub。

## 📋 方案选择

### 方案 1：使用 Zeabur CLI（最简单）

#### 步骤：

1. **安装 Zeabur CLI**
```bash
# 在 Cursor 终端执行
curl -fsSL https://zeabur.com/cli.sh | sh
```

如果失败，尝试：
```bash
npm install -g @zeabur/cli
```

2. **登录**
```bash
zeabur login
```

3. **部署**
```bash
cd /Users/percy/xhs/xiaohongshu-content-generator/web
zeabur deploy
```

CLI 会引导你完成所有步骤。

---

### 方案 2：手动打包上传（最可靠）

#### 步骤：

1. **创建部署包**
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

2. **在 Zeabur 控制台**
   - 登录 https://zeabur.com
   - 创建新项目
   - 点击 "Add Service" → "Upload from Local" 或 "Deploy from Archive"
   - 上传 `deploy.tar.gz`
   - 配置环境变量（见下方）
   - 创建 PostgreSQL 服务并连接
   - 部署

---

### 方案 3：使用 Docker（如果 Zeabur 支持）

1. **构建镜像**
```bash
cd /Users/percy/xhs/xiaohongshu-content-generator/web
docker build -t content-platform:latest .
```

2. **导出镜像**
```bash
docker save content-platform:latest -o content-platform.tar
```

3. **在 Zeabur 控制台上传镜像**

---

## 🔧 必需的环境变量

在 Zeabur 控制台的服务设置中添加：

```
DATABASE_URL=从PostgreSQL服务获取
JWT_SECRET=请设置强随机字符串
NODE_ENV=production
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=请设置强密码
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

## 🛠️ 构建和启动命令

**Build Command:**
```bash
npm run build
```

**Start Command:**
```bash
sh -c "npx prisma migrate deploy --schema=./prisma/schema.prisma && node server.js"
```

## 🔒 关于 API 密钥安全

**当前状态：**
- ✅ 代码中**没有硬编码**的 API 密钥
- ⚠️  Git 历史记录中**仍有泄露**（在提交 5d46e62 中）

**建议操作：**

1. **立即轮换所有 API 密钥**（最安全）
   - Google API Key
   - 阿里云 API Key  
   - Zeabur API Key

2. **清理 Git 历史**（可选）
   ```bash
   # 运行清理脚本
   ./cleanup_api_keys.sh
   
   # 检查结果
   git log --all
   
   # 如果满意，强制推送（⚠️ 会重写历史）
   git push origin --force --all
   ```

3. **使用新的密钥在 Zeabur 中配置**

## 💡 推荐流程

1. **先轮换 API 密钥**（最重要）
2. **使用方案 1（Zeabur CLI）** 或 **方案 2（手动上传）** 部署
3. **在 Zeabur 环境变量中配置新的 API 密钥**
4. **（可选）清理 Git 历史**

## 📞 需要帮助？

如果遇到问题：
1. 检查 Zeabur 服务日志
2. 检查构建日志
3. 确认环境变量配置正确
4. 确认数据库连接正常

