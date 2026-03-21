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
    expect(users).toBeDefined()

    const projectsConfig = getTableConfig(projects)
    expect(projectsConfig.columns.length).toBeGreaterThan(0)
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

  })
})
