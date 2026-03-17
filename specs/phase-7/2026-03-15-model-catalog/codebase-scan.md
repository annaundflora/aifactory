# Codebase Scan# Codebase Scan

**Feature:** Model Catalog
**Scan-Datum:** 2026-03-17
**Discovery:** `specs/phase-7/2026-03-15-model-catalog/discovery.md`

---

## Identified Patterns

| # | Pattern | Locations | Count | Type |
|---|---------|-----------|-------|------|
| 1 | Drizzle Schema Definition | `lib/db/schema.ts` | 10 tables | REUSE |
| 2 | Drizzle Query Layer (queries.ts) | `lib/db/queries.ts` | 1 file, ~30 functions | REUSE |
| 3 | Service Layer (Object-style export) | `lib/services/model-settings-service.ts`, `lib/services/generation-service.ts`, `lib/services/collection-model-service.ts` | 8 services | REUSE |
| 4 | Server Actions with Auth Guard | `app/actions/model-settings.ts`, `app/actions/models.ts`, `app/actions/generations.ts` | 7 action files | REUSE |
| 5 | Settings Dialog (Model Settings UI) | `components/settings/settings-dialog.tsx`, `components/settings/model-mode-section.tsx` | 2 components | EXTEND |
| 6 | Toast Notifications (sonner) | `components/shared/toast-provider.tsx`, 15+ consumer components | 15+ usages | REUSE |
| 7 | In-Memory Schema Cache | `lib/services/model-schema-service.ts` | 1 service | EXTEND |
| 8 | In-Memory Collection Cache | `lib/services/collection-model-service.ts` | 1 service | EXTEND |
| 9 | Generation Mode / Tier Types | `lib/types.ts` | 1 file, used in 10+ locations | EXTEND |
| 10 | Replicate Concurrency Control | `lib/clients/replicate.ts` | 1 client | REUSE |
| 11 | Drizzle Migration Files | `drizzle/0000_*.sql` through `drizzle/0010_*.sql` | 11 migrations | REUSE |
| 12 | Custom Event Bus (window.dispatchEvent) | `components/settings/settings-dialog.tsx` | 3 usages | REUSE |
| 13 | Model Browser Drawer | `components/models/model-browser-drawer.tsx`, `components/models/model-card.tsx` | 2 components | REUSE |
| 14 | img2img Field Detection | `lib/services/model-schema-service.ts:20-46` | 1 function | EXTEND |
| 15 | DB Connection Singleton | `lib/db/index.ts` | 1 file | REUSE |

---

## Existing Abstractions

| Abstraction | Location | Used by | Recommendation | Rationale |
|-------------|----------|---------|----------------|-----------|
| `pgTable` schema definition pattern | `lib/db/schema.ts` | All 10 tables use identical pattern (uuid PK, timestamps, indexes) | REUSE | New `models` table follows same pattern with uuid, timestamps, indexes |
| Drizzle query functions | `lib/db/queries.ts` | All server actions and services | REUSE | New model-catalog queries follow same export pattern (typed returns, `.$inferSelect`) |
| Service object pattern | `lib/services/*.ts` | 8 services export object with async methods | REUSE | New sync service follows `ModelSettingsService` pattern (object export, async methods) |
| Server Action pattern | `app/actions/*.ts` | 7 action files, all with `"use server"` + `requireAuth()` guard | REUSE | All new server actions must use this guard |
| `requireAuth()` guard | `lib/auth/guard.ts` | 25 files reference it | REUSE | All new server actions must use this guard |
| `CollectionModel` type | `lib/types/collection-model.ts` | `collection-model-service.ts`, `model-browser-drawer.tsx`, `model-card.tsx`, `settings-dialog.tsx` | EXTEND | Will be superseded by DB-backed Model type but shape is similar |
| `GenerationMode` / `Tier` types | `lib/types.ts` | `model-settings.ts`, `settings-dialog.tsx`, `model-mode-section.tsx`, `prompt-area.tsx` | EXTEND | Need to add `inpaint` and `outpaint` modes |
| `TIERS_BY_MODE` mapping | `components/settings/model-mode-section.tsx:38-42` | Settings dialog | EXTEND | Must add inpaint/outpaint entries |
| `MODE_LABELS` mapping | `components/settings/model-mode-section.tsx:32-36` | Settings dialog | EXTEND | Must add INPAINT/OUTPAINT labels |
| Toast via `sonner` | `components/shared/toast-provider.tsx` | 15+ components use `toast()`, `toast.error()`, `toast.success()` | REUSE | Progress-Toast is new pattern but same library |
| `model-settings-changed` event | `components/settings/settings-dialog.tsx:126` | Listened by `prompt-area.tsx`, `canvas-detail-view.tsx` | REUSE | Same event can trigger after sync completion |
| Replicate concurrency queue | `lib/clients/replicate.ts:28-47` | `replicateRun()` | REUSE | Similar queue pattern needed for sync (max 5 concurrent) |
| `ParameterPanel` component | `components/workspace/parameter-panel.tsx` | Workspace content | REUSE | Data source changes (DB instead of live API) but component interface unchanged |
| `ModelSchemaService.getSchema()` | `lib/services/model-schema-service.ts:87-164` | `generation-service.ts`, `model-settings-service.ts`, `app/actions/models.ts` | EXTEND | Schema fetch logic reused for sync; in-memory cache replaced by DB |
| `getImg2ImgFieldName()` | `lib/services/model-schema-service.ts:20-46` | `generation-service.ts` | EXTEND | Logic becomes part of capability detection (img2img subset) |
| Drizzle config | `drizzle.config.ts` | Build/migration tooling | REUSE | No changes needed |
| `@/` path alias | All imports in `lib/`, `app/`, `components/` | 100+ files | REUSE | Convention: absolute imports via `@/` alias |
