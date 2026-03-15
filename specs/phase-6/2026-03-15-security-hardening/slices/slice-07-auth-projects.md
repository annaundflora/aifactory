# Slice 07: Server Action Auth - Projects + Queries

> **Slice 7 von 14** fuer `Security Hardening for Public Deployment`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-07-auth-projects` |
| **Test** | `pnpm vitest run __tests__/slice-07` |
| **E2E** | `false` |
| **Dependencies** | `["slice-06-auth-guard"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm vitest run __tests__/slice-07` |
| **Integration Command** | `pnpm run build` |
| **Acceptance Command** | `pnpm vitest run __tests__/slice-07` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/api/auth/session` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

`requireAuth()` als erste Pruefung in alle 6 Server Actions in `projects.ts` einbauen und die 5 Project-Query-Funktionen in `queries.ts` um einen `userId`-Parameter erweitern. Damit werden Projekte User-isoliert: kein Zugriff ohne Session, kein Zugriff auf fremde Projekte.

---

## Acceptance Criteria

1) GIVEN kein User ist eingeloggt (requireAuth() gibt `{ error: "Unauthorized" }`)
   WHEN `createProject({ name: "Test" })` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck OHNE Datenbankzugriff

2) GIVEN kein User ist eingeloggt
   WHEN `getProjects()` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck

3) GIVEN kein User ist eingeloggt
   WHEN `getProject({ id: "any-uuid" })` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck

4) GIVEN kein User ist eingeloggt
   WHEN `renameProject({ id: "any-uuid", name: "New" })` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck

5) GIVEN kein User ist eingeloggt
   WHEN `deleteProject({ id: "any-uuid" })` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck

6) GIVEN kein User ist eingeloggt
   WHEN `generateThumbnail({ projectId: "any-uuid" })` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck

7) GIVEN User A ist eingeloggt mit userId "user-a"
   WHEN `createProject({ name: "Mein Projekt" })` aufgerufen wird
   THEN wird das Projekt mit `userId: "user-a"` in der DB erstellt

8) GIVEN User A ist eingeloggt und hat 2 Projekte; User B hat 3 Projekte
   WHEN User A `getProjects()` aufruft
   THEN erhaelt User A genau seine 2 Projekte (NICHT die von User B)

9) GIVEN User A ist eingeloggt; ein Projekt mit `id: "proj-1"` gehoert User B
   WHEN User A `getProject({ id: "proj-1" })` aufruft
   THEN gibt die Action `{ error: "Projekt nicht gefunden" }` zurueck (Ownership-Check via userId-Filter)

10) GIVEN User A ist eingeloggt; ein Projekt mit `id: "proj-1"` gehoert User B
    WHEN User A `renameProject({ id: "proj-1", name: "Hijacked" })` aufruft
    THEN gibt die Action `{ error: "Projekt nicht gefunden" }` zurueck (kein Rename)

11) GIVEN User A ist eingeloggt; ein Projekt mit `id: "proj-1"` gehoert User B
    WHEN User A `deleteProject({ id: "proj-1" })` aufruft
    THEN wird das Projekt NICHT geloescht; kein Fehler fuer fremde Projekte (stille No-Op oder Not-Found)

12) GIVEN User A ist eingeloggt; ein Projekt mit `id: "proj-1"` gehoert User B
    WHEN User A `generateThumbnail({ projectId: "proj-1" })` aufruft
    THEN gibt die Action `{ error: "Projekt nicht gefunden" }` zurueck

13) GIVEN die Query-Funktionen `createProjectQuery`, `getProjectsQuery`, `getProjectQuery`, `renameProjectQuery`, `deleteProjectQuery` in `queries.ts`
    WHEN ihre Signatur geprueft wird
    THEN akzeptiert jede Funktion einen zusaetzlichen `userId: string` Parameter und filtert/schreibt damit in der `where`-Clause

14) GIVEN `pnpm run build` wird ausgefuehrt
    WHEN alle Aenderungen an `projects.ts` und `queries.ts` angewendet sind
    THEN ist der Build erfolgreich ohne TypeScript-Fehler

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `__tests__/slice-07/projects-auth.test.ts`

<test_spec>
```typescript
// AC-1: createProject ohne Session
it.todo('should return { error: "Unauthorized" } from createProject when no session')

// AC-2: getProjects ohne Session
it.todo('should return { error: "Unauthorized" } from getProjects when no session')

// AC-3: getProject ohne Session
it.todo('should return { error: "Unauthorized" } from getProject when no session')

// AC-4: renameProject ohne Session
it.todo('should return { error: "Unauthorized" } from renameProject when no session')

// AC-5: deleteProject ohne Session
it.todo('should return { error: "Unauthorized" } from deleteProject when no session')

// AC-6: generateThumbnail ohne Session
it.todo('should return { error: "Unauthorized" } from generateThumbnail when no session')

// AC-7: createProject setzt userId
it.todo('should pass userId to createProjectQuery when authenticated')

// AC-8: getProjects filtert nach userId
it.todo('should return only projects belonging to the authenticated user')

// AC-9: getProject gibt Not-Found fuer fremdes Projekt
it.todo('should return { error: "Projekt nicht gefunden" } when accessing another users project')

// AC-10: renameProject verhindert Rename fremder Projekte
it.todo('should return { error: "Projekt nicht gefunden" } when renaming another users project')

// AC-11: deleteProject loescht keine fremden Projekte
it.todo('should not delete a project belonging to another user')

// AC-12: generateThumbnail gibt Not-Found fuer fremdes Projekt
it.todo('should return { error: "Projekt nicht gefunden" } when generating thumbnail for another users project')
```
</test_spec>

### Test-Datei: `__tests__/slice-07/queries-userid.test.ts`

<test_spec>
```typescript
// AC-13: Query-Signaturen mit userId
it.todo('should accept userId parameter in createProjectQuery')
it.todo('should accept userId parameter in getProjectsQuery and filter by userId')
it.todo('should accept userId parameter in getProjectQuery and filter by userId')
it.todo('should accept userId parameter in renameProjectQuery and filter by userId')
it.todo('should accept userId parameter in deleteProjectQuery and filter by userId')

// AC-14: Build-Kompatibilitaet
it.todo('should compile queries.ts without TypeScript errors after userId additions')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-06-auth-guard` | `requireAuth()` | Function | `() => Promise<{ userId: string; email: string } \| { error: string }>` aus `lib/auth/guard.ts` |
| `slice-05-db-userid-migration` | `projects.userId` | Column | UUID FK NOT NULL -- Spalte existiert im Schema und in der DB |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| userId-gefilterte Project-Queries | Functions | slice-08, slice-09 | `getProjectQuery(id: string, userId: string) => Promise<Project>` -- fuer Ownership-Check via projectId |
| Auth-Pattern in Server Actions | Pattern | slice-08, slice-09, slice-10 | `requireAuth()` als erste Zeile, userId an Queries durchreichen |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/actions/projects.ts` -- AENDERUNG: requireAuth() in alle 6 Actions, userId an Query-Funktionen durchreichen
- [ ] `lib/db/queries.ts` -- AENDERUNG: userId-Parameter in 5 Project-Query-Funktionen, userId-Filter in where-Clauses
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an Generation-Queries (getGenerations, createGeneration etc.) -- das ist Slice 08
- KEINE Aenderungen an Prompt/Model/Upload-Actions -- das sind Slices 09, 10
- KEINE Aenderungen an `auth.ts`, `middleware.ts` oder Schema-Dateien
- KEINE Aenderung an nicht-Project-bezogenen Query-Funktionen (Generation-, Reference-, ModelSetting-Queries bleiben unveraendert)
- `updateProjectThumbnail` in queries.ts bekommt KEINEN userId-Parameter -- wird intern von thumbnail-service aufgerufen, nicht direkt aus Server Actions

**Technische Constraints:**
- `requireAuth()` Import aus `lib/auth/guard.ts` (Slice 06)
- Return-Pattern: `{ error: "Unauthorized" }` bei fehlender Session -- konsistent mit bestehendem `{ error: string }` Union-Pattern
- Ownership-Check erfolgt ueber userId-Filter in der DB-Query (nicht per separatem Check) -- "Not found" statt "Forbidden" (kein Informationsleck)
- `createProjectQuery` muss den `userId` in die `values()` aufnehmen (nicht nur in where)
- `deleteProjectQuery` muss nach userId UND id filtern (`and(eq(projects.id, id), eq(projects.userId, userId))`)
- Bestehende Error-Messages beibehalten (z.B. "Projektname darf nicht leer sein", "Datenbankfehler")

**Referenzen:**
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Server Logic" (Auth Guard Pattern, Ownership Check Pattern)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Migration Map" (projects.ts und queries.ts Aenderungen)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Error Handling Strategy" (Unauthenticated + Not Found)
