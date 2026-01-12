"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Wand2 } from "lucide-react";

type ProviderType = "text" | "image" | "imageseg";

type ApiProvider = {
  id: string;
  type: ProviderType;
  name: string;
  vendor: string;
  baseURL: string;
  defaultModel?: string;
  credProfile: string;
  createdAt: string;
  updatedAt: string;
};

const TYPE_LABEL: Record<ProviderType, string> = {
  text: "文案/提示词（Text）",
  image: "配图（Image）",
  imageseg: "抠图（ImageSeg）",
};

export default function ProvidersPage() {
  const [providers, setProviders] = useState<ApiProvider[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ApiProvider | null>(null);
  const [form, setForm] = useState<Partial<ApiProvider>>({
    type: "text",
    name: "",
    vendor: "",
    baseURL: "",
    defaultModel: "",
    credProfile: "default",
  });

  const resetForm = () =>
    setForm({
      type: "text",
      name: "",
      vendor: "",
      baseURL: "",
      defaultModel: "",
      credProfile: "default",
    });

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/providers");
      const data = await res.json();
      setProviders(Array.isArray(data?.providers) ? data.providers : []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const g: Record<ProviderType, ApiProvider[]> = { text: [], image: [], imageseg: [] };
    providers.forEach((p) => g[p.type]?.push(p));
    return g;
  }, [providers]);

  const openCreate = (type: ProviderType) => {
    setEditing(null);
    resetForm();
    setForm((p) => ({ ...p, type }));
    setIsDialogOpen(true);
  };

  const openEdit = (p: ApiProvider) => {
    setEditing(p);
    setForm({ ...p });
    setIsDialogOpen(true);
  };

  const save = async () => {
    try {
      const res = await fetch("/api/admin/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) return alert(data?.error || "保存失败");
      setIsDialogOpen(false);
      setEditing(null);
      resetForm();
      await load();
      alert("已保存");
    } catch (e) {
      console.error(e);
      alert("网络错误");
    }
  };

  const del = async (id: string) => {
    if (!confirm("确认删除该供应商？")) return;
    try {
      const res = await fetch(`/api/admin/providers?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data?.error || "删除失败");
      await load();
    } catch (e) {
      console.error(e);
      alert("网络错误");
    }
  };

  const quickSeed = async () => {
    // 一键填充常用厂商（不含密钥，只填 baseURL / 默认模型 / profile 名）
    const presets: Array<Partial<ApiProvider>> = [
      {
        type: "text",
        name: "火山方舟（OpenAI兼容）",
        vendor: "volc",
        baseURL: "https://ark.cn-beijing.volces.com/api/v3",
        defaultModel: "doubao-seed-1-6-lite-251015",
        credProfile: "default",
      },
      {
        type: "image",
        name: "阿里百炼 DashScope（qwen-image-edit-plus）",
        vendor: "dashscope",
        baseURL: "https://dashscope.aliyuncs.com/api/v1",
        defaultModel: "qwen-image-edit-plus",
        credProfile: "default",
      },
      {
        type: "image",
        name: "Google Gemini 2.5 Flash Image（Nano Banana）",
        vendor: "google",
        baseURL: "", // Google GenAI SDK 会自动处理，通常不需要 baseURL
        defaultModel: "gemini-2.5-flash-image",
        credProfile: "default",
      },
      {
        type: "imageseg",
        name: "阿里云抠图 ImageSeg",
        vendor: "aliyun-imageseg",
        baseURL: "imageseg.cn-shanghai.aliyuncs.com",
        defaultModel: "SegmentCommodity",
        credProfile: "default",
      },
    ];

    for (const p of presets) {
      await fetch("/api/admin/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
    }
    await load();
    alert("已填充常用厂商");
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">供应商管理</h1>
          <p className="text-muted-foreground">
            这里管理“厂商 API”。不存密钥，只存 baseURL / 默认模型 / 使用哪个凭证 profile。引擎配置可直接选择切换。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={quickSeed}>
            <Wand2 className="w-4 h-4 mr-1" />
            一键填充常用厂商
          </Button>
          <Button onClick={load} disabled={isLoading}>
            {isLoading ? "刷新中..." : "刷新"}
          </Button>
        </div>
      </div>

      {(["text", "image", "imageseg"] as ProviderType[]).map((t) => (
        <Card key={t}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{TYPE_LABEL[t]}</CardTitle>
            <Button variant="outline" size="sm" onClick={() => openCreate(t)}>
              <Plus className="w-4 h-4 mr-1" />
              新增
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-3 font-medium">名称</th>
                    <th className="p-3 font-medium">厂商</th>
                    <th className="p-3 font-medium">baseURL</th>
                    <th className="p-3 font-medium">默认模型</th>
                    <th className="p-3 font-medium">profile</th>
                    <th className="p-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[t].length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground">
                        暂无配置
                      </td>
                    </tr>
                  ) : (
                    grouped[t].map((p) => (
                      <tr key={p.id} className="border-t hover:bg-muted/30">
                        <td className="p-3 font-medium">{p.name}</td>
                        <td className="p-3 font-mono text-xs">{p.vendor}</td>
                        <td className="p-3 font-mono text-xs truncate max-w-[380px]">{p.baseURL}</td>
                        <td className="p-3 font-mono text-xs">{p.defaultModel || "-"}</td>
                        <td className="p-3 font-mono text-xs">{p.credProfile || "default"}</td>
                        <td className="p-3 text-right">
                          <div className="inline-flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                              <Pencil className="w-3 h-3 mr-1" />
                              编辑
                            </Button>
                            <Button variant="outline" size="sm" className="text-red-600" onClick={() => del(p.id)}>
                              <Trash2 className="w-3 h-3 mr-1" />
                              删除
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditing(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "编辑供应商" : "新增供应商"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>类型</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={(form.type as ProviderType) || "text"}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as ProviderType }))}
              >
                <option value="text">文案/提示词（Text）</option>
                <option value="image">配图（Image）</option>
                <option value="imageseg">抠图（ImageSeg）</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>名称</Label>
              <Input value={form.name || ""} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>厂商标识（vendor）</Label>
                <Input value={form.vendor || ""} onChange={(e) => setForm((p) => ({ ...p, vendor: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>凭证 profile</Label>
                <Input
                  value={form.credProfile || "default"}
                  onChange={(e) => setForm((p) => ({ ...p, credProfile: e.target.value }))}
                  placeholder="default / primary / backup"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>baseURL</Label>
              <Input value={form.baseURL || ""} onChange={(e) => setForm((p) => ({ ...p, baseURL: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>默认模型（可选）</Label>
              <Input
                value={form.defaultModel || ""}
                onChange={(e) => setForm((p) => ({ ...p, defaultModel: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                setEditing(null);
                resetForm();
              }}
            >
              取消
            </Button>
            <Button onClick={save}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


