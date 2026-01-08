"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Settings, Save, RefreshCw } from "lucide-react";

interface ConfigItem {
  key: string;
  value: string;
  description: string;
}

export default function ConfigPage() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState<ConfigItem>({
    key: "",
    value: "",
    description: ""
  });

  const loadConfigs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/config");
      const data = await res.json();
      const list = Object.entries(data).map(([k, v]) => ({
        key: k,
        value: v as string,
        description: "" 
      }));
      setConfigs(list);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const handleSave = async () => {
    if (!formData.key) return alert("Key 不能为空");
    
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      
      if (res.ok) {
        alert("保存成功！");
        setFormData({ key: "", value: "", description: "" }); 
        loadConfigs(); 
      } else {
        alert("保存失败");
      }
    } catch (err) {
      console.error(err);
      alert("网络错误");
    }
  };

  const handleEdit = (item: ConfigItem) => {
    setFormData({ ...item });
  };

  const presets: Array<ConfigItem> = [
    {
      key: "XHS_IMAGE_PROMPT_TEMPLATE",
      value: `# 角色

你是小红书爆款配图生成助手，专注于根据用户提供的小红书标题和正文内容，精准提取核心信息并生成6个风格各异、适配小红书平台审美的高质量图片提示词，帮助用户打造吸睛、易传播的图文内容。

## 任务
请基于输入（标题+正文）生成 6 个图片提示词，风格各异但与正文强相关。只输出 JSON 数组字符串（长度=6），不要输出其他文字。

## 约束
- 每条提示词建议包含：主体+场景+光线+风格+核心元素（但不要为了格式牺牲自然度）
- 严格基于正文内容，不要编造无关元素
- 适配小红书审美：真实生活感/低饱和/轻量构图/高清细节/真实光影

输入（标题+正文）：
{{copy}}
`,
      description: "从文案(标题+正文)生成6条配图提示词的模板（可自由修改）。支持 {{copy}} 占位符。",
    },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">配置中心</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>系统参数配置</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-3 font-medium">配置 Key</th>
                    <th className="p-3 font-medium">当前值</th>
                    <th className="p-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-muted-foreground">
                        暂无配置
                      </td>
                    </tr>
                  ) : (
                    configs.map((item) => (
                      <tr key={item.key} className="border-t hover:bg-muted/30">
                        <td className="p-3 font-mono font-medium">{item.key}</td>
                        <td className="p-3 text-muted-foreground truncate max-w-[200px]">
                          {item.value}
                        </td>
                        <td className="p-3 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleEdit(item)}
                          >
                            编辑
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>添加/编辑</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-muted/20 p-3">
              <div className="text-sm font-medium mb-2">快捷模板</div>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                  <Button
                    key={p.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData(p)}
                  >
                    一键填充：{p.key}
                  </Button>
                ))}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                建议先用“快捷模板”填充，再按你的业务微调。
              </div>
            </div>
            <div className="space-y-2">
              <Label>Key</Label>
              <Input 
                value={formData.key}
                onChange={(e) => setFormData({...formData, key: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Value</Label>
              <Textarea
                value={formData.value}
                onChange={(e) => setFormData({...formData, value: e.target.value})}
                className="min-h-[220px] font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label>Description（可选）</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="这条配置是做什么的（方便后续维护）"
              />
            </div>

            <Button className="w-full mt-4" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              保存配置
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

