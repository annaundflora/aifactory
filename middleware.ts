import { auth } from "@/auth";
import { NextResponse } from "next/server";

/**
 * Next.js Middleware for route protection.
 *
 * Uses Auth.js v5 `auth` wrapper to check session status.
 * Unauthenticated requests to protected routes are redirected to /login (HTTP 302).
 *
 * Public routes (login, auth API, static assets, favicon) are excluded via the
 * `config.matcher` below so this middleware function never runs for them.
 */
export default auth((req) => {
  // If no session exists, redirect to /login
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated — allow request through
  return NextResponse.next();
});

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
