import { NextResponse } from "next/server";
import { encrypt } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password } = body;

    // 1. 验证输入
    if (!username || !password) {
      return NextResponse.json({ error: "请填写完整信息" }, { status: 400 });
    }

    // 2. 从环境变量读取管理员账号密码
    const adminUsername = process.env.ADMIN_USERNAME || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD;

    // 3. 验证账号密码
    if (!adminPassword || username !== adminUsername || password !== adminPassword) {
      console.warn(`⚠️ 管理员登录失败: ${username}`);
      return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
    }

    console.log(`✅ 管理员登录成功: ${username}`);

    // 4. 制作管理员会话数据
    const sessionData = {
      isAdmin: true,
      username: username,
      loginTime: Date.now(),
    };

    const token = await encrypt(sessionData);

    // 5. 设置管理员专用的 Cookie
    const cookieStore = await cookies();
    cookieStore.set("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1天
      path: "/",
    });

    return NextResponse.json({
      success: true,
      message: "登录成功",
    });
  } catch (error: any) {
    console.error("管理员登录失败:", error);
    return NextResponse.json(
      { error: "服务端异常: " + (error.message || "未知错误") },
      { status: 500 }
    );
  }
}

