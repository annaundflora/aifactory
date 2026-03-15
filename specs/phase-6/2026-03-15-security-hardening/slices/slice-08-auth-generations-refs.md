# Slice 08: Server Action Auth - Generations + References

> **Slice 8 von 14** fuer `Security Hardening for Public Deployment`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-08-auth-generations-refs` |
| **Test** | `pnpm vitest run __tests__/slice-08` |
| **E2E** | `false` |
| **Dependencies** | `["slice-07-auth-projects"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm vitest run __tests__/slice-08` |
| **Integration Command** | `pnpm run build` |
| **Acceptance Command** | `pnpm vitest run __tests__/slice-08` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/api/auth/session` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

`requireAuth()` in alle 7 Server Actions in `generations.ts` und alle 5 Server Actions in `references.ts` einbauen. Ownership wird indirekt via Project-Zugehoerigkeit geprueft: vor Zugriff auf Generations/References wird das zugehoerige Projekt per userId-gefilterter Query verifiziert. Ohne gueltige Session gibt jede Action `{ error: "Unauthorized" }` zurueck; bei fremdem Projekt `{ error: "Not found" }`.

---

## Acceptance Criteria

### generations.ts - Auth-Check (kein Login)

1) GIVEN kein User ist eingeloggt
   WHEN `generateImages(input)` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck OHNE weiteren Code auszufuehren

2) GIVEN kein User ist eingeloggt
   WHEN `retryGeneration({ id: "any-uuid" })` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck

3) GIVEN kein User ist eingeloggt
   WHEN `fetchGenerations("any-project-id")` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck (Return-Type aendern zu `Generation[] | { error: string }`)

4) GIVEN kein User ist eingeloggt
   WHEN `upscaleImage(input)` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck

5) GIVEN kein User ist eingeloggt
   WHEN `deleteGeneration({ id: "any-uuid" })` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck (Return-Type aendern zu `{ success: boolean } | { error: string }`)

6) GIVEN kein User ist eingeloggt
   WHEN `getSiblingGenerations("any-batch-id")` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck (Return-Type aendern zu `Generation[] | { error: string }`)

7) GIVEN kein User ist eingeloggt
   WHEN `getVariantFamilyAction(batchId, sourceGenId, currentGenId)` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck (Return-Type aendern zu `Generation[] | { error: string }`)

### generations.ts - Ownership-Check (fremdes Projekt)

8) GIVEN User A ist eingeloggt; Projekt "proj-b" gehoert User B
   WHEN User A `generateImages({ projectId: "proj-b", ... })` aufruft
   THEN gibt die Action `{ error: "Not found" }` zurueck OHNE eine Generation zu starten

9) GIVEN User A ist eingeloggt; Projekt "proj-b" gehoert User B
   WHEN User A `fetchGenerations("proj-b")` aufruft
   THEN gibt die Action `{ error: "Not found" }` zurueck

10) GIVEN User A ist eingeloggt; Projekt "proj-b" gehoert User B
    WHEN User A `upscaleImage({ projectId: "proj-b", ... })` aufruft
    THEN gibt die Action `{ error: "Not found" }` zurueck

11) GIVEN User A ist eingeloggt; Generation "gen-x" gehoert zu Projekt von User B
    WHEN User A `deleteGeneration({ id: "gen-x" })` aufruft
    THEN wird die Generation NICHT geloescht; Action gibt Fehler zurueck

12) GIVEN User A ist eingeloggt; Generation "gen-x" gehoert zu Projekt von User B
    WHEN User A `retryGeneration({ id: "gen-x" })` aufruft
    THEN gibt die Action `{ error: "Not found" }` zurueck

### references.ts - Auth-Check (kein Login)

13) GIVEN kein User ist eingeloggt
    WHEN `uploadReferenceImage(input)` aufgerufen wird
    THEN gibt die Action `{ error: "Unauthorized" }` zurueck

14) GIVEN kein User ist eingeloggt
    WHEN `deleteReferenceImage({ id: "any-uuid" })` aufgerufen wird
    THEN gibt die Action `{ error: "Unauthorized" }` zurueck

15) GIVEN kein User ist eingeloggt
    WHEN `addGalleryAsReference(input)` aufgerufen wird
    THEN gibt die Action `{ error: "Unauthorized" }` zurueck

16) GIVEN kein User ist eingeloggt
    WHEN `getReferenceCount("any-project-id")` aufgerufen wird
    THEN gibt die Action `{ error: "Unauthorized" }` zurueck (Return-Type aendern zu `number | { error: string }`)

17) GIVEN kein User ist eingeloggt
    WHEN `getProvenanceData("any-gen-id")` aufgerufen wird
    THEN gibt die Action `{ error: "Unauthorized" }` zurueck (Return-Type aendern zu `ProvenanceItem[] | { error: string }`)

### references.ts - Ownership-Check (fremdes Projekt)

18) GIVEN User A ist eingeloggt; Projekt "proj-b" gehoert User B
    WHEN User A `uploadReferenceImage({ projectId: "proj-b", ... })` aufruft
    THEN gibt die Action `{ error: "Not found" }` zurueck

19) GIVEN User A ist eingeloggt; Projekt "proj-b" gehoert User B
    WHEN User A `addGalleryAsReference({ projectId: "proj-b", ... })` aufruft
    THEN gibt die Action `{ error: "Not found" }` zurueck

20) GIVEN User A ist eingeloggt; Projekt "proj-b" gehoert User B
    WHEN User A `getReferenceCount("proj-b")` aufruft
    THEN gibt die Action `{ error: "Not found" }` zurueck

### Build

21) GIVEN alle Aenderungen an `generations.ts` und `references.ts` angewendet
    WHEN `pnpm run build` ausgefuehrt wird
    THEN ist der Build erfolgreich ohne TypeScript-Fehler

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `__tests__/slice-08/generations-auth.test.ts`

<test_spec>
```typescript
// AC-1: generateImages ohne Session
it.todo('should return { error: "Unauthorized" } from generateImages when no session')

// AC-2: retryGeneration ohne Session
it.todo('should return { error: "Unauthorized" } from retryGeneration when no session')

// AC-3: fetchGenerations ohne Session
it.todo('should return { error: "Unauthorized" } from fetchGenerations when no session')

// AC-4: upscaleImage ohne Session
it.todo('should return { error: "Unauthorized" } from upscaleImage when no session')

// AC-5: deleteGeneration ohne Session
it.todo('should return { error: "Unauthorized" } from deleteGeneration when no session')

// AC-6: getSiblingGenerations ohne Session
it.todo('should return { error: "Unauthorized" } from getSiblingGenerations when no session')

// AC-7: getVariantFamilyAction ohne Session
it.todo('should return { error: "Unauthorized" } from getVariantFamilyAction when no session')

// AC-8: generateImages mit fremdem Projekt
it.todo('should return { error: "Not found" } from generateImages when project belongs to another user')

// AC-9: fetchGenerations mit fremdem Projekt
it.todo('should return { error: "Not found" } from fetchGenerations when project belongs to another user')

// AC-10: upscaleImage mit fremdem Projekt
it.todo('should return { error: "Not found" } from upscaleImage when project belongs to another user')

// AC-11: deleteGeneration mit Generation aus fremdem Projekt
it.todo('should not delete generation belonging to another users project')

// AC-12: retryGeneration mit Generation aus fremdem Projekt
it.todo('should return { error: "Not found" } from retryGeneration when generation belongs to another users project')
```
</test_spec>

### Test-Datei: `__tests__/slice-08/references-auth.test.ts`

<test_spec>
```typescript
// AC-13: uploadReferenceImage ohne Session
it.todo('should return { error: "Unauthorized" } from uploadReferenceImage when no session')

// AC-14: deleteReferenceImage ohne Session
it.todo('should return { error: "Unauthorized" } from deleteReferenceImage when no session')

// AC-15: addGalleryAsReference ohne Session
it.todo('should return { error: "Unauthorized" } from addGalleryAsReference when no session')

// AC-16: getReferenceCount ohne Session
it.todo('should return { error: "Unauthorized" } from getReferenceCount when no session')

// AC-17: getProvenanceData ohne Session
it.todo('should return { error: "Unauthorized" } from getProvenanceData when no session')

// AC-18: uploadReferenceImage mit fremdem Projekt
it.todo('should return { error: "Not found" } from uploadReferenceImage when project belongs to another user')

// AC-19: addGalleryAsReference mit fremdem Projekt
it.todo('should return { error: "Not found" } from addGalleryAsReference when project belongs to another user')

// AC-20: getReferenceCount mit fremdem Projekt
it.todo('should return { error: "Not found" } from getReferenceCount when project belongs to another user')
```
</test_spec>

### Test-Datei: `__tests__/slice-08/build-check.test.ts`

<test_spec>
```typescript
// AC-21: Build-Kompatibilitaet
it.todo('should compile generations.ts and references.ts without TypeScript errors after auth additions')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-06-auth-guard` | `requireAuth()` | Function | `() => Promise<{ userId: string; email: string } \| { error: string }>` aus `lib/auth/guard.ts` |
| `slice-07-auth-projects` | `getProjectQuery(id, userId)` | Function | userId-gefilterte Project-Query fuer Ownership-Check -- gibt `undefined`/`null` wenn Projekt nicht dem User gehoert |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Auth-gesicherte Generation-Actions | Functions | UI-Komponenten | Bestehende Signaturen + `{ error: "Unauthorized" }` im Union-Return |
| Auth-gesicherte Reference-Actions | Functions | UI-Komponenten | Bestehende Signaturen + `{ error: "Unauthorized" }` im Union-Return |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/actions/generations.ts` -- AENDERUNG: requireAuth() in alle 7 Actions, Ownership-Check via Project-Zugehoerigkeit fuer projectId-basierte Actions, Generation-zu-Projekt-Lookup fuer id-basierte Actions
- [ ] `app/actions/references.ts` -- AENDERUNG: requireAuth() in alle 5 Actions, Ownership-Check via Project-Zugehoerigkeit fuer projectId-basierte Actions
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an `queries.ts` -- Generation/Reference-Queries bleiben unveraendert (Ownership ueber Project-Lookup, nicht ueber userId-Spalte auf generations)
- KEINE Aenderungen an `projects.ts`, `prompts.ts`, `models.ts`, `upload.ts` -- andere Slices
- KEINE Aenderungen an `auth.ts`, `middleware.ts` oder Schema-Dateien
- KEINE neuen Query-Funktionen -- bestehende Queries + Project-Ownership-Check reicht

**Technische Constraints:**
- `requireAuth()` Import aus `lib/auth/guard.ts` (Slice 06)
- Ownership-Check fuer Actions mit `projectId`: Project per `getProjectQuery(projectId, userId)` laden (Slice 07). Null-Result = `{ error: "Not found" }`
- Ownership-Check fuer Actions mit nur `id` (retryGeneration, deleteGeneration): Generation laden, dann zugehoeriges Projekt per userId pruefen
- Indirekte Ownership: `generations` und `reference_images` erben Ownership via `projectId` -> `projects.userId` (siehe architecture.md -> "Ownership Check Pattern")
- Return-Types muessen erweitert werden wo bisher kein `{ error: string }` im Union war (fetchGenerations, getSiblingGenerations, getVariantFamilyAction, deleteGeneration, getReferenceCount, getProvenanceData)
- `getSiblingGenerations` und `getVariantFamilyAction` haben keinen projectId-Parameter -- Auth-Check reicht, kein Ownership-Check noetig (Daten sind nicht sensitiv genug fuer Cross-Project-Isolation auf Batch-Ebene, aber Auth ist Pflicht)
- Bestehende Validierungen und Error-Messages beibehalten

**Referenzen:**
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Server Logic" (Ownership Check Pattern: indirekte Ownership via projectId)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Migration Map" (generations.ts und references.ts Aenderungen)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Error Handling Strategy" (Unauthenticated + Not Found)
