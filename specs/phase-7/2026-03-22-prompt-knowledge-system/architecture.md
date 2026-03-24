# Feature: Model-Aware Prompt Knowledge System

**Epic:** --
**Status:** Ready
**Discovery:** `discovery.md` (same folder)
**Derived from:** Discovery constraints, NFRs, and risks

---

## Problem & Solution

**Problem:**
- Der Prompt Improver hat nur flache, einzeilige Modell-Hints (z.B. "FLUX models: Detailed scene descriptions, specific art styles")
- Der Assistant kennt das vom User gewaehlte Bildgenerierungs-Modell nicht und kann keine modellspezifischen Prompt-Tipps geben
- Der Canvas Chat hat kein Prompting-Wissen und optimiert Prompts nicht fuer das aktuelle Modell
- Alle 3 Systeme ignorieren den Generierungs-Modus (txt2img vs img2img) bei der Prompt-Erstellung
- Umfangreiches Prompting-Wissen aus professionellen Quellen existiert (best-practices-prompting.md), wird aber nicht genutzt

**Solution:**
- Zentrale Prompt-Knowledge-Datei (`/data/prompt-knowledge.json`) mit modell- und modus-spezifischem Wissen
- Deterministisches Prefix-Matching (Model-ID -> Knowledge-Sektion)
- System-Prompt-Injection in alle 3 Systeme (Improver, Assistant, Canvas Chat)

**Business Value:**
- Hoehere Prompt-Qualitaet = bessere Bildqualitaet = zufriedenere User
- Modellspezifische Optimierung nutzt die Staerken jedes Modells voll aus
- Modus-Awareness verhindert kontraproduktive Prompt-Muster (z.B. Quality-Tags bei Flux)

---

## Scope & Boundaries

| In Scope |
|----------|
| Knowledge-Datei mit Prompting-Wissen fuer 8 Modell-Familien: Flux 2, Nano Banana 2, GPT Image 1.5, Seedream 4.5/5, Stable Diffusion, Recraft V4, Ideogram, Hunyuan |
| Prefix-basiertes Matching: Model-ID -> Knowledge-Sektion |
| Modus-spezifisches Wissen (txt2img, img2img) |
| System-Prompt-Injection im Improver (prompt-service.ts) |
| Dynamische System-Prompt-Injection im Assistant (prompts.py) |
| System-Prompt-Erweiterung im Canvas Chat (canvas_graph.py) |
| Verbesserung der recommend_model Logik mit Knowledge-Daten |

| Out of Scope |
|--------------|
| RAG / Embedding-basierte Retrieval |
| Nicht-Replicate-Modelle (Midjourney, Adobe Firefly) |
| UI-Aenderungen (keine neuen Buttons, Screens oder Komponenten) |
| Neues LLM-Tool (kein get_prompting_tips Tool) |
| Inpaint/Outpaint/Upscale-spezifisches Prompting-Wissen |
| Automatische Aktualisierung der Knowledge-Datei |

---

## API Design

### Overview

| Aspect | Specification |
|--------|---------------|
| Style | Existing REST endpoints (no new endpoints) |
| Authentication | Existing auth (unchanged) |
| Rate Limiting | Existing limits (unchanged) |

### Endpoints (modified)

| Method | Path | Change | Reason |
|--------|------|--------|--------|
| POST | `/api/assistant/sessions/{id}/messages` | Add optional `image_model_id` (string) + `generation_mode` (string) to request body | Assistant needs current workspace image model + mode for knowledge injection |

### Data Transfer Objects (DTOs)

| DTO | Change | Fields Added | Validation | Notes |
|-----|--------|--------------|------------|-------|
| `SendMessageRequest` (Python, `backend/app/models/dtos.py`) | EXTEND | `image_model_id: Optional[str]`, `generation_mode: Optional[str]` | `image_model_id`: max 200 chars; `generation_mode`: Literal["txt2img", "img2img"] or None | Both optional for backward compatibility |
| `improvePrompt` input (TS, `app/actions/prompts.ts`) | EXTEND | `generationMode: string` | Must be valid GenerationMode | Passed through to PromptService |
| `LLMComparisonProps` (TS, `components/prompt-improve/llm-comparison.tsx`) | EXTEND | `generationMode: GenerationMode` | Type-safe via GenerationMode type | Passed to improvePrompt action |

---

## Database Schema

Keine Datenbank-Aenderungen. Die Knowledge-Datei ist eine statische JSON-Datei im Repo.

---

## Server Logic

### Services & Processing

| Service | Responsibility | Input | Output | Side Effects |
|---------|----------------|-------|--------|--------------|
| **Knowledge Lookup (TS)** — new function in `lib/services/prompt-knowledge.ts` | Load `prompt-knowledge.json`, match model-ID by longest prefix, return model + mode knowledge section | `modelId: string`, `mode?: GenerationMode` | `{ model: ModelKnowledge, mode?: ModeKnowledge } \| fallback` | None (pure function, file read cached at module level) |
| **Knowledge Lookup (Python)** — new module `backend/app/agent/prompt_knowledge.py` | Same logic as TS version, load JSON + longest-prefix match | `model_id: str`, `mode: str \| None` | `dict` with model + mode knowledge or fallback | None (pure function, file read cached at module level) |
| **buildSystemPrompt** (TS, `lib/services/prompt-service.ts`) | EXTEND: Replace static model hints with knowledge lookup, add generationMode param | `modelId`, `modelDisplayName`, `generationMode` | System prompt string with injected knowledge section | None |
| **build_assistant_system_prompt** (Python, `backend/app/agent/prompts.py`) | NEW function replacing `SYSTEM_PROMPT` constant. Inject knowledge based on image_model_id + generation_mode | `image_model_id: str \| None`, `generation_mode: str \| None` | System prompt string with knowledge section appended | None |
| **build_canvas_system_prompt** (Python, `backend/app/agent/canvas_graph.py`) | EXTEND: After building context section, load knowledge for model_id and append prompting tips | `image_context: dict \| None` | System prompt string with knowledge section appended | None |
| **_MATCHING_RULES enrichment** (Python, `backend/app/agent/tools/model_tools.py`) | EXTEND: Load model strengths from knowledge file, use for better reason strings | `prompt_summary`, `style_keywords`, `available_models` | Match result with knowledge-enriched reason | None |

### Business Logic Flow

```
[Improver]
UI (prompt, modelId, generationMode)
  -> Server Action (improvePrompt)
    -> PromptService.improve(prompt, modelId, generationMode)
      -> buildSystemPrompt(modelId, displayName, generationMode)
        -> getPromptKnowledge(modelId, generationMode)  [TS lookup]
          -> prompt-knowledge.json (cached)
      -> OpenRouter LLM call with enriched system prompt

[Assistant]
UI (content, image_model_id, generation_mode)
  -> POST /sessions/{id}/messages
    -> AssistantService.stream_response(session_id, content, ..., image_model_id, generation_mode)
      -> config["configurable"]["image_model_id"] = image_model_id
      -> config["configurable"]["generation_mode"] = generation_mode
      -> _call_model_async(state, config)
        -> build_assistant_system_prompt(image_model_id, generation_mode)
          -> get_prompt_knowledge(model_id, mode)  [Python lookup]
            -> prompt-knowledge.json (cached)

[Canvas Chat]
  -> build_canvas_system_prompt(image_context)
    -> model_id = image_context["model_id"]  (already available)
    -> get_prompt_knowledge(model_id, None)  [Python lookup]
    -> append knowledge section to system prompt

[recommend_model]
  -> _match_model(prompt_summary, style_keywords, available_models)
    -> get_prompt_knowledge(matched_model_id)
    -> use strengths for enhanced reason string
```

### Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `generationMode` (TS action) | Must be valid GenerationMode from `lib/types.ts` | "Ungueltiger Generierungsmodus" |
| `image_model_id` (Python DTO) | Optional string, max 200 chars | Pydantic validation error |
| `generation_mode` (Python DTO) | Optional, one of "txt2img", "img2img" or None | Pydantic validation error |

---

## Security

### Authentication & Authorization

| Area | Mechanism | Notes |
|------|-----------|-------|
| All endpoints | Existing auth (unchanged) | No new endpoints, no new auth needed |
| Knowledge data | Static file in repo (read-only) | No user-writable data, no injection risk |

### Data Protection

| Data Type | Protection | Notes |
|-----------|------------|-------|
| Knowledge JSON | Repo-level access control | No sensitive data, public model info |
| image_model_id field | Input validation (max length) | Prevents oversized payload |

### Input Validation & Sanitization

| Input | Validation | Sanitization |
|-------|------------|--------------|
| `image_model_id` | Pydantic `Optional[str]`, max_length=200 | Truncation not needed, validation rejects |
| `generation_mode` | Pydantic `Optional[Literal["txt2img", "img2img"]]` | Enum validation by Pydantic |
| `generationMode` (TS) | TypeScript type `GenerationMode` | Compile-time type safety |
| Knowledge JSON content injected into prompt | Static file, no user input | Content curated in repo, not user-controlled |

### Rate Limiting & Abuse Prevention

Keine Aenderungen. Bestehende Rate Limits gelten weiterhin.

---

## Architecture Layers

### Layer Responsibilities

| Layer | Responsibility | Pattern |
|-------|----------------|---------|
| **Data Layer** (`data/prompt-knowledge.json`) | Store curated prompt knowledge per model+mode | Static JSON file, cached at module load |
| **Knowledge Service** (TS: `lib/services/prompt-knowledge.ts`, Python: `backend/app/agent/prompt_knowledge.py`) | Lookup: model-ID prefix matching, mode filtering, fallback | Pure function, module-level cache |
| **Prompt Builder** (TS: `prompt-service.ts`, Python: `prompts.py`, `canvas_graph.py`) | Inject knowledge into system prompts | EXTEND existing functions |
| **API/DTO** (Python: `dtos.py`, TS: `prompts.ts` action) | Pass model context through request chain | EXTEND existing DTOs |
| **Frontend** (TS: `prompt-area.tsx`, `llm-comparison.tsx`, `use-assistant-runtime.ts`) | Pass generationMode/image_model_id to backend | EXTEND existing call sites |

### Data Flow

```
prompt-knowledge.json
        |
        v
[TS Knowledge Lookup]          [Python Knowledge Lookup]
        |                               |
        v                               v
[buildSystemPrompt]       [build_assistant_system_prompt]    [build_canvas_system_prompt]
        |                               |                            |
        v                               v                            v
[Improver LLM call]       [Assistant LLM call]             [Canvas Chat LLM call]
```

### Error Handling Strategy

| Error Type | Handling | User Response | Logging |
|------------|----------|---------------|---------|
| Knowledge file not found | Fallback to generic knowledge (embedded in code) | No visible error, generic prompting tips | Warning log |
| No prefix match | Use `fallback` section from knowledge file | No visible error, generic tips | Debug log |
| Invalid generationMode | TS: compile error. Python: Pydantic 422 | Action/API error response | Info log |
| Malformed JSON in knowledge file | App startup failure (cached at load) | App doesn't start | Error log |

---

## Migration Map

| Existing File | Current Pattern | Target Pattern | Specific Changes |
|---|---|---|---|
| `lib/services/prompt-service.ts` | `buildSystemPrompt(modelId, displayName)` with static inline model hints (lines 6-36) | `buildSystemPrompt(modelId, displayName, generationMode)` with knowledge lookup replacing static hints | Add `generationMode` param. Import + call `getPromptKnowledge()`. Replace static hint block (lines 24-31) with formatted knowledge section. |
| `lib/services/prompt-service.ts` | `improve(prompt, modelId)` | `improve(prompt, modelId, generationMode)` | Add `generationMode` param, pass to `buildSystemPrompt`. |
| `app/actions/prompts.ts` | `improvePrompt({ prompt, modelId })` | `improvePrompt({ prompt, modelId, generationMode })` | Add `generationMode` to input, validate, pass to `PromptService.improve`. |
| `components/prompt-improve/llm-comparison.tsx` | `LLMComparisonProps { prompt, modelId, modelDisplayName }` | `LLMComparisonProps { prompt, modelId, modelDisplayName, generationMode }` | Add `generationMode` prop, pass to `improvePrompt`. |
| `components/workspace/prompt-area.tsx` | `<LLMComparison prompt={...} modelId={...} modelDisplayName={...} />` | `<LLMComparison ... generationMode={currentMode} />` | Pass `currentMode` (already available at line 134) as `generationMode` prop. |
| `backend/app/agent/prompts.py` | `SYSTEM_PROMPT` as static string constant | `build_assistant_system_prompt(image_model_id, generation_mode)` function | Convert constant to function. Import `get_prompt_knowledge`. Append knowledge section when model context provided. Keep base prompt unchanged. |
| `backend/app/agent/graph.py` | `SystemMessage(content=SYSTEM_PROMPT)` at lines 237, 244 | `SystemMessage(content=build_assistant_system_prompt(image_model_id, generation_mode))` reading from `config["configurable"]` | Read `image_model_id` + `generation_mode` from config, pass to new function. |
| `backend/app/agent/canvas_graph.py` | `build_canvas_system_prompt(image_context)` returns base + context section | Same function, additionally appends knowledge section from `get_prompt_knowledge(model_id)` | After context_section, call `get_prompt_knowledge(model_id)`, format as prompting tips block, append to prompt. |
| `backend/app/agent/tools/model_tools.py` | `_MATCHING_RULES` with static `reason_de` strings | Same rules enriched: `_match_model` uses knowledge strengths for enhanced reasons | Import `get_prompt_knowledge`. After matching, look up model strengths and include in reason string. |
| `backend/app/models/dtos.py` | `SendMessageRequest { content, image_urls, model }` | `SendMessageRequest { content, image_urls, model, image_model_id, generation_mode }` | Add `image_model_id: Optional[str]` and `generation_mode: Optional[Literal["txt2img","img2img"]]` fields. |
| `backend/app/routes/messages.py` | `_service.stream_response(session_id, content, image_urls, model)` | `_service.stream_response(..., image_model_id, generation_mode)` | Pass new fields from request to service. |
| `backend/app/services/assistant_service.py` | `stream_response(session_id, content, image_urls, model)` with config `{ thread_id, pending_image_urls, model }` | `stream_response(..., image_model_id, generation_mode)` with config extending `{ ..., image_model_id, generation_mode }` | Add params, forward to `config["configurable"]`. |
| `lib/assistant/use-assistant-runtime.ts` | `sendMessageToSession` body: `{ content, model, image_urls? }` | Body: `{ content, model, image_urls?, image_model_id?, generation_mode? }` | Read `modelId` + `currentMode` from workspace state, include in request body. |
| `lib/assistant/assistant-context.tsx` | `sendMessage(content, imageUrls?)` | `sendMessage(content, imageUrls?)` with internal access to workspace model + mode | Pass workspace `modelId` + `currentMode` through to `sendMessageToSession`. Access via existing workspace state. |

---

## Constraints & Integrations

### Constraints

| Constraint | Technical Implication | Solution |
|------------|----------------------|----------|
| Knowledge-Datei muss von TS und Python lesbar sein | JSON als einziges universelles Format zwischen Next.js und FastAPI | Single `data/prompt-knowledge.json`, loaded independently by each runtime |
| Max ~500 Tokens injiziertes Wissen pro Request | Knowledge sections must be compact | Per-model section: ~200 tokens. Per-mode section: ~100 tokens. Total with formatting: ~400-500 tokens |
| Prefix-Matching: laengster Match gewinnt | Need sorted prefix comparison | Sort prefixes by length descending, first match wins. E.g. "flux-2-pro" > "flux-2" > "flux" |
| Modus-Wissen ist optional pro Modell | Lookup must handle missing mode sections gracefully | Return model knowledge only when no mode match; never fail |
| Kein neues LLM-Tool | All injection happens at system-prompt level | Pure prompt engineering, no tool_calls for knowledge retrieval |
| Python dependency management: `pyproject.toml` ist Source of Truth | `backend/requirements.txt` existiert als Legacy-File ohne Version-Pins. `pyproject.toml` enthaelt die korrekten Minimum-Versionen | Alle Version-Referenzen in dieser Architecture beziehen sich auf `pyproject.toml`. `requirements.txt` wird in diesem Feature nicht angefasst (pre-existing, out of scope) |

### Integrations

| Area | System / Capability | Interface | Version | Notes |
|------|----------------------|-----------|---------|-------|
| Frontend | Next.js | App Router, Server Actions | 16.1.6 (project) | `improvePrompt` action extended |
| Frontend | React | Hooks, Context | 19.2.3 (project) | Workspace state already available |
| Backend | FastAPI | REST + SSE | >=0.135.0 (project) | SendMessageRequest DTO extended |
| Backend | LangGraph | RunnableConfig configurable dict | >=1.1.0 (project) | Pattern already used for thread_id, model |
| Backend | LangChain OpenAI | ChatOpenAI | >=1.1.10 (project) | System prompt injection via SystemMessage |
| Backend | Pydantic | BaseModel DTOs | >=2.13.0 (via pydantic-settings, project) | Optional fields for backward compat |
| LLM | OpenRouter (Gemini 3.1 Pro Preview) | Chat Completions API | -- | Improver LLM (unchanged) |
| Data | prompt-knowledge.json | File system read, JSON.parse / json.load | -- | Module-level cache (read once) |

---

## Quality Attributes (NFRs)

### From Discovery -> Technical Solution

| Attribute | Target | Technical Approach | Measure / Verify |
|-----------|--------|--------------------|------------------|
| Latency | No measurable added latency (<5ms) | Module-level cache: JSON loaded once at import/startup, subsequent lookups are in-memory dict access | Compare Improver/Assistant response times before/after |
| Token Budget | Max ~500 tokens injected per request | Knowledge sections authored to stay within budget. Template: model section (~200 tokens) + mode section (~100 tokens) + formatting (~50 tokens) | Count tokens in sample injections for all 8 models |
| Backward Compatibility | Existing API contracts unchanged | All new fields optional (Python: Optional, TS: optional param). Missing fields = no knowledge injection = current behavior | Existing tests pass without modification |
| Maintainability | Easy to add new models | One JSON file edit to add a model. No code changes needed for new model knowledge | Add test model, verify lookup works |
| Correctness | Longest prefix match deterministic | Prefixes sorted by length descending. Unit tests for all 8 model families + edge cases | Unit test coverage for lookup function |

### Monitoring & Observability

| Metric | Type | Target | Alert |
|--------|------|--------|-------|
| Knowledge lookup miss (no prefix match) | Counter (log) | < 10% of requests | None (uses fallback) |
| Knowledge file load failure | Error log | 0 after startup | App won't start (fail-fast) |

---

## Risks & Assumptions

### Assumptions

| Assumption | Technical Validation | Impact if Wrong |
|------------|---------------------|-----------------|
| `currentMode` (GenerationMode) is available in prompt-area.tsx at LLMComparison mount | Confirmed: `prompt-area.tsx:134` — `useState<GenerationMode>("txt2img")` | N/A (validated) |
| `modelId` (resolved) is available in prompt-area.tsx at LLMComparison mount | Confirmed: `prompt-area.tsx:1000-1001` — `resolveModel()` called | N/A (validated) |
| `model_id` is available in Canvas Chat image_context | Confirmed: `canvas_graph.py:218`, `canvas_sessions.py:57` CanvasImageContext.model_id | N/A (validated) |
| RunnableConfig configurable dict accepts arbitrary keys | Confirmed: `graph.py:158-163` already passes custom keys | N/A (validated) |
| Module-level JSON load in Python is fast enough | JSON ~5KB, parsed once at import | If slow: lazy-load with cache decorator. Unlikely. |
| Frontend can access workspace modelId + currentMode in assistant-context | Need to verify: assistant-context.tsx has access to workspace state or can receive it | If not: pass via sendMessage params or React context. Plumbing needed. |

### Risks & Mitigation

| Risk | Likelihood | Impact | Technical Mitigation | Fallback |
|------|------------|--------|---------------------|----------|
| Knowledge file grows too large (>500 token budget per model) | Medium | Low — slightly longer prompts, higher cost | Authoring guidelines: max 6 tips, max 4 strengths, max 4 avoid per model | Truncate to first N items if over budget |
| Model-IDs change format (Replicate convention change) | Low | High — prefix matching breaks | Prefix-based (not exact match) is resilient to suffixes. Monitor model sync. | Update prefixes in JSON, no code change |
| Assistant sendMessage needs workspace state but can't access it | Medium | Medium — Slice 3 requires extra plumbing | Options: (A) Pass via sendMessage params, (B) Lift workspace state to shared context, (C) Add separate API call | Use approach (A): extend sendMessage signature or use refs |
| Knowledge content has LLM-confusing formatting | Low | Medium — LLM ignores tips or misapplies | Template format tested with target LLMs. Use clear section headers + bullet lists. | Iterate on formatting |

---

## Technology Decisions

### Stack Choices

| Area | Technology | Rationale |
|------|------------|-----------|
| Knowledge Storage | JSON file (`data/prompt-knowledge.json`) | Simplest cross-stack format. Readable by both TS (import/require or fs.readFile) and Python (json.load). No DB needed for static data. |
| Lookup Pattern | Longest-prefix match (deterministic) | Finite model set, clear prefix hierarchy. No ML/embeddings needed. O(n) with n=~10 prefixes. |
| Cache Strategy | Module-level (read once at import) | JSON is <10KB. No benefit from external cache (Redis etc.). File changes require restart — acceptable for curated data. |
| Knowledge Format | Structured JSON with typed sections | Enables programmatic access (tips[], strengths[], avoid[]). Alternative (Markdown) harder to parse selectively. |

### Trade-offs

| Decision | Pro | Con | Mitigation |
|----------|-----|-----|------------|
| Single JSON file (not DB) | No migration, no schema, no runtime dependency, cross-stack readable | Requires redeploy for updates | Acceptable: knowledge changes are infrequent, tied to new model releases |
| Duplicate lookup (TS + Python) | Each runtime independent, no cross-process communication needed | Logic duplication, potential drift | Same JSON schema. Unit tests in both runtimes. Lookup logic is ~20 lines. |
| Module-level cache (not per-request) | Zero latency overhead after first load | Stale if file changes at runtime | Acceptable: file is in repo, changes via deploy |
| Optional fields (backward compat) | No breaking API changes, gradual rollout | Frontend must explicitly send new fields | Clear migration map. Defaults = no injection = current behavior. |

---

## Knowledge File Schema

### `data/prompt-knowledge.json` Structure

```
{
  "models": {
    "{prefix}": {
      "displayName": string,        // e.g. "Flux 2 Pro/Max"
      "promptStyle": "natural" | "keywords",
      "negativePrompts": {
        "supported": boolean,
        "note": string               // e.g. "Use semantic negatives in main prompt"
      },
      "strengths": string[],         // 2-4 items
      "tips": string[],              // 3-6 items
      "avoid": string[],             // 2-4 items
      "modes": {                     // optional
        "txt2img": {
          "tips": string[]           // 2-4 mode-specific tips
        },
        "img2img": {
          "tips": string[]
        }
      }
    }
  },
  "fallback": {
    "displayName": "Generic",
    "tips": string[],
    "avoid": string[]
  }
}
```

### Prefix Matching Algorithm

```
Input: modelId = "black-forest-labs/flux-2-pro-ultra"
Prefixes (sorted by length desc): ["flux-2-pro", "flux-2", "flux-schnell", "nano-banana", ...]

1. Extract name part: "flux-2-pro-ultra" (after last "/", or full string if no "/")
2. For each prefix (longest first):
   if name.startsWith(prefix):
     return models[prefix]
3. Return fallback
```

### Covered Prefixes

| Prefix | Matches | Knowledge Source |
|--------|---------|-----------------|
| `flux-2` | flux-2-pro, flux-2-max, flux-2-flex | best-practices-prompting.md |
| `flux-schnell` | flux-schnell | best-practices-prompting.md (reduced) |
| `nano-banana` | nano-banana-2, nano-banana-pro | Web research (2026-03-22) |
| `gpt-image` | gpt-image-1.5 | best-practices-prompting.md |
| `seedream` | seedream-4.5, seedream-5, seedream-5-lite | Web research (2026-03-22) |
| `stable-diffusion` | stable-diffusion-3.5-* | best-practices-prompting.md |
| `recraft` | recraft-v4, recraft-v4-* | best-practices-prompting.md |
| `ideogram` | ideogram-3, ideogram-* | best-practices-prompting.md |
| `hunyuan` | hunyuan-image-3, hunyuan-* | best-practices-prompting.md |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| -- | (alle Fragen in Discovery geklaert) | -- | -- | -- |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-23 | Codebase | `buildSystemPrompt()` in prompt-service.ts:6-36 has static inline hints for 7 model families — to be replaced |
| 2026-03-23 | Codebase | `SYSTEM_PROMPT` in prompts.py is a static constant, not a function — must convert to function |
| 2026-03-23 | Codebase | Canvas Chat already implements dynamic system-prompt pattern in `build_canvas_system_prompt()` — reuse pattern for Assistant |
| 2026-03-23 | Codebase | `config["configurable"]` already carries thread_id, pending_image_urls, model — extending with image_model_id + generation_mode follows existing pattern |
| 2026-03-23 | Codebase | `currentMode` (GenerationMode) available at prompt-area.tsx:134, `resolvedModel.modelId` at line 1001 — no new state plumbing for Improver |
| 2026-03-23 | Codebase | `sendMessageToSession` in use-assistant-runtime.ts:339 builds body as `{ content, model, image_urls? }` — extend with image_model_id + generation_mode |
| 2026-03-23 | Codebase | No `/data/` directory exists yet — must be created |
| 2026-03-23 | Codebase | `_MATCHING_RULES` in model_tools.py:29-60 has 5 categories with static reason strings — can be enriched with knowledge strengths |
| 2026-03-23 | Codebase | Codebase scanner found 11 patterns: 6 REUSE, 7 EXTEND, 3 NEW, 1 AVOID |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| 1 | wireframes.md fehlt. Zuerst /zip:wireframe ausfuehren? | Nein, Feature hat keine UI — Wireframes nicht noetig |
