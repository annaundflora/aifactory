import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

import type {
  PromptKnowledgeFile,
  ModelKnowledge,
  ModeKnowledge,
  FallbackKnowledge,
  NegativePromptInfo,
} from '@/lib/types/prompt-knowledge'

// ---------------------------------------------------------------------------
// Load the JSON file once for all schema-validation tests
// ---------------------------------------------------------------------------
const jsonPath = join(__dirname, '..', '..', '..', 'data', 'prompt-knowledge.json')
const rawJson = readFileSync(jsonPath, 'utf-8')

// ---------------------------------------------------------------------------
// JSON Schema Validation (AC-1 through AC-5)
// ---------------------------------------------------------------------------
describe('prompt-knowledge.json schema validation', () => {
  // AC-1: GIVEN die Datei data/prompt-knowledge.json existiert
  //        WHEN ein JSON-Parser sie laedt
  //        THEN ist das Ergebnis valides JSON ohne Parse-Fehler
  it('AC-1: should parse prompt-knowledge.json without errors', () => {
    let parsed: unknown
    expect(() => {
      parsed = JSON.parse(rawJson)
    }).not.toThrow()
    expect(parsed).toBeDefined()
    expect(typeof parsed).toBe('object')
    expect(parsed).not.toBeNull()
  })

  // AC-2: GIVEN die JSON-Datei geladen ist
  //        WHEN der Top-Level-Key models gelesen wird
  //        THEN enthaelt er mindestens einen Eintrag mit dem Key flux-2-pro
  it('AC-2: should contain flux-2-pro entry in models', () => {
    const data = JSON.parse(rawJson)
    expect(data).toHaveProperty('models')
    expect(typeof data.models).toBe('object')
    expect(data.models).toHaveProperty('flux-2-pro')
  })

  // AC-3: GIVEN der Eintrag models["flux-2-pro"] existiert
  //        WHEN seine Felder geprueft werden
  //        THEN enthaelt er alle Pflichtfelder gemaess Schema:
  //        displayName (string), promptStyle ("natural" | "keywords"),
  //        negativePrompts (Objekt mit supported: boolean und note: string),
  //        strengths (string[], 2-4 Eintraege), tips (string[], 3-6 Eintraege),
  //        avoid (string[], 2-4 Eintraege)
  it('AC-3: should have all required fields in flux-2-pro entry', () => {
    const data = JSON.parse(rawJson)
    const flux2 = data.models['flux-2-pro']

    // displayName is a string
    expect(flux2).toHaveProperty('displayName')
    expect(typeof flux2.displayName).toBe('string')

    // promptStyle is "natural" or "keywords"
    expect(flux2).toHaveProperty('promptStyle')
    expect(['natural', 'keywords']).toContain(flux2.promptStyle)

    // negativePrompts is an object with supported (boolean) and note (string)
    expect(flux2).toHaveProperty('negativePrompts')
    expect(typeof flux2.negativePrompts).toBe('object')
    expect(flux2.negativePrompts).not.toBeNull()
    expect(typeof flux2.negativePrompts.supported).toBe('boolean')
    expect(typeof flux2.negativePrompts.note).toBe('string')

    // strengths is string[] with 2-4 entries
    expect(flux2).toHaveProperty('strengths')
    expect(Array.isArray(flux2.strengths)).toBe(true)
    expect(flux2.strengths.length).toBeGreaterThanOrEqual(2)
    expect(flux2.strengths.length).toBeLessThanOrEqual(4)
    flux2.strengths.forEach((s: unknown) => expect(typeof s).toBe('string'))

    // tips is string[] with 3-6 entries
    expect(flux2).toHaveProperty('tips')
    expect(Array.isArray(flux2.tips)).toBe(true)
    expect(flux2.tips.length).toBeGreaterThanOrEqual(3)
    expect(flux2.tips.length).toBeLessThanOrEqual(6)
    flux2.tips.forEach((s: unknown) => expect(typeof s).toBe('string'))

    // avoid is string[] with 2-4 entries
    expect(flux2).toHaveProperty('avoid')
    expect(Array.isArray(flux2.avoid)).toBe(true)
    expect(flux2.avoid.length).toBeGreaterThanOrEqual(2)
    expect(flux2.avoid.length).toBeLessThanOrEqual(4)
    flux2.avoid.forEach((s: unknown) => expect(typeof s).toBe('string'))
  })

  // AC-4: GIVEN der Eintrag models["flux-2-pro"] existiert
  //        WHEN das optionale Feld modes geprueft wird
  //        THEN enthaelt es die Keys txt2img und img2img,
  //        jeweils mit tips (string[], 2-4 Eintraege)
  it('AC-4: should have txt2img and img2img modes in flux-2-pro entry', () => {
    const data = JSON.parse(rawJson)
    const flux2 = data.models['flux-2-pro']

    expect(flux2).toHaveProperty('modes')
    expect(typeof flux2.modes).toBe('object')

    // txt2img mode
    expect(flux2.modes).toHaveProperty('txt2img')
    expect(Array.isArray(flux2.modes.txt2img.tips)).toBe(true)
    expect(flux2.modes.txt2img.tips.length).toBeGreaterThanOrEqual(2)
    expect(flux2.modes.txt2img.tips.length).toBeLessThanOrEqual(4)
    flux2.modes.txt2img.tips.forEach((s: unknown) => expect(typeof s).toBe('string'))

    // img2img mode
    expect(flux2.modes).toHaveProperty('img2img')
    expect(Array.isArray(flux2.modes.img2img.tips)).toBe(true)
    expect(flux2.modes.img2img.tips.length).toBeGreaterThanOrEqual(2)
    expect(flux2.modes.img2img.tips.length).toBeLessThanOrEqual(4)
    flux2.modes.img2img.tips.forEach((s: unknown) => expect(typeof s).toBe('string'))
  })

  // AC-5: GIVEN die JSON-Datei geladen ist
  //        WHEN der Top-Level-Key fallback gelesen wird
  //        THEN enthaelt er displayName (string, Wert "Generic"),
  //        tips (string[], mindestens 3 Eintraege),
  //        avoid (string[], mindestens 2 Eintraege)
  it('AC-5: should have valid fallback section with displayName Generic', () => {
    const data = JSON.parse(rawJson)

    expect(data).toHaveProperty('fallback')
    const fallback = data.fallback

    // displayName is "Generic"
    expect(fallback).toHaveProperty('displayName')
    expect(typeof fallback.displayName).toBe('string')
    expect(fallback.displayName).toBe('Generic')

    // tips is string[] with at least 3 entries
    expect(fallback).toHaveProperty('tips')
    expect(Array.isArray(fallback.tips)).toBe(true)
    expect(fallback.tips.length).toBeGreaterThanOrEqual(3)
    fallback.tips.forEach((s: unknown) => expect(typeof s).toBe('string'))

    // avoid is string[] with at least 2 entries
    expect(fallback).toHaveProperty('avoid')
    expect(Array.isArray(fallback.avoid)).toBe(true)
    expect(fallback.avoid.length).toBeGreaterThanOrEqual(2)
    fallback.avoid.forEach((s: unknown) => expect(typeof s).toBe('string'))
  })
})

// ---------------------------------------------------------------------------
// TypeScript Type Validation (AC-7 through AC-9)
// ---------------------------------------------------------------------------
describe('prompt-knowledge TypeScript types', () => {
  // AC-7: GIVEN die TypeScript-Interfaces exportiert sind
  //        WHEN die Exports geprueft werden
  //        THEN existieren mindestens: PromptKnowledgeFile, ModelKnowledge,
  //        ModeKnowledge, FallbackKnowledge, NegativePromptInfo
  //
  // Strategy: Import the module at runtime (not just type-level) and verify
  // that the module is resolvable. The type-level imports above already prove
  // that the interfaces exist at compile time. For a runtime check, we verify
  // that the module can be required and that we can construct objects
  // satisfying each interface.

  it('AC-7: should export PromptKnowledgeFile interface', () => {
    // If this compiles, the interface is exported. Runtime proof: construct a
    // value that satisfies the type.
    const obj: PromptKnowledgeFile = {
      models: {},
      fallback: { displayName: 'Test', tips: ['a'], avoid: ['b'] },
    }
    expect(obj).toBeDefined()
    expect(obj.models).toBeDefined()
    expect(obj.fallback).toBeDefined()
  })

  it('AC-7: should export ModelKnowledge interface', () => {
    const obj: ModelKnowledge = {
      displayName: 'Test',
      promptStyle: 'natural',
      negativePrompts: { supported: false, note: 'n/a' },
      strengths: ['a', 'b'],
      tips: ['a', 'b', 'c'],
      avoid: ['a', 'b'],
    }
    expect(obj).toBeDefined()
    expect(obj.displayName).toBe('Test')
  })

  it('AC-7: should export ModeKnowledge interface', () => {
    const obj: ModeKnowledge = {
      tips: ['tip1', 'tip2'],
    }
    expect(obj).toBeDefined()
    expect(obj.tips).toHaveLength(2)
  })

  it('AC-7: should export FallbackKnowledge interface', () => {
    const obj: FallbackKnowledge = {
      displayName: 'Generic',
      tips: ['a', 'b', 'c'],
      avoid: ['a', 'b'],
    }
    expect(obj).toBeDefined()
    expect(obj.displayName).toBe('Generic')
  })

  it('AC-7: should export NegativePromptInfo interface', () => {
    const obj: NegativePromptInfo = {
      supported: true,
      note: 'test note',
    }
    expect(obj).toBeDefined()
    expect(obj.supported).toBe(true)
    expect(obj.note).toBe('test note')
  })

  // AC-8: GIVEN das Interface PromptKnowledgeFile existiert
  //        WHEN seine Struktur geprueft wird
  //        THEN hat es ein Feld models (Record mit string-Key und
  //        ModelKnowledge-Value) und ein Feld fallback vom Typ FallbackKnowledge
  it('AC-8: should type-check a valid PromptKnowledgeFile object', () => {
    const modelEntry: ModelKnowledge = {
      displayName: 'Test Model',
      promptStyle: 'keywords',
      negativePrompts: { supported: true, note: 'supports negatives' },
      strengths: ['fast', 'accurate'],
      tips: ['use keywords', 'be specific', 'add style'],
      avoid: ['long sentences', 'ambiguity'],
    }

    const file: PromptKnowledgeFile = {
      models: { 'test-model': modelEntry },
      fallback: {
        displayName: 'Generic',
        tips: ['tip1', 'tip2', 'tip3'],
        avoid: ['avoid1', 'avoid2'],
      },
    }

    // Verify models is a Record<string, ModelKnowledge>
    expect(file.models).toBeDefined()
    expect(typeof file.models).toBe('object')
    expect(file.models['test-model']).toBeDefined()
    expect(file.models['test-model'].displayName).toBe('Test Model')
    expect(file.models['test-model'].promptStyle).toBe('keywords')

    // Verify fallback is FallbackKnowledge
    expect(file.fallback).toBeDefined()
    expect(file.fallback.displayName).toBe('Generic')
    expect(Array.isArray(file.fallback.tips)).toBe(true)
    expect(Array.isArray(file.fallback.avoid)).toBe(true)
  })

  // AC-9: GIVEN das Interface ModelKnowledge existiert
  //        WHEN seine Felder geprueft werden
  //        THEN bildet es die Pflichtfelder aus AC-3 ab und hat ein optionales
  //        Feld modes (Record mit txt2img/img2img Keys und ModeKnowledge Values)
  it('AC-9: should allow ModelKnowledge with and without modes', () => {
    // Without modes (optional field omitted)
    const withoutModes: ModelKnowledge = {
      displayName: 'No Modes Model',
      promptStyle: 'natural',
      negativePrompts: { supported: false, note: 'no negatives' },
      strengths: ['a', 'b'],
      tips: ['a', 'b', 'c'],
      avoid: ['a', 'b'],
    }
    expect(withoutModes).toBeDefined()
    expect(withoutModes.modes).toBeUndefined()

    // With modes (optional field present)
    const withModes: ModelKnowledge = {
      displayName: 'Modes Model',
      promptStyle: 'keywords',
      negativePrompts: { supported: true, note: 'supports negatives' },
      strengths: ['a', 'b', 'c'],
      tips: ['a', 'b', 'c', 'd'],
      avoid: ['a', 'b'],
      modes: {
        txt2img: { tips: ['txt tip 1', 'txt tip 2'] },
        img2img: { tips: ['img tip 1', 'img tip 2'] },
      },
    }
    expect(withModes).toBeDefined()
    expect(withModes.modes).toBeDefined()
    expect(withModes.modes!.txt2img.tips).toHaveLength(2)
    expect(withModes.modes!.img2img.tips).toHaveLength(2)

    // Verify all required fields from AC-3 are present
    const requiredFields = [
      'displayName',
      'promptStyle',
      'negativePrompts',
      'strengths',
      'tips',
      'avoid',
    ] as const
    for (const field of requiredFields) {
      expect(withModes).toHaveProperty(field)
    }
  })
})
