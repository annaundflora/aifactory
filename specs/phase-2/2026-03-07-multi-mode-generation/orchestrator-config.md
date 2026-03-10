# Orchestrator Configuration: Multi-Mode Generation (img2img + Upscale)

**Integration Map:** `integration-map.md`
**E2E Checklist:** `e2e-checklist.md`
**Generated:** 2026-03-09

---

## Pre-Implementation Gates

```yaml
pre_checks:
  - name: "Gate 1: Architecture Compliance"
    file: "specs/phase-2/2026-03-07-multi-mode-generation/compliance-architecture.md"
    required: "Verdict == APPROVED"

  - name: "Gate 2: All Slices Approved"
    files: "specs/phase-2/2026-03-07-multi-mode-generation/slices/compliance-slice-*.md"
    required: "ALL 17 Verdicts == APPROVED"
    count: 17

  - name: "Gate 3: Integration Map Valid"
    file: "specs/phase-2/2026-03-07-multi-mode-generation/integration-map.md"
    required: "Missing Inputs == 0 AND Gaps == 0"
    status: "READY FOR ORCHESTRATION"
```

---

## Implementation Order

Based on dependency analysis from `integration-map.md`:

| Order | Slice | Name | Depends On | Parallel With |
|-------|-------|------|------------|---------------|
| 1 | slice-01 | DB Schema — Neue Spalten | — | Yes, with 03, 04, 05, 10, 11, 13, 15 |
| 1 | slice-03 | Storage Client — ContentType | — | Yes, with 01, 04, 05, 10, 11, 13, 15 |
| 1 | slice-04 | Model Schema Service — supportsImg2Img | — | Yes, with 01, 03, 05, 10, 11, 13, 15 |
| 1 | slice-05 | Models — UPSCALE_MODEL | — | Yes, with 01, 03, 04, 10, 11, 13, 15 |
| 1 | slice-10 | WorkspaceState Extension | — | Yes, with 01, 03, 04, 05, 11, 13, 15 |
| 1 | slice-11 | ModeSelector Component | — | Yes, with 01, 03, 04, 05, 10, 13, 15 |
| 1 | slice-13 | StrengthSlider Component | — | Yes, with 01, 03, 04, 05, 10, 11, 15 |
| 1 | slice-15 | FilterChips + ModeBadge | — | Yes, with 01, 03, 04, 05, 10, 11, 13 |
| 2 | slice-02 | DB Queries — createGeneration | slice-01 | Yes, with 08 |
| 2 | slice-08 | Action: uploadSourceImage | slice-03 | Yes, with 02 |
| 3 | slice-06 | Generation Service — img2img | slice-01, slice-02, slice-04 | Yes, with 07 |
| 3 | slice-07 | Generation Service — upscale | slice-02, slice-05 | Yes, with 06 |
| 3 | slice-12 | ImageDropzone Component | slice-08 | Yes, with 06, 07, 16 |
| 3 | slice-16 | Gallery Filter + Badge Integration | slice-01, slice-15 | Yes, with 06, 07, 12 |
| 4 | slice-09 | Server Actions — generate img2img + upscaleImage | slice-06, slice-07, slice-08 | No (integration point) |
| 5 | slice-14 | PromptArea Refactoring | slice-09, slice-10, slice-11, slice-12, slice-13 | Yes, with 17 |
| 5 | slice-17 | Lightbox — Cross-Mode Buttons | slice-09, slice-10 | Yes, with 14 |

**Total Waves:** 5
**Maximum Parallel:** 8 slices in wave 1

---

## Pre-Implementation Setup

```yaml
setup_steps:
  - name: "Install Shadcn Popover"
    command: "npx shadcn@latest add popover"
    required_before: "slice-17"
    note: "Required by lightbox-modal.tsx for Upscale scale selector"

  - name: "Apply DB Migration"
    command: "npx drizzle-kit generate && npx drizzle-kit migrate"
    required_after: "slice-01"
    required_before: "any runtime testing"
    note: "Adds generationMode, sourceImageUrl, sourceGenerationId columns to generations table"
```

---

## Post-Slice Validation

For each completed slice, the Orchestrator runs the following validation steps:

```yaml
validation_steps:
  - step: "Deliverables Check"
    action: "Verify all files listed between DELIVERABLES_START and DELIVERABLES_END exist"

  - step: "Unit Tests"
    action: "Run test command from slice Metadata"
    pass_criteria: "Exit code 0, no failing tests"

  - step: "Integration Points"
    action: "Verify outputs accessible by dependent slices per integration-map.md Connections table"
```

### Per-Slice Validation Commands

| Slice | Test Command | Integration Command |
|-------|-------------|---------------------|
| slice-01 | `pnpm test lib/db/__tests__/schema-generations.test.ts` | `pnpm test lib/db/__tests__/` |
| slice-02 | `pnpm test lib/db/__tests__/queries.test.ts` | `pnpm test lib/db/__tests__/` |
| slice-03 | `pnpm test lib/clients/__tests__/storage.test.ts` | `pnpm test lib/clients/__tests__/` |
| slice-04 | `pnpm test lib/services/__tests__/model-schema-service.test.ts` | `pnpm test lib/services/__tests__/` |
| slice-05 | `pnpm test lib/__tests__/models.test.ts` | `pnpm test lib/__tests__/` |
| slice-06 | `pnpm test lib/services/__tests__/generation-service.test.ts` | `pnpm test lib/services/__tests__/` |
| slice-07 | `pnpm test lib/services/__tests__/generation-service.test.ts` | `pnpm test lib/services/__tests__/` |
| slice-08 | `pnpm test app/actions/__tests__/generations.test.ts` | `pnpm test app/actions/__tests__/` |
| slice-09 | `pnpm test app/actions/__tests__/generations.test.ts` | `pnpm test app/actions/__tests__/` |
| slice-10 | `pnpm test lib/__tests__/workspace-state.test.ts` | `pnpm test lib/__tests__/` |
| slice-11 | `pnpm test components/workspace/__tests__/mode-selector.test.tsx` | `pnpm test components/workspace/__tests__/` |
| slice-12 | `pnpm test components/workspace/__tests__/image-dropzone.test.tsx` | `pnpm test components/workspace/__tests__/` |
| slice-13 | `pnpm test components/workspace/__tests__/strength-slider.test.tsx` | `pnpm test components/workspace/__tests__/` |
| slice-14 | `pnpm test components/workspace/__tests__/prompt-area.test.tsx` | `pnpm test components/workspace/__tests__/` |
| slice-15 | `pnpm test components/workspace/__tests__/filter-chips.test.tsx` | `pnpm test components/workspace/__tests__/` |
| slice-16 | `pnpm test components/workspace/__tests__/gallery-filter-badge.test.tsx` | `pnpm test components/workspace/__tests__/` |
| slice-17 | `pnpm test components/lightbox/__tests__/lightbox-modal.test.tsx` | `pnpm test components/lightbox/__tests__/` |

**Notes on shared test files:**
- slice-06 and slice-07 share the same test file (`generation-service.test.ts`). Run slice-06 first, then slice-07 extends the same file.
- slice-08 and slice-09 share the same test file (`generations.test.ts`). Run slice-08 first, then slice-09 extends the same file.
- The Test-Writer-Agent must handle additive test writing (not overwriting existing tests).

---

## Acceptance Check per Slice (drizzle-kit)

```yaml
acceptance_checks:
  slice-01:
    command: "npx drizzle-kit generate --dry-run"
    pass_criteria: "Output contains 'ADD COLUMN generation_mode' with 'DEFAULT txt2img', exit code 0"
  all_others:
    command: "—"
    note: "No additional acceptance command beyond unit tests"
```

---

## E2E Validation

AFTER all slices completed and DB migration applied:

```yaml
e2e_validation:
  - step: "Run DB migration"
    command: "npx drizzle-kit migrate"
    required: true

  - step: "Install Shadcn Popover (if not already done)"
    command: "npx shadcn@latest add popover"
    required: true

  - step: "Start dev server"
    command: "pnpm dev"
    health_check: "GET http://localhost:3000 → HTTP 200"

  - step: "Execute e2e-checklist.md"
    file: "e2e-checklist.md"
    sections:
      - "Happy Path Tests (Flows 1-6)"
      - "Edge Cases"
      - "Cross-Slice Integration Points"

  - step: "FOR each failing check"
    actions:
      - "Identify responsible slice from Integration Map Connections table"
      - "Create fix task referencing slice ID"
      - "Re-run affected slice unit tests after fix"

  - step: "Full regression"
    command: "pnpm test"
    pass_criteria: "All tests green (0 failures)"

  - step: "Final Approval"
    condition: "ALL checks in e2e-checklist.md PASS AND pnpm test exits 0"
    output: "Feature READY for merge"
```

---

## Critical Implementation Notes

### Shared Files (Multiple Slices Modify the Same File)

The following files are modified by more than one slice. The Orchestrator must ensure slices are implemented in dependency order to avoid conflicts:

| File | Modified By | Order |
|------|-------------|-------|
| `lib/services/generation-service.ts` | slice-06 (img2img), slice-07 (upscale) | slice-06 BEFORE slice-07 |
| `app/actions/generations.ts` | slice-08 (upload), slice-09 (generate/upscale) | slice-08 BEFORE slice-09 |
| `lib/services/__tests__/generation-service.test.ts` | slice-06, slice-07 (Test-Writer) | slice-06 tests BEFORE slice-07 tests |
| `app/actions/__tests__/generations.test.ts` | slice-08, slice-09 (Test-Writer) | slice-08 tests BEFORE slice-09 tests |

### New Files Created (No Conflict Risk)

| File | Created By |
|------|------------|
| `lib/db/__tests__/schema-generations.test.ts` | slice-01 (Test-Writer) |
| `lib/db/__tests__/queries.test.ts` | slice-02 (Test-Writer) |
| `lib/clients/__tests__/storage.test.ts` | slice-03 (Test-Writer) |
| `lib/services/__tests__/model-schema-service.test.ts` | slice-04 (Test-Writer) |
| `lib/__tests__/models.test.ts` | slice-05 (Test-Writer) |
| `lib/__tests__/workspace-state.test.ts` | slice-10 (Test-Writer) |
| `components/workspace/mode-selector.tsx` | slice-11 |
| `components/workspace/__tests__/mode-selector.test.tsx` | slice-11 (Test-Writer) |
| `components/workspace/image-dropzone.tsx` | slice-12 |
| `components/workspace/__tests__/image-dropzone.test.tsx` | slice-12 (Test-Writer) |
| `components/workspace/strength-slider.tsx` | slice-13 |
| `components/workspace/__tests__/strength-slider.test.tsx` | slice-13 (Test-Writer) |
| `components/workspace/__tests__/prompt-area.test.tsx` | slice-14 (Test-Writer) |
| `components/workspace/filter-chips.tsx` | slice-15 |
| `components/workspace/mode-badge.tsx` | slice-15 |
| `components/workspace/__tests__/filter-chips.test.tsx` | slice-15 (Test-Writer) |
| `components/workspace/__tests__/gallery-filter-badge.test.tsx` | slice-16 (Test-Writer) |
| `components/lightbox/__tests__/lightbox-modal.test.tsx` | slice-17 (Test-Writer) |
| `drizzle/migrations/XXXX_add_generation_mode.sql` | slice-01 (auto-generated by drizzle-kit) |

### Existing Files Modified (Check Before Implementing)

| File | Modified By | Nature of Change |
|------|-------------|-----------------|
| `lib/db/schema.ts` | slice-01 | ADD 3 columns + 1 index |
| `lib/db/queries.ts` | slice-02 | EXTEND createGeneration input type |
| `lib/clients/storage.ts` | slice-03 | ADD optional contentType parameter to upload() |
| `lib/services/model-schema-service.ts` | slice-04 | ADD supportsImg2Img method |
| `lib/models.ts` | slice-05 | ADD UPSCALE_MODEL constant |
| `lib/services/generation-service.ts` | slice-06, slice-07 | EXTEND generate(), ADD upscale() |
| `app/actions/generations.ts` | slice-08, slice-09 | ADD uploadSourceImage, ADD upscaleImage, EXTEND generateImages |
| `lib/workspace-state.tsx` | slice-10 | EXTEND WorkspaceVariationState interface |
| `components/workspace/prompt-area.tsx` | slice-14 | MAJOR REFACTOR — integrate 3 new components + mode logic |
| `components/workspace/gallery-grid.tsx` | slice-16 | ADD modeFilter prop + client-side filtering |
| `components/workspace/generation-card.tsx` | slice-16 | ADD ModeBadge overlay |
| `components/workspace/workspace-content.tsx` | slice-16 | ADD FilterChips + filter state |
| `components/lightbox/lightbox-modal.tsx` | slice-17 | ADD img2img + Upscale buttons + Popover |

---

## Rollback Strategy

```yaml
rollback:
  - condition: "slice-01 fails"
    action: "Revert lib/db/schema.ts; drizzle-kit generate will not create migration; no DB changes needed"
    risk: "Low — pure schema definition, no DB applied yet"

  - condition: "slice-01 already migrated and subsequent slice fails"
    action: "Revert code changes only; leave DB columns in place (backwards compatible — DEFAULT 'txt2img' is safe)"
    note: "Do NOT roll back applied migrations; columns have safe defaults"

  - condition: "slice-06 or slice-07 fail"
    action: "Revert lib/services/generation-service.ts to previous version; existing generate() still works"
    note: "txt2img generation continues to function"

  - condition: "slice-14 fails"
    action: "Revert components/workspace/prompt-area.tsx; gallery and lightbox still function; only PromptArea loses new mode features"

  - condition: "slice-16 fails"
    action: "Revert gallery-grid.tsx, generation-card.tsx, workspace-content.tsx; gallery still shows all generations without filtering"

  - condition: "slice-17 fails"
    action: "Revert lightbox-modal.tsx; lightbox functions as before (Variation, Download, Fav, Delete)"

  - condition: "Integration fails (any cross-slice)"
    action: "Review integration-map.md Connections table; isolate which connection is broken; fix the providing slice first, then re-test the consuming slice"
```

---

## Monitoring

During implementation:

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| Slice unit test failures | Any failure | Stop — fix before proceeding to dependent slices |
| Shared file merge conflict | Any conflict | Resolve before running tests |
| DB migration error | Any error | Fix schema.ts before slice-02 starts |
| Type error in TypeScript | Any `tsc --noEmit` error | Fix in current slice before moving on |
| R2 upload failure in E2E | Any failure | Check NEXT_PUBLIC_R2_PUBLIC_URL and R2 credentials |

---

## Summary

| Property | Value |
|----------|-------|
| Total Slices | 17 |
| Implementation Waves | 5 |
| Max Parallelism | 8 (Wave 1) |
| Shared Files (conflict risk) | 4 files modified by multiple slices |
| New Files | 19 |
| Modified Existing Files | 13 |
| External Setup Required | Shadcn Popover install + DB migration |
| E2E Flows | 6 happy paths + edge cases |
