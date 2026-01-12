import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import { segmentCommodityToPngBase64 } from "@/lib/aliyun";
import { getDashscopeApiKey, getVolcApiKey } from "@/lib/credentials";

export const runtime = "nodejs";

// Prisma 单例
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

const ALIYUN_CONFIG = {
  apiKey: "", // 运行时按 profile 从 env 取
  baseURL: process.env.DASHSCOPE_BASE_URL || process.env.IMAGE_BASE_URL || "https://dashscope.aliyuncs.com/api/v1",
  model: process.env.DASHSCOPE_MODEL || "qwen-image-edit-plus",
};

const VOLC_CONFIG = {
  apiKey: "", // 运行时按 profile 从 env 取
  baseURL: process.env.VOLC_BASE_URL || process.env.AI_BASE_URL || process.env.TEXT_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3",
  textModel: process.env.AI_MODEL_NAME || process.env.VOLC_TEXT_MODEL || "doubao-seed-1-6-lite-251015",
};

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
  // 约束：推荐 30-50 字（中文/英文都算字符），给少量弹性
  if (s.length < 24 || s.length > 80) return { ok: false, reason: `长度不合规(${s.length})` };
  // 约束：必须包含结构字段，便于稳定性（和你提供的规范一致）
  const required = ["主体", "场景", "光线", "风格", "核心元素"];
  const missing = required.filter((k) => !s.includes(k));
  if (missing.length) return { ok: false, reason: `缺少字段:${missing.join(",")}` };
  return { ok: true as const };
}

function validatePrompts(list: string[]) {
  const errors: string[] = [];
  if (list.length !== 6) errors.push(`数量不等于6(当前${list.length})`);
  const first6 = list.slice(0, 6);
  first6.forEach((p, i) => {
    const v = validateOnePrompt(p);
    if (!v.ok) errors.push(`第${i + 1}条:${v.reason}`);
  });
  return { ok: errors.length === 0, errors };
}

function isTextHeavyPrompt(p: string) {
  const s = (p || "").toLowerCase();
  // 清单/对比/信息图/符号化/步骤等更需要文字渲染能力
  const keys = ["清单", "对比", "信息图", "符号", "步骤", "要点", "列表", "数据", "参数", "标注"];
  return keys.some((k) => s.includes(k));
}

export async function POST(req: Request) {
  try {
    const { productName, copy, imageUrl } = await req.json();
    console.log(`\n🚀 [百炼标准流程] 产品: ${productName}`);
    const volcProfile = (await getConfig("COPY_ENGINE_CRED_PROFILE")) || "default";
    const dashscopeProfile = (await getConfig("IMAGE_ENGINE_CRED_PROFILE")) || "default";
    const imagesegProfile = (await getConfig("IMAGESEG_CRED_PROFILE")) || "default";

    const volcApiKey = getVolcApiKey(volcProfile);
    const dashscopeApiKey = getDashscopeApiKey(dashscopeProfile);


    // 兼容：无图也允许继续（走“无图生图”逻辑），避免卡死测试
    // 旧版接口已弃用，推荐使用 /api/generate/image/one（已支持无图）

    // 1. 生成 6 条“生图提示词”（由后台配置的模板驱动）
    // 你稍后会提供模板，我们把它存到 admin/config 里，key: XHS_IMAGE_PROMPT_TEMPLATE
    const promptTemplate =
      (await getConfig("XHS_IMAGE_PROMPT_TEMPLATE")) ||
      "你是小红书爆款配图生成助手，专注于根据用户提供的小红书标题和正文内容，精准提取核心信息并生成6个风格各异、适配小红书平台审美的高质量图片提示词，帮助用户打造吸睛、易传播的图文内容。\n\n要求：\n- 只输出 JSON 数组字符串，长度必须为 6。\n- 每条提示词需包含“主体+场景+光线+风格+核心元素”，总字数 30-50 字。\n- 内容必须严格基于标题和正文，不得编造无关元素。\n- 风格要覆盖：氛围场景、干货清单、前后对比、情绪共鸣、细节特写、符号化信息图。\n\n输入（标题+正文）：\n{{copy}}\n";

    // 强制输出结构化字段（更利于校验与稳定）
    const forceFormatHint =
      "\n\n输出格式强制要求：\n- 只输出 JSON 数组字符串（不要 Markdown/不要解释）。\n- 数组长度必须为6。\n- 每条必须按下面格式书写（字段名必须出现，使用中文冒号）：\n  “主体：...；场景：...；光线：...；风格：...；核心元素：...”\n";

    if (!volcApiKey) return NextResponse.json({ error: "缺少文案引擎密钥（VOLC_API_KEY...）" }, { status: 500 });
    if (!dashscopeApiKey) return NextResponse.json({ error: "缺少配图引擎密钥（DASHSCOPE_API_KEY...）" }, { status: 500 });

    const volcClient = new OpenAI({ apiKey: volcApiKey, baseURL: VOLC_CONFIG.baseURL });

    let prompts: string[] = [
      "真实拍摄，产品在桌面，柔和自然光，背景生活化道具",
      "手持实拍，通勤场景，自然光，真实阴影反射",
      "室内暖光，产品特写，浅景深，真实质感",
      "户外自然光，产品在手边/包旁，生活方式构图",
      "卧室/客厅桌面，日常随手拍，轻微噪点",
      "细节特写构图，突出产品卖点的真实拍摄",
    ];

    const baseUserPrompt = promptTemplate.replace(/\{\{copy\}\}/g, copy || "") + forceFormatHint;
    let lastRaw = "";

    for (let attempt = 0; attempt < 3; attempt++) {
      const userPrompt =
        attempt === 0
          ? baseUserPrompt
          : baseUserPrompt +
            `\n上一次输出不合格，原因：${attempt === 1 ? "请严格修正" : "再次强调必须完全符合格式与数量"}。请重新输出6条。\n错误明细：${validatePrompts(prompts).errors.join("；")}\n`;

      const planCompletion = await volcClient.chat.completions.create({
        messages: [{ role: "user", content: userPrompt }],
        model: VOLC_CONFIG.textModel,
      });

      lastRaw = planCompletion.choices[0].message.content || "";
      const parsed = tryParseJsonArray(lastRaw);
      if (!parsed) {
        console.warn(`提示词解析失败（attempt=${attempt + 1}），raw=`, lastRaw.slice(0, 300));
        continue;
      }
      const first6 = parsed.slice(0, 6);
      const v = validatePrompts(first6);
      if (v.ok) {
        prompts = first6;
        break;
      }
      prompts = first6;
      console.warn(`提示词校验失败（attempt=${attempt + 1}）：`, v.errors);
    }

    // 最终兜底：仍不合格则用固定结构模板（保证稳定生成）
    if (!validatePrompts(prompts).ok) {
      prompts = [
        "主体：产品在桌面；场景：卧室/客厅木质桌面；光线：自然窗光；风格：生活随手拍；核心元素：绿植、咖啡杯、轻微噪点",
        "主体：产品手持展示；场景：通勤路上/电梯镜前；光线：日光；风格：真实抓拍；核心元素：包、钥匙、真实阴影",
        "主体：产品近景特写；场景：大理石台面；光线：柔光箱；风格：高清质感；核心元素：纹理细节、浅景深",
        "主体：产品与穿搭同框；场景：室内镜前；光线：暖光；风格：日系胶片；核心元素：穿搭、散景、低饱和",
        "主体：产品与生活道具组合；场景：书桌学习区；光线：台灯暖光；风格：干净简约；核心元素：笔记本、书本、对焦主体",
        "主体：产品功能点展示；场景：桌面平铺；光线：顶光；风格：极简信息图；核心元素：分区构图、留白、图标点缀",
      ];
      console.warn("提示词最终兜底启用。lastRaw=", lastRaw.slice(0, 300));
    }

    // 2. 准备图片 Base64（原始参考图）
    const originalBase64 = imageUrl.includes("base64,") ? imageUrl.split("base64,")[1] : imageUrl;
    const imageBase64 = `data:image/png;base64,${originalBase64}`;

    // 3. 串行生图
    console.log(">>> [步骤 3] 开始生成图片...");
    const results: string[] = [];

    // 先抠出产品主体（透明PNG），后续合成保证“产品不变”
    let cutoutPngBase64: string | null = null;
    try {
      cutoutPngBase64 = await segmentCommodityToPngBase64(originalBase64, imagesegProfile);
      console.log("✅ 抠图成功（主体PNG base64 已就绪）");
    } catch (e: any) {
      console.warn("⚠️ 抠图失败，将退化为直接编辑原图（可能导致主体变化）:", e?.message);
    }

    for (let i = 0; i < prompts.length; i++) {
      const onePrompt = prompts[i];
      console.log(`[${i + 1}/${prompts.length}] prompt: ${onePrompt}`);

      try {
        // 按你的要求：抠图后直接把“抠好的参考图 + 单条生图提示词”喂给 qwen-image-edit-plus
        // 注意：抠图失败时退化为原图（不推荐，但避免全失败）
        const refImage = cutoutPngBase64 ? `data:image/png;base64,${cutoutPngBase64}` : imageBase64;
        // 统一追加“产品主体不变”的硬约束（避免生成提示词里漏掉这点）
        const hardConstraint = `硬性要求：产品必须出现在画面中（可以小比例出现在角落/手持/桌面），且严格参考输入图产品，外观/颜色/Logo/材质/结构/比例/纹理细节完全不变，不得改动产品主体，不得重绘变形；禁止生成多余商品/配件；整体像真实拍摄。`;
        const textRenderSpec =
          "文字渲染要求（仅当提示词需要文字时）：中文必须清晰可读、边缘锐利、不变形不乱码不糊；字号适中不过小；排版留白合理；避免长段落；优先黑体/思源黑体风格；不要水印与二维码。";

        const needText = isTextHeavyPrompt(onePrompt);
        const finalPrompt = needText
          ? `${onePrompt}\n${hardConstraint}\n${textRenderSpec}`
          : `${onePrompt}\n${hardConstraint}`;

        const payload = {
          model: ALIYUN_CONFIG.model,
          input: {
            messages: [
              {
                role: "user",
                content: [
                  { image: refImage },
                  { text: finalPrompt }
                ]
              }
            ]
          },
          parameters: {
            n: 1,
            negative_prompt:
              needText
                ? "低质量, 低分辨率, 模糊, 强烈AI感, 产品主体变形, 产品外观改变, 颜色改变, Logo改变, 材质改变, 比例不对, 结构错误, 多余商品, 多余配件, 乱码文字, 变形文字, 文字糊成一团, 水印, 二维码"
                : "低质量, 低分辨率, 模糊, 强烈AI感, 产品主体变形, 产品外观改变, 颜色改变, Logo改变, 材质改变, 比例不对, 结构错误, 多余商品, 多余配件, 水印, 二维码",
            // 文字类提示词开启智能改写（更接近百炼后台体验）；其它保持关闭以保产品不变
            prompt_extend: needText,
            watermark: false
          }
        };

        // 关键修复：使用正确的 API 端点
        const res = await fetch(`${ALIYUN_CONFIG.baseURL}/services/aigc/multimodal-generation/generation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ALIYUN_CONFIG.apiKey.trim()}`
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        // 关键修复：使用正确的响应解析路径
        if (res.ok && data.output?.choices?.[0]?.message?.content?.[0]?.image) {
          const outUrl = data.output.choices[0].message.content[0].image as string;
          console.log(`✅ 图片 ${i + 1} 成功`);
          results.push(outUrl);
        } else {
          console.error(`❌ 图片 ${i+1} 失败:`, data.code, data.message);
          console.error("完整错误响应:", JSON.stringify(data, null, 2));
        }
        
        await new Promise(r => setTimeout(r, 1500));

      } catch (e: any) {
        console.error(`❌ 图片 ${i+1} 异常:`, e.message);
      }
    }

    console.log(`🏁 完成: ${results.length}/${prompts.length}`);
    return NextResponse.json({ imageUrls: results });

  } catch (error: any) {
    console.error("💥 失败:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
