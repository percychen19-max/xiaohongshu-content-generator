import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 确保构建时不会因为缺少环境变量而失败
  output: "standalone",
  // 优化构建性能
  experimental: {
    optimizePackageImports: ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu"],
  },
};

export default nextConfig;
