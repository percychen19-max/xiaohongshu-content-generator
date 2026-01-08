import { NextResponse } from "next/server";
import { sendVerificationCode, generateVerificationCode } from "@/lib/aliyun-sms";
import { prisma } from "@/lib/prisma";

// 内存中存储验证码（生产环境建议使用 Redis）
const codeCache = new Map<string, { code: string; expiresAt: number }>();

// 验证码有效期：5分钟
const CODE_EXPIRES_IN = 5 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone } = body;

    // 1. 验证手机号格式
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ error: "请输入有效的11位手机号" }, { status: 400 });
    }

    // 2. 检查发送频率（60秒内只能发送一次）
    const cached = codeCache.get(phone);
    if (cached && Date.now() < cached.expiresAt - CODE_EXPIRES_IN + 60 * 1000) {
      const remainingSeconds = Math.ceil(
        (cached.expiresAt - CODE_EXPIRES_IN + 60 * 1000 - Date.now()) / 1000
      );
      return NextResponse.json(
        { error: `请${remainingSeconds}秒后再试` },
        { status: 429 }
      );
    }

    // 3. 生成验证码
    const code = generateVerificationCode();
    const expiresAt = Date.now() + CODE_EXPIRES_IN;

    // 4. 发送短信
    const sent = await sendVerificationCode({ phone, code });

    if (!sent) {
      // 如果短信发送失败，在开发环境下仍然返回成功（方便测试）
      if (process.env.NODE_ENV === "development") {
        console.warn("⚠️ 开发环境：短信发送失败，但允许继续（验证码:", code, ")");
        // 仍然保存验证码到缓存
        codeCache.set(phone, { code, expiresAt });
        return NextResponse.json({ success: true, message: "验证码已发送（开发模式）" });
      }
      return NextResponse.json({ error: "验证码发送失败，请稍后重试" }, { status: 500 });
    }

    // 5. 保存验证码到缓存
    codeCache.set(phone, { code, expiresAt });

    // 6. 清理过期验证码（定期清理）
    if (codeCache.size > 1000) {
      const now = Date.now();
      for (const [key, value] of codeCache.entries()) {
        if (now > value.expiresAt) {
          codeCache.delete(key);
        }
      }
    }

    console.log(`✅ 验证码已发送到 ${phone}（开发环境显示: ${code}）`);

    return NextResponse.json({ success: true, message: "验证码已发送" });
  } catch (error: any) {
    console.error("发送验证码失败:", error);
    return NextResponse.json(
      { error: "服务端异常: " + (error.message || "未知错误") },
      { status: 500 }
    );
  }
}

/**
 * 验证验证码（供登录 API 使用）
 */
export function verifyCode(phone: string, code: string): boolean {
  const cached = codeCache.get(phone);
  if (!cached) {
    return false;
  }

  // 检查是否过期
  if (Date.now() > cached.expiresAt) {
    codeCache.delete(phone);
    return false;
  }

  // 验证码匹配
  if (cached.code !== code) {
    return false;
  }

  // 验证成功后删除验证码（一次性使用）
  codeCache.delete(phone);
  return true;
}

