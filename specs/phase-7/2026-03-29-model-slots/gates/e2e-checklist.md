# E2E Checklist: Model Slots

**Integration Map:** `integration-map.md`
**Generated:** 2026-03-29

---

## Pre-Conditions

- [x] All 16 slices APPROVED (Gate 2)
- [x] Architecture APPROVED (Gate 1)
- [x] Integration Map has no MISSING INPUTS (0 gaps)

---

## Happy Path Tests

### Flow 1: Quick Model Switch (Discovery Flow 1)

**Slices involved:** 01, 02, 03, 04, 05, 06, 08

1. [ ] **Slice 01:** `model_slots` table exists with 15 seed rows
2. [ ] **Slice 08:** Workspace renders `ModelSlots` (stacked) instead of `TierToggle`
3. [ ] **Slice 06:** Slot 1 shows current model name in dropdown
4. [ ] **Slice 06:** User opens Slot 1 dropdown and selects a different model
5. [ ] **Slice 05:** `updateModelSlot` server action is called with correct mode, slot, modelId
6. [ ] **Slice 04:** `ModelSlotService.update()` validates compatibility and upserts
7. [ ] **Slice 02:** `upsertModelSlot()` persists to DB
8. [ ] **Slice 06:** Slot 1 displays new model name after update
9. [ ] **Slice 06:** `"model-slots-changed"` event is dispatched
10. [ ] **Slice 08:** After page reload, Slot 1 still shows the changed model (DB persistence)

### Flow 2: Multi-Model Comparison (Discovery Flow 2)

**Slices involved:** 01, 02, 03, 05, 06, 08

1. [ ] **Slice 08:** Workspace shows Slot 1 active with "Flux Schnell"
2. [ ] **Slice 06:** User activates Slot 2 checkbox (Slot 2 has "Flux Pro" pre-assigned)
3. [ ] **Slice 05:** `toggleSlotActive` server action is called
4. [ ] **Slice 04:** min-1 rule passes (2 active slots)
5. [ ] **Slice 08:** User sets Variant Count to 2
6. [ ] **Slice 08:** User clicks "Generate"
7. [ ] **Slice 03:** `resolveActiveSlots(slots, "txt2img")` returns 2 entries
8. [ ] **Slice 08:** `generateImages({ modelIds: ["flux-schnell", "flux-2-pro"], count: 2 })` is called
9. [ ] **Existing:** GenerationService creates 4 images (2 models x 2 variants)
10. [ ] **Existing:** Images appear in Canvas with model labels

### Flow 3: Mode Switch Preserves Config (Discovery Flow 3)

**Slices involved:** 02, 05, 08

1. [ ] **Slice 08:** User is in `txt2img` mode with Slot 1 + Slot 2 active
2. [ ] **Slice 08:** User switches to `img2img` mode
3. [ ] **Slice 05:** `getModelSlots()` loads img2img-specific slots from DB
4. [ ] **Slice 08:** ModelSlots shows img2img slot configuration
5. [ ] **Slice 08:** User switches back to `txt2img`
6. [ ] **Slice 05:** `getModelSlots()` loads txt2img slots
7. [ ] **Slice 08:** Previous txt2img configuration is restored (Slot 1 + Slot 2 active)

### Flow 4: New Model Setup with Auto-Activation (Discovery Flow 4)

**Slices involved:** 04, 05, 06, 08

1. [ ] **Slice 06:** Slot 3 is empty ("select model" placeholder), checkbox disabled
2. [ ] **Slice 06:** User opens Slot 3 dropdown and selects a model
3. [ ] **Slice 05:** `updateModelSlot` is called
4. [ ] **Slice 04:** Auto-activation triggers (empty slot -> model assigned -> active=true)
5. [ ] **Slice 06:** Slot 3 checkbox becomes checked automatically
6. [ ] **Slice 08:** Next Generate sends 3 modelIds (all 3 slots active)

### Flow 5: Variation Popover with Slots (Canvas)

**Slices involved:** 06, 09, 12

1. [ ] **Slice 12:** User selects an image in Canvas, opens Variation popover
2. [ ] **Slice 09:** Variation popover shows `ModelSlots` (stacked) instead of `TierToggle`
3. [ ] **Slice 09:** Per-slot ParameterPanel is visible for active slots
4. [ ] **Slice 09:** Count button group (1-4) is visible and functional
5. [ ] **Slice 09:** User clicks "Generate"
6. [ ] **Slice 12:** `handleVariationGenerate` uses `params.modelIds` (not tier-based lookup)
7. [ ] **Existing:** Variation is generated and appears in Canvas

### Flow 6: Img2img Popover with Slots (Canvas)

**Slices involved:** 06, 10, 12

1. [ ] **Slice 12:** User opens Img2img popover from Canvas
2. [ ] **Slice 10:** Img2img popover shows `ModelSlots` (stacked) with `mode="img2img"`
3. [ ] **Slice 10:** Variants stepper is above ModelSlots
4. [ ] **Slice 10:** Per-slot ParameterPanel visible for active slots
5. [ ] **Slice 10:** User clicks "Generate"
6. [ ] **Slice 12:** `handleImg2imgGenerate` uses `params.modelIds`
7. [ ] **Existing:** Img2img generation completes

### Flow 7: Upscale Popover with Slots (Canvas)

**Slices involved:** 06, 11, 12

1. [ ] **Slice 12:** User opens Upscale popover from Canvas
2. [ ] **Slice 11:** Upscale popover shows `ModelSlots` (stacked) WITHOUT ParameterPanels
3. [ ] **Slice 11:** Scale buttons (2x, 4x) are visible
4. [ ] **Slice 11:** User clicks "4x Upscale"
5. [ ] **Slice 12:** `handleUpscale` uses `params.modelIds[0]` and resolves modelParams from slots
6. [ ] **Existing:** Upscale completes

### Flow 8: Chat Panel with Compact Slots

**Slices involved:** 07, 13

1. [ ] **Slice 13:** Chat Panel renders `ModelSlots` (compact) instead of `TierToggle`
2. [ ] **Slice 07:** Compact layout shows all 3 slots horizontally in one row
3. [ ] **Slice 07:** Model names are truncated in dropdown triggers
4. [ ] **Slice 13:** No ParameterPanel visible (compact mode)
5. [ ] **Slice 13:** Slots remain interactive during AI streaming
6. [ ] **Slice 13:** Slots become disabled only during image generation
7. [ ] **Slice 13:** `buildImageContext` uses active slot model IDs

### Flow 9: Settings Read-Only Display

**Slices involved:** 05, 14

1. [ ] **Slice 14:** Settings dialog opens and calls `getModelSlots()`
2. [ ] **Slice 14:** All 5 modes shown with 3 slots each (15 total)
3. [ ] **Slice 14:** Active slots show green status dot + "on"
4. [ ] **Slice 14:** Inactive slots show gray status dot + "off"
5. [ ] **Slice 14:** Empty slots show "not assigned" text
6. [ ] **Slice 14:** No dropdowns, checkboxes, or edit controls present
7. [ ] **Slice 14:** Hint text "Change models in the workspace." visible
8. [ ] **Slice 14:** Sync button works and refreshes slot display afterward

### Flow 10: Legacy Cleanup Verification

**Slices involved:** 15

1. [ ] **Slice 15:** `components/ui/tier-toggle.tsx` does not exist
2. [ ] **Slice 15:** `components/ui/max-quality-toggle.tsx` does not exist
3. [ ] **Slice 15:** `lib/services/model-settings-service.ts` does not exist
4. [ ] **Slice 15:** `app/actions/model-settings.ts` does not exist
5. [ ] **Slice 15:** `lib/types.ts` does not export `Tier`, `VALID_TIERS`, `UpdateModelSettingInput`
6. [ ] **Slice 15:** grep for `TierToggle`, `tier-toggle`, `model-settings-service`, `VALID_TIERS`, `model-settings-changed` returns 0 matches in ts/tsx
7. [ ] **Slice 15:** `pnpm tsc --noEmit` compiles without errors

---

## Edge Cases

### Error Handling

- [ ] `updateModelSlot` with incompatible model returns `{ error: "Model not compatible with mode" }` and slot stays unchanged (Slice 04 AC-5)
- [ ] `toggleSlotActive` on last active slot returns `{ error: "Cannot deactivate last active slot" }` (Slice 04 AC-9)
- [ ] `toggleSlotActive` on empty slot returns `{ error: "Cannot activate empty slot" }` (Slice 04 AC-10)
- [ ] `updateModelSlot` with invalid modelId format returns `{ error: "Invalid model ID format" }` (Slice 05 AC-6)
- [ ] `updateModelSlot` with invalid slot (5) returns `{ error: "Invalid slot number" }` (Slice 05 AC-5)
- [ ] `updateModelSlot` with invalid mode returns `{ error: "Invalid generation mode" }` (Slice 05 AC-4)
- [ ] Unauthenticated call to any server action returns `{ error: "Unauthorized" }` (Slice 05 AC-1, AC-10)

### State Transitions

- [ ] Active + Model -> toggle off (not last) -> Inactive + Model (Slice 06 AC-3)
- [ ] Active + Model (last) -> toggle off -> stays Active (min-1 rule) (Slice 06 AC-2)
- [ ] Inactive + No Model -> select model -> Active + Model (auto-activate) (Slice 06 AC-5)
- [ ] txt2img mode -> img2img mode -> txt2img mode (round-trip preserves config) (Slice 08 AC-8)

### Boundary Conditions

- [ ] DB: INSERT with slot=4 is rejected by CHECK constraint (Slice 01 AC-6)
- [ ] DB: Duplicate (mode, slot) INSERT rejected by UNIQUE constraint (Slice 01 AC-7)
- [ ] `resolveActiveSlots` with no active slots returns empty array (Slice 03 AC-5)
- [ ] `resolveActiveSlots` skips active slots with null modelId (Slice 03 AC-6)
- [ ] `resolveActiveSlots` normalizes null modelParams to `{}` (Slice 03 AC-7)
- [ ] `seedModelSlotDefaults` is idempotent (running twice produces same 15 rows) (Slice 02 AC-6)
- [ ] Unknown model (not in catalog) is allowed in update (fallback: permit) (Slice 04 AC-6)
- [ ] Disabled prop disables all checkboxes and dropdowns in ModelSlots (Slice 06 AC-12)

---

## Cross-Slice Integration Points

| # | Integration Point | Slices | How to Verify |
|---|-------------------|--------|---------------|
| 1 | Schema -> Queries | 01 -> 02 | `modelSlots` import in queries.ts compiles; query functions operate on model_slots table |
| 2 | Queries -> Types | 02 -> 03 | `ModelSlot` type import in resolve-model.ts compiles |
| 3 | Types -> Service | 03 -> 04 | `SlotNumber` type used in service method signatures compiles |
| 4 | Service -> Actions | 04 -> 05 | Server actions delegate to service methods; error propagation works |
| 5 | Actions -> UI Component | 05 -> 06 | ModelSlots calls server actions on dropdown change / checkbox toggle |
| 6 | UI Stacked -> UI Compact | 06 -> 07 | Compact variant renders from same component file; all shared logic works |
| 7 | UI -> Workspace | 06 -> 08 | ModelSlots renders in prompt-area; Generate collects modelIds from resolveActiveSlots |
| 8 | UI -> Popovers | 06 -> 09/10/11 | ModelSlots renders in all 3 popovers with correct mode |
| 9 | Popovers -> Detail View | 09/10/11 -> 12 | canvas-detail-view passes modelSlots+models to popovers; handlers use modelIds from params |
| 10 | Compact -> Chat Panel | 07 -> 13 | Compact ModelSlots renders in chat panel; slots interactive during streaming |
| 11 | Chat Panel -> Detail View | 13 -> 12/13 | canvas-detail-view passes modelSlots+models to ChatPanel (Slice 13 2nd deliverable) |
| 12 | Actions -> Settings | 05 -> 14 | Settings dialog loads slots via getModelSlots; read-only display |
| 13 | All -> Cleanup | 08-14 -> 15 | Legacy code removed; tsc compiles; grep returns 0 legacy matches |
| 14 | Cleanup -> E2E | 15 -> 16 | All flows work end-to-end against running app |
| 15 | Event propagation | 06 -> 08/12/14 | `"model-slots-changed"` event triggers slot reload in workspace, detail view, and settings |

---

## Sign-Off

| Tester | Date | Result |
|--------|------|--------|
| | | |

**Notes:**
- E2E tests (Slice 16) cover the 5 most critical cross-slice flows
- Flow 4 (auto-activation) is unit-tested in Slice 06 AC-5; E2E coverage is optional per compliance advisory
- Generierungs-Tests may use network interception instead of waiting for full API response (Replicate latency)
