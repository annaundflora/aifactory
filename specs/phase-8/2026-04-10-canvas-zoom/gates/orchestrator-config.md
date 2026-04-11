# Orchestrator Configuration: Canvas Zoom & Pan

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

  - name: "Gate 2: All Slices Approved"
    files: "gates/compliance-slice-*.md"
    required: "ALL Verdict == APPROVED"
    count: 9

  - name: "Gate 3: Integration Map Valid"
    file: "gates/integration-map.md"
    required: "Missing Inputs == 0, Runtime Path Gaps == 0, Semantic Gaps == 0"
```

---

## Implementation Order

Based on dependency analysis:

| Wave | Slice | Name | Depends On | Parallel? |
|------|-------|------|------------|-----------|
| 1 | 01 | Zoom State Extension | -- | No (foundation) |
| 2 | 02 | Zoom Hook + Transform Wrapper | slice-01 | No (core infrastructure) |
| 3 | 03 | ZoomControls UI Component | slice-02 | Yes with 04, 06, 07 |
| 3 | 04 | Wheel + Keyboard Event Handler | slice-02 | Yes with 03, 06, 07 |
| 3 | 06 | MaskCanvas + SAM Zoom-Fix | slice-02 | Yes with 03, 04, 07 |
| 3 | 07 | Touch Pinch-Zoom + Pan | slice-02 | Yes with 03, 04, 06 |
| 4 | 05 | Space+Drag Pan | slice-04 | Yes with 08, 09 |
| 4 | 08 | Double-Tap + Swipe Guard | slice-07 | Yes with 05, 09 |
| 4 | 09 | Procreate Stroke-Undo | slice-07 | Yes with 05, 08 |

### Wave Details

**Wave 1 (Sequential):** Slice 01 -- Foundation state extension. Must complete before anything else.

**Wave 2 (Sequential):** Slice 02 -- Core hook and transform wrapper. All subsequent slices depend on this.

**Wave 3 (Parallel -- 4 slices):** Slices 03, 04, 06, 07 -- All depend only on slice-02. Can be implemented in parallel. Each modifies `canvas-detail-view.tsx` but in distinct, non-overlapping sections.

**Wave 4 (Parallel -- 3 slices):** Slices 05, 08, 09 -- Depend on Wave 3 slices. Can be implemented in parallel. Slice 05 depends on slice-04. Slices 08 and 09 depend on slice-07.

### MODIFY-Chain Ordering Within Waves

When slices in Wave 3 are implemented in parallel, the orchestrator should merge them in this order to minimize conflict:

1. **Slice 02** (creates transform wrapper in canvas-detail-view.tsx)
2. **Slice 06** (modifies mask-canvas.tsx + canvas-detail-view.tsx SAM handler)
3. **Slice 03** (adds ZoomControls mount to canvas-detail-view.tsx)
4. **Slice 04** (adds event listeners to canvas-detail-view.tsx)
5. **Slice 07** (adds touch setup to canvas-detail-view.tsx)

For Wave 4:
6. **Slice 05** (adds cursor/pointer to canvas-detail-view.tsx + mask-canvas.tsx guard)
7. **Slice 08** (adds swipe guard to canvas-detail-view.tsx + double-tap to use-touch-gestures.ts)
8. **Slice 09** (adds stroke-undo to use-touch-gestures.ts + exposes refs in mask-canvas.tsx)

---

## Post-Slice Validation

FOR each completed slice:

```yaml
validation_steps:
  - step: "Deliverables Check"
    action: "Verify all files listed in DELIVERABLES_START..DELIVERABLES_END exist and are modified"

  - step: "Unit Tests"
    action: "Run the slice-specific test command from Metadata"
    commands:
      slice-01: "pnpm test __tests__/lib/canvas-detail-context.test.ts"
      slice-02: "pnpm test __tests__/lib/hooks/use-canvas-zoom.test.ts __tests__/components/canvas/canvas-detail-view.test.tsx __tests__/components/canvas/canvas-image.test.tsx"
      slice-03: "pnpm test __tests__/components/canvas/zoom-controls.test.tsx"
      slice-04: "pnpm test __tests__/lib/hooks/use-canvas-zoom-events.test.ts"
      slice-05: "pnpm test __tests__/lib/hooks/use-canvas-zoom-space-drag.test.ts"
      slice-06: "pnpm test __tests__/components/canvas/mask-canvas.test.tsx __tests__/components/canvas/canvas-detail-view-sam.test.tsx"
      slice-07: "pnpm test __tests__/lib/hooks/use-touch-gestures.test.ts"
      slice-08: "pnpm test __tests__/lib/hooks/use-touch-gestures-double-tap.test.ts __tests__/components/canvas/canvas-detail-view-swipe-guard.test.tsx"
      slice-09: "pnpm test __tests__/lib/hooks/use-touch-gestures.test.ts __tests__/components/canvas/mask-canvas.test.tsx"

  - step: "Regression Check"
    action: "Run full test suite to verify no existing tests break"
    command: "pnpm test"

  - step: "Integration Points"
    action: "Verify outputs accessible by dependent slices"
    reference: "integration-map.md -> Connections table"
```

---

## E2E Validation

AFTER all slices completed:

```yaml
e2e_validation:
  - step: "Run full test suite"
    command: "pnpm test"
    expected: "All tests pass (existing + new)"

  - step: "Execute e2e-checklist.md"
    action: "Walk through each happy-path flow and edge case"

  - step: "Cross-slice MODIFY chain verification"
    action: "Verify files modified by multiple slices have no conflicts"
    critical_files:
      - "components/canvas/canvas-detail-view.tsx (7 slices)"
      - "lib/hooks/use-canvas-zoom.ts (3 slices)"
      - "components/canvas/mask-canvas.tsx (3 slices)"
      - "lib/hooks/use-touch-gestures.ts (3 slices)"

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
  - condition: "Wave 1 (Slice 01) fails"
    action: "Revert Slice 01 changes to canvas-detail-context.tsx"
    note: "No downstream impact (nothing built yet)"

  - condition: "Wave 2 (Slice 02) fails"
    action: "Revert Slice 02 changes (use-canvas-zoom.ts, canvas-detail-view.tsx, canvas-image.tsx)"
    note: "Slice 01 state extension can remain (additive, non-breaking)"

  - condition: "Wave 3 slice fails"
    action: "Revert only the failing slice's changes"
    note: "Wave 3 slices are independent of each other"

  - condition: "Wave 4 slice fails"
    action: "Revert the failing slice"
    note: "Wave 4 slices are independent of each other. Core zoom functionality (Waves 1-3) remains intact"

  - condition: "Integration fails across MODIFY chains"
    action: "Review integration-map.md MODIFY-chain analysis"
    note: "Most likely cause: conflicting modifications to canvas-detail-view.tsx"
    recovery: "Re-implement conflicting slices sequentially instead of parallel"
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
| Existing test regression | Any (run pnpm test after each slice) |
| MODIFY-chain conflict | Any merge conflict in shared files |

---

## Implementation Notes

### Key Risk: canvas-detail-view.tsx MODIFY Chain

This file is modified by 7 slices (02, 03, 04, 05, 06, 07, 08). Each modification is additive and touches different sections:

| Slice | Section Modified |
|-------|------------------|
| 02 | Transform-Wrapper-Div around CanvasImage+MaskCanvas+OutpaintControls |
| 03 | Mount ZoomControls component (new JSX element) |
| 04 | addEventListener for wheel (passive:false) + keydown, mouseenter/mouseleave |
| 05 | Cursor style binding + pointer event handlers |
| 06 | handleClickEditImageClick coordinate normalization |
| 07 | useTouchGestures hook integration + touch-action:none |
| 08 | handleTouchEnd swipe guard (zoomLevel === fitLevel check) |

If parallel implementation causes merge conflicts, fall back to sequential implementation in the order listed above.

### No Prerequisites Needed

This is a pure frontend feature. No backend changes, no database schema, no API routes, no health endpoints. The feature can be implemented immediately after Gate 3 approval.
