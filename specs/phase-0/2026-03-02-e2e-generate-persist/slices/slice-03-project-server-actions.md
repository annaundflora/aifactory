# Slice 3: Project Server Actions implementieren

> **Slice 3 von 21** fuer `E2E Generate & Persist`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-03-project-server-actions` |
| **Test** | `pnpm test app/actions/__tests__/projects.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-db-connection-queries"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test app/actions/__tests__/projects.test.ts` |
| **Integration Command** | `docker compose up -d && pnpm drizzle-kit migrate && pnpm test app/actions/__tests__/projects.integration.test.ts` |
| **Acceptance Command** | `docker compose up -d && pnpm drizzle-kit migrate && pnpm test app/actions/__tests__/projects.integration.test.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `localhost:3000` |
| **Mocking Strategy** | `mock_external` (Unit-Tests mocken DB-Queries, Integration-Tests gegen laufende DB) |

---

## Ziel

Server Actions fuer Projekt-CRUD bereitstellen (createProject, getProjects, getProject, renameProject, deleteProject) mit Input-Validierung. Nach diesem Slice koennen UI-Slices direkt auf die Projekt-Actions zugreifen.

---

## Acceptance Criteria

1) GIVEN ein leerer Projektname (leer oder nur Whitespace)
   WHEN `createProject({ name: "" })` aufgerufen wird
   THEN wird ein Fehler-Objekt `{ error: "Projektname darf nicht leer sein" }` zurueckgegeben, KEIN DB-Eintrag wird erstellt

2) GIVEN ein Projektname mit mehr als 255 Zeichen
   WHEN `createProject({ name: "A".repeat(256) })` aufgerufen wird
   THEN wird ein Fehler-Objekt `{ error: "Projektname darf nicht leer sein" }` zurueckgegeben

3) GIVEN ein gueltiger Projektname `"  My Project  "` (mit Whitespace)
   WHEN `createProject({ name: "  My Project  " })` aufgerufen wird
   THEN wird der Name auf `"My Project"` getrimmt, ein Projekt mit UUID, name, createdAt zurueckgegeben und der Pfad `/` wird revalidiert

4) GIVEN Projekte existieren in der DB
   WHEN `getProjects()` aufgerufen wird
   THEN wird ein Array aller Projekte zurueckgegeben, sortiert nach createdAt DESC

5) GIVEN ein Projekt mit bekannter ID existiert
   WHEN `getProject({ id: "<uuid>" })` aufgerufen wird
   THEN wird das Projekt-Objekt mit allen Feldern zurueckgegeben

6) GIVEN eine nicht existierende ID
   WHEN `getProject({ id: "<invalid-uuid>" })` aufgerufen wird
   THEN wird ein Fehler-Objekt `{ error: "Projekt nicht gefunden" }` zurueckgegeben

7) GIVEN ein existierendes Projekt
   WHEN `renameProject({ id: "<uuid>", name: "New Name" })` aufgerufen wird
   THEN wird der Name aktualisiert, updatedAt ist neuer als vorher, und der Pfad `/` wird revalidiert

8) GIVEN ein existierendes Projekt
   WHEN `renameProject({ id: "<uuid>", name: "" })` aufgerufen wird
   THEN wird ein Fehler-Objekt `{ error: "Projektname darf nicht leer sein" }` zurueckgegeben, Name bleibt unveraendert

9) GIVEN ein existierendes Projekt
   WHEN `deleteProject({ id: "<uuid>" })` aufgerufen wird
   THEN wird `{ success: true }` zurueckgegeben, das Projekt und alle zugehoerigen Generations sind aus der DB entfernt, und der Pfad `/` wird revalidiert

10) GIVEN eine DB-Operation schlaegt fehl (unerwarteter Fehler)
    WHEN eine beliebige Server Action aufgerufen wird
    THEN wird ein Fehler-Objekt `{ error: "Datenbankfehler" }` zurueckgegeben und der Fehler wird geloggt

11) GIVEN `app/actions/projects.ts` existiert
    WHEN die Datei inspiziert wird
    THEN beginnt sie mit `"use server"` als erste Zeile

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `app/actions/__tests__/projects.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('createProject', () => {
  // AC-1: Leerer Name
  it.todo('should return error when name is empty or whitespace-only')

  // AC-2: Name zu lang
  it.todo('should return error when name exceeds 255 characters')

  // AC-3: Gueltiger Name mit Trimming
  it.todo('should trim name, call createProject query, and revalidate path /')
})

describe('getProjects', () => {
  // AC-4: Alle Projekte
  it.todo('should return all projects from query function')
})

describe('getProject', () => {
  // AC-5: Existierendes Projekt
  it.todo('should return project by ID')

  // AC-6: Nicht existierendes Projekt
  it.todo('should return error when project not found')
})

describe('renameProject', () => {
  // AC-7: Gueltiger neuer Name
  it.todo('should rename project, trim name, and revalidate path /')

  // AC-8: Leerer neuer Name
  it.todo('should return error when new name is empty')
})

describe('deleteProject', () => {
  // AC-9: Projekt loeschen
  it.todo('should delete project and revalidate path /')
})

describe('Error Handling', () => {
  // AC-10: DB-Fehler
  it.todo('should return error object and log when query throws')
})

describe('Module Declaration', () => {
  // AC-11: "use server"
  it.todo('should have "use server" as first line')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-02-db-connection-queries` | `createProject` | Query Function | `(input: { name: string }) => Promise<Project>` |
| `slice-02-db-connection-queries` | `getProjects` | Query Function | `() => Promise<Project[]>` |
| `slice-02-db-connection-queries` | `getProject` | Query Function | `(id: string) => Promise<Project>` |
| `slice-02-db-connection-queries` | `renameProject` | Query Function | `(id: string, name: string) => Promise<Project>` |
| `slice-02-db-connection-queries` | `deleteProject` | Query Function | `(id: string) => Promise<void>` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `createProject` | Server Action | UI Slices | `(input: { name: string }) => Promise<{ id, name, createdAt } \| { error: string }>` |
| `getProjects` | Server Action | UI Slices | `() => Promise<Project[]>` |
| `getProject` | Server Action | UI Slices | `(input: { id: string }) => Promise<Project \| { error: string }>` |
| `renameProject` | Server Action | UI Slices | `(input: { id: string, name: string }) => Promise<Project \| { error: string }>` |
| `deleteProject` | Server Action | UI Slices | `(input: { id: string }) => Promise<{ success: boolean } \| { error: string }>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/actions/projects.ts` — Server Actions fuer Project CRUD mit "use server" Direktive
<!-- DELIVERABLES_END -->

---

## Constraints

**Scope-Grenzen:**
- KEINE UI-Komponenten oder Pages -- kommt in spaeteren UI-Slices
- KEINE Generation-Actions (generateImages, retryGeneration) -- kommt in spaeteren Slices
- KEINE Snippet-Actions -- kommt in Slice 19+
- KEIN R2-Cleanup beim Loeschen -- kommt wenn StorageService existiert
- KEINE Projekt-Workspace-Seite -- nur die Actions-Datei

**Technische Constraints:**
- `"use server"` Direktive als erste Zeile
- Alle Actions geben Fehler als Objekt `{ error: string }` zurueck (kein throw)
- Input-Validierung: Name trimmen, non-empty pruefen, max 255 Zeichen
- `revalidatePath("/")` nach Mutationen (create, rename, delete)
- Nutze Query-Funktionen aus `lib/db/queries.ts` (kein direkter DB-Zugriff)

**Referenzen:**
- Architecture: `architecture.md` → Section "API Design > Server Actions" (Input/Output Definitionen)
- Architecture: `architecture.md` → Section "Validation Rules" (Projektname-Validierung)
- Architecture: `architecture.md` → Section "Architecture Layers" (Server Actions Layer)
- Architecture: `architecture.md` → Section "Error Handling Strategy" (Validation Error, DB Error)
