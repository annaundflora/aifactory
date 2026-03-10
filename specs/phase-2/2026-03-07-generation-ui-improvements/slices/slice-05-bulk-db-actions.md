# Slice 05: Bulk DB Queries + Server Actions

> **Slice 05 von 5** für `Generation UI Improvements`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-05-bulk-db-actions` |
| **Test** | `pnpm test lib/db/queries.test.ts app/actions/generations.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test {path}` |
| **Integration Command** | `pnpm test {path} --reporter=verbose` |
| **Acceptance Command** | `pnpm test {path}` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` — Drizzle DB via vi.mock |

---

## Ziel

Vier neue Batch-Query-Funktionen in `lib/db/queries.ts` und die korrespondierenden Server Actions in `app/actions/generations.ts` implementieren, um Bulk-Move, Bulk-Delete und Bulk-Favorite-Toggle zu ermöglichen. Dieser Slice stellt die Daten-Schicht bereit, auf die alle späteren UI-Slices (Floating Action Bar, Lightbox-Move) aufbauen.

---

## Acceptance Criteria

1. **moveGeneration — Einzelbild verschieben**
   GIVEN eine gültige `id` (UUID) und ein gültiges `targetProjectId` (UUID), das auf ein existierendes, anderes Projekt zeigt
   WHEN `moveGeneration({ id, targetProjectId })` aufgerufen wird
   THEN gibt die Action `{ success: true }` zurück, `generations.projectId` ist in der DB auf `targetProjectId` gesetzt, und `revalidatePath("/")` wurde aufgerufen

2. **moveGenerations — Bulk-Move**
   GIVEN ein Array von gültigen UUIDs (`ids`, max 100) und ein gültiges `targetProjectId`
   WHEN `moveGenerations({ ids, targetProjectId })` aufgerufen wird
   THEN gibt die Action `{ success: true, count: N }` zurück, wobei `N` der Anzahl der aktualisierten Einträge entspricht

3. **deleteGenerations — Bulk-Delete**
   GIVEN ein Array von gültigen UUIDs (`ids`, max 100)
   WHEN `deleteGenerations({ ids })` aufgerufen wird
   THEN gibt die Action `{ success: true, count: N }` zurück, alle N DB-Records sind gelöscht, die zugehörigen `imageUrl`-Werte werden für R2-Cleanup (fire-and-forget) zurückgegeben

4. **toggleFavorites — Bulk-Favorite**
   GIVEN ein Array von gültigen UUIDs (`ids`) und ein Boolean `favorite`
   WHEN `toggleFavorites({ ids, favorite })` aufgerufen wird
   THEN gibt die Action `{ success: true }` zurück, `isFavorite` aller betroffenen Generierungen ist auf `favorite` gesetzt

5. **Ungültige UUID — Validierungsfehler**
   GIVEN eine `ids`-Liste, die mindestens eine ungültige UUID enthält (z.B. `"not-a-uuid"`)
   WHEN eine der Bulk-Actions aufgerufen wird
   THEN gibt die Action `{ error: string }` zurück, ohne DB-Operationen auszuführen

6. **Leeres Array — Validierungsfehler**
   GIVEN ein leeres Array `ids: []`
   WHEN eine der Bulk-Actions aufgerufen wird
   THEN gibt die Action `{ error: string }` zurück

7. **Limit überschritten — Validierungsfehler**
   GIVEN ein Array mit mehr als 100 UUIDs
   WHEN `moveGenerations`, `deleteGenerations` oder `toggleFavorites` aufgerufen wird
   THEN gibt die Action `{ error: "Zu viele Bilder ausgewählt" }` zurück

8. **moveGeneration — Gleiches Projekt**
   GIVEN eine `id` und ein `targetProjectId`, das dem aktuellen `projectId` der Generation entspricht
   WHEN `moveGeneration({ id, targetProjectId })` aufgerufen wird
   THEN gibt die Action `{ error: string }` zurück

9. **DB-Fehler — Error-Response**
   GIVEN die DB wirft einen Fehler beim Ausführen der Batch-Query
   WHEN eine der Bulk-Actions aufgerufen wird
   THEN gibt die Action `{ error: "Datenbankfehler" }` zurück und loggt den Fehler via `console.error`

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstständig.

### Test-Datei: `lib/db/__tests__/bulk-queries.test.ts`

<test_spec>
```typescript
// AC-1: moveGeneration Query — DB-Update für einzelne Generation
it.todo('should update projectId for single generation')

// AC-2: moveGenerations Query — Batch-UPDATE für N Generierungen
it.todo('should batch update projectId and return count')

// AC-3: deleteGenerations Query — Batch-DELETE und Rückgabe gelöschter Einträge
it.todo('should batch delete generations and return deleted records with imageUrl')

// AC-4: toggleFavoritesQuery — Batch-UPDATE isFavorite
it.todo('should batch set isFavorite to given boolean value')
```
</test_spec>

### Test-Datei: `app/actions/__tests__/generations-bulk.test.ts`

<test_spec>
```typescript
// AC-1: moveGeneration Action — Erfolgsfall
it.todo('should return { success: true } and call revalidatePath')

// AC-2: moveGenerations Action — Erfolgsfall mit count
it.todo('should return { success: true, count: N }')

// AC-3: deleteGenerations Action — Erfolgsfall mit count
it.todo('should return { success: true, count: N } and trigger R2 cleanup')

// AC-4: toggleFavorites Action — Erfolgsfall
it.todo('should return { success: true }')

// AC-5: Ungültige UUID in ids-Array
it.todo('should return { error: string } without calling DB')

// AC-6: Leeres ids-Array
it.todo('should return { error: string } for empty ids array')

// AC-7: Limit überschritten (> 100)
it.todo('should return { error: "Zu viele Bilder ausgewählt" }')

// AC-8: moveGeneration — Ziel = aktuelles Projekt
it.todo('should return { error: string } when targetProjectId equals current projectId')

// AC-9: DB-Fehler
it.todo('should return { error: "Datenbankfehler" } and call console.error on DB failure')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| — | Kein vorheriger Slice benötigt | — | Bestehende DB-Infrastruktur (`lib/db/index.ts`, `lib/db/schema.ts`) vorhanden |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `moveGeneration` | Server Action | Slice 03 (Lightbox-Move) | `(input: { id: string, targetProjectId: string }) => Promise<{ success: boolean } \| { error: string }>` |
| `moveGenerations` | Server Action | Slice 04 (Floating Action Bar) | `(input: { ids: string[], targetProjectId: string }) => Promise<{ success: boolean, count: number } \| { error: string }>` |
| `deleteGenerations` | Server Action | Slice 04 (Floating Action Bar) | `(input: { ids: string[] }) => Promise<{ success: boolean, count: number } \| { error: string }>` |
| `toggleFavorites` | Server Action | Slice 04 (Floating Action Bar) | `(input: { ids: string[], favorite: boolean }) => Promise<{ success: boolean } \| { error: string }>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/db/queries.ts` — 4 neue Query-Funktionen: `moveGenerationQuery`, `moveGenerationsQuery`, `deleteGenerationsQuery`, `toggleFavoritesQuery` mit Drizzle `inArray()`
- [ ] `app/actions/generations.ts` — 4 neue Server Actions: `moveGeneration`, `moveGenerations`, `deleteGenerations`, `toggleFavorites` mit UUID-Validierung, Limit-Check und `revalidatePath("/")`
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Kein R2-Delete in diesem Slice (fire-and-forget R2-Cleanup gehört in `deleteGenerations` Action, aber die R2-Aufrufe werden nur angestoßen, nicht blockierend abgewartet)
- Keine ZIP-Download-Route (`/api/download-zip`) — separater Slice
- Keine UI-Komponenten
- `moveGeneration` (Einzel) und `moveGenerations` (Bulk) sind getrennte Actions

**Technische Constraints:**
- Drizzle ORM `inArray()` für alle Batch-Queries (kein raw SQL, keine N einzelnen Queries)
- UUID-Validierung per Regex vor jeder DB-Operation (verhindert SQL-Injection-Versuche, kein extra Lib-Import nötig)
- `revalidatePath("/")` am Ende jeder erfolgreichen Action
- Error-Return-Pattern: `{ error: string }` (kein `throw`), konsistent mit bestehendem Pattern in `app/actions/generations.ts`
- R2-Cleanup in `deleteGenerations`: `imageUrl`-Extraktion und `StorageService.delete()` fire-and-forget, identisch zum bestehenden Einzel-Delete-Pattern (Zeile 127–139 in `app/actions/generations.ts`)
- Max 100 IDs für Mutations (architecture.md → API Design → DTOs)

**Referenzen:**
- Architecture: `specs/phase-2/2026-03-07-generation-ui-improvements/architecture.md` → API Design (Server Actions), Validation Rules, Error Handling Strategy
- Bestehende Patterns: `app/actions/generations.ts` Zeilen 110–149 (deleteGeneration), `lib/db/queries.ts` (Drizzle-Patterns)
