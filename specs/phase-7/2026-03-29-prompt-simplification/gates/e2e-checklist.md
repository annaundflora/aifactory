# E2E Checklist: Prompt-Felder Vereinfachung

**Integration Map:** `integration-map.md`
**Generated:** 2026-03-29

---

## Pre-Conditions

- [x] All 11 slices APPROVED (Gate 2)
- [x] Architecture APPROVED (Gate 1)
- [x] Integration Map has no MISSING INPUTS
- [x] Discovery Coverage 100%

---

## Happy Path Tests

### Flow 1: Image Generation (txt2img)

1. [ ] **Slice 01:** DB migration `0012_drop_prompt_style_negative.sql` has been applied. Columns `prompt_style` and `negative_prompt` no longer exist in `generations` table.
2. [ ] **Slice 05:** User opens Prompt Area and sees exactly 1 textarea labeled "Prompt" with placeholder "Describe your image, including style and mood..."
3. [ ] **Slice 05:** No collapsible sections for Style or Negative Prompt are visible.
4. [ ] **Slice 05:** User types "A golden retriever in a sunflower field at sunset" and clicks Generate.
5. [ ] **Slice 04:** `generateImages` is called with `{promptMotiv: "A golden retriever in a sunflower field at sunset"}` -- no `promptStyle`, no `negativePrompt`.
6. [ ] **Slice 04:** `GenerationService.generate()` sets `prompt = "A golden retriever in a sunflower field at sunset"` (trimmed, no style concatenation).
7. [ ] **Slice 04:** Replicate API receives `input.prompt` only, NO `input.negative_prompt` field.
8. [ ] **Slice 04:** HTTP response is NOT 422 (no validation error from Replicate).
9. [ ] **Slice 02:** `createGeneration` inserts record without `promptStyle`/`negativePrompt` columns.

### Flow 2: Image Generation (img2img)

1. [ ] **Slice 05:** User switches to img2img mode, enters prompt, uploads reference.
2. [ ] **Slice 05:** `generateImages` is called with `{promptMotiv: "..."}` -- no `promptStyle`, no `negativePrompt`.
3. [ ] **Slice 04:** Replicate API receives only `input.prompt`, `input.image`, `input.prompt_strength` -- NO `input.negative_prompt`.

### Flow 3: Canvas Variation

1. [ ] **Slice 07:** User opens VariationPopover on an existing generation.
2. [ ] **Slice 07:** Popover shows exactly 1 textarea (`variation-prompt`), NO style or negative prompt textareas.
3. [ ] **Slice 07:** User modifies prompt and clicks Generate.
4. [ ] **Slice 07:** `handleVariationGenerate` calls `generateImages` WITHOUT `promptStyle`/`negativePrompt`.
5. [ ] **Slice 04:** Generation completes successfully.

### Flow 4: Canvas Details Overlay

1. [ ] **Slice 07:** User clicks on a generation in the canvas.
2. [ ] **Slice 07:** `DetailsOverlay` shows "Prompt" section only.
3. [ ] **Slice 07:** NO "Style" or "Negative Prompt" sections are rendered.

### Flow 5: Prompt History

1. [ ] **Slice 06:** User opens the History tab in PromptTabs.
2. [ ] **Slice 02:** `getPromptHistoryQuery` uses `DISTINCT ON (prompt_motiv, model_id)` (2 fields only).
3. [ ] **Slice 06:** History entries are displayed without promptStyle/negativePrompt data.
4. [ ] **Slice 05:** User clicks "Restore" on a history entry, only `promptMotiv` is set.

### Flow 6: Favorites

1. [ ] **Slice 06:** User opens the Favorites tab in PromptTabs.
2. [ ] **Slice 02:** `getFavoritesQuery` select does NOT include `promptStyle`/`negativePrompt`.
3. [ ] **Slice 06:** Favorites entries display correctly.

### Flow 7: Assistant Draft Prompt (SSE)

1. [ ] **Slice 08:** User asks the Assistant for a prompt suggestion.
2. [ ] **Slice 08:** `draft_prompt` tool returns `{prompt: "A majestic mountain landscape at golden hour"}`.
3. [ ] **Slice 08:** SSE `tool-call-result` event carries `{prompt: string}` payload.
4. [ ] **Slice 10:** Frontend parses SSE and dispatches `SET_DRAFT_PROMPT` with `{prompt: string}`.
5. [ ] **Slice 10:** Draft is displayed in the UI as a single prompt block.
6. [ ] **Slice 10:** User clicks "Apply to Prompt" -- `applyToWorkspace` maps `draftPrompt.prompt` to `setVariation({promptMotiv: "..."})`.
7. [ ] **Slice 05:** Prompt Area textarea now contains the applied prompt text.

### Flow 8: Assistant Refine Prompt (SSE)

1. [ ] **Slice 08:** User provides feedback to refine the draft.
2. [ ] **Slice 08:** `refine_prompt` tool returns `{prompt: "refined version"}`.
3. [ ] **Slice 10:** Frontend dispatches `REFINE_DRAFT` with `{prompt: string}`.

### Flow 9: Session Restore (New Format)

1. [ ] **Slice 09:** `get_session_state()` reads checkpoint and constructs `DraftPromptDTO(prompt="...")`.
2. [ ] **Slice 10:** `loadSession` receives `draft_prompt: {prompt: "..."}` and maps to `DraftPrompt`.
3. [ ] **Slice 10:** Draft prompt is correctly displayed in UI.

### Flow 10: Session Restore (Old 3-Field Format -- Backwards Compatibility)

1. [ ] **Slice 10:** `loadSession` receives old format `draft_prompt: {motiv: "old text", style: "oil painting", negative_prompt: "blurry"}`.
2. [ ] **Slice 10:** Maps to `{prompt: "old text"}`, discarding `style` and `negative_prompt`.
3. [ ] **Slice 10:** Draft prompt shows "old text" in UI.

### Flow 11: Mode Switch Persistence

1. [ ] **Slice 05:** User enters a prompt in txt2img mode, switches to img2img, then back.
2. [ ] **Slice 05:** `promptMotiv` is correctly saved and restored.
3. [ ] **Slice 05:** NO `promptStyle`/`negativePrompt` values are saved or read.

---

## Edge Cases

### Error Handling

- [ ] **Slice 08 (AC-3):** `draft_prompt.invoke({"collected_info": {}})` without `subject` throws `ValueError` with "subject" in message.
- [ ] **Slice 09 (AC-6):** `DraftPromptDTO(motiv="...", style="...", negative_prompt="...")` (old format) raises `ValidationError`.
- [ ] **Slice 10 (AC-5):** `loadSession` with `draft_prompt: null` results in `draftPrompt == null`.
- [ ] **Slice 10 (AC-7):** `getWorkspaceFieldsForChip` with empty `promptMotiv` returns `null`.

### Content Checks

- [ ] **Slice 06 (AC-4):** `hasAnyPromptContent()` returns `false` for whitespace-only `promptMotiv`.
- [ ] **Slice 06 (AC-4):** `hasAnyPromptContent()` returns `true` for `"a cat"`.
- [ ] **Slice 04 (AC-2):** `promptMotiv = "  a cat on a roof  "` becomes `"a cat on a roof"` after trim.

### Knowledge System

- [ ] **Slice 09 (AC-1):** All 13 models in `data/prompt-knowledge.json` have NO `negativePrompts` key.
- [ ] **Slice 09 (AC-2):** `format_knowledge_for_prompt()` output for a model does NOT contain "Negative prompts" text.
- [ ] **Slice 09 (AC-3):** Fallback output still contains "General Prompting Tips", "Tips:", "Avoid:".

### Compiler & Type Safety

- [ ] **Slice 01 (AC-1):** `typeof generations.$inferSelect` has NO `promptStyle`/`negativePrompt` properties.
- [ ] **Slice 01 (AC-4):** `npx drizzle-kit generate` reports "No schema changes" (idempotency check).
- [ ] **Slice 02 (AC-6):** `npx tsc --noEmit` reports 0 errors in `queries.ts` and `prompt-history-service.ts`.
- [ ] **Slice 04 (AC-7):** `npx tsc --noEmit` reports 0 errors in `generation-service.ts` and `generations.ts`.
- [ ] **Slice 05 (AC-12):** `npx tsc --noEmit` reports 0 errors in `prompt-area.tsx` and `workspace-state.tsx`.
- [ ] **Slice 11 (AC-3):** `npx tsc --noEmit` reports 0 errors across entire project.

---

## Cross-Slice Integration Points

| # | Integration Point | Slices | How to Verify |
|---|-------------------|--------|---------------|
| 1 | Schema bereinigt -> Queries bereinigt | 01 -> 02 | `npx tsc --noEmit` passes after both slices |
| 2 | Queries bereinigt -> Generation Service bereinigt | 02 -> 04 | `createGeneration` call in `generation-service.ts` compiles without `promptStyle`/`negativePrompt` |
| 3 | Generation Service -> Prompt Area UI | 04 -> 05 | `generateImages({promptMotiv})` call in `prompt-area.tsx` compiles |
| 4 | Generation Service -> Canvas UI | 04 -> 07 | `generateImages()` calls in `canvas-detail-view.tsx` compile without old fields |
| 5 | WorkspaceVariationState shared between Slice 05 + 06 | 05 <-> 06 | `lib/workspace-state.tsx` has NO `promptStyle`/`negativePrompt` after both slices complete |
| 6 | PromptTabs Props from Slice 06 consumed in Slice 05 | 06 -> 05 | `prompt-area.tsx` passes props to `PromptTabs` without old fields |
| 7 | History entries from Slice 02 displayed in Slice 06 | 02 -> 06 | `PromptHistoryEntry` type consistent between `prompt-history-service.ts` and `history-list.tsx` |
| 8 | draft_prompt tools -> SSE -> Frontend | 08 -> 10 | SSE `tool-call-result` with `{prompt}` parsed correctly in `use-assistant-runtime.ts` |
| 9 | DraftPromptDTO -> Session Restore -> Frontend | 09 -> 10 | `loadSession` processes `{prompt: string}` from backend |
| 10 | All slices -> E2E verification | 01-10 -> 11 | `pnpm test && cd backend && python -m pytest -v && npx tsc --noEmit` all pass |

---

## Regression Checks

| # | Check | Command | Expected |
|---|-------|---------|----------|
| 1 | All Vitest suites | `pnpm test` | 0 failures |
| 2 | All pytest suites | `cd backend && python -m pytest -v` | 0 failures |
| 3 | TypeScript compilation | `npx tsc --noEmit` | 0 errors |
| 4 | Drizzle migration idempotency | `npx drizzle-kit generate` | "No schema changes" |
| 5 | No remaining production refs | `grep -r "negativePrompt\|promptStyle" --include="*.ts" --include="*.tsx" lib/ app/ components/` | No production hits (only tests/specs allowed) |

---

## Sign-Off

| Tester | Date | Result |
|--------|------|--------|
| [Name] | [Date] | PASS / FAIL |

**Notes:**
[Any observations or issues found]
