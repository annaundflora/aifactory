# Slice 01: DB Schema & Migration

> **Slice 1 von 11** fuer `Prompt-Felder Vereinfachung`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-01-db-schema-migration` |
| **Test** | `pnpm test lib/db/__tests__/schema` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/db/__tests__/schema` |
| **Integration Command** | `npx drizzle-kit generate` (darf keine neuen Aenderungen finden) |
| **Acceptance Command** | `npx tsc --noEmit` (gesamtes Projekt kompiliert fehlerfrei) |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Die Datenbank-Spalten `prompt_style` und `negative_prompt` aus der `generations`-Tabelle entfernen, da sie von modernen AI-Models nicht mehr unterstuetzt werden und API-Errors verursachen. Dies ist die Grundlage fuer alle nachfolgenden Slices, die auf das bereinigte Schema aufbauen.

---

## Acceptance Criteria

1) GIVEN das Drizzle-Schema in `lib/db/schema.ts`
   WHEN der TypeScript-Compiler `lib/db/schema.ts` prueft
   THEN existiert KEINE Spalte `promptStyle` und KEINE Spalte `negativePrompt` in der `generations`-Tabellendefinition
   AND der inferred TypeScript-Typ `typeof generations.$inferSelect` hat KEINE Properties `promptStyle` oder `negativePrompt`
   AND `npx tsc --noEmit` meldet 0 Fehler in `lib/db/schema.ts`

2) GIVEN das bereinigte Schema aus AC-1
   WHEN `npx drizzle-kit generate` ausgefuehrt wird
   THEN existiert die Datei `drizzle/0012_drop_prompt_style_negative.sql`
   AND die SQL-Datei enthaelt genau 2 `ALTER TABLE ... DROP COLUMN`-Statements: eines fuer `prompt_style`, eines fuer `negative_prompt`
   AND die Statements verwenden `--> statement-breakpoint` als Separator (Drizzle-Konvention)

3) GIVEN die generierte Migration aus AC-2
   WHEN die Datei `drizzle/meta/_journal.json` geprueft wird
   THEN enthaelt das `entries`-Array einen Eintrag mit `"idx": 12` und `"tag": "0012_drop_prompt_style_negative"`
   AND das Journal hat weiterhin alle 12 vorherigen Eintraege (idx 0-11)

4) GIVEN das bereinigte Schema und die generierte Migration
   WHEN `npx drizzle-kit generate` erneut ausgefuehrt wird (Idempotenz-Check)
   THEN meldet Drizzle Kit "No schema changes, nothing to migrate" (oder aequivalent)
   AND es wird KEINE weitere Migration-Datei erstellt

5) GIVEN die bestehenden Spalten `prompt` (text, NOT NULL) und `promptMotiv` (text, NOT NULL, default "")
   WHEN das Schema nach der Aenderung geprueft wird
   THEN sind beide Spalten UNVERAENDERT vorhanden
   AND alle uebrigen Spalten der `generations`-Tabelle sind unveraendert (id, projectId, modelId, modelParams, status, imageUrl, etc.)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.

### Test-Datei: `lib/db/__tests__/schema-prompt-removal.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('generations schema - prompt field removal', () => {
  // AC-1: Schema hat keine promptStyle/negativePrompt Spalten
  it.todo('should not have promptStyle column in generations table definition')

  // AC-1: Schema hat keine promptStyle/negativePrompt Spalten
  it.todo('should not have negativePrompt column in generations table definition')

  // AC-5: Bestehende Spalten prompt und promptMotiv sind unveraendert
  it.todo('should still have prompt column as text NOT NULL')

  // AC-5: Bestehende Spalten prompt und promptMotiv sind unveraendert
  it.todo('should still have promptMotiv column as text NOT NULL with default empty string')

  // AC-1: Inferred TypeScript-Typ hat keine entfernten Properties
  it.todo('should not include promptStyle or negativePrompt in inferred select type')
})
```
</test_spec>

### Test-Datei: `drizzle/__tests__/migration-0012.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('migration 0012 - drop prompt_style and negative_prompt', () => {
  // AC-2: Migration-SQL enthaelt korrekte DROP COLUMN Statements
  it.todo('should contain ALTER TABLE DROP COLUMN for prompt_style')

  // AC-2: Migration-SQL enthaelt korrekte DROP COLUMN Statements
  it.todo('should contain ALTER TABLE DROP COLUMN for negative_prompt')

  // AC-2: Statement-Breakpoint Konvention
  it.todo('should use statement-breakpoint separator between statements')

  // AC-3: Journal-Eintrag ist korrekt
  it.todo('should have journal entry with idx 12 and tag 0012_drop_prompt_style_negative')

  // AC-3: Vorherige Journal-Eintraege intakt
  it.todo('should preserve all 12 previous journal entries (idx 0-11)')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| -- | Keine | -- | Erster Slice, keine Abhaengigkeiten |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `generations` Schema (ohne `promptStyle`/`negativePrompt`) | Drizzle Table | slice-02, slice-03 | `typeof generations.$inferSelect` (ohne die 2 entfernten Properties) |
| Migration `0012` | SQL | slice-11 | `drizzle/0012_drop_prompt_style_negative.sql` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/db/schema.ts` -- Spalten `promptStyle` und `negativePrompt` aus der `generations`-Tabellendefinition entfernen
- [ ] `drizzle/0012_drop_prompt_style_negative.sql` -- Generierte Migration mit DROP COLUMN Statements
- [ ] `drizzle/meta/_journal.json` -- Journal-Eintrag fuer Migration 0012 hinzufuegen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Query-Aenderungen in `lib/db/queries.ts` (das ist Slice 02)
- KEINE Service-Aenderungen (das sind Slices 02, 04, 08, 09)
- KEINE UI-Aenderungen (das sind Slices 05-07, 10)
- KEINE manuell geschriebene Migration-SQL -- Drizzle Kit generiert die Migration aus dem Schema-Diff
- TypeScript-Compiler wird nach diesem Slice Fehler in `queries.ts` und anderen Dateien zeigen, die noch auf die entfernten Spalten zugreifen -- das ist erwartetes Verhalten und wird in Slice 02ff behoben

**Technische Constraints:**
- Drizzle ORM Schema-first Workflow: Spalten aus `schema.ts` entfernen, dann `npx drizzle-kit generate` ausfuehren
- Migration muss dem bestehenden Pattern folgen: SQL-Datei mit `--> statement-breakpoint` Separatoren
- Journal-Format: Version `"7"`, Dialect `"postgresql"`, `breakpoints: true`
- Migration Index: 12 (naechster nach `0011_add_models_table`)

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "Database Schema" (Schema Changes, Migration)
- Discovery: `specs/phase-7/2026-03-29-prompt-simplification/discovery.md` -- Section "Datenbank"

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/db/schema.ts` | MODIFY -- 2 Spalten-Definitionen entfernen (Zeilen 61, 72) |
| `drizzle/meta/_journal.json` | MODIFY -- Neuen Eintrag an `entries`-Array anhaengen |
