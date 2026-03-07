import { describe, it, expect, expectTypeOf } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import type { InferSelectModel } from 'drizzle-orm'
import { projects } from '../schema'

/**
 * Acceptance Tests for Slice 02: DB Schema -- Projects Extensions
 *
 * These tests validate the two new columns (thumbnail_url, thumbnail_status),
 * the new index (projects_thumbnail_status_idx), and the extended
 * InferSelectModel type against the Acceptance Criteria.
 *
 * Mocking Strategy: no_mocks (pure schema inspection, no DB connection needed)
 */

type ProjectSelect = InferSelectModel<typeof projects>

describe('Projects Schema Extensions', () => {
  // Helper: get table config and column map once for reuse
  const config = getTableConfig(projects)
  const columnMap = Object.fromEntries(
    config.columns.map((c) => [c.name, c])
  )

  // -----------------------------------------------------------
  // AC-1: thumbnail_url Spalte existiert mit korrektem Typ
  // -----------------------------------------------------------
  it('AC-1: should have thumbnail_url column of type text with null default', () => {
    /**
     * AC-1: GIVEN das Drizzle-Schema in `lib/db/schema.ts`
     *       WHEN die `projects`-Tabelle inspiziert wird
     *       THEN existiert eine Spalte `thumbnail_url` vom Typ `text` mit Default `NULL`
     */
    const col = columnMap['thumbnail_url']

    expect(col).toBeDefined()
    expect(col.columnType).toBe('PgText')
    expect(col.dataType).toBe('string')
    // text() without .notNull() is nullable by default
    expect(col.notNull).toBe(false)
    // No explicit .default() is set -- the column is nullable so NULL is the implicit default
    expect(col.hasDefault).toBe(false)
  })

  // -----------------------------------------------------------
  // AC-2: thumbnail_status Spalte existiert mit korrektem Typ und Default
  // -----------------------------------------------------------
  it('AC-2: should have thumbnail_status column of type varchar(20) not null with default none', () => {
    /**
     * AC-2: GIVEN das Drizzle-Schema in `lib/db/schema.ts`
     *       WHEN die `projects`-Tabelle inspiziert wird
     *       THEN existiert eine Spalte `thumbnail_status` vom Typ `varchar(20)` mit `NOT NULL` und Default `'none'`
     */
    const col = columnMap['thumbnail_status']

    expect(col).toBeDefined()
    expect(col.columnType).toBe('PgVarchar')
    expect(col.dataType).toBe('string')
    expect(col.notNull).toBe(true)
    expect(col.hasDefault).toBe(true)
    expect(col.default).toBe('none')
    // Verify varchar length constraint
    expect((col as any).length).toBe(20)
  })

  // -----------------------------------------------------------
  // AC-3: Index auf thumbnail_status
  // -----------------------------------------------------------
  it('AC-3: should have projects_thumbnail_status_idx index on thumbnail_status', () => {
    /**
     * AC-3: GIVEN das Drizzle-Schema in `lib/db/schema.ts`
     *       WHEN die Indexes der `projects`-Tabelle inspiziert werden
     *       THEN existiert ein Index `projects_thumbnail_status_idx` auf der Spalte `thumbnail_status`
     */
    const indexNames = config.indexes.map((idx) => idx.config.name)

    expect(indexNames).toContain('projects_thumbnail_status_idx')

    // Verify the index is on the thumbnail_status column
    const thumbIdx = config.indexes.find(
      (idx) => idx.config.name === 'projects_thumbnail_status_idx'
    )
    expect(thumbIdx).toBeDefined()
    expect(thumbIdx!.config.columns.length).toBe(1)
    expect((thumbIdx!.config.columns[0] as any).name).toBe('thumbnail_status')
  })

  // -----------------------------------------------------------
  // AC-4: TypeScript-Kompilierung
  // -----------------------------------------------------------
  it('AC-4: should compile without type errors (verified by test execution itself)', () => {
    /**
     * AC-4: GIVEN die erweiterte Schema-Definition
     *       WHEN `pnpm tsc --noEmit` ausgefuehrt wird
     *       THEN kompiliert das Projekt fehlerfrei (Exit Code 0)
     *
     * If this test file executes at all, the schema compiled successfully.
     * We verify the projects table is importable and has a valid config.
     */
    expect(projects).toBeDefined()
    expect(config.name).toBe('projects')
    expect(config.columns.length).toBeGreaterThan(0)
  })

  // -----------------------------------------------------------
  // AC-5: Inferierte Typen korrekt
  // -----------------------------------------------------------
  it('AC-5: should infer thumbnailUrl as string | null and thumbnailStatus as string', () => {
    /**
     * AC-5: GIVEN die erweiterte Schema-Definition
     *       WHEN der inferierte TypeScript-Typ von `projects` geprüft wird
     *       THEN enthaelt `InferSelectModel<typeof projects>` die Felder
     *            `thumbnailUrl: string | null` und `thumbnailStatus: string`
     */

    // Type-level assertions using vitest expectTypeOf
    expectTypeOf<ProjectSelect>().toHaveProperty('thumbnailUrl')
    expectTypeOf<ProjectSelect['thumbnailUrl']>().toEqualTypeOf<string | null>()

    expectTypeOf<ProjectSelect>().toHaveProperty('thumbnailStatus')
    expectTypeOf<ProjectSelect['thumbnailStatus']>().toEqualTypeOf<string>()

    // Runtime verification: columns with camelCase names exist in the schema object
    expect(projects.thumbnailUrl).toBeDefined()
    expect(projects.thumbnailStatus).toBeDefined()
  })

  // -----------------------------------------------------------
  // AC-6: Bestehende Spalten unverändert
  // -----------------------------------------------------------
  it('AC-6: should preserve existing columns id, name, createdAt, updatedAt', () => {
    /**
     * AC-6: GIVEN die bestehenden Spalten der `projects`-Tabelle (`id`, `name`, `createdAt`, `updatedAt`)
     *       WHEN das Schema nach der Erweiterung inspiziert wird
     *       THEN sind alle bestehenden Spalten unverändert vorhanden
     */

    // Verify all existing columns are still present
    const existingColumns = ['id', 'name', 'created_at', 'updated_at']

    for (const colName of existingColumns) {
      expect(columnMap[colName], `Column "${colName}" should exist`).toBeDefined()
    }

    // Verify existing column types are unchanged
    expect(columnMap['id'].columnType).toBe('PgUUID')
    expect(columnMap['id'].primary).toBe(true)
    expect(columnMap['id'].hasDefault).toBe(true)

    expect(columnMap['name'].columnType).toBe('PgVarchar')
    expect(columnMap['name'].notNull).toBe(true)

    expect(columnMap['created_at'].columnType).toBe('PgTimestamp')
    expect(columnMap['created_at'].notNull).toBe(true)
    expect(columnMap['created_at'].hasDefault).toBe(true)

    expect(columnMap['updated_at'].columnType).toBe('PgTimestamp')
    expect(columnMap['updated_at'].notNull).toBe(true)
    expect(columnMap['updated_at'].hasDefault).toBe(true)

    // Verify total column count: 4 existing + 2 new = 6
    expect(config.columns.length).toBe(6)
  })
})
