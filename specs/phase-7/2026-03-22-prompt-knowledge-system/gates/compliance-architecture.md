# Gate 1: Architecture Compliance Report

**Gepruefte Architecture:** `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md`
**Pruefdatum:** 2026-03-23
**Discovery:** `specs/phase-7/2026-03-22-prompt-knowledge-system/discovery.md`
**Wireframes:** N/A (Feature hat keine UI)
**Codebase Scan:** `specs/phase-7/2026-03-22-prompt-knowledge-system/codebase-scan.md`

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 30 |
| BLOCKING | 0 |

**Verdict:** APPROVED

---

## A) Feature Mapping

| Discovery Feature | Architecture Section | API Endpoint | DB Schema | Status |
|---|---|---|---|---|
| Knowledge-Datei mit 8 Modell-Familien | Knowledge File Schema, Covered Prefixes (9 prefixes) | N/A (static file) | N/A (no DB) | PASS |
| Prefix-basiertes Matching | Prefix Matching Algorithm (arch lines 366-375) | N/A (internal logic) | N/A | PASS |
| Modus-spezifisches Wissen (txt2img, img2img) | Knowledge File Schema: `models.{prefix}.modes` | N/A | N/A | PASS |
| Improver Knowledge-Injection (prompt-service.ts) | Server Logic: buildSystemPrompt EXTEND, Migration Map: prompt-service.ts | N/A (Server Action) | N/A | PASS |
| Assistant Knowledge-Injection (prompts.py) | Server Logic: build_assistant_system_prompt NEW, Migration Map: prompts.py + graph.py | POST `/sessions/{id}/messages` EXTEND | N/A | PASS |
| Canvas Chat Knowledge-Injection (canvas_graph.py) | Server Logic: build_canvas_system_prompt EXTEND, Migration Map: canvas_graph.py | N/A (existing endpoint) | N/A | PASS |
| recommend_model Enhancement (model_tools.py) | Server Logic: _MATCHING_RULES enrichment EXTEND, Migration Map: model_tools.py | N/A (existing tool) | N/A | PASS |

**All 7 Discovery In-Scope items are mapped in Architecture.**

---

## B) Constraint Mapping

| Constraint | Source | Architecture | Status |
|---|---|---|---|
| Knowledge NUR fuer aktive Replicate-Modelle | Discovery: Business Rules | Knowledge File Schema: 9 prefixes, all Replicate models | PASS |
| Fallback wenn kein Match | Discovery: Business Rules | Error Handling: "No prefix match -> Use fallback section from knowledge file" | PASS |
| Laengster Prefix gewinnt | Discovery: Business Rules | Prefix Matching Algorithm: "Sort prefixes by length descending, first match wins" | PASS |
| TS + Python lesbar | Discovery: Business Rules | Constraints: "JSON als einziges universelles Format between Next.js and FastAPI" + dual lookup modules | PASS |
| Modus-Wissen optional pro Modell | Discovery: Business Rules | Constraints: "Lookup must handle missing mode sections gracefully" + Error Handling: "Return model knowledge only when no mode match; never fail" | PASS |
| Max ~500 Tokens injiziert | Discovery: Business Rules | Constraints: "Per-model ~200 tokens + per-mode ~100 tokens + formatting ~50 = ~400-500" + NFR Token Budget | PASS |
| generationMode durchreichen (UI -> Action -> Service) | Discovery: Integration Sec 1 | DTOs: LLMComparisonProps EXTEND, improvePrompt EXTEND, buildSystemPrompt EXTEND | PASS |
| Assistant erhaelt Bildmodell + Modus via Message-Payload | Discovery: Integration Sec 2 + Q&A #14 | API: POST `/sessions/{id}/messages` + DTO: SendMessageRequest EXTEND | PASS |
| Canvas Chat nutzt model_id aus image_context | Discovery: Integration Sec 3 | Server Logic: build_canvas_system_prompt reads model_id from image_context (confirmed: canvas_graph.py:218) | PASS |

---

## C) Realistic Data Check

### Codebase Evidence

```
# Existing model-ID patterns (measured from codebase grep):
- "black-forest-labs/flux-2-max"       = 30 chars
- "black-forest-labs/flux-schnell"     = 30 chars
- "black-forest-labs/flux-2-pro"       = 28 chars

# Existing Pydantic validation patterns in dtos.py:
- content: max_length=5000
- image_urls: max_length=5 (list)
- title: max_length=255

# Existing GenerationMode type (lib/types.ts:21):
- "txt2img" | "img2img" | "upscale" | "inpaint" | "outpaint"
- Longest value: 8 chars ("outpaint")

# No DB schema changes -- no VARCHAR/TEXT columns to validate
# No Supabase migrations directory found in this worktree
```

### External API Analysis

No new external APIs introduced. The feature reads a static JSON file from the filesystem. Existing external APIs (OpenRouter, Replicate) remain unchanged.

### Data Type Verdicts

| Field | Arch Type | Evidence | Verdict |
|---|---|---|---|
| `image_model_id` (Python DTO) | `Optional[str]`, max_length=200 | Longest measured model ID: 30 chars ("black-forest-labs/flux-schnell"). 200 chars = 6.6x buffer. Consistent with existing pattern (DB model_id fields use varchar(255)). | PASS |
| `generation_mode` (Python DTO) | `Optional[Literal["txt2img", "img2img"]]` | Discovery Out of Scope: "Inpaint/Outpaint/Upscale-spezifisches Prompting-Wissen". Only txt2img + img2img are relevant for knowledge injection. Pydantic Literal enforces validation. | PASS |
| `generationMode` (TS action param) | `GenerationMode` type from `lib/types.ts` | Reuses existing type (12+ usages across codebase per scanner). Compile-time type safety. | PASS |
| `prompt-knowledge.json` content | JSON file, module-level cache | Static curated data (<10KB estimated). Loaded once at module import. No user input, no injection risk. | PASS |
| Knowledge section in system prompt | String (~400-500 tokens) | Injected into system prompt string. Existing system prompts are already multi-KB (prompts.py: 73 lines, canvas_graph.py base_prompt: 36 lines). ~500 additional tokens well within LLM context limits. | PASS |

---

## D) External Dependencies

### D1) Dependency Version Check

**Project type:** Existing (package.json + pyproject.toml present)

| Dependency | Arch Version | Pinning File | Pinned? | "Latest"? | Status |
|---|---|---|---|---|---|
| Next.js | 16.1.6 (project) | package.json: `"next": "16.1.6"` | PASS (exact) | No | PASS |
| React | 19.2.3 (project) | package.json: `"react": "19.2.3"` | PASS (exact) | No | PASS |
| FastAPI | >=0.135.0 (project) | pyproject.toml: `"fastapi>=0.135.0"` | PASS (range) | No | PASS |
| LangGraph | >=1.1.0 (project) | pyproject.toml: `"langgraph>=1.1.0"` | PASS (range) | No | PASS |
| LangChain OpenAI | >=1.1.10 (project) | pyproject.toml: `"langchain-openai>=1.1.10"` | PASS (range) | No | PASS |
| Pydantic (via pydantic-settings) | >=2.13.0 (project) | pyproject.toml: `"pydantic-settings>=2.13.0"` | PASS (range) | No | PASS |
| OpenRouter (Gemini 3.1 Pro Preview) | -- (LLM API, not a library) | N/A | N/A | N/A | PASS |
| prompt-knowledge.json | -- (local file) | N/A | N/A | N/A | PASS |

**requirements.txt status:** Architecture Constraint explicitly documents: "Python dependency management: pyproject.toml ist Source of Truth. backend/requirements.txt existiert als Legacy-File ohne Version-Pins. requirements.txt wird in diesem Feature nicht angefasst (pre-existing, out of scope)." Verified: `pyproject.toml` contains proper minimum-version constraints. Previous blocking issue resolved.

### D2) External APIs & Services

| Dependency | Rate Limits | Auth | Errors | Timeout | Status |
|---|---|---|---|---|---|
| OpenRouter (Improver LLM) | Existing (unchanged) | Existing API key | Existing error handling in prompt-service.ts | Existing | PASS |
| Replicate Models API (model_service.py) | Existing (unchanged) | Existing API token | Existing error handling in model_service.py | Existing | PASS |
| prompt-knowledge.json (filesystem) | N/A | N/A | "Knowledge file not found -> Fallback to generic knowledge (Warning log)" + "Malformed JSON -> App startup failure (fail-fast)" | N/A | PASS |

---

## E) Pattern Consistency (Gate 1b)

### Scanner-Output Validation

| Check | Rule | Result | Status |
|---|---|---|---|
| AVOID has basis | AVOID #1 "Static inline model hints" -- Feature itself replaces lines 25-31 in prompt-service.ts. No .decisions.md exists, but the AVOID refers to code being replaced by this feature. | Valid | PASS |
| REUSE has evidence | All 6 REUSE items have count >= 1 with specific file+line locations referencing established patterns | Valid | PASS |
| Every recommendation has file path | All 17 items (6 REUSE + 7 EXTEND + 3 NEW + 1 AVOID) have concrete file paths with line numbers | Valid | PASS |

### Pattern Consistency Matrix

| Scanner Recommendation | Architecture Decision | Justified? | Status |
|---|---|---|---|
| REUSE #1: Dynamic system-prompt injection pattern (`canvas_graph.py:160-240`) | Architecture: `build_assistant_system_prompt` follows the same build-function + context-dict pattern as `build_canvas_system_prompt`. Documented in Server Logic + Research Log. | Yes | PASS |
| REUSE #2: `RunnableConfig["configurable"]` for per-request context (`graph.py:158-163`) | Architecture: Business Logic Flow shows `config["configurable"]["image_model_id"]`. Migration Map for `graph.py` reads from `config["configurable"]`. | Yes | PASS |
| REUSE #3: `GenerationMode` type (`lib/types.ts:21`) | Architecture: DTOs section uses `GenerationMode` type for `LLMComparisonProps` and `improvePrompt`. | Yes | PASS |
| REUSE #4: `modelIdToDisplayName()` utility (`model-display-name.ts:13`) | Architecture: `buildSystemPrompt` still receives `modelDisplayName` param. Utility continues to be used alongside knowledge data. | Yes | PASS |
| REUSE #5: `WorkspaceVariationState.modelId` + `currentMode` (`prompt-area.tsx:134,1000`) | Architecture: Migration Map for `prompt-area.tsx` references `currentMode` at line 134 and `resolveModel()` at line 1000 for data availability. Confirmed in codebase. | Yes | PASS |
| REUSE #6: LangGraph Agent State extension pattern (`state.py:12-43`) | Architecture: Uses `config["configurable"]` (REUSE #2) instead of state extension. Scanner noted "Can be reused if additional state fields are needed" -- architecture chose configurable dict, which is the established pattern for per-request context. | Yes | PASS |
| EXTEND #1: `buildSystemPrompt()` (`prompt-service.ts:6`) | Architecture: Migration Map adds `generationMode` param, replaces static hints (lines 24-31) with knowledge lookup. | Yes | PASS |
| EXTEND #2: `SYSTEM_PROMPT` -> dynamic function (`prompts.py:7`) | Architecture: Server Logic creates `build_assistant_system_prompt(image_model_id, generation_mode)` following canvas pattern. | Yes | PASS |
| EXTEND #3: `build_canvas_system_prompt()` (`canvas_graph.py:160`) | Architecture: Migration Map appends knowledge section after context_section via `get_prompt_knowledge(model_id)`. | Yes | PASS |
| EXTEND #4: `_MATCHING_RULES` + `_match_model()` (`model_tools.py:29-104`) | Architecture: Migration Map enriches rules with knowledge strengths for enhanced reason strings. | Yes | PASS |
| EXTEND #5: `improvePrompt` action + `PromptService.improve()` (`prompts.ts:68-99`) | Architecture: Migration Map adds `generationMode` through the chain: action -> service -> buildSystemPrompt. | Yes | PASS |
| EXTEND #6: `SendMessageRequest` DTO (`dtos.py:21`) | Architecture: DTOs section adds `image_model_id: Optional[str]` and `generation_mode: Optional[Literal["txt2img","img2img"]]`. | Yes | PASS |
| EXTEND #7: `AssistantService.stream_response()` (`assistant_service.py:117`) | Architecture: Migration Map forwards new fields to `config["configurable"]`. | Yes | PASS |
| NEW #1: `/data/prompt-knowledge.json` | Architecture: Knowledge File Schema section with full JSON structure. Scanner confirms "No data directory or knowledge file exists." Verified: `/data/` directory does not exist. | Yes | PASS |
| NEW #2: TS Knowledge Lookup function | Architecture: Server Logic documents `lib/services/prompt-knowledge.ts` with interface. Scanner confirms "No prefix-matching lookup utility exists." | Yes | PASS |
| NEW #3: Python Knowledge Lookup function | Architecture: Server Logic documents `backend/app/agent/prompt_knowledge.py` with interface. Scanner confirms "Same lookup logic needed on Python side." | Yes | PASS |
| AVOID #1: Static inline model hints | Architecture: Migration Map explicitly replaces lines 24-31 in prompt-service.ts with knowledge lookup. The AVOID target is the feature's raison d'etre. | Yes | PASS |

**All 17 scanner recommendations addressed. No ignored recommendations, no unjustified deviations.**

---

## F) Migration Completeness

> Scope does NOT contain migration trigger words ("Migration", "migrieren", "umstellen", "refactoren", "MIGRATED"). This is a new feature extending existing code, not a migration/refactoring.

N/A -- kein Migration-Scope.

**Informational:** Architecture includes a Migration Map with 14 file entries documenting all code changes. All entries use specific file paths (not directories), reference concrete line numbers, and specify target patterns detailed enough for test derivation.

---

## G) Completeness Check

| Section | Present? | Status |
|---|---|---|
| Problem & Solution | Yes | PASS |
| Scope & Boundaries | Yes (In Scope + Out of Scope) | PASS |
| API Design | Yes (1 modified endpoint + 3 DTOs) | PASS |
| Database Schema | Yes (explicitly "Keine Datenbank-Aenderungen") | PASS |
| Server Logic (Services & Processing) | Yes (6 services documented) | PASS |
| Business Logic Flow | Yes (4 flows: Improver, Assistant, Canvas Chat, recommend_model) | PASS |
| Validation Rules | Yes (3 rules) | PASS |
| Security (Auth, Data Protection, Input Validation) | Yes (4 sections) | PASS |
| Architecture Layers | Yes (5 layers + data flow diagram) | PASS |
| Error Handling Strategy | Yes (4 error types) | PASS |
| Migration Map | Yes (14 files with specific changes) | PASS |
| Constraints & Integrations | Yes (6 constraints + 8 integrations) | PASS |
| Quality Attributes (NFRs) | Yes (5 attributes + 2 monitoring metrics) | PASS |
| Risks & Assumptions | Yes (6 assumptions + 4 risks with mitigations) | PASS |
| Technology Decisions | Yes (4 stack choices + 4 trade-offs) | PASS |
| Knowledge File Schema | Yes (full JSON structure + algorithm) | PASS |
| Open Questions | Yes (all resolved in Discovery) | PASS |

---

## Blocking Issues

None.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0

**Next Steps:**
- [ ] Proceed to slice implementation (Slice 1: Knowledge-Datei + Lookup)
