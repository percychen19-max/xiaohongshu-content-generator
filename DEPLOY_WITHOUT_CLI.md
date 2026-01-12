# 🚀 不使用 CLI 的部署方案

## 问题
- ❌ Zeabur CLI 登录时浏览器连接被重置（网络限制）
- ❌ 不想从 GitHub 部署
- ❌ 压缩包无法上传

## 解决方案：直接在 Zeabur 控制台操作

### 方案 1：使用 GitHub 部署（但只读，不推送敏感信息）

虽然你不想从 GitHub，但可以这样操作：
- **Zeabur 只读取 GitHub**（不推送敏感信息）
- **代码仍在 Cursor 本地修改**
- **需要部署时，推送到 GitHub，Zeabur 自动拉取**

#### 操作步骤：

1. **在 Cursor 终端执行**（推送代码到 GitHub）：
   ```bash
   cd /Users/percy/xhs/xiaohongshu-content-generator
   git add .
   git commit -m "准备部署到 Zeabur"
   git push origin main
   ```

2. **在 Zeabur 控制台**：
   - 进入项目 "xhs"
   - 点击应用服务 `xiaohongshu-content-generator`
   - 在 Settings → Source 中
   - 选择 "GitHub Repository"
   - 选择仓库：`percychen19-max/xiaohongshu-content-generator`
   - **重要**：设置 "Root Directory" 为：`web 2`（注意是 "web 2"，不是 "web"）
   - 保存

3. **每次更新代码后**：
   ```bash
   cd /Users/percy/xhs/xiaohongshu-content-generator
   git add .
   git commit -m "更新代码"
   git push origin main
   ```
   - Zeabur 会自动检测并重新部署

---

### 方案 2：检查 Zeabur 控制台是否有其他上传方式

在 Zeabur Settings 的 "Source" 部分，查看是否有：
- "Upload Directory" 选项
- "Select Folder" 选项
- "Local Files" 选项
- 或其他本地部署选项

---

### 方案 3：使用 API Token 登录 CLI（如果支持）

如果 Zeabur CLI 支持 token 登录：

1. **在 Zeabur 控制台生成 API Token**
   - 登录 https://zeabur.com
   - 进入设置 → API Tokens
   - 创建新的 token

2. **使用 token 登录 CLI**
   ```bash
   export PATH="$HOME/.local/bin:$PATH"
   export ZEABUR_TOKEN=你的token
   cd "/Users/percy/xhs/xiaohongshu-content-generator/web 2"
   zeabur deploy
   ```

---

## 💡 推荐方案

**方案 1（从 GitHub 部署）** 是最简单可靠的：
- ✅ 不需要 CLI 登录
- ✅ 不需要上传文件
- ✅ 自动部署更新
- ✅ 你仍然可以在 Cursor 中修改代码
- ✅ 只需要推送代码到 GitHub（不包含敏感信息）

**工作流程**：
1. 在 Cursor 中修改代码
2. 推送到 GitHub（`git push`）
3. Zeabur 自动检测并部署

---

## 🚀 现在请选择

1. **方案 1**：我帮你推送代码到 GitHub，然后你在 Zeabur 控制台连接 GitHub 仓库
2. **方案 2**：你在 Zeabur 控制台查看是否有其他上传方式
3. **方案 3**：尝试使用 API Token 登录 CLI

告诉我你的选择，我会帮你完成！

