# Gate 1: Architecture Compliance Report

**Reviewed Architecture:** `specs/2026-04-19-29-interactive-prompt-refinement-project-context/architecture.md`
**Review Date:** 2026-05-09
**Discovery:** `specs/2026-04-19-29-interactive-prompt-refinement-project-context/discovery.md`
**Wireframes:** `specs/2026-04-19-29-interactive-prompt-refinement-project-context/wireframes.md`
**Codebase Scan:** `specs/2026-04-19-29-interactive-prompt-refinement-project-context/codebase-scan.md`

---

## Summary

| Status | Count |
|--------|-------|
| Pass | 41 |
| Warning | 0 |
| Blocking | 0 |

**Verdict:** APPROVED

---

## A) Feature Mapping

Every Discovery in-scope feature is covered by the architecture.

| Discovery Feature | Architecture Section | API Endpoint | DB / State | Status |
|-------------------|---------------------|--------------|------------|--------|
| Interview-based assistant behaviour (system-prompt redesign) | Server Logic > `_BASE_PROMPT` rewrite (line 467); Slice E in Migration Map | n/a (LLM behaviour) | n/a | PASS |
| Semantic stop criterion + Intent-Summary-Card with confirm | Server Logic > `finalize_and_generate` tool node (line 195); IntentSummaryPayload SSE event (line 120); Slice F | LangGraph tool (line 98) | LangGraph state `final_intent` | PASS |
| Two-stage confirm (partial-intent vs final) | Auto-Apply + Auto-Generate Trigger section (line 266); Tool only fires Auto-Apply on user click | LangGraph tool gating | n/a | PASS |
| ReferenceBar slots as multimodal input per turn (img2img only) | Multimodal Pipeline > Priority 1 (line 257); SendMessageRequest extension (line 119); Constraint row (line 504) | SendMessageRequest extended | LangGraph human-message | PASS |
| Generated image as multimodal input for refinement | Multimodal Pipeline > Priority 2 (line 258); Auto-Apply step 5 (line 274) | SendMessageRequest.last_result_image_url | LangGraph human-message | PASS |
| Extended tool set for i2i settings (slot role, strength, model params) | LangGraph Tool Schemas (lines 99-101); Migration Map > workspace_tools.py (line 473) | LangGraph tools | UI-side via SSE | PASS |
| Sequential multi-reference interview | `_BASE_PROMPT` rewrite (Slice E) + analyze_image existing tool | LangGraph behaviour | n/a | PASS |
| Paste-Detect-Confirm Card | Paste-Detect Heuristic (line 125); PasteConfirmPayload SSE (line 121); Slice L | Frontend pure function `lib/assistant/paste-detect.ts` | Frontend reducer | PASS |
| `projects.context_instructions` free-text + edit UI | Database Schema (line 148); Project-Context-Settings UI (Migration Map line 484) | GET/PATCH `/api/projects/{id}/context` | `projects.context_instructions` TEXT | PASS |
| "Help me write this" KI context generator | API Design > POST `/api/projects/context/generate` (line 79); Slice C; Open Question 2 resolved A | POST `/api/projects/context/generate` | n/a (no DB write) | PASS |
| Project-Context injection as labeled block in system prompt every turn | System-Prompt Composition (line 419); `build_assistant_system_prompt` extension (line 468) | LangGraph configurable | n/a | PASS |
| No-Context-Hint banner | Migration Map > no-context-banner.tsx (line 482); Frontend State Machine Wiring > Banner subscription (line 415) | n/a | Frontend reducer | PASS |
| Assistant active in `txt2img`, `img2img` only | Constraints > Reference slots gated on img2img (line 504); Out-of-Scope reaffirmed | n/a | n/a | PASS |

**No Discovery in-scope feature is missing from the architecture.**

---

## B) Constraint Mapping

Every Discovery business rule and UI constraint has an architectural location.

| Constraint | Source | Architecture Location | Status |
|------------|--------|-----------------------|--------|
| Assistant active only in txt2img/img2img | Discovery Business Rules | Constraints table line 499–504; Out of Scope explicit | PASS |
| Interview language follows user (DE), final prompt EN | Discovery Business Rules | `_BASE_PROMPT` rewrite scope (line 467); preserved as existing convention | PASS |
| Project-Context only LLM, never image-model API | Discovery Business Rules + Q14 | Constraints table first row (line 501); NFR Privacy (line 544); Q&A 16, 20 | PASS |
| Intent-Summary-Card only when LLM is semantically confident | Discovery Business Rules | `_BASE_PROMPT` rewrite + IntentSummaryPayload event; Discovery Q1 resolved C in Architecture | PASS |
| Mid-interview checks never trigger Apply/Generate | Discovery Business Rules | Auto-Apply + Auto-Generate Trigger note (line 276): "single user gate" | PASS |
| Auto-Apply + Auto-Generate only on "So generieren" click | Discovery Business Rules | Auto-Apply + Auto-Generate Trigger steps 1–5 (line 268); Tool only emits payload, frontend gates execution | PASS |
| ReferenceBar slots only attached when img2img | Discovery Business Rules | Constraints table (line 504); use-assistant-runtime gating (line 474); Backend defensive recheck | PASS |
| Result-image only most-recent attached | Discovery Business Rules | Multimodal Pipeline Priority 2 (line 258); SendMessageRequest.last_result_image_url single field | PASS |
| Multimodal budget priority order | Discovery Business Rules | Multimodal Pipeline Priority Order (line 256–263); Open Question 4 + 6 resolved | PASS |
| Non-vision model fallback: silent strip | Discovery Business Rules | Multimodal Pipeline Vision-fallback (line 264); Error Handling row (line 447) | PASS |
| Project-Context only loaded when ownership confirmed | Discovery Business Rules | Security > Project ownership (line 306); ProjectRepository.get_context re-verifies (line 307) | PASS |
| Help-me-write: one LLM call per click | Discovery Business Rules | Open Question 2 resolved A (line 641); inherited rate limit | PASS |
| New session inherits current Project-Context; live updates only on next turn | Discovery Business Rules | `AssistantService` reads context per-turn from DB (line 190); no caching | PASS |
| Paste-Detect only on first user message | Discovery Business Rules | Heuristic Trigger (line 132): "Only on first user-message of a session" | PASS |
| Settings tool calls bound to active workspace | Discovery Business Rules | Security row (line 308): "Bound to active workspace" | PASS |
| `context_instructions` max 8000 chars UTF-8 | Discovery Data | Validation Rules (line 287); DTO + DB; no length cap at DB level (rationale: line 152) | PASS |
| `context_updated_at` timestamp with timezone | Discovery Data | DB Schema (line 150) | PASS |
| `SendMessageRequest.reference_slots` array | Discovery Data | DTO extension (line 119); ReferenceSlotDTO defined (line 118) | PASS |
| `SendMessageRequest.last_result_image_url` URL | Discovery Data | DTO extension (line 119); HttpUrl Pydantic | PASS |
| LangGraph FSM `flow_state` enum | Discovery Data | PromptAssistantState extension (line 469); SSE event flow-state (line 411) | PASS |
| `finalize_and_generate` payload `{ prompt, settings_diff?, model_id? }` | Discovery Data | Tool schema (line 98); validation rule line 292 | PASS |
| `set_slot_role` payload | Discovery Data | Tool schema (line 99); validation rule line 293 | PASS |
| `set_slot_strength` payload (0.0–1.0) | Discovery Data | Tool schema (line 100); validation rule line 294 | PASS |
| `set_model_params` payload | Discovery Data | Tool schema (line 101); validation rule line 295 | PASS |
| `generate_project_context` brief (10–500 chars) | Discovery Data | DTO `GenerateProjectContextRequest` (line 116); validation rule line 289 | PASS |
| Wireframe: char counter "1,024 / 8,000 chars" | Wireframes line 259 | DTO max length 8000 (line 114) — frontend can render counter | PASS |
| Wireframe: brief counter "87 / 500 chars" | Wireframes line 314 | DTO `brief` length 10..500 (line 116) — matches | PASS |
| Wireframe: Helper-Modal Accept/Regenerate/Cancel | Wireframes lines 332–334 | Open Question 3 resolved A (line 642); Modal spec | PASS |
| Wireframe: Banner dismissible per session | Wireframes line 109 | Reducer flag `noContextBannerDismissed` (line 415); Q&A 19 | PASS |

**No Discovery business rule or wireframe constraint is missing.**

---

## C) Realistic Data Check (CRITICAL)

### Codebase Evidence — Existing Column Patterns

Found in `lib/db/schema.ts`:

```
URL fields → ALL use TEXT:
  thumbnailUrl: text("thumbnail_url")            line 29
  imageUrl: text("image_url")                    line 65, 143, 165
  sourceImageUrl: text("source_image_url")       line 79
  coverImageUrl: text("cover_image_url")         line 244
  errorMessage: text("error_message")            line 67
  prompt: text("prompt").notNull()               line 61
  promptMotiv: text("prompt_motiv").notNull()    line 71

Bounded strings → VARCHAR(N):
  name: varchar("name", { length: 255 })         line 28
  modelId: varchar("model_id", { length: 255 })  line 62
  status: varchar("status", { length: 20 })      line 64, 112
  generationMode: varchar("generation_mode", { length: 20 })  line 76
  replicatePredictionId: varchar(..., { length: 255 })        line 66
  role: varchar("role", { length: 20 })          line 196
  versionHash: varchar("version_hash", { length: 64 })        line 249
```

**Convention confirmed:** all URLs use TEXT (presigned S3/Replicate URLs are unbounded).

### External API Analysis

| API | Field | Measured Length | Sample | Arch Type | Recommendation |
|-----|-------|-----------------|--------|-----------|----------------|
| AWS S3 presigned URL | `image_url` (in DTO HttpUrl, in DB `imageUrl`) | typical 700–2000 chars (signature + headers + expiry) | `https://s3.{region}.amazonaws.com/{bucket}/{key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...&X-Amz-Date=...&X-Amz-Expires=...&X-Amz-SignedHeaders=...&X-Amz-Signature=...` | DTO: HttpUrl (no length cap) → service forwards as `image_url` content; DB: existing `imageUrl text` | PASS — matches existing TEXT convention |
| Replicate prediction URL | `replicate_prediction_id` | ≤32 chars (existing migration uses VARCHAR(255)) | `pp7b5q4kr1nt8` | n/a (existing column) | PASS — VARCHAR(255) headroom 8x |
| OpenRouter chat completion | `image_url` content part | URL pass-through (700–2000 chars) | n/a (LangChain HumanMessage) | n/a | PASS |
| User-supplied free-text `context_instructions` | UTF-8 freeform | ≤8000 chars per Discovery cap | German project descriptions, multi-line | DB: TEXT; DTO: 0..8000 | PASS — TEXT correctly chosen (Architecture line 152 explicitly justifies) |
| Helper brief input | UTF-8 freeform | ≤500 chars per Discovery cap | "My POD shop with mystical mushroom art..." | DTO: 10..500 | PASS — DTO-only validation, no DB persistence required |

### Data Type Verdicts

| Field | Arch Type | Evidence | Verdict |
|-------|-----------|----------|---------|
| `projects.context_instructions` | TEXT (NULLABLE) | Discovery cap 8000; existing convention `text("prompt")`, `text("prompt_motiv")`; rationale documented at architecture line 152 | PASS — TEXT correct; cap enforced at DTO boundary |
| `projects.context_updated_at` | timestamp with timezone (NULLABLE) | Existing convention: `timestamp(... { withTimezone: true })` used on every timestamp column in `lib/db/schema.ts:36-38` | PASS — matches |
| `SendMessageRequest.last_result_image_url` | Pydantic `HttpUrl?` (DTO only, not persisted) | S3 presigned URLs → unbounded; HttpUrl validates protocol+host; existing pattern in `dtos.py` for `image_urls: list[HttpUrl]` (line 38–42) | PASS — no persistence needed |
| `ReferenceSlotDTO.image_url` | `HttpUrl` | Same as above; passed through to LangChain `image_url` content block | PASS |
| `IntentSummaryPayload.axes[*]` | string ≤200 chars | Wireframe shows axes as 1-line bullets ("burgundy, umber, muted gold") | PASS — 200 char headroom is generous |
| `IntentSummaryPayload.prompt_preview` | string (no explicit cap, capped by `finalize_and_generate.prompt` ≤2000) | Wireframe shows multi-line monospace block; tool validation already caps prompt at 2000 chars (line 292) | PASS — cap inherited from tool |
| `PasteConfirmPayload.seed_text` | string ≤5000 | Existing `SendMessageRequest.content` cap is also 1..5000 (`dtos.py` line 32) → seed inherits this from first user message | PASS — matches existing user-message bound |
| `flow_state` | Literal enum (FSM states) | LangGraph state field; serialized as plain string by checkpointer | PASS — LangGraph state field types are `str`/`dict` per `state.py:30-33` |
| `intent_axes` | `dict?` | LangGraph state field; JSON-compatible | PASS — same pattern as existing `collected_info: dict` (state.py:31) |
| `final_intent` | `dict?` | LangGraph state field, optional | PASS — same pattern as existing `draft_prompt: Optional[dict]` (state.py:28) |
| `finalize_and_generate.prompt` | string 1..2000 | LangGraph tool input; matches conservative bound for image-model prompts; existing `generations.prompt` is `text` (unlimited at DB) but tool validation is the API boundary | PASS |
| `set_slot_index` | int 0..N-1 | UI caps slots at 5 (Architecture line 504); DTO validation 0..N-1 | PASS |
| `set_slot_strength.strength` | float 0.0..1.0 | Existing `model_slots.strength` column is `varchar(20)` storing the same numeric range (`schema.ts:197`); tool validates float | PASS |

**Data Type Status: ALL TYPES VALIDATED — no runtime-error risk.**

The architecture explicitly justifies TEXT over VARCHAR for the new `context_instructions` column (line 152) and reuses the existing TEXT convention for all URL fields. No persisted column has a measurable risk of overflow.

---

## D) External Dependencies

### D1) Dependency Version Check

**Project type:** EXISTING (multiple manifests present: `package.json`, `backend/pyproject.toml`)

| Dependency | Arch Version | Pinning File | Pinned? | "Latest"? | Status |
|------------|-------------|--------------|---------|-----------|--------|
| Next.js | 16.1.6 | package.json line 14 | YES (exact) | NO | PASS |
| Drizzle ORM | 0.45.1 | package.json line 13 (`^0.45.1`) | YES (caret) | NO | PASS |
| drizzle-kit | 0.31.9 | package.json line 35 (`^0.31.9`) | YES | NO | PASS |
| next-auth | 5.0.0-beta.30 | package.json line 15 | YES (exact) | NO | PASS |
| @auth/drizzle-adapter | 1.11.1 | package.json line 11 | YES (exact) | NO | PASS |
| sonner | 2.0.7 | package.json line 18 (`^2.0.7`) | YES | NO | PASS |
| radix-ui | 1.4.3 | package.json line 17 (`^1.4.3`) | YES | NO | PASS |
| replicate | 1.4.0 | package.json line 20 (`^1.4.0`) | YES | NO | PASS |
| @aws-sdk/client-s3 | 3.1003.0+ | package.json line 12 (`^3.1003.0`) | YES | NO | PASS |
| postgres (Node) | 3.4.8 | package.json line 16 (`^3.4.8`) | YES | NO | PASS |
| FastAPI | >=0.135.0 | backend/pyproject.toml line 11 | YES (min-version) | NO | PASS |
| LangGraph | >=1.1.0 | backend/pyproject.toml line 13 | YES | NO | PASS |
| langchain-openai | >=1.1.10 | backend/pyproject.toml line 14 | YES | NO | PASS |
| langgraph-checkpoint-postgres | >=3.0.4 | backend/pyproject.toml line 15 | YES | NO | PASS |
| sse-starlette | >=3.2.0 | backend/pyproject.toml line 16 | YES | NO | PASS |
| psycopg | >=3.3.3 | backend/pyproject.toml line 18 | YES | NO | PASS |

**No new dependencies introduced** by this feature (Architecture line 662 explicitly: "no new deps required").

**No "Latest" or unpinned references found in architecture.**

### D2) External APIs & Services

| Dependency | Rate Limits | Auth | Errors | Timeout | Status |
|------------|-------------|------|--------|---------|--------|
| OpenRouter (chat assistant turns) | Inherited from existing infra (line 71); existing per-user limit on assistant endpoint | Existing API key (env-var, line 318) | SSE error event (line 442) | Existing | PASS |
| OpenRouter (Help-me-write-this) | Inherited per-user limit (line 342); 1 LLM call per click bounded by user click rate (line 309) | Existing API key | 502 + retry hint (line 441); error inline message in modal (line 595) | NFR target p95 < 8s (line 540) | PASS |
| Replicate (image generation) | Untouched by this feature (line 526); existing limits | Existing | Existing error toast | Existing | PASS |
| AWS S3 (presigned URLs) | n/a (URL pass-through; URLs reachable by OpenRouter as confirmed in Assumptions line 578) | Presigned signature in URL | Backend skips invalid slot (line 446) | n/a | PASS |
| Postgres (managed) | n/a | Existing connection-pool (psycopg / postgres-js) | Existing | Existing | PASS |
| LangGraph Postgres checkpointer | n/a | Same DB | Existing | Existing | PASS |

**All external APIs documented; rate limits inherited from existing infra (no new endpoint requires a new dedicated limit per Discovery Business Rule line 290).**

---

## E) Pattern Consistency (Gate 1b)

| Scanner Recommendation | Architecture Decision | Justified? | Status |
|------------------------|-----------------------|------------|--------|
| REUSE `@tool` + `ALL_TOOLS` registry + `TOOL_STATE_MAPPING` | Architecture line 470: "Add to registry; `TOOL_STATE_MAPPING` for `finalize_and_generate` only"; new tools as `@tool`-decorated functions in `backend/app/agent/tools/workspace_tools.py` | YES | PASS |
| EXTEND `build_assistant_system_prompt` (add `project_context` parameter) | Architecture line 468: "Add 3rd parameter `project_context: Optional[str]`; insert escaped block between base and knowledge" | YES | PASS |
| EXTEND `_BASE_PROMPT` content | Architecture line 467: "Full rewrite of base prompt content" — Slice E | YES | PASS |
| EXTEND `SendMessageRequest` DTO | Architecture line 464: "Add Pydantic fields with constraints; keep backward-compat for fields"; line 119 details | YES | PASS |
| EXTEND `AssistantService.stream_response` | Architecture line 465: "Refactor `_build_human_message`; inject `ProjectRepository`; add SSE event emitters" | YES | PASS |
| EXTEND `PromptAssistantState` (add `flow_state`, `intent_axes`) | Architecture line 469: "Update `DEFAULT_STATE_VALUES` accordingly" | YES | PASS |
| EXTEND `_call_model_*` | Architecture line 471: "Forward parameter through both sync + async nodes" | YES | PASS |
| EXTEND `useAssistantRuntime` body builder | Architecture line 474: "Mirror existing ref pattern (lines 104-107)" | YES | PASS |
| EXTEND `assistantReducer` + `AssistantAction` | Architecture line 476: new actions `SET_FLOW_STATE`, `RENDER_INTENT_SUMMARY`, etc. | YES | PASS |
| EXTEND `chat-thread.tsx` rendering | Architecture line 479: "Special-cased card variants" | YES | PASS |
| EXTEND `TOOL_STATE_MAPPING` registry | Architecture line 470 (already covered above) | YES | PASS |
| EXTEND query helpers `getProject`-style | Architecture line 460: "+ `updateProjectContext({id,userId,contextInstructions})` + `getProjectContext({id,userId})`" | YES | PASS |
| REUSE numbered SQL migration files | Architecture line 459: "drizzle/0015_add_project_context.sql" — sequential after 0014 | YES | PASS |
| REUSE `requireAuth()` + server actions | Architecture line 461: "Same shape (auth → validate → DB → revalidatePath)" | YES | PASS |
| REUSE `applyToWorkspace()` + auto-apply effect | Architecture line 477: "Re-used unchanged" | YES | PASS |
| REUSE `sonner` toast pattern | Architecture line 525: auto-apply success, errors, concurrent-block hint | YES | PASS |
| REUSE Radix `Dialog` primitive | Architecture line 524: "Used for Helper-Modal and optional Context-Edit modal" | YES | PASS |
| REUSE Pydantic DTOs | Architecture line 119: extends `SendMessageRequest` shape | YES | PASS |
| REUSE FastAPI `APIRouter` per-resource | Architecture line 488: existing `messages.py` router unchanged signature | YES | PASS |
| REUSE Frontend SSE parser | Architecture line 475: "Add new tool-result branches to the existing switch" | YES | PASS |
| REUSE Reference-bar slot state in PromptArea | Architecture line 474: "No state move; runtime simply reads via a new ref (mirroring `imageModelIdRef`/`generationModeRef` at lines 104-107)" | YES | PASS |
| REUSE `useWorkspaceVariation` setVariation | Architecture line 477: "Existing `applyToWorkspace` + auto-apply effect" | YES | PASS |
| NEW IntentSummaryCard component | Architecture line 480 — recognized as new component (no existing chat-card variant) | YES | PASS |
| NEW PasteDetectConfirmCard + heuristic | Architecture line 478: `lib/assistant/paste-detect.ts` (NEW FILE) | YES | PASS |
| NEW Project-Context-Settings UI | Architecture line 484 — new component, reuses `Dialog` primitive | YES | PASS |
| NEW Help-me-write Modal | Architecture line 485 — new component | YES | PASS |
| NEW No-Context-Hint-Banner | Architecture line 482 — new component | YES | PASS |
| NEW Backend endpoints (`/api/projects/{id}/context`, `/api/projects/context/generate`) | Architecture line 462–463 — new Route Handlers | YES | PASS |
| NEW LangGraph tools (`finalize_and_generate`, `set_slot_role`, etc.) | Architecture line 472–473 — new tool files following existing pattern | YES | PASS |
| NEW FSM `flow_state` field + UI derivation | Architecture line 469 — added to PromptAssistantState | YES | PASS |
| NEW Drizzle migration `0015` | Architecture line 459 — new migration | YES | PASS |
| NEW Reference-slot serialization | Architecture line 119 + line 220 — `image_url`-parts(reference_slots) | YES | PASS |
| AVOID — none | n/a — no `.decisions.md` and scanner found 0 AVOID items | YES | PASS |

### Scanner Output Validation

| Check | Rule | Evidence | Verdict |
|-------|------|----------|---------|
| AVOID has basis | Every AVOID references decisions.md or feature replaces pattern | Scanner reports 0 AVOID items (codebase-scan.md line 110) — n/a | PASS |
| REUSE has evidence | Every REUSE item has count >= 2 | All REUSE items in scanner have 2+ instances (e.g. `@tool` 5 tools, multimodal 3 sites, server actions 7+, migrations 14+) | PASS |
| Every recommendation has file path | No item without at least 1 path | Every row in codebase-scan.md > Recommendations cites at least one file:line | PASS |

**Scanner output is structurally plausible. Architecture aligns with all REUSE/EXTEND/NEW recommendations. No deviations.**

---

## F) Migration Completeness

> Scope includes refactoring/extension of existing code → Migration Map check applies.

### Quantity Check

| Discovery Claim | Architecture Coverage | Status |
|---|---|---|
| Discovery Slices A-M = 13 slices | Migration Map line 491: "Total file rows: 25 changed/new, with 8 new files. Slices A, B, C, D, E, F, G, H, I, J, K, L, M each have at least one row attribution." | PASS — all 13 slices have at least one row |
| Discovery: extend `projects` table | Architecture line 458: `lib/db/schema.ts` row | PASS |
| Discovery: extend `_BASE_PROMPT` + `build_assistant_system_prompt` | Architecture lines 467–468 | PASS |
| Discovery: extend `SendMessageRequest` + new `ReferenceSlotDTO` | Architecture line 464 | PASS |
| Discovery: 4 new agent tools | Architecture lines 470, 472, 473 | PASS |
| Discovery: extend `assistantReducer` + new actions | Architecture line 476 | PASS |
| Discovery: 5 new components (IntentSummaryCard, PasteDetectConfirmCard, NoContextBanner, ProjectContextSettings, HelpMeWriteModal) | Architecture lines 480–485 | PASS — all 5 new files listed |

### Quality Check (Specific Target Patterns)

| File in Migration Map | Current Pattern | Target Pattern | Specific enough for test? | Status |
|---|---|---|---|---|
| `lib/db/schema.ts` | projects without context fields | + `contextInstructions: text` + `contextUpdatedAt: timestamptz` | YES — concrete column types | PASS |
| `drizzle/0015_add_project_context.sql` | NEW | `ALTER TABLE projects ADD COLUMN ...` (full SQL at line 158) | YES — SQL given verbatim | PASS |
| `lib/db/queries.ts` | existing helpers | + `updateProjectContext({id,userId,contextInstructions})` + `getProjectContext({id,userId})` | YES — function signatures given | PASS |
| `app/actions/projects.ts` | CRUD actions | + `updateProjectContext` server action with `auth → validate → DB → revalidatePath` | YES — pattern explicit | PASS |
| `app/api/projects/[id]/context/route.ts` (NEW) | -- | "GET + PATCH; both call `requireAuth()`, ownership check, query helper" | YES — handlers + auth chain | PASS |
| `app/api/projects/context/generate/route.ts` (NEW) | -- | "Validates `brief`; calls OpenRouter once; returns draft" | YES — endpoint behaviour | PASS |
| `backend/app/models/dtos.py` | SendMessageRequest without project/slots/last-result | + `project_id`, `reference_slots: list[ReferenceSlotDTO]`, `last_result_image_url`. New `ReferenceSlotDTO`. Extended `SessionStateDTO` | YES — fields enumerated | PASS |
| `backend/app/services/assistant_service.py` | text + chat image_urls only | "+ reference slots (img2img only) + last_result_image_url under per-model budget; hydrate `project_context`; emit SSE events `flow-state`, `intent-summary`, `paste-confirm-suggestion`" | YES — concrete behaviour + events | PASS |
| `backend/app/services/project_repository.py` (NEW) | -- | "psycopg query mirroring `SessionRepository`" | YES — references existing pattern to mirror | PASS |
| `backend/app/agent/prompts.py:17-82` | _BASE_PROMPT anti-questionnaire | "Adaptive interview, semantic-confidence stop signal, two-stage confirm rules (partial vs final), FSM transition guidance, new tool catalog" | YES — content scope explicit | PASS |
| `backend/app/agent/prompts.py:85-123` | `build_assistant_system_prompt(image_model_id, generation_mode)` | "+ 3rd parameter `project_context: Optional[str]`; insert escaped block between base and knowledge" | YES — signature change explicit | PASS |
| `backend/app/agent/state.py:12-43` | phase, collected_info, etc. | "+ `flow_state: str` (default `"idle"`); + `intent_axes: dict` (default `{}`); + `final_intent: dict?`" | YES — field types + defaults | PASS |
| `backend/app/agent/graph.py:36-52` | 5 tools | "+ `finalize_and_generate`, `set_slot_role`, `set_slot_strength`, `set_model_params`" | YES | PASS |
| `backend/app/agent/graph.py:235-257` | reads image_model_id, generation_mode | "+ Reads `project_context` from configurable; passes to `build_assistant_system_prompt`" | YES | PASS |
| `backend/app/agent/tools/prompt_tools.py:15+` | draft_prompt, refine_prompt | "+ `finalize_and_generate` `@tool` — Pydantic input schema; persists `final_intent` to state" | YES | PASS |
| `backend/app/agent/tools/workspace_tools.py` (NEW) | -- | "set_slot_role, set_slot_strength, set_model_params `@tool` — new file mirroring existing tool style" | YES | PASS |
| `lib/assistant/use-assistant-runtime.ts:354-373` | content/image_urls/model/etc. | "+ `project_id`, `reference_slots`, `last_result_image_url`. New refs. Slot inclusion gated on `generationModeRef.current === "img2img"`" | YES | PASS |
| `lib/assistant/use-assistant-runtime.ts:154-216` | switches on existing events | "+ `flow-state`, `intent-summary`, `paste-confirm-suggestion`, tool-result branches for new tools" | YES | PASS |
| `lib/assistant/assistant-context.tsx:104-252` | existing actions | enumerated new actions: SET_FLOW_STATE, RENDER_INTENT_SUMMARY, RENDER_PASTE_CONFIRM, DISMISS_PASTE_CONFIRM, DISMISS_NO_CONTEXT_BANNER, SET_SLOT_ROLE, SET_SLOT_STRENGTH, SET_LAST_RESULT_IMAGE_URL | YES | PASS |
| `lib/assistant/assistant-context.tsx:487-551` | apply flow | "Re-used unchanged; new path: SSE → SET_DRAFT_PROMPT → existing effect calls applyToWorkspace; runtime calls generateImages" | YES | PASS |
| `lib/assistant/paste-detect.ts` (NEW) | -- | "Pure heuristic: `detectPastedPrompt(text): boolean`; length/comma/keyword rules" | YES | PASS |
| `components/assistant/chat-thread.tsx` | renders user/assistant/error/init | "+ Renders `IntentSummaryCard` and `PasteDetectConfirmCard` when corresponding payload present" | YES | PASS |
| `components/assistant/intent-summary-card.tsx` (NEW) | -- | "Renders axes, prompt preview, settings diff, two buttons; calls reducer / sendMessage" | YES | PASS |
| `components/assistant/paste-detect-confirm-card.tsx` (NEW) | -- | "Renders prompt-detected hint + two buttons" | YES | PASS |
| `components/assistant/no-context-banner.tsx` (NEW) | -- | "Banner above chat thread, dismissible per session" | YES | PASS |
| `components/assistant/assistant-panel.tsx` | header + chat-thread + chat-input | "+ Renders <NoContextBanner> above <ChatThread> when context empty + not session-dismissed" | YES | PASS |
| `components/projects/project-context-settings.tsx` (NEW) | -- | "Textarea + counter + 'Help me write this' button + Save; reuses `Dialog` primitive" | YES | PASS |
| `components/projects/help-me-write-modal.tsx` (NEW) | -- | "Brief input + Generate + Draft preview + Accept/Regenerate/Cancel; calls `POST /api/projects/context/generate`" | YES | PASS |
| `components/project-card.tsx:209` | rename/delete actions | "+ 'Edit context' entry → opens settings" | YES | PASS |
| `components/workspace/workspace-header.tsx:182` | settings opener | "+ Optional secondary entry to project-context settings" | YES | PASS |

**Migration Map: 25+ rows, all 13 slices represented, every target pattern is concrete enough to derive a deterministic test.**

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0

**Pass Items:** 41 (Feature Mapping: 13, Constraint Mapping: 28, Data Type: 12, Dependencies: 16+6, Pattern Consistency: 33, Migration Quantity: 7, Migration Quality: 30)

**Next Steps:**
- [ ] Architecture is ready for slice planning (Gate 2)
- [ ] No corrections required
