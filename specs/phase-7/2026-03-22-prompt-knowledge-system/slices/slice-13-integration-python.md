# Slice 13: Integration-Test Assistant + Canvas Chat + recommend_model

> **Slice 13 von 13** fuer `Model-Aware Prompt Knowledge System`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-13-integration-python` |
| **Test** | `cd backend && python -m pytest tests/test_knowledge_integration.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["slice-06-assistant-prompt", "slice-09-canvas-injection", "slice-10-recommend-model", "slice-11-knowledge-content"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi` |
| **Test Command** | `cd backend && python -m pytest tests/test_knowledge_integration.py -v` |
| **Integration Command** | `cd backend && python -m pytest tests/test_knowledge_integration.py -v` |
| **Acceptance Command** | `cd backend && python -m pytest tests/test_knowledge_integration.py -v --tb=short` |
| **Start Command** | `cd backend && uvicorn app.main:app` |
| **Health Endpoint** | `http://localhost:8000/health` |
| **Mocking Strategy** | `no_mocks` (echte Knowledge-JSON, echte Lookup-Funktionen, echte Prompt-Builder; keine LLM-Aufrufe) |

---

## Ziel

Integration-Tests fuer die drei Python-seitigen Knowledge-Consumer schreiben: `build_assistant_system_prompt`, `build_canvas_system_prompt` und `_match_model`. Anders als die Unit-Tests in Slice 06/09/10 (die den Lookup mocken) verwenden diese Tests die echte `prompt-knowledge.json` und pruefen End-to-End, dass modellspezifisches Wissen korrekt im Output erscheint.

---

## Acceptance Criteria

1) GIVEN die echte `data/prompt-knowledge.json` mit Flux-2-Eintrag
   WHEN `build_assistant_system_prompt("flux-2-pro", "txt2img")` aufgerufen wird
   THEN enthaelt der zurueckgegebene String mindestens einen Tipp aus `models["flux-2"].tips`

2) GIVEN die echte Knowledge-Datei mit Seedream-Eintrag
   WHEN `build_assistant_system_prompt("seedream-5", "img2img")` aufgerufen wird
   THEN enthaelt der zurueckgegebene String mindestens einen Tipp aus `models["seedream"].tips`

3) GIVEN die echte Knowledge-Datei und `image_context` mit `model_id="seedream-5"`
   WHEN `build_canvas_system_prompt({"model_id": "seedream-5", "image_url": "https://example.com/img.png", "prompt": "test", "model_params": {}})` aufgerufen wird
   THEN enthaelt der zurueckgegebene String mindestens einen Seedream-spezifischen Tipp

4) GIVEN die echte Knowledge-Datei und `available_models` mit einem Flux-Modell
   WHEN `_match_model("product photography", ["photorealistic"], available_models)` aufgerufen wird
   THEN enthaelt `result["reason"]` mindestens eine Staerke aus `models["flux-2"].strengths`

5) GIVEN die echte Knowledge-Datei
   WHEN `build_assistant_system_prompt(None, None)` aufgerufen wird
   THEN enthaelt der String den Base-Prompt OHNE angehaengte Knowledge-Sektion

6) GIVEN die echte Knowledge-Datei
   WHEN `build_canvas_system_prompt(None)` aufgerufen wird
   THEN wird NUR der base_prompt zurueckgegeben (kein Crash, kein Knowledge-Block)

7) GIVEN die echte Knowledge-Datei mit `models["flux-2"].modes.txt2img.tips`
   WHEN `build_assistant_system_prompt("flux-2-pro", "txt2img")` aufgerufen wird
   THEN enthaelt der String modus-spezifische txt2img-Tipps aus der Knowledge-Datei

---

## Test Skeletons

> **Hinweis:** Dieses Slice erstellt eine NEUE Test-Datei als einziges Deliverable.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `backend/tests/test_knowledge_integration.py`

<test_spec>
```python
import pytest


class TestAssistantKnowledgeIntegration:
    # AC-1: Flux-Tipps im Assistant System-Prompt
    @pytest.mark.skip(reason="AC-1")
    def test_flux_model_produces_flux_tips_in_assistant_prompt(self): ...

    # AC-2: Seedream-Tipps im Assistant System-Prompt
    @pytest.mark.skip(reason="AC-2")
    def test_seedream_model_produces_seedream_tips_in_assistant_prompt(self): ...

    # AC-5: Backward-Kompatibilitaet ohne Modell-Kontext
    @pytest.mark.skip(reason="AC-5")
    def test_no_model_context_returns_base_prompt_only(self): ...

    # AC-7: Modus-spezifische Tipps im Assistant System-Prompt
    @pytest.mark.skip(reason="AC-7")
    def test_txt2img_mode_tips_included_for_flux(self): ...


class TestCanvasChatKnowledgeIntegration:
    # AC-3: Seedream-Tipps im Canvas Chat System-Prompt
    @pytest.mark.skip(reason="AC-3")
    def test_seedream_model_produces_tips_in_canvas_prompt(self): ...

    # AC-6: Kein Crash bei None image_context
    @pytest.mark.skip(reason="AC-6")
    def test_none_image_context_returns_base_prompt(self): ...


class TestRecommendModelKnowledgeIntegration:
    # AC-4: Knowledge-Staerken im recommend_model Reason
    @pytest.mark.skip(reason="AC-4")
    def test_match_model_reason_contains_knowledge_strengths(self): ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-06-assistant-prompt | `build_assistant_system_prompt` | Function | `(image_model_id: str \| None, generation_mode: str \| None) -> str` |
| slice-09-canvas-injection | `build_canvas_system_prompt` | Function | `(image_context: dict \| None) -> str` — erweitert um Knowledge-Block |
| slice-10-recommend-model | `_match_model` | Function (intern) | `(prompt_summary, style_keywords, available_models) -> dict \| None` — `reason` mit Knowledge-Staerken |
| slice-11-knowledge-content | `data/prompt-knowledge.json` | Data File | Vollstaendige Eintraege fuer 9 Prefixe inkl. `strengths`, `tips`, `modes` |
| slice-03-python-lookup | `get_prompt_knowledge` | Function | Transitiv genutzt von den drei Consumern |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| -- | -- | -- | Letztes Slice, kein Consumer |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/tests/test_knowledge_integration.py` (NEW) — Integration-Tests: 3 Python-Knowledge-Consumer mit echter Knowledge-JSON End-to-End pruefen
<!-- DELIVERABLES_END -->

> **Hinweis:** Reines Test-Slice. Das Deliverable IST die Test-Datei.

---

## Constraints

**Scope-Grenzen:**
- KEIN Aendern von Produktiv-Code (prompts.py, canvas_graph.py, model_tools.py, prompt_knowledge.py)
- KEIN Aendern der Knowledge-JSON-Datei
- KEINE neuen Python-Dependencies
- KEINE Mocks fuer den Knowledge-Lookup — End-to-End-Verifikation mit echten Daten
- KEIN Test von graph.py Config-Integration (abgedeckt in Slice 06 Unit-Tests)
- KEIN LLM-Aufruf — nur Prompt-Builder-Funktionen und Matching-Logik

**Technische Constraints:**
- Direkte Imports: `from app.agent.prompts import build_assistant_system_prompt`, `from app.agent.canvas_graph import build_canvas_system_prompt`, `from app.agent.tools.model_tools import _match_model`
- Echte `data/prompt-knowledge.json` wird zur Testzeit geladen (kein Fixture-Override)
- Fuer AC-4: `available_models`-Liste als Test-Fixture bauen mit mindestens einem Flux-Modell (Struktur analog `model_tools.py` Zeilen 63-104)
- Assertions pruefen auf Substrings aus der echten Knowledge-Datei (dynamisch, nicht hartcodiert)
- Test-Datei in `backend/tests/` (Top-Level, nicht unit/ oder integration/ Subfolder)

**Referenzen:**
- Architecture: `architecture.md` — Section "Business Logic Flow" (Zeilen 101-132)
- Architecture: `architecture.md` — Section "Knowledge File Schema" (Zeilen 329-361)
- Slice 06: `slice-06-assistant-prompt.md` — `build_assistant_system_prompt` Interface + Verhalten
- Slice 09: `slice-09-canvas-injection.md` — `build_canvas_system_prompt` Interface + Verhalten
- Slice 10: `slice-10-recommend-model.md` — `_match_model` Interface + Verhalten

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `backend/app/agent/prompts.py` | Import `build_assistant_system_prompt` — NICHT modifizieren |
| `backend/app/agent/canvas_graph.py` | Import `build_canvas_system_prompt` — NICHT modifizieren |
| `backend/app/agent/tools/model_tools.py` | Import `_match_model` — NICHT modifizieren |
| `backend/app/agent/prompt_knowledge.py` | Transitiv genutzt — NICHT modifizieren |
| `data/prompt-knowledge.json` | Echte Datei wird zur Testzeit geladen — NICHT modifizieren |
