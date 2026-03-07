# Wireframes: Multi-Mode Generation (img2img + Upscale)

**Discovery:** `discovery.md` (same folder)
**Status:** Draft

---

## Component Coverage

| UI Component (from Discovery) | Screen |
|-------------------------------|--------|
| ModeSelector | Prompt Area |
| ImageDropzone | Prompt Area (img2img), Prompt Area (upscale) |
| StrengthSlider | Prompt Area (img2img) |
| ScaleSelector | Prompt Area (upscale), Lightbox Upscale Popover |
| FilterChips | Gallery |
| ModeBadge | Gallery |
| UpscalePopover | Lightbox |
| LightboxImg2ImgButton | Lightbox |

---

## User Flow Overview

```
[txt2img mode] ──switch mode──► [img2img mode] ──upload + generate──► [img2img result in gallery]
     │                                │                                        │
     │                                └──switch mode──► [upscale mode]         │
     │                                                       │                 │
     │                                                  upload + upscale       │
     │                                                       │                 │
     │                                                       ▼                 │
     │                                              [upscale result in gallery]│
     │                                                                         │
     └──open lightbox──► [Lightbox]                                            │
                            │                                                  │
                            ├──"img2img" btn──► [img2img mode, source pre-filled]
                            │
                            ├──"Upscale" btn──► [Upscale Popover] ──2x/4x──► [upscale result]
                            │
                            └──"Variation" btn (on img2img result)──► [img2img mode, original source]
```

---

## Screen: Prompt Area — Text to Image (Default)

**Context:** Left sidebar panel (w-80). Default mode when opening workspace. Existing txt2img functionality with new ModeSelector added at top.

### Wireframe

```
┌─────────────────────────────────┐
│ ① [Text to Image|Img to Img|Upscale]│
│═════════════════════════════════│
│                                 │
│ ② [Prompt | History | Favorites]│
│─────────────────────────────────│
│                                 │
│ Motiv:  [____________________]  │
│ Style:  [____________________]  │
│ Neg:    [____________________]  │
│                                 │
│─────────────────────────────────│
│ Model: [FLUX 2 Pro          v]  │
│ Parameters: [...]               │
│                                 │
│─────────────────────────────────│
│ Variants: [1] [2] [3] [4]      │
│                                 │
│ [         Generate            ] │
└─────────────────────────────────┘
```

**Annotations:**
- ① `ModeSelector`: Segmented Control with three options. "Text to Image" is active (highlighted). Clicking another segment switches mode.
- ② `PromptTabs`: Existing tabs (unchanged). Visible in txt2img and img2img modes.

### State Variations

| State | Visual Change |
|-------|---------------|
| `txt2img selected` | Default. No Dropzone, no Strength slider. Full prompt fields + model + parameters visible. |

---

## Screen: Prompt Area — Image to Image

**Context:** Left sidebar panel (w-80). User has switched ModeSelector to "Image to Image". Dropzone and Strength slider appear. Prompt fields remain visible.

### Wireframe — Empty Dropzone

```
┌─────────────────────────────────┐
│ [Text to Image|① Img to Img|Upscale]│
│═════════════════════════════════│
│                                 │
│  ② ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│    │                         │  │
│    │   Drop image here       │  │
│    │   or click to upload    │  │
│    │   or paste URL          │  │
│    │                         │  │
│     └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘  │
│                                 │
│─────────────────────────────────│
│ ③ Strength:                     │
│ [Subtle] [Balanced] [Creative]  │
│ [==========*=====] 0.60         │
│                                 │
│─────────────────────────────────│
│ [Prompt | History | Favorites]  │
│─────────────────────────────────│
│ Motiv:  [____________________]  │
│ Style:  [____________________]  │
│ Neg:    [____________________]  │
│                                 │
│─────────────────────────────────│
│ Model: [FLUX 2 Pro          v]  │
│ Parameters: [...]               │
│                                 │
│─────────────────────────────────│
│ Variants: [1] [2] [3] [4]      │
│                                 │
│ [         Generate            ] │
└─────────────────────────────────┘
```

**Annotations:**
- ① `ModeSelector`: "Image to Image" segment is active.
- ② `ImageDropzone`: Dashed border area for image upload. Supports drag & drop, click-to-browse, and URL paste.
- ③ `StrengthSlider`: Slider (0.0–1.0) with three clickable presets: Subtle (0.3), Balanced (0.6, default), Creative (0.85). Current value displayed next to slider.

### Wireframe — Image Uploaded (Preview)

```
┌─────────────────────────────────┐
│ [Text to Image|Img to Img|Upscale]│
│═════════════════════════════════│
│                                 │
│  ② ┌───────────────────────┐   │
│    │ ┌──────┐               │   │
│    │ │ thumb│ photo.jpg     │   │
│    │ │      │ 1024x768      │   │
│    │ └──────┘        [✕]    │   │
│    └───────────────────────┘   │
│                                 │
│─────────────────────────────────│
│ ③ Strength:                     │
│ [Subtle] [Balanced] [Creative]  │
│ [==========*=====] 0.60         │
│                                 │
│─────────────────────────────────│
│ [Prompt | History | Favorites]  │
│─────────────────────────────────│
│ Motiv:  [a sunset landscape__]  │
│ Style:  [oil painting________]  │
│                                 │
│─────────────────────────────────│
│ Model: [FLUX 2 Pro          v]  │
│ Variants: [1] [2] [3] [4]      │
│                                 │
│ [         Generate            ] │
└─────────────────────────────────┘
```

**Annotations:**
- ② `ImageDropzone` (preview state): Shows thumbnail, filename, dimensions, and remove button [✕].
- ③ `StrengthSlider`: Same as empty state, user can adjust before generating.

### State Variations

| State | Visual Change |
|-------|---------------|
| `empty` | Dashed dropzone with placeholder text. Generate button disabled. |
| `drag-over` | Dropzone border highlighted (visual emphasis). Generate button disabled. |
| `uploading` | Progress indicator replaces placeholder text. Generate button disabled. |
| `preview` | Thumbnail + filename + dimensions + remove button. Generate button enabled. |
| `error` | Error message in dropzone + retry option. Generate button disabled. |

---

## Screen: Prompt Area — Upscale Mode

**Context:** Left sidebar panel (w-80). User has switched ModeSelector to "Upscale". Minimal UI: only Dropzone and Scale selector. No prompt fields, no model selector, no strength slider.

### Wireframe — Empty

```
┌─────────────────────────────────┐
│ [Text to Image|Img to Img|① Upscale]│
│═════════════════════════════════│
│                                 │
│  ② ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│    │                         │  │
│    │   Drop image here       │  │
│    │   or click to upload    │  │
│    │   or paste URL          │  │
│    │                         │  │
│     └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘  │
│                                 │
│─────────────────────────────────│
│ ③ Scale: [2x] [4x]             │
│                                 │
│─────────────────────────────────│
│                                 │
│ [         Upscale             ] │
└─────────────────────────────────┘
```

**Annotations:**
- ① `ModeSelector`: "Upscale" segment is active.
- ② `ImageDropzone`: Same dropzone component as img2img. Upload required before action.
- ③ `ScaleSelector`: Toggle group with two options. 2x is default (highlighted).

### Wireframe — Image Uploaded

```
┌─────────────────────────────────┐
│ [Text to Image|Img to Img|Upscale]│
│═════════════════════════════════│
│                                 │
│  ② ┌───────────────────────┐   │
│    │ ┌──────┐               │   │
│    │ │ thumb│ icon.png      │   │
│    │ │      │ 512x512       │   │
│    │ └──────┘        [✕]    │   │
│    └───────────────────────┘   │
│                                 │
│─────────────────────────────────│
│ ③ Scale: [2x] [4x]             │
│                                 │
│─────────────────────────────────│
│                                 │
│ [         Upscale             ] │
└─────────────────────────────────┘
```

### State Variations

| State | Visual Change |
|-------|---------------|
| `empty` | Dashed dropzone with placeholder text. Upscale button disabled. |
| `drag-over` | Dropzone border highlighted (visual emphasis). Upscale button disabled. |
| `uploading` | Progress indicator replaces placeholder text. Upscale button disabled. |
| `preview` | Thumbnail + filename + dimensions + remove button. Upscale button enabled. |
| `error` | Error message in dropzone + retry option. Upscale button disabled. |

---

## Screen: Gallery with Filter Chips + Mode Badges

**Context:** Right/main panel. Existing masonry gallery grid. New filter chips row above grid. Each generation card shows a small mode badge.

### Wireframe

```
┌──────────────────────────────────────────────┐
│ ① [Alle] [Text to Image] [Image to Image] [Upscale]│
│══════════════════════════════════════════════│
│                                              │
│  ┌────────┐  ┌────────┐  ┌──────┐  ┌──────┐│
│  │        │  │        │  │      │  │      ││
│  │  img   │  │  img   │  │ img  │  │ img  ││
│  │        │  │        │  │      │  │      ││
│  │   ② T  │  │   ② I  │  │ ② U │  │ ② T ││
│  └────────┘  └────────┘  └──────┘  └──────┘│
│                                              │
│  ┌──────┐  ┌────────┐  ┌────────┐           │
│  │      │  │        │  │        │           │
│  │ img  │  │  img   │  │  img   │           │
│  │      │  │        │  │        │           │
│  │ ② I  │  │  ② T  │  │  ② U  │           │
│  └──────┘  └────────┘  └────────┘           │
│                                              │
└──────────────────────────────────────────────┘
```

**Annotations:**
- ① `FilterChips`: Toggle group row. "Alle" is default (active). Clicking a chip filters gallery to that mode. Only one chip active at a time.
- ② `ModeBadge`: Small label in bottom corner of each generation card. "T" = Text to Image, "I" = Image to Image, "U" = Upscale.

### State Variations

| State | Visual Change |
|-------|---------------|
| `filter: Alle` | All generations shown. "Alle" chip highlighted. |
| `filter: Text to Image` | Only txt2img generations shown. Other chips inactive. |
| `filter: Image to Image` | Only img2img generations shown. |
| `filter: Upscale` | Only upscale generations shown. |
| `empty filter result` | See empty state wireframe below. |

### Wireframe — Empty Filter Result

```
┌──────────────────────────────────────────────┐
│ [Alle] [Text to Image] [Image to Image] [① Upscale]│
│══════════════════════════════════════════════│
│                                              │
│                                              │
│           No Upscale generations yet         │
│                                              │
│                                              │
└──────────────────────────────────────────────┘
```

**Annotations:**
- ① Active filter chip with no matching results. Message adapts to selected mode.

---

## Screen: Lightbox — Extended Actions

**Context:** Existing lightbox modal over gallery. Actions toolbar at bottom/top. New buttons added: "img2img" and "Upscale" (with popover).

### Wireframe — txt2img Image Open

```
┌──────────────────────────────────────────────────┐
│                    Lightbox                       │
│  ┌────────────────────────────────────────────┐  │
│  │                                            │  │
│  │                                            │  │
│  │              [large image]                 │  │
│  │                                            │  │
│  │                                            │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  [Variation] [① img2img] [② Upscale v] [Download] [Fav] [Delete]│
│                                                  │
│  [... details panel ...]                         │
└──────────────────────────────────────────────────┘
```

**Annotations:**
- ① `LightboxImg2ImgButton`: Clicking switches to img2img mode, sets this image as source, copies prompt, and closes lightbox.
- ② `UpscalePopover`: Clicking opens a small popover for scale selection.

### Wireframe — Upscale Popover Open

```
│  [Variation] [img2img] [② Upscale v] [Download] [Fav] [Delete]│
│                          ┌─────────┐                          │
│                          │  ③ 2x   │                          │
│                          │  ③ 4x   │                          │
│                          └─────────┘                          │
```

**Annotations:**
- ② `UpscalePopover`: Popover anchored below the Upscale button.
- ③ `ScaleSelector` (in popover): Two options. Clicking either starts the upscale process and closes the popover.

### Wireframe — img2img Image Open (Variation differs)

```
┌──────────────────────────────────────────────────┐
│                    Lightbox                       │
│  ┌────────────────────────────────────────────┐  │
│  │                                            │  │
│  │              [img2img result]              │  │
│  │                                            │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  [④ Variation] [img2img] [Upscale v] [Download] [Fav] [Delete]│
│                                                  │
│  [... details panel ...]                         │
└──────────────────────────────────────────────────┘
```

**Annotations:**
- ④ `Variation` (on img2img result): Unlike txt2img variation, this loads the **original source image** (not the generated image) into img2img mode with the original prompt and strength.

### State Variations

| State | Visual Change |
|-------|---------------|
| `txt2img image` | All buttons visible: Variation, img2img, Upscale, Download, Fav, Delete |
| `img2img image` | Same buttons. Variation behavior differs (loads original source). |
| `upscale image` | Upscale and Variation buttons hidden. img2img button visible (valid workflow: upscale for resolution, then img2img for transformation). |
| `popover open` | Small dropdown below Upscale button with 2x and 4x options. |
| `upscale processing` | Toast notification "Upscaling..." — lightbox can be closed. |

---

## Screen: Cross-Mode Transition (img2img from Lightbox)

**Context:** User clicks "img2img" in lightbox on a txt2img result. Lightbox closes, prompt area switches to img2img mode with source pre-filled.

### Wireframe — Result after transition

```
┌─────────────────────────────────┐
│ [Text to Image|Img to Img|Upscale]│
│═════════════════════════════════│
│                                 │
│  ┌───────────────────────┐     │
│  │ ┌──────┐               │     │
│  │ │ thumb│ ① (from gen)  │     │
│  │ │      │ 1024x1024     │     │
│  │ └──────┘        [✕]    │     │
│  └───────────────────────┘     │
│                                 │
│─────────────────────────────────│
│ Strength:                       │
│ [Subtle] [Balanced] [Creative]  │
│ [==========*=====] 0.60         │
│                                 │
│─────────────────────────────────│
│ [Prompt | History | Favorites]  │
│─────────────────────────────────│
│ Motiv:  [② original prompt__]  │
│ Style:  [② original style___]  │
│                                 │
│─────────────────────────────────│
│ Model: [original model     v]   │
│ Variants: [1] [2] [3] [4]      │
│                                 │
│ [         Generate            ] │
└─────────────────────────────────┘
```

**Annotations:**
- ① Source image is automatically set from the generated image's URL.
- ② Prompt fields are pre-filled from the original generation's motiv and style.

---

## Completeness Check

| Check | Status |
|-------|--------|
| All UI Components from Discovery covered | Yes |
| All relevant states visualized | Yes |
| ModeSelector — 3 modes shown | Yes |
| ImageDropzone — empty, preview, drag-over, uploading, error states | Yes |
| StrengthSlider — presets + slider shown | Yes |
| ScaleSelector — in prompt area + lightbox popover | Yes |
| FilterChips — all filter states | Yes |
| ModeBadge — T/I/U badges on cards | Yes |
| UpscalePopover — open/closed states | Yes |
| LightboxImg2ImgButton — action + transition | Yes |
| Cross-Mode flow visualized | Yes |
| img2img Variation flow (original source) documented | Yes |
| No logic/rules duplicated (stays in Discovery) | Yes |
