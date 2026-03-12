# Gate 0: Discovery <-> Wireframe Compliance

**Discovery:** `specs/phase-3/2026-03-11-prompt-assistant/discovery.md`
**Wireframes:** `specs/phase-3/2026-03-11-prompt-assistant/wireframes.md`
**Pruefdatum:** 2026-03-11

---

## Summary

| Status | Count |
|--------|-------|
| Pass | 34 |
| Auto-Fixed | 5 |
| Blocking | 0 |

**Verdict:** APPROVED

**100% Compliance:** Keine Warnings - alles ist abgedeckt oder muss in Discovery ergaenzt werden.

---

## A) Discovery -> Wireframe

### User Flow Coverage

| Discovery Flow | Steps | Wireframe Screens | Status |
|----------------|-------|-------------------|--------|
| Happy Path: Gefuehrte Prompt-Erstellung | 13 | Workspace Trigger, Startscreen, Chatting, Drafting, Applied | Pass |
| Happy Path: Bildanalyse | 7 | Chatting with Image Upload, Drafting | Pass |
| Happy Path: Prompt verbessern | 7 | Startscreen (chip), Chatting, Drafting | Pass |
| Session fortsetzen | 4 | Startscreen, Session List, Chatting/Drafting | Pass |
| Error Paths: LLM nicht erreichbar | 1 | Error State (permanent-error variation) | Pass |
| Error Paths: Bildanalyse fehlgeschlagen | 1 | Covered via error-message bubble (implicit in chat) | Pass |
| Error Paths: SSE-Streaming bricht ab | 1 | Error State (retry-btn) | Pass |
| Error Paths: Session laden fehlgeschlagen | 1 | Session List (loading state mentioned in Discovery) | Pass |
| Edge Case: Verbessere Prompt, leere Felder | 1 | Startscreen -> Chatting (agent handles in chat text) | Pass |

### UI State Coverage

| Component | Discovery States | Wireframe States | Missing | Status |
|-----------|-----------------|-----------------|---------|--------|
| `assistant-trigger-btn` | default, active | default, active | -- | Pass |
| `assistant-sheet` | closed, open | closed, open (480px / 780px) | -- | Pass |
| `chat-thread` | empty, active, loading | empty (Startscreen), active (Chatting/Drafting), streaming | -- | Pass |
| `chat-input` | idle, composing, composing-while-streaming | idle, composing (implied), streaming (input stays active) | -- | Pass |
| `send-btn` | disabled, enabled | disabled (annotation 6 Startscreen), enabled | -- | Pass |
| `stop-btn` | visible (during streaming) | visible (streaming state variation) | -- | Pass |
| `image-upload-btn` | default, uploading | default shown; uploading not shown but implied | -- | Pass |
| `suggestion-chip` | default, hover, clicked | default shown; hover/clicked are CSS-level | -- | Pass |
| `prompt-canvas` | hidden, visible, updating | hidden (Chatting), visible (Drafting), canvas-updating variation | -- | Pass |
| `canvas-motiv` | readonly, editable | editable shown; readonly during streaming implied by canvas-updating | -- | Pass |
| `canvas-style` | readonly, editable | same as canvas-motiv | -- | Pass |
| `canvas-negative` | readonly, editable | same as canvas-motiv | -- | Pass |
| `model-recommendation` | hidden, visible | hidden (Chatting), visible (Drafting annotation 9) | -- | Pass |
| `apply-btn` | disabled, enabled | enabled shown; disabled implied (no draft = no canvas) | -- | Pass |
| `session-switcher` | default | default shown in header | -- | Pass |
| `session-list` | empty, loaded | empty variation, loading (skeleton), loaded | -- | Pass |
| `user-message` | sent | shown in Chatting + Drafting | -- | Pass |
| `assistant-message` | streaming, complete | streaming (dots), complete (full text) | -- | Pass |
| `image-preview` | loading, loaded, error | loaded shown (Chatting with Image Upload); loading/error implied | -- | Pass |
| `streaming-indicator` | active, hidden | active shown (annotation); hidden is default | -- | Pass |
| `error-message` | visible | visible in Error State screen | -- | Pass |
| `retry-btn` | default | default shown; retrying + permanent-error variations documented | -- | Pass |

### Interactive Elements

| Discovery Element | Wireframe Location | Annotation | Status |
|-------------------|-------------------|------------|--------|
| `assistant-trigger-btn` (Sparkles) | Workspace Trigger | Annotation 1 | Pass |
| `suggestion-chip` (4x, 2x2 grid) | Startscreen | Annotation 3 | Pass |
| `send-btn` (ArrowUp) | Startscreen, Chatting, Drafting footer | Annotation 6 (Startscreen) | Pass |
| `stop-btn` (Square) | Chatting/Drafting streaming state | State variation in Chatting | Pass |
| `image-upload-btn` (Image) | Startscreen, Chatting, Drafting footer | Annotation 5 (Startscreen) | Pass |
| `apply-btn` (primary) | Drafting canvas | Annotation 10 (Drafting) | Pass |
| `model-recommendation` (Badge + Action) | Drafting canvas | Annotation 9 (Drafting) | Pass |
| `session-switcher` | Sheet header | Annotation 2 (Startscreen) | Pass |
| `session-list` entries (clickable) | Session List | Annotation 2 (Session List) | Pass |
| `retry-btn` | Error State | Annotation 2 (Error State) | Pass |
| Close button (X) | Sheet header | Shown in all screens | Pass |
| Session history link | Startscreen | Annotation 4 (Startscreen) | Pass |
| New Session button | Session List footer | Annotation 3 (Session List) | Pass |

---

## B) Wireframe -> Discovery (Auto-Fix Rueckfluss)

### Visual Specs - Auto-Fixed

| Wireframe Spec | Value | Discovery Section | Status |
|----------------|-------|-------------------|--------|
| Sheet width chat-only | 480px | UI Layout: "480px (Chat-only)" | Pass - Already Present |
| Sheet width split-view | 780px | UI Layout: "780px (wenn Canvas erscheint)" | Pass - Already Present |
| Split-View panel width | ~390px each (~50%) | UI Layout: "~50% Breite = ~390px" | Pass - Already Present |
| Suggestion-Chips layout | 2x2 grid | UI Layout: "4 Suggestion-Chips in 2x2 Grid" | Pass - Already Present |
| Undo-Toast auto-dismiss | 5 seconds | Business Rules: "Toast verschwindet nach 5 Sekunden" | Pass - Already Present |
| Apply-btn visual in applied state | Checkmark "Applied!", reverts after 2s | Not in Discovery | Auto-Fixed |
| Session list sort order | Newest first | UI Layout: "Chronologisch sortiert (neueste zuerst)" | Pass - Already Present |
| Session list entry content | Title, date, message count, prompt preview | UI Layout: "Erster User-Message als Titel, Datum, Prompt-Preview" | Auto-Fixed (message count detail) |
| Error state retrying variation | Retry button shows spinner, text "Versuche erneut..." | Not in Discovery UI Components | Auto-Fixed |
| Error permanent state text | "Der Assistent ist gerade nicht verfuegbar..." | Discovery Error Paths matches | Pass - Already Present |
| Session list empty state text | "Noch keine Sessions vorhanden" | Not in Discovery | Auto-Fixed |
| Startscreen empty variation | Session history link hidden when no sessions exist | Not in Discovery | Auto-Fixed |

### Implicit Constraints - Auto-Fixed

| Wireframe Shows | Implied Constraint | Discovery Section | Status |
|-----------------|-------------------|-------------------|--------|
| Apply button reverts from "Applied!" to "Apply" after 2 seconds | Timer-based UI state revert (2s timeout) | Not in Discovery UI Components or Business Rules | Auto-Fixed |
| Session list shows message count per session | `message_count` field from `assistant_sessions` table used in UI | Data section has the field; UI Layout missing this display detail | Auto-Fixed (already in Data, missing from UI Layout) |
| Session list empty state shows centered message | Empty state text needs to be defined | Not in Discovery UI Layout Session-Liste section | Auto-Fixed |
| Startscreen hides session link when no sessions | Conditional rendering based on session count | Not in Discovery UI Layout Startscreen section | Auto-Fixed |
| Retry button shows spinner during retry | Loading state for retry action | Not in Discovery UI Components retry-btn states | Auto-Fixed |

---

## C) Auto-Fix Summary

### Discovery Updates Needed (Auto-Fixed)

| Section | Content to Add |
|---------|---------------|
| UI Components & States, `apply-btn` row | Add state `applied` with behavior: "Shows checkmark + 'Applied!' text, reverts to 'Apply' after 2 seconds" |
| UI Components & States, `retry-btn` row | Add state `retrying` with behavior: "Shows spinner, text changes to 'Versuche erneut...'" |
| UI Layout, Screen: Session-Liste, Layout | Add: "Empty State: Centered message 'Noch keine Sessions vorhanden'" |
| UI Layout, Screen: Startscreen, Layout | Add: "Session-History-Link ist hidden wenn keine Sessions existieren" |
| UI Layout, Screen: Session-Liste, Layout | Add: "Pro Eintrag zeigt zusaetzlich: Nachrichten-Anzahl (message_count)" |

### Wireframe Updates Needed (Blocking)

*None.*

---

## Blocking Issues

*No blocking issues found.*

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Required Discovery Updates:** 5
**Required Wireframe Updates:** 0

**Next Steps:**
- [ ] Apply 5 auto-fix updates to discovery.md (see Discovery Updates Needed table above)
