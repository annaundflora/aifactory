# Slice 03: LangGraph Agent Grundstruktur

> **Slice 3 von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-03-langgraph-agent` |
| **Test** | `cd backend && python -m pytest tests/test_agent.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-fastapi-server-health"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi` (neuer `backend/` Subfolder, Hauptprojekt: typescript-nextjs) |
| **Test Command** | `cd backend && python -m pytest tests/test_agent.py -v` |
| **Integration Command** | `cd backend && python -c "from app.agent.graph import create_agent; g = create_agent()"` |
| **Acceptance Command** | `cd backend && python -c "from app.agent.graph import create_agent; g = create_agent(); print(type(g))"` |
| **Start Command** | `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | `http://localhost:8000/api/assistant/health` |
| **Mocking Strategy** | `mock_external` (OpenRouter LLM-Calls werden in Tests gemockt) |

---

## Ziel

LangGraph Agent mit `create_react_agent` Pattern aufsetzen: Custom State, System Prompt (deutsch Chat / englisch Prompts), OpenRouter LLM via langchain-openai, und PostgresSaver Checkpointer-Setup. Dies bildet das Agent-Fundament fuer alle nachfolgenden Tool- und Streaming-Slices.

---

## Acceptance Criteria

1) GIVEN die installierte `app` Package aus Slice 01/02
   WHEN `python -c "from app.agent.graph import create_agent; g = create_agent()"` ausgefuehrt wird
   THEN wird ein kompilierter LangGraph-Graph zurueckgegeben ohne Fehler (kein Import-/Runtime-Error)

2) GIVEN die `app.agent.state` Modul-Definition
   WHEN `PromptAssistantState` inspiziert wird
   THEN enthaelt der State alle Felder gemaess architecture.md Section "LangGraph State": `messages` (mit `add_messages` Reducer), `draft_prompt` (optional dict), `reference_images` (list), `recommended_model` (optional dict), `collected_info` (dict), `phase` (str, default `"understand"`)

3) GIVEN ein erstellter Agent-Graph
   WHEN der Graph mit einer einfachen HumanMessage invoked wird (z.B. `"Hallo"`) und einem gemockten LLM
   THEN enthaelt der Output-State ein `messages`-Array mit mindestens 2 Eintraegen (HumanMessage + AIMessage)

4) GIVEN das `app.agent.prompts` Modul
   WHEN der System Prompt geladen wird
   THEN enthaelt er Instruktionen fuer: deutsche Chat-Sprache, englische Prompt-Ausgabe, kreative-Partner-Rolle (nicht Fragebogen), Must-Haves (Motiv, Stil, Zweck), und Tool-Nutzungs-Hinweise

5) GIVEN die `create_agent()` Factory-Funktion
   WHEN sie ohne Argumente aufgerufen wird
   THEN wird der LLM-Client mit OpenRouter `base_url` (`https://openrouter.ai/api/v1`) und dem Default-Model aus `settings.assistant_model_default` konfiguriert

6) GIVEN die `create_agent()` Factory-Funktion
   WHEN sie mit einem optionalen `checkpointer` Parameter aufgerufen wird
   THEN wird der Checkpointer an den kompilierten Graphen uebergeben (fuer spaetere PostgresSaver-Integration)

7) GIVEN ein erstellter Agent-Graph mit Checkpointer (Mock)
   WHEN der Graph mit `config={"configurable": {"thread_id": "test-123"}}` invoked wird
   THEN wird der thread_id-basierte Config an den Checkpointer durchgereicht (kein Fehler)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.
> **Syntax:** Python/pytest

### Test-Datei: `backend/tests/test_agent.py`

<test_spec>
```python
import pytest

# AC-1: Graph erstellen ohne Fehler
@pytest.mark.skip(reason="AC-1")
def test_create_agent_returns_compiled_graph():
    ...

# AC-2: PromptAssistantState hat alle Felder
@pytest.mark.skip(reason="AC-2")
def test_state_has_all_required_fields():
    ...

# AC-3: Agent antwortet auf einfache Nachricht
@pytest.mark.skip(reason="AC-3")
def test_agent_responds_to_simple_message():
    ...

# AC-4: System Prompt enthaelt Kerninstruktionen
@pytest.mark.skip(reason="AC-4")
def test_system_prompt_contains_core_instructions():
    ...

# AC-5: LLM-Client nutzt OpenRouter base_url
@pytest.mark.skip(reason="AC-5")
def test_llm_configured_with_openrouter_base_url():
    ...

# AC-6: Checkpointer wird an Graph uebergeben
@pytest.mark.skip(reason="AC-6")
def test_create_agent_accepts_checkpointer():
    ...

# AC-7: Thread-ID Config wird durchgereicht
@pytest.mark.skip(reason="AC-7")
def test_agent_accepts_thread_id_config():
    ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-python-projekt-setup` | `app.config.settings` | Settings-Instanz | `settings.openrouter_api_key`, `settings.assistant_model_default` vorhanden |
| `slice-01-python-projekt-setup` | `backend/pyproject.toml` | Installierbare Deps | `langgraph`, `langchain-openai` sind installiert |
| `slice-02-fastapi-server-health` | `app.main.lifespan` | Lifespan Context Manager | Platzhalter fuer PostgresSaver-Setup in spaeteren Slices |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `app.agent.graph.create_agent` | Factory-Funktion | slice-04 (SSE Streaming) | `create_agent(checkpointer=None) -> CompiledGraph` |
| `app.agent.state.PromptAssistantState` | TypedDict (LangGraph State) | slice-04, slice-12, slice-16, slice-20 | State-Klasse mit `messages`, `draft_prompt`, `reference_images`, `recommended_model`, `collected_info`, `phase` |
| `app.agent.prompts.SYSTEM_PROMPT` | String-Konstante | slice-12, slice-16 | System Prompt fuer Agent-Konfiguration |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/agent/graph.py` -- Agent-Factory mit create_react_agent, LLM-Setup, Checkpointer-Integration
- [ ] `backend/app/agent/state.py` -- PromptAssistantState Definition mit allen Feldern und Reducern
- [ ] `backend/app/agent/prompts.py` -- System Prompt Konstante (deutsch/englisch Instruktionen)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice erstellt KEINE Tools (draft_prompt, analyze_image etc. kommen in Slice 12, 16, 20)
- Dieser Slice erstellt KEINEN SSE-Streaming Endpoint (kommt in Slice 04)
- Dieser Slice erstellt KEINE DB-Verbindung fuer PostgresSaver (Checkpointer wird als Parameter akzeptiert, konkrete Verbindung kommt spaeter)
- Dieser Slice registriert KEINE Routes in FastAPI (kommt in Slice 04)
- Der Agent wird ohne Tools kompiliert -- er kann nur Text-Antworten generieren

**Technische Constraints:**
- `create_react_agent` aus `langgraph.prebuilt` verwenden (nicht custom StateGraph)
- `ChatOpenAI` aus `langchain-openai` mit `base_url="https://openrouter.ai/api/v1"` fuer OpenRouter
- State muss `add_messages` Reducer fuer `messages` Feld nutzen (LangGraph-Konvention)
- `phase` Default-Wert: `"understand"` (gemaess Phasen-Modell in discovery.md)
- System Prompt als separate Konstante in `prompts.py` (nicht inline in graph.py)

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "LangGraph Graph Structure" + "LangGraph State"
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Technology Decisions" (create_react_agent, langchain-openai mit base_url)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "Agent-Definition" (System Prompt Kernstruktur, Phasen-Modell)
