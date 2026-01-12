"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type EngineConfig = {
  // 通用
  enabled: boolean;
  vendor: string;
  modelId: string;
  baseURL?: string;
  // 文案
  systemPrompt?: string;
  temperature?: string;
  maxTokens?: string;
  // 配图
  imagePromptTemplate?: string;
  imageNegativePrompt?: string;
  imagePromptExtend?: boolean;
};

type ProviderType = "text" | "image" | "imageseg";
type ApiProvider = {
  id: string;
  type: ProviderType;
  name: string;
  vendor: string;
  baseURL: string;
  defaultModel?: string;
  credProfile: string;
};

const KEYS = {
  // copy engine
  COPY_ENABLED: "COPY_ENGINE_ENABLED",
  COPY_VENDOR: "COPY_ENGINE_VENDOR",
  COPY_MODEL: "COPY_ENGINE_MODEL_ID",
  COPY_BASE_URL: "COPY_ENGINE_BASE_URL",
  COPY_CRED_PROFILE: "COPY_ENGINE_CRED_PROFILE",
  COPY_SYSTEM: "COPY_ENGINE_SYSTEM_PROMPT",
  COPY_TEMP: "COPY_ENGINE_TEMPERATURE",
  COPY_MAX: "COPY_ENGINE_MAX_TOKENS",
  // image engine
  IMAGE_ENABLED: "IMAGE_ENGINE_ENABLED",
  IMAGE_VENDOR: "IMAGE_ENGINE_VENDOR",
  IMAGE_MODEL: "IMAGE_ENGINE_MODEL_ID",
  IMAGE_BASE_URL: "IMAGE_ENGINE_BASE_URL",
  IMAGE_CRED_PROFILE: "IMAGE_ENGINE_CRED_PROFILE",
  IMAGE_TEMPLATE: "XHS_IMAGE_PROMPT_TEMPLATE",
  IMAGE_NEG: "IMAGE_ENGINE_NEGATIVE_PROMPT",
  IMAGE_EXTEND: "IMAGE_ENGINE_PROMPT_EXTEND",
  IMAGESEG_CRED_PROFILE: "IMAGESEG_CRED_PROFILE",
} as const;

function toBool(v: any, fallback = false) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1" || v === "yes";
  return fallback;
}

export default function EnginesPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCopyPromptEditor, setShowCopyPromptEditor] = useState(false);
  const [showImageTemplateEditor, setShowImageTemplateEditor] = useState(false);

  // 一键测试
  const [testCopy, setTestCopy] = useState(
    "标题：\n正文：\n标签："
  );
  const [testPrompts, setTestPrompts] = useState<string[] | null>(null);
  const [isTestingPrompts, setIsTestingPrompts] = useState(false);

  const [testProductName, setTestProductName] = useState("测试产品");
  const [testImagePrompt, setTestImagePrompt] = useState("");
  const [testImageDataUrl, setTestImageDataUrl] = useState<string | null>(null);
  const [isTestingImage, setIsTestingImage] = useState(false);
  const [testImageResultUrl, setTestImageResultUrl] = useState<string | null>(null);

  // 方案2：后台只选择“用哪套凭证 profile”，真正密钥仍然在服务器环境变量
  const [copyCredProfile, setCopyCredProfile] = useState("default");
  const [imageCredProfile, setImageCredProfile] = useState("default");
  const [imageSegCredProfile, setImageSegCredProfile] = useState("default");
  const [availableProfiles, setAvailableProfiles] = useState<{
    volc: string[];
    dashscope: string[];
    imageseg: string[];
  }>({ volc: ["default"], dashscope: ["default"], imageseg: ["default"] });

  // 供应商库：在这里新增厂商，然后引擎配置里直接选择切换
  const [providers, setProviders] = useState<ApiProvider[]>([]);
  const [selectedTextProviderId, setSelectedTextProviderId] = useState<string>("");
  const [selectedImageProviderId, setSelectedImageProviderId] = useState<string>("");
  const [selectedImageSegProviderId, setSelectedImageSegProviderId] = useState<string>("");

  const [copy, setCopy] = useState<EngineConfig>({
    enabled: true,
    vendor: "volc",
    modelId: "doubao-seed-1-6-lite-251015",
    baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    systemPrompt:
      "你是小红书爆款文案专家。输出两篇可选文案，每篇包含标题/正文/标签，口语化、分段清晰。",
    temperature: "0.7",
    maxTokens: "2048",
  });

  const [image, setImage] = useState<EngineConfig>({
    enabled: true,
    vendor: "aliyun",
    modelId: "qwen-image-edit-plus",
    baseURL: "https://dashscope.aliyuncs.com/api/v1",
    imagePromptTemplate:
      "# 角色\n\n你是小红书爆款配图生成助手...\n\n输入（标题+正文）：\n{{copy}}\n",
    imageNegativePrompt:
      "低质量, 低分辨率, 模糊, 强烈AI感, 产品主体变形, 产品外观改变, 多余商品, 多余配件, 水印, 二维码",
    imagePromptExtend: false,
  });

  // 小白友好：用“风格预设”一键填充（你也可以继续手动改下面的提示词）
  const copyPresets = useMemo(
    () => [
      {
        id: "seed",
        name: "默认（爆款种草）",
        system:
          "你是小红书爆款文案专家。请输出严格 JSON（不要 Markdown、不要多余文字）。生成 2 篇可选文案，每篇必须包含：title（标题，带2-4个Emoji）、body（正文，分段口语化，可含数字卖点）、tags（数组，5-10个话题标签，不带#）。返回格式：{\"options\":[{\"title\":\"...\",\"body\":\"...\",\"tags\":[\"...\"]},{\"title\":\"...\",\"body\":\"...\",\"tags\":[\"...\"]}]}\n\n写作要求：\n- 标题短促有钩子\n- 正文先痛点后方案再卖点\n- 标签贴近小红书热词/场景\n",
      },
      {
        id: "review",
        name: "偏测评（更理性）",
        system:
          "你是小红书测评博主。请输出严格 JSON，生成 2 篇可选文案（title/body/tags）。\n\n风格：\n- 更理性、少夸张\n- 用对比/数据点/使用场景\n- 强调优缺点与适合人群\n",
      },
      {
        id: "promo",
        name: "偏带货（强转化）",
        system:
          "你是小红书带货文案高手。请输出严格 JSON，生成 2 篇可选文案（title/body/tags）。\n\n风格：\n- 强利益点、强行动号召\n- 结构清晰：利益点→适合谁→如何用→行动\n- 避免过度广告腔\n",
      },
    ],
    []
  );

  const imageTemplatePresets = useMemo(
    () => [
      {
        id: "xhs6",
        name: "默认：小红书 6 图（真实拍摄）",
        template:
          `# 角色\n\n你是小红书爆款配图生成助手，专注于根据用户提供的小红书标题和正文内容，精准提取核心信息并生成6个风格各异、适配小红书平台审美的高质量图片提示词。\n\n## 输出要求\n- 只输出 JSON 数组字符串（长度=6），不要输出其它内容。\n- 每条提示词尽量包含：主体/场景/光线/风格/核心元素（但不要为了格式牺牲自然度）。\n- 内容必须严格基于标题正文，不得编造无关元素。\n\n输入（标题+正文）：\n{{copy}}\n`,
      },
      {
        id: "commerce",
        name: "偏电商展示（更干净）",
        template:
          `你是电商产品配图提示词生成助手。基于输入（标题+正文）生成6条图片提示词。只输出 JSON 数组（长度=6）。\n\n偏好：\n- 真实拍摄质感\n- 场景更干净、背景更可控\n- 适当加入道具但不抢主体\n\n输入：\n{{copy}}\n`,
      },
    ],
    []
  );

  const [copyPresetId, setCopyPresetId] = useState(copyPresets[0]?.id || "seed");
  const [imagePresetId, setImagePresetId] = useState(imageTemplatePresets[0]?.id || "xhs6");

  const applyCopyPreset = (id: string) => {
    setCopyPresetId(id);
    const preset = copyPresets.find((p) => p.id === id);
    if (!preset) return;
    setCopy((prev) => ({ ...prev, systemPrompt: preset.system }));
  };

  const applyImagePreset = (id: string) => {
    setImagePresetId(id);
    const preset = imageTemplatePresets.find((p) => p.id === id);
    if (!preset) return;
    setImage((prev) => ({ ...prev, imagePromptTemplate: preset.template }));
  };

  const load = async () => {
    setIsLoading(true);
    try {
      // 读取可用 profile 列表（仅名称，不含密钥）
      fetch("/api/admin/credentials")
        .then((r) => r.json())
        .then((d) => {
          if (d?.profiles) setAvailableProfiles(d.profiles);
        })
        .catch(() => {});

      // 读取供应商库
      fetch("/api/admin/providers")
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d?.providers)) setProviders(d.providers);
        })
        .catch(() => {});

      const res = await fetch("/api/admin/config");
      const data = await res.json();

      setCopy((prev) => ({
        ...prev,
        enabled: toBool(data[KEYS.COPY_ENABLED], true),
        vendor: data[KEYS.COPY_VENDOR] || prev.vendor,
        modelId: data[KEYS.COPY_MODEL] || prev.modelId,
        baseURL: data[KEYS.COPY_BASE_URL] || prev.baseURL,
        systemPrompt: data[KEYS.COPY_SYSTEM] || prev.systemPrompt,
        temperature: data[KEYS.COPY_TEMP] || prev.temperature,
        maxTokens: data[KEYS.COPY_MAX] || prev.maxTokens,
      }));

      setImage((prev) => ({
        ...prev,
        enabled: toBool(data[KEYS.IMAGE_ENABLED], true),
        vendor: data[KEYS.IMAGE_VENDOR] || prev.vendor,
        modelId: data[KEYS.IMAGE_MODEL] || prev.modelId,
        baseURL: data[KEYS.IMAGE_BASE_URL] || prev.baseURL,
        imagePromptTemplate: data[KEYS.IMAGE_TEMPLATE] || prev.imagePromptTemplate,
        imageNegativePrompt: data[KEYS.IMAGE_NEG] || prev.imageNegativePrompt,
        imagePromptExtend: toBool(data[KEYS.IMAGE_EXTEND], prev.imagePromptExtend),
      }));

      setCopyCredProfile(String(data[KEYS.COPY_CRED_PROFILE] || "default"));
      setImageCredProfile(String(data[KEYS.IMAGE_CRED_PROFILE] || "default"));
      setImageSegCredProfile(String(data[KEYS.IMAGESEG_CRED_PROFILE] || "default"));

      // 尝试根据当前 baseURL/profile 反推选中的 provider（如果匹配）
      const currentTextUrl = String(data[KEYS.COPY_BASE_URL] || "");
      const currentTextProfile = String(data[KEYS.COPY_CRED_PROFILE] || "default");
      const currentImageUrl = String(data[KEYS.IMAGE_BASE_URL] || "");
      const currentImageProfile = String(data[KEYS.IMAGE_CRED_PROFILE] || "default");
      const currentSegProfile = String(data[KEYS.IMAGESEG_CRED_PROFILE] || "default");

      const matchText = providers.find((p) => p.type === "text" && p.baseURL === currentTextUrl && p.credProfile === currentTextProfile);
      if (matchText) setSelectedTextProviderId(matchText.id);
      const matchImg = providers.find((p) => p.type === "image" && p.baseURL === currentImageUrl && p.credProfile === currentImageProfile);
      if (matchImg) setSelectedImageProviderId(matchImg.id);
      const matchSeg = providers.find((p) => p.type === "imageseg" && p.credProfile === currentSegProfile);
      if (matchSeg) setSelectedImageSegProviderId(matchSeg.id);

      // UI：如果当前值与某个预设完全一致，则自动选中对应预设
      const matchedCopy = copyPresets.find((p) => p.system.trim() === String(data[KEYS.COPY_SYSTEM] || "").trim());
      if (matchedCopy) setCopyPresetId(matchedCopy.id);
      const matchedImg = imageTemplatePresets.find(
        (p) => p.template.trim() === String(data[KEYS.IMAGE_TEMPLATE] || "").trim()
      );
      if (matchedImg) setImagePresetId(matchedImg.id);
    } finally {
      setIsLoading(false);
    }
  };

  const providersByType = useMemo(() => {
    const g: Record<ProviderType, ApiProvider[]> = { text: [], image: [], imageseg: [] };
    providers.forEach((p) => g[p.type]?.push(p));
    return g;
  }, [providers]);

  const applyProvider = (id: string, type: ProviderType) => {
    const p = providers.find((x) => x.id === id && x.type === type);
    if (!p) return;
    if (type === "text") {
      setSelectedTextProviderId(id);
      setCopy((prev) => ({ ...prev, vendor: p.vendor, baseURL: p.baseURL, modelId: p.defaultModel || prev.modelId }));
      setCopyCredProfile(p.credProfile || "default");
    } else if (type === "image") {
      setSelectedImageProviderId(id);
      setImage((prev) => ({ ...prev, vendor: p.vendor, baseURL: p.baseURL, modelId: p.defaultModel || prev.modelId }));
      setImageCredProfile(p.credProfile || "default");
    } else {
      setSelectedImageSegProviderId(id);
      setImageSegCredProfile(p.credProfile || "default");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveKey = async (key: string, value: any, description?: string) => {
    await fetch("/api/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: String(value ?? ""), description }),
    });
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      // Copy engine
      await saveKey(KEYS.COPY_ENABLED, copy.enabled, "文案引擎：是否启用");
      await saveKey(KEYS.COPY_VENDOR, copy.vendor, "文案引擎：供应商（不在C端展示）");
      await saveKey(KEYS.COPY_MODEL, copy.modelId, "文案引擎：模型ID");
      await saveKey(KEYS.COPY_BASE_URL, copy.baseURL || "", "文案引擎：baseURL（可选，OpenAI SDK 兼容）");
      await saveKey(KEYS.COPY_CRED_PROFILE, copyCredProfile, "文案引擎：凭证 profile（仅名称，密钥在服务器环境变量）");
      await saveKey(KEYS.COPY_SYSTEM, copy.systemPrompt || "", "文案引擎：System Prompt");
      await saveKey(KEYS.COPY_TEMP, copy.temperature || "", "文案引擎：temperature");
      await saveKey(KEYS.COPY_MAX, copy.maxTokens || "", "文案引擎：max tokens");

      // Image engine
      await saveKey(KEYS.IMAGE_ENABLED, image.enabled, "配图引擎：是否启用");
      await saveKey(KEYS.IMAGE_VENDOR, image.vendor, "配图引擎：供应商（不在C端展示）");
      await saveKey(KEYS.IMAGE_MODEL, image.modelId, "配图引擎：模型ID");
      await saveKey(KEYS.IMAGE_BASE_URL, image.baseURL || "", "配图引擎：baseURL（可选）");
      await saveKey(KEYS.IMAGE_CRED_PROFILE, imageCredProfile, "配图引擎：凭证 profile（仅名称，密钥在服务器环境变量）");
      await saveKey(KEYS.IMAGE_TEMPLATE, image.imagePromptTemplate || "", "配图引擎：6条提示词生成模板（{{copy}}）");
      await saveKey(KEYS.IMAGE_NEG, image.imageNegativePrompt || "", "配图引擎：默认 negative_prompt");
      await saveKey(KEYS.IMAGE_EXTEND, !!image.imagePromptExtend, "配图引擎：是否开启 prompt_extend");
      await saveKey(KEYS.IMAGESEG_CRED_PROFILE, imageSegCredProfile, "抠图：凭证 profile（仅名称，AK/SK 在服务器环境变量）");

      await load();
      alert("已保存引擎配置");
    } catch (e) {
      console.error(e);
      alert("保存失败，请看控制台日志");
    } finally {
      setIsSaving(false);
    }
  };

  const quickFillTemplate = () => {
    setImage((prev) => ({
      ...prev,
      imagePromptTemplate:
        `# 角色\n\n你是小红书爆款配图生成助手，专注于根据用户提供的小红书标题和正文内容，精准提取核心信息并生成6个风格各异、适配小红书平台审美的高质量图片提示词。\n\n## 输出要求\n- 只输出 JSON 数组字符串（长度=6），不要输出其它内容。\n- 每条提示词尽量包含：主体/场景/光线/风格/核心元素（但不要为了格式牺牲自然度）。\n- 内容必须严格基于标题正文，不得编造无关元素。\n\n输入（标题+正文）：\n{{copy}}\n`,
    }));
  };

  const handleTestPrompts = async () => {
    setIsTestingPrompts(true);
    setTestPrompts(null);
    try {
      const res = await fetch("/api/generate/image-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: testProductName,
          copy: testCopy,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "生成提示词失败");
        return;
      }
      if (Array.isArray(data?.prompts)) {
        setTestPrompts(data.prompts);
        setTestImagePrompt(data.prompts[0] || "");
      } else {
        alert("返回格式不正确（prompts 不是数组）");
      }
    } catch (e) {
      console.error(e);
      alert("网络错误，生成提示词失败");
    } finally {
      setIsTestingPrompts(false);
    }
  };

  const handleTestImageUpload = async (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      setTestImageDataUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleTestOneImage = async () => {
    setIsTestingImage(true);
    setTestImageResultUrl(null);
    try {
      const res = await fetch("/api/generate/image/one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: testProductName,
          prompt: testImagePrompt || (testPrompts?.[0] || "生成一张真实拍摄风格产品图"),
          images: testImageDataUrl ? [{ dataUrl: testImageDataUrl, note: "测试参考图" }] : [],
          primaryIndex: 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "生图失败");
        return;
      }
      setTestImageResultUrl(data?.url || null);
    } catch (e) {
      console.error(e);
      alert("网络错误，生图失败");
    } finally {
      setIsTestingImage(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">引擎配置</h1>
          <p className="text-muted-foreground">默认只改“风格/模板”即可生效；模型与参数都收进高级设置。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={isLoading || isSaving}>
            {isLoading ? "刷新中..." : "刷新"}
          </Button>
          <Button onClick={handleSaveAll} disabled={isLoading || isSaving}>
            {isSaving ? "保存中..." : "保存全部"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基础设置（小白友好）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">显示高级设置</div>
              <div className="text-xs text-muted-foreground">不建议改模型ID/温度等参数；你只需要选预设或改模板。</div>
            </div>
            <input type="checkbox" checked={showAdvanced} onChange={(e) => setShowAdvanced(e.target.checked)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>文案引擎（Text）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>启用</Label>
              <input
                type="checkbox"
                checked={!!copy.enabled}
                onChange={(e) => setCopy((p) => ({ ...p, enabled: e.target.checked }))}
              />
            </div>

            <div className="space-y-2">
              <Label>厂商 API（推荐）</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={selectedTextProviderId}
                onChange={(e) => applyProvider(e.target.value, "text")}
              >
                <option value="">（不选择，手动配置）</option>
                {providersByType.text.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}（{p.credProfile || "default"}）
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">去“供应商管理”新增厂商后，这里就可以一键切换。</p>
            </div>

            <div className="space-y-2">
              <Label>文案风格（推荐）</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={copyPresetId}
                onChange={(e) => applyCopyPreset(e.target.value)}
              >
                {copyPresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">选一个风格，会自动填充下面的“文案提示词”。</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>文案提示词（可选）</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCopyPromptEditor((v) => !v)}
                >
                  {showCopyPromptEditor ? "收起" : "自定义/展开"}
                </Button>
              </div>
              {!showCopyPromptEditor ? (
                <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                  当前提示词预览：
                  <div className="mt-1 whitespace-pre-wrap text-foreground/80">
                    {(copy.systemPrompt || "").slice(0, 160)}
                    {(copy.systemPrompt || "").length > 160 ? "..." : ""}
                  </div>
                </div>
              ) : (
                <Textarea
                  className="min-h-[180px] font-mono text-xs"
                  value={copy.systemPrompt || ""}
                  onChange={(e) => setCopy((p) => ({ ...p, systemPrompt: e.target.value }))}
                />
              )}
              <p className="text-xs text-muted-foreground">默认用预设即可；只有你想精细调文案风格时再展开修改。</p>
            </div>

            {showAdvanced ? (
              <>
                <div className="space-y-2">
                  <Label>baseURL（高级）</Label>
                  <Input
                    value={copy.baseURL || ""}
                    onChange={(e) => setCopy((p) => ({ ...p, baseURL: e.target.value }))}
                    placeholder="例如：https://ark.cn-beijing.volces.com/api/v3"
                  />
                  <p className="text-xs text-muted-foreground">用于 OpenAI SDK 兼容网关；密钥仍从服务器环境变量读取。</p>
                </div>
                <div className="space-y-2">
                  <Label>凭证 profile（高级）</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={copyCredProfile}
                    onChange={(e) => setCopyCredProfile(e.target.value)}
                  >
                    {(availableProfiles.volc || ["default"]).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    这里选“用哪套 Key”。服务器环境变量命名示例：<code>VOLC_API_KEY_primary</code>、<code>VOLC_API_KEY_backup</code>。
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>供应商（高级）</Label>
                  <Input value={copy.vendor} onChange={(e) => setCopy((p) => ({ ...p, vendor: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>模型ID（高级）</Label>
                  <Input value={copy.modelId} onChange={(e) => setCopy((p) => ({ ...p, modelId: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>temperature（高级）</Label>
                    <Input
                      value={copy.temperature || ""}
                      onChange={(e) => setCopy((p) => ({ ...p, temperature: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>max tokens（高级）</Label>
                    <Input value={copy.maxTokens || ""} onChange={(e) => setCopy((p) => ({ ...p, maxTokens: e.target.value }))} />
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>配图引擎（Image）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>启用</Label>
              <input
                type="checkbox"
                checked={!!image.enabled}
                onChange={(e) => setImage((p) => ({ ...p, enabled: e.target.checked }))}
              />
            </div>

            <div className="space-y-2">
              <Label>厂商 API（推荐）</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={selectedImageProviderId}
                onChange={(e) => applyProvider(e.target.value, "image")}
              >
                <option value="">（不选择，手动配置）</option>
                {providersByType.image.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}（{p.credProfile || "default"}）
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">切换后会自动填 baseURL/默认模型/profile。</p>
            </div>

            <div className="space-y-2">
              <Label>抠图厂商（可选）</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={selectedImageSegProviderId}
                onChange={(e) => applyProvider(e.target.value, "imageseg")}
              >
                <option value="">（不选择，使用当前 profile）</option>
                {providersByType.imageseg.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}（{p.credProfile || "default"}）
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">抠图目前只需要选择 profile；endpoint 固定为阿里云 ImageSeg。</p>
            </div>

            <div className="space-y-2">
              <Label>配图模板（推荐）</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={imagePresetId}
                onChange={(e) => applyImagePreset(e.target.value)}
              >
                {imageTemplatePresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">选一个模板，会自动填充下面的“生图提示词模板”。</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>6条提示词生成模板（{"{{copy}}"}）</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={quickFillTemplate}>
                    一键填充
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowImageTemplateEditor((v) => !v)}
                  >
                    {showImageTemplateEditor ? "收起" : "自定义/展开"}
                  </Button>
                </div>
              </div>
              {!showImageTemplateEditor ? (
                <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                  当前模板预览：
                  <div className="mt-1 whitespace-pre-wrap text-foreground/80">
                    {(image.imagePromptTemplate || "").slice(0, 200)}
                    {(image.imagePromptTemplate || "").length > 200 ? "..." : ""}
                  </div>
                </div>
              ) : (
                <Textarea
                  className="min-h-[200px] font-mono text-xs"
                  value={image.imagePromptTemplate || ""}
                  onChange={(e) => setImage((p) => ({ ...p, imagePromptTemplate: e.target.value }))}
                />
              )}
              <p className="text-xs text-muted-foreground">
                模板里用 {"{{copy}}"} 代表“文案内容”。日常只需要选预设或点“一键填充”即可。
              </p>
            </div>

            {showAdvanced ? (
              <>
                <div className="space-y-2">
                  <Label>baseURL（高级）</Label>
                  <Input
                    value={image.baseURL || ""}
                    onChange={(e) => setImage((p) => ({ ...p, baseURL: e.target.value }))}
                    placeholder="例如：https://dashscope.aliyuncs.com/api/v1"
                  />
                  <p className="text-xs text-muted-foreground">用于配图接口网关；密钥仍从服务器环境变量读取。</p>
                </div>
                <div className="space-y-2">
                  <Label>配图凭证 profile（高级）</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={imageCredProfile}
                    onChange={(e) => setImageCredProfile(e.target.value)}
                  >
                    {(availableProfiles.dashscope || ["default"]).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    服务器环境变量命名示例：<code>DASHSCOPE_API_KEY_primary</code>、<code>DASHSCOPE_API_KEY_backup</code>。
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>抠图凭证 profile（高级）</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={imageSegCredProfile}
                    onChange={(e) => setImageSegCredProfile(e.target.value)}
                  >
                    {(availableProfiles.imageseg || ["default"]).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    服务器环境变量命名示例：<code>ALIBABA_CLOUD_ACCESS_KEY_ID_primary</code> + <code>ALIBABA_CLOUD_ACCESS_KEY_SECRET_primary</code>。
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>供应商（高级）</Label>
                  <Input value={image.vendor} onChange={(e) => setImage((p) => ({ ...p, vendor: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>模型ID（高级）</Label>
                  <Input value={image.modelId} onChange={(e) => setImage((p) => ({ ...p, modelId: e.target.value }))} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>提示词智能改写（prompt_extend）（高级）</Label>
                  <input
                    type="checkbox"
                    checked={!!image.imagePromptExtend}
                    onChange={(e) => setImage((p) => ({ ...p, imagePromptExtend: e.target.checked }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>默认 negative_prompt（高级）</Label>
                  <Textarea
                    className="min-h-[90px] font-mono text-xs"
                    value={image.imageNegativePrompt || ""}
                    onChange={(e) => setImage((p) => ({ ...p, imageNegativePrompt: e.target.value }))}
                  />
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>一键测试（不影响C端）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>测试产品名称</Label>
              <Input value={testProductName} onChange={(e) => setTestProductName(e.target.value)} />
              <p className="text-xs text-muted-foreground">用于提示词/生图的产品名占位。</p>
            </div>
            <div className="space-y-2">
              <Label>测试参考图（可选）</Label>
              <Input type="file" accept="image/*" onChange={(e) => handleTestImageUpload(e.target.files?.[0] || null)} />
              {testImageDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={testImageDataUrl} alt="test" className="mt-2 w-full max-w-[220px] rounded border" />
              ) : (
                <p className="text-xs text-muted-foreground">不上传也能测：会走“无图生图”逻辑。</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>测试小红书文案（用于生成6条配图提示词）</Label>
            <Textarea
              className="min-h-[140px] font-mono text-xs"
              value={testCopy}
              onChange={(e) => setTestCopy(e.target.value)}
              placeholder="标题：...\n正文：...\n标签：..."
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleTestPrompts} disabled={isTestingPrompts}>
                {isTestingPrompts ? "生成中..." : "生成6条配图提示词"}
              </Button>
              <Button onClick={handleTestOneImage} disabled={isTestingImage}>
                {isTestingImage ? "生图中..." : "单张生图测试"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>单张生图提示词（可手动改）</Label>
            <Textarea
              className="min-h-[90px] font-mono text-xs"
              value={testImagePrompt}
              onChange={(e) => setTestImagePrompt(e.target.value)}
              placeholder="从上面生成的6条里自动带入第一条，也可以自己改"
            />
          </div>

          {Array.isArray(testPrompts) ? (
            <div className="space-y-2">
              <Label>生成的6条提示词预览</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {testPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    className="text-left rounded border p-3 hover:bg-muted/30"
                    onClick={() => setTestImagePrompt(p)}
                    type="button"
                    title="点击将该提示词填入“单张生图提示词”"
                  >
                    <div className="text-xs text-muted-foreground mb-1">提示词 {idx + 1}</div>
                    <div className="text-sm whitespace-pre-wrap">{p}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {testImageResultUrl ? (
            <div className="space-y-2">
              <Label>单张生图结果</Label>
              <div className="rounded border p-3">
                <p className="text-xs text-muted-foreground break-all">{testImageResultUrl}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={testImageResultUrl} alt="result" className="mt-3 w-full max-w-[520px] rounded" />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}


