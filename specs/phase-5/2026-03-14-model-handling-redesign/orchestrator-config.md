# Orchestrator Configuration: Model Handling Redesign -- Draft/Quality Tier System

**Integration Map:** `integration-map.md`
**E2E Checklist:** `e2e-checklist.md`
**Generated:** 2026-03-14

---

## Pre-Implementation Gates

```yaml
pre_checks:
  - name: "Gate 1: Architecture Compliance"
    file: "compliance-architecture.md"
    required: "Verdict == APPROVED"

  - name: "Gate 2: All Slices Approved"
    files: "compliance-slice-*.md"
    required: "ALL Verdict == APPROVED (13/13)"

  - name: "Gate 3: Integration Map Valid"
    file: "integration-map.md"
    required: "Missing Inputs == 0, Gaps == 0"
```

---

## Implementation Order

Based on dependency analysis:

| Order | Slice | Name | Depends On | Parallel? |
|-------|-------|------|------------|-----------|
| 1 | 01 | DB Schema + Migration | -- | No (foundation) |
| 2 | 02 | Model Settings Service | 01 | No (sequential) |
| 3 | 03 | Server Actions + Types | 02 | No (sequential) |
| 4a | 04 | Settings Dialog UI | 03 | Yes with 05 |
| 4b | 05 | Tier Toggle Component | 03 | Yes with 04 |
| 5a | 06 | Workspace Prompt-Area Tier Toggle | 05 | Yes with 08 |
| 5b | 08 | Canvas Context Cleanup | 05 | Yes with 06 |
| 6 | 07 | Workspace Generation Integration | 06 | No (sequential after 06) |
| 7a | 09 | Canvas Variation+Img2Img Tier Toggle | 08 | Yes with 10, 11 |
| 7b | 10 | Canvas Upscale Tier Toggle | 08, 07 | Yes with 09, 11 (after 07 completes) |
| 7c | 11 | Canvas Chat Panel Tier Toggle | 08 | Yes with 09, 10 |
| 8 | 12 | Canvas Cleanup -- Remove Old UI | 09, 10, 11 | No (waits for all canvas slices) |
| 9 | 13 | Dead Code Cleanup + Deprecation | 12 | No (final) |

### Critical Path

```
01 -> 02 -> 03 -> 05 -> 06 -> 07 -> 10 -> 12 -> 13
                    |          |
                    +-> 04     +-> 08 -> 09 -> 12
                                    |
                                    +-> 11 -> 12
```

The longest path is: 01 -> 02 -> 03 -> 05 -> 08 -> 09/10/11 -> 12 -> 13 (9 sequential steps).

### Parallelization Opportunities

| Phase | Parallel Slices | Notes |
|-------|-----------------|-------|
| Phase 4 | Slice 04 + Slice 05 | Both depend only on Slice 03, no shared files |
| Phase 5 | Slice 06 + Slice 08 | Both depend on Slice 05, different file domains (workspace vs canvas) |
| Phase 7 | Slice 09 + Slice 10 + Slice 11 | All depend on Slice 08. Slice 10 also needs Slice 07. All touch different popover files. **Caution:** Slices 09, 10 all modify `canvas-detail-view.tsx` -- sequential execution recommended for these or merge carefully. |

### File Collision Warning

The following files are modified by multiple slices. Sequential execution is mandatory for these:

| File | Modified By (in order) |
|------|----------------------|
| `lib/db/schema.ts` | Slice 01, Slice 13 |
| `lib/db/queries.ts` | Slice 02, Slice 13 |
| `components/workspace/prompt-area.tsx` | Slice 06, Slice 07 |
| `components/canvas/canvas-detail-view.tsx` | Slice 08, Slice 09, Slice 10, Slice 12 |
| `app/actions/generations.ts` | Slice 07 |
| `lib/services/generation-service.ts` | Slice 07 |

---

## Post-Slice Validation

FOR each completed slice:

```yaml
validation_steps:
  - step: "Deliverables Check"
    action: "Verify all files listed in DELIVERABLES_START/END exist and were modified/created"

  - step: "Unit Tests"
    action: "Run test command from slice Test-Strategy"
    commands:
      slice-01: "pnpm test lib/db"
      slice-02: "pnpm test lib/services/model-settings-service lib/db/queries"
      slice-03: "pnpm test app/actions/model-settings lib/types"
      slice-04: "pnpm test components/settings components/workspace"
      slice-05: "pnpm test components/ui/tier-toggle components/ui/max-quality-toggle"
      slice-06: "pnpm test components/workspace/prompt-area"
      slice-07: "pnpm test components/workspace app/actions/generations lib/services/generation-service"
      slice-08: "pnpm test lib/canvas-detail-context components/canvas/canvas-detail-view"
      slice-09: "pnpm test components/canvas/popovers/variation-popover components/canvas/popovers/img2img-popover components/canvas/canvas-detail-view"
      slice-10: "pnpm test components/canvas/popovers/upscale-popover components/canvas/canvas-detail-view"
      slice-11: "pnpm test components/canvas/canvas-chat-panel"
      slice-12: "pnpm test components/canvas/canvas-detail-view components/canvas/canvas-header"
      slice-13: "pnpm lint && pnpm build"

  - step: "TypeScript Compilation"
    action: "pnpm tsc --noEmit"
    when: "After slices that remove code (06, 08, 12, 13)"

  - step: "Integration Points"
    action: "Verify outputs accessible by dependent slices"
    reference: "integration-map.md -> Connections"
```

---

## E2E Validation

AFTER all slices completed:

```yaml
e2e_validation:
  - step: "Execute e2e-checklist.md"
    action: "Walk through all Happy Path flows manually"

  - step: "Run full test suite"
    action: "pnpm test"

  - step: "Build verification"
    action: "pnpm build"

  - step: "Lint verification"
    action: "pnpm lint"

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
  - condition: "Slice 01 fails (DB migration)"
    action: "Drop model_settings table, remove migration file"
    note: "No other slice depends on running state yet"

  - condition: "Slice 02-03 fails (Service/Actions)"
    action: "Revert new files only (model-settings-service.ts, model-settings.ts, types.ts)"
    note: "DB migration can stay, no UI changes yet"

  - condition: "Slice 04-05 fails (UI components)"
    action: "Revert new component files. Revert workspace-header.tsx changes."
    note: "No generation logic changed yet"

  - condition: "Slice 06-07 fails (Workspace integration)"
    action: "Revert prompt-area.tsx, generations.ts, generation-service.ts to pre-slice state"
    note: "Canvas untouched. Settings dialog still functional standalone."

  - condition: "Slice 08-11 fails (Canvas integration)"
    action: "Revert canvas-detail-context.tsx, canvas-detail-view.tsx, affected popovers, chat-panel"
    note: "Workspace still functional. Canvas reverts to old model selection."

  - condition: "Slice 12-13 fails (Cleanup)"
    action: "Revert cleanup changes only. Feature works, just has dead code."
    note: "Non-critical. Can be retried independently."

  - condition: "Integration fails"
    action: "Review integration-map.md for gaps"
    note: "May need slice spec updates followed by Gate 2 re-review"
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
| TypeScript compilation error | Any (after each slice) |
| File collision detected | Slices modifying same file running in parallel |
