import { NextResponse } from "next/server";
import { encrypt } from "@/lib/auth";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyCode } from "../send-code/route";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, code } = body;

    // 1. 验证手机号格式
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ error: "请输入有效的11位手机号" }, { status: 400 });
    }

    // 2. 验证验证码
    if (!code || code.length !== 6) {
      return NextResponse.json({ error: "请输入6位验证码" }, { status: 400 });
    }

    // 3. 验证验证码是否正确
    if (!verifyCode(phone, code)) {
      return NextResponse.json({ error: "验证码错误或已过期" }, { status: 400 });
    }

    console.log(`✅ 验证码验证通过，处理用户登录: ${phone}`);

    // 4. 查询或创建用户
    let user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      // 新用户：自动注册并赠送10次免费额度
      console.log(`📝 新用户注册: ${phone}`);
      user = await prisma.user.create({
        data: {
          phone,
          freeUsage: 10, // 新用户赠送10次免费额度
          tokenBalance: 0,
        },
      });
      console.log(`✅ 新用户已创建，ID: ${user.id}`);
    } else {
      console.log(`✅ 用户已存在，ID: ${user.id}`);
    }

    // 5. 检查是否为管理员（可以通过环境变量或数据库配置）
    const adminPhones = (process.env.ADMIN_PHONES || "").split(",").filter(Boolean);
    const isAdmin = adminPhones.includes(phone) || user.id === process.env.ADMIN_USER_ID;

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
