import { describe, it, expect } from 'vitest'
import {
  detectCapabilities,
  resolveSchemaRefs,
  getImg2ImgFieldName,
  getMaxImageCount,
} from '../capability-detection'

// =============================================================================
// detectCapabilities — Acceptance Tests (AC-1 through AC-8)
// =============================================================================

describe('detectCapabilities', () => {
  // AC-1: txt2img via prompt-Feld
  it('should detect txt2img when schema has prompt field', () => {
    // GIVEN ein OpenAPI-Schema mit einem `prompt`-Feld
    const schema = { prompt: { type: 'string' } }

    // WHEN `detectCapabilities(schema, null, [])` aufgerufen wird
    const result = detectCapabilities(schema, null, [])

    // THEN enthaelt das Ergebnis `{ txt2img: true }`
    expect(result.txt2img).toBe(true)
  })

  // AC-2: img2img via image-Feld ohne mask
  it('should detect img2img when schema has image field without mask', () => {
    // GIVEN ein OpenAPI-Schema mit `image`-Feld aber OHNE `mask`-Feld
    const schema = { image: { type: 'string' }, prompt: { type: 'string' } }

    // WHEN `detectCapabilities(schema, null, [])` aufgerufen wird
    const result = detectCapabilities(schema, null, [])

    // THEN enthaelt das Ergebnis `{ img2img: true }`
    expect(result.img2img).toBe(true)
  })

  // AC-3: inpaint via image+mask, img2img false
  it('should detect inpaint and not img2img when schema has image and mask fields', () => {
    // GIVEN ein OpenAPI-Schema mit `image`-Feld UND `mask`-Feld
    const schema = {
      image: { type: 'string' },
      mask: { type: 'string' },
      prompt: { type: 'string' },
    }

    // WHEN `detectCapabilities(schema, null, [])` aufgerufen wird
    const result = detectCapabilities(schema, null, [])

    // THEN enthaelt das Ergebnis `{ inpaint: true, img2img: false }`
    expect(result.inpaint).toBe(true)
    expect(result.img2img).toBe(false)
  })

  // AC-4: inpaint via description keyword
  it('should detect inpaint when description contains inpainting keyword', () => {
    // GIVEN ein OpenAPI-Schema ohne `image`/`mask` und eine Description
    //       "This model supports inpainting"
    const schema = { prompt: { type: 'string' } }
    const description = 'This model supports inpainting'

    // WHEN `detectCapabilities(schema, description, [])` aufgerufen wird
    const result = detectCapabilities(schema, description, [])

    // THEN enthaelt das Ergebnis `{ inpaint: true }`
    expect(result.inpaint).toBe(true)
  })

  // AC-5: outpaint via description keyword
  it('should detect outpaint when description contains outpainting or expand', () => {
    // GIVEN ein OpenAPI-Schema und eine Description mit dem Wort "outpainting"
    const schemaA = { prompt: { type: 'string' } }
    const descriptionA = 'This model supports outpainting'

    // WHEN `detectCapabilities(schema, description, [])` aufgerufen wird
    const resultA = detectCapabilities(schemaA, descriptionA, [])

    // THEN enthaelt das Ergebnis `{ outpaint: true }`
    expect(resultA.outpaint).toBe(true)

    // Also test with "expand" keyword
    const descriptionB = 'Use this to expand your images'
    const resultB = detectCapabilities(schemaA, descriptionB, [])
    expect(resultB.outpaint).toBe(true)
  })

  // AC-6: upscale via collection + schema
  it('should detect upscale when in super-resolution collection with scale and image', () => {
    // GIVEN ein OpenAPI-Schema mit `scale`-Parameter und `image`-Input OHNE `prompt`
    const schema = {
      image: { type: 'string' },
      scale: { type: 'number' },
    }

    // WHEN `detectCapabilities(schema, null, ["super-resolution"])` aufgerufen wird
    const result = detectCapabilities(schema, null, ['super-resolution'])

    // THEN enthaelt das Ergebnis `{ upscale: true }`
    expect(result.upscale).toBe(true)
  })

  // AC-7: upscale via schema-only (no collection)
  it('should detect upscale via schema rule even without super-resolution collection', () => {
    // GIVEN ein OpenAPI-Schema mit `scale`-Parameter und `image`-Input OHNE `prompt`,
    //       collections = `[]`
    const schema = {
      image: { type: 'string' },
      scale: { type: 'number' },
    }

    // WHEN `detectCapabilities(schema, null, [])` aufgerufen wird
    const result = detectCapabilities(schema, null, [])

    // THEN enthaelt das Ergebnis `{ upscale: true }` (Schema-Regel greift unabhaengig von Collection)
    expect(result.upscale).toBe(true)
  })

  // AC-8: upscale via collection-only (no scale param)
  it('should detect upscale when in super-resolution collection without scale parameter', () => {
    // GIVEN ein Model in der `super-resolution` Collection ohne `scale`-Parameter
    const schema = {
      image: { type: 'string' },
    }

    // WHEN `detectCapabilities(schema, null, ["super-resolution"])` aufgerufen wird
    const result = detectCapabilities(schema, null, ['super-resolution'])

    // THEN enthaelt das Ergebnis `{ upscale: true }` (Collection-Regel greift)
    expect(result.upscale).toBe(true)
  })
})

// =============================================================================
// resolveSchemaRefs — Acceptance Test (AC-9)
// =============================================================================

describe('resolveSchemaRefs', () => {
  // AC-9: allOf/$ref inline-Aufloesung
  it('should resolve allOf $ref and inline enum and type from referenced schema', () => {
    // GIVEN ein rohes OpenAPI-Schema mit `allOf: [{ $ref: "#/components/schemas/aspect_ratio" }]`
    //       und eine `allSchemas`-Map mit `aspect_ratio: { type: "string", enum: ["1:1", "16:9"] }`
    const properties = {
      aspect_ratio: {
        allOf: [{ $ref: '#/components/schemas/aspect_ratio' }],
        description: 'The aspect ratio',
      },
    }

    const allSchemas = {
      aspect_ratio: {
        type: 'string',
        enum: ['1:1', '16:9'],
      },
    }

    // WHEN `resolveSchemaRefs(properties, allSchemas)` aufgerufen wird
    const resolved = resolveSchemaRefs(properties, allSchemas)

    // THEN wird die `allOf/$ref`-Referenz inline aufgeloest:
    //   die Property enthaelt `enum: ["1:1", "16:9"]` und `type: "string"`,
    //   und `allOf` ist entfernt
    const resolvedProp = resolved.aspect_ratio as Record<string, unknown>
    expect(resolvedProp.enum).toEqual(['1:1', '16:9'])
    expect(resolvedProp.type).toBe('string')
    expect(resolvedProp).not.toHaveProperty('allOf')
    // Ensure description is preserved
    expect(resolvedProp.description).toBe('The aspect ratio')
  })
})

// =============================================================================
// getImg2ImgFieldName — Acceptance Tests (AC-10, AC-11)
// =============================================================================

describe('getImg2ImgFieldName', () => {
  // AC-10: input_images Prioritaet
  it('should return input_images with isArray true as highest priority', () => {
    // GIVEN ein Schema mit `input_images`-Feld
    const schema = {
      input_images: { type: 'array', items: { type: 'string' } },
      prompt: { type: 'string' },
    }

    // WHEN `getImg2ImgFieldName(schema)` aufgerufen wird
    const result = getImg2ImgFieldName(schema)

    // THEN wird `{ field: "input_images", isArray: true }` zurueckgegeben
    expect(result).toEqual({ field: 'input_images', isArray: true })
  })

  // AC-11: image+mask = undefined
  it('should return undefined when schema has image and mask fields', () => {
    // GIVEN ein Schema mit `image`-Feld und `mask`-Feld
    const schema = {
      image: { type: 'string' },
      mask: { type: 'string' },
      prompt: { type: 'string' },
    }

    // WHEN `getImg2ImgFieldName(schema)` aufgerufen wird
    const result = getImg2ImgFieldName(schema)

    // THEN wird `undefined` zurueckgegeben (inpainting, nicht img2img)
    expect(result).toBeUndefined()
  })
})

// =============================================================================
// getMaxImageCount — Acceptance Tests (AC-12, AC-13, AC-14)
// =============================================================================

describe('getMaxImageCount', () => {
  // AC-12: Array mit maxItems
  it('should return maxItems value for array img2img field', () => {
    // GIVEN ein Schema mit Array-Feld `input_images` und `maxItems: 4`
    const schema = {
      input_images: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 4,
      },
    }

    // WHEN `getMaxImageCount(schema)` aufgerufen wird
    const result = getMaxImageCount(schema)

    // THEN wird `4` zurueckgegeben
    expect(result).toBe(4)
  })

  // AC-13: Kein img2img-Feld
  it('should return 0 when no img2img field exists', () => {
    // GIVEN ein Schema ohne img2img-Feld (kein image-artiges Feld)
    const schema = {
      prompt: { type: 'string' },
      num_outputs: { type: 'number' },
    }

    // WHEN `getMaxImageCount(schema)` aufgerufen wird
    const result = getMaxImageCount(schema)

    // THEN wird `0` zurueckgegeben
    expect(result).toBe(0)
  })

  // AC-14: Nicht-Array Feld
  it('should return 1 for non-array img2img field', () => {
    // GIVEN ein Schema mit einem Nicht-Array img2img-Feld
    //       (z.B. `input_image: { type: "string" }`)
    const schema = {
      input_image: { type: 'string' },
    }

    // WHEN `getMaxImageCount(schema)` aufgerufen wird
    const result = getMaxImageCount(schema)

    // THEN wird `1` zurueckgegeben
    expect(result).toBe(1)
  })
})
