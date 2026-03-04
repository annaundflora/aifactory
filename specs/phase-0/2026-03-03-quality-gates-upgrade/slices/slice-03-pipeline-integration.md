# Slice 3: Pipeline Integration

> **Slice 3 von 4** fuer `Quality Gates Upgrade`
>
> | Navigation | |
> |------------|---|
> | **Vorheriger:** | `slice-02-deterministic-pre-test-gate.md` |
> | **Naechster:** | `slice-04-chrome-devtools-smoke.md` |

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-03-pipeline-integration` |
| **Test** | `Manuell: Pruefe dass slice-impl-coordinator.md die 6-Step Pipeline mit Phase 1a, 2, 2b, 2c, 3, 4 enthaelt` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-code-reviewer-agent", "slice-02-deterministic-pre-test-gate"]` |

**Erklaerung:**
- **ID**: Eindeutiger Identifier fuer Commits und Evidence
- **Test**: Manuelle Validierung -- Agent-Definitionen sind .md Dateien, kein ausfuehrbarer Code
- **E2E**: false -- keine Playwright-Tests
- **Dependencies**: Benoetigt Slice 1 (code-reviewer Agent-Definition) und Slice 2 (Stack-Detection + Deterministic Gate Logik)

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Manuell bestimmt. Dieses Feature modifiziert Agent-Definitionen (.md Dateien), keine Webanwendung.

| Key | Value |
|-----|-------|
| **Stack** | `agent-definitions` (kein klassischer App-Stack) |
| **Test Command** | `Manuell: Lies slice-impl-coordinator.md und pruefe 6-Step Pipeline, Phase 2b Code-Review Loop, Phase-Reihenfolge` |
| **Integration Command** | `Manuell: Pruefe dass Phase 2b den code-reviewer Agent korrekt aufruft und Phase 2c die Deterministic-Gate-Logik aus Slice 2 nutzt` |
| **Acceptance Command** | `Manuell: Simuliere Pipeline-Durchlauf mit Test-Slice, pruefe ob Code-Review + Lint/TypeCheck korrekt vor Test-Writer laufen` |
| **Start Command** | `N/A` |
| **Health Endpoint** | `N/A` |
| **Mocking Strategy** | `no_mocks` |

**Erklaerung:**
- Kein klassischer Test-Stack, da nur Agent-Definitionen (.md Dateien) modifiziert werden
- Validierung erfolgt durch manuelle Pruefung der modifizierten .md Datei
- Funktionale Validierung durch Ausfuehrung der Pipeline mit einem Test-Slice

---

## Slice-Uebersicht

| # | Slice | Status | Datei |
|---|-------|--------|-------|
| 1 | Code Reviewer Agent | Ready | `slice-01-code-reviewer-agent.md` |
| 2 | Deterministic Pre-Test Gate | Ready | `slice-02-deterministic-pre-test-gate.md` |
| 3 | Pipeline Integration | Ready | `slice-03-pipeline-integration.md` |
| 4 | Chrome DevTools Smoke Test | Pending | `slice-04-chrome-devtools-smoke.md` |

---

## Kontext & Ziel

Der slice-impl-coordinator hat aktuell eine 4-Step Pipeline: Implementer, Test-Writer, Test-Validator, Debugger. Slice 1 hat den code-reviewer Agent definiert, Slice 2 hat die Stack-Detection (Phase 1a) und den Deterministic Gate (Phase 2c) als Logik-Bloecke spezifiziert. Dieser Slice 3 integriert beides in die Pipeline und erweitert sie auf 6 Steps.

**Aktuelle Probleme:**
1. Die 4-Step Pipeline ueberspringt Code-Review komplett -- Code geht direkt vom Implementer zum Test-Writer
2. Die in Slice 2 definierten Phasen (1a Stack-Detection, 2c Deterministic Gate) sind als Logik spezifiziert, aber noch nicht in die Pipeline-Reihenfolge eingebaut
3. Es fehlt Phase 2b (Code-Review Loop) komplett im Coordinator -- der code-reviewer Agent aus Slice 1 wird nie aufgerufen

**Zielbild:**
- Pipeline erweitert von 4-Step auf 6-Step:
  - Phase 1 (Dokumente laden) bleibt
  - Phase 1a (Stack-Detection, aus Slice 2) bleibt
  - Phase 2 (Implementation) bleibt
  - Phase 2b (Code-Review Loop, NEU in diesem Slice): Task(code-reviewer) mit Fix-Loop max 3
  - Phase 2c (Deterministic Gate, aus Slice 2) bleibt
  - Phase 3 (Test-Erstellung) bleibt
  - Phase 4 (Validation + Debug Loop) bleibt
  - Phase 5 (Evidence) erweitert um Review- und Lint-Daten
  - Phase 6 (JSON Output) erweitert um Review- und Lint-Felder

---

## Technische Umsetzung

### Architektur-Kontext (aus architecture.md)

> **Quelle:** `architecture.md` -> Business Logic Flow + Data Flow + Migration Map

```
stack-detection -> slice-implementer -> code-reviewer -> [fix loop max 3] -> deterministic-gate -> [fix loop max 3] -> test-writer -> test-validator -> [debug loop max 9]
```

Detaillierter Data Flow:

```
/build Command
  |-- Task(slice-impl-coordinator)
        |-- Phase 1: Dokumente laden (unveraendert)
        |-- Phase 1a: Stack Detection (aus Slice 2)
        |-- Phase 2: Task(slice-implementer) -> Code + Commit
        |
        |-- Phase 2b: Task(code-reviewer)     <- git diff, slice-spec   [NEU]
        |   |-- Returns: {verdict, findings[]}
        |   |-- IF REJECTED -> Task(slice-implementer) + findings -> loop (max 3)
        |
        |-- Phase 2c: Bash(lint + typecheck)  (aus Slice 2)
        |   |-- IF failure -> Task(slice-implementer) + errors -> loop (max 3)
        |
        |-- Phase 3: Task(test-writer) -> test files
        |
        |-- Phase 4: Task(test-validator) + Task(debugger) loop (max 9)
        |
        |-- Phase 5: Evidence (erweitert um review + lint Daten)
        |-- Phase 6: JSON Output (erweitert)
```

### 1. Architektur-Impact

| Layer | Aenderungen |
|-------|-------------|
| `.claude/agents/slice-impl-coordinator.md` | Neue Phase 2b (Code-Review Loop) einfuegen zwischen Phase 2 und Phase 2c. Description-Update auf 6-Step. Rolle-Section auf 6-Step aktualisieren. Evidence um review_verdict und lint_status erweitern. JSON Output um review_iterations und lint_iterations erweitern. |

### 2. Datenfluss

```
Phase 2: Task(slice-implementer) -> impl_json {status, files_changed, commit_hash}
  |
  v
Phase 2b: Code Review Loop (NEU)
  Task(code-reviewer) mit:
    - slice_id, slice_file_path, architecture_path, working_dir
    - Stack Info (detected_stack.stack_name)
  |
  v
  review_json = {verdict, findings[], summary}
  |
  IF verdict == "APPROVED" oder "CONDITIONAL" -> Phase 2c
  IF verdict == "REJECTED":
    review_retries++
    IF review_retries < 3:
      Task(slice-implementer) mit findings -> Re-Commit
      Task(code-reviewer) -> Re-Review
    IF review_retries >= 3:
      HARD EXIT {status: "failed", error: "code-review: unresolved CRITICAL issues after 3 retries"}
  |
  v
Phase 2c: Deterministic Gate (aus Slice 2, unveraendert)
  |
  v
Phase 3: Task(test-writer) -> tests
```

### 3. Neue Phase 2b: Code-Review Loop (Kern dieses Slices)

Die folgende Logik wird als neue "Phase 2b: Code Review" Section in `slice-impl-coordinator.md` eingefuegt, NACH Phase 2 (Implementation) und VOR Phase 2c (Deterministic Gate).

**Pseudocode:**

```
Phase 2b: Code Review

review_retries = 0
MAX_REVIEW_RETRIES = 3

WHILE review_retries < MAX_REVIEW_RETRIES:

  Task(
    subagent_type: "code-reviewer",
    description: "Review Code for {slice_id} (Attempt {review_retries + 1})",
    prompt: "
      Review Code fuer Slice: {slice_id}

      ## Stack Info (detected by Coordinator)
      Stack: {detected_stack.stack_name}

      ## Input
      - Slice-Spec: {spec_path}/slices/{slice_file}
      - Architecture: {architecture_path}
      - Working-Dir: {working_dir}

      ## Anweisungen
      1. Lies die Slice-Spec (Deliverables, ACs, Code Examples)
      2. Lies architecture.md (Patterns, Conventions)
      3. Fuehre git diff HEAD~1 im Working-Dir aus
      4. Analysiere gegen: Spec-Compliance, Architecture-Compliance, Code-Quality, Anti-Patterns
      5. Kategorisiere Findings nach Severity (CRITICAL/HIGH/MEDIUM/LOW)
      6. Gib JSON zurueck

      ## Output
      Gib am Ende ein JSON zurueck:
      ```json
      {
        \"verdict\": \"APPROVED | CONDITIONAL | REJECTED\",
        \"findings\": [
          {
            \"severity\": \"CRITICAL | HIGH | MEDIUM | LOW\",
            \"file\": \"path/to/file\",
            \"line\": 42,
            \"message\": \"Issue description\",
            \"fix_suggestion\": \"How to fix\"
          }
        ],
        \"summary\": \"N CRITICAL, N HIGH, N MEDIUM issues found\"
      }
      ```
    "
  )

  review_json = parse_last_json_block(task_output)

  IF parse_failure:
    RETURN {
      "status": "failed",
      "retries": review_retries,
      "evidence": {"files_changed": files_changed, "test_files": [], "test_count": 0, "commit_hash": commit_hash},
      "error": "JSON parse failure from code-reviewer"
    }

  # Verdict-Auswertung
  IF review_json.verdict == "APPROVED":
    LOG: "Code Review APPROVED -- keine Issues"
    BREAK  # Weiter zu Phase 2c

  IF review_json.verdict == "CONDITIONAL":
    LOG: "Code Review CONDITIONAL -- {review_json.summary} (Warnings geloggt, Pipeline laeuft weiter)"
    # Speichere Warnings fuer Evidence
    review_warnings = review_json.findings
    BREAK  # Weiter zu Phase 2c

  IF review_json.verdict == "REJECTED":
    review_retries++
    LOG: "Code Review REJECTED -- {review_json.summary} (Retry {review_retries}/{MAX_REVIEW_RETRIES})"

    IF review_retries < MAX_REVIEW_RETRIES:
      # Formatiere Findings fuer den Implementer
      findings_text = ""
      FOR finding IN review_json.findings:
        IF finding.severity == "CRITICAL":
          findings_text += "CRITICAL [{finding.file}:{finding.line}]: {finding.message}\n"
          findings_text += "  Fix: {finding.fix_suggestion}\n\n"

      Task(
        subagent_type: "slice-implementer",
        description: "Fix code review issues for {slice_id} (Retry {review_retries})",
        prompt: "
          Fixe Code-Review Issues fuer Slice: {slice_id}

          ## Code Review Findings (CRITICAL -- muessen gefixt werden)
          {findings_text}

          ## Input-Dateien (MUSS gelesen werden)
          - Slice-Spec: {spec_path}/slices/{slice_file}
          - Architecture: {architecture_path}

          ## Anweisungen
          1. Lies die CRITICAL Findings oben
          2. Fixe ALLE CRITICAL Issues
          3. HIGH/MEDIUM/LOW Issues sind Warnings -- fixe sie wenn moeglich, aber sie blockieren nicht
          4. Committe den Fix mit Message: 'fix({slice_id}): code review issues (retry {review_retries})'

          ## Output
          Gib am Ende ein JSON zurueck:
          ```json
          {
            \"status\": \"fixed | unable_to_fix\",
            \"files_changed\": [\"pfad/zur/datei\"],
            \"fixes_applied\": \"Beschreibung der Fixes\"
          }
          ```
        "
      )

      fix_json = parse_last_json_block(task_output)

      IF parse_failure OR fix_json.status == "unable_to_fix":
        RETURN {
          "status": "failed",
          "retries": review_retries,
          "evidence": {"files_changed": files_changed, "test_files": [], "test_count": 0, "commit_hash": commit_hash},
          "error": "code-review: implementer unable to fix CRITICAL issues after {review_retries} retries"
        }

      # Merge files_changed
      files_changed = merge(files_changed, fix_json.files_changed)
      CONTINUE  # Re-Review

# Max Retries erreicht
IF review_retries >= MAX_REVIEW_RETRIES:
  RETURN {
    "status": "failed",
    "retries": review_retries,
    "evidence": {"files_changed": files_changed, "test_files": [], "test_count": 0, "commit_hash": commit_hash},
    "error": "code-review: unresolved CRITICAL issues after {MAX_REVIEW_RETRIES} retries"
  }
```

### 4. Rolle-Section Update

Aktuelle Rolle-Section:

```
Du koordinierst die vollstaendige Sub-Agent-Pipeline fuer einen Slice:
1. Task(slice-implementer) -- schreibt Code
2. Task(test-writer) -- schreibt Tests
3. Task(test-validator) -- validiert Tests
4. Task(debugger) -- fixt Fehler (bei Test-Failure)
5. Loopst Step 3+4 bis max 9 Retries
6. Schreibst Evidence-Datei auf Disk
7. Gibst kompaktes JSON-Ergebnis zurueck (~300 Tokens)
```

Neue Rolle-Section:

```
Du koordinierst die vollstaendige Sub-Agent-Pipeline fuer einen Slice:
1. Stack-Detection -- erkennt den Tech-Stack des Projekts (Phase 1a)
2. Task(slice-implementer) -- schreibt Code (Phase 2)
3. Task(code-reviewer) -- reviewt Code gegen Spec + Architecture (Phase 2b)
4. Deterministic Gate -- Lint/TypeCheck via Bash (Phase 2c)
5. Task(test-writer) -- schreibt Tests (Phase 3)
6. Task(test-validator) -- validiert Tests (Phase 4)
7. Task(debugger) -- fixt Fehler bei Test-Failure (Phase 4)
8. Loopst Step 6+7 bis max 9 Retries
9. Schreibst Evidence-Datei auf Disk (Phase 5)
10. Gibst kompaktes JSON-Ergebnis zurueck (~300 Tokens) (Phase 6)
```

### 5. Description-Update im Frontmatter

Aktuelle Description:

```yaml
description: "Ebene-1 Coordinator: Implementiert + testet 1 Slice via Task(slice-implementer) + Task(test-writer) + Task(test-validator) + Task(debugger). Retry-Loop (max 9). Returns JSON."
```

Neue Description:

```yaml
description: "Ebene-1 Coordinator: Implementiert + testet 1 Slice via Task(slice-implementer) + Task(code-reviewer) + Deterministic Gate (Lint/TypeCheck) + Task(test-writer) + Task(test-validator) + Task(debugger). Stack-Detection + Code-Review Loop (max 3) + Lint/TypeCheck Loop (max 3) + Debug Loop (max 9). Returns JSON."
```

### 6. Evidence-Erweiterung (Phase 5)

Aktuelle Evidence-Felder:

```json
{
  "slice_id": "{slice_id}",
  "status": "completed",
  "retries": 1,
  "files_changed": ["..."],
  "test_files": ["..."],
  "test_count": 12,
  "commit_hash": "abc123",
  "stages": {"unit": {...}, "integration": {...}, "acceptance": {...}, "smoke": {...}},
  "timestamp": "2026-03-04T..."
}
```

Neue Evidence-Felder (erweitert):

```json
{
  "slice_id": "{slice_id}",
  "status": "completed",
  "retries": 1,
  "files_changed": ["..."],
  "test_files": ["..."],
  "test_count": 12,
  "commit_hash": "abc123",
  "stages": {"unit": {...}, "integration": {...}, "acceptance": {...}, "smoke": {...}},
  "detected_stack": "Python/FastAPI",
  "review": {
    "verdict": "APPROVED | CONDITIONAL",
    "iterations": 0,
    "findings_count": {"critical": 0, "high": 1, "medium": 2, "low": 0},
    "warnings": []
  },
  "deterministic_gate": {
    "lint_status": "passed",
    "typecheck_status": "passed",
    "iterations": 0
  },
  "timestamp": "2026-03-04T..."
}
```

### 7. JSON Output Erweiterung (Phase 6)

Aktuelles JSON Output:

```json
{
  "status": "completed",
  "retries": 1,
  "evidence": {
    "files_changed": ["..."],
    "test_files": ["..."],
    "test_count": 12,
    "commit_hash": "abc123"
  },
  "error": null
}
```

Neues JSON Output (erweitert):

```json
{
  "status": "completed",
  "retries": 1,
  "evidence": {
    "files_changed": ["..."],
    "test_files": ["..."],
    "test_count": 12,
    "commit_hash": "abc123",
    "review_iterations": 0,
    "review_verdict": "APPROVED",
    "lint_iterations": 0,
    "detected_stack": "Python/FastAPI"
  },
  "error": null
}
```

### 8. Pipeline-Reihenfolge im Coordinator-Dokument

Die Phasen im `slice-impl-coordinator.md` muessen in folgender Reihenfolge stehen:

| Position | Phase | Herkunft | Aenderung in diesem Slice |
|----------|-------|----------|---------------------------|
| 1 | Phase 1: Dokumente laden | Bestehend | Unveraendert |
| 2 | Phase 1a: Stack Detection | Slice 2 | Unveraendert (bereits durch Slice 2 eingefuegt) |
| 3 | Phase 2: Implementation | Bestehend | Unveraendert |
| 4 | Phase 2b: Code Review | **NEU in diesem Slice** | Komplett neue Section |
| 5 | Phase 2c: Deterministic Gate | Slice 2 | Unveraendert (bereits durch Slice 2 eingefuegt) |
| 6 | Phase 3: Test-Erstellung | Bestehend | Unveraendert |
| 7 | Phase 4: Validation + Debug Loop | Bestehend | Unveraendert |
| 8 | Phase 5: Evidence | Bestehend | Erweitert um review + lint Felder |
| 9 | Phase 6: JSON Output | Bestehend | Erweitert um review + lint Felder |

---

## Constraints & Hinweise

**Betrifft:**
- Nur `.claude/agents/slice-impl-coordinator.md` -- Modifikation einer bestehenden Agent-Definition

**Abgrenzung:**
- KEIN ausfuehrbarer Code -- nur eine .md Datei mit Agent-Anweisungen wird modifiziert
- KEINE Aenderung an `code-reviewer.md` (bereits durch Slice 1 definiert)
- KEINE Aenderung an `test-validator.md` (wird erst in Slice 4 erweitert)
- KEINE neue Stack-Detection-Logik -- nutzt die in Slice 2 definierte Phase 1a
- KEINE neue Deterministic-Gate-Logik -- nutzt die in Slice 2 definierte Phase 2c
- Phase 2b ist die EINZIGE komplett neue Logik in diesem Slice
- Rolle-Section und Description-Update sind Pflicht-Anpassungen fuer Konsistenz

**Architecture Contract:**
- Code-Review Loop MUSS max 3 Retries haben (aus architecture.md)
- Verdict-Logik MUSS dem Contract aus architecture.md folgen: APPROVED (weiter), CONDITIONAL (weiter mit Warnings), REJECTED (Fix-Loop)
- Nur CRITICAL Findings blockieren die Pipeline (aus architecture.md)
- Code-Reviewer wird via Task() mit frischem Context aufgerufen (aus architecture.md -- Anti-Rubber-Stamping)
- Evidence MUSS review_verdict und lint_status enthalten (aus architecture.md)
- Der Coordinator ruft `code-reviewer` als Sub-Agent auf -- er fuehrt KEIN Review selbst durch

---

## Integration Contract (GATE 2 PFLICHT)

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-01-code-reviewer-agent | `.claude/agents/code-reviewer.md` | Agent-Definition | Datei existiert, hat YAML Frontmatter mit `name: code-reviewer` |
| slice-01-code-reviewer-agent | JSON Output Contract | Data Contract | `{verdict: string, findings: Finding[], summary: string}` |
| slice-01-code-reviewer-agent | Verdict-Logik | Business Rule | APPROVED/CONDITIONAL = weiter, REJECTED = Fix-Loop |
| slice-02-deterministic-pre-test-gate | Bash-Tool im Coordinator Frontmatter | Tool-Zugriff | `tools:` Feld enthaelt `Bash` |
| slice-02-deterministic-pre-test-gate | Phase 1a: Stack-Detection-Logik | Pipeline-Phase | `detected_stack` Objekt verfuegbar nach Phase 1a |
| slice-02-deterministic-pre-test-gate | Phase 2c: Deterministic Gate Loop | Pipeline-Phase | Lint/TypeCheck mit Fix-Loop (max 3) |
| slice-02-deterministic-pre-test-gate | detected_stack Weitergabe-Pattern | Prompt-Template | `## Stack Info` Section im Task()-Prompt |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| 6-Step Pipeline | Pipeline-Struktur | Slice 4 (Chrome DevTools Smoke) | Phase 4 (Validation) als Erweiterungs-Punkt fuer Smoke Test |
| Evidence mit review + lint Feldern | Data Contract | Alle Consumers von Evidence-Dateien | `review.verdict`, `review.iterations`, `deterministic_gate.lint_status` im Evidence JSON |
| JSON Output mit review + lint Feldern | Data Contract | `/build` Command | `review_iterations`, `review_verdict`, `lint_iterations`, `detected_stack` im Output JSON |

### Integration Validation Tasks

- [ ] Phase 2b steht NACH Phase 2 und VOR Phase 2c im Coordinator-Dokument
- [ ] Task()-Prompt fuer code-reviewer enthaelt alle 4 Pflicht-Parameter: slice_id, slice_file_path, architecture_path, working_dir
- [ ] Task()-Prompt fuer code-reviewer enthaelt `## Stack Info` Section mit detected_stack.stack_name
- [ ] Verdict-Auswertung unterscheidet korrekt zwischen APPROVED (weiter), CONDITIONAL (weiter mit Warnings), REJECTED (Fix-Loop)
- [ ] Fix-Loop ruft Task(slice-implementer) mit formatierten CRITICAL Findings auf
- [ ] Max 3 Review-Retries, danach HARD EXIT
- [ ] Evidence enthaelt review und deterministic_gate Felder
- [ ] JSON Output enthaelt review_iterations, review_verdict, lint_iterations, detected_stack
- [ ] Rolle-Section listet alle 6+ Steps auf
- [ ] Description im Frontmatter nennt code-reviewer und Deterministic Gate

---

## Code Examples (MANDATORY - GATE 2 PFLICHT)

> **KRITISCH:** Alle Code-Beispiele in diesem Dokument sind **PFLICHT-Deliverables**.
> Der Gate 2 Compliance Agent prueft, dass jedes Code-Beispiel implementiert wird.

| Code Example | Section | Mandatory | Notes |
|--------------|---------|-----------|-------|
| Phase 2b Code-Review Loop Pseudocode | Technische Umsetzung > 3. Neue Phase 2b | YES | Kompletter Loop mit Task(code-reviewer), Verdict-Auswertung, Task(slice-implementer) Fix, max 3 Retries |
| Neue Rolle-Section | Technische Umsetzung > 4. Rolle-Section Update | YES | Alle 10 Steps auflisten |
| Neue Description im Frontmatter | Technische Umsetzung > 5. Description-Update | YES | Muss code-reviewer und Deterministic Gate nennen |
| Erweiterte Evidence-Felder | Technische Umsetzung > 6. Evidence-Erweiterung | YES | review und deterministic_gate Objekte |
| Erweitertes JSON Output | Technische Umsetzung > 7. JSON Output Erweiterung | YES | review_iterations, review_verdict, lint_iterations, detected_stack |

---

## Acceptance Criteria

1) GIVEN die Datei `.claude/agents/slice-impl-coordinator.md`
   WHEN die Rolle-Section gelesen wird
   THEN listet sie die vollstaendige 6-Step Pipeline auf: Stack-Detection, Implementer, Code-Reviewer, Deterministic Gate, Test-Writer, Test-Validator/Debugger

2) GIVEN die Datei `.claude/agents/slice-impl-coordinator.md`
   WHEN das YAML Frontmatter gelesen wird
   THEN enthaelt die `description` die Begriffe "code-reviewer" und "Deterministic Gate" und "Stack-Detection"

3) GIVEN die Datei `.claude/agents/slice-impl-coordinator.md`
   WHEN die Phase 2b Section gelesen wird
   THEN beschreibt sie einen Code-Review Loop mit: (a) Task(code-reviewer) Aufruf mit slice_id, slice_file_path, architecture_path, working_dir, (b) JSON-Parsing der Antwort, (c) Verdict-Auswertung

4) GIVEN die Datei `.claude/agents/slice-impl-coordinator.md`
   WHEN die Phase 2b Section gelesen wird und der code-reviewer APPROVED zurueckgibt
   THEN laeuft die Pipeline ohne Aenderung weiter zu Phase 2c

5) GIVEN die Datei `.claude/agents/slice-impl-coordinator.md`
   WHEN die Phase 2b Section gelesen wird und der code-reviewer CONDITIONAL zurueckgibt
   THEN werden die Findings als Warnings in der Evidence gespeichert und die Pipeline laeuft weiter zu Phase 2c

6) GIVEN die Datei `.claude/agents/slice-impl-coordinator.md`
   WHEN die Phase 2b Section gelesen wird und der code-reviewer REJECTED zurueckgibt
   THEN wird Task(slice-implementer) mit den CRITICAL Findings aufgerufen und anschliessend Task(code-reviewer) erneut aufgerufen (Re-Review)

7) GIVEN die Datei `.claude/agents/slice-impl-coordinator.md`
   WHEN die Phase 2b Section gelesen wird und der code-reviewer nach 3 Retries immer noch REJECTED zurueckgibt
   THEN wird ein HARD EXIT ausgefuehrt mit `status: "failed"` und `error: "code-review: unresolved CRITICAL issues after 3 retries"`

8) GIVEN die Datei `.claude/agents/slice-impl-coordinator.md`
   WHEN die Phase 2b Section gelesen wird
   THEN steht Phase 2b physisch NACH Phase 2 (Implementation) und VOR Phase 2c (Deterministic Gate) im Dokument

9) GIVEN die Datei `.claude/agents/slice-impl-coordinator.md`
   WHEN die Phase 2b Section gelesen wird
   THEN enthaelt der Task()-Prompt fuer code-reviewer eine `## Stack Info` Section mit detected_stack.stack_name

10) GIVEN die Datei `.claude/agents/slice-impl-coordinator.md`
    WHEN die Phase 5 Section (Evidence) gelesen wird
    THEN enthaelt das Evidence-JSON die Felder `review.verdict`, `review.iterations`, `review.findings_count` und `deterministic_gate.lint_status`, `deterministic_gate.typecheck_status`, `deterministic_gate.iterations`

11) GIVEN die Datei `.claude/agents/slice-impl-coordinator.md`
    WHEN die Phase 6 Section (JSON Output) gelesen wird
    THEN enthaelt das Output-JSON die Felder `review_iterations`, `review_verdict`, `lint_iterations`, `detected_stack` im evidence-Objekt

12) GIVEN die Datei `.claude/agents/slice-impl-coordinator.md`
    WHEN die Pipeline-Phasen gezaehlt werden
    THEN gibt es mindestens 6 Phasen: Phase 1 (Dokumente laden), Phase 1a (Stack Detection), Phase 2 (Implementation), Phase 2b (Code Review), Phase 2c (Deterministic Gate), Phase 3 (Test-Erstellung), Phase 4 (Validation + Debug Loop)

---

## Testfaelle

**WICHTIG:** Da dieser Slice eine Agent-Definition (.md Datei) modifiziert und keinen ausfuehrbaren Code, sind die Tests manuell. Die Test-Spec beschreibt, wie die modifizierte Agent-Definition validiert werden kann.

### Test-Datei

**Konvention:** Manuelle Validierung -- keine automatisierte Test-Datei

**Fuer diesen Slice:** Manuelle Pruefung der `.claude/agents/slice-impl-coordinator.md` Datei

### Manuelle Tests

<test_spec>
```markdown
# Manuelle Test-Prozedur fuer slice-impl-coordinator.md (Pipeline Integration)

## Test 1: Frontmatter Description Update
1. Oeffne `.claude/agents/slice-impl-coordinator.md`
2. Pruefe YAML Frontmatter
3. Erwartung:
   - `description:` enthaelt "code-reviewer"
   - `description:` enthaelt "Deterministic Gate" oder "Lint/TypeCheck"
   - `description:` enthaelt "Stack-Detection"

## Test 2: Rolle-Section Update
1. Suche nach der Rolle-Section
2. Pruefe ob alle Pipeline-Steps aufgelistet sind:
   - Stack-Detection (Phase 1a)
   - Task(slice-implementer) (Phase 2)
   - Task(code-reviewer) (Phase 2b)
   - Deterministic Gate / Lint/TypeCheck (Phase 2c)
   - Task(test-writer) (Phase 3)
   - Task(test-validator) (Phase 4)
   - Task(debugger) (Phase 4)

## Test 3: Phase 2b Section vorhanden
1. Suche nach "Phase 2b" oder "Code Review" Section
2. Pruefe Position: NACH Phase 2, VOR Phase 2c
3. Erwartung: Section existiert und ist korrekt platziert

## Test 4: Task(code-reviewer) Prompt
1. Pruefe den Task()-Prompt fuer code-reviewer in Phase 2b
2. Erwartung:
   - Enthaelt slice_id
   - Enthaelt slice_file_path (Pfad zur Slice-Spec)
   - Enthaelt architecture_path
   - Enthaelt working_dir
   - Enthaelt "## Stack Info" Section mit detected_stack.stack_name

## Test 5: Verdict-Auswertung APPROVED
1. Pruefe die Verdict-Auswertung in Phase 2b
2. Erwartung bei APPROVED:
   - Pipeline laeuft weiter zu Phase 2c
   - Kein Fix-Loop

## Test 6: Verdict-Auswertung CONDITIONAL
1. Pruefe die Verdict-Auswertung in Phase 2b
2. Erwartung bei CONDITIONAL:
   - Warnings werden gespeichert fuer Evidence
   - Pipeline laeuft weiter zu Phase 2c
   - Kein Fix-Loop

## Test 7: Verdict-Auswertung REJECTED + Fix-Loop
1. Pruefe die Verdict-Auswertung in Phase 2b
2. Erwartung bei REJECTED:
   - Task(slice-implementer) wird mit CRITICAL Findings aufgerufen
   - Task(code-reviewer) wird erneut aufgerufen (Re-Review)
   - Max 3 Retries

## Test 8: HARD EXIT nach max Retries
1. Pruefe das Verhalten nach 3 fehlgeschlagenen Review-Retries
2. Erwartung:
   - HARD EXIT mit status: "failed"
   - error enthaelt "code-review: unresolved CRITICAL issues after 3 retries"

## Test 9: Evidence-Erweiterung
1. Suche nach der Evidence Section (Phase 5)
2. Pruefe ob folgende Felder im Evidence-JSON enthalten sind:
   - review.verdict
   - review.iterations
   - review.findings_count
   - deterministic_gate.lint_status
   - deterministic_gate.typecheck_status
   - deterministic_gate.iterations
   - detected_stack

## Test 10: JSON Output Erweiterung
1. Suche nach der JSON Output Section (Phase 6)
2. Pruefe ob folgende Felder im evidence-Objekt des Output-JSON enthalten sind:
   - review_iterations
   - review_verdict
   - lint_iterations
   - detected_stack

## Test 11: Pipeline-Reihenfolge
1. Scrolle durch das gesamte Dokument
2. Pruefe dass die Phasen in korrekter Reihenfolge stehen:
   - Phase 1 (Dokumente laden)
   - Phase 1a (Stack Detection)
   - Phase 2 (Implementation)
   - Phase 2b (Code Review) <-- NEU
   - Phase 2c (Deterministic Gate)
   - Phase 3 (Test-Erstellung)
   - Phase 4 (Validation + Debug Loop)
   - Phase 5 (Evidence)
   - Phase 6 (JSON Output)

## Test 12: Funktionaler Pipeline-Test (nach Implementation)
1. Erstelle einen Test-Slice mit bewussten Lint-Fehlern (z.B. unused variable)
2. Fuehre die Pipeline aus
3. Pruefe:
   a. Phase 2b: code-reviewer wird aufgerufen und gibt REJECTED zurueck (wegen Code-Quality)
   b. slice-implementer wird mit Findings aufgerufen
   c. code-reviewer wird erneut aufgerufen (Re-Review)
   d. Phase 2c: Lint-Fehler werden erkannt
   e. Pipeline stoppt oder fixt die Fehler
```
</test_spec>

---

## Definition of Done

- [x] Akzeptanzkriterien sind eindeutig & vollstaendig
- [x] Telemetrie/Logging definiert (review_verdict, review_iterations, lint_status in Evidence)
- [x] Sicherheits-/Privacy-Aspekte bedacht (Code-Reviewer in separatem Context, Anti-Rubber-Stamping)
- [ ] UX/Copy final -- N/A (kein UI)
- [ ] Rollout-/Rollback-Plan -- Phase 2b Section kann aus dem Coordinator entfernt werden, Rolle/Description zurueckgesetzt

---

## Deliverables (SCOPE SAFEGUARD)

**WICHTIG: Diese Liste wird automatisch vom Stop-Hook validiert. Der Agent kann nicht stoppen, wenn Dateien fehlen.**

<!-- DELIVERABLES_START -->
### Agent-Definition (Modifikation)
- [ ] `.claude/agents/slice-impl-coordinator.md` -- Modifikation: (1) Frontmatter description aktualisiert auf 6-Step Pipeline mit code-reviewer und Deterministic Gate, (2) Rolle-Section auf 10 Steps aktualisiert, (3) Neue Phase 2b Section: Code-Review Loop mit Task(code-reviewer) Aufruf, Verdict-Auswertung (APPROVED/CONDITIONAL/REJECTED), Fix-Loop via Task(slice-implementer) bei REJECTED, max 3 Retries, HARD EXIT, (4) Phase 5 Evidence erweitert um review und deterministic_gate Felder, (5) Phase 6 JSON Output erweitert um review_iterations, review_verdict, lint_iterations, detected_stack
<!-- DELIVERABLES_END -->

**Hinweis fuer den Implementierungs-Agent:**
- Alle Dateien zwischen `<!-- DELIVERABLES_START -->` und `<!-- DELIVERABLES_END -->` sind **Pflicht**
- Der Stop-Hook prueft automatisch ob alle Dateien existieren
- Bei fehlenden Dateien wird der Agent blockiert und muss nachfragen
- Phase 1a und Phase 2c werden NICHT von diesem Slice modifiziert -- sie sind bereits durch Slice 2 definiert
- Dieser Slice fuegt NUR Phase 2b ein und aktualisiert Rolle/Description/Evidence/Output
