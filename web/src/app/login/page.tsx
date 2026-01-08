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
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // 验证码倒计时逻辑
  const [countdown, setCountdown] = useState(0);
  
  const handleSendCode = async () => {
    if (!phone || phone.length !== 11) {
      alert("请输入正确的 11 位手机号");
      return;
    }

    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();

      if (res.ok) {
        // 开始倒计时
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        alert(data.message || "验证码已发送，请查收短信");
      } else {
        alert(data.error || "验证码发送失败，请稍后重试");
      }
    } catch (err) {
      console.error(err);
      alert("网络错误，请稍后重试");
    }
  };

  const handleLogin = async () => {
    if (!phone || !code) {
      alert("请填写完整信息");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });

      const data = await res.json();

      if (res.ok) {
        // 登录成功
        router.push("/generate");
      } else {
        alert(data.error || "登录失败");
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
          <CardTitle className="text-2xl font-bold text-center">欢迎回来</CardTitle>
          <CardDescription className="text-center">
            登录以开始创作爆款小红书图文
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="phone">手机号</Label>
            <Input 
              id="phone" 
              type="tel" 
              placeholder="请输入手机号" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="code">验证码</Label>
            <div className="flex gap-2">
              <Input 
                id="code" 
                type="text" 
                placeholder="短信验证码" 
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Button 
                variant="outline" 
                className="min-w-[100px]"
                onClick={handleSendCode}
                disabled={countdown > 0}
              >
                {countdown > 0 ? `${countdown}s` : "获取验证码"}
              </Button>
            </div>
          </div>

          <Button className="w-full" onClick={handleLogin} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                正在登录...
              </>
            ) : (
              <>
                登录 / 注册
                <ArrowRight className="ml-2 w-4 h-4" />
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            新用户登录即自动注册，并获赠 10 次免费体验额度
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

