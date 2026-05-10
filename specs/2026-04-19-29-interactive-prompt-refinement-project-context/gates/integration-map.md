# Integration Map: Interactive Prompt Refinement in Assistant with Per-Project Context

**Generated:** 2026-05-09
**Slices:** 28 (alle APPROVED)
**Connections:** 56 deklarierte Provider→Consumer Verbindungen
**Stack:** TypeScript/Next.js 16 (Frontend) + Python/FastAPI + LangGraph (Backend)

---

## Dependency Graph (Visual)

```
Foundation (DB + System-Prompt-Backbone)
═════════════════════════════════════════════════════════════════
  01-schema-migration
        │
        ├──► 02-db-queries-helpers
        │       │
        │       ├──► 03-context-routes (GET/PATCH /api/projects/[id]/context)
        │       │       │
        │       │       ├──► 06-context-settings-page (B)
        │       │       │       │
        │       │       │       ├──► 07-project-list-edit-entry (B)
        │       │       │       └──► 09-helper-modal-component (C)
        │       │       │
        │       │       ├──► 08-helper-modal-route (C)  ──►  09
        │       │       └──► 10-no-context-banner (M)
        │       │
        │       └──► 04-context-server-action  ──► 06
        │
        └──► 05-project-repository-fastapi
                │
                └──► 11-prompts-context-block (D)
                        │
                        └──► 12-base-prompt-rewrite-interview (E)
                                │
                                ├──► 13-emit-intent-summary-tool (F)
                                │       │
                                │       ├──► 14-fsm-state-extension (F)
                                │       │       │
                                │       │       └──► 15-sse-flow-state-events (F)
                                │       │               │
                                │       │               └──► 16-intent-summary-card-component (F)
                                │       │                       │
                                │       │                       ├──► 17-auto-apply-generate-handler (G)
                                │       │                       │       │
                                │       │                       │       └──► 18-result-image-multimodal (H)
                                │       │                       │
                                │       │                       ├──► 27-paste-detect-card-component (L)
                                │       │                       │
                                │       │                       └──► 28-session-resume-flow-state
                                │       │
                                │       └──► 23-i2i-settings-tools (J)
                                │               │
                                │               └──► 24-slot-tool-frontend-handler (J)
                                │                       │
                                │                       └──► 25-multi-reference-eval (K)
                                │
                                ├──► 19-reference-slots-dto (I)
                                │       │
                                │       └──► 20-chat-llm-limits-module (I)
                                │               │
                                │               └──► 21-multimodal-pipeline-budget (I)
                                │                       │
                                │                       └──► 22-multimodal-indicator-ui (I)  ◄──── 18
                                │
                                └──► 26-paste-detect-heuristic (L)
                                        │
                                        └──► 27 (zusätzlich zu 16)
```

---

## Nodes

### Slice 01: Schema Migration für Project-Context

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | -- |
| Outputs | 4 (DB-Spalten + Migration + Drizzle-Type) |

**Inputs:** None (Foundation-Slice)

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `projects.contextInstructions` | Drizzle column (text, nullable) | 02 |
| `projects.contextUpdatedAt` | Drizzle column (timestamptz, nullable) | 02, 06 |
| `projects.$inferSelect` (extended) | Drizzle TS-Type | alle TS-Consumer transitively |
| Migration `0015_add_project_context` | SQL migration | 05 (psycopg liest dieselbe DB) |

---

### Slice 02: DB-Query-Helpers für Context

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 01 |
| Outputs | 2 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `projects.contextInstructions` | 01 | OK |
| `projects.contextUpdatedAt` | 01 | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `getProjectContext` | async function | 03, 10 |
| `updateProjectContext` (Query-Helper) | async function | 03, 04 |

---

### Slice 03: Next.js Route Handlers GET/PATCH /api/projects/[id]/context

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 02 |
| Outputs | 2 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `getProjectContext` | 02 | OK |
| `updateProjectContext` (Query) | 02 | OK |
| `requireAuth` | existing | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `GET /api/projects/{id}/context` | HTTP endpoint | 06, 10 |
| `PATCH /api/projects/{id}/context` | HTTP endpoint | 06 (alternativer Save-Pfad), 08 (Auth-Pattern-Reuse) |

---

### Slice 04: Server Action `updateProjectContext`

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 02 |
| Outputs | 1 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `updateProjectContext` (Query) | 02 | OK |
| `requireAuth`, `revalidatePath` | existing | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `updateProjectContext` (Server Action) | async function | 06 |

---

### Slice 05: FastAPI ProjectRepository

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 01 |
| Outputs | 2 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `projects.context_instructions` (Postgres column) | 01 | OK |
| `projects.user_id` (existing) | existing | OK |
| `settings.psycopg_database_url` | existing | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ProjectRepository` class | Python class | 11 |
| `ProjectRepository.get_context` | async method | 11 |

---

### Slice 06: Project-Context-Settings UI

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 03, 04 |
| Outputs | 1 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `GET /api/projects/{id}/context` | 03 | OK |
| `updateProjectContext` (Server Action) | 04 | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `<ProjectContextSettings>` | React component | 07, 09 (modify-target) |

---

### Slice 07: Project-List + Workspace-Header Edit-Entries

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 06 |
| Outputs | 2 (UI-Mounts) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `<ProjectContextSettings>` | 06 | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Edit-context Entry-Point in Projekt-Card | UI integration | End-User-Flow Slice B |
| Edit-context Entry-Point in Workspace-Header | UI integration | End-User-Flow Slice B |

---

### Slice 08: Help-Me-Write Route Handler

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 03 |
| Outputs | 1 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `requireAuth` | existing | OK |
| `openRouterClient.chat` | existing | OK |
| Auth/Response-Konvention | 03 | OK (transitive pattern) |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `POST /api/projects/context/generate` | HTTP endpoint | 09 |

---

### Slice 09: Help-Me-Write Modal-Komponente

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 08, 06 |
| Outputs | 1 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `POST /api/projects/context/generate` | 08 | OK |
| Mount-Slot in `<ProjectContextSettings>` + onAccept-Callback | 06 | OK (06 reserviert Slot, 09 modifiziert 06) |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `<HelpMeWriteModal>` | React component | 06 (Mount-Point) |

---

### Slice 10: No-Context-Hint-Banner

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 03 |
| Outputs | 3 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `GET /api/projects/{id}/context` | 03 | OK |
| Settings-Route oder Modal-Trigger | 06 (parallel, link-target) | OK (Banner robust auch ohne 06) |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `<NoContextBanner>` | React Component | mounted in `assistant-panel.tsx` |
| `noContextBannerDismissed` State-Field | AssistantState | future slices |
| `DISMISS_NO_CONTEXT_BANNER` Action | AssistantAction | future slices |

---

### Slice 11: System-Prompt-Komposition mit Project-Context

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 05 |
| Outputs | 3 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `ProjectRepository`, `get_context` | 05 | OK |
| `build_assistant_system_prompt`, `_BASE_PROMPT`, `format_knowledge_for_prompt` | existing | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `build_assistant_system_prompt` (extended Signatur mit `project_context`) | Python function | 12 |
| `_escape_project_context` | Python helper | 11 intern |
| `configurable["project_context"]` | LangGraph RunnableConfig key | 12 (via `_call_model_*`) |

---

### Slice 12: Base-Prompt-Rewrite (Interview-Verhalten)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 11 |
| Outputs | 4 (Behavior-Verträge im Prompt-Text) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `build_assistant_system_prompt` | 11 | OK |
| `_BASE_PROMPT` Module-Level-String, `SYSTEM_PROMPT`-Alias | existing | OK |
| Bestehende Tools-Naming | existing (`draft_prompt`, `refine_prompt`, `analyze_image`, `recommend_model`, `web_search`) | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `_BASE_PROMPT` (rewritten) | Python module-level string | 13, 19, 23, 26, 25 |
| Verhaltens-Vertrag "Zwischen-Check ≠ Generate" | Prompt-Regel | 14, 15 |
| Verhaltens-Vertrag "Sequenzielles Multi-Reference" | Prompt-Regel | 25 |
| Verhaltens-Vertrag "DE-Chat / EN-Prompt" | Prompt-Regel | 16, 18, 27 |

---

### Slice 13: emit_intent_summary Agent-Tool

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 12 |
| Outputs | 3 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `_BASE_PROMPT` referenziert `emit_intent_summary` | 12 | OK |
| `final_intent`-State-Feld (forward-dep) | 14 | OK (slice 14 macht TypedDict-Field verfügbar; 13 schreibt Mapping-Hook) |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `emit_intent_summary` Tool | LangChain BaseTool | LangGraph ToolNode, 15, 17 (indirekt) |
| `TOOL_STATE_MAPPING["emit_intent_summary"]` | Mapping | 15 |
| `SettingsDiff` Pydantic-Modell | Pydantic BaseModel | 15, 16 |

---

### Slice 14: FSM-State-Extension in PromptAssistantState

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 13 |
| Outputs | 5 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `post_process_node`-Hook schreibt `final_intent`/`flow_state` | 13 | OK |
| `langgraph-checkpoint-postgres` | existing | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `PromptAssistantState.flow_state` | TypedDict-Field (str, default "idle") | 15, 17 (mirror), 28 |
| `PromptAssistantState.intent_axes` | TypedDict-Field (dict, default `{}`) | 15, 28 |
| `PromptAssistantState.final_intent` | TypedDict-Field (Optional[dict]) | 13 (write), 15, 28 |
| `DEFAULT_STATE_VALUES` (extended) | dict | AssistantService.create_session |
| `SessionStateDTO.flow_state`/`.intent_axes` | Pydantic fields | 28 |

---

### Slice 15: SSE-Events flow-state + intent-summary

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 14 |
| Outputs | 6 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `PromptAssistantState.flow_state/intent_axes/final_intent` | 14 | OK |
| `emit_intent_summary` registered + `TOOL_STATE_MAPPING` | 13 | OK |
| `AssistantService.stream_response`, `_convert_event` | existing | OK |
| Frontend `parseSSEEvents`, `handleSSEEvent` | existing | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| SSE event `flow-state` | wire event | 17, 28 |
| SSE event `intent-summary` | wire event | 16, 28 |
| `SET_FLOW_STATE` Reducer-Action | Action | 17, 18, 28 |
| `RENDER_INTENT_SUMMARY` Reducer-Action | Action | 16 |
| `flowState` Reducer-Field | string (default "idle") | 16, 17 |
| `intentSummaryPayload` Reducer-Field | IntentSummaryPayload \| null | 16 |

---

### Slice 16: IntentSummaryCard-Komponente

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 15 |
| Outputs | 4 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `flowState`, `intentSummaryPayload` Reducer-Fields | 15 | OK |
| `IntentSummaryPayload` TypeScript Type | 15 | OK |
| `sendMessage`, `chat-thread.tsx` | existing | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `<IntentSummaryCard>` | React Component | 17 (handler-slot), 27 (Refine-Pfad → führt zu Card), 28 (re-mount on resume) |
| `data-testid="intent_summary_card.generate_btn"` | DOM-Selector | 17, 28 |
| `data-testid="intent_summary_card"` | DOM-Selector | 27, 28 |
| Card-Render-Branch in `chat-thread.tsx` | Mount-Point | 28 |

---

### Slice 17: Auto-Apply + Auto-Generate Handler

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 16 |
| Outputs | 3 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `<IntentSummaryCard>` Generate-Slot | 16 | OK |
| `SET_FLOW_STATE` Action mit Whitelist incl. "generating" | 15 | OK (15 enthält "generating" in Whitelist) |
| `usePromptAssistant`, `applyToWorkspace`, `dispatch` | existing | OK |
| `generateImages()` Server-Action | existing | OK |
| Generations-Quelle pro Projekt | existing (workspace-content.tsx:217) | OK |
| `sonner.toast()` | existing | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `useIsGenerationPending(projectId)` | React Hook | 17 intern, future Concurrent-Guards |
| Verdrahteter Click-Pfad in IntentSummaryCard | Behavior | 18, 28 |
| `flowState === "generating"` | Reducer-Selector | 18, 22, 28 |

---

### Slice 18: Result-Image als Multimodal-Input

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 17 |
| Outputs | 4 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| Auto-Apply-Handler-Pfad mit Generate-Success-Settle | 17 | OK |
| Reducer-Action-Mechanismus + `usePromptAssistant` | 15 | OK |
| `lib/assistant/use-assistant-runtime.ts` Body-Builder | existing | OK |
| `canvas-detail-view.tsx`, `workspace-content.tsx:326-336` Opener | existing | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `SET_LAST_RESULT_IMAGE_URL` Reducer-Action | Reducer-Action | 22, 28 |
| `state.lastResultImageUrl` | State-Field (string \| null) | 22, 28 |
| Body-Field `last_result_image_url` in SendMessageRequest | DTO-Field (HTTP-JSON) | 19 (Backend-DTO), 21 (Backend-Konsum) |
| `result_message`-Variante in chat-thread.tsx | Render-Branch | -- |

---

### Slice 19: ReferenceSlot-DTO + SendMessageRequest-Erweiterung

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 12 |
| Outputs | 4 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| Stable Base-Prompt | 12 | OK |
| `SendMessageRequest` (existing) | existing | OK |
| `use-assistant-runtime.ts` Refs-Pattern, `generationModeRef` | existing | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ReferenceSlotDTO` | Pydantic Model | 21, 23 |
| `SendMessageRequest` (extended mit `project_id`, `reference_slots`, `last_result_image_url`) | Pydantic Model | 21, 18 (Frontend-Send-Pfad) |
| `referenceSlotsRef`, `projectIdRef` | React Refs | 22, 24 |
| Body-Builder-Erweiterung mit Modus-Gate | Hook-Logic | 21 (Backend-Konsum) |

---

### Slice 20: chat_llm_limits-Modul

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 19 (logical) |
| Outputs | 3 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| (logical only — kein Code-Import aus 19) | 19 | OK |
| `backend/app/config.py` Allowlist | existing (read-only Referenz) | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `CHAT_LLM_LIMITS` | dict[str, dict] | 21 |
| `DEFAULT_LIMITS` | dict | 21 |
| `get_chat_llm_limits` | Function | 21, 22 (indirect via service) |

---

### Slice 21: Multimodal-Pipeline + Budget-Enforcement

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 20 |
| Outputs | 3 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `SendMessageRequest.reference_slots`, `last_result_image_url`, `project_id` | 19 | OK |
| Frontend Body-Builder mit Modus-Gate | 19 | OK |
| `get_chat_llm_limits`, `CHAT_LLM_LIMITS`, `DEFAULT_LIMITS` | 20 | OK |
| `AssistantService.stream_response` | existing | OK |
| `SlotLoadFailedPayload`-Wire-Contract | architecture | OK |
| `assistant-context.tsx` Reducer | existing (15-Familie) | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Multimodal-HumanMessage-Pipeline | Service Internals | terminal (verhalten via SSE-Stream) |
| SSE-Event `slot-load-failed` | SSE-Event-Stream | 22 (passive listener), Frontend SSE-Handler |
| `RENDER_SYSTEM_MESSAGE` Reducer-Action | Reducer Action | 22 (potential consumer), future slices |

---

### Slice 22: Multimodal-Indicator UI

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 21, 18 |
| Outputs | 3 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `state.lastResultImageUrl` | 18 | OK (18 Provides-Tabelle nennt explizit Slice 22) |
| `ReferenceSlotData`-Schema/Type-Shape | 19 | OK (nur Type, nicht Ref) |
| Modus-Gate-Verhalten (Slots in txt2img ignoriert) | 21 | OK |
| `WorkspaceStateProvider` (existing) | existing | OK |
| `usePromptAssistant` Hook, `selectedModel` | existing | OK |
| `generationMode` (existing local state in prompt-area.tsx) | existing | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `<MultimodalIndicator>` | React Component | mounted in `assistant-panel.tsx` |
| `WorkspaceStateProvider.referenceSlots` (added reactive state) | Reactive Provider-State | `prompt-area.tsx`, `multimodal-indicator.tsx` |
| `WorkspaceStateProvider.generationMode` (added reactive state) | Reactive Provider-State | `multimodal-indicator.tsx` |

---

### Slice 23: i2i-Settings-Tools (set_slot_role, set_slot_strength, set_model_params)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 13 |
| Outputs | 3 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| Tool-Registry-Pattern (`ALL_TOOLS`, `TOOL_STATE_MAPPING`) | 13 | OK |
| `app.agent.prompt_knowledge.get_prompt_knowledge` | existing | OK |
| LangGraph `RunnableConfig.configurable["image_model_id"]` | existing | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `set_slot_role` (LangChain @tool) | BaseTool | 24 (Frontend-SSE), 25 (Schema-Verifikation) |
| `set_slot_strength` (LangChain @tool) | BaseTool | 24 |
| `set_model_params` (LangChain @tool) | BaseTool | 24 |

---

### Slice 24: Frontend-Handler für Slot-Tools

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 23 |
| Outputs | 4 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| Backend-Tool-Result-Events `set_slot_*`, `set_model_params` | 23 | OK |
| `use-assistant-runtime.ts:176-203` `tool-call-result`-Switch | existing | OK |
| `assistant-context.tsx:104-127` Reducer | existing | OK |
| `useWorkspaceVariation()` setVariation | existing | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `state.pendingSlotRolePatch` | State-Field | 25 (observational), `prompt-area.tsx` (subscriber) |
| `state.pendingSlotStrengthPatch` | State-Field | wie oben |
| `state.pendingModelParamsPatch` | State-Field | Auto-apply-Effekt (intern) |
| Reducer-Actions `SET_SLOT_ROLE`, `SET_SLOT_STRENGTH`, `SET_MODEL_PARAMS_PATCH` | Action-Union | future SSE-tool-mappings |

---

### Slice 25: Multi-Reference-Interview Eval-Suite

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 24, 12 |
| Outputs | 1 (Verhaltens-Gate) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `_BASE_PROMPT` Multi-Reference-Phrasen | 12 | OK |
| `set_slot_role` Schema | 23 | OK |
| Verhaltens-Vertrag | 24 (kontextuell) | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Verhaltens-Gate "Sequenzielles Multi-Reference" | Pytest-Suite | terminal (Discovery-Slice K Done-Signal) |

---

### Slice 26: Paste-Detect-Heuristik

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 12 |
| Outputs | 1 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| (logical only) Backend behandelt erste Message uniform | 12 | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `detectPastedPrompt(text)` | Pure Function | 27 |

---

### Slice 27: PasteDetectConfirmCard-Komponente

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 26, 16 |
| Outputs | 4 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `detectPastedPrompt` | 26 | OK |
| `chat-thread.tsx` Card-Render-Branch + `data-testid="intent_summary_card"` | 16 | OK |
| `usePromptAssistant`, `sendMessage` | existing | OK |
| `refine_prompt` Tool | existing | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `<PasteDetectConfirmCard>` | React Component | terminal |
| `pasteConfirmPayload` Reducer-Field | State-Field | 28 (informativ — Resume rendert Card NICHT erneut) |
| `RENDER_PASTE_CONFIRM`, `DISMISS_PASTE_CONFIRM` | Reducer-Actions | terminal |
| `data-testid="paste_confirm_card"` (+ btn-Selektoren) | DOM-Selectors | E2E |

---

### Slice 28: Session-Resume mit FSM-Hydrate

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | 16 |
| Outputs | 1 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `SessionStateDTO.flow_state`, `.intent_axes` | 14 | OK |
| `PromptAssistantState.final_intent` (persistiert) | 14 | OK |
| `SET_FLOW_STATE`, `RENDER_INTENT_SUMMARY` Actions | 15 | OK |
| `<IntentSummaryCard>`-Mount-Trigger | 16 | OK |
| `loadSession`-Hydrate-Effekt | existing | OK |
| `GET /api/assistant/sessions/{id}` Route + Service | existing | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Resume-fähige FSM-Hydrate für (flowState, intentSummaryPayload) | Reducer-Side-Effect in loadSession | terminal |

---

## Connections

| # | From | To | Resource | Type | Status |
|---|------|-----|----------|------|--------|
| 1 | 01 | 02 | `projects.contextInstructions` | DB column | OK |
| 2 | 01 | 02 | `projects.contextUpdatedAt` | DB column | OK |
| 3 | 01 | 06 | `projects.contextUpdatedAt` (UI-Anzeige) | DB column | OK |
| 4 | 01 | 05 | Migration `0015` (Postgres-Schema) | SQL migration | OK |
| 5 | 02 | 03 | `getProjectContext` | async function | OK |
| 6 | 02 | 03 | `updateProjectContext` (Query) | async function | OK |
| 7 | 02 | 04 | `updateProjectContext` (Query) | async function | OK |
| 8 | 02 | 10 | `getProjectContext` | async function | OK (transitive via Banner-Visibility) |
| 9 | 03 | 06 | `GET /api/projects/{id}/context` | HTTP endpoint | OK |
| 10 | 03 | 06 | `PATCH /api/projects/{id}/context` | HTTP endpoint | OK |
| 11 | 03 | 08 | requireAuth-Konvention + Response-Stil | Pattern | OK |
| 12 | 03 | 10 | `GET /api/projects/{id}/context` | HTTP endpoint | OK |
| 13 | 04 | 06 | `updateProjectContext` (Server Action) | async function | OK |
| 14 | 05 | 11 | `ProjectRepository`, `get_context` | Python class | OK |
| 15 | 06 | 07 | `<ProjectContextSettings>` | React component | OK |
| 16 | 06 | 09 | Mount-Slot in `<ProjectContextSettings>` | React composition | OK |
| 17 | 08 | 09 | `POST /api/projects/context/generate` | HTTP endpoint | OK |
| 18 | 09 | 06 | `<HelpMeWriteModal>` (modify-target) | React component | OK |
| 19 | 11 | 12 | `build_assistant_system_prompt` (extended) | Python function | OK |
| 20 | 11 | 12 | `configurable["project_context"]` | RunnableConfig key | OK |
| 21 | 12 | 13 | `_BASE_PROMPT` referenziert `emit_intent_summary` | Prompt-String | OK |
| 22 | 12 | 19 | Stable Base-Prompt | Prompt-Spec | OK |
| 23 | 12 | 25 | `_BASE_PROMPT` Multi-Reference-Phrasen | Prompt-Spec | OK |
| 24 | 12 | 26 | (logical) Backend uniform | -- | OK |
| 25 | 13 | 14 | `final_intent`-Mapping-Hook erwartet TypedDict-Field | LangGraph state-bridge | OK (forward-resolved) |
| 26 | 13 | 15 | `emit_intent_summary` Tool, `TOOL_STATE_MAPPING`, `SettingsDiff` | LangChain BaseTool, mapping | OK |
| 27 | 13 | 23 | `ALL_TOOLS`-Registry-Pattern | Python module-level | OK |
| 28 | 14 | 15 | `flow_state`, `intent_axes`, `final_intent` State-Fields | TypedDict | OK |
| 29 | 14 | 28 | `SessionStateDTO.flow_state/.intent_axes`, `PromptAssistantState.final_intent` | Pydantic + state | OK |
| 30 | 15 | 16 | `flowState`, `intentSummaryPayload`, `RENDER_INTENT_SUMMARY`, `SET_FLOW_STATE` | Reducer | OK |
| 31 | 15 | 16 | `IntentSummaryPayload` Type | TypeScript Type | OK |
| 32 | 15 | 17 | `SET_FLOW_STATE` Whitelist incl. "generating" | Reducer-Action | OK |
| 33 | 15 | 18 | Reducer-Action-Mechanismus + `usePromptAssistant` | Hook | OK |
| 34 | 15 | 28 | `SET_FLOW_STATE`, `RENDER_INTENT_SUMMARY` Actions | Reducer-Actions | OK |
| 35 | 16 | 17 | `<IntentSummaryCard>` Generate-Slot | React Component | OK |
| 36 | 16 | 27 | `chat-thread.tsx` Render-Branch, `data-testid="intent_summary_card"` | Mount-Point + Selector | OK |
| 37 | 16 | 28 | `<IntentSummaryCard>`-Mount-Trigger | Component | OK |
| 38 | 17 | 18 | Auto-Apply-Settle-Pfad | Behavior | OK |
| 39 | 18 | 19 | Body-Field `last_result_image_url` (Frontend-Send) | DTO-Field | OK |
| 40 | 18 | 21 | Body-Field `last_result_image_url` (Backend-Konsum) | DTO-Field | OK |
| 41 | 18 | 22 | `state.lastResultImageUrl`, `SET_LAST_RESULT_IMAGE_URL` | State + Action | OK |
| 42 | 18 | 28 | `state.lastResultImageUrl` (Hydrate-Pfad informativ) | State-Field | OK |
| 43 | 19 | 21 | `ReferenceSlotDTO`, `SendMessageRequest` (extended) | Pydantic | OK |
| 44 | 19 | 22 | `ReferenceSlotData`-Type-Shape | TypeScript Type | OK |
| 45 | 19 | 23 | `ReferenceSlotDTO` | Pydantic | OK (Schema-Konsumtion in Tool-Validation) |
| 46 | 19 | 24 | `referenceSlotsRef`, `projectIdRef` (existence) | React Refs | OK |
| 47 | 20 | 21 | `get_chat_llm_limits`, `CHAT_LLM_LIMITS`, `DEFAULT_LIMITS` | Function + dicts | OK |
| 48 | 20 | 22 | `get_chat_llm_limits` (indirect via service vision-flag) | Function | OK |
| 49 | 21 | 22 | Modus-Gate-Verhalten + slot-load-failed-Event | Behavior + SSE | OK |
| 50 | 23 | 24 | `set_slot_role`, `set_slot_strength`, `set_model_params` Tools (Names + Payload) | LangChain BaseTool | OK |
| 51 | 23 | 25 | `set_slot_role` Pydantic-Schema | BaseTool | OK |
| 52 | 24 | 25 | (Verhaltens-Vertrag — kein Code-Import) | -- | OK |
| 53 | 26 | 27 | `detectPastedPrompt` | Pure Function | OK |
| 54 | 27 | 28 | `pasteConfirmPayload` Reducer-Field (informativ) | State-Field | OK (28 rendert Card NICHT erneut, transient) |
| 55 | 22 | mounted in `assistant-panel.tsx` | `<MultimodalIndicator>` | UI-Mount | OK |
| 56 | 10 | mounted in `assistant-panel.tsx` | `<NoContextBanner>` | UI-Mount | OK |

---

## Validation Results

### Valid Connections: 56

Alle deklarierten Dependencies haben ein passendes Output in einem vorhergehenden (oder synchron parallelen mit Forward-Resolution wie 13→14) Slice.

### Orphaned Outputs: 0 (alle final user-facing oder explizit terminal)

Folgende Outputs sind keine Provider→Consumer-Verbindungen, sondern terminale Endpunkte (UI-Mount-Punkte oder behavior-only):

| Output | Defined In | Status | Rationale |
|--------|------------|--------|-----------|
| Edit-context Entry-Points (Card + Header) | 07 | TERMINAL | UI-Endpunkte für End-User Slice B |
| `<NoContextBanner>` | 10 | TERMINAL | Mount in `assistant-panel.tsx` |
| `result_message`-Variante in chat-thread.tsx | 18 | TERMINAL | Render-Branch, kein nachgelagerter Slice |
| Multimodal-HumanMessage-Pipeline | 21 | TERMINAL | Service-internals; sichtbar via SSE-Events (eigene Outputs) |
| `<MultimodalIndicator>` | 22 | TERMINAL | UI-Mount in `assistant-panel.tsx` |
| Verhaltens-Gate "Sequenzielles Multi-Reference" | 25 | TERMINAL | Pytest-Suite — Discovery-K Done-Signal |
| `<PasteDetectConfirmCard>` | 27 | TERMINAL | UI-Komponente, kein Folge-Slice mountet weiter |
| `RENDER_PASTE_CONFIRM`, `DISMISS_PASTE_CONFIRM` | 27 | TERMINAL | Actions vollständig in 27 konsumiert |
| Resume-fähige FSM-Hydrate | 28 | TERMINAL | Letzter Slice — UX-Polish |

### Missing Inputs: 0

Jeder Input findet seinen Producer in einem vorhergehenden APPROVED Slice oder einer dokumentierten "existing"-Code-Quelle (Auth-Guards, sonner, Drizzle-Db, OpenRouter-Client, useWorkspaceVariation, etc.).

### Deliverable-Consumer Gaps: 0

Alle Modify-Targets (z.B. `chat-thread.tsx`, `assistant-context.tsx`, `assistant-panel.tsx`, `prompt-area.tsx`, `assistant-service.py`, `graph.py`, `prompts.py`) sind in den jeweiligen Slice-Deliverables explizit als "Edit/Modify"-Eintrag gelistet:

| Component | Defined In | Mount/Modify Target | Slice Deliverable Status |
|-----------|------------|---------------------|--------------------------|
| `<ProjectContextSettings>` | 06 | `components/project-card.tsx`, `components/workspace/workspace-header.tsx` | Slice 07 Deliverables (EDIT) |
| `<HelpMeWriteModal>` | 09 | `components/projects/project-context-settings.tsx` | Slice 09 Deliverables (MODIFY) |
| `<NoContextBanner>` | 10 | `components/assistant/assistant-panel.tsx` | Slice 10 Deliverables (EDIT) |
| `<IntentSummaryCard>` | 16 | `components/assistant/chat-thread.tsx` | Slice 16 Deliverables (Edit) |
| Auto-apply-Click-Handler | 17 | `components/assistant/intent-summary-card.tsx` | Slice 17 Deliverables (Edit) |
| `result_message`-Variante | 18 | `components/assistant/chat-thread.tsx` | Slice 18 Deliverables (Edit) |
| `<PasteDetectConfirmCard>` | 27 | `components/assistant/chat-thread.tsx` | Slice 27 Deliverables (Edit) |
| `<MultimodalIndicator>` | 22 | `components/assistant/assistant-panel.tsx` | Slice 22 Deliverables (Edit) |
| FSM-Hydrate | 28 | `lib/assistant/assistant-context.tsx` (loadSession) | Slice 28 Deliverables (Edit) |
| `slot-load-failed` SSE-Branch FE | 21 | `lib/assistant/use-assistant-runtime.ts` | Slice 15-Familie covers (architecture.md Zeile 528); 21 macht zur Not Mini-Edit |

### Runtime Path Gaps: 0

Alle Discovery-User-Flows haben eine vollständige Aufrufkette:

| User-Flow | Chain | Covered ACs |
|-----------|-------|-------------|
| Haupt-Flow txt2img mit vagem Input | UI → Chat → Backend (12-Prompt) → SSE flow-state → Reducer → Card (16) → Click → applyToWorkspace (17) → generateImages (17) → result_image (18) → next-turn proaktiv (12+18) | 12-AC2/AC3, 15-AC1/AC2, 16-AC1/AC9, 17-AC1/AC8, 18-AC8/AC9 |
| i2i-Flow mit ReferenceBar-Slots | UI ReferenceBar → frontend-Refs (19) → Body-Send img2img-only (19) → Backend pipeline + budget (21) → multimodal HumanMessage → LLM → set_slot_role-Tools (23) → SSE tool-result → Reducer (24) → PromptArea-Sync (24) → Indicator (22) | 19-AC8, 21-AC1/AC3/AC5, 23-AC2/AC5, 24-AC1/AC4, 22-AC1/AC2/AC8, 25-AC1 |
| Paste-Prompt-Flow | UI first-message → detectPastedPrompt (26) → Trigger-Layer (27) → RENDER_PASTE_CONFIRM → Card → refine_btn → DISMISS + sendMessage(refine-Hint) → refine_prompt-Tool (existing) → IntentSummaryCard (16) | 26-AC1/AC4, 27-AC1/AC4/AC10, 16-AC1 |
| Project-Context-Edit-Flow | Project-List/Header (07) → ProjectContextSettings (06) → GET (03) → user types → Save → Server Action (04) → DB (02) → revalidate → next session uses context (11/12) | 03-AC2/AC4, 04-AC1, 06-AC1/AC3/AC9, 07-AC1/AC2/AC4 |
| Helper-Modal-Flow | Settings (06) → click Help → HelpMeWriteModal (09) → POST generate (08) → openrouter → Draft → Accept → onAccept callback → fill textarea (06) → Save (04) | 08-AC2/AC7, 09-AC3/AC4/AC7/AC9, 06-AC3 |
| No-Context-Banner-Flow | AssistantPanel mount → fetch GET (03) → Banner conditional (10) → Dismiss-Action OR Link-Click → Settings (06) | 03-AC2, 10-AC1/AC3/AC6 |
| Result-Image-Refinement-Loop | Generate succeeded → SET_LAST_RESULT_IMAGE_URL (18) → next sendMessage Body (18) → Backend pipeline (21) → Multimodal HumanMessage → LLM kommentiert → result_message Bubble (18) → click thumbnail → Detail-View (existing) | 17-AC8, 18-AC1/AC2/AC5/AC8, 21-AC1 |
| Session-Resume-Flow | Page-Reload → loadSession (existing) → GET sessions/{id} → SessionStateDTO (14) → Hydrate dispatcht SET_FLOW_STATE + RENDER_INTENT_SUMMARY (28) → Card re-mountet (16) | 14-AC4, 28-AC1/AC4/AC5/AC8 |

### Semantic Consistency Gaps: 0

Geprüft:

1. **MODIFY-Chain Analysis** — Keine Konflikte:
   - `lib/assistant/assistant-context.tsx` wird von 10, 14 (FE-DTO indirekt), 15, 17, 18, 21, 24, 27, 28 angefasst — jeder Slice fügt nur eigene Actions/Felder hinzu, kein Slice ändert Actions eines anderen.
   - `components/assistant/chat-thread.tsx` wird von 16, 18, 27 angefasst — jede Edit ergänzt einen separaten Render-Branch.
   - `lib/assistant/use-assistant-runtime.ts` wird von 15, 18, 19, 24 angefasst — jede Edit ergänzt entweder einen Ref, eine Body-Field oder einen SSE-Handler-Branch.
   - `backend/app/agent/prompts.py` wird von 11 (Komposition + Helper) und 12 (Inhalt von `_BASE_PROMPT`) angefasst — Slice 12-Constraint stellt explizit klar, dass nur der String-Inhalt geändert wird, Komposition aus 11 bleibt.
   - `backend/app/services/assistant_service.py` wird von 11 (configurable + ProjectRepository-Call) und 21 (Multimodal-Pipeline) angefasst — additive Erweiterungen ohne Konflikt.
   - `backend/app/agent/graph.py` wird von 11 (`_call_model_*` configurable-read), 13 (`ALL_TOOLS` + emit_intent_summary), 23 (drei Workspace-Tools in `ALL_TOOLS`) angefasst — jede Edit ist additiv.
   - `backend/app/models/dtos.py` wird von 14 (SessionStateDTO + IntentSummaryPayload) und 19 (ReferenceSlotDTO + SendMessageRequest extension) angefasst — zwei separate DTOs.
   - `components/assistant/assistant-panel.tsx` wird von 10 (NoContextBanner Mount) und 22 (MultimodalIndicator Mount) angefasst — separate Mount-Punkte.
   - `components/assistant/intent-summary-card.tsx` wird von 16 (NEW) und 17 (Edit Click-Handler) angefasst — 17 füllt Slot, den 16 reserviert hat.

2. **Wrapper/Extension Feasibility** — Alle "extends/implements"-Patterns sind konkret spezifiziert:
   - Slice 14 erbt explizit von `langgraph.prebuilt.chat_agent_executor.AgentState` (TypedDict).
   - Slice 13's `SettingsDiff` Pydantic-Modell wird in Slice 15 als Sub-Modell von `IntentSummaryPayload` weiterverwendet — Field-Schema in 13 explizit definiert.

3. **Return-Type Consistency** — alle Provider→Consumer-Calls sind konsistent:
   - `getProjectContext` Return-Shape `{ contextInstructions, contextUpdatedAt } | null` ist in 02-Provides + 03/10-Requires identisch.
   - `updateProjectContext` (Query) Return-Shape ist in 02-Provides + 03/04-Requires identisch.
   - `ProjectRepository.get_context` Return-Tuple `(str | None, UUID)` ist in 05-Provides + 11-Requires identisch.
   - `IntentSummaryPayload` (15-Provides) wird in 16/28 1:1 konsumiert.
   - `set_slot_role` Pydantic-Schema (23) wird von 24 (mit snake→camel-Mapping im Handler explizit dokumentiert) und 25 (Schema-Verifikation auf Mock-Args) konsistent verwendet.

---

## Discovery Traceability

### UI Components Coverage

| Discovery Element | Type | Location | Covered In | Status |
|-------------------|------|----------|------------|--------|
| `intent_summary_card` | Chat-Card | Chat-Thread | 16 | OK |
| `intent_summary_card.generate_btn` | Button | Card | 16 (render) + 17 (handler) | OK |
| `intent_summary_card.discuss_btn` | Button | Card | 16 | OK |
| `paste_confirm_card` | Chat-Card | Chat-Thread | 27 | OK |
| `paste_confirm_card.refine_btn` | Button | Card | 27 | OK |
| `paste_confirm_card.interview_btn` | Button | Card | 27 | OK |
| `no_context_banner` | Banner | Assistant-Panel-Top | 10 | OK |
| `no_context_banner.link` | Link | Banner | 10 | OK |
| `context_textarea` | Textarea | Settings | 06 | OK |
| `help_me_write_btn` | Button | Settings | 06 (placeholder) + 09 (logic) | OK |
| `helper_brief_input` | Textarea | Helper-Modal | 09 | OK |
| `helper_generate_btn` | Button | Helper-Modal | 09 | OK |
| `helper_accept_btn` | Button | Helper-Modal | 09 | OK |
| `reference_slot` (existing) | Slot-Card | ReferenceBar | n/a — pipeline angepasst (19,21) | OK |

### State Machine Coverage

| State | Required UI | Available Actions | Covered In | Status |
|-------|-------------|-------------------|------------|--------|
| `idle` | Leeres Chat-Thread + ggf. Banner | Send Message, Open Sessions, Open Settings | 06, 10 | OK |
| `paste_confirmation` | Chat-Thread + Paste-Confirm-Card | Refine / Interview | 26, 27 | OK |
| `interviewing` | Chat-Thread Q&A | User antwortet | 12 (prompt), 15 (state) | OK |
| `summarizing` | Intent-Summary-Card | "So generieren" / "Nochmal diskutieren" | 13, 14, 15, 16 | OK |
| `generating` | Generate-Spinner | -- | 17 (frontend-only transition) | OK |
| `reviewing` | Result + assistant comment | User-Feedback / Done | 18 (result-message), 28 (resume) | OK |
| `refining` | Refinement-Q&A | Q&A oder Draft | 12 (prompt regeln), 15 (FSM-Whitelist) | OK |

### Transitions Coverage

| From | Trigger | To | Covered In | Status |
|------|---------|-----|------------|--------|
| idle | first msg + paste-heuristik | paste_confirmation | 26+27 | OK |
| idle | first msg vager Intent | interviewing | 12 (prompt) + 15 (SSE flow-state idle→interviewing AC-1) | OK |
| idle | first msg konkret + must-haves | summarizing | 12 + 13 + 15 | OK |
| paste_confirmation | "Direkt verfeinern" | summarizing | 27 (refine_prompt → IntentSummaryCard) + 16 | OK |
| paste_confirmation | "Interview starten" | interviewing | 27 (sendMessage normal) + 12 | OK |
| interviewing | Zwischen-Frage | interviewing | 12 (Zwischen-Check ≠ Generate) | OK |
| interviewing | semantic confidence | summarizing | 12 + 13 + 15-AC2 | OK |
| summarizing | "So generieren" | generating | 17-AC1 | OK |
| summarizing | "Nochmal diskutieren" | interviewing | 16-AC6 | OK |
| generating | Result-URL ready | reviewing | 17-AC8 (frontend-side; backend-SSE) + 18-AC1/AC8 | OK |
| generating | Generate-fail | interviewing/summarizing | 17-AC4 (rollback to summarizing) | OK |
| reviewing | "zu dunkel" | refining | 12 (prompt-regel) + 15 (whitelist) | OK |
| reviewing | "Perfekt" | idle | 12 (prompt) | OK |
| refining | klein | summarizing | 12 + 16 | OK |
| refining | groß | interviewing | 12 | OK |

### Business Rules Coverage

| Rule | Covered In | Status |
|------|------------|--------|
| Assistant aktiv nur in txt2img/img2img | 12 (Prompt), 19 (Modus-Gate) | OK |
| Interview-Sprache DE-Chat / EN-Prompt | 12-AC1 | OK |
| Project-Context als System-Prompt-Block jeder Turn, nur LLM | 11-AC2/AC3, 11-Constraints (NICHT Image-Model) | OK |
| Intent-Summary nur bei semantischer Sicherheit, kein Turn-Cap | 12-AC2/AC3 | OK |
| Zwischen-Checks lösen NIEMALS Apply/Generate | 12-AC4 | OK |
| Auto-Apply nur bei Card-Click | 13 (Tool initiiert nicht) + 17-AC1 | OK |
| Slots als Multimodal NUR bei img2img | 19-AC9, 21-AC2 | OK |
| Result-Image bei nächstem Turn (max letztes) | 18-AC1/AC2 | OK |
| Multimodal-Budget Priority Refs > Result > Uploads | 21-AC3/AC4 | OK |
| Non-Vision-Model: stille Strip-Logik | 21-AC5 | OK |
| Project-Context nur bei Ownership | 03-AC3, 05-AC2 | OK |
| Help-me-write 1 LLM-Call pro Klick | 08-AC7 | OK |
| Neue Sessions übernehmen aktuellen Context | 11 (per-turn fresh load) | OK |
| Paste-Detect-Confirm nur bei erster User-Message | 27-AC1/AC2 | OK |
| Settings-Tool-Calls auf aktiven Workspace gebunden | 23-AC7 (image_model_id) + 24 (frontend-mapping) | OK |

### Data Fields Coverage

| Field | Required | Covered In | Status |
|-------|----------|------------|--------|
| `projects.context_instructions` | No (max 8000) | 01, 02, 03, 04, 05 | OK |
| `projects.context_updated_at` | No (timestamptz) | 01, 02 | OK |
| `SendMessageRequest.reference_slots` | No (max 5) | 19 | OK |
| `SendMessageRequest.last_result_image_url` | No (HttpUrl) | 18 (Frontend-Send), 19 (DTO) | OK |
| `LangGraph-State.flow_state` | No (str enum) | 14, 15 | OK |
| Tool: `emit_intent_summary` payload | Yes | 13 | OK |
| Tool: `set_slot_role` payload | Yes | 23 | OK |
| Tool: `set_slot_strength` payload | Yes | 23 | OK |
| Tool: `set_model_params` payload | Yes | 23 | OK |
| Tool: `generate_project_context` payload (REST endpoint, kein Tool) | Yes | 08 (POST endpoint) | OK |

**Discovery Coverage:** 100% (alle deklarierten UI-Elemente, States, Transitions, Business Rules und Data-Felder sind in mindestens einem Slice abgedeckt)

---

## Summary

| Metric | Value |
|--------|-------|
| Total Slices | 28 |
| Total APPROVED | 28 |
| Total Connections (Provider→Consumer) | 56 |
| Valid Connections | 56 |
| Orphaned Outputs (terminal/UI-Mounts) | 0 problematic, 9 documented terminal |
| Missing Inputs | 0 |
| Deliverable-Consumer Gaps | 0 |
| Runtime Path Gaps | 0 |
| Semantic Consistency Gaps | 0 |
| Discovery Coverage (UI/States/Transitions/Rules/Data) | 100% |

**Verdict:** READY FOR ORCHESTRATION
