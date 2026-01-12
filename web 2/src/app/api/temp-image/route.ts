import { NextResponse } from "next/server";

/**
 * 临时图片服务：将 base64 图片转换为可访问的 URL
 * POST /api/temp-image
 * Body: { imageBase64: "..." }
 * 
 * 返回：{ url: "http://localhost:3000/api/temp-image?id=xxx" }
 */
const imageCache = new Map<string, { data: string; timestamp: number }>();

// 清理过期图片（30分钟）
setInterval(() => {
  const now = Date.now();
  for (const [id, item] of imageCache.entries()) {
    if (now - item.timestamp > 30 * 60 * 1000) {
      imageCache.delete(id);
    }
  }
}, 5 * 60 * 1000); // 每5分钟清理一次

export async function POST(req: Request) {
  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ error: "需要 imageBase64" }, { status: 400 });
    }

    const id = Math.random().toString(36).substring(2, 15);
    imageCache.set(id, { data: imageBase64, timestamp: Date.now() });

    // 获取当前请求的 host
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const url = `${protocol}://${host}/api/temp-image?id=${id}`;

    return NextResponse.json({ url, id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "需要 id" }, { status: 400 });
    }

    const item = imageCache.get(id);
    if (!item) {
      return NextResponse.json({ error: "图片不存在或已过期" }, { status: 404 });
    }

    // 返回图片
    const buffer = Buffer.from(item.data, "base64");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

