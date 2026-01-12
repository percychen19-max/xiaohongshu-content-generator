# 📋 环境变量 - 一键复制版

## 方式 1：如果 Zeabur 支持批量导入（推荐）

在 Zeabur 控制台的环境变量设置中，查找是否有：
- "Import from File" 按钮
- "Bulk Import" 选项
- "Paste Variables" 功能

如果有，可以使用下面的格式：

### JSON 格式（如果支持）：
```json
{
  "DATABASE_URL": "从PostgreSQL服务复制",
  "JWT_SECRET": "xhs_secure_2026_production_key_change_me",
  "NODE_ENV": "production",
  "PORT": "3000",
  "ADMIN_USERNAME": "admin",
  "ADMIN_PASSWORD": "admin123",
  "COPY_ENGINE_VENDOR": "google",
  "COPY_ENGINE_MODEL_ID": "gemini-1.5-pro-latest",
  "COPY_ENGINE_BASE_URL": "https://gitaigc.com/v1",
  "GOOGLE_API_KEY": "你的Google_API_密钥",
  "IMAGE_ENGINE_VENDOR": "google",
  "IMAGE_ENGINE_MODEL_ID": "gemini-2.5-flash-image",
  "IMAGE_ENGINE_BASE_URL": "https://gitaigc.com/v1",
  "DASHSCOPE_API_KEY": "你的阿里云API密钥",
  "DASHSCOPE_BASE_URL": "https://dashscope.aliyuncs.com/api/v1"
}
```

---

## 方式 2：如果只能逐个添加（更常见）

### 快速复制列表（每行一个变量）

复制下面的内容，然后：
1. 在 Zeabur 中点击 "Add Variable"
2. 复制第一行的变量名和值
3. 粘贴并保存
4. 重复添加下一个

```
变量名: DATABASE_URL
值: 从PostgreSQL服务复制（必须替换）

变量名: JWT_SECRET
值: xhs_secure_2026_production_key_change_me

变量名: NODE_ENV
值: production

变量名: PORT
值: 3000

变量名: ADMIN_USERNAME
值: admin

变量名: ADMIN_PASSWORD
值: admin123

变量名: COPY_ENGINE_VENDOR
值: google

变量名: COPY_ENGINE_MODEL_ID
值: gemini-1.5-pro-latest

变量名: COPY_ENGINE_BASE_URL
值: https://gitaigc.com/v1

变量名: GOOGLE_API_KEY
值: 你的Google_API_密钥（必须替换）

变量名: IMAGE_ENGINE_VENDOR
值: google

变量名: IMAGE_ENGINE_MODEL_ID
值: gemini-2.5-flash-image

变量名: IMAGE_ENGINE_BASE_URL
值: https://gitaigc.com/v1

变量名: DASHSCOPE_API_KEY
值: 你的阿里云API密钥（可选）

变量名: DASHSCOPE_BASE_URL
值: https://dashscope.aliyuncs.com/api/v1
```

---

## ⚠️ 必须修改的两个值

1. **DATABASE_URL** - 从 PostgreSQL 服务中复制
2. **GOOGLE_API_KEY** - 你的真实 Google API 密钥

其他值可以直接复制使用。

---

## 💡 提示

如果 Zeabur 支持 "Import" 或 "Bulk Add" 功能，告诉我，我可以帮你准备对应的格式。

