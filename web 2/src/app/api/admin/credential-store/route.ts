import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const KEY = "API_CREDENTIALS_JSON";

type CredType = "text" | "image" | "imageseg";

export type StoredCredential = {
  id: string;
  type: CredType;
  vendor: string;
  profile: string; // default/primary/backup/...
  baseURL?: string; // 可选：覆盖默认 baseURL
  // 加密字段（密文）
  secretEnc: string; // text/image: apiKey；imageseg: JSON({accessKeyId,accessKeySecret})
  createdAt: string;
  updatedAt: string;
};

function safeJsonParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function getList(): Promise<StoredCredential[]> {
  const row = await prisma.systemConfig.findUnique({ where: { key: KEY } });
  const parsed = safeJsonParse<StoredCredential[]>(row?.value ?? null);
  if (!Array.isArray(parsed)) return [];
  return parsed;
}

async function setList(list: StoredCredential[]) {
  await prisma.systemConfig.upsert({
    where: { key: KEY },
    update: { value: JSON.stringify(list), description: "API管理中心：凭证 profiles（加密存储）" },
    create: { key: KEY, value: JSON.stringify(list), description: "API管理中心：凭证 profiles（加密存储）" },
  });
}

function mask(s: string) {
  const str = String(s || "");
  if (str.length <= 8) return "***";
  return `${str.slice(0, 4)}****${str.slice(-4)}`;
}

export async function GET() {
  try {
    const list = await getList();
    // 只返回掩码与元信息，不返回明文
    const items = list.map((c) => {
      let kind: "apiKey" | "aksk" = c.type === "imageseg" ? "aksk" : "apiKey";
      let preview = "";
      try {
        const plain = decryptSecret(c.secretEnc);
        if (kind === "apiKey") preview = mask(plain);
        else {
          const obj = safeJsonParse<{ accessKeyId?: string; accessKeySecret?: string }>(plain);
          preview = `${mask(obj?.accessKeyId || "")} / ${mask(obj?.accessKeySecret || "")}`;
        }
      } catch {
        preview = "(解密失败)";
      }
      return {
        id: c.id,
        type: c.type,
        vendor: c.vendor,
        profile: c.profile,
        baseURL: c.baseURL || "",
        secretPreview: preview,
        updatedAt: c.updatedAt,
      };
    });
    return NextResponse.json({ credentials: items });
  } catch {
    return NextResponse.json({ error: "获取凭证失败" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = body as {
      id?: string;
      type: CredType;
      vendor: string;
      profile: string;
      baseURL?: string;
      // 明文输入（仅 POST 时接收）
      apiKey?: string; // text/image
      accessKeyId?: string; // imageseg
      accessKeySecret?: string; // imageseg
    };

    if (!input.type || !["text", "image", "imageseg"].includes(input.type)) {
      return NextResponse.json({ error: "type 必须为 text/image/imageseg" }, { status: 400 });
    }
    if (!input.vendor?.trim()) return NextResponse.json({ error: "vendor 不能为空" }, { status: 400 });
    if (!input.profile?.trim()) return NextResponse.json({ error: "profile 不能为空" }, { status: 400 });

    let secretPlain = "";
    if (input.type === "imageseg") {
      if (!input.accessKeyId || !input.accessKeySecret) {
        return NextResponse.json({ error: "imageseg 需要 accessKeyId/accessKeySecret" }, { status: 400 });
      }
      secretPlain = JSON.stringify({ accessKeyId: input.accessKeyId, accessKeySecret: input.accessKeySecret });
    } else {
      if (!input.apiKey) return NextResponse.json({ error: "需要 apiKey" }, { status: 400 });
      secretPlain = input.apiKey;
    }

    const now = new Date().toISOString();
    const list = await getList();
    const id = input.id || uuid();
    const existed = list.find((x) => x.id === id);

    const next: StoredCredential = {
      id,
      type: input.type,
      vendor: input.vendor.trim(),
      profile: input.profile.trim(),
      baseURL: (input.baseURL || "").trim(),
      secretEnc: encryptSecret(secretPlain),
      createdAt: existed?.createdAt || now,
      updatedAt: now,
    };

    // 同 type+vendor+profile 视作唯一；保存时覆盖旧的
    const filtered = list.filter((x) => !(x.type === next.type && x.vendor === next.vendor && x.profile === next.profile) && x.id !== id);
    filtered.unshift(next);
    await setList(filtered);
    return NextResponse.json({ credential: { ...next, secretEnc: "" } });
  } catch {
    return NextResponse.json({ error: "保存失败" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
    const list = await getList();
    await setList(list.filter((x) => x.id !== id));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}


