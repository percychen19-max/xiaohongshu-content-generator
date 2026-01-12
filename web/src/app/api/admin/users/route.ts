import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

// 初始化 Prisma (单例模式)
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// 获取用户列表
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }, // 按注册时间倒序
      take: 50 // 暂时限制50条
    });
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ error: "获取用户失败" }, { status: 500 });
  }
}

// 给用户充值
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 兼容旧逻辑：{ userId, amount } => 充值/扣减体验次数
    if (body?.userId && typeof body?.amount === "number") {
      const { userId, amount } = body as { userId: string; amount: number };
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          freeUsage: { increment: amount },
        },
      });
      return NextResponse.json(updatedUser);
    }

    // 新增成员：{ phone, freeUsage?, tokenBalance? }
    const { phone, freeUsage, tokenBalance } = body as {
      phone: string;
      freeUsage?: number;
      tokenBalance?: number;
    };

    if (!phone || String(phone).length !== 11) {
      return NextResponse.json({ error: "请输入有效的 11 位手机号" }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({ where: { phone } });
    if (exists) {
      return NextResponse.json({ error: "该手机号已存在用户", user: exists }, { status: 409 });
    }

    const created = await prisma.user.create({
      data: {
        phone,
        freeUsage: typeof freeUsage === "number" ? freeUsage : 3,
        tokenBalance: typeof tokenBalance === "number" ? tokenBalance : 0,
      },
    });

    return NextResponse.json(created);
  } catch (error) {
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}

