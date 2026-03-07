# Wireframes: Generation UI Improvements

**Discovery:** `discovery.md` (same folder)
**Status:** Draft

---

## Component Coverage

| UI Component (from Discovery) | Screen |
|-------------------------------|--------|
| `aspect-ratio-chips` | Prompt Panel |
| `custom-ratio-input` | Prompt Panel |
| `size-chips` | Prompt Panel |
| `advanced-settings` | Prompt Panel |
| `variant-stepper` | Prompt Panel |
| `gallery-checkbox` | Gallery (Bulk Select) |
| `floating-action-bar` | Gallery (Bulk Select) |
| `move-dropdown` | Floating Action Bar / Lightbox |
| `compare-modal` | Compare View |
| `fav-filter-toggle` | Gallery Header |
| `lightbox-checkbox` | Lightbox |
| `lightbox-compare-bar` | Lightbox |
| `lightbox-move-btn` | Lightbox |

---

## User Flow Overview

```
[Gallery Default] ──checkbox click / long-press (touch)──► [Gallery Selecting]
       │                                                          │
       │                    card click = toggle selection    ┌─────┼──────────┬──────────┐
       │                    (NOT lightbox in this mode)      │     │          │          │
       │                                                  compare delete    move     download
       │                                                  (2-4)   confirm   confirm   (ZIP)
       │                                                     │     │          │          │
       │                                                     ▼     └────┬─────┘          │
       │                                               [Compare Grid]   │                │
       │                                                     │          ▼                │
       │                                                fullscreen  [Gallery Default]    │
       │                                                     │                           │
       │                                                     ▼                           │
       │                                            [Compare Fullscreen]                 │
       │                                                     │                           │
       │                                                  ESC/click                      │
       │                                                     │                           │
       │                                                     ▼                           │
       │                                               [Compare Grid]                    │
       │
       └──click image──► [Lightbox] ──checkbox click──► [Lightbox Compare Select]
                              │                                │
                           "Move"                     navigate + select (max 4)
                              │                                │
                              ▼                         "Compare" (2+) / "Cancel"
                        [Move Dropdown]                        │
                              │                                ▼
                              ▼                          [Compare Grid]
                        (toast + close)
```

---

## Screen: Prompt Panel (Left Column)

**Context:** Left column of the Workspace layout. Always visible. Contains all generation controls. This wireframe shows the optimized layout with new Aspect Ratio, Size, Advanced Settings and Variant Stepper controls.

### Wireframe

```
┌─────────────────────────────────────┐
│          PROMPT PANEL               │
├─────────────────────────────────────┤
│                                     │
│ ① [Model ▾ ________________________]│
│                                     │
│ ② [Template ▾ _____________________]│
│                                     │
│ ③ ┌─────────────────────────────── ┐│
│   │ Prompt Motiv                   ││
│   │ (3 lines, auto-resize)        ││
│   └─────────────────────────────── ┘│
│                                     │
│ ④ [ Builder    ] [ Improve    ]     │
│    ◄── 50% ───► ◄── 50% ────►      │
│                                     │
│ ⑤ ┌─────────────────────────────── ┐│
│   │ Style / Modifier               ││
│   │ (2 lines)                      ││
│   └─────────────────────────────── ┘│
│                                     │
│ ⑥ ┌─────────────────────────────── ┐│
│   │ Negative Prompt (conditional)  ││
│   │ (2 lines)                      ││
│   └─────────────────────────────── ┘│
│                                     │
│ ═══════════════════════════════════ │
│                                     │
│ ⑦ Aspect Ratio                     │
│   ┌────┐┌────┐┌────┐┌────┐┌────┐  │
│   │ 1:1││4:3 ││3:2 ││16:9││9:16│◄─┤── scroll
│   └────┘└────┘└────┘└────┘└────┘  │
│   ┌────┐┌────┐┌──────┐            │
│   │ 4:5││2:3 ││Custom│            │
│   └────┘└────┘└──────┘            │
│                                     │
│ ⑧ ┌────────────────────┐           │
│   │ 21:9               │ (N:N)     │
│   └────────────────────┘           │
│   (visible only when Custom active) │
│                                     │
│ ⑨ Size                             │
│   ┌────┐┌────┐┌────┐┌────┐┌────┐  │
│   │ xs ││ s  ││ m  ││ l  ││ xl │  │
│   │512 ││768 ││1024││1536││2048│  │
│   └────┘└────┘└────┘└────┘└────┘  │
│                                     │
│ ═══════════════════════════════════ │
│                                     │
│ ⑩ ▸ Advanced Settings              │
│   (collapsed by default)            │
│                                     │
│ ═══════════════════════════════════ │
│                                     │
│ ⑪ [-] 2 [+]  ⑫ [■ Generate      ] │
│   ◄ stepper ► ◄── rest width ────► │
│                                     │
└─────────────────────────────────────┘
```

**Annotations:**
- ① `Model Dropdown`: Existing. Full width. Loads model schema on change
- ② `Template Dropdown`: Existing. Full width
- ③ `Prompt Motiv Textarea`: Existing. 3 lines, auto-resize
- ④ `Builder + Improve Buttons`: Existing. 50/50 split layout
- ⑤ `Style/Modifier Textarea`: Existing. 2 lines
- ⑥ `Negative Prompt Textarea`: Existing. Conditional (model-dependent)
- ⑦ `aspect-ratio-chips`: NEW. Single-select chip group. Disabled chips show tooltip
- ⑧ `custom-ratio-input`: NEW. Inline text input, visible when Custom chip active
- ⑨ `size-chips`: NEW. Single-select chip group. Label shows pixel value below name
- ⑩ `advanced-settings`: NEW. Collapsible section. Contains model-specific params from schema
- ⑪ `variant-stepper`: NEW. [-] count [+], range 1-4
- ⑫ `Generate Button`: Existing. Fills remaining width next to stepper

### State Variations

| State | Visual Change |
|-------|---------------|
| `ratio-chip-disabled` | Chip grayed out, cursor not-allowed, tooltip on hover: "Not available for {Model}" |
| `custom-ratio-active` | Custom chip highlighted, input field ⑧ appears below chips |
| `custom-ratio-error` | Input field ⑧ with red border, error text below: "Invalid format (e.g. 21:9)" |
| `size-chip-disabled` | Chip grayed out, tooltip on hover: "Not available for {Model}" |
| `advanced-expanded` | ⑩ becomes `▾ Advanced Settings` with model-specific parameter controls below |
| `stepper-min` | [-] disabled (grayed), count shows 1 |
| `stepper-max` | [+] disabled (grayed), count shows 4 |
| `model-switch-reset` | When model changes and current ratio/size becomes incompatible: auto-selects first compatible option, chip briefly pulses to indicate change |

---

## Screen: Gallery with Bulk Select (Right Column)

**Context:** Right column of the Workspace layout. Always visible. Shows generated images in a masonry grid. New elements: favorites filter toggle in header, checkbox overlay on hover (desktop) / long-press (mobile/touch), floating action bar when images selected. In selecting mode, card click toggles selection (not lightbox). Gallery gets dynamic bottom padding equal to action bar height when in selecting mode.

### Wireframe — Default State

```
┌──────────────────────────────────────────────┐
│              GALLERY                         │
├──────────────────────────────────────────────┤
│                                              │
│  Gallery Title  (24 images)        ① [☆]    │
│                                              │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│ │          │ │          │ │          │      │
│ │  image   │ │  image   │ │  image   │      │
│ │          │ │          │ │          │      │
│ └──────────┘ └──────────┘ └──────────┘      │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│ │          │ │          │ │          │      │
│ │  image   │ │  image   │ │  image   │      │
│ │          │ │          │ │          │      │
│ └──────────┘ └──────────┘ └──────────┘      │
│                                              │
│              [... more images ...]            │
│                                              │
└──────────────────────────────────────────────┘
```

### Wireframe — Hover State (Checkbox Visible)

```
┌──────────────────────────────────────────────┐
│  Gallery Title  (24 images)           [☆]   │
│                                              │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│ │② ☐       │ │          │ │          │      │
│ │  image   │ │  image   │ │  image   │      │
│ │ (hovered)│ │          │ │          │      │
│ └──────────┘ └──────────┘ └──────────┘      │
│                                              │
└──────────────────────────────────────────────┘
```

### Wireframe — Selecting State (Action Bar Visible)

```
┌──────────────────────────────────────────────┐
│  Gallery Title  (24 images)           [★]   │
│                                              │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│ │② ☑       │ │  ☐       │ │          │      │
│ │ ┏━━━━━━┓ │ │  image   │ │  image   │      │
│ │ ┃image ┃ │ │          │ │          │      │
│ │ ┗━━━━━━┛ │ │          │ │          │      │
│ └──────────┘ └──────────┘ └──────────┘      │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│ │  ☑       │ │          │ │  ☑       │      │
│ │ ┏━━━━━━┓ │ │  image   │ │ ┏━━━━━━┓ │      │
│ │ ┃image ┃ │ │          │ │ ┃image ┃ │      │
│ │ ┗━━━━━━┛ │ │          │ │ ┗━━━━━━┛ │      │
│ └──────────┘ └──────────┘ └──────────┘      │
│                                              │
│ ┌────────────────────────────────────────┐   │
│ │③          FLOATING ACTION BAR          │   │
│ │                                        │   │
│ │  3 selected · Select All · Cancel       │   │
│ │                                        │   │
│ │         ④[Move ▾] ⑤[♥] ⑥[Compare]    │   │
│ │         ⑦[↓ Download] ⑧[Delete]       │   │
│ └────────────────────────────────────────┘   │
│  (gallery has dynamic bottom padding here)   │
│                                              │
└──────────────────────────────────────────────┘
```

**Annotations:**
- ① `fav-filter-toggle`: NEW. Star icon in gallery header. Toggles between all images / favorites only
- ② `gallery-checkbox`: NEW. Checkbox overlay, top-left of each image card. Desktop: visible on hover. Mobile/Touch: long-press activates selection mode. In selecting mode, card click = toggle selection (not lightbox). Persists when checked
- ③ `floating-action-bar`: NEW. Sticky bottom bar, centered. Appears when 1+ images selected. Includes "Select All / Deselect All" toggle left of count. Gallery gets dynamic bottom padding to prevent obscuring images
- ④ `move-dropdown`: NEW. Dropdown listing all projects except current
- ⑤ `Favorite Toggle`: Bulk favorite/unfavorite action
- ⑥ `Compare Button`: Opens compare modal. Active only when 2-4 images selected. Disabled tooltip: "Select 2-4 images to compare"
- ⑦ `Download Button`: Generates ZIP of selected images
- ⑧ `Delete Button`: Opens confirm dialog for bulk delete

### State Variations

| State | Visual Change |
|-------|---------------|
| `gallery-default` | No checkboxes visible, no action bar. Desktop: checkbox appears on individual card hover. Mobile/Touch: long-press activates selecting mode |
| `gallery-selecting` | All cards show checkbox (checked or unchecked), selected cards have blue border, card click = toggle selection (not lightbox), action bar visible at bottom with dynamic bottom padding on gallery |
| `fav-filter-active` | Star icon ① filled/highlighted, gallery shows only favorited images |
| `compare-btn-disabled` | Compare button ⑥ grayed out when 0-1 or 5+ images selected. Tooltip: "Select 2-4 images to compare" |
| `move-dropdown-open` | Dropdown ④ expanded showing project list |
| `bulk-delete-confirm` | ConfirmDialog overlay: "{N} images will be permanently deleted. Continue?" with Cancel/Delete buttons |
| `bulk-move-confirm` | ConfirmDialog: "Move {N} images to '{Project}'?" with Cancel/Move buttons |

---

## Screen: Compare View Modal

**Context:** Fullscreen overlay over entire viewport. Opened via bulk select compare action or from lightbox compare flow. Shows 2-4 images in a 2x2 grid.

### Wireframe — Grid View (4 Images)

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Compare (4)                                     ① [X]  │
│                                                          │
│ ┌──────────────────────────┐ ┌──────────────────────────┐│
│ │                      ② ⛶│ │                      ② ⛶││
│ │                          │ │                          ││
│ │                          │ │                          ││
│ │        Image 1           │ │        Image 2           ││
│ │                          │ │                          ││
│ │                          │ │                          ││
│ │                          │ │                          ││
│ │  ③ FLUX 1.1 · 1024x576  │ │  ③ SD XL · 1024x1024    ││
│ └──────────────────────────┘ └──────────────────────────┘│
│ ┌──────────────────────────┐ ┌──────────────────────────┐│
│ │                      ② ⛶│ │                      ② ⛶││
│ │                          │ │                          ││
│ │                          │ │                          ││
│ │        Image 3           │ │        Image 4           ││
│ │                          │ │                          ││
│ │                          │ │                          ││
│ │                          │ │                          ││
│ │  ③ FLUX 1.1 · 768x1024  │ │  ③ SD XL · 1536x1024    ││
│ └──────────────────────────┘ └──────────────────────────┘│
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Wireframe — Grid View (2 Images)

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Compare (2)                                     ① [X]  │
│                                                          │
│ ┌──────────────────────────┐ ┌──────────────────────────┐│
│ │                      ② ⛶│ │                      ② ⛶││
│ │                          │ │                          ││
│ │                          │ │                          ││
│ │        Image 1           │ │        Image 2           ││
│ │                          │ │                          ││
│ │                          │ │                          ││
│ │                          │ │                          ││
│ │  ③ FLUX 1.1 · 1024x576   │ │  ③ SD XL · 1024x1024    ││
│ └──────────────────────────┘ └──────────────────────────┘│
│ ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐│
│ │                          │ │                          ││
│ │                          │ │                          ││
│ │        (empty)           │ │        (empty)           ││
│ │                          │ │                          ││
│ │                          │ │                          ││
│ └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘│
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Wireframe — Fullscreen Single

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│                                                   [X]   │
│                                                          │
│                                                          │
│                                                          │
│                                                          │
│                                                          │
│                    Image (100% viewport)                  │
│                                                          │
│                                                          │
│                                                          │
│                                                          │
│                                                          │
│                                                          │
│  ③ FLUX 1.1 · 1024 x 576                                  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `Close Button`: X button, closes compare modal, returns to gallery
- ② `Fullscreen Toggle`: Per-image button (top-right). Click expands image to full viewport
- ③ `Model + Dimensions Display`: Always shows model name + width x height below each image (e.g. "FLUX 1.1 · 1024x576")

### State Variations

| State | Visual Change |
|-------|---------------|
| `grid-view-4` | 2x2 grid fully populated |
| `grid-view-3` | 2x2 grid, bottom-right cell is empty (dashed border) |
| `grid-view-2` | 2x2 grid, bottom row empty (dashed borders) |
| `fullscreen-single` | Single image fills entire modal, ESC or click returns to grid |

---

## Screen: Lightbox Extensions

**Context:** Existing fullscreen lightbox modal. Extended with checkbox for compare selection, floating compare bar, and move button. In the lightbox, users can select images for comparison by checking checkboxes while navigating, then open the compare view. Move button with dropdown for single-image move. Success toast after move (sonner).

### Wireframe — Lightbox Default (with new actions)

```
┌──────────────────────────────────────────────────────────┐
│                          LIGHTBOX                        │
│                                                          │
│  ◄ Prev                                        Next ►   │
│                                                          │
│  ① ☐ (checkbox, top-left of image)                      │
│                                                          │
│                   [  Current Image  ]                    │
│                                                          │
│                                                          │
│ ═══════════════════════════════════════════════════════  │
│                                                          │
│  [... existing actions ...]   ② [ Move ▾ ]              │
│                                                          │
│  [... existing details panel ...]                        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Wireframe — Lightbox Compare Select Mode

```
┌──────────────────────────────────────────────────────────┐
│                          LIGHTBOX                        │
│                                                          │
│  ◄ Prev                                        Next ►   │
│                                                          │
│  ① ☑ (checked)                                          │
│                                                          │
│                   [  Current Image  ]                    │
│                                                          │
│                                                          │
│ ═══════════════════════════════════════════════════════  │
│                                                          │
│  [... existing actions ...]   ② [ Move ▾ ]              │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ ③ FLOATING COMPARE BAR                             │  │
│ │                                                    │  │
│ │  2 selected    ④ [Compare]    ⑤ Cancel             │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Wireframe — Lightbox Move Dropdown

```
┌──────────────────────────────────────────────────────────┐
│                          LIGHTBOX                        │
│                                                          │
│                   [  Current Image  ]                    │
│                                                          │
│ ═══════════════════════════════════════════════════════  │
│                                                          │
│  [... existing actions ...]   ② [ Move ▾ ]              │
│                                    ┌─────────────────┐   │
│                                    │ Project Alpha   │   │
│                                    │ Project Beta    │   │
│                                    │ Project Gamma   │   │
│                                    └─────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `lightbox-checkbox`: NEW. Checkbox overlay on current lightbox image (top-left). Click toggles selection for compare
- ② `lightbox-move-btn`: NEW. Button with dropdown. Lists all projects except current. After move: success toast "Image moved to '{Project}'" (sonner), lightbox closes, gallery refreshes
- ③ `lightbox-compare-bar`: NEW. Floating bar at bottom of lightbox. Appears when 1+ images checked. Shows count + Compare button + Cancel
- ④ `Compare Button`: Opens compare modal. Active when 2-4 images selected. Disabled tooltip: "Select 2-4 images to compare"
- ⑤ `Cancel`: Clears selection, hides compare bar, returns to normal lightbox

### State Variations

| State | Visual Change |
|-------|---------------|
| `default` | Checkbox ① visible (unchecked), Move button ② visible. No compare bar |
| `compare-selecting` | 1+ checkboxes checked across navigated images. Floating compare bar ③ visible at bottom |
| `compare-ready` | 2-4 images checked. Compare button ④ active/highlighted |
| `compare-max` | 4 images checked. Checkbox on unchecked images disabled (tooltip: "Max 4 images") |
| `move-dropdown-open` | Dropdown list ② expanded showing projects |
| `move-success` | Toast: "Image moved to '{Project}'" appears, lightbox closes |

---

## Screen: Advanced Settings (Expanded)

**Context:** Collapsible section within the Prompt Panel. When expanded, shows model-specific parameters loaded from the model schema. Replaces parameters that were previously shown inline.

### Wireframe

```
┌─────────────────────────────────────┐
│ [... Prompt Panel above ...]        │
│                                     │
│ ═══════════════════════════════════ │
│                                     │
│ ① ▾ Advanced Settings               │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │  ② [Param 1 ▾ ______________]  │ │
│ │                                 │ │
│ │  ③ [Param 2 ▾ ______________]  │ │
│ │                                 │ │
│ │  ④ Param 3  ◄━━━━━○━━━━━━━━►  │ │
│ │              (slider)           │ │
│ │                                 │ │
│ │  ⑤ [Param 4  ☑]               │ │
│ │     (checkbox)                  │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ═══════════════════════════════════ │
│                                     │
│ [-] 2 [+]   [■ Generate          ] │
│                                     │
└─────────────────────────────────────┘
```

**Annotations:**
- ① `advanced-settings`: Collapsible header. Click toggles expanded/collapsed
- ②③④⑤ Model-specific parameters from schema (dropdowns, sliders, checkboxes — dynamic)

### State Variations

| State | Visual Change |
|-------|---------------|
| `collapsed` | Only header "▸ Advanced Settings" visible, no parameters shown |
| `expanded` | Header "▾ Advanced Settings", parameter controls visible below |

---

## Completeness Check

| Check | Status |
|-------|--------|
| All Screens from UI Layout (Discovery) covered | Yes |
| All UI Components annotated | Yes |
| Relevant State Variations documented | Yes |
| No Logic/Rules duplicated (stays in Discovery) | Yes |
