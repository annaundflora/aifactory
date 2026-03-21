import { describe, it, expect, expectTypeOf } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import type { InferSelectModel } from 'drizzle-orm'
import { assistantSessions, assistantImages, projects } from '../schema'

/**
 * Tests for Slice 05: DB Schema (Drizzle) -- assistant_sessions + assistant_images
 *
 * Schema tests (AC-1, AC-2, AC-3) inspect Drizzle ORM table objects directly
 * and do NOT require a running database.
 *
 * Query tests (AC-4, AC-5) require a real DATABASE_URL and are gated accordingly.
 *
 * AC-6 (drizzle-kit push) validates that the schema is structurally valid.
 *
 * Mocking Strategy: no_mocks (pure schema inspection for AC-1..3, real DB for AC-4..5)
 */

// ---------------------------------------------------------------------------
// Type inference helpers
// ---------------------------------------------------------------------------
type AssistantSessionSelect = InferSelectModel<typeof assistantSessions>
type AssistantImageSelect = InferSelectModel<typeof assistantImages>

// ---------------------------------------------------------------------------
// AC-1: assistantSessions table exported with all required columns
// ---------------------------------------------------------------------------
describe('assistant_sessions schema', () => {
  const config = getTableConfig(assistantSessions)
  const columnMap = Object.fromEntries(
    config.columns.map((c) => [c.name, c])
  )

  it('AC-1: should export assistantSessions table with all required columns', () => {
    /**
     * AC-1: GIVEN die bestehende `lib/db/schema.ts` mit `projects`, `generations`,
     *       `favoriteModels`, `projectSelectedModels`, `promptSnippets`
     *       WHEN der Implementer die `assistant_sessions` Tabelle hinzufuegt
     *       THEN exportiert `schema.ts` ein `assistantSessions` Objekt mit allen Spalten
     *       laut architecture.md Section "Database Schema > Schema Details >
     *       Table: assistant_sessions" (id, project_id, title, status, last_message_at,
     *       message_count, has_draft, created_at, updated_at)
     */

    // Table name
    expect(config.name).toBe('assistant_sessions')

    // All required columns must exist
    const requiredColumns = [
      'id',
      'project_id',
      'title',
      'status',
      'last_message_at',
      'message_count',
      'has_draft',
      'created_at',
      'updated_at',
    ]

    for (const colName of requiredColumns) {
      expect(columnMap[colName], `Column "${colName}" should exist`).toBeDefined()
    }

    // Verify column count matches expected
    expect(config.columns.length).toBe(requiredColumns.length)

    // Verify column types
    expect(columnMap['id'].columnType).toBe('PgUUID')
    expect(columnMap['project_id'].columnType).toBe('PgUUID')
    expect(columnMap['title'].columnType).toBe('PgVarchar')
    expect(columnMap['status'].columnType).toBe('PgVarchar')
    expect(columnMap['last_message_at'].columnType).toBe('PgTimestamp')
    expect(columnMap['message_count'].columnType).toBe('PgInteger')
    expect(columnMap['has_draft'].columnType).toBe('PgBoolean')
    expect(columnMap['created_at'].columnType).toBe('PgTimestamp')
    expect(columnMap['updated_at'].columnType).toBe('PgTimestamp')
  })

  // ---------------------------------------------------------------------------
  // AC-2: Constraints, defaults, and indexes
  // ---------------------------------------------------------------------------
  it('AC-2: should have correct constraints: PK, FK cascade, defaults, indexes', () => {
    /**
     * AC-2: GIVEN die `assistant_sessions` Tabelle in `schema.ts`
     *       WHEN die Spalten-Constraints inspiziert werden
     *       THEN gilt: `id` ist UUID PK mit `gen_random_uuid()` Default,
     *       `project_id` ist NOT NULL FK auf `projects.id` mit ON DELETE CASCADE,
     *       `status` ist VARCHAR(20) NOT NULL mit Default `'active'`,
     *       `message_count` ist INTEGER NOT NULL Default 0,
     *       `has_draft` ist BOOLEAN NOT NULL Default false,
     *       `last_message_at` hat Default NOW(),
     *       es existieren Indizes auf `project_id` und `last_message_at`
     */

    // id: UUID PK with gen_random_uuid() default
    expect(columnMap['id'].primary).toBe(true)
    expect(columnMap['id'].hasDefault).toBe(true)
    expect(columnMap['id'].columnType).toBe('PgUUID')

    // project_id: NOT NULL FK on projects.id with ON DELETE CASCADE
    expect(columnMap['project_id'].notNull).toBe(true)
    expect(config.foreignKeys.length).toBeGreaterThanOrEqual(1)
    const projectFk = config.foreignKeys.find((fk) => {
      const ref = fk.reference()
      return ref.foreignTable === projects
    })
    expect(projectFk, 'FK to projects table should exist').toBeDefined()
    expect(projectFk!.onDelete).toBe('cascade')

    // Verify the FK references the correct column (projects.id)
    const fkRef = projectFk!.reference()
    expect(fkRef.foreignTable).toBe(projects)
    expect(fkRef.foreignColumns.length).toBe(1)

    // status: VARCHAR(20) NOT NULL default 'active'
    expect(columnMap['status'].notNull).toBe(true)
    expect(columnMap['status'].hasDefault).toBe(true)
    expect(columnMap['status'].default).toBe('active')
    expect((columnMap['status'] as any).length).toBe(20)

    // message_count: INTEGER NOT NULL default 0
    expect(columnMap['message_count'].notNull).toBe(true)
    expect(columnMap['message_count'].hasDefault).toBe(true)
    expect(columnMap['message_count'].default).toBe(0)

    // has_draft: BOOLEAN NOT NULL default false
    expect(columnMap['has_draft'].notNull).toBe(true)
    expect(columnMap['has_draft'].hasDefault).toBe(true)
    expect(columnMap['has_draft'].default).toBe(false)

    // last_message_at: has default (NOW())
    expect(columnMap['last_message_at'].notNull).toBe(true)
    expect(columnMap['last_message_at'].hasDefault).toBe(true)

    // created_at: has default
    expect(columnMap['created_at'].notNull).toBe(true)
    expect(columnMap['created_at'].hasDefault).toBe(true)

    // updated_at: has default
    expect(columnMap['updated_at'].notNull).toBe(true)
    expect(columnMap['updated_at'].hasDefault).toBe(true)

    // Indexes on project_id and last_message_at
    const indexNames = config.indexes.map((idx) => idx.config.name)
    expect(indexNames).toContain('assistant_sessions_project_id_idx')
    expect(indexNames).toContain('assistant_sessions_last_message_at_idx')

    // Verify each index targets the correct column
    const projectIdIdx = config.indexes.find(
      (idx) => idx.config.name === 'assistant_sessions_project_id_idx'
    )
    expect(projectIdIdx).toBeDefined()
    expect(projectIdIdx!.config.columns.length).toBe(1)
    expect((projectIdIdx!.config.columns[0] as any).name).toBe('project_id')

    const lastMessageAtIdx = config.indexes.find(
      (idx) => idx.config.name === 'assistant_sessions_last_message_at_idx'
    )
    expect(lastMessageAtIdx).toBeDefined()
    expect(lastMessageAtIdx!.config.columns.length).toBe(1)
    expect((lastMessageAtIdx!.config.columns[0] as any).name).toBe('last_message_at')
  })

  it('AC-2 (types): should infer correct TypeScript types for AssistantSession', () => {
    /**
     * Verify that the inferred TypeScript type has the expected shape.
     */
    expectTypeOf<AssistantSessionSelect>().toHaveProperty('id')
    expectTypeOf<AssistantSessionSelect['id']>().toEqualTypeOf<string>()

    expectTypeOf<AssistantSessionSelect>().toHaveProperty('projectId')
    expectTypeOf<AssistantSessionSelect['projectId']>().toEqualTypeOf<string>()

    expectTypeOf<AssistantSessionSelect>().toHaveProperty('title')
    expectTypeOf<AssistantSessionSelect['title']>().toEqualTypeOf<string | null>()

    expectTypeOf<AssistantSessionSelect>().toHaveProperty('status')
    expectTypeOf<AssistantSessionSelect['status']>().toEqualTypeOf<string>()

    expectTypeOf<AssistantSessionSelect>().toHaveProperty('lastMessageAt')
    expectTypeOf<AssistantSessionSelect['lastMessageAt']>().toEqualTypeOf<Date>()

    expectTypeOf<AssistantSessionSelect>().toHaveProperty('messageCount')
    expectTypeOf<AssistantSessionSelect['messageCount']>().toEqualTypeOf<number>()

    expectTypeOf<AssistantSessionSelect>().toHaveProperty('hasDraft')
    expectTypeOf<AssistantSessionSelect['hasDraft']>().toEqualTypeOf<boolean>()

    expectTypeOf<AssistantSessionSelect>().toHaveProperty('createdAt')
    expectTypeOf<AssistantSessionSelect['createdAt']>().toEqualTypeOf<Date>()

    expectTypeOf<AssistantSessionSelect>().toHaveProperty('updatedAt')
    expectTypeOf<AssistantSessionSelect['updatedAt']>().toEqualTypeOf<Date>()
  })
})

// ---------------------------------------------------------------------------
// AC-3: assistantImages table exported with all required columns and FK cascade
// ---------------------------------------------------------------------------
describe('assistant_images schema', () => {
  const config = getTableConfig(assistantImages)
  const columnMap = Object.fromEntries(
    config.columns.map((c) => [c.name, c])
  )

  it('AC-3: should export assistantImages table with all required columns and FK cascade', () => {
    /**
     * AC-3: GIVEN die bestehende `lib/db/schema.ts`
     *       WHEN der Implementer die `assistant_images` Tabelle hinzufuegt
     *       THEN exportiert `schema.ts` ein `assistantImages` Objekt mit Spalten:
     *       `id` (UUID PK, gen_random_uuid()),
     *       `session_id` (UUID NOT NULL FK auf assistant_sessions.id, ON DELETE CASCADE),
     *       `image_url` (TEXT NOT NULL),
     *       `created_at` (TIMESTAMP WITH TZ, NOT NULL, Default NOW())
     *       und einem Index auf `session_id`
     */

    // Table name
    expect(config.name).toBe('assistant_images')

    // All required columns
    const requiredColumns = [
      'id',
      'session_id',
      'image_url',
      'created_at',
    ]

    for (const colName of requiredColumns) {
      expect(columnMap[colName], `Column "${colName}" should exist`).toBeDefined()
    }
    expect(config.columns.length).toBe(requiredColumns.length)

    // id: UUID PK with gen_random_uuid() default
    expect(columnMap['id'].columnType).toBe('PgUUID')
    expect(columnMap['id'].primary).toBe(true)
    expect(columnMap['id'].hasDefault).toBe(true)

    // session_id: UUID NOT NULL FK on assistant_sessions.id with ON DELETE CASCADE
    expect(columnMap['session_id'].columnType).toBe('PgUUID')
    expect(columnMap['session_id'].notNull).toBe(true)

    expect(config.foreignKeys.length).toBeGreaterThanOrEqual(1)
    const sessionFk = config.foreignKeys.find((fk) => {
      const ref = fk.reference()
      return ref.foreignTable === assistantSessions
    })
    expect(sessionFk, 'FK to assistant_sessions table should exist').toBeDefined()
    expect(sessionFk!.onDelete).toBe('cascade')

    // Verify FK references the correct table
    const fkRef = sessionFk!.reference()
    expect(fkRef.foreignTable).toBe(assistantSessions)

    // image_url: TEXT NOT NULL
    expect(columnMap['image_url'].columnType).toBe('PgText')
    expect(columnMap['image_url'].notNull).toBe(true)

    // created_at: TIMESTAMP WITH TZ, NOT NULL, Default NOW()
    expect(columnMap['created_at'].columnType).toBe('PgTimestamp')
    expect(columnMap['created_at'].notNull).toBe(true)
    expect(columnMap['created_at'].hasDefault).toBe(true)

    // Index on session_id
    const indexNames = config.indexes.map((idx) => idx.config.name)
    expect(indexNames).toContain('assistant_images_session_id_idx')

    const sessionIdIdx = config.indexes.find(
      (idx) => idx.config.name === 'assistant_images_session_id_idx'
    )
    expect(sessionIdIdx).toBeDefined()
    expect(sessionIdIdx!.config.columns.length).toBe(1)
    expect((sessionIdIdx!.config.columns[0] as any).name).toBe('session_id')
  })

  it('AC-3 (types): should infer correct TypeScript types for AssistantImage', () => {
    /**
     * Verify inferred TypeScript type shape for assistant_images.
     */
    expectTypeOf<AssistantImageSelect>().toHaveProperty('id')
    expectTypeOf<AssistantImageSelect['id']>().toEqualTypeOf<string>()

    expectTypeOf<AssistantImageSelect>().toHaveProperty('sessionId')
    expectTypeOf<AssistantImageSelect['sessionId']>().toEqualTypeOf<string>()

    expectTypeOf<AssistantImageSelect>().toHaveProperty('imageUrl')
    expectTypeOf<AssistantImageSelect['imageUrl']>().toEqualTypeOf<string>()

    expectTypeOf<AssistantImageSelect>().toHaveProperty('createdAt')
    expectTypeOf<AssistantImageSelect['createdAt']>().toEqualTypeOf<Date>()
  })
})

// ---------------------------------------------------------------------------
// AC-4: getSessionsByProject -- returns sessions sorted by last_message_at DESC
// AC-5: getSessionById -- returns session or throws
//
// These tests require a real DB connection (no_mocks strategy).
// They use vi.mock to lazily bind the db module so the import doesn't
// throw when DATABASE_URL is missing during schema-only test runs.
// When DATABASE_URL IS available, the real DB is used.
// ---------------------------------------------------------------------------

const HAS_DATABASE = !!process.env.DATABASE_URL

describe.runIf(HAS_DATABASE)('getSessionsByProject', () => {
  // Dynamic imports to avoid DATABASE_URL crash at module load time
  // The db module throws immediately if DATABASE_URL is not set.

  it('AC-4: should return sessions for a project sorted by last_message_at DESC', async () => {
    /**
     * AC-4: GIVEN die erweiterte `lib/db/queries.ts`
     *       WHEN `getSessionsByProject(projectId: string)` aufgerufen wird
     *       mit einer gueltigen project_id
     *       THEN gibt die Funktion ein Array von `AssistantSession` Rows zurueck,
     *       sortiert nach `last_message_at` DESC
     */
    const { db } = await import('../index')
    const { assistantSessions } = await import('../schema')
    const { projects } = await import('../schema')
    const { getSessionsByProject } = await import('../queries')
    const { eq, desc } = await import('drizzle-orm')

    // Arrange: create a test project
    const [project] = await db
      .insert(projects)
      .values({ name: 'test-project-ac4' })
      .returning()

    try {
      // Create sessions with different last_message_at values
      const earlier = new Date('2026-03-10T10:00:00Z')
      const later = new Date('2026-03-10T12:00:00Z')
      const latest = new Date('2026-03-10T14:00:00Z')

      await db.insert(assistantSessions).values([
        { projectId: project.id, title: 'Session A', lastMessageAt: earlier },
        { projectId: project.id, title: 'Session C', lastMessageAt: latest },
        { projectId: project.id, title: 'Session B', lastMessageAt: later },
      ])

      // Act
      const sessions = await getSessionsByProject(project.id)

      // Assert: returns array sorted by last_message_at DESC
      expect(Array.isArray(sessions)).toBe(true)
      expect(sessions.length).toBe(3)
      expect(sessions[0].title).toBe('Session C') // latest
      expect(sessions[1].title).toBe('Session B') // later
      expect(sessions[2].title).toBe('Session A') // earliest

      // Verify sorting: each session's lastMessageAt >= next session's lastMessageAt
      for (let i = 0; i < sessions.length - 1; i++) {
        expect(sessions[i].lastMessageAt.getTime()).toBeGreaterThanOrEqual(
          sessions[i + 1].lastMessageAt.getTime()
        )
      }

      // Verify each row has all expected fields
      for (const session of sessions) {
        expect(session.id).toBeDefined()
        expect(session.projectId).toBe(project.id)
        expect(session.status).toBe('active') // default
        expect(session.messageCount).toBe(0) // default
        expect(session.hasDraft).toBe(false) // default
        expect(session.createdAt).toBeInstanceOf(Date)
        expect(session.updatedAt).toBeInstanceOf(Date)
      }
    } finally {
      // Cleanup: cascade will delete sessions too
      await db.delete(projects).where(eq(projects.id, project.id))
    }
  })

  it('AC-4 (edge): should return empty array for project with no sessions', async () => {
    /**
     * Edge case: calling getSessionsByProject for a project that has no sessions
     * should return an empty array, not throw.
     */
    const { db } = await import('../index')
    const { projects } = await import('../schema')
    const { getSessionsByProject } = await import('../queries')
    const { eq } = await import('drizzle-orm')

    const [project] = await db
      .insert(projects)
      .values({ name: 'test-project-ac4-empty' })
      .returning()

    try {
      const sessions = await getSessionsByProject(project.id)
      expect(Array.isArray(sessions)).toBe(true)
      expect(sessions.length).toBe(0)
    } finally {
      await db.delete(projects).where(eq(projects.id, project.id))
    }
  })
})

describe.runIf(HAS_DATABASE)('getSessionById', () => {
  it('AC-5: should return a single session by id', async () => {
    /**
     * AC-5: GIVEN die erweiterte `lib/db/queries.ts`
     *       WHEN `getSessionById(id: string)` aufgerufen wird mit einer gueltigen session-id
     *       THEN gibt die Funktion genau eine `AssistantSession` Row zurueck
     */
    const { db } = await import('../index')
    const { assistantSessions, projects } = await import('../schema')
    const { getSessionById } = await import('../queries')
    const { eq } = await import('drizzle-orm')

    // Arrange: create project + session
    const [project] = await db
      .insert(projects)
      .values({ name: 'test-project-ac5' })
      .returning()

    try {
      const [createdSession] = await db
        .insert(assistantSessions)
        .values({ projectId: project.id, title: 'AC5 Test Session' })
        .returning()

      // Act
      const session = await getSessionById(createdSession.id)

      // Assert: returns a single session with all fields
      expect(session).toBeDefined()
      expect(session.id).toBe(createdSession.id)
      expect(session.projectId).toBe(project.id)
      expect(session.title).toBe('AC5 Test Session')
      expect(session.status).toBe('active')
      expect(session.messageCount).toBe(0)
      expect(session.hasDraft).toBe(false)
      expect(session.lastMessageAt).toBeInstanceOf(Date)
      expect(session.createdAt).toBeInstanceOf(Date)
      expect(session.updatedAt).toBeInstanceOf(Date)
    } finally {
      await db.delete(projects).where(eq(projects.id, project.id))
    }
  })

  it('AC-5 (negative): should throw error when session not found', async () => {
    /**
     * AC-5: WHEN die id nicht existiert
     *       THEN wirft die Funktion einen Error mit Message "Session not found: {id}"
     */
    const { getSessionById } = await import('../queries')

    const nonExistentId = '00000000-0000-0000-0000-000000000000'

    await expect(getSessionById(nonExistentId)).rejects.toThrow(
      `Session not found: ${nonExistentId}`
    )
  })
})

// ---------------------------------------------------------------------------
// AC-6: drizzle-kit push should succeed (schema validity)
// ---------------------------------------------------------------------------
describe('drizzle-kit push', () => {
  it('AC-6: should successfully push schema to PostgreSQL (schema validity check)', () => {
    /**
     * AC-6: GIVEN alle Deliverables fertig implementiert
     *       WHEN `npx drizzle-kit push` ausgefuehrt wird
     *       THEN laeuft der Befehl erfolgreich (Exit-Code 0) und die Tabellen
     *       `assistant_sessions` und `assistant_images` existieren in PostgreSQL
     *       mit korrekten Spalten, Constraints und Indizes
     *
     * This test validates that the schema objects are structurally valid and can
     * be processed by Drizzle. The actual `npx drizzle-kit push` is an integration
     * step that requires a running PostgreSQL instance (tested via the Acceptance
     * Command in the slice spec metadata).
     */

    // Both tables are importable and have valid Drizzle table configs
    const sessionsConfig = getTableConfig(assistantSessions)
    const imagesConfig = getTableConfig(assistantImages)

    // assistant_sessions is a valid pgTable
    expect(sessionsConfig.name).toBe('assistant_sessions')
    expect(sessionsConfig.columns.length).toBe(9)
    expect(sessionsConfig.indexes.length).toBe(2)
    expect(sessionsConfig.foreignKeys.length).toBe(1)

    // assistant_images is a valid pgTable
    expect(imagesConfig.name).toBe('assistant_images')
    expect(imagesConfig.columns.length).toBe(4)
    expect(imagesConfig.indexes.length).toBe(1)
    expect(imagesConfig.foreignKeys.length).toBe(1)

    // Verify FK chain: images -> sessions -> projects
    const imagesFk = imagesConfig.foreignKeys[0]
    expect(imagesFk.reference().foreignTable).toBe(assistantSessions)

    const sessionsFk = sessionsConfig.foreignKeys[0]
    expect(sessionsFk.reference().foreignTable).toBe(projects)

    // Verify both use CASCADE
    expect(imagesFk.onDelete).toBe('cascade')
    expect(sessionsFk.onDelete).toBe('cascade')
  })
})
