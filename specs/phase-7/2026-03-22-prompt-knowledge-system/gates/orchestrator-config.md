# Orchestrator Configuration: Model-Aware Prompt Knowledge System

**Integration Map:** `integration-map.md`
**E2E Checklist:** `e2e-checklist.md`
**Generated:** 2026-03-23

---

## Pre-Implementation Gates

```yaml
pre_checks:
  - name: "Gate 1: Architecture Compliance"
    file: "gates/compliance-architecture.md"
    required: "Verdict == APPROVED"

  - name: "Gate 2: All Slices Approved"
    files: "gates/compliance-slice-*.md"
    required: "ALL Verdict == APPROVED (13/13)"

  - name: "Gate 3: Integration Map Valid"
    file: "gates/integration-map.md"
    required: "Missing Inputs == 0, Orphaned Outputs == 0, Runtime Path Gaps == 0, Semantic Consistency Gaps == 0"
```

---

## Implementation Order

Based on dependency analysis, slices are organized into 6 waves:

| Wave | Order | Slice | Name | Depends On | Parallel? |
|------|-------|-------|------|------------|-----------|
| 1 | 1 | 01 | Knowledge JSON Schema + Fallback-Skeleton | -- | Foundation (solo) |
| 2 | 2 | 02 | TS Lookup-Funktion | 01 | Yes with 03, 11 |
| 2 | 2 | 03 | Python Lookup-Funktion | 01 | Yes with 02, 11 |
| 2 | 2 | 11 | Knowledge-Inhalt (9 Modelle) | 01 | Yes with 02, 03 |
| 3 | 3 | 04 | Improver buildSystemPrompt | 02 | Yes with 06, 09, 10 |
| 3 | 3 | 06 | Assistant System-Prompt | 03 | Yes with 04, 09, 10 |
| 3 | 3 | 09 | Canvas Chat Injection | 03 | Yes with 04, 06, 10 |
| 3 | 3 | 10 | recommend_model Enhancement | 03 | Yes with 04, 06, 09 |
| 4 | 4 | 05 | Improver generationMode Passthrough | 04 | Yes with 07 |
| 4 | 4 | 07 | Assistant DTO + Route + Service | 06 | Yes with 05 |
| 5 | 5 | 08 | Assistant Frontend | 07 | Solo in wave |
| 6 | 6 | 12 | Integration-Test Improver | 05, 11 | Yes with 13 |
| 6 | 6 | 13 | Integration-Test Python | 06, 09, 10, 11 | Yes with 12 |

### Wave Summary

```
Wave 1: [slice-01]                          -- Foundation
Wave 2: [slice-02, slice-03, slice-11]      -- Parallel: TS Lookup + Python Lookup + Content
Wave 3: [slice-04, slice-06, slice-09, slice-10] -- Parallel: All 4 injection points
Wave 4: [slice-05, slice-07]                -- Parallel: Passthrough layers
Wave 5: [slice-08]                          -- Frontend wiring
Wave 6: [slice-12, slice-13]               -- Parallel: Integration tests
```

---

## Slice Execution Details

### Wave 1

#### Slice 01: Knowledge JSON Schema + Fallback-Skeleton

```yaml
slice: slice-01-knowledge-schema
stack: typescript-nextjs
deliverables:
  - data/prompt-knowledge.json (NEW)
  - lib/types/prompt-knowledge.ts (NEW)
test_command: "pnpm test lib/types/__tests__/prompt-knowledge.test.ts"
acceptance_command: "pnpm exec tsc --noEmit"
```

### Wave 2 (parallel)

#### Slice 02: TS Lookup-Funktion

```yaml
slice: slice-02-ts-lookup
stack: typescript-nextjs
depends_on: [slice-01-knowledge-schema]
deliverables:
  - lib/services/prompt-knowledge.ts (NEW)
test_command: "pnpm test lib/services/__tests__/prompt-knowledge.test.ts"
acceptance_command: "pnpm exec tsc --noEmit"
```

#### Slice 03: Python Lookup-Funktion

```yaml
slice: slice-03-python-lookup
stack: python-fastapi
depends_on: [slice-01-knowledge-schema]
deliverables:
  - backend/app/agent/prompt_knowledge.py (NEW)
test_command: "cd backend && python -m pytest tests/unit/test_prompt_knowledge.py -v"
acceptance_command: "cd backend && python -c \"from app.agent.prompt_knowledge import get_prompt_knowledge, format_knowledge_for_prompt; print('OK')\""
```

#### Slice 11: Knowledge-Inhalt

```yaml
slice: slice-11-knowledge-content
stack: typescript-nextjs
depends_on: [slice-01-knowledge-schema]
deliverables:
  - data/prompt-knowledge.json (EXTEND)
test_command: "pnpm test data/__tests__/prompt-knowledge-content.test.ts"
acceptance_command: "pnpm exec tsc --noEmit"
```

### Wave 3 (parallel)

#### Slice 04: Improver buildSystemPrompt

```yaml
slice: slice-04-improver-injection
stack: typescript-nextjs
depends_on: [slice-02-ts-lookup]
deliverables:
  - lib/services/prompt-service.ts (MODIFY)
test_command: "pnpm test lib/services/__tests__/prompt-service.test.ts"
acceptance_command: "pnpm exec tsc --noEmit"
```

#### Slice 06: Assistant System-Prompt

```yaml
slice: slice-06-assistant-prompt
stack: python-fastapi
depends_on: [slice-03-python-lookup]
deliverables:
  - backend/app/agent/prompts.py (MODIFY)
  - backend/app/agent/graph.py (MODIFY)
test_command: "cd backend && python -m pytest tests/unit/test_build_assistant_prompt.py -v"
acceptance_command: "cd backend && python -c \"from app.agent.prompts import build_assistant_system_prompt; p = build_assistant_system_prompt(None, None); assert 'Prompt-Assistent' in p; print('OK')\""
```

#### Slice 09: Canvas Chat Injection

```yaml
slice: slice-09-canvas-injection
stack: python-fastapi
depends_on: [slice-03-python-lookup]
deliverables:
  - backend/app/agent/canvas_graph.py (MODIFY)
test_command: "cd backend && python -m pytest tests/unit/test_canvas_knowledge_injection.py -v"
acceptance_command: "cd backend && python -c \"from app.agent.canvas_graph import build_canvas_system_prompt; p = build_canvas_system_prompt({'model_id': 'flux-2-pro', 'image_url': 'x', 'prompt': 'test', 'model_params': {}}); assert 'tips' in p.lower() or 'Prompting' in p; print('OK')\""
```

#### Slice 10: recommend_model Enhancement

```yaml
slice: slice-10-recommend-model
stack: python-fastapi
depends_on: [slice-03-python-lookup]
deliverables:
  - backend/app/agent/tools/model_tools.py (MODIFY)
test_command: "cd backend && python -m pytest tests/unit/test_model_tools_knowledge.py -v"
acceptance_command: "cd backend && python -c \"from app.agent.tools.model_tools import _match_model; print('OK')\""
```

### Wave 4 (parallel)

#### Slice 05: Improver generationMode Passthrough

```yaml
slice: slice-05-improver-passthrough
stack: typescript-nextjs
depends_on: [slice-04-improver-injection]
deliverables:
  - app/actions/prompts.ts (MODIFY)
  - components/prompt-improve/llm-comparison.tsx (MODIFY)
  - components/workspace/prompt-area.tsx (MODIFY)
test_command: "pnpm test components/prompt-improve/__tests__/llm-comparison.test.tsx app/actions/__tests__/prompts.test.ts components/workspace/__tests__/prompt-area-improve.test.tsx"
acceptance_command: "pnpm exec tsc --noEmit"
```

#### Slice 07: Assistant DTO + Route + Service

```yaml
slice: slice-07-assistant-dto
stack: python-fastapi
depends_on: [slice-06-assistant-prompt]
deliverables:
  - backend/app/models/dtos.py (MODIFY)
  - backend/app/routes/messages.py (MODIFY)
  - backend/app/services/assistant_service.py (MODIFY)
test_command: "cd backend && python -m pytest tests/unit/test_assistant_dto_route.py -v"
acceptance_command: "cd backend && python -c \"from app.models.dtos import SendMessageRequest; r = SendMessageRequest(content='test'); assert r.image_model_id is None; r2 = SendMessageRequest(content='test', image_model_id='flux-2-pro', generation_mode='txt2img'); print('OK')\""
```

### Wave 5

#### Slice 08: Assistant Frontend

```yaml
slice: slice-08-assistant-frontend
stack: typescript-nextjs
depends_on: [slice-07-assistant-dto]
deliverables:
  - lib/assistant/use-assistant-runtime.ts (MODIFY)
  - lib/assistant/assistant-context.tsx (MODIFY)
test_command: "pnpm vitest run lib/assistant/__tests__/use-assistant-runtime-knowledge.test.ts"
acceptance_command: "pnpm tsc --noEmit"
```

### Wave 6 (parallel)

#### Slice 12: Integration-Test Improver

```yaml
slice: slice-12-integration-improver
stack: typescript-nextjs
depends_on: [slice-05-improver-passthrough, slice-11-knowledge-content]
deliverables:
  - lib/services/__tests__/prompt-service.integration.test.ts (NEW)
test_command: "pnpm test lib/services/__tests__/prompt-service.integration.test.ts"
integration_command: "pnpm test lib/services/__tests__/prompt-service.integration.test.ts"
```

#### Slice 13: Integration-Test Python

```yaml
slice: slice-13-integration-python
stack: python-fastapi
depends_on: [slice-06-assistant-prompt, slice-09-canvas-injection, slice-10-recommend-model, slice-11-knowledge-content]
deliverables:
  - backend/tests/test_knowledge_integration.py (NEW)
test_command: "cd backend && python -m pytest tests/test_knowledge_integration.py -v"
integration_command: "cd backend && python -m pytest tests/test_knowledge_integration.py -v"
```

---

## Post-Slice Validation

FOR each completed slice:

```yaml
validation_steps:
  - step: "Deliverables Check"
    action: "Verify all files in DELIVERABLES_START/END exist and are modified/created"

  - step: "Unit Tests"
    action: "Run the slice's test_command. All tests must pass."

  - step: "Acceptance Check"
    action: "Run the slice's acceptance_command. Must succeed."

  - step: "Type Safety"
    action: "For TS slices: pnpm exec tsc --noEmit. For Python slices: acceptance_command."

  - step: "Integration Points"
    action: "Verify outputs accessible by dependent slices per integration-map.md Connections table"
    reference: "integration-map.md -> Connections"
```

---

## E2E Validation

AFTER all slices completed:

```yaml
e2e_validation:
  - step: "Run all TS tests"
    command: "pnpm test"
    expected: "All tests pass (existing + new)"

  - step: "Run all Python tests"
    command: "cd backend && python -m pytest -v"
    expected: "All tests pass (existing + new)"

  - step: "Run Improver integration test"
    command: "pnpm test lib/services/__tests__/prompt-service.integration.test.ts"
    expected: "6 tests pass"

  - step: "Run Python integration test"
    command: "cd backend && python -m pytest tests/test_knowledge_integration.py -v"
    expected: "7 tests pass"

  - step: "TypeScript compilation"
    command: "pnpm exec tsc --noEmit"
    expected: "No errors"

  - step: "Execute e2e-checklist.md"
    action: "Walk through all Happy Path and Edge Case checks"

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
  - condition: "Slice in Wave 1 (01) fails"
    action: "Revert slice-01 changes. No other slices started yet."
    note: "Foundation slice, blocks everything."

  - condition: "Slice in Wave 2 (02/03/11) fails"
    action: "Revert failing slice only. Other Wave 2 slices are independent."
    note: "Wave 3+ slices cannot start until failing dependency is fixed."

  - condition: "Slice in Wave 3-5 (04/05/06/07/08/09/10) fails"
    action: "Revert failing slice changes only. Dependencies are stable."
    note: "Parallel slices in same wave are unaffected."

  - condition: "Integration tests (12/13) fail"
    action: "Review integration-map.md for gaps. Fix responsible production slice."
    note: "May need slice spec updates if gap is in spec, not implementation."

  - condition: "Cross-stack integration fails (Frontend <-> Backend)"
    action: "Review DTO contract between slice-07 and slice-08"
    note: "Most likely cause: field names or types mismatched between TS and Python"
```

---

## Monitoring

During implementation:

| Metric | Alert Threshold |
|--------|-----------------|
| Slice completion time | > 2x estimate |
| Test failures per slice | > 0 blocking |
| Deliverable missing | Any |
| TypeScript compilation errors | Any |
| Python import errors | Any |
| Integration test failures | Any |

---

## Notes

- **No UI changes:** This feature is invisible to users. All changes are backend system-prompt enrichment.
- **No database changes:** Knowledge is stored as a static JSON file in the repo.
- **No new endpoints:** Only the existing POST `/api/assistant/sessions/{id}/messages` is extended with optional fields.
- **Backward compatibility:** All new parameters are optional with safe defaults. Existing behavior is preserved when new fields are absent.
- **Cross-stack consistency:** The JSON knowledge file is the single source of truth, read independently by TypeScript (slice-02) and Python (slice-03) with identical prefix-matching logic.
