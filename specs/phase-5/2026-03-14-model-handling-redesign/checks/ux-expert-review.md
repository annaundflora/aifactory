<!-- AGENT_DEF_LOADED: ux-expert-review-de-v1 -->

# UX Expert Review: Model Handling Redesign -- Draft/Quality Tier System

**Feature:** `specs/phase-5/2026-03-14-model-handling-redesign`
**Date:** 2026-03-14
**Reviewer:** UX Expert Agent

---

## Summary

**Verdict:** CHANGES_REQUESTED

The concept is strategically sound. Replacing 30+ model choices with a two-tier Draft/Quality toggle is a significant simplification that aligns well with the "less decisions, faster workflow" goal. The state machine is clean, the flows are complete, and the wireframes faithfully represent the discovery document.

However, the review identifies **3 Improvements** and **3 Suggestions** that should be addressed before implementation. The most significant issue is a conceptual conflict between the existing upscale Scale selector (2x/4x) and the new Draft/Quality toggle, which creates redundant and confusing controls. Two additional Improvements address a missing Checkbox UI primitive and a labeling inconsistency that could mislead users about what "Professional Finish" actually does.

| ID | Title | Severity |
|----|-------|----------|
| F-1 | Upscale: Draft/Quality toggle conflicts with existing Scale selector | Improvement |
| F-2 | "Professional Finish" label misleads about actual effect | Improvement |
| F-3 | No Checkbox component exists in UI library | Improvement |
| F-4 | Settings Dialog: No visual indicator for auto-save | Suggestion |
| F-5 | Shared tier state across Workspace and Canvas may surprise users | Suggestion |
| F-6 | Settings Dialog unreachable from Canvas | Suggestion |

**Totals:** 0 Critical, 3 Improvement, 3 Suggestion

---

## Workflow Analysis

### State Machine Evaluation

The state machine is well-designed with four states and clear transitions. All states are reachable and escapable. Key observations:

- **Reachability:** All four states (draft-selected, quality-selected, quality-max-selected, settings-open) are reachable from the initial state.
- **Escapability:** Every state has at least one outgoing transition. The `settings-open` state correctly returns to the previous state on close.
- **No dead ends:** The transition table covers all expected paths. The "any -> settings-open" wildcard is appropriate.
- **Recovery:** Settings auto-save eliminates the need for explicit save/cancel, which is good for a low-risk configuration change.

### Flow Completeness

All four user flows are complete end-to-end. The trigger inventory correctly maps every generation entry point to mode + tier. One gap identified (F-1, see Findings).

---

## Findings

### Finding F-1: Upscale -- Draft/Quality toggle conflicts with existing Scale selector

**Severity:** Improvement
**Category:** Inconsistency / Usability

**Problem:**
The wireframe for upscale mode shows both a Scale selector (2x | 4x) and the Draft/Quality tier toggle. The default data in Discovery maps Draft to `{ "scale": 2 }` and Quality to `{ "scale": 4 }`. This creates two controls that both influence the upscale factor, leaving the user uncertain which one "wins."

A user who selects Quality (expecting "better upscale") but leaves the Scale selector on 2x faces a contradiction: does the system upscale at 2x or 4x? The Discovery document does not resolve this conflict.

**Context:**
> **From Discovery (line 247-248):**
> ```
> | upscale | draft | nightmareai/real-esrgan | { "scale": 2 } |
> | upscale | quality | nightmareai/real-esrgan | { "scale": 4 } |
> ```
>
> **From Wireframe (line 157):**
> ```
> Scale              [  2x  ] [ 4x ]
> ```
> (Scale selector is still present in the upscale wireframe alongside the tier toggle)

**Impact:**
Users will be confused about which control determines the upscale factor. Both Draft and Quality use the same model (Real-ESRGAN) -- the only difference is the scale parameter, which is already exposed via the existing Scale selector. This renders the Draft/Quality toggle meaningless for upscale or, worse, creates conflicting signals.

**Recommendation:**
Two options:

**Option A (recommended):** Remove the Scale selector from upscale mode entirely. Let Draft = 2x and Quality = 4x implicitly. Add a subtle hint below the tier toggle: "Draft: 2x upscale -- Quality: 4x upscale" so users understand the mapping. This is cleaner and consistent with the "preset parameters, no user configuration" philosophy.

**Option B:** Keep the Scale selector but remove the Draft/Quality toggle from upscale mode. Since both tiers use the same model, the tier concept adds no value for upscale. The Scale selector already does the job.

**Affects:**
- [x] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-2: "Professional Finish" label misleads about actual effect

**Severity:** Improvement
**Category:** Usability

**Problem:**
The label "Professional Finish" suggests a post-processing step or finishing touch applied to the generated image. In reality, it simply switches the model from Flux 2 Pro to Flux 2 Max, which produces higher-fidelity results but is not a "finish" step. The Canvas Header shortens it further to "Pro," which is even more ambiguous (could mean "Pro tier" or "Professional mode").

This mismatch between the label's implication (a refinement step) and its actual behavior (a different, more expensive model) will lead to incorrect mental models. Users may expect "Professional Finish" to be applied after generation as a polish step, or wonder why it cannot be applied to already-generated images.

**Context:**
> **From Discovery (line 19):**
> ```
> 2 Tiers: Draft (schnell/gueenstig iterieren) und Quality (Production/Finishing)
> + optionale Professional Finish Checkbox (Premium)
> ```
>
> **From Wireframe (line 220):**
> ```
> | Draft | Quality | [checkbox] Pro
> ```

**Impact:**
Users develop a wrong mental model of what the checkbox does. When they see no visible difference between Quality and Quality+Professional Finish, they may assume it is broken.

**Recommendation:**
Rename to something that communicates "higher quality model at higher cost" rather than a post-processing step:
- **"Max Quality"** -- directly communicates it is a quality upgrade
- **"Premium Model"** -- communicates cost and model-level difference
- Keep the Canvas Header label consistent (e.g., "Max" instead of "Pro")

**Affects:**
- [x] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-3: No Checkbox component exists in the UI library

**Severity:** Improvement
**Category:** Gap

**Problem:**
The Professional Finish feature requires a labeled checkbox component. The codebase has no `Checkbox` component in `components/ui/`. Discovery references the pattern as "Labeled Checkbox" and Wireframe annotates it as `professional-finish-checkbox`, but the underlying UI primitive does not exist.

This is not a blocker in the conceptual sense, but it is a gap that needs to be called out: a new UI primitive must be introduced. Without it, there is a risk of an ad-hoc implementation that does not follow the design system.

**Context:**
> **From Discovery (line 86):**
> ```
> | Professional Finish Checkbox | Labeled Checkbox, nur bei Quality sichtbar |
>   Konditionelle Sichtbarkeit basierend auf Tier-Auswahl |
> ```
>
> **Codebase check:** `Glob: components/ui/checkbox*` -- No files found.

**Impact:**
Implementation will require creating a new Shadcn Checkbox primitive (likely `npx shadcn-ui@latest add checkbox`). If not called out, developers may use a plain `<input type="checkbox">` that does not match the design system.

**Recommendation:**
Add the Shadcn `Checkbox` component to the UI library as a prerequisite in Slice 2 or Slice 3. Reference it explicitly in the Discovery "New Patterns" table as a dependency.

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed

---

### Finding F-4: Settings Dialog has no visual indicator for auto-save

**Severity:** Suggestion
**Category:** Usability

**Problem:**
The Settings Dialog uses auto-save on model selection (no Save/Cancel buttons). While this is a good pattern for low-risk settings, there is no visual feedback that the selection was saved. The wireframe shows the dropdown closing and the new model name appearing, but no confirmation toast, checkmark animation, or "Saved" indicator.

Users accustomed to dialogs with explicit Save buttons may close the dialog unsure whether their change was persisted.

**Context:**
> **From Discovery (line 163):**
> ```
> Footer: keiner noetig (Auto-Save bei Auswahl)
> ```
>
> **From Discovery (line 202):**
> ```
> settings-open | Close / Click outside | Modal schliesst. | previous state |
>   Model-Zuweisungen sofort gespeichert
> ```

**Impact:**
Minor uncertainty for first-time users. Most will learn the pattern quickly, but a brief save confirmation would eliminate doubt.

**Recommendation:**
Add a subtle inline feedback after model selection -- e.g., a brief checkmark icon or "Saved" text that fades after 1-2 seconds next to the dropdown. This is a common auto-save pattern (Google Docs, Notion). No toast needed -- inline feedback is sufficient.

**Affects:**
- [x] Wireframe change needed
- [ ] Discovery change needed

---

### Finding F-5: Shared tier state across Workspace and Canvas may surprise users

**Severity:** Suggestion
**Category:** Usability

**Problem:**
Discovery states that tier selection is shared across Workspace and Canvas within a session (line 211: "Tier-Auswahl gilt kontextuebergreifend"). This means switching to Quality in the Canvas persists when returning to the Workspace, and vice versa. While this is internally consistent, it may surprise users who think of Workspace and Canvas as separate contexts.

A user might set Quality in Canvas for a specific refinement, then return to Workspace for rapid drafting -- only to find they are still on Quality and generate an unexpectedly expensive image.

**Context:**
> **From Discovery (line 211):**
> ```
> Tier-Auswahl gilt kontextuebergreifend: Workspace und Canvas teilen den
> gleichen Tier-State pro Session
> ```

**Impact:**
Low. The default resets to Draft on app restart, limiting the blast radius. However, within a session, accidental Quality generations could occur.

**Recommendation:**
No change to the shared state behavior (it is the simpler model). Instead, consider adding a visual cost indicator next to the Generate button when Quality is active -- e.g., a small "$$$" or "Premium" badge. This makes the cost implication visible at the point of action, regardless of how the user arrived at Quality.

**Affects:**
- [x] Wireframe change needed (optional -- cost indicator)
- [ ] Discovery change needed

---

### Finding F-6: Settings Dialog unreachable from Canvas

**Severity:** Suggestion
**Category:** Gap

**Problem:**
The Settings button lives exclusively in the Workspace Header. When a user is deep in the Canvas Detail View and wants to change their model assignment, they must navigate back to Workspace first. This is not a critical issue since model settings are rarely changed, but it breaks the "always accessible" principle for configuration.

**Context:**
> **From Discovery (line 173):**
> ```
> | settings-button | Icon Button | Workspace Header | default, hover |
>   Oeffnet Settings-Dialog |
> ```
>
> **From Wireframe (line 65):**
> ```
> settings-button: Gear icon button [...] Positioned left of the theme toggle
>   in the right-side actions group.
> ```
> (Only in Workspace Header, not in Canvas Header)

**Impact:**
Minor. Model settings are a set-and-forget configuration. Most users will configure once and rarely change. However, power users iterating between models may find it inconvenient.

**Recommendation:**
Consider this for V2. If addressed now, a small gear icon in the Canvas Header (next to undo/redo) would be sufficient. But the current design is acceptable for an MVP.

**Affects:**
- [ ] Wireframe change needed (V2 consideration)
- [ ] Discovery change needed

---

## Positive Highlights

1. **Radical simplification done right.** Reducing 30+ model choices to a binary Draft/Quality toggle is a bold move that dramatically lowers cognitive load. The tier concept maps well to user intent ("I'm exploring" vs. "I want the best result").

2. **Clean state machine.** Four states, no ambiguity, no dead ends. The transition table is complete and the "any -> settings-open" wildcard is elegant.

3. **Settings as modal dialog (not a separate page).** For a configuration surface this small (3 modes x 2-3 tiers), a modal is the right pattern. It avoids the navigation overhead of a full settings page.

4. **Auto-save in Settings.** Correct choice for a low-risk, low-frequency configuration. Eliminates the "did I save?" problem.

5. **Smart removal of complexity.** Removing ParameterPanel and Multi-Model-Selection addresses real pain points without losing essential functionality. The preset parameter approach is defensible.

6. **Wireframe-Discovery consistency.** All 7 UI components from Discovery are represented in the wireframes. All screens are covered. Removed elements are explicitly documented.

---

## Professional Assessment

The concept is well thought through and addresses a genuine UX problem (model selection overload). The Draft/Quality metaphor is intuitive and the tiered pricing model (cheap iteration vs. expensive production) matches common creative workflows.

**Strategic fit:** Strong. The feature removes more UI than it adds, which is rare and valuable. The Settings Dialog creates a proper configuration surface that was missing entirely.

**Scalability:** Good. The mode x tier matrix (3 x 3) can accommodate future models without UI changes. The only scalability concern is if more tiers are needed (e.g., "Budget" below Draft), which would outgrow the binary toggle. However, the current two-tier model with an optional Max checkbox is flexible enough for the foreseeable future.

**Risk:** Low. The main risk is user confusion around the upscale mode (F-1), which is easily fixable. The remaining findings are polish-level improvements.

---

## Verdict

**CHANGES_REQUESTED**

Three Improvements need to be addressed before implementation:

1. **F-1 (Upscale conflict):** Resolve the contradiction between the Scale selector and the Draft/Quality toggle in upscale mode. This is a conceptual issue that will confuse users.
2. **F-2 (Label misleading):** Rename "Professional Finish" to better communicate "higher quality model" rather than "post-processing step."
3. **F-3 (Missing Checkbox):** Document the Checkbox UI component as a prerequisite in Discovery.

The three Suggestions (F-4, F-5, F-6) are non-blocking and can be addressed during implementation or deferred to V2.

**Next steps:**
1. Update Discovery + Wireframe to resolve F-1 (upscale mode controls)
2. Update labeling for F-2 in both documents
3. Add Checkbox dependency note to Discovery for F-3
4. Re-run UX Expert Review after changes
