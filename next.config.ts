import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  allowedDevOrigins: ["tfnq3t4e1e63.share.zrok.io"],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};
export default nextConfig;
