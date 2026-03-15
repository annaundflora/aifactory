import type { NextConfig } from "next";

const ASSISTANT_BACKEND_URL =
  process.env.ASSISTANT_BACKEND_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-cd07f08bbf5d4226b8f7ef9510aef4bd.r2.dev",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/assistant/:path*",
        destination: `${ASSISTANT_BACKEND_URL}/api/assistant/:path*`,
      },
    ];
  },
};

export default nextConfig;
