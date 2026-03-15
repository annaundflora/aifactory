import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

/**
 * Integration Tests for model_settings migration and seed data (slice-01-db-schema-migration)
 *
 * These tests validate the migration SQL file content (0007_add_model_settings.sql)
 * against the Acceptance Criteria. They inspect the SQL file directly to verify
 * table creation, seed data, and model_params values.
 *
 * Covers: AC-2 (seed count), AC-3 (mode/tier/model_id combinations),
 *         AC-6 (model_params values), AC-7 (migration compatibility)
 */

const DRIZZLE_DIR = resolve(__dirname, '..', '..', '..', 'drizzle')
const MIGRATION_FILE = resolve(DRIZZLE_DIR, '0007_add_model_settings.sql')

function readMigrationSQL(): string {
  if (!existsSync(MIGRATION_FILE)) {
    throw new Error(`Migration file not found: ${MIGRATION_FILE}`)
  }
  return readFileSync(MIGRATION_FILE, 'utf-8')
}

/**
 * Parse INSERT VALUES from the migration SQL to extract seed rows.
 * Returns array of { mode, tier, model_id, model_params } objects.
 */
function parseSeedRows(): Array<{
  mode: string
  tier: string
  model_id: string
  model_params: string
}> {
  const sql = readMigrationSQL()

  // Match the VALUES section of the INSERT statement
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

  // Match each row: ('mode', 'tier', 'model_id', '{...}')
  const rowPattern = /\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']*)'\s*\)/g
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

describe('model_settings migration and seed data', () => {
  // -----------------------------------------------------------
  // AC-2: Seed-Anzahl
  // -----------------------------------------------------------
  it('AC-2: should contain exactly 8 seed entries after migration', () => {
    /**
     * AC-2: GIVEN die Tabelle `model_settings` existiert
     *       WHEN `SELECT count(*) FROM model_settings` ausgefuehrt wird
     *       THEN ist das Ergebnis `8`
     *
     * We validate by counting INSERT rows in the migration SQL.
     */
    const rows = parseSeedRows()
    expect(rows.length).toBe(8)
  })

  // -----------------------------------------------------------
  // AC-3: Korrekte mode/tier/model_id Kombinationen
  // -----------------------------------------------------------
  it('AC-3: should contain all 8 expected mode/tier/model_id combinations', () => {
    /**
     * AC-3: GIVEN die Tabelle `model_settings` existiert mit Seed-Daten
     *       WHEN `SELECT mode, tier, model_id FROM model_settings ORDER BY mode, tier` ausgefuehrt wird
     *       THEN enthaelt das Ergebnis exakt diese 8 Kombinationen:
     *       - (img2img, draft, black-forest-labs/flux-schnell)
     *       - (img2img, max, black-forest-labs/flux-2-max)
     *       - (img2img, quality, black-forest-labs/flux-2-pro)
     *       - (txt2img, draft, black-forest-labs/flux-schnell)
     *       - (txt2img, max, black-forest-labs/flux-2-max)
     *       - (txt2img, quality, black-forest-labs/flux-2-pro)
     *       - (upscale, draft, nightmareai/real-esrgan)
     *       - (upscale, quality, philz1337x/crystal-upscaler)
     */
    const rows = parseSeedRows()

    // Sort by mode, then tier for deterministic comparison
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

  // -----------------------------------------------------------
  // AC-6: model_params Werte
  // -----------------------------------------------------------
  it('AC-6: should have correct model_params for img2img and upscale entries', () => {
    /**
     * AC-6: GIVEN die Seed-Daten fuer `img2img` Eintraege
     *       WHEN die `model_params` Spalte gelesen wird
     *       THEN enthalten alle 3 img2img-Eintraege `{ "prompt_strength": 0.6 }`,
     *            der `upscale/draft`-Eintrag enthaelt `{ "scale": 2 }`,
     *            und der `upscale/quality`-Eintrag enthaelt `{ "scale": 4 }`
     */
    const rows = parseSeedRows()

    // All 3 img2img entries must have prompt_strength: 0.6
    const img2imgRows = rows.filter((r) => r.mode === 'img2img')
    expect(img2imgRows.length).toBe(3)
    for (const row of img2imgRows) {
      const params = JSON.parse(row.model_params)
      expect(params).toEqual({ prompt_strength: 0.6 })
    }

    // upscale/draft must have scale: 2
    const upscaleDraft = rows.find(
      (r) => r.mode === 'upscale' && r.tier === 'draft'
    )
    expect(upscaleDraft).toBeDefined()
    expect(JSON.parse(upscaleDraft!.model_params)).toEqual({ scale: 2 })

    // upscale/quality must have scale: 4
    const upscaleQuality = rows.find(
      (r) => r.mode === 'upscale' && r.tier === 'quality'
    )
    expect(upscaleQuality).toBeDefined()
    expect(JSON.parse(upscaleQuality!.model_params)).toEqual({ scale: 4 })

    // txt2img entries should have empty params {}
    const txt2imgRows = rows.filter((r) => r.mode === 'txt2img')
    expect(txt2imgRows.length).toBe(3)
    for (const row of txt2imgRows) {
      const params = JSON.parse(row.model_params)
      expect(params).toEqual({})
    }
  })

  // -----------------------------------------------------------
  // AC-7: Migration-Kompatibilitaet
  // -----------------------------------------------------------
  it('AC-7: should run successfully on a database with existing migrations 0000-0006', () => {
    /**
     * AC-7: GIVEN die Migration laeuft auf einer DB die bereits alle
     *       vorherigen Migrationen (0000-0006) hat
     *       WHEN die Migration `0007_*.sql` ausgefuehrt wird
     *       THEN laeuft sie fehlerfrei durch ohne bestehende Tabellen zu veraendern
     *
     * We validate by inspecting the SQL:
     * - Only CREATE TABLE for model_settings (no ALTER on existing tables)
     * - Uses CREATE UNIQUE INDEX (not modifying existing indexes)
     * - Uses ON CONFLICT DO NOTHING for idempotent seeding
     * - Migration file is registered in drizzle journal as entry 7
     */
    const sql = readMigrationSQL()

    // Should CREATE TABLE model_settings
    expect(sql).toMatch(/CREATE TABLE\s+"model_settings"/i)

    // Should NOT alter any existing tables
    expect(sql).not.toMatch(/ALTER TABLE/i)

    // Should NOT drop anything
    expect(sql).not.toMatch(/DROP\s+(TABLE|INDEX|COLUMN)/i)

    // Should use ON CONFLICT DO NOTHING for idempotent seeding
    expect(sql).toContain('ON CONFLICT DO NOTHING')

    // Should create unique index
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX\s+"model_settings_mode_tier_idx"/i
    )

    // Verify the migration is registered in the drizzle journal
    const journalPath = resolve(DRIZZLE_DIR, 'meta', '_journal.json')
    expect(existsSync(journalPath)).toBe(true)

    const journal = JSON.parse(readFileSync(journalPath, 'utf-8'))
    const entry = journal.entries.find(
      (e: any) => e.tag === '0007_add_model_settings'
    )
    expect(entry).toBeDefined()
    expect(entry.idx).toBe(7)
  })
})
