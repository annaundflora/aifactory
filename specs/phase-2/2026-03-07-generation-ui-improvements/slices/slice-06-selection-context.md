# Slice 06: SelectionContext

> **Slice 06 von N** fuer `Generation UI Improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-06-selection-context` |
| **Test** | `pnpm test lib/selection-state` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/selection-state` |
| **Integration Command** | `pnpm test lib/selection-state` |
| **Acceptance Command** | `pnpm test lib/selection-state` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

`lib/selection-state.tsx` stellt einen React Context mit Provider bereit, der den transienten Bulk-Select-State kapselt: welche IDs selektiert sind, ob der Selection-Mode aktiv ist, und die Mutations `toggleSelection`, `selectAll`, `deselectAll`, `isSelected`. Kein UI, nur reine State-Logik — die Basis fuer alle Bulk-Operationen in den nachfolgenden Slices.

---

## Acceptance Criteria

1) GIVEN ein leeres `selectedIds`-Set im Context
   WHEN `toggleSelection("abc")` aufgerufen wird
   THEN enthaelt `selectedIds` genau `{ "abc" }` und `isSelecting` ist `true`

2) GIVEN `selectedIds` enthaelt `{ "abc" }`
   WHEN `toggleSelection("abc")` aufgerufen wird
   THEN ist `selectedIds` leer (`size === 0`) und `isSelecting` ist `false`

3) GIVEN ein leeres `selectedIds`-Set
   WHEN `selectAll(["a", "b"])` aufgerufen wird
   THEN enthaelt `selectedIds` genau `{ "a", "b" }` und `isSelecting` ist `true`

4) GIVEN `selectedIds` enthaelt `{ "a", "b" }`
   WHEN `deselectAll()` aufgerufen wird
   THEN ist `selectedIds` leer (`size === 0`) und `isSelecting` ist `false`

5) GIVEN `selectedIds` enthaelt `{ "a", "b" }`
   WHEN `isSelected("a")` aufgerufen wird
   THEN gibt die Funktion `true` zurueck

6) GIVEN `selectedIds` enthaelt `{ "a", "b" }`
   WHEN `isSelected("c")` aufgerufen wird
   THEN gibt die Funktion `false` zurueck

7) GIVEN ein Component, das ausserhalb des `SelectionProvider` auf den Context zugreift
   WHEN der Context-Hook aufgerufen wird
   THEN wirft er einen Error mit einer beschreibenden Meldung (z.B. "useSelection must be used within SelectionProvider")

8) GIVEN `selectedIds` enthaelt `{ "a" }` und `toggleSelection("b")` wird aufgerufen
   WHEN `isSelecting` abgefragt wird
   THEN ist `isSelecting` `true` (Set ist nicht leer, hat 2 Eintraege)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/__tests__/selection-state.test.tsx`

<test_spec>
```typescript
// AC-1: toggleSelection fuegt ID hinzu wenn nicht vorhanden
it.todo('should add id to selectedIds and set isSelecting to true')

// AC-2: toggleSelection entfernt ID wenn bereits vorhanden
it.todo('should remove id from selectedIds and set isSelecting to false when set becomes empty')

// AC-3: selectAll selektiert alle uebergebenen IDs
it.todo('should select all provided ids and set isSelecting to true')

// AC-4: deselectAll leert das Set
it.todo('should clear selectedIds and set isSelecting to false')

// AC-5: isSelected gibt true fuer enthaltene ID
it.todo('should return true for id that is in selectedIds')

// AC-6: isSelected gibt false fuer nicht enthaltene ID
it.todo('should return false for id that is not in selectedIds')

// AC-7: Hook-Fehler ausserhalb Provider
it.todo('should throw descriptive error when useSelection is called outside SelectionProvider')

// AC-8: isSelecting bleibt true wenn Set nach toggle noch Eintraege hat
it.todo('should keep isSelecting true when set is not empty after toggleSelection')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| — | — | — | Keine Abhaengigkeiten |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `SelectionProvider` | React Component | slice-07+, workspace-content | `SelectionProvider({ children: React.ReactNode })` |
| `useSelection` | React Hook | alle Bulk-UI-Komponenten | `useSelection(): { selectedIds: Set<string>, isSelecting: boolean, toggleSelection: (id: string) => void, selectAll: (ids: string[]) => void, deselectAll: () => void, isSelected: (id: string) => boolean }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/selection-state.tsx` — SelectionContext, SelectionProvider, useSelection Hook
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Kein UI — keine Checkboxen, keine Floating Action Bar, keine visuellen Komponenten
- Kein Persistieren des States (transient React State, kein localStorage, kein URL-State)
- Kein `source`-Feld (`'gallery' | 'lightbox'`) in diesem Slice — nur die Kern-State-Logik

**Technische Constraints:**
- `"use client"` Direktive am Dateianfang (Context + useState erfordern Client Component)
- `selectedIds` als `Set<string>` — keine Array-basierte Implementierung
- `isSelecting` wird abgeleitet: `selectedIds.size > 0` (kein separater boolescher State)
- Konsistent mit bestehendem Context-Pattern aus `lib/workspace-state.tsx`

**Referenzen:**
- Architecture: `architecture.md` → Section "Selection State Design" (Interface-Definition)
- Architecture: `architecture.md` → Section "Architecture Layers" (React Context Layer)
