<!-- AGENT_DEF_LOADED: ux-expert-review-v1 -->

# UX Expert Review: Interactive Prompt Refinement in Assistant with Per-Project Context

**Feature:** Interview-based assistant chat for prompt refinement with per-project context
**Spec folder:** `specs/2026-04-19-29-interactive-prompt-refinement-project-context/`
**Reviewer role:** Senior UX Expert (read-only)
**Date:** 2026-04-19

---

## Summary

**Verdict:** CHANGES_REQUESTED

**Strategic assessment:** The concept is strong and strategically well-positioned. The Discovery identifies a real market gap (no competitor does elicitation-based prompt interviewing), the research foundation is solid (INTENT-SIM, Google 2025, BFL Kontext), and the architectural reuse of LangGraph, multimodal pipelines, and Apply-flow is pragmatic. The Intent-Summary-Card is the right primary UX artifact. However, several workflow gaps block successful task completion, and the wireframes leave critical states and recovery paths underspecified for a credit-gated, generative product.

### Findings Overview

| ID | Title | Severity | Category |
|----|-------|----------|----------|
| F-1 | No abort path for `generating` state — credits can be wasted on recognized mistakes | Critical | Workflow |
| F-2 | Intent-Summary-Card has no edit affordance; every correction forces a full discussion round-trip | Critical | Usability |
| F-3 | Paste-Detect-Confirm-Card is an unrecoverable forced choice with no "dismiss / not sure yet" escape | Critical | Workflow |
| F-4 | Helper-Modal "Use this" silently overwrites existing textarea content — data-loss risk | Critical | Usability |
| F-5 | Concurrent-generation block (decided in OQ#5) not reflected in FSM or wireframes | Critical | Gap |
| F-6 | "Nochmal diskutieren" discards context: user has no way to say WHAT should change | Improvement | Usability |
| F-7 | Non-vision model silently drops multimodal input — user will assume assistant "sees" references when it doesn't | Improvement | Usability |
| F-8 | No-Context-Banner dismiss is session-scoped — user sees it every new session forever | Improvement | Usability |
| F-9 | Project-Context-Settings has no dirty-state / unsaved-changes protection on Cancel and navigation | Improvement | Workflow |
| F-10 | Settings-Diff in Intent-Summary shows only new values, not "old → new" — user cannot judge the change | Improvement | Usability |
| F-11 | Card language is mixed (DE chrome, EN prompt, mixed axis labels) — inconsistent within a single artifact | Improvement | Consistency |
| F-12 | FSM has no explicit "session end / satisfied" state; transition relies on fuzzy NL detection | Improvement | Workflow |
| F-13 | Intent-Summary-Card in a narrow right-side panel will overflow for full 6-axis + long prompt + diff payloads | Improvement | Scalability |
| F-14 | Paste-confirm card disappears on click, Intent-Summary-card stays — inconsistent history behaviour for two very similar artifacts | Improvement | Consistency |
| F-15 | Error state "reference slot invalid URL" is defined in Discovery but has no wireframe representation | Improvement | Gap |
| F-16 | No way to invoke "Help me write this" from an empty textarea without clicking it twice (tiny button next to massive field) | Suggestion | Usability |
| F-17 | Paste heuristic likely false-positives on comma-heavy German descriptions ("heller, moderner, skandinavischer Stil") | Suggestion | Usability |
| F-18 | "Last updated" timestamp is shown even when content is unchanged across many sessions — no indicator of whether context is stale | Suggestion | Scalability |

**Totals:** 5 Critical, 10 Improvement, 3 Suggestion

Per the verdict rule (CHANGES_REQUESTED when >=1 Critical OR >=1 Improvement), this review requests changes.

---

## Workflow Analysis

### State-Machine Reachability

I walked every transition. Reachability of all 7 FSM states is structurally fine, but three paths are problematic:

**1. `generating` has no exit except "pipeline completes / pipeline fails".** Neither `generating → summarizing` (back-out) nor `generating → idle` (abort) is defined. Given the product is credit-gated, this is a critical omission (see F-1).

**2. `summarizing → interviewing` loses all context.** The "Discuss again" button sends a fixed generic message `"Okay, was soll anders sein?"`. The user has no inline mechanism to say *what* they want to change; they must retype free-form. See F-6.

**3. `reviewing → idle` via NL satisfaction ("Perfekt, speichern").** Relying on LLM-side natural-language detection for session closure is fragile and non-observable to the user (no explicit "Done" button). See F-12.

### Recovery Paths

| Failure | Recovery defined? | Sufficient? |
|---------|-------------------|-------------|
| Generate pipeline fails | Yes (error toast + manual generate button) | Yes |
| LLM can't build Intent-Summary | Yes (falls back to interview) | Yes |
| Multimodal budget overflow | Yes (oldest-first drop) | Yes — but user is not told |
| Help-me-write-this fails | Yes (retry) | Yes |
| User pastes prompt — Paste-Confirm wrong choice | **No** (card disappears, no undo) | **No** (see F-3) |
| User clicks "So generieren" by accident | **No** (no abort in `generating`) | **No** (see F-1) |
| User already has project context, Helper-Accept destroys it | **No** (silent overwrite) | **No** (see F-4) |

---

## Findings (Detailed)

### Finding F-1: No abort path for `generating` state — credits can be wasted on recognized mistakes

**Severity:** Critical
**Category:** Workflow

**Problem:**
Once the user clicks "So generieren" on the Intent-Summary-Card, the FSM enters `generating` and the pipeline runs to completion. There is no user action to abort. If the user notices one second later that the prompt has a typo, a wrong model, or the wrong slot role, they must watch credits burn and wait for the result anyway.

**Context:**
> **From Discovery (FSM, line 249):**
> ```
> `generating` | Chat-Thread zeigt "Generiere…", Workspace zeigt Generate-Progress |
> (keine User-Aktion zwingend, User kann weiter tippen)
> ```
>
> **From Wireframe (Intent-Summary `pending` state, line 220):**
> ```
> `pending` | after Generate click: buttons disabled, Primary shows spinner
> ("Generiere…"), card remains visible while generation runs
> ```

**Impact:**
In a credit-based product, a single wasted run is real money. Worse, it's a small but constant stream of user frustration and support burden. It also undermines the business value proposition (line 25: "weniger verbrauchte Credits"): a feature designed to reduce wasted credits introduces a new way to waste them.

**Recommendation:**
- Add `generating → summarizing (aborted)` transition with "Abbrechen" ghost button inside the pending card. Backend must support cooperative cancellation or at minimum mark the run as user-aborted and surface it that way in history.
- If technical cancel is impossible for this pipeline, still show an Abort button that flips card state to `abort_requested` and prevents re-triggering — at least the psychological control loop is closed, and the in-flight run's result is clearly marked "cancelled, shown for reference".

**Affects:**
- [x] Wireframe change needed (add abort button, abort state)
- [x] Discovery change needed (add `generating → summarizing` transition; define abort semantics)

---

### Finding F-2: Intent-Summary-Card has no edit affordance; every correction forces a full discussion round-trip

**Severity:** Critical
**Category:** Usability

**Problem:**
The Intent-Summary-Card shows 6 axes + a prompt preview + a settings diff. Users frequently will agree with 90% and want to tweak one thing — swap "burgundy" for "navy", fix a typo in the prompt preview, change model from flux-2-pro to flux-schnell. The only available paths are:
1. Click "So generieren" and accept the imperfection (wastes credits, see F-1)
2. Click "Nochmal diskutieren" and re-describe the whole intent via chat (high friction)

There is no inline-edit path. This violates the "recognition over recall" principle and the "user control" heuristic.

**Context:**
> **From Discovery (line 116–117):**
> ```
> 7. Wenn LLM sicher genug ist: Intent-Summary-Card mit Zusammenfassung
>    + Buttons "So generieren" / "Nochmal diskutieren"
> 8. User klickt "So generieren": Assistant ruft finalize-Tool auf → Auto-Apply
> ```
>
> **From Wireframe (lines 198–200):**
> ```
> ┌──────────────────┐  ┌──────────────────────────┐
> │ ⑤ So generieren  │  │ ⑥ Nochmal diskutieren    │
> └──────────────────┘  └──────────────────────────┘
> ```

**Impact:**
The user who said "illu, dark academia" and got back a perfectly-OK summary with one wrong word is forced into a multi-turn chat loop to change that one word. This defeats the speed-of-iteration value the feature is built for. In practice, many users will either (a) ship with the wrong word and regenerate later (wastes credits) or (b) abandon the summary and type the prompt manually (abandons the feature).

**Recommendation:**
Add one of the following (in preference order):
1. **Inline-edit on the prompt preview.** A small "Edit" link under the monospace block opens the text for direct editing; clicking "So generieren" then uses the edited text. Minimal scope, maximum ROI.
2. **Click-to-edit on each axis row** (e.g., click on "Palette: burgundy, umber, muted gold" to edit inline). Larger scope but aligns better with the axis model.
3. **A third button "Anpassen" that opens a compact edit sheet.** Useful if inline-edit hurts chat-thread layout.

Given the card is already the primary UX artifact, (1) is the minimum viable answer and should be treated as part of this feature.

**Affects:**
- [x] Wireframe change needed
- [x] Discovery change needed (new UI component state, new business rule about edit-before-generate)

---

### Finding F-3: Paste-Detect-Confirm-Card is an unrecoverable forced choice with no "dismiss / not sure yet" escape

**Severity:** Critical
**Category:** Workflow

**Problem:**
The Paste-Detect-Confirm card has exactly two buttons: "Direkt verfeinern" and "Interview starten". There is no third option ("Ich weiß noch nicht / einfach weitermachen"), no keyboard-dismiss, no "don't ask again", and after a click the card disappears entirely (Wireframe line 155: "card itself does not remain in history once a button has been clicked"). If the user misclicked or second-guesses their choice, there is no way back.

**Context:**
> **From Wireframe (lines 130–138):**
> ```
> ┌─ ① paste_confirm_card ──────────────────────────────┐
> │   💡 Das sieht nach einem fertigen Prompt aus.      │
> │   ┌──────────────────────┐  ┌────────────────────┐  │
> │   │ ②  Direkt verfeinern │  │ ③ Interview starten│  │
> │   └──────────────────────┘  └────────────────────┘  │
> └─────────────────────────────────────────────────────┘
> ```
>
> **From Wireframe (line 155):**
> ```
> `dismissed` | card replaced by the normal assistant response (refine result
> or first interview question) — card itself does not remain in history once
> a button has been clicked
> ```

**Impact:**
This is a forced modal-style interaction inside a chat thread, which itself is a contextual mismatch. On a false-positive (see F-17), the user is surprised by an interruption they didn't want, must pick one of two branches they may not care about, and can't back out. False-positives are likely (German comma-heavy descriptions trigger the heuristic). Once a user has been burned twice, they will lose trust in the feature.

**Recommendation:**
- Add a subtle "X" close affordance in the card's top-right corner. "X" = treat like "Interview starten" (safer default, because interview can still recognize concrete intent and short-circuit per Discovery line 261).
- Persist the card in history as a disabled display ("you chose: Interview") — same pattern as Intent-Summary. Consistency across the two cards matters (see F-14).
- Consider a per-session "Don't ask me again" toggle inside the card for power users.

**Affects:**
- [x] Wireframe change needed
- [x] Discovery change needed (add dismiss transition + history-persistence rule)

---

### Finding F-4: Helper-Modal "Use this" silently overwrites existing textarea content — data-loss risk

**Severity:** Critical
**Category:** Usability

**Problem:**
The Helper-Modal's "Use this" button (annotation ③) "writes draft into `context_textarea`" (Wireframe line 342). The wireframe doesn't specify whether existing content is replaced or appended. The Discovery flow (line 145) implies replacement ("zeigt Draft im Hauptfeld zum Editieren"). If the user already typed something (or has previously saved content), clicking "Use this" silently destroys it with no undo.

**Context:**
> **From Wireframe (lines 330–334):**
> ```
> ┌────────────┐  ┌──────────────┐  ┌───────────┐
> │ ④ Cancel   │  │ ⑤ Regenerate │  │③ Use this │
> └────────────┘  └──────────────┘  └───────────┘
> ```
>
> **From Wireframe (line 342):**
> ```
> ③ `helper_accept_btn`: closes modal, writes draft into `context_textarea`
>    (user can still edit before Save)
> ```
>
> **From Discovery (line 145):**
> ```
> 5. Backend-Call an LLM → Draft zurück → zeigt Draft im Hauptfeld zum Editieren
> ```

**Impact:**
Data loss. "Help me write this" is explicitly pitched as low-friction feature adoption; a user who has already drafted 500 words manually and clicks "Help me write this" out of curiosity to compare will lose their draft. They will not expect silent overwrite because the button is labeled "Use this" (suggests paste-to-insert), not "Replace everything".

**Recommendation:**
Three options, pick one:
1. **If existing content is non-empty, show an inline confirm inside the modal before closing** ("Dein aktueller Text wird ersetzt — übernehmen / abbrechen?").
2. **Change button label to "Replace" when content exists, "Use draft" when empty** — explicit about what will happen.
3. **Append with visible separator** — safe default, but may produce weird concatenations. Worst of the three.

Option 1 is recommended because it's explicit and zero-surprise.

**Affects:**
- [x] Wireframe change needed
- [x] Discovery change needed (define Helper-Accept overwrite semantics)

---

### Finding F-5: Concurrent-generation block (decided in OQ#5) not reflected in FSM or wireframes

**Severity:** Critical
**Category:** Gap

**Problem:**
Open Question #5 is decided: "Block mit Hinweis bis bestehende Gen fertig — verhindert verlorene Credits" (Discovery line 415). But nothing in the FSM or the wireframes shows what this "block with hint" looks like. Which state? Which UI? What does the Intent-Summary-Card's Generate button display while a previous generation is running? Can the user queue in chat input, or is typing blocked too?

**Context:**
> **From Discovery (line 415):**
> ```
> 5 | Wie verhält sich das Feature bei Concurrent-Generation (User hat bereits
>   Gen laufen, klickt "So generieren" in Card)? | A) Queue B) Block mit Hinweis
>   C) Abort-first-or-second | B | Block mit Hinweis bis bestehende Gen fertig
> ```

**Impact:**
An undefined behavior in a critical path. At minimum, the Generate button state and user feedback must be specified. Without this, the implementer will invent behavior that may or may not match the decision, and QA has no reference. A user who sits in front of two generations in flight with no clear signal will click repeatedly, file a bug, or lose trust.

**Recommendation:**
Add to Discovery:
- A new FSM state or state-variation for Intent-Summary-Card: `generate_blocked_by_concurrent` with clear UI copy ("Eine Generierung läuft noch — warte kurz").
- Clarify: does the block apply across all Intent-Summary-Cards in the thread, or only to the active one?
- Define the unblock transition (previous generation completes → button re-enables).

Add to Wireframe:
- Visual state for the Intent-Summary-Card's Primary button when blocked (ghost state with tooltip / inline hint).

**Affects:**
- [x] Wireframe change needed
- [x] Discovery change needed (new state or state-variation, transitions)

---

### Finding F-6: "Nochmal diskutieren" discards context: user has no way to say WHAT should change

**Severity:** Improvement
**Category:** Usability

**Problem:**
Clicking "Nochmal diskutieren" sends a generic assistant message: "Okay, was soll anders sein?" (Discovery line 224). The user must then retype their concern in free-form. Nothing about *which axis* they want to revisit is captured. For a user who clicked Discuss specifically because "Palette is wrong", there's friction: they click, then type "palette should be cooler", then wait for a new summary. Two turns for one fix.

**Context:**
> **From Discovery (line 224):**
> ```
> `intent_summary_card.discuss_btn` | ... Sendet strukturierte Assistant-Nachricht
> "Okay, was soll anders sein?", zurück in Interview-Modus.
> ```

**Impact:**
Usability hurdle. Works, but wastes a turn every time the user disagrees with one specific thing. Related to F-2 (lack of inline edit), but even with inline edit, "Discuss" needs to be more conversational.

**Recommendation:**
Instead of a single generic "Discuss" button, make the axis rows themselves clickable (same as F-2 option 2): clicking "Palette: burgundy, umber, muted gold" returns to interview state *with* a pre-filled assistant message: "Let's rework the palette. What direction — cooler, warmer, more muted, more saturated?". This pre-focused return avoids the wasted turn.

Minimum viable version: keep the single "Discuss" button, but let the user optionally click an axis first to highlight it, then click Discuss — assistant's return message then references the highlighted axis.

**Affects:**
- [x] Wireframe change needed (or at least: annotate "which axis" interaction)
- [x] Discovery change needed (refine discuss_btn behavior)

---

### Finding F-7: Non-vision model silently drops multimodal input — user will assume assistant "sees" references when it doesn't

**Severity:** Improvement
**Category:** Usability

**Problem:**
Business rule line 288: "wenn User ein Non-Vision-Modell gewählt hat und ReferenceBar oder Result-Image angehängt werden sollen, fällt der Multimodal-Anhang still weg; Assistant arbeitet rein textuell in diesem Turn (kein Hard-Block, kein Error)".

The user has uploaded reference images specifically for this chat. They will ask questions like "match the palette of slot 1" and get weird, ungrounded responses because the LLM cannot actually see slot 1. No hint, no warning, no badge.

**Context:**
> **From Discovery (line 288):**
> ```
> Modell-Wahl: wenn User ein Non-Vision-Modell gewählt hat und ReferenceBar
> oder Result-Image angehängt werden sollen, fällt der Multimodal-Anhang
> still weg; Assistant arbeitet rein textuell in diesem Turn (kein Hard-Block,
> kein Error)
> ```

**Impact:**
Silent degradation is worse than a hard error in almost every case. The user cannot debug why the assistant "doesn't understand" their references. This also undermines the core feature value — the entire ReferenceBar-Multimodal pipeline is the second-most-sold aspect of this feature (Discovery line 15).

**Recommendation:**
- Add a passive indicator: when slots are filled AND the selected model is non-vision, show a small inline notice in the Assistant panel header or near the Chat-Input: "Current model does not support images. Pick a vision model to let the assistant discuss your reference slots." — with a one-click switch to the nearest vision-capable model.
- Alternatively, a per-turn hint message from the assistant: "I notice you've set reference slots but my current model can't see them. Switch to a vision model?"

This is not a hard block (respecting the product decision) but it closes the visibility gap.

**Affects:**
- [x] Wireframe change needed (add passive indicator to Assistant Panel)
- [ ] Discovery change needed (optional: refine business rule with "visibility" qualifier)

---

### Finding F-8: No-Context-Banner dismiss is session-scoped — user sees it every new session forever

**Severity:** Improvement
**Category:** Usability

**Problem:**
The banner is dismissible "Session-Scope, nicht persistent" (Discovery line 214) — which means a user who has consciously decided NOT to set a project context will see the banner again on every new session, forever. That's the opposite of the stated intent ("um nicht zu nerven").

**Context:**
> **From Discovery (line 214):**
> ```
> Dismissible: Kann pro Session weggeklickt werden (Session-Scope, nicht
> persistent), um nicht zu nerven
> ```

**Impact:**
Medium annoyance, but recurring. Users who don't want project context will learn to ignore the banner entirely, which reduces its value as an adoption nudge for the users who *would* want context. Low cost to fix.

**Recommendation:**
Three options:
1. **Per-project persistent dismiss** — if the user clicks "don't show for this project", remember it. Context still has a path into the feature (Workspace header icon, Project list edit).
2. **Time-decay dismiss** — e.g. hide for 7 days after dismiss, then re-show.
3. **Dismiss forever per project, but always show on empty-response edge case** — e.g. if assistant answer quality signals "I could have used context here", re-surface.

Option 1 is the minimum viable answer and aligns with the stated "nicht nerven" intent.

**Affects:**
- [ ] Wireframe change needed (behavior, not layout)
- [x] Discovery change needed (business rule on dismiss scope)

---

### Finding F-9: Project-Context-Settings has no dirty-state / unsaved-changes protection on Cancel and navigation

**Severity:** Improvement
**Category:** Workflow

**Problem:**
The Cancel button (Wireframe line 269) has no defined semantics for "user has edited 500 words and presses Cancel". The back-link ("← Back to project") similarly has no dirty-state guard. No navigation away prompt. No beforeunload warning.

**Context:**
> **From Wireframe (lines 269–273):**
> ```
>                                     ┌────────┐  ┌──────────────────┐
>                                     │ Cancel │  │  ④  Save Context │
>                                     └────────┘  └──────────────────┘
> ```

**Impact:**
Data loss if user accidentally clicks Cancel or navigates away — especially painful if "Help me write this" was just used to generate a draft the user then edited. 500 words gone.

**Recommendation:**
- On Cancel or back-link with unsaved changes: show confirm "Unsaved changes will be lost — continue?".
- On route change via navigation: same confirm.
- Optional: auto-save-draft to localStorage so re-entering the view restores.

**Affects:**
- [x] Wireframe change needed (define Cancel with-dirty-state behavior)
- [x] Discovery change needed (business rule on dirty-state handling)

---

### Finding F-10: Settings-Diff in Intent-Summary shows only new values, not "old → new" — user cannot judge the change

**Severity:** Improvement
**Category:** Usability

**Problem:**
The Settings-Diff axis of the Intent-Summary-Card shows entries like:
```
• Slot 1 role → style-reference
• Slot 2 role → subject-reference
• Model      → flux-2-pro
```
But the user doesn't know what Slot 1 role was before. If Slot 1 was already `style-reference`, this line is noise. If Slot 1 was `subject-reference` and the assistant proposed flipping the roles of two slots, that's a big decision the user should see clearly.

**Context:**
> **From Wireframe (lines 194–197):**
> ```
> ④ Settings diff
>     • Slot 1 role → style-reference
>     • Slot 2 role → subject-reference
>     • Model      → flux-2-pro
> ```
>
> **From Wireframe (line 213):**
> ```
> ④ `settings_diff`: shown only when the assistant has proposed or set
> workspace settings (slot roles, strengths, model params). Omitted on pure
> txt2img without settings changes.
> ```

**Impact:**
User either blindly accepts (dangerous in a credit-gated flow) or mentally re-reads the whole workspace to figure out what's changing. Diminishes trust in the card's summary.

**Recommendation:**
Show diffs as `old → new`:
```
• Slot 1 role: subject-reference → style-reference
• Slot 2 role: (unset) → subject-reference
• Model: claude-sonnet-4.6 → flux-2-pro
```
Omit unchanged entries. Keep "unset" or `—` for previously empty fields. Simple, high-clarity change.

**Affects:**
- [x] Wireframe change needed
- [ ] Discovery change needed

---

### Finding F-11: Card language is mixed (DE chrome, EN prompt, mixed axis labels) — inconsistent within a single artifact

**Severity:** Improvement
**Category:** Consistency

**Problem:**
The Intent-Summary-Card mocks show:
- Header in German: "Zusammenfassung — stimmt das?"
- Axis labels in English: "Subject, Medium, Style, Lighting, Composition, Palette"
- Axis values in English: "moody library interior, dark academia"
- Prompt preview in English (correct per business rule)
- Settings labels in English: "Slot 1 role → style-reference"
- Buttons in German: "So generieren" / "Nochmal diskutieren"

This mixes two languages within a single small artifact. Jarring, and uncertain for i18n later.

**Context:**
> **From Discovery (line 280):**
> ```
> Interview-Sprache folgt User-Sprache (Default DE), finaler Prompt-String
> ist immer Englisch
> ```
>
> **From Wireframe (lines 173, 177–181, 184, 193–196, 199):**
> ```
> Zusammenfassung — stimmt das?
>     • Subject:     moody library interior
>     • Medium:      illustration
>   [prompt draft, EN]
>     • Slot 1 role → style-reference
>  ┌──────────────────┐  ┌──────────────────────────┐
>  │ ⑤ So generieren  │  │ ⑥ Nochmal diskutieren    │
> ```

**Impact:**
Looks unpolished. Creates ambiguity for future i18n: should axis labels be translated too? Users on a DE UI seeing "Subject" and "Lighting" next to "Zusammenfassung" get a "half-translated" impression.

**Recommendation:**
Align to the Discovery rule: UI chrome follows user language, prompt text is English. Translate axis labels (Subject → Motiv, Style → Stil, Lighting → Licht, etc.) in DE mode. Keep the prompt preview in English (that's an explicit rule).

If the team prefers English-only labels for technical clarity, make it explicit and remove the German "Zusammenfassung" / "So generieren" etc. Pick one — don't mix.

**Affects:**
- [x] Wireframe change needed (make the language rule explicit in mocks)
- [x] Discovery change needed (extend i18n rule to card chrome)

---

### Finding F-12: FSM has no explicit "session end / satisfied" state; transition relies on fuzzy NL detection

**Severity:** Improvement
**Category:** Workflow

**Problem:**
The FSM transition `reviewing → idle` is described as "User sagt 'Perfekt, speichern' o.ä. | Assistant bestätigt". This requires natural-language detection on the assistant side for "satisfaction". NL satisfaction detection is noisy: "das ist gut, aber noch..." might be classified as satisfied, ending the flow prematurely. And the user has no explicit button to say "I'm done with this intent, move on".

**Context:**
> **From Discovery (line 271):**
> ```
> `reviewing` | User sagt "Perfekt, speichern" o.ä. | Assistant bestätigt |
> `idle` (Session offen, aber Flow ruht)
> ```

**Impact:**
Fragile state machine. Also: no explicit "I'm done" affordance means the user can't cleanly move to a new intent within the same session. They either open a new session (overhead) or keep talking into the existing reviewing state.

**Recommendation:**
- Add an explicit "New intent" affordance in the Assistant header or after a successful generation ("Thumbs up" / "Start a new prompt").
- Keep NL detection as a soft signal but gate the state transition on the explicit action.
- Alternatively, treat `reviewing → idle` as implicit/invisible (user just types something new, FSM resets) and remove the NL-detection transition entirely.

**Affects:**
- [ ] Wireframe change needed (optional: add "new intent" affordance)
- [x] Discovery change needed (clarify FSM transition trigger)

---

### Finding F-13: Intent-Summary-Card in a narrow right-side panel will overflow for full 6-axis + long prompt + diff payloads

**Severity:** Improvement
**Category:** Scalability

**Problem:**
The right-side Assistant panel is narrow (per Wireframe "Position: Rechte Panel-Seite im Workspace"). A full-blown Intent-Summary-Card contains:
- Header
- 6 axis rows (each potentially multi-line, e.g., "Palette: burgundy, muted gold, umber, olive, ivory")
- Prompt preview in monospace (can be 5–10 lines)
- Settings diff (up to 5+ rows)
- Two buttons

Rendered in a narrow panel, this card will dominate the viewport and push earlier chat history far off-screen. Users lose conversational context while reading their summary.

**Context:**
> **From Discovery (line 174):**
> ```
> Position: Inline im Chat-Thread als vom Assistant generierte Card-Message
> ```
>
> **From Wireframe (Intent Summary Card, lines 171–202):**
> ```
> [full card rendering spans 30+ visual lines]
> ```

**Impact:**
Medium. Usability degrades on smaller screens / users with narrower panels. Also accessibility concern — scrolling through the card with a screen reader is long-winded.

**Recommendation:**
- Make axes-list collapsible with sensible default (e.g., Subject + Medium + Style expanded, others collapsed under "Mehr anzeigen").
- Prompt preview: show first 2 lines with "Show full prompt" toggle.
- Settings diff: collapse into a "Settings werden angepasst (3)" chip that expands on click.

The goal: card fits ~8 lines by default, expands on demand.

**Affects:**
- [x] Wireframe change needed (define collapsed default + expand states)
- [x] Discovery change needed (add "no_settings_diff" and "minimal_axes" are mentioned, but collapsed-default variant is not)

---

### Finding F-14: Paste-confirm card disappears on click, Intent-Summary-card stays — inconsistent history behaviour for two very similar artifacts

**Severity:** Improvement
**Category:** Consistency

**Problem:**
Two card-style chat artifacts, same visual family, two different behaviors on click:
- Paste-Confirm-Card: dismissed, removed from history (Wireframe line 155)
- Intent-Summary-Card: remains in history as frozen/disabled (Discovery line 183, Wireframe line 222)

No apparent justification. Inconsistency costs users mental overhead.

**Context:**
> **From Wireframe (lines 155, 222):**
> ```
> [paste] `dismissed` | card replaced by the normal assistant response ...
> — card itself does not remain in history once a button has been clicked
>
> [intent-summary] `history` | after user clicks Generate or Discuss:
> card freezes (buttons inactive, shown as past decision); new assistant
> turn follows below
> ```

**Impact:**
Low but persistent confusion. User looks back at chat history and wonders "where did that paste-confirm thing go? Did I dismiss it?". The card is evidence of a decision; discarding it discards the evidence.

**Recommendation:**
Make both cards behave the same way: remain in history, buttons go to a disabled state with a small "you chose: X" label. Maintains decision trail and consistency.

**Affects:**
- [x] Wireframe change needed (update paste-confirm-card dismissed state to "history")
- [x] Discovery change needed (update `paste_confirm_card` states to include "history")

---

### Finding F-15: Error state "reference slot invalid URL" is defined in Discovery but has no wireframe representation

**Severity:** Improvement
**Category:** Gap

**Problem:**
Discovery line 154: "Reference-Slot enthält ungültige URL → Assistant überspringt dieses Bild, meldet 'Slot N konnte nicht geladen werden — bitte neu hochladen'". This is a defined error path, but the wireframe's Assistant Panel doesn't show what this message looks like, where it appears, or how the user recovers.

**Context:**
> **From Discovery (line 154):**
> ```
> Reference-Slot enthält ungültige URL → Assistant überspringt dieses Bild,
> meldet "Slot N konnte nicht geladen werden — bitte neu hochladen"
> ```
>
> **From Wireframe:** no state showing this error message.

**Impact:**
Implementer has to guess. User might not realize which slot failed if the assistant just says "Slot N" without highlighting the actual reference-slot in the UI.

**Recommendation:**
- Add a state variation to the Assistant Panel wireframe showing the error inline chat message.
- Ideally, the corresponding ReferenceBar slot is also visually flagged (red border / warning icon) so the user's eye can map "Slot 2" in chat to the slot on the left.

**Affects:**
- [x] Wireframe change needed (add error state variant)
- [ ] Discovery change needed (optional: clarify cross-component visual linking)

---

### Finding F-16: Empty-textarea case: "Help me write this" is a tiny button next to a massive empty field — discoverability concern

**Severity:** Suggestion
**Category:** Usability

**Problem:**
In the Project-Context-Settings `empty` state, the textarea takes most of the visual weight. A new user sees a big empty field with placeholder text and may not even notice the "Help me write this" button until they've stared at the blank for a while. The button is currently the path of lowest resistance for a user who doesn't know what to write, but the UI doesn't surface that.

**Context:**
> **From Wireframe (lines 248–263):**
> ```
>   ② context_textarea
>   ┌───────────────────────────────────────────────────────────────┐
>   │ [cursor]                                                      │
>   │                                                               │
>   └───────────────────────────────────────────────────────────────┘
>                                      0 / 8,000 chars
>   ③ ┌──────────────────────┐
>     │ ✨ Help me write this │
>     └──────────────────────┘
> ```

**Impact:**
Low. Feature adoption may lag slightly because the "onboarding ramp" is less visible. Not blocking.

**Recommendation:**
- In `empty` state only, show an empty-state CTA inside the textarea area: "Don't know where to start? Let the assistant draft it for you." with a prominent inline button.
- When user starts typing, the CTA disappears and the external "Help me write this" button remains as a secondary path.

**Affects:**
- [x] Wireframe change needed (empty state variant)
- [ ] Discovery change needed

---

### Finding F-17: Paste heuristic likely false-positives on comma-heavy German descriptions

**Severity:** Suggestion
**Category:** Usability

**Problem:**
Discovery line 259: heuristic is "Zeichen-Anzahl, Komma-Dichte, Style-Keyword-Occurrences". German users writing natural multi-clause first messages like "heller, moderner, skandinavischer Wohnzimmerstil mit warmem Holz" will hit 3 commas in short order and potentially match "style keywords" (Holz-Stil, Skandinavisch). The card appears, user is forced into a choice (F-3), friction introduced.

**Context:**
> **From Discovery (line 259):**
> ```
> Heuristik aus: Zeichen-Anzahl, Komma-Dichte, Style-Keyword-Occurrences
> ```

**Impact:**
Depending on tuning, false-positive rate could be non-trivial. Amplifies F-3 (unrecoverable forced choice).

**Recommendation:**
- Tune heuristic with DE corpus in mind: require minimum length (e.g. 150 chars or 5+ comma-separated fragments with at least 2 English style keywords).
- Consider LLM-side pre-classification instead of frontend heuristic — cheaper in false-positives, cost is one extra turn latency.
- If F-3 is addressed (dismiss + history), this finding's severity drops further.

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed (refine heuristic, or move to LLM classification)

---

### Finding F-18: "Last updated" timestamp shown even when content is unchanged across many sessions — no freshness indicator

**Severity:** Suggestion
**Category:** Scalability

**Problem:**
Project Context Settings shows "Last updated: 2026-04-17 · 14:22". That's useful the first few weeks. Six months later, the user returns to see "Last updated: 2025-10-14" and has no way of knowing whether the context is still accurate for their current project direction. No freshness nudge.

**Context:**
> **From Wireframe (line 265):**
> ```
> Last updated: 2026-04-17 · 14:22
> ```

**Impact:**
Low. Long-term feature hygiene. As the product matures, stale contexts silently degrade assistant quality for returning users.

**Recommendation:**
- Display relative timestamp with subtle color cue: "Last updated: 3 days ago" (fresh, neutral), "6 months ago" (muted warning color + tooltip "Consider reviewing").
- Optional: when user revisits the feature after a long gap and the context hasn't changed, a small "still accurate?" confirmation nudge could run at Settings-open time.

Non-blocking, future-proofing.

**Affects:**
- [x] Wireframe change needed (optional improvement)
- [ ] Discovery change needed

---

## Gaps & Inconsistencies (Cross-Reference)

| Inconsistency | Discovery | Wireframe | Resolved by Finding |
|---------------|-----------|-----------|---------------------|
| Card persistence in history | Intent-Summary "remains as History-Element" (line 183); paste-confirm not explicitly addressed | Paste-Confirm dismissed + removed (line 155); Intent-Summary frozen history (line 222) | F-14 |
| Helper-Accept semantics (replace vs append) | "zeigt Draft im Hauptfeld zum Editieren" (line 145) — implies replace | "writes draft into context_textarea" (line 342) — ambiguous | F-4 |
| Concurrent-Generation behavior | Decision in OQ#5 (line 415) | Not rendered anywhere | F-5 |
| Error "invalid reference URL" | Defined (line 154) | No visual | F-15 |
| Language of card chrome | Business rule only covers prompt text + interview turns (line 280) | Mixed DE/EN in mock (lines 173–199) | F-11 |
| Abort-in-progress | Not addressed | Pending state has no abort (line 220) | F-1 |

---

## Scalability & Risks

**Context field size + system prompt budget:** Max 8000 chars for `context_instructions`, injected every turn, alongside growing chat history, multimodal images, and model-knowledge block. For power users with long projects, the context window will compete with chat history for tokens. Discovery's multimodal budget rule (line 287) is defined, but the text-budget interaction with context-instructions is not — as projects mature, this becomes relevant. Recommended as future follow-up, not blocking.

**Scaling the axis taxonomy:** Current 6 axes (Subject, Medium, Style, Lighting, Composition, Palette, Technical/Settings) are reasonable, but specific domains (architecture viz, product photography, character design) want different axes. The Intent-Summary-Card is axis-generic — scalable. The system prompt that elicits these axes may calcify around the default 6. Watch in Slice E evals.

**Multi-project context switching:** Feature is per-project. Users with 5+ projects will accumulate 5+ context blocks, each edited independently. No wireframe for project-level overview of "which contexts are set / stale / auto-generated" — not blocking now, but consider after initial adoption data.

---

## Expert Assessment

The concept is strong and strategically sound. Key strengths:
- **Real user problem.** Low hit-rate on first generate is a recognized, credit-wasting issue; interview-elicitation is a measured, research-backed answer.
- **Market differentiation.** Competitive analysis is explicit: no major player (Midjourney, Leonardo, DALL-E in ChatGPT) does true elicitation. This is a differentiator.
- **Pragmatic architecture.** Reuse of LangGraph checkpointer, existing multimodal message shape, existing apply-flow, existing tool-framework. Feature is additive, not re-architectural.
- **Right primary UX artifact.** The Intent-Summary-Card consolidates the confirmation moment cleanly and predictably.
- **Separation of concerns.** Project-Context is LLM-only, not injected into image models — correct decision, prevents prompt-injection drift.

Key concerns the findings capture:
- **Credit-gated workflows demand tight error recovery.** F-1 (no abort), F-4 (silent overwrite), F-5 (concurrent-gen undefined), F-3 (no dismiss) all reflect a system where the user can waste resources / lose data with no recourse. For a product where each generate costs money, every destructive action needs undo or prevention.
- **The Intent-Summary-Card is too terminal.** F-2 and F-6 both point at the same root: "agree / disagree-reset" is a binary that doesn't match how users actually refine prompts. Real refinement is surgical ("fix this one axis"), not binary. Adding a narrow edit path on the card transforms the feature from "good" to "excellent".
- **Consistency gaps.** F-11, F-14 indicate the wireframe was sketched without a unifying spec for card behaviors and language. A small design-system pass aligning the two card types would pay off.

Strategic alternatives considered but not recommended:
- **Replacing cards with a sidebar "Intent Inspector" panel** — higher architecture cost, breaks the chat-first mental model. Card-in-thread is correct.
- **Voice-first interview** — out of scope, correctly.
- **Allowing the assistant to generate directly at any time without summary** — opposes the whole feature thesis. Keep the explicit confirmation gate.

Overall: **fix the 5 Critical findings and the 10 Improvement findings, and this becomes a best-in-class feature.** The Suggestions can ship later.

---

## Positive Highlights

- **Research-grounded stop criterion.** Rejecting log-likelihood confidence in favor of semantic-understanding (INTENT-SIM, Discovery line 397) is the right call, and the Discovery cites the source. Well done.
- **Paste-Detect pattern** correctly distinguishes one-shot-refine flow from elicitation flow — the product-thinking around "don't force every user into the interview" is mature.
- **Budget-priority rule** for multimodal content (line 287) is well thought through: aktuelle Slots > letztes Result > Chat-Uploads, oldest-first drop. Clean.
- **System-prompt-injection of context (not user-message-injection)** avoids prompt-injection attacks. Correct security posture.
- **Out-of-scope discipline** is strong: upscale/inpaint/outpaint kept out cleanly, no feature creep, clear boundary.
- **Slice dependency graph** (line 320–341) is genuinely useful; parallel paths identified correctly (I/J/K separable from A/B/D/E/F/G/H).

---

## Verdict

**Verdict:** CHANGES_REQUESTED

**Rationale:** 5 Critical and 10 Improvement findings, all of which either block user task-completion (F-1, F-3, F-5), risk data loss (F-4, F-9), or create usability/consistency hurdles that would materially hurt adoption of the central UX artifact (F-2, F-6, F-7, F-8, F-10, F-11, F-14).

**Next steps:**
1. Address Critical findings F-1 through F-5 — all are either missing states in the FSM or destructive actions without recovery.
2. Address Improvement findings, especially F-2 (inline edit on Intent-Summary-Card) and F-11 (language consistency in card chrome).
3. Re-run UX Expert Review on updated Discovery + Wireframes.

Suggestions (F-16, F-17, F-18) can be deferred to follow-up iterations without blocking approval.

---

*End of report.*
