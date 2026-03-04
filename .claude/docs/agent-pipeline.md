# Agent Pipeline - Vollstaendige Dokumentation

## Uebersicht

Die Pipeline transformiert eine Feature-Idee autonom in einen fertigen PR.
Jeder Schritt nutzt das **Fresh Context Pattern** (Sub-Agents mit isoliertem Context).

```
Feature-Idee
    |
    v
/discovery ──> /wireframe ──> /architecture ──> /planner ──> /orchestrate
    |              |               |                |              |
 discovery.md   wireframes.md   architecture.md   slices/*.md    Code + Tests
                   |               |                |              |
                 Gate 0          Gate 1           Gate 2+3       Evidence
                                                 ╰── build.sh ──────╯
                                            (Bash: separate claude -p Sessions)
```

`build.sh` (.claude/scripts/build.sh) orchestriert den gesamten Flow als Bash-Script.
Jede Phase (Planner, Orchestrate) laeuft in einer eigenen `claude -p` Session mit 100% frischem Context.
Loest die Context-Erschoepfung und das 3-Ebenen-Nesting-Problem des alten `/build` Claude-Prompts.

```
build.sh (Bash = Ebene 0)
  |
  ├── Phase 1: Validierung (Bash - kein Claude noetig)
  │     └── Pruefe discovery.md + architecture.md existieren
  │
  ├── Phase 2: Git Branch (Bash)
  │     └── git checkout main && git checkout -b feat/{name}
  │
  ├── Phase 3: Planning (claude -p mit planner.md als System-Prompt)
  │     └── Eigene Session → .planner-state.json status:"completed"
  │
  ├── Phase 4: Implementation (claude -p mit orchestrate.md als System-Prompt)
  │     └── Eigene Session → .orchestrator-state.json status:"feature_complete"
  │
  ├── Phase 5: Git Push + PR (Bash)
  │     └── git push -u origin + gh pr create
  │
  └── Multi-Spec: Loop ueber alle Specs
```

---

## Feature-Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        KONZEPTION (manuell)                             │
│                                                                         │
│  /discovery ──> /wireframe ──> /architecture                            │
│      |              |               |                                   │
│   Diverge/       Wireframe +     Architecture +                         │
│   Converge       UX Review       Gate 1                                 │
│   mit User       + Gate 0        Compliance                             │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                        PLANUNG (autonom)                                 │
│                                                                         │
│  /planner                                                               │
│      |                                                                  │
│      ├── Slice 1: slice-writer ←→ slice-compliance (Gate 2, max 9)      │
│      ├── Slice 2: slice-writer ←→ slice-compliance (Gate 2, max 9)      │
│      ├── ...                                                            │
│      └── Gate 3: integration-map                                        │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                     IMPLEMENTATION (autonom)                             │
│                                                                         │
│  /orchestrate                                                           │
│      |                                                                  │
│      ├── Stack Detection                                                │
│      └── Pro Slice (wave-basiert):                                      │
│           ├── slice-implementer ──> Code                                │
│           ├── code-reviewer ──> Review (max 3)                          │
│           ├── Deterministic Gate ──> Lint/TypeCheck (max 3)             │
│           ├── test-writer ──> Tests                                     │
│           ├── test-validator ──> Validate                               │
│           └── debugger ──> Fix (max 9)                                  │
│                                                                         │
│  Final Validation ──> test-validator (alle Tests)                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Commands (9 aktiv)

| Command | Typ | Beschreibung |
|---------|-----|-------------|
| `/discovery` | Interaktiv | Feature-Konzeption mit Q&A-Session |
| `/wireframe` | Autonom | ASCII-Wireframes + UX Review + Gate 0 |
| `/architecture` | Autonom | Technische Architektur + Gate 1 |
| `/planner` | Autonom | Slice-Specs + Gate 2 + Gate 3 |
| `/orchestrate` | Autonom | Implementation wave-by-wave (6-Step Pipeline) |
| `build.sh` | Autonom | Bash-Script: Planner + Orchestrate + PR (separate claude -p Sessions) |
| `/roadmap` | Interaktiv | Strategische Produkt-Orientierung |
| `/qa-manual` | Interaktiv | Gefuehrtes Feature-Testing |
| `/pm-ux-review-de` | Autonom | Standalone UX Expert Review |

---

## Agents (18 aktiv)

### Konzeption

| Agent | Aufrufer | Aufgabe |
|-------|----------|---------|
| `discovery` | `/discovery` | Diverge/Converge Feature-Konzeption mit User |
| `wireframe` | `/wireframe` | ASCII-Wireframes aus Discovery erstellen |
| `ux-expert-review` | `/wireframe`, `/pm-ux-review-de` | Senior UX Bewertung von Wireframes |
| `architecture` | `/architecture` | Technische Architektur (API, DB, Security) |

### Quality Gates

| Agent | Gate | Aufrufer | Prueft |
|-------|------|----------|--------|
| `discovery-wireframe-compliance` | Gate 0 | `/wireframe` | Discovery ↔ Wireframe bidirektional |
| `architecture-compliance` | Gate 1 | `/architecture` | Architecture gegen Discovery/Wireframes |
| `slice-compliance` | Gate 2 | `slice-plan-coordinator` | Slice gegen Architecture/Wireframes |
| `integration-map` | Gate 3 | `/planner`, `/build` | Alle Slices E2E-Integration |

### Planung

| Agent | Aufrufer | Aufgabe |
|-------|----------|---------|
| `slice-writer` | `slice-plan-coordinator` | Eine Slice-Spec schreiben |
| `slice-plan-coordinator` | `/build` | Slice planen + Gate 2 validieren (max 9 Retries) |

### Implementation (6-Step Pipeline)

| Agent | Step | Aufrufer | Aufgabe |
|-------|------|----------|---------|
| `slice-implementer` | 1 | `slice-impl-coordinator`, `/orchestrate` | Code schreiben, committen |
| `code-reviewer` | 2 | `slice-impl-coordinator`, `/orchestrate` | Adversarial Code Review |
| *(Bash Lint/TC)* | 3 | `slice-impl-coordinator`, `/orchestrate` | Deterministic Gate |
| `test-writer` | 4 | `slice-impl-coordinator`, `/orchestrate` | Tests gegen ACs schreiben |
| `test-validator` | 5 | `slice-impl-coordinator`, `/orchestrate` | Tests + Smoke ausfuehren |
| `debugger` | 6 | `slice-impl-coordinator`, `/orchestrate` | Fehler fixen (max 9) |
| `slice-impl-coordinator` | * | `/build` | Orchestriert Steps 1-6 fuer einen Slice |

### Standalone

| Agent | Aufrufer | Aufgabe |
|-------|----------|---------|
| `roadmap` | `/roadmap` | Strategische Orientierung, Progress-Tracking |
| `qa-manual` | `/qa-manual` | Gefuehrtes Testing mit User-Interaktion |

---

## Quality Gates

```
Gate 0          Gate 1              Gate 2             Gate 3
Discovery ↔     Architecture vs     Slice vs           Alle Slices
Wireframe       Discovery +         Architecture +     E2E-Integration
                Wireframe           Wireframe
    |               |                   |                  |
    v               v                   v                  v
APPROVED/       APPROVED/           APPROVED/          READY FOR
FAILED          FAILED              FAILED             ORCHESTRATION
                (max 3 Retries)     (max 9 Retries)    (max 9 Retries)
```

| Gate | Agent | Pruefung | Auto-Fix |
|------|-------|----------|----------|
| 0 | `discovery-wireframe-compliance` | Features visualisiert? Details zurueckfliessen? | Ja (Discovery wird ergaenzt) |
| 1 | `architecture-compliance` | Datentypen realistisch? Dependencies aktuell? | Nein |
| 2 | `slice-compliance` | Schema, UI, Integration Contracts, Code Examples | Nein |
| 3 | `integration-map` | Dependency Graph, Orphaned Outputs, Missing Inputs | Nein |

---

## 6-Step Implementation Pipeline

Die zentrale Innovation der Pipeline. Gilt fuer `/orchestrate` (direkt) und `/build` (via `slice-impl-coordinator`).

```
                    ┌──────────────────┐
                    │  Stack Detection │
                    │  (einmal/Feature) │
                    └────────┬─────────┘
                             │
              ┌──────────────v──────────────┐
              │   Step 1: slice-implementer  │
              │   Code schreiben + committen │
              └──────────────┬──────────────┘
                             │
              ┌──────────────v──────────────┐
        ┌────>│   Step 2: code-reviewer      │
        │     │   Adversarial Review         │
        │     └──────────────┬──────────────┘
        │                    │
        │          ┌─────────v─────────┐
        │          │ APPROVED/COND.?   │──── Ja ───┐
        │          └─────────┬─────────┘           │
        │                    │ Nein (REJECTED)     │
        │                    v                     │
        │          slice-implementer (Fix)         │
        │          max 3 Retries                   │
        └────────────────────┘                     │
                                                   │
              ┌──────────────v──────────────┐
        ┌────>│   Step 3: Deterministic Gate │
        │     │   Lint Auto-Fix + Check      │
        │     │   TypeCheck                  │
        │     └──────────────┬──────────────┘
        │                    │
        │          ┌─────────v─────────┐
        │          │    PASSED?        │──── Ja ───┐
        │          └─────────┬─────────┘           │
        │                    │ Nein                 │
        │                    v                     │
        │              debugger (Fix)              │
        │              max 3 Retries               │
        └────────────────────┘                     │
                                                   │
              ┌──────────────v──────────────┐
              │   Step 4: test-writer        │
              │   Tests gegen ACs schreiben  │
              │   100% AC Coverage Pflicht   │
              └──────────────┬──────────────┘
                             │
              ┌──────────────v──────────────┐
        ┌────>│   Step 5: test-validator     │
        │     │   Unit → Integration →       │
        │     │   Acceptance → Smoke         │
        │     └──────────────┬──────────────┘
        │                    │
        │          ┌─────────v─────────┐
        │          │    PASSED?        │──── Ja ──> Evidence + Done
        │          └─────────┬─────────┘
        │                    │ Nein
        │                    v
        │              debugger (Fix)
        │              max 9 Retries
        └────────────────────┘
```

### Stack Detection

Erkennt den Tech-Stack einmal pro Feature anhand von Indicator-Dateien:

| Indicator | Stack | Lint | TypeCheck |
|-----------|-------|------|-----------|
| `pyproject.toml` | Python | ruff/black | mypy/pyright |
| `package.json` | Node.js | npm run lint | - |
| `tsconfig.json` | TypeScript | npm run lint | tsc --noEmit |
| `go.mod` | Go | - | - |
| `Cargo.toml` | Rust | - | - |
| `composer.json` | PHP | - | - |

### Code Reviewer - Verdict Logik

| Verdict | Bedingung | Aktion |
|---------|-----------|--------|
| APPROVED | 0 CRITICAL + 0 HIGH | Weiter zu Step 3 |
| CONDITIONAL | 0 CRITICAL + >=1 HIGH | Weiter zu Step 3 (Warnings) |
| REJECTED | >=1 CRITICAL | Fix-Loop (max 3) |

---

## build.sh vs /planner + /orchestrate vs /build (deprecated)

```
/planner + /orchestrate (2 Ebenen)      build.sh (Bash + 2 Ebenen)
================================         ================================

User                                     User
  |                                        |
  ├── /planner (Claude Session 1)          └── build.sh (Bash = Ebene 0)
  │     ├── Task(slice-writer)                   |
  │     ├── Task(slice-compliance)               ├── Phase 1-2: Bash (validate, branch)
  │     └── Task(integration-map)                │
  │                                              ├── Phase 3: claude -p (Session 1)
  └── /orchestrate (Claude Session 2)            │     └── planner.md als System-Prompt
        ├── Task(slice-implementer)              │           ├── Task(slice-writer)
        ├── Task(code-reviewer)                  │           ├── Task(slice-compliance)
        ├── Bash(lint/typecheck)                 │           └── Task(integration-map)
        ├── Task(test-writer)                    │
        ├── Task(test-validator)                 ├── Phase 4: claude -p (Session 2)
        └── Task(debugger)                       │     └── orchestrate.md als System-Prompt
                                                 │           ├── Task(slice-implementer)
                                                 │           ├── Task(code-reviewer)
                                                 │           ├── Bash(lint/typecheck)
                                                 │           ├── Task(test-writer)
                                                 │           ├── Task(test-validator)
                                                 │           └── Task(debugger)
                                                 │
                                                 └── Phase 5: Bash (push, PR)
```

**build.sh Vorteile gegenueber /build (deprecated Claude-Prompt):**
- Jede Phase bekommt 100% frischen Context (keine Context-Erschoepfung)
- Nur 2 Ebenen Nesting (Bash -> claude -p -> Task), nicht 3
- State-Uebergabe via Dateien (.planner-state.json, .orchestrator-state.json)
- Resume-Support: Erkennt abgeschlossene Phasen und ueberspringt sie

---

## Spec-Ordner Struktur

```
specs/{date}-{feature}/
├── discovery.md                        # /discovery Output
├── wireframes.md                       # /wireframe Output
├── checks/
│   └── ux-expert-review.md             # UX Review
├── compliance-discovery-wireframe.md   # Gate 0
├── architecture.md                     # /architecture Output
├── compliance-architecture.md          # Gate 1
├── integration-map.md                  # Gate 3
├── e2e-checklist.md                    # Gate 3
├── orchestrator-config.md              # Gate 3 (Wave-Reihenfolge)
├── .planner-state.json                 # /planner State
├── .orchestrator-state.json            # /orchestrate State
├── .build-state.json                   # /build State
└── slices/
    ├── slice-01-{name}.md              # Slice Spec
    ├── compliance-slice-01.md          # Gate 2
    ├── slice-02-{name}.md
    ├── compliance-slice-02.md
    └── ...
```

---

## Evidence

Jeder implementierte Slice erzeugt eine Evidence-Datei:

```
.claude/evidence/{feature-name}/
├── slice-01-{name}.json
├── slice-02-{name}.json
└── ...
```

Evidence-Schema:

```json
{
  "feature": "feature-name",
  "slice": "slice-01-name",
  "timestamp": "ISO-8601",
  "status": "completed",
  "implementation": {
    "status": "completed",
    "files_changed": [],
    "commit_hash": "abc123"
  },
  "review": {
    "verdict": "APPROVED",
    "findings": [],
    "summary": "..."
  },
  "deterministic_gate": {
    "detected_stack": "TypeScript",
    "lint_passed": true,
    "lint_iterations": 0
  },
  "tests": {
    "status": "passed",
    "test_files": [],
    "test_count": 10,
    "ac_coverage": { "total": 5, "covered": 5, "missing": [] }
  },
  "validation": {
    "overall_status": "passed",
    "stages": { "unit": {}, "integration": {}, "acceptance": {}, "smoke": {} }
  },
  "retries": 0,
  "review_iterations": 0
}
```

---

## Retry-Limits

| Kontext | Max Retries | Bei Erschoepfung |
|---------|-------------|-------------------|
| Gate 0 (Wireframe Compliance) | 3 | HARD STOP |
| Gate 1 (Architecture Compliance) | 3 | HARD STOP |
| Gate 2 (Slice Compliance) | 9 | HARD STOP |
| Gate 3 (Integration Map) | 9 | HARD STOP |
| Code Review (Step 2) | 3 | HARD STOP |
| Deterministic Gate (Step 3) | 3 | HARD STOP |
| Debugger (Step 6) | 9 | HARD STOP |
| Final Validation | 9 | HARD STOP |

---

## Design-Prinzipien

1. **Fresh Context Pattern** - Jeder Sub-Agent startet mit leerem Context. Verhindert Confirmation Bias und Context Pollution.
2. **Adversarial Review** - Code Reviewer nutzt 4 skeptische Regeln gegen Rubber-Stamping.
3. **Deterministic Gates** - Lint/TypeCheck via Bash (nicht LLM). Objektiv, reproduzierbar.
4. **Evidence-based** - Jeder Slice erzeugt JSON-Evidence. Auditierbar.
5. **Wave-based Execution** - Parallele Slices in Waves, sequentielle Abhaengigkeiten zwischen Waves.
6. **Graceful Degradation** - Stack Detection optional, Chrome DevTools MCP optional mit Fallback.
