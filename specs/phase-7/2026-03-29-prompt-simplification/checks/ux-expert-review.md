<!-- AGENT_DEF_LOADED: ux-expert-review-de-v1 -->

# UX Expert Review: Prompt Field Simplification

**Feature:** Prompt-Felder Vereinfachung
**Date:** 2026-03-29
**Reviewer:** UX Expert Agent
**Discovery:** `discovery.md` | **Wireframes:** `wireframes.md`

---

## Summary

**Verdict:** APPROVED

| ID | Title | Severity |
|----|-------|----------|
| F-1 | Prompt History entry click should not attempt to restore removed fields | S: Suggestion |
| F-2 | Assistant system prompt still instructs 3-field output | S: Suggestion |
| F-3 | No migration path communicated for users with existing Style/Negative habits | S: Suggestion |

**Totals:** 0 Critical, 0 Improvement, 3 Suggestions

**High-level assessment:** This is a well-scoped simplification that removes a real source of API errors (~65% of models rejecting `negative_prompt`) while simultaneously reducing UI complexity. The discovery is thorough in identifying affected files, the wireframes accurately reflect the reduced surface, and the concept is sound. The few findings below are suggestions for polish, not blockers.

---

## Workflow Analysis

### User Flows

**Primary flow (txt2img):** Type prompt -> Generate -> View result.
After simplification, this flow becomes strictly simpler: one field, no collapsibles, no confusion about what goes where. The user can include style keywords and negative instructions directly in the prompt text -- which is actually how modern models (Flux, Imagen, etc.) expect prompts to be written. Flow is complete, no dead ends.

**Primary flow (img2img):** Add references -> Type prompt -> Generate -> View result.
Same simplification applies. The reference bar is untouched. No issues.

**Assistant flow:** Chat with assistant -> Assistant drafts prompt -> Apply to workspace -> Generate.
Currently the assistant produces `{ motiv, style, negative_prompt }` which maps to 3 fields. After simplification, it produces a single `{ prompt }` which maps to one field. The flow is complete. The "Apply" button maps a single value to a single textarea -- simpler than before.

**Prompt History flow:** Open history -> Click entry -> Fields populated.
Currently restores 3 fields. After simplification, history entries only have `promptMotiv`. This works, but see F-1 for a minor consideration.

**Improve flow:** Click "Improve" -> LLM comparison -> Apply suggestion.
This flow uses `promptMotiv` as input. Simplification does not change this path. The LLMComparison component already works from a single prompt string.

### State Machine Assessment

All states are reachable and leavable. No dead ends introduced:
- `empty` -> `typing` -> `generating` -> `result` (via Generate button)
- `assistant-draft` -> `applied` -> `typing` (via Apply button, then editing)
- Any state -> `empty` (via Clear button)

The removal of collapsible states (`styleOpen`, `negativeOpen`) eliminates two interaction states, which is a net simplification.

---

## Findings

### Finding F-1: Prompt History entry click should not attempt to restore removed fields

**Severity:** S: Suggestion
**Category:** Consistency

**Problem:**
After the DB migration drops `prompt_style` and `negative_prompt` columns, existing history entries lose those values. New entries never have them. The `PromptHistoryEntry` interface and the click handler in `prompt-area.tsx` currently restore all 3 fields (lines 848-850). After simplification, the click handler will only set `promptMotiv`, which is correct. However, Discovery does not explicitly mention updating the PromptTabs component (which renders history entries) to stop displaying style/negative badges or preview text if they existed.

**Context:**
> **From Discovery (line 53):**
> ```
> Prompt History Service: Style/Negative aus History-Eintraegen entfernen
> ```
>
> **From codebase (`prompt-area.tsx` lines 848-850):**
> ```typescript
> setPromptMotiv(entry.promptMotiv);
> setPromptStyle(entry.promptStyle ?? "");
> setNegativePrompt(entry.negativePrompt ?? "");
> ```

**Impact:**
Minimal. After the migration, these fields will be `null`/empty, so the old code would set empty strings anyway. But the PromptTabs component might still render empty columns or badges. This is cosmetic, not functional.

**Recommendation:**
Ensure the PromptTabs/PromptHistory UI component removes any display logic for style/negative fields alongside the data removal. This is likely covered implicitly by the scope ("Prompt History Service: Style/Negative aus History-Eintraegen entfernen") but worth confirming during implementation.

**Affects:**
- [ ] Wireframe change needed
- [ ] Discovery change needed

---

### Finding F-2: Assistant system prompt still instructs 3-field output

**Severity:** S: Suggestion
**Category:** Consistency

**Problem:**
The discovery correctly identifies that `prompts.py` needs updating (line 136: "System-Prompt: 3-Felder-Anweisung auf 1 Feld"). The current system prompt at line 39 explicitly says "Strukturiere den Prompt in drei Felder: motiv, style, negative_prompt" and at line 45 includes detailed instructions about negative prompts. This is well-scoped in Discovery already, but the wireframe for the "Assistant Draft Apply" screen does not annotate how the streaming SSE contract changes (from `{ motiv, style, negative_prompt }` to `{ prompt }`).

**Context:**
> **From Discovery (line 44):**
> ```
> Assistant Backend: prompts.py System-Prompt anpassen (keine 3-Felder-Anweisung)
> ```
>
> **From Wireframe (lines 180-181):**
> ```
> - (1) draft-prompt: Single prompt block. Previously showed 3 blocks (motiv, style, negative). Now one unified prompt.
> - (2) apply-button: Applies draft to prompt textarea. Previously had to map 3 fields.
> ```

**Impact:**
None on UX correctness -- Discovery covers this. The suggestion is about wireframe completeness: since the SSE contract change is a breaking change (Risk table, line 191), the wireframe could benefit from an annotation showing the new data shape `{ prompt: string }` vs old `{ motiv, style, negative_prompt }` to help developers understand the visual-to-data mapping.

**Recommendation:**
Consider adding a brief annotation to the "Assistant Draft Apply" wireframe noting the new SSE payload shape. This bridges the gap between what the developer sees in the wireframe and the data contract defined in Discovery.

**Affects:**
- [ ] Wireframe change needed (optional enrichment, not required)
- [ ] Discovery change needed

---

### Finding F-3: No migration path communicated for users with existing Style/Negative habits

**Severity:** S: Suggestion
**Category:** UX / Change Management

**Problem:**
Users who have been actively using the Style/Modifier and Negative Prompt fields will suddenly find them gone. There is no mention of any transitional UX (tooltip, changelog notice, or one-time hint) explaining that style/negative keywords should now be included directly in the main prompt field. While the change is objectively simpler, experienced users may initially wonder where their workflow went.

**Context:**
> **From Discovery (lines 19-24):**
> ```
> Solution:
> - Style/Modifier und Negative Prompt UI-Felder entfernen
> - Nur noch ein einziges Prompt-Feld (promptMotiv)
> ```

**Impact:**
Low. Most modern AI image generation tools (Midjourney, DALL-E, Ideogram) already use a single prompt field, so the mental model shift is minimal. Power users of older SD-based models who relied on negative prompts may be briefly confused, but the assistant can guide them.

**Recommendation:**
Consider updating the placeholder text from "Describe your image..." to something slightly more guiding like "Describe your image, including style and mood..." to hint that all prompt aspects belong in one field. This is a micro-copy optimization, not a blocker.

**Affects:**
- [ ] Wireframe change needed (placeholder text tweak, optional)
- [ ] Discovery change needed

---

## Consistency Check: Discovery vs. Wireframes

| Aspect | Discovery | Wireframe | Consistent? |
|--------|-----------|-----------|-------------|
| Single prompt field replaces 3 fields | Yes (line 21) | Yes (Screen: After) | Yes |
| Label changes from "Motiv" to "Prompt" | Implicit | Explicitly shown (annotation 1) | Yes |
| Collapsible sections removed | Yes (line 38) | Before/After comparison shows removal | Yes |
| Prompt Tools row unchanged | Not explicitly stated | Annotation 2 says "Unchanged" | Yes |
| img2img layout matches txt2img prompt area | Implicit | Separate wireframe confirms it | Yes |
| Assistant draft shows single block | Yes (lines 47-48) | Yes (Assistant Draft Apply screen) | Yes |
| State variations documented | Partially (not in Discovery) | Yes (empty, typing, generating, assistant-draft) | Good -- wireframe adds value |

No contradictions found between Discovery and Wireframes.

---

## Scalability and Risks

**Scalability: Good.** The single-field approach is the industry standard for modern image generation. It scales well because:
- New models can be added without worrying about `negative_prompt` support detection
- The prompt field is model-agnostic -- all formatting responsibility moves to the user/assistant
- The assistant integration is simpler (1 field to map vs 3)

**Risk assessment from Discovery is accurate.** The identified risks (data loss in old generations, SSE contract breaking change, history DISTINCT change) are correctly assessed as low-to-medium severity with appropriate mitigations.

**One long-term consideration:** If a future model re-introduces a "system negative prompt" or "safety prompt" concept (as some enterprise models do), the architecture should handle it at the API/service layer, not by re-adding UI fields. Discovery's "Out of Scope" section correctly excludes model-specific input validation, which is the right boundary.

---

## Expert Assessment

**Is this the right solution?** Yes, unambiguously. The 3-field UI was an artifact of the Stable Diffusion era where `negative_prompt` was a dedicated API parameter. With 65% of current models not supporting it, and the field actively causing API errors, removal is the correct action -- not just a simplification, but a bug fix.

**Balance of convention vs. innovation:** This moves the UI toward the established convention (single prompt field, as in Midjourney, DALL-E, ChatGPT image gen, Ideogram). No innovation risk here -- this is aligning with user expectations formed by dominant tools.

**Slice structure is sound.** UI-first (Slice 1) ensures users immediately benefit from the simplified interface. DB migration (Slice 2) is correctly separated since it requires careful deployment. Assistant changes (Slice 3) can follow independently. The slices have clean boundaries.

---

## Positive Highlights

- **Root cause identified:** The discovery correctly traces the bug from "API errors on ~65% of models" to "sending unsupported `negative_prompt` field" -- this is not just a UX cleanup but fixes a real production issue.
- **Before/After wireframes:** Showing both states makes the change immediately clear to developers and stakeholders.
- **Comprehensive file listing:** Every affected file is identified with specific change descriptions, making implementation planning straightforward.
- **State variations documented in wireframe:** The wireframe goes beyond static screens by showing `empty`, `typing`, `generating`, and `assistant-draft` states.
- **Risk table is honest:** Acknowledging data loss in old generations and accepting it as low-impact is the right call.

---

## Verdict

**APPROVED**

The design concept is sound, well-researched, and correctly scoped. The wireframes accurately reflect the simplification described in Discovery. All three findings are suggestions for polish -- none block implementation. The feature addresses a real production bug (API errors on 65% of models) while simultaneously improving UX by reducing cognitive load from 3 prompt fields to 1.

**Next Steps:**
- Proceed with implementation per the 3-slice plan
- Consider the placeholder text suggestion from F-3 during Slice 1 implementation
- Ensure simultaneous frontend+backend deployment for Slice 3 (SSE contract change)
