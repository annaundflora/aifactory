# Slice 14: FSM-State-Extension in PromptAssistantState

> **Slice 14 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-14-fsm-state-extension` |
| **Test** | `cd backend && python -m pytest tests/unit/test_prompt_assistant_state.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["13-emit-intent-summary-tool"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

> **Quelle:** Auto-detected — Python/FastAPI + LangGraph + pytest. Pure unit tests gegen das `TypedDict`-Schema, `DEFAULT_STATE_VALUES` und gegen den Postgres-Checkpointer (Round-Trip-Test mit `langgraph-checkpoint-postgres` gegen lokale Test-DB). Kein LLM-Call, keine SSE.

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi + langgraph + langchain-core + pytest` |
| **Test Command** | `cd backend && python -m pytest tests/unit/test_prompt_assistant_state.py -v` |
| **Integration Command** | `cd backend && python -m pytest tests/integration/test_state_checkpoint_roundtrip.py -v` |
| **Acceptance Command** | `cd backend && python -m pytest tests/unit/test_prompt_assistant_state.py tests/integration/test_state_checkpoint_roundtrip.py -v` |
| **Start Command** | `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | `GET http://localhost:8000/health` |
| **Mocking Strategy** | `no_mocks` (TypedDict-Schema ist pure Python; Checkpointer-Roundtrip nutzt die existierende Postgres-Test-Fixture) |

---

## Ziel

`PromptAssistantState` um drei FSM-Felder (`flow_state`, `intent_axes`, `final_intent`) erweitern, `DEFAULT_STATE_VALUES` aktualisieren und `SessionStateDTO` um die Resume-relevanten Felder ergänzen. Damit ist der Backend-State der **Single Source of Truth** für den FSM (siehe `architecture.md → Q7`) und Slice 13's Mapping-Hook in `post_process_node` kann tatsächlich `final_intent` und `flow_state` schreiben.

---

## Acceptance Criteria

1) **GIVEN** das erweiterte `PromptAssistantState` aus `backend/app/agent/state.py`
   **WHEN** die TypedDict-Annotations inspiziert werden (`PromptAssistantState.__annotations__`)
   **THEN** `flow_state: str`, `intent_axes: dict`, `final_intent: Optional[dict]` (oder `dict | None`) sind enthalten; bestehende Felder (`draft_prompt`, `reference_images`, `recommended_model`, `collected_info`, `phase`) bleiben unverändert vorhanden.

2) **GIVEN** das aktualisierte `DEFAULT_STATE_VALUES`-Dict aus `backend/app/agent/state.py`
   **WHEN** das Dict importiert wird
   **THEN** es enthält die Einträge `"flow_state": "idle"`, `"intent_axes": {}`, `"final_intent": None` zusätzlich zu den bestehenden Defaults; alle bestehenden Default-Werte bleiben unverändert (`draft_prompt=None`, `reference_images=[]`, `recommended_model=None`, `collected_info={}`, `phase="understand"`).

3) **GIVEN** eine neu initialisierte Session (z.B. via `AssistantService` `create_session` mit `DEFAULT_STATE_VALUES`)
   **WHEN** der State direkt nach Erstellung gelesen wird
   **THEN** `state["flow_state"] == "idle"`, `state["intent_axes"] == {}`, `state["final_intent"] is None`.

4) **GIVEN** ein State mit gesetzten FSM-Feldern (`flow_state="summarizing"`, `intent_axes={"subject":"cat"}`, `final_intent={"prompt":"a cat"}`)
   **WHEN** der State über den Postgres-Checkpointer (`langgraph-checkpoint-postgres`) persistiert und über `checkpointer.get(config)` zurückgelesen wird
   **THEN** alle drei Felder sind verlustfrei wiederhergestellt (`==` Gleichheit auf String, Dict, Dict). Keine Schema-Migration nötig (architecture.md → "no Drizzle table — existing checkpointer schema absorbs new fields").

5) **GIVEN** ein älterer persistierter Checkpoint **ohne** `flow_state`/`intent_axes`/`final_intent` (Pre-Slice-14-Session, simuliert durch direktes Schreiben eines State-Dicts ohne diese Schlüssel)
   **WHEN** dieser Checkpoint von einem Code-Pfad gelesen wird, der die neuen Felder konsumiert (z.B. via `state.get("flow_state", "idle")`)
   **THEN** das Lesen liefert die Defaults (`"idle"` / `{}` / `None`); kein `KeyError` und kein State-Schema-Validation-Fehler. Backward-Kompatibilität laut `architecture.md → Layered Mapping → state.py:12-43` ist gewährleistet.

6) **GIVEN** das erweiterte `SessionStateDTO` aus `backend/app/models/dtos.py`
   **WHEN** die Pydantic-Felder inspiziert werden (`SessionStateDTO.model_fields`)
   **THEN** `flow_state: str` (default `"idle"`) und `intent_axes: dict` (default `{}`) sind enthalten; bestehende Felder (`messages`, `draft_prompt`, `recommended_model`) bleiben unverändert; das DTO ist abwärtskompatibel (alte Clients ohne neue Felder erhalten weiterhin gültige Responses, neue Felder erscheinen mit Defaults wenn der Checkpoint sie nicht hatte).

7) **GIVEN** die Datei `backend/app/agent/state.py` enthält den `flow_state`-Type
   **WHEN** der Type des Feldes statisch geprüft wird
   **THEN** `flow_state` ist als `str` (nicht `Literal[...]`) deklariert — die Enum-Werte `"idle" | "interviewing" | "summarizing" | "reviewing" | "refining" | "generating"` werden NICHT auf Type-Ebene erzwungen (siehe Constraints — Validierung erfolgt in Slice 15 SSE-Layer und Slice 17 Frontend-Reducer).

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Test-Writer implementiert die Assertions.

### Test-Datei: `backend/tests/unit/test_prompt_assistant_state.py`

<test_spec>
```python
import pytest

# AC-1: TypedDict annotations contain new FSM fields
@pytest.mark.skip(reason="AC-1")
def test_prompt_assistant_state_has_fsm_fields_in_annotations():
    ...

@pytest.mark.skip(reason="AC-1")
def test_existing_state_fields_unchanged():
    ...

# AC-2: DEFAULT_STATE_VALUES has new entries with correct defaults
@pytest.mark.skip(reason="AC-2")
def test_default_state_values_includes_flow_state_idle():
    ...

@pytest.mark.skip(reason="AC-2")
def test_default_state_values_includes_empty_intent_axes_and_none_final_intent():
    ...

@pytest.mark.skip(reason="AC-2")
def test_existing_default_values_unchanged():
    ...

# AC-7: flow_state typed as plain str (no Literal narrowing)
@pytest.mark.skip(reason="AC-7")
def test_flow_state_type_is_plain_str_not_literal():
    ...
```
</test_spec>

### Test-Datei: `backend/tests/unit/test_session_state_dto.py`

<test_spec>
```python
import pytest

# AC-6: SessionStateDTO has flow_state + intent_axes with defaults
@pytest.mark.skip(reason="AC-6")
def test_session_state_dto_includes_flow_state_with_idle_default():
    ...

@pytest.mark.skip(reason="AC-6")
def test_session_state_dto_includes_intent_axes_with_empty_dict_default():
    ...

@pytest.mark.skip(reason="AC-6")
def test_session_state_dto_existing_fields_unchanged():
    ...
```
</test_spec>

### Test-Datei: `backend/tests/integration/test_state_checkpoint_roundtrip.py`

<test_spec>
```python
import pytest

# AC-3: New session reads default flow_state
@pytest.mark.skip(reason="AC-3")
def test_new_session_initialized_with_default_state_values_has_flow_state_idle():
    ...

# AC-4: Checkpointer persists + restores all three FSM fields losslessly
@pytest.mark.skip(reason="AC-4")
def test_checkpointer_roundtrip_preserves_flow_state():
    ...

@pytest.mark.skip(reason="AC-4")
def test_checkpointer_roundtrip_preserves_intent_axes_dict():
    ...

@pytest.mark.skip(reason="AC-4")
def test_checkpointer_roundtrip_preserves_final_intent_dict():
    ...

# AC-5: Pre-slice-14 checkpoints (without new fields) read defaults
@pytest.mark.skip(reason="AC-5")
def test_legacy_checkpoint_without_flow_state_reads_idle_default():
    ...

@pytest.mark.skip(reason="AC-5")
def test_legacy_checkpoint_without_intent_axes_reads_empty_dict_default():
    ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-13-emit-intent-summary-tool` | `post_process_node`-Hook in `graph.py` schreibt nach `state["final_intent"]` und `state["flow_state"]` | LangGraph node-side-effect | Slice 13 AC-6 prüft die Side-Effects. Slice 14 muss sicherstellen, dass diese Schlüssel im TypedDict erlaubt sind. |
| (LangGraph Runtime) | `langgraph-checkpoint-postgres` ≥ 3.0.4 (existing) serialisiert plain `str` und `dict` Werte | Library-Vertrag | Verifiziert in AC-4 via Round-Trip-Test |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `PromptAssistantState.flow_state` | `str` (TypedDict-Field, default `"idle"`) | Slice 15 (SSE-Emitter), Slice 17 (Auto-Apply-Handler liest indirekt via Frontend-Mirror), Slice 28 (Resume-Hydrate) | Lese-Pfad: `state.get("flow_state", "idle")` |
| `PromptAssistantState.intent_axes` | `dict` (TypedDict-Field, default `{}`) | Slice 15 (SSE-Emitter packt in `IntentSummaryPayload.axes`), Slice 28 (Resume) | Lese-Pfad: `state.get("intent_axes", {})` |
| `PromptAssistantState.final_intent` | `Optional[dict]` (TypedDict-Field, default `None`) | Slice 13 (Schreib-Pfad), Slice 15, Slice 28 | Schreib-Pfad: `state["final_intent"] = {"prompt": ..., "settings_diff": ..., "model_id": ...}` |
| `DEFAULT_STATE_VALUES` (erweitert) | `dict` | `AssistantService.create_session` (existing) | Drei zusätzliche Schlüssel |
| `SessionStateDTO.flow_state` + `SessionStateDTO.intent_axes` | Pydantic-Felder | Slice 28 (`GET /api/assistant/sessions/{id}` Resume) | DTO-Roundtrip per `model_validate(...)` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/agent/state.py` — Edit: `PromptAssistantState` TypedDict um drei Felder erweitern (`flow_state: str`, `intent_axes: dict`, `final_intent: Optional[dict]`); `DEFAULT_STATE_VALUES` um drei Einträge ergänzen (`"flow_state": "idle"`, `"intent_axes": {}`, `"final_intent": None`). Bestehende Felder + Defaults unverändert lassen.
- [ ] `backend/app/models/dtos.py` — Edit: `SessionStateDTO` um zwei Pydantic-Felder ergänzen (`flow_state: str = "idle"`, `intent_axes: dict = Field(default_factory=dict)`). Bestehende Felder (`messages`, `draft_prompt`, `recommended_model`) unverändert lassen.
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben. Die `final_intent`-Spiegelung ins `SessionStateDTO` ist in diesem Slice NICHT vorgesehen — Slice 28 entscheidet, ob `final_intent` für Resume-Card-Re-Render zusätzlich ins DTO gehoben werden muss.

---

## Constraints

**Scope-Grenzen:**
- KEIN SSE-Event-Emitting für `flow-state`-Übergänge (Slice 15).
- KEINE Reducer- oder Frontend-Änderungen (Slice 15 dispatcht; Slice 17 nutzt).
- KEIN `Literal[...]`-Type-Narrowing für `flow_state` — bewusst plain `str`, weil der `"generating"`-Übergang frontend-side gesetzt wird (architecture.md → Q7) und LangGraph-Checkpointer-Serialisierung mit `Literal` Edge-Cases hat. Validierung der Enum-Werte erfolgt in Slice 15 (SSE-Payload-Schema `FlowStateEvent`) und im Frontend-Reducer.
- KEINE Drizzle-Migration (architecture.md → "Out-of-DB persistence" — Checkpointer-Schema absorbiert die neuen Felder ohne ALTER TABLE).
- KEINE Resume-Hydrate-Logik im Frontend (Slice 28).
- KEIN Schreiben in `final_intent` aus diesem Slice — Slice 13 hat das Mapping bereits geschrieben, dieser Slice macht das Feld nur "verfügbar".

**Technische Constraints:**
- `PromptAssistantState` erbt weiterhin von `langgraph.prebuilt.chat_agent_executor.AgentState` (TypedDict). NICHT auf Pydantic umstellen.
- `final_intent` MUSS als `Optional[dict]` (alias `dict | None`) deklariert sein — Slice 13's `post_process_node` schreibt entweder `None` (Initialwert) oder ein Dict mit `prompt`/`settings_diff`/`model_id`.
- `intent_axes` ist ein einfaches `dict` (keine TypedDict-Verschachtelung) — der Inhalt (`subject?`, `medium?`, `style?`, `lighting?`, `composition?`, `palette?`) wird in Slice 15 als `IntentSummaryPayload.axes` typisiert; Slice 14 hält den State-Container generisch.
- `DEFAULT_STATE_VALUES` ist ein Modul-Level-`dict` und wird in `AssistantService.create_session` als `**kwargs` oder `state=...`-Parameter expanded — Implementer prüft bestehende Aufrufstelle und stellt sicher, dass die Erweiterung nicht durch overrides versteckt wird.
- `SessionStateDTO` ist Pydantic-`BaseModel` (`backend/app/models/dtos.py:160`); neue Felder mit Defaults bleiben backward-kompatibel (alte Test-Fixtures ohne neue Felder validieren weiterhin).
- Postgres-Checkpointer: `langgraph-checkpoint-postgres` 3.0.4+ serialisiert TypedDict-Felder via JSON. Plain `str` + `dict` + `None` sind JSON-kompatibel; keine Custom-Serializer nötig.

**Reuse:**

Dieser Slice editiert ausschließlich existierende Dateien. Keine Neu-Implementierung folgender Bausteine:

| Existing File | Usage in this Slice |
|---|---|
| `backend/app/agent/state.py` | EDIT: `PromptAssistantState` (Zeile 12-32) erweitern; `DEFAULT_STATE_VALUES` (Zeile 37-43) erweitern. Bestehende Felder + Defaults NICHT ändern. |
| `backend/app/models/dtos.py` (Zeile 160-169) | EDIT: `SessionStateDTO` um zwei Felder erweitern. Bestehende Felder + `SessionDetailResponse`-Wrapper unverändert lassen. |
| `langgraph.prebuilt.chat_agent_executor.AgentState` | Wird weiterhin als TypedDict-Basis verwendet — NICHT durch eine eigene Klasse ersetzen. |
| `langgraph-checkpoint-postgres` | Serialisierung wird via existierender Library übernommen — KEIN Custom-Serializer-Code. |
| `AssistantService.create_session` | Konsumiert `DEFAULT_STATE_VALUES` bereits — KEINE Änderung am Aufruf nötig, der Slice fügt nur Schlüssel zum existierenden Dict hinzu. |

**Referenzen:**
- Architecture → "Layered Mapping" → Zeile `backend/app/agent/state.py:12-43` (Slice F-Tag): exakte Feld-Liste und Default-Werte.
- Architecture → "Out-of-DB persistence": Begründung warum keine Drizzle-Migration.
- Architecture → "Data Transfer Objects" → `SessionStateDTO`-Zeile: Erweiterung mit `flow_state`, `intent_axes`.
- Architecture → "Open Decisions" → Q7: FSM-Source-of-Truth ist Backend-LangGraph-State.
- Architecture → "Risks" → "LangGraph state field rename breaks existing sessions": Backward-Kompat-Strategie (Default `"idle"` für absent fields).
- Architecture → "Assumptions": "LangGraph checkpointer can serialise `flow_state: str` + `intent_axes: dict` without schema migration" — Validierung via AC-4.
