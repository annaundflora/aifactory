<!-- AGENT_DEF_LOADED: ux-expert-review-de-v1 -->

# UX Expert Review: Multi-Image Referencing

**Feature:** Multi-Image Referencing (Phase 3)
**Reviewed:** 2026-03-11
**Verdict:** CHANGES_REQUESTED

---

## Summary

**Verdict:** CHANGES_REQUESTED

| ID | Title | Severity |
|----|-------|----------|
| F-1 | Panel width jump from 320px to 480px breaks workspace layout | Critical |
| F-2 | Lightbox "As Reference" lacks Favorite button from Discovery spec | Improvement |
| F-3 | Slot re-numbering breaks @-references already typed in prompt | Critical |
| F-4 | No empty state Drop Zone visible by default when Reference Bar expands | Improvement |
| F-5 | Gallery drag-to-slot has no existing drag infrastructure | Improvement |
| F-6 | Collapsible component does not exist in the UI library | Suggestion |
| F-7 | InlineRefTag highlighting inside a textarea is technically non-trivial | Improvement |
| F-8 | RefHintBanner dismissibility not specified | Suggestion |
| F-9 | "No multi-image support" state leaves Generate disabled without clear recovery | Improvement |

**Totals:** 2 Critical, 5 Improvement, 2 Suggestion

The concept is strong and well-thought-out. The hybrid approach of role-based slots with inline @-syntax is the right balance between power and simplicity. However, two critical issues around layout disruption (panel width) and data integrity (@-reference re-numbering) need resolution before implementation. Several improvements address gaps between the specified flows and what the current codebase actually supports.

---

## Workflow Analysis

### State Machine Review

The state machine is well-defined with clear transitions. I walked through every flow mentally:

**Flow 1 (Upload + Assign):** Complete. States cover empty -> uploading -> ready -> dimmed. Collapse/expand is clear.

**Flow 2 (Gallery Drag):** Specified but has no existing technical foundation (see F-5).

**Flow 3 (Lightbox Button):** Complete. Auto-switch to img2img, slot assignment, full-slots toast all covered.

**Flow 4 (@-Syntax):** Specified but has a critical integrity issue when slots are re-numbered (see F-3).

**Flow 5 (Generate):** Complete. Error paths are well-covered with model compatibility warnings.

**Reachability:** All states are reachable. No dead ends -- every state has at least one exit action (Remove, Retry, or mode-switch preserve).

**Recovery:** Mode-switch preserves state (hidden, not destroyed) -- good. Error state allows Retry. Upload cancel is marked "(optional)" which is fine for V1.

---

## Findings

### Finding F-1: Panel width jump from 320px to 480px breaks workspace layout

**Severity:** Critical
**Category:** Inkonsistenz / Skalierung

**Problem:**
The current workspace uses a fixed `w-80` (320px) left panel. Discovery specifies a 480px panel to accommodate reference slot controls. This is a 50% width increase that affects the entire workspace layout, not just this feature.

**Context:**
> **From Discovery (line 334):**
> ```
> Panel-Breite: Prompt-Area Panel ist 480px breit (statt 320px w-80) um genug Platz fuer Referenz-Slots mit allen Controls zu bieten.
> ```
>
> **From Codebase (`workspace-content.tsx`, line 145):**
> ```tsx
> <div className="w-80 shrink-0 overflow-y-auto rounded-xl border border-border/80 bg-card p-4 shadow-sm">
> ```

**Impact:**
On a 1440px display, the gallery area shrinks from ~1108px to ~948px -- a 15% reduction. On a 1280px display the gallery gets ~788px, which starts to compress the masonry grid. Every existing mode (txt2img, upscale) would now have an unnecessarily wide panel when reference slots are not visible. The layout change is global, not scoped to img2img.

**Recommendation:**
Two options:
A) **Conditional width:** Panel stays `w-80` (320px) by default. When img2img mode is active AND references are loaded, panel widens to `w-[480px]` with a smooth transition. This preserves the existing layout for txt2img/upscale.
B) **Responsive slot layout:** Redesign the reference slot to fit within 320px by stacking the Role and Strength dropdowns or using a more compact layout (e.g., single-line with abbreviated labels: "Style | Mod." instead of two separate dropdowns). The 80x80 thumbnail could become 64x64.

Option A is recommended -- it solves the problem without compromising the slot UX.

**Affects:**
- [x] Discovery change needed
- [x] Wireframe change needed

---

### Finding F-2: Lightbox action bar in wireframe omits Favorite button present in current implementation

**Severity:** Improvement
**Category:** Inkonsistenz

**Problem:**
The Discovery spec (line 247-249) shows the lightbox action bar as: `[Variation] [As Reference] [img2img] [Upscale v] [Download] [Favorite] [Delete]`. However, the actual current lightbox implementation (`lightbox-modal.tsx`) does not have a Favorite button -- it has Variation, img2img, Upscale, Download PNG, and Delete. The wireframe (lines 334-339) shows: Variation, As Reference, img2img, Upscale, Download, Delete -- omitting Favorite entirely.

**Context:**
> **From Discovery (line 247):**
> ```
> Bisherig bei img2img:
>   [Variation] [img2img] [Upscale v] [Download] [Favorite] [Delete]
> ```
>
> **From Codebase (`lightbox-modal.tsx`, lines 346-426):**
> The actual implementation has no Favorite button in the lightbox actions.

**Impact:**
Discovery references a Favorite button that does not exist in the current lightbox. This could confuse implementation -- developers may think they need to add Favorite functionality as part of this feature. The wireframe correctly omits it, but now contradicts Discovery.

**Recommendation:**
Update Discovery "Current State" section to accurately reflect the actual current lightbox actions (no Favorite button). This prevents confusion during implementation.

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-3: Slot re-numbering on removal breaks @-references already typed in prompt

**Severity:** Critical
**Category:** Workflow / Usability

**Problem:**
When a user removes a reference slot, remaining slots are re-numbered (Discovery line 304: "nachfolgende Slots ruecken auf, Labels re-nummeriert"). If the user has already typed `@1` and `@2` in their prompt, and then removes slot @1, the former @2 becomes the new @1 -- but the prompt text still contains `@2` which now refers to nothing (or, worse, `@1` in the prompt now silently points to a different image than intended).

**Context:**
> **From Discovery (line 304):**
> ```
> Slot `ready` | Click Remove [x] | Slot verschwindet, nachfolgende Slots ruecken auf | Slot entfernt, Labels re-nummeriert
> ```
>
> **From Discovery (line 322):**
> ```
> Slot-Labels: Automatisch @1 bis @5, basierend auf Position. Re-Nummerierung bei Entfernung.
> ```

**Impact:**
This is a data integrity issue. A user who carefully crafted a prompt like "Take the building from @2 and render in style of @1, colors of @3" will get unpredictable results after removing any slot, because the @-references silently shift. The user may not notice, leading to wasted generations and frustration.

**Recommendation:**
Two options:
A) **Keep labels stable:** When slot @1 is removed, @2 and @3 keep their labels. New additions fill the lowest available number. Labels become sparse (e.g., @2, @3 with no @1). This matches how Midjourney handles --sref removal.
B) **Auto-update prompt text:** When re-numbering occurs, also update @-references in the prompt to match. E.g., removing @1 shifts @2 to @1, and the prompt text's `@2` becomes `@1` automatically. This is more complex but maintains the "always sequential" invariant.

Option A is strongly recommended -- it is simpler, more predictable for the user, and avoids the fragility of auto-editing user text.

**Affects:**
- [x] Discovery change needed
- [x] Wireframe change needed

---

### Finding F-4: No empty slot Drop Zone visible when Reference Bar auto-expands after first upload

**Severity:** Improvement
**Category:** Usability

**Problem:**
Flow 1 describes: user clicks [+ Add], uploads a file, slot @1 appears in "ready" state. But there is no visual affordance for adding a second image beyond the [+ Add] button in the header. The wireframe shows only "ready" slots -- no empty drop zone is shown alongside filled slots. Users who prefer drag-and-drop (especially from Gallery) have no visible target after the first slot is filled.

**Context:**
> **From Discovery (line 259):**
> ```
> ReferenceSlot: `empty` (gestrichelte Umrandung, Drop-Zone)
> ```
>
> **From Wireframe (lines 54-108):**
> The full view wireframe shows 3 ready slots but no trailing empty drop zone.

**Impact:**
Users who discovered drag-and-drop for the first slot will expect to see a next empty zone. Without it, the only way to add more images is via the [+ Add] button, breaking the established interaction pattern within the same session.

**Recommendation:**
Always show one trailing empty drop zone below the last filled slot (when fewer than 5 slots are filled). This creates a persistent drag target and makes the "add more" affordance visible without requiring the user to find the header button. The [+ Add] button remains as a secondary affordance.

**Affects:**
- [x] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-5: Gallery drag-to-slot requires drag infrastructure that does not exist

**Severity:** Improvement
**Category:** Luecke

**Problem:**
Flow 2 specifies dragging images from the Gallery grid into reference slots. The current codebase has no drag-and-drop infrastructure between components. The existing `ImageDropzone` only handles native file drops from the OS file system, not intra-app drag from React components. The `GalleryGrid` and `GenerationCard` components have no `draggable` attribute or drag event handlers.

**Context:**
> **From Discovery (line 114-118):**
> ```
> Flow 2: Gallery-Bild als Referenz nutzen (Drag & Drop)
> 1. User hat Referenz-Slots sichtbar (img2img-Modus)
> 2. User zieht ein Bild aus der Gallery in einen leeren Referenz-Slot
> ```
>
> **From Codebase:** Grep for `drag|onDrag|draggable` across all components returns only `image-dropzone.tsx` (native file drop only).

**Impact:**
Gallery-to-slot drag-and-drop is a significant implementation effort that requires: making gallery cards `draggable`, defining a custom `dataTransfer` format for generation data, and distinguishing native file drops from intra-app drags in the reference slot. This is not impossible but should be acknowledged as non-trivial scope in Slice 7.

**Recommendation:**
For Slice 7, consider shipping the Lightbox "As Reference" button first (simpler, no drag infrastructure needed), and treating Gallery drag-and-drop as an enhancement within the same slice. This ensures the core flow works immediately while the more complex interaction is developed. The implementation slice description should explicitly mention the need for drag infrastructure.

**Affects:**
- [x] Discovery change needed (Slice 7 scope clarification)
- [ ] Wireframe change needed

---

### Finding F-6: Collapsible component does not exist in the UI library

**Severity:** Suggestion
**Category:** Luecke

**Problem:**
The Reference Bar uses a collapsible pattern with expand/collapse states, but no `Collapsible` component exists in the `components/ui/` directory. The only collapsible pattern found is in the Sidebar component, which is a different use case.

**Context:**
> **From Discovery (line 258):**
> ```
> ReferenceBar: Collapsible Section, Toggle via Header-Click
> ```
>
> **From Codebase:** `components/ui/` has no `collapsible.tsx`. shadcn/ui provides a Collapsible primitive (`@radix-ui/react-collapsible`).

**Impact:**
Minor -- shadcn's Collapsible can be installed with a single command (`npx shadcn@latest add collapsible`). This is not a design gap, just a dependency that needs to be added during implementation.

**Recommendation:**
Add `npx shadcn@latest add collapsible` as a pre-requisite for Slice 4. No design changes needed.

**Affects:**
- [ ] Wireframe change needed
- [ ] Discovery change needed

---

### Finding F-7: InlineRefTag highlighting inside a textarea is technically non-trivial

**Severity:** Improvement
**Category:** Usability / Luecke

**Problem:**
The wireframe shows @1, @2, @3 tokens highlighted with role-colored badges inside the prompt textarea. Standard HTML `<textarea>` elements do not support inline rich text rendering. Achieving this requires either: (a) a contenteditable div mimicking a textarea, (b) an overlay technique with a transparent textarea on top of a styled div, or (c) using a rich-text library.

**Context:**
> **From Wireframe (lines 367-371):**
> ```
> Extract the building from [@2] and
> render it in the style of [@1] with
> the color palette of [@3]
> ```
>
> **From Discovery (line 95):**
> ```
> Inline Reference Tag: @1-@5 Tokens im Prompt-Text, visuell hervorgehoben
> ```

**Impact:**
If implemented naively with a contenteditable div, this introduces accessibility regressions (no native textarea behaviors: undo history, spell check, auto-resize pattern currently used). If implemented as an overlay, it requires careful synchronization of scroll position and font metrics. Either approach is significantly more complex than a plain textarea and may introduce subtle bugs.

**Recommendation:**
Consider a phased approach:
- **V1:** No visual highlighting -- @1-@5 are simply typed as plain text. The RefHintBanner already provides discoverability. The mapping to @imageN still works server-side regardless of visual treatment.
- **V2:** Add visual highlighting once the core multi-reference workflow is validated.

This reduces Slice 5 scope significantly and avoids introducing a fragile rich-text-in-textarea pattern. If inline highlighting is considered essential for V1, the discovery should explicitly acknowledge the implementation complexity and recommend a specific technique.

**Affects:**
- [x] Discovery change needed (acknowledge complexity or defer to V2)
- [x] Wireframe change needed (simplify InlineRefTag state if deferred)

---

### Finding F-8: RefHintBanner dismissibility not specified

**Severity:** Suggestion
**Category:** Usability

**Problem:**
The RefHintBanner ("Tip: Use @1, @2, @3 in prompt to reference images") appears whenever references are loaded. There is no specification for dismissing it. For experienced users who understand the @-syntax, this banner becomes visual noise on every session.

**Context:**
> **From Discovery (line 267):**
> ```
> RefHintBanner: Sichtbar wenn Referenz-Bilder geladen sind
> ```

**Impact:**
Minor friction for repeat users. The banner takes vertical space in a potentially crowded 480px panel (or 320px if F-1 is addressed differently).

**Recommendation:**
Add a dismiss [x] button. Persist dismissal in localStorage so it does not reappear. Alternatively, show the banner only for the first 3 sessions or until the user has used @-syntax at least once.

**Affects:**
- [x] Discovery change needed
- [x] Wireframe change needed

---

### Finding F-9: "No multi-image support" state disables Generate without clear recovery path

**Severity:** Improvement
**Category:** Usability

**Problem:**
When a model does not support img2img at all, Discovery specifies: "Warning anzeigen, Referenz-Slots sichtbar aber Generate disabled." The compatibility warning variant for this case (wireframe line 294) says: "Model does not support reference images. Switch to FLUX 2 Pro." However, the wireframe does not show an actionable button to switch models -- just text.

**Context:**
> **From Discovery (line 325):**
> ```
> Kein Multi-Image Support: Wenn Modell gar kein img2img unterstuetzt: Warning anzeigen, Referenz-Slots sichtbar aber Generate disabled.
> ```
>
> **From Wireframe (line 294):**
> ```
> `no-support`: Banner: "Model does not support reference images. Switch to FLUX 2 Pro." Generate button disabled.
> ```

**Impact:**
The user sees a disabled Generate button and a text suggestion to switch models, but has to manually navigate to the model selector to do so. This creates unnecessary friction, especially since the system already knows which model would work.

**Recommendation:**
Add a clickable link or button within the CompatibilityWarning banner that directly switches the model to FLUX 2 Pro (or the most capable compatible model). Pattern: "Model SDXL does not support reference images. [Switch to FLUX 2 Pro]" where the bracketed text is actionable. This is a single-click recovery path.

**Affects:**
- [x] Wireframe change needed
- [x] Discovery change needed

---

## Scalability & Risks

### Panel Vertical Scrolling Pressure

With 5 reference slots (each ~100px tall including dropdowns), the Reference Bar alone consumes ~500px of vertical space, plus the collapsible header (~40px) and hint banner (~40px). Combined with Mode Selector (~50px), Model Card (~60px), three prompt textareas (~200px minimum), and the Generate row (~50px), the total minimum height approaches ~940px. On a 900px viewport, the user cannot see both references and the Generate button simultaneously. The collapsed state mitigates this, but users actively configuring references will have the bar expanded.

**Recommendation:** This is acceptable for V1 given the scrollable panel, but monitor user behavior. If users frequently scroll between references and the Generate button, consider a sticky Generate button at the panel bottom.

### Provider Strategy

The feature is designed around FLUX.2 Edit's prompt-based influence model. When fal.ai is added in later phases with native IP-Adapter weights, the Strength dropdown semantics will change from "prompt hint" to "actual parameter." The 4-level discrete approach (Subtle/Moderate/Strong/Dominant) is a smart abstraction that can map to either model, so forward compatibility is good.

---

## Professional Assessment

This is a well-conceived feature that brings genuine creative power to the AI Image Studio. Several design decisions are praiseworthy:

**Discrete Strength Levels:** Using 4 named levels instead of a continuous slider is honest UX design -- it matches the backend's actual capability (prompt hints, not numeric weights) and prevents the precision-illusion that a 0-100 slider would create.

**Role Color Coding:** Five distinct colors mapped to semantic roles (violet/blue/green/amber/pink) significantly improve scanability when multiple references are configured. The colors are well-chosen to be distinguishable.

**Backward Compatibility:** "1 reference with Content role = classic img2img" is an elegant way to subsume the existing feature without a separate migration path for user mental models.

**Mode-Switch Preservation:** Keeping references alive (hidden) during mode switches is the right call -- it respects the user's work and avoids re-upload friction.

The two critical findings (layout disruption and @-reference integrity on re-numbering) must be resolved before implementation begins, as they affect fundamental aspects of the workspace structure and the core user workflow.

---

## Verdict

**CHANGES_REQUESTED**

**Required before implementation:**
1. **F-1 (Critical):** Resolve panel width strategy -- conditional width or compact slot design
2. **F-3 (Critical):** Switch to stable slot labels (no re-numbering on removal)

**Recommended before implementation:**
3. **F-4 (Improvement):** Add trailing empty drop zone to wireframe
4. **F-5 (Improvement):** Clarify Gallery drag-and-drop implementation scope in Slice 7
5. **F-7 (Improvement):** Defer InlineRefTag highlighting to V2 or specify implementation technique
6. **F-9 (Improvement):** Add actionable model-switch link in "no support" warning
7. **F-2 (Improvement):** Correct Lightbox action bar in Discovery to match actual codebase

**Can be addressed during implementation:**
8. **F-6 (Suggestion):** Install shadcn Collapsible as Slice 4 pre-requisite
9. **F-8 (Suggestion):** Consider dismissible hint banner
