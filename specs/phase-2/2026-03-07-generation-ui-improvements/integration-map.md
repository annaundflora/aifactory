# Integration Map: Generation UI Improvements

**Generated:** 2026-03-09
**Slices:** 13
**Connections:** 21

---

## Dependency Graph (Visual)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Foundation Layer (no dependencies)                                        │
│                                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Slice 01 │  │ Slice 03 │  │ Slice 05 │  │ Slice 06 │  │ Slice 11 │  │
│  │ aspect-  │  │ variant- │  │ bulk-db- │  │selection-│  │ zip-     │  │
│  │ ratio-   │  │ stepper  │  │ actions  │  │ context  │  │ download │  │
│  │ utils    │  │          │  │          │  │          │  │ route    │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────┘  │
└───────┼─────────────┼─────────────┼─────────────┼────────────────────────┘
        │             │             │             │
        ▼             │             │             ▼
  ┌──────────┐        │             │      ┌──────────┐  ┌──────────┐
  │ Slice 02 │        │             │      │ Slice 07 │  │ Slice 09 │
  │ chips-   │        │             │      │ gencard- │  │ floating-│
  │ comps    │        │             │      │ checkbox │  │ action-  │
  └────┬─────┘        │             │      └────┬─────┘  │ bar      │
       │              │             │           │         └──────────┘
       ▼              ▼             │           ▼
  ┌─────────────────────────┐      │      ┌──────────┐
  │       Slice 04          │      │      │ Slice 08 │
  │ prompt-area-integration │      │      │ gallery- │
  │  (deps: 01, 02, 03)     │      │      │ grid-    │
  └─────────────────────────┘      │      │ selection│
                                   │      └────┬─────┘
                                   │           │
                         ┌──────────┐          │
                         │ Slice 12 │          │
                         │ compare- │          │
                         │ modal    │          │
                         └────┬─────┘          │
                              │                │
                    ┌─────────┼────────────────┼───────┐
                    │         │                │       │
                    ▼         ▼                ▼       ▼
              ┌──────────────────────────────────────────┐
              │              Slice 10                     │
              │  floating-action-bar-integration          │
              │  (deps: 05, 08, 09, 11, 12)               │
              └──────────────────────────────────────────┘

  ┌──────────────────────────────────────────────┐
  │              Slice 13                         │
  │         lightbox-extensions                   │
  │  (deps: 05, 06, 12)                           │
  └──────────────────────────────────────────────┘
```

---

## Nodes

### Slice 01: Aspect Ratio Utils

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | `lib/aspect-ratio.ts` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| None | — | — |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `parseRatioConfig` | Function | slice-02, slice-04 |
| `calculateDimensions` | Function | slice-02, slice-04 |
| `validateCustomRatio` | Function | slice-02 |
| `SIZE_PRESETS` | Const | slice-02, slice-04 |
| `RatioConfig` | Type | slice-02, slice-04 |

---

### Slice 02: AspectRatioChips + SizeChips Components

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-01 |
| Outputs | `components/workspace/aspect-ratio-chips.tsx`, `components/workspace/size-chips.tsx` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `validateCustomRatio` | slice-01 | `lib/aspect-ratio.ts` export verified |
| `SIZE_PRESETS` | slice-01 | `lib/aspect-ratio.ts` export verified |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `AspectRatioChips` | Component | slice-04 |
| `SizeChips` | Component | slice-04 |

---

### Slice 03: VariantStepper Component

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | `components/workspace/variant-stepper.tsx` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| None | — | — |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `VariantStepper` | Component | slice-04 |

---

### Slice 04: PromptArea Layout-Integration

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-01, slice-02, slice-03 |
| Outputs | `components/workspace/prompt-area.tsx` (modified) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `parseRatioConfig`, `SIZE_PRESETS`, `RatioConfig` | slice-01 | Verified in slice-01 "Provides To" |
| `AspectRatioChips` | slice-02 | Verified in slice-02 "Provides To" |
| `SizeChips` | slice-02 | Verified in slice-02 "Provides To" |
| `VariantStepper` | slice-03 | Verified in slice-03 "Provides To" |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `PromptArea` (modified) | Component | slice-10 (`workspace-content.tsx`) — existing consumer, unchanged props interface |

---

### Slice 05: Bulk DB Queries + Server Actions

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | `lib/db/queries.ts` (modified), `app/actions/generations.ts` (modified) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| Existing `lib/db/index.ts`, `lib/db/schema.ts` | Codebase (pre-existing) | Already present in repository |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `moveGeneration` | Server Action | slice-10, slice-13 |
| `moveGenerations` | Server Action | slice-10 |
| `deleteGenerations` | Server Action | slice-10 |
| `toggleFavorites` | Server Action | slice-10 |

---

### Slice 06: SelectionContext

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | `lib/selection-state.tsx` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| None | — | — |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `SelectionProvider` | React Component | slice-10 (`workspace-content.tsx`) |
| `useSelection` | React Hook | slice-07, slice-08, slice-09, slice-13 |

---

### Slice 07: GenerationCard Checkbox Overlay

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-06 |
| Outputs | `components/workspace/generation-card.tsx` (modified) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `useSelection` | slice-06 | `lib/selection-state.tsx` export verified |
| `SelectionProvider` (ancestor) | slice-06 | Provider wraps consumer in slice-10 |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `GenerationCard` (modified) | Component | slice-08 (`gallery-grid.tsx`) |

---

### Slice 08: GalleryHeader + GalleryGrid Selection Mode

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-06, slice-07 |
| Outputs | `components/workspace/gallery-header.tsx` (new), `components/workspace/gallery-grid.tsx` (modified) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `useSelection` (isSelecting) | slice-06 | Used in `gallery-grid.tsx` |
| `GenerationCard` (unchanged signature) | slice-07 | Props interface unchanged |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `GalleryHeader` | Component | slice-10 (`workspace-content.tsx`) |
| `GalleryGrid` (modified) | Component | slice-10 (`workspace-content.tsx`) |

---

### Slice 09: FloatingActionBar Component

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-06 (parent-level, for `selectedIds.size` derivation) |
| Outputs | `components/workspace/floating-action-bar.tsx` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `useSelection` (via parent for `selectedCount` derivation) | slice-06 | Presentational component, receives `selectedCount` as prop |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `FloatingActionBar` | Component | slice-10 (`workspace-content.tsx`) |

---

### Slice 10: FloatingActionBar Bulk Actions Integration

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-05, slice-08, slice-09, slice-11, slice-12 |
| Outputs | `components/workspace/workspace-content.tsx` (modified) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `deleteGenerations`, `moveGenerations`, `toggleFavorites` | slice-05 | Verified in slice-05 "Provides To" |
| `GalleryHeader` | slice-08 | Verified in slice-08 "Provides To" |
| `GalleryGrid` (modified) | slice-08 | Verified in slice-08 "Provides To" |
| `FloatingActionBar` | slice-09 | Verified in slice-09 "Provides To" |
| `GET /api/download-zip` | slice-11 | Route provides `?ids=...` → `application/zip` |
| `CompareModal` | slice-12 | Verified in slice-12 "Provides To" |
| `SelectionProvider` | slice-06 | Used to wrap workspace structure |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `WorkspaceContent` (modified) | Component | `app/workspace/[projectId]/page.tsx` (existing page, unchanged interface) |

---

### Slice 11: ZIP Download API Route

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | `app/api/download-zip/route.ts` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `getGenerationsByIds` from `lib/db/queries.ts` | Codebase (pre-existing) | Existing function required to return `imageUrl` field |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `GET /api/download-zip` | Route Handler | slice-10 (`workspace-content.tsx` fetch call) |

---

### Slice 12: CompareModal Component

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | `components/compare/compare-modal.tsx` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `Generation` type | Codebase (`lib/db/queries.ts`, pre-existing) | Type already exists |
| `getModelById` | Codebase (`lib/models.ts`, pre-existing) | Function already exists |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `CompareModal` | Component | slice-10 (`workspace-content.tsx`), slice-13 (`lightbox-modal.tsx`) |

---

### Slice 13: Lightbox Extensions — Move + Compare

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-05, slice-06, slice-12 |
| Outputs | `components/lightbox/lightbox-move-dropdown.tsx`, `components/lightbox/lightbox-compare-bar.tsx`, `components/lightbox/lightbox-modal.tsx` (modified) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `moveGeneration` | slice-05 | Verified in slice-05 "Provides To" |
| `useSelection` | slice-06 | Verified in slice-06 "Provides To" |
| `CompareModal` | slice-12 | Verified in slice-12 "Provides To" |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `LightboxMoveDropdown` | Component | `lightbox-modal.tsx` (integrated within same slice) |
| `LightboxCompareBar` | Component | `lightbox-modal.tsx` (integrated within same slice) |
| `lightbox-modal.tsx` (modified) | Component | `workspace-content.tsx` (pre-existing consumer, unchanged interface) |

---

## Connections

| # | From | To | Resource | Type | Status |
|---|------|-----|----------|------|--------|
| 1 | slice-01 | slice-02 | `validateCustomRatio` | Function | VALID |
| 2 | slice-01 | slice-02 | `SIZE_PRESETS` | Const | VALID |
| 3 | slice-01 | slice-04 | `parseRatioConfig`, `SIZE_PRESETS`, `RatioConfig` | Function + Const + Type | VALID |
| 4 | slice-02 | slice-04 | `AspectRatioChips` | Component | VALID |
| 5 | slice-02 | slice-04 | `SizeChips` | Component | VALID |
| 6 | slice-03 | slice-04 | `VariantStepper` | Component | VALID |
| 7 | slice-05 | slice-10 | `deleteGenerations`, `moveGenerations`, `toggleFavorites` | Server Actions | VALID |
| 8 | slice-05 | slice-13 | `moveGeneration` | Server Action | VALID |
| 9 | slice-06 | slice-07 | `useSelection`, `SelectionProvider` | Hook + Component | VALID |
| 10 | slice-06 | slice-08 | `useSelection` (isSelecting) | Hook | VALID |
| 11 | slice-06 | slice-09 | `useSelection` (selectedIds.size → selectedCount) | Hook (via parent derivation) | VALID |
| 12 | slice-06 | slice-10 | `SelectionProvider` | Component | VALID |
| 13 | slice-06 | slice-13 | `useSelection` | Hook | VALID |
| 14 | slice-07 | slice-08 | `GenerationCard` (modified) | Component | VALID |
| 15 | slice-08 | slice-10 | `GalleryHeader` | Component | VALID |
| 16 | slice-08 | slice-10 | `GalleryGrid` (modified) | Component | VALID |
| 17 | slice-09 | slice-10 | `FloatingActionBar` | Component | VALID |
| 18 | slice-11 | slice-10 | `GET /api/download-zip` | Route Handler | VALID |
| 19 | slice-12 | slice-10 | `CompareModal` | Component | VALID |
| 20 | slice-12 | slice-13 | `CompareModal` | Component | VALID |
| 21 | slice-04 | slice-10 | `PromptArea` (modified) | Component (existing consumer) | VALID |

---

## Validation Results

### Valid Connections: 21

All declared dependencies have matching outputs.

### Orphaned Outputs: 0

All outputs are consumed:

| Output | Defined In | Consumers | Status |
|--------|------------|-----------|--------|
| `parseRatioConfig` | slice-01 | slice-02 (indirect), slice-04 | USED |
| `calculateDimensions` | slice-01 | slice-04 (via `lib/aspect-ratio.ts` import) | USED |
| `validateCustomRatio` | slice-01 | slice-02 | USED |
| `SIZE_PRESETS` | slice-01 | slice-02, slice-04 | USED |
| `RatioConfig` | slice-01 | slice-04 | USED |
| `AspectRatioChips` | slice-02 | slice-04 | USED |
| `SizeChips` | slice-02 | slice-04 | USED |
| `VariantStepper` | slice-03 | slice-04 | USED |
| `PromptArea` (modified) | slice-04 | slice-10 (workspace-content.tsx, pre-existing consumer) | USED |
| `moveGeneration` | slice-05 | slice-13 | USED |
| `moveGenerations` | slice-05 | slice-10 | USED |
| `deleteGenerations` | slice-05 | slice-10 | USED |
| `toggleFavorites` | slice-05 | slice-10 | USED |
| `SelectionProvider` | slice-06 | slice-10 | USED |
| `useSelection` | slice-06 | slice-07, slice-08, slice-09 (parent-level), slice-13 | USED |
| `GenerationCard` (modified) | slice-07 | slice-08 (gallery-grid.tsx) | USED |
| `GalleryHeader` | slice-08 | slice-10 | USED |
| `GalleryGrid` (modified) | slice-08 | slice-10 | USED |
| `FloatingActionBar` | slice-09 | slice-10 | USED |
| `GET /api/download-zip` | slice-11 | slice-10 (fetch call) | USED |
| `CompareModal` | slice-12 | slice-10, slice-13 | USED |
| `LightboxMoveDropdown` | slice-13 | `lightbox-modal.tsx` (within same slice) | USED |
| `LightboxCompareBar` | slice-13 | `lightbox-modal.tsx` (within same slice) | USED |
| `lightbox-modal.tsx` (modified) | slice-13 | `workspace-content.tsx` (pre-existing consumer) | USED |

### Missing Inputs: 0

All declared inputs have verified producers.

### Deliverable-Consumer Gaps: 0

All mount-point checks passed:

| Component | Defined In | Consumer File | File Modified By | Status |
|-----------|------------|---------------|-----------------|--------|
| `AspectRatioChips` | slice-02 | `prompt-area.tsx` | slice-04 (EXISTING file — Modify) | VALID |
| `SizeChips` | slice-02 | `prompt-area.tsx` | slice-04 (EXISTING file — Modify) | VALID |
| `VariantStepper` | slice-03 | `prompt-area.tsx` | slice-04 (EXISTING file — Modify) | VALID |
| `GalleryHeader` | slice-08 | `workspace-content.tsx` | slice-10 (EXISTING file — Modify) | VALID |
| `GalleryGrid` (modified) | slice-08 | `workspace-content.tsx` | slice-10 (EXISTING file — Modify) | VALID |
| `FloatingActionBar` | slice-09 | `workspace-content.tsx` | slice-10 (EXISTING file — Modify) | VALID |
| `CompareModal` | slice-12 | `workspace-content.tsx` | slice-10 (EXISTING file — Modify) | VALID |
| `CompareModal` | slice-12 | `lightbox-modal.tsx` | slice-13 (EXISTING file — Modify) | VALID |
| `LightboxMoveDropdown` | slice-13 | `lightbox-modal.tsx` | slice-13 (same slice integrates) | VALID |
| `LightboxCompareBar` | slice-13 | `lightbox-modal.tsx` | slice-13 (same slice integrates) | VALID |
| `SelectionProvider` | slice-06 | `workspace-content.tsx` | slice-10 (EXISTING file — Modify) | VALID |

### Runtime Path Gaps: 0

All user flows have complete call chains:

| User-Flow | Full Chain | Status |
|-----------|-----------|--------|
| Flow 1: Aspect Ratio + Size select | User Click → AspectRatioChips/SizeChips (slice-02) → parseRatioConfig/calculateDimensions (slice-01) → PromptArea state (slice-04) → generateImages() | VALID |
| Flow 2: Bulk Select | Hover/Click → GenerationCard.toggleSelection (slice-07) → SelectionContext (slice-06) → FloatingActionBar visible (slice-09) → workspace-content callbacks (slice-10) | VALID |
| Flow 2: Bulk Delete | Delete-Button → ConfirmDialog (slice-10) → deleteGenerations (slice-05) → revalidatePath | VALID |
| Flow 2: Bulk Move | Move-Dropdown → ConfirmDialog (slice-10) → moveGenerations (slice-05) → revalidatePath | VALID |
| Flow 2: Bulk Favorite | Favorite-Button (slice-10) → toggleFavorites (slice-05) → revalidatePath | VALID |
| Flow 2: Bulk Download | Download-Button (slice-10) → fetch("/api/download-zip") (slice-11) → ZIP stream | VALID |
| Flow 2: Bulk Compare | Compare-Button (slice-10) → CompareModal open (slice-12) | VALID |
| Flow 3: Lightbox Compare | Lightbox Checkbox → useSelection.toggleSelection (slice-06) → LightboxCompareBar (slice-13) → CompareModal (slice-12) | VALID |
| Flow 4: Lightbox Move | LightboxMoveDropdown (slice-13) → moveGeneration (slice-05) → sonner toast + onClose | VALID |
| Flow 5: Fav-Filter | Star-Icon click → GalleryHeader.onFavFilterToggle (slice-08) → workspace-content favFilter state (slice-10) → GalleryGrid filtered | VALID |

---

## Discovery Traceability

### UI Components Coverage

| Discovery Element | Type | Location | Covered In | Status |
|-------------------|------|----------|------------|--------|
| `aspect-ratio-chips` | Toggle Chip Group | Prompt-Panel Row 7 | slice-02, slice-04 | COVERED |
| `custom-ratio-input` | Text Input | Inline after Custom-Chip | slice-02 (embedded in AspectRatioChips) | COVERED |
| `size-chips` | Toggle Chip Group | Prompt-Panel Row 8 | slice-02, slice-04 | COVERED |
| `advanced-settings` | Collapsible Section | Prompt-Panel Row 9 | slice-04 | COVERED |
| `variant-stepper` | Stepper | Prompt-Panel Row 10 left | slice-03, slice-04 | COVERED |
| `gallery-checkbox` | Checkbox Overlay | GenerationCard top-left | slice-07 | COVERED |
| `floating-action-bar` | Sticky Bar | Gallery bottom | slice-09, slice-10 | COVERED |
| `move-dropdown` | Select | Floating Action Bar | slice-09 | COVERED |
| `compare-modal` | Fullscreen Modal | Viewport Overlay | slice-12, slice-10 | COVERED |
| `fav-filter-toggle` | Toggle Button | Gallery Header | slice-08, slice-10 | COVERED |
| `lightbox-checkbox` | Checkbox Overlay | Lightbox image | slice-13 | COVERED |
| `lightbox-compare-bar` | Floating Bar | Lightbox bottom | slice-13 | COVERED |
| `lightbox-move-btn` | Button + Dropdown | Lightbox Actions | slice-13 | COVERED |

### State Machine Coverage

| State | Required UI | Available Actions | Covered In | Status |
|-------|-------------|-------------------|------------|--------|
| `gallery-default` | Gallery-Grid, no selection | Hover→Checkbox, Click→Lightbox, Fav-Filter | slice-07 (card click), slice-08 (grid+header) | COVERED |
| `gallery-selecting` | Gallery-Grid + Checkboxes + Floating Action Bar | Select/Deselect, Move, Delete, Compare(2-4), Favorite, Download, Cancel | slice-06, slice-07, slice-08, slice-09, slice-10 | COVERED |
| `compare-grid` | Compare-Modal 2x2 Grid | Fullscreen per image, Close | slice-12 | COVERED |
| `compare-fullscreen` | Single image fullscreen in Compare-Modal | ESC/Click → back to grid | slice-12 (AC-4, AC-5) | COVERED |
| `lightbox-compare-select` | Lightbox + Checkbox + Floating Compare Bar | Navigate, Toggle Checkbox (max 4), Compare(2+), Cancel | slice-13 | COVERED |

### Transitions Coverage

| From | Trigger | To | Covered In | Status |
|------|---------|-----|------------|--------|
| `gallery-default` | Checkbox-Klick | `gallery-selecting` | slice-07 (toggleSelection), slice-06 (isSelecting) | COVERED |
| `gallery-default` | Fav-Filter Toggle | `gallery-default` (filtered) | slice-08 (GalleryHeader), slice-10 (state) | COVERED |
| `gallery-selecting` | Weitere Checkbox-Klicks | `gallery-selecting` | slice-07, slice-06 | COVERED |
| `gallery-selecting` | Letzte Checkbox deselektiert / Abbrechen | `gallery-default` | slice-09 (onCancel), slice-10 (deselectAll) | COVERED |
| `gallery-selecting` | Compare-Button (2-4) | `compare-grid` | slice-09 (onCompare), slice-10 (CompareModal open), slice-12 | COVERED |
| `gallery-selecting` | Delete-Button | `gallery-default` | slice-09 (onDelete), slice-10 (ConfirmDialog + deleteGenerations) | COVERED |
| `gallery-selecting` | Move-Dropdown → Projekt | `gallery-default` | slice-09 (onMove), slice-10 (ConfirmDialog + moveGenerations) | COVERED |
| `gallery-selecting` | Favorite-Toggle | `gallery-selecting` | slice-09 (onFavorite), slice-10 (toggleFavorites) | COVERED |
| `gallery-selecting` | Download-Button | `gallery-selecting` | slice-09 (onDownload), slice-10 (fetch zip) | COVERED |
| `compare-grid` | Fullscreen-Toggle | `compare-fullscreen` | slice-12 (AC-4) | COVERED |
| `compare-grid` | X-Close | `gallery-default` | slice-12 (AC-7), slice-10 (onClose handler) | COVERED |
| `compare-fullscreen` | ESC or Click | `compare-grid` | slice-12 (AC-5, AC-6) | COVERED |
| Lightbox | Checkbox-Klick | `lightbox-compare-select` | slice-13 (AC-6, toggleSelection) | COVERED |
| `lightbox-compare-select` | Navigate + Checkbox toggle | `lightbox-compare-select` | slice-13 (AC-8, AC-9) | COVERED |
| `lightbox-compare-select` | Compare-Button (2+) | `compare-grid` | slice-13 (AC-11), slice-12 | COVERED |
| `lightbox-compare-select` | Abbrechen or ESC | Lightbox (normal) | slice-13 (AC-12, deselectAll) | COVERED |

### Business Rules Coverage

| Rule | Covered In | Status |
|------|------------|--------|
| Aspect Ratio Chips: Only model-compatible ratios (disabled + Tooltip) | slice-02 (AC-2), slice-04 (AC-5,6,7) | COVERED |
| Size Chips: Only model-compatible sizes (disabled + Tooltip) | slice-02 (AC-7), slice-04 (AC-6) | COVERED |
| Size-Calculation: longest edge = size value, shorter = rounded to even | slice-01 (AC-4,5,6) | COVERED |
| Custom Ratio: N:N format, both > 0, max 10:1 | slice-01 (AC-7,8,9,10), slice-02 (AC-4,5) | COVERED |
| Aspect Ratio Mapping: enum vs pixels | slice-01 (AC-1,2,3) | COVERED |
| Model-Wechsel Reset: auto-reset to first compatible option | slice-04 (AC-5,6,7) | COVERED |
| Compare: Min 2, Max 4; disabled tooltip | slice-09 (AC-6,7,8,9) | COVERED |
| Lightbox Compare Max 4: checkbox disabled with tooltip | slice-13 (AC-10) | COVERED |
| Select All toggle in Floating Action Bar | slice-09 (AC-5) | COVERED |
| Selection-Mode click behavior: toggle not lightbox | slice-07 (AC-1,2) | COVERED |
| Floating Action Bar Padding (pb-24) | slice-08 (AC-5,6) | COVERED |
| Bulk-Move: target != current project | slice-05 (AC-8) | COVERED |
| Bulk-Move Confirm dialog | slice-10 (AC-7,8) | COVERED |
| Bulk-Delete: DB + R2 + Confirm | slice-05 (AC-3), slice-10 (AC-3,4,5) | COVERED |
| Bulk-Download: server-side ZIP, filename = generation-id.png | slice-11 (AC-1,2) | COVERED |
| Compare-View Metadata: model name + dimensions | slice-12 (AC-1) | COVERED |
| Compare Empty Slots: dashed border placeholders | slice-12 (AC-2,3) | COVERED |
| Move Success Feedback: sonner toast | slice-10 (AC-5,8), slice-13 (AC-3) | COVERED |
| Favoriten-Filter: clientside filter | slice-10 (AC-11,12) | COVERED |
| Floating Action Bar: hidden at 0 selections | slice-09 (AC-1), slice-10 (AC-1) | COVERED |

### Data Fields Coverage

| Field | Required | Covered In | Status |
|-------|----------|------------|--------|
| `aspect_ratio` (UI-State) | No | slice-01, slice-02, slice-04 | COVERED |
| `size` (UI-State) | No | slice-01, slice-02, slice-04 | COVERED |
| `width` (Generation Input) | No | slice-01 (calculateDimensions), slice-04 | COVERED |
| `height` (Generation Input) | No | slice-01 (calculateDimensions), slice-04 | COVERED |
| `projectId` (Move Target) | Yes | slice-05 (moveGeneration, moveGenerations) | COVERED |

**Discovery Coverage: 13/13 UI Components, 5/5 States, 16/16 Transitions, 20/20 Business Rules, 5/5 Data Fields = 100%**

---

## Summary

| Metric | Value |
|--------|-------|
| Total Slices | 13 |
| All Slices APPROVED | 13/13 |
| Total Connections | 21 |
| Valid Connections | 21 |
| Orphaned Outputs | 0 |
| Missing Inputs | 0 |
| Deliverable-Consumer Gaps | 0 |
| Runtime Path Gaps | 0 |
| Discovery Coverage | 100% |

**Verdict: READY FOR ORCHESTRATION**
