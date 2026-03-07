# Slice 11: Prompt History Service & Actions

> **Slice 11 von 21** fuer `quality-improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-11-prompt-history-service` |
| **Test** | `pnpm test lib/services/__tests__/prompt-history-service.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-db-schema-generations"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/services/__tests__/prompt-history-service.test.ts` |
| **Integration Command** | `pnpm test app/actions/__tests__/prompts-history.test.ts` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `--` |
| **Mocking Strategy** | `mock_external` (DB-Queries mocken) |

---

## Ziel

Einen `prompt-history-service.ts` erstellen, der paginierte Prompt-History und Favoriten aus der `generations`-Tabelle laedt sowie den Favoriten-Status toggled. Drei Server Actions (`getPromptHistory`, `getFavoritePrompts`, `toggleFavorite`) in `app/actions/prompts.ts` hinzufuegen, die den Service aufrufen. Die benoetigten DB-Queries werden in `lib/db/queries.ts` ergaenzt.

---

## Acceptance Criteria

1. GIVEN die `generations`-Tabelle mit 5 Eintraegen, davon 3 mit unterschiedlichen `(prompt_motiv, prompt_style, negative_prompt, model_id)`-Kombinationen
   WHEN `getHistory(0, 50)` aufgerufen wird
   THEN werden genau 3 Eintraege zurueckgegeben (DISTINCT ON unique prompt-Kombinationen), sortiert nach `created_at DESC`

2. GIVEN die `generations`-Tabelle mit 60 Eintraegen (alle unique)
   WHEN `getHistory(0, 50)` aufgerufen wird
   THEN werden genau 50 Eintraege zurueckgegeben (Limit greift)

3. GIVEN die `generations`-Tabelle mit 60 Eintraegen
   WHEN `getHistory(50, 50)` aufgerufen wird
   THEN werden genau 10 Eintraege zurueckgegeben (Offset + Limit Pagination)

4. GIVEN die `generations`-Tabelle mit 5 Eintraegen, davon 2 mit `is_favorite = true`
   WHEN `getFavorites(0, 50)` aufgerufen wird
   THEN werden genau 2 Eintraege zurueckgegeben, alle mit `isFavorite: true`

5. GIVEN eine Generation mit `id = "gen-uuid-1"` und `is_favorite = false`
   WHEN `toggleFavorite("gen-uuid-1")` aufgerufen wird
   THEN wird `{ isFavorite: true }` zurueckgegeben und der DB-Wert ist `true`

6. GIVEN eine Generation mit `id = "gen-uuid-2"` und `is_favorite = true`
   WHEN `toggleFavorite("gen-uuid-2")` aufgerufen wird
   THEN wird `{ isFavorite: false }` zurueckgegeben und der DB-Wert ist `false`

7. GIVEN eine nicht existierende `generationId = "non-existent"`
   WHEN `toggleFavorite("non-existent")` aufgerufen wird
   THEN wird ein Fehler geworfen (z.B. "Generation not found")

8. GIVEN der Service ist korrekt implementiert
   WHEN `getHistory` oder `getFavorites` aufgerufen wird
   THEN entspricht jeder Eintrag im Ergebnis dem `PromptHistoryEntry`-Typ gemaess architecture.md Section "PromptHistoryEntry Type"

9. GIVEN die Server Action `getPromptHistory` in `app/actions/prompts.ts`
   WHEN mit `{ offset: 0, limit: 20 }` aufgerufen
   THEN delegiert sie an `promptHistoryService.getHistory(0, 20)` und gibt das Ergebnis zurueck

10. GIVEN die Server Action `toggleFavorite` in `app/actions/prompts.ts`
    WHEN mit `{ generationId: "valid-uuid" }` aufgerufen
    THEN delegiert sie an `promptHistoryService.toggleFavorite("valid-uuid")` und gibt `{ isFavorite: boolean }` zurueck

11. GIVEN die Server Action `toggleFavorite` in `app/actions/prompts.ts`
    WHEN mit einer ungueltige `generationId` (kein UUID-Format) aufgerufen
    THEN wird ein Validierungsfehler zurueckgegeben, bevor der Service aufgerufen wird

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/services/__tests__/prompt-history-service.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('PromptHistoryService', () => {
  describe('getHistory', () => {
    // AC-1: DISTINCT ON unique prompt-Kombinationen
    it.todo('should return distinct prompt combinations sorted by created_at DESC')

    // AC-2: Limit greift bei mehr Eintraegen
    it.todo('should respect limit parameter and return at most N entries')

    // AC-3: Offset + Limit Pagination
    it.todo('should skip entries according to offset parameter')

    // AC-8: PromptHistoryEntry Typ
    it.todo('should return entries matching PromptHistoryEntry shape')
  })

  describe('getFavorites', () => {
    // AC-4: Nur Favoriten zurueckgeben
    it.todo('should return only entries with isFavorite true')
  })

  describe('toggleFavorite', () => {
    // AC-5: false -> true
    it.todo('should toggle isFavorite from false to true')

    // AC-6: true -> false
    it.todo('should toggle isFavorite from true to false')

    // AC-7: Nicht existierende Generation
    it.todo('should throw error for non-existent generationId')
  })
})
```
</test_spec>

### Test-Datei: `app/actions/__tests__/prompts-history.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Prompt History Actions', () => {
  // AC-9: getPromptHistory delegiert an Service
  it.todo('should delegate getPromptHistory to promptHistoryService.getHistory')

  // AC-10: toggleFavorite delegiert an Service
  it.todo('should delegate toggleFavorite to promptHistoryService.toggleFavorite')

  // AC-11: Validierung bei ungueltiger generationId
  it.todo('should reject toggleFavorite with invalid UUID format')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-db-schema-generations` | `generations.promptMotiv` | Schema Column | Spalte existiert im Schema |
| `slice-01-db-schema-generations` | `generations.promptStyle` | Schema Column | Spalte existiert im Schema |
| `slice-01-db-schema-generations` | `generations.isFavorite` | Schema Column | Spalte existiert im Schema |
| `slice-01-db-schema-generations` | `generations_is_favorite_idx` | Index | Index existiert fuer performante Abfragen |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `getHistory(offset, limit)` | Service Function | UI-Slices (History-Tab) | `(offset: number, limit: number) => Promise<PromptHistoryEntry[]>` |
| `getFavorites(offset, limit)` | Service Function | UI-Slices (Favoriten-Tab) | `(offset: number, limit: number) => Promise<PromptHistoryEntry[]>` |
| `toggleFavorite(generationId)` | Service Function | UI-Slices (Stern-Toggle) | `(generationId: string) => Promise<{ isFavorite: boolean }>` |
| `getPromptHistory` | Server Action | UI-Slices | `(input: { offset?: number, limit?: number }) => Promise<PromptHistoryEntry[]>` |
| `getFavoritePrompts` | Server Action | UI-Slices | `(input: { offset?: number, limit?: number }) => Promise<PromptHistoryEntry[]>` |
| `toggleFavorite` | Server Action | UI-Slices | `(input: { generationId: string }) => Promise<{ isFavorite: boolean }>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/prompt-history-service.ts` -- Neuer Service mit `getHistory`, `getFavorites`, `toggleFavorite`
- [ ] `lib/db/queries.ts` -- 3 neue Query-Funktionen: `getPromptHistory`, `getFavorites`, `toggleFavorite`
- [ ] `app/actions/prompts.ts` -- 3 neue Server Actions: `getPromptHistory`, `getFavoritePrompts`, `toggleFavorite`
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE UI-Komponenten (History-Tab, Favoriten-Tab, Stern-Toggle gehoeren zu einem UI-Slice)
- KEINE Schema-Aenderungen (bereits in Slice 01 erledigt)
- KEINE Migration (separater Slice)
- KEIN Caching oder Optimistic Updates (UI-Concern)

**Technische Constraints:**
- Drizzle ORM fuer alle DB-Queries verwenden (kein raw SQL)
- DISTINCT ON Query fuer History: gruppiert nach `(prompt_motiv, prompt_style, negative_prompt, model_id)`, neuester Eintrag pro Gruppe
- History ist projektuebergreifend (KEIN `project_id` Filter)
- Server Actions mit `'use server'` Direktive
- Input-Validierung in Actions: `generationId` muss gueltiges UUID-Format sein
- Bestehende Actions in `app/actions/prompts.ts` (z.B. `improvePrompt`) duerfen NICHT veraendert werden

**Referenzen:**
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` -- Section "API Design (Server Actions)" fuer Action-Signaturen und `PromptHistoryEntry` Type
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` -- Section "Data Flow: Prompt History" fuer DISTINCT ON Query-Logik
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` -- Section "New Services" fuer Service-Methoden
