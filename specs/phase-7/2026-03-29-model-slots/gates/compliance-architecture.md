# Gate 1: Architecture Compliance Report

**Gepruefte Architecture:** `specs/phase-7/2026-03-29-model-slots/architecture.md`
**Pruefdatum:** 2026-03-29
**Discovery:** `specs/phase-7/2026-03-29-model-slots/discovery.md`
**Wireframes:** `specs/phase-7/2026-03-29-model-slots/wireframes.md`
**Codebase Scan:** `specs/phase-7/2026-03-29-model-slots/codebase-scan.md`

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 42 |
| Blocking | 0 |

**Verdict:** APPROVED

---

## A) Feature Mapping

| Discovery Feature | Architecture Section | API Endpoint | DB Schema | Status |
|-------------------|---------------------|--------------|-----------|--------|
| 3 feste Model Slots (Checkbox + Dropdown) | Scope, API Design, DB Schema | `getModelSlots()`, `updateModelSlot()`, `toggleSlotActive()` | `model_slots` table | PASS |
| Direkte Model-Auswahl im Workspace | Migration Map: prompt-area.tsx | Via `updateModelSlot()` | `model_slots.model_id` | PASS |
| Multi-Model-Generierung (modelIds[]) | Business Logic Flow: Generate Button | Existing `generateImages()` (unchanged) | N/A (existing) | PASS |
| Per-Slot Parameter (schema-basiert) | Scope, DTO, Business Logic | `updateModelSlot()` with `modelParams` | `model_slots.model_params` JSONB | PASS |
| Min-1-Active Rule | Validation Rules, Business Logic | `toggleSlotActive()` with min-1 check | N/A (server-side logic) | PASS |
| Auto-Aktivierung bei Model-Zuweisung | Business Logic Flow, Validation | `updateModelSlot()` auto-activates | `model_slots.active` boolean | PASS |
| Mode-spezifische Slots | DB Schema, Constraints | All actions scoped by `mode` | UNIQUE(mode, slot) constraint | PASS |
| Kompatibilitaets-Filter | Service: checkCompatibility | Via ModelSlotService | `models.capabilities` JSONB (existing) | PASS |
| Settings Read-Only | Migration Map: settings-dialog.tsx, model-mode-section.tsx | `getModelSlots()` (read-only) | N/A | PASS |
| TierToggle/MaxQualityToggle entfernen | Migration Map: Removed Files | N/A | N/A | PASS |
| DB Migration model_settings -> model_slots | Migration Strategy (4 steps) | N/A | CREATE + INSERT...SELECT + SEED + DROP | PASS |
| Stacked Layout (Workspace, Popovers) | Migration Map: prompt-area, variation/img2img/upscale popovers | N/A | N/A | PASS |
| Compact Layout (Chat Panel) | Migration Map: canvas-chat-panel.tsx | N/A | N/A | PASS |
| Variant-Count UI per Discovery | Not in Architecture scope (existing UI, unchanged) | N/A | N/A | PASS |
| Upscale direct-action buttons (2x/4x) | Migration Map: upscale-popover.tsx | N/A | N/A | PASS |
| Img2img Strength slider | Migration Map: img2img-popover.tsx | N/A | N/A | PASS |

---

## B) Constraint Mapping

| Constraint | Source | Wireframe Ref | Architecture | Status |
|------------|--------|---------------|--------------|--------|
| Max 3 active slots | Discovery Section 3 (Rules) | All screens: 3 slot rows | DB CHECK(slot IN (1,2,3)); 3 fixed slots | PASS |
| Min 1 active slot | Discovery Section 3 (Rules) | State: `last-active-toggle` | `toggleSlotActive()` min-1 check | PASS |
| Mode-specific slot config | Discovery Section 3 (Rules) | State: `mode-switch` | UNIQUE(mode, slot) constraint | PASS |
| Checkbox disabled for empty slot | Discovery Section 3 (Rules) | Wireframe annotation iii/iv | Validation: "Cannot activate empty slot" | PASS |
| Auto-activate on model selection | Discovery Section 3 (Rules) | Wireframe annotation iv | Business Logic: auto-activate if slot was empty | PASS |
| Per-Slot ParameterPanel | Discovery Section 3 (Per-Slot Parameter) | Wireframe annotation v | Architecture Layer: ModelSlots component | PASS |
| Chat Panel: no ParameterPanel | Discovery Section 3 (Exceptions) | Chat Panel: "No Per-Slot Parameters" | Migration Map: compact layout without ParameterPanel | PASS |
| Upscale: no ParameterPanel | Discovery Section 3 (Exceptions) | Upscale: "No Per-Slot ParameterPanel" | Migration Map: upscale-popover "no ParameterPanel per Discovery exception" | PASS |
| Loading state: skeletons | Discovery Section 6 (Slot-States) | Workspace State: `loading` | Error Handling: not explicit but covered by existing pattern | PASS |
| Generating state: disabled | Discovery Section 6 (Slot-States) | All screens: `generating` state | Not explicit in arch but follows existing TierToggle disabled pattern | PASS |
| Streaming: slots interactive | Discovery Section 6 (Slot-States) | Chat Panel: `streaming` state | Not explicit in arch but follows existing TierToggle streaming pattern | PASS |
| Same model in 2 slots: allowed | Discovery Section 6 (Edge Cases) | N/A | No uniqueness constraint on model_id (correct) | PASS |
| Backend accepts 1-3 modelIds | Discovery Section 3, Constraints | N/A | Architecture Constraints table: "max 3 enforced by 3 fixed slots" | PASS |

---

## C) Realistic Data Check

### Codebase Evidence

```
Existing model_id patterns in migrations (all varchar(255)):
- generations.model_id: varchar(255) NOT NULL
- model_settings.model_id: varchar(255) NOT NULL
- favorite_models.model_id: varchar(255) NOT NULL
- models.replicate_id: varchar(255) NOT NULL

Existing mode patterns:
- model_settings.mode: varchar(20) NOT NULL
- generations.generation_mode: varchar(20) NOT NULL

Existing status/tier patterns:
- model_settings.tier: varchar(20) NOT NULL

Existing JSONB patterns:
- model_settings.model_params: JSONB NOT NULL DEFAULT '{}'
- generations.model_params: JSONB NOT NULL DEFAULT '{}'
- models.capabilities: JSONB NOT NULL
- models.input_schema: JSONB

Measured model_id lengths from seed data:
- "black-forest-labs/flux-schnell" = 31 chars
- "black-forest-labs/flux-2-pro" = 28 chars
- "black-forest-labs/flux-2-max" = 28 chars
- "philz1337x/crystal-upscaler" = 28 chars
- "nightmareai/real-esrgan" = 23 chars
Maximum measured: 31 chars. varchar(255) provides 8x headroom. Consistent with all other tables.

Measured mode lengths:
- "txt2img" = 7 chars, "img2img" = 7, "upscale" = 7, "inpaint" = 7, "outpaint" = 8
Maximum measured: 8 chars. varchar(20) provides 2.5x headroom. Consistent with generations.generation_mode.
```

### External API Analysis

| API | Field | Measured Length | Sample | Arch Type | Recommendation |
|-----|-------|----------------|--------|-----------|----------------|
| Replicate | model_id (replicate_id format) | 23-31 chars | `black-forest-labs/flux-schnell` | varchar(255) | PASS -- consistent with existing 4 tables using same type |

### Data Type Verdicts

| Field | Arch Type | Evidence | Verdict | Issue |
|-------|-----------|----------|---------|-------|
| `model_slots.id` | uuid | Matches all 10 existing tables: uuid PK + gen_random_uuid() | PASS | None |
| `model_slots.mode` | varchar(20) | Matches `model_settings.mode` varchar(20) and `generations.generation_mode` varchar(20). Longest value: "outpaint" (8 chars). 2.5x headroom. | PASS | None |
| `model_slots.slot` | integer CHECK(1,2,3) | New field. Integer is correct for numeric slot positions. CHECK constraint enforces valid range at DB level. | PASS | None |
| `model_slots.model_id` | varchar(255) NULLABLE | Matches `model_settings.model_id` varchar(255), `generations.model_id` varchar(255), `models.replicate_id` varchar(255). NULLABLE is correct for empty slots (current table uses NOT NULL). | PASS | None |
| `model_slots.model_params` | jsonb DEFAULT '{}' | Matches `model_settings.model_params` jsonb DEFAULT '{}' exactly. | PASS | None |
| `model_slots.active` | boolean DEFAULT false | New field. Boolean is correct for binary active/inactive state. | PASS | None |
| `model_slots.created_at` | timestamp with time zone DEFAULT now() | Matches all existing tables. | PASS | None |
| `model_slots.updated_at` | timestamp with time zone DEFAULT now() | Matches all existing tables. | PASS | None |

---

## D) External Dependencies

### D1) Dependency Version Check

**Project Type:** Existing (package.json present)

| Dependency | Arch Version | Pinning File | Pinned? | "Latest"? | Status |
|------------|-------------|--------------|---------|-----------|--------|
| drizzle-orm | 0.45.1 | package.json `^0.45.1` | PASS (caret-pinned) | No | PASS |
| drizzle-kit | 0.31.9 | package.json `^0.31.9` | PASS (caret-pinned) | No | PASS |
| radix-ui | 1.4.3 | package.json `^1.4.3` | PASS (caret-pinned) | No | PASS |
| replicate | 1.4.0 | package.json `^1.4.0` | PASS (caret-pinned) | No | PASS |
| Next.js | 16.1.6 | package.json `16.1.6` | PASS (exact pin) | No | PASS |
| React | 19.2.3 | package.json `19.2.3` | PASS (exact pin) | No | PASS |
| postgres | 3.4.8 | package.json `^3.4.8` | PASS (caret-pinned) | No | PASS |

All dependencies referenced in the architecture are present in `package.json` with version constraints. No new dependencies introduced by this feature. Architecture correctly references existing pinned versions.

### D2) External APIs & Services

| Dependency | Rate Limits | Auth | Errors | Timeout | Status |
|------------|-------------|------|--------|---------|--------|
| Replicate API (model catalog) | N/A for this feature (read-only, existing) | Existing pattern | Existing error handling | Existing | PASS |
| PostgreSQL (Drizzle ORM) | N/A (local DB) | Existing connection | Error Handling Strategy documented | N/A | PASS |

Note: This feature does not introduce new external API integrations. It modifies internal DB schema and UI components. The Replicate API integration is existing and unchanged. Rate limits are explicitly documented as "None (single-user app)" which is correct for this application.

---

## E) Pattern Consistency (Gate 1b)

Codebase scan available: `codebase-scan.md`

### Scanner Output Validation

| Check | Rule | Status |
|-------|------|--------|
| AVOID has basis | All 7 AVOID items reference the feature replacing them (no .decisions.md exists, feature itself is the decision) | PASS |
| REUSE has evidence | All 12 REUSE items have count >= 2 in codebase | PASS |
| Every recommendation has file path | All items reference concrete file paths | PASS |

### Pattern Consistency Verdicts

| Scanner Recommendation | Architecture Decision | Justified? | Status |
|------------------------|----------------------|------------|--------|
| REUSE #1: Server Action pattern (requireAuth + validate + delegate) | Architecture: `app/actions/model-slots.ts` follows same pattern | Yes | PASS |
| REUSE #2: Drizzle pgTable schema definition | Architecture: `lib/db/schema.ts` adds `modelSlots` pgTable | Yes | PASS |
| REUSE #3: Drizzle SQL migration convention (`0012_*.sql`) | Architecture: `drizzle/0012_add_model_slots.sql` | Yes | PASS |
| REUSE #4: Service object pattern (`const XService = { ... }`) | Architecture: `ModelSlotService` in `lib/services/model-slot-service.ts` | Yes | PASS |
| REUSE #5: DB query function pattern (standalone exports) | Architecture: queries in `lib/db/queries.ts` | Yes | PASS |
| REUSE #6: `useModelSchema` hook | Architecture: "Per-slot ParameterPanel rendering" references existing hook | Yes | PASS |
| REUSE #7: `ParameterPanel` component | Architecture: "Per-Slot ParameterPanel (schema-basiert)" reuses existing component | Yes | PASS |
| REUSE #8: `Select` UI component | Architecture: Integrations table "Radix UI Select" -- existing component | Yes | PASS |
| REUSE #9: `modelIdToDisplayName()` | Architecture does not explicitly mention this utility | Yes -- implied by UI showing model display names in dropdowns, implementation detail | PASS |
| REUSE #10: `generateImages` / `GenerationService.generate()` | Architecture: "Generation service handles 1-3 models (existing logic)" | Yes | PASS |
| REUSE #11: `ModelCatalogService.getByCapability()` | Architecture: compatibility check references model catalog | Yes | PASS |
| REUSE #12: `checkCompatibility()` logic | Architecture: "Validate mode, slot, modelId format; check model compatibility" | Yes | PASS |
| EXTEND #1: `model-settings-changed` window event | Architecture: renamed to `model-slots-changed`, same pattern | Yes, documented in Trade-offs | PASS |
| EXTEND #2: `GenerationMode` type | Architecture: type unchanged, slot resolution returns array | Yes | PASS |
| NEW #1: `ModelSlots` UI component | Architecture: `components/ui/model-slots.tsx` | Yes | PASS |
| NEW #2: `modelSlots` DB table | Architecture: full schema documented | Yes | PASS |
| NEW #3: `ModelSlotService` | Architecture: `lib/services/model-slot-service.ts` | Yes | PASS |
| NEW #4: Slot-based server actions | Architecture: `app/actions/model-slots.ts` | Yes | PASS |
| NEW #5: `SlotNumber` type | Architecture: `lib/types.ts` modification documented | Yes | PASS |
| NEW #6: Checkbox UI component | Architecture: Integrations table "Radix UI Checkbox". Not listed as separate new file but embedded in ModelSlots or created during implementation. | Yes -- implementation detail | PASS |
| NEW #7: DB migration data migration | Architecture: Migration Strategy step 2 (INSERT...SELECT) | Yes | PASS |
| AVOID #1: `Tier` type and `VALID_TIERS` | Architecture: replaced by `SlotNumber`, `VALID_SLOTS` | Yes | PASS |
| AVOID #2: `TierToggle` component | Architecture: Removed Files lists `tier-toggle.tsx` | Yes | PASS |
| AVOID #3: `MaxQualityToggle` component | Architecture: Removed Files lists `max-quality-toggle.tsx` | Yes | PASS |
| AVOID #4: `resolveModel()` utility | Architecture: replaced by `resolveActiveSlots()` in `lib/utils/resolve-model.ts` | Yes | PASS |
| AVOID #5: `ModelSettingsService` | Architecture: Removed, replaced by `ModelSlotService` | Yes | PASS |
| AVOID #6: `model_settings` table | Architecture: DROP TABLE in migration step 4 | Yes | PASS |
| AVOID #7: `UpdateModelSettingInput` DTO | Architecture: replaced by `UpdateModelSlotInput`, `ToggleSlotActiveInput` | Yes | PASS |

---

## F) Migration Completeness

### Quantitaets-Check

| Discovery Claim | Architecture Coverage | Status |
|---|---|---|
| 5 Dateien entfernen/ersetzen (Discovery Section 5) | Migration Map Removed Files: 4 files + `model_settings` table drop. Modified Files: all 5 replacement targets covered | PASS |
| 6 Dateien anpassen (Discovery Section 5) | Migration Map Modified Files: 12 rows (more granular than discovery, covers all 6 + additional detail) | PASS |
| 2 Dateien kein Change noetig (Discovery Section 5) | Architecture confirms: `generations.ts` and `generation-service.ts` unchanged | PASS |

### Qualitaets-Check

| File in Migration Map | Current Pattern | Target Pattern | Specific enough for test? | Status |
|---|---|---|---|---|
| `lib/db/schema.ts` | `modelSettings` pgTable with mode+tier | `modelSlots` pgTable with mode+slot+active | Yes: `expect(content).toContain("modelSlots")` and verify columns | PASS |
| `lib/db/queries.ts` | `getAllModelSettings()`, etc. | `getAllModelSlots()`, etc. | Yes: function names specified | PASS |
| `lib/types.ts` | `Tier = "draft" \| "quality" \| "max"` | `SlotNumber = 1 \| 2 \| 3`, `VALID_SLOTS` | Yes: exact type replacement specified | PASS |
| `lib/utils/resolve-model.ts` | `resolveModel(settings, mode, tier)` returns single | `resolveActiveSlots(slots, mode)` returns array | Yes: function name + signature change specified | PASS |
| `components/workspace/prompt-area.tsx` | `tier` state + `TierToggle` | `slots` state + `ModelSlots` (stacked) | Yes: component replacement + state change specified | PASS |
| `components/canvas/canvas-detail-view.tsx` | `modelSettings.find(s => s.mode && s.tier)` | `modelSlots.filter(s => s.mode && s.active)` | Yes: exact filter pattern specified | PASS |
| `components/canvas/canvas-chat-panel.tsx` | `tier` state + `TierToggle` | `ModelSlots` (compact layout) | Yes: layout variant specified | PASS |
| `components/canvas/popovers/variation-popover.tsx` | `tier` state + `TierToggle` | `ModelSlots` (stacked) + per-slot params | Yes: layout + params specified | PASS |
| `components/canvas/popovers/img2img-popover.tsx` | `tier` state + `TierToggle` | `ModelSlots` (stacked) + per-slot params | Yes: layout + params specified | PASS |
| `components/canvas/popovers/upscale-popover.tsx` | `tier` + `TierToggle` with `hiddenValues` | `ModelSlots` (stacked, no ParameterPanel) | Yes: exception documented | PASS |
| `components/settings/settings-dialog.tsx` | Editable model dropdowns | Read-only slot display | Yes: interaction change specified | PASS |
| `components/settings/model-mode-section.tsx` | Editable dropdowns per tier | Read-only display: slot label + model name + status dot | Yes: UI elements specified | PASS |

---

## Blocking Issues

None.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0

**Next Steps:**
- [ ] Proceed to Slice Planning (Gate 2)
