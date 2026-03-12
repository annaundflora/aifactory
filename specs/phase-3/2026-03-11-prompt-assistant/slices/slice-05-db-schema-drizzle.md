# Slice 05: DB Schema (Drizzle) -- assistant_sessions + assistant_images

> **Slice 5 von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-05-db-schema-drizzle` |
| **Test** | `pnpm test lib/db/__tests__/assistant-schema.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Drizzle ORM 0.45.1, drizzle-kit 0.31.9) |
| **Test Command** | `pnpm test lib/db/__tests__/assistant-schema.test.ts` |
| **Integration Command** | `npx drizzle-kit push` |
| **Acceptance Command** | `npx drizzle-kit push && pnpm test lib/db/__tests__/assistant-schema.test.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | n/a (kein Server-Endpoint in diesem Slice) |
| **Mocking Strategy** | `no_mocks` (Schema-Definitionen + DB-Queries gegen echte DB) |

---

## Ziel

Drizzle-Schema um die Tabellen `assistant_sessions` und `assistant_images` erweitern, damit die Session-Verwaltung des Prompt Assistant aus der Next.js-Seite abfragbar ist. Dazu zwei Query-Funktionen bereitstellen (`getSessionsByProject`, `getSessionById`), die spaetere Slices (Session-Management, Session-Liste) direkt nutzen koennen.

---

## Acceptance Criteria

1) GIVEN die bestehende `lib/db/schema.ts` mit `projects`, `generations`, `favoriteModels`, `projectSelectedModels`, `promptSnippets`
   WHEN der Implementer die `assistant_sessions` Tabelle hinzufuegt
   THEN exportiert `schema.ts` ein `assistantSessions` Objekt mit allen Spalten laut architecture.md Section "Database Schema > Schema Details > Table: assistant_sessions" (id, project_id, title, status, last_message_at, message_count, has_draft, created_at, updated_at)

2) GIVEN die `assistant_sessions` Tabelle in `schema.ts`
   WHEN die Spalten-Constraints inspiziert werden
   THEN gilt: `id` ist UUID PK mit `gen_random_uuid()` Default, `project_id` ist NOT NULL FK auf `projects.id` mit ON DELETE CASCADE, `status` ist VARCHAR(20) NOT NULL mit Default `'active'`, `message_count` ist INTEGER NOT NULL Default 0, `has_draft` ist BOOLEAN NOT NULL Default false, `last_message_at` hat Default NOW(), es existieren Indizes auf `project_id` und `last_message_at`

3) GIVEN die bestehende `lib/db/schema.ts`
   WHEN der Implementer die `assistant_images` Tabelle hinzufuegt
   THEN exportiert `schema.ts` ein `assistantImages` Objekt mit Spalten: `id` (UUID PK, gen_random_uuid()), `session_id` (UUID NOT NULL FK auf assistant_sessions.id, ON DELETE CASCADE), `image_url` (TEXT NOT NULL), `analysis_result` (JSONB nullable), `created_at` (TIMESTAMP WITH TZ, NOT NULL, Default NOW()) und einem Index auf `session_id`

4) GIVEN die erweiterte `lib/db/queries.ts`
   WHEN `getSessionsByProject(projectId: string)` aufgerufen wird mit einer gueltigen project_id
   THEN gibt die Funktion ein Array von `AssistantSession` Rows zurueck, sortiert nach `last_message_at` DESC

5) GIVEN die erweiterte `lib/db/queries.ts`
   WHEN `getSessionById(id: string)` aufgerufen wird mit einer gueltigen session-id
   THEN gibt die Funktion genau eine `AssistantSession` Row zurueck
   WHEN die id nicht existiert
   THEN wirft die Funktion einen Error mit Message "Session not found: {id}"

6) GIVEN alle Deliverables fertig implementiert
   WHEN `npx drizzle-kit push` ausgefuehrt wird
   THEN laeuft der Befehl erfolgreich (Exit-Code 0) und die Tabellen `assistant_sessions` und `assistant_images` existieren in PostgreSQL mit korrekten Spalten, Constraints und Indizes

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.
> **Syntax:** TypeScript/Vitest

### Test-Datei: `lib/db/__tests__/assistant-schema.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('assistant_sessions schema', () => {
  // AC-1: assistantSessions Tabelle exportiert mit allen Spalten
  it.todo('should export assistantSessions table with all required columns')

  // AC-2: Spalten-Constraints und Indizes korrekt
  it.todo('should have correct constraints: PK, FK cascade, defaults, indexes')
})

describe('assistant_images schema', () => {
  // AC-3: assistantImages Tabelle exportiert mit allen Spalten
  it.todo('should export assistantImages table with all required columns and FK cascade')
})

describe('getSessionsByProject', () => {
  // AC-4: Sessions nach project_id abrufen, sortiert nach last_message_at DESC
  it.todo('should return sessions for a project sorted by last_message_at DESC')
})

describe('getSessionById', () => {
  // AC-5: Session per id abrufen / Error bei fehlender id
  it.todo('should return a single session by id')
  it.todo('should throw error when session not found')
})

describe('drizzle-kit push', () => {
  // AC-6: Migration laeuft fehlerfrei
  it.todo('should successfully push schema to PostgreSQL')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| (keine) | `projects` Tabelle in `lib/db/schema.ts` | Schema (bereits vorhanden) | FK-Referenz `projects.id` existiert |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `assistantSessions` | Drizzle Table | slice-05 (Python Session-Management), slice-session-list | `import { assistantSessions } from '@/lib/db/schema'` |
| `assistantImages` | Drizzle Table | slice-bildanalyse | `import { assistantImages } from '@/lib/db/schema'` |
| `getSessionsByProject` | Query-Funktion | slice-session-list | `(projectId: string) => Promise<AssistantSession[]>` |
| `getSessionById` | Query-Funktion | slice-session-detail | `(id: string) => Promise<AssistantSession>` |
| `AssistantSession` | Inferred Type | slice-session-list, slice-session-detail | `typeof assistantSessions.$inferSelect` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/db/schema.ts` -- Erweitert um `assistantSessions` und `assistantImages` Tabellen-Definitionen
- [ ] `lib/db/queries.ts` -- Erweitert um `getSessionsByProject`, `getSessionById` und `AssistantSession` Type-Export
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice erstellt KEINE CRUD-Operationen fuer Sessions (create, update, archive) -- kommt in spaeteren Slices
- Dieser Slice erstellt KEINE assistant_images CRUD-Operationen -- kommt in Slice Bildanalyse
- Dieser Slice aendert KEINE bestehenden Tabellen oder Queries
- LangGraph Checkpoint-Tabellen (`checkpoints`, `checkpoint_writes`, `checkpoint_migrations`) werden NICHT in Drizzle definiert -- die werden von `PostgresSaver.setup()` im Python-Backend verwaltet

**Technische Constraints:**
- Drizzle ORM (`drizzle-orm/pg-core`) fuer Schema-Definitionen, konsistent mit bestehendem Pattern in `schema.ts`
- `pgTable` mit expliziten Index-Definitionen im dritten Argument (bestehendes Pattern)
- `uuid().primaryKey().default(sql\`gen_random_uuid()\`)` fuer PKs (bestehendes Pattern)
- `.references(() => projects.id, { onDelete: "cascade" })` fuer FK (bestehendes Pattern)
- `npx drizzle-kit push` als Migration-Strategie (kein `generate` + `migrate`, wie in drizzle.config.ts konfiguriert)

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -- Section "Database Schema > Schema Details" (Spalten, Typen, Constraints, Indizes)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -- Section "Database Schema > Relationships" (FK-Beziehungen, Cascade-Regeln)
- Bestehendes Pattern: `lib/db/schema.ts` (projects, generations) fuer Drizzle-Idiom
- Bestehendes Pattern: `lib/db/queries.ts` (getProject, getProjects) fuer Query-Idiom
