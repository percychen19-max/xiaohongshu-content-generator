#!/usr/bin/env python3
"""
触发 Zeabur 重新部署（这会自动停止旧部署并启动新的）
"""
import requests
import json
import sys
import os
import time
import urllib3
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# 禁用 SSL 警告（如果使用自签名证书）
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

ZEABUR_TOKEN = os.getenv("ZEABUR_API_KEY") or os.getenv("ZEABUR_TOKEN")

if not ZEABUR_TOKEN:
    print("❌ 缺少环境变量 ZEABUR_API_KEY（或 ZEABUR_TOKEN）")
    exit(1)
API_URL = "https://gateway.zeabur.com/graphql"

def create_session():
    """创建带重试机制的 requests session"""
    session = requests.Session()
    
    # 配置重试策略
    retry_strategy = Retry(
        total=5,
        backoff_factor=2,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["POST"]
    )
    
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    
    return session

def query_zeabur(query, variables=None, retries=5):
    """查询 Zeabur GraphQL API，带重试机制和更好的错误处理"""
    headers = {
        "Authorization": f"Bearer {ZEABUR_TOKEN}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
        "Connection": "keep-alive"
    }
    payload = {"query": query, "variables": variables}
    
    session = create_session()
    
    for attempt in range(retries):
        try:
            # 使用更长的超时时间
            response = session.post(
                API_URL, 
                json=payload, 
                headers=headers, 
                timeout=(10, 30),  # (连接超时, 读取超时)
                verify=True,  # 验证 SSL 证书
                allow_redirects=True
            )
            
            if response.status_code == 200:
                result = response.json()
                if "errors" in result:
                    print(f"⚠️  GraphQL 错误: {result['errors']}")
                    return result
                return result
            else:
                print(f"⚠️  请求失败 (状态码: {response.status_code})")
                print(f"   响应: {response.text[:200]}")
                if attempt < retries - 1:
                    wait_time = 2 ** attempt
                    print(f"   等待 {wait_time} 秒后重试...")
                    time.sleep(wait_time)
                    
        except requests.exceptions.SSLError as e:
            print(f"⚠️  SSL 错误 (尝试 {attempt + 1}/{retries}): {str(e)[:100]}")
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
        except requests.exceptions.ConnectionError as e:
            print(f"⚠️  连接错误 (尝试 {attempt + 1}/{retries}): {str(e)[:100]}")
            if attempt < retries - 1:
                wait_time = 2 ** attempt
                print(f"   等待 {wait_time} 秒后重试...")
                time.sleep(wait_time)
        except requests.exceptions.Timeout as e:
            print(f"⚠️  超时错误 (尝试 {attempt + 1}/{retries}): {str(e)[:100]}")
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
        except Exception as e:
            print(f"⚠️  未知错误 (尝试 {attempt + 1}/{retries}): {type(e).__name__}: {str(e)[:100]}")
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
    
    return None

def main():
    print("🚀 正在触发 Zeabur 重新部署...")
    print("   这会自动停止旧部署并启动新的部署\n")
    
    # 1. 获取项目列表
    get_projects_query = """
    query {
      projects {
        _id
        name
      }
    }
    """
    
    print("📋 步骤 1/3: 获取项目列表...")
    result = query_zeabur(get_projects_query)
    if not result or "errors" in result:
        print(f"❌ 失败: {result.get('errors', '网络错误') if result else '网络连接失败'}")
        print("\n💡 提示: 由于网络限制，请稍后重试，或直接在 Zeabur 控制台点击 'Redeploy'")
        return 1
    
    projects = result.get("data", {}).get("projects", [])
    if not projects:
        print("❌ 未找到项目")
        return 1
    
    project = next((p for p in projects if "xhs" in p["name"].lower()), projects[0])
    project_id = project["_id"]
    print(f"✅ 找到项目: {project['name']}")
    
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
    
    print("📋 步骤 2/3: 获取服务列表...")
    result = query_zeabur(get_services_query, {"projectId": project_id})
    if not result or "errors" in result:
        print(f"❌ 失败: {result.get('errors', '网络错误') if result else '网络连接失败'}")
        return 1
    
    services = result.get("data", {}).get("project", {}).get("services", [])
    if not services:
        print("❌ 未找到服务")
        return 1
    
    service = next((s for s in services if "content-generator" in s["name"].lower()), services[0])
    service_id = service["_id"]
    print(f"✅ 找到服务: {service['name']}")
    
    # 3. 触发重新部署
    redeploy_mutation = """
    mutation($serviceId: ObjectID!) {
      redeployService(_id: $serviceId) {
        _id
        status
      }
    }
    """
    
    print("📋 步骤 3/3: 触发重新部署...")
    result = query_zeabur(redeploy_mutation, {"serviceId": service_id})
    if not result or "errors" in result:
        print(f"❌ 失败: {result.get('errors', '网络错误') if result else '网络连接失败'}")
        print("\n💡 提示: 由于网络限制，请直接在 Zeabur 控制台点击 'Redeploy' 按钮")
        return 1
    
    print("✅ 重新部署已触发！")
    print("\n📋 下一步:")
    print("   1. 进入 Zeabur 控制台查看部署状态")
    print("   2. 新的部署会自动停止旧部署并开始构建")
    print("   3. 查看构建日志确认是否成功")
    return 0

if __name__ == "__main__":
    sys.exit(main())

