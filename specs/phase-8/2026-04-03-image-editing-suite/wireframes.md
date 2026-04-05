# Wireframes: AI Image Editing Suite

**Discovery:** `discovery.md` (same folder)
**Status:** Draft

---

## Component Coverage

| UI Component (from Discovery) | Screen |
|-------------------------------|--------|
| `brush-edit-btn` | Canvas Detail-View (Toolbar) |
| `erase-btn` | Canvas Detail-View (Toolbar) |
| `click-edit-btn` | Canvas Detail-View (Toolbar) |
| `expand-btn` | Canvas Detail-View (Toolbar) |
| `mask-canvas` | Painting Mode, Click-to-Edit Result |
| `brush-size-slider` | Floating Brush Toolbar |
| `brush-eraser-toggle` | Floating Brush Toolbar |
| `clear-mask-btn` | Floating Brush Toolbar |
| `erase-action-btn` | Floating Brush Toolbar (Erase Mode) |
| `outpaint-direction` | Outpaint Mode |
| `outpaint-size` | Outpaint Mode |

---

## User Flow Overview

```
[Idle] ──brush-edit-btn──► [Painting: Brush Edit] ──chat prompt──► [Generating] ──success──► [Result]
  │                              │                                                              │
  │                              └──switch tool──► [Painting: Erase] ──erase-action──► [Generating]
  │
  ├──erase-btn──► [Painting: Erase] ──erase-action-btn──► [Generating] ──success──► [Result]
  │
  ├──click-edit-btn──► [Click-Waiting] ──click on image──► [SAM Processing] ──mask──► [Painting]
  │
  ├──expand-btn──► [Outpaint Config] ──chat prompt──► [Generating] ──success──► [Result]
  │
  └──chat prompt (no mask)──► [Generating: Instruction Edit] ──success──► [Result]

[Result] ──undo──► [Previous Image]
         ──new edit──► [Painting / Click-Waiting / Outpaint Config]
```

---

## Screen: Canvas Detail-View (Idle)

**Context:** Existing 3-column Canvas Detail-View at `/projects/[id]` when user opens a generated image. This wireframe shows the base state with the 4 new edit tool buttons added to the existing left toolbar.

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Canvas Detail-View                                            [X]     │
├────────┬────────────────────────────────────────────┬───────────────────┤
│        │                                            │                   │
│  ①     │                                            │  ⑥ Canvas Chat    │
│ [Move] │                                            │ ─────────────────│
│ [Zoom] │                                            │                   │
│ ─────  │                                            │  [... previous    │
│ ② ☐    │                                            │   messages ...]   │
│ Brush  │              ⑤ Canvas Image                │                   │
│ Edit   │                                            │                   │
│ ③ ☐    │          (generated image fills             │                   │
│ Erase  │           the center area)                  │                   │
│ ④ ☐    │                                            │                   │
│ Click  │                                            │                   │
│ Edit   │                                            │                   │
│ ⑤ ☐    │                                            │                   │
│ Expand │                                            │                   │
│ ─────  │                                            │                   │
│ [Down] │                                            │ ┌───────────────┐ │
│ [Del]  │                                            │ │ ⑦ Chat Input  │ │
│ [Undo] │                                            │ │ "Type prompt" │ │
│ [Redo] │                                            │ └───────────────┘ │
│        │                                            │                   │
├────────┴────────────────────────────────────────────┴───────────────────┤
└─────────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① Existing toolbar buttons (Move, Zoom, etc.) — unchanged
- ② `brush-edit-btn`: New toolbar button — activates mask painting mode
- ③ `erase-btn`: New toolbar button — activates erase mode
- ④ `click-edit-btn`: New toolbar button — activates click-to-edit mode
- ⑤ `expand-btn`: New toolbar button — activates outpaint mode
- ⑥ Existing Canvas Chat panel — becomes prompt hub for edit modes
- ⑦ Existing Chat Input — user types edit prompts here

### State Variations

| State | Visual Change |
|-------|---------------|
| `idle` | As shown above. No edit tool active, all new buttons in `inactive` state |
| `tool-hover` | Toolbar button shows tooltip with mode name |

---

## Screen: Painting Mode (Brush Edit)

**Context:** User clicked `brush-edit-btn` in toolbar. Floating Brush Toolbar appears above the image, mask canvas overlay becomes active. Cursor changes to circle matching brush size.

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Canvas Detail-View                                            [X]     │
├────────┬────────────────────────────────────────────┬───────────────────┤
│        │                                            │                   │
│ [Move] │  ┌──────────────────────────────────────┐  │  Canvas Chat      │
│ [Zoom] │  │ ① Floating Brush Toolbar             │  │ ─────────────────│
│ ─────  │  │  ②[====○====] ③[Brush|Eraser] ④[Clr]│  │                   │
│ ■■■■■  │  └──────────────────────────────────────┘  │                   │
│ ② Brush│ ┌──────────────────────────────────────────┐│                   │
│ Edit   │ │                                          ││ [... messages ...]│
│ ☐      │ │              Canvas Image                ││                   │
│ Erase  │ │                                          ││                   │
│ ☐      │ │      ┌─ ─ ─ ─ ─ ─ ─ ─ ─┐               ││                   │
│ Click  │ │      │  ⑤ Mask Overlay  │               ││                   │
│ Edit   │ │      │  (semi-transparent│               ││                   │
│ ☐      │ │      │   red, 50%)      │               ││                   │
│ Expand │ │      └─ ─ ─ ─ ─ ─ ─ ─ ─┘               ││                   │
│ ─────  │ │                                          ││                   │
│ [Down] │ │                    ⑥ ◯                   ││ ┌───────────────┐ │
│ [Del]  │ │                  (brush                   ││ │ "Replace with │ │
│ [Undo] │ │                   cursor)                ││ │  a red dress" │ │
│ [Redo] │ │                                          ││ │          [⑦→] │ │
│        │ └──────────────────────────────────────────┘│ └───────────────┘ │
├────────┴────────────────────────────────────────────┴───────────────────┤
└─────────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① Floating Brush Toolbar: horizontal bar, positioned top-center above image
- ② `brush-size-slider`: Slider from 1px to 100px, adjusts brush diameter
- ③ `brush-eraser-toggle`: Toggle between adding mask (Brush) and removing mask (Eraser)
- ④ `clear-mask-btn`: Clears entire mask. Disabled when no mask painted
- ⑤ `mask-canvas`: Semi-transparent red overlay (50% opacity) on painted areas
- ⑥ Brush cursor: Circle matching current brush size, follows mouse
- ⑦ Chat send button: Submits prompt — triggers inpaint with mask + prompt

### State Variations

| State | Visual Change |
|-------|---------------|
| `painting (no mask yet)` | Floating Toolbar visible, clear button disabled, empty overlay |
| `painting (has mask)` | Red mask overlay visible, clear button enabled |
| `painting (eraser active)` | Brush/Eraser toggle shows "Eraser" selected, cursor paints transparency |
| `painting (brush size changed)` | Cursor circle diameter matches slider value |
| `painting (mask too small)` | Warning toast: "Markiere einen groesseren Bereich" when mask < 10px in both dimensions on prompt submit |

**Keyboard Shortcuts (active in all painting modes):**
- `[` / `]` — Decrease / increase brush size
- `E` — Toggle brush / eraser
- `Ctrl+Z` / `Cmd+Z` — Mask undo (separate mask undo stack, not image undo)

---

## Screen: Painting Mode (Erase)

**Context:** User clicked `erase-btn` in toolbar. Same floating toolbar as Brush Edit, but with additional "Entfernen" action button. Chat panel stays enabled — sending a prompt upgrades to inpaint (mask + prompt).

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Canvas Detail-View                                            [X]     │
├────────┬────────────────────────────────────────────┬───────────────────┤
│        │                                            │                   │
│ [Move] │  ┌────────────────────────────────────────┐│  Canvas Chat      │
│ [Zoom] │  │ Floating Brush Toolbar                 ││ ─────────────────│
│ ─────  │  │ [====○====] [Brush|Eraser] [Clr] ①[⌫]││                   │
│ ☐      │  └────────────────────────────────────────┘│                   │
│ Brush  │ ┌──────────────────────────────────────────┐│                   │
│ Edit   │ │                                          ││                   │
│ ■■■■■  │ │              Canvas Image                ││ [... messages ...]│
│ ② Erase│ │                                          ││                   │
│ ☐      │ │        ┌─ ─ ─ ─ ─ ─ ─┐                  ││                   │
│ Click  │ │        │ Mask Overlay │                  ││                   │
│ Edit   │ │        │ (object to   │                  ││                   │
│ ☐      │ │        │  remove)     │                  ││                   │
│ Expand │ │        └─ ─ ─ ─ ─ ─ ─┘                  ││                   │
│ ─────  │ │                                          ││                   │
│ [Down] │ │                                          ││ ┌───────────────┐ │
│ [Del]  │ │                                          ││ │③"Type prompt  │ │
│ [Undo] │ │                                          ││ │ to replace    │ │
│ [Redo] │ │                                          ││ │ instead"  [→] │ │
│        │ └──────────────────────────────────────────┘│ └───────────────┘ │
├────────┴────────────────────────────────────────────┴───────────────────┤
└─────────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `erase-action-btn`: "Entfernen" button — only visible in Erase mode. Triggers object removal without prompt. Disabled when no mask painted
- ② `erase-btn`: Active state (highlighted) in toolbar
- ③ Chat input with hint: "Type prompt to replace instead" — sending a prompt upgrades erase to inpaint (mask + prompt -> inpaint model)

### State Variations

| State | Visual Change |
|-------|---------------|
| `erase (no mask)` | "Entfernen" button disabled, chat hint visible. Click on disabled button shows tooltip: "Markiere zuerst einen Bereich" |
| `erase (has mask)` | "Entfernen" button enabled, ready to trigger removal |
| `erase (prompt sent)` | Upgrades to inpaint: mask + prompt -> inpaint model instead of erase |
| `erase (mask too small)` | Warning toast: "Markiere einen groesseren Bereich" when mask < 10px on erase action |

---

## Screen: Click-to-Edit Mode

**Context:** User clicked `click-edit-btn` in toolbar. Cursor changes to crosshair. User clicks on an object to auto-generate a mask via SAM 2.

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Canvas Detail-View                                            [X]     │
├────────┬────────────────────────────────────────────┬───────────────────┤
│        │                                            │                   │
│ [Move] │                                            │  Canvas Chat      │
│ [Zoom] │                                            │ ─────────────────│
│ ─────  │                                            │                   │
│ ☐      │ ┌──────────────────────────────────────────┐│                   │
│ Brush  │ │                                          ││ [... messages ...]│
│ Edit   │ │              Canvas Image                ││                   │
│ ☐      │ │                                          ││                   │
│ Erase  │ │                                          ││                   │
│ ■■■■■  │ │                                          ││                   │
│ ① Click│ │               ① ╋                        ││                   │
│ Edit   │ │            (crosshair                    ││                   │
│ ☐      │ │             cursor)                      ││                   │
│ Expand │ │                                          ││                   │
│ ─────  │ │                                          ││                   │
│ [Down] │ │                                          ││ ┌───────────────┐ │
│ [Del]  │ │                                          ││ │ "Replace with │ │
│ [Undo] │ │                                          ││ │  a cat"       │ │
│ [Redo] │ │                                          ││ │          [→]  │ │
│        │ └──────────────────────────────────────────┘│ └───────────────┘ │
├────────┴────────────────────────────────────────────┴───────────────────┤
└─────────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `click-edit-btn`: Active state. Cursor is crosshair — user clicks on object to trigger SAM 2 segmentation

### State Variations

| State | Visual Change |
|-------|---------------|
| `click-waiting` | Crosshair cursor, no overlay, no floating toolbar |
| `click-waiting (mask exists)` | Crosshair cursor. Click triggers confirmation dialog: "Diese Aktion ersetzt deine aktuelle Maske. Fortfahren?" [Abbrechen] [Ersetzen] |
| `sam-processing` | Loading spinner on image after click, crosshair remains |
| `sam-success` | Auto-generated mask appears as red overlay, transitions to Painting Mode with Floating Brush Toolbar (user can refine mask) |
| `sam-error (no object)` | Error toast: "Kein Objekt erkannt. Versuche einen anderen Punkt." Stays in click-waiting |
| `sam-error (api failure)` | Error toast: "SAM-Fehler. Versuche manuelles Maskieren." Suggests switching to Brush Edit mode for manual mask painting |

---

## Screen: Outpaint Mode

**Context:** User clicked `expand-btn` in toolbar. Direction controls appear at the 4 image edges. User selects direction(s) and expansion size, then sends prompt via chat.

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Canvas Detail-View                                            [X]     │
├────────┬────────────────────────────────────────────┬───────────────────┤
│        │                                            │                   │
│ [Move] │              ① [ ▲ Top ]                   │  Canvas Chat      │
│ [Zoom] │           [25%|②50%|100%]                  │ ─────────────────│
│ ─────  │                                            │                   │
│ ☐      │         ┌─────────────────────┐            │                   │
│ Brush  │  ③      │                     │   ④        │ [... messages ...]│
│ Edit   │ [◄Left] │                     │ [Right►]   │                   │
│ ☐      │ [25%|   │   Canvas Image      │ [25%|      │                   │
│ Erase  │  50%|   │                     │  50%|      │                   │
│ ☐      │  100%]  │                     │  100%]     │                   │
│ Click  │         │                     │            │                   │
│ Edit   │         │                     │            │                   │
│ ■■■■■  │         └─────────────────────┘            │                   │
│ ⑤ Expand│             ⑥ [ ▼ Bottom ]                │                   │
│ ─────  │           [25%|50%|100%]                   │ ┌───────────────┐ │
│ [Down] │                                            │ │ "Extend with  │ │
│ [Del]  │                                            │ │  beach & sea" │ │
│ [Undo] │                                            │ │          [⑦→] │ │
│ [Redo] │                                            │ └───────────────┘ │
├────────┴────────────────────────────────────────────┴───────────────────┤
└─────────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `outpaint-direction` (top): Direction button at top edge. Toggles selection
- ② `outpaint-size`: Size selection buttons (25%, 50%, 100%). 50% pre-selected as default
- ③ `outpaint-direction` (left): Direction button at left edge with own size selector
- ④ `outpaint-direction` (right): Direction button at right edge with own size selector
- ⑤ `expand-btn`: Active state in toolbar
- ⑥ `outpaint-direction` (bottom): Direction button at bottom edge with own size selector
- ⑦ Chat send: Submits prompt — triggers outpaint with selected directions + size. Disabled when no direction selected

### State Variations

| State | Visual Change |
|-------|---------------|
| `outpaint-config (no direction)` | All direction buttons unselected, chat send button disabled, inline hint: "Waehle mindestens eine Richtung zum Erweitern" |
| `outpaint-config (direction selected)` | Selected direction button(s) highlighted, size selector visible for each selected direction, send button enabled |
| `outpaint-config (multi-direction)` | Multiple direction buttons highlighted (e.g., top + right) |

---

## Screen: Generating State

**Context:** User triggered any edit operation (inpaint, erase, instruction edit, outpaint). Loading overlay appears on image. Tools are disabled.

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Canvas Detail-View                                            [X]     │
├────────┬────────────────────────────────────────────┬───────────────────┤
│        │                                            │                   │
│ [Move] │  ┌──────────────────────────────────────┐  │  Canvas Chat      │
│ [Zoom] │  │ Floating Brush Toolbar (disabled)    │  │ ─────────────────│
│ ─────  │  │ [====○====] [Brush|Eraser] [Clr]    │  │                   │
│ ☐░░░░  │  └──────────────────────────────────────┘  │                   │
│ Brush  │ ┌──────────────────────────────────────────┐│ [... messages ...]│
│ Edit   │ │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░││                   │
│ ☐░░░░  │ │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░││  ┌─────────────┐ │
│ Erase  │ │░░░░░░░░░ ① Loading Overlay ░░░░░░░░░░░░││  │ AI Agent    │ │
│ ☐░░░░  │ │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░││  │ generating  │ │
│ Click  │ │░░░░░░░░░░░ ② [  ◐  ] ░░░░░░░░░░░░░░░░░││  │ edit...     │ │
│ Edit   │ │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░││  └─────────────┘ │
│ ☐░░░░  │ │░░░░░░░░┌─ ─ ─ ─ ─ ─ ─┐░░░░░░░░░░░░░░░││                   │
│ Expand │ │░░░░░░░░│ ③ Mask stays │░░░░░░░░░░░░░░░││                   │
│ ─────  │ │░░░░░░░░│   visible    │░░░░░░░░░░░░░░░││                   │
│ [Down] │ │░░░░░░░░└─ ─ ─ ─ ─ ─ ─┘░░░░░░░░░░░░░░░││                   │
│ [Del]  │ │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░││ ┌───────────────┐ │
│ [Undo] │ │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░││ │ (input       │ │
│ [Redo] │ │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░││ │  disabled)   │ │
│        │ └──────────────────────────────────────────┘│ └───────────────┘ │
├────────┴────────────────────────────────────────────┴───────────────────┤
└─────────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① Loading overlay: Semi-transparent overlay covering the entire image
- ② Loading spinner: Animated spinner centered on image
- ③ Mask remains visible under loading overlay (for inpaint/erase modes)

### State Variations

| State | Visual Change |
|-------|---------------|
| `generating (from inpaint)` | Loading overlay + mask visible underneath, floating toolbar disabled |
| `generating (from erase)` | Loading overlay + mask visible underneath, floating toolbar disabled |
| `generating (from instruction edit)` | Loading overlay only, no mask, no floating toolbar |
| `generating (from outpaint)` | Loading overlay, direction controls hidden |
| `api-error` | Error toast appears, overlay removed, returns to previous mode with mask intact |

---

## Screen: Result State

**Context:** Generation completed successfully. New image replaces the previous one. Previous image pushed to undo stack. Mask remains if previous mode used masking.

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Canvas Detail-View                                            [X]     │
├────────┬────────────────────────────────────────────┬───────────────────┤
│        │                                            │                   │
│ [Move] │  ┌──────────────────────────────────────┐  │  Canvas Chat      │
│ [Zoom] │  │ Floating Brush Toolbar               │  │ ─────────────────│
│ ─────  │  │ [====○====] [Brush|Eraser] [Clr]    │  │                   │
│ ■■■■■  │  └──────────────────────────────────────┘  │  ┌─────────────┐ │
│ Brush  │ ┌──────────────────────────────────────────┐│  │ AI Agent    │ │
│ Edit   │ │                                          ││  │ Edit done!  │ │
│ ☐      │ │       ① New Generated Image              ││  └─────────────┘ │
│ Erase  │ │                                          ││                   │
│ ☐      │ │      ┌─ ─ ─ ─ ─ ─ ─ ─ ─┐               ││                   │
│ Click  │ │      │ ② Previous mask  │               ││                   │
│ Edit   │ │      │  still visible   │               ││                   │
│ ☐      │ │      │  (can iterate)   │               ││                   │
│ Expand │ │      └─ ─ ─ ─ ─ ─ ─ ─ ─┘               ││                   │
│ ─────  │ │                                          ││                   │
│ [Down] │ │                                          ││ ┌───────────────┐ │
│ [Del]  │ │                                          ││ │ "Now change   │ │
│ ③[Undo]│ │                                          ││ │  the color"   │ │
│ [Redo] │ │                                          ││ │          [→]  │ │
│        │ └──────────────────────────────────────────┘│ └───────────────┘ │
├────────┴────────────────────────────────────────────┴───────────────────┤
└─────────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① New image: Generated result replaces previous image in-place
- ② Previous mask overlay: Remains visible so user can iterate (adjust mask or send new prompt)
- ③ Undo button: Reverts to previous image from undo stack

### State Variations

| State | Visual Change |
|-------|---------------|
| `result (from inpaint/erase)` | New image + mask overlay remains, floating toolbar visible |
| `result (from instruction edit)` | New image only, no mask, no floating toolbar |
| `result (from outpaint)` | New expanded image, no direction controls |
| `result (navigation blocked)` | Prev/Next buttons disabled when mask exists |

---

## Completeness Check

| Check | Status |
|-------|--------|
| All UI Components from Discovery covered | ✅ |
| All relevant states visualized | ✅ |
| All Screens from UI Layout (Discovery) covered | ✅ |
| No Logic/Rules duplicated (stays in Discovery) | ✅ |
