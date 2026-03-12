# Slice 18: Bildanalyse DB-Caching

> **Slice 18 von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-18-bildanalyse-db-caching` |
| **Test** | `cd backend && python -m pytest tests/test_image_repository.py tests/test_image_tools_caching.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["slice-17-image-upload-chat-ui"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi` (`backend/` Subfolder, psycopg3, pytest) |
| **Test Command** | `cd backend && python -m pytest tests/test_image_repository.py tests/test_image_tools_caching.py -v` |
| **Integration Command** | `cd backend && python -c "from app.services.image_repository import ImageRepository; print('OK')"` |
| **Acceptance Command** | `cd backend && python -m pytest tests/test_image_repository.py tests/test_image_tools_caching.py -v -k acceptance` |
| **Start Command** | `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | `http://localhost:8000/api/assistant/health` |
| **Mocking Strategy** | `mock_external` (DB-Calls via psycopg3 werden gemockt, Vision-LLM-Call wird gemockt) |

---

## Ziel

Analyse-Ergebnisse von `analyze_image` in der `assistant_images` Tabelle cachen, sodass ein erneuter Vision-API-Call fuer dieselbe `image_url` vermieden wird. Dazu ein Python-seitiges `ImageRepository` (CRUD fuer `assistant_images`) und Cache-Lookup-Logik im `analyze_image` Tool.

---

## Acceptance Criteria

1) GIVEN die `assistant_images` Tabelle existiert in PostgreSQL (via Slice 05)
   WHEN `ImageRepository.save_analysis(session_id, image_url, analysis_result)` aufgerufen wird
   THEN wird ein neuer Eintrag in `assistant_images` gespeichert mit den uebergebenen Werten und einer auto-generierten UUID als `id`

2) GIVEN ein Eintrag in `assistant_images` mit `image_url = "https://r2.example.com/images/photo.jpg"` und `analysis_result = {"subject": "cat", "style": "photo", "mood": "calm", "lighting": "natural", "composition": "centered", "palette": "warm"}`
   WHEN `ImageRepository.get_analysis_by_url(image_url)` aufgerufen wird mit genau dieser URL
   THEN gibt die Methode das gespeicherte `analysis_result` Dict zurueck (nicht None)

3) GIVEN kein Eintrag in `assistant_images` fuer `image_url = "https://r2.example.com/images/new.jpg"`
   WHEN `ImageRepository.get_analysis_by_url(image_url)` aufgerufen wird
   THEN gibt die Methode `None` zurueck

4) GIVEN ein Bild mit URL `"https://r2.example.com/images/photo.jpg"` wird zum ersten Mal analysiert
   WHEN `analyze_image` mit dieser URL aufgerufen wird
   THEN wird der Vision-API-Call ausgefuehrt UND das Ergebnis via `ImageRepository.save_analysis()` in der DB gespeichert

5) GIVEN ein Bild mit URL `"https://r2.example.com/images/photo.jpg"` wurde bereits analysiert (Eintrag in `assistant_images` vorhanden)
   WHEN `analyze_image` erneut mit derselben URL aufgerufen wird
   THEN wird KEIN Vision-API-Call gemacht, sondern das gecachte Ergebnis aus der DB zurueckgegeben

6) GIVEN ein Cache-Hit fuer eine image_url
   WHEN das gecachte Ergebnis zurueckgegeben wird
   THEN hat das Ergebnis dasselbe Format wie ein frisches Analyse-Ergebnis (Dict mit 6 Keys: subject, style, mood, lighting, composition, palette)

7) GIVEN ein DB-Fehler beim Cache-Lookup (z.B. Connection-Fehler)
   WHEN `analyze_image` den Cache nicht lesen kann
   THEN faellt das Tool graceful auf den Vision-API-Call zurueck (kein Abbruch, kein Error-Event) und loggt den Fehler

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.
> **Syntax:** Python/pytest

### Test-Datei: `backend/tests/test_image_repository.py`

<test_spec>
```python
import pytest

class TestImageRepository:
    # AC-1: save_analysis speichert Eintrag in DB
    @pytest.mark.skip(reason="AC-1")
    def test_save_analysis_creates_db_entry(self):
        ...

    # AC-2: get_analysis_by_url gibt gecachtes Ergebnis zurueck
    @pytest.mark.skip(reason="AC-2")
    def test_get_analysis_by_url_returns_cached_result(self):
        ...

    # AC-3: get_analysis_by_url gibt None fuer unbekannte URL
    @pytest.mark.skip(reason="AC-3")
    def test_get_analysis_by_url_returns_none_for_unknown(self):
        ...
```
</test_spec>

### Test-Datei: `backend/tests/test_image_tools_caching.py`

<test_spec>
```python
import pytest

class TestAnalyzeImageCaching:
    # AC-4: Erstes Bild -> Vision-Call + DB-Speicherung
    @pytest.mark.skip(reason="AC-4")
    def test_first_analysis_calls_vision_and_saves_to_db(self):
        ...

    # AC-5: Zweites Bild gleiche URL -> Cache-Hit, kein Vision-Call
    @pytest.mark.skip(reason="AC-5")
    def test_cached_analysis_skips_vision_call(self):
        ...

    # AC-6: Cache-Ergebnis hat korrektes Format (6 Keys)
    @pytest.mark.skip(reason="AC-6")
    def test_cached_result_has_same_format_as_fresh(self):
        ...

    # AC-7: DB-Fehler -> Fallback auf Vision-Call
    @pytest.mark.skip(reason="AC-7")
    def test_db_error_falls_back_to_vision_call(self):
        ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-05-db-schema-drizzle` | `assistant_images` Tabelle in PostgreSQL | DB Table | Tabelle existiert mit Spalten: id, session_id, image_url, analysis_result, created_at |
| `slice-16-analyze-image-tool` | `app.agent.tools.image_tools.analyze_image` | LangGraph Tool | Tool existiert, fuehrt Vision-Call aus, gibt 6-Key Dict zurueck |
| `slice-03-langgraph-agent` | `app.agent.state.PromptAssistantState` | TypedDict | State mit `reference_images: list[dict]` Feld |
| `slice-04-sse-streaming-endpoint` | DB Connection Pool | psycopg3 Pool | Verfuegbar via `app.main` Lifespan / Config |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ImageRepository` | Service-Klasse | Intern (image_tools) | `save_analysis(session_id: str, image_url: str, analysis_result: dict) -> None` |
| `ImageRepository` | Service-Klasse | Intern (image_tools) | `get_analysis_by_url(image_url: str) -> dict \| None` |
| `analyze_image` (erweitert) | LangGraph Tool | slice-17 Consumer bleibt kompatibel | Selbes Interface wie Slice 16, intern Cache-Layer |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/services/image_repository.py` -- ImageRepository mit save_analysis() und get_analysis_by_url() via psycopg3
- [ ] `backend/app/agent/tools/image_tools.py` (erweitert) -- Cache-Lookup vor Vision-Call, Save nach erfolgreichem Vision-Call
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice erstellt KEINE neuen API-Endpoints (Image-Caching ist intern im Tool)
- Dieser Slice aendert NICHT die `assistant_images` Tabelle (Schema kommt aus Slice 05)
- Dieser Slice implementiert KEIN Cache-Invalidierung / TTL (Analyse-Ergebnisse sind immutable)
- Dieser Slice aendert NICHT das SSE-Event-Format (tool-call-result bleibt identisch ob Cache-Hit oder frische Analyse)
- Kein Index auf `image_url` hinzufuegen -- bei der erwarteten Datenmenge (niedrig) ist ein Seq-Scan akzeptabel

**Technische Constraints:**
- `psycopg3` direkt fuer DB-Zugriff (kein ORM), konsistent mit `session_repository.py` Pattern aus Slice 13a
- `image_url` als Cache-Key (exakter String-Match, keine URL-Normalisierung)
- `analysis_result` wird als JSONB gespeichert und als Python Dict gelesen/geschrieben
- Cache-Lookup ist session-uebergreifend (gleiche URL in verschiedenen Sessions = Cache-Hit)
- Async-Methoden (`async def`) fuer DB-Zugriffe
- Fehler beim Cache-Lookup/Save duerfen den Analyse-Flow nicht blockieren (try/except mit Logging)

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Database Schema > Schema Details > Table: assistant_images"
- Architecture: `specs/phase-3/2026-03-11-prompt-assistant/architecture.md` -> Section "Server Logic" (analyze_image Tool-Beschreibung)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "Business Rules" (Bildanalyse-Caching)
- Slice 16: `slices/slice-16-analyze-image-tool.md` -> analyze_image Tool-Interface und Rueckgabeformat
