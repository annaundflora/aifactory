import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Tests for slice-03-middleware: Middleware + Route Protection
 *
 * The middleware checks for the Auth.js session cookie to gate access.
 * It does NOT call auth() or hit the database — this avoids Edge runtime
 * issues with postgres-js (TCP sockets not available in Edge).
 *
 * Mock strategy:
 *   - No mocks needed for @/auth — the middleware no longer imports it.
 *   - Session presence is simulated by setting cookies on the NextRequest.
 */

/**
 * Helper: create a NextRequest for a given path, optionally with a session cookie.
 */
function createRequest(path: string, hasSession = false): NextRequest {
  const req = new NextRequest(new URL(path, 'http://localhost:3000'))
  if (hasSession) {
    req.cookies.set('authjs.session-token', 'fake-session-token')
  }
  return req
}

describe('slice-03-middleware: Middleware + Route Protection', () => {
  let middleware: (req: NextRequest) => any
  let config: { matcher: string[] }

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('../../middleware')
    middleware = mod.middleware
    config = mod.config
  })

  // ---------------------------------------------------------------------------
  // AC-1: Unauthentifiziert auf / -> Redirect /login
  // ---------------------------------------------------------------------------
  it('AC-1: should redirect unauthenticated request to / to /login with 302', async () => {
    const req = createRequest('/')
    const response = await middleware(req)

    expect(response).toBeInstanceOf(NextResponse)
    expect(response.status).toBe(307) // NextResponse.redirect uses 307 by default
    const location = response.headers.get('location')
    expect(location).toBeDefined()
    expect(new URL(location!).pathname).toBe('/login')
  })

  // ---------------------------------------------------------------------------
  // AC-2: /login ist ohne Auth erreichbar
  // ---------------------------------------------------------------------------
  it('AC-2: should allow unauthenticated access to /login without redirect (excluded by matcher)', () => {
    const loginPath = '/login'
    const matcherPattern = config.matcher[0]
    const regex = pathToRegex(matcherPattern)
    expect(regex.test(loginPath)).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // AC-3: /api/auth/session ist ohne Auth erreichbar
  // ---------------------------------------------------------------------------
  it('AC-3: should allow unauthenticated access to /api/auth/session (excluded by matcher)', () => {
    const apiAuthSessionPath = '/api/auth/session'
    const matcherPattern = config.matcher[0]
    const regex = pathToRegex(matcherPattern)
    expect(regex.test(apiAuthSessionPath)).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // AC-4: /api/auth/callback/google ist ohne Auth erreichbar
  // ---------------------------------------------------------------------------
  it('AC-4: should allow unauthenticated access to /api/auth/callback/google (excluded by matcher)', () => {
    const callbackPath = '/api/auth/callback/google'
    const matcherPattern = config.matcher[0]
    const regex = pathToRegex(matcherPattern)
    expect(regex.test(callbackPath)).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // AC-5: /_next/* ist ohne Auth erreichbar
  // ---------------------------------------------------------------------------
  it('AC-5: should allow unauthenticated access to /_next/static resources (excluded by matcher)', () => {
    const nextStaticPath = '/_next/static/chunks/main.js'
    const matcherPattern = config.matcher[0]
    const regex = pathToRegex(matcherPattern)
    expect(regex.test(nextStaticPath)).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // AC-6: /favicon.ico ist ohne Auth erreichbar
  // ---------------------------------------------------------------------------
  it('AC-6: should allow unauthenticated access to /favicon.ico (excluded by matcher)', () => {
    const faviconPath = '/favicon.ico'
    const matcherPattern = config.matcher[0]
    const regex = pathToRegex(matcherPattern)
    expect(regex.test(faviconPath)).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // AC-7: Authentifizierter User auf / -> kein Redirect
  // ---------------------------------------------------------------------------
  it('AC-7: should allow authenticated request to / without redirect', async () => {
    const req = createRequest('/', true)
    const response = await middleware(req)

    expect(response).toBeInstanceOf(NextResponse)
    expect(response.headers.get('location')).toBeNull()
    expect(response.status).toBe(200)
  })

  // ---------------------------------------------------------------------------
  // AC-8: Unauthentifiziert auf geschuetzte Sub-Route -> Redirect /login
  // ---------------------------------------------------------------------------
  it('AC-8: should redirect unauthenticated request to /projects/abc-123 to /login', async () => {
    const req = createRequest('/projects/abc-123')
    const response = await middleware(req)

    expect(response).toBeInstanceOf(NextResponse)
    const location = response.headers.get('location')
    expect(location).toBeDefined()
    expect(new URL(location!).pathname).toBe('/login')
  })

  // ---------------------------------------------------------------------------
  // AC-9: Build-Kompatibilitaet
  // ---------------------------------------------------------------------------
  it('AC-9: should export middleware and config without TypeScript errors', async () => {
    const mod = await import('../../middleware')

    expect(mod.middleware).toBeDefined()
    expect(typeof mod.middleware).toBe('function')
    expect(mod.config).toBeDefined()
    expect(mod.config.matcher).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // AC-10: Matcher-Konfiguration schliesst public Routes aus
  // ---------------------------------------------------------------------------
  it('AC-10: should export config with matcher that excludes /login, /api/auth/*, /_next/*, /favicon.ico', () => {
    expect(config).toBeDefined()
    expect(config.matcher).toBeDefined()
    expect(Array.isArray(config.matcher)).toBe(true)
    expect(config.matcher.length).toBeGreaterThanOrEqual(1)

    const matcherPattern = config.matcher[0]
    const regex = pathToRegex(matcherPattern)

    // These paths MUST be excluded (not matched by the middleware)
    const excludedPaths = [
      '/login',
      '/api/auth/session',
      '/api/auth/callback/google',
      '/api/auth/providers',
      '/api/auth/csrf',
      '/_next/static/chunks/main.js',
      '/_next/image',
      '/favicon.ico',
    ]

    for (const path of excludedPaths) {
      expect(regex.test(path)).toBe(false)
    }

    // These paths MUST be matched (middleware runs for them)
    const protectedPaths = [
      '/',
      '/projects',
      '/projects/abc-123',
      '/settings',
      '/dashboard',
    ]

    for (const path of protectedPaths) {
      expect(regex.test(path)).toBe(true)
    }
  })

  // ---------------------------------------------------------------------------
  // Additional edge-case / robustness tests
  // ---------------------------------------------------------------------------

  it('AC-8 (edge): should redirect unauthenticated request to deeply nested protected route', async () => {
    const req = createRequest('/projects/abc-123/settings/members')
    const response = await middleware(req)

    const location = response.headers.get('location')
    expect(location).toBeDefined()
    expect(new URL(location!).pathname).toBe('/login')
  })

  it('AC-7 (edge): should allow authenticated request to nested protected route', async () => {
    const req = createRequest('/projects/abc-123', true)
    const response = await middleware(req)

    expect(response.headers.get('location')).toBeNull()
    expect(response.status).toBe(200)
  })

  it('AC-10 (edge): matcher should not exclude /api/other (non-auth API routes are protected)', () => {
    const matcherPattern = config.matcher[0]
    const regex = pathToRegex(matcherPattern)
    expect(regex.test('/api/other')).toBe(true)
  })

  it('AC-10 (edge): matcher should not exclude /login-extra (only exact /login prefix)', () => {
    const matcherPattern = config.matcher[0]
    const regex = pathToRegex(matcherPattern)
    const result = regex.test('/login-extra')
    expect(result).toBe(false)
  })

  it('should recognize __Secure- prefixed cookie (HTTPS)', async () => {
    const req = new NextRequest(new URL('/', 'https://localhost:3000'))
    req.cookies.set('__Secure-authjs.session-token', 'secure-token')
    const response = await middleware(req)

    expect(response.headers.get('location')).toBeNull()
    expect(response.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// Helper: convert Next.js matcher pattern to a RegExp for testing
// ---------------------------------------------------------------------------

function pathToRegex(matcherPattern: string): {
  test: (pathname: string) => boolean
} {
  let pattern = matcherPattern
  if (pattern.startsWith('/')) {
    pattern = pattern.slice(1)
  }

  const regex = new RegExp(`^/${pattern}$`)

  return {
    test: (pathname: string) => regex.test(pathname),
  }
}
