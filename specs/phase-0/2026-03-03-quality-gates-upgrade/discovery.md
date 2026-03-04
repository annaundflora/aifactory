# Feature: Quality Gates Upgrade -- Visual Verification + Self-Review

**Epic:** --
**Status:** Draft
**Wireframes:** -- (Agent/Pipeline Feature, kein UI)

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
| Externe SaaS-Tools (CodeRabbit, Greptile, Percy) -- können später ergänzt werden |
| Screenshot + Vision-Model-Analyse (Claude Vision) -- Optional, Phase 2 |
| Playwright MCP (Alternative zu Chrome DevTools MCP -- kann bei Bedarf ergänzt werden) |
| CI/CD Pipeline Integration (GitHub Actions) -- separates Feature |
| Visual Regression Testing mit Baseline-Vergleich (Percy/Applitools-Ansatz) |

---

## Current State Reference

- `test-validator.md`: Stack-agnostische Test-Pipeline (Unit → Integration → Acceptance → Smoke → Regression)
- `test-validator.md` Smoke Test: App starten → Health-Endpoint pollen → HTTP 200 → App stoppen
- `test-validator.md` Final Validation: Lint Auto-Fix → Lint Check → Type Check → Build → Test-Pipeline
- `slice-impl-coordinator.md`: Implementer → Test-Writer → Test-Validator → Debugger (Retry max 9)
- `debugger.md`: Wissenschaftliche Methode (Hypothese → Logs → Beweis → Fix)
- Stack-Detection: Indicator-File-basiert (pyproject.toml, package.json, composer.json, go.mod)

---

## User Flow

> "User" = der Orchestrator/Build-Command, nicht ein Mensch.

### Flow 1: Slice Implementation mit neuen Gates

1. `slice-implementer` schreibt Code → Commit
2. **[NEU] `code-reviewer` Sub-Agent** reviewt `git diff` → Structured Findings (CRITICAL/HIGH/MEDIUM/LOW)
3. Falls CRITICAL: Zurück zu Implementer mit Findings → Fix → Re-Review (max 3 Iterationen)
4. **[NEU] Deterministic Gate:** ESLint/TypeCheck laufen (stack-abhängig)
5. Falls Failure: Zurück zu Implementer mit Lint/Type-Errors → Fix
6. `test-writer` schreibt Tests → Commit
7. `test-validator` führt Tests aus (Unit → Integration → Acceptance → **[ERWEITERT] Smoke mit DevTools** → Regression)
8. Falls Failure: `debugger` analysiert und fixt → Re-Validate (max 9 Retries wie bisher)

**Error Paths:**
- Code-Reviewer findet CRITICAL nach 3 Retries → `status: "failed"`, `error: "code-review: unresolved CRITICAL issues"`
- Lint/TypeCheck Failure nach 3 Auto-Fix-Versuchen → `status: "failed"`, `error: "lint/typecheck: persistent failures"`
- Erweiterter Smoke Test scheitert (App rendert nicht korrekt) → `debugger` wird aufgerufen wie bisher

### Flow 2: Erweiterter Smoke Test

1. App starten im Hintergrund (wie bisher)
2. Health-Endpoint pollen → HTTP 200 (wie bisher)
3. **[NEU]** Chrome DevTools MCP: DOM-Snapshot der Hauptseite
4. **[NEU]** Prüfe: Erwartete Elemente aus Slice-Spec vorhanden? (Accessibility-Tree)
5. **[NEU]** Console-Logs prüfen: Keine unerwarteten Errors?
6. **[NEU]** Optional: Screenshot als Evidence speichern
7. App stoppen (wie bisher)

---

## Feature State Machine

### States Overview

| State | Beschreibung | Available Actions |
|-------|-------|---------------------|
| `code_written` | Implementer hat Code committed | Review starten |
| `review_in_progress` | Code-Reviewer analysiert Diff | Warten auf Ergebnis |
| `review_passed` | Keine CRITICAL Issues | Deterministic Gate starten |
| `review_failed` | CRITICAL Issues gefunden | Fix und Re-Review |
| `lint_passed` | ESLint/TypeCheck bestanden | Test-Writer starten |
| `lint_failed` | Lint/Type-Fehler | Auto-Fix und Re-Check |
| `smoke_functional` | App startet UND rendert korrekt | Regression starten |
| `smoke_health_only` | App startet, kein DevTools verfügbar | Regression starten (Fallback) |

### Transitions

| Current State | Trigger | Next State | Business Rules |
|---------------|---------|------------|----------------|
| `code_written` | Implementer Commit | `review_in_progress` | -- |
| `review_in_progress` | Reviewer: APPROVED/CONDITIONAL | `review_passed` | -- |
| `review_in_progress` | Reviewer: REJECTED (CRITICAL) | `review_failed` | Max 3 Review-Retries |
| `review_failed` | Implementer Fix + Re-Review | `review_in_progress` | -- |
| `review_passed` | Start Deterministic Gate | `lint_passed` oder `lint_failed` | -- |
| `lint_failed` | Auto-Fix + Re-Check | `lint_passed` oder `lint_failed` | Max 3 Lint-Retries |
| `lint_passed` | Start Test-Pipeline | Test-Validator States | -- |
| Smoke: App started + HTTP 200 | Chrome DevTools MCP verfügbar | `smoke_functional` | Fallback zu `smoke_health_only` wenn MCP nicht verfügbar |

---

## Business Rules

- Code-Reviewer MUSS in separatem Context laufen (Sub-Agent via Task()), nicht im gleichen Agent-Context wie Implementer
- Review-Prompt MUSS adversarial sein: "Finde mindestens 3 Issues oder begründe explizit warum keine existieren"
- CRITICAL Issues blockieren Pipeline, HIGH/MEDIUM/LOW werden als Warnings geloggt
- Chrome DevTools MCP ist **optional** -- wenn nicht installiert/verfügbar, Fallback zu reinem Health-Check (Abwärtskompatibilität)
- ESLint/TypeCheck pro Slice ist **zusätzlich** zu final_validation (nicht ersetzend)
- Stack-Detection für Lint/TypeCheck nutzt bestehende Indicator-File-Logik aus test-validator
- Console-Error-Check: `console.error` im Browser = Warning, nicht automatisch Failure (manche Libraries loggen Warnings als Errors)

---

## Data

| Feld | Required | Validation | Notes |
|------|----------|------------|-------|
| `review_findings` | Ja (vom Reviewer) | JSON Array mit severity, file, line, message, fix_suggestion | Output Contract des Code-Reviewers |
| `review_verdict` | Ja | `APPROVED` / `CONDITIONAL` / `REJECTED` | REJECTED nur bei CRITICAL Issues |
| `review_iterations` | Ja | Integer 0-3 | Zählt Review-Fix-Zyklen |
| `lint_exit_code` | Ja | 0 = Pass, != 0 = Fail | Stack-abhängiger Lint-Command |
| `typecheck_exit_code` | Ja | 0 = Pass, != 0 = Fail | Stack-abhängiger TypeCheck-Command |
| `smoke_dom_snapshot` | Optional | JSON (Accessibility-Tree) | Nur wenn Chrome DevTools MCP verfügbar |
| `smoke_console_errors` | Optional | String Array | Errors aus Browser-Console |
| `smoke_screenshot_path` | Optional | Dateipfad | Evidence-Screenshot |

---

## Implementation Slices

### Dependencies

```
Slice 1 (Code Reviewer Agent) ──┐
                                ├──> Slice 3 (Pipeline Integration)
Slice 2 (Deterministic Gate)  ──┘
                                     |
                               Slice 4 (Chrome DevTools Smoke)
```

### Slices

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| 1 | Code Reviewer Agent | `code-reviewer.md` Agent-Definition, JSON Output Contract, adversarial Prompt, Severity-Kategorien | Agent manuell aufrufen mit Test-Diff, prüfen ob Findings strukturiert zurückkommen | -- |
| 2 | Deterministic Pre-Test Gate | ESLint/TypeCheck als Pre-Test-Stage in test-validator für `slice_validation` Mode, Stack-Detection nutzen | Lint/TypeCheck auf Test-Repo ausführen, Exit-Codes prüfen | -- |
| 3 | Pipeline Integration | slice-impl-coordinator erweitern: nach Implementer → Code-Reviewer → Deterministic Gate → dann erst Test-Writer | Slice mit bewussten Lint-Fehlern durchlaufen lassen, prüfen ob Pipeline korrekt stoppt/fixt | Slice 1, 2 |
| 4 | Chrome DevTools Smoke Test | test-validator Smoke-Stage erweitern: DOM-Snapshot, Console-Check, Screenshot-Evidence. Fallback wenn MCP nicht da. | App starten, Smoke mit DevTools laufen lassen, prüfen ob DOM-Snapshot + Console-Errors korrekt erfasst werden | Slice 3 |

### Recommended Order

1. **Slice 1:** Code Reviewer Agent -- Unabhängig, definiert nur den Agent
2. **Slice 2:** Deterministic Gate -- Unabhängig, erweitert test-validator
3. **Slice 3:** Pipeline Integration -- Verbindet Slice 1+2 mit dem Orchestrator
4. **Slice 4:** Chrome DevTools Smoke -- Erweitert den bestehenden Smoke Test

---

## Context & Research

### SOTA Framework Comparison

| Framework | Pre-Impl Gates | Self-Review | Visual Verification | Deterministic Checks |
|---|---|---|---|---|
| **Dieses System (aktuell)** | Gate 0-3 (4 Stufen) | Nein | Health-Endpoint nur | final_validation nur |
| **Dieses System (nach Upgrade)** | Gate 0-3 + Code Review + Lint/Type | Ja (Sub-Agent) | Chrome DevTools MCP | Pro Slice |
| Codex (OpenAI) | Plan.md Milestones | Ja (Codex /review) | Chrome DevTools MCP + Video | Pro Milestone |
| Devin 2.2 | Plan Review | Ja (Review Autofix) | Desktop Computer Use + Screen Recording | CI-basiert |
| Claude Code (vanilla) | CLAUDE.md + Hooks | Nein built-in | Nein | User-konfiguriert |
| Cursor Agent | .cursorrules | Nein | Cloud Agents: Video | Terminal-basiert |
| Amazon Q | Spec → Plan → Skeleton | /review Agent | Nein | CI/CD Scan |

### Key Findings

| Source | Finding |
|--------|---------|
| Codex/Harness Engineering (OpenAI) | Chrome DevTools MCP als Kern-Tool: DOM-Snapshots, Screenshots, Performance-Traces. Codex drives App per git worktree + DevTools MCP. |
| Playwright MCP (Microsoft) | 25+ Browser-Tools via MCP. Accessibility-Tree-basiert, kein Vision-Model nötig. Deterministisch. |
| Devin 2.2 Review Autofix | Self-Review ist KEIN separater Agent, sondern gleiche Session. Separater Context (Sub-Agent) ist besser gegen Rubber-Stamping. |
| Qodo PR-Agent Research | `self-review` CLI existiert als Purpose-built Tool für Pre-PR. Open Source, BYO API Keys. |
| LLM Narcissism Research | Separater Context + adversarialer Prompt + verschiedene Model-Tiers reduzieren Rubber-Stamping signifikant. |
| Greptile vs CodeRabbit Benchmark | AI Code Review: 82% vs 46% Bug-Detection. External Tools als Second Layer sind wertvoll. |

### Tools Evaluated

| Tool | Entscheidung | Begründung |
|------|---|---|
| Chrome DevTools MCP | **IN SCOPE** | FREE, triviales Setup, DOM + Console + Screenshots + Performance. Von Codex validiert. |
| Playwright MCP | OUT (kann später ergänzt werden) | Überlappend mit Chrome DevTools MCP. DevTools hat Performance-Traces + Console-Logs. |
| Stagehand/Browser Use | OUT | Overhead für AI-native Navigation nicht nötig wenn Accessibility-Tree reicht |
| Applitools/Percy | OUT | $199-969/mo, Overkill für Agent-Pipeline. Eher für CI/CD. |
| CodeRabbit/Greptile | OUT (Phase 2) | Externe SaaS, gut als Second Layer auf PR. Nicht für Pre-Test-Gate. |
| Qodo PR-Agent | OUT (Alternative) | Gute Option, aber Claude Sub-Agent ist nativer für dieses System. |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| 1 | Soll Code-Reviewer mit gleichem oder anderem Model-Tier reviewen? | A) Gleicher Tier (Sonnet→Sonnet) B) Höherer Tier (Sonnet→Opus) C) Konfigurierbar | C) Konfigurierbar, Default: gleicher Tier | -- |
| 2 | Wie viele Review-Retries vor Pipeline-Abort? | A) 1 B) 3 C) Konfigurierbar | B) 3 (analog Lint-Retries) | -- |
| 3 | Console.error im Smoke = Failure oder Warning? | A) Failure B) Warning C) Konfigurierbar per Slice | B) Warning (viele Libraries loggen Warnings als console.error) | -- |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-03 | Web | 13 SOTA Frameworks analysiert: Kein Framework hat formale Architecture Compliance oder Spec-basierte Tests wie dieses System |
| 2026-03-03 | Web | Chrome DevTools MCP: FREE, 25+ Tools, von Codex/Harness validiert. Setup: `npx chrome-devtools-mcp@latest` |
| 2026-03-03 | Web | Playwright MCP: FREE, Accessibility-Tree-basiert, deterministisch. Alternative zu Chrome DevTools MCP. |
| 2026-03-03 | Web | LLM Self-Review: Separater Context + adversarialer Prompt effektivste Anti-Rubber-Stamping-Strategie |
| 2026-03-03 | Web | Greptile 82% Bug-Detection, CodeRabbit 46% -- externe Tools als optionale Second Layer |
| 2026-03-03 | Web | Qodo PR-Agent: Open-Source `self-review` CLI. Alternative zu Claude Sub-Agent. |
| 2026-03-03 | Web | Applitools $899+/mo, Percy $199/mo -- Overkill für Agent-Pipeline, besser für CI/CD |
| 2026-03-03 | Codebase | test-validator hat bereits Stack-Detection, Lint/TypeCheck in final_validation -- kann für slice_validation erweitert werden |
| 2026-03-03 | Codebase | slice-impl-coordinator hat bereits Retry-Loop (max 9) -- Code-Reviewer passt als zusätzlicher Step hinein |

---

## Q&A Log

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Welche Art von Quality Gates nutzen aktuelle SOTA autonome Coding-Agent-Frameworks? | Recherchiert: 13 Frameworks. Die meisten haben nur Verify-Loops (edit→test→fix). Nur Codex und Amazon Q haben mehrstufige Gates. Kein Framework hat Architecture/Slice Compliance wie dieses System. |
| 2 | Welche Gaps hat das eigene System im Vergleich zu SOTA? | 5 Gaps identifiziert: Visual/Functional Verification, Self-Review Loop, Parallel Execution, Lightweight Alternative, Fleet-based Testing |
| 3 | Welche Optionen gibt es für Visual Verification? | 8 Optionen recherchiert (Playwright MCP, Chrome DevTools MCP, Stagehand, Browser Use, Applitools, Percy, BackstopJS, Screenshot+LLM). Empfehlung: Chrome DevTools MCP (FREE, trivial, von Codex validiert) |
| 4 | Welche Optionen gibt es für Self-Review? | 7 Optionen recherchiert (Claude Sub-Agent, Qodo, CodeRabbit, Greptile, Semgrep, Multi-Model, Layered). Empfehlung: Claude Sub-Agent (nativ, $0 Setup, separater Context) |
| 5 | Welche Verbesserungen sollen als Discovery ausgearbeitet werden? | User wählt: Chrome DevTools MCP + Code Reviewer Sub-Agent + ESLint/TypeCheck Gate. Alles stack-agnostisch. |
