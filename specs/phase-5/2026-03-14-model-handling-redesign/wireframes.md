# Wireframes: Model Handling Redesign — Draft/Quality Tier System

**Discovery:** `discovery.md` (same folder)
**Status:** Draft

---

## Component Coverage

| UI Component (from Discovery) | Screen |
|-------------------------------|--------|
| `tier-toggle` | Workspace Prompt-Area, Canvas Popovers (Variation/Img2Img/Upscale), Canvas Chat Panel |
| `max-quality-toggle` | Workspace Prompt-Area, Canvas Popovers (Variation/Img2Img), Canvas Chat Panel |
| `settings-button` | Workspace Header |
| `settings-dialog` | Settings Dialog (Modal) |
| `model-dropdown-draft` | Settings Dialog |
| `model-dropdown-quality` | Settings Dialog |
| `model-dropdown-max` | Settings Dialog |

---

## User Flow Overview

```
[Workspace: Draft Selected] ──click "Quality"──► [Workspace: Quality Selected]
        │                                                │
        │                                        click "Max Quality"
        │                                                │
        │                                                ▼
        │                                    [Workspace: Quality+Max]
        │
    click ⚙──► [Settings Dialog] ──select model──► [Settings Dialog (saved)]
        │              │
        │          close/ESC
        │              │
        ▼              ▼
[Generate with Draft Model]    [Back to previous state]

[Canvas Tool Popover] ──click "Quality"──► [Popover: Quality Selected]
        │                                            │
        │                                    click "Max Quality"
        │                                            │
        │                                            ▼
        │                                [Popover: Quality+Max]
        │
        ▼
[Generate with per-tool tier model]    (each popover has own tier state)

[Canvas Chat] ──click "Quality"──► [Chat: Quality Selected]
        │                                    │
        │                            click "Max Quality"
        │                                    │
        ▼                                    ▼
[Send message → AI generates]    [Chat: Quality+Max]
```

---

## Screen: Workspace Header (modified)

**Context:** Top header bar of the workspace. Currently shows project name, theme toggle, and kebab menu. Settings button added to the right-side actions.

### Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│  ☰  Project Name                          ①  🌓  ⋮        │
└─────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `settings-button`: Gear icon button. Opens the Settings Dialog modal. Positioned left of the theme toggle in the right-side actions group.

### State Variations

| State | Visual Change |
|-------|---------------|
| `default` | Gear icon in neutral state |
| `hover` | Gear icon with hover highlight |

---

## Screen: Workspace Prompt-Area (modified)

**Context:** Left panel (480px) of the workspace. Contains mode selector, prompt fields, and generate button. This wireframe shows the **txt2img/img2img** mode — the new tier toggle and max quality toggle replace the old model trigger + parameter panel. Tier state is independent from Canvas (per-context).

### Wireframe — txt2img / img2img Mode (Draft selected)

```
┌──────────────────────────────────────────┐
│  [... Mode Selector: txt2img | img2img | upscale ...]  │
│                                          │
│  [... Prompt Tabs ...]                   │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  [... Reference Bar (img2img) ...]│    │
│  └──────────────────────────────────┘    │
│                                          │
│  ─── Prompt ─────────────────────────    │
│  Motiv *                                 │
│  ┌──────────────────────────────────┐    │
│  │ Describe the main subject...     │    │
│  └──────────────────────────────────┘    │
│  [🤖 Assistant] [✨ Improve]            │
│                                          │
│  Style / Modifier                        │
│  ┌──────────────────────────────────┐    │
│  │ Add style, mood, or modifier...  │    │
│  └──────────────────────────────────┘    │
│                                          │
│  ═══════════════════════════════════     │
│                                          │
│  ①                                       │
│  ┌──────────────────────────────────┐    │
│  │ ▓▓▓▓▓▓▓ Draft ▓▓▓▓▓▓▓│ Quality  │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Variants                     [ - 1 + ]  │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │          ✦ Generate              │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

**Annotations:**
- ① `tier-toggle`: Segmented control with two segments: "Draft" (active, filled) and "Quality". Positioned above the variant count stepper and generate button. Replaces the removed Model section (ModelTrigger + ModelBrowserDrawer) and Parameter Panel.

### Wireframe — txt2img / img2img Mode (Quality selected)

```
│  ═══════════════════════════════════     │
│                                          │
│  ①                                       │
│  ┌──────────────────────────────────┐    │
│  │  Draft  │▓▓▓▓▓▓ Quality ▓▓▓▓▓▓▓│    │
│  └──────────────────────────────────┘    │
│                                          │
│  ② [ Max Quality ]                       │
│                                          │
│  Variants                     [ - 1 + ]  │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │          ✦ Generate              │    │
│  └──────────────────────────────────┘    │
```

**Annotations:**
- ① `tier-toggle`: "Quality" segment active (filled).
- ② `max-quality-toggle`: Toggle button, appears only when Quality is selected. Off by default. When toggled on, generation uses the Max-tier model.

### Wireframe — Upscale Mode

```
┌──────────────────────────────────────────┐
│  [ txt2img | img2img |▓▓ upscale ▓▓]    │
│                                          │
│  ─── Source Image ───────────────────    │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐    │
│  │     Drop image or click to       │    │
│  │         upload                    │    │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘    │
│                                          │
│  Scale              [▓ 2x ▓] [ 4x ]     │
│                                          │
│  ═══════════════════════════════════     │
│                                          │
│  ①                                       │
│  ┌──────────────────────────────────┐    │
│  │ ▓▓▓▓▓▓▓ Draft ▓▓▓▓▓▓▓│ Quality  │    │
│  └──────────────────────────────────┘    │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │          ✦ Upscale               │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

**Annotations:**
- ① `tier-toggle`: Same segmented control as in txt2img/img2img. In upscale mode, Draft selects Real-ESRGAN (fast, ~1.4s) and Quality selects Crystal-Upscaler (better textures, slower). No "Max Quality" toggle (upscale has no Max-tier).

### State Variations

| State | Visual Change |
|-------|---------------|
| `draft-selected` | Tier-Toggle shows "Draft" as active segment. Max Quality toggle hidden. |
| `quality-selected` | Tier-Toggle shows "Quality" as active segment. Max Quality toggle appears (off). |
| `quality-max-selected` | Tier-Toggle shows "Quality" as active. Max Quality toggle on (pressed). |
| `generating` | Generate button shows spinner + "Generating..." / "Upscaling...". Tier-Toggle remains visible but mode cannot change during generation. |

### Removed Elements (vs. current UI)

| Removed | Was located |
|---------|-------------|
| Model section (SectionLabel "Model") | Between Mode Selector and Prompt section |
| ModelTrigger (model pills) | Inside Model section |
| ModelBrowserDrawer | Triggered by ModelTrigger browse button |
| Parameters section (collapsible) | Between Prompt and Action Bar |
| Multi-model notice | Below Parameters section |

---

## Screen: Canvas Header (modified)

**Context:** Top header bar of the Canvas Detail View (h-12). Currently shows Back button (left), CanvasModelSelector (center), and Undo/Redo + Chat toggle (right). The CanvasModelSelector is removed — tier selection now lives per-tool in the popovers and chat panel. Center slot is empty.

### Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│  ←  │                                    │  ↶  ↷  │▯│    │
└─────────────────────────────────────────────────────────────┘
```

### Removed Elements (vs. current UI)

| Removed | Was located |
|---------|-------------|
| CanvasModelSelector (model dropdown + drawer trigger) | Center slot of Canvas Header |

---

## Screen: Canvas Tool Popovers (modified)

**Context:** Variation, Img2Img, and Upscale popovers anchored to the left toolbar. Each popover now includes its own Tier Toggle above the action button. Each has independent tier state.

### Wireframe — Variation Popover (Draft selected)

```
┌────────────────────────────────┐
│  ✦ Variation                   │
├────────────────────────────────┤
│                                │
│  Prompt                        │
│  ┌────────────────────────┐    │
│  │ Describe the variation │    │
│  └────────────────────────┘    │
│                                │
│  Strength                      │
│  [ Subtle ▾ ]                  │
│                                │
│  Count                         │
│  [ 1 ] [ 2 ] [ 3 ] [ 4 ]      │
│                                │
│  ═══════════════════════════   │
│                                │
│  ①                             │
│  ┌────────────────────────┐    │
│  │▓▓▓ Draft ▓▓▓│ Quality │    │
│  └────────────────────────┘    │
│                                │
│  ┌────────────────────────┐    │
│  │    ✦ Generate          │    │
│  └────────────────────────┘    │
└────────────────────────────────┘
```

**Annotations:**
- ① `tier-toggle`: Per-popover segmented control. Draft active. Independent state from other tools and Workspace.

### Wireframe — Variation Popover (Quality + Max Quality)

```
│  ═══════════════════════════   │
│                                │
│  ①                             │
│  ┌────────────────────────┐    │
│  │ Draft │▓▓ Quality ▓▓▓ │    │
│  └────────────────────────┘    │
│  ② [ Max Quality ]            │
│                                │
│  ┌────────────────────────┐    │
│  │    ✦ Generate          │    │
│  └────────────────────────┘    │
```

**Annotations:**
- ① `tier-toggle`: Quality active.
- ② `max-quality-toggle`: Toggle button, appears when Quality selected. Available for Variation and Img2Img popovers (not Upscale).

### Wireframe — Upscale Popover (with Tier Toggle)

```
┌────────────────────────────────┐
│  🔍 Upscale                    │
├────────────────────────────────┤
│                                │
│  ①                             │
│  ┌────────────────────────┐    │
│  │▓▓▓ Draft ▓▓▓│ Quality │    │
│  └────────────────────────┘    │
│                                │
│  ┌────────────────────────┐    │
│  │     2x Upscale         │    │
│  └────────────────────────┘    │
│  ┌────────────────────────┐    │
│  │     4x Upscale         │    │
│  └────────────────────────┘    │
└────────────────────────────────┘
```

**Annotations:**
- ① `tier-toggle`: Per-popover. Draft = Real-ESRGAN (fast), Quality = Crystal-Upscaler (better textures). No Max Quality toggle for upscale.

### State Variations (all popovers)

| State | Visual Change |
|-------|---------------|
| `draft-selected` | Tier-Toggle shows "Draft" active. No Max Quality toggle (or hidden for Variation/Img2Img). |
| `quality-selected` | Tier-Toggle shows "Quality" active. Max Quality toggle appears for Variation/Img2Img (not Upscale). |
| `quality-max-selected` | Quality active + Max Quality on. Only for Variation/Img2Img. |
| `generating` | Action button shows spinner. Tier toggle disabled during generation. |

---

## Screen: Canvas Chat Panel (modified)

**Context:** Right-side panel in Canvas Detail View (320-480px wide, resizable). Contains chat thread, model selector, and input. Tier Toggle added as compact bar above the chat input. Independent tier state from all other tools.

### Wireframe — Draft selected

```
┌─────────────────────────────┐
│  💬 Chat  [Model ▾]  [+] [-]│
├─────────────────────────────┤
│                             │
│  [... chat messages ...]    │
│                             │
│                             │
├─────────────────────────────┤
│  ①                          │
│  ┌───────────────────────┐  │
│  │▓▓▓ Draft ▓▓▓│Quality │  │
│  └───────────────────────┘  │
├─────────────────────────────┤
│  Describe changes...   [➤]  │
└─────────────────────────────┘
```

**Annotations:**
- ① `tier-toggle`: Compact segmented control above chat input. Draft active by default. Controls which model tier the AI uses for canvas-generate events.

### Wireframe — Quality + Max Quality selected

```
├─────────────────────────────┤
│  ①                     ②    │
│  ┌───────────────────┐      │
│  │Draft│▓▓ Quality ▓▓│[Max] │
│  └───────────────────┘      │
├─────────────────────────────┤
│  Describe changes...   [➤]  │
└─────────────────────────────┘
```

**Annotations:**
- ① `tier-toggle`: Quality active.
- ② `max-quality-toggle`: Toggle button "Max" inline. Appears when Quality selected.

### State Variations

| State | Visual Change |
|-------|---------------|
| `draft-selected` | Draft active. No Max Quality toggle. |
| `quality-selected` | Quality active. "Max" toggle appears (off). |
| `quality-max-selected` | Quality active. "Max" toggle on. |
| `streaming` | Chat input disabled, tier toggle remains interactive. |
| `generating` | Chat input disabled, tier toggle disabled until generation completes. |

---

## Screen: Settings Dialog (new)

**Context:** Modal overlay, centered on screen with backdrop dimming. Opened via Settings button in Workspace Header. Contains model assignment configuration for all three modes.

### Wireframe — Default state

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ① Model Settings                             ✕ ②  │
│  ───────────────────────────────────────────────     │
│                                                     │
│  ③ TEXT TO IMAGE                                    │
│  ┌─────────────────────────────────────────────┐    │
│  │  Draft     ④ [ flux-schnell          ▾ ]    │    │
│  │  Quality   ⑤ [ flux-2-pro            ▾ ]    │    │
│  │  Max       ⑥ [ flux-2-max            ▾ ]    │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ③ IMAGE TO IMAGE                                   │
│  ┌─────────────────────────────────────────────┐    │
│  │  Draft     ④ [ flux-schnell          ▾ ]    │    │
│  │  Quality   ⑤ [ flux-2-pro            ▾ ]    │    │
│  │  Max       ⑥ [ flux-2-max            ▾ ]    │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ③ UPSCALE                                          │
│  ┌─────────────────────────────────────────────┐    │
│  │  Draft     ④ [ real-esrgan           ▾ ]    │    │
│  │  Quality   ⑤ [ crystal-upscaler     ▾ ]    │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `settings-dialog`: Modal container with title "Model Settings" and close button.
- ② Close button (✕). Closes the dialog. Also closeable via ESC or clicking outside.
- ③ Mode section headers: "TEXT TO IMAGE", "IMAGE TO IMAGE", "UPSCALE". Each mode gets its own card-like section.
- ④ `model-dropdown-draft`: Select dropdown for Draft-tier model. Shows `owner/name` format. Incompatible models are greyed out (schema check).
- ⑤ `model-dropdown-quality`: Select dropdown for Quality-tier model. Same behavior as Draft dropdown.
- ⑥ `model-dropdown-max`: Select dropdown for Max-tier model. Only present for txt2img and img2img sections (not upscale per business rules).

### Wireframe — Dropdown open

```
│  ③ TEXT TO IMAGE                                    │
│  ┌─────────────────────────────────────────────┐    │
│  │  Draft     [ flux-schnell          ▾ ]      │    │
│  │            ┌────────────────────────────┐    │    │
│  │            │ ⑦ flux-schnell         ✓  │    │    │
│  │            │    black-forest-labs       │    │    │
│  │            │ ─────────────────────────  │    │    │
│  │            │   seedream-5-lite          │    │    │
│  │            │    bytedance               │    │    │
│  │            │ ─────────────────────────  │    │    │
│  │            │ ⑧ incompatible-model      │    │    │
│  │            │    some-owner  (greyed)    │    │    │
│  │            └────────────────────────────┘    │    │
│  │  Quality   [ flux-2-pro            ▾ ]      │    │
```

**Annotations:**
- ⑦ Model option: Shows model name (bold) and owner (muted). Current selection indicated by checkmark.
- ⑧ Incompatible model: Greyed out, not selectable. Tooltip on hover: "Model does not support this mode."

### State Variations

| State | Visual Change |
|-------|---------------|
| `open` | Modal visible with backdrop. All dropdowns in closed state showing current selections. |
| `dropdown-open` | One dropdown expanded showing model list from Replicate Collection. |
| `model-selected` | Dropdown closes. Selected model name updates immediately (auto-save). |
| `incompatible-model` | Model row greyed out with disabled state. Cannot be selected. |
| `collection-load-error` | Error message replaces dropdown content: "Could not load models. Please try again." Current assignments remain unchanged. |

---

## Completeness Check

| Check | Status |
|-------|--------|
| All UI Components from Discovery covered | ✅ All 7 components annotated across screens |
| All Screens from UI Layout (Discovery) covered | ✅ Workspace Header, Workspace Prompt-Area, Canvas Header, Canvas Tool Popovers, Canvas Chat Panel, Settings Dialog |
| All relevant states visualized | ✅ draft-selected, quality-selected, quality-max-selected, generating, streaming, dropdown states, error states |
| Removed elements documented | ✅ ModelTrigger, ModelBrowserDrawer, ParameterPanel, CanvasModelSelector, multi-model notice |
| Per-tool tier state documented | ✅ Each canvas tool (Variation, Img2Img, Upscale, Chat) has independent tier state |
| No logic/rules duplicated (stays in Discovery) | ✅ |
