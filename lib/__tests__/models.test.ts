import { describe, it, expect } from 'vitest'
import { MODELS, getModelById } from '@/lib/models'

describe('Model Registry', () => {
  // AC-1: GIVEN lib/models.ts existiert
  //       WHEN die Model-Registry importiert wird
  //       THEN enthaelt sie exakt 6 Modelle mit den IDs aus architecture.md
  it('AC-1: should contain exactly 6 models with IDs matching architecture spec', () => {
    expect(MODELS).toHaveLength(6)

    const expectedIds = [
      'black-forest-labs/flux-2-pro',
      'google/nano-banana-2',
      'recraft-ai/recraft-v4',
      'bytedance/seedream-5-lite',
      'bytedance/seedream-4.5',
      'google/gemini-2.5-flash-image',
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
