import { describe, it, expect } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import {
  referenceImages,
  generationReferences,
  projects,
  generations,
} from '../schema'

/**
 * Tests for slice-01-db-schema-migration (Multi-Image Referencing)
 *
 * These tests validate the Drizzle ORM schema definitions for
 * `referenceImages` and `generationReferences` against the Acceptance
 * Criteria in the slice spec. They introspect the schema objects directly
 * via Drizzle's getTableConfig — no running database required.
 *
 * AC-7 and AC-8 (migration generate + push) are validated by inspecting
 * the generated migration files on disk.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function columnMap(table: Parameters<typeof getTableConfig>[0]) {
  const config = getTableConfig(table)
  return Object.fromEntries(
    config.columns.map((c) => [
      c.name,
      {
        name: c.name,
        columnType: c.columnType,
        dataType: c.dataType,
        notNull: c.notNull,
        hasDefault: c.hasDefault,
        primary: c.primary,
      },
    ])
  )
}

function foreignKeys(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).foreignKeys.map((fk) => ({
    columns: fk.reference().columns.map((c) => c.name),
    foreignColumns: fk.reference().foreignColumns.map((c) => c.name),
    foreignTable: (fk.reference().foreignTable as any)[
      Symbol.for('drizzle:Name')
    ] as string,
    onDelete: fk.onDelete,
  }))
}

function indexes(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).indexes.map((i) => ({
    name: i.config.name,
    columns: i.config.columns.map((c: any) => c.name),
  }))
}

// ===========================================================================
// referenceImages table definition — AC-1, AC-2, AC-3
// ===========================================================================
describe('referenceImages table definition', () => {
  /**
   * AC-1: GIVEN das bestehende Schema in lib/db/schema.ts mit 5 Tabellen
   *       WHEN der Implementer die Datei erweitert
   *       THEN existiert eine referenceImages Tabellen-Definition mit allen
   *            Spalten gemaess architecture.md Section "Schema Details:
   *            reference_images" (id, projectId, imageUrl, originalFilename,
   *            width, height, sourceType, sourceGenerationId, createdAt)
   */
  it('AC-1: should define referenceImages table with all required columns', () => {
    const config = getTableConfig(referenceImages)
    expect(config.name).toBe('reference_images')

    const cols = columnMap(referenceImages)
    const colNames = Object.keys(cols)

    // All 9 required columns per architecture.md
    const requiredColumns = [
      'id',
      'project_id',
      'image_url',
      'original_filename',
      'width',
      'height',
      'source_type',
      'source_generation_id',
      'created_at',
    ]
    for (const col of requiredColumns) {
      expect(colNames, `Column "${col}" must exist in referenceImages`).toContain(col)
    }

    // id: UUID PK with gen_random_uuid() default
    expect(cols['id'].columnType).toBe('PgUUID')
    expect(cols['id'].primary).toBe(true)
    expect(cols['id'].notNull).toBe(true)
    expect(cols['id'].hasDefault).toBe(true)

    // project_id: UUID NOT NULL (FK verified in AC-2)
    expect(cols['project_id'].columnType).toBe('PgUUID')
    expect(cols['project_id'].notNull).toBe(true)

    // image_url: TEXT NOT NULL
    expect(cols['image_url'].columnType).toBe('PgText')
    expect(cols['image_url'].notNull).toBe(true)

    // original_filename: VARCHAR(255), nullable
    expect(cols['original_filename'].columnType).toBe('PgVarchar')
    expect(cols['original_filename'].notNull).toBe(false)

    // width: INTEGER, nullable
    expect(cols['width'].columnType).toBe('PgInteger')
    expect(cols['width'].notNull).toBe(false)

    // height: INTEGER, nullable
    expect(cols['height'].columnType).toBe('PgInteger')
    expect(cols['height'].notNull).toBe(false)

    // source_type: VARCHAR(20) NOT NULL
    expect(cols['source_type'].columnType).toBe('PgVarchar')
    expect(cols['source_type'].notNull).toBe(true)

    // source_generation_id: UUID, nullable (FK verified in AC-2)
    expect(cols['source_generation_id'].columnType).toBe('PgUUID')
    expect(cols['source_generation_id'].notNull).toBe(false)

    // created_at: TIMESTAMPTZ NOT NULL with defaultNow()
    expect(cols['created_at'].columnType).toBe('PgTimestamp')
    expect(cols['created_at'].notNull).toBe(true)
    expect(cols['created_at'].hasDefault).toBe(true)
  })

  /**
   * AC-2: GIVEN die referenceImages Tabellen-Definition
   *       WHEN die Tabelle inspiziert wird
   *       THEN existiert ein FK von projectId auf projects.id mit
   *            ON DELETE CASCADE und ein FK von sourceGenerationId auf
   *            generations.id mit ON DELETE SET NULL
   */
  it('AC-2: should define projectId FK to projects with ON DELETE CASCADE', () => {
    const fks = foreignKeys(referenceImages)

    const projectIdFk = fks.find(
      (fk) =>
        fk.columns.includes('project_id') && fk.foreignTable === 'projects'
    )
    expect(
      projectIdFk,
      'FK from project_id -> projects.id must exist'
    ).toBeDefined()
    expect(projectIdFk!.foreignColumns).toEqual(['id'])
    expect(projectIdFk!.onDelete).toBe('cascade')
  })

  it('AC-2: should define sourceGenerationId FK to generations with ON DELETE SET NULL', () => {
    const fks = foreignKeys(referenceImages)

    const sourceGenFk = fks.find(
      (fk) =>
        fk.columns.includes('source_generation_id') &&
        fk.foreignTable === 'generations'
    )
    expect(
      sourceGenFk,
      'FK from source_generation_id -> generations.id must exist'
    ).toBeDefined()
    expect(sourceGenFk!.foreignColumns).toEqual(['id'])
    expect(sourceGenFk!.onDelete).toBe('set null')
  })

  /**
   * AC-3: GIVEN die referenceImages Tabellen-Definition
   *       WHEN die Indexes inspiziert werden
   *       THEN existiert ein Index auf projectId
   */
  it('AC-3: should define index on projectId', () => {
    const idxs = indexes(referenceImages)

    const projectIdIdx = idxs.find((idx) =>
      idx.columns.includes('project_id')
    )
    expect(
      projectIdIdx,
      'Index on project_id must exist'
    ).toBeDefined()
    expect(projectIdIdx!.name).toBe('reference_images_project_id_idx')
  })
})

// ===========================================================================
// generationReferences table definition — AC-4, AC-5, AC-6
// ===========================================================================
describe('generationReferences table definition', () => {
  /**
   * AC-4: GIVEN das bestehende Schema in lib/db/schema.ts
   *       WHEN der Implementer die Datei erweitert
   *       THEN existiert eine generationReferences Tabellen-Definition mit
   *            allen Spalten gemaess architecture.md Section "Schema Details:
   *            generation_references" (id, generationId, referenceImageId,
   *            role, strength, slotPosition)
   */
  it('AC-4: should define generationReferences table with all required columns', () => {
    const config = getTableConfig(generationReferences)
    expect(config.name).toBe('generation_references')

    const cols = columnMap(generationReferences)
    const colNames = Object.keys(cols)

    // All 6 required columns per architecture.md
    const requiredColumns = [
      'id',
      'generation_id',
      'reference_image_id',
      'role',
      'strength',
      'slot_position',
    ]
    for (const col of requiredColumns) {
      expect(
        colNames,
        `Column "${col}" must exist in generationReferences`
      ).toContain(col)
    }

    // id: UUID PK with gen_random_uuid() default
    expect(cols['id'].columnType).toBe('PgUUID')
    expect(cols['id'].primary).toBe(true)
    expect(cols['id'].notNull).toBe(true)
    expect(cols['id'].hasDefault).toBe(true)

    // generation_id: UUID NOT NULL (FK verified in AC-5)
    expect(cols['generation_id'].columnType).toBe('PgUUID')
    expect(cols['generation_id'].notNull).toBe(true)

    // reference_image_id: UUID NOT NULL (FK verified in AC-5)
    expect(cols['reference_image_id'].columnType).toBe('PgUUID')
    expect(cols['reference_image_id'].notNull).toBe(true)

    // role: VARCHAR(20) NOT NULL
    expect(cols['role'].columnType).toBe('PgVarchar')
    expect(cols['role'].notNull).toBe(true)

    // strength: VARCHAR(20) NOT NULL
    expect(cols['strength'].columnType).toBe('PgVarchar')
    expect(cols['strength'].notNull).toBe(true)

    // slot_position: INTEGER NOT NULL
    expect(cols['slot_position'].columnType).toBe('PgInteger')
    expect(cols['slot_position'].notNull).toBe(true)
  })

  /**
   * AC-5: GIVEN die generationReferences Tabellen-Definition
   *       WHEN die Tabelle inspiziert wird
   *       THEN existiert ein FK von generationId auf generations.id mit
   *            ON DELETE CASCADE und ein FK von referenceImageId auf
   *            referenceImages.id mit ON DELETE CASCADE
   */
  it('AC-5: should define generationId FK to generations with ON DELETE CASCADE', () => {
    const fks = foreignKeys(generationReferences)

    const generationIdFk = fks.find(
      (fk) =>
        fk.columns.includes('generation_id') &&
        fk.foreignTable === 'generations'
    )
    expect(
      generationIdFk,
      'FK from generation_id -> generations.id must exist'
    ).toBeDefined()
    expect(generationIdFk!.foreignColumns).toEqual(['id'])
    expect(generationIdFk!.onDelete).toBe('cascade')
  })

  it('AC-5: should define referenceImageId FK to referenceImages with ON DELETE CASCADE', () => {
    const fks = foreignKeys(generationReferences)

    const refImageFk = fks.find(
      (fk) =>
        fk.columns.includes('reference_image_id') &&
        fk.foreignTable === 'reference_images'
    )
    expect(
      refImageFk,
      'FK from reference_image_id -> reference_images.id must exist'
    ).toBeDefined()
    expect(refImageFk!.foreignColumns).toEqual(['id'])
    expect(refImageFk!.onDelete).toBe('cascade')
  })

  /**
   * AC-6: GIVEN die generationReferences Tabellen-Definition
   *       WHEN die Indexes inspiziert werden
   *       THEN existiert ein Index auf generationId
   */
  it('AC-6: should define index on generationId', () => {
    const idxs = indexes(generationReferences)

    const generationIdIdx = idxs.find((idx) =>
      idx.columns.includes('generation_id')
    )
    expect(
      generationIdIdx,
      'Index on generation_id must exist'
    ).toBeDefined()
    expect(generationIdIdx!.name).toBe(
      'generation_references_generation_id_idx'
    )
  })
})

// ===========================================================================
// Migration file existence — AC-7
// ===========================================================================
describe('Migration file (AC-7)', () => {
  /**
   * AC-7: GIVEN die erweiterten Schema-Definitionen
   *       WHEN npx drizzle-kit generate ausgefuehrt wird
   *       THEN wird eine Migration-Datei im drizzle/ Verzeichnis erzeugt
   *            (Exit-Code 0)
   */
  it('AC-7: should have generated a migration SQL file in drizzle/ directory', async () => {
    const fs = await import('fs')
    const path = await import('path')

    const drizzleDir = path.resolve(__dirname, '..', '..', '..', 'drizzle')
    expect(fs.existsSync(drizzleDir), 'drizzle/ directory must exist').toBe(
      true
    )

    // The migration file 0005_simple_human_torch.sql must exist
    const migrationFile = path.join(drizzleDir, '0005_simple_human_torch.sql')
    expect(
      fs.existsSync(migrationFile),
      'Migration file 0005_simple_human_torch.sql must exist in drizzle/'
    ).toBe(true)

    // Validate migration content creates both tables
    const content = fs.readFileSync(migrationFile, 'utf-8')
    expect(content).toContain('CREATE TABLE "reference_images"')
    expect(content).toContain('CREATE TABLE "generation_references"')

    // Validate foreign key constraints are present
    expect(content).toContain(
      'FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade'
    )
    expect(content).toContain(
      'FOREIGN KEY ("source_generation_id") REFERENCES "public"."generations"("id") ON DELETE set null'
    )
    expect(content).toContain(
      'FOREIGN KEY ("generation_id") REFERENCES "public"."generations"("id") ON DELETE cascade'
    )
    expect(content).toContain(
      'FOREIGN KEY ("reference_image_id") REFERENCES "public"."reference_images"("id") ON DELETE cascade'
    )

    // Validate indexes are present
    expect(content).toContain(
      'CREATE INDEX "reference_images_project_id_idx"'
    )
    expect(content).toContain(
      'CREATE INDEX "generation_references_generation_id_idx"'
    )
  })

  it('AC-7: migration journal should include the new migration entry', async () => {
    const fs = await import('fs')
    const path = await import('path')

    const journalPath = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      'drizzle',
      'meta',
      '_journal.json'
    )
    expect(fs.existsSync(journalPath), 'drizzle journal must exist').toBe(true)

    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'))
    const entry = journal.entries.find(
      (e: { tag: string }) => e.tag === '0005_simple_human_torch'
    )
    expect(
      entry,
      'Journal must contain 0005_simple_human_torch entry'
    ).toBeDefined()
    expect(entry.idx).toBe(5)
  })
})

// ===========================================================================
// Schema exports — integration contract for downstream slices
// ===========================================================================
describe('Schema exports for downstream slices', () => {
  it('should export referenceImages as a valid Drizzle pgTable', () => {
    expect(referenceImages).toBeDefined()
    const config = getTableConfig(referenceImages)
    expect(config.name).toBe('reference_images')
    expect(config.columns.length).toBeGreaterThan(0)
  })

  it('should export generationReferences as a valid Drizzle pgTable', () => {
    expect(generationReferences).toBeDefined()
    const config = getTableConfig(generationReferences)
    expect(config.name).toBe('generation_references')
    expect(config.columns.length).toBeGreaterThan(0)
  })

  it('should preserve existing table exports (projects, generations) unchanged', () => {
    // Ensure adding new tables did not break existing exports
    expect(projects).toBeDefined()
    expect(generations).toBeDefined()
    expect(getTableConfig(projects).name).toBe('projects')
    expect(getTableConfig(generations).name).toBe('generations')
  })
})
