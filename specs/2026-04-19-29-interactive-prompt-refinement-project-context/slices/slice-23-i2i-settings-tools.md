# Slice 23: i2i-Settings-Tools (`set_slot_role`, `set_slot_strength`, `set_model_params`)

> **Slice 23 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-23-i2i-settings-tools` |
| **Test** | `cd backend && python -m pytest tests/unit/test_workspace_tools.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["13-emit-intent-summary-tool"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

> **Quelle:** Auto-detected — Python/FastAPI + LangGraph + LangChain `@tool` + pytest. Drei `@tool`-Funktionen mit Pydantic-`args_schema`. Tool-Aufrufe direkt via `tool.invoke({...})` (LangChain BaseTool API). Vorbild: `slice-13-emit-intent-summary-tool` (Pydantic-Validation pro Tool) und `backend/app/agent/tools/model_tools.py` (Decorator-Stil). Kein Live-LLM-Call.

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi + langgraph + langchain-core + pytest` |
| **Test Command** | `cd backend && python -m pytest tests/unit/test_workspace_tools.py -v` |
| **Integration Command** | `cd backend && python -m pytest tests/integration/test_workspace_tools_registry.py -v` |
| **Acceptance Command** | `cd backend && python -m pytest tests/unit/test_workspace_tools.py tests/integration/test_workspace_tools_registry.py -v` |
| **Start Command** | `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | `GET http://localhost:8000/health` |
| **Mocking Strategy** | `no_mocks` für Pydantic-Validation; `set_model_params` ruft das existierende `prompt_knowledge`-Modul direkt — kein Mock benötigt, da das Modul disk-basiert mit Cache arbeitet. |

---

## Ziel

Drei neue LangChain-`@tool`-Definitionen (`set_slot_role`, `set_slot_strength`, `set_model_params`) in einem neuen Modul `workspace_tools.py` einführen. Tools validieren Payloads via Pydantic; `set_model_params` validiert zusätzlich gegen die Modell-Knowledge des aktiven Image-Models. Tool-Bodies sind reine Echo-Roundtrips — keine LangGraph-State-Persistenz, kein Workspace-Apply (das macht Slice 24 frontend-seitig via SSE-`tool-result`).

---

## Acceptance Criteria

1) **GIVEN** das neue Modul `backend/app/agent/tools/workspace_tools.py` existiert
   **WHEN** `from app.agent.tools.workspace_tools import set_slot_role, set_slot_strength, set_model_params` ausgeführt wird
   **THEN** alle drei Symbole sind Instanzen von `langchain_core.tools.BaseTool`; `set_slot_role.name == "set_slot_role"`, `set_slot_strength.name == "set_slot_strength"`, `set_model_params.name == "set_model_params"`.

2) **GIVEN** `set_slot_role` ist mit Pydantic-Schema `{slot_index: int >= 0, role: Literal["subject","style","composition"]}` definiert (Schema-Quelle: `architecture.md → API Endpoints → LangGraph Tool Schemas`, Zeile mit `set_slot_role`)
   **WHEN** `set_slot_role.invoke({"slot_index": 1, "role": "style"})` aufgerufen wird
   **THEN** Rückgabe-Dict spiegelt den Payload: `{"slot_index": 1, "role": "style"}`; keine Exception.

3) **GIVEN** `set_slot_role` mit `role`-Literal-Constraint
   **WHEN** `set_slot_role.invoke({"slot_index": 0, "role": "background"})` aufgerufen wird
   **THEN** `pydantic.ValidationError` (oder LangChain-Wrapper-Equivalent) wird geworfen — Tool-Output ist KEIN Erfolgs-Dict. Constraint laut `architecture.md → Validation Rules` (`set_slot_role.role` enum).

4) **GIVEN** `set_slot_role` mit `slot_index >= 0`-Constraint
   **WHEN** `set_slot_role.invoke({"slot_index": -1, "role": "subject"})` aufgerufen wird
   **THEN** `ValidationError` wird geworfen (negative `slot_index` nicht zulässig).

5) **GIVEN** `set_slot_strength` ist mit Schema `{slot_index: int >= 0, strength: float 0.0..1.0}` definiert
   **WHEN** `set_slot_strength.invoke({"slot_index": 2, "strength": 0.65})` aufgerufen wird
   **THEN** Rückgabe-Dict spiegelt den Payload: `{"slot_index": 2, "strength": 0.65}`; keine Exception.

6) **GIVEN** `set_slot_strength` mit `strength`-Range-Constraint (`0.0..1.0` inklusive)
   **WHEN** `set_slot_strength.invoke({"slot_index": 0, "strength": 1.7})` aufgerufen wird
   **THEN** `ValidationError` wird geworfen mit Hinweis auf Wertebereich. `strength = 0.0` und `strength = 1.0` sind GÜLTIG (Boundary-Test).

7) **GIVEN** `set_model_params` ist mit Schema `{params: dict}` definiert
   **WHEN** `set_model_params.invoke({"params": {"aspect_ratio": "16:9", "guidance": 7}})` mit aktivem Modell `"black-forest-labs/flux-2-max"` (via `RunnableConfig.configurable["image_model_id"]`) aufgerufen wird, und alle Keys existieren als zulässige Param-Felder in der Modell-Knowledge des aktiven Models
   **THEN** Rückgabe-Dict enthält `{"params": {"aspect_ratio": "16:9", "guidance": 7}}`; keine Exception.

8) **GIVEN** `set_model_params` mit unbekanntem Param-Key, der NICHT in der Modell-Knowledge des aktiven Image-Models gelistet ist
   **WHEN** das Tool mit `{"params": {"unknown_field": 42}}` und aktivem Modell `"black-forest-labs/flux-2-max"` aufgerufen wird
   **THEN** das Tool gibt einen Error-Dict mit Schlüssel `"error"` zurück (Pattern: `{"error": "Unbekannter Parameter '<key>' fuer Modell '<model_id>'"}`) — ODER es wirft eine `ValueError`/`ToolException`. Implementer-Wahl entsprechend dem im Slice 13 etablierten Stil. Wichtig: das Tool darf NICHT erfolgreich mit dem invaliden Payload zurückkehren.

9) **GIVEN** `set_model_params` ohne aktives `image_model_id` im LangGraph-Config (z.B. fehlt in `configurable`)
   **WHEN** das Tool aufgerufen wird
   **THEN** das Tool gibt einen Error-Dict zurück (kein Crash); Validierung gegen Modell-Knowledge wird übersprungen oder explizit als Fehler markiert. Verhalten konsistent mit dem Risk-Mitigation-Eintrag in `architecture.md → Risks & Mitigations` ("Tool returns error → assistant retries or asks user").

10) **GIVEN** alle drei Tools sind in `backend/app/agent/graph.py` registriert
    **WHEN** `from app.agent.graph import ALL_TOOLS, TOOL_STATE_MAPPING` ausgeführt wird
    **THEN** alle drei Namen sind in `[t.name for t in ALL_TOOLS]` enthalten; KEINER der drei Namen ist Schlüssel in `TOOL_STATE_MAPPING` (Tools persistieren NICHT im State — Architecture Q17 bestätigt). Bestehende Einträge aus Slice 13 (`emit_intent_summary` → `summarizing`) bleiben unverändert; bestehende Tools aus Slice 12 (`draft_prompt`, `refine_prompt`, `analyze_image`, `recommend_model`, `get_model_info`, `web_search`) bleiben in `ALL_TOOLS`.

11) **GIVEN** keiner der drei Tool-Bodies enthält LangGraph-State-Manipulation
    **WHEN** der Tool-Body durchgelesen wird (statische Inspektion oder Smoke-Test mit gemocktem State)
    **THEN** kein Schreiben in `state["..."]`, kein `setVariation`-Aufruf, kein HTTP-Call. Tool-Output ist Daten-Roundtrip — die Wirkung erfolgt erst frontend-seitig in Slice 24 via SSE `tool-result`.

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Test-Writer implementiert die Assertions.

### Test-Datei: `backend/tests/unit/test_workspace_tools.py`

<test_spec>
```python
import pytest

# AC-1: Module exposes three BaseTool instances with correct names
@pytest.mark.skip(reason="AC-1")
def test_workspace_tools_module_exports_three_tools():
    ...

# AC-2: set_slot_role valid payload roundtrips
@pytest.mark.skip(reason="AC-2")
def test_set_slot_role_valid_payload_returns_echo():
    ...

# AC-3: set_slot_role rejects invalid role literal
@pytest.mark.skip(reason="AC-3")
def test_set_slot_role_invalid_role_raises_validation_error():
    ...

# AC-4: set_slot_role rejects negative slot_index
@pytest.mark.skip(reason="AC-4")
def test_set_slot_role_negative_slot_index_raises_validation_error():
    ...

# AC-5: set_slot_strength valid payload roundtrips
@pytest.mark.skip(reason="AC-5")
def test_set_slot_strength_valid_payload_returns_echo():
    ...

# AC-6: set_slot_strength rejects out-of-range strength + accepts boundaries
@pytest.mark.skip(reason="AC-6")
def test_set_slot_strength_out_of_range_raises_validation_error():
    ...

@pytest.mark.skip(reason="AC-6")
def test_set_slot_strength_accepts_boundary_values():
    ...

# AC-7: set_model_params valid payload + active model knowledge
@pytest.mark.skip(reason="AC-7")
def test_set_model_params_valid_payload_with_active_model_returns_echo():
    ...

# AC-8: set_model_params unknown key rejected per active model knowledge
@pytest.mark.skip(reason="AC-8")
def test_set_model_params_unknown_param_returns_error_or_raises():
    ...

# AC-9: set_model_params without active image_model_id in config
@pytest.mark.skip(reason="AC-9")
def test_set_model_params_missing_active_model_returns_error():
    ...

# AC-11: no state side effects in any of the three tools
@pytest.mark.skip(reason="AC-11")
def test_workspace_tools_have_no_state_side_effects():
    ...
```
</test_spec>

### Test-Datei: `backend/tests/integration/test_workspace_tools_registry.py`

<test_spec>
```python
import pytest

# AC-10: ALL_TOOLS contains the three new tools and TOOL_STATE_MAPPING is unchanged for them
@pytest.mark.skip(reason="AC-10")
def test_all_tools_registry_contains_workspace_tools():
    ...

@pytest.mark.skip(reason="AC-10")
def test_tool_state_mapping_does_not_include_workspace_tools():
    ...

@pytest.mark.skip(reason="AC-10")
def test_existing_tools_still_registered_after_workspace_tools_added():
    ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-13-emit-intent-summary-tool` | Tool-Registry-Pattern (`ALL_TOOLS`-Liste, `TOOL_STATE_MAPPING`-Dict in `graph.py`) | Python module-level constants | `ALL_TOOLS` und `TOOL_STATE_MAPPING` existieren mit dem in Slice 13 etablierten Schema; `emit_intent_summary` ist eingetragen. |
| `app.agent.prompt_knowledge.get_prompt_knowledge` | Existing module function | Python function | Cached lookup für Image-Model-Knowledge (vorhandene Datei); liefert `{"kind": "model", "model": {...}}` oder Fallback. Wird von `set_model_params` zur Validierung herangezogen. |
| LangGraph `RunnableConfig.configurable` mit Schlüssel `image_model_id` | Existing config flow | dict[str, Any] | Wird bereits von `_call_model_*` in `graph.py:235-257` durchgereicht. `set_model_params` liest `image_model_id` aus dem Config. |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `set_slot_role` (LangChain `@tool`) | `BaseTool` | Slice 24 (Frontend SSE-Handler) via SSE `tool-result` | `name="set_slot_role"`; args `slot_index: int >= 0`, `role: Literal["subject","style","composition"]` |
| `set_slot_strength` (LangChain `@tool`) | `BaseTool` | Slice 24 | `name="set_slot_strength"`; args `slot_index: int >= 0`, `strength: float 0.0..1.0` |
| `set_model_params` (LangChain `@tool`) | `BaseTool` | Slice 24 | `name="set_model_params"`; args `params: dict` (Keys validiert gegen aktives Image-Model laut `prompt_knowledge`) |

> Tool-Results werden vom existierenden SSE-Emitter in `assistant_service.py:175-231` automatisch als `tool-result` Events gestreamt — kein zusätzlicher Backend-Code nötig (Architecture Section "Server Logic" Zeile 224: `Capture payload; emit SSE tool-result`).

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/agent/tools/workspace_tools.py` — NEW: drei `@tool`-Funktionen mit Pydantic-`args_schema` (oder Type-Hint-basiert wie in `model_tools.py`); Tool-Bodies sind Echo-Roundtrips. `set_model_params` ruft `get_prompt_knowledge(model_id)` zur Param-Key-Validierung; bei unbekanntem Key oder fehlendem `image_model_id` Error-Dict zurückgeben (kein Crash). Logging-Pattern wie in `model_tools.py` (`logger.info`/`logger.error`).
- [ ] `backend/app/agent/graph.py` — Edit: drei neue Tools aus `app.agent.tools.workspace_tools` importieren und zur `ALL_TOOLS`-Liste (Zeile ~37) hinzufügen. `TOOL_STATE_MAPPING` und `TOOL_APPEND_MAPPING` BLEIBEN unverändert für diese Tools (kein State-Effekt).
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben. Frontend-SSE-Branches + Reducer-Actions = Slice 24.

---

## Constraints

**Scope-Grenzen:**
- KEIN State-Persisting im LangGraph-State (Architecture Q17 bestätigt: UI ist die authoritative Slot-Quelle).
- KEIN Frontend-Code (Slice 24).
- KEIN `set_model_id`-Tool — Modell-Wechsel mid-interview ist nicht erlaubt (Architecture-Note in Tool-Tabelle, Zeile 101).
- KEIN SSE-Event-Emitting im Tool-Body — `assistant_service.py` emittiert `tool-result` automatisch.
- KEIN Eintrag in `TOOL_STATE_MAPPING` oder `TOOL_APPEND_MAPPING` für die drei Tools.
- KEINE Persistenz-Schicht oder DB-Calls in den Tools.

**Technische Constraints:**
- LangChain `@tool`-Decorator-Pattern zwingend (Vorbild: `backend/app/agent/tools/model_tools.py`, `backend/app/agent/tools/prompt_tools.py`, `backend/app/agent/tools/image_tools.py`).
- Pydantic-Schema entweder via `args_schema`-Param ODER via Type-Hints am Funktions-Signature (Implementer-Wahl, konsistent mit existierenden Tools im Repo).
- Validation-Limits laut `architecture.md → Validation Rules` (Zeilen 343-345):
  - `set_slot_role.role`: Literal `"subject" | "style" | "composition"`
  - `set_slot_strength.strength`: `float >= 0.0` und `<= 1.0` (inklusive Boundary)
  - `set_model_params.params`: Keys müssen in Modell-Knowledge des aktiven Models existieren
  - `slot_index`: `int >= 0`
- `set_model_params` liest `image_model_id` aus `RunnableConfig.configurable` (gleiches Pattern wie `_call_model_*` in `graph.py:235-257`); Lookup via `app.agent.prompt_knowledge.get_prompt_knowledge(model_id)`. Erwartete Knowledge-Shape: `{"kind": "model", "model": {...}}` mit den zulässigen Param-Feldern (Implementer prüft die exakte Knowledge-Struktur in `data/prompt-knowledge.json` — z.B. unter `model.params` oder `model.knobs`; KEINE Annahme über das Schema des Param-Containers vor Inspektion).
- Async vs. Sync: Konsistent mit den bestehenden Tools — `recommend_model` und `get_model_info` in `model_tools.py` sind `async`; `draft_prompt`/`refine_prompt` in `prompt_tools.py` sind sync. `set_slot_role` + `set_slot_strength` haben keine I/O → sync OK. `set_model_params` ruft `get_prompt_knowledge` (cached, sync laut `prompt_knowledge.py`) → sync OK.
- Error-Stil bei `set_model_params`: konsistent mit `recommend_model` / `get_model_info` (Return-Dict mit `"error"`-Key, kein Raise) — Architecture Risk-Eintrag (Zeile 645) spricht von "Tool returns error → assistant retries".

**Reuse:**

Dieser Slice nutzt existierende Code-Pfade und Module. KEINE Neu-Implementierung folgender Bausteine:

| Existing File | Usage in this Slice |
|---|---|
| `backend/app/agent/tools/model_tools.py` | Pattern-Vorlage: `@tool`-Decorator, Logging, Error-Return-Stil. NICHT verändern. |
| `backend/app/agent/tools/prompt_tools.py` | Pattern-Vorlage: sync `@tool`-Definitionen mit Pydantic-Schema. NICHT verändern. |
| `backend/app/agent/prompt_knowledge.py` (`get_prompt_knowledge`) | IMPORT in `set_model_params` zur Param-Key-Validierung gegen aktive Model-Knowledge. NICHT verändern oder neu implementieren. |
| `backend/app/agent/graph.py` (`ALL_TOOLS`-Liste, Zeile 37) | EDIT: drei neue Tools ergänzen. Bestehende Tool-Imports + Registrierungen unverändert lassen. |
| `langchain_core.tools.tool` (Decorator) | Importieren, kein eigenes Decorator-Wrapping. |
| `pydantic.BaseModel` + `Field` | Standard-Pydantic — keine eigene Validation-Library. |

**Referenzen:**
- Architecture → API Endpoints → "LangGraph Tool Schemas" (Zeilen 99-101): exaktes Schema für `set_slot_role`, `set_slot_strength`, `set_model_params`.
- Architecture → Server Logic → "Validation Rules" (Zeilen 343-345): Tool-Validation-Constraints.
- Architecture → Server Logic → Layered Mapping (Zeile 526): NEW FILE `workspace_tools.py` + Pattern-Hinweis.
- Architecture → Server Logic → Tool-Tabelle (Zeile 224): `set_slot_*` / `set_model_params` Tool-Nodes "Capture payload; emit SSE tool-result", "None — frontend applies via reducer + setVariation".
- Architecture → Open Decisions → Q17 (Zeile 749): bestätigt "tool persists NICHT im State".
- Architecture → Risks & Mitigations (Zeile 645): `set_model_params` validiert gegen aktive Model-Knowledge zum Call-Zeitpunkt.
- Slice 13 (`slice-13-emit-intent-summary-tool.md`): Tool-Pattern-Vorbild (Pydantic-Schema, ALL_TOOLS-Registry-Eintrag, Test-Style).
