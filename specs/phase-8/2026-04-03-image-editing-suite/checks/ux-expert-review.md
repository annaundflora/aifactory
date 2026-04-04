<!-- AGENT_DEF_LOADED: ux-expert-review-de-v1 -->

# UX Expert Review: AI Image Editing Suite

**Date:** 2026-04-04
**Reviewer:** UX Expert Agent
**Discovery:** `discovery.md`
**Wireframes:** `wireframes.md`

---

## Summary

**Verdict:** CHANGES_REQUESTED

| ID | Title | Severity |
|----|-------|----------|
| F-1 | No way to deactivate an edit mode and return to Idle | Critical |
| F-2 | Click-to-Edit after SAM success silently replaces manually painted mask | Critical |
| F-3 | Outpaint: no validation feedback when submitting prompt without direction selected | Improvement |
| F-4 | Navigation block with no visible escape path | Improvement |
| F-5 | Toolbar mutual exclusivity conflict between existing tools and new edit tools | Improvement |
| F-6 | Erase mode chat panel state is undefined | Improvement |
| F-7 | Outpaint size selector UX: per-direction sizes add complexity without clear justification | Suggestion |
| F-8 | Keyboard shortcuts absent for high-frequency mask painting actions | Suggestion |

**Totals:** 2 Critical, 4 Improvement, 2 Suggestion

**High-Level Assessment:** The concept is strong -- five complementary edit modes, reuse of the existing Canvas Detail-View layout, and a sensible state machine that preserves masks across tool switches. However, two critical gaps in the interaction model (no way to exit edit mode to idle, and silent mask replacement on SAM click) can cause data loss and user confusion. Several UX details around validation feedback and panel state need clarification before implementation.

---

## Workflow Analysis

### State Machine Reachability

I walked through every state and its transitions from the discovery state machine table (lines 228-265):

| State | Enterable from | Exitable to | Issue |
|-------|---------------|-------------|-------|
| `idle` | -- (initial) | `painting`, `click-waiting`, `outpaint-config`, `generating` | Cannot be re-entered once an edit tool is active (see F-1) |
| `painting` | `idle`, `click-waiting`, `sam-processing`, `outpaint-config`, `result` | `generating`, `outpaint-config`, `click-waiting` | Good: reachable from many states. But no transition back to `idle` |
| `click-waiting` | `idle`, `painting`, `outpaint-config`, `result` | `sam-processing`, `painting`, `outpaint-config` | Same: no path back to `idle` |
| `outpaint-config` | `idle`, `painting`, `click-waiting`, `result` | `generating`, `painting`, `click-waiting` | Same: no path back to `idle` |
| `generating` | `painting`, `outpaint-config`, `idle` | `result`, previous state (on error) | Good: bidirectional error recovery |
| `result` | `generating` | `result` (undo), `painting`, `click-waiting`, `outpaint-config` | Good: can start new edits |

**Key observation:** The `idle` state is a one-way door. Once any edit tool is activated, the state machine has no defined transition back to `idle`. The existing toolbar uses a toggle pattern (`SET_ACTIVE_TOOL` toggles off if same tool is clicked again, line 56 of `canvas-detail-context.tsx`), but the discovery state machine does not define this transition. This is Finding F-1.

### Flow Completeness

All five core flows (Inpaint, Erase, Instruction Edit, Click-to-Edit, Outpaint) have complete happy paths with defined error recovery. The instruction editing flow (Flow 3) is notably clean -- it reuses the existing chat without any new UI, which is elegant.

Cross-flow transitions are well-defined: switching from painting to outpaint-config preserves the mask in state but hides it visually. Switching back restores it. This is thoughtful design.

---

## Findings

### Finding F-1: No way to deactivate an edit mode and return to Idle

**Severity:** Critical
**Category:** Workflow

**Problem:**
Once a user activates any edit tool (Brush Edit, Erase, Click Edit, Expand), there is no defined way to return to the plain idle state. The state machine defines transitions between edit modes but never back to `idle`. The existing toolbar uses `SET_ACTIVE_TOOL` with toggle behavior (clicking the same tool again deactivates it), but the discovery state machine omits this transition entirely.

This means: if a user accidentally clicks "Brush Edit", they are stuck in editing mode. They can switch between edit modes but never dismiss the floating toolbar and mask overlay to simply view the image.

**Context:**
> **From Discovery (lines 242-264):**
> ```
> | `idle` | Klick auf brush-edit-btn | ... | `painting` |
> | `painting` | Klick auf expand-btn | ... | `outpaint-config` |
> | `painting` | Klick auf click-edit-btn | ... | `click-waiting` |
> ```
> No transition from `painting`, `click-waiting`, or `outpaint-config` back to `idle`.
>
> **From Codebase (`canvas-detail-context.tsx` line 55-58):**
> ```typescript
> case "SET_ACTIVE_TOOL":
>   return {
>     ...state,
>     activeToolId:
>       state.activeToolId === action.toolId ? null : action.toolId,
>   };
> ```
> The existing reducer already supports toggling off (sets `activeToolId` to `null`).

**Impact:**
Users cannot return to a clean viewing state. The floating toolbar, mask overlay, or direction controls remain permanently visible until the page is navigated away from. This breaks the fundamental "User Control & Freedom" principle.

**Recommendation:**
Add transition rows in the state machine for each edit state back to `idle` when the same tool button is clicked again (toggle-off). The existing `SET_ACTIVE_TOOL` reducer already handles this. Discovery should document:
- `painting` -> click same tool button -> clear floating toolbar, hide mask overlay -> `idle`
- `click-waiting` -> click same tool button -> restore default cursor -> `idle`
- `outpaint-config` -> click same tool button -> hide direction controls -> `idle`

Additionally, consider an explicit "Close/Cancel" button in the floating toolbar for discoverability (not all users will think to re-click the toolbar button).

**Affects:**
- [x] Discovery change needed
- [ ] Wireframe change needed

---

### Finding F-2: Click-to-Edit after SAM success silently replaces manually painted mask

**Severity:** Critical
**Category:** Usability

**Problem:**
The business rule states: "SAM-Mask ersetzt manuelle Maske: Click-to-Edit generiert neue SAM-Maske die eine vorhandene manuelle Maske ersetzt (kein Merge)" (line 275). This means if a user has spent time carefully painting a detailed mask in Brush Edit mode, then switches to Click Edit and clicks an object, their entire manual mask is silently destroyed and replaced by the SAM-generated mask.

There is no confirmation dialog, no undo for the mask itself, and no visual warning that this destructive action is about to happen.

**Context:**
> **From Discovery (line 275):**
> ```
> SAM-Mask ersetzt manuelle Maske: Click-to-Edit generiert neue SAM-Maske
> die eine vorhandene manuelle Maske ersetzt (kein Merge)
> ```
>
> **From Discovery (line 273):**
> ```
> Mask-Lifecycle: Session-only. Bleibt im State bei Tool-Wechsel
> ```
> The mask is preserved on tool switch, but the SAM click replaces it entirely.

**Impact:**
A user who invested effort painting a precise mask loses it instantly with no recovery option. The mask is session-only and not in the undo stack, so this data loss is permanent. This is particularly harmful because the tool-switch itself preserves the mask (giving users a false sense of safety), but the subsequent SAM click destroys it.

**Recommendation:**
Two options (choose one):
1. **Confirmation dialog:** When a mask already exists and user clicks in Click-to-Edit mode, show a confirmation: "This will replace your current mask. Continue?" with Cancel/Replace options.
2. **Merge option:** Offer "Replace mask" vs. "Add to mask" (SAM mask gets unioned with existing mask). This is more sophisticated but matches Photoshop-like workflows.

At minimum, option 1 is needed. The wireframe should also show a warning state for this scenario.

**Affects:**
- [x] Discovery change needed
- [x] Wireframe change needed

---

### Finding F-3: Outpaint: no validation feedback when submitting prompt without direction selected

**Severity:** Improvement
**Category:** Usability

**Problem:**
The wireframe state variation table notes `outpaint-config (no direction): All direction buttons unselected, chat send triggers warning`. However, neither the wireframe nor the discovery defines what this warning looks like, where it appears, or what it says. More importantly: the chat input is not disabled when no direction is selected, so the user can type a full prompt and only discover the error on submit.

**Context:**
> **From Wireframes (line 293-296):**
> ```
> | `outpaint-config (no direction)` | All direction buttons unselected,
>   chat send triggers warning |
> ```
>
> **From Discovery (lines 160-163):**
> ```
> 1. User klickt "Expand" in der Toolbar -> Richtungs-Controls erscheinen
> 2. User klickt eine oder mehrere Richtungen
> 3. User waehlt Erweiterungsgroesse
> 4. Optional: User tippt Prompt
> ```
> Flow assumes direction is always selected before prompt. No error path for "prompt submitted without direction."

**Impact:**
User writes a detailed prompt, hits send, and gets a vague warning. This is frustrating and wastes effort. The system should prevent the error rather than just reporting it.

**Recommendation:**
1. Define the warning message explicitly (e.g., "Select at least one direction to expand the image").
2. Consider disabling the chat send button when in outpaint-config state with no direction selected. This is error prevention rather than error reporting.
3. Add a visual hint to the direction controls (e.g., a subtle pulsing or highlighted "Select direction" label) when the user enters outpaint mode.

**Affects:**
- [x] Discovery change needed
- [x] Wireframe change needed

---

### Finding F-4: Navigation block with no visible escape path

**Severity:** Improvement
**Category:** Usability

**Problem:**
The business rule states: "Prev/Next Navigation blockiert wenn Maske existiert. User muss erst Clear oder das Bild verlassen" (line 276). The wireframe shows "navigation blocked" as a state variation (line 398). However, neither document defines how the user understands WHY navigation is blocked or HOW to unblock it.

If the Prev/Next buttons are simply disabled with no explanation, users will be confused. They may not realize that an invisible mask (e.g., mask is hidden because they switched to outpaint mode but mask still exists in state) is blocking navigation.

**Context:**
> **From Discovery (line 276):**
> ```
> Navigation-Sperre: Prev/Next Navigation blockiert wenn Maske existiert.
> User muss erst Clear oder das Bild verlassen
> ```
>
> **From Discovery (line 274):**
> ```
> Mask-Sichtbarkeit: In Outpaint-Modus: Maske hidden aber im State erhalten
> ```
> A hidden mask still blocks navigation. The user cannot see what is blocking them.

**Impact:**
Users in outpaint mode have a hidden mask blocking Prev/Next navigation with no visible explanation. They must intuit that they need to switch back to a mask mode and clear the mask -- an opaque multi-step recovery that violates "Visibility of System Status."

**Recommendation:**
1. When navigation is attempted with an active mask, show a tooltip or inline message: "Clear your mask to navigate between images" (not just disable the button silently).
2. Consider: when switching to outpaint-config, offer to clear the mask since outpaint does not use it. This would automatically unblock navigation.
3. As a simpler alternative: allow navigation to discard the mask (with a confirmation) rather than hard-blocking it.

**Affects:**
- [x] Discovery change needed
- [x] Wireframe change needed

---

### Finding F-5: Toolbar mutual exclusivity conflict between existing tools and new edit tools

**Severity:** Improvement
**Category:** Inkonsistenz

**Problem:**
The existing toolbar uses a single `activeToolId` in `CanvasDetailState` (line 17, `canvas-detail-context.tsx`). Current tools include `variation`, `img2img`, `upscale`, and `details` -- all of which open popovers. The new edit tools (`brush-edit`, `erase`, `click-edit`, `expand`) will also use `activeToolId`.

Since `SET_ACTIVE_TOOL` is a single slot, activating "Brush Edit" will deactivate any open popover (e.g., the details panel), and vice versa: clicking "Details" while in painting mode would deactivate the edit tool. This is potentially correct behavior, but neither the discovery nor the wireframes address what happens to the mask/overlay/floating toolbar when a non-edit tool is activated.

**Context:**
> **From Discovery (line 251):**
> ```
> | `painting` | Klick auf anderes Tool (Download, Delete, etc.) |
>   Tool-Aktion ausfuehren | `painting` | Maske bleibt bei Tool-Wechsel |
> ```
> This only covers non-toggle tools (Download, Delete). It does not cover toggle tools (Details, Variation, img2img, Upscale).
>
> **From Codebase (`canvas-toolbar.tsx` line 35):**
> ```typescript
> type ToolId = "variation" | "img2img" | "upscale" | "download" | "delete" | "details";
> ```
> Only one tool can be active at a time via `activeToolId`.

**Impact:**
Undefined behavior when user clicks "Details" while in painting mode. Does the mask disappear? Does the floating toolbar close? Can the user return? Without explicit definition, implementation will make ad-hoc decisions that may not be consistent.

**Recommendation:**
Add state machine transitions for interactions between edit tools and existing toggle tools. Options:
1. **Edit tools take precedence:** While an edit mode is active, other toggle tools (variation, img2img, upscale, details) open as secondary overlays without deactivating the edit mode. This requires a second state slot.
2. **Mutual exclusion with mask preservation:** Clicking Details/Variation/etc. deactivates the edit tool (hides floating toolbar and overlay) but preserves the mask in state. Clicking back to the edit tool restores everything. Document this explicitly.

Option 2 is simpler and aligns with the existing single-slot pattern.

**Affects:**
- [x] Discovery change needed
- [ ] Wireframe change needed

---

### Finding F-6: Erase mode chat panel state is undefined

**Severity:** Improvement
**Category:** Inkonsistenz

**Problem:**
The wireframe for Erase mode (line 183) shows `(chat not needed for erase mode)` in the chat panel area, but does not define what the chat panel actually looks like. Is it hidden? Collapsed? Visible but with disabled input? The wireframe annotation just says "not needed" without specifying the visual state.

This matters because the Erase mode wireframe shows the erase-action-button in the floating toolbar triggers removal directly (no prompt needed). But the chat panel is still physically present in the 3-column layout. If it remains visible and enabled, the user might type a prompt and press Enter, expecting it to work -- but Flow 2 (Erase) has no prompt-based path.

**Context:**
> **From Wireframes (line 183):**
> ```
> (chat not needed for erase mode)
> ```
>
> **From Discovery (line 124-128):**
> ```
> Flow 2: Object Removal (Erase)
> 1. User klickt "Erase" -> Floating Brush Toolbar erscheint
> 2. User malt Maske
> 3. User klickt "Entfernen"-Button
> ```
> No mention of chat interaction in erase mode.
>
> **From Discovery (line 246-247):**
> ```
> | `idle` | Chat-Prompt | ... | `generating` | Canvas Agent klassifiziert Intent |
> | `painting` | Chat-Prompt senden | ... | `generating` | Maske + Prompt -> Inpaint-Modell |
> ```
> A chat prompt sent during `painting` state triggers inpaint regardless of whether erase mode was active.

**Impact:**
If the chat remains enabled in erase mode and user sends a prompt, the state machine says it triggers inpaint (mask + prompt -> inpaint model). This is actually valid behavior -- but the wireframe suggests chat is "not needed," which may mislead implementers into disabling it. The interaction between erase mode and chat-with-prompt needs explicit clarification: does sending a prompt in erase mode switch to inpaint behavior, or is it blocked?

**Recommendation:**
Clarify in Discovery: when erase mode is active and user sends a chat prompt, the system should treat this as an inpaint request (mask + prompt -> inpaint model), effectively upgrading from "remove" to "replace." The chat panel should remain visible and enabled. The wireframe should show the chat as available with a hint like "Type a prompt to replace instead of erase" or similar contextual guidance.

**Affects:**
- [x] Discovery change needed
- [x] Wireframe change needed

---

### Finding F-7: Outpaint size selector UX: per-direction sizes add complexity without clear justification

**Severity:** Suggestion
**Category:** Usability

**Problem:**
The wireframe (lines 260-269) shows independent size selectors (25% | 50% | 100%) for each direction (top, left, right, bottom). This means with multi-direction outpainting, a user could set top=25%, right=100% -- creating an asymmetric expansion. While this offers flexibility, it also quadruples the number of interactive elements and decisions the user must make.

**Context:**
> **From Wireframes (lines 265-269):**
> ```
> [Left]  |  Canvas Image  | [Right]
> [25%|   |                | [25%|
>  50%|   |                |  50%|
>  100%]  |                |  100%]
> ```
> Each direction has its own size selector.
>
> **From Discovery (line 288):**
> ```
> Outpaint-Groessen: Prozent-basiert (25%, 50%, 100%).
> Default: 50% (vorausgewaehlt bei Aktivierung)
> ```
> Single default value, but does not clarify if size is global or per-direction.

**Impact:**
Low -- this is a UX complexity concern, not a blocker. Most users will likely want symmetric expansion. Power users may want asymmetric, but this is an edge case for V1.

**Recommendation:**
Consider a simpler approach for V1: one global size selector that applies to all selected directions, with per-direction sizes as a V2 enhancement. This reduces cognitive load and decision fatigue. If per-direction sizes are kept, ensure the wireframe shows the default state clearly (all at 50%).

**Affects:**
- [ ] Discovery change needed
- [x] Wireframe change needed

---

### Finding F-8: Keyboard shortcuts absent for high-frequency mask painting actions

**Severity:** Suggestion
**Category:** Usability

**Problem:**
Mask painting is a high-frequency, precision interaction. Users familiar with Photoshop or similar tools expect keyboard shortcuts for brush size ([ and ] keys), brush/eraser toggle (E key), and undo (Cmd/Ctrl+Z). Neither discovery nor wireframes mention keyboard shortcuts for these actions.

**Context:**
> **From Discovery (lines 215-217):**
> ```
> brush-size-slider: Slider, 1px - 100px
> brush-eraser-toggle: Toggle Button, brush/eraser
> clear-mask-btn: Button
> ```
> All interactions defined as mouse-only UI elements.

**Impact:**
Low for V1 -- the feature works without shortcuts. But users doing detailed mask work will find the slider-only brush size adjustment slow compared to keyboard shortcuts. This is a polish item.

**Recommendation:**
Document as V1.1 enhancement. At minimum, Cmd/Ctrl+Z for mask undo (distinct from image undo) should be considered, as mask painting errors are common and the only current recovery is the eraser tool or clear-all.

**Affects:**
- [x] Discovery change needed (add to Out of Scope or Future section)
- [ ] Wireframe change needed

---

## Scalability & Risks

### State Complexity Growth
The state machine is already moderately complex with 7 states and ~20 transitions. Adding future edit modes (e.g., lasso selection, color adjustment) will require careful state management. The current single `activeToolId` pattern in the context will need to evolve. **Risk: Medium.** The current design is sound for 5 modes but the single-slot tool activation pattern may need refactoring if more modes are added.

### Mask State as Session-Only
The decision to keep masks session-only (not persisted) is pragmatic for V1. However, if users start expecting to save and resume mask work (especially for complex selections), this will become a friction point. **Risk: Low for V1,** as the session-only constraint is clearly documented.

### Canvas Size Limits with Outpainting
Repeated outpainting in the same direction compounds image size (100% expansion doubles the dimension). After 3-4 expansions, the image could exceed API limits. The discovery mentions this as an error path (line 168: "Erweiterung wuerde API-Limit ueberschreiten"), but there is no proactive safeguard. **Risk: Low** -- the error toast handles it, but a proactive size indicator would be a better UX.

---

## Strategic Assessment

### Is this the right solution?

Yes. The five-mode approach is well-calibrated:

1. **Mask Inpainting** covers the core "replace specific area" use case that drives professional workflows.
2. **Erase** offers a zero-prompt path for the most common quick edit (object removal) -- smart reduction of friction.
3. **Instruction Editing** is the most modern approach (prompt-only, no mask), aligning with the trend toward FLUX Kontext-style editing.
4. **Click-to-Edit** via SAM bridges the gap between manual masking (tedious) and instruction editing (imprecise), offering a best-of-both-worlds middle ground.
5. **Outpainting** addresses a distinct use case (canvas extension) that cannot be solved by the other modes.

The reuse of the existing Canvas Detail-View layout (3-column with chat panel) is architecturally sound. The chat panel as prompt hub for edit modes is a natural extension of the existing interaction pattern, not a forced addition.

### What's done well

- **Mask persistence across tool switches** is a thoughtful detail that prevents accidental work loss during mode exploration.
- **Error recovery** is consistently defined: API errors preserve mask + image state, allowing retry.
- **The instruction editing flow** is elegantly simple -- no new UI at all, just backend intelligence.
- **The state machine** is well-structured with clear separation between UI states and available actions.
- **Existing pattern reuse** (toolbar buttons, toast, undo/redo, generation polling) reduces implementation risk significantly.

---

## Verdict

**CHANGES_REQUESTED**

**Reason:** 2 Critical findings that must be resolved before implementation:
1. **F-1 (Critical):** No path back to idle state -- users get permanently stuck in edit modes
2. **F-2 (Critical):** Silent mask destruction on SAM click -- data loss without warning

Additionally, 4 Improvement findings that address validation gaps and interaction ambiguities:
3. **F-3:** Outpaint submit validation
4. **F-4:** Navigation block transparency
5. **F-5:** Toolbar tool interaction definition
6. **F-6:** Chat panel state in erase mode

**Recommended Next Steps:**
1. Fix F-1: Add idle-return transitions in discovery state machine (trivial -- the codebase already supports toggle-off)
2. Fix F-2: Add confirmation flow for SAM click when mask exists
3. Address F-3 through F-6: Clarify validation messages, tool interaction rules, and erase-mode chat behavior
4. Suggestions (F-7, F-8) can be deferred to V1.1
