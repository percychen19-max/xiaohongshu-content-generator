import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    // 从数据库查询最新用户信息
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        phone: true,
        freeUsage: true,
        tokenBalance: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    return NextResponse.json({
      phone: user.phone,
      freeUsage: user.freeUsage,
      tokenBalance: user.tokenBalance,
      createdAt: user.createdAt,
    });
  } catch (error: any) {
    console.error("获取用户信息失败:", error);
    return NextResponse.json(
      { error: "服务端异常: " + (error.message || "未知错误") },
      { status: 500 }
    );
  }
}
