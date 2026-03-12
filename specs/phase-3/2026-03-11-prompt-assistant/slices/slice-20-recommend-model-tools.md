# Slice 20: recommend_model + get_model_info Tools (Backend)

> **Slice 20 von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-20-recommend-model-tools` |
| **Test** | `cd backend && python -m pytest tests/test_model_tools.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["slice-14-prompt-canvas-panel"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi` (neuer `backend/` Subfolder, Hauptprojekt: typescript-nextjs) |
| **Test Command** | `cd backend && python -m pytest tests/test_model_tools.py -v` |
| **Integration Command** | `cd backend && python -c "from app.agent.tools.model_tools import recommend_model, get_model_info; print('OK')"` |
| **Acceptance Command** | `cd backend && python -m pytest tests/test_model_tools.py -v -k acceptance` |
| **Start Command** | `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | `http://localhost:8000/api/assistant/health` |
| **Mocking Strategy** | `mock_external` (Replicate API-Calls werden in Tests gemockt) |

---

## Ziel

LangGraph Tools `recommend_model` und `get_model_info` implementieren, die ueber einen `ModelService` mit 1h-Cache verfuegbare Modelle aus der Replicate Collections API laden. `recommend_model` matched Prompt-Intent gegen Modell-Staerken, `get_model_info` liefert Details zu einem einzelnen Modell. Der `post_process_node` wird erweitert, um `recommended_model` im Graph-State zu aktualisieren.

---

## Acceptance Criteria

1) GIVEN ein registriertes `recommend_model` Tool im LangGraph Agent
   WHEN der Agent das Tool mit `prompt_intent` aufruft (z.B. `{"prompt_summary": "photorealistic portrait of a woman", "style_keywords": ["photorealistic", "portrait"]}`)
   THEN gibt das Tool ein Dict mit genau drei Keys zurueck: `id` (non-empty string, Format `owner/name`), `name` (non-empty string, menschenlesbarer Name), `reason` (non-empty string, 1-2 Saetze Begruendung auf Deutsch)

2) GIVEN der `ModelService` wird zum ersten Mal aufgerufen
   WHEN `get_available_models()` ausgefuehrt wird
   THEN holt der Service die Modell-Liste via Replicate Collections API (`https://api.replicate.com/v1/collections/text-to-image`) und cached das Ergebnis

3) GIVEN der `ModelService` hat gecachte Daten die juenger als 1 Stunde sind
   WHEN `get_available_models()` erneut aufgerufen wird
   THEN wird KEIN erneuter API-Call gemacht, sondern die gecachten Daten zurueckgegeben

4) GIVEN der `ModelService` hat gecachte Daten die aelter als 1 Stunde sind
   WHEN `get_available_models()` aufgerufen wird
   THEN wird ein neuer API-Call gemacht und der Cache aktualisiert

5) GIVEN der Agent hat `recommend_model` ausgefuehrt
   WHEN der `post_process_node` nach dem Tools-Node laeuft
   THEN wird `state["recommended_model"]` auf das Tool-Ergebnis gesetzt (Dict mit `id`, `name`, `reason`)

6) GIVEN ein aktiver SSE-Stream und der Agent ruft `recommend_model` auf
   WHEN das Tool-Ergebnis vorliegt
   THEN wird ein SSE-Event `event: tool-call-result` mit `data: {"tool": "recommend_model", "data": {"id": "...", "name": "...", "reason": "..."}}` gesendet (Payload-Format gemaess architecture.md Section "SSE Event Types")

7) GIVEN ein registriertes `get_model_info` Tool im LangGraph Agent
   WHEN der Agent das Tool mit `model_id` aufruft (z.B. `{"model_id": "black-forest-labs/flux-schnell"}`)
   THEN gibt das Tool ein Dict mit Modell-Metadaten zurueck: `owner` (string), `name` (string), `description` (string oder null), `run_count` (int), `url` (string)

8) GIVEN die Replicate API ist nicht erreichbar oder antwortet mit einem Fehler
   WHEN `recommend_model` aufgerufen wird
   THEN gibt das Tool eine verstaendliche Fehlermeldung zurueck (kein Crash), z.B. `{"error": "Modell-Daten konnten nicht geladen werden"}`

9) GIVEN `recommend_model` und `get_model_info` als registrierte Tools
   WHEN der kompilierte Agent-Graph inspiziert wird
   THEN sind beide Tools im `tools`-Array des Agents enthalten und der Graph kompiliert ohne Fehler

10) GIVEN der `post_process_node` im Graph
    WHEN ein Tool ausgefuehrt wird das NICHT `recommend_model` ist (z.B. `draft_prompt`)
    THEN bleibt `state["recommended_model"]` unveraendert

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.
> **Syntax:** Python/pytest

### Test-Datei: `backend/tests/test_model_tools.py`

<test_spec>
```python
import pytest

# AC-1: recommend_model gibt strukturiertes Dict zurueck
@pytest.mark.skip(reason="AC-1")
def test_recommend_model_returns_id_name_reason():
    ...

# AC-2: ModelService holt Daten von Replicate API
@pytest.mark.skip(reason="AC-2")
def test_model_service_fetches_from_replicate_api():
    ...

# AC-3: ModelService nutzt Cache bei frischen Daten
@pytest.mark.skip(reason="AC-3")
def test_model_service_returns_cached_data_within_ttl():
    ...

# AC-4: ModelService refreshed Cache nach Ablauf
@pytest.mark.skip(reason="AC-4")
def test_model_service_refreshes_cache_after_ttl():
    ...

# AC-5: post_process_node setzt recommended_model im State
@pytest.mark.skip(reason="AC-5")
def test_post_process_node_updates_recommended_model_state():
    ...

# AC-6: SSE-Event tool-call-result wird fuer recommend_model gesendet
@pytest.mark.skip(reason="AC-6")
def test_recommend_model_triggers_tool_call_result_sse_event():
    ...

# AC-7: get_model_info gibt Modell-Metadaten zurueck
@pytest.mark.skip(reason="AC-7")
def test_get_model_info_returns_model_metadata():
    ...

# AC-8: Fehlerbehandlung bei API-Fehler
@pytest.mark.skip(reason="AC-8")
def test_recommend_model_handles_api_error_gracefully():
    ...

# AC-9: Beide Tools im Agent registriert
@pytest.mark.skip(reason="AC-9")
def test_both_model_tools_registered_in_agent():
    ...

# AC-10: post_process_node ignoriert andere Tools
@pytest.mark.skip(reason="AC-10")
def test_post_process_node_ignores_non_model_tools():
    ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03-langgraph-agent` | `app.agent.graph.create_agent` | Factory-Funktion | `create_agent(checkpointer=None) -> CompiledGraph` |
| `slice-03-langgraph-agent` | `app.agent.state.PromptAssistantState` | TypedDict | State mit `recommended_model` Feld |
| `slice-12-prompt-tools-backend` | `post_process_node` | Graph Node | Existiert bereits, wird erweitert fuer `recommend_model` |
| `slice-04-sse-streaming-endpoint` | SSE Event Protocol | Event-Format | `tool-call-result` Events werden generisch gestreamt |
| `slice-01-python-projekt-setup` | `app.config.settings` | Settings-Instanz | `settings.replicate_api_token` vorhanden |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `app.agent.tools.model_tools.recommend_model` | LangGraph Tool | slice-21 (Model UI) | Tool: `prompt_summary: str, style_keywords: list[str] -> {"id": str, "name": str, "reason": str}` |
| `app.agent.tools.model_tools.get_model_info` | LangGraph Tool | slice-21 (Model UI) | Tool: `model_id: str -> {"owner": str, "name": str, "description": str, "run_count": int, "url": str}` |
| `app.services.model_service.ModelService` | Service-Klasse | slice-20 intern | `get_available_models() -> list[dict]`, `get_model_by_id(model_id: str) -> dict` |
| `recommended_model` State-Update | post_process_node Erweiterung | slice-21 (Model UI) | `state["recommended_model"] = {"id": str, "name": str, "reason": str}` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/agent/tools/model_tools.py` -- recommend_model und get_model_info Tool-Definitionen mit @tool Decorator
- [ ] `backend/app/services/model_service.py` -- ModelService mit Replicate Collections API-Anbindung und 1h In-Memory-Cache
- [ ] `backend/app/agent/graph.py` (erweitert) -- Model-Tools registrieren, post_process_node um recommend_model Handling erweitern
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice erstellt KEINE UI-Komponenten (Model-Badge/Recommendation UI kommt in Slice 21)
- Dieser Slice aendert NICHT den SSE-Streaming Code (Slice 04 sendet tool-call-result Events bereits generisch)
- Dieser Slice implementiert KEINE Model-Auswahl-Logik im Frontend (Workspace-Integration in Slice 21)
- Die Matching-Logik in `recommend_model` ist regelbasiert (Keyword-Matching), KEIN separater ML-Classifier

**Technische Constraints:**
- Tools mit `@tool` Decorator aus `langchain_core.tools` definieren
- Tool-Rueckgabewerte als Python Dicts (nicht Pydantic Models) -- SSE-Serialisierung nutzt JSON
- `ModelService` nutzt Replicate Collections API (gleiche URL wie Frontend: `https://api.replicate.com/v1/collections/text-to-image`)
- Cache-Implementierung als einfacher In-Memory-Dict mit Timestamp (analog zum existierenden Frontend-Pattern in `lib/services/collection-model-service.ts`)
- `post_process_node` prueft `ToolMessage`-Inhalte auf Tool-Name `recommend_model` und aktualisiert `state["recommended_model"]` (erweitert bestehende Logik aus Slice 12)
- `get_model_info` nutzt Replicate Models API (`https://api.replicate.com/v1/models/{owner}/{name}`) fuer Einzel-Modell-Details
- Replicate API Token aus `settings.replicate_api_token` (bereits in Config vorhanden)

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "SSE Event Types" (tool-call-result Payload fuer recommend_model)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Server Logic" (ModelService, recommend_model, get_model_info Beschreibung)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "LangGraph Graph Structure" (post_process_node Routing)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "Agent-Definition / Tools" (recommend_model Matching-Logik: Fotorealismus->Flux, Anime->SDXL, Text->Ideogram)
- Existierendes Pattern: `lib/services/collection-model-service.ts` (Frontend-seitige Replicate Collections API Anbindung mit 1h Cache)
