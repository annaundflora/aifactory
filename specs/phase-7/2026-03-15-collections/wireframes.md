# Wireframes: Image Collections

**Discovery:** `discovery.md` (same folder)
**Status:** Draft

---

## Component Coverage

| UI Component (from Discovery) | Screen |
|-------------------------------|--------|
| Collection-Navigation | Canvas: Collection-Navigation |
| Collection-Switcher | Canvas: Collection-Navigation (multi) |
| Header View-Switcher | Workspace Header, Collection View Header |
| Sidebar Collection-Item | Sidebar: Collection Items |
| Collection View Grid | Collection View Page |
| Kontextmenue "Zur Collection" | Gallery Context Menu, Canvas Context Menu |
| Sort-Dropdown | Collection View Header |
| Reorder-Drag | Collection View Page (manual sort) |
| Collection-Name-Edit | Collection View Header |

---

## User Flow Overview

```
[Gallery] ──click image──► [Canvas from Gallery] ──close──► [Gallery]
    │                              │
    │                              ├──img2img/variation──► Auto-Create Collection
    │                              │
    │                              └──context menu──► "Add to Collection"
    │
    ├──sidebar click──► [Collection View] ──click image──► [Canvas from Collection] ──close──► [Collection View]
    │                        │
    ├──header dropdown──►    ├──sort/reorder──► [Collection View: Reorder]
    │                        │
    └──context menu──►       └──dissolve──► [Gallery]
       "Show in Collection"

[Sidebar / Header] ──"+ New Collection"──► [Empty Collection View]
```

---

## Screen: Workspace Header — Gallery Mode

**Context:** Top header bar of the workspace. Currently shows only the project name. Now becomes a view-switcher between Gallery and Collections.

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│ ☰ │  ①  Flower Prints ▾                         ② ⚙  ③ ☾  ④ ⋮   │
└──────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `Header View-Switcher`: Project name with dropdown indicator (▾). Click opens collection list
- ② Settings button (existing)
- ③ Theme toggle (existing)
- ④ More menu (existing)

### Header Dropdown (open)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ☰ │  Flower Prints ▾                              ⚙   ☾   ⋮      │
│     ┌─────────────────────────────┐                                  │
│     │ ✓ All Images                │                                  │
│     │ ─────────────────────────── │                                  │
│     │   T-Shirt Design      (5)  │                                  │
│     │   Floral Pattern       (3)  │                                  │
│     │   POD Mockups          (8)  │                                  │
│     │ ─────────────────────────── │                                  │
│     │ + New Collection            │                                  │
│     └─────────────────────────────┘                                  │
└──────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `Header View-Switcher (open)`: Dropdown shows "All Images" (current, checked) + collection list with image counts + "New Collection" action

### State Variations

| State | Visual Change |
|-------|---------------|
| `gallery` | Shows "Project Name ▾" — dropdown indicator subtle |
| `collection` | Shows "← Project Name > Collection Name" — back arrow added |
| `dropdown-open` | Dropdown list visible below header |

---

## Screen: Workspace Header — Collection Mode

**Context:** Header when user has navigated to a Collection View. Shows breadcrumb with back navigation.

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│ ☰ │  ① ← Flower Prints  >  ② T-Shirt Design        ⚙   ☾   ⋮   │
└──────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `Header View-Switcher (back)`: "← Project Name" — click navigates back to Gallery
- ② `Collection-Name-Edit (display)`: Collection name as text, click to enter edit mode

---

## Screen: Sidebar — Collection Items

**Context:** Left sidebar, below the active project. Collections appear as nested sub-items using existing SidebarMenuSub primitives.

### Wireframe (Sidebar expanded)

```
┌────────────────────────┐
│  Projects              │
│ ═══════════════════════│
│  ┌──┐                  │
│  │  │ Sunset Photos    │
│  └──┘                  │
│                         │
│  ┌──┐                  │
│  │▪▪│ ① Flower Prints ⋮│  ◄── active project
│  └──┘                  │
│    ② ├─ T-Shirt Design   (5) ⋮│
│       ├─ Floral Pattern    (3) ⋮│
│       └─ POD Mockups       (8) ⋮│
│                         │
│  ┌──┐                  │
│  │  │ Logo Variants    │
│  └──┘                  │
│                         │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─┐ │
│  │  + New Project     │ │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─┘ │
│ ═══════════════════════│
│  👤 anna@example.com   │
│  ← Back to Overview    │
└────────────────────────┘
```

**Annotations:**
- ① Active project with collections expanded below
- ② `Sidebar Collection-Item`: Collection name + image count + three-dot menu (⋮). Click → navigate to collection route. Also serves as drag-drop target

### Sidebar Collection Item — Dropdown Menu

```
       ├─ T-Shirt Design   (5)  ⋮
                                 ┌──────────────┐
                                 │ Rename       │
                                 │ Dissolve     │
                                 └──────────────┘
```

### Sidebar — Drag & Drop

```
┌────────────────────────┐  ┌────────────────────────────────┐
│  Flower Prints         │  │  Gallery                       │
│    ┌━━━━━━━━━━━━━━━━━┓ │  │                                │
│    ┃ T-Shirt Design ◄╋━━━━━━━━━━ [Dragged Card]           │
│    ┗━━━━━━━━━━━━━━━━━┛ │  │                                │
│    ├─ Floral Pattern   │  │  ┌─────┐ ┌ ─ ─ ┐ ┌─────┐     │
│    └─ POD Mockups      │  │  │ Img │ │ghost│ │ Img │     │
└────────────────────────┘  │  └─────┘ └ ─ ─ ┘ └─────┘     │
                            └────────────────────────────────┘
```

### State Variations

| State | Visual Change |
|-------|---------------|
| `default` | Collection name + count, no highlight |
| `active` | Bold/highlighted — currently viewed collection |
| `drag-over` | Highlighted border/background — valid drop target |
| `collapsed-sidebar` | Collections not visible (icon-only mode) |

---

## Screen: Gallery — Context Menu on Image

**Context:** User right-clicks (or long-presses on mobile) on a GenerationCard in the Gallery grid. Context menu appears with collection actions.

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│  Flower Prints ▾                                    ⚙   ☾   ⋮      │
├──────────────────────────────────────────────────────────────────────┤
│  [All] [txt2img] [img2img] [upscale]                                │
│                                                                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐               │
│  │         │  │         │  │         │  │         │               │
│  │  Img 1  │  │  Img 2  │  │ ① Img 3 │  │  Img 4  │               │
│  │         │  │         │  │  ┌──────────────────────────┐          │
│  └─────────┘  │         │  │  │ Open in Canvas           │          │
│  ┌─────────┐  └─────────┘  │  │ ─────────────────────────│          │
│  │         │  ┌─────────┐  │  │ ② Add to Collection    ▶ ┌────────────────┐
│  │  Img 5  │  │         │  │  │ ③ Show in Collection   ▶ │ T-Shirt Design │
│  │         │  │  Img 6  │  │  │ ④ New Collection         │ Floral Pattern  │
│  │         │  │         │  │  │ ─────────────────────────││ POD Mockups    │
│  └─────────┘  └─────────┘  │  │ Download                 │────────────────│
│                             │  │ Delete                   │ + New Coll.    │
│                             │  └──────────────────────────┘└────────────────┘
│                             └─────────┘                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① Right-clicked image — context menu appears
- ② `Kontextmenue "Zur Collection" (has-collections)`: Submenu with list of existing collections
- ③ `Show in Collection`: Only visible if image belongs to a collection. Submenu if multiple
- ④ `New Collection`: Creates a new collection with this image

### State Variations

| State | Visual Change |
|-------|---------------|
| `no-collections` | Only "New Collection" shown, no "Add to" or "Show in" submenu |
| `has-collections` | "Add to Collection ▶" with submenu listing collections + "New Collection" at bottom |
| `in-collection` | "Show in Collection ▶" visible (submenu if image in multiple collections) |

---

## Screen: Canvas — Collection-Navigation (single collection)

**Context:** Full-screen canvas overlay. Collection-Navigation replaces SiblingThumbnails below the main image. Shown when the current image belongs to a collection.

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ┌──────┐  ┌────────────────────────────────────────────┐   ┌─────┐ │
│  │ Var. │  │                                            │   │     │ │
│  │ i2i  │  │                                            │   │Chat │ │
│  │ Upsc │  │              Main Image                    │   │Panel│ │
│  │ Down │  │                                            │   │     │ │
│  │ Del  │  │                                            │   │     │ │
│  │ Info │  └────────────────────────────────────────────┘   │     │ │
│  │      │                                                   │     │ │
│  │ ① +C │  ② [img1] [img2] [●img3] [img4] [img5]          │     │ │
│  │      │     ③ T-Shirt Design                              │     │ │
│  └──────┘                                                   └─────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `Kontextmenue "Zur Collection" (canvas)`: Toolbar button "+C" — opens popover with collection list for adding current image to a collection
- ② `Collection-Navigation`: Horizontal thumbnail strip showing all images in the collection. Current image highlighted (●). Click on thumbnail → navigate to that image
- ③ `Collection-Navigation label`: Collection name displayed below thumbnails. Click → navigate to Collection View

### State Variations

| State | Visual Change |
|-------|---------------|
| `hidden` | No thumbnails, no label (image not in any collection) |
| `visible` | Thumbnail strip + collection name label |
| `multi` | Collection-Switcher dropdown appears above thumbnails |

---

## Screen: Canvas — Collection-Navigation (multiple collections)

**Context:** Same canvas view but the current image belongs to multiple collections. A switcher dropdown appears.

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ┌──────┐  ┌────────────────────────────────────────────┐   ┌─────┐ │
│  │ Var. │  │                                            │   │     │ │
│  │ i2i  │  │              Main Image                    │   │Chat │ │
│  │ ...  │  │                                            │   │     │ │
│  │      │  └────────────────────────────────────────────┘   │     │ │
│  │      │                                                   │     │ │
│  │ +C   │  ① [T-Shirt Design ▾] [Floral Pattern]           │     │ │
│  │      │  ② [img1] [img2] [●img3] [img4] [img5]          │     │ │
│  │      │     T-Shirt Design                                │     │ │
│  └──────┘                                                   └─────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `Collection-Switcher`: Tabs/pills showing collections this image belongs to. Active collection highlighted. Click to switch displayed thumbnails
- ② `Collection-Navigation`: Thumbnails update to show selected collection's images

---

## Screen: Canvas — Context Menu

**Context:** Context menu accessible via toolbar button (+C) in canvas. Allows adding current image to a collection.

### Wireframe

```
  ┌──────┐
  │ Var. │
  │ i2i  │
  │ Upsc │
  │ Down │
  │ Del  │
  │ Info │
  │      │
  │ +C   │──► ┌──────────────────────────┐
  │      │    │ Add to Collection        │
  │      │    │ ─────────────────────────│
  │      │    │   T-Shirt Design    (5)  │
  │      │    │   Floral Pattern    (3)  │
  │      │    │   POD Mockups       (8)  │
  │      │    │ ─────────────────────────│
  │      │    │ + New Collection         │
  └──────┘    └──────────────────────────┘
```

---

## Screen: Collection View — Populated

**Context:** Dedicated route `/projects/[id]/collections/[cid]`. Shows all images in a collection with management actions. Masonry grid layout identical to gallery.

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│ ☰ │ ① ← Flower Prints  >  ② T-Shirt Design  ③ (5) ④ ⋮  ⑤ Sort ▾ │
├──────────────────────────────────────────────────────────────────────┤
│ ⑥ [All] [txt2img] [img2img] [upscale]                 ⑦ + Add     │
│                                                                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐               │
│  │         │  │         │  │         │  │         │               │
│  │ Sketch  │  │         │  │         │  │ Flatlay │               │
│  │         │  │ Mockup  │  │  Model  │  │         │               │
│  └─────────┘  │         │  │  Shot   │  │         │               │
│  ┌─────────┐  │         │  │         │  └─────────┘               │
│  │         │  └─────────┘  └─────────┘                             │
│  │  POD    │                                                        │
│  │         │                                                        │
│  └─────────┘                                                        │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `Header View-Switcher (back)`: "← Project Name" — navigates back to gallery
- ② `Collection-Name-Edit (display)`: Collection name, click to rename (inline edit)
- ③ Image count badge
- ④ Three-dot menu: Dissolve collection (with confirmation dialog)
- ⑤ `Sort-Dropdown`: "Chronological" (default) / "Manual" — switches sort mode
- ⑥ Filter chips: Same mode filters as gallery (reused component)
- ⑦ "Add Images" button: Navigates to gallery for adding more images

### Collection View — Context Menu on Image

```
│  ┌─────────┐  ┌─────────┐
│  │         │  │         │
│  │ Sketch  │  │ Mockup  ──► ┌──────────────────────┐
│  │         │  │         │   │ Open in Canvas       │
│  └─────────┘  │         │   │ ──────────────────── │
│               └─────────┘   │ Remove from Coll.    │
│                             │ ──────────────────── │
│                             │ Add to Collection  ▶ │
│                             │ Download             │
│                             │ Delete               │
│                             └──────────────────────┘
```

### State Variations

| State | Visual Change |
|-------|---------------|
| `loading` | Skeleton grid (shimmer placeholders) |
| `populated` | Masonry grid with GenerationCards |
| `empty` | Empty state message + "Go to Gallery" button (see next wireframe) |
| `reorder` | Cards show drag handles, cursor changes to grab |

---

## Screen: Collection View — Empty State

**Context:** Collection exists but has no images (manually created, or all images removed/deleted from a manual collection).

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│ ☰ │  ← Flower Prints  >  New Collection             ⋮              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                                                                      │
│                                                                      │
│                    ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐                      │
│                    │                          │                      │
│                    │   This collection is     │                      │
│                    │   empty. Add images      │                      │
│                    │   from the gallery.      │                      │
│                    │                          │                      │
│                    │   ┌──────────────────┐   │                      │
│                    │   │  Go to Gallery   │   │                      │
│                    │   └──────────────────┘   │                      │
│                    │                          │                      │
│                    └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘                      │
│                                                                      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Screen: Collection View — Reorder Mode

**Context:** User selected "Manual" in the sort dropdown. Cards now show drag handles and can be rearranged via drag & drop.

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│ ☰ │  ← Flower Prints  >  T-Shirt Design  (5)  ⋮   Sort: Manual ▾ │
├──────────────────────────────────────────────────────────────────────┤
│  [All] [txt2img] [img2img] [upscale]                     + Add     │
│                                                                      │
│  ┌─────────┐  ┌─────────┐  ┌━━━━━━━━━┓  ┌ ─ ─ ─ ─ ┐              │
│  │ ≡       │  │ ≡       │  ┃ ≡       ┃  │         │              │
│  │ Sketch  │  │ Mockup  │  ┃  Model  ┃  │ (drop)  │              │
│  │         │  │         │  ┃  Shot   ┃  │  here   │              │
│  └─────────┘  │         │  ┃ ↕drag   ┃  │         │              │
│  ┌─────────┐  └─────────┘  ┗━━━━━━━━━┛  └ ─ ─ ─ ─ ┘              │
│  │ ≡       │                                                        │
│  │  POD    │                                                        │
│  └─────────┘                                                        │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `Reorder-Drag (dragging)`: Card being dragged shown with bold border
- ② `Reorder-Drag (drag-over)`: Drop target position shown as dashed placeholder
- ③ Drag handle (≡) visible on each card in manual sort mode

---

## Screen: Collection-Name-Edit — Inline Rename

**Context:** User clicks on collection name in Collection View header. Switches to inline edit mode.

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│ ☰ │  ← Flower Prints  >  ┌──────────────────────┐  (5)  ⋮  Sort ▾│
│                            │ T-Shirt Design█      │                  │
│                            └──────────────────────┘                  │
├──────────────────────────────────────────────────────────────────────┤
```

### State Variations

| State | Visual Change |
|-------|---------------|
| `display` | Collection name as plain text, cursor pointer on hover |
| `editing` | Input field with current name, auto-focused, cursor at end. Enter/blur saves. ESC cancels |

---

## Screen: Dissolve Collection — Confirmation Dialog

**Context:** User clicked "Dissolve" from the three-dot menu in Collection View header or sidebar.

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│                         (dimmed background)                          │
│                                                                      │
│         ┌──────────────────────────────────────────┐                │
│         │  Dissolve Collection?                     │                │
│         │                                           │                │
│         │  "T-Shirt Design" will be dissolved.      │                │
│         │  The 5 images will remain in your         │                │
│         │  gallery.                                 │                │
│         │                                           │                │
│         │              ┌──────────┐  ┌──────────┐  │                │
│         │              │  Cancel  │  │ Dissolve │  │                │
│         │              └──────────┘  └──────────┘  │                │
│         └──────────────────────────────────────────┘                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Completeness Check

| Check | Status |
|-------|--------|
| All Screens from UI Layout (Discovery) covered | ✅ Canvas Nav, Collection View, Header, Sidebar |
| All UI Components annotated | ✅ All 9 components from Discovery covered |
| Relevant State Variations documented | ✅ All key states: hidden/visible/multi, empty/populated/reorder, gallery/collection mode, display/editing, drag states |
| No Logic/Rules duplicated (stays in Discovery) | ✅ No business rules in wireframes |
