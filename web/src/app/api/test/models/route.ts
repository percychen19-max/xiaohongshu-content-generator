import { NextResponse } from "next/server";
import { removeBackground } from "@/lib/volc";

const DEFAULT_DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/api/v1";
const DEFAULT_VOLC_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

// 注意：这是测试用接口，密钥统一从服务器环境变量读取（不要写进代码/数据库）
const ALIYUN_CONFIG = {
  apiKey: process.env.DASHSCOPE_API_KEY || process.env.IMAGE_API_KEY || "",
  baseURL: process.env.DASHSCOPE_BASE_URL || process.env.IMAGE_BASE_URL || DEFAULT_DASHSCOPE_BASE_URL,
  model: process.env.DASHSCOPE_MODEL || "flux-dev",
};

const VOLC_CONFIG = {
  apiKey: process.env.VOLC_API_KEY || process.env.AI_API_KEY || process.env.TEXT_API_KEY || "",
  baseURL: process.env.VOLC_BASE_URL || process.env.AI_BASE_URL || process.env.TEXT_BASE_URL || DEFAULT_VOLC_BASE_URL,
  imageModel: process.env.VOLC_IMAGE_MODEL || "doubao-seedream-4-5-251128",
};

interface TestRequest {
  imageUrl: string;
  productName: string;
  description: string;
  models?: string[]; // 可选：指定测试哪些模型
}

export async function POST(req: Request) {
  try {
    const body: TestRequest = await req.json();
    const { imageUrl, productName, description, models = ["aliyun", "volc"] } = body;

    if (!imageUrl) return NextResponse.json({ error: "需要上传图片" }, { status: 400 });

    // 抠图
    const originalBase64 = imageUrl.includes("base64,") ? imageUrl.split("base64,")[1] : imageUrl;
    const processedBase64 = await removeBackground(originalBase64);
    const prompt = `product photography, ${productName}, ${description}, high quality, studio lighting, keep product unchanged`;

    const results: Record<string, { success: boolean; url?: string; error?: string; time: number }> = {};

    // 测试阿里云 Flux
    if (models.includes("aliyun")) {
      const start = Date.now();
      try {
        if (!ALIYUN_CONFIG.apiKey) {
          results["阿里云 Flux"] = { success: false, error: "缺少 DASHSCOPE_API_KEY", time: Date.now() - start };
        } else {
        const payload = {
          model: ALIYUN_CONFIG.model,
          input: {
            prompt: prompt,
            image: `data:image/png;base64,${processedBase64}`,
          },
          parameters: {
            size: "1024*1024",
            n: 1,
          }
        };

        const res = await fetch(`${ALIYUN_CONFIG.baseURL}/services/aigc/text2image/image-synthesis`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${ALIYUN_CONFIG.apiKey}`,
            // 阿里云可能也需要这个 Header
            "X-DashScope-API-Key": ALIYUN_CONFIG.apiKey
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        const time = Date.now() - start;

        if (res.ok && data.output?.results?.[0]?.url) {
          results["阿里云 Flux"] = { success: true, url: data.output.results[0].url, time };
        } else {
          results["阿里云 Flux"] = { success: false, error: JSON.stringify(data), time };
        }
        }
      } catch (e: any) {
        results["阿里云 Flux"] = { success: false, error: e.message, time: Date.now() - start };
      }
    }

    // 测试火山引擎
    if (models.includes("volc")) {
      const start = Date.now();
      try {
        if (!VOLC_CONFIG.apiKey) {
          results["火山引擎"] = { success: false, error: "缺少 VOLC_API_KEY", time: Date.now() - start };
        } else {
        const payload = {
          model: VOLC_CONFIG.imageModel,
          prompt: prompt,
          image_base64: processedBase64,
          size: "2048x2048",
          response_format: "url"
        };

        const res = await fetch(`${VOLC_CONFIG.baseURL}/images/generations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${VOLC_CONFIG.apiKey}`
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        const time = Date.now() - start;

        if (res.ok && data.data?.[0]?.url) {
          results["火山引擎"] = { success: true, url: data.data[0].url, time };
        } else {
          results["火山引擎"] = { success: false, error: JSON.stringify(data), time };
        }
        }
      } catch (e: any) {
        results["火山引擎"] = { success: false, error: e.message, time: Date.now() - start };
      }
    }

    return NextResponse.json({ results });

  } catch (error: any) {
    console.error("测试失败:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

