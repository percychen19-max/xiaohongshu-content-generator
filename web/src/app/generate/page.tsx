"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImagePlus, Sparkles, Copy, Download, Loader2, Crown, Eye, FolderDown, KeyRound } from "lucide-react";

type CopyOption = {
  title: string;
  body: string;
  tags: string[];
};

export default function GeneratePage() {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [refImages, setRefImages] = useState<Array<{ dataUrl: string; note: string }>>([]);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [positivePrompt, setPositivePrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  
  // 结果状态
  const [copyOptions, setCopyOptions] = useState<CopyOption[] | null>(null);
  const [selectedCopyIndex, setSelectedCopyIndex] = useState(0);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  
  // 两个阶段的 Loading 状态
  const [isCopyLoading, setIsCopyLoading] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  
  const [userInfo, setUserInfo] = useState<{ phone: string; freeUsage: number } | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [showRechargeDialog, setShowRechargeDialog] = useState(false);
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // 图片预览状态
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    let cancelled = false;
    setIsUserLoading(true);
    
    fetch("/api/user/me")
      .then(res => res.json())
      .then(data => {
        if (cancelled || !isMountedRef.current) return; // 防止卸载后更新
        if (!data.error) {
          setUserInfo(data);
        } else {
          // 使用 replace 避免历史记录问题
          router.replace("/login");
          return;
        }
        setIsUserLoading(false);
      })
      .catch((err) => {
        if (!cancelled && isMountedRef.current) {
          console.error("获取用户信息失败:", err);
          router.replace("/login");
        }
      });
    
    return () => {
      cancelled = true;
      isMountedRef.current = false;
    };
  }, [router]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setRefImages((prev) => [...prev, { dataUrl, note: "" }]);
        if (!selectedImage) setSelectedImage(dataUrl);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleGenerate = async () => {
    if (!productName.trim() || !description.trim()) return alert("请填写产品名称和卖点描述");
    if (userInfo && userInfo.freeUsage <= 0) return setShowRechargeDialog(true);

    // 保存当前输入（用于生成）
    const currentProductName = productName;
    const currentDescription = description;
    const currentSelectedImage = selectedImage;
    const currentRefImages = refImages;
    const currentPrimaryIndex = primaryIndex;
    const currentPositivePrompt = positivePrompt;
    const currentNegativePrompt = negativePrompt;

    // 重置结果（但保留输入，便于重复生成/调整）
    setCopyOptions(null);
    setSelectedCopyIndex(0);
    setGeneratedImages([]);
    
    // 阶段一：生成文案
    setIsCopyLoading(true);
    let currentCopyText = "";
    try {
      const res = await fetch("/api/generate/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // imageUrl 可选：未上传图片时不传该字段
        body: JSON.stringify({ productName: currentProductName, description: currentDescription, imageUrl: currentSelectedImage || undefined }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errorData.error || `请求失败: ${res.status}`);
      }
      
      const data = await res.json();
      
      console.log("📝 文案生成 API 返回:", { 
        hasOptions: Array.isArray(data.options), 
        optionsLength: data.options?.length,
        hasCopy: !!data.copy,
        copyLength: data.copy?.length,
        error: data.error 
      });
      
      // 检查是否有错误
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (Array.isArray(data.options) && data.options.length >= 2) {
        console.log("✅ 使用 options 格式");
        setCopyOptions(data.options);
        const first = data.options[0] as CopyOption;
        const tagsLine = (first.tags || []).map((t) => `#${t}`).join(" ");
        currentCopyText = `${first.title}\n${first.body}\n${tagsLine}`.trim();
      } else if (data.copy) {
        console.log("⚠️ 使用 copy 格式，尝试解析...");
        // 兼容旧格式：尝试从 copy 文本中解析出结构化内容
        const copyText = data.copy;
        const titleMatch = copyText.match(/\*\*标题\*\*[：:]\s*([^\n]+)/i);
        const bodyMatch = copyText.match(/\*\*正文\*\*[：:]\s*([\s\S]+?)(?=\*\*标签\*\*|$)/i);
        const tagsMatch = copyText.match(/\*\*标签\*\*[：:]\s*([\s\S]+?)(?=\n\n|\n```|$)/i);
        
        // 只要有标题就可以解析（正文可选）
        if (titleMatch) {
          console.log("✅ 找到标题，开始解析...");
          const title = titleMatch[1].trim();
          // 如果有正文匹配，使用匹配的内容；否则尝试从标题后提取正文
          let body = bodyMatch ? bodyMatch[1].trim() : "";
          if (!body && titleMatch.index !== undefined) {
            // 从标题后开始，到标签或结尾，提取正文
            const afterTitle = copyText.substring(titleMatch.index + titleMatch[0].length);
            const bodyEndMatch = afterTitle.match(/(?:\*\*标签\*\*|$)/);
            if (bodyEndMatch) {
              body = afterTitle.substring(0, bodyEndMatch.index || afterTitle.length).trim();
            } else {
              body = afterTitle.trim();
            }
          }
          
          let tags: string[] = [];
          if (tagsMatch) {
            const tagsText = tagsMatch[1].trim();
            const jsonCodeBlockMatch = tagsText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
            if (jsonCodeBlockMatch) {
              try {
                tags = JSON.parse(jsonCodeBlockMatch[1]);
              } catch {
                tags = tagsText.split(/[，,、\s]+/).filter(Boolean);
              }
            } else {
              tags = tagsText.split(/[，,、\s]+/).filter(Boolean);
            }
          }
          
          if (tags.length === 0) {
            tags = ["好物分享", "生活好物", "种草"];
          }
          
          const parsedOptions: CopyOption[] = [
            { title, body, tags },
            { 
              title: title.replace(/！/g, "✨").replace(/！/g, "💕"), 
              body: body.replace(/终于/g, "总算").replace(/真的/g, "确实"), 
              tags: tags.length > 0 ? tags : ["好物推荐", "生活分享", "种草清单"] 
            }
          ];
          console.log("✅ 解析成功，设置 copyOptions:", { title, bodyLength: body.length, tagsCount: tags.length });
          setCopyOptions(parsedOptions);
          const tagsLine = (parsedOptions[0].tags || []).map((t) => `#${t}`).join(" ");
          currentCopyText = `${parsedOptions[0].title}\n${parsedOptions[0].body}\n${tagsLine}`.trim();
        } else {
          console.log("❌ 无法解析标题，使用原始文本作为兜底");
          // 无法解析，使用原始文本作为兜底，至少显示出来
          const fallbackOptions: CopyOption[] = [
            { 
              title: "文案内容", 
              body: copyText, 
              tags: ["好物分享", "生活好物", "种草"] 
            },
            { 
              title: "文案内容（备选）", 
              body: copyText, 
              tags: ["好物推荐", "生活分享", "种草清单"] 
            }
          ];
          setCopyOptions(fallbackOptions);
          currentCopyText = copyText;
        }
      }
    } catch (e: any) {
      console.error("文案生成失败:", e);
      // 如果出错，显示错误信息
      if (e?.message) {
        alert(`文案生成失败: ${e.message}`);
      }
    } finally {
      setIsCopyLoading(false);
    }

    if (!currentCopyText) return; // 文案失败则不继续

    // 阶段二：逐张生成图片（先拿到6条提示词，再逐张出图）
    setIsImageLoading(true);
    try {
      // 固定用文案1（按你要求），仅标题+正文
      let copyForImages = currentCopyText;
      if (copyOptions && copyOptions[0]) {
        copyForImages = `${copyOptions[0].title}\n${copyOptions[0].body}`.trim();
      }

      const pRes = await fetch("/api/generate/image-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          copy: copyForImages,
          productName: currentProductName,
          description: currentDescription,
        }),
      });
      const pData = await pRes.json();
      const prompts: string[] = Array.isArray(pData.prompts) ? pData.prompts : [];
      if (prompts.length !== 6) throw new Error("提示词生成失败");

      setGeneratedImages([]);
      for (let i = 0; i < prompts.length; i++) {
        const one = prompts[i];
        let url: string | null = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const r = await fetch("/api/generate/image/one", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                productName: currentProductName,
                prompt: one,
                positivePrompt: currentPositivePrompt,
                negativePrompt: currentNegativePrompt,
                images: currentRefImages,
                primaryIndex: currentPrimaryIndex,
              }),
            });
            const d = await r.json();
            if (d.url) {
              url = d.url;
              break;
            } else {
              console.error("单张生图失败:", d.error || r.statusText);
            }
          } catch (err) {
            console.error("单张生图异常:", err);
          }
        }
        // 保证返回6个占位，失败则推空字符串
        setGeneratedImages((prev) => [...prev, url || ""]);
      }
      await deductQuota();
    } catch (e) {
      console.error(e);
    } finally {
      setIsImageLoading(false);
    }
  };

  const deductQuota = async () => {
    const res = await fetch("/api/user/deduct", { method: "POST" });
    const data = await res.json();
    if (data.success && userInfo) setUserInfo({ ...userInfo, freeUsage: data.remaining });
  };

  // 批量下载
  const handleBatchDownload = async () => {
    // 服务器打包 ZIP，一次性下载，避免浏览器“自动下载次数限制”
    try {
      const res = await fetch("/api/download/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: generatedImages, name: productName || "images" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "打包失败");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${productName || "images"}-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("批量下载失败，请稍后重试");
    }
  };

  const getSelectedCopyText = () => {
    if (copyOptions && copyOptions[selectedCopyIndex]) {
      const opt = copyOptions[selectedCopyIndex];
      const tagsLine = (opt.tags || []).map((t) => `#${t}`).join(" ");
      return `${opt.title}\n${opt.body}\n${tagsLine}`.trim();
    }
    return "";
  };

  const renderBody = (body?: string) => {
    const text = (body || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    if (!text) return null;

    const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
    return (
      <div className="space-y-3">
        {blocks.map((block, idx) => {
          const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
          const isList =
            lines.length >= 2 &&
            lines.every((l) => /^(?:-|•|\\*|\\d+[.)]|✔️|✅|✨)/u.test(l));

          if (isList) {
            const items = lines.map((l) => l.replace(/^(?:-|•|\\*|\\d+[.)]|✔️|✅|✨)\\s*/u, "").trim());
            return (
              <ul key={idx} className="list-disc pl-5 space-y-1 text-sm text-foreground/90 leading-relaxed">
                {items.map((it, j) => (
                  <li key={j}>{it}</li>
                ))}
              </ul>
            );
          }

          return (
            <p key={idx} className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {block}
            </p>
          );
        })}
      </div>
    );
  };

  // 加载中状态，避免 DOM 操作冲突
  if (isUserLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* 顶部导航 (保持不变) */}
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="container h-16 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-1 rounded font-bold text-xs">AI</div>
            <div className="font-bold text-lg">内容生产平台</div>
          </div>
          <div className="flex items-center gap-4">
            <Button size="sm" onClick={() => setShowRechargeDialog(true)} className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
              <Crown className="w-4 h-4 mr-1" /> 升级会员
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 w-9 rounded-full p-0">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {userInfo?.phone?.slice(-2) || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel>我的账户: {userInfo?.phone || "加载中..."}</DropdownMenuLabel>
                <DropdownMenuItem disabled>剩余额度: {userInfo?.freeUsage ?? 0}次</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowChangePasswordDialog(true)}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  修改密码
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container py-6 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-100px)]">
          {/* 左侧输入区 (保持不变，只是修改状态绑定) */}
          <div className="flex flex-col gap-6 overflow-y-auto pb-6">
            <Card>
              <CardHeader><CardTitle>上传参考图（可选，支持多图）</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <input type="file" multiple ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50">
                  <div className="text-center">
                    <ImagePlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <div className="text-sm text-muted-foreground">点击上传（可不传）</div>
                  </div>
                </div>

                {refImages.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">请选择主参考图，并可为每张图添加备注（如：包装/拆封/细节）</div>
                    <div className="grid grid-cols-2 gap-3">
                      {refImages.map((img, idx) => (
                        <div key={idx} className={`border rounded-lg p-2 space-y-2 ${primaryIndex === idx ? "ring-2 ring-primary" : ""}`}>
                          <button
                            type="button"
                            className="w-full"
                            onClick={() => {
                              setPrimaryIndex(idx);
                              setSelectedImage(img.dataUrl);
                            }}
                          >
                            <img src={img.dataUrl} className="w-full aspect-square object-cover rounded-md" />
                          </button>
                          <div className="flex items-center justify-between gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={primaryIndex === idx ? "default" : "outline"}
                              onClick={() => setPrimaryIndex(idx)}
                            >
                              {primaryIndex === idx ? "主图" : "设为主图"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setRefImages((prev) => prev.filter((_, i) => i !== idx));
                                setPrimaryIndex((p) => (p === idx ? 0 : p > idx ? p - 1 : p));
                              }}
                            >
                              移除
                            </Button>
                          </div>
                          <Input
                            placeholder="备注（可选）"
                            value={img.note}
                            onChange={(e) => {
                              const v = e.target.value;
                              setRefImages((prev) => prev.map((x, i) => (i === idx ? { ...x, note: v } : x)));
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardHeader><CardTitle>产品信息</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Input placeholder="产品名称" value={productName} onChange={e => setProductName(e.target.value)} />
                <Textarea placeholder="卖点描述" value={description} onChange={e => setDescription(e.target.value)} className="min-h-[100px]" />
                <Card className="border-dashed">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">生图可选控制（正向/反向提示词）</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      placeholder="正向提示词（可选）：例如 真实自然光、手持实拍、日系胶片、低饱和"
                      value={positivePrompt}
                      onChange={(e) => setPositivePrompt(e.target.value)}
                      className="min-h-[70px]"
                    />
                    <Textarea
                      placeholder="反向提示词（可选）：例如 不要水印、不要二维码、不要乱码文字、不要多余商品"
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      className="min-h-[70px]"
                    />
                  </CardContent>
                </Card>
                <Button className="w-full" size="lg" onClick={handleGenerate} disabled={isCopyLoading || isImageLoading}>
                  {isCopyLoading ? "正在写文案..." : isImageLoading ? "正在绘图..." : "立即生成 (分步)"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* 右侧预览区 (重构：文案在上，图片在下) */}
          <div className="bg-background border rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* 1. 文案区域 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> 种草文案
                    {isCopyLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(getSelectedCopyText())}
                    disabled={!copyOptions || !copyOptions[selectedCopyIndex]}
                  >
                    <Copy className="w-3 h-3 mr-1" /> 复制
                  </Button>
                </div>
                <div className={`bg-muted/30 p-4 rounded-lg border min-h-[150px] ${isCopyLoading ? "opacity-50" : ""}`}>
                  {copyOptions ? (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Button
                          variant={selectedCopyIndex === 0 ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedCopyIndex(0)}
                        >
                          文案 1
                        </Button>
                        <Button
                          variant={selectedCopyIndex === 1 ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedCopyIndex(1)}
                        >
                          文案 2
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div className="text-base font-semibold whitespace-pre-wrap">{copyOptions[selectedCopyIndex]?.title}</div>
                        {renderBody(copyOptions[selectedCopyIndex]?.body)}
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {(copyOptions[selectedCopyIndex]?.tags || []).map((t) => `#${t}`).join(" ")}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm whitespace-pre-wrap">
                      {isCopyLoading ? "AI 正在构思文案..." : "等待生成..."}
                    </div>
                  )}
                </div>
              </div>

              {/* 2. 图片区域 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <ImagePlus className="w-4 h-4" /> 配图预览
                    {isImageLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                  </Label>
                  {generatedImages.length > 0 && (
                    <Button variant="outline" size="sm" onClick={handleBatchDownload}>
                      <FolderDown className="w-3 h-3 mr-1" /> 批量下载
                    </Button>
                  )}
                </div>
                
                {generatedImages.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {generatedImages.map((url, index) => (
                      <div
                        key={index}
                        className="aspect-square bg-muted rounded-lg relative group overflow-hidden border cursor-pointer"
                        onClick={() => setPreviewImage(url)}
                      >
                        <img src={url} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Eye className="w-6 h-6 text-white drop-shadow-md" />
                        </div>
                        {/* 单张下载按钮（不影响点击预览） */}
                        <button
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/55 hover:bg-black/70 text-white rounded-md p-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            const link = document.createElement("a");
                            link.href = url;
                            link.download = `image-${index + 1}.png`;
                            document.body.appendChild(link);
                            link.click();
                            link.remove();
                          }}
                          aria-label="下载该图片"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="aspect-video bg-muted rounded-lg flex flex-col items-center justify-center text-muted-foreground gap-2">
                    {isImageLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : <ImagePlus className="w-8 h-8 opacity-20" />}
                    <p className="text-sm">{isImageLoading ? "正在绘制场景图..." : "暂无图片"}</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </main>

      {/* 图片放大预览弹窗 */}
      <Dialog open={!!previewImage} onOpenChange={(open) => {
        if (!open) {
          setPreviewImage(null);
        }
      }}>
        {/* 强制全屏居中，避免在某些布局/缩放下偏到右侧 */}
        <DialogContent className="left-0 top-0 translate-x-0 translate-y-0 inset-0 max-w-none w-screen h-screen p-6 bg-black/70 border-0 shadow-none flex items-center justify-center">
          {previewImage && (
            <div className="relative max-w-5xl w-full">
              <img src={previewImage} className="w-full max-h-[80vh] object-contain rounded-lg shadow-2xl bg-black" alt="Preview" />
              <Button 
                className="absolute bottom-4 right-4" 
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = previewImage;
                  link.download = 'download.png';
                  link.click();
                }}
              >
                <Download className="mr-2 w-4 h-4" /> 下载原图
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* 充值弹窗 (简化版) */}
      <Dialog open={showRechargeDialog} onOpenChange={setShowRechargeDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>升级专业版</DialogTitle></DialogHeader>
          <div className="py-8 text-center"><p>请联系管理员充值 (模拟)</p></div>
        </DialogContent>
      </Dialog>

      {/* 修改密码弹窗 */}
      <Dialog open={showChangePasswordDialog} onOpenChange={setShowChangePasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="oldPassword">原密码</Label>
              <Input
                id="oldPassword"
                type="password"
                placeholder="请输入原密码"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">新密码</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="请输入新密码（至少6位）"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="请再次输入新密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={async () => {
                if (!oldPassword || !newPassword || !confirmPassword) {
                  alert("请填写完整信息");
                  return;
                }
                if (newPassword.length < 6) {
                  alert("新密码至少需要6位");
                  return;
                }
                if (newPassword !== confirmPassword) {
                  alert("两次输入的新密码不一致");
                  return;
                }
                setIsChangingPassword(true);
                try {
                  const res = await fetch("/api/user/change-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ oldPassword, newPassword }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    alert("密码修改成功");
                    setShowChangePasswordDialog(false);
                    setOldPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  } else {
                    alert(data.error || "密码修改失败");
                  }
                } catch (err) {
                  console.error(err);
                  alert("网络错误");
                } finally {
                  setIsChangingPassword(false);
                }
              }}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  修改中...
                </>
              ) : (
                "确认修改"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
