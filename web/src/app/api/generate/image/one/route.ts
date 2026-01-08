import { NextResponse } from "next/server";
import { segmentCommodityToPngBase64 } from "@/lib/aliyun";
import { PrismaClient } from "@prisma/client";
import { getDashscopeApiKey, getGoogleApiKey } from "@/lib/credentials";
import { resolveApiKeyFromStore } from "@/lib/credential-resolver";
import { generateImageWithGoogle } from "@/lib/google";

export const runtime = "nodejs";

const DEFAULT_IMAGE_BASE_URL = "https://dashscope.aliyuncs.com/api/v1";
const DEFAULT_IMAGE_MODEL = "qwen-image-edit-plus";

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

    const vendor = (await getConfig("IMAGE_ENGINE_VENDOR")) || "dashscope";
    const imageProfile = (await getConfig("IMAGE_ENGINE_CRED_PROFILE")) || "default";
    const imagesegProfile = (await getConfig("IMAGESEG_CRED_PROFILE")) || "default";

    // Google 模型使用不同的逻辑
    if (vendor === "google") {
      return await handleGoogleGeneration({
        productName,
        prompt,
        positivePrompt,
        negativePrompt,
        images,
        primaryIndex,
        modelFromCfg: (await getConfig("IMAGE_ENGINE_MODEL_ID")) || "gemini-2.5-flash-image",
        profile: imageProfile,
        imagesegProfile,
      });
    }

    // DashScope 模型（原有逻辑）
    const baseURL =
      (await getConfig("IMAGE_ENGINE_BASE_URL")) ||
      process.env.DASHSCOPE_BASE_URL ||
      process.env.IMAGE_BASE_URL ||
      DEFAULT_IMAGE_BASE_URL;
    const store = await resolveApiKeyFromStore({ type: "image", vendor, profile: imageProfile });
    const apiKey = store?.apiKey || (vendor === "dashscope" ? getDashscopeApiKey(imageProfile) : "");
    if (!apiKey) {
      return NextResponse.json(
        { error: `服务端未配置配图引擎密钥：请在"API管理中心"配置 vendor=${vendor} profile=${imageProfile}，或设置环境变量` },
        { status: 500 }
      );
    }

    const finalBaseURL = (await getConfig("IMAGE_ENGINE_BASE_URL")) || store?.baseURL || baseURL;
    const modelFromCfg = (await getConfig("IMAGE_ENGINE_MODEL_ID")) || process.env.DASHSCOPE_MODEL || DEFAULT_IMAGE_MODEL;
    const defaultNeg = (await getConfig("IMAGE_ENGINE_NEGATIVE_PROMPT")) || "";
    const promptExtend = toBool(await getConfig("IMAGE_ENGINE_PROMPT_EXTEND"), false);
    const useHttp = toBool(await getConfig("IMAGE_ENGINE_USE_HTTP"), false);

    const list = Array.isArray(images) ? images.filter((x) => x?.dataUrl) : [];
    const pIdx = typeof primaryIndex === "number" && primaryIndex >= 0 ? primaryIndex : 0;
    const primary = list[pIdx];

    // 支持无图：用白底画布作为输入图，让模型“随机生成”
    let inputImages: string[] = [];

    if (list.length === 0) {
      // 用一个白底作为“可编辑图”
      const blank = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAmMB9qA7qjYAAAAASUVORK5CYII=";
      inputImages = [blank];
    } else {
      // 多图：全部抠图（但 qwen-image-edit-plus 最多支持 1-3 张输入）
      const cutouts: string[] = [];
      const max = Math.min(list.length, 3);
      for (let i = 0; i < max; i++) {
        try {
          const b64 = list[i].dataUrl.includes("base64,") ? list[i].dataUrl.split("base64,")[1] : list[i].dataUrl;
          const cut = await segmentCommodityToPngBase64(b64, imagesegProfile);
          cutouts.push(`data:image/png;base64,${cut}`);
        } catch (e) {
          // 抠图失败不致命：退化为直接使用原图（保证“可用性优先”，便于你快速迭代测试）
          console.warn("⚠️ 抠图失败，已退化为原图输入：", (e as any)?.message || e);
          cutouts.push(list[i].dataUrl);
        }
      }
      inputImages = cutouts;
    }

    const notesText =
      list.length > 0
        ? list
            .slice(0, 3)
            .map((img, idx) => (img.note ? `图${idx + 1}备注：${img.note}` : `图${idx + 1}备注：无`))
            .join("\n")
        : "";

    const hardConstraint =
      list.length === 0
        ? `要求：根据“产品名称+卖点”随机生成符合小红书审美的配图风格，不要生成水印/二维码。产品外观尽量贴合：${productName}。`
        : `硬性要求：如果画面出现产品，必须严格参考输入图产品，外观/颜色/Logo/材质/结构/比例/纹理细节完全不变，不得改动产品主体，不得重绘变形；禁止生成多余商品/配件；整体像真实拍摄。`;

    const finalText = [
      prompt,
      positivePrompt ? `用户正向补充：${positivePrompt}` : "",
      negativePrompt ? `用户反向补充：${negativePrompt}` : "",
      notesText ? `参考图备注：\n${notesText}` : "",
      hardConstraint,
    ]
      .filter(Boolean)
      .join("\n");

    const payload = {
      model: modelFromCfg,
      input: {
        messages: [
          {
            role: "user",
            content: [
              ...inputImages.map((img) => ({ image: img })),
              { text: finalText },
            ],
          },
        ],
      },
      parameters: {
        n: 1,
        negative_prompt:
          negativePrompt ||
          defaultNeg ||
          (list.length === 0
            ? "低质量, 低分辨率, 模糊, 强烈AI感, 水印, 二维码"
            : "低质量, 低分辨率, 模糊, 强烈AI感, 产品主体变形, 产品外观改变, 颜色改变, Logo改变, 材质改变, 比例不对, 结构错误, 多余商品, 多余配件, 水印, 二维码"),
        prompt_extend: !!promptExtend,
        watermark: false,
      },
    };

    const res = await fetch(`${finalBaseURL}/services/aigc/multimodal-generation/generation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data?.message || "生图失败", raw: data }, { status: 500 });
    }
    const outUrl = data.output?.choices?.[0]?.message?.content?.[0]?.image;
    if (!outUrl) {
      return NextResponse.json({ error: "生图无结果", raw: data }, { status: 500 });
    }
    return NextResponse.json({ url: outUrl });
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
    prompt,
    positivePrompt ? `用户正向补充：${positivePrompt}` : "",
    negativePrompt ? `用户反向补充：${negativePrompt}` : "",
    notesText ? `参考图备注：\n${notesText}` : "",
    hardConstraint,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    // 获取 baseURL 配置（用于代理服务）
    const baseURL = (await getConfig("IMAGE_ENGINE_BASE_URL")) || null;
    const useHttp = toBool(await getConfig("IMAGE_ENGINE_USE_HTTP"), !!baseURL);

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


