import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ---------------------------------------------------------------------------
// Load the JSON file once for all tests -- real file, no mocks
// ---------------------------------------------------------------------------

const JSON_PATH = resolve(__dirname, '..', 'prompt-knowledge.json')

let rawJson: string
let data: Record<string, unknown>

beforeAll(() => {
  rawJson = readFileSync(JSON_PATH, 'utf-8')
  data = JSON.parse(rawJson)
})

// ---------------------------------------------------------------------------
// Helper: rough token estimate (whitespace-split all concatenated strings)
// ---------------------------------------------------------------------------

function collectStrings(obj: unknown): string[] {
  const result: string[] = []
  if (typeof obj === 'string') {
    result.push(obj)
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      result.push(...collectStrings(item))
    }
  } else if (obj !== null && typeof obj === 'object') {
    for (const value of Object.values(obj as Record<string, unknown>)) {
      result.push(...collectStrings(value))
    }
  }
  return result
}

function estimateTokens(obj: unknown): number {
  const allStrings = collectStrings(obj).join(' ')
  return allStrings.split(/\s+/).filter(Boolean).length
}

// ---------------------------------------------------------------------------
// Required model slugs (exact match keys)
// ---------------------------------------------------------------------------

const REQUIRED_SLUGS = [
  'flux-2-pro',
  'flux-2-max',
  'flux-2-klein-4b',
  'flux-schnell',
  'nano-banana-2',
  'gpt-image-1.5',
  'seedream-5',
  'seedream-4.5',
  'stable-diffusion-3.5-large',
  'stable-diffusion-3.5-medium',
  'recraft-v4',
  'ideogram-3',
  'hunyuan-image-3',
] as const

// ---------------------------------------------------------------------------
// Content completeness
// ---------------------------------------------------------------------------

describe('prompt-knowledge.json content completeness', () => {
  it('should contain all required model slugs', () => {
    const models = data.models as Record<string, unknown>
    expect(models).toBeDefined()

    const keys = Object.keys(models)
    expect(keys).toHaveLength(REQUIRED_SLUGS.length)

    for (const slug of REQUIRED_SLUGS) {
      expect(keys, `missing model slug: ${slug}`).toContain(slug)
    }
  })

  it('should have all required fields for every model entry', () => {
    const models = data.models as Record<string, Record<string, unknown>>

    for (const slug of REQUIRED_SLUGS) {
      const entry = models[slug]
      expect(entry, `model "${slug}" should exist`).toBeDefined()

      // displayName: non-empty string
      expect(typeof entry.displayName, `${slug}.displayName type`).toBe('string')
      expect((entry.displayName as string).length, `${slug}.displayName non-empty`).toBeGreaterThan(0)

      // promptStyle: "natural" or "keywords"
      expect(
        ['natural', 'keywords'],
        `${slug}.promptStyle should be "natural" or "keywords"`
      ).toContain(entry.promptStyle)

      // negativePrompts: object with supported (boolean) and note (non-empty string)
      const neg = entry.negativePrompts as Record<string, unknown>
      expect(neg, `${slug}.negativePrompts should be an object`).toBeDefined()
      expect(typeof neg, `${slug}.negativePrompts should be an object`).toBe('object')
      expect(typeof neg.supported, `${slug}.negativePrompts.supported should be boolean`).toBe('boolean')
      expect(typeof neg.note, `${slug}.negativePrompts.note should be string`).toBe('string')
      expect((neg.note as string).length, `${slug}.negativePrompts.note non-empty`).toBeGreaterThan(0)

      // strengths: string[], 2-4 entries
      const strengths = entry.strengths as unknown[]
      expect(Array.isArray(strengths), `${slug}.strengths should be array`).toBe(true)
      expect(strengths.length, `${slug}.strengths count (2-4)`).toBeGreaterThanOrEqual(2)
      expect(strengths.length, `${slug}.strengths count (2-4)`).toBeLessThanOrEqual(4)
      for (const s of strengths) {
        expect(typeof s, `${slug}.strengths items should be strings`).toBe('string')
      }

      // tips: string[], 3-6 entries
      const tips = entry.tips as unknown[]
      expect(Array.isArray(tips), `${slug}.tips should be array`).toBe(true)
      expect(tips.length, `${slug}.tips count (3-6)`).toBeGreaterThanOrEqual(3)
      expect(tips.length, `${slug}.tips count (3-6)`).toBeLessThanOrEqual(6)
      for (const t of tips) {
        expect(typeof t, `${slug}.tips items should be strings`).toBe('string')
      }

      // avoid: string[], 2-4 entries
      const avoid = entry.avoid as unknown[]
      expect(Array.isArray(avoid), `${slug}.avoid should be array`).toBe(true)
      expect(avoid.length, `${slug}.avoid count (2-4)`).toBeGreaterThanOrEqual(2)
      expect(avoid.length, `${slug}.avoid count (2-4)`).toBeLessThanOrEqual(4)
      for (const a of avoid) {
        expect(typeof a, `${slug}.avoid items should be strings`).toBe('string')
      }
    }
  })

  it('should be valid JSON', () => {
    expect(() => JSON.parse(rawJson)).not.toThrow()
    expect(data).toBeDefined()
    expect(typeof data).toBe('object')
  })

  it('should preserve the fallback section', () => {
    const fallback = data.fallback as Record<string, unknown>
    expect(fallback, 'fallback should exist').toBeDefined()
    expect(typeof fallback).toBe('object')

    expect(fallback.displayName).toBe('Generic')

    const tips = fallback.tips as string[]
    expect(Array.isArray(tips)).toBe(true)
    expect(tips.length).toBeGreaterThanOrEqual(1)

    const avoid = fallback.avoid as string[]
    expect(Array.isArray(avoid)).toBe(true)
    expect(avoid.length).toBeGreaterThanOrEqual(1)

    expect(tips).toContain('Be specific and descriptive in your prompt')
    expect(avoid).toContain('Vague or overly brief prompts')
  })
})

// ---------------------------------------------------------------------------
// Mode coverage
// ---------------------------------------------------------------------------

describe('prompt-knowledge.json mode coverage', () => {
  it.each([
    'flux-2-pro',
    'flux-2-max',
    'flux-2-klein-4b',
    'nano-banana-2',
    'seedream-5',
    'seedream-4.5',
  ])('should have txt2img and img2img modes for %s', (slug) => {
    const models = data.models as Record<string, Record<string, unknown>>
    const modes = models[slug].modes as Record<string, Record<string, unknown>>

    expect(modes, `${slug} should have modes`).toBeDefined()

    const txt2img = modes.txt2img
    expect(txt2img, `${slug} should have txt2img mode`).toBeDefined()
    const txt2imgTips = txt2img.tips as unknown[]
    expect(Array.isArray(txt2imgTips), `${slug} txt2img.tips should be array`).toBe(true)
    expect(txt2imgTips.length, `${slug} txt2img.tips count (2-4)`).toBeGreaterThanOrEqual(2)
    expect(txt2imgTips.length, `${slug} txt2img.tips count (2-4)`).toBeLessThanOrEqual(4)

    const img2img = modes.img2img
    expect(img2img, `${slug} should have img2img mode`).toBeDefined()
    const img2imgTips = img2img.tips as unknown[]
    expect(Array.isArray(img2imgTips), `${slug} img2img.tips should be array`).toBe(true)
    expect(img2imgTips.length, `${slug} img2img.tips count (2-4)`).toBeGreaterThanOrEqual(2)
    expect(img2imgTips.length, `${slug} img2img.tips count (2-4)`).toBeLessThanOrEqual(4)
  })
})

// ---------------------------------------------------------------------------
// Token budget
// ---------------------------------------------------------------------------

describe('prompt-knowledge.json token budget', () => {
  it('should keep each model section under 250 tokens', () => {
    const models = data.models as Record<string, unknown>

    for (const slug of REQUIRED_SLUGS) {
      const entry = models[slug]
      const tokenCount = estimateTokens(entry)
      expect(
        tokenCount,
        `${slug} has ${tokenCount} tokens, must be under 250`
      ).toBeLessThan(250)
    }
  })
})

// ---------------------------------------------------------------------------
// Factual correctness
// ---------------------------------------------------------------------------

describe('prompt-knowledge.json factual correctness', () => {
  it('should set promptStyle to natural for flux-2-pro and flux-schnell', () => {
    const models = data.models as Record<string, Record<string, unknown>>

    expect(models['flux-2-pro'].promptStyle).toBe('natural')
    expect(models['flux-schnell'].promptStyle).toBe('natural')
  })

  it('should set negativePrompts.supported to true for stable-diffusion-3.5-large', () => {
    const models = data.models as Record<string, Record<string, unknown>>
    const neg = models['stable-diffusion-3.5-large'].negativePrompts as Record<string, unknown>

    expect(neg.supported).toBe(true)
  })

  it('should set negativePrompts.supported to false for flux-2-pro', () => {
    const models = data.models as Record<string, Record<string, unknown>>
    const neg = models['flux-2-pro'].negativePrompts as Record<string, unknown>

    expect(neg.supported).toBe(false)
  })
})
