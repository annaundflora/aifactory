# Orchestrator Configuration: Prompt Assistant

**Integration Map:** `integration-map.md`
**E2E Checklist:** `e2e-checklist.md`
**Generated:** 2026-03-12

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
    count: 22

  - name: "Gate 3: Integration Map Valid"
    file: "integration-map.md"
    required: "Missing Inputs == 0 AND Deliverable-Consumer Gaps == 0 AND Runtime Path Gaps == 0"
```

---

## Implementation Order

Based on dependency analysis, slices can be organized into 10 implementation waves. Slices within the same wave can be executed in parallel.

| Wave | Slice | Name | Depends On | Parallel? |
|------|-------|------|------------|-----------|
| 1 | 01 | Python Projekt-Setup | -- | Yes with 05, 06, 07 |
| 1 | 05 | DB Schema (Drizzle) | -- | Yes with 01, 06, 07 |
| 1 | 06 | Next.js Proxy Config | -- | Yes with 01, 05, 07 |
| 1 | 07 | Legacy Cleanup | -- | Yes with 01, 05, 06 |
| 2 | 02 | FastAPI Server + Health | 01 | Yes with 08 |
| 2 | 08 | Assistant Sheet Shell | 07 | Yes with 02 |
| 3 | 03 | LangGraph Agent | 02 | Yes with 09 |
| 3 | 09 | Startscreen + Chips | 08 | Yes with 03 |
| 4 | 04 | SSE Streaming Endpoint | 03 | No (backend foundation) |
| 5 | 10 | Core Chat Loop | 04, 06, 09 | Yes with 13a |
| 5 | 13a | Session Repository Backend | 04, 05 | Yes with 10 |
| 6 | 11 | Streaming + Stop | 10 | Yes with 12, 13b, 22 |
| 6 | 12 | Prompt Tools Backend | 10 | Yes with 11, 13b, 22 |
| 6 | 13b | Session-Liste UI | 13a | Yes with 11, 12, 22 |
| 6 | 22 | LangSmith + Error Handling | 10 | Yes with 11, 12, 13b |
| 7 | 13c | Session Resume + Switcher | 13b, 10 | Yes with 14, 16 |
| 7 | 14 | Prompt Canvas Panel | 12 | Yes with 13c, 16 |
| 7 | 16 | analyze_image Tool | 12 | Yes with 13c, 14 |
| 8 | 15 | Apply-Button + Workspace | 14 | Yes with 17, 20 |
| 8 | 17 | Image Upload Chat UI | 16 | Yes with 15, 20 |
| 8 | 20 | recommend_model Tools | 14 | Yes with 15, 17 |
| 9 | 18 | Bildanalyse DB-Caching | 17 | Yes with 19, 21 |
| 9 | 19 | Iterativer Loop | 15 | Yes with 18, 21 |
| 9 | 21 | Model-Empfehlung UI | 20 | Yes with 18, 19 |

**Critical Path:** 01 -> 02 -> 03 -> 04 -> 10 -> 12 -> 14 -> 15 -> 19

---

## Post-Slice Validation

FOR each completed slice:

```yaml
validation_steps:
  - step: "Deliverables Check"
    action: "Verify all files listed in DELIVERABLES_START/END exist and are non-empty"

  - step: "Unit Tests"
    action: "Run the Test Command from the slice Test-Strategy section"
    python_slices: "cd backend && python -m pytest tests/{test_file} -v"
    typescript_slices: "pnpm test {test_path}"

  - step: "Integration Test"
    action: "Run the Integration Command from the slice Test-Strategy section"

  - step: "Integration Points"
    action: "Verify outputs accessible by dependent slices"
    reference: "integration-map.md -> Connections table"

  - step: "Build Verification"
    action: "For TypeScript slices: pnpm build must succeed"
    action_python: "For Python slices: cd backend && pip install -e . must succeed"
```

---

## E2E Validation

AFTER all slices completed:

```yaml
e2e_validation:
  - step: "Start both services"
    commands:
      - "cd backend && uvicorn app.main:app --reload"
      - "pnpm dev"

  - step: "Health check"
    verify: "curl http://localhost:3000/api/assistant/health returns {status: ok}"

  - step: "Execute e2e-checklist.md"
    action: "Walk through all Happy Path tests manually or via E2E test runner"

  - step: "FOR each failing check"
    actions:
      - "Identify responsible slice from Integration Map"
      - "Create fix task with slice reference"
      - "Re-run affected slice tests"
      - "Re-run E2E check after fix"

  - step: "Final Approval"
    condition: "ALL checks in e2e-checklist.md PASS"
    output: "Feature READY for merge"
```

---

## Slice-Specific Commands Reference

| Slice | Stack | Test Command | Start Command |
|-------|-------|-------------|---------------|
| 01 | python | `cd backend && python -m pytest tests/test_project_setup.py -v` | -- |
| 02 | python | `cd backend && python -m pytest tests/test_server_health.py -v` | `cd backend && uvicorn app.main:app --reload` |
| 03 | python | `cd backend && python -m pytest tests/test_agent.py -v` | `cd backend && uvicorn app.main:app --reload` |
| 04 | python | `cd backend && python -m pytest tests/test_sse_streaming.py -v` | `cd backend && uvicorn app.main:app --reload` |
| 05 | typescript | `pnpm test lib/db/__tests__/assistant-schema.test.ts` | `pnpm dev` |
| 06 | typescript | `pnpm test next.config` | `pnpm dev` |
| 07 | typescript | `pnpm test components/workspace/__tests__/prompt-area.test.tsx` | `pnpm dev` |
| 08 | typescript | `pnpm test components/assistant/__tests__` | `pnpm dev` |
| 09 | typescript | `pnpm test components/assistant/__tests__` | `pnpm dev` |
| 10 | typescript | `pnpm test lib/assistant/__tests__ components/assistant/__tests__/chat-thread.test.tsx` | `pnpm dev` |
| 11 | typescript | `pnpm test components/assistant/__tests__/streaming-indicator.test.tsx components/assistant/__tests__/chat-input-streaming.test.tsx components/assistant/__tests__/chat-thread-streaming.test.tsx` | `pnpm dev` |
| 12 | python | `cd backend && python -m pytest tests/test_prompt_tools.py -v` | `cd backend && uvicorn app.main:app --reload` |
| 13a | python | `cd backend && python -m pytest tests/test_session_repository.py -v` | `cd backend && uvicorn app.main:app --reload` |
| 13b | typescript | `pnpm vitest run components/assistant/__tests__/session-list.test.tsx lib/assistant/__tests__/use-sessions.test.ts` | `pnpm dev` |
| 13c | dual | `pnpm vitest run components/assistant/__tests__/session-switcher.test.tsx lib/assistant/__tests__/assistant-context-resume.test.ts && cd backend && python -m pytest tests/test_session_resume.py -v` | both |
| 14 | typescript | `pnpm test components/assistant/__tests__/prompt-canvas.test.tsx lib/assistant/__tests__/assistant-context-canvas.test.tsx` | `pnpm dev` |
| 15 | typescript | `pnpm test components/assistant/__tests__/apply-button.test.tsx components/assistant/__tests__/prompt-canvas-apply.test.tsx lib/assistant/__tests__/assistant-context-apply.test.tsx` | `pnpm dev` |
| 16 | python | `cd backend && python -m pytest tests/test_image_tools.py -v` | `cd backend && uvicorn app.main:app --reload` |
| 17 | typescript | `pnpm test components/assistant/__tests__/image-upload-button.test.tsx components/assistant/__tests__/image-preview.test.tsx components/assistant/__tests__/chat-input-image.test.tsx` | `pnpm dev` |
| 18 | python | `cd backend && python -m pytest tests/test_image_repository.py tests/test_image_tools_caching.py -v` | `cd backend && uvicorn app.main:app --reload` |
| 19 | typescript | `pnpm test lib/assistant/__tests__/assistant-context-persistence.test.tsx components/assistant/__tests__/assistant-sheet-resume.test.tsx components/assistant/__tests__/chat-thread-feedback.test.tsx` | `pnpm dev` |
| 20 | python | `cd backend && python -m pytest tests/test_model_tools.py -v` | `cd backend && uvicorn app.main:app --reload` |
| 21 | typescript | `pnpm test components/assistant/__tests__/model-recommendation.test.tsx` | `pnpm dev` |
| 22 | dual | `pnpm test components/assistant/__tests__/error-message.test.tsx && cd backend && python -m pytest tests/test_error_handling.py -v` | both |

---

## Rollback Strategy

IF implementation fails:

```yaml
rollback:
  - condition: "Slice in Wave 1 fails (01, 05, 06, 07)"
    action: "Revert that slice only. Other Wave 1 slices are independent."
    note: "No downstream impact within wave."

  - condition: "Backend slice fails (01-04, 12, 13a, 16, 18, 20, 22)"
    action: "Revert that slice. Backend slices are isolated in backend/ folder."
    note: "Frontend slices can continue development with mocked backend."

  - condition: "Frontend slice fails (05-11, 13b-c, 14-15, 17, 19, 21)"
    action: "Revert that slice. Check dependent slices in integration-map.md."
    note: "Extended files (assistant-context.tsx, chat-input.tsx etc.) need careful merge."

  - condition: "Integration fails between frontend and backend"
    action: "Review integration-map.md for proxy config (Slice 06) and SSE protocol (Slice 04/10)."
    note: "Most common issue: SSE buffering through Next.js proxy."
    fallback: "Direct client-to-FastAPI with CORS (architecture.md fallback plan)."

  - condition: "Slice extends an existing file and conflicts arise"
    action: "Check Deliverables section -- files marked (erweitert) need sequential implementation."
    note: "assistant-context.tsx is modified by 6 slices (10, 13c, 14, 15, 19, 21) -- implement in order."
```

---

## High-Risk Files (Multiple Modifiers)

These files are modified by multiple slices and require careful sequential implementation:

| File | Created In | Modified In | Risk |
|------|-----------|-------------|------|
| `lib/assistant/assistant-context.tsx` | Slice 10 | 13c, 14, 15, 19, 21 | HIGH -- 6 slices touch this file |
| `components/assistant/assistant-sheet.tsx` | Slice 08 | 14, 19 | MEDIUM -- 3 slices |
| `components/assistant/chat-thread.tsx` | Slice 10 | 11, 19 | MEDIUM -- 3 slices |
| `components/assistant/chat-input.tsx` | Slice 09 | 11, 17 | MEDIUM -- 3 slices |
| `components/assistant/prompt-canvas.tsx` | Slice 14 | 15, 21 | MEDIUM -- 3 slices |
| `backend/app/agent/graph.py` | Slice 03 | 12, 16, 20 | MEDIUM -- 4 slices |
| `backend/app/services/assistant_service.py` | Slice 04 | 13c, 22 | LOW -- 3 slices |
| `backend/app/models/dtos.py` | Slice 04 | 13a | LOW -- 2 slices |
| `backend/app/config.py` | Slice 01 | 22 | LOW -- 2 slices |

---

## Monitoring

During implementation:

| Metric | Alert Threshold |
|--------|-----------------|
| Slice completion time | > 2x estimate |
| Test failures | > 0 blocking |
| Deliverable missing | Any |
| Integration test fail | Any |
| Build failure (pnpm build) | Any |
| Backend startup failure | Any |
| Proxy health check fail | Any |
