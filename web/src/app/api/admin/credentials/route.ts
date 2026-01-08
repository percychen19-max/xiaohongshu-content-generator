import { NextResponse } from "next/server";
import { listAvailableProfiles } from "@/lib/credentials";
import { listProfilesFromStore } from "@/lib/credential-resolver";

export async function GET() {
  // 只返回 profile 名称（不包含任何密钥），可安全用于后台下拉选择
  const envProfiles = listAvailableProfiles();
  const store = await listProfilesFromStore().catch(() => ({} as any));

  // 把后台 API 管理中心里配置的 profile 也合并进下拉（按 vendor 映射到现有分组）
  Object.entries(store || {}).forEach(([vendor, types]) => {
    if (vendor === "volc") (types.text || []).forEach((p: string) => envProfiles.volc.push(p));
    if (vendor === "dashscope") (types.image || []).forEach((p: string) => envProfiles.dashscope.push(p));
    if (vendor === "aliyun-imageseg") (types.imageseg || []).forEach((p: string) => envProfiles.imageseg.push(p));
  });

  // 去重
  const uniq = (arr: string[]) => Array.from(new Set(arr)).sort();
  const merged = {
    volc: uniq(envProfiles.volc),
    dashscope: uniq(envProfiles.dashscope),
    imageseg: uniq(envProfiles.imageseg),
  };

  return NextResponse.json({
    profiles: merged,
    help: {
      volc: "可来自 env：VOLC_API_KEY_<PROFILE> 或后台 API 管理中心（vendor=volc, type=text）",
      dashscope: "可来自 env：DASHSCOPE_API_KEY_<PROFILE> 或后台 API 管理中心（vendor=dashscope, type=image）",
      imageseg: "可来自 env：ALIBABA_CLOUD_ACCESS_KEY_*_<PROFILE> 或后台 API 管理中心（vendor=aliyun-imageseg, type=imageseg）",
    },
  });
}


