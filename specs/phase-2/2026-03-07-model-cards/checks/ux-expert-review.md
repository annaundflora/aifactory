<!-- AGENT_DEF_LOADED: ux-expert-review-de-v1 -->

# UX Expert Review: Model Cards & Multi-Model Selection

**Feature:** Model Cards & Multi-Model Selection
**Date:** 2026-03-07
**Reviewer:** UX Expert Agent

---

## Summary

**Verdict:** CHANGES_REQUESTED

| ID | Title | Severity |
|----|-------|----------|
| F-1 | Discovery references non-existent Drawer and Badge components | :yellow_circle: Improvement |
| F-2 | Parameter schema conflict with multi-model selection | :red_circle: Critical |
| F-3 | No feedback when 4th model click is blocked | :yellow_circle: Improvement |
| F-4 | Confirm button allows "Confirm (0 Models)" state | :yellow_circle: Improvement |
| F-5 | Model display name derivation from model_id undefined | :bulb: Suggestion |
| F-6 | Search + Filter interaction not specified | :bulb: Suggestion |

**Totals:** 1 Critical, 3 Improvement, 2 Suggestion

**High-Level Assessment:** The concept is well-structured and the discovery is thorough. The core idea -- replacing a stale dropdown with a rich card-based browser and enabling multi-model comparison -- is strategically sound. However, there is one critical gap around how parameter schemas interact with multi-model selection, and several improvable details around component references and interaction edge cases.

---

## Workflow Analysis

The state machine is well-defined with clear transitions. Walking through the flow mentally:

**Happy Path:** Works cleanly. User opens drawer, selects 1-3 models, confirms, generates. No dead ends.

**Cancel/Discard Path:** Closing drawer without confirming reverts selection -- good. This prevents accidental loss of current selection.

**Min/Max Enforcement:** Min 1 model on trigger (X button hidden on last model) and max 3 in drawer (cards disabled) -- both covered.

**State Reachability:** All states are reachable and all have exit paths. The `browsing-error` state has a retry path back to `browsing-loading`. No orphaned states.

**One concern with the flow:** When user opens the drawer, the current selection should be pre-checked on the cards. Discovery implies this (line 193: "selection reverted to pre-open state" on close), but neither discovery nor wireframe explicitly states that previously selected models appear checked when the drawer opens. This is implicit and should work correctly if implemented as described, but worth noting.

---

## Findings

### Finding F-1: Discovery references non-existent Drawer and Badge components

**Severity:** :yellow_circle: Improvement
**Category:** Inconsistency

**Problem:**
The UI Patterns table in Discovery lists `components/ui/drawer` (shadcn) and `components/ui/badge` (shadcn) as reused patterns. Neither component exists in the codebase. The codebase uses `Sheet` (from `components/ui/sheet.tsx`) for drawer-like overlays -- the existing `BuilderDrawer` already uses Sheet, not Drawer. Similarly, no Badge component exists in `components/ui/`.

**Context:**
> **From Discovery (lines 70-76):**
> ```
> | Drawer | `components/ui/drawer` (shadcn) | Model Browser Drawer |
> | Badge  | `components/ui/badge` (shadcn)  | Model Badge on Gallery thumbnails, run count |
> ```
>
> **From Codebase:**
> ```
> components/ui/sheet.tsx           -- EXISTS (used by BuilderDrawer)
> components/ui/drawer.tsx          -- DOES NOT EXIST
> components/ui/badge.tsx           -- DOES NOT EXIST
> components/prompt-builder/builder-drawer.tsx -- uses Sheet, not Drawer
> ```

**Impact:**
Developers following discovery will look for non-existent components. If they install shadcn Drawer (which is a bottom-sheet pattern on mobile, different from right-side drawer), the resulting UX will be wrong. The Badge component needs to be created or the pattern needs to be defined differently.

**Recommendation:**
- Update discovery to reference `Sheet` (`components/ui/sheet`) instead of Drawer, consistent with `BuilderDrawer` pattern
- Either add `shadcn Badge` as a new dependency (noting it must be installed), or specify that the Model Badge is a custom styled `<span>` -- no full Badge component needed for a simple overlay label

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-2: Parameter schema conflict with multi-model selection

**Severity:** :red_circle: Critical
**Category:** Workflow Gap

**Problem:**
The current `ParameterPanel` renders dynamic parameters fetched from a model's OpenAPI schema (via `getModelSchema`). When the user selects multiple models, each model potentially has different parameters (e.g., FLUX supports `guidance_scale` while SDXL supports `scheduler`). The discovery does not address what happens to the parameter panel when 2-3 different models are selected. This is a critical UX gap: the user cannot meaningfully configure parameters when models have incompatible schemas.

**Context:**
> **From Discovery (line 61):**
> ```
> `components/workspace/parameter-panel.tsx`: Renders dynamic params from schema -- REUSED (unchanged)
> ```
>
> **From Discovery (line 58):**
> ```
> `lib/services/model-schema-service.ts`: Fetches OpenAPI schema per model -- REUSED (schema loading per model stays)
> ```
>
> **From Discovery (line 209):**
> ```
> Parallel generation: 1 prediction per selected model, all fired simultaneously
> ```

**Impact:**
This is a task-completion blocker. If user selects 3 models with different parameter schemas, the parameter panel cannot represent all three simultaneously. User has no way to configure per-model parameters, which either means: (a) parameters are silently ignored for incompatible models (confusing), (b) only the first model's params are shown (misleading), or (c) generation fails for models missing required params (broken).

**Recommendation:**
Address this explicitly in discovery. Options:
1. **Simplest (recommended for V1):** When multiple models are selected, hide or collapse the parameter panel with a note: "Default parameters will be used for multi-model generation." Only show per-model params when exactly 1 model is selected.
2. **Advanced (V2):** Show tabbed parameter panels, one per selected model.

Either way, this interaction MUST be defined before implementation.

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-3: No feedback when 4th model click is blocked

**Severity:** :yellow_circle: Improvement
**Category:** Usability

**Problem:**
When 3 models are already selected and the user clicks a 4th card, the discovery states "Card does not select" and the card is in a `disabled` state with reduced opacity. While the disabled visual state helps, there is no active feedback explaining WHY the card cannot be selected. Users unfamiliar with the max-3 limit may think the card is broken.

**Context:**
> **From Discovery (line 190):**
> ```
> browsing | Click unchecked card (3 already selected) | No change, card stays unselected | browsing | 4th card blocked
> ```
>
> **From Wireframe (line 250):**
> ```
> `disabled` | Reduced opacity, checkbox not clickable (max 3 reached, card not already selected)
> ```

**Impact:**
Users who miss the "2/3 selected" counter may repeatedly click a disabled card without understanding the constraint. This creates a moment of frustration.

**Recommendation:**
Add a brief inline hint or toast when a disabled card is clicked: "Maximum 3 models can be selected. Deselect a model first." Alternatively, add a static hint near the counter: "Select up to 3 models."

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-4: Confirm button allows "Confirm (0 Models)" visible state

**Severity:** :yellow_circle: Improvement
**Category:** Usability

**Problem:**
The wireframe shows a state where the confirm button reads "Confirm (0 Models)" when disabled. Showing a count of zero in a call-to-action is unusual and slightly confusing. It also raises the question: if the user opens the drawer, deselects all models, then closes via X (which reverts), the revert is correct. But the visible "0 Models" state in the button suggests this is a valid configuration.

**Context:**
> **From Wireframe (line 186):**
> ```
> `0 selected` | Confirm button disabled, text "Confirm (0 Models)"
> ```
>
> **From Discovery (line 191):**
> ```
> Click checked card | Ring + checkmark removed, counter updates | browsing | Min 0 models (Confirm disabled at 0)
> ```

**Impact:**
Minor confusion. The "0 Models" label makes the zero-selection state look intentional rather than an intermediate state the user should resolve.

**Recommendation:**
When 0 models are selected, change button text to "Select at least 1 model" (disabled) instead of "Confirm (0 Models)". This provides actionable guidance rather than just a count.

**Affects:**
- [x] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-5: Model display name derivation from model_id undefined

**Severity:** :bulb: Suggestion
**Category:** Gap

**Problem:**
The Gallery Model Badge needs to show a human-readable model display name. The generation record stores `modelId` (e.g., `black-forest-labs/flux-2-pro`), but the display name (e.g., "FLUX 2 Pro") comes from the Collections API. For historical generations created before this feature, or when the Collections API cache is expired, there is no guaranteed way to derive the display name from the model_id.

**Context:**
> **From Discovery (line 210):**
> ```
> Model Badge on Gallery thumbnails: derived from model name stored in generation record
> ```

**Impact:**
Low severity since a reasonable fallback exists (show the raw `name` portion of the model ID). But it should be explicitly stated.

**Recommendation:**
Add a business rule: "If display name cannot be resolved from cached collection data, fall back to the `name` portion of model_id (e.g., `flux-2-pro` from `black-forest-labs/flux-2-pro`), formatted with hyphens replaced by spaces and title-cased."

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-6: Search + Filter interaction not specified

**Severity:** :bulb: Suggestion
**Category:** Gap

**Problem:**
The discovery defines search (by name/description) and filter chips (by owner) independently, but does not specify how they interact when both are active simultaneously. Can a user search "flux" AND filter by "stability-ai" (resulting in zero matches)? Are they additive (AND) or does one reset the other?

**Context:**
> **From Discovery (lines 213-214):**
> ```
> Filter chips: dynamically generated from unique owner names in loaded models
> Search: client-side filter on model name + description (case-insensitive)
> ```

**Impact:**
Minor ambiguity. Developers will likely implement AND logic by default, which is correct. But an explicit statement prevents potential inconsistency.

**Recommendation:**
Add to business rules: "Search and owner filter are applied simultaneously (AND logic). Changing the owner filter does not clear the search, and vice versa."

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed

---

## Scalability & Risks

**Collection Size:** The Collections API could return anywhere from 10 to 100+ models. The 2-column grid with scrolling handles this well. No pagination needed at current scale.

**Model Churn:** Models may be removed from the collection between cache refreshes. If a user selects a model, caches expire, and the model disappears from the collection on next load, the trigger card would show a model that no longer appears in the browser. This is a minor edge case handled implicitly by the "any collection model is accepted" rule -- generation still works even if the model leaves the collection.

**Sidebar Real Estate:** With 3 stacked mini-cards, the trigger area takes significant vertical space in the already-compact sidebar. This is acceptable for max 3 cards but worth monitoring. The wireframe shows this clearly.

---

## Strategic Assessment

**Is this the right solution?** Yes. The current dropdown is a known pain point for model discovery. A card-based browser with visual context (cover images, run counts) is the industry-standard pattern for this type of selection (see: Hugging Face model hub, Civitai model browser). Multi-model comparison is a genuine differentiator for an AI image generation tool.

**Innovation vs. Convention Balance:** Good. The drawer-based browser follows established patterns. Multi-model parallel generation is innovative but the interaction model (checkboxes + confirm) is conventional enough to be immediately understandable.

**What was done well:**
- Thorough API research with rate limit verification
- Clean state machine with no dead ends
- Smart reuse of existing Sheet pattern (even if the name in discovery is wrong)
- Discard-on-close semantics prevent accidental selection changes
- Incremental slice structure allows safe, testable rollout

---

## Verdict

**CHANGES_REQUESTED**

**Blocking Issues:**
1. **F-2 (Critical):** The parameter panel behavior for multi-model selection is undefined. This is a core workflow gap that must be resolved before implementation.

**Required Improvements:**
2. **F-1:** Correct component references (Sheet not Drawer, Badge needs creation)
3. **F-3:** Add user feedback for max-selection-reached interaction
4. **F-4:** Improve zero-selection button label

**Next Steps:**
1. Address F-2 by adding a parameter panel behavior rule for multi-model selection
2. Fix component references in F-1
3. Consider F-3 and F-4 improvements to polish the interaction
4. Optionally address F-5 and F-6 suggestions
