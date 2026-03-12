# Feature: Prompt Assistant

**Epic:** –
**Status:** Draft
**Discovery:** `discovery.md` (same folder)
**Derived from:** Discovery constraints, NFRs, and risks

---

## Problem & Solution

**Problem:**
- Current "Template" function (5 hardcoded presets) is useless — no real help writing prompts
- "Prompt Builder" (Fragment-Drawer) equally unhelpful — too mechanical, no intelligence
- Beginners don't know how to write good prompts for image generation
- No guided process: user faces empty fields (Motiv, Style, Negative) without orientation

**Solution:**
- Agent-driven chat assistant that guides to the perfect prompt through targeted questions
- Canvas/Artifacts pattern: structured prompt built alongside chat, editable
- Image analysis: user uploads reference image, agent extracts style, composition, mood
- Active model recommendation based on prompt intent

**Business Value:**
- Drastically lowers entry barrier for beginners
- Higher prompt quality = better generation results = higher user satisfaction
- Differentiation vs tools that only offer empty text fields

---

## Scope & Boundaries

| In Scope |
|----------|
| Chat-based prompt assistant as Sheet/Drawer |
| Free chat sessions (create, resume, history) |
| Canvas/Artifacts pattern for editable prompt |
| Image analysis of reference images |
| Active model recommendation |
| Apply button (prompt → workspace fields) |
| Iterative loop (after generation back to assistant) |
| Separate Python backend (FastAPI + LangGraph) |
| OpenRouter LLM integration (Sonnet 4.6, GPT-5.4, Gemini 3.1 Pro) |
| LangSmith tracing |
| German chat language, English prompt output |

| Out of Scope |
|--------------|
| Prompt sharing between users |
| Team features / Collaboration |
| Prompt marketplace |
| Custom model training |
| Voice input |
| Automatic generation (agent triggers generation itself) |

---

## API Design

### Overview

| Aspect | Specification |
|--------|---------------|
| Style | REST + SSE (Server-Sent Events) |
| Authentication | None (project-based, no user accounts) |
| Base Path | `/api/assistant` (proxied from Next.js to FastAPI via rewrites) |
| Rate Limiting | 30 messages/minute/session |
| Content Type | JSON (requests), text/event-stream (SSE responses) |

### Endpoints

| Method | Path | Request | Response | Auth | Business Logic |
|--------|------|---------|----------|------|----------------|
| POST | `/api/assistant/sessions` | `CreateSessionRequest` | SSE stream: metadata event + greeting | None | Create session in DB, generate thread_id, initialize LangGraph, stream welcome message |
| POST | `/api/assistant/sessions/{id}/messages` | `SendMessageRequest` | SSE stream: text-delta, tool-call-result, text-done, error | None | Validate session active + message limit, forward to LangGraph agent, stream response |
| GET | `/api/assistant/sessions` | `?project_id=<uuid>` | `SessionListResponse` | None | List sessions for project, sorted newest first |
| GET | `/api/assistant/sessions/{id}` | – | `SessionDetailResponse` | None | Get session metadata + full state from LangGraph checkpointer (messages, draft, recommendation) |
| PATCH | `/api/assistant/sessions/{id}` | `UpdateSessionRequest` | `SessionResponse` | None | Archive session (set status="archived") |
| GET | `/api/assistant/health` | – | `{ status: "ok", version: "1.0.0" }` | None | Health check |

### Data Transfer Objects (DTOs)

| DTO | Fields | Validation | Notes |
|-----|--------|------------|-------|
| `CreateSessionRequest` | `project_id: uuid` | UUID format, required | Links session to AI Factory project |
| `SendMessageRequest` | `content: string`, `image_url?: string`, `model?: string` | content: 1–5000 chars, image_url: valid URL if present, model: one of 3 allowed slugs | image_url is R2 URL from existing upload. model defaults to last-used or `anthropic/claude-sonnet-4.6` |
| `CreateSessionResponse` (SSE metadata) | `session_id: uuid`, `thread_id: uuid` | – | First SSE event, before greeting stream |
| `SessionListResponse` | `sessions: SessionSummary[]` | – | Sorted by last_message_at DESC |
| `SessionSummary` | `id, title, status, message_count, has_draft, last_message_at, created_at` | – | For session list display |
| `SessionDetailResponse` | `session: SessionSummary`, `state: SessionState` | – | Full state from checkpointer |
| `SessionState` | `messages: Message[]`, `draft_prompt: DraftPrompt?`, `recommended_model: ModelRec?` | – | Reconstructed from LangGraph state |
| `Message` | `role: "human"\|"assistant"`, `content: string`, `tool_calls?: ToolCall[]` | – | Converted from LangChain BaseMessage |
| `DraftPrompt` | `motiv: string`, `style: string`, `negative_prompt: string` | – | Current prompt draft |
| `ModelRec` | `id: string`, `name: string`, `reason: string` | – | Model recommendation |
| `UpdateSessionRequest` | `status: "archived"` | Enum validation | Only archiving supported |

### SSE Event Types

| Event Type | Payload | When Emitted |
|------------|---------|--------------|
| `metadata` | `{ session_id, thread_id }` | First event after session create |
| `text-delta` | `{ content: string }` | Each token of agent text response |
| `tool-call-result` | `{ tool: string, data: object }` | After agent tool execution completes |
| `text-done` | `{}` | Agent response complete |
| `error` | `{ message: string }` | On error |

**Tool-call-result payloads:**

| Tool | Data Shape |
|------|------------|
| `draft_prompt` | `{ motiv: string, style: string, negative_prompt: string }` |
| `refine_prompt` | `{ motiv: string, style: string, negative_prompt: string }` |
| `analyze_image` | `{ subject: string, style: string, mood: string, lighting: string, composition: string, palette: string }` |
| `recommend_model` | `{ id: string, name: string, reason: string }` |

---

## Database Schema

### Entities

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `assistant_sessions` | Session metadata and index | id (= LangGraph thread_id), project_id, title, status |
| `assistant_images` | Uploaded reference images with cached analysis | id, session_id, image_url, analysis_result |
| LangGraph checkpoint tables | Full conversation state persistence | Managed by `langgraph-checkpoint-postgres` |

### Schema Details

**Table: `assistant_sessions`**

| Column | Type | Constraints | Index |
|--------|------|-------------|-------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Yes (PK) |
| `project_id` | UUID | NOT NULL, FK → projects.id | Yes |
| `title` | VARCHAR(255) | NULL | No |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK IN ('active', 'archived') | No |
| `last_message_at` | TIMESTAMP WITH TZ | NOT NULL, DEFAULT NOW() | Yes |
| `message_count` | INTEGER | NOT NULL, DEFAULT 0 | No |
| `has_draft` | BOOLEAN | NOT NULL, DEFAULT FALSE | No |
| `created_at` | TIMESTAMP WITH TZ | NOT NULL, DEFAULT NOW() | No |
| `updated_at` | TIMESTAMP WITH TZ | NOT NULL, DEFAULT NOW() | No |

**Table: `assistant_images`**

| Column | Type | Constraints | Index |
|--------|------|-------------|-------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Yes (PK) |
| `session_id` | UUID | NOT NULL, FK → assistant_sessions.id | Yes |
| `image_url` | TEXT | NOT NULL | No |
| `analysis_result` | JSONB | NULL | No |
| `created_at` | TIMESTAMP WITH TZ | NOT NULL, DEFAULT NOW() | No |

**LangGraph Checkpoint Tables** (managed by `PostgresSaver.setup()`):

| Table | Purpose | Managed By |
|-------|---------|------------|
| `checkpoints` | Full graph state snapshots | langgraph-checkpoint-postgres |
| `checkpoint_writes` | Incremental state updates | langgraph-checkpoint-postgres |
| `checkpoint_migrations` | Schema versioning | langgraph-checkpoint-postgres |

### Relationships

| From | To | Relationship | Cascade |
|------|-----|--------------|---------|
| `assistant_sessions.project_id` | `projects.id` | N:1 | ON DELETE CASCADE |
| `assistant_images.session_id` | `assistant_sessions.id` | N:1 | ON DELETE CASCADE |
| `assistant_sessions.id` | LangGraph checkpoints (thread_id) | 1:1 | Manual cleanup |

---

## Server Logic

### Services & Processing

**Python Backend Services:**

| Service | Responsibility | Input | Output | Side Effects |
|---------|----------------|-------|--------|--------------|
| `AssistantService` | Session lifecycle, message routing | session/message requests | SSE event streams | DB writes (sessions), LangGraph invocations |
| `SessionRepository` | Session CRUD | session data | session records | DB reads/writes |
| `ModelService` | Fetch available models for recommendation | model query intent | model list with metadata | Replicate API calls (cached) |

**LangGraph Agent (Python):**

| Component | Responsibility | Input | Output | Side Effects |
|-----------|----------------|-------|--------|--------------|
| `PromptAssistantGraph` | ReAct agent orchestration | HumanMessage (+ optional image URL) | AIMessage stream with tool calls | State updates via checkpointer |
| `analyze_image` tool | Vision-model image analysis | image URL | Structured analysis JSON | Uses selected chat model (all 3 support vision). Image downscaled to 1024px max before API call |
| `draft_prompt` tool | Create structured prompt from collected info | collected_info dict | DraftPrompt (motiv, style, negative) | Updates graph state |
| `refine_prompt` tool | Modify existing prompt based on feedback | current draft + feedback | Updated DraftPrompt | Updates graph state |
| `recommend_model` tool | Match prompt intent to best model | prompt content + intent | ModelRecommendation (id, name, reason) | Replicate API call (via ModelService) |
| `get_model_info` tool | Fetch specific model details | model owner/name | Model metadata | Replicate API call |

**Next.js Frontend Services:**

| Service | Responsibility | Input | Output | Side Effects |
|---------|----------------|-------|--------|--------------|
| `useAssistantRuntime` hook | Chat runtime with SSE adapter | API URL, project context | @assistant-ui runtime | SSE connections |
| `PromptAssistantContext` | Canvas/session state management | Tool-call events, user edits | Canvas state, session state | None |
| `uploadSourceImage` action | Image upload to R2 (existing) | File | R2 public URL | R2 write |

### Business Logic Flow

```
User Message
    │
    ▼
[ChatModelAdapter] ─── POST /api/assistant/sessions/{id}/messages ──►
    │                                                                  │
    │                                                            [FastAPI Route]
    │                                                                  │
    │                                                            [AssistantService]
    │                                                                  │
    │                                                         [LangGraph.astream()]
    │                                                           │              │
    │                                                     [Agent Node]   [Tools Node]
    │                                                           │              │
    │                                                      LLM Call     analyze_image
    │                                                     (OpenRouter)   draft_prompt
    │                                                           │        refine_prompt
    │                                                           │        recommend_model
    │                                                           │              │
    ◄─────────────── SSE Stream (text-delta, tool-call-result) ◄──────────────┘
    │
    ▼
[Parse SSE Events]
    │
    ├── text-delta ──► @assistant-ui chat bubble (streaming)
    ├── tool-call-result:draft_prompt ──► PromptAssistantContext ──► Canvas panel
    ├── tool-call-result:refine_prompt ──► PromptAssistantContext ──► Canvas update
    ├── tool-call-result:analyze_image ──► Chat display (analysis)
    ├── tool-call-result:recommend_model ──► PromptAssistantContext ──► Model badge
    └── text-done ──► Stream complete
```

### LangGraph Graph Structure

```
START
  │
  ▼
[assistant_node] ◄──────────────────┐
  │                                  │
  ├── has tool calls? ──Yes──► [tools_node]
  │                                  │
  │                           [post_process_node]
  │                                  │
  └── no tool calls? ──────► END    └─── updates state fields
                                         (draft_prompt, recommended_model, etc.)
```

- Uses `create_react_agent` pattern from `langgraph.prebuilt`
- Custom state class extending default with additional fields
- `PostgresSaver` as checkpointer for session persistence
- Thread config: `{ "configurable": { "thread_id": session_id } }`

### LangGraph State

```
PromptAssistantState:
  messages: list[BaseMessage]          # Full conversation (managed by add_messages reducer)
  draft_prompt: dict | None            # {motiv, style, negative_prompt}
  reference_images: list[dict]         # [{url, analysis}]
  recommended_model: dict | None       # {id, name, reason}
  collected_info: dict                 # {subject, style, purpose, mood, ...}
  phase: str                           # understand | explore | draft | refine
```

### Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `content` (message) | 1–5000 characters | "Nachricht muss zwischen 1 und 5000 Zeichen lang sein" |
| `image_url` | Valid URL, must be R2 domain | "Ungültige Bild-URL" |
| `project_id` | Valid UUID, must exist in projects table | "Projekt nicht gefunden" |
| `session_id` | Valid UUID, must exist and be active | "Session nicht gefunden oder archiviert" |
| `message_count` | Max 100 per session | "Session-Limit erreicht. Bitte starte eine neue Session." |
| Messages per minute | Max 30 per session | "Zu viele Nachrichten. Bitte warte einen Moment." |
| `image` (for Vision) | Max 1024px longest edge, downscaled server-side via Pillow before Vision API call | – (transparent to user) |
| `model` | Must be one of: `anthropic/claude-sonnet-4.6`, `openai/gpt-5.4`, `google/gemini-3.1-pro-preview` | "Ungültiges Modell" |

---

## Security

### Authentication & Authorization

| Area | Mechanism | Notes |
|------|-----------|-------|
| API Auth | None | No user accounts in AI Factory. Sessions tied to project_id |
| Resource Access | Project-based | All sessions for a project are visible to anyone with project access |
| Internal API (Next.js → FastAPI) | Same-origin (proxy) | No CORS needed, requests proxied via Next.js rewrites |

### Data Protection

| Data Type | Protection | Notes |
|-----------|------------|-------|
| Chat messages | PostgreSQL (LangGraph checkpointer) | No encryption at rest beyond DB-level |
| Reference images | R2 storage with public URLs | Same pattern as existing generation images |
| API keys (OpenRouter, Replicate) | Environment variables | Server-side only, never exposed to client |

### Input Validation & Sanitization

| Input | Validation | Sanitization |
|-------|------------|--------------|
| Chat message content | Length check (1–5000 chars) | Strip control characters, no HTML rendering |
| Image URL | URL format, R2 domain whitelist | URL validation only (no path traversal possible via R2) |
| Project ID / Session ID | UUID format validation | Parameterized queries (Drizzle / SQLAlchemy) |

### Rate Limiting & Abuse Prevention

| Resource | Limit | Window | Penalty |
|----------|-------|--------|---------|
| Messages per session | 30 | 1 minute | 429 Too Many Requests |
| Messages per session (total) | 100 | Lifetime | Session locked, user prompted to start new session |
| Image uploads per session | 10 | Lifetime | Rejection with message |
| SSE connections per project | 5 | Concurrent | 429 Too Many Requests |

---

## Architecture Layers

### Layer Responsibilities

| Layer | Responsibility | Pattern |
|-------|----------------|---------|
| **Next.js Frontend** | UI rendering, user interaction, workspace integration | React components + Context |
| **Next.js Rewrites** | Proxy `/api/assistant/*` to FastAPI backend | Reverse proxy pattern |
| **Next.js Server Actions** | Image upload to R2 (existing pattern) | Server action pattern |
| **FastAPI Routes** | HTTP handling, request validation, SSE streaming | Controller pattern |
| **AssistantService** | Session management, LangGraph orchestration | Service pattern |
| **LangGraph Agent** | Conversational AI logic, tool execution | ReAct agent pattern |
| **PostgresSaver** | Conversation state persistence | Checkpoint pattern |
| **SessionRepository** | Session metadata CRUD | Repository pattern |
| **ModelService** | Model data fetching and caching | Service + cache pattern |
| **OpenRouter (via LangChain)** | LLM API calls | Client adapter pattern |

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Browser                                                         │
│                                                                 │
│  ┌──────────────┐    ┌─────────────┐    ┌──────────────────┐   │
│  │ AssistantSheet│◄──►│ ChatThread   │    │ PromptCanvas     │   │
│  │              │    │             │    │ (Split-View)      │   │
│  └──────┬───────┘    └──────┬──────┘    └────────┬─────────┘   │
│         │                   │                     │             │
│         └───────────┬───────┘                     │             │
│                     │                             │             │
│              ┌──────▼──────┐              ┌───────▼────────┐   │
│              │ useAssistant │              │ PromptAssistant │   │
│              │ Runtime     │──────────────►│ Context         │   │
│              └──────┬──────┘  tool-call   └────────────────┘   │
│                     │         events                            │
│                     │ SSE                                       │
└─────────────────────┼───────────────────────────────────────────┘
                      │ /api/assistant/*
          ┌───────────▼────────────┐
          │ Next.js Rewrites Proxy │
          └───────────┬────────────┘
                      │ http://localhost:8000
┌─────────────────────┼───────────────────────────────────────────┐
│ Python Backend      │                                           │
│              ┌──────▼──────┐                                    │
│              │ FastAPI      │                                    │
│              │ Routes       │                                    │
│              └──────┬──────┘                                    │
│                     │                                           │
│              ┌──────▼──────┐                                    │
│              │ Assistant    │                                    │
│              │ Service      │                                    │
│              └──┬───────┬──┘                                    │
│                 │       │                                       │
│         ┌───────▼───┐ ┌─▼────────────┐                         │
│         │ Session    │ │ LangGraph    │                         │
│         │ Repository │ │ Agent        │                         │
│         └─────┬─────┘ └──┬───────┬───┘                         │
│               │          │       │                              │
│         ┌─────▼─────┐   │  ┌────▼────────┐                     │
│         │ PostgreSQL │   │  │ Tools       │                     │
│         │ (sessions) │   │  │ (5 tools)   │                     │
│         └───────────┘   │  └──┬──────┬───┘                     │
│                         │     │      │                          │
│                  ┌──────▼──┐  │  ┌───▼──────────┐              │
│                  │ Postgres │  │  │ OpenRouter    │              │
│                  │ Saver    │  │  │ (Chat+Vision) │              │
│                  └─────────┘  │  └──────────────┘              │
│                               │                                │
│                          ┌────▼──────────┐                     │
│                          │ ModelService   │                     │
│                          │ (Replicate)    │                     │
│                          └───────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

### Error Handling Strategy

| Error Type | Handling | User Response | Logging |
|------------|----------|---------------|---------|
| Validation (bad input) | 400/422 with details | Error shown in chat input | Debug log |
| Session not found | 404 | Toast: "Session nicht gefunden" | Info log |
| Rate limit exceeded | 429 | Toast: "Zu viele Nachrichten" | Warning log |
| LLM API error (OpenRouter) | SSE error event | Error bubble in chat with retry button | Error log + LangSmith trace |
| LLM timeout | SSE error event after 60s | Error bubble with retry button | Error log |
| Vision API error | SSE error event | Chat message: "Bild konnte nicht analysiert werden" | Error log |
| Stream interrupted | Client-side detection | Partial message preserved, retry button | Client-side log |
| Session limit (100 msgs) | 400 with message | Chat notification: start new session | Info log |
| Backend unreachable | Proxy error (502) | Toast: "Assistent nicht verfügbar" | Error log |

### LLM Model Selection

The user selects which LLM to use. All three models support both text chat and vision (image analysis). No fallback chain — if the selected model fails, an error is shown.

| Model (OpenRouter slug) | Strengths | Vision Support |
|------------------------|-----------|----------------|
| `anthropic/claude-sonnet-4.6` | Best creative prompting, nuanced style understanding | Yes |
| `openai/gpt-5.4` | Strong reasoning, detailed image analysis | Yes |
| `google/gemini-3.1-pro-preview` | Cost-effective, good multilingual | Yes |

**Default:** `anthropic/claude-sonnet-4.6`
**Selection:** Per-message via `model` field in `SendMessageRequest`. Frontend persists last-used model in local state.
**UI:** Model selector dropdown in assistant sheet header (between title and session-switcher).

---

## Migration Map

> Files being removed or modified in the existing codebase.

| Existing File | Current Pattern | Target Pattern | Specific Changes |
|---|---|---|---|
| `components/prompt-builder/builder-drawer.tsx` | Fragment-based prompt builder drawer | REMOVED | Delete entire file. Replaced by assistant sheet |
| `components/prompt-builder/category-tabs.tsx` | Category tab navigation for builder | REMOVED | Delete entire file (part of builder) |
| `components/prompt-builder/option-chip.tsx` | Selectable option chip for fragments | REMOVED | Delete entire file (part of builder) |
| `components/prompt-builder/snippet-form.tsx` | Snippet create/edit form | REMOVED | Delete entire file (part of builder) |
| `components/prompt-builder/surprise-me-button.tsx` | Random prompt button | REMOVED | Delete entire file (part of builder) |
| `components/prompt-builder/__tests__/builder-drawer.test.tsx` | Builder drawer tests | REMOVED | Delete entire file |
| `components/prompt-builder/__tests__/surprise-me-button.test.tsx` | Surprise me button tests | REMOVED | Delete entire file |
| `components/prompt-builder/__tests__/snippet-ui.test.tsx` | Snippet UI tests | REMOVED | Delete entire file |
| `components/workspace/template-selector.tsx` | 5 hardcoded prompt templates UI | REMOVED | Delete entire file. Discovery: "wird ENTFERNT" |
| `components/workspace/__tests__/template-selector.test.tsx` | Template selector tests | REMOVED | Delete entire file |
| `lib/builder-fragments.ts` | Static fragment categories (Style, Colors, Composition, etc.) | REMOVED | Delete entire file. Agent replaces fragment selection |
| `lib/prompt-templates.ts` | 5 hardcoded prompt templates | REMOVED | Delete entire file. Agent creates custom prompts |
| `app/actions/prompts.ts` | Snippet CRUD + prompt history + improve | Remove snippet CRUD only | Remove `createSnippet`, `updateSnippet`, `deleteSnippet`. Keep `getPromptHistory`, `getFavoritePrompts`, `toggleFavorite`, `improvePrompt` |
| `lib/services/snippet-service.ts` | Snippet CRUD service | REMOVED | Delete entire file. No more snippets |
| `lib/services/__tests__/snippet-service.test.ts` | Snippet service tests | REMOVED | Delete entire file |
| `lib/db/schema.ts` | Existing tables (projects, generations, etc.) | Add assistant tables | Add `assistant_sessions` and `assistant_images` table definitions |
| `lib/db/queries.ts` | Existing queries | Add assistant queries | Add session listing query (for potential direct access) |
| `components/workspace/prompt-area.tsx` | Builder button opens BuilderDrawer, TemplateSelector imported | Assistant trigger button opens AssistantSheet | Replace `BuilderDrawer` + `TemplateSelector` imports/usage with `AssistantSheet`. Change trigger button icon to Sparkles |
| `next.config.ts` | Current Next.js config | Add rewrite rule | Add `rewrites` for `/api/assistant/:path*` → `http://localhost:8000/api/assistant/:path*` |

---

## Constraints & Integrations

### Constraints

| Constraint | Technical Implication | Solution |
|------------|----------------------|----------|
| No user accounts | Cannot tie sessions to users | Sessions bound to `project_id` via DB FK |
| German chat, English prompts | Agent must code-switch | System prompt instructs bilingual behavior |
| Existing prompt fields (motiv, style, negativePrompt) | Canvas must match workspace field structure | 1:1 mapping: canvas fields = workspace fields |
| Existing image upload pattern (R2) | Must reuse, not duplicate | Reference images uploaded via existing `uploadSourceImage` server action |
| LangGraph state must persist across sessions | In-memory not sufficient | `PostgresSaver` with shared PostgreSQL database |
| Sheet must coexist with existing UI | Cannot break workspace layout | Sheet overlays gallery (existing pattern from BuilderDrawer) |

### Integrations

| Area | System / Capability | Interface | Version | Notes |
|------|----------------------|-----------|---------|-------|
| Frontend Framework | Next.js | App Router, Server Actions, Rewrites | 16.1.6 (installed) | Proxy `/api/assistant/*` to FastAPI |
| React | React | Hooks, Context, Components | 19.2.3 (installed) | – |
| Chat UI Library | @assistant-ui/react | useLocalRuntime, ChatModelAdapter, AssistantRuntimeProvider | 0.12.15 (npm, Mar 2026) | Radix-based, Tailwind-compatible |
| CSS Framework | Tailwind CSS | Utility classes | 4.x (installed) | – |
| Icons | Lucide React | Sparkles, ArrowUp, Square, Image, X | 0.577.0 (installed) | – |
| Toast Notifications | Sonner | toast() | 2.0.7 (installed) | Undo-toast for Apply action |
| Python Backend | FastAPI | REST + SSE endpoints | 0.135.1 (PyPI, Mar 2026) | New dependency |
| ASGI Server | Uvicorn | ASGI server | 0.41.0 (PyPI, Feb 2026) | New dependency |
| Agent Framework | LangGraph | StateGraph, create_react_agent | 1.1.0 (PyPI, Mar 2026) | New dependency |
| Checkpoint Persistence | langgraph-checkpoint-postgres | PostgresSaver, AsyncPostgresSaver | 3.0.4 (PyPI, Jan 2026) | Shares PostgreSQL with AI Factory |
| LLM Client | langchain-openai | ChatOpenAI (with OpenRouter base_url) | 1.1.10 (PyPI, Feb 2026) | OpenRouter-compatible via base_url override |
| LLM Observability | LangSmith | @traceable decorator, env vars | 0.7.16 (PyPI, Mar 2026) | LANGSMITH_TRACING=true |
| SSE Streaming | sse-starlette | EventSourceResponse | 3.2.0 (PyPI, Feb 2026) | SSE for FastAPI |
| Python Settings | pydantic-settings | BaseSettings with env vars | 2.13.1 (PyPI, Feb 2026) | Config management |
| Database Driver (Python) | psycopg (Psycopg 3) | Async PostgreSQL | 3.3.3 (PyPI, Feb 2026) | Required by langgraph-checkpoint-postgres |
| Database ORM (Frontend) | Drizzle ORM | Schema, queries | 0.45.1 (installed) | Existing, add new table defs |
| Database Driver (Frontend) | postgres | PostgreSQL connection | 3.4.8 (installed) | Existing |
| Image Storage | Cloudflare R2 | S3-compatible API | via @aws-sdk/client-s3 3.1003.0 (installed) | Existing upload pattern reused |
| Image Generation Models | Replicate | Collections API, Model API | via replicate 1.4.0 (installed) | For model recommendation data |
| Image Processing (Python) | Pillow (PIL) | Image.open, thumbnail | 12.1.1 (PyPI, Feb 2026) | Downscale reference images to 1024px max before Vision API call |
| LLM API Gateway | OpenRouter | OpenAI-compatible chat API | REST API | API key in env var |

---

## Quality Attributes (NFRs)

### From Discovery → Technical Solution

| Attribute | Target | Technical Approach | Measure / Verify |
|-----------|--------|--------------------|------------------|
| Response Latency | First token < 2s | SSE streaming (token-by-token), no buffering | LangSmith trace timing |
| Session Resumability | Sessions persist indefinitely | PostgresSaver checkpointer + assistant_sessions metadata | Load session after server restart |
| Streaming UX | Smooth character-by-character display | SSE text-delta events, @assistant-ui/react native streaming | Visual inspection, no jank |
| Image Analysis Speed | Analysis < 10s | Selected chat model with vision (all 3 support it). Image downscaled to 1024px max | LangSmith trace timing |
| Concurrent Sessions | 5+ simultaneous users | FastAPI async handlers, PostgresSaver (no in-memory state) | Load test with concurrent SSE streams |
| Error Recovery | Graceful degradation | Retry button, partial message preservation, user can switch model | Test error + model switch scenarios |
| Apply Reliability | Undo within 5s | Client-side state snapshot before apply, sonner toast with undo callback | Manual test |
| Canvas Sync | Canvas updates < 500ms after tool call | Tool-call-result SSE event → immediate React state update | Visual inspection |

### Monitoring & Observability

| Metric | Type | Target | Alert |
|--------|------|--------|-------|
| LLM response time (TTFT) | Histogram | < 2s p95 | > 5s |
| LLM response time (total) | Histogram | < 30s p95 | > 60s |
| SSE stream errors | Counter | < 1% of streams | > 5% in 5min |
| Session creation rate | Counter | Informational | – |
| Messages per session | Histogram | Avg 8–15 | – |
| Vision API latency | Histogram | < 10s p95 | > 15s |
| LangSmith trace success | Gauge | > 99% | < 95% |

---

## Risks & Assumptions

### Assumptions

| Assumption | Technical Validation | Impact if Wrong |
|------------|---------------------|-----------------|
| OpenRouter supports all 3 LLM models (Sonnet 4.6, GPT-5.4, Gemini 3.1 Pro) | Check OpenRouter model list at integration time | Remove unavailable model from selection |
| All 3 models support vision (image URL input) via OpenRouter | Test during Slice 6 implementation | Switch to base64 encoding (download image server-side, encode) |
| PostgresSaver can share the same PostgreSQL database as AI Factory | LangGraph creates its own tables, no conflicts | Use separate database/schema |
| @assistant-ui/react useLocalRuntime supports streaming tool call events | Proven in feedbackai-mvp (text only), tool calls need testing | Custom SSE parser with side-effect dispatch outside assistant-ui |
| R2 public URLs are accessible from OpenRouter Vision API | URLs are already public for image display | Proxy image through backend before sending to Vision API |
| Next.js rewrites work with SSE streaming (no buffering) | Test during Slice 3 integration | Use direct FastAPI URL from client (requires CORS config) |

### Risks & Mitigation

| Risk | Likelihood | Impact | Technical Mitigation | Fallback |
|------|------------|--------|---------------------|----------|
| LLM API unavailable (OpenRouter outage) | Low | High | Retry with exponential backoff, user can switch model | Show error, user can retry or select different model |
| SSE streaming breaks through Next.js proxy | Medium | High | Test early in Slice 3 | Direct client→FastAPI connection with CORS headers |
| PostgresSaver checkpoint tables conflict with Drizzle migrations | Low | Medium | LangGraph manages its own tables via `.setup()`, Drizzle ignores them | Separate PostgreSQL schema (`assistant` schema) |
| High LLM costs from long conversations | Medium | Medium | 100 message limit per session, token counting in LangSmith | Adjust limit, switch to cheaper models |
| Image analysis returns poor results | Low | Low | All 3 models have strong vision capabilities, user can switch model | Allow user to manually describe image instead |
| Agent goes off-script (hallucination, wrong language) | Medium | Low | Strong system prompt, temperature=0.7, LangSmith monitoring | Refine system prompt iteratively |
| Python backend adds operational complexity | Medium | Medium | Docker Compose for local dev, shared PostgreSQL | Well-documented setup in README |

---

## Technology Decisions

### Stack Choices

| Area | Technology | Rationale |
|------|------------|-----------|
| Backend Framework | FastAPI | Async-native, SSE support, proven in feedbackai-mvp. Discovery requires Python for LangGraph |
| Agent Framework | LangGraph | ReAct agent with tool calling, checkpointing, streaming. Production-ready |
| Chat UI | @assistant-ui/react | Best React chat UI for custom backends. Radix-based, Tailwind-compatible. Proven in feedbackai-mvp |
| LLM Gateway | OpenRouter (via langchain-openai) | Multi-model access, single API key. OpenAI-compatible API |
| Session Persistence | langgraph-checkpoint-postgres (PostgresSaver) | Production-ready session resume. Shares existing PostgreSQL |
| Image Analysis | Same selected chat model (all 3 support vision) | No separate vision model needed. Image downscaled to 1024px max via Pillow |
| Observability | LangSmith | First-class LangGraph integration, trace every LLM call |
| Repo Structure | Monorepo subfolder (`backend/`) | Shared database config, simplified development, one repo to clone |
| Proxy Pattern | Next.js rewrites | Same-origin for frontend, no CORS. Transparent to client code |

### Trade-offs

| Decision | Pro | Con | Mitigation |
|----------|-----|-----|------------|
| Separate Python backend (vs. Next.js API routes) | LangGraph requires Python, proven agent patterns, LangSmith integration | Additional service to run, deploy complexity | Docker Compose for local dev, clear README |
| @assistant-ui/react (vs. custom chat UI) | Production-grade, accessible, streaming built-in, tool call support | Additional dependency (0.12.x), learning curve | Already proven in feedbackai-mvp, active maintenance |
| useLocalRuntime + custom adapter (vs. @assistant-ui/react-langgraph) | Full control over API shape, no LangGraph Cloud dependency | More custom code than hosted solution | Pattern proven in feedbackai-mvp, SSE parser reusable |
| PostgresSaver (vs. MemorySaver) | Sessions persist across restarts, production-ready | Slightly more complex setup (`.setup()` call) | One-time setup, automatic migration |
| langchain-openai with base_url (vs. langchain-openrouter) | Mature package (v1.1.10), well-tested | Not the official OpenRouter package | OpenRouter docs recommend this approach |
| Monorepo subfolder (vs. separate repo) | Shared DB config, one clone, easier CI/CD | Larger repo, mixed language tooling | Clear folder separation, independent dependency management |
| Vision via chat model (vs. separate vision model or CLIP) | No extra model, same API, all 3 models support it | Vision cost varies by model | Simpler architecture, user controls cost via model choice |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| 1 | Python backend: Subfolder or separate repo? | A) `backend/` subfolder in aifactory B) Separate repository | A) Subfolder | **A) Subfolder — shared DB, simpler dev workflow** |
| 2 | Next.js proxy: rewrites or direct client connection? | A) Next.js rewrites (same-origin) B) Direct + CORS | A) Rewrites | **A) Rewrites — test in Slice 3, fallback to B if SSE issues** |
| 3 | LangGraph: create_react_agent or custom graph? | A) create_react_agent (prebuilt) B) Custom StateGraph | A) create_react_agent | **A) Prebuilt — standard pattern, less code, same capability** |
| 4 | Drizzle schema: include assistant tables or Python-only? | A) Both Drizzle + Python define tables B) Python-only via raw SQL | A) Both | **A) Both — Drizzle for potential direct queries from Next.js, Python for migrations** |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-11 | Codebase | Next.js 16.1.6, React 19.2.3, Tailwind 4, Drizzle ORM 0.45.1, PostgreSQL |
| 2026-03-11 | Codebase | Existing: OpenRouter client (`lib/clients/openrouter.ts`), R2 storage (`lib/clients/storage.ts`), Replicate client, Sheet UI component |
| 2026-03-11 | Codebase | Builder Drawer uses Sheet (right side), fragment categories, live preview — all being replaced |
| 2026-03-11 | Codebase | Prompt templates: 5 hardcoded (Product Shot, Landscape, Character, Logo, Abstract) — being removed |
| 2026-03-11 | Codebase | Workspace state via React Context (`lib/workspace-state.tsx`): promptMotiv, promptStyle, negativePrompt, modelId |
| 2026-03-11 | Codebase | Image upload: R2 via AWS SDK, accepts PNG/JPEG/WebP, max 10MB, returns public URL |
| 2026-03-11 | Codebase | Model data: Replicate Collections API, 1h in-memory cache, CollectionModel type |
| 2026-03-11 | Codebase (feedbackai-mvp) | @assistant-ui/react 0.12.10 with useLocalRuntime + custom ChatModelAdapter |
| 2026-03-11 | Codebase (feedbackai-mvp) | FastAPI + LangGraph + MemorySaver + sse-starlette for SSE streaming |
| 2026-03-11 | Codebase (feedbackai-mvp) | SSE parser with buffering for chunked events, metadata-first pattern |
| 2026-03-11 | Codebase (feedbackai-mvp) | RuntimeProvider + AssistantRuntimeProvider separation to avoid re-render loops |
| 2026-03-12 | Web (npm) | @assistant-ui/react: 0.12.15 (latest, Mar 2026) |
| 2026-03-12 | Web (npm) | @assistant-ui/react-langgraph: 0.12.5 — requires LangGraph Cloud, NOT suitable for self-hosted |
| 2026-03-12 | Web (PyPI) | langgraph: 1.1.0 (Mar 10, 2026) |
| 2026-03-12 | Web (PyPI) | langgraph-checkpoint-postgres: 3.0.4 (Jan 31, 2026). Requires psycopg 3, `.setup()` for table creation |
| 2026-03-12 | Web (PyPI) | FastAPI: 0.135.1 (Mar 1, 2026). Native SSE support added. Python ≥3.10 |
| 2026-03-12 | Web (PyPI) | langchain-openai: 1.1.10 — use with `base_url="https://openrouter.ai/api/v1"` for OpenRouter |
| 2026-03-12 | Web (PyPI) | langchain-openrouter: 0.0.2 (Feb 15, 2026) — too new/unstable, prefer langchain-openai with base_url |
| 2026-03-12 | Web (PyPI) | langsmith: 0.7.16. Setup: `LANGSMITH_TRACING=true` + `LANGSMITH_API_KEY` env vars |
| 2026-03-12 | Web (PyPI) | sse-starlette: 3.2.0 (Feb 28, 2026). W3C SSE spec compliant |
| 2026-03-12 | Web (PyPI) | uvicorn: 0.41.0 (Feb 16, 2026) |
| 2026-03-12 | Web (PyPI) | pydantic-settings: 2.13.1 (Feb 19, 2026) |
| 2026-03-12 | Web (PyPI) | psycopg: 3.3.3 (Feb 18, 2026) |
| 2026-03-12 | User Feedback | Kein GPT-4o für Vision — alle 3 Chat-Modelle (Sonnet 4.6, GPT-5.4, Gemini 3.1 Pro) supporten Vision |
| 2026-03-12 | User Feedback | Keine Fallback-Chain — LLM ist vom User wählbar (Dropdown in Sheet Header) |
| 2026-03-12 | Web | @assistant-ui/react tool call handling: must accumulate tool_calls across stream chunks to avoid UI flicker |
| 2026-03-12 | Web | PostgresSaver requires `autocommit=True` and `row_factory=dict_row` for manual connections |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| 1 | Python backend: eigenes Repo oder Subfolder im Monorepo? | Subfolder (`backend/`) — shared DB, simpler dev. Discovery left this as TODO for Architecture |
| 2 | LangGraph Cloud vs self-hosted? | Self-hosted (FastAPI + LangGraph as library) — same pattern as feedbackai-mvp, no cloud dependency |
| 3 | @assistant-ui/react-langgraph vs useLocalRuntime + custom adapter? | useLocalRuntime + custom ChatModelAdapter — @assistant-ui/react-langgraph requires LangGraph Cloud API |
| 4 | langchain-openrouter vs langchain-openai with base_url? | langchain-openai with base_url — mature (v1.1.10), proven, OpenRouter docs recommend it |
| 5 | PostgresSaver vs MemorySaver? | PostgresSaver — sessions must persist across server restarts (Discovery requirement) |
| 6 | CLIP + Vision vs Vision only for image analysis? | Vision via selected chat model — all 3 models support vision. No separate vision model needed |
| 7 | Drizzle for assistant tables? | Yes, define in both Drizzle (frontend queries) and Python (backend migrations) |
