import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import { getVolcApiKey } from "@/lib/credentials";
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
const DEFAULT_TEXT_MODEL = "doubao-seed-1-6-lite-251015";

export async function POST(req: Request) {
  try {
    const { copy } = await req.json();
    if (!copy) return NextResponse.json({ error: "copy 不能为空" }, { status: 400 });

    const promptTemplate =
      (await getConfig("XHS_IMAGE_PROMPT_TEMPLATE")) ||
      "你是小红书爆款配图生成助手。请基于输入内容生成6条提示词，严格JSON数组输出。输入：{{copy}}";

    const forceFormatHint =
      "\n\n输出要求：\n- 只输出 JSON 数组字符串（不要 Markdown/不要解释）。\n- 数组长度必须为6。\n- 每条尽量包含：主体/场景/光线/风格/核心元素（但不要为了格式牺牲自然度）。\n";

    const userPrompt = promptTemplate.replace(/\{\{copy\}\}/g, copy) + forceFormatHint;

    const baseURL =
      (await getConfig("COPY_ENGINE_BASE_URL")) ||
      process.env.VOLC_BASE_URL ||
      process.env.AI_BASE_URL ||
      process.env.TEXT_BASE_URL ||
      DEFAULT_TEXT_BASE_URL;
    const vendor = (await getConfig("COPY_ENGINE_VENDOR")) || "volc";
    const volcProfile = (await getConfig("COPY_ENGINE_CRED_PROFILE")) || "default";
    const store = await resolveApiKeyFromStore({ type: "text", vendor, profile: volcProfile });
    const apiKey = store?.apiKey || (vendor === "volc" ? getVolcApiKey(volcProfile) : "");
    if (!apiKey) {
      return NextResponse.json(
        { error: `服务端未配置文案引擎密钥：请在“API管理中心”配置 vendor=${vendor} profile=${volcProfile}，或设置环境变量` },
        { status: 500 }
      );
    }
    const model =
      (await getConfig("COPY_ENGINE_MODEL_ID")) || process.env.AI_MODEL_NAME || DEFAULT_TEXT_MODEL;

    const finalBaseURL = (await getConfig("COPY_ENGINE_BASE_URL")) || store?.baseURL || baseURL;
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
        "主体：产品实拍主体；场景：卧室/客厅桌面；光线：自然窗光；风格：氛围感；核心元素：绿植、咖啡杯、轻微噪点",
        "主体：产品卖点清单；场景：办公桌便签纸；光线：柔光；风格：干货清单；核心元素：3条要点、图标点缀",
        "主体：前后/好坏对比；场景：白色桌面分屏；光线：均匀自然光；风格：对比展示；核心元素：左右对照、箭头标注",
        "主体：真实情绪共鸣；场景：生活场景手持/收纳；光线：暖光；风格：生活感；核心元素：人物/手部、日常道具",
        "主体：细节特写；场景：盘子/台面；光线：侧逆光；风格：微距质感；核心元素：纹理、光泽、浅景深",
        "主体：符号化信息图；场景：简约背景；光线：明亮；风格：极简图标；核心元素：图标组合、数据符号",
      ];
    }

    return NextResponse.json({ prompts });
  } catch (e: any) {
    console.error("生成生图提示词失败:", e);
    return NextResponse.json({ error: e?.message || "生成失败" }, { status: 500 });
  }
}


