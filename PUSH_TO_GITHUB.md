# 推送代码到 GitHub 完整指南

## 📋 前提条件

1. ✅ 已创建 GitHub 仓库（仓库名：`xiaohongshu-content-generator`）
2. ✅ 已安装 Git
3. ✅ 已配置 Git 用户信息（如果还没有，见下方）

## 🔧 第一步：配置 Git（如果还没有）

```bash
git config --global user.name "你的名字"
git config --global user.email "your-email@example.com"
```

## 🚀 第二步：初始化 Git 并推送代码

### 方法一：如果 Git 还未初始化

```bash
# 1. 进入项目目录
cd /Users/percy/小红书视频

# 2. 初始化 Git
git init

# 3. 添加所有文件
git add .

# 4. 提交代码
git commit -m "feat: 初始提交 - 小红书爆文生成平台"

# 5. 重命名分支为 main
git branch -M main

# 6. 添加远程仓库（替换 your-username 为你的 GitHub 用户名）
git remote add origin https://github.com/your-username/xiaohongshu-content-generator.git

# 7. 推送到 GitHub
git push -u origin main
```

### 方法二：如果 Git 已初始化但还没有远程仓库

```bash
# 1. 进入项目目录
cd /Users/percy/小红书视频

# 2. 检查当前状态
git status

# 3. 添加所有文件（如果有新文件）
git add .

# 4. 提交代码
git commit -m "feat: 初始提交 - 小红书爆文生成平台"

# 5. 添加远程仓库（替换 your-username 为你的 GitHub 用户名）
git remote add origin https://github.com/your-username/xiaohongshu-content-generator.git

# 6. 推送到 GitHub
git branch -M main
git push -u origin main
```

### 方法三：如果已经有远程仓库但想更换

```bash
# 1. 查看当前远程仓库
git remote -v

# 2. 删除旧的远程仓库
git remote remove origin

# 3. 添加新的远程仓库
git remote add origin https://github.com/your-username/xiaohongshu-content-generator.git

# 4. 推送到 GitHub
git push -u origin main
```

## 🔐 第三步：身份验证

### 如果提示需要登录

GitHub 现在要求使用 Personal Access Token (PAT) 而不是密码。

1. **生成 Personal Access Token**：
   - 访问：https://github.com/settings/tokens
   - 点击 "Generate new token" → "Generate new token (classic)"
   - 填写名称：`xiaohongshu-content-generator`
   - 选择权限：至少勾选 `repo`（完整仓库访问权限）
   - 点击 "Generate token"
   - **复制生成的 token**（只显示一次！）

2. **使用 Token 推送**：
   ```bash
   # 当提示输入密码时，输入你的 Personal Access Token
   git push -u origin main
   ```

### 或者使用 SSH（推荐，更安全）

1. **生成 SSH 密钥**（如果还没有）：
   ```bash
   ssh-keygen -t ed25519 -C "your-email@example.com"
   # 按 Enter 使用默认路径
   # 可以设置密码或直接按 Enter
   ```

2. **复制公钥**：
   ```bash
   cat ~/.ssh/id_ed25519.pub
   # 复制输出的内容
   ```

3. **添加到 GitHub**：
   - 访问：https://github.com/settings/keys
   - 点击 "New SSH key"
   - Title: `MacBook`（或任意名称）
   - Key: 粘贴刚才复制的公钥
   - 点击 "Add SSH key"

4. **使用 SSH URL**：
   ```bash
   # 删除 HTTPS 远程仓库
   git remote remove origin
   
   # 添加 SSH 远程仓库（替换 your-username）
   git remote add origin git@github.com:your-username/xiaohongshu-content-generator.git
   
   # 推送
   git push -u origin main
   ```

## ✅ 验证推送成功

推送成功后，访问你的 GitHub 仓库页面：
```
https://github.com/your-username/xiaohongshu-content-generator
```

你应该能看到：
- ✅ README.md 文件
- ✅ LICENSE 文件
- ✅ 所有源代码文件
- ✅ 项目结构

## 🐛 常见问题

### Q1: 提示 "remote origin already exists"

```bash
# 删除旧的远程仓库
git remote remove origin

# 重新添加
git remote add origin https://github.com/your-username/xiaohongshu-content-generator.git
```

### Q2: 提示 "Authentication failed"

- 确保使用 Personal Access Token 而不是密码
- 或者使用 SSH 方式

### Q3: 提示 "Permission denied"

- 检查仓库名是否正确
- 检查 GitHub 用户名是否正确
- 确保仓库是 Public 或者你有访问权限

### Q4: 想更新代码

```bash
# 修改文件后
git add .
git commit -m "feat: 更新描述"
git push
```

## 📝 下一步

推送成功后：

1. ✅ 在 GitHub 仓库页面添加 Topics（标签）
2. ✅ 创建第一个 Release（v1.0.0）
3. ✅ 分享给其他人

