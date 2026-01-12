# 快速部署指南

## 方案 1：先推送到 GitHub，然后 Zeabur 自动部署（推荐）

### 步骤：

1. **提交所有更改到 Git**
```bash
cd /Users/percy/xhs/xiaohongshu-content-generator
git add .
git commit -m "feat: 完成注册登录系统改造和部署准备"
git push origin main
```

2. **在 Zeabur 控制台部署**
   - 登录 Zeabur
   - 选择项目（如果已存在）或创建新项目
   - 选择从 GitHub 部署
   - 选择仓库：`percychen19-max/xiaohongshu-content-generator`
   - 根目录设置为：`web`
   - 配置环境变量（见下方）
   - 点击部署

## 方案 2：使用 Zeabur CLI 直接从本地部署

### 安装 Zeabur CLI
```bash
npm install -g @zeabur/cli
# 或
curl -fsSL https://zeabur.com/cli.sh | sh
```

### 登录并部署
```bash
zeabur login
cd /Users/percy/xhs/xiaohongshu-content-generator/web
zeabur deploy
```

## 必需的环境变量

在 Zeabur 控制台的服务设置中添加：

```
DATABASE_URL=你的PostgreSQL连接字符串
JWT_SECRET=xhs_secure_percy_2026_change_in_production
NODE_ENV=production
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
COPY_ENGINE_VENDOR=google
COPY_ENGINE_MODEL_ID=gemini-1.5-pro-latest
COPY_ENGINE_BASE_URL=https://gitaigc.com/v1
GOOGLE_API_KEY=sk-qAKQ3q2at4Vsxp9bMNnMhzZzGrQIuPO5smIohEZuAWR6lpzz
IMAGE_ENGINE_VENDOR=google
IMAGE_ENGINE_MODEL_ID=gemini-2.5-flash-image
IMAGE_ENGINE_BASE_URL=https://gitaigc.com/v1
DASHSCOPE_API_KEY=sk-c93e51d35d464e96adf4d406f85e5541
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/api/v1
```

