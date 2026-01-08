/**
 * 阿里云短信服务工具
 * 用于发送验证码短信
 */

interface SendSmsParams {
  phone: string;
  code: string;
}

/**
 * 发送验证码短信
 * @param phone 手机号
 * @param code 验证码（6位数字）
 */
export async function sendVerificationCode({ phone, code }: SendSmsParams): Promise<boolean> {
  // 检查环境变量
  const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET;
  const signName = process.env.ALIYUN_SMS_SIGN_NAME || "小红书爆文生成";
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;

  if (!accessKeyId || !accessKeySecret) {
    console.error("❌ 阿里云短信服务未配置：缺少 ACCESS_KEY_ID 或 ACCESS_KEY_SECRET");
    return false;
  }

  if (!templateCode) {
    console.error("❌ 阿里云短信服务未配置：缺少 TEMPLATE_CODE");
    return false;
  }

  try {
    // 使用阿里云短信服务 API
    // 注意：这里使用阿里云 OpenAPI 的签名方式
    const endpoint = "https://dysmsapi.aliyuncs.com";
    const action = "SendSms";
    const version = "2017-05-25";
    const regionId = "cn-hangzhou";

    // 构建请求参数
    const params: Record<string, string> = {
      AccessKeyId: accessKeyId,
      Action: action,
      Format: "JSON",
      PhoneNumbers: phone,
      RegionId: regionId,
      SignName: signName,
      TemplateCode: templateCode,
      TemplateParam: JSON.stringify({ code }),
      Version: version,
      Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      SignatureMethod: "HMAC-SHA1",
      SignatureVersion: "1.0",
      SignatureNonce: Math.random().toString(36).substring(2, 15),
    };

    // 生成签名
    const signature = generateSignature(params, accessKeySecret, "POST");

    // 发送请求
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        ...params,
        Signature: signature,
      }).toString(),
    });

    const result = await response.json();

    if (result.Code === "OK") {
      console.log(`✅ 验证码已发送到 ${phone}`);
      return true;
    } else {
      console.error(`❌ 短信发送失败: ${result.Message || result.Code}`);
      return false;
    }
  } catch (error: any) {
    console.error("❌ 短信发送异常:", error.message);
    return false;
  }
}

/**
 * 生成阿里云 API 签名
 */
function generateSignature(
  params: Record<string, string>,
  accessKeySecret: string,
  method: string
): string {
  // 1. 参数排序（按字典序）
  const sortedKeys = Object.keys(params).sort();
  const sortedParams = sortedKeys
    .map((key) => {
      // 特殊字符需要正确编码
      const encodedKey = encodeURIComponent(key).replace(/%20/g, "+");
      const encodedValue = encodeURIComponent(params[key]).replace(/%20/g, "+");
      return `${encodedKey}=${encodedValue}`;
    })
    .join("&");

  // 2. 构建待签名字符串
  const stringToSign = `${method}&${encodeURIComponent("/")}&${encodeURIComponent(sortedParams)}`;

  // 3. 计算 HMAC-SHA1
  const crypto = require("crypto");
  const signature = crypto
    .createHmac("sha1", accessKeySecret + "&")
    .update(stringToSign)
    .digest("base64");

  return signature;
}

/**
 * 生成6位随机验证码
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

