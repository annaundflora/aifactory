# Integration Map: Quality Gates Upgrade

**Generated:** 2026-03-04
**Slices:** 4
**Connections:** 11

---

## Dependency Graph (Visual)

```
+--------------------------+     +------------------------------------+
|  Slice 01                |     |  Slice 02                          |
|  Code Reviewer Agent     |     |  Deterministic Pre-Test Gate       |
|  (code-reviewer.md)      |     |  (slice-impl-coordinator.md mod)   |
+-----------+--------------+     +-----------+------------------------+
            |                                |
            |   4 resources                  |   4 resources
            |                                |
            +------+   +--------------------+
                   |   |
                   v   v
          +--------+---+----------+
          |  Slice 03              |
          |  Pipeline Integration  |
          |  (slice-impl-coord mod)|
          +--------+--------------+
                   |
                   |   3 resources
                   v
          +--------+--------------+
          |  Slice 04              |
          |  Chrome DevTools Smoke |
          |  (test-validator.md)   |
          +-----------------------+
```

---

## Nodes

### Slice 01: Code Reviewer Agent

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | 4 resources to Slice 03 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| (none) | -- | -- |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `.claude/agents/code-reviewer.md` | Agent-Definition | Slice 03 |
| JSON Output Contract (`{verdict, findings[], summary}`) | Data Contract | Slice 03 |
| Severity-Kategorien (CRITICAL/HIGH/MEDIUM/LOW) | Business Rule | Slice 03 |
| Verdict-Logik (APPROVED/CONDITIONAL/REJECTED) | Business Rule | Slice 03 |

---

### Slice 02: Deterministic Pre-Test Gate

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | 4 resources to Slice 03, Slice 04 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| (none) | -- | -- |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Bash-Tool im Coordinator Frontmatter | Tool-Zugriff | Slice 03 |
| Phase 1a: Stack-Detection-Logik (detected_stack) | Pipeline-Phase | Slice 03 |
| Phase 2c: Deterministic Gate Loop | Pipeline-Phase | Slice 03 |
| detected_stack Weitergabe-Pattern (`## Stack Info`) | Prompt-Template | Slice 03, Slice 04 |

---

### Slice 03: Pipeline Integration

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 01, Slice 02 |
| Outputs | 3 resources to Slice 04 and downstream |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `.claude/agents/code-reviewer.md` | Slice 01 | APPROVED -- Agent-Definition with YAML Frontmatter |
| JSON Output Contract | Slice 01 | APPROVED -- `{verdict, findings[], summary}` |
| Verdict-Logik | Slice 01 | APPROVED -- APPROVED/CONDITIONAL/REJECTED |
| Bash-Tool im Coordinator Frontmatter | Slice 02 | APPROVED -- tools field contains Bash |
| Phase 1a: Stack-Detection-Logik | Slice 02 | APPROVED -- detected_stack object |
| Phase 2c: Deterministic Gate Loop | Slice 02 | APPROVED -- Lint/TypeCheck max 3 retries |
| detected_stack Weitergabe-Pattern | Slice 02 | APPROVED -- `## Stack Info` Section |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| 6-Step Pipeline | Pipeline-Struktur | Slice 04 (Phase 4 as extension point) |
| Evidence mit review + lint Feldern | Data Contract | Evidence-Consumers |
| JSON Output mit review + lint Feldern | Data Contract | `/build` Command |

---

### Slice 04: Chrome DevTools Smoke Test

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 03 (implicitly Slice 02 via detected_stack) |
| Outputs | 2 resources (final user-facing) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| 6-Step Pipeline (Phase 4 extension point) | Slice 03 | APPROVED |
| detected_stack Weitergabe-Pattern | Slice 02 | APPROVED -- health_endpoint im Task()-Prompt |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Erweiterter Smoke JSON Output | Data Contract | slice-impl-coordinator (Evidence) |
| smoke_mode Feld | Enum | Evidence-Consumers |

---

## Connections

| # | From | To | Resource | Type | Status |
|---|------|----|----------|------|--------|
| 1 | Slice 01 | Slice 03 | `.claude/agents/code-reviewer.md` | Agent-Definition | VALID |
| 2 | Slice 01 | Slice 03 | JSON Output Contract | Data Contract | VALID |
| 3 | Slice 01 | Slice 03 | Severity-Kategorien | Business Rule | VALID |
| 4 | Slice 01 | Slice 03 | Verdict-Logik | Business Rule | VALID |
| 5 | Slice 02 | Slice 03 | Bash-Tool im Coordinator Frontmatter | Tool-Zugriff | VALID |
| 6 | Slice 02 | Slice 03 | Phase 1a: Stack-Detection-Logik | Pipeline-Phase | VALID |
| 7 | Slice 02 | Slice 03 | Phase 2c: Deterministic Gate Loop | Pipeline-Phase | VALID |
| 8 | Slice 02 | Slice 03 | detected_stack Weitergabe-Pattern | Prompt-Template | VALID |
| 9 | Slice 02 | Slice 04 | detected_stack Weitergabe-Pattern | Prompt-Template | VALID |
| 10 | Slice 03 | Slice 04 | 6-Step Pipeline | Pipeline-Struktur | VALID |
| 11 | Slice 04 | Slice 03 | Erweiterter Smoke JSON Output | Data Contract | VALID |

---

## Validation Results

### VALID Connections: 11

All declared dependencies have matching outputs. Every Input declared in a slice's Integration Contract has a corresponding Output (Provides) in the source slice.

### Orphaned Outputs: 0

All outputs are consumed by at least one downstream slice or are final user-facing outputs.

| Output | Defined In | Consumers | Classification |
|--------|------------|-----------|----------------|
| Evidence mit review + lint Feldern | Slice 03 | Evidence-Consumers (final output) | Final user-facing output |
| JSON Output mit review + lint Feldern | Slice 03 | `/build` Command (final output) | Final user-facing output |
| Erweiterter Smoke JSON Output | Slice 04 | slice-impl-coordinator Evidence (final output) | Final user-facing output |
| smoke_mode Feld | Slice 04 | Evidence-Consumers (final output) | Final user-facing output |

All non-consumed outputs are final user-facing outputs -- no orphans.

### Missing Inputs: 0

No inputs reference a resource that does not exist in another slice's Provides.

### Deliverable-Consumer Gaps: 0

| Component | Defined In | Consumer Page | Page In Deliverables? | Status |
|-----------|------------|---------------|-----------------------|--------|
| `code-reviewer.md` | Slice 01 | `slice-impl-coordinator.md` (mount via Task()) | Yes -- Slice 02 + Slice 03 Deliverables | VALID |
| Stack-Detection + Det. Gate in `slice-impl-coordinator.md` | Slice 02 | `slice-impl-coordinator.md` (self-contained) | Yes -- Slice 02 Deliverables | VALID |
| Phase 2b Code-Review Loop in `slice-impl-coordinator.md` | Slice 03 | `slice-impl-coordinator.md` (self-contained) | Yes -- Slice 03 Deliverables | VALID |
| DevTools Smoke in `test-validator.md` | Slice 04 | `test-validator.md` (self-contained) | Yes -- Slice 04 Deliverables | VALID |

Note: Slice 02 and Slice 03 both modify `slice-impl-coordinator.md`. This is correct because Slice 02 adds Phase 1a + Phase 2c + Frontmatter, and Slice 03 adds Phase 2b + Evidence/Output updates. They modify different sections of the same file. Implementation order (Slice 02 before Slice 03) ensures no conflicts.

### Runtime Path Gaps: 0

| User-Flow | Full Chain | All Links Present? | Status |
|-----------|------------|-------------------|--------|
| Flow 1: Slice Implementation with new Gates | Implementer commit -> Phase 2b Task(code-reviewer) -> Verdict eval -> Phase 2c Bash(lint+typecheck) -> Phase 3 Test-Writer -> Phase 4 Test-Validator | Yes -- Slice 01 defines agent, Slice 02 defines det. gate, Slice 03 wires Phase 2b, all phases sequential | VALID |
| Flow 2: Extended Smoke Test | Health-Poll -> MCP check -> DOM Snapshot -> Console Logs -> Screenshot -> App stop | Yes -- Slice 04 defines all steps in test-validator.md Stage 4 | VALID |
| Error: Code Review REJECTED max 3 | Phase 2b REJECTED -> Task(slice-implementer) + findings -> Re-Review -> HARD EXIT | Yes -- Slice 03 Phase 2b Pseudocode covers full loop + HARD EXIT | VALID |
| Error: Lint/TypeCheck persistent failure | Phase 2c failure -> Task(slice-implementer) + errors -> Re-Check -> HARD EXIT | Yes -- Slice 02 Phase 2c Pseudocode covers full loop + HARD EXIT | VALID |
| Fallback: Chrome DevTools MCP not available | MCP check fails -> smoke_mode = health_only -> Warning -> Pipeline continues | Yes -- Slice 04 TRY/CATCH pattern in Stage 4 | VALID |

---

## Discovery Traceability

### UI Components Coverage

> N/A -- Discovery confirms: "Agent/Pipeline Feature, kein UI". No UI components defined.

### State Machine Coverage

| State | Required UI | Available Actions | Covered In | Status |
|-------|-------------|-------------------|------------|--------|
| `code_written` | -- | Review starten | Slice 03 (Phase 2 -> Phase 2b transition) | COVERED |
| `review_in_progress` | -- | Warten auf Ergebnis | Slice 01 (Workflow Steps 1-5), Slice 03 (Task call) | COVERED |
| `review_passed` | -- | Deterministic Gate starten | Slice 03 (APPROVED/CONDITIONAL -> Phase 2c) | COVERED |
| `review_failed` | -- | Fix und Re-Review | Slice 03 (REJECTED -> Fix-Loop) | COVERED |
| `lint_passed` | -- | Test-Writer starten | Slice 02 (Phase 2c Gate Pass) | COVERED |
| `lint_failed` | -- | Auto-Fix und Re-Check | Slice 02 (Phase 2c Fix-Loop) | COVERED |
| `smoke_functional` | -- | Regression starten | Slice 04 (smoke_mode = "functional") | COVERED |
| `smoke_health_only` | -- | Regression starten (Fallback) | Slice 04 (smoke_mode = "health_only") | COVERED |

### Transitions Coverage

| From | Trigger | To | Covered In | Status |
|------|---------|-----|------------|--------|
| `code_written` | Implementer Commit | `review_in_progress` | Slice 03 (Phase 2 -> Phase 2b) | COVERED |
| `review_in_progress` | Reviewer: APPROVED/CONDITIONAL | `review_passed` | Slice 01 (Verdict-Logik), Slice 03 (Verdict eval) | COVERED |
| `review_in_progress` | Reviewer: REJECTED (CRITICAL) | `review_failed` | Slice 01 (Verdict-Logik), Slice 03 (REJECTED handling) | COVERED |
| `review_failed` | Implementer Fix + Re-Review | `review_in_progress` | Slice 03 (Fix-Loop max 3) | COVERED |
| `review_passed` | Start Deterministic Gate | `lint_passed` or `lint_failed` | Slice 02 (Phase 2c), Slice 03 (Phase ordering) | COVERED |
| `lint_failed` | Auto-Fix + Re-Check | `lint_passed` or `lint_failed` | Slice 02 (Fix-Loop max 3) | COVERED |
| `lint_passed` | Start Test-Pipeline | Test-Validator States | Slice 03 (Phase 3 -> Phase 4) | COVERED |
| Smoke: App started + HTTP 200 | Chrome DevTools MCP available | `smoke_functional` | Slice 04 (Stage 4 DevTools steps) | COVERED |
| Smoke: App started + HTTP 200 | Chrome DevTools MCP not available | `smoke_health_only` | Slice 04 (Fallback) | COVERED |

### Business Rules Coverage

| Rule | Covered In | Status |
|------|------------|--------|
| Code-Reviewer MUSS in separatem Context laufen (Task()) | Slice 01 (Adversarial Rule 3), Slice 03 (Task() call) | COVERED |
| Review-Prompt MUSS adversarial sein | Slice 01 (Adversarial Review Prompt, 4 Regeln) | COVERED |
| CRITICAL Issues blockieren Pipeline, HIGH/MEDIUM/LOW = Warnings | Slice 01 (Severity-Tabelle), Slice 03 (Verdict eval) | COVERED |
| Chrome DevTools MCP ist optional -- Fallback zu Health-Check | Slice 04 (MCP-Verfuegbarkeits-Check, Fallback) | COVERED |
| ESLint/TypeCheck pro Slice ist zusaetzlich zu final_validation | Slice 02 (Phase 2c, Constraints: "KEINE Aenderung an test-validator.md") | COVERED |
| Stack-Detection nutzt Indicator-File-Logik | Slice 02 (Phase 1a Stack-Detection, 10 Stacks) | COVERED |
| Console.error = Warning, nicht Failure | Slice 04 (AC-7, Constraints) | COVERED |

### Data Fields Coverage

| Field | Required | Covered In | Status |
|-------|----------|------------|--------|
| `review_findings` | Ja | Slice 01 (Output Contract: findings[]) | COVERED |
| `review_verdict` | Ja | Slice 01 (Output Contract: verdict), Slice 03 (Evidence) | COVERED |
| `review_iterations` | Ja | Slice 03 (Evidence: review.iterations) | COVERED |
| `lint_exit_code` | Ja | Slice 02 (lint_result.exit_code) | COVERED |
| `typecheck_exit_code` | Ja | Slice 02 (type_result.exit_code) | COVERED |
| `smoke_dom_snapshot` | Optional | Slice 04 (JSON Output: dom_snapshot) | COVERED |
| `smoke_console_errors` | Optional | Slice 04 (JSON Output: console_errors) | COVERED |
| `smoke_screenshot_path` | Optional | Slice 04 (JSON Output: screenshot_path) | COVERED |

**Discovery Coverage:** 36/36 (100%)

---

## File Modification Analysis

Multiple slices modify the same file. This is safe because they modify different sections:

| File | Modified By | Sections Modified | Conflict Risk |
|------|------------|-------------------|---------------|
| `.claude/agents/slice-impl-coordinator.md` | Slice 02, Slice 03 | Slice 02: Frontmatter (Bash), Phase 1a, Phase 2c. Slice 03: Description, Rolle, Phase 2b, Phase 5 Evidence, Phase 6 Output | NONE -- different sections, sequential implementation |
| `.claude/agents/code-reviewer.md` | Slice 01 | New file (complete) | NONE -- new file |
| `.claude/agents/test-validator.md` | Slice 04 | Stage 4 Smoke Test, JSON Output Contract | NONE -- only Slice 4 modifies this file |

---

## Summary

| Metric | Value |
|--------|-------|
| Total Slices | 4 |
| Total Connections | 11 |
| Valid Connections | 11 |
| Orphaned Outputs | 0 |
| Missing Inputs | 0 |
| Deliverable-Consumer Gaps | 0 |
| Runtime Path Gaps | 0 |
| Discovery Coverage | 36/36 (100%) |

**VERDICT: READY FOR ORCHESTRATION**
