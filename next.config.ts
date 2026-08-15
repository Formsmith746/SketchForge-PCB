import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: { unoptimized: true },
  experimental: {
    preloadEntriesOnStart: false,
    turbopackMemoryEviction: "full",
  },
};

export default nextConfig;
