# Orchestrator Configuration: Canvas Detail-View & Editing Flow

**Integration Map:** `integration-map.md`
**E2E Checklist:** `e2e-checklist.md`
**Generated:** 2026-03-13

---

## Pre-Implementation Gates

```yaml
pre_checks:
  - name: "Gate 1: Architecture Compliance"
    file: "specs/phase-4/2026-03-13-canvas-detail-view/architecture.md"
    required: "Architecture document exists and is finalized"

  - name: "Gate 2: All Slices Approved"
    files: "specs/phase-4/2026-03-13-canvas-detail-view/slices/compliance-slice-*.md"
    required: "ALL Verdict == APPROVED (18/18)"

  - name: "Gate 3: Integration Map Valid"
    file: "specs/phase-4/2026-03-13-canvas-detail-view/integration-map.md"
    required: "Missing Inputs == 0, Orphaned Outputs == 0, Runtime Path Gaps == 0"
```

---

## Implementation Order

Based on dependency analysis:

| Order | Slice | Name | Depends On | Parallel? |
|-------|-------|------|------------|-----------|
| 1 | 01 | DB Schema -- batchId Column | -- | No (foundation) |
| 2 | 02 | batchId Service + Queries | 01 | No (sequential) |
| 3 | 03 | CanvasDetailContext | 02 | Yes with 04 |
| 3 | 04 | getSiblingGenerations Action | 02 | Yes with 03 |
| 4 | 05 | Detail-View Shell | 03 | No (key dependency for many) |
| 5 | 06 | Animated Transition | 05 | Yes with 07, 08, 09 |
| 5 | 07 | Toolbar UI | 05 | Yes with 06, 08, 09 |
| 5 | 08 | Siblings + Prev/Next Navigation | 04, 05 | Yes with 06, 07, 09 |
| 5 | 09 | Chat Panel UI | 05 | Yes with 06, 07, 08 |
| 6 | 10 | Details Overlay | 07 | Yes with 11, 12, 13 |
| 6 | 11 | Variation Popover | 07 | Yes with 10, 12, 13 |
| 6 | 12 | img2img Popover | 07 | Yes with 10, 11, 13 |
| 6 | 13 | Upscale Popover | 07 | Yes with 10, 11, 12 |
| 7 | 14 | In-Place Generation | 11, 12, 13 | No (integration slice) |
| 8 | 15 | Undo/Redo | 14 | No (sequential) |
| 9 | 16 | Canvas Agent Backend | 15 | No (backend, sequential) |
| 10 | 17 | Chat Frontend Integration | 09, 14, 16 | No (integration slice) |
| 11 | 18 | Lightbox Removal | 08 | No (cleanup, can run after 08 is done) |

**Notes on parallelism:**
- Order 3: Slices 03 and 04 both depend only on 02 and have no mutual dependency.
- Order 5: Slices 06, 07, 08, 09 all depend on 05 but not on each other. Slice 08 additionally depends on 04 which completes in Order 3.
- Order 6: Slices 10, 11, 12, 13 all depend on 07 but not on each other.
- Slice 18 depends on 08 (Order 5) but has no dependency on slices 09-17. It can be implemented any time after Order 5. Recommended: implement after all other slices are done (Order 11) to minimize conflicts.

---

## Post-Slice Validation

FOR each completed slice:

```yaml
validation_steps:
  - step: "Deliverables Check"
    action: "Verify all files in DELIVERABLES_START section exist and are non-empty"

  - step: "Unit Tests"
    action: "Run test command from slice Metadata: pnpm test <path>"
    success: "All tests pass with 0 failures"

  - step: "Type Check"
    action: "Run pnpm tsc --noEmit"
    success: "No TypeScript compilation errors"

  - step: "Integration Points"
    action: "Verify outputs accessible by dependent slices"
    reference: "integration-map.md -> Connections table"

  - step: "Backend Slices (Slice 16 only)"
    action: "Run cd backend && python -m pytest tests/ -v --timeout=30"
    success: "All backend tests pass"
```

---

## Slice-Specific Validation Commands

| Slice | Test Command | Integration Check |
|-------|-------------|-------------------|
| 01 | `pnpm test lib/db/__tests__/schema.test.ts` | `pnpm drizzle-kit generate` |
| 02 | `pnpm test lib/db/__tests__/queries-batch.test.ts lib/services/__tests__/generation-service-batch.test.ts` | `pnpm tsc --noEmit` |
| 03 | `pnpm test lib/__tests__/canvas-detail-context.test.ts` | `pnpm tsc --noEmit` |
| 04 | `pnpm test app/actions/__tests__/get-siblings.test.ts` | `pnpm tsc --noEmit` |
| 05 | `pnpm test components/canvas/__tests__/canvas-detail-view.test.tsx components/canvas/__tests__/canvas-header.test.tsx components/workspace/__tests__/workspace-content-detail.test.tsx` | `pnpm tsc --noEmit` |
| 06 | `pnpm test __tests__/next-config-view-transition.test.ts components/workspace/__tests__/generation-card-transition.test.tsx components/canvas/__tests__/canvas-detail-view-transition.test.tsx` | `pnpm tsc --noEmit` |
| 07 | `pnpm test components/canvas/__tests__/canvas-toolbar.test.tsx components/canvas/__tests__/toolbar-button.test.tsx` | `pnpm tsc --noEmit` |
| 08 | `pnpm test components/canvas/__tests__/sibling-thumbnails.test.tsx components/canvas/__tests__/canvas-navigation.test.tsx components/canvas/__tests__/canvas-image.test.tsx` | `pnpm tsc --noEmit` |
| 09 | `pnpm test components/canvas/__tests__/canvas-chat-panel.test.tsx components/canvas/__tests__/canvas-chat-messages.test.tsx components/canvas/__tests__/canvas-chat-input.test.tsx` | `pnpm tsc --noEmit` |
| 10 | `pnpm test components/canvas/__tests__/details-overlay.test.tsx` | `pnpm tsc --noEmit` |
| 11 | `pnpm test components/canvas/__tests__/variation-popover.test.tsx` | `pnpm tsc --noEmit` |
| 12 | `pnpm test components/canvas/__tests__/img2img-popover.test.tsx` | `pnpm tsc --noEmit` |
| 13 | `pnpm test components/canvas/__tests__/upscale-popover.test.tsx` | `pnpm tsc --noEmit` |
| 14 | `pnpm test components/canvas/__tests__/in-place-generation.test.tsx` | `pnpm tsc --noEmit` |
| 15 | `pnpm test components/canvas/__tests__/undo-redo.test.tsx` | `pnpm tsc --noEmit` |
| 16 | `cd backend && python -m pytest tests/test_canvas_agent.py tests/test_canvas_assistant_service.py tests/test_canvas_sessions.py -v` | `cd backend && python -m pytest tests/ -v --timeout=30` |
| 17 | `pnpm test lib/__tests__/canvas-chat-service.test.ts components/canvas/__tests__/canvas-chat-integration.test.tsx` | `pnpm tsc --noEmit` |
| 18 | `pnpm test components/workspace/workspace-content.test.tsx` | `pnpm tsc --noEmit` |

---

## E2E Validation

AFTER all slices completed:

```yaml
e2e_validation:
  - step: "Type Check (Full)"
    action: "pnpm tsc --noEmit"
    condition: "Zero errors"

  - step: "Full Test Suite (Frontend)"
    action: "pnpm test"
    condition: "All tests pass"

  - step: "Full Test Suite (Backend)"
    action: "cd backend && python -m pytest tests/ -v --timeout=30"
    condition: "All tests pass"

  - step: "Execute e2e-checklist.md"
    action: "Walk through all Happy Path flows manually"
    reference: "e2e-checklist.md"

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
  - condition: "Slice N fails and has no dependents yet"
    action: "Revert Slice N changes only"
    note: "Dependencies are stable"

  - condition: "Slice 01 or 02 fails (DB/Service foundation)"
    action: "Revert all changes (no slice can work without batchId)"
    note: "Foundation slices are blocking"

  - condition: "Integration slice fails (14 or 17)"
    action: "Review integration-map.md connections for the failing inputs"
    note: "May need upstream slice spec updates"

  - condition: "Backend slice fails (16)"
    action: "Revert backend changes only, frontend slices 01-15 remain stable"
    note: "Frontend and backend are decoupled until Slice 17"

  - condition: "Lightbox removal (18) causes regressions"
    action: "Revert Slice 18 only, keep both lightbox and detail-view temporarily"
    note: "Detail-view works independently of lightbox removal"
```

---

## File Manifest

All new files created across slices:

### Frontend (TypeScript/React)

| File | Created By | Modified By |
|------|-----------|-------------|
| `lib/db/schema.ts` | -- (existing) | slice-01 |
| `drizzle/XXXX_add_batch_id.sql` | slice-01 | -- |
| `lib/db/queries.ts` | -- (existing) | slice-02 |
| `lib/services/generation-service.ts` | -- (existing) | slice-02 |
| `lib/canvas-detail-context.tsx` | slice-03 | slice-15 |
| `app/actions/generations.ts` | -- (existing) | slice-04 |
| `components/canvas/canvas-detail-view.tsx` | slice-05 | slice-06, slice-14 |
| `components/canvas/canvas-header.tsx` | slice-05 | slice-15 |
| `components/workspace/workspace-content.tsx` | -- (existing) | slice-05, slice-18 |
| `next.config.ts` | -- (existing) | slice-06 |
| `components/workspace/generation-card.tsx` | -- (existing) | slice-06 |
| `components/canvas/canvas-toolbar.tsx` | slice-07 | -- |
| `components/canvas/toolbar-button.tsx` | slice-07 | -- |
| `components/canvas/sibling-thumbnails.tsx` | slice-08 | -- |
| `components/canvas/canvas-navigation.tsx` | slice-08 | -- |
| `components/canvas/canvas-image.tsx` | slice-08 | slice-14 |
| `components/canvas/canvas-chat-panel.tsx` | slice-09 | slice-17 |
| `components/canvas/canvas-chat-messages.tsx` | slice-09 | slice-17 |
| `components/canvas/canvas-chat-input.tsx` | slice-09 | -- |
| `components/canvas/details-overlay.tsx` | slice-10 | -- |
| `components/canvas/popovers/variation-popover.tsx` | slice-11 | -- |
| `components/canvas/popovers/img2img-popover.tsx` | slice-12 | -- |
| `components/canvas/popovers/upscale-popover.tsx` | slice-13 | -- |
| `components/canvas/canvas-model-selector.tsx` | slice-14 | -- |
| `lib/canvas-chat-service.ts` | slice-17 | -- |

### Backend (Python/FastAPI)

| File | Created By | Modified By |
|------|-----------|-------------|
| `backend/app/agent/canvas_graph.py` | slice-16 | -- |
| `backend/app/services/canvas_assistant_service.py` | slice-16 | -- |
| `backend/app/routes/canvas_sessions.py` | slice-16 | -- |

### Files Removed

| File | Removed By | Reason |
|------|-----------|--------|
| `components/lightbox/lightbox-modal.tsx` | slice-18 | Replaced by CanvasDetailView |
| `components/lightbox/lightbox-navigation.tsx` | slice-18 | Replaced by CanvasNavigation |

---

## Monitoring

During implementation:

| Metric | Alert Threshold |
|--------|-----------------|
| Slice completion time | > 2x estimate |
| Test failures | > 0 blocking |
| Deliverable missing | Any |
| Integration test fail | Any |
| TypeScript compilation errors | > 0 |
| Backend test failures | > 0 |
