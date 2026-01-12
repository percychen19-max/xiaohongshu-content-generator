import { NextResponse } from "next/server";
import { encrypt } from "@/lib/auth";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

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
    if (!password) {
      return NextResponse.json({ error: "请输入密码" }, { status: 400 });
    }

    // 3. 查询用户
    const user = await prisma.user.findUnique({
      where: { phone: p },
    });

    if (!user) {
      return NextResponse.json({ error: "手机号未注册，请先注册" }, { status: 404 });
    }

    // 4. 验证密码（老用户可能没有密码，需要先注册）
    if (!user.password) {
      return NextResponse.json({ error: "该账号尚未设置密码，请先注册" }, { status: 403 });
    }
    if (!verifyPassword(password, user.password)) {
      return NextResponse.json({ error: "密码错误" }, { status: 401 });
    }

    console.log(`✅ 密码验证通过，处理用户登录: ${phone}`);

    // 5. 检查是否为管理员（可以通过环境变量或数据库配置）
    const adminPhones = (process.env.ADMIN_PHONES || "").split(",").filter(Boolean);
    const isAdmin = adminPhones.includes(p) || user.id === process.env.ADMIN_USER_ID;

    // 6. 制作会话数据
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

    console.log(`✅ 登录成功: ${phone} (免费额度: ${user.freeUsage}, Token: ${user.tokenBalance})`);

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
    console.error("登录失败:", error);
    return NextResponse.json(
      { error: "服务端异常: " + (error.message || "未知错误") },
      { status: 500 }
    );
  }
}
