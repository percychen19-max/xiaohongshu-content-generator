import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const KEY = "API_PROVIDERS_JSON";

export type ProviderType = "text" | "image" | "imageseg";

export type ApiProvider = {
  id: string;
  type: ProviderType;
  name: string;
  vendor: string; // e.g. volc/dashscope/aliyun-imageseg/other
  baseURL: string;
  defaultModel?: string;
  credProfile: string; // e.g. default/primary/backup
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

async function getProviders(): Promise<ApiProvider[]> {
  const row = await prisma.systemConfig.findUnique({ where: { key: KEY } });
  const parsed = safeJsonParse<ApiProvider[]>(row?.value ?? null);
  if (!Array.isArray(parsed)) return [];
  return parsed;
}

async function setProviders(list: ApiProvider[]) {
  await prisma.systemConfig.upsert({
    where: { key: KEY },
    update: { value: JSON.stringify(list), description: "供应商API配置（Provider Registry）" },
    create: { key: KEY, value: JSON.stringify(list), description: "供应商API配置（Provider Registry）" },
  });
}

function uuid() {
  // 轻量 uuid（避免引入依赖）；够用即可
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function GET() {
  try {
    const providers = await getProviders();
    return NextResponse.json({ providers });
  } catch (e) {
    return NextResponse.json({ error: "获取供应商失败" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = body as Partial<ApiProvider>;

    if (!input.type || !["text", "image", "imageseg"].includes(input.type)) {
      return NextResponse.json({ error: "type 不能为空，且必须为 text/image/imageseg" }, { status: 400 });
    }
    if (!input.name?.trim()) return NextResponse.json({ error: "name 不能为空" }, { status: 400 });
    if (!input.vendor?.trim()) return NextResponse.json({ error: "vendor 不能为空" }, { status: 400 });
    if (!input.baseURL?.trim()) return NextResponse.json({ error: "baseURL 不能为空" }, { status: 400 });

    const now = new Date().toISOString();
    const providers = await getProviders();

    const id = input.id || uuid();
    const next: ApiProvider = {
      id,
      type: input.type,
      name: input.name.trim(),
      vendor: input.vendor.trim(),
      baseURL: input.baseURL.trim(),
      defaultModel: input.defaultModel?.trim() || "",
      credProfile: (input.credProfile || "default").trim() || "default",
      createdAt: input.id ? (providers.find((p) => p.id === id)?.createdAt || now) : now,
      updatedAt: now,
    };

    const filtered = providers.filter((p) => p.id !== id);
    filtered.unshift(next);
    await setProviders(filtered);
    return NextResponse.json({ provider: next });
  } catch (e) {
    return NextResponse.json({ error: "保存供应商失败" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

    const providers = await getProviders();
    const next = providers.filter((p) => p.id !== id);
    await setProviders(next);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}


