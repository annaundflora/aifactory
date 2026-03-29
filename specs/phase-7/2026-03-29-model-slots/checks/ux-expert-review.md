<!-- AGENT_DEF_LOADED: ux-expert-review-de-v1 -->

# UX Expert Review: Model Slots

**Feature:** Model Slots -- Replace Tier-Toggle with direct model selection
**Date:** 2026-03-29
**Reviewer:** UX Expert Agent
**Discovery:** `discovery.md` | **Wireframes:** `wireframes.md`

---

## Summary

**Verdict:** CHANGES_REQUESTED

| ID | Title | Severity |
|----|-------|----------|
| F-1 | Multi-model parameter schema conflict unaddressed | Critical |
| F-2 | Empty slot model selection does not auto-activate | Improvement |
| F-3 | Upscale popover: 2-slot limit undeclared in Discovery data model | Improvement |
| F-4 | Chat Panel compact layout lacks slot 3 and empty-slot handling | Improvement |
| F-5 | No Checkbox UI component exists in the codebase | Suggestion |
| F-6 | Variation Popover "Count" semantics ambiguous with multi-model | Suggestion |

**Totals:** 1 Critical, 3 Improvement, 2 Suggestion

**High-Level Assessment:** The concept is well-suited for a power-user single-user tool. Replacing an opaque tier abstraction with direct model visibility is the right strategic move, and the 3-slot design with per-mode persistence is clean and scalable. However, one critical UX gap exists around parameter handling in multi-model scenarios that will confuse the user and potentially produce unexpected generation results.

---

## Workflow Analysis

### State Machine Walkthrough

I mentally walked each of the four defined flows plus edge cases:

| Flow | Verdict | Notes |
|------|---------|-------|
| Flow 1: Quick Model Switch | OK | Dropdown swap, immediate effect. Clean 1-step interaction. |
| Flow 2: Multi-Model Compare | Problem | Parameter schema conflict (see F-1). Flow itself is mechanically sound. |
| Flow 3: Mode Switch | OK | Per-mode DB persistence + restore. Well-designed. |
| Flow 4: New Model Setup | Friction | Model selection on empty slot does not auto-check (see F-2). |

### Reachability & Recovery

- **Dead ends:** None found. Min-1 rule prevents zero-active state. Mode switch always restores from DB. Settings is read-only (no accidental edits).
- **Undo/Cancel:** Model dropdown changes are persisted immediately to DB. No explicit undo, but the user can simply re-select the previous model. Acceptable for a power-user tool with only one user.
- **Error recovery:** Discovery covers the "model becomes incompatible after mode switch" edge case (slot deactivated + hint). Adequate.

---

## Findings

### Finding F-1: Multi-model parameter schema conflict unaddressed

**Severity:** Critical
**Category:** Workflow / Lücke

**Problem:**
When multiple slots are active, the ParameterPanel (aspect ratio, megapixels, etc.) is driven by `useModelSchema(resolvedModelId)` -- a hook that takes a single model ID. Currently, `resolvedModel` is computed once from settings via `resolveModel(modelSettings, mode, tier)`. In the new multi-slot world, different active models may expose different parameter schemas. For example, Flux Schnell may support `aspect_ratio` values that Flux Pro does not, or one model may expose `megapixels` while another does not.

Neither Discovery nor Wireframes define which model drives the ParameterPanel when 2-3 slots are active, how schema conflicts are resolved, or what happens when the user sets a parameter value that is valid for Model A but invalid for Model B.

**Context:**
> **From Discovery (line 77):**
> ```
> ⑤ Parameter Panel: schema-based controls (aspect ratio, megapixels). Shared across all active slots.
> ```
>
> **From Codebase** (`prompt-area.tsx`, lines 188-192):
> ```typescript
> const resolvedModel = currentMode !== "upscale"
>   ? resolveModel(modelSettings, currentMode, tier)
>   : undefined;
> const resolvedModelId = resolvedModel?.modelId;
> const { schema: modelSchema } = useModelSchema(resolvedModelId);
> ```

**Impact:**
The user activates Slot 1 (Flux Schnell) + Slot 2 (Flux Pro). The ParameterPanel shows controls from... which model? If it shows Schnell's schema, the user might set an `aspect_ratio` value that Flux Pro rejects, leading to a backend error on half the generations. The user sees 2 of 4 images fail with no clear reason. This directly undermines the core multi-model comparison use case.

**Recommendation:**
Discovery must define a parameter resolution strategy for multi-model. Practical options:
1. **Intersection:** Only show parameters that all active models share. Safest but most restrictive.
2. **Primary slot drives:** Slot 1's schema drives the panel. Other models receive the same params; backend handles gracefully (ignore unsupported params). Document this rule.
3. **Per-slot params:** Each slot gets its own parameter section. Most flexible but increases UI complexity.

Option 2 is the pragmatic choice for a power-user tool -- define Slot 1 as the "primary" slot whose schema drives the panel, and document that other models receive the same params with backend-side graceful handling.

**Betrifft:**
- [x] Discovery change needed (parameter resolution strategy for multi-model)
- [ ] Wireframe change needed (only if option 3 is chosen)

---

### Finding F-2: Empty slot model selection does not auto-activate

**Severity:** Improvement
**Category:** Usability

**Problem:**
When a user selects a model on an empty slot (Slot 3), the wireframe explicitly states the checkbox becomes "enabled but not auto-checked." This means the user must perform two actions to use a new model: (1) select model from dropdown, (2) check the checkbox. In the primary use case -- adding a third model for comparison -- the intent of selecting a model on an empty slot is almost always to use it. Requiring a second click adds unnecessary friction to a high-frequency workflow.

**Context:**
> **From Wireframes (line 90):**
> ```
> | `model-selected-on-empty` | User picks model in empty slot 4: checkbox 3 becomes enabled (not auto-checked) |
> ```
>
> **From Discovery (line 198):**
> ```
> 4. Slot 3 has now a Model, Checkbox becomes activatable
> 5. User activates Checkbox -> 3 Models at next generation
> ```

**Impact:**
Not a blocker, but the 2-step interaction (select + check) for the most common empty-slot scenario adds friction. Users who select a model and immediately click "Generate" will be surprised that the new model was not included in the generation.

**Recommendation:**
Auto-activate the checkbox when a model is selected on a previously empty slot. The user can always uncheck it afterward. This follows the principle of least surprise: picking a model signals intent to use it. If Discovery intentionally chose the current behavior to prevent accidental multi-model generation, document the rationale.

**Betrifft:**
- [x] Discovery change needed (auto-activate decision)
- [x] Wireframe change needed (update state variation table)

---

### Finding F-3: Upscale popover 2-slot limit undeclared in Discovery rules

**Severity:** Improvement
**Category:** Inconsistency

**Problem:**
The Wireframes show 2 slots for the Upscale popover, and the Discovery data model seed data shows only 2 upscale models. However, the Discovery rules section (Section 3) universally states "Min 1, Max 3 active Slots" without any mode-specific exception. The Wireframes introduce a `upscale-mode` state variation ("Only Slot 1 and Slot 2 visible") that has no corresponding rule in Discovery.

**Context:**
> **From Discovery (line 65):**
> ```
> - Min 1, Max 3 active Slots
> ```
>
> **From Wireframes (line 93):**
> ```
> | `upscale-mode` | Only Slot 1 and Slot 2 visible (upscale has max 2 slots in Discovery) |
> ```
>
> **From Discovery data model (lines 102-104):**
> ```
> upscale  | 1    | philz1337x/crystal-upscaler      | {scale: 4}   | true
> upscale  | 2    | nightmareai/real-esrgan           | {scale: 2}   | false
> upscale  | 3    |                                 | {}           | false
> ```

Note that the data model actually has 3 rows for upscale (slot 3 is empty), yet the wireframe only renders 2. This is an inconsistency that developers will need to interpret.

**Impact:**
A developer reading Discovery will implement 3 slots for all modes. A developer reading Wireframes will implement 2 for upscale. Without an explicit rule in Discovery ("Upscale mode: max 2 slots"), this becomes an implementation guessing game.

**Recommendation:**
Add a mode-specific slot count rule to Discovery Section 3 (Rules): "Upscale mode supports max 2 slots. Slot 3 is omitted from the UI for upscale." This resolves the contradiction between the universal "max 3" rule and the wireframe's 2-slot upscale layout.

**Betrifft:**
- [x] Discovery change needed (mode-specific slot count rule)
- [ ] Wireframe change needed

---

### Finding F-4: Chat Panel compact layout lacks Slot 3 and empty-slot handling

**Severity:** Improvement
**Category:** Lücke

**Problem:**
The Chat Panel wireframe shows exactly 2 slots in a horizontal compact layout. It does not visualize what happens with Slot 3, nor how empty/unassigned slots appear in the compact horizontal format. The horizontal layout `[Schnell] [Pro]` works for 2 named models, but what about 3? And what about a slot that shows "select model" in the compact bar? The space constraints of a thin horizontal bar between chat messages and input may not accommodate 3 full slot controls.

**Context:**
> **From Wireframes (lines 245-247):**
> ```
> |  | Checkbox[Schnell Dropdown] Checkbox[Pro Dropdown]   ||
> ```
>
> **From Discovery (line 65):**
> ```
> - Min 1, Max 3 active Slots
> ```

**Impact:**
If the Chat Panel only ever shows 2 slots, this contradicts the "3 slots everywhere" concept and creates an inconsistency the user will notice (the chat panel behaves differently from the workspace). If it does show 3 slots, the wireframe needs to demonstrate the layout fits and remains usable at that width.

**Recommendation:**
Either (a) wireframe the 3-slot Chat Panel layout to prove it fits, or (b) explicitly document a Chat Panel exception in Discovery ("Chat Panel shows max 2 slots due to space constraints; Slot 3 is accessible only via Workspace"). Option (a) is preferred for consistency.

**Betrifft:**
- [ ] Discovery change needed (only if option b)
- [x] Wireframe change needed (show 3-slot compact layout)

---

### Finding F-5: No Checkbox UI component exists in the codebase

**Severity:** Suggestion
**Category:** Lücke (Codebase Context)

**Problem:**
The Model Slots design relies heavily on checkboxes for slot activation. The codebase does not have a `components/ui/checkbox.tsx` component. While creating one is straightforward (standard shadcn/ui pattern with Radix Checkbox), this is a new primitive that needs to be added.

**Context:**
Glob search for `components/ui/checkbox*` returned no results. The codebase uses Radix-based `Select`, `Popover`, etc. -- a Checkbox would follow the same pattern.

**Impact:**
No UX impact. Implementation detail that the developer should be aware of -- it is a new component to build, not an existing one to reuse.

**Recommendation:**
Note in the implementation plan that `Checkbox` is a new UI primitive to be added (shadcn/ui `Checkbox` based on Radix `@radix-ui/react-checkbox`).

**Betrifft:**
- [ ] Discovery change needed
- [ ] Wireframe change needed

---

### Finding F-6: Variation Popover "Count" semantics ambiguous with multi-model

**Severity:** Suggestion
**Category:** Usability

**Problem:**
The Variation Popover uses a "Count" selector (1/2/3/4) alongside Model Slots. Discovery defines that variants apply "per model" (2 slots x 3 variants = 6 images). But the Variation Popover label just says "Count" -- in the current single-model world, count = total images. In the multi-model world, count = images per model, so total images = count x active slots. The label "Count" does not communicate this multiplication.

**Context:**
> **From Discovery (line 70):**
> ```
> Variants apply per Model: 2 active Slots x 3 Variants = 6 images
> ```
>
> **From Wireframes (line 119):**
> ```
> Count
> [ 1 ] [ 2 ] [ 3 ] [ 4 ]
> ```

**Impact:**
Minor confusion. When 2 slots are active and the user selects Count=3, they might expect 3 total images but get 6. For a single power-user, this is quickly learned, but a brief moment of "why did I get 6 images?" will occur on first use.

**Recommendation:**
Consider showing the total image count dynamically below the stepper when multi-model is active: "3 per model x 2 models = 6 images". This is a nice-to-have, not blocking.

**Betrifft:**
- [ ] Discovery change needed
- [x] Wireframe change needed (optional: dynamic total label)

---

## Scalability & Risks

### What works well long-term
- **3-slot cap** is a smart constraint. It limits complexity without being too restrictive. If more models are needed later, the slot count can be increased without redesigning the pattern.
- **Per-mode persistence** is forward-thinking. Adding new modes (inpaint, outpaint -- already in the `GenerationMode` type) will "just work" with the slot system.
- **DB-backed slots** over client state means the configuration survives across sessions and devices. Good architectural choice.

### Risks to monitor
- **Parameter schema divergence:** As more models are added to the catalog, schema differences across models will grow. The parameter resolution strategy (F-1) will become increasingly important. A "lowest common denominator" approach may become too restrictive over time.
- **Upscale 2-slot exception (F-3):** If more upscale models become available, the 2-slot limit may feel arbitrary. Consider making slot count mode-configurable rather than hard-coded.

---

## Strategic Assessment

**Is this the right solution?** Yes. The Tier abstraction (Draft/Quality/Max) was a well-intentioned simplification that became a hindrance for a power-user who knows and cares about specific models. Direct model selection removes an unnecessary indirection layer. The multi-model comparison feature leverages existing backend capabilities (`modelIds[]` already supported) -- this is a pure UI unlock of an existing capability, which is the best kind of feature.

**Alternatives considered:** The discovery does not mention alternatives, but the slot-based approach is arguably the best fit for 1-3 models. Alternatives like a model tag-bar or a popover model picker would add complexity without clear benefit for 3 fixed slots.

**Migration path:** The tier-to-slot migration (draft=slot1, quality=slot2, max=slot3) is clean and preserves existing user configuration. Slot 1 defaults to active, matching the current "draft is default" behavior. No data loss.

---

## Positive Highlights

- **Consistent pattern across all surfaces:** The same Checkbox + Dropdown pattern appears in Workspace, Popovers, and Chat Panel. This is excellent for learnability.
- **Settings as read-only mirror:** Making Settings read-only for model configuration while the Workspace becomes the primary editing surface reduces confusion about "where do I change things?" -- there is exactly one answer.
- **Edge case coverage:** The min-1 rule, disabled checkbox for empty slots, and mode-switch slot restoration are all thoughtfully designed.
- **Completeness check in wireframes:** The explicit coverage matrix at the bottom of the wireframes document is a quality signal that shows systematic thinking.

---

## Verdict

**CHANGES_REQUESTED**

**Reason:** 1 Critical finding (F-1: parameter schema conflict in multi-model) and 3 Improvement findings (F-2, F-3, F-4) require resolution before implementation.

**Required next steps:**
1. **F-1 (Critical):** Define the parameter resolution strategy for multi-model scenarios in Discovery. Which model's schema drives the ParameterPanel? How are conflicts handled?
2. **F-2 (Improvement):** Decide on auto-activate behavior for empty slot model selection and document the rationale.
3. **F-3 (Improvement):** Add the upscale 2-slot rule explicitly to Discovery Section 3.
4. **F-4 (Improvement):** Either wireframe the 3-slot Chat Panel layout or document it as an intentional exception.

**Optional improvements (not blocking):**
- F-5: Plan for new Checkbox UI component in implementation.
- F-6: Consider dynamic total image count label for multi-model clarity.
