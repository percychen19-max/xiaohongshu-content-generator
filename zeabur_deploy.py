import requests
import json

ZEABUR_TOKEN = "sk-b7ulnvhx4qvyswhjjcxlxe2f4gewt"
DATABASE_URL = "postgresql://root:37wWY8OUqRo91vhm5d20TPQat6CJj4Bc@hkg1.clusters.zeabur.com:30440/zeabur"

def query_zeabur(query, variables=None):
    url = "https://gateway.zeabur.com/graphql"
    headers = {"Authorization": f"Bearer {ZEABUR_TOKEN}", "Content-Type": "application/json"}
    payload = {"query": query, "variables": variables}
    r = requests.post(url, json=payload, headers=headers)
    return r.json()

# 1. 获取项目 ID
get_projects = """
query {
  projects {
    _id
    name
  }
}
"""
res = query_zeabur(get_projects)
project_id = res['data']['projects'][0]['_id']
print(f"找到项目 ID: {project_id}")

# 2. 获取服务 ID
get_services = """
query($projectId: ObjectID!) {
  project(_id: $projectId) {
    services {
      _id
      name
    }
  }
}
"""
res = query_zeabur(get_services, {"projectId": project_id})
service_id = next(s['_id'] for s in res['data']['project']['services'] if 'content-generator' in s['name'])
print(f"找到服务 ID: {service_id}")

# 3. 设置根目录为 web
update_root = """
mutation($projectId: ObjectID!, $serviceId: ObjectID!, $rootDirectory: String!) {
  updateService(_id: $serviceId, projectId: $projectId, rootDirectory: $rootDirectory) {
    _id
  }
}
"""
query_zeabur(update_root, {"projectId": project_id, "serviceId": service_id, "rootDirectory": "web"})
print("✅ 根目录已设置为 'web'")

# 4. 设置环境变量
update_envs = """
mutation($projectId: ObjectID!, $serviceId: ObjectID!, $envs: [VariableInput!]!) {
  replaceVariables(projectId: $projectId, serviceId: $serviceId, variables: $envs)
}
"""
envs = [
    {"name": "DATABASE_URL", "value": DATABASE_URL},
    {"name": "JWT_SECRET", "value": "xhs_secure_percy_2026"},
    {"name": "CRED_MASTER_KEY", "value": "master_safe_key_999"},
    {"name": "ADMIN_USERNAME", "value": "admin"},
    {"name": "ADMIN_PASSWORD", "value": "xhs888888"},
    {"name": "NODE_ENV", "value": "production"}
]
query_zeabur(update_envs, {"projectId": project_id, "serviceId": service_id, "envs": envs})
print("✅ 环境变量注入成功")

# 5. 重新部署
redeploy = """
mutation($serviceId: ObjectID!) {
  redeployService(_id: $serviceId) {
    _id
  }
}
"""
query_zeabur(redeploy, {"serviceId": service_id})
print("🚀 重新部署已触发")

