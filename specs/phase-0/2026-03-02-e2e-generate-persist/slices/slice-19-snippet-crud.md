# Slice 19: Snippet CRUD -- DB + Service + Actions

> **Slice 19 von 21** fuer `E2E Generate & Persist`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-19-snippet-crud` |
| **Test** | `pnpm test lib/services/__tests__/snippet-service.test.ts app/actions/__tests__/prompts.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-db-connection-queries"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/services/__tests__/snippet-service.test.ts app/actions/__tests__/prompts.test.ts` |
| **Integration Command** | `docker compose up -d && pnpm drizzle-kit migrate && pnpm test lib/services/__tests__/snippet-service.integration.test.ts` |
| **Acceptance Command** | `docker compose up -d && pnpm drizzle-kit migrate && pnpm test app/actions/__tests__/prompts.integration.test.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `localhost:5432` (PostgreSQL) |
| **Mocking Strategy** | `test_containers` (Integration-Tests gegen laufende DB) |

---

## Ziel

SnippetService und zugehoerige Server Actions bereitstellen, damit Prompt-Bausteine (Snippets) erstellt, gelesen, aktualisiert und geloescht werden koennen. Die getSnippets-Action liefert Snippets gruppiert nach Kategorie. Validierung stellt sicher, dass Text und Kategorie nicht leer und nicht zu lang sind. Die Datei `app/actions/prompts.ts` wird in Slice 21 um die `improvePrompt` Action erweitert.

---

## Acceptance Criteria

1) GIVEN die DB laeuft und Migrationen sind angewendet
   WHEN `createSnippet({ text: "on white background, centered", category: "POD Basics" })` aufgerufen wird
   THEN wird ein Snippet mit generierter UUID, dem getrimmten Text, der getrimmten Kategorie und `created_at` als TIMESTAMPTZ zurueckgegeben

2) GIVEN ein existierendes Snippet mit bekannter ID
   WHEN `updateSnippet({ id, text: "new text", category: "New Category" })` aufgerufen wird
   THEN werden Text und Kategorie aktualisiert und der aktualisierte Datensatz zurueckgegeben

3) GIVEN ein existierendes Snippet mit bekannter ID
   WHEN `deleteSnippet({ id })` aufgerufen wird
   THEN wird `{ success: true }` zurueckgegeben und das Snippet ist nicht mehr in der DB vorhanden

4) GIVEN mehrere Snippets in verschiedenen Kategorien ("POD Basics": 2 Snippets, "My Styles": 1 Snippet)
   WHEN `getSnippets()` aufgerufen wird
   THEN werden die Snippets als Objekt gruppiert nach Kategorie zurueckgegeben: `{ "POD Basics": [Snippet, Snippet], "My Styles": [Snippet] }`

5) GIVEN keine Snippets in der DB
   WHEN `getSnippets()` aufgerufen wird
   THEN wird ein leeres Objekt `{}` zurueckgegeben

6) GIVEN ein createSnippet-Aufruf mit `text: ""`  (leerer String)
   WHEN die Validierung durchlaeuft
   THEN wird ein Fehler zurueckgegeben mit Message "Snippet-Text darf nicht leer sein"

7) GIVEN ein createSnippet-Aufruf mit `text` laenger als 500 Zeichen
   WHEN die Validierung durchlaeuft
   THEN wird ein Fehler zurueckgegeben mit Message "Snippet-Text darf maximal 500 Zeichen lang sein"

8) GIVEN ein createSnippet-Aufruf mit `category: ""`  (leerer String)
   WHEN die Validierung durchlaeuft
   THEN wird ein Fehler zurueckgegeben mit Message "Kategorie darf nicht leer sein"

9) GIVEN ein createSnippet-Aufruf mit `category` laenger als 100 Zeichen
   WHEN die Validierung durchlaeuft
   THEN wird ein Fehler zurueckgegeben mit Message "Kategorie darf maximal 100 Zeichen lang sein"

10) GIVEN ein createSnippet-Aufruf mit `text: "  hello  "` und `category: "  POD  "`
    WHEN die Validierung und Speicherung durchlaeuft
    THEN werden Text und Kategorie getrimmt gespeichert: text="hello", category="POD"

11) GIVEN ein updateSnippet-Aufruf mit einer nicht existierenden ID
    WHEN die Action ausgefuehrt wird
    THEN wird ein Fehler zurueckgegeben mit Message "Snippet nicht gefunden"

12) GIVEN ein updateSnippet-Aufruf mit `text: ""` (leerer String)
    WHEN die Validierung durchlaeuft
    THEN wird derselbe Validierungsfehler wie bei createSnippet zurueckgegeben

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/services/__tests__/snippet-service.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('SnippetService', () => {
  // AC-1: Snippet erstellen
  it.todo('should create a snippet with UUID, trimmed text, trimmed category, and created_at')

  // AC-2: Snippet aktualisieren
  it.todo('should update text and category and return updated record')

  // AC-3: Snippet loeschen
  it.todo('should delete snippet and return success true')

  // AC-4: Snippets gruppiert nach Kategorie
  it.todo('should return snippets grouped by category')

  // AC-5: Leere DB
  it.todo('should return empty object when no snippets exist')

  // AC-11: Nicht existierendes Snippet
  it.todo('should return error when updating non-existent snippet')
})
```
</test_spec>

### Test-Datei: `app/actions/__tests__/prompts.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Snippet Server Actions - Validation', () => {
  // AC-6: Leerer Text
  it.todo('should reject empty text with "Snippet-Text darf nicht leer sein"')

  // AC-7: Text zu lang
  it.todo('should reject text longer than 500 chars with max-length error')

  // AC-8: Leere Kategorie
  it.todo('should reject empty category with "Kategorie darf nicht leer sein"')

  // AC-9: Kategorie zu lang
  it.todo('should reject category longer than 100 chars with max-length error')

  // AC-10: Trimming
  it.todo('should trim text and category before saving')

  // AC-12: Update-Validierung
  it.todo('should apply same validation rules on updateSnippet as on createSnippet')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-docker-db-schema` | `promptSnippets` Table Schema | Drizzle Table | Import aus `lib/db/schema.ts` |
| `slice-02-db-connection-queries` | `db` Drizzle Instance | Singleton | Import aus `lib/db/index.ts` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `createSnippet` | Server Action | Prompt Builder UI | `(input: { text: string, category: string }) => Promise<Snippet \| { error: string }>` |
| `updateSnippet` | Server Action | Prompt Builder UI | `(input: { id: string, text: string, category: string }) => Promise<Snippet \| { error: string }>` |
| `deleteSnippet` | Server Action | Prompt Builder UI | `(input: { id: string }) => Promise<{ success: boolean } \| { error: string }>` |
| `getSnippets` | Server Action | Prompt Builder UI | `() => Promise<Record<string, Snippet[]>>` |
| `app/actions/prompts.ts` | Datei (erweiterbar) | `slice-21-llm-prompt-improve` | Slice 21 fuegt `improvePrompt` Action in diese Datei ein |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/snippet-service.ts` — SnippetService mit CRUD-Operationen und Gruppierung nach Kategorie
- [ ] `app/actions/prompts.ts` — Server Actions createSnippet, updateSnippet, deleteSnippet, getSnippets mit Validierung (wird von Slice 21 um improvePrompt erweitert)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Snippet-Queries in `lib/db/queries.ts` -- SnippetService nutzt Drizzle direkt mit dem `db`-Singleton
- KEINE UI-Komponenten (snippet-form, snippet-chip) -- kommt in einem separaten UI-Slice
- KEINE `improvePrompt` Action in `app/actions/prompts.ts` -- wird von Slice 21 ergaenzt
- KEIN Schema-Aenderungen -- `prompt_snippets` Tabelle existiert bereits aus Slice 01

**Technische Constraints:**
- Drizzle ORM fuer alle DB-Operationen (kein raw SQL)
- Server Actions mit `"use server"` Direktive
- Validierung vor DB-Zugriff (fail fast)
- Text und Category werden immer getrimmt vor Validierung und Speicherung
- Fehler als strukturiertes Objekt zurueckgeben (kein throw in Server Actions)

**Referenzen:**
- Architecture: `architecture.md` → Section "Database Schema" (prompt_snippets Schema Details)
- Architecture: `architecture.md` → Section "API Design" (Server Actions: createSnippet, updateSnippet, deleteSnippet, getSnippets)
- Architecture: `architecture.md` → Section "Validation Rules" (snippet.text max 500, snippet.category max 100)
- Architecture: `architecture.md` → Section "Server Logic" (SnippetService Responsibility)
- Discovery: `discovery.md` → Flow 5 + 5b (Prompt-Baustein erstellen/bearbeiten/loeschen)
