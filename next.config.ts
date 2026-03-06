import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-cd07f08bbf5d4226b8f7ef9510aef4bd.r2.dev",
      },
    ],
  },
};

export default nextConfig;
