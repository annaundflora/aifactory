# E2E Checklist: Model Cards & Multi-Model Selection

**Integration Map:** `integration-map.md`
**Generated:** 2026-03-09

---

## Pre-Conditions

- [ ] All 14 slices APPROVED (Gate 2) — confirmed in integration-map.md
- [ ] Architecture APPROVED (Gate 1) — `compliance-architecture.md` APPROVED
- [ ] Integration Map has no MISSING INPUTS — confirmed (0 missing inputs)
- [ ] `REPLICATE_API_TOKEN` set in `.env.local`
- [ ] `pnpm install` completed (all dependencies available)
- [ ] `pnpm build` exits with code 0 (no TypeScript errors)
- [ ] No imports of `lib/models` in `app/`, `lib/`, or `components/` (grep check: slice-03 through slice-05 removed all such imports)

---

## Happy Path Tests

### Flow 1: Workspace Load — Default Model Pre-Selected

1. [ ] **Slice 02 + 03:** `getCollectionModels()` server action is callable and returns a non-empty `CollectionModel[]` from the Replicate Collections API (or in-memory cache)
2. [ ] **Slice 10:** On workspace open (`/`), `prompt-area.tsx` fires `getCollectionModels()` in `useEffect` on mount
3. [ ] **Slice 10:** `selectedModels` is initialized to `[collectionModels[0]]` after fetch resolves
4. [ ] **Slice 10:** `ModelTrigger` renders exactly 1 mini-card showing the first collection model (name + owner visible, thumbnail or fallback gradient shown)
5. [ ] **Slice 10 + 11:** `ParameterPanel` is visible; Variant-Count selector is visible; notice text "Default parameters will be used for multi-model generation." is NOT visible
6. [ ] **Slice 10:** X-button on the single mini-card is NOT visible (min-1 enforcement)

---

### Flow 2: Browse Models — Open Drawer and View Cards

1. [ ] **Slice 10:** "Browse Models" link is visible in the Prompt Area
2. [ ] **Slice 08 + 10:** Clicking "Browse Models" opens the `ModelBrowserDrawer` as a Sheet from the right
3. [ ] **Slice 08:** Drawer header shows title "Select Models" and a close (X) button
4. [ ] **Slice 08:** A search input with placeholder "Search models..." is visible
5. [ ] **Slice 08 + 07:** Owner filter chips are displayed horizontally; "All" chip is active by default
6. [ ] **Slice 06 + 08:** At least 2 Model Cards are rendered in a 2-column grid layout
7. [ ] **Slice 06:** Each visible Model Card shows: cover image (or fallback gradient), model name (bold), owner name (muted), run count badge, and a description (truncated to 2 lines)
8. [ ] **Slice 08:** Confirm button in the sticky footer is disabled and shows text "Select at least 1 model" (no models selected in temp state yet)

---

### Flow 3: Search and Filter Cards

1. [ ] **Slice 07 + 08:** Typing a search term in the search input filters the displayed Model Cards in real time (client-side, no network request)
2. [ ] **Slice 07 + 08:** Search is case-insensitive (uppercase and lowercase produce the same results)
3. [ ] **Slice 07 + 08:** Clicking an owner filter chip filters cards to only show models from that owner; the chip is visually marked as active
4. [ ] **Slice 07 + 08:** With both a search term and an owner filter active, only cards matching BOTH conditions are shown (AND logic)
5. [ ] **Slice 07 + 08:** Clicking the "All" chip clears the owner filter and shows all models (combined with any active search term)

---

### Flow 4: Select Up to 3 Models in Drawer

1. [ ] **Slice 08:** Clicking an unselected Model Card selects it: card shows ring + checkmark, counter updates, Confirm button activates with text "Confirm (1 Model)"
2. [ ] **Slice 08:** Clicking a second Model Card selects it: Confirm button shows "Confirm (2 Models)"
3. [ ] **Slice 08:** Clicking a third Model Card selects it: Confirm button shows "Confirm (3 Models)"
4. [ ] **Slice 08:** All unselected cards are now in disabled state (reduced opacity) and the inline hint "Select up to 3 models" is visible
5. [ ] **Slice 08:** Clicking a fourth (disabled) card does NOT add it to selection; selection remains at 3
6. [ ] **Slice 08:** Clicking an already-selected card deselects it: ring + checkmark removed, counter decrements, other disabled cards re-enable

---

### Flow 5: Confirm Selection — Trigger Updates

1. [ ] **Slice 08:** Clicking "Confirm (N Models)" calls `onConfirm` with the selected `CollectionModel[]` array and closes the Drawer
2. [ ] **Slice 10:** `selectedModels` in `prompt-area.tsx` updates to the confirmed models
3. [ ] **Slice 10:** `ModelTrigger` renders one mini-card per confirmed model (correct count, names, and owners shown)
4. [ ] **Slice 10 + 11:** With 2 or 3 models selected: `ParameterPanel` is NOT in DOM; Variant-Count selector is NOT in DOM; notice "Default parameters will be used for multi-model generation." is visible
5. [ ] **Slice 10 + 11:** With 1 model selected: `ParameterPanel` is in DOM; Variant-Count selector is in DOM; notice is NOT in DOM
6. [ ] **Slice 10:** X-button on mini-cards is visible when 2+ models are selected; clicking X on a mini-card removes that model, trigger updates
7. [ ] **Slice 10:** After removing down to 1 model, X-button on the remaining mini-card disappears

---

### Flow 6: Generate with Multiple Models — Parallel

1. [ ] **Slice 10 + 12:** With 2 models selected and a prompt entered, clicking "Generate" calls `generateImages({ modelIds: [id1, id2], count: 1, params: {} })`
2. [ ] **Slice 12:** The server action validates `modelIds` (array length 1-3, each matches `^[a-z0-9-]+/[a-z0-9._-]+$`)
3. [ ] **Slice 12:** 2 pending Generation records are created (one per model)
4. [ ] **Slice 12:** Both Replicate predictions are fired via `Promise.allSettled` (parallel, independent)
5. [ ] **Gallery (existing):** 2 loading placeholders appear in the Gallery, one per model
6. [ ] **Slice 13:** When results arrive, each Gallery card shows the Model Badge overlay (bottom-left, semi-transparent background, truncated display name)
7. [ ] **Slice 12:** If one model fails and the other succeeds, the failed model shows an error card and the succeeded model shows its result with badge — no crash

---

### Flow 7: Generate with Single Model

1. [ ] **Slice 10 + 12:** With 1 model selected, Variant-Count selector is visible; user can select count 1-4
2. [ ] **Slice 11 + 12:** Clicking "Generate" calls `generateImages({ modelIds: [id], count: N, params: {schemaParams} })`
3. [ ] **Slice 12:** N pending Generation records are created (all with same `model_id`)
4. [ ] **Gallery (existing):** N loading placeholders appear in the Gallery
5. [ ] **Slice 13:** Each completed Gallery card shows Model Badge with the single model's display name

---

### Flow 8: Drawer Close Without Confirm — Discard Changes

1. [ ] **Slice 08 + 10:** Re-open Drawer when 1 model is selected in Trigger
2. [ ] **Slice 08:** Select a second model in the Drawer (temp state = 2 models)
3. [ ] **Slice 08:** Click X (close button) or Backdrop to close Drawer without confirming
4. [ ] **Slice 08:** `onClose` is called; `onConfirm` is NOT called
5. [ ] **Slice 10:** `selectedModels` in Trigger remains unchanged (still 1 model)
6. [ ] **Slice 08:** On next Drawer open, `tempSelectedModels` is re-initialized from the current `selectedModels` (1 model)

---

## Edge Cases

### Error Handling

- [ ] **Slice 02 + 08:** Collections API unreachable on Drawer open: Drawer shows error state "Could not load models. Please try again." with a Retry button (no crash)
- [ ] **Slice 02 + 08:** Clicking Retry triggers a new fetch attempt; on success the card grid appears
- [ ] **Slice 02 + 08:** Collections API returns empty array: Drawer shows "No models available." (empty state)
- [ ] **Slice 10:** `getCollectionModels()` returns `{ error }` on workspace mount: no crash; `selectedModels` falls back to empty or safe default
- [ ] **Slice 12:** `generateImages` called with `modelIds: []` returns validation error `{ error: "1-3 Modelle muessen ausgewaehlt sein" }` (no DB records created)
- [ ] **Slice 12:** `generateImages` called with 4 model IDs returns same validation error
- [ ] **Slice 12:** `generateImages` called with invalid model ID format (no `/`) returns validation error

### State Transitions

- [ ] `idle` → `browsing-loading` (trigger: click "Browse Models")
- [ ] `browsing-loading` → `browsing` (trigger: API response received, cache hit or miss)
- [ ] `browsing-loading` → `browsing-error` (trigger: API error or timeout)
- [ ] `browsing-error` → `browsing-loading` (trigger: click Retry)
- [ ] `browsing` → `idle` (trigger: click "Confirm (N)")
- [ ] `browsing` → `idle` (trigger: close without confirm, discard changes)
- [ ] `idle` → `idle` (trigger: click X on mini-card, remove model, min-1 enforced)
- [ ] `idle` → `generating` (trigger: click "Generate")
- [ ] `generating` → `idle` (trigger: all predictions settled)

### Boundary Conditions

- [ ] **Slice 09:** Run count 0 → badge shows "0 runs"; 999 → "999 runs"; 1000 → "1K runs"; 2300000 → "2.3M runs"; 1000000000 → "1B runs"
- [ ] **Slice 05 + 13:** `generation.modelId = ""` → no Model Badge rendered on that Gallery card
- [ ] **Slice 05 + 13:** `generation.modelId = "black-forest-labs/flux-1.1-pro"` → badge shows "Flux 1.1 Pro"
- [ ] **Slice 06:** `cover_image_url = null` → fallback gradient displayed, no `<img>` tag in DOM
- [ ] **Slice 07 + 08:** `description = null` in a model → no crash; model with null description does not match description-only search terms
- [ ] **Slice 02:** Cache hit (< 1h TTL) → no HTTP request to Replicate Collections API
- [ ] **Slice 02:** Cache expired (> 1h TTL) → new HTTP request, cache updated
- [ ] **Slice 04:** Schema fetch timeout (> 5s) → request aborted via AbortController, error returned (no hanging connection)

---

## Cross-Slice Integration Points

| # | Integration Point | Slices | How to Verify |
|---|-------------------|--------|---------------|
| 1 | `Badge` component used in Model Card | slice-01 → slice-06 | Render ModelCard: Badge element with run_count text visible in DOM |
| 2 | `CollectionModel` type flows through all UI layers | slice-02 → slice-06, 07, 08, 10 | TypeScript build passes without type errors |
| 3 | `getCollectionModels` server action wires service to Prompt Area | slice-02 → slice-03 → slice-10 | Trigger shows model from API on mount |
| 4 | `lib/models.ts` fully removed, no dead imports | slice-03, 04, 05 | `grep -r "lib/models" app/ lib/ components/` returns 0 results |
| 5 | `useModelFilters` hook powers Drawer search+filter | slice-07 → slice-08 | Typing in search and clicking owner chips filters card grid |
| 6 | `ModelCard` renders inside `ModelBrowserDrawer` grid | slice-06 → slice-08 | Open Drawer: cards visible with correct layout |
| 7 | `ModelBrowserDrawer` mounted in `prompt-area.tsx` | slice-08 → slice-10 | Browse Models click opens Drawer |
| 8 | `formatRunCount` used in Drawer to display run counts | slice-09 → slice-08 | Model Card in Drawer shows "2.3M runs" (not raw number) |
| 9 | `selectedModels` state controls ParameterPanel visibility | slice-10 → slice-11 | Switch from 1 to 2 models: Panel disappears, notice appears |
| 10 | `selectedModels` mapped to `modelIds[]` for generation | slice-10/11 → slice-12 | Multi-model generate: 2 or 3 generation records created |
| 11 | `Promise.allSettled` partial failure independence | slice-12 | Mock one model to fail: other results still shown |
| 12 | `modelIdToDisplayName` + `Badge` on Gallery card | slice-05 + slice-01 → slice-13 | Gallery card shows readable model name badge |
| 13 | Complete user flow (load → browse → select → generate → badge) | slice-14 E2E | Playwright smoke test `e2e/model-cards.spec.ts` passes |

---

## Sign-Off

| Tester | Date | Result |
|--------|------|--------|
| (Test-Writer Agent) | (after implementation) | PASS / FAIL |
| (QA Sign-off) | (after E2E run) | PASS / FAIL |

**Notes:**
- E2E tests (slice-14) require `REPLICATE_API_TOKEN` in `.env.local` for real API calls
- Slice 14 Playwright setup requires `pnpm create playwright` as a one-time manual step
- Unit tests for each slice are run independently by the Test-Writer Agent per slice's Test Command
- Build validation (`pnpm build`) serves as the integration gate after each slice
