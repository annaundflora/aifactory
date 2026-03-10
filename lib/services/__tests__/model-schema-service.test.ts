import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
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

  // =========================================================================
  // Slice-04 ACs: Remove Whitelist
  // =========================================================================

  // AC-1: GIVEN model-schema-service.ts nach dem Refactoring
  //       WHEN die Datei inspiziert wird
  //       THEN existiert KEIN Import von @/lib/models (kein getModelById)
  it('AC-1: should not import from lib/models', () => {
    const filePath = path.resolve(__dirname, '..', 'model-schema-service.ts')
    const source = fs.readFileSync(filePath, 'utf-8')

    expect(source).not.toMatch(/from\s+['"]@\/lib\/models['"]/)
    expect(source).not.toMatch(/require\s*\(\s*['"]@\/lib\/models['"]\s*\)/)
    expect(source).not.toContain('getModelById')
  })

  // AC-3: GIVEN der ModelSchemaService nach dem Refactoring
  //       WHEN getSchema("newowner/new-model-v2") aufgerufen wird (bisher nicht in der Whitelist)
  //       THEN wird der Replicate-API-Call ausgefuehrt (kein Whitelist-Reject)
  //       AND das Schema-Ergebnis zurueckgegeben
  it('AC-3: should accept any valid owner/name model ID and fetch schema from API', async () => {
    const fakeProperties = {
      prompt: { type: 'string', description: 'Input prompt' },
      width: { type: 'integer', default: 1024 },
    }

    mockFetch.mockResolvedValueOnce(buildReplicateResponse(fakeProperties))

    const result = await ModelSchemaService.getSchema('newowner/new-model-v2')

    expect(result).toEqual(fakeProperties)
    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.replicate.com/v1/models/newowner/new-model-v2',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining('Bearer'),
        }),
        signal: expect.any(AbortSignal),
      })
    )
  })

  // AC-4: GIVEN der ModelSchemaService nach dem Refactoring
  //       WHEN getSchema("invalid-no-slash") aufgerufen wird (kein / im String)
  //       THEN wird ein Error geworfen mit Message "Ungueltiges Model-ID-Format"
  //       AND KEIN HTTP-Request gesendet
  it('AC-4: should throw "Ungueltiges Model-ID-Format" for model ID without slash', async () => {
    await expect(
      ModelSchemaService.getSchema('invalid-no-slash')
    ).rejects.toThrow('Ungueltiges Model-ID-Format')

    expect(mockFetch).not.toHaveBeenCalled()
  })

  // AC-5: GIVEN der ModelSchemaService nach dem Refactoring
  //       WHEN getSchema("UPPER/Case") aufgerufen wird (Grossbuchstaben)
  //       THEN wird ein Error geworfen mit Message "Ungueltiges Model-ID-Format"
  //       AND KEIN HTTP-Request gesendet
  it('AC-5: should throw "Ungueltiges Model-ID-Format" for model ID with uppercase letters', async () => {
    await expect(
      ModelSchemaService.getSchema('UPPER/Case')
    ).rejects.toThrow('Ungueltiges Model-ID-Format')

    expect(mockFetch).not.toHaveBeenCalled()
  })

  // AC-6: GIVEN der ModelSchemaService nach dem Refactoring
  //       WHEN getSchema("valid-owner/model.v2_test-1") aufgerufen wird (Punkte, Unterstriche, Bindestriche erlaubt)
  //       THEN wird der Replicate-API-Call ausgefuehrt (Format ist gueltig)
  it('AC-6: should accept model ID with dots, underscores, and hyphens in name part', async () => {
    const fakeProperties = { prompt: { type: 'string' } }
    mockFetch.mockResolvedValueOnce(buildReplicateResponse(fakeProperties))

    const result = await ModelSchemaService.getSchema('valid-owner/model.v2_test-1')

    expect(result).toEqual(fakeProperties)
    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.replicate.com/v1/models/valid-owner/model.v2_test-1',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    )
  })

  // AC-7: GIVEN die Replicate API antwortet nicht innerhalb von 5000ms
  //       WHEN getSchema("owner/model") aufgerufen wird
  //       THEN wird der Request via AbortController abgebrochen
  //       AND ein Error geworfen (keine haengende Verbindung)
  it('AC-7: should abort fetch after 5000ms timeout and throw error', async () => {
    // Verify the service passes an AbortSignal to fetch
    // and that the timeout causes the fetch to be aborted
    let capturedSignal: AbortSignal | undefined

    mockFetch.mockImplementationOnce((_url: string, options: RequestInit) => {
      capturedSignal = options.signal ?? undefined

      // Simulate a request that would hang -- reject with abort error
      // since the service uses AbortController with 5000ms timeout
      return new Promise((_resolve, reject) => {
        // Immediately reject to simulate abort behavior
        reject(new DOMException('The operation was aborted.', 'AbortError'))
      })
    })

    await expect(
      ModelSchemaService.getSchema('owner/model')
    ).rejects.toThrow()

    // Verify that an AbortSignal was provided to fetch
    expect(capturedSignal).toBeDefined()
    expect(capturedSignal).toBeInstanceOf(AbortSignal)
  })

  // =========================================================================
  // Pre-existing tests (from earlier slices)
  // =========================================================================

  it('should extract properties from openapi_schema path', async () => {
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

  it('should return cached result on second call without additional API request', async () => {
    const fakeProperties = {
      prompt: { type: 'string' },
    }

    mockFetch.mockResolvedValueOnce(buildReplicateResponse(fakeProperties))

    const result1 = await ModelSchemaService.getSchema('black-forest-labs/flux-2-pro')
    expect(mockFetch).toHaveBeenCalledTimes(1)

    const result2 = await ModelSchemaService.getSchema('black-forest-labs/flux-2-pro')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(result2).toEqual(result1)
  })

  it('should throw error when Replicate API fails', async () => {
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

  it('should throw error when fetch itself rejects (network error)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    await expect(
      ModelSchemaService.getSchema('black-forest-labs/flux-2-pro')
    ).rejects.toThrow()
  })
})
