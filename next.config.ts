import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 启用standalone模式用于Docker部署
  output: "standalone",

  // 保持原生模块不被tree-shake，用于Docker部署
  serverExternalPackages: ["ali-oss", "bullmq", "ioredis", "pg", "@prisma/client", "@prisma/adapter-pg"],

  // 图片域名配置（如果有的话）
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.aliyuncs.com",
      },
    ],
  },

  // 实验性功能
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
