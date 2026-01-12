"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImagePlus, Sparkles, Loader2, CheckCircle2, XCircle } from "lucide-react";

interface TestResult {
  success: boolean;
  url?: string;
  error?: string;
  time: number;
}

export default function TestPage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [isTesting, setIsTesting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleTest = async () => {
    if (!selectedImage || !productName) {
      alert("请上传图片并填写产品名称");
      return;
    }

    setIsTesting(true);
    setResults({});

    try {
      const res = await fetch("/api/test/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: selectedImage,
          productName,
          description,
          models: ["aliyun", "volc"] // 测试所有模型
        }),
      });

      const data = await res.json();
      if (data.results) {
        setResults(data.results);
      } else {
        alert(data.error || "测试失败");
      }
    } catch (e) {
      console.error(e);
      alert("网络错误");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">模型测试工具</h1>
          <p className="text-muted-foreground">快速对比不同生图模型的效果</p>
        </div>

        {/* 输入区 */}
        <Card>
          <CardHeader>
            <CardTitle>测试参数</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>上传图片</Label>
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept="image/*"
                onChange={handleImageUpload}
              />
              <div 
                onClick={() => fileInputRef.current?.click()} 
                className="mt-2 border-2 border-dashed rounded-lg p-8 flex items-center justify-center cursor-pointer hover:bg-muted/50"
              >
                {selectedImage ? (
                  <img src={selectedImage} className="max-h-48 object-contain" alt="Preview" />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <ImagePlus className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>点击上传图片</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>产品名称</Label>
                <Input 
                  placeholder="例如：手机壳"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </div>
              <div>
                <Label>产品描述</Label>
                <Input 
                  placeholder="例如：透明保护壳"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <Button 
              className="w-full" 
              size="lg" 
              onClick={handleTest}
              disabled={isTesting}
            >
              {isTesting ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  正在测试所有模型...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 w-4 h-4" />
                  开始测试所有模型
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 结果展示区 */}
        {Object.keys(results).length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">测试结果对比</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(results).map(([modelName, result]) => (
                <Card key={modelName}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{modelName}</CardTitle>
                      {result.success ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      耗时: {(result.time / 1000).toFixed(1)}s
                    </div>
                  </CardHeader>
                  <CardContent>
                    {result.success && result.url ? (
                      <div className="space-y-2">
                        <img 
                          src={result.url} 
                          alt={`${modelName} 生成结果`}
                          className="w-full rounded-lg border"
                        />
                        <a 
                          href={result.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline block text-center"
                        >
                          查看原图
                        </a>
                      </div>
                    ) : (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800 font-medium">生成失败</p>
                        <p className="text-xs text-red-600 mt-1 break-all">
                          {result.error || "未知错误"}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* 原始图片对比 */}
        {selectedImage && (
          <Card>
            <CardHeader>
              <CardTitle>原始图片</CardTitle>
            </CardHeader>
            <CardContent>
              <img 
                src={selectedImage} 
                alt="原始图片"
                className="max-w-md mx-auto rounded-lg border"
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

