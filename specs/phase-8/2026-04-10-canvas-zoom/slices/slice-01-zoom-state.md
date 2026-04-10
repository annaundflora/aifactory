# Slice 1: Zoom State Extension

> **Slice 1 von 9** fuer `Canvas Zoom & Pan`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-01-zoom-state` |
| **Test** | `pnpm test __tests__/lib/canvas-detail-context.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test __tests__/lib/canvas-detail-context.test.ts` |
| **Integration Command** | -- |
| **Acceptance Command** | -- |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | -- |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

CanvasDetailContext um Zoom/Pan-State erweitern (3 neue Felder, 2 neue Actions), damit alle nachfolgenden Slices auf einem typisierten, validierten Zoom-State aufbauen koennen. Der Reducer clampt zoomLevel und resettet Zoom/Pan bei Image-Wechsel.

---

## Acceptance Criteria

1) GIVEN der Reducer im Initial-State
   WHEN kein Action dispatched
   THEN `zoomLevel === 1`, `panX === 0`, `panY === 0`

2) GIVEN der Reducer im Initial-State
   WHEN `SET_ZOOM_PAN` mit `{ zoomLevel: 2.0, panX: 100, panY: -50 }` dispatched
   THEN State enthaelt `zoomLevel === 2.0`, `panX === 100`, `panY === -50`

3) GIVEN der Reducer im Initial-State
   WHEN `SET_ZOOM_PAN` mit `{ zoomLevel: 5.0, panX: 0, panY: 0 }` dispatched
   THEN `zoomLevel === 3.0` (geclampt auf Maximum)

4) GIVEN der Reducer im Initial-State
   WHEN `SET_ZOOM_PAN` mit `{ zoomLevel: 0.1, panX: 0, panY: 0 }` dispatched
   THEN `zoomLevel === 0.5` (geclampt auf Minimum)

5) GIVEN State mit `zoomLevel: 2.5, panX: 120, panY: -80`
   WHEN `RESET_ZOOM_PAN` dispatched
   THEN `zoomLevel === 1`, `panX === 0`, `panY === 0`

6) GIVEN State mit `zoomLevel: 2.0, panX: 50, panY: 30`
   WHEN `SET_CURRENT_IMAGE` mit `{ generationId: "new-id" }` dispatched
   THEN `currentGenerationId === "new-id"`, `zoomLevel === 1`, `panX === 0`, `panY === 0`

7) GIVEN State mit `zoomLevel: 2.0, panX: 50, panY: 30, editMode: "inpaint", maskData: <non-null>`
   WHEN `SET_CURRENT_IMAGE` dispatched
   THEN `editMode`, `maskData`, `brushSize`, `brushTool` bleiben UNVERAENDERT (nur Zoom/Pan resettet)

8) GIVEN der Reducer im Initial-State
   WHEN `SET_ZOOM_PAN` mit `{ zoomLevel: NaN, panX: 0, panY: 0 }` dispatched
   THEN `zoomLevel` wird auf 0.5 oder 3.0 geclampt (NaN-safe Handling) ODER State bleibt unveraendert

---

## Test Skeletons

### Test-Datei: `__tests__/lib/canvas-detail-context.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('canvasDetailReducer - Zoom State', () => {
  // AC-1: Initial state defaults
  it.todo('should have zoomLevel=1, panX=0, panY=0 in initial state')

  // AC-2: SET_ZOOM_PAN with valid values
  it.todo('should set zoomLevel, panX, panY from SET_ZOOM_PAN payload')

  // AC-3: SET_ZOOM_PAN clamps zoomLevel above maximum
  it.todo('should clamp zoomLevel to 3.0 when payload exceeds maximum')

  // AC-4: SET_ZOOM_PAN clamps zoomLevel below minimum
  it.todo('should clamp zoomLevel to 0.5 when payload is below minimum')

  // AC-5: RESET_ZOOM_PAN resets to defaults
  it.todo('should reset zoomLevel to 1, panX to 0, panY to 0 on RESET_ZOOM_PAN')

  // AC-6: SET_CURRENT_IMAGE resets zoom/pan
  it.todo('should reset zoomLevel, panX, panY when SET_CURRENT_IMAGE is dispatched')

  // AC-7: SET_CURRENT_IMAGE preserves non-zoom state
  it.todo('should preserve editMode, maskData, brushSize, brushTool on SET_CURRENT_IMAGE')

  // AC-8: SET_ZOOM_PAN handles NaN zoomLevel
  it.todo('should handle NaN zoomLevel safely in SET_ZOOM_PAN')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| -- | -- | -- | Erster Slice, keine Dependencies |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `zoomLevel` | State-Feld | slice-02, slice-04, slice-05, slice-06, slice-07 | `state.zoomLevel: number` (0.5..3.0) |
| `panX`, `panY` | State-Felder | slice-02, slice-04, slice-05 | `state.panX: number`, `state.panY: number` |
| `SET_ZOOM_PAN` | Action | slice-02, slice-04, slice-05, slice-07 | `dispatch({ type: "SET_ZOOM_PAN", zoomLevel, panX, panY })` |
| `RESET_ZOOM_PAN` | Action | slice-03 | `dispatch({ type: "RESET_ZOOM_PAN" })` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/canvas-detail-context.tsx` -- State-Interface um zoomLevel/panX/panY erweitern, Action-Union um SET_ZOOM_PAN/RESET_ZOOM_PAN erweitern, Reducer-Cases hinzufuegen, Initial-State anpassen, SET_CURRENT_IMAGE-Case erweitern
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN UI-Code (ZoomControls kommt in Slice 3)
- KEIN Transform-Wrapper (kommt in Slice 2)
- KEIN Hook useCanvasZoom (kommt in Slice 2)
- KEINE Event-Handler (Wheel, Keyboard, Touch kommen in Slice 4/5/7)
- NUR Reducer-Logik und Type-Definitionen

**Technische Constraints:**
- Clamp-Grenzen: `0.5 <= zoomLevel <= 3.0` (siehe architecture.md -> Security -> Input Validation)
- Initial zoomLevel = `1` (nicht dynamisch berechnet; Fit-Level-Berechnung kommt in Slice 2)
- panX/panY muessen NaN/Infinity-safe sein (siehe architecture.md -> Security -> Input Validation)
- Bestehende Reducer-Cases und Tests duerfen NICHT brechen

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/canvas-detail-context.tsx` | EXTEND: State-Interface, Action-Union, Reducer, Initial-State. Bestehende 14 Action-Types + 12 State-Felder bleiben unberuehrt |

**Referenzen:**
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Architecture Detail: State Extension"
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Security -> Input Validation"
