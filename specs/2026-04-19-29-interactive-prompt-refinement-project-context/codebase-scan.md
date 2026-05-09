# Codebase Scan

**Feature:** Interactive Prompt Refinement in Assistant with Per-Project Context
**Scan Date:** 2026-05-09
**Discovery:** `specs/2026-04-19-29-interactive-prompt-refinement-project-context/discovery.md`

---

## Identified Patterns

| # | Pattern | Locations | Count | Type |
|---|---------|-----------|-------|------|
| 1 | LangGraph agent tool (`@tool` decorator + post-process state mapping) | `backend/app/agent/tools/prompt_tools.py:15`, `backend/app/agent/tools/image_tools.py:226`, `backend/app/agent/tools/model_tools.py`, `backend/app/agent/tools/search_tools.py`, `backend/app/agent/graph.py:36-52` | 5 tools | REUSE |
| 2 | System-prompt composition with optional knowledge appending | `backend/app/agent/prompts.py:85-123` (`build_assistant_system_prompt`) | 1 entry-point, called from `graph.py:241,253` | EXTEND |
| 3 | Multimodal `HumanMessage` with `image_url` parts | `backend/app/services/assistant_service.py:148-157`, `backend/app/agent/tools/image_tools.py:203-213`, `lib/assistant/use-assistant-runtime.ts:358-360` | 3 | REUSE |
| 4 | SSE event streaming (text-delta / tool-call-result / text-done / error) | `backend/app/services/assistant_service.py:175-231,267-300`, `lib/assistant/use-assistant-runtime.ts:45-86,154-216` | 2 (server + client) | REUSE |
| 5 | Apply-to-Workspace via `setVariation()` | `lib/assistant/assistant-context.tsx:487-522`, `lib/workspace-state.tsx` (consumer); read in `components/workspace/prompt-area.tsx` | 1 producer, multiple consumers | REUSE |
| 6 | Server Action with `requireAuth()` guard | `app/actions/projects.ts:36-138`, `app/actions/generations.ts`, `app/actions/references.ts`, `app/actions/model-slots.ts`, `app/actions/models.ts`, `app/actions/prompts.ts`, `app/actions/upload.ts`, `lib/auth/guard.ts:47-73` | 7+ action modules | REUSE |
| 7 | Drizzle schema field + numbered SQL migration | `lib/db/schema.ts:22-47` (projects), `drizzle/0001_*.sql` … `drizzle/0014_drop_model_slots_active.sql`, `drizzle.config.ts` | 15 migrations | REUSE |
| 8 | DB query helpers using `$inferSelect` types | `lib/db/queries.ts:1-65` | 7 typed exports | REUSE |
| 9 | Radix-based `Dialog` modal | `components/ui/dialog.tsx`, `components/settings/settings-dialog.tsx:359-394`, used by `components/workspace/workspace-header.tsx:182` | 2+ instances | REUSE |
| 10 | Radix-based `AlertDialog` confirm dialog | `components/ui/alert-dialog.tsx`, used by `components/project-card.tsx:209` | 2+ instances | REUSE |
| 11 | `sonner` toast with action button (undo/error pattern) | `lib/assistant/assistant-context.tsx:506-521`, `app/actions/projects.ts` (via toast), `components/settings/settings-dialog.tsx:159-168,196-247` | many | REUSE |
| 12 | ReferenceBar slots state in `PromptArea` | `components/workspace/prompt-area.tsx:165,225,239,263,283,288,300,312,342-345,386,440,458`, `components/workspace/reference-bar.tsx:71-80`, `lib/types/reference.ts:31-48` | 1 owner | REUSE (read-only access from runtime) |
| 13 | Forwarding workspace context (model id, mode) to backend via refs | `lib/assistant/use-assistant-runtime.ts:104-107,363-373`, `lib/assistant/assistant-context.tsx:290-293,574-575` | 1 | EXTEND |
| 14 | Pydantic DTO with field validation (`Field`, `Literal`) | `backend/app/models/dtos.py:21-59,67-94` | 6 DTOs | REUSE |
| 15 | LangGraph state extension via subclassing `AgentState` | `backend/app/agent/state.py:12-43` | 1 | EXTEND |
| 16 | FastAPI route module mounted via `APIRouter()` | `backend/app/routes/messages.py:13`, `backend/app/routes/sessions.py:26`, `backend/app/routes/canvas_sessions.py`, `backend/app/routes/health.py` | 4 | REUSE |
| 17 | Next.js `rewrites()` proxying `/api/assistant/:path*` to FastAPI | `next.config.ts:70-77` | 1 | REUSE |
| 18 | Reducer-based assistant state with action union | `lib/assistant/assistant-context.tsx:104-252` | 1 | EXTEND |
| 19 | Per-project Drizzle migration (e.g., adding columns) | `drizzle/0006_add_batch_id.sql`, `drizzle/0007_add_model_settings.sql`, `drizzle/0009_add_user_id.sql`, `drizzle/0011_add_models_table.sql`, `drizzle/0012_add_model_slots.sql`, `drizzle/0013_drop_prompt_style_negative.sql`, `drizzle/0014_drop_model_slots_active.sql` | 7+ examples | REUSE |
| 20 | Settings-Dialog open/close pattern via `open` + `onOpenChange` props | `components/settings/settings-dialog.tsx:31-34,359`, opener at `components/workspace/workspace-header.tsx:182` | 1 | REUSE |

---

## Existing Abstractions

| Abstraction | Location | Used by | Recommendation | Rationale |
|-------------|----------|---------|----------------|-----------|
| `build_assistant_system_prompt(image_model_id, generation_mode)` | `backend/app/agent/prompts.py:85-123` | Both sync + async assistant nodes in `backend/app/agent/graph.py:241,253` | EXTEND | Add `project_context` parameter; existing extension point already designed for additive injection. |
| `@tool`-decorated functions + `ALL_TOOLS` registry + `TOOL_STATE_MAPPING` | `backend/app/agent/graph.py:36-52`, `backend/app/agent/tools/*.py` | All 5 existing tools | REUSE | New tools (`finalize_and_generate`, `set_slot_role`, `set_slot_strength`, `set_model_params`) plug into the same registry without graph changes. |
| Multimodal `HumanMessage` builder | `backend/app/services/assistant_service.py:148-157` | All assistant turns | EXTEND | Add ReferenceBar-slot images + last-result-image to the same content list under budget rules. |
| `applyToWorkspace()` callback | `lib/assistant/assistant-context.tsx:487-522` | `prompt-area.tsx` via `useWorkspaceVariation` consumer | REUSE | `finalize_and_generate` tool result triggers `SET_DRAFT_PROMPT` → existing auto-apply effect (line 546-551) already calls this. |
| `setVariation()` from `useWorkspaceVariation` | `lib/workspace-state.tsx`, consumed in `assistant-context.tsx:496-500,512-516,532-536` and `components/workspace/prompt-area.tsx` | Apply + Undo + manual workspace changes | REUSE | Setter for promptMotiv/modelId/modelParams; new tool calls (set_model_params, etc.) can extend payload. |
| `sendMessage(content, imageUrls?)` runtime hook | `lib/assistant/use-assistant-runtime.ts:419-468` | `assistant-context.tsx`, `chat-input.tsx` | EXTEND | Body building at line 354-373 must accept `reference_slots` + `last_result_image_url` (per discovery DTO). |
| `requireAuth()` guard | `lib/auth/guard.ts:47-73` | All 7 server-action modules | REUSE | Used identically in new project-context server action. |
| `SessionRepository` (Drizzle access for assistant_sessions) | `backend/app/services/session_repository.py` (referenced in `routes/sessions.py:24,29`) | Sessions endpoints | REUSE | Pattern mirrored for project-context backend access. |
| Radix `Dialog` (modal shell) | `components/ui/dialog.tsx`, exemplar `components/settings/settings-dialog.tsx` | Settings, project-card delete | REUSE | Project-Context-Settings can be a modal using this primitive (or own route reusing the same primitives). |
| `sonner` toast with `action` slot | `lib/assistant/assistant-context.tsx:506-521` (undo), `components/settings/settings-dialog.tsx:159,196,205-218` | Many | REUSE | Save / Apply toasts for context-edit and finalize_and_generate auto-apply. |
| Frontend reducer action union + `dispatch` ref | `lib/assistant/assistant-context.tsx:104-127,212-247` | All assistant client logic | EXTEND | Add new action types: `SET_FLOW_STATE`, `SHOW_PASTE_CONFIRM`, `DISMISS_NO_CONTEXT_BANNER`, `RENDER_INTENT_SUMMARY`. |
| LangGraph state subclass with named fields | `backend/app/agent/state.py:12-43` | Whole agent | EXTEND | Add `flow_state` (FSM state) and possibly `intent_axes` to allow UI to derive state from checkpointer. |

---

## Recommendations

### REUSE (reuse existing abstraction)

| # | What | Where | Why |
|---|------|-------|-----|
| 1 | `@tool` decorator + `ALL_TOOLS` registration + `TOOL_STATE_MAPPING` | `backend/app/agent/graph.py:36-52`, `backend/app/agent/tools/*.py` | New tools (`finalize_and_generate`, `set_slot_role`, `set_slot_strength`, `set_model_params`) follow the exact existing shape: pure-Python `@tool` returning a dict; optional state-mapping entry if persistence needed. |
| 2 | Numbered SQL migration files emitted by drizzle-kit | `drizzle/0001_*.sql` … `drizzle/0014_*.sql`, `drizzle.config.ts:1-10` | Slice A migration for `context_instructions` + `context_updated_at` becomes `drizzle/0015_*.sql`, generated via standard drizzle-kit. |
| 3 | `requireAuth()` + server actions in `app/actions/` | `lib/auth/guard.ts`, `app/actions/projects.ts:36-138` | New server action `updateProjectContext` follows the same shape (auth guard → validate → DB → revalidatePath → return). |
| 4 | `applyToWorkspace()` + auto-apply effect | `lib/assistant/assistant-context.tsx:487-551` | Slice G "Auto-Apply" can dispatch `SET_DRAFT_PROMPT`, which already fires the apply effect via `draftVersion` increment. |
| 5 | `sonner` toast pattern | `lib/assistant/assistant-context.tsx:506-521` | Auto-apply success/error toasts and Undo behavior already proven. |
| 6 | Radix `Dialog` primitive for new modals | `components/ui/dialog.tsx`, `components/settings/settings-dialog.tsx:359-394` | Helper-Modal ("Help me write this") + optional Context-Edit modal use the same shell. |
| 7 | `@/`-alias imports for app code | `components/workspace/prompt-area.tsx:12-21`, all components | New code follows the same alias convention. |
| 8 | Pydantic DTOs (`Field`, `Literal`, `HttpUrl`) | `backend/app/models/dtos.py:21-59` | Extend `SendMessageRequest` with `reference_slots`, `last_result_image_url`, `project_id`; create new DTOs for context endpoints. |
| 9 | FastAPI `APIRouter` module per resource | `backend/app/routes/messages.py:13`, `backend/app/routes/sessions.py:26` | New `/api/projects/{id}/context` endpoints (or `/api/assistant/context`) get their own router module. |
| 10 | Frontend SSE parser + `handleSSEEvent` switch | `lib/assistant/use-assistant-runtime.ts:154-216` | Add new tool-result branches (`finalize_and_generate`, `set_slot_role`, etc.) to the existing switch. |
| 11 | Reference-bar slot state owned by `PromptArea` | `components/workspace/prompt-area.tsx:165,225,239,263` | No state move; runtime simply reads via a new ref (mirroring `imageModelIdRef`/`generationModeRef` at lines 104-107). |
| 12 | `useWorkspaceVariation` setVariation/clearVariation | `lib/assistant/assistant-context.tsx:345,496-500` | Tool calls for `set_model_params` extend the modelParams payload field that already flows through this setter. |

### EXTEND (extend existing abstraction)

| # | What | Where | Extension needed |
|---|------|-------|------------------|
| 1 | `build_assistant_system_prompt` | `backend/app/agent/prompts.py:85-123` | Add optional `project_context: Optional[str]` parameter; if non-empty, append a `## PROJEKT-CONTEXT` block. Keep base + knowledge composition. Update both `_call_model_sync`/`_call_model_async` (`graph.py:235-257`) to pass it. |
| 2 | `_BASE_PROMPT` content | `backend/app/agent/prompts.py:17-82` | Replace "kein Fragebogen" rule with adaptive-Interview rules + semantic-confidence stop-criterion + Intent-Summary-Card invariants + new tool list. (See Slice E in discovery.) |
| 3 | `SendMessageRequest` DTO | `backend/app/models/dtos.py:21-59` | Add `reference_slots: Optional[list[ReferenceSlotDTO]]`, `last_result_image_url: Optional[HttpUrl]`, `project_id: Optional[UUID]` (so backend can hydrate `context_instructions`). |
| 4 | `AssistantService.stream_response` | `backend/app/services/assistant_service.py:117-185` | Build human-message content list also from `reference_slots` and `last_result_image_url` under modus + budget rules; pass `project_context` into `configurable`. |
| 5 | `PromptAssistantState` | `backend/app/agent/state.py:12-43` | Add `flow_state` (Literal of FSM states) + optional `intent_axes` so UI/post-processor can persist progress in the checkpointer. |
| 6 | `_call_model_*` nodes | `backend/app/agent/graph.py:235-257` | Accept and forward `project_context` from `configurable` into `build_assistant_system_prompt`. |
| 7 | `useAssistantRuntime` body builder | `lib/assistant/use-assistant-runtime.ts:354-373` | Append `reference_slots` + `last_result_image_url` to request body; conditional on `generationModeRef.current === "img2img"` for slots. Add new refs `referenceSlotsRef`, `lastResultImageUrlRef` parallel to existing `imageModelIdRef`/`generationModeRef`. |
| 8 | `assistantReducer` + `AssistantAction` | `lib/assistant/assistant-context.tsx:104-252` | Add: `SET_FLOW_STATE` (FSM), `RENDER_INTENT_SUMMARY` (card payload), `RENDER_PASTE_CONFIRM`, `DISMISS_PASTE_CONFIRM`, `DISMISS_NO_CONTEXT_BANNER`. |
| 9 | `chat-thread.tsx` rendering | `components/assistant/chat-thread.tsx:24-65` | Render special card variants for Intent-Summary-Card and Paste-Detect-Confirm-Card when corresponding messages/state present (file already supports init message + context-separator special types). |
| 10 | `TOOL_STATE_MAPPING` registry | `backend/app/agent/graph.py:41-52` | Add entries for new tools that should persist into LangGraph state (`finalize_and_generate` may persist final intent; `set_slot_role`/`set_slot_strength` updates UI through SSE only and may not need state). |
| 11 | `getProject`-style query helpers | `lib/db/queries.ts:35-44` | Add `updateProjectContext({ id, userId, contextInstructions })` returning updated `Project`. |

### NEW (new implementation needed)

| # | What | Why new |
|---|------|---------|
| 1 | `IntentSummaryCard` chat-message component | No existing chat-card variant in `components/assistant/`; current renderer only emits user/assistant/error/init bubbles (`components/assistant/chat-thread.tsx`). |
| 2 | `PasteDetectConfirmCard` component + heuristic | No paste-detection logic anywhere in the repo; new heuristic function (length/comma-density/style-keyword count) and inline card. |
| 3 | Project-Context-Settings UI (route or modal) | No existing project-settings UI besides "rename" + "delete" in `components/project-card.tsx`. New textarea-based editor with Save + helper-modal entry. |
| 4 | "Help me write this" Helper-Modal | No existing AI-assist component scoped to a single textarea. |
| 5 | No-Context-Hint-Banner | New banner component above `chat-thread`; no comparable nudge UI today. |
| 6 | Backend endpoint(s) for project context (`GET`/`PATCH /api/projects/{id}/context`) and `POST /api/projects/context/generate` | No existing project-level Next.js API routes (only `/api/auth`, `/api/models/sync`, `/api/sam/segment`, plus FastAPI proxy). New route handlers needed. Open Question #2 in discovery resolves to a separate REST endpoint, not a LangGraph tool. |
| 7 | New LangGraph tools: `finalize_and_generate`, `set_slot_role`, `set_slot_strength`, `set_model_params` | No equivalent tool exists; current tools only draft/refine prompts and analyze single images. They follow REUSE pattern #1 above for shape. |
| 8 | FSM state field + UI-derivation | Current state has only `phase: str` (`backend/app/agent/state.py:32`); the discovery FSM is more granular (paste_confirmation/interviewing/summarizing/generating/reviewing/refining) and drives card rendering. |
| 9 | Drizzle migration `0015_*.sql` for `projects.context_instructions` + `projects.context_updated_at` | New columns; no equivalent today. |
| 10 | Reference-slot serialization for backend `image_url` parts | Frontend ReferenceBar exists, but no current code packages slots into `image_url` content blocks beyond chat-input uploads (`use-assistant-runtime.ts:358-360`). |

### AVOID (known debt, do not replicate)

| # | What | Decision Log Entry | Alternative |
|---|------|--------------------|-------------|
| -- | -- | No `.decisions.md` present in the worktree. | -- |

> No `AVOID` items: no decision log entries exist; no patterns were flagged as debt by an explicit decision. Discovery does flag the current "kein Fragebogen" rule (`backend/app/agent/prompts.py:21,32-37`) as the main behavior to replace, but this is feature-driven replacement, not technical debt.

---

## Conventions Detected

| Convention | Evidence | Count |
|------------|----------|-------|
| Path alias `@/` for app/lib/components imports | `components/workspace/prompt-area.tsx:12-21`, `components/settings/settings-dialog.tsx:1-26`, all server actions | hundreds |
| Drizzle: schema in `lib/db/schema.ts`, generated migrations in `drizzle/`, types via `$inferSelect` | `lib/db/schema.ts`, `lib/db/queries.ts:8-14`, `drizzle/*.sql` | 14 migrations |
| Server actions: `"use server"` + `requireAuth()` + return `Result \| { error: string }` | `app/actions/projects.ts:1-138`, `app/actions/generations.ts`, `app/actions/references.ts` | 7 modules |
| FastAPI: per-resource `APIRouter` modules + Pydantic DTOs in `backend/app/models/dtos.py` | `backend/app/routes/sessions.py:26`, `backend/app/routes/messages.py:13` | 4 routers |
| SSE event protocol: `event: <name>\ndata: <json>` with `text-delta`, `tool-call-result`, `text-done`, `error` | `backend/app/services/assistant_service.py:267-300`, `lib/assistant/use-assistant-runtime.ts:154-216` | 1 protocol |
| `lib/types/*.ts` for shared frontend types | `lib/types/reference.ts`, `lib/types/chat-message.ts`, `lib/types/prompt-knowledge.ts` | 3 |
| Naming: file-kebab-case, components PascalCase, hooks `useX`, server actions camelCase | `components/assistant/assistant-panel.tsx`, `lib/assistant/use-assistant-runtime.ts`, `app/actions/projects.ts` | repo-wide |
| Reducer state: `actionType` upper-snake (`SET_DRAFT_PROMPT`) with `dispatch` from React `useReducer` | `lib/assistant/assistant-context.tsx:104-127` | 1 |
| Tests colocated in `__tests__/` per module | `lib/assistant/__tests__/`, `app/actions/__tests__/`, `components/workspace/__tests__/`, `backend/...` (Python tests under `backend/`) | repo-wide |
| German user-facing messages in chat / toasts; English comments + identifiers | `app/actions/projects.ts:27,57,116`, `lib/assistant/assistant-context.tsx:475,506,510`, `backend/app/agent/prompts.py:17-82` | repo-wide |
| Dialog/AlertDialog from radix-ui via shadcn-style local wrappers in `components/ui/` | `components/ui/dialog.tsx`, `components/ui/alert-dialog.tsx`, `components/ui/sheet.tsx` | 3 primitives |
| LangGraph: `@tool` async/sync, `ToolNode` from `langgraph.prebuilt`, `add_messages` reducer via `AgentState` subclass | `backend/app/agent/graph.py:23,267-269`, `backend/app/agent/state.py:9-12` | 1 graph |
| Next.js dev proxy: `/api/assistant/:path*` → FastAPI; everything else handled by Next | `next.config.ts:70-77` | 1 rewrite |

---

## Key Integration Points

| Integration | Current Location | Impact of Feature |
|-------------|------------------|-------------------|
| `projects` table schema | `lib/db/schema.ts:22-47` | Add `contextInstructions text` (nullable) + `contextUpdatedAt timestamptz` (nullable). New migration `drizzle/0015_*.sql`. |
| Project queries | `lib/db/queries.ts:20-65` | Add `updateProjectContext`, extend `getProject` shape (auto via `$inferSelect`). |
| Project server actions | `app/actions/projects.ts` | Add `updateProjectContext`, `generateProjectContext` (calls FastAPI or local LLM). |
| Assistant `_BASE_PROMPT` | `backend/app/agent/prompts.py:17-82` | Full rewrite: replace anti-questionnaire stance with adaptive interview + semantic-confidence stop + new tool guidance. |
| `build_assistant_system_prompt` signature | `backend/app/agent/prompts.py:85-123` | Add `project_context: Optional[str]` and append a labeled block before/after the knowledge block. |
| `_call_model_sync` / `_call_model_async` | `backend/app/agent/graph.py:235-257` | Pass `project_context` from `configurable` into `build_assistant_system_prompt`. |
| `AssistantService.stream_response` | `backend/app/services/assistant_service.py:117-185` | Hydrate `project_context` from DB by `project_id`; build multimodal HumanMessage with reference-slot + last-result images under budget rules; forward `flow_state` updates via SSE. |
| `SendMessageRequest` DTO | `backend/app/models/dtos.py:21-59` | Add `project_id`, `reference_slots`, `last_result_image_url`. |
| `useAssistantRuntime` body builder | `lib/assistant/use-assistant-runtime.ts:354-373` | Add fields per discovery; condition slot inclusion on `generation_mode === "img2img"`. |
| `assistantReducer` + actions | `lib/assistant/assistant-context.tsx:104-252` | New action types for FSM, cards, banner dismiss. |
| `chat-thread.tsx` renderer | `components/assistant/chat-thread.tsx` | New message-variant rendering: Intent-Summary-Card, Paste-Detect-Confirm-Card, No-Context-Hint-Banner above thread. |
| `applyToWorkspace` flow | `lib/assistant/assistant-context.tsx:487-551` | `finalize_and_generate` tool → `SET_DRAFT_PROMPT` → existing auto-apply effect → optional auto-trigger of `generateImages()` server action (`app/actions/generations.ts`). |
| Workspace generate trigger | `app/actions/generations.ts` (`generateImages`) | Called automatically post-apply on Slice G; existing manual button stays. |
| Project-card entry to settings | `components/project-card.tsx:209` (already has confirm-dialog) | Add new entry "Edit context" → opens new modal/route. |
| Workspace-Header settings opener | `components/workspace/workspace-header.tsx:182` | Optional second entry-point to project-context settings. |
| Next.js rewrites to FastAPI | `next.config.ts:70-77` | If new context endpoints live on FastAPI, the rewrite already handles them; otherwise add Next API route handlers in `app/api/...`. |
| LangGraph state | `backend/app/agent/state.py:12-43` | Add `flow_state` to allow UI to read FSM via `GET /sessions/{id}` (`backend/app/routes/sessions.py:74-97`, `lib/assistant/assistant-context.tsx:44-64`). |

---

## Decision Log Context

| # | Decision | Relevant for this Feature | How |
|---|----------|---------------------------|-----|
| -- | No `.decisions.md` found at repo root or worktree root. | -- | -- |

> No decision log present. Search performed at `/.decisions.md` and via recursive find — no file. Architecture decisions for this feature must be recorded fresh.

---

## Scan Summary

| Metric | Value |
|--------|-------|
| Patterns found | 20 |
| REUSE recommendations | 12 |
| EXTEND recommendations | 11 |
| NEW recommendations | 10 |
| AVOID recommendations | 0 |
| Decision Log entries | 0 |
