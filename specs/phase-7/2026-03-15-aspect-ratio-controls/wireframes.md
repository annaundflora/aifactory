# Wireframes: Model Parameter Controls (Aspect Ratio, Size & Advanced)

**Discovery:** `discovery.md` (same folder)
**Status:** Draft

---

## Component Coverage

| UI Component (from Discovery) | Screen |
|-------------------------------|--------|
| Primary Controls (ParameterPanel filtered on whitelist) | Prompt Panel, Variation Popover, Img2img Popover |
| Advanced Toggle (Button/Link) | Prompt Panel, Variation Popover, Img2img Popover |
| Advanced Controls (ParameterPanel non-primary properties) | Prompt Panel, Variation Popover, Img2img Popover |

---

## User Flow Overview

```
[Mode selected] ──schema loads──► [Primary Controls visible]
       │                                    │
       │                              ┌─────┴──────┐
       │                              │             │
       │                    select aspect      select size
       │                    ratio value        param value
       │                              │             │
       │                              └─────┬──────┘
       │                                    │
       │                         ──click Advanced──► [Advanced Controls expanded]
       │                                    │                    │
       │                              select advanced      select advanced
       │                              param values         param values
       │                                    │                    │
       │                                    └────────┬───────────┘
       │                                             │
       └─────────────────────────────────► [Generate] ──params merged──► [API call]
```

```
[Tier change] ──new model──► [schema_loading] ──schema fetched──► [Primary Controls update]
                                                                   (invalid values reset)
```

---

## Screen: Prompt Panel (txt2img / img2img)

**Context:** Right sidebar in Workspace. Controls appear between Tier Toggle and Variant Count Stepper. Shown in txt2img and img2img modes only (not upscale).

### Wireframe

```
┌─────────────────────────────────┐
│         PROMPT AREA             │
│                                 │
│  [... Mode Selector ...]        │
│  [... Prompt Tabs ...]          │
│  [... Reference Bar (img2img)]  │
│  [... Prompt Fields ...]        │
│  [... Prompt Tools ...]         │
│                                 │
│  ─────────────────────────────  │
│                                 │
│  ① [Draft ● | Quality]         │
│                                 │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐  │
│  │ ② Aspect Ratio            │  │
│  │ ┌───────────────────────┐ │  │
│  │ │ 1:1                 ▼ │ │  │
│  │ └───────────────────────┘ │  │
│  │                           │  │
│  │ ③ Megapixels              │  │
│  │ ┌───────────────────────┐ │  │
│  │ │ 1                   ▼ │ │  │
│  │ └───────────────────────┘ │  │
│  │                           │  │
│  │ ④ ▸ Advanced              │  │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘  │
│                                 │
│  Variants          [- ] 1 [+ ] │
│                                 │
│  ┌─────────────────────────────┐│
│  │         Generate            ││
│  └─────────────────────────────┘│
└─────────────────────────────────┘
```

**Annotations:**
- ① `TierToggle`: Existing tier selector (Draft/Quality/Max). Tier change triggers model re-resolution and schema refetch.
- ② `Primary Controls > Aspect Ratio`: Select dropdown populated from model schema enum. Only shown if current model has `aspect_ratio` in schema.
- ③ `Primary Controls > Megapixels/Resolution`: Select dropdown for size parameter. Shows `megapixels` (Flux models) or `resolution` (Nano Banana 2). Only shown if current model has the field. GPT Image 1.5 has neither — field hidden.
- ④ `Advanced Toggle`: Clickable text/button to expand Advanced Controls section. Hidden if model has no advanced properties.

### Wireframe: Advanced Expanded

```
┌─────────────────────────────────┐
│  [... above controls ...]       │
│                                 │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐  │
│  │ ② Aspect Ratio            │  │
│  │ ┌───────────────────────┐ │  │
│  │ │ 16:9                ▼ │ │  │
│  │ └───────────────────────┘ │  │
│  │                           │  │
│  │ ③ Megapixels              │  │
│  │ ┌───────────────────────┐ │  │
│  │ │ 1                   ▼ │ │  │
│  │ └───────────────────────┘ │  │
│  │                           │  │
│  │ ④ ▾ Advanced              │  │
│  │ ┌───────────────────────┐ │  │
│  │ │                       │ │  │
│  │ │ ⑤ Quality             │ │  │
│  │ │ ┌─────────────────┐   │ │  │
│  │ │ │ standard      ▼ │   │ │  │
│  │ │ └─────────────────┘   │ │  │
│  │ │                       │ │  │
│  │ │ ⑥ Background          │ │  │
│  │ │ ┌─────────────────┐   │ │  │
│  │ │ │ auto          ▼ │   │ │  │
│  │ │ └─────────────────┘   │ │  │
│  │ │                       │ │  │
│  │ │ ⑦ Output Format       │ │  │
│  │ │ ┌─────────────────┐   │ │  │
│  │ │ │ png           ▼ │   │ │  │
│  │ │ └─────────────────┘   │ │  │
│  │ └───────────────────────┘ │  │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘  │
│                                 │
│  [... Variants + Generate ...]  │
└─────────────────────────────────┘
```

**Annotations:**
- ⑤ `Advanced Controls > Quality`: Example advanced enum param (GPT Image 1.5). Select dropdown from schema.
- ⑥ `Advanced Controls > Background`: Example advanced enum param (GPT Image 1.5). Select dropdown from schema.
- ⑦ `Advanced Controls > Output Format`: Example advanced param. All advanced fields are dynamically rendered from model schema — list varies per model.

### State Variations

| State | Visual Change |
|-------|---------------|
| `schema_loading` | Skeleton placeholders (3 rows: label + select placeholder) replace Primary + Advanced area |
| `schema_ready` | Primary dropdowns visible with default values selected, Advanced toggle visible |
| `schema_empty` | No Primary or Advanced controls shown — area completely absent, no placeholder |
| `schema_error` | Same as `schema_empty` — controls area absent, generation still possible without params |
| `advanced_collapsed` (default) | Only Primary controls + "▸ Advanced" toggle visible |
| `advanced_expanded` | Primary controls + "▾ Advanced" toggle + Advanced controls visible |
| `tier_change` | Brief skeleton flash while new schema loads, then controls update. Invalid values reset to model defaults |
| `no_primary_fields` | Primary area empty, only Advanced toggle shown (if advanced fields exist) |
| `no_advanced_fields` | Advanced toggle hidden, only Primary controls shown |

---

## Screen: Variation Popover

**Context:** Canvas Detail View. Popover appears to the right of the image when Variation tool is active. Controls appear between Tier/MaxQuality Toggle and Generate button.

### Wireframe

```
┌────────────────────────────────┐
│  ✦ Variation                   │
│ ───────────────────────────────│
│                                │
│  Prompt                        │
│  ┌────────────────────────────┐│
│  │ A majestic owl...          ││
│  └────────────────────────────┘│
│                                │
│  Strength                      │
│  ┌────────────────────────────┐│
│  │ Balanced                 ▼ ││
│  └────────────────────────────┘│
│                                │
│  Count                         │
│  [ 1 ] [ 2 ] [ 3 ] [ 4 ]      │
│                                │
│  ① [Draft ● | Quality]        │
│     ☐ Max Quality              │
│                                │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│  │ ② Aspect Ratio           │  │
│  │ ┌──────────────────────┐ │  │
│  │ │ 1:1                ▼ │ │  │
│  │ └──────────────────────┘ │  │
│  │                          │  │
│  │ ③ Megapixels             │  │
│  │ ┌──────────────────────┐ │  │
│  │ │ 1                  ▼ │ │  │
│  │ └──────────────────────┘ │  │
│  │                          │  │
│  │ ④ ▸ Advanced             │  │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                │
│  ┌────────────────────────────┐│
│  │   ✦ Generate               ││
│  └────────────────────────────┘│
└────────────────────────────────┘
```

**Annotations:**
- ① `TierToggle + MaxQualityToggle`: Existing tier controls. Tier change triggers model re-resolution and schema refetch.
- ② `Primary Controls > Aspect Ratio`: Same ParameterPanel component as Prompt Panel. Select dropdown from model schema enum.
- ③ `Primary Controls > Megapixels/Resolution`: Size parameter dropdown. Field name depends on model (megapixels for Flux, resolution for Nano Banana 2).
- ④ `Advanced Toggle`: Expands to show model-specific advanced parameters. Same behavior as Prompt Panel.

### State Variations

| State | Visual Change |
|-------|---------------|
| `schema_loading` | Skeleton rows in place of Primary + Advanced area |
| `schema_ready` | Dropdowns visible with defaults |
| `schema_empty` | Controls area absent — popover shorter |
| `advanced_expanded` | Additional dropdowns visible below toggle |
| `tier_change` | Skeleton flash, then updated controls |

---

## Screen: Img2img Popover

**Context:** Canvas Detail View. Popover appears to the right of the image when Img2img tool is active. Controls appear between Tier/MaxQuality Toggle and Generate button.

### Wireframe

```
┌────────────────────────────────┐
│  REFERENCES [2/5]              │
│  ┌──────┐ ┌──────┐ ┌─ ─ ─┐   │
│  │ img1 │ │ img2 │ │  +  │   │
│  └──────┘ └──────┘ └─ ─ ─┘   │
│                                │
│  PROMPT                        │
│  Motiv *                       │
│  ┌────────────────────────────┐│
│  │ Describe the subject...    ││
│  └────────────────────────────┘│
│  Style / Modifier              │
│  ┌────────────────────────────┐│
│  │ Style, mood...             ││
│  └────────────────────────────┘│
│                                │
│  VARIANTS                      │
│  [-] 1 [+]                     │
│                                │
│  ① [Draft ● | Quality]        │
│     ☐ Max Quality              │
│                                │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│  │ ② Aspect Ratio           │  │
│  │ ┌──────────────────────┐ │  │
│  │ │ 1:1                ▼ │ │  │
│  │ └──────────────────────┘ │  │
│  │                          │  │
│  │ ③ Resolution              │  │
│  │ ┌──────────────────────┐ │  │
│  │ │ 2K                 ▼ │ │  │
│  │ └──────────────────────┘ │  │
│  │                          │  │
│  │ ④ ▸ Advanced             │  │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                │
│  ┌────────────────────────────┐│
│  │       Generate             ││
│  └────────────────────────────┘│
└────────────────────────────────┘
```

**Annotations:**
- ① `TierToggle + MaxQualityToggle`: Existing tier controls. Tier change triggers model re-resolution and schema refetch.
- ② `Primary Controls > Aspect Ratio`: Select dropdown from model schema. Example shows Nano Banana 2 which has 14 aspect ratio options.
- ③ `Primary Controls > Resolution`: Size parameter specific to Nano Banana 2 (enum: 512px, 1K, 2K, 4K). Flux models would show `Megapixels` instead. GPT Image 1.5 shows neither.
- ④ `Advanced Toggle`: Expands to show model-specific advanced parameters (e.g. safety_filter_level, output_format for Nano Banana 2).

### State Variations

| State | Visual Change |
|-------|---------------|
| `schema_loading` | Skeleton rows in place of Primary + Advanced area |
| `schema_ready` | Dropdowns visible with defaults |
| `schema_empty` | Controls area absent — popover shorter |
| `advanced_expanded` | Additional dropdowns visible below toggle |
| `tier_change` | Skeleton flash, then updated controls |

---

## Completeness Check

| Check | Status |
|-------|--------|
| All Screens from UI Layout (Discovery) covered | Yes — Prompt Panel, Variation Popover, Img2img Popover |
| All UI Components annotated | Yes — Primary Controls, Advanced Toggle, Advanced Controls |
| Relevant State Variations documented | Yes — loading, ready, empty, error, collapsed, expanded, tier_change |
| No Logic/Rules duplicated (stays in Discovery) | Yes — business rules, whitelist, merge logic remain in Discovery |
