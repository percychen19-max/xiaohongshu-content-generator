import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const currentPath = request.nextUrl.pathname;

  // 1. 管理后台路由（使用独立的账号密码登录）
  if (currentPath.startsWith("/admin")) {
    // 排除登录页面本身
    if (currentPath === "/admin/login") {
      return NextResponse.next();
    }

    // 检查管理员 Cookie
    const adminCookie = request.cookies.get("admin_session")?.value;
    
    if (!adminCookie) {
      // 没登录 -> 去管理后台登录页
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    // 验证管理员 Cookie 有效性
    try {
      const session = await decrypt(adminCookie);
      if (session.isAdmin) {
        // 验证通过，放行
        return NextResponse.next();
      }
    } catch (error) {
      // Cookie 无效或过期，忽略错误继续
    }

    // Cookie 无效或不是管理员 -> 去管理后台登录页
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  // 2. 普通用户路由（使用手机号+验证码登录）
  if (currentPath.startsWith("/generate")) {
    const cookie = request.cookies.get("session")?.value;
    
    if (!cookie) {
      // 没登录 -> 去用户登录页
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // 验证 Cookie 有效性
    try {
      await decrypt(cookie);
      // 验证通过，放行
      return NextResponse.next();
    } catch (error) {
      // Cookie 无效或过期 -> 去用户登录页
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

