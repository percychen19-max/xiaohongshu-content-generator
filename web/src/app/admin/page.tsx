"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, CreditCard, TrendingUp, Activity, Zap } from "lucide-react";
import { Loader2 } from "lucide-react";

interface StatsData {
  totalUsers: number;
  totalGenerations: number;
  newUsersToday: number;
  generationsToday: number;
  totalConsumed: number;
  todayRevenue: number;
  apiCost: number;
  newUsersChange: number;
  generationsChange: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/stats");
        if (!res.ok) {
          throw new Error("获取统计数据失败");
        }
        const data = await res.json();
        setStats(data);
        setError(null);
      } catch (err: any) {
        setError(err.message || "加载失败");
        console.error("获取统计数据失败:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // 每30秒自动刷新一次
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatNumber = (num: number) => {
    return num.toLocaleString("zh-CN");
  };

  const formatChange = (change: number) => {
    if (change === 0) return "无变化";
    const sign = change > 0 ? "+" : "";
    return `${sign}${change} 较昨日`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500 mb-2">加载失败</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">概览仪表盘</h1>
        <p className="text-muted-foreground">欢迎回来，管理员。这是今天的运营数据。</p>
      </div>

      {/* 数据卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* 总用户数 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总用户数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalUsers)}</div>
            <p className="text-xs text-muted-foreground">
              {formatChange(stats.newUsersChange)}
            </p>
          </CardContent>
        </Card>

        {/* 总内容生产数 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总内容生产数</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalGenerations)}</div>
            <p className="text-xs text-muted-foreground">
              累计生成
            </p>
          </CardContent>
        </Card>

        {/* 新增用户数（今日） */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">新增用户数</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.newUsersToday)}</div>
            <p className="text-xs text-muted-foreground">
              今日新增
            </p>
          </CardContent>
        </Card>

        {/* 今日内容生产数 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日内容生产</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.generationsToday)}</div>
            <p className="text-xs text-muted-foreground">
              {formatChange(stats.generationsChange)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 第二行：消耗次数、收入、成本 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* 消耗次数情况 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">消耗次数情况</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalConsumed)}</div>
            <p className="text-xs text-muted-foreground">
              累计消耗次数
            </p>
          </CardContent>
        </Card>

        {/* 今日收入（保留，后续计算） */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日收入</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">¥ {stats.todayRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              待接入计算
            </p>
          </CardContent>
        </Card>

        {/* API消耗成本（保留，后续计算） */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API 消耗成本</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">¥ {stats.apiCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              待接入计算
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 下面可以放图表，这里先用卡片占位 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>生成趋势 (近7天)</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[200px] flex items-center justify-center bg-muted/20 rounded-md text-muted-foreground">
              图表区域 (待接入 Recharts)
            </div>
          </CardContent>
        </Card>
        
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>最近充值订单</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground text-center py-4">
                待接入充值订单数据
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
