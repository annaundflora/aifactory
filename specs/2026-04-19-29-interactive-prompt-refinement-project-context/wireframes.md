# Wireframes: Interactive Prompt Refinement in Assistant with Per-Project Context

**Discovery:** `discovery.md` (same folder)
**Status:** Draft

---

## Component Coverage

| UI Component (from Discovery) | Screen |
|-------------------------------|--------|
| `no_context_banner` | Assistant Panel (extended) |
| `no_context_banner.link` | Assistant Panel (extended) |
| `multimodal_indicator` | Assistant Panel (extended) |
| `paste_confirm_card` | Paste Detect Confirm Card |
| `paste_confirm_card.refine_btn` | Paste Detect Confirm Card |
| `paste_confirm_card.interview_btn` | Paste Detect Confirm Card |
| `intent_summary_card` | Intent Summary Card |
| `intent_summary_card.generate_btn` | Intent Summary Card |
| `intent_summary_card.discuss_btn` | Intent Summary Card |
| `result_message` (NEW) | Reviewing Turn |
| `context_textarea` | Project Context Settings |
| `help_me_write_btn` | Project Context Settings |
| `helper_brief_input` | Help-me-write-this Modal |
| `helper_generate_btn` | Help-me-write-this Modal |
| `helper_accept_btn` | Help-me-write-this Modal |
| `reference_slot` (existing, unchanged) | Assistant Panel (referenced only) |

---

## User Flow Overview

```
                               ┌─────────────────────────────┐
                               │  Project Context Settings   │
                               │                             │
                               │  (opened from Project List  │
                               │   or Workspace Header)      │
                               └──────────┬──────────────────┘
                                          │ save
                                          ▼
[Assistant Panel (idle)]
  │
  │ first user message
  ▼
[Paste Detect Confirm Card] ──"Interview"──► [Interviewing] ──LLM confident──► [Intent Summary Card] ──"Generate"──► [Generating] ──► [Reviewing]
  │                                                                                        │                                                │
  │                                                                                        │ "Discuss again"                                │ user feedback
  │                                                                                        ▼                                                ▼
  └────"Refine"────────────────────────────────────────────────────────────────► [Interviewing]                                       [Refining]
                                                                                                                                           │
                                                                                                                                           ▼
                                                                                                                                  [Intent Summary Card]
                                                                                                                                      or [Interviewing]
```

---

## Screen: Assistant Panel (extended)

**Context:** Right-side panel of the Workspace, always available while a project is open. Shows the chat surface where the interview, the paste-detect-confirm, the intent-summary-card and the no-context banner all appear inline. Workspace on the left with ReferenceBar (existing, unchanged).

### Wireframe

```
┌─── Workspace ──────────────────────────────────────────────┬─── Assistant Panel ──────────────────────────┐
│                                                            │                                              │
│  [... existing workspace content ...]                      │  ① Project: Magic Mushroom Art   ▾ Sessions │
│                                                            │     ▾ Model: claude-sonnet-4.6               │
│   ┌─ ReferenceBar ──┐                                      │  ────────────────────────────────────────── │
│   │ ┌────┐ Slot 1   │                                      │                                              │
│   │ │IMG │ style    │   [Prompt textarea]                  │  ┌─ ② No-context banner ─────────────┐  ✕   │
│   │ └────┘ ▼        │                                      │  │ No project context set.  ③ Add →  │      │
│   │ ┌────┐ Slot 2   │   [Settings panel: model, size, …]  │  └────────────────────────────────────┘      │
│   │ │IMG │ subject  │                                      │                                              │
│   │ └────┘ ▼        │   [Generate Button]                 │  ┌─ Chat Thread ──────────────────────────┐ │
│   │ ┌─ ─┐  Slot 3   │                                      │  │                                        │ │
│   │ │ + │  empty    │   [Result Grid]                     │  │ Assistant:                             │ │
│   │ └─ ─┘           │                                      │  │  "Hi! What should we create today?"    │ │
│   └─────────────────┘                                      │  │                                        │ │
│                                                            │  │ User: "mach ein Bild für meinen Shop"  │ │
│                                                            │  │                                        │ │
│                                                            │  │ Assistant:                             │ │
│                                                            │  │  "Gerne. Welche Richtung schwebt dir   │ │
│                                                            │  │  vor — atmosphärisches Photo, Illus-   │ │
│                                                            │  │  tration oder eher 3D-Render?"         │ │
│                                                            │  │                                        │ │
│                                                            │  │ User: "illu, dark academia"            │ │
│                                                            │  │                                        │ │
│                                                            │  │ [Assistant streaming…]                 │ │
│                                                            │  │                                        │ │
│                                                            │  └────────────────────────────────────────┘ │
│                                                            │                                              │
│                                                            │  ┌─ Chat Input ───────────────────────────┐ │
│                                                            │  │  [ + ]  Type a message…         [ ↑ ]  │ │
│                                                            │  └────────────────────────────────────────┘ │
│                                                            │  ④ Sieht: 2 Refs + letztes Ergebnis         │
│                                                            │                                              │
└────────────────────────────────────────────────────────────┴──────────────────────────────────────────────┘
```

**Annotations:**
- ① Panel header (existing): project name, sessions dropdown, model selector — unchanged
- ② `no_context_banner`: dismissible single-line banner above the chat thread, rendered only when `context_instructions` is empty. Dismiss is **tab-session-scoped** (resets only on tab reload, NOT on project switch).
- ③ `no_context_banner.link`: link inside the banner that navigates to Project Context Settings
- ④ `multimodal_indicator`: dezenter Hinweis unter dem Chat-Input, zeigt was an den Assistant mitgeschickt wird ("Sieht: X Refs + letztes Ergebnis"). Sichtbar nur wenn Multimodal-Anhänge tatsächlich vorhanden sind. Verbirgt sich bei reinem txt2img ohne Anhänge.

### State Variations

| State | Visual Change |
|-------|---------------|
| `context_set` | `no_context_banner` (②) is hidden; rest unchanged |
| `banner_dismissed_session` | `no_context_banner` hidden for the remainder of the session; reappears on new session if still empty |
| `interviewing` | chat thread streams assistant turns with open questions, option-sentences; no special card rendered yet |
| `reviewing` | after a successful generate, next assistant turn references the generated image (user sees "Stimmung passt, Licht wirkt flach — wärmer?") |
| `mode=txt2img` | ReferenceBar slots ignored for multimodal pipeline (shown in workspace but not sent to assistant) |
| `mode=img2img` | active ReferenceBar slots are forwarded as multimodal content on every turn (assistant can discuss them) |

---

## Screen: Paste Detect Confirm Card

**Context:** Appears **inline inside the chat thread** directly after the very first user message of a session, **only** when the paste heuristic matches (prompt-like length, comma-heavy style keywords). One-shot, disappears after a button click.

### Wireframe

```
┌─ Chat Thread (excerpt) ────────────────────────────────────┐
│                                                            │
│  User: "highly detailed dark academia illustration, moody  │
│  library interior, stacks of vintage books, candlelight,   │
│  cinematic composition, sharp focus, 4k"                   │
│                                                            │
│  ┌─ ① paste_confirm_card ──────────────────────────────┐  │
│  │                                                     │  │
│  │   💡 Das sieht nach einem fertigen Prompt aus.      │  │
│  │                                                     │  │
│  │   ┌──────────────────────┐  ┌────────────────────┐  │  │
│  │   │ ②  Direkt verfeinern │  │ ③ Interview starten│  │  │
│  │   └──────────────────────┘  └────────────────────┘  │  │
│  │                                                     │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  [… next assistant turn lands after a button click …]      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `paste_confirm_card`: inline chat card, single appearance, dismissed after one click
- ② `paste_confirm_card.refine_btn`: triggers `refine_prompt` tool-call directly; next step is the Intent Summary Card
- ③ `paste_confirm_card.interview_btn`: starts the normal Interview flow with the pasted text as intent seed

### State Variations

| State | Visual Change |
|-------|---------------|
| `rendered` | as shown above, both buttons active |
| `dismissed` | card replaced by the normal assistant response (refine result or first interview question). **Card does NOT remain in chat history** — this is intentional and differs from the IntentSummaryCard. Rationale: the paste-detect step is a transient routing decision, not a durable artefact. |

---

## Screen: Intent Summary Card

**Context:** Appears **inline inside the chat thread** as a special assistant-generated message, rendered when the LLM has reached semantic confidence about the user's intent. Contains the summary, the drafted prompt, optional settings diff, and the two action buttons. Remains as a history element after interaction.

### Wireframe

```
┌─ Chat Thread (excerpt) ───────────────────────────────────────┐
│                                                               │
│  Assistant: "Okay, ich glaube ich habe alles. Zusammen-       │
│  fassung:"                                                    │
│                                                               │
│  ┌─ ① intent_summary_card ────────────────────────────────┐  │
│  │                                                        │  │
│  │   Zusammenfassung — stimmt das?                        │  │
│  │   ───────────────────────────────────────────          │  │
│  │                                                        │  │
│  │   ② Intent axes                                        │  │
│  │       • Subject:     moody library interior            │  │
│  │       • Medium:      illustration                      │  │
│  │       • Style:       dark academia, Beksinski-tinged   │  │
│  │       • Lighting:    candlelight, warm glow            │  │
│  │       • Composition: cinematic wide, shallow depth     │  │
│  │       • Palette:     burgundy, umber, muted gold       │  │
│  │                                                        │  │
│  │   ③ Prompt draft                                       │  │
│  │   ┌──────────────────────────────────────────────────┐ │  │
│  │   │ dark academia illustration, moody library       │ │  │
│  │   │ interior, stacks of vintage books, candlelight, │ │  │
│  │   │ cinematic wide shot, shallow depth of field,    │ │  │
│  │   │ burgundy/umber/gold palette, highly detailed,   │ │  │
│  │   │ in the style of Beksinski                       │ │  │
│  │   └──────────────────────────────────────────────────┘ │  │
│  │                                                        │  │
│  │   ④ Settings diff                                      │  │
│  │       • Slot 1 role → style-reference                  │  │
│  │       • Slot 2 role → subject-reference                │  │
│  │       • Model      → flux-2-pro                        │  │
│  │                                                        │  │
│  │   ┌──────────────────┐  ┌──────────────────────────┐  │  │
│  │   │ ⑤ So generieren  │  │ ⑥ Nochmal diskutieren    │  │  │
│  │   └──────────────────┘  └──────────────────────────┘  │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `intent_summary_card`: outer card container, remains in history after click
- ② Intent axes list — only axes actually filled during interview are shown (dynamic)
- ③ `prompt_preview`: rendered as monospace block, always EN
- ④ `settings_diff`: shown only when the assistant has proposed or set workspace settings (slot roles, strengths, model params). Omitted on pure txt2img without settings changes.
- ⑤ `intent_summary_card.generate_btn` (Primary): user click is the gate — runs `useIsGenerationPending` precondition, then advances `flow_state` from `summarizing` to `generating`, calls Auto-Apply + Auto-Generate. The tool `emit_intent_summary` was already fired earlier by the LLM; the tool only carries the payload, the click triggers the generate.
- ⑥ `intent_summary_card.discuss_btn` (Secondary): sets `flow_state` back to `interviewing`, sends "Okay, was soll anders sein?" to assistant. **Card remains as history element** (frozen, buttons inactive) so user can scroll back through past decisions.

### State Variations

| State | Visual Change |
|-------|---------------|
| `rendered` | all components visible, both buttons active |
| `pending` | after Generate click: buttons disabled, Primary shows spinner ("Generiere…"), card remains visible while generation runs |
| `history` | after user clicks Generate or Discuss: card freezes (buttons inactive, shown as past decision); new assistant turn follows below |
| `no_settings_diff` | axis ④ omitted; card is more compact |
| `minimal_axes` | only 2–3 axes present (e.g. user was very specific); list shrinks accordingly |

---

## Screen: Project Context Settings

**Context:** Dedicated settings view, reachable from (a) Project list (context menu or edit button per card) and (b) Workspace header (gear/settings icon). Full-page route OR modal — implementation choice; layout identical. Only the context-editing concerns; unrelated project fields (name, thumbnail) are adjacent but out of scope for this feature.

### Wireframe

```
┌─ Project Settings ────────────────────────────────────────────────────┐
│                                                                       │
│  ← Back to project                                                    │
│                                                                       │
│  ① Project: Magic Mushroom Art                                        │
│                                                                       │
│  ═══════════════════════════════════════════════════════════════      │
│                                                                       │
│  Context for Assistant                                                │
│                                                                       │
│  Describe your project so the assistant knows the vibe, style         │
│  and recurring themes. Used for the chat LLM only, not for            │
│  image-model prompts.                                                 │
│                                                                       │
│  ② context_textarea                                                   │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │ Magic Mushroom Art — psychedelic vintage prints, dark         │   │
│  │ academia tones, never hyperreal. Typical subjects: botanical  │   │
│  │ studies, esoteric symbols, decaying libraries. Avoid neon     │   │
│  │ colors.                                                       │   │
│  │                                                               │   │
│  │ [cursor]                                                      │   │
│  │                                                               │   │
│  │                                                               │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                     1,024 / 8,000 chars               │
│                                                                       │
│  ③ ┌──────────────────────┐                                           │
│    │ ✨ Help me write this │                                           │
│    └──────────────────────┘                                           │
│                                                                       │
│  Last updated: 2026-04-17 · 14:22                                     │
│                                                                       │
│  ───────────────────────────────────────────────────────────────      │
│                                                                       │
│                                    ┌────────┐  ┌──────────────────┐   │
│                                    │ Cancel │  │  ④  Save Context │   │
│                                    └────────┘  └──────────────────┘   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① Project header (existing chrome): name, back-link
- ② `context_textarea`: free-text multi-line input with character counter (max 8000)
- ③ `help_me_write_btn`: opens Helper Modal (next wireframe)
- ④ Save button: persists to `projects.context_instructions`, triggers toast + updates `context_updated_at`

### State Variations

| State | Visual Change |
|-------|---------------|
| `empty` | textarea empty, placeholder "Describe your project, so the assistant knows…"; counter shows `0 / 8,000`; no "Last updated" row |
| `filled` | as shown above |
| `saving` | Save button shows spinner, disabled; textarea read-only during save |
| `saved` | short inline "✓ Saved" next to counter, auto-hides after ~2s; `Last updated` timestamp refreshes |
| `error` | red inline message under Save button: "Save failed. Please try again." |
| `over_limit` | counter turns red when > 8000; Save button disabled |

---

## Screen: Help-me-write-this Modal

**Context:** Opens on top of the Project Context Settings view when `help_me_write_btn` is clicked. Small modal, focused interaction: user enters a short brief, LLM produces a draft, user accepts or regenerates. Accepted draft replaces / fills the `context_textarea` in the parent view.

### Wireframe

```
              ┌─ Help me write this ─────────────────────────────┐
              │                                              ✕   │
              │                                                  │
              │  Describe your project in 1–2 sentences.         │
              │  I'll draft a context block you can then edit.   │
              │                                                  │
              │  ① helper_brief_input                            │
              │  ┌─────────────────────────────────────────────┐ │
              │  │ My POD shop with mystical mushroom art,     │ │
              │  │ dark academia tones, never hyperreal.       │ │
              │  │                                             │ │
              │  └─────────────────────────────────────────────┘ │
              │                                87 / 500 chars    │
              │                                                  │
              │                  ┌─────────────────────────────┐ │
              │                  │  ② ✨ Generate context       │ │
              │                  └─────────────────────────────┘ │
              │                                                  │
              │  ─────────────────────────────────────────────   │
              │                                                  │
              │  Draft                                           │
              │  ┌─────────────────────────────────────────────┐ │
              │  │ Magic Mushroom POD shop. Aesthetic: dark    │ │
              │  │ academia, muted earth tones, candlelit      │ │
              │  │ botanical studies, occult symbolism.        │ │
              │  │ Avoid: hyperrealism, neon, high-contrast    │ │
              │  │ digital look. Typical subjects: vintage     │ │
              │  │ prints, decaying libraries, mystical fungi. │ │
              │  └─────────────────────────────────────────────┘ │
              │                                                  │
              │  ┌────────────┐  ┌──────────────┐  ┌───────────┐ │
              │  │ ④ Cancel   │  │ ⑤ Regenerate │  │③ Use this │ │
              │  └────────────┘  └──────────────┘  └───────────┘ │
              │                                                  │
              └──────────────────────────────────────────────────┘
```

**Annotations:**
- ① `helper_brief_input`: short-text field (min 10, max 500 chars)
- ② `helper_generate_btn`: triggers backend LLM call; draft appears in the draft panel
- ③ `helper_accept_btn`: closes modal, writes draft into `context_textarea` (user can still edit before Save)
- ④ Cancel: closes modal without change
- ⑤ Regenerate: re-calls the LLM with the same brief; previous draft replaced

### State Variations

| State | Visual Change |
|-------|---------------|
| `empty` | brief input empty; `Generate context` disabled; draft section hidden |
| `brief_filled` | `Generate context` active; draft section still hidden until first call |
| `pending` | `Generate context` / `Regenerate` shows spinner, label becomes "Generating…", all buttons disabled |
| `draft_ready` | draft section visible with returned text, Accept/Regenerate/Cancel active |
| `error` | red inline message under buttons: "Could not generate. Try again."; input remains; Accept hidden |
| `over_limit_brief` | counter turns red when > 500 chars; `Generate context` disabled |

---

## Screen: Reviewing Turn (after successful generate)

**Context:** After "So generieren" click → `generateImages()` succeeds → backend attaches the result image as multimodal input on the next assistant turn → assistant proactively comments. This visualises what the user sees in the chat once the generation completes. The result image is rendered **inline as a thumbnail** in the assistant message so the user sees what the assistant is referencing.

### Wireframe

```
┌─ Chat Thread (reviewing) ─────────────────────────────────────┐
│                                                               │
│  IntentSummaryCard (frozen, history)                          │
│   • Subject: moody library interior                           │
│   • Buttons inactive: ✓ So generieren · Nochmal diskutieren   │
│                                                               │
│  Assistant: "Hier ist das Ergebnis:"                          │
│                                                               │
│  ┌─ ① result_message ─────────────────────────────────────┐  │
│  │  ┌─────────────┐                                        │  │
│  │  │             │  Stimmung passt, Licht wirkt flach —  │  │
│  │  │   THUMB     │  willst du es wärmer?                 │  │
│  │  │  (~120px)   │                                        │  │
│  │  │             │  Beksinski-Tinge ist gut getroffen,   │  │
│  │  └─────────────┘  Komposition könnte enger.            │  │
│  │                                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  User: [next refinement message…]                             │
│                                                               │
└───────────────────────────────────────────────────────────────┘

┌─ Chat Input ──────────────────────────────────────────────────┐
│  [ + ]  Type a message…                              [ ↑ ]    │
└───────────────────────────────────────────────────────────────┘
② Sieht: 2 Refs + letztes Ergebnis
```

**Annotations:**
- ① `result_message`: special assistant-message variant rendered when the turn carries a result-image attachment. Layout: thumbnail (left, ~120px square, rounded) + assistant text (right, multiline). Click on thumbnail opens the existing detail-view (`canvas-detail-view.tsx`) — reuse, no new modal.
- ② `multimodal_indicator`: now shows "Sieht: 2 Refs + letztes Ergebnis" because both reference slots AND the just-generated image are attached to the next turn.

### State Variations

| State | Visual Change |
|-------|---------------|
| `result_attached` | as shown above; assistant message includes inline thumbnail |
| `no_result_yet` | no `result_message` variant; generic assistant bubble (text-only) |
| `txt2img_no_refs` | `multimodal_indicator` hidden (nothing to attach); chat looks like today |
| `non_vision_model` | result thumbnail still rendered in chat for the user, but `multimodal_indicator` shows "Sieht: nur Text" — the attachment was silently stripped before being sent to the LLM |

---

## Completeness Check

| Check | Status |
|-------|--------|
| All UI Components from Discovery covered | ✅ |
| All relevant states visualized (incl. `reviewing`) | ✅ |
| All screens from Discovery UI Layout covered | ✅ |
| Multimodal-Indicator visualised | ✅ |
| Card history-semantics distinguished (Paste = transient, IntentSummary = history) | ✅ |
| No logic/business rules duplicated (stays in Discovery) | ✅ |
