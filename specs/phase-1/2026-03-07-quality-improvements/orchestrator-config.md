# Orchestrator Configuration: Quality Improvements

**Integration Map:** `integration-map.md`
**E2E Checklist:** `e2e-checklist.md`
**Generated:** 2026-03-07

---

## Pre-Implementation Gates

```yaml
pre_checks:
  - name: "Gate 1: Architecture Compliance"
    file: "compliance-architecture.md"
    required: "Verdict == APPROVED"

  - name: "Gate 2: All Slices Approved"
    files: "slices/compliance-slice-*.md"
    required: "ALL Verdict == APPROVED (21/21)"

  - name: "Gate 3: Integration Map Valid"
    file: "integration-map.md"
    required: "Missing Inputs == 0, Discovery Coverage == 100%"
```

---

## Prerequisites

```yaml
prerequisites:
  - name: "shadcn Dialog Installation"
    check: "test -f components/ui/dialog.tsx"
    action: "npx shadcn@latest add dialog"
    required_before: "Slice 18 (Improve Modal)"
    note: "May already be installed. Verify before starting."
```

---

## Implementation Order

Based on dependency analysis, slices are organized into waves. Slices within the same wave can be implemented in parallel.

| Wave | Order | Slice | Name | Depends On | Parallel? |
|------|-------|-------|------|------------|-----------|
| **1** | 1.1 | 01 | DB Schema Generations | -- | Yes (with 02, 03, 09, 14, 18, 19, 20) |
| **1** | 1.2 | 02 | DB Schema Projects | -- | Yes (with 01, 03, 09, 14, 18, 19, 20) |
| **1** | 1.3 | 03 | shadcn Sidebar Setup | -- | Yes (with 01, 02, 09, 14, 18, 19, 20) |
| **1** | 1.4 | 09 | Builder Fragments Config | -- | Yes (with 01, 02, 03, 14, 18, 19, 20) |
| **1** | 1.5 | 14 | Adaptive Improve Service | -- | Yes (with 01, 02, 03, 09, 18, 19, 20) |
| **1** | 1.6 | 18 | Improve Modal UI | -- | Yes (with 01, 02, 03, 09, 14, 19, 20) |
| **1** | 1.7 | 19 | Lightbox Fullscreen | -- | Yes (with 01, 02, 03, 09, 14, 18, 20) |
| **1** | 1.8 | 20 | OpenRouter Timeout | -- | Yes (with 01, 02, 03, 09, 14, 18, 19) |
| **2** | 2.1 | 04 | Sidebar Content Migration | 03 | Yes (with 06, 11, 16, 21) |
| **2** | 2.2 | 06 | Generation Service Structured | 01 | Yes (with 04, 11, 16, 21) |
| **2** | 2.3 | 11 | Prompt History Service | 01 | Yes (with 04, 06, 16, 21) |
| **2** | 2.4 | 16 | Thumbnail Service | 02 | Yes (with 04, 06, 11, 21) |
| **2** | 2.5 | 21 | DB Migration SQL | 01, 02 | Yes (with 04, 06, 11, 16) |
| **3** | 3.1 | 05 | Sidebar Layout Integration | 04 | Yes (with 07, 10, 17) |
| **3** | 3.2 | 07 | Prompt Area Structured Fields | 06 | Yes (with 05, 10, 17) |
| **3** | 3.3 | 10 | Builder Drawer Pro UI | 09, 07* | No -- depends on 07 (Wave 3) |
| **3** | 3.4 | 17 | Thumbnail UI Project Card | 16 | Yes (with 05, 07) |
| **4** | 4.1 | 08 | Prompt Tabs Container | 07 | Yes (with 10) |
| **4** | 4.2 | 10 | Builder Drawer Pro UI | 09, 07 | Yes (with 08) |
| **5** | 5.1 | 12 | History List UI | 08, 11 | Yes (with 15) |
| **5** | 5.2 | 15 | Template Selector UI | 08 | Yes (with 12) |
| **6** | 6.1 | 13 | Favorites List UI | 12 | No (final UI slice) |

**Note on Slice 10:** Depends on Slice 09 (Wave 1) AND Slice 07 (Wave 3). Can start earliest in Wave 4 alongside Slice 08.

---

## Wave Details

### Wave 1: Foundations (8 slices, all parallel)

All independent slices with no dependencies. Maximum parallelism.

```yaml
wave_1:
  slices: [01, 02, 03, 09, 14, 18, 19, 20]
  parallelism: "full"
  risk: "low - no inter-dependencies"
  files_modified:
    - lib/db/schema.ts (Slice 01 + 02 -- BOTH modify this file, execute sequentially or merge)
    - components/ui/sidebar.tsx (Slice 03 -- new file)
    - lib/builder-fragments.ts (Slice 09 -- new file)
    - lib/services/prompt-service.ts (Slice 14)
    - app/actions/prompts.ts (Slice 14 -- new file)
    - components/prompt-improve/llm-comparison.tsx (Slice 18)
    - components/workspace/prompt-area.tsx (Slice 18 -- partial modify)
    - components/lightbox/lightbox-modal.tsx (Slice 19)
    - lib/clients/openrouter.ts (Slice 20)
  conflict_warning: |
    Slice 01 and Slice 02 BOTH modify lib/db/schema.ts.
    Slice 14 and Slice 18 BOTH touch prompt-improve area.
    Recommendation: Execute 01 before 02 (or merge). Execute 14 before 18.
```

### Wave 2: Services (5 slices, all parallel)

Backend services and migration that depend on Wave 1 schema.

```yaml
wave_2:
  slices: [04, 06, 11, 16, 21]
  parallelism: "full"
  risk: "low - different files"
  gate: "All Wave 1 slices complete"
```

### Wave 3: UI Layer 1 (4 slices, mostly parallel)

First round of UI components building on services.

```yaml
wave_3:
  slices: [05, 07, 17]
  parallelism: "full"
  risk: "medium - prompt-area.tsx is shared"
  gate: "Relevant Wave 2 dependencies complete"
  note: "Slice 10 must wait for Slice 07 (this wave)"
```

### Wave 4: UI Layer 2 (2 slices, parallel)

```yaml
wave_4:
  slices: [08, 10]
  parallelism: "full"
  risk: "low"
  gate: "Slice 07 complete"
```

### Wave 5: UI Layer 3 (2 slices, parallel)

```yaml
wave_5:
  slices: [12, 15]
  parallelism: "full"
  risk: "low"
  gate: "Slice 08 complete"
```

### Wave 6: Final UI (1 slice)

```yaml
wave_6:
  slices: [13]
  parallelism: "n/a"
  risk: "low"
  gate: "Slice 12 complete"
```

---

## File Conflict Matrix

Files modified by multiple slices (must be implemented in order):

| File | Slices | Required Order | Conflict Type |
|------|--------|---------------|---------------|
| `lib/db/schema.ts` | 01, 02 | 01 then 02 (or merge) | Both add to same file (different tables) |
| `lib/db/queries.ts` | 06, 11, 16 | Any order (additive) | Each adds new functions |
| `app/actions/prompts.ts` | 14, 11 | 14 creates file, 11 adds to it | Sequential: 14 first |
| `app/actions/projects.ts` | 16, 17 | 16 adds action, 17 extends existing | Sequential: 16 first |
| `components/workspace/prompt-area.tsx` | 07, 08, 15, 18 | 07 -> 08 -> {15, 18} | Dependency chain enforces order |
| `components/lightbox/lightbox-modal.tsx` | 07, 19 | Either order (independent concerns) | 07: setVariation change; 19: fullscreen toggle |

---

## Post-Slice Validation

FOR each completed slice:

```yaml
validation_steps:
  - step: "Deliverables Check"
    action: "Verify all files listed in DELIVERABLES_START/END exist and are modified"

  - step: "Unit Tests"
    action: "Run test command from slice Test-Strategy"
    command: "pnpm test {test-path-from-slice}"

  - step: "Type Check"
    action: "pnpm tsc --noEmit (verify no TypeScript errors)"

  - step: "Integration Points"
    action: "Verify outputs accessible by dependent slices"
    reference: "integration-map.md -> Connections table"

  - step: "Build Check"
    action: "pnpm build (for slices with Acceptance Command = pnpm build)"
```

---

## E2E Validation

AFTER all slices completed:

```yaml
e2e_validation:
  - step: "Run DB Migration"
    action: "npx drizzle-kit migrate"
    verify: "Exit code 0, all columns visible in DB"

  - step: "Start Application"
    action: "pnpm dev"
    verify: "Application starts without errors on http://localhost:3000"

  - step: "Execute e2e-checklist.md"
    action: "Walk through all 9 Happy Path flows manually"
    verify: "All checkboxes pass"

  - step: "Edge Case Testing"
    action: "Execute Edge Cases section of e2e-checklist.md"
    verify: "All error handling and boundary conditions pass"

  - step: "Cross-Slice Integration"
    action: "Execute Cross-Slice Integration Points table"
    verify: "All 14 integration points verified"

  - step: "FOR each failing check"
    actions:
      - "Identify responsible slice from Integration Map"
      - "Create fix task with slice reference"
      - "Re-run affected slice tests"
      - "Re-verify integration point"

  - step: "Final Approval"
    condition: "ALL checks in e2e-checklist.md PASS"
    output: "Feature READY for merge"
```

---

## Rollback Strategy

IF implementation fails:

```yaml
rollback:
  - condition: "Slice N fails tests"
    action: "Revert Slice N changes only (git checkout files from deliverables)"
    note: "Dependencies are stable -- earlier slices remain valid"

  - condition: "Integration fails between slices"
    action: "Review integration-map.md Connections for the failing pair"
    note: "Check if provider slice outputs match consumer slice inputs"

  - condition: "DB migration fails"
    action: "Check drizzle/0001_*.sql for syntax errors, verify schema.ts matches"
    note: "Slice 21 depends on Slices 01+02 being correct"

  - condition: "Multiple prompt-area.tsx modifications conflict"
    action: "Rebuild prompt-area.tsx sequentially: 07 -> 08 -> 15 -> 18"
    note: "Each slice builds on the previous state"
```

---

## Monitoring

During implementation:

| Metric | Alert Threshold |
|--------|-----------------|
| Slice completion time | > 30 min per slice |
| Test failures | > 0 blocking |
| Deliverable missing | Any file from DELIVERABLES not created/modified |
| TypeScript errors | Any (`pnpm tsc --noEmit` must pass after each slice) |
| Build failures | Any (`pnpm build` must pass for acceptance slices) |
| Integration test fail | Any cross-slice connection broken |

---

## Quick Reference: Slice Execution Commands

| Slice | Test Command | Files |
|-------|-------------|-------|
| 01 | `pnpm test lib/db/__tests__/schema-generations.test.ts` | `lib/db/schema.ts` |
| 02 | `pnpm vitest run lib/db/__tests__/schema-projects.test.ts` | `lib/db/schema.ts` |
| 03 | `pnpm test components/ui/__tests__/sidebar.test.tsx` | `components/ui/sidebar.tsx` |
| 04 | `pnpm test components/__tests__/sidebar.test.tsx` | `components/sidebar.tsx`, `components/project-list.tsx` |
| 05 | `pnpm test app/projects/__tests__/workspace-layout.test.tsx` | `app/projects/[id]/page.tsx` |
| 06 | `pnpm test lib/services/__tests__/generation-service.test.ts` | `lib/services/generation-service.ts`, `lib/db/queries.ts`, `app/actions/generations.ts` |
| 07 | `pnpm test components/workspace/__tests__/prompt-area.test.tsx` | `components/workspace/prompt-area.tsx`, `lib/workspace-state.tsx`, `components/lightbox/lightbox-modal.tsx` |
| 08 | `pnpm test components/workspace/__tests__/prompt-tabs.test.tsx` | `components/workspace/prompt-tabs.tsx`, `components/workspace/prompt-area.tsx` |
| 09 | `pnpm test lib/__tests__/builder-fragments.test.ts` | `lib/builder-fragments.ts` |
| 10 | `pnpm test components/prompt-builder/__tests__/builder-drawer.test.tsx` | `components/prompt-builder/builder-drawer.tsx`, `components/prompt-builder/category-tabs.tsx` |
| 11 | `pnpm test lib/services/__tests__/prompt-history-service.test.ts` | `lib/services/prompt-history-service.ts`, `lib/db/queries.ts`, `app/actions/prompts.ts` |
| 12 | `pnpm test components/workspace/__tests__/history-list.test.tsx` | `components/workspace/history-list.tsx` |
| 13 | `pnpm test components/workspace/__tests__/favorites-list.test.tsx` | `components/workspace/favorites-list.tsx` |
| 14 | `pnpm vitest run lib/services/__tests__/prompt-service.test.ts` | `lib/services/prompt-service.ts`, `app/actions/prompts.ts` |
| 15 | `pnpm test lib/__tests__/prompt-templates.test.ts components/workspace/__tests__/template-selector.test.tsx` | `lib/prompt-templates.ts`, `components/workspace/template-selector.tsx` |
| 16 | `pnpm vitest run lib/services/__tests__/thumbnail-service.test.ts` | `lib/services/thumbnail-service.ts`, `lib/db/queries.ts`, `app/actions/projects.ts` |
| 17 | `pnpm vitest run components/__tests__/project-card.test.tsx` | `components/project-card.tsx`, `app/actions/projects.ts` |
| 18 | `pnpm test components/prompt-improve` | `components/prompt-improve/llm-comparison.tsx`, `components/workspace/prompt-area.tsx` |
| 19 | `pnpm test components/lightbox/__tests__/lightbox-modal.test.tsx` | `components/lightbox/lightbox-modal.tsx` |
| 20 | `pnpm vitest run lib/clients/__tests__/openrouter.test.ts` | `lib/clients/openrouter.ts` |
| 21 | `pnpm vitest run lib/db/__tests__/migration.test.ts` | `drizzle/0001_*.sql` |
