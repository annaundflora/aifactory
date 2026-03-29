# Codebase Scan

**Feature:** Prompt-Felder Vereinfachung (3 -> 1)
**Scan-Datum:** 2026-03-29
**Discovery:** `specs/phase-7/2026-03-29-prompt-simplification/discovery.md`

---

## Identified Patterns

| # | Pattern | Locations | Count | Type |
|---|---------|-----------|-------|------|
| 1 | 3-Field Prompt Structure (motiv, style, negativePrompt) | `components/workspace/prompt-area.tsx`, `lib/assistant/assistant-context.tsx`, `lib/assistant/use-assistant-runtime.ts`, `backend/app/agent/tools/prompt_tools.py`, `backend/app/models/dtos.py` | 5 core files, 66 test files | REUSE (simplify) |
| 2 | DraftPrompt Interface (motiv/style/negativePrompt) | `lib/assistant/assistant-context.tsx:25-29`, `lib/assistant/use-assistant-runtime.ts:186-204` | 3 files | REUSE (simplify) |
| 3 | Per-Mode State Types (Txt2ImgState, Img2ImgState) | `components/workspace/prompt-area.tsx:65-80` | 1 file | REUSE (simplify) |
| 4 | Style-Concat in Generation Pipeline | `lib/services/generation-service.ts:385-387` | 1 file | AVOID |
| 5 | negative_prompt Passthrough to Replicate API | `lib/services/generation-service.ts:278-280` | 1 file | AVOID |
| 6 | Prompt Knowledge negativePrompts Entries | `data/prompt-knowledge.json`, `backend/app/agent/prompt_knowledge.py:208-215` | 13 entries in JSON, 1 formatter file | REUSE (simplify) |
| 7 | WorkspaceVariationState with promptStyle/negativePrompt | `lib/workspace-state.tsx:10-22` | 3 files | REUSE (simplify) |
| 8 | Drizzle Migration Pattern | `drizzle/meta/_journal.json` | 12 existing migrations | REUSE |
| 9 | DISTINCT ON Prompt History Query | `lib/db/queries.ts:290-311` | 1 file | REUSE (simplify) |
| 10 | Collapsible Style/Negative Sections in UI | `components/workspace/prompt-area.tsx:911-974` | 1 file | AVOID |
| 11 | VariationPopover with promptStyle/negativePrompt | `components/canvas/popovers/variation-popover.tsx:28-36` | 1 file + 5 test files | EXTEND |
| 12 | PromptHistoryEntry with promptStyle/negativePrompt | `lib/services/prompt-history-service.ts:7-16` | 1 file | REUSE (simplify) |
| 13 | Prompt Tabs forwarding promptStyle/negativePrompt | `components/workspace/prompt-tabs.tsx:23-24`, `components/workspace/favorites-list.tsx:63-64`, `components/workspace/history-list.tsx:63-64` | 3 files | REUSE (simplify) |

---

## Existing Abstractions

| Abstraction | Location | Used by | Recommendation | Rationale |
|-------------|----------|---------|----------------|-----------|
| DraftPrompt interface | `lib/assistant/assistant-context.tsx:25-29` | 3 TS files + 5 test files | REUSE (simplify to 1 field) | Central type for assistant draft passing; change here propagates to all consumers |
| WorkspaceVariationState | `lib/workspace-state.tsx:10-22` | 3 files (context, prompt-area, tests) | REUSE (simplify) | Central type for cross-component prompt data passing |
| PromptHistoryEntry | `lib/services/prompt-history-service.ts:7-16` | 2 files (service, tests) | REUSE (simplify) | Single interface governs prompt history shape |
| CreateGenerationInput | `lib/db/queries.ts:70-82` | 1 file, used by generation-service | REUSE (simplify) | Drizzle insert input shape; remove promptStyle/negativePrompt |
| PromptHistoryRow | `lib/db/queries.ts:269-278` | 2 files (queries, prompt-history-service) | REUSE (simplify) | DB row type for prompt history |
| DraftPromptDTO (Python) | `backend/app/models/dtos.py:146-151` | 2 files (dtos, assistant_service) | REUSE (simplify) | Pydantic model for SSE serialization of draft prompts |
| PromptAssistantState | `backend/app/agent/state.py:12-33` | 8+ Python files | REUSE | State class is generic enough; only docstring needs update |
| draft_prompt / refine_prompt tools | `backend/app/agent/tools/prompt_tools.py` | 2 tools, 3 test files | REUSE (simplify to 1 field output) | Return dict shape changes from {motiv, style, negative_prompt} to {prompt} |
| post_process_node | `backend/app/agent/graph.py:55-160` | 1 file | REUSE | Generic tool-result-to-state mapper; no changes needed |
| Drizzle migration system | `drizzle/meta/_journal.json` (12 entries) | All schema changes | REUSE | Standard Drizzle migration pattern; add entry #12 for column drop |
| Txt2ImgState / Img2ImgState | `components/workspace/prompt-area.tsx:65-80` | 1 file | REUSE (simplify) | Local component types; remove promptStyle/negativePrompt |
| VariationParams | `components/canvas/popovers/variation-popover.tsx:28-36` | 2 files (popover, canvas-detail-view) | EXTEND | Remove promptStyle/negativePrompt fields; consumers must update |

---

## Recommendations

### REUSE (bestehende Abstraktion wiederverwenden)

| # | What | Where | Why |
|---|------|-------|-----|
| 1 | DraftPrompt interface -- simplify to `{ prompt: string }` (keep `motiv` key to avoid rename churn, per discovery out-of-scope) | `lib/assistant/assistant-context.tsx:25-29` | Single type definition propagates change to all 3 consumer files |
| 2 | WorkspaceVariationState -- remove `promptStyle` and `negativePrompt` optional fields | `lib/workspace-state.tsx:10-22` | Central context type used by prompt-area and canvas variation flows |
| 3 | PromptHistoryEntry -- remove promptStyle/negativePrompt | `lib/services/prompt-history-service.ts:7-16` | Single interface change propagates to history/favorites list components |
| 4 | CreateGenerationInput -- remove negativePrompt/promptStyle | `lib/db/queries.ts:70-82` | Input type for all generation creation; simplify insert values |
| 5 | DraftPromptDTO (Pydantic) -- simplify to single prompt field | `backend/app/models/dtos.py:146-151` | SSE contract between Python backend and TS frontend |
| 6 | draft_prompt/refine_prompt tools -- return `{ prompt }` instead of 3 fields | `backend/app/agent/tools/prompt_tools.py` | Tool output shape directly controls SSE payload and state update |
| 7 | Drizzle migration pattern -- create migration #12 for DROP COLUMN | `drizzle/meta/_journal.json` | 12 existing migrations follow consistent pattern |
| 8 | DISTINCT ON query -- remove prompt_style and negative_prompt from DISTINCT clause | `lib/db/queries.ts:290-311` | Raw SQL query uses these columns in DISTINCT ON and ORDER BY |
| 9 | PromptAssistantState -- update docstring only | `backend/app/agent/state.py:12-33` | State dict shape is generic; `draft_prompt` field is `Optional[dict]` |

### EXTEND (bestehende Abstraktion erweitern)

| # | What | Where | Extension needed |
|---|------|-------|------------------|
| 1 | VariationParams / VariationPopover -- remove promptStyle/negativePrompt | `components/canvas/popovers/variation-popover.tsx:28-36` | Remove 2 fields from VariationParams interface; remove Style/Negative textareas from popover UI; update canvas-detail-view.tsx variation handler (line 274-275, 389) |
| 2 | PromptTabs / FavoritesList / HistoryList -- remove promptStyle/negativePrompt props | `components/workspace/prompt-tabs.tsx:23-24`, `components/workspace/favorites-list.tsx:63-64`, `components/workspace/history-list.tsx:63-64` | Remove optional props; update onLoadHistoryEntry callback to exclude style/negative |
| 3 | getWorkspaceFieldsForChip -- simplify to single prompt field | `lib/assistant/assistant-context.tsx:616-637` | Remove style/negative formatting; used by 2 components + 6 test files |
| 4 | Prompt Knowledge formatter -- remove negativePrompts rendering | `backend/app/agent/prompt_knowledge.py:208-215` | The formatter currently renders "Negative prompts: Supported/Not supported"; remove this section |

### NEW (neue Implementierung noetig)

| # | What | Why new |
|---|------|---------|
| 1 | DB Migration: DROP COLUMN prompt_style, negative_prompt | No existing migration covers column removal; new SQL migration file needed following Drizzle pattern |

### AVOID (bekannte Schuld, nicht replizieren)

| # | What | Decision Log Entry | Alternative |
|---|------|--------------------|-------------|
| 1 | Style-Concatenation pattern (`{motiv}. {style}`) | Feature removes this -- style was concatenated at `generation-service.ts:387` | Use promptMotiv directly as the final prompt string |
| 2 | negative_prompt passthrough to Replicate API | Feature removes this -- `generation-service.ts:278-280` sends unsupported field to 65% of models | Do not send negative_prompt at all |
| 3 | Collapsible Style/Negative UI sections | Feature removes this -- `prompt-area.tsx:911-974` will be deleted | Single prompt textarea without collapsibles |
| 4 | 3-field prompt system prompt instructions | Feature removes this -- `prompts.py:39-46` instructs LLM to produce 3 fields | Update system prompt to instruct single-field output |

---

## Conventions Detected

| Convention | Evidence | Count |
|------------|----------|-------|
| TypeScript alias imports (`@/lib/...`, `@/components/...`) | `lib/services/generation-service.ts:2-13`, `lib/assistant/assistant-context.tsx:16-23` | All TS/TSX files |
| Python relative imports (`from app.agent...`) | `backend/app/agent/graph.py:26-31`, `backend/app/agent/prompts.py:12` | All Python agent files |
| camelCase for TS interfaces, snake_case for Python/DB | `DraftPrompt` vs `draft_prompt`, `negativePrompt` vs `negative_prompt` | All files |
| Drizzle schema with `pgTable` + index definitions | `lib/db/schema.ts:51-98` | 1 file, 7 tables |
| Server actions with `"use server"` + `requireAuth()` | `app/actions/generations.ts:1,74` | All server action files |
| Service objects as const exports (`GenerationService`, `promptHistoryService`) | `lib/services/generation-service.ts:622-626`, `lib/services/prompt-history-service.ts:61-65` | 2+ service files |
| LangGraph `@tool` decorator for agent tools | `backend/app/agent/tools/prompt_tools.py:15,112` | 3 tool files |
| Pydantic `BaseModel` for DTOs | `backend/app/models/dtos.py:146` | 1 DTO file |
| Test file co-location in `__tests__/` subdirectories | `lib/assistant/__tests__/`, `lib/services/__tests__/`, `components/workspace/__tests__/` | 66+ test files |
| `useCallback` + `useRef` pattern for stable handlers | `components/workspace/prompt-area.tsx`, `lib/assistant/assistant-context.tsx` | All React components |

---

## Key Integration Points

| Integration | Current Location | Impact of Feature |
|-------------|------------------|-------------------|
| SSE tool-call-result payload (draft_prompt/refine_prompt) | `lib/assistant/use-assistant-runtime.ts:185-205` | Payload shape changes from `{motiv, style, negative_prompt}` to `{prompt}` -- BREAKING CHANGE, must deploy frontend+backend together |
| Replicate API input construction | `lib/services/generation-service.ts:264-305` | Remove `input.negative_prompt` assignment (line 278-280); remove style concat (line 387) |
| Server action `generateImages` parameter interface | `app/actions/generations.ts:22-45` | Remove `promptStyle` and `negativePrompt` from `GenerateImagesInput` |
| Server action call from prompt-area | `components/workspace/prompt-area.tsx:710-719` | Remove `promptStyle` and `negativePrompt` params from `generateImages()` call |
| DB schema columns | `lib/db/schema.ts:62,72` | Drop `negativePrompt` and `promptStyle` columns from `generations` table |
| createGeneration DB insert | `lib/db/queries.ts:84-101` | Remove `negativePrompt` and `promptStyle` from insert values |
| Prompt History DISTINCT ON query | `lib/db/queries.ts:290-304` | Remove `g.prompt_style` and `g.negative_prompt` from DISTINCT ON and ORDER BY |
| Favorites query select | `lib/db/queries.ts:317-339` | Remove `promptStyle` and `negativePrompt` from select fields |
| Canvas variation flow | `components/canvas/canvas-detail-view.tsx:274-275,389` | Remove promptStyle/negativePrompt from variation generation params |
| Canvas VariationPopover | `components/canvas/popovers/variation-popover.tsx:28-36,69-70` | Remove promptStyle/negativePrompt state and textareas |
| Workspace variation consumption | `components/workspace/prompt-area.tsx:400-433` | Remove `promptStyle`/`negativePrompt` from variation data consumption |
| Assistant applyToWorkspace | `lib/assistant/assistant-context.tsx:487-528` | Remove style/negative from workspace apply/undo snapshot |
| Session restore (loadSession) | `lib/assistant/assistant-context.tsx:452-458` | Simplify DraftPrompt mapping from backend response |
| Python system prompt | `backend/app/agent/prompts.py:39-46` | Remove 3-field instruction; instruct single-field output |
| Prompt knowledge JSON | `data/prompt-knowledge.json` (13 models) | Remove `negativePrompts` entries from all 13 model knowledge objects |

---

## Decision Log Context

> No .decisions.md found in the repository root.

---

## Scan Summary

| Metric | Value |
|--------|-------|
| Patterns found | 13 |
| REUSE recommendations | 9 |
| EXTEND recommendations | 4 |
| NEW recommendations | 1 |
| AVOID recommendations | 4 |
| Decision Log entries | 0 |
| Total files with negativePrompt/promptStyle references | 66 test files + 15 source files |
| Total occurrences of negativePrompt/negative_prompt | 185+ across 50+ files |
| Total occurrences of promptStyle/prompt_style | 99 across 50+ files |

### Additional Observations

1. **Discovery lists ~20 test files but actual impact is ~66 test files.** Many canvas component tests, generation service tests, and workspace tests also reference `negativePrompt`/`promptStyle` in mock data (Generation objects). These mock data objects derive from the DB schema type (`Generation`) and will auto-fix once the schema columns are removed (TypeScript compiler will flag them).

2. **Canvas module not listed in discovery but affected.** `variation-popover.tsx`, `canvas-detail-view.tsx`, `details-overlay.tsx`, `img2img-popover.tsx`, and their ~20 test files reference `promptStyle`/`negativePrompt` through the `Generation` type and `VariationParams` interface.

3. **prompt_tools.py location differs from discovery.** Discovery lists `backend/app/agent/prompt_tools.py` but the actual path is `backend/app/agent/tools/prompt_tools.py`.

4. **PromptTabs, FavoritesList, HistoryList not listed in discovery but affected.** These components receive `promptStyle`/`negativePrompt` as props and pass them to `onLoadHistoryEntry` callback.

5. **getWorkspaceFieldsForChip helper not listed in discovery but affected.** Used by the "Verbessere" chip in the assistant panel; formats 3 fields into context string.
