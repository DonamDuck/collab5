import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 브랜드 사진(리사이즈 data URL)을 서버 액션으로 저장 → 기본 1MB보다 여유 필요
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
