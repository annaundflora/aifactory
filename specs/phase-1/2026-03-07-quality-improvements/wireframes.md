# Wireframes: Quality Improvements

**Discovery:** `discovery.md` (same folder)
**Status:** Draft

---

## Component Coverage

| UI Component (from Discovery) | Screen |
|-------------------------------|--------|
| Sidebar-Collapse | Workspace (Sidebar Expanded), Workspace (Sidebar Collapsed) |
| Prompt-Tab-Leiste | Workspace Prompt Tab |
| Motiv-Textarea | Workspace Prompt Tab |
| Stil-Textarea | Workspace Prompt Tab |
| Negative-Textarea | Workspace Prompt Tab |
| Template-Selector | Workspace Prompt Tab (Templates) |
| Builder Kategorie-Tabs | Builder Drawer |
| History-Liste | Workspace History Tab |
| History-Eintrag | Workspace History Tab |
| Stern-Toggle | Workspace History Tab, Workspace Favorites Tab |
| Vollbild-Toggle | Lightbox Normal, Lightbox Fullscreen |
| Thumbnail | Home (Project Overview) |
| Thumbnail-Refresh | Home (Project Overview) |

---

## User Flow Overview

```
[Home] ──click project──> [Workspace (Sidebar Expanded)]
                                │
                                ├──collapse──> [Workspace (Sidebar Collapsed)]
                                │
                                ├──tab: History──> [History Tab]
                                │                     │
                                │                     └──click entry──> [Prompt Tab (filled)]
                                │
                                ├──tab: Favorites──> [Favorites Tab]
                                │
                                ├──click Builder──> [Builder Drawer]
                                │                      │
                                │                      └──Done──> [Prompt Tab (style filled)]
                                │
                                ├──click Improve──> [Improve Compare]
                                │                      │
                                │                      ├──Adopt──> [Prompt Tab (improved)]
                                │                      └──Discard──> [Prompt Tab (unchanged)]
                                │
                                ├──click Template──> [Prompt Tab (template filled)]
                                │
                                └──click image──> [Lightbox Normal]
                                                     │
                                                     └──fullscreen toggle──> [Lightbox Fullscreen]
```

---

## Screen: Home (Project Overview)

**Context:** Root page `/`. Grid of project cards with thumbnails.

### Wireframe

```
┌─────────────────────────────────────────────────────────────────┐
│  AI Factory                                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Your Projects                                    [+ New Project]│
│  ───────────────────────────────────────────────────────────────│
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ ①            │  │              │  │              │          │
│  │  ┌────────┐  │  │  ┌────────┐  │  │  ┌────────┐  │          │
│  │  │ thumb- │  │  │  │ thumb- │  │  │  │  ◻    │  │          │
│  │  │  nail  │  │  │  │  nail  │  │  │  │ placeholder│          │
│  │  └────────┘  │  │  └────────┘  │  │  └────────┘  │          │
│  │  Eagle Logos  │  │  POD Designs │  │  New Project │          │
│  │  12 images    │  │  5 images    │  │  0 images    │          │
│  │  01.03.2026   │  │  28.02.2026  │  │  07.03.2026  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① Thumbnail area: Shows generated thumbnail image instead of gray placeholder. Falls back to placeholder icon if generation failed or pending.

### Project Card Hover State

```
┌──────────────┐
│  ┌────────┐  │
│  │ thumb- │ ②│
│  │  nail  │  │
│  └────────┘  │
│  Eagle Logos ③④│
│  12 images    │
│  01.03.2026   │
└──────────────┘
```

**Annotations:**
- ② Thumbnail-Refresh button (rotate icon, appears on hover alongside existing Edit/Delete)
- ③ Edit button (existing, pencil icon)
- ④ Delete button (existing, trash icon)

### State Variations

| State | Visual Change |
|-------|---------------|
| `thumbnail:placeholder` | Gray box with image icon (existing behavior, shown when no thumbnail or failed) |
| `thumbnail:loading` | Gray box with spinner/pulse animation |
| `thumbnail:loaded` | Generated thumbnail image fills the area |
| `thumbnail-refresh:idle` | Rotate icon, normal opacity |
| `thumbnail-refresh:loading` | Rotate icon spinning |

---

## Screen: Workspace (Sidebar Expanded)

**Context:** Project page `/projects/[id]`. Full workspace with sidebar, prompt area, and gallery.

### Wireframe

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌────────────────────────────────────────────────────────────────┐│
│ │ ①        │ │ ② Project: Eagle Logos                                        ││
│ │ Projects │ ├────────────────────────────────────────────────────────────────┤│
│ │ [+ New]  │ │ ┌──────────────────┐ ┌────────────────────────────────────┐   ││
│ │──────────│ │ │ ③               │ │                                    │   ││
│ │          │ │ │ [Prompt][Hist][Fav]│ │  [... Gallery Grid ...]           │   ││
│ │ > Eagle  │ │ │─────────────────│ │                                    │   ││
│ │   POD    │ │ │ ④ Motiv *       │ │  ┌────┐ ┌────┐ ┌────┐ ┌────┐     │   ││
│ │   New    │ │ │ ┌─────────────┐ │ │  │img │ │img │ │img │ │img │     │   ││
│ │          │ │ │ │Describe the │ │ │  │    │ │    │ │    │ │    │     │   ││
│ │          │ │ │ │main subject │ │ │  └────┘ └────┘ └────┘ └────┘     │   ││
│ │          │ │ │ └─────────────┘ │ │  ┌────┐ ┌────┐ ┌────┐           │   ││
│ │          │ │ │─────────────────│ │  │img │ │img │ │img │           │   ││
│ │          │ │ │ ⑤ Style/Modifier│ │  │    │ │    │ │    │           │   ││
│ │          │ │ │ ┌─────────────┐ │ │  └────┘ └────┘ └────┘           │   ││
│ │          │ │ │ │             │ │ │                                    │   ││
│ │          │ │ │ └─────────────┘ │ │                                    │   ││
│ │          │ │ │─────────────────│ │                                    │   ││
│ │          │ │ │ ⑥ Neg. Prompt  │ │                                    │   ││
│ │          │ │ │ ┌─────────────┐ │ │                                    │   ││
│ │          │ │ │ │             │ │ │                                    │   ││
│ │          │ │ │ └─────────────┘ │ │                                    │   ││
│ │          │ │ │═════════════════│ │                                    │   ││
│ │          │ │ │ ⑦ [Model ▼]    │ │                                    │   ││
│ │          │ │ │ ⑧ [Builder][Improve]│                                  │   ││
│ │          │ │ │ ⑨ [Templates]  │ │                                    │   ││
│ │          │ │ │ [... params ...] │                                    │   ││
│ │          │ │ │ ⑩ [1][2][3][4] │ │                                    │   ││
│ │          │ │ │ ⑪ [ Generate ] │ │                                    │   ││
│ │          │ │ └──────────────────┘ └────────────────────────────────────┘   ││
│ │ ⑫       │ │                                                                ││
│ │ Overview │ │                                                                ││
│ └──────────┘ └────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① Sidebar-Collapse toggle (chevron icon at top of sidebar)
- ② Project header with project name
- ③ Prompt-Tab-Leiste: three tabs [Prompt] [History] [Favorites]
- ④ Motiv-Textarea: labeled section "Motiv *" (required), auto-resize, placeholder text
- ⑤ Stil-Textarea: labeled section "Style / Modifier", optional, populated by Builder
- ⑥ Negative-Textarea: labeled section "Negative Prompt", optional, conditionally shown based on model
- ⑦ Model selector dropdown (existing)
- ⑧ Builder and Improve action buttons
- ⑨ Templates button to open template selection
- ⑩ Variant count selector (existing)
- ⑪ Generate button (existing)
- ⑫ Sidebar footer: "Back to Overview" link

---

## Screen: Workspace (Sidebar Collapsed)

**Context:** Same workspace, sidebar collapsed to icon-mode.

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│┌──┐ ┌──────────────────────────────────────────────────────────────────────┐│
││ ① │ │ Project: Eagle Logos                                                ││
││   │ ├──────────────────────────────────────────────────────────────────────┤│
││ E │ │ ┌────────────────────┐ ┌──────────────────────────────────────────┐ ││
││ P │ │ │ [Prompt][Hist][Fav]│ │                                          │ ││
││ N │ │ │────────────────────│ │  [... Gallery Grid ...]                  │ ││
││   │ │ │ Motiv *            │ │                                          │ ││
││   │ │ │ ┌───────────────┐  │ │  More space for gallery                 │ ││
││   │ │ │ │               │  │ │                                          │ ││
││   │ │ │ └───────────────┘  │ │                                          │ ││
││   │ │ │ [... rest ...]     │ │                                          │ ││
││   │ │ └────────────────────┘ └──────────────────────────────────────────┘ ││
││ ② │ │                                                                     ││
│└──┘ └──────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① Sidebar-Collapse toggle (chevron pointing right, expands sidebar on click)
- ② Project initials as icon badges (E = Eagle Logos, P = POD Designs, N = New Project). Active project highlighted. Tooltip with full name on hover.

---

## Screen: Workspace (Mobile - Sidebar as Drawer)

**Context:** Mobile viewport. Sidebar hidden by default, opens as overlay drawer via hamburger menu.

### Wireframe

```
┌─────────────────────┐
│ ① ☰  Eagle Logos    │
├─────────────────────┤
│ [Prompt][Hist][Fav] │
│─────────────────────│
│ Motiv *             │
│ ┌─────────────────┐ │
│ │                 │ │
│ └─────────────────┘ │
│ [... fields ...]    │
│ [ Generate ]        │
│═════════════════════│
│ [... Gallery ...]   │
│ ┌────┐ ┌────┐      │
│ │img │ │img │      │
│ └────┘ └────┘      │
└─────────────────────┘

Hamburger pressed:

┌─────────────────────────────┐
│ ┌───────────┐               │
│ │ Projects  │  (dimmed      │
│ │ [+ New]   │   background) │
│ │───────────│               │
│ │ > Eagle   │               │
│ │   POD     │               │
│ │   New     │               │
│ │           │               │
│ │ ② Overview│               │
│ └───────────┘               │
└─────────────────────────────┘
```

**Annotations:**
- ① Hamburger menu button (replaces sidebar on mobile). Opens sidebar as overlay drawer.
- ② "Back to Overview" link in drawer footer.

### State Variations

| State | Visual Change |
|-------|---------------|
| `mobile-sidebar:closed` | Hamburger icon visible, no sidebar |
| `mobile-sidebar:open` | Sidebar slides in as overlay from left, dimmed backdrop |

---

## Screen: Workspace - History Tab

**Context:** User clicked "History" tab in prompt area. Shows chronological prompt history.

### Wireframe

```
┌────────────────────┐
│ [Prompt][Hist][Fav]│
│────────────────────│
│                    │
│ ① ☆ A majestic    │
│   eagle soaring... │
│   ② FLUX 2 Pro     │
│   ③ 2 hours ago    │
│────────────────────│
│ ① ★ Minimalist    │
│   logo design in...│
│   Recraft V4       │
│   yesterday        │
│────────────────────│
│ ① ☆ Cyberpunk     │
│   cityscape at...  │
│   Seedream 5       │
│   03.03.2026       │
│────────────────────│
│ ① ☆ Watercolor    │
│   landscape with...│
│   FLUX 2 Pro       │
│   01.03.2026       │
│────────────────────│
│   ④ Load more...   │
│                    │
└────────────────────┘
```

**Annotations:**
- ① Stern-Toggle: Star icon (outline = unfavorited, filled = favorited). Click toggles favorite status.
- ② Model name badge
- ③ Relative timestamp
- ④ Load more trigger: loads next 50 entries on scroll or click

### State Variations

| State | Visual Change |
|-------|---------------|
| `history:empty` | Centered text: "No prompts generated yet. Start your first generation!" |
| `history:loaded` | Scrollable list of history entries (initial 50), "Load more" indicator at bottom |
| `history-entry:default` | Star outline (☆), normal text |
| `history-entry:favorited` | Star filled (★), normal text |

---

## Screen: Workspace - Favorites Tab

**Context:** User clicked "Favorites" tab. Shows only favorited prompts.

### Wireframe

```
┌────────────────────┐
│ [Prompt][Hist][Fav]│
│────────────────────│
│                    │
│ ★ Minimalist      │
│   logo design in...│
│   Recraft V4       │
│   yesterday        │
│────────────────────│
│ ★ Abstract neon   │
│   art with glow... │
│   Seedream 5       │
│   25.02.2026       │
│                    │
└────────────────────┘
```

### State Variations

| State | Visual Change |
|-------|---------------|
| `favorites:empty` | Centered text: "No favorites yet. Star prompts in History to save them here." |
| `favorites:loaded` | Filtered list showing only starred entries |

---

## Screen: Workspace - Template Selection

**Context:** User clicked "Templates" button in Prompt tab. Shows predefined template options.

### Wireframe

```
┌────────────────────┐
│ [Prompt][Hist][Fav]│
│────────────────────│
│ Motiv *            │
│ ┌────────────────┐ │
│ │                │ │
│ └────────────────┘ │
│────────────────────│
│ [... fields ...]   │
│════════════════════│
│ [Model ▼]          │
│ [Builder][Improve] │
│ ① [Templates ▼]   │
│ ┌────────────────┐ │
│ │ ② Product Shot │ │
│ │ ③ Landscape    │ │
│ │ ④ Character    │ │
│ │ ⑤ Logo Design  │ │
│ │ ⑥ Abstract Art │ │
│ └────────────────┘ │
│ [1][2][3][4]       │
│ [ Generate ]       │
└────────────────────┘
```

**Annotations:**
- ① Template-Selector button/dropdown trigger
- ②③④⑤⑥ Template options: Click fills all three prompt fields (Motiv with placeholder text, Style pre-filled, Negative set)

### Confirmation Dialog (Template + History Loading)

```
┌──────────────────────────────────────┐
│                                      │
│   ┌──────────────────────────────┐   │
│   │ Replace current prompt?      │   │
│   │──────────────────────────────│   │
│   │ This will replace your       │   │
│   │ current prompt fields.       │   │
│   │ Continue?                    │   │
│   │──────────────────────────────│   │
│   │          [Cancel] [Apply]    │   │
│   └──────────────────────────────┘   │
│                                      │
└──────────────────────────────────────┘
```

Shown when user clicks a template or history entry and any prompt field contains text. Skipped when all fields are empty.

### State Variations

| State | Visual Change |
|-------|---------------|
| `templates:closed` | Templates button shown, dropdown hidden |
| `templates:open` | Dropdown list of template options visible below button |
| `confirm:shown` | Confirmation dialog overlay (used for both template and history loading) |

---

## Screen: Builder Drawer (Pro)

**Context:** Slide-in drawer from right side. Opened by clicking "Builder" button.

### Wireframe

```
                              ┌──────────────────────────────┐
                              │ Prompt Builder            ✕  │
                              ├──────────────────────────────┤
                              │                              │
                              │ ① [Style][Colors][Comp]      │
                              │    [Light][Mood][Snippets]   │
                              │──────────────────────────────│
                              │                              │
                              │ ② Style                      │
                              │                              │
                              │ ┌───────────┐ ┌───────────┐ │
                              │ │Oil Painting│ │Flat Vector│ │
                              │ └───────────┘ └───────────┘ │
                              │ ┌───────────┐ ┌───────────┐ │
                              │ │  Anime    │ │Watercolor │ │
                              │ └───────────┘ └───────────┘ │
                              │ ┌───────────┐ ┌───────────┐ │
                              │ │ 3D Render │ │ Pixel Art │ │
                              │ └───────────┘ └───────────┘ │
                              │ ┌───────────┐ ┌───────────┐ │
                              │ │Photography│ │  Pencil   │ │
                              │ └───────────┘ └───────────┘ │
                              │ ┌───────────┐               │
                              │ │  Pop Art  │               │
                              │ └───────────┘               │
                              │                              │
                              │══════════════════════════════│
                              │ ③ Preview:                   │
                              │ "rendered as a classical oil │
                              │  painting with visible brush-│
                              │  strokes, rich texture, and  │
                              │  dramatic chiaroscuro light" │
                              │──────────────────────────────│
                              │         ④ [ Done ]           │
                              └──────────────────────────────┘
```

**Annotations:**
- ① Builder Kategorie-Tabs: 6 tabs (Style, Colors, Composition, Lighting, Mood, My Snippets). Two rows of tabs.
- ② Option chips for selected category. Each chip is a toggle (selected = filled/highlighted, unselected = outline).
- ③ Live preview showing the composed style text from all selected options across categories (concatenated fragments).
- ④ Done button: closes drawer and writes composed text to Style/Modifier textarea.

### State Variations

| State | Visual Change |
|-------|---------------|
| `chip:unselected` | Outline style, normal text |
| `chip:selected` | Filled/highlighted background, check icon or bold text |
| `preview:empty` | Preview area hidden or shows "Select options to build your style" |
| `preview:filled` | Shows concatenated text of all selected fragments |

---

## Screen: Improve Comparison (Modal)

**Context:** Modal dialog overlay, opened by clicking "Improve" button. Sufficiently wide for side-by-side comparison.

### Wireframe

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐   │
│   │ ① Improve Prompt                                      ✕  │   │
│   ├──────────────────────────────────────────────────────────┤   │
│   │                                                          │   │
│   │  ② Original                    ③ Improved                │   │
│   │  ┌────────────────────────┐    ┌────────────────────────┐│   │
│   │  │A majestic eagle       │    │A majestic bald eagle   ││   │
│   │  │soaring over           │    │soaring gracefully over ││   │
│   │  │mountains              │    │snow-capped mountain    ││   │
│   │  │                       │    │peaks, bathed in golden ││   │
│   │  │                       │    │hour sunlight, dramatic ││   │
│   │  │                       │    │clouds, shot from below ││   │
│   │  │                       │    │with telephoto lens...  ││   │
│   │  └────────────────────────┘    └────────────────────────┘│   │
│   │                                                          │   │
│   │  ④ Optimized for: FLUX 2 Pro                             │   │
│   │──────────────────────────────────────────────────────────│   │
│   │                              ⑤ [ Discard ]  ⑥ [ Adopt ] │   │
│   └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① Modal header "Improve Prompt" with close button
- ② Original prompt text (read-only, left column)
- ③ Improved prompt text (read-only, right column)
- ④ Model-specific note showing which model the improvement was optimized for
- ⑤ Discard button: closes modal, returns to prompt input unchanged
- ⑥ Adopt button: replaces prompt fields with improved version, closes modal

### State Variations

| State | Visual Change |
|-------|---------------|
| `improve:loading` | Modal open, skeleton placeholder in right column, "Improving prompt..." text, left column shows original |
| `improve:compare` | Side-by-side as shown above with Adopt/Discard buttons |
| `improve:error` | Toast notification, modal closes automatically |

---

## Screen: Lightbox (Normal Mode)

**Context:** Overlay on workspace. Shows selected image with details panel. Existing layout with new fullscreen toggle.

### Wireframe

```
┌────────────────────────────────────────────────────────────────────┐
│                                                          ① ⛶  ✕  │
│                                                                    │
│                                                                    │
│  ◄              ┌───────────────────────┐          ┌────────────┐ │
│                 │                       │          │ ② Details  │ │
│                 │                       │          │────────────│ │
│                 │                       │          │ Prompt:    │ │
│                 │       Image           │          │ A majestic │ │
│                 │     (max 70vh)        │          │ eagle...   │ │
│                 │                       │          │            │ │
│                 │                       │          │ Model:     │ │
│                 │                       │          │ FLUX 2 Pro │ │
│  ►              └───────────────────────┘          │            │ │
│                                                    │ Dimensions:│ │
│                                                    │ 1024x1024  │ │
│                                                    │            │ │
│                                                    │ [Variation]│ │
│                                                    │ [Download] │ │
│                                                    └────────────┘ │
│                                                                    │
│                                                         [Delete]   │
└────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① Vollbild-Toggle: Expand icon (⛶). Switches to fullscreen mode. Positioned next to close button (✕).
- ② Details panel (existing): shows prompt, model, dimensions, action buttons.

---

## Screen: Lightbox (Fullscreen Mode)

**Context:** Fullscreen view after clicking expand toggle. Image fills viewport, no details panel.

### Wireframe

```
┌────────────────────────────────────────────────────────────────────┐
│                                                          ① ⛶  ✕  │
│                                                                    │
│                                                                    │
│                                                                    │
│  ◄         ┌───────────────────────────────────────────┐           │
│            │                                           │           │
│            │                                           │           │
│            │                                           │           │
│            │              Image                        │           │
│            │          (100% viewport)                   │           │
│            │         (object-contain)                   │           │
│            │                                           │           │
│            │                                           │           │
│            │                                           │           │
│  ►         └───────────────────────────────────────────┘           │
│                                                                    │
│                                                                    │
│                                                                    │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① Vollbild-Toggle: Compress icon (returns to normal view). Same position as in normal mode. Close button (✕) also visible.

### State Variations

| State | Visual Change |
|-------|---------------|
| `lightbox:normal` | Image at max 70vh, details panel visible on right, expand icon |
| `lightbox:fullscreen` | Image fills viewport (object-contain), no details panel, compress icon, black background |

---

## Completeness Check

| Check | Status |
|-------|--------|
| All UI Components from Discovery covered | Yes |
| All relevant states visualized | Yes |
| All screens from UI Layout (Discovery) covered | Yes |
| No logic/rules duplicated (stays in Discovery) | Yes |
