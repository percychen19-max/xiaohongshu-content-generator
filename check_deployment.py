#!/usr/bin/env python3
"""
检查 Zeabur 部署状态
"""

import requests
import json
import sys
import os

# Zeabur API 配置
ZEABUR_API_KEY = os.getenv("ZEABUR_API_KEY", "sk-f4pme4d4in6x2ainfri5wpdorvcvg")
ZEABUR_API_URL = "https://gateway.zeabur.com/graphql"

def query_zeabur(query, variables=None):
    """发送 GraphQL 请求到 Zeabur API"""
    headers = {
        "Authorization": f"Bearer {ZEABUR_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {"query": query}
    if variables:
        payload["variables"] = variables

    try:
        r = requests.post(ZEABUR_API_URL, json=payload, headers=headers, timeout=30)
        if r.status_code != 200:
            print(f"❌ API 请求失败: {r.status_code}")
            print(r.text)
            return None
        
        result = r.json()
        if "errors" in result:
            print(f"❌ GraphQL 错误: {json.dumps(result['errors'], indent=2, ensure_ascii=False)}")
            return None
        
        return result
    except Exception as e:
        print(f"❌ 连接错误: {e}")
        return None

print("🔍 检查部署状态...\n")

# 1. 获取项目列表
print("📋 获取项目列表...")
get_projects = """
query {
  projects {
    _id
    name
  }
}
"""
res = query_zeabur(get_projects)
if not res:
    sys.exit(1)

projects = res.get("data", {}).get("projects", [])
xhs_project = None
for p in projects:
    if p["name"].lower() == "xhs":
        xhs_project = p
        break

if not xhs_project:
    print("❌ 未找到项目 'xhs'")
    print(f"   可用项目: {[p['name'] for p in projects]}")
    sys.exit(1)

project_id = xhs_project["_id"]
print(f"✅ 找到项目: {xhs_project['name']} (ID: {project_id})\n")

# 2. 获取服务列表
print("📋 获取服务列表...")
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
if not res:
    sys.exit(1)

services = res.get("data", {}).get("project", {}).get("services", [])
print(f"✅ 找到 {len(services)} 个服务:\n")

for service in services:
    print(f"  - {service['name']} ({service['type']}) - ID: {service['_id']}")

# 3. 获取应用服务的详细信息
app_service = None
for service in services:
    if "xiaohongshu" in service["name"].lower() or service["type"] in ["DOCKERFILE", "NODEJS"]:
        app_service = service
        break

if not app_service:
    print("\n❌ 未找到应用服务")
    sys.exit(1)

print(f"\n📦 检查应用服务: {app_service['name']}\n")

# 4. 获取服务状态和部署信息
get_service_status = """
query($serviceId: ObjectID!) {
  service(_id: $serviceId) {
    _id
    name
    status
    deployments {
      _id
      status
      createdAt
      logs {
        content
        timestamp
      }
    }
    env {
      name
      value
    }
  }
}
"""
res = query_zeabur(get_service_status, {"serviceId": app_service["_id"]})
if not res:
    sys.exit(1)

service_data = res.get("data", {}).get("service", {})
status = service_data.get("status", "unknown")
deployments = service_data.get("deployments", [])

print(f"📊 服务状态: {status}")
print(f"📦 部署次数: {len(deployments)}\n")

if deployments:
    latest = deployments[0]
    print(f"🕐 最新部署:")
    print(f"   - 状态: {latest.get('status', 'unknown')}")
    print(f"   - 创建时间: {latest.get('createdAt', 'unknown')}")
    
    logs = latest.get("logs", [])
    if logs:
        print(f"\n📝 最新日志 (最后 20 条):")
        for log in logs[-20:]:
            content = log.get("content", "")
            timestamp = log.get("timestamp", "")
            print(f"   [{timestamp}] {content}")

# 5. 检查环境变量
envs = service_data.get("env", [])
print(f"\n🔧 环境变量数量: {len(envs)}")
if envs:
    print("   已配置的环境变量:")
    for env in envs[:10]:  # 只显示前10个
        name = env.get("name", "")
        value = env.get("value", "")
        # 隐藏敏感信息
        if "KEY" in name or "SECRET" in name or "PASSWORD" in name:
            value = value[:10] + "..." if len(value) > 10 else "***"
        print(f"   - {name} = {value}")
    if len(envs) > 10:
        print(f"   ... 还有 {len(envs) - 10} 个环境变量")

print("\n✅ 检查完成！")

