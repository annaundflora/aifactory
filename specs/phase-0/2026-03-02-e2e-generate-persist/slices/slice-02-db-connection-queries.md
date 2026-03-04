# Slice 2: DB Connection + Queries aufsetzen

> **Slice 2 von 21** fuer `E2E Generate & Persist`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-02-db-connection-queries` |
| **Test** | `pnpm test lib/db/__tests__/queries.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-docker-db-schema"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/db/__tests__/queries.test.ts` |
| **Integration Command** | `docker compose up -d && pnpm drizzle-kit migrate && pnpm test lib/db/__tests__/queries.integration.test.ts` |
| **Acceptance Command** | `docker compose up -d && pnpm drizzle-kit migrate && pnpm test lib/db/__tests__/queries.integration.test.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `localhost:5432` (PostgreSQL) |
| **Mocking Strategy** | `test_containers` (Integration-Tests gegen laufende DB) |

---

## Ziel

postgres.js Connection als Singleton einrichten und eine Drizzle-ORM-Instance darauf aufbauen. Typisierte Query-Funktionen fuer Projects und Generations bereitstellen, damit nachfolgende Slices (Server Actions, Services) direkt DB-Operationen ausfuehren koennen.

---

## Acceptance Criteria

1) GIVEN die PostgreSQL-Datenbank laeuft und Migrationen sind angewendet
   WHEN `db` aus `lib/db/index.ts` importiert wird
   THEN ist es eine gueltige Drizzle-Instance (Singleton), die Queries ausfuehren kann

2) GIVEN die DB-Connection ist ein Singleton
   WHEN `db` mehrfach importiert wird (verschiedene Module)
   THEN wird exakt dieselbe postgres.js-Connection wiederverwendet (kein Connection-Leak)

3) GIVEN eine leere `projects`-Tabelle
   WHEN `createProject({ name: "Test Project" })` aufgerufen wird
   THEN wird ein Datensatz mit generierter UUID, dem Namen "Test Project", `created_at` und `updated_at` als TIMESTAMPTZ zurueckgegeben

4) GIVEN ein existierendes Projekt in der DB
   WHEN `getProjects()` aufgerufen wird
   THEN wird ein Array mit mindestens einem Project-Objekt zurueckgegeben, sortiert nach `created_at` DESC

5) GIVEN ein existierendes Projekt mit bekannter ID
   WHEN `getProject(id)` aufgerufen wird
   THEN wird das Project-Objekt mit allen Feldern zurueckgegeben

6) GIVEN ein existierendes Projekt mit bekannter ID
   WHEN `renameProject(id, "New Name")` aufgerufen wird
   THEN wird der Name auf "New Name" aktualisiert und `updated_at` ist neuer als vorher

7) GIVEN ein existierendes Projekt mit zugehoerigen Generations
   WHEN `deleteProject(id)` aufgerufen wird
   THEN wird das Projekt geloescht und alle zugehoerigen Generations werden via CASCADE ebenfalls entfernt

8) GIVEN ein existierendes Projekt
   WHEN `createGeneration({ projectId, prompt: "A fox", modelId: "black-forest-labs/flux-2-pro", modelParams: {} })` aufgerufen wird
   THEN wird ein Generation-Datensatz mit `status: "pending"` und `image_url: null` zurueckgegeben

9) GIVEN ein existierendes Projekt mit mehreren Generations
   WHEN `getGenerations(projectId)` aufgerufen wird
   THEN werden alle Generations des Projekts zurueckgegeben, sortiert nach `created_at` DESC

10) GIVEN eine existierende Generation mit `status: "pending"`
    WHEN `updateGeneration(id, { status: "completed", imageUrl: "https://r2.example.com/img.png", width: 1024, height: 1024 })` aufgerufen wird
    THEN werden die Felder aktualisiert und der aktualisierte Datensatz zurueckgegeben

11) GIVEN eine existierende Generation
    WHEN `deleteGeneration(id)` aufgerufen wird
    THEN wird der Datensatz entfernt und ist nicht mehr per `getGenerations` auffindbar

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/db/__tests__/queries.integration.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('DB Connection', () => {
  // AC-1: Drizzle-Instance
  it.todo('should export a valid Drizzle instance that can execute queries')

  // AC-2: Singleton
  it.todo('should reuse the same connection across multiple imports')
})

describe('Project Queries', () => {
  // AC-3: createProject
  it.todo('should insert a project and return it with UUID, name, created_at, updated_at')

  // AC-4: getProjects
  it.todo('should return all projects sorted by created_at DESC')

  // AC-5: getProject
  it.todo('should return a single project by ID with all fields')

  // AC-6: renameProject
  it.todo('should update project name and set updated_at to a newer timestamp')

  // AC-7: deleteProject with CASCADE
  it.todo('should delete project and cascade-delete associated generations')
})

describe('Generation Queries', () => {
  // AC-8: createGeneration
  it.todo('should insert a generation with status pending and image_url null')

  // AC-9: getGenerations
  it.todo('should return generations for a project sorted by created_at DESC')

  // AC-10: updateGeneration
  it.todo('should update generation fields and return the updated record')

  // AC-11: deleteGeneration
  it.todo('should remove the generation record from the database')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-docker-db-schema` | `projects` Table Schema | Drizzle Table | Import aus `lib/db/schema.ts` |
| `slice-01-docker-db-schema` | `generations` Table Schema | Drizzle Table | Import aus `lib/db/schema.ts` |
| `slice-01-docker-db-schema` | PostgreSQL Container | Docker Service | `docker compose up -d` laeuft |
| `slice-01-docker-db-schema` | `drizzle.config.ts` | Config | Migrationen sind anwendbar |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `db` | Drizzle Instance | slice-03+, slice-08, slice-19 | `export const db: DrizzleInstance` aus `lib/db/index.ts` |
| `createProject` | Query Function | slice-03 | `(input: { name: string }) => Promise<Project>` |
| `getProjects` | Query Function | slice-03 | `() => Promise<Project[]>` |
| `getProject` | Query Function | slice-03 | `(id: string) => Promise<Project>` |
| `renameProject` | Query Function | slice-03 | `(id: string, name: string) => Promise<Project>` |
| `deleteProject` | Query Function | slice-03 | `(id: string) => Promise<void>` |
| `createGeneration` | Query Function | slice-08 | `(input: { projectId, prompt, modelId, modelParams, ... }) => Promise<Generation>` |
| `getGenerations` | Query Function | slice-08 | `(projectId: string) => Promise<Generation[]>` |
| `updateGeneration` | Query Function | slice-08 | `(id: string, data: Partial<Generation>) => Promise<Generation>` |
| `deleteGeneration` | Query Function | slice-13 | `(id: string) => Promise<void>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/db/index.ts` — postgres.js Singleton-Connection + Drizzle-Instance Export
- [ ] `lib/db/queries.ts` — Typisierte Query-Funktionen fuer Projects und Generations
<!-- DELIVERABLES_END -->

---

## Constraints

**Scope-Grenzen:**
- KEINE Server Actions — kommt in Slice 03
- KEINE Snippet-Queries (prompt_snippets) — kommt in Slice 19
- KEINE Input-Validierung (Name non-empty etc.) — kommt in Slice 03
- KEINE Connection-Pool-Konfiguration ueber Defaults hinaus

**Technische Constraints:**
- postgres.js als Driver (nicht node-postgres)
- Drizzle ORM fuer alle Queries (kein raw SQL)
- Connection als Singleton (Module-Level Variable)
- DATABASE_URL aus `process.env` lesen (postgresql:// Format)
- Alle Query-Funktionen sind async und typisiert

**Referenzen:**
- Architecture: `architecture.md` → Section "Database Schema" (Schema Details, Relationships)
- Architecture: `architecture.md` → Section "Architecture Layers" (Database Layer: Drizzle ORM, Repository-artig)
- Architecture: `architecture.md` → Section "Constraints & Integrations" (DATABASE_URL Format, postgres.js Singleton)
- Architecture: `architecture.md` → Section "API Design" (Server Actions Input/Output fuer Query-Signaturen)
