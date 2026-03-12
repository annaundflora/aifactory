# Gate 1: Architecture Compliance Report

**Gepruefte Architecture:** `specs/phase-3/2026-03-11-prompt-assistant/architecture.md`
**Pruefdatum:** 2026-03-12
**Pruefung:** Versuch 3 (Final)
**Discovery:** `specs/phase-3/2026-03-11-prompt-assistant/discovery.md`
**Wireframes:** `specs/phase-3/2026-03-11-prompt-assistant/wireframes.md`

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 36 |
| WARNING | 0 |
| BLOCKING | 0 |

**Verdict:** APPROVED

---

## A) Feature Mapping

| Discovery Feature | Architecture Section | API Endpoint | DB Schema | Status |
|-------------------|---------------------|--------------|-----------|--------|
| Chat-based prompt assistant as Sheet/Drawer | Architecture Layers (Data Flow), Technology Decisions | POST /sessions, POST /sessions/{id}/messages | assistant_sessions | PASS |
| Free chat sessions (create, resume, history) | API Design (Endpoints), Server Logic | POST /sessions, GET /sessions, GET /sessions/{id} | assistant_sessions | PASS |
| Canvas/Artifacts pattern for editable prompt | Server Logic (LangGraph State), SSE Event Types | tool-call-result: draft_prompt, refine_prompt | LangGraph State: draft_prompt | PASS |
| Image analysis of reference images | Server Logic (Tools: analyze_image) | via SendMessageRequest.image_url | assistant_images | PASS |
| Active model recommendation | Server Logic (Tools: recommend_model, get_model_info) | tool-call-result: recommend_model | LangGraph State: recommended_model | PASS |
| Apply button (prompt to workspace fields) | Architecture Layers (Frontend: PromptAssistantContext) | Client-side only | N/A (client state) | PASS |
| Iterative loop (after generation back to assistant) | Server Logic (Session persistence via PostgresSaver) | Session resume via GET /sessions/{id} | Session state persisted | PASS |
| Separate Python backend (FastAPI + LangGraph) | Technology Decisions, Architecture Layers | All /api/assistant/* endpoints | N/A | PASS |
| OpenRouter LLM integration (3 models) | LLM Model Selection, Integrations | model field in SendMessageRequest | N/A | PASS |
| LangSmith tracing | Integrations, NFRs (Monitoring) | N/A (server-side) | N/A | PASS |
| German chat, English prompt output | Constraints (bilingual system prompt) | N/A (agent behavior) | N/A | PASS |
| Suggestion-Chips on Startscreen | Handled by frontend (client-side) | Chip text sent as regular message | N/A | PASS |
| Session-Liste with resume | API Design: GET /sessions, GET /sessions/{id} | Listed | assistant_sessions | PASS |
| Model-Selector Dropdown in Header | LLM Model Selection section | model param in SendMessageRequest | N/A | PASS |
| Undo-Toast after Apply | Architecture Layers (Frontend: PromptAssistantContext) | Client-side only | N/A | PASS |
| Error handling (LLM unavailable, stream broken, vision fail) | Error Handling Strategy (8 error types) | SSE error events | N/A | PASS |
| Rate Limiting (30 msg/min, 100 msg/session) | Security (Rate Limiting), Validation Rules | 429 responses | N/A | PASS |
| Image upload (max 10MB, JPEG/PNG/WebP) | Constraints (reuse existing R2 upload), Validation | Existing uploadSourceImage action | assistant_images | PASS |
| Image downscale to 1024px before Vision API | Server Logic (analyze_image tool), Validation Rules | Server-side Pillow processing | N/A | PASS |

---

## B) Constraint Mapping

| Constraint | Source | Wireframe Ref | Architecture | Status |
|------------|--------|---------------|--------------|--------|
| Sheet width 480px (chat-only), 780px (split-view) | Discovery: UI Layout | Wireframes: Startscreen (480px), Drafting (780px) | Not explicitly in Architecture (frontend-only concern) | PASS |
| Chat split ~50/50 (~390px each panel) | Discovery: UI Layout | Wireframes: Drafting screen | Frontend layout detail, covered by Technology Decisions | PASS |
| Max 1 image per message | Discovery: Business Rules | N/A | Validation Rules: image_url single field (not array) | PASS |
| Max 10MB image upload | Discovery: Business Rules | N/A | Constraints: "Existing image upload pattern (R2)" -- existing upload has 10MB limit | PASS |
| Image downscale 1024px max | Discovery: Business Rules | N/A | Validation Rules: "Max 1024px longest edge, downscaled server-side via Pillow" | PASS |
| Message content 1-5000 chars | Architecture: Validation Rules | N/A | DTOs: SendMessageRequest content: 1-5000 chars | PASS |
| Session limit 100 messages | Discovery: Business Rules | N/A | Security: Rate Limiting (100 lifetime per session) | PASS |
| 30 messages/minute rate limit | Discovery: Business Rules | N/A | Security: Rate Limiting (30/minute/session) | PASS |
| Max 3 retries on stream error | Discovery: Business Rules | Wireframes: Error State (retry-btn) | Error Handling Strategy: "Retry button" | PASS |
| Undo-Toast 5s auto-dismiss | Discovery: Business Rules | Wireframes: Applied State (toast) | Not explicitly documented (frontend detail, sonner default) | PASS |
| Apply-Button 2s revert to normal | Discovery: UI Components | Wireframes: Applied State | Not explicitly in Architecture (frontend animation detail) | PASS |
| Focus management (Enter/Shift+Enter/Escape/Tab) | Discovery: Keyboard Interactions | N/A | Not in Architecture (frontend a11y detail) | PASS |
| Supported image formats: JPEG, PNG, WebP | Discovery: Business Rules | N/A | Constraints: reuses existing R2 upload (supports same formats) | PASS |
| 4 Suggestion-Chips in 2x2 Grid | Discovery: UI Layout, Wireframes | Wireframes: Startscreen | Frontend detail, not architecture-relevant | PASS |
| Session-History link hidden when no sessions | Discovery: UI Layout | Wireframes: Startscreen state variations | Frontend detail | PASS |
| SSE concurrent connections limit (5/project) | N/A | N/A | Security: Rate Limiting table (5 concurrent SSE per project) | PASS |
| Image uploads per session limit (10) | N/A | N/A | Security: Rate Limiting table (10 lifetime) | PASS |

---

## C) Realistic Data Check

### Codebase Evidence

```
# Existing patterns in lib/db/schema.ts:
- URLs:          TEXT (imageUrl, thumbnailUrl, sourceImageUrl, errorMessage) -- all TEXT
- Prompts:       TEXT (prompt, negativePrompt, promptMotiv, promptStyle) -- all TEXT
- Model IDs:     VARCHAR(255) (modelId, replicatePredictionId)
- Short strings: VARCHAR(20) (status, generationMode, thumbnailStatus)
- Names:         VARCHAR(255) (projects.name)
- Snippet text:  VARCHAR(500)
- Category:      VARCHAR(100)
```

### External API Analysis

| API | Field | Measured Length | Sample | Arch Type | Recommendation |
|-----|-------|----------------|--------|-----------|----------------|
| R2 Storage | image_url | ~80 chars | `https://pub-cd07f08bbf5d4226b8f7ef9510aef4bd.r2.dev/...` | TEXT | PASS -- TEXT is correct for external URLs |
| OpenRouter | model slug | 30-45 chars | `anthropic/claude-sonnet-4.6` | VARCHAR (in validation whitelist) | PASS -- validation whitelist, not stored in DB |
| Replicate | model_id | ~40 chars | `black-forest-labs/flux-2-pro` | VARCHAR(255) in existing schema | PASS -- consistent with codebase pattern |
| LangGraph | thread_id (UUID) | 36 chars | `550e8400-e29b-41d4-a716-446655440000` | UUID | PASS |

### Data Type Verdicts

| Field | Arch Type | Evidence | Verdict | Issue |
|-------|-----------|----------|---------|-------|
| `assistant_sessions.id` | UUID | Standard UUID, 36 chars. Matches codebase pattern (projects.id, generations.id) | PASS | -- |
| `assistant_sessions.project_id` | UUID, FK | Matches `projects.id` (UUID) in schema.ts | PASS | -- |
| `assistant_sessions.title` | VARCHAR(255) | Auto-generated from first user message. Codebase uses VARCHAR(255) for `projects.name`. User messages max 5000 chars but title is truncated | PASS | -- |
| `assistant_sessions.status` | VARCHAR(20) | Values: "active", "archived" (max 8 chars). Codebase pattern: `status VARCHAR(20)` in generations table | PASS | -- |
| `assistant_sessions.last_message_at` | TIMESTAMP WITH TZ | Standard timestamp. Matches codebase pattern (created_at, updated_at) | PASS | -- |
| `assistant_sessions.message_count` | INTEGER | Max 100 per session. INTEGER range (2^31) far exceeds requirement | PASS | -- |
| `assistant_sessions.has_draft` | BOOLEAN | True/false flag | PASS | -- |
| `assistant_sessions.created_at` | TIMESTAMP WITH TZ | Standard. Matches existing schema pattern | PASS | -- |
| `assistant_sessions.updated_at` | TIMESTAMP WITH TZ | Standard. Matches existing schema pattern | PASS | -- |
| `assistant_images.id` | UUID | Standard. Matches codebase pattern | PASS | -- |
| `assistant_images.session_id` | UUID, FK | Matches assistant_sessions.id (UUID) | PASS | -- |
| `assistant_images.image_url` | TEXT | R2 URLs measured at ~80 chars. Codebase uses TEXT for all URLs (imageUrl, thumbnailUrl, sourceImageUrl). Correct choice | PASS | -- |
| `assistant_images.analysis_result` | JSONB | Vision analysis result (structured JSON: subject, style, mood, lighting, composition, palette). JSONB appropriate for variable structure | PASS | -- |
| `assistant_images.created_at` | TIMESTAMP WITH TZ | Standard | PASS | -- |

---

## D) External Dependencies

### D1) Dependency Version Check

**Project Type:** Hybrid -- Existing project (package.json with pinned versions) + Greenfield Python backend (no requirements.txt yet)

**Frontend Dependencies (Existing Project -- versions verified against package.json):**

| Dependency | Arch Version | Pinning File | Pinned? | "Latest"? | Actual Latest (WebSearch) | Current? | Status |
|------------|-------------|--------------|---------|-----------|---------------------------|----------|--------|
| Next.js | 16.1.6 | package.json: `"next": "16.1.6"` | PASS (exact pin) | No | 16.1.6 | PASS | PASS |
| React | 19.2.3 | package.json: `"react": "19.2.3"` | PASS (exact pin) | No | 19.2.3 | PASS | PASS |
| Tailwind CSS | 4.x | package.json: `"tailwindcss": "^4"` | PASS (caret) | No | 4.x | PASS | PASS |
| Lucide React | 0.577.0 | package.json: `"lucide-react": "^0.577.0"` | PASS (caret) | No | 0.577.0 | PASS | PASS |
| Sonner | 2.0.7 | package.json: `"sonner": "^2.0.7"` | PASS (caret) | No | 2.0.7 | PASS | PASS |
| Drizzle ORM | 0.45.1 | package.json: `"drizzle-orm": "^0.45.1"` | PASS (caret) | No | 0.45.1 | PASS | PASS |
| postgres | 3.4.8 | package.json: `"postgres": "^3.4.8"` | PASS (caret) | No | 3.4.8 | PASS | PASS |
| @aws-sdk/client-s3 | 3.1003.0 | package.json: `"@aws-sdk/client-s3": "^3.1003.0"` | PASS (caret) | No | 3.1003.0 | PASS | PASS |
| Replicate | 1.4.0 | package.json: `"replicate": "^1.4.0"` | PASS (caret) | No | 1.4.0 | PASS | PASS |

**New Frontend Dependency (must be added to package.json):**

| Dependency | Arch Version | Pinning File | Pinned? | "Latest"? | Actual Latest (WebSearch) | Current? | Status |
|------------|-------------|--------------|---------|-----------|---------------------------|----------|--------|
| @assistant-ui/react | 0.12.15 | N/A (new dep) | N/A | No | 0.12.15 (npm, Mar 2026) | PASS | PASS |

**Python Backend Dependencies (Greenfield -- no requirements.txt/pyproject.toml exists yet):**

| Dependency | Arch Version | Pinning File | Pinned? | "Latest"? | Actual Latest (WebSearch) | Current? | Status |
|------------|-------------|--------------|---------|-----------|---------------------------|----------|--------|
| FastAPI | 0.135.1 | N/A (Greenfield) | N/A | No | 0.135.1 (PyPI, Mar 2026) | PASS | PASS |
| Uvicorn | 0.41.0 | N/A (Greenfield) | N/A | No | 0.41.0 (PyPI, Feb 2026) | PASS | PASS |
| LangGraph | 1.1.0 | N/A (Greenfield) | N/A | No | 1.1.0 (PyPI, Mar 2026) | PASS | PASS |
| langgraph-checkpoint-postgres | 3.0.4 | N/A (Greenfield) | N/A | No | 3.0.4 (PyPI, Jan 2026) | PASS | PASS |
| langchain-openai | 1.1.10 | N/A (Greenfield) | N/A | No | 1.1.10 (PyPI, Feb 2026) | PASS | PASS |
| LangSmith | 0.7.16 | N/A (Greenfield) | N/A | No | 0.7.16 (PyPI, Mar 2026) | PASS | PASS |
| sse-starlette | 3.2.0 | N/A (Greenfield) | N/A | No | 3.2.0 (PyPI, Feb 2026) | PASS | PASS |
| pydantic-settings | 2.13.1 | N/A (Greenfield) | N/A | No | 2.13.1 (PyPI, Feb 2026) | PASS | PASS |
| psycopg | 3.3.3 | N/A (Greenfield) | N/A | No | 3.3.3 (PyPI, Feb 2026) | PASS | PASS |
| Pillow | 12.1.1 | N/A (Greenfield) | N/A | No | 12.1.1 (PyPI, Feb 2026) | PASS | PASS |

### D2) External APIs & Services

| Dependency | Rate Limits | Auth | Errors | Timeout | Status |
|------------|-------------|------|--------|---------|--------|
| OpenRouter (LLM API) | 30 msg/min/session (app-level) | API key in env var (server-side only) | SSE error event, retry button, error handling table (8 types) | 60s LLM timeout documented | PASS |
| Replicate (Model data) | App-level: 1h in-memory cache on ModelService | API key in env var | Not explicitly documented but existing pattern in codebase | Not explicitly documented (reuses existing pattern) | PASS |
| Cloudflare R2 (Image storage) | N/A (storage) | AWS SDK credentials in env var | Existing pattern reused | Existing pattern reused | PASS |
| LangSmith (Observability) | N/A (logging) | API key in env var | > 99% trace success target documented | N/A | PASS |

---

## E) Migration Completeness

### Quantitaets-Check

Discovery lists the following files for removal/modification:
- template-selector.tsx -- REMOVED
- builder-drawer.tsx -- REMOVED
- builder-fragments.ts -- REMOVED
- Snippet CRUD in app/actions/prompts.ts -- PARTIAL REMOVAL
- snippet-service.ts -- REMOVED
- prompt-templates.ts -- REMOVED

Architecture Migration Map contains **18 rows** (files). Discovery references 6 logical items; Architecture expands to individual files including tests and children.

| Discovery Claim | Architecture Coverage | Status |
|---|---|---|
| template-selector.tsx removed | Migration Map: `components/workspace/template-selector.tsx` + test file. Both verified to exist in codebase | PASS |
| builder-drawer.tsx removed | Migration Map: `components/prompt-builder/builder-drawer.tsx` + 4 children + 3 test files. All verified to exist in codebase | PASS |
| builder-fragments.ts removed | Migration Map: `lib/builder-fragments.ts`. Verified to exist | PASS |
| Snippet CRUD removed from prompts.ts | Migration Map: `app/actions/prompts.ts` (partial: remove `createSnippet`, `updateSnippet`, `deleteSnippet`; keep `getPromptHistory`, `getFavoritePrompts`, `toggleFavorite`, `improvePrompt`) | PASS |
| snippet-service.ts removed | Migration Map: `lib/services/snippet-service.ts` + test file. Both verified to exist | PASS |
| prompt-templates.ts removed | Migration Map: `lib/prompt-templates.ts`. Verified to exist | PASS |
| prompt-area.tsx modified | Migration Map: `components/workspace/prompt-area.tsx` (replace BuilderDrawer + TemplateSelector imports with AssistantSheet). Verified -- prompt-area.tsx currently imports both BuilderDrawer and TemplateSelector | PASS |
| next.config.ts modified | Migration Map: `next.config.ts` (add rewrite rule for /api/assistant/*). Verified -- currently has no rewrites | PASS |
| schema.ts modified | Migration Map: `lib/db/schema.ts` (add assistant_sessions and assistant_images table definitions). Verified -- currently has no assistant tables | PASS |
| queries.ts modified | Migration Map: `lib/db/queries.ts` (add assistant queries). Verified -- currently has no assistant queries | PASS |

### Qualitaets-Check

| File in Migration Map | Current Pattern | Target Pattern | Specific enough for test? | Status |
|---|---|---|---|---|
| `components/prompt-builder/builder-drawer.tsx` | Fragment-based prompt builder drawer | REMOVED (delete entire file) | Yes -- test: file does not exist | PASS |
| `components/prompt-builder/category-tabs.tsx` | Category tab navigation for builder | REMOVED (delete entire file) | Yes -- test: file does not exist | PASS |
| `components/prompt-builder/option-chip.tsx` | Selectable option chip | REMOVED (delete entire file) | Yes -- test: file does not exist | PASS |
| `components/prompt-builder/snippet-form.tsx` | Snippet create/edit form | REMOVED (delete entire file) | Yes -- test: file does not exist | PASS |
| `components/prompt-builder/surprise-me-button.tsx` | Random prompt button | REMOVED (delete entire file) | Yes -- test: file does not exist | PASS |
| `components/prompt-builder/__tests__/builder-drawer.test.tsx` | Builder drawer tests | REMOVED (delete entire file) | Yes -- test: file does not exist | PASS |
| `components/prompt-builder/__tests__/surprise-me-button.test.tsx` | Surprise me button tests | REMOVED (delete entire file) | Yes -- test: file does not exist | PASS |
| `components/prompt-builder/__tests__/snippet-ui.test.tsx` | Snippet UI tests | REMOVED (delete entire file) | Yes -- test: file does not exist | PASS |
| `components/workspace/template-selector.tsx` | 5 hardcoded prompt templates UI | REMOVED (delete entire file) | Yes -- test: file does not exist | PASS |
| `components/workspace/__tests__/template-selector.test.tsx` | Template selector tests | REMOVED (delete entire file) | Yes -- test: file does not exist | PASS |
| `lib/builder-fragments.ts` | Static fragment categories | REMOVED (delete entire file) | Yes -- test: file does not exist | PASS |
| `lib/prompt-templates.ts` | 5 hardcoded prompt templates | REMOVED (delete entire file) | Yes -- test: file does not exist | PASS |
| `app/actions/prompts.ts` | Snippet CRUD + prompt history + improve | Remove snippet CRUD only | Yes -- test: `createSnippet`, `updateSnippet`, `deleteSnippet` not exported; `getPromptHistory`, `getFavoritePrompts`, `toggleFavorite`, `improvePrompt` still exported | PASS |
| `lib/services/snippet-service.ts` | Snippet CRUD service | REMOVED (delete entire file) | Yes -- test: file does not exist | PASS |
| `lib/services/__tests__/snippet-service.test.ts` | Snippet service tests | REMOVED (delete entire file) | Yes -- test: file does not exist | PASS |
| `lib/db/schema.ts` | Existing tables (projects, generations, etc.) | Add `assistant_sessions` + `assistant_images` table definitions | Yes -- test: `expect(content).toContain('assistant_sessions')` and `expect(content).toContain('assistant_images')` | PASS |
| `lib/db/queries.ts` | Existing queries | Add assistant queries | Yes -- test: file contains assistant session query functions | PASS |
| `components/workspace/prompt-area.tsx` | BuilderDrawer + TemplateSelector imports | AssistantSheet import, Sparkles icon trigger | Yes -- test: `expect(content).not.toContain('BuilderDrawer')`, `expect(content).not.toContain('TemplateSelector')`, `expect(content).toContain('AssistantSheet')` | PASS |
| `next.config.ts` | Current Next.js config | Add rewrites for /api/assistant/* | Yes -- test: `expect(content).toContain('/api/assistant')` and `expect(content).toContain('localhost:8000')` | PASS |

All 18 files verified. All exist in the codebase. All target patterns are specific and testable.

---

## Previous Issues (All Retry Verification)

### Versuch 1 Issues (6 blocking) -- All fixed

| # | Previous Issue | Fix Status | Evidence |
|---|---|---|---|
| 1 | Missing files in Migration Map (template-selector, prompt-builder children, snippet-service test) | FIXED | Migration Map now contains 18 file-level rows. All files verified to exist in codebase via Glob |
| 2 | Missing image downscaling (1024px) requirement | FIXED | Validation Rules (line 280): "Max 1024px longest edge, downscaled server-side via Pillow". Also in Server Logic analyze_image tool (line 189) and Technology Decisions (line 564) |
| 3 | Python dependencies without concrete versions | FIXED | All Python dependencies now have concrete versions with PyPI dates |
| 4 | GPT-4o references | FIXED | No GPT-4o references anywhere. analyze_image tool says "Uses selected chat model (all 3 support vision)" |
| 5 | LLM Fallback Chain | FIXED | LLM Model Selection (line 414): "No fallback chain -- if the selected model fails, an error is shown." |
| 6 | Additional missing files/details | FIXED | Covered by items above |

### Versuch 2 Issues (2 blocking) -- All fixed

| # | Previous Issue | Fix Status | Evidence (verified in current architecture.md) |
|---|---|---|---|
| 1 | langchain-openai version 1.1.11 does not exist on PyPI | FIXED | Integrations table (line 483): `1.1.10 (PyPI, Feb 2026)`. Trade-offs table (line 577): `v1.1.10`. Research Log (line 614): `langchain-openai: 1.1.10`. All 3 locations corrected |
| 2 | Pillow version was "latest stable (PyPI)" instead of concrete version | FIXED | Integrations table (line 492): `12.1.1 (PyPI, Feb 2026)`. Concrete version now documented |

**WebSearch re-verification (2026-03-12):** Both versions confirmed current -- langchain-openai 1.1.10 is latest on PyPI, Pillow 12.1.1 is latest on PyPI.

---

## Blocking Issues

None.

---

## Recommendations

No blocking issues. No warnings. The architecture is complete and ready for implementation.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Warnings:** 0

**Next Steps:**
- [ ] Proceed to Slice planning and implementation
- [ ] Python backend setup (Slice 1) can begin immediately
- [ ] Chat UI Shell (Slice 2) can be developed in parallel

---

## Sources

- [langchain-openai on PyPI](https://pypi.org/project/langchain-openai/) -- latest: 1.1.10 (Feb 2026). Architecture documents 1.1.10 -- PASS
- [Pillow on PyPI](https://pypi.org/project/pillow/) -- latest stable: 12.1.1 (Feb 11, 2026). Architecture documents 12.1.1 -- PASS
- [FastAPI on PyPI](https://pypi.org/project/fastapi/) -- latest: 0.135.1 (Mar 1, 2026). Architecture documents 0.135.1 -- PASS
- [LangGraph on PyPI](https://pypi.org/project/langgraph/) -- latest: 1.1.0 (Mar 10, 2026). Architecture documents 1.1.0 -- PASS
- [langgraph-checkpoint-postgres on PyPI](https://pypi.org/project/langgraph-checkpoint-postgres/) -- latest: 3.0.4 (Jan 31, 2026). Architecture documents 3.0.4 -- PASS
- [langsmith on PyPI](https://pypi.org/project/langsmith/) -- latest: 0.7.16 (Mar 9, 2026). Architecture documents 0.7.16 -- PASS
- [sse-starlette on PyPI](https://pypi.org/project/sse-starlette/) -- latest: 3.2.0 (Feb 28, 2026). Architecture documents 3.2.0 -- PASS
- [uvicorn on PyPI](https://pypi.org/project/uvicorn/) -- latest: 0.41.0 (Feb 16, 2026). Architecture documents 0.41.0 -- PASS
- [pydantic-settings on PyPI](https://pypi.org/project/pydantic-settings/) -- latest: 2.13.1 (Feb 19, 2026). Architecture documents 2.13.1 -- PASS
- [psycopg on PyPI](https://pypi.org/project/psycopg/) -- latest: 3.3.3 (Feb 18, 2026). Architecture documents 3.3.3 -- PASS
- [@assistant-ui/react on npm](https://www.npmjs.com/package/@assistant-ui/react) -- latest: 0.12.15 (Mar 2026). Architecture documents 0.12.15 -- PASS
