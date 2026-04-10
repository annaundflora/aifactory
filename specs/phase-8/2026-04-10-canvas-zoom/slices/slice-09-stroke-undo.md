# Slice 9: Procreate-Style Stroke-Undo bei Gestenstart

> **Slice 9 von 9** fuer `Canvas Zoom & Pan`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-09-stroke-undo` |
| **Test** | `pnpm test __tests__/lib/hooks/use-touch-gestures.test.ts __tests__/components/canvas/mask-canvas.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-07-touch-pinch-pan"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test __tests__/lib/hooks/use-touch-gestures.test.ts __tests__/components/canvas/mask-canvas.test.tsx` |
| **Integration Command** | -- |
| **Acceptance Command** | -- |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | -- |
| **Mocking Strategy** | `mock_external` (TouchEvent simulieren, Canvas-Context mocken) |

---

## Ziel

Waehrend eines aktiven Mask-Strokes (isDrawing=true) soll das Aufsetzen eines zweiten Fingers den laufenden Stroke automatisch rueckgaengig machen (via maskUndoStackRef), isDrawing auf false setzen und den Gesten-Modus (Pinch/Pan aus Slice 7) aktivieren. Nach Loslassen beider Finger kehrt der Modus zurueck zu Mask-Painting. Race-Conditions werden durch das isDrawing-Flag und requestAnimationFrame-Gating verhindert.

---

## Acceptance Criteria

1) GIVEN editMode ist "inpaint" oder "erase" und der User zeichnet einen Mask-Stroke (isDrawing === true)
   WHEN ein zweiter Finger auf den Canvas-Container kommt (touches.length wechselt von 1 auf 2)
   THEN wird der aktuelle Stroke rueckgaengig gemacht: Canvas-State wird auf den letzten Eintrag im maskUndoStackRef zurueckgesetzt, der oberste Stack-Eintrag wird entfernt

2) GIVEN AC-1 Stroke-Undo wurde ausgefuehrt
   WHEN der Stroke-Undo abgeschlossen ist
   THEN isDrawing ist false, pointerCapture ist released, und der Gesten-Modus (Pinch/Pan) wird aktiviert

3) GIVEN AC-2 Gesten-Modus ist aktiv nach Stroke-Undo
   WHEN der User Pinch/Pan ausfuehrt (Finger bewegen sich)
   THEN funktioniert Zoom/Pan normal wie in Slice 7 spezifiziert (keine Interferenz durch den vorherigen Stroke)

4) GIVEN Gesten-Modus ist aktiv nach Stroke-Undo
   WHEN alle Finger losgelassen werden (touches.length === 0)
   THEN kehrt der Modus zurueck zu Mask-Painting (naechster einzelner Finger-Touch startet neuen Stroke)

5) GIVEN editMode ist "inpaint" oder "erase" und isDrawing === false (kein aktiver Stroke)
   WHEN ein zweiter Finger aufgesetzt wird
   THEN wird KEIN Undo ausgefuehrt (nur Pinch/Pan-Geste startet, maskUndoStackRef bleibt unveraendert)

6) GIVEN editMode ist null, "instruction" oder "outpaint"
   WHEN ein zweiter Finger waehrend eines Touch aufgesetzt wird
   THEN wird KEIN Undo ausgefuehrt (Stroke-Undo ist nur im Mask-Modus relevant)

7) GIVEN der maskUndoStackRef ist leer und isDrawing === true
   WHEN ein zweiter Finger aufgesetzt wird
   THEN wird isDrawing auf false gesetzt und Gesten-Modus aktiviert, aber KEIN Canvas-Restore ausgefuehrt (leerer Stack = nichts rueckgaengig zu machen)

8) GIVEN ein Stroke-Undo wurde ausgefuehrt (AC-1)
   WHEN der maskData-State nach dem Undo ausgelesen wird
   THEN ist maskData konsistent mit dem Canvas-Inhalt (kein "Ghost-Stroke" der visuell weg ist aber im State noch existiert)

9) GIVEN isDrawing === true und ein schneller 1->2 Finger-Wechsel geschieht (innerhalb von < 50ms)
   WHEN die Race-Condition-Pruefung laeuft
   THEN wird der Undo trotzdem korrekt ausgefuehrt (requestAnimationFrame-gated, isDrawing wird atomar geprueft)

---

## Test Skeletons

### Test-Datei: `__tests__/lib/hooks/use-touch-gestures.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('useTouchGestures - Stroke-Undo bei Gestenstart', () => {
  // AC-1: Stroke-Undo bei 1->2 Finger-Transition
  it.todo('should trigger stroke undo when second finger arrives during active drawing')

  // AC-2: isDrawing reset und Gesten-Modus Aktivierung
  it.todo('should set isDrawing to false and activate gesture mode after stroke undo')

  // AC-3: Pinch/Pan funktioniert nach Stroke-Undo
  it.todo('should allow normal pinch/pan gesture after stroke undo completes')

  // AC-4: Rueckkehr zu Mask-Modus nach Gesture-Ende
  it.todo('should return to mask painting mode when all fingers are lifted after gesture')

  // AC-5: Kein Undo wenn isDrawing false
  it.todo('should not trigger undo when second finger arrives but isDrawing is false')

  // AC-6: Kein Undo ausserhalb Mask-Modus
  it.todo('should not trigger undo when editMode is not inpaint or erase')

  // AC-7: Leerer Undo-Stack
  it.todo('should deactivate drawing and start gesture without canvas restore when undo stack is empty')

  // AC-9: Race-Condition bei schnellem Finger-Wechsel
  it.todo('should handle rapid 1-to-2 finger transition within 50ms correctly')
})
```
</test_spec>

### Test-Datei: `__tests__/components/canvas/mask-canvas.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('MaskCanvas - Stroke-Undo Integration', () => {
  // AC-8: maskData-Konsistenz nach Undo
  it.todo('should have consistent maskData state after stroke undo (no ghost stroke)')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-07-touch-pinch-pan` | `useTouchGestures` | Hook | Hook wird erweitert — bestehende Pinch/Pan-Logik bleibt intakt |
| `slice-07-touch-pinch-pan` | Gesture-State-Machine | Internes State | Stroke-Undo triggert Transition von `idle` -> `gesture` |
| `slice-01-zoom-state` | `editMode` | State-Feld | `useCanvasDetail()` — Guard fuer inpaint/erase Pruefung |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `isDrawingRef` | Ref (exposed) | `useTouchGestures` | `MutableRefObject<boolean>` — lesbar fuer Gesture-Hook |
| `maskUndoStackRef` | Ref (exposed) | `useTouchGestures` | `MutableRefObject<ImageData[]>` — pop + Canvas-Restore |
| `canvasRef` | Ref (exposed) | `useTouchGestures` | `MutableRefObject<HTMLCanvasElement>` — fuer Canvas-Restore |
| Stroke-Undo Callback | Function | `useTouchGestures` | `() => void` — fuehrt Undo + isDrawing=false + pointerCapture-Release aus |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/hooks/use-touch-gestures.ts` -- MODIFY: Stroke-Undo-Trigger bei 1->2 Finger-Transition einbauen, isDrawing-Flag pruefen, maskUndoStackRef konsumieren, requestAnimationFrame-Gating fuer Race-Condition-Schutz
- [ ] `components/canvas/mask-canvas.tsx` -- MODIFY: isDrawingRef, maskUndoStackRef und canvasRef exponieren (oder Stroke-Undo-Callback bereitstellen), damit der Gesture-Hook darauf zugreifen kann
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an der Pinch/Pan-Logik selbst (kommt aus Slice 7)
- KEINE Aenderungen an der Keyboard-Undo-Logik (Ctrl+Z bleibt unveraendert)
- KEINE neuen UI-Elemente
- KEIN Double-Tap-Handling
- NUR die 1->2 Finger-Transition waehrend eines aktiven Strokes

**Technische Constraints:**
- isDrawingRef wird atomar geprueft: Undo nur wenn `isDrawingRef.current === true` zum Zeitpunkt der 2. Finger-Erkennung
- requestAnimationFrame-Gating: Der Undo+Gesture-Transition wird in einem rAF-Callback ausgefuehrt, um sicherzustellen dass der aktuelle Paint-Frame abgeschlossen ist
- pointerCapture muss released werden bevor Gesten-Modus startet (sonst blockiert Capture die Touch-Events)
- Canvas-Restore Pattern: `ctx.clearRect()` + `ctx.putImageData(stackEntry)` (identisch zum bestehenden Ctrl+Z Pattern in mask-canvas.tsx Zeile 106-130)
- maskData-Dispatch nach Undo: Falls der restorte Canvas-State nicht leer ist, muss `SET_MASK_DATA` mit dem restaurierten ImageData dispatched werden, damit State und Canvas konsistent bleiben

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/hooks/use-touch-gestures.ts` | MODIFY: Stroke-Undo-Logic in touchstart-Handler einbauen wenn `touches.length` von 1 auf 2 wechselt |
| `components/canvas/mask-canvas.tsx` | MODIFY: Refs (isDrawingRef, maskUndoStackRef, canvasRef) exponieren. Bestehendes Undo-Pattern (Zeile 106-130) als Referenz fuer Canvas-Restore-Logik |

**Referenzen:**
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Architecture Detail: Gesture Recognition (Touch)" -> "Procreate-Style Stroke-Undo"
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Risks & Mitigation" -> "Procreate Stroke-Undo Race Condition"
- Wireframes: `specs/phase-8/2026-04-10-canvas-zoom/wireframes.md` -> Section "Screen: Canvas Detail View -- Touch Interaction" -> State "Touch stroke + 2nd finger"
- Discovery: `specs/phase-8/2026-04-10-canvas-zoom/discovery.md` -> Flow 7 (Pinch waehrend Mask-Stroke)
