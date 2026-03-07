# Gate 1: Architecture Compliance Report

**Gepruefte Architecture:** `specs/phase-2/2026-03-07-model-cards/architecture.md`
**Pruefdatum:** 2026-03-07
**Discovery:** `specs/phase-2/2026-03-07-model-cards/discovery.md`
**Wireframes:** `specs/phase-2/2026-03-07-model-cards/wireframes.md`

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 43 |
| WARNING | 0 |
| BLOCKING | 0 |

**Verdict:** APPROVED (Issues from prior runs resolved in architecture.md)

---

## A) Feature Mapping

| Discovery Feature | Architecture Section | API Endpoint | DB Schema | Status |
|-------------------|---------------------|--------------|-----------|--------|
| Collections API integration + 1h cache | Server Logic > CollectionModelService Cache Design | `getCollectionModels()` server action | No change needed (in-memory cache) | PASS |
| Model Card UI (cover, name, desc, runs, checkbox) | Scope + Migration Map (generation-card.tsx) | N/A (client component) | N/A | PASS |
| Model Browser Drawer (search, filter, grid) | Scope + Technology Decisions (Sheet side="right") | N/A (client component) | N/A | PASS |
| Multi-model selection (max 3) | API Design > GenerateImagesInput + Validation Rules + Constraints | `generateImages()` with `modelIds[]` | N/A | PASS |
| Compact trigger card (replaces dropdown) | Migration Map > prompt-area.tsx | N/A (client component) | N/A | PASS |
| Model Badge on Gallery thumbnails | Migration Map > generation-card.tsx | N/A (client component) | Uses existing `modelId` column | PASS |
| Remove static MODELS array | Migration Map > lib/models.ts (delete) | N/A | N/A | PASS |
| Parameter Panel hidden for multi-model | Constraints table rows 5+6 | N/A | N/A | PASS |
| Variant count hidden for multi-model | Constraints table row 6 | N/A | N/A | PASS |
| Parallel generation (Promise.allSettled) | Server Logic > Business Logic Flow (Multi-Model) | `generateImages()` multi-model branch | Existing `generations` table | PASS |
| Error paths (API unreachable, empty, partial fail) | Error Handling Strategy table (6 error types) | All documented | N/A | PASS |
| Default model (first from Collection) | Quality Attributes > UX: Default Model | N/A | N/A | PASS |
| Search (client-side, case-insensitive, AND with filter) | Technology Decisions > Client-side Search/Filter | N/A (no server call) | N/A | PASS |
| Filter chips (dynamic owner names, single-select) | Technology Decisions > Client-side Search/Filter | N/A (no server call) | N/A | PASS |
| Drawer close discards changes | Constraints table row 4 + Technology Decisions (local useState) | N/A | N/A | PASS |
| Min 1 model always selected | Constraints table row 3 + Validation Rules | Client + server validation | N/A | PASS |
| Max-select feedback (disabled state + hint) | Discovery Business Rules (referenced) | N/A (client logic) | N/A | PASS |

---

## B) Constraint Mapping

| Constraint | Source | Wireframe Ref | Architecture | Status |
|------------|--------|---------------|--------------|--------|
| Cover image aspect-ratio 16:9 | Discovery: Model Card Layout | Wireframe: Model Card "Cover image (16:9)" | UI detail, no arch impact | PASS |
| Thumbnail 32x32 in trigger | Discovery: Stacked mini-cards | Wireframe: model-trigger-item "32x32" | UI detail, no arch impact | PASS |
| Description 2 lines max + tooltip | Discovery: Model Card Description | Wireframe: annotation 4 | UI detail, no arch impact | PASS |
| Model name single line truncated | Discovery: Model Card layout | Wireframe: annotation 2 | UI detail, no arch impact | PASS |
| Model Badge bottom-left, semi-transparent | Discovery: Gallery Thumbnails | Wireframe: Gallery annotation 1 | Migration Map: generation-card.tsx "positioned absolute bottom-left" | PASS |
| Long model name truncated on badge | Discovery: Gallery Layout | Wireframe: "long model name" state | Migration Map: "derive display name" | PASS |
| Max 3 models | Discovery: Business Rules | Wireframe: max 3 reached state | Constraints + Validation Rules: `modelIds.length <= 3` | PASS |
| Min 1 model | Discovery: Business Rules | Wireframe: "last model remaining" (X hidden) | Constraints + Validation: `modelIds.length >= 1` | PASS |
| 1h cache TTL | Discovery: Business Rules | N/A | CollectionModelService Cache Design: 3,600,000 ms | PASS |
| 600 req/min rate limit | Discovery: Web Research | N/A | Security > Rate Limiting table | PASS |
| Model ID format `owner/name` | Discovery: Data > name field | N/A | Input Validation: regex `^[a-z0-9-]+/[a-z0-9._-]+$` | PASS |
| Cover image fallback gradient | Discovery: Model Card layout | Wireframe: "no cover image" state | Risks table: "Gradient fallback in Model Card" | PASS |

---

## C) Realistic Data Check

### Codebase Evidence

```
# Existing DB schema patterns (lib/db/schema.ts):
- projects.name:              varchar(255)
- projects.thumbnailUrl:      text          -- URLs use TEXT
- projects.thumbnailStatus:   varchar(20)   -- short enums use varchar
- generations.modelId:        varchar(255)  -- model IDs
- generations.prompt:         text          -- user input (unbounded)
- generations.negativePrompt: text          -- user input (unbounded)
- generations.imageUrl:       text          -- URLs use TEXT
- generations.replicatePredictionId: varchar(255) -- external IDs
- generations.errorMessage:   text          -- variable length
- generations.status:         varchar(20)   -- short enums
- promptSnippets.text:        varchar(500)
- promptSnippets.category:    varchar(100)

# Pattern: URLs consistently use TEXT. Short enums use varchar(20). IDs use varchar(255).
```

### External API Analysis

| API | Field | Measured Length | Sample | Arch Type | Recommendation |
|-----|-------|----------------|--------|-----------|----------------|
| Replicate Collections | `owner` | 5-20 chars | `black-forest-labs` (18), `stability-ai` (12), `bytedance` (9) | DTO string (no DB) | PASS |
| Replicate Collections | `name` | 5-40 chars | `flux-2-pro` (10), `stable-diffusion-xl-base-1.0` (30) | DTO string (no DB) | PASS |
| Replicate Collections | `description` | 0-500+ chars | Variable, can be multi-paragraph | DTO `string \| null` (no DB) | PASS |
| Replicate Collections | `cover_image_url` | 80-200+ chars | `https://replicate.delivery/pbxt/.../image.jpeg` | DTO `string \| null` (no DB) | PASS |
| Replicate Collections | `url` | 30-60 chars | `https://replicate.com/black-forest-labs/flux-2-pro` | DTO string (no DB) | PASS |
| Replicate Collections | `run_count` | integer | 2300000 | DTO number (no DB) | PASS |
| Replicate | model_id (stored) | 15-50 chars | `ideogram-ai/ideogram-v3-turbo` (30), `stability-ai/stable-diffusion-xl-base-1.0` (47) | varchar(255) | PASS |

### Data Type Verdicts

| Field | Arch Type | Evidence | Verdict | Issue |
|-------|-----------|----------|---------|-------|
| `generations.modelId` | varchar(255) | Longest known: 47 chars. With dynamic collection, IDs follow `owner/name` pattern. Architecture notes longest at 47 chars. 255 provides >5x headroom. | PASS | None |
| `generations.modelParams` | jsonb | Already stores arbitrary params. Default `{}` for multi-model is valid jsonb. No change needed. | PASS | None |
| `CollectionModel` DTO | TypeScript interface (in-memory only) | Not persisted to DB. All fields from API cached in-memory Map with TTL. | PASS | No DB type risk |
| `modelIds[]` validation regex | `^[a-z0-9-]+/[a-z0-9._-]+$` | Measured IDs: `black-forest-labs/flux-2-pro`, `google/imagen-4-fast`, `bytedance/seedream-4.5`, `openai/gpt-image-1.5` -- all match. Dots, dashes, numbers, underscores handled. | PASS | None |

---

## D) External Dependencies

### D1) Dependency Version Check

| Dependency | Arch Version | Pinning File | Pinned? | "Latest"? | Actual Latest | Current? | Status |
|------------|-------------|--------------|---------|-----------|---------------|----------|--------|
| Next.js | 16.1.6 | package.json: `"next": "16.1.6"` | PASS (exact pin) | No | 16.1.6 | PASS | PASS |
| React | 19.2.3 | package.json: `"react": "19.2.3"` | PASS (exact pin) | No | 19.2.4 | PASS (patch behind, non-breaking) | PASS |
| react-dom | 19.2.3 | package.json: `"react-dom": "19.2.3"` | PASS (exact pin) | No | 19.2.4 | PASS (patch behind, non-breaking) | PASS |
| Drizzle ORM | 0.45.1 | package.json: `"drizzle-orm": "^0.45.1"` | PASS (caret pin) | No | 0.45.1 | PASS | PASS |
| replicate | 1.4.0 | package.json: `"replicate": "^1.4.0"` | PASS (caret pin) | No | 1.4.0 | PASS | PASS |
| shadcn CLI | 3.8.5 | package.json: `"shadcn": "^3.8.5"` | PASS (caret pin) | No | 4.0.0 (major bump, not in ^3.x range) | PASS (intentionally stays on v3) | PASS |
| radix-ui | 1.4.3 | package.json: `"radix-ui": "^1.4.3"` | PASS (caret pin) | No | N/A | PASS | PASS |
| Replicate API | v1 | N/A (REST API) | N/A | No | v1 (stable) | PASS | PASS |

Notes on shadcn: Architecture explicitly says `pnpm dlx shadcn@3 add badge` and "Use v3 CLI to match existing project setup." The `^3.8.5` range correctly excludes v4.0.0. This is a deliberate, documented decision -- not a gap.

### D2) External APIs & Services

| Dependency | Rate Limits | Auth | Errors | Timeout | Status |
|------------|-------------|------|--------|---------|--------|
| Replicate Collections API | Mitigated by 1h cache (max 1 call/hour) | Bearer token (REPLICATE_API_TOKEN, server-side) | `{ error }` return + Drawer error state + retry button | 5000ms AbortController (Cache Design table + NFR table) | PASS (resolved) |
| Replicate Models API | Standard rate limit (existing integration) | Bearer token (existing) | `{ error }` + toast (existing behavior) | 5000ms AbortController (Migration Map: model-schema-service.ts) | PASS (resolved) |
| Replicate Predictions API | 600 req/min per token | Bearer token (existing) | Promise.allSettled per-model; error cards in Gallery | Handled by replicate npm client internal polling | PASS (resolved) |

---

## E) Migration Completeness

### Quantitaets-Check

| Discovery Claim | Architecture Coverage | Status |
|---|---|---|
| Remove static MODELS array + update all consumers | Migration Map: 10 entries (1 delete + 7 file changes + 1 new component addition + 1 config decision) | PASS |

Verification: `grep` found 8 production files importing from `@/lib/models`. The Migration Map covers all 8:
1. `lib/models.ts` -- delete
2. `app/actions/models.ts` -- remove getModelById, add getCollectionModels
3. `app/actions/generations.ts` -- modelId to modelIds[]
4. `lib/services/generation-service.ts` -- multi-model branch
5. `lib/services/model-schema-service.ts` -- remove whitelist
6. `components/workspace/prompt-area.tsx` -- replace dropdown
7. `components/lightbox/lightbox-modal.tsx` -- derive display name
8. `lib/services/prompt-service.ts` -- derive display name
Plus 2 additional non-import changes:
9. `components/workspace/generation-card.tsx` -- add Model Badge
10. `next.config.ts` -- decision: no change needed (plain img)

### Qualitaets-Check

| File in Migration Map | Current Pattern | Target Pattern | Specific enough for test? | Status |
|---|---|---|---|---|
| `lib/models.ts` | Static MODELS array, Model interface, getModelById(), formatPrice() | Remove entirely | Yes -- Test: file does not exist | PASS |
| `app/actions/models.ts` | getModelSchema() validates via getModelById() whitelist | Accept any model ID; add getCollectionModels() action | Yes -- Test: no getModelById import; getCollectionModels exported | PASS |
| `app/actions/generations.ts` | GenerateImagesInput.modelId: string; validates via getModelById() | modelIds: string[]; validate array length + format | Yes -- Test: modelIds array in input type; no getModelById import | PASS |
| `lib/services/generation-service.ts` | generate() takes single modelId, sequential | Accept modelIds[]; multi-model = Promise.allSettled | Yes -- Test: accepts array; parallel for length > 1 | PASS |
| `lib/services/model-schema-service.ts` | getSchema() validates via getModelById() | Accept any model ID string, validate format | Yes -- Test: no getModelById import; accepts any owner/name | PASS |
| `components/workspace/prompt-area.tsx` | Select dropdown with MODELS import | Compact trigger card; selectedModels: CollectionModel[] | Yes -- Test: no Select/MODELS import; ModelTrigger rendered | PASS |
| `components/workspace/generation-card.tsx` | Image thumbnail, no model info | Add Model Badge overlay bottom-left | Yes -- Test: ModelBadge rendered; display name derived from modelId | PASS |
| `components/lightbox/lightbox-modal.tsx` | getModelById for displayName lookup (line 141) | Derive display name from modelId directly (split/title-case helper) | Yes -- Test: no getModelById import; display name still shown | PASS |
| `lib/services/prompt-service.ts` | getModelById for displayName in LLM prompt (line 45) | Derive display name from modelId directly | Yes -- Test: no getModelById import; displayName fallback works | PASS |
| `next.config.ts` | remotePatterns: R2 only | Decision: use plain `<img>` for cover images, no change needed | Yes -- Test: no change required (explicit decision documented) | PASS |

### Missing File

| File NOT in Migration Map | Reason | Status |
|---|---|---|
| `lib/__tests__/models.test.ts` | Now included in Migration Map (added in fix iteration 2). Target: "Remove entirely." | PASS (resolved) |

---

## Blocking Issues (Resolved)

### Issue 1: Timeout values — RESOLVED

**Originally:** Timeout values not specified for external API calls.

**Resolution:** Architecture now specifies:
- CollectionModelService Cache Design table: `Fetch Timeout | 5000ms via AbortController + setTimeout; abort signal passed to fetch()`
- Migration Map for model-schema-service.ts: "Add AbortController with 5000ms timeout to fetch() call"
- NFR table: `Reliability: API Timeout | All fetch() calls to Replicate API use AbortController with 5000ms timeout`

---

### Issue 2: Missing test file — RESOLVED

**Originally:** Migration Map missing `lib/__tests__/models.test.ts`.

**Resolution:** Architecture Migration Map now includes:
`| lib/__tests__/models.test.ts | Unit tests for static MODELS array and getModelById() | Remove entirely | Delete file. Tests for static model list are obsolete when models come from API. |`

---

## Recommendations

None. All blocking issues resolved.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0 (2 resolved across iterations)
**Warnings:** 0

**Iteration History:**
1. Attempt 1: FAILED (3 blocking: missing files in Migration Map, shadcn version, next.config.ts)
2. Attempt 2: FAILED (2 blocking: timeout not specified, models.test.ts missing)
3. Attempt 3: Architecture verified — all fixes present. APPROVED.
