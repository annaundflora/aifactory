# Slice 09: Server Action Auth - Prompts + Models + Model-Settings

> **Slice 9 von 14** fuer `Security Hardening for Public Deployment`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-09-auth-prompts-models` |
| **Test** | `pnpm vitest run __tests__/slice-09` |
| **E2E** | `false` |
| **Dependencies** | `["slice-07-auth-projects"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm vitest run __tests__/slice-09` |
| **Integration Command** | `pnpm run build` |
| **Acceptance Command** | `pnpm vitest run __tests__/slice-09` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/api/auth/session` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

`requireAuth()` in alle 9 Server Actions in `prompts.ts` (4 Actions), `models.ts` (3 Actions) und `model-settings.ts` (2 Actions) einbauen. Ohne gueltige Session geben alle Actions `{ error: "Unauthorized" }` zurueck und fuehren keine Business-Logik aus.

---

## Acceptance Criteria

### prompts.ts (4 Actions)

1) GIVEN kein User ist eingeloggt
   WHEN `getPromptHistory({ offset: 0, limit: 50 })` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck OHNE Aufruf von `promptHistoryService`

2) GIVEN kein User ist eingeloggt
   WHEN `getFavoritePrompts({ offset: 0, limit: 50 })` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck

3) GIVEN kein User ist eingeloggt
   WHEN `toggleFavorite({ generationId: "any-uuid" })` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck OHNE DB-Mutation

4) GIVEN kein User ist eingeloggt
   WHEN `improvePrompt({ prompt: "a cat", modelId: "stability/sdxl" })` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck OHNE API-Aufruf an PromptService

### models.ts (3 Actions)

5) GIVEN kein User ist eingeloggt
   WHEN `getCollectionModels()` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck OHNE Replicate-API-Aufruf

6) GIVEN kein User ist eingeloggt
   WHEN `checkImg2ImgSupport({ modelId: "owner/model" })` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck (statt `false`)

7) GIVEN kein User ist eingeloggt
   WHEN `getModelSchema({ modelId: "owner/model" })` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck

### model-settings.ts (2 Actions)

8) GIVEN kein User ist eingeloggt
   WHEN `getModelSettings()` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck

9) GIVEN kein User ist eingeloggt
   WHEN `updateModelSetting({ mode: "generate", tier: "fast", modelId: "owner/model" })` aufgerufen wird
   THEN gibt die Action `{ error: "Unauthorized" }` zurueck OHNE DB-Mutation

### Positive Cases (Auth vorhanden)

10) GIVEN User ist eingeloggt mit gueltiger Session
    WHEN `getPromptHistory({ offset: 0, limit: 10 })` aufgerufen wird
    THEN wird `promptHistoryService.getHistory()` aufgerufen und das Ergebnis zurueckgegeben (bestehende Logik unveraendert)

11) GIVEN User ist eingeloggt mit gueltiger Session
    WHEN `getCollectionModels()` aufgerufen wird
    THEN wird `CollectionModelService.getCollectionModels()` aufgerufen und das Ergebnis zurueckgegeben

12) GIVEN User ist eingeloggt mit gueltiger Session
    WHEN `updateModelSetting({ mode: "generate", tier: "fast", modelId: "owner/model" })` aufgerufen wird
    THEN wird Validation + `ModelSettingsService.update()` ausgefuehrt (bestehende Logik unveraendert)

### Build

13) GIVEN `pnpm run build` wird ausgefuehrt
    WHEN alle Aenderungen an `prompts.ts`, `models.ts` und `model-settings.ts` angewendet sind
    THEN ist der Build erfolgreich ohne TypeScript-Fehler

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `__tests__/slice-09/prompts-auth.test.ts`

<test_spec>
```typescript
// AC-1: getPromptHistory ohne Session
it.todo('should return { error: "Unauthorized" } from getPromptHistory when no session')

// AC-2: getFavoritePrompts ohne Session
it.todo('should return { error: "Unauthorized" } from getFavoritePrompts when no session')

// AC-3: toggleFavorite ohne Session
it.todo('should return { error: "Unauthorized" } from toggleFavorite when no session')

// AC-4: improvePrompt ohne Session
it.todo('should return { error: "Unauthorized" } from improvePrompt when no session')

// AC-10: getPromptHistory mit Session
it.todo('should call promptHistoryService.getHistory when authenticated')
```
</test_spec>

### Test-Datei: `__tests__/slice-09/models-auth.test.ts`

<test_spec>
```typescript
// AC-5: getCollectionModels ohne Session
it.todo('should return { error: "Unauthorized" } from getCollectionModels when no session')

// AC-6: checkImg2ImgSupport ohne Session
it.todo('should return { error: "Unauthorized" } from checkImg2ImgSupport when no session')

// AC-7: getModelSchema ohne Session
it.todo('should return { error: "Unauthorized" } from getModelSchema when no session')

// AC-11: getCollectionModels mit Session
it.todo('should call CollectionModelService.getCollectionModels when authenticated')
```
</test_spec>

### Test-Datei: `__tests__/slice-09/model-settings-auth.test.ts`

<test_spec>
```typescript
// AC-8: getModelSettings ohne Session
it.todo('should return { error: "Unauthorized" } from getModelSettings when no session')

// AC-9: updateModelSetting ohne Session
it.todo('should return { error: "Unauthorized" } from updateModelSetting when no session')

// AC-12: updateModelSetting mit Session
it.todo('should execute validation and ModelSettingsService.update when authenticated')
```
</test_spec>

### Test-Datei: `__tests__/slice-09/build.test.ts`

<test_spec>
```typescript
// AC-13: Build-Kompatibilitaet
it.todo('should build without TypeScript errors after auth changes to prompts.ts, models.ts, model-settings.ts')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-06-auth-guard` | `requireAuth()` | Function | `() => Promise<{ userId: string; email: string } \| { error: string }>` aus `lib/auth/guard.ts` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Auth-geschuetzte Prompt-Actions | Functions | -- (Endpunkt, keine Consumer-Slices) | Bestehende Signaturen + `{ error: "Unauthorized" }` im Return-Union |
| Auth-geschuetzte Model-Actions | Functions | -- (Endpunkt) | Bestehende Signaturen + `{ error: "Unauthorized" }` im Return-Union |
| Auth-geschuetzte ModelSetting-Actions | Functions | -- (Endpunkt) | Bestehende Signaturen + `{ error: "Unauthorized" }` im Return-Union |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/actions/prompts.ts` -- AENDERUNG: requireAuth() in alle 4 Actions einbauen
- [ ] `app/actions/models.ts` -- AENDERUNG: requireAuth() in alle 3 Actions einbauen
- [ ] `app/actions/model-settings.ts` -- AENDERUNG: requireAuth() in beide Actions einbauen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an Service-Klassen (PromptService, promptHistoryService, CollectionModelService, ModelSchemaService, ModelSettingsService)
- KEINE Aenderungen an `lib/db/queries.ts` -- dieser Slice aendert keine DB-Queries
- KEINE Aenderungen an `auth.ts`, `middleware.ts` oder Schema-Dateien
- KEINE Ownership-Checks ueber projectId -- die Actions in diesem Slice arbeiten nicht direkt mit Project-Ownership (im Gegensatz zu Slice 07/08)
- KEINE Aenderungen an `app/actions/generations.ts` oder `app/actions/references.ts` (Slice 08)
- KEINE Aenderungen an `app/actions/upload.ts` (Slice 10)
- `checkImg2ImgSupport` Return-Type muss von `Promise<boolean>` zu `Promise<boolean | { error: string }>` geaendert werden (Union-Erweiterung fuer Auth-Error)

**Technische Constraints:**
- `requireAuth()` Import aus `lib/auth/guard.ts` (Slice 06)
- Auth-Check ist die ERSTE Pruefung in jeder Action -- VOR jeder Validierung oder Business-Logik
- Return-Pattern: `{ error: "Unauthorized" }` bei fehlender Session -- konsistent mit bestehendem `{ error: string }` Union-Pattern
- Bestehende Error-Messages und Validierungslogik bleiben vollstaendig erhalten
- Bestehende Return-Types werden um `{ error: string }` erweitert wo noetig (z.B. `getPromptHistory` gibt aktuell `PromptHistoryEntry[]` zurueck, muss zu `PromptHistoryEntry[] | { error: string }` werden)

**Referenzen:**
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Server Logic" (Auth Guard Pattern)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Migration Map" (prompts.ts, models.ts Aenderungen)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Error Handling Strategy" (Unauthenticated Server Action)
