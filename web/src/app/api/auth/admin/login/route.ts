import { NextResponse } from "next/server";
import { encrypt } from "@/lib/auth";
import { cookies } from "next/headers";
import { PrismaClient } from "@prisma/client";
import { encryptSecret } from "@/lib/crypto";

// 数据库客户端单例
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: "请填写完整信息" }, { status: 400 });
    }

    const adminUsername = process.env.ADMIN_USERNAME || "admin";
    // 允许使用默认密码 admin1234，防止用户未配置环境变量导致锁在外面
    const adminPassword = process.env.ADMIN_PASSWORD || "admin1234";

    if (username !== adminUsername || password !== adminPassword) {
      console.warn(`⚠️ 管理员登录失败: ${username}`);
      return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
    }

    console.log(`✅ 管理员登录成功: ${username}，正在自动初始化 API 配置...`);

    // 🌟 自动初始化系统配置 (从环境变量同步到数据库)
    await initializeSystemConfigs();

    const sessionData = {
      isAdmin: true,
      username: username,
      loginTime: Date.now(),
    };

    const token = await encrypt(sessionData);
    const cookieStore = await cookies();
    cookieStore.set("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1天
    });

    return NextResponse.json({
      success: true,
      message: "登录成功，API 配置已自动完成初始化",
    });
  } catch (error: any) {
    console.error("管理员登录失败:", error);
    return NextResponse.json(
      { error: "服务端异常: " + (error.message || "未知错误") },
      { status: 500 }
    );
  }
}

async function initializeSystemConfigs() {
  const KEY_CREDS = "API_CREDENTIALS_JSON";
  const KEY_ENGINES = "ENGINE_CONFIGS";

  try {
    const volcKey = process.env.VOLC_API_KEY;
    const dashKey = process.env.DASHSCOPE_API_KEY;
    const aliAK = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
    const aliSK = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;

    if (!volcKey || !dashKey || !aliAK || !aliSK) {
      console.warn(">>> [Init] 部分环境变量未配置，跳过自动初始化。");
      return;
    }

    const defaultCreds = [
      {
        id: "init-volc",
        type: "text",
        vendor: "volc",
        profile: "default",
        baseURL: "https://ark.cn-beijing.volces.com/api/v3",
        secretEnc: encryptSecret(volcKey),
      },
      {
        id: "init-aliyun",
        type: "image",
        vendor: "dashscope",
        profile: "default",
        baseURL: "https://dashscope.aliyuncs.com/api/v1",
        secretEnc: encryptSecret(dashKey),
      },
      {
        id: "init-imageseg",
        type: "imageseg",
        vendor: "aliyun-imageseg",
        profile: "default",
        secretEnc: encryptSecret(JSON.stringify({ accessKeyId: aliAK, accessKeySecret: aliSK })),
      }
    ];

    const defaultEngines = {
      copy: {
        provider: "volc",
        model: "doubao-seed-1-6-lite-251015",
        profile: "default",
        systemPrompt: "你是一个小红书爆款文案专家...",
        temperature: 0.9
      },
      image: {
        provider: "dashscope",
        model: "qwen-image-edit-plus",
        profile: "default",
        promptTemplate: "主体：{{product}}\n场景：{{copy}}\n要求：写实、精美、小红书风格。"
      },
      imageseg: {
        provider: "aliyun-imageseg",
        profile: "default"
      }
    };

    await prisma.systemConfig.upsert({
      where: { key: KEY_CREDS },
      update: { value: JSON.stringify(defaultCreds) },
      create: { key: KEY_CREDS, value: JSON.stringify(defaultCreds), description: "自动初始化凭证" }
    });

    await prisma.systemConfig.upsert({
      where: { key: KEY_ENGINES },
      update: { value: JSON.stringify(defaultEngines) },
      create: { key: KEY_ENGINES, value: JSON.stringify(defaultEngines), description: "自动初始化引擎" }
    });
    
    console.log(">>> [Init] API 配置已自动初始化同步完成");
  } catch (err) {
    console.error(">>> [Init] 初始化配置失败:", err);
  }
}
