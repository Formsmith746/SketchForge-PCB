import type { NextConfig } from "next";

const isDockerBuild = process.env.SKETCHFORGE_DOCKER_BUILD === "true";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: { unoptimized: true },
  experimental: {
    preloadEntriesOnStart: false,
    turbopackMemoryEviction: "full",
  },
  ...(isDockerBuild ? { output: "standalone" as const } : {}),
};

export default nextConfig;
