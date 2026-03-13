# Slice 7: Toolbar UI (Icon Bar)

> **Slice 7 von 18** fuer `Canvas Detail-View & Editing Flow`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-07-toolbar-ui` |
| **Test** | `pnpm test components/canvas/__tests__/canvas-toolbar.test.tsx components/canvas/__tests__/toolbar-button.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-05-detail-view-shell"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/__tests__/canvas-toolbar.test.tsx components/canvas/__tests__/toolbar-button.test.tsx` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | `pnpm test components/canvas/__tests__/canvas-toolbar.test.tsx components/canvas/__tests__/toolbar-button.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Vertikale Icon-Toolbar (48px breit) im Toolbar-Slot der CanvasDetailView rendern. 6 Tool-Icons (Variation, img2img, Upscale, Download, Delete, Details) mit Active-State-Highlighting, Toggle-Verhalten und Disabled-State waehrend Generation. Download triggert direkten Datei-Download, Delete zeigt Confirmation-Dialog.

---

## Acceptance Criteria

1) GIVEN die CanvasDetailView ist sichtbar
   WHEN die Toolbar gerendert wird
   THEN zeigt sie 6 Icons vertikal gestapelt in folgender Reihenfolge (top-down): Variation, img2img, Upscale, Download, Delete, Details

2) GIVEN kein Tool ist aktiv
   WHEN der User auf das Variation-Icon klickt
   THEN wird das Variation-Icon als aktiv hervorgehoben (visuell unterscheidbar) und `activeToolId` im CanvasDetailContext ist `"variation"`

3) GIVEN das Variation-Icon ist aktiv (`activeToolId: "variation"`)
   WHEN der User erneut auf das Variation-Icon klickt
   THEN wird es deaktiviert und `activeToolId` im CanvasDetailContext ist `null`

4) GIVEN das Variation-Icon ist aktiv
   WHEN der User auf das img2img-Icon klickt
   THEN wechselt der Active-State: img2img ist aktiv, Variation ist inaktiv, `activeToolId` ist `"img2img"`

5) GIVEN die CanvasDetailView zeigt ein Bild mit `imageUrl: "https://r2.example.com/image.png"`
   WHEN der User auf das Download-Icon klickt
   THEN wird ein Datei-Download der Bild-URL gestartet (kein Popover, kein Active-State)

6) GIVEN die CanvasDetailView zeigt ein Bild
   WHEN der User auf das Delete-Icon klickt
   THEN erscheint ein AlertDialog mit Titel "Delete Image?", Beschreibung "This action cannot be undone." und Buttons "Cancel" und "Delete"

7) GIVEN der Delete-AlertDialog ist sichtbar
   WHEN der User auf "Cancel" klickt
   THEN schliesst der Dialog und das Bild bleibt unveraendert

8) GIVEN der Delete-AlertDialog ist sichtbar
   WHEN der User auf "Delete" klickt
   THEN wird der `onDelete`-Callback aufgerufen und der Dialog schliesst

9) GIVEN `isGenerating` ist `true` im CanvasDetailContext
   WHEN die Toolbar gerendert wird
   THEN sind alle 6 Icons visuell als disabled dargestellt und nicht klickbar

10) GIVEN kein Tool ist aktiv
    WHEN der User auf das Details-Icon klickt
    THEN wird `activeToolId` auf `"details"` gesetzt (Details-Overlay-Toggle wird von Slice 10 konsumiert)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/__tests__/canvas-toolbar.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('CanvasToolbar', () => {
  // AC-1: 6 Icons in korrekter Reihenfolge
  it.todo('should render 6 tool icons in correct order: Variation, img2img, Upscale, Download, Delete, Details')

  // AC-2: Klick auf Tool setzt activeToolId
  it.todo('should set activeToolId to "variation" when Variation icon is clicked')

  // AC-3: Zweiter Klick deaktiviert Tool
  it.todo('should set activeToolId to null when active tool icon is clicked again')

  // AC-4: Klick auf anderes Tool wechselt Active-State
  it.todo('should switch activeToolId when a different tool icon is clicked')

  // AC-5: Download startet Datei-Download
  it.todo('should trigger file download when Download icon is clicked')

  // AC-6: Delete zeigt AlertDialog
  it.todo('should show AlertDialog with correct content when Delete icon is clicked')

  // AC-7: Cancel schliesst Dialog
  it.todo('should close AlertDialog without action when Cancel is clicked')

  // AC-8: Delete-Confirm ruft Callback auf
  it.todo('should call onDelete callback when Delete is confirmed')

  // AC-9: Alle Icons disabled waehrend isGenerating
  it.todo('should disable all icons when isGenerating is true')

  // AC-10: Details-Icon setzt activeToolId auf "details"
  it.todo('should set activeToolId to "details" when Details icon is clicked')
})
```
</test_spec>

### Test-Datei: `components/canvas/__tests__/toolbar-button.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ToolbarButton', () => {
  // AC-2: Active-State visuell erkennbar
  it.todo('should render with active styling when isActive is true')

  // AC-9: Disabled-State visuell und funktional
  it.todo('should render as disabled and not respond to clicks when disabled is true')

  // Basis: Standard-Rendering
  it.todo('should render icon and be clickable in default state')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03-canvas-detail-context` | `useCanvasDetail()` | React Hook | `state.activeToolId`, `state.isGenerating`, `dispatch({ type: 'SET_ACTIVE_TOOL' })` |
| `slice-05-detail-view-shell` | Toolbar-Slot (left column, 48px) | Layout Slot | CanvasDetailView rendert Toolbar im linken Slot |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `CanvasToolbar` | React Component | `slice-05` (Toolbar-Slot) | `<CanvasToolbar generation={Generation} onDelete={() => void} />` |
| `ToolbarButton` | React Component | intern | `<ToolbarButton icon={LucideIcon} isActive={boolean} disabled={boolean} onClick={() => void} tooltip={string} />` |
| `activeToolId` State-Changes | Context Dispatch | `slice-10`, `slice-11`, `slice-12`, `slice-13` | Popovers/Overlay lesen `activeToolId` um sich zu oeffnen/schliessen |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/canvas-toolbar.tsx` -- Toolbar-Container mit 6 Tool-Icons, Active-State-Management, Download-Trigger, Delete-AlertDialog
- [ ] `components/canvas/toolbar-button.tsx` -- Einzelner Tool-Button mit Active/Disabled/Default States und Tooltip
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Popover-Inhalte rendern (Variation/img2img/Upscale-Popovers sind Slices 11-13)
- KEINE Details-Overlay-Logik (Slice 10 konsumiert `activeToolId === "details"`)
- KEINE Delete-Server-Action aufrufen (nur `onDelete`-Callback, In-Place-Delete ist Slice 14)
- KEINE Aenderung am CanvasDetailContext-Reducer (Slice 3 stellt SET_ACTIVE_TOOL bereit)
- KEIN Model-Selector (Slice 14)

**Technische Constraints:**
- `"use client"` Direktive
- Icons aus `lucide-react` (bereits im Projekt)
- AlertDialog aus `components/ui/alert-dialog.tsx` (Radix-basiert, existiert im Projekt)
- Download via `<a href={url} download>` oder programmatischer Fetch+Blob-Download
- Toolbar-Breite exakt 48px (vorgegeben durch Slice 5 Toolbar-Slot)

**Referenzen:**
- Wireframes: `specs/phase-4/2026-03-13-canvas-detail-view/wireframes.md` -> "Toolbar Detail" fuer Icon-Reihenfolge und Layout
- Wireframes: `wireframes.md` -> "Screen: Delete Confirmation" fuer Dialog-Text
- Discovery: `discovery.md` -> "UI Components & States" fuer Toolbar-States (default, tool-active, disabled)
- Architecture: `architecture.md` -> Section "Integrations" fuer Lucide React und Radix UI Versionen
