# Feature: Model Slots — Tier-Toggle durch direkte Model-Auswahl ersetzen

**Epic:** –
**Status:** Draft
**Discovery:** `discovery.md` (same folder)
**Derived from:** Discovery constraints, NFRs, and risks

---

## Problem & Solution

**Problem:**
- Tier-System (Draft/Quality/Max) ist eine intransparente Indirektion
- Model-Wechsel erfordert Umweg ueber Settings-Dialog
- Multi-Model-Generierung (Backend existiert) wird von UI nicht genutzt
- "Draft/Quality/Max" suggeriert Qualitaetsunterschied, ist aber nur ein Model-Alias

**Solution:**
- 3 feste Model Slots (Checkbox + Dropdown) ersetzen Tier-Toggle
- Direkte Model-Auswahl im Workspace, kein Settings-Umweg
- Aktive Slots werden als `modelIds[]` an Backend gesendet (Multi-Model)
- Per-Slot Parameter (schema-basiert vom jeweiligen Model)

**Business Value:**
- Schnellerer Model-Wechsel (1 Klick statt 3)
- Multi-Model-Vergleich moeglich (2-3 Models gleichzeitig)
- Transparenz: User sieht welches Model er nutzt

---

## Scope & Boundaries

| In Scope |
|----------|
| Neue `model_slots` DB-Tabelle + Migration von `model_settings` |
| `ModelSlotService` (CRUD, Kompatibilitaets-Filter) |
| `ModelSlots` UI-Komponente (stacked + compact Layout) |
| Integration in Workspace, Canvas Popovers, Chat Panel |
| Settings Dialog auf Read-Only umstellen |
| Per-Slot ParameterPanel (schema-basiert) |
| Cleanup: Tier-Type, TierToggle, MaxQualityToggle entfernen |

| Out of Scope |
|--------------|
| Drag & Drop Slot-Reihenfolge |
| Favoriten / Recent Models |
| Model-Previews im Dropdown |
| Custom Slot-Benennung |

---

## API Design

### Overview

| Aspect | Specification |
|--------|---------------|
| Style | Next.js Server Actions (not REST) |
| Authentication | `auth()` check in each action (existing pattern) |
| Rate Limiting | None (single-user app) |

### Server Actions

| Action | Input | Output | Business Logic |
|--------|-------|--------|----------------|
| `getModelSlots()` | – | `ModelSlot[]` | Fetch all slots; seed defaults if empty (same pattern as `getModelSettings`) |
| `updateModelSlot(input)` | `UpdateModelSlotInput` | `ModelSlot \| {error}` | Validate mode, slot, modelId format; check model compatibility; upsert |
| `toggleSlotActive(input)` | `ToggleSlotActiveInput` | `ModelSlot \| {error}` | Enforce min-1-active rule; auto-activate on model assignment |
| `getModelSettings()` | – | – | **REMOVE** (replaced by `getModelSlots`) |
| `updateModelSetting(input)` | – | – | **REMOVE** (replaced by `updateModelSlot`) |

### Data Transfer Objects (DTOs)

| DTO | Fields | Validation | Notes |
|-----|--------|------------|-------|
| `UpdateModelSlotInput` | `mode: GenerationMode, slot: SlotNumber, modelId: string, modelParams?: Record<string, unknown>` | mode in VALID_GENERATION_MODES, slot in [1,2,3], modelId matches `^[a-z0-9-]+/[a-z0-9._-]+$` | Auto-activates slot if model assigned to empty slot |
| `ToggleSlotActiveInput` | `mode: GenerationMode, slot: SlotNumber, active: boolean` | mode valid, slot in [1,2,3] | Rejects deactivation if last active slot |

---

## Database Schema

### Entities

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `model_slots` (NEW) | Per-mode slot configuration (3 slots per mode) | mode, slot, model_id, model_params, active |
| `model_settings` (DROP after migration) | Legacy tier-based configuration | mode, tier, model_id, model_params |

### Schema Details — `model_slots`

| Column | Type | Constraints | Index |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | – |
| `mode` | `varchar(20)` | NOT NULL | Part of UNIQUE |
| `slot` | `integer` | NOT NULL, CHECK (slot IN (1,2,3)) | Part of UNIQUE |
| `model_id` | `varchar(255)` | NULLABLE (empty slot) | – |
| `model_params` | `jsonb` | NOT NULL, DEFAULT `'{}'` | – |
| `active` | `boolean` | NOT NULL, DEFAULT `false` | – |
| `created_at` | `timestamp with time zone` | DEFAULT `now()` | – |
| `updated_at` | `timestamp with time zone` | DEFAULT `now()` | – |

**Indexes:**
- `UNIQUE(mode, slot)` — one config per mode+slot combination

### Relationships

| From | To | Relationship | Cascade |
|------|-----|--------------|---------|
| `model_slots.model_id` | `models.replicate_id` | Logical reference (no FK constraint) | N/A — permissive, same as current `model_settings` |

### Migration Strategy

| Step | Action | Details |
|------|--------|---------|
| 1 | CREATE TABLE `model_slots` | Schema as above |
| 2 | MIGRATE DATA from `model_settings` | `tier='draft'` → `slot=1, active=true`; `tier='quality'` → `slot=2, active=false`; `tier='max'` → `slot=3, active=false` |
| 3 | SEED DEFAULTS for missing modes | Ensure all 5 modes have 3 slots each (15 rows total) |
| 4 | DROP TABLE `model_settings` | After data migration complete |

**Seed Defaults (15 rows):**

| mode | slot | model_id | model_params | active |
|------|------|----------|-------------|--------|
| txt2img | 1 | `black-forest-labs/flux-schnell` | `{}` | true |
| txt2img | 2 | `black-forest-labs/flux-2-pro` | `{}` | false |
| txt2img | 3 | `black-forest-labs/flux-2-max` | `{}` | false |
| img2img | 1 | `black-forest-labs/flux-schnell` | `{prompt_strength: 0.6}` | true |
| img2img | 2 | `black-forest-labs/flux-2-pro` | `{prompt_strength: 0.6}` | false |
| img2img | 3 | `black-forest-labs/flux-2-max` | `{prompt_strength: 0.6}` | false |
| upscale | 1 | `philz1337x/crystal-upscaler` | `{scale: 4}` | true |
| upscale | 2 | `nightmareai/real-esrgan` | `{scale: 2}` | false |
| upscale | 3 | – | `{}` | false |
| inpaint | 1 | – | `{}` | true |
| inpaint | 2 | – | `{}` | false |
| inpaint | 3 | – | `{}` | false |
| outpaint | 1 | – | `{}` | true |
| outpaint | 2 | – | `{}` | false |
| outpaint | 3 | – | `{}` | false |

---

## Server Logic

### Services & Processing

| Service | Responsibility | Input | Output | Side Effects |
|---------|----------------|-------|--------|--------------|
| `ModelSlotService` (NEW) | CRUD for model slots, compatibility check, seed defaults | mode, slot, modelId, modelParams, active | `ModelSlot` / `ModelSlot[]` / `{error}` | DB writes to `model_slots` |
| `ModelSettingsService` | **REMOVE** — replaced by ModelSlotService | – | – | – |

### Business Logic Flow

```
UI (ModelSlots component)
  │
  ├─ Model Dropdown Change
  │   → updateModelSlot(mode, slot, modelId, modelParams)
  │     → Validate modelId format
  │     → Check compatibility (models.capabilities[mode])
  │     → Upsert model_slots row
  │     → Auto-activate if slot was empty
  │     → Dispatch "model-slots-changed" event
  │
  ├─ Checkbox Toggle
  │   → toggleSlotActive(mode, slot, active)
  │     → If deactivating: check min-1-active rule
  │     → If slot has no model_id: reject activation
  │     → Update active flag
  │     → Dispatch "model-slots-changed" event
  │
  └─ Generate Button
      → resolveActiveSlots(slots, mode) → [{modelId, modelParams}, ...]
      → generateImages({ modelIds: [...], params: mergedParams })
      → Generation service handles 1-3 models (existing logic)
```

### Validation Rules

| Field | Rule | Error |
|-------|------|-------|
| `mode` | Must be in `VALID_GENERATION_MODES` | "Invalid generation mode" |
| `slot` | Must be 1, 2, or 3 | "Invalid slot number" |
| `modelId` | Match `^[a-z0-9-]+/[a-z0-9._-]+$` | "Invalid model ID format" |
| `active=false` | At least 1 other slot must remain active for this mode | "Cannot deactivate last active slot" |
| `active=true` | Slot must have `model_id` set (not null) | "Cannot activate empty slot" |
| Compatibility | `models.capabilities[mode]` must be true (fallback: allow if model not in catalog) | "Model not compatible with mode" |

---

## Security

### Authentication & Authorization

| Area | Mechanism | Notes |
|------|-----------|-------|
| Server Actions | `auth()` check (NextAuth) | Same pattern as existing `model-settings.ts` actions |
| Development | `AUTH_DISABLED` env var bypass | Existing dev-mode pattern |

### Data Protection

| Data Type | Protection | Notes |
|-----------|------------|-------|
| model_params | JSONB (no sensitive data) | Contains model-specific parameters like aspect_ratio, scale |
| model_id | Replicate model identifier | Public information, no protection needed |

### Input Validation & Sanitization

| Input | Validation | Sanitization |
|-------|------------|--------------|
| modelId | Regex: `^[a-z0-9-]+/[a-z0-9._-]+$` | Prevents injection via strict format |
| slot | Integer check: `[1, 2, 3]` | Type coercion |
| mode | Enum check against VALID_GENERATION_MODES | Rejects unknown modes |
| modelParams | JSONB serialization by Drizzle | Framework-handled |

### Rate Limiting & Abuse Prevention

| Resource | Limit | Notes |
|----------|-------|-------|
| N/A | None | Single-user application, no rate limiting needed |

---

## Architecture Layers

### Layer Responsibilities

| Layer | Responsibility | Pattern |
|-------|----------------|---------|
| Server Actions (`app/actions/model-slots.ts`) | Auth check, input validation, call service | Existing server action pattern |
| Service (`lib/services/model-slot-service.ts`) | Business logic, compatibility check, seed defaults | Same pattern as `ModelSettingsService` |
| Queries (`lib/db/queries.ts`) | Raw DB operations (select, upsert) | Existing query functions pattern |
| Schema (`lib/db/schema.ts`) | Table definition | Drizzle `pgTable` |
| UI Component (`components/ui/model-slots.tsx`) | Render slots, handle interactions | React component with controlled state |
| Utility (`lib/utils/resolve-model.ts`) | Resolve active slots for a mode | Pure function, no side effects |

### Data Flow

```
ModelSlots Component (UI)
  ↓ onChange / onToggle
Server Action (model-slots.ts)
  ↓ validated input
ModelSlotService (model-slot-service.ts)
  ↓ business logic
Query Functions (queries.ts)
  ↓ SQL
PostgreSQL (model_slots table)

Generate Flow:
ModelSlots → resolveActiveSlots() → modelIds[]
  ↓
generateImages({ modelIds, params })
  ↓
GenerationService.generate() (existing, unchanged)
```

### Error Handling Strategy

| Error Type | Handling | User Response | Logging |
|------------|----------|---------------|---------|
| Validation (bad input) | Return `{error: string}` | Toast via sonner | None |
| Compatibility (model not supported) | Return `{error: string}` | Toast with model/mode info | None |
| Min-1 violation | Return `{error: string}` | Checkbox stays checked (no-op in UI) | None |
| DB error | Throw (caught by Next.js) | Generic error toast | Error log |

---

## Migration Map

> This feature replaces the tier system. Every file touching `Tier`, `TierToggle`, or `model_settings` is affected.

### New Files

| File | Purpose |
|------|---------|
| `components/ui/model-slots.tsx` | ModelSlots component (stacked + compact layouts) |
| `lib/services/model-slot-service.ts` | ModelSlotService (CRUD, compatibility, seeding) |
| `app/actions/model-slots.ts` | Server actions for slot CRUD |
| `drizzle/0012_add_model_slots.sql` | Migration: create table, migrate data, drop old table |

### Modified Files

| Existing File | Current Pattern | Target Pattern | Specific Changes |
|---|---|---|---|
| `lib/db/schema.ts` | `modelSettings` table definition with `mode+tier` | `modelSlots` table definition with `mode+slot+active` | Remove `modelSettings` pgTable; add `modelSlots` pgTable with slot (integer), active (boolean), nullable model_id |
| `lib/db/queries.ts` | `getAllModelSettings()`, `getModelSettingByModeTier()`, `upsertModelSetting()`, `seedModelSettingsDefaults()` | `getAllModelSlots()`, `getModelSlotsByMode()`, `upsertModelSlot()`, `seedModelSlotDefaults()` | Remove 4 model_settings query functions; add 4 model_slots query functions with same patterns |
| `lib/types.ts` | `Tier = "draft" \| "quality" \| "max"`, `VALID_TIERS` | `SlotNumber = 1 \| 2 \| 3`, `VALID_SLOTS` | Remove Tier type + VALID_TIERS; add SlotNumber type + VALID_SLOTS constant |
| `lib/utils/resolve-model.ts` | `resolveModel(settings, mode, tier)` returns single `{modelId, modelParams}` | `resolveActiveSlots(slots, mode)` returns array `{modelId, modelParams}[]` | Change function signature; filter by mode + active; return array of active slot configs |
| `components/workspace/prompt-area.tsx` | `tier` state + `TierToggle` + `resolveModel()` for single model | `slots` state + `ModelSlots` + `resolveActiveSlots()` for multi-model | Replace TierToggle with ModelSlots (stacked); replace resolveModel call with resolveActiveSlots; pass modelIds array to generateImages |
| `components/canvas/canvas-detail-view.tsx` | `modelSettings.find(s => s.mode === mode && s.tier === tier)` | `modelSlots.filter(s => s.mode === mode && s.active)` | Replace modelSettings prop with modelSlots; update variation/img2img/upscale handlers to use active slots; update event name to "model-slots-changed" |
| `components/canvas/canvas-chat-panel.tsx` | `tier` state + `TierToggle` + tier-based model lookup | `ModelSlots` (compact layout) + active-slot-based model lookup | Replace TierToggle with ModelSlots compact; replace tier-based find with active slot resolution |
| `components/canvas/popovers/variation-popover.tsx` | `tier` state + `TierToggle`; `VariationParams.tier` | `ModelSlots` (stacked) + per-slot params; params carry active modelIds | Replace TierToggle with ModelSlots stacked; VariationParams gets `modelIds: string[]` instead of `tier: Tier` |
| `components/canvas/popovers/img2img-popover.tsx` | `tier` state + `TierToggle`; `Img2imgParams.tier` | `ModelSlots` (stacked) + per-slot params; params carry active modelIds | Replace TierToggle with ModelSlots stacked; Img2imgParams gets `modelIds: string[]` instead of `tier: Tier` |
| `components/canvas/popovers/upscale-popover.tsx` | `tier` state + `TierToggle` with `hiddenValues={["max"]}`; upscale uses tier for model lookup | `ModelSlots` (stacked, no per-slot params); upscale uses active slots | Replace TierToggle with ModelSlots stacked (no ParameterPanel per Discovery exception); remove hiddenValues workaround |
| `components/settings/settings-dialog.tsx` | Editable model dropdowns; `updateModelSetting()` calls; `modelsByMode` state | Read-only slot display; remove edit handlers; show active/inactive status | Remove `onModelChange` handler; replace ModelModeSection with read-only display; keep Sync Models button; add hint text |
| `components/settings/model-mode-section.tsx` | Editable dropdowns per tier (`TIERS_BY_MODE` config); `onModelChange` callback | Read-only display: slot label + model name + status dot | Replace dropdowns with static text; remove change handler; show 3 slots per mode with active indicator |

### Removed Files

| File | Reason |
|------|--------|
| `components/ui/tier-toggle.tsx` | Replaced by `ModelSlots` component |
| `components/ui/max-quality-toggle.tsx` | No longer needed (was not integrated) |
| `lib/services/model-settings-service.ts` | Replaced by `ModelSlotService` |
| `app/actions/model-settings.ts` | Replaced by `app/actions/model-slots.ts` |

---

## Constraints & Integrations

### Constraints

| Constraint | Technical Implication | Solution |
|------------|----------------------|----------|
| Backend accepts 1-3 modelIds | UI must send array of active slot modelIds | `resolveActiveSlots()` returns array; max 3 enforced by 3 fixed slots |
| Min 1 active slot | Checkbox toggle must prevent deactivating last slot | `toggleSlotActive()` counts active slots before deactivation |
| Per-slot parameters | Each model may have different input schema | `useModelSchema(modelId)` hook already exists; render ParameterPanel per active slot |
| Mode-specific slots | Each mode has independent 3-slot configuration | DB constraint: UNIQUE(mode, slot); UI swaps slots on mode change |
| Existing generations reference modelId | Migration must not break historical data | `generations.modelId` is independent; no FK to model_settings or model_slots |

### Integrations

| Area | System / Capability | Interface | Version | Notes |
|------|----------------------|-----------|---------|-------|
| Database | PostgreSQL | Drizzle ORM | drizzle-orm 0.45.1, drizzle-kit 0.31.9 | New migration 0012 |
| UI Components | Radix UI | Select, Checkbox primitives | @radix-ui 1.4.3 | Model dropdown + slot checkbox |
| Model Catalog | Replicate API | `models` table (capabilities JSONB) | replicate 1.4.0 | Compatibility filter for dropdowns |
| Model Schema | `useModelSchema` hook | Input schema from `models.input_schema` | Existing | Per-slot ParameterPanel rendering |
| Event System | Custom DOM events | `"model-slots-changed"` event | Existing pattern (`"model-settings-changed"`) | Cross-component sync |

---

## Quality Attributes (NFRs)

### From Discovery -> Technical Solution

| Attribute | Target | Technical Approach | Measure / Verify |
|-----------|--------|--------------------|------------------|
| Responsiveness | Slot change < 100ms perceived | Optimistic UI updates; DB write in background | Manual testing |
| Data integrity | Mode switch preserves slot config | DB-persisted per mode; no client-side cache invalidation issues | Verify mode round-trip |
| Backward compat | Existing generations unaffected | No FK from generations to model_settings/model_slots | Check old generations still render |
| Migration safety | No data loss during tier→slot migration | SQL migration with INSERT...SELECT; seed defaults for missing modes | Verify 15 rows after migration |

### Monitoring & Observability

| Metric | Type | Target | Alert |
|--------|------|--------|-------|
| N/A | – | – | Single-user app, no monitoring needed |

---

## Risks & Assumptions

### Assumptions

| Assumption | Technical Validation | Impact if Wrong |
|------------|---------------------|-----------------|
| Max 3 models per generation is sufficient | Backend validates 1-3 modelIds (existing) | UI enforces via 3 fixed slots; no change needed |
| All modes use same 3-slot pattern | Discovery confirms (incl. upscale, inpaint, outpaint) | Would need mode-specific slot counts |
| model_settings has no other consumers | Grep codebase for imports | Would need migration path for other consumers |
| Per-slot params are independent (no cross-slot constraints) | Discovery confirms | Would need shared parameter state |

### Risks & Mitigation

| Risk | Likelihood | Impact | Technical Mitigation | Fallback |
|------|------------|--------|---------------------|----------|
| Migration fails on existing data | Low | High | Test migration on DB copy; use transaction | Rollback migration; keep model_settings |
| Model schema loading slow (3 schemas per mode) | Medium | Low | Schemas already cached by `useModelSchema` hook; load only for active slots | Show loading skeleton per slot |
| Per-slot parameters UI becomes too tall | Low | Medium | Collapse inactive slot params; only show params for active slots | Hide params behind expandable section |

---

## Technology Decisions

### Stack Choices

| Area | Technology | Rationale |
|------|------------|-----------|
| Migration | Drizzle Kit (SQL migration) | Existing migration toolchain; migration 0012 |
| Slot Checkbox | Radix UI Checkbox | Existing UI library; accessible |
| Model Dropdown | Radix UI Select | Existing component pattern (used in ModelModeSection) |
| State Sync | Custom DOM event (`"model-slots-changed"`) | Follows existing `"model-settings-changed"` pattern |

### Trade-offs

| Decision | Pro | Con | Mitigation |
|----------|-----|-----|------------|
| Drop `model_settings` in same migration | Clean schema, no dead table | Irreversible in production | Single-user app; can re-seed if needed |
| 3 fixed slots (not dynamic) | Simple UI, matches backend limit | Can't add slot 4 later | Backend limit is 1-3; 3 slots is correct |
| Per-slot ParameterPanel | Full model control per slot | More vertical space | Only show for active slots; collapse for compact layout |
| Rename event to `"model-slots-changed"` | Clear naming | Must update all listeners | Grep + replace all `"model-settings-changed"` references |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| – | None | – | – | All questions resolved in Discovery |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-29 | Codebase: schema | `model_settings` table: (mode, tier) UNIQUE, 9 seed defaults. Drizzle pgTable definition in `lib/db/schema.ts` |
| 2026-03-29 | Codebase: service | `ModelSettingsService`: getAll(), getForModeTier(), update(), checkCompatibility(). 106 lines. Seeds defaults if empty |
| 2026-03-29 | Codebase: resolve | `resolveModel(settings, mode, tier)` — pure function, 26 lines. Returns single {modelId, modelParams} |
| 2026-03-29 | Codebase: generation | `GenerationService.generate()` already handles `modelIds[]` (1-3). Single-model: count records. Multi-model: 1 per model. 627 lines |
| 2026-03-29 | Codebase: UI | `TierToggle` used in 5 locations: prompt-area, variation-popover, img2img-popover, upscale-popover, canvas-chat-panel |
| 2026-03-29 | Codebase: settings | Settings dialog has editable dropdowns per mode+tier. `TIERS_BY_MODE` config varies per mode (e.g. upscale: no max) |
| 2026-03-29 | Codebase: events | `"model-settings-changed"` CustomEvent used for cross-component sync |
| 2026-03-29 | Codebase: types | `Tier = "draft" \| "quality" \| "max"` in `lib/types.ts`. Also: `GenerationMode`, `VALID_TIERS`, `VALID_GENERATION_MODES` |
| 2026-03-29 | Codebase: migrations | 12 migrations (0000-0011) in `drizzle/`. Pattern: `NNNN_descriptive_name.sql` |
| 2026-03-29 | Codebase: deps | Next.js 16.1.6, React 19.2.3, drizzle-orm 0.45.1, Radix UI 1.4.3, Tailwind 4, postgres-js 3.4.8 |
| 2026-03-29 | Codebase: MaxQualityToggle | Component exists (59 lines) but NOT integrated anywhere — can be deleted |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| 1 | Soll ein GitHub Issue verlinkt werden? | Ohne Issue weiter (User-Entscheidung) |
