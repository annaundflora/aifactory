<!-- AGENT_DEF_LOADED: ux-expert-review-de-v1 -->

# UX Expert Review: Generation UI Improvements

## Summary

**Verdict:** CHANGES_REQUESTED

| ID | Title | Severity |
|----|-------|----------|
| F-1 | Checkbox click vs. card click collision on GenerationCard | Critical |
| F-2 | Lightbox compare-collect mode has no cancel/exit path | Critical |
| F-3 | No "Select All" affordance for bulk operations | Improvement |
| F-4 | Compare button state undefined for exactly 1 or 5+ selected images | Improvement |
| F-5 | Aspect Ratio / Size default selection unclear after model switch | Improvement |
| F-6 | Floating Action Bar obscures bottom gallery rows | Improvement |
| F-7 | Compare modal lacks prompt/model metadata for meaningful comparison | Suggestion |
| F-8 | Lightbox move success feedback and post-navigation undefined | Suggestion |

**Totals:** 2 Critical, 4 Improvement, 2 Suggestion

**Overall Assessment:** The concept is well-researched and covers a broad set of genuine user needs. The core ideas (Aspect Ratio chips, Bulk Select, Compare View) follow established patterns (Google Photos, PatternFly) and will meaningfully improve the generation workflow. However, two interaction conflicts need resolution before implementation can proceed safely, and several interaction details require clarification to avoid ambiguity during development.

---

## Workflow Analysis

### State Machine Review

The state machine is largely sound. All five states are reachable and have exit paths. Key observations:

**Reachability:** All states are reachable from `gallery-default`. The `lightbox-compare-collect` state is reachable through a multi-step path (gallery-default -> lightbox -> compare-collect), which is acceptable.

**Exit paths verified:**
- `gallery-default` -- OK (entry state, multiple exits)
- `gallery-selecting` -- OK (cancel, last deselect, or action completion returns to default)
- `compare-grid` -- OK (X-close returns to gallery-default)
- `compare-fullscreen` -- OK (ESC/click returns to compare-grid)
- `lightbox-compare-collect` -- **Problem: no explicit cancel path** (see F-2)

**Missing transition:** When compare-modal is closed after being opened from `lightbox-compare-collect`, the next state should be `gallery-default` (per state machine). But the lightbox was open before -- should the user return to lightbox or gallery? This is ambiguous.

---

## Findings

### Finding F-1: Checkbox click vs. card click collision on GenerationCard

**Severity:** Critical
**Category:** Workflow / Interaction Design

**Problem:**
The existing `GenerationCard` is a single `<button>` element that opens the lightbox on click. The new checkbox overlay sits inside this same card area. Discovery defines checkbox click as "select for bulk" and card click as "open lightbox." However, there is no specification for how these two click targets coexist, especially on touch devices where hover is unreliable.

**Context:**
> **From Discovery (line 115-116):**
> ```
> 1. User hovert ueber Bild in Gallery -> Checkbox erscheint oben-links
> 2. User klickt Checkbox -> Bild wird selektiert
> ```
>
> **From Codebase (generation-card.tsx, line 18-23):**
> ```tsx
> export function GenerationCard({ generation, onSelect }: GenerationCardProps) {
>   return (
>     <button
>       type="button"
>       onClick={() => onSelect(generation.id)}
> ```

**Impact:**
On desktop: a click on the checkbox area could bubble up and also trigger lightbox open. On mobile/touch: checkboxes are invisible (no hover state), making bulk select impossible without an alternative entry point.

**Recommendation:**
1. Stop event propagation on checkbox click (`e.stopPropagation()`) -- this is an implementation detail but the wireframe should annotate this interaction explicitly.
2. Define a mobile/touch entry point for bulk select mode. Options: long-press on card enters selection mode (Android pattern), or a persistent "Select" toggle button in the gallery header.
3. In `gallery-selecting` state, make card click toggle selection (not open lightbox) -- this is the Google Photos convention. Lightbox should only open via a separate icon or when not in selecting mode.

**Affects:**
- [x] Wireframe change needed (annotate click target separation + mobile entry)
- [x] Discovery change needed (define mobile bulk-select trigger, define card-click behavior in selecting state)

---

### Finding F-2: Lightbox compare-collect mode has no cancel/exit path

**Severity:** Critical
**Category:** Workflow / State Machine

**Problem:**
Once the user clicks "Compare" in the lightbox (entering `lightbox-compare-collect` state), there is no defined way to cancel this mode and return to normal lightbox view. The user can only move forward (add images, open compare) but never abandon the compare collection. If the user has added 1 image and changes their mind, they are stuck.

**Context:**
> **From Discovery (line 148-153):**
> ```
> Flow 3: Compare aus Lightbox
> 1. User ist in Lightbox -> Klickt "Vergleichen" Button
> 2. Aktuelles Bild wird als erstes Compare-Bild gesetzt
> 3. User navigiert via Lightbox-Navigation und klickt "Hinzufuegen" (max 4)
> 4. Compare-View oeffnet als Fullscreen-Modal
> ```
>
> **From Wireframe (line 401-403):**
> ```
> ④ [ + Add to Compare ]   ⑤ [ Open Compare ]
> ```

**Impact:**
Dead-end state. User with 1 collected image cannot open compare (needs min 2) and has no cancel button. The only implicit exit would be closing the entire lightbox, losing context.

**Recommendation:**
1. Add a "Cancel Compare" link/button to the lightbox compare-collect UI (next to the status bar "Compare: 2/4 selected").
2. Define the transition: `lightbox-compare-collect` + Cancel -> return to normal lightbox state (clear collected images).
3. Update wireframe to show this cancel affordance.

**Affects:**
- [x] Wireframe change needed (add cancel button to compare-collect mode)
- [x] Discovery change needed (add cancel transition in state machine)

---

### Finding F-3: No "Select All" affordance for bulk operations

**Severity:** Improvement
**Category:** Usability

**Problem:**
For galleries with many images (Discovery references "24 images" in the wireframe), selecting all images requires clicking each checkbox individually. The PatternFly bulk selection research cited in Discovery explicitly mentions "Partial/All/None States" as a pattern, but the design omits a "Select All" control.

**Context:**
> **From Discovery (line 375):**
> ```
> [PatternFly Bulk Selection] | Split-Button Pattern, Checkbox in Toolbar, Partial/All/None States
> ```
>
> **From Wireframe (line 221):**
> ```
> 3 selected . Cancel
> ```

**Impact:**
Bulk-delete or bulk-move of an entire project's images becomes tediously manual. This is the primary use case for bulk operations and the design makes it unnecessarily slow.

**Recommendation:**
Add a "Select All" / "Deselect All" toggle in the floating action bar (left side, next to count) or in the gallery header when in selecting mode. The PatternFly split-button pattern from the research is a good reference.

**Affects:**
- [x] Wireframe change needed (add select all affordance)
- [x] Discovery change needed (add select all to available actions)

---

### Finding F-4: Compare button state undefined for exactly 1 or 5+ selected images

**Severity:** Improvement
**Category:** Usability / Error Prevention

**Problem:**
The wireframe states the compare button is "grayed out when 0-1 or 5+ images selected" but neither Discovery nor Wireframe define what feedback the user gets when they try to click a disabled compare button. With 5+ images selected, the user needs to understand *why* compare is unavailable and *what to do about it*.

**Context:**
> **From Wireframe (line 247):**
> ```
> compare-btn-disabled | Compare button grayed out when 0-1 or 5+ images selected
> ```
>
> **From Discovery (line 281):**
> ```
> Compare: Min 2, Max 4 Bilder. Compare-Button in Action Bar nur aktiv bei 2-4 Selektion
> ```

**Impact:**
User selects 6 images expecting to compare them, sees a grayed-out button with no explanation. This violates the principle of constructive error messages.

**Recommendation:**
Add a tooltip on the disabled compare button: "Select 2-4 images to compare" (when <2 or >4 selected). This follows the same tooltip pattern already defined for disabled ratio/size chips.

**Affects:**
- [x] Wireframe change needed (add tooltip annotation for disabled compare button)
- [ ] Discovery change needed

---

### Finding F-5: Aspect Ratio / Size default selection unclear after model switch

**Severity:** Improvement
**Category:** Usability / State Management

**Problem:**
When the user switches models, the schema reloads and incompatible chips become disabled. But the Discovery does not define what happens to the *currently selected* ratio/size if it becomes incompatible with the new model. Does the selection reset? Does it auto-select the nearest compatible option? Does it stay selected but in an invalid state?

**Context:**
> **From Discovery (line 102):**
> ```
> 1. User waehlt Model -> System laedt Model-Schema, filtert kompatible Aspect Ratios und Sizes
> ```
>
> **From Discovery (line 306):**
> ```
> Model-Wechsel | Model-Dropdown | Schema neu laden, Aspect Ratio + Size Chips filtern
> ```

**Impact:**
Without a clear rule, the implementation will either silently keep an invalid selection (leading to generation errors) or reset without user awareness (confusing). Both outcomes degrade trust.

**Recommendation:**
Define a business rule: "If the currently selected ratio/size becomes incompatible after a model switch, auto-select the model's default ratio/size (or the first compatible option) and briefly highlight the changed chip (e.g., pulse animation) so the user notices the change."

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed (add business rule for selection reset on model switch)

---

### Finding F-6: Floating Action Bar obscures bottom gallery rows

**Severity:** Improvement
**Category:** Usability / Layout

**Problem:**
The floating action bar is positioned as "sticky bottom" over the gallery. In a masonry grid that scrolls, the bottom-most images will be partially or fully obscured by the action bar. Users trying to select images at the bottom of the gallery will struggle to see and click checkboxes behind the bar.

**Context:**
> **From Discovery (line 199):**
> ```
> Position: Sticky bottom ueber Gallery, zentriert
> ```
>
> **From Wireframe (line 218-225):**
> ```
> FLOATING ACTION BAR (positioned at bottom of gallery)
> ```

**Impact:**
The last 1-2 rows of images become difficult to interact with during selection mode, precisely when the user needs to interact with them most.

**Recommendation:**
Add bottom padding to the gallery grid equal to the action bar height when in `gallery-selecting` state. This ensures all images remain fully visible and clickable. Annotate this in the wireframe as a layout behavior note.

**Affects:**
- [x] Wireframe change needed (annotate dynamic bottom padding)
- [ ] Discovery change needed

---

### Finding F-7: Compare modal lacks prompt/model metadata for meaningful comparison

**Severity:** Suggestion
**Category:** Usability / Information Architecture

**Problem:**
The compare view shows only images and their pixel dimensions. For a meaningful comparison of generated images, users typically need to see what differed between the generations: prompt variations, model used, or key parameters. Without this context, the compare view is limited to pure visual comparison.

**Context:**
> **From Q&A Log (line 429-430):**
> ```
> Q21: Compare-View: Zusaetzliche Infos pro Bild?
> A: Nur Bild + Dimensions, maximaler Platz fuers Bild
> ```

**Impact:**
Low -- this was a conscious design decision per Q&A #21. However, even a truncated prompt snippet (1 line) below dimensions would significantly increase the compare view's utility without meaningfully reducing image space.

**Recommendation:**
Consider adding an optional "Show details" toggle in the compare modal header that reveals a single-line prompt excerpt and model name below each image. Default off to preserve the "maximum image space" intent.

**Affects:**
- [ ] Wireframe change needed
- [ ] Discovery change needed

---

### Finding F-8: Lightbox move success feedback and post-navigation undefined

**Severity:** Suggestion
**Category:** Usability / Feedback

**Problem:**
After moving a single image from the lightbox (Flow 4), Discovery says "Lightbox schliesst." But it does not specify success feedback (toast? animation?) or what the user sees after the lightbox closes. The moved image should no longer be in the gallery, so the gallery needs to refresh.

**Context:**
> **From Discovery (line 157-159):**
> ```
> Flow 4: Move Einzelbild (aus Lightbox)
> 3. User waehlt Ziel-Projekt -> Bild wird verschoben, Lightbox schliesst
> ```

**Impact:**
Minor -- the existing toast pattern (`sonner` toast, already used for delete errors in lightbox-modal.tsx) provides a natural solution. But without specifying it, the implementation might skip feedback entirely.

**Recommendation:**
Add a success toast after move: "Image moved to '{Project}'" using the existing `toast` from sonner (already imported in lightbox-modal.tsx). Also specify that the gallery should re-fetch/filter the moved image out.

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed (add success feedback to Flow 4)

---

## Scalability & Risks

**Gallery performance with bulk select:** The current `GalleryGrid` uses CSS columns masonry with no virtualization. Adding checkbox overlays and selection state tracking for potentially hundreds of images may impact render performance. This is acceptable for the current scale but should be monitored.

**ZIP generation for bulk download:** Server-side ZIP generation for large images (up to 2048px) could be slow and memory-intensive. Discovery does not define a maximum number of downloadable images or a progress indicator. For V1 this is acceptable, but a progress bar or size limit should be considered if usage grows.

**Aspect Ratio + Size chip filtering complexity:** The two-way dependency (ratio filters sizes, sizes filter ratios) could create edge cases where no valid combination exists for a model. Discovery should confirm this cannot happen given the current model registry.

---

## Strategic Assessment

**Is this the right solution?** Yes. The five slices address real, observed pain points in image generation workflows. The Aspect Ratio/Size chips are a significant UX improvement over exposing raw schema parameters. Bulk operations follow proven patterns. The compare view fills a genuine gap.

**Architecture fit:** The slice dependency graph is clean. Slice 1-3 being independent enables parallel development. Slice 5 depending on Slice 4's selection infrastructure is the correct dependency.

**Pattern consistency:** The design reuses existing patterns well (ConfirmDialog, Select, Dialog/Modal, toast). New patterns (Toggle Chip Group, Floating Action Bar) are justified by their use cases and follow industry standards.

**Risk:** The largest implementation risk is Slice 4 (Bulk Select + Actions) which touches the gallery grid, introduces new state management, and adds 5 different bulk actions. Consider splitting Slice 4 further: 4a (checkbox + selection state + action bar shell) and 4b (individual action implementations).

---

## Positive Highlights

- **Aspect Ratio/Size chip approach** is markedly better than exposing raw width/height inputs. The model-compatibility filtering with disabled states + tooltips is a thoughtful touch.
- **Collapsible Advanced Settings** correctly prioritizes the most common parameters while keeping power-user options accessible.
- **Variant Stepper** replacing button rows is a good space-efficiency improvement.
- **Two entry points for Compare** (bulk + lightbox) acknowledges different user workflows and mental models.
- **Research quality** is excellent -- the PatternFly, Eleken, and Midjourney references directly inform the design decisions.

---

## Verdict

**CHANGES_REQUESTED**

**Reason:** Two critical findings must be resolved:
1. **F-1 (Checkbox/Card click collision):** Without defining how checkbox clicks and card clicks coexist on the same element, the core bulk-select interaction will either break lightbox opening or break image selection. Touch/mobile is entirely unaddressed.
2. **F-2 (Compare-collect dead end):** The lightbox compare-collect mode has no cancel path, creating a state the user cannot exit gracefully.

**Next Steps:**
1. Resolve F-1 by defining click target separation rules and a mobile bulk-select entry point.
2. Resolve F-2 by adding a cancel transition from `lightbox-compare-collect` back to normal lightbox state.
3. Address F-3 through F-6 (Improvements) to strengthen the design before implementation.
4. Re-review after changes.
