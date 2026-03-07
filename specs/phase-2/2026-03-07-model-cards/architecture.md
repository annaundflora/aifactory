# Feature: Model Cards & Multi-Model Selection

**Epic:** --
**Status:** Ready
**Discovery:** `discovery.md` (same folder)
**Derived from:** Discovery constraints, NFRs, and risks

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

## API Design

### Overview

| Aspect | Specification |
|--------|---------------|
| Style | Next.js Server Actions (consistent with existing `app/actions/` pattern) |
| Authentication | Server-side only; `REPLICATE_API_TOKEN` env var (existing) |
| Rate Limiting | Replicate: 600 req/min for predictions. Collections API: standard rate limit, mitigated by 1h cache |

### Server Actions

| Action | Input | Output | Auth | Business Logic |
|--------|-------|--------|------|----------------|
| `getCollectionModels()` | -- | `CollectionModel[]` or `{ error: string }` | Server-only (API token) | Fetch from Collections API via `CollectionModelService`, return cached if fresh |
| `getModelSchema({ modelId })` | `{ modelId: string }` | `{ properties }` or `{ error }` | Server-only | Remove `getModelById()` whitelist check; accept any `owner/name` format |
| `generateImages(input)` | `GenerateImagesInput` (changed) | `Generation[]` or `{ error }` | Server-only | Accept `modelIds: string[]`; single model = variant count; multi-model = 1 per model, default params |

### Data Transfer Objects (DTOs)

| DTO | Fields | Validation | Notes |
|-----|--------|------------|-------|
| `CollectionModel` | `url: string`, `owner: string`, `name: string`, `description: string \| null`, `cover_image_url: string \| null`, `run_count: number` | Non-empty owner + name | Mapped from Replicate API response; `default_example` and `latest_version` dropped |
| `GenerateImagesInput` (changed) | `projectId: string`, `promptMotiv: string`, `promptStyle?: string`, `negativePrompt?: string`, `modelIds: string[]`, `params: Record<string, unknown>`, `count: number` | `modelIds.length >= 1 && <= 3`; each ID matches `owner/name` pattern | Replaces `modelId: string` with `modelIds: string[]` |

---

## Database Schema

### No Schema Changes Required

| Aspect | Current State | Impact |
|--------|---------------|--------|
| `generations.modelId` | `varchar("model_id", { length: 255 }).notNull()` | Already stores full model ID (e.g. `black-forest-labs/flux-2-pro`). Works for any Collection model. |
| `generations.modelParams` | `jsonb("model_params").notNull().default({})` | Already stores arbitrary params. Works with default params for multi-model. |
| New tables | -- | None needed. Collection models come from external API + in-memory cache. |

### Rationale

- `modelId` is varchar(255) which accommodates any Replicate model ID format (`owner/name`)
- No model metadata table needed: metadata is fetched on-demand from Collections API and cached in-memory
- Gallery Model Badge derives display name from stored `modelId` (extract `name` portion or lookup from cached collection)

---

## Server Logic

### Services & Processing

| Service | Responsibility | Input | Output | Side Effects |
|---------|----------------|-------|--------|--------------|
| `CollectionModelService` (NEW) | Fetch + cache models from Replicate Collections API | -- | `CollectionModel[]` | HTTP GET to Replicate API (only on cache miss/expiry) |
| `ModelSchemaService` (CHANGED) | Fetch + cache OpenAPI schema per model | `modelId: string` | `SchemaProperties` | Remove `getModelById()` whitelist; accept any model ID |
| `GenerationService.generate()` (CHANGED) | Create pending records + process | `projectId, prompt*, modelIds[], params, count` | `Generation[]` | Multi-model: creates 1 pending record per model; single: creates `count` records for that model |

### Business Logic Flow

**Single Model (count 1-4):**
```
Prompt Area → generateImages({ modelIds: [id], count: N, params })
  → Validate prompt + model count
  → Create N pending generations (same model, custom params)
  → Process sequentially (existing behavior)
  → Return pending generations for optimistic UI
```

**Multi-Model (2-3 models):**
```
Prompt Area → generateImages({ modelIds: [id1, id2, id3], count: 1, params: {} })
  → Validate prompt + model count (max 3)
  → Create 1 pending generation per model (default params)
  → Process via Promise.allSettled (parallel, independent)
  → Return pending generations for optimistic UI
```

### Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `promptMotiv` | Non-empty after trim | "Prompt darf nicht leer sein" |
| `modelIds` | Array, length 1-3, each matches `{owner}/{name}` pattern | "1-3 Modelle muessen ausgewaehlt sein" |
| `count` | Integer 1-4 (only relevant for single model) | "Anzahl muss zwischen 1 und 4 liegen" |

### CollectionModelService Cache Design

| Aspect | Specification |
|--------|---------------|
| Storage | In-memory `Map` with timestamp (same pattern as `ModelSchemaService`) |
| Cache Key | `"text-to-image"` (collection slug) |
| TTL | 1 hour (3,600,000 ms) |
| Cache Miss | Fetch `GET /v1/collections/text-to-image` from Replicate API |
| Cache Hit | Return stored `CollectionModel[]` if `Date.now() - timestamp < TTL` |
| Invalidation | TTL-based only; `clearCache()` method for testing |
| Error Handling | API failure returns error, does NOT cache error responses |
| Fetch Timeout | 5000ms via `AbortController` + `setTimeout`; abort signal passed to `fetch()` |

---

## Security

### Authentication & Authorization

| Area | Mechanism | Notes |
|------|-----------|-------|
| Replicate API | Bearer token via `REPLICATE_API_TOKEN` env var | Server-side only; never exposed to client. Existing mechanism. |
| Collections API | Same token | No additional auth needed |
| User Auth | N/A | No user auth in current app; no change |

### Data Protection

| Data Type | Protection | Notes |
|-----------|------------|-------|
| `REPLICATE_API_TOKEN` | Server-side env var | Already protected; Collections API call is server action |
| Collection model data | Public data from Replicate | No sensitive data in collection response |

### Input Validation & Sanitization

| Input | Validation | Sanitization |
|-------|------------|--------------|
| `modelIds[]` | Array length 1-3; each matches `^[a-z0-9-]+/[a-z0-9._-]+$` regex | Reject invalid format before API call |
| Search query (client-side) | N/A (client-side filter only) | No server call; filtered in-browser |
| Owner filter (client-side) | N/A (client-side filter only) | No server call; filtered in-browser |

### Rate Limiting & Abuse Prevention

| Resource | Limit | Window | Penalty |
|----------|-------|--------|---------|
| Collections API | Mitigated by 1h cache | Per server instance | N/A (at most 1 call/hour) |
| Predictions (generation) | 600 req/min (Replicate limit) | Per API token | Replicate returns 429; existing error handling catches this |
| Multi-model generation | Max 3 parallel predictions per Generate click | Per action | Enforced by `modelIds.length <= 3` validation |

---

## Architecture Layers

### Layer Responsibilities

| Layer | Responsibility | Pattern |
|-------|----------------|---------|
| Server Actions (`app/actions/`) | Validate input, call services, return DTOs | Next.js Server Action pattern |
| Services (`lib/services/`) | Business logic, caching, orchestration | Service pattern with in-memory cache |
| Clients (`lib/clients/`) | External API calls (Replicate, R2) | Client wrapper pattern (existing) |
| Components (`components/`) | UI rendering, local state, user interaction | React Client Components |
| UI primitives (`components/ui/`) | Reusable design system components | shadcn/ui pattern |

### Data Flow

```
[Browser] → [Server Action: getCollectionModels] → [CollectionModelService] → [Replicate API]
                                                           ↓ (cache)
                                                    [In-Memory Map]

[Browser] → [Server Action: generateImages] → [GenerationService]
                                                    ↓
                                              [Create N pending records]
                                                    ↓
                                              [Promise.allSettled per model]
                                                    ↓
                                              [ReplicateClient.run] → [R2 Upload] → [DB Update]
```

### Error Handling Strategy

| Error Type | Handling | User Response | Logging |
|------------|----------|---------------|---------|
| Collections API unreachable | Return `{ error }` from server action | Drawer shows error state + retry button | `console.error` |
| Collections API empty response | Return empty array | Drawer shows "No models available" | None |
| Invalid model ID format | Reject in validation | Toast error message | None |
| Single model generation failure | Mark generation as failed (existing) | Error card in Gallery with retry | `console.error` |
| Partial multi-model failure | `Promise.allSettled` — each independent | Failed model shows error card, succeeded show result | `console.error` per failure |
| Schema fetch failure for unknown model | Return `{ error }` | Toast error, parameter panel hidden | `console.error` |

---

## Migration Map

| Existing File | Current Pattern | Target Pattern | Specific Changes |
|---|---|---|---|
| `lib/models.ts` | Static `MODELS` array (9 hardcoded models), `Model` interface, `getModelById()`, `formatPrice()` | Remove entirely | Delete file. `Model` interface replaced by `CollectionModel`. `getModelById()` no longer needed (no whitelist). `formatPrice()` unused (price removed from UI). |
| `app/actions/models.ts` | `getModelSchema()` validates via `getModelById()` whitelist check | Accept any model ID; add `getCollectionModels()` action | Remove `getModelById()` import + check. Add `getCollectionModels()` server action. Validate model ID format with regex instead. |
| `app/actions/generations.ts` | `GenerateImagesInput.modelId: string`; validates via `getModelById()` | `modelIds: string[]`; validate array length + format | Change `modelId` to `modelIds` in input type. Replace `getModelById()` check with format validation + length check. Adjust `GenerationService.generate()` call. |
| `lib/services/generation-service.ts` | `generate()` takes single `modelId`, creates `count` pending records, processes sequentially | Accept `modelIds[]`; single model = count records sequential; multi-model = 1 per model parallel | Add multi-model branch: if `modelIds.length > 1`, create 1 generation per model with default params, process via `Promise.allSettled`. Remove `getModelById()` import + check. |
| `lib/services/model-schema-service.ts` | `getSchema()` validates via `getModelById()` whitelist; no fetch timeout | Accept any model ID string; add 5s fetch timeout | Remove `getModelById()` import + check. Validate format (`owner/name` has exactly one `/`) before API call. Add `AbortController` with 5000ms timeout to `fetch()` call. |
| `components/workspace/prompt-area.tsx` | `<Select>` dropdown with static `MODELS` array; `selectedModelId: string` state | Compact trigger card component; `selectedModels: CollectionModel[]` state | Remove `MODELS` import + Select dropdown (lines 241-256). Replace with `ModelTrigger` component. Change state from `selectedModelId: string` to `selectedModels: CollectionModel[]`. Add `useEffect` to fetch collection models on mount. Conditionally hide ParameterPanel + variant count when `selectedModels.length > 1`. |
| `components/workspace/generation-card.tsx` | Image thumbnail with hover prompt overlay; no model info shown | Add Model Badge overlay (bottom-left) | Add `ModelBadge` component inside the button, positioned absolute bottom-left. Derive display name from `generation.modelId` (split on `/`, take name part). |
| `components/lightbox/lightbox-modal.tsx` | Imports `getModelById` from `lib/models` (line 8); uses it for `displayName` lookup (line 141) | Derive display name from `generation.modelId` directly | Remove `getModelById` import. Replace `getModelById(generation.modelId)?.displayName` with helper that extracts name from model ID string (split on `/`, take name, replace hyphens with spaces, title-case). Or lookup from cached collection models if available. |
| `lib/services/prompt-service.ts` | Imports `getModelById` from `lib/models` (line 2); uses it for `displayName` in LLM prompt context (line 45) | Derive display name from `modelId` directly | Remove `getModelById` import. Replace `getModelById(modelId)?.displayName ?? modelId` with same model-ID-to-display-name helper. Display name in LLM system prompt is informational only. |
| `next.config.ts` | `images.remotePatterns` only allows R2 domain (`pub-cd07f08bbf5d4226b8f7ef9510aef4bd.r2.dev`) | Add Replicate cover image domain | Add `{ protocol: "https", hostname: "*.replicate.delivery" }` to `remotePatterns` array. Required if Model Card cover images use `next/image`. Alternative: use plain `<img>` tags for cover images (no `next.config.ts` change needed). Decision: use plain `<img>` with `loading="lazy"` for simplicity (consistent with `generation-card.tsx` pattern). No `next.config.ts` change required. |
| `lib/__tests__/models.test.ts` | Unit tests for static `MODELS` array and `getModelById()` | Remove entirely | Delete file. Tests for static model list are obsolete when models come from API. New tests for `CollectionModelService` will be created in corresponding slices. |

---

## Constraints & Integrations

### Constraints

| Constraint | Technical Implication | Solution |
|------------|----------------------|----------|
| No Replicate Pricing API | Cannot show price per image on model cards | Omit price from UI entirely (Discovery decision Q8) |
| Max 3 concurrent model selections | Must enforce in UI + server validation | Client: disabled state on cards when 3 selected. Server: `modelIds.length <= 3` check. |
| Min 1 model always selected | Last model cannot be removed from trigger | Client: hide X button on last remaining model. Server: `modelIds.length >= 1` check. |
| Closing Drawer without confirm discards changes | Drawer needs separate temporary selection state | Drawer manages `tempSelectedModels` locally; only commits to parent on "Confirm" |
| Parameter Panel hidden for multi-model | Default params used when >1 model selected | Prompt Area conditionally renders ParameterPanel only when `selectedModels.length === 1` |
| Variant count hidden for multi-model | Multi-model always generates 1 per model | Prompt Area conditionally renders variant count selector only when `selectedModels.length === 1` |

### Integrations

| Area | System / Capability | Interface | Version | Notes |
|------|----------------------|-----------|---------|-------|
| Model Data | Replicate Collections API | REST `GET /v1/collections/text-to-image` | v1 (stable, documented at replicate.com/docs/reference/http) | Returns curated text-to-image models with metadata |
| Model Schema | Replicate Models API | REST `GET /v1/models/{owner}/{name}` | v1 (existing integration) | Fetches OpenAPI input schema per model |
| Image Generation | Replicate Predictions API | REST (via `replicate` npm client) | v1 (via replicate 1.4.0) | Creates + polls predictions |
| UI Components | shadcn/ui Badge | `pnpm dlx shadcn@3 add badge` | shadcn 3.8.5 (pinned in package.json as `^3.8.5`) | New dependency for Model Badge + run count display. Use v3 CLI to match existing project setup. |
| UI Components | shadcn/ui Sheet | Already installed | Radix UI Dialog-based | Reused for Model Browser Drawer (side="right") |
| UI Components | shadcn/ui Card | Already installed | Existing | Base for Model Card component |
| UI Components | shadcn/ui Input | Already installed | Existing | Search field in Drawer |
| Frontend Framework | Next.js | App Router, Server Actions | 16.1.6 (in package.json) | Server-side caching via service layer |
| ORM | Drizzle ORM | PostgreSQL dialect | 0.45.1 (in package.json) | No schema changes needed |
| Runtime | React | Client Components, hooks | 19.2.3 (in package.json) | useEffect, useState, useMemo for UI state |

---

## Quality Attributes (NFRs)

### From Discovery → Technical Solution

| Attribute | Target | Technical Approach | Measure / Verify |
|-----------|--------|--------------------|------------------|
| Performance: Collection Load | < 200ms for cached, < 2s for uncached | In-memory Map cache with 1h TTL; single API call fetches all models | Log cache hit/miss ratio; measure response time in Network tab |
| Performance: Drawer Open | < 100ms perceived | Models pre-fetched on workspace mount; Drawer renders from cached data | No loading spinner on subsequent opens |
| Performance: Parallel Generation | All predictions start within 1s of Generate click | `Promise.allSettled()` fires all predictions concurrently | Verify via Replicate dashboard: prediction timestamps within 1s |
| Reliability: Partial Failure | One model failure doesn't block others | `Promise.allSettled()` (not `Promise.all()`); each generation independent | Test: mock one model to fail, verify others succeed |
| UX: Search Responsiveness | Instant filter (< 50ms) | Client-side filter on cached data; no server roundtrip | Manual testing |
| UX: Default Model | First model pre-selected on workspace load | Initialize `selectedModels` with `[collectionModels[0]]` after fetch | Verify trigger shows first collection model |
| Reliability: API Timeout | No hung requests to external APIs | All `fetch()` calls to Replicate API use `AbortController` with 5000ms timeout. Timeout triggers error response, not indefinite hang. | Test with slow/unresponsive endpoint mock |

### Monitoring & Observability

| Metric | Type | Target | Alert |
|--------|------|--------|-------|
| Collections API cache miss | Counter | < 1/hour per server instance | N/A (expected behavior) |
| Collections API fetch failure | Error log | 0 sustained failures | `console.error` (existing pattern) |
| Multi-model generation success rate | Per-generation status | Same as single-model | Existing per-generation error logging |

---

## Risks & Assumptions

### Assumptions

| Assumption | Technical Validation | Impact if Wrong |
|------------|---------------------|-----------------|
| Replicate Collections API returns all text-to-image models in single response (no pagination needed) | Discovery research confirmed collection returns full list | Would need pagination handling in `CollectionModelService`; add `cursor` parameter support |
| All Collection models accept a `prompt` input parameter | Replicate text-to-image models standardize on `prompt` field | Generation would fail for non-standard models; add input schema validation before generation |
| `cover_image_url` is a publicly accessible URL (no auth needed for display) | Replicate serves cover images on public CDN | Would need server-side proxy for images; add `next/image` with `remotePatterns` config |
| In-memory cache sufficient (single server instance) | Current deployment is single-instance | Would need external cache (Redis) for multi-instance; module-level Map persists per instance |
| `modelId` varchar(255) fits all Replicate model IDs | Longest known: `stability-ai/stable-diffusion-xl-base-1.0` (47 chars) | 255 chars is generous; no risk |

### Risks & Mitigation

| Risk | Likelihood | Impact | Technical Mitigation | Fallback |
|------|------------|--------|---------------------|----------|
| Collections API returns empty or removed collection | Low | High (no models to select) | Cache last successful response; show cached data even if expired when API fails | Hard-code 3-5 default model IDs as emergency fallback |
| Model removed from collection but user has it selected | Low | Medium (generation fails) | Validate model exists via schema fetch before generation; show error per failed model | User selects different model; error card shows in gallery |
| Replicate rate limit hit during multi-model generation | Low | Medium (some generations fail) | Max 3 parallel = max 3 concurrent predictions; well within 600/min limit | `Promise.allSettled` handles partial failure; failed models show error cards |
| `cover_image_url` blocked by CORS or CSP | Medium | Low (visual only) | Configure `next.config.ts` `images.remotePatterns` for `replicate.delivery` domain | Gradient fallback in Model Card (already designed in wireframes) |
| Large collection response (50+ models) | Medium | Low (slower render) | Client-side virtual scrolling not needed for < 100 items; 2-col grid is already efficient | Limit displayed models to first 50 if performance degrades |

---

## Technology Decisions

### Stack Choices

| Area | Technology | Rationale |
|------|------------|-----------|
| Cache | In-memory Map with TTL | Consistent with existing `ModelSchemaService` pattern; no external dependency; sufficient for single-instance deployment |
| Parallel Execution | `Promise.allSettled()` | Handles partial failures gracefully; each model generation independent; native JS |
| UI Drawer | shadcn Sheet (side="right") | Already used by BuilderDrawer; consistent UX; Radix-based with animations |
| Badge Component | shadcn Badge | Lightweight; consistent with design system; `pnpm dlx shadcn@3 add badge` (match project's shadcn v3.8.5) |
| State: Model Selection | React `useState<CollectionModel[]>` | Simple; no external store needed; contained in PromptArea component |
| State: Drawer Temp Selection | Local `useState` inside Drawer | Isolated; discarded on close without confirm; no global state pollution |
| Client-side Search/Filter | `Array.filter()` + `String.includes()` | Fast enough for < 100 models; no search library needed |

### Trade-offs

| Decision | Pro | Con | Mitigation |
|----------|-----|-----|------------|
| In-memory cache (no Redis) | Zero infrastructure; consistent pattern | Lost on server restart; per-instance | 1h TTL means max 1 extra API call after restart |
| Remove static MODELS entirely | Clean; single source of truth (API) | No offline/fallback models | Emergency fallback array can be added later if needed |
| `modelIds[]` replaces `modelId` | Uniform API; cleaner multi-model support | Breaking change to server action signature | Single migration; update all callsites (prompt-area only) |
| Client-side search (no server search) | No API calls; instant; simple | Limited to loaded models | Collection is curated (< 50 models); search API available if needed later |
| Model display name from `modelId` split | No extra lookup for Gallery Badge | Less "pretty" than a display name mapping | Collection cache can be used for lookup when available; fallback to ID split |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| -- | All questions resolved during Discovery | -- | -- | -- |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-07 | Codebase: Stack | Next.js 16.1.6, React 19.2.3, Drizzle ORM 0.45.1, shadcn/ui, Tailwind CSS 4, replicate 1.4.0 |
| 2026-03-07 | Codebase: Models | Static `MODELS` array in `lib/models.ts` (9 models). `getModelById()` used as whitelist in 3 files: `app/actions/models.ts`, `app/actions/generations.ts`, `lib/services/generation-service.ts` |
| 2026-03-07 | Codebase: Schema | `modelId` varchar(255) already stored on `generations` table. No schema change needed. |
| 2026-03-07 | Codebase: Cache | `model-schema-service.ts` uses in-memory `Map` cache (no TTL). Pattern reusable with TTL addition. |
| 2026-03-07 | Codebase: State | `selectedModelId: string` in prompt-area.tsx local state. Workspace context only for variation flow. |
| 2026-03-07 | Codebase: Generation | `GenerationService.generate()` processes sequentially in fire-and-forget async block. Takes single `modelId`. |
| 2026-03-07 | Codebase: Gallery | `generation-card.tsx` shows `imageUrl` + `prompt` hover. No model info displayed. |
| 2026-03-07 | Codebase: Drawer | `BuilderDrawer` uses `Sheet` (side="right") with controlled open state. Pattern reusable. |
| 2026-03-07 | Codebase: Badge | No `components/ui/badge.tsx` exists. `SidebarMenuBadge` exists but is sidebar-specific. Need to add shadcn Badge. |
| 2026-03-07 | Replicate API | `GET /v1/collections/text-to-image` returns curated models with `url`, `owner`, `name`, `description`, `cover_image_url`, `run_count`. Auth via Bearer token. |
| 2026-03-07 | Replicate API | No pricing API. Prices only on website (client-rendered). |
| 2026-03-07 | Replicate API | Rate limits: 600 predictions/min. No concurrent limit. Parallel multi-model generation safe. |
| 2026-03-07 | npm | `replicate` package: 1.4.0 (matches project). Current stable. |
| 2026-03-07 | shadcn/ui | Badge component: `pnpm dlx shadcn@3 add badge`. Variants: default, outline, secondary, destructive. Project uses shadcn 3.8.5 (package.json `^3.8.5`); use v3 CLI to avoid v3/v4 mixing issues. |
| 2026-03-07 | Codebase: next.config | `images.remotePatterns` may need update for Replicate cover image URLs (replicate.delivery domain). |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| -- | All questions resolved during Discovery phase | See `discovery.md` Q&A Log (18 questions) |
