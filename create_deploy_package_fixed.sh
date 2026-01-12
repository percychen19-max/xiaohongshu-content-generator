#!/bin/bash
# 创建 Zeabur 部署包
# 用于从 Cursor 本地项目直接部署到 Zeabur

set -e

PROJECT_DIR="/Users/percy/xhs/xiaohongshu-content-generator"
DEPLOY_FILE="deploy.tar.gz"

echo "📦 开始创建部署包..."

cd "$PROJECT_DIR"

# 清理旧的部署包
if [ -f "$DEPLOY_FILE" ]; then
    echo "🗑️  删除旧的部署包..."
    rm "$DEPLOY_FILE"
fi

# 创建新的部署包
echo "📦 打包项目文件..."
tar -czf "$DEPLOY_FILE" \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='*.db' \
  --exclude='*.db-journal' \
  --exclude='.env*' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude='*.tar.gz' \
  --exclude='.vscode' \
  --exclude='.idea' \
  --exclude='coverage' \
  --exclude='dist' \
  --exclude='build' \
  web 2/

# 检查文件大小
FILE_SIZE=$(du -h "$DEPLOY_FILE" | cut -f1)
echo "✅ 部署包创建成功: $DEPLOY_FILE ($FILE_SIZE)"

# 显示包含的文件
echo ""
echo "📋 包含的主要文件："
tar -tzf "$DEPLOY_FILE" | head -20

echo ""
echo "🚀 下一步："
echo "   1. 在 Zeabur 控制台进入项目 'xhs'"
echo "   2. 点击 'Add Service' 或选择现有服务"
echo "   3. 选择 'Upload from Local' 或 'Deploy from Archive'"
echo "   4. 上传文件: $PROJECT_DIR/$DEPLOY_FILE"
echo "   5. 配置环境变量并部署"
echo ""
echo "💡 提示：每次修改代码后，运行此脚本重新打包即可！"

