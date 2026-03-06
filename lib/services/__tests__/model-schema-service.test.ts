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
