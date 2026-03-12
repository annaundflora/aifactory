# Wireframes: Prompt Assistant

**Discovery:** `discovery.md` (same folder)
**Status:** Draft

---

## Component Coverage

| UI Component (from Discovery) | Screen |
|-------------------------------|--------|
| `assistant-trigger-btn` | Workspace (PromptArea) |
| `assistant-sheet` | All Screens (container) |
| `chat-thread` | Startscreen, Chatting, Drafting |
| `chat-input` | Startscreen, Chatting, Drafting |
| `send-btn` | Startscreen, Chatting, Drafting |
| `stop-btn` | Chatting (streaming), Drafting (streaming) |
| `image-upload-btn` | Startscreen, Chatting, Drafting |
| `suggestion-chip` | Startscreen |
| `prompt-canvas` | Drafting |
| `canvas-motiv` | Drafting |
| `canvas-style` | Drafting |
| `canvas-negative` | Drafting |
| `model-recommendation` | Drafting |
| `apply-btn` | Drafting |
| `model-selector` | All Screens (header) |
| `session-switcher` | All Screens (header) |
| `session-list` | Session List |
| `user-message` | Chatting, Drafting |
| `assistant-message` | Chatting, Drafting |
| `image-preview` | Chatting, Drafting |
| `streaming-indicator` | Chatting, Drafting |
| `error-message` | Error State |
| `retry-btn` | Error State |

---

## User Flow Overview

```
[Sheet Closed] ──trigger btn──► [Startscreen]
       │                             │
       │                    ┌────────┴────────┐
       │                    │                 │
       │              chip/message      session link
       │                    │                 │
       │                    ▼                 ▼
       │              [Chatting] ◄───── [Session List]
       │                    │
       │              agent drafts
       │                    │
       │                    ▼
       │              [Drafting]
       │                │       │
       │          chat feedback  edit canvas
       │                │       │
       │                ▼       ▼
       │              [Drafting] (updated)
       │                    │
       │               apply btn
       │                    │
       │                    ▼
       │              [Applied] ──close──► [Sheet Closed]
       │                    │
       │              new message
       │                    │
       │                    ▼
       ◄──────────── [Chatting] (iterative loop)
```

---

## Screen: Workspace Trigger

**Context:** PromptArea in the main Workspace. The assistant trigger button replaces the former Builder button.

### Wireframe

```
┌─────────────────────────────────────────────────────────┐
│ [... existing PromptArea ...]                           │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Motiv                                               │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │                                                 │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Style                                               │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │                                                 │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│                              [Improve ▾]    [ ✦ ] ①    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `assistant-trigger-btn`: Sparkles icon button, replaces former Builder button. Opens the assistant sheet on click. Visually active (highlighted) when sheet is open.

### State Variations

| State | Visual Change |
|-------|---------------|
| `default` | Icon button, neutral style |
| `active` (sheet open) | Highlighted/pressed appearance |

---

## Screen: Startscreen

**Context:** Inside the assistant sheet (480px, slides in from right). Shown when opening with no active session or when creating a new session.

### Wireframe

```
┌──────────────────────────────────────────┐
│ ① Prompt Assistent  ⑦[Sonnet▾] ② [Sessions] [✕]│
│══════════════════════════════════════════│
│                                          │
│                                          │
│                                          │
│                                          │
│          Womit kann ich dir helfen?       │
│                                          │
│      ┌───────────────┐ ┌──────────────┐  │
│      │ ③ Hilf mir     │ │ ③ Analysiere │  │
│      │ einen Prompt   │ │ ein Referenz-│  │
│      │ zu schreiben   │ │ bild         │  │
│      └───────────────┘ └──────────────┘  │
│      ┌───────────────┐ ┌──────────────┐  │
│      │ ③ Verbessere  │ │ ③ Welches    │  │
│      │ meinen akt.   │ │ Modell passt │  │
│      │ Prompt        │ │ zu mir?      │  │
│      └───────────────┘ └──────────────┘  │
│                                          │
│        ④ Vergangene Sessions anzeigen    │
│                                          │
│                                          │
│══════════════════════════════════════════│
│ ⑤ [🖼] │ Nachricht eingeben…         [⑥]│
└──────────────────────────────────────────┘
```

**Annotations:**
- ① `assistant-sheet` header: Title "Prompt Assistent"
- ② `session-switcher`: Simple button that navigates to the session list view. Close button (X) to dismiss sheet.
- ⑦ `model-selector`: Dropdown to select the LLM model. Options: "Sonnet 4.6" (default), "GPT-5.4", "Gemini 3.1 Pro". Selection persisted in local state and sent with each message. All three models support vision (image analysis).
- ③ `suggestion-chip`: 4 chips in 2x2 grid. Click sends the chip text as the first user message.
- ④ Link to open `session-list` view
- ⑤ `image-upload-btn`: Image icon button to upload a reference image
- ⑥ `send-btn`: Arrow-up icon, disabled when input is empty

### State Variations

| State | Visual Change |
|-------|---------------|
| `empty` (no sessions exist) | Session history link hidden |
| `default` | As shown above |

---

## Screen: Chatting (No Canvas)

**Context:** Inside the assistant sheet. User has sent messages but the agent hasn't created a prompt draft yet. Full-width chat thread.

### Wireframe

```
┌──────────────────────────────────────────┐
│ Prompt Assistent  [Sonnet▾] [Sessions] [✕] │
│══════════════════════════════════════════│
│                                          │
│ ① ┌──────────────────────────────┐       │
│   │ Was möchtest du heute         │       │
│   │ generieren?                   │       │
│   └──────────────────────────────┘       │
│                                          │
│          ┌───────────────────────────┐ ②  │
│          │ Ein Porträt von einer     │    │
│          │ Frau im Herbstwald        │    │
│          └───────────────────────────┘    │
│                                          │
│ ① ┌──────────────────────────────┐       │
│   │ Schöne Idee! Wie stellst du  │       │
│   │ dir den Stil vor?            │       │
│   │                              │       │
│   │ • Fotorealistisch            │       │
│   │ • Digitale Illustration      │       │
│   │ • Ölgemälde                  │       │
│   │ • Aquarell                   │       │
│   └──────────────────────────────┘       │
│                                          │
│══════════════════════════════════════════│
│ [🖼] │ Nachricht eingeben…           [➤] │
└──────────────────────────────────────────┘
```

**Annotations:**
- ① `assistant-message`: Left-aligned chat bubble with agent text
- ② `user-message`: Right-aligned chat bubble with user text

### State Variations

| State | Visual Change |
|-------|---------------|
| `streaming` | ③ `streaming-indicator`: Animated dots appear below last assistant message while agent is thinking/responding. `chat-input` stays active (user can type). `send-btn` is replaced by ④ `stop-btn` (square icon) to abort the stream. |
| `image-uploaded` | ④ `image-preview`: Thumbnail of uploaded reference image appears inline in the user message bubble |
| `error` | ⑤ `error-message`: Red-tinted chat bubble with error text and ⑥ `retry-btn` |

---

## Screen: Chatting with Image Upload

**Context:** User has uploaded a reference image. The image preview appears inline in the user message.

### Wireframe

```
┌──────────────────────────────────────────┐
│ Prompt Assistent  [Sonnet▾] [Sessions] [✕] │
│══════════════════════════════════════════│
│                                          │
│          ┌───────────────────────────┐    │
│          │ ①┌─────────┐              │    │
│          │  │ 🖼       │              │    │
│          │  │ ref.jpg  │              │    │
│          │  └─────────┘              │    │
│          │ Analysiere dieses Bild    │    │
│          └───────────────────────────┘    │
│                                          │
│ ┌──────────────────────────────┐         │
│ │ Ich analysiere dein Bild…    │         │
│ │ ② ● ● ●                     │         │
│ └──────────────────────────────┘         │
│                                          │
│ ┌──────────────────────────────┐         │
│ │ Ich sehe:                    │         │
│ │ • Subjekt: Frau im Wald      │         │
│ │ • Stil: Digitale Illustration │         │
│ │ • Mood: Mysteriös, ruhig     │         │
│ │ • Licht: Warmes Gegenlicht   │         │
│ │ • Palette: Orange/Grün       │         │
│ │                              │         │
│ │ Welche Aspekte willst du     │         │
│ │ übernehmen?                  │         │
│ └──────────────────────────────┘         │
│                                          │
│══════════════════════════════════════════│
│ [🖼] │ Nachricht eingeben…           [➤] │
└──────────────────────────────────────────┘
```

**Annotations:**
- ① `image-preview`: Thumbnail of uploaded reference image, clickable for full-size view
- ② `streaming-indicator`: Animated dots while agent processes (shown during analysis)

---

## Screen: Drafting (Chat + Canvas Split View)

**Context:** Inside the assistant sheet. The agent has created a prompt draft via `draft_prompt` tool. The sheet expands from 480px to 780px and splits into chat (left ~50%) and canvas (right ~50%), giving each panel ~390px.

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Prompt Assistent                    [Sonnet▾] [Sessions] [✕]    │
│══════════════════════════════════════════════════════════════════════════│
│                              │                                          │
│ ① Chat                       │ ⑤ Prompt Canvas                          │
│                              │                                          │
│ ┌──────────────────────┐     │ ┌──────────────────────────────────────┐ │
│ │ Hier ist dein Prompt │     │ │ ⑥ Motiv                              │ │
│ │ Draft! Ich habe dein │     │ │ ┌──────────────────────────────────┐ │ │
│ │ Herbstwald-Porträt   │     │ │ │ A woman standing in an autumn   │ │ │
│ │ strukturiert.        │     │ │ │ forest, golden leaves falling   │ │ │
│ └──────────────────────┘     │ │ │ around her, looking into camera │ │ │
│                              │ │ └──────────────────────────────────┘ │ │
│       ┌──────────────────┐②  │ │                                      │ │
│       │ Sieht gut aus,   │   │ │ ⑦ Style                              │ │
│       │ aber mehr drama- │   │ │ ┌──────────────────────────────────┐ │ │
│       │ tisches Licht!   │   │ │ │ photorealistic, warm golden     │ │ │
│       └──────────────────┘   │ │ │ hour lighting, shallow depth    │ │ │
│                              │ │ │ of field, backlit, lens flare   │ │ │
│ ┌──────────────────────┐     │ │ └──────────────────────────────────┘ │ │
│ │ ③ Ich habe das Licht │     │ │                                      │ │
│ │ verstärkt und drama- │     │ │ ⑧ Negative Prompt                    │ │
│ │ tisches Gegenlicht   │     │ │ ┌──────────────────────────────────┐ │ │
│ │ hinzugefügt.         │     │ │ │ low quality, blurry, extra      │ │ │
│ └──────────────────────┘     │ │ │ fingers, deformed, watermark    │ │ │
│                              │ │ └──────────────────────────────────┘ │ │
│ ④ ● ● ●                     │ │                                      │ │
│                              │ │ ⑨ ┌─ Flux Pro 1.1 ────────────────┐ │ │
│                              │ │   │ Ideal for photorealistic       │ │ │
│                              │ │   │ portraits  [Modell verwenden]  │ │ │
│                              │ │   └────────────────────────────────┘ │ │
│                              │ │                                      │ │
│                              │ │        ┌────────────────────────┐    │ │
│                              │ │        │ ⑩  Apply               │    │ │
│                              │ │        └────────────────────────┘    │ │
│                              │ └──────────────────────────────────────┘ │
│                              │                                          │
│══════════════════════════════════════════════════════════════════════════│
│ [🖼] │ Nachricht eingeben…                                         [➤] │
└──────────────────────────────────────────────────────────────────────────┘
```

**Annotations:**
- ① `assistant-message`: Agent messages in left chat panel
- ② `user-message`: User messages in left chat panel
- ③ `assistant-message`: Agent confirms canvas update after user feedback
- ④ `streaming-indicator`: Shown while agent is responding
- ⑤ `prompt-canvas`: Right panel card, appears when first draft is created. Sheet expands from 480px to 780px.
- ⑥ `canvas-motiv`: Editable textarea for the subject/motif prompt field
- ⑦ `canvas-style`: Editable textarea for the style prompt field
- ⑧ `canvas-negative`: Editable textarea for the negative prompt field
- ⑨ `model-recommendation`: Clickable badge with recommended model name, short reasoning, and "Modell verwenden" action link. Click selects the model in the workspace.
- ⑩ `apply-btn`: Primary button, transfers all canvas fields to workspace prompt fields. Undo-toast appears after apply.

### State Variations

| State | Visual Change |
|-------|---------------|
| `canvas-updating` | Canvas fields show subtle highlight/pulse while agent updates them via `refine_prompt` |
| `canvas-editing` | User is editing a canvas field directly; field has focused border |
| `streaming` | `chat-input` stays active, `send-btn` replaced by `stop-btn` (square icon) to abort stream |
| `applied` | Apply button changes to checkmark "Applied!", undo-toast appears: "Prompt applied. [Undo]" |

---

## Screen: Session List

**Context:** Inside the assistant sheet, replaces the chat view. Shown when user clicks "Vergangene Sessions anzeigen" or session switcher.

### Wireframe

```
┌──────────────────────────────────────────┐
│ ① ← Vergangene Sessions            [✕]  │
│══════════════════════════════════════════│
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ ② Porträt im Herbstwald             │ │
│ │   11. Mär 2026 · 8 Nachrichten      │ │
│ │   "A woman standing in an autumn…"  │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ ② Sci-Fi Stadtlandschaft            │ │
│ │   10. Mär 2026 · 12 Nachrichten     │ │
│ │   "cyberpunk cityscape, neon…"      │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ ② Logo für Bäckerei                 │ │
│ │   9. Mär 2026 · 5 Nachrichten       │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ ② Abstrakte Kunst                   │ │
│ │   8. Mär 2026 · 3 Nachrichten       │ │
│ └──────────────────────────────────────┘ │
│                                          │
│                                          │
│                                          │
│══════════════════════════════════════════│
│           ③ + Neue Session               │
└──────────────────────────────────────────┘
```

**Annotations:**
- ① Back button returns to the active chat/startscreen. Header shows "Vergangene Sessions" title.
- ② `session-list` entries: Each shows auto-generated title (from first user message), date, message count, and prompt preview (if a draft was created). Sorted newest first. Click loads the session.
- ③ Button to start a new session (generates new thread_id, returns to startscreen)

### State Variations

| State | Visual Change |
|-------|---------------|
| `empty` | Centered message: "Noch keine Sessions vorhanden" |
| `loading` | Skeleton loaders for session entries |
| `loaded` | As shown above |

---

## Screen: Error State

**Context:** Inside the chat thread. Shown when SSE streaming fails or LLM API is unreachable.

### Wireframe

```
┌──────────────────────────────────────────┐
│ Prompt Assistent  [Sonnet▾] [Sessions] [✕] │
│══════════════════════════════════════════│
│                                          │
│ [... previous messages ...]              │
│                                          │
│          ┌───────────────────────────┐    │
│          │ Ein Porträt von einer     │    │
│          │ Katze auf dem Mond        │    │
│          └───────────────────────────┘    │
│                                          │
│ ┌──────────────────────────────┐         │
│ │ ① ⚠ Verbindung unterbrochen.│         │
│ │ Die Antwort konnte nicht     │         │
│ │ geladen werden.              │         │
│ │                              │         │
│ │           ② [ Erneut versuchen ]│         │
│ └──────────────────────────────┘         │
│                                          │
│══════════════════════════════════════════│
│ [🖼] │ Nachricht eingeben…           [➤] │
└──────────────────────────────────────────┘
```

**Annotations:**
- ① `error-message`: Red-tinted chat bubble with warning icon and error description
- ② `retry-btn`: Button inside the error message. Re-sends the last user message. Max 3 automatic retries, then manual only.

### State Variations

| State | Visual Change |
|-------|---------------|
| `retrying` | Retry button shows spinner, text changes to "Versuche erneut…" |
| `permanent-error` | After 3 failed retries: "Der Assistent ist gerade nicht verfügbar. Bitte versuche es später erneut." No retry button. |

---

## Screen: Applied State

**Context:** Inside the drafting view (780px). User has clicked Apply, prompt fields have been transferred to the workspace. An undo-toast appears at the bottom.

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Prompt Assistent                    [Sonnet▾] [Sessions] [✕]    │
│══════════════════════════════════════════════════════════════════════════│
│                              │                                          │
│ [... chat ...]               │ [... canvas fields ...]                  │
│                              │                                          │
│ ┌──────────────────────┐     │                                          │
│ │ ① Prompt wurde über- │     │ ┌──────────────────────────────────────┐ │
│ │ nommen! Generiere    │     │ │                                      │ │
│ │ dein Bild und komm   │     │ │  ② ✓ Applied                        │ │
│ │ zurück wenn du       │     │ │                                      │ │
│ │ anpassen möchtest.   │     │ └──────────────────────────────────────┘ │
│ └──────────────────────┘     │                                          │
│                              │                                          │
│══════════════════════════════════════════════════════════════════════════│
│ [🖼] │ Nachricht eingeben…                                         [➤] │
└──────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────┐
  │ ③ ✓ Prompt applied.          [ Undo ]   │
  └─────────────────────────────────────────┘
```

**Annotations:**
- ① `assistant-message`: Agent confirms the apply action and encourages the iterative loop
- ② `apply-btn` in applied state: Shows checkmark and "Applied" text, reverts to "Apply" after 2 seconds
- ③ Undo-toast (sonner): Appears at bottom of viewport after apply. "Undo" action restores previous workspace field values. Auto-dismisses after 5 seconds.

---

## Completeness Check

| Check | Status |
|-------|--------|
| All Screens from UI Layout (Discovery) covered | ✅ (Assistent-Drawer, Startscreen, Session-Liste + Trigger, Chatting, Drafting, Error, Applied) |
| All UI Components annotated | ✅ (22/22 components from Discovery covered, incl. new stop-btn) |
| Relevant State Variations documented | ✅ (streaming, error, empty, canvas-updating, applied, etc.) |
| No Logic/Rules duplicated (stays in Discovery) | ✅ |
