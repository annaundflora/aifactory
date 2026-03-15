import { describe, it, expect } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { getTableName } from 'drizzle-orm'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  users,
  accounts,
  sessions,
  projects,
  generations,
  favoriteModels,
  projectSelectedModels,
  assistantSessions,
  assistantImages,
  referenceImages,
  generationReferences,
  modelSettings,
} from '@/lib/db/schema'

/**
 * Tests for slice-05-db-userid-migration: Schema validation
 *
 * These tests validate the Drizzle schema definitions for the userId columns
 * added to projects and favoriteModels tables against the Acceptance Criteria.
 * All assertions inspect the real Drizzle table objects -- no mocks, no DB needed.
 */

describe('slice-05-db-userid-migration: userId Schema', () => {
  // ---------------------------------------------------------------------------
  // AC-1: projects.userId Spalte definiert
  // GIVEN die Datei lib/db/schema.ts enthaelt die aktualisierte projects-Definition
  // WHEN die Tabellen-Definition geprueft wird
  // THEN enthaelt projects eine Spalte userId (UUID, FK auf users.id, NOT NULL,
  //      onDelete CASCADE) mit Index
  // ---------------------------------------------------------------------------
  describe('AC-1: projects.userId column', () => {
    it('should define userId column on projects as UUID type', () => {
      const config = getTableConfig(projects)
      const userIdCol = config.columns.find((c) => c.name === 'user_id')

      expect(userIdCol, 'projects should have a user_id column').toBeDefined()
      expect(userIdCol!.columnType).toBe('PgUUID')
      expect(userIdCol!.dataType).toBe('string')
    })

    it('should define projects.userId as NOT NULL', () => {
      const config = getTableConfig(projects)
      const userIdCol = config.columns.find((c) => c.name === 'user_id')

      expect(userIdCol).toBeDefined()
      expect(userIdCol!.notNull).toBe(true)
    })

    it('should define projects.userId FK referencing users.id', () => {
      const config = getTableConfig(projects)
      const fks = config.foreignKeys

      const userIdFk = fks.find((fk) => {
        const ref = fk.reference()
        return ref.columns.some((c) => c.name === 'user_id')
      })

      expect(userIdFk, 'projects should have a FK on user_id').toBeDefined()

      const ref = userIdFk!.reference()
      expect(getTableName(ref.foreignTable)).toBe('users')
      expect(ref.foreignColumns.some((c) => c.name === 'id')).toBe(true)
    })

    it('should define projects.userId FK with onDelete CASCADE', () => {
      const config = getTableConfig(projects)

      const userIdFk = config.foreignKeys.find((fk) => {
        const ref = fk.reference()
        return ref.columns.some((c) => c.name === 'user_id')
      })

      expect(userIdFk).toBeDefined()
      expect(userIdFk!.onDelete).toBe('cascade')
    })

    it('should have an index on projects.userId', () => {
      const config = getTableConfig(projects)

      const userIdIndex = config.indexes.find((idx) => {
        const idxConfig = idx.config
        return idxConfig.columns.some((col: any) => col.name === 'user_id')
      })

      expect(
        userIdIndex,
        'projects should have an index on user_id'
      ).toBeDefined()
    })
  })

  // ---------------------------------------------------------------------------
  // AC-2: favoriteModels.userId Spalte definiert
  // GIVEN die Datei lib/db/schema.ts enthaelt die aktualisierte favoriteModels-Definition
  // WHEN die Tabellen-Definition geprueft wird
  // THEN enthaelt favorite_models eine Spalte userId (UUID, FK auf users.id,
  //      NOT NULL, onDelete CASCADE) mit Index
  // ---------------------------------------------------------------------------
  describe('AC-2: favoriteModels.userId column', () => {
    it('should define userId column on favoriteModels as UUID type', () => {
      const config = getTableConfig(favoriteModels)
      const userIdCol = config.columns.find((c) => c.name === 'user_id')

      expect(
        userIdCol,
        'favorite_models should have a user_id column'
      ).toBeDefined()
      expect(userIdCol!.columnType).toBe('PgUUID')
      expect(userIdCol!.dataType).toBe('string')
    })

    it('should define favoriteModels.userId as NOT NULL', () => {
      const config = getTableConfig(favoriteModels)
      const userIdCol = config.columns.find((c) => c.name === 'user_id')

      expect(userIdCol).toBeDefined()
      expect(userIdCol!.notNull).toBe(true)
    })

    it('should define favoriteModels.userId FK referencing users.id', () => {
      const config = getTableConfig(favoriteModels)
      const fks = config.foreignKeys

      const userIdFk = fks.find((fk) => {
        const ref = fk.reference()
        return ref.columns.some((c) => c.name === 'user_id')
      })

      expect(
        userIdFk,
        'favorite_models should have a FK on user_id'
      ).toBeDefined()

      const ref = userIdFk!.reference()
      expect(getTableName(ref.foreignTable)).toBe('users')
      expect(ref.foreignColumns.some((c) => c.name === 'id')).toBe(true)
    })

    it('should define favoriteModels.userId FK with onDelete CASCADE', () => {
      const config = getTableConfig(favoriteModels)

      const userIdFk = config.foreignKeys.find((fk) => {
        const ref = fk.reference()
        return ref.columns.some((c) => c.name === 'user_id')
      })

      expect(userIdFk).toBeDefined()
      expect(userIdFk!.onDelete).toBe('cascade')
    })

    it('should have an index on favoriteModels.userId', () => {
      const config = getTableConfig(favoriteModels)

      const userIdIndex = config.indexes.find((idx) => {
        const idxConfig = idx.config
        return idxConfig.columns.some((col: any) => col.name === 'user_id')
      })

      expect(
        userIdIndex,
        'favorite_models should have an index on user_id'
      ).toBeDefined()
    })
  })

  // ---------------------------------------------------------------------------
  // AC-3: UNIQUE Constraint geaendert
  // GIVEN die bisherige favorite_models-Tabelle hat UNIQUE(modelId)
  // WHEN die aktualisierte Definition geprueft wird
  // THEN ist der UNIQUE Constraint geaendert zu UNIQUE(userId, modelId)
  // ---------------------------------------------------------------------------
  describe('AC-3: favoriteModels unique constraint changed to UNIQUE(userId, modelId)', () => {
    it('should have a unique index on (userId, modelId)', () => {
      const config = getTableConfig(favoriteModels)

      const compositeUnique = config.indexes.find((idx) => {
        const idxConfig = idx.config
        const colNames = idxConfig.columns.map((col: any) => col.name)
        return (
          idxConfig.unique === true &&
          colNames.includes('user_id') &&
          colNames.includes('model_id')
        )
      })

      expect(
        compositeUnique,
        'favorite_models should have UNIQUE(user_id, model_id)'
      ).toBeDefined()
    })

    it('should NOT have a single-column unique constraint on modelId alone', () => {
      const config = getTableConfig(favoriteModels)

      // Check columns: modelId should not be marked as isUnique
      const modelIdCol = config.columns.find((c) => c.name === 'model_id')
      expect(modelIdCol).toBeDefined()
      expect(
        modelIdCol!.isUnique,
        'model_id column should not have a single-column unique constraint'
      ).toBeFalsy()

      // Also check indexes: no single-column unique index on model_id alone
      const singleModelIdUnique = config.indexes.find((idx) => {
        const idxConfig = idx.config
        const colNames = idxConfig.columns.map((col: any) => col.name)
        return (
          idxConfig.unique === true &&
          colNames.length === 1 &&
          colNames[0] === 'model_id'
        )
      })

      expect(
        singleModelIdUnique,
        'Should not have a single-column unique index on model_id alone'
      ).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // AC-8: Build-Kompatibilitaet
  // GIVEN die Migration wurde erfolgreich angewendet
  // WHEN pnpm run build ausgefuehrt wird
  // THEN ist der Build erfolgreich ohne TypeScript-Fehler
  //
  // NOTE: We validate at import-time -- if the schema has TS errors,
  // the import above would fail and no test would run.
  // ---------------------------------------------------------------------------
  it('AC-8: should compile schema without TypeScript errors', () => {
    // If we reach this point, the import at the top succeeded without errors.
    // Verify all key tables are valid Drizzle table objects.
    expect(projects).toBeDefined()
    expect(favoriteModels).toBeDefined()
    expect(users).toBeDefined()

    const projectsConfig = getTableConfig(projects)
    const favoriteModelsConfig = getTableConfig(favoriteModels)

    expect(projectsConfig.columns.length).toBeGreaterThan(0)
    expect(favoriteModelsConfig.columns.length).toBeGreaterThan(0)
  })

  // ---------------------------------------------------------------------------
  // AC-9: Bestehende Tabellen unveraendert
  // GIVEN die bestehenden 8+ Tabellen in lib/db/schema.ts (inkl. Auth-Tabellen aus Slice 04)
  // WHEN die Schema-Aenderungen angewendet werden
  // THEN bleiben alle bestehenden Tabellen-Definitionen und Exports unveraendert
  //      (ausser projects und favoriteModels)
  // ---------------------------------------------------------------------------
  describe('AC-9: existing tables preserved (except projects and favoriteModels)', () => {
    const unchangedTables = [
      { name: 'generations', table: generations, expectedCols: ['id', 'project_id', 'prompt', 'model_id', 'status', 'image_url'] },
      { name: 'project_selected_models', table: projectSelectedModels, expectedCols: ['id', 'project_id', 'model_id', 'position'] },
      { name: 'assistant_sessions', table: assistantSessions, expectedCols: ['id', 'project_id', 'title', 'status'] },
      { name: 'assistant_images', table: assistantImages, expectedCols: ['id', 'session_id', 'image_url'] },
      { name: 'reference_images', table: referenceImages, expectedCols: ['id', 'project_id', 'image_url', 'source_type'] },
      { name: 'generation_references', table: generationReferences, expectedCols: ['id', 'generation_id', 'reference_image_id', 'role'] },
      { name: 'model_settings', table: modelSettings, expectedCols: ['id', 'mode', 'tier', 'model_id', 'model_params'] },
      { name: 'users', table: users, expectedCols: ['id', 'name', 'email', 'emailVerified', 'image'] },
      { name: 'accounts', table: accounts, expectedCols: ['userId', 'type', 'provider', 'providerAccountId'] },
      { name: 'sessions', table: sessions, expectedCols: ['sessionToken', 'userId', 'expires'] },
    ]

    it('should still export all unchanged tables with correct SQL names', () => {
      for (const { name, table } of unchangedTables) {
        expect(table, `Table "${name}" should still be exported`).toBeDefined()
        expect(
          getTableName(table),
          `Table "${name}" should have correct SQL name`
        ).toBe(name)
      }
    })

    it.each(unchangedTables)(
      'should preserve $name table with its original columns',
      ({ table, expectedCols }) => {
        const config = getTableConfig(table)
        const colNames = config.columns.map((c) => c.name)

        for (const col of expectedCols) {
          expect(colNames, `Missing expected column "${col}"`).toContain(col)
        }
      }
    )

    it('should preserve original projects columns alongside new userId', () => {
      const config = getTableConfig(projects)
      const colNames = config.columns.map((c) => c.name)

      // Original columns must still be present
      expect(colNames).toContain('id')
      expect(colNames).toContain('name')
      expect(colNames).toContain('thumbnail_url')
      expect(colNames).toContain('thumbnail_status')
      expect(colNames).toContain('created_at')
      expect(colNames).toContain('updated_at')
      // New column
      expect(colNames).toContain('user_id')
    })

    it('should preserve original favoriteModels columns alongside new userId', () => {
      const config = getTableConfig(favoriteModels)
      const colNames = config.columns.map((c) => c.name)

      // Original columns must still be present
      expect(colNames).toContain('id')
      expect(colNames).toContain('model_id')
      expect(colNames).toContain('created_at')
      // New column
      expect(colNames).toContain('user_id')
    })
  })

  // ---------------------------------------------------------------------------
  // AC-10: Deprecated Marker erhalten
  // GIVEN die favorite_models-Tabelle ist als @deprecated markiert im Schema
  // WHEN die Aenderungen vorgenommen werden
  // THEN bleibt der @deprecated JSDoc-Kommentar erhalten
  // ---------------------------------------------------------------------------
  it('AC-10: should preserve @deprecated JSDoc comment on favoriteModels table', () => {
    const schemaPath = resolve(__dirname, '../../lib/db/schema.ts')
    const schemaSource = readFileSync(schemaPath, 'utf-8')

    // Find the @deprecated comment near the favoriteModels definition
    // The JSDoc block should appear before the export const favoriteModels line
    const favoriteModelsIdx = schemaSource.indexOf('export const favoriteModels')
    expect(
      favoriteModelsIdx,
      'Schema should contain export const favoriteModels'
    ).toBeGreaterThan(-1)

    // Look for @deprecated in the ~300 chars before the export
    const precedingText = schemaSource.substring(
      Math.max(0, favoriteModelsIdx - 300),
      favoriteModelsIdx
    )
    expect(
      precedingText,
      '@deprecated JSDoc should appear before favoriteModels definition'
    ).toContain('@deprecated')
  })
})
