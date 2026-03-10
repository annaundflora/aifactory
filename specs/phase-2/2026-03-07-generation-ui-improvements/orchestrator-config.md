# Orchestrator Configuration: Generation UI Improvements

**Integration Map:** `integration-map.md`
**E2E Checklist:** `e2e-checklist.md`
**Generated:** 2026-03-09

---

## Pre-Implementation Gates

```yaml
pre_checks:
  - name: "Gate 1: Architecture Compliance"
    file: "compliance-architecture.md"
    required: "Verdict == APPROVED"

  - name: "Gate 2: All Slices Approved"
    files: "compliance-slice-01.md through compliance-slice-13.md"
    required: "ALL Verdict == APPROVED"
    result: "13/13 APPROVED"

  - name: "Gate 3: Integration Map Valid"
    file: "integration-map.md"
    required: "Missing Inputs == 0, Orphaned Outputs == 0, Discovery Coverage == 100%"
    result: "READY FOR ORCHESTRATION"
```

---

## Implementation Order

Based on dependency analysis from integration-map.md:

| Order | Slice | Name | Depends On | Parallel With |
|-------|-------|------|------------|---------------|
| 1 | slice-01 | aspect-ratio-utils | — | slice-03, slice-05, slice-06, slice-11, slice-12 |
| 1 | slice-03 | variant-stepper | — | slice-01, slice-05, slice-06, slice-11, slice-12 |
| 1 | slice-05 | bulk-db-actions | — | slice-01, slice-03, slice-06, slice-11, slice-12 |
| 1 | slice-06 | selection-context | — | slice-01, slice-03, slice-05, slice-11, slice-12 |
| 1 | slice-11 | zip-download-route | — | slice-01, slice-03, slice-05, slice-06, slice-12 |
| 1 | slice-12 | compare-modal | — | slice-01, slice-03, slice-05, slice-06, slice-11 |
| 2 | slice-02 | chips-components | slice-01 | slice-07, slice-09 |
| 2 | slice-07 | generation-card-checkbox | slice-06 | slice-02, slice-09 |
| 2 | slice-09 | floating-action-bar | slice-06 | slice-02, slice-07 |
| 3 | slice-04 | prompt-area-integration | slice-01, slice-02, slice-03 | slice-08, slice-13 |
| 3 | slice-08 | gallery-grid-selection | slice-06, slice-07 | slice-04, slice-13 |
| 3 | slice-13 | lightbox-extensions | slice-05, slice-06, slice-12 | slice-04, slice-08 |
| 4 | slice-10 | floating-action-bar-integration | slice-05, slice-08, slice-09, slice-11, slice-12 | — (final integration) |

**Note on parallelism:** All Order-1 slices can be implemented simultaneously. Order-2 slices can run in parallel once their specific dependencies are complete. Order-3 slices can also run in parallel. Slice-10 must wait for all Order-1, Order-2, and Order-3 dependencies.

---

## Per-Slice Implementation Instructions

### Slice 01 — aspect-ratio-utils

**File to create:** `lib/aspect-ratio.ts`

Implement pure functions only:
- `parseRatioConfig(schema: SchemaProperties): RatioConfig`
- `calculateDimensions(ratio: string, sizeValue: number): { width: number; height: number }`
- `validateCustomRatio(input: string): { valid: boolean; error?: string }`
- `SIZE_PRESETS` constant: `{ xs: 512, s: 768, m: 1024, l: 1536, xl: 2048 }`
- `RatioConfig` type export

Constraints: No React, no side effects, pure TypeScript only.

**Test command:** `pnpm test lib/aspect-ratio.test.ts`

---

### Slice 03 — variant-stepper

**File to create:** `components/workspace/variant-stepper.tsx`

Implement controlled stepper component `[-] N [+]`, range 1-4, boundary buttons disabled.

**Test command:** `pnpm test components/workspace/variant-stepper`

---

### Slice 05 — bulk-db-actions

**Files to modify:**
- `lib/db/queries.ts` — add 4 query functions: `moveGenerationQuery`, `moveGenerationsQuery`, `deleteGenerationsQuery`, `toggleFavoritesQuery` using Drizzle `inArray()`
- `app/actions/generations.ts` — add 4 server actions: `moveGeneration`, `moveGenerations`, `deleteGenerations`, `toggleFavorites`

Constraints: UUID validation per regex before DB ops, max 100 IDs, `revalidatePath("/")` on success, `{ error: string }` return pattern (no throw), R2 cleanup fire-and-forget in deleteGenerations.

**Test command:** `pnpm test lib/db/queries.test.ts app/actions/generations.test.ts`

---

### Slice 06 — selection-context

**File to create:** `lib/selection-state.tsx`

Implement `SelectionContext`, `SelectionProvider`, `useSelection` hook. `selectedIds` as `Set<string>`, `isSelecting` derived from `selectedIds.size > 0`.

Constraints: `"use client"` directive, no persistence, no `source` field in this slice.

**Test command:** `pnpm test lib/selection-state`

---

### Slice 11 — zip-download-route

**File to create:** `app/api/download-zip/route.ts`

Implement `GET /api/download-zip?ids=uuid1,uuid2,...`: UUID validation, max 50 IDs, DB lookup via `getGenerationsByIds`, sequential R2 fetch per `imageUrl`, ZIP creation via `jszip`, Response headers: `Content-Type: application/zip`, `Content-Disposition: attachment; filename="generations-{timestamp}.zip"`, individual files named `{generation-id}.png`.

New dependency: `jszip@3.10.1` — add to package.json before implementing.

**Test command:** `pnpm test app/api/download-zip/route.test.ts`

---

### Slice 12 — compare-modal

**File to create:** `components/compare/compare-modal.tsx`

Implement fullscreen radix-ui Dialog with 2x2 grid. Empty slots use `border-dashed` CSS. Per-image fullscreen toggle via `Maximize2` icon (lucide-react). ESC handling for single-image → grid return. Label format: `"{ModelDisplayName} · {width} x {height}"`.

Uses existing: `Generation` type from `lib/db/queries.ts`, `getModelById` from `lib/models.ts`.

**Test command:** `pnpm test components/compare/compare-modal`

---

### Slice 02 — chips-components

**Prerequisite:** slice-01 complete and tests passing.

**Files to create:**
- `components/workspace/aspect-ratio-chips.tsx` — Toggle chip group with embedded `CustomRatioInput`, disabled chips with radix-ui Tooltip, uses `validateCustomRatio` from `lib/aspect-ratio.ts`
- `components/workspace/size-chips.tsx` — Toggle chip group for xs/s/m/l/xl, shows pixel values from `SIZE_PRESETS`

**Test command:** `pnpm test components/workspace/aspect-ratio-chips.test.tsx components/workspace/size-chips.test.tsx`

---

### Slice 07 — generation-card-checkbox

**Prerequisite:** slice-06 complete and tests passing.

**File to modify:** `components/workspace/generation-card.tsx`

Add checkbox overlay top-left, blue border (`border-primary`) on selection, conditional click handler: `isSelecting` → `toggleSelection`, else → `onSelect`. Props interface unchanged.

Constraints: No new props, `useSelection` called directly inside card.

**Test command:** `pnpm test components/workspace/generation-card`

---

### Slice 09 — floating-action-bar

**Prerequisite:** slice-06 complete (for parent-level `selectedIds.size` derivation).

**File to create:** `components/workspace/floating-action-bar.tsx`

Pure presentational component. Props: `selectedCount`, `projects`, `onCancel`, `onSelectAll`, `onMove`, `onFavorite`, `onCompare`, `onDownload`, `onDelete`. Returns null when `selectedCount === 0`. Compare button disabled when `selectedCount < 2 || selectedCount > 4` with radix-ui Tooltip. Move via radix-ui DropdownMenu.

**Test command:** `pnpm test components/workspace/floating-action-bar`

---

### Slice 04 — prompt-area-integration

**Prerequisites:** slices 01, 02, 03 complete and tests passing.

**File to modify:** `components/workspace/prompt-area.tsx`

Mount `AspectRatioChips` (Row 7), `SizeChips` (Row 8), radix-ui `Collapsible` Advanced Settings with `ParameterPanel` inside (Row 9, default closed), `VariantStepper + GenerateButton` in flex row (Row 10). Model-wechsel reset via `parseRatioConfig(newSchema)`. Conditional rendering when `mapping === 'none'`. External props interface unchanged.

**Test command:** `pnpm test components/workspace/prompt-area`

---

### Slice 08 — gallery-grid-selection

**Prerequisites:** slices 06, 07 complete and tests passing.

**Files:**
- `components/workspace/gallery-header.tsx` (new) — title, imageCount, `favFilterActive`, `onFavFilterToggle` (Star icon from lucide-react)
- `components/workspace/gallery-grid.tsx` (modify) — read `isSelecting` from `useSelection`, apply `pb-24` when selecting. Props interface unchanged.

**Test command:** `pnpm test components/workspace/gallery-header components/workspace/gallery-grid`

---

### Slice 13 — lightbox-extensions

**Prerequisites:** slices 05, 06, 12 complete and tests passing.

**Files:**
- `components/lightbox/lightbox-move-dropdown.tsx` (new) — props: `generationId`, `currentProjectId`, `allProjects`, `onClose`. Calls `moveGeneration`, shows sonner toast, calls `onClose` on success.
- `components/lightbox/lightbox-compare-bar.tsx` (new) — props: `selectedCount`, `onCompare`, `onCancel`. Compare button disabled when `selectedCount < 2 || selectedCount > 4`.
- `components/lightbox/lightbox-modal.tsx` (modify) — integrate `LightboxMoveDropdown`, checkbox top-left (using `useSelection`), `LightboxCompareBar`, `CompareModal` on compare action.

Constraints: Lightbox compare selection is independent of gallery selection (same `SelectionContext` but `deselectAll` on cancel clears only lightbox-initiated selections in lightbox flow).

**Test command:** `pnpm test components/lightbox`

---

### Slice 10 — floating-action-bar-integration

**Prerequisites:** slices 05, 08, 09, 11, 12 complete and tests passing.

**File to modify:** `components/workspace/workspace-content.tsx`

Changes:
- Wrap with `SelectionProvider` from `lib/selection-state.tsx`
- Mount `GalleryHeader` with fav-filter state (local `useState`)
- Mount `FloatingActionBar` (conditional on `selectedIds.size > 0`)
- Wire all callbacks: `onDelete` → ConfirmDialog → `deleteGenerations`, `onMove` → ConfirmDialog → `moveGenerations`, `onFavorite` → `toggleFavorites({ ids, favorite: true })`, `onDownload` → `fetch("/api/download-zip?ids=...")` → blob download via `<a>` tag, `onCompare` → set `isCompareOpen = true`, `compareGenerations` filtered from `initialGenerations` by `selectedIds`
- Mount `CompareModal` with `isOpen={isCompareOpen}` and `generations={compareGenerations}`
- Success/error toasts via sonner
- `deselectAll()` after each successful bulk action

**Test command:** `pnpm test components/workspace/__tests__/workspace-content`

---

## Post-Slice Validation

For each completed slice run these validation steps:

```yaml
validation_steps:
  - step: "Deliverables Check"
    action: "Verify all files listed in DELIVERABLES_START...DELIVERABLES_END exist"

  - step: "Unit Tests"
    action: "Run test command from slice Metadata table"
    required: "All tests PASS (0 failures)"

  - step: "TypeScript Compilation"
    action: "pnpm build (or pnpm tsc --noEmit)"
    required: "No TypeScript errors"

  - step: "Integration Points"
    action: "Verify outputs are importable by dependent slices"
    reference: "integration-map.md Connections table"
```

---

## E2E Validation

After all slices are complete:

```yaml
e2e_validation:
  - step: "Start dev server"
    action: "pnpm dev"
    health_check: "GET http://localhost:3000 → 200"

  - step: "Run full test suite in dependency order"
    action: |
      pnpm test lib/aspect-ratio.test.ts
      pnpm test lib/selection-state
      pnpm test lib/db/queries.test.ts app/actions/generations.test.ts
      pnpm test components/workspace/aspect-ratio-chips.test.tsx components/workspace/size-chips.test.tsx
      pnpm test components/workspace/variant-stepper
      pnpm test components/workspace/generation-card
      pnpm test components/workspace/gallery-header components/workspace/gallery-grid
      pnpm test components/workspace/floating-action-bar
      pnpm test components/compare/compare-modal
      pnpm test app/api/download-zip/route.test.ts
      pnpm test components/lightbox
      pnpm test components/workspace/__tests__/workspace-content
      pnpm test components/workspace/prompt-area

  - step: "Execute e2e-checklist.md"
    action: "Work through all items in e2e-checklist.md"
    required: "All items checked"

  - step: "FOR each failing check"
    actions:
      - "Identify responsible slice from integration-map.md Connections table"
      - "Create fix task referencing the specific slice spec"
      - "Re-run affected slice tests after fix"

  - step: "Final Approval"
    condition: "ALL checks in e2e-checklist.md PASS"
    output: "Feature READY for merge"
```

---

## Rollback Strategy

```yaml
rollback:
  - condition: "Slice N fails (tests break)"
    action: "Revert only Slice N deliverables"
    note: "Dependencies (earlier slices) are stable and unaffected"

  - condition: "Slice 04 fails (PromptArea)"
    action: "Revert prompt-area.tsx only"
    note: "lib/aspect-ratio.ts, chips components, and variant-stepper remain — no breaking change for gallery area"

  - condition: "Slice 07 fails (GenerationCard)"
    action: "Revert generation-card.tsx only"
    note: "SelectionContext remains — gallery-grid and other consumers unaffected"

  - condition: "Slice 10 fails (WorkspaceContent integration)"
    action: "Revert workspace-content.tsx only"
    note: "All leaf components remain intact — can be re-integrated"

  - condition: "Slice 13 fails (Lightbox extensions)"
    action: "Revert lightbox-modal.tsx, lightbox-move-dropdown.tsx, lightbox-compare-bar.tsx"
    note: "CompareModal (slice-12) and SelectionContext (slice-06) remain stable"

  - condition: "Integration fails (cross-slice)"
    action: "Review integration-map.md Connections table for the specific broken connection"
    note: "May require targeted fix in one slice spec, not full rollback"
```

---

## Monitoring During Implementation

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| Slice completion time | More than 2x estimate | Flag for review, check for scope creep |
| Test failures | Any blocking failure | Stop, fix before proceeding to dependent slices |
| Deliverable file missing | Any listed file absent | Halt — deliverable is required for downstream slices |
| TypeScript errors after slice | Any error | Fix before proceeding |
| Integration test failure | Any | Trace in integration-map.md, identify responsible slice |

---

## Dependency Lock Order

The following constraints MUST be respected to avoid blocking:

```
slice-01 MUST complete before: slice-02, slice-04
slice-02 MUST complete before: slice-04
slice-03 MUST complete before: slice-04
slice-05 MUST complete before: slice-10, slice-13
slice-06 MUST complete before: slice-07, slice-08, slice-09, slice-10, slice-13
slice-07 MUST complete before: slice-08
slice-08 MUST complete before: slice-10
slice-09 MUST complete before: slice-10
slice-11 MUST complete before: slice-10
slice-12 MUST complete before: slice-10, slice-13
slice-04 CAN complete in parallel with: slice-08, slice-13
slice-10 is the FINAL integration slice — implements last
```
