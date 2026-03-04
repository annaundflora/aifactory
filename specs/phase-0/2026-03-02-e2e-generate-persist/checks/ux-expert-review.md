<!-- AGENT_DEF_LOADED: ux-expert-review-de-v1 -->

# UX Expert Review: E2E Generate & Persist (Phase 0)

**Date:** 2026-03-03
**Reviewer:** UX Expert Agent
**Verdict:** CHANGES_REQUESTED

---

## Summary

| ID | Title | Severity |
|----|-------|----------|
| F-1 | No cancel mechanism for blocking generation | Critical |
| F-2 | Variant count control visibility rule creates confusion | Improvement |
| F-3 | Snippet edit and delete missing from flows | Improvement |
| F-4 | Prompt Builder "Surprise Me" silently destroys user input | Improvement |
| F-5 | No keyboard shortcut or Cmd+Enter for Generate | Suggestion |
| F-6 | No project rename capability | Suggestion |
| F-7 | Lightbox lacks image navigation (prev/next) | Suggestion |

**Totals:** 1 Critical, 3 Improvement, 3 Suggestion

**Assessment:** The concept is well-structured for a personal tool -- clean flows, sensible state machine, and a solid architectural foundation. The critical finding (no generation cancel) is a genuine UX blocker given that Replicate blocking calls can take 10-60 seconds. The improvements are real friction points that will impact daily workflow quality.

---

## Workflow Analysis

### State Machine Reachability

The state machine is well-defined. I walked through all transitions and verified:

- **Reachability:** All states are reachable from `project-list`.
- **Escape routes:** Every overlay state (lightbox, builder, improving-prompt, prompt-improved) has a clear exit path back to the workspace.
- **Correct branching:** `generating` correctly branches to either `workspace-populated` (success) or `generation-failed` (error).

### Identified Gap: The `generating` State Is a Trap

The `generating` state has **no user-initiated exit**. Discovery explicitly states:

> **Discovery, Line 292:**
> ```
> generating | Loading-Placeholder(s) in Galerie, Generate-Button disabled | Warten (kein Cancel moeglich bei Blocking API)
> ```

This is the only state in the entire machine that the user cannot voluntarily leave. Replicate blocking calls for models like FLUX 2 Pro or Recraft V4 can take 15-60+ seconds. During this time, the user is stuck -- they cannot edit their prompt, open the builder, or navigate away without losing the pending generation. This is addressed in detail in F-1.

### Flow Completeness

All 7 user flows are well-defined with clear start/end states. Error paths are covered for the core generation pipeline (API failure, R2 failure, LLM failure, rate limits).

**Missing micro-flows:**
- Snippet CRUD only covers Create and Use, not Edit/Delete (F-3)
- No flow for navigating between images in lightbox (F-7)

---

## Findings

### Finding F-1: No cancel mechanism for blocking generation

**Severity:** Critical
**Category:** Workflow

**Problem:**
When the user clicks Generate, the system enters a blocking state with no escape. The `generating` state explicitly offers zero user actions -- the generate button is disabled, and Discovery notes "kein Cancel moeglich bei Blocking API." For a personal tool where the user will iterate rapidly (generate, tweak prompt, generate again), being locked out for 15-60 seconds with no recourse is a significant workflow blocker. If the user realizes they made a typo in the prompt 2 seconds after hitting Generate, they must wait for the full API call to complete.

**Context:**
> **From Discovery (Line 292):**
> ```
> generating | Loading-Placeholder(s) in Galerie, Generate-Button disabled | Warten (kein Cancel moeglich bei Blocking API)
> ```
>
> **From Wireframe (Line 186):**
> ```
> generating | generate-btn shows spinner + disabled. generation-placeholder appears at top of gallery with skeleton animation
> ```

**Impact:**
User frustration during the core workflow loop. Every generation cycle locks the entire prompt area. With batch generations (1-4), this compounds -- 4 sequential blocking calls could lock the UI for minutes.

**Recommendation:**
Even with a blocking API call on the server, the **client UI** does not need to be locked. Two approaches:

1. **Optimistic unlock (recommended):** After the API call is dispatched (server action triggered), immediately re-enable the prompt textarea and Generate button. The placeholder in the gallery tracks the pending generation independently. The user can start composing their next prompt or even trigger another generation. The server handles the blocking call asynchronously from the user's perspective.

2. **Cancel with abandon:** Add a "Cancel" action on the placeholder card. This tells the client to discard the result when it arrives (the Replicate call cannot be cancelled, but the UI can stop waiting). Mark placeholder as "Cancelled" and re-enable controls.

Either approach preserves the `replicate.run()` blocking pattern server-side while unblocking the user.

**Affects:**
- [x] Discovery change needed (state machine, generating state actions)
- [x] Wireframe change needed (placeholder states, button states during generation)

---

### Finding F-2: Variant count control visibility rule creates confusion

**Severity:** Improvement
**Category:** Usability

**Problem:**
The variant count selector (1-4) is hidden when a project has zero generations and only appears after the first generation exists. This creates two issues:

1. **Discoverability:** The user will not know batch generation exists until after their first single generation. There is no progressive disclosure -- the control simply appears with no introduction.
2. **Mental model mismatch:** Even on first use, a user might want to generate 2-3 variants of their initial idea. The restriction "only visible when > 0 generations exist" ties a prompt input control to gallery state, which is a conceptual mismatch.

**Context:**
> **From Discovery (Line 181):**
> ```
> Varianten-Anzahl: Slider/Dropdown 1-4 (nur sichtbar wenn > 0 Generierungen existieren)
> ```
>
> **From Wireframe (Line 190):**
> ```
> variant-count hidden | not rendered (no existing generations in project)
> ```

**Impact:**
Users miss the batch feature on first use. When the control suddenly appears after the first generation, it may cause momentary confusion ("what changed?").

**Recommendation:**
Always show the variant count control, defaulting to 1. This is simpler to implement, more discoverable, and does not break any business logic -- generating 3 images from scratch is as valid as generating 3 variations.

**Affects:**
- [x] Discovery change needed (remove visibility condition for variant-count)
- [x] Wireframe change needed (always render variant-count)

---

### Finding F-3: Snippet edit and delete missing from flows

**Severity:** Improvement
**Category:** Workflow gap

**Problem:**
Flow 5 (Prompt-Baustein erstellen) covers creation of custom snippets, but there is no defined flow or UI for editing or deleting them. The data model defines snippet fields but no mutation operations beyond create. Over time, the user will accumulate snippets -- some with typos, some outdated -- with no way to manage them.

**Context:**
> **From Discovery (Line 126-131):**
> ```
> Flow 5: Prompt-Baustein erstellen
> 1. User oeffnet Prompt Builder -> Tab "Meine Bausteine"
> 2. User klickt "Neuer Baustein"
> 3. User gibt ein: Snippet-Text + Kategorie
> 4. Baustein wird gespeichert
> 5. Beim naechsten Prompt-Bauen: Klick auf Baustein fuegt Snippet zum Prompt hinzu
> ```
>
> **From Wireframe (My Snippets Tab):**
> ```
> snippet-chip: User-created snippets grouped by category. Click toggles selection.
> ```

No edit/delete affordance is shown on snippet chips or anywhere in the builder.

**Impact:**
Snippet list becomes cluttered with no cleanup mechanism. User must live with typos in snippets forever.

**Recommendation:**
Add a minimal management layer to snippet chips: long-press or secondary action (e.g., small "x" on hover, or a context menu with Edit/Delete). This can be as simple as:
- Hover on `snippet-chip` reveals a delete icon
- Click delete icon shows inline confirmation
- Edit opens the snippet-form pre-filled

**Affects:**
- [x] Discovery change needed (add snippet edit/delete flow)
- [x] Wireframe change needed (show edit/delete affordance on snippet-chip)

---

### Finding F-4: Prompt Builder "Surprise Me" silently destroys user input

**Severity:** Improvement
**Category:** Usability (User Control)

**Problem:**
The "Surprise Me" button replaces all existing prompt builder selections with random ones. If the user has carefully selected 3-4 options across Style and Colors, one accidental click on "Surprise Me" destroys that work with no undo.

**Context:**
> **From Discovery (Line 341):**
> ```
> Surprise Me: Ersetzt bestehende Prompt-Builder-Auswahl durch zufaellige Kombination
> ```
>
> **From Discovery (Line 320, State Machine):**
> ```
> builder-open | Klick "Surprise Me" | Zufaellige Auswahl in allen Kategorien | builder-open | Bestehende manuelle Auswahl wird ersetzt
> ```

**Impact:**
Accidental activation causes loss of carefully curated selections. Minor frustration but repeated occurrence degrades trust in the tool.

**Recommendation:**
Two lightweight options:
1. **If selections exist, confirm first:** "Replace current selections with random ones?" (simple confirm/cancel)
2. **Or: make it additive** -- Surprise Me only randomizes categories where nothing is selected yet, preserving existing choices.

Option 1 is simpler and sufficient for a personal tool.

**Affects:**
- [x] Discovery change needed (add confirmation or additive behavior rule)
- [ ] Wireframe change needed

---

### Finding F-5: No keyboard shortcut for Generate

**Severity:** Suggestion
**Category:** Usability (Efficiency)

**Problem:**
The core workflow loop is: type prompt, hit Generate, review, tweak, repeat. For a personal power-tool, requiring a mouse click on the Generate button every cycle adds friction. There is no mention of keyboard shortcuts anywhere in Discovery or Wireframes.

**Recommendation:**
Add Cmd/Ctrl+Enter as a keyboard shortcut to trigger generation from the prompt textarea. This is a well-established pattern in AI tools (ChatGPT, Midjourney Discord, Stable Diffusion WebUI).

**Affects:**
- [x] Discovery change needed (add keyboard shortcut to business rules or UI behavior)
- [ ] Wireframe change needed

---

### Finding F-6: No project rename capability

**Severity:** Suggestion
**Category:** Workflow gap

**Problem:**
Projects can be created and deleted, but not renamed. Discovery and Wireframes define no rename flow. For a personal tool, this is a minor gap -- the user can delete and recreate, but that destroys all generations.

**Recommendation:**
Add inline rename on the project card or sidebar (double-click project name to edit, or an edit icon). Low effort, avoids the costly workaround of delete-and-recreate.

**Affects:**
- [x] Discovery change needed (add rename flow/transition)
- [x] Wireframe change needed (show rename affordance)

---

### Finding F-7: Lightbox lacks prev/next image navigation

**Severity:** Suggestion
**Category:** Usability (Efficiency)

**Problem:**
The lightbox modal shows a single image with details and actions. To view the next image, the user must close the lightbox, click another thumbnail, and wait for the lightbox to reopen. When reviewing a batch of 4 generated variants, this is 12 extra clicks (close + click + wait, repeated 3 times).

**Context:**
> **From Wireframe (Lightbox, Line 234-241):**
> Only close (X), download, variation, and delete actions are defined. No prev/next navigation.

**Recommendation:**
Add left/right arrow navigation within the lightbox (keyboard arrows + optional chevron buttons on the image sides). Standard gallery pattern.

**Affects:**
- [x] Discovery change needed (add lightbox navigation transition)
- [x] Wireframe change needed (add prev/next arrows)

---

## Gaps & Inconsistencies

### Minor Inconsistency: Workspace States

Discovery defines both `workspace-empty` and `workspace-ready` as separate states, but the wireframe only shows `workspace-empty` as a state variation. The `workspace-ready` state (prompt entered, but no generations yet) has no distinct visual representation in the wireframe. This is acceptable since the visual difference is simply a filled prompt field, but the wireframe could note this for completeness.

### Covered Well: Error Handling

The error handling concept is thorough for a Phase 0 tool. Toast notifications for API errors, inline retry on failed placeholders, and graceful LLM failure handling are all well-specified. The error paths in the state machine correctly lead back to actionable states.

### Covered Well: Destructive Actions

Both project deletion and generation deletion require confirmation dialogs. The confirmation dialog wireframe includes contextual information (project name, generation count), which is good practice for destructive actions.

---

## Scalability & Risks

### Gallery Performance at Scale

The masonry grid will grow continuously as the user generates more images per project. With hundreds of generations, the gallery could become slow to render and difficult to navigate. Discovery does not mention pagination, infinite scroll, or any gallery size management.

**Risk level:** Low for Phase 0 (personal tool, likely <100 images per project initially), but worth noting for Phase 1 planning. Consider lazy loading or virtualized scrolling when generation counts grow.

### Dynamic Parameter Panel Complexity

Loading parameter schemas dynamically from Replicate is a strong architectural choice that avoids hardcoding. However, Replicate model schemas can include 15-30+ parameters with nested dependencies. The wireframe shows a clean 2-column layout, but real schemas may overflow this significantly.

**Risk level:** Medium. Some models will produce parameter panels that are much longer than shown in the wireframe. Consider a collapsible "Advanced Parameters" section or scrollable panel area.

### Prompt Builder Category Scaling

The builder currently has 3 tabs (Style, Colors, My Snippets). If more built-in categories are added later (Perspective, Lighting, Effects -- as mentioned in the Kittl research), the tab bar will need to accommodate growth. The current tab pattern works for 3-5 tabs but will break with more.

**Risk level:** Low. Addressable later with a scrollable tab bar or dropdown.

---

## Strategic Assessment

### Is This the Right Solution?

Yes. For a personal POD design workflow, building a custom tool with model control, persistent storage, and a prompt builder is the right approach. The decision to start with a blocking API and iterate toward webhooks later is pragmatic. The scope is well-constrained for Phase 0.

### Design Strengths

1. **Clean information architecture:** The two-level hierarchy (Project Overview -> Workspace) is simple and sufficient. The sidebar provides persistent context while working.
2. **Prompt Builder concept:** The Kittl-inspired concatenation approach is transparent and gives the user full control. The live preview in the drawer is a good touch.
3. **LLM improvement flow:** The side-by-side comparison with explicit adopt/discard is better than auto-replacement. It respects user agency.
4. **Persistence by default:** Auto-saving every generation to R2 + DB solves the core pain point (images going lost) without any user action.

### What Could Be Improved Strategically

The only strategic concern is the **iteration speed** of the core loop. This tool will be used for rapid iteration -- generate, evaluate, tweak, generate again. Every friction point in that loop (no keyboard shortcut, locked UI during generation, modal-based image review) compounds across hundreds of daily generations. The findings above (F-1, F-5, F-7) all target this core loop speed.

---

## Verdict

**CHANGES_REQUESTED**

**Reason:** 1 critical finding (F-1: no cancel/unlock during generation) blocks the core workflow. 3 improvement findings address real friction in daily use.

**Required before implementation:**
1. **F-1 (Critical):** Define how the UI behaves during generation -- at minimum, unlock prompt editing while generation is in flight.
2. **F-2 (Improvement):** Reconsider variant count visibility rule.
3. **F-3 (Improvement):** Add snippet edit/delete to flows and wireframes.
4. **F-4 (Improvement):** Add safeguard for Surprise Me when selections exist.

**Nice to have (can be deferred):**
- F-5: Keyboard shortcut for Generate
- F-6: Project rename
- F-7: Lightbox prev/next navigation
