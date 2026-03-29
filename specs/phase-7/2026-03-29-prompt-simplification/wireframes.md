# Wireframes: Prompt Field Simplification

**Discovery:** `discovery.md` (same folder)
**Status:** Draft

---

## Component Coverage

| UI Component (from Discovery) | Screen |
|-------------------------------|--------|
| Prompt textarea (single field, replaces Motiv+Style+Negative) | Prompt Area (txt2img), Prompt Area (img2img) |
| Prompt Tools row (Assistant, Improve, Clear) | Prompt Area (txt2img, img2img) |
| Assistant draft display (single prompt) | Assistant Draft Apply |

---

## User Flow Overview

```
txt2img:  [Prompt] ──type──> [Tools] ──generate──> [Result]
img2img:  [References] ──add──> [Prompt] ──type──> [Tools] ──generate──> [Result]
```

---

## Screen: Prompt Area — Before (Current State)

**Context:** Left sidebar panel, below Mode Selector. Shows current 3-field layout for reference.

### Wireframe

```
┌─────────────────────────────────────┐
│  [... Mode Selector: txt2img ...]   │
│  [... Tier Toggle ...]              │
├─────────────────────────────────────┤
│                                     │
│  Motiv *                            │
│  ┌─────────────────────────────────┐│
│  │ Describe the main subject of   ││
│  │ your image...                   ││
│  │                                 ││
│  │                                 ││
│  │                                 ││
│  └─────────────────────────────────┘│
│                                     │
│  ▶ Style / Modifier          ⌄     │  ← ① collapsible
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐│
│  │ Add style, mood, or modifier.. ││
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘│
│                                     │
│  ▶ Negative Prompt            ⌄     │  ← ② collapsible
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐│
│  │ What to avoid in the image...  ││
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘│
│                                     │
│  [🤖 Assistant] [✨ Improve] [Clear]│  ← ③ prompt tools
│                                     │
│  [... Parameter Panel ...]          │
│  [... Variant Count ...]            │
│  [        Generate ▶         ]      │
└─────────────────────────────────────┘
```

**Annotations:**
- ① `style-collapsible`: Collapsible textarea for style/modifier keywords — **REMOVED**
- ② `negative-collapsible`: Collapsible textarea for negative prompt — **REMOVED**
- ③ `prompt-tools`: Assistant trigger, Improve button, Clear button — **KEPT**

---

## Screen: Prompt Area — After (New State, txt2img)

**Context:** Left sidebar panel, below Mode Selector. Simplified single-field layout.

### Wireframe

```
┌─────────────────────────────────────┐
│  [... Mode Selector: txt2img ...]   │
│  [... Tier Toggle ...]              │
├─────────────────────────────────────┤
│                                     │
│  Prompt *                       ①   │
│  ┌─────────────────────────────────┐│
│  │ Describe your image, including   ││
│  │ style and mood...               ││
│  │                                 ││
│  │                                 ││
│  │                                 ││
│  └─────────────────────────────────┘│
│                                     │
│  [🤖 Assistant] [✨ Improve] [Clear]│  ②
│                                     │
│  [... Parameter Panel ...]          │
│  [... Variant Count ...]            │
│  [        Generate ▶         ]      │
└─────────────────────────────────────┘
```

**Annotations:**
- ① `prompt-textarea`: Single auto-resizing textarea. Replaces Motiv + Style + Negative. Label changes from "Motiv" to "Prompt". Placeholder changes to "Describe your image, including style and mood..."
- ② `prompt-tools`: Assistant trigger, Improve button, Clear button. Unchanged.

### State Variations

| State | Visual Change |
|-------|---------------|
| `empty` | Placeholder text visible, Generate button disabled |
| `typing` | Auto-resize textarea grows with content |
| `generating` | Textarea disabled, Generate button shows spinner |
| `assistant-draft` | Draft prompt appears in textarea (applied from assistant) |

---

## Screen: Prompt Area — After (New State, img2img)

**Context:** Left sidebar panel with reference images above prompt field.

### Wireframe

```
┌─────────────────────────────────────┐
│  [... Mode Selector: img2img ...]   │
│  [... Tier Toggle ...]              │
├─────────────────────────────────────┤
│                                     │
│  Reference Images                   │
│  ┌──────┐ ┌──────┐ ┌─ ─ ─ ┐       │
│  │ img1 │ │ img2 │ │  +   │       │
│  └──────┘ └──────┘ └─ ─ ─ ┘       │
│                                     │
│  Prompt *                       ①   │
│  ┌─────────────────────────────────┐│
│  │ Describe your image, including   ││
│  │ style and mood...               ││
│  │                                 ││
│  └─────────────────────────────────┘│
│                                     │
│  [🤖 Assistant] [✨ Improve] [Clear]│  ②
│                                     │
│  [... Parameter Panel ...]          │
│  [... Variant Count ...]            │
│  [        Generate ▶         ]      │
└─────────────────────────────────────┘
```

**Annotations:**
- ① `prompt-textarea`: Same single prompt field as txt2img mode
- ② `prompt-tools`: Same tools row as txt2img mode

---

## Screen: Assistant Draft Apply — After

**Context:** When assistant generates a prompt, it produces a single field instead of 3 separate fields.

### Wireframe

```
┌─────────────────────────────────────┐
│  Assistant                          │
│  ┌─────────────────────────────────┐│
│  │ 🤖 Here's your prompt:         ││
│  │                                 ││
│  │ ┌───────────────────────────┐   ││
│  │ │ A majestic mountain       │ ① ││
│  │ │ landscape at golden hour, │   ││
│  │ │ oil painting style with   │   ││
│  │ │ dramatic lighting...      │   ││
│  │ └───────────────────────────┘   ││
│  │                                 ││
│  │   [Apply to Prompt]        ②   ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

**Annotations:**
- ① `draft-prompt`: Single prompt block. Previously showed 3 blocks (motiv, style, negative). Now one unified prompt.
- ② `apply-button`: Applies draft to prompt textarea. Previously had to map 3 fields.

### State Variations

| State | Visual Change |
|-------|---------------|
| `composing` | Streaming text appears in draft block |
| `ready` | Full prompt visible, Apply button enabled |
| `applied` | Prompt copied to textarea, assistant confirms |

---

## Completeness Check

| Check | Status |
|-------|--------|
| All UI Components from Discovery covered | ✅ Prompt textarea, Tools row, Assistant draft |
| All relevant states visualized | ✅ empty, typing, generating, assistant-draft |
| Before/After comparison shown | ✅ Current 3-field vs new 1-field |
| No logic/rules duplicated (stays in Discovery) | ✅ |
