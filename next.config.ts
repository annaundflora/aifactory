import type { NextConfig } from "next";

const ASSISTANT_BACKEND_URL =
  process.env.ASSISTANT_BACKEND_URL || "http://localhost:8000";

const ContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://pub-cd07f08bbf5d4226b8f7ef9510aef4bd.r2.dev https://*.replicate.delivery https://replicate.delivery",
  "font-src 'self'",
  "connect-src 'self' https://api.replicate.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Content-Security-Policy",
    value: ContentSecurityPolicy,
  },
];

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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
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
