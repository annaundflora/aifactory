# Slice 06b: Canvas Agent Extension (Python)

> **Slice 06b von 16** fuer `AI Image Editing Suite`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-06b-canvas-agent` |
| **Test** | `cd backend && python -m pytest tests/unit/test_canvas_agent_edit.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-types-model-slots"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi` |
| **Test Command** | `cd backend && python -m pytest tests/unit/test_canvas_agent_edit.py -v` |
| **Integration Command** | `cd backend && python -m pytest tests/integration/test_canvas_agent_edit_integration.py -v` |
| **Acceptance Command** | `cd backend && python -m pytest tests/ -v` |
| **Start Command** | `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | `http://localhost:8000/api/assistant/health` |
| **Mocking Strategy** | `mock_external` (kein LLM-Call noetig, Tool-Logik und Prompt-Inhalt testbar) |

---

## Ziel

Canvas Agent System-Prompt um Edit-Intent-Klassifikation erweitern (Mask+Prompt -> inpaint, No-Mask+Edit-Intent -> instruction, Outpaint-Kontext -> outpaint). `generate_image` Tool um 4 neue Actions und zugehoerige Parameter erweitern. `CanvasImageContext` DTO um `mask_url` Feld ergaenzen, damit der Agent Mask-Praesenz fuer Routing-Entscheidungen erkennen kann.

---

## Acceptance Criteria

1) GIVEN `CanvasImageContext` wird mit `mask_url="https://r2.example.com/mask.png"` instanziiert
   WHEN das Modell validiert wird
   THEN ist `mask_url` ein gueltiger `Optional[HttpUrl]` Wert und im `model_dump()` enthalten

2) GIVEN `CanvasImageContext` wird ohne `mask_url` instanziiert
   WHEN das Modell validiert wird
   THEN ist `mask_url` gleich `None` (Default)

3) GIVEN ein `image_context` Dict mit `mask_url` gesetzt
   WHEN `build_canvas_system_prompt(image_context)` aufgerufen wird
   THEN enthaelt der zurueckgegebene Prompt-String die Routing-Regel: Mask vorhanden + Prompt -> `action="inpaint"`

4) GIVEN ein `image_context` Dict ohne `mask_url` (oder `mask_url=None`)
   WHEN `build_canvas_system_prompt(image_context)` aufgerufen wird
   THEN enthaelt der zurueckgegebene Prompt-String die Routing-Regel: Keine Mask + Edit-Intent -> `action="instruction"`

5) GIVEN ein `image_context` Dict (beliebig)
   WHEN `build_canvas_system_prompt(image_context)` aufgerufen wird
   THEN enthaelt der zurueckgegebene Prompt-String die Routing-Regel: Outpaint-Kontext -> `action="outpaint"`

6) GIVEN `generate_image` wird mit `action="inpaint"`, `prompt="replace with red dress"`, `model_id="black-forest-labs/flux-fill-pro"`, `params={}`, `mask_url="https://r2.example.com/mask.png"` aufgerufen
   WHEN das Tool ausgefuehrt wird
   THEN gibt es ein Dict zurueck mit `{"action": "inpaint", "prompt": "replace with red dress", "model_id": "black-forest-labs/flux-fill-pro", "params": {}, "mask_url": "https://r2.example.com/mask.png"}`

7) GIVEN `generate_image` wird mit `action="erase"`, `prompt=""`, `model_id="bria/eraser"`, `params={}`, `mask_url="https://r2.example.com/mask.png"` aufgerufen
   WHEN das Tool ausgefuehrt wird
   THEN gibt es ein Dict zurueck mit `{"action": "erase", "mask_url": "https://r2.example.com/mask.png"}` (plus prompt, model_id, params)

8) GIVEN `generate_image` wird mit `action="outpaint"`, `prompt="extend with beach"`, `model_id="black-forest-labs/flux-fill-pro"`, `params={}`, `outpaint_directions=["top", "right"]`, `outpaint_size=50` aufgerufen
   WHEN das Tool ausgefuehrt wird
   THEN gibt es ein Dict zurueck das `outpaint_directions: ["top", "right"]` und `outpaint_size: 50` enthaelt

9) GIVEN `generate_image` wird mit `action="instruction"`, `prompt="make sky bluer"`, `model_id="black-forest-labs/flux-kontext-pro"`, `params={}` aufgerufen (ohne mask_url, ohne outpaint_*)
   WHEN das Tool ausgefuehrt wird
   THEN gibt es ein Dict zurueck mit `action: "instruction"` und OHNE `mask_url`, `outpaint_directions`, `outpaint_size` Schluessel (oder diese sind None)

10) GIVEN `generate_image` wird mit `action="invalid_action"` aufgerufen
    WHEN das Tool ausgefuehrt wird
    THEN wird `action` auf `"variation"` zurueckgesetzt (Fallback, wie bisher)

11) GIVEN `generate_image` wird mit `action="inpaint"` aber ohne `mask_url` aufgerufen
    WHEN das Tool ausgefuehrt wird
    THEN gibt das Tool ein Error-Dict zurueck: `{"error": "mask_url is required for inpaint action"}`

12) GIVEN `generate_image` wird mit `action="outpaint"` aber ohne `outpaint_directions` aufgerufen
    WHEN das Tool ausgefuehrt wird
    THEN gibt das Tool ein Error-Dict zurueck: `{"error": "outpaint_directions is required for outpaint action"}`

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `backend/tests/unit/test_canvas_agent_edit.py`

<test_spec>
```python
import pytest

# --- CanvasImageContext DTO Tests ---

# AC-1: mask_url akzeptiert gueltige URL
def test_canvas_image_context_accepts_valid_mask_url():
    pass  # TODO

# AC-2: mask_url ist optional und default None
def test_canvas_image_context_mask_url_defaults_to_none():
    pass  # TODO

# --- System Prompt Tests ---

# AC-3: Prompt enthaelt inpaint-Routing-Regel wenn mask_url gesetzt
def test_system_prompt_contains_inpaint_routing_when_mask_present():
    pass  # TODO

# AC-4: Prompt enthaelt instruction-Routing-Regel wenn keine mask
def test_system_prompt_contains_instruction_routing_when_no_mask():
    pass  # TODO

# AC-5: Prompt enthaelt outpaint-Routing-Regel
def test_system_prompt_contains_outpaint_routing():
    pass  # TODO

# --- generate_image Tool Tests ---

# AC-6: inpaint action mit mask_url
def test_generate_image_inpaint_returns_mask_url():
    pass  # TODO

# AC-7: erase action mit mask_url
def test_generate_image_erase_returns_mask_url():
    pass  # TODO

# AC-8: outpaint action mit directions und size
def test_generate_image_outpaint_returns_directions_and_size():
    pass  # TODO

# AC-9: instruction action ohne mask/outpaint params
def test_generate_image_instruction_omits_mask_and_outpaint():
    pass  # TODO

# AC-10: ungueltige action faellt auf variation zurueck
def test_generate_image_invalid_action_falls_back_to_variation():
    pass  # TODO

# AC-11: inpaint ohne mask_url gibt error zurueck
def test_generate_image_inpaint_without_mask_returns_error():
    pass  # TODO

# AC-12: outpaint ohne directions gibt error zurueck
def test_generate_image_outpaint_without_directions_returns_error():
    pass  # TODO
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-types-model-slots` | `GenerationMode` mit `"erase"`, `"instruction"` | Type (TypeScript) | Nicht direkt importiert in Python, aber Actions muessen mit Frontend-Modes konsistent sein |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `CanvasImageContext.mask_url` | Pydantic Field | slice-06a (Frontend SSE Client), slice-08 (Canvas Chat) | `mask_url: Optional[HttpUrl] = None` |
| `generate_image` Tool (erweitert) | LangGraph Tool | Canvas Agent Graph (interner Consumer) | `generate_image(action, prompt, model_id, params, mask_url?, outpaint_directions?, outpaint_size?) -> dict` |
| System-Prompt Edit-Routing | Prompt-String | Canvas Agent Graph (interner Consumer) | `build_canvas_system_prompt(image_context) -> str` mit Edit-Intent-Regeln |
| SSE `canvas-generate` Event (erweitert) | SSE Event Payload | slice-06a (Frontend), slice-08 (Canvas Chat Panel) | Dict mit `action` in `["variation", "img2img", "inpaint", "erase", "instruction", "outpaint"]` + optionalen `mask_url`, `outpaint_directions`, `outpaint_size` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/agent/canvas_graph.py` — `build_canvas_system_prompt()` um Edit-Intent-Klassifikation und Mask-aware Routing erweitern
- [ ] `backend/app/agent/tools/image_tools.py` — `generate_image` Tool-Signatur um `mask_url`, `outpaint_directions`, `outpaint_size` Parameter und 4 neue Actions erweitern, Validation fuer action-spezifische Pflichtfelder
- [ ] `backend/app/routes/canvas_sessions.py` — `CanvasImageContext` Pydantic-Modell um `mask_url: Optional[HttpUrl]` Feld erweitern
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Erase-Direct-Flow (Erase ohne Agent umgeht den Canvas Agent komplett — wird in slice-08 behandelt)
- KEINE Frontend-Aenderungen (SSE-Event-Parsing, handleCanvasGenerate — das ist slice-06a)
- KEINE GenerationService-Aenderungen (buildReplicateInput — das ist slice-07)
- KEINE SAM-Integration (eigener Slice)
- KEINE LLM-Call-Tests (System-Prompt-Inhalt und Tool-Rueckgabewerte testen, nicht ob der LLM korrekt routet)

**Technische Constraints:**
- `generate_image` bleibt ein synchrones `@tool` (kein `async`) — es fuehrt keine API-Calls aus
- Neue Parameter `mask_url`, `outpaint_directions`, `outpaint_size` muessen als `Optional` mit Default `None` deklariert werden (LangGraph/LLM sendet sie nur bei Bedarf)
- `outpaint_directions` Validation: Subset von `["top", "bottom", "left", "right"]`
- `outpaint_size` Validation: Wert muss in `[25, 50, 100]` liegen
- Action-Validation: gueltige Actions sind `"variation"`, `"img2img"`, `"inpaint"`, `"erase"`, `"instruction"`, `"outpaint"`
- Rueckwaertskompatibilitaet: bestehende `action="variation"` und `action="img2img"` Calls muessen weiterhin funktionieren

**Reuse (PFLICHT):**

| Existing File | Usage in this Slice |
|---|---|
| `backend/app/agent/canvas_graph.py` | MODIFY — `build_canvas_system_prompt()` erweitern, Bestehendes beibehalten |
| `backend/app/agent/tools/image_tools.py` | MODIFY — `generate_image` Tool-Signatur + Body erweitern |
| `backend/app/routes/canvas_sessions.py` | MODIFY — `CanvasImageContext` Pydantic-Modell um 1 Feld erweitern |

**Referenzen:**
- Architecture: `architecture.md` → Section "Server Logic" (Zeile 141-200) fuer Intent-Klassifikation und Routing-Logik
- Architecture: `architecture.md` → Section "API Design > Endpoints" (Zeile 69-78) fuer Tool-Parameter und DTO-Felder
- Architecture: `architecture.md` → Section "Migration Map" (Zeile 336-338) fuer spezifische Aenderungen pro Datei
- Discovery: `discovery.md` → "Business Rules > Modell-Routing" (Zeile 289-296) fuer Routing-Regeln
