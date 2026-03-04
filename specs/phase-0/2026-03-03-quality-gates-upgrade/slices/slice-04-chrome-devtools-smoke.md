# Slice 4: Chrome DevTools Smoke Test erweitern

> **Slice 4 von 4** fuer `Quality Gates Upgrade`
>
> | Navigation | |
> |------------|---|
> | **Vorheriger:** | `slice-03-pipeline-integration.md` |
> | **Naechster:** | -- |

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-04-chrome-devtools-smoke` |
| **Test** | `Manuell: Pruefe dass test-validator.md Stage 4 Smoke Test um DevTools-Steps erweitert ist, Fallback zu health_only, erweiterter JSON Output Contract` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-pipeline-integration"]` |

**Erklaerung:**
- **ID**: Eindeutiger Identifier fuer Commits und Evidence
- **Test**: Manuelle Validierung -- Agent-Definitionen sind .md Dateien, kein ausfuehrbarer Code
- **E2E**: false -- keine Playwright-Tests
- **Dependencies**: Benoetigt Slice 3 (Pipeline Integration), da die erweiterte Pipeline den test-validator mit detected_stack aufruft

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Manuell bestimmt. Dieses Feature modifiziert Agent-Definitionen (.md Dateien), keine Webanwendung.

| Key | Value |
|-----|-------|
| **Stack** | `agent-definitions` (kein klassischer App-Stack) |
| **Test Command** | `Manuell: Lies test-validator.md und pruefe Stage 4 Smoke Test DevTools-Erweiterung, Fallback-Logik, JSON Output Contract` |
| **Integration Command** | `Manuell: Pruefe dass der erweiterte Smoke-Output korrekt in die Evidence-Datei fliesst` |
| **Acceptance Command** | `Manuell: Starte eine App, fuehre den erweiterten Smoke Test mit und ohne Chrome DevTools MCP aus, pruefe JSON-Output` |
| **Start Command** | `N/A` |
| **Health Endpoint** | `N/A` |
| **Mocking Strategy** | `no_mocks` |

**Erklaerung:**
- Kein klassischer Test-Stack, da nur Agent-Definitionen (.md Dateien) modifiziert werden
- Validierung erfolgt durch manuelle Pruefung der modifizierten .md Datei
- Funktionale Validierung durch Ausfuehrung der Pipeline mit einer Test-App mit und ohne Chrome DevTools MCP

---

## Slice-Uebersicht

| # | Slice | Status | Datei |
|---|-------|--------|-------|
| 1 | Code Reviewer Agent | Ready | `slice-01-code-reviewer-agent.md` |
| 2 | Deterministic Pre-Test Gate | Ready | `slice-02-deterministic-pre-test-gate.md` |
| 3 | Pipeline Integration | Ready | `slice-03-pipeline-integration.md` |
| 4 | Chrome DevTools Smoke Test | Ready | `slice-04-chrome-devtools-smoke.md` |

---

## Kontext & Ziel

Der Smoke Test im test-validator prueft aktuell nur den Health-Endpoint (HTTP 200). Es gibt keine funktionale Verifikation, ob die App korrekt rendert, ob DOM-Elemente vorhanden sind oder ob Console-Errors auftreten.

**Aktuelle Probleme:**
1. Smoke Test = nur Health-Check -- eine App die HTTP 200 zurueckgibt aber eine leere Seite rendert, besteht den Smoke Test
2. Console.error im Browser (z.B. fehlende API-Keys, broken Imports) werden nicht erkannt
3. Keine visuelle/funktionale Evidence -- nur "App startet" als Beweis

**Zielbild:**
- Stage 4 (Smoke Test) in test-validator.md um Chrome DevTools MCP Steps erweitern
- Nach Health-Check: DOM-Snapshot abrufen, Console-Errors sammeln, optional Screenshot
- Fallback zu `health_only` Mode wenn Chrome DevTools MCP nicht verfuegbar
- Console.error = Warning, NICHT Failure (viele Libraries loggen Warnings als console.error)
- Erweiterter JSON Output Contract mit `smoke_mode`, `dom_snapshot`, `console_errors`, `screenshot_path`

---

## Technische Umsetzung

### Architektur-Kontext (aus architecture.md)

> **Quelle:** `architecture.md` -> Test-Validator Smoke Test Erweiterung

```
Stage 4: Smoke Test (erweitert)
  1. App starten im Hintergrund (unveraendert)
  2. PID merken (unveraendert)
  3. Health-Endpoint pollen -> HTTP 200 (unveraendert)
  4. [NEU] Chrome DevTools MCP Check:
     a. Pruefe ob MCP-Tool verfuegbar (try: mcp__chrome-devtools__*)
     b. IF verfuegbar:
        - Navigate zu App-URL
        - DOM Snapshot: Accessibility-Tree abrufen
        - Console Logs: Alle console.error Eintraege sammeln
        - Optional: Screenshot als Evidence
        - smoke_mode = "functional"
     c. IF nicht verfuegbar:
        - smoke_mode = "health_only"
        - Warning loggen
  5. App stoppen (unveraendert)
```

### 1. Architektur-Impact

| Layer | Aenderungen |
|-------|-------------|
| `.claude/agents/test-validator.md` | Stage 4 (Smoke Test) erweitern um DevTools-Steps nach Health-Check. JSON Output Contract erweitern um `smoke_mode`, `dom_snapshot`, `console_errors`, `screenshot_path`. MCP-Verfuegbarkeits-Check mit Fallback. |

### 2. Datenfluss

```
Stage 4: Smoke Test (nach Health-Check HTTP 200)
  |
  v
Step 4a: Chrome DevTools MCP Verfuegbarkeit pruefen
  try: mcp__chrome-devtools__navigate({url: health_endpoint})
  |
  v
IF MCP verfuegbar (kein Fehler):
  |
  v
  Step 4b: DOM Snapshot abrufen
    mcp__chrome-devtools__accessibility_snapshot()
    -> Parse: element_count, expected_elements (aus Slice-Spec Deliverables)
    -> Bestimme: expected_elements_found, missing_elements
  |
  v
  Step 4c: Console Logs abrufen
    mcp__chrome-devtools__console_messages()
    -> Filter: nur Eintraege mit level == "error"
    -> Sammle als String Array
  |
  v
  Step 4d: Screenshot (optional)
    mcp__chrome-devtools__screenshot()
    -> Speichere unter: .claude/evidence/{feature}/{slice_id}-smoke.png
  |
  v
  smoke_mode = "functional"
  |
  v
IF MCP NICHT verfuegbar (Fehler/Tool nicht registriert):
  |
  v
  smoke_mode = "health_only"
  LOG WARNING: "Chrome DevTools MCP nicht verfuegbar -- Smoke Test laeuft im health_only Modus"
  |
  v
Step 5: App stoppen (unveraendert)
  |
  v
JSON Output mit erweitertem smoke-Objekt
```

### 3. MCP-Verfuegbarkeits-Check

Der test-validator prueft die Verfuegbarkeit des Chrome DevTools MCP durch einen Versuch, das Tool aufzurufen. Bei Fehler (Tool nicht registriert, MCP Server nicht erreichbar) wird der Fallback aktiviert.

**Pruef-Mechanismus:**

```
Step 4a: MCP Verfuegbarkeit pruefen

TRY:
  result = mcp__chrome-devtools__navigate(url: "{health_endpoint}")
  IF result == success:
    devtools_available = true
CATCH (ToolNotFound / MCPError / Timeout):
  devtools_available = false
  LOG WARNING: "Chrome DevTools MCP nicht verfuegbar: {error_message}"
  LOG WARNING: "Smoke Test laeuft im health_only Modus. Fuer funktionalen Smoke Test: Chrome DevTools MCP installieren via 'npx chrome-devtools-mcp@latest'"
```

**Wichtig:** Der TRY/CATCH ist konzeptuell -- der Agent versucht den Tool-Call und reagiert auf Fehler. Kein ausfuehrbarer Code.

### 4. DOM Snapshot Abruf und Validierung

```
Step 4b: DOM Snapshot

IF devtools_available:
  snapshot = mcp__chrome-devtools__accessibility_snapshot()

  # Parse Snapshot
  element_count = count(snapshot.elements)  # Anzahl Elemente im Accessibility-Tree

  # Erwartete Elemente aus Slice-Spec (falls im Prompt mitgegeben)
  # Der Coordinator gibt expected_elements im Prompt mit, falls in der Slice-Spec definiert
  expected_elements_found = []
  missing_elements = []

  FOR element IN expected_elements:
    IF element IN snapshot (case-insensitive Suche im Accessibility-Tree):
      expected_elements_found.append(element)
    ELSE:
      missing_elements.append(element)

  # Validierung
  IF element_count == 0:
    LOG WARNING: "DOM Snapshot hat 0 Elemente -- App rendert moeglicherweise eine leere Seite"

  IF missing_elements.length > 0:
    LOG WARNING: "Fehlende erwartete Elemente: {missing_elements}"

  # WICHTIG: DOM-Snapshot-Ergebnisse sind Warnings, KEINE Failures
  # Die Pipeline laeuft weiter, auch wenn Elemente fehlen
```

### 5. Console-Error-Sammlung

```
Step 4c: Console Logs

IF devtools_available:
  console_messages = mcp__chrome-devtools__console_messages()

  # Filter: Nur console.error Eintraege
  console_errors = []
  FOR msg IN console_messages:
    IF msg.level == "error":
      console_errors.append(msg.text)

  IF console_errors.length > 0:
    LOG WARNING: "Console Errors gefunden ({console_errors.length} Stueck):"
    FOR error IN console_errors:
      LOG WARNING: "  - {error}"

  # WICHTIG: Console Errors sind Warnings, KEINE Failures
  # Viele Libraries loggen Warnings als console.error
  # Die Pipeline laeuft weiter, auch wenn Console Errors vorhanden sind
```

### 6. Screenshot als Evidence

```
Step 4d: Screenshot (optional)

IF devtools_available:
  TRY:
    screenshot_data = mcp__chrome-devtools__screenshot()
    screenshot_path = ".claude/evidence/{feature}/{slice_id}-smoke.png"
    # Speichere Screenshot-Daten als Datei
    Write(screenshot_path, screenshot_data)
  CATCH:
    screenshot_path = ""
    LOG WARNING: "Screenshot konnte nicht erstellt werden: {error_message}"
```

### 7. Erweiterter JSON Output Contract (Smoke-Stage)

Aktueller Smoke-Output in test-validator.md:

```json
{
  "smoke": {
    "app_started": true,
    "health_status": 200,
    "startup_duration_ms": 4500
  }
}
```

Neuer Smoke-Output (erweitert):

```json
{
  "smoke": {
    "app_started": true,
    "health_status": 200,
    "startup_duration_ms": 4500,
    "smoke_mode": "functional",
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

Bei `health_only` Mode:

```json
{
  "smoke": {
    "app_started": true,
    "health_status": 200,
    "startup_duration_ms": 4500,
    "smoke_mode": "health_only",
    "dom_snapshot": null,
    "console_errors": [],
    "screenshot_path": ""
  }
}
```

Bei Smoke-Failure (App startet nicht):

```json
{
  "smoke": {
    "app_started": false,
    "health_status": 0,
    "startup_duration_ms": 0,
    "smoke_mode": "health_only",
    "dom_snapshot": null,
    "console_errors": [],
    "screenshot_path": ""
  }
}
```

### 8. Erwartete Elemente aus Slice-Spec

Der Coordinator gibt im test-validator Task()-Prompt die erwarteten DOM-Elemente mit, falls in der Slice-Spec (Deliverables) definiert:

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

    ## Smoke Test Expected Elements (aus Slice-Spec Deliverables)
    Expected Elements: {expected_elements_list}
    z.B.: header, nav, main, footer, .dashboard-card

    ...
  "
)
```

Falls keine erwarteten Elemente angegeben: `expected_elements_found` und `missing_elements` werden als leere Arrays zurueckgegeben, `element_count` wird trotzdem geprueft.

### 9. Integration in bestehende Stage 4 Section

Die Aenderungen werden in die bestehende "Stage 4: Smoke Test" Section von test-validator.md eingefuegt. Die bestehenden Steps (App starten, PID merken, Health-Poll, App stoppen) bleiben unveraendert. Die neuen DevTools-Steps werden NACH dem Health-Poll und VOR dem App-Stoppen eingefuegt.

**Bestehende Stage 4 (aktuell, Zeilen 81-87 in test-validator.md):**

```
#### Stage 4: Smoke Test
1. App starten im Hintergrund: `{start_command} &`
2. PID merken
3. Polling-Loop: Alle 1 Sekunde `curl -s -o /dev/null -w "%{http_code}" {health_endpoint}`
4. Timeout: 30 Sekunden
5. Erfolg: HTTP Status 200
6. App stoppen: `kill {PID}`, nach 5s `kill -9 {PID}` falls noch laufend
7. Output fields: app_started, health_status, startup_duration_ms
```

**Neue Stage 4 (erweitert):**

```
#### Stage 4: Smoke Test
1. App starten im Hintergrund: `{start_command} &`
2. PID merken
3. Polling-Loop: Alle 1 Sekunde `curl -s -o /dev/null -w "%{http_code}" {health_endpoint}`
4. Timeout: 30 Sekunden
5. Erfolg: HTTP Status 200
6. [NEU] Chrome DevTools MCP Check:
   a. TRY: mcp__chrome-devtools__navigate(url: "{health_endpoint}")
   b. IF verfuegbar (kein Fehler):
      - DOM Snapshot: mcp__chrome-devtools__accessibility_snapshot()
        -> Parse: element_count, expected_elements_found, missing_elements
        -> Fehlende Elemente = WARNING (kein Failure)
      - Console Logs: mcp__chrome-devtools__console_messages()
        -> Filter: nur level == "error"
        -> Console Errors = WARNING (kein Failure)
      - Screenshot: mcp__chrome-devtools__screenshot()
        -> Speichere unter: .claude/evidence/{feature}/{slice_id}-smoke.png
        -> Fehler bei Screenshot = WARNING (kein Failure)
      - smoke_mode = "functional"
   c. IF nicht verfuegbar (ToolNotFound / MCPError / Timeout):
      - smoke_mode = "health_only"
      - WARNING: "Chrome DevTools MCP nicht verfuegbar -- Smoke Test laeuft im health_only Modus"
7. App stoppen: `kill {PID}`, nach 5s `kill -9 {PID}` falls noch laufend
8. Output fields: app_started, health_status, startup_duration_ms, smoke_mode, dom_snapshot, console_errors, screenshot_path
```

### 10. Truncation-Regeln

| Daten | Max Groesse | Truncation-Strategie |
|-------|-------------|----------------------|
| DOM Snapshot (raw) | 10.000 Zeichen | Truncate, nur element_count/expected/missing im Output |
| Console Errors | 20 Eintraege max | Nur die ersten 20 console.error Eintraege sammeln |
| Console Error Text | 500 Zeichen pro Eintrag | Truncate lange Error-Messages |
| Screenshot | Unbegrenzt | Datei auf Disk, nur Pfad im JSON |

---

## Constraints & Hinweise

**Betrifft:**
- Nur `.claude/agents/test-validator.md` -- Modifikation einer bestehenden Agent-Definition

**Abgrenzung:**
- KEIN ausfuehrbarer Code -- nur eine .md Datei mit Agent-Anweisungen wird modifiziert
- KEINE Aenderung an `slice-impl-coordinator.md` (bereits durch Slice 2 und 3 modifiziert)
- KEINE Aenderung an `code-reviewer.md` (Slice 1)
- KEINE Aenderung an der Stack-Detection-Tabelle in test-validator.md -- die bleibt unveraendert
- KEINE Aenderung an Stage 1-3 (Unit, Integration, Acceptance) oder Stage 5 (Regression)
- KEINE Aenderung an der Final Validation Logik (Phase 3)
- Chrome DevTools MCP ist OPTIONAL -- Smoke Test MUSS auch ohne funktionieren (health_only)
- Console.error = WARNING, NICHT Failure
- DOM-Snapshot missing_elements = WARNING, NICHT Failure

**Architecture Contract:**
- Smoke-Mode MUSS "functional" oder "health_only" sein (aus architecture.md)
- Fallback zu health_only MUSS bei MCP-Nicht-Verfuegbarkeit greifen (aus architecture.md)
- Console Errors = Warning, kein Failure (aus architecture.md Constraints)
- DOM Snapshot MUSS auf max 10.000 Zeichen truncated werden (aus architecture.md Input Validation)
- JSON Output Contract MUSS die Felder smoke_mode, dom_snapshot, console_errors, screenshot_path enthalten (aus architecture.md)

---

## Integration Contract (GATE 2 PFLICHT)

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-03-pipeline-integration | 6-Step Pipeline | Pipeline-Struktur | Phase 4 (Validation) existiert als Erweiterungs-Punkt |
| slice-02-deterministic-pre-test-gate | detected_stack Weitergabe-Pattern | Prompt-Template | test-validator erhaelt `## Stack Info` mit health_endpoint im Task()-Prompt |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Erweiterter Smoke JSON Output | Data Contract | slice-impl-coordinator (Evidence) | `smoke.smoke_mode`, `smoke.dom_snapshot`, `smoke.console_errors`, `smoke.screenshot_path` |
| smoke_mode Feld | Enum | Evidence-Consumers | `"functional"` oder `"health_only"` |

### Integration Validation Tasks

- [ ] Stage 4 in test-validator.md enthaelt die neuen DevTools-Steps (nach Health-Poll, vor App-Stoppen)
- [ ] MCP-Verfuegbarkeits-Check implementiert (TRY/CATCH Pattern)
- [ ] Fallback zu health_only bei MCP-Fehler
- [ ] Console Errors werden als Warnings geloggt, nicht als Failures
- [ ] DOM Snapshot missing_elements werden als Warnings geloggt, nicht als Failures
- [ ] JSON Output Contract enthaelt smoke_mode, dom_snapshot, console_errors, screenshot_path
- [ ] Bestehende Smoke-Felder (app_started, health_status, startup_duration_ms) bleiben unveraendert
- [ ] App wird IMMER gestoppt -- auch wenn DevTools-Steps fehlschlagen

---

## Code Examples (MANDATORY - GATE 2 PFLICHT)

> **KRITISCH:** Alle Code-Beispiele in diesem Dokument sind **PFLICHT-Deliverables**.
> Der Gate 2 Compliance Agent prueft, dass jedes Code-Beispiel implementiert wird.

| Code Example | Section | Mandatory | Notes |
|--------------|---------|-----------|-------|
| MCP-Verfuegbarkeits-Check | Technische Umsetzung > 3. MCP-Verfuegbarkeits-Check | YES | TRY/CATCH Pattern mit mcp__chrome-devtools__navigate |
| DOM Snapshot Abruf und Validierung | Technische Umsetzung > 4. DOM Snapshot | YES | mcp__chrome-devtools__accessibility_snapshot, element_count, expected/missing |
| Console-Error-Sammlung | Technische Umsetzung > 5. Console-Error-Sammlung | YES | mcp__chrome-devtools__console_messages, Filter level == "error" |
| Screenshot als Evidence | Technische Umsetzung > 6. Screenshot | YES | mcp__chrome-devtools__screenshot, Pfad-Konvention |
| Erweiterter JSON Output (functional) | Technische Umsetzung > 7. JSON Output Contract | YES | Vollstaendiges smoke-Objekt mit allen neuen Feldern |
| Erweiterter JSON Output (health_only) | Technische Umsetzung > 7. JSON Output Contract | YES | smoke-Objekt mit null/leeren Feldern |
| Neue Stage 4 (erweitert) | Technische Umsetzung > 9. Integration in bestehende Stage 4 | YES | Vollstaendige erweiterte Stage 4 mit allen Steps 1-8 |
| Expected Elements im Task()-Prompt | Technische Umsetzung > 8. Erwartete Elemente | YES | `## Smoke Test Expected Elements` Section im Prompt |

---

## Acceptance Criteria

1) GIVEN die Datei `.claude/agents/test-validator.md`
   WHEN die Stage 4 Section gelesen wird
   THEN enthaelt sie nach dem Health-Poll (HTTP 200) einen Chrome DevTools MCP Verfuegbarkeits-Check via mcp__chrome-devtools__navigate

2) GIVEN die Datei `.claude/agents/test-validator.md`
   WHEN Chrome DevTools MCP verfuegbar ist (kein Fehler beim navigate-Call)
   THEN wird ein DOM Snapshot via mcp__chrome-devtools__accessibility_snapshot abgerufen und element_count, expected_elements_found, missing_elements geparsed

3) GIVEN die Datei `.claude/agents/test-validator.md`
   WHEN Chrome DevTools MCP verfuegbar ist
   THEN werden Console Logs via mcp__chrome-devtools__console_messages abgerufen und nur Eintraege mit level == "error" als console_errors gesammelt

4) GIVEN die Datei `.claude/agents/test-validator.md`
   WHEN Chrome DevTools MCP verfuegbar ist
   THEN wird optional ein Screenshot via mcp__chrome-devtools__screenshot erstellt und unter `.claude/evidence/{feature}/{slice_id}-smoke.png` gespeichert

5) GIVEN die Datei `.claude/agents/test-validator.md`
   WHEN Chrome DevTools MCP verfuegbar ist und alle Steps erfolgreich
   THEN ist smoke_mode = "functional"

6) GIVEN die Datei `.claude/agents/test-validator.md`
   WHEN Chrome DevTools MCP NICHT verfuegbar ist (ToolNotFound, MCPError, Timeout)
   THEN ist smoke_mode = "health_only" und eine Warning wird geloggt

7) GIVEN die Datei `.claude/agents/test-validator.md`
   WHEN Console Errors im Browser gefunden werden
   THEN werden sie als Warnings geloggt und die Pipeline laeuft weiter (kein Failure)

8) GIVEN die Datei `.claude/agents/test-validator.md`
   WHEN DOM-Snapshot-Elemente fehlen (missing_elements nicht leer)
   THEN werden sie als Warnings geloggt und die Pipeline laeuft weiter (kein Failure)

9) GIVEN die Datei `.claude/agents/test-validator.md`
   WHEN der JSON Output Contract fuer die Smoke-Stage gelesen wird
   THEN enthaelt er die Felder: smoke_mode (string), dom_snapshot (object oder null), console_errors (string array), screenshot_path (string)

10) GIVEN die Datei `.claude/agents/test-validator.md`
    WHEN die App nicht startet (Health-Check Timeout)
    THEN ist smoke_mode = "health_only", dom_snapshot = null, console_errors = [], screenshot_path = ""

11) GIVEN die Datei `.claude/agents/test-validator.md`
    WHEN DevTools-Steps ausgefuehrt werden
    THEN wird die App IMMER gestoppt (kill PID) -- auch wenn ein DevTools-Step fehlschlaegt

12) GIVEN die Datei `.claude/agents/test-validator.md`
    WHEN der DOM Snapshot abgerufen wird
    THEN wird der Raw-Snapshot auf maximal 10.000 Zeichen truncated

---

## Testfaelle

**WICHTIG:** Da dieser Slice eine Agent-Definition (.md Datei) modifiziert und keinen ausfuehrbaren Code, sind die Tests manuell. Die Test-Spec beschreibt, wie die modifizierte Agent-Definition validiert werden kann.

### Test-Datei

**Konvention:** Manuelle Validierung -- keine automatisierte Test-Datei

**Fuer diesen Slice:** Manuelle Pruefung der `.claude/agents/test-validator.md` Datei

### Manuelle Tests

<test_spec>
```markdown
# Manuelle Test-Prozedur fuer test-validator.md (Chrome DevTools Smoke Test)

## Test 1: Stage 4 DevTools-Erweiterung vorhanden
1. Oeffne `.claude/agents/test-validator.md`
2. Suche nach Stage 4 (Smoke Test)
3. Erwartung:
   - Nach Health-Poll (HTTP 200) gibt es einen neuen Block fuer Chrome DevTools MCP
   - Der Block beschreibt: navigate, accessibility_snapshot, console_messages, screenshot
   - smoke_mode wird gesetzt ("functional" oder "health_only")

## Test 2: MCP-Verfuegbarkeits-Check
1. Suche nach dem MCP-Verfuegbarkeits-Check in Stage 4
2. Erwartung:
   - TRY/CATCH Pattern um mcp__chrome-devtools__navigate
   - Bei Erfolg: devtools_available = true
   - Bei Fehler: devtools_available = false, Warning geloggt

## Test 3: Fallback zu health_only
1. Pruefe den Fallback-Pfad in Stage 4
2. Erwartung:
   - smoke_mode = "health_only" wenn MCP nicht verfuegbar
   - Warning-Message enthaelt Hinweis auf health_only Modus
   - Pipeline laeuft weiter (kein Abbruch)

## Test 4: DOM Snapshot
1. Pruefe den DOM-Snapshot-Step
2. Erwartung:
   - mcp__chrome-devtools__accessibility_snapshot() wird aufgerufen
   - element_count wird geparsed
   - expected_elements werden gegen Snapshot geprueft
   - missing_elements werden als Warning geloggt (kein Failure)

## Test 5: Console-Error-Sammlung
1. Pruefe den Console-Error-Step
2. Erwartung:
   - mcp__chrome-devtools__console_messages() wird aufgerufen
   - Nur level == "error" Eintraege werden gesammelt
   - Console Errors = Warning, NICHT Failure
   - Max 20 Eintraege, max 500 Zeichen pro Eintrag

## Test 6: Screenshot
1. Pruefe den Screenshot-Step
2. Erwartung:
   - mcp__chrome-devtools__screenshot() wird aufgerufen
   - Pfad-Konvention: .claude/evidence/{feature}/{slice_id}-smoke.png
   - Fehler bei Screenshot = Warning (kein Failure)

## Test 7: JSON Output Contract (functional)
1. Pruefe den JSON Output Contract fuer smoke_mode "functional"
2. Erwartung:
   - smoke_mode: "functional"
   - dom_snapshot: {element_count, expected_elements_found, missing_elements}
   - console_errors: String Array
   - screenshot_path: Dateipfad

## Test 8: JSON Output Contract (health_only)
1. Pruefe den JSON Output Contract fuer smoke_mode "health_only"
2. Erwartung:
   - smoke_mode: "health_only"
   - dom_snapshot: null
   - console_errors: []
   - screenshot_path: ""

## Test 9: App wird IMMER gestoppt
1. Pruefe ob die App-Stopp-Logik nach den DevTools-Steps kommt
2. Erwartung:
   - App wird gestoppt (kill PID) NACH allen DevTools-Steps
   - Auch wenn ein DevTools-Step fehlschlaegt: App wird trotzdem gestoppt

## Test 10: Bestehende Smoke-Felder unveraendert
1. Pruefe ob die bestehenden Smoke-Felder noch vorhanden sind
2. Erwartung:
   - app_started, health_status, startup_duration_ms bleiben unveraendert
   - Neue Felder sind ZUSAETZLICH, nicht ersetzend

## Test 11: Truncation-Regeln
1. Pruefe ob Truncation-Regeln dokumentiert sind
2. Erwartung:
   - DOM Snapshot: max 10.000 Zeichen
   - Console Errors: max 20 Eintraege
   - Console Error Text: max 500 Zeichen pro Eintrag

## Test 12: Funktionaler Test MIT Chrome DevTools MCP (nach Implementation)
1. Starte eine Test-App (z.B. einfache Next.js App)
2. Stelle sicher dass Chrome DevTools MCP installiert ist
3. Fuehre test-validator im slice_validation Modus aus
4. Pruefe:
   a. smoke_mode == "functional"
   b. dom_snapshot enthaelt element_count > 0
   c. console_errors ist ein Array (kann leer sein)
   d. screenshot_path zeigt auf eine existierende Datei

## Test 13: Funktionaler Test OHNE Chrome DevTools MCP (nach Implementation)
1. Starte eine Test-App
2. Stelle sicher dass Chrome DevTools MCP NICHT installiert ist
3. Fuehre test-validator im slice_validation Modus aus
4. Pruefe:
   a. smoke_mode == "health_only"
   b. dom_snapshot == null
   c. console_errors == []
   d. screenshot_path == ""
   e. Pipeline laeuft trotzdem weiter (kein Failure)
```
</test_spec>

---

## Definition of Done

- [x] Akzeptanzkriterien sind eindeutig & vollstaendig
- [x] Telemetrie/Logging definiert (smoke_mode, console_errors, dom_snapshot in Evidence JSON)
- [x] Sicherheits-/Privacy-Aspekte bedacht (Console-Logs koennen sensible Daten enthalten -- nur bei Smoke-Stage loggen, nicht persistieren)
- [ ] UX/Copy final -- N/A (kein UI)
- [ ] Rollout-/Rollback-Plan -- DevTools-Steps koennen aus Stage 4 entfernt werden, Output Contract zurueck auf 3 Felder

---

## Deliverables (SCOPE SAFEGUARD)

**WICHTIG: Diese Liste wird automatisch vom Stop-Hook validiert. Der Agent kann nicht stoppen, wenn Dateien fehlen.**

<!-- DELIVERABLES_START -->
### Agent-Definition (Modifikation)
- [ ] `.claude/agents/test-validator.md` -- Modifikation: (1) Stage 4 Smoke Test erweitert um Chrome DevTools MCP Steps nach Health-Poll: MCP-Verfuegbarkeits-Check (TRY/CATCH), DOM Snapshot (mcp__chrome-devtools__accessibility_snapshot), Console-Error-Sammlung (mcp__chrome-devtools__console_messages, Filter level=="error"), Screenshot (mcp__chrome-devtools__screenshot), (2) Fallback zu health_only wenn MCP nicht verfuegbar, (3) Console Errors = Warning nicht Failure, (4) DOM missing_elements = Warning nicht Failure, (5) JSON Output Contract erweitert um smoke_mode, dom_snapshot, console_errors, screenshot_path, (6) Truncation-Regeln: DOM max 10.000 Zeichen, Console max 20 Eintraege a 500 Zeichen, (7) Output fields Liste aktualisiert auf 8 Felder
<!-- DELIVERABLES_END -->

**Hinweis fuer den Implementierungs-Agent:**
- Alle Dateien zwischen `<!-- DELIVERABLES_START -->` und `<!-- DELIVERABLES_END -->` sind **Pflicht**
- Der Stop-Hook prueft automatisch ob alle Dateien existieren
- Bei fehlenden Dateien wird der Agent blockiert und muss nachfragen
- Die bestehenden Stages 1-3, 5 und Phase 3 (Final Validation) bleiben KOMPLETT unveraendert
- NUR Stage 4 wird erweitert und der JSON Output Contract aktualisiert
