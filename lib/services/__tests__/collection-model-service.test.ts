import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CollectionModel } from '@/lib/types/collection-model'

// Mock fetch globally per Mocking Strategy: mock_external
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Set the API token for all tests
vi.stubGlobal('process', {
  ...process,
  env: { ...process.env, REPLICATE_API_TOKEN: 'test-token-abc123' },
})

// Helper: build a valid Replicate Collections API response
function buildCollectionResponse(models: Record<string, unknown>[]) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ models }),
  }
}

// Sample model data matching the CollectionModel interface
const sampleModels: Record<string, unknown>[] = [
  {
    url: 'https://replicate.com/stability-ai/sdxl',
    owner: 'stability-ai',
    name: 'sdxl',
    description: 'A text-to-image generative AI model',
    cover_image_url: 'https://example.com/sdxl.jpg',
    run_count: 50000,
    created_at: '2025-01-15T00:00:00Z',
    default_example: { id: 'abc' },
    latest_version: { id: 'v1' },
  },
  {
    url: 'https://replicate.com/black-forest-labs/flux-schnell',
    owner: 'black-forest-labs',
    name: 'flux-schnell',
    description: null,
    cover_image_url: null,
    run_count: 30000,
    created_at: '2025-01-15T00:00:00Z',
  },
]

// Expected mapped CollectionModel[] (only relevant fields, no default_example/latest_version)
const expectedModels: CollectionModel[] = [
  {
    url: 'https://replicate.com/stability-ai/sdxl',
    owner: 'stability-ai',
    name: 'sdxl',
    description: 'A text-to-image generative AI model',
    cover_image_url: 'https://example.com/sdxl.jpg',
    run_count: 50000,
    created_at: '2025-01-15T00:00:00Z',
  },
  {
    url: 'https://replicate.com/black-forest-labs/flux-schnell',
    owner: 'black-forest-labs',
    name: 'flux-schnell',
    description: null,
    cover_image_url: null,
    run_count: 30000,
    created_at: '2025-01-15T00:00:00Z',
  },
]

describe('CollectionModelService', () => {
  // We dynamically import the service so that the stubbed fetch/env are in place
  let getCollectionModels: () => Promise<CollectionModel[] | { error: string }>
  let clearCache: () => void

  beforeEach(async () => {
    // Re-import to get fresh references; clearCache resets internal module state
    const mod = await import('@/lib/services/collection-model-service')
    getCollectionModels = mod.getCollectionModels
    clearCache = mod.clearCache
    clearCache()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  // ---------------------------------------------------------------------------
  // AC-1: GIVEN kein Cache-Eintrag existiert
  //       WHEN `getCollectionModels()` aufgerufen wird
  //       THEN wird `GET /v1/collections/text-to-image` mit Bearer-Token aufgerufen
  //       AND das Ergebnis als `CollectionModel[]` zurueckgegeben
  //       AND das Ergebnis im Cache gespeichert
  // ---------------------------------------------------------------------------
  it('AC-1: should fetch from API on cache miss and return CollectionModel[]', async () => {
    mockFetch.mockResolvedValueOnce(buildCollectionResponse(sampleModels))

    const result = await getCollectionModels()

    // THEN: fetch was called with correct URL and Bearer token
    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.replicate.com/v1/collections/text-to-image',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token-abc123',
        }),
        signal: expect.any(AbortSignal),
      })
    )

    // THEN: result is CollectionModel[] (not an error object)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toEqual(expectedModels)

    // AND: result is cached (second call does NOT trigger fetch)
    const result2 = await getCollectionModels()
    expect(mockFetch).toHaveBeenCalledOnce() // still 1
    expect(result2).toEqual(expectedModels)
  })

  // ---------------------------------------------------------------------------
  // AC-2: GIVEN ein gueltiger Cache-Eintrag existiert (juenger als 3.600.000ms)
  //       WHEN `getCollectionModels()` aufgerufen wird
  //       THEN wird KEIN HTTP-Request gesendet
  //       AND das gecachte `CollectionModel[]` zurueckgegeben
  // ---------------------------------------------------------------------------
  it('AC-2: should return cached result without HTTP request on cache hit', async () => {
    mockFetch.mockResolvedValueOnce(buildCollectionResponse(sampleModels))

    // First call populates cache
    const result1 = await getCollectionModels()
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Second call should use cache
    const result2 = await getCollectionModels()
    expect(mockFetch).toHaveBeenCalledTimes(1) // No additional fetch
    expect(result2).toEqual(result1)
    expect(Array.isArray(result2)).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // AC-3: GIVEN ein Cache-Eintrag aelter als 3.600.000ms existiert
  //       WHEN `getCollectionModels()` aufgerufen wird
  //       THEN wird ein neuer HTTP-Request gesendet
  //       AND der Cache mit dem neuen Ergebnis aktualisiert
  // ---------------------------------------------------------------------------
  it('AC-3: should refetch from API after cache TTL (3600000ms) expires', async () => {
    vi.useFakeTimers()

    mockFetch.mockResolvedValueOnce(buildCollectionResponse(sampleModels))

    // First call - populates cache
    await getCollectionModels()
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Advance time by exactly 3,600,000ms (1 hour) to expire cache
    vi.advanceTimersByTime(3_600_000)

    const updatedModels: Record<string, unknown>[] = [
      {
        url: 'https://replicate.com/new/model',
        owner: 'new-owner',
        name: 'new-model',
        description: 'Updated model',
        cover_image_url: 'https://example.com/new.jpg',
        run_count: 99999,
        created_at: '2025-01-15T00:00:00Z',
      },
    ]
    mockFetch.mockResolvedValueOnce(buildCollectionResponse(updatedModels))

    // Second call after TTL - should refetch
    const result = await getCollectionModels()
    expect(mockFetch).toHaveBeenCalledTimes(2)

    // AND: cache is updated with new result
    expect(Array.isArray(result)).toBe(true)
    expect(result).toEqual([
      {
        url: 'https://replicate.com/new/model',
        owner: 'new-owner',
        name: 'new-model',
        description: 'Updated model',
        cover_image_url: 'https://example.com/new.jpg',
        run_count: 99999,
        created_at: '2025-01-15T00:00:00Z',
      },
    ])

    // Verify cache is updated: third call should NOT fetch again
    const result3 = await getCollectionModels()
    expect(mockFetch).toHaveBeenCalledTimes(2) // still 2
    expect(result3).toEqual(result)
  })

  // ---------------------------------------------------------------------------
  // AC-4: GIVEN die API einen HTTP-Error zurueckgibt (z.B. Status 500)
  //       WHEN `getCollectionModels()` aufgerufen wird
  //       THEN wird `{ error: string }` zurueckgegeben
  //       AND der fehlerhafte Response wird NICHT gecacht
  // ---------------------------------------------------------------------------
  it('AC-4: should return error object on API failure and not cache the error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({}),
    })

    const result = await getCollectionModels()

    // THEN: error object returned
    expect(result).toHaveProperty('error')
    expect(typeof (result as { error: string }).error).toBe('string')
    expect((result as { error: string }).error).toContain('500')

    // AND: error is NOT cached - next call triggers a new fetch
    mockFetch.mockResolvedValueOnce(buildCollectionResponse(sampleModels))
    const result2 = await getCollectionModels()
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(Array.isArray(result2)).toBe(true)
    expect(result2).toEqual(expectedModels)
  })

  // ---------------------------------------------------------------------------
  // AC-5: GIVEN die API laenger als 5000ms nicht antwortet
  //       WHEN `getCollectionModels()` aufgerufen wird
  //       THEN wird der Request via `AbortController` abgebrochen
  //       AND `{ error: string }` zurueckgegeben (keine haengende Verbindung)
  // ---------------------------------------------------------------------------
  it('AC-5: should abort fetch after 5000ms timeout and return error', async () => {
    vi.useFakeTimers()

    // Simulate a fetch that never resolves until aborted
    mockFetch.mockImplementationOnce(
      (_url: string, options: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          // When the signal is aborted, reject with AbortError
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              const abortError = new DOMException(
                'The operation was aborted.',
                'AbortError'
              )
              reject(abortError)
            })
          }
        })
      }
    )

    const resultPromise = getCollectionModels()

    // Advance timers past the 5000ms timeout threshold
    await vi.advanceTimersByTimeAsync(5_100)

    const result = await resultPromise

    // THEN: error object returned
    expect(result).toHaveProperty('error')
    expect(typeof (result as { error: string }).error).toBe('string')
  })

  // ---------------------------------------------------------------------------
  // AC-6: GIVEN ein Cache-Eintrag existiert
  //       WHEN `clearCache()` aufgerufen wird
  //       THEN ist der Cache leer
  //       AND der naechste `getCollectionModels()`-Aufruf sendet einen neuen HTTP-Request
  // ---------------------------------------------------------------------------
  it('AC-6: should clear cache so next call fetches from API again', async () => {
    mockFetch.mockResolvedValueOnce(buildCollectionResponse(sampleModels))

    // Populate cache
    await getCollectionModels()
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Clear cache
    clearCache()

    // Next call should fetch again
    mockFetch.mockResolvedValueOnce(buildCollectionResponse(sampleModels))
    const result = await getCollectionModels()
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toEqual(expectedModels)
  })

  // ---------------------------------------------------------------------------
  // AC-7: GIVEN das `CollectionModel`-Interface
  //       WHEN es importiert wird aus `lib/types/collection-model.ts`
  //       THEN enthaelt es die Felder `url`, `owner`, `name`, `description`,
  //            `cover_image_url`, `run_count`
  // ---------------------------------------------------------------------------
  it('AC-7: should export CollectionModel type with required fields', async () => {
    // We verify that a valid CollectionModel object conforms to the interface
    // by checking the runtime shape returned from the service.
    mockFetch.mockResolvedValueOnce(buildCollectionResponse(sampleModels))

    const result = await getCollectionModels()

    expect(Array.isArray(result)).toBe(true)
    const models = result as CollectionModel[]
    expect(models.length).toBeGreaterThan(0)

    // Verify each model has all required fields
    for (const model of models) {
      expect(model).toHaveProperty('url')
      expect(model).toHaveProperty('owner')
      expect(model).toHaveProperty('name')
      expect(model).toHaveProperty('description')
      expect(model).toHaveProperty('cover_image_url')
      expect(model).toHaveProperty('run_count')

      // Verify types
      expect(typeof model.url).toBe('string')
      expect(typeof model.owner).toBe('string')
      expect(typeof model.name).toBe('string')
      expect(
        model.description === null || typeof model.description === 'string'
      ).toBe(true)
      expect(
        model.cover_image_url === null ||
          typeof model.cover_image_url === 'string'
      ).toBe(true)
      expect(typeof model.run_count).toBe('number')
    }

    // Verify that extra fields (default_example, latest_version) are NOT present
    const firstModel = models[0]
    expect(firstModel).not.toHaveProperty('default_example')
    expect(firstModel).not.toHaveProperty('latest_version')
  })
})
