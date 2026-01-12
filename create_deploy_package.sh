#!/bin/bash
# 创建 Zeabur 部署包
# 用于从 Cursor 本地项目直接部署到 Zeabur

set -e

PROJECT_DIR="/Users/percy/xhs/xiaohongshu-content-generator"
WEB_DIR="web 2"  # 实际的项目目录
DEPLOY_FILE="deploy.tar.gz"

echo "📦 开始创建部署包..."

cd "$PROJECT_DIR"

# 清理旧的部署包
if [ -f "$DEPLOY_FILE" ]; then
    echo "🗑️  删除旧的部署包..."
    rm "$DEPLOY_FILE"
fi

# 创建新的部署包（从 web 2 目录）
echo "📦 打包项目文件（从 $WEB_DIR 目录）..."
cd "$WEB_DIR"
tar -czf "../$DEPLOY_FILE" \
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
  .

cd ..

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
echo "   2. 点击应用服务 'xiaohongshu-content-generator'"
echo "   3. 在 Settings → Source 中重新上传: $PROJECT_DIR/$DEPLOY_FILE"
echo "   4. 等待重新部署"
echo ""
echo "💡 提示：每次修改代码后，运行此脚本重新打包即可！"
