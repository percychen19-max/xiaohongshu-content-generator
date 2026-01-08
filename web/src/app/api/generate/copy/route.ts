import { NextResponse } from "next/server";
import OpenAI from "openai";
import { PrismaClient } from "@prisma/client";
import { getVolcApiKey } from "@/lib/credentials";
import { resolveApiKeyFromStore } from "@/lib/credential-resolver";

const DEFAULT_TEXT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_TEXT_MODEL = "doubao-seed-1-6-lite-251015";

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
      process.env.VOLC_BASE_URL ||
      process.env.AI_BASE_URL ||
      process.env.TEXT_BASE_URL ||
      DEFAULT_TEXT_BASE_URL;

    const vendor = (await getConfig("COPY_ENGINE_VENDOR")) || "volc";
    const volcProfile = (await getConfig("COPY_ENGINE_CRED_PROFILE")) || "default";
    const store = await resolveApiKeyFromStore({ type: "text", vendor, profile: volcProfile });
    
    // 支持 Google 第三方平台（使用 OpenAI 兼容格式）
    let apiKey = store?.apiKey;
    if (!apiKey && vendor === "google") {
      // Google 第三方平台可能使用图片凭证
      const imageStore = await resolveApiKeyFromStore({ type: "image", vendor: "google", profile: volcProfile });
      apiKey = imageStore?.apiKey;
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

    let finalBaseURL = (await getConfig("COPY_ENGINE_BASE_URL")) || store?.baseURL || baseURL;
    
    // 如果使用 Google 第三方平台，使用其 baseURL
    if (vendor === "google" && !finalBaseURL) {
      const imageStore = await resolveApiKeyFromStore({ type: "image", vendor: "google", profile: volcProfile });
      finalBaseURL = imageStore?.baseURL || "https://gitaigc.com/v1";
    }

    const modelFromCfg = (await getConfig("COPY_ENGINE_MODEL_ID")) || process.env.AI_MODEL_NAME || (vendor === "google" ? "gemini-1.5-pro-latest" : DEFAULT_TEXT_MODEL);
    
    // 根据供应商调整 System Prompt
    let defaultSystemPrompt = `你是小红书爆款文案专家，深谙小红书平台的文案风格和用户喜好。请严格遵守以下要求：

## 核心要求

1. **必须生成 2 篇完全不同的文案**，不能重复或相似
   - 两篇文案的标题角度必须完全不同（如：一篇强调使用效果，另一篇强调使用场景；一篇强调性价比，另一篇强调品质感）
   - 两篇文案的正文风格必须完全不同（如：一篇偏理性分析+数据对比，另一篇偏感性种草+情感共鸣）
   - 两篇文案的标签要有明显差异（至少 50% 的标签不同）

2. **每篇文案必须包含**：
   - **title**：标题（必须带 2-4 个 Emoji，吸引眼球，15-30 字）
   - **body**：正文（必须详细丰富，200-500 字，分段清晰，口语化表达）
   - **tags**：数组（5-10 个话题标签，不带 #，要精准匹配内容）

## 小红书文案风格要求

### 标题要求：
- 必须包含 2-4 个 Emoji（如：✨、💕、🔥、🎉、⭐️、💯 等）
- 要有吸引力，能引起用户点击欲望
- 可以包含数字、疑问句、感叹句等
- 示例风格：「终于找到！这个xxx真的绝了✨💯」「用了3个月，xxx真的值得安利🔥」

### 正文要求：
- **必须详细丰富**：200-500 字，不能简短敷衍
- **分段清晰**：使用空行或 Emoji 分隔不同段落
- **口语化表达**：使用"真的"、"绝了"、"谁懂啊"、"姐妹们"等口语化词汇
- **真实感强**：要有使用体验、对比感受、具体场景描述
- **数字卖点**：可以包含具体数字（如"3个月"、"99元"、"5分钟"等）
- **情感共鸣**：要有情感表达，让用户产生共鸣
- **结构完整**：开头吸引+中间详细+结尾总结或呼吁

### 标签要求：
- 5-10 个精准标签
- 要匹配文案内容，不能随意添加
- 可以包含产品类型、使用场景、目标人群等

## 两篇文案的差异化要求

**文案一**：可以偏理性分析风格
- 标题角度：强调效果、性价比、实用性
- 正文风格：数据对比、使用体验、理性分析
- 标签：偏实用、性价比、功能类

**文案二**：可以偏感性种草风格
- 标题角度：强调场景、情感、品质感
- 正文风格：情感共鸣、使用场景、感性种草
- 标签：偏情感、场景、品质类

## 输出格式

**严格 JSON 格式，不要 Markdown、不要多余文字、不要解释说明**：
- ❌ 不要输出"好的，没问题"、"根据您的产品信息"等说明性文字
- ❌ 不要输出"文案一"、"文案二"等引导性文字
- ❌ 不要输出"### **文案一:理性分析风格..."等 Markdown 格式的说明
- ❌ 不要输出分隔线（如"---"）
- ✅ 只输出纯 JSON 对象，格式如下：

{\"options\":[{\"title\":\"标题1（带Emoji）\",\"body\":\"详细丰富的正文内容（200-500字）\",\"tags\":[\"标签1\",\"标签2\",...]},{\"title\":\"标题2（带Emoji，完全不同角度）\",\"body\":\"详细丰富的正文内容（200-500字，完全不同风格）\",\"tags\":[\"标签1\",\"标签2\",...]}]}`;
    
    if (vendor === "google") {
      // Google API 需要更明确的 JSON 格式要求
      defaultSystemPrompt = `你是小红书爆款文案专家，深谙小红书平台的文案风格和用户喜好。你必须只返回一个有效的 JSON 对象，不要任何 Markdown 格式、不要任何解释文字、不要代码块标记。

**核心要求**：
1. 必须生成 2 篇完全不同的文案，不能重复或相似
2. 两篇文案的标题角度必须完全不同（如：一篇强调效果，另一篇强调场景）
3. 两篇文案的正文风格必须完全不同（如：一篇偏理性分析，另一篇偏感性种草）
4. 两篇文案的标签要有明显差异（至少 50% 的标签不同）

**每篇文案要求**：
- title：标题（必须带 2-4 个 Emoji，15-30 字，吸引眼球）
- body：正文（必须详细丰富，200-500 字，分段清晰，口语化表达，真实感强）
- tags：数组（5-10 个精准标签，不带 #，匹配内容）

**小红书文案风格**：
- 标题要有 Emoji，吸引眼球
- 正文要详细丰富（200-500 字），口语化，有真实感，有情感共鸣
- 标签要精准匹配内容

返回格式必须是：
{\"options\":[{\"title\":\"标题1（带Emoji）\",\"body\":\"详细丰富的正文内容（200-500字）\",\"tags\":[\"标签1\",\"标签2\"]},{\"title\":\"标题2（带Emoji，完全不同角度）\",\"body\":\"详细丰富的正文内容（200-500字，完全不同风格）\",\"tags\":[\"标签1\",\"标签2\"]}]}

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
   - title：标题（带2-4个Emoji，15-30字，吸引眼球，突出亮点）
   - body：正文（200-500字，分段清晰，口语化，真实感强，情感共鸣，可含数字卖点和使用体验）
   - tags：数组（5-10个话题标签，不带#，与内容高度相关）

2. **输出格式**：
   - 严格 JSON 格式，不要 Markdown、不要多余文字、不要解释说明
   - ❌ 不要输出"好的，没问题"、"根据您的产品信息"等说明性文字
   - ❌ 不要输出"文案一"、"文案二"等引导性文字
   - ❌ 不要输出分隔线（如"---"）
   - ✅ 只输出纯 JSON 对象，格式如下：
   {\"title\":\"标题（带Emoji）\",\"body\":\"详细丰富的正文内容（200-500字）\",\"tags\":[\"标签1\",\"标签2\",...]}`;

    // 生成第一篇：理性分析风格
    console.log("📝 开始生成第一篇文案（理性分析风格）...");
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
1. 标题必须带 2-4 个 Emoji，15-30 字，吸引眼球
2. 正文必须详细丰富（200-500 字），分段清晰，口语化表达，真实感强
3. 标签 5-10 个，匹配内容，偏实用、性价比、功能类

${imageUrl ? `**已提供参考图**：请结合图片理解产品外观、使用场景、细节特点，在文案中体现出来。` : `**未提供参考图**：请仅基于文字信息生成，可以适当发挥想象，但要符合产品特点。`}

只返回 JSON，不要其他任何内容。`;

    const completion1 = await client.chat.completions.create({
      messages: [
        {
          role: "system",
          content: singleCopySystemPrompt,
        },
        { 
          role: "user", 
          content: [
            {
              type: "text",
              text: prompt1,
            },
            ...(imageUrl ? [{ type: "image_url", image_url: { url: imageUrl } }] : []),
          ] as any
        }
      ],
      model: modelFromCfg,
      temperature: Number.isFinite(temperature) ? temperature : 0.9,
      max_tokens: Number.isFinite(maxTokens) ? maxTokens : 4096,
    });

    const raw1 = completion1.choices[0].message.content || "";
    console.log("📝 第一篇原始输出:", raw1.substring(0, 300) + "...");

    // 生成第二篇：感性种草风格
    console.log("📝 开始生成第二篇文案（感性种草风格）...");
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
1. 标题必须带 2-4 个 Emoji，15-30 字，吸引眼球
2. 正文必须详细丰富（200-500 字），分段清晰，口语化表达，真实感强
3. 标签 5-10 个，匹配内容，偏情感、场景、品质类

${imageUrl ? `**已提供参考图**：请结合图片理解产品外观、使用场景、细节特点，在文案中体现出来。` : `**未提供参考图**：请仅基于文字信息生成，可以适当发挥想象，但要符合产品特点。`}

只返回 JSON，不要其他任何内容。`;

    const completion2 = await client.chat.completions.create({
      messages: [
        {
          role: "system",
          content: singleCopySystemPrompt,
        },
        { 
          role: "user", 
          content: [
            {
              type: "text",
              text: prompt2,
            },
            ...(imageUrl ? [{ type: "image_url", image_url: { url: imageUrl } }] : []),
          ] as any
        }
      ],
      model: modelFromCfg,
      temperature: Number.isFinite(temperature) ? temperature : 0.9,
      max_tokens: Number.isFinite(maxTokens) ? maxTokens : 4096,
    });

    const raw2 = completion2.choices[0].message.content || "";
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
        body: parsed1.body || parsed1.Body || parsed1.content || parsed1.Content || "",
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
                body: parsed.body || parsed.Body || parsed.content || parsed.Content || "",
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
        body: parsed2.body || parsed2.Body || parsed2.content || parsed2.Content || "",
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
                body: parsed.body || parsed.Body || parsed.content || parsed.Content || "",
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
      tags = tags.map(tag => 
        String(tag)
          .replace(/^#/, "")  // 移除开头的 #
          .trim()
      ).filter(Boolean);
      
      return { title, body, tags };
    };
    
    const finalOptions: CopyOption[] = [
      cleanCopy(copy1!),
      cleanCopy(copy2!)
    ];
    
    console.log(`✅ 最终返回 2 篇文案（已清理）`);
    console.log(`  文案1: 标题=${finalOptions[0]?.title?.substring(0, 30)}..., 正文=${finalOptions[0]?.body?.length || 0}字, 标签=${finalOptions[0]?.tags?.length || 0}个`);
    console.log(`  文案2: 标题=${finalOptions[1]?.title?.substring(0, 30)}..., 正文=${finalOptions[1]?.body?.length || 0}字, 标签=${finalOptions[1]?.tags?.length || 0}个`);
    
    return NextResponse.json({ options: finalOptions });
  } catch (error: any) {
    console.error("文案生成失败:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
