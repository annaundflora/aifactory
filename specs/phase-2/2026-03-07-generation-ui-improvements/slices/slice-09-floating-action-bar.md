# Slice 09: FloatingActionBar Component

> **Slice 09 von N** fuer `Generation UI Improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-09-floating-action-bar` |
| **Test** | `pnpm test components/workspace/floating-action-bar` |
| **E2E** | `false` |
| **Dependencies** | `["slice-06-selection-context"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/floating-action-bar` |
| **Integration Command** | `pnpm test components/workspace/floating-action-bar` |
| **Acceptance Command** | `pnpm test components/workspace/floating-action-bar` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

`FloatingActionBar` ist eine eigenstaendige, props-getriebene Komponente, die bei `selectedCount >= 1` sichtbar ist. Sie zeigt links Auswahl-Info ("N ausgewaehlt", "Alle auswaehlen", "Abbrechen") und rechts fuenf Aktions-Buttons (Move-Dropdown, Favorite, Compare, Download, Delete). Die Komponente fuehrt keine Aktionen selbst aus — alle Interaktionen werden als Callbacks nach aussen delegiert.

---

## Acceptance Criteria

1) GIVEN `selectedCount === 0`
   WHEN die Komponente gerendert wird
   THEN ist die Action Bar nicht im DOM (nicht nur versteckt — `null` oder nicht gemountet)

2) GIVEN `selectedCount === 1`
   WHEN die Komponente gerendert wird
   THEN ist die Action Bar sichtbar und zeigt den Text "1 ausgewaehlt"

3) GIVEN `selectedCount === 3`
   WHEN die Komponente gerendert wird
   THEN zeigt die Action Bar den Text "3 ausgewaehlt"

4) GIVEN beliebiger `selectedCount >= 1`
   WHEN der "Abbrechen"-Link/Button geklickt wird
   THEN wird der `onCancel`-Callback genau einmal aufgerufen

5) GIVEN beliebiger `selectedCount >= 1`
   WHEN "Alle auswaehlen" geklickt wird
   THEN wird `onSelectAll` genau einmal aufgerufen

6) GIVEN `selectedCount < 2`
   WHEN die Komponente gerendert wird
   THEN ist der Compare-Button `disabled` (aria-disabled oder disabled-Attribut)

7) GIVEN `selectedCount > 4`
   WHEN die Komponente gerendert wird
   THEN ist der Compare-Button `disabled`

8) GIVEN `selectedCount === 2`, `3` oder `4`
   WHEN die Komponente gerendert wird
   THEN ist der Compare-Button nicht disabled

9) GIVEN `selectedCount < 2` und der Compare-Button ist disabled
   WHEN der Benutzer ueber den Compare-Button hovert
   THEN ist ein Tooltip mit dem Text "2-4 Bilder auswaehlen zum Vergleichen" sichtbar (via radix-ui Tooltip)

10) GIVEN `selectedCount >= 1` und eine Liste von `projects` mit 2 Eintraegen (`[{ id, name }, { id, name }]`)
    WHEN der Move-Dropdown geoeffnet wird
    THEN listet das Dropdown genau diese 2 Projekte als Optionen

11) GIVEN der Move-Dropdown und ein Projekt in der Liste wird ausgewaehlt
    WHEN die Auswahl getroffen wird
    THEN wird `onMove` mit der `id` des ausgewaehlten Projekts aufgerufen

12) GIVEN `selectedCount >= 1`
    WHEN der Favorite-Button geklickt wird
    THEN wird `onFavorite` genau einmal aufgerufen

13) GIVEN `selectedCount >= 1`
    WHEN der Download-Button geklickt wird
    THEN wird `onDownload` genau einmal aufgerufen

14) GIVEN `selectedCount >= 1`
    WHEN der Delete-Button geklickt wird
    THEN wird `onDelete` genau einmal aufgerufen

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/workspace/__tests__/floating-action-bar.test.tsx`

<test_spec>
```typescript
// AC-1: Bar nicht sichtbar bei selectedCount === 0
it.todo('should not render action bar when selectedCount is 0')

// AC-2: Bar sichtbar bei selectedCount === 1 mit korrektem Text
it.todo('should render action bar with "1 ausgewaehlt" when selectedCount is 1')

// AC-3: Korrekter Count-Text bei selectedCount === 3
it.todo('should display "3 ausgewaehlt" when selectedCount is 3')

// AC-4: onCancel wird bei Abbrechen-Klick aufgerufen
it.todo('should call onCancel once when Abbrechen is clicked')

// AC-5: onSelectAll wird bei Alle-auswaehlen-Klick aufgerufen
it.todo('should call onSelectAll once when Alle auswaehlen is clicked')

// AC-6: Compare-Button disabled bei selectedCount < 2
it.todo('should disable Compare button when selectedCount is less than 2')

// AC-7: Compare-Button disabled bei selectedCount > 4
it.todo('should disable Compare button when selectedCount is greater than 4')

// AC-8: Compare-Button aktiv bei selectedCount 2, 3 oder 4
it.todo('should enable Compare button when selectedCount is 2, 3 or 4')

// AC-9: Tooltip am Compare-Button bei disabled-State
it.todo('should show tooltip with correct text when Compare button is disabled and hovered')

// AC-10: Move-Dropdown listet uebergebene Projekte
it.todo('should list all provided projects in Move dropdown')

// AC-11: onMove wird mit Projekt-ID aufgerufen
it.todo('should call onMove with project id when a project is selected in Move dropdown')

// AC-12: onFavorite wird bei Favorite-Klick aufgerufen
it.todo('should call onFavorite once when Favorite button is clicked')

// AC-13: onDownload wird bei Download-Klick aufgerufen
it.todo('should call onDownload once when Download button is clicked')

// AC-14: onDelete wird bei Delete-Klick aufgerufen
it.todo('should call onDelete once when Delete button is clicked')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-06-selection-context | `useSelection` | React Hook | Import kompiliert, `selectedCount` aus `selectedIds.size` ableitbar |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `FloatingActionBar` | React Component | workspace-content (Integration Slice) | `FloatingActionBar({ selectedCount: number, projects: Array<{ id: string, name: string }>, onCancel: () => void, onSelectAll: () => void, onMove: (projectId: string) => void, onFavorite: () => void, onCompare: () => void, onDownload: () => void, onDelete: () => void })` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/floating-action-bar.tsx` — Eigenstaendige FloatingActionBar-Komponente mit allen Props/Callbacks, Move-Dropdown, Compare-Tooltip
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Keine echten Server Actions aufrufen — alle Aktionen nur via Callbacks nach aussen delegieren
- Kein Confirm-Dialog — der Aufrufer (workspace-content) ist verantwortlich fuer Delete-Confirmation
- Keine Integration mit `SelectionProvider` direkt — Props statt Context-Zugriff (reine Presentational Component)
- Kein Bulk-Download-Logik, kein ZIP — nur `onDownload`-Callback

**Technische Constraints:**
- `"use client"` Direktive erforderlich (interaktive Buttons, Dropdown-State)
- Compare-Disabled-Tooltip: radix-ui `Tooltip` (bereits in radix-ui@1.4.3)
- Move-Dropdown: radix-ui `DropdownMenu` oder `Select` — konsistent mit bestehendem Codebase-Pattern
- Icons: lucide-react (`Move`, `Star`, `GitCompare`, `Download`, `Trash2`)
- Styling: TailwindCSS 4, sticky bottom bar, zentriert ueber Gallery

**Referenzen:**
- Wireframes: `wireframes.md` → Section "Screen: Gallery with Bulk Select" — Selecting State Wireframe + Annotations ③④⑤⑥⑦⑧
- Wireframes: `wireframes.md` → Section "State Variations" — `compare-btn-disabled` Tooltip-Text
- Architecture: `architecture.md` → Section "Component Architecture" — `FloatingActionBar` Position im Component Tree
