<!-- AGENT_DEF_LOADED: ux-expert-review-de-v1 -->

# UX Expert Review: Prompt Assistant

**Feature:** Prompt Assistant
**Reviewed:** 2026-03-11
**Inputs:** `discovery.md`, `wireframes.md`
**Verdict:** CHANGES_REQUESTED

---

## Summary

The Prompt Assistant is a well-conceived feature that replaces two ineffective tools (Templates, Builder) with an agent-powered chat experience. The Canvas/Artifacts pattern for structured prompt editing alongside a conversation is the right choice for this problem space. The discovery is thorough in its agent definition, state machine, and business rules.

However, there are significant UX concerns around the 480px split-view layout (240px per panel is unusable), a missing confirmation for the destructive Apply action, the absence of a stop/cancel mechanism during streaming, and missing keyboard accessibility considerations. These must be addressed before implementation.

### Findings Overview

| ID | Title | Severity |
|----|-------|----------|
| F-1 | 480px split-view makes both panels unusable | Critical |
| F-2 | Destructive Apply overwrites all fields without confirmation | Critical |
| F-3 | No way to stop or cancel an in-progress streaming response | Improvement |
| F-4 | Model recommendation is view-only -- no action affordance | Improvement |
| F-5 | Session list has no delete/archive capability | Improvement |
| F-6 | "Verbessere meinen aktuellen Prompt" chip has no loading feedback | Improvement |
| F-7 | Chat input disabled during streaming blocks correction of mistakes | Suggestion |
| F-8 | No keyboard shortcut guidance or accessibility annotations | Suggestion |
| F-9 | Session-switcher dropdown behavior undefined in wireframes | Suggestion |

**Totals:** 2 Critical, 4 Improvement, 3 Suggestion

---

## Workflow Analysis

### State Machine Completeness

The state machine is well-defined with 11 states and clear transitions. I walked through every path mentally:

**Reachability:** All states are reachable. The flow from `sheet-closed` through `start`, `chatting`, `drafting`, `applied` and back is coherent.

**Escape routes:** Every state can reach `sheet-closed` via the Close button. The `session-switcher` provides a reset path from any state. Good.

**Recovery paths:** Error state has retry with a 3-attempt limit, then graceful degradation. Session loading failure falls back to start. These are solid.

**One gap in the state machine:** There is no transition from `drafting` directly to `applied` via the Apply button. The documented path goes `canvas-editing` -> `applied`, but a user who never touches the canvas fields (agent drafts, user is happy, user clicks Apply) would technically still be in `drafting` state, not `canvas-editing`. The Apply button should be available from `drafting` state directly.

> **Discovery, State Machine:**
> ```
> | `canvas-editing` | User klickt `apply-btn` | ... | `applied` |
> ```
> There is no `drafting` -> `applied` transition documented.

This is a minor modeling issue, not a blocking UX problem -- the wireframe shows the Apply button present in the drafting screen, which is correct. But the state machine document should reflect this valid path.

### Flow Quality

The three happy paths (guided creation, image analysis, prompt improvement) are well thought through and cover the primary use cases. The iterative loop (Step 13 in Happy Path 1) is a strong differentiator -- letting users return after generation to refine is exactly right.

---

## Findings

### Finding F-1: 480px split-view makes both panels unusable

**Severity:** Critical
**Category:** Usability / Layout

**Problem:**
Discovery specifies the sheet is fixed at 480px. When the canvas appears, the layout splits 50/50 into chat (~240px) and canvas (~240px). At 240px width, neither panel can function effectively: chat messages will be extremely narrow (maybe 15-20 characters per line before wrapping), and the canvas textareas will be too cramped to read or edit multi-line English prompts. This is the central interaction of the entire feature, and it will feel broken.

**Context:**
> **From Discovery (line 262-276):**
> ```
> Breite: Fix 480px
> ...
> Links: Chat-Thread (~50% Breite)
> Rechts: Prompt-Canvas (~50% Breite, erscheint erst wenn Draft existiert)
> ```
>
> **From Wireframe (line 266-307):**
> The drafting wireframe shows the split view within the 480px sheet.

> **From Codebase:**
> The existing Sheet component uses `sm:max-w-sm` (384px). The Model Browser Drawer already overrides this to `sm:max-w-lg` (512px). So there is precedent for wider sheets -- but even 512px split in half yields 256px panels.

**Impact:**
Users will struggle to read agent messages and edit prompt text simultaneously. The core value proposition of the Canvas/Artifacts pattern -- seeing both conversation and artifact side by side -- is defeated. Users may resort to constantly scrolling or may not realize fields are editable at all.

**Recommendation:**
Two options:

A) **Increase sheet width to 720-800px** for the split-view state. The sheet can be 480px in the `start` and `chatting` states (full-width chat is fine), then expand when the canvas appears. This mirrors how ChatGPT's canvas widens the panel.

B) **Use a stacked/tabbed layout** instead of side-by-side within 480px. A toggle or tabs (Chat | Canvas) lets each panel use the full 480px width. The Apply button remains persistent at the bottom regardless of active tab. Less ideal than side-by-side but functional at 480px.

Option A is strongly preferred -- it preserves the simultaneous view that makes the Canvas pattern powerful.

**Affects:**
- [x] Wireframe change needed
- [x] Discovery change needed (layout section)

---

### Finding F-2: Destructive Apply overwrites all fields without confirmation

**Severity:** Critical
**Category:** Usability / Error Prevention

**Problem:**
The Apply button overwrites all three workspace prompt fields (motiv, style, negativePrompt) unconditionally, including clearing fields when the canvas field is empty. If a user has carefully crafted content in their workspace fields (perhaps from a previous manual session), one click destroys it with no undo path. The business rule explicitly states: "Leere Canvas-Felder leeren auch das Workspace-Feld."

**Context:**
> **From Discovery (line 384):**
> ```
> Apply-Verhalten: Apply ueberschreibt alle drei Prompt-Felder
> (motiv, style, negativePrompt). Leere Canvas-Felder leeren
> auch das Workspace-Feld.
> ```
>
> **From Wireframe (line 320-321, annotation 10):**
> ```
> apply-btn: Primary button, transfers all canvas fields to workspace prompt fields
> ```

**Impact:**
Accidental data loss. Users who click Apply while a canvas field happens to be empty (e.g., the agent did not generate a negative prompt yet) will lose their existing negative prompt. There is no confirmation dialog and no undo. The codebase already has an AlertDialog component (`components/ui/alert-dialog.tsx`) that could be reused.

**Recommendation:**
1. When workspace fields already contain content, show a brief confirmation: "This will replace your current prompt fields. Continue?" using the existing AlertDialog pattern.
2. Alternatively (lighter weight): if any workspace field is non-empty, change the button label from "Apply" to "Replace Prompt" to signal the destructive nature.
3. Consider an undo mechanism: store the previous field values and offer a toast with "Undo" action (sonner is already in use in the codebase).

At minimum, option 3 (undo toast) should be implemented -- it follows the existing sonner toast pattern and is low-friction.

**Affects:**
- [x] Wireframe change needed (show confirmation or undo flow)
- [x] Discovery change needed (business rule for Apply with existing content)

---

### Finding F-3: No way to stop or cancel an in-progress streaming response

**Severity:** Improvement
**Category:** Usability / User Control

**Problem:**
During the `streaming` state, the chat input is disabled and the user must wait for the agent to finish responding. There is no stop/cancel button. LLM responses can take 5-15 seconds depending on complexity. If the user realizes mid-stream that they asked the wrong question or wants to rephrase, they are stuck waiting. This violates user control and freedom.

**Context:**
> **From Discovery (line 309):**
> ```
> chat-input: idle, composing (Text eingegeben), disabled (waehrend Streaming)
> ```
>
> **From Discovery, State Machine (line 340):**
> ```
> streaming: Agent-Antwort wird zeichenweise angezeigt -- Available Actions: Warten (Input disabled)
> ```

**Impact:**
Frustration during longer responses. Power users especially will feel trapped. Every major chat interface (ChatGPT, Claude, Gemini) provides a stop button during generation.

**Recommendation:**
Add a stop button that replaces the send button during streaming. On click: abort the SSE stream, keep whatever text has been generated so far as a truncated assistant message, and re-enable the input. This is a standard pattern in all LLM chat interfaces.

**Affects:**
- [x] Wireframe change needed (show stop button during streaming state)
- [x] Discovery change needed (add stop/cancel transition from streaming state)

---

### Finding F-4: Model recommendation is view-only -- no action affordance

**Severity:** Improvement
**Category:** Usability / Gap

**Problem:**
The model recommendation appears as a badge with text in the canvas, but there is no interaction to actually select that model. Discovery explicitly states the user must "manuell im Model-Browser waehlen." This creates a broken promise: the agent recommends "Flux Pro 1.1" but the user has to close the assistant, find the model browser, search for it, and select it. That is 4+ steps of friction after receiving a recommendation.

**Context:**
> **From Discovery (line 385):**
> ```
> Model-Empfehlung: Empfehlung ist ein Vorschlag, kein automatisches Umschalten.
> User muss Modell manuell im Model-Browser waehlen.
> ```
>
> **From Wireframe (line 295-298, annotation 9):**
> ```
> model-recommendation: Badge with recommended model name and short reasoning
> ```

**Impact:**
The recommendation feels like dead-end information. Users (especially beginners -- the target audience) will not know where to go to actually apply the recommendation. The helpful suggestion becomes a source of confusion.

**Recommendation:**
Make the model recommendation badge clickable. On click, either:
- A) Auto-select the recommended model in the workspace (one-click apply), or
- B) Open the Model Browser Drawer pre-filtered/scrolled to the recommended model.

Option A is simpler and more direct. Given the codebase already has `ModelBrowserDrawer` and model selection logic in `prompt-area.tsx`, wiring a "select this model" action is feasible. Add a small action text like "Use this model" below the badge.

**Affects:**
- [x] Wireframe change needed (clickable badge or "Use" link)
- [x] Discovery change needed (update business rule for model recommendation)

---

### Finding F-5: Session list has no delete or archive capability

**Severity:** Improvement
**Category:** Usability / Gap

**Problem:**
The session list displays all past sessions but offers no way to delete, archive, or manage them. Over time, power users will accumulate dozens of sessions. The list will become long and finding a relevant old session will require scanning through irrelevant ones. There is no search/filter either.

**Context:**
> **From Discovery (line 289-298):**
> ```
> Session-Liste: Chronologisch sortiert (neueste zuerst).
> Pro Eintrag: Erster User-Message als Titel, Datum, Prompt-Preview
> ```
>
> **From Wireframe (line 336-376):**
> Session list wireframe shows entries but no management actions.

> **From Discovery, DB schema (line 404):**
> ```
> status: enum "active", "archived"
> ```
> The data model already supports archiving, but the UI provides no way to trigger it.

**Impact:**
The `status: "active" | "archived"` enum in the database schema suggests archiving was planned but never surfaced in the UI. Without it, the session list grows indefinitely and becomes less useful. This is a classic information architecture problem that worsens with usage.

**Recommendation:**
Add a swipe-to-archive or context menu (long press / right-click) on session entries with an "Archive" option. Archived sessions disappear from the default list. Optionally add a "Show archived" toggle at the bottom of the session list.

**Affects:**
- [x] Wireframe change needed (add archive action to session entries)
- [ ] Discovery change needed (status enum already exists)

---

### Finding F-6: "Verbessere meinen aktuellen Prompt" chip has no visible loading feedback

**Severity:** Improvement
**Category:** Usability / Feedback

**Problem:**
When the user clicks the "Verbessere meinen aktuellen Prompt" suggestion chip, the system must read the current workspace fields, send them as context, and then display them in the canvas. Discovery describes this flow (Happy Path 3, step 4: "Agent laedt aktuelle Felder, zeigt sie im Canvas, analysiert"), but neither the wireframes nor the state machine define what the user sees during this loading phase. Unlike other chips that simply send a text message, this chip triggers a data-loading step that could take a moment.

**Context:**
> **From Discovery (lines 233-239):**
> ```
> Happy Path: Prompt verbessern
> 3. User klickt "Verbessere meinen aktuellen Prompt"
> 4. Agent laedt aktuelle Felder, zeigt sie im Canvas, analysiert
> ```
>
> **From Wireframe:**
> No specific wireframe exists for the "improve existing prompt" flow entry point.

**Impact:**
The user clicks the chip and there may be a brief dead moment before anything appears in the chat. If workspace fields are empty when this chip is clicked, the behavior is also undefined -- does the agent say "I don't see any prompt fields to improve"?

**Recommendation:**
1. Add a transition note: clicking this chip should immediately show the chip text as a user message (like other chips), then the agent responds with the loaded fields. The streaming indicator covers the wait.
2. Define the empty-fields edge case: if all workspace prompt fields are empty when this chip is clicked, the agent should gracefully redirect: "I don't see any prompt in your workspace yet. Would you like me to help you create one?"

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed (edge case for empty workspace fields)

---

### Finding F-7: Chat input disabled during streaming blocks correction of mistakes

**Severity:** Suggestion
**Category:** Usability / Flexibility

**Problem:**
The input is fully disabled during streaming. In modern chat interfaces, users have learned to queue their next message while the assistant is still responding. Disabling the input forces sequential interaction and feels slow for experienced users.

**Context:**
> **From Discovery (line 309):**
> ```
> chat-input: idle, composing (Text eingegeben), disabled (waehrend Streaming)
> ```

**Impact:**
Minor friction for power users. Not a blocking issue since the streaming state is typically short (5-15 seconds), but it feels less responsive than comparable tools.

**Recommendation:**
Allow the user to type (but not send) during streaming. The send button remains disabled until streaming completes. This way, the user can prepare their next message. An even better approach: allow sending to queue the message, which is delivered immediately after the current stream completes.

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed (allow composing during streaming)

---

### Finding F-8: No keyboard shortcut guidance or accessibility annotations

**Severity:** Suggestion
**Category:** Usability / Accessibility

**Problem:**
Discovery mentions "Enter = Send, Shift+Enter = Newline" for the chat input, but there are no broader keyboard accessibility considerations. The sheet, session list, suggestion chips, and canvas fields all need keyboard navigation. Since this feature replaces two existing UI elements (Builder, Templates), removing them without ensuring the new feature is keyboard-accessible could be a regression.

**Context:**
> **From Discovery (line 309):**
> ```
> Enter = Send, Shift+Enter = Newline
> ```
>
> No other keyboard interactions are defined.

**Impact:**
Accessibility gap. Users who rely on keyboard navigation (power users, users with motor disabilities) may struggle with the new assistant. Since this is a suggestion-level concern for MVP, it does not block, but should be tracked.

**Recommendation:**
Add a brief keyboard interaction section to Discovery covering: Tab order through sheet elements, Escape to close sheet, Enter on suggestion chips, focus management when canvas appears (where does focus go?).

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed (add keyboard interaction notes)

---

### Finding F-9: Session-switcher dropdown behavior undefined in wireframes

**Severity:** Suggestion
**Category:** Usability / Gap

**Problem:**
The session-switcher is shown in the header of every screen as "[Sessions dropdown]" but its exact interaction is not wireframed. It is unclear whether clicking it opens the session list view (replacing chat), shows an inline dropdown with recent sessions, or does something else. The discovery mentions both a "session-switcher" button/dropdown in the header and a separate "Vergangene Sessions anzeigen" link on the startscreen -- these seem redundant and potentially confusing.

**Context:**
> **From Discovery (line 319):**
> ```
> session-switcher: Button/Dropdown -- Default -- Opens Session-Liste or creates new Session
> ```
>
> **From Wireframe (line 148-149):**
> ```
> session-switcher: Dropdown/button to switch sessions or create new one.
> ```
>
> **From Wireframe (line 138):**
> ```
> "Vergangene Sessions anzeigen" link on startscreen
> ```

**Impact:**
Minor confusion during implementation. The developer will need to decide what the session-switcher actually does. Low severity because the session list view is clearly wireframed -- it is just the entry point that is ambiguous.

**Recommendation:**
Clarify: the session-switcher in the header should be a simple button that navigates to the session list view (same as clicking "Vergangene Sessions anzeigen"). No need for a dropdown -- keep it simple. The "Vergangene Sessions" link on the startscreen is the same action, just placed contextually for new users. Both should navigate to the same session-list screen.

**Affects:**
- [x] Wireframe change needed (annotate session-switcher behavior)
- [ ] Discovery change needed

---

## Gaps and Inconsistencies

### Gap: No ScrollArea component exists in the codebase

The chat thread requires a scrollable container with auto-scroll behavior. The codebase has no `ScrollArea` component (confirmed via search). Discovery lists it in the UI Patterns table as a reused component but it does not exist. Either a custom scroll container or a new Radix ScrollArea component will need to be created.

### Inconsistency: Sheet default max-width vs. specified 480px

The existing Sheet component enforces `sm:max-w-sm` (384px) by default. Discovery specifies 480px. The Model Browser already overrides to `sm:max-w-lg` (512px). The implementation will need a custom width class. This is not a UX issue but an implementation note worth flagging since the wireframes assume 480px as a given.

### Gap: No "new session" shortcut from chatting/drafting state

The state machine defines `session-switcher -> "Neue Session"` from "Jeder State", but the wireframes for the chatting and drafting screens only show the session-switcher dropdown in the header. It is not clear how a user who is mid-conversation realizes they can start a fresh session. A "New Session" option should be explicitly visible, not buried inside a dropdown, especially since the target audience is beginners.

---

## Scalability and Risks

### Risk: 100-message session limit may be too low for iterative workflows

The business rule limits sessions to 100 messages. The iterative loop (generate, come back, refine, repeat) is positioned as a key workflow. Each iteration cycle could consume 4-6 messages (user feedback, agent response, draft update, confirmation). After ~15-20 iterations, the user hits the limit. For complex creative projects this may be restrictive. Consider making this a soft limit (warning at 80, suggestion to start new session at 100) rather than a hard cutoff.

### Risk: Session list without search will not scale

Sessions are per project, and multiple people with project access see all sessions. In a team environment (even without formal team features), the session list could grow rapidly. With no search, filter, or archive mechanism in the UI, finding past sessions becomes progressively harder. The DB schema supports `status: "archived"` but the UI does not expose it (covered in F-5).

### Scalability positive: LangGraph State architecture is future-proof

Storing chat state in LangGraph's PostgresSaver with a lightweight metadata table (`assistant_sessions`) is architecturally sound. It separates concerns cleanly and allows the feature to evolve (adding tools, changing agent behavior) without DB migrations for message storage.

---

## Expert Assessment

### Is this the right solution?

Yes. The move from static templates and mechanical fragment-builders to an agent-powered conversational assistant is exactly right for the stated problem. Beginners who face empty prompt fields need guidance, not more dropdowns. The Canvas/Artifacts pattern is proven (ChatGPT, Claude) and appropriate here because the prompt has clear structure (motiv, style, negative) that benefits from a persistent, editable artifact alongside the conversation.

### Strategic fit

The feature differentiates AI Factory from tools that offer only empty text fields or rigid template systems. The image analysis capability adds particular value -- it bridges the gap between "I like this image but don't know how to describe it" and a structured prompt. This is a genuine insight about beginner needs.

### What was done well

- **Agent personality definition** is thoughtful. "Creative partner, not questionnaire" with adaptive behavior based on user expertise is the right tone.
- **Non-linear phase model** is mature UX thinking. Forcing users through rigid steps is a common mistake; this avoids it.
- **Error paths** are comprehensively defined with graceful degradation (LLM fallback chain, retry logic, streaming error recovery).
- **Business rules** are detailed and specific (rate limits, file size limits, session limits). This reduces ambiguity during implementation.
- **Iterative loop** as a first-class concept (not an afterthought) shows understanding of the creative workflow.

---

## Verdict

**CHANGES_REQUESTED**

**Reason:** 2 Critical findings must be resolved before implementation:
1. **F-1 (Split-view at 480px):** The core interaction pattern is broken at this width. Either widen the sheet or switch to a tabbed layout.
2. **F-2 (Destructive Apply):** Overwriting user content without confirmation or undo is a data-loss risk. Add undo-toast at minimum.

**Additionally, 4 Improvements should be addressed:**
3. F-3: Add stop/cancel for streaming
4. F-4: Make model recommendation actionable
5. F-5: Add session archive/delete
6. F-6: Define edge case for "improve empty prompt"

**Next Steps:**
1. Resolve F-1 by deciding on sheet width strategy (recommend: expand to 720-800px when canvas appears)
2. Add undo-toast pattern for Apply (F-2)
3. Add stop button wireframe for streaming state (F-3)
4. Update model recommendation to be clickable (F-4)
5. Re-review after changes
