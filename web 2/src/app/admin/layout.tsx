"use client";

import { LayoutDashboard, Users, Settings, SlidersHorizontal, Plug, KeyRound, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const menuItems = [
    { icon: LayoutDashboard, label: "概览", href: "/admin" },
    { icon: Users, label: "用户管理", href: "/admin/users" },
    { icon: KeyRound, label: "API管理中心", href: "/admin/credentials" },
    { icon: Plug, label: "供应商管理", href: "/admin/providers" },
    { icon: SlidersHorizontal, label: "引擎配置", href: "/admin/engines" },
    { icon: Settings, label: "配置中心", href: "/admin/config" },
  ];

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* 侧边栏 */}
      <aside className="w-64 bg-background border-r flex flex-col">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded text-sm">ADMIN</span>
            管理后台
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <Button 
                  variant={isActive ? "secondary" : "ghost"} 
                  className={`w-full justify-start ${isActive ? "font-bold" : ""}`}
                >
                  <item.icon className="mr-2 w-4 h-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t">
          <Button 
            variant="outline" 
            className="w-full text-red-500 hover:text-red-600 hover:bg-red-50" 
            onClick={async () => {
              // 清除管理员 Cookie
              await fetch("/api/auth/admin/logout", { method: "POST" });
              window.location.href = "/admin/login";
            }}
          >
            <LogOut className="mr-2 w-4 h-4" />
            退出后台
          </Button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

