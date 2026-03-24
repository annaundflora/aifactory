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
// Required model prefixes (from AC-1)
// ---------------------------------------------------------------------------

const REQUIRED_PREFIXES = [
  'flux-2',
  'flux-schnell',
  'nano-banana',
  'gpt-image',
  'seedream',
  'stable-diffusion',
  'recraft',
  'ideogram',
  'hunyuan',
] as const

// ---------------------------------------------------------------------------
// Content completeness
// ---------------------------------------------------------------------------

describe('prompt-knowledge.json content completeness', () => {
  /**
   * AC-1: GIVEN die Datei `data/prompt-knowledge.json` geladen wird
   *       WHEN die Keys in `models` gezaehlt werden
   *       THEN existieren exakt 9 Eintraege: flux-2, flux-schnell, nano-banana,
   *            gpt-image, seedream, stable-diffusion, recraft, ideogram, hunyuan
   */
  it('should contain exactly 9 model prefixes', () => {
    const models = data.models as Record<string, unknown>
    expect(models).toBeDefined()

    const keys = Object.keys(models)
    expect(keys).toHaveLength(9)

    for (const prefix of REQUIRED_PREFIXES) {
      expect(keys, `missing model prefix: ${prefix}`).toContain(prefix)
    }
  })

  /**
   * AC-2: GIVEN ein beliebiger Modell-Eintrag in `models` (z.B. `models["recraft"]`)
   *       WHEN seine Pflichtfelder geprueft werden
   *       THEN enthaelt er: displayName (non-empty string), promptStyle ("natural"
   *            oder "keywords"), negativePrompts (Objekt mit supported: boolean und
   *            note: non-empty string), strengths (string[], 2-4 Eintraege),
   *            tips (string[], 3-6 Eintraege), avoid (string[], 2-4 Eintraege)
   */
  it('should have all required fields for every model entry', () => {
    const models = data.models as Record<string, Record<string, unknown>>

    for (const prefix of REQUIRED_PREFIXES) {
      const entry = models[prefix]
      expect(entry, `model "${prefix}" should exist`).toBeDefined()

      // displayName: non-empty string
      expect(typeof entry.displayName, `${prefix}.displayName type`).toBe('string')
      expect((entry.displayName as string).length, `${prefix}.displayName non-empty`).toBeGreaterThan(0)

      // promptStyle: "natural" or "keywords"
      expect(
        ['natural', 'keywords'],
        `${prefix}.promptStyle should be "natural" or "keywords"`
      ).toContain(entry.promptStyle)

      // negativePrompts: object with supported (boolean) and note (non-empty string)
      const neg = entry.negativePrompts as Record<string, unknown>
      expect(neg, `${prefix}.negativePrompts should be an object`).toBeDefined()
      expect(typeof neg, `${prefix}.negativePrompts should be an object`).toBe('object')
      expect(typeof neg.supported, `${prefix}.negativePrompts.supported should be boolean`).toBe('boolean')
      expect(typeof neg.note, `${prefix}.negativePrompts.note should be string`).toBe('string')
      expect((neg.note as string).length, `${prefix}.negativePrompts.note non-empty`).toBeGreaterThan(0)

      // strengths: string[], 2-4 entries
      const strengths = entry.strengths as unknown[]
      expect(Array.isArray(strengths), `${prefix}.strengths should be array`).toBe(true)
      expect(strengths.length, `${prefix}.strengths count (2-4)`).toBeGreaterThanOrEqual(2)
      expect(strengths.length, `${prefix}.strengths count (2-4)`).toBeLessThanOrEqual(4)
      for (const s of strengths) {
        expect(typeof s, `${prefix}.strengths items should be strings`).toBe('string')
      }

      // tips: string[], 3-6 entries
      const tips = entry.tips as unknown[]
      expect(Array.isArray(tips), `${prefix}.tips should be array`).toBe(true)
      expect(tips.length, `${prefix}.tips count (3-6)`).toBeGreaterThanOrEqual(3)
      expect(tips.length, `${prefix}.tips count (3-6)`).toBeLessThanOrEqual(6)
      for (const t of tips) {
        expect(typeof t, `${prefix}.tips items should be strings`).toBe('string')
      }

      // avoid: string[], 2-4 entries
      const avoid = entry.avoid as unknown[]
      expect(Array.isArray(avoid), `${prefix}.avoid should be array`).toBe(true)
      expect(avoid.length, `${prefix}.avoid count (2-4)`).toBeGreaterThanOrEqual(2)
      expect(avoid.length, `${prefix}.avoid count (2-4)`).toBeLessThanOrEqual(4)
      for (const a of avoid) {
        expect(typeof a, `${prefix}.avoid items should be strings`).toBe('string')
      }
    }
  })

  /**
   * AC-7: GIVEN die gesamte `data/prompt-knowledge.json` Datei
   *       WHEN ein JSON-Parser sie laedt
   *       THEN ist das Ergebnis valides JSON ohne Parse-Fehler
   */
  it('should be valid JSON', () => {
    expect(() => JSON.parse(rawJson)).not.toThrow()
    expect(data).toBeDefined()
    expect(typeof data).toBe('object')
  })

  /**
   * AC-8: GIVEN der bestehende `fallback`-Eintrag aus Slice 01
   *       WHEN er nach dem Befuellen der Modelle geprueft wird
   *       THEN ist er unveraendert (Slice 01 Inhalt beibehalten)
   */
  it('should preserve the fallback section from slice-01', () => {
    const fallback = data.fallback as Record<string, unknown>
    expect(fallback, 'fallback should exist').toBeDefined()
    expect(typeof fallback).toBe('object')

    // Verify core fallback structure
    expect(fallback.displayName).toBe('Generic')

    const tips = fallback.tips as string[]
    expect(Array.isArray(tips)).toBe(true)
    expect(tips.length).toBeGreaterThanOrEqual(1)

    const avoid = fallback.avoid as string[]
    expect(Array.isArray(avoid)).toBe(true)
    expect(avoid.length).toBeGreaterThanOrEqual(1)

    // Verify specific fallback content is preserved (slice-01 original content)
    expect(tips).toContain('Be specific and descriptive in your prompt')
    expect(avoid).toContain('Vague or overly brief prompts')
  })
})

// ---------------------------------------------------------------------------
// Mode coverage
// ---------------------------------------------------------------------------

describe('prompt-knowledge.json mode coverage', () => {
  /**
   * AC-3: GIVEN der Eintrag `models["flux-2"]`
   *       WHEN das Feld `modes` geprueft wird
   *       THEN enthaelt es `txt2img` mit `tips` (string[], 2-4 Eintraege)
   *            UND `img2img` mit `tips` (string[], 2-4 Eintraege)
   */
  it('should have txt2img and img2img modes for flux-2', () => {
    const models = data.models as Record<string, Record<string, unknown>>
    const modes = models['flux-2'].modes as Record<string, Record<string, unknown>>

    expect(modes, 'flux-2 should have modes').toBeDefined()

    // txt2img
    const txt2img = modes.txt2img
    expect(txt2img, 'flux-2 should have txt2img mode').toBeDefined()
    const txt2imgTips = txt2img.tips as unknown[]
    expect(Array.isArray(txt2imgTips), 'flux-2 txt2img.tips should be array').toBe(true)
    expect(txt2imgTips.length, 'flux-2 txt2img.tips count (2-4)').toBeGreaterThanOrEqual(2)
    expect(txt2imgTips.length, 'flux-2 txt2img.tips count (2-4)').toBeLessThanOrEqual(4)
    for (const t of txt2imgTips) {
      expect(typeof t).toBe('string')
    }

    // img2img
    const img2img = modes.img2img
    expect(img2img, 'flux-2 should have img2img mode').toBeDefined()
    const img2imgTips = img2img.tips as unknown[]
    expect(Array.isArray(img2imgTips), 'flux-2 img2img.tips should be array').toBe(true)
    expect(img2imgTips.length, 'flux-2 img2img.tips count (2-4)').toBeGreaterThanOrEqual(2)
    expect(img2imgTips.length, 'flux-2 img2img.tips count (2-4)').toBeLessThanOrEqual(4)
    for (const t of img2imgTips) {
      expect(typeof t).toBe('string')
    }
  })

  /**
   * AC-4: GIVEN der Eintrag `models["seedream"]`
   *       WHEN das Feld `modes` geprueft wird
   *       THEN enthaelt es `txt2img` mit `tips` (string[], 2-4 Eintraege)
   *            UND `img2img` mit `tips` (string[], 2-4 Eintraege)
   */
  it('should have txt2img and img2img modes for seedream', () => {
    const models = data.models as Record<string, Record<string, unknown>>
    const modes = models['seedream'].modes as Record<string, Record<string, unknown>>

    expect(modes, 'seedream should have modes').toBeDefined()

    // txt2img
    const txt2img = modes.txt2img
    expect(txt2img, 'seedream should have txt2img mode').toBeDefined()
    const txt2imgTips = txt2img.tips as unknown[]
    expect(Array.isArray(txt2imgTips), 'seedream txt2img.tips should be array').toBe(true)
    expect(txt2imgTips.length, 'seedream txt2img.tips count (2-4)').toBeGreaterThanOrEqual(2)
    expect(txt2imgTips.length, 'seedream txt2img.tips count (2-4)').toBeLessThanOrEqual(4)
    for (const t of txt2imgTips) {
      expect(typeof t).toBe('string')
    }

    // img2img
    const img2img = modes.img2img
    expect(img2img, 'seedream should have img2img mode').toBeDefined()
    const img2imgTips = img2img.tips as unknown[]
    expect(Array.isArray(img2imgTips), 'seedream img2img.tips should be array').toBe(true)
    expect(img2imgTips.length, 'seedream img2img.tips count (2-4)').toBeGreaterThanOrEqual(2)
    expect(img2imgTips.length, 'seedream img2img.tips count (2-4)').toBeLessThanOrEqual(4)
    for (const t of img2imgTips) {
      expect(typeof t).toBe('string')
    }
  })

  /**
   * AC-5: GIVEN der Eintrag `models["nano-banana"]`
   *       WHEN das Feld `modes` geprueft wird
   *       THEN enthaelt es `txt2img` mit `tips` (string[], 2-4 Eintraege)
   *            UND `img2img` mit `tips` (string[], 2-4 Eintraege)
   */
  it('should have txt2img and img2img modes for nano-banana', () => {
    const models = data.models as Record<string, Record<string, unknown>>
    const modes = models['nano-banana'].modes as Record<string, Record<string, unknown>>

    expect(modes, 'nano-banana should have modes').toBeDefined()

    // txt2img
    const txt2img = modes.txt2img
    expect(txt2img, 'nano-banana should have txt2img mode').toBeDefined()
    const txt2imgTips = txt2img.tips as unknown[]
    expect(Array.isArray(txt2imgTips), 'nano-banana txt2img.tips should be array').toBe(true)
    expect(txt2imgTips.length, 'nano-banana txt2img.tips count (2-4)').toBeGreaterThanOrEqual(2)
    expect(txt2imgTips.length, 'nano-banana txt2img.tips count (2-4)').toBeLessThanOrEqual(4)
    for (const t of txt2imgTips) {
      expect(typeof t).toBe('string')
    }

    // img2img
    const img2img = modes.img2img
    expect(img2img, 'nano-banana should have img2img mode').toBeDefined()
    const img2imgTips = img2img.tips as unknown[]
    expect(Array.isArray(img2imgTips), 'nano-banana img2img.tips should be array').toBe(true)
    expect(img2imgTips.length, 'nano-banana img2img.tips count (2-4)').toBeGreaterThanOrEqual(2)
    expect(img2imgTips.length, 'nano-banana img2img.tips count (2-4)').toBeLessThanOrEqual(4)
    for (const t of img2imgTips) {
      expect(typeof t).toBe('string')
    }
  })
})

// ---------------------------------------------------------------------------
// Token budget
// ---------------------------------------------------------------------------

describe('prompt-knowledge.json token budget', () => {
  /**
   * AC-6: GIVEN ein beliebiger Modell-Eintrag in `models`
   *       WHEN der Token-Count der Sektion geschaetzt wird
   *            (alle Strings konkateniert, Whitespace-tokenisiert)
   *       THEN liegt der Wert unter 250 Tokens
   */
  it('should keep each model section under 250 tokens', () => {
    const models = data.models as Record<string, unknown>

    for (const prefix of REQUIRED_PREFIXES) {
      const entry = models[prefix]
      const tokenCount = estimateTokens(entry)
      expect(
        tokenCount,
        `${prefix} has ${tokenCount} tokens, must be under 250`
      ).toBeLessThan(250)
    }
  })
})

// ---------------------------------------------------------------------------
// Factual correctness
// ---------------------------------------------------------------------------

describe('prompt-knowledge.json factual correctness', () => {
  /**
   * AC-9: GIVEN die Eintraege `flux-2` und `flux-schnell`
   *       WHEN ihre `promptStyle`-Werte verglichen werden
   *       THEN haben beide den Wert "natural" (Flux-Familie nutzt natuerliche Sprache)
   */
  it('should set promptStyle to natural for flux-2 and flux-schnell', () => {
    const models = data.models as Record<string, Record<string, unknown>>

    expect(models['flux-2'].promptStyle).toBe('natural')
    expect(models['flux-schnell'].promptStyle).toBe('natural')
  })

  /**
   * AC-10: GIVEN der Eintrag `models["stable-diffusion"]`
   *        WHEN sein `negativePrompts.supported`-Wert geprueft wird
   *        THEN ist er `true` (SD unterstuetzt Negative Prompts nativ)
   */
  it('should set negativePrompts.supported to true for stable-diffusion', () => {
    const models = data.models as Record<string, Record<string, unknown>>
    const neg = models['stable-diffusion'].negativePrompts as Record<string, unknown>

    expect(neg.supported).toBe(true)
  })

  /**
   * AC-11: GIVEN der Eintrag `models["flux-2"]`
   *        WHEN sein `negativePrompts.supported`-Wert geprueft wird
   *        THEN ist er `false` (Flux hat keinen separaten Negative-Prompt-Parameter)
   */
  it('should set negativePrompts.supported to false for flux-2', () => {
    const models = data.models as Record<string, Record<string, unknown>>
    const neg = models['flux-2'].negativePrompts as Record<string, unknown>

    expect(neg.supported).toBe(false)
  })
})
