import { describe, it, expect, afterEach, vi } from 'vitest'

/**
 * Tests for next.config.ts — View Transition Flag (Slice 06).
 *
 * Validates that the Next.js config enables the experimental viewTransition
 * flag alongside the existing images and rewrites configurations.
 */

/**
 * Helper: dynamically import next.config.ts after resetting module cache.
 * This ensures we get a fresh evaluation of the config module.
 */
async function loadNextConfig(): Promise<any> {
  vi.resetModules()
  const mod = await import('../next.config.ts')
  return mod.default
}

describe('next.config.ts — View Transition Flag', () => {
  afterEach(() => {
    vi.resetModules()
  })

  /**
   * AC-1: GIVEN die Datei next.config.ts
   *       WHEN die Config geprueft wird
   *       THEN enthaelt sie experimental: { viewTransition: true }
   *            neben den bestehenden images und rewrites Konfigurationen
   */
  it('AC-1: should have experimental.viewTransition set to true in next config', async () => {
    const config = await loadNextConfig()

    // experimental object must exist
    expect(config.experimental).toBeDefined()
    expect(config.experimental.viewTransition).toBe(true)

    // Existing images config must still be present
    expect(config.images).toBeDefined()
    expect(config.images.remotePatterns).toBeDefined()
    expect(Array.isArray(config.images.remotePatterns)).toBe(true)
    expect(config.images.remotePatterns.length).toBeGreaterThanOrEqual(1)

    // Existing rewrites config must still be present
    expect(config.rewrites).toBeDefined()
    expect(typeof config.rewrites).toBe('function')

    const rewrites = await config.rewrites()
    expect(Array.isArray(rewrites)).toBe(true)
    expect(rewrites.length).toBeGreaterThanOrEqual(1)
  })
})
