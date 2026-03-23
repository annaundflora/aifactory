# Codebase Scan

**Feature:** Model-Aware Prompt Knowledge System
**Scan-Datum:** 2026-03-23
**Discovery:** `specs/phase-7/2026-03-22-prompt-knowledge-system/discovery.md`

---

## Identified Patterns

| # | Pattern | Locations | Count | Type |
|---|---------|-----------|-------|------|
| 1 | Static System-Prompt with Model Hints | `lib/services/prompt-service.ts:6-36` | 1 | EXTEND |
| 2 | Dynamic System-Prompt Injection (Context-aware) | `backend/app/agent/canvas_graph.py:160-240` | 1 | REUSE |
| 3 | Static System-Prompt (no model awareness) | `backend/app/agent/prompts.py:7-73`, `backend/app/agent/graph.py:237` | 1 | EXTEND |
| 4 | Keyword-based Model Matching Rules | `backend/app/agent/tools/model_tools.py:29-60` | 1 | EXTEND |
| 5 | Model-ID based Capability Detection | `lib/services/capability-detection.ts:31-57`, `lib/services/capability-detection.ts:177-224` | 2 | REUSE |
| 6 | Model-ID to Display Name Transformation | `lib/utils/model-display-name.ts:13-23` | 1 | REUSE |
| 7 | LangGraph Agent State Extension | `backend/app/agent/state.py:12-43`, `backend/app/agent/canvas_graph.py:44-57` | 2 | REUSE |
| 8 | Server Action passthrough (prompt + modelId) | `app/actions/prompts.ts:68-99` | 1 | EXTEND |
| 9 | Config-based Runtime Injection (configurable dict) | `backend/app/agent/graph.py:235-247`, `backend/app/agent/canvas_graph.py:304-328` | 2 | REUSE |
| 10 | GenerationMode Type System | `lib/types.ts:21-28` | 1 | REUSE |
| 11 | Workspace State (modelId, targetMode available) | `lib/workspace-state.tsx:10-22`, `components/workspace/prompt-area.tsx:134,1000` | 2 | REUSE |

---

## Existing Abstractions

| Abstraction | Location | Used by | Recommendation | Rationale |
|-------------|----------|---------|----------------|-----------|
| `buildSystemPrompt()` | `lib/services/prompt-service.ts:6` | 1 Stelle (Improver) | EXTEND | Contains static model hints that will be replaced by Knowledge-Datei lookup |
| `build_canvas_system_prompt()` | `backend/app/agent/canvas_graph.py:160` | 1 Stelle (Canvas Agent) | REUSE | Established pattern for dynamic system-prompt injection with context dict; same pattern needed for Assistant |
| `SYSTEM_PROMPT` (static constant) | `backend/app/agent/prompts.py:7` | 1 Stelle (Assistant graph.py:237) | EXTEND | Must become dynamic function like canvas pattern to accept model context |
| `_MATCHING_RULES` | `backend/app/agent/tools/model_tools.py:29` | 1 Stelle (recommend_model) | EXTEND | Static rules that will be enriched with knowledge data |
| `modelIdToDisplayName()` | `lib/utils/model-display-name.ts:13` | 2 Stellen (prompt-service.ts, prompt-area.tsx) | REUSE | Simple utility, reusable as-is |
| `detectCapabilities()` | `lib/services/capability-detection.ts:177` | 1 Stelle (generation-service.ts) | REUSE | Pattern for model-ID-based logic; prefix-matching follows similar approach |
| `GenerationMode` type | `lib/types.ts:21` | 12+ Stellen (components, services, tests) | REUSE | Well-established type, use directly for mode parameter |
| `RunnableConfig["configurable"]` | `backend/app/agent/graph.py:158-163`, `backend/app/agent/canvas_graph.py:310-311` | 2 Stellen (Assistant + Canvas) | REUSE | Established pattern for passing per-request context to LangGraph agents |
| `WorkspaceVariationState` | `lib/workspace-state.tsx:10-22` | 3+ Stellen (workspace, canvas, assistant) | REUSE | Contains modelId and targetMode; source for generationMode at improve trigger |

---

## Recommendations

### REUSE (bestehende Abstraktion wiederverwenden)

| # | What | Where | Why |
|---|------|-------|-----|
| 1 | Dynamic system-prompt injection pattern (build function + context dict) | `backend/app/agent/canvas_graph.py:160-240` | Canvas Chat already implements the exact pattern needed: build a system prompt at runtime from a context dict passed via `config["configurable"]`. Apply same pattern to Assistant. |
| 2 | `RunnableConfig["configurable"]` for per-request context injection | `backend/app/agent/graph.py:158-163` | Both agents already use configurable dict to pass thread_id, model, image_context. Adding `image_model_id` and `generation_mode` follows the same pattern. |
| 3 | `GenerationMode` type for mode parameter | `lib/types.ts:21` | Well-established type used across 12+ files. Use directly for the new `generationMode` parameter in improvePrompt. |
| 4 | `modelIdToDisplayName()` utility | `lib/utils/model-display-name.ts:13` | Already used by prompt-service.ts. Can continue to be used alongside new knowledge data. |
| 5 | `WorkspaceVariationState.modelId` + `currentMode` for data availability | `lib/workspace-state.tsx:14`, `components/workspace/prompt-area.tsx:134,1000` | Both `modelId` (resolved) and `currentMode` (GenerationMode) are already available at the LLMComparison call site. No new data plumbing needed to pass them to the improve action. |
| 6 | LangGraph Agent State extension pattern | `backend/app/agent/state.py:12-43` | Established pattern for extending AgentState with custom fields. Can be reused if additional state fields are needed. |

### EXTEND (bestehende Abstraktion erweitern)

| # | What | Where | Extension needed |
|---|------|-------|------------------|
| 1 | `buildSystemPrompt(modelId, modelDisplayName)` | `lib/services/prompt-service.ts:6` | Add `generationMode` parameter. Replace static model hints (lines 25-31) with knowledge lookup. Load `prompt-knowledge.json`, match by model-ID prefix, inject model+mode section. |
| 2 | `SYSTEM_PROMPT` static constant -> dynamic function | `backend/app/agent/prompts.py:7` | Convert from constant to function `build_assistant_system_prompt(image_model_id, generation_mode)` following the `build_canvas_system_prompt()` pattern. Inject knowledge section. |
| 3 | `build_canvas_system_prompt(image_context)` | `backend/app/agent/canvas_graph.py:160` | Add knowledge injection: use `model_id` from `image_context` to look up knowledge and append prompting tips to the context section. |
| 4 | `_MATCHING_RULES` + `_match_model()` | `backend/app/agent/tools/model_tools.py:29-104` | Enrich matching rules with model strengths from knowledge data. Improve reason strings with model-specific capabilities. |
| 5 | `improvePrompt` action + `PromptService.improve()` | `app/actions/prompts.ts:68-99`, `lib/services/prompt-service.ts:44` | Add `generationMode` as new parameter through the chain: action -> service -> buildSystemPrompt. |
| 6 | `SendMessageRequest` DTO | `backend/app/models/dtos.py:21` | Add optional `image_model_id` and `generation_mode` fields for passing current workspace context to the Assistant agent. |
| 7 | `AssistantService.stream_response()` | `backend/app/services/assistant_service.py:117` | Pass new fields (`image_model_id`, `generation_mode`) through to `config["configurable"]` for system prompt injection. |

### NEW (neue Implementierung noetig)

| # | What | Why new |
|---|------|---------|
| 1 | `/data/prompt-knowledge.json` Knowledge-Datei | No data directory or knowledge file exists. Must be created with the full model/mode knowledge structure. No existing JSON data files in the project serve a similar purpose. |
| 2 | TypeScript Knowledge Lookup function (prefix matching + fallback) | No prefix-matching lookup utility exists. `capability-detection.ts` uses field-name-based detection, not prefix matching. `model-display-name.ts` uses simple string split. A new `getPromptKnowledge(modelId, mode)` function is needed. |
| 3 | Python Knowledge Lookup function (prefix matching + fallback) | Same lookup logic needed on the Python side. No shared knowledge loading mechanism exists in the backend. Must load JSON and implement longest-prefix-match. |

### AVOID (bekannte Schuld, nicht replizieren)

| # | What | Decision Log Entry | Alternative |
|---|------|--------------------|-------------|
| 1 | Static inline model hints in system prompt | Feature replaces this (lines 25-31 in prompt-service.ts) | Knowledge-Datei lookup with dynamic injection |

---

## Conventions Detected

| Convention | Evidence | Count |
|------------|----------|-------|
| `@/` path alias for imports (TypeScript) | `lib/services/prompt-service.ts:1-2`, `lib/services/generation-service.ts:2-3`, `components/prompt-improve/llm-comparison.tsx:5-13` | 30+ files |
| `from app.` absolute imports (Python) | `backend/app/agent/graph.py:26-32`, `backend/app/agent/canvas_graph.py:33-34`, `backend/app/services/assistant_service.py:22-32` | 30+ files |
| Service-as-singleton pattern (Python) | `backend/app/routes/messages.py:16`, `backend/app/routes/canvas_sessions.py:33` | 2 files |
| Namespace export pattern (TypeScript services) | `lib/services/prompt-service.ts:62-64` (`PromptService = { improve }`) | 1 file |
| Pydantic DTOs for API request validation | `backend/app/models/dtos.py:21-50`, `backend/app/routes/canvas_sessions.py:41-100` | 2 files |
| German user-facing strings, English code/comments | `backend/app/agent/prompts.py`, `backend/app/agent/canvas_graph.py:174-209` | 5+ files |
| `"use server"` for Next.js Server Actions | `app/actions/prompts.ts:1` | 1 file |
| System prompt as string literal (not template file) | `backend/app/agent/prompts.py:7`, `backend/app/agent/canvas_graph.py:174` | 2 files |
| LangGraph ReAct pattern: assistant -> tools -> post_process -> assistant | `backend/app/agent/graph.py:253-281`, `backend/app/agent/canvas_graph.py:333-355` | 2 files |
| Tool result via `@tool` decorator (LangChain) | `backend/app/agent/tools/model_tools.py:137`, `backend/app/agent/tools/prompt_tools.py` | 4 files |

---

## Key Integration Points

| Integration | Current Location | Impact of Feature |
|-------------|------------------|-------------------|
| Improver system prompt construction | `lib/services/prompt-service.ts:6-36` | Static hints replaced by knowledge lookup; new `generationMode` parameter added |
| Improver action parameter flow | `app/actions/prompts.ts:68-99` -> `lib/services/prompt-service.ts:44` | Must add `generationMode` to the action input and pass through to service |
| Improver UI call site | `components/workspace/prompt-area.tsx:999-1014` | `currentMode` (GenerationMode) already available at line 134; must be passed to LLMComparison |
| Assistant system prompt injection | `backend/app/agent/graph.py:235-247` | Static `SYSTEM_PROMPT` must become dynamic; read model context from `config["configurable"]` |
| Assistant message API | `backend/app/models/dtos.py:21-50`, `backend/app/routes/messages.py:20` | `SendMessageRequest` needs optional `image_model_id` + `generation_mode` fields |
| Assistant service config passthrough | `backend/app/services/assistant_service.py:158-163` | Must forward new fields to `config["configurable"]` |
| Canvas Chat system prompt builder | `backend/app/agent/canvas_graph.py:160-240` | Must load knowledge for `model_id` from `image_context` and inject prompting tips |
| Canvas Chat model_id source | `backend/app/routes/canvas_sessions.py:57` (CanvasImageContext.model_id) | model_id already available in image_context; no plumbing change needed |
| recommend_model matching logic | `backend/app/agent/tools/model_tools.py:63-104` | Matching rules enriched from knowledge data; reasons made more specific |
| Frontend assistant message sending | `lib/assistant/assistant-context.tsx:77,243` | Must send `image_model_id` + `generation_mode` alongside content/image_urls/model |

---

## Decision Log Context

> No .decisions.md found at `/home/dev/aifactory/worktrees/prompt-knowledge-system/.decisions.md`.

---

## Scan Summary

| Metric | Value |
|--------|-------|
| Patterns found | 11 |
| REUSE recommendations | 6 |
| EXTEND recommendations | 7 |
| NEW recommendations | 3 |
| AVOID recommendations | 1 |
| Decision Log entries | 0 |
