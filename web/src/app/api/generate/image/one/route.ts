import { NextResponse } from "next/server";
import { segmentCommodityToPngBase64 } from "@/lib/aliyun";
import { PrismaClient } from "@prisma/client";
import { generateImageWithGoogle } from "@/lib/google";

export const runtime = "nodejs";

const DEFAULT_GOOGLE_BASE_URL = process.env.GOOGLE_BASE_URL || "https://gitaigc.com/v1";

type RefImage = { dataUrl: string; note?: string };

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

function toBool(v: any, fallback = false) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1" || v === "yes";
  return fallback;
}

function stripBase64Prefix(dataUrl: string) {
  return dataUrl.includes("base64,") ? dataUrl.split("base64,")[1] : dataUrl;
}

export async function POST(req: Request) {
  try {
    const {
      productName,
      prompt,
      positivePrompt,
      negativePrompt,
      images,
      primaryIndex,
    } = (await req.json()) as {
      productName: string;
      prompt: string;
      positivePrompt?: string;
      negativePrompt?: string;
      images?: RefImage[];
      primaryIndex?: number;
    };

    if (!productName) return NextResponse.json({ error: "productName 不能为空" }, { status: 400 });
    if (!prompt) return NextResponse.json({ error: "prompt 不能为空" }, { status: 400 });

    const enabled = (await getConfig("IMAGE_ENGINE_ENABLED")) ?? "true";
    if (enabled === "false") {
      return NextResponse.json({ error: "配图引擎已在后台关闭" }, { status: 400 });
    }

    const textHintSourceEarly = [prompt, positivePrompt, negativePrompt].join(" ");
    const hasTextHintEarly = /文字|字样|字樣|字体|文案|slogan|标语|logo|字迹|字帖/i.test(textHintSourceEarly);

    // 按需求：全部先用 Google 生图，再根据文字需求决定是否二次编辑
    let vendor = "google";
    const imageProfile =
      (await getConfig("IMAGE_ENGINE_CRED_PROFILE")) ||
      process.env.IMAGE_ENGINE_CRED_PROFILE ||
      "default";
    const imagesegProfile =
      (await getConfig("IMAGESEG_CRED_PROFILE")) ||
      process.env.IMAGESEG_CRED_PROFILE ||
      "default";

    // 生图流程：先用 Google 生成，再视文字需求用 qwen 二次编辑文字
    // ----------------------------------------------------
    // 第一步：Google 生成基础图
    const baseURLGoogle =
      (await getConfig("IMAGE_ENGINE_BASE_URL")) ||
      process.env.IMAGE_ENGINE_BASE_URL ||
      process.env.GOOGLE_BASE_URL ||
      DEFAULT_GOOGLE_BASE_URL;

    // 处理参考图，可选跳过抠图
    const listGoogle = Array.isArray(images) ? images.filter((x) => x?.dataUrl) : [];
    const skipSeg =
      toBool(await getConfig("IMAGESEG_SKIP"), true) || toBool(process.env.SKIP_IMAGE_SEGMENT, true);
    let referenceImages: string[] | undefined = undefined;
    if (listGoogle.length > 0) {
      const max = Math.min(listGoogle.length, 3);
      referenceImages = [];
      for (let i = 0; i < max; i++) {
        try {
          const b64 = stripBase64Prefix(listGoogle[i].dataUrl);
          if (skipSeg) {
            referenceImages.push(b64);
          } else {
            const cut = await segmentCommodityToPngBase64(b64, imagesegProfile);
            referenceImages.push(cut);
          }
        } catch {
          const b64 = stripBase64Prefix(listGoogle[i].dataUrl);
          referenceImages.push(b64);
        }
      }
    }

    // 构建提示词（复用后续 qwen 文本修复与兜底）
    const notesText =
      listGoogle.length > 0
        ? listGoogle
            .slice(0, 3)
            .map((img, idx) => (img.note ? `图${idx + 1}备注：${img.note}` : `图${idx + 1}备注：无`))
            .join("\n")
        : "";

    const hardConstraint =
      listGoogle.length === 0
        ? `要求：根据“产品名称+卖点”随机生成符合小红书审美的配图风格，不要生成水印/二维码。产品外观尽量贴合：${productName}。`
        : `硬性要求：如果画面出现产品，必须严格参考输入图产品，外观/颜色/Logo/材质/结构/比例/纹理细节完全不变，不得改动产品主体，不得重绘变形；禁止生成多余商品/配件；整体像真实拍摄。`;

    const finalPrompt = [
      prompt,
      positivePrompt ? `用户正向补充：${positivePrompt}` : "",
      negativePrompt ? `用户反向补充：${negativePrompt}` : "",
      notesText ? `参考图备注：\n${notesText}` : "",
      hardConstraint,
      "画面需符合小红书种草风格与文案调性，真实生活感、无硬广感。",
    ]
      .filter(Boolean)
      .join("\n");

    // 当前版本要求：不生成任何文字/水印/Logo（强约束：连“书脊可读字/界面UI/字幕”都不要）
    const textGuideline =
      "绝对禁止出现任何可读文字（中文/英文/数字都不行），包括：slogan/标题/海报字/字幕/水印/Logo/二维码/界面UI/书脊可读字/包装可读字。只输出纯画面与氛围，不要任何字形或可识别字符。";
    const finalPromptWithText = [finalPrompt, textGuideline].filter(Boolean).join("\n");

    const googleImage = await generateImageWithGoogle(
      finalPromptWithText,
      (await getConfig("IMAGE_ENGINE_MODEL_ID")) || process.env.IMAGE_ENGINE_MODEL_ID || "gemini-2.5-flash-image",
      imageProfile,
      baseURLGoogle,
      true,
      referenceImages
    );

    // 直接返回 Gemini 结果，不再调用 qwen
    return NextResponse.json({ url: `data:image/png;base64,${googleImage}` });

  } catch (e: any) {
    console.error("单张生图失败:", e);
    return NextResponse.json({ error: e?.message || "失败" }, { status: 500 });
  }
}

/**
 * 处理 Google 模型的图片生成
 */
async function handleGoogleGeneration(opts: {
  productName: string;
  prompt: string;
  positivePrompt?: string;
  negativePrompt?: string;
  images?: RefImage[];
  primaryIndex?: number;
  modelFromCfg: string;
  profile: string;
  imagesegProfile: string;
}) {
  const {
    productName,
    prompt,
    positivePrompt,
    negativePrompt,
    images,
    primaryIndex,
    modelFromCfg,
    profile,
    imagesegProfile,
  } = opts;

  const list = Array.isArray(images) ? images.filter((x) => x?.dataUrl) : [];
  const pIdx = typeof primaryIndex === "number" && primaryIndex >= 0 ? primaryIndex : 0;

  // 构建最终提示词
  const notesText =
    list.length > 0
      ? list
          .slice(0, 3)
          .map((img, idx) => (img.note ? `图${idx + 1}备注：${img.note}` : `图${idx + 1}备注：无`))
          .join("\n")
      : "";

  const hardConstraint =
    list.length === 0
      ? `要求：根据"产品名称+卖点"随机生成符合小红书审美的配图风格，不要生成水印/二维码。产品外观尽量贴合：${productName}。`
      : `硬性要求：如果画面出现产品，必须严格参考输入图产品，外观/颜色/Logo/材质/结构/比例/纹理细节完全不变，不得改动产品主体，不得重绘变形；禁止生成多余商品/配件；整体像真实拍摄。`;

  const finalPrompt = [
    "你是小红书风格的视觉导演，需生成符合文案语境的配图，侧重产品卖点，不只是换背景。",
    `产品：${productName}`,
    `卖点：${opts.negativePrompt ? `${opts.negativePrompt}（反向约束）` : ""}${opts.prompt ? "" : ""}`,
    `文案/场景提示：${prompt}`,
    positivePrompt ? `正向补充：${positivePrompt}` : "",
    negativePrompt ? `反向补充：${negativePrompt}` : "",
    notesText ? `参考图备注：\n${notesText}` : "",
    hardConstraint,
    "生成要求：保持小红书清新生活感/质感风；可产生活动场景、人物互动、道具细节、空间氛围等多样画面；如果有参考图，必须保持产品形态、材质、结构和比例，不得改变外观或形状；禁止水印/二维码/乱写字。如需画面中文字（中/英文），必须清晰无畸变、不乱码、不错别字，排版自然。",
  ]
    .filter(Boolean)
    .join("\n");

  // 检测是否需要文字清晰度强化（涉及文字/字体/文案等提示）
  const textHintSource = [prompt, positivePrompt, negativePrompt, notesText].join(" ");
  const hasTextHint = /文字|字样|字樣|字体|文案|slogan|标语|logo|字迹|字帖/i.test(textHintSource);

  try {
    // 获取 baseURL 配置（用于代理服务），优先环境变量
    const baseURL =
      (await getConfig("IMAGE_ENGINE_BASE_URL")) ||
      process.env.IMAGE_ENGINE_BASE_URL ||
      process.env.GOOGLE_BASE_URL ||
      DEFAULT_GOOGLE_BASE_URL;
    // 对第三方统一强制 HTTP 兼容模式，避免走官方域名
    const useHttp = true;
    console.log("🌐 Google 生图调用参数", { baseURL, model: modelFromCfg, profile, refCount: list.length });

    // 处理参考图：如果有上传图片，先抠图，然后传给 Google API
    let referenceImages: string[] = [];
    if (list.length > 0) {
      console.log(`📸 处理 ${list.length} 张参考图，进行抠图...`);
      const max = Math.min(list.length, 3); // Google API 可能支持多图，先处理最多3张
      for (let i = 0; i < max; i++) {
        try {
          const b64 = list[i].dataUrl.includes("base64,") ? list[i].dataUrl.split("base64,")[1] : list[i].dataUrl;
          // 抠图：提取产品主体
          const cutout = await segmentCommodityToPngBase64(b64, imagesegProfile);
          referenceImages.push(cutout);
          console.log(`✅ 第 ${i + 1} 张图抠图成功`);
        } catch (e) {
          // 抠图失败不致命：退化为直接使用原图
          console.warn(`⚠️ 第 ${i + 1} 张图抠图失败，使用原图:`, (e as any)?.message || e);
          const b64 = list[i].dataUrl.includes("base64,") ? list[i].dataUrl.split("base64,")[1] : list[i].dataUrl;
          referenceImages.push(b64);
        }
      }
    }

    // 调用 Google API 生成图片，传入参考图（如果有）
    const imageBase64 = await generateImageWithGoogle(
      finalPrompt, 
      modelFromCfg, 
      profile, 
      baseURL || undefined, 
      useHttp,
      referenceImages.length > 0 ? referenceImages : undefined
    );
    
    // 将 base64 转换为 data URL 返回
    const dataUrl = `data:image/png;base64,${imageBase64}`;
    return NextResponse.json({ url: dataUrl });
  } catch (e: any) {
    console.error("Google 生图失败:", e);
    return NextResponse.json({ error: e?.message || "Google 生图失败" }, { status: 500 });
  }
}


