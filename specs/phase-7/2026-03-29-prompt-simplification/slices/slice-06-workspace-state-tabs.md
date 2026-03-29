# Slice 06: Workspace State & Prompt Tabs/Lists UI

> **Slice 6 von 11** fuer `Prompt-Felder Vereinfachung`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-06-workspace-state-tabs` |
| **Test** | `pnpm test app/actions/__tests__/prompts-history` |
| **E2E** | `false` |
| **Dependencies** | `["slice-04-generation-service-action"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test app/actions/__tests__/prompts-history` |
| **Integration Command** | `pnpm test lib/__tests__/workspace-state` |
| **Acceptance Command** | `npx tsc --noEmit` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Das `WorkspaceVariationState`-Interface und die drei Prompt-Tab-Komponenten (`PromptTabs`, `HistoryList`, `FavoritesList`) von den entfernten Feldern `promptStyle` und `negativePrompt` bereinigen. Danach akzeptieren die Komponenten nur noch `promptMotiv` fuer den Content-Check und das Interface ist konsistent mit dem bereinigten Schema.

---

## Acceptance Criteria

1) GIVEN das Interface `WorkspaceVariationState` in `workspace-state.tsx`
   WHEN der TypeScript-Compiler das Interface prueft
   THEN existiert KEINE Property `promptStyle` und KEINE Property `negativePrompt`
   AND die Properties `promptMotiv`, `modelId`, `modelParams`, `targetMode?`, `sourceImageUrl?`, `strength?`, `sourceGenerationId?`, `addReference?` sind UNVERAENDERT vorhanden

2) GIVEN das Interface `PromptTabsProps` in `prompt-tabs.tsx`
   WHEN der TypeScript-Compiler die Props prueft
   THEN existiert KEINE Property `promptStyle` und KEINE Property `negativePrompt`
   AND die Property `promptMotiv?` ist weiterhin vorhanden
   AND die Weitergabe von `promptStyle`/`negativePrompt` an `HistoryList` und `FavoritesList` existiert NICHT mehr

3) GIVEN das Interface `HistoryListProps` in `history-list.tsx`
   WHEN der TypeScript-Compiler die Props prueft
   THEN existiert KEINE Property `promptStyle` und KEINE Property `negativePrompt`
   AND die Property `promptMotiv?` ist weiterhin vorhanden

4) GIVEN die Funktion `hasAnyPromptContent` in `history-list.tsx`
   WHEN `promptMotiv` den Wert `"  "` (nur Whitespace) hat
   THEN gibt `hasAnyPromptContent()` den Wert `false` zurueck
   AND WHEN `promptMotiv` den Wert `"a cat"` hat
   THEN gibt `hasAnyPromptContent()` den Wert `true` zurueck
   AND die Funktion referenziert WEDER `promptStyle` noch `negativePrompt`

5) GIVEN das Interface `FavoritesListProps` in `favorites-list.tsx`
   WHEN der TypeScript-Compiler die Props prueft
   THEN existiert KEINE Property `promptStyle` und KEINE Property `negativePrompt`
   AND die `hasAnyPromptContent`-Funktion prueft NUR `promptMotiv.trim() !== ""`

6) GIVEN alle Aenderungen aus AC-1 bis AC-5
   WHEN `npx tsc --noEmit` ausgefuehrt wird
   THEN meldet der TypeScript-Compiler 0 Fehler in `workspace-state.tsx`, `prompt-tabs.tsx`, `history-list.tsx` und `favorites-list.tsx`

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.

### Test-Datei: `lib/__tests__/workspace-state-prompt-removal.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('WorkspaceVariationState - prompt field removal', () => {
  // AC-1: Interface hat kein promptStyle
  it.todo('should not include promptStyle in WorkspaceVariationState')

  // AC-1: Interface hat kein negativePrompt
  it.todo('should not include negativePrompt in WorkspaceVariationState')

  // AC-1: Bestehende Properties sind unveraendert
  it.todo('should still include promptMotiv, modelId, modelParams and optional fields')
})
```
</test_spec>

### Test-Datei: `components/workspace/__tests__/prompt-tabs-removal.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('PromptTabs - prompt field removal', () => {
  // AC-2: Props Interface hat kein promptStyle/negativePrompt
  it.todo('should not accept promptStyle or negativePrompt props')

  // AC-2: Keine Weitergabe an HistoryList/FavoritesList
  it.todo('should not forward promptStyle or negativePrompt to HistoryList')

  // AC-2: Keine Weitergabe an FavoritesList
  it.todo('should not forward promptStyle or negativePrompt to FavoritesList')
})
```
</test_spec>

### Test-Datei: `components/workspace/__tests__/history-list-removal.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('HistoryList - prompt field removal', () => {
  // AC-3: Props Interface hat kein promptStyle/negativePrompt
  it.todo('should not accept promptStyle or negativePrompt props')

  // AC-4: hasAnyPromptContent prueft nur promptMotiv
  it.todo('should return false for hasAnyPromptContent when promptMotiv is whitespace-only')

  // AC-4: hasAnyPromptContent erkennt non-empty promptMotiv
  it.todo('should return true for hasAnyPromptContent when promptMotiv has content')

  // AC-4: hasAnyPromptContent referenziert nicht promptStyle/negativePrompt
  it.todo('should not reference promptStyle or negativePrompt in hasAnyPromptContent')
})
```
</test_spec>

### Test-Datei: `components/workspace/__tests__/favorites-list-removal.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('FavoritesList - prompt field removal', () => {
  // AC-5: Props Interface hat kein promptStyle/negativePrompt
  it.todo('should not accept promptStyle or negativePrompt props')

  // AC-5: hasAnyPromptContent prueft nur promptMotiv
  it.todo('should check only promptMotiv in hasAnyPromptContent')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-04-generation-service-action` | `GenerateImagesInput` ohne `promptStyle`/`negativePrompt` | Interface | TS-Compiler akzeptiert Aufrufe ohne diese Felder |
| `slice-02-db-queries-prompt-history` | `PromptHistoryEntry` ohne `promptStyle`/`negativePrompt` | Interface | HistoryList/FavoritesList Typen sind konsistent |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `WorkspaceVariationState` ohne `promptStyle`/`negativePrompt` | Interface | slice-05 (Prompt Area), slice-07 (Canvas) | `{ promptMotiv, modelId, modelParams, targetMode?, ... }` |
| `PromptTabs` ohne `promptStyle`/`negativePrompt` Props | Component | slice-05 (Prompt Area) | `<PromptTabs promptMotiv={string} ...>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/workspace-state.tsx` -- `promptStyle` und `negativePrompt` aus `WorkspaceVariationState` Interface entfernen
- [ ] `components/workspace/prompt-tabs.tsx` -- `promptStyle`/`negativePrompt` aus Props und Forwarding an Child-Komponenten entfernen
- [ ] `components/workspace/history-list.tsx` -- `promptStyle`/`negativePrompt` aus Props entfernen, `hasAnyPromptContent` auf nur `promptMotiv` vereinfachen
- [ ] `components/workspace/favorites-list.tsx` -- Identische Bereinigung wie `history-list.tsx`
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an `components/workspace/prompt-area.tsx` (Slice 05)
- KEINE Aenderungen an Canvas-Komponenten (Slice 07)
- KEINE Aenderungen an `lib/db/queries.ts` oder Services (Slice 01, 02, 04)
- KEINE Aenderungen an Assistant-Code (Slices 08-10)
- Die Komponenten-Logik (Pagination, Favorite-Toggle, Confirmation-Dialog) bleibt UNVERAENDERT
- Nur Props/Interfaces und der `hasAnyPromptContent`-Check werden angepasst

**Technische Constraints:**
- TypeScript strict mode
- React `useCallback`-Dependencies muessen nach Entfernung der Variablen angepasst werden
- `hasAnyPromptContent` reduziert sich auf `promptMotiv.trim() !== ""`

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "Frontend -- UI Components" (prompt-tabs.tsx, history-list.tsx, favorites-list.tsx)
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "Frontend -- State" (workspace-state.tsx)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/workspace-state.tsx` | MODIFY -- 2 Properties aus `WorkspaceVariationState` entfernen (Zeilen 12-13) |
| `components/workspace/prompt-tabs.tsx` | MODIFY -- Props bereinigen (Zeilen 23-24), Forwarding entfernen (Zeilen 81-82, 93-94) |
| `components/workspace/history-list.tsx` | MODIFY -- Props bereinigen (Zeilen 63-64), `hasAnyPromptContent` vereinfachen (Zeile 145) |
| `components/workspace/favorites-list.tsx` | MODIFY -- Identisches Pattern wie history-list (Zeilen 63-64, 145) |
