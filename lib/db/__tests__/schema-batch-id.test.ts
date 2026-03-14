import { describe, it, expect, expectTypeOf } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import type { InferSelectModel } from 'drizzle-orm'
import { generations } from '../schema'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Acceptance Tests for Slice 01 (Phase 4): DB Schema -- batchId Column
 *
 * These tests validate the new `batchId` UUID column on the `generations` table,
 * the associated index, the generated migration SQL, and the inferred TypeScript type.
 *
 * Slice-ID: slice-01-db-schema-batch-id
 * Mocking Strategy: no_mocks (pure schema inspection, no DB connection needed)
 */

type GenerationSelect = InferSelectModel<typeof generations>

describe('generations schema -- batchId column (slice-01-db-schema-batch-id)', () => {
  // Helper: get table config and column map once for reuse
  const config = getTableConfig(generations)
  const columnMap = Object.fromEntries(
    config.columns.map((c) => [c.name, c])
  )

  // -----------------------------------------------------------
  // AC-1: batchId Feld existiert und ist nullable UUID mit DEFAULT NULL
  // -----------------------------------------------------------
  it('AC-1: should have a nullable uuid batchId column on generations table', () => {
    /**
     * AC-1: GIVEN das aktuelle Drizzle-Schema in `lib/db/schema.ts`
     *       WHEN der Entwickler das Feld `batchId` zur `generations`-Tabelle hinzufuegt
     *       THEN enthaelt die Tabellendefinition ein Feld `batchId: uuid("batch_id")`
     *            das nullable ist und `DEFAULT NULL` hat
     */
    const col = columnMap['batch_id']

    // Column must exist
    expect(col, 'batch_id column should exist on generations table').toBeDefined()

    // Must be PgUUID type
    expect(col.columnType).toBe('PgUUID')
    expect(col.dataType).toBe('string')

    // Must be nullable (notNull should be false)
    expect(col.notNull).toBe(false)

    // Must NOT have a FK constraint (self-grouping, no FK -- per constraints)
    const batchFk = config.foreignKeys.find((fk) => {
      const ref = fk.reference()
      return ref.columns.some((c) => c.name === 'batch_id')
    })
    expect(batchFk, 'batch_id should NOT have a foreign key constraint').toBeUndefined()
  })

  // -----------------------------------------------------------
  // AC-2: Index auf batch_id existiert
  // -----------------------------------------------------------
  it('AC-2: should define generations_batch_id_idx index on batch_id column', () => {
    /**
     * AC-2: GIVEN die aktualisierte `generations`-Tabelle mit `batchId`-Feld
     *       WHEN die Index-Definitionen der Tabelle geprueft werden
     *       THEN existiert ein Index `generations_batch_id_idx` auf der Spalte `batch_id`
     */
    const indexNames = config.indexes.map((idx) => idx.config.name)
    expect(indexNames).toContain('generations_batch_id_idx')

    // Verify the index is on the correct column
    const batchIdx = config.indexes.find(
      (idx) => idx.config.name === 'generations_batch_id_idx'
    )
    expect(batchIdx).toBeDefined()

    // Index should be on exactly one column: batch_id
    expect(batchIdx!.config.columns.length).toBe(1)
    expect((batchIdx!.config.columns[0] as any).name).toBe('batch_id')
  })

  // -----------------------------------------------------------
  // AC-3: Migration-Datei mit korrektem ALTER TABLE und CREATE INDEX SQL
  // -----------------------------------------------------------
  it('AC-3: should generate migration with ALTER TABLE ADD COLUMN batch_id and CREATE INDEX', () => {
    /**
     * AC-3: GIVEN das aktualisierte Schema
     *       WHEN `pnpm drizzle-kit generate` ausgefuehrt wird
     *       THEN wird eine SQL-Migrationsdatei in `drizzle/` erzeugt die
     *            `ALTER TABLE generations ADD COLUMN batch_id UUID DEFAULT NULL`
     *            und `CREATE INDEX generations_batch_id_idx ON generations (batch_id)` enthaelt
     */
    const drizzleDir = path.resolve(__dirname, '..', '..', '..', 'drizzle')
    const migrationFile = path.join(drizzleDir, '0006_add_batch_id.sql')

    // Migration file must exist
    expect(
      fs.existsSync(migrationFile),
      `Migration file ${migrationFile} should exist`
    ).toBe(true)

    const content = fs.readFileSync(migrationFile, 'utf-8')

    // Must contain ALTER TABLE ... ADD COLUMN "batch_id" with UUID type
    expect(content).toContain('batch_id')
    expect(content).toMatch(/ALTER TABLE\s+"generations"\s+ADD COLUMN\s+"batch_id"/)
    expect(content).toMatch(/uuid/i)
    expect(content).toMatch(/DEFAULT\s+NULL/i)

    // Must contain CREATE INDEX for generations_batch_id_idx
    expect(content).toContain('generations_batch_id_idx')
    expect(content).toMatch(/CREATE INDEX\s+"generations_batch_id_idx"/)
    expect(content).toMatch(/ON\s+"generations"/)
    expect(content).toContain('"batch_id"')
  })

  // -----------------------------------------------------------
  // AC-4: Inferierter Typ enthaelt batchId als string | null
  // -----------------------------------------------------------
  it('AC-4: should infer batchId as string | null in Generation select type', () => {
    /**
     * AC-4: GIVEN das aktualisierte Schema
     *       WHEN der TypeScript-Typ der `generations`-Tabelle inferiert wird
     *            (`typeof generations.$inferSelect`)
     *       THEN enthaelt der Typ ein Feld `batchId` vom Typ `string | null`
     */

    // Type-level assertions using vitest expectTypeOf
    expectTypeOf<GenerationSelect>().toHaveProperty('batchId')
    expectTypeOf<GenerationSelect['batchId']>().toEqualTypeOf<string | null>()

    // Runtime verification: column with camelCase name exists in the schema object
    expect(generations.batchId).toBeDefined()
    expect(generations.batchId.name).toBe('batch_id')
  })

  // -----------------------------------------------------------
  // AC-5: Bestehende Rows defaulten auf NULL nach Migration
  // -----------------------------------------------------------
  it('AC-5: should default existing rows to NULL for batch_id after migration', () => {
    /**
     * AC-5: GIVEN bestehende Rows in der `generations`-Tabelle ohne `batch_id`-Wert
     *       WHEN die Migration angewendet wird
     *       THEN haben alle bestehenden Rows den Wert `NULL` fuer `batch_id`
     *            (kein Backfill noetig)
     *
     * We verify this at the schema level: the column has no notNull constraint
     * and the migration SQL uses DEFAULT NULL, so existing rows will get NULL.
     */
    const col = columnMap['batch_id']

    // Column must be nullable -- existing rows will default to NULL
    expect(col.notNull).toBe(false)

    // Column should not have a hasDefault that sets a non-null value
    // In Drizzle, uuid() without .default() or .notNull() means DEFAULT NULL in SQL
    // Verify the migration file explicitly uses DEFAULT NULL
    const drizzleDir = path.resolve(__dirname, '..', '..', '..', 'drizzle')
    const migrationFile = path.join(drizzleDir, '0006_add_batch_id.sql')
    const content = fs.readFileSync(migrationFile, 'utf-8')

    // The migration must use DEFAULT NULL to ensure existing rows get NULL
    expect(content).toMatch(/DEFAULT\s+NULL/i)

    // The migration must NOT contain any UPDATE or backfill statements
    expect(content.toUpperCase()).not.toContain('UPDATE')
    expect(content.toUpperCase()).not.toContain('BACKFILL')
  })
})
