# Integration Map: Prompt Assistant

**Generated:** 2026-03-12
**Slices:** 22
**Connections:** 73

---

## Dependency Graph (Visual)

```
                    +---------+          +---------+        +---------+
                    | Slice 05|          | Slice 06|        | Slice 07|
                    | DB Schm.|          | Proxy   |        | Legacy  |
                    +----+----+          +----+----+        +----+----+
                         |                    |                  |
                         |                    |                  v
+---------+         +---------+               |             +---------+
| Slice 01|-------->| Slice 02|               |             | Slice 08|
| Py Setup|         | FastAPI |               |             | Sheet   |
+---------+         +----+----+               |             +----+----+
                         |                    |                  |
                         v                    |                  v
                    +---------+               |             +---------+
                    | Slice 03|               |             | Slice 09|
                    | LangGrph|               |             | Startscr|
                    +----+----+               |             +----+----+
                         |                    |                  |
                         v                    |                  |
                    +---------+               |                  |
                    | Slice 04|               |                  |
                    | SSE Strm|               |                  |
                    +--+-+--+-+               |                  |
                       | |  |                 |                  |
          +------------+ |  +--------+        |                  |
          v              v           v        v                  v
     +---------+    +---------+  +---------+----+-----------+---------+
     | Slice 12|    |Slice 13a|  |          Slice 10                  |
     | Prompt  |    |Sess.Repo|  |        Core Chat Loop              |
     | Tools   |    +----+----+  +-+---+-----+-----+-----+-+---------+
     +--+--+---+         |        |   |     |     |     |
        |  |             v        |   |     |     |     |
        |  |        +---------+   |   |     |     |     v
        |  |        |Slice 13b|   |   |     |     |  +---------+
        |  |        |Sess.List|   |   |     |     |  | Slice 22|
        |  |        +----+----+   |   |     |     |  | Tracing |
        |  |             |        |   |     |     |  +---------+
        |  |             v        v   |     |     |
        |  |        +---------+---+   |     |     |
        |  |        |   Slice 13c |   |     |     |
        |  |        | Sess.Resume |   |     |     |
        |  |        +-------------+   |     |     |
        |  |                          |     |     |
        v  +--------+                 v     |     v
   +---------+      |            +---------+| +---------+
   | Slice 16|  +---------+     | Slice 14 || | Slice 11|
   | Img.Tool|  | Slice 20|     | Canvas   || | Strmng  |
   +----+----+  | Mdl.Tool|     +----+-----+| +---------+
        |       +----+----+          |       |
        v            |               v       |
   +---------+       |          +---------+  |
   | Slice 17|       |          | Slice 15|  |
   | Img.Up. |       |          | Apply   |  |
   +----+----+       |          +----+----+  |
        |            v               |       |
        v       +---------+          v       |
   +---------+  | Slice 21|     +---------+  |
   | Slice 18|  | Mdl.UI  |     | Slice 19|  |
   | DB Cache|  +---------+     | Iter.Loop| |
   +---------+                  +---------+  |
```

---

## Nodes

### Slice 01: Python Projekt-Setup

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | settings, pyproject.toml, Ordnerstruktur |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| (none) | -- | -- |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `app.config.settings` | Settings-Instanz | slice-02, slice-03, slice-04, slice-20, slice-22 |
| `backend/pyproject.toml` | Package-Definition | slice-02, slice-03, slice-04 |
| Ordnerstruktur `backend/app/{services,routes,agent,models}/` | Package dirs | slice-02, slice-03, slice-04 |

---

### Slice 02: FastAPI Server + Health Endpoint

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-01 |
| Outputs | app.main.app, lifespan, Router-Pattern, Laufender Server |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `app.config.settings` | slice-01 | settings.app_version |
| `backend/pyproject.toml` | slice-01 | fastapi, uvicorn installiert |
| `backend/app/routes/__init__.py` | slice-01 | Package existiert |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `app.main.app` | FastAPI Application | slice-03, slice-04, slice-13a |
| `app.main.lifespan` | Lifespan Context Manager | slice-03 |
| Health-Route Pattern | APIRouter + include_router | slice-04, slice-13a |
| Laufender Server | HTTP Port 8000 | slice-04, slice-10, slice-22 |

---

### Slice 03: LangGraph Agent Grundstruktur

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-02 |
| Outputs | create_agent, PromptAssistantState, SYSTEM_PROMPT |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `app.config.settings` | slice-01 | openrouter_api_key, assistant_model_default |
| `backend/pyproject.toml` | slice-01 | langgraph, langchain-openai |
| `app.main.lifespan` | slice-02 | Platzhalter fuer PostgresSaver |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `app.agent.graph.create_agent` | Factory-Funktion | slice-04, slice-12, slice-16, slice-20 |
| `app.agent.state.PromptAssistantState` | TypedDict | slice-04, slice-12, slice-16, slice-18, slice-20 |
| `app.agent.prompts.SYSTEM_PROMPT` | String-Konstante | slice-12, slice-16 |

---

### Slice 04: SSE Streaming Endpoint

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-03 |
| Outputs | Messages Route, AssistantService, SendMessageRequest DTO, SSE Event Protocol |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `app.config.settings` | slice-01 | openrouter_api_key, assistant_model_default |
| `backend/pyproject.toml` | slice-01 | sse-starlette |
| `app.main.app` | slice-02 | include_router |
| `app.agent.graph.create_agent` | slice-03 | CompiledGraph |
| `app.agent.state.PromptAssistantState` | slice-03 | messages Feld |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `app.routes.messages` | APIRouter | slice-10 |
| `app.services.assistant_service.AssistantService` | Service-Klasse | slice-13a, slice-13c, slice-22 |
| `app.models.dtos.SendMessageRequest` | Pydantic Model | slice-13a |
| SSE Event Protocol | Event-Format | slice-10, slice-11, slice-12, slice-14, slice-16, slice-20, slice-22 |

---

### Slice 05: DB Schema (Drizzle)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | assistantSessions, assistantImages, getSessionsByProject, getSessionById, AssistantSession Type |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `projects` Tabelle | existing codebase | FK-Referenz projects.id |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `assistantSessions` | Drizzle Table | slice-13a |
| `assistantImages` | Drizzle Table | slice-18 |
| `getSessionsByProject` | Query-Funktion | slice-13b |
| `getSessionById` | Query-Funktion | slice-13c |
| `AssistantSession` | Inferred Type | slice-13b, slice-13c |

---

### Slice 06: Next.js Proxy Rewrite + Config

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | Proxy-Route, ASSISTANT_BACKEND_URL |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| (none) | -- | -- |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Proxy-Route `/api/assistant/:path*` | Next.js Rewrite | slice-10, slice-13b |
| `ASSISTANT_BACKEND_URL` | Environment-Variable | Deployment/CI |

---

### Slice 07: Legacy Cleanup

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | Bereinigte prompt-area.tsx, Bereinigte prompts.ts |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| (none) | -- | -- |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Bereinigte `prompt-area.tsx` | Component | slice-08 |
| Bereinigte `app/actions/prompts.ts` | Server Actions | (final user-facing) |

---

### Slice 08: Assistant Sheet Shell + Trigger Button

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-07 |
| Outputs | AssistantSheet, AssistantTrigger, Sheet open/close State |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| Bereinigte `prompt-area.tsx` | slice-07 | Kein BuilderDrawer Import |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `AssistantSheet` | Component | slice-09, slice-14, slice-19 |
| `AssistantTrigger` | Component | intern in prompt-area.tsx |
| Sheet open/close State | React State | slice-09, slice-10 |

---

### Slice 09: Startscreen + Suggestion Chips

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-08 |
| Outputs | Startscreen, ChatInput, ModelSelector |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `AssistantSheet` mit children-Slot | slice-08 | Sheet rendert children |
| Sheet Header Bereich | slice-08 | Model-Selector wird integriert |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `Startscreen` | Component | slice-10 |
| `ChatInput` | Component | slice-10, slice-11 |
| `ModelSelector` | Component | slice-10 |

---

### Slice 10: Core Chat Loop

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-04, slice-06, slice-09 |
| Outputs | useAssistantRuntime, PromptAssistantContext, ChatThread |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| POST /api/assistant/sessions/{id}/messages | slice-04 | SSE Stream |
| SSE Event Protocol | slice-04 | text-delta, text-done, tool-call-result, error |
| Proxy `/api/assistant/:path*` | slice-06 | transparent Proxy |
| `ChatInput` Component | slice-09 | onSend Callback |
| `Startscreen` Component | slice-09 | onChipClick Callback |
| `ModelSelector` Component | slice-09 | value/onChange |
| `AssistantSheet` Component | slice-08 | children-Slot |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `useAssistantRuntime` | Hook | slice-11, slice-14 |
| `PromptAssistantContext` | React Context | slice-11, slice-13c, slice-14, slice-15, slice-17, slice-19, slice-22 |
| `ChatThread` | Component | slice-11, slice-14 |

---

### Slice 11: Streaming-Anzeige + Stop-Button

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-10 |
| Outputs | StreamingIndicator, ChatInput (erweitert), ChatThread (erweitert) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `PromptAssistantContext` | slice-10 | isStreaming, cancelStream, messages |
| `ChatThread` Component | slice-10 | Wird erweitert |
| `ChatInput` Component | slice-09 | Wird erweitert |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `StreamingIndicator` | Component | slice-14 |
| `ChatInput` (erweitert) | Component | slice-17 |
| `ChatThread` (erweitert) | Component | slice-14 |

---

### Slice 12: draft_prompt + refine_prompt Tools (Backend)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-10 |
| Outputs | draft_prompt Tool, refine_prompt Tool, post_process_node |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `app.agent.graph.create_agent` | slice-03 | Factory-Funktion |
| `app.agent.state.PromptAssistantState` | slice-03 | draft_prompt, collected_info |
| `app.agent.prompts.SYSTEM_PROMPT` | slice-03 | Tool-Nutzungs-Hinweise |
| SSE Event Protocol | slice-04 | tool-call-result Events |
| `AssistantService` | slice-04 | Tool-Call-Results konvertieren |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `app.agent.tools.prompt_tools.draft_prompt` | LangGraph Tool | slice-14, slice-16 |
| `app.agent.tools.prompt_tools.refine_prompt` | LangGraph Tool | slice-14, slice-19 |
| `post_process_node` | Graph Node | slice-16, slice-20 |

---

### Slice 13a: Session-Tabelle + Repository (Backend)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-04, slice-05 |
| Outputs | SessionRepository, Sessions Route, Session DTOs |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `app.main.app` | slice-02 | include_router |
| `app.models.dtos` | slice-04 | Datei erweitern |
| `assistant_sessions` Tabelle | slice-05 | Tabelle existiert |
| `app.config.settings` | slice-01 | database_url |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `SessionRepository` | Repository-Klasse | slice-13c |
| `app.routes.sessions` | APIRouter | slice-13b, slice-13c |
| `CreateSessionRequest` | Pydantic Model | slice-13c |
| `SessionResponse` | Pydantic Model | slice-13b, slice-13c |
| `SessionListResponse` | Pydantic Model | slice-13b |

---

### Slice 13b: Session-Liste UI

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-13a |
| Outputs | SessionList, useSessions |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| GET /api/assistant/sessions?project_id | slice-13a | Response-Format |
| `SessionResponse` DTO-Shape | slice-13a | JSON Felder |
| `AssistantSheet` Component | slice-08 | Rendert Content |
| `Startscreen` Component | slice-09 | "Vergangene Sessions" Link |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `SessionList` | React Component | slice-13c |
| `useSessions` | React Hook | slice-13c |

---

### Slice 13c: Session Resume + Switcher

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-13b, slice-10 |
| Outputs | SessionSwitcher, loadSession, activeView, get_session_state, Auto-Title |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `SessionRepository.get_by_id()` | slice-13a | Session-Metadata |
| `SessionRepository.set_title()` | slice-13a | Title setzen |
| GET /api/assistant/sessions/{id} | slice-13a | Wird erweitert |
| `SessionList` Component | slice-13b | onSelectSession Callback |
| `useSessions` Hook | slice-13b | Sessions-Daten |
| `PromptAssistantContext` | slice-10 | sessionId, messages, etc. |
| `useAssistantRuntime` | slice-10 | Session-Erstellung |
| `AssistantService` | slice-04 | Wird erweitert |
| LangGraph `PostgresSaver` | slice-03 | Checkpoint lesen |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `SessionSwitcher` | React Component | slice-08 (Sheet Header) |
| `PromptAssistantContext.loadSession(id)` | Context Method | slice-13b, slice-19 |
| `PromptAssistantContext.activeView` | Context State | slice-08, slice-13b |
| `AssistantService.get_session_state(id)` | Python Method | (final endpoint) |
| Auto-Title Mechanismus | Side Effect | slice-10 |

---

### Slice 14: Prompt Canvas Panel UI

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-12 |
| Outputs | PromptCanvas, hasCanvas, draftPrompt (editierbar), updateDraftField |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `PromptAssistantContext` | slice-10 | draftPrompt, isStreaming, messages |
| `ChatThread` | slice-10 | Messages im linken Panel |
| `useAssistantRuntime` | slice-10 | tool-call-result Events |
| `tool-call-result:draft_prompt` | slice-12 | SSE Event |
| `tool-call-result:refine_prompt` | slice-12 | SSE Event |
| `AssistantSheet` | slice-08 | Shell mit Header, children |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `PromptCanvas` | Component | slice-15, slice-21 |
| `hasCanvas` | Context-Feld | slice-15, slice-19, slice-21 |
| `draftPrompt` (editierbar) | Context-Feld | slice-15 |
| `updateDraftField` | Context-Funktion | slice-14 intern |

---

### Slice 15: Apply-Button + Workspace-Integration

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-14 |
| Outputs | ApplyButton, applyToWorkspace, isApplied |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `PromptCanvas` | slice-14 | Apply-Button als Child/Slot |
| `draftPrompt` | slice-14 | Canvas-Felder |
| `hasCanvas` | slice-14 | Canvas sichtbar? |
| `PromptAssistantContext` | slice-10 | State-Management |
| `useWorkspaceVariation` | existing codebase | setVariation, variationData |
| `sonner` toast | existing codebase | toast() Funktion |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ApplyButton` | Component | slice-14 (eingebettet) |
| `applyToWorkspace` | Context-Funktion | slice-19 |
| `isApplied` | Context-Feld | slice-19 |

---

### Slice 16: analyze_image Tool (Backend)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-12 |
| Outputs | analyze_image Tool, post_process_node (erweitert) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `app.agent.graph.create_agent` | slice-03 | Factory-Funktion |
| `app.agent.state.PromptAssistantState` | slice-03 | reference_images Feld |
| `post_process_node` | slice-12 | Erweitern fuer analyze_image |
| `app.agent.tools.prompt_tools` | slice-12 | Bestehende Tools |
| SSE Event Protocol | slice-04 | tool-call-result generisch |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `app.agent.tools.image_tools.analyze_image` | LangGraph Tool | slice-17, slice-18 |
| `post_process_node` (erweitert) | Graph Node | slice-18, slice-20 |

---

### Slice 17: Image Upload im Chat UI

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-16 |
| Outputs | ImageUploadButton, ImagePreview, ChatInput (erweitert) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `ChatInput` Component | slice-09 | Wird erweitert |
| `PromptAssistantContext` | slice-10 | sendMessage(content, imageUrl?) |
| `ChatThread` Component | slice-10 | Messages mit image_url rendern |
| `analyze_image` Backend Tool | slice-16 | Backend verarbeitet image_url |
| `uploadSourceImage` | existing codebase | Server Action |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ImageUploadButton` | Component | (in ChatInput integriert) |
| `ImagePreview` | Component | (in ChatInput + ChatThread) |
| `ChatInput` (erweitert) | Component | slice-10 Consumers |

---

### Slice 18: Bildanalyse DB-Caching

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-17 |
| Outputs | ImageRepository, analyze_image (erweitert) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `assistant_images` Tabelle | slice-05 | DB Table existiert |
| `analyze_image` Tool | slice-16 | Wird erweitert |
| `PromptAssistantState` | slice-03 | reference_images Feld |
| DB Connection Pool | slice-04 | psycopg3 Pool |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ImageRepository` | Service-Klasse | intern (image_tools) |
| `analyze_image` (erweitert) | LangGraph Tool | (final, no further consumers) |

---

### Slice 19: Iterativer Loop

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-15 |
| Outputs | activeSessionId Persistenz, loadSession, getWorkspaceFieldsForChip |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `isApplied` | slice-15 | boolean |
| `applyToWorkspace` | slice-15 | Funktion |
| `hasCanvas` | slice-14 | boolean |
| `draftPrompt` | slice-14 | Canvas-Felder |
| `PromptAssistantContext` | slice-10 | sessionId, messages, sendMessage, isStreaming |
| `useAssistantRuntime` | slice-10 | SSE-Verbindung |
| `useWorkspaceVariation` | existing codebase | variationData lesen |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `activeSessionId` Persistenz | Context-Logik | slice-13c |
| `loadSession(sessionId)` | Context-Funktion | slice-13c |
| `getWorkspaceFieldsForChip` | Helper-Funktion | intern |

---

### Slice 20: recommend_model + get_model_info Tools (Backend)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-14 |
| Outputs | recommend_model Tool, get_model_info Tool, ModelService, recommended_model State |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `app.agent.graph.create_agent` | slice-03 | Factory-Funktion |
| `app.agent.state.PromptAssistantState` | slice-03 | recommended_model Feld |
| `post_process_node` | slice-12 | Erweitern fuer recommend_model |
| SSE Event Protocol | slice-04 | tool-call-result generisch |
| `app.config.settings` | slice-01 | replicate_api_token |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `recommend_model` | LangGraph Tool | slice-21 |
| `get_model_info` | LangGraph Tool | slice-21 |
| `ModelService` | Service-Klasse | intern |
| `recommended_model` State-Update | post_process_node | slice-21 |

---

### Slice 21: Model-Empfehlung UI im Canvas

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-20 |
| Outputs | ModelRecommendation, recommendedModel Context |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `PromptCanvas` | slice-14 | Einbettung unterhalb Textareas |
| `hasCanvas` | slice-14 | Canvas muss sichtbar sein |
| `tool-call-result:recommend_model` | slice-20 | SSE Event |
| `PromptAssistantContext` | slice-10 | recommendedModel bereit |
| `useWorkspaceVariation` | existing codebase | setVariation (modelId) |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ModelRecommendation` | Component | slice-14 (eingebettet) |
| `recommendedModel` | Context-Feld | (final user-facing) |

---

### Slice 22: LangSmith Tracing + Error Handling

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-10 |
| Outputs | ErrorMessage, LangSmith Config, enhanced Error Handling |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `app.config.settings` | slice-01 | Basis-Settings erweitern |
| `AssistantService` | slice-04 | stream_response erweitern |
| SSE Event Protocol (error) | slice-04 | Error-Events definiert |
| `PromptAssistantContext` | slice-10 | sendMessage, messages, isStreaming |
| `useAssistantRuntime` | slice-10 | SSE-Parser error Events |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ErrorMessage` | React Component | (final user-facing) |
| LangSmith Tracing | Backend Config | (final infrastructure) |

---

## Connections

| # | From | To | Resource | Type | Status |
|---|------|-----|----------|------|--------|
| 1 | Slice 01 | Slice 02 | `app.config.settings` | Settings | VALID |
| 2 | Slice 01 | Slice 02 | `backend/pyproject.toml` | Package | VALID |
| 3 | Slice 01 | Slice 02 | `backend/app/routes/__init__.py` | Dir | VALID |
| 4 | Slice 01 | Slice 03 | `app.config.settings` | Settings | VALID |
| 5 | Slice 01 | Slice 03 | `backend/pyproject.toml` | Package | VALID |
| 6 | Slice 01 | Slice 04 | `app.config.settings` | Settings | VALID |
| 7 | Slice 01 | Slice 04 | `backend/pyproject.toml` | Package | VALID |
| 8 | Slice 01 | Slice 13a | `app.config.settings` | Settings | VALID |
| 9 | Slice 01 | Slice 20 | `app.config.settings` | Settings | VALID |
| 10 | Slice 01 | Slice 22 | `app.config.settings` | Settings | VALID |
| 11 | Slice 02 | Slice 03 | `app.main.lifespan` | Lifespan | VALID |
| 12 | Slice 02 | Slice 04 | `app.main.app` | FastAPI App | VALID |
| 13 | Slice 02 | Slice 13a | `app.main.app` | FastAPI App | VALID |
| 14 | Slice 03 | Slice 04 | `create_agent` | Factory | VALID |
| 15 | Slice 03 | Slice 04 | `PromptAssistantState` | TypedDict | VALID |
| 16 | Slice 03 | Slice 12 | `create_agent` | Factory | VALID |
| 17 | Slice 03 | Slice 12 | `PromptAssistantState` | TypedDict | VALID |
| 18 | Slice 03 | Slice 12 | `SYSTEM_PROMPT` | String | VALID |
| 19 | Slice 03 | Slice 16 | `create_agent` | Factory | VALID |
| 20 | Slice 03 | Slice 16 | `PromptAssistantState` | TypedDict | VALID |
| 21 | Slice 03 | Slice 18 | `PromptAssistantState` | TypedDict | VALID |
| 22 | Slice 03 | Slice 20 | `create_agent` | Factory | VALID |
| 23 | Slice 03 | Slice 20 | `PromptAssistantState` | TypedDict | VALID |
| 24 | Slice 03 | Slice 13c | PostgresSaver | Checkpointer | VALID |
| 25 | Slice 04 | Slice 10 | POST messages SSE | Endpoint | VALID |
| 26 | Slice 04 | Slice 10 | SSE Event Protocol | Events | VALID |
| 27 | Slice 04 | Slice 12 | SSE Event Protocol | Events | VALID |
| 28 | Slice 04 | Slice 12 | `AssistantService` | Service | VALID |
| 29 | Slice 04 | Slice 13a | `app.models.dtos` | DTOs | VALID |
| 30 | Slice 04 | Slice 13c | `AssistantService` | Service | VALID |
| 31 | Slice 04 | Slice 16 | SSE Event Protocol | Events | VALID |
| 32 | Slice 04 | Slice 18 | DB Connection Pool | psycopg3 | VALID |
| 33 | Slice 04 | Slice 20 | SSE Event Protocol | Events | VALID |
| 34 | Slice 04 | Slice 22 | `AssistantService` | Service | VALID |
| 35 | Slice 04 | Slice 22 | SSE error Event | Events | VALID |
| 36 | Slice 05 | Slice 13a | `assistant_sessions` | DB Table | VALID |
| 37 | Slice 05 | Slice 18 | `assistant_images` | DB Table | VALID |
| 38 | Slice 06 | Slice 10 | Proxy-Route | Rewrite | VALID |
| 39 | Slice 06 | Slice 13b | Proxy-Route | Rewrite | VALID |
| 40 | Slice 07 | Slice 08 | prompt-area.tsx | Component | VALID |
| 41 | Slice 08 | Slice 09 | `AssistantSheet` | Component | VALID |
| 42 | Slice 08 | Slice 10 | Sheet State | React State | VALID |
| 43 | Slice 08 | Slice 14 | `AssistantSheet` | Component | VALID |
| 44 | Slice 09 | Slice 10 | `ChatInput` | Component | VALID |
| 45 | Slice 09 | Slice 10 | `Startscreen` | Component | VALID |
| 46 | Slice 09 | Slice 10 | `ModelSelector` | Component | VALID |
| 47 | Slice 09 | Slice 11 | `ChatInput` | Component | VALID |
| 48 | Slice 10 | Slice 11 | `PromptAssistantContext` | Context | VALID |
| 49 | Slice 10 | Slice 11 | `ChatThread` | Component | VALID |
| 50 | Slice 10 | Slice 13c | `PromptAssistantContext` | Context | VALID |
| 51 | Slice 10 | Slice 13c | `useAssistantRuntime` | Hook | VALID |
| 52 | Slice 10 | Slice 14 | `PromptAssistantContext` | Context | VALID |
| 53 | Slice 10 | Slice 14 | `ChatThread` | Component | VALID |
| 54 | Slice 10 | Slice 14 | `useAssistantRuntime` | Hook | VALID |
| 55 | Slice 10 | Slice 15 | `PromptAssistantContext` | Context | VALID |
| 56 | Slice 10 | Slice 17 | `PromptAssistantContext` | Context | VALID |
| 57 | Slice 10 | Slice 19 | `PromptAssistantContext` | Context | VALID |
| 58 | Slice 10 | Slice 22 | `PromptAssistantContext` | Context | VALID |
| 59 | Slice 10 | Slice 22 | `useAssistantRuntime` | Hook | VALID |
| 60 | Slice 12 | Slice 14 | draft_prompt event | SSE Event | VALID |
| 61 | Slice 12 | Slice 14 | refine_prompt event | SSE Event | VALID |
| 62 | Slice 12 | Slice 16 | `post_process_node` | Graph Node | VALID |
| 63 | Slice 12 | Slice 20 | `post_process_node` | Graph Node | VALID |
| 64 | Slice 13a | Slice 13b | GET sessions + DTOs | REST | VALID |
| 65 | Slice 13a | Slice 13c | SessionRepository + Routes | Python | VALID |
| 66 | Slice 13b | Slice 13c | SessionList + useSessions | React | VALID |
| 67 | Slice 14 | Slice 15 | Canvas + Context | Component | VALID |
| 68 | Slice 14 | Slice 21 | Canvas + hasCanvas | Component | VALID |
| 69 | Slice 15 | Slice 19 | isApplied + apply fn | Context | VALID |
| 70 | Slice 16 | Slice 17 | analyze_image tool | Backend | VALID |
| 71 | Slice 16 | Slice 18 | analyze_image + node | Tool + Node | VALID |
| 72 | Slice 17 | Slice 18 | Image Upload flow | UI->Backend | VALID |
| 73 | Slice 20 | Slice 21 | recommend_model event | SSE Event | VALID |

---

## Validation Results

### VALID Connections: 73

All declared dependencies have matching outputs.

### Orphaned Outputs: 0

All outputs have at least one consumer or are final user-facing outputs.

### Missing Inputs: 0

All declared inputs have matching outputs from producer slices.

### Deliverable-Consumer Gaps: 0

All components with "Provides To" connections have corresponding deliverables that either create or modify the consumer files:

- `prompt-area.tsx`: Modified in Slice 07 (cleanup), modified in Slice 08 (trigger button) -- both as deliverables
- `assistant-context.tsx`: Created in Slice 10, extended in Slices 13c, 14, 15, 19, 21 -- all as deliverables
- `assistant-sheet.tsx`: Created in Slice 08, extended in Slices 14, 19 -- all as deliverables
- `chat-thread.tsx`: Created in Slice 10, extended in Slices 11, 19 -- all as deliverables
- `chat-input.tsx`: Created in Slice 09, extended in Slices 11, 17 -- all as deliverables
- `graph.py`: Created in Slice 03, extended in Slices 12, 16, 20 -- all as deliverables
- `assistant_service.py`: Created in Slice 04, extended in Slices 13c, 22 -- all as deliverables
- `config.py`: Created in Slice 01, extended in Slice 22 -- both as deliverables
- `dtos.py`: Created in Slice 04, extended in Slice 13a -- both as deliverables
- `prompt-canvas.tsx`: Created in Slice 14, extended in Slices 15, 21 -- all as deliverables

### Runtime Path Gaps: 0

All user flows have complete call chains:

| User-Flow | Chain | Status |
|-----------|-------|--------|
| Send message | ChatInput(09) -> Context.sendMessage(10) -> fetch(10) -> Proxy(06) -> FastAPI(04) -> LangGraph(03) -> SSE -> ChatThread(10) | COMPLETE |
| Draft prompt | Agent -> draft_prompt(12) -> post_process(12) -> SSE -> Context(10/14) -> Canvas(14) | COMPLETE |
| Apply to workspace | ApplyButton(15) -> applyToWorkspace(15) -> setVariation(existing) -> Workspace fields | COMPLETE |
| Image analysis | ImageUpload(17) -> uploadSourceImage(existing) -> R2 URL -> sendMessage(10) -> Backend(04) -> analyze_image(16) -> SSE -> ChatThread(10) | COMPLETE |
| Session resume | SessionList(13b) -> loadSession(13c) -> GET session(13a/13c) -> PostgresSaver(03) -> Context(13c) -> ChatThread+Canvas(10/14) | COMPLETE |
| Iterative loop | Apply(15) -> close -> reopen -> activeSessionId(19) -> loadSession(19) -> refine_prompt(12) -> Canvas(14) -> Re-apply(15) | COMPLETE |
| Model recommendation | Agent -> recommend_model(20) -> ModelService(20) -> SSE -> Context(10/21) -> Badge(21) -> setVariation(existing) | COMPLETE |

---

## Discovery Traceability

### UI Components Coverage

| Discovery Element | Type | Location | Covered In | Status |
|-------------------|------|----------|------------|--------|
| `assistant-trigger-btn` | Button (Sparkles) | PromptArea | Slice 08 | COVERED |
| `assistant-sheet` | Sheet | Right side | Slice 08 | COVERED |
| `chat-thread` | ScrollArea | Sheet left | Slice 10 | COVERED |
| `chat-input` | Textarea + Buttons | Sheet Footer | Slice 09, 11, 17 | COVERED |
| `send-btn` | Button (ArrowUp) | Chat-Input | Slice 09 | COVERED |
| `stop-btn` | Button (Square) | Chat-Input | Slice 11 | COVERED |
| `image-upload-btn` | Button (Image) | Chat-Input | Slice 09/17 | COVERED |
| `suggestion-chip` | Badge/Button | Startscreen | Slice 09 | COVERED |
| `prompt-canvas` | Card | Sheet right | Slice 14 | COVERED |
| `canvas-motiv` | Textarea | Canvas | Slice 14 | COVERED |
| `canvas-style` | Textarea | Canvas | Slice 14 | COVERED |
| `canvas-negative` | Textarea | Canvas | Slice 14 | COVERED |
| `model-recommendation` | Badge + Action | Canvas | Slice 21 | COVERED |
| `apply-btn` | Button (primary) | Canvas | Slice 15 | COVERED |
| `session-switcher` | Button | Header | Slice 13c | COVERED |
| `model-selector` | Select/Dropdown | Header | Slice 09 | COVERED |
| `session-list` | List | Sheet | Slice 13b | COVERED |
| `user-message` | Chat Bubble | Thread | Slice 10 | COVERED |
| `assistant-message` | Chat Bubble | Thread | Slice 10 | COVERED |
| `image-preview` | Thumbnail | User-Message | Slice 17 | COVERED |
| `streaming-indicator` | Dots/Pulse | Thread | Slice 11 | COVERED |
| `error-message` | Chat Bubble (red) | Thread | Slice 22 | COVERED |
| `retry-btn` | Button | Error-Message | Slice 22 | COVERED |

### State Machine Coverage

| State | Required UI | Available Actions | Covered In | Status |
|-------|-------------|-------------------|------------|--------|
| `sheet-closed` | Trigger-Button only | Trigger click | Slice 08 | COVERED |
| `start` | Empty chat, chips, history link | Chip, type, history | Slice 09 | COVERED |
| `chatting` | Chat-Thread, no Canvas | Send, upload | Slice 10 | COVERED |
| `drafting` | Chat + Canvas Split-View | Send, edit, upload | Slice 14 | COVERED |
| `streaming` | Agent streaming | Type, stop | Slice 11 | COVERED |
| `canvas-editing` | User edits Canvas | Edit, apply, send | Slice 14 | COVERED |
| `applying` | Prompt transferred | Wait | Slice 15 | COVERED |
| `applied` | Confirmation | Close, chat, new | Slice 15, 19 | COVERED |
| `session-list` | Session list | Select, new, back | Slice 13b | COVERED |
| `loading-session` | Spinner | Wait | Slice 13c | COVERED |
| `error` | Error message | Retry, new msg | Slice 22 | COVERED |

### Transitions Coverage

| From | Trigger | To | Covered In | Status |
|------|---------|-----|------------|--------|
| sheet-closed | trigger-btn | start/chatting | Slice 08 | COVERED |
| start | chip click | streaming | Slice 09, 10 | COVERED |
| start | user types + send | streaming | Slice 10 | COVERED |
| start | "Vergangene Sessions" | session-list | Slice 13b | COVERED |
| chatting | send message | streaming | Slice 10 | COVERED |
| chatting | upload image | streaming | Slice 17 | COVERED |
| streaming | draft_prompt tool | drafting | Slice 14 | COVERED |
| streaming | text only | chatting | Slice 10 | COVERED |
| streaming | stop-btn | chatting/drafting | Slice 11 | COVERED |
| streaming | stream-error | error | Slice 22 | COVERED |
| drafting | send message | streaming | Slice 10, 14 | COVERED |
| drafting | edit canvas | canvas-editing | Slice 14 | COVERED |
| drafting | apply-btn | applied | Slice 15 | COVERED |
| canvas-editing | apply-btn | applied | Slice 15 | COVERED |
| canvas-editing | send message | streaming | Slice 14 | COVERED |
| applied | send message | streaming | Slice 19 | COVERED |
| applied | close sheet | sheet-closed | Slice 19 | COVERED |
| session-list | select session | loading-session | Slice 13b, 13c | COVERED |
| loading-session | loaded | chatting/drafting | Slice 13c | COVERED |
| loading-session | failed | start | Slice 13c | COVERED |
| error | retry-btn | streaming | Slice 22 | COVERED |
| any | close/escape | sheet-closed | Slice 08 | COVERED |
| any | switcher -> new | start | Slice 13c | COVERED |

### Business Rules Coverage

| Rule | Covered In | Status |
|------|------------|--------|
| Session-Persistenz (PostgresSaver, thread_id) | Slice 03, 13a, 13c | COVERED |
| Session-Zuordnung (project_id, kein Auth) | Slice 05, 13a | COVERED |
| Prompt-Sprache (DE Chat, EN Prompts) | Slice 03 | COVERED |
| Must-Haves (Motiv bevor Draft) | Slice 03, 12 | COVERED |
| Bildanalyse-Caching | Slice 18 | COVERED |
| Negative Prompts (Auto + erklaeren) | Slice 03, 12 | COVERED |
| Apply-Verhalten (3 Felder, Undo-Toast) | Slice 15 | COVERED |
| Model-Empfehlung (Badge, kein Auto-Switch) | Slice 21 | COVERED |
| LLM-Auswahl (3 Modelle, Dropdown) | Slice 09 | COVERED |
| Rate Limiting (30 msg/min) | Slice 04 | COVERED |
| Bild-Upload (1/Msg, JPEG/PNG/WebP, 10MB) | Slice 16, 17 | COVERED |
| Session-Limit (100 msgs) | Slice 04, 22 | COVERED |
| Retry-Logik (max 3) | Slice 22 | COVERED |
| Keyboard Enter/Shift+Enter | Slice 09 | COVERED |
| Keyboard Escape close | Slice 08 | COVERED |
| Tab navigation Split-View | Slice 14 | COVERED |
| Focus management | Slice 09, 15 | COVERED |

### Data Fields Coverage

| Field | Required | Covered In | Status |
|-------|----------|------------|--------|
| assistant_sessions.id | Yes | Slice 05 | COVERED |
| assistant_sessions.project_id | Yes | Slice 05 | COVERED |
| assistant_sessions.title | No | Slice 05, 13c | COVERED |
| assistant_sessions.status | Yes | Slice 05, 13a | COVERED |
| assistant_sessions.last_message_at | Yes | Slice 05, 13a | COVERED |
| assistant_sessions.message_count | Yes | Slice 05, 13a | COVERED |
| assistant_sessions.has_draft | Yes | Slice 05 | COVERED |
| assistant_sessions.created_at | Yes | Slice 05 | COVERED |
| assistant_sessions.updated_at | Yes | Slice 05 | COVERED |
| assistant_images.id | Yes | Slice 05 | COVERED |
| assistant_images.session_id | Yes | Slice 05 | COVERED |
| assistant_images.image_url | Yes | Slice 05 | COVERED |
| assistant_images.analysis_result | No | Slice 05, 18 | COVERED |
| assistant_images.created_at | Yes | Slice 05 | COVERED |
| LangGraph: messages | Yes | Slice 03 | COVERED |
| LangGraph: draft_prompt | Yes | Slice 03, 12 | COVERED |
| LangGraph: reference_images | Yes | Slice 03, 16 | COVERED |
| LangGraph: recommended_model | Yes | Slice 03, 20 | COVERED |
| LangGraph: collected_info | Yes | Slice 03 | COVERED |
| LangGraph: phase | Yes | Slice 03 | COVERED |

**Discovery Coverage:** 100/100 (100%)

---

## Summary

| Metric | Value |
|--------|-------|
| Total Slices | 22 |
| Total Connections | 73 |
| Valid Connections | 73 |
| Orphaned Outputs | 0 |
| Missing Inputs | 0 |
| Deliverable-Consumer Gaps | 0 |
| Runtime Path Gaps | 0 |
| Discovery Coverage | 100% |

**VERDICT: READY FOR ORCHESTRATION**
