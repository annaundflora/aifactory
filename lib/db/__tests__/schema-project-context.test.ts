import { describe, it, expect, expectTypeOf } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import type { InferSelectModel } from 'drizzle-orm'
import { projects } from '../schema'

/**
 * Acceptance Tests for Slice 01: Schema Migration für Project-Context
 *
 * Validates the two new columns (context_instructions, context_updated_at)
 * added to the `projects` table and the extended $inferSelect type.
 *
 * Source: specs/2026-04-19-29-interactive-prompt-refinement-project-context/
 *         slices/slice-01-schema-migration.md
 *
 * Mocking Strategy: no_mocks (pure schema inspection, no DB connection needed)
 *
 * Coverage:
 *  - AC-1: contextInstructions + contextUpdatedAt declared with correct types
 *  - AC-5: $inferSelect-Type includes contextInstructions: string | null and
 *          contextUpdatedAt: Date | null
 */

type ProjectSelect = InferSelectModel<typeof projects>

describe('Slice 01: Projects Schema -- Project-Context Columns', () => {
  // Helper: read table config and column map once for reuse across ACs
  const config = getTableConfig(projects)
  const columnMap = Object.fromEntries(
    config.columns.map((c) => [c.name, c])
  )

  // -----------------------------------------------------------
  // AC-1: contextInstructions Spalte (nullable text)
  // -----------------------------------------------------------
  it('AC-1a: projects schema declares contextInstructions as nullable text column', () => {
    /**
     * AC-1: GIVEN das aktuelle `projects`-Drizzle-Schema
     *       WHEN `lib/db/schema.ts` um zwei neue Felder ergänzt wird
     *       THEN enthält die `projects`-Definition `contextInstructions`
     *            (Drizzle `text("context_instructions")`, nullable).
     */
    const col = columnMap['context_instructions']

    expect(col, 'context_instructions column must exist').toBeDefined()
    expect(col.columnType).toBe('PgText')
    expect(col.dataType).toBe('string')
    // nullable: NOT .notNull()
    expect(col.notNull).toBe(false)
    // No default value -- NULL means "no context set" (semantically distinct from '')
    expect(col.hasDefault).toBe(false)
    // Drizzle field name uses camelCase, DB column uses snake_case
    expect(projects.contextInstructions).toBeDefined()
  })

  // -----------------------------------------------------------
  // AC-1: contextUpdatedAt Spalte (nullable timestamptz)
  // -----------------------------------------------------------
  it('AC-1b: projects schema declares contextUpdatedAt as nullable timestamptz column', () => {
    /**
     * AC-1: GIVEN das aktuelle `projects`-Drizzle-Schema
     *       WHEN `lib/db/schema.ts` um zwei neue Felder ergänzt wird
     *       THEN enthält die `projects`-Definition `contextUpdatedAt`
     *            (Drizzle `timestamp("context_updated_at", { withTimezone: true })`, nullable).
     */
    const col = columnMap['context_updated_at']

    expect(col, 'context_updated_at column must exist').toBeDefined()
    expect(col.columnType).toBe('PgTimestamp')
    // dataType for timestamp is 'date' (returns JS Date)
    expect(col.dataType).toBe('date')
    expect(col.notNull).toBe(false)
    expect(col.hasDefault).toBe(false)
    // Verify timezone-awareness via the column config
    expect((col as any).withTimezone).toBe(true)
    expect(projects.contextUpdatedAt).toBeDefined()
  })

  // -----------------------------------------------------------
  // AC-1: Bestehende Spalten unverändert (Reuse-Constraint)
  // -----------------------------------------------------------
  it('AC-1c: existing projects columns are preserved unchanged', () => {
    /**
     * AC-1 / Constraints: ALLE bestehenden Felder unverändert lassen
     * (id, name, thumbnailUrl, thumbnailStatus, userId, createdAt, updatedAt,
     * beide bestehenden Indexes).
     */
    const expected = [
      'id',
      'name',
      'thumbnail_url',
      'thumbnail_status',
      'user_id',
      'created_at',
      'updated_at',
    ]
    for (const colName of expected) {
      expect(columnMap[colName], `Existing column "${colName}" must be preserved`).toBeDefined()
    }

    // Existing indexes still present
    const indexNames = config.indexes.map((idx) => idx.config.name)
    expect(indexNames).toContain('projects_thumbnail_status_idx')
    expect(indexNames).toContain('projects_user_id_idx')
    // No new index added on the context columns (Constraints: "Index: No")
    expect(indexNames).not.toContain('projects_context_instructions_idx')
    expect(indexNames).not.toContain('projects_context_updated_at_idx')

    // Total column count: 7 existing + 2 new = 9
    expect(config.columns.length).toBe(9)
  })

  // -----------------------------------------------------------
  // AC-5: Inferierte Typen korrekt
  // -----------------------------------------------------------
  it('AC-5: $inferSelect type includes contextInstructions: string | null and contextUpdatedAt: Date | null', () => {
    /**
     * AC-5: GIVEN TypeScript-Compilation in einem Consumer-Modul,
     *            das `db.select().from(projects)` aufruft
     *       WHEN `pnpm tsc --noEmit` läuft
     *       THEN `typeof projects.$inferSelect` enthält die Felder
     *            `contextInstructions: string | null` und
     *            `contextUpdatedAt: Date | null`.
     */

    // Compile-time type assertions (vitest expectTypeOf is type-checked at build time)
    expectTypeOf<ProjectSelect>().toHaveProperty('contextInstructions')
    expectTypeOf<ProjectSelect['contextInstructions']>().toEqualTypeOf<string | null>()

    expectTypeOf<ProjectSelect>().toHaveProperty('contextUpdatedAt')
    expectTypeOf<ProjectSelect['contextUpdatedAt']>().toEqualTypeOf<Date | null>()

    // Runtime side-check: the camelCase fields are present on the schema object
    expect(projects.contextInstructions).toBeDefined()
    expect(projects.contextUpdatedAt).toBeDefined()
  })
})
