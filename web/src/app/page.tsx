import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Image as ImageIcon, Zap, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* 导航栏 */}
      <header className="px-6 lg:px-10 h-16 flex items-center border-b border-zinc-100 sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <Link className="flex items-center justify-center gap-2" href="/">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">小红书爆文生成</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link className="text-sm font-medium hover:underline underline-offset-4" href="/login">
            登录
          </Link>
          <Link href="/generate">
            <Button size="sm" className="rounded-full px-6">立即开始</Button>
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-20 lg:py-32 flex flex-col items-center text-center px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-zinc-600 text-xs font-medium mb-6 animate-fade-in">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>AI 驱动的爆文创作神器</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl max-w-4xl leading-[1.1]">
            让每一份好物，都成为<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-pink-500 to-amber-500">
              小红书终极爆款
            </span>
          </h1>
          <p className="mx-auto max-w-[700px] text-zinc-500 md:text-xl dark:text-zinc-400 mt-8 mb-10 leading-relaxed">
            专为电商设计的 AI 智能体。只需上传一张白底图，剩下的交给 AI。
            自动生成吸睛文案与电影级场景配图，精准还原产品，赋能企业高效运营。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-sm">
            <Link href="/generate">
              <Button size="lg" className="w-full sm:w-auto h-14 px-10 rounded-full text-lg shadow-xl shadow-red-100 hover:scale-105 transition-transform">
                立即开始体验 <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/admin">
              <Button variant="outline" size="lg" className="w-full sm:w-auto h-14 px-10 rounded-full text-lg">
                管理后台
              </Button>
            </Link>
          </div>
          
          {/* 预览图装饰 */}
          <div className="mt-20 relative w-full max-w-5xl aspect-[16/9] rounded-2xl border border-zinc-200 shadow-2xl overflow-hidden bg-zinc-50 animate-float">
             <div className="absolute inset-0 bg-gradient-to-br from-zinc-100 to-white flex items-center justify-center">
                <div className="flex gap-4 opacity-40">
                   <ImageIcon className="w-20 h-20 text-zinc-300" />
                   <Sparkles className="w-20 h-20 text-zinc-300" />
                </div>
             </div>
             <div className="absolute top-4 left-4 right-4 h-8 bg-white/80 backdrop-blur rounded-lg border border-white/50 shadow-sm flex items-center px-4 gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
             </div>
          </div>
        </section>

        {/* 特性展示 */}
        <section className="w-full py-20 bg-zinc-50 border-y border-zinc-100">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center">
                  <Zap className="h-8 w-8 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold">秒级创作</h3>
                <p className="text-zinc-500 leading-relaxed">告别繁琐的后期和拍摄，AI 在几秒内为您生成高质量的爆文文案和 6 张专业配图。</p>
              </div>
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center">
                  <ShieldCheck className="h-8 w-8 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold">精准控图</h3>
                <p className="text-zinc-500 leading-relaxed">基于自研抠图与合成技术，确保产品主体细节 100% 还原，拒绝货不对板。</p>
              </div>
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold">多引擎切换</h3>
                <p className="text-zinc-500 leading-relaxed">集成豆包、阿里、谷歌等顶级 AI 模型，可根据业务需求自由配置最优生成方案。</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-10 px-6 border-t border-zinc-100 flex flex-col md:flex-row justify-between items-center gap-4 text-zinc-500 text-sm">
        <p>© 2026 小红书爆文生成. All rights reserved.</p>
        <div className="flex gap-6">
          <Link className="hover:text-black" href="#">使用条款</Link>
          <Link className="hover:text-black" href="#">隐私政策</Link>
          <Link className="hover:text-black" href="#">关于我们</Link>
        </div>
      </footer>
    </div>
  );
}
