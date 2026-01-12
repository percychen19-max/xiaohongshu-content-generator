export type CredProfile = string;

type Provider = "volc" | "dashscope" | "imageseg" | "google";

function normalizeProfile(p?: string | null): CredProfile {
  const s = String(p || "").trim();
  return s || "default";
}

function uniqSorted(list: string[]) {
  return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
}

/**
 * 扫描环境变量，提取可用的 profile 名称（只返回名字，不返回任何密钥）。
 *
 * 规则：
 * - VOLC_API_KEY 或 VOLC_API_KEY_<PROFILE>
 * - DASHSCOPE_API_KEY 或 DASHSCOPE_API_KEY_<PROFILE>
 * - ALIBABA_CLOUD_ACCESS_KEY_ID 或 ALIBABA_CLOUD_ACCESS_KEY_ID_<PROFILE>
 *
 * 备注：默认 profile 永远存在（即使没有配置，也会返回 "default" 供 UI 选择）。
 */
export function listAvailableProfiles(): Record<Provider, CredProfile[]> {
  const env = process.env;

  const volc: string[] = ["default"];
  const dashscope: string[] = ["default"];
  const imageseg: string[] = ["default"];
  const google: string[] = ["default"];

  Object.keys(env).forEach((k) => {
    let m: RegExpMatchArray | null;
    m = k.match(/^VOLC_API_KEY_(.+)$/);
    if (m?.[1]) volc.push(m[1]);

    m = k.match(/^DASHSCOPE_API_KEY_(.+)$/);
    if (m?.[1]) dashscope.push(m[1]);

    m = k.match(/^ALIBABA_CLOUD_ACCESS_KEY_ID_(.+)$/);
    if (m?.[1]) imageseg.push(m[1]);

    m = k.match(/^GOOGLE_API_KEY_(.+)$/);
    if (m?.[1]) google.push(m[1]);
  });

  return {
    volc: uniqSorted(volc),
    dashscope: uniqSorted(dashscope),
    imageseg: uniqSorted(imageseg),
    google: uniqSorted(google),
  };
}

export function getVolcApiKey(profile?: string | null) {
  const p = normalizeProfile(profile);
  if (p !== "default" && process.env[`VOLC_API_KEY_${p}`]) return process.env[`VOLC_API_KEY_${p}`] as string;
  return process.env.VOLC_API_KEY || process.env.AI_API_KEY || process.env.TEXT_API_KEY || "";
}

export function getDashscopeApiKey(profile?: string | null) {
  const p = normalizeProfile(profile);
  if (p !== "default" && process.env[`DASHSCOPE_API_KEY_${p}`]) return process.env[`DASHSCOPE_API_KEY_${p}`] as string;
  return process.env.DASHSCOPE_API_KEY || process.env.IMAGE_API_KEY || "";
}

export function getImageSegCreds(profile?: string | null): { accessKeyId: string; accessKeySecret: string } {
  const p = normalizeProfile(profile);

  const accessKeyId =
    (p !== "default" ? (process.env[`ALIBABA_CLOUD_ACCESS_KEY_ID_${p}`] as string | undefined) : undefined) ||
    process.env.ALIBABA_CLOUD_ACCESS_KEY_ID ||
    process.env.ALIYUN_ACCESS_KEY ||
    process.env.ALIYUN_ACCESS_KEY_ID;

  const accessKeySecret =
    (p !== "default" ? (process.env[`ALIBABA_CLOUD_ACCESS_KEY_SECRET_${p}`] as string | undefined) : undefined) ||
    process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET ||
    process.env.ALIYUN_SECRET_KEY ||
    process.env.ALIYUN_ACCESS_KEY_SECRET;

  if (!accessKeyId || !accessKeySecret) {
    throw new Error(
      "Missing Aliyun credentials. Please set ALIBABA_CLOUD_ACCESS_KEY_ID and ALIBABA_CLOUD_ACCESS_KEY_SECRET (or ALIYUN_ACCESS_KEY / ALIYUN_SECRET_KEY)."
    );
  }
  return { accessKeyId, accessKeySecret };
}

export function getGoogleApiKey(profile?: string | null) {
  const p = normalizeProfile(profile);
  if (p !== "default" && process.env[`GOOGLE_API_KEY_${p}`]) return process.env[`GOOGLE_API_KEY_${p}`] as string;
  return process.env.GOOGLE_API_KEY || "";
}


