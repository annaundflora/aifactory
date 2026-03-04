# Slice 2: Deterministic Pre-Test Gate

> **Slice 2 von 4** fuer `Quality Gates Upgrade`
>
> | Navigation | |
> |------------|---|
> | **Vorheriger:** | `slice-01-code-reviewer-agent.md` |
> | **Naechster:** | `slice-03-pipeline-integration.md` |

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-02-deterministic-pre-test-gate` |
| **Test** | `Manuell: Pruefe dass slice-impl-coordinator.md Bash-Tool, Stack-Detection und Lint/TypeCheck-Loop enthaelt` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

**Erklaerung:**
- **ID**: Eindeutiger Identifier fuer Commits und Evidence
- **Test**: Manuelle Validierung -- Agent-Definitionen sind .md Dateien, kein ausfuehrbarer Code
- **E2E**: false -- keine Playwright-Tests
- **Dependencies**: Keine -- unabhaengig von Slice 1

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Manuell bestimmt. Dieses Feature modifiziert Agent-Definitionen (.md Dateien), keine Webanwendung.

| Key | Value |
|-----|-------|
| **Stack** | `agent-definitions` (kein klassischer App-Stack) |
| **Test Command** | `Manuell: Lies slice-impl-coordinator.md und pruefe Bash-Tool, Stack-Detection-Logik, Deterministic-Gate-Loop` |
| **Integration Command** | `N/A` |
| **Acceptance Command** | `Manuell: Simuliere Pipeline-Durchlauf mit Test-Repo, pruefe ob Lint/TypeCheck-Fehler erkannt und gefixt werden` |
| **Start Command** | `N/A` |
| **Health Endpoint** | `N/A` |
| **Mocking Strategy** | `no_mocks` |

**Erklaerung:**
- Kein klassischer Test-Stack, da nur Agent-Definitionen (.md Dateien) modifiziert werden
- Validierung erfolgt durch manuelle Pruefung der modifizierten .md Dateien
- Funktionale Validierung erst moeglich nach Slice 3 (Pipeline Integration)

---

## Slice-Uebersicht

| # | Slice | Status | Datei |
|---|-------|--------|-------|
| 1 | Code Reviewer Agent | Ready | `slice-01-code-reviewer-agent.md` |
| 2 | Deterministic Pre-Test Gate | Ready | `slice-02-deterministic-pre-test-gate.md` |
| 3 | Pipeline Integration | Pending | `slice-03-pipeline-integration.md` |
| 4 | Chrome DevTools Smoke Test | Pending | `slice-04-chrome-devtools-smoke.md` |

---

## Kontext & Ziel

Deterministische Checks (ESLint, TypeCheck, ruff, mypy) laufen aktuell nur in `final_validation` (nach allen Slices), nicht pro Slice. Fehler werden dadurch erst spaet entdeckt und muessen aufwaendig gefixt werden.

**Aktuelle Probleme:**
1. Lint/TypeCheck-Fehler werden erst am Ende der gesamten Pipeline entdeckt (final_validation) -- nicht pro Slice
2. Der slice-impl-coordinator hat kein Bash-Tool und kann keine deterministischen Commands ausfuehren
3. Keine Stack-Detection im Coordinator -- er weiss nicht, welche Lint/TypeCheck-Commands zum Projekt passen

**Zielbild:**
- slice-impl-coordinator bekommt Bash-Tool-Zugriff (Frontmatter-Erweiterung)
- Stack-Detection-Logik (Phase 1a) zu Beginn der Pipeline: Indicator-Files lesen, detected_stack ableiten
- Deterministic Gate (Phase 2c) nach Implementation: Lint-Auto-Fix, Lint-Check, TypeCheck mit Fix-Loop (max 3)
- detected_stack wird an alle Sub-Agents (test-validator, code-reviewer) weitergegeben

---

## Technische Umsetzung

### Architektur-Kontext (aus architecture.md)

> **Quelle:** `architecture.md` -> Deterministic Gate (kein eigener Agent -- direkt im Coordinator) + Stack Detection

```
Phase 1a: Stack Detection (NEU -- zu Beginn der Pipeline)
  |-- Glob Indicator-Files im working_dir
  |-- Ergebnis: detected_stack mit lint/typecheck/test/start Commands
  |-- Falls kein Stack erkannt: Warning, Lint/TypeCheck Gate ueberspringen

Phase 2c: Deterministic Gate (NEU -- nach Code-Review, vor Test-Writer)
  |-- Bash: {detected_stack.lint_autofix_cmd} -> {detected_stack.lint_check_cmd} -> {detected_stack.typecheck_cmd}
  |-- IF failure: Task(slice-implementer) mit errors -> Fix -> Re-Check (max 3)
  |-- IF kein Stack erkannt: Skip mit Warning
```

### 1. Architektur-Impact

| Layer | Aenderungen |
|-------|-------------|
| `.claude/agents/slice-impl-coordinator.md` | Frontmatter: Bash-Tool ergaenzen. Neue Phase 1a (Stack-Detection). Neue Phase 2c (Deterministic Gate mit Fix-Loop). detected_stack Weitergabe an Sub-Agents. |

### 2. Datenfluss

```
slice-impl-coordinator startet
  |
  v
Phase 1a: Stack Detection
  Glob("{working_dir}/pyproject.toml") -> prüfe "fastapi" / "django"
  Glob("{working_dir}/requirements.txt") -> prüfe "fastapi"
  Glob("{working_dir}/package.json") -> prüfe dependencies: next, nuxt, vue, express
  Glob("{working_dir}/composer.json") -> prüfe "laravel/framework"
  Glob("{working_dir}/go.mod") -> Go Stack
  |
  v
detected_stack = {
  stack_name, lint_autofix_cmd, lint_check_cmd, typecheck_cmd,
  test_cmd, start_cmd, health_endpoint
}
  |
  v
Phase 2: Implementation (unveraendert)
  |
  v
Phase 2c: Deterministic Gate
  Bash("cd {working_dir} && {detected_stack.lint_autofix_cmd}")
  lint_result = Bash("cd {working_dir} && {detected_stack.lint_check_cmd}")
  type_result = Bash("cd {working_dir} && {detected_stack.typecheck_cmd}")
  |
  v
IF lint_result.exit_code == 0 AND type_result.exit_code == 0: PASS -> Phase 3
IF failure: Task(slice-implementer) mit errors -> Re-Check (max 3 Retries)
IF max retries: HARD EXIT {status: "failed", error: "lint/typecheck: persistent failures"}
```

### 3. Frontmatter-Erweiterung

Aktuelles Frontmatter in `slice-impl-coordinator.md`:

```yaml
---
name: slice-impl-coordinator
description: "Ebene-1 Coordinator: Implementiert + testet 1 Slice via Task(slice-implementer) + Task(test-writer) + Task(test-validator) + Task(debugger). Retry-Loop (max 9). Returns JSON."
tools: Read, Write, Glob, Grep, Task
---
```

Neues Frontmatter:

```yaml
---
name: slice-impl-coordinator
description: "Ebene-1 Coordinator: Implementiert + testet 1 Slice via Task(slice-implementer) + Task(test-writer) + Task(test-validator) + Task(debugger). Stack-Detection + Deterministic Gate (Lint/TypeCheck). Retry-Loop (max 9). Returns JSON."
tools: Read, Write, Glob, Grep, Task, Bash
---
```

### 4. Stack-Detection-Logik (Phase 1a)

Die folgende Logik wird als neue "Phase 1a: Stack Detection" Section in `slice-impl-coordinator.md` eingefuegt, NACH dem Input-Parsing und VOR Phase 2 (Implementation).

**Stack-Detection-Tabelle (Referenz aus architecture.md):**

| Indicator File(s) | Stack | Lint Auto-Fix | Lint Check | Type Check |
|---|---|---|---|---|
| `pyproject.toml` + fastapi | Python/FastAPI | `ruff check --fix .` | `ruff check .` | `mypy .` |
| `requirements.txt` + fastapi | Python/FastAPI | `ruff check --fix .` | `ruff check .` | `mypy .` |
| `pyproject.toml` + django | Python/Django | `ruff check --fix .` | `ruff check .` | `mypy .` |
| `package.json` + next | TypeScript/Next.js | `pnpm eslint --fix .` | `pnpm lint` | `pnpm tsc --noEmit` |
| `package.json` + nuxt | TypeScript/Nuxt | `pnpm eslint --fix .` | `pnpm lint` | `pnpm tsc --noEmit` |
| `package.json` + vue ^3 (ohne nuxt) | TypeScript/Vue 3 | `pnpm eslint --fix .` | `pnpm lint` | `pnpm tsc --noEmit` |
| `package.json` + vue ^2 | JavaScript/Vue 2 | `pnpm eslint --fix .` | `pnpm lint` | `pnpm tsc --noEmit` |
| `package.json` + express | TypeScript/Express | `pnpm eslint --fix .` | `pnpm lint` | `pnpm tsc --noEmit` |
| `composer.json` + laravel | PHP/Laravel | `./vendor/bin/pint` | `./vendor/bin/pint --test` | `phpstan analyse` (falls konfiguriert) |
| `go.mod` | Go | -- | `golangci-lint run` | `go vet ./...` |

**Algorithmus (Pseudocode):**

```
Phase 1a: Stack Detection

detected_stack = null

# 1. Python Stacks
pyproject = Read("{working_dir}/pyproject.toml")
IF pyproject EXISTS:
  IF "fastapi" IN pyproject:
    detected_stack = {
      stack_name: "Python/FastAPI",
      lint_autofix_cmd: "ruff check --fix .",
      lint_check_cmd: "ruff check .",
      typecheck_cmd: "mypy .",
      test_cmd: "python -m pytest {path} -v",
      start_cmd: "uvicorn app.main:app --host 0.0.0.0 --port 8000",
      health_endpoint: "http://localhost:8000/health"
    }
  ELIF "django" IN pyproject:
    detected_stack = {
      stack_name: "Python/Django",
      lint_autofix_cmd: "ruff check --fix .",
      lint_check_cmd: "ruff check .",
      typecheck_cmd: "mypy .",
      test_cmd: "python -m pytest {path} -v",
      start_cmd: "python manage.py runserver",
      health_endpoint: "http://localhost:8000/health"
    }

IF detected_stack == null:
  requirements = Read("{working_dir}/requirements.txt")
  IF requirements EXISTS AND "fastapi" IN requirements:
    detected_stack = {
      stack_name: "Python/FastAPI",
      lint_autofix_cmd: "ruff check --fix .",
      lint_check_cmd: "ruff check .",
      typecheck_cmd: "mypy .",
      test_cmd: "python -m pytest {path} -v",
      start_cmd: "uvicorn app.main:app --host 0.0.0.0 --port 8000",
      health_endpoint: "http://localhost:8000/health"
    }

# 2. Node.js Stacks
IF detected_stack == null:
  package_json = Read("{working_dir}/package.json")
  IF package_json EXISTS:
    deps = package_json.dependencies + package_json.devDependencies
    IF "next" IN deps:
      detected_stack = {
        stack_name: "TypeScript/Next.js",
        lint_autofix_cmd: "pnpm eslint --fix .",
        lint_check_cmd: "pnpm lint",
        typecheck_cmd: "pnpm tsc --noEmit",
        test_cmd: "pnpm test {path}",
        start_cmd: "pnpm dev",
        health_endpoint: "http://localhost:3000/api/health"
      }
    ELIF "nuxt" IN deps:
      detected_stack = {
        stack_name: "TypeScript/Nuxt",
        lint_autofix_cmd: "pnpm eslint --fix .",
        lint_check_cmd: "pnpm lint",
        typecheck_cmd: "pnpm tsc --noEmit",
        test_cmd: "pnpm test {path}",
        start_cmd: "pnpm dev",
        health_endpoint: "http://localhost:3000/api/health"
      }
    ELIF "vue" IN deps AND version startswith "^3":
      detected_stack = {
        stack_name: "TypeScript/Vue 3",
        lint_autofix_cmd: "pnpm eslint --fix .",
        lint_check_cmd: "pnpm lint",
        typecheck_cmd: "pnpm tsc --noEmit",
        test_cmd: "pnpm test {path}",
        start_cmd: "pnpm dev",
        health_endpoint: "http://localhost:5173"
      }
    ELIF "vue" IN deps AND version startswith "^2":
      detected_stack = {
        stack_name: "JavaScript/Vue 2",
        lint_autofix_cmd: "pnpm eslint --fix .",
        lint_check_cmd: "pnpm lint",
        typecheck_cmd: "pnpm tsc --noEmit",
        test_cmd: "pnpm test {path}",
        start_cmd: "pnpm serve",
        health_endpoint: "http://localhost:8080"
      }
    ELIF "express" IN deps:
      detected_stack = {
        stack_name: "TypeScript/Express",
        lint_autofix_cmd: "pnpm eslint --fix .",
        lint_check_cmd: "pnpm lint",
        typecheck_cmd: "pnpm tsc --noEmit",
        test_cmd: "pnpm test {path}",
        start_cmd: "node server.js",
        health_endpoint: "http://localhost:3000/health"
      }

# 3. PHP Stack
IF detected_stack == null:
  composer = Read("{working_dir}/composer.json")
  IF composer EXISTS AND "laravel/framework" IN composer:
    detected_stack = {
      stack_name: "PHP/Laravel",
      lint_autofix_cmd: "./vendor/bin/pint",
      lint_check_cmd: "./vendor/bin/pint --test",
      typecheck_cmd: "phpstan analyse",
      test_cmd: "php artisan test {path}",
      start_cmd: "php artisan serve",
      health_endpoint: "http://localhost:8000/health"
    }

# 4. Go Stack
IF detected_stack == null:
  go_mod = Read("{working_dir}/go.mod")
  IF go_mod EXISTS:
    detected_stack = {
      stack_name: "Go",
      lint_autofix_cmd: "",
      lint_check_cmd: "golangci-lint run",
      typecheck_cmd: "go vet ./...",
      test_cmd: "go test {path}",
      start_cmd: "go run .",
      health_endpoint: "http://localhost:8080/health"
    }

# 5. Kein Stack erkannt
IF detected_stack == null:
  LOG WARNING: "Kein Stack erkannt in {working_dir}. Deterministic Gate wird uebersprungen."
  detected_stack = { stack_name: "unknown", lint_autofix_cmd: "", lint_check_cmd: "", typecheck_cmd: "" }
```

### 5. Deterministic Gate (Phase 2c)

Die folgende Logik wird als neue "Phase 2c: Deterministic Gate" Section in `slice-impl-coordinator.md` eingefuegt, NACH Phase 2 (Implementation) und VOR Phase 3 (Test-Erstellung).

**Pseudocode:**

```
Phase 2c: Deterministic Gate

IF detected_stack.stack_name == "unknown":
  LOG WARNING: "Stack unbekannt -- Deterministic Gate uebersprungen"
  GOTO Phase 3

lint_retries = 0
MAX_LINT_RETRIES = 3

WHILE lint_retries < MAX_LINT_RETRIES:

  # Step 1: Auto-Fix (best effort, Exit-Code ignorieren)
  IF detected_stack.lint_autofix_cmd != "":
    Bash("cd {working_dir} && {detected_stack.lint_autofix_cmd}")

  # Step 2: Lint Check
  lint_result = Bash("cd {working_dir} && {detected_stack.lint_check_cmd}")

  # Step 3: Type Check
  IF detected_stack.typecheck_cmd != "":
    type_result = Bash("cd {working_dir} && {detected_stack.typecheck_cmd}")
  ELSE:
    type_result = { exit_code: 0, stdout: "no typecheck configured" }

  # Step 4: Evaluate
  IF lint_result.exit_code == 0 AND type_result.exit_code == 0:
    LOG: "Deterministic Gate PASSED"
    BREAK  # Gate bestanden -> weiter zu Phase 3

  # Step 5: Fix-Versuch via Implementer
  lint_retries++

  IF lint_retries < MAX_LINT_RETRIES:
    # Sammle Fehlermeldungen (max 2000 Zeichen pro Output)
    error_summary = ""
    IF lint_result.exit_code != 0:
      error_summary += "LINT ERRORS:\n" + truncate(lint_result.stdout, 2000)
    IF type_result.exit_code != 0:
      error_summary += "\nTYPE ERRORS:\n" + truncate(type_result.stdout, 2000)

    Task(
      subagent_type: "slice-implementer",
      description: "Fix lint/typecheck errors for {slice_id} (Retry {lint_retries})",
      prompt: "
        Fixe Lint/TypeCheck-Fehler fuer Slice: {slice_id}

        ## Fehler
        {error_summary}

        ## Input-Dateien (MUSS gelesen werden)
        - Slice-Spec: {spec_path}/slices/{slice_file}
        - Architecture: {architecture_path}

        ## Anweisungen
        1. Lies die Fehlermeldungen oben
        2. Fixe ALLE gemeldeten Lint- und TypeCheck-Fehler
        3. Aendere KEINE Funktionalitaet -- nur Lint/Type Compliance
        4. Committe den Fix mit Message: 'fix({slice_id}): lint/typecheck errors (retry {lint_retries})'

        ## Output
        Gib am Ende ein JSON zurueck:
        ```json
        {
          \"status\": \"fixed | unable_to_fix\",
          \"files_changed\": [\"pfad/zur/datei\"],
          \"errors_fixed\": \"Beschreibung der Fixes\"
        }
        ```
      "
    )

    fix_json = parse_last_json_block(task_output)

    IF parse_failure OR fix_json.status == "unable_to_fix":
      RETURN {
        "status": "failed",
        "retries": lint_retries,
        "evidence": {"files_changed": files_changed, "test_files": [], "test_count": 0, "commit_hash": commit_hash},
        "error": "lint/typecheck: implementer unable to fix after {lint_retries} retries"
      }

    # Merge files_changed
    files_changed = merge(files_changed, fix_json.files_changed)
    CONTINUE  # Re-Check

# Max Retries erreicht
IF lint_retries >= MAX_LINT_RETRIES:
  RETURN {
    "status": "failed",
    "retries": lint_retries,
    "evidence": {"files_changed": files_changed, "test_files": [], "test_count": 0, "commit_hash": commit_hash},
    "error": "lint/typecheck: persistent failures after {MAX_LINT_RETRIES} retries"
  }
```

### 6. detected_stack Weitergabe an Sub-Agents

Der Coordinator gibt detected_stack im Prompt an Sub-Agents weiter. Dies betrifft:

**test-validator (Phase 4):**

```
Task(
  subagent_type: "test-validator",
  prompt: "
    Validiere Tests fuer Slice: {slice_id}

    ## Mode
    slice_validation

    ## Stack Info (detected by Coordinator)
    Stack: {detected_stack.stack_name}
    Test Command: {detected_stack.test_cmd}
    Start Command: {detected_stack.start_cmd}
    Health Endpoint: {detected_stack.health_endpoint}

    ## Input-Dateien
    - Slice-Spec: {spec_path}/slices/{slice_file}
    ...
  "
)
```

**code-reviewer (Phase 2b, aus Slice 1/3):**

```
Task(
  subagent_type: "code-reviewer",
  prompt: "
    Review Code fuer Slice: {slice_id}

    ## Stack Info (detected by Coordinator)
    Stack: {detected_stack.stack_name}

    ## Input
    - Slice-Spec: {slice_file_path}
    - Architecture: {architecture_path}
    - Working-Dir: {working_dir}
    ...
  "
)
```

---

## Constraints & Hinweise

**Betrifft:**
- Nur `.claude/agents/slice-impl-coordinator.md` -- Modifikation einer bestehenden Agent-Definition

**Abgrenzung:**
- KEIN ausfuehrbarer Code -- nur eine .md Datei mit Agent-Anweisungen wird modifiziert
- KEINE Aenderung an `test-validator.md` (Stack-Detection dort bleibt unveraendert, test-validator hat bereits seine eigene)
- KEINE Aenderung an `code-reviewer.md` (das definiert Slice 1)
- KEINE Pipeline-Integration (das macht Slice 3) -- hier wird nur die Logik fuer Stack-Detection und Deterministic Gate definiert, die Einordnung in den Pipeline-Flow (Phase 2b Code-Review vor Phase 2c) macht Slice 3
- Der Coordinator fuehrt Lint/TypeCheck SELBST aus via Bash -- kein Sub-Agent noetig fuer deterministische Commands

**Architecture Contract:**
- Frontmatter MUSS `Bash` als zusaetzliches Tool enthalten (aus architecture.md)
- Stack-Detection-Tabelle MUSS alle 10 Stacks aus architecture.md abdecken
- Deterministic Gate MUSS max 3 Retries haben (aus architecture.md)
- Error-Output MUSS auf max 2000 Zeichen truncated werden (aus architecture.md)
- Bei unbekanntem Stack: Warning + Gate Skip (aus architecture.md)

---

## Integration Contract (GATE 2 PFLICHT)

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| -- | -- | -- | -- |

Dieser Slice hat keine Dependencies. Er modifiziert nur die Coordinator-Definition.

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Bash-Tool im Coordinator Frontmatter | Tool-Zugriff | Slice 3 (Pipeline Integration) | `tools: Read, Write, Glob, Grep, Task, Bash` |
| Phase 1a: Stack-Detection-Logik | Pipeline-Phase | Slice 3 (Pipeline Integration) | `detected_stack` Objekt mit stack_name, lint_autofix_cmd, lint_check_cmd, typecheck_cmd, test_cmd, start_cmd, health_endpoint |
| Phase 2c: Deterministic Gate Loop | Pipeline-Phase | Slice 3 (Pipeline Integration) | Lint/TypeCheck Check mit Fix-Loop (max 3), HARD EXIT bei persistent failures |
| detected_stack Weitergabe-Pattern | Prompt-Template | Slice 3 (Pipeline Integration), Slice 4 (Chrome DevTools Smoke) | `## Stack Info` Section im Task()-Prompt an Sub-Agents |

### Integration Validation Tasks

- [ ] Frontmatter in slice-impl-coordinator.md enthaelt `Bash` im tools-Feld
- [ ] Phase 1a Stack-Detection deckt alle 10 Stacks aus der Architecture-Tabelle ab
- [ ] Phase 2c Deterministic Gate hat max 3 Retries
- [ ] detected_stack wird im test-validator Task()-Prompt mitgegeben
- [ ] Bei unbekanntem Stack: Gate wird uebersprungen mit Warning (kein Failure)

---

## Code Examples (MANDATORY - GATE 2 PFLICHT)

> **KRITISCH:** Alle Code-Beispiele in diesem Dokument sind **PFLICHT-Deliverables**.
> Der Gate 2 Compliance Agent prueft, dass jedes Code-Beispiel implementiert wird.

| Code Example | Section | Mandatory | Notes |
|--------------|---------|-----------|-------|
| Neues Frontmatter (mit Bash) | Technische Umsetzung > 3. Frontmatter-Erweiterung | YES | `tools: Read, Write, Glob, Grep, Task, Bash` |
| Stack-Detection Algorithmus | Technische Umsetzung > 4. Stack-Detection-Logik | YES | Alle 10 Stacks, Indicator-File-Pruefung, Fallback bei unknown |
| Deterministic Gate Pseudocode | Technische Umsetzung > 5. Deterministic Gate | YES | Auto-Fix, Lint-Check, TypeCheck, Fix-Loop max 3, HARD EXIT |
| test-validator Prompt mit Stack Info | Technische Umsetzung > 6. detected_stack Weitergabe | YES | `## Stack Info` Section im Task()-Prompt |
| code-reviewer Prompt mit Stack Info | Technische Umsetzung > 6. detected_stack Weitergabe | YES | `## Stack Info` Section im Task()-Prompt |

---

## Acceptance Criteria

1) GIVEN die Datei `.claude/agents/slice-impl-coordinator.md`
   WHEN das YAML Frontmatter gelesen wird
   THEN enthaelt das `tools`-Feld den Wert `Read, Write, Glob, Grep, Task, Bash`

2) GIVEN die Datei `.claude/agents/slice-impl-coordinator.md`
   WHEN die Phase 1a Section gelesen wird
   THEN beschreibt sie einen Stack-Detection-Algorithmus der alle 10 Stacks aus der Architecture-Tabelle erkennt: Python/FastAPI (pyproject.toml), Python/FastAPI (requirements.txt), Python/Django, TypeScript/Next.js, TypeScript/Nuxt, TypeScript/Vue 3, JavaScript/Vue 2, TypeScript/Express, PHP/Laravel, Go

3) GIVEN die Datei `.claude/agents/slice-impl-coordinator.md`
   WHEN die Phase 1a Section gelesen wird
   THEN definiert sie fuer jeden erkannten Stack ein `detected_stack` Objekt mit den Feldern: stack_name, lint_autofix_cmd, lint_check_cmd, typecheck_cmd, test_cmd, start_cmd, health_endpoint

4) GIVEN die Datei `.claude/agents/slice-impl-coordinator.md`
   WHEN die Phase 1a Section gelesen wird und kein Indicator-File im working_dir gefunden wird
   THEN loggt der Algorithmus eine Warning und setzt detected_stack.stack_name auf "unknown"

5) GIVEN die Datei `.claude/agents/slice-impl-coordinator.md`
   WHEN die Phase 2c Section gelesen wird
   THEN beschreibt sie einen Deterministic Gate mit: (a) Lint Auto-Fix (Exit-Code ignoriert), (b) Lint Check, (c) Type Check, (d) Evaluation ob beide Exit-Codes 0 sind

6) GIVEN die Datei `.claude/agents/slice-impl-coordinator.md`
   WHEN die Phase 2c Section gelesen wird und Lint oder TypeCheck fehlschlaegt
   THEN wird Task(slice-implementer) mit den Fehlermeldungen aufgerufen und ein Re-Check durchgefuehrt, maximal 3 Retries

7) GIVEN die Datei `.claude/agents/slice-impl-coordinator.md`
   WHEN die Phase 2c Section gelesen wird und nach 3 Retries Lint/TypeCheck noch fehlschlaegt
   THEN wird ein HARD EXIT ausgefuehrt mit `status: "failed"` und `error: "lint/typecheck: persistent failures after 3 retries"`

8) GIVEN die Datei `.claude/agents/slice-impl-coordinator.md`
   WHEN die Phase 2c Section gelesen wird und detected_stack.stack_name == "unknown"
   THEN wird das Deterministic Gate uebersprungen mit einer Warning (kein Failure)

9) GIVEN die Datei `.claude/agents/slice-impl-coordinator.md`
   WHEN die Phase 4 Section (Validation) gelesen wird
   THEN enthaelt der test-validator Task()-Prompt eine `## Stack Info` Section mit detected_stack.stack_name, detected_stack.test_cmd, detected_stack.start_cmd, detected_stack.health_endpoint

10) GIVEN die Datei `.claude/agents/slice-impl-coordinator.md`
    WHEN die Fehlermeldungen an den Implementer uebergeben werden
    THEN werden Lint-Errors und Type-Errors jeweils auf maximal 2000 Zeichen truncated

---

## Testfaelle

**WICHTIG:** Da dieser Slice eine Agent-Definition (.md Datei) modifiziert und keinen ausfuehrbaren Code, sind die Tests manuell. Die Test-Spec beschreibt, wie die modifizierte Agent-Definition validiert werden kann.

### Test-Datei

**Konvention:** Manuelle Validierung -- keine automatisierte Test-Datei

**Fuer diesen Slice:** Manuelle Pruefung der `.claude/agents/slice-impl-coordinator.md` Datei

### Manuelle Tests

<test_spec>
```markdown
# Manuelle Test-Prozedur fuer slice-impl-coordinator.md (Deterministic Gate)

## Test 1: Frontmatter-Validierung
1. Oeffne `.claude/agents/slice-impl-coordinator.md`
2. Pruefe YAML Frontmatter zwischen `---` Markern
3. Erwartung:
   - `tools:` enthaelt `Read, Write, Glob, Grep, Task, Bash`
   - `Bash` ist NEU gegenueber dem vorherigen Stand (`Read, Write, Glob, Grep, Task`)

## Test 2: Phase 1a Stack-Detection vorhanden
1. Suche nach "Phase 1a" oder "Stack Detection" Section
2. Pruefe ob folgende 10 Stacks abgedeckt sind:
   - Python/FastAPI (via pyproject.toml)
   - Python/FastAPI (via requirements.txt)
   - Python/Django (via pyproject.toml)
   - TypeScript/Next.js (via package.json + next)
   - TypeScript/Nuxt (via package.json + nuxt)
   - TypeScript/Vue 3 (via package.json + vue ^3)
   - JavaScript/Vue 2 (via package.json + vue ^2)
   - TypeScript/Express (via package.json + express)
   - PHP/Laravel (via composer.json)
   - Go (via go.mod)

## Test 3: detected_stack Objekt-Vollstaendigkeit
1. Pruefe ob fuer jeden Stack ein detected_stack Objekt definiert ist
2. Erwartung: Jedes Objekt hat die Felder:
   - stack_name
   - lint_autofix_cmd
   - lint_check_cmd
   - typecheck_cmd
   - test_cmd
   - start_cmd
   - health_endpoint

## Test 4: Unknown-Stack-Fallback
1. Suche nach der Fallback-Logik fuer unbekannten Stack
2. Erwartung:
   - Warning wird geloggt
   - detected_stack.stack_name = "unknown"
   - Deterministic Gate wird uebersprungen

## Test 5: Phase 2c Deterministic Gate vorhanden
1. Suche nach "Phase 2c" oder "Deterministic Gate" Section
2. Pruefe ob folgende Schritte beschrieben sind:
   - Lint Auto-Fix (Exit-Code ignoriert)
   - Lint Check (Exit-Code relevant)
   - Type Check (Exit-Code relevant)
   - Evaluation: Beide exit_code == 0 -> PASS

## Test 6: Fix-Loop mit max 3 Retries
1. Pruefe ob ein Retry-Loop definiert ist
2. Erwartung:
   - MAX_LINT_RETRIES = 3
   - Bei Failure: Task(slice-implementer) mit Fehlermeldungen
   - Re-Check nach Fix
   - HARD EXIT nach 3 Retries mit status "failed"

## Test 7: Error-Output Truncation
1. Pruefe ob Fehlermeldungen an den Implementer truncated werden
2. Erwartung: max 2000 Zeichen pro Output (Lint-Errors und Type-Errors separat)

## Test 8: detected_stack Weitergabe
1. Pruefe ob test-validator Task()-Prompt eine "Stack Info" Section enthaelt
2. Erwartung: stack_name, test_cmd, start_cmd, health_endpoint werden mitgegeben

## Test 9: Go-Stack ohne Auto-Fix
1. Pruefe ob bei Go-Stack lint_autofix_cmd leer ist
2. Erwartung: Auto-Fix-Step wird uebersprungen wenn lint_autofix_cmd leer
```
</test_spec>

---

## Definition of Done

- [x] Akzeptanzkriterien sind eindeutig & vollstaendig
- [x] Telemetrie/Logging definiert (Warning bei unknown Stack, HARD EXIT bei persistent failures)
- [x] Sicherheits-/Privacy-Aspekte bedacht (Bash nur fuer spezifische Lint/TypeCheck Commands)
- [ ] UX/Copy final -- N/A (kein UI)
- [ ] Rollout-/Rollback-Plan -- Bash-Tool kann aus Frontmatter entfernt werden, Phase 1a/2c Sections koennen geloescht werden

---

## Deliverables (SCOPE SAFEGUARD)

**WICHTIG: Diese Liste wird automatisch vom Stop-Hook validiert. Der Agent kann nicht stoppen, wenn Dateien fehlen.**

<!-- DELIVERABLES_START -->
### Agent-Definition (Modifikation)
- [ ] `.claude/agents/slice-impl-coordinator.md` -- Modifikation: (1) Frontmatter um `Bash` erweitert, (2) Neue Phase 1a Section: Stack-Detection mit Indicator-File-Pruefung fuer 10 Stacks und detected_stack Objekt, (3) Neue Phase 2c Section: Deterministic Gate mit Lint-Auto-Fix + Lint-Check + TypeCheck + Fix-Loop (max 3 Retries) + HARD EXIT, (4) Phase 4 Anpassung: detected_stack Weitergabe im test-validator Task()-Prompt
<!-- DELIVERABLES_END -->

**Hinweis fuer den Implementierungs-Agent:**
- Alle Dateien zwischen `<!-- DELIVERABLES_START -->` und `<!-- DELIVERABLES_END -->` sind **Pflicht**
- Der Stop-Hook prueft automatisch ob alle Dateien existieren
- Bei fehlenden Dateien wird der Agent blockiert und muss nachfragen
