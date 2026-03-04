# Orchestrator Configuration: Quality Gates Upgrade

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
    status: "APPROVED"

  - name: "Gate 2: All Slices Approved"
    files:
      - "slices/compliance-slice-01.md"
      - "slices/compliance-slice-02.md"
      - "slices/compliance-slice-03.md"
      - "slices/compliance-slice-04.md"
    required: "ALL Verdict == APPROVED"
    status: "ALL APPROVED (4/4)"

  - name: "Gate 3: Integration Map Valid"
    file: "integration-map.md"
    required: "Missing Inputs == 0, Orphaned Outputs == 0, Runtime Path Gaps == 0"
    status: "VALID (0 gaps)"
```

---

## Implementation Order

Based on dependency analysis:

| Order | Slice | Name | Depends On | Parallel? |
|-------|-------|------|------------|-----------|
| 1 | 01 | Code Reviewer Agent | -- | Yes with Slice 02 |
| 1 | 02 | Deterministic Pre-Test Gate | -- | Yes with Slice 01 |
| 2 | 03 | Pipeline Integration | Slice 01, Slice 02 | No (integration) |
| 3 | 04 | Chrome DevTools Smoke Test | Slice 03 | No (depends on pipeline) |

**Wave Structure:**

```
Wave 1: [Slice 01, Slice 02]  -- parallel, no dependencies
Wave 2: [Slice 03]            -- requires Wave 1 complete
Wave 3: [Slice 04]            -- requires Wave 2 complete
```

**File Modification Sequence (critical for Slice 02 + 03):**

Both Slice 02 and Slice 03 modify `.claude/agents/slice-impl-coordinator.md`. Implementation order ensures no conflicts:

1. **Slice 02 FIRST:** Adds Frontmatter (Bash), Phase 1a (Stack-Detection), Phase 2c (Deterministic Gate)
2. **Slice 03 SECOND:** Reads the already-modified file, adds Phase 2b (Code-Review), updates Description/Rolle/Evidence/Output

This sequential ordering is enforced by Slice 03's dependency on Slice 02.

---

## Deliverables Per Slice

### Slice 01: Code Reviewer Agent

```yaml
deliverables:
  new_files:
    - path: ".claude/agents/code-reviewer.md"
      description: "Agent-Definition with YAML Frontmatter, 6-step Workflow, Adversarial Review Prompt (4 rules), Severity Categories, Verdict Logic, JSON Output Contract, Input Parsing, Git-Diff Handling"
```

### Slice 02: Deterministic Pre-Test Gate

```yaml
deliverables:
  modified_files:
    - path: ".claude/agents/slice-impl-coordinator.md"
      modifications:
        - "Frontmatter: Add Bash to tools"
        - "New Phase 1a: Stack-Detection for 10 stacks"
        - "New Phase 2c: Deterministic Gate with Fix-Loop max 3"
        - "Phase 4: detected_stack Weitergabe in test-validator Task()-Prompt"
```

### Slice 03: Pipeline Integration

```yaml
deliverables:
  modified_files:
    - path: ".claude/agents/slice-impl-coordinator.md"
      modifications:
        - "Frontmatter description update (6-Step Pipeline)"
        - "Rolle-Section update (10 Steps)"
        - "New Phase 2b: Code-Review Loop with Task(code-reviewer)"
        - "Phase 5 Evidence: Add review + deterministic_gate fields"
        - "Phase 6 JSON Output: Add review_iterations, review_verdict, lint_iterations, detected_stack"
```

### Slice 04: Chrome DevTools Smoke Test

```yaml
deliverables:
  modified_files:
    - path: ".claude/agents/test-validator.md"
      modifications:
        - "Stage 4 Smoke: Add DevTools steps after Health-Poll"
        - "MCP availability check (TRY/CATCH)"
        - "DOM Snapshot, Console-Error collection, Screenshot"
        - "Fallback to health_only"
        - "JSON Output Contract: Add smoke_mode, dom_snapshot, console_errors, screenshot_path"
        - "Truncation rules: DOM max 10,000 chars, Console max 20 entries"
```

---

## Post-Slice Validation

FOR each completed slice:

```yaml
validation_steps:
  - step: "Deliverables Check"
    action: "Verify all files listed in DELIVERABLES_START/END exist and contain required content"

  - step: "Manual Tests"
    action: "Execute manual test procedure from slice test_spec section"

  - step: "Integration Points"
    action: "Verify outputs match Integration Contract Provides section"
    reference: "integration-map.md -> Connections"

  - step: "Acceptance Criteria"
    action: "Verify each AC (GIVEN/WHEN/THEN) passes"
```

### Slice-Specific Validation

```yaml
slice_01_validation:
  - "code-reviewer.md has valid YAML Frontmatter (name, description, tools)"
  - "Workflow has exactly 6 steps"
  - "Adversarial Prompt has all 4 rules"
  - "JSON Output Contract has verdict, findings[], summary"
  - "Severity table has 4 levels with Pipeline-Wirkung"
  - "Verdict logic table has 3 conditions"

slice_02_validation:
  - "slice-impl-coordinator.md Frontmatter has Bash in tools"
  - "Phase 1a covers 10 stacks"
  - "detected_stack has 7 fields"
  - "Phase 2c has max 3 retries"
  - "Unknown stack = Warning + Skip"
  - "Error truncation max 2000 chars"

slice_03_validation:
  - "Phase 2b is AFTER Phase 2 and BEFORE Phase 2c"
  - "Task(code-reviewer) has 4 required params + Stack Info"
  - "Verdict evaluation: APPROVED/CONDITIONAL/REJECTED correct"
  - "Fix-Loop: Task(slice-implementer) with CRITICAL findings"
  - "Max 3 retries then HARD EXIT"
  - "Evidence + Output JSON contain new fields"
  - "Description mentions code-reviewer and Deterministic Gate"

slice_04_validation:
  - "Stage 4 has DevTools steps after Health-Poll"
  - "MCP check via TRY/CATCH"
  - "Fallback to health_only"
  - "Console Errors = Warning not Failure"
  - "DOM missing = Warning not Failure"
  - "JSON Output has smoke_mode, dom_snapshot, console_errors, screenshot_path"
  - "App ALWAYS stopped after DevTools steps"
```

---

## E2E Validation

AFTER all slices completed:

```yaml
e2e_validation:
  - step: "Execute e2e-checklist.md"
    description: "Run all 25 happy path checks + edge cases + integration points"

  - step: "Cross-Slice File Consistency"
    checks:
      - "slice-impl-coordinator.md contains ALL modifications from Slice 02 AND Slice 03"
      - "Phase ordering: 1 -> 1a -> 2 -> 2b -> 2c -> 3 -> 4 -> 5 -> 6"
      - "Evidence JSON has fields from both Slice 03 (review) and Slice 04 (smoke)"

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
    action: "Delete .claude/agents/code-reviewer.md"
    impact: "Slice 03 cannot proceed (dependency)"
    note: "No other slices affected"

  - condition: "Slice 02 fails"
    action: "Revert slice-impl-coordinator.md changes (remove Bash, Phase 1a, Phase 2c)"
    impact: "Slice 03 cannot proceed (dependency)"
    note: "Slice 01 unaffected"

  - condition: "Slice 03 fails"
    action: "Revert slice-impl-coordinator.md Phase 2b, Evidence, Output changes"
    impact: "Slice 04 cannot proceed. Slice 01 + 02 changes remain valid but unused."
    note: "May need to also revert Slice 01 + 02 for clean state"

  - condition: "Slice 04 fails"
    action: "Revert test-validator.md Stage 4 changes"
    impact: "None -- Slice 01-03 remain functional"
    note: "Smoke Test reverts to health_only (original behavior)"

  - condition: "Integration fails (E2E)"
    action: "Review integration-map.md for gaps, check file modification consistency"
    note: "Most likely cause: Slice 02 + 03 modifications to same file conflicting"
```

---

## Monitoring

During implementation:

| Metric | Alert Threshold |
|--------|-----------------|
| Slice completion time | > 2x estimate (estimate: ~15min per slice for .md files) |
| Deliverable missing | Any file in DELIVERABLES_START/END not created |
| Manual test failure | Any AC not met |
| Integration test fail | Any cross-slice connection broken |
| File conflict | Slice 02 + 03 modifying same section of coordinator |
