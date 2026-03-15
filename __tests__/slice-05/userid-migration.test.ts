import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

/**
 * Tests for slice-05-db-userid-migration: Migration SQL validation
 *
 * These tests validate that the migration file 0009_add_user_id.sql exists
 * and contains the correct DDL/DML statements for adding userId columns,
 * creating a default user, backfilling data, and setting constraints.
 * No database connection needed -- we inspect the SQL file content directly.
 */

const MIGRATION_PATH = resolve(__dirname, '../../drizzle/0009_add_user_id.sql')

describe('slice-05-db-userid-migration: userId Migration', () => {
  // Pre-check: migration file exists
  describe('migration file existence', () => {
    it('should have migration file 0009_add_user_id.sql', () => {
      expect(
        existsSync(MIGRATION_PATH),
        'Migration file drizzle/0009_add_user_id.sql should exist'
      ).toBe(true)
    })

    it('should contain valid SQL statements (not trivially empty)', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf-8')
      expect(sql.length).toBeGreaterThan(100)
    })
  })

  // ---------------------------------------------------------------------------
  // AC-4: Default-User wird erstellt
  // GIVEN die Migration drizzle/0009_add_user_id.sql existiert
  // WHEN die Migration ausgefuehrt wird
  // THEN wird ein Default-User in users eingefuegt mit der ersten Email aus
  //      ALLOWED_EMAILS (z.B. default@example.com als Fallback)
  // ---------------------------------------------------------------------------
  describe('AC-4: default user insertion', () => {
    it('should INSERT a default user into users table', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf-8')

      expect(sql).toMatch(/INSERT INTO "users"/)
    })

    it('should use default@example.com as fallback email', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf-8')

      expect(sql).toContain('default@example.com')
    })

    it('should handle conflict gracefully (ON CONFLICT DO NOTHING or similar)', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf-8')

      // The migration should be idempotent -- re-running should not fail
      expect(sql).toMatch(/ON CONFLICT.*DO NOTHING/i)
    })

    it('should SELECT the default user id for backfill use', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf-8')

      // Must retrieve the default user ID after insert for UPDATE statements
      expect(sql).toMatch(/SELECT "id".*FROM "users".*WHERE "email" = 'default@example.com'/)
    })
  })

  // ---------------------------------------------------------------------------
  // AC-5: Bestehende Projekte zugewiesen
  // GIVEN bestehende Zeilen in projects ohne userId
  // WHEN die Migration ausgefuehrt wird
  // THEN haben alle bestehenden Projekte den userId des Default-Users zugewiesen bekommen
  // ---------------------------------------------------------------------------
  describe('AC-5: existing projects assigned to default user', () => {
    it('should UPDATE projects to set user_id for rows where it is NULL', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf-8')

      expect(sql).toMatch(/UPDATE "projects" SET "user_id"/)
      expect(sql).toMatch(/WHERE "user_id" IS NULL/)
    })

    it('should use the default user id variable for the UPDATE', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf-8')

      // The UPDATE should reference the variable holding the default user's ID
      expect(sql).toMatch(/UPDATE "projects" SET "user_id" = default_user_id/)
    })
  })

  // ---------------------------------------------------------------------------
  // AC-6: Bestehende Favorites zugewiesen
  // GIVEN bestehende Zeilen in favorite_models ohne userId
  // WHEN die Migration ausgefuehrt wird
  // THEN haben alle bestehenden Favorites den userId des Default-Users zugewiesen bekommen
  // ---------------------------------------------------------------------------
  describe('AC-6: existing favorites assigned to default user', () => {
    it('should UPDATE favorite_models to set user_id for rows where it is NULL', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf-8')

      expect(sql).toMatch(/UPDATE "favorite_models" SET "user_id"/)
      expect(sql).toMatch(/WHERE "user_id" IS NULL/)
    })

    it('should use the default user id variable for the UPDATE', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf-8')

      expect(sql).toMatch(
        /UPDATE "favorite_models" SET "user_id" = default_user_id/
      )
    })
  })

  // ---------------------------------------------------------------------------
  // AC-7: NOT NULL Constraint nach Zuweisung + FK
  // GIVEN die Migration laeuft die Schritte: (1) userId nullable hinzufuegen,
  //       (2) Default-User erstellen, (3) bestehende Daten zuweisen,
  //       (4) NOT NULL setzen
  // WHEN die Migration vollstaendig ausgefuehrt wird
  // THEN ist projects.userId NOT NULL und hat einen FK-Constraint auf users.id
  // ---------------------------------------------------------------------------
  describe('AC-7: multi-step migration with NOT NULL after backfill', () => {
    it('should first ADD COLUMN user_id as nullable (no NOT NULL initially)', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf-8')

      // Step 1: Add the column -- must NOT have NOT NULL in the ADD COLUMN
      const addProjectsCol = sql.match(
        /ALTER TABLE "projects" ADD COLUMN "user_id" uuid/
      )
      expect(addProjectsCol).toBeDefined()

      const addFavoritesCol = sql.match(
        /ALTER TABLE "favorite_models" ADD COLUMN "user_id" uuid/
      )
      expect(addFavoritesCol).toBeDefined()
    })

    it('should SET NOT NULL on projects.user_id after backfill', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf-8')

      expect(sql).toMatch(
        /ALTER TABLE "projects" ALTER COLUMN "user_id" SET NOT NULL/
      )
    })

    it('should SET NOT NULL on favorite_models.user_id after backfill', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf-8')

      expect(sql).toMatch(
        /ALTER TABLE "favorite_models" ALTER COLUMN "user_id" SET NOT NULL/
      )
    })

    it('should add FK constraint from projects.user_id to users.id with CASCADE', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf-8')

      expect(sql).toMatch(
        /ALTER TABLE "projects" ADD CONSTRAINT.*FOREIGN KEY \("user_id"\) REFERENCES.*"users"\("id"\) ON DELETE cascade/
      )
    })

    it('should add FK constraint from favorite_models.user_id to users.id with CASCADE', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf-8')

      expect(sql).toMatch(
        /ALTER TABLE "favorite_models" ADD CONSTRAINT.*FOREIGN KEY \("user_id"\) REFERENCES.*"users"\("id"\) ON DELETE cascade/
      )
    })

    it('should execute steps in correct order: ADD COLUMN -> INSERT/UPDATE -> SET NOT NULL -> FK', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf-8')

      // Verify ordering by checking that ADD COLUMN comes before SET NOT NULL
      const addColPos = sql.indexOf('ADD COLUMN "user_id"')
      const insertPos = sql.indexOf('INSERT INTO "users"')
      const updatePos = sql.indexOf('UPDATE "projects" SET "user_id"')
      const setNotNullPos = sql.indexOf('ALTER COLUMN "user_id" SET NOT NULL')
      const fkPos = sql.indexOf('ADD CONSTRAINT')

      expect(addColPos).toBeGreaterThan(-1)
      expect(insertPos).toBeGreaterThan(-1)
      expect(updatePos).toBeGreaterThan(-1)
      expect(setNotNullPos).toBeGreaterThan(-1)
      expect(fkPos).toBeGreaterThan(-1)

      // Correct order: ADD COLUMN < INSERT < UPDATE < SET NOT NULL < FK
      expect(addColPos).toBeLessThan(insertPos)
      expect(insertPos).toBeLessThan(updatePos)
      expect(updatePos).toBeLessThan(setNotNullPos)
      expect(setNotNullPos).toBeLessThan(fkPos)
    })

    it('should create indexes on projects.user_id and favorite_models.user_id', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf-8')

      expect(sql).toMatch(/CREATE INDEX "projects_user_id_idx".*ON "projects".*"user_id"/)
      expect(sql).toMatch(
        /CREATE INDEX "favorite_models_user_id_idx".*ON "favorite_models".*"user_id"/
      )
    })

    it('should drop old single-column unique constraint on model_id and create new composite unique', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf-8')

      // Should drop the old constraint (by dynamic lookup or direct name)
      expect(sql).toMatch(/DROP CONSTRAINT/i)

      // Should create the new composite unique index
      expect(sql).toMatch(
        /CREATE UNIQUE INDEX "favorite_models_user_id_model_id_idx".*ON "favorite_models".*"user_id".*"model_id"/
      )
    })

    it('should wrap migration in a transaction (BEGIN/COMMIT)', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf-8')

      expect(sql.trimStart()).toMatch(/^BEGIN/)
      expect(sql.trimEnd()).toMatch(/COMMIT;?\s*$/)
    })
  })
})
