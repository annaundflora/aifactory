# Slice 7: Assistant DTO + Route + Service (image_model_id, generation_mode)

> **Slice 7 von 13** fuer `Model-Aware Prompt Knowledge System`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-07-assistant-dto` |
| **Test** | `cd backend && python -m pytest tests/unit/test_assistant_dto_route.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["slice-06-assistant-prompt"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi` |
| **Test Command** | `cd backend && python -m pytest tests/unit/test_assistant_dto_route.py -v` |
| **Integration Command** | -- |
| **Acceptance Command** | `cd backend && python -c "from app.models.dtos import SendMessageRequest; r = SendMessageRequest(content='test'); assert r.image_model_id is None; r2 = SendMessageRequest(content='test', image_model_id='flux-2-pro', generation_mode='txt2img'); print('OK')"` |
| **Start Command** | `cd backend && uvicorn app.main:app` |
| **Health Endpoint** | `http://localhost:8000/health` |
| **Mocking Strategy** | `mock_external` (LangGraph-Agent per monkeypatch mocken, kein echter LLM-Call) |

---

## Ziel

Die drei Backend-Dateien der Assistant-Message-Pipeline erweitern, sodass `image_model_id` und `generation_mode` als optionale Felder vom Request bis in `config["configurable"]` durchgereicht werden. Slice 06 hat graph.py bereits vorbereitet, diese Werte aus der Config zu lesen. Dieser Slice schliesst die Kette: DTO-Validierung, Route-Weitergabe, Service-Config-Setzung.

---

## Acceptance Criteria

1) GIVEN ein POST-Request an `/sessions/{id}/messages` mit Body `{ "content": "test", "image_model_id": "flux-2-pro", "generation_mode": "txt2img" }`
   WHEN der Request validiert wird
   THEN akzeptiert Pydantic den Body fehlerfrei und `request.image_model_id == "flux-2-pro"` sowie `request.generation_mode == "txt2img"`

2) GIVEN ein POST-Request an `/sessions/{id}/messages` mit Body `{ "content": "test" }` (ohne die neuen Felder)
   WHEN der Request validiert wird
   THEN akzeptiert Pydantic den Body fehlerfrei mit `request.image_model_id is None` und `request.generation_mode is None` (Backward-Kompatibilitaet)

3) GIVEN ein POST-Request mit `{ "content": "test", "generation_mode": "inpaint" }` (ungueltiger Modus)
   WHEN der Request validiert wird
   THEN antwortet Pydantic mit HTTP 422 (Validation Error), weil `"inpaint"` kein erlaubter Literal-Wert ist

4) GIVEN ein POST-Request mit `{ "content": "test", "image_model_id": "x" * 201 }` (201 Zeichen)
   WHEN der Request validiert wird
   THEN antwortet Pydantic mit HTTP 422 (max_length=200 verletzt)

5) GIVEN ein valider Request mit `image_model_id="flux-2-pro"` und `generation_mode="txt2img"`
   WHEN `messages.py` Route die Felder an `_service.stream_response()` weiterreicht
   THEN werden `image_model_id` und `generation_mode` als benannte Parameter uebergeben

6) GIVEN `stream_response` wird mit `image_model_id="flux-2-pro"` und `generation_mode="txt2img"` aufgerufen
   WHEN der LangGraph-Config aufgebaut wird
   THEN enthaelt `config["configurable"]` die Keys `"image_model_id": "flux-2-pro"` und `"generation_mode": "txt2img"` neben den bestehenden Keys (`thread_id`, `pending_image_urls`, `model`)

7) GIVEN `stream_response` wird ohne `image_model_id` und `generation_mode` aufgerufen (Defaults None)
   WHEN der LangGraph-Config aufgebaut wird
   THEN enthaelt `config["configurable"]` die Keys `"image_model_id": None` und `"generation_mode": None` (graph.py behandelt None korrekt seit Slice 06)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `backend/tests/unit/test_assistant_dto_route.py`

<test_spec>
```python
import pytest


class TestSendMessageRequestDTO:
    # AC-1: Neue optionale Felder werden akzeptiert
    @pytest.mark.skip(reason="AC-1")
    def test_accepts_image_model_id_and_generation_mode(self): ...

    # AC-2: Backward-Kompatibilitaet ohne neue Felder
    @pytest.mark.skip(reason="AC-2")
    def test_backward_compat_without_new_fields(self): ...

    # AC-3: Ungueltiger generation_mode wird abgelehnt
    @pytest.mark.skip(reason="AC-3")
    def test_rejects_invalid_generation_mode(self): ...

    # AC-4: image_model_id ueber max_length wird abgelehnt
    @pytest.mark.skip(reason="AC-4")
    def test_rejects_image_model_id_over_max_length(self): ...


class TestStreamResponseConfig:
    # AC-5: Route reicht neue Felder an Service weiter
    @pytest.mark.skip(reason="AC-5")
    def test_route_passes_new_fields_to_service(self): ...

    # AC-6: Service setzt neue Felder in config["configurable"]
    @pytest.mark.skip(reason="AC-6")
    def test_config_contains_image_model_id_and_generation_mode(self): ...

    # AC-7: Service setzt None-Defaults in config["configurable"]
    @pytest.mark.skip(reason="AC-7")
    def test_config_contains_none_defaults_when_fields_missing(self): ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-06-assistant-prompt | `build_assistant_system_prompt` | Function (in graph.py genutzt) | Liest `image_model_id` + `generation_mode` aus `config["configurable"]` — Slice 07 setzt diese Werte |
| slice-06-assistant-prompt | `config["configurable"]["image_model_id"]` | Config Key Convention | graph.py erwartet diese Keys (seit Slice 06) |
| slice-06-assistant-prompt | `config["configurable"]["generation_mode"]` | Config Key Convention | graph.py erwartet diese Keys (seit Slice 06) |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `SendMessageRequest.image_model_id` | DTO Field | slice-08 (Frontend sendet dieses Feld) | `Optional[str]`, max_length=200 |
| `SendMessageRequest.generation_mode` | DTO Field | slice-08 (Frontend sendet dieses Feld) | `Optional[Literal["txt2img", "img2img"]]` |
| `stream_response(image_model_id, generation_mode)` | Function Signature | slice-13 (Integration-Test) | `(session_id, content, image_urls?, model?, image_model_id?, generation_mode?) -> AsyncGenerator` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/models/dtos.py` (MODIFY) -- `SendMessageRequest` um `image_model_id: Optional[str]` (max_length=200) und `generation_mode: Optional[Literal["txt2img", "img2img"]]` erweitern
- [ ] `backend/app/routes/messages.py` (MODIFY) -- `send_message` Route reicht `request.image_model_id` und `request.generation_mode` an `_service.stream_response()` weiter
- [ ] `backend/app/services/assistant_service.py` (MODIFY) -- `stream_response` Signatur um `image_model_id` + `generation_mode` erweitern, beide in `config["configurable"]` setzen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Aendern von `graph.py` oder `prompts.py` (Slice 06)
- KEIN Aendern von `prompt_knowledge.py` (Slice 03)
- KEIN Aendern von Frontend-Dateien (Slice 08)
- KEINE neuen Python-Dependencies
- KEINE neuen Endpoints oder Routes — nur die bestehende Route erweitern

**Technische Constraints:**
- Beide neuen Felder MUESSEN `Optional` sein mit Default `None` (Backward-Kompatibilitaet)
- `generation_mode` MUSS als `Literal["txt2img", "img2img"]` validiert werden (nicht als freier String)
- `image_model_id` MUSS `max_length=200` haben (siehe architecture.md Validation Rules)
- Die bestehende `config["configurable"]` Struktur (`thread_id`, `pending_image_urls`, `model`) MUSS erhalten bleiben — neue Keys werden ergaenzt
- `stream_response` Signatur: neue Parameter MUESSEN nach den bestehenden kommen mit Default `None`

**Referenzen:**
- Architecture: `architecture.md` -- Section "Data Transfer Objects (DTOs)" (Zeile 72-76)
- Architecture: `architecture.md` -- Section "Validation Rules" (Zeilen 136-141)
- Architecture: `architecture.md` -- Section "Migration Map" (Zeilen 226-228: dtos.py, messages.py, assistant_service.py)
- Architecture: `architecture.md` -- Section "Business Logic Flow > [Assistant]" (Zeilen 112-121)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `backend/app/models/dtos.py` | MODIFY: `SendMessageRequest` erweitern — bestehende Felder und andere DTOs NICHT aendern |
| `backend/app/routes/messages.py` | MODIFY: Nur den `_service.stream_response()` Aufruf erweitern — Rate-Limiting und Event-Generator bleiben unveraendert |
| `backend/app/services/assistant_service.py` | MODIFY: Nur `stream_response` Signatur + Config-Dict erweitern — Error-Handling, `_convert_event`, `get_session_state` bleiben unveraendert |
