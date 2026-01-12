import crypto from "crypto";

function getMasterKey() {
  // 生产建议单独设置：CRED_MASTER_KEY（32+ 字符随机）
  const raw = process.env.CRED_MASTER_KEY || process.env.JWT_SECRET || "dev-unsafe-master-key";
  // 统一 hash 成 32 bytes key（AES-256）
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string) {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12); // GCM 推荐 12 bytes
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plain, "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  // 格式：v1:iv:tag:cipher (base64)
  return [
    "v1",
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(payload: string) {
  if (!payload) return "";
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid secret payload");
  }
  const key = getMasterKey();
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const ciphertext = Buffer.from(parts[3], "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}


