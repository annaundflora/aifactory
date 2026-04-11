# Wireframes: Canvas Zoom & Pan

**Discovery:** `discovery.md` (same folder)
**Status:** Draft

---

## Component Coverage

| UI Component (from Discovery) | Screen |
|-------------------------------|--------|
| Fit Button | Canvas Detail View -- Zoom Controls |
| Zoom-In Button | Canvas Detail View -- Zoom Controls |
| Zoom-Prozent | Canvas Detail View -- Zoom Controls |
| Zoom-Out Button | Canvas Detail View -- Zoom Controls |

---

## User Flow Overview

```
[fit] ──Ctrl+Scroll/Pinch/[+]──► [zoomed-in] ──Space held──► [panning]
  │                                    │                           │
  │◄──[Fit]/0/Double-Tap──────────────┘     Space released ───────┘
  │
  └──Ctrl+Scroll down/[-]──► [zoomed-out]
                                   │
      [fit] ◄──[Fit]/0/Double-Tap─┘

Any state (masking) ──2nd finger──► [gesture-active] ──fingers up──► previous state
                                    (stroke auto-undo)
```

---

## Screen: Canvas Detail View -- Fit State (Default)

**Context:** Main canvas area between left toolbar and right chat panel. Zoom controls are always visible, floating bottom-right over the image area.

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│ [... Canvas Header ...]                                             │
├──────┬──────────────────────────────────────────────┬───────────────┤
│      │                                              │               │
│      │     [... Floating Brush Toolbar ...]         │               │
│      │                                              │               │
│ LEFT │              ┌────────────────┐              │     CHAT      │
│ TOOL │              │                │              │     PANEL     │
│ BAR  │              │                │              │               │
│      │              │     IMAGE      │              │               │
│      │    ◄ prev    │  (object-fit)  │    next ►    │               │
│      │              │                │              │               │
│      │              │                │              │               │
│      │              └────────────────┘              │               │
│      │                                              │               │
│      │                                     ┌──────┐ │               │
│      │                                     │  ①   │ │               │
│      │                                     │  ②   │ │               │
│      │                                     │  ③   │ │               │
│      │                                     │  ④   │ │               │
│      │                                     └──────┘ │               │
│      │                                              │               │
├──────┴──────────────────────────────────────────────┴───────────────┤
└─────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `Fit Button`: Icon button (e.g. Maximize2). Resets zoom to fit container. Active highlight when currently at fit level
- ② `Zoom-In Button`: Icon button (ZoomIn / Plus). Steps to next zoom level. Disabled at 300%
- ③ `Zoom-Prozent`: Text label showing current zoom (e.g. "100%"). Display only, not interactive
- ④ `Zoom-Out Button`: Icon button (ZoomOut / Minus). Steps to previous zoom level. Disabled at 50%

### Zoom Controls Detail

```
         ┌────────┐
         │  ┌──┐  │
         │  │⊞ │  │  ← ① Fit Button
         │  └──┘  │
         │  ┌──┐  │
         │  │ + │  │  ← ② Zoom-In Button
         │  └──┘  │
         │  100%  │  ← ③ Zoom-Prozent
         │  ┌──┐  │
         │  │ − │  │  ← ④ Zoom-Out Button
         │  └──┘  │
         └────────┘
```

### State Variations

| State | Visual Change |
|-------|---------------|
| `fit` (default) | Fit button has active/highlight state. Image fits within container. Zoom-Out button disabled if fit = min level |
| `zoomed-in` | Fit button default (not active). Image exceeds container, clipped by overflow. Percent shows current level (e.g. "150%"). Both +/- enabled (unless at 300%) |
| `zoomed-out` | Image smaller than container, surrounded by empty space. Zoom-In enabled, Zoom-Out disabled at 50% |
| `at-max (300%)` | Zoom-In button disabled (grayed out). Percent shows "300%" |
| `at-min (50%)` | Zoom-Out button disabled (grayed out). Percent shows "50%" |

---

## Screen: Canvas Detail View -- Zoomed In State

**Context:** Image has been zoomed beyond container size. Image is clipped by the overflow-hidden container. User can scroll (wheel/shift+wheel) or pan (Space+drag / two-finger) to navigate.

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│ [... Canvas Header ...]                                             │
├──────┬──────────────────────────────────────────────┬───────────────┤
│      │                                              │               │
│      │     [... Floating Brush Toolbar ...]         │               │
│      │                                              │               │
│ LEFT │ ┌────────────────────────────────────────┐   │     CHAT      │
│ TOOL │ │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│   │     PANEL     │
│ BAR  │ │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│   │               │
│      │ │░░░░░░░░ IMAGE (zoomed, clipped) ░░░░░░│   │               │
│      │ │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│   │               │
│      │ │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│   │               │
│      │ │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│   │               │
│      │ └────────────────────────────────────────┘   │               │
│      │                                              │               │
│      │                                     ┌──────┐ │               │
│      │                                     │  ⊞   │ │               │
│      │                                     │  +   │ │               │
│      │                                     │ 200% │ │               │
│      │                                     │  −   │ │               │
│      │                                     └──────┘ │               │
│      │                                              │               │
├──────┴──────────────────────────────────────────────┴───────────────┤
└─────────────────────────────────────────────────────────────────────┘

    Scroll = vertical pan    Shift+Scroll = horizontal pan
    Ctrl/Cmd+Scroll = zoom   Space+Drag = free pan
```

### State Variations

| State | Visual Change |
|-------|---------------|
| `zoomed-in` scrollable | Image fills and exceeds canvas area. Percent shows zoom level. Fit button not highlighted |
| `panning` (Space held) | Cursor changes to grab hand. Image follows mouse drag. All other controls unchanged |
| `panning` (dragging) | Cursor changes to grabbing hand. Image moves with mouse |

---

## Screen: Canvas Detail View -- Zoomed In + Masking

**Context:** User has activated inpaint/erase mode while zoomed in. Mask canvas overlay is visible and synchronized with the zoomed/panned image. Floating Brush Toolbar is visible. Zoom controls remain accessible.

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│ [... Canvas Header ...]                                             │
├──────┬──────────────────────────────────────────────┬───────────────┤
│      │                                              │               │
│      │  ┌──────────────────────────────────────┐    │               │
│      │  │ [Brush] [Eraser] [Clear]  ○───● Size │    │               │
│      │  └──────────────────────────────────────┘    │               │
│ LEFT │ ┌────────────────────────────────────────┐   │     CHAT      │
│ TOOL │ │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│   │     PANEL     │
│ BAR  │ │░░░░░░░░░░████████░░░░░░░░░░░░░░░░░░░░│   │               │
│[EDIT]│ │░░░░░░░░████████████░░░░░░░░░░░░░░░░░░│   │               │
│active│ │░░░░░░░░░░████████░░░░░░  ○  ░░░░░░░░░│   │               │
│      │ │░░░░░░░░░░░░░░░░░░░░░ (cursor) ░░░░░░░│   │               │
│      │ │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│   │               │
│      │ └────────────────────────────────────────┘   │               │
│      │                                              │               │
│      │                                     ┌──────┐ │               │
│      │                                     │  ⊞   │ │               │
│      │                                     │  +   │ │               │
│      │                                     │ 150% │ │               │
│      │                                     │  −   │ │               │
│      │                                     └──────┘ │               │
│      │                                              │               │
├──────┴──────────────────────────────────────────────┴───────────────┤
└─────────────────────────────────────────────────────────────────────┘

    ████ = Mask overlay (synchronized with zoom/pan)
      ○  = Brush cursor (circular, scaled with zoom)
```

### State Variations

| State | Visual Change |
|-------|---------------|
| `zoomed-in` + `inpaint` | Mask canvas visible, synchronized with image zoom/pan. Brush cursor scales with zoom. Zoom controls remain visible |
| `zoomed-in` + `erase` | Same as inpaint but with eraser brush active |
| `gesture-active` during stroke | Touch: active stroke is undone (Procreate-style), then pinch/pan gesture takes over. Mask canvas transforms with image |
| `zoomed-in` + `outpaint` | Outpaint direction controls visible at image edges (scaled with zoom). Mask canvas hidden |

---

## Screen: Canvas Detail View -- Touch Interaction

**Context:** Touch device (iPad/tablet). Shows gesture areas and their behavior. No visible UI change -- this documents invisible interaction zones.

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│ [... Canvas Header ...]                                             │
├──────┬──────────────────────────────────────────────┬───────────────┤
│      │                                              │               │
│      │  ┌────────────────────────────────────────┐  │               │
│      │  │                                        │  │               │
│      │  │   GESTURE ZONE (entire canvas area)    │  │     CHAT      │
│      │  │                                        │  │     PANEL     │
│      │  │   1 finger:                            │  │               │
│      │  │     at fit  = swipe nav (prev/next)    │  │               │
│      │  │     zoomed, no mask = pan (drag)       │  │               │
│      │  │     zoomed, masking = draw stroke      │  │               │
│      │  │                                        │  │               │
│      │  │   2 fingers:                           │  │               │
│      │  │     pinch   = zoom (to midpoint)       │  │               │
│      │  │     drag    = pan (any mode)           │  │               │
│      │  │     during stroke = undo + gesture     │  │               │
│      │  │                                        │  │               │
│      │  │   double-tap:                          │  │               │
│      │  │     no mask = toggle fit <-> 100%      │  │               │
│      │  │     masking = disabled (prevents       │  │               │
│      │  │               accidental dots + zoom)  │  │               │
│      │  │                                        │  │               │
│      │  └────────────────────────────────────────┘  │               │
│      │                                     ┌──────┐ │               │
│      │                                     │  ⊞   │ │               │
│      │                                     │  +   │ │               │
│      │                                     │ 100% │ │               │
│      │                                     │  −   │ │               │
│      │                                     └──────┘ │               │
│      │                                              │               │
├──────┴──────────────────────────────────────────────┴───────────────┤
└─────────────────────────────────────────────────────────────────────┘
```

### State Variations

| State | Visual Change |
|-------|---------------|
| Touch idle at `fit` | 1-finger horizontal swipe triggers prev/next image navigation |
| Touch idle `zoomed-in`, no mask mode | 1-finger drag pans the image. 2-finger drag also pans |
| Touch idle `zoomed-in`, masking active | 1-finger drag draws mask stroke. 2-finger drag pans |
| Touch `gesture-active` (pinch) | Image scales to/from midpoint between fingers. Percent updates in real-time |
| Touch `gesture-active` (pan) | Image translates following finger movement |
| Touch stroke + 2nd finger | Active stroke is undone. Transition to gesture mode (pinch/pan) |
| Double-tap at `fit` (no mask mode) | Zooms to 100% centered on tap position |
| Double-tap at `zoomed-in` (no mask mode) | Returns to fit state |
| Double-tap during masking (inpaint/erase) | Disabled -- no effect. Prevents accidental mask dots + zoom toggle |

---

## Completeness Check

| Check | Status |
|-------|--------|
| All UI Components from Discovery covered | ✅ Fit Button, Zoom-In, Zoom-Prozent, Zoom-Out -- all 4 components |
| All relevant states visualized | ✅ fit, zoomed-in, zoomed-out, panning, gesture-active, masking+zoom, disabled buttons |
| All screens from UI Layout covered | ✅ Canvas Detail View (only screen in Discovery) |
| Touch interactions documented | ✅ Gesture zones, finger counts, mode-dependent behavior |
| Desktop interactions documented | ✅ Scroll, Shift+Scroll, Ctrl+Scroll, Space+Drag shortcuts shown |
| No logic/rules duplicated from Discovery | ✅ References Discovery for state machine and business rules |
