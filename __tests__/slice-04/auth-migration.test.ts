import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

/**
 * Tests for slice-04-db-auth-tables: Migration file validation
 *
 * These tests validate that the migration file 0008_auth_tables.sql exists
 * and contains the correct DDL statements for the auth tables.
 * No database connection needed -- we inspect the SQL file content directly.
 */

const MIGRATION_PATH = resolve(__dirname, '../../drizzle/0008_auth_tables.sql')

describe('slice-04-db-auth-tables: Auth Migration', () => {
  // ---------------------------------------------------------------------------
  // AC-7: Migration generiert
  // GIVEN npx drizzle-kit generate wird ausgefuehrt
  // WHEN das bestehende Schema mit den neuen Tabellen verglichen wird
  // THEN wird eine Migrations-Datei drizzle/0008_auth_tables.sql generiert ohne Fehler
  // ---------------------------------------------------------------------------
  describe('AC-7: migration file generated', () => {
    it('should have migration file 0008_auth_tables.sql', () => {
      expect(
        existsSync(MIGRATION_PATH),
        'Migration file drizzle/0008_auth_tables.sql should exist'
      ).toBe(true)
    })

    it('should contain valid SQL statements', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf-8')

      // Must have CREATE TABLE statements
      expect(sql).toContain('CREATE TABLE')

      // Must not be empty or trivially short
      expect(sql.length).toBeGreaterThan(100)
    })
  })

  // ---------------------------------------------------------------------------
  // AC-8: Migration erstellt Tabellen
  // GIVEN die Migration drizzle/0008_auth_tables.sql existiert
  // WHEN npx drizzle-kit push ausgefuehrt wird
  // THEN werden die Tabellen users, accounts, sessions in der Datenbank erstellt
  //
  // NOTE: We validate this by inspecting the SQL DDL content rather than
  // running against a live DB, as specified in the task instructions.
  // ---------------------------------------------------------------------------
  describe('AC-8: migration creates auth tables', () => {
    let sql: string

    it('should contain CREATE TABLE for "users"', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8')

      expect(sql).toContain('CREATE TABLE "users"')
    })

    it('should contain CREATE TABLE for "accounts"', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8')

      expect(sql).toContain('CREATE TABLE "accounts"')
    })

    it('should contain CREATE TABLE for "sessions"', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8')

      expect(sql).toContain('CREATE TABLE "sessions"')
    })

    it('should define users.id as UUID PK with gen_random_uuid()', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8')

      // Extract the users CREATE TABLE block
      expect(sql).toMatch(/"id" uuid PRIMARY KEY DEFAULT gen_random_uuid\(\) NOT NULL/)
    })

    it('should define users.email as UNIQUE NOT NULL', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8')

      expect(sql).toContain('"email" text NOT NULL')
      expect(sql).toMatch(/UNIQUE\("email"\)/)
    })

    it('should define accounts composite PK on (provider, providerAccountId)', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8')

      expect(sql).toMatch(
        /PRIMARY KEY\("provider","providerAccountId"\)/
      )
    })

    it('should define sessions.sessionToken as TEXT PK', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8')

      expect(sql).toContain('"sessionToken" text PRIMARY KEY NOT NULL')
    })

    it('should define FK from accounts.userId to users.id with CASCADE DELETE', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8')

      expect(sql).toMatch(
        /ALTER TABLE "accounts" ADD CONSTRAINT.*FOREIGN KEY \("userId"\) REFERENCES.*"users"\("id"\) ON DELETE cascade/
      )
    })

    it('should define FK from sessions.userId to users.id with CASCADE DELETE', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8')

      expect(sql).toMatch(
        /ALTER TABLE "sessions" ADD CONSTRAINT.*FOREIGN KEY \("userId"\) REFERENCES.*"users"\("id"\) ON DELETE cascade/
      )
    })

    it('should create index on accounts.userId', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8')

      expect(sql).toMatch(/CREATE INDEX "accounts_userId_idx"/)
    })

    it('should create index on sessions.userId', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8')

      expect(sql).toMatch(/CREATE INDEX "sessions_userId_idx"/)
    })
  })

  // ---------------------------------------------------------------------------
  // AC-9: Auth.js Login-Flow speichert Daten
  // GIVEN die Auth.js Tabellen existieren in der Datenbank
  // WHEN der Auth.js Login-Flow mit dem Drizzle Adapter durchlaufen wird
  // THEN wird ein User-Eintrag in users und ein Account-Eintrag in accounts erstellt
  //
  // NOTE: This AC requires a running DB + Auth.js flow. Since the task specifies
  // "No DB needed" and we test schema definitions + migration content, we validate
  // that the schema is compatible with the @auth/drizzle-adapter expectations
  // by checking the column naming conventions match Auth.js requirements.
  // ---------------------------------------------------------------------------
  describe('AC-9: schema compatible with Auth.js Drizzle Adapter', () => {
    it('should have all required Auth.js user fields', () => {
      const migrationSql = readFileSync(MIGRATION_PATH, 'utf-8')

      // Auth.js expects these exact column names in the users table
      const requiredUserFields = ['id', 'name', 'email', 'emailVerified', 'image']

      for (const field of requiredUserFields) {
        expect(migrationSql).toContain(`"${field}"`)
      }
    })

    it('should have all required Auth.js account fields', () => {
      const migrationSql = readFileSync(MIGRATION_PATH, 'utf-8')

      // Auth.js expects these exact column names for OAuth accounts
      const requiredAccountFields = [
        'userId',
        'type',
        'provider',
        'providerAccountId',
        'refresh_token',
        'access_token',
        'expires_at',
        'token_type',
        'scope',
        'id_token',
        'session_state',
      ]

      for (const field of requiredAccountFields) {
        expect(migrationSql).toContain(`"${field}"`)
      }
    })

    it('should have all required Auth.js session fields', () => {
      const migrationSql = readFileSync(MIGRATION_PATH, 'utf-8')

      // Auth.js expects these exact column names for sessions
      const requiredSessionFields = ['sessionToken', 'userId', 'expires']

      for (const field of requiredSessionFields) {
        expect(migrationSql).toContain(`"${field}"`)
      }
    })

    it('should use CASCADE DELETE so user deletion cleans up accounts and sessions', () => {
      const migrationSql = readFileSync(MIGRATION_PATH, 'utf-8')

      // Count cascade references -- must be at least 2 (accounts + sessions)
      const cascadeMatches = migrationSql.match(/ON DELETE cascade/g)
      expect(cascadeMatches).toBeDefined()
      expect(cascadeMatches!.length).toBeGreaterThanOrEqual(2)
    })
  })
})
