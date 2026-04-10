# Orchestrator Configuration: iPad Canvas Download Fix + Gallery Scroll Restore

**Integration Map:** `integration-map.md`
**E2E Checklist:** `e2e-checklist.md`
**Generated:** 2026-04-10

---

## Pre-Implementation Gates

```yaml
pre_checks:
  - name: "Gate 1: Architecture Compliance"
    file: "gates/compliance-architecture.md"
    required: "Verdict == APPROVED"
    status: "APPROVED"

  - name: "Gate 2: All Slices Approved"
    files: "gates/compliance-slice-*.md"
    required: "ALL Verdict == APPROVED"
    status: "4/4 APPROVED"

  - name: "Gate 3: Integration Map Valid"
    file: "gates/integration-map.md"
    required: "Missing Inputs == 0, Gaps == 0"
    status: "READY FOR ORCHESTRATION"
```

---

## Implementation Order

Based on dependency analysis, there are two independent tracks that can run in parallel:

| Wave | Slice | Name | Depends On | Parallel? | File |
|------|-------|------|------------|-----------|------|
| 1 | 01 | downloadImage Web Share API Branch | -- | Yes, with Slice 03 | `lib/utils.ts` |
| 1 | 03 | Gallery Scroll -- Refs am Container | -- | Yes, with Slice 01 | `components/workspace/workspace-content.tsx` |
| 2 | 02 | Toolbar handleDownload AbortError Verify | Slice 01 | Yes, with Slice 04 | `components/canvas/canvas-toolbar.tsx` |
| 2 | 04 | Gallery Scroll -- Save/Restore in Handlers | Slice 03 | Yes, with Slice 02 | `components/workspace/workspace-content.tsx` |

**Wave 1** (foundations, no dependencies):
- Slice 01 and Slice 03 can be implemented in parallel -- they modify different files (`lib/utils.ts` vs `workspace-content.tsx`)

**Wave 2** (dependents):
- Slice 02 depends on Slice 01 completion (needs downloadImage AbortError behavior)
- Slice 04 depends on Slice 03 completion (needs galleryScrollRef + scrollTopRef in workspace-content.tsx)
- Slice 02 and Slice 04 can be implemented in parallel -- they modify different files (`canvas-toolbar.tsx` vs `workspace-content.tsx`)

**Note on workspace-content.tsx:** Slice 03 (Wave 1) and Slice 04 (Wave 2) both modify `workspace-content.tsx`. Slice 04 MUST wait for Slice 03 to complete, as it depends on the refs that Slice 03 creates.

---

## Post-Slice Validation

FOR each completed slice:

```yaml
validation_steps:
  - step: "Deliverables Check"
    action: "Verify all files in DELIVERABLES_START exist and were modified"

  - step: "Unit Tests"
    actions:
      slice-01: "pnpm vitest run lib/__tests__/download-utils.test.ts"
      slice-02: "pnpm vitest run components/canvas/__tests__/canvas-toolbar.test.tsx"
      slice-03: "pnpm vitest run components/workspace/__tests__/workspace-content-detail.test.tsx"
      slice-04: "pnpm vitest run components/workspace/__tests__/workspace-content-detail.test.tsx"

  - step: "Integration Points"
    action: "Verify outputs accessible by dependent slices"
    reference: "integration-map.md -> Connections"
    checks:
      after_slice_01: "downloadImage still exports (url: string, filename: string) => Promise<void>"
      after_slice_03: "galleryScrollRef and scrollTopRef exist in workspace-content.tsx"
```

---

## E2E Validation

AFTER all slices completed:

```yaml
e2e_validation:
  - step: "Run all test suites"
    commands:
      - "pnpm vitest run lib/__tests__/download-utils.test.ts"
      - "pnpm vitest run components/canvas/__tests__/canvas-toolbar.test.tsx"
      - "pnpm vitest run components/workspace/__tests__/workspace-content-detail.test.tsx"

  - step: "Execute e2e-checklist.md"
    action: "Walk through all happy paths, edge cases, and regression checks"

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
  - condition: "Slice 01 fails"
    action: "Revert lib/utils.ts changes"
    impact: "Slice 02 cannot proceed"
    note: "Download track blocked, Scroll track unaffected"

  - condition: "Slice 02 fails"
    action: "Revert canvas-toolbar.tsx changes (if any)"
    impact: "No downstream dependencies"
    note: "Slice 01 changes remain stable"

  - condition: "Slice 03 fails"
    action: "Revert workspace-content.tsx ref additions"
    impact: "Slice 04 cannot proceed"
    note: "Scroll track blocked, Download track unaffected"

  - condition: "Slice 04 fails"
    action: "Revert workspace-content.tsx handler changes"
    impact: "No downstream dependencies"
    note: "Slice 03 ref additions remain stable"

  - condition: "Integration fails"
    action: "Review integration-map.md for gaps"
    note: "Tracks are independent; one track can ship without the other"
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

**Estimated complexity per slice:**

| Slice | Files Modified | Lines Changed (est.) | Complexity |
|-------|---------------|---------------------|------------|
| 01 | 1 (lib/utils.ts) | ~20 lines | Medium (branching logic) |
| 02 | 1 (canvas-toolbar.tsx) | 0-5 lines | Low (verification, likely no change) |
| 03 | 1 (workspace-content.tsx) | ~3 lines | Low (two useRef + one ref attribute) |
| 04 | 1 (workspace-content.tsx) | ~8 lines | Medium (handler logic + rAF timing) |
