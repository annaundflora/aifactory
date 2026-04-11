# Systemic Review Report

**Feature:** Canvas Zoom & Pan
**Branch:** feature/canvas-zoom
**Datum:** 2026-04-10

---

## Summary

**Verdict:** FAILED

| Kriterium | Findings |
|-----------|----------|
| Duplicate Solution Paths | 1 |
| Abstraction Reuse | 2 |
| Schema Consistency | 0 |
| Dead Code / Unused Imports | 0 |
| Error Handling Divergence | 0 |
| Configuration Drift | 1 |
| Interface Inconsistency | 1 |
| Dependency Direction | 0 |
| Security Pattern Consistency | 0 |
| Performance Pattern Consistency | 1 |
| **Total** | **6** |

---

## Findings

### SR-1: Duplicated isInputFocused() guard logic across 3 locations

**Kriterium:** 3.1 Duplicate Solution Paths
**PM-Entscheidung:** pending_review

**Problem:**
The `isInputFocused()` function is implemented identically in three separate locations: once as a local function inside `mask-canvas.tsx`, once as an inline check in `use-canvas-zoom.ts:handleKeyDown`, and once as a `useCallback` in `use-canvas-zoom.ts:isInputFocused`. All three perform the exact same check (INPUT/TEXTAREA tagName + isContentEditable). The existing codebase-scan identified this as a REUSE pattern (Pattern #6), yet the new code creates a third copy instead of extracting a shared utility.

**Neuer Code:** `lib/hooks/use-canvas-zoom.ts:385-392` (inline in handleKeyDown) and `lib/hooks/use-canvas-zoom.ts:437-443` (useCallback)
**Bestehendes Pattern:** `components/canvas/mask-canvas.tsx:177-184` (local function) and `lib/canvas-detail-context.tsx:310-317` (inline variant)

**Empfehlung:**
Extract a shared `isInputFocused()` utility function into `lib/utils.ts` (or a new `lib/dom-utils.ts`) and import it from all four locations. This eliminates the risk of divergence if the check ever needs updating (e.g., adding `SELECT` or `role="textbox"` support).

---

### SR-2: Duplicated ZOOM_MIN/ZOOM_MAX constants across 3 files

**Kriterium:** 3.6 Configuration Drift
**PM-Entscheidung:** pending_review

**Problem:**
The zoom boundary constants (0.5 and 3.0) are hardcoded independently in three files with inconsistent naming:
- `lib/canvas-detail-context.tsx:84-85` as `ZOOM_MIN = 0.5`, `ZOOM_MAX = 3.0`
- `lib/hooks/use-canvas-zoom.ts:13-14` as `ZOOM_MIN = 0.5`, `ZOOM_MAX = 3.0`
- `lib/hooks/use-touch-gestures.ts:11-12` as `ZOOM_MIN = 0.5`, `ZOOM_MAX = 3.0`
- `components/canvas/zoom-controls.tsx:12-13` as `MIN_ZOOM = 0.5`, `MAX_ZOOM = 3.0`

The fourth file (`zoom-controls.tsx`) even uses a different naming convention (`MIN_ZOOM`/`MAX_ZOOM` vs `ZOOM_MIN`/`ZOOM_MAX`). If the zoom range ever changes, all four files must be updated in sync, which is error-prone.

**Neuer Code:** `lib/hooks/use-canvas-zoom.ts:13-14`, `lib/hooks/use-touch-gestures.ts:11-12`, `components/canvas/zoom-controls.tsx:12-13`
**Bestehendes Pattern:** `lib/canvas-detail-context.tsx:84-85` (authoritative source as reducer validates here)

**Empfehlung:**
Export `ZOOM_MIN` and `ZOOM_MAX` from `lib/canvas-detail-context.tsx` (where the reducer clamp logic lives) and import them in `use-canvas-zoom.ts`, `use-touch-gestures.ts`, and `zoom-controls.tsx`. This creates a single source of truth. The `ZOOM_STEPS` array in `use-canvas-zoom.ts` should also reference these constants for its boundary values.

---

### SR-3: ZoomControls buttons lack Tooltips (unlike FloatingBrushToolbar pattern)

**Kriterium:** 3.2 Abstraction Reuse
**PM-Entscheidung:** pending_review

**Problem:**
The codebase-scan explicitly identified the `Tooltip + TooltipProvider` pattern as a REUSE recommendation (#8): "Zoom buttons need tooltips; same provider/trigger/content pattern." The existing `FloatingBrushToolbar` wraps every interactive element in `<TooltipProvider><Tooltip><TooltipTrigger>...<TooltipContent>` (see `floating-brush-toolbar.tsx:131-240`). The new `ZoomControls` component uses only `aria-label` on its buttons but does not render any visible `Tooltip` on hover, which breaks the pattern consistency for floating control panels.

**Neuer Code:** `components/canvas/zoom-controls.tsx:72-112` (Button elements with `aria-label` only, no Tooltip)
**Bestehendes Pattern:** `components/canvas/floating-brush-toolbar.tsx:131-240` (all buttons wrapped in Tooltip)

**Empfehlung:**
Wrap ZoomControls buttons with `<TooltipProvider>` and individual `<Tooltip><TooltipTrigger><TooltipContent>` to match the FloatingBrushToolbar pattern. Use German text for tooltip content (e.g., "Einpassen", "Vergroessern", "Verkleinern") to match the existing convention of German user-facing text.

---

### SR-4: Duplicated StrokeUndoRefs interface definition

**Kriterium:** 3.7 Interface Inconsistency
**PM-Entscheidung:** pending_review

**Problem:**
There are two nearly identical interfaces describing the same stroke-undo refs contract:
- `MaskCanvasStrokeUndoRefs` in `components/canvas/mask-canvas.tsx:19-28` (4 fields: isDrawingRef, maskUndoStackRef, canvasRef, performStrokeUndo)
- `StrokeUndoRefs` in `lib/hooks/use-touch-gestures.ts:22-27` (2 fields: isDrawingRef, performStrokeUndo)

The consumer (`useTouchGestures`) defines a narrower interface than what the producer (`MaskCanvas`) exposes. While this is technically valid (structural typing), it creates two parallel type definitions for the same concept. The `canvas-detail-view.tsx` bridge code types the ref as `MaskCanvasStrokeUndoRefs` but passes it to the hook that expects `StrokeUndoRefs`. If the hook ever needs `maskUndoStackRef` or `canvasRef` (which `MaskCanvas` already exposes), the `StrokeUndoRefs` interface would need updating.

**Neuer Code:** `lib/hooks/use-touch-gestures.ts:22-27` (StrokeUndoRefs)
**Bestehendes Pattern:** `components/canvas/mask-canvas.tsx:19-28` (MaskCanvasStrokeUndoRefs)

**Empfehlung:**
Use a single interface definition. Either: (a) have `useTouchGestures` import and use `MaskCanvasStrokeUndoRefs` directly from `mask-canvas.tsx`, or (b) extract a shared `StrokeUndoRefs` interface into a shared types file (e.g., `lib/types/canvas.ts`) and have both files reference it. Option (a) is simpler given the current codebase structure.

---

### SR-5: Duplicated clamp utility function

**Kriterium:** 3.2 Abstraction Reuse
**PM-Entscheidung:** pending_review

**Problem:**
The clamping logic is implemented independently in three places with different signatures:
- `lib/canvas-detail-context.tsx:90-93` as `clampZoom(value)` (hardcoded to ZOOM_MIN/ZOOM_MAX)
- `lib/hooks/use-canvas-zoom.ts:218` as inline `Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, newZoom))`
- `lib/hooks/use-touch-gestures.ts:110-112` as `clamp(value, min, max)` (generic helper)

The generic `clamp()` in `use-touch-gestures.ts` is the most reusable version. `lib/utils.ts` already exists as the standard utility location (it exports `cn()`) but no `clamp` utility exists there. The inline clamping in `use-canvas-zoom.ts:218` and `use-canvas-zoom.ts:337-338` uses raw `Math.min/Math.max` while the touch gestures hook wraps it in a named function.

**Neuer Code:** `lib/hooks/use-touch-gestures.ts:110-112` (local clamp) and `lib/hooks/use-canvas-zoom.ts:218` (inline Math.min/max)
**Bestehendes Pattern:** `lib/canvas-detail-context.tsx:90-93` (clampZoom)

**Empfehlung:**
Add a generic `clamp(value: number, min: number, max: number): number` utility to `lib/utils.ts` and use it in all three locations. The reducer's `clampZoom` can then be simplified to `clamp(value, ZOOM_MIN, ZOOM_MAX)` with an additional `isFinite` guard.

---

### SR-6: Continuous rAF polling loop for cursor style synchronization

**Kriterium:** 3.10 Performance Pattern Consistency
**PM-Entscheidung:** pending_review

**Problem:**
The Space+Drag cursor management in `canvas-detail-view.tsx:221-239` uses a continuous `requestAnimationFrame` polling loop that runs every frame (~16ms at 60fps) for the entire lifetime of the effect, even when Space is not held and no drag is happening. This loop reads two refs (`isSpaceHeldRef` and `isDraggingRef`) every frame. The existing codebase does not use continuous rAF polling for state synchronization: `canvas-chat-panel.tsx` uses rAF only during active scroll operations, and `mask-canvas.tsx` uses rAF only once during setup (not as a loop). The comment says "isSpaceHeld + isDragging are refs, not React state, so no re-renders" but an event-driven approach (updating cursor directly in the `handleSpaceKeyDown`/`handleSpaceKeyUp`/`handlePanPointerDown`/`handlePanPointerUp` handlers) would achieve the same result with zero idle cost.

**Neuer Code:** `components/canvas/canvas-detail-view.tsx:221-239` (continuous rAF loop)
**Bestehendes Pattern:** `components/canvas/canvas-chat-panel.tsx:266` (rAF only during active operation), `components/canvas/mask-canvas.tsx:374` (single rAF, no loop)

**Empfehlung:**
Replace the continuous rAF polling loop with direct cursor updates inside the event handlers: set `cursor: grab` in `handleSpaceKeyDown`, set `cursor: grabbing` in `handlePanPointerDown`, restore `cursor: grab` in `handlePanPointerUp`, and clear cursor in `handleSpaceKeyUp`. This matches the existing event-driven pattern and avoids unnecessary idle CPU usage.

---

## Decision Log Updates

| # | Neuer Eintrag | Date |
|---|---------------|------|
| -- | None. | -- |

> Falls keine "Bewusst akzeptiert"-Entscheidungen: "None."
