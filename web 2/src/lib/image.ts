import sharp from "sharp";

/**
 * 根据透明底图生成黑白蒙版 (Inpainting Mask)
 * @param imageBase64 透明底图的 Base64 (不带前缀)
 * @returns 蒙版图的 Base64 (不带前缀)
 * 规则：不透明区域(产品) -> 黑色(#000000)，透明区域(背景) -> 白色(#FFFFFF)
 * 注意：不同的模型对黑白的定义可能相反，通常 Inpainting 是 "白色代表要重绘的区域"。
 */
export async function createMask(imageBase64: string): Promise<string> {
  try {
    const buffer = Buffer.from(imageBase64, "base64");
    
    // 1. 获取 alpha 通道
    // 2. 阈值处理：不透明的变黑，透明的变白
    // sharp 的操作链：
    // extractChannel('alpha') -> 提取透明度
    // toColourspace('b-w') -> 转黑白
    // negate() -> 反转 (因为 alpha=255 是实体，我们要让他变黑即 0)
    
    // 简单逻辑：
    // 我们需要一张图：产品部分是黑色(保护)，背景部分是白色(重绘)
    
    const maskBuffer = await sharp(buffer)
      .ensureAlpha() // 确保有 alpha 通道
      .extractChannel(3) // 提取 alpha (0-255)
      .toColourspace('b-w')
      .negate() // 反转：实体(255)->0(黑), 透明(0)->255(白)
      .png()
      .toBuffer();

    return maskBuffer.toString("base64");
  } catch (error) {
    console.error("蒙版生成失败:", error);
    throw error;
  }
}

