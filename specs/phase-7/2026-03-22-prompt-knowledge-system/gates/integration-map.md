# Integration Map: Model-Aware Prompt Knowledge System

**Generated:** 2026-03-23
**Slices:** 13
**Connections:** 29

---

## Dependency Graph (Visual)

```
                        slice-01 (Knowledge JSON Schema)
                       /          |            \          \
                      /           |             \          \
                     v            v              v          v
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
        slice-12 (Integration TS)    slice-13 (Integration Python)
```

---

## Nodes

### Slice 01: Knowledge JSON Schema + Fallback-Skeleton

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | `data/prompt-knowledge.json` (skeleton), `lib/types/prompt-knowledge.ts` (5 interfaces) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| -- | -- | No dependencies |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `data/prompt-knowledge.json` | Data File (skeleton) | Slice 02, Slice 03, Slice 11 |
| `PromptKnowledgeFile` | TS Interface | Slice 02 |
| `ModelKnowledge` | TS Interface | Slice 02, Slice 04 |
| `ModeKnowledge` | TS Interface | Slice 02 |
| `FallbackKnowledge` | TS Interface | Slice 02 |
| `NegativePromptInfo` | TS Interface | (internal sub-type of ModelKnowledge) |

---

### Slice 02: TS Lookup-Funktion (Prefix-Matching)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 01 |
| Outputs | `getPromptKnowledge`, `formatKnowledgeForPrompt` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `data/prompt-knowledge.json` | Slice 01 | JSON parseable, models + fallback keys |
| `PromptKnowledgeFile`, `ModelKnowledge`, `ModeKnowledge`, `FallbackKnowledge` | Slice 01 | import type compiles |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `getPromptKnowledge` | Function | Slice 04, Slice 12 (indirect) |
| `formatKnowledgeForPrompt` | Function | Slice 04 |

---

### Slice 03: Python Lookup-Funktion (Prefix-Matching)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 01 |
| Outputs | `get_prompt_knowledge`, `format_knowledge_for_prompt` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `data/prompt-knowledge.json` | Slice 01 | JSON parseable, models + fallback keys |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `get_prompt_knowledge` | Function | Slice 06, Slice 09, Slice 10, Slice 13 (transitive) |
| `format_knowledge_for_prompt` | Function | Slice 06, Slice 09 |

---

### Slice 04: Improver buildSystemPrompt + Knowledge-Injection

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 02 |
| Outputs | `buildSystemPrompt` (extended), `improve` (extended), `PromptService.improve` (export) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `getPromptKnowledge` | Slice 02 | `(modelId, mode?) => PromptKnowledgeLookupResult` |
| `formatKnowledgeForPrompt` | Slice 02 | `(result) => string` |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `buildSystemPrompt` (extended) | Function | Slice 05 |
| `improve` (extended) | Function | Slice 05 |
| `PromptService.improve` (extended) | Export | Slice 05, Slice 12 |

---

### Slice 05: Improver generationMode Durchreichung (Action + UI)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 04 |
| Outputs | `improvePrompt` (extended), `LLMComparison` (extended) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `PromptService.improve` | Slice 04 | `(prompt, modelId, generationMode?) => Promise<ImproveResult>` |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `improvePrompt` Server Action (extended) | Server Action | Slice 12 |
| `LLMComparison` (extended) | Component | -- (user-facing, no downstream slice) |

---

### Slice 06: Assistant System-Prompt dynamisch machen

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 03 |
| Outputs | `build_assistant_system_prompt`, config key conventions |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `get_prompt_knowledge` | Slice 03 | `(model_id, mode) -> dict` |
| `format_knowledge_for_prompt` | Slice 03 | `(result) -> str` |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `build_assistant_system_prompt` | Function | Slice 07 (indirekt via graph.py), Slice 13 |
| `config["configurable"]["image_model_id"]` | Config Key Convention | Slice 07 |
| `config["configurable"]["generation_mode"]` | Config Key Convention | Slice 07 |

---

### Slice 07: Assistant DTO + Route + Service

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 06 |
| Outputs | Extended DTO fields, extended `stream_response` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `build_assistant_system_prompt` | Slice 06 | graph.py reads config keys set by Slice 07 |
| `config["configurable"]["image_model_id"]` | Slice 06 | Convention |
| `config["configurable"]["generation_mode"]` | Slice 06 | Convention |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `SendMessageRequest.image_model_id` | DTO Field | Slice 08 |
| `SendMessageRequest.generation_mode` | DTO Field | Slice 08 |
| `stream_response(image_model_id, generation_mode)` | Function Signature | Slice 13 |

---

### Slice 08: Assistant Frontend

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 07 |
| Outputs | Extended POST body |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `SendMessageRequest.image_model_id` | Slice 07 | Backend accepts field |
| `SendMessageRequest.generation_mode` | Slice 07 | Backend accepts field |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `image_model_id` in POST body | Request Field | Slice 13 |
| `generation_mode` in POST body | Request Field | Slice 13 |

---

### Slice 09: Canvas Chat Knowledge-Injection

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 03 |
| Outputs | `build_canvas_system_prompt` (extended) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `get_prompt_knowledge` | Slice 03 | `(model_id, mode) -> dict` |
| `format_knowledge_for_prompt` | Slice 03 | `(result) -> str` |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `build_canvas_system_prompt` (extended) | Function | Slice 13 |

---

### Slice 10: recommend_model Knowledge-Enrichment

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 03 |
| Outputs | `_match_model` (extended) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `get_prompt_knowledge` | Slice 03 | `(model_id, mode) -> dict` with `strengths` list |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `_match_model` (extended) | Function (internal) | Slice 13 |

---

### Slice 11: Knowledge-Inhalt fuer alle 9 Modell-Prefixe

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 01 |
| Outputs | `data/prompt-knowledge.json` (complete) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `data/prompt-knowledge.json` (skeleton) | Slice 01 | File exists with models + fallback keys |
| `ModelKnowledge`, `ModeKnowledge` | Slice 01 | Schema definition for content structure |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `data/prompt-knowledge.json` (complete, 9 models) | Data File | Slice 02, Slice 03, Slice 12, Slice 13 |

---

### Slice 12: Integration-Test Improver End-to-End

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 05, Slice 11 |
| Outputs | Integration Test Suite (quality gate) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `PromptService.improve` | Slice 04 (via Slice 05) | Function with Knowledge-Injection |
| `improvePrompt` Action | Slice 05 | Passes generationMode through |
| `getPromptKnowledge` | Slice 02 | Real lookup (not mocked) |
| `data/prompt-knowledge.json` | Slice 11 | Complete content for all 9 prefixes |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Integration Test Suite | Test (Quality Gate) | -- (no consumer) |

---

### Slice 13: Integration-Test Assistant + Canvas Chat + recommend_model

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 06, Slice 09, Slice 10, Slice 11 |
| Outputs | Integration Test Suite (quality gate) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `build_assistant_system_prompt` | Slice 06 | `(image_model_id, generation_mode) -> str` |
| `build_canvas_system_prompt` | Slice 09 | `(image_context) -> str` (extended) |
| `_match_model` | Slice 10 | `(prompt_summary, style_keywords, available_models) -> dict` (extended) |
| `data/prompt-knowledge.json` | Slice 11 | Complete content |
| `get_prompt_knowledge` | Slice 03 (transitive) | Used by all three consumers |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| -- | -- | Last slice, no consumer |

---

## Connections

| # | From | To | Resource | Type | Status |
|---|------|-----|----------|------|--------|
| 1 | Slice 01 | Slice 02 | `data/prompt-knowledge.json` | Data File | VALID |
| 2 | Slice 01 | Slice 02 | TS Interfaces (PromptKnowledgeFile, ModelKnowledge, ModeKnowledge, FallbackKnowledge) | TypeScript Types | VALID |
| 3 | Slice 01 | Slice 03 | `data/prompt-knowledge.json` | Data File | VALID |
| 4 | Slice 01 | Slice 11 | `data/prompt-knowledge.json` (skeleton) | Data File | VALID |
| 5 | Slice 01 | Slice 11 | TS Interfaces (schema reference) | TypeScript Types | VALID |
| 6 | Slice 02 | Slice 04 | `getPromptKnowledge` | Function | VALID |
| 7 | Slice 02 | Slice 04 | `formatKnowledgeForPrompt` | Function | VALID |
| 8 | Slice 02 | Slice 12 | `getPromptKnowledge` (indirect, via prompt-service.ts) | Function | VALID |
| 9 | Slice 03 | Slice 06 | `get_prompt_knowledge` | Function | VALID |
| 10 | Slice 03 | Slice 06 | `format_knowledge_for_prompt` | Function | VALID |
| 11 | Slice 03 | Slice 09 | `get_prompt_knowledge` | Function | VALID |
| 12 | Slice 03 | Slice 09 | `format_knowledge_for_prompt` | Function | VALID |
| 13 | Slice 03 | Slice 10 | `get_prompt_knowledge` | Function | VALID |
| 14 | Slice 03 | Slice 13 | `get_prompt_knowledge` (transitive) | Function | VALID |
| 15 | Slice 04 | Slice 05 | `buildSystemPrompt` (extended) | Function | VALID |
| 16 | Slice 04 | Slice 05 | `improve` / `PromptService.improve` (extended) | Function | VALID |
| 17 | Slice 04 | Slice 12 | `PromptService.improve` (extended) | Function | VALID |
| 18 | Slice 05 | Slice 12 | `improvePrompt` Server Action | Server Action | VALID |
| 19 | Slice 06 | Slice 07 | `build_assistant_system_prompt` + config key conventions | Function + Convention | VALID |
| 20 | Slice 06 | Slice 13 | `build_assistant_system_prompt` | Function | VALID |
| 21 | Slice 07 | Slice 08 | `SendMessageRequest.image_model_id` | DTO Field | VALID |
| 22 | Slice 07 | Slice 08 | `SendMessageRequest.generation_mode` | DTO Field | VALID |
| 23 | Slice 07 | Slice 13 | `stream_response` signature | Function | VALID |
| 24 | Slice 08 | Slice 13 | POST body fields (`image_model_id`, `generation_mode`) | Request Fields | VALID |
| 25 | Slice 09 | Slice 13 | `build_canvas_system_prompt` (extended) | Function | VALID |
| 26 | Slice 10 | Slice 13 | `_match_model` (extended) | Function | VALID |
| 27 | Slice 11 | Slice 02 | `data/prompt-knowledge.json` (complete content at runtime) | Data File | VALID |
| 28 | Slice 11 | Slice 03 | `data/prompt-knowledge.json` (complete content at runtime) | Data File | VALID |
| 29 | Slice 11 | Slice 12 | `data/prompt-knowledge.json` (complete) | Data File | VALID |
| 30 | Slice 11 | Slice 13 | `data/prompt-knowledge.json` (complete) | Data File | VALID |

---

## Validation Results

### VALID Connections: 30

All declared dependencies have matching outputs. Every input listed in "Requires From" has a corresponding output in the producer slice's "Provides To".

### Orphaned Outputs: 2 (both justified)

| Output | Defined In | Consumers | Action |
|--------|------------|-----------|--------|
| `LLMComparison` (extended component) | Slice 05 | None (external) | ACCEPTABLE: Final user-facing UI component, rendered in `prompt-area.tsx` (same slice deliverable). No downstream slice consumer needed. |
| `NegativePromptInfo` interface | Slice 01 | None listed | ACCEPTABLE: Internal sub-type of `ModelKnowledge.negativePrompts`. Used implicitly when consuming `ModelKnowledge`. No separate import needed. |

### Missing Inputs: 0

Every declared input dependency has a matching output from an APPROVED producer slice.

### Deliverable-Consumer Gaps: 0

All components that produce outputs have mount points in consumer slices:

| Modified File | Modified In | Also Modified In | Conflict? |
|---------------|-------------|------------------|-----------|
| `data/prompt-knowledge.json` | Slice 01 (CREATE), Slice 11 (EXTEND) | -- | No: Slice 11 extends Slice 01 skeleton. Sequential dependency. |
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

No file is modified by multiple slices (except `data/prompt-knowledge.json` which has a clean sequential CREATE->EXTEND dependency).

### Runtime Path Gaps: 0

All four user flows from Discovery have complete call chains:

**Flow 1: Improver**
`prompt-area.tsx (UI)` -> `llm-comparison.tsx (Component)` -> `prompts.ts (Server Action)` -> `prompt-service.ts (Service)` -> `prompt-knowledge.ts (Lookup)` -> `prompt-knowledge.json (Data)`
- Slice 05 covers UI -> Component -> Action (ACs 1-6)
- Slice 04 covers Service -> Lookup (ACs 1-7)
- Slice 02 covers Lookup function (ACs 1-11)
- Slice 01 + 11 cover Data file

**Flow 2: Assistant**
`assistant-context.tsx (UI)` -> `use-assistant-runtime.ts (Hook)` -> `POST /sessions/{id}/messages` -> `messages.py (Route)` -> `assistant_service.py (Service)` -> `graph.py (Agent)` -> `prompts.py (Prompt Builder)` -> `prompt_knowledge.py (Lookup)` -> `prompt-knowledge.json (Data)`
- Slice 08 covers UI -> Hook -> POST (ACs 1-7)
- Slice 07 covers Route -> Service -> Config (ACs 1-7)
- Slice 06 covers Agent -> Prompt Builder -> Lookup (ACs 1-7)
- Slice 03 covers Lookup function (ACs 1-12)
- Slice 01 + 11 cover Data file

**Flow 3: Canvas Chat**
`canvas_graph.py (build_canvas_system_prompt)` -> `prompt_knowledge.py (Lookup)` -> `prompt-knowledge.json (Data)`
- Slice 09 covers Prompt Builder -> Lookup (ACs 1-7)
- Slice 03 covers Lookup function
- Slice 01 + 11 cover Data file

**Flow 4: recommend_model**
`model_tools.py (_match_model)` -> `prompt_knowledge.py (Lookup)` -> `prompt-knowledge.json (Data)`
- Slice 10 covers Match -> Lookup (ACs 1-7)
- Slice 03 covers Lookup function
- Slice 01 + 11 cover Data file

### Semantic Consistency Gaps: 0

**MODIFY-Chain Analysis:**
- `data/prompt-knowledge.json`: Modified by Slice 01 (CREATE skeleton) and Slice 11 (EXTEND with full content). Sequential, non-conflicting. Slice 11 depends on Slice 01.
- No other file is modified by multiple slices.

**Return-Type Consistency:**
- `getPromptKnowledge` (TS): Returns `PromptKnowledgeLookupResult`, consumed by `formatKnowledgeForPrompt` in Slice 04. Consistent.
- `get_prompt_knowledge` (Python): Returns `dict`, consumed by `format_knowledge_for_prompt` in Slices 06/09, and directly for `strengths` access in Slice 10. All consumers use dict access patterns. Consistent.
- `build_assistant_system_prompt`: Returns `str`, consumed as `SystemMessage(content=...)` in graph.py. Consistent.
- `buildSystemPrompt` (TS): Returns `string`, consumed internally by `improve()`. Consistent.

**Wrapper/Extension Feasibility:**
No wrapper or extension patterns across slice boundaries. All strategies are concrete with specific functions and methods named.

---

## Discovery Traceability

### User Flow Coverage

| Discovery Flow | Description | Covered In | Status |
|----------------|-------------|------------|--------|
| Improver (L.87) | User clicks Improve -> System loads knowledge -> LLM gets enriched prompt | Slice 02, 04, 05, 12 | COVERED |
| Assistant (L.89-90) | User opens Assistant -> System detects model+mode -> knowledge injected | Slice 03, 06, 07, 08, 13 | COVERED |
| Canvas Chat (L.92-93) | User opens Canvas on image -> model from context -> knowledge injected | Slice 03, 09, 13 | COVERED |
| recommend_model (L.95-96) | Assistant collects intent -> knowledge-enriched matching | Slice 03, 10, 13 | COVERED |

### Scope Items Coverage

| In-Scope Item (Discovery) | Covered In | Status |
|----------------------------|------------|--------|
| Knowledge file for 8 model families (9 prefixes) | Slice 01, Slice 11 | COVERED |
| Prefix-based matching | Slice 02, Slice 03 | COVERED |
| Mode-specific knowledge (txt2img, img2img) | Slice 02, 03, 04, 06 | COVERED |
| System-Prompt-Injection: Improver | Slice 04, Slice 05 | COVERED |
| Dynamic System-Prompt-Injection: Assistant | Slice 06, 07, 08 | COVERED |
| System-Prompt extension: Canvas Chat | Slice 09 | COVERED |
| recommend_model enhancement | Slice 10 | COVERED |

### Business Rules Coverage

| Rule (Discovery) | Covered In | Status |
|-------------------|------------|--------|
| Knowledge only for active Replicate models (L.102) | Slice 11 (9 prefixes, all Replicate) | COVERED |
| Fallback for unknown models (L.103) | Slice 02 AC-3, Slice 03 AC-3, Slice 04 AC-3, Slice 06 AC-3, Slice 09 AC-2, Slice 10 AC-2 | COVERED |
| Longest prefix wins (L.104) | Slice 02 AC-1, Slice 03 AC-1 | COVERED |
| Knowledge file readable by TS and Python (L.105) | Slice 02 (TS), Slice 03 (Python), identical JSON | COVERED |
| Mode knowledge optional per model (L.106) | Slice 02 AC-5/6, Slice 03 AC-5/6, Slice 04 AC-1/2 | COVERED |
| Max ~500 tokens injected per request (L.107) | Slice 11 AC-6 (<250 tokens per model section) | COVERED |

### Data Fields Coverage

| Field (Discovery L.113-128) | Required | Covered In | Status |
|------------------------------|----------|------------|--------|
| `models` | Yes | Slice 01 AC-2, Slice 11 AC-1 | COVERED |
| `models.{prefix}.displayName` | Yes | Slice 01 AC-3, Slice 11 AC-2 | COVERED |
| `models.{prefix}.promptStyle` | Yes | Slice 01 AC-3, Slice 11 AC-9 | COVERED |
| `models.{prefix}.negativePrompts` | Yes | Slice 01 AC-3, Slice 11 AC-10/11 | COVERED |
| `models.{prefix}.strengths` | Yes | Slice 01 AC-3, Slice 11 AC-2, Slice 10 AC-1 | COVERED |
| `models.{prefix}.tips` | Yes | Slice 01 AC-3, Slice 11 AC-2 | COVERED |
| `models.{prefix}.avoid` | Yes | Slice 01 AC-3, Slice 11 AC-2 | COVERED |
| `models.{prefix}.modes` | No | Slice 01 AC-4, Slice 11 AC-3/4/5 | COVERED |
| `models.{prefix}.modes.txt2img` | No | Slice 01 AC-4, Slice 11 AC-3 | COVERED |
| `models.{prefix}.modes.img2img` | No | Slice 01 AC-4, Slice 11 AC-3/4/5 | COVERED |
| `fallback` | Yes | Slice 01 AC-5, Slice 11 AC-8 | COVERED |

### Model Prefix Coverage

| Prefix (Discovery L.132-141) | Covered In | Status |
|-------------------------------|------------|--------|
| `flux-2` | Slice 01 (schema exemplar), Slice 11 AC-1 | COVERED |
| `flux-schnell` | Slice 11 AC-1/9 | COVERED |
| `nano-banana` | Slice 11 AC-1/5 | COVERED |
| `gpt-image` | Slice 11 AC-1 | COVERED |
| `seedream` | Slice 11 AC-1/4 | COVERED |
| `stable-diffusion` | Slice 11 AC-1/10 | COVERED |
| `recraft` | Slice 11 AC-1 | COVERED |
| `ideogram` | Slice 11 AC-1 | COVERED |
| `hunyuan` | Slice 11 AC-1 | COVERED |

### Integration Changes Coverage (Discovery L.147-178)

| System | Change | Covered In | Status |
|--------|--------|------------|--------|
| Improver: Replace static hints with knowledge lookup | Slice 04 AC-1/4 | COVERED |
| Improver: Add generationMode parameter | Slice 04 AC-6, Slice 05 AC-1/4 | COVERED |
| Assistant: Dynamic system prompt | Slice 06 AC-1/2 | COVERED |
| Assistant: Model+mode from message payload | Slice 07 AC-1/5/6, Slice 08 AC-1 | COVERED |
| Canvas Chat: Load knowledge for model_id | Slice 09 AC-1 | COVERED |
| recommend_model: Enrich with knowledge strengths | Slice 10 AC-1/6 | COVERED |

**Discovery Coverage:** 38/38 (100%)

---

## Infrastructure Prerequisite Check

| Item | Status | Detail |
|------|--------|--------|
| Health Endpoint (`/api/assistant/health`) | EXISTS | Defined in `backend/app/routes/health.py:8`, mounted via `backend/app/main.py:44`. No prerequisite needed. |
| `data/` directory | DOES NOT EXIST | Created by Slice 01 as part of `data/prompt-knowledge.json` creation. Handled within slice scope. No prerequisite needed. |
| Log Channels | N/A | No specific log channels referenced by slices. Standard logging used. |

---

## Summary

| Metric | Value |
|--------|-------|
| Total Slices | 13 |
| All Slices APPROVED | Yes (13/13) |
| Total Connections | 30 |
| Valid Connections | 30 |
| Orphaned Outputs | 2 (both justified) |
| Missing Inputs | 0 |
| Deliverable-Consumer Gaps | 0 |
| Runtime Path Gaps | 0 |
| Semantic Consistency Gaps | 0 |
| Discovery Coverage | 100% (38/38) |

**VERDICT: READY FOR ORCHESTRATION**
