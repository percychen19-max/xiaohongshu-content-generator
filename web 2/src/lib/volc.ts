// 尝试导入，如果失败不报错，等到用的时候再处理
import * as VolcEngine from "@volcengine/openapi";

export async function removeBackground(imageBase64: string): Promise<string> {
  // 1. 检查环境变量
  if (!process.env.VOLC_ACCESS_KEY || !process.env.VOLC_SECRET_KEY) {
    console.warn("⚠️ 未配置火山引擎 AK/SK，跳过抠图。");
    return imageBase64;
  }

  try {
    console.log("正在尝试调用火山抠图服务...");

    // 2. 动态查找 visual 服务 (兼容不同的 SDK 导出方式)
    // @ts-ignore
    const visualModule = VolcEngine.visual || VolcEngine.default?.visual;

    if (!visualModule || !visualModule.VisualService) {
      console.warn("⚠️ 无法加载火山 VisualService，可能是 SDK 版本不兼容。跳过抠图。");
      return imageBase64;
    }

    // 3. 延迟初始化客户端 (只在真正需要时创建)
    const visualClient = new visualModule.VisualService({
      accessKeyId: process.env.VOLC_ACCESS_KEY,
      secretKey: process.env.VOLC_SECRET_KEY,
      sessionToken: undefined,
      region: "cn-north-1",
    });

    // 4. 发起请求
    const response = await visualClient.SegmentImage({
      image_base64: imageBase64,
    });

    if (response.data && response.data.image_base64) {
      console.log("✅ 抠图成功！");
      return response.data.image_base64;
    } else {
      console.warn("⚠️ 抠图服务返回空数据，降级使用原图。");
      return imageBase64;
    }
  } catch (error: any) {
    // 5. 捕捉一切异常，绝对不让程序崩溃
    console.error("❌ 抠图过程发生异常 (已忽略):", error.message || error);
    return imageBase64; // 无论发生什么，都返回原图，确保后续生成能继续！
  }
}
