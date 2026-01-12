import { GoogleGenAI } from "@google/genai";
import { getGoogleApiKey } from "@/lib/credentials";
import { resolveApiKeyFromStore } from "@/lib/credential-resolver";

/**
 * 使用 Google Gemini 2.5 Flash Image 生成图片
 * 支持多种调用方式：
 * 1. 官方 Google API（通过 SDK）
 * 2. 官方 Google API（通过 HTTP，支持代理）
 * 3. 第三方代理平台（通过自定义 baseURL）
 * 
 * @param prompt 图片生成提示词
 * @param model 模型名称，默认 "gemini-2.5-flash-image"
 * @param profile API Key profile，默认 "default"
 * @param baseURL 可选的 baseURL（用于代理服务或第三方平台）
 * @param useHttp 是否使用 HTTP 直接调用（绕过 SDK，适用于代理服务）
 * @returns Base64 编码的图片数据（不含 data: 前缀）
 */
export async function generateImageWithGoogle(
  prompt: string,
  model: string = "gemini-2.5-flash-image",
  profile: string = "default",
  baseURL?: string,
  useHttp: boolean = false,
  referenceImages?: string[] // 参考图（base64 数组，不含 data: 前缀）
): Promise<string> {
  console.log("正在调用 Google GenAI 生成图片...");
  
  // 优先从凭证存储读取，否则从环境变量读取
  const store = await resolveApiKeyFromStore({ type: "image", vendor: "google", profile });
  const apiKey = store?.apiKey || getGoogleApiKey(profile);
  const finalBaseURL = baseURL || store?.baseURL || process.env.GOOGLE_BASE_URL || "https://gitaigc.com/v1";
  
  if (!apiKey) {
    throw new Error(`未配置 Google API Key（profile=${profile}）。请在"API管理中心"配置或设置环境变量 GOOGLE_API_KEY`);
  }

  // 如果指定了 baseURL 或 useHttp，使用 HTTP 直接调用（适用于代理服务）
  if (useHttp || finalBaseURL) {
    console.log("🌐 使用 HTTP 模式调用生图", { model, baseURL: finalBaseURL });
    return await generateImageViaHttp(prompt, model, apiKey, finalBaseURL || undefined, referenceImages);
  }

  // 否则使用官方 SDK
  try {
    const ai = new GoogleGenAI({
      apiKey,
    });

    // 构建多模态内容：如果有参考图，先传图片，再传文本
    const parts: any[] = [];
    if (referenceImages && referenceImages.length > 0) {
      for (const imgBase64 of referenceImages) {
        parts.push({
          inlineData: {
            mimeType: "image/png",
            data: imgBase64,
          },
        });
      }
    }
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model,
      contents: parts,
    });

    // 从响应中提取图片（base64）
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error("Google GenAI 返回空结果");
    }

    const responseParts = candidates[0].content?.parts;
    if (!responseParts || responseParts.length === 0) {
      throw new Error("Google GenAI 内容为空");
    }

    // 查找包含图片的 part
    for (const part of responseParts) {
      if (part.inlineData && part.inlineData.data) {
        // 返回 base64 字符串（不含 data: 前缀）
        return part.inlineData.data;
      }
    }

    throw new Error("Google GenAI 响应中未找到图片数据");
  } catch (e: any) {
    // SDK 失败时，尝试降级到 HTTP 调用
    console.warn("Google SDK 调用失败，尝试 HTTP 方式:", e?.message);
    return await generateImageViaHttp(prompt, model, apiKey, finalBaseURL || undefined, referenceImages);
  }
}

/**
 * 通过 HTTP 直接调用 Google API（支持代理和第三方平台）
 */
async function generateImageViaHttp(
  prompt: string,
  model: string,
  apiKey: string,
  customBaseURL?: string,
  referenceImages?: string[]
): Promise<string> {
  const baseURL = customBaseURL || "https://generativelanguage.googleapis.com/v1beta";
  
  // 检测是否是第三方 OpenAI 兼容平台（通过 baseURL 判断）
  const isOpenAICompatible = baseURL.includes("gitaigc.com") || baseURL.includes("/v1");
  
  if (isOpenAICompatible) {
    // 使用 OpenAI 兼容格式调用第三方平台
    return await generateImageViaOpenAIFormat(prompt, model, apiKey, baseURL, referenceImages);
  }
  
  // 使用 Google 官方 API 格式
  const url = `${baseURL}/models/${model}:generateContent`;

  // 构建多模态内容：如果有参考图，先传图片，再传文本
  const parts: any[] = [];
  if (referenceImages && referenceImages.length > 0) {
    for (const imgBase64 of referenceImages) {
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: imgBase64,
        },
      });
    }
  }
  parts.push({ text: prompt });

  const payload = {
    contents: [
      {
        parts,
      },
    ],
  };

  const response = await fetch(`${url}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google API 调用失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // 解析响应
  const candidates = data.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error("Google API 返回空结果");
  }

  const responseParts = candidates[0].content?.parts;
  if (!responseParts || responseParts.length === 0) {
    throw new Error("Google API 内容为空");
  }

  // 查找包含图片的 part
  for (const part of responseParts) {
    if (part.inlineData && part.inlineData.data) {
      return part.inlineData.data;
    }
  }

  throw new Error("Google API 响应中未找到图片数据");
}

/**
 * 使用 OpenAI 兼容格式调用第三方平台
 * 支持多模态输入（文本+图片）
 */
async function generateImageViaOpenAIFormat(
  prompt: string,
  model: string,
  apiKey: string,
  baseURL: string,
  referenceImages?: string[]
): Promise<string> {
  const url = `${baseURL}/chat/completions`;

  // 构建多模态内容：如果有参考图，先传图片，再传文本
  const messageContent: any[] = [];
  if (referenceImages && referenceImages.length > 0) {
    for (const imgBase64 of referenceImages) {
      messageContent.push({
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${imgBase64}`,
        },
      });
    }
  }
  messageContent.push({
    type: "text",
    text: prompt,
  });

  const payload = {
    model: model,
    messages: [
      {
        role: "user",
        content: messageContent,
      },
    ],
    temperature: 0.7,
    max_tokens: 4000,
  };

  console.log(`调用第三方平台 (OpenAI 兼容格式): ${url}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`第三方平台 API 调用失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // 解析 OpenAI 兼容格式的响应
  const choices = data.choices;
  if (!choices || choices.length === 0) {
    throw new Error("第三方平台返回空结果");
  }

  const content = choices[0].message?.content;
  if (!content) {
    throw new Error("第三方平台内容为空");
  }

  // 检查 content 是否是数组格式（多模态响应）
  if (Array.isArray(content)) {
    for (const item of content) {
      if (item.type === "image_url" && item.image_url?.url) {
        const url = item.image_url.url;
        // 如果是 base64 data URL，提取 base64 部分
        if (url.startsWith("data:image")) {
          const base64Match = url.match(/data:image\/[^;]+;base64,(.+)/);
          if (base64Match && base64Match[1]) {
            return base64Match[1];
          }
        }
        // 如果是普通 URL，需要下载
        if (url.startsWith("http")) {
          const imgRes = await fetch(url);
          const buf = Buffer.from(await imgRes.arrayBuffer());
          return buf.toString("base64");
        }
      }
      if (item.type === "text" && item.text) {
        // 文本内容中可能包含 base64 图片数据
        const text = item.text;
        // 先移除所有空白字符，然后检查是否是纯 base64 字符串
        const cleanBase64 = text.replace(/\s+/g, "");
        if (/^[A-Za-z0-9+/=]+$/.test(cleanBase64) && cleanBase64.length > 1000) {
          return cleanBase64;
        }
        // 尝试从文本中提取 base64（带前缀）
        const base64Match = text.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
        if (base64Match && base64Match[1]) {
          return base64Match[1];
        }
        // 尝试提取 URL
        const imageUrlMatch = text.match(/(https?:\/\/[^\s]+?\.(?:png|jpe?g|gif))/i);
        if (imageUrlMatch && imageUrlMatch[1]) {
          const imgRes = await fetch(imageUrlMatch[1]);
          const buf = Buffer.from(await imgRes.arrayBuffer());
          return buf.toString("base64");
        }
      }
    }
  }

  // 如果 content 是字符串
  if (typeof content === "string") {
    // 1. 尝试解析 Markdown 格式的图片链接：![image](data:image/png;base64,...)
    const markdownImageMatch = content.match(/!\[[^\]]*\]\(data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)\)/);
    if (markdownImageMatch && markdownImageMatch[1]) {
      return markdownImageMatch[1];
    }
    
    // 2. 尝试解析直接的 data:image URL
    if (content.startsWith("data:image")) {
      const base64Match = content.match(/data:image\/[^;]+;base64,(.+)/);
      if (base64Match && base64Match[1]) {
        return base64Match[1];
      }
    }
    
    // 3. 尝试从字符串中提取 data:image/png;base64,... 格式
    const dataImageMatch = content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
    if (dataImageMatch && dataImageMatch[1]) {
      return dataImageMatch[1];
    }
    
    // 4. 如果返回的是很长的纯 base64 字符串（可能是图片数据）
    const cleanContent = content.replace(/\s+/g, "");
    if (/^[A-Za-z0-9+/=]+$/.test(cleanContent) && cleanContent.length > 1000) {
      return cleanContent;
    }
  }

  // 如果无法解析，返回错误
  throw new Error(`第三方平台返回的内容格式无法解析为图片。返回类型: ${typeof content}, 长度: ${typeof content === "string" ? content.length : "N/A"}`);
}
