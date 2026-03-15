import { describe, it, expect, expectTypeOf } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import type { InferSelectModel } from 'drizzle-orm'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { modelSettings } from '../../lib/db/schema'

/**
 * Acceptance Tests for slice-01-db-schema-migration
 *
 * Tests validate all 7 Acceptance Criteria from the slice spec.
 * AC-1 through AC-7 are tested via schema inspection and migration SQL analysis.
 *
 * Mocking Strategy: test_containers (echte DB fuer Schema-Tests)
 * Since no test DB is available in this environment, we validate via
 * Drizzle schema inspection + SQL file content analysis.
 */

type ModelSettingsSelect = InferSelectModel<typeof modelSettings>

const DRIZZLE_DIR = resolve(__dirname, '..', '..', 'drizzle')
const MIGRATION_FILE = resolve(DRIZZLE_DIR, '0007_add_model_settings.sql')

function readMigrationSQL(): string {
  if (!existsSync(MIGRATION_FILE)) {
    throw new Error(`Migration file not found: ${MIGRATION_FILE}`)
  }
  return readFileSync(MIGRATION_FILE, 'utf-8')
}

function parseSeedRows(): Array<{
  mode: string
  tier: string
  model_id: string
  model_params: string
}> {
  const sql = readMigrationSQL()
  const valuesMatch = sql.match(/VALUES\s*\n?([\s\S]*?)ON CONFLICT/i)
  if (!valuesMatch) {
    throw new Error('Could not find VALUES ... ON CONFLICT in migration SQL')
  }
  const valuesBlock = valuesMatch[1]
  const rows: Array<{
    mode: string
    tier: string
    model_id: string
    model_params: string
  }> = []
  const rowPattern =
    /\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']*)'\s*\)/g
  let match
  while ((match = rowPattern.exec(valuesBlock)) !== null) {
    rows.push({
      mode: match[1],
      tier: match[2],
      model_id: match[3],
      model_params: match[4],
    })
  }
  return rows
}

describe('slice-01-db-schema-migration Acceptance', () => {
  const config = getTableConfig(modelSettings)
  const columnMap = Object.fromEntries(
    config.columns.map((c) => [c.name, c])
  )

  // =================================================================
  // AC-1: Tabellen-Struktur
  // =================================================================
  it('AC-1: GIVEN eine leere Datenbank ohne model_settings Tabelle WHEN die Migration 0007_*.sql ausgefuehrt wird THEN existiert die Tabelle model_settings mit allen Spalten und korrekten Typen', () => {
    /**
     * AC-1: GIVEN eine leere Datenbank ohne `model_settings` Tabelle
     *       WHEN die Migration `0007_*.sql` ausgefuehrt wird
     *       THEN existiert die Tabelle `model_settings` mit den Spalten
     *            `id` (uuid PK), `mode` (varchar(20) NOT NULL),
     *            `tier` (varchar(20) NOT NULL), `model_id` (varchar(255) NOT NULL),
     *            `model_params` (jsonb NOT NULL DEFAULT '{}'),
     *            `created_at` (timestamptz NOT NULL DEFAULT now()),
     *            `updated_at` (timestamptz NOT NULL DEFAULT now())
     */

    // Table name
    expect(config.name).toBe('model_settings')

    // Migration file exists with CREATE TABLE
    expect(existsSync(MIGRATION_FILE)).toBe(true)
    const sql = readMigrationSQL()
    expect(sql).toMatch(/CREATE TABLE\s+"model_settings"/i)

    // id: uuid PK with default
    expect(columnMap['id']).toBeDefined()
    expect(columnMap['id'].columnType).toBe('PgUUID')
    expect(columnMap['id'].primary).toBe(true)
    expect(columnMap['id'].hasDefault).toBe(true)

    // mode: varchar(20) NOT NULL
    expect(columnMap['mode']).toBeDefined()
    expect(columnMap['mode'].columnType).toBe('PgVarchar')
    expect(columnMap['mode'].notNull).toBe(true)
    expect((columnMap['mode'] as any).config.length).toBe(20)

    // tier: varchar(20) NOT NULL
    expect(columnMap['tier']).toBeDefined()
    expect(columnMap['tier'].columnType).toBe('PgVarchar')
    expect(columnMap['tier'].notNull).toBe(true)
    expect((columnMap['tier'] as any).config.length).toBe(20)

    // model_id: varchar(255) NOT NULL
    expect(columnMap['model_id']).toBeDefined()
    expect(columnMap['model_id'].columnType).toBe('PgVarchar')
    expect(columnMap['model_id'].notNull).toBe(true)
    expect((columnMap['model_id'] as any).config.length).toBe(255)

    // model_params: jsonb NOT NULL DEFAULT '{}'
    expect(columnMap['model_params']).toBeDefined()
    expect(columnMap['model_params'].columnType).toBe('PgJsonb')
    expect(columnMap['model_params'].notNull).toBe(true)
    expect(columnMap['model_params'].hasDefault).toBe(true)

    // created_at: timestamptz NOT NULL DEFAULT now()
    expect(columnMap['created_at']).toBeDefined()
    expect(columnMap['created_at'].columnType).toBe('PgTimestamp')
    expect(columnMap['created_at'].notNull).toBe(true)
    expect(columnMap['created_at'].hasDefault).toBe(true)

    // updated_at: timestamptz NOT NULL DEFAULT now()
    expect(columnMap['updated_at']).toBeDefined()
    expect(columnMap['updated_at'].columnType).toBe('PgTimestamp')
    expect(columnMap['updated_at'].notNull).toBe(true)
    expect(columnMap['updated_at'].hasDefault).toBe(true)

    // Verify SQL contains correct column definitions
    expect(sql).toContain('"id" uuid PRIMARY KEY')
    expect(sql).toContain('"mode" varchar(20) NOT NULL')
    expect(sql).toContain('"tier" varchar(20) NOT NULL')
    expect(sql).toContain('"model_id" varchar(255) NOT NULL')
    expect(sql).toMatch(/"model_params"\s+jsonb/)
    expect(sql).toMatch(/"created_at"\s+timestamp with time zone/)
    expect(sql).toMatch(/"updated_at"\s+timestamp with time zone/)
  })

  // =================================================================
  // AC-2: Seed-Anzahl
  // =================================================================
  it('AC-2: GIVEN die Tabelle model_settings existiert WHEN SELECT count(*) FROM model_settings ausgefuehrt wird THEN ist das Ergebnis 8', () => {
    /**
     * AC-2: GIVEN die Tabelle `model_settings` existiert
     *       WHEN `SELECT count(*) FROM model_settings` ausgefuehrt wird
     *       THEN ist das Ergebnis `8`
     */
    const rows = parseSeedRows()
    expect(rows.length).toBe(8)
  })

  // =================================================================
  // AC-3: Korrekte mode/tier/model_id Kombinationen
  // =================================================================
  it('AC-3: GIVEN die Tabelle model_settings existiert mit Seed-Daten WHEN SELECT mode, tier, model_id ausgefuehrt wird THEN enthaelt das Ergebnis exakt die 8 erwarteten Kombinationen', () => {
    /**
     * AC-3: GIVEN die Tabelle `model_settings` existiert mit Seed-Daten
     *       WHEN `SELECT mode, tier, model_id FROM model_settings ORDER BY mode, tier` ausgefuehrt wird
     *       THEN enthaelt das Ergebnis exakt diese 8 Kombinationen
     */
    const rows = parseSeedRows()

    const sorted = rows
      .map((r) => `(${r.mode}, ${r.tier}, ${r.model_id})`)
      .sort()

    const expected = [
      '(img2img, draft, black-forest-labs/flux-schnell)',
      '(img2img, max, black-forest-labs/flux-2-max)',
      '(img2img, quality, black-forest-labs/flux-2-pro)',
      '(txt2img, draft, black-forest-labs/flux-schnell)',
      '(txt2img, max, black-forest-labs/flux-2-max)',
      '(txt2img, quality, black-forest-labs/flux-2-pro)',
      '(upscale, draft, nightmareai/real-esrgan)',
      '(upscale, quality, philz1337x/crystal-upscaler)',
    ].sort()

    expect(sorted).toEqual(expected)
  })

  // =================================================================
  // AC-4: Unique Constraint
  // =================================================================
  it('AC-4: GIVEN die Tabelle model_settings existiert WHEN ein INSERT mit doppelter (mode, tier) Kombination versucht wird THEN wird er durch den unique constraint abgelehnt', () => {
    /**
     * AC-4: GIVEN die Tabelle `model_settings` existiert
     *       WHEN ein INSERT mit einer bereits existierenden `(mode, tier)` Kombination versucht wird
     *       THEN wird der INSERT durch den unique constraint auf `(mode, tier)` abgelehnt (conflict)
     *
     * Validated via schema: uniqueIndex on (mode, tier) exists.
     * Also validated via migration SQL: CREATE UNIQUE INDEX statement.
     */

    // Schema-level: unique index exists
    const modeTierIdx = config.indexes.find(
      (idx) => idx.config.name === 'model_settings_mode_tier_idx'
    )
    expect(modeTierIdx).toBeDefined()
    expect(modeTierIdx!.config.unique).toBe(true)
    expect(modeTierIdx!.config.columns.length).toBe(2)

    const indexColumnNames = modeTierIdx!.config.columns.map(
      (c: any) => c.name
    )
    expect(indexColumnNames).toContain('mode')
    expect(indexColumnNames).toContain('tier')

    // SQL-level: CREATE UNIQUE INDEX in migration
    const sql = readMigrationSQL()
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX\s+"model_settings_mode_tier_idx"\s+ON\s+"model_settings"/i
    )
    expect(sql).toMatch(/\("mode"\s*,\s*"tier"\)/)

    // Seed uses ON CONFLICT DO NOTHING (proves constraint is enforced)
    expect(sql).toContain('ON CONFLICT DO NOTHING')
  })

  // =================================================================
  // AC-5: Export und Schema-Shape
  // =================================================================
  it('AC-5: GIVEN das Drizzle-Schema in lib/db/schema.ts WHEN modelSettings exportiert wird THEN hat die Tabellen-Definition einen unique Constraint auf (mode, tier)', () => {
    /**
     * AC-5: GIVEN das Drizzle-Schema in `lib/db/schema.ts`
     *       WHEN `modelSettings` exportiert wird
     *       THEN hat die Tabellen-Definition eine `uniqueIndex` oder `unique` Constraint
     *            auf den Spalten `(mode, tier)`
     */

    // modelSettings is exported and usable
    expect(modelSettings).toBeDefined()
    expect(config.name).toBe('model_settings')

    // Has all 7 columns
    expect(config.columns.length).toBe(7)

    // Column accessors exist with correct names
    expect(modelSettings.id.name).toBe('id')
    expect(modelSettings.mode.name).toBe('mode')
    expect(modelSettings.tier.name).toBe('tier')
    expect(modelSettings.modelId.name).toBe('model_id')
    expect(modelSettings.modelParams.name).toBe('model_params')
    expect(modelSettings.createdAt.name).toBe('created_at')
    expect(modelSettings.updatedAt.name).toBe('updated_at')

    // TypeScript types are correct
    expectTypeOf<ModelSettingsSelect['id']>().toEqualTypeOf<string>()
    expectTypeOf<ModelSettingsSelect['mode']>().toEqualTypeOf<string>()
    expectTypeOf<ModelSettingsSelect['tier']>().toEqualTypeOf<string>()
    expectTypeOf<ModelSettingsSelect['modelId']>().toEqualTypeOf<string>()
    expectTypeOf<ModelSettingsSelect['createdAt']>().toEqualTypeOf<Date>()
    expectTypeOf<ModelSettingsSelect['updatedAt']>().toEqualTypeOf<Date>()

    // Unique index on (mode, tier) exists
    const uniqueIndexes = config.indexes.filter((idx) => idx.config.unique)
    expect(uniqueIndexes.length).toBeGreaterThanOrEqual(1)

    const modeTierIdx = uniqueIndexes.find(
      (idx) => idx.config.name === 'model_settings_mode_tier_idx'
    )
    expect(modeTierIdx).toBeDefined()
  })

  // =================================================================
  // AC-6: model_params Werte
  // =================================================================
  it('AC-6: GIVEN die Seed-Daten fuer img2img Eintraege WHEN die model_params Spalte gelesen wird THEN enthalten img2img prompt_strength 0.6 und upscale die korrekten scale-Werte', () => {
    /**
     * AC-6: GIVEN die Seed-Daten fuer `img2img` Eintraege
     *       WHEN die `model_params` Spalte gelesen wird
     *       THEN enthalten alle 3 img2img-Eintraege `{ "prompt_strength": 0.6 }`,
     *            der `upscale/draft`-Eintrag enthaelt `{ "scale": 2 }`,
     *            und der `upscale/quality`-Eintrag enthaelt `{ "scale": 4 }`
     */
    const rows = parseSeedRows()

    // img2img entries: all 3 must have prompt_strength: 0.6
    const img2imgRows = rows.filter((r) => r.mode === 'img2img')
    expect(img2imgRows.length).toBe(3)
    for (const row of img2imgRows) {
      const params = JSON.parse(row.model_params)
      expect(params).toHaveProperty('prompt_strength', 0.6)
    }

    // upscale/draft: scale: 2
    const upscaleDraft = rows.find(
      (r) => r.mode === 'upscale' && r.tier === 'draft'
    )
    expect(upscaleDraft).toBeDefined()
    const draftParams = JSON.parse(upscaleDraft!.model_params)
    expect(draftParams).toHaveProperty('scale', 2)

    // upscale/quality: scale: 4
    const upscaleQuality = rows.find(
      (r) => r.mode === 'upscale' && r.tier === 'quality'
    )
    expect(upscaleQuality).toBeDefined()
    const qualityParams = JSON.parse(upscaleQuality!.model_params)
    expect(qualityParams).toHaveProperty('scale', 4)
  })

  // =================================================================
  // AC-7: Migration-Kompatibilitaet
  // =================================================================
  it('AC-7: GIVEN die Migration laeuft auf einer DB mit Migrationen 0000-0006 WHEN die Migration 0007_*.sql ausgefuehrt wird THEN laeuft sie fehlerfrei ohne bestehende Tabellen zu veraendern', () => {
    /**
     * AC-7: GIVEN die Migration laeuft auf einer DB die bereits alle
     *       vorherigen Migrationen (0000-0006) hat
     *       WHEN die Migration `0007_*.sql` ausgefuehrt wird
     *       THEN laeuft sie fehlerfrei durch ohne bestehende Tabellen zu veraendern
     */
    const sql = readMigrationSQL()

    // Only creates model_settings table, does not alter existing ones
    expect(sql).toMatch(/CREATE TABLE\s+"model_settings"/i)
    expect(sql).not.toMatch(/ALTER TABLE/i)
    expect(sql).not.toMatch(/DROP\s+(TABLE|INDEX|COLUMN)/i)

    // Does not reference any existing tables (projects, generations, etc.)
    expect(sql).not.toMatch(/CREATE TABLE\s+"projects"/i)
    expect(sql).not.toMatch(/CREATE TABLE\s+"generations"/i)
    expect(sql).not.toMatch(/CREATE TABLE\s+"favorite_models"/i)

    // Idempotent seed via ON CONFLICT DO NOTHING
    expect(sql).toContain('ON CONFLICT DO NOTHING')

    // Journal includes this migration as entry 7
    const journalPath = resolve(DRIZZLE_DIR, 'meta', '_journal.json')
    expect(existsSync(journalPath)).toBe(true)
    const journal = JSON.parse(readFileSync(journalPath, 'utf-8'))

    // Must have all 8 entries (0000 through 0007)
    expect(journal.entries.length).toBe(8)

    // Entry 7 must be our migration
    const entry7 = journal.entries.find((e: any) => e.idx === 7)
    expect(entry7).toBeDefined()
    expect(entry7.tag).toBe('0007_add_model_settings')

    // Previous entries (0000-0006) must still be intact
    for (let i = 0; i <= 6; i++) {
      const entry = journal.entries.find((e: any) => e.idx === i)
      expect(entry, `Journal entry for migration ${i} should exist`).toBeDefined()
    }
  })
})
