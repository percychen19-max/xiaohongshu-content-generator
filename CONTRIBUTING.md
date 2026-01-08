# 贡献指南

感谢您对项目的关注！我们欢迎所有形式的贡献。

## 如何贡献

### 报告问题

如果您发现了 bug 或有功能建议，请：

1. 检查 [Issues](https://github.com/your-username/xiaohongshu-content-generator/issues) 中是否已有相关问题
2. 如果没有，请创建新的 Issue，并包含：
   - 清晰的问题描述
   - 复现步骤
   - 预期行为和实际行为
   - 环境信息（Node.js 版本、操作系统等）

### 提交代码

1. **Fork 仓库**

2. **创建特性分支**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **编写代码**
   - 遵循项目的代码风格
   - 添加必要的注释
   - 确保代码通过 ESLint 检查

4. **提交更改**
   ```bash
   git commit -m "feat: 添加新功能描述"
   ```
   
   提交信息格式：
   - `feat:` 新功能
   - `fix:` Bug 修复
   - `docs:` 文档更新
   - `style:` 代码格式调整
   - `refactor:` 代码重构
   - `test:` 测试相关
   - `chore:` 构建/工具相关

5. **推送到分支**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **创建 Pull Request**
   - 填写清晰的 PR 描述
   - 说明更改的内容和原因
   - 关联相关的 Issue（如果有）

## 代码规范

- 使用 TypeScript
- 遵循 ESLint 规则
- 使用 Prettier 格式化代码
- 组件使用函数式组件和 Hooks
- API 路由使用 Next.js App Router 规范

## 开发环境设置

1. Fork 并克隆仓库
2. 安装依赖：`npm install`
3. 配置环境变量：复制 `.env.example` 为 `.env.local`
4. 初始化数据库：`npx prisma migrate dev`
5. 启动开发服务器：`npm run dev`

## 测试

在提交 PR 之前，请确保：

- [ ] 代码通过 ESLint 检查
- [ ] 功能在本地测试通过
- [ ] 没有破坏现有功能
- [ ] 添加了必要的注释和文档

## 问题反馈

如果您在贡献过程中遇到任何问题，请随时：

- 创建 Issue
- 联系维护者

感谢您的贡献！🎉

