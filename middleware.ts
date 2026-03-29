import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js Middleware for route protection.
 *
 * Checks for the Auth.js session cookie to gate access. Middleware runs in
 * Edge runtime where postgres-js (TCP) is unavailable, so we cannot call
 * `auth()` here. The cookie check acts as a fast gate; actual session
 * validation happens in server components / route handlers (Node.js runtime).
 *
 * Public routes (login, auth API, static assets, favicon) are excluded via the
 * `config.matcher` below so this middleware function never runs for them.
 */
export function middleware(req: NextRequest) {
  // Dev mode: skip auth entirely when AUTH_DISABLED is set
  if (process.env.AUTH_DISABLED === "true") {
    return NextResponse.next();
  }

  // Auth.js v5 sets "authjs.session-token" (HTTP) or
  // "__Secure-authjs.session-token" (HTTPS).
  const hasSession =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token");

  if (!hasSession) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Session cookie present — allow request through
  return NextResponse.next();
}

/**
 * Matcher configuration.
 *
 * This negative-lookahead pattern ensures the middleware only runs on routes
 * that are NOT in the public allowlist:
 * - /login           — Login page (must be accessible without auth)
 * - /api/auth/:path* — Auth.js route handler (OAuth callbacks, session endpoint)
 * - /_next/:path*    — Next.js static assets and chunks
 * - /favicon.ico     — Browser favicon request
 */
export const config = {
  matcher: [
    "/((?!login|api/auth|_next|favicon\\.ico).*)",
  ],
};
