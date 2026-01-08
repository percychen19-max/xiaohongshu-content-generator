import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, CreditCard, TrendingUp } from "lucide-react";

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">概览仪表盘</h1>
        <p className="text-muted-foreground">欢迎回来，管理员。这是今天的运营数据。</p>
      </div>

      {/* 数据卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总用户数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
            <p className="text-xs text-muted-foreground">
              +180 较昨日
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日生成图文</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">573</div>
            <p className="text-xs text-muted-foreground">
              +20.1% 较上周
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日充值收入</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">¥ 2,350.00</div>
            <p className="text-xs text-muted-foreground">
              +19% 较昨日
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API 消耗成本</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">¥ 124.50</div>
            <p className="text-xs text-muted-foreground">
              利润率 94%
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
              {[1,2,3,4,5].map(i => (
                <div key={i} className="flex items-center">
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">用户 138****00{i}</p>
                    <p className="text-xs text-muted-foreground">购买了 10次加油包</p>
                  </div>
                  <div className="ml-auto font-medium">+¥9.90</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
