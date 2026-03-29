# Slice 02: DB Queries & Prompt History Service

> **Slice 2 von 11** fuer `Prompt-Felder Vereinfachung`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-02-db-queries-prompt-history` |
| **Test** | `pnpm test lib/db/__tests__/queries-batch lib/services/__tests__/prompt-history-service` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-db-schema-migration"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/db/__tests__/queries-batch lib/services/__tests__/prompt-history-service` |
| **Integration Command** | `pnpm test lib/db/__tests__/schema-generations lib/db/__tests__/schema` |
| **Acceptance Command** | `npx tsc --noEmit` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Alle Drizzle-Queries und den Prompt-History-Service von den entfernten Spalten `promptStyle` und `negativePrompt` bereinigen. Damit kompiliert die gesamte DB-Schicht fehlerfrei gegen das bereinigte Schema aus Slice 01 und nachfolgende Slices (04, 06, 08) koennen auf konsistente Query-Interfaces aufbauen.

---

## Acceptance Criteria

1) GIVEN das bereinigte Schema aus Slice 01 (ohne `promptStyle`/`negativePrompt`)
   WHEN das Interface `CreateGenerationInput` in `queries.ts` geprueft wird
   THEN enthaelt es KEINE Properties `promptStyle`, `negativePrompt` oder `promptStyle?`
   AND der `createGeneration`-Insert referenziert KEINE der entfernten Spalten

2) GIVEN das bereinigte Schema aus Slice 01
   WHEN `getPromptHistoryQuery` ausgefuehrt wird
   THEN verwendet die SQL-Query `DISTINCT ON (g.prompt_motiv, g.model_id)` (nur 2 Felder statt 4)
   AND die SELECT-Clause enthaelt KEINE Spalten `prompt_style` oder `negative_prompt`
   AND die ORDER BY-Clause im DISTINCT ON-Subquery enthaelt nur `g.prompt_motiv, g.model_id`

3) GIVEN das bereinigte Schema aus Slice 01
   WHEN `getFavoritesQuery` ausgefuehrt wird
   THEN enthaelt der `.select()`-Aufruf KEINE Referenzen auf `generations.promptStyle` oder `generations.negativePrompt`
   AND das Ergebnis hat weiterhin die Felder `id`, `promptMotiv`, `modelId`, `modelParams`, `isFavorite`, `createdAt`

4) GIVEN das bereinigte Schema aus Slice 01
   WHEN der Typ `PromptHistoryRow` in `queries.ts` geprueft wird
   THEN enthaelt er KEINE Properties `promptStyle` oder `negativePrompt`
   AND enthaelt weiterhin `id`, `promptMotiv`, `modelId`, `modelParams`, `isFavorite`, `createdAt`

5) GIVEN die bereinigten Queries aus AC-1 bis AC-4
   WHEN das Interface `PromptHistoryEntry` in `prompt-history-service.ts` geprueft wird
   THEN enthaelt es KEINE Properties `promptStyle` oder `negativePrompt`
   AND die Mapping-Funktionen in `getHistory()` und `getFavorites()` referenzieren KEINE `row.promptStyle` oder `row.negativePrompt`

6) GIVEN alle Aenderungen aus AC-1 bis AC-5
   WHEN `npx tsc --noEmit` ausgefuehrt wird
   THEN meldet der TypeScript-Compiler 0 Fehler in `lib/db/queries.ts` und `lib/services/prompt-history-service.ts`

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.

### Test-Datei: `lib/db/__tests__/queries-prompt-removal.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('queries - prompt field removal', () => {
  // AC-1: CreateGenerationInput hat kein promptStyle/negativePrompt
  it.todo('should not include promptStyle in CreateGenerationInput')

  // AC-1: createGeneration Insert ohne entfernte Spalten
  it.todo('should not include negativePrompt in CreateGenerationInput')

  // AC-2: getPromptHistoryQuery DISTINCT ON nur prompt_motiv + model_id
  it.todo('should use DISTINCT ON with only prompt_motiv and model_id')

  // AC-2: getPromptHistoryQuery SELECT ohne entfernte Spalten
  it.todo('should not select prompt_style or negative_prompt in history query')

  // AC-3: getFavoritesQuery Select ohne entfernte Spalten
  it.todo('should not reference promptStyle or negativePrompt in favorites select')

  // AC-4: PromptHistoryRow Typ ohne entfernte Properties
  it.todo('should not include promptStyle or negativePrompt in PromptHistoryRow type')
})
```
</test_spec>

### Test-Datei: `lib/services/__tests__/prompt-history-service-removal.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('prompt-history-service - field removal', () => {
  // AC-5: PromptHistoryEntry Interface ohne promptStyle/negativePrompt
  it.todo('should not include promptStyle in PromptHistoryEntry')

  // AC-5: PromptHistoryEntry Interface ohne negativePrompt
  it.todo('should not include negativePrompt in PromptHistoryEntry')

  // AC-5: getHistory Mapping ohne entfernte Felder
  it.todo('should map history rows without promptStyle or negativePrompt')

  // AC-5: getFavorites Mapping ohne entfernte Felder
  it.todo('should map favorite rows without promptStyle or negativePrompt')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-db-schema-migration` | `generations` Schema ohne `promptStyle`/`negativePrompt` | Drizzle Table | `typeof generations.$inferSelect` hat keine entfernten Properties |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `createGeneration(input)` | Function | slice-04 | `CreateGenerationInput` ohne `promptStyle`/`negativePrompt` |
| `getPromptHistoryQuery(userId, offset, limit)` | Function | slice-06 | Liefert `PromptHistoryRow[]` ohne `promptStyle`/`negativePrompt` |
| `getFavoritesQuery(userId, offset, limit)` | Function | slice-06 | Liefert `PromptHistoryRow[]` ohne `promptStyle`/`negativePrompt` |
| `PromptHistoryEntry` | Interface | slice-06 | Ohne `promptStyle`/`negativePrompt` Properties |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/db/queries.ts` -- `CreateGenerationInput`, `PromptHistoryRow`, `createGeneration`, `getPromptHistoryQuery`, `getFavoritesQuery` bereinigen
- [ ] `lib/services/prompt-history-service.ts` -- `PromptHistoryEntry` Interface und Mapping in `getHistory`/`getFavorites` bereinigen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an `lib/db/schema.ts` (Slice 01)
- KEINE Aenderungen an `lib/services/generation-service.ts` (Slice 04)
- KEINE Aenderungen an `app/actions/generations.ts` (Slice 04)
- KEINE Aenderungen an UI-Komponenten (Slices 05-07)
- `getSiblingsByBatchId` braucht KEINE manuelle Aenderung (verwendet `.select()` ohne explizite Spalten -- passt sich automatisch an)
- `toggleFavoriteQuery` braucht KEINE Aenderung (referenziert nur `isFavorite`)

**Technische Constraints:**
- Drizzle ORM fuer `getFavoritesQuery` (typisierter `.select()`)
- Raw SQL fuer `getPromptHistoryQuery` (Drizzle unterstuetzt kein `DISTINCT ON`)
- TypeScript strict mode -- alle Typ-Aenderungen muessen konsistent sein

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "Database Schema > Query Changes"
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "Server Logic > Services & Processing" (promptHistoryService)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/db/queries.ts` | MODIFY -- Interface, Typ und 3 Funktionen bereinigen (Zeilen 70-82, 269-278, 289-311, 317-340) |
| `lib/services/prompt-history-service.ts` | MODIFY -- Interface und 2 Mapping-Funktionen bereinigen (Zeilen 7-16, 24-33, 42-51) |
