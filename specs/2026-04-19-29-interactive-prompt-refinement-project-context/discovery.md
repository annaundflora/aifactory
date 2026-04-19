# Feature: Interactive Prompt Refinement in Assistant with Per-Project Context

**Epic:** --
**Issue:** #29
**Status:** Ready
**Wireframes:** `wireframes.md` (planned)

---

## Problem & Solution

**Problem:**
- Assistant chat optimiert Prompts heute **silent, ohne Rückfragen** (System-Prompt: "kein Fragebogen"). User muss Intent selbst vollständig formulieren, sonst ratet der Assistant.
- Treffer-Quote zwischen vorgestelltem und generiertem Bild ist niedrig, besonders bei vagem Input ("mach was Cooles") und bei i2i trotz Style-/Content-Match.
- **Reference-Bilder in der ReferenceBar (linke Seite) sind dem Assistant-LLM nicht sichtbar.** Er kann über sie nicht reden, nicht analysieren, nicht integrieren — obwohl der User sie für denselben Chat hochgeladen hat.
- Kein **Projekt-Kontext**: Wiederkehrende Themen/Stil (z.B. "POD-Shop", "Magic Mushroom Art") müssen in jeder Session neu erklärt werden.

**Solution:**
- Assistant führt ein **adaptives Interview**, bis er semantisch sicher ist, was der User will, präsentiert dann eine **Intent-Summary-Card** zum Bestätigen. Bei Abschluss-Confirm läuft **Auto-Apply + Auto-Generate** durch. Generiertes Bild wird automatisch als Multimodal-Input angehängt für Refinement.
- **ReferenceBar-Bilder** werden bei jedem Chat-Turn automatisch als Multimodal-Input an den Assistant-LLM gehängt.
- Assistant kann über erweiterte Tool-Calls auch i2i-Settings (Slot-Rollen, Strengths, Model-Params) steuern.
- Pro Projekt persistenter **Freitext-Context** (mit KI-Schreibhilfe), der jeden Turn in den System-Prompt injiziert wird. Nur für LLM, nicht für Image-Model-Prompts.

**Business Value:**
- Höhere Treffer-Quote beim ersten Generate → weniger verbrauchte Credits/Generation-Runs → schnellerer Weg zum gewünschten Ergebnis.
- Professionalisierung des zentralen UX-Features: Assistant wird vom Inspirations-Helfer zum verlässlichen Prompt-Interviewer.

---

## Scope & Boundaries

| In Scope |
|----------|
| Interview-basiertes Verhalten des Assistant-LLM (System-Prompt-Redesign) |
| Semantisches Stop-Kriterium + Intent-Summary-Card mit Confirm |
| Zwei-stufiger Confirm-Trigger: Teil-Intent-Check (kein Generate) vs. Abschluss-Confirm (Auto-Apply + Auto-Generate) |
| ReferenceBar-Slots als Multimodal-Input pro Turn |
| Generiertes Bild als Multimodal-Input (Post-Generation-Turn) |
| Erweitertes Tool-Set für i2i-Settings-Steuerung (Slot-Rolle, Strength, Model-Params) |
| Sequenzielles Multi-Reference-Interview (ein Bild nach dem anderen) |
| Paste-Detect-Confirm (Refine direkt vs. Interview starten) |
| Projects: neues Feld `context_instructions` (Freitext) + Edit-UI (dedizierte Settings-Seite/Modal) |
| Projects: "Help me write this"-Button für KI-Context-Generierung aus Kurzbeschreibung |
| Project-Context-Injection als Block im Assistant-System-Prompt (jeder Turn) |
| No-Context-Hinweis im Assistant-UI mit Link zur Settings |
| Assistant aktiv in: `txt2img`, `img2img` |

| Out of Scope |
|--------------|
| `upscale`, `inpaint`, `outpaint` — Assistant-Verhalten bleibt wie heute |
| Auto-Prepend von Project-Context in die Image-Model-API (nur LLM-seitig) |
| Neue LLM-Modelle / Austausch der Provider (bleibt OpenRouter + bestehende Allowlist) |
| Re-Interview nach jeder Refinement-Runde (nur proaktiver Starter, offener Dialog) |
| Thumbnail-Exemplare zu Multiple-Choice-Fragen (Multiple Choice ist adaptiv, aber textuell) |
| Cross-Session Memory des Assistants außerhalb der LangGraph-Checkpointer-Persistence |
| Bild-Generierung durch den Assistant in andere Projekte als den aktiven |

---

## Current State Reference

> Bestehende Funktionalität, die wiederverwendet wird. NICHT erneut in Detail-Sections dokumentiert.

- **Assistant-Chat-UI** (`components/assistant/assistant-panel.tsx`, `chat-thread.tsx`, `chat-input.tsx`, `assistant-trigger.tsx`) inkl. Streaming-Darstellung und Multimodal-Upload im Chat-Input
- **Session-State + Persistence** (`lib/assistant/assistant-context.tsx`, `lib/assistant/use-assistant-runtime.ts`) via LangGraph Checkpointer (thread_id = session UUID)
- **Backend Endpoints** (`backend/app/routes/sessions.py`, `backend/app/routes/messages.py`) inkl. SSE-Streaming
- **LLM-Config** (`backend/app/config.py`): OpenRouter, default `anthropic/claude-sonnet-4.6`, Allowlist `openai/gpt-5.4`, `google/gemini-3.1-pro-preview`; per-Request `model`-Override
- **Tools** (`backend/app/agent/`): `draft_prompt`, `refine_prompt`, `analyze_image`, `recommend_model`, `web_search`
- **System-Prompt-Composition** (`backend/app/agent/prompts.py`): Base-Prompt + dynamische Model-Knowledge-Injektion per `build_assistant_system_prompt(image_model_id, generation_mode)`
- **Apply-Flow**: `applyToWorkspace()` in AssistantContext → `setVariation({ promptMotiv, modelId, modelParams })` → `PromptArea` liest Variation → bestehender Generate-Button löst `generateImages()` Server-Action aus
- **Mode-Forwarding**: Frontend sendet `generation_mode: "txt2img" | "img2img"` an Backend (use-assistant-runtime.ts:370-373)
- **DE-Chat / EN-Prompt-Konvention** im aktuellen Base-Prompt
- **Multimodal-Format** der HumanMessage (use-assistant-runtime.ts:148-153) mit `{ type: "image_url", image_url: { url } }`
- **Projects-Tabelle** (`lib/db/schema.ts:22-47`): `id, name, thumbnailUrl, thumbnailStatus, userId, timestamps` — wird erweitert, Rest bleibt
- **ReferenceBar-Komponente** + `referenceSlots`-State in PromptArea — UI bleibt wie heute, nur Backend-Pipeline-Anschluss ist neu
- **Workspace-Variation-Mechanik** + bestehender "Apply"-Button im Chat
- **Generate-Pipeline** (Replicate API, GenerationService) — kein Eingriff

---

## UI Patterns

### Reused Patterns

| Pattern Type | Component | Usage in this Feature |
|--------------|-----------|----------------------|
| Chat-Thread | `components/assistant/chat-thread.tsx` | Renders alle neuen Turns inkl. Intent-Summary-Card als spezielle Message |
| Chat-Input | `components/assistant/chat-input.tsx` | Unverändert; User kann weiter Bilder im Chat uploaden (zusätzlich zu ReferenceBar) |
| Model-Selector | bestehender ModelSelector | Unverändert |
| ReferenceBar | bestehende Reference-Slot-UI | Unverändert; neu ist nur der Multimodal-Pipeline-Anschluss |
| Apply-Button | bestehender Apply-CTA | Bleibt, wird bei Auto-Apply-Pfad zusätzlich programmatisch ausgelöst |
| Toast/Sonner | `sonner` | Undo-Toasts nach Auto-Apply und Status-Hinweise |
| Modal/Dialog | radix-ui basierte Modal-Komponenten | Project-Context-Edit-View wird als Modal oder eigener Route mit gleichem Stil gebaut |

### New Patterns

| Pattern Type | Description | Rationale |
|--------------|-------------|-----------|
| **Intent-Summary-Card** | Strukturierte Chat-Message mit zusammengefasstem Verständnis (Subject, Style, Mood, Settings) + "So generieren" / "Nochmal diskutieren" Buttons | Kein bestehendes Chat-Card-Format im Repo; zentrales neues UX-Artefakt |
| **Paste-Detect-Confirm-Card** | Kleine Inline-Card nach dem ersten User-Turn, wenn der Input wie ein fertiger Prompt aussieht: "Refinen oder Interview starten?" | Dedupliziert One-Shot-Flow vs. Interview-Flow |
| **Context-Editor-View** | Projekt-Settings-Seite/Modal mit Freitext-Feld + "Help me write this"-Button (KI-Call mit Kurzbeschreibung) | Keine bestehende Projekt-Settings-UI |
| **No-Context-Hint-Banner** | Dezenter Hinweis im Assistant-Panel bei leerem Project-Context | Nudge zur Feature-Adoption ohne Blockade |

---

## User Flow

### Haupt-Flow: txt2img mit vagem Input

1. User öffnet Assistant im Projekt (mit oder ohne Project-Context) → Assistant-System-Prompt = Base + Project-Context (falls vorhanden) + Model-Knowledge
2. User: "mach ein Bild für meinen Shop"
3. LLM erkennt: zu vager Intent → startet Interview-Modus
4. Assistant stellt erste fokussierte Frage mit 2–3 konkreten Optionen als Text
5. User antwortet (frei oder durch Auswahl einer Option)
6. LLM prüft semantisches Verständnis → ggf. weitere Frage (Style, Motiv, Mood, Setting) oder Zwischen-Check "Verstehe ich X richtig?" (Teil-Intent, KEIN Generate)
7. Wenn LLM sicher genug ist: **Intent-Summary-Card** mit Zusammenfassung + Buttons "So generieren" / "Nochmal diskutieren"
8. User klickt "So generieren": Assistant ruft finalize-Tool auf → Auto-Apply Prompt + ggf. Settings in Workspace + Auto-Generate-Trigger
9. Generate-Pipeline läuft, Ergebnis erscheint im Workspace
10. Ergebnis-Bild wird automatisch als `image_url` in die nächste Assistant-Nachricht gemountet → Assistant kommentiert proaktiv ("Stimmung passt, Licht wirkt flach — willst du es wärmer?")
11. User antwortet → Refinement-Runde: neuer Prompt-Draft, ggf. kleine Intent-Summary oder direkt Draft → Auto-Generate auf Confirm

### i2i-Flow: mit ReferenceBar-Slots

1. User fügt ReferenceBar-Slots hinzu (linke Seite) → bleibt UI-Aktion, ändert sich nicht
2. User öffnet Assistant → bei jedem Turn werden alle aktiv belegten Slot-Bilder als Multimodal-Input angehängt
3. Assistant führt **sequenzielles Multi-Reference-Interview**: fragt pro Bild "Was übernehmen wir von diesem? Subject, Style oder Komposition?"
4. Pro Bild: User antwortet → LLM refined Antwort ("Also Style-Reference für die Farbpalette, Composition ignorieren — richtig?") → Zwischen-Confirm → setzt Slot-Rolle via Tool-Call
5. Nach letztem Bild: weitere Fragen nach Gesamt-Intent/Änderungen relativ zu den Refs
6. Ab hier weiter wie Haupt-Flow ab Schritt 7 (Intent-Summary → Generate → Refinement)

### Paste-Prompt-Flow

1. User pastet als erste Message einen fertig aussehenden Prompt
2. Heuristik (Länge > N Zeichen, viele Komma-separierte Style-Keywords) → Paste-Detect-Confirm-Card: "Refinen oder Interview starten?"
3. User wählt "Refinen" → direkt `refine_prompt` Tool → Intent-Summary-Card → Generate
4. User wählt "Interview" → normaler Interview-Flow ab Schritt 3 des Haupt-Flows

### Project-Context-Edit-Flow

1. User öffnet Projekt-Settings (neu) aus Projekt-Liste oder Workspace-Header
2. Sieht Freitext-Feld, ggf. mit bereits gespeichertem Context
3. User kann entweder direkt tippen oder "Help me write this" klicken
4. "Help me write this" öffnet Mini-Modal mit Kurzbeschreibung-Input (1–2 Sätze)
5. Backend-Call an LLM → Draft zurück → zeigt Draft im Hauptfeld zum Editieren
6. User speichert → nächste Assistant-Session im Projekt bekommt den Context im System-Prompt

### Error Paths

- **Backend-Fehler bei Auto-Generate nach Confirm** → Error-Toast "Generierung fehlgeschlagen — manuell versuchen?" + bestehender Generate-Button im Workspace bleibt aktiv
- **LLM kann Intent-Summary nicht gut bauen** (z.B. Subject fehlt total) → fällt automatisch zurück in Interview-Modus, stellt gezielte Nachfrage
- **Multimodal-Input überschreitet Token-Budget** (zu viele Reference-Slots + Result-Bild + Chat-Hist.) → Backend reduziert: oldest images first, aktuelle Slots + letztes Result haben Priorität
- **"Help me write this" fehlschlägt oder liefert schlecht** → User kann beliebig oft erneut klicken oder händisch editieren; keine Hard-Dependency
- **User generiert, ohne je mit Assistant zu sprechen** → unverändert, alter Flow funktioniert weiter
- **Reference-Slot enthält ungültige URL** → Assistant überspringt dieses Bild, meldet "Slot N konnte nicht geladen werden — bitte neu hochladen"
- **Project ohne Context + User fragt nach Stil-Konsistenz** → Assistant schlägt pro-aktiv vor, Context-Setting zu öffnen

---

## UI Layout & Context

### Screen: Assistant-Panel (bestehend, erweitert)

**Position:** Rechte Panel-Seite im Workspace, wie heute
**When:** Immer verfügbar, wenn ein Projekt geöffnet ist

**Layout:**
- **Header (bestehend):** Projekt-Name, Sessions-Dropdown, Model-Selector
- **No-Context-Hint-Banner (NEU, conditional):** Einzeiler "Kein Projekt-Context gesetzt — Context hinzufügen" mit Link zur Settings-Seite. Nur sichtbar, wenn `projects.context_instructions` leer ist.
- **Chat-Thread (bestehend, erweitert):** Zeigt normale Messages + **Intent-Summary-Card** als spezielle Message-Variante + **Paste-Detect-Confirm-Card** nach erster User-Message mit Paste-Heuristik-Match
- **Chat-Input (bestehend):** Unverändert

### Screen: Intent-Summary-Card (NEU, innerhalb Chat-Thread)

**Position:** Inline im Chat-Thread als vom Assistant generierte Card-Message
**When:** Wenn LLM semantisch sicher ist, dass er den User-Intent verstanden hat (Abschluss-Confirm-Punkt)

**Layout:**
- **Card-Header:** "Zusammenfassung — stimmt das?"
- **Summary-Body:** Strukturierte Listen-Darstellung der verstandenen Intent-Achsen (Subject, Style/Medium, Mood/Lighting, Composition, Palette, Technical/Settings), dynamisch — nur belegte Achsen anzeigen
- **Prompt-Preview:** EN-Prompt-String, den Assistant draften würde, monospace
- **Settings-Preview:** Falls Assistant i2i-Settings geändert hat (Slot-Rollen, Strengths, Model-Params) — kurze Diff-Auflistung
- **Primary-Button:** "So generieren" — löst Tool-Call aus, der Apply + Generate triggert
- **Secondary-Button:** "Nochmal diskutieren" — zurück in Interview-Modus, Card bleibt als History-Element stehen

### Screen: Paste-Detect-Confirm-Card (NEU, innerhalb Chat-Thread)

**Position:** Inline im Chat-Thread, direkt nach erster User-Message mit Paste-Heuristik-Match
**When:** Einmalig pro Session, wenn erste User-Message "prompt-artig" wirkt

**Layout:**
- **Zeile 1:** "Das sieht nach einem fertigen Prompt aus."
- **Zwei Buttons:** "Direkt verfeinern" / "Interview starten"

### Screen: Project-Context-Settings (NEU)

**Position:** Eigene Route oder Modal, erreichbar aus Projekt-Liste (Kontextmenü/Edit-Button) und aus Workspace-Header
**When:** User-Aktion explizit

**Layout:**
- **Header:** Projekt-Name, Zurück-Link
- **Context-Textarea (Hauptfeld):** Großes Freitext-Feld, mehrzeilig, Platzhalter "Beschreibe dein Projekt, damit der Assistant den Stil und Kontext kennt"
- **Help-me-write-this-Button:** neben oder über dem Feld
- **Helper-Modal** (öffnet sich beim Klick): Kurzbeschreibung-Input (1–2 Sätze), Submit → LLM-Call → Draft erscheint im Hauptfeld, zum Editieren freigegeben
- **Save-Button:** Speichert `context_instructions`
- **Unchanged-Indicator:** Zeigt letzten Änderungszeitpunkt

### Screen: No-Context-Hint-Banner (NEU)

**Position:** Oben im Assistant-Panel, oberhalb Chat-Thread
**When:** `projects.context_instructions` ist leer oder null

**Layout:**
- **Einzeilige Banner-Zeile:** "Kein Projekt-Context gesetzt." + Link "Context hinzufügen →" (springt zu Project-Context-Settings)
- **Dismissible:** Kann pro Session weggeklickt werden (Session-Scope, nicht persistent), um nicht zu nerven

---

## UI Components & States

| Element | Type | Location | States | Behavior |
|---------|------|----------|--------|----------|
| `intent_summary_card` | Chat-Card | Chat-Thread | `rendered` | Zeigt strukturierte Summary + zwei Buttons. Buttons unten beschrieben. |
| `intent_summary_card.generate_btn` | Button (Primary) | Intent-Summary-Card | `idle`, `pending`, `disabled` | `idle` → Klick löst Tool-Call `finalize_and_generate` → `pending` während Auto-Apply + Generate laufen → Card wird zur History. `disabled` falls Prompt leer. |
| `intent_summary_card.discuss_btn` | Button (Secondary) | Intent-Summary-Card | `idle` | Sendet strukturierte Assistant-Nachricht "Okay, was soll anders sein?", zurück in Interview-Modus. Card bleibt als History. |
| `paste_confirm_card` | Chat-Card | Chat-Thread | `rendered`, `dismissed` | Einmalig pro Session. `dismissed` nach Klick auf einen der Buttons. |
| `paste_confirm_card.refine_btn` | Button | Paste-Confirm-Card | `idle` | Direkter `refine_prompt` Tool-Call → führt zur Intent-Summary-Card |
| `paste_confirm_card.interview_btn` | Button | Paste-Confirm-Card | `idle` | Startet normalen Interview-Modus mit dem gepasteten Text als "Ausgangs-Intent" |
| `no_context_banner` | Banner | Assistant-Panel-Top | `visible`, `dismissed-session` | Nur sichtbar, wenn `context_instructions` leer. Session-Scope-Dismiss. |
| `no_context_banner.link` | Link | No-Context-Banner | `idle` | Route-Wechsel zu Project-Context-Settings |
| `context_textarea` | Textarea | Project-Context-Settings | `empty`, `filled`, `saving`, `saved`, `error` | Freitext-Input. Save triggert PATCH an Projects-API. `saving` → spinner, `saved` → toast, `error` → error-toast + keep edit. |
| `help_me_write_btn` | Button | Project-Context-Settings | `idle`, `pending`, `disabled` | Öffnet Helper-Modal. `disabled` wenn LLM-Call bereits läuft. |
| `helper_brief_input` | Textarea (klein) | Helper-Modal | `empty`, `filled` | Kurzbeschreibung 1–2 Sätze |
| `helper_generate_btn` | Button | Helper-Modal | `idle`, `pending`, `error` | Backend-Call → Draft-Text zurück. `error` bei Fail, Retry möglich. |
| `helper_accept_btn` | Button | Helper-Modal | `idle` | Übernimmt Draft ins Haupt-Textarea, schließt Modal, User kann editieren |
| `reference_slot` (bestehend) | Slot-Card | ReferenceBar | unverändert | Keine UI-Änderung. Backend-Pipeline neu. |

---

## Feature State Machine

### States Overview

| State | UI | Available Actions |
|-------|----|--------------------|
| `idle` | Leeres Chat-Thread, No-Context-Banner ggf. sichtbar | User schreibt Message, User öffnet Sessions-Liste, User öffnet Project-Context-Settings |
| `paste_confirmation` | Chat-Thread mit einer User-Message + Paste-Detect-Confirm-Card | Klick "Direkt verfeinern", Klick "Interview starten" |
| `interviewing` | Chat-Thread mit Q&A-Verlauf, ggf. Zwischen-Checks | User antwortet per Text oder wählt aus Vorschlägen (Text-Buttons der Options im Chat) |
| `summarizing` | Chat-Thread mit Intent-Summary-Card | Klick "So generieren", Klick "Nochmal diskutieren" |
| `generating` | Chat-Thread zeigt "Generiere…", Workspace zeigt Generate-Progress | (keine User-Aktion zwingend, User kann weiter tippen) |
| `reviewing` | Generiertes Bild ist im Workspace, Assistant-Nachricht mit Kommentar + Multimodal-Input | User gibt Refinement-Feedback, User erklärt zufrieden, User ändert Settings manuell |
| `refining` | Chat-Thread mit Refinement-Nachrichten | weitere Fragen oder neuer Draft |

> **Rule:** Eine neue Card-Interaktion oder ein neuer Pipeline-State = separater FSM-State.

### Transitions

| Current State | Trigger | UI Feedback | Next State | Business Rules |
|---------------|---------|-------------|------------|----------------|
| `idle` | User sendet erste Message, Heuristik matcht Paste | User-Message + Paste-Confirm-Card gerendert | `paste_confirmation` | Heuristik aus: Zeichen-Anzahl, Komma-Dichte, Style-Keyword-Occurrences |
| `idle` | User sendet erste Message, vager Intent | Assistant-Streaming-Response als erste Frage | `interviewing` | -- |
| `idle` | User sendet erste Message, bereits konkreter Intent + Must-Haves klar | Assistant draftet direkt, Intent-Summary-Card folgt | `summarizing` | Pflicht-Minimum: Subject + (Style oder Medium) klar |
| `paste_confirmation` | "Direkt verfeinern" geklickt | refine_prompt-Tool-Call läuft, dann Summary-Card | `summarizing` | -- |
| `paste_confirmation` | "Interview starten" geklickt | Assistant stellt erste gezielte Frage, baut auf gepastetem Text auf | `interviewing` | -- |
| `interviewing` | Assistant stellt Zwischen-Frage oder Zwischen-Check ("Verstehe ich X richtig?") | Assistant-Message gestreamt, KEIN Generate | `interviewing` | Teil-Intent-Check: User bestätigt Detail, Assistant geht weiter, kein Apply, kein Generate |
| `interviewing` | LLM hat semantisches Sicherheitsgefühl | Intent-Summary-Card wird gerendert | `summarizing` | LLM baut Card-Content aus akkumuliertem Intent |
| `summarizing` | "So generieren" geklickt | finalize_and_generate-Tool-Call, Auto-Apply in Workspace-Variation, Generate-Pipeline startet | `generating` | Tool darf nur bei `summarizing` greifen |
| `summarizing` | "Nochmal diskutieren" geklickt | Assistant-Nachricht "Was soll anders sein?" | `interviewing` | Card bleibt im History-Stream sichtbar |
| `generating` | Generate-Pipeline liefert Result-URL zurück | Assistant-Message "Hier ist das Ergebnis" + Result-Image als Multimodal-Content angehängt | `reviewing` | Result-Image wird im nächsten Assistant-Turn-State als image_url eingeschoben |
| `generating` | Generate-Pipeline schlägt fehl | Error-Toast + Chat-Message "Generierung fehlgeschlagen" | `interviewing` | Settings bleiben applied, User kann manuell generieren |
| `reviewing` | User gibt Text-Feedback ("zu dunkel") | Assistant-Streaming mit vorgeschlagener Prompt-Änderung | `refining` | -- |
| `reviewing` | User sagt "Perfekt, speichern" o.ä. | Assistant bestätigt | `idle` (Session offen, aber Flow ruht) | -- |
| `refining` | Änderung klein (z.B. Farb-Shift) | Assistant draftet direkt neuen Prompt, Summary-Card mit "So generieren" | `summarizing` | -- |
| `refining` | Änderung groß (z.B. neues Motiv) | Assistant fragt zurück | `interviewing` | -- |

---

## Business Rules

- Assistant ist aktiv nur in Generation-Modi `txt2img` und `img2img`; in `upscale`, `inpaint`, `outpaint` verhält sich Assistant wie heute (kein Interview, kein erweitertes Tool-Set)
- Interview-Sprache folgt User-Sprache (Default DE), **finaler Prompt-String ist immer Englisch**
- Projekt-Context wird als Block in den System-Prompt jeder Assistant-Session in jedem Turn eingesetzt; NICHT als User-Message, NICHT in Image-Model-API-Requests eingehängt
- Intent-Summary-Card erscheint nur, wenn der LLM semantisch sicher ist; kein Turn-Cap, kein Forced-Summary
- Zwischen-Checks während des Interviews ("Verstehe ich X richtig?") lösen **niemals** Apply oder Generate aus — nur die Abschluss-Card tut das
- Auto-Apply + Auto-Generate nur durch User-Klick auf "So generieren" in der Intent-Summary-Card
- ReferenceBar-Slots werden als Multimodal-Input nur angehängt, wenn Modus = `img2img`; im `txt2img`-Modus wird die ReferenceBar-Bild-Pipeline nicht aktiviert (auch wenn Slots befüllt wären)
- Generiertes Result-Image wird automatisch an den nächsten Assistant-Turn als Multimodal-Input angehängt (maximal letztes Ergebnis pro Session, ältere Results werden nicht wieder hochgehangen)
- Multimodal-Budget-Regel bei Budget-Überlauf: Priorisierungs-Reihenfolge absteigend — aktuelle ReferenceBar-Slots > letztes Result-Image > User-Chat-Uploads (neuste zuerst); ältere werden fallen gelassen
- Modell-Wahl: wenn User ein Non-Vision-Modell gewählt hat und ReferenceBar oder Result-Image angehängt werden sollen, **fällt der Multimodal-Anhang still weg**; Assistant arbeitet rein textuell in diesem Turn (kein Hard-Block, kein Error)
- Projekt-Context wird nur geladen, wenn User Projekt-Ownership hat (existierende Auth-Rules)
- "Help me write this" macht genau einen LLM-Call pro Klick; Rate-Limit via bestehender API-Infra, kein neues Limit nötig
- Neue Sessions übernehmen beim Start den aktuellen Projekt-Context; Context-Änderungen betreffen nur Turns nach der Änderung, laufende Sessions werden nicht retroaktiv re-system-prompted (nächster Turn zieht neuen Context)
- Paste-Detect-Confirm erscheint nur als Reaktion auf die **erste** User-Message einer Session, nicht mid-conversation
- Settings-Tool-Calls (Slot-Rolle, Strength, Model-Params) sind an den aktiven Workspace gebunden; der Assistant kann Einstellungen nur im Projekt-Scope der aktuellen Session ändern

---

## Data

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `projects.context_instructions` | No | Max-Länge 8000 Zeichen (Claude-Projects-ähnlich), UTF-8 | Nullable; Freitext; LLM-System-Prompt-Block |
| `projects.context_updated_at` | No | timestamp with timezone | Für UI-Anzeige "zuletzt geändert" |
| `SendMessageRequest.reference_slots` (Backend-DTO) | No | Array von `{ slot_index, image_url, role? }` | Neues Feld; Frontend sendet aktuelle Slot-Snapshots mit jedem Turn, Backend hängt als Multimodal-Content an |
| `SendMessageRequest.last_result_image_url` | No | URL | Frontend sendet letztes erfolgreiches Generate-Result, wenn vorhanden; Backend entscheidet (Modus, Budget), ob es angehängt wird |
| `LangGraph-State.flow_state` | No | Enum aus FSM-States (`idle`, `paste_confirmation`, `interviewing`, `summarizing`, `generating`, `reviewing`, `refining`) | Ergänzt den bestehenden LangGraph-State, damit UI den Interview-Progress erkennt |
| Tool: `finalize_and_generate` payload | Yes (bei Tool-Call) | `{ prompt: string, settings_diff?: object, model_id?: string }` | Neuer Tool-Call, löst Apply + Generate aus |
| Tool: `set_slot_role` payload | Yes (bei Tool-Call) | `{ slot_index: int, role: "subject"\|"style"\|"composition" }` | Neuer Tool-Call für i2i |
| Tool: `set_slot_strength` payload | Yes (bei Tool-Call) | `{ slot_index: int, strength: float (0.0–1.0) }` | Neuer Tool-Call für i2i |
| Tool: `set_model_params` payload | Yes (bei Tool-Call) | `{ params: Record<string, unknown> }` | Validierung pro Modell (bestehende Model-Param-Schemata) |
| Tool: `generate_project_context` payload (Help me write this) | Yes | `{ brief: string (min 10, max 500 Zeichen) }` | Input für KI-Context-Generator |

---

## Implementation Slices

> Testbare, deploybare Inkremente. Planner wird das ggf. weiter zerlegen.

### Dependencies

```
A (DB/Schema + Context-API)
  |
  +---> B (Context-Edit-UI)
  |       |
  |       +---> C (Help-me-write-this)
  |
  +---> D (System-Prompt-Komposition mit Context)
          |
          +---> E (System-Prompt-Redesign: Interview + Stop-Kriterium)
                  |
                  +---> F (Intent-Summary-Card + finalize_and_generate Tool)
                          |
                          +---> G (Auto-Apply + Auto-Generate)
                                  |
                                  +---> H (Result-Image als Multimodal für Refinement)

I (ReferenceBar -> Multimodal-Pipeline) ---> J (i2i Settings-Tools) ---> K (Multi-Reference-Interview-Flow)

L (Paste-Detect-Confirm)       --- unabhängig
M (No-Context-Hint-Banner)     --- abhängig von A
```

### Slices

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| A | Project-Context DB + API | Drizzle-Migration (`context_instructions`, `context_updated_at`), GET/PATCH Endpoint `/api/projects/{id}/context`, Auth-Scope | Migration up+down, Endpoint-Integration-Test (GET, PATCH, Auth-Deny) | -- |
| B | Project-Context Edit-UI | Neue Route/Modal mit Textarea + Save-Button, Projekt-List-Entry-Point | Playwright: Edit + Save + Re-Open zeigt gespeicherten Wert | A |
| C | "Help me write this" | Helper-Modal, neuer Endpoint `/api/projects/context/generate` mit Brief-Input, LLM-Call, Draft-Response | Unit-Test LLM-Call-Shape, Playwright: Brief → Draft → Accept zeigt im Hauptfeld | B |
| D | System-Prompt-Komposition mit Project-Context | `build_assistant_system_prompt` um `project_context`-Parameter erweitern, Backend-Messages-Endpoint lädt Context pro Session | Unit-Test: Prompt enthält Block genau dann, wenn Context nicht leer | A |
| E | System-Prompt-Redesign: Interview + Stop-Kriterium | Neuer Base-Prompt: Interview-Verhalten, adaptive Stilfragen, semantic-confidence-Signal, FSM-States, DE-Chat/EN-Prompt bleibt, strikte Regel: Zwischen-Check ≠ Generate | LLM-Evals: Vaguer Input führt zu Fragen, konkreter Input führt zu Draft; Zwischen-Check löst keinen Generate-Tool-Call aus | D |
| F | Intent-Summary-Card + `finalize_and_generate`-Tool | Neuer Tool-Call im Agent, Frontend rendert Card-Message (Summary + Primary/Secondary-Buttons), Mapping `flow_state` → UI | Playwright: Interview → Summary → Card rendert mit korrekten Buttons | E |
| G | Auto-Apply + Auto-Generate | Tool-Call triggert backend-seitig: Payload → Workspace-Variation-Update → Generate-Server-Action; Error-Handling inkl. Fallback | Integration-Test: Tool-Call E2E → Bild erscheint im Workspace; Error-Path testet Rollback + Toast | F |
| H | Result-Image als Multimodal für Refinement | Nach erfolgreichem Generate: Backend hängt Result-URL an nächsten LLM-Turn als `image_url`; Assistant-Message proaktiv-Starter | Playwright: Generate → nächster Turn zeigt Assistant-Kommentar mit Bezug zum Bild | G |
| I | ReferenceBar → Multimodal-Pipeline | Frontend sendet `reference_slots` mit jedem Turn; Backend hängt als Multimodal-Content an; Budget-Priorisierung; Fallback bei Non-Vision-Model | Unit-Test Budget-Regeln; Playwright i2i: Slots hinzufügen, Assistant kann Bilder beschreiben | E |
| J | i2i-Settings-Tools (`set_slot_role`, `set_slot_strength`, `set_model_params`) | Neue Tool-Calls mit Payload-Validierung, Workspace-Variation-Updates | Unit-Test Payload-Validation; Integration-Test: Tool-Call ändert State nachweisbar | I, F |
| K | Multi-Reference-Interview-Flow | System-Prompt-Rules für sequenziellen Bild-Scan; LLM fragt pro Slot; nutzt `set_slot_role` | LLM-Evals + Playwright: 3-Slots-Interview läuft sequenziell durch | I, J, E |
| L | Paste-Detect-Confirm | Heuristik-Funktion (Frontend oder Agent), Card-Component, Flow-State `paste_confirmation` | Unit-Test Heuristik; Playwright: Paste-Input löst Card, Buttons führen zu richtigem Next-State | E, F |
| M | No-Context-Hint-Banner + Dismissible-Session-State | Banner-Component im Assistant-Panel, Session-State für Dismiss | Playwright: Projekt ohne Context zeigt Banner, Klick Dismiss versteckt für Session | A |

### Recommended Order

1. **Slice A:** Project-Context DB + API — Fundament für alles Context-Bezogene, niedriges Risiko
2. **Slice B:** Project-Context Edit-UI — User-Value direkt sichtbar (Context-Feld funktioniert)
3. **Slice D:** System-Prompt-Komposition mit Context — Assistant nimmt Context schon vor E/F, auch im alten Interview-losen Modus
4. **Slice M:** No-Context-Hint-Banner — parallel zu B/D, kleine UX-Politur
5. **Slice C:** Help-me-write-this — nice-to-have nach B, reduziert Einstiegshürde
6. **Slice E:** System-Prompt-Redesign — Kern-Delta des Features (Interview-Modus); Eval-intensiv
7. **Slice F:** Intent-Summary-Card + finalize_and_generate — visueller Payoff, testet E in Action
8. **Slice G:** Auto-Apply + Auto-Generate — schließt den Haupt-Flow
9. **Slice H:** Result-Image-Multimodal — schließt den Refinement-Loop
10. **Slice I:** ReferenceBar → Multimodal — öffnet i2i-Feature
11. **Slice J:** i2i-Settings-Tools — erweitert Assistant-Steuerbarkeit
12. **Slice K:** Multi-Reference-Interview — baut auf I+J+E auf
13. **Slice L:** Paste-Detect-Confirm — UX-Optimierung, kann nach E/F jederzeit rein

---

## Context & Research

### Similar Patterns in Codebase

| Feature | Location | Relevant because |
|---------|----------|------------------|
| Multimodal-HumanMessage-Build | `lib/assistant/use-assistant-runtime.ts:148-153` | Exakt das Pattern, das für ReferenceBar- und Result-Anhänge erweitert wird |
| Agent-Tool-Framework | `backend/app/agent/` (draft_prompt, refine_prompt, analyze_image, recommend_model, web_search) | Neue Tools (finalize_and_generate, set_slot_role, set_slot_strength, set_model_params, generate_project_context) folgen demselben Pattern |
| System-Prompt-Komposition | `backend/app/agent/prompts.py:85-123` (build_assistant_system_prompt) | Wird erweitert um `project_context`-Parameter |
| Apply-to-Workspace-Flow | `lib/assistant/assistant-context.tsx:487-522` | Wird durch `finalize_and_generate`-Tool programmatisch ausgelöst, Funktion unverändert nutzbar |
| Mode-Forwarding (txt2img/img2img) | `lib/assistant/use-assistant-runtime.ts:370-373` | Wird nicht geändert, nur genutzt: ReferenceBar-Multimodal-Pipeline nur bei `img2img` aktiv |
| Drizzle-Schema + Migrations | `lib/db/schema.ts` + drizzle-kit | Pattern für `context_instructions`-Feld + Migration |

### Web Research

| Source | Finding |
|--------|---------|
| Google Research — "Asking Clarifying Questions for Preference Elicitation with LLMs" (arxiv 2510.12015) | Funnel-Fragen (specific → general) und explizites Training auf Clarification-Behavior schlagen naives Prompting deutlich |
| INTENT-SIM (NAACL 2025) | **Log-Likelihood-Confidence-Thresholds performen schlechter als Random** als Stop-Kriterium. Self-Simulate-Answer-Entropy ist das robustere Signal — bestätigt unsere Wahl für "semantisches Verständnis" statt harter Confidence-Zahl |
| Adaptive Prompt Elicitation for T2I (arxiv html 2602.04713) | Multiple-Choice > Open-Text für Style/Mood-Fragen; Exemplar-Images wären noch besser (bewusst out-of-scope, kann später dazu) |
| BFL Flux Kontext i2i guide | Drei-Achsen-Decomposition: Subject-Reuse / Style-Reference / Composition-Reference — genau unser Multi-Reference-Interview-Rahmen |
| NVIDIA VLM Prompting Guide | Strukturierte zero-shot-Fragen an VLM (Subject, Style, Lighting, Composition) liefern konsistentere Beschreibungen — Option für spätere VLM-Caption-Variante |
| Claude Projects / Custom GPTs / Cursor Rules | Persistenter Projekt-Context als System-Message jeden Turn ist Industrie-Standard; Per-Turn-User-Message-Injection birgt Injection-Risiko — bestätigt unsere Wahl |
| Midjourney /describe, Leonardo Prompt Enhance, DALL-E in ChatGPT | Kein großer Anbieter macht echtes Interview-Elicitation; Market-Gap bestätigt — Feature ist differenzierend |
| Zapier 70 AI art styles / Travis Nicholson 150 styles / Leonardo "Subject-Medium-Lighting-Palette" | Style-Fragen benötigen Taxonomie-Basis; Artist-Namen haben höchste Info-per-Token — System-Prompt kann Assistant coachen, solche zu elicitieren |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| 1 | Wie wird "semantisches Verständnis" als Stop-Signal im LLM-Prompt formuliert, ohne dass er in endlose Rückfragen oder in vorschnelle Summary verfällt? | A) Explizite Regel "nur Summary, wenn du die 6 Achsen abdecken kannst" B) Eval-Set mit Beispielen C) Beides | C | Wird in Slice E während Eval-Tuning entschieden |
| 2 | Wer triggert `generate_project_context` — Frontend-Endpoint-Call oder Assistant-Agent-Tool? | A) Eigener REST-Endpoint (getrennt vom Agent) B) Agent-Tool | A | Getrennter REST-Endpoint, keine Session-Instanziierung nötig |
| 3 | Soll User im Settings auch den generierten Context vor Übernahme ablehnen können? | A) Ja, "Annehmen / Neu generieren / Abbrechen" B) Nur Annehmen (User editiert eh nachher) | A | Architecture-Entscheidung, UX-konsistent mit Editier-Philosophie |
| 4 | Multimodal-Budget: konkrete Byte- oder Token-Caps? | A) Fix (z.B. 4 Images pro Turn) B) Modell-spezifisch C) Dynamisch | B | Modell-spezifische Caps aus Model-Knowledge ableitbar |
| 5 | Wie verhält sich das Feature bei Concurrent-Generation (User hat bereits Gen laufen, klickt "So generieren" in Card)? | A) Queue B) Block mit Hinweis C) Abort-first-or-second | B | Block mit Hinweis bis bestehende Gen fertig — verhindert verlorene Credits |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-04-19 | Codebase — Assistant-Architektur | OpenRouter + Claude Sonnet 4.6 Default; 3-Model-Allowlist; LangGraph Checkpointer für Session-Persistence; SSE-Streaming auf Nachrichten-Endpoint |
| 2026-04-19 | Codebase — System-Prompt | Base-Prompt in `backend/app/agent/prompts.py:17-82`; explizit "kein Fragebogen"; MUST-HAVES: Motiv/Stil/Zweck |
| 2026-04-19 | Codebase — Tools | 5 bestehende Tools: draft_prompt, refine_prompt, analyze_image, recommend_model, web_search |
| 2026-04-19 | Codebase — Apply-Flow | `applyToWorkspace()` setzt Workspace-Variation; User klickt manuell Generate |
| 2026-04-19 | Codebase — ReferenceBar | Slots werden im Workspace-State gehalten, aktuell NICHT an Assistant-LLM gereicht — Hauptgrund für das Feature |
| 2026-04-19 | Codebase — Projects-Tabelle | Schema enthält nur id/name/thumbnail*-Felder, kein Kontext-Feld — muss erweitert werden |
| 2026-04-19 | Web — Prompt-Elicitation-SOTA | Interview-Pattern nicht am Markt verbreitet; Google 2025 + INTENT-SIM + Adaptive Prompt Elicitation bestätigen Richtung; Confidence-Threshold als Stop-Kriterium ist schlecht |
| 2026-04-19 | Web — Projekt-Context-Injection | System-Message-jeden-Turn ist Industrie-Standard (Claude Projects, Custom GPTs, Cursor Rules); Per-Turn-User-Injection riskant |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| 1 | Gibt es ein GitHub Issue zu diesem Feature? | User wollte wissen, in welchem Repo — `annaundflora/aifactory` bestätigt; neues Issue erstellt (#29) |
| 2 | Wie gehen wir vor, bevor wir in die Detail-Q&A einsteigen? | Recherche + Web-Research zu Prompt-Engineering-Patterns — parallele Codebase-Exploration (Explore-Agent) + Web-SOTA-Report (general-purpose-Agent) durchgeführt |
| 3 | Issue title (English) — passt das? | "Interactive prompt refinement in Assistant with per-project context" gewählt |
| 4 | Soll ich ein neues Issue anlegen? | Ja, Issue erstellen — Issue #29 via `gh issue create` erstellt |
| 5 | ReferenceBar-Bilder (linke Seite) — wie soll der Assistant sie sehen? | Automatisch alle Slots als Multimodal-Input — jeden Turn werden aktiv belegte Reference-Slot-Bilder + Rolle an den LLM gehängt |
| 6 | Wie bestimmt der Assistant, wann er aufhört zu fragen und den finalen Prompt baut? | LLM soll semantisch sicher sein, unabhängig fester 6-Achsen-Pflicht. Bei Sicherheit: Zusammenfassung + User-Confirm "So generieren?". Danach läuft Refinement weiter. Idee: Assistant steuert auch i2i-Settings. Multi-Image-Interview pro Bild mit Confirm-Schleife (User-Antwort → LLM-Refine → User-Confirm) |
| 7 | Wie aggressiv soll der Interview-Stil sein — und bleibt der Vorschlags-Charakter erhalten? | Adaptiv, je nach User-Intent und Input. Bei vagem Input mehr Fragen + Vorschläge, bei konkretem weniger |
| 8 | Darf der Assistant auch i2i-Einstellungen steuern (über Chat), oder bleibt er beim Prompt-Text? | Chat steuert Prompt + i2i-Settings. Neue Tool-Calls für Slot-Rollen, Strengths, Model-Params |
| 9 | Was passiert, nachdem Assistant die Intent-Summary bestätigt bekommt? | Je nach Turn: wenn es nur ein Teil-Intent ist, kein Auto-Generate. Wenn es abschließend mit Frage "so generieren?" war, dann Auto-Apply + Auto-Generate (Recommended-Option) |
| 10 | Sieht der Assistant das generierte Bild fürs Refinement automatisch? | Ja, Result wird automatisch als Multimodal-Input an den nächsten Turn angehängt |
| 11 | Verhalten, wenn User einen fertigen Prompt einfach reinpastet? | Immer erst kurze Confirm-Frage ("Fertig so, oder interviewen?") |
| 12 | Wie wird der Project-Context befüllt? | Freitext + "Help me write this"-Button (KI-gestützt) |
| 13 | Wie wird der Project-Context in den Assistant-LLM eingespeist? | Als Teil des System-Prompts, jeden Turn |
| 14 | Soll der Projekt-Context auch für die Bild-Modelle (nicht nur LLM) genutzt werden? | Nein, nur für den Assistant-LLM |
| 15 | Wie ist die Intent-Summary visuell — normale Chat-Message oder spezielle UI-Card? | Spezielle Confirm-Card mit Ja/Nein-Buttons |
| 16 | Multi-Image-Interview: Assistant fragt bei mehreren Reference-Slots… | Sequenziell, pro Bild einzeln |
| 17 | "Help me write this"-Button beim Project-Context — welcher Input? | Nur Kurzbeschreibung, keine Bilder |
| 18 | Wo bearbeitet der User den Project-Context (UI-Location)? | Dedizierte Project-Settings-Seite / Modal |
| 19 | Nach jeder Generierung — startet Assistant automatisch eine Refinement-Runde oder wartet er? | Wartet auf User-Feedback, aber mit proaktivem Starter |
| 20 | Sprache des Interviews — soll die heutige Trennung bleiben? | DE mit User, EN für Prompt-Text (wie heute) |
| 21 | In welchen Generation-Modes ist der neue Assistant aktiv? | txt2img und img2img; upscale/inpaint/outpaint out of scope |
| 22 | Wenn für ein Projekt (noch) KEIN Context gesetzt ist — wie verhält sich der Assistant? | Läuft normal, ohne Prepend, dezenter UI-Hinweis im Assistant-Panel |
| 23 | Sollen Wireframes (ASCII) für die neuen UI-Bausteine erstellt werden? | Ja, alle neuen UI-Teile (Intent-Summary-Card, Project-Context-Settings, Paste-Detect-Confirm, No-Context-Hinweis) |
| 24 | Sign-Off: Kann ich das Discovery-Dokument so schreiben und in den Worktree committen? | Ja, schreib es — Branch + Worktree + commit |
