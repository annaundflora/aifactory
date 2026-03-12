import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Unit tests for next.config.ts rewrites configuration.
 *
 * Tests are derived from slice-06-nextjs-proxy-config Acceptance Criteria.
 * Mocking Strategy: no_mocks (as per spec).
 *
 * The config reads process.env.ASSISTANT_BACKEND_URL at module level.
 * We use vi.resetModules() + dynamic import to re-evaluate the module
 * with different env values per test.
 */

const CONFIG_PATH = resolve(__dirname, '..', 'next.config.ts')

/**
 * Helper: dynamically import next.config.ts after resetting module cache.
 * This ensures process.env changes are picked up since the env var
 * is read at module-level scope.
 */
async function loadNextConfig(): Promise<any> {
  vi.resetModules()
  const mod = await import('../next.config.ts')
  return mod.default
}

describe('next.config.ts rewrites', () => {
  const savedBackendUrl = process.env.ASSISTANT_BACKEND_URL

  afterEach(() => {
    // Restore original environment after each test
    if (savedBackendUrl !== undefined) {
      process.env.ASSISTANT_BACKEND_URL = savedBackendUrl
    } else {
      delete process.env.ASSISTANT_BACKEND_URL
    }
    vi.resetModules()
  })

  // ---------------------------------------------------------------
  // AC-1: rewrites-Konfiguration vorhanden
  // GIVEN die aktuelle next.config.ts ohne rewrites
  // WHEN der Implementer die rewrites-Konfiguration hinzufuegt
  // THEN enthaelt next.config.ts eine rewrites Funktion die ein Array
  //      mit mindestens einem Eintrag zurueckgibt:
  //      source: "/api/assistant/:path*" ->
  //      destination: "${ASSISTANT_BACKEND_URL}/api/assistant/:path*"
  // ---------------------------------------------------------------
  it('AC-1: should define rewrites with /api/assistant/:path* source', async () => {
    const config = await loadNextConfig()

    // rewrites must be a function
    expect(config.rewrites).toBeDefined()
    expect(typeof config.rewrites).toBe('function')

    // Call the rewrites function to get the rewrite rules
    const rewrites = await config.rewrites()

    // Must be an array with at least one entry
    expect(Array.isArray(rewrites)).toBe(true)
    expect(rewrites.length).toBeGreaterThanOrEqual(1)

    // Find the assistant proxy rule
    const assistantRule = rewrites.find(
      (r: any) => r.source === '/api/assistant/:path*'
    )
    expect(assistantRule).toBeDefined()
    expect(assistantRule.source).toBe('/api/assistant/:path*')

    // Destination must end with /api/assistant/:path*
    expect(assistantRule.destination).toMatch(/\/api\/assistant\/:path\*$/)

    // Destination must NOT have double slashes (except in protocol)
    const urlWithoutProtocol = assistantRule.destination.replace(/^https?:\/\//, '')
    expect(urlWithoutProtocol).not.toContain('//')
  })

  // ---------------------------------------------------------------
  // AC-2: Default Backend-URL wenn env nicht gesetzt
  // GIVEN ASSISTANT_BACKEND_URL ist NICHT gesetzt (kein .env)
  // WHEN Next.js die rewrites-Konfiguration laedt
  // THEN wird der Default-Wert http://localhost:8000 verwendet, sodass
  //      /api/assistant/:path* auf http://localhost:8000/api/assistant/:path* zeigt
  // ---------------------------------------------------------------
  it('AC-2: should use http://localhost:8000 as default backend URL', async () => {
    // Ensure the env var is NOT set
    delete process.env.ASSISTANT_BACKEND_URL

    const config = await loadNextConfig()
    const rewrites = await config.rewrites()

    const assistantRule = rewrites.find(
      (r: any) => r.source === '/api/assistant/:path*'
    )
    expect(assistantRule).toBeDefined()
    expect(assistantRule.destination).toBe(
      'http://localhost:8000/api/assistant/:path*'
    )
  })

  // ---------------------------------------------------------------
  // AC-3: Custom Backend-URL aus Environment-Variable
  // GIVEN ASSISTANT_BACKEND_URL=http://backend.example.com:9000 in .env.local
  // WHEN Next.js die rewrites-Konfiguration laedt
  // THEN wird die custom URL verwendet: /api/assistant/:path* zeigt auf
  //      http://backend.example.com:9000/api/assistant/:path*
  // ---------------------------------------------------------------
  it('AC-3: should use ASSISTANT_BACKEND_URL when set', async () => {
    process.env.ASSISTANT_BACKEND_URL = 'http://backend.example.com:9000'

    const config = await loadNextConfig()
    const rewrites = await config.rewrites()

    const assistantRule = rewrites.find(
      (r: any) => r.source === '/api/assistant/:path*'
    )
    expect(assistantRule).toBeDefined()
    expect(assistantRule.destination).toBe(
      'http://backend.example.com:9000/api/assistant/:path*'
    )
  })

  // ---------------------------------------------------------------
  // AC-6: Bestehende images config unveraendert
  // GIVEN die erweiterte next.config.ts
  // WHEN die bestehende images.remotePatterns Konfiguration inspiziert wird
  // THEN ist sie unveraendert vorhanden (R2-Hostname Pattern bleibt bestehen)
  // ---------------------------------------------------------------
  it('AC-6: should preserve existing images.remotePatterns configuration', async () => {
    const config = await loadNextConfig()

    // images config must exist
    expect(config.images).toBeDefined()
    expect(config.images.remotePatterns).toBeDefined()
    expect(Array.isArray(config.images.remotePatterns)).toBe(true)
    expect(config.images.remotePatterns.length).toBeGreaterThanOrEqual(1)

    // R2 hostname pattern must be present
    const r2Pattern = config.images.remotePatterns.find(
      (p: any) =>
        p.hostname === 'pub-cd07f08bbf5d4226b8f7ef9510aef4bd.r2.dev'
    )
    expect(r2Pattern).toBeDefined()
    expect(r2Pattern.protocol).toBe('https')
  })
})
