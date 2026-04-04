# Slice 12: Outpaint Controls UI

> **Slice 12 von 16** fuer `AI Image Editing Suite`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-12-outpaint-controls` |
| **Test** | `pnpm test components/canvas/__tests__/outpaint-controls.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-canvas-detail-context"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/__tests__/outpaint-controls.test.tsx` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm test -- --run` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (Context dispatch gemockt) |

---

## Ziel

Neues Component `outpaint-controls.tsx` erstellen, das Direction-Buttons an den 4 Bildkanten (Top, Bottom, Left, Right) und eine Size-Selection (25%, 50%, 100%) rendert. Das Component liest `outpaintDirections` und `outpaintSize` aus dem Canvas Detail Context und dispatched `SET_OUTPAINT_DIRECTIONS` und `SET_OUTPAINT_SIZE` bei Interaktion.

---

## Acceptance Criteria

1) GIVEN das OutpaintControls Component wird gerendert
   WHEN kein initialer State gesetzt ist
   THEN sind 4 Direction-Buttons sichtbar (Top, Bottom, Left, Right) und keiner ist selektiert. Die Size-Selection zeigt 3 Optionen (25%, 50%, 100%) wobei 50% als Default vorausgewaehlt ist

2) GIVEN das OutpaintControls Component wird gerendert
   WHEN der User auf den "Top"-Direction-Button klickt
   THEN wird `SET_OUTPAINT_DIRECTIONS` mit `["top"]` dispatched

3) GIVEN `outpaintDirections` ist `["top"]` im Context
   WHEN der User auf den "Right"-Direction-Button klickt
   THEN wird `SET_OUTPAINT_DIRECTIONS` mit `["top", "right"]` dispatched (Mehrfachauswahl)

4) GIVEN `outpaintDirections` ist `["top", "right"]` im Context
   WHEN der User auf den "Top"-Direction-Button klickt (erneut)
   THEN wird `SET_OUTPAINT_DIRECTIONS` mit `["right"]` dispatched (Toggle-Off)

5) GIVEN `outpaintSize` ist `50` im Context
   WHEN der User auf den "100%"-Size-Button klickt
   THEN wird `SET_OUTPAINT_SIZE` mit `100` dispatched

6) GIVEN `outpaintDirections` ist `["top"]` im Context
   WHEN das Component gerendert wird
   THEN ist der "Top"-Direction-Button visuell hervorgehoben (selected State) und die anderen 3 sind nicht hervorgehoben

7) GIVEN `outpaintSize` ist `25` im Context
   WHEN das Component gerendert wird
   THEN ist der "25%"-Size-Button visuell hervorgehoben und "50%" sowie "100%" sind nicht hervorgehoben

8) GIVEN das OutpaintControls Component wird gerendert
   WHEN die 4 Direction-Buttons geprueft werden
   THEN ist "Top" oberhalb des Bild-Bereichs positioniert, "Bottom" unterhalb, "Left" links und "Right" rechts (Edge-Positionen gemaess wireframes.md → Outpaint Mode)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/__tests__/outpaint-controls.test.tsx`

<test_spec>
```typescript
// AC-1: Default-Rendering mit 4 Direction-Buttons und Size 50% vorausgewaehlt
it.todo('should render 4 direction buttons and pre-select 50% size')

// AC-2: Klick auf Top dispatched SET_OUTPAINT_DIRECTIONS mit ["top"]
it.todo('should dispatch SET_OUTPAINT_DIRECTIONS with ["top"] when Top clicked')

// AC-3: Klick auf Right bei bestehender Selection ["top"] ergibt ["top", "right"]
it.todo('should dispatch SET_OUTPAINT_DIRECTIONS with ["top", "right"] for multi-select')

// AC-4: Erneuter Klick auf Top bei ["top", "right"] toggled zu ["right"]
it.todo('should dispatch SET_OUTPAINT_DIRECTIONS with ["right"] when Top toggled off')

// AC-5: Klick auf 100% Size dispatched SET_OUTPAINT_SIZE mit 100
it.todo('should dispatch SET_OUTPAINT_SIZE with 100 when 100% clicked')

// AC-6: Selected Direction-Button ist visuell hervorgehoben
it.todo('should visually highlight the selected direction button')

// AC-7: Selected Size-Button ist visuell hervorgehoben
it.todo('should visually highlight the active size button')

// AC-8: Direction-Buttons an korrekten Positionen (Top oben, Bottom unten, etc.)
it.todo('should position direction buttons at the correct image edges')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-02-canvas-detail-context` | `outpaintDirections` | State-Feld (`OutpaintDirection[]`) | Context-Read: `state.outpaintDirections` |
| `slice-02-canvas-detail-context` | `outpaintSize` | State-Feld (`25 \| 50 \| 100`) | Context-Read: `state.outpaintSize` |
| `slice-02-canvas-detail-context` | `SET_OUTPAINT_DIRECTIONS` | Action-Type | `dispatch({ type: "SET_OUTPAINT_DIRECTIONS", outpaintDirections })` |
| `slice-02-canvas-detail-context` | `SET_OUTPAINT_SIZE` | Action-Type | `dispatch({ type: "SET_OUTPAINT_SIZE", outpaintSize })` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `OutpaintControls` | React Component | canvas-detail-view.tsx (Mounting-Slice) | `<OutpaintControls />` — liest Context intern, keine Props erforderlich |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/outpaint-controls.tsx` — Neues Component mit 4 Direction-Buttons an Bildkanten und Size-Selection (25%, 50%, 100%), verbunden mit Canvas Detail Context
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.
> **Mount-Point:** Das Einbinden von `OutpaintControls` in `canvas-detail-view.tsx` ist NICHT Teil dieses Slices. Die Architecture (Zeile 330) sieht das Mounting im Center-Column vor — das erfolgt in einem separaten Integration-Slice.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderung an `canvas-detail-view.tsx` (Mounting erfolgt in separatem Slice)
- KEINE Aenderung an `canvas-detail-context.tsx` (State/Actions bereits in Slice 02 definiert)
- KEINE Chat-Integration (Send-Button-Disabling bei fehlender Richtung ist Chat-Panel-Logik)
- KEINE Outpaint-Generierungslogik (API-Call, Canvas-Extension, Mask-Erstellung)
- KEIN Loading/Generating-State-Handling

**Technische Constraints:**
- Component liest State ueber `useCanvasDetail()` Hook (aus Slice 02)
- Toggle-Logik fuer Directions: Klick fuegt hinzu wenn nicht vorhanden, entfernt wenn vorhanden
- Size-Selection ist exklusiv (nur ein Wert aktiv: `25 | 50 | 100`)
- Direction-Buttons muessen an den Bildkanten positioniert sein (CSS absolute/relative Positionierung)
- `OutpaintDirection` Type: `"top" | "bottom" | "left" | "right"` (definiert in Slice 02)

**Referenzen:**
- Architecture: `architecture.md` → New Files Zeile 346 (outpaint-controls.tsx)
- Architecture: `architecture.md` → Migration Map Zeile 330 (canvas-detail-view mountet outpaint-controls)
- Wireframes: `wireframes.md` → Outpaint Mode (Zeile 260-308) — Direction-Buttons an Bildkanten, Size-Selector pro Richtung, Annotations 1-7
- Discovery: `discovery.md` → UI Components `outpaint-direction` und `outpaint-size` (Zeile 219-220)
- Discovery: `discovery.md` → State Transitions `outpaint-config` (Zeile 266-271)
