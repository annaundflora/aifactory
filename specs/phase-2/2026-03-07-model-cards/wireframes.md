# Wireframes: Model Cards & Multi-Model Selection

**Discovery:** `discovery.md` (same folder)
**Status:** Draft

---

## Component Coverage

| UI Component (from Discovery) | Screen |
|-------------------------------|--------|
| `model-trigger` | Prompt Area |
| `model-trigger-item` | Prompt Area |
| `model-browser-drawer` | Model Browser Drawer |
| `model-search` | Model Browser Drawer |
| `model-filter-chips` | Model Browser Drawer |
| `model-card` | Model Browser Drawer |
| `model-card-checkbox` | Model Browser Drawer |
| `model-card-description` | Model Browser Drawer |
| `confirm-button` | Model Browser Drawer |
| `model-badge` | Gallery Thumbnails |
| `parameter-panel-notice` | Prompt Area (Multi-Model) |

---

## User Flow Overview

```
[Prompt Area: Trigger Card] ──"Browse Models"──> [Drawer: Loading]
                                                       │
                                                       ├──success──> [Drawer: Loaded]
                                                       └──error────> [Drawer: Error]

[Drawer: Loaded] ──select cards──> [Drawer: N selected]
                                         │
                                         ├──"Confirm"──> [Prompt Area: Updated Trigger]
                                         └──close/X───> [Prompt Area: Unchanged]

[Prompt Area] ──"Generate"──> [Gallery: Loading placeholders per model]
                                     │
                                     └──complete──> [Gallery: Results with Model Badge]
```

---

## Screen: Prompt Area — Model Trigger (Single Model)

**Context:** Left sidebar, inside PromptTabs content area. Replaces the current `<Select>` dropdown. Always visible when workspace is open.

### Wireframe

```
┌─── Prompt Area (Sidebar) ──────────────────┐
│                                             │
│  [... prompt input above ...]               │
│                                             │
│  ═══════════════════════════════════════     │
│                                             │
│  Model                              ①      │
│  ┌─────────────────────────────────────┐    │
│  │  ┌──────┐                           │    │
│  │  │ ▓▓▓▓ │  FLUX 1.1 Pro        ✕   │ ②  │
│  │  │ ▓▓▓▓ │  black-forest-labs    ③   │    │
│  │  └──────┘                           │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Browse Models                         ④    │
│                                             │
│  ═══════════════════════════════════════     │
│                                             │
│  [... parameters below ...]                 │
│                                             │
└─────────────────────────────────────────────┘
```

**Annotations:**
- ① `model-trigger`: Compact card group showing selected model(s)
- ② `model-trigger-item`: Mini card with thumbnail (32x32), model name, owner, remove button
- ③ Owner name in muted text
- ④ "Browse Models" link/button opens the Model Browser Drawer

---

## Screen: Prompt Area — Model Trigger (Multi-Model, 3 Selected)

**Context:** Same position as above. Shows stacked mini-cards when multiple models are selected.

### Wireframe

```
┌─── Prompt Area (Sidebar) ──────────────────┐
│                                             │
│  [... prompt input above ...]               │
│                                             │
│  ═══════════════════════════════════════     │
│                                             │
│  Model (3 selected)                  ①      │
│  ┌─────────────────────────────────────┐    │
│  │  ┌──────┐                           │    │
│  │  │ ▓▓▓▓ │  FLUX 1.1 Pro        ✕   │ ②  │
│  │  │ ▓▓▓▓ │  black-forest-labs        │    │
│  │  └──────┘                           │    │
│  ├─────────────────────────────────────┤    │
│  │  ┌──────┐                           │    │
│  │  │ ░░░░ │  SDXL                 ✕   │ ②  │
│  │  │ ░░░░ │  stability-ai             │    │
│  │  └──────┘                           │    │
│  ├─────────────────────────────────────┤    │
│  │  ┌──────┐                           │    │
│  │  │ ▒▒▒▒ │  Playground v2.5     ✕   │ ②  │
│  │  │ ▒▒▒▒ │  playgroundai             │    │
│  │  └──────┘                           │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Browse Models                         ③    │
│                                             │
│  ═══════════════════════════════════════     │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  Default parameters will be used    │ ④  │
│  │  for multi-model generation.        │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [... rest of prompt area ...]              │
│                                             │
└─────────────────────────────────────────────┘
```

**Annotations:**
- ① `model-trigger`: Label shows count "(3 selected)"
- ② `model-trigger-item`: Each mini-card with thumbnail, name, owner, X remove button
- ③ "Browse Models" link below the stacked cards
- ④ `parameter-panel-notice`: Replaces parameter panel when >1 model selected

### State Variations

| State | Visual Change |
|-------|---------------|
| `single` | One mini-card, label shows "Model" without count |
| `multi` (2-3) | Stacked mini-cards with dividers, label shows "(N selected)" |
| `loading` | Skeleton placeholder instead of mini-card content |
| `hover` on mini-card | X button becomes more prominent |
| `last model remaining` | X button hidden (min 1 model enforced) |

---

## Screen: Model Browser Drawer

**Context:** Right-side drawer overlay, opened via "Browse Models" button. Overlays the main content area.

### Wireframe

```
                              ┌─── Model Browser Drawer ───────────────────┐
                              │                                             │
                              │  Select Models                        ✕  ① │
                              │                                             │
                              │  ┌─────────────────────────────────────┐    │
                              │  │  🔍  Search models...               │ ② │
                              │  └─────────────────────────────────────┘    │
                              │                                             │
                              │  [ All ]  [ stability-ai ]  [ black-f.. ]  │
                              │  [ playgroundai ]  [ bytedance ]       ③    │
                              │                                             │
                              │  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐  │
                              │  │                                       │  │
                              │  │         Card Grid (2 columns)        │  │
                              │  │         See Model Card detail        │  │
                              │  │         below                        │  │
                              │  │                                       │  │
                              │  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘  │
                              │                                             │
                              │  ═══════════════════════════════════════    │
                              │  ┌─────────────────────────────────────┐    │
                              │  │        Confirm (2 Models)           │ ④  │
                              │  └─────────────────────────────────────┘    │
                              │                                             │
                              └─────────────────────────────────────────────┘
```

**Annotations:**
- ① `model-browser-drawer`: Right-side drawer with close button (X)
- ② `model-search`: Text input with search icon, placeholder "Search models..."
- ③ `model-filter-chips`: Horizontally scrollable chips, "All" active by default, one owner selectable at a time
- ④ `confirm-button`: Sticky bottom bar, shows count "Confirm (N Models)", disabled when 0 selected

### State Variations

| State | Visual Change |
|-------|---------------|
| `loading` | Spinner centered in card grid area, search/filters disabled |
| `loaded` | Card grid visible, search and filters active |
| `error` | Error message "Could not load models. Please try again." with Retry button in card grid area |
| `empty` | "No models available." message in card grid area |
| `0 selected` | Confirm button disabled, text "Select at least 1 model" |
| `search active` | Cards filtered, non-matching cards hidden |
| `filter active` | Only cards from selected owner visible, active chip highlighted |
| `search + filter` | Both applied simultaneously (AND logic) |
| `max 3 reached` | Unselected cards disabled, inline hint "Select up to 3 models" visible near counter |

---

## Screen: Model Card (inside Drawer Grid)

**Context:** Individual card within the 2-column grid inside the Model Browser Drawer.

### Wireframe — Default State

```
┌───────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← Cover image (16:9)
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │         ┌───┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │         │ ☐ │ ①
│                           │         └───┘
│  FLUX 1.1 Pro         ②  │
│  black-forest-labs    ③   │
│  Ultra-high quality       │
│  image generation w...④   │
│                           │
│  ┌──────────┐             │
│  │ 2.3M runs│         ⑤   │
│  └──────────┘             │
└───────────────────────────┘
```

### Wireframe — Selected State

```
┌═══════════════════════════┐  ← Ring/border (selected)
║ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ║
║ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ║
║ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ║         ┌───┐
║ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ║         │ ✓ │ ①
║                           ║         └───┘
║  FLUX 1.1 Pro             ║
║  black-forest-labs        ║
║  Ultra-high quality       ║
║  image generation w...    ║
║                           ║
║  ┌──────────┐             ║
║  │ 2.3M runs│             ║
║  └──────────┘             ║
└═══════════════════════════┘
```

**Annotations:**
- ① `model-card-checkbox`: Top-right overlay, unchecked (☐) or checked (✓)
- ② `model-card` name: Bold, single line, truncated if long
- ③ Owner name: Muted text, single line
- ④ `model-card-description`: 2 lines max, truncated with tooltip on hover showing full text
- ⑤ Run count badge: Formatted number (e.g. "2.3M runs")

### State Variations

| State | Visual Change |
|-------|---------------|
| `default` | Standard border, unchecked checkbox |
| `hover` | Slight elevation/shadow change |
| `selected` | Prominent ring/border, checkbox shows checkmark |
| `disabled` | Reduced opacity, checkbox not clickable (max 3 reached, card not already selected) |
| `no cover image` | Gradient fallback instead of cover image |

---

## Screen: Model Browser Drawer — Full Layout with Cards

**Context:** Complete view of the drawer with the 2-column card grid populated.

### Wireframe

```
                              ┌─── Model Browser Drawer ───────────────────┐
                              │                                             │
                              │  Select Models                        ✕    │
                              │                                             │
                              │  ┌─────────────────────────────────────┐    │
                              │  │  🔍  Search models...               │    │
                              │  └─────────────────────────────────────┘    │
                              │                                             │
                              │  [•All•] [stability-ai] [black-forest..]   │
                              │                                             │
                              │  ┌────────────────┐  ┌────────────────┐    │
                              │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  │ ░░░░░░░░░░░░░░ │    │
                              │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  │ ░░░░░░░░░░░░░░ │    │
                              │  │            [✓]  │  │            [☐]  │    │
                              │  │ FLUX 1.1 Pro    │  │ SDXL            │    │
                              │  │ black-forest-.. │  │ stability-ai    │    │
                              │  │ Ultra-high q..  │  │ A latent tex..  │    │
                              │  │ [2.3M runs]     │  │ [1.8M runs]     │    │
                              │  └────────────────┘  └────────────────┘    │
                              │                                             │
                              │  ┌────────────────┐  ┌────────────────┐    │
                              │  │ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │    │
                              │  │ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │    │
                              │  │            [✓]  │  │            [☐]  │    │
                              │  │ Playground v2.5 │  │ Kandinsky 3     │    │
                              │  │ playgroundai    │  │ ai-forever      │    │
                              │  │ Playground v2.. │  │ Generate imag.. │    │
                              │  │ [850K runs]     │  │ [420K runs]     │    │
                              │  └────────────────┘  └────────────────┘    │
                              │                                             │
                              │  ... (scrollable)                           │
                              │                                             │
                              │  ═══════════════════════════════════════    │
                              │  ┌─────────────────────────────────────┐    │
                              │  │         Confirm (2 Models)          │    │
                              │  └─────────────────────────────────────┘    │
                              │                                             │
                              └─────────────────────────────────────────────┘
```

**Notes:**
- 2 of 4 visible cards are selected (FLUX 1.1 Pro, Playground v2.5) — shown with [✓]
- Counter in confirm button reflects selection: "Confirm (2 Models)"
- Grid is scrollable for additional cards beyond viewport

---

## Screen: Gallery Thumbnails with Model Badge

**Context:** Main content area, Gallery grid. Model Badge is added as an overlay on every generation card thumbnail.

### Wireframe

```
┌─── Gallery Grid ─────────────────────────────────────────────┐
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐  │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  │ ░░░░░░░░░░░░░░░░ │  │ ▒▒▒▒▒▒▒▒▒▒ │  │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  │ ░░░░░░░░░░░░░░░░ │  │ ▒▒▒▒▒▒▒▒▒▒ │  │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  │ ░░░░░░░░░░░░░░░░ │  │ ▒▒▒▒▒▒▒▒▒▒ │  │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  │ ░░░░░░░░░░░░░░░░ │  │ ▒▒▒▒▒▒▒▒▒▒ │  │
│  │ ┌──────────────┐  │  │ ┌──────────────┐  │  │ ┌────────┐  │  │
│  │ │FLUX 1.1 Pro  │① │  │ │FLUX 1.1 Pro  │  │  │ │SDXL    │  │  │
│  │ └──────────────┘  │  │ └──────────────┘  │  │ └────────┘  │  │
│  └──────────────────┘  └──────────────────┘  └────────────┘  │
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐  │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  │ ░░░░░░░░░░░░░░░░ │  │ ▒▒▒▒▒▒▒▒▒▒ │  │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  │ ░░░░░░░░░░░░░░░░ │  │ ▒▒▒▒▒▒▒▒▒▒ │  │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  │ ░░░░░░░░░░░░░░░░ │  │ ▒▒▒▒▒▒▒▒▒▒ │  │
│  │ ┌──────────────┐  │  │ ┌──────────────┐  │  │ ┌────────┐  │  │
│  │ │Playground2.5 │  │  │ │SDXL          │  │  │ │FLUX ..  │  │  │
│  │ └──────────────┘  │  │ └──────────────┘  │  │ └────────┘  │  │
│  └──────────────────┘  └──────────────────┘  └────────────┘  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `model-badge`: Semi-transparent label overlay at bottom-left of thumbnail, shows model display name. Present on every generation card.

### State Variations

| State | Visual Change |
|-------|---------------|
| `visible` | Badge always shown on all thumbnails |
| `long model name` | Name truncated to fit badge width |

---

## Completeness Check

| Check | Status |
|-------|--------|
| All Screens from UI Layout (Discovery) covered | Yes |
| All UI Components annotated | Yes |
| Relevant State Variations documented | Yes |
| No Logic/Rules duplicated (stays in Discovery) | Yes |
