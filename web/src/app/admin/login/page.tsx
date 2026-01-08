"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Shield } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!username || !password) {
      setError("请填写完整信息");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        // 登录成功，跳转到管理后台
        router.push("/admin");
      } else {
        setError(data.error || "登录失败");
      }
    } catch (err) {
      console.error(err);
      setError("网络错误，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">管理后台登录</CardTitle>
          <CardDescription className="text-center">
            请输入管理员账号和密码
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="username">管理员账号</Label>
            <Input 
              id="username" 
              type="text" 
              placeholder="请输入管理员账号" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input 
              id="password" 
              type="password" 
              placeholder="请输入密码" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          <Button className="w-full" onClick={handleLogin} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                正在登录...
              </>
            ) : (
              "登录"
            )}
          </Button>

          <div className="text-center">
            <Button 
              variant="link" 
              className="text-sm text-muted-foreground"
              onClick={() => router.push("/login")}
            >
              返回用户登录
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

