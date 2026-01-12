import { PrismaClient } from "@prisma/client";
import { decryptSecret } from "@/lib/crypto";

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const KEY = "API_CREDENTIALS_JSON";

type CredType = "text" | "image" | "imageseg";

type StoredCredential = {
  id: string;
  type: CredType;
  vendor: string;
  profile: string;
  baseURL?: string;
  secretEnc: string;
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

async function getList(): Promise<StoredCredential[]> {
  const row = await prisma.systemConfig.findUnique({ where: { key: KEY } });
  const parsed = safeJsonParse<StoredCredential[]>(row?.value ?? null);
  if (!Array.isArray(parsed)) return [];
  return parsed;
}

export async function resolveApiKeyFromStore(opts: { type: "text" | "image"; vendor: string; profile: string }) {
  const { type, vendor, profile } = opts;
  const list = await getList();
  const found = list.find((c) => c.type === type && c.vendor === vendor && c.profile === profile);
  if (!found) return null;
  const apiKey = decryptSecret(found.secretEnc);
  return { apiKey, baseURL: (found.baseURL || "").trim() || null };
}

export async function resolveImageSegCredsFromStore(opts: { vendor: string; profile: string }) {
  const { vendor, profile } = opts;
  const list = await getList();
  const found = list.find((c) => c.type === "imageseg" && c.vendor === vendor && c.profile === profile);
  if (!found) return null;
  const plain = decryptSecret(found.secretEnc);
  const obj = safeJsonParse<{ accessKeyId?: string; accessKeySecret?: string }>(plain);
  if (!obj?.accessKeyId || !obj?.accessKeySecret) return null;
  return { accessKeyId: obj.accessKeyId, accessKeySecret: obj.accessKeySecret, baseURL: (found.baseURL || "").trim() || null };
}

export async function listProfilesFromStore() {
  const list = await getList();
  const byVendor: Record<string, { text: Set<string>; image: Set<string>; imageseg: Set<string> }> = {};
  for (const c of list) {
    const v = c.vendor || "unknown";
    byVendor[v] = byVendor[v] || { text: new Set(), image: new Set(), imageseg: new Set() };
    byVendor[v][c.type].add(c.profile || "default");
  }
  const out: Record<string, { text: string[]; image: string[]; imageseg: string[] }> = {};
  Object.entries(byVendor).forEach(([vendor, sets]) => {
    out[vendor] = {
      text: Array.from(sets.text).sort(),
      image: Array.from(sets.image).sort(),
      imageseg: Array.from(sets.imageseg).sort(),
    };
  });
  return out;
}


