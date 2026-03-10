# Slice 13: Lightbox Extensions — Move + Compare

> **Slice 13** für `Generation UI Improvements`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-13-lightbox-extensions` |
| **Test** | `pnpm test components/lightbox` |
| **E2E** | `false` |
| **Dependencies** | `["slice-05-bulk-db-actions", "slice-06-selection-context", "slice-12-compare-modal"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/lightbox` |
| **Integration Command** | `pnpm test components/lightbox --reporter=verbose` |
| **Acceptance Command** | `pnpm test components/lightbox` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` — `moveGeneration` Server Action + `useSelection` + `CompareModal` mocken |

---

## Ziel

`lightbox-modal.tsx` erhält drei neue Elemente: einen Move-Dropdown für Einzelbild-Verschiebung, eine Checkbox zur Compare-Selektion und eine floating Compare Bar. Damit können Nutzer Bilder direkt aus der Lightbox heraus verschieben und side-by-side vergleichen, ohne die Lightbox verlassen zu müssen.

---

## Acceptance Criteria

1) GIVEN die Lightbox ist geöffnet und `allProjects` enthält Projekte A (aktuell), B, C
   WHEN der Move-Dropdown-Button geklickt wird
   THEN öffnet sich ein Dropdown, das Projekt B und C enthält, aber Projekt A (das aktuelle) nicht anzeigt

2) GIVEN der Move-Dropdown ist geöffnet und Projekt B ist sichtbar
   WHEN Projekt B ausgewählt wird
   THEN wird `moveGeneration({ id: currentId, targetProjectId: projectB.id })` einmal aufgerufen

3) GIVEN `moveGeneration` gibt `{ success: true }` zurück
   WHEN die Action abgeschlossen ist
   THEN erscheint ein Sonner-Toast `"Image moved to '{ProjectName}'"` und die Lightbox schließt sich (`onClose` wird aufgerufen)

4) GIVEN `moveGeneration` gibt `{ error: "..." }` zurück
   WHEN die Action abgeschlossen ist
   THEN erscheint ein Fehler-Toast mit dem Fehlermeldungstext und die Lightbox bleibt offen

5) GIVEN die Lightbox ist geöffnet
   WHEN die Seite gerendert wird
   THEN ist eine Checkbox oben-links auf dem aktuellen Bild sichtbar (unchecked)

6) GIVEN die Lightbox-Checkbox ist unchecked
   WHEN die Checkbox geklickt wird
   THEN ist die aktuelle Bild-ID in `selectedIds` des SelectionContext enthalten (`toggleSelection` wurde aufgerufen)

7) GIVEN keine Bild-ID ist in der Lightbox-Compare-Selektion
   WHEN die Seite gerendert wird
   THEN ist die `LightboxCompareBar` nicht im DOM sichtbar

8) GIVEN genau 1 Bild-ID ist in der Lightbox-Compare-Selektion
   WHEN die Seite gerendert wird
   THEN ist die `LightboxCompareBar` sichtbar mit Text `"1 selected"`, der Compare-Button ist disabled

9) GIVEN 2 Bild-IDs sind in der Lightbox-Compare-Selektion
   WHEN die Seite gerendert wird
   THEN zeigt die `LightboxCompareBar` den Text `"2 selected"` und der Compare-Button ist aktiv (nicht disabled)

10) GIVEN 4 Bild-IDs sind in der Lightbox-Compare-Selektion
    WHEN eine weitere Checkbox geklickt wird (5. Bild)
    THEN ist die Checkbox des 5. Bildes disabled und zeigt einen Tooltip `"Max 4 images"`

11) GIVEN `LightboxCompareBar` ist sichtbar mit 2+ selektierten Bildern
    WHEN der Compare-Button geklickt wird
    THEN wird `CompareModal` mit den selektierten `Generation`-Objekten geöffnet (`isOpen=true`)

12) GIVEN `LightboxCompareBar` ist sichtbar
    WHEN der Abbrechen-Button geklickt wird
    THEN werden alle Lightbox-Compare-Selektionen geleert (`deselectAll` aufgerufen) und die `LightboxCompareBar` verschwindet

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstständig.

### Test-Datei: `components/lightbox/__tests__/lightbox-move-dropdown.test.tsx`

<test_spec>
```typescript
// AC-1: Dropdown zeigt alle Projekte ausser dem aktuellen
it.todo('should show all projects except the current project in dropdown')

// AC-2: moveGeneration wird mit korrekten Parametern aufgerufen
it.todo('should call moveGeneration with current generation id and selected project id')

// AC-3: Erfolg — Toast und onClose
it.todo('should show success toast and call onClose on moveGeneration success')

// AC-4: Fehler — Fehler-Toast, Modal bleibt offen
it.todo('should show error toast and keep lightbox open on moveGeneration error')
```
</test_spec>

### Test-Datei: `components/lightbox/__tests__/lightbox-modal-compare.test.tsx`

<test_spec>
```typescript
// AC-5: Checkbox initial sichtbar und unchecked
it.todo('should render visible unchecked checkbox on current image')

// AC-6: Checkbox-Klick ruft toggleSelection auf
it.todo('should call toggleSelection with current image id on checkbox click')

// AC-7: CompareBar nicht sichtbar bei 0 Selektionen
it.todo('should not render LightboxCompareBar when no images are selected')

// AC-8: CompareBar sichtbar bei 1 Selektion, Compare-Button disabled
it.todo('should render LightboxCompareBar with count 1 and disabled compare button')

// AC-9: CompareBar mit 2 Selektionen — Compare-Button aktiv
it.todo('should render compare button as enabled when 2 images are selected')

// AC-10: Checkbox disabled bei 4 Selektionen (5. Bild)
it.todo('should disable checkbox and show tooltip when 4 images already selected')

// AC-11: Compare-Button öffnet CompareModal
it.todo('should open CompareModal with selected generations when compare button clicked')

// AC-12: Abbrechen leert Selektion
it.todo('should call deselectAll and hide compare bar when cancel is clicked')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-05-bulk-db-actions` | `moveGeneration` | Server Action | `(input: { id: string, targetProjectId: string }) => Promise<{ success: boolean } \| { error: string }>` |
| `slice-06-selection-context` | `useSelection` | React Hook | `{ selectedIds, toggleSelection, deselectAll, isSelected }` |
| `slice-12-compare-modal` | `CompareModal` | React Component | `CompareModal({ generations, isOpen, onClose })` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `LightboxMoveDropdown` | React Component | `lightbox-modal.tsx` | `LightboxMoveDropdown({ generationId: string, currentProjectId: string, allProjects: Project[], onClose: () => void })` |
| `LightboxCompareBar` | React Component | `lightbox-modal.tsx` | `LightboxCompareBar({ selectedCount: number, onCompare: () => void, onCancel: () => void })` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/lightbox/lightbox-move-dropdown.tsx` — Button + Dropdown mit Projektliste (ohne aktuelles Projekt), ruft `moveGeneration` auf, zeigt Toast via sonner, ruft `onClose` bei Erfolg
- [ ] `components/lightbox/lightbox-compare-bar.tsx` — Floating Bar mit Count-Label, Compare-Button (aktiv bei 2–4), Abbrechen-Button
- [ ] `components/lightbox/lightbox-modal.tsx` — Integriert `LightboxMoveDropdown`, `lightbox-checkbox` (top-left auf Bild), `LightboxCompareBar` und öffnet `CompareModal`
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Keine Änderungen an `gallery-grid.tsx`, `floating-action-bar.tsx` oder `workspace-content.tsx`
- Kein Bulk-Select aus der Gallery (der Compare-State in der Lightbox ist eigenständig — `deselectAll` leert nur die Lightbox-Selektion, nicht den Gallery-State)
- Kein Move mehrerer Bilder gleichzeitig aus der Lightbox (Single-Move via `moveGeneration`, nicht `moveGenerations`)
- Kein direktes Rendern der `Generation`-Liste für Compare-Objekte: Die Lightbox hat Zugriff auf das aktuelle Generations-Array und filtert anhand der `selectedIds`

**Technische Constraints:**
- `"use client"` für alle drei Dateien
- Dropdown-Implementierung via `radix-ui Select` oder natives Dropdown-Pattern (konsistent mit bestehendem Pattern in der Codebase)
- Toast-Benachrichtigungen via `sonner` (bereits vorhanden, `architecture.md` → Integrations)
- Compare-Button disabled-Zustand: `selectedCount < 2 || selectedCount > 4`
- Max-4-Tooltip: `lucide-react` Icon + radix-ui Tooltip (bereits vorhanden)
- Checkbox-Disabled-State bei `selectedIds.size >= 4 && !isSelected(currentId)`

**Referenzen:**
- Wireframes: `wireframes.md` → "Screen: Lightbox Extensions" (alle drei Wireframes + State Variations)
- Architecture: `architecture.md` → "Migration Map" → Existing Files Modified (lightbox-modal.tsx Zeile)
- Architecture: `architecture.md` → "Component Architecture" → New Component Tree (LightboxModal-Ast)
