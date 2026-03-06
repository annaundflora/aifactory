import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getModelSchema } from '@/app/actions/models'
import { ModelSchemaService } from '@/lib/services/model-schema-service'
import { readFileSync } from 'fs'
import { resolve } from 'path'

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

describe('getModelSchema Server Action', () => {
  beforeEach(() => {
    ModelSchemaService.clearCache()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // AC-3: GIVEN eine gueltige Model-ID "black-forest-labs/flux-2-pro"
  //       WHEN getModelSchema({ modelId: "black-forest-labs/flux-2-pro" }) aufgerufen wird
  //       THEN wird ein Objekt mit properties zurueckgegeben (JSON-Objekt mit mindestens einem Key)
  it('AC-3: should return properties object for a valid model ID', async () => {
    const fakeProperties = {
      prompt: { type: 'string', description: 'Input prompt' },
      width: { type: 'integer', default: 1024 },
    }

    mockFetch.mockResolvedValueOnce(buildReplicateResponse(fakeProperties))

    const result = await getModelSchema({ modelId: 'black-forest-labs/flux-2-pro' })

    expect(result).toHaveProperty('properties')
    expect('properties' in result && result.properties).toBeTruthy()

    // Must have at least one key
    if ('properties' in result) {
      expect(Object.keys(result.properties).length).toBeGreaterThanOrEqual(1)
    }
  })

  // AC-4: GIVEN eine ungueltige Model-ID "unknown/model"
  //       WHEN getModelSchema({ modelId: "unknown/model" }) aufgerufen wird
  //       THEN wird ein Fehler-Objekt { error: "Unbekanntes Modell" } zurueckgegeben
  it('AC-4: should return error for unknown model ID', async () => {
    const result = await getModelSchema({ modelId: 'unknown/model' })

    expect(result).toEqual({ error: 'Unbekanntes Modell' })
  })

  // AC-5: GIVEN eine leere Model-ID
  //       WHEN getModelSchema({ modelId: "" }) aufgerufen wird
  //       THEN wird ein Fehler-Objekt { error: "Unbekanntes Modell" } zurueckgegeben
  it('AC-5: should return error for empty model ID', async () => {
    const result = await getModelSchema({ modelId: '' })

    expect(result).toEqual({ error: 'Unbekanntes Modell' })
  })

  // AC-9: GIVEN app/actions/models.ts existiert
  //       WHEN die Datei inspiziert wird
  //       THEN beginnt sie mit "use server" als erste Zeile
  it('AC-9: should have "use server" as first line', () => {
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
