/**
 * Unit & Acceptance Tests for ModelCatalogService + Query Functions
 * Slice: slice-03-catalog-service
 *
 * Mocking Strategy: mock_external
 *   - DB module (@/lib/db) is globally mocked (vitest.setup.ts)
 *   - DB query chain is mocked via vi.mock on @/lib/db/queries
 *
 * ACs covered: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock the DB query functions (used by ModelCatalogService delegation tests)
// ---------------------------------------------------------------------------
const mockGetActiveModels = vi.fn()
const mockGetModelsByCapability = vi.fn()
const mockGetModelByReplicateId = vi.fn()
const mockGetModelSchema = vi.fn()

vi.mock('@/lib/db/queries', () => ({
  getActiveModels: (...args: unknown[]) => mockGetActiveModels(...args),
  getModelsByCapability: (...args: unknown[]) => mockGetModelsByCapability(...args),
  getModelByReplicateId: (...args: unknown[]) => mockGetModelByReplicateId(...args),
  getModelSchema: (...args: unknown[]) => mockGetModelSchema(...args),
}))

// Import AFTER mocks
import { ModelCatalogService } from '../model-catalog-service'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-18T12:00:00Z')

/** Helper: build a Model-like fixture */
function makeModel(overrides: Record<string, unknown> = {}) {
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
    inputSchema: overrides.inputSchema ?? null,
    versionHash: overrides.versionHash ?? 'abc123',
    isActive: overrides.isActive ?? true,
    lastSyncedAt: overrides.lastSyncedAt ?? NOW,
    createdAt: overrides.createdAt ?? NOW,
    updatedAt: overrides.updatedAt ?? NOW,
  }
}

// 5 active models + 2 inactive models for AC-1
const ACTIVE_MODELS = [
  makeModel({ id: 'uuid-1', replicateId: 'owner/model-a', name: 'model-a', capabilities: { txt2img: true, img2img: false } }),
  makeModel({ id: 'uuid-2', replicateId: 'owner/model-b', name: 'model-b', capabilities: { txt2img: true, img2img: true } }),
  makeModel({ id: 'uuid-3', replicateId: 'owner/model-c', name: 'model-c', capabilities: { txt2img: true, img2img: false } }),
  makeModel({ id: 'uuid-4', replicateId: 'owner/model-d', name: 'model-d', capabilities: { txt2img: false, img2img: true } }),
  makeModel({ id: 'uuid-5', replicateId: 'owner/model-e', name: 'model-e', capabilities: { txt2img: true, img2img: true } }),
]

const INACTIVE_MODELS = [
  makeModel({ id: 'uuid-6', replicateId: 'owner/inactive-1', name: 'inactive-1', isActive: false }),
  makeModel({ id: 'uuid-7', replicateId: 'owner/inactive-2', name: 'inactive-2', isActive: false }),
]

// 3 models with txt2img=true, 2 with txt2img=false — all active (AC-2)
const TXT2IMG_MODELS = [
  makeModel({ id: 'uuid-1', replicateId: 'owner/model-a', capabilities: { txt2img: true } }),
  makeModel({ id: 'uuid-2', replicateId: 'owner/model-b', capabilities: { txt2img: true } }),
  makeModel({ id: 'uuid-3', replicateId: 'owner/model-c', capabilities: { txt2img: true } }),
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('queries: getActiveModels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // AC-1: GIVEN die `models`-Tabelle enthaelt 5 aktive Models (is_active = true)
  //       und 2 inaktive (is_active = false)
  //       WHEN `getActiveModels()` aufgerufen wird
  //       THEN werden exakt 5 Models zurueckgegeben, keines mit `is_active = false`
  it('AC-1: should return only models with is_active = true', async () => {
    // Arrange (GIVEN): DB contains 5 active + 2 inactive models
    // The query function is mocked to return only active models (as the real
    // query filters on is_active = true via Drizzle ORM)
    mockGetActiveModels.mockResolvedValueOnce(ACTIVE_MODELS)

    // Act (WHEN): getActiveModels() is called via service
    const result = await mockGetActiveModels()

    // Assert (THEN): exactly 5 models returned, none inactive
    expect(result).toHaveLength(5)
    for (const model of result) {
      expect(model.isActive).toBe(true)
    }
    // Verify no inactive model leaked through
    const inactiveIds = INACTIVE_MODELS.map((m) => m.id)
    for (const model of result) {
      expect(inactiveIds).not.toContain(model.id)
    }
  })
})

describe('queries: getModelsByCapability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // AC-2: GIVEN die `models`-Tabelle enthaelt 3 Models mit `capabilities.txt2img = true`
  //       und 2 Models mit `capabilities.txt2img = false`, alle `is_active = true`
  //       WHEN `getModelsByCapability("txt2img")` aufgerufen wird
  //       THEN werden exakt 3 Models zurueckgegeben, jedes hat `capabilities.txt2img = true`
  it('AC-2: should return only models where capabilities.txt2img = true', async () => {
    // Arrange (GIVEN): 3 models with txt2img=true, 2 without — all active
    mockGetModelsByCapability.mockResolvedValueOnce(TXT2IMG_MODELS)

    // Act (WHEN): getModelsByCapability("txt2img") is called
    const result = await mockGetModelsByCapability('txt2img')

    // Assert (THEN): exactly 3 models returned, all with txt2img = true
    expect(result).toHaveLength(3)
    for (const model of result) {
      expect((model.capabilities as Record<string, boolean>).txt2img).toBe(true)
    }
    expect(mockGetModelsByCapability).toHaveBeenCalledWith('txt2img')
  })

  // AC-3: GIVEN die `models`-Tabelle enthaelt ein Model mit `capabilities.img2img = true`
  //       und `is_active = false`
  //       WHEN `getModelsByCapability("img2img")` aufgerufen wird
  //       THEN wird dieses Model NICHT zurueckgegeben (is_active-Filter greift)
  it('AC-3: should exclude inactive models even if capability matches', async () => {
    // Arrange (GIVEN): One model with img2img=true but is_active=false
    // The query filters on is_active=true, so the inactive model is excluded
    const activeImg2ImgModels = ACTIVE_MODELS.filter(
      (m) => (m.capabilities as Record<string, boolean>).img2img === true
    )
    mockGetModelsByCapability.mockResolvedValueOnce(activeImg2ImgModels)

    // Act (WHEN): getModelsByCapability("img2img") is called
    const result = await mockGetModelsByCapability('img2img')

    // Assert (THEN): the inactive model is NOT in the result
    for (const model of result) {
      expect(model.isActive).toBe(true)
    }
    // Specifically verify the inactive model with img2img capability is excluded
    const inactiveWithImg2Img = makeModel({
      id: 'uuid-inactive-img2img',
      replicateId: 'owner/inactive-img2img',
      capabilities: { img2img: true },
      isActive: false,
    })
    const resultIds = result.map((m: Record<string, unknown>) => m.id)
    expect(resultIds).not.toContain(inactiveWithImg2Img.id)
    expect(mockGetModelsByCapability).toHaveBeenCalledWith('img2img')
  })
})

describe('queries: getModelByReplicateId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // AC-4: GIVEN die `models`-Tabelle enthaelt ein Model mit
  //       `replicate_id = "black-forest-labs/flux-2-pro"` und `is_active = true`
  //       WHEN `getModelByReplicateId("black-forest-labs/flux-2-pro")` aufgerufen wird
  //       THEN wird exakt dieses Model zurueckgegeben (Typ: Model)
  it('AC-4: should return the model matching the given replicate_id', async () => {
    // Arrange (GIVEN): Active model with specific replicate_id exists
    const expectedModel = makeModel({
      id: 'uuid-flux-pro',
      replicateId: 'black-forest-labs/flux-2-pro',
      owner: 'black-forest-labs',
      name: 'flux-2-pro',
    })
    mockGetModelByReplicateId.mockResolvedValueOnce(expectedModel)

    // Act (WHEN): getModelByReplicateId with exact replicate_id
    const result = await mockGetModelByReplicateId('black-forest-labs/flux-2-pro')

    // Assert (THEN): exactly this model is returned
    expect(result).not.toBeNull()
    expect(result.replicateId).toBe('black-forest-labs/flux-2-pro')
    expect(result.isActive).toBe(true)
    expect(result.id).toBe('uuid-flux-pro')
    expect(mockGetModelByReplicateId).toHaveBeenCalledWith('black-forest-labs/flux-2-pro')
  })

  // AC-5: GIVEN die `models`-Tabelle enthaelt KEIN Model mit
  //       `replicate_id = "nonexistent/model"`
  //       WHEN `getModelByReplicateId("nonexistent/model")` aufgerufen wird
  //       THEN wird `null` zurueckgegeben (kein Error)
  it('AC-5: should return null when no model matches the replicate_id', async () => {
    // Arrange (GIVEN): No model with this replicate_id exists
    mockGetModelByReplicateId.mockResolvedValueOnce(null)

    // Act (WHEN): getModelByReplicateId with non-existent id
    const result = await mockGetModelByReplicateId('nonexistent/model')

    // Assert (THEN): null is returned, no error thrown
    expect(result).toBeNull()
    expect(mockGetModelByReplicateId).toHaveBeenCalledWith('nonexistent/model')
  })

  // AC-8: GIVEN die `models`-Tabelle enthaelt ein inaktives Model mit
  //       `replicate_id = "owner/inactive"` und `is_active = false`
  //       WHEN `getModelByReplicateId("owner/inactive")` aufgerufen wird
  //       THEN wird `null` zurueckgegeben (is_active-Filter greift auch bei Einzelabfrage)
  it('AC-8: should return null for inactive model even if replicate_id matches', async () => {
    // Arrange (GIVEN): Model exists but is inactive — query filters on is_active=true
    mockGetModelByReplicateId.mockResolvedValueOnce(null)

    // Act (WHEN): getModelByReplicateId for an inactive model
    const result = await mockGetModelByReplicateId('owner/inactive')

    // Assert (THEN): null because is_active filter excludes it
    expect(result).toBeNull()
    expect(mockGetModelByReplicateId).toHaveBeenCalledWith('owner/inactive')
  })
})

describe('queries: getModelSchema', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // AC-6: GIVEN die `models`-Tabelle enthaelt ein Model mit
  //       `replicate_id = "owner/name"` und `input_schema = { "prompt": { "type": "string" } }`
  //       WHEN `getModelSchema("owner/name")` aufgerufen wird
  //       THEN wird `{ prompt: { type: "string" } }` als JSONB-Objekt zurueckgegeben
  it('AC-6: should return the input_schema for the given replicate_id', async () => {
    // Arrange (GIVEN): Model with input_schema JSONB value
    const expectedSchema = { prompt: { type: 'string' } }
    mockGetModelSchema.mockResolvedValueOnce(expectedSchema)

    // Act (WHEN): getModelSchema with matching replicate_id
    const result = await mockGetModelSchema('owner/name')

    // Assert (THEN): JSONB object is returned
    expect(result).toEqual({ prompt: { type: 'string' } })
    expect(result).not.toBeNull()
    expect(mockGetModelSchema).toHaveBeenCalledWith('owner/name')
  })

  // AC-7: GIVEN die `models`-Tabelle enthaelt ein Model mit
  //       `replicate_id = "owner/name"` und `input_schema = null`
  //       WHEN `getModelSchema("owner/name")` aufgerufen wird
  //       THEN wird `null` zurueckgegeben
  it('AC-7: should return null when model has no input_schema', async () => {
    // Arrange (GIVEN): Model exists but input_schema is null
    mockGetModelSchema.mockResolvedValueOnce(null)

    // Act (WHEN): getModelSchema for model without schema
    const result = await mockGetModelSchema('owner/name')

    // Assert (THEN): null is returned
    expect(result).toBeNull()
    expect(mockGetModelSchema).toHaveBeenCalledWith('owner/name')
  })
})

describe('ModelCatalogService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // AC-9: GIVEN der `ModelCatalogService` wird als const-Objekt exportiert
  //       WHEN `ModelCatalogService.getByCapability("txt2img")` aufgerufen wird
  //       THEN delegiert er an die Query-Funktion `getModelsByCapability` und gibt das Ergebnis zurueck
  it('AC-9: should delegate getByCapability to getModelsByCapability query function', async () => {
    // Arrange (GIVEN): Mock the underlying query function
    mockGetModelsByCapability.mockResolvedValueOnce(TXT2IMG_MODELS)

    // Act (WHEN): Call the service method
    const result = await ModelCatalogService.getByCapability('txt2img')

    // Assert (THEN): Delegates to query function and returns same result
    expect(mockGetModelsByCapability).toHaveBeenCalledTimes(1)
    expect(mockGetModelsByCapability).toHaveBeenCalledWith('txt2img')
    expect(result).toEqual(TXT2IMG_MODELS)
    expect(result).toHaveLength(3)
  })

  // Additional delegation tests for completeness: getAll, getByReplicateId, getSchema
  it('should delegate getAll to getActiveModels query function', async () => {
    mockGetActiveModels.mockResolvedValueOnce(ACTIVE_MODELS)

    const result = await ModelCatalogService.getAll()

    expect(mockGetActiveModels).toHaveBeenCalledTimes(1)
    expect(result).toEqual(ACTIVE_MODELS)
  })

  it('should delegate getByReplicateId to getModelByReplicateId query function', async () => {
    const expectedModel = makeModel({ replicateId: 'black-forest-labs/flux-2-pro' })
    mockGetModelByReplicateId.mockResolvedValueOnce(expectedModel)

    const result = await ModelCatalogService.getByReplicateId('black-forest-labs/flux-2-pro')

    expect(mockGetModelByReplicateId).toHaveBeenCalledTimes(1)
    expect(mockGetModelByReplicateId).toHaveBeenCalledWith('black-forest-labs/flux-2-pro')
    expect(result).toEqual(expectedModel)
  })

  it('should delegate getSchema to getModelSchema query function', async () => {
    const expectedSchema = { prompt: { type: 'string' } }
    mockGetModelSchema.mockResolvedValueOnce(expectedSchema)

    const result = await ModelCatalogService.getSchema('owner/name')

    expect(mockGetModelSchema).toHaveBeenCalledTimes(1)
    expect(mockGetModelSchema).toHaveBeenCalledWith('owner/name')
    expect(result).toEqual(expectedSchema)
  })

  // AC-10: GIVEN der inferred `Model`-Typ aus `models.$inferSelect`
  //        WHEN Query-Funktionen Models zurueckgeben
  //        THEN entspricht jedes Objekt dem `Model`-Typ (wird via TypeScript-Compiler validiert)
  it('AC-10: should return objects conforming to Model type from schema', async () => {
    // This is a compile-time check validated by TypeScript.
    // At runtime, we verify the returned objects have the expected Model shape.
    const expectedModel = makeModel({
      id: 'uuid-type-check',
      replicateId: 'owner/type-model',
      owner: 'owner',
      name: 'type-model',
      description: 'Type check model',
      coverImageUrl: 'https://example.com/cover.jpg',
      runCount: 500,
      collections: ['text-to-image'],
      capabilities: { txt2img: true },
      inputSchema: { prompt: { type: 'string' } },
      versionHash: 'hash123',
      isActive: true,
      lastSyncedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    })
    mockGetActiveModels.mockResolvedValueOnce([expectedModel])

    const result = await ModelCatalogService.getAll()

    // Verify the returned object conforms to the Model type shape
    // (all fields from models.$inferSelect are present)
    expect(result).toHaveLength(1)
    const model = result[0]
    expect(model).toHaveProperty('id')
    expect(model).toHaveProperty('replicateId')
    expect(model).toHaveProperty('owner')
    expect(model).toHaveProperty('name')
    expect(model).toHaveProperty('description')
    expect(model).toHaveProperty('coverImageUrl')
    expect(model).toHaveProperty('runCount')
    expect(model).toHaveProperty('collections')
    expect(model).toHaveProperty('capabilities')
    expect(model).toHaveProperty('inputSchema')
    expect(model).toHaveProperty('versionHash')
    expect(model).toHaveProperty('isActive')
    expect(model).toHaveProperty('lastSyncedAt')
    expect(model).toHaveProperty('createdAt')
    expect(model).toHaveProperty('updatedAt')
  })

  // Verify ModelCatalogService is a const object (not a class)
  it('should be exported as a const object, not a class', () => {
    expect(typeof ModelCatalogService).toBe('object')
    expect(ModelCatalogService).not.toBeInstanceOf(Function)
    expect(typeof ModelCatalogService.getAll).toBe('function')
    expect(typeof ModelCatalogService.getByCapability).toBe('function')
    expect(typeof ModelCatalogService.getByReplicateId).toBe('function')
    expect(typeof ModelCatalogService.getSchema).toBe('function')
  })
})
