# Slice 08: Assistant Backend -- Python Tools & System-Prompt

> **Slice 8 von 11** fuer `Prompt-Felder Vereinfachung`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-08-assistant-backend-tools` |
| **Test** | `cd backend && python -m pytest tests/unit/test_prompt_tools.py tests/integration/test_prompt_tools_integration.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-db-queries-prompt-history"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi` |
| **Test Command** | `cd backend && python -m pytest tests/unit/test_prompt_tools.py -v` |
| **Integration Command** | `cd backend && python -m pytest tests/integration/test_prompt_tools_integration.py -v` |
| **Acceptance Command** | `cd backend && python -m pytest tests/ -k "prompt_tools" -v` |
| **Start Command** | `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | `http://localhost:8000/health` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Die beiden LangGraph-Tools `draft_prompt` und `refine_prompt` von 3-Felder-Output (`motiv`, `style`, `negative_prompt`) auf 1-Feld-Output (`prompt`) umbauen. Den System-Prompt in `prompts.py` entsprechend anpassen, damit das LLM nur noch ein einzelnes Prompt-Feld generiert. Den State-Docstring in `state.py` aktualisieren.

---

## Acceptance Criteria

1) GIVEN ein `collected_info`-Dict mit `subject: "a golden retriever in a sunflower field"`
   WHEN `draft_prompt.invoke({"collected_info": collected_info})` aufgerufen wird
   THEN ist das Ergebnis ein Dict mit GENAU einem Key `prompt` (kein `motiv`, kein `style`, kein `negative_prompt`)
   AND der Wert von `prompt` ist ein nicht-leerer String

2) GIVEN ein `collected_info`-Dict mit komplettem `prompt`-Key (Agent liefert fertigen Prompt)
   WHEN `draft_prompt.invoke({"collected_info": {"subject": "cat", "prompt": "A majestic cat ..."}})` aufgerufen wird
   THEN ist das Ergebnis `{"prompt": "A majestic cat ..."}`
   AND die Keys `motiv`, `style`, `negative_prompt` existieren NICHT im Ergebnis

3) GIVEN ein `collected_info`-Dict OHNE `subject`-Key
   WHEN `draft_prompt.invoke({"collected_info": {}})` aufgerufen wird
   THEN wird ein `ValueError` (oder `ToolException`) geworfen
   AND die Fehlermeldung enthaelt "subject"

4) GIVEN ein `current_draft`-Dict `{"prompt": "A serene lake at sunset"}` und `feedback: "add dramatic storm clouds"`
   WHEN `refine_prompt.invoke({"current_draft": current_draft, "feedback": feedback})` aufgerufen wird
   THEN ist das Ergebnis ein Dict mit GENAU einem Key `prompt`
   AND der Wert von `prompt` ist ein nicht-leerer String
   AND die Keys `motiv`, `style`, `negative_prompt` existieren NICHT im Ergebnis

5) GIVEN die Datei `backend/app/agent/prompts.py`
   WHEN der `_BASE_PROMPT`-String geprueft wird
   THEN enthaelt er KEINE Referenz auf "drei Felder", "three fields", "motiv, style, negative_prompt" oder "negative_prompt"
   AND enthaelt eine Anweisung, dass der Output ein einzelnes `prompt`-Feld sein soll

6) GIVEN die Datei `backend/app/agent/state.py`
   WHEN der Docstring von `PromptAssistantState` geprueft wird
   THEN referenziert `draft_prompt` nur noch `prompt` (nicht mehr `motiv, style, negative_prompt`)

7) GIVEN die geaenderten Tools aus AC-1 bis AC-4
   WHEN `python -m pytest tests/unit/test_prompt_tools.py tests/integration/test_prompt_tools_integration.py -v` ausgefuehrt wird
   THEN laufen alle Tests gruen (0 failures, 0 errors)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.

### Test-Datei: `backend/tests/unit/test_prompt_tools_simplified.py`

<test_spec>
```python
import pytest

# AC-1: draft_prompt gibt nur {prompt} zurueck
@pytest.mark.skip(reason="AC-1")
def test_draft_prompt_returns_single_prompt_field():
    ...

# AC-2: draft_prompt mit komplettem prompt-Key nutzt diesen direkt
@pytest.mark.skip(reason="AC-2")
def test_draft_prompt_uses_provided_prompt_key():
    ...

# AC-3: draft_prompt ohne subject wirft ValueError
@pytest.mark.skip(reason="AC-3")
def test_draft_prompt_raises_without_subject():
    ...

# AC-4: refine_prompt gibt nur {prompt} zurueck
@pytest.mark.skip(reason="AC-4")
def test_refine_prompt_returns_single_prompt_field():
    ...

# AC-5: System-Prompt enthaelt keine 3-Felder-Referenz
@pytest.mark.skip(reason="AC-5")
def test_system_prompt_has_no_three_field_references():
    ...

# AC-6: State docstring referenziert nur prompt
@pytest.mark.skip(reason="AC-6")
def test_state_docstring_references_single_prompt_field():
    ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-02` | Bereinigte DB-Queries (keine `promptStyle`/`negativePrompt`) | Query Functions | Prompt-History liefert konsistente Daten |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `draft_prompt` Tool | LangGraph `@tool` | slice-09 (Assistant Frontend) | `draft_prompt(collected_info: dict) -> {"prompt": str}` |
| `refine_prompt` Tool | LangGraph `@tool` | slice-09 (Assistant Frontend) | `refine_prompt(current_draft: dict, feedback: str) -> {"prompt": str}` |
| SSE `tool-call-result` Payload | Dict | slice-09 (Assistant Frontend) | `{"prompt": str}` (war: `{motiv, style, negative_prompt}`) |
| `_BASE_PROMPT` | String-Konstante | Intern (graph.py) | 1-Feld-Anweisung statt 3-Felder |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/agent/tools/prompt_tools.py` -- `draft_prompt` und `refine_prompt`: Return-Shape von `{motiv, style, negative_prompt}` auf `{prompt}` umbauen, Aufbau-Logik vereinfachen
- [ ] `backend/app/agent/prompts.py` -- `_BASE_PROMPT` PROMPT-ERSTELLUNG Section: 3-Felder-Anweisung durch 1-Feld-Anweisung ersetzen, negative_prompt-Referenzen entfernen
- [ ] `backend/app/agent/state.py` -- `PromptAssistantState` Docstring: `draft_prompt`-Beschreibung von `(motiv, style, negative_prompt)` auf `(prompt)` aendern
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an `backend/app/models/dtos.py` (DraftPromptDTO -- eigener Slice oder spaeter)
- KEINE Aenderungen an `backend/app/agent/graph.py` (`post_process_node` ist generischer Dict-Handler, braucht keine Aenderung)
- KEINE Aenderungen an `backend/app/agent/prompt_knowledge.py` (eigener Slice)
- KEINE Aenderungen an Frontend-Dateien (Slices 05-07, 09)
- KEINE neuen Dependencies einfuehren

**Technische Constraints:**
- LangGraph `@tool`-Decorator beibehalten (kein Wechsel zu `StructuredTool` o.ae.)
- Tool-Return MUSS ein `dict` sein (kein Pydantic-Model), weil `post_process_node` generisch `dict` erwartet
- `collected_info.get("subject")` Validierung bleibt erhalten (ValueError bei fehlendem Subject)
- System-Prompt bleibt bilingual (Deutsch-Chat, Englisch-Prompts)

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "Server Logic > Python Backend Changes"
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "API Design > SSE Contract Change"

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `backend/app/agent/tools/prompt_tools.py` | MODIFY -- Beide Tool-Funktionen: Return-Shape aendern, Aufbau-Logik vereinfachen |
| `backend/app/agent/prompts.py` | MODIFY -- `_BASE_PROMPT` String: PROMPT-ERSTELLUNG Section umschreiben |
| `backend/app/agent/state.py` | MODIFY -- Docstring von `PromptAssistantState` anpassen (1 Zeile) |
