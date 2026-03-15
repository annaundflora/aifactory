import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getModelSchema, getCollectionModels } from '@/app/actions/models'
import { ModelSchemaService } from '@/lib/services/model-schema-service'
import { CollectionModelService } from '@/lib/services/collection-model-service'
import type { CollectionModel } from '@/lib/types/collection-model'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// Mock fetch globally per Mocking Strategy: mock_external
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock CollectionModelService to avoid real API calls
vi.mock('@/lib/services/collection-model-service', () => ({
  CollectionModelService: {
    getCollectionModels: vi.fn(),
    clearCache: vi.fn(),
  },
}))

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

// Helper: build a CollectionModel fixture
function buildCollectionModel(overrides: Partial<CollectionModel> = {}): CollectionModel {
  return {
    url: 'https://replicate.com/black-forest-labs/flux-2-pro',
    owner: 'black-forest-labs',
    name: 'flux-2-pro',
    description: 'A text-to-image model',
    cover_image_url: 'https://example.com/cover.jpg',
    run_count: 100000,
    created_at: '2025-01-15T00:00:00Z',
    ...overrides,
  }
}

describe('getCollectionModels Server Action', () => {
  const mockGetCollectionModels = vi.mocked(CollectionModelService.getCollectionModels)

  beforeEach(() => {
    mockGetCollectionModels.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // AC-1: GIVEN app/actions/models.ts existiert
  //       WHEN die Datei importiert wird
  //       THEN exportiert sie eine Server Action getCollectionModels neben der bestehenden getModelSchema
  it('AC-1: should export getCollectionModels function', () => {
    expect(typeof getCollectionModels).toBe('function')
    expect(typeof getModelSchema).toBe('function')
  })

  // AC-2: GIVEN der CollectionModelService Models erfolgreich liefert
  //       WHEN getCollectionModels() aufgerufen wird
  //       THEN gibt die Action ein Array von CollectionModel[] zurueck
  it('AC-2: should return CollectionModel[] when service succeeds', async () => {
    const mockModels: CollectionModel[] = [
      buildCollectionModel({ owner: 'black-forest-labs', name: 'flux-2-pro' }),
      buildCollectionModel({ owner: 'stability-ai', name: 'sdxl', run_count: 50000 }),
    ]
    mockGetCollectionModels.mockResolvedValueOnce(mockModels)

    const result = await getCollectionModels()

    expect(Array.isArray(result)).toBe(true)
    if (Array.isArray(result)) {
      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('owner', 'black-forest-labs')
      expect(result[0]).toHaveProperty('name', 'flux-2-pro')
      expect(result[0]).toHaveProperty('url')
      expect(result[0]).toHaveProperty('description')
      expect(result[0]).toHaveProperty('cover_image_url')
      expect(result[0]).toHaveProperty('run_count')
    }
  })

  // AC-3: GIVEN der CollectionModelService einen Fehler liefert ({ error: string })
  //       WHEN getCollectionModels() aufgerufen wird
  //       THEN gibt die Action { error: string } zurueck
  it('AC-3: should return error object when service fails', async () => {
    mockGetCollectionModels.mockResolvedValueOnce({ error: 'API-Fehler: 500 Internal Server Error' })

    const result = await getCollectionModels()

    expect(result).toHaveProperty('error')
    expect('error' in result && typeof result.error).toBe('string')
  })
})

describe('getModelSchema Server Action', () => {
  beforeEach(() => {
    ModelSchemaService.clearCache()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // AC-4: GIVEN app/actions/models.ts nach dem Refactoring
  //       WHEN die Datei inspiziert wird
  //       THEN existiert KEIN Import von @/lib/models
  it('AC-4: should not import from lib/models', () => {
    const filePath = resolve(__dirname, '..', 'models.ts')
    const content = readFileSync(filePath, 'utf-8')

    expect(content).not.toMatch(/@\/lib\/models/)
    expect(content).not.toMatch(/getModelById/)
    expect(content).not.toMatch(/\bMODELS\b/)
  })

  // AC-5: GIVEN die Action getModelSchema nach dem Refactoring
  //       WHEN getModelSchema({ modelId: "owner/name" }) aufgerufen wird
  //       THEN wird das Model-ID-Format per Regex validiert (Pattern: owner/name mit mindestens einem /)
  //       AND der statische getModelById()-Whitelist-Check ist entfernt
  it('AC-5: should accept any owner/name model ID format in getModelSchema', async () => {
    const fakeProperties = {
      prompt: { type: 'string', description: 'Input prompt' },
    }
    mockFetch.mockResolvedValueOnce(buildReplicateResponse(fakeProperties))

    // Any string with a slash should pass format validation
    const result = await getModelSchema({ modelId: 'some-owner/some-model' })

    expect(result).toHaveProperty('properties')
  })

  // AC-6: GIVEN die Action getModelSchema nach dem Refactoring
  //       WHEN getModelSchema({ modelId: "invalid-no-slash" }) aufgerufen wird
  //       THEN gibt die Action { error: "Unbekanntes Modell" } zurueck
  it('AC-6: should reject model ID without slash in getModelSchema', async () => {
    const result = await getModelSchema({ modelId: 'invalid-no-slash' })

    expect(result).toEqual({ error: 'Unbekanntes Modell' })
  })

  it('should return properties object for a valid model ID', async () => {
    const fakeProperties = {
      prompt: { type: 'string', description: 'Input prompt' },
      width: { type: 'integer', default: 1024 },
    }

    mockFetch.mockResolvedValueOnce(buildReplicateResponse(fakeProperties))

    const result = await getModelSchema({ modelId: 'black-forest-labs/flux-2-pro' })

    expect(result).toHaveProperty('properties')
    expect('properties' in result && result.properties).toBeTruthy()

    if ('properties' in result) {
      expect(Object.keys(result.properties).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('should return error for empty model ID', async () => {
    const result = await getModelSchema({ modelId: '' })

    expect(result).toEqual({ error: 'Unbekanntes Modell' })
  })

  it('should have "use server" as first line', () => {
    const filePath = resolve(__dirname, '..', 'models.ts')
    const content = readFileSync(filePath, 'utf-8')
    const firstLine = content.split('\n')[0].trim()

    expect(firstLine).toBe('"use server";')
  })

  it('should return error when Replicate API fails for a valid model', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    })

    const result = await getModelSchema({ modelId: 'black-forest-labs/flux-2-pro' })

    expect(result).toEqual({ error: 'Schema konnte nicht geladen werden' })
  })
})

describe('Dead Code Cleanup Verification', () => {
  it('should have deleted lib/models.ts', () => {
    const filePath = resolve(__dirname, '..', '..', '..', 'lib', 'models.ts')
    expect(existsSync(filePath)).toBe(false)
  })

  it('should have deleted lib/__tests__/models.test.ts', () => {
    const filePath = resolve(__dirname, '..', '..', '..', 'lib', '__tests__', 'models.test.ts')
    expect(existsSync(filePath)).toBe(false)
  })

  it('should not export deprecated server actions from models.ts', () => {
    const filePath = resolve(__dirname, '..', 'models.ts')
    const content = readFileSync(filePath, 'utf-8')

    expect(content).not.toMatch(/export\s+async\s+function\s+getFavoriteModels/)
    expect(content).not.toMatch(/export\s+async\s+function\s+toggleFavoriteModel/)
    expect(content).not.toMatch(/export\s+async\s+function\s+getProjectSelectedModels/)
    expect(content).not.toMatch(/export\s+async\s+function\s+saveProjectSelectedModels/)
  })

  it('should not import deprecated query functions', () => {
    const filePath = resolve(__dirname, '..', 'models.ts')
    const content = readFileSync(filePath, 'utf-8')

    expect(content).not.toMatch(/getFavoriteModelIds/)
    expect(content).not.toMatch(/addFavoriteModel/)
    expect(content).not.toMatch(/removeFavoriteModel/)
    expect(content).not.toMatch(/getProjectSelectedModelIds/)
    expect(content).not.toMatch(/saveProjectSelectedModelIds/)
  })
})
