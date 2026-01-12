#!/usr/bin/env python3
"""
详细检查 Zeabur 部署状态和问题诊断
"""

import requests
import json
import sys
import os
import time

# Zeabur API 配置（务必从环境变量读取，禁止在仓库中硬编码）
ZEABUR_API_KEY = os.getenv("ZEABUR_API_KEY")
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
            print(f"  尝试连接 API... ({attempt + 1}/{retries})")
            r = requests.post(ZEABUR_API_URL, json=payload, headers=headers, timeout=30, verify=True)
            
            if r.status_code != 200:
                print(f"  ❌ HTTP 状态码: {r.status_code}")
                print(f"  响应内容: {r.text[:200]}")
                if attempt < retries - 1:
                    time.sleep(3)
                    continue
                return None
            
            result = r.json()
            if "errors" in result:
                print(f"  ❌ GraphQL 错误:")
                for error in result["errors"]:
                    print(f"     - {error.get('message', 'Unknown error')}")
                if attempt < retries - 1:
                    time.sleep(3)
                    continue
                return None
            
            return result
        except requests.exceptions.SSLError as e:
            print(f"  ⚠️  SSL 错误: {e}")
            if attempt < retries - 1:
                print(f"  尝试禁用 SSL 验证...")
                try:
                    r = requests.post(ZEABUR_API_URL, json=payload, headers=headers, timeout=30, verify=False)
                    if r.status_code == 200:
                        return r.json()
                except:
                    pass
            if attempt < retries - 1:
                time.sleep(3)
                continue
        except requests.exceptions.ConnectionError as e:
            print(f"  ⚠️  连接错误: {str(e)[:100]}")
            if attempt < retries - 1:
                time.sleep(3)
                continue
        except Exception as e:
            print(f"  ❌ 未知错误: {type(e).__name__}: {str(e)[:100]}")
            if attempt < retries - 1:
                time.sleep(3)
                continue
    
    return None

print("=" * 60)
print("🔍 Zeabur 部署状态检查")
print("=" * 60)
print()

# 必填检查
if not ZEABUR_API_KEY:
    print("❌ 缺少环境变量 ZEABUR_API_KEY（请从 Zeabur 控制台获取 Token 后在本地导出）")
    sys.exit(1)

# 1. 测试 API 连接
print("📡 步骤 1: 测试 API 连接...")
test_query = """
query {
  __typename
}
"""
result = query_zeabur(test_query)
if not result:
    print("\n❌ 无法连接到 Zeabur API")
    print("\n可能的原因:")
    print("  1. 网络连接问题（防火墙/代理）")
    print("  2. API 密钥无效或过期")
    print("  3. Zeabur API 服务暂时不可用")
    print("\n建议:")
    print("  - 检查网络连接")
    print("  - 在 Zeabur 控制台直接查看部署状态")
    print("  - 确认 API 密钥是否正确")
    sys.exit(1)

print("  ✅ API 连接成功\n")

# 2. 获取项目列表
print("📋 步骤 2: 获取项目列表...")
get_projects = """
query {
  projects {
    _id
    name
    createdAt
  }
}
"""
result = query_zeabur(get_projects)
if not result:
    print("  ❌ 无法获取项目列表")
    sys.exit(1)

projects = result.get("data", {}).get("projects", [])
if not projects:
    print("  ❌ 未找到任何项目")
    sys.exit(1)

print(f"  ✅ 找到 {len(projects)} 个项目:")
for p in projects:
    print(f"     - {p['name']} (ID: {p['_id']})")

# 查找 xhs 项目
xhs_project = None
for p in projects:
    if p["name"].lower() == "xhs":
        xhs_project = p
        break

if not xhs_project:
    print(f"\n  ⚠️  未找到项目 'xhs'")
    print(f"  可用项目: {[p['name'] for p in projects]}")
    if projects:
        xhs_project = projects[0]
        print(f"  使用第一个项目: {xhs_project['name']}")
    else:
        sys.exit(1)

project_id = xhs_project["_id"]
print(f"\n  ✅ 使用项目: {xhs_project['name']} (ID: {project_id})")

# 3. 获取服务列表
print(f"\n📦 步骤 3: 获取服务列表...")
get_services = """
query($projectId: ObjectID!) {
  project(_id: $projectId) {
    services {
      _id
      name
      type
      status
      createdAt
    }
  }
}
"""
result = query_zeabur(get_services, {"projectId": project_id})
if not result:
    print("  ❌ 无法获取服务列表")
    sys.exit(1)

services = result.get("data", {}).get("project", {}).get("services", [])
if not services:
    print("  ❌ 项目中没有服务")
    sys.exit(1)

print(f"  ✅ 找到 {len(services)} 个服务:")
for s in services:
    status = s.get("status", "unknown")
    status_icon = "🟢" if status == "RUNNING" else "🟡" if status == "BUILDING" else "🔴"
    print(f"     {status_icon} {s['name']} ({s['type']}) - 状态: {status}")

# 4. 查找应用服务
app_service = None
for service in services:
    if "xiaohongshu" in service["name"].lower() or service["type"] in ["DOCKERFILE", "NODEJS", "DOCKER"]:
        app_service = service
        break

if not app_service and services:
    app_service = services[0]
    print(f"\n  ⚠️  未找到明确的应用服务，使用第一个服务: {app_service['name']}")

if not app_service:
    print("\n  ❌ 未找到应用服务")
    sys.exit(1)

print(f"\n  ✅ 检查服务: {app_service['name']} (ID: {app_service['_id']})")

# 5. 获取服务详细信息
print(f"\n📊 步骤 4: 获取服务详细信息...")
get_service_detail = """
query($serviceId: ObjectID!) {
  service(_id: $serviceId) {
    _id
    name
    status
    deployments {
      _id
      status
      createdAt
      updatedAt
    }
    env {
      name
      value
    }
  }
}
"""
result = query_zeabur(get_service_detail, {"serviceId": app_service["_id"]})
if not result:
    print("  ❌ 无法获取服务详情")
    sys.exit(1)

service_data = result.get("data", {}).get("service", {})
status = service_data.get("status", "unknown")
deployments = service_data.get("deployments", [])
envs = service_data.get("env", [])

print(f"  📊 服务状态: {status}")
print(f"  📦 部署次数: {len(deployments)}")
print(f"  🔧 环境变量数量: {len(envs)}")

# 检查关键环境变量
print(f"\n  🔍 检查关键环境变量:")
required_vars = ["DATABASE_URL", "JWT_SECRET", "NODE_ENV", "PORT", "GOOGLE_API_KEY"]
missing_vars = []
for var in required_vars:
    found = False
    for env in envs:
        if env.get("name") == var:
            value = env.get("value", "")
            if value and value != "从PostgreSQL服务复制" and "你的" not in value:
                print(f"     ✅ {var} = {value[:30]}...")
                found = True
                break
    if not found:
        print(f"     ❌ {var} - 未设置或值无效")
        missing_vars.append(var)

if missing_vars:
    print(f"\n  ⚠️  缺少关键环境变量: {', '.join(missing_vars)}")

# 检查最新部署
if deployments:
    latest = deployments[0]
    print(f"\n  📦 最新部署:")
    print(f"     - ID: {latest.get('_id', 'unknown')}")
    print(f"     - 状态: {latest.get('status', 'unknown')}")
    print(f"     - 创建时间: {latest.get('createdAt', 'unknown')}")
    print(f"     - 更新时间: {latest.get('updatedAt', 'unknown')}")

# 6. 尝试获取日志
print(f"\n📝 步骤 5: 尝试获取部署日志...")
get_logs = """
query($serviceId: ObjectID!) {
  service(_id: $serviceId) {
    deployments {
      _id
      status
      logs {
        content
        timestamp
        level
      }
    }
  }
}
"""
result = query_zeabur(get_logs, {"serviceId": app_service["_id"]})
if result:
    deployments_with_logs = result.get("data", {}).get("service", {}).get("deployments", [])
    if deployments_with_logs:
        latest_deployment = deployments_with_logs[0]
        logs = latest_deployment.get("logs", [])
        if logs:
            print(f"  ✅ 找到 {len(logs)} 条日志")
            print(f"\n  📋 最新日志 (最后 10 条):")
            for log in logs[-10:]:
                level = log.get("level", "INFO")
                content = log.get("content", "")
                timestamp = log.get("timestamp", "")
                icon = "❌" if level == "ERROR" else "⚠️" if level == "WARN" else "ℹ️"
                print(f"     {icon} [{timestamp}] {content[:100]}")
        else:
            print("  ⚠️  没有日志记录")
    else:
        print("  ⚠️  没有部署记录")
else:
    print("  ⚠️  无法获取日志（可能需要等待或查看控制台）")

# 总结
print("\n" + "=" * 60)
print("📋 检查总结")
print("=" * 60)

if status == "RUNNING":
    print("✅ 服务状态: 运行中")
    print("✅ 部署应该已经成功！")
elif status == "BUILDING":
    print("🟡 服务状态: 构建中")
    print("⏳ 请等待构建完成...")
elif status in ["FAILED", "ERROR"]:
    print("🔴 服务状态: 失败")
    print("❌ 部署失败，请检查:")
    if missing_vars:
        print(f"   - 缺少环境变量: {', '.join(missing_vars)}")
    print("   - 查看 Zeabur 控制台的构建日志")
    print("   - 检查启动命令是否正确")
else:
    print(f"⚠️  服务状态: {status}")

print("\n💡 建议:")
print("  1. 在 Zeabur 控制台查看详细的构建日志")
print("  2. 确认所有环境变量都已正确配置")
print("  3. 检查启动命令是否正确")
print("  4. 如果构建失败，查看错误信息并修复")

print("\n" + "=" * 60)

