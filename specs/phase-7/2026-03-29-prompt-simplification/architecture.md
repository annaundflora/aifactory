# Architecture: Prompt-Felder Vereinfachung

**Epic:** --
**Status:** Ready
**Discovery:** `discovery.md` (same folder)
**Derived from:** Discovery constraints, NFRs, and risks

---

## Problem & Solution

**Problem:**
- Das UI hat 3 Prompt-Felder: Motiv, Style/Modifier, Negative Prompt
- `negative_prompt` wird als separates Feld an die Replicate API gesendet, ohne zu pruefen ob das Model es unterstuetzt
- ~65 von 104 Models (alle modernen: Flux, Imagen, Recraft, Ideogram v3, Seedream, GPT Image, Luma Photon) unterstuetzen `negative_prompt` NICHT
- Das fuehrt zu Replicate API-Errors bei der Bildgenerierung
- Style/Modifier traegt zur UI-Komplexitaet bei
- Der Assistant gibt strukturierte 3-Felder-Prompts zurueck, was die Komplexitaet verstaerkt

**Solution:**
- Style/Modifier und Negative Prompt UI-Felder entfernen
- Nur noch ein einziges Prompt-Feld (promptMotiv)
- `negative_prompt` nicht mehr an die Replicate API senden
- Assistant auf 1-Feld-Output umbauen
- DB-Spalten `prompt_style` und `negative_prompt` entfernen
- Prompt Knowledge System: negativePrompts-Eintraege bereinigen

**Business Value:**
- Keine API-Errors mehr durch nicht-unterstuetzte Input-Felder
- Einfacheres UI mit weniger Fehlerquellen
- Konsistentes Verhalten ueber alle Models hinweg
- Einfacherer Assistant-Workflow (1 Feld statt 3)

---

## Scope & Boundaries

| In Scope |
|----------|
| UI: Style/Modifier und Negative Prompt Textareas aus prompt-area.tsx entfernen |
| UI: Per-Mode State (Txt2ImgState, Img2ImgState) auf 1 Prompt-Feld vereinfachen |
| UI: Canvas VariationPopover promptStyle/negativePrompt entfernen |
| UI: Canvas DetailsOverlay Style/Negative-Sections entfernen |
| UI: PromptTabs/HistoryList/FavoritesList promptStyle/negativePrompt Props entfernen |
| Generation-Service: `negative_prompt` nicht mehr an API senden |
| Generation-Service: Style-Concatenation entfernen (promptMotiv = finaler Prompt) |
| Server Action: promptStyle/negativePrompt Parameter aus generateImages entfernen |
| Assistant Backend: prompt_tools.py auf 1-Feld-Output umbauen |
| Assistant Backend: prompts.py System-Prompt anpassen (keine 3-Felder-Anweisung) |
| Assistant Backend: DraftPromptDTO auf 1 Feld |
| Assistant Frontend: assistant-context.tsx DraftPrompt auf 1 Feld |
| Assistant Frontend: use-assistant-runtime.ts SSE-Parsing vereinfachen |
| Assistant Frontend: getWorkspaceFieldsForChip auf 1 Feld |
| Prompt Knowledge: negativePrompts-Eintraege aus prompt_knowledge.py + JSON entfernen |
| DB: Spalten prompt_style und negative_prompt per Migration entfernen |
| DB: Queries anpassen (createGeneration, getPromptHistory, getFavorites, getSiblings) |
| Prompt History Service: promptStyle/negativePrompt entfernen |
| WorkspaceVariationState: promptStyle/negativePrompt entfernen |
| Tests: Alle ~66 betroffenen Test-Dateien anpassen |

| Out of Scope |
|--------------|
| Rename promptMotiv -> prompt im gesamten Codebase (zu viel Churn, promptMotiv bleibt) |
| Model-spezifische Input-Validierung (z.B. Schema-Check vor API-Call) |
| UI-Redesign der Prompt-Area ueber das Entfernen der Felder hinaus |
| Aenderungen am Parameter-Panel |

---

## API Design

### Overview

| Aspect | Specification |
|--------|---------------|
| Style | Kein neuer API-Endpoint -- bestehende Interfaces werden vereinfacht |
| Breaking Change | SSE tool-call-result Payload aendert sich (3 Felder -> 1 Feld) |
| Deployment | Frontend + Backend muessen gleichzeitig deployed werden |

### SSE Contract Change (Breaking)

| Field | Current | Target |
|-------|---------|--------|
| Event | `tool-call-result` | `tool-call-result` (unchanged) |
| Tool names | `draft_prompt`, `refine_prompt` | `draft_prompt`, `refine_prompt` (unchanged) |
| Payload (current) | `{ motiv: string, style: string, negative_prompt: string }` | -- |
| Payload (target) | -- | `{ prompt: string }` |

### Server Action Interface Change

| Field | Current (`GenerateImagesInput`) | Target |
|-------|------|--------|
| `promptMotiv` | `string` (required) | `string` (required, unchanged) |
| `promptStyle` | `string` (optional) | **REMOVED** |
| `negativePrompt` | `string` (optional) | **REMOVED** |

### Session Restore Response Change

| Field | Current (`SessionDetailState.draft_prompt`) | Target |
|-------|------|--------|
| `motiv` | `string` | **REMOVED** |
| `style` | `string` | **REMOVED** |
| `negative_prompt` | `string` | **REMOVED** |
| `prompt` | -- | `string` (NEW) |

---

## Database Schema

### Schema Changes

| Table | Column | Type | Action |
|-------|--------|------|--------|
| `generations` | `prompt_style` | `text` (default `""`) | **DROP COLUMN** |
| `generations` | `negative_prompt` | `text` (nullable) | **DROP COLUMN** |
| `generations` | `prompt` | `text` (not null) | Unchanged -- bleibt als finaler Prompt |
| `generations` | `prompt_motiv` | `text` (not null, default `""`) | Unchanged -- wird weiterhin befuellt |

### Migration

| Aspect | Detail |
|--------|--------|
| Migration Index | 12 (next after `0011_add_models_table`) |
| Migration Name | `0012_drop_prompt_style_negative` |
| SQL | `ALTER TABLE "generations" DROP COLUMN "prompt_style"; ALTER TABLE "generations" DROP COLUMN "negative_prompt";` |
| Pattern | Follows existing Drizzle migration pattern (SQL file + journal entry) |
| Reversibility | Irreversibel -- historische Daten gehen verloren (akzeptiert per Discovery) |
| Impact | Bestehende Generations verlieren prompt_style/negative_prompt Werte |

### Query Changes

| Query | Current | Target |
|-------|---------|--------|
| `createGeneration` (`queries.ts:84-102`) | Insert mit `promptStyle`, `negativePrompt` | Remove both fields from insert |
| `getPromptHistoryQuery` (`queries.ts:290-311`) | `DISTINCT ON (prompt_motiv, prompt_style, negative_prompt, model_id)` | `DISTINCT ON (prompt_motiv, model_id)` |
| `getFavoritesQuery` (`queries.ts:317-340`) | Select mit `promptStyle`, `negativePrompt` | Remove both from select |
| `getSiblingsByBatchId` (`queries.ts:177`) | `.select()` (all columns) | No manual change -- auto-fixes when schema columns are dropped |

---

## Server Logic

### Services & Processing

| Service | Change | Current | Target |
|---------|--------|---------|--------|
| `GenerationService.generate()` | Remove style-concat + negative passthrough | `prompt = motiv + ". " + style`, `input.negative_prompt = negativePrompt` | `prompt = promptMotiv.trim()`, no negative_prompt |
| `promptHistoryService.getHistory()` | Remove field mapping | Maps `promptStyle`, `negativePrompt` from DB rows | Only map `promptMotiv` |
| `promptHistoryService.getFavorites()` | Remove field mapping | Same as above | Same as above |
| `AssistantService.get_session_state()` | Simplify draft_prompt shape | Returns `{motiv, style, negative_prompt}` | Returns `{prompt}` |

### Business Logic Flow

```
Current:
  UI [motiv, style, negative] -> Action [3 params] -> Service [concat motiv+style] -> API [prompt + negative_prompt]
                                                                                          |
                                                                                    ERROR bei ~65% der Models

Target:
  UI [prompt] -> Action [1 param] -> Service [trim] -> API [prompt]
```

### Python Backend Changes

| Component | Current | Target |
|-----------|---------|--------|
| `draft_prompt` tool (`prompt_tools.py`) | Returns `{motiv, style, negative_prompt}` | Returns `{prompt}` |
| `refine_prompt` tool (`prompt_tools.py`) | Returns `{motiv, style, negative_prompt}` | Returns `{prompt}` |
| System prompt (`prompts.py:39-46`) | Instructs LLM: "Strukturiere den Prompt in drei Felder" | Instructs LLM: single prompt field |
| `DraftPromptDTO` (`dtos.py:146-151`) | `motiv: str, style: str, negative_prompt: str` | `prompt: str` |
| `PromptAssistantState.draft_prompt` (`state.py`) | `Optional[dict]` with 3 keys | `Optional[dict]` with 1 key (`prompt`) |
| `post_process_node` (`graph.py:55-161`) | Overwrites `state["draft_prompt"]` with tool result | No change needed -- generic dict handler |
| `format_knowledge_for_prompt` (`prompt_knowledge.py:208-215`) | Renders "Negative prompts: Supported/Not supported" | Remove negativePrompts section |

### Prompt Knowledge Data Changes

| Location | Current | Target |
|----------|---------|--------|
| `data/prompt-knowledge.json` (13 models) | Each model has `negativePrompts: { supported, note }` | Remove `negativePrompts` from all 13 entries |
| `prompt_knowledge.py` formatter | Renders negativePrompts info in knowledge string | Remove negativePrompts rendering |

---

## Security

### Authentication & Authorization

| Area | Mechanism | Impact |
|------|-----------|--------|
| Server Action auth | `requireAuth()` guard | No change -- auth layer unaffected |
| API rate limiting | 30/min, 100 lifetime per session | No change |
| Input validation | Prompt empty check | No change -- `promptMotiv` already validated |

### Data Protection

| Data Type | Impact |
|-----------|--------|
| Prompt content | No change -- prompt text handling unaffected |
| Historical generations | prompt_style/negative_prompt columns dropped -- data loss accepted per Discovery |

### Input Validation & Sanitization

| Input | Current | Target |
|-------|---------|--------|
| `promptMotiv` | Trimmed, empty check | Unchanged |
| `promptStyle` | Trimmed, optional | **REMOVED** -- no longer accepted |
| `negativePrompt` | Trimmed, optional | **REMOVED** -- no longer accepted |

---

## Architecture Layers

### Layer Responsibilities

| Layer | Impact | Pattern |
|-------|--------|---------|
| UI Components | Remove 2 textareas, 2 collapsible sections, simplify state types | React component with `useState` |
| Server Actions | Remove 2 parameters from `generateImages` | Next.js server action with `"use server"` |
| Services (TS) | Remove style-concat, remove negative passthrough | Const-exported service objects |
| Services (Python) | Simplify tool returns, update system prompt | LangGraph `@tool` decorator |
| Repository/Queries | Remove 2 fields from insert/select, simplify DISTINCT ON | Drizzle ORM + raw SQL |
| DB Schema | DROP 2 columns | Drizzle migration |

### Data Flow (Target)

```
Frontend:
  PromptArea [promptMotiv] -> generateImages({promptMotiv}) -> GenerationService.generate()
                                                                    |
                                                              prompt = promptMotiv.trim()
                                                                    |
                                                              Replicate API: input.prompt = prompt
                                                              (no negative_prompt)
```

Assistant:
  User message -> SSE stream -> draft_prompt/refine_prompt tool-call-result
                                    |
                              { prompt: string }  (was: { motiv, style, negative_prompt })
                                    |
                              DraftPrompt -> applyToWorkspace -> WorkspaceVariationState
```

### Error Handling Strategy

| Error Type | Handling | Impact |
|------------|----------|--------|
| Missing promptStyle/negativePrompt in old sessions | Graceful -- session restore maps to `{ prompt }`, missing fields ignored | Low |
| Old SSE payload format | N/A -- no backwards compatibility needed, atomic deploy | None |
| DB column not found after migration | TypeScript compiler catches all references | None |

---

## Migration Map

> Jede betroffene Datei mit Current -> Target Pattern.

### Frontend -- UI Components

| Existing File | Current Pattern | Target Pattern | Specific Changes |
|---|---|---|---|
| `components/workspace/prompt-area.tsx` | 3 state vars (promptMotiv, promptStyle, negativePrompt) + 2 collapsibles + Txt2ImgState/Img2ImgState with 3 fields | 1 state var (promptMotiv) + no collapsibles + simplified state types | Remove promptStyle/negativePrompt state, remove collapsible sections (lines 911-974), remove from modeStates save/restore, remove from generateImages call, remove from variation consumption (lines 400-433) |
| `components/canvas/popovers/variation-popover.tsx` | VariationParams with promptStyle/negativePrompt + 2 form textareas | VariationParams without these fields, no textareas | Remove fields from interface (lines 28-36), remove state vars (lines 69-70), remove textareas (lines 176-203), remove from onGenerate (lines 111-113) |
| `components/canvas/canvas-detail-view.tsx` | Passes promptStyle/negativePrompt to generateImages | Only passes promptMotiv | Remove promptStyle (line 309), negativePrompt (line 310) from variation handler, remove style from img2img handler (line 424) |
| `components/canvas/details-overlay.tsx` | Conditionally renders Style and Negative Prompt sections | Only renders Prompt | Remove Style section (lines 116-127), Negative section (lines 131-142) |
| `components/workspace/prompt-tabs.tsx` | Accepts promptStyle/negativePrompt props | No longer accepts these props | Remove from interface (lines 23-24), remove forwarding to HistoryList/FavoritesList (lines 80-82, 92-94) |
| `components/workspace/history-list.tsx` | Accepts promptStyle/negativePrompt props for content check | Content check only uses promptMotiv | Remove from interface (lines 59-65), simplify hasAnyPromptContent (lines 144-146) |
| `components/workspace/favorites-list.tsx` | Same as history-list | Same as history-list | Same changes at same line ranges |

### Frontend -- Assistant Integration

| Existing File | Current Pattern | Target Pattern | Specific Changes |
|---|---|---|---|
| `lib/assistant/assistant-context.tsx` | DraftPrompt = { motiv, style, negativePrompt } | DraftPrompt = { prompt } | Simplify interface (lines 25-29), simplify applyToWorkspace mapping (lines 498-504), simplify loadSession conversion (lines 452-458), simplify getWorkspaceFieldsForChip (lines 616-637) |
| `lib/assistant/use-assistant-runtime.ts` | SSE parsing: `{ motiv, style, negative_prompt }` -> DraftPrompt | SSE parsing: `{ prompt }` -> DraftPrompt | Simplify SET_DRAFT_PROMPT dispatch (lines 185-205) |

### Frontend -- State

| Existing File | Current Pattern | Target Pattern | Specific Changes |
|---|---|---|---|
| `lib/workspace-state.tsx` | WorkspaceVariationState with optional promptStyle/negativePrompt | WorkspaceVariationState without these fields | Remove promptStyle (optional), negativePrompt (optional) from interface (lines 10-22) |

### Backend -- TypeScript Services

| Existing File | Current Pattern | Target Pattern | Specific Changes |
|---|---|---|---|
| `lib/services/generation-service.ts` | Style-concat (`motiv + ". " + style`) + negative_prompt passthrough | prompt = promptMotiv.trim(), no negative_prompt | Remove style-concat (lines 385-387), remove negative_prompt passthrough (lines 278-280), remove promptStyle param from generate() signature (line 323) |
| `lib/services/prompt-history-service.ts` | PromptHistoryEntry with promptStyle/negativePrompt | PromptHistoryEntry without these fields | Remove from interface (lines 7-16), remove from mapping (lines 27-28, 45-46) |
| `app/actions/generations.ts` | GenerateImagesInput with promptStyle/negativePrompt | GenerateImagesInput without these fields | Remove from interface (lines 22-45), remove from generate() call (lines 143-156), remove promptStyle default (line 146) |

### Backend -- Database

| Existing File | Current Pattern | Target Pattern | Specific Changes |
|---|---|---|---|
| `lib/db/schema.ts` | generations table has promptStyle (line 72) + negativePrompt (line 61) | generations table without these columns | Remove both column definitions |
| `lib/db/queries.ts` | createGeneration inserts promptStyle/negativePrompt, DISTINCT ON uses 4 fields | createGeneration without these fields, DISTINCT ON uses 2 fields | Remove from CreateGenerationInput (lines 70-82), remove from insert (lines 84-102), simplify DISTINCT ON (lines 290-311), remove from favorites select (lines 317-340) |

### Backend -- Python

| Existing File | Current Pattern | Target Pattern | Specific Changes |
|---|---|---|---|
| `backend/app/agent/tools/prompt_tools.py` | draft_prompt returns {motiv, style, negative_prompt} | draft_prompt returns {prompt} | Simplify draft_prompt tool output (lines 15-109), simplify refine_prompt tool output (lines 112-154) |
| `backend/app/agent/prompts.py` | System prompt instructs 3-field output | System prompt instructs 1-field output | Rewrite PROMPT-ERSTELLUNG section (lines 39-46) |
| `backend/app/agent/state.py` | draft_prompt docstring references 3 fields | draft_prompt docstring references 1 field | Update docstring (lines 12-33) |
| `backend/app/models/dtos.py` | DraftPromptDTO has motiv/style/negative_prompt | DraftPromptDTO has prompt | Simplify class (lines 146-151) |
| `backend/app/agent/prompt_knowledge.py` | Formatter renders negativePrompts section | No negativePrompts section | Remove negativePrompts rendering (lines 208-215) |

### Data Files

| Existing File | Current Pattern | Target Pattern | Specific Changes |
|---|---|---|---|
| `data/prompt-knowledge.json` | 13 models have negativePrompts entries | No negativePrompts entries | Remove negativePrompts object from all 13 model entries |

### New Files

| New File | Purpose |
|----------|--------|
| `drizzle/0012_drop_prompt_style_negative.sql` | Migration: DROP COLUMN prompt_style, DROP COLUMN negative_prompt |

---

## Constraints & Integrations

### Constraints

| Constraint | Technical Implication | Solution |
|------------|----------------------|----------|
| SSE Breaking Change | Frontend und Backend muessen den gleichen Payload-Shape erwarten | Atomic deploy: Frontend + Backend gleichzeitig deployen |
| DB Migration irreversibel | Historische prompt_style/negative_prompt Daten gehen verloren | Akzeptiert -- User arbeitet nur mit neueren Models |
| LangGraph Checkpoint Compatibility | Alte Sessions haben draft_prompt mit 3 Feldern im Checkpoint | Session restore mappt alte {motiv, style, negative_prompt} auf {prompt: motiv} |
| promptMotiv Naming | Variable heisst weiter promptMotiv statt prompt | Out of scope -- zu viel Churn fuer Rename |

### Integrations

| Area | System / Capability | Interface | Version | Notes |
|------|----------------------|-----------|---------|-------|
| Frontend | Next.js | App Router, Server Actions | 16.1.6 | No version change needed |
| Frontend | React | Hooks, useState, useCallback | 19.2.3 | No version change needed |
| Frontend | Drizzle ORM | Schema, Queries | 0.45.1 | Schema change + migration |
| Frontend | Drizzle Kit | Migration generation | 0.31.9 | Generate migration SQL |
| Backend | Replicate | Prediction API | 1.4.0 | Remove negative_prompt from input |
| Backend (Python) | LangGraph | Agent tools, State, Checkpoint | >=1.1.0 | Tool return shape changes |
| Backend (Python) | Pydantic | BaseModel DTOs | >=2.0 (via pydantic-settings >=2.13.0) | DraftPromptDTO simplification |
| Backend (Python) | FastAPI + SSE-Starlette | SSE streaming | >=0.135.0 / >=3.2.0 | Payload shape changes |

> **Note:** `backend/requirements.txt` has unpinned dependencies (e.g. `fastapi` without version). `backend/pyproject.toml` is the authoritative source with version constraints (e.g. `fastapi>=0.135.0`). `requirements.txt` is a legacy file superseded by `pyproject.toml` -- no action needed for this feature.

---

## Quality Attributes (NFRs)

### From Discovery -> Technical Solution

| Attribute | Target | Technical Approach | Measure / Verify |
|-----------|--------|--------------------|------------------|
| API Reliability | 0 Errors from unsupported negative_prompt | Remove negative_prompt from all API calls | No more "Input validation error" from Replicate |
| UI Simplicity | 1 prompt field instead of 3 | Remove 2 textareas + 2 collapsible sections | Visual inspection, component count |
| Consistency | Same behavior across all 104 models | Single prompt path, no model-specific branching | All models receive only `input.prompt` |
| Deploy Safety | No partial deploy | Atomic frontend+backend deploy | CI/CD pipeline runs both |

---

## Risks & Assumptions

### Assumptions

| Assumption | Technical Validation | Impact if Wrong |
|------------|---------------------|------------------|
| promptMotiv is always populated for existing generations | DB column has NOT NULL + default "" | prompt field would be empty -- low risk |
| No external consumers of the SSE payload shape | Only internal frontend parses SSE | Would break external integrations -- but none exist |
| Old LangGraph checkpoints can be restored with new draft_prompt shape | Session restore code handles field mapping | Old sessions with 3-field drafts would show empty prompt |
| prompt column already contains the final composed prompt | Service stores motiv+style concat as prompt | History display would be correct even without prompt_style |

### Risks & Mitigation

| Risk | Likelihood | Impact | Technical Mitigation | Fallback |
|------|------------|--------|---------------------|----------|
| Partial deploy (frontend/backend mismatch) | Low | High | CI/CD deploys both atomically | Rollback both |
| Old sessions with 3-field draft_prompt in LangGraph checkpoint | Medium | Low | Session restore maps old shape: `{prompt: draft.motiv}` | User re-creates prompt |
| TypeScript compiler misses a reference after schema change | Low | Low | TS strict mode catches all column references | Test suite catches remaining |
| Prompt History DISTINCT ON changes cause duplicates | Low | Low | Fewer fields = fewer unique combinations = better dedup | Acceptable |

---

## Technology Decisions

### Stack Choices

| Area | Technology | Rationale |
|------|------------|----------|
| DB Migration | Drizzle Kit generated SQL | Consistent with 12 existing migrations |
| Schema-first approach | Remove columns from schema.ts, then generate migration | Standard Drizzle workflow |
| prompt field reuse | Keep `prompt` column as final prompt (= promptMotiv.trim()) | Avoids additional migration, `prompt` already stores composed result |
| prompt_motiv equality | `prompt = promptMotiv.trim()` (identical after simplification) | Before: prompt = motiv + ". " + style. After: prompt = motiv (same content) |

### Trade-offs

| Decision | Pro | Con | Mitigation |
|----------|-----|-----|------------|
| Keep promptMotiv name instead of renaming to prompt | No churn across 80+ files | Slightly confusing name (Motiv vs generic Prompt) | Out of scope per Discovery |
| Drop columns instead of soft-deprecate | Clean schema, no dead code | Lose historical data | Data loss accepted -- not business-critical |
| Atomic deploy required | Clean cut, no backwards-compat code | Deployment coupling | Standard CI/CD handles this |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-29 | Codebase Scan | 13 patterns identified, 9 REUSE, 4 EXTEND, 1 NEW, 4 AVOID |
| 2026-03-29 | Test Impact | Discovery lists ~20 test files but actual impact is ~66 test files (canvas, workspace, generation tests reference promptStyle/negativePrompt in mock data) |
| 2026-03-29 | Canvas Module | Not listed in Discovery but affected: variation-popover.tsx, canvas-detail-view.tsx, details-overlay.tsx + ~20 test files |
| 2026-03-29 | prompt_tools.py | Actual path is `backend/app/agent/tools/prompt_tools.py` (not `backend/app/agent/prompt_tools.py` as in Discovery) |
| 2026-03-29 | UI Components | PromptTabs, FavoritesList, HistoryList not listed in Discovery but pass promptStyle/negativePrompt as props |
| 2026-03-29 | Assistant | getWorkspaceFieldsForChip helper formats 3 fields for "Verbessere" chip -- needs simplification |
| 2026-03-29 | DB Schema | `prompt` column stores composed result (motiv + style), `prompt_motiv` stores original motiv. After change: both will be identical |
| 2026-03-29 | Drizzle | 12 existing migrations, pattern: SQL file + journal entry in `drizzle/meta/_journal.json` |
| 2026-03-29 | LangGraph | `post_process_node` is a generic dict handler -- no change needed for tool return shape |
| 2026-03-29 | Dependencies | Next.js 16.1.6, React 19.2.3, Drizzle ORM 0.45.1, LangGraph >=1.1.0, Pydantic-settings >=2.13.0 |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| 1 | Kein Issue in discovery.md gefunden. Issue-Nummer eingeben? | Ohne Issue weiter |
| 2 | Architecture-Tiefe fuer dieses Removal/Simplification-Feature? | Standard (Empfohlen): Migration Map mit allen Dateien, SSE-Contract-Change, DB-Migration, Security, Risks |
