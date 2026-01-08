import { NextResponse } from "next/server";
import OpenAI from "openai";
import { removeBackground } from "@/lib/volc";

// ⚠️ Deprecated：旧版单接口聚合逻辑（现已拆分为 /copy、/image-prompts、/image/one）
// 为了方便回归测试保留，但密钥统一从服务器环境变量读取（不要硬编码）
const CONFIG = {
  apiKey: process.env.VOLC_API_KEY || process.env.AI_API_KEY || process.env.TEXT_API_KEY || "",
  baseURL: process.env.VOLC_BASE_URL || process.env.AI_BASE_URL || process.env.TEXT_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3",
  textModel: process.env.AI_MODEL_NAME || process.env.VOLC_TEXT_MODEL || "doubao-seed-1-6-lite-251015",
  imageModel: process.env.VOLC_IMAGE_MODEL || "doubao-seedream-4-5-251128",
};

interface GenerateRequest {
  productName: string;
  description: string;
  imageUrl?: string;
}

export async function POST(req: Request) {
  try {
    if (!CONFIG.apiKey) {
      return NextResponse.json({ error: "服务端未配置 VOLC_API_KEY（或 AI_API_KEY / TEXT_API_KEY）" }, { status: 500 });
    }
    const body: GenerateRequest = await req.json();
    let { productName, description, imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: "必须上传图片" }, { status: 400 });
    }

    console.log(`=== 开始处理任务: ${productName} ===`);
    const startTime = Date.now();

    // 预处理：提取 Base64
    const originalBase64 = imageUrl.includes("base64,") 
      ? imageUrl.split("base64,")[1] 
      : imageUrl;

    // ------------------------------------------------------
    // STEP 1: 智能抠图 (Background Removal)
    // ------------------------------------------------------
    console.log(">>> STEP 1: 正在抠图...");
    const processedImageBase64 = await removeBackground(originalBase64);
    
    // 构造带前缀的 URL 用于前端展示和后续调用
    // 注意：如果是透明底 PNG，我们可能需要在这里用 Canvas 合成白底，
    // 但为了简单，我们假设 AI 生图能处理透明底。
    const processedImageUrl = `data:image/png;base64,${processedImageBase64}`;


    // ------------------------------------------------------
    // STEP 2: 生成文案 (Copywriting)
    // ------------------------------------------------------
    console.log(">>> STEP 2: 生成文案...");
    const client = new OpenAI({
      apiKey: CONFIG.apiKey,
      baseURL: CONFIG.baseURL,
    });

    const textSystemPrompt = `你是一个小红书爆款文案专家。
请仔细观察这张【已抠除背景的产品图】，结合用户卖点，写一篇极具吸引力的种草文案。
要求：标题带Emoji，正文口语化，分段清晰，结尾带标签。`;

    const textCompletion = await client.chat.completions.create({
      messages: [
        { role: "system", content: textSystemPrompt },
        { 
          role: "user", 
          content: [
            { type: "text", text: `产品：${productName}\n卖点：${description}` },
            { type: "image_url", image_url: { url: processedImageUrl } }
          ] as any
        }
      ],
      model: CONFIG.textModel,
    });
    
    const generatedCopy = textCompletion.choices[0].message.content || "";
    console.log("文案生成完毕，长度:", generatedCopy.length);


    // ------------------------------------------------------
    // STEP 3: 策划生图 Prompt (Prompt Engineering)
    // ------------------------------------------------------
    console.log(">>> STEP 3: 策划图片场景...");
    const planSystemPrompt = `你是一个专业的视觉导演。
请根据刚刚生成的小红书文案，策划 4 个不同的摄影场景，用于生成配图。
要求：
1. 每个场景必须基于文案中提到的使用场景或氛围。
2. 必须包含“产品主体”。
3. 输出为英文提示词 (Stable Diffusion 格式)。
4. 返回格式：纯 JSON 数组，例如 ["prompt1", "prompt2", "prompt3", "prompt4"]，不要任何 Markdown 标记。`;

    const planCompletion = await client.chat.completions.create({
      messages: [
        { role: "system", content: planSystemPrompt },
        { role: "user", content: `文案内容：\n${generatedCopy}` }
      ],
      model: CONFIG.textModel,
      // 移除不支持的 response_format
    });

    let prompts: string[] = [];
    try {
      let planContent = planCompletion.choices[0].message.content || "[]";
      // 清洗数据：去除可能存在的 Markdown 标记 (```json ... ```)
      planContent = planContent.replace(/```json/g, "").replace(/```/g, "").trim();
      
      const parsed = JSON.parse(planContent);
      // 兼容可能返回的 key (prompts, scenes, etc)
      prompts = parsed.prompts || parsed.scenes || parsed.data || [];
      if (!Array.isArray(prompts)) prompts = [];
    } catch (e) {
      console.error("Prompt 策划解析失败，使用默认 Prompt");
    }

    // 兜底：如果策划失败或不足4个，补齐默认 Prompt
    const defaultPrompts = [
      "clean background, studio lighting, high quality, 4k",
      "lifestyle scene, cozy atmosphere, soft light",
      "minimalist composition, pastel colors",
      "outdoor nature background, sunlight"
    ];
    while (prompts.length < 4) {
      prompts.push(defaultPrompts[prompts.length]);
    }
    prompts = prompts.slice(0, 4); // 限制4张
    console.log("策划的 Prompts:", prompts);


    // ------------------------------------------------------
    // STEP 4: 并发生图 (Image Generation)
    // ------------------------------------------------------
    console.log(">>> STEP 4: 开始生成图片 (图生图)...");
    
    // 定义单个生图任务
    const generateOneImage = async (prompt: string, index: number) => {
      try {
        const payload = {
          model: CONFIG.imageModel,
          // 组合 Prompt: 策划词 + 风格词 + 强触发词
          prompt: `${prompt}, (product shot:1.2), high quality, 8k, ${productName}`,
          image_base64: processedImageBase64, // 使用抠好的图作为底图！
          size: "2048x2048",
          response_format: "url"
        };

        const res = await fetch(`${CONFIG.baseURL}/images/generations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${CONFIG.apiKey}`
          },
          body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "API Error");
        return data.data?.[0]?.url;
      } catch (err) {
        console.error(`图片 ${index+1} 生成失败:`, err);
        return null;
      }
    };

    // 并发执行所有生图任务
    const imageResults = await Promise.all(prompts.map((p, i) => generateOneImage(p, i)));
    
    // 过滤掉失败的 null
    const validImages = imageResults.filter(url => !!url);

    console.log(`=== 全部完成，耗时 ${(Date.now() - startTime)/1000}s ===`);

    return NextResponse.json({ 
      copy: generatedCopy,
      imageUrls: validImages,
      // 同时也把抠好的图返回给前端看看 (可选)
      processedImage: processedImageUrl 
    });

  } catch (error: any) {
    console.error("全流程执行失败:", error);
    return NextResponse.json(
      { error: "生成失败: " + (error.message || "未知错误") },
      { status: 500 }
    );
  }
}
