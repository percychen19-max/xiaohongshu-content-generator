"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!phone || !password) {
      alert("请填写完整信息");
      return;
    }

    if (password.length < 6) {
      alert("密码至少需要6位");
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });

      const data = await res.json();

      if (res.ok) {
        // 注册/登录成功，等待 Cookie 设置完成后再跳转
        await new Promise(resolve => setTimeout(resolve, 100));
        router.replace("/generate");
      } else {
        alert(data.error || (isRegister ? "注册失败" : "登录失败"));
      }
    } catch (err) {
      console.error(err);
      alert("网络错误");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {isRegister ? "注册账号" : "欢迎回来"}
          </CardTitle>
          <CardDescription className="text-center">
            {isRegister ? "注册以开始创作优质内容" : "登录以开始创作优质内容"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="phone">手机号</Label>
            <Input 
              id="phone" 
              type="tel" 
              placeholder="请输入手机号（支持11位或13位数字）" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input 
              id="password" 
              type="password" 
              placeholder="请输入密码（至少6位）" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSubmit();
                }
              }}
            />
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                {isRegister ? "正在注册..." : "正在登录..."}
              </>
            ) : (
              <>
                {isRegister ? "注册" : "登录"}
                <ArrowRight className="ml-2 w-4 h-4" />
              </>
            )}
          </Button>

          <div className="text-center">
            <Button
              variant="link"
              className="text-sm"
              onClick={() => {
                setIsRegister(!isRegister);
                setPassword("");
              }}
            >
              {isRegister ? "已有账号？去登录" : "没有账号？去注册"}
            </Button>
          </div>

          {isRegister && (
            <p className="text-xs text-center text-muted-foreground">
              注册成功后将自动登录，并获赠 3 次免费体验额度
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

