/**
 * Unit & Acceptance Tests for Prompt Knowledge Lookup Service
 * Slice: slice-02-ts-lookup
 *
 * Mocking Strategy: mock_external
 *   - JSON file (data/prompt-knowledge.json) is mocked via vi.mock('fs')
 *   - The module-level cache is reset between tests via vi.resetModules()
 *
 * ACs covered: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock data -- provides controlled prompt-knowledge.json content
// ---------------------------------------------------------------------------

/**
 * AC-1 requires BOTH "flux-2-pro" and "flux-2" prefixes to verify longest-match.
 * The real JSON only has "flux-2", so we provide test data with both.
 */
const MOCK_KNOWLEDGE_JSON = JSON.stringify({
  models: {
    'flux-2': {
      displayName: 'Flux 2',
      promptStyle: 'natural',
      negativePrompts: { supported: false, note: 'No negative prompts.' },
      strengths: ['Fast rendering'],
      tips: ['Use natural language', 'Be descriptive'],
      avoid: ['Keyword lists'],
      modes: {
        txt2img: {
          tips: ['Start with the subject', 'Specify aspect ratio'],
        },
        img2img: {
          tips: ['Describe desired changes'],
        },
      },
    },
    'flux-2-pro': {
      displayName: 'Flux 2 Pro',
      promptStyle: 'natural',
      negativePrompts: { supported: false, note: 'No negative prompts for Pro.' },
      strengths: ['High quality', 'Fine detail'],
      tips: ['Describe scenes in detail', 'Reference art styles'],
      avoid: ['Short prompts'],
      modes: {
        txt2img: {
          tips: ['Layer environment and mood'],
        },
      },
    },
    'flux-schnell': {
      displayName: 'Flux Schnell',
      promptStyle: 'natural',
      negativePrompts: { supported: false, note: 'No neg prompts.' },
      strengths: ['Very fast'],
      tips: ['Keep prompts concise'],
      avoid: ['Complex scenes'],
      // NOTE: no modes -- used for AC-5
    },
  },
  fallback: {
    displayName: 'Generic',
    tips: ['Be specific', 'Include details about style'],
    avoid: ['Vague prompts'],
  },
})

// ---------------------------------------------------------------------------
// Mock fs.readFileSync so the service reads our mock data instead of disk
// ---------------------------------------------------------------------------

vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue(MOCK_KNOWLEDGE_JSON),
}))

// ---------------------------------------------------------------------------
// Import AFTER mocks are set up
// ---------------------------------------------------------------------------

import { readFileSync } from 'fs'
import type {
  PromptKnowledgeLookupResult,
  PromptKnowledgeModelResult,
  PromptKnowledgeFallbackResult,
} from '../prompt-knowledge'

// ---------------------------------------------------------------------------
// Helper to get a fresh module (clears module-level cache)
// ---------------------------------------------------------------------------

async function freshImport() {
  vi.resetModules()

  // Re-register the fs mock after resetModules clears it
  vi.doMock('fs', () => ({
    readFileSync: vi.fn().mockReturnValue(MOCK_KNOWLEDGE_JSON),
  }))

  const mod = await import('../prompt-knowledge')
  return mod
}

// ---------------------------------------------------------------------------
// Tests: getPromptKnowledge
// ---------------------------------------------------------------------------

describe('getPromptKnowledge', () => {
  // We need a fresh import for each test to reset the module-level cache
  // (except for AC-11 which explicitly tests caching behavior)

  // AC-1: Laengster Prefix gewinnt
  it('should match longest prefix when multiple prefixes match', async () => {
    /**
     * AC-1: GIVEN prompt-knowledge.json enthaelt Prefixe "flux-2-pro" und "flux-2"
     *       WHEN getPromptKnowledge("flux-2-pro-ultra") aufgerufen wird
     *       THEN wird der Eintrag fuer Prefix "flux-2-pro" zurueckgegeben
     *            (laengster Match gewinnt, nicht "flux-2")
     */
    const { getPromptKnowledge } = await freshImport()

    const result = getPromptKnowledge('flux-2-pro-ultra')

    expect(result.kind).toBe('model')
    expect(result.displayName).toBe('Flux 2 Pro')
    // Verify it is NOT the shorter "flux-2" match
    expect(result.displayName).not.toBe('Flux 2')
    const modelResult = result as PromptKnowledgeModelResult
    expect(modelResult.model.tips).toContain('Describe scenes in detail')
  })

  // AC-2: Einfacher Prefix-Match
  it('should match simple prefix for model ID', async () => {
    /**
     * AC-2: GIVEN prompt-knowledge.json enthaelt Prefix "flux-2"
     *       WHEN getPromptKnowledge("flux-2-max") aufgerufen wird
     *       THEN wird der Eintrag fuer Prefix "flux-2" zurueckgegeben
     *            (einfacher Prefix-Match)
     */
    const { getPromptKnowledge } = await freshImport()

    const result = getPromptKnowledge('flux-2-max')

    expect(result.kind).toBe('model')
    expect(result.displayName).toBe('Flux 2')
    const modelResult = result as PromptKnowledgeModelResult
    expect(modelResult.model.tips).toContain('Use natural language')
  })

  // AC-3: Fallback bei unbekanntem Modell
  it('should return fallback for unknown model ID', async () => {
    /**
     * AC-3: GIVEN prompt-knowledge.json enthaelt keinen passenden Prefix fuer "unknown-model-xyz"
     *       WHEN getPromptKnowledge("unknown-model-xyz") aufgerufen wird
     *       THEN wird das fallback-Objekt zurueckgegeben (mit displayName: "Generic")
     */
    const { getPromptKnowledge } = await freshImport()

    const result = getPromptKnowledge('unknown-model-xyz')

    expect(result.kind).toBe('fallback')
    expect(result.displayName).toBe('Generic')
    const fallbackResult = result as PromptKnowledgeFallbackResult
    expect(fallbackResult.fallback.tips).toContain('Be specific')
    expect(fallbackResult.fallback.avoid).toContain('Vague prompts')
  })

  // AC-4: Modus-spezifische Tipps bei txt2img
  it('should include txt2img mode tips when mode is txt2img', async () => {
    /**
     * AC-4: GIVEN ein Modell-Eintrag hat modes.txt2img mit Tipps
     *       WHEN getPromptKnowledge("flux-2-pro", "txt2img") aufgerufen wird
     *       THEN enthaelt das Ergebnis sowohl die allgemeinen Modell-Tipps
     *            als auch die modus-spezifischen txt2img-Tipps
     */
    const { getPromptKnowledge } = await freshImport()

    const result = getPromptKnowledge('flux-2-pro', 'txt2img')

    expect(result.kind).toBe('model')
    const modelResult = result as PromptKnowledgeModelResult

    // General model tips present
    expect(modelResult.model.tips.length).toBeGreaterThan(0)
    expect(modelResult.model.tips).toContain('Describe scenes in detail')

    // Mode-specific tips present
    expect(modelResult.mode).toBeDefined()
    expect(modelResult.mode!.tips).toContain('Layer environment and mood')
  })

  // AC-5: Graceful bei fehlendem Modus-Eintrag
  it('should return model tips only when requested mode section is missing', async () => {
    /**
     * AC-5: GIVEN ein Modell-Eintrag hat KEINE modes.img2img-Sektion
     *       WHEN getPromptKnowledge("some-model", "img2img") aufgerufen wird
     *       THEN enthaelt das Ergebnis nur die allgemeinen Modell-Tipps
     *            (kein Fehler, kein Crash)
     */
    const { getPromptKnowledge } = await freshImport()

    // "flux-schnell" has no modes at all in our mock data
    const result = getPromptKnowledge('flux-schnell', 'img2img')

    expect(result.kind).toBe('model')
    expect(result.displayName).toBe('Flux Schnell')
    const modelResult = result as PromptKnowledgeModelResult

    // General tips present
    expect(modelResult.model.tips.length).toBeGreaterThan(0)
    expect(modelResult.model.tips).toContain('Keep prompts concise')

    // Mode should NOT be set (no crash, no error)
    expect(modelResult.mode).toBeUndefined()
  })

  // AC-6: Kein Modus -> nur allgemeine Tipps
  it('should return model tips only when mode is undefined', async () => {
    /**
     * AC-6: GIVEN getPromptKnowledge wird ohne Modus aufgerufen (mode ist undefined)
     *       WHEN das Ergebnis geprueft wird
     *       THEN enthaelt es nur die allgemeinen Modell-Tipps (keine Modus-Sektion)
     */
    const { getPromptKnowledge } = await freshImport()

    const result = getPromptKnowledge('flux-2')

    expect(result.kind).toBe('model')
    const modelResult = result as PromptKnowledgeModelResult

    // General tips present
    expect(modelResult.model.tips.length).toBeGreaterThan(0)

    // No mode tips (mode param was undefined)
    expect(modelResult.mode).toBeUndefined()
  })

  // AC-7: Slash-Stripping bei owner/model-name
  it('should strip owner prefix before slash from model ID', async () => {
    /**
     * AC-7: GIVEN eine Model-ID im Format owner/model-name
     *            (z.B. "black-forest-labs/flux-2-pro")
     *       WHEN getPromptKnowledge("black-forest-labs/flux-2-pro") aufgerufen wird
     *       THEN wird der Teil vor dem "/" gestrippt und das Prefix-Matching
     *            erfolgt gegen "flux-2-pro"
     */
    const { getPromptKnowledge } = await freshImport()

    const result = getPromptKnowledge('black-forest-labs/flux-2-pro')

    expect(result.kind).toBe('model')
    expect(result.displayName).toBe('Flux 2 Pro')
    const modelResult = result as PromptKnowledgeModelResult
    expect(modelResult.model.tips).toContain('Describe scenes in detail')
  })

  // AC-8: Model-ID ohne Slash funktioniert
  it('should handle model ID without slash', async () => {
    /**
     * AC-8: GIVEN eine Model-ID ohne Slash (z.B. "flux-2-pro")
     *       WHEN getPromptKnowledge("flux-2-pro") aufgerufen wird
     *       THEN funktioniert das Matching identisch wie mit Slash
     *            (kein Crash bei fehlendem Slash)
     */
    const { getPromptKnowledge } = await freshImport()

    const withSlash = getPromptKnowledge('owner/flux-2-pro')
    const withoutSlash = getPromptKnowledge('flux-2-pro')

    // Both should produce the same result
    expect(withoutSlash.kind).toBe(withSlash.kind)
    expect(withoutSlash.displayName).toBe(withSlash.displayName)
    expect(withoutSlash.kind).toBe('model')
    expect(withoutSlash.displayName).toBe('Flux 2 Pro')
  })

  // AC-11: Module-level Cache
  it('should not reload JSON file on subsequent calls', async () => {
    /**
     * AC-11: GIVEN die JSON-Datei wurde bereits einmal geladen
     *        WHEN getPromptKnowledge ein zweites Mal aufgerufen wird
     *        THEN wird die Datei NICHT erneut vom Dateisystem gelesen
     *             (module-level Cache)
     */
    const { getPromptKnowledge } = await freshImport()

    // Import the mocked readFileSync to track calls
    const fs = await import('fs')
    const mockReadFileSync = vi.mocked(fs.readFileSync)
    mockReadFileSync.mockClear()

    // First call -- loads JSON
    getPromptKnowledge('flux-2')
    const callsAfterFirst = mockReadFileSync.mock.calls.length

    // Second call -- should use cache, NOT read again
    getPromptKnowledge('flux-2')
    const callsAfterSecond = mockReadFileSync.mock.calls.length

    // readFileSync should have been called at most once (for the first call)
    // and NOT again for the second call
    expect(callsAfterFirst).toBeLessThanOrEqual(1)
    expect(callsAfterSecond).toBe(callsAfterFirst)
  })
})

// ---------------------------------------------------------------------------
// Tests: formatKnowledgeForPrompt
// ---------------------------------------------------------------------------

describe('formatKnowledgeForPrompt', () => {
  // AC-9: Nicht-leerer String fuer System-Prompt
  it('should return non-empty string for valid lookup result', async () => {
    /**
     * AC-9: GIVEN ein gueltiges Lookup-Ergebnis (Modell oder Fallback)
     *       WHEN formatKnowledgeForPrompt(result) aufgerufen wird
     *       THEN wird ein nicht-leerer String zurueckgegeben,
     *            der fuer System-Prompt-Injection geeignet ist
     */
    const { getPromptKnowledge, formatKnowledgeForPrompt } = await freshImport()

    // Test with a model result
    const modelResult = getPromptKnowledge('flux-2-pro')
    const modelFormatted = formatKnowledgeForPrompt(modelResult)
    expect(typeof modelFormatted).toBe('string')
    expect(modelFormatted.length).toBeGreaterThan(0)

    // Test with a fallback result
    const fallbackResult = getPromptKnowledge('unknown-model-xyz')
    const fallbackFormatted = formatKnowledgeForPrompt(fallbackResult)
    expect(typeof fallbackFormatted).toBe('string')
    expect(fallbackFormatted.length).toBeGreaterThan(0)
  })

  // AC-10: Modell-Tipps und Modus-Tipps im formatierten String
  it('should include both model tips and mode tips in formatted output', async () => {
    /**
     * AC-10: GIVEN ein Lookup-Ergebnis mit Modell-Tipps UND Modus-Tipps
     *        WHEN formatKnowledgeForPrompt(result) aufgerufen wird
     *        THEN enthaelt der String sowohl die allgemeinen Tipps als auch
     *             die Modus-Tipps in lesbarem Format
     */
    const { getPromptKnowledge, formatKnowledgeForPrompt } = await freshImport()

    // Get result with mode-specific tips
    const result = getPromptKnowledge('flux-2', 'txt2img')
    const formatted = formatKnowledgeForPrompt(result)

    // Should contain general model tips
    expect(formatted).toContain('Use natural language')

    // Should contain mode-specific tips
    expect(formatted).toContain('Start with the subject')

    // Should be readable (contains section headers or structure)
    expect(formatted).toContain('Tips')
  })
})
