# Feature: Model Cards & Multi-Model Selection

**Epic:** --
**Status:** Ready
**Wireframes:** `wireframes.md` (optional, same folder)

---

## Problem & Solution

**Problem:**
- Model selection is a plain dropdown showing only `displayName -- $price`
- No visual context about what each model produces or how popular it is
- Only 9 hardcoded models; list goes stale as Replicate adds new models
- No way to compare outputs from multiple models for the same prompt

**Solution:**
- Replace dropdown with Card-based Model Browser (Drawer)
- Fetch models dynamically from Replicate Collections API (`/v1/collections/text-to-image`)
- Enable multi-model selection (max 3) for parallel generation and comparison
- Show Model Badge on all Gallery thumbnails

**Business Value:**
- Better model discovery leads to higher quality outputs
- Multi-model comparison reduces trial-and-error iterations
- Dynamic model list means zero maintenance when Replicate adds models

---

## Scope & Boundaries

| In Scope |
|----------|
| Replicate Collections API integration with server-side caching (1h TTL) |
| Model Card UI component (cover image, name, description, run count) |
| Model Browser Drawer with search and filter |
| Multi-model selection (max 3) with parallel generation |
| Compact trigger card in Prompt Area (replaces dropdown) |
| Model Badge on all Gallery thumbnails (not just comparison results) |
| Remove static `MODELS` array; any Collection model is generatable |

| Out of Scope |
|--------------|
| Price display on cards (no Replicate Pricing API available) |
| Dedicated comparison/diff view (separate Discovery) |
| Model favoriting or pinning |
| Custom model upload or private models |
| Sorting options (use Replicate's default collection order) |

---

## Current State Reference

> Existing functionality that will be reused (unchanged) or replaced.

- `lib/models.ts`: Static `MODELS` array with 9 hardcoded models (`{ id, displayName, pricePerImage }`) -- **WILL BE REMOVED**
- `components/workspace/prompt-area.tsx`: `<Select>` dropdown for model selection (lines 241-256) -- **WILL BE REPLACED**
- `lib/services/model-schema-service.ts`: Fetches OpenAPI schema per model from Replicate API -- **REUSED** (schema loading per model stays)
- `lib/clients/replicate.ts`: `replicateRun()` accepts any `modelId` string -- **REUSED** (already model-agnostic)
- `app/actions/models.ts`: Server action `getModelSchema` validates against static `MODELS` -- **WILL BE CHANGED** (remove whitelist check)
- `components/workspace/parameter-panel.tsx`: Renders dynamic params from schema -- **REUSED** (unchanged for single-model; hidden when >1 model selected)
- Gallery grid with generation cards -- **CHANGED** (add Model Badge)

---

## UI Patterns

### Reused Patterns

| Pattern Type | Component | Usage in this Feature |
|--------------|-----------|----------------------|
| Sheet | `components/ui/sheet` (shadcn) | Model Browser Drawer (right-side overlay, same as BuilderDrawer) |
| Card | `components/ui/card` (shadcn) | Base for Model Card |
| Button | `components/ui/button` | Confirm button, filter chips |
| Input | `components/ui/input` | Search field in Drawer |
| Badge | `components/ui/badge` (shadcn, **new dependency — must be installed**) | Model Badge on Gallery thumbnails, run count |

### New Patterns

| Pattern Type | Description | Rationale |
|--------------|-------------|-----------|
| Model Card | Card with cover image, name, owner, description (truncated + tooltip), run count, checkbox | No existing card pattern combines image + metadata + selectable state |
| Compact Trigger Card | Small inline card showing selected model(s) with thumbnail + name + remove button | Replaces dropdown; needs to show 1-3 selected models compactly |
| Model Badge | Small overlay badge on Gallery thumbnails showing model name | New cross-cutting concern; no generation cards currently show model info |

---

## User Flow

1. User sees compact trigger card in Prompt Area showing currently selected model(s) -> Default: first model from Collection
2. User clicks "Browse Models" on trigger card -> Drawer opens from right
3. Drawer loads models from Collections API (cached) -> Grid of Model Cards appears
4. User optionally types in search field -> Cards filter by name/description match
5. User optionally clicks filter chips (Owner names) -> Cards filter by owner
6. User clicks checkbox on 1-3 Model Cards -> Cards show ring/border + checkmark, counter updates ("2/3 selected")
7. User clicks fourth card while 3 already selected -> Card does not select, inline hint "Select up to 3 models" shown near counter
8. User clicks "Confirm (N Models)" button -> Drawer closes, trigger card updates to show all selected models
9. User removes a model via X button on trigger card -> Model deselected, trigger updates
10. User writes prompt and clicks Generate -> Parallel requests to all selected models (1-3)
11. Results appear in Gallery as individual cards, each with Model Badge overlay

**Error Paths:**
- Collections API unreachable -> Show error state in Drawer: "Could not load models. Please try again." with retry button
- Collections API returns empty -> Show empty state: "No models available."
- One model fails during parallel generation -> Other results still appear; failed model shows error in Gallery card
- All models fail -> Standard generation error handling (existing behavior)

---

## UI Layout & Context

### Screen: Prompt Area (Sidebar)
**Position:** Left sidebar, inside PromptTabs content area
**When:** Always visible when workspace is open

**Layout:**
- Model trigger area (replaces current Select dropdown):
  - Label "Model" with count indicator when >1 selected: "Model (2 selected)"
  - Stacked mini-cards (1-3), each showing: small cover thumbnail (32x32), model display name, owner name, X remove button
  - Dividers/borders between stacked mini-cards when multiple models are selected
  - "Browse Models" link/button below the mini-cards

### Screen: Model Browser Drawer
**Position:** Right-side drawer overlay
**When:** User clicks "Browse Models"

**Layout:**
- Header: "Select Models" title, close button (X)
- Search bar: Text input with search icon, placeholder "Search models..."
- Filter row: Horizontal scrollable chips with Owner names (extracted from loaded models), "All" chip active by default
- Card grid: 2-column responsive grid of Model Cards, scrollable
- Footer: Sticky bottom bar with "Confirm (N Models)" button, disabled when 0 selected

### Model Card (inside Drawer)
**Layout:**
- Cover image (aspect-ratio 16:9, object-fit cover, fallback gradient if no cover_image_url)
- Checkbox overlay (top-right corner)
- Model name (bold, single line, truncated)
- Owner name (muted text, single line)
- Description (2 lines max, truncated, hover tooltip shows full text)
- Run count badge (e.g. "2.3M runs")

### Gallery Thumbnails (cross-cutting change)
**Position:** Main content area, Gallery grid
**When:** Always visible on generation cards

**Layout change:**
- Model Badge: Small label overlay (bottom-left of thumbnail) showing model display name
- Semi-transparent background for readability
  - Long model names truncated with text-overflow ellipsis to fit badge width

---

## UI Components & States

| Element | Type | Location | States | Behavior |
|---------|------|----------|--------|----------|
| `model-trigger` | Compact Card Group | Prompt Area | `single` (1 model), `multi` (2-3 models), `loading` (initial fetch) | Shows selected models, click "Browse" opens Drawer |
| `model-trigger-item` | Mini Card | Inside trigger | `default`, `hover` (shows X button more prominently) | X button removes model from selection |
| `model-browser-drawer` | Drawer | Overlay (right) | `loading`, `loaded`, `error`, `empty` | Fetches from Collections API on open (uses cache) |
| `model-search` | Input | Drawer header | `empty`, `has-value` | Filters cards by name/description client-side |
| `model-filter-chips` | Chip Group | Drawer, below search | `all` (default), `filtered` (one owner active) | Single-select filter by owner |
| `model-card` | Card | Drawer grid | `default`, `hover`, `selected` (ring + checkmark), `disabled` (max 3 reached, not already selected) | Click toggles selection |
| `model-card-checkbox` | Checkbox | Model Card top-right | `unchecked`, `checked`, `disabled` | Visual indicator of selection state |
| `model-card-description` | Text | Model Card | `truncated` (default, 2 lines), `tooltip` (hover shows full) | Truncated with "mehr anzeigen" tooltip on hover |
| `confirm-button` | Button | Drawer footer | `disabled` (0 selected, text: "Select at least 1 model"), `enabled` (1-3 selected, text: "Confirm (N Models)") | Shows count when enabled, guidance text when disabled |
| `model-badge` | Badge | Gallery thumbnail | `visible` (always) | Semi-transparent overlay, bottom-left, model slug |
| `parameter-panel-notice` | Text | Prompt Area (Parameter Panel area) | `hidden` (1 model selected), `visible` (>1 model selected) | Replaces parameter panel: "Default parameters will be used for multi-model generation" |

---

## Feature State Machine

### States Overview

| State | UI | Available Actions |
|-------|----|--------------------|
| `idle` | Trigger card shows selected model(s), Drawer closed | Click "Browse Models", Remove model (X), Generate |
| `browsing` | Drawer open, cards loaded | Search, Filter, Select/Deselect cards, Confirm, Close |
| `browsing-loading` | Drawer open, spinner visible | Close |
| `browsing-error` | Drawer open, error message | Retry, Close |
| `generating` | Trigger card unchanged, Gallery shows loading placeholders per model | Cancel (if supported) |

### Transitions

| Current State | Trigger | UI Feedback | Next State | Business Rules |
|---------------|---------|-------------|------------|----------------|
| `idle` | Click "Browse Models" | Drawer slides in from right | `browsing-loading` | -- |
| `browsing-loading` | API response received | Spinner -> Card grid | `browsing` | Cache: 1h TTL |
| `browsing-loading` | API error | Spinner -> Error message + Retry button | `browsing-error` | -- |
| `browsing-error` | Click "Retry" | Error -> Spinner | `browsing-loading` | -- |
| `browsing` | Click unchecked card (< 3 selected) | Card gets ring + checkmark, counter updates | `browsing` | Max 3 models |
| `browsing` | Click unchecked card (3 already selected) | No change, inline hint "Select up to 3 models" shown | `browsing` | 4th card blocked |
| `browsing` | Click checked card | Ring + checkmark removed, counter updates | `browsing` | Min 0 models (Confirm disabled at 0) |
| `browsing` | Click "Confirm (N)" | Drawer closes, trigger updates | `idle` | N >= 1 |
| `browsing` | Click close (X) or backdrop | Drawer closes, selection reverted to pre-open state | `idle` | Unsaved changes discarded |
| `idle` | Click X on trigger mini-card | Mini-card removed, selection updated | `idle` | Min 1 model must remain; last model cannot be removed |
| `idle` | Click "Generate" | Parallel API calls, loading placeholders in Gallery | `generating` | 1 request per selected model |
| `generating` | All predictions complete | Placeholder -> Result images with Model Badge | `idle` | -- |
| `generating` | Some fail, some succeed | Failed -> error card, succeeded -> result with Badge | `idle` | Partial success allowed |

---

## Business Rules

- Max 3 models selectable simultaneously
- Min 1 model must always be selected (cannot remove last model from trigger)
- Closing Drawer without confirming discards selection changes
- Models come exclusively from Replicate Collections API (`text-to-image` collection)
- No static model whitelist; any model from the collection is accepted for generation
- Collections API response cached server-side with 1h TTL
- Parallel generation: 1 prediction per selected model, all fired simultaneously
- Model Badge on Gallery thumbnails: shows technical model slug (e.g. `flux-1.1-pro`) from stored `model_id`
- Description tooltip: full text on hover when description exceeds 2 lines
- Filter chips: dynamically generated from unique owner names in loaded models
- Search: client-side filter on model name + description (case-insensitive)
- Search and owner filter are applied simultaneously (AND logic). Changing the owner filter does not clear the search, and vice versa
- Parameter Panel: shown only when exactly 1 model is selected. When >1 model selected, panel is hidden with note "Default parameters will be used for multi-model generation"
- Max-select feedback: when 3 models are selected, unselected cards show disabled state and an inline hint "Select up to 3 models" is visible near the selection counter

---

## Data

### Replicate Collections API Response (per model)

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `url` | Yes | Valid URL | Link to Replicate model page |
| `owner` | Yes | Non-empty string | Used for filter chips and display |
| `name` | Yes | Non-empty string | Combined with owner as model ID: `{owner}/{name}` |
| `description` | No | String or null | Shown on card, truncated to 2 lines |
| `cover_image_url` | No | Valid URL or null | Card cover image; fallback gradient if null |
| `run_count` | Yes | Integer >= 0 | Formatted as "2.3M runs", "150K runs", etc. |
| `default_example` | No | Object or null | Not used in this feature |

### Generation Record (existing, changed field)

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `model_id` | Yes | Non-empty string | Already stored; now used for Model Badge display |

---

## Trigger Inventory

| Trigger | Source | Action |
|---------|--------|--------|
| Page load / Workspace open | App | Fetch Collections API (or serve from cache) to populate default model selection |
| Click "Browse Models" | User | Open Model Browser Drawer |
| Click Model Card checkbox | User | Toggle model selection (max 3) |
| Click "Confirm" in Drawer | User | Apply selection, close Drawer |
| Click X on Drawer / backdrop | User | Discard changes, close Drawer |
| Click X on trigger mini-card | User | Remove model from selection |
| Click "Generate" | User | Fire parallel predictions for all selected models |
| Search input change | User | Client-side filter model cards |
| Filter chip click | User | Filter model cards by owner |
| Cache TTL expires (1h) | System | Next API call fetches fresh data |

---

## Implementation Slices

### Dependencies

```
Slice 1 (API + Cache) -> Slice 2 (Model Card) -> Slice 3 (Browser Drawer)
                                                        |
                                               Slice 4 (Multi-Select + Trigger)
                                                        |
                                               Slice 5 (Parallel Generation)
                                                        |
                                               Slice 6 (Gallery Model Badge)
```

### Slices

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| 1 | Collections API Service + Cache | Server action to fetch `/v1/collections/text-to-image`, parse response, cache in-memory (1h TTL). Remove static `MODELS` array and whitelist check from `getModelSchema`. | Unit test: mock API, verify cache hit/miss/expiry. Integration: verify model list returned. | -- |
| 2 | Model Card Component | Presentational card: cover image (with fallback), name, owner, description (truncated + tooltip), run count badge, checkbox, selected state (ring + checkmark), disabled state. | Unit test: render with mock data, verify truncation, tooltip, selected/disabled states. | Slice 1 (needs model data shape) |
| 3 | Model Browser Drawer | Drawer with search input, filter chips (by owner), 2-col card grid, confirm button, loading/error/empty states. Close discards uncommitted changes. | Unit test: render with mock models, verify search filter, owner filter, confirm/close behavior. | Slice 2 |
| 4 | Multi-Select + Compact Trigger | Replace Select dropdown in Prompt Area with compact trigger card. Show 1-3 stacked mini-cards with X remove. Wire to Drawer for selection. Max 3, min 1 enforcement. | Unit test: add/remove models, verify max 3, min 1 rules. Integration: Drawer -> Trigger flow. | Slice 3 |
| 5 | Parallel Multi-Model Generation | Modify `generateImages` action to accept array of model IDs. Fire parallel predictions via `Promise.allSettled`. Handle partial failures. | Unit test: mock replicateRun, verify parallel calls. Integration: 2 models -> 2 generation records. | Slice 4 |
| 6 | Gallery Model Badge | Add Model Badge overlay (bottom-left) on all Gallery thumbnails. Derive display name from stored `model_id`. | Unit test: render generation card with model badge. Visual: badge visible, readable on various images. | Slice 5 (needs model_id on generations) |

### Recommended Order

1. **Slice 1:** Collections API Service + Cache -- Foundation: provides model data for all other slices
2. **Slice 2:** Model Card Component -- Presentational, no side effects, easy to test in isolation
3. **Slice 3:** Model Browser Drawer -- Combines cards with search/filter, needs card component
4. **Slice 4:** Multi-Select + Compact Trigger -- Integrates Drawer into Prompt Area, replaces dropdown
5. **Slice 5:** Parallel Multi-Model Generation -- Backend change, needs multi-select wired up
6. **Slice 6:** Gallery Model Badge -- Cross-cutting UI change, depends on model_id in generation data

---

## Context & Research

### Similar Patterns in Codebase

| Feature | Location | Relevant because |
|---------|----------|------------------|
| Builder Drawer | `components/prompt-builder/builder-drawer.tsx` | Drawer pattern with content, can reuse open/close pattern |
| Template Selector | `components/workspace/template-selector.tsx` | Selection UI inside Prompt Area, similar trigger pattern |
| Parameter Panel | `components/workspace/parameter-panel.tsx` | Dynamic rendering based on model schema, already model-aware |
| Generation Card | `components/workspace/` | Gallery card where Model Badge will be added |

### Web Research

| Source | Finding |
|--------|---------|
| [Replicate HTTP API Docs](https://replicate.com/docs/reference/http) | Model endpoint returns: url, owner, name, description, cover_image_url, run_count, default_example, latest_version |
| [Replicate Collections API](https://replicate.com/collections/text-to-image) | `/v1/collections/text-to-image` returns curated top image generation models with full model objects |
| [Replicate Rate Limits](https://replicate.com/docs/topics/predictions/rate-limits) | 600 predictions/min, no concurrent limit documented -- parallel generation is safe |
| [Replicate Pricing](https://replicate.com/pricing) | No pricing API. Prices only on website (client-rendered). Range: $0.003-$0.09/image |
| [Replicate Changelog - Search API](https://replicate.com/blog/new-search-api) | Search API exists but Collections API is better fit for curated "top models" |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| -- | All questions resolved | -- | -- | -- |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-07 | Codebase | Static `MODELS` in `lib/models.ts` (9 models, id/name/price). Dropdown in `prompt-area.tsx`. Schema fetched dynamically per model already. |
| 2026-03-07 | Replicate API | GET `/v1/models/{owner}/{name}` returns: url, owner, name, description, cover_image_url, run_count, default_example, latest_version |
| 2026-03-07 | Replicate API | GET `/v1/collections/{slug}` returns curated models with all metadata. `text-to-image` collection exists. |
| 2026-03-07 | Replicate API | No pricing API. Prices only on website, client-rendered, not scrapable. |
| 2026-03-07 | Replicate API | Rate limits: 600 req/min for predictions, no concurrent prediction limit. Parallel generation safe. |
| 2026-03-07 | Codebase | `replicateRun()` in `lib/clients/replicate.ts` already accepts any model ID string -- no whitelist enforcement at client level |
| 2026-03-07 | Codebase | `getModelSchema` in `app/actions/models.ts` validates against static `MODELS` via `getModelById` -- this check must be removed |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| 1 | Soll ich erst die essenziellen Scope-Fragen mit dir durchgehen, oder moechtest du direkt deine Vorstellungen beschreiben? | Scope-Fragen zuerst |
| 2 | Woher sollen die Models kommen? Statisch, Hybrid, oder dynamisch via Collections API? | Dynamisch via API. Collections API holt automatisch Top text-to-image Models. |
| 3 | Wie viele Models sollen gleichzeitig als Cards angezeigt werden ("Top X")? | Dynamisch -- alle aus der Collection anzeigen, scrollbar. |
| 4 | Wie sollen die Model-Cards sortiert werden? | Nach Replicate-Reihenfolge (wie die Collection API sie liefert). |
| 5 | Welche Informationen sollen auf einer Model-Card sichtbar sein? | Cover + Name + Description + Run Count + Preis. (Preis spaeter entfallen, siehe #8) |
| 6 | Wo sollen die Model-Cards im UI platziert werden? | Modal/Drawer. Prompt-Area bleibt kompakt, Browse-Button oeffnet Drawer mit voller Card-Ansicht. |
| 7 | User-Anmerkung zur Description | Description abgeschnitten mit "mehr anzeigen" als Tooltip. |
| 8 | Replicate bietet keine Pricing-API. Wie damit umgehen? Max Preise: $0.003-$0.09/image. | Preis weglassen. Kein Preis auf Cards. |
| 9 | Wie soll die Collections-API-Response gecacht werden? | Server-side Cache mit 1h TTL. |
| 10 | Was passiert wenn ein Model aus der Collection nicht in der statischen MODELS-Liste ist? | Statische Liste entfernen. Jedes Collection-Model ist generierbar. |
| 11 | Wie soll der Drawer geoeffnet werden und das ausgewaehlte Model in der Prompt-Area angezeigt werden? | Kompakte Card als Trigger: Thumbnail + Name + Owner + "Browse Models" Link. |
| 12 | Was soll der Drawer noch koennen ausser Cards anzeigen? | Cards + Suchfeld + Filter (Chips nach Owner). |
| 13 | Soll das ausgewaehlte Model im Drawer visuell hervorgehoben sein? | Ja, Ring/Border + Checkmark. |
| 14 | User-Ergaenzung: Multi-Model-Auswahl | Mehrere Models auswaehlen fuer Vergleichsmodus, maximal 3. |
| 15 | Wie soll der Vergleichsmodus funktionieren? Parallel oder sequenziell? | Parallel, aber Rate Limits beachten. Recherche ergab: 600 req/min, kein Concurrent-Limit -- parallel ist sicher. |
| 16 | Wie wird der Multi-Select im Drawer dargestellt? | Checkboxen auf Cards. Counter "2/3 ausgewaehlt". Confirm-Button unten. |
| 17 | Wie sollen Vergleichs-Ergebnisse in der Gallery dargestellt werden? | Flat in Gallery mit Model-Badge auf allen Thumbnails (nicht nur Vergleiche). Dedizierter Vergleichs-View kommt in separater Discovery. |
| 18 | Wie soll die kompakte Trigger-Card bei Multi-Select aussehen? | Gestackte Mini-Cards: je Thumbnail + Name + Owner + X-Button. "Browse Models" Link darunter. |
