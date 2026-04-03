# Orchestrator Configuration: Model Slots

**Integration Map:** `integration-map.md`
**E2E Checklist:** `e2e-checklist.md`
**Generated:** 2026-03-29

---

## Pre-Implementation Gates

```yaml
pre_checks:
  - name: "Gate 1: Architecture Compliance"
    file: "gates/compliance-architecture.md"
    required: "Verdict == APPROVED"

  - name: "Gate 2: All Slices Approved"
    files: "gates/compliance-slice-*.md"
    required: "ALL Verdict == APPROVED"
    count: 16

  - name: "Gate 3: Integration Map Valid"
    file: "gates/integration-map.md"
    required: "Missing Inputs == 0 AND Orphaned Outputs == 0 AND Semantic Consistency Gaps == 0"
```

---

## Implementation Order

Based on dependency analysis, slices are organized into 8 waves. Slices within the same wave can be executed in parallel.

| Wave | Slice | Name | Depends On | Parallel? |
|------|-------|------|------------|-----------|
| 1 | 01 | DB Schema + Migration | - | No (foundation) |
| 2 | 02 | DB Queries | 01 | No (single) |
| 3 | 03 | Types + resolve-model | 02 | No (single) |
| 4 | 04 | ModelSlotService | 02, 03 | No (single) |
| 5 | 05 | Server Actions | 04 | No (single) |
| 6 | 06 | ModelSlots UI Stacked | 05 | No (single) |
| 7 | 07 | ModelSlots UI Compact | 06 | Yes with 08, 09, 10, 11, 14 |
| 7 | 08 | Workspace Integration | 06 | Yes with 07, 09, 10, 11, 14 |
| 7 | 09 | Variation Popover | 06 | Yes with 07, 08, 10, 11, 14 |
| 7 | 10 | Img2img Popover | 06 | Yes with 07, 08, 09, 11, 14 |
| 7 | 11 | Upscale Popover | 06 | Yes with 07, 08, 09, 10, 14 |
| 7 | 14 | Settings Read-Only | 05 | Yes with 07, 08, 09, 10, 11 |
| 8a | 12 | Canvas Detail View | 05, 09, 10, 11 | Yes with 13 |
| 8a | 13 | Chat Panel | 07 | Yes with 12 |
| 9 | 15 | Cleanup Legacy | 08, 09, 10, 11, 12, 13, 14 | No (convergence) |
| 10 | 16 | E2E Flow Verification | 15 | No (final) |

### Wave Diagram

```
Wave 1:  [01 DB Schema]
Wave 2:  [02 DB Queries]
Wave 3:  [03 Types+Resolve]
Wave 4:  [04 SlotService]
Wave 5:  [05 Server Actions]
Wave 6:  [06 UI Stacked]
Wave 7:  [07 Compact] [08 Workspace] [09 Variation] [10 Img2img] [11 Upscale] [14 Settings]
Wave 8:  [12 Detail View] [13 Chat Panel]
Wave 9:  [15 Cleanup]
Wave 10: [16 E2E]
```

---

## Slice Execution Details

### Wave 1: Slice 01 -- DB Schema + Migration

```yaml
slice: slice-01-db-schema-migration
test_command: "pnpm test lib/db"
integration_command: "npx drizzle-kit push --dry-run"
acceptance_command: "npx drizzle-kit migrate"
mocking: no_mocks
deliverables:
  - lib/db/schema.ts (MODIFY)
  - drizzle/0012_add_model_slots.sql (NEW)
post_validation:
  - "SELECT count(*) FROM model_slots == 15"
  - "model_settings table does not exist"
```

### Wave 2: Slice 02 -- DB Queries

```yaml
slice: slice-02-db-queries
test_command: "pnpm test lib/db"
mocking: mock_external
deliverables:
  - lib/db/queries.ts (MODIFY)
post_validation:
  - "getAllModelSlots, getModelSlotsByMode, upsertModelSlot, seedModelSlotDefaults exported"
  - "getAllModelSettings, getModelSettingByModeTier, upsertModelSetting, seedModelSettingsDefaults NOT exported"
```

### Wave 3: Slice 03 -- Types + resolve-model

```yaml
slice: slice-03-types-resolve-model
test_command: "pnpm test lib/utils/resolve-model lib/__tests__/types"
integration_command: "pnpm tsc --noEmit"
mocking: no_mocks
deliverables:
  - lib/types.ts (MODIFY)
  - lib/utils/resolve-model.ts (MODIFY)
post_validation:
  - "SlotNumber and VALID_SLOTS exported from lib/types.ts"
  - "Tier and VALID_TIERS NOT exported from lib/types.ts"
  - "resolveActiveSlots exported from lib/utils/resolve-model.ts"
  - "resolveModel NOT exported"
known_breakage:
  - "Consumer files importing Tier or resolveModel will have TS errors until later slices"
```

### Wave 4: Slice 04 -- ModelSlotService

```yaml
slice: slice-04-model-slot-service
test_command: "pnpm test lib/services/model-slot-service"
mocking: mock_external
deliverables:
  - lib/services/model-slot-service.ts (NEW)
post_validation:
  - "ModelSlotService.getAll, getForMode, update, toggleActive, seedDefaults methods exist"
```

### Wave 5: Slice 05 -- Server Actions

```yaml
slice: slice-05-server-actions
test_command: "pnpm test app/actions/model-slots"
mocking: mock_external
deliverables:
  - app/actions/model-slots.ts (NEW)
  - app/actions/model-settings.ts (DELETE)
post_validation:
  - "getModelSlots, updateModelSlot, toggleSlotActive exported from model-slots.ts"
  - "app/actions/model-settings.ts does not exist"
known_breakage:
  - "Files importing from model-settings.ts will have TS errors until later slices"
```

### Wave 6: Slice 06 -- ModelSlots UI Stacked

```yaml
slice: slice-06-model-slots-ui-stacked
test_command: "pnpm test components/ui/model-slots"
mocking: mock_external
deliverables:
  - components/ui/model-slots.tsx (NEW)
post_validation:
  - "ModelSlots component renders 3 slot rows with checkbox + dropdown"
  - "variant prop accepts 'stacked' and 'compact'"
```

### Wave 7 (parallel): Slices 07, 08, 09, 10, 11, 14

```yaml
# All 6 slices can run in parallel
parallel_slices:
  - slice: slice-07-model-slots-ui-compact
    test_command: "pnpm test components/ui/model-slots"
    mocking: mock_external
    deliverables:
      - components/ui/model-slots.tsx (MODIFY)

  - slice: slice-08-workspace-integration
    test_command: "pnpm test components/workspace/prompt-area"
    mocking: mock_external
    deliverables:
      - components/workspace/prompt-area.tsx (MODIFY)

  - slice: slice-09-variation-popover
    test_command: "pnpm test components/canvas/popovers/variation-popover"
    mocking: mock_external
    deliverables:
      - components/canvas/popovers/variation-popover.tsx (MODIFY)

  - slice: slice-10-img2img-popover
    test_command: "pnpm test components/canvas/popovers/img2img-popover"
    mocking: mock_external
    deliverables:
      - components/canvas/popovers/img2img-popover.tsx (MODIFY)

  - slice: slice-11-upscale-popover
    test_command: "pnpm test components/canvas/popovers/upscale-popover"
    mocking: mock_external
    deliverables:
      - components/canvas/popovers/upscale-popover.tsx (MODIFY)

  - slice: slice-14-settings-read-only
    test_command: "pnpm test components/settings"
    mocking: mock_external
    deliverables:
      - components/settings/settings-dialog.tsx (MODIFY)
      - components/settings/model-mode-section.tsx (MODIFY)

conflict_note: >
  Slice 07 and Slice 08/09/10/11 all depend on Slice 06 but modify DIFFERENT files.
  Slice 07 modifies model-slots.tsx. Slices 08-11/14 modify consumer files.
  No file conflicts -- safe to parallelize.
  EXCEPTION: If running Slice 07 in the same agent as any of 08-11 that also
  imports model-slots.tsx, ensure Slice 07 completes first (it modifies the shared file).
```

### Wave 8 (parallel): Slices 12, 13

```yaml
parallel_slices:
  - slice: slice-12-canvas-detail-view
    test_command: "pnpm test components/canvas/canvas-detail-view"
    mocking: mock_external
    deliverables:
      - components/canvas/canvas-detail-view.tsx (MODIFY)

  - slice: slice-13-chat-panel
    test_command: "pnpm test components/canvas/canvas-chat-panel"
    mocking: mock_external
    deliverables:
      - components/canvas/canvas-chat-panel.tsx (MODIFY)
      - components/canvas/canvas-detail-view.tsx (MODIFY)

conflict_note: >
  CONFLICT: Both Slice 12 and Slice 13 modify canvas-detail-view.tsx.
  Slice 12 replaces modelSettings with modelSlots for popovers and event listener.
  Slice 13 updates ChatPanel props from modelSettings to modelSlots+models.
  RESOLUTION: Execute Slice 12 BEFORE Slice 13. Slice 13 explicitly depends on
  Slice 12's changes (it removes the temporary modelSettings mapping from AC-9).
  These CANNOT truly run in parallel despite being in the same wave.
  RECOMMENDED ORDER: Slice 12 first, then Slice 13.
```

### Wave 9: Slice 15 -- Cleanup Legacy

```yaml
slice: slice-15-cleanup-legacy
test_command: "pnpm tsc --noEmit"
acceptance_command: >
  grep -r "TierToggle\|tier-toggle\|model-settings-service\|VALID_TIERS\|model-settings-changed"
  --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v specs | grep -v drizzle
mocking: no_mocks
deliverables:
  - components/ui/tier-toggle.tsx (DELETE)
  - components/ui/max-quality-toggle.tsx (DELETE)
  - lib/services/model-settings-service.ts (DELETE)
  - app/actions/model-settings.ts (DELETE)
  - lib/types.ts (MODIFY)
  - components/canvas/popovers/variation-popover.tsx (MODIFY)
  - components/canvas/popovers/img2img-popover.tsx (MODIFY)
  - components/canvas/popovers/upscale-popover.tsx (MODIFY)
  - components/settings/settings-dialog.tsx (MODIFY)
post_validation:
  - "pnpm tsc --noEmit exits with code 0"
  - "grep returns 0 matches for legacy identifiers"
  - "grep returns 0 matches for imports from model-settings"
```

### Wave 10: Slice 16 -- E2E Flow Verification

```yaml
slice: slice-16-e2e-flow-verification
test_command: "pnpm exec playwright test e2e/model-slots.spec.ts"
acceptance_command: "pnpm exec playwright test e2e/model-slots.spec.ts --reporter=list"
start_command: "pnpm dev"
health_endpoint: "http://localhost:3000"
mocking: no_mocks
deliverables:
  - e2e/model-slots.spec.ts (NEW)
  - playwright.config.ts (NEW)
prerequisites:
  - "@playwright/test installed as devDependency"
post_validation:
  - "All 5 E2E tests pass"
```

---

## Post-Slice Validation

FOR each completed slice:

```yaml
validation_steps:
  - step: "Deliverables Check"
    action: "Verify all files listed in DELIVERABLES_START/END exist (NEW) or have been modified (MODIFY) or removed (DELETE)"

  - step: "Unit Tests"
    action: "Run the slice's test_command and verify all tests pass"

  - step: "Integration Points"
    action: "Verify outputs are accessible by dependent slices (imports compile, types match)"
    reference: "integration-map.md -> Connections table"

  - step: "Known Breakage Acknowledged"
    action: "For slices with known_breakage, verify breakage is limited to expected consumer files"
    note: "Waves 1-5 have deliberate breaking changes resolved in later waves"
```

---

## E2E Validation

AFTER all slices completed:

```yaml
e2e_validation:
  - step: "TypeScript Compilation"
    command: "pnpm tsc --noEmit"
    expected: "Exit code 0"
    blocking: true

  - step: "Legacy Cleanup Verification"
    command: >
      grep -r "TierToggle\|tier-toggle\|model-settings-service\|VALID_TIERS\|model-settings-changed"
      --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v specs | grep -v drizzle
    expected: "0 matches"
    blocking: true

  - step: "Unit Test Suite"
    command: "pnpm test"
    expected: "All tests pass"
    blocking: true

  - step: "E2E Test Suite"
    command: "pnpm exec playwright test e2e/model-slots.spec.ts"
    expected: "5/5 tests pass"
    blocking: true

  - step: "Execute e2e-checklist.md"
    action: "Walk through all happy path flows and edge cases"

  - step: "FOR each failing check"
    actions:
      - "Identify responsible slice from Integration Map"
      - "Create fix task with slice reference"
      - "Re-run affected slice tests"

  - step: "Final Approval"
    condition: "ALL checks in e2e-checklist.md PASS"
    output: "Feature READY for merge"
```

---

## Rollback Strategy

IF implementation fails:

```yaml
rollback:
  - condition: "Slice 01 fails (migration)"
    action: "Rollback migration SQL; model_settings table remains"
    note: "No downstream slices started yet"

  - condition: "Slice N (2-14) fails"
    action: "Revert Slice N changes only; re-run slice from scratch"
    note: "Dependencies are stable; upstream slices not affected"

  - condition: "Slice 15 fails (cleanup)"
    action: "Legacy paths still work; revert cleanup changes"
    note: "Feature is functional with legacy+new code coexisting"

  - condition: "Slice 16 fails (E2E)"
    action: "Debug failing test; identify responsible slice from Integration Map"
    note: "No production code in this slice; only test code to fix"

  - condition: "Integration between slices fails"
    action: "Review integration-map.md for the specific connection"
    note: "May need slice spec updates; re-run Gate 2 for affected slices"
```

---

## Monitoring

During implementation:

| Metric | Alert Threshold |
|--------|-----------------|
| Slice completion time | > 30 min per slice (foundation slices 01-05) |
| Slice completion time | > 45 min per slice (UI slices 06-14) |
| Slice completion time | > 60 min for cleanup (slice 15) |
| Test failures after slice | > 0 in slice's own test command |
| Deliverable missing | Any file not created/modified/deleted |
| TypeScript errors (post-slice 15) | Any (must be 0 after cleanup) |
| E2E test failure (slice 16) | Any of the 5 tests failing |

---

## File Modification Matrix

This matrix shows which files are touched by which slices. Critical for detecting conflicts in parallel execution.

| File | Slices | Type |
|------|--------|------|
| `lib/db/schema.ts` | 01 | MODIFY |
| `drizzle/0012_add_model_slots.sql` | 01 | NEW |
| `lib/db/queries.ts` | 02 | MODIFY |
| `lib/types.ts` | 03, 15 | MODIFY, MODIFY |
| `lib/utils/resolve-model.ts` | 03 | MODIFY |
| `lib/services/model-slot-service.ts` | 04 | NEW |
| `app/actions/model-slots.ts` | 05 | NEW |
| `app/actions/model-settings.ts` | 05, 15 | DELETE, DELETE |
| `components/ui/model-slots.tsx` | 06, 07 | NEW, MODIFY |
| `components/workspace/prompt-area.tsx` | 08 | MODIFY |
| `components/canvas/popovers/variation-popover.tsx` | 09, 15 | MODIFY, MODIFY |
| `components/canvas/popovers/img2img-popover.tsx` | 10, 15 | MODIFY, MODIFY |
| `components/canvas/popovers/upscale-popover.tsx` | 11, 15 | MODIFY, MODIFY |
| `components/canvas/canvas-detail-view.tsx` | 12, 13 | MODIFY, MODIFY |
| `components/canvas/canvas-chat-panel.tsx` | 13 | MODIFY |
| `components/settings/settings-dialog.tsx` | 14, 15 | MODIFY, MODIFY |
| `components/settings/model-mode-section.tsx` | 14 | MODIFY |
| `components/ui/tier-toggle.tsx` | 15 | DELETE |
| `components/ui/max-quality-toggle.tsx` | 15 | DELETE |
| `lib/services/model-settings-service.ts` | 15 | DELETE |
| `e2e/model-slots.spec.ts` | 16 | NEW |
| `playwright.config.ts` | 16 | NEW |

**Conflict-free parallel groups (Wave 7):**
- Slices 07, 08, 09, 10, 11, 14 each modify distinct files -- fully parallelizable.

**Sequential requirement (Wave 8):**
- Slice 12 then Slice 13 -- both modify `canvas-detail-view.tsx`.
