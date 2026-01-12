import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function GET() {
  try {
    // 获取今天开始的时间（00:00:00）
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    // 获取今天结束的时间（23:59:59）
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 1. 总用户数
    const totalUsers = await prisma.user.count();

    // 2. 总内容生产数（Generation 记录总数）
    const totalGenerations = await prisma.generation.count();

    // 3. 新增用户数（今日）
    const newUsersToday = await prisma.user.count({
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    // 4. 今日内容生产数
    const generationsToday = await prisma.generation.count({
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    // 5. 消耗次数情况（通过 Generation 记录估算，每次生成消耗1次）
    // 这里假设每次生成消耗1次，实际可能需要根据业务逻辑调整
    const totalConsumed = totalGenerations;

    // 6. 今日收入（保留，后续计算）
    const todayRevenue = 0;

    // 7. API消耗成本（保留，后续计算）
    const apiCost = 0;

    // 8. 昨日新增用户数（用于对比）
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
    
    const newUsersYesterday = await prisma.user.count({
      where: {
        createdAt: {
          gte: yesterdayStart,
          lte: yesterdayEnd,
        },
      },
    });

    // 9. 昨日内容生产数（用于对比）
    const generationsYesterday = await prisma.generation.count({
      where: {
        createdAt: {
          gte: yesterdayStart,
          lte: yesterdayEnd,
        },
      },
    });

    return NextResponse.json({
      totalUsers,
      totalGenerations,
      newUsersToday,
      generationsToday,
      totalConsumed,
      todayRevenue,
      apiCost,
      // 对比数据
      newUsersChange: newUsersToday - newUsersYesterday,
      generationsChange: generationsToday - generationsYesterday,
    });
  } catch (error: any) {
    console.error("获取统计数据失败:", error);
    return NextResponse.json(
      { error: "获取统计数据失败: " + (error.message || "未知错误") },
      { status: 500 }
    );
  }
}

