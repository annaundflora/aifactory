# Wireframes: Multi-Image Referencing

**Discovery:** `discovery.md` (same folder)
**Status:** Draft

---

## Component Coverage

| UI Component (from Discovery) | Screen |
|-------------------------------|--------|
| `ReferenceBar` | Prompt Area (img2img mode) |
| `ReferenceSlot` | Reference Bar (expanded) |
| `RoleDropdown` | Reference Slot (ready state) |
| `StrengthDropdown` | Reference Slot (ready state) |
| `SlotLabel` | Reference Slot (ready state) |
| `RoleBadge` | Reference Slot (ready state) |
| `AddReferenceButton` | Reference Bar Header |
| `UseAsReferenceButton` | Lightbox Actions |
| `InlineRefTag` | Prompt Textarea (V1: plain text, V2: highlighted) |
| `RefHintBanner` | Prompt Area (below textareas) |
| `ProvenanceRow` | Lightbox Details Panel |
| `CompatibilityWarning` | Reference Bar (above slots) |

---

## User Flow Overview

```
[img2img mode] ──add image──► [Reference Bar expanded]
       │                              │
       │                       ┌──────┼──────────┐
       │                       │      │           │
       │                    assign  set         type @ref
       │                    role    strength    in prompt
       │                       │      │           │
       │                       └──────┼──────────┘
       │                              │
       │                       ──generate──► [Gallery Result]
       │                                          │
       │                                   ──open lightbox──► [Provenance visible]
       │                                          │
       └──gallery drag / lightbox btn──► [Slot filled]
```

---

## Screen: Prompt Area — img2img Mode (Full View)

**Context:** Left panel (480px wide). Existing elements (Mode Selector, Model Card, Prompt fields, Variants, Generate) shown as annotations. Only NEW elements are wireframed in detail. This shows the layout with 3 reference images loaded.

### Wireframe

```
┌──────────────────────────────────────────────┐
│ [... existing Mode Selector ...]             │  ← existing (unchanged)
├──────────────────────────────────────────────┤
│ [... existing Model Card ...]                │  ← existing (unchanged)
├──────────────────────────────────────────────┤
│                                              │
│  ▾ References [3/5]                  [+ Add] │  ← ① Collapsible Header + ② Add Button
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │ ┌────────┐                           │    │
│  │ │        │  @1  [Style]         [x]  │    │  ← ③ Slot, ④ SlotLabel, ⑤ RoleBadge
│  │ │  img   │  [● Style         ▾]     │    │  ← ⑥ RoleDropdown (violet)
│  │ │  80x80 │  [◎ Moderate      ▾]     │    │  ← ⑦ StrengthDropdown
│  │ └────────┘                           │    │
│  └──────────────────────────────────────┘    │
│  ┌──────────────────────────────────────┐    │
│  │ ┌────────┐                           │    │
│  │ │        │  @3  [Content]       [x]  │    │  ← Slot @3 (blue) — sparse labels!
│  │ │  img   │  [● Content       ▾]     │    │
│  │ │  80x80 │  [◎ Strong        ▾]     │    │
│  │ └────────┘                           │    │
│  └──────────────────────────────────────┘    │
│  ┌──────────────────────────────────────┐    │
│  │ ┌────────┐                           │    │
│  │ │        │  @5  [Structure]     [x]  │    │  ← Slot @5 (green) — sparse labels!
│  │ │  img   │  [● Structure     ▾]     │    │
│  │ │  80x80 │  [◎ Subtle        ▾]     │    │
│  │ └────────┘                           │    │
│  └──────────────────────────────────────┘    │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐    │
│  │  Drop image here, click to browse,  │    │  ← ⑧ Trailing Empty Dropzone
│  │  or paste a URL                     │    │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘    │
│                                              │
│──────────────────────────────────────────────│
│                                              │
│  [... existing Motiv/Style/Negative ...]     │  ← existing Prompt fields (unchanged)
│                                              │
│  (i) Tip: Use @1, @3, @5 in prompt   [x]   │  ← ⑨ RefHintBanner (dismissible)
│      to reference your images                │
│                                              │
│  [... existing Variants + Generate ...]      │  ← existing (unchanged)
│                                              │
└──────────────────────────────────────────────┘
```

**Annotations:**
- ① `ReferenceBar`: Collapsible header (shadcn Collapsible) with counter badge [3/5]
- ② `AddReferenceButton`: Opens file dialog, disabled when 5/5
- ③ `ReferenceSlot`: Card with 80x80 thumbnail, role-colored border
- ④ `SlotLabel`: Stable badge (@1, @3, @5 — sparse numbering after @2 and @4 were removed)
- ⑤ `RoleBadge`: Color-coded badge showing current role name
- ⑥ `RoleDropdown`: Select with colored dot indicator (Style=violet, Content=blue, Structure=green, Character=amber, Color=pink)
- ⑦ `StrengthDropdown`: Select with 4 levels (Subtle/Moderate/Strong/Dominant)
- ⑧ Trailing Empty Dropzone: Always visible below last filled slot when < 5 slots. Persistent drag target for file drops and gallery drags.
- ⑨ `RefHintBanner`: Info banner with dismiss [x] button. Shows actual @-numbers of loaded refs. Dismissal persisted in localStorage.

### State Variations

| State | Visual Change |
|-------|---------------|
| `collapsed-empty` | Header shows "▸ References (0) [+ Add]", no slots visible |
| `collapsed-filled` | Header shows "▸ References (3/5) [◻1][◻3][◻5]" with mini-thumbnails (sparse labels) |
| `expanded` | Full slots visible as shown in wireframe above |
| `txt2img mode` | Entire Reference Bar hidden (slots preserved in memory) |
| `upscale mode` | Entire Reference Bar hidden (slots preserved in memory) |

---

## Screen: Reference Bar — Collapsed Empty

**Context:** img2img mode, no reference images loaded yet. Bar is collapsed by default.

### Wireframe

```
┌──────────────────────────────────────────────┐
│ [... Mode Selector + Model Card ...]         │
├──────────────────────────────────────────────┤
│                                              │
│  ▸ References (0)                    [+ Add] │  ← ① Collapsed header
│                                              │
│──────────────────────────────────────────────│
│ [... Prompt fields ...]                      │
└──────────────────────────────────────────────┘
```

**Annotations:**
- ① `ReferenceBar` (collapsed-empty): Chevron right, counter (0), Add button always visible

---

## Screen: Reference Bar — Collapsed with Images

**Context:** img2img mode, 3 reference images loaded, bar manually collapsed by user.

### Wireframe

```
┌──────────────────────────────────────────────┐
│ [... Mode Selector + Model Card ...]         │
├──────────────────────────────────────────────┤
│                                              │
│  ▸ References [3/5]  [◻1][◻3][◻5]   [+ Add] │  ← ① Mini-thumbnails (sparse labels)
│                                              │
│──────────────────────────────────────────────│
│ [... Prompt fields ...]                      │
└──────────────────────────────────────────────┘
```

**Annotations:**
- ① `ReferenceBar` (collapsed-filled): Counter badge [3/5], mini-thumbnails (small squares) as preview, expandable via click

---

## Screen: Reference Slot — Empty (Drop Zone)

**Context:** Inside expanded Reference Bar, one slot is empty and ready for image upload.

### Wireframe

```
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
│                                          │  ← ① Dashed border (drop zone)
│   Drop image here, click to browse,      │
│   or paste a URL                         │
│                                          │
└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
```

**Annotations:**
- ① `ReferenceSlot` (empty): Dashed border indicates drop zone, accepts drag & drop, click-to-browse, URL paste

### State Variations

| State | Visual Change |
|-------|---------------|
| `empty` | Dashed border, help text as shown |
| `drag-over` | Dashed border highlighted (accent color), "Drop to add" text |
| `uploading` | Solid border, spinner + "Uploading..." replacing help text |
| `error` | Red dashed border, error message + "Retry" link |

---

## Screen: Reference Slot — Ready (Detail)

**Context:** Single reference slot with image loaded, showing all controls.

### Wireframe

```
┌──────────────────────────────────────────┐
│ ┌────────┐                               │  ← ① Role-colored border
│ │        │  ②@1  ③[Style]          ④[x]  │
│ │  img   │  ⑤[● Style         ▾]        │
│ │  80x80 │  ⑥[◎ Moderate      ▾]        │
│ │        │                               │
│ └────────┘                               │
└──────────────────────────────────────────┘
```

**Annotations:**
- ① `ReferenceSlot` (ready): Solid border in role color (e.g., violet for Style)
- ② `SlotLabel`: "@1" badge (primary variant)
- ③ `RoleBadge`: Color-coded, shows role name
- ④ Remove button: Removes slot, remaining labels stay stable (no re-numbering)
- ⑤ `RoleDropdown`: Options: Style (violet), Content (blue), Structure (green), Character (amber), Color (pink). Colored dot indicator matches selection.
- ⑥ `StrengthDropdown`: Options: Subtle, Moderate, Strong, Dominant. Gauge icon.

---

## Screen: Reference Slot — Dimmed (Model Incompatible)

**Context:** Model supports fewer images than loaded. Excess slots are dimmed.

### Wireframe

```
┌──────────────────────────────────────────┐
│ ┌────────┐                               │  ← Grayed out, reduced opacity
│ │        │  @4  [Character]         [x]  │
│ │  img   │  ⚠ Will be ignored            │  ← ① Warning text replaces dropdowns
│ │  80x80 │                               │
│ │ (dim)  │                               │
│ └────────┘                               │
└──────────────────────────────────────────┘
```

**Annotations:**
- ① `ReferenceSlot` (dimmed): Reduced opacity, warning icon + "Will be ignored" text, remove button still active

---

## Screen: Compatibility Warning Banner

**Context:** User has loaded 5 images but current model only supports 3. Banner appears above slots.

### Wireframe

```
┌──────────────────────────────────────────────┐
│  ▾ References [5/5]                  [+ Add] │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ ⚠ Model "SDXL" supports max 3         │  │  ← ① CompatibilityWarning
│  │   references. Images @4-@5 will be     │  │
│  │   ignored.                             │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [Slot @1 — ready]                           │
│  [Slot @2 — ready]                           │
│  [Slot @3 — ready]                           │
│  [Slot @4 — dimmed]                          │  ← Dimmed slots
│  [Slot @5 — dimmed]                          │
│                                              │
└──────────────────────────────────────────────┘
```

**Annotations:**
- ① `CompatibilityWarning`: Alert banner (warning variant), shows model name and limit. Slots beyond limit are dimmed.

### State Variations

| State | Visual Change |
|-------|---------------|
| `hidden` | No banner, all slots normal |
| `partial` | Banner with limit info, excess slots dimmed |
| `no-support` | Banner: "Model does not support reference images. [Switch to FLUX 2 Pro] or [Browse Models]" — actionable links that directly switch model or open Model Browser. Generate button disabled. |

---

## Screen: Lightbox — With Provenance

**Context:** Existing Lightbox modal with two NEW elements added. Only new elements are wireframed in detail; existing elements (Image, Prompt, Model, Dimensions, Navigation, Variation, img2img, Upscale, Download PNG, Delete) remain unchanged.

### Wireframe (NEW elements only)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                            [X]  │
│                                                                 │
│  ┌──────────────────────────┐  ┌─────────────────────────────┐  │
│  │                          │  │                             │  │
│  │      Generated Image     │  │  [... existing details ...] │  │
│  │                          │  │                             │  │
│  │                          │  │  ─────────────────────────  │  │
│  │                          │  │                             │  │
│  │                          │  │  ① References               │  │
│  │                          │  │  ┌─────┐ ┌─────┐ ┌─────┐  │  │
│  │                          │  │  │ @1  │ │ @3  │ │ @5  │  │  │
│  │                          │  │  │ img │ │ img │ │ img │  │  │
│  │                          │  │  └─────┘ └─────┘ └─────┘  │  │
│  │                          │  │  Style    Content  Struct.  │  │
│  │                          │  │  Moderate Strong   Subtle   │  │
│  │                          │  │                             │  │
│  └──────────────────────────┘  │  ─────────────────────────  │  │
│                                │                             │  │
│       [<]            [>]       │  [Variation]                │  │
│                                │  ②[As Reference]  ← NEW     │  │
│                                │  [... existing actions ...]  │  │
│                                │                             │  │
│                                └─────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `ProvenanceRow` (NEW): Horizontal thumbnail row showing reference images used for this generation. Each thumbnail labeled with @-number (stable/sparse), role name, and strength level. Placed below existing details, above action buttons.
- ② `UseAsReferenceButton` (NEW): New action button between "Variation" and "img2img". Adds this lightbox image to next free reference slot (lowest available @-number) with default role "Content" and strength "Moderate". Auto-switches to img2img mode if needed. Existing buttons (Variation, img2img, Upscale, Download PNG, Delete) remain unchanged.

### State Variations

| State | Visual Change |
|-------|---------------|
| `no-references` | Provenance section hidden entirely |
| `with-references` | Thumbnail row visible as shown |
| `slots-full` | "As Reference" button disabled, tooltip: "All 5 slots filled" |

---

## Screen: Inline Reference Tokens in Prompt (V1)

**Context:** Close-up of the prompt textarea. V1 uses plain text @-tokens (no visual highlighting). Highlighting deferred to V2.

### Wireframe

```
┌──────────────────────────────────────────┐
│ Extract the building from ①@3 and        │
│ render it in the style of ②@1 with       │
│ the color palette of ③@5                 │
└──────────────────────────────────────────┘
```

**Annotations:**
- ① `InlineRefTag` @3: Plain text token, recognized server-side, mapped to @image3
- ② `InlineRefTag` @1: Plain text token, mapped to @image1
- ③ `InlineRefTag` @5: Plain text token, mapped to @image5
- V1: No visual distinction from regular text. RefHintBanner provides discoverability.
- V2 (future): Color-coded highlighting matching role colors.

---

## Screen: Ref Hint Banner

**Context:** Below the prompt fields, informational banner appears when references are loaded.

### Wireframe

```
│  ┌──────────────────────────────────────┐  │
│  │ (i) Tip: Use @1, @3, @5 in your  [x]│  │  ← ① RefHintBanner (dismissible)
│  │     prompt to reference images       │  │
│  └──────────────────────────────────────┘  │
```

**Annotations:**
- ① `RefHintBanner`: Info banner with accent background and dismiss [x] button. Only visible when at least one reference image is loaded AND not previously dismissed. Shows actual @-numbers of loaded references (sparse). Dismiss state persisted in localStorage.

---

## Completeness Check

| Check | Status |
|-------|--------|
| All UI Components from Discovery covered | ✅ (12/12 components) |
| All relevant states visualized | ✅ (ReferenceBar: 3 states, ReferenceSlot: 5 states, CompatibilityWarning: 3 states, Lightbox: 3 states, InlineRefTag: 3 states) |
| All screens from UI Layout (Discovery) covered | ✅ (Reference Bar full view, collapsed states, slot states, lightbox provenance, lightbox actions, inline refs, hint banner, compatibility warning) |
| No logic/rules duplicated (stays in Discovery) | ✅ |
