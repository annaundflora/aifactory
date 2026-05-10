# Slice 25: Multi-Reference-Interview Eval-Suite

> **Slice 25 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-25-multi-reference-eval` |
| **Test** | `cd backend && python -m pytest tests/agent/test_multi_reference_flow.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["24-slot-tool-frontend-handler", "12-base-prompt-rewrite-interview"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

> **Quelle:** Auto-detected — Python/FastAPI + LangGraph + pytest. Reine Eval-Suite ohne Produktiv-Code: validiert das in Slice 12 formulierte sequenzielle Multi-Reference-Verhalten gegen ein 3-Slot-Szenario. Mock-Pattern wie in Slice 12 (`AsyncMock` über LLM-Aufrufe; Mock-Responses simulieren `tool_calls` mit `set_slot_role`-Payloads). Discovery-Slice K bestätigt: kein eigener Code-Slice, Verhalten lebt im `_BASE_PROMPT`, hier nur die Eval-Suite.

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi + langgraph + pytest` |
| **Test Command** | `cd backend && python -m pytest tests/agent/test_multi_reference_flow.py -v` |
| **Integration Command** | `cd backend && python -m pytest tests/agent/ -v` |
| **Acceptance Command** | `cd backend && python -m pytest tests/agent/test_multi_reference_flow.py -v` |
| **Start Command** | `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | `GET http://localhost:8000/health` |
| **Mocking Strategy** | `mock_external` — LLM-Aufrufe via `AsyncMock`/`MagicMock` mit vorgegebenen `AIMessage`-Sequenzen (incl. `tool_calls`-Felder). Kein Live-OpenRouter-Call; deterministische Eval-Cases. Tool-Definitionen aus Slice 23 (`set_slot_role`) werden direkt aus dem Modul importiert — kein Mock auf Tool-Bodies. |

---

## Ziel

Pytest-Eval-Suite, die das in Slice 12 (`_BASE_PROMPT`) definierte sequenzielle Multi-Reference-Interview-Verhalten gegen ein 3-Slot-Szenario verifiziert: bei drei belegten ReferenceBar-Slots stellt der Assistant pro Slot eine Klärungsfrage und ruft `set_slot_role` mit dem korrekten `slot_index` auf, bevor er zum nächsten Slot fortschreitet. Kein eigener Produktiv-Code; ausschließliches Verhaltens-Gate für Slice K (Discovery).

---

## Acceptance Criteria

1) **GIVEN** eine simulierte Assistant-Session mit `generation_mode="img2img"` und drei belegten Reference-Slots (`slot_index ∈ {0, 1, 2}`, jeweils `image_url` populated, `role=None`, `strength=None`) als initialer Workspace-Snapshot in `SendMessageRequest.reference_slots`
   **WHEN** das Eval-Setup einen vorgemockten LLM-Stream startet, in dem die Mock-Antworten der Reihenfolge nach (a) eine deutsche Klärungsfrage zu Slot 0, (b) `tool_calls=[{"name": "set_slot_role", "args": {"slot_index": 0, "role": "subject"}}]`, (c) eine Klärungsfrage zu Slot 1, (d) `tool_calls=[{"name": "set_slot_role", "args": {"slot_index": 1, "role": "style"}}]`, (e) eine Klärungsfrage zu Slot 2, (f) `tool_calls=[{"name": "set_slot_role", "args": {"slot_index": 2, "role": "composition"}}]` zurückgeben
   **THEN** die Eval verifiziert, dass über die simulierten Turns insgesamt genau drei `set_slot_role`-Tool-Calls stattfinden, jeder Call eine eindeutige `slot_index`-Wert besitzt, und die Multimenge `{slot_index: 0, 1, 2}` exakt einmal abgedeckt ist (KEINE Duplikate, KEIN Überspringen).

2) **GIVEN** dieselbe 3-Slot-Session
   **WHEN** die Reihenfolge der `set_slot_role`-Calls inspiziert wird
   **THEN** sie ist strikt aufsteigend (`slot_index=0` vor `slot_index=1` vor `slot_index=2`); KEIN Out-of-Order-Call (z.B. Slot 2 vor Slot 0). Discovery-Quelle: "ein Bild nach dem anderen" (Slice K Flow-Schritte 3–5).

3) **GIVEN** dieselbe 3-Slot-Session
   **WHEN** die Eval die Assistant-Text-Antworten zwischen den Tool-Calls inspiziert
   **THEN** vor jedem `set_slot_role(slot_index=N)`-Call existiert mindestens eine Assistant-Message im Turn-Log, die textuell auf Slot N referenziert (z.B. Substring-Match auf `"Slot N"` ODER `"Bild N"` ODER `"erste/zweite/dritte"` — Implementer-Wahl, mind. einer der drei Patterns für jeden Slot). Verhinderungs-Test gegen "Tool-Call ohne vorheriges Klärungs-Statement".

4) **GIVEN** ein Eval-Case mit nur ZWEI belegten Slots (`slot_index ∈ {0, 1}`) — 3-Slot-Logik darf nicht über belegte Slot-Anzahl hinaus fragen
   **WHEN** der Mock-Stream nach zwei `set_slot_role`-Calls eine reguläre Folge-Frage zum Gesamt-Intent emittiert (Discovery-Schritt 5: "Nach letztem Bild: weitere Fragen nach Gesamt-Intent")
   **THEN** die Eval verifiziert, dass GENAU 2 `set_slot_role`-Calls stattfinden (kein dritter Call mit `slot_index=2` für einen leeren Slot); der Assistant geht NICHT von einer fixen Slot-Anzahl aus, sondern von der tatsächlichen Anzahl belegter Slots.

5) **GIVEN** ein Eval-Case mit drei belegten Slots, in dem der User einen Slot frühzeitig als "egal" / "ignoriere" markiert (User-Antwort: `"Bild 1 ist nicht wichtig, lass es weg"`)
   **WHEN** der Mock-LLM-Response für diesen Slot KEINEN `set_slot_role`-Call enthält und stattdessen direkt zur nächsten Slot-Frage übergeht
   **THEN** die Eval verifiziert, dass es OK ist, dass für ignorierten Slot kein `set_slot_role` gerufen wird; das Verhalten ist nicht erzwungen sondern an die User-Antwort gekoppelt. (Negativ-Test: kein Crash, kein Validierungs-Fehler, sequenzielle Reihenfolge der verbleibenden Calls bleibt aufsteigend.)

6) **GIVEN** der `_BASE_PROMPT`-String aus Slice 12 wird als System-Message in den Eval-Run injiziert (Substring-Match-Vertrag aus Slice 12 AC-1, AC-5)
   **WHEN** die Eval-Suite startet
   **THEN** die Eval verifiziert, dass der Prompt mindestens die Pflicht-Phrasen `"set_slot_role"` UND (`"sequenziell"` ODER `"ein Bild nach dem anderen"`) enthält. Damit ist die Verhaltens-Voraussetzung aus Slice 12 erfüllt; Slice 25 ist ein reines Eval-Gate, KEIN Prompt-Re-Test.

7) **GIVEN** das Eval-Set besteht aus den Cases AC-1 (Happy-Path 3-Slot-Sequenz), AC-4 (2-Slot-Variante), AC-5 (Slot-Skip via User-Wunsch)
   **WHEN** die Suite ausgeführt wird
   **THEN** alle drei Cases sind grün; das Done-Signal "3-Slot-Session-Mock → Assistant stellt 3 sequenzielle Fragen, ruft `set_slot_role` 3-mal mit eindeutigen `slot_index`-Werten" ist mit AC-1 abgedeckt.

8) **GIVEN** die Eval-Suite ist eine reine Verifikations-Suite
   **WHEN** Tool-Imports geprüft werden
   **THEN** das Eval-File importiert `set_slot_role` aus `app.agent.tools.workspace_tools` (Slice 23) zur Schema-Verifikation der Mock-`tool_calls.args` (Pydantic-Schema-Konformität); KEINE Re-Implementierung, KEIN Mock auf das Tool selbst.

9) **GIVEN** das Eval-File wird isoliert ausgeführt
   **WHEN** der Test-Runner `pytest tests/agent/test_multi_reference_flow.py -v` ausführt
   **THEN** alle Tests laufen ohne Live-LLM-Call, ohne Live-FastAPI-Server, ohne DB-Connection; ausschließlich `AsyncMock`/`MagicMock` auf den LLM-Layer. Konsistent mit der Mocking-Strategie aus Slice 12 (`mock_external`).

---

## Test Skeletons

> **Hinweis:** Dieser Slice IST selbst die Eval-Suite — das Deliverable `test_multi_reference_flow.py` ist die Test-Datei. Die folgenden Skeletons sind die zu schreibenden Eval-Cases als `pytest.mark.skip`-Marker mit AC-Reason, die der Test-Writer-Agent anschließend befüllt. KEIN Code-Inhalt — nur Skeleton-Signaturen.

### Test-Datei: `backend/tests/agent/test_multi_reference_flow.py`

<test_spec>
```python
import pytest

# AC-1: Happy-Path 3-Slot-Sequenz — exakt 3 set_slot_role-Calls mit eindeutigen slot_index ∈ {0,1,2}
@pytest.mark.skip(reason="AC-1: 3-slot session yields exactly 3 set_slot_role calls covering slot_index {0,1,2} once each")
@pytest.mark.asyncio
async def test_eval_three_slot_session_emits_three_unique_set_slot_role_calls():
    ...

# AC-2: Strenge aufsteigende Reihenfolge slot_index 0 → 1 → 2
@pytest.mark.skip(reason="AC-2: set_slot_role calls occur in strictly ascending slot_index order")
@pytest.mark.asyncio
async def test_eval_three_slot_session_calls_are_in_ascending_order():
    ...

# AC-3: Vor jedem Tool-Call existiert eine Slot-N-referenzierende Assistant-Message
@pytest.mark.skip(reason="AC-3: each set_slot_role call is preceded by an assistant message referencing the matching slot")
@pytest.mark.asyncio
async def test_eval_each_tool_call_has_preceding_slot_reference_message():
    ...

# AC-4: 2-Slot-Variante — exakt 2 Tool-Calls, kein dritter für leeren Slot
@pytest.mark.skip(reason="AC-4: 2-slot session yields exactly 2 set_slot_role calls; no fabricated call for empty slot")
@pytest.mark.asyncio
async def test_eval_two_slot_session_emits_only_two_calls():
    ...

# AC-5: User markiert Slot als "egal" → kein Tool-Call für diesen Slot, sequence der verbleibenden bleibt OK
@pytest.mark.skip(reason="AC-5: user-skipped slot results in no set_slot_role call for that slot; remaining sequence stays ascending")
@pytest.mark.asyncio
async def test_eval_user_skipped_slot_omits_tool_call():
    ...

# AC-6: _BASE_PROMPT enthaelt die Pflicht-Phrasen aus Slice 12 (Verhaltens-Voraussetzung)
@pytest.mark.skip(reason="AC-6: _BASE_PROMPT contains 'set_slot_role' and one of {'sequenziell','ein Bild nach dem anderen'}")
def test_base_prompt_contains_multi_reference_phrases():
    ...

# AC-7: Aggregat-Gate — die drei Kern-Cases (AC-1, AC-4, AC-5) sind alle gruen
@pytest.mark.skip(reason="AC-7: at least 3 multi-reference eval cases pass — done-signal gate")
def test_eval_set_minimum_three_cases_pass():
    ...

# AC-8: set_slot_role wird aus Slice 23 importiert; Mock tool_calls.args validieren das Pydantic-Schema
@pytest.mark.skip(reason="AC-8: mock tool_calls.args conform to the imported set_slot_role Pydantic schema (no re-implementation)")
def test_mock_tool_call_args_conform_to_set_slot_role_schema():
    ...

# AC-9: Suite laeuft offline (kein Live-LLM, kein Server, keine DB)
@pytest.mark.skip(reason="AC-9: eval suite runs without live LLM, server, or DB — only AsyncMock-driven")
def test_eval_suite_runs_fully_mocked_offline():
    ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-12-base-prompt-rewrite-interview` | `_BASE_PROMPT` Module-Level-String mit Multi-Reference-Pflicht-Phrasen | Python string constant | Substring-Match: `"set_slot_role"` und (`"sequenziell"` ODER `"ein Bild nach dem anderen"`) sind im Prompt-Text vorhanden (AC-6 dieses Slice; AC-1+AC-5 von Slice 12) |
| `slice-23-i2i-settings-tools` | `set_slot_role` LangChain `@tool`-Symbol mit Pydantic-Schema | `BaseTool` | `from app.agent.tools.workspace_tools import set_slot_role` erfolgreich; `set_slot_role.name == "set_slot_role"`; `args_schema` valide für `{slot_index: int >= 0, role: Literal["subject","style","composition"]}` |
| `slice-24-slot-tool-frontend-handler` | (Verhaltens-Vertrag, kein Code-Import) | Frontend-Reducer-Wirkung | Bestätigt nur kontextuell, dass der gesamte End-to-End-Pfad geschlossen ist; dieser Slice testet ausschließlich das Backend-LLM-Verhalten |
| Bestehender Mock-Pattern | `AsyncMock` über LLM-Layer wie in Slice 12 (`tests/unit/test_base_prompt_eval.py`) | Test-Pattern | Wird hier wiederverwendet; KEINE Neu-Erfindung |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Verhaltens-Gate "Sequenzielles Multi-Reference (Slice K)" | Pytest-Suite (3-Slot-Eval-Cases) | Discovery-Slice K (Flow-Verifikation) | Pytest-Run grün → Done-Signal aus `slim-slices.md` Slice 25 erfüllt |
| (kein produktiver Export) | -- | -- | Reine Test-Suite, KEINE Symbole für nachfolgende Slices |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/tests/agent/test_multi_reference_flow.py` — NEW: Eval-Suite-Datei mit den in Test-Skeletons skizzierten `pytest.mark.skip`-Markern; Test-Writer-Agent füllt die Bodies. Suite ist **selbst** das Deliverable (Eval-only Slice — siehe Hinweis unten). Verzeichnis `backend/tests/agent/` muss angelegt werden inkl. `__init__.py` (falls Repo-Convention dies erfordert; Implementer prüft `backend/tests/unit/__init__.py`-Pattern).
<!-- DELIVERABLES_END -->

> **Hinweis (Sonderfall Eval-only Slice):** Slice 25 ist explizit als "Eval-Suite" definiert (Discovery Slice K, slim-slices.md Slice 25). Die Test-Datei IST das Deliverable. Es gibt KEIN zusätzliches Produktiv-File. Test-Writer-Agent ersetzt die `skip`-Marker durch konkrete Implementierungen (Mock-Setup + Assertions) basierend auf den ACs.

---

## Constraints

**Scope-Grenzen:**
- KEIN Produktiv-Code — kein neues Tool, kein Service, kein DTO, kein Frontend-Code
- KEINE Änderung an `_BASE_PROMPT` (Slice 12 ist Owner) — dieser Slice **liest** den Prompt nur per Substring-Match
- KEIN Live-LLM-Call, KEIN Live-FastAPI-Server, KEIN DB-Zugriff in der Suite
- KEINE Re-Implementierung von `set_slot_role` — Tool wird aus Slice 23 importiert, nur Schema-Verifikation auf Mock-Args
- KEINE Tests für `set_slot_strength` oder `set_model_params` (gehören zu Slice 23)
- KEINE Frontend-Reducer-Tests (gehören zu Slice 24)
- KEIN Playwright/E2E (Discovery führt zwar "Playwright: 3-Slots-Interview läuft sequenziell durch" auf, aber die slim-slices.md Slice 25 spezifiziert ausdrücklich Pytest-Eval; Playwright-Verifikation ist NICHT Teil dieses Slice)

**Technische Constraints:**
- Mock-Pattern konsistent mit Slice 12: `AsyncMock` auf den LLM-Layer (`ChatOpenRouter` oder Equivalent), Mock-Responses sind `AIMessage`-Sequenzen mit `tool_calls`-Feldern
- Eval-Cases sind deterministisch — keine Random-Mocks, keine Time-Abhängigkeit
- Schema-Verifikation der Mock-`tool_calls.args` erfolgt via `set_slot_role.args_schema(**args)` (Pydantic-Validation; wirft bei Schema-Verstoß)
- Test-Datei nutzt `pytest.mark.asyncio` für async-Mocks (Pattern aus `test_base_prompt_eval.py` in Slice 12)
- Verzeichnis `backend/tests/agent/` muss neu angelegt werden — Implementer prüft, ob ein `__init__.py` benötigt wird (siehe Repo-Convention in `backend/tests/unit/`, `backend/tests/integration/`)
- Sprache: Test-Funktionsnamen Englisch (Repo-Convention); Skip-Reasons referenzieren AC-Nummer + Kurzbeschreibung
- KEINE Snapshot-Tests von kompletten Mock-Streams — die Cases prüfen Tool-Call-Counts und `slot_index`-Werte, nicht den vollständigen Output

**Mock-Setup-Constraints (für Test-Writer):**
- Mock-LLM-Response-Stream-Sequenz für AC-1 muss exakt sechs `AIMessage`-Returns enthalten (3 Klärungsfragen + 3 Tool-Calls), wechselnd Text-Antwort und Tool-Call
- `tool_calls`-Items haben das LangChain-Format `{"name": str, "args": dict, "id": str}`
- `slot_index`-Werte in Mock-Args MÜSSEN Integers sein (kein String) — Pydantic-Schema-Constraint aus Slice 23 AC-2

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `backend/tests/unit/test_base_prompt_eval.py` (aus Slice 12) | Pattern-Vorlage: `AsyncMock`-LLM-Layer, `tool_calls`-Mock-Format, `pytest.mark.asyncio`. NICHT verändern, NICHT importieren — nur als Referenz. |
| `backend/app/agent/tools/workspace_tools.py` (aus Slice 23) | IMPORT `set_slot_role` zur Schema-Verifikation auf Mock-`tool_calls.args` (AC-8). NICHT verändern. |
| `backend/app/agent/prompts.py` (`_BASE_PROMPT`) | IMPORT zur Substring-Verifikation der Pflicht-Phrasen (AC-6). NICHT verändern. |
| `backend/tests/integration/test_sse_streaming_integration.py` (`fake_astream_events`-Pattern) | Optionale Pattern-Vorlage, falls die Suite eine `astream_events`-basierte Variante benötigt. Implementer-Wahl. NICHT verändern. |

**Referenzen:**
- Discovery: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/discovery.md` → Slice K "Multi-Reference-Interview-Flow" (Abhängigkeiten I, J, E; "Kein eigener Code-Slice")
- Discovery: gleiche Datei → Section "Flow" → Schritte 3–5 (sequenzielles Slot-Interview, Tool-Call pro Slot, danach Gesamt-Intent-Fragen)
- Architecture: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/architecture.md` → API Endpoints → "LangGraph Tool Schemas" (Schema für `set_slot_role`: `slot_index: int (0..N-1)`, `role: "subject"|"style"|"composition"`)
- Architecture: gleiche Datei → Server Logic → Validation Rules (Zeilen 343–344): `set_slot_role.role` enum, `slot_index` non-negative
- Architecture: gleiche Datei → Section zu Slice K (Zeile 357): Verhaltensregeln im `_BASE_PROMPT`-Rewrite, Eval-Tests gehören hierher
- Slice 12 (`slice-12-base-prompt-rewrite-interview.md`): AC-1 (Pflicht-Phrasen incl. `"set_slot_role"`) + AC-5 (sequenzielle Multi-Reference-Regel im Prompt)
- Slice 23 (`slice-23-i2i-settings-tools.md`): Tool-Definition + Pydantic-Schema-Vertrag (AC-1 bis AC-4)
- slim-slices.md → Slice 25 Done-Signal: "3-Slot-Session-Mock → Assistant stellt 3 sequenzielle Fragen, ruft `set_slot_role` 3-mal mit eindeutigen `slot_index`-Werten"
- Wireframes: nicht relevant (Backend-only, Eval-Suite)
