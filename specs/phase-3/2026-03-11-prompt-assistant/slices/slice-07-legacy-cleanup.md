# Slice 07: Legacy Cleanup -- Builder + Templates entfernen

> **Slice 7 von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-07-legacy-cleanup` |
| **Test** | `pnpm build` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/__tests__/prompt-area.test.tsx` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm build && node -e "const fs=require('fs'); const dirs=['components/prompt-builder','components/workspace/template-selector.tsx','lib/builder-fragments.ts','lib/prompt-templates.ts','lib/services/snippet-service.ts']; dirs.forEach(d=>{if(fs.existsSync(d))throw new Error(d+' still exists')}); console.log('OK')"` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Entferne alle Legacy-Dateien (Prompt-Builder, Template-Selector, Builder-Fragments, Prompt-Templates, Snippet-Service) die durch den neuen Prompt-Assistenten ersetzt werden. Bereinige Imports und Usage in `prompt-area.tsx` sowie Snippet-CRUD in `app/actions/prompts.ts`. Entferne die `promptSnippets` Tabelle aus dem Drizzle-Schema. Der Build muss danach fehlerfrei durchlaufen.

---

## Acceptance Criteria

1) GIVEN die Datei `components/prompt-builder/` existiert als Ordner
   WHEN der Implementer den Slice abschliesst
   THEN existiert der gesamte Ordner `components/prompt-builder/` nicht mehr (inklusive `builder-drawer.tsx`, `category-tabs.tsx`, `option-chip.tsx`, `snippet-form.tsx`, `surprise-me-button.tsx` und `__tests__/`)

2) GIVEN die Dateien `components/workspace/template-selector.tsx` und `components/workspace/__tests__/template-selector.test.tsx` existieren
   WHEN der Implementer den Slice abschliesst
   THEN existieren beide Dateien nicht mehr

3) GIVEN die Dateien `lib/builder-fragments.ts`, `lib/prompt-templates.ts`, `lib/services/snippet-service.ts` existieren
   WHEN der Implementer den Slice abschliesst
   THEN existieren diese drei Dateien nicht mehr, ebenso deren Testdateien (`lib/__tests__/builder-fragments.test.ts`, `lib/__tests__/prompt-templates.test.ts`, `lib/services/__tests__/snippet-service.test.ts`)

4) GIVEN `components/workspace/prompt-area.tsx` importiert `BuilderDrawer` (Zeile 26) und `TemplateSelector` (Zeile 28)
   WHEN der Implementer den Slice abschliesst
   THEN enthaelt `prompt-area.tsx` weder den Import noch die JSX-Usage von `BuilderDrawer` und `TemplateSelector`. Die Datei kompiliert fehlerfrei.

5) GIVEN `app/actions/prompts.ts` exportiert `createSnippet`, `updateSnippet`, `deleteSnippet`, `getSnippets` und importiert `SnippetService`
   WHEN der Implementer den Slice abschliesst
   THEN exportiert die Datei nur noch `getPromptHistory`, `getFavoritePrompts`, `toggleFavorite`, `improvePrompt`. Der Import von `SnippetService` und die Hilfsfunktion `validateSnippetInput` sind entfernt.

6) GIVEN `lib/db/schema.ts` definiert die Tabelle `promptSnippets` (Zeilen 131-144)
   WHEN der Implementer den Slice abschliesst
   THEN ist die `promptSnippets` Tabellendefinition und ihr Export aus `schema.ts` entfernt

7) GIVEN die bestehenden Tests `app/actions/__tests__/prompts.test.ts` und `app/actions/__tests__/prompts-history.test.ts` mocken `@/lib/services/snippet-service`
   WHEN der Implementer den Slice abschliesst
   THEN sind die `vi.mock('@/lib/services/snippet-service')` Aufrufe und alle Snippet-bezogenen Tests aus `prompts.test.ts` entfernt. Die verbleibenden Tests (`prompts-history.test.ts`, `improvePrompt`-Tests) laufen fehlerfrei.

8) GIVEN die bestehenden Tests in `components/workspace/__tests__/prompt-area.test.tsx`, `components/workspace/__tests__/prompt-area-structured.test.tsx`, `components/workspace/__tests__/prompt-tabs.test.tsx`, `components/lightbox/__tests__/variation-flow.test.tsx`, `components/models/__tests__/model-trigger.test.tsx` mocken `@/lib/services/snippet-service`
   WHEN der Implementer den Slice abschliesst
   THEN sind alle `vi.mock('@/lib/services/snippet-service')` Aufrufe aus diesen Testdateien entfernt und die Tests laufen fehlerfrei

9) GIVEN alle Aenderungen aus AC-1 bis AC-8 sind umgesetzt
   WHEN `pnpm build` ausgefuehrt wird
   THEN laeuft der Build fehlerfrei durch (Exit-Code 0, keine toten Imports, keine unresolved References)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.
> **Syntax:** TypeScript/Vitest

### Test-Datei: `specs/phase-3/2026-03-11-prompt-assistant/slices/__tests__/slice-07-legacy-cleanup.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Slice 07: Legacy Cleanup', () => {
  // AC-1: prompt-builder Ordner geloescht
  it.todo('should have deleted the entire components/prompt-builder/ directory')

  // AC-2: template-selector geloescht
  it.todo('should have deleted template-selector.tsx and its test file')

  // AC-3: lib-Dateien geloescht
  it.todo('should have deleted builder-fragments.ts, prompt-templates.ts, snippet-service.ts and their test files')

  // AC-4: prompt-area.tsx bereinigt
  it.todo('should not contain BuilderDrawer or TemplateSelector imports/usage in prompt-area.tsx')

  // AC-5: prompts.ts bereinigt
  it.todo('should only export getPromptHistory, getFavoritePrompts, toggleFavorite, improvePrompt from prompts.ts')

  // AC-6: schema.ts bereinigt
  it.todo('should not contain promptSnippets table definition in schema.ts')

  // AC-7: prompts.test.ts bereinigt
  it.todo('should not contain snippet-service mocks or snippet-related tests in prompts.test.ts')

  // AC-8: snippet-service Mocks aus verbleibenden Tests entfernt
  it.todo('should not contain snippet-service mocks in prompt-area, prompt-tabs, variation-flow, model-trigger test files')

  // AC-9: Build erfolgreich
  it.todo('should pass pnpm build without errors')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| (keine) | -- | -- | Dieser Slice hat keine Dependencies |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Bereinigte `prompt-area.tsx` (ohne Builder/Template) | Component | slice-08-assistant-sheet-shell | Freie Stelle fuer neuen AssistantTrigger-Button |
| Bereinigte `app/actions/prompts.ts` | Server Actions | (keine direkte Abhaengigkeit) | `getPromptHistory()`, `getFavoritePrompts()`, `toggleFavorite()`, `improvePrompt()` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/prompt-area.tsx` -- Bereinigt: BuilderDrawer + TemplateSelector Imports und JSX-Usage entfernt
- [ ] `app/actions/prompts.ts` -- Bereinigt: Snippet-CRUD (createSnippet, updateSnippet, deleteSnippet, getSnippets, validateSnippetInput) und SnippetService-Import entfernt
- [ ] `lib/db/schema.ts` -- Bereinigt: promptSnippets Tabellendefinition und Export entfernt
<!-- DELIVERABLES_END -->

> **Hinweis:** Zusaetzlich muessen folgende Dateien/Ordner GELOESCHT werden (keine neuen Deliverables, sondern Deletions):
> - `components/prompt-builder/` (gesamter Ordner)
> - `components/workspace/template-selector.tsx` + `components/workspace/__tests__/template-selector.test.tsx`
> - `lib/builder-fragments.ts` + `lib/__tests__/builder-fragments.test.ts`
> - `lib/prompt-templates.ts` + `lib/__tests__/prompt-templates.test.ts`
> - `lib/services/snippet-service.ts` + `lib/services/__tests__/snippet-service.test.ts`
>
> Ausserdem muessen bestehende Testdateien bereinigt werden (snippet-service Mocks entfernen):
> - `app/actions/__tests__/prompts.test.ts` (Snippet-Tests entfernen, snippet-service Mock entfernen)
> - `app/actions/__tests__/prompts-history.test.ts` (snippet-service Mock entfernen)
> - `components/workspace/__tests__/prompt-area.test.tsx` (snippet-service Mock entfernen)
> - `components/workspace/__tests__/prompt-area-structured.test.tsx` (snippet-service Mock entfernen)
> - `components/workspace/__tests__/prompt-tabs.test.tsx` (snippet-service Mock entfernen)
> - `components/lightbox/__tests__/variation-flow.test.tsx` (snippet-service Mock entfernen)
> - `components/models/__tests__/model-trigger.test.tsx` (snippet-service Mock entfernen)
> - `lib/db/__tests__/schema.test.ts` (promptSnippets Import und AC-6 Tests entfernen)

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice fuegt KEINEN neuen Assistant-Button hinzu (kommt in Slice 08)
- Dieser Slice aendert KEINE Drizzle-Migrationen (die `prompt_snippets` Tabelle bleibt in der DB bestehen, nur die Schema-Definition wird entfernt)
- Dieser Slice aendert NICHT die `lib/services/prompt-service.ts` oder `lib/services/prompt-history-service.ts`
- Prompt-Area muss nach der Bereinigung weiterhin voll funktionsfaehig sein (alle anderen Features intakt)

**Technische Constraints:**
- Entfernung der Snippet-CRUD muss den `"use server"` Marker in `prompts.ts` beibehalten
- Verbleibende Exports in `prompts.ts`: `getPromptHistory`, `getFavoritePrompts`, `toggleFavorite`, `improvePrompt`
- Verbleibende Imports in `prompts.ts`: `PromptService` (fuer improvePrompt), `promptHistoryService` (fuer History/Favorites)
- Schema-Bereinigung: nur die `promptSnippets` Tabellendefinition entfernen, KEINE anderen Tabellen beruehren
- Alle bestehenden Tests die `snippet-service` mocken muessen bereinigt werden, damit sie nach Loeschung nicht auf ein nicht-existentes Modul verweisen

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Migration Map" (Zeilen 430-453)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "Current State Reference" (Zeilen 57-71)
