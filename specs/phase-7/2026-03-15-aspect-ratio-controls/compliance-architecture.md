# Gate 1: Architecture Compliance Report

**Gepruefte Architecture:** `specs/phase-7/2026-03-15-aspect-ratio-controls/architecture.md`
**Pruefdatum:** 2026-03-16
**Discovery:** `specs/phase-7/2026-03-15-aspect-ratio-controls/discovery.md`
**Wireframes:** `specs/phase-7/2026-03-15-aspect-ratio-controls/wireframes.md`

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 26 |
| Warning | 0 |
| Blocking | 0 |

**Verdict:** APPROVED

---

## A) Feature Mapping

| Discovery Feature | Architecture Section | API Endpoint | DB Schema | Status |
|---|---|---|---|---|
| Schema-basierte Controls in Prompt Panel (txt2img + img2img) | Scope, Architecture Layers, Migration Map (prompt-area.tsx) | Existing `getModelSchema` server action reused | No DB changes needed (ephemeral UI state) | PASS |
| Schema-basierte Controls in Canvas Variation Popover | Scope, Migration Map (variation-popover.tsx) | Same `getModelSchema` | No DB changes needed | PASS |
| Schema-basierte Controls in Canvas Img2img Popover | Scope, Migration Map (img2img-popover.tsx) | Same `getModelSchema` | No DB changes needed | PASS |
| Primary/Advanced Split | Architecture Layers (ParameterPanel Component), Migration Map (parameter-panel.tsx) | N/A (client-side only) | N/A | PASS |
| Primary-Whitelist: aspect_ratio, megapixels, resolution | Constraints section, Migration Map (parameter-panel.tsx) | N/A | N/A | PASS |
| All other Schema-Properties as Advanced Controls | Constraints section (INTERNAL_FIELDS exclusion) | N/A | N/A | PASS |
| Multi-Model-Support (Flux, Nano Banana 2, GPT Image 1.5, Hunyuan Image 3) | Constraints section, Assumptions | N/A | N/A | PASS |
| Schema-basierte Optionen (dynamisch per Model von Replicate API) | Server Logic (ModelSchemaService), Constraints | Replicate API GET /v1/models/{owner}/{name} | N/A | PASS |
| Merge von User-gewaehlten Params mit DB-modelParams | Business Logic Flow, Data Flow diagram | Existing `generateImages` server action, `buildReplicateInput` spread | Existing `modelParams` JSONB column | PASS |
| useModelSchema Hook (new) | Architecture Layers, Migration Map (New Files) | Calls `getModelSchema` server action | N/A | PASS |
| resolveModel shared Utility (new) | Architecture Layers, Migration Map (New Files) | N/A (pure function extraction) | N/A | PASS |
| Mode Persistence for imageParams | Not explicitly in Architecture but covered by Migration Map changes to Txt2ImgState/Img2ImgState | N/A | N/A | PASS |
| Canvas Popover imageParams Flow | Migration Map (variation-popover.tsx, img2img-popover.tsx, canvas-detail-view.tsx) | N/A | N/A | PASS |
| Aspect Ratio Dropdown Grouping (>8 options) | Constraints section (visual grouping for aspect_ratio) | N/A | N/A | PASS |

---

## B) Constraint Mapping

| Constraint | Source | Wireframe Ref | Architecture | Status |
|---|---|---|---|---|
| Primary Controls between TierToggle and Variants/Generate | Discovery UI Layout, Wireframes Prompt Panel annotation | Wireframe line 962 reference matches `prompt-area.tsx:962` | Migration Map: "render ParameterPanel between TierToggle and Variants" | PASS |
| Loading state: 3 Skeleton rows (label + select placeholder) | Discovery State Machine (schema_loading) | Wireframe State Variations: "Skeleton placeholders (3 rows)" | Existing ParameterPanel already renders 3 skeleton rows (verified in `parameter-panel.tsx:77-85`) | PASS |
| Empty state: No controls shown, generation still possible | Discovery State Machine (schema_empty, schema_error) | Wireframe State Variations: "controls area absent" | Error Handling Strategy: "Controls area hidden, generation still possible" | PASS |
| Tier change resets invalid values | Discovery Business Rules | Wireframe State Variations: "Invalid values reset to model defaults" | Validation Rules: "Hook resets imageParams to {}" + Constraints: "useModelSchema watches modelId" | PASS |
| Upscale Mode: no controls | Discovery Scope (Out of Scope) | N/A (not in wireframes) | Architecture Scope: "Upscale Mode" in Out of Scope | PASS |
| Advanced toggle: collapsed by default | Discovery UI Components table | Wireframe: "advanced_collapsed (default)" | Migration Map: "collapsible Advanced section" | PASS |
| No Advanced toggle if no advanced fields | Discovery UI Components table (empty state) | Wireframe: "no_advanced_fields: Advanced toggle hidden" | Migration Map: "split rendering into Primary + Advanced" (ParameterPanel returns null for empty) | PASS |
| INTERNAL_FIELDS exclusion list (prompt, image fields, seed, etc.) | Discovery Business Rules | N/A | Constraints: "Expanded EXCLUDED_KEYS set" with full field list | PASS |
| Select dropdown only (enum-based, no free text) | Discovery Scope (Out of Scope: "Custom Width/Height") | Wireframe: all controls shown as Select dropdowns | Input Validation: "enum-only values" | PASS |

---

## C) Realistic Data Check

### Codebase Evidence

```
# Gefundene Patterns in existierenden Migrations:

drizzle/0000_fine_killraven.sql:
  - model_id: varchar(255)
  - model_params: jsonb DEFAULT '{}'::jsonb
  - status: varchar(20)
  - image_url: text
  - replicate_prediction_id: varchar(255)
  - error_message: text
  - prompt: text
  - negative_prompt: text
  - name: varchar(255)
  - text: varchar(500)
  - category: varchar(100)

drizzle/0007_add_model_settings.sql:
  - mode: varchar(20)
  - tier: varchar(20)
  - model_id: varchar(255)
  - model_params: jsonb DEFAULT '{}'::jsonb

Pattern: URLs always TEXT, IDs varchar(255), short enums varchar(20), JSONB for dynamic data.
```

### External API Analysis

| API | Field | Measured Length | Sample | Arch Type | Recommendation |
|---|---|---|---|---|---|
| Replicate API | schema properties | N/A (JSONB) | `{ type, enum, default, title, description }` | In-memory cache (Map) | PASS -- no DB storage needed |
| Replicate API | model ID | 20-40 chars | `black-forest-labs/flux-schnell` (30 chars) | `modelId: string` (param) | PASS -- matches existing varchar(255) for model_id |
| Replicate API | aspect_ratio enum values | 3-4 chars | `1:1`, `16:9`, `21:9` | Ephemeral (not stored) | PASS -- enum values used in-memory only |
| Replicate API | megapixels enum values | 1-4 chars | `"0.25"`, `"1"` | Ephemeral (not stored) | PASS -- enum values used in-memory only |
| Replicate API | resolution enum values | 2-5 chars | `"512px"`, `"1K"`, `"2K"`, `"4K"` | Ephemeral (not stored) | PASS -- enum values used in-memory only |

### Data Type Verdicts

| Field | Arch Type | Evidence | Verdict | Issue |
|---|---|---|---|---|
| imageParams (user selections) | `Record<string, unknown>` (ephemeral React state) | No DB storage -- flows through existing `params` argument to `generateImages`, stored in existing `model_params` JSONB column | PASS | No new DB columns |
| modelId (param to getModelSchema) | `string` | Existing `model_id varchar(255)` in DB, regex validated by ModelSchemaService `/^[a-z0-9-]+\/[a-z0-9._-]+$/` | PASS | Already validated |
| schema properties (from Replicate) | In-memory `Map<string, SchemaProperties>` | No DB storage, cached in `schemaCache` Map variable | PASS | Appropriate for ephemeral cache |
| aspect_ratio values | String enum from Replicate schema | Max observed: "21:9" (4 chars). Stored in existing `model_params` JSONB | PASS | JSONB handles any string length |
| megapixels values | String enum from Replicate schema | Max observed: "0.25" (4 chars). Stored in existing JSONB | PASS | JSONB handles any string length |
| resolution values | String enum from Replicate schema | Max observed: "512px" (5 chars). Stored in existing JSONB | PASS | JSONB handles any string length |
| advanced param values (quality, background, etc.) | Dynamic from schema, stored in existing JSONB | All enum-based, stored in existing `model_params` JSONB column | PASS | JSONB is schemaless, handles any values |

**Key Finding:** This feature introduces NO new database columns or tables. All user-selected parameter values flow through the existing `model_params` JSONB column via the existing `buildReplicateInput` spread pattern (`{ ...params, prompt }`). The JSONB type is inherently safe for any string/number values -- no VARCHAR truncation risk.

---

## D) External Dependencies

### D1) Dependency Version Check

**Project Type:** Existing (package.json present with pinned versions)

| Dependency | Arch Version | Pinning File | Pinned? | "Latest"? | Status |
|---|---|---|---|---|---|
| Next.js | 16.1.6 | package.json: `"next": "16.1.6"` | PASS (exact) | No | PASS |
| React | 19.2.3 | package.json: `"react": "19.2.3"` | PASS (exact) | No | PASS |
| radix-ui | 1.4.3 | package.json: `"radix-ui": "^1.4.3"` | PASS (caret) | No | PASS |
| replicate | 1.4.0 | package.json: `"replicate": "^1.4.0"` | PASS (caret) | No | PASS |
| vitest | 4.0.18 | package.json: `"vitest": "^4.0.18"` | PASS (caret) | No | PASS |

All versions match between architecture document and package.json. No unpinned or "latest" references found.

### D2) External APIs & Services

| Dependency | Rate Limits | Auth | Errors | Timeout | Status |
|---|---|---|---|---|---|
| Replicate API (schema fetch) | In-memory cache after first fetch -- effectively unlimited | Bearer token via `REPLICATE_API_TOKEN` env var | Try-catch in server action, returns `{ error }` | 5000ms (`FETCH_TIMEOUT_MS` in ModelSchemaService) | PASS |

**Evidence:**
- Rate limiting: Architecture correctly identifies in-memory caching strategy. Verified in `model-schema-service.ts:3` (`schemaCache = new Map`)
- Auth: Verified in `model-schema-service.ts:98` (`Authorization: Bearer ${apiToken}`)
- Errors: Verified in `models.ts:53` (try-catch returns `{ error }`)
- Timeout: Verified in `model-schema-service.ts:6` (`FETCH_TIMEOUT_MS = 5000`) and line 101 (AbortController)

---

## E) Migration Completeness

> N/A -- kein Migration-Scope. Dieses Feature ist ein neues Feature (Schema-basierte Controls hinzufuegen), kein Refactoring/Migration bestehender Patterns.

Die Architecture enthaelt dennoch eine "Migration Map" Section die Existing Files Changed und New Files dokumentiert -- dies ist best practice fuer die Slice-Planung, aber kein Migration-Scope im Sinne eines Pattern-Wechsels.

### Migration Map Quality Check (informativ, nicht blocking)

| File in Migration Map | Current Pattern | Target Pattern | Specific enough for test? | Status |
|---|---|---|---|---|
| `components/workspace/parameter-panel.tsx` | Flat list, only excludes prompt/negative_prompt | Primary/Advanced split + INTERNAL_FIELDS + collapsible | Yes -- test: primaryFields prop filtering, INTERNAL_FIELDS exclusion, Advanced toggle | PASS |
| `components/workspace/prompt-area.tsx` | resolveModel inline, no schema controls | Extracted resolveModel, useModelSchema, ParameterPanel, imageParams in state | Yes -- test: hook integration, imageParams merge | PASS |
| `components/canvas/popovers/variation-popover.tsx` | No imageParams in VariationParams | imageParams added, ParameterPanel rendered | Yes -- test: VariationParams.imageParams, panel rendering | PASS |
| `components/canvas/popovers/img2img-popover.tsx` | No imageParams in Img2imgParams | imageParams added, ParameterPanel rendered | Yes -- test: Img2imgParams.imageParams, panel rendering | PASS |
| `components/canvas/canvas-detail-view.tsx` | handlers pass static params | handlers spread ...imageParams | Yes -- test: imageParams spread in generateImages call | PASS |
| `lib/hooks/use-model-schema.ts` (NEW) | N/A | Custom hook: modelId -> schema/loading/error | Yes -- test: hook returns schema, handles errors | PASS |
| `lib/utils/resolve-model.ts` (NEW) | N/A | Pure function: settings+mode+tier -> modelId+modelParams | Yes -- test: function returns correct resolution | PASS |

---

## Blocking Issues

None.

---

## Recommendations

1. **[Info]** The architecture correctly identifies that `handleVariationGenerate` passes `{ prompt_strength: promptStrength }` (confirmed at `canvas-detail-view.tsx:279`) and `handleImg2imgGenerate` passes `params: {}` (confirmed at line 394). The imageParams spread must be additive to these existing values, not replacing them. The architecture's "spread `...imageParams`" instruction is correct but the slice implementer should ensure `prompt_strength` is not overwritten by imageParams in the variation handler.

2. **[Info]** The `EXCLUDED_KEYS` set in the existing `parameter-panel.tsx` (line 43) currently only contains `["prompt", "negative_prompt"]`. The architecture correctly identifies this needs expansion to the full INTERNAL_FIELDS list. The slice writer should ensure the expanded set matches the Discovery's INTERNAL_FIELDS list exactly (12+ field names + 3 type filters).

3. **[Info]** The architecture's line references are accurate and verified:
   - `getModelSchema` at `app/actions/models.ts:36` -- CONFIRMED
   - `resolveModel()` at `prompt-area.tsx:128` -- CONFIRMED
   - Action Bar `space-y-3` at `prompt-area.tsx:962` -- CONFIRMED (line 963 is the div)
   - `buildReplicateInput` spread at `generation-service.ts:273` -- CONFIRMED

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Warnings:** 0

**Rationale:**
- All 14 Discovery features are fully mapped to Architecture sections with clear implementation paths
- All 9 UI/Wireframe constraints are addressed in the Architecture
- No new database columns or tables -- all data flows through existing JSONB `model_params` column, eliminating VARCHAR truncation risk
- External dependency (Replicate API) is fully documented with auth, caching, timeout, and error handling -- all verified against codebase
- All 5 dependency versions match package.json exactly
- Migration Map covers all 5 existing files + 2 new files with specific, testable target patterns
- All codebase references (file paths, line numbers, function signatures) verified against actual code

**Next Steps:**
- [x] Architecture approved -- proceed to Slice Planning
