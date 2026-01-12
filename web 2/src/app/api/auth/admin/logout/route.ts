import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("admin_session");
    
    return NextResponse.json({ success: true, message: "已退出登录" });
  } catch (error: any) {
    return NextResponse.json(
      { error: "退出失败: " + (error.message || "未知错误") },
      { status: 500 }
    );
  }
}

