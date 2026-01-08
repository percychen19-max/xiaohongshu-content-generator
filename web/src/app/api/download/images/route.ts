import { NextResponse } from "next/server";
import JSZip from "jszip";

type Body = {
  urls: string[];
  name?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const urls = Array.isArray(body.urls) ? body.urls.filter(Boolean) : [];
    if (urls.length === 0) {
      return NextResponse.json({ error: "urls 不能为空" }, { status: 400 });
    }

    const zip = new JSZip();
    const folder = zip.folder((body.name || "images").slice(0, 40)) || zip;

    // 服务端抓取图片（不受浏览器 CORS 限制）
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      if (url.startsWith("data:image")) {
        const base64 = url.split("base64,")[1] || "";
        if (base64) folder.file(`image-${i + 1}.png`, Buffer.from(base64, "base64"));
        continue;
      }
      const res = await fetch(url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      folder.file(`image-${i + 1}.png`, buf);
    }

    const out = await zip.generateAsync({ type: "nodebuffer" });
    return new Response(out as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${(body.name || "images").slice(0, 40)}.zip"`,
      },
    });
  } catch (e: any) {
    console.error("批量下载打包失败:", e);
    return NextResponse.json({ error: e?.message || "打包失败" }, { status: 500 });
  }
}


