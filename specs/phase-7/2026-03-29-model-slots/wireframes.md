# Wireframes: Model Slots

**Discovery:** `discovery.md` (same folder)
**Status:** Draft

---

## Component Coverage

| UI Component (from Discovery) | Screen |
|-------------------------------|--------|
| Slot Checkbox (active/inactive toggle) | All screens with Model Slots |
| Slot Dropdown (model selection) | All screens with Model Slots |
| Model Slots Container (3 rows) | Workspace Prompt Area, Canvas Popovers, Chat Panel |
| Per-Slot Parameter Panel | Workspace Prompt Area, Canvas Popovers |
| Read-Only Model Display | Settings Dialog |
| Disabled Checkbox (empty slot) | All screens with Model Slots |
| Compatibility-filtered Dropdown | All screens with Model Slots |
| Generate Button (multi-model aware) | Workspace Prompt Area, Canvas Popovers |

---

## User Flow Overview

```
[Workspace: 1 Slot active]
    │
    ├──toggle checkbox──► [2-3 Slots active] ──generate──► [Multi-Model Results]
    │
    ├──change dropdown──► [Different Model in Slot]
    │
    ├──switch mode──► [Mode-specific Slots loaded from DB]
    │
    └──open settings──► [Read-Only Slot View]
```

---

## Screen: Workspace Prompt Area

**Context:** Left sidebar panel. Model Slots replace the former TierToggle (Draft|Quality|Max) between the prompt inputs and the parameter controls. This is the primary interaction point.

### Wireframe

```
┌─────────────────────────────────────────────┐
│  [... Prompt Tabs / Mode Selector ...]      │
│  [... Prompt Textarea ...]                  │
│  [... Style / Negative Prompt ...]          │
│  [... Reference Slots (img2img) ...]        │
│                                             │
│  ═══════════════════════════════════════════ │
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │ ☑① [ Flux Schnell              ▾]②    ││
│  │    ⑤ Aspect Ratio: [ 1:1 ▾]            ││
│  │                                         ││
│  │ ☑①  [ Flux Pro                  ▾]②    ││
│  │    ⑤ Megapixels: [ 1 ▾]                ││
│  │                                         ││
│  │ ☐③ [ ── select model ──        ▾]④    ││
│  └─────────────────────────────────────────┘│
│                                             │
│  ⑥ Variants              [ - ] 2 [ + ]     │
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │         ⑦ [ ✦ Generate ]               ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

**Annotations:**
- ① Slot Checkbox: toggles slot active/inactive. Min 1 must remain active.
- ② Model Dropdown: shows only models compatible with current mode. Displays model display name.
- ③ Disabled Checkbox: cannot activate because no model is assigned to this slot. Auto-activates when a model is selected.
- ④ Empty Slot Dropdown: shows placeholder "select model". Selecting a model auto-activates the slot (☑).
- ⑤ Per-Slot Parameter Panel: each active slot shows its own schema-based parameters inline below the dropdown. Different models may show different parameters (e.g. Schnell has aspect_ratio, Pro has megapixels). Inactive/empty slots show no parameters.
- ⑥ Variant Count Stepper: applies per model. 2 active slots x 2 variants = 4 images total.
- ⑦ Generate Button: sends all active slot model IDs as `modelIds[]`.

### State Variations

| State | Visual Change |
|-------|---------------|
| `loading` | Dropdowns show skeleton placeholders, checkboxes disabled |
| `generating` | All checkboxes and dropdowns disabled, Generate shows spinner |
| `single-slot` | Only 1 checkbox active, behaves like old single-model flow |
| `multi-slot` | 2-3 checkboxes active, Generate button unchanged |
| `last-active-toggle` | Attempting to uncheck last active slot: checkbox stays checked (no-op) |
| `model-selected-on-empty` | User picks model in empty slot ④: slot auto-activates ☑ (ready for generation) |
| `no-models-synced` | All dropdowns show "No models. Sync in Settings." message |
| `mode-switch` | Slots swap to mode-specific assignments (persisted in DB per mode) |
| `upscale-mode` | All 3 slots visible (consistent with all modes). Slot 3 may be empty by default. |

---

## Screen: Variation Popover (Canvas)

**Context:** Popover appearing from canvas toolbar when user clicks "Variation" on an existing generation. Compact layout. TierToggle was between Count and Parameters.

### Wireframe

```
┌──────────────────────────────────┐
│  ✦ Variation                     │
├──────────────────────────────────┤
│                                  │
│  Prompt                          │
│  ┌──────────────────────────────┐│
│  │ [pre-filled prompt...]       ││
│  └──────────────────────────────┘│
│                                  │
│  Negative Prompt                 │
│  ┌──────────────────────────────┐│
│  │ [optional...]                ││
│  └──────────────────────────────┘│
│                                  │
│  Count                           │
│  [ 1 ] [ 2 ] [ 3 ] [ 4 ]        │
│                                  │
│  ┌──────────────────────────────┐│
│  │ ☑① [ Flux Schnell      ▾]② ││
│  │    ⑤ Aspect Ratio: [1:1 ▾] ││
│  │ ☐③ [ Flux Pro          ▾]   ││
│  │ ☐③ [ ── select ──      ▾]   ││
│  └──────────────────────────────┘│
│                                  │
│  [ ✦ Generate ]④                │
└──────────────────────────────────┘
```

**Annotations:**
- ① Active Slot Checkbox
- ② Model Dropdown (mode-filtered: txt2img models for variation)
- ③ Inactive Slot Checkboxes (auto-activate on model selection)
- ④ Generate Button: sends active slot modelIds
- ⑤ Per-Slot Parameter Panel: shown inline below each active slot's dropdown

### State Variations

| State | Visual Change |
|-------|---------------|
| `generating` | All controls disabled, Generate shows spinner |
| `single-slot` | Only 1 checkbox active |
| `multi-slot` | Multiple checkboxes active |

---

## Screen: Img2img Popover (Canvas)

**Context:** Popover for image-to-image generation from canvas toolbar. Similar structure to Variation Popover but with strength control and variant stepper.

### Wireframe

```
┌──────────────────────────────────┐
│  ✦ Image to Image                │
├──────────────────────────────────┤
│                                  │
│  Prompt                          │
│  ┌──────────────────────────────┐│
│  │ [prompt...]                  ││
│  └──────────────────────────────┘│
│                                  │
│  Strength       [━━━━━●━━] 0.6   │
│  Variants        [ - ] 2 [ + ]   │
│                                  │
│  ┌──────────────────────────────┐│
│  │ ☑① [ Flux Schnell      ▾]   ││
│  │    ② Aspect Ratio: [1:1 ▾]  ││
│  │ ☐  [ Flux Pro          ▾]   ││
│  │ ☐  [ ── select ──      ▾]   ││
│  └──────────────────────────────┘│
│                                  │
│  [ Generate ]                    │
└──────────────────────────────────┘
```

**Annotations:**
- ① Model Slots: same pattern as Workspace, mode-filtered for img2img-compatible models
- ② Per-Slot Parameter Panel: shown inline below each active slot's dropdown (same as Workspace/Variation)

### State Variations

| State | Visual Change |
|-------|---------------|
| `generating` | All controls disabled |
| `incompatible-model` | Model grayed out in dropdown if not img2img-capable |

---

## Screen: Upscale Popover (Canvas)

**Context:** Compact popover for upscaling. Currently has TierToggle with hidden "max" value (only Draft/Quality). Now shows 3 slots consistent with all other modes.

### Wireframe

```
┌──────────────────────────────┐
│  🔍 Upscale                  │
├──────────────────────────────┤
│                              │
│  ┌──────────────────────────┐│
│  │ ☑① [ Crystal Upscaler▾] ││
│  │ ☐  [ Real-ESRGAN    ▾]  ││
│  │ ☐  [ ── select ──   ▾]  ││
│  └──────────────────────────┘│
│                              │
│  [ 2x Upscale ]②            │
│  [ 4x Upscale ]             │
│                              │
└──────────────────────────────┘
```

**Annotations:**
- ① Model Slots: 3 slots, consistent with all other modes. Slot 3 empty by default (few upscale models available). No Per-Slot ParameterPanel (Upscale uses direct action buttons instead per Discovery exception).
- ② Scale Buttons: direct action triggers (2x/4x). Unchanged from current implementation.

### State Variations

| State | Visual Change |
|-------|---------------|
| `generating` | Buttons and slots disabled |
| `single-upscaler` | Only 1 checkbox active (default) |
| `multi-upscaler` | 2-3 checkboxes active: upscales with multiple models for comparison |

---

## Screen: Canvas Chat Panel

**Context:** Right-side chat panel in canvas detail view. TierToggle sits between ChatThread and ChatInput in a thin bar. This bar controls which model is used when the AI assistant triggers a generation.

### Wireframe

```
┌──────────────────────────────────────┐
│  💬 Chat               [+] [◀ Close] │
├──────────────────────────────────────┤
│                                      │
│  [... Chat Messages ...]             │
│                                      │
├──────────────────────────────────────┤
│  ┌──────────────────────────────────┐│
│  │ ☑①[Schnell▾] ☐[Pro▾] ☐[── ▾]  ││
│  └──────────────────────────────────┘│
├──────────────────────────────────────┤
│  ┌──────────────────────────────────┐│
│  │ [Type a message...]          [→] ││
│  └──────────────────────────────────┘│
└──────────────────────────────────────┘
```

**Annotations:**
- ① Compact Model Slots: horizontal layout in thin bar. All 3 slots shown: Checkbox + truncated model name + dropdown arrow. Third slot shows "──" placeholder when empty. Names truncate to fit available width. No Per-Slot Parameters in compact layout (Chat-generations use default parameters per Discovery exception).

### State Variations

| State | Visual Change |
|-------|---------------|
| `generating` | Slots disabled |
| `streaming` | Slots remain interactive (consistent with current TierToggle behavior during streaming) |
| `single-slot` | Only 1 checkbox active |

---

## Screen: Settings Dialog (Read-Only)

**Context:** Modal dialog opened from sidebar. Previously had editable dropdowns per mode+tier. Now shows read-only display of current slot assignments. Model changes happen in the Workspace, not here.

### Wireframe

```
┌─────────────────────────────────────────────────┐
│  ⚙ Settings                              [ ✕ ] │
├─────────────────────────────────────────────────┤
│                                                 │
│  [ Sync Models 🔄 ]                             │
│                                                 │
│  TEXT TO IMAGE                                  │
│  ┌─────────────────────────────────────────────┐│
│  │  Slot 1①  Flux Schnell②            ●③ on  ││
│  │  Slot 2   Flux Pro                  ● on   ││
│  │  Slot 3   Flux 2 Max               ○ off  ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  IMAGE TO IMAGE                                 │
│  ┌─────────────────────────────────────────────┐│
│  │  Slot 1   Flux Schnell              ● on   ││
│  │  Slot 2   ── not assigned ──        ○ off  ││
│  │  Slot 3   ── not assigned ──        ○ off  ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  UPSCALE                                        │
│  ┌─────────────────────────────────────────────┐│
│  │  Slot 1   Crystal Upscaler          ● on   ││
│  │  Slot 2   Real-ESRGAN               ○ off  ││
│  │  Slot 3   ── not assigned ──        ○ off  ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  ④ Hint: Change models in the workspace.        │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Annotations:**
- ① Slot Label: read-only, shows slot number
- ② Model Name: read-only display of assigned model name
- ③ Status Indicator: read-only dot showing active (●) or inactive (○)
- ④ Hint Text: directs user to workspace for making changes

### State Variations

| State | Visual Change |
|-------|---------------|
| `syncing` | "Sync Models" button shows spinner |
| `no-models` | Empty state: "No models available. Click Sync Models." |
| `slot-empty` | Shows "not assigned" in muted text |

---

## Completeness Check

| Check | Status |
|-------|--------|
| All UI Components from Discovery covered | Yes |
| All relevant states visualized | Yes |
| All 5 TierToggle locations replaced | Yes (Workspace, Variation, Img2img, Upscale, Chat Panel) |
| Settings Read-Only screen added | Yes |
| Edge cases from Discovery Section 6 covered in state variations | Yes |
| No logic/rules duplicated (stays in Discovery) | Yes |
