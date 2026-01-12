#!/usr/bin/env python3
"""
Zeabur 自动部署脚本
使用 Zeabur GraphQL API 进行部署
"""

import requests
import json
import sys
import time

# Zeabur API 配置
ZEABUR_API_KEY = "sk-f4pme4d4in6x2ainfri5wpdorvcvg"
ZEABUR_API_URL = "https://gateway.zeabur.com/graphql"

def query_zeabur(query, variables=None, retries=3):
    """发送 GraphQL 请求到 Zeabur API，带重试机制"""
    headers = {
        "Authorization": f"Bearer {ZEABUR_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {"query": query}
    if variables:
        payload["variables"] = variables

    for attempt in range(retries):
        try:
            r = requests.post(ZEABUR_API_URL, json=payload, headers=headers, timeout=30)
            if r.status_code != 200:
                print(f"❌ API 请求失败: {r.status_code}")
                print(r.text)
                if attempt < retries - 1:
                    print(f"⏳ 重试中... ({attempt + 1}/{retries})")
                    time.sleep(2)
                    continue
                sys.exit(1)
            
            result = r.json()
            if "errors" in result:
                print(f"❌ GraphQL 错误: {json.dumps(result['errors'], indent=2, ensure_ascii=False)}")
                if attempt < retries - 1:
                    print(f"⏳ 重试中... ({attempt + 1}/{retries})")
                    time.sleep(2)
                    continue
                sys.exit(1)
            
            return result
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            if attempt < retries - 1:
                print(f"⚠️  连接错误: {e}")
                print(f"⏳ 重试中... ({attempt + 1}/{retries})")
                time.sleep(2)
                continue
            else:
                print(f"❌ 连接失败，已重试 {retries} 次")
                raise

print("🚀 开始部署到 Zeabur...")

# 1. 获取项目列表
print("\n📋 获取项目列表...")
get_projects = """
query {
  projects {
    _id
    name
  }
}
"""
res = query_zeabur(get_projects)
projects = res.get("data", {}).get("projects", [])

if not projects:
    print("❌ 未找到项目，请先在 Zeabur 控制台创建项目")
    sys.exit(1)

project = projects[0]
project_id = project["_id"]
print(f"✅ 找到项目: {project['name']} (ID: {project_id})")

# 2. 获取服务列表
print("\n📋 获取服务列表...")
get_services = """
query($projectId: ObjectID!) {
  project(_id: $projectId) {
    services {
      _id
      name
      type
    }
  }
}
"""
res = query_zeabur(get_services, {"projectId": project_id})
services = res.get("data", {}).get("project", {}).get("services", [])

if not services:
    print("❌ 未找到服务，请先在 Zeabur 控制台创建服务")
    sys.exit(1)

# 查找 web 服务或创建新服务
web_service = None
for service in services:
    if "web" in service["name"].lower() or service["type"] == "DOCKERFILE":
        web_service = service
        break

if not web_service:
    print("❌ 未找到 web 服务")
    print("💡 请在 Zeabur 控制台创建服务，或手动指定服务名称")
    sys.exit(1)

service_id = web_service["_id"]
print(f"✅ 找到服务: {web_service['name']} (ID: {service_id})")

# 3. 检查 PostgreSQL 服务
print("\n📋 检查数据库服务...")
postgres_service = None
for service in services:
    if service["type"] == "POSTGRES":
        postgres_service = service
        break

if not postgres_service:
    print("⚠️  未找到 PostgreSQL 服务")
    print("💡 请在 Zeabur 控制台创建 PostgreSQL 服务")
    DATABASE_URL = "postgresql://user:password@host:port/database"  # 占位符
else:
    # 获取数据库连接信息
    get_db_info = """
    query($serviceId: ObjectID!) {
      service(_id: $serviceId) {
        env {
          name
          value
        }
      }
    }
    """
    res = query_zeabur(get_db_info, {"serviceId": postgres_service["_id"]})
    envs = res.get("data", {}).get("service", {}).get("env", [])
    
    # 查找 DATABASE_URL
    DATABASE_URL = None
    for env in envs:
        if env["name"] == "DATABASE_URL":
            DATABASE_URL = env["value"]
            break
    
    if not DATABASE_URL:
        print("⚠️  未找到 DATABASE_URL，请手动配置")
        DATABASE_URL = "postgresql://user:password@host:port/database"  # 占位符
    else:
        print(f"✅ 找到数据库连接: {postgres_service['name']}")

# 4. 设置环境变量
print("\n🔧 配置环境变量...")
update_envs = """
mutation($projectId: ObjectID!, $serviceId: ObjectID!, $envs: [VariableInput!]!) {
  replaceVariables(projectId: $projectId, serviceId: $serviceId, variables: $envs) {
    _id
  }
}
"""

# 必需的环境变量
envs = [
    {"name": "DATABASE_URL", "value": DATABASE_URL},
    {"name": "JWT_SECRET", "value": "xhs_secure_percy_2026_change_in_production"},
    {"name": "NODE_ENV", "value": "production"},
    {"name": "PORT", "value": "3000"},
    
    # 管理员配置
    {"name": "ADMIN_USERNAME", "value": "admin"},
    {"name": "ADMIN_PASSWORD", "value": "admin123"},
    
    # Google API 配置（文案生成）
    {"name": "COPY_ENGINE_VENDOR", "value": "google"},
    {"name": "COPY_ENGINE_MODEL_ID", "value": "gemini-1.5-pro-latest"},
    {"name": "COPY_ENGINE_BASE_URL", "value": "https://gitaigc.com/v1"},
    {"name": "GOOGLE_API_KEY", "value": "sk-qAKQ3q2at4Vsxp9bMNnMhzZzGrQIuPO5smIohEZuAWR6lpzz"},
    
    # Google API 配置（图片生成）
    {"name": "IMAGE_ENGINE_VENDOR", "value": "google"},
    {"name": "IMAGE_ENGINE_MODEL_ID", "value": "gemini-2.5-flash-image"},
    {"name": "IMAGE_ENGINE_BASE_URL", "value": "https://gitaigc.com/v1"},
    
    # 阿里云配置（可选，用于抠图）
    {"name": "DASHSCOPE_API_KEY", "value": "sk-c93e51d35d464e96adf4d406f85e5541"},
    {"name": "DASHSCOPE_BASE_URL", "value": "https://dashscope.aliyuncs.com/api/v1"},
]

res = query_zeabur(update_envs, {
    "projectId": project_id,
    "serviceId": service_id,
    "envs": envs
})

print("✅ 环境变量配置完成")

# 5. 触发重新部署
print("\n🚀 触发重新部署...")
redeploy = """
mutation($serviceId: ObjectID!) {
  redeployService(_id: $serviceId) {
    _id
  }
}
"""
res = query_zeabur(redeploy, {"serviceId": service_id})
print("✅ 重新部署已触发")

print("\n✨ 部署完成！")
print(f"📝 项目 ID: {project_id}")
print(f"📝 服务 ID: {service_id}")
print("\n💡 提示：")
print("   1. 请在 Zeabur 控制台检查部署状态")
print("   2. 确保 PostgreSQL 服务已创建并配置了 DATABASE_URL")
print("   3. 部署完成后，访问你的域名即可使用")

