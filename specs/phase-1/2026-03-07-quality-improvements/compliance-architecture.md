# Gate 1: Architecture Compliance Report

**Architecture:** `specs/phase-1/2026-03-07-quality-improvements/architecture.md`
**Date:** 2026-03-07
**Discovery:** `specs/phase-1/2026-03-07-quality-improvements/discovery.md`
**Wireframes:** `specs/phase-1/2026-03-07-quality-improvements/wireframes.md`

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 32 |
| WARNING | 0 |
| BLOCKING | 0 |

**Verdict:** APPROVED

---

## Previous Blocking Issues -- Re-Check

| # | Previous Issue | Fix Applied | Verified |
|---|---------------|-------------|----------|
| 1 | Replicate API Rate Limits Not Documented | "External API Constraints" section added (line 424-433). Documents sequential processing, 120s timeout, priority scheme, error handling for both image generation and thumbnails | PASS -- Rate limits, timeouts, priority, and error handling all documented |
| 2 | OpenRouter API Rate Limits and Timeout Not Documented | Timeout values added (30s improve, 15s thumbnail). AbortController migration item #15 added in Migration Map. External API Constraints table row for OpenRouter (lines 430-431) | PASS -- Timeout, rate limit (200 req/min), and AbortController migration all specified |
| 3 | Architecture Claims "Streams Response" But Does Not | Changed to "returns complete JSON response (non-streaming)" in NFR table (line 446) | PASS -- Accurately reflects OpenRouter REST API behavior |
| 4 | Contradictory History Scope Text | Replaced with "cross-project" wording (lines 83, 144) | PASS -- Consistent: "query `generations` without `project_id` filter" and "Paginated history (cross-project)" |

All four previous blocking issues have been correctly resolved.

---

## A) Feature Mapping

| Discovery Feature | Architecture Section | API Endpoint | DB Schema | Status |
|-------------------|---------------------|--------------|-----------|--------|
| shadcn Sidebar (collapsible, icon-mode, mobile) | Scope, Migration Map #5/#12, Constraints (shadcn/ui 3.8.5) | N/A (client-side) | N/A | PASS |
| Structured Prompt Field (3 sections) | DB Schema (prompt_motiv, prompt_style), Migration Map #6, Prompt Composition Logic | generateImages (modified) | generations.prompt_motiv, prompt_style | PASS |
| Builder Pro (5 categories, articulated fragments) | Builder Fragments Architecture, Migration Map #7/#8 | N/A (client-side) | N/A | PASS |
| Adaptive Improve (prompt analysis + model awareness) | Adaptive Improve System Prompt, Data Flow, Migration Map #4 | improvePrompt (modified with modelId) | N/A | PASS |
| Prompt History (auto, cross-project) | Prompt History Approach, Data Flow, New Services | getPromptHistory, getFavoritePrompts | generations.is_favorite + index | PASS |
| Prompt Favorites (manual star toggle) | Prompt History Approach, New Actions | toggleFavorite | generations.is_favorite | PASS |
| Prompt Versioning (full prompt per generation) | DB Schema extensions, Prompt Composition Logic | generateImages (stores structured fields) | prompt_motiv, prompt_style in generations | PASS |
| Prompt Templates (hardcoded presets) | Prompt Templates Architecture, New Files | N/A (client-side config) | N/A (hardcoded) | PASS |
| Project Thumbnails (auto + manual refresh) | Thumbnail Generation Logic, New Services, DB Schema | generateThumbnail | projects.thumbnail_url, thumbnail_status | PASS |
| Lightbox Fullscreen Toggle | NFRs (CSS-only toggle), Migration Map #10 | N/A (client-side) | N/A | PASS |
| Model-specific Prompt Optimization (Improve only) | Adaptive Improve System Prompt (model-specific section) | improvePrompt (modelId param) | N/A | PASS |

**Result:** All 11 Discovery features are mapped to Architecture sections with appropriate API, DB, and implementation details.

---

## B) Constraint Mapping

| Constraint | Source | Wireframe Ref | Architecture | Status |
|------------|--------|---------------|--------------|--------|
| Motiv is required for generation | Discovery: Business Rules | Wireframe: "Motiv *" label | Input validation in server action, generation-service validates non-empty | PASS |
| Prompt composition: "{Motiv}. {Style}" | Discovery: Business Rules | N/A | Prompt Composition Logic section with example | PASS |
| History pagination: initial 50, load-more 50 | Discovery: Business Rules | Wireframe: "Load more..." annotation | getPromptHistory with offset/limit, NFR: "50 per batch" | PASS |
| Builder output replaces (not appends) Style field | Discovery: Business Rules, State Transitions | Wireframe: Builder "Done" annotation | Builder Fragments: "replaces, not appends" (line 502) | PASS |
| Sidebar collapse state persists across sessions | Discovery: Business Rules | N/A | NFR: "cookie-based persistence (built-in)" | PASS |
| Lightbox normal: max 70vh | Discovery: UI Components | Wireframe: "max 70vh" annotation | NFR: "max-h-[70vh]" | PASS |
| Lightbox fullscreen: 100% viewport, object-contain | Discovery: UI Components | Wireframe: "100% viewport, object-contain" | NFR: "object-contain + w-full h-full" | PASS |
| Thumbnail: 256x256 or smallest supported | Discovery: Business Rules | N/A | Architecture: 1024x1024 generated, resized to 512x512 via Sharp. Acceptable deviation -- 512x512 is a reasonable thumbnail size, documented in Risks #1 | PASS |
| Thumbnail status: pending, completed, failed | Discovery: Data | Wireframe: State Variations | DB: thumbnail_status VARCHAR(20) DEFAULT 'none' (adds 'none' state -- superset of Discovery states) | PASS |
| Negative prompt conditionally shown by model | Discovery: UI Components | Wireframe: annotation 6 | Migration Map #6: structured textareas. Model-conditional visibility is client-side logic | PASS |
| Confirmation Dialog for template/history loading | Discovery: State Transitions | Wireframe: Confirmation Dialog | Architecture: Constraints table lists radix-ui AlertDialog 1.4.3 | PASS |
| Mobile: hamburger menu, sidebar as overlay drawer | Discovery: UI Layout | Wireframe: Mobile Sidebar | shadcn Sidebar: "mobile drawer (responsive)" in Sidebar Installation section | PASS |
| Improve modal: side-by-side, "Optimized for" badge | Discovery: User Flow 3 | Wireframe: Improve Comparison | Data Flow: Adaptive Improve shows "Optimized for: {modelName}", Migration Map #9 | PASS |
| Templates: fill all 3 fields (motiv placeholder, style, negative) | Discovery: User Flow 6 | Wireframe: Template Selection | Prompt Templates Architecture with PromptTemplate type (motiv, style, negativePrompt) | PASS |
| History entry shows: prompt preview, model, date, star | Discovery: UI Components | Wireframe: History Tab annotations | PromptHistoryEntry type includes all fields (promptMotiv, modelId, createdAt, isFavorite) | PASS |
| Improve: Motiv field must not be empty | Discovery: State Transitions | N/A | Input validation in server action | PASS |
| Templates are hardcoded (no user-created in V1) | Discovery: Business Rules | N/A | "Templates are hardcoded in a TypeScript config file -- no DB table needed" | PASS |
| Thumbnail error: silent (gray placeholder stays) | Discovery: Error Paths | Wireframe: State Variations | Thumbnail Logic step 7 + NFR: "No user-facing error" | PASS |

**Result:** All 18 constraints from Discovery and Wireframes are addressed in Architecture.

---

## C) Realistic Data Check

### Codebase Evidence

```
# Existing schema patterns in lib/db/schema.ts:
- projects.name:               varchar(255)
- generations.prompt:           text (unbounded)
- generations.negative_prompt:  text (unbounded)
- generations.model_id:         varchar(255)
- generations.status:           varchar(20)
- generations.image_url:        text (unbounded)
- generations.replicate_prediction_id: varchar(255)
- generations.error_message:    text (unbounded)
- prompt_snippets.text:         varchar(500)
- prompt_snippets.category:     varchar(100)
```

### External API Analysis

| API | Field | Measured/Known Length | Sample | Arch Type | Recommendation |
|-----|-------|---------------------|--------|-----------|----------------|
| Replicate | prediction_id | ~36 chars (UUID format) | "abc123..." | VARCHAR(255) | PASS -- existing, oversized but safe |
| Replicate | image output URL | Variable, can be very long (presigned) | Replicate presigned URLs | Fetched and re-uploaded to R2 | PASS -- not stored directly |
| R2 | image_url | ~60-80 chars (R2 public URL) | `https://pub-xxx.r2.dev/projects/{uuid}/{uuid}.png` | TEXT | PASS -- TEXT is safe for URLs |
| R2 | thumbnail_url | ~60 chars | `https://pub-xxx.r2.dev/thumbnails/{uuid}.png` | TEXT | PASS -- TEXT is appropriate |
| OpenRouter | LLM response | Variable, 50-2000 chars typical | Improved prompt text | Not stored (returned to UI) | PASS -- transient, not persisted |
| OpenRouter | model ID | ~40 chars | "google/gemini-3.1-pro-preview" (31 chars) | Config constant (not DB) | PASS -- hardcoded in code |

### Data Type Verdicts

| Field | Arch Type | Evidence | Verdict | Issue |
|-------|-----------|----------|---------|-------|
| generations.prompt_motiv | TEXT | Existing `prompt` field uses TEXT. User input can be arbitrarily long. Discovery says "max 2000 chars" but TEXT is safer for migrations | PASS | Architecture uses TEXT (superset of Discovery's VARCHAR(2000)). Validation can enforce max length at app layer |
| generations.prompt_style | TEXT | Same rationale as prompt_motiv. Builder fragments can concatenate to 500+ chars | PASS | TEXT is correct |
| generations.is_favorite | BOOLEAN | Simple flag, standard type | PASS | Correct |
| projects.thumbnail_url | TEXT | R2 URLs are ~60 chars but TEXT is consistent with existing image_url pattern | PASS | Matches existing codebase pattern |
| projects.thumbnail_status | VARCHAR(20) | Values: none/pending/completed/failed. Longest: "completed" = 9 chars. VARCHAR(20) has buffer | PASS | Consistent with existing generations.status pattern |

**Data Type Summary:** All proposed types are consistent with existing codebase patterns. TEXT for string content, VARCHAR(20) for status enums, BOOLEAN for flags. No undersized fields detected.

---

## D) External Dependencies

### D1) Dependency Version Check

| Dependency | Arch Version | Pinning File | Pinned? | "Latest"? | Actual (package.json) | Current? | Status |
|------------|-------------|--------------|---------|-----------|----------------------|----------|--------|
| Next.js | 16.1.6 | package.json | Yes (16.1.6) | No | 16.1.6 | Yes | PASS |
| React | 19.2.3 | package.json | Yes (19.2.3) | No | 19.2.3 | Yes | PASS |
| shadcn/ui (CLI) | 3.8.5 | package.json (devDep) | Yes (^3.8.5) | No | ^3.8.5 | Yes | PASS |
| Tailwind CSS | 4 | package.json | Yes (^4) | No | ^4 | Yes | PASS |
| Drizzle ORM | 0.45.1 | package.json | Yes (^0.45.1) | No | ^0.45.1 | Yes | PASS |
| Drizzle Kit | 0.31.9 | package.json (devDep) | Yes (^0.31.9) | No | ^0.31.9 | Yes | PASS |
| Replicate | 1.4.0 | package.json | Yes (^1.4.0) | No | ^1.4.0 | Yes | PASS |
| Sharp | 0.34.5 | package.json | Yes (^0.34.5) | No | ^0.34.5 | Yes | PASS |
| OpenRouter | Custom client | N/A (REST API) | N/A | N/A | N/A | N/A | PASS |
| @aws-sdk/client-s3 | 3.1003.0 | package.json | Yes (^3.1003.0) | No | ^3.1003.0 | Yes | PASS |
| Lucide React | 0.577.0 | package.json | Yes (^0.577.0) | No | ^0.577.0 | Yes | PASS |
| Sonner | 2.0.7 | package.json | Yes (^2.0.7) | No | ^2.0.7 | Yes | PASS |
| radix-ui | 1.4.3 | package.json | Yes (^1.4.3) | No | ^1.4.3 | Yes | PASS |

**Result:** All 13 dependencies are pinned in package.json with versions matching architecture documentation. No "latest" or missing versions.

### D2) External APIs & Services

| Dependency | Rate Limits | Auth | Errors | Timeout | Status |
|------------|-------------|------|--------|---------|--------|
| Replicate (Image Gen) | Sequential processing, 1 concurrent prediction | REPLICATE_API_TOKEN env var | status "failed", errorMessage stored | 120s (replicate.wait() default) | PASS |
| Replicate (Thumbnail) | Same sequential queue, enqueued after user generations | Same token | thumbnail_status "failed", gray placeholder | 120s | PASS |
| OpenRouter (Improve) | 200 req/min (free tier), single-user no concern | OPENROUTER_API_KEY env var | Toast error on timeout/failure | 30s AbortController | PASS |
| OpenRouter (Thumbnail Prompt) | Same client, same limits | Same key | thumbnail_status "failed" on timeout | 15s AbortController | PASS |
| Cloudflare R2 | N/A (storage) | @aws-sdk/client-s3 credentials | Existing error handling | N/A | PASS |

**Result:** All external APIs have documented rate limits, auth methods, error handling, and timeouts.

---

## E) Migration Completeness

N/A -- no migration-scope trigger words found in Discovery. The Migration Map in the architecture describes modifications to existing files and new files as part of feature implementation. All 15 migration map entries specify concrete file paths with clear current state and target state descriptions. This serves as an implementation guide and is complete.

---

## F) Architecture Completeness Check

| Check | Status |
|-------|--------|
| All External APIs identified? | PASS -- Replicate, OpenRouter, Cloudflare R2 all documented |
| Rate Limits documented? | PASS -- External API Constraints table covers all APIs |
| Error Responses planned? | PASS -- Error handling column in External API Constraints + error paths in Discovery |
| Auth flows complete? | PASS -- Environment variables for all API keys documented in Security section |
| Timeouts defined? | PASS -- 120s Replicate, 30s/15s OpenRouter with AbortController |
| DB Schema complete? | PASS -- All Discovery data requirements mapped to schema extensions |
| API Design complete? | PASS -- All server actions defined with input/output types |
| Service layer complete? | PASS -- Modified + new services cover all features |
| Security addressed? | PASS -- Dedicated Security section with 7 areas |
| NFRs documented? | PASS -- 8 quality attributes with technical approaches |
| Risks documented? | PASS -- 10 risks/assumptions with mitigations |

---

## Blocking Issues

None.

---

## Recommendations

1. **[Info]** Discovery mentions "max 2000 chars" for promptMotiv and "max 1000 chars" for promptStyle. Architecture uses TEXT (unbounded). Consider adding app-layer validation (e.g., zod schema in server actions) to enforce these limits, even though TEXT is the correct DB type for flexibility.

2. **[Info]** The DISTINCT ON query pattern for prompt history may need a composite index on `(prompt_motiv, prompt_style, negative_prompt, model_id, created_at)` for optimal performance. The current architecture only specifies an index on `(is_favorite)`. The `(created_at)` index already exists. For single-user app this is acceptable, but worth noting for future scaling.

3. **[Info]** Architecture lists 9 models in `lib/models.ts` (verified from codebase) while Discovery mentions "6 Modelle". This is a Discovery documentation gap, not an architecture issue -- the architecture correctly reflects the current codebase.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Warnings:** 0

**All four previous blocking issues have been correctly resolved:**
1. Replicate API Rate Limits -- documented in External API Constraints
2. OpenRouter Timeout -- 30s/15s with AbortController, migration item #15 added
3. Streaming claim -- corrected to "non-streaming"
4. History scope contradiction -- consistent "cross-project" wording throughout

**Next Steps:**
- [ ] Architecture is ready for slice writing
- [ ] No fixes required
