# Slice 10: Details Overlay

> **Slice 10 von 18** fuer `Canvas Detail-View & Editing Flow`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-10-details-overlay` |
| **Test** | `pnpm test components/canvas/__tests__/details-overlay.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-07-toolbar-ui"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/__tests__/details-overlay.test.tsx` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | `pnpm test components/canvas/__tests__/details-overlay.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Collapsible Details-Panel am oberen Rand des Canvas-Bereichs implementieren, das Bild-Metadaten (Prompt, Model, Steps, CFG, Seed, Size) und die bestehende ProvenanceRow anzeigt. Das Panel wird ueber den `activeToolId === "details"` State aus dem CanvasDetailContext gesteuert und schiebt den Canvas-Inhalt per Push-down-Layout nach unten.

---

## Acceptance Criteria

1) GIVEN `activeToolId` ist `"details"` im CanvasDetailContext
   WHEN das DetailsOverlay gerendert wird
   THEN ist das Panel sichtbar (expanded) und der Canvas-Bereich darunter wird nach unten verschoben

2) GIVEN `activeToolId` ist `null` oder ein anderer Wert als `"details"`
   WHEN das DetailsOverlay gerendert wird
   THEN ist das Panel eingeklappt (collapsed, height 0) und der Canvas-Bereich nutzt die volle Hoehe

3) GIVEN das Overlay ist expanded und die Generation hat `prompt: "A beautiful sunset over mountains with golden light"`
   WHEN das Panel gerendert wird
   THEN zeigt es den vollstaendigen Prompt-Text (nicht gekuerzt)

4) GIVEN das Overlay ist expanded und die Generation hat `modelId: "flux-2-max"`, `steps: 30`, `cfgScale: 7.0`, `seed: 42`, `width: 1024`, `height: 1024`
   WHEN das Panel gerendert wird
   THEN zeigt es alle Parameter: Model-Name, Steps, CFG, Seed, Size als "1024x1024"

5) GIVEN das Overlay ist expanded und die Generation hat Referenz-Inputs (Provenance-Daten)
   WHEN das Panel gerendert wird
   THEN rendert es die bestehende `ProvenanceRow`-Komponente mit der `generationId` der aktuellen Generation

6) GIVEN das Overlay ist expanded und die Generation hat KEINE Referenz-Inputs (reine txt2img)
   WHEN das Panel gerendert wird
   THEN wird die Provenance-Section nicht angezeigt (kein leerer Bereich)

7) GIVEN das Overlay ist expanded
   WHEN der User auf den "Hide"-Button im Overlay-Header klickt
   THEN wird `activeToolId` auf `null` gesetzt und das Panel klappt ein

8) GIVEN das Overlay wechselt zwischen collapsed und expanded
   WHEN die Transition stattfindet
   THEN animiert das Panel sanft (CSS transition auf height/max-height, kein abrupter Sprung)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/__tests__/details-overlay.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('DetailsOverlay', () => {
  // AC-1: Overlay sichtbar wenn activeToolId === "details"
  it.todo('should render expanded panel when activeToolId is "details"')

  // AC-2: Overlay hidden wenn activeToolId !== "details"
  it.todo('should render collapsed panel when activeToolId is not "details"')

  // AC-3: Vollstaendiger Prompt-Text
  it.todo('should display full prompt text without truncation')

  // AC-4: Alle Metadata-Parameter anzeigen
  it.todo('should display model name, steps, CFG, seed, and size as "WIDTHxHEIGHT"')

  // AC-5: ProvenanceRow mit generationId rendern
  it.todo('should render ProvenanceRow component with current generation id')

  // AC-6: Keine Provenance bei reiner txt2img
  it.todo('should not render provenance section when generation has no reference inputs')

  // AC-7: Hide-Button setzt activeToolId auf null
  it.todo('should dispatch SET_ACTIVE_TOOL with null when Hide button is clicked')

  // AC-8: Animierte Transition
  it.todo('should have CSS transition classes for smooth expand/collapse animation')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03-canvas-detail-context` | `useCanvasDetail()` | React Hook | `state.activeToolId`, `dispatch({ type: 'SET_ACTIVE_TOOL', payload: null })` |
| `slice-07-toolbar-ui` | `activeToolId === "details"` | State-Signal | Toolbar setzt `activeToolId` auf `"details"` bei Klick auf Details-Icon |
| Existing | `ProvenanceRow` | React Component | `<ProvenanceRow generationId={string} />` aus `components/lightbox/provenance-row.tsx` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `DetailsOverlay` | React Component | `slice-05` (Canvas-Bereich) | `<DetailsOverlay generation={Generation} />` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/details-overlay.tsx` -- Collapsible Panel mit Prompt, Model-Params, ProvenanceRow und Push-down-Layout
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen am CanvasDetailContext-Reducer (Slice 3 stellt SET_ACTIVE_TOOL bereit)
- KEINE Aenderungen an der Toolbar (Slice 7 stellt den Details-Toggle bereit)
- KEINE eigene Daten-Fetching-Logik (Generation-Objekt wird als Prop uebergeben)
- KEINE Bearbeitung der Parameter (reine Anzeige)

**Technische Constraints:**
- `"use client"` Direktive
- Wiederverwendung der existierenden `ProvenanceRow` aus `components/lightbox/provenance-row.tsx`
- Push-down-Layout via natuerlichen DOM-Flow (kein absolute/fixed Positioning) — Overlay ist im normalen Fluss oberhalb des Canvas-Image
- CSS `transition` fuer smooth Expand/Collapse Animation (z.B. auf `max-height` oder `grid-template-rows`)
- Generation-Typ aus `lib/db/schema.ts` fuer typsichere Props

**Referenzen:**
- Wireframes: `specs/phase-4/2026-03-13-canvas-detail-view/wireframes.md` -> "Screen: Details Overlay" fuer Layout und Annotations
- Discovery: `discovery.md` -> "UI Components & States" -> `details-overlay` fuer States (collapsed/expanded)
- Architecture: `architecture.md` -> Section "Files to Keep" bestaetigt ProvenanceRow-Wiederverwendung
