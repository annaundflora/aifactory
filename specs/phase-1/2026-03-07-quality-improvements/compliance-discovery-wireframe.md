# Gate 0: Discovery <-> Wireframe Compliance

**Discovery:** `specs/phase-1/2026-03-07-quality-improvements/discovery.md`
**Wireframes:** `specs/phase-1/2026-03-07-quality-improvements/wireframes.md`
**Pruefdatum:** 2026-03-07
**Re-Check:** Verifikation der 2 vorherigen Blocking Issues + vollstaendige Neupruefung

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 33 |
| Auto-Fix Needed | 3 |
| Blocking | 0 |

**Verdict:** APPROVED (Blocking = 0)

**100% Compliance:** Keine Warnings - alles wird gefixt oder blockiert.

---

## Previous Blocking Issues - Verification

| # | Issue | Fix Applied | Verification | Status |
|---|-------|-------------|--------------|--------|
| 1 | History Tab: Scroll-to-load-more not visualized | Wireframe now shows "(4) Load more..." indicator at bottom of History list + state variation "history:loaded" mentions "Load more indicator at bottom" | RESOLVED | PASS |
| 2 | Mobile Sidebar Drawer not visualized | New wireframe screen "Workspace (Mobile - Sidebar as Drawer)" added with hamburger menu, overlay drawer, dimmed backdrop, state variations for open/closed | RESOLVED | PASS |

Both previously blocking issues have been correctly resolved.

---

## A) Discovery -> Wireframe

### User Flow Coverage

| Discovery Flow | Steps | Wireframe Screens | Status |
|----------------|-------|-------------------|--------|
| Flow 1: Strukturiertes Prompt eingeben | 5 | Workspace Prompt Tab (expanded + collapsed + mobile) | PASS |
| Flow 2: Builder Pro nutzen | 5 | Builder Drawer | PASS |
| Flow 3: Improve nutzen | 8 | Improve Comparison Modal (loading + compare + error states) | PASS |
| Flow 4: Prompt aus History laden | 4 | History Tab, Confirmation Dialog | PASS |
| Flow 5: Prompt als Favorit markieren | 3 | History Tab (Stern-Toggle), Favorites Tab | PASS |
| Flow 6: Template verwenden | 5 | Template Selection, Confirmation Dialog | PASS |
| Flow 7: Lightbox Vollbild | 5 | Lightbox Normal, Lightbox Fullscreen | PASS |
| Flow 8: Sidebar einklappen | 4 | Workspace Expanded, Workspace Collapsed | PASS |
| Flow 9: Projekt-Thumbnail | 5 | Home (Project Overview), Hover State | PASS |

### UI State Coverage

| Component | Discovery States | Wireframe States | Missing | Status |
|-----------|------------------|------------------|---------|--------|
| Motiv-Textarea | empty, filled | Shown with placeholder | -- | PASS |
| Stil-Textarea | empty, filled, builder-filled | Shown empty + builder preview | -- | PASS |
| Negative-Textarea | empty, filled | Shown (conditional on model) | -- | PASS |
| Prompt-Tab-Leiste | prompt, history, favorites | 3 tabs shown across screens | -- | PASS |
| History-Liste | empty, loaded | Both states documented | -- | PASS |
| History-Eintrag | default, favorited | Star outline/filled shown | -- | PASS |
| Stern-Toggle | unfavorited, favorited | Star outline/filled shown | -- | PASS |
| Vollbild-Toggle | normal, fullscreen | Both modes shown (expand/compress icons) | -- | PASS |
| Sidebar-Collapse | expanded, collapsed | Both modes shown | -- | PASS |
| Sidebar Mobile | drawer open, drawer closed | Both states in mobile wireframe | -- | PASS |
| Thumbnail | placeholder, loading, loaded, error | placeholder, loading, loaded shown; error falls back to placeholder | -- | PASS |
| Thumbnail-Refresh | idle, loading | Both shown in state variations | -- | PASS |
| Template-Selector | closed, open | Both shown in state variations | -- | PASS |
| Builder Kategorie-Tabs | style, colors, composition, lighting, mood, snippets | 6 tabs shown in two rows | -- | PASS |
| Improve Modal | loading, compare, error | All 3 in state variations | -- | PASS |
| Favorites-Liste | empty, loaded | Both states documented | -- | PASS |

### Interactive Elements

| Discovery Element | Wireframe Location | Annotation | Status |
|-------------------|-------------------|------------|--------|
| Motiv-Textarea | Workspace Prompt Tab | Annotation 4 | PASS |
| Stil-Textarea | Workspace Prompt Tab | Annotation 5 | PASS |
| Negative-Textarea | Workspace Prompt Tab | Annotation 6 | PASS |
| Model Selector | Workspace Prompt Tab | Annotation 7 | PASS |
| Builder Button | Workspace Prompt Tab | Annotation 8 | PASS |
| Improve Button | Workspace Prompt Tab | Annotation 8 | PASS |
| Templates Button | Workspace Prompt Tab | Annotation 9 | PASS |
| Generate Button | Workspace Prompt Tab | Annotation 11 | PASS |
| Variant Count | Workspace Prompt Tab | Annotation 10 | PASS |
| Sidebar-Collapse Toggle | Workspace Sidebar | Annotation 1 (expanded + collapsed) | PASS |
| Sidebar Mobile Hamburger | Workspace Mobile | Annotation 1 | PASS |
| Vollbild-Toggle | Lightbox Normal + Fullscreen | Annotation 1 (both screens) | PASS |
| Stern-Toggle | History Tab | Annotation 1 | PASS |
| Builder Done | Builder Drawer | Annotation 4 | PASS |
| Adopt Button | Improve Modal | Annotation 6 | PASS |
| Discard Button | Improve Modal | Annotation 5 | PASS |
| Thumbnail-Refresh | Home Hover State | Annotation 2 | PASS |
| Scroll-to-load-more (History) | History Tab | Annotation 4 | PASS |

---

## B) Wireframe -> Discovery (Auto-Fix Rueckfluss)

### Visual Specs

| Wireframe Spec | Value | Discovery Section | Status |
|----------------|-------|-------------------|--------|
| Lightbox normal image size | max 70vh | UI Components table mentions "max 70vh" for Lightbox-Image state normal | PASS |
| Lightbox fullscreen background | black background | UI Layout Lightbox section mentions "schwarzer Hintergrund" | PASS |
| Lightbox fullscreen image sizing | object-contain | UI Layout Lightbox section states "object-contain" | PASS |
| Lightbox fullscreen image scale | 100% Viewport | UI Layout Lightbox states "100% Viewport" | PASS |
| Builder tabs layout | Two rows (3+3) | UI Components table: "6 Tabs in 2 Reihen (3+3)" | PASS |
| Sidebar expanded width | w-64 | Discovery State Machine has "w-64" | PASS |
| Sidebar collapsed mode | Icon badges with initials | Discovery mentions "Icon-Mode" | PASS |
| Thumbnail area | Image replaces placeholder | Discovery UI Components table covers states | PASS |
| Confirmation Dialog text | "Replace current prompt?" | Discovery Business Rules covers semantically | PASS |
| Mobile sidebar trigger | Hamburger menu button | Not explicitly in Discovery UI Components table | Auto-Fix Needed |
| Mobile sidebar behavior | Overlay drawer from left, dimmed backdrop | Not explicitly in Discovery UI Layout | Auto-Fix Needed |
| History load-more batch size | 50 entries per batch | Discovery Business Rules: "Batches von 50" | PASS |
| Improve loading state | Skeleton placeholder in right column | Discovery State Machine: "Loading-Skeleton" | PASS |

### Implicit Constraints

| Wireframe Shows | Implied Constraint | Discovery Section | Status |
|-----------------|-------------------|-------------------|--------|
| Improve modal sufficiently wide for side-by-side | Modal needs min-width for two columns | Discovery says "Modal" but no width constraint | PASS (responsive, not critical) |
| Builder chips as toggles with check/bold | Visual feedback for selected state | Discovery UI Components has "Toggle" type | PASS |
| Project initials as icon badges in collapsed sidebar | Extract initials from project name | Discovery State Machine says "Icon-Mode" | PASS (implementation detail) |
| Tooltip on collapsed sidebar icons | Hover shows full project name | Not in Discovery | PASS (standard UX pattern) |
| Close button on Builder Drawer | X button top-right | Discovery mentions "Schliessen" in transitions | PASS |
| Mobile: prompt area stacked above gallery | Vertical layout on mobile | Not explicitly in Discovery UI Layout | Auto-Fix Needed |

---

## C) Auto-Fix Summary

### Discovery Updates Needed

| Section | Content to Add |
|---------|---------------|
| UI Components & States table | Add row for Mobile Hamburger Menu: type "IconButton", location "Workspace Header (mobile)", states "visible (mobile), hidden (desktop)", behavior "Opens sidebar as overlay drawer" |
| UI Layout > Workspace | Add mobile layout description: "Mobile: Hamburger-Button im Header, Sidebar als Overlay-Drawer von links, Prompt-Bereich und Gallery vertikal gestapelt" |
| UI Layout > Workspace | Add responsive breakpoint note: "Mobile breakpoint: Sidebar wird zu Drawer, Layout wechselt zu single-column" |

**Note:** These are non-blocking documentation gaps. The wireframe correctly visualizes the mobile behavior. Discovery should be updated to match, but this does not block architecture.

### Wireframe Updates Needed (Blocking)

| Screen | Missing Element | From Discovery |
|--------|-----------------|----------------|
| -- | -- | -- |

**No blocking wireframe issues found.**

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Required Discovery Updates:** 3 (Auto-Fix, non-blocking)
**Required Wireframe Updates:** 0

**Next Steps:**
- [ ] Discovery: Add mobile hamburger menu to UI Components & States table
- [ ] Discovery: Add mobile layout description to UI Layout > Workspace section
- [ ] Discovery: Add responsive breakpoint note to UI Layout > Workspace section
