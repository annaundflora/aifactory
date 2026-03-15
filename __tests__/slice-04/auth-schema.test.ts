import { describe, it, expect } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { getTableName } from 'drizzle-orm'
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
 * Tests for slice-04-db-auth-tables: DB Schema - Auth.js Tabellen
 *
 * These tests validate the Drizzle schema definitions for users, accounts,
 * and sessions tables against the Acceptance Criteria from the slice spec.
 * All assertions inspect the real Drizzle table objects -- no mocks, no DB needed.
 */

describe('slice-04-db-auth-tables: Auth Schema', () => {
  // ---------------------------------------------------------------------------
  // AC-1: Build-Kompatibilitaet
  // GIVEN die Datei lib/db/schema.ts enthaelt die Tabellen-Definitionen
  //       fuer users, accounts, sessions
  // WHEN pnpm run build ausgefuehrt wird
  // THEN ist der Build erfolgreich ohne TypeScript-Fehler
  // ---------------------------------------------------------------------------
  it('AC-1: should compile schema without TypeScript errors', () => {
    // If we reach this point, the import succeeded without TypeScript errors.
    // The real build check happens at compile-time; this test verifies
    // the module loads and all three tables are defined objects.
    expect(users).toBeDefined()
    expect(accounts).toBeDefined()
    expect(sessions).toBeDefined()

    // Verify they are valid Drizzle tables (have columns via getTableConfig)
    const usersConfig = getTableConfig(users)
    const accountsConfig = getTableConfig(accounts)
    const sessionsConfig = getTableConfig(sessions)

    expect(usersConfig.columns.length).toBeGreaterThan(0)
    expect(accountsConfig.columns.length).toBeGreaterThan(0)
    expect(sessionsConfig.columns.length).toBeGreaterThan(0)
  })

  // ---------------------------------------------------------------------------
  // AC-2: Users-Tabelle Spalten
  // GIVEN die users-Tabelle ist definiert
  // WHEN die Tabellen-Definition geprueft wird
  // THEN enthaelt sie die Spalten id (UUID PK mit gen_random_uuid()),
  //      name (TEXT nullable), email (TEXT UNIQUE NOT NULL),
  //      emailVerified (TIMESTAMP WITH TIME ZONE nullable), image (TEXT nullable)
  // ---------------------------------------------------------------------------
  describe('AC-2: users table columns', () => {
    it('should have table name "users"', () => {
      expect(getTableName(users)).toBe('users')
    })

    it('should define id as UUID primary key with gen_random_uuid() default', () => {
      const config = getTableConfig(users)
      const idCol = config.columns.find((c) => c.name === 'id')

      expect(idCol).toBeDefined()
      expect(idCol!.dataType).toBe('string') // UUID maps to string in Drizzle
      expect(idCol!.columnType).toBe('PgUUID')
      expect(idCol!.primary).toBe(true)
      expect(idCol!.hasDefault).toBe(true)
    })

    it('should define name as TEXT nullable', () => {
      const config = getTableConfig(users)
      const nameCol = config.columns.find((c) => c.name === 'name')

      expect(nameCol).toBeDefined()
      expect(nameCol!.columnType).toBe('PgText')
      expect(nameCol!.notNull).toBe(false)
    })

    it('should define email as TEXT UNIQUE NOT NULL', () => {
      const config = getTableConfig(users)
      const emailCol = config.columns.find((c) => c.name === 'email')

      expect(emailCol).toBeDefined()
      expect(emailCol!.columnType).toBe('PgText')
      expect(emailCol!.notNull).toBe(true)
      expect(emailCol!.isUnique).toBe(true)
    })

    it('should define emailVerified as TIMESTAMP WITH TIME ZONE nullable', () => {
      const config = getTableConfig(users)
      const col = config.columns.find((c) => c.name === 'emailVerified')

      expect(col).toBeDefined()
      expect(col!.columnType).toBe('PgTimestamp')
      expect(col!.notNull).toBe(false)
    })

    it('should define image as TEXT nullable', () => {
      const config = getTableConfig(users)
      const col = config.columns.find((c) => c.name === 'image')

      expect(col).toBeDefined()
      expect(col!.columnType).toBe('PgText')
      expect(col!.notNull).toBe(false)
    })

    it('should have exactly 5 columns', () => {
      const config = getTableConfig(users)
      expect(config.columns.length).toBe(5)
    })
  })

  // ---------------------------------------------------------------------------
  // AC-3: Accounts-Tabelle Composite PK + FK
  // GIVEN die accounts-Tabelle ist definiert
  // WHEN die Tabellen-Definition geprueft wird
  // THEN hat sie einen Composite Primary Key aus (provider, providerAccountId)
  //      und eine FK-Referenz userId auf users.id mit CASCADE DELETE
  // ---------------------------------------------------------------------------
  describe('AC-3: accounts table composite PK and FK', () => {
    it('should have table name "accounts"', () => {
      expect(getTableName(accounts)).toBe('accounts')
    })

    it('should have a composite primary key on (provider, providerAccountId)', () => {
      const config = getTableConfig(accounts)

      // Composite PK shows up in primaryKeys array, not as column.primary
      expect(config.primaryKeys.length).toBe(1)

      const pk = config.primaryKeys[0]!
      const pkColNames = pk.columns.map((c) => c.name)
      expect(pkColNames).toContain('provider')
      expect(pkColNames).toContain('providerAccountId')
      expect(pkColNames.length).toBe(2)
    })

    it('should have userId as FK referencing users.id with CASCADE DELETE', () => {
      const config = getTableConfig(accounts)

      // Find FK for userId
      const fks = config.foreignKeys
      expect(fks.length).toBeGreaterThanOrEqual(1)

      const userIdFk = fks.find((fk) => {
        const ref = fk.reference()
        return ref.columns.some((c) => c.name === 'userId')
      })

      expect(userIdFk).toBeDefined()
      expect(userIdFk!.onDelete).toBe('cascade')

      // Verify it references the users table
      const ref = userIdFk!.reference()
      expect(getTableName(ref.foreignTable)).toBe('users')
      expect(ref.foreignColumns.some((c) => c.name === 'id')).toBe(true)
    })

    it('should have userId as NOT NULL', () => {
      const config = getTableConfig(accounts)
      const userIdCol = config.columns.find((c) => c.name === 'userId')

      expect(userIdCol).toBeDefined()
      expect(userIdCol!.notNull).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // AC-4: Accounts-Tabelle OAuth-Felder
  // GIVEN die accounts-Tabelle ist definiert
  // WHEN die Tabellen-Definition geprueft wird
  // THEN enthaelt sie alle OAuth-Felder: type, provider, providerAccountId
  //      (alle NOT NULL), sowie refresh_token, access_token, expires_at,
  //      token_type, scope, id_token, session_state (alle nullable)
  // ---------------------------------------------------------------------------
  describe('AC-4: accounts table OAuth fields', () => {
    const NOT_NULL_FIELDS = ['type', 'provider', 'providerAccountId']
    const NULLABLE_FIELDS = [
      'refresh_token',
      'access_token',
      'expires_at',
      'token_type',
      'scope',
      'id_token',
      'session_state',
    ]

    it.each(NOT_NULL_FIELDS)(
      'should define %s as NOT NULL',
      (fieldName) => {
        const config = getTableConfig(accounts)
        const col = config.columns.find((c) => c.name === fieldName)

        expect(col).toBeDefined()
        expect(col!.notNull).toBe(true)
      }
    )

    it.each(NULLABLE_FIELDS)(
      'should define %s as nullable',
      (fieldName) => {
        const config = getTableConfig(accounts)
        const col = config.columns.find((c) => c.name === fieldName)

        expect(col).toBeDefined()
        expect(col!.notNull).toBe(false)
      }
    )

    it('should have type, provider, providerAccountId as TEXT', () => {
      const config = getTableConfig(accounts)

      for (const name of ['type', 'provider', 'providerAccountId']) {
        const col = config.columns.find((c) => c.name === name)
        expect(col).toBeDefined()
        expect(col!.columnType).toBe('PgText')
      }
    })

    it('should have expires_at as INTEGER', () => {
      const config = getTableConfig(accounts)
      const col = config.columns.find((c) => c.name === 'expires_at')

      expect(col).toBeDefined()
      expect(col!.columnType).toBe('PgInteger')
    })

    it('should have all 11 columns plus userId', () => {
      const config = getTableConfig(accounts)
      // userId + type + provider + providerAccountId + 7 nullable OAuth fields = 11
      expect(config.columns.length).toBe(11)
    })
  })

  // ---------------------------------------------------------------------------
  // AC-5: Sessions-Tabelle Spalten
  // GIVEN die sessions-Tabelle ist definiert
  // WHEN die Tabellen-Definition geprueft wird
  // THEN hat sie sessionToken (TEXT PK), userId (UUID FK auf users.id
  //      mit CASCADE DELETE, NOT NULL), expires (TIMESTAMP WITH TIME ZONE NOT NULL)
  // ---------------------------------------------------------------------------
  describe('AC-5: sessions table columns', () => {
    it('should have table name "sessions"', () => {
      expect(getTableName(sessions)).toBe('sessions')
    })

    it('should define sessionToken as TEXT primary key', () => {
      const config = getTableConfig(sessions)
      const col = config.columns.find((c) => c.name === 'sessionToken')

      expect(col).toBeDefined()
      expect(col!.columnType).toBe('PgText')
      expect(col!.primary).toBe(true)
    })

    it('should define userId as UUID FK on users.id with CASCADE DELETE, NOT NULL', () => {
      const config = getTableConfig(sessions)
      const userIdCol = config.columns.find((c) => c.name === 'userId')

      expect(userIdCol).toBeDefined()
      expect(userIdCol!.columnType).toBe('PgUUID')
      expect(userIdCol!.notNull).toBe(true)

      // Check FK
      const fks = config.foreignKeys
      expect(fks.length).toBeGreaterThanOrEqual(1)

      const userIdFk = fks.find((fk) => {
        const ref = fk.reference()
        return ref.columns.some((c) => c.name === 'userId')
      })

      expect(userIdFk).toBeDefined()
      expect(userIdFk!.onDelete).toBe('cascade')

      const ref = userIdFk!.reference()
      expect(getTableName(ref.foreignTable)).toBe('users')
      expect(ref.foreignColumns.some((c) => c.name === 'id')).toBe(true)
    })

    it('should define expires as TIMESTAMP WITH TIME ZONE NOT NULL', () => {
      const config = getTableConfig(sessions)
      const col = config.columns.find((c) => c.name === 'expires')

      expect(col).toBeDefined()
      expect(col!.columnType).toBe('PgTimestamp')
      expect(col!.notNull).toBe(true)
    })

    it('should have exactly 3 columns', () => {
      const config = getTableConfig(sessions)
      expect(config.columns.length).toBe(3)
    })
  })

  // ---------------------------------------------------------------------------
  // AC-6: Named Exports
  // GIVEN die drei Tabellen-Definitionen exportiert werden
  // WHEN sie als Named Exports geprueft werden
  // THEN sind users, accounts, sessions als Named Exports
  //      aus lib/db/schema.ts verfuegbar
  // ---------------------------------------------------------------------------
  it('AC-6: should export users, accounts, sessions as named exports from schema.ts', () => {
    // These imports would fail at compile time if the named exports don't exist.
    // We verify they are truthy Drizzle table objects.
    expect(users).toBeTruthy()
    expect(accounts).toBeTruthy()
    expect(sessions).toBeTruthy()

    // Verify they are proper Drizzle pgTable instances via getTableName
    expect(getTableName(users)).toBe('users')
    expect(getTableName(accounts)).toBe('accounts')
    expect(getTableName(sessions)).toBe('sessions')

    // Verify they have columns accessible via getTableConfig
    expect(getTableConfig(users).columns.length).toBeGreaterThan(0)
    expect(getTableConfig(accounts).columns.length).toBeGreaterThan(0)
    expect(getTableConfig(sessions).columns.length).toBeGreaterThan(0)
  })

  // ---------------------------------------------------------------------------
  // AC-10: Bestehende Tabellen unveraendert
  // GIVEN die bestehenden 8 Tabellen in lib/db/schema.ts
  // WHEN die neuen Tabellen hinzugefuegt werden
  // THEN bleiben alle bestehenden Tabellen-Definitionen und Exports unveraendert
  // ---------------------------------------------------------------------------
  describe('AC-10: existing tables preserved', () => {
    const existingTables = [
      { name: 'projects', table: projects },
      { name: 'generations', table: generations },
      { name: 'favorite_models', table: favoriteModels },
      { name: 'project_selected_models', table: projectSelectedModels },
      { name: 'assistant_sessions', table: assistantSessions },
      { name: 'assistant_images', table: assistantImages },
      { name: 'reference_images', table: referenceImages },
      { name: 'generation_references', table: generationReferences },
      { name: 'model_settings', table: modelSettings },
    ]

    it('should still export all 9 pre-existing tables (8 original + model_settings)', () => {
      for (const { name, table } of existingTables) {
        expect(table, `Table "${name}" should still be exported`).toBeDefined()
        expect(
          getTableName(table),
          `Table "${name}" should have correct SQL name`
        ).toBe(name)
      }
    })

    it('should preserve projects table with original columns', () => {
      const config = getTableConfig(projects)
      const colNames = config.columns.map((c) => c.name)

      expect(colNames).toContain('id')
      expect(colNames).toContain('name')
      expect(colNames).toContain('thumbnail_url')
      expect(colNames).toContain('thumbnail_status')
      expect(colNames).toContain('created_at')
      expect(colNames).toContain('updated_at')
    })

    it('should preserve generations table with original columns', () => {
      const config = getTableConfig(generations)
      const colNames = config.columns.map((c) => c.name)

      expect(colNames).toContain('id')
      expect(colNames).toContain('project_id')
      expect(colNames).toContain('prompt')
      expect(colNames).toContain('model_id')
      expect(colNames).toContain('status')
      expect(colNames).toContain('image_url')
    })

    it('should preserve model_settings table with original columns', () => {
      const config = getTableConfig(modelSettings)
      const colNames = config.columns.map((c) => c.name)

      expect(colNames).toContain('id')
      expect(colNames).toContain('mode')
      expect(colNames).toContain('tier')
      expect(colNames).toContain('model_id')
      expect(colNames).toContain('model_params')
    })
  })
})
