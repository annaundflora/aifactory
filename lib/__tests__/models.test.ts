import { describe, it, expect } from 'vitest'
import { MODELS, getModelById, UPSCALE_MODEL } from '@/lib/models'

describe('Model Registry', () => {
  // AC-1: GIVEN lib/models.ts existiert
  //       WHEN die Model-Registry importiert wird
  //       THEN enthaelt sie exakt 6 Modelle mit den IDs aus architecture.md
  it('AC-1: should contain exactly 9 models with IDs matching architecture spec', () => {
    expect(MODELS).toHaveLength(9)

    const expectedIds = [
      'black-forest-labs/flux-2-pro',
      'openai/gpt-image-1.5',
      'google/nano-banana-pro',
      'recraft-ai/recraft-v4',
      'bytedance/seedream-5-lite',
      'bytedance/seedream-4.5',
      'google/imagen-4-fast',
      'google/gemini-2.5-flash-image',
      'ideogram-ai/ideogram-v3-turbo',
    ]

    const actualIds = MODELS.map((m) => m.id)
    expect(actualIds).toEqual(expect.arrayContaining(expectedIds))
    expect(expectedIds).toEqual(expect.arrayContaining(actualIds))
  })

  // AC-2: GIVEN die Model-Registry
  //       WHEN ein Modell abgefragt wird
  //       THEN hat es die Felder id (string), displayName (string) und pricePerImage (number)
  it('AC-2: should have id, displayName, and pricePerImage for each model', () => {
    for (const model of MODELS) {
      expect(model).toHaveProperty('id')
      expect(model).toHaveProperty('displayName')
      expect(model).toHaveProperty('pricePerImage')

      expect(typeof model.id).toBe('string')
      expect(typeof model.displayName).toBe('string')
      expect(typeof model.pricePerImage).toBe('number')

      // Ensure non-empty strings
      expect(model.id.length).toBeGreaterThan(0)
      expect(model.displayName.length).toBeGreaterThan(0)
    }
  })

  it('getModelById returns the correct model for a valid ID', () => {
    const model = getModelById('black-forest-labs/flux-2-pro')
    expect(model).toBeDefined()
    expect(model!.id).toBe('black-forest-labs/flux-2-pro')
  })

  it('getModelById returns undefined for an unknown ID', () => {
    const model = getModelById('unknown/model')
    expect(model).toBeUndefined()
  })
})

describe('UPSCALE_MODEL Constant (Slice 05)', () => {
  // AC-1: GIVEN die Datei `lib/models.ts` ist importiert
  //       WHEN `UPSCALE_MODEL` exportiert wird
  //       THEN hat die Konstante den exakten String-Wert `"nightmareai/real-esrgan"`
  it('AC-1: should export UPSCALE_MODEL as "nightmareai/real-esrgan"', () => {
    expect(UPSCALE_MODEL).toBe('nightmareai/real-esrgan')
  })

  // AC-2: GIVEN `UPSCALE_MODEL` wurde zur Datei hinzugefuegt
  //       WHEN `MODELS` exportiert wird
  //       THEN enthaelt das Array weiterhin genau 9 Eintraege (unveraendert gegenueber Ausgangszustand)
  it('AC-2: should keep MODELS array unchanged with 9 entries', () => {
    expect(MODELS).toHaveLength(9)
  })

  // AC-3: GIVEN `UPSCALE_MODEL` wurde zur Datei hinzugefuegt
  //       WHEN `getModelById("nightmareai/real-esrgan")` aufgerufen wird
  //       THEN gibt die Funktion `undefined` zurueck (`UPSCALE_MODEL` ist kein Eintrag in `MODELS`)
  it('AC-3: should return undefined when getModelById is called with UPSCALE_MODEL id', () => {
    const result = getModelById(UPSCALE_MODEL)
    expect(result).toBeUndefined()
  })

  // AC-4: GIVEN `UPSCALE_MODEL` ist ein `string`-Export
  //       WHEN der TypeScript-Compiler die Datei prueft
  //       THEN ist der Typ von `UPSCALE_MODEL` `string`
  it('AC-4: should have type string for UPSCALE_MODEL', () => {
    expect(typeof UPSCALE_MODEL).toBe('string')
  })
})
