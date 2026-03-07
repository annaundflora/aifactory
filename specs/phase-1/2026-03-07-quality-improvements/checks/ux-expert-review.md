<!-- AGENT_DEF_LOADED: ux-expert-review-de-v1 -->

# UX Expert Review: Quality Improvements

**Date:** 2026-03-07
**Reviewer:** UX Expert Agent
**Inputs:** `discovery.md`, `wireframes.md`

---

## Summary

**Verdict:** CHANGES_REQUESTED

| ID | Title | Severity |
|----|-------|----------|
| F-1 | Improve component lacks model context for adaptive optimization | Critical |
| F-2 | Template overwrites fields without confirmation or undo | Critical |
| F-3 | History loading overwrites unsaved work without warning | Improvement |
| F-4 | Builder output target changed but current Builder merges into single prompt field | Improvement |
| F-5 | Improve comparison layout breaks in narrow prompt column | Improvement |
| F-6 | No pagination or virtualization strategy for History list | Suggestion |
| F-7 | Sidebar collapsed state persistence not specified | Suggestion |

**Totals:** 2 Critical, 3 Improvement, 2 Suggestion

**High-Level Assessment:** The feature set is well-scoped and addresses real user pain points. The structured prompt field, history system, and sidebar collapse are strong improvements. However, two critical gaps exist: the Improve flow cannot deliver on its "model-aware" promise without receiving model context, and destructive template actions lack safeguards. Three improvement-level findings address friction points that will affect daily workflows.

---

## Workflow Analysis

### State Machine Evaluation

The state machine is well-structured with clear transitions and no dead ends. All states are reachable and all states have exit paths. Key observations:

**Reachability:** All 10 states are reachable from the initial `prompt-input` state within 1-2 transitions.

**Recovery paths:** Error states are handled (Improve error returns to `prompt-input` via toast, thumbnail failure falls back to placeholder silently). The `improve-loading` state correctly defines both success and error transitions.

**Potential gap:** The `improve-loading` state lists "Warten" (wait) as the only available action. There is no cancel/abort transition defined. If the LLM call takes 10+ seconds, users are trapped. This is partially mitigated by the existing `useTransition` pattern in `llm-comparison.tsx` which does not expose a cancel mechanism either, so this is consistent with current behavior -- but worth noting for future iteration.

### Flow Completeness

All 9 flows have clear start-to-end paths. The Template flow (Flow 6) and History loading flow (Flow 4) both involve overwriting user input, which is addressed in findings below.

---

## Findings

### Finding F-1: Improve component lacks model context for adaptive optimization

**Severity:** Critical
**Category:** Inconsistency / Workflow

**Problem:**
Discovery promises model-aware prompt improvement as a core differentiator -- the system should analyze the prompt AND consider the selected model. However, the current `LLMComparison` component and the `improvePrompt` server action only accept `{ prompt: string }`. The wireframe correctly shows "Optimized for: FLUX 2 Pro" (annotation 3), but no mechanism exists to pass `modelId` through the improve pipeline.

**Context:**
> **From Discovery (line 39):**
> ```
> Adaptiver Improve mit Prompt-Analyse und Modell-Beruecksichtigung
> ```
>
> **From Discovery (line 280):**
> ```
> Improve beruecksichtigt gewaehltes Modell im System-Prompt
> ```
>
> **From Codebase (`llm-comparison.tsx`, line 9-12):**
> ```typescript
> interface LLMComparisonProps {
>   prompt: string;
>   onAdopt: (improved: string) => void;
>   onDiscard: () => void;
> }
> ```
>
> **From Wireframe (line 443):**
> ```
> "Optimized for: FLUX 2 Pro" -- model-specific note
> ```

**Impact:**
Without `modelId` flowing into the Improve pipeline, the "adaptive" and "model-aware" promise cannot be fulfilled. The wireframe shows a model-specific label that would display incorrect or missing information. This is the headline differentiator of the Improve upgrade.

**Recommendation:**
Discovery must specify that the `improvePrompt` action and `LLMComparison` component need to accept `modelId` as an additional parameter. The Improve transition in the state machine (line 254) should include a business rule: "Passes currently selected modelId to LLM system prompt." The wireframe annotation for "Optimized for" is correct and should stay.

**Affects:**
- [x] Discovery change needed (specify modelId in Improve data flow)
- [ ] Wireframe change needed


---

### Finding F-2: Template overwrites fields without confirmation or undo

**Severity:** Critical
**Category:** Usability / Error Prevention

**Problem:**
When a user clicks a template, all three prompt fields are overwritten immediately (Motiv, Stil, Negative). If the user has spent time crafting a prompt, this is a destructive action with no safeguard. Discovery explicitly states "Ueberschreibt aktuelle Feldinhalte" as a business rule but provides no confirmation or undo mechanism.

**Context:**
> **From Discovery (line 255):**
> ```
> prompt-input | Klick Template | Felder werden befuellt | prompt-input | Ueberschreibt aktuelle Feldinhalte
> ```
>
> **From Discovery (line 78):**
> ```
> Dialog | shadcn Dialog | Bestaetigung bei Template-Ueberschreibung
> ```

**Impact:**
Wait -- Discovery line 78 actually lists "Dialog" for "Bestaetigung bei Template-Ueberschreibung" in the UI Patterns table. However, this confirmation dialog is never referenced in the state machine transitions, the user flow (Flow 6), or the wireframe. The pattern is declared but not wired into the actual flow.

**Recommendation:**
Add a confirmation step to Flow 6 and the state machine: If any prompt field contains text when the user clicks a template, show a shadcn Dialog: "This will replace your current prompt. Continue?" with Cancel/Apply buttons. If all fields are empty, apply directly without dialog. Update the wireframe to show this dialog state, or add it as a state variation to the Template Selection screen.

**Affects:**
- [x] Discovery change needed (wire Dialog into Flow 6 and state machine)
- [x] Wireframe change needed (add confirmation dialog state)


---

### Finding F-3: History loading overwrites unsaved work without warning

**Severity:** Improvement
**Category:** Usability / Error Prevention

**Problem:**
Loading a history entry overwrites all prompt fields, model selection, and parameters. Like templates, this is destructive if the user has unsaved work. Unlike templates, Discovery does not even mention a confirmation dialog for this action.

**Context:**
> **From Discovery (line 285):**
> ```
> Beim Laden eines History-Eintrags werden bestehende Feldinhalte ueberschrieben (kein Merge)
> ```
>
> **From Discovery (line 256):**
> ```
> history-view | Klick History-Eintrag | Felder werden befuellt, Tab wechselt | prompt-input | Laedt Motiv, Stil, Negative, Modell, Parameter
> ```

**Impact:**
Users who are iterating on a prompt and want to reference an old one will lose their current work. This is less severe than templates because history users are likely browsing intentionally, but the model/parameter override adds unexpected scope -- users may not realize clicking a history entry also changes their model selection.

**Recommendation:**
Two options (choose one):
1. **Minimal:** Add a toast with undo: "Prompt loaded. [Undo]" that reverts to previous field state within 5 seconds. This is lightweight and non-blocking.
2. **Safe:** Show the same confirmation dialog as templates when fields are non-empty.

Option 1 is recommended as it keeps the flow fast for power users while providing a safety net.

**Affects:**
- [x] Discovery change needed (add undo/confirmation to history loading)
- [ ] Wireframe change needed


---

### Finding F-4: Builder output target changed but transition behavior underspecified

**Severity:** Improvement
**Category:** Inconsistency

**Problem:**
The current `BuilderDrawer` composes selections into the main prompt field (appending comma-separated words). Discovery redefines Builder to output "ausformulierte Fragmente" (elaborated fragments) into the **Stil/Modifier field** specifically. However, the state machine transition (line 259) only says "Ausformulierte Fragmente ins Stil-Feld" without addressing what happens to existing content in the Stil field.

**Context:**
> **From Discovery (line 259):**
> ```
> builder-open | Klick "Done" / Schliessen | Drawer slides out, Stil-Feld aktualisiert | prompt-input | Ausformulierte Fragmente ins Stil-Feld
> ```
>
> **From Codebase (`builder-drawer.tsx`, line 53-55):**
> ```typescript
> interface BuilderDrawerProps {
>   open: boolean;
>   onClose: (prompt: string) => void;  // Currently returns to single prompt field
>   basePrompt: string;
> }
> ```

**Impact:**
Without specifying replace vs. append behavior, the developer must guess. If the user has manually typed style modifiers AND uses the Builder, should Builder output replace or append? This ambiguity will lead to inconsistent implementation.

**Recommendation:**
Add a business rule: "Builder output replaces the Stil/Modifier field content entirely. Manual additions to the Stil field are preserved only if the Builder is not used." Or alternatively: "Builder appends to existing Stil field content, separated by a period." The first option (replace) is cleaner and matches the existing Builder pattern.

**Affects:**
- [x] Discovery change needed (specify replace vs. append for Stil field)
- [ ] Wireframe change needed


---

### Finding F-5: Improve comparison uses side-by-side layout in narrow prompt column

**Severity:** Improvement
**Category:** Usability / Layout

**Problem:**
The current `LLMComparison` component uses a `grid-cols-2` (side-by-side) layout. Discovery says the prompt area is `w-80` (320px). The wireframe shows the improve comparison as a stacked layout (Original above, Improved below), which is correct for the narrow width. However, Discovery's description of "Side-by-Side Vergleich" (line 114) contradicts the wireframe's stacked approach.

**Context:**
> **From Discovery (line 114):**
> ```
> Verbesserter Prompt erscheint in Side-by-Side Vergleich (Original vs. Improved)
> ```
>
> **From Wireframe (lines 406-437):**
> ```
> The wireframe shows a stacked/vertical layout (Original on top, Improved below)
> ```
>
> **From Codebase (`llm-comparison.tsx`, line 64):**
> ```typescript
> <div className="grid grid-cols-2 gap-4">  // Side-by-side, ~160px per column at w-80
> ```

**Impact:**
At 320px width (or slightly wider with collapsed sidebar), side-by-side comparison gives each column roughly 140-160px -- barely enough for a single word per line. The wireframe's stacked approach is the correct solution. Discovery text should align.

**Recommendation:**
Update Discovery line 114 from "Side-by-Side Vergleich" to "Vergleich (Original oben, Improved unten)" to match the wireframe's stacked layout. The wireframe is correct here.

**Affects:**
- [x] Discovery change needed (change "Side-by-Side" to stacked layout description)
- [ ] Wireframe change needed


---

### Finding F-6: No pagination or virtualization strategy for History list

**Severity:** Suggestion
**Category:** Scalability

**Problem:**
History saves automatically on every generation. A power user generating 20+ images per day will accumulate hundreds of history entries within weeks. Discovery does not specify any pagination, lazy loading, or virtualization strategy for the history list.

**Context:**
> **From Discovery (line 276):**
> ```
> History speichert automatisch bei jeder Generation (kein User-Action noetig)
> ```
>
> **From Discovery (line 277):**
> ```
> History ist projektuebergreifend (alle Projekte)
> ```

**Impact:**
Cross-project history means the list grows even faster. At 500+ entries, a non-virtualized list in a `w-80` panel will cause scroll performance issues and make finding old prompts difficult. Not blocking for V1, but should be planned.

**Recommendation:**
Consider adding a note in Discovery: "History initially loads last 50 entries. Scroll-to-load-more fetches additional batches of 50." This is a simple cursor-based pagination pattern that prevents performance issues without adding UI complexity.

**Affects:**
- [ ] Wireframe change needed
- [ ] Discovery change needed (optional, non-blocking)


---

### Finding F-7: Sidebar collapsed state persistence not specified

**Severity:** Suggestion
**Category:** Usability

**Problem:**
Discovery does not specify whether the sidebar collapse state persists across sessions/page reloads. Users who prefer the collapsed view would need to re-collapse on every visit.

**Context:**
> **From Discovery (lines 266-267):**
> ```
> sidebar-expanded | Klick Collapse-Toggle | Sidebar animiert auf Icon-Mode | sidebar-collapsed
> sidebar-collapsed | Klick Expand-Toggle | Sidebar animiert auf volle Breite | sidebar-expanded
> ```

**Impact:**
Minor annoyance for users who consistently prefer one mode. The shadcn Sidebar component supports cookie-based persistence out of the box, so this is likely handled automatically -- but should be explicitly stated.

**Recommendation:**
Add a business rule: "Sidebar collapse state persists via cookie/localStorage across sessions." This aligns with shadcn Sidebar's built-in `defaultOpen` + cookie persistence pattern.

**Affects:**
- [ ] Wireframe change needed
- [ ] Discovery change needed (optional, non-blocking)


---

## Positive Highlights

1. **Structured prompt field** is an excellent upgrade. The Motiv/Stil/Negative separation maps directly to how image generation models process input and gives users a mental model that matches the underlying technology.

2. **History + Favorites as tabs** in the prompt area is smart spatial design -- it keeps prompt-related workflows co-located without adding navigation overhead.

3. **Builder writing to Stil field** specifically (rather than appending to main prompt) is a clean separation of concerns that prevents the "prompt soup" problem where builder tokens mix with subject descriptions.

4. **Conditional Negative Prompt** visibility based on model schema support is a thoughtful detail that reduces cognitive load for models that do not support it.

5. **Thumbnail generation from project name** is a creative touch that adds visual richness with zero user effort.

---

## Verdict

**CHANGES_REQUESTED**

**Reason:** 2 Critical findings and 3 Improvement findings require resolution before implementation.

**Required actions:**
1. **F-1 (Critical):** Add `modelId` to the Improve data flow in Discovery. Without this, the headline feature "model-aware improvement" cannot work.
2. **F-2 (Critical):** Wire the already-declared confirmation Dialog into the Template flow (Flow 6, state machine, wireframe). The pattern exists in UI Patterns but is not connected.
3. **F-3 (Improvement):** Add undo-toast or confirmation when loading history entries over non-empty fields.
4. **F-4 (Improvement):** Specify whether Builder output replaces or appends to the Stil field.
5. **F-5 (Improvement):** Align Discovery text with wireframe's stacked (not side-by-side) Improve comparison layout.

**Suggestions (non-blocking):**
- F-6: Consider pagination strategy for history list.
- F-7: Specify sidebar state persistence.
