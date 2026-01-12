# 🚀 从本地目录直接部署到 Zeabur（不经过 GitHub）

## 问题
- ❌ 不想从 GitHub 部署
- ❌ 压缩包无法上传
- ✅ 需要直接从 Cursor 本地项目部署

## 解决方案

### 方案 1：使用 Zeabur CLI（最推荐）

Zeabur CLI 支持直接从本地目录部署，不需要压缩包。

#### 安装 Zeabur CLI

```bash
# 在 Cursor 终端执行
npm install -g @zeabur/cli
```

如果权限不足：
```bash
sudo npm install -g @zeabur/cli
```

#### 部署步骤

```bash
# 1. 登录 Zeabur
zeabur login

# 2. 进入项目目录
cd /Users/percy/xhs/xiaohongshu-content-generator/"web 2"

# 3. 部署（CLI 会自动检测 Dockerfile 和项目结构）
zeabur deploy
```

CLI 会：
- 自动检测项目类型
- 自动检测 Dockerfile
- 引导你选择项目 "xhs"
- 自动上传文件并部署

---

### 方案 2：在 Zeabur 控制台使用 "Local Project" 选项

如果 Zeabur 控制台有 "Local Project" 选项：

1. **在 Zeabur Settings 页面**
   - 找到 "Source" 部分
   - 选择 "Local Project" 或类似选项
   - 可能需要：
     - 拖拽文件夹
     - 或选择文件夹路径
     - 或使用文件选择器选择整个目录

2. **选择项目目录**
   ```
   /Users/percy/xhs/xiaohongshu-content-generator/web 2
   ```

---

### 方案 3：使用 Docker 构建并推送镜像（如果支持）

如果 Zeabur 支持 Docker 镜像上传：

```bash
# 1. 构建 Docker 镜像
cd /Users/percy/xhs/xiaohongshu-content-generator/"web 2"
docker build -t xhs-content-platform:latest .

# 2. 在 Zeabur 控制台上传镜像
# 或推送到 Docker Hub，然后在 Zeabur 中使用
```

---

## 💡 推荐：使用 Zeabur CLI

这是最直接的方式，不需要压缩包，不需要 GitHub。

### 完整操作步骤：

```bash
# 在 Cursor 终端执行

# 1. 安装 CLI（如果还没安装）
sudo npm install -g @zeabur/cli

# 2. 登录
zeabur login

# 3. 进入项目目录
cd /Users/percy/xhs/xiaohongshu-content-generator/"web 2"

# 4. 部署
zeabur deploy
```

CLI 会引导你完成所有步骤！

---

## 🔍 检查 Zeabur 控制台选项

在 Zeabur Settings 的 "Source" 部分，查看是否有：
- "Local Directory" 选项
- "Upload Folder" 选项
- "Select Directory" 选项
- 或其他本地部署选项

如果有，告诉我具体是什么选项，我可以给你详细步骤。

---

## 📝 当前项目目录

你的项目实际位置：
```
/Users/percy/xhs/xiaohongshu-content-generator/web 2
```

这个目录包含所有需要的文件：
- ✅ package.json
- ✅ Dockerfile
- ✅ prisma/schema.prisma
- ✅ src/ 目录
- ✅ 所有源代码

---

## 🚀 现在请尝试

**方式 1（推荐）**：安装 Zeabur CLI 并部署
```bash
sudo npm install -g @zeabur/cli
zeabur login
cd "/Users/percy/xhs/xiaohongshu-content-generator/web 2"
zeabur deploy
```

**方式 2**：在 Zeabur 控制台查看是否有 "Local Project" 或类似选项

告诉我你看到了什么选项，或者 CLI 安装是否成功！

