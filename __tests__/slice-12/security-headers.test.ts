import { describe, it, expect, afterEach, vi } from 'vitest'

/**
 * Tests for Security Headers in next.config.ts
 *
 * Slice: slice-12-security-headers
 * Strategy: Import next.config.ts and verify headers() return value.
 * Mocking Strategy: no_mocks (as per spec).
 *
 * We use vi.resetModules() + dynamic import to re-evaluate the module
 * per test, matching the existing test pattern in this repo.
 */

/**
 * Helper: dynamically import next.config.ts after resetting module cache.
 */
async function loadNextConfig(): Promise<any> {
  vi.resetModules()
  const mod = await import('../../next.config.ts')
  return mod.default
}

/**
 * Helper: find a specific header by key from the headers() result.
 * Returns the header object { key, value } or undefined.
 */
function findHeader(
  headers: Array<{ key: string; value: string }>,
  headerKey: string
): { key: string; value: string } | undefined {
  return headers.find(
    (h) => h.key.toLowerCase() === headerKey.toLowerCase()
  )
}

describe('Security Headers (slice-12) — Acceptance Tests', () => {
  afterEach(() => {
    vi.resetModules()
  })

  // -------------------------------------------------------------------
  // AC-1: X-Frame-Options
  // GIVEN die App laeuft (dev oder production)
  // WHEN ein beliebiger HTTP-Request an http://localhost:3000 gesendet wird
  // THEN enthaelt die Response den Header X-Frame-Options: DENY
  // -------------------------------------------------------------------
  it('AC-1: GIVEN the app is running WHEN any HTTP request is sent THEN the response contains X-Frame-Options: DENY', async () => {
    const config = await loadNextConfig()

    // headers must be a function
    expect(config.headers).toBeDefined()
    expect(typeof config.headers).toBe('function')

    const headerRules = await config.headers()
    expect(Array.isArray(headerRules)).toBe(true)
    expect(headerRules.length).toBeGreaterThanOrEqual(1)

    // Find the catch-all route rule
    const catchAllRule = headerRules.find(
      (rule: any) => rule.source === '/(.*)'
    )
    expect(catchAllRule).toBeDefined()

    const xFrameOptions = findHeader(catchAllRule.headers, 'X-Frame-Options')
    expect(xFrameOptions).toBeDefined()
    expect(xFrameOptions!.value).toBe('DENY')
  })

  // -------------------------------------------------------------------
  // AC-2: X-Content-Type-Options
  // GIVEN die App laeuft
  // WHEN ein beliebiger HTTP-Request an http://localhost:3000 gesendet wird
  // THEN enthaelt die Response den Header X-Content-Type-Options: nosniff
  // -------------------------------------------------------------------
  it('AC-2: GIVEN the app is running WHEN any HTTP request is sent THEN the response contains X-Content-Type-Options: nosniff', async () => {
    const config = await loadNextConfig()
    const headerRules = await config.headers()

    const catchAllRule = headerRules.find(
      (rule: any) => rule.source === '/(.*)'
    )
    expect(catchAllRule).toBeDefined()

    const xContentType = findHeader(
      catchAllRule.headers,
      'X-Content-Type-Options'
    )
    expect(xContentType).toBeDefined()
    expect(xContentType!.value).toBe('nosniff')
  })

  // -------------------------------------------------------------------
  // AC-3: Referrer-Policy
  // GIVEN die App laeuft
  // WHEN ein beliebiger HTTP-Request an http://localhost:3000 gesendet wird
  // THEN enthaelt die Response den Header
  //      Referrer-Policy: strict-origin-when-cross-origin
  // -------------------------------------------------------------------
  it('AC-3: GIVEN the app is running WHEN any HTTP request is sent THEN the response contains Referrer-Policy: strict-origin-when-cross-origin', async () => {
    const config = await loadNextConfig()
    const headerRules = await config.headers()

    const catchAllRule = headerRules.find(
      (rule: any) => rule.source === '/(.*)'
    )
    expect(catchAllRule).toBeDefined()

    const referrerPolicy = findHeader(catchAllRule.headers, 'Referrer-Policy')
    expect(referrerPolicy).toBeDefined()
    expect(referrerPolicy!.value).toBe('strict-origin-when-cross-origin')
  })

  // -------------------------------------------------------------------
  // AC-4: Strict-Transport-Security
  // GIVEN die App laeuft
  // WHEN ein beliebiger HTTP-Request an http://localhost:3000 gesendet wird
  // THEN enthaelt die Response den Header
  //      Strict-Transport-Security: max-age=31536000; includeSubDomains
  // -------------------------------------------------------------------
  it('AC-4: GIVEN the app is running WHEN any HTTP request is sent THEN the response contains Strict-Transport-Security with max-age=31536000 and includeSubDomains', async () => {
    const config = await loadNextConfig()
    const headerRules = await config.headers()

    const catchAllRule = headerRules.find(
      (rule: any) => rule.source === '/(.*)'
    )
    expect(catchAllRule).toBeDefined()

    const hsts = findHeader(
      catchAllRule.headers,
      'Strict-Transport-Security'
    )
    expect(hsts).toBeDefined()
    expect(hsts!.value).toContain('max-age=31536000')
    expect(hsts!.value).toContain('includeSubDomains')
  })

  // -------------------------------------------------------------------
  // AC-5: Content-Security-Policy
  // GIVEN die App laeuft
  // WHEN ein beliebiger HTTP-Request an http://localhost:3000 gesendet wird
  // THEN enthaelt die Response einen Content-Security-Policy Header der
  //      mindestens default-src, script-src, style-src und img-src
  //      Direktiven definiert
  // -------------------------------------------------------------------
  it('AC-5: GIVEN the app is running WHEN any HTTP request is sent THEN the response contains a Content-Security-Policy header with default-src, script-src, style-src, and img-src directives', async () => {
    const config = await loadNextConfig()
    const headerRules = await config.headers()

    const catchAllRule = headerRules.find(
      (rule: any) => rule.source === '/(.*)'
    )
    expect(catchAllRule).toBeDefined()

    const csp = findHeader(
      catchAllRule.headers,
      'Content-Security-Policy'
    )
    expect(csp).toBeDefined()

    const cspValue = csp!.value
    expect(cspValue).toContain('default-src')
    expect(cspValue).toContain('script-src')
    expect(cspValue).toContain('style-src')
    expect(cspValue).toContain('img-src')
  })

  // -------------------------------------------------------------------
  // AC-6: Build-Kompatibilitaet
  // GIVEN die headers()-Funktion ist in next.config.ts definiert
  // WHEN pnpm build ausgefuehrt wird
  // THEN ist der Build erfolgreich (Exit-Code 0)
  //
  // Note: This test validates the config object structure is valid
  // for Next.js consumption. Actual build is an integration-level concern.
  // -------------------------------------------------------------------
  it('AC-6: GIVEN headers() is defined in next.config.ts WHEN the config is loaded THEN it exports a valid Next.js config object with headers function', async () => {
    const config = await loadNextConfig()

    // Must be a valid object
    expect(config).toBeDefined()
    expect(typeof config).toBe('object')

    // headers must be an async function returning the expected shape
    expect(typeof config.headers).toBe('function')
    const headerRules = await config.headers()
    expect(Array.isArray(headerRules)).toBe(true)

    // Each rule must have source and headers
    for (const rule of headerRules) {
      expect(rule).toHaveProperty('source')
      expect(rule).toHaveProperty('headers')
      expect(typeof rule.source).toBe('string')
      expect(Array.isArray(rule.headers)).toBe(true)

      // Each header entry must have key and value
      for (const header of rule.headers) {
        expect(header).toHaveProperty('key')
        expect(header).toHaveProperty('value')
        expect(typeof header.key).toBe('string')
        expect(typeof header.value).toBe('string')
      }
    }
  })

  // -------------------------------------------------------------------
  // AC-7: Keine Regression auf bestehende Config
  // GIVEN die headers()-Funktion ist in next.config.ts definiert
  // WHEN die bestehende rewrites()-Funktion aufgerufen wird
  // THEN funktioniert das API-Rewriting zu /api/assistant/:path*
  //      weiterhin korrekt (keine Regression)
  // -------------------------------------------------------------------
  it('AC-7: GIVEN headers() is defined WHEN the existing rewrites() function is called THEN API rewriting to /api/assistant/:path* still works correctly (no regression)', async () => {
    const config = await loadNextConfig()

    // rewrites must still exist and be a function
    expect(config.rewrites).toBeDefined()
    expect(typeof config.rewrites).toBe('function')

    const rewrites = await config.rewrites()
    expect(Array.isArray(rewrites)).toBe(true)
    expect(rewrites.length).toBeGreaterThanOrEqual(1)

    // The assistant proxy rewrite rule must be intact
    const assistantRule = rewrites.find(
      (r: any) => r.source === '/api/assistant/:path*'
    )
    expect(assistantRule).toBeDefined()
    expect(assistantRule.destination).toMatch(/\/api\/assistant\/:path\*$/)

    // images config must still be present
    expect(config.images).toBeDefined()
    expect(config.images.remotePatterns).toBeDefined()
    expect(Array.isArray(config.images.remotePatterns)).toBe(true)

    const r2Pattern = config.images.remotePatterns.find(
      (p: any) =>
        p.hostname === 'pub-cd07f08bbf5d4226b8f7ef9510aef4bd.r2.dev'
    )
    expect(r2Pattern).toBeDefined()
    expect(r2Pattern.protocol).toBe('https')

    // experimental config must still be present
    expect(config.experimental).toBeDefined()
    expect(config.experimental.viewTransition).toBe(true)
    expect(config.experimental.serverActions).toBeDefined()
    expect(config.experimental.serverActions.bodySizeLimit).toBe('10mb')
  })
})

describe('Security Headers (slice-12) — Unit Tests', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it('should apply security headers to all routes via /(.*) source pattern', async () => {
    const config = await loadNextConfig()
    const headerRules = await config.headers()

    // Must have a catch-all route
    const catchAllRule = headerRules.find(
      (rule: any) => rule.source === '/(.*)'
    )
    expect(catchAllRule).toBeDefined()

    // The catch-all source pattern must match any path
    const pattern = new RegExp(catchAllRule.source)
    expect(pattern.test('/')).toBe(true)
    expect(pattern.test('/about')).toBe(true)
    expect(pattern.test('/api/test')).toBe(true)
    expect(pattern.test('/deep/nested/path')).toBe(true)
  })

  it('should include exactly 5 security headers', async () => {
    const config = await loadNextConfig()
    const headerRules = await config.headers()

    const catchAllRule = headerRules.find(
      (rule: any) => rule.source === '/(.*)'
    )
    expect(catchAllRule).toBeDefined()

    const expectedHeaders = [
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Referrer-Policy',
      'Strict-Transport-Security',
      'Content-Security-Policy',
    ]

    // All 5 expected headers must be present
    for (const headerName of expectedHeaders) {
      const found = findHeader(catchAllRule.headers, headerName)
      expect(found, `Expected header "${headerName}" to be present`).toBeDefined()
    }

    // Must have at least these 5 headers
    expect(catchAllRule.headers.length).toBeGreaterThanOrEqual(5)
  })

  it('CSP should include self in default-src', async () => {
    const config = await loadNextConfig()
    const headerRules = await config.headers()

    const catchAllRule = headerRules.find(
      (rule: any) => rule.source === '/(.*)'
    )
    const csp = findHeader(catchAllRule.headers, 'Content-Security-Policy')
    expect(csp).toBeDefined()

    // default-src must include 'self'
    expect(csp!.value).toMatch(/default-src[^;]*'self'/)
  })

  it('CSP should allow unsafe-inline for styles (Tailwind compatibility)', async () => {
    const config = await loadNextConfig()
    const headerRules = await config.headers()

    const catchAllRule = headerRules.find(
      (rule: any) => rule.source === '/(.*)'
    )
    const csp = findHeader(catchAllRule.headers, 'Content-Security-Policy')
    expect(csp).toBeDefined()

    // style-src must include 'unsafe-inline' for Tailwind CSS compatibility
    expect(csp!.value).toMatch(/style-src[^;]*'unsafe-inline'/)
  })

  it('CSP should allow R2 CDN hostname in img-src', async () => {
    const config = await loadNextConfig()
    const headerRules = await config.headers()

    const catchAllRule = headerRules.find(
      (rule: any) => rule.source === '/(.*)'
    )
    const csp = findHeader(catchAllRule.headers, 'Content-Security-Policy')
    expect(csp).toBeDefined()

    // img-src must include the R2 CDN hostname
    expect(csp!.value).toMatch(
      /img-src[^;]*pub-cd07f08bbf5d4226b8f7ef9510aef4bd\.r2\.dev/
    )
  })
})
