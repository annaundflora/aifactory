# Gate 1: Architecture Compliance Report

**Gepruefte Architecture:** `specs/phase-4/2026-03-13-canvas-detail-view/architecture.md`
**Pruefdatum:** 2026-03-13
**Discovery:** `specs/phase-4/2026-03-13-canvas-detail-view/discovery.md`
**Wireframes:** `specs/phase-4/2026-03-13-canvas-detail-view/wireframes.md`

**Re-Check:** Previous verdict FAILED with 2 blocking issues. Both have been fixed.

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 29 |
| WARNING | 0 |
| BLOCKING | 0 |

**Verdict:** APPROVED

---

## A) Feature Mapping

| Discovery Feature | Architecture Section | API Endpoint | DB Schema | Status |
|---|---|---|---|---|
| Canvas-Detail-View (Fullscreen) | Scope, Architecture Layers, Data Flow | State toggle (no endpoint) | N/A (client state) | PASS |
| Animated Transition (Gallery <-> Detail) | Scope, Technology Decisions (CSS View Transitions API) | N/A | N/A | PASS |
| Photoshop-Toolbar (48px, vertical icons) | Architecture Layers (React Components Canvas) | N/A | N/A | PASS |
| Variation Tool (img2img on self, prompt_strength) | API Design (reuses generateImages), Business Logic Flow | `generateImages()` Server Action | N/A | PASS |
| img2img Tool (References + Prompt) | API Design (reuses generateImages), Migration Map (popover reuses ReferenceBar) | `generateImages()` Server Action | N/A | PASS |
| Upscale Tool (2x/4x) | API Design (reuses upscaleImage) | `upscaleImage()` Server Action | N/A | PASS |
| Download Tool | N/A (direct browser download) | N/A | N/A | PASS |
| Delete Tool + Confirmation | API Design (reuses deleteGeneration) | `deleteGeneration()` Server Action | N/A | PASS |
| Collapsible Details-Overlay | Architecture Layers (React Components) | N/A | N/A | PASS |
| Sibling-Thumbnails (batchId grouping) | DB Schema, New Endpoint getSiblingGenerations | `getSiblingGenerations(batchId)` Server Action | `generations.batch_id` UUID | PASS |
| Prev/Next Navigation | Architecture Layers, Context & Research | N/A (client-side from existing gallery data) | N/A | PASS |
| Chat-Panel (collapsible, resizable 320-480px) | API Design (new canvas endpoints), Architecture Layers | `/api/assistant/canvas/sessions`, `/api/assistant/canvas/sessions/{id}/messages` | Reuses `assistant_sessions` | PASS |
| Chat-Init with Bild-Kontext | DTOs (CanvasImageContext) | POST `/api/assistant/canvas/sessions` | N/A | PASS |
| Chat Clarification Flow (Chips) | Server Logic (CanvasAgentGraph) | SSE stream | N/A | PASS |
| Chat-Agent triggers Generation | Business Logic Flow, DTOs (CanvasGenerateEvent SSE) | SSE `canvas-generate` event -> frontend calls `generateImages()` | N/A | PASS |
| Undo/Redo Stack (client-only, max 20) | Architecture Layers (CanvasDetailContext), Trade-offs | N/A (client state) | N/A | PASS |
| Model-Selector im Header | Architecture Layers, Constraints | N/A (client state) | N/A | PASS |
| Keyboard-Shortcuts (Cmd+Z, Cmd+Shift+Z) | Discovery reference (Business Rules) | N/A | N/A | PASS |
| Loading-State during Generation | Error Handling Strategy | N/A | N/A | PASS |
| Error Paths (Toast, Chat error, Upscale disabled) | Error Handling Strategy (5 error types) | N/A | N/A | PASS |
| Chat Context Separator (bei Prev/Next) | Discovery reference | N/A | N/A | PASS |
| Chat New Session Button | API Design (reuses existing pattern) | POST `/api/assistant/canvas/sessions` | N/A | PASS |
| Gallery-View bleibt unveraendert | Scope (in scope) | N/A | N/A | PASS |
| Prompt-Panel bleibt in Gallery-View | Scope (in scope) | N/A | N/A | PASS |

---

## B) Constraint Mapping

| Constraint | Source | Wireframe Ref | Architecture | Status |
|---|---|---|---|---|
| Toolbar 48px breit | Discovery: UI Components | Wireframe: Toolbar Detail | Architecture Layers: CanvasToolbar | PASS |
| Chat-Panel resizable 320-480px | Discovery: UI Components | Wireframe: Canvas-Detail-View annotation 10 | Scope: "collapsible, resizable 320-480px" | PASS |
| Chat-Panel collapsed ~48px | Discovery: UI Components | Wireframe: Chat Panel Collapsed | Architecture: state variations | PASS |
| Undo-Stack max 20 Eintraege | Discovery: Business Rules | N/A | Constraints: "Undo/Redo is client-only", Risks: "Max 20 entries" | PASS |
| Only one Tool-Popover at a time | Discovery: Business Rules | N/A | State Machine reference | PASS |
| Prev/Next only mouse click, no keyboard arrows | Discovery: Business Rules | Wireframe: annotation 8 | Not explicitly constrained in Architecture but Discovery ref preserved | PASS |
| Keyboard shortcuts suppressed in input focus | Discovery: Business Rules | N/A | Discovery reference | PASS |
| Upscale hardcoded model (nightmareai/real-esrgan) | Discovery: Business Rules | N/A | Constraints: "Upscale uses hardcoded model" | PASS |
| Chat message content 1-5000 chars | Architecture: DTOs | N/A | Validation Rules: "1-5000 chars, non-empty" | PASS |
| Rate Limits: 30 msg/min, 100/session | Discovery: existing | N/A | Security: Rate Limiting table | PASS |
| Loading-State disables all inputs | Discovery: Business Rules | Wireframe: Loading State | Error Handling: "detail-generating" state | PASS |
| Generation timeout 60s | Architecture: NFRs | N/A | Quality Attributes: "< 60s" | PASS |
| Chat first-token < 2s | Architecture: NFRs | N/A | Quality Attributes: "First token < 2s" | PASS |
| SSE timeout 60s | Architecture: Error Handling | N/A | Error Handling: "SSE timeout (60s)" | PASS |
| Canvas API routes proxied via existing rewrite | Architecture: Constraints | N/A | Constraints: "Existing wildcard rewrite `/api/assistant/:path*` -> FastAPI already covers `/api/assistant/canvas/*`" | PASS |

---

## C) Realistic Data Check

### Codebase Evidence

```
# Existing patterns in lib/db/schema.ts:
- imageUrl: text("image_url")                    -- TEXT, no VARCHAR limit (R2 URLs)
- sourceImageUrl: text("source_image_url")       -- TEXT (same pattern)
- prompt: text("prompt")                         -- TEXT (user prompts, unbounded)
- negativePrompt: text("negative_prompt")        -- TEXT
- promptMotiv: text("prompt_motiv")              -- TEXT
- promptStyle: text("prompt_style")              -- TEXT
- errorMessage: text("error_message")            -- TEXT
- thumbnailUrl: text("thumbnail_url")            -- TEXT
- modelId: varchar("model_id", { length: 255 })  -- VARCHAR(255) for model IDs like "nightmareai/real-esrgan"
- status: varchar("status", { length: 20 })      -- VARCHAR(20) for "pending", "completed", "failed"
- name: varchar("name", { length: 255 })          -- VARCHAR(255) for project names
- replicatePredictionId: varchar("replicate_prediction_id", { length: 255 }) -- VARCHAR(255)
- role: varchar("role", { length: 20 })           -- VARCHAR(20) for "style", "content", etc.
- strength: varchar("strength", { length: 20 })   -- VARCHAR(20) for "subtle", "moderate", etc.
- title: varchar("title", { length: 255 })        -- VARCHAR(255) for session titles

# UUID pattern:
- All IDs: uuid("id") with gen_random_uuid()
- All foreign keys: uuid("project_id"), uuid("session_id"), etc.

# All URL fields use TEXT -- consistent pattern for external/R2 URLs

# Drizzle migration pattern (6 migrations exist):
- drizzle/0000_fine_killraven.sql through drizzle/0005_simple_human_torch.sql
- ALTER TABLE ADD COLUMN pattern used consistently
- Index creation via CREATE INDEX pattern
```

### External API Analysis

| API | Field | Measured Length | Sample | Arch Type | Recommendation |
|---|---|---|---|---|---|
| Cloudflare R2 | imageUrl | ~80-120 chars (CDN URL) | `https://pub-cd07f08bbf5d4226b8f7ef9510aef4bd.r2.dev/projects/{uuid}/{uuid}.png` | TEXT | PASS -- TEXT is correct, matches existing pattern |
| Replicate | replicatePredictionId | ~36 chars (UUID-like) | UUID format | VARCHAR(255) | PASS -- existing, sufficient |
| OpenRouter (LLM) | Chat responses | Unbounded (LLM output) | N/A | Not stored in new columns | PASS -- SSE stream, not persisted in new schema |
| Replicate API | Model IDs | ~20-50 chars | `nightmareai/real-esrgan`, `black-forest-labs/flux-2-max` | VARCHAR(255) | PASS -- existing, sufficient |

### Data Type Verdicts

| Field | Arch Type | Evidence | Verdict | Issue |
|---|---|---|---|---|
| `generations.batch_id` | UUID (nullable) | Architecture: "UUID DEFAULT NULL". Matches existing pattern: all IDs are UUID in schema (generations.id, projects.id, assistantSessions.id, referenceImages.id). Server-generated via `crypto.randomUUID()` in GenerationService. | PASS | None |
| `generations.image_url` | TEXT | Existing schema uses `text("image_url")`. Architecture: "TEXT column (R2 presigned URLs)". R2 CDN hostname alone is 56 chars. | PASS | None |
| `CanvasImageContext.image_url` | str (Pydantic HttpUrl) | DTO field, validated as HttpUrl. R2 URLs are ~80-120 chars. TEXT in DB. | PASS | None |
| `CanvasImageContext.prompt` | str (Pydantic) | DTO field. Prompts stored as TEXT in DB. No length limit needed for DTO passthrough. | PASS | None |
| `CanvasImageContext.model_id` | str (Pydantic) | DTO field. Model IDs are ~20-50 chars in practice. VARCHAR(255) in DB. | PASS | None |
| `CanvasImageContext.model_params` | dict (Pydantic) | DTO field. Stored as JSONB in DB. Matches existing `modelParams: jsonb("model_params")`. | PASS | None |
| `CanvasImageContext.generation_id` | str (Pydantic) | DTO field. UUID format (36 chars). | PASS | None |
| `CanvasSendMessageRequest.content` | str(1-5000) | DTO field. Max 5000 chars matches existing `SendMessageRequest.content` pattern in `backend/app/models/dtos.py` line 32-36 (same 1-5000 constraint). | PASS | None |
| `CanvasGenerateEvent.data.prompt` | str (SSE payload) | SSE event data. Prompt is TEXT in DB. No storage constraint on SSE payload. | PASS | None |
| `CanvasGenerateEvent.data.model_id` | str (SSE payload) | SSE event data. Model IDs fit VARCHAR(255). | PASS | None |

---

## D) External Dependencies

### D1) Dependency Version Check

**Project Type: Existing (package.json + pyproject.toml exist, versions pinned)**

| Dependency | Arch Version | Pinning File | Pinned? | "Latest"? | Status |
|---|---|---|---|---|---|
| Next.js | 16.1.6 (project, pinned) | package.json: `"next": "16.1.6"` | PASS (exact) | No | PASS |
| React | 19.2.3 (project, pinned) | package.json: `"react": "19.2.3"` | PASS (exact) | No | PASS |
| Tailwind CSS | 4.x (project `^4`) | package.json: `"tailwindcss": "^4"` | PASS (range) | No | PASS |
| tw-animate-css | ^1.4.0 | package.json: `"tw-animate-css": "^1.4.0"` | PASS (range) | No | PASS |
| Radix UI (via shadcn) | 1.4.3 (project, pinned) | package.json: `"radix-ui": "^1.4.3"` | PASS (range) | No | PASS |
| Drizzle ORM | 0.45.1 (project `^0.45.1`) | package.json: `"drizzle-orm": "^0.45.1"` | PASS (range) | No | PASS |
| Replicate | ^1.4.0 | package.json: `"replicate": "^1.4.0"` | PASS (range) | No | PASS |
| @aws-sdk/client-s3 | ^3.1003.0 | package.json: `"@aws-sdk/client-s3": "^3.1003.0"` | PASS (range) | No | PASS |
| Sonner | ^2.0.7 | package.json: `"sonner": "^2.0.7"` | PASS (range) | No | PASS |
| Lucide React | ^0.577.0 | package.json: `"lucide-react": "^0.577.0"` | PASS (range) | No | PASS |
| FastAPI | >=0.135.0 | pyproject.toml: `"fastapi>=0.135.0"` | PASS (range) | No | PASS |
| LangGraph | >=1.1.0 | pyproject.toml: `"langgraph>=1.1.0"` | PASS (range) | No | PASS |
| langchain-openai | >=1.1.10 | pyproject.toml: `"langchain-openai>=1.1.10"` | PASS (range) | No | PASS |
| langgraph-checkpoint-postgres | >=3.0.4 | pyproject.toml: `"langgraph-checkpoint-postgres>=3.0.4"` | PASS (range) | No | PASS |
| sse-starlette | >=3.2.0 | pyproject.toml: `"sse-starlette>=3.2.0"` | PASS (range) | No | PASS |

### D2) External APIs & Services

| Dependency | Rate Limits | Auth | Errors | Timeout | Status |
|---|---|---|---|---|---|
| Replicate API | "per account" (documented) | Via replicate client (API key in env) | Error Handling: "Generation failed" polling detects `status: "failed"` | 60s (NFR) | PASS |
| OpenRouter (LLM) | 30 msg/min, 100/session (app-level) | ChatOpenAI with base_url override, API key in env | Error Handling: 5 error types documented (timeout, connection, 429, 500, generic) | 60s SSE timeout | PASS |
| Cloudflare R2 | N/A (storage, no rate limit concern) | S3-compatible (env keys) | Error Handling: console.error on R2 failures, DB delete succeeds independently | N/A | PASS |

---

## E) Migration Completeness

### Quantitaets-Check

Discovery does not claim a specific number of files to migrate. The Architecture provides a Migration Map with 10 file entries to modify, 2 files to remove, and 8 files to keep/reuse. This is a feature addition with Lightbox replacement, not a numbered migration scope.

| Discovery Claim | Architecture Coverage | Status |
|---|---|---|
| "Lightbox ersetzen durch Canvas-Detail-View" | Migration Map: `workspace-content.tsx` (lightbox state -> detail-view state), `lightbox-modal.tsx` marked for removal | PASS |
| "batchId" in generations table | Migration Map: `schema.ts` (add column), `queries.ts` (add to CreateGenerationInput + createGeneration + new query), `generation-service.ts` (generate UUID per batch), `generations.ts` (pass-through) | PASS |
| "Backend Assistant erweitern" | Migration Map: `assistant_service.py` -> new CanvasAssistantService | PASS |
| "next.config.ts experimental flag + rewrite coverage" | Migration Map: explicit entry for viewTransition flag AND explicit note that existing rewrite covers canvas routes | PASS |
| "workspace-state.tsx new context" | Migration Map: explicit entry for CanvasDetailContext alongside existing WorkspaceVariationContext | PASS |

### Qualitaets-Check

| File in Migration Map | Current Pattern | Target Pattern | Specific enough for test? | Status |
|---|---|---|---|---|
| `components/workspace/workspace-content.tsx` | Lightbox state (lightboxOpen, lightboxIndex) + LightboxModal + LightboxNavigation | Detail-view state (detailViewOpen, currentGenerationId) + CanvasDetailView | Yes: test can check imports and state variables | PASS |
| `components/workspace/generation-card.tsx` | onClick opens lightbox | onClick opens CanvasDetailView (handler change in parent) | Yes: "No code change needed" -- testable via handler behavior | PASS |
| `lib/db/schema.ts` | No batchId | `batchId: uuid("batch_id")` nullable column with index | Yes: `expect(content).toContain('batch_id')` | PASS |
| `lib/db/queries.ts` | CreateGenerationInput without batchId, no sibling query | `CreateGenerationInput` with `batchId?: string`, `batchId: input.batchId ?? null` in createGeneration, new `getSiblingsByBatchId()` | Yes: test for interface field, insert value, and function export | PASS |
| `lib/services/generation-service.ts` | generate() without batchId | generate() with shared batchId (UUID) per request | Yes: test for UUID generation and pass to createGeneration | PASS |
| `app/actions/generations.ts` | No batchId pass-through | "No change needed" (service handles batchId internally) | Yes: verify no change needed | PASS |
| `next.config.ts` | No experimental flags, existing rewrite for `/api/assistant/:path*` | `experimental: { viewTransition: true }`. Rewrite confirmed to cover canvas routes. | Yes: `expect(content).toContain('viewTransition')` | PASS |
| `lib/workspace-state.tsx` | Only WorkspaceVariationContext | Add CanvasDetailContext alongside | Yes: test for new context export | PASS |
| `backend/app/agent/tools/prompt_tools.py` | Unchanged | Unchanged | Yes: no-op verification | PASS |
| `backend/app/services/assistant_service.py` | AssistantService for prompt assistant | New CanvasAssistantService extending same patterns | Yes: test for new class with SSE streaming | PASS |

---

## F) Previous Blocking Issues -- Re-Check

### Issue 1 (RESOLVED): CreateGenerationInput missing batchId field

**Previous Problem:** Migration Map for `lib/db/queries.ts` did not document adding `batchId` to `CreateGenerationInput` and `createGeneration()`.

**Fix Applied:** Architecture Migration Map line for `lib/db/queries.ts` now reads:
> `CreateGenerationInput` has no batchId, no sibling query | `CreateGenerationInput` with `batchId?: string`, new `getSiblingsByBatchId(batchId)` query | Add `batchId?: string` to `CreateGenerationInput`. Add `batchId: input.batchId ?? null` to `createGeneration()` values. Add `getSiblingsByBatchId()` query returning completed generations with same batchId.

**Verification:** The Specific Changes column now explicitly documents: (1) interface field addition, (2) insert value mapping, (3) new query function. All three changes required for the batchId data flow are covered.

**Status:** PASS

### Issue 2 (RESOLVED): Rewrite route coverage for canvas endpoints undocumented

**Previous Problem:** Architecture did not explicitly confirm that existing rewrite rule covers new `/api/assistant/canvas/*` routes.

**Fix Applied:** Two locations now document this:
1. Migration Map for `next.config.ts`: "Existing rewrite `/api/assistant/:path*` already covers new canvas endpoints (`/api/assistant/canvas/*`)."
2. Constraints table: "Existing wildcard rewrite `/api/assistant/:path*` -> FastAPI already covers `/api/assistant/canvas/*`. No config change needed."

**Verification:** Both the Migration Map (implementation guidance) and Constraints table (integration documentation) now explicitly confirm rewrite coverage. The slice-writer has clear evidence that no rewrite changes are needed.

**Status:** PASS

---

## Blocking Issues

None.

---

## Recommendations

No blocking recommendations. The architecture is complete and consistent.

Minor observations (non-blocking, informational only):

1. The `backend/app/main.py` currently registers routes under `prefix="/api/assistant"`. The new canvas routes (`/api/assistant/canvas/sessions` etc.) will need a new router registered with the same or extended prefix. The architecture documents this in the Server Logic section (CanvasAssistantService, FastAPI Routes Canvas) which is sufficient for the slice-writer.

2. The existing `SendMessageRequest` DTO in `backend/app/models/dtos.py` has `content: str(1-5000)` which matches the architecture's `CanvasSendMessageRequest` validation. The new DTO extends this pattern with `image_context` -- consistent and well-documented.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Warnings:** 0

**Next Steps:**
- [ ] Architecture is ready for slice planning
