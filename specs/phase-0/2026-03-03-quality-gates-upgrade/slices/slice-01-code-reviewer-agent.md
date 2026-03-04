# Slice 1: Code Reviewer Agent definieren

> **Slice 1 von 4** fuer `Quality Gates Upgrade`
>
> | Navigation | |
> |------------|---|
> | **Vorheriger:** | -- |
> | **Naechster:** | `slice-02-deterministic-gate.md` |

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-01-code-reviewer-agent` |
| **Test** | `claude agents:validate .claude/agents/code-reviewer.md` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

**Erklaerung:**
- **ID**: Eindeutiger Identifier fuer Commits und Evidence
- **Test**: Manuelle Validierung -- Agent-Definition ist eine .md Datei, kein ausfuehrbarer Code. Validierung erfolgt durch manuellen Aufruf (siehe Testfaelle)
- **E2E**: false -- keine Playwright-Tests
- **Dependencies**: Keine -- erster Slice, unabhaengig

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Manuell bestimmt. Dieses Feature modifiziert Agent-Definitionen (.md Dateien), keine Webanwendung.

| Key | Value |
|-----|-------|
| **Stack** | `agent-definitions` (kein klassischer App-Stack) |
| **Test Command** | `Manuell: Task(code-reviewer) mit Test-Diff aufrufen, JSON-Output pruefen` |
| **Integration Command** | `N/A` |
| **Acceptance Command** | `Manuell: Agent mit verschiedenen Diffs aufrufen (clean code, buggy code, missing validation)` |
| **Start Command** | `N/A` |
| **Health Endpoint** | `N/A` |
| **Mocking Strategy** | `no_mocks` |

**Erklaerung:**
- Kein klassischer Test-Stack, da nur Agent-Definitionen (.md Dateien) erstellt werden
- Validierung erfolgt durch manuellen Task()-Aufruf des Agents mit Test-Diffs
- JSON-Output wird gegen den Output Contract geprueft

---

## Slice-Uebersicht

| # | Slice | Status | Datei |
|---|-------|--------|-------|
| 1 | Code Reviewer Agent | Ready | `slice-01-code-reviewer-agent.md` |
| 2 | Deterministic Pre-Test Gate | Pending | `slice-02-deterministic-gate.md` |
| 3 | Pipeline Integration | Pending | `slice-03-pipeline-integration.md` |
| 4 | Chrome DevTools Smoke Test | Pending | `slice-04-chrome-devtools-smoke.md` |

---

## Kontext & Ziel

Agent-generierter Code wird aktuell nur durch Tests validiert, nicht inhaltlich geprueft. Ein separater Code Reviewer Sub-Agent soll vor der Test-Execution ein strukturiertes Code-Review durchfuehren.

**Aktuelle Probleme:**
1. Kein Code-Review vor PR/Merge -- Rubber-Stamping-Risiko, da Implementer und Validierer denselben Context teilen
2. CRITICAL Bugs (fehlende Input-Validierung, Security-Issues) werden erst durch fehlschlagende Tests entdeckt -- oder gar nicht

**Zielbild:**
- Neuer `code-reviewer.md` Sub-Agent mit adversarialem Review-Prompt
- Separater Context (Fresh Context via Task()) verhindert Rubber-Stamping
- Strukturierter JSON-Output mit Severity-Kategorien (CRITICAL/HIGH/MEDIUM/LOW)
- Verdict-Logik: APPROVED / CONDITIONAL / REJECTED

---

## Technische Umsetzung

### Architektur-Kontext (aus architecture.md)

> **Quelle:** `architecture.md` -> Agent Contracts > Code Reviewer Agent

```
/build Command
  |-- Task(slice-impl-coordinator)
        |-- Task(slice-implementer) -> git diff
        |
        |-- Task(code-reviewer)     <- git diff, slice-spec   [NEU]
        |   |-- Returns: {verdict, findings[]}
        |   |-- IF REJECTED -> Task(slice-implementer) + findings -> loop (max 3)
        |
        |-- ...weitere Pipeline-Steps...
```

### 1. Architektur-Impact

| Layer | Aenderungen |
|-------|-------------|
| `.claude/agents/` | Neue Datei: `code-reviewer.md` -- Agent-Definition mit Frontmatter, Workflow, Output Contract |

### 2. Datenfluss

```
slice-impl-coordinator sendet Task()-Prompt
  |
  v
code-reviewer liest: Slice-Spec, Architecture, git diff HEAD~1
  |
  v
Analyse: Spec-Compliance, Architecture-Compliance, Code-Quality, Anti-Patterns
  |
  v
JSON Output: {verdict, findings[], summary}
  |
  v
slice-impl-coordinator entscheidet: weiter / fix-loop / hard-exit
```

### 3. Agent-Definition Struktur

Die Agent-Definition `.claude/agents/code-reviewer.md` besteht aus:

1. **YAML Frontmatter** -- Name, Description, Tools
2. **Rollen-Definition** -- Klare Abgrenzung: Read-Only Reviewer, kein Code-Schreiber
3. **Input-Parsing** -- Wie der Agent seinen Task()-Prompt interpretiert
4. **Workflow** -- 6-Schritt Review-Prozess
5. **Adversarial Prompt** -- Kern-Prinzip gegen Rubber-Stamping
6. **Severity-Kategorien** -- CRITICAL/HIGH/MEDIUM/LOW mit klaren Definitionen
7. **Verdict-Logik** -- APPROVED/CONDITIONAL/REJECTED Entscheidungsmatrix
8. **Output Contract** -- Exaktes JSON-Format

### 4. Frontmatter (exakt wie in architecture.md)

```yaml
---
name: code-reviewer
description: Code-Review Sub-Agent. Reviewt git diff gegen Slice-Spec und Architecture. Adversarial Prompt. Returns structured JSON.
tools: Read, Grep, Glob, Bash(git diff:git log:git show)
---
```

### 5. Input-Parameter (vom Coordinator)

| Parameter | Quelle | Pflicht | Beschreibung |
|-----------|--------|---------|--------------|
| `slice_id` | Coordinator Prompt | Ja | ID des zu reviewenden Slices |
| `slice_file_path` | Coordinator Prompt | Ja | Pfad zur Slice-Spec |
| `architecture_path` | Coordinator Prompt | Ja | Pfad zu architecture.md |
| `working_dir` | Coordinator Prompt | Ja | Working Directory fuer git diff |

### 6. Workflow (6 Schritte)

```
Step 1: Lies Slice-Spec (Deliverables, ACs, Code Examples)
Step 2: Lies Architecture (Patterns, Conventions, Constraints)
Step 3: Fuehre `git diff HEAD~1` aus im working_dir -> Erhalte Diff
Step 4: Analysiere Diff gegen 4 Kategorien:
        - Spec-Compliance: Implementiert der Code die ACs?
        - Architecture-Compliance: Folgt der Code den definierten Patterns?
        - Code-Quality: Offensichtliche Bugs, fehlende Error-Handling, Security-Issues
        - Anti-Patterns: Hardcoded Values, fehlende Validierung, Race Conditions
Step 5: Kategorisiere Findings nach Severity
Step 6: Gib JSON zurueck
```

### 7. Severity-Kategorien

| Severity | Definition | Pipeline-Wirkung |
|----------|-----------|------------------|
| **CRITICAL** | Blockierende Issues: fehlende Input-Validierung, Security-Luecken, Spec-Abweichung bei Kern-ACs, fehlende Error-Handling fuer kritische Pfade | Pipeline blockiert, Implementer muss fixen |
| **HIGH** | Empfohlene Fixes: Suboptimale Patterns, fehlende Edge-Case-Behandlung, Performance-Bedenken | Warning geloggt, Pipeline laeuft weiter |
| **MEDIUM** | Hinweise: Code-Style, bessere Benennungen, Refactoring-Moeglichkeiten | Warning geloggt, Pipeline laeuft weiter |
| **LOW** | Nit-Picks: Kommentar-Verbesserungen, Formatting (sollte durch Lint abgedeckt sein) | Warning geloggt, Pipeline laeuft weiter |

### 8. Verdict-Logik

| Condition | Verdict | Pipeline-Aktion |
|-----------|---------|-----------------|
| 0 CRITICAL + 0 HIGH | `APPROVED` | Pipeline laeuft weiter |
| 0 CRITICAL + >=1 HIGH | `CONDITIONAL` | Warnings geloggt, Pipeline laeuft weiter |
| >=1 CRITICAL | `REJECTED` | Pipeline blockiert, Implementer muss fixen |

### 9. Adversarial Review Prompt (Kern-Prinzip)

Der Agent MUSS folgende adversariale Anweisung in seiner Definition enthalten:

```
ADVERSARIAL REVIEW RULES:
1. Finde mindestens 3 Issues oder begruende EXPLIZIT warum keine existieren.
   - "Keine Issues gefunden" ohne Begruendung ist VERBOTEN.
   - Fuer jede der 4 Analyse-Kategorien (Spec-Compliance, Architecture-Compliance,
     Code-Quality, Anti-Patterns) MUSS mindestens eine Aussage gemacht werden.

2. Du bist ein SKEPTISCHER Reviewer, kein wohlwollender Kollege.
   - Gehe davon aus, dass der Code Fehler enthaelt, bis das Gegenteil bewiesen ist.
   - Pruefe JEDEN geaenderten File einzeln.

3. Du hast KEINEN Zugriff auf den Implementer-Context.
   - Du siehst NUR den Diff, die Spec und die Architecture.
   - Du weisst NICHT warum der Implementer bestimmte Entscheidungen getroffen hat.
   - Beurteile den Code NUR anhand der Spec und Architecture.

4. Severity-Zuweisung MUSS begruendet sein.
   - Jedes Finding MUSS eine konkrete fix_suggestion enthalten.
   - CRITICAL darf NUR vergeben werden bei: Security-Issues, fehlender Input-Validierung,
     Spec-Abweichung bei Kern-ACs, fehlender Error-Handling fuer kritische Pfade.
```

### 10. Output Contract (exakt wie in architecture.md)

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

### 11. Git Diff Handling

| Aspekt | Regelung |
|--------|----------|
| Diff-Command | `git diff HEAD~1` im working_dir |
| Max Diff-Groesse | Truncate auf 50.000 Zeichen (Context-Limit) |
| Leerer Diff | Sofort `REJECTED` mit Finding: "No changes found in git diff" |
| Multi-File Diff | Jede Datei einzeln analysieren |

---

## Constraints & Hinweise

**Betrifft:**
- Nur `.claude/agents/code-reviewer.md` -- eine neue Agent-Definition

**Abgrenzung:**
- KEIN ausfuehrbarer Code -- nur eine .md Datei mit Agent-Anweisungen
- KEINE Aenderung an bestehenden Agents (das macht Slice 3: Pipeline Integration)
- KEINE Lint/TypeCheck-Integration (das macht Slice 2: Deterministic Gate)
- KEINE Chrome DevTools Integration (das macht Slice 4)

**Architecture Contract:**
- Frontmatter MUSS exakt dem Format in architecture.md entsprechen
- Output Contract JSON MUSS exakt dem Schema in architecture.md entsprechen
- Workflow MUSS die 6 Schritte aus architecture.md implementieren

---

## Integration Contract (GATE 2 PFLICHT)

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| -- | -- | -- | -- |

Dieser Slice hat keine Dependencies. Er definiert nur die Agent-Definition.

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `.claude/agents/code-reviewer.md` | Agent-Definition | Slice 3 (Pipeline Integration) | Task(subagent_type: "code-reviewer", prompt: "...") |
| JSON Output Contract | Data Contract | Slice 3 (Pipeline Integration) | `{verdict: string, findings: Finding[], summary: string}` |
| Severity-Kategorien | Business Rule | Slice 3 (Pipeline Integration) | CRITICAL blockiert, HIGH/MEDIUM/LOW = Warning |
| Verdict-Logik | Business Rule | Slice 3 (Pipeline Integration) | APPROVED/CONDITIONAL/REJECTED Entscheidungsmatrix |

### Integration Validation Tasks

- [ ] Agent-Definition ist eine gueltige .md Datei mit YAML Frontmatter
- [ ] Frontmatter hat `name`, `description`, `tools` Felder
- [ ] Output Contract JSON ist parsebar und hat alle Pflichtfelder (verdict, findings, summary)
- [ ] Severity-Kategorien sind klar definiert (CRITICAL/HIGH/MEDIUM/LOW)
- [ ] Adversarial Prompt ist enthalten und erzwingt mindestens 3 Issues oder explizite Begruendung

---

## Code Examples (MANDATORY - GATE 2 PFLICHT)

> **KRITISCH:** Alle Code-Beispiele in diesem Dokument sind **PFLICHT-Deliverables**.
> Der Gate 2 Compliance Agent prueft, dass jedes Code-Beispiel implementiert wird.

| Code Example | Section | Mandatory | Notes |
|--------------|---------|-----------|-------|
| YAML Frontmatter | Technische Umsetzung > 4. Frontmatter | YES | Exakt wie spezifiziert: name, description, tools |
| Adversarial Review Rules | Technische Umsetzung > 9. Adversarial Review Prompt | YES | Alle 4 Regeln muessen in der Agent-Definition enthalten sein |
| JSON Output Contract | Technische Umsetzung > 10. Output Contract | YES | Exaktes JSON-Schema mit verdict, findings[], summary |
| Workflow 6-Schritte | Technische Umsetzung > 6. Workflow | YES | Alle 6 Schritte muessen in der Agent-Definition beschrieben sein |
| Severity-Tabelle | Technische Umsetzung > 7. Severity-Kategorien | YES | Alle 4 Severity-Level mit Definitionen und Pipeline-Wirkung |
| Verdict-Logik-Tabelle | Technische Umsetzung > 8. Verdict-Logik | YES | Alle 3 Verdict-Optionen mit Conditions und Pipeline-Aktionen |

---

## Acceptance Criteria

1) GIVEN eine neue Datei `.claude/agents/code-reviewer.md`
   WHEN die Datei gelesen wird
   THEN enthaelt sie ein gueltiges YAML Frontmatter mit `name: code-reviewer`, `description` und `tools: Read, Grep, Glob, Bash(git diff:git log:git show)`

2) GIVEN die Agent-Definition
   WHEN der Workflow-Abschnitt gelesen wird
   THEN beschreibt er exakt 6 Schritte: Slice-Spec lesen, Architecture lesen, git diff ausfuehren, Analyse gegen 4 Kategorien, Findings kategorisieren, JSON zurueckgeben

3) GIVEN die Agent-Definition
   WHEN der Adversarial-Prompt-Abschnitt gelesen wird
   THEN enthaelt er alle 4 Regeln: (1) Mindestens 3 Issues oder explizite Begruendung, (2) Skeptischer Reviewer, (3) Kein Implementer-Context, (4) Begruendete Severity-Zuweisung

4) GIVEN die Agent-Definition
   WHEN der Output-Contract-Abschnitt gelesen wird
   THEN beschreibt er ein JSON-Schema mit `verdict` (APPROVED/CONDITIONAL/REJECTED), `findings[]` (severity, file, line, message, fix_suggestion) und `summary`

5) GIVEN die Agent-Definition
   WHEN die Severity-Kategorien gelesen werden
   THEN sind alle 4 Level definiert (CRITICAL/HIGH/MEDIUM/LOW) mit klarer Definition und Pipeline-Wirkung

6) GIVEN die Agent-Definition
   WHEN die Verdict-Logik gelesen wird
   THEN ist definiert: 0 CRITICAL + 0 HIGH = APPROVED, 0 CRITICAL + >=1 HIGH = CONDITIONAL, >=1 CRITICAL = REJECTED

7) GIVEN die Agent-Definition
   WHEN der Input-Parsing-Abschnitt gelesen wird
   THEN beschreibt er die 4 Pflicht-Parameter: slice_id, slice_file_path, architecture_path, working_dir

8) GIVEN die Agent-Definition
   WHEN der Git-Diff-Handling-Abschnitt gelesen wird
   THEN beschreibt er: Diff-Command `git diff HEAD~1`, Max-Groesse 50.000 Zeichen, Leerer-Diff-Handling, Multi-File-Analyse

---

## Testfaelle

**WICHTIG:** Da dieser Slice eine Agent-Definition (.md Datei) erstellt und keinen ausfuehrbaren Code, sind die Tests manuell. Die Test-Spec beschreibt, wie die Agent-Definition validiert werden kann.

### Test-Datei

**Konvention:** Manuelle Validierung -- keine automatisierte Test-Datei

**Fuer diesen Slice:** Manuelle Pruefung der `.claude/agents/code-reviewer.md` Datei

### Manuelle Tests

<test_spec>
```markdown
# Manuelle Test-Prozedur fuer code-reviewer.md

## Test 1: Frontmatter-Validierung
1. Oeffne `.claude/agents/code-reviewer.md`
2. Pruefe YAML Frontmatter zwischen `---` Markern
3. Erwartung:
   - `name: code-reviewer` vorhanden
   - `description:` nicht leer
   - `tools:` enthaelt Read, Grep, Glob, Bash(git diff:git log:git show)

## Test 2: Workflow-Vollstaendigkeit
1. Suche nach der Workflow-Section
2. Pruefe ob alle 6 Schritte beschrieben sind:
   - Step 1: Slice-Spec lesen
   - Step 2: Architecture lesen
   - Step 3: git diff HEAD~1 ausfuehren
   - Step 4: Analyse gegen 4 Kategorien
   - Step 5: Findings kategorisieren
   - Step 6: JSON zurueckgeben

## Test 3: Adversarial Prompt
1. Suche nach der Adversarial-Rules-Section
2. Pruefe ob alle 4 Regeln enthalten sind:
   - Regel 1: Mindestens 3 Issues oder explizite Begruendung
   - Regel 2: Skeptischer Reviewer
   - Regel 3: Kein Implementer-Context
   - Regel 4: Begruendete Severity-Zuweisung mit fix_suggestion

## Test 4: Output Contract
1. Suche nach dem JSON Output Contract
2. Pruefe Felder:
   - `verdict`: APPROVED | CONDITIONAL | REJECTED
   - `findings[]`: severity, file, line, message, fix_suggestion
   - `summary`: String

## Test 5: Severity-Kategorien
1. Suche nach Severity-Definition
2. Pruefe:
   - CRITICAL: Blockierend definiert
   - HIGH: Warning definiert
   - MEDIUM: Hinweis definiert
   - LOW: Nit-Pick definiert

## Test 6: Verdict-Logik
1. Suche nach Verdict-Tabelle
2. Pruefe:
   - 0 CRITICAL + 0 HIGH = APPROVED
   - 0 CRITICAL + >=1 HIGH = CONDITIONAL
   - >=1 CRITICAL = REJECTED

## Test 7: Funktionaler Agent-Aufruf (optional, nach Slice 3)
1. Erstelle ein Test-Repo mit bewusst fehlerhaftem Code
2. Rufe Task(code-reviewer) mit slice_file_path und architecture_path auf
3. Pruefe: JSON-Output ist parsebar
4. Pruefe: Findings enthalten die bewussten Fehler
5. Pruefe: Verdict ist REJECTED (bei CRITICAL Fehlern)
```
</test_spec>

---

## Definition of Done

- [x] Akzeptanzkriterien sind eindeutig & vollstaendig
- [x] Telemetrie/Logging definiert (Evidence-JSON ueber Coordinator in Slice 3)
- [x] Sicherheits-/Privacy-Aspekte bedacht (Read-Only Agent, kein Code-Schreiber)
- [ ] UX/Copy final -- N/A (kein UI)
- [ ] Rollout-/Rollback-Plan -- Agent-Definition kann einfach geloescht/umbenannt werden

---

## Deliverables (SCOPE SAFEGUARD)

**WICHTIG: Diese Liste wird automatisch vom Stop-Hook validiert. Der Agent kann nicht stoppen, wenn Dateien fehlen.**

<!-- DELIVERABLES_START -->
### Agent-Definition
- [ ] `.claude/agents/code-reviewer.md` -- Neue Agent-Definition mit YAML Frontmatter, Workflow (6 Schritte), Adversarial Review Prompt (4 Regeln), Severity-Kategorien (CRITICAL/HIGH/MEDIUM/LOW), Verdict-Logik (APPROVED/CONDITIONAL/REJECTED), JSON Output Contract, Input-Parsing, Git-Diff-Handling
<!-- DELIVERABLES_END -->

**Hinweis fuer den Implementierungs-Agent:**
- Alle Dateien zwischen `<!-- DELIVERABLES_START -->` und `<!-- DELIVERABLES_END -->` sind **Pflicht**
- Der Stop-Hook prueft automatisch ob alle Dateien existieren
- Bei fehlenden Dateien wird der Agent blockiert und muss nachfragen
