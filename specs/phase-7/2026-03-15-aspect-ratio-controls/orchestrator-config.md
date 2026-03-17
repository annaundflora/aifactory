# Orchestrator Configuration: Model Parameter Controls (Aspect Ratio, Size & Advanced)

**Integration Map:** `integration-map.md`
**E2E Checklist:** `e2e-checklist.md`
**Generated:** 2026-03-16

---

## Pre-Implementation Gates

```yaml
pre_checks:
  - name: "Gate 1: Architecture Compliance"
    file: "compliance-architecture.md"
    required: "Verdict == APPROVED"
    status: "PASSED"

  - name: "Gate 2: All Slices Approved"
    files: "compliance-slice-01.md through compliance-slice-07.md"
    required: "ALL Verdict == APPROVED"
    status: "PASSED (7/7)"

  - name: "Gate 3: Integration Map Valid"
    file: "integration-map.md"
    required: "Missing Inputs == 0, Orphaned Outputs == 0, Runtime Path Gaps == 0"
    status: "PASSED"
```

---

## Implementation Order

Based on dependency analysis from the integration map:

| Wave | Slice | Name | Depends On | Parallel? |
|------|-------|------|------------|-----------|
| 1 | 01 | resolveModel Utility | -- | No (foundation) |
| 2 | 02 | useModelSchema Hook | Slice 01 | No (sequential) |
| 3 | 03 | ParameterPanel Primary/Advanced Split | Slice 02 | No (sequential) |
| 4 | 04 | Prompt Panel Mount | Slice 03 | Yes with Slice 06 |
| 4 | 06 | Canvas Popovers Mount | Slice 03 | Yes with Slice 04 |
| 5 | 05 | Prompt Panel Merge | Slice 04 | Yes with Slice 07 |
| 5 | 07 | Canvas Handlers Merge | Slice 06 | Yes with Slice 05 |

**Rationale:**
- Waves 1-3 are strictly sequential (each depends on the previous)
- Wave 4: Slice 04 and Slice 06 both depend only on Slice 03 -- can run in parallel (different files: prompt-area.tsx vs popovers + canvas-detail-view.tsx)
- Wave 5: Slice 05 depends on Slice 04, Slice 07 depends on Slice 06 -- both can run in parallel (Slice 05 modifies prompt-area.tsx, Slice 07 modifies canvas-detail-view.tsx -- no file overlap)

---

## Slice Execution Details

### Wave 1: Slice 01 -- resolveModel Utility

```yaml
slice:
  id: "slice-01-resolve-model-utility"
  spec: "slices/slice-01-resolve-model-utility.md"
  test_command: "pnpm test lib/utils/resolve-model.test.ts"
  acceptance_command: "pnpm tsc --noEmit"
  deliverables:
    - "lib/utils/resolve-model.ts" # NEW
    - "components/workspace/prompt-area.tsx" # MODIFY
  validation:
    - "Unit tests pass"
    - "No inline resolveModel in prompt-area.tsx"
    - "TypeScript compiles cleanly"
```

### Wave 2: Slice 02 -- useModelSchema Hook

```yaml
slice:
  id: "slice-02-use-model-schema-hook"
  spec: "slices/slice-02-use-model-schema-hook.md"
  test_command: "pnpm test lib/hooks/use-model-schema.test.ts"
  acceptance_command: "pnpm tsc --noEmit"
  mocking: "mock_external (getModelSchema server action)"
  deliverables:
    - "lib/hooks/use-model-schema.ts" # NEW
  validation:
    - "Unit tests pass (success, loading, error, undefined, refetch, race condition)"
    - "TypeScript compiles cleanly"
```

### Wave 3: Slice 03 -- ParameterPanel Primary/Advanced Split

```yaml
slice:
  id: "slice-03-parameter-panel-split"
  spec: "slices/slice-03-parameter-panel-split.md"
  test_command: "pnpm test components/workspace/parameter-panel.test.tsx"
  acceptance_command: "pnpm tsc --noEmit"
  deliverables:
    - "components/workspace/parameter-panel.tsx" # MODIFY
  validation:
    - "Unit tests pass (primary/advanced split, INTERNAL_FIELDS, type filter, aspect ratio grouping)"
    - "Existing ParameterPanel behavior preserved when primaryFields not passed"
    - "TypeScript compiles cleanly"
```

### Wave 4a: Slice 04 -- Prompt Panel Mount (parallel with 4b)

```yaml
slice:
  id: "slice-04-prompt-panel-mount"
  spec: "slices/slice-04-prompt-panel-mount.md"
  test_command: "pnpm test components/workspace/prompt-area.test.tsx"
  acceptance_command: "pnpm tsc --noEmit"
  mocking: "mock_external (useModelSchema, getModelSchema)"
  deliverables:
    - "components/workspace/prompt-area.tsx" # MODIFY
  validation:
    - "ParameterPanel visible in txt2img and img2img modes"
    - "imageParams state updates on selection change"
    - "imageParams reset on tier change"
    - "Mode persistence works"
    - "No ParameterPanel in upscale mode"
    - "TypeScript compiles cleanly"
```

### Wave 4b: Slice 06 -- Canvas Popovers Mount (parallel with 4a)

```yaml
slice:
  id: "slice-06-canvas-popovers-mount"
  spec: "slices/slice-06-canvas-popovers-mount.md"
  test_command: "pnpm test components/canvas/popovers/variation-popover.test.tsx components/canvas/popovers/img2img-popover.test.tsx"
  acceptance_command: "pnpm tsc --noEmit"
  mocking: "mock_external (useModelSchema, resolveModel)"
  deliverables:
    - "components/canvas/popovers/variation-popover.tsx" # MODIFY
    - "components/canvas/popovers/img2img-popover.tsx" # MODIFY
    - "components/canvas/canvas-detail-view.tsx" # MODIFY
  validation:
    - "ParameterPanel visible in both popovers"
    - "imageParams in onGenerate callback"
    - "modelSettings prop passed from canvas-detail-view"
    - "Handler merge works (ACs 7-8)"
    - "TypeScript compiles cleanly"
  note: "This slice also includes initial handler merge in canvas-detail-view.tsx (ACs 7-8). Slice 07 adds defensive edge cases."
```

### Wave 5a: Slice 05 -- Prompt Panel Merge (parallel with 5b)

```yaml
slice:
  id: "slice-05-prompt-panel-merge"
  spec: "slices/slice-05-prompt-panel-merge.md"
  test_command: "pnpm test components/workspace/prompt-area.test.tsx"
  acceptance_command: "pnpm tsc --noEmit"
  mocking: "mock_external (generateImages server action)"
  deliverables:
    - "components/workspace/prompt-area.tsx" # MODIFY
  validation:
    - "generateImages called with merged params (modelParams + imageParams)"
    - "imageParams overrides same-key modelParams"
    - "Empty imageParams = no change from pre-feature behavior"
    - "Upscale unaffected"
    - "TypeScript compiles cleanly"
```

### Wave 5b: Slice 07 -- Canvas Handlers Merge (parallel with 5a)

```yaml
slice:
  id: "slice-07-canvas-handlers-merge"
  spec: "slices/slice-07-canvas-handlers-merge.md"
  test_command: "pnpm test components/canvas/canvas-detail-view.test.tsx"
  acceptance_command: "pnpm tsc --noEmit"
  mocking: "mock_external (generateImages server action)"
  deliverables:
    - "components/canvas/canvas-detail-view.tsx" # MODIFY
  validation:
    - "handleVariationGenerate merges imageParams alongside prompt_strength"
    - "handleImg2imgGenerate merges imageParams into empty params"
    - "undefined imageParams handled defensively (?? {})"
    - "TypeScript compiles cleanly"
  note: "Builds on Slice 06 changes to canvas-detail-view.tsx. Adds defensive undefined handling."
```

---

## Post-Slice Validation

FOR each completed slice:

```yaml
validation_steps:
  - step: "Deliverables Check"
    action: "Verify all files listed in DELIVERABLES_START/END exist and were modified"

  - step: "Unit Tests"
    action: "Run slice-specific test command"
    fallback: "If test file does not exist yet, Test-Writer agent creates it from Test Skeletons"

  - step: "TypeScript Compilation"
    action: "pnpm tsc --noEmit"
    blocking: true

  - step: "Integration Points"
    action: "Verify outputs accessible by dependent slices (check exports, interfaces)"
    reference: "integration-map.md > Connections table"
```

---

## E2E Validation

AFTER all slices completed:

```yaml
e2e_validation:
  - step: "Full Test Suite"
    command: "pnpm test"
    blocking: true

  - step: "TypeScript Compilation"
    command: "pnpm tsc --noEmit"
    blocking: true

  - step: "Build Check"
    command: "pnpm build"
    blocking: true

  - step: "Execute e2e-checklist.md"
    action: "Walk through all Happy Path and Edge Case tests"

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
    action: "Revert lib/utils/resolve-model.ts and prompt-area.tsx import change"
    impact: "Blocks all subsequent slices"

  - condition: "Slice 02 fails"
    action: "Revert lib/hooks/use-model-schema.ts"
    impact: "Blocks slices 03-07"

  - condition: "Slice 03 fails"
    action: "Revert parameter-panel.tsx changes"
    impact: "Blocks slices 04-07"
    note: "Slice 01 and 02 remain stable (no UI dependency)"

  - condition: "Slice 04 or 05 fails (prompt panel)"
    action: "Revert prompt-area.tsx changes from failing slice only"
    impact: "Canvas popovers (Slice 06-07) unaffected"
    note: "Slices 01-03 remain stable"

  - condition: "Slice 06 or 07 fails (canvas popovers)"
    action: "Revert popover + canvas-detail-view changes from failing slice"
    impact: "Prompt panel (Slice 04-05) unaffected"
    note: "Slices 01-05 remain stable"

  - condition: "Integration fails"
    action: "Review integration-map.md for gaps, check cross-slice connections"
    note: "Most likely cause: prop/interface mismatch between slices"
```

---

## Monitoring

During implementation:

| Metric | Alert Threshold |
|--------|-----------------|
| Slice completion time | > 30 min per slice |
| Test failures | > 0 blocking |
| TypeScript errors after slice | Any |
| Deliverable missing | Any |
| Integration test fail | Any |

---

## File Modification Summary

Complete list of files touched across all slices:

| File | Slices | Type |
|------|--------|------|
| `lib/utils/resolve-model.ts` | 01 | NEW |
| `lib/hooks/use-model-schema.ts` | 02 | NEW |
| `components/workspace/parameter-panel.tsx` | 03 | MODIFY |
| `components/workspace/prompt-area.tsx` | 01, 04, 05 | MODIFY (3 waves) |
| `components/canvas/popovers/variation-popover.tsx` | 06 | MODIFY |
| `components/canvas/popovers/img2img-popover.tsx` | 06 | MODIFY |
| `components/canvas/canvas-detail-view.tsx` | 06, 07 | MODIFY (2 waves) |
