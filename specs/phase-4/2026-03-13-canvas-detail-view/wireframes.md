# Wireframes: Canvas Detail-View & Editing Flow

**Discovery:** `discovery.md` (same folder)
**Status:** Draft

---

## Component Coverage

| UI Component (from Discovery) | Screen |
|-------------------------------|--------|
| `model-selector` | Canvas-Detail-View |
| `toolbar` | Canvas-Detail-View |
| `toolbar.variation` | Canvas-Detail-View |
| `toolbar.img2img` | Canvas-Detail-View |
| `toolbar.upscale` | Canvas-Detail-View |
| `toolbar.download` | Canvas-Detail-View |
| `toolbar.delete` | Canvas-Detail-View |
| `toolbar.details` | Canvas-Detail-View |
| `popover.variation` | Variation Popover |
| `popover.img2img` | img2img Popover |
| `popover.upscale` | Upscale Popover |
| `canvas-image` | Canvas-Detail-View |
| `siblings` | Canvas-Detail-View |
| `prev-next` | Canvas-Detail-View |
| `chat-panel` | Canvas-Detail-View, Chat Active |
| `chat-init` | Chat Active |
| `chat-input` | Canvas-Detail-View, Chat Active |
| `chat-message.user` | Chat Active |
| `chat-message.bot` | Chat Active |
| `chat-chips` | Chat Active |
| `details-overlay` | Details Overlay |
| `undo-button` | Canvas-Detail-View |
| `redo-button` | Canvas-Detail-View |
| `chat-context-separator` | Chat Active |
| `chat-new-session` | Chat Active |
| `back-button` | Canvas-Detail-View |

---

## User Flow Overview

```
[Gallery-View] ──click image──► [Animated Transition In] ──done──► [Detail-View Idle]
                                                                        │
                                ┌───────────────────────────────────────┤
                                │                                       │
                          ──tool click──►                        ──chat send──►
                                │                                       │
                     [Tool Popover Open]                       [Chat Active]
                                │                                       │
                       ──generate──►                          ──agent generates──►
                                │                                       │
                                └──────────► [Generating] ◄─────────────┘
                                                  │
                                            ──complete──►
                                                  │
                                          [Detail-View Idle]
                                                  │
                                          ──ESC / back──►
                                                  │
                                     [Animated Transition Out] ──done──► [Gallery-View]
```

---

## Screen: Gallery-View (Context)

**Context:** `/projects/[id]` main workspace. Existing view, unchanged. Shown for transition context only.

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Sidebar]  │              Workspace Header                             │
│            │───────────────────────────────────────────────────────────│
│            │ Prompt Area (480px)  │  Gallery Grid (flex: 1)            │
│            │                     │                                     │
│            │  ┌───────────────┐  │  [txt2img] [img2img] [upscale]     │
│            │  │ Motiv         │  │                                     │
│            │  │ [prompt...]   │  │  ┌──────┐ ┌────────────┐ ┌──────┐  │
│            │  ├───────────────┤  │  │      │ │            │ │      │  │
│            │  │ Style         │  │  │ img  │ │    img     │ │ img  │  │
│            │  │ [prompt...]   │  │  │  ①   │ │            │ │      │  │
│            │  ├───────────────┤  │  └──────┘ │            │ └──────┘  │
│            │  │ Negative      │  │  ┌──────┐ └────────────┘ ┌──────┐  │
│            │  │ [prompt...]   │  │  │      │ ┌──────┐       │      │  │
│            │  ├───────────────┤  │  │ img  │ │      │       │ img  │  │
│            │  │ Parameters    │  │  │      │ │ img  │       │      │  │
│            │  │ [model...]    │  │  └──────┘ │      │       └──────┘  │
│            │  │ [steps...]    │  │           └──────┘                  │
│            │  ├───────────────┤  │                                     │
│            │  │ [Generate ▶]  │  │  [... more images ...]              │
│            │  └───────────────┘  │                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `GenerationCard`: Click opens Canvas-Detail-View with animated transition

---

## Screen: Animated Transition (Gallery → Detail)

**Context:** Triggered by clicking any image in Gallery Grid. Image animates from its gallery position to fullscreen center.

### Wireframe

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Sidebar]  │                                                           │
│            │         ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐                │
│            │                                                           │
│            │         │    ┌──────────────────────┐    │                │
│            │              │                      │                     │
│            │         │    │                      │    │                │
│            │              │    Image growing     │                     │
│            │         │    │    from gallery      │    │                │
│            │              │    position ───►     │                     │
│            │         │    │    fullscreen        │    │                │
│            │              │                      │                     │
│            │         │    └──────────────────────┘    │                │
│            │                                                           │
│            │         └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘                │
│            │                                                           │
│            │              Gallery fading out                            │
│            │                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- Image grows from its gallery position to center of canvas area
- Gallery content fades out underneath
- Reverse animation on exit (image shrinks back to gallery position)

---

## Screen: Canvas-Detail-View (Idle)

**Context:** Fullscreen view replacing Gallery. Sidebar auto-collapsed (maximizes canvas space). This is the primary working view.

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│①← Back    ②Model: [flux-2-max ▼]               ⟲③Undo  ⟳④Redo          │
│══════════════════════════════════════════════════════════════════════════════│
│⑤   │                                             │⑩ 💬  Chat   [+]⑫[─]  │
│ ◇  │                                             │───────────────────────│
│ Var│              ⑥                               │                       │
│───│                                             │  ⑪ Context:           │
│ ◇  │         ┌──────────────────┐                │  Model: flux-2-max    │
│i2i │         │                  │                │  Prompt: "A           │
│───│         │                  │                │  beautiful sunset..." │
│ ◇  │         │                  │                │  Steps: 30            │
│ Up │         │   Current Image  │                │                       │
│───│         │   (max-fit)      │                │                       │
│ ◇  │         │                  │                │                       │
│ DL │         │                  │                │                       │
│───│         │                  │                │                       │
│ ◇  │    ⑧◄  └──────────────────┘  ►⑧           │                       │
│Del │                                             │                       │
│───│    ⑨ [thumb] [thumb] [ACTIVE] [thumb]       │                       │
│ ◇  │                                             │ ⑬                     │
│ ⑦  │                                             │ [Describe             │
│   │                                             │  changes... ▶]        │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `back-button`: Top-left header, navigates back to Gallery with reverse animation (ESC also works). NOT in toolbar.
- ② `model-selector`: Shared model for Variation + img2img. Shows icon + name + provider. "Browse Models" opens ModelBrowserDrawer. Auto-switches if model doesn't support img2img. Upscale ignores this (hardcoded model).
- ③ `undo-button`: Undo (Cmd+Z) in header. Disabled when undo stack empty. Suppressed when focus in input.
- ④ `redo-button`: Redo (Cmd+Shift+Z) in header. Disabled when redo stack empty. Cleared on new generation.
- ⑤ `toolbar`: Vertical icon bar, 48px wide. Icons stacked vertically. No back-button here.
- ⑥ `canvas-image`: Current image centered, max-fit within available space
- ⑦ `toolbar.details`: Toggle for details overlay (prompt, model, params)
- ⑧ `prev-next`: Navigation buttons left/right of image. Click only, no keyboard arrows. Hidden at first/last image
- ⑨ `siblings`: Horizontal thumbnail row below image. Active sibling highlighted. Grouped by batchId.
- ⑩ `chat-panel`: Right side, expanded state. Collapsible via [-] button. Resizable (320-480px)
- ⑪ `chat-init`: First message showing image context (model, prompt, key params)
- ⑫ `chat-new-session`: [+] button starts fresh chat session (clears history), like prompt assistant
- ⑬ `chat-input`: Text input at bottom of chat. Placeholder: "Describe changes..."

### Toolbar Detail

```
┌─────┐
│  ◇  │  ① toolbar.variation
├─────┤
│  ◇  │  ② toolbar.img2img
├─────┤
│  ◇  │  ③ toolbar.upscale
├─────┤
│  ◇  │  ④ toolbar.download
├─────┤
│  ◇  │  ⑤ toolbar.delete
├─────┤
│  ◇  │  ⑥ toolbar.details
└─────┘
```

**Annotations:**
- Back-button is in the header (see main wireframe), NOT in toolbar
- ① `toolbar.variation`: Opens Variation popover
- ② `toolbar.img2img`: Opens img2img popover (larger, prompt-panel layout)
- ③ `toolbar.upscale`: Opens Upscale popover
- ④ `toolbar.download`: Direct download, no popover
- ⑤ `toolbar.delete`: Opens confirmation dialog
- ⑥ `toolbar.details`: Toggles details overlay

### State Variations

| State | Visual Change |
|-------|---------------|
| `detail-idle` | As shown above. All tools enabled, chat ready |
| `detail-generating` | Loading overlay on canvas-image. Toolbar icons disabled. Chat input disabled. Undo/Redo disabled |
| `chat-panel.collapsed` | Chat panel shows only narrow icon strip (~48px). Canvas area expands to fill space |
| `siblings.empty` | No thumbnail row shown (single image in generation) |
| `prev-next.hidden` | Arrows hidden when at first/last gallery image |
| `undo-button.disabled` | Undo grayed out when undo stack is empty |
| `redo-button.disabled` | Redo grayed out when redo stack is empty |

---

## Screen: Variation Popover

**Context:** Appears when clicking the Variation tool icon. Floats next to the toolbar icon.

### Wireframe

```
           ┌─────┐
           │  ◇  │ ← Active (highlighted)
           ├─────┤
           │     │
                 │
    ┌────────────────────────┐
    │ ① Variation            │
    │════════════════════════│
    │                        │
    │ ② Prompt               │
    │ ┌────────────────────┐ │
    │ │ A beautiful sunset │ │
    │ │ over mountains...  │ │
    │ │                    │ │
    │ └────────────────────┘ │
    │                        │
    │ ③ Strength              │
    │ [Subtle ▼]             │
    │ (Subtle/Balanced/      │
    │  Creative)             │
    │                        │
    │ ④ Count                │
    │ [1] [2] [3] [4]       │
    │                        │
    │ ┌────────────────────┐ │
    │ │   ⑤ Generate ▶     │ │
    │ └────────────────────┘ │
    └────────────────────────┘
```

**Annotations:**
- ① `popover.variation`: Floating panel positioned next to toolbar icon
- ② Prompt field: Pre-filled from original image prompt, editable
- ③ Strength dropdown: Reuses existing StrengthSlider pattern (Subtle/Balanced/Creative). Technically: img2img with current image as sole input, no reference roles
- ④ Count selector: 1-4 variants
- ⑤ Generate button: Closes popover, triggers generation, shows loading state on canvas

---

## Screen: img2img Popover

**Context:** Larger popover mirroring existing Prompt-Panel layout (without Assistent/Improve and Parameters). Each tool has its own model selector. Appears next to img2img tool icon.

### Wireframe

```
           ┌─────┐
           │     │
           ├─────┤
           │  ◇  │ ← Active (highlighted)
           ├─────┤
           │     │
                 │
    ┌──────────────────────────────────┐
    │ ① img2img                        │
    │══════════════════════════════════│
    │                                  │
    │ ② REFERENCES              [1/5]  │
    │ ┌──────────────────────────────┐ │
    │ │ ┌──────┐  @1  Content    [x]│ │
    │ │ │ ref  │  [Content    ▼]    │ │
    │ │ │ img  │  [Moderate   ▼]    │ │
    │ │ └──────┘                    │ │
    │ └──────────────────────────────┘ │
    │ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
    │   Drop image here, click to     │
    │ │ browse, or paste a URL      │ │
    │   [https://...]                  │
    │ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
    │                                  │
    │ ③ PROMPT                         │
    │ Motiv *                          │
    │ ┌──────────────────────────────┐ │
    │ │ Main subject prompt...       │ │
    │ └──────────────────────────────┘ │
    │                                  │
    │ Style / Modifier                 │
    │ ┌──────────────────────────────┐ │
    │ │ Add style, mood, or modifier │ │
    │ │ keywords...                  │ │
    │ └──────────────────────────────┘ │
    │                                  │
    │ ④ Variants         [−] 4 [+]    │
    │                                  │
    │ ┌──────────────────────────────┐ │
    │ │       ⑤ Generate ▶           │ │
    │ └──────────────────────────────┘ │
    └──────────────────────────────────┘
```

**Annotations:**
- ① `popover.img2img`: Larger floating panel, mirrors existing Prompt-Panel layout. NO model selector here (uses shared header model-selector).
- ② References: Collapsible section with [n/5] counter + Add. Each slot shows thumbnail, role dropdown (style/content/structure/character/color), strength dropdown (subtle/moderate/strong/dominant). Dropzone for drag/upload/URL. Reuses existing ReferenceBar/ImageDropzone components.
- ③ Prompt: Motiv (required) + Style/Modifier fields. NO Assistent/Improve buttons (Chat panel serves that role in Detail-View).
- ④ Variants: Count selector with +/- buttons
- ⑤ Generate button: Closes popover, triggers generation using model from header selector

---

## Screen: Upscale Popover

**Context:** Small popover with upscale options. Appears next to upscale tool icon.

### Wireframe

```
           ┌─────┐
           │     │
           ├─────┤
           │     │
           ├─────┤
           │  ◇  │ ← Active (highlighted)
           ├─────┤
                 │
    ┌────────────────────┐
    │ ① Upscale           │
    │════════════════════│
    │                    │
    │ ② [ 2x Upscale ]  │
    │                    │
    │ ③ [ 4x Upscale ]  │
    │                    │
    └────────────────────┘
```

**Annotations:**
- ① `popover.upscale`: Small floating panel
- ② 2x upscale button
- ③ 4x upscale button
- Disabled state: When image is too large, icon is grayed out with tooltip explaining reason

---

## Screen: Chat Panel Active

**Context:** Right side of Canvas-Detail-View. Shows conversation with editing agent.

### Wireframe

```
┌──────────────────────────┐
│ 💬 Chat       [+]① [─]②│
│══════════════════════════│
│                          │
│ ③ System                 │
│ ┌──────────────────────┐ │
│ │ Model: SDXL          │ │
│ │ Prompt: "A beau-     │ │
│ │ tiful sunset..."     │ │
│ │ Steps: 30, CFG: 7    │ │
│ └──────────────────────┘ │
│                          │
│           ④ You          │
│   ┌──────────────────────┤
│   │ Make the back-       │
│   │ ground more blue     │
│   └──────────────────────┤
│                          │
│ ⑤ Assistant              │
│ ┌──────────────────────┐ │
│ │ How blue? Choose:     │ │
│ │                       │ │
│ │ ⑥[Subtle] [Dramatic]  │ │
│ └──────────────────────┘ │
│                          │
│           ⑦ You          │
│   ┌──────────────────────┤
│   │ Dramatic             │
│   └──────────────────────┤
│                          │
│ ⑧ Assistant              │
│ ┌──────────────────────┐ │
│ │ Done! ✔ Prompt: "A   │ │
│ │ vibrant sunset with   │ │
│ │ deep blue sky..."     │ │
│ └──────────────────────┘ │
│                          │
│ ⑨── Context: Image B ───│
│                          │
│ ⑩ System                 │
│ ┌──────────────────────┐ │
│ │ Model: SDXL          │ │
│ │ Prompt: "A vibrant   │ │
│ │ sunset..."           │ │
│ └──────────────────────┘ │
│                          │
│══════════════════════════│
│ ⑪ [Describe changes..   │
│    to the image... ▶]    │
└──────────────────────────┘
```

**Annotations:**
- ① `chat-new-session`: [+] button starts fresh chat session (clears history), like existing prompt assistant
- ② Collapse button: Collapses chat to icon strip
- ③ `chat-init`: Context message with current image metadata
- ④ `chat-message.user`: User text message
- ⑤ `chat-message.bot`: Agent response with clarification question
- ⑥ `chat-chips`: Clickable options for quick responses
- ⑦ `chat-message.user`: User selection via chip
- ⑧ `chat-message.bot`: Completion confirmation with used prompt (no thumbnail — result appears in canvas via instant replace)
- ⑨ `chat-context-separator`: Visual separator when image context changes via Prev/Next. Shows new image identifier.
- ⑩ `chat-init`: Updated context message for the new image
- ⑪ `chat-input`: Text input with send button

### State Variations

| State | Visual Change |
|-------|---------------|
| `collapsed` | Chat panel shrinks to ~48px icon strip. Only chat icon visible. Click expands |
| `expanded-empty` | Shows only `chat-init` context message and input field |
| `expanded-has-messages` | Full conversation as shown above |
| `sending` | Input field disabled, send button shows spinner |
| `error` | Bot message shows error text: "No response. Please try again." |

---

## Screen: Chat Panel Collapsed

**Context:** Chat panel in collapsed state, maximizing canvas area.

### Wireframe

```
┌────────────────────────────────────────────────────────────────────────┐
│← Back                                              Undo  Redo      │①│
│══════════════════════════════════════════════════════════════════════│💬│
│ ◇  │                                                               │  │
│ Var│                                                               │  │
│────│                 ┌──────────────────┐                           │  │
│ ◇  │                 │                  │                           │  │
│i2i │                 │                  │                           │  │
│────│                 │                  │                           │  │
│ ◇  │                 │   Current Image  │                           │  │
│ Up │                 │   (more space)   │                           │  │
│────│                 │                  │                           │  │
│ ◇  │                 │                  │                           │  │
│ DL │                 │                  │                           │  │
│────│                 └──────────────────┘                           │  │
│ ◇  │                                                               │  │
│Del │            [thumb] [thumb] [ACTIVE] [thumb]                    │  │
│────│                                                               │  │
│ ◇  │                                                               │  │
│det │                                                               │  │
└────────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `chat-panel.collapsed`: Narrow icon strip (~48px). Chat icon visible. Click expands panel. Canvas area gains the freed space.

---

## Screen: Details Overlay

**Context:** Toggled by clicking the details icon in toolbar. Shows image metadata overlay on top of canvas.

### Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│ [Toolbar]  │ ① Details                              [▲ Hide]│
│            │────────────────────────────────────────────────│
│            │ ② Prompt: "A beautiful sunset over mountains  │
│            │    with golden light and dramatic clouds"      │
│            │ ③ Model: SDXL Lightning  │ Steps: 30          │
│            │    CFG: 7.0  │ Seed: 42  │ Size: 1024x1024    │
│            │ ④ Provenance:                                  │
│            │    [ref-thumb] style:strong  [ref-thumb] ...   │
│            │════════════════════════════════════════════════│
│            │                                                │
│            │              ┌──────────────────┐              │
│            │              │                  │              │
│            │              │   Current Image  │              │
│            │              │   (pushed down)  │              │
│            │              │                  │              │
│            │              └──────────────────┘              │
│            │                                                │
└─────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `details-overlay`: Collapsible panel at top of canvas area
- ② Full prompt text
- ③ Generation parameters (model, steps, CFG, seed, size)
- ④ Provenance row: Input references as thumbnails with roles (reused from existing `ProvenanceRow` component)

### State Variations

| State | Visual Change |
|-------|---------------|
| `collapsed` | Overlay hidden, canvas uses full height |
| `expanded` | Overlay pushes canvas content down, shows metadata |

---

## Screen: Delete Confirmation

**Context:** Triggered by clicking delete icon in toolbar.

### Wireframe

```
┌──────────────────────────────────┐
│ Delete Image?                    │
│──────────────────────────────────│
│                                  │
│ This action cannot be undone.    │
│                                  │
│         [Cancel]  [Delete]       │
│                                  │
└──────────────────────────────────┘
```

**Annotations:**
- Standard confirmation dialog
- On confirm: If last image, navigate back to Gallery. Otherwise load next image.

---

## Screen: Loading State (Generating)

**Context:** Active during any generation (from tool popover or chat). Overlays on canvas-image.

### Wireframe

```
              ┌──────────────────┐
              │ ░░░░░░░░░░░░░░░░ │
              │ ░░░░░░░░░░░░░░░░ │
              │ ░░░░░░░░░░░░░░░░ │
              │ ░░  Generating  ░ │
              │ ░░    ⏳        ░░ │
              │ ░░░░░░░░░░░░░░░░ │
              │ ░░░░░░░░░░░░░░░░ │
              │ ░░░░░░░░░░░░░░░░ │
              └──────────────────┘
```

**Annotations:**
- Semi-transparent overlay on current image
- Toolbar icons disabled (grayed out)
- Chat input disabled
- Undo/Redo disabled
- On complete: New image replaces current, old image pushed to undo stack + siblings

---

## Screen: Error State (Generation Failed)

**Context:** When a generation fails (from tool or chat).

### State Variations

| State | Visual Change |
|-------|---------------|
| `generation-failed` | Toast notification appears (top-right). Image remains unchanged. If triggered via chat, bot message shows error text |
| `chat-timeout` | Bot message: "No response. Please try again." |
| `upscale-unavailable` | Upscale icon grayed out. Tooltip: "Image too large for upscale" |

---

## Completeness Check

| Check | Status |
|-------|--------|
| All Screens from UI Layout (Discovery) covered | ✅ Gallery-View (context), Canvas-Detail-View (main + variants) |
| All UI Components annotated | ✅ All 25 components from Discovery covered (incl. redo-button, chat-context-separator, chat-new-session) |
| Relevant State Variations documented | ✅ idle, generating, collapsed chat, errors, details overlay, redo disabled |
| No Logic/Rules duplicated (stays in Discovery) | ✅ Business rules referenced, not repeated |
