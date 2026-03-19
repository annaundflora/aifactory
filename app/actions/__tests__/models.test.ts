/**
 * Tests for Server Actions: getModels, getModelSchema, triggerSync
 * Slice: slice-06-server-actions
 *
 * Mocking Strategy: mock_external
 *   - requireAuth: globally mocked in vitest.setup.ts (overridden per-test for auth failure cases)
 *   - ModelCatalogService: mocked via vi.mock (DB reads)
 *   - Replicate API: mocked via vi.stubGlobal('fetch')
 *   - DB module (@/lib/db): globally mocked in vitest.setup.ts
 *   - resolveSchemaRefs: mocked to control schema resolution
 *
 * ACs covered: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ---------------------------------------------------------------------------
// Mocks — declared before imports so vi.mock hoists correctly
// ---------------------------------------------------------------------------

const mockGetAll = vi.fn()
const mockGetByCapability = vi.fn()
const mockGetSchema = vi.fn()

vi.mock('@/lib/services/model-catalog-service', () => ({
  ModelCatalogService: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
    getByCapability: (...args: unknown[]) => mockGetByCapability(...args),
    getSchema: (...args: unknown[]) => mockGetSchema(...args),
  },
}))

const mockResolveSchemaRefs = vi.fn()
vi.mock('@/lib/services/capability-detection', () => ({
  resolveSchemaRefs: (...args: unknown[]) => mockResolveSchemaRefs(...args),
}))

// Mock the db.update chain used by storeSchemaInDb
const mockWhere = vi.fn().mockResolvedValue([])
const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
const mockUpdate = vi.fn().mockReturnValue({ set: mockSet })
vi.mock('@/lib/db', () => ({
  db: {
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}))

vi.mock('@/lib/db/schema', () => ({
  models: { replicateId: 'replicate_id' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ _type: 'eq', val })),
}))

// Mock fetch globally for Replicate API calls
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Import requireAuth to override per-test
import { requireAuth } from '@/lib/auth/guard'

// Import server actions AFTER mocks are set up
import { getModels, getModelSchema, triggerSync } from '@/app/actions/models'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-18T12:00:00Z')

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

const TXT2IMG_MODELS = [
  makeModel({ id: 'uuid-1', replicateId: 'owner/model-a', capabilities: { txt2img: true } }),
  makeModel({ id: 'uuid-2', replicateId: 'owner/model-b', capabilities: { txt2img: true } }),
  makeModel({ id: 'uuid-3', replicateId: 'owner/model-c', capabilities: { txt2img: true } }),
  makeModel({ id: 'uuid-4', replicateId: 'owner/model-d', capabilities: { txt2img: true } }),
  makeModel({ id: 'uuid-5', replicateId: 'owner/model-e', capabilities: { txt2img: true } }),
]

const ALL_ACTIVE_MODELS = [
  ...TXT2IMG_MODELS,
  makeModel({ id: 'uuid-6', replicateId: 'owner/model-f', capabilities: { img2img: true } }),
  makeModel({ id: 'uuid-7', replicateId: 'owner/model-g', capabilities: { upscale: true } }),
]

// ---------------------------------------------------------------------------
// Helper: build a Replicate API response
// ---------------------------------------------------------------------------

function buildReplicateResponse(properties: Record<string, unknown>, allSchemas?: Record<string, Record<string, unknown>>) {
  return {
    ok: true,
    json: async () => ({
      latest_version: {
        openapi_schema: {
          components: {
            schemas: {
              Input: { properties },
              ...(allSchemas ?? {}),
            },
          },
        },
      },
    }),
  }
}

// ---------------------------------------------------------------------------
// Helper: simulate unauthenticated user
// ---------------------------------------------------------------------------

function simulateUnauthenticated() {
  vi.mocked(requireAuth).mockResolvedValueOnce({ error: 'Unauthorized' })
}

// ---------------------------------------------------------------------------
// Tests: getModels
// ---------------------------------------------------------------------------

describe('getModels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: authenticated user (from vitest.setup.ts global mock)
  })

  // AC-1: GIVEN ein authentifizierter User und 5 aktive Models mit `capabilities.txt2img = true` in der DB
  //       WHEN `getModels({ capability: "txt2img" })` aufgerufen wird
  //       THEN wird ein Array mit exakt 5 Model-Objekten zurueckgegeben (Typ: `Model[]` aus `models.$inferSelect`)
  it('AC-1: should return models filtered by txt2img capability from DB', async () => {
    // Arrange (GIVEN)
    mockGetByCapability.mockResolvedValueOnce(TXT2IMG_MODELS)

    // Act (WHEN)
    const result = await getModels({ capability: 'txt2img' })

    // Assert (THEN)
    expect(Array.isArray(result)).toBe(true)
    if (Array.isArray(result)) {
      expect(result).toHaveLength(5)
      for (const model of result) {
        expect(model).toHaveProperty('replicateId')
        expect(model).toHaveProperty('capabilities')
      }
    }
    expect(mockGetByCapability).toHaveBeenCalledWith('txt2img')
    expect(mockGetAll).not.toHaveBeenCalled()
  })

  // AC-2: GIVEN ein authentifizierter User
  //       WHEN `getModels({})` (ohne capability-Filter) aufgerufen wird
  //       THEN werden alle aktiven Models aus der DB zurueckgegeben
  it('AC-2: should return all active models when no capability provided', async () => {
    // Arrange (GIVEN)
    mockGetAll.mockResolvedValueOnce(ALL_ACTIVE_MODELS)

    // Act (WHEN)
    const result = await getModels({})

    // Assert (THEN)
    expect(Array.isArray(result)).toBe(true)
    if (Array.isArray(result)) {
      expect(result).toHaveLength(7)
    }
    expect(mockGetAll).toHaveBeenCalledTimes(1)
    expect(mockGetByCapability).not.toHaveBeenCalled()
  })

  // AC-3: GIVEN ein NICHT authentifizierter User (requireAuth gibt `{ error: "..." }` zurueck)
  //       WHEN `getModels({ capability: "txt2img" })` aufgerufen wird
  //       THEN wird `{ error: string }` zurueckgegeben (Auth-Fehler, kein DB-Zugriff)
  it('AC-3: should return error when user is not authenticated', async () => {
    // Arrange (GIVEN)
    simulateUnauthenticated()

    // Act (WHEN)
    const result = await getModels({ capability: 'txt2img' })

    // Assert (THEN)
    expect(result).toHaveProperty('error')
    expect('error' in result && typeof result.error).toBe('string')
    // No DB access should have happened
    expect(mockGetByCapability).not.toHaveBeenCalled()
    expect(mockGetAll).not.toHaveBeenCalled()
  })

  // AC-4: GIVEN ein authentifizierter User und `capability = "invalid_mode"`
  //       WHEN `getModels({ capability: "invalid_mode" })` aufgerufen wird
  //       THEN wird `{ error: "Ungueltige Capability" }` zurueckgegeben
  it('AC-4: should return error for invalid capability value', async () => {
    // Arrange (GIVEN) — authenticated user (default)

    // Act (WHEN)
    // @ts-expect-error — intentionally passing invalid capability
    const result = await getModels({ capability: 'invalid_mode' })

    // Assert (THEN)
    expect(result).toEqual({ error: 'Ungueltige Capability' })
    expect(mockGetByCapability).not.toHaveBeenCalled()
    expect(mockGetAll).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Tests: getModelSchema
// ---------------------------------------------------------------------------

describe('getModelSchema', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  // AC-5: GIVEN ein authentifizierter User und ein Model mit `replicate_id = "owner/name"` hat `input_schema != null` in DB
  //       WHEN `getModelSchema({ modelId: "owner/name" })` aufgerufen wird
  //       THEN wird `{ properties: <input_schema aus DB> }` zurueckgegeben ohne Replicate-API-Call
  it('AC-5: should return schema from DB without API call when input_schema exists', async () => {
    // Arrange (GIVEN)
    const dbSchema = { prompt: { type: 'string', description: 'Input prompt' }, width: { type: 'integer', default: 1024 } }
    mockGetSchema.mockResolvedValueOnce(dbSchema)

    // Act (WHEN)
    const result = await getModelSchema({ modelId: 'owner/name' })

    // Assert (THEN)
    expect(result).toEqual({ properties: dbSchema })
    expect(mockGetSchema).toHaveBeenCalledWith('owner/name')
    // No Replicate API call should have been made
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // AC-6: GIVEN ein authentifizierter User und ein Model mit `replicate_id = "owner/name"` hat `input_schema = null` in DB
  //       WHEN `getModelSchema({ modelId: "owner/name" })` aufgerufen wird
  //       THEN wird Schema von Replicate API geholt, `resolveSchemaRefs` angewendet, Ergebnis in DB gespeichert,
  //            und `{ properties: <resolved schema> }` zurueckgegeben
  it('AC-6: should fetch schema from Replicate API when input_schema is null and store in DB', async () => {
    // Arrange (GIVEN) — Model exists in DB but input_schema is null
    mockGetSchema.mockResolvedValueOnce(null)

    const rawProperties = {
      prompt: { type: 'string' },
      resolution: { allOf: [{ $ref: '#/components/schemas/resolution' }] },
    }
    const allSchemasInResponse = {
      Input: { properties: rawProperties },
      resolution: { type: 'string', enum: ['512', '1024'] },
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        latest_version: {
          openapi_schema: {
            components: {
              schemas: allSchemasInResponse,
            },
          },
        },
      }),
    })

    const resolvedProperties = {
      prompt: { type: 'string' },
      resolution: { type: 'string', enum: ['512', '1024'] },
    }
    mockResolveSchemaRefs.mockReturnValueOnce(resolvedProperties)

    // Act (WHEN)
    const result = await getModelSchema({ modelId: 'owner/name' })

    // Assert (THEN)
    // 1. Schema returned with resolved properties
    expect(result).toEqual({ properties: resolvedProperties })
    // 2. Replicate API was called
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.replicate.com/v1/models/owner/name',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining('Bearer'),
        }),
      })
    )
    // 3. resolveSchemaRefs was called with the raw properties and allSchemas
    expect(mockResolveSchemaRefs).toHaveBeenCalledTimes(1)
    expect(mockResolveSchemaRefs).toHaveBeenCalledWith(rawProperties, allSchemasInResponse)
    // 4. Schema was stored in DB (db.update was called)
    expect(mockUpdate).toHaveBeenCalled()
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        inputSchema: resolvedProperties,
      })
    )
  })

  // AC-7: GIVEN ein authentifizierter User und ein Model mit `replicate_id = "owner/unknown"` existiert NICHT in DB
  //       WHEN `getModelSchema({ modelId: "owner/unknown" })` aufgerufen wird
  //       THEN wird Schema von Replicate API geholt (On-the-fly-Fallback), und `{ properties: <resolved schema> }` zurueckgegeben
  it('AC-7: should fetch schema from Replicate API when model not in DB', async () => {
    // Arrange (GIVEN) — Model not in DB (getSchema returns null)
    mockGetSchema.mockResolvedValueOnce(null)

    const apiProperties = { prompt: { type: 'string' } }
    mockFetch.mockResolvedValueOnce(buildReplicateResponse(apiProperties))
    mockResolveSchemaRefs.mockReturnValueOnce(apiProperties)

    // Act (WHEN)
    const result = await getModelSchema({ modelId: 'owner/unknown' })

    // Assert (THEN) — On-the-fly fallback returns properties from Replicate API
    expect(result).toEqual({ properties: apiProperties })
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.replicate.com/v1/models/owner/unknown',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining('Bearer'),
        }),
      })
    )
  })

  // AC-8: GIVEN ein authentifizierter User
  //       WHEN `getModelSchema({ modelId: "invalid" })` aufgerufen wird (kein `owner/name`-Format)
  //       THEN wird `{ error: "Ungueltiges Model-ID-Format" }` zurueckgegeben
  it('AC-8: should return error for invalid modelId format', async () => {
    // Arrange (GIVEN) — authenticated user (default)

    // Act (WHEN)
    const result = await getModelSchema({ modelId: 'invalid' })

    // Assert (THEN)
    expect(result).toEqual({ error: 'Ungueltiges Model-ID-Format' })
    expect(mockGetSchema).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // AC-9: GIVEN ein NICHT authentifizierter User
  //       WHEN `getModelSchema({ modelId: "owner/name" })` aufgerufen wird
  //       THEN wird `{ error: string }` zurueckgegeben (Auth-Fehler)
  it('AC-9: should return error when user is not authenticated', async () => {
    // Arrange (GIVEN)
    simulateUnauthenticated()

    // Act (WHEN)
    const result = await getModelSchema({ modelId: 'owner/name' })

    // Assert (THEN)
    expect(result).toHaveProperty('error')
    expect('error' in result && typeof result.error).toBe('string')
    expect(mockGetSchema).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // AC-13: GIVEN die `modelId`-Validierung in `getModelSchema`
  //        WHEN das Format geprueft wird
  //        THEN wird der Regex `/^[a-z0-9-]+\/[a-z0-9._-]+$/` (oder gleichwertiger Check) angewendet
  it('AC-13: should validate modelId against owner/name regex pattern', async () => {
    // Valid formats that should pass validation
    const validIds = [
      'owner/name',
      'black-forest-labs/flux-2-pro',
      'stability-ai/sdxl',
      'owner/model.v1',
      'owner/model_name',
      'owner/model-name',
      'abc123/def456',
    ]

    // Invalid formats that should fail validation
    const invalidIds = [
      'invalid',           // no slash
      '',                  // empty
      '/name',             // no owner
      'owner/',            // no name
      'Owner/Name',        // uppercase
      'owner//name',       // double slash
      'owner/na me',       // space
      'owner name/model',  // space in owner
    ]

    for (const validId of validIds) {
      vi.clearAllMocks()
      mockGetSchema.mockResolvedValueOnce({ prompt: { type: 'string' } })
      const result = await getModelSchema({ modelId: validId })
      // Should not return format error for valid IDs
      expect(result).not.toEqual({ error: 'Ungueltiges Model-ID-Format' })
    }

    for (const invalidId of invalidIds) {
      vi.clearAllMocks()
      const result = await getModelSchema({ modelId: invalidId })
      // Should return format error for invalid IDs
      expect(result).toEqual({ error: 'Ungueltiges Model-ID-Format' })
    }
  })
})

// ---------------------------------------------------------------------------
// Tests: triggerSync
// ---------------------------------------------------------------------------

describe('triggerSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // AC-10: GIVEN ein authentifizierter User
  //        WHEN `triggerSync()` aufgerufen wird
  //        THEN wird `{ status: "started" }` zurueckgegeben (Delegation an Route Handler)
  it('AC-10: should return status started when authenticated', async () => {
    // Arrange (GIVEN) — authenticated user (default)

    // Act (WHEN)
    const result = await triggerSync()

    // Assert (THEN)
    expect(result).toEqual({ status: 'started' })
  })

  // AC-11: GIVEN ein NICHT authentifizierter User
  //        WHEN `triggerSync()` aufgerufen wird
  //        THEN wird `{ error: string }` zurueckgegeben (Auth-Fehler)
  it('AC-11: should return error when user is not authenticated', async () => {
    // Arrange (GIVEN)
    simulateUnauthenticated()

    // Act (WHEN)
    const result = await triggerSync()

    // Assert (THEN)
    expect(result).toHaveProperty('error')
    expect('error' in result && typeof result.error).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// Tests: removed exports
// ---------------------------------------------------------------------------

describe('removed exports', () => {
  // AC-12: GIVEN die Datei `app/actions/models.ts`
  //        WHEN die exportierten Funktionen geprueft werden
  //        THEN existiert KEINE `getCollectionModels`-Funktion und KEINE `checkImg2ImgSupport`-Funktion mehr
  it('AC-12: should not export getCollectionModels or checkImg2ImgSupport', () => {
    const filePath = resolve(__dirname, '..', 'models.ts')
    const content = readFileSync(filePath, 'utf-8')

    // No getCollectionModels function (export or internal)
    expect(content).not.toMatch(/export\s+(async\s+)?function\s+getCollectionModels/)
    expect(content).not.toMatch(/function\s+getCollectionModels/)

    // No checkImg2ImgSupport function (export or internal)
    expect(content).not.toMatch(/export\s+(async\s+)?function\s+checkImg2ImgSupport/)
    expect(content).not.toMatch(/function\s+checkImg2ImgSupport/)
  })

  it('should export getModels, getModelSchema, and triggerSync', () => {
    // Verify that the new functions are importable and are functions
    expect(typeof getModels).toBe('function')
    expect(typeof getModelSchema).toBe('function')
    expect(typeof triggerSync).toBe('function')
  })

  it('should have "use server" directive as first line', () => {
    const filePath = resolve(__dirname, '..', 'models.ts')
    const content = readFileSync(filePath, 'utf-8')
    const firstLine = content.split('\n')[0].trim()

    expect(firstLine).toBe('"use server";')
  })
})
