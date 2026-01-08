import imageseg20191230, * as $imageseg20191230 from "@alicloud/imageseg20191230";
import * as $OpenApi from "@alicloud/openapi-client";
import * as $Util from "@alicloud/tea-util";
import { getImageSegCreds } from "@/lib/credentials";
import { resolveImageSegCredsFromStore } from "@/lib/credential-resolver";

async function createClient(profile?: string | null, vendor = "aliyun-imageseg") {
  const store = await resolveImageSegCredsFromStore({ vendor, profile: profile || "default" });
  const creds = store || getImageSegCreds(profile);
  const { accessKeyId, accessKeySecret } = creds;
  const config = new $OpenApi.Config({
    accessKeyId,
    accessKeySecret,
    endpoint: "imageseg.cn-shanghai.aliyuncs.com",
  });
  return new imageseg20191230(config);
}

/**
 * 将 base64 图片转换为可访问的临时 URL
 */
async function uploadToTempServer(imageBase64: string): Promise<string> {
  // 获取服务器地址（从环境变量或默认值）
  const baseURL = process.env.NEXT_PUBLIC_BASE_URL || 
                  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                  "http://localhost:3000");
  
  const res = await fetch(`${baseURL}/api/temp-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64 }),
  });
  
  if (!res.ok) {
    throw new Error(`临时图片服务失败: ${res.status}`);
  }
  
  const data = await res.json();
  return data.url;
}

/**
 * 阿里云商品分割：返回“透明底主体 PNG”的 base64（不含 data: 前缀）
 */
export async function segmentCommodityToPngBase64(imageBase64: string, profile?: string | null): Promise<string> {
  console.log("正在调用阿里云商品抠图...");
  try {
    const client = await createClient(profile);

    // 阿里云 ImageSeg API 需要可访问的图片 URL，不支持 base64
    // 先将 base64 上传到临时服务器，获取可访问的 URL
    console.log("📤 上传图片到临时服务器...");
    const tempImageURL = await uploadToTempServer(imageBase64);
    console.log("✅ 临时图片 URL:", tempImageURL.substring(0, 50) + "...");

    const req = new $imageseg20191230.SegmentCommodityRequest({
      imageURL: tempImageURL,
    });

    const runtime = new $Util.RuntimeOptions({});
    const resp = await client.segmentCommodityWithOptions(req, runtime);
    
    // 检查响应结构
    if (!resp || !resp.body) {
      console.error("❌ 阿里云 API 响应为空");
      throw new Error("Aliyun imageseg returned empty response");
    }
    
    // 检查是否有错误
    if (resp.body.code && resp.body.code !== "200") {
      console.error("❌ 阿里云 API 返回错误:", resp.body.message || resp.body.code);
      throw new Error(`Aliyun imageseg error: ${resp.body.message || resp.body.code}`);
    }
    
    const resultImageURL = resp.body?.data?.imageURL;
    if (!resultImageURL) {
      console.error("❌ 阿里云 API 返回的 imageURL 为空");
      throw new Error("Aliyun imageseg returned empty imageURL.");
    }

    const url = resultImageURL.startsWith("http://") ? resultImageURL.replace("http://", "https://") : resultImageURL;
    console.log("📥 正在下载抠图结果:", url.substring(0, 50) + "...");
    const imgRes = await fetch(url);
    if (!imgRes.ok) {
      console.error(`❌ 下载抠图结果失败: ${imgRes.status} ${imgRes.statusText}`);
      throw new Error(`Failed to fetch cutout image: ${imgRes.status}`);
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    console.log("✅ 抠图成功，图片大小:", buf.length, "bytes");
    return buf.toString("base64");
  } catch (e: any) {
    console.error("❌ 抠图过程异常:", e.message || e);
    // 重新抛出错误，让调用方决定如何处理
    throw e;
  }
}
