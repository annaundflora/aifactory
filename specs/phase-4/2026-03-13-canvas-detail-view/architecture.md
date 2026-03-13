# Feature: Canvas Detail-View & Editing Flow

**Epic:** AI Image Studio - Phase 4
**Status:** Draft
**Discovery:** `discovery.md` (same folder)
**Derived from:** Discovery constraints, NFRs, and risks

---

## Problem & Solution

**Problem:**
- Iteratives Arbeiten bricht den Flow: Lightbox -> Aktion -> Lightbox schliesst -> Gallery -> neues Bild suchen
- Kein In-Place-Ergebnis: Neue Generierungen erscheinen in der Gallery, nicht dort wo der User arbeitet
- Prompt-Panel ist auf Erst-Generierung optimiert, nicht auf Iteration auf einem bestehenden Bild
- Chat/Assistant existiert im Backend (LangGraph Agent), aber nicht als bild-bezogener Editing-Kanal
- img2img Referenz-System funktioniert nur fuer neue Generierungen, nicht als Iterations-Tool

**Solution:**
- Lightbox ersetzen durch Canvas-Detail-View: Fullscreen-Ansicht mit persistentem Bild, Tools und Chat
- Photoshop-Toolbar Pattern: Schmale Icon-Leiste links + schwebende Popovers
- Chat rechts als bild-bezogener Editing-Kanal via LangGraph Agent
- Einheitliches Undo/History-Pattern: Jede Aktion ersetzt sofort das Bild, Undo-Stack
- Sibling-Thumbnails fuer Varianten-Navigation innerhalb einer Generation

**Business Value:**
- Drastische Reduktion der Klicks pro Iteration (von ~5 auf ~1-2)
- Chat-basiertes Editing senkt die Articulation Barrier fuer nicht-technische User
- Grundlage fuer spaetere Canvas-Features (Inpainting, Outpainting)

---

## Scope & Boundaries

| In Scope |
|----------|
| Canvas-Detail-View als Fullscreen-Ersatz fuer die aktuelle Lightbox |
| Animated Transition von Gallery zu Detail-View (CSS View Transitions API) |
| Photoshop-Toolbar: Schmale Icon-Leiste links mit schwebenden Popovers |
| Tools: Variation, img2img + Referenzen, Upscale (2x/4x), Download, Delete, Details |
| Chat-Panel rechts (collapsible, resizable 320-480px) |
| Chat-Init mit Bild-Kontext (Modell, Prompt, Key-Params) |
| Sibling-Thumbnails unter dem Bild (Varianten einer Generation via batchId) |
| Prev/Next Navigation durch alle Gallery-Bilder |
| Einheitliches Undo/History-Pattern: Sofort-Replace + Undo-Stack pro Session |
| Collapsible Details-Overlay (Prompt, Modell, Parameter, Provenance) |
| Model-Selector im Header (shared fuer Variation + img2img) |

| Out of Scope |
|--------------|
| Inpainting / Outpainting |
| Generation Frame auf Canvas |
| Infinite Canvas / Multi-Image Canvas |
| Chat kennt Referenzen als Kontext |
| Gallery-Varianten-Grouping |
| Chat in Gallery-View |
| Mobile/Touch-Optimierung |

---

## API Design

### Overview

| Aspect | Specification |
|--------|---------------|
| Style | REST (FastAPI backend) + Next.js Server Actions (frontend) |
| Authentication | None (single-user app, no auth) |
| Rate Limiting | Existing: 30 msg/min, 100 msg/session lifetime (AssistantService) |

### Endpoints

#### Existing (reused)

| Method | Path | Purpose |
|--------|------|---------|
| POST | Server Action `generateImages()` | Trigger txt2img/img2img generation |
| POST | Server Action `upscaleImage()` | Trigger upscale |
| POST | Server Action `deleteGeneration()` | Delete generation + R2 cleanup |
| POST | `/api/assistant/sessions` | Create new assistant session |
| POST | `/api/assistant/sessions/{id}/messages` | Send message to LangGraph agent (SSE) |
| GET | `/api/assistant/sessions/{id}` | Get session detail with state |

#### New Endpoints

| Method | Path | Request | Response | Auth | Business Logic |
|--------|------|---------|----------|------|----------------|
| GET | Server Action `getSiblingGenerations(batchId)` | `{ batchId: string }` | `Generation[]` | None | Query generations WHERE batchId = :batchId AND status = 'completed' ORDER BY createdAt ASC |
| POST | `/api/assistant/canvas/sessions` | `{ project_id: UUID, image_context: CanvasImageContext }` | `SessionResponse` | None | Create canvas editing session with image context. Uses new canvas agent graph. |
| POST | `/api/assistant/canvas/sessions/{id}/messages` | `CanvasSendMessageRequest` | SSE stream | None | Send message to canvas editing agent. Agent has generate_image tool. Response includes generation trigger events. |

### Data Transfer Objects (DTOs)

| DTO | Fields | Validation | Notes |
|-----|--------|------------|-------|
| `CanvasImageContext` | `image_url: str`, `prompt: str`, `model_id: str`, `model_params: dict`, `generation_id: str` | All required | Sent with session creation and context updates |
| `CanvasSendMessageRequest` | `content: str(1-5000)`, `image_context: CanvasImageContext`, `model: Optional[str]` | content required | Extends SendMessageRequest with image_context |
| `CanvasGenerateEvent` (SSE) | `event: "canvas-generate"`, `data: { action: "variation"|"img2img", prompt: str, model_id: str, params: dict }` | — | New SSE event type when agent triggers generation |

---

## Database Schema

### Entities

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `generations` | Image generation records | id, projectId, batchId (NEW), prompt, modelId, status, imageUrl |
| `assistant_sessions` | Chat sessions | id, projectId, title, status (existing, reused for canvas chat) |

### Schema Details — New Column

| Table | Column | Type | Constraints | Index |
|-------|--------|------|-------------|-------|
| `generations` | `batch_id` | UUID | NULLABLE, DEFAULT NULL | Yes: `generations_batch_id_idx` |

### Migration

```sql
ALTER TABLE generations ADD COLUMN batch_id UUID DEFAULT NULL;
CREATE INDEX generations_batch_id_idx ON generations (batch_id);
```

**Backfill:** Existing generations get no batchId (NULL). Only new generations from `GenerationService.generate()` get a shared batchId per request. Sibling query returns empty for NULL batchId → single-image generations show no siblings (correct behavior).

### Relationships

| From | To | Relationship | Cascade |
|------|-----|--------------|---------|
| `generations.batch_id` | — | Self-grouping (no FK) | N/A |
| `assistant_sessions.project_id` | `projects.id` | N:1 | CASCADE DELETE |

---

## Server Logic

### Services & Processing

| Service | Responsibility | Input | Output | Side Effects |
|---------|----------------|-------|--------|--------------|
| `GenerationService.generate()` | Image generation with batchId | projectId, prompt, modelIds, count, ... | Generation[] (pending) | Creates DB rows with shared batchId, triggers Replicate API |
| `GenerationService.upscale()` | Upscale image | projectId, sourceImageUrl, scale | Generation (pending) | Creates DB row, triggers Replicate API |
| `CanvasAssistantService` | Canvas editing chat agent | sessionId, content, imageContext | SSE stream | LangGraph agent execution, may trigger generation |
| `CanvasAgentGraph` | LangGraph agent for canvas editing | messages, image_context | AI response + tool calls | May call `generate_image` tool |

### Business Logic Flow

```
[Canvas Chat Message]
  → CanvasAssistantService.stream_response()
    → LangGraph CanvasAgent (with image context in system prompt)
      → Agent decides: text-only response OR tool call
        → If tool call "generate_image":
          → Returns structured generation params via SSE "canvas-generate" event
          → Frontend receives event, calls generateImages() server action
          → Polling picks up completed generation
          → Canvas replaces image, pushes old to undo stack

[Tool Popover Generate]
  → generateImages() / upscaleImage() server action directly
  → Same polling + replace + undo flow
```

### Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `batchId` | Valid UUID when provided | N/A (server-generated) |
| Canvas chat `content` | 1-5000 chars, non-empty | "Nachricht darf nicht leer sein" |
| Canvas chat `image_context.image_url` | Valid URL | "Bild-URL ist ungueltig" |

---

## Security

### Authentication & Authorization

| Area | Mechanism | Notes |
|------|-----------|-------|
| All endpoints | None | Single-user app, no auth required |
| Server Actions | Next.js server-side execution | No client-side secrets exposed |
| Backend API | Proxied via Next.js rewrites | `/api/assistant/*` → FastAPI backend |

### Data Protection

| Data Type | Protection | Notes |
|-----------|------------|-------|
| Image URLs | TEXT column (R2 presigned URLs) | Variable length, no VARCHAR limit |
| Chat messages | In-memory + LangGraph checkpoint (PostgreSQL) | Persisted via checkpoint saver |

### Input Validation & Sanitization

| Input | Validation | Sanitization |
|-------|------------|--------------|
| Chat message content | Length 1-5000, non-empty | Pydantic validation |
| Image context URLs | HttpUrl validation | Pydantic HttpUrl type |
| Generation params (from agent) | Same validation as existing generateImages() | Server action validation |

### Rate Limiting & Abuse Prevention

| Resource | Limit | Window | Penalty |
|----------|-------|--------|---------|
| Canvas chat messages | 30 | per minute | HTTP 429 |
| Canvas chat session | 100 | lifetime | HTTP 400 |
| Image generation | Replicate API limits | per account | Error toast |

---

## Architecture Layers

### Layer Responsibilities

| Layer | Responsibility | Pattern |
|-------|----------------|---------|
| React Components (Canvas) | Detail-View UI, Toolbar, Popovers, Chat, Siblings | Component composition |
| React Context (CanvasDetail) | Detail-view state, undo/redo, active tool, current image | Context + Reducer |
| Server Actions | Generation, upscale, delete, sibling query | Next.js Server Actions |
| FastAPI Routes (Canvas) | Canvas chat message handling, session management | REST + SSE |
| LangGraph Agent (Canvas) | Image editing assistant with generation tools | ReAct agent |
| Database (Drizzle) | Generation records, session records | Drizzle ORM |

### Data Flow

```
                     ┌──────────────────────────────────────────────────────────┐
                     │                    FRONTEND (Next.js)                     │
                     │                                                          │
[Gallery Click] ─────┤   WorkspaceContent                                      │
                     │     ├── GalleryGrid (existing)                          │
                     │     └── CanvasDetailView (NEW)                          │
                     │           ├── CanvasToolbar                             │
                     │           │     └── ToolPopovers → generateImages()  ───┼──► DB
                     │           ├── CanvasImage + SiblingThumbnails            │
                     │           ├── DetailsOverlay                            │
                     │           └── CanvasChatPanel                           │
                     │                 └── Chat messages ──────────────────────┼──► Backend
                     │                                                          │
                     └──────────────────────────────────────────────────────────┘
                                                                         │
                     ┌──────────────────────────────────────────────────────────┐
                     │                    BACKEND (FastAPI)                      │
                     │                                                          │
                     │   /api/assistant/canvas/sessions/{id}/messages            │
                     │     → CanvasAssistantService                            │
                     │       → LangGraph CanvasAgent                           │
                     │         → Tools: generate_image, analyze_current_image   │
                     │           → SSE: text-delta | canvas-generate | error    │
                     │                                                          │
                     └──────────────────────────────────────────────────────────┘
```

### Error Handling Strategy

| Error Type | Handling | User Response | Logging |
|------------|----------|---------------|---------|
| Generation failed | Polling detects `status: "failed"` | Toast notification, image unchanged | `console.error` |
| Chat agent timeout | SSE timeout (60s) | Chat: "Keine Antwort. Bitte erneut versuchen." | Backend error log |
| Chat agent error | SSE error event | Chat: error message bubble | Backend error log |
| Upscale too large | Disabled icon + tooltip pre-check | Tooltip: "Image too large for upscale" | None |
| Network error | Fetch/SSE failure | Toast: "Verbindungsfehler" | `console.error` |

---

## Migration Map

| Existing File | Current Pattern | Target Pattern | Specific Changes |
|---|---|---|---|
| `components/workspace/workspace-content.tsx` | Manages lightbox state (lightboxOpen, lightboxIndex), renders LightboxModal + LightboxNavigation | Manages detail-view state (detailViewOpen, currentGenerationId), renders CanvasDetailView. Lightbox removed. | Replace lightbox state with detail-view state. Replace `<LightboxModal>` + `<LightboxNavigation>` with `<CanvasDetailView>`. Keep gallery, polling, filter logic unchanged. |
| `components/workspace/generation-card.tsx` | `onClick` calls `onSelect(generation.id)` which opens lightbox | Same `onClick` but now opens CanvasDetailView | No code change needed — `onSelect` handler in workspace-content changes behavior |
| `lib/db/schema.ts` | `generations` table without batchId | `generations` table with `batchId: uuid("batch_id")` column | Add nullable UUID column `batch_id` with index |
| `lib/db/queries.ts` | `CreateGenerationInput` has no batchId, no sibling query | `CreateGenerationInput` with `batchId?: string`, new `getSiblingsByBatchId(batchId)` query | Add `batchId?: string` to `CreateGenerationInput`. Add `batchId: input.batchId ?? null` to `createGeneration()` values. Add `getSiblingsByBatchId()` query returning completed generations with same batchId. |
| `lib/services/generation-service.ts` | `generate()` creates rows without batchId | `generate()` creates shared `batchId` (UUID) for all rows of one request | Generate UUID, pass to `createGeneration()` for each row in the batch |
| `app/actions/generations.ts` | `generateImages()` without batchId | Pass-through for batchId from service | No change needed (service handles batchId internally) |
| `next.config.ts` | No viewTransition flag, rewrite for `/api/assistant/:path*` | Enable `experimental: { viewTransition: true }`. Existing rewrite `/api/assistant/:path*` already covers new canvas endpoints (`/api/assistant/canvas/*`). | Add experimental config for CSS View Transitions API. No rewrite changes needed — existing wildcard pattern covers new `/api/assistant/canvas/` routes. |
| `lib/workspace-state.tsx` | Only WorkspaceVariationContext | Add CanvasDetailContext alongside | New context provider for detail-view state (undo/redo, active tool, current image) |
| `backend/app/agent/tools/prompt_tools.py` | draft_prompt, refine_prompt tools | Unchanged | No change |
| `backend/app/services/assistant_service.py` | AssistantService for prompt assistant | New CanvasAssistantService extending same patterns | New service class, same SSE streaming pattern, different agent graph |

### Files to Remove (after migration)

| File | Reason |
|------|--------|
| `components/lightbox/lightbox-modal.tsx` | Replaced by CanvasDetailView |
| Lightbox references in `workspace-content.tsx` | Replaced by detail-view logic |

### Files to Keep (reused as-is)

| File | Reused In |
|------|-----------|
| `components/lightbox/provenance-row.tsx` | DetailsOverlay component |
| `components/lightbox/lightbox-navigation.tsx` | Prev/Next pattern reference (may be rewritten) |
| `components/workspace/reference-bar.tsx` | img2img Popover |
| `components/workspace/reference-slot.tsx` | img2img Popover |
| `components/workspace/image-dropzone.tsx` | img2img Popover |
| `components/assistant/chat-thread.tsx` | CanvasChatPanel (adapted) |
| `components/assistant/chat-input.tsx` | CanvasChatPanel (adapted) |
| `components/assistant/streaming-indicator.tsx` | CanvasChatPanel (reused) |

---

## Constraints & Integrations

### Constraints

| Constraint | Technical Implication | Solution |
|------------|----------------------|----------|
| No animation library in project | Cannot use framer-motion layoutId for shared element transition | CSS View Transitions API via `document.startViewTransition()` + Next.js experimental flag |
| Single-page state transition (not route change) | Detail-View is not a separate page/route, just state toggle | Client-side state in CanvasDetailContext, no URL change |
| Existing polling pattern (3s interval) | In-place generation must reuse polling for completion detection | Detail-View polls same as Gallery (WorkspaceContent manages polling) |
| LangGraph agent is stateful (checkpointed) | Canvas chat sessions need their own checkpoint thread | Separate session IDs for canvas chat, reuse existing PostgresSaver |
| Upscale uses hardcoded model | Model-Selector in header is irrelevant for upscale | CanvasDetailView passes hardcoded `nightmareai/real-esrgan` for upscale, header model for variation/img2img |
| Undo/Redo is client-only (not persisted) | Stack lost on page reload or navigation | Acceptable per Discovery decision (Q&A #2) |
| Chat agent must NOT trigger generation directly | Agent returns intent, frontend triggers server action | SSE `canvas-generate` event carries params, frontend calls `generateImages()` |
| Canvas API routes must be proxied to backend | New `/api/assistant/canvas/*` routes need Next.js rewrite | Existing wildcard rewrite `/api/assistant/:path*` → FastAPI already covers `/api/assistant/canvas/*`. No config change needed. |

### Integrations

| Area | System / Capability | Interface | Version | Notes |
|------|----------------------|-----------|---------|-------|
| Frontend Framework | Next.js | App Router, Server Actions | 16.1.6 (project, pinned) | Experimental `viewTransition: true` for CSS View Transitions |
| UI Library | React | Hooks, Context, useTransition | 19.2.3 (project, pinned) | React 19 startViewTransition integration |
| CSS Framework | Tailwind CSS | Utility classes, transitions | 4.x (project `^4`) | Animations via `tw-animate-css ^1.4.0` |
| UI Components | Radix UI (via shadcn) | Popover, Dialog, etc. | 1.4.3 (project, pinned) | Popovers for tool panels |
| Database ORM | Drizzle ORM | Schema, queries, migrations | 0.45.1 (project `^0.45.1`) | Add batchId column + index |
| Database | PostgreSQL | SQL | — | Via Drizzle + postgres.js driver |
| Image Processing | Replicate API | REST | via `replicate ^1.4.0` (project) | txt2img, img2img, upscale models |
| Image Storage | Cloudflare R2 | S3-compatible API | via `@aws-sdk/client-s3 ^3.1003.0` (project) | PNG storage |
| Backend Framework | FastAPI | REST + SSE | >=0.135.0 (project pyproject.toml) | New canvas routes |
| AI Agent Framework | LangGraph | StateGraph, ReAct agent | 1.1.0 (project `>=1.1.0`, latest on PyPI 2026-03-10) | New canvas editing agent graph |
| AI LLM | OpenRouter (ChatOpenAI) | LangChain ChatOpenAI with base_url override | langchain-openai >=1.1.10 (project) | Same LLM provider as prompt assistant |
| Checkpointer | langgraph-checkpoint-postgres | PostgresSaver | >=3.0.4 (project) | Session persistence for canvas chat |
| Toast Notifications | Sonner | toast(), toast.error() | 2.0.7 (project `^2.0.7`) | Error/success feedback |
| Icons | Lucide React | Icon components | 0.577.0 (project `^0.577.0`) | Toolbar icons |

---

## Quality Attributes (NFRs)

### From Discovery → Technical Solution

| Attribute | Target | Technical Approach | Measure / Verify |
|-----------|--------|--------------------|------------------|
| Transition Performance | Gallery→Detail animation < 300ms, no jank | CSS View Transitions API (hardware-accelerated, compositor-driven) | Chrome DevTools Performance panel, no frame drops |
| Generation Feedback | Loading state visible immediately | Optimistic UI: pending generation returned instantly, polling detects completion | Manual test: loading overlay appears < 100ms after Generate click |
| Undo Responsiveness | Undo/Redo < 50ms | Client-side state swap (no DB/network), image already cached by browser | Manual test: instant visual swap |
| Chat Latency | First token < 2s | SSE streaming (existing pattern), LangGraph async streaming | Measure time from send to first `text-delta` event |
| Image Loading | Detail-View image loads < 1s | Next.js Image component with `priority`, R2 CDN | Lighthouse, manual test |
| Sibling Query | < 100ms | Indexed query on `batch_id` column | Database EXPLAIN ANALYZE |
| Chat Panel Resize | Smooth, no layout thrashing | CSS `resize` or drag handle with `requestAnimationFrame` | Manual test: no jank during resize |

### Monitoring & Observability

| Metric | Type | Target | Alert |
|--------|------|--------|-------|
| Generation completion time | Timer (console.log) | < 60s | Toast on timeout |
| Chat agent response time | Timer (SSE first-token) | < 2s | Chat error message |
| Polling interval | Fixed | 3s | N/A (existing) |

---

## Risks & Assumptions

### Assumptions

| Assumption | Technical Validation | Impact if Wrong |
|------------|---------------------|-----------------|
| CSS View Transitions API is supported in target browsers (Chrome, Edge, Safari) | caniuse.com: 95%+ support (Chrome 111+, Safari 18+, Firefox 133+) | Graceful degradation to instant transition (no animation, feature still works) |
| Next.js 16 experimental viewTransition flag is stable enough for production | Flag is experimental but core API is a web standard | Fallback to `document.startViewTransition()` directly if Next.js integration issues |
| LangGraph agent can reliably parse user intent for image editing | Existing prompt assistant shows intent recognition works | Clarification flow (agent asks follow-up questions) catches ambiguous intents |
| Polling (3s) is fast enough for in-place generation feedback | Current gallery polling works well | Users see loading overlay, acceptable delay |
| batchId backfill not needed for existing generations | Existing generations show no siblings (NULL batchId = empty sibling list) | Correct: single-image generations have no siblings to show |

### Risks & Mitigation

| Risk | Likelihood | Impact | Technical Mitigation | Fallback |
|------|------------|--------|---------------------|----------|
| View Transition animation not smooth on low-end devices | Low | Low | Hardware-accelerated CSS transforms, no JS animation | Disable animation, instant transition |
| Canvas editing agent generates low-quality prompts | Medium | Medium | System prompt with image context + existing prompt engineering patterns | User can edit prompt manually in Variation popover |
| Chat-triggered generation conflicts with tool-triggered generation | Low | Medium | Disable all inputs during `detail-generating` state | Only one generation at a time enforced by UI state |
| Undo stack memory usage with many iterations | Low | Low | Max 20 entries (oldest dropped), stack stores only generation IDs (not image data) | Browser GC handles image cache eviction |
| LangGraph canvas agent adds latency vs. direct tool use | Medium | Low | Agent adds ~1-2s for intent parsing | User can always use direct tool popovers instead of chat |

---

## Technology Decisions

### Stack Choices

| Area | Technology | Rationale |
|------|------------|-----------|
| Animation | CSS View Transitions API | Native web standard, no bundle size increase, hardware-accelerated. Already supported in Next.js 16 experimental flag. |
| State Management | React Context + useReducer | Matches existing pattern (WorkspaceVariationContext). Undo/redo stack is a natural reducer use case. |
| Chat UI | Adapted existing assistant components | ChatThread, ChatInput, StreamingIndicator already exist. Canvas chat adds image context and generation events. |
| Canvas Agent | Separate LangGraph graph (not extended prompt assistant) | Different system prompt, different tools, different state schema. Clean separation prevents prompt/state conflicts. |
| Sibling Grouping | `batch_id` UUID column | Simple, queryable, no complex relationship tables. NULL for existing data = backward compatible. |
| Popover UI | Radix UI Popover (existing) | Already used in LightboxModal for upscale. Consistent with design system. |

### Trade-offs

| Decision | Pro | Con | Mitigation |
|----------|-----|-----|------------|
| CSS View Transitions vs. framer-motion | No bundle size increase, native API, future-proof | Less control than framer-motion layoutId, experimental in Next.js | Graceful degradation to instant transition |
| Client-side undo stack vs. DB-persisted | Instant (<50ms), no network, simple implementation | Lost on page reload | Acceptable per Discovery decision; images persist in DB/gallery |
| Separate canvas agent vs. extending prompt assistant | Clean separation, independent system prompts, no state conflicts | Two agent codepaths to maintain | Share tool implementations, only system prompt and state differ |
| Chat-triggered generation via SSE event (not direct server call from agent) | Frontend controls generation flow, consistent with tool-popover path | Extra round-trip (agent → SSE → frontend → server action) | Keeps single source of truth for generation logic in server actions |
| No URL change for Detail-View | Simpler state management, animation works | No deep-linking to a specific image detail view | Acceptable for MVP; can add URL sync later if needed |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| 1 | Animated Transition Technik | A) CSS View Transitions API B) framer-motion C) Custom FLIP | A) CSS View Transitions API | A — Native, zero-bundle, Next.js 16 support. Graceful degradation. |
| 2 | Canvas Agent: Eigener Graph oder Prompt-Assistant erweitern? | A) Separater Graph B) Erweitern | A) Separater Graph | A — Unterschiedlicher System-Prompt, unterschiedliche Tools, sauberere Trennung. |
| 3 | Chat-generierte Bilder: Agent ruft Server Action direkt oder via SSE-Event an Frontend? | A) Agent ruft direkt B) SSE-Event an Frontend | B) SSE-Event an Frontend | B — Frontend kontrolliert Generation-Flow, gleicher Pfad wie Tool-Popover. |
| 4 | Model-Selector State: Pro Detail-View Session oder global? | A) Session-lokal B) Global | A) Session-lokal | A — Initialisiert aus Gallery-Model, unabhaengig aenderbar. |

---

## Context & Research

### Codebase Patterns

| Pattern | Location | Relevance |
|---------|----------|-----------|
| LightboxModal | `components/lightbox/lightbox-modal.tsx` | Actions-Pattern (Variation, img2img, Upscale, Download, Delete) wird in Toolbar/Popovers uebernommen |
| WorkspaceContent | `components/workspace/workspace-content.tsx` | Polling-Pattern, Generation-State-Management, Lightbox-Trigger wird zu Detail-View-Trigger |
| WorkspaceVariationContext | `lib/workspace-state.tsx` | Context-Pattern fuer State-Sharing zwischen Components |
| AssistantService | `backend/app/services/assistant_service.py` | SSE-Streaming-Pattern, Rate-Limiting, Error-Handling fuer Canvas-Chat wiederverwendbar |
| LangGraph Agent | `backend/app/agent/graph.py` | ReAct-Pattern, Tool-Binding, Checkpointer-Integration als Vorlage fuer Canvas-Agent |
| ChatThread + ChatInput | `components/assistant/chat-thread.tsx`, `chat-input.tsx` | UI-Pattern fuer Message-Bubbles, Auto-Scroll, Streaming-Indicator |
| PromptArea | `components/workspace/prompt-area.tsx` | Reference-Management, Parameter-Panel, Model-Selection als Referenz fuer Popovers |
| ReferenceBar + ReferenceSlot | `components/workspace/reference-bar.tsx`, `reference-slot.tsx` | Drag-Drop, Upload, Role/Strength Selectors fuer img2img Popover |
| GenerationService | `lib/services/generation-service.ts` | Batch-Processing-Pattern, Replicate API Integration, batchId-Erweiterung |
| Drizzle Schema | `lib/db/schema.ts` | Existing `generations` table schema, Migration-Pattern fuer neue Columns |

### Web Research

| Source | Finding | Implication |
|--------|---------|-------------|
| Next.js 16 Docs | `viewTransition: true` experimental flag enables React 19 View Transitions | Can use `document.startViewTransition()` for Gallery→Detail animation |
| CSS View Transitions API (caniuse) | Chrome 111+, Safari 18+, Firefox 133+ (95%+ coverage) | Safe to use with graceful degradation |
| LangGraph 1.1.0 (PyPI, 2026-03-10) | Latest stable, matches project `>=1.1.0` | No version upgrade needed |
| Drizzle ORM 0.45.1 | Latest stable, matches project `^0.45.1` | No version upgrade needed |
| Motion (framer-motion) 12.36.0 (npm) | Available but NOT needed — CSS View Transitions API sufficient | No new dependency |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-13 | Codebase | WorkspaceContent manages lightbox state via `lightboxOpen`/`lightboxIndex`. Direct replacement point for detail-view. |
| 2026-03-13 | Codebase | LightboxModal has all actions (Variation, img2img, Upscale, Download, Delete) — refactorable to Toolbar+Popovers |
| 2026-03-13 | Codebase | `generations` table has NO `batch_id` column. `GenerationService.generate()` creates N rows sequentially — natural batch point for shared UUID. |
| 2026-03-13 | Codebase | AssistantService uses SSE streaming with events: `text-delta`, `tool-call-result`, `text-done`, `error`. Canvas chat extends with `canvas-generate`. |
| 2026-03-13 | Codebase | LangGraph agent has ReAct pattern with `assistant_node → tools_node → post_process_node → assistant_node`. Canvas agent follows same pattern. |
| 2026-03-13 | Codebase | Existing assistant chat UI (ChatThread, ChatInput, StreamingIndicator) in `components/assistant/`. Adaptable for canvas chat. |
| 2026-03-13 | Codebase | No animation library installed. Only CSS transitions via Tailwind classes. |
| 2026-03-13 | Codebase | `next.config.ts` has no experimental flags. Need to add `viewTransition: true`. |
| 2026-03-13 | Codebase | PromptArea is 1616 lines. img2img Popover reuses subsets (ReferenceBar, prompt fields) not the whole component. |
| 2026-03-13 | Web | Next.js 16 supports View Transitions API via experimental flag, integrates with React 19's `startViewTransition`. |
| 2026-03-13 | Web | CSS View Transitions API has 95%+ browser support (Chrome 111+, Safari 18+, Firefox 133+). |
| 2026-03-13 | Web | LangGraph 1.1.0 is latest on PyPI (2026-03-10), matches project requirement. |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| 1 | Wie wird die Animated Transition umgesetzt? (Discovery Open Question #5) | CSS View Transitions API via `document.startViewTransition()`. Next.js 16 experimental `viewTransition: true` flag. Graceful degradation fuer nicht-unterstuetzte Browser. |
| 2 | Separater Canvas-Agent oder existierenden Prompt-Assistant erweitern? | Separater LangGraph Graph. Unterschiedlicher System-Prompt (Editing-Kontext statt Prompt-Drafting), unterschiedliche Tools (generate_image statt draft_prompt), unterschiedlicher State. |
| 3 | Wie triggert der Chat-Agent Generierungen? | Via SSE `canvas-generate` Event. Agent entscheidet Intent + Parameter, Frontend empfaengt Event und ruft `generateImages()` Server Action auf. Einheitlicher Pfad fuer Chat und Tool-Popover. |
| 4 | batchId-Strategie fuer Sibling-Gruppierung? | Neues nullable UUID-Feld in `generations`. `GenerationService.generate()` erzeugt shared UUID pro Request. NULL fuer bestehende Daten = keine Siblings (korrekt). Index fuer performante Queries. |
| 5 | Model-Selector Scope? | Session-lokal in CanvasDetailContext. Initialisiert aus dem Model des geoeffneten Bildes. Aenderbar waehrend der Session. Auto-Switch bei nicht-img2img-faehigem Model. |
