# E2E Checklist: Quality Gates Upgrade

**Integration Map:** `integration-map.md`
**Generated:** 2026-03-04

---

## Pre-Conditions

- [x] All slices APPROVED (Gate 2) -- 4/4 APPROVED
- [x] Architecture APPROVED (Gate 1) -- compliance-architecture.md: APPROVED
- [x] Integration Map has no MISSING INPUTS -- 0 gaps

---

## Happy Path Tests

### Flow 1: Slice Implementation with New Gates (Discovery Flow 1)

1. [ ] **Slice 01:** `code-reviewer.md` exists with valid YAML Frontmatter (`name: code-reviewer`, `tools: Read, Grep, Glob, Bash(git diff:git log:git show)`)
2. [ ] **Slice 01:** Agent definition contains 6-step workflow, adversarial prompt (4 rules), severity categories (CRITICAL/HIGH/MEDIUM/LOW), verdict logic (APPROVED/CONDITIONAL/REJECTED)
3. [ ] **Slice 01:** JSON Output Contract specifies `{verdict, findings[], summary}` with all sub-fields
4. [ ] **Slice 02:** `slice-impl-coordinator.md` Frontmatter contains `tools: Read, Write, Glob, Grep, Task, Bash`
5. [ ] **Slice 02:** Phase 1a Stack-Detection recognizes all 10 stacks from architecture table
6. [ ] **Slice 02:** Phase 2c Deterministic Gate has lint auto-fix, lint check, type check, fix-loop max 3, HARD EXIT
7. [ ] **Slice 02:** Unknown stack -> Warning + Gate skip (not failure)
8. [ ] **Slice 03:** Phase 2b Code-Review Loop is positioned AFTER Phase 2 and BEFORE Phase 2c in the document
9. [ ] **Slice 03:** Task(code-reviewer) prompt includes slice_id, slice_file_path, architecture_path, working_dir, and `## Stack Info`
10. [ ] **Slice 03:** APPROVED verdict -> pipeline continues to Phase 2c without changes
11. [ ] **Slice 03:** CONDITIONAL verdict -> warnings stored in evidence, pipeline continues
12. [ ] **Slice 03:** REJECTED verdict -> Task(slice-implementer) with CRITICAL findings -> re-review
13. [ ] **Slice 03:** After 3 review retries -> HARD EXIT with `status: "failed"`, `error: "code-review: unresolved CRITICAL issues after 3 retries"`
14. [ ] **Slice 03:** Rolle-Section lists all pipeline steps (Stack-Detection, Implementer, Code-Reviewer, Deterministic Gate, Test-Writer, Test-Validator/Debugger)
15. [ ] **Slice 03:** Evidence JSON contains `review.verdict`, `review.iterations`, `review.findings_count`, `deterministic_gate.lint_status`, `deterministic_gate.typecheck_status`, `deterministic_gate.iterations`, `detected_stack`
16. [ ] **Slice 03:** Output JSON evidence contains `review_iterations`, `review_verdict`, `lint_iterations`, `detected_stack`

### Flow 2: Extended Smoke Test (Discovery Flow 2)

17. [ ] **Slice 04:** Stage 4 in `test-validator.md` contains DevTools steps AFTER Health-Poll and BEFORE App-Stop
18. [ ] **Slice 04:** MCP availability check via `mcp__chrome-devtools__navigate` with TRY/CATCH pattern
19. [ ] **Slice 04:** When MCP available: DOM Snapshot via `mcp__chrome-devtools__accessibility_snapshot()`, element_count parsed
20. [ ] **Slice 04:** When MCP available: Console logs via `mcp__chrome-devtools__console_messages()`, filter `level == "error"`
21. [ ] **Slice 04:** When MCP available: Optional screenshot via `mcp__chrome-devtools__screenshot()`, path `.claude/evidence/{feature}/{slice_id}-smoke.png`
22. [ ] **Slice 04:** When MCP available: `smoke_mode = "functional"`
23. [ ] **Slice 04:** When MCP NOT available: `smoke_mode = "health_only"`, warning logged
24. [ ] **Slice 04:** JSON Output Contract contains `smoke_mode`, `dom_snapshot`, `console_errors`, `screenshot_path`
25. [ ] **Slice 04:** Existing smoke fields (`app_started`, `health_status`, `startup_duration_ms`) remain unchanged

---

## Edge Cases

### Error Handling

- [ ] Code Review CRITICAL after 3 retries -> HARD EXIT with full error message (Slice 03)
- [ ] Lint/TypeCheck persistent failure after 3 retries -> HARD EXIT with `lint/typecheck: persistent failures` (Slice 02)
- [ ] JSON parse failure from code-reviewer -> HARD EXIT with `JSON parse failure from code-reviewer` (Slice 03)
- [ ] Implementer returns `unable_to_fix` for lint errors -> HARD EXIT (Slice 02)
- [ ] Implementer returns `unable_to_fix` for review findings -> HARD EXIT (Slice 03)
- [ ] Empty git diff -> code-reviewer returns REJECTED with "No changes found in git diff" (Slice 01)
- [ ] App fails to start (Health-Check Timeout) -> `smoke_mode = "health_only"`, `dom_snapshot = null` (Slice 04)
- [ ] Screenshot fails -> Warning, `screenshot_path = ""` (Slice 04)

### State Transitions

- [ ] `code_written` -> `review_in_progress` (trigger: Implementer Commit) (Slice 03)
- [ ] `review_in_progress` -> `review_passed` (trigger: APPROVED/CONDITIONAL) (Slice 01, 03)
- [ ] `review_in_progress` -> `review_failed` (trigger: REJECTED with CRITICAL) (Slice 01, 03)
- [ ] `review_failed` -> `review_in_progress` (trigger: Implementer Fix + Re-Review, max 3) (Slice 03)
- [ ] `review_passed` -> `lint_passed` or `lint_failed` (trigger: Deterministic Gate) (Slice 02)
- [ ] `lint_failed` -> `lint_passed` or `lint_failed` (trigger: Auto-Fix + Re-Check, max 3) (Slice 02)
- [ ] `lint_passed` -> Test-Validator States (trigger: Start Test-Pipeline) (Slice 03)
- [ ] Smoke + MCP available -> `smoke_functional` (Slice 04)
- [ ] Smoke + MCP not available -> `smoke_health_only` (Slice 04)

### Boundary Conditions

- [ ] Console.error in browser = Warning, NOT Failure -- pipeline continues (Slice 04)
- [ ] DOM Snapshot missing_elements = Warning, NOT Failure -- pipeline continues (Slice 04)
- [ ] DOM Snapshot element_count == 0 = Warning (empty page) (Slice 04)
- [ ] DOM Snapshot truncated to max 10,000 characters (Slice 04)
- [ ] Console errors max 20 entries, max 500 chars per entry (Slice 04)
- [ ] Lint/TypeCheck error output truncated to max 2,000 characters each (Slice 02)
- [ ] Git diff truncated to max 50,000 characters (Slice 01)
- [ ] Go stack has no lint auto-fix command (empty string, skipped) (Slice 02)
- [ ] Unknown stack -> detected_stack.stack_name = "unknown", Deterministic Gate skipped (Slice 02)

---

## Cross-Slice Integration Points

| # | Integration Point | Slices | How to Verify |
|---|-------------------|--------|---------------|
| 1 | code-reviewer.md agent definition consumed by coordinator | Slice 01 -> Slice 03 | Verify Task(code-reviewer) in Phase 2b references the agent correctly |
| 2 | JSON Output Contract consistency | Slice 01 -> Slice 03 | Verify Phase 2b parses `{verdict, findings[], summary}` matching Slice 01 Output Contract |
| 3 | Verdict logic applied correctly | Slice 01 -> Slice 03 | APPROVED = continue, CONDITIONAL = warnings + continue, REJECTED = fix-loop |
| 4 | Bash tool in coordinator Frontmatter | Slice 02 -> Slice 03 | Verify Frontmatter has Bash before Phase 2c can execute lint commands |
| 5 | detected_stack available for Phase 2b and Phase 2c | Slice 02 -> Slice 03 | Phase 1a runs before Phase 2b, detected_stack.stack_name in code-reviewer prompt |
| 6 | detected_stack available for test-validator | Slice 02 -> Slice 04 | test-validator Task()-Prompt contains `## Stack Info` with health_endpoint |
| 7 | Phase 4 as extension point for smoke | Slice 03 -> Slice 04 | test-validator.md Stage 4 can be extended without breaking pipeline |
| 8 | Smoke JSON output flows into coordinator evidence | Slice 04 -> Slice 03 | Evidence JSON contains smoke.smoke_mode, smoke.dom_snapshot, smoke.console_errors |
| 9 | Both Slice 02 and 03 modify slice-impl-coordinator.md | Slice 02 + 03 | Different sections modified, no overlapping content, sequential implementation order |

---

## Sign-Off

| Tester | Date | Result |
|--------|------|--------|
| (pending implementation) | -- | -- |

**Notes:**
- All deliverables are .md agent definitions -- no automated test suites, validation is manual
- Slice 02 and Slice 03 both modify `slice-impl-coordinator.md` but target different sections
- Implementation order MUST be: Slice 01 + Slice 02 (parallel) -> Slice 03 -> Slice 04
