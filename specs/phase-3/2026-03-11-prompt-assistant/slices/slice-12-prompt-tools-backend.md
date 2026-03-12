# Slice 12: draft_prompt + refine_prompt Tools (Backend)

> **Slice 12 von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-12-prompt-tools-backend` |
| **Test** | `cd backend && python -m pytest tests/test_prompt_tools.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["slice-10-core-chat-loop"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi` (neuer `backend/` Subfolder, Hauptprojekt: typescript-nextjs) |
| **Test Command** | `cd backend && python -m pytest tests/test_prompt_tools.py -v` |
| **Integration Command** | `cd backend && python -c "from app.agent.tools.prompt_tools import draft_prompt, refine_prompt; print('OK')"` |
| **Acceptance Command** | `cd backend && python -m pytest tests/test_prompt_tools.py -v -k acceptance` |
| **Start Command** | `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | `http://localhost:8000/api/assistant/health` |
| **Mocking Strategy** | `mock_external` (OpenRouter LLM-Calls werden in Tests gemockt) |

---

## Ziel

LangGraph Tools `draft_prompt` und `refine_prompt` implementieren, damit der Agent strukturierte Prompts (motiv, style, negative_prompt) erstellen und iterativ anpassen kann. Ein `post_process_node` aktualisiert nach Tool-Ausfuehrung den Graph-State, sodass das Ergebnis als `tool-call-result` SSE-Event an das Frontend gesendet wird.

---

## Acceptance Criteria

1) GIVEN ein registriertes `draft_prompt` Tool im LangGraph Agent
   WHEN der Agent das Tool mit `collected_info` aufruft (z.B. `{"subject": "a golden retriever in a meadow", "style": "photorealistic", "purpose": "social media"}`)
   THEN gibt das Tool ein Dict mit genau drei Keys zurueck: `motiv` (non-empty string), `style` (non-empty string), `negative_prompt` (non-empty string)

2) GIVEN der Agent hat `draft_prompt` ausgefuehrt
   WHEN der `post_process_node` nach dem Tools-Node laeuft
   THEN wird `state["draft_prompt"]` auf das Tool-Ergebnis gesetzt (Dict mit `motiv`, `style`, `negative_prompt`)

3) GIVEN ein aktiver SSE-Stream und der Agent ruft `draft_prompt` auf
   WHEN das Tool-Ergebnis vorliegt
   THEN wird ein SSE-Event `event: tool-call-result` mit `data: {"tool": "draft_prompt", "data": {"motiv": "...", "style": "...", "negative_prompt": "..."}}` gesendet (Payload-Format gemaess architecture.md Section "SSE Event Types")

4) GIVEN ein registriertes `refine_prompt` Tool im LangGraph Agent
   WHEN der Agent das Tool mit `current_draft` und `feedback` aufruft (z.B. `{"current_draft": {"motiv": "...", "style": "...", "negative_prompt": "..."}, "feedback": "add dramatic lighting"}`)
   THEN gibt das Tool ein aktualisiertes Dict mit `motiv`, `style`, `negative_prompt` zurueck, wobei mindestens ein Feld gegenueber `current_draft` veraendert ist

5) GIVEN der Agent hat `refine_prompt` ausgefuehrt
   WHEN der `post_process_node` nach dem Tools-Node laeuft
   THEN wird `state["draft_prompt"]` mit dem aktualisierten Tool-Ergebnis ueberschrieben

6) GIVEN `draft_prompt` und `refine_prompt` als registrierte Tools
   WHEN der kompilierte Agent-Graph inspiziert wird
   THEN sind beide Tools im `tools`-Array des Agents enthalten und der Graph kompiliert ohne Fehler

7) GIVEN der `post_process_node` im Graph
   WHEN ein Tool ausgefuehrt wird das NICHT `draft_prompt` oder `refine_prompt` ist
   THEN bleibt `state["draft_prompt"]` unveraendert

8) GIVEN die `draft_prompt` Tool-Signatur
   WHEN das Tool ohne `collected_info` oder mit leerem Dict aufgerufen wird
   THEN wirft das Tool einen Fehler (oder gibt einen sinnvollen Fehlerhinweis zurueck), da mindestens `subject` benoetigt wird

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.
> **Syntax:** Python/pytest

### Test-Datei: `backend/tests/test_prompt_tools.py`

<test_spec>
```python
import pytest

# AC-1: draft_prompt gibt strukturiertes Dict zurueck
@pytest.mark.skip(reason="AC-1")
def test_draft_prompt_returns_structured_dict():
    ...

# AC-2: post_process_node setzt draft_prompt im State
@pytest.mark.skip(reason="AC-2")
def test_post_process_node_updates_draft_prompt_state():
    ...

# AC-3: SSE-Event tool-call-result wird fuer draft_prompt gesendet
@pytest.mark.skip(reason="AC-3")
def test_draft_prompt_triggers_tool_call_result_sse_event():
    ...

# AC-4: refine_prompt gibt aktualisiertes Dict zurueck
@pytest.mark.skip(reason="AC-4")
def test_refine_prompt_returns_updated_dict():
    ...

# AC-5: post_process_node ueberschreibt draft_prompt bei refine
@pytest.mark.skip(reason="AC-5")
def test_post_process_node_updates_state_on_refine():
    ...

# AC-6: Beide Tools im Agent registriert
@pytest.mark.skip(reason="AC-6")
def test_both_tools_registered_in_agent():
    ...

# AC-7: post_process_node ignoriert andere Tools
@pytest.mark.skip(reason="AC-7")
def test_post_process_node_ignores_non_prompt_tools():
    ...

# AC-8: draft_prompt erfordert mindestens subject
@pytest.mark.skip(reason="AC-8")
def test_draft_prompt_fails_without_subject():
    ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03-langgraph-agent` | `app.agent.graph.create_agent` | Factory-Funktion | `create_agent(checkpointer=None) -> CompiledGraph` |
| `slice-03-langgraph-agent` | `app.agent.state.PromptAssistantState` | TypedDict | State mit `draft_prompt` und `collected_info` Feldern |
| `slice-03-langgraph-agent` | `app.agent.prompts.SYSTEM_PROMPT` | String-Konstante | System Prompt mit Tool-Nutzungs-Hinweisen |
| `slice-04-sse-streaming-endpoint` | SSE Event Protocol | Event-Format | `tool-call-result` Events werden korrekt gestreamt |
| `slice-04-sse-streaming-endpoint` | `app.services.assistant_service.AssistantService` | Service-Klasse | Erkennt Tool-Call-Results und konvertiert zu SSE-Events |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `app.agent.tools.prompt_tools.draft_prompt` | LangGraph Tool | slice-14 (Canvas), slice-16 (Image -> Draft) | Tool: `collected_info: dict -> {"motiv": str, "style": str, "negative_prompt": str}` |
| `app.agent.tools.prompt_tools.refine_prompt` | LangGraph Tool | slice-14 (Canvas), slice-19 (Iterativer Loop) | Tool: `current_draft: dict, feedback: str -> {"motiv": str, "style": str, "negative_prompt": str}` |
| `post_process_node` | Graph Node | slice-16, slice-20 (erweitern fuer weitere Tools) | Node: Liest ToolMessages, aktualisiert State-Felder |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/agent/tools/prompt_tools.py` -- draft_prompt und refine_prompt Tool-Definitionen mit LangGraph @tool Decorator
- [ ] `backend/app/agent/graph.py` (erweitert) -- Tools registrieren, post_process_node hinzufuegen der State-Felder aktualisiert
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice erstellt KEINE UI-Komponenten (Canvas Panel kommt in Slice 14)
- Dieser Slice erstellt KEINE weiteren Tools (analyze_image kommt in Slice 16, recommend_model in Slice 20)
- Dieser Slice aendert NICHT den SSE-Streaming Code (Slice 04 sendet tool-call-result Events bereits generisch)
- Dieser Slice implementiert KEINE Canvas-Editierung oder Apply-Logik (Frontend-Slices 14, 15)

**Technische Constraints:**
- Tools mit `@tool` Decorator aus `langchain_core.tools` definieren
- Tool-Rueckgabewerte als Python Dicts (nicht Pydantic Models) -- SSE-Serialisierung nutzt JSON
- `post_process_node` wird als separater Node nach dem Tools-Node in den Graph eingefuegt (Routing: tools_node -> post_process_node -> assistant_node)
- `post_process_node` prueft `ToolMessage`-Inhalte auf Tool-Name und aktualisiert entsprechende State-Felder
- Prompt-Texte die von den Tools generiert werden muessen auf Englisch sein (Agent-Chat ist Deutsch, Prompts Englisch)
- `draft_prompt` erwartet mindestens `subject` in `collected_info` -- `style` und `purpose` koennen vom Tool mit Defaults befuellt werden

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "LangGraph Graph Structure" (tools_node -> post_process_node Routing)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "SSE Event Types" (tool-call-result Payload fuer draft_prompt/refine_prompt)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Server Logic" (draft_prompt/refine_prompt Tool-Beschreibung)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "Agent-Definition / Tools" (Wann Tools aufgerufen werden)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "Must-Have Informationen" (Motiv + Stil + Zweck vor Draft)
