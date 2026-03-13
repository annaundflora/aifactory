<!-- AGENT_DEF_LOADED: ux-expert-review-de-v1 -->

# UX Expert Review: Canvas Detail-View & Editing Flow

**Date:** 2026-03-13
**Reviewer:** UX Expert Agent
**Documents:** `discovery.md`, `wireframes.md`
**Codebase Context:** Verified against existing components, DB schema, server actions

---

## Summary

**Verdict:** CHANGES_REQUESTED

| ID | Title | Severity |
|----|-------|----------|
| F-1 | No batch/sibling concept in DB schema -- siblings query undefined | Critical |
| F-2 | Redo missing from state machine and data model | Critical |
| F-3 | Keyboard shortcut collision: ArrowLeft/Right vs Prev/Next vs Undo | Improvement |
| F-4 | Chat context reset ambiguity on Prev/Next navigation | Improvement |
| F-5 | Variation Popover prompt_strength semantics inverted from existing StrengthSlider | Improvement |
| F-6 | Sidebar + Toolbar + Chat Panel -- canvas squeeze on narrow viewports | Improvement |
| F-7 | Back-button placement inconsistency between main wireframe and toolbar detail | Suggestion |
| F-8 | No "Use as Reference" action in Detail-View toolbar | Suggestion |

**Totals:** 2 Critical, 4 Improvement, 2 Suggestion

**High-Level Assessment:** The concept is strategically sound -- replacing the modal Lightbox with a persistent Canvas-Detail-View is a clear upgrade for iterative workflows, and the Photoshop-toolbar + Chat dual-channel approach is well-researched. However, two critical gaps around data modeling (siblings) and interaction completeness (Redo) need resolution before implementation can proceed safely.

---

## Workflow Analysis

### State Machine Review

The state machine is well-structured with 7 states and clear transitions. Walking through each state:

**Reachability:** All states are reachable. No orphan states.

**Escape routes:** Every state has an exit path. `detail-generating` correctly blocks most actions but transitions cleanly on success/failure.

**One notable gap:** The state machine defines `detail-chat-active` as a separate state, but the transition table shows it can coexist with user actions like Sibling-click (from `detail-idle`). The distinction between `detail-idle` and `detail-chat-active` is blurry -- a user can type in chat while also clicking tools. Discovery handles this implicitly ("Bot verarbeitet" is a sub-state of chat), but this could cause confusion during implementation. This is not a finding since the Discovery acknowledges the chat-active state resolves back to idle on text-only responses, and `detail-generating` is the actual blocking state.

### Flow Completeness

All 5 flows are completable end-to-end. Error paths are defined for generation failure, chat timeout, and upscale unavailability.

**Dead-end check:** The delete flow correctly handles the "last image" edge case (navigate to Gallery). Prev/Next at boundaries hides arrows. No dead ends found.

---

## Findings

### Finding F-1: No batch/sibling concept in DB schema -- siblings query undefined

**Severity:** Critical
**Category:** Gap / Data Architecture

**Problem:**
The sibling concept is central to the Detail-View UX (thumbnail row, variant navigation, undo resulting in "previous sibling group"), yet the DB schema has no field to group generations into batches. The `generations` table has `sourceGenerationId` (parent reference) but no `batchId` or equivalent. When `generateImages()` creates multiple images (count > 1), each gets its own row with no shared identifier linking them as siblings of the same request.

**Context:**
> **From Discovery (line 257):**
> ```
> Sibling-Definition: Alle Bilder derselben Generation-Request (gleicher Batch).
> Folge-Generierungen erzeugen NEUE Sibling-Gruppen.
> ```
>
> **From DB Schema (`lib/db/schema.ts`):**
> ```
> // generations table has: id, projectId, prompt, modelId, status, imageUrl,
> // sourceGenerationId, createdAt, generationMode...
> // NO batchId, NO variantIndex, NO sibling grouping field
> ```

**Impact:**
Without a batch identifier, implementing the siblings thumbnail row requires heuristic queries (same prompt + model + similar timestamp?), which are fragile and produce incorrect groupings. This is the foundation of the Detail-View navigation model -- if siblings cannot be reliably queried, the entire sibling UX breaks down.

**Recommendation:**
Add a `batchId` (UUID) column to the `generations` table. The `generateImages()` server action already creates multiple rows in a loop -- generating a shared `batchId` for all rows in one request is trivial. Sibling query then becomes `WHERE batchId = :currentBatchId`. This is a data-model prerequisite that must be addressed in Discovery before Slice 1.

**Affects:**
- [x] Discovery change needed (Data section, Business Rules)
- [ ] Wireframe change needed

---

### Finding F-2: Redo missing from state machine and data model

**Severity:** Critical
**Category:** Workflow / Interaction Completeness

**Problem:**
The wireframe clearly shows Undo AND Redo buttons (annotation 2: "Undo (Cmd+Z) / Redo (Cmd+Shift+Z) in header area"). However, the Discovery's state machine, business rules, and data model only define an undo stack -- there is no redo stack, no redo transitions, and no redo behavior specified. When a user presses Undo, the popped state vanishes permanently, making Redo impossible.

**Context:**
> **From Wireframe (line 169):**
> ```
> 2 `undo-button`: Undo (Cmd+Z) / Redo (Cmd+Shift+Z) in header area.
>   Disabled when history empty
> ```
>
> **From Discovery (line 270-271):**
> ```
> `undoStack` | Nein | Max 20 Eintraege | Client-State: Array von Generation-IDs
> ```
>
> **From Discovery State Machine (line 234):**
> ```
> `detail-idle` | Undo (Cmd+Z) | Vorheriges Bild erscheint | `detail-idle` |
>   Nur moeglich wenn History-Stack nicht leer
> ```
> No Redo transition exists.

**Impact:**
Users see a Redo button in the UI, press Cmd+Shift+Z, and nothing happens. Worse: if Undo is implemented as a destructive pop (as the data model suggests), Redo becomes technically impossible without a second stack. This is a critical inconsistency between wireframe promise and discovery specification.

**Recommendation:**
Either (A) add a `redoStack` to the data model and define Redo transitions in the state machine ("on Undo, push current to redoStack; on Redo, pop from redoStack and push current to undoStack; clear redoStack on any new generation"), or (B) remove the Redo button from the wireframe if Redo is intentionally out of scope. Option A is strongly recommended -- Undo without Redo violates deep user expectations (every application with Undo supports Redo).

**Affects:**
- [x] Discovery change needed (State Machine, Data, Business Rules)
- [x] Wireframe change needed (if option B)

---

### Finding F-3: Keyboard shortcut collision: ArrowLeft/Right vs Prev/Next vs Undo

**Severity:** Improvement
**Category:** Usability / Interaction Design

**Problem:**
The existing `LightboxNavigation` component uses ArrowLeft/ArrowRight for prev/next image navigation (verified in `lightbox-navigation.tsx` lines 43-54). Discovery states Prev/Next in Detail-View uses the same arrows (line 197: "Pfeiltasten-Support"). However, when a Tool-Popover is open with form fields (e.g., the Prompt textarea in the Variation Popover), ArrowLeft/Right will conflict with text cursor navigation inside the input. Additionally, Cmd+Z for Undo will conflict with text undo inside input fields.

**Context:**
> **From Discovery (line 197):**
> ```
> `prev-next` | Navigation Arrows | Links/Rechts vom Bild |
>   `visible`, `hidden` (wenn erstes/letztes) | Pfeiltasten-Support
> ```
>
> **From existing `lightbox-navigation.tsx` (line 43-49):**
> ```
> if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
> else if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
> ```

**Impact:**
Users editing a prompt in the Variation Popover will accidentally navigate to another image when pressing arrow keys, losing their popover state. Similarly, Cmd+Z in a text field will undo the text edit AND trigger the image undo simultaneously.

**Recommendation:**
Discovery should add a business rule: "Keyboard shortcuts (Arrow keys for Prev/Next, Cmd+Z/Cmd+Shift+Z for Undo/Redo) are suppressed when focus is inside an input/textarea element." This is a common pattern (check `e.target.tagName`) but needs to be explicitly specified to avoid implementation bugs.

**Affects:**
- [x] Discovery change needed (Business Rules)
- [ ] Wireframe change needed

---

### Finding F-4: Chat context reset ambiguity on Prev/Next navigation

**Severity:** Improvement
**Category:** Usability / Conceptual Clarity

**Problem:**
Discovery states that on Prev/Next navigation, "Chat-History bleibt erhalten, Bild-Kontext aktualisiert sich." This means the chat conversation persists, but the `chat-init` context message (model, prompt, params) should update to reflect the new image. However, the implications are under-specified: if a user chatted about Image A ("make background blue"), then navigates to Image B via Prev/Next, the old chat messages about Image A are still visible. The agent now receives Image B as context. If the user continues chatting, the agent acts on Image B, but the chat history reads as a conversation about Image A -- creating cognitive dissonance.

**Context:**
> **From Discovery (line 258):**
> ```
> Bei Wechsel auf anderes Bild (Prev/Next): Chat-History bleibt erhalten,
>   Bild-Kontext aktualisiert sich
> ```

**Impact:**
Users will be confused reading old messages about a different image interspersed with new messages about the current image. This is especially problematic if they navigate multiple times -- the chat becomes an incomprehensible mix of contexts.

**Recommendation:**
Add a visual separator in the chat when the image context changes via Prev/Next: e.g., "--- Context switched to Image B ---" with updated `chat-init` metadata below. This preserves history while making context switches explicit. Alternatively, specify that Prev/Next starts a fresh chat session (clears history), which is simpler but loses continuity. The first option is preferred for transparency.

**Affects:**
- [x] Discovery change needed (Business Rules for Prev/Next chat behavior)
- [x] Wireframe change needed (visual separator element in chat)

---

### Finding F-5: Variation Popover prompt_strength semantics inverted from existing StrengthSlider

**Severity:** Improvement
**Category:** Inconsistency / Usability

**Problem:**
The existing `StrengthSlider` component (`components/workspace/strength-slider.tsx`) uses presets "Subtle" (0.3), "Balanced" (0.6), "Creative" (0.85) -- higher values mean more creative deviation. The Variation Popover wireframe labels its slider as "0.0 = Near Original, 1.0 = Free" which semantically aligns. However, the Discovery (line 111) says "prompt_strength 0.0 = nah am Original, 1.0 = frei", while the existing img2img `strength` parameter in `WorkspaceVariationState` (line 18 of `workspace-state.tsx`) typically means image influence (higher = more change to the source). The new slider introduces a differently-named parameter (`prompt_strength`) with similar-but-subtly-different semantics from the existing `strength` field used in img2img mode, which will confuse both users and developers.

**Context:**
> **From Discovery (line 111):**
> ```
> User stellt prompt_strength ein (0.0 = nah am Original, 1.0 = frei)
> ```
>
> **From existing `strength-slider.tsx` (lines 16-20):**
> ```
> const PRESETS = [
>   { label: "Subtle", value: 0.3 },
>   { label: "Balanced", value: 0.6 },
>   { label: "Creative", value: 0.85 },
> ];
> ```

**Impact:**
Two sliders with near-identical purpose but different names (prompt_strength vs strength) and different presentation (continuous slider vs preset buttons) create unnecessary cognitive load and codebase inconsistency.

**Recommendation:**
Reuse or extend the existing `StrengthSlider` component for the Variation Popover. If the semantics genuinely differ (prompt_strength is an API parameter name), document this clearly in Discovery and keep the user-facing label unified (e.g., both say "Strength" with consistent preset labels). The wireframe should reference the existing component pattern.

**Affects:**
- [x] Discovery change needed (clarify relationship to existing strength concept)
- [ ] Wireframe change needed

---

### Finding F-6: Sidebar + Toolbar + Chat Panel -- canvas squeeze on narrow viewports

**Severity:** Improvement
**Category:** Usability / Layout

**Problem:**
Discovery Q&A #21 confirms the sidebar remains "unchanged, full width" in Detail-View. The sidebar width plus toolbar (48px) plus chat panel (320-480px) leaves the canvas area with limited space. On a 1440px viewport, a typical sidebar (~256px) + toolbar (48px) + chat (350px) = 654px consumed, leaving ~786px for the canvas. On a 1280px viewport, this drops to ~626px. While technically functional, this means the centered image competes heavily for space, especially with siblings below.

**Context:**
> **From Discovery (lines 367):**
> ```
> Q21: Wie verhaelt sich die Sidebar im Detail-View?
> Answer: C) Wie heute (unveraendert). Sidebar bleibt in voller Breite.
> ```
>
> **From Wireframe (line 175):**
> ```
> 8 `chat-panel`: Right side, expanded state. Collapsible via header click.
>   Resizable (320-480px)
> ```

**Impact:**
The primary canvas area -- the central element users are iterating on -- may feel cramped on common laptop resolutions (1366px, 1440px). This undermines the "fullscreen working view" promise, especially compared to competitor tools like Leonardo.ai and Midjourney which maximize image real estate.

**Recommendation:**
Consider auto-collapsing the sidebar when entering Detail-View (expand on return to Gallery). This is a simple state toggle and preserves the "unchanged sidebar" rule for Gallery-View while maximizing canvas space where it matters. The sidebar content (project navigation) is irrelevant during in-image iteration. Alternatively, add this as a user preference or document the rationale for keeping it open.

**Affects:**
- [x] Discovery change needed (revisit Q&A #21 decision)
- [ ] Wireframe change needed

---

### Finding F-7: Back-button placement inconsistency between main wireframe and toolbar detail

**Severity:** Suggestion
**Category:** Inconsistency

**Problem:**
The main Canvas-Detail-View wireframe (line 142) places the back-button in the top-left header area (annotation 1), separate from the toolbar. However, the Toolbar Detail wireframe (line 183) shows the back-button as the first item IN the toolbar (annotation 1). These are two different placements.

**Context:**
> **From Wireframe (line 142):**
> ```
> | [Sidebar]  |1<- Back                                    ...
> ```
> Back-button is in the header row, above the toolbar.
>
> **From Wireframe (line 182-184):**
> ```
> | <- |  1 back-button
> |----|
> | <> |  2 toolbar.variation
> ```
> Back-button is the first toolbar item.

**Impact:**
Minor ambiguity for implementation. Both placements are reasonable -- header placement is more conventional (top-left back navigation), toolbar placement saves vertical space.

**Recommendation:**
Pick one and make it consistent. The header placement (as in the main wireframe) is recommended since it follows web conventions and keeps the toolbar purely for creative tools. Remove the back-button from the Toolbar Detail wireframe.

**Affects:**
- [ ] Discovery change needed
- [x] Wireframe change needed

---

### Finding F-8: No "Use as Reference" action in Detail-View toolbar

**Severity:** Suggestion
**Category:** Gap / Feature Parity

**Problem:**
The existing Lightbox has a prominent "Als Referenz" (Use as Reference) button that lets users add the current image to a reference slot for future img2img generations. The new Detail-View toolbar defines Variation, img2img, Upscale, Download, Delete, and Details -- but no "Use as Reference" action. This is a regression from the current Lightbox functionality.

**Context:**
> **From existing `lightbox-modal.tsx` (lines 126-149):**
> ```
> const handleUseAsReference = useCallback(async () => {
>   // ... adds image to reference slot via setVariation + server action
> });
> ```
>
> **From Discovery (lines 39):**
> ```
> Tools: Variation, img2img + Referenzen, Upscale, Download, Delete
> ```
> No mention of "Use as Reference" in Detail-View scope.

**Impact:**
Users who currently use "Als Referenz" from the Lightbox will lose this workflow. They would need to exit Detail-View, find the image in Gallery, and drag it to a reference slot. This is a regression in a feature that is likely used frequently.

**Recommendation:**
Add a "Use as Reference" icon to the toolbar (between Download and Delete, or as part of the img2img popover). The handler already exists in the codebase and can be reused directly. This is a low-effort addition with high feature-parity value. Could also be deferred as a Suggestion if the team considers it covered by the img2img Popover's reference slots.

**Affects:**
- [x] Discovery change needed (add to toolbar scope)
- [x] Wireframe change needed (add icon to toolbar)

---

## Scalability & Risks

### Undo Stack Scalability

The 20-entry undo limit is reasonable for V1. However, the undo stack stores `Generation-IDs`, meaning it requires re-fetching image URLs on undo. If images are large or CDN-cached, this should be fast. But if the user's session involves rapid iterations (which the feature encourages), the stack will churn frequently. Consider persisting the undo stack to `sessionStorage` (not just React state) to survive accidental page refreshes.

### Chat Session Coupling

The decision to keep chat history when switching images (Prev/Next) is a scalability risk. As users navigate through many images, the chat session accumulates context about multiple different images. The LangGraph agent receives "current image" as context, but the chat history may contain conflicting instructions from previous images. For V1 this is acceptable, but V2 should consider image-scoped chat sessions.

### Popover Pattern Limits

The floating popover pattern works well for Variation (small) and Upscale (tiny), but the img2img popover with 5 reference slots + prompt + strength slider is already "large" by popover standards. As features grow (model selection in popover, advanced parameters), the popover may outgrow its container. The architecture should plan for a potential upgrade path to a slide-over panel.

---

## Strategic Assessment

### Is This the Right Solution?

**Yes, strongly.** The Gallery + Canvas-Detail-View hybrid is the right architecture for an AI image tool at this stage. The research (Leonardo, Midjourney, Ideogram) validates this approach, and the decision to keep Gallery for browsing and Detail-View for iteration correctly separates concerns.

The Photoshop-toolbar pattern is a sound choice -- it maximizes canvas space while keeping tools accessible, and it scales to future tools (Inpainting, Outpainting) without layout changes. The Chat channel as a parallel editing path lowers the articulation barrier as the NNGroup research suggests.

### What Was Done Well

- **Sibling-Thumbnails (E-Commerce pattern):** Universally understood, zero learning curve.
- **Sofort-Replace + Undo:** Bold decision that prioritizes flow over safety. Correct for creative tools.
- **Chat-only-text, Canvas-gets-image:** Avoids the common trap of duplicating the result in chat, keeping the canvas as single source of truth.
- **Scope discipline:** Inpainting/Outpainting correctly deferred. Gallery kept unchanged.
- **Reuse plan:** ProvenanceRow, ReferenceSlots, ConfirmDialog all reused from existing code.

### Strategic Risk

The biggest strategic risk is the **assistant/chat duality.** The codebase already has a `PromptAssistantContext` with its own chat, draft prompts, session management, and "apply to workspace" flow. The new Detail-View chat is a conceptually different agent (image-editing context vs. prompt-crafting context). Discovery correctly notes these are "getrennt" (separated), but the long-term UX question remains: will users understand why there are two different chat interfaces? This is acceptable for V1 but should be tracked as a design debt item.

---

## Verdict

**CHANGES_REQUESTED**

**Blocking issues (must fix before implementation):**
1. **F-1 (Critical):** Add `batchId` to the data model to enable sibling queries. Without this, the sibling UX cannot be implemented reliably.
2. **F-2 (Critical):** Resolve the Undo/Redo inconsistency -- either specify Redo behavior in Discovery or remove Redo from the wireframe.

**Should fix (improve quality):**
3. **F-3:** Document keyboard shortcut suppression when focus is in input fields.
4. **F-4:** Define chat behavior on Prev/Next image switches (separator or session reset).
5. **F-5:** Align Variation strength slider with existing StrengthSlider component.
6. **F-6:** Reconsider sidebar behavior in Detail-View for canvas space optimization.

**Nice-to-have:**
7. **F-7:** Resolve back-button placement in wireframe.
8. **F-8:** Consider adding "Use as Reference" to toolbar for Lightbox feature parity.
