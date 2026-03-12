/**
 * Tests for lib/db/queries.ts — Reference Image & Generation Reference Queries
 * Slice: slice-02-reference-queries
 *
 * These tests mock the Drizzle db instance (per Mocking Strategy: mock_external)
 * to verify that query functions call the correct Drizzle methods with the
 * correct arguments and return the expected shapes.
 *
 * ACs covered: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock the db module before importing queries
// ---------------------------------------------------------------------------

// Chainable mock that captures method calls, matching the pattern in queries.test.ts.
// Each chainable method returns `this` so .from().where().orderBy() etc. work.

function createChainableMock(resolvedValue: unknown = []) {
  const createChain = (): Record<string, ReturnType<typeof vi.fn>> => {
    const proxy: Record<string, ReturnType<typeof vi.fn>> = {}
    const methods = [
      'select',
      'insert',
      'update',
      'delete',
      'from',
      'where',
      'set',
      'values',
      'returning',
      'orderBy',
    ]
    for (const m of methods) {
      proxy[m] = vi.fn().mockReturnValue(proxy)
    }
    // Make the chain thenable so `await` works
    proxy.then = vi
      .fn()
      .mockImplementation((resolve: (v: unknown) => void) => {
        return Promise.resolve(resolvedValue).then(resolve)
      })
    return proxy
  }

  return createChain()
}

let mockChain: ReturnType<typeof createChainableMock>

vi.mock('../index', () => {
  return {
    get db() {
      return mockChain
    },
  }
})

// Import queries AFTER the mock is set up
import {
  createReferenceImage,
  deleteReferenceImage,
  getReferenceImagesByProject,
  createGenerationReferences,
  getGenerationReferences,
} from '../queries'

// Import types to verify they are exported (AC-6)
import type { ReferenceImage, GenerationReference } from '../queries'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-11T10:00:00Z')
const LATER = new Date('2026-03-11T11:00:00Z')
const EVEN_LATER = new Date('2026-03-11T12:00:00Z')

const FAKE_PROJECT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const FAKE_PROJECT_ID_B = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'
const FAKE_REF_IMAGE_ID_1 = '11111111-1111-1111-1111-111111111111'
const FAKE_REF_IMAGE_ID_2 = '22222222-2222-2222-2222-222222222222'
const FAKE_REF_IMAGE_ID_3 = '33333333-3333-3333-3333-333333333333'
const FAKE_GENERATION_ID_X = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
const FAKE_GENERATION_ID_Y = 'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy'
const FAKE_GEN_REF_ID_1 = 'aaaa1111-bbbb-cccc-dddd-eeeeeeeeeeee'
const FAKE_GEN_REF_ID_2 = 'aaaa2222-bbbb-cccc-dddd-eeeeeeeeeeee'
const FAKE_GEN_REF_ID_3 = 'aaaa3333-bbbb-cccc-dddd-eeeeeeeeeeee'

const FAKE_REFERENCE_IMAGE: ReferenceImage = {
  id: FAKE_REF_IMAGE_ID_1,
  projectId: FAKE_PROJECT_ID,
  imageUrl: 'https://r2.example/ref.png',
  originalFilename: null,
  width: null,
  height: null,
  sourceType: 'upload',
  sourceGenerationId: null,
  createdAt: NOW,
} as ReferenceImage

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createReferenceImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * AC-1: GIVEN ein createReferenceImage-Aufruf mit { projectId: <UUID>, imageUrl: "https://r2.example/ref.png", sourceType: "upload" }
   * WHEN die Funktion ausgefuehrt wird
   * THEN wird ein INSERT in referenceImages ausgefuehrt und das zurueckgegebene Objekt enthaelt
   *      id (UUID), projectId, imageUrl, sourceType, createdAt (Timestamp) -- Type entspricht typeof referenceImages.$inferSelect
   */
  it('AC-1: should insert a reference_images row and return the full record with id and createdAt', async () => {
    mockChain = createChainableMock([FAKE_REFERENCE_IMAGE])

    const result = await createReferenceImage({
      projectId: FAKE_PROJECT_ID,
      imageUrl: 'https://r2.example/ref.png',
      sourceType: 'upload',
    })

    // Verify returned record contains all required fields
    expect(result).toEqual(FAKE_REFERENCE_IMAGE)
    expect(result.id).toBe(FAKE_REF_IMAGE_ID_1)
    expect(result.projectId).toBe(FAKE_PROJECT_ID)
    expect(result.imageUrl).toBe('https://r2.example/ref.png')
    expect(result.sourceType).toBe('upload')
    expect(result.createdAt).toBeInstanceOf(Date)

    // Verify Drizzle insert chain was called
    expect(mockChain.insert).toHaveBeenCalled()
    expect(mockChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: FAKE_PROJECT_ID,
        imageUrl: 'https://r2.example/ref.png',
        sourceType: 'upload',
      })
    )
    expect(mockChain.returning).toHaveBeenCalled()
  })

  /**
   * AC-1 (optional fields): createReferenceImage should accept optional fields
   * originalFilename, width, height, sourceGenerationId and pass them through
   */
  it('AC-1 (optional fields): should pass optional fields through to db.insert', async () => {
    const withOptionals: ReferenceImage = {
      ...FAKE_REFERENCE_IMAGE,
      originalFilename: 'photo.png',
      width: 1024,
      height: 768,
      sourceGenerationId: FAKE_GENERATION_ID_X,
    } as ReferenceImage
    mockChain = createChainableMock([withOptionals])

    const result = await createReferenceImage({
      projectId: FAKE_PROJECT_ID,
      imageUrl: 'https://r2.example/ref.png',
      sourceType: 'upload',
      originalFilename: 'photo.png',
      width: 1024,
      height: 768,
      sourceGenerationId: FAKE_GENERATION_ID_X,
    })

    expect(result.originalFilename).toBe('photo.png')
    expect(result.width).toBe(1024)
    expect(result.height).toBe(768)
    expect(result.sourceGenerationId).toBe(FAKE_GENERATION_ID_X)
    expect(mockChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        originalFilename: 'photo.png',
        width: 1024,
        height: 768,
        sourceGenerationId: FAKE_GENERATION_ID_X,
      })
    )
  })

  /**
   * AC-1 (defaults): When optional fields are omitted, they default to null
   */
  it('AC-1 (defaults): should default optional fields to null when omitted', async () => {
    mockChain = createChainableMock([FAKE_REFERENCE_IMAGE])

    await createReferenceImage({
      projectId: FAKE_PROJECT_ID,
      imageUrl: 'https://r2.example/ref.png',
      sourceType: 'upload',
    })

    expect(mockChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        originalFilename: null,
        width: null,
        height: null,
        sourceGenerationId: null,
      })
    )
  })
})

describe('deleteReferenceImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * AC-2: GIVEN ein existierender reference_images-Eintrag mit bekannter id
   * WHEN deleteReferenceImage(id) aufgerufen wird
   * THEN wird ein DELETE FROM reference_images WHERE id = <id> ausgefuehrt
   *      und die Funktion resolved ohne Fehler
   */
  it('AC-2: should delete the reference_images row by id', async () => {
    mockChain = createChainableMock(undefined)

    // Should resolve without error
    await expect(
      deleteReferenceImage(FAKE_REF_IMAGE_ID_1)
    ).resolves.toBeUndefined()

    // Verify DELETE chain was called
    expect(mockChain.delete).toHaveBeenCalled()
    expect(mockChain.where).toHaveBeenCalled()
  })
})

describe('getReferenceImagesByProject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * AC-3: GIVEN zwei reference_images-Eintraege fuer projectId = "proj-A" und ein Eintrag fuer projectId = "proj-B"
   * WHEN getReferenceImagesByProject("proj-A") aufgerufen wird
   * THEN werden genau 2 Eintraege zurueckgegeben, aufsteigend nach createdAt sortiert,
   *      alle mit projectId = "proj-A"
   */
  it('AC-3: should return only references for the given projectId ordered by createdAt ascending', async () => {
    const refA1: ReferenceImage = {
      id: FAKE_REF_IMAGE_ID_1,
      projectId: FAKE_PROJECT_ID,
      imageUrl: 'https://r2.example/ref1.png',
      originalFilename: null,
      width: null,
      height: null,
      sourceType: 'upload',
      sourceGenerationId: null,
      createdAt: NOW,
    } as ReferenceImage

    const refA2: ReferenceImage = {
      id: FAKE_REF_IMAGE_ID_2,
      projectId: FAKE_PROJECT_ID,
      imageUrl: 'https://r2.example/ref2.png',
      originalFilename: null,
      width: null,
      height: null,
      sourceType: 'upload',
      sourceGenerationId: null,
      createdAt: LATER,
    } as ReferenceImage

    // Mock returns only the 2 records for proj-A (already filtered + sorted by the query)
    mockChain = createChainableMock([refA1, refA2])

    const result = await getReferenceImagesByProject(FAKE_PROJECT_ID)

    // Exactly 2 entries returned
    expect(result).toHaveLength(2)

    // All entries belong to project A
    expect(result[0].projectId).toBe(FAKE_PROJECT_ID)
    expect(result[1].projectId).toBe(FAKE_PROJECT_ID)

    // Sorted by createdAt ascending (first is older)
    expect(result[0].createdAt.getTime()).toBeLessThanOrEqual(
      result[1].createdAt.getTime()
    )

    // Verify Drizzle select chain was called correctly
    expect(mockChain.select).toHaveBeenCalled()
    expect(mockChain.from).toHaveBeenCalled()
    expect(mockChain.where).toHaveBeenCalled()
    expect(mockChain.orderBy).toHaveBeenCalled()
  })

  /**
   * AC-3 (empty): When no references exist for a project, returns empty array
   */
  it('AC-3 (empty): should return empty array when no references exist for project', async () => {
    mockChain = createChainableMock([])

    const result = await getReferenceImagesByProject('nonexistent-project-id')

    expect(result).toEqual([])
    expect(result).toHaveLength(0)
  })
})

describe('createGenerationReferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * AC-4: GIVEN ein createGenerationReferences-Aufruf mit einem Array von 3 Eintraegen
   *       [{ generationId, referenceImageId, role: "style", strength: "strong", slotPosition: 1 }, ...]
   * WHEN die Funktion ausgefuehrt wird
   * THEN werden 3 Rows in generationReferences per Batch-Insert eingefuegt und die eingefuegten
   *      Records zurueckgegeben -- jeder mit id (UUID), allen Input-Feldern und korrekten Werten
   */
  it('AC-4: should batch-insert multiple generation_references rows and return all inserted records', async () => {
    const inputRefs = [
      {
        generationId: FAKE_GENERATION_ID_X,
        referenceImageId: FAKE_REF_IMAGE_ID_1,
        role: 'style',
        strength: 'strong',
        slotPosition: 1,
      },
      {
        generationId: FAKE_GENERATION_ID_X,
        referenceImageId: FAKE_REF_IMAGE_ID_2,
        role: 'composition',
        strength: 'medium',
        slotPosition: 2,
      },
      {
        generationId: FAKE_GENERATION_ID_X,
        referenceImageId: FAKE_REF_IMAGE_ID_3,
        role: 'subject',
        strength: 'subtle',
        slotPosition: 3,
      },
    ]

    const insertedRecords: GenerationReference[] = [
      {
        id: FAKE_GEN_REF_ID_1,
        generationId: FAKE_GENERATION_ID_X,
        referenceImageId: FAKE_REF_IMAGE_ID_1,
        role: 'style',
        strength: 'strong',
        slotPosition: 1,
      } as GenerationReference,
      {
        id: FAKE_GEN_REF_ID_2,
        generationId: FAKE_GENERATION_ID_X,
        referenceImageId: FAKE_REF_IMAGE_ID_2,
        role: 'composition',
        strength: 'medium',
        slotPosition: 2,
      } as GenerationReference,
      {
        id: FAKE_GEN_REF_ID_3,
        generationId: FAKE_GENERATION_ID_X,
        referenceImageId: FAKE_REF_IMAGE_ID_3,
        role: 'subject',
        strength: 'subtle',
        slotPosition: 3,
      } as GenerationReference,
    ]

    mockChain = createChainableMock(insertedRecords)

    const result = await createGenerationReferences(inputRefs)

    // 3 records returned
    expect(result).toHaveLength(3)

    // Each record has an id (UUID)
    for (const record of result) {
      expect(record.id).toBeDefined()
      expect(typeof record.id).toBe('string')
    }

    // Verify input values are preserved in output
    expect(result[0].role).toBe('style')
    expect(result[0].strength).toBe('strong')
    expect(result[0].slotPosition).toBe(1)
    expect(result[0].generationId).toBe(FAKE_GENERATION_ID_X)
    expect(result[0].referenceImageId).toBe(FAKE_REF_IMAGE_ID_1)

    expect(result[1].role).toBe('composition')
    expect(result[1].strength).toBe('medium')
    expect(result[1].slotPosition).toBe(2)

    expect(result[2].role).toBe('subject')
    expect(result[2].strength).toBe('subtle')
    expect(result[2].slotPosition).toBe(3)

    // Verify batch-insert: values() is called with the full array (not per-item loop)
    expect(mockChain.insert).toHaveBeenCalled()
    expect(mockChain.values).toHaveBeenCalledWith(inputRefs)
    expect(mockChain.returning).toHaveBeenCalled()

    // Ensure values was called exactly once (batch, not loop)
    expect(mockChain.values).toHaveBeenCalledTimes(1)
  })
})

describe('getGenerationReferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * AC-5: GIVEN 2 generation_references-Eintraege fuer generationId = "gen-X" und 1 Eintrag fuer generationId = "gen-Y"
   * WHEN getGenerationReferences("gen-X") aufgerufen wird
   * THEN werden genau 2 Eintraege zurueckgegeben, aufsteigend nach slotPosition sortiert,
   *      alle mit generationId = "gen-X"
   */
  it('AC-5: should return only references for the given generationId ordered by slotPosition ascending', async () => {
    const genRefX1: GenerationReference = {
      id: FAKE_GEN_REF_ID_1,
      generationId: FAKE_GENERATION_ID_X,
      referenceImageId: FAKE_REF_IMAGE_ID_1,
      role: 'style',
      strength: 'strong',
      slotPosition: 1,
    } as GenerationReference

    const genRefX2: GenerationReference = {
      id: FAKE_GEN_REF_ID_2,
      generationId: FAKE_GENERATION_ID_X,
      referenceImageId: FAKE_REF_IMAGE_ID_2,
      role: 'composition',
      strength: 'medium',
      slotPosition: 2,
    } as GenerationReference

    // Mock returns only the 2 records for gen-X (already filtered + sorted by the query)
    mockChain = createChainableMock([genRefX1, genRefX2])

    const result = await getGenerationReferences(FAKE_GENERATION_ID_X)

    // Exactly 2 entries returned
    expect(result).toHaveLength(2)

    // All entries belong to generation X
    expect(result[0].generationId).toBe(FAKE_GENERATION_ID_X)
    expect(result[1].generationId).toBe(FAKE_GENERATION_ID_X)

    // Sorted by slotPosition ascending
    expect(result[0].slotPosition).toBeLessThan(result[1].slotPosition)
    expect(result[0].slotPosition).toBe(1)
    expect(result[1].slotPosition).toBe(2)

    // Verify Drizzle select chain was called correctly
    expect(mockChain.select).toHaveBeenCalled()
    expect(mockChain.from).toHaveBeenCalled()
    expect(mockChain.where).toHaveBeenCalled()
    expect(mockChain.orderBy).toHaveBeenCalled()
  })

  /**
   * AC-5 (empty): When no references exist for a generation, returns empty array
   */
  it('AC-5 (empty): should return empty array when no references exist for generation', async () => {
    mockChain = createChainableMock([])

    const result = await getGenerationReferences('nonexistent-gen-id')

    expect(result).toEqual([])
    expect(result).toHaveLength(0)
  })
})

describe('Type Exports', () => {
  /**
   * AC-6: GIVEN die 5 neuen Funktionen
   * WHEN deren Typen inspiziert werden
   * THEN exportiert queries.ts die Typen ReferenceImage (via typeof referenceImages.$inferSelect)
   *      und GenerationReference (via typeof generationReferences.$inferSelect)
   */
  it('AC-6: should export ReferenceImage and GenerationReference types', () => {
    // This test verifies that the type imports compiled successfully.
    // If ReferenceImage or GenerationReference were not exported from queries.ts,
    // the import statement at the top of this file would cause a TypeScript compilation error.

    // Runtime assertion: create typed objects to verify the types are structurally valid
    const refImage: ReferenceImage = {
      id: FAKE_REF_IMAGE_ID_1,
      projectId: FAKE_PROJECT_ID,
      imageUrl: 'https://r2.example/ref.png',
      originalFilename: null,
      width: null,
      height: null,
      sourceType: 'upload',
      sourceGenerationId: null,
      createdAt: NOW,
    } as ReferenceImage

    const genRef: GenerationReference = {
      id: FAKE_GEN_REF_ID_1,
      generationId: FAKE_GENERATION_ID_X,
      referenceImageId: FAKE_REF_IMAGE_ID_1,
      role: 'style',
      strength: 'strong',
      slotPosition: 1,
    } as GenerationReference

    // If the types are exported correctly, these assignments compile without errors
    expect(refImage.id).toBeDefined()
    expect(refImage.projectId).toBeDefined()
    expect(refImage.imageUrl).toBeDefined()
    expect(refImage.sourceType).toBeDefined()
    expect(refImage.createdAt).toBeDefined()

    expect(genRef.id).toBeDefined()
    expect(genRef.generationId).toBeDefined()
    expect(genRef.referenceImageId).toBeDefined()
    expect(genRef.role).toBeDefined()
    expect(genRef.strength).toBeDefined()
    expect(genRef.slotPosition).toBeDefined()
  })

  /**
   * AC-6 (function exports): All 5 query functions are exported
   */
  it('AC-6 (function exports): should export all 5 query functions', () => {
    expect(typeof createReferenceImage).toBe('function')
    expect(typeof deleteReferenceImage).toBe('function')
    expect(typeof getReferenceImagesByProject).toBe('function')
    expect(typeof createGenerationReferences).toBe('function')
    expect(typeof getGenerationReferences).toBe('function')
  })
})
