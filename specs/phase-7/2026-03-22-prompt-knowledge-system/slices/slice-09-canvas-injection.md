# Slice 9: Canvas Chat Knowledge-Injection

> **Slice 9 von 13** fuer `Model-Aware Prompt Knowledge System`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-09-canvas-injection` |
| **Test** | `cd backend && python -m pytest tests/unit/test_canvas_knowledge_injection.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-python-lookup"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi` |
| **Test Command** | `cd backend && python -m pytest tests/unit/test_canvas_knowledge_injection.py -v` |
| **Integration Command** | -- |
| **Acceptance Command** | `cd backend && python -c "from app.agent.canvas_graph import build_canvas_system_prompt; p = build_canvas_system_prompt({'model_id': 'flux-2-pro', 'image_url': 'x', 'prompt': 'test', 'model_params': {}}); assert 'Prompting-Tipps' in p or 'tips' in p.lower(); print('OK')"` |
| **Start Command** | `cd backend && uvicorn app.main:app` |
| **Health Endpoint** | `http://localhost:8000/health` |
| **Mocking Strategy** | `mock_external` (Knowledge-Lookup per monkeypatch mocken) |

---

## Ziel

`build_canvas_system_prompt()` in `canvas_graph.py` erweitern, sodass nach der bestehenden `context_section` eine Knowledge-Sektion mit modellspezifischen Prompting-Tipps angehaengt wird. Die Tipps werden per `get_prompt_knowledge` + `format_knowledge_for_prompt` (aus Slice 03) fuer die `model_id` aus `image_context` geladen. Ohne `image_context` oder bei fehlendem `model_id` wird kein Knowledge-Block eingefuegt.

---

## Acceptance Criteria

1) GIVEN `image_context` mit `model_id` = `"flux-2-pro"` und gueltigem Knowledge-Eintrag fuer Prefix `flux-2`
   WHEN `build_canvas_system_prompt(image_context)` aufgerufen wird
   THEN enthaelt der zurueckgegebene String den bisherigen base_prompt, die context_section UND einen Knowledge-Block mit Flux-spezifischen Prompting-Tipps

2) GIVEN `image_context` mit `model_id` = `"unknown-model-xyz"` (kein Prefix-Match)
   WHEN `build_canvas_system_prompt(image_context)` aufgerufen wird
   THEN enthaelt der zurueckgegebene String den base_prompt, die context_section UND einen Knowledge-Block mit Fallback-Tipps (generisches Wissen)

3) GIVEN `image_context` ist `None`
   WHEN `build_canvas_system_prompt(None)` aufgerufen wird
   THEN wird NUR der base_prompt zurueckgegeben (kein Knowledge-Block, kein Crash)

4) GIVEN `image_context` ist ein leeres Dict `{}`
   WHEN `build_canvas_system_prompt({})` aufgerufen wird
   THEN wird der base_prompt mit context_section (leere Werte) zurueckgegeben, Knowledge-Block wird mit leerem `model_id` aufgerufen und liefert Fallback

5) GIVEN `image_context` mit `model_id` = `"black-forest-labs/flux-2-pro"` (mit Owner-Prefix)
   WHEN `build_canvas_system_prompt(image_context)` aufgerufen wird
   THEN wird der Slash korrekt gehandhabt (Slash-Stripping passiert in `get_prompt_knowledge`) und der Knowledge-Block enthaelt Flux-spezifische Tipps

6) GIVEN `image_context` mit `model_id` = `"flux-2-pro"`
   WHEN `build_canvas_system_prompt(image_context)` aufgerufen wird
   THEN steht der Knowledge-Block NACH der context_section (Reihenfolge: base_prompt + context_section + knowledge_section)

7) GIVEN der Knowledge-Lookup wirft eine unerwartete Exception (z.B. JSON-Datei nicht gefunden)
   WHEN `build_canvas_system_prompt(image_context)` aufgerufen wird
   THEN wird der base_prompt + context_section OHNE Knowledge-Block zurueckgegeben (graceful degradation, kein Crash)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `backend/tests/unit/test_canvas_knowledge_injection.py`

<test_spec>
```python
import pytest


class TestBuildCanvasSystemPromptKnowledgeInjection:
    # AC-1: Knowledge-Block mit Flux-Tipps bei bekanntem Modell
    @pytest.mark.skip(reason="AC-1")
    def test_includes_flux_knowledge_for_flux_model(self): ...

    # AC-2: Fallback-Tipps bei unbekanntem Modell
    @pytest.mark.skip(reason="AC-2")
    def test_includes_fallback_knowledge_for_unknown_model(self): ...

    # AC-3: Kein Knowledge-Block bei None image_context
    @pytest.mark.skip(reason="AC-3")
    def test_no_knowledge_block_when_image_context_none(self): ...

    # AC-4: Leeres Dict als image_context
    @pytest.mark.skip(reason="AC-4")
    def test_handles_empty_dict_image_context(self): ...

    # AC-5: Owner-Prefix Slash-Stripping via Lookup
    @pytest.mark.skip(reason="AC-5")
    def test_handles_owner_slash_in_model_id(self): ...

    # AC-6: Knowledge-Block steht nach context_section
    @pytest.mark.skip(reason="AC-6")
    def test_knowledge_block_after_context_section(self): ...

    # AC-7: Graceful degradation bei Lookup-Fehler
    @pytest.mark.skip(reason="AC-7")
    def test_graceful_degradation_on_lookup_error(self): ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-03-python-lookup | `get_prompt_knowledge` | Function | `(model_id: str, mode: str \| None = None) -> dict` -- importierbar aus `app.agent.prompt_knowledge` |
| slice-03-python-lookup | `format_knowledge_for_prompt` | Function | `(result: dict) -> str` -- gibt formatierten String zurueck |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `build_canvas_system_prompt` (erweitert) | Function | slice-13 (Integration-Test) | `(image_context: dict \| None) -> str` -- Signatur unveraendert, Output erweitert um Knowledge-Block |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/agent/canvas_graph.py` -- EXTEND: `build_canvas_system_prompt()` um Knowledge-Lookup und Prompt-Tipps-Block nach der context_section erweitern. Import von `get_prompt_knowledge` + `format_knowledge_for_prompt` hinzufuegen.
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderung der Funktion-Signatur von `build_canvas_system_prompt` (bleibt `(image_context: Optional[dict]) -> str`)
- KEINE Aenderung am base_prompt oder an der context_section
- KEINE Aenderung an `create_canvas_agent`, `_call_model_sync`, `_call_model_async` oder anderen Funktionen
- KEIN Modus-Parameter (`mode`) -- Canvas Chat kennt keinen expliziten Generierungsmodus, daher wird `mode=None` an den Lookup uebergeben
- KEINE neuen Python-Dependencies

**Technische Constraints:**
- Knowledge-Lookup per `get_prompt_knowledge(model_id, None)` aufrufen (kein Modus im Canvas-Kontext)
- Formatierung per `format_knowledge_for_prompt(result)` -- gleiche Funktion wie Assistant (Slice 06)
- Exception-Handling: try/except um den Lookup-Aufruf, bei Fehler nur loggen und ohne Knowledge-Block weitermachen
- Der Knowledge-Block soll nur eingefuegt werden wenn `image_context` truthy ist UND `model_id` vorhanden ist

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` -- Section "Server Logic > build_canvas_system_prompt" (Zeile 96)
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` -- Section "Business Logic Flow > Canvas Chat" (Zeilen 123-126)
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` -- Section "Error Handling Strategy" (Zeilen 205-209)
- Discovery: `specs/phase-7/2026-03-22-prompt-knowledge-system/discovery.md` -- Section "Integration: Canvas Chat" (Zeilen 164-169)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `backend/app/agent/canvas_graph.py` | EXTEND -- `build_canvas_system_prompt()` erweitern, Rest unberuehrt |
| `backend/app/agent/prompt_knowledge.py` | Import `get_prompt_knowledge` + `format_knowledge_for_prompt` -- NICHT modifizieren |
