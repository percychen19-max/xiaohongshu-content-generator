import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";

export async function POST(req: Request) {
  try {
    // 1. 验证用户登录状态
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = await req.json();
    const { oldPassword, newPassword } = body;

    // 2. 验证输入
    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: "请填写完整信息" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "新密码至少需要6位" }, { status: 400 });
    }

    // 3. 获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    // 4. 验证旧密码
    if (!user.password || !verifyPassword(oldPassword, user.password)) {
      return NextResponse.json({ error: "原密码错误" }, { status: 401 });
    }

    // 5. 更新密码
    const hashedNewPassword = hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedNewPassword },
    });

    console.log(`✅ 用户 ${user.phone} 修改密码成功`);

    return NextResponse.json({
      success: true,
      message: "密码修改成功",
    });
  } catch (error: any) {
    console.error("修改密码失败:", error);
    return NextResponse.json(
      { error: "服务端异常: " + (error.message || "未知错误") },
      { status: 500 }
    );
  }
}

