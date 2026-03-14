# Gate 1: Architecture Compliance Report

**Gepruefte Architecture:** `specs/phase-5/2026-03-14-model-handling-redesign/architecture.md`
**Pruefdatum:** 2026-03-14
**Discovery:** `specs/phase-5/2026-03-14-model-handling-redesign/discovery.md`
**Wireframes:** `specs/phase-5/2026-03-14-model-handling-redesign/wireframes.md`

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 27 |
| WARNING | 0 |
| BLOCKING | 0 |

**Verdict:** APPROVED

---

## Previous Review

This is a re-review. The previous compliance check (same date) found 2 blocking issues:
1. Timestamp columns missing `with time zone` -- **FIXED** (architecture now specifies `timestamp with time zone`)
2. Hardcoded migration filename `0007_add_model_settings.sql` -- **FIXED** (Research Log now says "generated via `drizzle-kit generate` (auto-naming)")

Both issues have been resolved in the current architecture.

---

## A) Feature Mapping

| Discovery Feature | Architecture Section | API Endpoint | DB Schema | Status |
|---|---|---|---|---|
| Draft/Quality Toggle in Workspace Prompt-Area | Migration Map: `prompt-area.tsx` | `generateImages` (existing, unchanged interface) | `model_settings` for model lookup | PASS |
| Draft/Quality Toggle pro Canvas-Tool (Popovers + Chat) | Migration Map: `variation-popover.tsx`, `img2img-popover.tsx`, `upscale-popover.tsx`, `canvas-chat-panel.tsx` | `generateImages` / `upscaleImage` (changed) | `model_settings` for model lookup | PASS |
| Max Quality Toggle Button | Migration Map: `prompt-area.tsx`, popover files, `canvas-chat-panel.tsx` | Same generation actions (tier=max resolves to max model) | `model_settings` has `max` tier rows | PASS |
| Settings-Dialog (Modal) mit Model-Zuweisung | API: `getModelSettings`, `updateModelSetting` | `app/actions/model-settings.ts` (new) | `model_settings` table | PASS |
| Schema-Check bei Model-Zuweisung | Server Logic: `ModelSettingsService.checkCompatibility()` | Called within `updateModelSetting` | N/A | PASS |
| Default-Models bei Erstinstallation | DB Schema: Seed Data section (8 rows) | `getModelSettings` seeds if empty | 8 seed rows defined | PASS |
| Neue DB-Tabelle `model_settings` | DB Schema: Schema Details section | CRUD via `ModelSettingsService` | Full schema defined (id, mode, tier, model_id, model_params, timestamps) | PASS |
| Entfernung: ModelBrowserDrawer | Migration Map: `prompt-area.tsx`, `canvas-detail-view.tsx` | Deprecated actions listed | N/A | PASS |
| Entfernung: ParameterPanel | Migration Map: `prompt-area.tsx` | N/A | N/A | PASS |
| Entfernung: Multi-Model-Selektion | Migration Map: `prompt-area.tsx` | `generateImages` still accepts array but always single | N/A | PASS |
| Preset-Parameter pro Model | DB Schema: `model_params` jsonb column | Not user-editable | Stored in `model_settings.model_params` | PASS |
| Settings-Button im Workspace Header | Migration Map: `workspace-header.tsx` | N/A | N/A | PASS |
| Canvas Header: CanvasModelSelector entfernt | Migration Map: `canvas-detail-view.tsx`, `canvas-model-selector.tsx` | N/A | N/A | PASS |
| Canvas Context: `selectedModelId` entfernt | Migration Map: `lib/canvas-detail-context.tsx` | N/A | N/A | PASS |
| Deprecated Server Actions (getFavoriteModels, etc.) | API: Server Actions (deprecated) section | Listed as deprecated | N/A | PASS |
| Upscale: kein Max-Tier | Validation Rules: `(upscale, max)` rejected | `updateModelSetting` rejects combo | Seed data: only 2 upscale rows (draft, quality) | PASS |
| Auto-Save bei Auswahl | Server Action: `updateModelSetting` upserts | Direct DB upsert | N/A | PASS |
| Per-Tool Tier State (unabhaengig) | Trade-offs section | React `useState` per component | N/A | PASS |

---

## B) Constraint Mapping

| Constraint | Source | Wireframe Ref | Architecture | Status |
|---|---|---|---|---|
| Tier-Toggle: 2 Segmente (Draft/Quality) | Discovery: UI Components table | Wireframes: all screens show 2-segment control | UI Components layer, TierToggle as custom segmented control (like ModeSelector) | PASS |
| Max Quality Toggle: nur bei Quality sichtbar, nicht bei Upscale | Discovery: `max-quality-toggle` states | Wireframes: Upscale Popover has no Max toggle, Quality shows it | Validation: `(upscale, max)` rejected. Migration Map: upscale-popover only gets tier, no maxQuality | PASS |
| Per-Tool Tier State (unabhaengig) | Discovery: Business Rules, Q&A #22 | Wireframes: "each popover has own tier state" | Technology Decisions: `useState` per component. Migration Map: each popover adds own `tier` state | PASS |
| Tier-State nicht persistiert (Session-only) | Discovery: Business Rules, Open Questions #1 | N/A | State Management: React `useState` (local). No DB persistence for tier. | PASS |
| Auto-Save bei Model-Auswahl in Settings | Discovery: UI Components `settings-dialog` states | Wireframes: "auto-save" annotation | API: `updateModelSetting` called on select. No footer/save button. | PASS |
| Inkompatible Models ausgegraut | Discovery: Error Paths | Wireframes: dropdown shows greyed incompatible model | Server Logic: `checkCompatibility` via `ModelSchemaService`. Error handling: incompatible model returns `{ error }` | PASS |
| Collection-Load-Error: Fehlermeldung ersetzt Dropdown | Discovery: Error Paths | Wireframes: `collection-load-error` state | Error Handling: "Collection fetch fail" returns `{ error }`, "Error message replaces dropdown" | PASS |
| Schema-Fetch-Fail: Fallback allow selection | Discovery: not explicit | N/A | Error Handling: "Schema fetch fail" -> "Fallback: allow selection (no filter)" | PASS |
| Tier-Toggle disabled waehrend Generation | Discovery: States table | Wireframes: generating state | Migration Map: per-component state logic handles disabled during generation | PASS |
| Chat: Tier-Toggle bleibt interaktiv waehrend Streaming | Discovery: States table (streaming) | Wireframes: Chat streaming state | Migration Map: `canvas-chat-panel.tsx` adds tier state independent of input disabled | PASS |
| Settings: 3 Sections (txt2img, img2img, upscale) | Discovery: Settings Dialog layout | Wireframes: 3 sections with dropdowns | DB Schema: 3 modes x 2-3 tiers. Server Logic: `getAll()` returns all 8 rows | PASS |
| Model Dropdown: Name + Owner anzeigen | Discovery: UI Components table | Wireframes: Dropdown annotation #7 | `CollectionModel` type has `owner` + `name` fields (verified: `lib/types/collection-model.ts`) | PASS |
| Unique Constraint (mode, tier) | Discovery: Data section | N/A | DB Schema: explicitly states unique constraint on `(mode, tier)` | PASS |
| Timestamp: withTimezone | Codebase pattern (all existing tables) | N/A | Architecture: specifies `timestamp with time zone` for both timestamp columns | PASS |

---

## C) Realistic Data Check

### Codebase Evidence

```
# Existing patterns in lib/db/schema.ts and drizzle/ migrations:

model_id fields:
  - generations.modelId:           varchar("model_id", { length: 255 })
  - favoriteModels.modelId:        varchar("model_id", { length: 255 })
  - projectSelectedModels.modelId: varchar("model_id", { length: 255 })

Enum-like short strings (all varchar(20)):
  - generations.status:           varchar("status", { length: 20 })
  - generations.generationMode:   varchar("generation_mode", { length: 20 })
  - projects.thumbnailStatus:     varchar("thumbnail_status", { length: 20 })
  - referenceImages.sourceType:   varchar("source_type", { length: 20 })
  - generationReferences.role:    varchar("role", { length: 20 })
  - generationReferences.strength: varchar("strength", { length: 20 })

Timestamps:
  - ALL tables use timestamp("...", { withTimezone: true })

UUID:
  - ALL PKs use uuid("id").primaryKey().default(sql`gen_random_uuid()`)

JSONB:
  - generations.modelParams:      jsonb("model_params").notNull().default({})
```

### External API Analysis

| API | Field | Measured Length | Sample | Arch Type | Recommendation |
|---|---|---|---|---|---|
| Replicate | model_id (owner/name) | 30 chars (max measured: `black-forest-labs/flux-schnell`) | `black-forest-labs/flux-schnell` (30), `black-forest-labs/flux-2-pro` (28), `nightmareai/real-esrgan` (23), `philz1337x/crystal-upscaler` (27), `ideogram-ai/ideogram-v3-turbo` (29) | `varchar(255)` | PASS -- 255 is 8.5x measured max, matches existing `generations.model_id` |
| Replicate Collections API | model list | N/A | `CollectionModel[]` cached 1h | Existing service unchanged | PASS |
| Replicate Models API | schema properties | Variable JSON | In-memory cache | Existing service unchanged | PASS |

### Data Type Verdicts

| Field | Arch Type | Evidence | Verdict | Issue |
|---|---|---|---|---|
| `model_settings.id` | `uuid` PK, default `gen_random_uuid()` | Matches all 7 existing tables | PASS | -- |
| `model_settings.mode` | `varchar(20)` | Longest value: "txt2img" (7 chars). Matches `generations.generation_mode` varchar(20) | PASS | -- |
| `model_settings.tier` | `varchar(20)` | Longest value: "quality" (7 chars). Matches existing enum-like patterns | PASS | -- |
| `model_settings.model_id` | `varchar(255)` | Measured max: 30 chars. Matches `generations.model_id`, `favorite_models.model_id`, `project_selected_models.model_id` | PASS | -- |
| `model_settings.model_params` | `jsonb` NOT NULL default `{}` | Matches `generations.model_params` exactly | PASS | -- |
| `model_settings.created_at` | `timestamp with time zone` NOT NULL default `now()` | Matches all existing timestamp columns | PASS | -- |
| `model_settings.updated_at` | `timestamp with time zone` NOT NULL default `now()` | Matches all existing timestamp columns | PASS | -- |

---

## D) External Dependencies

### D1) Dependency Version Check

**Project Type:** Existing (package.json present with pinned versions)

| Dependency | Arch Version | Pinning File | Pinned? | "Latest"? | Actual Installed | Status |
|---|---|---|---|---|---|---|
| `replicate` | 1.4.0 | package.json: `^1.4.0` | PASS (caret) | No | ^1.4.0 | PASS |
| `@aws-sdk/client-s3` | 3.1003.0 | package.json: `^3.1003.0` | PASS (caret) | No | ^3.1003.0 | PASS |
| `sharp` | 0.34.5 | package.json: `^0.34.5` | PASS (caret) | No | ^0.34.5 | PASS |
| `drizzle-orm` | 0.45.1 | package.json: `^0.45.1` | PASS (caret) | No | ^0.45.1 | PASS |
| `next` | 16.1.6 | package.json: `16.1.6` (exact) | PASS | No | 16.1.6 | PASS |
| `radix-ui` | 1.4.3 | package.json: `^1.4.3` | PASS (caret) | No | ^1.4.3 | PASS |
| `shadcn` | 3.8.5 | package.json (dev): `^3.8.5` | PASS (caret) | No | ^3.8.5 | PASS |
| `tailwindcss` | 4.x | package.json: `^4` | PASS (caret) | No | 4.2.1 installed | PASS |

All versions in architecture match `package.json` constraints. No "latest" or unversioned references.

### D2) External APIs & Services

| Dependency | Rate Limits | Auth | Errors | Timeout | Status |
|---|---|---|---|---|---|
| Replicate Run API | 1 concurrent (queue in `replicate.ts`, documented in Constraints) | `REPLICATE_API_TOKEN` env var (documented in Security) | Existing error handling (toast, console.error), documented | Replicate SDK built-in | PASS |
| Replicate Collections API | Cached 1h (documented in CollectionModelService) | Same token | Returns `{ error }` (documented in Error Handling) | 5000ms `FETCH_TIMEOUT_MS` (documented) | PASS |
| Replicate Models API (schema) | In-memory cache | Same token | Throws on failure, fallback documented | 5000ms `FETCH_TIMEOUT_MS` | PASS |
| Cloudflare R2 | Not applicable (storage) | AWS SDK credentials (documented) | Existing error handling | SDK defaults | PASS |

---

## E) Migration Completeness

> Scope contains Migration/Refactoring elements (removal of ModelBrowserDrawer, ParameterPanel, Multi-Model-Logik, CanvasModelSelector, selectedModelId context state).

### Quantitaets-Check

| Discovery Claim | Architecture Coverage | Status |
|---|---|---|
| No explicit file count claim. Scope defines features to add/remove. | Migration Map: 14 file entries with specific changes per file. All files referenced in Discovery scope are covered. `app/actions/models.ts` deprecated actions covered in "Server Actions (deprecated)" section. | PASS |

### Qualitaets-Check

| File in Migration Map | Current Pattern | Target Pattern | Specific enough for test? | Status |
|---|---|---|---|---|
| `lib/db/schema.ts` | Defines favoriteModels, projectSelectedModels, generations | Add `modelSettings` pgTable with columns (id, mode, tier, model_id, model_params, created_at, updated_at) + unique constraint on (mode, tier) | Yes -- test: schema includes `modelSettings` table with specific columns | PASS |
| `lib/db/queries.ts` | Exports getFavoriteModelIds, addFavoriteModel, etc. | Add `getAllModelSettings()`, `getModelSettingByModeTier()`, `upsertModelSetting()`, `seedModelSettingsDefaults()` | Yes -- test: exported functions exist and return expected types | PASS |
| `lib/services/generation-service.ts` | `upscale()` uses hardcoded `UPSCALE_MODEL` from `lib/models.ts` | `upscale()` accepts `modelId` + `modelParams` parameters | Yes -- test: `upscale()` uses passed modelId, not hardcoded | PASS |
| `lib/models.ts` | Exports `UPSCALE_MODEL = "nightmareai/real-esrgan"` | No longer imported by generation-service | Yes -- test: no production import of `UPSCALE_MODEL` from generation-service | PASS |
| `app/actions/generations.ts` | `upscaleImage()` has no modelId in input | Add `modelId: string` + `modelParams: Record<string, unknown>` to `UpscaleImageInput` | Yes -- test: `upscaleImage()` accepts and validates modelId | PASS |
| `components/workspace/prompt-area.tsx` | Uses `selectedModels[]`, `ModelTrigger`, `ModelBrowserDrawer`, `ParameterPanel` | Uses `tierState`, resolves model from settings. No ModelTrigger/ModelBrowserDrawer/ParameterPanel. | Yes -- test: no ModelTrigger/ModelBrowserDrawer/ParameterPanel imports | PASS |
| `components/workspace/workspace-header.tsx` | Right-side actions: ThemeToggle + kebab | Add Settings icon button (gear icon), render `SettingsDialog` | Yes -- test: Settings button renders, opens dialog | PASS |
| `components/canvas/canvas-detail-view.tsx` | Renders `CanvasModelSelector` in header, handlers use `state.selectedModelId` | Remove `CanvasModelSelector` from header. Handlers resolve model from settings + per-tool tier. | Yes -- test: no CanvasModelSelector import, model resolved from settings | PASS |
| `components/canvas/canvas-model-selector.tsx` | Single-model dropdown for canvas header with ModelBrowserDrawer | No longer used. Deleted in Slice 5. | Yes -- test: file not imported anywhere after Slice 4 | PASS |
| `components/canvas/canvas-chat-panel.tsx` | `handleCanvasGenerate()` uses `event.model_id` from AI SSE event | Add TierToggle + MaxQualityToggle above chat input. Override `model_id` with tier-resolved model. | Yes -- test: tier toggle renders, generated model uses settings not event | PASS |
| `components/canvas/popovers/variation-popover.tsx` | No model selection. Calls `onGenerate()` with prompt/strength/count. | Add TierToggle + MaxQualityToggle. Extend `VariationParams` with `tier: Tier`. | Yes -- test: TierToggle renders, onGenerate receives tier | PASS |
| `components/canvas/popovers/img2img-popover.tsx` | No model selection. Calls `onGenerate()` with references/prompt/variants. | Add TierToggle + MaxQualityToggle. Extend `Img2imgParams` with `tier: Tier`. | Yes -- test: TierToggle renders, onGenerate receives tier | PASS |
| `components/canvas/popovers/upscale-popover.tsx` | No model selection. Calls `onUpscale({ scale })`. | Add TierToggle (no MaxQualityToggle). Extend params with `tier: Tier`. | Yes -- test: TierToggle renders (no Max), onUpscale receives tier | PASS |
| `lib/canvas-detail-context.tsx` | State has `selectedModelId: string | null`. Reducer handles `SET_SELECTED_MODEL`. | Remove `selectedModelId` from state. Remove `SET_SELECTED_MODEL` action. | Yes -- test: state type has no selectedModelId, no SET_SELECTED_MODEL case | PASS |

All 14 files have specific, testable target patterns.

---

## Blocking Issues

None.

---

## Recommendations

1. **[Info]** The `tailwindcss` version in architecture says "4.x" while package.json has `^4` and installed is `4.2.1`. The architecture could be more specific (e.g. "4.2.1") but this is not blocking since the package.json pin is clear.

2. **[Info]** The architecture keeps `generateImages` accepting `modelIds[]` (array) even though it will always receive a single item. This is a conscious trade-off documented in the "Trade-offs" section. Consider adding a deprecation comment on the array parameter when implementing Slice 3.

3. **[Info]** The `model_settings.mode` and `model_settings.tier` fields use `varchar(20)` which is consistent with the codebase pattern for all enum-like fields. An alternative would be PostgreSQL `enum` types, but `varchar` matches existing conventions and is more flexible for future changes.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Warnings:** 0

**Next Steps:**
- [ ] Proceed to Slice 1 implementation (Model Settings Schema + Service)
- [ ] Architecture is complete and consistent with Discovery, Wireframes, and Codebase
