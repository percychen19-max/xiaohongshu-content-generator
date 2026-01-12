import { NextResponse } from "next/server";
import { segmentCommodityToPngBase64 } from "@/lib/aliyun";

/**
 * 测试抠图功能的简单接口
 * GET /api/test/imageseg
 * 
 * 这个接口会：
 * 1. 创建一个简单的测试图片（1x1像素的红色方块）
 * 2. 尝试调用阿里云抠图 API
 * 3. 返回详细的错误信息
 */
export async function GET() {
  try {
    console.log("=== 开始测试抠图功能 ===");
    
    // 创建一个简单的测试图片（1x1像素红色 PNG，base64）
    // 这是一个最小的有效 PNG 图片
    const testImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    
    console.log("📸 测试图片已准备（1x1像素红色方块）");
    console.log("🔑 开始调用阿里云抠图 API...");
    
    const result = await segmentCommodityToPngBase64(testImageBase64, "default");
    
    console.log("✅ 抠图成功！");
    return NextResponse.json({
      success: true,
      message: "抠图功能正常",
      resultLength: result.length,
      preview: result.substring(0, 50) + "...",
    });
  } catch (e: any) {
    console.error("❌ 抠图测试失败:", e);
    
    // 详细分析错误
    const errorMessage = e?.message || String(e);
    const errorStack = e?.stack || "";
    
    let analysis = "";
    if (errorMessage.includes("NotPurchase") || errorMessage.includes("not purchased")) {
      analysis = "❌ 服务未开通！\n\n" +
                 "问题：您的阿里云账户没有购买/开通\"图像分割（ImageSeg）\"服务\n\n" +
                 "解决方案：\n" +
                 "1. 登录阿里云控制台\n" +
                 "2. 搜索\"图像分割\"服务\n" +
                 "3. 开通服务（通常有免费额度）\n" +
                 "4. 开通后，抠图功能就能正常工作了\n\n" +
                 "参考链接：https://help.aliyun.com/document_detail/465341.html";
    } else if (errorMessage.includes("<!DOCTYPE") || errorMessage.includes("HTML")) {
      analysis = "❌ API 返回了 HTML 页面而不是 JSON，可能是：\n" +
                 "   1. 凭证无效或权限不足\n" +
                 "   2. 服务未开通\n" +
                 "   3. API 端点错误";
    } else if (errorMessage.includes("Missing") || errorMessage.includes("credentials")) {
      analysis = "❌ 凭证未配置或无法读取";
    } else if (errorMessage.includes("network") || errorMessage.includes("timeout")) {
      analysis = "❌ 网络连接问题";
    } else {
      analysis = "❌ 未知错误，需要查看详细日志";
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      analysis,
      stack: errorStack,
    }, { status: 500 });
  }
}

