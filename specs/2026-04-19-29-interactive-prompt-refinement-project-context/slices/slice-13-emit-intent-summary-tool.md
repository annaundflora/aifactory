# Slice 13: `emit_intent_summary` Agent-Tool

> **Slice 13 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-13-emit-intent-summary-tool` |
| **Test** | `cd backend && python -m pytest tests/unit/test_emit_intent_summary_tool.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["12-base-prompt-rewrite-interview"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

> **Quelle:** Auto-detected — Python/FastAPI + LangGraph + LangChain `@tool` + pytest. Testbare Einheit: Pydantic-Schema-Validierung + LangGraph-Tool-Invocation + `TOOL_STATE_MAPPING`-Lookup. Kein Live-LLM-Call — der Tool-Aufruf wird direkt mit `tool.invoke({...})` (LangChain BaseTool API) bzw. über die `post_process_node`-Logik in `graph.py` simuliert. Vorbild: `backend/tests/integration/test_image_tools_integration.py` (ALL_TOOLS-Registry-Asserts) und `backend/tests/test_canvas_agent.py` (BaseTool-Type-Check).

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi + langgraph + langchain-core + pytest` |
| **Test Command** | `cd backend && python -m pytest tests/unit/test_emit_intent_summary_tool.py -v` |
| **Integration Command** | `cd backend && python -m pytest tests/integration/test_emit_intent_summary_integration.py -v` |
| **Acceptance Command** | `cd backend && python -m pytest tests/unit/test_emit_intent_summary_tool.py tests/integration/test_emit_intent_summary_integration.py -v` |
| **Start Command** | `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | `GET http://localhost:8000/health` |
| **Mocking Strategy** | `no_mocks` (Tool-Schema + State-Mapping sind pure Python; bestehende Pydantic-Validation-Pfade reichen aus) |

---

## Ziel

Neues LangChain-`@tool` `emit_intent_summary` mit Pydantic-Input-Schema implementieren, das den Final-Intent (prompt + optional `settings_diff` + optional `model_id`) signalisiert, in `ALL_TOOLS` registrieren und über `TOOL_STATE_MAPPING` den `flow_state` auf `"summarizing"` schalten. Das Tool persistiert ausschließlich Payload + State-Übergang — es triggert KEINE Generierung; der Generate-Pfad bleibt komplett frontend-gated (Slice 17).

---

## Acceptance Criteria

1) **GIVEN** das neue Tool ist in `prompt_tools.py` definiert
   **WHEN** sein `name`-Attribut und sein `args_schema` inspiziert werden
   **THEN** `tool.name == "emit_intent_summary"`; das Pydantic-Schema enthält die Felder `prompt: str (1..2000)`, `settings_diff: SettingsDiff | None`, `model_id: str | None`. Das Tool ist eine Instanz von `langchain_core.tools.BaseTool`.

2) **GIVEN** ein gültiger Payload `{"prompt": "<= 2000 chars>", "settings_diff": <SettingsDiff>, "model_id": "openai/gpt-5.4"}`
   **WHEN** das Tool via `tool.invoke(payload)` aufgerufen wird
   **THEN** der Rückgabewert ist ein Dict, das den eingegebenen Payload spiegelt (Schlüssel `prompt`, `settings_diff`, `model_id`); keine Exception wird geworfen.

3) **GIVEN** ein Payload mit `prompt = "x" * 2001` (2001 Zeichen)
   **WHEN** das Tool via `tool.invoke(payload)` aufgerufen wird
   **THEN** ein `pydantic.ValidationError` (oder LangChain-Wrapper-Equivalent — z.B. `ToolException`) wird geworfen; das Tool wird NICHT erfolgreich ausgeführt. Schema-Constraint laut `architecture.md → Validation Rules` (`prompt non-empty, ≤ 2000 chars`).

4) **GIVEN** ein Payload mit `prompt = ""` (leerer String) ODER `settings_diff = {"slotStrengths": [{"slotIndex": 0, "from": null, "to": 1.7}]}` (`to > 1.0`)
   **WHEN** das Tool via `tool.invoke(payload)` aufgerufen wird
   **THEN** Pydantic-Validation schlägt fehl (Schema-Constraint laut `architecture.md → SettingsDiff` und Validation Rules); kein erfolgreicher Tool-Output.

5) **GIVEN** das Tool ist in `graph.py` registriert
   **WHEN** `from app.agent.graph import ALL_TOOLS, TOOL_STATE_MAPPING` ausgeführt wird
   **THEN** `"emit_intent_summary"` ist in `[t.name for t in ALL_TOOLS]` enthalten; `TOOL_STATE_MAPPING["emit_intent_summary"] == "summarizing"`. Bestehende Tool-Registrierungen aus Slice 11/12 (`draft_prompt`, `refine_prompt`, `analyze_image`, `recommend_model`, `get_model_info`, `web_search`) bleiben unverändert vorhanden.

6) **GIVEN** ein simulierter LangGraph-State-Update über `post_process_node` in `graph.py` (Pattern: `AIMessage` mit `tool_calls`-Eintrag `name="emit_intent_summary"` gefolgt von einer `ToolMessage` mit dem Echo-Payload)
   **WHEN** `post_process_node(state)` ausgewertet wird
   **THEN** der Rückgabe-Dict enthält `flow_state="summarizing"` und `final_intent` mit dem Tool-Argument-Dict (`{prompt, settings_diff?, model_id?}`). Mapping-Schlüssel `final_intent` siehe `architecture.md → Layered Mapping → state.py`-Erweiterung (Feld wird in Slice 14 zum State hinzugefügt; dieser Slice schreibt nur das Mapping/Hook und vertraut darauf, dass das Feld in Slice 14 existiert).

7) **GIVEN** das Tool wurde NICHT mit Generierungs-Side-Effects implementiert
   **WHEN** der Tool-Body durchgelesen wird (statische Inspektion oder Code-Smoke-Test)
   **THEN** kein Aufruf an `generateImages`, kein HTTP-Request zu `/api/generations`, kein Workspace-Apply. Tool-Output ist ein reiner Daten-Roundtrip (Echo des Payloads + State-Side-Effect).

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Test-Writer implementiert die Assertions.

### Test-Datei: `backend/tests/unit/test_emit_intent_summary_tool.py`

<test_spec>
```python
import pytest

# AC-1: Tool name + Pydantic schema shape
@pytest.mark.skip(reason="AC-1")
def test_tool_name_and_schema_shape():
    ...

# AC-2: Valid payload roundtrips
@pytest.mark.skip(reason="AC-2")
def test_valid_payload_invocation_returns_echo_dict():
    ...

# AC-3: prompt > 2000 chars rejected
@pytest.mark.skip(reason="AC-3")
def test_prompt_over_2000_chars_raises_validation_error():
    ...

# AC-4: empty prompt OR malformed settings_diff rejected
@pytest.mark.skip(reason="AC-4")
def test_empty_prompt_raises_validation_error():
    ...

@pytest.mark.skip(reason="AC-4")
def test_settings_diff_strength_out_of_range_raises_validation_error():
    ...

# AC-7: no generation side effects
@pytest.mark.skip(reason="AC-7")
def test_tool_body_has_no_generation_side_effects():
    ...
```
</test_spec>

### Test-Datei: `backend/tests/integration/test_emit_intent_summary_integration.py`

<test_spec>
```python
import pytest

# AC-5: registry + state mapping
@pytest.mark.skip(reason="AC-5")
def test_emit_intent_summary_registered_in_all_tools():
    ...

@pytest.mark.skip(reason="AC-5")
def test_tool_state_mapping_contains_summarizing_entry():
    ...

@pytest.mark.skip(reason="AC-5")
def test_existing_tools_still_registered():
    ...

# AC-6: post_process_node propagates flow_state + final_intent
@pytest.mark.skip(reason="AC-6")
def test_post_process_node_sets_flow_state_summarizing_on_tool_call():
    ...

@pytest.mark.skip(reason="AC-6")
def test_post_process_node_persists_final_intent_payload():
    ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-12-base-prompt-rewrite-interview` | `_BASE_PROMPT` referenziert `emit_intent_summary` als Abschluss-Tool | System-Prompt-String | Slice 12 Phrasen-Test enthält bereits `"emit_intent_summary"`; kein zusätzlicher Check hier |
| (Forward-Dep, in Slice 14 erfüllt) | `PromptAssistantState.final_intent: dict \| None`, `flow_state: str` | LangGraph TypedDict-Field | Slice 13 darf das Mapping `final_intent` schreiben; Slice 14 fügt das Feld zum State hinzu. Implementer prüft via `git log` der `state.py`, ob Slice 14 bereits gemerged ist; falls nicht, beschränkt sich AC-6 auf das `flow_state`-Feld und delegiert `final_intent` an Slice 14. |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `emit_intent_summary` (LangChain `@tool`) | `BaseTool` | LangGraph `ToolNode` (in `graph.py`), Slice 15 (SSE-Emitter), Slice 17 (Card-Click-Handler — indirekt via `final_intent`-State) | `name="emit_intent_summary"`; `args_schema` mit `prompt: str`, `settings_diff: SettingsDiff \| None`, `model_id: str \| None` |
| `TOOL_STATE_MAPPING["emit_intent_summary"]` | `str` | `post_process_node` (in `graph.py`), Slice 15 | Wert: `"summarizing"` |
| `SettingsDiff` Pydantic-Modell | Pydantic `BaseModel` | Slice 15 (`IntentSummaryPayload`-Render-Pfad), Slice 16 (Card-Komponente liest gleiche Struktur) | Schema laut `architecture.md → SettingsDiff Type Schema` (4 optionale Sub-Arrays: `slotRoles`, `slotStrengths`, `modelId`, `modelParams`) |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/agent/tools/prompt_tools.py` — Edit: neues `@tool emit_intent_summary` mit Pydantic-Input-Schema (inkl. Sub-Modell `SettingsDiff` mit den 4 optionalen Sub-Arrays); Tool-Body ist reiner Echo-Roundtrip des Payloads (kein Generate-Aufruf).
- [ ] `backend/app/agent/graph.py` — Edit: `emit_intent_summary` zur `ALL_TOOLS`-Liste (Zeile ~37) hinzufügen; `TOOL_STATE_MAPPING` (Zeile ~41) um Eintrag `"emit_intent_summary": "summarizing"` ergänzen; `post_process_node` (ab Zeile ~55) so erweitern, dass für `emit_intent_summary` zusätzlich der Tool-Argument-Payload in den State-Field `final_intent` und der String `"summarizing"` in `flow_state` geschrieben wird (Mapping-Eintrag ist hier `state_field = "summarizing"` — dies ist KEIN State-Field-Name, sondern der Wert für `flow_state`; daher Spezial-Branch oder zweite Mapping-Tabelle nötig).
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben. Der State-Field `final_intent` wird in Slice 14 zum `PromptAssistantState` hinzugefügt — dieser Slice darf das Mapping referenzieren, schreibt aber keine `state.py`.

---

## Constraints

**Scope-Grenzen:**
- KEIN Generate-Trigger im Tool-Body (Auto-Apply + Auto-Generate ist Slice 17, frontend-gated).
- KEIN State-Feld `final_intent` zum `PromptAssistantState` hinzufügen (Slice 14).
- KEIN SSE-Event-Emitting im Tool selbst (Slice 15 emittiert `intent-summary` + `flow-state` aus `AssistantService`).
- KEINE Frontend-Änderungen (Card-Render = Slice 16).
- KEIN neuer `set_slot_*` / `set_model_params` Tool (Slice 23).

**Technische Constraints:**
- LangChain `@tool`-Decorator-Pattern zwingend (vorbild: bestehende `draft_prompt`, `refine_prompt` in `prompt_tools.py`; bzw. `analyze_image` in `image_tools.py`).
- Pydantic-Schema MUSS via `args_schema`-Param oder Type-Hints am Funktions-Signature definiert sein (so dass `tool.args_schema` ein Pydantic-`BaseModel` zurückgibt).
- `SettingsDiff` als eigenes Pydantic-`BaseModel` definieren (snake_case-Felder backend-side: `slot_roles`, `slot_strengths`, `model_id`, `model_params`); JSON-Aliasing für die camelCase-API-Schreibweise (`slotRoles`, `slotStrengths`, `modelId`, `modelParams`) per `Field(alias=...)` und `model_config = ConfigDict(populate_by_name=True)` ODER vollständig camelCase im Backend-Modell — Implementer-Entscheidung, aber konsistent mit existierenden DTOs in `backend/app/models/dtos.py`. Architecture-Vorgabe: Frontend-Wire-Format ist camelCase (`architecture.md → SettingsDiff Type Schema`).
- Validation-Limits laut `architecture.md → Validation Rules`:
  - `prompt`: `min_length=1`, `max_length=2000`
  - `slot_strengths[].to`: `0.0..1.0` (inclusive)
  - `slot_roles[].to`: Enum `"subject" | "style" | "composition"`
  - `slot_index`: `int >= 0`
- Bestehender `post_process_node` in `graph.py` (ab Zeile 55) iteriert über `ToolMessage`s, liest `TOOL_STATE_MAPPING[tool_name] → state_field` und schreibt das geparste Tool-Result in `state[state_field]`. Für `emit_intent_summary` weicht die Semantik ab (Wert `"summarizing"` ist KEIN State-Field-Name, sondern der Ziel-Wert für `flow_state`; ausserdem muss zusätzlich `final_intent` aus den Tool-Args gefüllt werden). Implementer-Wahl:
  1. Spezial-Branch in `post_process_node` für `tool_name == "emit_intent_summary"`, ODER
  2. Zweite Mapping-Tabelle (z.B. `TOOL_FLOW_STATE_MAPPING: dict[str, str]` + `TOOL_PAYLOAD_FIELD_MAPPING: dict[str, str]`).
  Bestehende Mappings für `draft_prompt`/`refine_prompt`/`analyze_image`/`recommend_model` (Zeilen 41-46) und die bestehende Append-Logik für `analyze_image` (Zeilen 50-52, 129-148) MÜSSEN unverändert bleiben.
- `architecture.md` enthält selbst noch die alte Bezeichnung `_after_node`; Codebase-Stand (`post_process_node`) ist Wahrheit. Implementer NICHT von der Architecture-Bezeichnung verwirren lassen.

**Reuse:**

Dieser Slice verwendet existierende Code-Pfade — keine Neu-Implementierung folgender Bausteine:

| Existing File | Usage in this Slice |
|---|---|
| `backend/app/agent/tools/prompt_tools.py` | EDIT: Datei existiert bereits mit `draft_prompt` + `refine_prompt`. Nur ergänzen — bestehende Tools NICHT verändern. |
| `backend/app/agent/graph.py` (Zeilen 37, 41-46, 55-161) | EDIT: `ALL_TOOLS`-Liste, `TOOL_STATE_MAPPING` und `post_process_node` bestehen bereits. Patterns übernehmen, Tool-Loop in `post_process_node` erweitern, NICHT umschreiben. |
| `langchain_core.tools.tool` (Decorator) | Importieren, NICHT eigenes Decorator-Wrapping bauen. |
| `pydantic.BaseModel` + `Field` | Standard-Pydantic — keine eigene Validation-Library. |

**Referenzen:**
- Architecture → API Endpoints → "LangGraph Tool Schemas" (Tool-Tabelle): Schema und Persistence-Verhalten von `emit_intent_summary`.
- Architecture → API Endpoints → "`SettingsDiff` Type Schema": exakte Sub-Array-Struktur.
- Architecture → Server Logic → "Validation Rules": `prompt` ≤ 2000, `settings_diff` Schema-Match.
- Architecture → Layered Mapping → Zeilen für `prompt_tools.py`, `graph.py`, `state.py` (Architecture nutzt dort den Begriff `_after_node` — Codebase verwendet `post_process_node`).
- Architecture → Server Logic → "Auto-Apply + Auto-Generate Trigger": Klärt explizit, dass Tool NICHT generiert.
- Architecture → Open Decisions → Q8: Begründung warum Tool-Name `emit_intent_summary` (nicht `finalize_and_generate`).
