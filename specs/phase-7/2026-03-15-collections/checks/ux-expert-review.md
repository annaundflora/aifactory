<!-- AGENT_DEF_LOADED: ux-expert-review-de-v1 -->

# UX Expert Review: Image Collections

**Feature:** Image Collections
**Documents reviewed:** `discovery.md`, `wireframes.md`
**Date:** 2026-03-26
**Reviewer:** UX Expert Agent

---

## Summary

**Verdict:** CHANGES_REQUESTED

| ID | Title | Severity |
|----|-------|----------|
| F-1 | "Add Images" button navigates away with no return path defined | Critical |
| F-2 | Name input step for manual collection creation is unspecified in wireframes | Critical |
| F-3 | Collection-Navigation replaces SiblingThumbnails but leaves images without collections with no canvas navigation at all | Improvement |
| F-4 | No feedback mechanism when image is already in the target collection | Improvement |
| F-5 | Auto-created collection dissolve on "second-to-last image removal" has confusing UX consequences in Collection View | Improvement |
| F-6 | Collapsed sidebar makes drag-to-collection impossible without alternative affordance | Improvement |
| F-7 | Collection View filter chips may produce confusing empty states | Suggestion |
| F-8 | Header View-Switcher dual role (rename trigger vs. dropdown trigger) creates interaction conflict | Improvement |

**Totals:** Critical: 2 | Improvement: 5 | Suggestion: 1

**High-Level Assessment:** The collections concept is well-designed and follows established patterns from Google Photos, Lightroom, and Pinterest. The hybrid auto-create/manual model is a strong fit for the design-evolution workflow. However, two critical gaps in the wireframes -- the undefined "Add Images" return flow and the missing name-input step for manual creation -- would block users from completing core tasks. Several improvement-level issues around edge case handling and interaction consistency should also be addressed before implementation.

---

## Workflow Analysis

### State Machine Completeness

The state machine is well-defined with five states and clear transitions. I traced each flow mentally:

**Flow completeness check:**

| Flow | Start | End | Complete? | Issue |
|------|-------|-----|-----------|-------|
| Auto-create collection (Canvas) | `canvas-*` img2img | `canvas-*` with Collection-Nav | Yes | -- |
| Manual create (from image) | Gallery/Canvas context menu | Collection created, visible in sidebar/header | Partial | Name input step not wireframed (F-2) |
| Manual create (empty) | Sidebar/Header "+ New" | Empty Collection View | Partial | Same name input gap (F-2) |
| Add image to collection | Context menu / drag-drop | Image in collection, toast feedback | Yes | No duplicate guard feedback (F-4) |
| View collection | Sidebar/Header/Context | Collection View page | Yes | -- |
| Collection View to Canvas and back | Click image in collection | Canvas, then back to Collection View | Yes | Browser history-based, sound approach |
| Remove image | Collection View context menu | Image removed from grid | Yes | Auto-dissolve edge case (F-5) |
| Dissolve collection | Three-dot menu | Confirmation dialog, redirect to gallery | Yes | -- |
| Add more images from Collection View | "+ Add" button in header | ??? | No | Return path undefined (F-1) |
| Reorder images | Sort dropdown to "Manual" | Drag handles appear, reorder | Yes | -- |

**State reachability:** All states are reachable. All states have exit paths except the "Add Images" flow which navigates to Gallery but has no defined mechanism to return to the collection context.

---

## Findings

### Finding F-1: "Add Images" button navigates away with no return path defined

**Severity:** Critical
**Category:** Workflow

**Problem:**
The Collection View wireframe shows a "+ Add" button (annotation 7) that "navigates to gallery for adding more images." But neither the discovery nor the wireframe defines what happens after the user reaches the gallery. How does the user know which collection they're adding to? How do they return to the collection? Is the gallery in a special "adding mode" or is it just a normal gallery with the context menu? This is a dead-end workflow -- the user clicks "+ Add," lands in the gallery, and has lost all context of what they were doing.

**Context:**
> **From Wireframe (Collection View, line 358):**
> ```
> "Add Images" button: Navigates to gallery for adding more images
> ```
>
> **From Discovery (Flow 6, line 228):**
> ```
> "Bilder hinzufuegen" Button -> navigiert zur Gallery (Collection bleibt als Ziel im Kontextmenue)
> ```

**Impact:**
Users who want to add images to an existing collection via the dedicated button will lose context. The parenthetical note in Discovery ("Collection bleibt als Ziel im Kontextmenue") hints that the user should use the context menu in gallery, but this is not communicated in the UI. The user has no visual indication that the collection is "pre-selected" or that they should right-click images. This makes the primary "add images" path confusing and potentially a dead end.

**Recommendation:**
Choose one of these approaches and wireframe it explicitly:
1. **Pre-selected collection mode:** Gallery shows a top bar: "Adding to: T-Shirt Design [Done]" -- context menu defaults to the target collection, "Done" returns to collection view.
2. **Side-by-side / drawer:** Gallery opens in a panel or modal while collection view remains visible.
3. **Remove the button entirely:** The context menu and drag-drop already cover adding images. The button creates an expectation that cannot be met without additional UI.

Option 3 is simplest and avoids the problem. Options 1-2 require additional wireframing.

**Affects:**
- [x] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-2: Name input step for manual collection creation is unspecified in wireframes

**Severity:** Critical
**Category:** Workflow

**Problem:**
Discovery Flow 2 states users can create a collection manually via three paths: context menu "New Collection," Sidebar "+ New Collection," and Header Dropdown "+ New Collection." All three mention a "Name-Input (optional, auto-generiert wenn leer)" step. However, none of the wireframes show this name input. The wireframe for the context menu (line 204-207) shows "New Collection" as a simple menu item with no popover, inline input, or dialog. The Header Dropdown (line 75) shows "+ New Collection" as a single action. The Sidebar shows no creation UI at all beyond the nested items.

**Context:**
> **From Discovery (Flow 2, lines 176-182):**
> ```
> "Neue Collection erstellen" waehlen
> Name-Input (optional, auto-generiert wenn leer) -> Collection erstellt mit diesem Bild
> ```
>
> **From Wireframe (Gallery Context Menu, lines 204-207):**
> ```
> | New Collection         |
> ```
> (No name input shown)

**Impact:**
Without a wireframed name-input interaction, developers will have to guess the pattern. Should it be an inline input inside the dropdown? A popover? A dialog? An immediate creation with auto-name followed by inline rename? This ambiguity will lead to inconsistent implementations across the three creation paths or implementation delays.

**Recommendation:**
Add a wireframe for the collection name input. The most consistent approach would be:
- Context menu / Header Dropdown: Clicking "New Collection" immediately creates a collection with an auto-generated name and navigates to the Collection View where the name is in inline-edit mode (reusing the `Collection-Name-Edit` component already wireframed). This avoids interrupting the flow with a dialog and leverages existing patterns.
- Document this explicitly: "New Collection is created with auto-name, user lands on Collection View with name field in edit mode."

**Affects:**
- [x] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-3: Collection-Navigation replaces SiblingThumbnails but leaves images without collections with no canvas navigation at all

**Severity:** Improvement
**Category:** Usability

**Problem:**
Discovery explicitly states: "SiblingThumbnails (Lineage-basiert) wird komplett durch Collection-Navigation ersetzt." The Canvas Collection-Navigation is in state `hidden` when the image is not in any collection. This means that for images generated via txt2img that are not part of any collection (and have never been used for img2img/variation), the canvas shows no navigation thumbnails at all -- a regression from the current experience where SiblingThumbnails shows batch siblings.

Currently, `SiblingThumbnails` shows batch siblings (images generated in the same request) even without any collection. After this change, a user who generates 4 images via txt2img and clicks one will see no way to navigate to the other 3 from canvas, unless they were auto-grouped into a collection (which they would not be, since auto-create only triggers on img2img/variation).

**Context:**
> **From Discovery (line 248):**
> ```
> Kein Bild in Collection: Keine Thumbnails (bewusster Opt-in, keine Fallback-Anzeige)
> ```
>
> **From Discovery (line 250):**
> ```
> SiblingThumbnails (Lineage-basiert) wird komplett durch Collection-Navigation ersetzt
> ```
>
> **From current codebase (`sibling-thumbnails.tsx`, lines 53-59):**
> The component currently renders batch siblings when `batchId` exists.

**Impact:**
Users who generate multiple images per batch (common workflow) lose the ability to quickly flip between results in the canvas. They must close the canvas, return to the gallery, and click the next image. This is a usability regression for a core workflow.

**Recommendation:**
Either:
1. **Keep SiblingThumbnails as fallback:** When an image is not in any collection, fall back to the existing batch-sibling display. This preserves the current experience and makes Collection-Navigation a strict enhancement.
2. **Auto-create collections for batches:** Extend auto-create to also group batch siblings. This would be more consistent but potentially noisy.

Option 1 is simpler and risk-free. The wireframe should show a `fallback` state for Collection-Navigation area when the image has no collection but has batch siblings.

**Affects:**
- [x] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-4: No feedback mechanism when image is already in the target collection

**Severity:** Improvement
**Category:** Usability

**Problem:**
The context menu submenu lists all collections without indicating which ones already contain the image. If a user tries to add an image to a collection it already belongs to, neither the discovery nor the wireframes specify what happens. The unique constraint `(collection_id, generation_id)` will cause a database error, but no UI-level prevention or feedback is defined.

**Context:**
> **From Discovery (Data, line 370):**
> ```
> Unique Constraint: (collection_id, generation_id) -- ein Bild max. einmal pro Collection
> ```
>
> **From Wireframe (Gallery Context Menu, lines 202-207):**
> The submenu shows collection names without any "already added" indicator.

**Impact:**
Users will attempt to add an image to a collection it already belongs to (especially with many collections), receive either no feedback or a confusing error, and lose trust in the feature.

**Recommendation:**
In the "Add to Collection" submenu, show a checkmark or "already added" indicator next to collections that already contain this image. Either disable those items or show a brief toast "Image already in this collection." This is a standard pattern (Google Photos grays out albums an image is already in).

**Affects:**
- [x] Wireframe change needed
- [ ] Discovery change needed

---

### Finding F-5: Auto-created collection dissolve on "second-to-last image removal" has confusing UX consequences in Collection View

**Severity:** Improvement
**Category:** Usability

**Problem:**
When a user removes the second-to-last image from an auto-created collection (leaving only 1 image), the collection auto-dissolves and the user is redirected to the gallery. The state machine defines this transition (line 320). However, the user's mental model will be "I removed one image" -- not "I destroyed the entire collection." This is an implicit destructive action triggered by a non-destructive intent.

The problem is magnified because the user cannot easily distinguish auto-created from manually created collections in the UI. The wireframes show no visual differentiation. So the user cannot predict whether removing an image will dissolve the collection or leave it intact.

**Context:**
> **From Discovery (Business Rules, line 332):**
> ```
> Eine Collection hat mindestens 2 Bilder (Ausnahme: manuell erstellt -- auch leere/1-Bild
> Collections bleiben bestehen. Nur auto-created Collections werden bei <2 aufgeloest)
> ```
>
> **From Discovery (Error Paths, line 234):**
> ```
> Letztes Bild (Nr. 2) aus auto-created Collection entfernen -> Collection wird automatisch aufgeloest
> ```

**Impact:**
Users will be surprised when removing an image causes the entire collection to vanish. Without understanding the auto-created vs. manual distinction, this feels like data loss.

**Recommendation:**
1. **Show a warning before the dissolving removal:** When the user tries to remove the second-to-last image from an auto-created collection, show a confirmation: "Removing this image will dissolve the collection since auto-created collections require at least 2 images. The remaining image will stay in your gallery."
2. **Alternatively:** Add a subtle visual indicator (e.g., a small "auto" badge or different icon) so users can distinguish auto-created from manual collections.

**Affects:**
- [x] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-6: Collapsed sidebar makes drag-to-collection impossible without alternative affordance

**Severity:** Improvement
**Category:** Usability

**Problem:**
Discovery and wireframes define drag-and-drop from gallery to sidebar collection items as a key interaction for adding images to collections. The sidebar state table explicitly acknowledges: "collapsed-sidebar: Collections not visible (icon-only mode)." Discovery line 278 says: "Collapsed Sidebar: Collections nicht sichtbar (Header-Navigation als Alternative)."

The default sidebar state is collapsed (`defaultOpen={false}` in the codebase). This means the most discoverable adding mechanism (drag-and-drop) is unavailable in the default state. The alternative (context menu) works but is less discoverable for first-time users, and the Header Dropdown is view-only (no drop target defined).

**Context:**
> **From codebase (`app/projects/[id]/page.tsx`, line 36):**
> ```tsx
> <SidebarProvider defaultOpen={false}>
> ```
>
> **From Discovery (line 278):**
> ```
> Collapsed Sidebar: Collections nicht sichtbar (Header-Navigation als Alternative)
> ```

**Impact:**
Most users will encounter the feature with a collapsed sidebar and may never discover the drag-to-collection pattern. The context menu is the reliable fallback but requires more steps.

**Recommendation:**
Consider one of:
1. **Auto-expand sidebar during drag:** When a user starts dragging a gallery card, auto-expand the sidebar to reveal collection drop targets (similar to macOS Finder expanding sidebar folders during drag).
2. **Drop on header dropdown:** Allow dropping images onto the header dropdown (which opens on drag-hover to reveal collection targets).
3. **Accept as-is:** Document that drag-drop is a power-user shortcut and the context menu is the primary path. If so, ensure the context menu is highly discoverable (e.g., right-click hint on first use).

Option 1 provides the best experience but adds implementation scope. Option 3 is acceptable if the team is scope-conscious.

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-7: Collection View filter chips may produce confusing empty states

**Severity:** Suggestion
**Category:** Usability

**Problem:**
The Collection View reuses the gallery's filter chips (All / txt2img / img2img / upscale). A collection might contain only img2img and upscale images. If a user clicks the "txt2img" filter, the grid becomes empty. This is different from the gallery empty state (which means "no images generated yet") and different from the collection empty state (which means "no images added yet"). There is no wireframe for a "filtered empty" state in the collection view.

**Context:**
> **From Wireframe (Collection View, line 357):**
> ```
> Filter chips: Same mode filters as gallery (reused component)
> ```
>
> **From Wireframe (State Variations, line 382):**
> Only `loading`, `populated`, `empty`, and `reorder` states are defined.

**Impact:**
Low severity -- users will understand that the filter produced no results. But a "No images match this filter" message (different from the "This collection is empty" message) would prevent momentary confusion.

**Recommendation:**
Add a `filtered-empty` state to the Collection View: "No images match this filter" with a button to clear the filter. This is a minor enhancement and does not block implementation.

**Affects:**
- [x] Wireframe change needed
- [ ] Discovery change needed

---

### Finding F-8: Header View-Switcher dual role (rename trigger vs. dropdown trigger) creates interaction conflict

**Severity:** Improvement
**Category:** Usability

**Problem:**
In the current codebase, clicking the project name in the header triggers inline rename (the `h1` element has `onClick={() => setIsRenaming(true)}`). The new design repurposes this area as a dropdown trigger ("Project Name" with dropdown indicator). This creates an interaction conflict: users who have learned that clicking the project name renames it will now get a dropdown instead.

Additionally, in collection mode the header shows "Project Name > Collection Name" where the collection name is click-to-rename. The project name portion navigates back. So within the same header bar, visually similar text elements have three different click behaviors: navigate back (project name in collection mode), open dropdown (project name in gallery mode), and rename (collection name).

**Context:**
> **From codebase (`workspace-header.tsx`, lines 110-119):**
> ```tsx
> <h1 className="text-xl font-bold truncate cursor-pointer..."
>     onClick={() => { setIsRenaming(true); }}>
>   {project.name}
> </h1>
> ```
>
> **From Wireframe (Header Gallery Mode, line 58):**
> ```
> Header View-Switcher: Project name with dropdown indicator. Click opens collection list
> ```
>
> **From Wireframe (Header Collection Mode, lines 106-107):**
> ```
> "Project Name" -- click navigates back to Gallery
> "Collection Name" -- click to enter edit mode
> ```

**Impact:**
Existing users will be confused when the rename behavior disappears. New users may struggle to understand why similar-looking text does different things depending on context. The dropdown indicator (triangle) helps but is not sufficient if the learned behavior is "click name = rename."

**Recommendation:**
1. Move project rename to the three-dot menu exclusively (it is already there). Remove click-to-rename on the project name text. This frees the name area for navigation/dropdown duties without conflicting affordances.
2. Ensure the dropdown indicator (triangle) is visually distinct and always visible in gallery mode so users understand it is a dropdown, not a label.
3. In collection mode, consider adding a small pencil icon next to the collection name on hover to signal "this is editable" -- differentiating it from the project name which is a navigation link.

**Affects:**
- [x] Wireframe change needed
- [x] Discovery change needed

---

## Scalability & Risks

### Collection Count Growth
The current design shows collections as a flat list in sidebar, header dropdown, and context menu submenus. This works for 3-10 collections per project. At 20+ collections, the header dropdown becomes unwieldy and the context menu submenu requires scrolling. **Risk is low for the target user base** (designers with 5-15 collections per project), but the design should note a future consideration for search/filter within the collection list if usage grows.

### Routing Architecture Shift
The current workspace is a single-page app (`/projects/[id]`) with state-based view switching. Collection View introduces the first sub-route (`/projects/[id]/collections/[cid]`). This is architecturally sound and the right direction, but it means the Canvas behavior must now handle two different "return" targets (gallery page vs. collection page). The browser-history approach described in Discovery is the correct solution, but developers should be aware this is a fundamental change in the navigation model.

### Many-to-Many Complexity
An image belonging to multiple collections creates UI complexity in context menus ("Show in Collection" with submenu) and canvas (Collection-Switcher). The wireframes handle both cases. The risk is that users may lose track of which collections an image belongs to. Consider showing a collection count badge on GenerationCards in the gallery view in a future iteration.

---

## Strategic Assessment

**Is this the right solution?** Yes. The hybrid model (auto-create for design chains + manual curation) is a strong approach that serves both the "I just want to iterate" user (auto-create handles it) and the "I want to organize" user (manual creation). This mirrors how Apple Photos handles Memories (auto) + Albums (manual).

**Pattern choices are sound.** The decision to replace SiblingThumbnails rather than layer on top is bold but correct -- it avoids two competing navigation paradigms in the canvas. The Collection View as a dedicated route (vs. a filtered gallery view) gives it room to grow (export, sharing in future phases).

**What could go wrong?** The biggest risk is the auto-create heuristic being too aggressive or not aggressive enough. If every img2img creates a collection, users will have too many small collections. If the heuristic misses chains (e.g., user does txt2img, closes canvas, opens image again, does img2img), the auto-create may not trigger. The Discovery's rule is clear (check source image's auto-created collections), but edge cases around timing and session boundaries should be tested thoroughly.

---

## Verdict

**CHANGES_REQUESTED**

Two critical findings must be resolved before implementation:
1. **F-1:** The "Add Images" button flow is a dead end. Either define the return path or remove the button.
2. **F-2:** The name input interaction for manual collection creation must be wireframed.

Five improvement findings should be addressed to ensure a polished experience:
3. **F-3:** Canvas navigation regression for non-collection images needs a fallback.
4. **F-4:** "Already in collection" indicator needed in the add-to-collection submenu.
5. **F-5:** Auto-dissolve warning needed when removing second-to-last image.
6. **F-6:** Collapsed sidebar drag-drop limitation should be acknowledged/addressed.
7. **F-8:** Header interaction conflict between rename, dropdown, and navigation.

One suggestion (F-7: filtered-empty state) is non-blocking.

**Next steps:** Address F-1 and F-2 in wireframes and discovery, then re-run this review.
