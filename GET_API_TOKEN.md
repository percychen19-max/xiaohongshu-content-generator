# 🔑 获取 Zeabur API Token 步骤

## 步骤 1：在 Zeabur 控制台生成 API Token

1. **登录 Zeabur 控制台**
   - 访问：https://zeabur.com
   - 使用你自己的 Zeabur 账号登录（不要在仓库/文档里记录邮箱密码）

2. **进入设置页面**
   - 点击右上角头像
   - 选择 "Settings" 或 "设置"
   - 找到 "API Tokens" 或 "API 令牌" 部分

3. **创建新的 Token**
   - 点击 "Create Token" 或 "创建令牌"
   - 输入名称（例如：cursor-deploy）
   - 点击 "Create" 或 "创建"
   - **重要**：复制生成的 token（只显示一次）

4. **复制 Token**
   - Token 格式类似：`sk-xxxxxxxxxxxxx`
   - 复制完整的 token

---

## 步骤 2：使用 Token 登录 CLI

获取 token 后，告诉我，我会帮你登录并部署。

或者你可以直接在终端执行：

```bash
export PATH="$HOME/.local/bin:$PATH"
zeabur auth login --token 你的token
cd "/Users/percy/xhs/xiaohongshu-content-generator/web 2"
zeabur deploy
```

---

## 或者：直接在 Zeabur 控制台部署

如果无法使用 CLI，我们可以在 Zeabur 控制台直接操作：

1. **在 Zeabur 控制台**
   - 进入项目 "xhs"
   - 点击应用服务
   - 在 Settings → Source 中
   - 查看是否有 "Local Project" 或其他本地部署选项

告诉我你看到了什么选项，我会给你详细步骤！



