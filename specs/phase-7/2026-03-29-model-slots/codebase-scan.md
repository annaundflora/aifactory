# Codebase Scan

**Feature:** Model Slots -- Tier-Toggle durch direkte Model-Auswahl ersetzen
**Scan-Datum:** 2026-03-29
**Discovery:** `specs/phase-7/2026-03-29-model-slots/discovery.md`

---

## Identified Patterns

| # | Pattern | Locations | Count | Type |
|---|---------|-----------|-------|------|
| 1 | Tier-based model resolution (mode+tier -> modelId) | `lib/utils/resolve-model.ts`, `components/workspace/prompt-area.tsx`, `components/canvas/popovers/variation-popover.tsx`, `components/canvas/popovers/img2img-popover.tsx` | 4 | AVOID |
| 2 | TierToggle segmented control | `components/ui/tier-toggle.tsx`, used in `prompt-area.tsx`, `canvas-chat-panel.tsx`, `variation-popover.tsx`, `img2img-popover.tsx`, `upscale-popover.tsx` | 5 consumers | AVOID |
| 3 | MaxQualityToggle | `components/ui/max-quality-toggle.tsx` | 1 (only test import, no production consumer) | AVOID |
| 4 | ModelSettingsService (mode+tier CRUD) | `lib/services/model-settings-service.ts` | 1 service, 2 server action consumers | AVOID |
| 5 | Server Actions pattern (requireAuth + validate + delegate) | `app/actions/model-settings.ts`, `app/actions/generations.ts`, `app/actions/models.ts`, etc. | 12 files | REUSE |
| 6 | DB schema definition (Drizzle pgTable) | `lib/db/schema.ts` | 10 tables | REUSE |
| 7 | DB query functions (standalone exports in queries.ts) | `lib/db/queries.ts` | ~30 functions | REUSE |
| 8 | Drizzle migration SQL files | `drizzle/0000_*.sql` through `drizzle/0011_*.sql` | 12 migrations | REUSE |
| 9 | Service object pattern (const XService = { ... }) | `lib/services/model-settings-service.ts`, `lib/services/model-catalog-service.ts`, `lib/services/generation-service.ts`, etc. | 8 services | REUSE |
| 10 | Window event for cross-component settings reload | `model-settings-changed` event in `prompt-area.tsx:160`, `canvas-detail-view.tsx:98`, `settings-dialog.tsx:290` | 3 listeners, 2 dispatchers | EXTEND |
| 11 | useModelSchema hook (fetch schema by modelId) | `lib/hooks/use-model-schema.ts` | 1 hook, 3 consumers | REUSE |
| 12 | ParameterPanel (schema-driven parameter controls) | `components/workspace/parameter-panel.tsx` | 1 component, 3 consumers | REUSE |
| 13 | Model compatibility check | `lib/services/model-settings-service.ts:checkCompatibility()` | 1 | REUSE |
| 14 | modelIdToDisplayName utility | `lib/utils/model-display-name.ts` | 1 utility, 5 consumers | REUSE |
| 15 | Multi-model generation (modelIds[] array) | `app/actions/generations.ts`, `lib/services/generation-service.ts` | 2 files | REUSE |
| 16 | Select component (Radix-based dropdown) | `components/ui/select.tsx` | 1 component, used in `model-mode-section.tsx`, `parameter-panel.tsx` | REUSE |

---

## Existing Abstractions

| Abstraction | Location | Used by | Recommendation | Rationale |
|-------------|----------|---------|----------------|-----------|
| `Tier` type | `lib/types.ts:11` | 14 files | AVOID | Will be replaced by `SlotNumber = 1 \| 2 \| 3` |
| `VALID_TIERS` constant | `lib/types.ts:27` | 2 files (types.ts, model-settings.ts) | AVOID | Will be replaced by slot validation |
| `UpdateModelSettingInput` DTO | `lib/types.ts:38-42` | 2 files | AVOID | Will be replaced by slot-based DTO |
| `resolveModel()` | `lib/utils/resolve-model.ts` | 3 files (prompt-area, variation-popover, img2img-popover) | AVOID | Will be replaced by slot-based resolution returning active model(s) |
| `ModelSettingsService` | `lib/services/model-settings-service.ts` | 1 server action file | AVOID | Will be refactored to `ModelSlotService` |
| `modelSettings` DB table | `lib/db/schema.ts:209-229` | queries.ts, schema.ts | AVOID | Will be replaced by `modelSlots` table |
| `ModelCatalogService` | `lib/services/model-catalog-service.ts` | 3 files | REUSE | Read-only catalog queries remain unchanged |
| `useModelSchema` hook | `lib/hooks/use-model-schema.ts` | 3 consumers | REUSE | Per-slot schema fetching will use this hook directly |
| `ParameterPanel` | `components/workspace/parameter-panel.tsx` | 3 consumers (prompt-area, variation-popover, img2img-popover) | REUSE | Will be rendered per-slot for per-slot parameters |
| `GenerationService.generate()` | `lib/services/generation-service.ts:321` | 1 server action | REUSE | Already handles `modelIds[]` with 1-3 models; no change needed |
| `generateImages` server action | `app/actions/generations.ts:70` | 4 consumers | REUSE | Already validates `modelIds: string[]` (1-3); no change needed |
| `Select` UI component | `components/ui/select.tsx` | 2+ consumers | REUSE | Will be used for model dropdowns in each slot |
| `modelIdToDisplayName()` | `lib/utils/model-display-name.ts` | 5 consumers | REUSE | Used to display human-readable model names in slot dropdowns |
| `checkCompatibility()` | `lib/services/model-settings-service.ts:70-104` | 1 internal caller | EXTEND | Logic will move to new `ModelSlotService`; same algorithm |

---

## Recommendations

### REUSE (bestehende Abstraktion wiederverwenden)

| # | What | Where | Why |
|---|------|-------|-----|
| 1 | Server Action pattern (requireAuth + validate + delegate to service) | `app/actions/model-settings.ts`, `app/actions/generations.ts` | Consistent auth + validation pattern across all 12 server action files; new slot actions must follow same structure |
| 2 | Drizzle pgTable schema definition | `lib/db/schema.ts` | All 10 tables use identical pattern: uuid PK, timestamps, indexes; new `modelSlots` table must follow |
| 3 | Drizzle SQL migration convention | `drizzle/0007_add_model_settings.sql` (closest reference) | Next migration will be `0012_*.sql`; same CREATE TABLE + seed pattern with `ON CONFLICT DO NOTHING` |
| 4 | Service object pattern (`const XService = { ... }`) | `lib/services/model-settings-service.ts`, `lib/services/model-catalog-service.ts` | 8 services follow this pattern; `ModelSlotService` must follow |
| 5 | DB query function pattern (standalone async exports) | `lib/db/queries.ts` | ~30 query functions all follow same pattern: import table, use db.select/insert/update, return typed results |
| 6 | `useModelSchema` hook | `lib/hooks/use-model-schema.ts` | Already fetches schema by modelId; each slot can call it for its own model |
| 7 | `ParameterPanel` component | `components/workspace/parameter-panel.tsx` | Schema-driven parameter controls; will be rendered per active slot |
| 8 | `Select` UI component | `components/ui/select.tsx` | Radix-based dropdown; used in settings for model selection; reuse for slot model dropdowns |
| 9 | `modelIdToDisplayName()` | `lib/utils/model-display-name.ts` | 5 existing consumers; use in slot dropdowns for human-readable model names |
| 10 | `generateImages` / `GenerationService.generate()` | `app/actions/generations.ts`, `lib/services/generation-service.ts` | Already accepts `modelIds: string[]` (1-3), multi-model branch exists; no changes needed |
| 11 | `ModelCatalogService.getByCapability()` | `lib/services/model-catalog-service.ts:29` | Needed for filtering compatible models per mode in slot dropdowns |
| 12 | `checkCompatibility()` logic | `lib/services/model-settings-service.ts:70-104` | Algorithm for checking model-mode compatibility via capabilities JSONB; reuse in new service |

### EXTEND (bestehende Abstraktion erweitern)

| # | What | Where | Extension needed |
|---|------|-------|------------------|
| 1 | `model-settings-changed` window event | `components/workspace/prompt-area.tsx:160`, `components/canvas/canvas-detail-view.tsx:98`, `components/settings/settings-dialog.tsx:290` | Rename/repurpose to `model-slots-changed`; same pattern (dispatchEvent + addEventListener) but listeners must reload slot data instead of tier settings |
| 2 | `GenerationMode` type | `lib/types.ts:21` | Type itself stays unchanged but slot resolution must return `{ modelId, modelParams }[]` for all active slots per mode instead of single resolved model |

### NEW (neue Implementierung noetig)

| # | What | Why new |
|---|------|---------|
| 1 | `ModelSlots` UI component (3 rows: checkbox + dropdown + per-slot ParameterPanel) | No equivalent multi-slot selection component exists; TierToggle is a single-select segmented control, not a multi-select slot system |
| 2 | `modelSlots` DB table | New schema with `(mode, slot)` unique constraint replaces `(mode, tier)` in `modelSettings`; different columns (`slot integer`, `active boolean`) |
| 3 | `ModelSlotService` | New service with different API: CRUD by mode+slot instead of mode+tier; returns active slots for a mode; enforces min-1 active rule |
| 4 | Slot-based server actions (`getModelSlots`, `updateModelSlot`, `toggleSlotActive`) | New actions replacing tier-based `getModelSettings`/`updateModelSetting`; different input DTOs and validation |
| 5 | `SlotNumber` type and validation constants | New type `SlotNumber = 1 \| 2 \| 3` replacing `Tier = "draft" \| "quality" \| "max"` |
| 6 | Checkbox UI component | No `Checkbox` component exists in `components/ui/`; needed for slot active/inactive toggle. The `radix-ui` package (v1.4.3) is already installed and includes checkbox |
| 7 | DB migration: `model_settings` -> `model_slots` data migration | One-time migration mapping tier=draft->slot=1, tier=quality->slot=2, tier=max->slot=3 with active flags |

### AVOID (bekannte Schuld, nicht replizieren)

| # | What | Decision Log Entry | Alternative |
|---|------|--------------------|-------------|
| 1 | `Tier` type and `VALID_TIERS` constant | Feature replaces this | `SlotNumber = 1 \| 2 \| 3` type |
| 2 | `TierToggle` component | Feature replaces this | New `ModelSlots` component |
| 3 | `MaxQualityToggle` component | Feature replaces this (already unused in production) | Remove entirely |
| 4 | `resolveModel()` utility | Feature replaces this | New function returning all active slots for a mode |
| 5 | `ModelSettingsService` | Feature replaces this | New `ModelSlotService` |
| 6 | `model_settings` table and associated queries | Feature replaces this | New `model_slots` table |
| 7 | `UpdateModelSettingInput` DTO | Feature replaces this | New slot-based DTO |

---

## Conventions Detected

| Convention | Evidence | Count |
|------------|----------|-------|
| Path alias `@/` for all imports (never relative from outside module) | `components/workspace/prompt-area.tsx:13-44`, `lib/services/model-settings-service.ts:1-7` | All files |
| `"use client"` directive on all React components | `components/ui/tier-toggle.tsx:1`, `components/workspace/prompt-area.tsx:1` | All component files |
| `"use server"` directive on all server action files | `app/actions/model-settings.ts:1`, `app/actions/generations.ts:1` | 12 action files |
| Service pattern: `export const XService = { async method() {} }` | `lib/services/model-settings-service.ts`, `lib/services/generation-service.ts` | 8 services |
| Kebab-case filenames | `model-settings-service.ts`, `tier-toggle.tsx`, `resolve-model.ts` | All files |
| PascalCase component names, camelCase functions/variables | `TierToggle`, `resolveModel`, `modelSettings` | All files |
| Drizzle schema: `uuid PK + gen_random_uuid() + createdAt + updatedAt timestamps` | `lib/db/schema.ts:22-46` (projects), `lib/db/schema.ts:209-229` (modelSettings) | 10 tables |
| Drizzle migration naming: `NNNN_descriptive_name.sql` | `drizzle/0007_add_model_settings.sql`, `drizzle/0011_add_models_table.sql` | 12 migrations |
| `requireAuth()` guard as first line in every server action | `app/actions/model-settings.ts:53-55`, `app/actions/generations.ts:73-76` | 12 action files |
| Return `{ error: string }` for validation failures (not throw) in server actions | `app/actions/model-settings.ts:69`, `app/actions/generations.ts:88` | All action files |
| Window event `model-settings-changed` for cross-component data refresh | `components/workspace/prompt-area.tsx:160`, `components/canvas/canvas-detail-view.tsx:98` | 3 listeners |
| `data-testid` attributes on interactive elements | `components/ui/tier-toggle.tsx:61`, `components/workspace/prompt-area.tsx:840` | All components |
| Inferred types from schema: `type X = typeof table.$inferSelect` | `lib/db/queries.ts:9-14` | 7 type exports |
| Comment section separators: `// ---------------------------------------------------------------------------` | All service and component files | All files |

---

## Key Integration Points

| Integration | Current Location | Impact of Feature |
|-------------|------------------|-------------------|
| prompt-area.tsx TierToggle rendering | `components/workspace/prompt-area.tsx:1051-1056` | Replace TierToggle with ModelSlots component; change from single tier state to slot state |
| prompt-area.tsx resolveModel call | `components/workspace/prompt-area.tsx:706-707,728-729,766-767` | Replace `resolveModel(settings, mode, tier)` with slot-based resolution returning `modelIds[]` from active slots |
| prompt-area.tsx model settings load | `components/workspace/prompt-area.tsx:149-164` | Change from loading `ModelSetting[]` to loading `ModelSlot[]`; change event name |
| canvas-detail-view.tsx model settings | `components/canvas/canvas-detail-view.tsx:83-102` | Load slots instead of settings; pass to popovers |
| canvas-detail-view.tsx tier resolution in handlers | `components/canvas/canvas-detail-view.tsx:295-297,354-356,465-474` | Replace `s.mode === "..." && s.tier === params.tier` with slot-based lookup |
| canvas-chat-panel.tsx TierToggle | `components/canvas/canvas-chat-panel.tsx:12,635-638` | Replace with compact ModelSlots; chat uses compact layout without ParameterPanel |
| canvas-chat-panel.tsx tier_models context | `components/canvas/canvas-chat-panel.tsx:66-80` | Build slot_models context from active slots instead of tier->model mapping |
| variation-popover.tsx TierToggle + resolveModel | `components/canvas/popovers/variation-popover.tsx:15-20,73-77` | Replace with ModelSlots (stacked layout) |
| img2img-popover.tsx TierToggle + resolveModel | `components/canvas/popovers/img2img-popover.tsx:17-20,70-80` | Replace with ModelSlots (stacked layout) with strength slider above |
| upscale-popover.tsx TierToggle | `components/canvas/popovers/upscale-popover.tsx:20-21,44-48,67-69` | Replace with ModelSlots; scale buttons trigger directly (no Generate button) |
| settings-dialog.tsx model settings CRUD | `components/settings/settings-dialog.tsx:19-22,53-80` | Make read-only; show current slot assignments |
| model-mode-section.tsx tier dropdowns | `components/settings/model-mode-section.tsx:44-56,79-157` | Refactor to show slots (read-only) instead of tier->model dropdowns |
| lib/types.ts Tier type | `lib/types.ts:11,27-28,38-42` | Remove Tier type, VALID_TIERS, UpdateModelSettingInput; add SlotNumber type |

---

## Decision Log Context

> No decision log found at `.decisions.md`.

---

## Scan Summary

| Metric | Value |
|--------|-------|
| Patterns found | 16 |
| REUSE recommendations | 12 |
| EXTEND recommendations | 2 |
| NEW recommendations | 7 |
| AVOID recommendations | 7 |
| Decision Log entries | 0 |
