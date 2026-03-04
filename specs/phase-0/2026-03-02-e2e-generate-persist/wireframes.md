# Wireframes: E2E Generate & Persist (Phase 0)

**Discovery:** `discovery.md` (same folder)
**Status:** Draft

---

## Component Coverage

| UI Component (from Discovery) | Screen |
|-------------------------------|--------|
| `project-card` | Project Overview |
| `new-project-btn` | Project Overview, Sidebar |
| `project-name-input` | Project Overview |
| `rename-project-input` | Project Overview, Sidebar |
| `delete-project-btn` | Project Overview, Sidebar |
| `confirm-dialog` | Project Overview, Lightbox, Prompt Builder |
| `sidebar-project-list` | Project Workspace |
| `model-dropdown` | Project Workspace |
| `prompt-textarea` | Project Workspace |
| `negative-prompt-input` | Project Workspace |
| `generate-btn` | Project Workspace |
| `prompt-builder-btn` | Project Workspace |
| `improve-prompt-btn` | Project Workspace |
| `variant-count` | Project Workspace |
| `parameter-panel` | Project Workspace |
| `gallery-grid` | Project Workspace |
| `generation-placeholder` | Project Workspace |
| `generation-card` | Project Workspace |
| `retry-btn` | Project Workspace |
| `lightbox-modal` | Lightbox |
| `lightbox-prev-btn` | Lightbox |
| `lightbox-next-btn` | Lightbox |
| `download-btn` | Lightbox |
| `variation-btn` | Lightbox |
| `delete-generation-btn` | Lightbox |
| `builder-drawer` | Prompt Builder |
| `category-tab` | Prompt Builder |
| `option-chip` | Prompt Builder |
| `surprise-me-btn` | Prompt Builder |
| `snippet-form` | Prompt Builder (My Snippets) |
| `snippet-chip` | Prompt Builder (My Snippets) |
| `llm-comparison` | LLM Prompt Improvement |
| `adopt-btn` | LLM Prompt Improvement |
| `discard-btn` | LLM Prompt Improvement |

---

## User Flow Overview

```
[Project Overview] ──open project──► [Workspace (empty)]
       │                                    │
       ├──new project──► [Workspace]        ├──enter prompt──► [Workspace (ready)]
       │                                    │                        │
       └──delete project──► [Confirm]       │                 ┌──────┼──────────┐
                                            │                 │      │          │
                                            │            [Generate] [Builder] [Improve]
                                            │                 │      │          │
                                            │                 ▼      │          ▼
                                            │           [Generating] │   [Prompt Improved]
                                            │                 │      │          │
                                            │                 ▼      │          ├──adopt──►  [Ready]
                                            │         [Populated]◄───┘          └──discard──►[Ready]
                                            │                 │
                                            │           click image
                                            │                 │
                                            │                 ▼
                                            │           [Lightbox]
                                            │            │   │   │
                                            │     download variation delete
```

---

## Screen: Project Overview

**Context:** Root page (`/`). First screen when opening the app. No project selected.

### Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│  POD Design Studio                                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ① [+ New Project]                                           │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │       │
│  │ │ Thumb-   │ │  │ │ Thumb-   │ │  │ │ Thumb-   │ │       │
│  │ │ nail     │ │  │ │ nail     │ │  │ │ nail     │ │       │
│  │ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │       │
│  │              │  │              │  │              │       │
│  │ ② Project A ③✎│  │ ② Project B ③✎│  │ ② Project C ③✎│       │
│  │ 12 images    │  │ 5 images     │  │ 0 images     │       │
│  │ Mar 1, 2026  │  │ Feb 28, 2026 │  │ Mar 2, 2026  │       │
│  │         ④ 🗑  │  │         ④ 🗑  │  │         ④ 🗑  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `new-project-btn`: Opens inline input for project name
- ② `project-card`: Shows thumbnail of last image, project name, generation count, date. Click opens workspace.
- ③ `rename-project-input`: Edit icon next to project name. Click makes name editable inline. Enter/Blur saves.
- ④ `delete-project-btn`: Opens confirmation dialog

### State Variations

| State | Visual Change |
|-------|---------------|
| `empty` (no projects) | No cards shown. Centered CTA: "Create your first project" with prominent new-project button |
| `creating` (inline input visible) | Input field appears above grid, auto-focused |
| `renaming` | Project name becomes editable input field, auto-focused, Enter/Blur saves |
| `confirm-delete` | `confirm-dialog` overlay: "Delete project and all generations?" with Confirm / Cancel buttons |

---

## Screen: Project Workspace

**Context:** Project detail page (`/projects/[id]`). User has opened a project. Sidebar persistent on left, main content on right.

### Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│  POD Design Studio                                                         │
├────────────┬───────────────────────────────────────────────────────────────┤
│            │                                                               │
│ ① Sidebar  │  ═══ Prompt & Controls ═══════════════════════════════════    │
│            │                                                               │
│ ② [+ New]  │  ③ [ Model ▼ FLUX 2 Pro — $0.055 ]                           │
│            │                                                               │
│ ─────────  │  ④ ┌─────────────────────────────────────────────────────┐    │
│ ▸ Project A│    │ Enter your prompt...                                │    │
│ ▸ Project B│    │                                                     │    │
│ ▹ Active ◂ │    └─────────────────────────────────────────────────────┘    │
│ ▸ Project D│                                                               │
│            │  ⑤ ┌─────────────────────────────────────────────────────┐    │
│ ─────────  │    │ Negative prompt (optional)...                       │    │
│ ← Overview │    └─────────────────────────────────────────────────────┘    │
│            │                                                               │
│            │  ⑥ [Generate]  ⑦ [Prompt Builder]  ⑧ [Improve Prompt]        │
│            │                                              ⑨ [1-4 ▼]       │
│            │                                                               │
│            │  ═══ Parameters ══════════════════════════════════════════    │
│            │                                                               │
│            │  ⑩ ┌──────────────────────────────────────────────────┐       │
│            │     │ Aspect Ratio  [1:1 ▼]    Output Format [png ▼] │       │
│            │     │ Seed  [______]            Steps  [───●──── 28] │       │
│            │     │ Guidance  [───●──── 3.5]  Safety  [  ▼  ]     │       │
│            │     └──────────────────────────────────────────────────┘       │
│            │                                                               │
│            │  ═══ Gallery ═════════════════════════════════════════════    │
│            │                                                               │
│            │  ⑪ ┌────────┐ ┌──────┐ ┌────────────┐ ┌──────┐              │
│            │     │        │ │      │ │            │ │      │              │
│            │     │ img 1  │ │img 2 │ │   img 3    │ │img 4 │              │
│            │     │        │ │      │ │            │ │      │              │
│            │     │        │ └──────┘ │            │ └──────┘              │
│            │     └────────┘ ┌──────┐ └────────────┘ ┌──────────┐          │
│            │     ┌──────┐   │      │                │          │          │
│            │     │      │   │img 5 │                │  img 6   │          │
│            │     │img 7 │   │      │                │          │          │
│            │     └──────┘   └──────┘                └──────────┘          │
│            │                                                               │
├────────────┴───────────────────────────────────────────────────────────────┤
└────────────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `sidebar-project-list`: List of all projects, active one highlighted
- ② `new-project-btn`: Create new project from sidebar
- ③ `model-dropdown`: Shows model name + price. Change reloads parameter schema
- ④ `prompt-textarea`: Multi-line, auto-resize. Remains editable during generation. Cmd/Ctrl+Enter triggers generation
- ⑤ `negative-prompt-input`: Only visible when selected model supports it
- ⑥ `generate-btn`: Starts generation. Shows spinner during API call but prompt area stays interactive
- ⑦ `prompt-builder-btn`: Opens Prompt Builder drawer
- ⑧ `improve-prompt-btn`: Starts LLM improvement via OpenRouter
- ⑨ `variant-count`: Slider/dropdown 1-4. Always visible, default 1
- ⑩ `parameter-panel`: Dynamically generated controls from model schema (sliders, dropdowns, number inputs)
- ⑪ `gallery-grid`: Masonry grid with all generations, newest first. Each item is a `generation-card`

### State Variations

| State | Visual Change |
|-------|---------------|
| `workspace-empty` | Gallery section shows: "No generations yet. Enter a prompt and hit Generate!" |
| `generating` | `generate-btn` shows spinner. `generation-placeholder` appears at top of gallery with skeleton animation. Prompt area, builder, and improve buttons remain interactive |
| `generation-failed` | Placeholder shows error icon + "Generation failed" text + `retry-btn` |
| `parameter-panel loading` | Panel shows skeleton placeholders while model schema loads |
| `negative-prompt hidden` | ⑤ not rendered (model doesn't support negative_prompt) |

---

## Screen: Lightbox / Image Detail Modal

**Context:** Overlay on top of Project Workspace. Opens when user clicks an image in the gallery.

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│  [... Project Workspace dimmed behind ...]                           │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │                                                        ① [X] │   │
│   │                                                              │   │
│   │        ┌──────────────────────────┐                          │   │
│   │   ②    │                          │    ③                     │   │
│   │  [◄]   │                          │   [►]                    │   │
│   │        │       ④ Large Image      │                          │   │
│   │        │                          │                          │   │
│   │        │                          │                          │   │
│   │        │                          │                          │   │
│   │        └──────────────────────────┘                          │   │
│   │                                                              │   │
│   │  ═══ Details ════════════════════════════════════════════    │   │
│   │                                                              │   │
│   │  ⑤ Prompt:     "A fox in oil painting style, warm colors"    │   │
│   │  ⑥ Neg. Prompt: "blurry, low quality"                        │   │
│   │     Model:      FLUX 2 Pro                                   │   │
│   │     Params:     1:1, 28 steps, seed 42, guidance 3.5         │   │
│   │     Size:       1024 x 1024                                  │   │
│   │     Created:    Mar 2, 2026 14:32                            │   │
│   │                                                              │   │
│   │  ═══ Actions ════════════════════════════════════════════    │   │
│   │                                                              │   │
│   │  ⑦ [Download PNG]   ⑧ [Variation]   ⑨ [Delete]              │   │
│   │                                                              │   │
│   └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① Close button (X) or click on dimmed background to close
- ② `lightbox-prev-btn`: Previous image. Also triggered by left arrow key. Wraps around at start.
- ③ `lightbox-next-btn`: Next image. Also triggered by right arrow key. Wraps around at end.
- ④ `lightbox-modal`: Large image, centered, max available size
- ⑤ Full prompt text used for generation
- ⑥ Negative prompt (only shown if present)
- ⑦ `download-btn`: Downloads image as PNG
- ⑧ `variation-btn`: Copies prompt + model + parameters to input fields, closes lightbox
- ⑨ `delete-generation-btn`: Opens confirmation before deleting

### State Variations

| State | Visual Change |
|-------|---------------|
| `confirm-delete` | `confirm-dialog` overlay: "Delete this generation?" with Confirm / Cancel |
| `downloading` | Download button shows spinner briefly |
| `no-negative-prompt` | ④ row not rendered |

---

## Screen: Prompt Builder Drawer

**Context:** Drawer sliding in from the right (or modal). Overlays the workspace. Opens when user clicks "Prompt Builder" button.

### Wireframe

```
┌────────────────────────────────────────────────┐
│  Prompt Builder                          ① [X] │
├────────────────────────────────────────────────┤
│                                                │
│  ② [🎲 Surprise Me]                            │
│                                                │
│  ═══════════════════════════════════════════   │
│                                                │
│  ③ [ Style ]  [ Colors ]  [ My Snippets ]      │
│                                                │
│  ─── Style ─────────────────────────────────   │
│                                                │
│  ④ ┌────────────┐ ┌────────────┐ ┌──────────┐ │
│    │Oil Painting │ │Flat Vector │ │  Anime   │ │
│    └────────────┘ └────────────┘ └──────────┘ │
│    ┌────────────┐ ┌────────────┐ ┌──────────┐ │
│    │Watercolor  │ │ 3D Render  │ │ Pixel Art│ │
│    └────────────┘ └────────────┘ └──────────┘ │
│    ┌────────────┐ ┌────────────┐ ┌──────────┐ │
│    │Photography │ │  Pencil    │ │ Pop Art  │ │
│    └────────────┘ └────────────┘ └──────────┘ │
│                                                │
│  ═══════════════════════════════════════════   │
│                                                │
│  ⑤ Current Prompt:                             │
│  ┌────────────────────────────────────────┐    │
│  │ A fox, oil painting, warm colors       │    │
│  └────────────────────────────────────────┘    │
│                                                │
│  ⑥ [Done]                                      │
│                                                │
└────────────────────────────────────────────────┘
```

**Annotations:**
- ① Close button
- ② `surprise-me-btn`: Randomizes selection across all categories. Shows confirmation if options are already selected: "Replace current selections?"
- ③ `category-tab`: Tabs to switch between Style, Colors, My Snippets
- ④ `option-chip`: 3x3 grid of text labels per category. Click toggles selection (adds/removes snippet from prompt)
- ⑤ Live preview of current prompt (editable)
- ⑥ Done button closes drawer

### State Variations

| State | Visual Change |
|-------|---------------|
| `colors-tab` | Grid shows 9 color options (e.g., "Warm Tones", "Pastel", "Monochrome", etc.) |
| `my-snippets-tab` | Shows user-created snippets grouped by category + "New Snippet" button (see next screen) |
| `chip-selected` | Selected `option-chip` has distinct visual highlight (border/background) |
| `surprise-me-confirm` | If options already selected: inline confirmation "Replace current selections?" with Confirm/Cancel before randomizing |
| `surprise-me-applied` | Random chips highlighted across categories, prompt updated |

---

## Screen: My Snippets Tab (within Prompt Builder)

**Context:** Inside the Prompt Builder drawer, "My Snippets" tab selected. Shows user-created snippets and inline form for creating new ones.

### Wireframe

```
┌────────────────────────────────────────────────┐
│  Prompt Builder                            [X] │
├────────────────────────────────────────────────┤
│                                                │
│  [🎲 Surprise Me]                              │
│                                                │
│  [ Style ]  [ Colors ]  [▸ My Snippets ◂]      │
│                                                │
│  ─── My Snippets ──────────────────────────    │
│                                                │
│  ① [+ New Snippet]                             │
│                                                │
│  ② ┌──────────────────────────────────────┐    │
│    │ Snippet: [________________________] │    │
│    │ Category: [ POD Basics       ▼    ] │    │
│    │                       [Save]        │    │
│    └──────────────────────────────────────┘    │
│                                                │
│  ─── POD Basics ────────────────────────────   │
│                                                │
│  ③ ┌───────────────────────┐ ┌───────────────────┐  │
│    │white background,    ④│ │centered, clean  ④│  │
│    │centered         ✎ 🗑│ │lines          ✎ 🗑│  │
│    └───────────────────────┘ └───────────────────┘  │
│                                                │
│  ─── My Styles ─────────────────────────────   │
│                                                │
│  ③ ┌───────────────────────┐                      │
│    │retro vintage look  ④│                      │
│    │                  ✎ 🗑│                      │
│    └───────────────────────┘                      │
│                                                │
│  ═══════════════════════════════════════════   │
│  Current Prompt:                               │
│  ┌────────────────────────────────────────┐    │
│  │ A fox, white background, centered      │    │
│  └────────────────────────────────────────┘    │
│  [Done]                                        │
│                                                │
└────────────────────────────────────────────────┘
```

**Annotations:**
- ① `new-snippet-btn`: Toggles inline snippet form visibility
- ② `snippet-form`: Text input for snippet + category dropdown (select existing or type new). Save button creates snippet.
- ③ `snippet-chip`: User-created snippets grouped by category. Click toggles selection (same behavior as built-in option chips)
- ④ Edit/Delete icons: Visible on hover over snippet chip. Edit opens form pre-filled, Delete shows inline confirmation.

### State Variations

| State | Visual Change |
|-------|---------------|
| `form-hidden` | ② not rendered, only "New Snippet" button visible |
| `form-visible` | ② visible with empty fields, auto-focused on snippet input |
| `form-editing` | ② visible, pre-filled with existing snippet data. Save updates instead of creating |
| `no-snippets` | No category groups shown. Message: "No snippets yet. Create your first!" |
| `snippet-hover` | Edit (✎) and Delete (🗑) icons appear on hovered snippet chip |
| `snippet-confirm-delete` | Inline confirmation on the chip: "Delete?" with Confirm/Cancel |

---

## Screen: LLM Prompt Improvement

**Context:** Inline panel below the prompt textarea in the workspace. Appears when user clicks "Improve Prompt" button.

### Wireframe

```
┌─────────────────────────────────────────────────────────────────┐
│  [... Model Dropdown ...]                                       │
│                                                                 │
│  [... Prompt Textarea ...]                                      │
│                                                                 │
│  [Generate]  [Prompt Builder]  [Improve Prompt ⟳]               │
│                                                                 │
│  ═══ Prompt Comparison ═══════════════════════════════════════  │
│                                                                 │
│  ① ┌──────────────────────┐  ② ┌──────────────────────────┐    │
│    │ Original              │    │ Improved                  │    │
│    │─────────────────────  │    │──────────────────────────│    │
│    │                       │    │                          │    │
│    │ A fox in oil          │    │ A majestic red fox       │    │
│    │ painting style        │    │ rendered in classical     │    │
│    │                       │    │ oil painting technique,   │    │
│    │                       │    │ rich impasto brushwork,   │    │
│    │                       │    │ warm amber lighting       │    │
│    └──────────────────────┘    └──────────────────────────┘    │
│                                                                 │
│  ③ [Adopt]  ④ [Discard]                                        │
│                                                                 │
│  ═══ Parameters ════════════════════════════════════════════    │
│  [... Parameter Panel ...]                                      │
└─────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① Original prompt (readonly)
- ② Improved prompt from LLM (readonly, appears after LLM responds)
- ③ `adopt-btn`: Replaces original prompt with improved version, closes panel
- ④ `discard-btn`: Closes panel, original prompt unchanged

### State Variations

| State | Visual Change |
|-------|---------------|
| `loading` | ② shows skeleton/spinner: "Improving prompt..." |
| `ready` | Both panels visible with content, action buttons enabled |
| `error` | Toast notification: "Prompt improvement failed". Panel closes automatically |

---

## Screen: Confirmation Dialog

**Context:** Centered overlay modal. Used for destructive actions (delete project, delete generation).

### Wireframe

```
┌────────────────────────────────────────┐
│  [... dimmed background ...]           │
│                                        │
│    ┌──────────────────────────────┐    │
│    │                              │    │
│    │  ① Delete Project?           │    │
│    │                              │    │
│    │  ② This will permanently     │    │
│    │  delete "Project A" and      │    │
│    │  all 12 generations.         │    │
│    │                              │    │
│    │     ③ [Cancel]  ④ [Delete]   │    │
│    │                              │    │
│    └──────────────────────────────┘    │
│                                        │
└────────────────────────────────────────┘
```

**Annotations:**
- ① Dialog title (contextual: "Delete Project?" or "Delete Generation?")
- ② Descriptive message with specifics (project name, count of affected items)
- ③ Cancel button (closes dialog, no action)
- ④ Destructive action button (styled as danger/red)

---

## Completeness Check

| Check | Status |
|-------|--------|
| All Screens from UI Layout (Discovery) covered | ✅ (6 screens: Overview, Workspace, Lightbox, Builder, Snippets, LLM Improvement + Confirmation Dialog) |
| All UI Components annotated | ✅ (34/34 components covered: 31 original + rename-project-input, lightbox-prev-btn, lightbox-next-btn) |
| All relevant states visualized | ✅ (state variations documented per screen) |
| No logic/rules duplicated (stays in Discovery) | ✅ |
