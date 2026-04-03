# Slice 09: Assistant Backend -- Knowledge & DTO

> **Slice 9 von 11** fuer `Prompt-Felder Vereinfachung`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-09-assistant-knowledge-dto` |
| **Test** | `cd backend && python -m pytest tests/acceptance/test_slice_12_prompt_tools_backend.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["slice-08-assistant-backend-tools"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi` |
| **Test Command** | `cd backend && python -m pytest tests/ -k "prompt_knowledge or dtos" -v` |
| **Integration Command** | `cd backend && python -m pytest tests/integration/ -k "prompt" -v` |
| **Acceptance Command** | `cd backend && python -m pytest tests/acceptance/test_slice_12_prompt_tools_backend.py -v` |
| **Start Command** | `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | `http://localhost:8000/health` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Die `negativePrompts`-Eintraege aus dem Prompt-Knowledge-System komplett entfernen (JSON-Daten + Python-Formatter). Gleichzeitig das `DraftPromptDTO` von 3 Feldern (`motiv`, `style`, `negative_prompt`) auf ein einziges Feld (`prompt`) vereinfachen, damit die Session-Detail-API den neuen Contract bedient.

---

## Acceptance Criteria

1) GIVEN die Datei `data/prompt-knowledge.json` mit 13 Model-Eintraegen
   WHEN die Datei mit `json.load()` geparst wird
   THEN enthaelt KEIN Model-Eintrag einen Key `negativePrompts`
   AND die JSON-Datei ist valides JSON (kein Parse-Error)
   AND jeder Model-Eintrag hat weiterhin `displayName`, `promptStyle`, `strengths`, `tips`, `avoid`

2) GIVEN ein Knowledge-Lookup-Ergebnis fuer ein Model (z.B. `flux-2-pro`, `kind == "model"`)
   WHEN `format_knowledge_for_prompt(result)` aufgerufen wird
   THEN enthaelt der zurueckgegebene String NICHT die Woerter "Negative prompts" oder "negativePrompts"
   AND der String enthaelt weiterhin "Prompt style:", "Strengths:", "Tips:", "Avoid:"

3) GIVEN ein Knowledge-Lookup-Ergebnis fuer den Fallback (`kind == "fallback"`)
   WHEN `format_knowledge_for_prompt(result)` aufgerufen wird
   THEN enthaelt der Output weiterhin "General Prompting Tips", "Tips:" und "Avoid:" (unveraendert)

4) GIVEN die Klasse `DraftPromptDTO` in `backend/app/models/dtos.py`
   WHEN die Felder per `DraftPromptDTO.model_fields` inspiziert werden
   THEN hat die Klasse GENAU einen Key: `prompt` (Typ `str`)
   AND die Keys `motiv`, `style`, `negative_prompt` existieren NICHT

5) GIVEN ein Dict `{"prompt": "A golden retriever in a sunflower field"}`
   WHEN `DraftPromptDTO(**data)` instanziiert wird
   THEN ist `dto.prompt == "A golden retriever in a sunflower field"`

6) GIVEN ein Dict mit altem Format `{"motiv": "...", "style": "...", "negative_prompt": "..."}`
   WHEN `DraftPromptDTO(**data)` instanziiert wird
   THEN wird ein `ValidationError` geworfen (alte Felder werden nicht akzeptiert)

7) GIVEN die geaenderten Dateien aus AC-1 bis AC-6
   WHEN `python -m pytest tests/acceptance/test_slice_12_prompt_tools_backend.py -v` ausgefuehrt wird
   THEN laufen alle Tests gruen NACH Anpassung der Assertions von 3-Felder auf 1-Feld-Shape

8) GIVEN ein LangGraph-Checkpoint mit `state_values["draft_prompt"] == {"prompt": "A cat on a rooftop"}`
   WHEN `AssistantService.get_session_state()` diesen Checkpoint liest
   THEN wird `DraftPromptDTO(prompt="A cat on a rooftop")` konstruiert (NICHT mehr mit `motiv`/`style`/`negative_prompt`)
   AND die `SessionDetailDTO.draft_prompt` enthaelt `{"prompt": "A cat on a rooftop"}`

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.

### Test-Datei: `backend/tests/unit/test_slice_09_knowledge_dto.py`

<test_spec>
```python
import pytest

# AC-1: prompt-knowledge.json hat keine negativePrompts-Eintraege
@pytest.mark.skip(reason="AC-1")
def test_knowledge_json_has_no_negative_prompts_entries():
    ...

# AC-1 (cont.): JSON ist valide und Models haben Pflichtfelder
@pytest.mark.skip(reason="AC-1")
def test_knowledge_json_models_retain_required_fields():
    ...

# AC-2: Formatter gibt keine negativePrompts-Section aus (Model)
@pytest.mark.skip(reason="AC-2")
def test_formatter_model_output_has_no_negative_prompts():
    ...

# AC-2 (cont.): Formatter gibt weiterhin andere Sections aus
@pytest.mark.skip(reason="AC-2")
def test_formatter_model_output_retains_standard_sections():
    ...

# AC-3: Formatter Fallback-Output unveraendert
@pytest.mark.skip(reason="AC-3")
def test_formatter_fallback_output_unchanged():
    ...

# AC-4: DraftPromptDTO hat nur prompt-Feld
@pytest.mark.skip(reason="AC-4")
def test_draft_prompt_dto_has_only_prompt_field():
    ...

# AC-5: DraftPromptDTO akzeptiert neues Format
@pytest.mark.skip(reason="AC-5")
def test_draft_prompt_dto_accepts_new_format():
    ...

# AC-6: DraftPromptDTO lehnt altes Format ab
@pytest.mark.skip(reason="AC-6")
def test_draft_prompt_dto_rejects_old_format():
    ...

# AC-8: assistant_service konstruiert DraftPromptDTO mit neuem Single-Field-Format
@pytest.mark.skip(reason="AC-8")
def test_get_session_state_constructs_dto_with_prompt_field():
    ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-08` | `draft_prompt` / `refine_prompt` Tools mit `{prompt}` Return-Shape | LangGraph `@tool` | Tools geben `{"prompt": str}` zurueck |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `DraftPromptDTO` | Pydantic BaseModel | slice-10 (Assistant Frontend) | `DraftPromptDTO(prompt: str)` |
| `get_session_state()` mit neuem DTO-Mapping | Method | slice-10 (Session-Restore Response) | `SessionDetailDTO.draft_prompt` enthaelt `{prompt: str}` |
| Bereinigte `format_knowledge_for_prompt()` | Function | Intern (prompts.py) | `format_knowledge_for_prompt(result: dict) -> str` (ohne negativePrompts-Output) |
| Bereinigte `data/prompt-knowledge.json` | JSON Data | `prompt_knowledge.py` | 13 Model-Eintraege ohne `negativePrompts`-Key |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `data/prompt-knowledge.json` -- `negativePrompts`-Objekt aus allen 13 Model-Eintraegen entfernen
- [ ] `backend/app/agent/prompt_knowledge.py` -- negativePrompts-Rendering aus `format_knowledge_for_prompt()` entfernen (Lines 208-215)
- [ ] `backend/app/models/dtos.py` -- `DraftPromptDTO`: Felder `motiv`, `style`, `negative_prompt` durch einzelnes `prompt: str` Feld ersetzen
- [ ] `backend/app/services/assistant_service.py` -- MODIFY: `get_session_state()` DTO-Konstruktion von `DraftPromptDTO(motiv=..., style=..., negative_prompt=...)` auf `DraftPromptDTO(prompt=...)` umstellen (Lines 381-385)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an `backend/app/agent/tools/prompt_tools.py` (bereits in Slice 08 erledigt)
- KEINE Aenderungen an `backend/app/agent/prompts.py` (bereits in Slice 08 erledigt)
- KEINE Aenderungen an `backend/app/agent/state.py` (bereits in Slice 08 erledigt)
- KEINE Aenderungen an `backend/app/agent/graph.py` (generischer Dict-Handler, braucht keine Aenderung)
- KEINE Aenderungen an Frontend-Dateien
- KEINE neuen Dependencies einfuehren

**Technische Constraints:**
- `DraftPromptDTO` MUSS weiterhin von `pydantic.BaseModel` erben
- `format_knowledge_for_prompt()` Signatur bleibt `(result: dict) -> str` -- nur interner Output aendert sich
- JSON-Datei MUSS nach Bearbeitung valides JSON bleiben (mit `json.load()` testbar)
- `prompt_knowledge.py` Module-Level-Cache (`_cached_data`) muss in Tests zurueckgesetzt werden

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "Server Logic > Prompt Knowledge Data Changes"
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "Server Logic > Python Backend Changes" (DraftPromptDTO Zeile)
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "API Design > Session Restore Response Change"
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "Server Logic > Services & Processing" (Zeile 150: `AssistantService.get_session_state()` Simplify draft_prompt shape)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `data/prompt-knowledge.json` | MODIFY -- `negativePrompts`-Key aus allen 13 Model-Eintraegen entfernen, Rest bleibt |
| `backend/app/agent/prompt_knowledge.py` | MODIFY -- negativePrompts-Rendering-Block entfernen (6 Zeilen), Rest der Funktion bleibt |
| `backend/app/models/dtos.py` | MODIFY -- Nur `DraftPromptDTO`-Klasse aendern, alle anderen DTOs bleiben unberuehrt |
| `backend/app/services/assistant_service.py` | MODIFY -- Nur `get_session_state()` DTO-Konstruktion aendern (Lines 381-385), Rest des Service bleibt unberuehrt |
