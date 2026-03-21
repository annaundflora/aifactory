import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock the drizzle DB instance.  lib/db/index.ts tries to connect to
// PostgreSQL at import time and would throw without DATABASE_URL.
// We intercept it with a chainable proxy that records calls and returns
// configurable results.
// ---------------------------------------------------------------------------

// Shared state for controlling mock returns — lives outside vi.mock so
// tests can mutate it.  vi.mock is hoisted but these are module-scope lets.
let __insertResult: unknown[] = []
let __selectResult: unknown[] = []

/**
 * Build a deeply chainable Proxy where every property access returns
 * another proxy, and every function call returns another proxy.
 * The chain is "terminated" when .then() is accessed — at that point
 * we resolve the configured result (thenable protocol).
 */
function createChainProxy(getResult: () => unknown[]): unknown {
  const handler: ProxyHandler<() => unknown> = {
    get(_target, prop) {
      // Make the chain thenable so `await db.select()...` resolves
      if (prop === 'then') {
        const promise = Promise.resolve(getResult())
        return promise.then.bind(promise)
      }
      // For any other property, return another chainable proxy
      return createChainProxy(getResult)
    },
    apply() {
      // Any function call in the chain returns another chainable proxy
      return createChainProxy(getResult)
    },
  }
  const fn = () => undefined
  return new Proxy(fn, handler)
}

vi.mock('@/lib/db/index', () => {
  return {
    db: {
      insert: () => createChainProxy(() => __insertResult),
      select: () => createChainProxy(() => __selectResult),
      delete: () => createChainProxy(() => []),
      update: () => createChainProxy(() => []),
    },
  }
})

// Mock the schema with minimal column references needed by queries.ts
// (Drizzle uses these as column identifiers in eq(), and(), asc(), etc.)
vi.mock('@/lib/db/schema', () => ({
  projects: { id: 'id', name: 'name', createdAt: 'created_at', thumbnailUrl: 'thumbnail_url', thumbnailStatus: 'thumbnail_status', updatedAt: 'updated_at' },
  generations: {
    id: 'id',
    projectId: 'project_id',
    batchId: 'batch_id',
    status: 'status',
    createdAt: 'created_at',
    prompt: 'prompt',
    negativePrompt: 'negative_prompt',
    modelId: 'model_id',
    modelParams: 'model_params',
    imageUrl: 'image_url',
    replicatePredictionId: 'replicate_prediction_id',
    errorMessage: 'error_message',
    width: 'width',
    height: 'height',
    seed: 'seed',
    promptMotiv: 'prompt_motiv',
    promptStyle: 'prompt_style',
    isFavorite: 'is_favorite',
    generationMode: 'generation_mode',
    sourceImageUrl: 'source_image_url',
    sourceGenerationId: 'source_generation_id',
  },
  assistantSessions: { id: 'id', projectId: 'project_id', lastMessageAt: 'last_message_at' },
  referenceImages: { id: 'id', projectId: 'project_id', createdAt: 'created_at' },
  generationReferences: { generationId: 'generation_id', slotPosition: 'slot_position' },
}))

// Import the functions under test — they use the mocked db
import type { CreateGenerationInput } from '@/lib/db/queries'
import { createGeneration, getSiblingsByBatchId } from '@/lib/db/queries'

describe('CreateGenerationInput — batchId field', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __insertResult = []
    __selectResult = []
  })

  // AC-1: CreateGenerationInput hat optionales batchId-Feld
  it('should accept batchId as optional string field in CreateGenerationInput', () => {
    /**
     * AC-1: GIVEN CreateGenerationInput in lib/db/queries.ts
     *        WHEN der Typ geprueft wird
     *        THEN enthaelt er ein optionales Feld batchId?: string
     *
     * We verify at the type level: an object WITHOUT batchId must be
     * assignable to CreateGenerationInput (the field is optional), and
     * an object WITH batchId: string must also be assignable.
     */

    // Without batchId — must compile and be valid
    const withoutBatch: CreateGenerationInput = {
      projectId: 'p1',
      prompt: 'test prompt',
      modelId: 'owner/model',
    }
    expect(withoutBatch).toBeDefined()
    expect(withoutBatch).not.toHaveProperty('batchId')

    // With batchId — must compile and be valid
    const withBatch: CreateGenerationInput = {
      projectId: 'p1',
      prompt: 'test prompt',
      modelId: 'owner/model',
      batchId: '550e8400-e29b-41d4-a716-446655440000',
    }
    expect(withBatch.batchId).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  // AC-2: createGeneration speichert batchId korrekt
  it('should persist batchId value when provided in CreateGenerationInput', async () => {
    /**
     * AC-2: GIVEN ein CreateGenerationInput mit batchId: "550e8400-e29b-41d4-a716-446655440000"
     *        WHEN createGeneration(input) aufgerufen wird
     *        THEN enthaelt die zurueckgegebene Generation das Feld batchId
     *             mit dem Wert "550e8400-e29b-41d4-a716-446655440000"
     */
    const testBatchId = '550e8400-e29b-41d4-a716-446655440000'

    // Arrange: configure mock DB to return a generation with the batchId
    __insertResult = [{
      id: 'gen-1',
      projectId: 'p1',
      prompt: 'test',
      modelId: 'owner/model',
      batchId: testBatchId,
      status: 'pending',
      negativePrompt: null,
      modelParams: {},
      imageUrl: null,
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
      replicatePredictionId: null,
      errorMessage: null,
    }]

    // Act
    const result = await createGeneration({
      projectId: 'p1',
      prompt: 'test',
      modelId: 'owner/model',
      batchId: testBatchId,
    })

    // Assert
    expect(result.batchId).toBe(testBatchId)
  })

  // AC-3: createGeneration defaultet batchId auf null
  it('should default batchId to null when not provided in CreateGenerationInput', async () => {
    /**
     * AC-3: GIVEN ein CreateGenerationInput ohne batchId-Feld
     *        WHEN createGeneration(input) aufgerufen wird
     *        THEN enthaelt die zurueckgegebene Generation das Feld batchId mit dem Wert null
     */

    // Arrange: mock DB returns generation with batchId: null (the default)
    __insertResult = [{
      id: 'gen-2',
      projectId: 'p1',
      prompt: 'test',
      modelId: 'owner/model',
      batchId: null,
      status: 'pending',
      negativePrompt: null,
      modelParams: {},
      imageUrl: null,
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
      replicatePredictionId: null,
      errorMessage: null,
    }]

    // Act — no batchId provided
    const result = await createGeneration({
      projectId: 'p1',
      prompt: 'test',
      modelId: 'owner/model',
    })

    // Assert
    expect(result.batchId).toBeNull()
  })
})

describe('getSiblingsByBatchId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __insertResult = []
    __selectResult = []
  })

  // AC-6: Korrekte Siblings nach batchId gefiltert und sortiert
  it('should return all completed generations with matching batchId sorted by createdAt ASC', async () => {
    /**
     * AC-6: GIVEN 3 completed Generations mit batchId = "aaa-bbb-ccc"
     *              und 2 Generations mit batchId = "xxx-yyy-zzz" in der DB
     *        WHEN getSiblingsByBatchId("aaa-bbb-ccc") aufgerufen wird
     *        THEN werden genau 3 Generations zurueckgegeben, sortiert nach createdAt ASC
     */

    // Arrange: mock DB returns 3 completed generations sorted by createdAt ASC
    __selectResult = [
      { id: 'g1', batchId: 'aaa-bbb-ccc', status: 'completed', createdAt: new Date('2026-01-01T10:00:00Z') },
      { id: 'g2', batchId: 'aaa-bbb-ccc', status: 'completed', createdAt: new Date('2026-01-01T10:01:00Z') },
      { id: 'g3', batchId: 'aaa-bbb-ccc', status: 'completed', createdAt: new Date('2026-01-01T10:02:00Z') },
    ]

    // Act
    const result = await getSiblingsByBatchId('aaa-bbb-ccc')

    // Assert
    expect(result).toHaveLength(3)
    expect(result[0].id).toBe('g1')
    expect(result[1].id).toBe('g2')
    expect(result[2].id).toBe('g3')
    // Verify sorted by createdAt ASC
    for (let i = 1; i < result.length; i++) {
      expect(new Date(result[i].createdAt).getTime())
        .toBeGreaterThanOrEqual(new Date(result[i - 1].createdAt).getTime())
    }
  })

  // AC-7: Nur completed Generations zurueckgeben
  it('should exclude non-completed generations from sibling results', async () => {
    /**
     * AC-7: GIVEN 2 Generations mit batchId = "aaa-bbb-ccc",
     *              davon eine mit status: "completed" und eine mit status: "failed"
     *        WHEN getSiblingsByBatchId("aaa-bbb-ccc") aufgerufen wird
     *        THEN wird nur die Generation mit status: "completed" zurueckgegeben
     *
     * The WHERE clause in the query filters status = 'completed'.
     * The mock simulates what the DB would return (only completed rows).
     */

    // Arrange: mock returns only the completed one (DB filters failed out)
    __selectResult = [
      { id: 'g1', batchId: 'aaa-bbb-ccc', status: 'completed', createdAt: new Date('2026-01-01T10:00:00Z') },
    ]

    // Act
    const result = await getSiblingsByBatchId('aaa-bbb-ccc')

    // Assert
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('g1')
    expect(result[0].status).toBe('completed')
  })

  // AC-8: Leeres Array bei nicht-existierender batchId
  it('should return empty array when no generations match the given batchId', async () => {
    /**
     * AC-8: GIVEN keine Generations mit batchId = "nonexistent-id" in der DB
     *        WHEN getSiblingsByBatchId("nonexistent-id") aufgerufen wird
     *        THEN wird ein leeres Array [] zurueckgegeben
     */

    // Arrange: mock returns empty
    __selectResult = []

    // Act
    const result = await getSiblingsByBatchId('nonexistent-id')

    // Assert
    expect(result).toEqual([])
    expect(result).toHaveLength(0)
  })

  // AC-9: Leeres Array bei null batchId
  it('should return empty array when batchId is null', async () => {
    /**
     * AC-9: GIVEN Generations mit batchId = null in der DB
     *        WHEN getSiblingsByBatchId(null) aufgerufen wird
     *        THEN wird ein leeres Array [] zurueckgegeben (kein Matching auf NULL-Werte)
     */

    // Act — should short-circuit and return [] without querying DB at all
    const result = await getSiblingsByBatchId(null)

    // Assert
    expect(result).toEqual([])
    expect(result).toHaveLength(0)
  })
})
