# 使用官方 Node.js 运行时作为基础镜像
# 说明：Prisma 在 Alpine(musl) 上经常会遇到 OpenSSL 兼容问题（如缺 libssl.so.1.1）。
# 为了在 Zeabur 上稳定运行，这里改用 Debian slim（glibc），避免 musl/openssl 版本坑。
FROM node:20-bookworm-slim AS base

# 安装依赖阶段
FROM base AS deps
WORKDIR /app

# Prisma/Node HTTPS 依赖 OpenSSL 与 CA 证书
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# 复制 package 文件
COPY package.json package-lock.json* ./
# 安装依赖（包括 devDependencies，因为构建时需要 prisma）
RUN npm ci --include=dev

# 复制 prisma schema（用于 postinstall，但我们已经移除了 postinstall）
# 为了保险，先复制 prisma 目录
COPY prisma ./prisma

# 构建阶段
FROM base AS builder
WORKDIR /app

# 构建阶段也需要 OpenSSL（Next build 期间可能会加载 Prisma 引擎）
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 生成 Prisma Client（使用项目本地的 prisma）
RUN ./node_modules/.bin/prisma generate --schema=./prisma/schema.prisma

# 构建 Next.js 应用
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# 运行阶段
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# 安装 OpenSSL（Prisma 需要）
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# 安装指定版本的 Prisma CLI（关键：必须使用 5.22.0，不能使用 7.x）
RUN npm install -g prisma@5.22.0

# 设置库路径
ENV LD_LIBRARY_PATH=/usr/lib:/lib:$LD_LIBRARY_PATH

# 创建非 root 用户
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 --gid 1001 nextjs

# 复制必要的文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# 设置权限
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# 启动脚本：运行数据库迁移并启动应用
# 使用全局安装的 prisma@5.22.0
CMD ["sh", "-c", "prisma migrate deploy --schema=./prisma/schema.prisma && node server.js"]

