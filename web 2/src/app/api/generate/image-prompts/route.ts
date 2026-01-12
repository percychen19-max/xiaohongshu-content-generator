import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import { getVolcApiKey, getGoogleApiKey } from "@/lib/credentials";
import { resolveApiKeyFromStore } from "@/lib/credential-resolver";

export const runtime = "nodejs";

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

async function getConfig(key: string): Promise<string | null> {
  try {
    const row = await prisma.systemConfig.findUnique({ where: { key } });
    return row?.value ?? null;
  } catch {
    return null;
  }
}

function tryParseJsonArray(text: string): string[] | null {
  if (!text) return null;
  const cleaned = text.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    return null;
  } catch {
    return null;
  }
}

function validateOnePrompt(p: string) {
  const s = (p || "").trim();
  if (!s) return { ok: false, reason: "为空" };
  // 放宽：不强制“字段名必须出现”，只控制大致长度，避免极端跑偏
  if (s.length < 16 || s.length > 220) return { ok: false, reason: `长度不合规(${s.length})` };
  return { ok: true as const };
}

function validatePrompts(list: string[]) {
  const errors: string[] = [];
  if (list.length !== 6) errors.push(`数量不等于6(当前${list.length})`);
  list.slice(0, 6).forEach((p, i) => {
    const v = validateOnePrompt(p);
    if (!v.ok) errors.push(`第${i + 1}条:${v.reason}`);
  });
  return { ok: errors.length === 0, errors };
}

const DEFAULT_TEXT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_GOOGLE_BASE_URL = process.env.GOOGLE_BASE_URL || "https://gitaigc.com/v1";
const DEFAULT_TEXT_MODEL = "doubao-seed-1-6-lite-251015";

export async function POST(req: Request) {
  try {
    const { copy, productName, description } = await req.json();
    if (!copy) return NextResponse.json({ error: "copy 不能为空" }, { status: 400 });

    const promptTemplate =
      (await getConfig("XHS_IMAGE_PROMPT_TEMPLATE")) ||
      `# 角色
你是小红书爆款配图生成助手，依据标题+正文生成 6 个高质量提示词，帮助图文吸睛、易传播。

## 核心输入
【产品】{{productName}}
【卖点】{{description}}
【文案】{{copy}}

## 技能摘要
- 深度解析：提取主题类型、关键动作/产品、情绪/氛围、场景设定、核心观点。
- 差异化 6 类：氛围感场景、情感共鸣、细节特写/产品展示、使用动作瞬间、空间陈列、质感光影；可按内容灵活调整，但需多样性。
- 平台趋势：可结合“新中式茶系、低饱和莫兰迪、都市废墟感、微醺氛围感、真实生活感”等 2025 热门审美；关键词可含“高清细节、真实光影、轻量化构图、少即是多”。

## 输出要求
- 仅 6 条提示词；每条 30-50 字。
- 每条包含：主体 + 场景 + 光线 + 风格 + 核心元素；禁止只写“白底/纯色”。
- 与标题/正文/产品强相关，禁止编造无关元素；如信息缺失（场景/人群等），请在提示词里用中性描述，不虚构无关内容。
- 风格多样，不重复同一方向；允许有一条信息图/符号化提示词。
- 重要：所有图片必须“纯画面”，绝对不要出现任何可读文字/标语/海报字/字幕/水印/Logo/二维码/界面UI/书脊可读字；避免“清单/教程/对比/信息图/箭头标注”等会引导文字的描述。
- 重要：如画面需要人物（模特），请先在心中确定一套“固定模特设定”（例如：同一位年轻女性模特、发型/妆容/穿搭/气质描述），并把这套设定嵌入到每一条提示词中，确保 6 张图模特一致（同一个人）。
- 若用户缺少关键信息（如只写“护肤”），请在结果前补一句：请补充内容细节（如肤质/季节/目标场景），但仍给出 6 条可用提示。`;

    const forceFormatHint =
      "\n\n输出要求：\n- 只输出 JSON 数组字符串（不要 Markdown/不要解释）。\n- 数组长度必须为6。\n- 每条尽量包含：主体/场景/光线/风格/核心元素（但不要为了格式牺牲自然度）。\n- 再强调一次：不要任何可读文字/标语/字幕/水印/Logo/二维码/界面UI。\n";

    const userPrompt = promptTemplate
      .replace(/\{\{copy\}\}/g, copy)
      .replace(/\{\{productName\}\}/g, productName || "未知产品")
      .replace(/\{\{description\}\}/g, description || "无卖点描述") + forceFormatHint;

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
    let apiKey = store?.apiKey || (vendor === "volc" ? getVolcApiKey(volcProfile) : "");
    if (!apiKey && vendor === "google") {
      const imageStore = await resolveApiKeyFromStore({ type: "image", vendor: "google", profile: volcProfile });
      apiKey = imageStore?.apiKey || getGoogleApiKey(volcProfile);
    }
    if (!apiKey) {
      return NextResponse.json(
        { error: `服务端未配置文案引擎密钥：请在“API管理中心”配置 vendor=${vendor} profile=${volcProfile}，或设置环境变量` },
        { status: 500 }
      );
    }
    const model =
      (await getConfig("COPY_ENGINE_MODEL_ID")) ||
      process.env.COPY_ENGINE_MODEL_ID ||
      process.env.AI_MODEL_NAME ||
      DEFAULT_TEXT_MODEL;

    const finalBaseURL =
      (await getConfig("COPY_ENGINE_BASE_URL")) ||
      store?.baseURL ||
      baseURL ||
      DEFAULT_GOOGLE_BASE_URL;
    const client = new OpenAI({ apiKey, baseURL: finalBaseURL });
    let prompts: string[] | null = null;
    let lastRaw = "";

    for (let attempt = 0; attempt < 3; attempt++) {
      const content =
        attempt === 0
          ? userPrompt
          : userPrompt +
            `\n上一次输出不合格，请严格修正并重新输出6条。\n错误明细：${prompts ? validatePrompts(prompts).errors.join("；") : "解析失败"}\n`;

      const r = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content }],
      });

      lastRaw = r.choices[0].message.content || "";
      const parsed = tryParseJsonArray(lastRaw);
      if (!parsed) continue;
      const first6 = parsed.slice(0, 6);
      const v = validatePrompts(first6);
      if (v.ok) {
        prompts = first6;
        break;
      }
      prompts = first6;
    }

    if (!prompts || !validatePrompts(prompts).ok) {
      prompts = [
        "主体：产品与同一位年轻女性模特同框；场景：卧室梳妆台；光线：自然窗光；风格：氛围感；核心元素：绿植、镜面、浅景深",
        "主体：产品手持展示（同一位年轻女性模特）；场景：客厅沙发旁；光线：暖光；风格：真实生活感；核心元素：毛毯、茶几、柔焦",
        "主体：产品放置近景（同一位年轻女性模特出镜）；场景：书桌学习区；光线：台灯暖光；风格：干净简约；核心元素：笔记本、咖啡杯、低饱和",
        "主体：产品搭配穿搭细节（同一位年轻女性模特）；场景：镜前/玄关；光线：柔和顶光；风格：日系质感；核心元素：穿搭、包、轻微噪点",
        "主体：产品微距特写；场景：大理石台面；光线：侧逆光；风格：高清质感；核心元素：纹理、光泽、浅景深",
        "主体：产品与生活道具组合（同一位年轻女性模特入镜）；场景：餐桌/厨房岛台；光线：晨光；风格：清新生活感；核心元素：餐具、花束、干净留白",
      ];
    }

    return NextResponse.json({ prompts });
  } catch (e: any) {
    console.error("生成生图提示词失败:", e);
    return NextResponse.json({ error: e?.message || "生成失败" }, { status: 500 });
  }
}


