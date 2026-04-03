# Orchestrator Configuration: Prompt-Felder Vereinfachung

**Integration Map:** `integration-map.md`
**E2E Checklist:** `e2e-checklist.md`
**Generated:** 2026-03-29

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
    count: 11

  - name: "Gate 3: Integration Map Valid"
    file: "gates/integration-map.md"
    required: "Missing Inputs == 0 AND Verdict == READY FOR ORCHESTRATION"
```

---

## Infrastructure Notes

```yaml
health_endpoints:
  frontend:
    url: "http://localhost:3000"
    note: "Next.js dev server -- default"
  backend:
    url: "http://localhost:8000/api/assistant/health"
    note: "FastAPI -- actual route differs from slice specs that say /health. Use /api/assistant/health for health checks."

dual_stack:
  frontend: "pnpm dev"
  backend: "cd backend && uvicorn app.main:app --reload"
  note: "Slices 08 and 09 require Python backend. Slices 01-07 and 10 require only frontend."
```

---

## Implementation Order

Based on dependency analysis, the implementation is organized in 7 waves:

| Wave | Slice | Name | Depends On | Parallel? |
|------|-------|------|------------|-----------|
| 1 | 01 | DB Schema & Migration | - | No (foundation) |
| 2 | 02 | DB Queries & Prompt History Service | 01 | No (foundation for both branches) |
| 3 | 03 | Test-Infra Mocks | 01, 02 | Yes with 04, 08 |
| 3 | 04 | Generation Service & Server Action | 02 | Yes with 03, 08 |
| 3 | 08 | Assistant Backend Tools & System-Prompt | 02 | Yes with 03, 04 |
| 4 | 06 | Workspace State & Prompt Tabs/Lists UI | 04 | Yes with 09 |
| 4 | 09 | Assistant Knowledge & DTO | 08 | Yes with 06 |
| 5 | 05 | Prompt Area UI | 04, (06 for shared file) | Yes with 10 |
| 5 | 10 | Assistant Frontend | 08, (09 for session restore) | Yes with 05 |
| 6 | 07 | Canvas UI | 05 | No (last UI slice) |
| 7 | 11 | E2E Verification | 05, 06, 07, 09, 10 | No (final verification) |

### Ordering Rationale

**Wave 1 (Slice 01):** DB Schema is the absolute foundation. All subsequent slices depend on the cleaned schema.

**Wave 2 (Slice 02):** Queries and service layer must be cleaned before any consumer (generation service, UI, assistant) can build on them.

**Wave 3 (Slices 03, 04, 08):** Three independent branches that all depend on Slice 02 but not on each other:
- Slice 03 creates test factories (utility, no production impact)
- Slice 04 cleans generation service and server action (TypeScript backend)
- Slice 08 cleans assistant backend tools (Python backend)

**Wave 4 (Slices 06, 09):**
- Slice 06 cleans workspace state and tabs UI (depends on 04)
- Slice 09 cleans assistant knowledge and DTO (depends on 08)
- **IMPORTANT:** Slice 06 MUST complete before or in parallel with Slice 05 because both modify `lib/workspace-state.tsx`. Slice 06 is the "owner" of the state file.

**Wave 5 (Slices 05, 10):**
- Slice 05 cleans Prompt Area UI (depends on 04, consumes PromptTabs from 06)
- Slice 10 cleans Assistant Frontend (depends on 08, uses DraftPromptDTO from 09)

**Wave 6 (Slice 07):** Canvas UI depends on Slice 05's `WorkspaceVariationState`.

**Wave 7 (Slice 11):** E2E verification after all other slices.

### Critical Path

```
Slice 01 -> Slice 02 -> Slice 04 -> Slice 06 -> Slice 05 -> Slice 07 -> Slice 11
```

### Shared File Warning

```yaml
shared_files:
  - file: "lib/workspace-state.tsx"
    modified_by: ["slice-05", "slice-06"]
    change: "Remove promptStyle and negativePrompt from WorkspaceVariationState"
    resolution: "Idempotent change. Slice 06 should execute first (state owner). Slice 05 will find change already applied."
    orchestrator_action: "Execute Slice 06 before Slice 05, or verify idempotency after both complete."
```

---

## Post-Slice Validation

FOR each completed slice:

```yaml
validation_steps:
  - step: "Deliverables Check"
    action: "Verify all files listed in DELIVERABLES_START/END exist and have been modified"

  - step: "Unit Tests"
    action: "Run the slice's Test Command from Test-Strategy table"
    on_failure: "Fix within the slice scope"

  - step: "Integration Tests"
    action: "Run the slice's Integration Command from Test-Strategy table (if defined)"
    on_failure: "Check integration-map.md connections for the failing dependency"

  - step: "Acceptance Tests"
    action: "Run the slice's Acceptance Command from Test-Strategy table"
    on_failure: "Likely a cross-slice contract violation -- check Integration Map"

  - step: "TypeScript Compilation (TS slices only)"
    action: "npx tsc --noEmit"
    note: "Expected to show errors in files touched by LATER slices. Only current slice files must be error-free."
```

### Per-Slice Validation Commands

| Slice | Test Command | Integration Command | Acceptance Command |
|-------|-------------|--------------------|--------------------|
| 01 | `pnpm test lib/db/__tests__/schema` | `npx drizzle-kit generate` | `npx tsc --noEmit` |
| 02 | `pnpm test lib/db/__tests__/queries-batch lib/services/__tests__/prompt-history-service` | `pnpm test lib/db/__tests__/schema-generations lib/db/__tests__/schema` | `npx tsc --noEmit` |
| 03 | `pnpm test lib/__tests__/factories` | `npx tsc --noEmit` | `npx tsc --noEmit` |
| 04 | `pnpm test lib/services/__tests__/generation-service app/actions/__tests__/generations` | `pnpm test app/actions/__tests__/generations-multi-ref app/actions/__tests__/generations-upscale` | `npx tsc --noEmit` |
| 05 | `pnpm test lib/__tests__/workspace-state` | `pnpm test components/workspace/__tests__/prompt-area` | `npx tsc --noEmit` |
| 06 | `pnpm test app/actions/__tests__/prompts-history` | `pnpm test lib/__tests__/workspace-state` | `npx tsc --noEmit` |
| 07 | `pnpm test components/canvas/__tests__` | `pnpm test components/canvas/__tests__` | `npx tsc --noEmit` |
| 08 | `cd backend && python -m pytest tests/unit/test_prompt_tools.py -v` | `cd backend && python -m pytest tests/integration/test_prompt_tools_integration.py -v` | `cd backend && python -m pytest tests/ -k "prompt_tools" -v` |
| 09 | `cd backend && python -m pytest tests/ -k "prompt_knowledge or dtos" -v` | `cd backend && python -m pytest tests/integration/ -k "prompt" -v` | `cd backend && python -m pytest tests/acceptance/test_slice_12_prompt_tools_backend.py -v` |
| 10 | `pnpm vitest run lib/assistant/__tests__/` | -- | `pnpm vitest run lib/assistant/__tests__/` |
| 11 | `pnpm test` | `cd backend && python -m pytest -v` | `pnpm test && cd backend && python -m pytest -v && npx tsc --noEmit` |

---

## E2E Validation

AFTER all slices completed:

```yaml
e2e_validation:
  - step: "Execute Regression Suite"
    commands:
      - "pnpm test"
      - "cd backend && python -m pytest -v"
      - "npx tsc --noEmit"
    expected: "0 failures, 0 errors across all commands"

  - step: "Execute E2E Checklist"
    reference: "gates/e2e-checklist.md"
    action: "Walk through every checkbox in the Happy Path Tests and Edge Cases sections"

  - step: "Codebase Grep -- No Remaining References"
    command: 'grep -r "negativePrompt\|promptStyle" --include="*.ts" --include="*.tsx" lib/ app/ components/'
    expected: "No production code matches (test files and specs are allowed)"

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
  - condition: "Slice 01 (DB Schema) fails"
    action: "Revert schema.ts and delete migration file. No downstream impact."
    note: "Foundation slice -- failure here blocks everything."

  - condition: "Slice 02-04 (Backend) fails"
    action: "Revert the failing slice. Earlier slices are stable."
    note: "TypeScript compiler will show expected errors in later-slice files."

  - condition: "Slice 05-07 (Frontend UI) fails"
    action: "Revert the failing UI slice. Backend slices unaffected."
    note: "UI changes are isolated -- only types flow between slices."

  - condition: "Slice 08-09 (Python Backend) fails"
    action: "Revert Python changes. Frontend slices unaffected until Slice 10."
    note: "Python and TypeScript branches are independent until Slice 10/11."

  - condition: "Slice 10 (Assistant Frontend) fails"
    action: "Revert assistant-context.tsx and use-assistant-runtime.ts changes."
    note: "Only SSE parsing and DraftPrompt interface affected."

  - condition: "Slice 11 (E2E) fails"
    action: "Review integration-map.md for gaps. Likely a cross-slice issue requiring targeted fix."
    note: "Do NOT revert all slices. Identify the specific failing integration point."

  - condition: "Full feature rollback needed"
    action: "Revert entire feature branch. All changes are on a single branch."
    note: "Atomic: DB migration must be reverted manually if already pushed to dev DB."
```

---

## Monitoring

During implementation:

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| Slice completion time | > 2x estimate | Review slice scope, check for unexpected dependencies |
| Test failures within slice | > 0 blocking | Fix before proceeding to next wave |
| TypeScript errors in CURRENT slice files | > 0 | Must fix before marking slice complete |
| TypeScript errors in FUTURE slice files | Expected | Document count, verify they decrease as slices complete |
| Integration test failure | Any | Check integration-map.md connections for root cause |
| Deliverable missing | Any | Slice is incomplete -- do not proceed |
| Python backend health | Unresponsive during Slices 08-09 | Restart uvicorn, check for import errors |

---

## Notes

### Dual-Stack Coordination

This feature modifies both TypeScript (Next.js) and Python (FastAPI/LangGraph) code. The two stacks are connected only through:
1. SSE events (Python backend streams to TypeScript frontend)
2. Session restore API (Python backend serves, TypeScript frontend consumes)

The stacks are independent until Slice 10 (Assistant Frontend) and Slice 11 (E2E Verification), which validate the cross-stack integration.

### Atomic Deploy Requirement

Per Architecture: Frontend and Backend MUST be deployed simultaneously because the SSE payload format changes from `{motiv, style, negative_prompt}` to `{prompt}`. A partial deploy would cause SSE parsing failures.

### DB Migration Warning

Migration `0012_drop_prompt_style_negative.sql` is IRREVERSIBLE. It drops columns and their data. Per Discovery, this is accepted. The migration should be run on dev DB during Slice 11 verification, NOT on production until the full feature is approved.
