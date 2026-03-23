# Integration Map: Model-Aware Prompt Knowledge System

**Generated:** 2026-03-23
**Slices:** 13
**Connections:** 22

---

## Dependency Graph (Visual)

```
                        slice-01 (Knowledge JSON Schema)
                       /          |            \
                      /           |             \
                     v            v              v
        slice-02 (TS Lookup)  slice-03 (Py Lookup)  slice-11 (Knowledge Content)
              |               /     |       \               |
              v              /      |        \              |
        slice-04 (Improver) v       v         v             |
              |         slice-06  slice-09  slice-10         |
              v         (Asst.   (Canvas)  (recommend)      |
        slice-05        Prompt)                              |
        (Improver       |                                    |
         Passthrough)   v                                    |
              |     slice-07                                 |
              |     (Asst. DTO)                              |
              |         |                                    |
              |         v                                    |
              |     slice-08                                 |
              |     (Asst. Frontend)                         |
              |         |                                    |
              v         v              v              v      v
        slice-12 (Integration TS) ---- | ---- slice-13 (Integration Python)
```

---

## Nodes

### Slice 01: Knowledge JSON Schema + Fallback-Skeleton

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | `data/prompt-knowledge.json` (skeleton), `lib/types/prompt-knowledge.ts` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| -- | -- | No dependencies |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `data/prompt-knowledge.json` | Data File (skeleton) | slice-02, slice-03, slice-11 |
| `PromptKnowledgeFile` | TS Interface | slice-02 |
| `ModelKnowledge` | TS Interface | slice-02, slice-04 |
| `ModeKnowledge` | TS Interface | slice-02 |
| `FallbackKnowledge` | TS Interface | slice-02 |

---

### Slice 02: TS Lookup-Funktion (Prefix-Matching)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-01 |
| Outputs | `getPromptKnowledge`, `formatKnowledgeForPrompt` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `data/prompt-knowledge.json` | slice-01 | JSON parseable, models + fallback keys |
| `PromptKnowledgeFile`, `ModelKnowledge`, `ModeKnowledge`, `FallbackKnowledge` | slice-01 | import type compiles |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `getPromptKnowledge` | Function | slice-04 |
| `formatKnowledgeForPrompt` | Function | slice-04 |

---

### Slice 03: Python Lookup-Funktion (Prefix-Matching)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-01 |
| Outputs | `get_prompt_knowledge`, `format_knowledge_for_prompt` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `data/prompt-knowledge.json` | slice-01 | JSON parseable, models + fallback keys |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `get_prompt_knowledge` | Function | slice-06, slice-09, slice-10 |
| `format_knowledge_for_prompt` | Function | slice-06, slice-09 |

---

### Slice 04: Improver buildSystemPrompt + Knowledge-Injection

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-02 |
| Outputs | `buildSystemPrompt` (extended), `improve` (extended) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `getPromptKnowledge` | slice-02 | `(modelId, mode?) => PromptKnowledgeLookupResult` |
| `formatKnowledgeForPrompt` | slice-02 | `(result) => string` |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `buildSystemPrompt` (extended) | Function | slice-05 |
| `improve` (extended) | Function | slice-05 |
| `PromptService.improve` (extended) | Export | slice-05 |

---

### Slice 05: Improver generationMode Durchreichung (Action + UI)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-04 |
| Outputs | `improvePrompt` (extended), `LLMComparison` (extended) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `PromptService.improve` | slice-04 | `(prompt, modelId, generationMode?) => Promise<ImproveResult>` |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `improvePrompt` Server Action (extended) | Server Action | slice-12 |
| `LLMComparison` (extended) | Component | -- (user-facing, no downstream slice) |

---

### Slice 06: Assistant System-Prompt dynamisch machen

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-03 |
| Outputs | `build_assistant_system_prompt`, config key conventions |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `get_prompt_knowledge` | slice-03 | `(model_id, mode) -> dict` |
| `format_knowledge_for_prompt` | slice-03 | `(result) -> str` |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `build_assistant_system_prompt` | Function | slice-07 (indirekt), slice-13 |
| `config["configurable"]["image_model_id"]` | Config Key Convention | slice-07 |
| `config["configurable"]["generation_mode"]` | Config Key Convention | slice-07 |

---

### Slice 07: Assistant DTO + Route + Service

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-06 |
| Outputs | Extended DTO fields, extended `stream_response` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `build_assistant_system_prompt` | slice-06 | graph.py reads config keys set by slice-07 |
| `config["configurable"]["image_model_id"]` | slice-06 | Convention |
| `config["configurable"]["generation_mode"]` | slice-06 | Convention |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `SendMessageRequest.image_model_id` | DTO Field | slice-08 |
| `SendMessageRequest.generation_mode` | DTO Field | slice-08 |
| `stream_response(image_model_id, generation_mode)` | Function Signature | slice-13 |

---

### Slice 08: Assistant Frontend

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-07 |
| Outputs | Extended POST body |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `SendMessageRequest.image_model_id` | slice-07 | Backend accepts field |
| `SendMessageRequest.generation_mode` | slice-07 | Backend accepts field |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `image_model_id` in POST body | Request Field | slice-13 |
| `generation_mode` in POST body | Request Field | slice-13 |

---

### Slice 09: Canvas Chat Knowledge-Injection

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-03 |
| Outputs | `build_canvas_system_prompt` (extended) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `get_prompt_knowledge` | slice-03 | `(model_id, mode) -> dict` |
| `format_knowledge_for_prompt` | slice-03 | `(result) -> str` |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `build_canvas_system_prompt` (extended) | Function | slice-13 |

---

### Slice 10: recommend_model Knowledge-Enrichment

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-03 |
| Outputs | `_match_model` (extended) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `get_prompt_knowledge` | slice-03 | `(model_id, mode) -> dict` |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `_match_model` (extended) | Function (internal) | slice-13 |

---

### Slice 11: Knowledge-Inhalt fuer alle 9 Modell-Prefixe

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-01 |
| Outputs | `data/prompt-knowledge.json` (complete) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `data/prompt-knowledge.json` (skeleton) | slice-01 | File exists with models + fallback keys |
| `ModelKnowledge`, `ModeKnowledge` | slice-01 | Schema definition for content structure |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `data/prompt-knowledge.json` (complete, 9 models) | Data File | slice-02, slice-03, slice-12, slice-13 |

---

### Slice 12: Integration-Test Improver End-to-End

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-05, slice-11 |
| Outputs | Integration Test Suite |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `PromptService.improve` | slice-04 (via slice-05) | Function with Knowledge-Injection |
| `improvePrompt` Action | slice-05 | Passes generationMode through |
| `getPromptKnowledge` | slice-02 | Real lookup (not mocked) |
| `data/prompt-knowledge.json` | slice-11 | Complete content for all 9 prefixes |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Integration Test Suite | Test (Quality Gate) | -- (no consumer) |

---

### Slice 13: Integration-Test Assistant + Canvas Chat + recommend_model

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-06, slice-09, slice-10, slice-11 |
| Outputs | Integration Test Suite |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `build_assistant_system_prompt` | slice-06 | `(image_model_id, generation_mode) -> str` |
| `build_canvas_system_prompt` | slice-09 | `(image_context) -> str` (extended) |
| `_match_model` | slice-10 | `(prompt_summary, style_keywords, available_models) -> dict` (extended) |
| `data/prompt-knowledge.json` | slice-11 | Complete content |
| `get_prompt_knowledge` | slice-03 (transitive) | Used by all three consumers |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Integration Test Suite | Test (Quality Gate) | -- (no consumer, last slice) |

---

## Connections

| # | From | To | Resource | Type | Status |
|---|------|-----|----------|------|--------|
| 1 | Slice 01 | Slice 02 | `data/prompt-knowledge.json` | Data File | VALID |
| 2 | Slice 01 | Slice 02 | TS Interfaces (PromptKnowledgeFile, ModelKnowledge, etc.) | TypeScript Types | VALID |
| 3 | Slice 01 | Slice 03 | `data/prompt-knowledge.json` | Data File | VALID |
| 4 | Slice 01 | Slice 11 | `data/prompt-knowledge.json` (skeleton) | Data File | VALID |
| 5 | Slice 01 | Slice 11 | TS Interfaces (schema reference) | TypeScript Types | VALID |
| 6 | Slice 02 | Slice 04 | `getPromptKnowledge` | Function | VALID |
| 7 | Slice 02 | Slice 04 | `formatKnowledgeForPrompt` | Function | VALID |
| 8 | Slice 03 | Slice 06 | `get_prompt_knowledge` | Function | VALID |
| 9 | Slice 03 | Slice 06 | `format_knowledge_for_prompt` | Function | VALID |
| 10 | Slice 03 | Slice 09 | `get_prompt_knowledge` | Function | VALID |
| 11 | Slice 03 | Slice 09 | `format_knowledge_for_prompt` | Function | VALID |
| 12 | Slice 03 | Slice 10 | `get_prompt_knowledge` | Function | VALID |
| 13 | Slice 04 | Slice 05 | `buildSystemPrompt` (extended) | Function | VALID |
| 14 | Slice 04 | Slice 05 | `improve` / `PromptService.improve` (extended) | Function | VALID |
| 15 | Slice 05 | Slice 12 | `improvePrompt` Server Action | Server Action | VALID |
| 16 | Slice 06 | Slice 07 | `build_assistant_system_prompt` + config key conventions | Function + Convention | VALID |
| 17 | Slice 07 | Slice 08 | `SendMessageRequest.image_model_id` + `.generation_mode` | DTO Fields | VALID |
| 18 | Slice 08 | Slice 13 | POST body fields (`image_model_id`, `generation_mode`) | Request Fields | VALID |
| 19 | Slice 09 | Slice 13 | `build_canvas_system_prompt` (extended) | Function | VALID |
| 20 | Slice 10 | Slice 13 | `_match_model` (extended) | Function | VALID |
| 21 | Slice 11 | Slice 12 | `data/prompt-knowledge.json` (complete) | Data File | VALID |
| 22 | Slice 11 | Slice 13 | `data/prompt-knowledge.json` (complete) | Data File | VALID |

---

## Validation Results

### Valid Connections: 22

All declared dependencies have matching outputs. Every input listed in "Requires From" has a corresponding output in the producer slice's "Provides To".

### Orphaned Outputs: 0

All outputs have at least one consumer or are user-facing final outputs:
- `LLMComparison` (Slice 05): User-facing component, no downstream slice needed.
- Integration Test Suites (Slice 12, 13): Quality gates, no downstream consumer by design.

### Missing Inputs: 0

Every declared input dependency has a matching output from an APPROVED producer slice.

### Deliverable-Consumer Gaps: 0

All components that produce outputs have mount points in consumer slices. No new UI components are introduced (feature is invisible to users). All MODIFY deliverables are tracked correctly:

| Modified File | Modified In | Also Modified In | Conflict? |
|---------------|-------------|------------------|-----------|
| `data/prompt-knowledge.json` | Slice 01 (CREATE), Slice 11 (EXTEND) | -- | No: Slice 11 extends Slice 01 skeleton |
| `lib/services/prompt-service.ts` | Slice 04 (EXTEND) | -- | No: single modifier |
| `app/actions/prompts.ts` | Slice 05 (MODIFY) | -- | No: single modifier |
| `components/prompt-improve/llm-comparison.tsx` | Slice 05 (MODIFY) | -- | No: single modifier |
| `components/workspace/prompt-area.tsx` | Slice 05 (MODIFY) | -- | No: single modifier |
| `backend/app/agent/prompts.py` | Slice 06 (MODIFY) | -- | No: single modifier |
| `backend/app/agent/graph.py` | Slice 06 (MODIFY) | -- | No: single modifier |
| `backend/app/models/dtos.py` | Slice 07 (MODIFY) | -- | No: single modifier |
| `backend/app/routes/messages.py` | Slice 07 (MODIFY) | -- | No: single modifier |
| `backend/app/services/assistant_service.py` | Slice 07 (MODIFY) | -- | No: single modifier |
| `lib/assistant/use-assistant-runtime.ts` | Slice 08 (MODIFY) | -- | No: single modifier |
| `lib/assistant/assistant-context.tsx` | Slice 08 (MODIFY) | -- | No: single modifier |
| `backend/app/agent/canvas_graph.py` | Slice 09 (EXTEND) | -- | No: single modifier |
| `backend/app/agent/tools/model_tools.py` | Slice 10 (EXTEND) | -- | No: single modifier |

### Runtime Path Gaps: 0

All four user flows from Discovery have complete call chains:

**Flow 1: Improver**
`prompt-area.tsx (UI)` -> `llm-comparison.tsx (Component)` -> `prompts.ts (Server Action)` -> `prompt-service.ts (Service)` -> `prompt-knowledge.ts (Lookup)` -> `prompt-knowledge.json (Data)`
- Slice 05 covers UI -> Component -> Action
- Slice 04 covers Service -> Lookup
- Slice 02 covers Lookup function
- Slice 01 + 11 cover Data file

**Flow 2: Assistant**
`assistant-context.tsx (UI)` -> `use-assistant-runtime.ts (Hook)` -> `POST /sessions/{id}/messages` -> `messages.py (Route)` -> `assistant_service.py (Service)` -> `graph.py (Agent)` -> `prompts.py (Prompt Builder)` -> `prompt_knowledge.py (Lookup)` -> `prompt-knowledge.json (Data)`
- Slice 08 covers UI -> Hook -> POST
- Slice 07 covers Route -> Service -> Config
- Slice 06 covers Agent -> Prompt Builder -> Lookup
- Slice 03 covers Lookup function
- Slice 01 + 11 cover Data file

**Flow 3: Canvas Chat**
`canvas_graph.py (build_canvas_system_prompt)` -> `prompt_knowledge.py (Lookup)` -> `prompt-knowledge.json (Data)`
- Slice 09 covers Prompt Builder -> Lookup
- Slice 03 covers Lookup function
- Slice 01 + 11 cover Data file

**Flow 4: recommend_model**
`model_tools.py (_match_model)` -> `prompt_knowledge.py (Lookup)` -> `prompt-knowledge.json (Data)`
- Slice 10 covers Match -> Lookup
- Slice 03 covers Lookup function
- Slice 01 + 11 cover Data file

### Semantic Consistency Gaps: 0

**MODIFY-Chain Analysis:**
- `data/prompt-knowledge.json`: Modified by Slice 01 (CREATE skeleton) and Slice 11 (EXTEND with full content). Sequential, non-conflicting. Slice 11 depends on Slice 01.
- No other file is modified by multiple slices.

**Wrapper/Extension Feasibility:**
- No wrapper or extension patterns are used across slice boundaries.

**Return-Type Consistency:**
- `getPromptKnowledge` (TS) returns `PromptKnowledgeLookupResult`, consumed by `formatKnowledgeForPrompt` in Slice 04. Consistent.
- `get_prompt_knowledge` (Python) returns `dict`, consumed by `format_knowledge_for_prompt` in Slice 06, 09, and directly by Slice 10 (for `strengths`). All consumers use dict access patterns. Consistent.
- `build_assistant_system_prompt` returns `str`, consumed by `SystemMessage(content=...)` in graph.py. Consistent.

---

## Discovery Traceability

### User Flow Coverage

| Discovery Flow | Description | Covered In | Status |
|----------------|-------------|------------|--------|
| Improver Flow (L.87) | User clicks Improve -> System loads knowledge -> LLM gets enriched prompt | slice-02, slice-04, slice-05, slice-12 | COVERED |
| Assistant Flow (L.89-90) | User opens Assistant -> System detects model+mode -> knowledge injected | slice-03, slice-06, slice-07, slice-08, slice-13 | COVERED |
| Canvas Chat Flow (L.92-93) | User opens Canvas on image -> model from context -> knowledge injected | slice-03, slice-09, slice-13 | COVERED |
| recommend_model Flow (L.95-96) | Assistant collects intent -> knowledge-enriched matching | slice-03, slice-10, slice-13 | COVERED |

### Scope Items Coverage

| In-Scope Item (Discovery) | Covered In | Status |
|----------------------------|------------|--------|
| Knowledge file for 8 model families (9 prefixes) | slice-01, slice-11 | COVERED |
| Prefix-based matching | slice-02, slice-03 | COVERED |
| Mode-specific knowledge (txt2img, img2img) | slice-02, slice-03, slice-04, slice-06 | COVERED |
| System-Prompt-Injection: Improver | slice-04, slice-05 | COVERED |
| Dynamic System-Prompt-Injection: Assistant | slice-06, slice-07, slice-08 | COVERED |
| System-Prompt extension: Canvas Chat | slice-09 | COVERED |
| recommend_model enhancement | slice-10 | COVERED |

### Business Rules Coverage

| Rule (Discovery) | Covered In | Status |
|-------------------|------------|--------|
| Knowledge only for active Replicate models (L.102) | slice-11 (9 prefixes, all Replicate) | COVERED |
| Fallback for unknown models (L.103) | slice-02 AC-3, slice-03 AC-3, slice-04 AC-3, slice-06 AC-3, slice-09 AC-2 | COVERED |
| Longest prefix wins (L.104) | slice-02 AC-1, slice-03 AC-1 | COVERED |
| Knowledge file readable by TS and Python (L.105) | slice-02 (TS), slice-03 (Python), identical JSON | COVERED |
| Mode knowledge optional per model (L.106) | slice-02 AC-5/6, slice-03 AC-5/6 | COVERED |
| Max ~500 tokens injected per request (L.107) | slice-11 AC-6 (<250 tokens per model section) | COVERED |

### Data Fields Coverage

| Field (Discovery L.113-128) | Required | Covered In | Status |
|------------------------------|----------|------------|--------|
| `models` | Yes | slice-01 AC-2 | COVERED |
| `models.{prefix}.displayName` | Yes | slice-01 AC-3, slice-11 AC-2 | COVERED |
| `models.{prefix}.promptStyle` | Yes | slice-01 AC-3, slice-11 AC-9 | COVERED |
| `models.{prefix}.negativePrompts` | Yes | slice-01 AC-3, slice-11 AC-10/11 | COVERED |
| `models.{prefix}.strengths` | Yes | slice-01 AC-3, slice-11 AC-2, slice-10 AC-1 | COVERED |
| `models.{prefix}.tips` | Yes | slice-01 AC-3, slice-11 AC-2 | COVERED |
| `models.{prefix}.avoid` | Yes | slice-01 AC-3, slice-11 AC-2 | COVERED |
| `models.{prefix}.modes` | No | slice-01 AC-4, slice-11 AC-3/4/5 | COVERED |
| `models.{prefix}.modes.txt2img` | No | slice-01 AC-4, slice-11 AC-3 | COVERED |
| `models.{prefix}.modes.img2img` | No | slice-01 AC-4, slice-11 AC-3 | COVERED |
| `fallback` | Yes | slice-01 AC-5, slice-11 AC-8 | COVERED |

### Model Prefix Coverage

| Prefix (Discovery L.132-141) | Covered In | Status |
|-------------------------------|------------|--------|
| `flux-2` | slice-01 (schema exemplar), slice-11 AC-1 | COVERED |
| `flux-schnell` | slice-11 AC-1/9 | COVERED |
| `nano-banana` | slice-11 AC-1/5 | COVERED |
| `gpt-image` | slice-11 AC-1 | COVERED |
| `seedream` | slice-11 AC-1/4 | COVERED |
| `stable-diffusion` | slice-11 AC-1/10 | COVERED |
| `recraft` | slice-11 AC-1 | COVERED |
| `ideogram` | slice-11 AC-1 | COVERED |
| `hunyuan` | slice-11 AC-1 | COVERED |

### Integration Changes Coverage (Discovery L.147-178)

| System | Change | Covered In | Status |
|--------|--------|------------|--------|
| Improver: Replace static hints with knowledge lookup | slice-04 AC-1/4 | COVERED |
| Improver: Add generationMode parameter | slice-04 AC-6, slice-05 AC-1/4 | COVERED |
| Assistant: Dynamic system prompt | slice-06 AC-1/2 | COVERED |
| Assistant: Model+mode from message payload | slice-07 AC-1/5/6, slice-08 AC-1 | COVERED |
| Canvas Chat: Load knowledge for model_id | slice-09 AC-1 | COVERED |
| recommend_model: Enrich with knowledge strengths | slice-10 AC-1/6 | COVERED |

**Discovery Coverage:** 32/32 (100%)

---

## Infrastructure Prerequisite Check

| Item | Status | Detail |
|------|--------|--------|
| Health Endpoint (`/api/assistant/health`) | EXISTS | Defined in `backend/app/routes/health.py:8`, mounted via `backend/app/main.py:44`. No prerequisite needed. |
| `data/` directory | DOES NOT EXIST | Created by Slice 01 as part of `data/prompt-knowledge.json` creation. Handled within slice scope. |

---

## Summary

| Metric | Value |
|--------|-------|
| Total Slices | 13 |
| All Slices APPROVED | Yes (13/13) |
| Total Connections | 22 |
| Valid Connections | 22 |
| Orphaned Outputs | 0 |
| Missing Inputs | 0 |
| Deliverable-Consumer Gaps | 0 |
| Runtime Path Gaps | 0 |
| Semantic Consistency Gaps | 0 |
| Discovery Coverage | 100% (32/32) |

**VERDICT: READY FOR ORCHESTRATION**
