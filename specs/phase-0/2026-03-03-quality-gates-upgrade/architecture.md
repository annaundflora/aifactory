# Feature: Quality Gates Upgrade -- Visual Verification + Self-Review

**Epic:** --
**Status:** Draft
**Discovery:** `discovery.md` (same folder)
**Derived from:** Discovery constraints, NFRs, and risks

---

## Problem & Solution

**Problem:**
- Smoke Test prüft nur Health-Endpoint (HTTP 200) -- keine funktionale Verifikation der generierten App
- Kein Code-Review vor PR/Merge -- Agent-generierter Code wird nur durch Tests validiert, nicht inhaltlich geprüft
- Deterministische Checks (Lint, TypeCheck) laufen erst in `final_validation`, nicht pro Slice

**Solution:**
- Chrome DevTools MCP als erweiterten Smoke Test: DOM-Snapshots, Console-Logs, Screenshots, Performance-Traces
- Code Reviewer Sub-Agent: Separater Context prüft Code vor Test-Execution
- ESLint/TypeCheck Gate als deterministische Baseline pro Slice (nicht nur final)

**Business Value:**
- Bugs früher finden (vor Test-Execution statt erst durch fehlschlagende Tests)
- Visuelle/funktionale Korrektheit automatisch prüfbar (nicht nur "App startet")
- Rubber-Stamping-Risiko reduziert (separater Review-Context + deterministische Checks)

---

## Scope & Boundaries

| In Scope |
|----------|
| Chrome DevTools MCP Integration in test-validator Smoke-Test-Stage |
| Neuer `code-reviewer.md` Sub-Agent mit strukturiertem Review-Prompt |
| ESLint/TypeCheck als Pre-Test-Gate in slice_validation Mode (nicht nur final_validation) |
| Stack-agnostische Erkennung (wie bestehende test-validator Stack-Detection) |
| Integration in slice-impl-coordinator Pipeline |

| Out of Scope |
|--------------|
| Externe SaaS-Tools (CodeRabbit, Greptile, Percy) |
| Screenshot + Vision-Model-Analyse (Claude Vision) |
| Playwright MCP (Alternative zu Chrome DevTools MCP) |
| CI/CD Pipeline Integration (GitHub Actions) |
| Visual Regression Testing mit Baseline-Vergleich |

---

## API Design

> N/A -- Dieses Feature modifiziert Agent-Definitionen (.md Dateien) und deren Contracts. Keine HTTP APIs.

---

## Database Schema

> N/A -- Keine Datenbank betroffen. Daten fließen als JSON-Contracts zwischen Sub-Agents.

---

## Server Logic

### Services & Processing

> "Services" = Sub-Agents in der Pipeline. Jeder Agent ist ein autonomer Prozess mit eigenem Context.

| Agent (Service) | Responsibility | Input | Output | Side Effects |
|-----------------|----------------|-------|--------|--------------|
| `code-reviewer` (NEU) | Code-Review von `git diff` gegen Slice-Spec | git diff, Slice-Spec Pfad, Architecture Pfad | JSON: verdict + findings[] | Keine (read-only) |
| `test-validator` (ERWEITERT) | Deterministic Gate + erweiterter Smoke | Slice-ID, Test-Paths, Mode, Working-Dir | JSON: stages + overall_status | Lint Auto-Fix (nur bei deterministic gate) |
| `slice-impl-coordinator` (ERWEITERT) | Pipeline-Koordination mit 2 neuen Steps | spec_path, slice_id, slice_file | JSON: status + evidence | Evidence-Datei auf Disk |

### Business Logic Flow

```
stack-detection → slice-implementer → code-reviewer → [fix loop max 3] → deterministic-gate → [fix loop max 3] → test-writer → test-validator → [debug loop max 9]
```

Detailliert:

```
Phase 1a: Stack Detection (NEU)
  └── Glob Indicator-Files im working_dir
  └── Ergebnis: detected_stack mit lint/typecheck/test/start Commands
  └── Falls kein Stack erkannt: Warning, Lint/TypeCheck Gate überspringen

Phase 2: Implementation (unverändert)
  └── Task(slice-implementer) → Code + Commit

Phase 2b: Code Review (NEU)
  └── Task(code-reviewer) → JSON {verdict, findings[]}
  └── IF verdict == "REJECTED":
       └── Task(slice-implementer) mit findings → Re-Commit
       └── Task(code-reviewer) → Re-Review
       └── Max 3 Iterationen, dann HARD EXIT

Phase 2c: Deterministic Gate (NEU)
  └── Bash: {detected_stack.lint_autofix_cmd} → {detected_stack.lint_check_cmd} → {detected_stack.typecheck_cmd}
  └── IF failure:
       └── Task(slice-implementer) mit lint/type errors → Fix
       └── Re-Check
       └── Max 3 Iterationen, dann HARD EXIT
  └── IF kein Stack erkannt: Skip mit Warning

Phase 3: Test-Erstellung (unverändert)
  └── Task(test-writer) → Tests + Commit

Phase 4: Validation + Debug Loop (Smoke ERWEITERT)
  └── Task(test-validator) mit erweitertem Smoke + detected_stack Info
  └── IF failure: Task(debugger) → Fix → Re-Validate
  └── Max 9 Retries (unverändert)
```

### Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `review_verdict` | Must be APPROVED or CONDITIONAL to proceed | "code-review: unresolved CRITICAL issues after {n} retries" |
| `lint_exit_code` | Must be 0 after auto-fix | "lint: persistent failures after {n} retries" |
| `typecheck_exit_code` | Must be 0 | "typecheck: persistent failures after {n} retries" |
| `review_iterations` | Max 3 | HARD EXIT at 3 |
| `lint_iterations` | Max 3 | HARD EXIT at 3 |

---

## Security

### Authentication & Authorization

> N/A -- Agent-Pipeline, keine User-Auth.

### Data Protection

| Data Type | Protection | Notes |
|-----------|------------|-------|
| Code Diffs | In-memory only | Nicht persistiert, lebt nur im Agent-Context |
| Review Findings | Evidence JSON | Gespeichert in `.claude/evidence/` |
| Console Logs | Evidence JSON | Können sensible Daten enthalten -- nur bei Smoke-Failure loggen |

### Input Validation & Sanitization

| Input | Validation | Sanitization |
|-------|------------|--------------|
| git diff Output | Prüfe ob nicht leer | Truncate auf max 50.000 Zeichen (Context-Limit) |
| Lint/TypeCheck Output | Parse Exit-Code | Truncate error_output auf max 2000 Zeichen (wie bestehend) |
| DOM Snapshot | JSON-Validierung | Truncate auf max 10.000 Zeichen |
| Console Errors | String Array | Filter: Ignoriere bekannte Library-Warnings |

### Rate Limiting & Abuse Prevention

> N/A -- Interne Pipeline, keine externen Requests.

---

## Architecture Layers

### Layer Responsibilities

> Angepasst für Agent-Pipeline-Architektur (keine klassischen Web-Layer).

| Layer | Responsibility | Pattern |
|-------|----------------|---------|
| `/build` Command (Ebene 0) | Wave-Koordination, Crash-Recovery | Orchestrator Pattern |
| `slice-impl-coordinator` (Ebene 1) | Slice-Pipeline-Koordination, Retry-Management | Coordinator Pattern |
| Sub-Agents (Ebene 2) | Einzelne Aufgaben autonom ausführen | Worker Pattern (Fresh Context) |
| Evidence Files | Persistenz, Audit-Trail | Write-once Append Pattern |

### Data Flow

```
/build Command
  └── Task(slice-impl-coordinator)
        ├── Task(slice-implementer) → git diff
        │
        ├── Task(code-reviewer)     ← git diff, slice-spec   [NEU]
        │   └── Returns: {verdict, findings[]}
        │   └── IF REJECTED → Task(slice-implementer) + findings → loop (max 3)
        │
        ├── Bash(lint + typecheck)                            [NEU]
        │   └── Returns: {lint_exit_code, typecheck_exit_code}
        │   └── IF failure → Task(slice-implementer) + errors → loop (max 3)
        │
        ├── Task(test-writer) → test files
        │
        └── Task(test-validator)                              [ERWEITERT]
            ├── Unit → Integration → Acceptance
            ├── Smoke: Health + DevTools DOM/Console           [ERWEITERT]
            └── Regression
```

### Error Handling Strategy

| Error Type | Handling | Response | Logging |
|------------|----------|----------|---------|
| Code Review CRITICAL (≤3 retries) | Retry: Implementer fix + re-review | Continue pipeline | Log findings in evidence |
| Code Review CRITICAL (>3 retries) | HARD EXIT | `status: "failed", error: "code-review: ..."` | Full findings in evidence |
| Lint/TypeCheck Failure (≤3 retries) | Retry: Auto-fix + re-check, then Implementer | Continue pipeline | Log errors |
| Lint/TypeCheck Failure (>3 retries) | HARD EXIT | `status: "failed", error: "lint/typecheck: ..."` | Full errors in evidence |
| Chrome DevTools MCP nicht verfügbar | Graceful Fallback | Smoke = Health-Check only (`smoke_health_only`) | Warning in evidence |
| Console.error im Browser | Warning, kein Failure | Pipeline läuft weiter | Log in evidence `console_warnings` |
| DOM-Snapshot leer/fehlerhaft | Warning, kein Failure | Smoke = Health-Check only | Warning in evidence |

---

## Migration Map

> Dieses Feature modifiziert bestehende Agent-Definitionen.

| Existing File | Current Pattern | Target Pattern | Specific Changes |
|---|---|---|---|
| `.claude/agents/slice-impl-coordinator.md` | 4-Step Pipeline: Implementer → Test-Writer → Validator → Debugger | 6-Step Pipeline: Implementer → **Code-Reviewer** → **Deterministic-Gate** → Test-Writer → Validator → Debugger | Phase 2b (Code Review Loop, max 3) und Phase 2c (Lint/TypeCheck Loop, max 3) einfügen zwischen Phase 2 und Phase 3 |
| `.claude/agents/test-validator.md` | Smoke: App starten → Health-Poll → App stoppen | Smoke: App starten → Health-Poll → **DevTools DOM-Snapshot** → **Console-Check** → **Optional Screenshot** → App stoppen | Stage 4 (Smoke) erweitern um DevTools-Schritte nach Health-Check. Fallback wenn MCP nicht verfügbar. JSON Output Contract erweitern um `smoke_dom_snapshot`, `smoke_console_errors`, `smoke_mode` |
| `.claude/agents/test-validator.md` | `slice_validation` Mode: Keine Lint/TypeCheck | `slice_validation` Mode bleibt unverändert (Lint/TypeCheck läuft im Coordinator, nicht im Validator) | KEINE Änderung an test-validator für Lint/TypeCheck -- das läuft direkt im slice-impl-coordinator via Bash |

---

## Agent Contracts (NEU -- ersetzt API Design für Agent-Pipeline)

### Code Reviewer Agent (`code-reviewer.md`)

**Aufruf-Pattern:**

```
Task(
  subagent_type: "code-reviewer",
  prompt: "Review Code für Slice: {slice_id}
    - Slice-Spec: {slice_file_path}
    - Architecture: {architecture_path}
    - Working-Dir: {working_dir}
    ..."
)
```

**Input:**
| Parameter | Quelle | Pflicht |
|-----------|--------|---------|
| `slice_id` | Coordinator | Ja |
| `slice_file_path` | Coordinator | Ja |
| `architecture_path` | Coordinator | Ja |
| `working_dir` | Coordinator | Ja |

**Workflow:**
1. Lies Slice-Spec (Deliverables, ACs)
2. Lies Architecture (Patterns, Conventions)
3. Führe `git diff HEAD~1` aus im working_dir → Erhalte Diff
4. Analysiere Diff gegen:
   - Spec-Compliance: Implementiert der Code die ACs?
   - Architecture-Compliance: Folgt der Code den definierten Patterns?
   - Code-Quality: Offensichtliche Bugs, fehlende Error-Handling, Security-Issues
   - Anti-Patterns: Hardcoded Values, fehlende Validierung, Race Conditions
5. Kategorisiere Findings nach Severity
6. Gib JSON zurück

**Adversarial Review Prompt (Kern-Prinzip):**
- "Finde mindestens 3 Issues oder begründe EXPLIZIT warum keine existieren"
- Separater Context verhindert Rubber-Stamping (Implementer-Context nicht sichtbar)
- Severity-Levels: CRITICAL (blockiert), HIGH (Warning, empfohlen zu fixen), MEDIUM (Hinweis), LOW (Nit)

**Output Contract:**

```json
{
  "verdict": "APPROVED | CONDITIONAL | REJECTED",
  "findings": [
    {
      "severity": "CRITICAL | HIGH | MEDIUM | LOW",
      "file": "path/to/file.ts",
      "line": 42,
      "message": "Missing input validation for user-supplied parameter",
      "fix_suggestion": "Add zod schema validation before processing"
    }
  ],
  "summary": "2 CRITICAL, 1 HIGH, 3 MEDIUM issues found"
}
```

**Verdict-Logik:**
| Condition | Verdict |
|-----------|---------|
| 0 CRITICAL + 0 HIGH | APPROVED |
| 0 CRITICAL + ≥1 HIGH | CONDITIONAL (Warnings geloggt, Pipeline läuft weiter) |
| ≥1 CRITICAL | REJECTED (Pipeline blockt, Implementer muss fixen) |

**Agent-Definition Frontmatter:**

```yaml
---
name: code-reviewer
description: Code-Review Sub-Agent. Reviewt git diff gegen Slice-Spec und Architecture. Adversarial Prompt. Returns structured JSON.
tools: Read, Grep, Glob, Bash(git diff:git log:git show)
---
```

### Stack Detection (Zentral -- wiederverwendbar für alle Pipeline-Steps)

**Problem:** Stack-Detection-Logik existiert aktuell nur in `test-validator.md`. Sowohl der Deterministic Gate (Coordinator) als auch der erweiterte Smoke Test brauchen sie.

**Lösung:** Stack-Detection-Tabelle als **zentrale Referenz** in `test-validator.md` belassen (Single Source of Truth). Der Coordinator liest die Indicator-Files im `working_dir` selbst und leitet daraus die Commands ab -- die gleiche Logik, die test-validator bereits nutzt. Keine Abstraktion nötig, da die Logik trivial ist (Datei-Existenz prüfen).

**Stack-Detection-Tabelle (vollständig, für ALLE Pipeline-Steps):**

| Indicator File(s) | Stack | Lint Auto-Fix | Lint Check | Type Check | Test Command | Start Command | Health Endpoint |
|---|---|---|---|---|---|---|---|
| `pyproject.toml` + fastapi | Python/FastAPI | `ruff check --fix .` | `ruff check .` | `mypy .` | `python -m pytest {path} -v` | `uvicorn app.main:app --host 0.0.0.0 --port 8000` | `http://localhost:8000/health` |
| `requirements.txt` + fastapi | Python/FastAPI | `ruff check --fix .` | `ruff check .` | `mypy .` | `python -m pytest {path} -v` | `uvicorn app.main:app --host 0.0.0.0 --port 8000` | `http://localhost:8000/health` |
| `pyproject.toml` + django | Python/Django | `ruff check --fix .` | `ruff check .` | `mypy .` | `python -m pytest {path} -v` | `python manage.py runserver` | `http://localhost:8000/health` |
| `package.json` + next | TypeScript/Next.js | `pnpm eslint --fix .` | `pnpm lint` | `pnpm tsc --noEmit` | `pnpm test {path}` | `pnpm dev` | `http://localhost:3000/api/health` |
| `package.json` + nuxt | TypeScript/Nuxt | `pnpm eslint --fix .` | `pnpm lint` | `pnpm tsc --noEmit` | `pnpm test {path}` | `pnpm dev` | `http://localhost:3000/api/health` |
| `package.json` + vue ^3 (ohne nuxt) | TypeScript/Vue 3 | `pnpm eslint --fix .` | `pnpm lint` | `pnpm tsc --noEmit` | `pnpm test {path}` | `pnpm dev` | `http://localhost:5173` |
| `package.json` + vue ^2 | JavaScript/Vue 2 | `pnpm eslint --fix .` | `pnpm lint` | `pnpm tsc --noEmit` | `pnpm test {path}` | `pnpm serve` | `http://localhost:8080` |
| `package.json` + express | TypeScript/Express | `pnpm eslint --fix .` | `pnpm lint` | `pnpm tsc --noEmit` | `pnpm test {path}` | `node server.js` | `http://localhost:3000/health` |
| `composer.json` + laravel | PHP/Laravel | `./vendor/bin/pint` | `./vendor/bin/pint --test` | `phpstan analyse` (falls konfiguriert) | `php artisan test {path}` | `php artisan serve` | `http://localhost:8000/health` |
| `go.mod` | Go | -- | `golangci-lint run` | `go vet ./...` | `go test {path}` | `go run .` | `http://localhost:8080/health` |

**Coordinator Stack-Detection Algorithmus:**

```
Phase 1a: Stack Detection (NEU -- zu Beginn der Pipeline)
  1. Glob("{working_dir}/pyproject.toml")  → prüfe ob "fastapi" oder "django" enthalten
  2. Glob("{working_dir}/requirements.txt") → prüfe ob "fastapi" enthalten
  3. Glob("{working_dir}/package.json")    → prüfe dependencies: next, nuxt, vue, express
  4. Glob("{working_dir}/composer.json")   → prüfe "laravel/framework"
  5. Glob("{working_dir}/go.mod")          → Go Stack

  Ergebnis: detected_stack = {
    stack_name: "Python/FastAPI | TypeScript/Next.js | PHP/Laravel | ...",
    lint_autofix_cmd: "ruff check --fix .",
    lint_check_cmd: "ruff check .",
    typecheck_cmd: "mypy .",
    test_cmd: "python -m pytest {path} -v",
    start_cmd: "uvicorn app.main:app ...",
    health_endpoint: "http://localhost:8000/health"
  }

  Falls kein Stack erkannt: Warning, Lint/TypeCheck Gate überspringen.
```

**Weitergabe an Sub-Agents:**
- `detected_stack` wird vom Coordinator an test-validator und code-reviewer im Prompt mitgegeben
- test-validator nutzt es für Smoke Test Commands
- Coordinator nutzt es direkt für Deterministic Gate Commands

### Deterministic Gate (kein eigener Agent -- direkt im Coordinator)

**Warum kein eigener Agent:**
- Lint/TypeCheck sind deterministische Bash-Commands, kein LLM nötig
- Coordinator bekommt `Bash` Tool-Zugriff (muss ergänzt werden)
- Overhead eines Sub-Agent-Calls (Fresh Context, Prompt-Parsing) nicht gerechtfertigt für `ruff check .`

**Coordinator-Erweiterung (Pseudocode):**

```
Phase 2c: Deterministic Gate
  lint_retries = 0
  MAX_LINT_RETRIES = 3

  WHILE lint_retries < MAX_LINT_RETRIES:
    # Stack-Commands aus Phase 1a (detected_stack)
    Bash("cd {working_dir} && {detected_stack.lint_autofix_cmd}")
    lint_result = Bash("cd {working_dir} && {detected_stack.lint_check_cmd}")
    type_result = Bash("cd {working_dir} && {detected_stack.typecheck_cmd}")

    IF lint_result.exit_code == 0 AND type_result.exit_code == 0:
      BREAK  # Gate bestanden

    # Fix-Versuch via Implementer
    lint_retries++
    IF lint_retries < MAX_LINT_RETRIES:
      Task(slice-implementer, prompt: "Fix lint/type errors: {errors}")

  IF lint_retries >= MAX_LINT_RETRIES:
    RETURN {status: "failed", error: "lint/typecheck: persistent failures"}
```

**Coordinator Tool-Erweiterung:**

```yaml
---
tools: Read, Write, Glob, Grep, Task, Bash
---
```

> Aktuell hat slice-impl-coordinator KEIN Bash-Tool. Muss ergänzt werden für Stack-Detection (Glob Indicator-Files lesen) + Lint/TypeCheck-Commands.

### Test-Validator Smoke Test Erweiterung

**Erweiterter Smoke-Flow:**

```
Stage 4: Smoke Test (erweitert)
  1. App starten im Hintergrund (unverändert)
  2. PID merken (unverändert)
  3. Health-Endpoint pollen → HTTP 200 (unverändert)
  4. [NEU] Chrome DevTools MCP Check:
     a. Prüfe ob MCP-Tool verfügbar (try: mcp__chrome-devtools__*)
     b. IF verfügbar:
        - Navigate zu App-URL
        - DOM Snapshot: Accessibility-Tree abrufen
        - Console Logs: Alle console.error Einträge sammeln
        - Optional: Screenshot als Evidence
        - smoke_mode = "functional"
     c. IF nicht verfügbar:
        - smoke_mode = "health_only"
        - Warning loggen
  5. App stoppen (unverändert)
```

**Erweiterter JSON Output Contract (Smoke-Stage):**

```json
{
  "smoke": {
    "app_started": true,
    "health_status": 200,
    "startup_duration_ms": 4500,
    "smoke_mode": "functional | health_only",
    "dom_snapshot": {
      "element_count": 42,
      "expected_elements_found": ["header", "nav", "main"],
      "missing_elements": []
    },
    "console_errors": ["Warning: Each child in a list should have a unique key prop"],
    "screenshot_path": ".claude/evidence/feature/slice-01-smoke.png"
  }
}
```

**MCP-Tool Verfügbarkeit:**

Die Chrome DevTools MCP Tools werden als `mcp__chrome-devtools__*` erwartet. Test-Validator prüft Verfügbarkeit durch Versuch eines Tool-Calls. Bei Fehler: Fallback zu `health_only`.

**DOM-Snapshot Validierung:**

| Check | Quelle | Prüfung | Ergebnis |
|-------|--------|---------|----------|
| Erwartete Elemente | Slice-Spec (Deliverables) | Accessibility-Tree enthält Elemente | Pass/Fail (Warning only) |
| Console Errors | Browser Console | `console.error` Einträge | Warning (kein Failure) |
| Element Count | DOM | > 0 Elemente gerendert | Pass/Fail (Warning only) |

---

## Constraints & Integrations

### Constraints

| Constraint | Technical Implication | Solution |
|------------|----------------------|----------|
| Separater Context für Review (Anti-Rubber-Stamping) | Code-Reviewer darf keinen Implementer-Context sehen | Task() mit eigenem Fresh Context (Anthropic Pattern) |
| Chrome DevTools MCP ist optional | Smoke Test muss ohne funktionieren | Graceful Fallback zu `smoke_health_only` |
| Stack-agnostisch | Lint/TypeCheck Commands variieren pro Stack | Bestehende Indicator-File-Detection aus test-validator wiederverwenden |
| Max Pipeline-Overhead | Neue Steps dürfen Pipeline nicht unverhältnismäßig verlängern | Review max 3 Retries, Lint max 3 Retries (kurze Loops) |
| Console.error ≠ Failure | Viele Libraries loggen Warnings als console.error | Console Errors = Warning, nicht Pipeline-Blocker |
| Backward Compatibility | Bestehende Pipelines ohne neue Tools müssen weiter funktionieren | Alle neuen Features sind additiv mit Fallbacks |

### Integrations

| Area | System / Capability | Interface | Version | Notes |
|------|----------------------|-----------|---------|-------|
| Code Review | Claude Sub-Agent | Task() API (Claude Code internal) | Claude Code CLI (current) | Frischer Context pro Aufruf |
| Lint (Python) | ruff | CLI (`ruff check`) | 0.14.x+ (recherchiert via PyPI/Repology März 2026, 0.14.9-0.15.2 aktuell) | Bereits in test-validator final_validation genutzt |
| Type Check (Python) | mypy | CLI (`mypy .`) | 1.19.x (recherchiert via PyPI März 2026, 1.19.1 = latest Dec 2025) | Bereits in test-validator final_validation genutzt |
| Lint (TypeScript) | ESLint | CLI (`pnpm lint`) | 10.x (recherchiert via npm März 2026, 10.0.2 = latest, 9.x = Maintenance) | Bereits in test-validator final_validation genutzt |
| Type Check (TypeScript) | TypeScript Compiler | CLI (`pnpm tsc --noEmit`) | 5.9.x (recherchiert via devblogs.microsoft.com März 2026, 5.9 = latest stable, 6.0 Beta seit Feb 2026) | Bereits in test-validator final_validation genutzt |
| Lint (PHP) | Laravel Pint | CLI (`./vendor/bin/pint`) | 1.x (recherchiert via Packagist März 2026) | Bereits in test-validator final_validation genutzt |
| Type Check (PHP) | PHPStan | CLI (`phpstan analyse`) | 2.x (recherchiert via Packagist März 2026) | Optional, nur wenn konfiguriert |
| Lint (Go) | golangci-lint | CLI (`golangci-lint run`) | 2.x (recherchiert via GitHub Releases März 2026) | Neu für Go-Stack |
| Type Check (Go) | go vet | CLI (`go vet ./...`) | Go toolchain | Built-in Go Tool |
| Visual Verification | Chrome DevTools MCP | MCP Protocol (`mcp__chrome-devtools__*`) | npx chrome-devtools-mcp@latest | Optional, Fallback wenn nicht installiert |

---

## Quality Attributes (NFRs)

### From Discovery → Technical Solution

| Attribute | Target | Technical Approach | Measure / Verify |
|-----------|--------|--------------------|------------------|
| Backward Compatibility | Bestehende Pipelines ohne Chrome DevTools MCP laufen weiter | Alle neuen Features optional mit Fallback | Test: Pipeline ohne DevTools MCP → `smoke_health_only` |
| Pipeline-Overhead | Neue Gates ≤ 30s zusätzlich pro Slice (Review + Lint) | Review = 1 LLM-Call, Lint/TypeCheck = deterministische Commands | Messen: Review-Duration + Lint-Duration in Evidence |
| Rubber-Stamping Prevention | Code-Reviewer findet echte Issues, nicht nur "LGTM" | Adversarial Prompt + separater Context + Severity-Pflicht | Stichproben: Review-Findings manuell prüfen |
| Graceful Degradation | Kein neues Feature darf bestehende Pipeline breaken | Try/Catch um alle neuen Steps, Fallback-Pfade | Test: Entferne Chrome DevTools MCP → Pipeline läuft |
| Determinism | Lint/TypeCheck liefert reproduzierbare Ergebnisse | Keine LLM-Interpretation, nur Exit-Code-basiert | Exit-Code 0/1 = binary, kein Interpretationsspielraum |

### Monitoring & Observability

| Metric | Type | Target | Alert |
|--------|------|--------|-------|
| `review_duration_ms` | Timer | < 15s | > 30s = Warning in Evidence |
| `review_iterations` | Counter | 0-1 (selten 2-3) | 3 = HARD EXIT, logged |
| `lint_duration_ms` | Timer | < 10s | > 20s = Warning in Evidence |
| `lint_iterations` | Counter | 0-1 | 3 = HARD EXIT, logged |
| `smoke_mode` | Enum | "functional" | "health_only" = Warning (DevTools nicht verfügbar) |
| `console_error_count` | Counter | 0 | > 0 = Warning in Evidence |

---

## Risks & Assumptions

### Assumptions

| Assumption | Technical Validation | Impact if Wrong |
|------------|---------------------|-----------------|
| Chrome DevTools MCP ist als MCP-Tool registrierbar | Prüfe MCP-Tool-Verfügbarkeit zur Runtime | Fallback zu health_only Smoke (kein Breaking Change) |
| `git diff HEAD~1` liefert den Slice-Diff | Implementer committed alle Änderungen in einem Commit | Bei multi-commit: `git diff {commit_hash}~1 {commit_hash}` nutzen |
| Adversarial Prompt reduziert Rubber-Stamping | LLM-Forschung bestätigt (separater Context + adversarial = effektivste Strategie) | Fallback: Deterministic Gate fängt objektive Issues |
| Lint/TypeCheck-Tools sind im Target-Projekt installiert | Stack-Detection prüft Indicator-Files | Skip mit Warning wenn Tool nicht installiert |
| ruff/eslint/pint --fix ist sicher (keine Breaking Changes) | Bestehende Nutzung in final_validation bestätigt | Auto-Fix-Step überspringen, nur Check |

### Risks & Mitigation

| Risk | Likelihood | Impact | Technical Mitigation | Fallback |
|------|------------|--------|---------------------|----------|
| Code-Reviewer halluziniert Issues (False Positives) | Medium | Low (nur CRITICAL blockt) | Adversarial Prompt fordert Begründung pro Finding | HIGH/MEDIUM/LOW = Warning only, nicht blockierend |
| Chrome DevTools MCP nicht verfügbar / nicht installiert | Medium | Low | Runtime-Check, graceful Fallback | `smoke_health_only` Mode |
| Lint/TypeCheck false positives in generierten Projects | Low | Medium | Auto-Fix vor Check, nur verbleibende Errors blockieren | Max 3 Retries, dann HARD EXIT mit Error-Log |
| Pipeline-Overhead durch zusätzliche Steps | Low | Low | Review = 1 LLM-Call (~10s), Lint = deterministic (~5s) | Bei Timeout: Steps überspringen mit Warning |
| Coordinator Tool-Erweiterung (Bash) ändert Sicherheitsmodell | Low | Medium | Bash nur für Lint/TypeCheck Commands, nicht für beliebige Execution | Alternativ: Deterministic Gate als eigener Sub-Agent |

---

## Technology Decisions

### Stack Choices

| Area | Technology | Rationale |
|------|------------|-----------|
| Code Review | Claude Sub-Agent (Task()) | Nativ im System, $0 Setup, separater Context by Design |
| Visual Verification | Chrome DevTools MCP | FREE, von Codex/OpenAI validiert, DOM + Console + Screenshots |
| Deterministic Checks | Bestehende Lint/TypeCheck Tools (ruff, eslint, mypy, tsc) | Bereits in final_validation integriert, bewährt |

### Trade-offs

| Decision | Pro | Con | Mitigation |
|----------|-----|-----|------------|
| Deterministic Gate im Coordinator statt eigenem Agent | Kein Agent-Overhead, schneller | Coordinator braucht Bash-Tool (Sicherheitsänderung) | Bash nur für spezifische Lint/TypeCheck Commands |
| Console.error = Warning statt Failure | Weniger False Positives (Libraries loggen Warnings als Errors) | Echte Errors könnten übersehen werden | Evidence-Log für manuelle Inspektion |
| Review max 3 Retries (nicht 9 wie Debug) | Schnellerer Pipeline-Abort bei fundamentalen Code-Problemen | Weniger Chancen für Auto-Fix | 3 Retries reichen: Review-Issues sind meist klar formuliert |
| Chrome DevTools MCP statt Playwright MCP | Performance-Traces + Console-Logs nativ | Weniger Browser-Automation-Features | Playwright kann später als Alternative ergänzt werden |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| 1 | Soll Code-Reviewer mit gleichem oder anderem Model-Tier reviewen? | A) Gleicher Tier B) Höherer Tier C) Konfigurierbar | C) Konfigurierbar, Default: gleicher Tier | Konfigurierbar via `model` Parameter im Task()-Call |
| 2 | Wie viele Review-Retries vor Pipeline-Abort? | A) 1 B) 3 C) Konfigurierbar | B) 3 | 3 (analog Lint-Retries) |
| 3 | Console.error im Smoke = Failure oder Warning? | A) Failure B) Warning C) Konfigurierbar | B) Warning | Warning (viele Libraries loggen Warnings als console.error) |
| 4 | Soll der Coordinator Bash-Tool bekommen oder Lint als eigener Sub-Agent? | A) Bash im Coordinator B) Eigener Lint-Agent | A) Bash im Coordinator | Bash im Coordinator (kein Agent-Overhead für deterministische Commands) |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-03 | Web | Chrome DevTools MCP: FREE, 25+ Tools, von Codex/Harness validiert. Setup: `npx chrome-devtools-mcp@latest` |
| 2026-03-03 | Web | LLM Self-Review: Separater Context + adversarialer Prompt = effektivste Anti-Rubber-Stamping-Strategie |
| 2026-03-04 | Codebase | test-validator.md: Smoke-Stage hat Health-Poll-Logik, erweiterbar um DevTools-Steps nach Zeile 86 |
| 2026-03-04 | Codebase | test-validator.md: Final Validation hat bereits Lint/TypeCheck Commands für Python/TS/PHP (Zeile 97-100) |
| 2026-03-04 | Codebase | slice-impl-coordinator.md: 4-Phasen-Pipeline, Phase 2→3 ist der Einfügepunkt für Review + Lint |
| 2026-03-04 | Codebase | slice-impl-coordinator.md Tools: `Read, Write, Glob, Grep, Task` -- KEIN Bash. Muss ergänzt werden für Lint |
| 2026-03-04 | Codebase | Stack-Detection Table in test-validator.md deckt 10 Stacks ab -- wiederverwendbar für Lint-Commands |
| 2026-03-04 | Codebase | deprecated_coding-standards-guardian.md: War dedizierter Review-Agent (SOLID, Clean Code). Deprecated. Neuer code-reviewer ist schlanker und fokussierter. |
| 2026-03-04 | Web | Versionen verifiziert: ruff 0.14.9-0.15.2 (Repology), mypy 1.19.1 (PyPI Dec 2025), ESLint 10.0.2 (npm, released 4. März 2026), TypeScript 5.9 stable / 6.0 Beta Feb 2026 (devblogs.microsoft.com) |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| 1 | Wireframes nötig? | Nein -- Discovery sagt "Agent/Pipeline Feature, kein UI". Keine Wireframes anwendbar. |
| 2 | Lint/TypeCheck: Im Coordinator oder als eigener Agent? | Im Coordinator direkt via Bash. Deterministische Commands brauchen kein LLM. Coordinator bekommt Bash-Tool. |
| 3 | Welche Agent-Dateien werden modifiziert? | 2 existierende: slice-impl-coordinator.md, test-validator.md. 1 neue: code-reviewer.md |
| 4 | Git Diff für Review: HEAD~1 oder commit_hash? | HEAD~1 als Default, da slice-implementer alle Änderungen in einem Commit committed. |
| 5 | Stack-Detection: Wo und wann? | Zu Beginn der Pipeline (Phase 1a) im Coordinator. Gleiche Indicator-File-Logik wie test-validator. detected_stack wird an alle Sub-Agents weitergegeben. Kein Stack erkannt = Warning, Lint Gate skip. |
| 6 | Repo-unabhängig einsetzbar? | Ja -- Stack-Detection deckt Python/FastAPI/Django, TypeScript/Next.js/Nuxt/Vue2/Vue3/Express, PHP/Laravel, Go ab. Gleiche Tabelle wie test-validator. |
