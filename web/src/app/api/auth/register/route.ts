import { NextResponse } from "next/server";
import { encrypt } from "@/lib/auth";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, password } = body;

    // 1. 验证手机号格式（支持 11 位或 13 位数字）
    const p = String(phone || "").trim();
    const ok = /^\d{13}$/.test(p) || /^1[3-9]\d{9}$/.test(p);
    if (!ok) {
      return NextResponse.json({ error: "请输入有效手机号（支持11位或13位数字）" }, { status: 400 });
    }

    // 2. 验证密码
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "密码至少需要6位" }, { status: 400 });
    }

    // 3. 检查手机号是否已注册
    const existingUser = await prisma.user.findUnique({
      where: { phone: p },
    });

    if (existingUser) {
      return NextResponse.json({ error: "该手机号已注册，请直接登录" }, { status: 409 });
    }

    // 4. 创建新用户
    const hashedPassword = hashPassword(password);
    const user = await prisma.user.create({
      data: {
        phone: p,
        password: hashedPassword,
        freeUsage: 3, // 新用户赠送3次免费额度
        tokenBalance: 0,
      },
    });

    console.log(`✅ 新用户注册成功: ${phone} (ID: ${user.id})`);

    // 5. 检查是否为管理员
    const adminPhones = (process.env.ADMIN_PHONES || "").split(",").filter(Boolean);
    const isAdmin = adminPhones.includes(p) || user.id === process.env.ADMIN_USER_ID;

    // 6. 制作会话数据并自动登录
    const sessionData = {
      userId: user.id,
      phone: user.phone,
      freeUsage: user.freeUsage,
      tokenBalance: user.tokenBalance,
      isAdmin: isAdmin,
    };

    const token = await encrypt(sessionData);

    // 7. 设置 Cookie
    const cookieStore = await cookies();
    cookieStore.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1天
      path: "/",
    });

    console.log(`✅ 注册并自动登录成功: ${phone}`);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
        freeUsage: user.freeUsage,
        tokenBalance: user.tokenBalance,
      },
    });
  } catch (error: any) {
    console.error("注册失败:", error);
    return NextResponse.json(
      { error: "服务端异常: " + (error.message || "未知错误") },
      { status: 500 }
    );
  }
}

