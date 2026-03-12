# Orchestrator Configuration: Multi-Image Referencing

**Integration Map:** `integration-map.md`
**E2E Checklist:** `e2e-checklist.md`
**Generated:** 2026-03-12

---

## Pre-Implementation Gates

```yaml
pre_checks:
  - name: "Gate 1: Architecture Compliance"
    file: "specs/phase-3/2026-03-11-multi-image-referencing/architecture.md"
    required: "Architecture document exists and is referenced by all slices"

  - name: "Gate 2: All Slices Approved"
    files: "specs/phase-3/2026-03-11-multi-image-referencing/slices/compliance-slice-*.md"
    required: "ALL 17 Verdicts == APPROVED"
    result: "17/17 APPROVED"

  - name: "Gate 3: Integration Map Valid"
    file: "specs/phase-3/2026-03-11-multi-image-referencing/integration-map.md"
    required: "Missing Inputs == 0, Deliverable-Consumer Gaps == 0, Runtime Path Gaps == 0"
    result: "READY FOR ORCHESTRATION"
```

---

## Implementation Order

Based on dependency analysis, the 17 slices form 7 implementation tiers:

| Order | Slice | Name | Depends On | Parallel? |
|-------|-------|------|------------|-----------|
| 1 | 01 | DB Schema & Migration | -- | Yes with 06 |
| 1 | 06 | UI Setup (Collapsible + Panel) | -- | Yes with 01 |
| 2 | 02 | Reference Queries | 01 | No (needs schema) |
| 3 | 03 | Reference Service | 02 | No (needs queries) |
| 4 | 04 | Upload Reference Action | 03 | Yes with 05 |
| 4 | 05 | Gallery-as-Reference | 03 | Yes with 04 |
| 5 | 07 | ReferenceSlot Component | 04, 06 | No (needs action + collapsible) |
| 6 | 08 | ReferenceBar Component | 07 | No (needs slot) |
| 7 | 09 | PromptArea Integration | 08 | No (needs bar) |
| 8 | 10 | RefHintBanner | 09 | Yes with 11, 12 |
| 8 | 11 | CompatibilityWarning | 09 | Yes with 10, 12 |
| 8 | 12 | Prompt Token Mapping | 09 | Yes with 10, 11 |
| 9 | 13 | Generation Integration | 02, 09, 12 | No (needs queries + prompt area + token mapping) |
| 10 | 14 | Gallery Drag to Slot | 05, 08 | Yes with 15, 16 |
| 10 | 15 | Provenance Lightbox | 02, 13 | Yes with 14, 16 |
| 10 | 16 | Lightbox UseAsReference | 05, 09 | Yes with 14, 15 |
| 11 | 17 | Migration Cleanup | 02, 13, 15 | No (final slice) |

### Parallelization Summary

- **Tier 1:** Slices 01 + 06 (independent foundations: DB + UI)
- **Tier 4:** Slices 04 + 05 (independent actions: upload + gallery-ref)
- **Tier 8:** Slices 10 + 11 + 12 (independent extensions of PromptArea)
- **Tier 10:** Slices 14 + 15 + 16 (independent features: drag, provenance, lightbox button)

---

## Slice Execution Details

### Tier 1 (Foundation -- Parallel)

```yaml
slice-01-db-schema-migration:
  spec: "slices/slice-01-db-schema-migration.md"
  deliverables:
    - "lib/db/schema.ts"
    - "drizzle/"
  test: "pnpm test lib/db/schema"
  acceptance: "npx drizzle-kit push"
  post_check: "Both tables exist in DB"

slice-06-ui-setup-collapsible:
  spec: "slices/slice-06-ui-setup-collapsible.md"
  deliverables:
    - "components/ui/collapsible.tsx"
    - "components/workspace/workspace-content.tsx"
  pre_step: "npx shadcn add collapsible"
  test: "pnpm test components/workspace/workspace-content.test.tsx"
  acceptance: "pnpm build"
  post_check: "Collapsible component exists, panel renders 480px"
```

### Tier 2

```yaml
slice-02-reference-queries:
  spec: "slices/slice-02-reference-queries.md"
  deliverables:
    - "lib/db/queries.ts"
  test: "pnpm test lib/db/__tests__/queries-references"
  post_check: "5 functions + 2 types exported"
```

### Tier 3

```yaml
slice-03-reference-service:
  spec: "slices/slice-03-reference-service.md"
  deliverables:
    - "lib/services/reference-service.ts"
  test: "pnpm test lib/services/__tests__/reference-service"
  post_check: "upload, delete, getByProject methods exist"
```

### Tier 4 (Parallel)

```yaml
slice-04-upload-reference-action:
  spec: "slices/slice-04-upload-reference-action.md"
  deliverables:
    - "app/actions/references.ts"
  test: "pnpm test app/actions/__tests__/references"
  post_check: '"use server" directive, uploadReferenceImage + deleteReferenceImage exported'

slice-05-gallery-as-reference:
  spec: "slices/slice-05-gallery-as-reference.md"
  deliverables:
    - "lib/services/reference-service.ts"   # extend
    - "app/actions/references.ts"            # extend
  test: "pnpm test lib/services/__tests__/reference-service-gallery && pnpm test app/actions/__tests__/references-gallery"
  post_check: "uploadFromGallery + addGalleryAsReference exist"
  note: "Extends files from slices 03 and 04. If parallel, ensure merge coordination."
```

### Tier 5

```yaml
slice-07-reference-slot:
  spec: "slices/slice-07-reference-slot.md"
  deliverables:
    - "components/workspace/reference-slot.tsx"
    - "lib/types/reference.ts"
  test: "pnpm test components/workspace/__tests__/reference-slot"
  post_check: "Component renders 6 states, types exported"
```

### Tier 6

```yaml
slice-08-reference-bar:
  spec: "slices/slice-08-reference-bar.md"
  deliverables:
    - "components/workspace/reference-bar.tsx"
  test: "pnpm test components/workspace/__tests__/reference-bar"
  post_check: "Collapsible bar with 3 states, max 5 enforcement, sparse numbering"
```

### Tier 7

```yaml
slice-09-prompt-area-integration:
  spec: "slices/slice-09-prompt-area-integration.md"
  deliverables:
    - "components/workspace/prompt-area.tsx"  # modify
    - "lib/workspace-state.tsx"               # modify
  test: "pnpm test components/workspace/__tests__/prompt-area-reference"
  post_check: "ReferenceBar mounted in img2img, ImageDropzone+StrengthSlider removed, addReference in WorkspaceState"
```

### Tier 8 (Parallel)

```yaml
slice-10-ref-hint-banner:
  spec: "slices/slice-10-ref-hint-banner.md"
  deliverables:
    - "components/workspace/ref-hint-banner.tsx"
  test: "pnpm test components/workspace/__tests__/ref-hint-banner"
  post_check: "Dismissible banner with dynamic @-numbers"

slice-11-compatibility-warning:
  spec: "slices/slice-11-compatibility-warning.md"
  deliverables:
    - "components/workspace/compatibility-warning.tsx"
    - "lib/services/model-schema-service.ts"  # extend
  test: "pnpm test components/workspace/__tests__/compatibility-warning && pnpm test lib/services/__tests__/model-schema-service"
  post_check: "getMaxImageCount function, 3-variant warning component"

slice-12-prompt-token-mapping:
  spec: "slices/slice-12-prompt-token-mapping.md"
  deliverables:
    - "lib/services/generation-service.ts"  # extend (new function only)
  test: "pnpm test lib/services/__tests__/compose-multi-reference-prompt"
  post_check: "composeMultiReferencePrompt exported, @N -> @imageN mapping works"
```

### Tier 9

```yaml
slice-13-generation-integration:
  spec: "slices/slice-13-generation-integration.md"
  deliverables:
    - "app/actions/generations.ts"             # modify
    - "lib/services/generation-service.ts"     # modify
  test: "pnpm test lib/services/__tests__/generation-multi-ref app/actions/__tests__/generations-multi-ref"
  post_check: "Multi-image URLs in API input, generation_references records created, 9MP validation"
```

### Tier 10 (Parallel)

```yaml
slice-14-gallery-drag-slot:
  spec: "slices/slice-14-gallery-drag-slot.md"
  deliverables:
    - "components/workspace/generation-card.tsx"    # modify
    - "components/workspace/reference-slot.tsx"     # modify
  test: "pnpm test components/workspace/__tests__/generation-card-drag && pnpm test components/workspace/__tests__/reference-slot-gallery-drop"
  post_check: "GenerationCard draggable, ReferenceSlot discriminates gallery vs file drop"

slice-15-provenance-lightbox:
  spec: "slices/slice-15-provenance-lightbox.md"
  deliverables:
    - "components/lightbox/provenance-row.tsx"
    - "components/lightbox/lightbox-modal.tsx"  # modify
  test: "pnpm test components/lightbox/__tests__/provenance-row components/lightbox/__tests__/lightbox-provenance-integration"
  post_check: "ProvenanceRow shows thumbnails with roles+strengths in lightbox"

slice-16-lightbox-use-as-reference:
  spec: "slices/slice-16-lightbox-use-as-reference.md"
  deliverables:
    - "components/lightbox/lightbox-modal.tsx"  # modify
  test: "pnpm test components/lightbox/__tests__/use-as-reference"
  post_check: "Als Referenz button in lightbox, disabled at 5/5"
  note: "Modifies same file as slice-15. If parallel, ensure merge coordination for lightbox-modal.tsx."
```

### Tier 11 (Final)

```yaml
slice-17-migration-cleanup:
  spec: "slices/slice-17-migration-cleanup.md"
  deliverables:
    - "lib/db/migrations/migrate-source-images.ts"
  test: "pnpm test lib/db/migrations/__tests__/migrate-source-images"
  post_check: "Script migrates sourceImageUrl to reference_images + generation_references"
  execution: "Manual: tsx lib/db/migrations/migrate-source-images.ts"
```

---

## Post-Slice Validation

FOR each completed slice:

```yaml
validation_steps:
  - step: "Deliverables Check"
    action: "Verify all files listed in DELIVERABLES_START block exist and are non-empty"

  - step: "Unit Tests"
    action: "Run test command from slice metadata"
    command: "{slice.test}"
    required: "Exit code 0, all tests pass"

  - step: "Build Check"
    action: "pnpm build"
    required: "Exit code 0 (no TypeScript errors, no build failures)"

  - step: "Integration Points"
    action: "Verify outputs are accessible by dependent slices"
    reference: "integration-map.md -> Connections table"
    method: "Check that exported functions/components/types can be imported without errors"
```

---

## File Modification Coordination

Several files are modified by multiple slices. The orchestrator must ensure sequential execution for these:

| File | Modified By (in order) | Coordination |
|------|----------------------|--------------|
| `lib/db/schema.ts` | Slice 01 | Single writer |
| `lib/db/queries.ts` | Slice 02 | Single writer |
| `lib/services/reference-service.ts` | Slice 03, then Slice 05 | Sequential (03 creates, 05 extends) |
| `app/actions/references.ts` | Slice 04, then Slice 05 | Sequential (04 creates, 05 extends) |
| `lib/services/generation-service.ts` | Slice 12, then Slice 13 | Sequential (12 adds function, 13 calls it) |
| `app/actions/generations.ts` | Slice 13 | Single writer |
| `components/workspace/prompt-area.tsx` | Slice 09 | Single writer (mounts S10, S11 components) |
| `lib/workspace-state.tsx` | Slice 09 | Single writer |
| `components/workspace/workspace-content.tsx` | Slice 06 | Single writer |
| `components/workspace/reference-slot.tsx` | Slice 07, then Slice 14 | Sequential (07 creates, 14 extends) |
| `components/workspace/generation-card.tsx` | Slice 14 | Single writer |
| `components/lightbox/lightbox-modal.tsx` | Slice 15, then Slice 16 | Sequential (15 adds ProvenanceRow, 16 adds button) |

---

## E2E Validation

AFTER all slices completed:

```yaml
e2e_validation:
  - step: "Full Build"
    action: "pnpm build"
    required: "Exit code 0"

  - step: "All Unit Tests"
    action: "pnpm test"
    required: "All tests pass"

  - step: "Execute e2e-checklist.md"
    action: "Manual walkthrough of all happy path flows"
    required: "All checkboxes pass"

  - step: "FOR each failing check"
    actions:
      - "Identify responsible slice from Integration Map"
      - "Create fix task with slice reference"
      - "Re-run affected slice tests"

  - step: "Migration Execution"
    action: "tsx lib/db/migrations/migrate-source-images.ts"
    required: "Summary shows migrated > 0, errors = 0"
    timing: "After all slices complete, before final verification"

  - step: "Post-Migration Verification"
    action: "Open lightbox for old img2img generation"
    required: "ProvenanceRow shows @1 Content Moderate"

  - step: "Final Approval"
    condition: "ALL checks in e2e-checklist.md PASS"
    output: "Feature READY for merge"
```

---

## Rollback Strategy

IF implementation fails:

```yaml
rollback:
  - condition: "Slice N fails during implementation"
    action: "Revert Slice N changes only via git"
    note: "Dependencies are stable -- earlier slices remain functional"

  - condition: "Integration fails between slices"
    action: "Review integration-map.md connections for the failing pair"
    note: "Check interface compatibility between Provides-To and Requires-From"

  - condition: "DB migration fails (Slice 01)"
    action: "npx drizzle-kit drop (remove new tables only)"
    note: "No existing tables are modified in Slice 01"

  - condition: "Data migration fails (Slice 17)"
    action: "Script is idempotent -- fix issue and re-run"
    note: "sourceImageUrl column is preserved, no data loss possible"

  - condition: "Build breaks after multiple slices"
    action: "Binary search: revert latest slice, rebuild, identify breaking change"
    note: "Each tier should be buildable independently"
```

---

## Monitoring

During implementation:

| Metric | Alert Threshold |
|--------|-----------------|
| Slice completion time | > 2x estimate |
| Test failures per slice | > 0 blocking |
| Missing deliverable file | Any |
| Build failure after slice | Any |
| TypeScript errors | > 0 |
| Integration test failure | Any |

---

## Summary

| Metric | Value |
|--------|-------|
| Total Slices | 17 |
| Implementation Tiers | 11 |
| Parallelizable Tiers | 5 (Tiers 1, 4, 8, 10 have parallel slices) |
| Files Modified (existing) | 9 |
| Files Created (new) | 10 |
| Shared-File Coordination Points | 6 |
| Pre-requisite CLI Steps | 2 (drizzle-kit push, shadcn add collapsible) |

**VERDICT: READY FOR ORCHESTRATION**
