# Slice 6: Assistant System-Prompt dynamisch machen

> **Slice 6 von 13** fuer `Model-Aware Prompt Knowledge System`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-06-assistant-prompt` |
| **Test** | `cd backend && python -m pytest tests/unit/test_build_assistant_prompt.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-python-lookup"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi` |
| **Test Command** | `cd backend && python -m pytest tests/unit/test_build_assistant_prompt.py -v` |
| **Integration Command** | -- |
| **Acceptance Command** | `cd backend && python -c "from app.agent.prompts import build_assistant_system_prompt; p = build_assistant_system_prompt(None, None); assert 'Prompt-Assistent' in p; print('OK')"` |
| **Start Command** | `cd backend && uvicorn app.main:app` |
| **Health Endpoint** | `http://localhost:8000/health` |
| **Mocking Strategy** | `mock_external` (Knowledge-Lookup per monkeypatch/fixture mocken) |

---

## Ziel

Die statische `SYSTEM_PROMPT`-Konstante in `prompts.py` durch eine Funktion `build_assistant_system_prompt(image_model_id, generation_mode)` ersetzen, die bei vorhandenem Modell-Kontext eine Knowledge-Sektion an den Base-Prompt anhaengt. In `graph.py` die beiden Caller (`_call_model_sync`, `_call_model_async`) anpassen, damit sie `image_model_id` und `generation_mode` aus `config["configurable"]` lesen und die neue Funktion aufrufen.

---

## Acceptance Criteria

1) GIVEN `image_model_id="flux-2-pro"` und `generation_mode="txt2img"`
   WHEN `build_assistant_system_prompt("flux-2-pro", "txt2img")` aufgerufen wird
   THEN enthaelt der zurueckgegebene String den bisherigen Base-Prompt UND eine Knowledge-Sektion mit Flux-spezifischen Tipps

2) GIVEN `image_model_id=None` und `generation_mode=None`
   WHEN `build_assistant_system_prompt(None, None)` aufgerufen wird
   THEN ist der zurueckgegebene String identisch mit dem bisherigen statischen `SYSTEM_PROMPT` (keine Knowledge-Sektion angehaengt)

3) GIVEN `image_model_id="unknown-model-xyz"` und `generation_mode=None`
   WHEN `build_assistant_system_prompt("unknown-model-xyz", None)` aufgerufen wird
   THEN enthaelt der zurueckgegebene String den Base-Prompt UND eine Knowledge-Sektion mit Fallback-Tipps (displayName "Generic")

4) GIVEN `image_model_id="black-forest-labs/flux-2-pro"` (mit Owner-Prefix)
   WHEN `build_assistant_system_prompt("black-forest-labs/flux-2-pro", "txt2img")` aufgerufen wird
   THEN wird der Owner-Teil korrekt gestrippt und Flux-Knowledge zurueckgegeben (Slash-Stripping funktioniert transitiv via `get_prompt_knowledge`)

5) GIVEN `image_model_id` ist ein leerer String `""`
   WHEN `build_assistant_system_prompt("", None)` aufgerufen wird
   THEN wird der Base-Prompt ohne Knowledge-Sektion zurueckgegeben (Backward-Kompatibilitaet wie bei None)

6) GIVEN `config["configurable"]` enthaelt `{"image_model_id": "flux-2-pro", "generation_mode": "txt2img"}`
   WHEN `_call_model_sync` (oder `_call_model_async`) in `graph.py` aufgerufen wird
   THEN wird `build_assistant_system_prompt("flux-2-pro", "txt2img")` als SystemMessage-Content verwendet (nicht mehr die statische Konstante)

7) GIVEN `config["configurable"]` enthaelt KEINE Keys `image_model_id` und `generation_mode`
   WHEN `_call_model_sync` (oder `_call_model_async`) in `graph.py` aufgerufen wird
   THEN wird `build_assistant_system_prompt(None, None)` aufgerufen und der Base-Prompt ohne Knowledge verwendet (Backward-Kompatibilitaet)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `backend/tests/unit/test_build_assistant_prompt.py`

<test_spec>
```python
import pytest


class TestBuildAssistantSystemPrompt:
    # AC-1: Knowledge-Sektion mit Flux-Tipps bei bekanntem Modell + Modus
    @pytest.mark.skip(reason="AC-1")
    def test_includes_flux_knowledge_for_known_model(self): ...

    # AC-2: Identisch mit Base-Prompt bei None/None
    @pytest.mark.skip(reason="AC-2")
    def test_returns_base_prompt_without_knowledge_when_none(self): ...

    # AC-3: Fallback-Knowledge bei unbekanntem Modell
    @pytest.mark.skip(reason="AC-3")
    def test_includes_fallback_knowledge_for_unknown_model(self): ...

    # AC-4: Slash-Stripping fuer Owner/Model-Format
    @pytest.mark.skip(reason="AC-4")
    def test_handles_owner_slash_model_format(self): ...

    # AC-5: Leerer String behandelt wie None
    @pytest.mark.skip(reason="AC-5")
    def test_empty_string_treated_as_no_model(self): ...


class TestGraphConfigIntegration:
    # AC-6: graph.py liest config und ruft build_assistant_system_prompt auf
    @pytest.mark.skip(reason="AC-6")
    def test_call_model_uses_config_image_model_id(self): ...

    # AC-7: graph.py ohne image_model_id in config -> Base-Prompt
    @pytest.mark.skip(reason="AC-7")
    def test_call_model_without_config_uses_base_prompt(self): ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-03-python-lookup | `get_prompt_knowledge` | Function | `(model_id: str, mode: str \| None) -> dict` — liefert Modell-Knowledge oder Fallback |
| slice-03-python-lookup | `format_knowledge_for_prompt` | Function | `(result: dict) -> str` — liefert formatierten String fuer System-Prompt-Injection |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `build_assistant_system_prompt` | Function | slice-07 (DTO+Route, indirekt via graph.py), slice-13 (Integration-Test) | `(image_model_id: str \| None, generation_mode: str \| None) -> str` |
| `config["configurable"]["image_model_id"]` | Config Key | slice-07 (setzt den Wert in assistant_service.py) | `str \| None` |
| `config["configurable"]["generation_mode"]` | Config Key | slice-07 (setzt den Wert in assistant_service.py) | `str \| None` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/agent/prompts.py` (MODIFY) -- Neue Funktion `build_assistant_system_prompt(image_model_id, generation_mode)`. Base-Prompt bleibt als internes Template. `SYSTEM_PROMPT`-Konstante entfernen oder als deprecated beibehalten.
- [ ] `backend/app/agent/graph.py` (MODIFY) -- Import von `build_assistant_system_prompt` statt `SYSTEM_PROMPT`. `_call_model_sync` und `_call_model_async` lesen `image_model_id` + `generation_mode` aus `config["configurable"]` und rufen die neue Funktion auf.
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Aendern der Knowledge-JSON-Datei (Slice 01 + Slice 11)
- KEIN Aendern von `prompt_knowledge.py` (Slice 03)
- KEIN Aendern der DTOs, Routes oder Services (Slice 07)
- KEIN Aendern der Frontend-Dateien (Slice 08)
- KEINE neuen Python-Dependencies

**Technische Constraints:**
- `build_assistant_system_prompt` MUSS beide Parameter als optional akzeptieren (`None` ist der Default)
- Bei `None`/`None` oder leerem String: exakt den bisherigen Base-Prompt zurueckgeben (kein angehaengter Knowledge-Block)
- Bei vorhandenem `image_model_id`: `get_prompt_knowledge` + `format_knowledge_for_prompt` aus `prompt_knowledge.py` nutzen
- Knowledge-Sektion wird an den Base-Prompt angehaengt (nicht eingefuegt oder ersetzt)
- `SYSTEM_PROMPT`-Konstante darf entfernt werden, da graph.py der einzige Consumer ist und ebenfalls modifiziert wird
- `config["configurable"]` lesen folgt dem bestehenden Pattern (siehe `graph.py` Zeile 230: `config.get("configurable", {}).get("model")`)

**Referenzen:**
- Architecture: `architecture.md` -- Section "Server Logic > build_assistant_system_prompt" (Zeile 95)
- Architecture: `architecture.md` -- Section "Migration Map" (Zeilen 222-223: prompts.py + graph.py)
- Architecture: `architecture.md` -- Section "Business Logic Flow > [Assistant]" (Zeilen 112-121)
- Discovery: `discovery.md` -- Section "Integration: Aenderungen pro System > 2. Assistant" (Zeilen 155-162)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `backend/app/agent/prompt_knowledge.py` | Import `get_prompt_knowledge` + `format_knowledge_for_prompt` -- NICHT neu implementieren (Slice 03) |
| `backend/app/agent/prompts.py` | MODIFY: Base-Prompt-Text bleibt erhalten, wird in Funktion gewrappt |
| `backend/app/agent/graph.py` | MODIFY: Import-Zeile und SystemMessage-Erzeugung in `_call_model_sync` / `_call_model_async` anpassen |
