/**
 * Unit & Acceptance Tests for Prompt Knowledge Lookup Service
 * Slice: slice-02-ts-lookup
 *
 * Mocking Strategy: mock_external
 *   - JSON file (data/prompt-knowledge.json) is mocked via vi.mock('fs')
 *   - The module-level cache is reset between tests via vi.resetModules()
 *
 * Tests exact-match slug lookup (no prefix matching).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock data -- provides controlled prompt-knowledge.json content
// ---------------------------------------------------------------------------

const MOCK_KNOWLEDGE_JSON = JSON.stringify({
  models: {
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
        img2img: {
          tips: ['Describe desired changes'],
        },
      },
    },
    'flux-2-max': {
      displayName: 'Flux 2 Max',
      promptStyle: 'natural',
      negativePrompts: { supported: false, note: 'No negative prompts.' },
      strengths: ['Fast rendering'],
      tips: ['Use natural language', 'Be descriptive'],
      avoid: ['Keyword lists'],
    },
    'flux-schnell': {
      displayName: 'Flux Schnell',
      promptStyle: 'natural',
      negativePrompts: { supported: false, note: 'No neg prompts.' },
      strengths: ['Very fast'],
      tips: ['Keep prompts concise'],
      avoid: ['Complex scenes'],
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
  it('should match exact slug', async () => {
    const { getPromptKnowledge } = await freshImport()

    const result = getPromptKnowledge('flux-2-pro')

    expect(result.kind).toBe('model')
    expect(result.displayName).toBe('Flux 2 Pro')
    const modelResult = result as PromptKnowledgeModelResult
    expect(modelResult.model.tips).toContain('Describe scenes in detail')
  })

  it('should NOT match partial slug (no prefix matching)', async () => {
    const { getPromptKnowledge } = await freshImport()

    // "flux-2-pro-ultra" is NOT an exact match for "flux-2-pro"
    const result = getPromptKnowledge('flux-2-pro-ultra')

    expect(result.kind).toBe('fallback')
    expect(result.displayName).toBe('Generic')
  })

  it('should return fallback for unknown model ID', async () => {
    const { getPromptKnowledge } = await freshImport()

    const result = getPromptKnowledge('unknown-model-xyz')

    expect(result.kind).toBe('fallback')
    expect(result.displayName).toBe('Generic')
    const fallbackResult = result as PromptKnowledgeFallbackResult
    expect(fallbackResult.fallback.tips).toContain('Be specific')
    expect(fallbackResult.fallback.avoid).toContain('Vague prompts')
  })

  it('should include txt2img mode tips when mode is txt2img', async () => {
    const { getPromptKnowledge } = await freshImport()

    const result = getPromptKnowledge('flux-2-pro', 'txt2img')

    expect(result.kind).toBe('model')
    const modelResult = result as PromptKnowledgeModelResult

    expect(modelResult.model.tips).toContain('Describe scenes in detail')
    expect(modelResult.mode).toBeDefined()
    expect(modelResult.mode!.tips).toContain('Layer environment and mood')
  })

  it('should return model tips only when requested mode section is missing', async () => {
    const { getPromptKnowledge } = await freshImport()

    // "flux-schnell" has no modes in our mock data
    const result = getPromptKnowledge('flux-schnell', 'img2img')

    expect(result.kind).toBe('model')
    expect(result.displayName).toBe('Flux Schnell')
    const modelResult = result as PromptKnowledgeModelResult
    expect(modelResult.model.tips).toContain('Keep prompts concise')
    expect(modelResult.mode).toBeUndefined()
  })

  it('should return model tips only when mode is undefined', async () => {
    const { getPromptKnowledge } = await freshImport()

    const result = getPromptKnowledge('flux-2-max')

    expect(result.kind).toBe('model')
    const modelResult = result as PromptKnowledgeModelResult
    expect(modelResult.model.tips.length).toBeGreaterThan(0)
    expect(modelResult.mode).toBeUndefined()
  })

  it('should strip owner prefix before matching', async () => {
    const { getPromptKnowledge } = await freshImport()

    const result = getPromptKnowledge('black-forest-labs/flux-2-pro')

    expect(result.kind).toBe('model')
    expect(result.displayName).toBe('Flux 2 Pro')
  })

  it('should handle model ID without slash', async () => {
    const { getPromptKnowledge } = await freshImport()

    const withSlash = getPromptKnowledge('owner/flux-2-pro')
    const withoutSlash = getPromptKnowledge('flux-2-pro')

    expect(withoutSlash.kind).toBe(withSlash.kind)
    expect(withoutSlash.displayName).toBe(withSlash.displayName)
    expect(withoutSlash.displayName).toBe('Flux 2 Pro')
  })

  it('should not reload JSON file on subsequent calls', async () => {
    const { getPromptKnowledge } = await freshImport()

    const fs = await import('fs')
    const mockReadFileSync = vi.mocked(fs.readFileSync)
    mockReadFileSync.mockClear()

    getPromptKnowledge('flux-2-pro')
    const callsAfterFirst = mockReadFileSync.mock.calls.length

    getPromptKnowledge('flux-2-pro')
    const callsAfterSecond = mockReadFileSync.mock.calls.length

    expect(callsAfterFirst).toBeLessThanOrEqual(1)
    expect(callsAfterSecond).toBe(callsAfterFirst)
  })

  it('should match each slug independently', async () => {
    const { getPromptKnowledge } = await freshImport()

    const pro = getPromptKnowledge('flux-2-pro')
    const max = getPromptKnowledge('flux-2-max')
    const schnell = getPromptKnowledge('flux-schnell')

    expect(pro.displayName).toBe('Flux 2 Pro')
    expect(max.displayName).toBe('Flux 2 Max')
    expect(schnell.displayName).toBe('Flux Schnell')
  })
})

// ---------------------------------------------------------------------------
// Tests: formatKnowledgeForPrompt
// ---------------------------------------------------------------------------

describe('formatKnowledgeForPrompt', () => {
  it('should return non-empty string for valid lookup result', async () => {
    const { getPromptKnowledge, formatKnowledgeForPrompt } = await freshImport()

    const modelResult = getPromptKnowledge('flux-2-pro')
    const modelFormatted = formatKnowledgeForPrompt(modelResult)
    expect(typeof modelFormatted).toBe('string')
    expect(modelFormatted.length).toBeGreaterThan(0)

    const fallbackResult = getPromptKnowledge('unknown-model-xyz')
    const fallbackFormatted = formatKnowledgeForPrompt(fallbackResult)
    expect(typeof fallbackFormatted).toBe('string')
    expect(fallbackFormatted.length).toBeGreaterThan(0)
  })

  it('should include both model tips and mode tips in formatted output', async () => {
    const { getPromptKnowledge, formatKnowledgeForPrompt } = await freshImport()

    const result = getPromptKnowledge('flux-2-pro', 'txt2img')
    const formatted = formatKnowledgeForPrompt(result)

    expect(formatted).toContain('Describe scenes in detail')
    expect(formatted).toContain('Layer environment and mood')
    expect(formatted).toContain('Tips')
  })
})
