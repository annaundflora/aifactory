import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

/**
 * Acceptance tests for slice-06-nextjs-proxy-config
 *
 * Each test maps 1:1 to a GIVEN/WHEN/THEN Acceptance Criterion from the slice spec.
 * Mocking Strategy: no_mocks (as per spec).
 *
 * AC-4 (pnpm build) is a build-time integration test validated via CI.
 * AC-5 (proxy pass-through) requires a running FastAPI backend and is validated manually.
 * Both are included here as structural validations where feasible.
 */

const ROOT = resolve(__dirname, '../..')
const CONFIG_PATH = resolve(ROOT, 'next.config.ts')

/**
 * Helper: dynamically import next.config.ts after resetting module cache.
 */
async function loadNextConfig(): Promise<any> {
  vi.resetModules()
  const mod = await import('../../next.config.ts')
  return mod.default
}

describe('slice-06-nextjs-proxy-config Acceptance', () => {
  const savedBackendUrl = process.env.ASSISTANT_BACKEND_URL

  afterEach(() => {
    if (savedBackendUrl !== undefined) {
      process.env.ASSISTANT_BACKEND_URL = savedBackendUrl
    } else {
      delete process.env.ASSISTANT_BACKEND_URL
    }
    vi.resetModules()
  })

  // ---------------------------------------------------------------
  // AC-1: rewrites-Konfiguration vorhanden
  // ---------------------------------------------------------------
  it('AC-1: GIVEN die aktuelle next.config.ts WHEN der Implementer die rewrites-Konfiguration hinzufuegt THEN enthaelt next.config.ts eine rewrites Funktion die ein Array mit mindestens einem Eintrag zurueckgibt: source "/api/assistant/:path*" -> destination "${ASSISTANT_BACKEND_URL}/api/assistant/:path*"', async () => {
    // Verify config file exists
    expect(existsSync(CONFIG_PATH)).toBe(true)

    // Read the raw source to verify structural properties
    const source = readFileSync(CONFIG_PATH, 'utf-8')

    // Must contain an async rewrites function
    expect(source).toMatch(/async\s+rewrites\s*\(\s*\)/)

    // Must contain the source pattern
    expect(source).toContain('/api/assistant/:path*')

    // Must reference ASSISTANT_BACKEND_URL in destination
    expect(source).toContain('ASSISTANT_BACKEND_URL')

    // Dynamically load and validate the runtime behavior
    const config = await loadNextConfig()
    const rewrites = await config.rewrites()

    expect(rewrites.length).toBeGreaterThanOrEqual(1)

    const rule = rewrites.find((r: any) => r.source === '/api/assistant/:path*')
    expect(rule).toBeDefined()
    expect(rule.destination).toContain('/api/assistant/:path*')
  })

  // ---------------------------------------------------------------
  // AC-2: Default Backend-URL wenn env nicht gesetzt
  // ---------------------------------------------------------------
  it('AC-2: GIVEN ASSISTANT_BACKEND_URL ist NICHT gesetzt WHEN Next.js die rewrites-Konfiguration laedt THEN wird der Default-Wert http://localhost:8000 verwendet', async () => {
    delete process.env.ASSISTANT_BACKEND_URL

    const config = await loadNextConfig()
    const rewrites = await config.rewrites()

    const rule = rewrites.find((r: any) => r.source === '/api/assistant/:path*')
    expect(rule).toBeDefined()
    expect(rule.destination).toBe('http://localhost:8000/api/assistant/:path*')
  })

  // ---------------------------------------------------------------
  // AC-3: Custom Backend-URL aus Environment-Variable
  // ---------------------------------------------------------------
  it('AC-3: GIVEN ASSISTANT_BACKEND_URL=http://backend.example.com:9000 WHEN Next.js die rewrites-Konfiguration laedt THEN wird die custom URL verwendet', async () => {
    process.env.ASSISTANT_BACKEND_URL = 'http://backend.example.com:9000'

    const config = await loadNextConfig()
    const rewrites = await config.rewrites()

    const rule = rewrites.find((r: any) => r.source === '/api/assistant/:path*')
    expect(rule).toBeDefined()
    expect(rule.destination).toBe(
      'http://backend.example.com:9000/api/assistant/:path*'
    )
  })

  // ---------------------------------------------------------------
  // AC-4: Build erfolgreich
  // GIVEN die erweiterte next.config.ts
  // WHEN pnpm build ausgefuehrt wird
  // THEN laeuft der Build erfolgreich durch (Exit-Code 0)
  //
  // Note: Full build validation is a CI concern. Here we validate that
  // the config file is valid TypeScript and structurally sound.
  // ---------------------------------------------------------------
  it('AC-4: GIVEN die erweiterte next.config.ts WHEN die Konfiguration strukturell validiert wird THEN ist sie syntaktisch korrekt und exportiert ein gueltiges NextConfig Objekt', async () => {
    // The config must be importable without errors
    const config = await loadNextConfig()

    // Must be a valid object
    expect(config).toBeDefined()
    expect(typeof config).toBe('object')

    // Must have the required properties
    expect(config.images).toBeDefined()
    expect(typeof config.rewrites).toBe('function')

    // rewrites must return a valid array
    const rewrites = await config.rewrites()
    expect(Array.isArray(rewrites)).toBe(true)

    // Each rewrite entry must have source and destination
    for (const entry of rewrites) {
      expect(entry).toHaveProperty('source')
      expect(entry).toHaveProperty('destination')
      expect(typeof entry.source).toBe('string')
      expect(typeof entry.destination).toBe('string')
    }
  })

  // ---------------------------------------------------------------
  // AC-5: Proxy-Durchleitung (structural validation)
  // GIVEN die erweiterte next.config.ts
  // WHEN ein GET-Request an /api/assistant/health proxied wird
  // THEN wird der Request an http://localhost:8000/api/assistant/health
  //      durchgeleitet
  //
  // Note: Actual proxy pass-through requires running dev server + FastAPI.
  // Here we validate the rewrite rule would correctly map the path.
  // ---------------------------------------------------------------
  it('AC-5: GIVEN die erweiterte next.config.ts WHEN die Proxy-Route fuer /api/assistant/health evaluiert wird THEN mappt die Rewrite-Regel korrekt auf das Backend', async () => {
    delete process.env.ASSISTANT_BACKEND_URL

    const config = await loadNextConfig()
    const rewrites = await config.rewrites()

    const rule = rewrites.find((r: any) => r.source === '/api/assistant/:path*')
    expect(rule).toBeDefined()

    // The source pattern must match /api/assistant/health
    // Next.js :path* is a catch-all, so /api/assistant/:path* matches /api/assistant/health
    expect(rule.source).toBe('/api/assistant/:path*')

    // The destination with default URL must point to localhost:8000
    expect(rule.destination).toBe('http://localhost:8000/api/assistant/:path*')

    // Simulate the path substitution that Next.js would perform:
    // /api/assistant/health -> http://localhost:8000/api/assistant/health
    const simulatedDestination = rule.destination.replace(':path*', 'health')
    expect(simulatedDestination).toBe('http://localhost:8000/api/assistant/health')
  })

  // ---------------------------------------------------------------
  // AC-6: Bestehende images config unveraendert
  // ---------------------------------------------------------------
  it('AC-6: GIVEN die erweiterte next.config.ts WHEN die bestehende images.remotePatterns Konfiguration inspiziert wird THEN ist sie unveraendert vorhanden (R2-Hostname Pattern bleibt bestehen)', async () => {
    const config = await loadNextConfig()

    // images.remotePatterns must exist and be non-empty
    expect(config.images).toBeDefined()
    expect(config.images.remotePatterns).toBeDefined()
    expect(Array.isArray(config.images.remotePatterns)).toBe(true)
    expect(config.images.remotePatterns.length).toBeGreaterThanOrEqual(1)

    // The R2 pattern must be present with correct values
    const r2Pattern = config.images.remotePatterns.find(
      (p: any) =>
        p.hostname === 'pub-cd07f08bbf5d4226b8f7ef9510aef4bd.r2.dev'
    )
    expect(r2Pattern).toBeDefined()
    expect(r2Pattern.protocol).toBe('https')
    expect(r2Pattern.hostname).toBe(
      'pub-cd07f08bbf5d4226b8f7ef9510aef4bd.r2.dev'
    )
  })
})
