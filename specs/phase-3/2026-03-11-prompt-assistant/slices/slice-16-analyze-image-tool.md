# Slice 16: analyze_image Tool (Backend)

> **Slice 16 von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-16-analyze-image-tool` |
| **Test** | `cd backend && python -m pytest tests/test_image_tools.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["slice-12-prompt-tools-backend"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi` (neuer `backend/` Subfolder, Hauptprojekt: typescript-nextjs) |
| **Test Command** | `cd backend && python -m pytest tests/test_image_tools.py -v` |
| **Integration Command** | `cd backend && python -c "from app.agent.tools.image_tools import analyze_image; print('OK')"` |
| **Acceptance Command** | `cd backend && python -m pytest tests/test_image_tools.py -v -k acceptance` |
| **Start Command** | `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | `http://localhost:8000/api/assistant/health` |
| **Mocking Strategy** | `mock_external` (HTTP-Download, Pillow-Resize und Vision-LLM-Call werden in Tests gemockt) |

---

## Ziel

LangGraph Tool `analyze_image` implementieren, das eine Bild-URL empfaengt, das Bild herunterlaed, auf max 1024px laengste Kante via Pillow skaliert, und an das vom User gewaehlte Chat-Model (Vision) sendet. Das Tool extrahiert eine strukturierte Analyse (subject, style, mood, lighting, composition, palette) und speichert sie im Agent-State unter `reference_images`.

---

## Acceptance Criteria

1) GIVEN ein registriertes `analyze_image` Tool im LangGraph Agent
   WHEN der Agent das Tool mit einer gueltigen `image_url` aufruft (z.B. `"https://r2.example.com/images/photo.jpg"`)
   THEN gibt das Tool ein Dict mit genau sechs Keys zurueck: `subject` (non-empty string), `style` (non-empty string), `mood` (non-empty string), `lighting` (non-empty string), `composition` (non-empty string), `palette` (non-empty string)

2) GIVEN ein Bild mit 2048x1536px an der uebergebenen URL
   WHEN `analyze_image` das Bild herunterlaed und verarbeitet
   THEN wird das Bild auf 1024x768px skaliert (laengste Kante = 1024px, Seitenverhaeltnis beibehalten) bevor es an die Vision-API gesendet wird

3) GIVEN ein Bild mit 800x600px (bereits unter 1024px)
   WHEN `analyze_image` das Bild verarbeitet
   THEN wird das Bild NICHT skaliert (Originalgroesse beibehalten)

4) GIVEN der Agent hat `analyze_image` ausgefuehrt
   WHEN der `post_process_node` nach dem Tools-Node laeuft
   THEN wird ein neues Entry `{"url": "<image_url>", "analysis": <tool_result>}` an `state["reference_images"]` angehaengt (append, nicht ueberschreiben)

5) GIVEN ein aktiver SSE-Stream und der Agent ruft `analyze_image` auf
   WHEN das Tool-Ergebnis vorliegt
   THEN wird ein SSE-Event `event: tool-call-result` mit `data: {"tool": "analyze_image", "data": {"subject": "...", "style": "...", "mood": "...", "lighting": "...", "composition": "...", "palette": "..."}}` gesendet (Payload-Format gemaess architecture.md Section "SSE Event Types")

6) GIVEN eine ungueltige oder nicht erreichbare `image_url`
   WHEN `analyze_image` den Download versucht
   THEN wirft das Tool einen aussagekraeftigen Fehler (z.B. "Bild konnte nicht heruntergeladen werden"), der als Error-Event im SSE-Stream erscheint

7) GIVEN `analyze_image` als registriertes Tool
   WHEN der kompilierte Agent-Graph inspiziert wird
   THEN ist `analyze_image` im `tools`-Array des Agents enthalten und der Graph kompiliert ohne Fehler (zusaetzlich zu den bestehenden `draft_prompt` und `refine_prompt` Tools aus Slice 12)

8) GIVEN die Vision-API-Antwort des LLM
   WHEN die Antwort nicht als strukturiertes JSON mit den erwarteten 6 Keys geparst werden kann
   THEN gibt das Tool einen Fallback mit den Keys zurueck (leere Strings fuer fehlende Felder) oder einen klaren Fehlermeldung

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.
> **Syntax:** Python/pytest

### Test-Datei: `backend/tests/test_image_tools.py`

<test_spec>
```python
import pytest

# AC-1: analyze_image gibt strukturiertes Dict mit 6 Keys zurueck
@pytest.mark.skip(reason="AC-1")
def test_analyze_image_returns_structured_dict():
    ...

# AC-2: Bild groesser als 1024px wird herunterskaliert
@pytest.mark.skip(reason="AC-2")
def test_image_larger_than_1024_is_downscaled():
    ...

# AC-3: Bild kleiner als 1024px bleibt unveraendert
@pytest.mark.skip(reason="AC-3")
def test_image_smaller_than_1024_not_resized():
    ...

# AC-4: post_process_node haengt Analyse an reference_images an
@pytest.mark.skip(reason="AC-4")
def test_post_process_node_appends_to_reference_images():
    ...

# AC-5: SSE-Event tool-call-result wird fuer analyze_image gesendet
@pytest.mark.skip(reason="AC-5")
def test_analyze_image_triggers_tool_call_result_sse_event():
    ...

# AC-6: Fehlerhafter Download gibt aussagekraeftigen Fehler
@pytest.mark.skip(reason="AC-6")
def test_analyze_image_handles_download_error():
    ...

# AC-7: Tool ist im Agent-Graph registriert
@pytest.mark.skip(reason="AC-7")
def test_analyze_image_registered_in_agent():
    ...

# AC-8: Unstrukturierte Vision-Antwort wird graceful behandelt
@pytest.mark.skip(reason="AC-8")
def test_analyze_image_handles_malformed_vision_response():
    ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03-langgraph-agent` | `app.agent.graph.create_agent` | Factory-Funktion | `create_agent(checkpointer=None) -> CompiledGraph` |
| `slice-03-langgraph-agent` | `app.agent.state.PromptAssistantState` | TypedDict | State mit `reference_images: list[dict]` Feld |
| `slice-12-prompt-tools-backend` | `post_process_node` | Graph Node | Node erweitern fuer `analyze_image` Tool-Results |
| `slice-12-prompt-tools-backend` | `app.agent.tools.prompt_tools` | Registrierte Tools | `draft_prompt`, `refine_prompt` bereits im Graph |
| `slice-04-sse-streaming-endpoint` | SSE Event Protocol | Event-Format | `tool-call-result` Events werden generisch gestreamt |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `app.agent.tools.image_tools.analyze_image` | LangGraph Tool | slice-17 (Image Upload UI), slice-18 (Caching) | Tool: `image_url: str -> {"subject": str, "style": str, "mood": str, "lighting": str, "composition": str, "palette": str}` |
| `post_process_node` (erweitert) | Graph Node | slice-18, slice-20 | Node: Erkennt `analyze_image` Results, aktualisiert `reference_images` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/agent/tools/image_tools.py` -- analyze_image Tool: Download, Pillow-Resize, Vision-LLM-Call, strukturierte JSON-Extraktion
- [ ] `backend/app/agent/graph.py` (erweitert) -- analyze_image Tool registrieren, post_process_node fuer reference_images erweitern
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice erstellt KEINE UI-Komponenten (Image-Upload UI kommt in Slice 17)
- Dieser Slice implementiert KEIN Caching in der DB (kommt in Slice 18 mit `assistant_images` Tabelle)
- Dieser Slice erstellt KEIN Image-Repository (kommt in Slice 18)
- Dieser Slice aendert NICHT den SSE-Streaming Code (Slice 04 sendet tool-call-result Events bereits generisch)
- Bild wird im Memory verarbeitet (Download -> Resize -> Base64 an Vision API) -- kein persistentes Speichern auf Disk

**Technische Constraints:**
- Tool mit `@tool` Decorator aus `langchain_core.tools` definieren
- Pillow (`PIL.Image`) fuer Download-Verarbeitung und Resize nutzen (`Image.thumbnail()` mit max 1024px laengste Kante)
- HTTP-Download via `httpx` (async) oder `urllib` -- nicht `requests` (async-Kompatibilitaet)
- Vision-Call ueber dasselbe LLM das der Agent nutzt (ChatOpenAI mit OpenRouter base_url) -- Bild als Base64-Content im HumanMessage
- Strukturierte Extraktion via System-Prompt der JSON-Antwort erzwingt (6 Keys: subject, style, mood, lighting, composition, palette)
- Tool-Rueckgabewert als Python Dict (nicht Pydantic Model) -- konsistent mit Slice 12
- `post_process_node` erweitern (nicht ersetzen) -- bestehende draft_prompt/refine_prompt Logik bleibt intakt

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "SSE Event Types" (tool-call-result Payload fuer analyze_image)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Server Logic" (analyze_image Tool-Beschreibung, 1024px Skalierung)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "LangGraph State" (reference_images Feld)
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Validation Rules" (Image max 1024px)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "Agent-Definition / Tools" (analyze_image Beschreibung)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "Business Rules" (Bildanalyse-Caching, Bild-Upload Formate)
