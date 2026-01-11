import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // 告诉 webpack 在客户端构建时忽略这些 Node.js 专用模块
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "proxy-agent": false,
        "http-proxy-agent": false,
        "https-proxy-agent": false,
        "net": false,
        "tls": false,
        "fs": false,
      };
    }
    return config;
  },
};

export default nextConfig;
