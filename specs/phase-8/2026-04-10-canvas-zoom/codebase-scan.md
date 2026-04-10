# Codebase Scan

**Feature:** Canvas Zoom & Pan
**Scan-Datum:** 2026-04-10
**Discovery:** `specs/phase-8/2026-04-10-canvas-zoom/discovery.md`

---

## Identified Patterns

| # | Pattern | Locations | Count | Type |
|---|---------|-----------|-------|------|
| 1 | Canvas Detail Context (Reducer + Provider + Hook) | `lib/canvas-detail-context.tsx` | 1 (consumed by 10+ components) | EXTEND |
| 2 | Floating Controls Panel (absolute positioned, z-index, shadow, border) | `components/canvas/floating-brush-toolbar.tsx` | 1 | REUSE |
| 3 | ToolbarButton (Icon + Tooltip, LucideIcon typed) | `components/canvas/toolbar-button.tsx` | 1 (used by `canvas-toolbar.tsx` for 10 tools) | REUSE |
| 4 | MaskCanvas Pointer Events + touch-action:none + setPointerCapture | `components/canvas/mask-canvas.tsx` | 1 | EXTEND |
| 5 | Swipe Navigation (touchStart/touchEnd on canvas area) | `components/canvas/canvas-detail-view.tsx:200-234` | 1 | EXTEND |
| 6 | Keyboard Shortcut Pattern (document.addEventListener keydown, input-focus guard) | `lib/canvas-detail-context.tsx:249-286`, `components/canvas/mask-canvas.tsx:85-183`, `components/canvas/canvas-navigation.tsx:56-77` | 3 | REUSE |
| 7 | ResizeObserver for Canvas Sync | `components/canvas/mask-canvas.tsx:260-299` | 1 | REUSE |
| 8 | Image Rendering (object-contain, max-h-full max-w-full) | `components/canvas/canvas-image.tsx:98` | 1 | EXTEND |
| 9 | Canvas Area Layout (relative flex container, overflow-hidden) | `components/canvas/canvas-detail-view.tsx:874,917-950` | 1 | EXTEND |
| 10 | Button Component (variant + size system incl. icon-sm) | `components/ui/button.tsx` | 1 (used across entire codebase) | REUSE |
| 11 | Test Infrastructure (vi.mock lucide-react, CanvasDetailProvider wrapper) | `components/canvas/__tests__/*.test.tsx` | 34 test files | REUSE |
| 12 | Touch Drag Context (separate context for touch interactions) | `lib/touch-drag-context.tsx` | 1 | REUSE |

---

## Existing Abstractions

| Abstraction | Location | Used by | Recommendation | Rationale |
|-------------|----------|---------|----------------|-----------|
| `CanvasDetailState` + `canvasDetailReducer` | `lib/canvas-detail-context.tsx:28-202` | 10+ components (all canvas-* components) | EXTEND | Zoom/pan state (zoomLevel, panX, panY) and new actions must be added here |
| `useCanvasDetail()` hook | `lib/canvas-detail-context.tsx:299-307` | 10+ components | REUSE | All canvas components already consume this; zoom components will too |
| `ToolbarButton` component | `components/canvas/toolbar-button.tsx` | `canvas-toolbar.tsx` (10 tool buttons) | REUSE | Zoom +/-/Fit buttons can use the same component or the `Button` from `components/ui/button.tsx` with `size="icon-sm"` |
| `FloatingBrushToolbar` (layout pattern) | `components/canvas/floating-brush-toolbar.tsx:130-240` | 1 component | REUSE | Zoom controls panel follows same floating pattern: absolute, z-index, border, shadow, bg-card |
| `cn()` utility | `lib/utils.ts:4` | Entire codebase | REUSE | Standard classname merge utility |
| Keyboard shortcut guard pattern | `lib/canvas-detail-context.tsx:257-263`, `components/canvas/mask-canvas.tsx:86-97` | 3 locations | REUSE | isInputFocused() check, document addEventListener with cleanup -- same pattern for zoom shortcuts |
| `Button` with `size="icon-sm"` | `components/ui/button.tsx:30` | `floating-brush-toolbar.tsx` and others | REUSE | Pre-defined icon button size for zoom +/-/Fit buttons |

---

## Recommendations

### REUSE (bestehende Abstraktion wiederverwenden)

| # | What | Where | Why |
|---|------|-------|-----|
| 1 | `useCanvasDetail()` hook for reading/dispatching zoom state | `lib/canvas-detail-context.tsx:299` | All canvas components already use this hook; zoom controls and gesture handlers will consume the same context |
| 2 | Floating panel styling pattern (absolute, z-index, border, shadow, bg-card) | `components/canvas/floating-brush-toolbar.tsx:133-136` | Zoom controls panel uses identical visual treatment: `absolute z-{N} rounded-lg border border-border/80 bg-card shadow-md` |
| 3 | `Button` component with `size="icon-sm"` variant | `components/ui/button.tsx:30` | Pre-built icon button size for zoom +/-/Fit buttons, already used in FloatingBrushToolbar |
| 4 | Keyboard shortcut guard (isInputFocused check + document listener) | `components/canvas/mask-canvas.tsx:86-97` | Zoom shortcuts (+/-/0) need same input-focus suppression and document-level keydown listener pattern |
| 5 | `cn()` utility for conditional classnames | `lib/utils.ts:4` | Standard across all components |
| 6 | `data-testid` naming convention (`kebab-case`) | All canvas components | 34 test files rely on this convention; zoom controls should follow (e.g. `zoom-controls`, `zoom-in-btn`) |
| 7 | Test mock pattern for lucide-react | `components/canvas/__tests__/*.test.tsx` (34 files) | All canvas tests mock lucide-react consistently; zoom test files should follow same pattern |
| 8 | `Tooltip` + `TooltipProvider` from radix for hover hints | `components/canvas/floating-brush-toolbar.tsx:131,142-148` | Zoom buttons need tooltips; same provider/trigger/content pattern |

### EXTEND (bestehende Abstraktion erweitern)

| # | What | Where | Extension needed |
|---|------|-------|------------------|
| 1 | `CanvasDetailState` interface | `lib/canvas-detail-context.tsx:28-49` | Add `zoomLevel: number`, `panX: number`, `panY: number` fields |
| 2 | `CanvasDetailAction` union type | `lib/canvas-detail-context.tsx:55-70` | Add actions: `SET_ZOOM_LEVEL`, `SET_PAN`, `RESET_ZOOM_PAN` (or similar) |
| 3 | `canvasDetailReducer` function | `lib/canvas-detail-context.tsx:76-202` | Add reducer cases for zoom/pan actions |
| 4 | `CanvasDetailProvider` initial state | `lib/canvas-detail-context.tsx:228-242` | Add initial values: `zoomLevel: 1.0`, `panX: 0`, `panY: 0` |
| 5 | Canvas image area container | `components/canvas/canvas-detail-view.tsx:917-950` | Apply CSS transform (scale + translate) based on zoom/pan state; add overflow-hidden for clipping |
| 6 | Swipe navigation handler | `components/canvas/canvas-detail-view.tsx:200-234` | Gate swipe behind `zoomLevel === fitLevel` (disable swipe when zoomed) |
| 7 | MaskCanvas coordinate calculation | `components/canvas/mask-canvas.tsx:354-365` | `getCanvasCoords()` must account for zoom/pan transform offset when computing pointer position |
| 8 | MaskCanvas sizing/positioning | `components/canvas/mask-canvas.tsx:189-256` | `syncCanvasSize()` and `syncCanvasPosition()` must account for CSS transform on parent |
| 9 | Image rendering in CanvasImage | `components/canvas/canvas-image.tsx:98` | Remove `max-h-full max-w-full object-contain` self-sizing; parent wrapper now controls size via transform |

### NEW (neue Implementierung noetig)

| # | What | Why new |
|---|------|---------|
| 1 | `ZoomControls` component (floating panel with +/-/Fit/percentage) | No zoom UI exists in codebase; new component following FloatingBrushToolbar's styling pattern |
| 2 | `useCanvasZoom` hook (or inline logic) for zoom/pan calculations | No zoom/pan math exists: anchor-point calculations, zoom step snapping, fit-level computation, pan clamping |
| 3 | Gesture recognition layer (Pinch-to-Zoom, Two-Finger-Pan) | No multi-touch gesture detection exists in codebase; TouchDragContext handles single-touch drag only |
| 4 | Space+Drag pan handler (desktop hand tool) | No Space-key modifier + mouse drag pattern exists |
| 5 | Ctrl/Cmd+Scroll zoom handler | No wheel-event zoom handler exists anywhere in the codebase (grep for `wheel`/`onWheel`/`WheelEvent` returned 0 results) |
| 6 | Double-Tap detection logic | No double-tap handler exists; needs timing-based detection with editMode guard |
| 7 | Procreate-style stroke-undo on gesture start | Novel interaction: detect 2nd finger during active stroke, auto-undo stroke, transition to gesture mode |

### AVOID (bekannte Schuld, nicht replizieren)

| # | What | Decision Log Entry | Alternative |
|---|------|--------------------|-------------|
| -- | -- | No .decisions.md found | -- |

---

## Conventions Detected

| Convention | Evidence | Count |
|------------|----------|-------|
| Path alias `@/*` for all imports (no relative imports) | `tsconfig.json:22`, all `components/canvas/*.tsx` | 15 canvas component files, 0 relative imports |
| `"use client"` directive on all interactive components | All `components/canvas/*.tsx` files | 15 files |
| Kebab-case file names | `canvas-detail-view.tsx`, `floating-brush-toolbar.tsx`, `mask-canvas.tsx` | 15 files |
| PascalCase component names matching file (e.g. `canvas-image.tsx` exports `CanvasImage`) | All canvas components | 15 files |
| `data-testid` with kebab-case naming | `mask-canvas`, `floating-brush-toolbar`, `canvas-image`, `canvas-nav-prev` | 40+ test IDs across canvas components |
| Section comment blocks with dashed lines | All canvas components (e.g. `// --------- Props ---------`) | 15 files |
| Lucide React for icons (named imports) | `canvas-toolbar.tsx`, `floating-brush-toolbar.tsx`, `canvas-navigation.tsx` etc. | 11 component files |
| `useCallback` for all event handlers | `floating-brush-toolbar.tsx`, `mask-canvas.tsx`, `canvas-detail-view.tsx` | 10+ files |
| Vitest + `vi.mock("lucide-react")` in all canvas test files | `components/canvas/__tests__/*.test.tsx` | 30+ test files |
| German user-facing text, English code/comments | `floating-brush-toolbar.tsx:143` ("Pinsel"), `canvas-image.tsx:51` ("Kein Bild verfuegbar") | Throughout |
| Context pattern: createContext + Provider + useX hook + null check | `lib/canvas-detail-context.tsx`, `lib/touch-drag-context.tsx` | 2 contexts |
| Reducer pattern: discriminated union actions, pure reducer function | `lib/canvas-detail-context.tsx:55-202` | 1 reducer (to be extended) |

---

## Key Integration Points

| Integration | Current Location | Impact of Feature |
|-------------|------------------|-------------------|
| Canvas image rendering + sizing | `components/canvas/canvas-image.tsx:98` | Image must be wrapped in a transform container; `object-contain` + `max-h/w-full` may need to be replaced with explicit dimensions for zoom math |
| MaskCanvas pointer coordinate calculation | `components/canvas/mask-canvas.tsx:354-365` | `getCanvasCoords()` must reverse zoom/pan transform to map screen coords to image coords |
| MaskCanvas position/size sync via ResizeObserver | `components/canvas/mask-canvas.tsx:189-299` | Must sync with transformed (zoomed/panned) image position, not raw image bounds |
| Swipe navigation touch handlers | `components/canvas/canvas-detail-view.tsx:200-234` | Swipe must be disabled when zoom != fit; gesture layer must not conflict |
| Canvas area `<main>` overflow | `components/canvas/canvas-detail-view.tsx:874` | Currently `overflow-hidden`; zoomed image content must be clipped by this container |
| Keyboard shortcuts (undo/redo) | `lib/canvas-detail-context.tsx:249-286` | Zoom shortcuts (+/-/0) must coexist; no key conflicts detected (+/-/0 vs Ctrl+Z/[/]/E) |
| Keyboard shortcuts (mask brush) | `components/canvas/mask-canvas.tsx:85-183` | Space-key pan must suppress mask painting when held; zoom shortcuts work alongside mask shortcuts |
| CanvasNavigation disabled prop | `components/canvas/canvas-navigation.tsx:33,56` | Already accepts `disabled` prop; no change needed, but swipe gating needs separate logic |
| FloatingBrushToolbar z-index (z-30) | `components/canvas/floating-brush-toolbar.tsx:134` | Zoom controls z-index must be below brush toolbar (e.g. z-20) to avoid overlap per spec |
| OutpaintControls absolute positioning | `components/canvas/outpaint-controls.tsx:67-132` | Must transform with zoom/pan so controls stay at image edges |
| CanvasDetailProvider initial state | `lib/canvas-detail-context.tsx:228-242` | Zoom reset on image change requires checking `SET_CURRENT_IMAGE` action in reducer |
| SAM click-edit coordinate normalization | `components/canvas/canvas-detail-view.tsx:452-486` | Click coordinates must account for zoom/pan offset to compute correct normalized image coords |

---

## Decision Log Context

> No .decisions.md found.

---

## Scan Summary

| Metric | Value |
|--------|-------|
| Patterns found | 12 |
| REUSE recommendations | 8 |
| EXTEND recommendations | 9 |
| NEW recommendations | 7 |
| AVOID recommendations | 0 |
| Decision Log entries | 0 |
