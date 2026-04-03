# Integration Map: Model Slots

**Generated:** 2026-03-29
**Slices:** 16
**Connections:** 52

---

## Dependency Graph (Visual)

```
                    +--------------------------+
                    |  Slice 01: DB Schema     |
                    |  (Foundation)            |
                    +------------+-------------+
                                 |
                    +------------v-------------+
                    |  Slice 02: DB Queries    |
                    +---+--------+----------+--+
                        |        |          |
           +------------v--+  +--v--------+ |
           | Slice 03:     |  |           | |
           | Types+Resolve |  |           | |
           +--+-----+------+  |           | |
              |     |          |           | |
     +--------v-+ +-v---------v--+        | |
     |          | | Slice 04:    |        | |
     |          | | SlotService  |        | |
     |          | +------+-------+        | |
     |          |        |                | |
     |       +--v--------v-----+          | |
     |       | Slice 05:       |          | |
     |       | Server Actions  |          | |
     |       +--+-----------+--+          | |
     |          |           |             | |
     |  +-------v-------+  |   +---------v-v----------+
     |  | Slice 06:     |  |   | Slice 14:            |
     |  | UI Stacked    |  |   | Settings Read-Only   |
     |  +--+--+--+--+---+  |   +----------+-----------+
     |     |  |  |  |      |              |
     |     |  |  |  +------+----+----+    |
     |     |  |  |         |    |    |    |
     |  +--v--v  v------+  |  +-v--+ |   |
     |  |Slice|  |Slice | +v--v   | |   |
     |  | 08: |  | 09:  | |Sl.11| |   |
     |  |Wksp |  | Var  | |Upsc.| |   |
     |  +--+--+  +--+---+ +--+--+ |   |
     |     |        |        |     |   |
     |     |  +-----v--------v-----v---+
     |     |  | Slice 10: Img2img     |
     |     |  +-----------+-----------+
     |     |              |
  +--v-----v-----------+  |
  | Slice 07:          |  |
  | UI Compact         |  |
  +--------+-----------+  |
           |              |
  +--------v-----------+  |
  | Slice 13:          |  |
  | Chat Panel         |  |
  +--------+-----------+  |
           |              |
           |  +-----------v-----------+
           |  | Slice 12:             |
           |  | Canvas Detail View    |
           |  +-----------+-----------+
           |              |
           +---------+----+
                     |
          +----------v----------+
          | Slice 15:           |
          | Cleanup Legacy      |
          +----------+----------+
                     |
          +----------v----------+
          | Slice 16:           |
          | E2E Verification    |
          +---------------------+
```

---

## Nodes

### Slice 01: DB Schema + Migration

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None (foundation) |
| Outputs | modelSlots pgTable, model_slots DB Table, Seed Data |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| (none) | -- | First slice |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `modelSlots` pgTable | Drizzle Schema Export | Slice 02 |
| `model_slots` DB Table | SQL Table (15 rows) | Slice 02 |
| Seed Data (15 rows) | DB Rows | Slice 02, Slice 16 |

---

### Slice 02: DB Queries

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 01 |
| Outputs | 4 query functions, ModelSlot type |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `modelSlots` pgTable | Slice 01 | VALID |
| `model_slots` DB Table | Slice 01 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `getAllModelSlots()` | Async Query Function | Slice 04 |
| `getModelSlotsByMode(mode)` | Async Query Function | Slice 04 |
| `upsertModelSlot(...)` | Async Query Function | Slice 04 |
| `seedModelSlotDefaults()` | Async Query Function | Slice 04 |
| `ModelSlot` | Inferred Type Export | Slice 03, 04, 05, 06, 08, 09, 10, 11, 12, 13, 14 |

---

### Slice 03: Types + resolve-model Refactor

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 02 |
| Outputs | SlotNumber, VALID_SLOTS, resolveActiveSlots |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `ModelSlot` type | Slice 02 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `SlotNumber` | Type Export | Slice 04, 05, 06 |
| `VALID_SLOTS` | Const Export | Slice 05 |
| `resolveActiveSlots` | Pure Function | Slice 08, 09, 10, 11, 13 |

---

### Slice 04: ModelSlotService

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 02, Slice 03 |
| Outputs | ModelSlotService (5 methods) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `getAllModelSlots()` | Slice 02 | VALID |
| `getModelSlotsByMode()` | Slice 02 | VALID |
| `upsertModelSlot()` | Slice 02 | VALID |
| `seedModelSlotDefaults()` | Slice 02 | VALID |
| `getModelByReplicateId()` | Pre-existing (queries.ts) | VALID |
| `ModelSlot` | Slice 02 | VALID |
| `SlotNumber` | Slice 03 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ModelSlotService.getAll()` | Async Method | Slice 05 |
| `ModelSlotService.getForMode()` | Async Method | Slice 05 |
| `ModelSlotService.update()` | Async Method | Slice 05 |
| `ModelSlotService.toggleActive()` | Async Method | Slice 05 |
| `ModelSlotService.seedDefaults()` | Async Method | Slice 05 |

---

### Slice 05: Server Actions

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 04 |
| Outputs | 3 Server Actions, DELETE model-settings.ts |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `ModelSlotService.getAll()` | Slice 04 | VALID |
| `ModelSlotService.update()` | Slice 04 | VALID |
| `ModelSlotService.toggleActive()` | Slice 04 | VALID |
| `VALID_GENERATION_MODES` | Slice 03 (pre-existing) | VALID |
| `VALID_SLOTS` | Slice 03 | VALID |
| `ModelSlot` | Slice 02 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `getModelSlots()` | Server Action | Slice 06, 08, 12, 14 |
| `updateModelSlot()` | Server Action | Slice 06 |
| `toggleSlotActive()` | Server Action | Slice 06 |

---

### Slice 06: ModelSlots UI -- Stacked Layout

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 05 |
| Outputs | ModelSlots component, ModelSlotsProps |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `updateModelSlot()` | Slice 05 | VALID |
| `toggleSlotActive()` | Slice 05 | VALID |
| `getModelSlots()` | Slice 05 | VALID |
| `SlotNumber` | Slice 03 | VALID |
| `GenerationMode` | Pre-existing (Slice 03 preserves) | VALID |
| `ModelSlot` | Slice 02 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ModelSlots` | React Component | Slice 07, 08, 09, 10, 11 |
| `ModelSlotsProps` | TypeScript Interface | Slice 07, 08, 09, 10, 11 |

---

### Slice 07: ModelSlots UI -- Compact Layout

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 06 |
| Outputs | ModelSlots (compact-capable) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `ModelSlots` component | Slice 06 | VALID |
| `ModelSlotsProps` | Slice 06 | VALID |
| `updateModelSlot()` | Slice 05 | VALID |
| `toggleSlotActive()` | Slice 05 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ModelSlots` (compact) | React Component | Slice 13 |

---

### Slice 08: Workspace Integration

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 06 |
| Outputs | prompt-area.tsx (rebuilt) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `ModelSlots` | Slice 06 | VALID |
| `ModelSlotsProps` | Slice 06 | VALID |
| `getModelSlots()` | Slice 05 | VALID |
| `resolveActiveSlots()` | Slice 03 | VALID |
| `ModelSlot` | Slice 02 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `prompt-area.tsx` (rebuilt) | React Component | Slice 15 (cleanup reference), Slice 16 (E2E) |

---

### Slice 09: Variation Popover

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 06 |
| Outputs | VariationParams (updated), VariationPopoverProps (updated) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `ModelSlots` | Slice 06 | VALID |
| `ModelSlotsProps` | Slice 06 | VALID |
| `resolveActiveSlots()` | Slice 03 | VALID |
| `ModelSlot` | Slice 02 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `VariationParams` (updated) | TypeScript Interface | Slice 12 |
| `VariationPopoverProps` (updated) | TypeScript Interface | Slice 12 |

---

### Slice 10: Img2img Popover

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 06 |
| Outputs | Img2imgParams (updated), Img2imgPopoverProps (updated) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `ModelSlots` | Slice 06 | VALID |
| `ModelSlotsProps` | Slice 06 | VALID |
| `resolveActiveSlots()` | Slice 03 | VALID |
| `ModelSlot` | Slice 02 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `Img2imgParams` (updated) | TypeScript Interface | Slice 12 |
| `Img2imgPopoverProps` (updated) | TypeScript Interface | Slice 12 |

---

### Slice 11: Upscale Popover

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 06 |
| Outputs | UpscalePopoverProps (updated), onUpscale callback (updated) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `ModelSlots` | Slice 06 | VALID |
| `ModelSlotsProps` | Slice 06 | VALID |
| `resolveActiveSlots()` | Slice 03 | VALID |
| `ModelSlot` | Slice 02 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `UpscalePopoverProps` (updated) | TypeScript Interface | Slice 12 |
| `onUpscale` callback (updated) | Function Signature | Slice 12 |

---

### Slice 12: Canvas Detail View

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 05, Slice 09, Slice 10, Slice 11 |
| Outputs | canvas-detail-view.tsx (migrated) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `getModelSlots()` | Slice 05 | VALID |
| `ModelSlot` | Slice 02 | VALID |
| `VariationPopover` (updated) | Slice 09 | VALID |
| `VariationParams` (updated) | Slice 09 | VALID |
| `Img2imgPopover` (updated) | Slice 10 | VALID |
| `Img2imgParams` (updated) | Slice 10 | VALID |
| `UpscalePopover` (updated) | Slice 11 | VALID |
| `onUpscale` callback (updated) | Slice 11 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Canvas Detail View (migrated) | React Component | Slice 13 (ChatPanel props), Slice 15 (cleanup) |

---

### Slice 13: Chat Panel

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 07 |
| Outputs | CanvasChatPanel (migrated) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `ModelSlots` (compact) | Slice 07 | VALID |
| `updateModelSlot()` | Slice 05 (via ModelSlots) | VALID |
| `toggleSlotActive()` | Slice 05 (via ModelSlots) | VALID |
| `ModelSlot` | Slice 02 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `CanvasChatPanel` (migrated) | React Component | Slice 15 (cleanup) |

**Note:** Slice 13 also modifies `canvas-detail-view.tsx` (second deliverable) to update ChatPanel props from `modelSettings` to `modelSlots` + `models`.

---

### Slice 14: Settings Read-Only

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 05 |
| Outputs | SettingsDialog (read-only), ModelModeSection (read-only) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `getModelSlots()` | Slice 05 | VALID |
| `ModelSlot` | Slice 02 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `SettingsDialog` (read-only) | React Component | Slice 15 (event cleanup), Slice 16 (E2E) |
| `ModelModeSection` (read-only) | React Component | SettingsDialog (internal) |

---

### Slice 15: Cleanup Legacy

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 08, 09, 10, 11, 12, 13, 14 |
| Outputs | Clean codebase (0 legacy references) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `prompt-area.tsx` (rebuilt) | Slice 08 | VALID |
| `variation-popover.tsx` (with legacy path) | Slice 09 | VALID |
| `img2img-popover.tsx` (with legacy path) | Slice 10 | VALID |
| `upscale-popover.tsx` (with legacy path) | Slice 11 | VALID |
| `canvas-detail-view.tsx` (migrated) | Slice 12 | VALID |
| `canvas-chat-panel.tsx` (migrated) | Slice 13 | VALID |
| `settings-dialog.tsx` (read-only) | Slice 14 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Clean codebase | Verification artifact | Slice 16 |

---

### Slice 16: E2E Flow Verification

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 15 |
| Outputs | E2E test suite (5 tests) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| Clean codebase | Slice 15 | VALID |
| `model_slots` table (15 seed rows) | Slice 01 | VALID |
| `ModelSlots` component (stacked) | Slice 06 | VALID |
| `prompt-area.tsx` (multi-model generate) | Slice 08 | VALID |
| `variation-popover.tsx` (with ModelSlots) | Slice 09 | VALID |
| `settings-dialog.tsx` (read-only) | Slice 14 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| E2E test execution | Final verification | None (terminal slice) |

---

## Connections

| # | From | To | Resource | Type | Status |
|---|------|----|----------|------|--------|
| 1 | Slice 01 | Slice 02 | `modelSlots` pgTable | Drizzle Schema | VALID |
| 2 | Slice 01 | Slice 02 | `model_slots` DB Table | SQL Table | VALID |
| 3 | Slice 02 | Slice 03 | `ModelSlot` type | Inferred Type | VALID |
| 4 | Slice 02 | Slice 04 | `getAllModelSlots()` | Query Function | VALID |
| 5 | Slice 02 | Slice 04 | `getModelSlotsByMode()` | Query Function | VALID |
| 6 | Slice 02 | Slice 04 | `upsertModelSlot()` | Query Function | VALID |
| 7 | Slice 02 | Slice 04 | `seedModelSlotDefaults()` | Query Function | VALID |
| 8 | Slice 02 | Slice 04 | `ModelSlot` type | Inferred Type | VALID |
| 9 | Slice 03 | Slice 04 | `SlotNumber` | Type Export | VALID |
| 10 | Slice 04 | Slice 05 | `ModelSlotService.getAll()` | Async Method | VALID |
| 11 | Slice 04 | Slice 05 | `ModelSlotService.update()` | Async Method | VALID |
| 12 | Slice 04 | Slice 05 | `ModelSlotService.toggleActive()` | Async Method | VALID |
| 13 | Slice 03 | Slice 05 | `VALID_GENERATION_MODES` | Const Export | VALID |
| 14 | Slice 03 | Slice 05 | `VALID_SLOTS` | Const Export | VALID |
| 15 | Slice 02 | Slice 05 | `ModelSlot` type | Inferred Type | VALID |
| 16 | Slice 05 | Slice 06 | `updateModelSlot()` | Server Action | VALID |
| 17 | Slice 05 | Slice 06 | `toggleSlotActive()` | Server Action | VALID |
| 18 | Slice 05 | Slice 06 | `getModelSlots()` | Server Action | VALID |
| 19 | Slice 03 | Slice 06 | `SlotNumber` | Type Export | VALID |
| 20 | Slice 03 | Slice 06 | `GenerationMode` | Type Export | VALID |
| 21 | Slice 02 | Slice 06 | `ModelSlot` type | Inferred Type | VALID |
| 22 | Slice 06 | Slice 07 | `ModelSlots` component | React Component | VALID |
| 23 | Slice 06 | Slice 07 | `ModelSlotsProps` | TypeScript Interface | VALID |
| 24 | Slice 05 | Slice 07 | `updateModelSlot()` | Server Action | VALID |
| 25 | Slice 05 | Slice 07 | `toggleSlotActive()` | Server Action | VALID |
| 26 | Slice 06 | Slice 08 | `ModelSlots` component | React Component | VALID |
| 27 | Slice 05 | Slice 08 | `getModelSlots()` | Server Action | VALID |
| 28 | Slice 03 | Slice 08 | `resolveActiveSlots()` | Pure Function | VALID |
| 29 | Slice 02 | Slice 08 | `ModelSlot` type | Inferred Type | VALID |
| 30 | Slice 06 | Slice 09 | `ModelSlots` component | React Component | VALID |
| 31 | Slice 03 | Slice 09 | `resolveActiveSlots()` | Pure Function | VALID |
| 32 | Slice 02 | Slice 09 | `ModelSlot` type | Inferred Type | VALID |
| 33 | Slice 06 | Slice 10 | `ModelSlots` component | React Component | VALID |
| 34 | Slice 03 | Slice 10 | `resolveActiveSlots()` | Pure Function | VALID |
| 35 | Slice 02 | Slice 10 | `ModelSlot` type | Inferred Type | VALID |
| 36 | Slice 06 | Slice 11 | `ModelSlots` component | React Component | VALID |
| 37 | Slice 03 | Slice 11 | `resolveActiveSlots()` | Pure Function | VALID |
| 38 | Slice 02 | Slice 11 | `ModelSlot` type | Inferred Type | VALID |
| 39 | Slice 05 | Slice 12 | `getModelSlots()` | Server Action | VALID |
| 40 | Slice 02 | Slice 12 | `ModelSlot` type | Inferred Type | VALID |
| 41 | Slice 09 | Slice 12 | `VariationPopover` (updated) | React Component | VALID |
| 42 | Slice 09 | Slice 12 | `VariationParams` (updated) | Interface | VALID |
| 43 | Slice 10 | Slice 12 | `Img2imgPopover` (updated) | React Component | VALID |
| 44 | Slice 10 | Slice 12 | `Img2imgParams` (updated) | Interface | VALID |
| 45 | Slice 11 | Slice 12 | `UpscalePopover` (updated) | React Component | VALID |
| 46 | Slice 11 | Slice 12 | `onUpscale` callback (updated) | Function Sig | VALID |
| 47 | Slice 07 | Slice 13 | `ModelSlots` (compact) | React Component | VALID |
| 48 | Slice 02 | Slice 13 | `ModelSlot` type | Inferred Type | VALID |
| 49 | Slice 05 | Slice 14 | `getModelSlots()` | Server Action | VALID |
| 50 | Slice 02 | Slice 14 | `ModelSlot` type | Inferred Type | VALID |
| 51 | Slice 08-14 | Slice 15 | Modified files (7 slices) | Cleanup refs | VALID |
| 52 | Slice 15 | Slice 16 | Clean codebase | Verification | VALID |

---

## Validation Results

### VALID Connections: 52

All declared dependencies have matching outputs from prior slices.

### Orphaned Outputs: 0

No orphaned outputs detected. All outputs are consumed by at least one downstream slice or are final user-facing deliverables.

### Missing Inputs: 0

All input dependencies have matching outputs from upstream slices.

### Deliverable-Consumer Gaps: 0

All components created in one slice have identified mount points in consumer slices:

| Component | Defined In | Consumer Page | Page In Deliverables? | Status |
|-----------|------------|---------------|-----------------------|--------|
| `ModelSlots` | Slice 06 | `prompt-area.tsx` | Slice 08 MODIFY | VALID |
| `ModelSlots` | Slice 06 | `variation-popover.tsx` | Slice 09 MODIFY | VALID |
| `ModelSlots` | Slice 06 | `img2img-popover.tsx` | Slice 10 MODIFY | VALID |
| `ModelSlots` | Slice 06 | `upscale-popover.tsx` | Slice 11 MODIFY | VALID |
| `ModelSlots` (compact) | Slice 07 | `canvas-chat-panel.tsx` | Slice 13 MODIFY | VALID |
| `CanvasChatPanel` (migrated) | Slice 13 | `canvas-detail-view.tsx` | Slice 13 MODIFY (2nd deliverable) | VALID |

### Runtime Path Gaps: 0

All user flows have complete call chains:

| User Flow | Chain | Status |
|-----------|-------|--------|
| Quick Model Switch | UI (ModelSlots dropdown) -> Server Action (updateModelSlot) -> Service (ModelSlotService.update) -> Query (upsertModelSlot) -> DB | VALID |
| Multi-Model Generate | UI (Generate) -> resolveActiveSlots() -> generateImages({modelIds}) -> GenerationService (existing, unchanged) | VALID |
| Mode Switch | UI (mode change) -> getModelSlots() -> DB (mode-specific slots) -> UI (re-render) | VALID |
| Slot Toggle | UI (Checkbox) -> Server Action (toggleSlotActive) -> Service (toggleActive, min-1 check) -> Query (upsert) -> DB | VALID |
| Settings Read-Only | UI (open dialog) -> getModelSlots() -> Read-only display | VALID |

### Semantic Consistency Gaps: 0

**MODIFY-Chain Analysis:**

| File | Modified By | Methods Added | Status |
|------|------------|---------------|--------|
| `components/ui/model-slots.tsx` | Slice 06 (NEW), Slice 07 (MODIFY compact branch) | Stacked layout (Slice 06), Compact layout (Slice 07) | VALID -- Slice 07 extends same file without conflict |
| `lib/types.ts` | Slice 03 (MODIFY: add SlotNumber/VALID_SLOTS, remove Tier/VALID_TIERS), Slice 15 (MODIFY: final cleanup of remaining Tier refs) | SlotNumber, VALID_SLOTS | VALID -- Slice 03 adds, Slice 15 confirms cleanup |
| `canvas-detail-view.tsx` | Slice 12 (MODIFY: migrate to slots), Slice 13 (MODIFY: update ChatPanel props) | slot-based handlers (Slice 12), ChatPanel props update (Slice 13) | VALID -- Slice 13 explicitly lists canvas-detail-view.tsx as 2nd deliverable |
| `variation-popover.tsx` | Slice 09 (MODIFY: add new path + legacy), Slice 15 (MODIFY: remove legacy) | New slot path (Slice 09), cleanup (Slice 15) | VALID -- Slice 15 depends on Slice 09 |
| `img2img-popover.tsx` | Slice 10 (MODIFY: add new path + legacy), Slice 15 (MODIFY: remove legacy) | New slot path (Slice 10), cleanup (Slice 15) | VALID -- Slice 15 depends on Slice 10 |
| `upscale-popover.tsx` | Slice 11 (MODIFY: add new path + legacy), Slice 15 (MODIFY: remove legacy) | New slot path (Slice 11), cleanup (Slice 15) | VALID -- Slice 15 depends on Slice 11 |
| `settings-dialog.tsx` | Slice 14 (MODIFY: read-only), Slice 15 (MODIFY: event cleanup) | Read-only UI (Slice 14), event name cleanup (Slice 15) | VALID -- Slice 15 depends on Slice 14 |

**Wrapper/Extension Feasibility:** No wrapper/extension patterns detected across slices. All modifications are direct file changes with clear ownership.

**Return-Type Consistency:**

| Provider | Method | Return Type | Consumers | Call Patterns | Status |
|----------|--------|-------------|-----------|---------------|--------|
| Slice 03 | `resolveActiveSlots()` | `{modelId, modelParams}[]` | Slice 08, 09, 10, 11, 13 | `.map(r => r.modelId)` for modelIds array | VALID -- all consumers extract modelId from array elements |
| Slice 04 | `ModelSlotService.update()` | `ModelSlot \| {error}` | Slice 05 | Return forwarded to UI | VALID |
| Slice 04 | `ModelSlotService.toggleActive()` | `ModelSlot \| {error}` | Slice 05 | Return forwarded to UI | VALID |

---

## Discovery Traceability

### UI Components Coverage

| Discovery Element | Type | Location | Covered In | Status |
|-------------------|------|----------|------------|--------|
| 3 Model Slots (Checkbox + Dropdown) | Component | Workspace | Slice 06 | VALID |
| Model Slots (Stacked layout) | Layout variant | Workspace, Popovers | Slice 06 | VALID |
| Model Slots (Compact layout) | Layout variant | Chat Panel | Slice 07 | VALID |
| Per-Slot ParameterPanel | Sub-component | Active slots (stacked) | Slice 06 (AC-7) | VALID |
| Variant-Count Stepper | Control | Workspace, Img2img | Slice 08 (AC-9), Slice 10 (AC-6) | VALID |
| Variant-Count Button Group | Control | Variation Popover | Slice 09 (AC-6) | VALID |
| Scale Buttons (2x/4x) | Control | Upscale Popover | Slice 11 (AC-2, AC-3) | VALID |
| Settings Read-Only Display | Component | Settings Dialog | Slice 14 | VALID |
| Status Dot (active/inactive) | Visual | Settings Dialog | Slice 14 (AC-2, AC-3) | VALID |
| Hint Text "Change models in workspace" | Text | Settings Dialog | Slice 14 (AC-6) | VALID |

### State Machine Coverage

| State | Required UI | Available Actions | Covered In | Status |
|-------|-------------|-------------------|------------|--------|
| Active + Model set | Checked checkbox + Model name | Toggle off, Change model, Generate | Slice 06 (AC-1, AC-3) | VALID |
| Inactive + Model set | Unchecked checkbox + Grayed model | Toggle on | Slice 06 (AC-1, AC-8) | VALID |
| Inactive + No model | Disabled checkbox + Placeholder | Select model (auto-activates) | Slice 06 (AC-4, AC-5) | VALID |
| Loading | Skeleton placeholder | Wait | Slice 06 (via ModelSlots rendering) | VALID |
| Streaming (Chat) | Slots remain interactive | Toggle, Change model | Slice 13 (AC-6) | VALID |
| Generating | All controls disabled | Wait | Slice 06 (AC-12), Slice 08 (AC-10) | VALID |

### Transitions Coverage

| From | Trigger | To | Covered In | Status |
|------|---------|-----|------------|--------|
| Inactive+Model | Checkbox toggle on | Active+Model | Slice 06 (AC-3 reverse) | VALID |
| Active+Model | Checkbox toggle off (not last) | Inactive+Model | Slice 06 (AC-3) | VALID |
| Active+Model (last) | Checkbox toggle off | Active+Model (prevented) | Slice 06 (AC-2) | VALID |
| Inactive+NoModel | Dropdown select model | Active+Model (auto-activate) | Slice 06 (AC-5) | VALID |
| Active+Model | Dropdown change model | Active+NewModel | Slice 06 (via ModelSlots) | VALID |
| Any (txt2img) | Mode switch to img2img | Any (img2img slots loaded) | Slice 08 (AC-8) | VALID |
| Any (img2img) | Mode switch to txt2img | Any (txt2img slots restored) | Slice 08 (AC-8), Slice 16 (AC-3) | VALID |

### Business Rules Coverage

| Rule | Covered In | Status |
|------|------------|--------|
| Min 1 active slot per mode | Slice 04 (AC-9), Slice 06 (AC-2) | VALID |
| Max 3 slots (fixed) | DB CHECK constraint Slice 01 (AC-6) | VALID |
| Only compatible models in dropdown | Slice 04 (AC-5), Slice 06 (AC-6) | VALID |
| Auto-activate on model assignment to empty slot | Slice 04 (AC-7), Slice 06 (AC-5) | VALID |
| Cannot activate empty slot | Slice 04 (AC-10), Slice 06 (AC-4) | VALID |
| Mode-specific slot config | Slice 02 (AC-2), Slice 08 (AC-8) | VALID |
| Duplicate model in 2 slots allowed | No explicit prevention = allowed by default | VALID |
| Varianten pro Model: 2 slots x 3 variants = 6 images | Slice 08 (AC-9) | VALID |
| Per-slot parameters (schema-based) | Slice 06 (AC-7) | VALID |
| Chat Panel: no ParameterPanel | Slice 07 (AC-3), Slice 13 (AC-3) | VALID |
| Upscale: no ParameterPanel, direct action buttons | Slice 11 (AC-1) | VALID |
| Settings: read-only display | Slice 14 (AC-5) | VALID |
| modelId regex validation | Slice 05 (AC-6) | VALID |
| Slot without model: checkbox disabled | Slice 06 (AC-4) | VALID |

### Data Fields Coverage

| Field | Required | Covered In | Status |
|-------|----------|------------|--------|
| model_slots.id (uuid PK) | Yes | Slice 01 (AC-1) | VALID |
| model_slots.mode (varchar) | Yes | Slice 01 (AC-1) | VALID |
| model_slots.slot (integer, CHECK 1-3) | Yes | Slice 01 (AC-1, AC-6) | VALID |
| model_slots.model_id (varchar, nullable) | Yes | Slice 01 (AC-1) | VALID |
| model_slots.model_params (jsonb) | Yes | Slice 01 (AC-1) | VALID |
| model_slots.active (boolean) | Yes | Slice 01 (AC-1) | VALID |
| model_slots.created_at (timestamptz) | Yes | Slice 01 (AC-1) | VALID |
| model_slots.updated_at (timestamptz) | Yes | Slice 01 (AC-1) | VALID |
| UNIQUE(mode, slot) | Yes | Slice 01 (AC-1, AC-7) | VALID |
| SlotNumber = 1 \| 2 \| 3 | Yes | Slice 03 (AC-1) | VALID |
| VALID_SLOTS = [1, 2, 3] | Yes | Slice 03 (AC-1) | VALID |

**Discovery Coverage:** 38/38 (100%)

---

## Infrastructure Prerequisite Check

### Health Endpoint

No health endpoint route found in the codebase. Slice 16 (E2E) uses `http://localhost:3000` as the health check URL (Next.js dev server root). This is sufficient for a single-user application -- Playwright's `webServer` block will wait for the dev server to be ready by polling the root URL.

**Status:** No prerequisite needed. Next.js dev server root URL serves as implicit health check.

### Log Channels

No custom log channels referenced by any slice. Standard `console.error` / Next.js error handling used throughout.

**Status:** No prerequisite needed.

---

## Summary

| Metric | Value |
|--------|-------|
| Total Slices | 16 |
| Total Connections | 52 |
| Valid Connections | 52 |
| Orphaned Outputs | 0 |
| Missing Inputs | 0 |
| Deliverable-Consumer Gaps | 0 |
| Runtime Path Gaps | 0 |
| Semantic Consistency Gaps | 0 |
| Discovery Coverage | 100% (38/38) |

**VERDICT: READY FOR ORCHESTRATION**
