# 部署环境变量（生产推荐）

## 核心原则

- **密钥只放服务器环境变量**（Vercel/云函数/宝塔/Docker/PM2 的环境变量面板），不要写进代码或后台数据库。
- 后台（`/admin/engines`）只配置 **模板/模型ID/baseURL（可选）/开关/凭证 profile（名称）**，方便你随时调整而不改代码。

---

## 文案引擎 & 生图提示词引擎（Text）

这两步都走 **OpenAI SDK 兼容**的接口（当前默认火山方舟 Ark）：

- **文案生成**：`POST /api/generate/copy`
- **6 条生图提示词生成**：`POST /api/generate/image-prompts`

### 需要的环境变量（至少一个 Key）

优先使用：

- `VOLC_API_KEY`
- （可选，多套账号）`VOLC_API_KEY_<PROFILE>`，例如 `VOLC_API_KEY_primary`、`VOLC_API_KEY_backup`
- `VOLC_BASE_URL`（默认 `https://ark.cn-beijing.volces.com/api/v3`）
- `VOLC_TEXT_MODEL`（可选）

兼容旧变量名（若你之前用过）：

- `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL_NAME`
- `TEXT_API_KEY` / `TEXT_BASE_URL`

---

## 配图引擎（Image / DashScope）

用于单张生图（工作台循环 6 次调用）：

- **单张生图**：`POST /api/generate/image/one`

### 需要的环境变量

- `DASHSCOPE_API_KEY`
- （可选，多套账号）`DASHSCOPE_API_KEY_<PROFILE>`，例如 `DASHSCOPE_API_KEY_primary`
- `DASHSCOPE_BASE_URL`（默认 `https://dashscope.aliyuncs.com/api/v1`）
- `DASHSCOPE_MODEL`（可选）

兼容旧变量名：

- `IMAGE_API_KEY`
- `IMAGE_BASE_URL`

---

## 抠图（阿里云 ImageSeg SDK）

当你上传了参考图时，后端会先抠图（若抠图失败会自动降级为使用原图，不影响跑通）。

需要的环境变量（推荐用阿里云 SDK 的标准名）：

- `ALIBABA_CLOUD_ACCESS_KEY_ID`
- `ALIBABA_CLOUD_ACCESS_KEY_SECRET`
- （可选，多套账号）`ALIBABA_CLOUD_ACCESS_KEY_ID_<PROFILE>` / `ALIBABA_CLOUD_ACCESS_KEY_SECRET_<PROFILE>`

兼容旧变量名：

- `ALIYUN_ACCESS_KEY`
- `ALIYUN_SECRET_KEY`

---

## 登录会话（生产务必修改）

- `JWT_SECRET`

---

## 短信服务（阿里云）

用于用户登录/注册时的验证码发送：

- `ALIYUN_SMS_ACCESS_KEY_ID`：阿里云 AccessKey ID
- `ALIYUN_SMS_ACCESS_KEY_SECRET`：阿里云 AccessKey Secret
- `ALIYUN_SMS_SIGN_NAME`：短信签名名称（默认：`小红书爆文生成`）
- `ALIYUN_SMS_TEMPLATE_CODE`：短信模板 CODE（格式：`SMS_xxxxx`）

**详细配置步骤请参考**：`docs/ALIYUN_SMS_SETUP.md`

---

## 管理后台登录（账号密码）

用于管理后台的独立登录系统：

- `ADMIN_USERNAME`：管理员账号
- `ADMIN_PASSWORD`：管理员密码

**⚠️ 生产环境务必配置强密码！**

**注意**：
- 管理后台使用独立的登录系统（账号+密码）
- 普通用户使用手机号+验证码登录
- 两者互不干扰

**注意**：
- 如果未配置短信服务，开发环境下会自动降级为开发模式（验证码在控制台输出）
- 生产环境必须配置真实的短信服务

---

## “后台配置”与“接口环节”如何对应

- **文案提示词（System Prompt）**：后台 `COPY_ENGINE_SYSTEM_PROMPT` → 影响 `/api/generate/copy`
- **文案模型ID**：后台 `COPY_ENGINE_MODEL_ID` → 同时影响 `/api/generate/copy` 与 `/api/generate/image-prompts`
- **文案凭证 profile（只存名称）**：后台 `COPY_ENGINE_CRED_PROFILE` → 选择 `VOLC_API_KEY_<PROFILE>`（找不到则回退 `VOLC_API_KEY`）
- **生图提示词模板（{{copy}}）**：后台 `XHS_IMAGE_PROMPT_TEMPLATE` → 影响 `/api/generate/image-prompts`
- **生图模型ID**：后台 `IMAGE_ENGINE_MODEL_ID` → 影响 `/api/generate/image/one`
- **生图默认 negative_prompt / prompt_extend**：后台 `IMAGE_ENGINE_NEGATIVE_PROMPT`、`IMAGE_ENGINE_PROMPT_EXTEND` → 影响 `/api/generate/image/one`
- **配图凭证 profile（只存名称）**：后台 `IMAGE_ENGINE_CRED_PROFILE` → 选择 `DASHSCOPE_API_KEY_<PROFILE>`（找不到则回退 `DASHSCOPE_API_KEY`）
- **抠图凭证 profile（只存名称）**：后台 `IMAGESEG_CRED_PROFILE` → 选择 `ALIBABA_CLOUD_ACCESS_KEY_*_<PROFILE>`（找不到则回退默认）


