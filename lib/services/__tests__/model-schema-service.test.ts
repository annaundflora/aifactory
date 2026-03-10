import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ModelSchemaService } from '@/lib/services/model-schema-service'

// Mock fetch globally per Mocking Strategy: mock_external
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Helper: build a valid Replicate API response
function buildReplicateResponse(properties: Record<string, unknown>) {
  return {
    ok: true,
    json: async () => ({
      latest_version: {
        openapi_schema: {
          components: {
            schemas: {
              Input: {
                properties,
              },
            },
          },
        },
      },
    }),
  }
}

describe('ModelSchemaService', () => {
  beforeEach(() => {
    ModelSchemaService.clearCache()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // AC-7: GIVEN der ModelSchemaService ruft die Replicate API auf
  //       WHEN die API erfolgreich antwortet
  //       THEN wird der Schema-Pfad .latest_version.openapi_schema.components.schemas.Input.properties extrahiert
  it('AC-7: should extract properties from openapi_schema path', async () => {
    const fakeProperties = {
      prompt: { type: 'string', description: 'Input prompt' },
      width: { type: 'integer', default: 1024 },
    }

    mockFetch.mockResolvedValueOnce(buildReplicateResponse(fakeProperties))

    const result = await ModelSchemaService.getSchema('black-forest-labs/flux-2-pro')

    expect(result).toEqual(fakeProperties)
    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.replicate.com/v1/models/black-forest-labs/flux-2-pro',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining('Bearer'),
        }),
      })
    )
  })

  // AC-6: GIVEN der ModelSchemaService wurde fuer Model-ID bereits aufgerufen
  //       WHEN getModelSchema erneut aufgerufen wird
  //       THEN wird das gecachte Ergebnis zurueckgegeben OHNE einen erneuten API-Call
  it('AC-6: should return cached result on second call without additional API request', async () => {
    const fakeProperties = {
      prompt: { type: 'string' },
    }

    mockFetch.mockResolvedValueOnce(buildReplicateResponse(fakeProperties))

    // First call - should hit the API
    const result1 = await ModelSchemaService.getSchema('black-forest-labs/flux-2-pro')
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Second call - should use cache
    const result2 = await ModelSchemaService.getSchema('black-forest-labs/flux-2-pro')
    expect(mockFetch).toHaveBeenCalledTimes(1) // Still only 1 call
    expect(result2).toEqual(result1)
  })

  // AC-8: GIVEN die Replicate API ist nicht erreichbar oder liefert einen Fehler
  //       WHEN getModelSchema aufgerufen wird
  //       THEN wird ein Fehler geworfen (Service throws, Action catches)
  it('AC-8: should throw error when Replicate API fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    })

    await expect(
      ModelSchemaService.getSchema('black-forest-labs/flux-2-pro')
    ).rejects.toThrow('Schema konnte nicht geladen werden')
  })

  it('should throw error when API response has no properties at expected path', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ latest_version: {} }),
    })

    await expect(
      ModelSchemaService.getSchema('black-forest-labs/flux-2-pro')
    ).rejects.toThrow('Schema konnte nicht geladen werden')
  })

  it('should throw error for unknown model ID', async () => {
    await expect(
      ModelSchemaService.getSchema('unknown/model')
    ).rejects.toThrow('Unbekanntes Modell')
  })

  it('should throw error when fetch itself rejects (network error)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    await expect(
      ModelSchemaService.getSchema('black-forest-labs/flux-2-pro')
    ).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// supportsImg2Img — Slice 04 Acceptance Tests
// ---------------------------------------------------------------------------
describe('ModelSchemaService.supportsImg2Img', () => {
  beforeEach(() => {
    ModelSchemaService.clearCache()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // AC-1: GIVEN ein Modell, dessen Schema eine Property namens "image" enthaelt
  //       WHEN supportsImg2Img(modelId) aufgerufen wird
  //       THEN gibt die Methode true zurueck
  it('AC-1: should return true when schema contains "image" parameter', async () => {
    const properties = {
      prompt: { type: 'string' },
      image: { type: 'string', format: 'uri' },
      width: { type: 'integer' },
    }
    mockFetch.mockResolvedValueOnce(buildReplicateResponse(properties))

    const result = await ModelSchemaService.supportsImg2Img('black-forest-labs/flux-2-pro')

    expect(result).toBe(true)
  })

  // AC-2: GIVEN ein Modell, dessen Schema eine Property namens "image_prompt" enthaelt (und kein "image")
  //       WHEN supportsImg2Img(modelId) aufgerufen wird
  //       THEN gibt die Methode true zurueck
  it('AC-2: should return true when schema contains "image_prompt" parameter (no "image")', async () => {
    const properties = {
      prompt: { type: 'string' },
      image_prompt: { type: 'string', format: 'uri' },
    }
    mockFetch.mockResolvedValueOnce(buildReplicateResponse(properties))

    const result = await ModelSchemaService.supportsImg2Img('black-forest-labs/flux-2-pro')

    expect(result).toBe(true)
  })

  // AC-3: GIVEN ein Modell, dessen Schema eine Property namens "init_image" enthaelt (und weder "image" noch "image_prompt")
  //       WHEN supportsImg2Img(modelId) aufgerufen wird
  //       THEN gibt die Methode true zurueck
  it('AC-3: should return true when schema contains "init_image" parameter (no "image" or "image_prompt")', async () => {
    const properties = {
      prompt: { type: 'string' },
      init_image: { type: 'string', format: 'uri' },
    }
    mockFetch.mockResolvedValueOnce(buildReplicateResponse(properties))

    const result = await ModelSchemaService.supportsImg2Img('black-forest-labs/flux-2-pro')

    expect(result).toBe(true)
  })

  // AC-4: GIVEN ein Modell, dessen Schema keinen der Parameter "image", "image_prompt" oder "init_image" enthaelt
  //       WHEN supportsImg2Img(modelId) aufgerufen wird
  //       THEN gibt die Methode false zurueck
  it('AC-4: should return false when schema contains none of "image", "image_prompt", "init_image"', async () => {
    const properties = {
      prompt: { type: 'string' },
      width: { type: 'integer' },
      height: { type: 'integer' },
    }
    mockFetch.mockResolvedValueOnce(buildReplicateResponse(properties))

    const result = await ModelSchemaService.supportsImg2Img('black-forest-labs/flux-2-pro')

    expect(result).toBe(false)
  })

  // AC-5: GIVEN ein Modell, das bereits via getSchema() gecacht wurde
  //       WHEN supportsImg2Img(modelId) aufgerufen wird
  //       THEN wird fetch genau 0 Mal aufgerufen (kein zweiter API-Call; Schema kommt aus dem Cache)
  it('AC-5: should not call fetch when schema is already cached via getSchema()', async () => {
    const properties = {
      prompt: { type: 'string' },
      image: { type: 'string', format: 'uri' },
    }
    mockFetch.mockResolvedValueOnce(buildReplicateResponse(properties))

    // Pre-cache via getSchema
    await ModelSchemaService.getSchema('black-forest-labs/flux-2-pro')
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Reset to track only new calls
    mockFetch.mockClear()

    // supportsImg2Img should use cache — zero fetch calls
    const result = await ModelSchemaService.supportsImg2Img('black-forest-labs/flux-2-pro')

    expect(result).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(0)
  })

  // AC-6: GIVEN ein Modell, das noch nicht gecacht wurde
  //       WHEN supportsImg2Img(modelId) aufgerufen wird
  //       THEN wird fetch genau 1 Mal aufgerufen, und danach ist das Schema im Cache
  //            (ein weiterer Aufruf von supportsImg2Img loest keinen weiteren Fetch aus)
  it('AC-6: should call fetch exactly once for uncached model, then use cache for subsequent calls', async () => {
    const properties = {
      prompt: { type: 'string' },
      image: { type: 'string', format: 'uri' },
    }
    mockFetch.mockResolvedValueOnce(buildReplicateResponse(properties))

    // First call — should trigger exactly 1 fetch
    const result1 = await ModelSchemaService.supportsImg2Img('black-forest-labs/flux-2-pro')
    expect(result1).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Second call — should NOT trigger another fetch
    const result2 = await ModelSchemaService.supportsImg2Img('black-forest-labs/flux-2-pro')
    expect(result2).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1) // Still only 1 total
  })

  // AC-7: GIVEN ein unbekanntes Modell (nicht in MODELS aus lib/models.ts)
  //       WHEN supportsImg2Img(modelId) aufgerufen wird
  //       THEN wirft die Methode einen Error mit der Meldung "Unbekanntes Modell"
  it('AC-7: should throw "Unbekanntes Modell" for an unknown modelId', async () => {
    await expect(
      ModelSchemaService.supportsImg2Img('unknown/nonexistent-model')
    ).rejects.toThrow('Unbekanntes Modell')

    // fetch should never be called for an unknown model
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
