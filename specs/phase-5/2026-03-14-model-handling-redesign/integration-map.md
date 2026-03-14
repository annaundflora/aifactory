# Integration Map: Model Handling Redesign -- Draft/Quality Tier System

**Generated:** 2026-03-14
**Slices:** 13
**Connections:** 38

---

## Dependency Graph (Visual)

```
                          ┌──────────────────────┐
                          │  Slice 01            │
                          │  DB Schema+Migration │
                          └──────────┬───────────┘
                                     │
                          ┌──────────▼───────────┐
                          │  Slice 02            │
                          │  Model Settings Svc  │
                          └──────────┬───────────┘
                                     │
                          ┌──────────▼───────────┐
                          │  Slice 03            │
                          │  Server Actions+Types│
                          └──┬────────┬────────┬─┘
                             │        │        │
               ┌─────────────▼─┐  ┌──▼──────────────┐
               │  Slice 04     │  │  Slice 05        │
               │  Settings UI  │  │  Tier Toggle Comp│
               └───────────────┘  └──┬──────────┬────┘
                                     │          │
                          ┌──────────▼───┐  ┌───▼─────────────┐
                          │  Slice 06    │  │  Slice 08        │
                          │  WS Prompt   │  │  Canvas Context  │
                          │  Tier Toggle │  │  Cleanup         │
                          └──────┬───────┘  └──┬──────┬────┬───┘
                                 │             │      │    │
                          ┌──────▼───────┐  ┌──▼──┐ ┌─▼──┐ │
                          │  Slice 07    │  │ S09 │ │S10 │ │
                          │  WS Gen Integ│  │Var/ │ │Ups │ │
                          └──────────────┘  │I2I  │ │Tier│ │
                                 │          └──┬──┘ └─┬──┘ │
                                 │             │      │    │
                                 │             │      │  ┌─▼──────┐
                                 │             │      │  │ Slice 11│
                                 │             │      │  │ Chat    │
                                 │             │      │  │ Tier    │
                                 │             │      │  └──┬─────┘
                                 │             │      │     │
                                 │          ┌──▼──────▼─────▼──┐
                                 │          │  Slice 12         │
                                 │          │  Canvas Cleanup   │
                                 │          └────────┬──────────┘
                                 │                   │
                                 │          ┌────────▼──────────┐
                                 │          │  Slice 13         │
                                 │          │  Dead Code Cleanup│
                                 └─────────►│                   │
                                            └───────────────────┘
```

---

## Nodes

### Slice 01: DB Schema + Migration

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | modelSettings pgTable, model_settings DB-Tabelle, Seed-Daten (8 Eintraege) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| (none) | -- | First slice, no dependencies |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `modelSettings` pgTable | Drizzle pgTable | Slice 02 |
| `model_settings` DB-Tabelle | PostgreSQL Table | Slice 02, Slice 03 |
| Seed-Daten (8 Eintraege) | DB Rows | Slice 02, Slice 03 |

**Deliverables:**
- `lib/db/schema.ts` (EXISTING - Modify)
- `drizzle/0007_*.sql` (NEW)

---

### Slice 02: Model Settings Service

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 01 |
| Outputs | Query Functions (4), ModelSettingsService, ModelSetting Type |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `modelSettings` pgTable | Slice 01 | Import from `lib/db/schema.ts` |
| Seed-Daten | Slice 01 | Reference values for seedDefaults() |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `getAllModelSettings` | Query Function | Slice 03 |
| `getModelSettingByModeTier` | Query Function | Slice 03 |
| `upsertModelSetting` | Query Function | Slice 03 |
| `seedModelSettingsDefaults` | Query Function | Slice 03 |
| `ModelSettingsService` | Service Module | Slice 03 |
| `ModelSetting` Type | TypeAlias | Slice 03, 04, 06, 08 |

**Deliverables:**
- `lib/db/queries.ts` (EXISTING - Modify)
- `lib/services/model-settings-service.ts` (NEW)

---

### Slice 03: Server Actions + Types

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 02 |
| Outputs | Server Actions (2), Types (3) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `ModelSettingsService` | Slice 02 | .getAll(), .update() |
| `ModelSetting` Type | Slice 02 | typeof modelSettings.$inferSelect |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `getModelSettings` | Server Action | Slice 04, 06, 08 |
| `updateModelSetting` | Server Action | Slice 04 |
| `Tier` | Type | Slice 05, 06, 08, 09, 10, 11 |
| `GenerationMode` | Type | Slice 04, 07 |
| `UpdateModelSettingInput` | DTO Type | Slice 04 |

**Deliverables:**
- `app/actions/model-settings.ts` (NEW)
- `lib/types.ts` (NEW)

---

### Slice 04: Settings Dialog UI

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 03 |
| Outputs | SettingsDialog, ModelModeSection, Settings-Button in Header |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `getModelSettings` | Slice 03 | Server Action |
| `updateModelSetting` | Slice 03 | Server Action |
| `GenerationMode`, `Tier` | Slice 03 | Types |
| `CollectionModelService.getCollectionModels` | Existing | Service Function |
| `ModelSchemaService.supportsImg2Img` | Existing | Service Function |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `SettingsDialog` | React Component | Indirectly via WorkspaceHeader |
| `ModelModeSection` | React Component | Internal (SettingsDialog) |

**Deliverables:**
- `components/settings/settings-dialog.tsx` (NEW)
- `components/settings/model-mode-section.tsx` (NEW)
- `components/workspace/workspace-header.tsx` (EXISTING - Modify)

---

### Slice 05: Tier Toggle Component

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 03 |
| Outputs | TierToggle, MaxQualityToggle |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `Tier` Type | Slice 03 | `"draft" \| "quality" \| "max"` |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `TierToggle` | React Component | Slice 06, 09, 10, 11 |
| `MaxQualityToggle` | React Component | Slice 06, 09, 11 |

**Deliverables:**
- `components/ui/tier-toggle.tsx` (NEW)
- `components/ui/max-quality-toggle.tsx` (NEW)

---

### Slice 06: Workspace Prompt-Area Tier Toggle

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 05 |
| Outputs | modelSettings/tier/maxQuality State, Bereinigte Prompt-Area |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `TierToggle` | Slice 05 | React Component |
| `MaxQualityToggle` | Slice 05 | React Component |
| `Tier` Type | Slice 03 | Type |
| `getModelSettings` | Slice 03 | Server Action |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `modelSettings` State | React State | Slice 07 |
| `tier` State | React State | Slice 07 |
| `maxQuality` State | React State | Slice 07 |
| Bereinigte Prompt-Area | Component | Slice 07, 12, 13 |

**Deliverables:**
- `components/workspace/prompt-area.tsx` (EXISTING - Modify)

---

### Slice 07: Workspace Generation Integration

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 06 |
| Outputs | Extended upscaleImage, Extended GenerationService.upscale, Model-Resolution Pattern |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `tier` State | Slice 06 | React State |
| `maxQuality` State | Slice 06 | React State |
| `modelSettings` State | Slice 06 | React State |
| `Tier`, `GenerationMode` | Slice 03 | Types |
| `generateImages` | Existing | Server Action |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `upscaleImage` (extended) | Server Action | Slice 10 |
| `GenerationService.upscale` (extended) | Service Function | Internal |
| Model-Resolution Pattern | Logic Pattern | Slice 09, 10, 11 |

**Deliverables:**
- `components/workspace/prompt-area.tsx` (EXISTING - Modify)
- `app/actions/generations.ts` (EXISTING - Modify)
- `lib/services/generation-service.ts` (EXISTING - Modify)

---

### Slice 08: Canvas Context Cleanup

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 05 |
| Outputs | modelSettings State (canvas), Bereinigte CanvasDetailState/Action, Model-Resolution Pattern |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `getModelSettings` | Slice 03 | Server Action |
| `Tier` Type | Slice 03 | Type |
| `ModelSetting` Type | Slice 02 | TypeAlias |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `modelSettings` State (canvas) | `ModelSetting[]` | Slice 09, 10, 11 |
| Bereinigte `CanvasDetailState` | Interface | Slice 09, 10, 11, 12 |
| Bereinigte `CanvasDetailAction` | Union Type | Slice 12 |
| Model-Resolution Helper Pattern | Lookup-Pattern | Slice 09, 10, 11 |

**Deliverables:**
- `lib/canvas-detail-context.tsx` (EXISTING - Modify)
- `components/canvas/canvas-detail-view.tsx` (EXISTING - Modify)

---

### Slice 09: Canvas Variation + Img2Img Tier Toggle

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 08 |
| Outputs | Extended VariationParams, Extended Img2imgParams, Tier-aware Handler-Pattern |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `TierToggle` | Slice 05 | React Component |
| `MaxQualityToggle` | Slice 05 | React Component |
| `Tier` Type | Slice 03 | Type |
| `modelSettings` State | Slice 08 | `ModelSetting[]` |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Extended `VariationParams` | Interface | canvas-detail-view Handler |
| Extended `Img2imgParams` | Interface | canvas-detail-view Handler |
| Tier-aware Handler-Pattern | Lookup-Pattern | Slice 10, 11 |

**Deliverables:**
- `components/canvas/popovers/variation-popover.tsx` (EXISTING - Modify)
- `components/canvas/popovers/img2img-popover.tsx` (EXISTING - Modify)
- `components/canvas/canvas-detail-view.tsx` (EXISTING - Modify)

---

### Slice 10: Canvas Upscale Tier Toggle

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 08, Slice 07 |
| Outputs | Extended UpscalePopoverProps |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `TierToggle` | Slice 05 | React Component |
| `Tier` Type | Slice 03 | Type |
| `modelSettings` State | Slice 08 | `ModelSetting[]` |
| Model-Resolution Pattern | Slice 08 | Lookup-Pattern |
| `upscaleImage` (extended) | Slice 07 | Server Action |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `UpscalePopoverProps.onUpscale` (extended) | Callback Signatur | canvas-detail-view.tsx |

**Deliverables:**
- `components/canvas/popovers/upscale-popover.tsx` (EXISTING - Modify)
- `components/canvas/canvas-detail-view.tsx` (EXISTING - Modify)

---

### Slice 11: Canvas Chat Panel Tier Toggle

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 08 |
| Outputs | Chat-Tier-basierte Generation |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `TierToggle` | Slice 05 | React Component |
| `MaxQualityToggle` | Slice 05 | React Component |
| `modelSettings` State | Slice 08 | `ModelSetting[]` (Prop) |
| `Tier` Type | Slice 03 | Type |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Chat-Tier-basierte Generation | Behaviour | Slice 12 |

**Deliverables:**
- `components/canvas/canvas-chat-panel.tsx` (EXISTING - Modify)

---

### Slice 12: Workspace Cleanup -- Remove Old UI

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 09, 10, 11 |
| Outputs | Bereinigte canvas-detail-view, Leerer Canvas Header Center-Slot |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| Tier-basierte Variation/Img2Img Handlers | Slice 09 | Behaviour |
| Tier-basierte Upscale Handler | Slice 10 | Behaviour |
| Tier-basierte Chat Generation | Slice 11 | Behaviour |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Bereinigte `canvas-detail-view.tsx` | Clean Codebase | Slice 13 |
| Leerer Canvas Header Center-Slot | UI State | None (user-facing) |

**Deliverables:**
- `components/canvas/canvas-header.tsx` (EXISTING - Modify)
- `components/canvas/canvas-detail-view.tsx` (EXISTING - Modify)

---

### Slice 13: Dead Code Cleanup + Deprecation

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 12 |
| Outputs | Bereinigte Codebase (final) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `generation-service.ts` without UPSCALE_MODEL | Slice 07 | Behaviour |
| `prompt-area.tsx` without deprecated imports | Slice 06 | Behaviour |
| Canvas old UI imports removed | Slice 12 | Clean Codebase |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Bereinigte `app/actions/models.ts` | Clean Codebase | None (final) |
| Bereinigte `lib/db/queries.ts` | Clean Codebase | None (final) |
| Deprecierte Schema-Tabellen mit `@deprecated` | Documentation | Future migration |

**Deliverables:**
- `app/actions/models.ts` (EXISTING - Modify/Delete)
- `lib/db/queries.ts` (EXISTING - Modify)
- `lib/db/schema.ts` (EXISTING - Modify)
- `lib/models.ts` (EXISTING - Modify/Delete)

---

## Connections

| # | From | To | Resource | Type | Status |
|---|------|-----|----------|------|--------|
| 1 | Slice 01 | Slice 02 | `modelSettings` pgTable | Drizzle pgTable | valid |
| 2 | Slice 01 | Slice 02 | `model_settings` DB-Tabelle | PostgreSQL Table | valid |
| 3 | Slice 01 | Slice 02 | Seed-Daten (8 Eintraege) | DB Rows | valid |
| 4 | Slice 02 | Slice 03 | `getAllModelSettings` | Query Function | valid |
| 5 | Slice 02 | Slice 03 | `getModelSettingByModeTier` | Query Function | valid |
| 6 | Slice 02 | Slice 03 | `upsertModelSetting` | Query Function | valid |
| 7 | Slice 02 | Slice 03 | `seedModelSettingsDefaults` | Query Function | valid |
| 8 | Slice 02 | Slice 03 | `ModelSettingsService` | Service Module | valid |
| 9 | Slice 02 | Slice 03 | `ModelSetting` Type | TypeAlias | valid |
| 10 | Slice 02 | Slice 08 | `ModelSetting` Type | TypeAlias | valid |
| 11 | Slice 03 | Slice 04 | `getModelSettings` | Server Action | valid |
| 12 | Slice 03 | Slice 04 | `updateModelSetting` | Server Action | valid |
| 13 | Slice 03 | Slice 04 | `GenerationMode`, `Tier` | Types | valid |
| 14 | Slice 03 | Slice 04 | `UpdateModelSettingInput` | DTO Type | valid |
| 15 | Slice 03 | Slice 05 | `Tier` Type | Type | valid |
| 16 | Slice 03 | Slice 06 | `Tier` Type | Type | valid |
| 17 | Slice 03 | Slice 06 | `getModelSettings` | Server Action | valid |
| 18 | Slice 03 | Slice 07 | `Tier`, `GenerationMode` | Types | valid |
| 19 | Slice 03 | Slice 08 | `getModelSettings` | Server Action | valid |
| 20 | Slice 03 | Slice 08 | `Tier` Type | Type | valid |
| 21 | Slice 03 | Slice 09 | `Tier` Type | Type | valid |
| 22 | Slice 03 | Slice 10 | `Tier` Type | Type | valid |
| 23 | Slice 03 | Slice 11 | `Tier` Type | Type | valid |
| 24 | Slice 05 | Slice 06 | `TierToggle` | React Component | valid |
| 25 | Slice 05 | Slice 06 | `MaxQualityToggle` | React Component | valid |
| 26 | Slice 05 | Slice 08 | (transitive dep for ordering) | Dependency | valid |
| 27 | Slice 05 | Slice 09 | `TierToggle` | React Component | valid |
| 28 | Slice 05 | Slice 09 | `MaxQualityToggle` | React Component | valid |
| 29 | Slice 05 | Slice 10 | `TierToggle` | React Component | valid |
| 30 | Slice 05 | Slice 11 | `TierToggle` | React Component | valid |
| 31 | Slice 05 | Slice 11 | `MaxQualityToggle` | React Component | valid |
| 32 | Slice 06 | Slice 07 | `tier`/`maxQuality`/`modelSettings` State | React State | valid |
| 33 | Slice 07 | Slice 10 | `upscaleImage` (extended) | Server Action | valid |
| 34 | Slice 08 | Slice 09 | `modelSettings` State (canvas) | ModelSetting[] | valid |
| 35 | Slice 08 | Slice 10 | `modelSettings` State (canvas) | ModelSetting[] | valid |
| 36 | Slice 08 | Slice 11 | `modelSettings` State (canvas) | ModelSetting[] | valid |
| 37 | Slice 09/10/11 | Slice 12 | Tier-basierte Handlers | Behaviour | valid |
| 38 | Slice 12 | Slice 13 | Bereinigte Canvas Codebase | Clean Codebase | valid |

---

## Validation Results

### Valid Connections: 38

All declared dependencies have matching outputs. Every input declared in each slice's Integration Contract has a corresponding output in the source slice.

### Orphaned Outputs: 0

All outputs are consumed by at least one downstream slice or are final user-facing outputs (e.g., Leerer Canvas Header Center-Slot, Bereinigte Codebase from Slice 13).

### Missing Inputs: 0

No inputs reference a resource that is not provided by an upstream slice.

### Deliverable-Consumer Gaps: 0

All deliverables and their mount-points have been verified:

| Component | Defined In | Consumer File | Consumer Deliverable | Status |
|-----------|------------|---------------|----------------------|--------|
| `modelSettings` pgTable | Slice 01 (`lib/db/schema.ts`) | `lib/db/queries.ts` | Slice 02 modifies `queries.ts` | valid |
| `ModelSettingsService` | Slice 02 (`lib/services/model-settings-service.ts`) | `app/actions/model-settings.ts` | Slice 03 creates `model-settings.ts` | valid |
| `getModelSettings` Server Action | Slice 03 (`app/actions/model-settings.ts`) | `components/settings/settings-dialog.tsx` | Slice 04 creates it | valid |
| `getModelSettings` Server Action | Slice 03 | `components/workspace/prompt-area.tsx` | Slice 06 modifies it | valid |
| `getModelSettings` Server Action | Slice 03 | `components/canvas/canvas-detail-view.tsx` | Slice 08 modifies it | valid |
| `updateModelSetting` Server Action | Slice 03 | `components/settings/settings-dialog.tsx` | Slice 04 creates it | valid |
| `SettingsDialog` | Slice 04 (`components/settings/settings-dialog.tsx`) | `components/workspace/workspace-header.tsx` | Slice 04 modifies `workspace-header.tsx` | valid |
| `TierToggle` | Slice 05 (`components/ui/tier-toggle.tsx`) | `components/workspace/prompt-area.tsx` | Slice 06 modifies it | valid |
| `TierToggle` | Slice 05 | `components/canvas/popovers/variation-popover.tsx` | Slice 09 modifies it | valid |
| `TierToggle` | Slice 05 | `components/canvas/popovers/img2img-popover.tsx` | Slice 09 modifies it | valid |
| `TierToggle` | Slice 05 | `components/canvas/popovers/upscale-popover.tsx` | Slice 10 modifies it | valid |
| `TierToggle` | Slice 05 | `components/canvas/canvas-chat-panel.tsx` | Slice 11 modifies it | valid |
| `MaxQualityToggle` | Slice 05 (`components/ui/max-quality-toggle.tsx`) | `components/workspace/prompt-area.tsx` | Slice 06 modifies it | valid |
| `MaxQualityToggle` | Slice 05 | `components/canvas/popovers/variation-popover.tsx` | Slice 09 modifies it | valid |
| `MaxQualityToggle` | Slice 05 | `components/canvas/popovers/img2img-popover.tsx` | Slice 09 modifies it | valid |
| `MaxQualityToggle` | Slice 05 | `components/canvas/canvas-chat-panel.tsx` | Slice 11 modifies it | valid |
| `upscaleImage` (extended) | Slice 07 (`app/actions/generations.ts`) | `components/canvas/canvas-detail-view.tsx` | Slice 10 modifies it | valid |

### Runtime Path Gaps: 0

All user flows have complete call chains verified:

| User-Flow | Chain | Status |
|-----------|-------|--------|
| Flow 1: Generation mit Draft (Workspace) | User -> TierToggle (S06) -> handleGenerate (S07) -> generateImages (existing) -> GenerationService (S07) -> Replicate -> R2 | valid |
| Flow 2: Wechsel zu Quality (Workspace) | User -> TierToggle switch (S06) -> MaxQualityToggle (S06) -> handleGenerate (S07) -> generateImages -> GenerationService -> Replicate | valid |
| Flow 3: Settings konfigurieren | User -> Settings-Button (S04) -> SettingsDialog (S04) -> updateModelSetting (S03) -> ModelSettingsService (S02) -> DB upsert (S01/S02) | valid |
| Flow 4: Canvas Iteration (Popovers) | User -> Variation/Img2Img Popover TierToggle (S09) -> handleVariation/Img2imgGenerate (S09) -> generateImages -> GenerationService | valid |
| Flow 4b: Canvas Upscale | User -> Upscale Popover TierToggle (S10) -> handleUpscale (S10) -> upscaleImage (S07) -> GenerationService.upscale (S07) -> Replicate | valid |
| Flow 5: Canvas Chat | User -> Chat TierToggle (S11) -> handleCanvasGenerate (S11) -> generateImages -> GenerationService | valid |

---

## Discovery Traceability

### UI Components Coverage

| Discovery Element | Type | Location | Covered In | Status |
|-------------------|------|----------|------------|--------|
| `tier-toggle` | Segmented Control | Prompt-Area, Canvas Popovers, Chat Panel | Slice 05 (component), 06 (WS), 09 (Var/I2I), 10 (Upscale), 11 (Chat) | covered |
| `max-quality-toggle` | Toggle Button | Unter/neben Tier-Toggle (except Upscale) | Slice 05 (component), 06 (WS), 09 (Var/I2I), 11 (Chat) | covered |
| `settings-button` | Icon Button | Workspace Header | Slice 04 | covered |
| `settings-dialog` | Modal | Overlay | Slice 04 | covered |
| `model-dropdown-draft` | Select | Settings Dialog, pro Mode | Slice 04 | covered |
| `model-dropdown-quality` | Select | Settings Dialog, pro Mode | Slice 04 | covered |
| `model-dropdown-max` | Select | Settings Dialog, pro Mode | Slice 04 | covered |

### State Machine Coverage

| State | Required UI | Available Actions | Covered In | Status |
|-------|-------------|-------------------|------------|--------|
| `draft-selected` | Tier-Toggle "Draft" aktiv, Max hidden | Generate, Switch Quality, Open Settings | Slice 05 (AC-1), 06 (AC-1/2) | covered |
| `quality-selected` | Tier-Toggle "Quality" aktiv, Max visible (off) | Generate, Switch Draft, Toggle Max, Open Settings | Slice 05 (AC-2), 06 (AC-3) | covered |
| `quality-max-selected` | Tier-Toggle "Quality" aktiv, Max on | Generate, Switch Draft, Toggle Max off, Open Settings | Slice 06 (AC-3), 07 (AC-3) | covered |
| `generating` | Spinner, Tier disabled | Cancel (wenn unterstuetzt) | Slice 06 (AC-11), 11 (AC-9) | covered |
| `streaming` | Chat-Input disabled, Tier interaktiv | -- | Slice 11 (AC-8) | covered |
| `settings-open` | Settings Modal sichtbar | Change Model, Close | Slice 04 (AC-2/3/8) | covered |

### Transitions Coverage

| From | Trigger | To | Covered In | Status |
|------|---------|-----|------------|--------|
| `draft-selected` | Click "Quality" | `quality-selected` | Slice 05 AC-3, 06 AC-3 | covered |
| `quality-selected` | Click "Draft" | `draft-selected` | Slice 05 AC-4, 06 AC-4 | covered |
| `quality-selected` | Click "Max Quality" | `quality-max-selected` | Slice 05 AC-8, 06 AC-3, 09 AC-10 | covered |
| `quality-max-selected` | Click "Max Quality" | `quality-selected` | Slice 05 AC-9 | covered |
| `quality-max-selected` | Click "Draft" | `draft-selected` | Slice 05 AC-4 (implicit) | covered |
| any | Click Settings-Icon | `settings-open` | Slice 04 AC-2 | covered |
| `settings-open` | Close / Click outside | previous state | Slice 04 AC-3 | covered |
| `settings-open` | Select Model | `settings-open` | Slice 04 AC-8 | covered |
| any tier | Click Generate | `generating` | Slice 07 AC-1/2/3, 06 AC-11 | covered |
| `generating` | Generation done | previous tier state | Slice 07 (implicit) | covered |
| quality (Chat) | Send Message | `streaming` | Slice 11 AC-8 | covered |
| `streaming` | AI done / Gen triggered | `generating` or previous | Slice 11 AC-5/6/7 | covered |

### Business Rules Coverage

| Rule | Covered In | Status |
|------|------------|--------|
| Default-Tier ist Draft bei App-Start (nicht persistiert) | Slice 06 AC-1/2, 09 AC-1/4, 10 AC-1, 11 AC-1 | covered |
| Max Quality Toggle off bei App-Start | Slice 06 AC-3 (default off), 09 AC-2 (default off) | covered |
| Tier-Auswahl pro Tool separat | Slice 09 AC-13, 11 (independent state) | covered |
| Model-Zuweisungen global (nicht pro Projekt) | Slice 01 (no project_id), 04 (global dialog) | covered |
| Model-Zuweisungen sofort gespeichert (Auto-Save) | Slice 04 AC-8 | covered |
| Upscale hat kein Max-Model | Slice 03 AC-9, 04 AC-4/11, 06 AC-5, 10 AC-2 | covered |
| Generation nutzt Model des Tiers + Mode | Slice 07 AC-1/2/3/4/5/6 | covered |
| `generations.modelId` speichert tatsaechlich verwendetes Model | Slice 07 AC-9 | covered |
| `generations.modelParams` speichert Preset-Parameter | Slice 07 AC-4 (params from settings) | covered |

### Data Fields Coverage

| Field | Required | Covered In | Status |
|-------|----------|------------|--------|
| `id` (uuid PK) | Yes | Slice 01 AC-1 | covered |
| `mode` (varchar(20)) | Yes | Slice 01 AC-1/3 | covered |
| `tier` (varchar(20)) | Yes | Slice 01 AC-1/3 | covered |
| `model_id` (varchar(255)) | Yes | Slice 01 AC-1/3 | covered |
| `model_params` (jsonb) | Yes | Slice 01 AC-1/6 | covered |
| `created_at` (timestamptz) | Yes | Slice 01 AC-1 | covered |
| `updated_at` (timestamptz) | Yes | Slice 01 AC-1 | covered |
| Unique Constraint `(mode, tier)` | Yes | Slice 01 AC-4/5 | covered |

**Discovery Coverage:** 37/37 (100%)

---

## Summary

| Metric | Value |
|--------|-------|
| Total Slices | 13 |
| Total Connections | 38 |
| Valid Connections | 38 |
| Orphaned Outputs | 0 |
| Missing Inputs | 0 |
| Deliverable-Consumer Gaps | 0 |
| Runtime Path Gaps | 0 |
| Discovery Coverage | 100% |

**VERDICT: READY FOR ORCHESTRATION**
