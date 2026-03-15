import { describe, it, expect } from 'vitest'
import { getMaxImageCount } from '@/lib/services/model-schema-service'
import type { SchemaProperties } from '@/lib/services/model-schema-service'

// ---------------------------------------------------------------------------
// Slice 11: getMaxImageCount — Pure Function Unit Tests
// ---------------------------------------------------------------------------

describe('getMaxImageCount', () => {
  // AC-1: GIVEN ein Modell-Schema dessen img2img-Feld `input_images` den Typ `array`
  //       mit `maxItems: 3` hat und 5 Referenz-Slots geladen sind
  //       WHEN `getMaxImageCount(schema)` aufgerufen wird
  //       THEN gibt die Funktion `3` zurueck
  it('AC-1: should return maxItems value when img2img array field has maxItems defined', () => {
    const schema: SchemaProperties = {
      prompt: { type: 'string' },
      input_images: {
        type: 'array',
        maxItems: 3,
        items: { type: 'string', format: 'uri' },
      },
    }

    const result = getMaxImageCount(schema)

    expect(result).toBe(3)
  })

  // AC-2: GIVEN ein Modell-Schema dessen img2img-Feld `input_images` den Typ `array` hat
  //       aber KEIN `maxItems` definiert
  //       WHEN `getMaxImageCount(schema)` aufgerufen wird
  //       THEN gibt die Funktion `Infinity` zurueck (unbegrenzt)
  it('AC-2: should return Infinity when img2img array field has no maxItems', () => {
    const schema: SchemaProperties = {
      prompt: { type: 'string' },
      input_images: {
        type: 'array',
        items: { type: 'string', format: 'uri' },
      },
    }

    const result = getMaxImageCount(schema)

    expect(result).toBe(Infinity)
  })

  // AC-3: GIVEN ein Modell-Schema das kein img2img-Feld hat
  //       (`getImg2ImgFieldName` gibt `undefined` zurueck)
  //       WHEN `getMaxImageCount(schema)` aufgerufen wird
  //       THEN gibt die Funktion `0` zurueck (kein Support)
  it('AC-3: should return 0 when schema has no img2img field', () => {
    const schema: SchemaProperties = {
      prompt: { type: 'string' },
      width: { type: 'integer', default: 1024 },
      height: { type: 'integer', default: 768 },
    }

    const result = getMaxImageCount(schema)

    expect(result).toBe(0)
  })

  // AC-4: GIVEN ein Modell-Schema dessen img2img-Feld NICHT `isArray: true` ist
  //       (z.B. `image_prompt` als einzelner String)
  //       WHEN `getMaxImageCount(schema)` aufgerufen wird
  //       THEN gibt die Funktion `1` zurueck (nur ein Bild)
  it('AC-4: should return 1 when img2img field is not an array (single string)', () => {
    const schema: SchemaProperties = {
      prompt: { type: 'string' },
      image_prompt: { type: 'string', format: 'uri' },
    }

    const result = getMaxImageCount(schema)

    expect(result).toBe(1)
  })

  // AC-4 supplementary: also test with init_image (another single-value field)
  it('AC-4 (supplementary): should return 1 for init_image single-value field', () => {
    const schema: SchemaProperties = {
      prompt: { type: 'string' },
      init_image: { type: 'string', format: 'uri' },
    }

    const result = getMaxImageCount(schema)

    expect(result).toBe(1)
  })

  // AC-4 supplementary: test with "image" field (without mask = img2img, not inpainting)
  it('AC-4 (supplementary): should return 1 for image field without mask', () => {
    const schema: SchemaProperties = {
      prompt: { type: 'string' },
      image: { type: 'string', format: 'uri' },
    }

    const result = getMaxImageCount(schema)

    expect(result).toBe(1)
  })

  // AC-3 supplementary: image + mask = inpainting, no img2img support
  it('AC-3 (supplementary): should return 0 when schema has image + mask (inpainting)', () => {
    const schema: SchemaProperties = {
      prompt: { type: 'string' },
      image: { type: 'string', format: 'uri' },
      mask: { type: 'string', format: 'uri' },
    }

    const result = getMaxImageCount(schema)

    expect(result).toBe(0)
  })

  // AC-1 supplementary: test with image_input (another known array field)
  it('AC-1 (supplementary): should return maxItems for image_input array field', () => {
    const schema: SchemaProperties = {
      prompt: { type: 'string' },
      image_input: {
        type: 'array',
        maxItems: 5,
        items: { type: 'string', format: 'uri' },
      },
    }

    const result = getMaxImageCount(schema)

    expect(result).toBe(5)
  })

  // AC-2 supplementary: test with image_input array without maxItems
  it('AC-2 (supplementary): should return Infinity for image_input array without maxItems', () => {
    const schema: SchemaProperties = {
      prompt: { type: 'string' },
      image_input: {
        type: 'array',
        items: { type: 'string', format: 'uri' },
      },
    }

    const result = getMaxImageCount(schema)

    expect(result).toBe(Infinity)
  })

  // "images" field (Flux 2 Klein 4B) — array without maxItems
  it('should return Infinity for "images" array field without maxItems', () => {
    const schema: SchemaProperties = {
      prompt: { type: 'string' },
      images: {
        type: 'array',
        items: { type: 'string', format: 'uri' },
      },
    }

    const result = getMaxImageCount(schema)

    expect(result).toBe(Infinity)
  })

  // "input_image" field (Flux Kontext Pro/Max) — single string
  it('should return 1 for "input_image" single-value field', () => {
    const schema: SchemaProperties = {
      prompt: { type: 'string' },
      input_image: { type: 'string', format: 'uri', nullable: true },
    }

    const result = getMaxImageCount(schema)

    expect(result).toBe(1)
  })
})
