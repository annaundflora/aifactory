# Orchestrator Configuration: E2E Generate & Persist

**Integration Map:** `integration-map.md`
**E2E Checklist:** `e2e-checklist.md`
**Generated:** 2026-03-04

---

## Pre-Implementation Gates

```yaml
pre_checks:
  - name: "Gate 1: Architecture Compliance"
    file: "compliance-architecture.md"
    required: "Verdict == APPROVED"

  - name: "Gate 2: All Slices Approved"
    files: "slices/compliance-slice-*.md"
    required: "ALL Verdict == APPROVED"
    status: "21/21 APPROVED"

  - name: "Gate 3: Integration Map Valid"
    file: "integration-map.md"
    required: "Missing Inputs == 0, Deliverable-Consumer Gaps == 0, Runtime Path Gaps == 0"
    status: "READY FOR ORCHESTRATION"
```

---

## Implementation Order

Based on dependency analysis:

| Order | Slice | Name | Depends On | Parallel? |
|-------|-------|------|------------|-----------|
| 1 | 01 | Docker + DB Schema | -- | Yes with 06 |
| 1 | 06 | Model Registry + Schema Service | -- | Yes with 01 |
| 2 | 02 | DB Connection + Queries | 01 | Yes with 07 |
| 2 | 07 | Replicate + Storage Clients | 06 | Yes with 02 |
| 3 | 03 | Project Server Actions | 02 | No |
| 3 | 08 | Generation Service + Actions | 02, 07 | After 02 AND 07 complete |
| 3 | 19 | Snippet CRUD | 02 | Yes with 03 and 08 |
| 4 | 04 | Project Overview UI | 03 | No |
| 5 | 05 | Workspace Layout + Sidebar | 04 | No |
| 6 | 09 | Prompt Area + Parameter Panel | 05, 06, 08 | No (convergence point) |
| 6 | 11 | Gallery Grid + Generation Cards | 08 | Yes with 09 |
| 7 | 10 | Generation Placeholder + Polling | 09 | Yes with 12 |
| 7 | 12 | Lightbox Modal | 11 | Yes with 10 |
| 7 | 17 | Prompt Builder Drawer | 09 | Yes with 10 and 12 |
| 7 | 21 | LLM Prompt Improvement | 09 | Yes with 10, 12, and 17 |
| 7 | 16 | Toast + Retry | 10, 08 | After 10 complete |
| 8 | 13 | Lightbox Navigation + Actions | 12 | No |
| 8 | 15 | Download PNG | 12 | Yes with 13 |
| 8 | 18 | Surprise Me | 17 | No |
| 9 | 14 | Variation Flow | 13, 09 | No |
| 9 | 20 | Snippet UI in Builder | 19, 17 | Yes with 14 |

---

## Parallel Execution Groups

```
Group 1 (Foundation):     [Slice 01] [Slice 06]
Group 2 (Data + Clients): [Slice 02] [Slice 07]
Group 3 (Services):       [Slice 03] [Slice 08] [Slice 19]
Group 4 (Project UI):     [Slice 04]
Group 5 (Workspace):      [Slice 05]
Group 6 (Core UI):        [Slice 09] [Slice 11]
Group 7 (Features):       [Slice 10] [Slice 12] [Slice 16] [Slice 17] [Slice 21]
Group 8 (Lightbox+):      [Slice 13] [Slice 15] [Slice 18]
Group 9 (Integration):    [Slice 14] [Slice 20]
```

---

## Post-Slice Validation

FOR each completed slice:

```yaml
validation_steps:
  - step: "Deliverables Check"
    action: "Verify all files listed in DELIVERABLES_START/END section exist on disk"

  - step: "Unit Tests"
    action: "Run test command from slice Test-Strategy section"
    command: "Slice-specific test command (see Metadata table)"

  - step: "Integration Tests"
    action: "Run integration command from slice Test-Strategy section (if defined)"
    condition: "Only if Integration Command is not '--'"

  - step: "Integration Points"
    action: "Verify outputs are accessible by dependent slices"
    reference: "integration-map.md -> Connections table"

  - step: "Type Check"
    action: "Run pnpm tsc --noEmit to verify no type errors introduced"
```

---

## Slice-Specific Commands

| Slice | Test Command | Integration Command |
|-------|-------------|---------------------|
| 01 | `pnpm test lib/db/__tests__/schema.test.ts` | `docker compose up -d && pnpm drizzle-kit migrate` |
| 02 | `pnpm test lib/db/__tests__/queries.test.ts` | `docker compose up -d && pnpm drizzle-kit migrate && pnpm test lib/db/__tests__/queries.integration.test.ts` |
| 03 | `pnpm test app/actions/__tests__/projects.test.ts` | `docker compose up -d && pnpm drizzle-kit migrate && pnpm test app/actions/__tests__/projects.integration.test.ts` |
| 04 | `pnpm test components/__tests__/project-card.test.tsx components/__tests__/project-list.test.tsx app/__tests__/page.test.tsx` | -- |
| 05 | `pnpm test app/projects/__tests__/page.test.tsx app/__tests__/layout.test.tsx components/__tests__/sidebar.test.tsx components/shared/__tests__/confirm-dialog.test.tsx` | -- |
| 06 | `pnpm test lib/__tests__/models.test.ts lib/services/__tests__/model-schema-service.test.ts app/actions/__tests__/models.test.ts` | -- |
| 07 | `pnpm test lib/clients/__tests__/replicate.test.ts lib/clients/__tests__/storage.test.ts` | -- |
| 08 | `pnpm test lib/services/__tests__/generation-service.test.ts app/actions/__tests__/generations.test.ts` | `docker compose up -d && pnpm drizzle-kit migrate && pnpm test lib/services/__tests__/generation-service.integration.test.ts` |
| 09 | `pnpm test components/workspace/__tests__/prompt-area.test.tsx components/workspace/__tests__/parameter-panel.test.tsx` | -- |
| 10 | `pnpm test components/workspace/__tests__/generation-placeholder.test.tsx` | -- |
| 11 | `pnpm test components/workspace/__tests__/gallery-grid.test.tsx components/workspace/__tests__/generation-card.test.tsx` | -- |
| 12 | `pnpm test components/lightbox/__tests__/lightbox-modal.test.tsx` | -- |
| 13 | `pnpm test components/lightbox/__tests__/lightbox-navigation.test.tsx` | -- |
| 14 | `pnpm test components/lightbox/__tests__/variation-flow.test.tsx lib/__tests__/variation-utils.test.ts` | -- |
| 15 | `pnpm test lib/__tests__/download-utils.test.ts` | -- |
| 16 | `pnpm test components/shared/__tests__/toast-provider.test.tsx components/workspace/__tests__/generation-retry.test.tsx` | -- |
| 17 | `pnpm test components/prompt-builder/__tests__/builder-drawer.test.tsx` | -- |
| 18 | `pnpm test components/prompt-builder/__tests__/surprise-me-button.test.tsx` | -- |
| 19 | `pnpm test lib/services/__tests__/snippet-service.test.ts app/actions/__tests__/prompts.test.ts` | `docker compose up -d && pnpm drizzle-kit migrate && pnpm test lib/services/__tests__/snippet-service.integration.test.ts` |
| 20 | `pnpm test components/prompt-builder/__tests__/snippet-ui.test.tsx` | -- |
| 21 | `pnpm test lib/clients/__tests__/openrouter.test.ts lib/services/__tests__/prompt-service.test.ts components/prompt-improve/__tests__/llm-comparison.test.tsx` | -- |

---

## E2E Validation

AFTER all slices completed:

```yaml
e2e_validation:
  - step: "Execute e2e-checklist.md"
    action: "Walk through all Happy Path tests manually or via E2E test runner"

  - step: "FOR each failing check"
    actions:
      - "Identify responsible slice from Integration Map Connections table"
      - "Check slice deliverables exist and are correct"
      - "Re-run slice-specific test command"
      - "If test passes but integration fails: check Integration Contract compatibility"
      - "Create fix task with slice reference"

  - step: "Cross-Slice Integration Verification"
    action: "Walk through all 13 Cross-Slice Integration Points in e2e-checklist.md"

  - step: "Final Approval"
    condition: "ALL checks in e2e-checklist.md PASS"
    output: "Feature READY for merge"
```

---

## Shared Files (Multi-Slice Modifications)

The following files are created in one slice and modified in subsequent slices. The orchestrator must ensure these are implemented in the correct order:

| File | Created In | Modified In | Notes |
|------|-----------|-------------|-------|
| `app/actions/generations.ts` | Slice 08 | Slice 13 | S08: generateImages + retryGeneration. S13: adds deleteGeneration |
| `app/actions/prompts.ts` | Slice 19 | Slice 21 | S19: snippet CRUD actions. S21: adds improvePrompt |
| `components/lightbox/lightbox-modal.tsx` | Slice 12 | Slice 14, 15 | S12: base modal. S14: adds Variation button. S15: adds Download button |
| `components/workspace/prompt-area.tsx` | Slice 09 | Slice 14 | S09: base component. S14: adds variation state consumption |
| `components/prompt-builder/category-tabs.tsx` | Slice 17 | Slice 20 | S17: Style + Colors tabs. S20: adds My Snippets tab |
| `app/layout.tsx` | Slice 05 | Slice 16 | S05: base layout with Toaster. S16: ensures ToastProvider |

---

## Rollback Strategy

IF implementation fails:

```yaml
rollback:
  - condition: "Slice N fails unit tests"
    action: "Fix within slice N scope. Do not proceed to dependent slices."
    note: "Dependencies are stable from previous slices."

  - condition: "Slice N fails integration tests"
    action: "Check Integration Contract between slice N and its dependencies."
    steps:
      - "Verify dependency slice outputs match expected interfaces"
      - "Verify type compatibility"
      - "Fix in slice N or update dependency slice if contract mismatch"

  - condition: "Cross-slice integration fails"
    action: "Review integration-map.md Connections table for the affected path"
    steps:
      - "Identify which connection in the chain is broken"
      - "Check shared file modifications (see Shared Files table)"
      - "Fix the earliest slice in the chain that has the issue"

  - condition: "E2E flow fails"
    action: "Walk the Runtime Path from integration-map.md to find break point"
    note: "May require coordinated fixes across multiple slices"
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
| Type check errors | > 0 after slice |
| Shared file conflicts | Any merge conflict |

---

## Environment Requirements

```yaml
environment:
  runtime:
    - Node.js 20+
    - pnpm
    - Docker + Docker Compose

  services:
    - PostgreSQL 16 (via Docker, port 5432)

  env_variables:
    - DATABASE_URL (postgresql:// format)
    - REPLICATE_API_TOKEN
    - R2_ACCESS_KEY_ID
    - R2_SECRET_ACCESS_KEY
    - R2_ENDPOINT
    - R2_PUBLIC_URL
    - R2_BUCKET_NAME
    - OPENROUTER_API_KEY

  dependencies:
    - drizzle-orm + drizzle-kit
    - postgres (postgres.js driver)
    - replicate SDK v1.4.0
    - "@aws-sdk/client-s3"
    - sharp (PNG conversion)
    - sonner (toast notifications)
    - shadcn/ui components
    - tailwindcss v4
```
