# Slice 13: Upscale Popover

> **Slice 13 von 18** fuer `Canvas Detail-View & Editing Flow`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-13-upscale-popover` |
| **Test** | `pnpm test components/canvas/__tests__/upscale-popover.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-07-toolbar-ui"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/__tests__/upscale-popover.test.tsx` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | `pnpm test components/canvas/__tests__/upscale-popover.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Kleines schwebendes Radix Popover neben dem Upscale-Toolbar-Icon mit zwei Buttons (2x Upscale, 4x Upscale). Disabled-State mit Tooltip wenn das Bild zu gross ist. Dieses Slice ist rein UI — die Action-Anbindung (`upscaleImage()` Server Action) erfolgt in Slice 14.

---

## Acceptance Criteria

1) GIVEN `activeToolId` ist `"upscale"` im CanvasDetailContext
   WHEN das Popover gerendert wird
   THEN ist das Popover sichtbar, positioniert neben dem Upscale-Toolbar-Icon, und zeigt einen Titel "Upscale" sowie genau zwei Buttons: "2x Upscale" und "4x Upscale"

2) GIVEN das Upscale-Popover ist sichtbar
   WHEN der User auf den "2x Upscale"-Button klickt
   THEN wird ein `onUpscale`-Callback mit `{ scale: 2 }` aufgerufen und das Popover schliesst sich (`activeToolId` wird auf `null` gesetzt)

3) GIVEN das Upscale-Popover ist sichtbar
   WHEN der User auf den "4x Upscale"-Button klickt
   THEN wird ein `onUpscale`-Callback mit `{ scale: 4 }` aufgerufen und das Popover schliesst sich (`activeToolId` wird auf `null` gesetzt)

4) GIVEN das Upscale-Popover ist sichtbar
   WHEN der User ausserhalb des Popovers klickt
   THEN schliesst sich das Popover (`activeToolId` wird auf `null` gesetzt)

5) GIVEN `activeToolId` ist nicht `"upscale"` (z.B. `null` oder `"variation"`)
   WHEN die Komponente gerendert wird
   THEN ist das Popover nicht sichtbar (kein DOM-Element fuer Popover-Content)

6) GIVEN die aktuelle Generation hat Dimensionen die zu gross fuer Upscale sind (`isUpscaleDisabled: true`)
   WHEN die Toolbar gerendert wird
   THEN ist das Upscale-Icon visuell als disabled dargestellt, nicht klickbar, und zeigt bei Hover einen Tooltip mit dem Text "Image too large for upscale"

7) GIVEN `isUpscaleDisabled` ist `true`
   WHEN der User auf das Upscale-Icon klickt
   THEN passiert nichts (Popover oeffnet sich nicht, `activeToolId` bleibt unveraendert)

8) GIVEN `isUpscaleDisabled` ist `false` (normales Bild)
   WHEN der User auf das Upscale-Icon klickt
   THEN oeffnet sich das Popover normal (kein Tooltip, kein Disabled-State)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/__tests__/upscale-popover.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('UpscalePopover', () => {
  // AC-1: Popover sichtbar mit Titel und zwei Buttons
  it.todo('should render popover with title "Upscale" and two buttons "2x Upscale" and "4x Upscale" when activeToolId is "upscale"')

  // AC-2: 2x-Button ruft Callback mit scale 2 auf
  it.todo('should call onUpscale with scale 2 and close popover when "2x Upscale" is clicked')

  // AC-3: 4x-Button ruft Callback mit scale 4 auf
  it.todo('should call onUpscale with scale 4 and close popover when "4x Upscale" is clicked')

  // AC-4: Klick ausserhalb schliesst Popover
  it.todo('should close popover when clicking outside')

  // AC-5: Popover unsichtbar wenn nicht aktiv
  it.todo('should not render popover content when activeToolId is not "upscale"')

  // AC-6: Disabled-Icon mit Tooltip bei zu grossem Bild
  it.todo('should show disabled upscale icon with tooltip "Image too large for upscale" when isUpscaleDisabled is true')

  // AC-7: Klick auf Disabled-Icon hat keine Wirkung
  it.todo('should not open popover when upscale icon is clicked in disabled state')

  // AC-8: Normaler Klick bei nicht-disabled
  it.todo('should open popover normally when isUpscaleDisabled is false')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03-canvas-detail-context` | `useCanvasDetail()` | React Hook | `state.activeToolId`, `dispatch({ type: 'SET_ACTIVE_TOOL', payload: null })` |
| `slice-07-toolbar-ui` | `activeToolId === "upscale"` | Context State | Popover oeffnet wenn Toolbar-Button Upscale aktiviert |
| `slice-07-toolbar-ui` | `ToolbarButton` disabled-Prop | Component Prop | Toolbar steuert Disabled-State des Upscale-Icons |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `UpscalePopover` | React Component | `slice-05` / `slice-14` | `<UpscalePopover onUpscale={(params: { scale: 2 \| 4 }) => void} isUpscaleDisabled={boolean} />` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/popovers/upscale-popover.tsx` -- Radix Popover mit Titel, 2x/4x Buttons, Disabled-State mit Tooltip
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Server Action aufrufen (Buttons rufen nur `onUpscale`-Callback auf, Anbindung in Slice 14)
- KEINE Loading-States oder Generating-Overlay (Slice 14)
- KEIN Model-Selector (Upscale nutzt hardcoded `nightmareai/real-esrgan`, gesteuert in Slice 14)
- KEINE Berechnung der Groessen-Limite (Prop `isUpscaleDisabled` wird von der Parent-Komponente geliefert)
- KEIN Variation/img2img-Popover (Slices 11 und 12)

**Technische Constraints:**
- `"use client"` Direktive
- Radix Popover aus `components/ui/popover.tsx` (existiert im Projekt)
- Radix Tooltip aus `components/ui/tooltip.tsx` fuer Disabled-Tooltip (existiert im Projekt)
- Popover-Positionierung: `side="right"` relativ zum Toolbar-Anchor

**Referenzen:**
- Wireframes: `specs/phase-4/2026-03-13-canvas-detail-view/wireframes.md` -> "Screen: Upscale Popover" fuer Layout und Annotations
- Wireframes: `wireframes.md` -> "Screen: Error State" fuer `upscale-unavailable` State
- Discovery: `discovery.md` -> "UI Components & States" -> `popover.upscale` und `toolbar.upscale` fuer States
- Architecture: `architecture.md` -> Section "Error Handling Strategy" fuer "Upscale too large" Handling
- Architecture: `architecture.md` -> Section "Constraints" fuer hardcoded Model `nightmareai/real-esrgan`
