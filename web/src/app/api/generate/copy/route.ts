import { NextResponse } from "next/server";
import OpenAI from "openai";
import { PrismaClient } from "@prisma/client";
import { getVolcApiKey, getGoogleApiKey } from "@/lib/credentials";
import { resolveApiKeyFromStore } from "@/lib/credential-resolver";

const DEFAULT_TEXT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_TEXT_MODEL = "doubao-seed-1-6-lite-251015";
const DEFAULT_GOOGLE_BASE_URL = process.env.GOOGLE_BASE_URL || "https://gitaigc.com/v1";

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

async function getConfig(key: string) {
  try {
    const row = await prisma.systemConfig.findUnique({ where: { key } });
    return row?.value ?? null;
  } catch {
    return null;
  }
}

type CopyOption = {
  title: string;
  body: string;
  tags: string[];
};

function extractJson(text: string): any | null {
  if (!text) return null;
  
  // 1. 先尝试提取 Markdown 代码块中的 JSON（支持多行和转义字符）
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    try {
      const jsonContent = codeBlockMatch[1];
      // 尝试解析，如果失败可能是转义字符问题
      return JSON.parse(jsonContent);
    } catch (e) {
      console.warn("⚠️ Markdown JSON 代码块解析失败，尝试修复:", e);
      // 尝试修复常见的 JSON 格式问题
      try {
        const fixed = codeBlockMatch[1]
          .replace(/,\s*}/g, "}")  // 移除尾随逗号
          .replace(/,\s*]/g, "]")  // 移除数组尾随逗号
          .replace(/([^\\])'/g, '$1"')  // 单引号转双引号（但保留转义的单引号）
          .replace(/^'/g, '"')  // 开头的单引号
          .replace(/'$/g, '"'); // 结尾的单引号
        return JSON.parse(fixed);
      } catch (e2) {
        console.warn("⚠️ JSON 修复后仍解析失败:", e2);
      }
    }
  }
  
  // 2. 移除 Markdown 代码块标记后尝试解析
  let cleaned = text.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
  
  // 3. 尝试提取第一个完整的 JSON 对象（支持多行）
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch (e) {
      console.warn("⚠️ JSON 对象解析失败:", e);
      // 尝试修复常见的 JSON 格式问题
      try {
        const fixed = objMatch[0]
          .replace(/,\s*}/g, "}")  // 移除尾随逗号
          .replace(/,\s*]/g, "]")  // 移除数组尾随逗号
          .replace(/'/g, '"');     // 单引号转双引号
        return JSON.parse(fixed);
      } catch (e2) {
        console.warn("⚠️ JSON 修复后仍解析失败:", e2);
      }
    }
  }
  
  return null;
}

function normalizeBody(body: string): string {
  const text = (body || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n");
  const out: string[] = [];
  let lastBlank = false;
  for (const raw of lines) {
    const line = (raw ?? "").trim();
    if (!line) {
      if (!lastBlank && out.length > 0) {
        out.push("");
        lastBlank = true;
      }
      continue;
    }
    lastBlank = false;
    out.push(line);
  }
  return out.join("\n").trim();
}

function countEmojis(s: string): number {
  if (!s) return 0;
  // 粗略统计：覆盖常见 emoji 区段（足够用于校验“2-4个”）
  const m = s.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu);
  return m ? m.length : 0;
}

function validateCopy(opt: CopyOption): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const title = (opt.title || "").trim();
  const body = (opt.body || "").trim();
  const tags = Array.isArray(opt.tags) ? opt.tags.filter(Boolean) : [];

  if (!title) reasons.push("title 为空");
  if (title.length < 8 || title.length > 20) reasons.push("title 长度不在 8-20");
  const emojiCount = countEmojis(title);
  if (emojiCount < 1 || emojiCount > 4) reasons.push("title emoji 数不在 1-4");

  if (!body) reasons.push("body 为空");
  if (body.length < 100 || body.length > 220) reasons.push("body 长度不在 100-220");
  // 排版：至少 2 段（用空行分段），避免过于紧凑
  const paras = body.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  if (paras.length < 2) reasons.push("body 段落过少（需至少2段，段落间空行）");

  if (tags.length < 8 || tags.length > 10) reasons.push("tags 数量不在 8-10");

  return { ok: reasons.length === 0, reasons };
}

function ensureBodyLayout(body: string): string {
  const normalized = normalizeBody(body);
  const paras = normalized.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  if (paras.length >= 2) return normalized;

  // 兜底：如果模型没分段，按句号/感叹/问号粗分成 2-3 段，至少让页面好读且不紧凑
  const sentences = normalized.split(/(?<=[。！？!？])/).map((x) => x.trim()).filter(Boolean);
  if (sentences.length >= 2) {
    const mid = Math.max(1, Math.floor(sentences.length / 2));
    const p1 = sentences.slice(0, mid).join("");
    const p2 = sentences.slice(mid).join("");
    return [p1, p2].filter((x) => x && x.trim()).join("\n\n").trim();
  }
  return normalized;
}

export async function POST(req: Request) {
  try {
    const { productName, description, imageUrl } = await req.json();

    if (!productName || !description) {
      return NextResponse.json({ error: "productName/description 不能为空" }, { status: 400 });
    }

    const enabled = (await getConfig("COPY_ENGINE_ENABLED")) ?? "true";
    if (enabled === "false") {
      return NextResponse.json({ error: "文案引擎已在后台关闭" }, { status: 400 });
    }

    const baseURL =
      (await getConfig("COPY_ENGINE_BASE_URL")) ||
      process.env.COPY_ENGINE_BASE_URL ||
      process.env.VOLC_BASE_URL ||
      process.env.AI_BASE_URL ||
      process.env.TEXT_BASE_URL ||
      process.env.GOOGLE_BASE_URL ||
      DEFAULT_GOOGLE_BASE_URL;

    const vendor =
      (await getConfig("COPY_ENGINE_VENDOR")) ||
      process.env.COPY_ENGINE_VENDOR ||
      "volc";
    const volcProfile =
      (await getConfig("COPY_ENGINE_CRED_PROFILE")) ||
      process.env.COPY_ENGINE_CRED_PROFILE ||
      "default";
    const store = await resolveApiKeyFromStore({ type: "text", vendor, profile: volcProfile });
    
    // 支持 Google 第三方平台（使用 OpenAI 兼容格式）
    let apiKey = store?.apiKey;
    if (!apiKey && vendor === "google") {
      // 1) 配置中心的 image 凭证（兼容存储）
      const imageStore = await resolveApiKeyFromStore({ type: "image", vendor: "google", profile: volcProfile });
      apiKey = imageStore?.apiKey;
      // 2) 环境变量
      if (!apiKey) apiKey = getGoogleApiKey(volcProfile);
    }
    if (!apiKey && vendor === "volc") {
      apiKey = getVolcApiKey(volcProfile);
    }
    
    if (!apiKey) {
      return NextResponse.json(
        { error: `服务端未配置文案引擎密钥：请在"API管理中心"配置 vendor=${vendor} profile=${volcProfile}，或设置环境变量` },
        { status: 500 }
      );
    }

    let finalBaseURL =
      (await getConfig("COPY_ENGINE_BASE_URL")) ||
      store?.baseURL ||
      baseURL ||
      DEFAULT_GOOGLE_BASE_URL;
    
    // 如果使用 Google 第三方平台，使用其 baseURL
    if (vendor === "google" && !finalBaseURL) {
      const imageStore = await resolveApiKeyFromStore({ type: "image", vendor: "google", profile: volcProfile });
      finalBaseURL = imageStore?.baseURL || DEFAULT_GOOGLE_BASE_URL;
    }

    const modelFromCfg =
      (await getConfig("COPY_ENGINE_MODEL_ID")) ||
      process.env.COPY_ENGINE_MODEL_ID ||
      process.env.AI_MODEL_NAME ||
      (vendor === "google" ? "gemini-1.5-pro-latest" : DEFAULT_TEXT_MODEL);
    
    // 根据供应商调整 System Prompt（融合“小红书标题正文生成专家”要求，强制两篇一致格式）
    let defaultSystemPrompt = `# Role: 小红书标题正文生成专家

## 任务
生成 2 篇完全不同的小红书文案，每篇必须包含：
- title：15-30 字，2-4 个 Emoji，紧扣卖点/场景，避免绝对化/违规词。
- body：300-500 字，段落清晰（每段不超 2-3 行），口语化，含场景/细节/情感共鸣，结尾有互动引导（提问/邀请评论），避免硬广和夸大。
- tags：8-10 个精准标签，不带 #，覆盖关键词/场景/目标人群/风格，且两篇标签至少 50% 差异。
- **两篇输出格式保持一致**：均为「标题」+「正文分段（含要点/列举）」+「标签数组」的 JSON 结构。

## 差异化
- 文案一：偏理性/干货/测评（效果、性价比、步骤/技巧），但保持小红书口语和场景细节。
- 文案二：偏感性/生活方式/故事（氛围感、情绪、品质感），突出使用场景和人物情感。
- 标题/正文/标签需显著不同，杜绝模板化。

## 约束
- 避免硬广、夸大、敏感/绝对化表述（如“最”“第一”）。
- 紧扣产品与卖点，不要空洞复述；如有图片提示可参考想象，但不能捏造不合理效果。
- 全部使用中文与 emoji。

## 排版/风格
- 正文必须分段且有空行，可用要点/列点（如「1.」「-」「•」「✔️」等），每段不超 2-3 行，保持小红书口语与种草节奏。
- 标题/正文/标签整体气质需符合小红书种草风格，避免硬广。

## 输出格式（严格 JSON，无 Markdown/解释）
{
  "options": [
    {"title":"...","body":"...","tags":["..."]},
    {"title":"...","body":"...","tags":["..."]}
  ]
}
正文需包含：开头引子+分点/分段要点（可用列表语气，段落间有空行）+结尾互动；两篇 body 均按此格式输出。
`;
    
    if (vendor === "google") {
      // Google API 需要更明确的 JSON 格式要求
      defaultSystemPrompt = `# Role: 小红书标题正文生成专家

## 任务
生成 2 篇完全不同的小红书文案，每篇必须包含：
- title：15-30 字，2-4 个 Emoji，紧扣卖点/场景，避免绝对化/违规词。
- body：300-500 字，段落清晰（每段不超 2-3 行），口语化，含场景/细节/情感共鸣，结尾有互动引导（提问/邀请评论），避免硬广和夸大。
- tags：8-10 个精准标签，不带 #，覆盖关键词/场景/目标人群/风格，且两篇标签至少 50% 差异。
- **两篇输出格式保持一致**：均为「标题」+「正文分段（含要点/列举）」+「标签数组」的 JSON 结构。

## 差异化
- 文案一：偏理性/干货/测评（效果、性价比、步骤/技巧），但保持小红书口语和场景细节。
- 文案二：偏感性/生活方式/故事（氛围感、情绪、品质感），突出使用场景和人物情感。
- 标题/正文/标签需显著不同，杜绝模板化。

## 约束
- 避免硬广、夸大、敏感/绝对化表述（如“最”“第一”）。
- 紧扣产品与卖点，不要空洞复述；如有图片提示可参考想象，但不能捏造不合理效果。
- 全部使用中文与 emoji。

## 排版/风格
- 正文必须分段且有空行，可用要点/列点（如「1.」「-」「•」「✔️」等），每段不超 2-3 行，保持小红书口语与种草节奏。
- 标题/正文/标签整体气质需符合小红书种草风格，避免硬广。

## 输出格式（严格 JSON，无 Markdown/解释）
{
  "options": [
    {"title":"...","body":"...","tags":["..."]},
    {"title":"...","body":"...","tags":["..."]}
  ]
}
正文需包含：开头引子+分点/分段要点（可用列表语气，段落间有空行）+结尾互动；两篇 body 均按此格式输出。

只返回 JSON，不要其他任何内容。`;
    }
    
    const temperature = Number((await getConfig("COPY_ENGINE_TEMPERATURE")) ?? "0.9");
    const maxTokens = Number((await getConfig("COPY_ENGINE_MAX_TOKENS")) ?? "4096");

    // 2. 分别生成两篇文案，每篇使用不同的提示词
    const client = new OpenAI({
      apiKey,
      baseURL: finalBaseURL,
    });

    // 基础 System Prompt（单篇文案）
    const singleCopySystemPrompt = `你是小红书爆款文案专家。请严格遵守以下要求：

## 核心要求

1. **只生成 1 篇文案**，包含：
   - title：标题（≤20字，1-4个Emoji，吸引眼球但不过度夸张，突出亮点/场景）
   - body：正文（100-200字，必须“有排版”：至少2段，段落间留空行；整体不紧凑，适量Emoji点缀；结尾有轻互动提问）
   - tags：数组（8-10个话题标签，不带#，与内容高度相关，覆盖关键词/场景/人群/风格）

2. **输出格式**：
   - 严格 JSON 格式，不要 Markdown、不要多余文字、不要解释说明
   - ❌ 不要输出"好的，没问题"、"根据您的产品信息"等说明性文字
   - ❌ 不要输出"文案一"、"文案二"等引导性文字
   - ❌ 不要输出分隔线（如"---"）
   - ✅ 只输出纯 JSON 对象，格式如下：
   {\"title\":\"标题（≤20字，含Emoji）\",\"body\":\"正文（100-200字，至少2段，段落间空行，适量Emoji，结尾互动）\",\"tags\":[\"标签1\",\"标签2\",...]}`;

    // 生成两篇（并行以提速）
    console.log("📝 开始生成两篇文案（并行）...");
    const prompt1 = `## 产品信息
**产品名称**：${productName}
**产品卖点**：${description}

## 生成要求
请根据以上产品信息，生成 1 篇小红书爆款文案。

**文案风格要求**：
- **标题角度**：强调效果、性价比、实用性（如"终于找到！这个xxx真的绝了✨💯"）
- **正文风格**：数据对比、使用体验、理性分析、干货分享
- **标签**：偏实用、性价比、功能类（如"好物推荐"、"性价比"、"实用好物"）

**具体要求**：
1. 标题 ≤20 字，带 1-4 个 Emoji，吸引眼球
2. 正文必须 100-200 字；至少 2 段，段落间留空行；整体不紧凑，适量 Emoji 点缀；收尾必须互动提问
3. 标签 8-10 个，匹配内容，偏实用、性价比、功能类，且覆盖“关键词/场景/人群/风格”
4. 整体排版/语气符合小红书种草风格，避免硬广

${imageUrl ? `**已提供参考图**：请结合图片理解产品外观、使用场景、细节特点，在文案中体现出来。` : `**未提供参考图**：请仅基于文字信息生成，可以适当发挥想象，但要符合产品特点。`}

只返回 JSON，不要其他任何内容。`;

    const prompt2 = `## 产品信息
**产品名称**：${productName}
**产品卖点**：${description}

## 生成要求
请根据以上产品信息，生成 1 篇小红书爆款文案。

**文案风格要求**：
- **标题角度**：强调场景、情感、品质感（如"谁懂啊！这个xxx真的绝了💕🔥"）
- **正文风格**：情感共鸣、使用场景、感性种草、生活分享
- **标签**：偏情感、场景、品质类（如"好物分享"、"生活好物"、"种草"）

**具体要求**：
1. 标题 ≤20 字，带 1-4 个 Emoji，吸引眼球
2. 正文必须 100-200 字；至少 2 段，段落间留空行；整体不紧凑，适量 Emoji 点缀；收尾必须互动提问
3. 标签 8-10 个，匹配内容，偏情感、场景、品质类，且覆盖“关键词/场景/人群/风格”
4. 整体排版/语气符合小红书种草风格，避免硬广

${imageUrl ? `**已提供参考图**：请结合图片理解产品外观、使用场景、细节特点，在文案中体现出来。` : `**未提供参考图**：请仅基于文字信息生成，可以适当发挥想象，但要符合产品特点。`}

只返回 JSON，不要其他任何内容。`;

    const [completion1, completion2] = await Promise.all([
      client.chat.completions.create({
        messages: [
          { role: "system", content: singleCopySystemPrompt },
          { 
            role: "user", 
            content: [
              { type: "text", text: prompt1 },
              ...(imageUrl ? [{ type: "image_url", image_url: { url: imageUrl } }] : []),
            ] as any
          }
        ],
        model: modelFromCfg,
        temperature: Number.isFinite(temperature) ? temperature : 0.9,
        max_tokens: Number.isFinite(maxTokens) ? maxTokens : 4096,
      }),
      client.chat.completions.create({
        messages: [
          { role: "system", content: singleCopySystemPrompt },
          { 
            role: "user", 
            content: [
              { type: "text", text: prompt2 },
              ...(imageUrl ? [{ type: "image_url", image_url: { url: imageUrl } }] : []),
            ] as any
          }
        ],
        model: modelFromCfg,
        temperature: Number.isFinite(temperature) ? temperature : 0.9,
        max_tokens: Number.isFinite(maxTokens) ? maxTokens : 4096,
      }),
    ]);

    const raw1 = completion1.choices[0].message.content || "";
    const raw2 = completion2.choices[0].message.content || "";
    console.log("📝 第一篇原始输出:", raw1.substring(0, 300) + "...");
    console.log("📝 第二篇原始输出:", raw2.substring(0, 300) + "...");
    
    // 3. 解析两篇文案
    // 清理并解析第一篇
    let cleanedRaw1 = raw1;
    cleanedRaw1 = cleanedRaw1
      .replace(/^[^]*?(?:好的[，,]没问题[！!]?[^]*?|根据您的[^]*?|我为您[^]*?|精心创作[^]*?|风格迥异[^]*?|一篇偏向[^]*?|另一篇偏向[^]*?)[，,。！!]*\s*/i, "")
      .replace(/^[^]*?(?:以下[^]*?|现在[^]*?|我将[^]*?|为您[^]*?)[，,。！!]*\s*/i, "")
      .replace(/###\s*\*\*文案[一二][：:][^\n]*\*\*/g, "")
      .replace(/---+/g, "")
      .replace(/\*\*文案[一二][：:][^\n]*\*\*/g, "")
      .replace(/^(好的[，,]没问题[。.]?|没问题[，,]|好的[，,]|针对这款[^，,。]*[，,。]|我将[^，,。]*[，,。]|为您[^，,。]*[，,。]|以下[^，,。]*[，,。]|现在[^，,。]*[，,。])/i, "")
      .replace(/^(文案一[：:]|文案二[：:]|第一篇[：:]|第二篇[：:]|###\s*\*\*文案[一二][：:])/i, "")
      .replace(/^\s*[\*\*]*\s*/g, "")
      .trim();
    
    // 清理并解析第二篇
    let cleanedRaw2 = raw2;
    cleanedRaw2 = cleanedRaw2
      .replace(/^[^]*?(?:好的[，,]没问题[！!]?[^]*?|根据您的[^]*?|我为您[^]*?|精心创作[^]*?|风格迥异[^]*?|一篇偏向[^]*?|另一篇偏向[^]*?)[，,。！!]*\s*/i, "")
      .replace(/^[^]*?(?:以下[^]*?|现在[^]*?|我将[^]*?|为您[^]*?)[，,。！!]*\s*/i, "")
      .replace(/###\s*\*\*文案[一二][：:][^\n]*\*\*/g, "")
      .replace(/---+/g, "")
      .replace(/\*\*文案[一二][：:][^\n]*\*\*/g, "")
      .replace(/^(好的[，,]没问题[。.]?|没问题[，,]|好的[，,]|针对这款[^，,。]*[，,。]|我将[^，,。]*[，,。]|为您[^，,。]*[，,。]|以下[^，,。]*[，,。]|现在[^，,。]*[，,。])/i, "")
      .replace(/^(文案一[：:]|文案二[：:]|第一篇[：:]|第二篇[：:]|###\s*\*\*文案[一二][：:])/i, "")
      .replace(/^\s*[\*\*]*\s*/g, "")
      .trim();
    
    // 解析第一篇 JSON
    console.log("📝 第一篇原始内容（前500字）:", raw1.substring(0, 500));
    console.log("📝 第一篇清理后（前500字）:", cleanedRaw1.substring(0, 500));
    
    let parsed1 = extractJson(cleanedRaw1);
    console.log("📝 第一篇解析结果:", parsed1 ? "✅ 成功" : "❌ 失败");
    if (parsed1) console.log("  标题:", parsed1.title || parsed1.Title || "无");
    
    let copy1: CopyOption | null = null;
    
    if (parsed1 && (parsed1.title || parsed1.Title)) {
      copy1 = {
        title: parsed1.title || parsed1.Title || "",
        body: normalizeBody(parsed1.body || parsed1.Body || parsed1.content || parsed1.Content || ""),
        tags: Array.isArray(parsed1.tags) ? parsed1.tags : 
              Array.isArray(parsed1.Tags) ? parsed1.Tags :
              typeof parsed1.tags === "string" ? parsed1.tags.split(/[，,、\s]+/).filter(Boolean) :
              [],
      };
    } else {
      // 尝试从文本中提取
      const titleMatch1 = cleanedRaw1.match(/(?:标题|title)[：:]\s*([^\n]+)/i);
      const bodyMatch1 = cleanedRaw1.match(/(?:正文|body|content)[：:]\s*([\s\S]+?)(?=(?:标签|tags|tag)|$)/i);
      const tagsMatch1 = cleanedRaw1.match(/(?:标签|tags|tag)[：:]\s*([\s\S]+?)(?=\n\n|\n`{3}|$)/i);
      
      if (titleMatch1) {
        copy1 = {
          title: titleMatch1[1].trim(),
          body: bodyMatch1 ? bodyMatch1[1].trim() : "",
          tags: tagsMatch1 ? tagsMatch1[1].trim().split(/[，,、\s#]+/).filter(Boolean) : [],
        };
      } else {
        // 如果还是找不到，尝试从 JSON 代码块字符串中提取（即使解析失败）
        // 支持多行字符串（body 可能包含换行符）
        const jsonBlockMatch = cleanedRaw1.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonBlockMatch) {
          const jsonStr = jsonBlockMatch[1]; // 提取代码块内的内容（不含 ```）
          console.log("📝 从 JSON 代码块中提取内容（前200字）:", jsonStr.substring(0, 200));
          
          // 尝试直接解析（可能包含转义字符）
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.title || parsed.Title) {
          copy1 = {
                title: parsed.title || parsed.Title || "",
            body: normalizeBody(parsed.body || parsed.Body || parsed.content || parsed.Content || ""),
                tags: Array.isArray(parsed.tags) ? parsed.tags : 
                      Array.isArray(parsed.Tags) ? parsed.Tags :
                      typeof parsed.tags === "string" ? parsed.tags.split(/[，,、\s]+/).filter(Boolean) :
                      [],
              };
              console.log("✅ 从 JSON 代码块中解析成功（第一篇）");
            }
          } catch (e) {
            console.warn("⚠️ JSON 代码块解析失败，尝试正则提取:", e);
            // 如果解析失败，使用正则表达式提取（支持多行字符串）
            // 使用非贪婪匹配，但需要处理转义的引号和换行符
            const titleMatch = jsonStr.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            const bodyMatch = jsonStr.match(/"body"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            const tagsMatch = jsonStr.match(/"tags"\s*:\s*\[([^\]]+)\]/);
            
            if (titleMatch || bodyMatch) {
              copy1 = {
                title: titleMatch ? titleMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').trim() : "文案标题",
                body: bodyMatch ? bodyMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').trim() : "",
                tags: tagsMatch ? tagsMatch[1].split(",").map(t => t.trim().replace(/"/g, "").replace(/\\/g, "")).filter(Boolean) : [],
              };
              console.log("✅ 从 JSON 代码块字符串中提取了第一篇文案（正则）");
            }
          }
        }
      }
    }
    
    // 解析第二篇 JSON
    console.log("📝 第二篇原始内容（前500字）:", raw2.substring(0, 500));
    console.log("📝 第二篇清理后（前500字）:", cleanedRaw2.substring(0, 500));
    
    let parsed2 = extractJson(cleanedRaw2);
    console.log("📝 第二篇解析结果:", parsed2 ? "✅ 成功" : "❌ 失败");
    if (parsed2) console.log("  标题:", parsed2.title || parsed2.Title || "无");
    
    let copy2: CopyOption | null = null;
    
    if (parsed2 && (parsed2.title || parsed2.Title)) {
      copy2 = {
        title: parsed2.title || parsed2.Title || "",
        body: normalizeBody(parsed2.body || parsed2.Body || parsed2.content || parsed2.Content || ""),
        tags: Array.isArray(parsed2.tags) ? parsed2.tags : 
              Array.isArray(parsed2.Tags) ? parsed2.Tags :
              typeof parsed2.tags === "string" ? parsed2.tags.split(/[，,、\s]+/).filter(Boolean) :
              [],
      };
      console.log("✅ 第二篇解析成功:", { title: copy2.title.substring(0, 30), bodyLength: copy2.body.length, tagsCount: copy2.tags.length });
    } else {
      // 尝试从文本中提取
      const titleMatch2 = cleanedRaw2.match(/(?:标题|title)[：:]\s*([^\n]+)/i);
      const bodyMatch2 = cleanedRaw2.match(/(?:正文|body|content)[：:]\s*([\s\S]+?)(?=(?:标签|tags|tag)|$)/i);
      const tagsMatch2 = cleanedRaw2.match(/(?:标签|tags|tag)[：:]\s*([\s\S]+?)(?=\n\n|\n`{3}|$)/i);
      
      if (titleMatch2) {
        copy2 = {
          title: titleMatch2[1].trim(),
          body: bodyMatch2 ? bodyMatch2[1].trim() : "",
          tags: tagsMatch2 ? tagsMatch2[1].trim().split(/[，,、\s#]+/).filter(Boolean) : [],
        };
      } else {
        // 如果还是找不到，尝试从 JSON 代码块字符串中提取（即使解析失败）
        // 支持多行字符串（body 可能包含换行符）
        const jsonBlockMatch = cleanedRaw2.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonBlockMatch) {
          const jsonStr = jsonBlockMatch[1]; // 提取代码块内的内容（不含 ```）
          console.log("📝 从 JSON 代码块中提取内容（前200字）:", jsonStr.substring(0, 200));
          
          // 尝试直接解析（可能包含转义字符）
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.title || parsed.Title) {
              copy2 = {
                title: parsed.title || parsed.Title || "",
                body: normalizeBody(parsed.body || parsed.Body || parsed.content || parsed.Content || ""),
                tags: Array.isArray(parsed.tags) ? parsed.tags : 
                      Array.isArray(parsed.Tags) ? parsed.Tags :
                      typeof parsed.tags === "string" ? parsed.tags.split(/[，,、\s]+/).filter(Boolean) :
                      [],
              };
              console.log("✅ 从 JSON 代码块中解析成功（第二篇）");
            }
          } catch (e) {
            console.warn("⚠️ JSON 代码块解析失败，尝试正则提取:", e);
            // 如果解析失败，使用正则表达式提取（支持多行字符串）
            // 使用非贪婪匹配，但需要处理转义的引号和换行符
            const titleMatch = jsonStr.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            const bodyMatch = jsonStr.match(/"body"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            const tagsMatch = jsonStr.match(/"tags"\s*:\s*\[([^\]]+)\]/);
            
            if (titleMatch || bodyMatch) {
              copy2 = {
                title: titleMatch ? titleMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').trim() : "文案标题",
                body: bodyMatch ? bodyMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').trim() : "",
                tags: tagsMatch ? tagsMatch[1].split(",").map(t => t.trim().replace(/"/g, "").replace(/\\/g, "")).filter(Boolean) : [],
              };
              console.log("✅ 从 JSON 代码块字符串中提取了第二篇文案（正则）");
            }
          }
        }
      }
    }
    
    // 验证并修复结构
    if (copy1) {
      if (!copy1.title || !copy1.body) {
        console.warn("⚠️ 第一篇文案结构不完整");
      }
      if (!Array.isArray(copy1.tags) || copy1.tags.length === 0) {
        copy1.tags = ["好物推荐", "性价比", "实用好物"];
      }
    }
    
    if (copy2) {
      if (!copy2.title || !copy2.body) {
        console.warn("⚠️ 第二篇文案结构不完整");
      }
      if (!Array.isArray(copy2.tags) || copy2.tags.length === 0) {
        copy2.tags = ["好物分享", "生活好物", "种草"];
      }
    }
    
    // 如果解析失败，使用兜底方案（但不要显示"文案生成中..."）
    if (!copy1 || !copy2) {
      console.error("❌ 文案解析失败，使用兜底方案");
      
      if (!copy1) {
        // 尝试从原始内容中提取标题（至少提取第一行作为标题）
        const firstLine = raw1.split('\n')[0]?.trim() || cleanedRaw1.split('\n')[0]?.trim() || "";
        const titleFromRaw = firstLine.length > 50 ? firstLine.substring(0, 50) + "..." : firstLine;
        const bodyFromRaw = raw1.length > 500 ? raw1.substring(0, 500) + "..." : raw1;
        
        // 如果 body 包含 JSON 代码块，尝试提取其中的内容
        let finalBody = bodyFromRaw;
        const jsonInBody = bodyFromRaw.match(/```(?:json)?\s*\{[\s\S]*?\}\s*```/);
        if (jsonInBody) {
          try {
            const jsonStr = jsonInBody[1] || jsonInBody[0].replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(jsonStr);
            if (parsed.body) {
              finalBody = parsed.body;
            }
            if (parsed.title && !titleFromRaw) {
              copy1 = {
                title: parsed.title,
                body: parsed.body || finalBody,
                tags: Array.isArray(parsed.tags) ? parsed.tags : ["好物推荐", "性价比", "实用好物"],
              };
            } else {
              copy1 = {
                title: titleFromRaw || parsed.title || "好物推荐",
                body: parsed.body || finalBody,
                tags: Array.isArray(parsed.tags) ? parsed.tags : ["好物推荐", "性价比", "实用好物"],
              };
            }
          } catch {
            copy1 = {
              title: titleFromRaw || "好物推荐",
              body: finalBody.replace(/```(?:json)?/g, "").replace(/```/g, "").trim(),
              tags: ["好物推荐", "性价比", "实用好物"],
            };
          }
        } else {
          copy1 = {
            title: titleFromRaw || "好物推荐",
            body: finalBody,
            tags: ["好物推荐", "性价比", "实用好物"],
          };
        }
        console.log("⚠️ 第一篇使用兜底方案，标题:", copy1.title.substring(0, 30));
      }
      
      if (!copy2) {
        // 尝试从原始内容中提取标题（至少提取第一行作为标题）
        const firstLine = raw2.split('\n')[0]?.trim() || cleanedRaw2.split('\n')[0]?.trim() || "";
        const titleFromRaw = firstLine.length > 50 ? firstLine.substring(0, 50) + "..." : firstLine;
        const bodyFromRaw = raw2.length > 500 ? raw2.substring(0, 500) + "..." : raw2;
        
        // 如果 body 包含 JSON 代码块，尝试提取其中的内容
        let finalBody = bodyFromRaw;
        const jsonInBody = bodyFromRaw.match(/```(?:json)?\s*\{[\s\S]*?\}\s*```/);
        if (jsonInBody) {
          try {
            const jsonStr = jsonInBody[1] || jsonInBody[0].replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(jsonStr);
            if (parsed.body) {
              finalBody = parsed.body;
            }
            if (parsed.title && !titleFromRaw) {
              copy2 = {
                title: parsed.title,
                body: parsed.body || finalBody,
                tags: Array.isArray(parsed.tags) ? parsed.tags : ["好物分享", "生活好物", "种草"],
              };
            } else {
              copy2 = {
                title: titleFromRaw || parsed.title || "好物分享",
                body: parsed.body || finalBody,
                tags: Array.isArray(parsed.tags) ? parsed.tags : ["好物分享", "生活好物", "种草"],
              };
            }
          } catch {
            copy2 = {
              title: titleFromRaw || "好物分享",
              body: finalBody.replace(/```(?:json)?/g, "").replace(/```/g, "").trim(),
              tags: ["好物分享", "生活好物", "种草"],
            };
          }
        } else {
          copy2 = {
            title: titleFromRaw || "好物分享",
            body: finalBody,
            tags: ["好物分享", "生活好物", "种草"],
          };
        }
        console.log("⚠️ 第二篇使用兜底方案，标题:", copy2.title.substring(0, 30));
      }
    }
    
    // 确保两篇文案不同（如果相同，强制差异化）
    if (copy1 && copy2) {
      if (copy1.title === copy2.title && copy1.body === copy2.body) {
        console.warn("⚠️ 检测到两篇文案完全相同，强制差异化...");
        copy2.title = copy2.title.replace(/效果|好用|推荐/g, "场景").replace(/✨/g, "💕");
        copy2.body = "谁懂啊！" + copy2.body;
        copy2.tags = ["好物分享", "生活好物", "种草", "生活分享", "种草清单"];
      }
    }
    
    // 最终清理：确保所有内容都是纯文本，不包含 JSON 代码块或转义字符
    const cleanCopy = (copy: CopyOption): CopyOption => {
      let title = copy.title || "";
      let body = copy.body || "";
      let tags = Array.isArray(copy.tags) ? copy.tags : [];
      
      // 清理 title：移除 JSON 代码块标记、转义字符
      title = title
        .replace(/```(?:json)?/g, "")
        .replace(/```/g, "")
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .trim();
      
      // 清理 body：移除 JSON 代码块标记、正确处理转义字符
      body = body
        .replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/g, "") // 移除完整的 JSON 代码块
        .replace(/```(?:json)?/g, "")
        .replace(/```/g, "")
        .replace(/\\n/g, "\n")  // 转义换行符
        .replace(/\\"/g, '"')   // 转义引号
        .replace(/\\'/g, "'")   // 转义单引号
        .replace(/\\t/g, "\t")  // 转义制表符
        .trim();
      
      // 如果 body 还包含 JSON 结构，尝试提取其中的 body 字段
      if (body.includes('"body"') && body.includes('{')) {
        const bodyMatch = body.match(/"body"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (bodyMatch) {
          body = bodyMatch[1]
            .replace(/\\n/g, "\n")
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .trim();
        }
      }
      
      // 确保 tags 是字符串数组
      tags = tags
        .map(tag => 
        String(tag)
          .replace(/^#/, "")  // 移除开头的 #
          .trim()
      )
        .filter(Boolean)
        .slice(0, 10);
      
      return { title, body: ensureBodyLayout(body), tags };
    };
    
    const retryOnce = async (which: 1 | 2, reasons: string[]) => {
      const basePrompt = which === 1 ? prompt1 : prompt2;
      const repairHint = `\n\n【强制修复指令】你上一次的输出不达标：${reasons.join("；")}。请严格按 JSON 输出 {\"title\":\"...\",\"body\":\"...\",\"tags\":[...]}，并满足：title ≤20字含1-4emoji；body 100-200字，至少2段且段落间空行，整体不紧凑，适量emoji点缀，结尾互动提问；tags 8-10个且与正文一致。只返回 JSON。`;
      const completion = await client.chat.completions.create({
        messages: [
          { role: "system", content: singleCopySystemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: basePrompt + repairHint },
              ...(imageUrl ? [{ type: "image_url", image_url: { url: imageUrl } }] : []),
            ] as any,
          },
        ],
        model: modelFromCfg,
        temperature: 0.65,
        max_tokens: Number.isFinite(maxTokens) ? maxTokens : 4096,
      });
      return completion.choices[0].message.content || "";
    };

    // 先清洗成最终结构
    let opt1 = cleanCopy(copy1 || { title: "", body: "", tags: [] });
    let opt2 = cleanCopy(copy2 || { title: "", body: "", tags: [] });

    // 校验：文案2必须和文案1一样“能看”，不达标则只重试该篇一次
    const v1 = validateCopy(opt1);
    if (!v1.ok) {
      console.warn("⚠️ 文案1未达标，触发重试一次：", v1.reasons);
      const rawRetry = await retryOnce(1, v1.reasons);
      const parsedRetry = extractJson(rawRetry) || extractJson(rawRetry.replace(/```/g, ""));
      if (parsedRetry?.title || parsedRetry?.Title) {
        opt1 = cleanCopy({
          title: parsedRetry.title || parsedRetry.Title || "",
          body: parsedRetry.body || parsedRetry.Body || parsedRetry.content || parsedRetry.Content || "",
          tags: Array.isArray(parsedRetry.tags) ? parsedRetry.tags : Array.isArray(parsedRetry.Tags) ? parsedRetry.Tags : [],
        });
      }
    }

    const v2 = validateCopy(opt2);
    if (!v2.ok) {
      console.warn("⚠️ 文案2未达标，触发重试一次：", v2.reasons);
      const rawRetry = await retryOnce(2, v2.reasons);
      const parsedRetry = extractJson(rawRetry) || extractJson(rawRetry.replace(/```/g, ""));
      if (parsedRetry?.title || parsedRetry?.Title) {
        opt2 = cleanCopy({
          title: parsedRetry.title || parsedRetry.Title || "",
          body: parsedRetry.body || parsedRetry.Body || parsedRetry.content || parsedRetry.Content || "",
          tags: Array.isArray(parsedRetry.tags) ? parsedRetry.tags : Array.isArray(parsedRetry.Tags) ? parsedRetry.Tags : [],
        });
      }
    }

    const finalOptions: CopyOption[] = [opt1, opt2];
    
    console.log(`✅ 最终返回 2 篇文案（已清理）`);
    console.log(`  文案1: 标题=${finalOptions[0]?.title?.substring(0, 30)}..., 正文=${finalOptions[0]?.body?.length || 0}字, 标签=${finalOptions[0]?.tags?.length || 0}个`);
    console.log(`  文案2: 标题=${finalOptions[1]?.title?.substring(0, 30)}..., 正文=${finalOptions[1]?.body?.length || 0}字, 标签=${finalOptions[1]?.tags?.length || 0}个`);
    
    return NextResponse.json({ options: finalOptions });
  } catch (error: any) {
    console.error("文案生成失败:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
