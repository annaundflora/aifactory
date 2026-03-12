# Slim Slice Decomposition

**Feature:** Prompt Assistant
**Discovery-Slices:** 8 grobe Slices
**Atomare Slices:** 22
**Stack:** TypeScript (Next.js 16.1.6 + React 19.2.3 + Tailwind 4 + Drizzle ORM) + Python (FastAPI + LangGraph)
**Test Framework:** vitest + playwright (Frontend), pytest (Python Backend)

---

## Dependency Graph

```
slice-01 (Python Projekt-Setup)
  |
  +---> slice-02 (FastAPI Server + Health)
  |       |
  |       +---> slice-03 (LangGraph Agent Grundstruktur)
  |               |
  |               +---> slice-04 (SSE Streaming Endpoint)
  |                       |
  |                       +---> slice-10 (Core Chat Loop: Frontend <-> Backend)
  |                       |       |
  |                       |       +---> slice-12 (draft_prompt + refine_prompt Tools)
  |                       |       |       |
  |                       |       |       +---> slice-14 (Canvas Panel UI)
  |                       |       |       |       |
  |                       |       |       |       +---> slice-15 (Apply-Button + Workspace-Integration)
  |                       |       |       |       |       |
  |                       |       |       |       |       +---> slice-19 (Iterativer Loop)
  |                       |       |       |       |
  |                       |       |       |       +---> slice-20 (recommend_model + get_model_info Tools)
  |                       |       |       |               |
  |                       |       |       |               +---> slice-21 (Model-Empfehlung UI)
  |                       |       |       |
  |                       |       |       +---> slice-16 (analyze_image Tool Backend)
  |                       |       |               |
  |                       |       |               +---> slice-17 (Image Upload im Chat UI)
  |                       |       |                       |
  |                       |       |                       +---> slice-18 (Bildanalyse DB + Caching)
  |                       |       |
  |                       |       +---> slice-11 (Streaming-Anzeige + Stop-Button)
  |                       |
  |                       +---> slice-13a (Session-Tabelle + Repository Backend)
  |                               |
  |                               +---> slice-13b (Session-Liste UI)
  |                               |
  |                               +---> slice-13c (Session Resume + Switcher)
  |
slice-05 (DB Schema: assistant_sessions + assistant_images)
  |
  +---> slice-13a (Session-Tabelle + Repository Backend)

slice-06 (Next.js Proxy + Config)

slice-07 (Legacy Cleanup)
  |
  +---> slice-08 (Assistant Sheet Shell + Trigger Button)
          |
          +---> slice-09 (Startscreen + Suggestion Chips)
                  |
                  +---> slice-10 (Core Chat Loop)

slice-22 (LangSmith Tracing + Observability)
```

---

## Slice-Liste

### Slice 01: Python Projekt-Setup
- **Scope:** Python-Backend Projektstruktur im `backend/` Subfolder anlegen: `pyproject.toml` mit allen Dependencies (FastAPI, LangGraph, langchain-openai, langgraph-checkpoint-postgres, sse-starlette, pydantic-settings, psycopg, Pillow, langsmith, uvicorn), Ordnerstruktur (`backend/app/`, `backend/app/services/`, `backend/app/routes/`, `backend/app/agent/`, `backend/app/models/`), `backend/app/config.py` (pydantic-settings mit allen env vars), `backend/.env.example`.
- **Deliverables:**
  - `backend/pyproject.toml`
  - `backend/app/__init__.py`
  - `backend/app/config.py`
- **Done-Signal:** `cd backend && pip install -e .` laeuft erfolgreich, `python -c "from app.config import settings"` importiert ohne Fehler.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 1 "Python Backend Setup"

---

### Slice 02: FastAPI Server + Health Endpoint
- **Scope:** FastAPI Application Factory (`backend/app/main.py`) mit CORS-Middleware, Lifespan-Handler fuer DB-Connection, Health-Check Endpoint (`GET /api/assistant/health`). Uvicorn-Startscript.
- **Deliverables:**
  - `backend/app/main.py`
  - `backend/app/routes/__init__.py`
  - `backend/app/routes/health.py`
- **Done-Signal:** `uvicorn app.main:app` startet, `GET /api/assistant/health` antwortet `{"status": "ok", "version": "1.0.0"}`.
- **Dependencies:** ["slice-01"]
- **Discovery-Quelle:** Slice 1 "Python Backend Setup"

---

### Slice 03: LangGraph Agent Grundstruktur
- **Scope:** LangGraph Agent mit `create_react_agent` Pattern: Custom State (`PromptAssistantState` mit messages, draft_prompt, reference_images, recommended_model, collected_info, phase), System Prompt (deutsch/englisch), PostgresSaver Setup (`checkpointer.setup()`), Agent-Node mit OpenRouter LLM (langchain-openai + base_url).
- **Deliverables:**
  - `backend/app/agent/graph.py`
  - `backend/app/agent/state.py`
  - `backend/app/agent/prompts.py`
- **Done-Signal:** `python -c "from app.agent.graph import create_agent; g = create_agent()"` erstellt den Graphen ohne Fehler. Unit-Test: Agent antwortet auf eine einfache Nachricht.
- **Dependencies:** ["slice-02"]
- **Discovery-Quelle:** Slice 1 "Python Backend Setup"

---

### Slice 04: SSE Streaming Endpoint
- **Scope:** POST-Route `/api/assistant/sessions/{id}/messages` mit SSE-Streaming via `sse-starlette`. `AssistantService` orchestriert: Message validieren, LangGraph `astream_events()` aufrufen, Events in SSE-Format konvertieren (text-delta, tool-call-result, text-done, error). Rate Limiting (30 msg/min, 100 msg/session).
- **Deliverables:**
  - `backend/app/routes/messages.py`
  - `backend/app/services/assistant_service.py`
  - `backend/app/models/dtos.py`
- **Done-Signal:** POST an `/api/assistant/sessions/{id}/messages` mit `content: "Hallo"` liefert SSE-Stream mit text-delta Events und text-done Event.
- **Dependencies:** ["slice-03"]
- **Discovery-Quelle:** Slice 1 "Python Backend Setup" + Slice 3 "Core Chat Loop"

---

### Slice 05: DB Schema (Drizzle) -- assistant_sessions + assistant_images
- **Scope:** Drizzle-Schema-Definitionen fuer `assistant_sessions` und `assistant_images` Tabellen in der bestehenden `schema.ts`. Beide Tabellen mit allen Feldern laut Architecture (id, project_id FK, title, status, last_message_at, message_count, has_draft, timestamps fuer sessions; id, session_id FK, image_url, analysis_result fuer images). Migration generieren und ausfuehren.
- **Deliverables:**
  - `lib/db/schema.ts` (erweitert)
  - `lib/db/queries.ts` (erweitert: `getSessionsByProject`, `getSessionById`)
- **Done-Signal:** `npx drizzle-kit push` laeuft erfolgreich, Tabellen existieren in PostgreSQL. Queries kompilieren ohne Fehler.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 5 "Session Management"

---

### Slice 06: Next.js Proxy Rewrite + Config
- **Scope:** Next.js `rewrites` Konfiguration in `next.config.ts` hinzufuegen: `/api/assistant/:path*` wird auf `http://localhost:8000/api/assistant/:path*` proxied. Environment-Variable `ASSISTANT_BACKEND_URL` fuer konfigurierbare Backend-URL.
- **Deliverables:**
  - `next.config.ts` (erweitert)
- **Done-Signal:** Next.js startet ohne Fehler. Request an `/api/assistant/health` wird an FastAPI durchgeleitet (wenn Backend laeuft).
- **Dependencies:** []
- **Discovery-Quelle:** Slice 3 "Core Chat Loop" (Architektur-Entscheidung: Proxy Pattern)

---

### Slice 07: Legacy Cleanup -- Builder + Templates entfernen
- **Scope:** Entferne die alten Prompt-Builder und Template-Dateien die vom Assistenten ersetzt werden. Entferne Imports/Usage in `prompt-area.tsx`. Entferne Snippet-Service und Snippet-CRUD aus `app/actions/prompts.ts` (behalte getPromptHistory, getFavoritePrompts, toggleFavorite, improvePrompt). Entferne `promptSnippets` Tabelle aus Schema (oder markiere deprecated).
- **Deliverables:**
  - Geloescht: `components/prompt-builder/` (ganzer Ordner: builder-drawer, category-tabs, option-chip, snippet-form, surprise-me-button + Tests)
  - Geloescht: `components/workspace/template-selector.tsx` + Test
  - Geloescht: `lib/builder-fragments.ts`, `lib/prompt-templates.ts`, `lib/services/snippet-service.ts` + Test
  - Bereinigt: `app/actions/prompts.ts` (Snippet-CRUD entfernt)
  - Bereinigt: `components/workspace/prompt-area.tsx` (BuilderDrawer + TemplateSelector Imports/Usage entfernt)
- **Done-Signal:** Build (`next build`) laeuft ohne Fehler. Keine toten Imports. Prompt-Area rendert ohne Builder/Template-Buttons.
- **Dependencies:** []
- **Discovery-Quelle:** Migration Map aus Architecture

---

### Slice 08: Assistant Sheet Shell + Trigger Button
- **Scope:** Neuer Trigger-Button (Sparkles Icon) in `prompt-area.tsx` an der Position des ehemaligen Builder-Buttons. Neue `AssistantSheet` Component (Sheet von rechts, 480px breit) mit Header (Titel "Prompt Assistent", Close-Button). Noch ohne Chat-Inhalt -- nur leere Shell mit open/close State.
- **Deliverables:**
  - `components/assistant/assistant-sheet.tsx`
  - `components/assistant/assistant-trigger.tsx`
  - `components/workspace/prompt-area.tsx` (erweitert: neuer Trigger-Button)
- **Done-Signal:** Sparkles-Button in PromptArea sichtbar. Klick oeffnet Sheet von rechts (480px). X-Button schliesst Sheet. Escape schliesst Sheet.
- **Dependencies:** ["slice-07"]
- **Discovery-Quelle:** Slice 2 "Chat UI Shell"

---

### Slice 09: Startscreen + Suggestion Chips
- **Scope:** Startscreen innerhalb der AssistantSheet: Willkommens-Text "Womit kann ich dir helfen?", 4 Suggestion-Chips (2x2 Grid), Session-History-Link (hidden wenn keine Sessions), Chat-Input Footer (Textarea + Send-Button disabled + Image-Upload-Button placeholder). Model-Selector Dropdown im Header.
- **Deliverables:**
  - `components/assistant/startscreen.tsx`
  - `components/assistant/chat-input.tsx`
  - `components/assistant/model-selector.tsx`
- **Done-Signal:** Sheet oeffnet mit Startscreen. 4 Chips sichtbar und klickbar (logt Intent in Console). Chat-Input sichtbar. Model-Selector Dropdown funktioniert (Sonnet 4.6 / GPT-5.4 / Gemini 3.1 Pro).
- **Dependencies:** ["slice-08"]
- **Discovery-Quelle:** Slice 2 "Chat UI Shell"

---

### Slice 10: Core Chat Loop (Frontend <-> Backend)
- **Scope:** Vollstaendiger Roundtrip: User tippt Nachricht -> POST an `/api/assistant/sessions/{id}/messages` -> SSE Stream -> Assistant-Message erscheint im Chat. `useAssistantRuntime` Hook mit Custom `ChatModelAdapter` (SSE-Parser), `PromptAssistantContext` (React Context fuer Session-State). Chat-Thread Component mit User/Assistant Message Bubbles. Session-Erstellung bei erster Nachricht (POST `/api/assistant/sessions`).
- **Deliverables:**
  - `lib/assistant/use-assistant-runtime.ts`
  - `lib/assistant/assistant-context.tsx`
  - `components/assistant/chat-thread.tsx`
- **Done-Signal:** User tippt Nachricht, Agent antwortet (gestreamt). Messages erscheinen als Bubbles (User rechts, Assistant links). Neue Session wird erstellt bei erster Nachricht.
- **Dependencies:** ["slice-04", "slice-06", "slice-09"]
- **Discovery-Quelle:** Slice 3 "Core Chat Loop"

---

### Slice 11: Streaming-Anzeige + Stop-Button
- **Scope:** Streaming-Indicator (animierte Punkte) waehrend Agent antwortet. Zeichenweise Text-Anzeige in Assistant-Bubble. Send-Button wird waehrend Streaming durch Stop-Button (Square Icon) ersetzt. Stop-Button bricht SSE-Stream ab, bisheriger Text bleibt. Chat-Input bleibt waehrend Streaming aktiv (User kann tippen).
- **Deliverables:**
  - `components/assistant/streaming-indicator.tsx`
  - `components/assistant/chat-input.tsx` (erweitert: Stop-Button, aktiv waehrend Streaming)
  - `components/assistant/chat-thread.tsx` (erweitert: Streaming-Text-Rendering)
- **Done-Signal:** Waehrend Agent antwortet: animierte Punkte sichtbar, Text erscheint zeichenweise, Stop-Button statt Send-Button. Stop-Klick bricht ab, Text bleibt. Input bleibt aktiv.
- **Dependencies:** ["slice-10"]
- **Discovery-Quelle:** Slice 3 "Core Chat Loop"

---

### Slice 12: draft_prompt + refine_prompt Tools (Backend)
- **Scope:** LangGraph Tools `draft_prompt` und `refine_prompt` implementieren. `draft_prompt` erstellt strukturierten Prompt (motiv, style, negative_prompt) aus collected_info. `refine_prompt` passt bestehenden Draft an. Post-Process-Node aktualisiert State-Felder (draft_prompt). Tool-Call-Results werden als `tool-call-result` SSE-Events gesendet.
- **Deliverables:**
  - `backend/app/agent/tools/prompt_tools.py`
  - `backend/app/agent/graph.py` (erweitert: Tools registriert, post_process_node)
- **Done-Signal:** Agent ruft `draft_prompt` auf wenn Must-Haves bekannt -> SSE-Event `tool-call-result` mit `{motiv, style, negative_prompt}` wird gesendet. `refine_prompt` aendert bestehenden Draft.
- **Dependencies:** ["slice-10"]
- **Discovery-Quelle:** Slice 4 "Prompt Canvas + Apply"

---

### Slice 13a: Session-Tabelle + Repository (Backend)
- **Scope:** Python-seitiges Session-Repository: CRUD-Operationen fuer `assistant_sessions` Tabelle (create, get_by_id, list_by_project, update, increment_message_count, set_title). Nutzt psycopg3 direkt (kein ORM). Routes: POST `/api/assistant/sessions`, GET `/api/assistant/sessions?project_id=`, GET `/api/assistant/sessions/{id}`, PATCH `/api/assistant/sessions/{id}`.
- **Deliverables:**
  - `backend/app/services/session_repository.py`
  - `backend/app/routes/sessions.py`
  - `backend/app/models/dtos.py` (erweitert: Session DTOs)
- **Done-Signal:** Alle Session-CRUD Endpoints antworten korrekt. POST erstellt Session in DB. GET listet Sessions fuer project_id. PATCH archiviert Session.
- **Dependencies:** ["slice-04", "slice-05"]
- **Discovery-Quelle:** Slice 5 "Session Management"

---

### Slice 13b: Session-Liste UI
- **Scope:** Session-Liste Component innerhalb des Drawers (ersetzt Chat-Ansicht). Zeigt vergangene Sessions chronologisch sortiert (neueste zuerst). Pro Eintrag: Titel (erste User-Message), Datum, Nachrichten-Anzahl, Prompt-Preview. Empty State. Zurueck-Button. "Neue Session" Button.
- **Deliverables:**
  - `components/assistant/session-list.tsx`
  - `lib/assistant/use-sessions.ts`
- **Done-Signal:** Klick auf "Vergangene Sessions" zeigt Session-Liste. Sessions werden vom Backend geladen. Empty State wenn keine Sessions. "Neue Session" navigiert zum Startscreen.
- **Dependencies:** ["slice-13a"]
- **Discovery-Quelle:** Slice 5 "Session Management"

---

### Slice 13c: Session Resume + Switcher
- **Scope:** Session laden und fortsetzen: Klick auf Session in Liste laedt State (Messages, Draft, Recommendation) vom Backend (GET `/api/assistant/sessions/{id}` -> LangGraph Checkpointer). Chat-History wird wiederhergestellt. Session-Switcher Button im Sheet-Header navigiert zur Session-Liste. Auto-Title aus erster User-Message.
- **Deliverables:**
  - `components/assistant/session-switcher.tsx`
  - `lib/assistant/assistant-context.tsx` (erweitert: Session laden/wechseln)
  - `backend/app/services/assistant_service.py` (erweitert: Session State aus Checkpointer lesen)
- **Done-Signal:** Session-Wechsel laedt Chat-History korrekt. Session-Switcher im Header navigiert zur Liste. Auto-Title wird nach erster Nachricht gesetzt.
- **Dependencies:** ["slice-13b"]
- **Discovery-Quelle:** Slice 5 "Session Management"

---

### Slice 14: Prompt Canvas Panel UI
- **Scope:** Canvas-Panel rechts im Sheet (Split-View: Chat 50% / Canvas 50%). Sheet expandiert von 480px auf 780px wenn Canvas erscheint (animiert). Canvas zeigt 3 editierbare Textareas (Motiv, Style, Negative Prompt). Reagiert auf `tool-call-result:draft_prompt` und `tool-call-result:refine_prompt` SSE-Events. Canvas-Felder direkt editierbar (lokaler State).
- **Deliverables:**
  - `components/assistant/prompt-canvas.tsx`
  - `components/assistant/assistant-sheet.tsx` (erweitert: Split-View, dynamische Breite)
  - `lib/assistant/assistant-context.tsx` (erweitert: Canvas-State, Tool-Call-Event-Handling)
- **Done-Signal:** Wenn Agent `draft_prompt` aufruft: Sheet expandiert auf 780px, Canvas erscheint mit strukturiertem Prompt. Felder editierbar. `refine_prompt` aktualisiert Canvas.
- **Dependencies:** ["slice-12"]
- **Discovery-Quelle:** Slice 4 "Prompt Canvas + Apply"

---

### Slice 15: Apply-Button + Workspace-Integration
- **Scope:** Apply-Button im Canvas-Panel: uebertraegt Canvas-Felder (motiv, style, negativePrompt) in Workspace PromptArea via `useWorkspaceVariation` Context. Undo-Toast (sonner): "Prompt uebernommen. [Rueckgaengig]" -- Klick stellt vorherige Werte wieder her. Button zeigt "Applied!" mit Checkmark fuer 2 Sekunden.
- **Deliverables:**
  - `components/assistant/apply-button.tsx`
  - `components/assistant/prompt-canvas.tsx` (erweitert: Apply-Button integriert)
  - `lib/assistant/assistant-context.tsx` (erweitert: Apply-Logic, Undo-State)
- **Done-Signal:** Klick auf Apply -> Workspace-Felder (promptMotiv, promptStyle, negativePrompt) werden befuellt. Undo-Toast erscheint, Klick auf "Rueckgaengig" stellt alte Werte her. Button zeigt kurz "Applied!".
- **Dependencies:** ["slice-14"]
- **Discovery-Quelle:** Slice 4 "Prompt Canvas + Apply"

---

### Slice 16: analyze_image Tool (Backend)
- **Scope:** LangGraph Tool `analyze_image`: Empfaengt Image-URL, downloaded Bild, skaliert auf max 1024px via Pillow, sendet an ausgewaehltes Chat-Model (Vision), extrahiert strukturiertes JSON (subject, style, mood, lighting, composition, palette). Ergebnis wird im Agent-State gespeichert (`reference_images`).
- **Deliverables:**
  - `backend/app/agent/tools/image_tools.py`
  - `backend/app/agent/graph.py` (erweitert: analyze_image Tool registriert)
- **Done-Signal:** Agent erhaelt Nachricht mit Bild-URL -> ruft analyze_image auf -> SSE-Event `tool-call-result:analyze_image` mit strukturierter Analyse. Bild wird auf 1024px skaliert.
- **Dependencies:** ["slice-12"]
- **Discovery-Quelle:** Slice 6 "Bildanalyse"

---

### Slice 17: Image Upload im Chat UI
- **Scope:** Image-Upload-Button (Image Icon) im Chat-Input. File-Picker (JPEG, PNG, WebP, max 10MB). Upload zu R2 via bestehende `uploadSourceImage` Server Action. Bild-Preview als Thumbnail inline in User-Message. Upload-Progress-Anzeige. Image-URL wird mit der naechsten Nachricht an Backend gesendet (`image_url` Feld in SendMessageRequest).
- **Deliverables:**
  - `components/assistant/image-upload-button.tsx`
  - `components/assistant/image-preview.tsx`
  - `components/assistant/chat-input.tsx` (erweitert: Image-Upload integriert, image_url Feld)
- **Done-Signal:** Klick auf Image-Button oeffnet File-Picker. Bild wird hochgeladen (R2). Thumbnail erscheint inline in User-Message. Naechste Nachricht sendet image_url mit. Agent analysiert Bild.
- **Dependencies:** ["slice-16"]
- **Discovery-Quelle:** Slice 6 "Bildanalyse"

---

### Slice 18: Bildanalyse DB + Caching
- **Scope:** `assistant_images` Tabelle nutzen: Nach Analyse wird Ergebnis (`analysis_result` JSONB) in DB gecacht. Vor Vision-API-Call pruefen ob Analyse fuer image_url bereits existiert -> Cache-Hit vermeidet erneuten API-Call. Python-seitiges Image-Repository.
- **Deliverables:**
  - `backend/app/services/image_repository.py`
  - `backend/app/agent/tools/image_tools.py` (erweitert: Cache-Lookup vor Vision-Call)
- **Done-Signal:** Erstes Bild wird analysiert und Ergebnis in `assistant_images` gespeichert. Zweites Mal gleiches Bild -> kein Vision-API-Call, Ergebnis aus DB.
- **Dependencies:** ["slice-17"]
- **Discovery-Quelle:** Slice 6 "Bildanalyse"

---

### Slice 19: Iterativer Loop
- **Scope:** Nach Apply bleibt Session offen. User kann Sheet schliessen, Bild generieren, Assistenten wieder oeffnen -> Chat-History ist da. User kann sagen "zu dunkel, aendere den Prompt" -> Agent passt Canvas an -> Re-Apply moeglich. Canvas zeigt letzten applied Prompt. Sheet oeffnet mit letzter aktiver Session (wenn vorhanden).
- **Deliverables:**
  - `lib/assistant/assistant-context.tsx` (erweitert: Session-Persistenz ueber Sheet open/close, aktive Session merken)
  - `components/assistant/assistant-sheet.tsx` (erweitert: Letzte aktive Session beim Oeffnen laden)
  - `components/assistant/chat-thread.tsx` (erweitert: "Verbessere meinen aktuellen Prompt" Chip laedt aktuelle Workspace-Felder)
- **Done-Signal:** Apply -> Sheet schliessen -> Sheet oeffnen -> Chat-History da, Canvas zeigt Prompt. User gibt Feedback -> Agent passt an -> Re-Apply funktioniert.
- **Dependencies:** ["slice-15"]
- **Discovery-Quelle:** Slice 7 "Iterativer Loop"

---

### Slice 20: recommend_model + get_model_info Tools (Backend)
- **Scope:** LangGraph Tools `recommend_model` und `get_model_info`. `recommend_model` matched Prompt-Intent gegen verfuegbare Modelle (Fotorealismus -> Flux, Anime -> SDXL, Text im Bild -> Ideogram). `get_model_info` holt Details zu spezifischem Modell via Replicate API. `ModelService` mit Caching (1h TTL). Post-Process-Node aktualisiert `recommended_model` State.
- **Deliverables:**
  - `backend/app/agent/tools/model_tools.py`
  - `backend/app/services/model_service.py`
  - `backend/app/agent/graph.py` (erweitert: Model-Tools registriert)
- **Done-Signal:** Agent empfiehlt Modell basierend auf Prompt-Inhalt -> SSE-Event `tool-call-result:recommend_model` mit `{id, name, reason}`. `get_model_info` liefert Modell-Details.
- **Dependencies:** ["slice-14"]
- **Discovery-Quelle:** Slice 8 "Model-Empfehlung"

---

### Slice 21: Model-Empfehlung UI
- **Scope:** Model-Recommendation Badge im Canvas-Panel (unter den Prompt-Feldern). Zeigt empfohlenes Modell mit Kurzbegruendung. "Modell verwenden" Action-Link waehlt das empfohlene Modell im Workspace aus (via `useWorkspaceVariation` -> modelId setzen). Reagiert auf `tool-call-result:recommend_model` SSE-Events.
- **Deliverables:**
  - `components/assistant/model-recommendation.tsx`
  - `components/assistant/prompt-canvas.tsx` (erweitert: Model-Recommendation Badge integriert)
- **Done-Signal:** Agent empfiehlt Modell -> Badge erscheint im Canvas mit Name + Begruendung. Klick auf "Modell verwenden" setzt modelId im Workspace.
- **Dependencies:** ["slice-20"]
- **Discovery-Quelle:** Slice 8 "Model-Empfehlung"

---

### Slice 22: LangSmith Tracing + Error Handling
- **Scope:** LangSmith-Integration aktivieren (`LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY`). Alle LLM-Calls automatisch getraced (LangGraph-native Integration). Error-Handling polieren: Error-Bubbles im Chat (rot), Retry-Button (max 3 Retries), Backend-unreachable Toast, Session-Limit Nachricht (100 Messages). Error-Message Component.
- **Deliverables:**
  - `components/assistant/error-message.tsx`
  - `backend/app/config.py` (erweitert: LangSmith env vars)
  - `backend/app/services/assistant_service.py` (erweitert: Error-Handling, Retry-Logik)
- **Done-Signal:** LangSmith Dashboard zeigt Traces fuer LLM-Calls. LLM-Fehler zeigt Error-Bubble mit Retry-Button. Nach 3 Retries: "Assistent nicht verfuegbar" Meldung. Session-Limit bei 100 Messages.
- **Dependencies:** ["slice-10"]
- **Discovery-Quelle:** Slice 1 "Python Backend Setup" (LangSmith) + alle Slices (Error Handling)

---

## Qualitaets-Checkliste

- [x] Jeder Slice hat maximal 3 produktive Deliverable-Dateien (Slice 07 ist Cleanup/Loeschung -- Ausnahme)
- [x] Jeder Slice hat ein messbares Done-Signal
- [x] Dependencies sind azyklisch (DAG)
- [x] Alle Deliverables aus der Discovery sind abgedeckt (8 Discovery-Slices -> 22 atomare Slices)
- [x] Kein Slice hat mehr als ein Concern (DB+UI = getrennt, Backend+Frontend = getrennt)
- [x] Schema/Service-Slices kommen vor UI-Slices
- [x] Stack ist korrekt erkannt und dokumentiert

---

## Empfohlene Reihenfolge

| Phase | Slices | Beschreibung |
|-------|--------|-------------|
| 1 (Parallel) | 01, 05, 06, 07 | Setup: Python-Projekt, DB Schema, Next.js Proxy, Legacy Cleanup |
| 2 (Parallel) | 02, 08 | FastAPI Server + Assistant Shell |
| 3 | 03 | LangGraph Agent |
| 4 (Parallel) | 04, 09 | SSE Endpoint + Startscreen |
| 5 | 10 | Core Chat Loop (erster E2E-Durchstich) |
| 6 (Parallel) | 11, 12, 13a, 22 | Streaming UX, Prompt Tools, Sessions Backend, Observability |
| 7 (Parallel) | 13b, 14 | Session-Liste UI, Canvas Panel |
| 8 (Parallel) | 13c, 15, 16 | Session Resume, Apply, Image Analysis Backend |
| 9 (Parallel) | 17, 19, 20 | Image Upload UI, Iterativer Loop, Model Tools |
| 10 (Parallel) | 18, 21 | Image Caching, Model-Empfehlung UI |
