# Gate 2: Compliance Report -- Slice 08

**Geprüfter Slice:** `specs/phase-7/2026-03-29-prompt-simplification/slices/slice-08-assistant-backend-tools.md`
**Prufdatum:** 2026-03-29

---

## Phase 2: Deterministic Checks

| Check | Status | Detail |
|-------|--------|--------|
| D-1: Metadata | PASS | Alle 4 Felder vorhanden: ID=`slice-08-assistant-backend-tools`, Test=pytest-command, E2E=false, Dependencies=`["slice-02-db-queries-prompt-history"]` |
| D-2: Test-Strategy | PASS | Alle 7 Felder vorhanden: Stack=python-fastapi, Test/Integration/Acceptance/Start Commands, Health Endpoint, Mocking=no_mocks |
| D-3: AC Format | PASS | 7 ACs, alle mit GIVEN/WHEN/THEN |
| D-4: Test Skeletons | PASS | 6 Tests vs 7 ACs. AC-7 ist Meta-AC ("alle Tests gruen") -- wird durch den Test-Run selbst validiert, kein separates Skeleton noetig |
| D-5: Integration Contract | PASS | "Requires From" (1 Eintrag: slice-02) und "Provides To" (4 Eintraege) vorhanden |
| D-6: Deliverables Marker | PASS | Marker vorhanden, 3 Deliverables mit Dateipfaden |
| D-7: Constraints | PASS | 5 Scope-Grenzen, 4 technische Constraints, 2 Architecture-Referenzen, Reuse-Tabelle |
| D-8: Groesse | PASS | 178 Zeilen (unter 400). Test-Skeleton-Codeblock 31 Zeilen -- ueberschreitet 20-Zeilen-Grenze, aber ist mandatiertes Strukturelement (kein Code-Example) |
| D-9: Anti-Bloat | PASS | Keine Code Examples Section, keine ASCII-Art, kein DB-Schema, keine Type-Definitionen |
| D-10: Codebase Reference | PASS | Alle 3 MODIFY-Dateien existieren: `prompt_tools.py` (draft_prompt, refine_prompt gefunden), `prompts.py` (_BASE_PROMPT gefunden), `state.py` (PromptAssistantState gefunden) |

**Phase 2 Verdict:** PASS

---

## Phase 3: LLM Content Checks

### L-1: AC-Qualitaet

| AC | Testbarkeit | Spezifitaet | GIVEN | WHEN | THEN | Status |
|----|-------------|-------------|-------|------|------|--------|
| AC-1 | Ja -- Dict-Key-Check | Konkret: "GENAU ein Key `prompt`" + negierte Keys | Praezise: collected_info mit subject | Eindeutig: invoke-Aufruf | Messbar: Key-Pruefung + nicht-leerer String | PASS |
| AC-2 | Ja -- Equality-Check | Konkret: exakter Return-Wert angegeben | Praezise: Dict mit prompt-Key | Eindeutig: invoke-Aufruf | Messbar: exakter Vergleich + negierte Keys | PASS |
| AC-3 | Ja -- Exception-Check | Konkret: ValueError/ToolException + "subject" in Message | Praezise: leeres Dict | Eindeutig: invoke-Aufruf | Messbar: Exception-Typ + Message-Pruefung | PASS |
| AC-4 | Ja -- Dict-Key-Check | Konkret: "GENAU ein Key `prompt`" + negierte Keys | Praezise: current_draft + feedback | Eindeutig: invoke-Aufruf | Messbar: Key-Pruefung + nicht-leerer String | PASS |
| AC-5 | Ja -- String-Search | Konkret: negierte Substrings + positive Anweisung | Praezise: spezifische Datei + Variable | Eindeutig: String-Pruefung | Messbar: contains/not-contains | PASS |
| AC-6 | Ja -- String-Search | Konkret: Docstring-Referenz auf "prompt" | Praezise: spezifische Datei + Klasse | Eindeutig: Docstring-Pruefung | Messbar: Referenz-Check | PASS |
| AC-7 | Ja -- Test-Run | Meta-AC, validiert Gesamtheit | Praezise: geaenderte Tools | Eindeutig: pytest-Command | Messbar: 0 failures, 0 errors | PASS |

**L-1 Status:** PASS -- Alle 7 ACs sind testbar, spezifisch und messbar.

### L-2: Architecture Alignment

| Aspekt | Pruefung | Status |
|--------|----------|--------|
| Python Backend Changes | Architecture fordert: `draft_prompt` returns `{prompt}`, `refine_prompt` returns `{prompt}`, System prompt 1-field, `PromptAssistantState.draft_prompt` 1 key. Slice deckt alle 3 Deliverables ab (prompt_tools.py, prompts.py, state.py). | PASS |
| SSE Contract Change | Architecture fordert Payload `{prompt: string}`. Slice "Provides To" deklariert SSE `tool-call-result` Payload als `{"prompt": str}`. Konsistent. | PASS |
| DraftPromptDTO | Architecture fordert DraftPromptDTO-Aenderung. Slice schliesst dtos.py explizit aus Scope aus ("eigener Slice oder spaeter"). `slim-slices.md` bestaetigt slice-09+ fuer DTO. Korrektes Scoping. | PASS |
| post_process_node | Architecture sagt "No change needed -- generic dict handler". Slice Constraints sagen "KEINE Aenderungen an graph.py". Konsistent. | PASS |

**L-2 Status:** PASS -- Alle Architecture-Vorgaben sind korrekt referenziert und umgesetzt.

### L-3: Integration Contract Konsistenz

| Aspekt | Pruefung | Status |
|--------|----------|--------|
| Requires: slice-02 | slice-02 "Provides To" listet bereinigte Query Functions (ohne promptStyle/negativePrompt). Slice-08 braucht konsistente DB-Daten. Typkompatibel -- slice-08 arbeitet auf Python-Tool-Ebene, nicht direkt auf DB-Queries. Dependency ist korrekt (Backend-Tools brauchen konsistente History-Daten fuer Session-Restore). | PASS |
| Provides: draft_prompt Tool | Interface `draft_prompt(collected_info: dict) -> {"prompt": str}`. Consumer slice-09 (Assistant Frontend) braucht 1-Feld-Payload fuer SSE-Parsing. Konsistent mit Architecture SSE Contract Change. | PASS |
| Provides: refine_prompt Tool | Interface `refine_prompt(current_draft: dict, feedback: str) -> {"prompt": str}`. Gleicher Consumer, gleiche Konsistenz. | PASS |
| Provides: SSE Payload | `{"prompt": str}` -- konsistent mit Architecture "Payload (target)". | PASS |
| Provides: _BASE_PROMPT | Intern (graph.py) -- korrekt als interner Consumer deklariert. | PASS |

**L-3 Status:** PASS

### L-4: Deliverable-Coverage

| Deliverable | Abgedeckt durch ACs | Status |
|-------------|---------------------|--------|
| `prompt_tools.py` (draft_prompt) | AC-1, AC-2, AC-3 | PASS |
| `prompt_tools.py` (refine_prompt) | AC-4 | PASS |
| `prompts.py` (_BASE_PROMPT) | AC-5 | PASS |
| `state.py` (Docstring) | AC-6 | PASS |
| Test-Validierung | AC-7 | PASS |

Kein Deliverable verwaist, jedes AC referenziert mindestens ein Deliverable.

**L-4 Status:** PASS

### L-5: Discovery Compliance

| Aspekt | Pruefung | Status |
|--------|----------|--------|
| Business Rule: 1-Feld-Output | Discovery fordert "Assistant auf 1-Feld-Output umbauen". AC-1, AC-2, AC-4 validieren exakt dieses Verhalten. | PASS |
| Business Rule: negative_prompt entfernen | Discovery fordert negative_prompt-Entfernung. AC-1, AC-4 prufen negierte Keys (kein negative_prompt). AC-5 pruft System-Prompt. | PASS |
| Business Rule: prompt_tools.py Pfad | Discovery listet `backend/app/agent/prompt_tools.py`. Architecture Research Log korrigiert auf `backend/app/agent/tools/prompt_tools.py`. Slice nutzt korrekten Pfad. | PASS |
| Business Rule: state.py anpassen | Discovery fordert "state.py draft_prompt vereinfachen". AC-6 deckt dies ab. | PASS |
| Business Rule: prompts.py anpassen | Discovery fordert "prompts.py System-Prompt anpassen". AC-5 deckt dies ab. | PASS |

**L-5 Status:** PASS

### L-6: Consumer Coverage

Slice-08 modifiziert `draft_prompt()` und `refine_prompt()` in `prompt_tools.py` -- Return-Shape aendert sich von `{motiv, style, negative_prompt}` auf `{prompt}`.

**Aufrufer identifiziert via Grep:**

| Aufrufer | Call-Pattern | Coverage | Status |
|----------|-------------|----------|--------|
| `graph.py:post_process_node` | Generischer dict-Handler: `updates[state_field] = content` (line 154). Arbeitet mit beliebigem dict, kein Key-Zugriff. | Keine AC noetig -- generisch. Constraint bestaetigt: "KEINE Aenderungen an graph.py". | PASS |
| `graph.py:ALL_TOOLS` | Import + Tool-Registrierung (line 30, 37). Kein Zugriff auf Return-Value. | Nicht betroffen. | PASS |
| `assistant_service.py:get_session_state` | Liest `state["draft_prompt"]` und mappt auf `DraftPromptDTO(motiv=..., style=..., negative_prompt=...)` (lines 381-385). Nach Slice-08 wuerde `raw_draft.get("motiv", "")` leere Strings liefern. | Bewusst deferred: Slice-08 Constraints sagen "KEINE Aenderungen an dtos.py". `DraftPromptDTO`-Anpassung ist in einem Folge-Slice (slim-slices.md: slice-09+). Zwischen Slice-08 und dem DTO-Slice besteht ein temporaerer Mismatch bei Session-Restore. | HINWEIS |

**Bewertung:** Der `assistant_service.py`-Consumer ist ein bekannter temporaerer Mismatch, der durch die Slice-Reihenfolge entsteht. Die Architecture listet `DraftPromptDTO` als eigenes Arbeitspaket. Das Slice-08 dokumentiert die Abgrenzung explizit in den Constraints. Solange die Slices in Reihenfolge deployed werden (atomic deploy pro Feature-Branch), ist dies akzeptabel. Dies ist kein Blocking Issue, da der Slice korrekt scoped ist und den Mismatch dokumentiert.

**L-6 Status:** PASS (mit Hinweis auf temporaeren Mismatch bei Session-Restore zwischen Slice-08 und dem DraftPromptDTO-Slice)

---

## Blocking Issues

Keine.

---

## Verdict

**VERDICT: APPROVED**

**Blocking Issues:** 0

**Hinweise (nicht-blockend):**
1. Test-Skeleton-Codeblock hat 31 Zeilen (D-8 Grenze: 20). Akzeptiert als mandatiertes Strukturelement.
2. Temporaerer Mismatch bei `assistant_service.py` Session-Restore zwischen Slice-08 (tools return `{prompt}`) und dem noch ausstehenden DraftPromptDTO-Slice (erwartet `{motiv, style, negative_prompt}`). Korrekt dokumentiert in Constraints.
