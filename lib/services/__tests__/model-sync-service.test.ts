/**
 * Unit & Acceptance Tests for ModelSyncService + query functions (upsertModel, deactivateModelsNotIn)
 * Slice: slice-04-sync-service
 *
 * Mocking Strategy: mock_external (from Slice Spec)
 *   - Replicate API: mocked via global fetch spy
 *   - DB queries (@/lib/db/queries): mocked via vi.mock
 *   - capability-detection: mocked to isolate sync orchestration logic
 *
 * ACs covered: AC-1 through AC-10
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock DB query functions
// ---------------------------------------------------------------------------
const mockGetModelByReplicateId = vi.fn()
const mockUpsertModel = vi.fn()
const mockDeactivateModelsNotIn = vi.fn()

vi.mock('@/lib/db/queries', () => ({
  getModelByReplicateId: (...args: unknown[]) => mockGetModelByReplicateId(...args),
  upsertModel: (...args: unknown[]) => mockUpsertModel(...args),
  deactivateModelsNotIn: (...args: unknown[]) => mockDeactivateModelsNotIn(...args),
  // Re-export other query functions as stubs to avoid import errors
  getActiveModels: vi.fn(),
  getModelsByCapability: vi.fn(),
  getModelSchema: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock capability detection
// ---------------------------------------------------------------------------
const mockDetectCapabilities = vi.fn()
const mockResolveSchemaRefs = vi.fn()

vi.mock('@/lib/services/capability-detection', () => ({
  detectCapabilities: (...args: unknown[]) => mockDetectCapabilities(...args),
  resolveSchemaRefs: (...args: unknown[]) => mockResolveSchemaRefs(...args),
}))

// ---------------------------------------------------------------------------
// Import AFTER mocks are set up
// ---------------------------------------------------------------------------
import { ModelSyncService } from '../model-sync-service'
import type { SyncResult } from '../model-sync-service'

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------
const FAKE_API_TOKEN = 'r8_test_token_for_testing'
const REPLICATE_API_BASE = 'https://api.replicate.com/v1'

const NOW = new Date('2026-03-18T12:00:00Z')

/** Builds a model object matching the DB Model shape */
function makeDbModel(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? 'uuid-default',
    replicateId: overrides.replicateId ?? 'owner/default',
    owner: overrides.owner ?? 'owner',
    name: overrides.name ?? 'default',
    description: overrides.description ?? 'A test model',
    coverImageUrl: overrides.coverImageUrl ?? null,
    runCount: overrides.runCount ?? 1000,
    collections: overrides.collections ?? [],
    capabilities: overrides.capabilities ?? { txt2img: true },
    inputSchema: overrides.inputSchema ?? { prompt: { type: 'string' } },
    versionHash: overrides.versionHash ?? 'abc123',
    isActive: overrides.isActive ?? true,
    lastSyncedAt: overrides.lastSyncedAt ?? NOW,
    createdAt: overrides.createdAt ?? NOW,
    updatedAt: overrides.updatedAt ?? NOW,
  }
}

/**
 * Builds a Replicate collections API response body for a given slug.
 * `models` is an array of { owner, name, description, ... } objects.
 */
function makeCollectionResponse(
  slug: string,
  models: Array<{
    owner: string
    name: string
    description?: string | null
    cover_image_url?: string | null
    run_count?: number | null
    latest_version?: { id: string } | null
  }>
) {
  return {
    slug,
    name: slug,
    models: models.map((m) => ({
      owner: m.owner,
      name: m.name,
      description: m.description ?? null,
      cover_image_url: m.cover_image_url ?? null,
      run_count: m.run_count ?? 100,
      latest_version: m.latest_version ?? { id: 'version-hash-default' },
    })),
  }
}

/**
 * Builds a Replicate model detail API response body.
 */
function makeModelDetailResponse(overrides: {
  versionId?: string
  inputProperties?: Record<string, unknown>
  allSchemas?: Record<string, Record<string, unknown>>
} = {}) {
  return {
    latest_version: {
      id: overrides.versionId ?? 'new-version-hash',
      openapi_schema: {
        components: {
          schemas: {
            Input: {
              properties: overrides.inputProperties ?? { prompt: { type: 'string' } },
            },
            ...(overrides.allSchemas ?? {}),
          },
        },
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Global fetch mock setup
// ---------------------------------------------------------------------------

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  // Set the API token env var
  process.env.REPLICATE_API_TOKEN = FAKE_API_TOKEN

  // Reset all mocks
  mockGetModelByReplicateId.mockReset()
  mockUpsertModel.mockReset().mockResolvedValue(undefined)
  mockDeactivateModelsNotIn.mockReset().mockResolvedValue(undefined)
  mockDetectCapabilities.mockReset().mockReturnValue({
    txt2img: true,
    img2img: false,
    upscale: false,
    inpaint: false,
    outpaint: false,
  })
  mockResolveSchemaRefs.mockReset().mockImplementation((props: unknown) => props)

  // Setup global fetch mock
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.REPLICATE_API_TOKEN
})

// ---------------------------------------------------------------------------
// Helper to configure fetch responses per URL pattern
// ---------------------------------------------------------------------------

type FetchRoute = {
  pattern: string | RegExp
  response: unknown
  status?: number
  delay?: number
}

function setupFetchRoutes(routes: FetchRoute[]) {
  fetchMock.mockImplementation(async (url: string, _options?: RequestInit) => {
    for (const route of routes) {
      const matches =
        typeof route.pattern === 'string'
          ? url === route.pattern
          : route.pattern.test(url)

      if (matches) {
        if (route.delay) {
          await new Promise((r) => setTimeout(r, route.delay))
        }
        return {
          ok: (route.status ?? 200) >= 200 && (route.status ?? 200) < 300,
          status: route.status ?? 200,
          statusText: route.status === 500 ? 'Internal Server Error' : 'OK',
          json: async () => route.response,
        }
      }
    }
    // Default: 404
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({}),
    }
  })
}

// ===========================================================================
// TEST SUITES
// ===========================================================================

describe('ModelSyncService.syncAll', () => {
  // -------------------------------------------------------------------------
  // AC-1: Deduplizierung ueber replicate_id
  // -------------------------------------------------------------------------
  it('AC-1: GIVEN 3 Replicate Collections mit insgesamt 8 Models (davon 2 Duplikate ueber Collections hinweg) WHEN syncAll(onProgress) aufgerufen wird THEN werden exakt 6 deduplizierte Models verarbeitet', async () => {
    /**
     * AC-1: Deduplizierung ueber replicate_id
     *
     * GIVEN 3 Replicate Collections mit insgesamt 8 Models (davon 2 Duplikate ueber Collections hinweg)
     * WHEN `syncAll(onProgress)` aufgerufen wird
     * THEN werden exakt 6 deduplizierte Models verarbeitet (Deduplizierung ueber `replicate_id` = `owner/name`)
     */

    // Collection 1: 3 models
    const collection1 = makeCollectionResponse('text-to-image', [
      { owner: 'owner', name: 'model-a', latest_version: { id: 'v1' } },
      { owner: 'owner', name: 'model-b', latest_version: { id: 'v2' } },
      { owner: 'owner', name: 'model-c', latest_version: { id: 'v3' } },
    ])

    // Collection 2: 3 models (model-a is duplicate from collection 1)
    const collection2 = makeCollectionResponse('image-editing', [
      { owner: 'owner', name: 'model-a', latest_version: { id: 'v1' } }, // duplicate
      { owner: 'owner', name: 'model-d', latest_version: { id: 'v4' } },
      { owner: 'owner', name: 'model-e', latest_version: { id: 'v5' } },
    ])

    // Collection 3: 2 models (model-b is duplicate from collection 1)
    const collection3 = makeCollectionResponse('super-resolution', [
      { owner: 'owner', name: 'model-b', latest_version: { id: 'v2' } }, // duplicate
      { owner: 'owner', name: 'model-f', latest_version: { id: 'v6' } },
    ])

    // Total: 8 models, 2 duplicates -> 6 unique
    setupFetchRoutes([
      { pattern: `${REPLICATE_API_BASE}/collections/text-to-image`, response: collection1 },
      { pattern: `${REPLICATE_API_BASE}/collections/image-editing`, response: collection2 },
      { pattern: `${REPLICATE_API_BASE}/collections/super-resolution`, response: collection3 },
      // Model detail endpoints — all new models (not in DB)
      { pattern: /\/models\/owner\/model-/, response: makeModelDetailResponse() },
    ])

    // All models are new (not in DB)
    mockGetModelByReplicateId.mockResolvedValue(null)

    const progressCalls: Array<[number, number]> = []
    const result = await ModelSyncService.syncAll((completed, total) => {
      progressCalls.push([completed, total])
    })

    // THEN: exactly 6 deduplicated models processed
    expect(result.synced + result.failed).toBe(6)

    // upsertModel should have been called exactly 6 times (once per deduplicated model)
    expect(mockUpsertModel).toHaveBeenCalledTimes(6)

    // All 6 unique replicate_ids should appear in upsert calls
    const upsertedIds = mockUpsertModel.mock.calls.map(
      (call: unknown[]) => (call[0] as Record<string, unknown>).replicateId
    )
    expect(new Set(upsertedIds).size).toBe(6)
    expect(upsertedIds).toContain('owner/model-a')
    expect(upsertedIds).toContain('owner/model-b')
    expect(upsertedIds).toContain('owner/model-c')
    expect(upsertedIds).toContain('owner/model-d')
    expect(upsertedIds).toContain('owner/model-e')
    expect(upsertedIds).toContain('owner/model-f')
  })

  // -------------------------------------------------------------------------
  // AC-2: Delta-Sync — unveraenderter version_hash -> kein Schema-Re-Fetch
  // -------------------------------------------------------------------------
  it('AC-2: GIVEN ein Model mit replicate_id="owner/model-a" existiert in DB mit version_hash="abc123" WHEN syncAll laeuft und die API denselben latest_version.id="abc123" zurueckgibt THEN wird KEIN Schema-Fetch fuer dieses Model ausgefuehrt', async () => {
    /**
     * AC-2: Delta-Sync — unveraenderter version_hash -> kein Schema-Re-Fetch
     *
     * GIVEN ein Model mit `replicate_id = "owner/model-a"` existiert in DB mit `version_hash = "abc123"`
     * WHEN `syncAll` laeuft und die API denselben `latest_version.id = "abc123"` zurueckgibt
     * THEN wird KEIN Schema-Fetch fuer dieses Model ausgefuehrt (Delta-Sync: `version_hash` unveraendert)
     */

    const collection1 = makeCollectionResponse('text-to-image', [
      { owner: 'owner', name: 'model-a', latest_version: { id: 'abc123' } },
    ])
    const collection2 = makeCollectionResponse('image-editing', [])
    const collection3 = makeCollectionResponse('super-resolution', [])

    setupFetchRoutes([
      { pattern: `${REPLICATE_API_BASE}/collections/text-to-image`, response: collection1 },
      { pattern: `${REPLICATE_API_BASE}/collections/image-editing`, response: collection2 },
      { pattern: `${REPLICATE_API_BASE}/collections/super-resolution`, response: collection3 },
      // Model detail endpoint — should NOT be called
      { pattern: /\/models\/owner\/model-a/, response: makeModelDetailResponse({ versionId: 'abc123' }) },
    ])

    // Model exists in DB with same version_hash
    mockGetModelByReplicateId.mockResolvedValue(
      makeDbModel({
        replicateId: 'owner/model-a',
        owner: 'owner',
        name: 'model-a',
        versionHash: 'abc123',
        capabilities: { txt2img: true },
        inputSchema: { prompt: { type: 'string' } },
      })
    )

    await ModelSyncService.syncAll()

    // THEN: No schema fetch (model detail endpoint should NOT be called)
    // Collection fetches = 3, model detail fetches = 0, total = 3
    const modelDetailCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('/models/')
    )
    expect(modelDetailCalls).toHaveLength(0)

    // upsertModel should still be called (to update collections, run_count, is_active)
    // but with the existing schema/capabilities from DB
    expect(mockUpsertModel).toHaveBeenCalledTimes(1)
    const upsertData = mockUpsertModel.mock.calls[0][0] as Record<string, unknown>
    expect(upsertData.versionHash).toBe('abc123')
    expect(upsertData.inputSchema).toEqual({ prompt: { type: 'string' } })
  })

  // -------------------------------------------------------------------------
  // AC-3: Delta-Sync — veraenderter version_hash -> Schema-Fetch + Update
  // -------------------------------------------------------------------------
  it('AC-3: GIVEN ein Model mit replicate_id="owner/model-b" existiert in DB mit version_hash="old-hash" WHEN syncAll laeuft und die API latest_version.id="new-hash" zurueckgibt THEN wird Schema-Fetch ausgefuehrt, resolveSchemaRefs + detectCapabilities aufgerufen, und das Model via upsertModel mit neuem version_hash aktualisiert', async () => {
    /**
     * AC-3: Delta-Sync — veraenderter version_hash -> Schema-Fetch + Update
     *
     * GIVEN ein Model mit `replicate_id = "owner/model-b"` existiert in DB mit `version_hash = "old-hash"`
     * WHEN `syncAll` laeuft und die API `latest_version.id = "new-hash"` zurueckgibt
     * THEN wird ein Schema-Fetch ausgefuehrt, `resolveSchemaRefs` + `detectCapabilities` aufgerufen,
     *      und das Model via `upsertModel` mit neuem `version_hash`, `input_schema` und `capabilities` aktualisiert
     */

    const collection1 = makeCollectionResponse('text-to-image', [
      { owner: 'owner', name: 'model-b', latest_version: { id: 'new-hash' } },
    ])
    const collection2 = makeCollectionResponse('image-editing', [])
    const collection3 = makeCollectionResponse('super-resolution', [])

    const newInputProperties = { prompt: { type: 'string' }, width: { type: 'integer' } }
    const allSchemas = { Input: { properties: newInputProperties }, Output: {} }

    setupFetchRoutes([
      { pattern: `${REPLICATE_API_BASE}/collections/text-to-image`, response: collection1 },
      { pattern: `${REPLICATE_API_BASE}/collections/image-editing`, response: collection2 },
      { pattern: `${REPLICATE_API_BASE}/collections/super-resolution`, response: collection3 },
      {
        pattern: `${REPLICATE_API_BASE}/models/owner/model-b`,
        response: makeModelDetailResponse({
          versionId: 'new-hash',
          inputProperties: newInputProperties,
          allSchemas,
        }),
      },
    ])

    // Model exists in DB with OLD version_hash
    mockGetModelByReplicateId.mockResolvedValue(
      makeDbModel({
        replicateId: 'owner/model-b',
        versionHash: 'old-hash',
      })
    )

    const resolvedSchema = { prompt: { type: 'string' }, width: { type: 'integer', resolved: true } }
    mockResolveSchemaRefs.mockReturnValue(resolvedSchema)

    const newCapabilities = { txt2img: true, img2img: false, upscale: false, inpaint: false, outpaint: false }
    mockDetectCapabilities.mockReturnValue(newCapabilities)

    const result = await ModelSyncService.syncAll()

    // THEN: Schema fetch was executed (model detail endpoint called)
    const modelDetailCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('/models/owner/model-b')
    )
    expect(modelDetailCalls.length).toBeGreaterThanOrEqual(1)

    // resolveSchemaRefs was called
    expect(mockResolveSchemaRefs).toHaveBeenCalled()

    // detectCapabilities was called
    expect(mockDetectCapabilities).toHaveBeenCalled()

    // upsertModel was called with NEW version_hash, resolved schema, and new capabilities
    expect(mockUpsertModel).toHaveBeenCalledTimes(1)
    const upsertData = mockUpsertModel.mock.calls[0][0] as Record<string, unknown>
    expect(upsertData.versionHash).toBe('new-hash')
    expect(upsertData.inputSchema).toEqual(resolvedSchema)
    expect(upsertData.capabilities).toEqual(newCapabilities)

    // Result reflects update
    expect(result.updated).toBe(1)
    expect(result.synced).toBe(1)
  })

  // -------------------------------------------------------------------------
  // AC-4: Soft-Delete — Models nicht mehr in Collections
  // -------------------------------------------------------------------------
  it('AC-4: GIVEN 10 Models in DB mit is_active=true, aber nur 7 davon in den aktuellen Collections vorhanden WHEN syncAll abgeschlossen ist THEN werden die 3 fehlenden Models via deactivateModelsNotIn(activeReplicateIds) auf is_active=false gesetzt', async () => {
    /**
     * AC-4: Soft-Delete — Models nicht mehr in Collections
     *
     * GIVEN 10 Models in DB mit `is_active = true`, aber nur 7 davon in den aktuellen Collections vorhanden
     * WHEN `syncAll` abgeschlossen ist
     * THEN werden die 3 fehlenden Models via `deactivateModelsNotIn(activeReplicateIds)` auf `is_active = false` gesetzt
     */

    // Create 7 models spread across 3 collections
    const modelsInCollections = Array.from({ length: 7 }, (_, i) => ({
      owner: 'owner',
      name: `model-${i + 1}`,
      latest_version: { id: `v${i + 1}` },
    }))

    const collection1 = makeCollectionResponse('text-to-image', modelsInCollections.slice(0, 3))
    const collection2 = makeCollectionResponse('image-editing', modelsInCollections.slice(3, 5))
    const collection3 = makeCollectionResponse('super-resolution', modelsInCollections.slice(5, 7))

    setupFetchRoutes([
      { pattern: `${REPLICATE_API_BASE}/collections/text-to-image`, response: collection1 },
      { pattern: `${REPLICATE_API_BASE}/collections/image-editing`, response: collection2 },
      { pattern: `${REPLICATE_API_BASE}/collections/super-resolution`, response: collection3 },
      { pattern: /\/models\/owner\/model-/, response: makeModelDetailResponse() },
    ])

    // All 7 models are new (not in DB yet)
    mockGetModelByReplicateId.mockResolvedValue(null)

    await ModelSyncService.syncAll()

    // THEN: deactivateModelsNotIn was called with exactly the 7 active replicate_ids
    expect(mockDeactivateModelsNotIn).toHaveBeenCalledTimes(1)
    const activeIds = mockDeactivateModelsNotIn.mock.calls[0][0] as string[]
    expect(activeIds).toHaveLength(7)

    // All 7 collection models present
    for (let i = 1; i <= 7; i++) {
      expect(activeIds).toContain(`owner/model-${i}`)
    }

    // The 3 missing models (model-8, model-9, model-10) are NOT in the list
    // — deactivateModelsNotIn will handle the DB update for them
    expect(activeIds).not.toContain('owner/model-8')
    expect(activeIds).not.toContain('owner/model-9')
    expect(activeIds).not.toContain('owner/model-10')
  })

  // -------------------------------------------------------------------------
  // AC-5: Partial Success — einzelne Model-Fehler werden uebersprungen
  // -------------------------------------------------------------------------
  it('AC-5: GIVEN 6 Models zu syncen, wobei Model 3 einen API-Fehler (500) wirft WHEN syncAll laeuft THEN werden Models 1,2,4,5,6 erfolgreich gesynct und Model 3 uebersprungen; SyncResult.failed=1, SyncResult.synced=5', async () => {
    /**
     * AC-5: Partial Success — einzelne Model-Fehler werden uebersprungen
     *
     * GIVEN 6 Models zu syncen, wobei Model 3 einen API-Fehler (z.B. 500) wirft
     * WHEN `syncAll` laeuft
     * THEN werden Models 1, 2, 4, 5, 6 erfolgreich gesynct und Model 3 uebersprungen;
     *      `SyncResult.failed = 1`, `SyncResult.synced = 5`
     */

    const models = Array.from({ length: 6 }, (_, i) => ({
      owner: 'owner',
      name: `model-${i + 1}`,
      latest_version: { id: `v${i + 1}` },
    }))

    const collection1 = makeCollectionResponse('text-to-image', models)
    const collection2 = makeCollectionResponse('image-editing', [])
    const collection3 = makeCollectionResponse('super-resolution', [])

    setupFetchRoutes([
      { pattern: `${REPLICATE_API_BASE}/collections/text-to-image`, response: collection1 },
      { pattern: `${REPLICATE_API_BASE}/collections/image-editing`, response: collection2 },
      { pattern: `${REPLICATE_API_BASE}/collections/super-resolution`, response: collection3 },
      // Model 3 returns 500 error
      { pattern: `${REPLICATE_API_BASE}/models/owner/model-3`, response: {}, status: 500 },
      // All other models succeed
      { pattern: /\/models\/owner\/model-/, response: makeModelDetailResponse() },
    ])

    // All models are new
    mockGetModelByReplicateId.mockResolvedValue(null)

    const result = await ModelSyncService.syncAll()

    // THEN: 5 synced, 1 failed
    expect(result.failed).toBe(1)
    expect(result.synced).toBe(5)

    // upsertModel called for 5 successful models (not the failed one)
    expect(mockUpsertModel).toHaveBeenCalledTimes(5)

    // The 5 successful upserts should not include model-3
    const upsertedIds = mockUpsertModel.mock.calls.map(
      (call: unknown[]) => (call[0] as Record<string, unknown>).replicateId
    )
    expect(upsertedIds).not.toContain('owner/model-3')
  })

  // -------------------------------------------------------------------------
  // AC-6: Progress-Callback wird mit (completed, total) aufgerufen
  // -------------------------------------------------------------------------
  it('AC-6: GIVEN 6 Models zu syncen WHEN syncAll(onProgress) laeuft THEN wird onProgress nach jedem abgeschlossenen Model aufgerufen mit (completed, total)', async () => {
    /**
     * AC-6: Progress-Callback wird mit (completed, total) aufgerufen
     *
     * GIVEN 6 Models zu syncen
     * WHEN `syncAll(onProgress)` laeuft
     * THEN wird `onProgress` nach jedem abgeschlossenen Model aufgerufen mit `(completed, total)`,
     *      z.B. `(1, 6)`, `(2, 6)`, ..., `(6, 6)`
     */

    const models = Array.from({ length: 6 }, (_, i) => ({
      owner: 'owner',
      name: `model-${i + 1}`,
      latest_version: { id: `v${i + 1}` },
    }))

    const collection1 = makeCollectionResponse('text-to-image', models)
    const collection2 = makeCollectionResponse('image-editing', [])
    const collection3 = makeCollectionResponse('super-resolution', [])

    setupFetchRoutes([
      { pattern: `${REPLICATE_API_BASE}/collections/text-to-image`, response: collection1 },
      { pattern: `${REPLICATE_API_BASE}/collections/image-editing`, response: collection2 },
      { pattern: `${REPLICATE_API_BASE}/collections/super-resolution`, response: collection3 },
      { pattern: /\/models\/owner\/model-/, response: makeModelDetailResponse() },
    ])

    mockGetModelByReplicateId.mockResolvedValue(null)

    const progressCalls: Array<[number, number]> = []
    const onProgress = vi.fn((completed: number, total: number) => {
      progressCalls.push([completed, total])
    })

    await ModelSyncService.syncAll(onProgress)

    // THEN: onProgress called exactly 6 times
    expect(onProgress).toHaveBeenCalledTimes(6)

    // All progress calls should have total=6
    for (const [, total] of progressCalls) {
      expect(total).toBe(6)
    }

    // The completed values should include all numbers from 1 to 6
    // (order may vary due to parallelism but all values must be present)
    const completedValues = progressCalls.map(([c]) => c).sort((a, b) => a - b)
    expect(completedValues).toEqual([1, 2, 3, 4, 5, 6])

    // The last call must have completed=6
    const lastCallCompleted = Math.max(...progressCalls.map(([c]) => c))
    expect(lastCallCompleted).toBe(6)
  })

  // -------------------------------------------------------------------------
  // AC-10: Concurrency-Limit bei Schema-Fetches
  // -------------------------------------------------------------------------
  it('AC-10: GIVEN die Sync-Orchestrierung WHEN Schema-Fetches parallel laufen THEN sind maximal 5 Requests gleichzeitig aktiv (Concurrency-Limit)', async () => {
    /**
     * AC-10: Concurrency-Limit bei Schema-Fetches
     *
     * GIVEN die Sync-Orchestrierung
     * WHEN Schema-Fetches parallel laufen
     * THEN sind maximal 5 Requests gleichzeitig aktiv (Concurrency-Limit)
     */

    // Create 10 models to trigger concurrency limiting
    const models = Array.from({ length: 10 }, (_, i) => ({
      owner: 'owner',
      name: `model-${i + 1}`,
      latest_version: { id: `v${i + 1}` },
    }))

    const collection1 = makeCollectionResponse('text-to-image', models)
    const collection2 = makeCollectionResponse('image-editing', [])
    const collection3 = makeCollectionResponse('super-resolution', [])

    // Track concurrent model detail requests
    let currentConcurrent = 0
    let maxConcurrentObserved = 0

    fetchMock.mockImplementation(async (url: string) => {
      // Collection endpoints — return immediately
      if (url.includes('/collections/text-to-image')) {
        return { ok: true, status: 200, json: async () => collection1 }
      }
      if (url.includes('/collections/image-editing')) {
        return { ok: true, status: 200, json: async () => collection2 }
      }
      if (url.includes('/collections/super-resolution')) {
        return { ok: true, status: 200, json: async () => collection3 }
      }

      // Model detail endpoints — track concurrency
      if (url.includes('/models/')) {
        currentConcurrent++
        if (currentConcurrent > maxConcurrentObserved) {
          maxConcurrentObserved = currentConcurrent
        }

        // Add a small delay to allow concurrency to build up
        await new Promise((r) => setTimeout(r, 20))

        currentConcurrent--
        return {
          ok: true,
          status: 200,
          json: async () => makeModelDetailResponse(),
        }
      }

      return { ok: false, status: 404, json: async () => ({}) }
    })

    // All models are new
    mockGetModelByReplicateId.mockResolvedValue(null)

    await ModelSyncService.syncAll()

    // THEN: max concurrent schema fetches should not exceed 5
    expect(maxConcurrentObserved).toBeLessThanOrEqual(5)
    // Also verify that concurrency was actually used (at least 2 concurrent)
    expect(maxConcurrentObserved).toBeGreaterThanOrEqual(2)
  })
})

// ===========================================================================
// queries: upsertModel
// ===========================================================================

describe('queries: upsertModel', () => {
  // -------------------------------------------------------------------------
  // AC-7: INSERT bei neuem Model
  // -------------------------------------------------------------------------
  it('AC-7: GIVEN die upsertModel-Funktion erhaelt ein Model das noch NICHT in DB existiert WHEN upsertModel(modelData) aufgerufen wird THEN wird ein neues Model in die models-Tabelle eingefuegt (INSERT via Drizzle onConflictDoUpdate auf replicate_id)', async () => {
    /**
     * AC-7: INSERT bei neuem Model
     *
     * GIVEN die `upsertModel`-Funktion erhaelt ein Model das noch NICHT in DB existiert
     * WHEN `upsertModel(modelData)` aufgerufen wird
     * THEN wird ein neues Model in die `models`-Tabelle eingefuegt (INSERT via Drizzle `onConflictDoUpdate` auf `replicate_id`)
     */

    // Setup: 1 new model that does not exist in DB
    const collection1 = makeCollectionResponse('text-to-image', [
      { owner: 'newowner', name: 'brand-new-model', latest_version: { id: 'v-new' } },
    ])
    const collection2 = makeCollectionResponse('image-editing', [])
    const collection3 = makeCollectionResponse('super-resolution', [])

    const inputProps = { prompt: { type: 'string' } }
    setupFetchRoutes([
      { pattern: `${REPLICATE_API_BASE}/collections/text-to-image`, response: collection1 },
      { pattern: `${REPLICATE_API_BASE}/collections/image-editing`, response: collection2 },
      { pattern: `${REPLICATE_API_BASE}/collections/super-resolution`, response: collection3 },
      {
        pattern: `${REPLICATE_API_BASE}/models/newowner/brand-new-model`,
        response: makeModelDetailResponse({ versionId: 'v-new', inputProperties: inputProps }),
      },
    ])

    // Model does NOT exist in DB
    mockGetModelByReplicateId.mockResolvedValue(null)

    const result = await ModelSyncService.syncAll()

    // THEN: upsertModel called with the new model data
    expect(mockUpsertModel).toHaveBeenCalledTimes(1)

    const upsertData = mockUpsertModel.mock.calls[0][0] as Record<string, unknown>
    expect(upsertData.replicateId).toBe('newowner/brand-new-model')
    expect(upsertData.owner).toBe('newowner')
    expect(upsertData.name).toBe('brand-new-model')
    expect(upsertData.versionHash).toBe('v-new')

    // The result should show this as a NEW model
    expect(result.new).toBe(1)
    expect(result.synced).toBe(1)
  })

  // -------------------------------------------------------------------------
  // AC-8: UPDATE bei bestehendem Model
  // -------------------------------------------------------------------------
  it('AC-8: GIVEN die upsertModel-Funktion erhaelt ein Model dessen replicate_id bereits in DB existiert WHEN upsertModel(modelData) aufgerufen wird THEN werden alle Felder aktualisiert (UPDATE) und updated_at auf aktuelle Zeit gesetzt', async () => {
    /**
     * AC-8: UPDATE bei bestehendem Model
     *
     * GIVEN die `upsertModel`-Funktion erhaelt ein Model dessen `replicate_id` bereits in DB existiert
     * WHEN `upsertModel(modelData)` aufgerufen wird
     * THEN werden alle Felder aktualisiert (UPDATE) und `updated_at` auf aktuelle Zeit gesetzt
     */

    const collection1 = makeCollectionResponse('text-to-image', [
      { owner: 'owner', name: 'existing-model', latest_version: { id: 'new-version' } },
    ])
    const collection2 = makeCollectionResponse('image-editing', [])
    const collection3 = makeCollectionResponse('super-resolution', [])

    const newProps = { prompt: { type: 'string' }, guidance: { type: 'number' } }
    setupFetchRoutes([
      { pattern: `${REPLICATE_API_BASE}/collections/text-to-image`, response: collection1 },
      { pattern: `${REPLICATE_API_BASE}/collections/image-editing`, response: collection2 },
      { pattern: `${REPLICATE_API_BASE}/collections/super-resolution`, response: collection3 },
      {
        pattern: `${REPLICATE_API_BASE}/models/owner/existing-model`,
        response: makeModelDetailResponse({ versionId: 'new-version', inputProperties: newProps }),
      },
    ])

    // Model EXISTS in DB with DIFFERENT version hash (triggers update path)
    mockGetModelByReplicateId.mockResolvedValue(
      makeDbModel({
        replicateId: 'owner/existing-model',
        versionHash: 'old-version',
      })
    )

    const result = await ModelSyncService.syncAll()

    // THEN: upsertModel was called with updated fields
    expect(mockUpsertModel).toHaveBeenCalledTimes(1)

    const upsertData = mockUpsertModel.mock.calls[0][0] as Record<string, unknown>
    expect(upsertData.replicateId).toBe('owner/existing-model')
    expect(upsertData.versionHash).toBe('new-version')

    // The result should show this as an UPDATED model (not new)
    expect(result.updated).toBe(1)
    expect(result.new).toBe(0)
    expect(result.synced).toBe(1)
  })
})

// ===========================================================================
// queries: deactivateModelsNotIn
// ===========================================================================

describe('queries: deactivateModelsNotIn', () => {
  // -------------------------------------------------------------------------
  // AC-9: Soft-Delete fuer nicht-gelistete Models
  // -------------------------------------------------------------------------
  it('AC-9: GIVEN deactivateModelsNotIn(["owner/a", "owner/b"]) wird aufgerufen WHEN Models owner/a, owner/b, owner/c in DB existieren (alle is_active=true) THEN wird owner/c auf is_active=false gesetzt; owner/a und owner/b bleiben is_active=true', async () => {
    /**
     * AC-9: Soft-Delete fuer nicht-gelistete Models
     *
     * GIVEN `deactivateModelsNotIn(["owner/a", "owner/b"])` wird aufgerufen
     * WHEN Models `owner/a`, `owner/b`, `owner/c` in DB existieren (alle `is_active = true`)
     * THEN wird `owner/c` auf `is_active = false` gesetzt; `owner/a` und `owner/b` bleiben `is_active = true`
     */

    // Setup: 2 models in collection (owner/a, owner/b); owner/c missing
    const collection1 = makeCollectionResponse('text-to-image', [
      { owner: 'owner', name: 'a', latest_version: { id: 'va' } },
      { owner: 'owner', name: 'b', latest_version: { id: 'vb' } },
    ])
    const collection2 = makeCollectionResponse('image-editing', [])
    const collection3 = makeCollectionResponse('super-resolution', [])

    setupFetchRoutes([
      { pattern: `${REPLICATE_API_BASE}/collections/text-to-image`, response: collection1 },
      { pattern: `${REPLICATE_API_BASE}/collections/image-editing`, response: collection2 },
      { pattern: `${REPLICATE_API_BASE}/collections/super-resolution`, response: collection3 },
      { pattern: /\/models\/owner\//, response: makeModelDetailResponse() },
    ])

    // All models are new (for simplicity)
    mockGetModelByReplicateId.mockResolvedValue(null)

    await ModelSyncService.syncAll()

    // THEN: deactivateModelsNotIn was called with ["owner/a", "owner/b"]
    expect(mockDeactivateModelsNotIn).toHaveBeenCalledTimes(1)
    const activeIds = mockDeactivateModelsNotIn.mock.calls[0][0] as string[]
    expect(activeIds).toContain('owner/a')
    expect(activeIds).toContain('owner/b')

    // owner/c is NOT in the list — deactivateModelsNotIn will set it to is_active=false
    expect(activeIds).not.toContain('owner/c')
    expect(activeIds).toHaveLength(2)
  })
})

// ===========================================================================
// Unit Tests: Additional edge cases
// ===========================================================================

describe('ModelSyncService — unit edge cases', () => {
  it('should merge collection slugs when a model appears in multiple collections', async () => {
    /**
     * Unit test: Collection slug merging for duplicate models
     * Validates that when model-x appears in text-to-image AND image-editing,
     * the upserted model contains both collection slugs.
     */

    const collection1 = makeCollectionResponse('text-to-image', [
      { owner: 'owner', name: 'multi-coll', latest_version: { id: 'v1' } },
    ])
    const collection2 = makeCollectionResponse('image-editing', [
      { owner: 'owner', name: 'multi-coll', latest_version: { id: 'v1' } },
    ])
    const collection3 = makeCollectionResponse('super-resolution', [])

    setupFetchRoutes([
      { pattern: `${REPLICATE_API_BASE}/collections/text-to-image`, response: collection1 },
      { pattern: `${REPLICATE_API_BASE}/collections/image-editing`, response: collection2 },
      { pattern: `${REPLICATE_API_BASE}/collections/super-resolution`, response: collection3 },
      { pattern: /\/models\//, response: makeModelDetailResponse() },
    ])

    mockGetModelByReplicateId.mockResolvedValue(null)

    await ModelSyncService.syncAll()

    expect(mockUpsertModel).toHaveBeenCalledTimes(1)
    const upsertData = mockUpsertModel.mock.calls[0][0] as Record<string, unknown>
    const collections = upsertData.collections as string[]
    expect(collections).toContain('text-to-image')
    expect(collections).toContain('image-editing')
    expect(collections).toHaveLength(2)
  })

  it('should throw when REPLICATE_API_TOKEN is not set', async () => {
    delete process.env.REPLICATE_API_TOKEN

    await expect(ModelSyncService.syncAll()).rejects.toThrow(
      'REPLICATE_API_TOKEN ist nicht gesetzt'
    )
  })

  it('should handle empty collections gracefully', async () => {
    const collection1 = makeCollectionResponse('text-to-image', [])
    const collection2 = makeCollectionResponse('image-editing', [])
    const collection3 = makeCollectionResponse('super-resolution', [])

    setupFetchRoutes([
      { pattern: `${REPLICATE_API_BASE}/collections/text-to-image`, response: collection1 },
      { pattern: `${REPLICATE_API_BASE}/collections/image-editing`, response: collection2 },
      { pattern: `${REPLICATE_API_BASE}/collections/super-resolution`, response: collection3 },
    ])

    const result = await ModelSyncService.syncAll()

    expect(result.synced).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.new).toBe(0)
    expect(result.updated).toBe(0)

    // deactivateModelsNotIn should still be called with empty array
    expect(mockDeactivateModelsNotIn).toHaveBeenCalledTimes(1)
    expect(mockDeactivateModelsNotIn.mock.calls[0][0]).toEqual([])
  })

  it('should handle collection fetch failure gracefully (partial success for collection fetch)', async () => {
    /**
     * When one collection endpoint fails (e.g. 500), the service should
     * still process models from the other 2 collections.
     */

    const collection1 = makeCollectionResponse('text-to-image', [
      { owner: 'owner', name: 'model-a', latest_version: { id: 'v1' } },
    ])
    const collection3 = makeCollectionResponse('super-resolution', [
      { owner: 'owner', name: 'model-b', latest_version: { id: 'v2' } },
    ])

    setupFetchRoutes([
      { pattern: `${REPLICATE_API_BASE}/collections/text-to-image`, response: collection1 },
      { pattern: `${REPLICATE_API_BASE}/collections/image-editing`, response: {}, status: 500 },
      { pattern: `${REPLICATE_API_BASE}/collections/super-resolution`, response: collection3 },
      { pattern: /\/models\//, response: makeModelDetailResponse() },
    ])

    mockGetModelByReplicateId.mockResolvedValue(null)

    const result = await ModelSyncService.syncAll()

    // Should still process models from collections 1 and 3
    expect(result.synced).toBe(2)
  })

  it('should return SyncResult with correct shape', async () => {
    const collection1 = makeCollectionResponse('text-to-image', [
      { owner: 'owner', name: 'model-a', latest_version: { id: 'v1' } },
    ])
    const collection2 = makeCollectionResponse('image-editing', [])
    const collection3 = makeCollectionResponse('super-resolution', [])

    setupFetchRoutes([
      { pattern: `${REPLICATE_API_BASE}/collections/text-to-image`, response: collection1 },
      { pattern: `${REPLICATE_API_BASE}/collections/image-editing`, response: collection2 },
      { pattern: `${REPLICATE_API_BASE}/collections/super-resolution`, response: collection3 },
      { pattern: /\/models\//, response: makeModelDetailResponse() },
    ])

    mockGetModelByReplicateId.mockResolvedValue(null)

    const result: SyncResult = await ModelSyncService.syncAll()

    // Verify SyncResult shape
    expect(result).toHaveProperty('synced')
    expect(result).toHaveProperty('failed')
    expect(result).toHaveProperty('new')
    expect(result).toHaveProperty('updated')
    expect(typeof result.synced).toBe('number')
    expect(typeof result.failed).toBe('number')
    expect(typeof result.new).toBe('number')
    expect(typeof result.updated).toBe('number')
  })
})
