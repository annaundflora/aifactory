/**
 * Tests for lib/db/migrations/migrate-source-images.ts
 * Slice: slice-17-migration-cleanup
 *
 * Mocking Strategy (from spec): mock_external
 * - Drizzle `db` instance is mocked (no real DB access)
 * - `createReferenceImage`, `createGenerationReferences`, `getGenerationReferences` are mocked
 *
 * ACs covered: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock setup: db + query functions
// ---------------------------------------------------------------------------

// Mock the db select query that fetches generations with sourceImageUrl
const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()

vi.mock('../../index', () => ({
  db: {
    select: (...args: unknown[]) => {
      mockSelect(...args)
      return {
        from: (...fArgs: unknown[]) => {
          mockFrom(...fArgs)
          return {
            where: (...wArgs: unknown[]) => {
              mockWhere(...wArgs)
              // Return the value set in mockWhere._resolvedValue
              return Promise.resolve(mockWhere._resolvedValue ?? [])
            },
          }
        },
      }
    },
  },
}))

// Extend mockWhere to hold a resolved value
;(mockWhere as Record<string, unknown>)._resolvedValue = []

const mockCreateReferenceImage = vi.fn()
const mockCreateGenerationReferences = vi.fn()
const mockGetGenerationReferences = vi.fn()

vi.mock('../../queries', () => ({
  createReferenceImage: (...args: unknown[]) => mockCreateReferenceImage(...args),
  createGenerationReferences: (...args: unknown[]) => mockCreateGenerationReferences(...args),
  getGenerationReferences: (...args: unknown[]) => mockGetGenerationReferences(...args),
}))

// Import AFTER mocks are set up
import { migrateSourceImages } from '../migrate-source-images'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GEN_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const GEN_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const GEN_C_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const PROJECT_ID = 'proj-1111-2222-3333-444444444444'
const REF_IMAGE_A_ID = 'ref-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
// REF_IMAGE_B_ID reserved for future test cases

function makeGenRow(id: string, projectId: string, sourceImageUrl: string | null) {
  return { id, projectId, sourceImageUrl }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setDbGenerations(rows: ReturnType<typeof makeGenRow>[]) {
  ;(mockWhere as Record<string, unknown>)._resolvedValue = rows
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('migrateSourceImages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(mockWhere as Record<string, unknown>)._resolvedValue = []
    // Default: no existing references (not yet migrated)
    mockGetGenerationReferences.mockResolvedValue([])
    // Default: createReferenceImage returns a record with an id
    mockCreateReferenceImage.mockImplementation((input: { projectId: string; imageUrl: string; sourceType: string; sourceGenerationId: string }) =>
      Promise.resolve({
        id: `ref-for-${input.sourceGenerationId}`,
        projectId: input.projectId,
        imageUrl: input.imageUrl,
        sourceType: input.sourceType,
        sourceGenerationId: input.sourceGenerationId,
        originalFilename: null,
        width: null,
        height: null,
        createdAt: new Date(),
      })
    )
    // Default: createGenerationReferences returns the input with ids
    mockCreateGenerationReferences.mockImplementation((refs: { generationId: string; referenceImageId: string; role: string; strength: string; slotPosition: number }[]) =>
      Promise.resolve(
        refs.map((r, i) => ({
          id: `gen-ref-${i}`,
          ...r,
        }))
      )
    )
  })

  // =========================================================================
  // AC-1: Nur Generierungen mit sourceImageUrl migrieren
  // =========================================================================
  /**
   * AC-1: GIVEN 3 Generierungen in der DB: gen-A mit sourceImageUrl = "https://r2.example/a.png",
   *       gen-B mit sourceImageUrl = "https://r2.example/b.png", gen-C mit sourceImageUrl = null
   *       WHEN das Migrations-Script ausgefuehrt wird
   *       THEN existieren genau 2 neue reference_images-Records (fuer gen-A und gen-B) und 0 Records fuer gen-C
   */
  it('AC-1: should create reference_images records only for generations with non-null sourceImageUrl', async () => {
    // The DB query with isNotNull filter already excludes gen-C (sourceImageUrl = null),
    // so the mock only returns gen-A and gen-B (matching the Drizzle WHERE clause behavior)
    setDbGenerations([
      makeGenRow(GEN_A_ID, PROJECT_ID, 'https://r2.example/a.png'),
      makeGenRow(GEN_B_ID, PROJECT_ID, 'https://r2.example/b.png'),
      // gen-C with null sourceImageUrl is NOT returned by the Drizzle query
      // because of .where(isNotNull(generations.sourceImageUrl))
    ])

    const result = await migrateSourceImages()

    // Exactly 2 reference images created (gen-A and gen-B)
    expect(mockCreateReferenceImage).toHaveBeenCalledTimes(2)

    // createGenerationReferences called with exactly 2 refs in a batch
    expect(mockCreateGenerationReferences).toHaveBeenCalledTimes(1)
    const batchArg = mockCreateGenerationReferences.mock.calls[0][0] as { generationId: string }[]
    expect(batchArg).toHaveLength(2)

    // Summary reflects 2 migrated, 0 skipped, 0 errors
    expect(result.migrated).toBe(2)
    expect(result.skipped).toBe(0)
    expect(result.errors).toBe(0)
  })

  // =========================================================================
  // AC-2: reference_images Record mit korrekten Feldern
  // =========================================================================
  /**
   * AC-2: GIVEN eine Generation gen-A mit sourceImageUrl = "https://r2.example/a.png" und projectId = "proj-1"
   *       WHEN das Migrations-Script diese Generation verarbeitet
   *       THEN existiert ein reference_images-Record mit imageUrl = "https://r2.example/a.png",
   *            projectId = "proj-1", sourceType = "gallery", sourceGenerationId = gen-A.id
   */
  it('AC-2: should create reference_images with correct imageUrl, projectId, sourceType gallery, and sourceGenerationId', async () => {
    setDbGenerations([
      makeGenRow(GEN_A_ID, PROJECT_ID, 'https://r2.example/a.png'),
    ])

    await migrateSourceImages()

    expect(mockCreateReferenceImage).toHaveBeenCalledTimes(1)
    expect(mockCreateReferenceImage).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      imageUrl: 'https://r2.example/a.png',
      sourceType: 'gallery',
      sourceGenerationId: GEN_A_ID,
    })
  })

  // =========================================================================
  // AC-3: generation_references Record mit role content, strength moderate, slotPosition 1
  // =========================================================================
  /**
   * AC-3: GIVEN eine Generation gen-A wurde migriert und hat einen neuen reference_images-Record mit id = "ref-X"
   *       WHEN die zugehoerigen generation_references geprueft werden
   *       THEN existiert ein Record mit generationId = gen-A.id, referenceImageId = "ref-X",
   *            role = "content", strength = "moderate", slotPosition = 1
   */
  it('AC-3: should create generation_references with role content, strength moderate, and slotPosition 1', async () => {
    mockCreateReferenceImage.mockResolvedValueOnce({
      id: REF_IMAGE_A_ID,
      projectId: PROJECT_ID,
      imageUrl: 'https://r2.example/a.png',
      sourceType: 'gallery',
      sourceGenerationId: GEN_A_ID,
      originalFilename: null,
      width: null,
      height: null,
      createdAt: new Date(),
    })

    setDbGenerations([
      makeGenRow(GEN_A_ID, PROJECT_ID, 'https://r2.example/a.png'),
    ])

    await migrateSourceImages()

    expect(mockCreateGenerationReferences).toHaveBeenCalledTimes(1)
    const refs = mockCreateGenerationReferences.mock.calls[0][0] as {
      generationId: string
      referenceImageId: string
      role: string
      strength: string
      slotPosition: number
    }[]
    expect(refs).toHaveLength(1)
    expect(refs[0]).toEqual({
      generationId: GEN_A_ID,
      referenceImageId: REF_IMAGE_A_ID,
      role: 'content',
      strength: 'moderate',
      slotPosition: 1,
    })
  })

  // =========================================================================
  // AC-4: Idempotenz -- keine Duplikate bei erneutem Lauf
  // =========================================================================
  /**
   * AC-4: GIVEN das Migrations-Script wird zweimal hintereinander ausgefuehrt
   *       WHEN es beim zweiten Lauf die DB prueft
   *       THEN werden keine Duplikate erstellt -- Generierungen die bereits
   *            generation_references-Records haben, werden uebersprungen
   */
  it('AC-4: should skip generations that already have generation_references records', async () => {
    setDbGenerations([
      makeGenRow(GEN_A_ID, PROJECT_ID, 'https://r2.example/a.png'),
      makeGenRow(GEN_B_ID, PROJECT_ID, 'https://r2.example/b.png'),
    ])

    // gen-A already has references (simulating second run), gen-B does not
    mockGetGenerationReferences
      .mockResolvedValueOnce([
        {
          id: 'existing-ref-1',
          generationId: GEN_A_ID,
          referenceImageId: REF_IMAGE_A_ID,
          role: 'content',
          strength: 'moderate',
          slotPosition: 1,
        },
      ]) // gen-A: already migrated
      .mockResolvedValueOnce([]) // gen-B: not yet migrated

    const result = await migrateSourceImages()

    // Only gen-B should be migrated, gen-A should be skipped
    expect(mockCreateReferenceImage).toHaveBeenCalledTimes(1)
    expect(mockCreateReferenceImage).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceGenerationId: GEN_B_ID,
        imageUrl: 'https://r2.example/b.png',
      })
    )

    // Summary: 1 migrated, 1 skipped
    expect(result.migrated).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.errors).toBe(0)
  })

  it('AC-4 (all skipped): should skip all generations when all already have references', async () => {
    setDbGenerations([
      makeGenRow(GEN_A_ID, PROJECT_ID, 'https://r2.example/a.png'),
    ])

    // gen-A already has references
    mockGetGenerationReferences.mockResolvedValueOnce([
      {
        id: 'existing-ref-1',
        generationId: GEN_A_ID,
        referenceImageId: REF_IMAGE_A_ID,
        role: 'content',
        strength: 'moderate',
        slotPosition: 1,
      },
    ])

    const result = await migrateSourceImages()

    // No new records created
    expect(mockCreateReferenceImage).not.toHaveBeenCalled()
    expect(mockCreateGenerationReferences).not.toHaveBeenCalled()

    expect(result.migrated).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.errors).toBe(0)
  })

  // =========================================================================
  // AC-5: sourceImageUrl Spalte bleibt unveraendert
  // =========================================================================
  /**
   * AC-5: GIVEN das Migrations-Script laeuft erfolgreich
   *       WHEN die generations-Tabelle inspiziert wird
   *       THEN ist die Spalte sourceImageUrl unveraendert (deprecated, NICHT geloescht) --
   *            bestehende Werte bleiben erhalten
   */
  it('AC-5: should not modify or delete the sourceImageUrl column values', async () => {
    setDbGenerations([
      makeGenRow(GEN_A_ID, PROJECT_ID, 'https://r2.example/a.png'),
    ])

    await migrateSourceImages()

    // The migration script should NEVER call db.update or db.delete on the generations table.
    // It only reads from generations (db.select) and writes to reference_images + generation_references.
    // We verify this by checking that:
    // 1. The source code does not modify generations
    // 2. No update/delete mock was called on the db (our mock only has select)

    // Verify the migration only uses createReferenceImage and createGenerationReferences
    // (which write to reference_images and generation_references tables, NOT generations)
    expect(mockCreateReferenceImage).toHaveBeenCalled()
    expect(mockCreateGenerationReferences).toHaveBeenCalled()

    // The db mock was only called via .select().from().where() -- no .update() or .delete()
    // This confirms sourceImageUrl values in generations table are untouched
    expect(mockSelect).toHaveBeenCalled()
    expect(mockFrom).toHaveBeenCalled()
    expect(mockWhere).toHaveBeenCalled()
  })

  it('AC-5 (static analysis): migration source should not contain UPDATE or DELETE on generations', async () => {
    // Read the migration source to verify no UPDATE/DELETE statements on generations
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const source = readFileSync(
      join(process.cwd(), 'lib/db/migrations/migrate-source-images.ts'),
      'utf-8'
    )

    // Should NOT contain any db.update() calls
    expect(source).not.toMatch(/db\s*\.\s*update\s*\(/)
    // Should NOT contain any db.delete() calls targeting generations
    expect(source).not.toMatch(/db\s*\.\s*delete\s*\(\s*generations\s*\)/)
    // Should NOT contain ALTER TABLE or DROP COLUMN
    expect(source).not.toMatch(/ALTER\s+TABLE/i)
    expect(source).not.toMatch(/DROP\s+COLUMN/i)
  })

  // =========================================================================
  // AC-6: Migrierte Referenz in ProvenanceRow-kompatiblem Format
  // =========================================================================
  /**
   * AC-6: GIVEN eine migrierte Generation gen-A wird in der Lightbox geoeffnet
   *       WHEN die ProvenanceRow (Slice 15) die Referenzen laedt
   *       THEN zeigt sie ein Thumbnail mit @1, Rolle "Content", Strength "Moderate" --
   *            identisch zu neuen Multi-Reference-Generierungen
   */
  it('AC-6: should produce generation_references records that ProvenanceRow can render with @1 label, role Content, and strength Moderate', async () => {
    mockCreateReferenceImage.mockResolvedValueOnce({
      id: REF_IMAGE_A_ID,
      projectId: PROJECT_ID,
      imageUrl: 'https://r2.example/a.png',
      sourceType: 'gallery',
      sourceGenerationId: GEN_A_ID,
      originalFilename: null,
      width: null,
      height: null,
      createdAt: new Date(),
    })

    setDbGenerations([
      makeGenRow(GEN_A_ID, PROJECT_ID, 'https://r2.example/a.png'),
    ])

    await migrateSourceImages()

    // Verify the generation_references record has the exact format ProvenanceRow expects:
    // - slotPosition = 1 (renders as @1 label)
    // - role = "content" (renders as "Content")
    // - strength = "moderate" (renders as "Moderate")
    const refs = mockCreateGenerationReferences.mock.calls[0][0] as {
      generationId: string
      referenceImageId: string
      role: string
      strength: string
      slotPosition: number
    }[]

    expect(refs).toHaveLength(1)

    // slotPosition 1 corresponds to @1 label in ProvenanceRow
    expect(refs[0].slotPosition).toBe(1)

    // role and strength match the display values (capitalized by ProvenanceRow)
    expect(refs[0].role).toBe('content')
    expect(refs[0].strength).toBe('moderate')

    // The referenceImageId links to a valid reference_images record
    expect(refs[0].referenceImageId).toBe(REF_IMAGE_A_ID)

    // The generationId links back to the original generation
    expect(refs[0].generationId).toBe(GEN_A_ID)
  })

  // =========================================================================
  // AC-7: Batch-Verarbeitung und Zusammenfassung
  // =========================================================================
  /**
   * AC-7: GIVEN das Migrations-Script verarbeitet 100 Generierungen mit sourceImageUrl
   *       WHEN es ausgefuehrt wird
   *       THEN werden die Inserts in Batches ausgefuehrt (nicht 100 einzelne INSERT-Statements)
   *            und das Script gibt eine Zusammenfassung aus:
   *            "Migrated: {N} generations, Skipped: {M} (already migrated), Errors: {E}"
   */
  it('AC-7: should process inserts in batches and return migration summary with migrated, skipped, and error counts', async () => {
    // Create 100 generations with sourceImageUrl
    const generations100 = Array.from({ length: 100 }, (_, i) =>
      makeGenRow(
        `gen-${String(i).padStart(4, '0')}`,
        PROJECT_ID,
        `https://r2.example/img-${i}.png`
      )
    )

    setDbGenerations(generations100)

    // Spy on console.log to capture the summary output
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const result = await migrateSourceImages()

    // Verify batch processing: createGenerationReferences should be called per-batch
    // With BATCH_SIZE = 50, 100 generations should result in 2 batch calls
    expect(mockCreateGenerationReferences).toHaveBeenCalledTimes(2)

    // Each batch should have up to 50 refs
    const batch1 = mockCreateGenerationReferences.mock.calls[0][0] as unknown[]
    const batch2 = mockCreateGenerationReferences.mock.calls[1][0] as unknown[]
    expect(batch1).toHaveLength(50)
    expect(batch2).toHaveLength(50)

    // Summary values are correct
    expect(result.migrated).toBe(100)
    expect(result.skipped).toBe(0)
    expect(result.errors).toBe(0)

    // Verify the summary log message format
    expect(consoleSpy).toHaveBeenCalledWith(
      'Migrated: 100 generations, Skipped: 0 (already migrated), Errors: 0'
    )

    consoleSpy.mockRestore()
  })

  it('AC-7 (mixed summary): should report correct counts when some generations are skipped or error', async () => {
    setDbGenerations([
      makeGenRow(GEN_A_ID, PROJECT_ID, 'https://r2.example/a.png'),
      makeGenRow(GEN_B_ID, PROJECT_ID, 'https://r2.example/b.png'),
      makeGenRow(GEN_C_ID, PROJECT_ID, 'https://r2.example/c.png'),
    ])

    // gen-A: already migrated (skipped)
    // gen-B: not migrated, will succeed
    // gen-C: not migrated, getGenerationReferences will throw (error)
    mockGetGenerationReferences
      .mockResolvedValueOnce([{ id: 'existing', generationId: GEN_A_ID }]) // gen-A: skip
      .mockResolvedValueOnce([]) // gen-B: migrate
      .mockRejectedValueOnce(new Error('DB connection failed')) // gen-C: error

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await migrateSourceImages()

    expect(result.skipped).toBe(1) // gen-A
    expect(result.migrated).toBe(1) // gen-B
    expect(result.errors).toBe(1) // gen-C

    // Verify summary log contains all three counts
    expect(consoleSpy).toHaveBeenCalledWith(
      'Migrated: 1 generations, Skipped: 1 (already migrated), Errors: 1'
    )

    consoleSpy.mockRestore()
    vi.restoreAllMocks()
  })

  it('AC-7 (batch size): should use BATCH_SIZE of 50 for processing', async () => {
    // Create 75 generations -- should result in 2 batches (50 + 25)
    const generations75 = Array.from({ length: 75 }, (_, i) =>
      makeGenRow(
        `gen-${String(i).padStart(4, '0')}`,
        PROJECT_ID,
        `https://r2.example/img-${i}.png`
      )
    )

    setDbGenerations(generations75)

    await migrateSourceImages()

    // 2 batch calls to createGenerationReferences
    expect(mockCreateGenerationReferences).toHaveBeenCalledTimes(2)

    const batch1 = mockCreateGenerationReferences.mock.calls[0][0] as unknown[]
    const batch2 = mockCreateGenerationReferences.mock.calls[1][0] as unknown[]
    expect(batch1).toHaveLength(50)
    expect(batch2).toHaveLength(25)
  })

  // =========================================================================
  // Additional: MigrationSummary type contract
  // =========================================================================
  it('should return a MigrationSummary with migrated, skipped, and errors fields', async () => {
    setDbGenerations([])

    const result = await migrateSourceImages()

    expect(result).toHaveProperty('migrated')
    expect(result).toHaveProperty('skipped')
    expect(result).toHaveProperty('errors')
    expect(typeof result.migrated).toBe('number')
    expect(typeof result.skipped).toBe('number')
    expect(typeof result.errors).toBe('number')
  })

  it('should handle empty database gracefully', async () => {
    setDbGenerations([])

    const result = await migrateSourceImages()

    expect(result.migrated).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.errors).toBe(0)
    expect(mockCreateReferenceImage).not.toHaveBeenCalled()
    expect(mockCreateGenerationReferences).not.toHaveBeenCalled()
  })

  it('should handle createGenerationReferences batch failure by counting errors', async () => {
    setDbGenerations([
      makeGenRow(GEN_A_ID, PROJECT_ID, 'https://r2.example/a.png'),
      makeGenRow(GEN_B_ID, PROJECT_ID, 'https://r2.example/b.png'),
    ])

    // createGenerationReferences fails for the batch
    mockCreateGenerationReferences.mockRejectedValueOnce(new Error('Batch insert failed'))

    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const result = await migrateSourceImages()

    // Both items were prepared but the batch insert failed, so both are errors
    expect(result.errors).toBe(2)
    expect(result.migrated).toBe(0)

    vi.restoreAllMocks()
  })
})
