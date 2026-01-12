import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

// 创建全局唯一的 Prisma 实例，防止开发环境下连接数过多
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function GET() {
  try {
    const configs = await prisma.systemConfig.findMany();
    // 转换成 { key: value } 的格式方便前端使用
    const configMap: Record<string, string> = {};
    configs.forEach((c: { key: string; value: string }) => {
      configMap[c.key] = c.value;
    });
    return NextResponse.json(configMap);
  } catch (error) {
    return NextResponse.json({ error: "获取配置失败" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { key, value, description } = body;

    if (!key) {
      return NextResponse.json({ error: "Key 不能为空" }, { status: 400 });
    }

    // 更新或创建配置
    const config = await prisma.systemConfig.upsert({
      where: { key: key },
      update: { value: value, description: description },
      create: { key: key, value: value, description: description },
    });

    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json({ error: "保存配置失败" }, { status: 500 });
  }
}

