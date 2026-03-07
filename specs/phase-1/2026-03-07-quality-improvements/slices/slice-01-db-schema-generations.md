# Slice 01: DB Schema -- Generations Extensions

> **Slice 01 von 21** fuer `quality-improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-01-db-schema-generations` |
| **Test** | `pnpm test lib/db/__tests__/schema-generations.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/db/__tests__/schema-generations.test.ts` |
| **Integration Command** | `--` |
| **Acceptance Command** | `pnpm build` (Typkompilierung als Acceptance) |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `--` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Die `generations`-Tabelle im Drizzle-Schema um drei neue Spalten erweitern (`prompt_motiv`, `prompt_style`, `is_favorite`) und einen Index auf `is_favorite` anlegen. Damit wird die Basis fuer strukturierte Prompts und Prompt-Favoriten geschaffen.

---

## Acceptance Criteria

1. GIVEN das Drizzle-Schema in `lib/db/schema.ts`
   WHEN die Datei kompiliert wird (`tsc --noEmit`)
   THEN kompiliert sie fehlerfrei mit den drei neuen Spalten

2. GIVEN die `generations`-Tabellendefinition
   WHEN man die Spalte `prompt_motiv` inspiziert
   THEN ist sie vom Typ `text`, `NOT NULL`, mit Default `''` (leerer String)

3. GIVEN die `generations`-Tabellendefinition
   WHEN man die Spalte `prompt_style` inspiziert
   THEN ist sie vom Typ `text` mit Default `''` (leerer String)

4. GIVEN die `generations`-Tabellendefinition
   WHEN man die Spalte `is_favorite` inspiziert
   THEN ist sie vom Typ `boolean`, `NOT NULL`, mit Default `false`

5. GIVEN die `generations`-Tabellendefinition
   WHEN man die Index-Definitionen inspiziert
   THEN existiert ein Index `generations_is_favorite_idx` auf der Spalte `is_favorite`

6. GIVEN die bestehenden Spalten und Indexes der `generations`-Tabelle
   WHEN die neuen Spalten hinzugefuegt werden
   THEN bleiben alle bestehenden Spalten (`id`, `projectId`, `prompt`, `negativePrompt`, `modelId`, `modelParams`, `status`, `imageUrl`, `replicatePredictionId`, `errorMessage`, `width`, `height`, `seed`, `createdAt`) und bestehenden Indexes (`generations_project_id_idx`, `generations_status_idx`, `generations_created_at_idx`) unveraendert

7. GIVEN den `InferSelectModel`-Typ der erweiterten `generations`-Tabelle
   WHEN ein TypeScript-Modul diesen Typ importiert
   THEN enthaelt der Typ die Properties `promptMotiv: string`, `promptStyle: string | null` und `isFavorite: boolean`

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/db/__tests__/schema-generations.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Generations Schema Extensions', () => {
  // AC-1: Schema kompiliert fehlerfrei
  it.todo('should compile without errors (verified by test execution itself)')

  // AC-2: prompt_motiv Spaltendefinition
  it.todo('should define prompt_motiv as text, not null, default empty string')

  // AC-3: prompt_style Spaltendefinition
  it.todo('should define prompt_style as text with default empty string')

  // AC-4: is_favorite Spaltendefinition
  it.todo('should define is_favorite as boolean, not null, default false')

  // AC-5: Index auf is_favorite
  it.todo('should define generations_is_favorite_idx index on is_favorite')

  // AC-6: Bestehende Spalten unveraendert
  it.todo('should preserve all existing columns and indexes unchanged')

  // AC-7: InferSelectModel Typ
  it.todo('should expose promptMotiv, promptStyle, and isFavorite in inferred select type')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| -- | -- | -- | Keine Abhaengigkeiten |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `generations.promptMotiv` | Schema Column | slice-02 (Strukturiertes Prompt-Feld), slice-05 (History) | `text('prompt_motiv').notNull().default('')` |
| `generations.promptStyle` | Schema Column | slice-02, slice-05 | `text('prompt_style').default('')` |
| `generations.isFavorite` | Schema Column | slice-05 (History + Favoriten) | `boolean('is_favorite').notNull().default(false)` |
| `generations_is_favorite_idx` | Index | slice-05 | Index auf `is_favorite` fuer performante Favoriten-Abfragen |
| `InferSelectModel<typeof generations>` | TypeScript Type | slice-02, slice-05 | Erweiterter Typ mit `promptMotiv`, `promptStyle`, `isFavorite` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/db/schema.ts` -- 3 neue Spalten (`prompt_motiv`, `prompt_style`, `is_favorite`) und 1 neuer Index (`generations_is_favorite_idx`) in der `generations`-Tabelle
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Migration erstellen (gehoert zu Slice 21)
- KEINE Aenderungen an der `projects`-Tabelle (gehoert zu einem separaten Slice)
- KEINE Aenderungen an `queries.ts` oder anderen Dateien
- KEINE neuen Tabellen anlegen

**Technische Constraints:**
- Drizzle ORM API verwenden (kein raw SQL)
- Bestehende Import-Statements in `schema.ts` erweitern (z.B. `boolean` importieren)
- Spalten-Naming: snake_case in DB (`prompt_motiv`), camelCase im Drizzle-Schema (`promptMotiv`)
- Defaults muessen non-breaking sein (bestehende Rows ohne diese Spalten funktionieren nach Migration)

**Referenzen:**
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` -- Section "Database Schema" (Zeilen 46-58) fuer Spaltendefinitionen
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` -- Section "New Indexes" (Zeilen 87-90) fuer Index-Definition
