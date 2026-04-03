# Gate 1: Architecture Compliance Report

**Gepruefte Architecture:** `specs/phase-7/2026-03-29-prompt-simplification/architecture.md`
**Pruefdatum:** 2026-03-29
**Discovery:** `specs/phase-7/2026-03-29-prompt-simplification/discovery.md`
**Wireframes:** `specs/phase-7/2026-03-29-prompt-simplification/wireframes.md`
**Codebase Scan:** `specs/phase-7/2026-03-29-prompt-simplification/codebase-scan.md`

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 44 |
| BLOCKING | 0 |

**Verdict:** APPROVED

---

## A) Feature Mapping

| Discovery Feature | Architecture Section | API Endpoint | DB Schema | Status |
|-------------------|---------------------|--------------|-----------|--------|
| Remove Style/Modifier + Negative Prompt textareas | UI Components, Migration Map (prompt-area.tsx) | N/A (UI only) | N/A | PASS |
| Simplify Per-Mode State (Txt2ImgState, Img2ImgState) | Migration Map (prompt-area.tsx) | N/A | N/A | PASS |
| Remove negative_prompt from API calls | Server Logic (GenerationService.generate) | Replicate Prediction API | N/A | PASS |
| Remove Style-Concatenation | Server Logic (GenerationService.generate) | N/A | N/A | PASS |
| Remove promptStyle/negativePrompt from Server Action | API Design (Server Action Interface Change) | generateImages action | N/A | PASS |
| Assistant Backend: prompt_tools.py 1-Field-Output | Python Backend Changes (prompt_tools.py) | SSE tool-call-result | N/A | PASS |
| Assistant Backend: prompts.py System-Prompt | Python Backend Changes (prompts.py) | N/A | N/A | PASS |
| Assistant Backend: state.py draft_prompt | Python Backend Changes (state.py) | N/A | N/A | PASS |
| Assistant Backend: DraftPromptDTO on 1 field | Python Backend Changes (dtos.py) | N/A | N/A | PASS |
| Assistant Frontend: assistant-context.tsx DraftPrompt | Migration Map (assistant-context.tsx) | N/A | N/A | PASS |
| Assistant Frontend: use-assistant-runtime.ts SSE-Parsing | Migration Map (use-assistant-runtime.ts) | N/A | N/A | PASS |
| Assistant Frontend: getWorkspaceFieldsForChip on 1 field | Migration Map (assistant-context.tsx) | N/A | N/A | PASS |
| Prompt Knowledge: negativePrompts cleanup | Python Backend Changes (prompt_knowledge.py) + Data Files | N/A | N/A | PASS |
| DB: Drop prompt_style + negative_prompt columns | Database Schema (Migration 0012) | N/A | generations table | PASS |
| DB: Adapt queries (createGeneration, getPromptHistory, getFavorites, getSiblings) | Database Schema (Query Changes) | N/A | generations table | PASS |
| Prompt History Service: remove promptStyle/negativePrompt | Server Logic (promptHistoryService) | N/A | N/A | PASS |
| Canvas VariationPopover: remove promptStyle/negativePrompt | Migration Map (variation-popover.tsx) | N/A | N/A | PASS |
| Canvas DetailsOverlay: remove Style/Negative sections | Migration Map (details-overlay.tsx) | N/A | N/A | PASS |
| Canvas canvas-detail-view: remove promptStyle/negativePrompt from calls | Migration Map (canvas-detail-view.tsx) | N/A | N/A | PASS |
| PromptTabs/HistoryList/FavoritesList: remove props | Migration Map (prompt-tabs.tsx, history-list.tsx, favorites-list.tsx) | N/A | N/A | PASS |
| WorkspaceVariationState: remove fields | Migration Map (workspace-state.tsx) | N/A | N/A | PASS |
| Tests: All affected tests | Scope (line 59) + Research Log (66 test files) | N/A | N/A | PASS |

---

## B) Constraint Mapping

| Constraint | Source | Wireframe Ref | Architecture | Status |
|------------|--------|---------------|--------------|--------|
| Single prompt textarea replaces 3 fields | Discovery: Scope In | Screen: Prompt Area After (txt2img/img2img) | Migration Map removes 2 textareas + 2 collapsibles from prompt-area.tsx | PASS |
| Label changes from "Motiv" to "Prompt" | Wireframes: Annotation 1 | Screen: Prompt Area After | Covered by prompt-area.tsx changes in Migration Map | PASS |
| Placeholder changes to "Describe your image, including style and mood..." | Wireframes: Annotation 1 | Screen: Prompt Area After | Covered by prompt-area.tsx migration target | PASS |
| Prompt Tools row (Assistant, Improve, Clear) unchanged | Wireframes: Annotation 2 | Screen: Prompt Area After | Out of Scope table confirms no changes to parameter panel; tools row not modified | PASS |
| Assistant draft: single prompt block (was 3 blocks) | Wireframes: Screen: Assistant Draft Apply After | Annotation 1 | DraftPrompt interface simplification in Migration Map (assistant-context.tsx) | PASS |
| Apply button maps 1 field instead of 3 | Wireframes: Screen: Assistant Draft Apply After | Annotation 2 | applyToWorkspace simplification in Migration Map (assistant-context.tsx lines 498-504) | PASS |
| SSE Breaking Change: atomic deploy required | Discovery: Risks | N/A | Constraints section: "Atomic deploy: Frontend + Backend gleichzeitig deployen" | PASS |
| DB Migration irreversible, data loss accepted | Discovery: Risks | N/A | Migration section: Reversibility "Irreversibel -- historische Daten gehen verloren (akzeptiert per Discovery)" | PASS |
| State variations: empty, typing, generating, assistant-draft | Wireframes: State Variations table | N/A | No conflict; states handled by existing React component patterns | PASS |
| Old LangGraph checkpoint compatibility | Discovery: Risks | N/A | Error Handling: "session restore maps old shape: `{prompt: draft.motiv}`" | PASS |

---

## C) Realistic Data Check

### Codebase Evidence

```
# Existing column types in lib/db/schema.ts for generations table:
prompt:                text("prompt").notNull()
negativePrompt:        text("negative_prompt")            -- to be DROPPED
promptMotiv:           text("prompt_motiv").notNull().default("")
promptStyle:           text("prompt_style").default("")    -- to be DROPPED
modelId:               varchar("model_id", { length: 255 })
status:                varchar("status", { length: 20 })
imageUrl:              text("image_url")
replicatePredictionId: varchar("replicate_prediction_id", { length: 255 })
errorMessage:          text("error_message")

# Pattern: All prompt/text content fields use TEXT (not VARCHAR)
# Pattern: Enum-like fields use VARCHAR(20)
# Pattern: External IDs use VARCHAR(255)
```

### External API Analysis

| API | Field | Measured Length | Sample | Arch Type | Recommendation |
|-----|-------|----------------|--------|-----------|----------------|
| Replicate Prediction API | input.prompt | Unbounded (TEXT) | User-generated prompt text | text (unchanged) | PASS -- TEXT is correct for unbounded user input |
| Replicate Prediction API | input.negative_prompt | N/A (being removed) | N/A | N/A | PASS -- field is being removed entirely |

### Data Type Verdicts

| Field | Arch Type | Evidence | Verdict | Issue |
|-------|-----------|----------|---------|-------|
| generations.prompt | text (NOT NULL) | Unchanged, already TEXT in schema.ts:60 | PASS | None |
| generations.prompt_motiv | text (NOT NULL, default "") | Unchanged, already TEXT in schema.ts:71 | PASS | None |
| generations.prompt_style | text (default "") | Being DROPPED -- confirmed in schema.ts:72 | PASS | Drop is correct |
| generations.negative_prompt | text (nullable) | Being DROPPED -- confirmed in schema.ts:61 | PASS | Drop is correct |
| DraftPromptDTO.prompt (Python) | str (Pydantic) | Replaces motiv/style/negative_prompt (all str) with single str. Verified at dtos.py:146-151 | PASS | Pydantic str maps correctly |
| DraftPrompt.prompt (TypeScript) | string | Replaces {motiv, style, negativePrompt} (all string). Verified at assistant-context.tsx:25-29 | PASS | TS string is unbounded |
| SSE payload `{prompt: string}` | JSON string | Replaces `{motiv, style, negative_prompt}` (all JSON strings). Verified at use-assistant-runtime.ts:186-204 | PASS | No size constraints needed |

No data type issues found. This feature removes columns and simplifies interfaces -- no new data types are introduced. All existing types (TEXT for prompt content, VARCHAR for enums/IDs) follow established codebase patterns.

---

## D) External Dependencies

### D1) Dependency Version Check

**Project Type:** Existing (package.json and pyproject.toml present)

| Dependency | Arch Version | Pinning File | Pinned? | "Latest"? | Status |
|------------|-------------|--------------|---------|-----------|--------|
| Next.js | 16.1.6 | package.json: `"next": "16.1.6"` | PASS (exact) | No | PASS |
| React | 19.2.3 | package.json: `"react": "19.2.3"` | PASS (exact) | No | PASS |
| Drizzle ORM | 0.45.1 | package.json: `"drizzle-orm": "^0.45.1"` | PASS (caret) | No | PASS |
| Drizzle Kit | 0.31.9 | package.json: `"drizzle-kit": "^0.31.9"` | PASS (caret) | No | PASS |
| Replicate | 1.4.0 | package.json: `"replicate": "^1.4.0"` | PASS (caret) | No | PASS |
| LangGraph (Python) | >=1.1.0 | pyproject.toml: `"langgraph>=1.1.0"` | PASS (lower bound) | No | PASS |
| Pydantic (Python) | >=2.0 (via pydantic-settings >=2.13.0) | pyproject.toml: `"pydantic-settings>=2.13.0"` | PASS (lower bound) | No | PASS |
| FastAPI (Python) | >=0.135.0 | pyproject.toml: `"fastapi>=0.135.0"` | PASS (lower bound) | No | PASS |
| SSE-Starlette (Python) | >=3.2.0 | pyproject.toml: `"sse-starlette>=3.2.0"` | PASS (lower bound) | No | PASS |

All dependency versions match between Architecture documentation and actual pinning files. No "Latest" or unversioned dependencies found.

**NOTE on requirements.txt:** `backend/requirements.txt` has unpinned dependencies (e.g., `fastapi` without version). The Architecture explicitly addresses this at line 347: "`requirements.txt` is a legacy file superseded by `pyproject.toml` -- no action needed for this feature." This is a pre-existing condition outside the scope of this feature.

### D2) External APIs & Services

| Dependency | Rate Limits | Auth | Errors | Timeout | Status |
|------------|-------------|------|--------|---------|--------|
| Replicate Prediction API | 30/min, 100 lifetime per session (Architecture: Security) | requireAuth() guard (unchanged) | negative_prompt removal eliminates API-Error source | 5min stale pending threshold (queries.ts:140) | PASS |
| OpenAI API (via langchain-openai) | Not changed by this feature | Not changed | Not changed | Not changed | PASS |

---

## E) Pattern Consistency (Gate 1b)

### Scanner Output Validation

| Check | Rule | Result |
|-------|------|--------|
| AVOID has Basis | All 4 AVOID items reference specific code locations being removed by this feature. No .decisions.md exists (noted in scan), but the feature itself replaces these patterns. | PASS |
| REUSE has Evidenz | All 9 REUSE items reference central interfaces/types used by 2+ files | PASS |
| Jede Empfehlung hat Dateipfad | All 13 patterns have specific file paths with line numbers | PASS |

### Pattern Consistency Check

| Scanner Recommendation | Architecture Decision | Justified? | Status |
|------------------------|----------------------|------------|--------|
| REUSE #1: DraftPrompt interface -- simplify to 1 field | DraftPrompt = { prompt } (Migration Map: assistant-context.tsx:25-29) | Yes | PASS |
| REUSE #2: WorkspaceVariationState -- remove fields | Remove promptStyle/negativePrompt (Migration Map: workspace-state.tsx:10-22) | Yes | PASS |
| REUSE #3: PromptHistoryEntry -- remove fields | Remove from interface (Migration Map: prompt-history-service.ts:7-16) | Yes | PASS |
| REUSE #4: CreateGenerationInput -- remove fields | Remove from interface (Migration Map: queries.ts:70-82) | Yes | PASS |
| REUSE #5: DraftPromptDTO (Python) -- simplify | Simplify to { prompt } (Migration Map: dtos.py:146-151) | Yes | PASS |
| REUSE #6: draft_prompt/refine_prompt tools -- 1 field output | Returns { prompt } (Migration Map: prompt_tools.py) | Yes | PASS |
| REUSE #7: Drizzle migration pattern -- migration #12 | Migration 0012_drop_prompt_style_negative (Database Schema) | Yes | PASS |
| REUSE #8: DISTINCT ON query -- simplify | DISTINCT ON (prompt_motiv, model_id) (Query Changes) | Yes | PASS |
| REUSE #9: PromptAssistantState -- docstring update only | State docstring update (Migration Map: state.py:12-33) | Yes | PASS |
| EXTEND #1: VariationParams / VariationPopover -- remove fields | Remove fields + textareas (Migration Map: variation-popover.tsx:28-36) | Yes | PASS |
| EXTEND #2: PromptTabs / FavoritesList / HistoryList -- remove props | Remove props (Migration Map: 3 files) | Yes | PASS |
| EXTEND #3: getWorkspaceFieldsForChip -- simplify | Simplify to single prompt field (Migration Map: assistant-context.tsx:616-637) | Yes | PASS |
| EXTEND #4: Prompt Knowledge formatter -- remove negativePrompts | Remove rendering (Migration Map: prompt_knowledge.py:208-215) | Yes | PASS |
| NEW #1: DB Migration DROP COLUMN | New migration file 0012 (Database Schema + New Files) | Yes | PASS |
| AVOID #1: Style-Concatenation pattern | prompt = promptMotiv.trim(), no concat (Server Logic). Verified: generation-service.ts:385-387 currently does concat. | Yes | PASS |
| AVOID #2: negative_prompt passthrough | Do not send negative_prompt (Server Logic). Verified: generation-service.ts:278-280 currently passes through. | Yes | PASS |
| AVOID #3: Collapsible Style/Negative UI sections | Remove collapsible sections (Migration Map: prompt-area.tsx:911-974). Verified: sections exist at those lines. | Yes | PASS |
| AVOID #4: 3-field system prompt instructions | Rewrite to single-field instruction (Migration Map: prompts.py:39-46). Verified: instruction exists at those lines. | Yes | PASS |

All 18 scanner recommendations (9 REUSE, 4 EXTEND, 1 NEW, 4 AVOID) are fully addressed in the Architecture.

---

## F) Migration Completeness

### Quantitaets-Check

| Discovery Claim | Architecture Coverage | Status |
|---|---|---|
| ~20 test files listed in Discovery (Betroffene Dateien section) | Architecture Research Log acknowledges ~66 test files are actually affected | PASS -- Architecture identifies MORE affected files than Discovery |
| 14 source files in Discovery (Betroffene Dateien) | Migration Map: 21 source file entries + 1 new file (Architecture found additional canvas/workspace/data files) | PASS -- Architecture covers all Discovery files plus additional affected files |

### Qualitaets-Check

| File in Migration Map | Current Pattern | Target Pattern | Specific enough for test? | Status |
|---|---|---|---|---|
| `components/workspace/prompt-area.tsx` | 3 state vars + 2 collapsibles + Txt2ImgState/Img2ImgState with 3 fields | 1 state var + no collapsibles + simplified state types | Yes -- `expect(Txt2ImgState).not.toHaveProperty('promptStyle')` | PASS |
| `components/canvas/popovers/variation-popover.tsx` | VariationParams with promptStyle/negativePrompt + 2 textareas | VariationParams without fields, no textareas | Yes -- `expect(VariationParams).not.toHaveProperty('promptStyle')` | PASS |
| `components/canvas/canvas-detail-view.tsx` | Passes promptStyle/negativePrompt to generateImages | Only passes promptMotiv | Yes -- verify generateImages call has no promptStyle param | PASS |
| `components/canvas/details-overlay.tsx` | Renders Style and Negative Prompt sections | Only renders Prompt | Yes -- `expect(screen.queryByTestId('details-style')).toBeNull()` | PASS |
| `components/workspace/prompt-tabs.tsx` | Accepts promptStyle/negativePrompt props | No longer accepts | Yes -- remove from interface definition | PASS |
| `components/workspace/history-list.tsx` | Accepts promptStyle/negativePrompt props | Content check only uses promptMotiv | Yes -- remove from interface, simplify hasAnyPromptContent | PASS |
| `components/workspace/favorites-list.tsx` | Same as history-list | Same | Yes | PASS |
| `lib/assistant/assistant-context.tsx` | DraftPrompt = { motiv, style, negativePrompt } | DraftPrompt = { prompt } | Yes -- `expect(DraftPrompt).toHaveProperty('prompt')` | PASS |
| `lib/assistant/use-assistant-runtime.ts` | SSE parsing: `{motiv, style, negative_prompt}` -> DraftPrompt | SSE parsing: `{prompt}` -> DraftPrompt | Yes -- verify dispatch payload shape | PASS |
| `lib/workspace-state.tsx` | WorkspaceVariationState with optional promptStyle/negativePrompt | Without these fields | Yes -- remove from interface | PASS |
| `lib/services/generation-service.ts` | Style-concat + negative_prompt passthrough | prompt = promptMotiv.trim(), no negative | Yes -- verify no concat at line 387, no passthrough at line 278 | PASS |
| `lib/services/prompt-history-service.ts` | PromptHistoryEntry with promptStyle/negativePrompt | Without these fields | Yes -- remove from interface + mapping | PASS |
| `app/actions/generations.ts` | GenerateImagesInput with promptStyle/negativePrompt | Without these fields | Yes -- remove from interface + call | PASS |
| `lib/db/schema.ts` | promptStyle + negativePrompt columns | Without these columns | Yes -- remove column definitions | PASS |
| `lib/db/queries.ts` | Insert/select/DISTINCT ON with promptStyle/negativePrompt | Without these fields | Yes -- remove from insert, DISTINCT ON, select | PASS |
| `backend/app/agent/tools/prompt_tools.py` | Returns {motiv, style, negative_prompt} | Returns {prompt} | Yes -- verify return dict keys | PASS |
| `backend/app/agent/prompts.py` | "Strukturiere den Prompt in drei Felder" | Single-field instruction | Yes -- verify no "drei Felder" in system prompt | PASS |
| `backend/app/agent/state.py` | draft_prompt docstring references 3 fields | References 1 field | Yes -- verify docstring content | PASS |
| `backend/app/models/dtos.py` | DraftPromptDTO has motiv/style/negative_prompt | DraftPromptDTO has prompt | Yes -- verify class fields | PASS |
| `backend/app/agent/prompt_knowledge.py` | Renders negativePrompts section | No negativePrompts section | Yes -- verify no negativePrompts rendering | PASS |
| `data/prompt-knowledge.json` | 13 models have negativePrompts entries | No negativePrompts entries | Yes -- verify no negativePrompts keys in JSON | PASS |
| `drizzle/0012_drop_prompt_style_negative.sql` (NEW) | N/A | DROP COLUMN SQL | Yes -- verify SQL contains DROP COLUMN statements | PASS |

---

## Blocking Issues

None.

---

## Verification Summary

### Codebase Cross-References Verified

All key Architecture claims were verified against actual source code:

| Architecture Claim | Verified At | Match |
|---|---|---|
| `negativePrompt` at schema.ts:61 | `lib/db/schema.ts:61` -- `negativePrompt: text("negative_prompt")` | Exact |
| `promptStyle` at schema.ts:72 | `lib/db/schema.ts:72` -- `promptStyle: text("prompt_style").default("")` | Exact |
| `DraftPrompt` at assistant-context.tsx:25-29 | Lines 25-29: `{motiv, style, negativePrompt}` interface | Exact |
| `DraftPromptDTO` at dtos.py:146-151 | Lines 146-151: `motiv: str, style: str, negative_prompt: str` | Exact |
| SSE parsing at use-assistant-runtime.ts:185-205 | Lines 185-205: dispatches SET_DRAFT_PROMPT/REFINE_DRAFT with 3 fields | Exact |
| Style-concat at generation-service.ts:385-387 | Lines 384-387: `let prompt = styleTrimmed ? ... : motivTrimmed` | Exact |
| negative_prompt passthrough at generation-service.ts:278-280 | Lines 278-280: `if (generation.negativePrompt) { input.negative_prompt = ... }` | Exact |
| Collapsible sections at prompt-area.tsx:911-974 | Lines 910-974: Style + Negative collapsible sections | Exact |
| System prompt at prompts.py:39-46 | Lines 38-48: "Strukturiere den Prompt in drei Felder: motiv, style, negative_prompt" | Exact |
| negativePrompts rendering at prompt_knowledge.py:208-215 | Lines 208-215: conditional rendering of negativePrompts info | Exact |
| WorkspaceVariationState at workspace-state.tsx:10-22 | Lines 10-22: interface with promptStyle/negativePrompt optional fields | Exact |
| 12 existing Drizzle migrations | `drizzle/meta/_journal.json`: 12 entries (idx 0-11) | Exact |
| 13 models with negativePrompts in prompt-knowledge.json | All 13 models have negativePrompts entries (verified programmatically) | Exact |
| `getSiblingsByBatchId` uses `.select()` (all columns) | `lib/db/queries.ts:184`: `.select()` without explicit columns | Exact |
| `getPromptHistoryQuery` DISTINCT ON uses 4 fields | `lib/db/queries.ts:292`: DISTINCT ON includes prompt_style, negative_prompt | Exact |
| `getFavoritesQuery` selects promptStyle/negativePrompt | `lib/db/queries.ts:326-327`: explicitly selects both fields | Exact |
| `requirements.txt` unpinned -- addressed in Architecture note | Architecture line 347: explicitly documents as legacy file | Exact |

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0

**Next Steps:**
- [ ] Proceed to Gate 2 (Slice Planning)
