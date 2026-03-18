import { describe, it, expect, expectTypeOf } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import type { InferSelectModel } from 'drizzle-orm'
import { models } from '../schema'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Tests for Slice 01: DB Schema & Migration for Models Table
 *
 * These tests validate the Drizzle ORM schema definition for the `models` table
 * against the Acceptance Criteria in slice-01-db-schema.md.
 *
 * AC-1 through AC-4, AC-7, AC-8: Schema-level inspection (no DB required)
 * AC-5, AC-6: Migration file content validation (file system read)
 *
 * Mocking Strategy: no_mocks (pure schema inspection + file reads)
 */

// ---------------------------------------------------------------------------
// Type inference helper
// ---------------------------------------------------------------------------
type ModelsSelect = InferSelectModel<typeof models>

// ---------------------------------------------------------------------------
// Shared config for all schema tests
// ---------------------------------------------------------------------------
const config = getTableConfig(models)
const columnMap = Object.fromEntries(
  config.columns.map((c) => [c.name, c])
)

// ---------------------------------------------------------------------------
// The 15 columns as defined in architecture.md "Schema Details: models Table"
// ---------------------------------------------------------------------------
const EXPECTED_COLUMNS = [
  'id',
  'replicate_id',
  'owner',
  'name',
  'description',
  'cover_image_url',
  'run_count',
  'collections',
  'capabilities',
  'input_schema',
  'version_hash',
  'is_active',
  'last_synced_at',
  'created_at',
  'updated_at',
] as const

describe('models table schema', () => {
  // -------------------------------------------------------------------------
  // AC-1: Schema export with 15 columns
  // -------------------------------------------------------------------------
  it('AC-1: should export models table with all 15 columns from architecture spec', () => {
    /**
     * AC-1: GIVEN die Datei `lib/db/schema.ts` existiert mit 12 bestehenden Tabellen
     *       WHEN der Implementer die `models`-Table-Definition hinzufuegt
     *       THEN enthaelt `schema.ts` einen exportierten `models`-pgTable mit exakt
     *       15 Spalten gemaess architecture.md -> Section "Schema Details: models Table"
     */

    // Verify table name
    expect(config.name).toBe('models')

    // Verify exactly 15 columns
    expect(config.columns.length).toBe(15)

    // Verify all expected columns exist
    for (const colName of EXPECTED_COLUMNS) {
      expect(columnMap[colName], `Column "${colName}" should exist`).toBeDefined()
    }

    // Verify column types match architecture spec
    // id: uuid PK with gen_random_uuid() default
    expect(columnMap['id'].columnType).toBe('PgUUID')
    expect(columnMap['id'].primary).toBe(true)
    expect(columnMap['id'].hasDefault).toBe(true)

    // replicate_id: varchar(255) NOT NULL
    expect(columnMap['replicate_id'].columnType).toBe('PgVarchar')
    expect(columnMap['replicate_id'].notNull).toBe(true)
    expect((columnMap['replicate_id'] as any).config.length).toBe(255)

    // owner: varchar(100) NOT NULL
    expect(columnMap['owner'].columnType).toBe('PgVarchar')
    expect(columnMap['owner'].notNull).toBe(true)
    expect((columnMap['owner'] as any).config.length).toBe(100)

    // name: varchar(100) NOT NULL
    expect(columnMap['name'].columnType).toBe('PgVarchar')
    expect(columnMap['name'].notNull).toBe(true)
    expect((columnMap['name'] as any).config.length).toBe(100)

    // description: text, nullable
    expect(columnMap['description'].columnType).toBe('PgText')
    expect(columnMap['description'].notNull).toBe(false)

    // cover_image_url: text, nullable
    expect(columnMap['cover_image_url'].columnType).toBe('PgText')
    expect(columnMap['cover_image_url'].notNull).toBe(false)

    // run_count: integer, nullable
    expect(columnMap['run_count'].columnType).toBe('PgInteger')
    expect(columnMap['run_count'].notNull).toBe(false)

    // collections: text[], nullable (tested in detail in AC-8)
    expect(columnMap['collections'].columnType).toBe('PgArray')

    // capabilities: jsonb, NOT NULL (tested in detail in AC-7)
    expect(columnMap['capabilities'].columnType).toBe('PgJsonb')
    expect(columnMap['capabilities'].notNull).toBe(true)

    // input_schema: jsonb, nullable
    expect(columnMap['input_schema'].columnType).toBe('PgJsonb')
    expect(columnMap['input_schema'].notNull).toBe(false)

    // version_hash: varchar(64), nullable
    expect(columnMap['version_hash'].columnType).toBe('PgVarchar')
    expect(columnMap['version_hash'].notNull).toBe(false)
    expect((columnMap['version_hash'] as any).config.length).toBe(64)

    // is_active: boolean, NOT NULL, default true
    expect(columnMap['is_active'].columnType).toBe('PgBoolean')
    expect(columnMap['is_active'].notNull).toBe(true)
    expect(columnMap['is_active'].hasDefault).toBe(true)
    expect(columnMap['is_active'].default).toBe(true)

    // last_synced_at: timestamp with timezone, nullable
    expect(columnMap['last_synced_at'].columnType).toBe('PgTimestamp')
    expect(columnMap['last_synced_at'].notNull).toBe(false)

    // created_at: timestamp with timezone, NOT NULL, default now()
    expect(columnMap['created_at'].columnType).toBe('PgTimestamp')
    expect(columnMap['created_at'].notNull).toBe(true)
    expect(columnMap['created_at'].hasDefault).toBe(true)

    // updated_at: timestamp with timezone, NOT NULL, default now()
    expect(columnMap['updated_at'].columnType).toBe('PgTimestamp')
    expect(columnMap['updated_at'].notNull).toBe(true)
    expect(columnMap['updated_at'].hasDefault).toBe(true)
  })

  // -------------------------------------------------------------------------
  // AC-2: Inferred select type with 15 fields and correct types
  // -------------------------------------------------------------------------
  it('AC-2: should infer correct TypeScript types from models.$inferSelect', () => {
    /**
     * AC-2: GIVEN die `models`-Table-Definition in `schema.ts`
     *       WHEN `typeof models.$inferSelect` evaluiert wird
     *       THEN ist der inferierte Typ ein gueltiges TypeScript-Interface mit allen
     *       15 Feldern und korrekten Typen (uuid -> string, jsonb -> unknown,
     *       varchar -> string, text -> string | null, boolean -> boolean,
     *       timestamp -> Date, text[] -> string[], integer -> number | null)
     */

    // id: uuid -> string
    expectTypeOf<ModelsSelect>().toHaveProperty('id')
    expectTypeOf<ModelsSelect['id']>().toEqualTypeOf<string>()

    // replicateId: varchar -> string
    expectTypeOf<ModelsSelect>().toHaveProperty('replicateId')
    expectTypeOf<ModelsSelect['replicateId']>().toEqualTypeOf<string>()

    // owner: varchar -> string
    expectTypeOf<ModelsSelect>().toHaveProperty('owner')
    expectTypeOf<ModelsSelect['owner']>().toEqualTypeOf<string>()

    // name: varchar -> string
    expectTypeOf<ModelsSelect>().toHaveProperty('name')
    expectTypeOf<ModelsSelect['name']>().toEqualTypeOf<string>()

    // description: text nullable -> string | null
    expectTypeOf<ModelsSelect>().toHaveProperty('description')
    expectTypeOf<ModelsSelect['description']>().toEqualTypeOf<string | null>()

    // coverImageUrl: text nullable -> string | null
    expectTypeOf<ModelsSelect>().toHaveProperty('coverImageUrl')
    expectTypeOf<ModelsSelect['coverImageUrl']>().toEqualTypeOf<string | null>()

    // runCount: integer nullable -> number | null
    expectTypeOf<ModelsSelect>().toHaveProperty('runCount')
    expectTypeOf<ModelsSelect['runCount']>().toEqualTypeOf<number | null>()

    // collections: text[] nullable -> string[] | null
    expectTypeOf<ModelsSelect>().toHaveProperty('collections')
    expectTypeOf<ModelsSelect['collections']>().toEqualTypeOf<string[] | null>()

    // capabilities: jsonb NOT NULL -> unknown
    expectTypeOf<ModelsSelect>().toHaveProperty('capabilities')
    expectTypeOf<ModelsSelect['capabilities']>().toEqualTypeOf<unknown>()

    // inputSchema: jsonb nullable -> unknown
    expectTypeOf<ModelsSelect>().toHaveProperty('inputSchema')
    expectTypeOf<ModelsSelect['inputSchema']>().toEqualTypeOf<unknown>()

    // versionHash: varchar nullable -> string | null
    expectTypeOf<ModelsSelect>().toHaveProperty('versionHash')
    expectTypeOf<ModelsSelect['versionHash']>().toEqualTypeOf<string | null>()

    // isActive: boolean -> boolean
    expectTypeOf<ModelsSelect>().toHaveProperty('isActive')
    expectTypeOf<ModelsSelect['isActive']>().toEqualTypeOf<boolean>()

    // lastSyncedAt: timestamp nullable -> Date | null
    expectTypeOf<ModelsSelect>().toHaveProperty('lastSyncedAt')
    expectTypeOf<ModelsSelect['lastSyncedAt']>().toEqualTypeOf<Date | null>()

    // createdAt: timestamp -> Date
    expectTypeOf<ModelsSelect>().toHaveProperty('createdAt')
    expectTypeOf<ModelsSelect['createdAt']>().toEqualTypeOf<Date>()

    // updatedAt: timestamp -> Date
    expectTypeOf<ModelsSelect>().toHaveProperty('updatedAt')
    expectTypeOf<ModelsSelect['updatedAt']>().toEqualTypeOf<Date>()
  })

  // -------------------------------------------------------------------------
  // AC-3: uniqueIndex on replicate_id
  // -------------------------------------------------------------------------
  it('AC-3: should define uniqueIndex on replicate_id column', () => {
    /**
     * AC-3: GIVEN die `models`-Table-Definition enthaelt `replicate_id` als varchar(255) NOT NULL
     *       WHEN die Index-Definition geprueft wird
     *       THEN existiert ein `uniqueIndex` auf `replicate_id`
     */

    const indexNames = config.indexes.map((idx) => idx.config.name)
    expect(indexNames).toContain('models_replicate_id_idx')

    const replicateIdIdx = config.indexes.find(
      (idx) => idx.config.name === 'models_replicate_id_idx'
    )
    expect(replicateIdIdx).toBeDefined()

    // Index must be unique
    expect(replicateIdIdx!.config.unique).toBe(true)

    // Index must be on exactly 1 column: replicate_id
    expect(replicateIdIdx!.config.columns.length).toBe(1)
    expect((replicateIdIdx!.config.columns[0] as any).name).toBe('replicate_id')
  })

  // -------------------------------------------------------------------------
  // AC-4: index on is_active
  // -------------------------------------------------------------------------
  it('AC-4: should define index on is_active column', () => {
    /**
     * AC-4: GIVEN die `models`-Table-Definition enthaelt `is_active` als boolean NOT NULL default true
     *       WHEN die Index-Definition geprueft wird
     *       THEN existiert ein `index` auf `is_active`
     */

    const indexNames = config.indexes.map((idx) => idx.config.name)
    expect(indexNames).toContain('models_is_active_idx')

    const isActiveIdx = config.indexes.find(
      (idx) => idx.config.name === 'models_is_active_idx'
    )
    expect(isActiveIdx).toBeDefined()

    // This is a regular index, NOT unique
    expect(isActiveIdx!.config.unique).toBe(false)

    // Index must be on exactly 1 column: is_active
    expect(isActiveIdx!.config.columns.length).toBe(1)
    expect((isActiveIdx!.config.columns[0] as any).name).toBe('is_active')
  })

  // -------------------------------------------------------------------------
  // AC-7: capabilities as jsonb NOT NULL without default
  // -------------------------------------------------------------------------
  it('AC-7: should define capabilities as jsonb NOT NULL without default', () => {
    /**
     * AC-7: GIVEN die `models`-Table-Definition
     *       WHEN die `capabilities`-Spalte geprueft wird
     *       THEN ist sie als `jsonb` NOT NULL definiert (kein Default-Wert, da der
     *       Sync-Service den Wert immer explizit setzt)
     */

    expect(columnMap['capabilities']).toBeDefined()
    expect(columnMap['capabilities'].columnType).toBe('PgJsonb')
    expect(columnMap['capabilities'].notNull).toBe(true)
    expect(columnMap['capabilities'].hasDefault).toBe(false)
  })

  // -------------------------------------------------------------------------
  // AC-8: collections as nullable text array
  // -------------------------------------------------------------------------
  it('AC-8: should define collections as nullable text array', () => {
    /**
     * AC-8: GIVEN die `models`-Table-Definition
     *       WHEN die `collections`-Spalte geprueft wird
     *       THEN ist sie als `text` Array (Postgres `text[]`) und nullable definiert
     */

    expect(columnMap['collections']).toBeDefined()
    // Drizzle wraps array columns in PgArray
    expect(columnMap['collections'].columnType).toBe('PgArray')
    expect(columnMap['collections'].notNull).toBe(false)

    // Verify the base type is text (the inner element type)
    // PgArray columns store their base column config
    const arrayCol = columnMap['collections'] as any
    expect(arrayCol.baseColumn.columnType).toBe('PgText')

    // Verify inferred type is string[] | null
    expectTypeOf<ModelsSelect['collections']>().toEqualTypeOf<string[] | null>()
  })
})

// ---------------------------------------------------------------------------
// AC-5 & AC-6: Migration file validation
// ---------------------------------------------------------------------------
describe('models migration file (AC-5, AC-6)', () => {
  const migrationPath = resolve(
    __dirname,
    '../../../drizzle/0011_add_models_table.sql'
  )

  let migrationSql: string

  // Read migration file once for all tests in this block
  try {
    migrationSql = readFileSync(migrationPath, 'utf-8')
  } catch {
    migrationSql = ''
  }

  // -------------------------------------------------------------------------
  // AC-5: Migration file exists and was generated without errors
  // -------------------------------------------------------------------------
  it('AC-5: should have generated migration file drizzle/0011_add_models_table.sql', () => {
    /**
     * AC-5: GIVEN `schema.ts` enthaelt die vollstaendige `models`-Definition
     *       WHEN `drizzle-kit generate` ausgefuehrt wird
     *       THEN wird eine Migrationsdatei `drizzle/0011_add_models_table.sql` erzeugt
     *       ohne Fehler
     */

    expect(
      migrationSql.length,
      'Migration file should exist and have content'
    ).toBeGreaterThan(0)
  })

  // -------------------------------------------------------------------------
  // AC-6: SQL content of the migration file
  // -------------------------------------------------------------------------
  it('AC-6: should contain CREATE TABLE with all 15 columns, gen_random_uuid(), UNIQUE constraint, and indexes', () => {
    /**
     * AC-6: GIVEN die generierte Migrationsdatei `drizzle/0011_add_models_table.sql`
     *       WHEN der SQL-Inhalt geprueft wird
     *       THEN enthaelt sie ein `CREATE TABLE "models"` Statement mit allen 15 Spalten,
     *       `gen_random_uuid()` als PK-Default, einem `UNIQUE`-Constraint auf
     *       `replicate_id`, und Indexes auf `replicate_id` (unique) und `is_active`
     */

    // CREATE TABLE statement
    expect(migrationSql).toContain('CREATE TABLE "models"')

    // All 15 columns present in the SQL
    expect(migrationSql).toContain('"id" uuid')
    expect(migrationSql).toContain('"replicate_id" varchar(255)')
    expect(migrationSql).toContain('"owner" varchar(100)')
    expect(migrationSql).toContain('"name" varchar(100)')
    expect(migrationSql).toContain('"description" text')
    expect(migrationSql).toContain('"cover_image_url" text')
    expect(migrationSql).toContain('"run_count" integer')
    expect(migrationSql).toContain('"collections" text[]')
    expect(migrationSql).toContain('"capabilities" jsonb NOT NULL')
    expect(migrationSql).toContain('"input_schema" jsonb')
    expect(migrationSql).toContain('"version_hash" varchar(64)')
    expect(migrationSql).toContain('"is_active" boolean')
    expect(migrationSql).toContain('"last_synced_at" timestamp with time zone')
    expect(migrationSql).toContain('"created_at" timestamp with time zone')
    expect(migrationSql).toContain('"updated_at" timestamp with time zone')

    // gen_random_uuid() as PK default
    expect(migrationSql).toContain('gen_random_uuid()')

    // PRIMARY KEY on id
    expect(migrationSql).toContain('PRIMARY KEY')

    // UNIQUE index on replicate_id
    expect(migrationSql).toContain('CREATE UNIQUE INDEX "models_replicate_id_idx"')
    expect(migrationSql).toContain('("replicate_id")')

    // Regular index on is_active
    expect(migrationSql).toContain('CREATE INDEX "models_is_active_idx"')
    expect(migrationSql).toContain('("is_active")')
  })
})
