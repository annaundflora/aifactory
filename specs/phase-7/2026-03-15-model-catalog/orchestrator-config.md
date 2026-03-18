# Orchestrator Configuration: Model Catalog

**Integration Map:** `integration-map.md`
**E2E Checklist:** `e2e-checklist.md`
**Generated:** 2026-03-18

---

## Pre-Implementation Gates

```yaml
pre_checks:
  - name: "Gate 1: Architecture Compliance"
    file: "compliance-architecture.md"
    required: "Verdict == APPROVED"
    status: "PASSED"

  - name: "Gate 2: All Slices Approved"
    files: "compliance-slice-*.md"
    required: "ALL Verdict == APPROVED"
    status: "PASSED (12/12)"

  - name: "Gate 3: Integration Map Valid"
    file: "integration-map.md"
    required: "Missing Inputs == 0"
    status: "PASSED (0 missing)"
```

---

## Implementation Order

Based on dependency analysis:

| Wave | Order | Slice | Name | Depends On | Parallel? |
|------|-------|-------|------|------------|-----------|
| 1 | 1 | 01 | DB Schema & Migration | -- | Yes with 02 |
| 1 | 1 | 02 | Capability Detection | -- | Yes with 01 |
| 2 | 2 | 03 | Catalog Service | 01 | No (needs S01) |
| 3 | 3 | 04 | Sync Service | 01, 02, 03 | No (needs S03) |
| 3 | 3 | 06 | Server Actions | 03 | Yes with 04 |
| 3 | 3 | 07 | Service Replacement | 03 | Yes with 04, 06 |
| 4 | 4 | 05 | Sync Route Handler | 04 | No (needs S04) |
| 4 | 4 | 08 | Types & Seed Update | 06, 07 | Yes with 05 |
| 5 | 5 | 09 | Sync Button | 05, 08 | No (needs S05, S08) |
| 5 | 5 | 10 | Dropdown Filter | 06, 08 | Yes with 09 |
| 6 | 6 | 11 | Auto-Sync | 09, 10 | No (needs S09, S10) |
| 7 | 7 | 12 | Cleanup | 06, 07, 10, 11 | No (final slice) |

### Wave Summary

| Wave | Slices | Can Parallel | Notes |
|------|--------|-------------|-------|
| Wave 1 | S01, S02 | Yes | Foundation: DB + Pure Functions (no dependencies) |
| Wave 2 | S03 | No | Read layer on top of DB schema |
| Wave 3 | S04, S06, S07 | Yes | Backend services (all depend on S03) |
| Wave 4 | S05, S08 | Yes | Route handler + type/config updates |
| Wave 5 | S09, S10 | Yes | UI: Sync button + dropdown filter |
| Wave 6 | S11 | No | Auto-sync + loading state |
| Wave 7 | S12 | No | Final cleanup of legacy code |

---

## Slice Execution Details

### Wave 1

#### Slice 01: DB Schema & Migration

```yaml
slice: slice-01-db-schema
spec: slices/slice-01-db-schema.md
test_command: "pnpm test lib/db/__tests__/models-schema.test.ts"
integration_command: "pnpm drizzle-kit generate"
acceptance_command: "pnpm drizzle-kit generate --dry-run"
deliverables:
  - lib/db/schema.ts (MODIFY)
  - drizzle/0011_add_models_table.sql (NEW)
```

#### Slice 02: Capability Detection

```yaml
slice: slice-02-capability-detection
spec: slices/slice-02-capability-detection.md
test_command: "pnpm test lib/services/__tests__/capability-detection.test.ts"
acceptance_command: "pnpm test lib/services/__tests__/capability-detection.test.ts"
deliverables:
  - lib/services/capability-detection.ts (NEW)
```

### Wave 2

#### Slice 03: Catalog Service

```yaml
slice: slice-03-catalog-service
spec: slices/slice-03-catalog-service.md
test_command: "pnpm test lib/services/__tests__/model-catalog-service.test.ts"
acceptance_command: "pnpm test lib/services/__tests__/model-catalog-service.test.ts"
deliverables:
  - lib/services/model-catalog-service.ts (NEW)
  - lib/db/queries.ts (MODIFY)
requires_completed: [slice-01-db-schema]
```

### Wave 3

#### Slice 04: Sync Service

```yaml
slice: slice-04-sync-service
spec: slices/slice-04-sync-service.md
test_command: "pnpm test lib/services/__tests__/model-sync-service.test.ts"
acceptance_command: "pnpm test lib/services/__tests__/model-sync-service.test.ts"
deliverables:
  - lib/services/model-sync-service.ts (NEW)
  - lib/db/queries.ts (MODIFY)
requires_completed: [slice-01-db-schema, slice-02-capability-detection, slice-03-catalog-service]
```

#### Slice 06: Server Actions

```yaml
slice: slice-06-server-actions
spec: slices/slice-06-server-actions.md
test_command: "pnpm test app/actions/__tests__/models.test.ts"
acceptance_command: "pnpm test app/actions/__tests__/models.test.ts"
deliverables:
  - app/actions/models.ts (MODIFY)
requires_completed: [slice-03-catalog-service]
```

#### Slice 07: Service Replacement

```yaml
slice: slice-07-service-replace
spec: slices/slice-07-service-replace.md
test_command: "pnpm test lib/services/__tests__/generation-service.test.ts lib/services/__tests__/model-settings-service.test.ts"
acceptance_command: "pnpm test lib/services/__tests__/generation-service.test.ts lib/services/__tests__/model-settings-service.test.ts"
deliverables:
  - lib/services/generation-service.ts (MODIFY)
  - lib/services/model-settings-service.ts (MODIFY)
requires_completed: [slice-03-catalog-service]
```

### Wave 4

#### Slice 05: Sync Route Handler

```yaml
slice: slice-05-sync-route
spec: slices/slice-05-sync-route.md
test_command: "pnpm test app/api/models/sync/__tests__/route.test.ts"
acceptance_command: "pnpm test app/api/models/sync/__tests__/route.test.ts"
deliverables:
  - app/api/models/sync/route.ts (NEW)
requires_completed: [slice-04-sync-service]
```

#### Slice 08: Types & Seed Update

```yaml
slice: slice-08-types-seed
spec: slices/slice-08-types-seed.md
test_command: "pnpm test lib/__tests__/types.test.ts components/settings/__tests__/model-mode-section.test.ts lib/db/__tests__/queries-seed.test.ts"
acceptance_command: "pnpm tsc --noEmit"
deliverables:
  - lib/types.ts (MODIFY)
  - components/settings/model-mode-section.tsx (MODIFY)
  - lib/db/queries.ts (MODIFY)
requires_completed: [slice-06-server-actions, slice-07-service-replace]
```

### Wave 5

#### Slice 09: Sync Button & Progress Toast

```yaml
slice: slice-09-sync-button
spec: slices/slice-09-sync-button.md
test_command: "pnpm test components/settings/__tests__/settings-dialog-sync.test.ts"
acceptance_command: "pnpm test components/settings/__tests__/settings-dialog-sync.test.ts"
deliverables:
  - components/settings/settings-dialog.tsx (MODIFY)
requires_completed: [slice-05-sync-route, slice-08-types-seed]
```

#### Slice 10: Dropdown Capability-Filter

```yaml
slice: slice-10-dropdown-filter
spec: slices/slice-10-dropdown-filter.md
test_command: "pnpm test components/settings/__tests__/settings-dialog-filter.test.ts components/settings/__tests__/model-mode-section-filter.test.ts"
acceptance_command: "pnpm test components/settings/__tests__/settings-dialog-filter.test.ts components/settings/__tests__/model-mode-section-filter.test.ts"
deliverables:
  - components/settings/settings-dialog.tsx (MODIFY)
  - components/settings/model-mode-section.tsx (MODIFY)
requires_completed: [slice-06-server-actions, slice-08-types-seed]
```

### Wave 6

#### Slice 11: Auto-Sync & On-the-fly Schema-Fetch

```yaml
slice: slice-11-auto-sync
spec: slices/slice-11-auto-sync.md
test_command: "pnpm test components/settings/__tests__/settings-dialog-auto-sync.test.ts lib/hooks/__tests__/use-model-schema-loading.test.ts"
acceptance_command: "pnpm test components/settings/__tests__/settings-dialog-auto-sync.test.ts lib/hooks/__tests__/use-model-schema-loading.test.ts"
deliverables:
  - components/settings/settings-dialog.tsx (MODIFY)
  - lib/hooks/use-model-schema.ts (MODIFY)
requires_completed: [slice-09-sync-button, slice-10-dropdown-filter]
```

### Wave 7

#### Slice 12: Cleanup (Legacy Removal)

```yaml
slice: slice-12-cleanup
spec: slices/slice-12-cleanup.md
test_command: "pnpm vitest run"
integration_command: "npx tsc --noEmit"
acceptance_command: "npx tsc --noEmit && pnpm vitest run"
deliverables:
  - lib/services/collection-model-service.ts (DELETE)
  - lib/services/model-schema-service.ts (DELETE)
  - lib/types/collection-model.ts (DELETE)
  - components/models/model-card.tsx (MODIFY)
  - components/models/model-trigger.tsx (MODIFY)
  - components/models/model-browser-drawer.tsx (MODIFY)
  - components/canvas/canvas-model-selector.tsx (MODIFY)
  - lib/hooks/use-model-filters.ts (MODIFY)
requires_completed: [slice-06-server-actions, slice-07-service-replace, slice-10-dropdown-filter, slice-11-auto-sync]
```

---

## Multi-Slice File Coordination

Files modified by multiple slices require sequential execution:

| File | Slices (in order) | Wave Ordering |
|------|-------------------|---------------|
| `lib/db/queries.ts` | S03 (read queries) -> S04 (write queries) -> S08 (seed update) | Wave 2 -> Wave 3 -> Wave 4 |
| `components/settings/settings-dialog.tsx` | S09 (sync button) -> S10 (dropdown filter) -> S11 (auto-sync) | Wave 5 -> Wave 5 -> Wave 6 |
| `components/settings/model-mode-section.tsx` | S08 (constants) -> S10 (props/logic) | Wave 4 -> Wave 5 |

**IMPORTANT for Wave 5:** Slice 09 and Slice 10 both modify `settings-dialog.tsx`. While their dependency chains allow parallel execution, the file modification must be sequential. **Recommended: Execute Slice 09 before Slice 10** since Slice 10 references Slice 09's sync-state (even though it's not a formal dependency).

---

## Post-Slice Validation

FOR each completed slice:

```yaml
validation_steps:
  - step: "Deliverables Check"
    action: "Verify all files in DELIVERABLES_START/END exist"

  - step: "Unit Tests"
    action: "Run slice-specific test command"

  - step: "TypeScript Compilation"
    action: "pnpm tsc --noEmit (verify no type errors)"

  - step: "Integration Points"
    action: "Verify outputs accessible by dependent slices"
    reference: "integration-map.md -> Connections table"
```

---

## E2E Validation

AFTER all slices completed:

```yaml
e2e_validation:
  - step: "Full Test Suite"
    command: "pnpm vitest run"
    expected: "All tests pass (including new + existing)"

  - step: "TypeScript Compilation"
    command: "npx tsc --noEmit"
    expected: "0 errors"

  - step: "Legacy Code Check"
    command: "grep -r 'collection-model-service\\|model-schema-service\\|from.*collection-model' --include='*.ts' --include='*.tsx' lib/ app/ components/"
    expected: "0 results"

  - step: "Execute e2e-checklist.md"
    action: "Walk through all Happy Path + Edge Case checks"

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
  - condition: "Slice 01 fails (DB Schema)"
    action: "Revert schema.ts changes. Delete migration file if generated."
    note: "No downstream impact -- foundation slice"

  - condition: "Slice 02-04 fail (Backend Services)"
    action: "Revert service file changes only"
    note: "DB schema (Slice 01) remains stable"

  - condition: "Slice 05-06 fail (API Layer)"
    action: "Revert route handler / server action changes"
    note: "Services remain functional, just not exposed"

  - condition: "Slice 07 fails (Service Replacement)"
    action: "Revert generation-service.ts and model-settings-service.ts"
    note: "Old services still exist (cleanup not done yet)"

  - condition: "Slice 08-11 fail (UI Layer)"
    action: "Revert UI component changes"
    note: "Backend services work independently of UI"

  - condition: "Slice 12 fails (Cleanup)"
    action: "Do NOT delete legacy files until all tests pass"
    note: "Legacy files are still importable until explicit deletion"

  - condition: "Integration fails"
    action: "Review integration-map.md for gaps"
    note: "May need slice spec updates via Gate 2 re-run"
```

---

## Monitoring

During implementation:

| Metric | Alert Threshold |
|--------|-----------------|
| Slice completion time | > 2x estimate |
| Test failures | > 0 blocking |
| Deliverable missing | Any |
| Integration test fail | Any |
| TypeScript compilation errors | Any |
| Legacy import remaining after S12 | Any |
