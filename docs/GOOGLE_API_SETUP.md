# Google API 配置指南（香港地区解决方案）

由于香港地区无法直接使用 Google 官方 API，本文档提供几种可行的解决方案。

## 方案 1：使用 VPN + 官方 API（推荐用于测试）

### 步骤：

1. **获取 Google API Key**
   - 使用 VPN 连接到支持 Google 服务的地区（如美国、日本等）
   - 访问 [Google AI Studio](https://aistudio.google.com/)
   - 创建 API Key

2. **配置系统**
   - 进入 **API 管理中心** (`/admin/credentials`)
   - 点击 **新增凭证**
   - 选择 **Quick: Google Gemini（配图）**
   - 输入你的 Google API Key
   - 保存

3. **配置引擎**
   - 进入 **引擎配置** (`/admin/engines`)
   - 在 **配图引擎** 部分：
     - 供应商：选择 `google`
     - 模型 ID：`gemini-2.5-flash-image`
     - 凭证 profile：选择你配置的 profile

4. **启用 HTTP 模式（如果 SDK 无法使用）**
   - 在 **引擎配置** 页面，找到 **高级设置**
   - 添加配置项 `IMAGE_ENGINE_USE_HTTP` = `true`
   - 这样会使用 HTTP 直接调用，绕过 SDK 限制

## 方案 2：使用第三方代理平台

### 选项 A：Nano Banana API

1. **注册账号**
   - 访问第三方平台（如 nanobananaapi.org）
   - 注册并获取 API Key

2. **配置系统**
   - 进入 **API 管理中心** (`/admin/credentials`)
   - 新增凭证：
     - 类型：配图（Image）
     - 厂商：`google`
     - profile：`default`（或自定义）
     - API Key：输入第三方平台的 API Key
     - baseURL：输入第三方平台的 API endpoint（如果有）

3. **配置供应商**
   - 进入 **供应商管理** (`/admin/providers`)
   - 新增供应商：
     - 类型：配图（Image）
     - 名称：`Google Gemini（第三方代理）`
     - 厂商：`google`
     - baseURL：第三方平台的 API endpoint
     - 默认模型：`gemini-2.5-flash-image`
     - 凭证 profile：选择你配置的 profile

4. **配置引擎**
   - 进入 **引擎配置** (`/admin/engines`)
   - 在 **配图引擎** 部分：
     - 供应商：选择 `google`
     - 模型 ID：`gemini-2.5-flash-image`
     - baseURL：第三方平台的 API endpoint（如果与供应商不同）
     - 凭证 profile：选择你配置的 profile

5. **启用 HTTP 模式**
   - 在 **引擎配置** 页面，添加配置项 `IMAGE_ENGINE_USE_HTTP` = `true`

## 方案 3：使用环境变量（适合开发测试）

在 `.env.local` 文件中添加：

```bash
# Google API Key（从第三方平台获取或通过 VPN 获取官方 Key）
GOOGLE_API_KEY=你的_API_Key

# 如果使用第三方平台，设置其 baseURL
IMAGE_ENGINE_BASE_URL=https://第三方平台的API地址

# 启用 HTTP 模式（绕过 SDK）
IMAGE_ENGINE_USE_HTTP=true
```

然后在 **引擎配置** 中：
- 供应商：`google`
- 模型 ID：`gemini-2.5-flash-image`

## 技术说明

### HTTP 调用模式

当设置了 `IMAGE_ENGINE_USE_HTTP=true` 或配置了自定义 `baseURL` 时，系统会使用 HTTP 直接调用 Google API，而不是通过官方 SDK。这样可以：

1. **绕过地区限制**：通过代理服务器访问
2. **支持第三方平台**：使用兼容 Google API 格式的第三方服务
3. **更灵活**：可以自定义 API endpoint

### API 调用格式

HTTP 模式使用的 API 格式：

```
POST {baseURL}/models/{model}:generateContent?key={apiKey}
Content-Type: application/json

{
  "contents": [
    {
      "parts": [
        {
          "text": "你的提示词"
        }
      ]
    }
  ]
}
```

响应格式：

```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "inlineData": {
              "data": "base64编码的图片数据"
            }
          }
        ]
      }
    }
  ]
}
```

## 常见问题

### Q: SDK 调用失败怎么办？

A: 系统会自动降级到 HTTP 模式。你也可以手动设置 `IMAGE_ENGINE_USE_HTTP=true`。

### Q: 如何确认使用的是 HTTP 模式？

A: 查看服务器日志，如果看到 "Google SDK 调用失败，尝试 HTTP 方式" 或直接使用 HTTP 调用，说明已启用 HTTP 模式。

### Q: 第三方平台的 API 格式不同怎么办？

A: 如果第三方平台的 API 格式与 Google 官方不同，需要修改 `web/src/lib/google.ts` 中的 `generateImageViaHttp` 函数来适配。

## 推荐方案

- **快速测试**：使用方案 1（VPN + 官方 API）
- **生产环境**：使用方案 2（第三方代理平台，更稳定）
- **开发调试**：使用方案 3（环境变量，最简单）

