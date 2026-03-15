import type { NextConfig } from "next";

const ASSISTANT_BACKEND_URL =
  process.env.ASSISTANT_BACKEND_URL || "http://localhost:8000";

const isDev = process.env.NODE_ENV === "development";

const ContentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-inline' required: Next.js injects inline scripts, and layout.tsx uses
  // dangerouslySetInnerHTML for theme-flash-prevention script.
  // 'unsafe-eval' required in dev only: Turbopack HMR uses eval() for hot reload.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://pub-cd07f08bbf5d4226b8f7ef9510aef4bd.r2.dev https://*.replicate.delivery https://replicate.delivery https://*.googleusercontent.com",
  "font-src 'self'",
  "connect-src 'self' blob: https://api.replicate.com https://pub-cd07f08bbf5d4226b8f7ef9510aef4bd.r2.dev https://*.replicate.delivery https://replicate.delivery",
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
  output: "standalone",
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
