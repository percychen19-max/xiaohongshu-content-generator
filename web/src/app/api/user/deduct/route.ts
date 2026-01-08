import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST() {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // 临时：关闭扣费，无限畅玩！
  // const currentUsage = typeof session.freeUsage === 'number' ? session.freeUsage : 0;
  // if (currentUsage <= 0) ...
  
  // 假装扣费成功，实际上不减
  return NextResponse.json({ success: true, remaining: 99999 });
}
