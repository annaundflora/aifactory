# Slice 03: Test-Infrastruktur -- Mock-Daten bereinigen

> **Slice 3 von 11** fuer `Prompt-Felder Vereinfachung`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-03-test-infra-mocks` |
| **Test** | `pnpm test lib/__tests__/factories` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-db-schema-migration"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/__tests__/factories` |
| **Integration Command** | `npx tsc --noEmit` |
| **Acceptance Command** | `npx tsc --noEmit` (kein TS-Fehler in den Mock-Dateien) |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Zentrale Test-Factory-Funktionen (`makeGeneration`, `makeEntry`) erstellen, die das bereinigte Schema aus Slice 01 widerspiegeln (ohne `promptStyle`/`negativePrompt`). Damit koennen alle nachfolgenden Slices, die Test-Dateien anpassen, die Factory importieren statt eigene Kopien zu pflegen.

---

## Acceptance Criteria

1) GIVEN die neue Datei `lib/__tests__/factories.ts`
   WHEN `makeGeneration()` ohne Argumente aufgerufen wird
   THEN gibt die Funktion ein Objekt vom Typ `Generation` zurueck (aus `lib/db/schema.ts`)
   AND das Objekt enthaelt KEINE Properties `promptStyle` oder `negativePrompt`
   AND das Objekt enthaelt die Properties `prompt`, `promptMotiv`, `id`, `projectId`, `modelId`, `status` (alle mit sinnvollen Defaults)

2) GIVEN die `makeGeneration`-Factory aus AC-1
   WHEN `makeGeneration({ id: "custom-id", prompt: "A red fox" })` aufgerufen wird
   THEN enthaelt das zurueckgegebene Objekt `id: "custom-id"` und `prompt: "A red fox"`
   AND alle nicht uebergebenen Properties haben Default-Werte

3) GIVEN die neue Datei `lib/__tests__/factories.ts`
   WHEN `makeEntry()` ohne Argumente aufgerufen wird
   THEN gibt die Funktion ein Objekt vom Typ `PromptHistoryEntry` zurueck (aus `lib/services/prompt-history-service.ts`)
   AND das Objekt enthaelt KEINE Properties `promptStyle` oder `negativePrompt`
   AND das Objekt enthaelt die Properties `generationId`, `promptMotiv`, `modelId`, `modelParams`, `isFavorite`, `createdAt`

4) GIVEN die `makeEntry`-Factory aus AC-3
   WHEN `makeEntry({ promptMotiv: "Sunset", isFavorite: true })` aufgerufen wird
   THEN enthaelt das zurueckgegebene Objekt `promptMotiv: "Sunset"` und `isFavorite: true`
   AND alle nicht uebergebenen Properties haben Default-Werte

5) GIVEN die Factories aus AC-1 und AC-3
   WHEN `npx tsc --noEmit` ausgefuehrt wird
   THEN meldet der TypeScript-Compiler 0 Fehler in `lib/__tests__/factories.ts`
   AND die Rueckgabetypen stimmen exakt mit den bereinigten Schema-/Interface-Typen ueberein

6) GIVEN die 40 existierenden `makeGeneration`-Kopien in Test-Dateien (siehe Constraints)
   WHEN nach Erstellung der zentralen Factory geprueft wird
   THEN sind die existierenden Kopien in diesem Slice NICHT veraendert (werden in nachfolgenden Slices migriert)
   AND die zentrale Factory ist unabhaengig testbar

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.

### Test-Datei: `lib/__tests__/factories.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('makeGeneration factory', () => {
  // AC-1: Defaults ohne promptStyle/negativePrompt
  it.todo('should return a Generation object without promptStyle or negativePrompt')

  // AC-1: Alle erforderlichen Properties vorhanden
  it.todo('should include prompt, promptMotiv, id, projectId, modelId, status as defaults')

  // AC-2: Override-Support
  it.todo('should allow overriding specific properties via partial object')

  // AC-2: Non-overridden Properties behalten Defaults
  it.todo('should keep default values for non-overridden properties')
})

describe('makeEntry factory', () => {
  // AC-3: Defaults ohne promptStyle/negativePrompt
  it.todo('should return a PromptHistoryEntry without promptStyle or negativePrompt')

  // AC-3: Alle erforderlichen Properties vorhanden
  it.todo('should include generationId, promptMotiv, modelId, modelParams, isFavorite, createdAt')

  // AC-4: Override-Support
  it.todo('should allow overriding promptMotiv and isFavorite')

  // AC-4: Non-overridden Properties behalten Defaults
  it.todo('should keep default values for non-overridden properties')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-db-schema-migration` | `generations` Schema ohne `promptStyle`/`negativePrompt` | Drizzle Table | `typeof generations.$inferSelect` hat keine entfernten Properties |
| `slice-02-db-queries-prompt-history` | `PromptHistoryEntry` Interface ohne `promptStyle`/`negativePrompt` | TypeScript Interface | Interface hat keine entfernten Properties |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `makeGeneration(overrides?)` | Factory Function | slice-04 bis slice-10 (Test-Anpassungen) | `(overrides?: Partial<Generation>) => Generation` |
| `makeEntry(overrides?)` | Factory Function | slice-06 (Prompt-History/Favorites Tests) | `(overrides?: Partial<PromptHistoryEntry>) => PromptHistoryEntry` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/__tests__/factories.ts` -- Zentrale Test-Factory mit `makeGeneration()` und `makeEntry()`, ohne `promptStyle`/`negativePrompt`
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an bestehenden Test-Dateien -- die 40 existierenden `makeGeneration`-Kopien werden in nachfolgenden Slices durch Imports der zentralen Factory ersetzt
- KEINE Aenderungen an produktivem Code (Schema, Queries, Services, UI)
- KEINE Aenderungen an `vitest.config.ts` oder `vitest.setup.ts`
- Die 2 existierenden `makeEntry`-Kopien (`favorites-list.test.tsx`, `history-list.test.tsx`) werden ebenfalls NICHT in diesem Slice migriert

**Technische Constraints:**
- Factory-Rueckgabetypen muessen exakt mit den bereinigten Typen (`Generation` aus `lib/db/schema.ts`, `PromptHistoryEntry` aus `lib/services/prompt-history-service.ts`) uebereinstimmen
- Typisierung via `Partial<Generation>` bzw. `Partial<PromptHistoryEntry>` fuer Override-Parameter (bestehendes Pattern beibehalten)
- Keine externen Dependencies -- nur TypeScript-Typen importieren

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "Database Schema > Schema Changes" (Generation-Typ)
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "Server Logic > Services & Processing" (PromptHistoryEntry)

**Kontext -- Existierende makeGeneration-Kopien (40 Dateien):**

| Bereich | Anzahl Dateien |
|---------|----------------|
| `components/canvas/__tests__/` | 19 |
| `components/canvas/popovers/__tests__/` | 4 |
| `components/workspace/__tests__/` | 7 |
| `lib/services/__tests__/` | 5 |
| `app/actions/__tests__/` | 4 |
| **Gesamt** | **39** |

Alle enthalten `promptStyle` und/oder `negativePrompt` in der Factory-Funktion. Nach diesem Slice steht die bereinigte zentrale Factory bereit, in die nachfolgende Slices migrieren koennen.
