#!/bin/bash
# 清理 Git 历史中的 API 密钥
# ⚠️ 警告：这会重写 Git 历史，需要强制推送

echo "⚠️  警告：此操作会重写 Git 历史！"
echo "请确保："
echo "1. 已备份所有重要数据"
echo "2. 已通知所有协作者"
echo "3. 已准备好强制推送"
echo ""
read -p "是否继续？(yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "已取消"
    exit 1
fi

# 要清理的 API 密钥（请自行填入你曾经泄露/误提交到仓库的 key）
# 例如：
# KEYS=(
#   "sk-xxx"
#   "sk-yyy"
# )
KEYS=()

# 使用 git filter-branch 清理
for key in "${KEYS[@]}"; do
    echo "正在清理密钥: ${key:0:20}..."
    git filter-branch --force --index-filter \
        "git rm --cached --ignore-unmatch -r . && git reset --hard" \
        --prune-empty --tag-name-filter cat -- --all
    
    # 替换密钥为空字符串
    git filter-branch --force --tree-filter \
        "find . -type f -exec sed -i '' 's/$key//g' {} + 2>/dev/null || true" \
        --prune-empty --tag-name-filter cat -- --all
done

echo ""
echo "✅ 清理完成"
echo ""
echo "下一步："
echo "1. 检查清理结果: git log --all"
echo "2. 如果满意，强制推送: git push origin --force --all"
echo "3. ⚠️  注意：强制推送会影响所有协作者，请谨慎操作"

