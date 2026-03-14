import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock external dependencies and DB layer for GenerationService tests.
// We mock createGeneration to capture the batchId values passed to it,
// and mock external services (Replicate, Storage) since they are external.
// ---------------------------------------------------------------------------

const createGenerationCalls: Array<{ batchId?: string }> = []

vi.mock('@/lib/db/queries', () => {
  let callCounter = 0
  return {
    createGeneration: vi.fn(async (input: { batchId?: string; projectId: string; prompt: string; modelId: string }) => {
      createGenerationCalls.push({ batchId: input.batchId })
      callCounter++
      return {
        id: `gen-${callCounter}`,
        projectId: input.projectId,
        prompt: input.prompt,
        modelId: input.modelId,
        batchId: input.batchId ?? null,
        status: 'pending',
        negativePrompt: null,
        modelParams: {},
        imageUrl: null,
        replicatePredictionId: null,
        errorMessage: null,
        width: null,
        height: null,
        seed: null,
        promptMotiv: '',
        promptStyle: '',
        isFavorite: false,
        createdAt: new Date(),
        generationMode: 'txt2img',
        sourceImageUrl: null,
        sourceGenerationId: null,
      }
    }),
    getGeneration: vi.fn(),
    updateGeneration: vi.fn(),
    createGenerationReferences: vi.fn(),
  }
})

// Mock Replicate client — external service, must be mocked
vi.mock('@/lib/clients/replicate', () => ({
  ReplicateClient: {
    run: vi.fn().mockResolvedValue({
      output: new ReadableStream(),
      predictionId: 'pred-1',
      seed: 42,
    }),
  },
}))

// Mock Storage service — external service, must be mocked
vi.mock('@/lib/clients/storage', () => ({
  StorageService: {
    upload: vi.fn().mockResolvedValue('https://storage.example.com/image.png'),
  },
}))

// Mock sharp — external native dependency
vi.mock('sharp', () => {
  const sharpInstance = {
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
    metadata: vi.fn().mockResolvedValue({ width: 512, height: 512 }),
  }
  return {
    default: vi.fn(() => sharpInstance),
  }
})

// Mock model-schema-service
vi.mock('@/lib/services/model-schema-service', () => ({
  ModelSchemaService: {
    getSchema: vi.fn().mockResolvedValue({}),
  },
  getImg2ImgFieldName: vi.fn().mockReturnValue(null),
}))

// UUID v4 regex pattern
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('GenerationService.generate — batchId assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createGenerationCalls.length = 0
  })

  // AC-4: Single-Model Batch — gleiche batchId fuer alle Rows
  it('should assign the same UUID batchId to all generations in a single-model batch', async () => {
    /**
     * AC-4: GIVEN GenerationService.generate() wird mit count: 3 und einem einzelnen Model aufgerufen
     *        WHEN die 3 pending Generations erstellt werden
     *        THEN haben alle 3 Rows denselben batchId-Wert (ein gueltiger UUID v4)
     */

    // Act
    const { GenerationService } = await import('@/lib/services/generation-service')
    const results = await GenerationService.generate(
      'project-1',     // projectId
      'a cat',          // promptMotiv
      'watercolor',     // promptStyle
      undefined,        // negativePrompt
      ['owner/model-a'], // modelIds (single model)
      {},               // params
      3,                // count = 3
    )

    // Assert: 3 generations returned
    expect(results).toHaveLength(3)

    // Assert: createGeneration was called 3 times
    expect(createGenerationCalls).toHaveLength(3)

    // Assert: all 3 calls received the same batchId
    const batchIds = createGenerationCalls.map(c => c.batchId)
    const firstBatchId = batchIds[0]

    // All must be the same value
    expect(batchIds[1]).toBe(firstBatchId)
    expect(batchIds[2]).toBe(firstBatchId)

    // The batchId must be a valid UUID v4
    expect(firstBatchId).toBeDefined()
    expect(firstBatchId).toMatch(UUID_V4_REGEX)
  })

  // AC-5: Multi-Model Batch — gleiche batchId fuer alle Rows
  it('should assign the same UUID batchId to all generations in a multi-model batch', async () => {
    /**
     * AC-5: GIVEN GenerationService.generate() wird mit modelIds: ["model/a", "model/b"] (Multi-Model) aufgerufen
     *        WHEN die 2 pending Generations erstellt werden
     *        THEN haben beide Rows denselben batchId-Wert (ein gueltiger UUID v4)
     */

    // Act
    const { GenerationService } = await import('@/lib/services/generation-service')
    const results = await GenerationService.generate(
      'project-1',            // projectId
      'a dog',                // promptMotiv
      'oil painting',         // promptStyle
      undefined,              // negativePrompt
      ['model/a', 'model/b'], // modelIds (multi-model)
      {},                     // params
      1,                      // count (ignored in multi-model, 1 per model)
    )

    // Assert: 2 generations returned (one per model)
    expect(results).toHaveLength(2)

    // Assert: createGeneration was called 2 times
    expect(createGenerationCalls).toHaveLength(2)

    // Assert: both calls received the same batchId
    const batchIds = createGenerationCalls.map(c => c.batchId)
    const firstBatchId = batchIds[0]

    expect(batchIds[1]).toBe(firstBatchId)

    // The batchId must be a valid UUID v4
    expect(firstBatchId).toBeDefined()
    expect(firstBatchId).toMatch(UUID_V4_REGEX)
  })
})
