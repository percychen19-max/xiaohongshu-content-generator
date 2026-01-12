"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, RefreshCw, Trash2, Wand2 } from "lucide-react";

type CredType = "text" | "image" | "imageseg";

type CredRow = {
  id: string;
  type: CredType;
  vendor: string;
  profile: string;
  baseURL: string;
  secretPreview: string;
  updatedAt: string;
};

export default function CredentialsPage() {
  const [items, setItems] = useState<CredRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CredType>("text");
  const [vendor, setVendor] = useState("volc");
  const [profile, setProfile] = useState("default");
  const [baseURL, setBaseURL] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [accessKeySecret, setAccessKeySecret] = useState("");

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/credential-store");
      const data = await res.json();
      setItems(Array.isArray(data?.credentials) ? data.credentials : []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const groupedByVendor = useMemo(() => {
    const g: Record<string, CredRow[]> = {};
    items.forEach((x) => {
      g[x.vendor] = g[x.vendor] || [];
      g[x.vendor].push(x);
    });
    Object.values(g).forEach((list) => list.sort((a, b) => (a.profile || "").localeCompare(b.profile || "")));
    return g;
  }, [items]);

  const reset = () => {
    setType("text");
    setVendor("volc");
    setProfile("default");
    setBaseURL("");
    setApiKey("");
    setAccessKeyId("");
    setAccessKeySecret("");
  };

  const vendorPresets: Array<{
    label: string;
    vendor: string;
    type: CredType;
    baseURL?: string;
    profile?: string;
  }> = [
    { label: "GPT / OpenAI（文案）", vendor: "openai", type: "text", baseURL: "https://api.openai.com/v1", profile: "default" },
    { label: "火山方舟（文案/提示词）", vendor: "volc", type: "text", baseURL: "https://ark.cn-beijing.volces.com/api/v3", profile: "default" },
    { label: "百炼 DashScope（配图）", vendor: "dashscope", type: "image", baseURL: "https://dashscope.aliyuncs.com/api/v1", profile: "default" },
    { label: "Google Gemini（配图）", vendor: "google", type: "image", baseURL: "", profile: "default" },
    { label: "阿里云 ImageSeg（抠图）", vendor: "aliyun-imageseg", type: "imageseg", baseURL: "", profile: "default" },
  ];

  const applyVendorPreset = (v: string) => {
    const p = vendorPresets.find((x) => x.vendor === v);
    if (!p) return;
    setVendor(p.vendor);
    setType(p.type);
    setBaseURL(p.baseURL || "");
    setProfile(p.profile || "default");
  };

  const save = async () => {
    try {
      const payload: any = { type, vendor, profile, baseURL };
      if (type === "imageseg") {
        payload.accessKeyId = accessKeyId;
        payload.accessKeySecret = accessKeySecret;
      } else {
        payload.apiKey = apiKey;
      }
      const res = await fetch("/api/admin/credential-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data?.error || "保存失败");
      setOpen(false);
      reset();
      await load();
      alert("已保存（密钥已加密存储）");
    } catch (e) {
      console.error(e);
      alert("网络错误");
    }
  };

  const del = async (id: string) => {
    if (!confirm("确认删除该凭证？")) return;
    const res = await fetch(`/api/admin/credential-store?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) alert("删除失败");
    await load();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API 管理中心</h1>
          <p className="text-muted-foreground">
            在这里按“厂商”配置 API Key / AKSK（例如 GPT/OpenAI、火山、百炼）。系统会<strong>加密存储</strong>，供供应商/引擎选择调用。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            新增凭证
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(true);
              applyVendorPreset("volc");
            }}
          >
            <Wand2 className="w-4 h-4 mr-1" />
            快速：火山
          </Button>
          <Button onClick={load} disabled={isLoading}>
            <RefreshCw className="w-4 h-4 mr-1" />
            {isLoading ? "刷新中..." : "刷新"}
          </Button>
        </div>
      </div>

      {Object.keys(groupedByVendor).length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">暂无配置，点击右上角“新增凭证”开始。</CardContent>
        </Card>
      ) : (
        Object.entries(groupedByVendor).map(([v, list]) => (
          <Card key={v}>
            <CardHeader>
              <CardTitle>厂商：{v}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="p-3 font-medium">类型</th>
                      <th className="p-3 font-medium">profile</th>
                      <th className="p-3 font-medium">baseURL</th>
                      <th className="p-3 font-medium">密钥预览</th>
                      <th className="p-3 font-medium text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((x) => (
                      <tr key={x.id} className="border-t hover:bg-muted/30">
                        <td className="p-3 font-mono text-xs">{x.type}</td>
                        <td className="p-3 font-mono text-xs">{x.profile}</td>
                        <td className="p-3 font-mono text-xs truncate max-w-[420px]">{x.baseURL || "-"}</td>
                        <td className="p-3 font-mono text-xs">{x.secretPreview}</td>
                        <td className="p-3 text-right">
                          <Button variant="outline" size="sm" className="text-red-600" onClick={() => del(x.id)}>
                            <Trash2 className="w-3 h-3 mr-1" />
                            删除
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增凭证（加密存储）</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>厂商（推荐选预设）</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={vendor}
                onChange={(e) => applyVendorPreset(e.target.value)}
              >
                {vendorPresets.map((p) => (
                  <option key={p.vendor} value={p.vendor}>
                    {p.label}
                  </option>
                ))}
                <option value="custom">其他（自定义）</option>
              </select>
              <p className="text-xs text-muted-foreground">选厂商后会自动设置“类型/默认 baseURL”。</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>vendor（可改）</Label>
                <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>profile</Label>
                <Input value={profile} onChange={(e) => setProfile(e.target.value)} placeholder="default / primary / backup" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>类型（自动，可改）</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={type}
                  onChange={(e) => setType(e.target.value as CredType)}
                >
                  <option value="text">text（文案/提示词）</option>
                  <option value="image">image（配图）</option>
                  <option value="imageseg">imageseg（抠图）</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>baseURL（可选）</Label>
                <Input value={baseURL} onChange={(e) => setBaseURL(e.target.value)} placeholder="不填则走供应商配置/默认值" />
              </div>
            </div>

            {type === "imageseg" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>AccessKeyId</Label>
                  <Input value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>AccessKeySecret</Label>
                  <Input value={accessKeySecret} onChange={(e) => setAccessKeySecret(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="例如 sk-xxx（OpenAI/百炼）或火山的 key" />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={save}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


