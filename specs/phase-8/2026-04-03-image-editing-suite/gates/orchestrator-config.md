# Orchestrator Configuration: AI Image Editing Suite

**Integration Map:** `integration-map.md`
**E2E Checklist:** `e2e-checklist.md`
**Generated:** 2026-04-04

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
    count: 17

  - name: "Gate 3: Integration Map Valid"
    file: "gates/integration-map.md"
    required: "Missing Inputs == 0 AND Runtime Path Gaps == 0 AND Discovery Coverage == 100%"
```

---

## Implementation Order

Based on dependency analysis, the 16 slices are organized into 6 waves:

### Wave 1: Foundation (No Dependencies)

| Order | Slice | Name | Depends On | Parallel? |
|-------|-------|------|------------|-----------|
| 1.1 | 01 | Types & Model Slot Defaults | -- | Yes with 1.2 |
| 1.2 | 02 | Canvas Detail Context Extension | 01 | Sequence after 01 within wave |

**Note:** Slice 01 must complete before Slice 02 starts (02 depends on 01). However, the wave can start immediately.

### Wave 2: UI Components + Backend Services

| Order | Slice | Name | Depends On | Parallel? |
|-------|-------|------|------------|-----------|
| 2.1 | 03 | Mask Canvas Component | 02 | Yes with 2.2, 2.3, 2.4 |
| 2.2 | 06a | Generation Service Extension | 01 | Yes with 2.1, 2.3, 2.4 |
| 2.3 | 06b | Canvas Agent Extension (Python) | 01 | Yes with 2.1, 2.2, 2.4 |
| 2.4 | 12 | Outpaint Controls UI | 02 | Yes with 2.1, 2.2, 2.3 |

**Note:** All 4 slices depend only on Wave 1 outputs and can run in parallel.

### Wave 3: Brush Toolbar + Mask Service

| Order | Slice | Name | Depends On | Parallel? |
|-------|-------|------|------------|-----------|
| 3.1 | 04 | Floating Brush Toolbar | 02, 03 | Yes with 3.2 |
| 3.2 | 05 | Mask Service | 03 | Yes with 3.1 |

**Note:** Both depend on Slice 03 from Wave 2. Can run in parallel with each other.

### Wave 4: Core Integration

| Order | Slice | Name | Depends On | Parallel? |
|-------|-------|------|------------|-----------|
| 4.1 | 07 | Inpaint Chat-Panel Integration | 02, 04, 05, 06a, 06b | No (hub slice) |

**Note:** Slice 07 is the central integration hub. It requires all Wave 2 and Wave 3 outputs. Must run alone to establish the action-Switch framework that Waves 5 and 6 extend.

### Wave 5: Feature Branches + Keyboard + SAM

| Order | Slice | Name | Depends On | Parallel? |
|-------|-------|------|------------|-----------|
| 5.1 | 08 | Instruction Editing Flow | 07 | Yes with 5.2, 5.3, 5.4, 5.5 |
| 5.2 | 09 | Erase Direct Flow | 07 | Yes with 5.1, 5.3, 5.4, 5.5 |
| 5.3 | 10 | SAM API Route | 07 | Yes with 5.1, 5.2, 5.4, 5.5 |
| 5.4 | 14 | Keyboard Shortcuts & Mask Undo | 03, 04 | Yes with 5.1, 5.2, 5.3, 5.5 |
| 5.5 | 15 | Navigation Lock & State Cleanup | 07 | Yes with 5.1, 5.2, 5.3, 5.4 |

**Note:** All 5 slices can run in parallel. Slice 14 depends on Wave 2-3 (03, 04) but not on 07, so it's eligible for Wave 5.

### Wave 6: Final Integration + E2E

| Order | Slice | Name | Depends On | Parallel? |
|-------|-------|------|------------|-----------|
| 6.1 | 11 | Click-to-Edit Frontend | 07, 10 | Yes with 6.2 |
| 6.2 | 13 | Outpaint Integration | 07, 12 | Yes with 6.1 |
| 6.3 | 16 | E2E Smoke Tests | 07, 08, 09, 11, 13 | No (must be last) |

**Note:** Slices 11 and 13 can run in parallel. Slice 16 must run after all other slices complete.

---

## Wave Execution Summary

```
Wave 1:  [01] -> [02]                              (sequential)
Wave 2:  [03] [06a] [06b] [12]                     (4 parallel)
Wave 3:  [04] [05]                                  (2 parallel)
Wave 4:  [07]                                       (1 sequential -- hub)
Wave 5:  [08] [09] [10] [14] [15]                   (5 parallel)
Wave 6:  [11] [13] -> [16]                          (2 parallel, then E2E)
```

**Total waves:** 6
**Max parallelism:** 5 (Wave 5)
**Critical path:** 01 -> 02 -> 03 -> 05 -> 07 -> 10 -> 11 -> 16

---

## Post-Slice Validation

FOR each completed slice:

```yaml
validation_steps:
  - step: "Deliverables Check"
    action: "Verify all files listed in DELIVERABLES_START section exist and are non-empty"

  - step: "Unit Tests"
    action: "Run the Test Command from slice metadata"
    example: "pnpm test lib/__tests__/types.test.ts"

  - step: "Acceptance Tests"
    action: "Run the Acceptance Command from slice metadata"
    example: "pnpm test -- --run"

  - step: "Integration Points"
    action: "Verify outputs are accessible by dependent slices"
    reference: "integration-map.md -> Connections table"

  - step: "No Regressions"
    action: "Run full test suite to verify no existing tests broke"
    frontend: "pnpm test -- --run"
    backend: "cd backend && python -m pytest tests/ -v"
```

---

## Slice-Specific Test Commands

| Slice | Test Command | Stack |
|-------|-------------|-------|
| 01 | `pnpm test lib/__tests__/types.test.ts` | typescript-nextjs |
| 02 | `pnpm test lib/__tests__/canvas-detail-context.test.ts` | typescript-nextjs |
| 03 | `pnpm test components/canvas/__tests__/mask-canvas.test.tsx` | typescript-nextjs |
| 04 | `pnpm test components/canvas/__tests__/floating-brush-toolbar.test.tsx` | typescript-nextjs |
| 05 | `pnpm test lib/services/__tests__/mask-service.test.ts` | typescript-nextjs |
| 06a | `pnpm test lib/services/__tests__/generation-service-edit.test.ts` | typescript-nextjs |
| 06b | `cd backend && python -m pytest tests/unit/test_canvas_agent_edit.py -v` | python-fastapi |
| 07 | `pnpm test components/canvas/__tests__/canvas-chat-panel-inpaint.test.tsx lib/__tests__/canvas-chat-service-edit.test.ts components/canvas/__tests__/canvas-toolbar-edit.test.tsx` | typescript-nextjs |
| 08 | `pnpm test components/canvas/__tests__/canvas-chat-panel-instruction.test.tsx` | typescript-nextjs |
| 09 | `pnpm test components/canvas/__tests__/canvas-erase-flow.test.tsx` | typescript-nextjs |
| 10 | `pnpm test app/api/sam/__tests__/segment-route.test.ts` | typescript-nextjs |
| 11 | `pnpm test components/canvas/__tests__/canvas-detail-view-click-edit.test.tsx` | typescript-nextjs |
| 12 | `pnpm test components/canvas/__tests__/outpaint-controls.test.tsx` | typescript-nextjs |
| 13 | `pnpm test components/canvas/__tests__/canvas-detail-view-outpaint.test.tsx components/canvas/__tests__/canvas-chat-panel-outpaint.test.tsx lib/services/__tests__/generation-service-outpaint.test.ts` | typescript-nextjs |
| 14 | `pnpm test components/canvas/__tests__/mask-canvas-keyboard.test.tsx` | typescript-nextjs |
| 15 | `pnpm test components/canvas/__tests__/canvas-navigation-lock.test.tsx components/canvas/__tests__/canvas-toolbar-mutual-exclusion.test.tsx` | typescript-nextjs |
| 16 | `npx playwright test e2e/image-editing-suite.spec.ts` | playwright |

---

## Multi-Slice File Coordination

The following files are modified by multiple slices. The orchestrator MUST execute these slices in the specified order to avoid merge conflicts:

| File | Slices (in order) | Coordination Strategy |
|------|-------------------|----------------------|
| `components/canvas/canvas-detail-view.tsx` | 03 -> 04 -> 09 -> 11 -> 13 -> 15 | Sequential within waves. Each adds distinct new children/handlers. No overlapping code regions. |
| `components/canvas/canvas-chat-panel.tsx` | 07 -> 08 -> 13 | Sequential. Each adds a new branch to action-Switch. |
| `components/canvas/canvas-toolbar.tsx` | 07 -> 15 | Sequential. 07 adds ToolDefs, 15 adds mutual-exclusion logic. |
| `lib/services/generation-service.ts` | 06a -> 13 | Sequential. 06a adds validation + branch skeleton, 13 fills in outpaint specifics. |
| `components/canvas/floating-brush-toolbar.tsx` | 04 -> 09 | Sequential. 04 creates, 09 wires erase onClick. |
| `components/canvas/mask-canvas.tsx` | 03 -> 14 | Sequential. 03 creates, 14 adds keyboard + undo. |

---

## E2E Validation

AFTER all slices completed:

```yaml
e2e_validation:
  - step: "Run full frontend test suite"
    command: "pnpm test -- --run"
    expected: "All tests pass"

  - step: "Run full backend test suite"
    command: "cd backend && python -m pytest tests/ -v"
    expected: "All tests pass"

  - step: "Run E2E smoke tests"
    command: "npx playwright test e2e/image-editing-suite.spec.ts"
    expected: "5 tests pass (inpaint, erase, instruction, click-to-edit, outpaint)"

  - step: "Execute e2e-checklist.md"
    action: "Manually verify all checklist items"

  - step: "FOR each failing check"
    actions:
      - "Identify responsible slice from Integration Map"
      - "Create fix task with slice reference"
      - "Re-run affected slice tests"

  - step: "Final Approval"
    condition: "ALL checks in e2e-checklist.md PASS AND ALL test suites green"
    output: "Feature READY for merge"
```

---

## Rollback Strategy

IF implementation fails:

```yaml
rollback:
  - condition: "Slice in Wave 1-3 fails"
    action: "Revert failed slice changes only. No downstream slices exist yet."
    note: "Foundation slices are independent."

  - condition: "Slice 07 (hub) fails"
    action: "Revert Slice 07. All Wave 5-6 slices cannot proceed."
    note: "This is the critical integration point. Debug thoroughly before retrying."

  - condition: "Wave 5 slice fails (08, 09, 10, 14, 15)"
    action: "Revert failed slice. Other Wave 5 slices are unaffected (parallel)."
    note: "Each Wave 5 slice is independent of other Wave 5 slices."

  - condition: "Wave 6 slice fails (11, 13)"
    action: "Revert failed slice. The other Wave 6 slice is unaffected."
    note: "Slice 16 (E2E) must wait until the fix is applied."

  - condition: "Integration test fails post-completion"
    action: "Review integration-map.md Connections table for the failing path."
    note: "May need slice spec updates or implementation fixes."
```

---

## Monitoring

During implementation:

| Metric | Alert Threshold |
|--------|-----------------|
| Slice completion time | > 2x estimate |
| Test failures per slice | > 0 blocking |
| Deliverable missing | Any |
| Integration test failures | Any |
| Multi-file coordination conflict | Any merge conflict |
| Backend health endpoint | Not responding during Wave 2 (slice 06b) |

---

## VERDICT: READY FOR ORCHESTRATION
