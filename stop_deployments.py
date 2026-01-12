#!/usr/bin/env python3
"""
停止 Zeabur 上所有运行中的部署
"""
import requests
import json
import sys
import time

ZEABUR_TOKEN = "sk-f4pme4d4in6x2ainfri5wpdorvcvg"
API_URL = "https://gateway.zeabur.com/graphql"

def query_zeabur(query, variables=None, retries=3):
    """查询 Zeabur GraphQL API，带重试机制"""
    headers = {
        "Authorization": f"Bearer {ZEABUR_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {"query": query, "variables": variables}
    
    for attempt in range(retries):
        try:
            response = requests.post(API_URL, json=payload, headers=headers, timeout=30)
            if response.status_code == 200:
                return response.json()
            else:
                print(f"⚠️  请求失败 (状态码: {response.status_code})")
                if attempt < retries - 1:
                    time.sleep(2 ** attempt)  # 指数退避
        except Exception as e:
            print(f"⚠️  请求异常 (尝试 {attempt + 1}/{retries}): {str(e)}")
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
    
    return None

def main():
    print("🔍 正在连接 Zeabur API...")
    
    # 1. 获取项目列表
    get_projects_query = """
    query {
      projects {
        _id
        name
      }
    }
    """
    
    print("📋 正在获取项目列表...")
    result = query_zeabur(get_projects_query)
    if not result or "errors" in result:
        print(f"❌ 获取项目失败: {result.get('errors', '未知错误') if result else '网络错误'}")
        return 1
    
    projects = result.get("data", {}).get("projects", [])
    if not projects:
        print("❌ 未找到项目")
        return 1
    
    # 查找 xhs 项目
    project = next((p for p in projects if "xhs" in p["name"].lower()), projects[0])
    project_id = project["_id"]
    print(f"✅ 找到项目: {project['name']} (ID: {project_id})")
    
    # 2. 获取服务列表
    get_services_query = """
    query($projectId: ObjectID!) {
      project(_id: $projectId) {
        services {
          _id
          name
        }
      }
    }
    """
    
    print("📋 正在获取服务列表...")
    result = query_zeabur(get_services_query, {"projectId": project_id})
    if not result or "errors" in result:
        print(f"❌ 获取服务失败: {result.get('errors', '未知错误') if result else '网络错误'}")
        return 1
    
    services = result.get("data", {}).get("project", {}).get("services", [])
    if not services:
        print("❌ 未找到服务")
        return 1
    
    # 查找 content-generator 服务
    service = next((s for s in services if "content-generator" in s["name"].lower()), services[0])
    service_id = service["_id"]
    print(f"✅ 找到服务: {service['name']} (ID: {service_id})")
    
    # 3. 获取所有部署
    get_deployments_query = """
    query($serviceId: ObjectID!) {
      service(_id: $serviceId) {
        deployments {
          _id
          status
          createdAt
        }
      }
    }
    """
    
    print("📋 正在获取部署列表...")
    result = query_zeabur(get_deployments_query, {"serviceId": service_id})
    if not result or "errors" in result:
        print(f"❌ 获取部署失败: {result.get('errors', '未知错误') if result else '网络错误'}")
        return 1
    
    deployments = result.get("data", {}).get("service", {}).get("deployments", [])
    print(f"📋 找到 {len(deployments)} 个部署")
    
    # 4. 停止所有运行中的部署
    stop_deployment_mutation = """
    mutation($deploymentId: ObjectID!) {
      stopDeployment(_id: $deploymentId) {
        _id
        status
      }
    }
    """
    
    running_deployments = []
    for deployment in deployments:
        status = str(deployment.get("status", "")).lower()
        if "running" in status or status == "active":
            running_deployments.append(deployment)
    
    if not running_deployments:
        print("ℹ️  没有运行中的部署需要停止")
        return 0
    
    print(f"🛑 找到 {len(running_deployments)} 个运行中的部署，正在停止...")
    
    stopped_count = 0
    for deployment in running_deployments:
        deployment_id = deployment["_id"]
        print(f"🛑 正在停止部署: {deployment_id[:8]}...")
        
        result = query_zeabur(stop_deployment_mutation, {"deploymentId": deployment_id})
        if result and "errors" not in result:
            print(f"✅ 已停止部署: {deployment_id[:8]}")
            stopped_count += 1
        else:
            error_msg = result.get("errors", ["未知错误"]) if result else "网络错误"
            print(f"⚠️  停止部署失败: {error_msg}")
    
    print(f"\n✅ 操作完成！已停止 {stopped_count}/{len(running_deployments)} 个部署")
    return 0

if __name__ == "__main__":
    sys.exit(main())

