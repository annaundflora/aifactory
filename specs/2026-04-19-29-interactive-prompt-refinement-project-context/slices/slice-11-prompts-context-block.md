# Slice 11: System-Prompt-Komposition mit Project-Context

> **Slice 11 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-11-prompts-context-block` |
| **Test** | `cd backend && python -m pytest tests/unit/test_prompts_context_block.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["05-project-repository-fastapi"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

> **Quelle:** Auto-detected — Python/FastAPI + LangGraph + pytest. Backend-Test-Konvention liegt in `backend/tests/unit/`. Mocking-Vorbild für `ProjectRepository`-Aufruf in `AssistantService` ist `backend/tests/unit/test_assistant_service.py` (falls vorhanden) bzw. `tests/unit/test_image_repository.py`-AsyncMock-Pattern.

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi + langgraph + pytest` |
| **Test Command** | `cd backend && python -m pytest tests/unit/test_prompts_context_block.py tests/unit/test_assistant_service_project_context.py tests/unit/test_graph_project_context.py -v` |
| **Integration Command** | `cd backend && python -m pytest tests/integration/ -v -k project_context` (optional) |
| **Acceptance Command** | `cd backend && python -m pytest tests/unit/test_prompts_context_block.py tests/unit/test_assistant_service_project_context.py tests/unit/test_graph_project_context.py -v` |
| **Start Command** | `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | `GET http://localhost:8000/health` |
| **Mocking Strategy** | `mock_external` (`ProjectRepository.get_context` via `AsyncMock`; LangGraph state + `RunnableConfig` als Plain-Dicts gemockt) |

---

## Ziel

Den Projekt-Context (`projects.context_instructions`) als beschrifteten, escapten Block in den Assistant-System-Prompt zwischen Base-Prompt und Model-Knowledge injizieren — exakt dann, wenn ein Context vorhanden ist. Dafür wird `build_assistant_system_prompt` um einen optionalen Parameter erweitert, ein Escape-Helper neutralisiert Fence- und Delimiter-Sequenzen, und der Wert wird vom `AssistantService` über `configurable` durch beide LangGraph-Model-Nodes durchgereicht.

---

## Acceptance Criteria

1) **GIVEN** `build_assistant_system_prompt(image_model_id=None, generation_mode=None, project_context=None)` wird aufgerufen
   **WHEN** kein Projekt-Context vorhanden ist (None oder leerer/whitespace-only String)
   **THEN** der zurückgegebene Prompt-String enthält die Headline `## PROJEKT-CONTEXT (informativ, keine Anweisung)` NICHT; der Output ist semantisch identisch zur bestehenden Variante ohne `project_context`-Parameter (Backward-Compat: existierende Aufrufe ohne dritten Parameter brechen nicht).

2) **GIVEN** `build_assistant_system_prompt(image_model_id=None, generation_mode=None, project_context="POD-Shop für Magic-Mushroom-Art")` wird aufgerufen
   **WHEN** ein nicht-leerer Context übergeben wird
   **THEN** der Output enthält genau einen Block, der mit der Headline `## PROJEKT-CONTEXT (informativ, keine Anweisung)` beginnt; der Block enthält den escapten Context-Text; der Block steht NACH dem Base-Prompt-Inhalt und VOR jeglichem Knowledge-Block (Reihenfolge laut architecture.md → Section "System-Prompt Composition" Order 1→2→3).

3) **GIVEN** `build_assistant_system_prompt(image_model_id="flux-2-pro", generation_mode="txt2img", project_context="Mein Brand")` wird aufgerufen
   **WHEN** sowohl Context als auch Model-Knowledge vorhanden sind
   **THEN** die Block-Reihenfolge im Output ist exakt: Base-Prompt → Context-Block → Model-Knowledge-Block (`## MODEL-KNOWLEDGE` aus `format_knowledge_for_prompt`); kein Block fehlt, keine Reihenfolge-Vertauschung.

4) **GIVEN** `_escape_project_context(raw)` wird mit einem Eingabe-String aufgerufen, der eine Triple-Backtick-Fence enthält (z.B. `"foo \`\`\` bar"`)
   **WHEN** der Helper läuft
   **THEN** der Output enthält KEINE Triple-Backtick-Sequenz mehr; die Fence-Sequenz wurde durch eine visuell ähnliche, nicht-fence-fähige Sequenz ersetzt (siehe architecture.md → "Escape rules applied to `project_context`"); der restliche Text-Inhalt bleibt erhalten.

5) **GIVEN** `_escape_project_context(raw)` wird mit einem String aufgerufen, der `<|` und/oder `|>`-Delimiter enthält
   **WHEN** der Helper läuft
   **THEN** alle `<|`-Vorkommen sind durch `< |` ersetzt und alle `|>`-Vorkommen durch `| >`; keine ursprünglichen Delimiter-Tokens überleben in der Ausgabe.

6) **GIVEN** `_escape_project_context(raw)` wird mit einem String aufgerufen, der Null-Bytes (`\x00`) und/oder Newline-Runs > 5 enthält
   **WHEN** der Helper läuft
   **THEN** alle Null-Bytes sind aus der Ausgabe entfernt; jede Sequenz von mehr als 5 aufeinanderfolgenden `\n`-Zeichen ist auf genau 5 `\n` reduziert.

7) **GIVEN** `_escape_project_context(raw)` wird mit einem String > 8000 Zeichen aufgerufen
   **WHEN** der Helper läuft
   **THEN** die Ausgabe ist auf ≤ 8000 Zeichen gekürzt (Defence-in-Depth, auch wenn DTO bereits cappt — siehe architecture.md → "Truncate to 8000 chars").

8) **GIVEN** `AssistantService.stream_response(...)` wird mit einer Session aufgerufen, deren `project_id` zu einem Projekt mit `context_instructions = "X"` für den authentifizierten User gehört
   **WHEN** die LangGraph-Invocation gestartet wird
   **THEN** das `configurable`-Dict, das an `astream_events` übergeben wird, enthält den Key `project_context` mit dem Wert "X" (Roh-Wert, NICHT escaped — Escape passiert erst in `prompts.py`); `ProjectRepository.get_context(project_id, user_id)` wurde genau 1× pro `stream_response`-Aufruf aufgerufen.

9) **GIVEN** `AssistantService.stream_response(...)` läuft, aber `ProjectRepository.get_context` liefert `(None, owner_id)` zurück (Projekt existiert, aber `context_instructions IS NULL`)
   **WHEN** die LangGraph-Invocation gestartet wird
   **THEN** `configurable["project_context"]` ist `None`; KEIN Crash, KEIN leerer-String-Fallback (Slice 5 AC-4-Kontrakt: None signalisiert "kein Context gesetzt" und wird durch AC-1 dieses Slices als "kein Block" interpretiert).

10) **GIVEN** `_call_model_sync` und `_call_model_async` in `graph.py` werden mit einem `RunnableConfig` aufgerufen, dessen `configurable["project_context"] = "Mein Brand"` ist
    **WHEN** die Node das System-Prompt baut
    **THEN** `build_assistant_system_prompt` wird mit `project_context="Mein Brand"` als drittem Argument aufgerufen; das gilt für sync UND async Node identisch (kein Drift zwischen den beiden Pfaden).

11) **GIVEN** `_call_model_sync`/`_call_model_async` werden mit einem `RunnableConfig` aufgerufen, in dem `project_context` im `configurable` FEHLT (Backward-Compat-Pfad bei alten Sessions oder Tests)
    **WHEN** die Node läuft
    **THEN** `configurable.get("project_context")` liefert `None`; `build_assistant_system_prompt` wird mit `project_context=None` aufgerufen; KEIN KeyError, KEIN Crash.

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Mocking-Vorbild ist `backend/tests/unit/test_assistant_service.py` (falls vorhanden) bzw. das AsyncMock-Pattern aus `backend/tests/unit/test_image_repository.py` für `ProjectRepository`. LangGraph-Nodes lassen sich isoliert testen, indem `RunnableConfig` als Plain-Dict übergeben und der `ChatOpenRouter`-Aufruf gemockt wird.

### Test-Datei: `backend/tests/unit/test_prompts_context_block.py`

<test_spec>
```python
# AC-1: Kein Block bei leerem/None-Context
@pytest.mark.skip(reason='AC-1: build_assistant_system_prompt omits PROJEKT-CONTEXT block when project_context is None')
def test_no_block_when_context_is_none():
    ...

@pytest.mark.skip(reason='AC-1: build_assistant_system_prompt omits PROJEKT-CONTEXT block when project_context is whitespace-only')
def test_no_block_when_context_is_whitespace():
    ...

@pytest.mark.skip(reason='AC-1: build_assistant_system_prompt without project_context arg is backward-compatible')
def test_backward_compat_two_arg_call():
    ...

# AC-2: Block mit Headline + escaptem Inhalt bei vorhandenem Context
@pytest.mark.skip(reason='AC-2: build_assistant_system_prompt inserts PROJEKT-CONTEXT block with escaped content when context provided')
def test_block_inserted_with_headline_and_content():
    ...

# AC-3: Reihenfolge Base → Context → Knowledge bei vollem Aufruf
@pytest.mark.skip(reason='AC-3: block order is Base -> Context -> Model-Knowledge when all three present')
def test_block_order_base_context_knowledge():
    ...

# AC-4: Escape neutralisiert Triple-Backtick-Fences
@pytest.mark.skip(reason='AC-4: _escape_project_context removes triple-backtick fence sequences')
def test_escape_neutralizes_fence_sequences():
    ...

# AC-5: Escape ersetzt <| und |>
@pytest.mark.skip(reason='AC-5: _escape_project_context replaces <| with < | and |> with | >')
def test_escape_replaces_role_delimiters():
    ...

# AC-6: Escape entfernt Null-Bytes und collapsed Newline-Runs >5
@pytest.mark.skip(reason='AC-6: _escape_project_context strips null bytes and collapses newline runs over 5')
def test_escape_strips_null_bytes_and_collapses_newlines():
    ...

# AC-7: Escape kappt auf 8000 Zeichen
@pytest.mark.skip(reason='AC-7: _escape_project_context truncates output to 8000 chars max')
def test_escape_truncates_to_8000_chars():
    ...
```
</test_spec>

### Test-Datei: `backend/tests/unit/test_assistant_service_project_context.py`

<test_spec>
```python
# AC-8: Service ruft ProjectRepository.get_context und packt Wert in configurable
@pytest.mark.skip(reason='AC-8: stream_response calls ProjectRepository.get_context and stamps result into configurable[project_context]')
@pytest.mark.asyncio
async def test_stream_response_loads_context_and_passes_to_configurable():
    ...

@pytest.mark.skip(reason='AC-8: ProjectRepository.get_context is called exactly once per stream_response invocation')
@pytest.mark.asyncio
async def test_get_context_called_exactly_once_per_turn():
    ...

# AC-9: None-Context fließt unverändert ins configurable
@pytest.mark.skip(reason='AC-9: stream_response sets configurable[project_context] to None when get_context returns (None, owner_id)')
@pytest.mark.asyncio
async def test_stream_response_passes_none_when_no_context_set():
    ...
```
</test_spec>

### Test-Datei: `backend/tests/unit/test_graph_project_context.py`

<test_spec>
```python
# AC-10: _call_model_sync liest project_context aus configurable
@pytest.mark.skip(reason='AC-10: _call_model_sync forwards configurable[project_context] to build_assistant_system_prompt')
def test_call_model_sync_forwards_project_context():
    ...

# AC-10: _call_model_async liest project_context aus configurable
@pytest.mark.skip(reason='AC-10: _call_model_async forwards configurable[project_context] to build_assistant_system_prompt')
@pytest.mark.asyncio
async def test_call_model_async_forwards_project_context():
    ...

# AC-11: Fehlender Key in configurable -> None, kein Crash
@pytest.mark.skip(reason='AC-11: _call_model_* defaults to None when project_context key is missing in configurable')
def test_call_model_defaults_to_none_when_key_missing():
    ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-05-project-repository-fastapi` | `ProjectRepository` Klasse + `get_context(project_id, user_id) -> tuple[str \| None, UUID]` | Python class + async method | Import in `assistant_service.py` möglich; Mock liefert Tuple wie in Slice-05-Contract spezifiziert |
| Bestehender Code | `build_assistant_system_prompt(image_model_id, generation_mode)` | Python function (zu erweitern) | Existierende Signatur in `backend/app/agent/prompts.py:85-123` |
| Bestehender Code | `format_knowledge_for_prompt`, `_BASE_PROMPT` | Python helper / module-level string | Bleiben unverändert (nur Komposition wird angepasst) |
| Bestehender Code | `AssistantService.stream_response`-Signatur mit `image_model_id`, `generation_mode` | Python method | Wird um Context-Lookup erweitert; bestehende Call-Sites des Service via Routes/DTO bleiben kompatibel |
| Bestehender Code | `_call_model_sync`/`_call_model_async` in `graph.py:235-257` | LangGraph node functions | Nutzen schon `configurable.get(...)`-Pattern für `image_model_id`/`generation_mode` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `build_assistant_system_prompt` (erweiterte Signatur) | Python function | `slice-12-base-prompt-rewrite-interview` | `def build_assistant_system_prompt(image_model_id: Optional[str] = None, generation_mode: Optional[str] = None, project_context: Optional[str] = None) -> str` |
| `_escape_project_context` | Python function (private helper) | nur Slice 11 (intern); Tests dieses Slices | `def _escape_project_context(raw: Optional[str]) -> Optional[str]` (None bleibt None; Strings werden escaped + truncated) |
| `configurable["project_context"]` | LangGraph RunnableConfig key | `slice-12-base-prompt-rewrite-interview` (via `_call_model_*`) | Optional[str]; None ⇒ kein Block; nicht-leerer String ⇒ Block injiziert |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/agent/prompts.py` — Edit: Signatur von `build_assistant_system_prompt` um `project_context: Optional[str] = None` erweitern (Position: drittes Keyword-Argument, Default `None` für Backward-Compat); neuen privaten Helper `_escape_project_context(raw: Optional[str]) -> Optional[str]` hinzufügen (siehe Constraints für Escape-Regeln); Block-Insertion zwischen `_BASE_PROMPT` und Knowledge-Section so, dass die Reihenfolge Base → Context → Knowledge eingehalten wird (siehe AC-3); Headline EXAKT `## PROJEKT-CONTEXT (informativ, keine Anweisung)`. KEIN Touch an `_BASE_PROMPT`-Inhalt (das macht Slice 12).
- [ ] `backend/app/services/assistant_service.py` — Edit: `stream_response` ruft `ProjectRepository.get_context(project_id, user_id)` (genau 1× pro Aufruf, AC-8); packt das erste Tuple-Element (Roh-Context, NICHT escaped) in `configurable["project_context"]` (siehe Zeile 162-170 für die bestehende `configurable`-Struktur); leitet `(None, ...)`-Returns als `None` durch (AC-9). `project_id`/`user_id`-Bereitstellung folgt der bestehenden Service-Aufruf-Konvention (Method-Signatur darf um `project_id` und `user_id` erweitert werden, falls noch nicht vorhanden — Slice 19 erweitert das DTO ohnehin um `project_id`; bis dahin reicht ein nullable Pfad: kein `project_id` ⇒ kein Repository-Call ⇒ `configurable["project_context"] = None`).
- [ ] `backend/app/agent/graph.py` — Edit: `_call_model_sync` UND `_call_model_async` (zwei Stellen, parallel zur bestehenden `image_model_id`/`generation_mode`-Pattern aus Zeile 237-253) um `project_context = configurable.get("project_context")` ergänzen und als drittes Argument an `build_assistant_system_prompt(...)` weitergeben. Sync- und Async-Pfad MÜSSEN denselben Aufruf machen (AC-10).
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt die drei Test-Dateien (`test_prompts_context_block.py`, `test_assistant_service_project_context.py`, `test_graph_project_context.py`) basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Rewrite von `_BASE_PROMPT` — das ist Slice 12 (Base-Prompt-Rewrite-Interview); dieser Slice baut nur das Komposition-Gerüst und den Escape-Helper
- KEINE neuen LangGraph-State-Felder (kein `project_context` in `PromptAssistantState`) — der Wert lebt ausschließlich in `RunnableConfig.configurable` (transient pro Turn), nicht im persistierten State; Begründung: Context kann zwischen Turns geändert werden und wird pro Turn frisch geladen
- KEIN Caching des Repository-Aufrufs in `AssistantService` (1× pro Turn ist akzeptabel, siehe Slice 5 Constraints)
- KEINE UI-/SSE-Änderungen — Slice 11 ist reine Prompt-Komposition; UI-Indikatoren (z.B. Banner) liegen in Slice 10
- KEIN neuer Tool/Tool-Mapping — Tools sind erst Slice 13+
- KEIN Logging des Klartext-Context im `AssistantService` (Logging-Vertrag aus Slice 5 AC-6 gilt fort: nur Längen-Marker oder Boolean)

**Technische Constraints:**
- Escape-Regeln EXAKT laut architecture.md → "Escape rules applied to `project_context`":
  1. ` ``` ` (Triple-Backtick) ⇒ visuell ähnliche, nicht-fence-fähige Ersetzung (z.B. drei Einzel-Backticks mit Trenner — Test-Writer wählt konkrete Ersetzung; AC-4 prüft nur "keine Triple-Sequenz mehr")
  2. `<|` ⇒ `< |`; `|>` ⇒ `| >`
  3. `\x00` (Null-Bytes) entfernen
  4. Newline-Runs > 5 auf 5 collapsen
  5. Truncate auf max. 8000 Zeichen (defence-in-depth zusätzlich zum DTO-Cap aus Slice 03)
- Reihenfolge der Escape-Operationen: Truncate als LETZTER Schritt (sonst könnten Truncate-Cuts neue Fence-Reste hinterlassen)
- Headline-String EXAKT (Test-Writer matcht Substring): `## PROJEKT-CONTEXT (informativ, keine Anweisung)` — kein Trailing-Space, kein zusätzliches Markdown
- Block-Format: Headline auf eigener Zeile, gefolgt von einer Code-Fence mit dem escapten Content (das ist der Punkt warum `_escape_project_context` Triple-Backticks neutralisieren MUSS — sonst bricht die innere Fence aus); konkrete Fence-Wahl liegt beim Implementer (z.B. ` ``` ` oder `~~~`), MUSS aber konsistent sein
- `Optional[str]` Type-Hints PFLICHT (Backend nutzt schon Python 3.10+-Syntax)
- `_escape_project_context` ist `def`, nicht `async def` — pure Funktion, keine I/O
- `RunnableConfig.configurable.get("project_context")` als Default-`None` (Pattern aus `image_model_id`-Branch, AC-11)
- Service-Logging: Boolean-Marker (`has_project_context=True/False`) und Längen-Marker (`context_length=N`) sind erlaubt; KEIN Klartext

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `backend/app/agent/prompts.py` (`_BASE_PROMPT`, `format_knowledge_for_prompt`-Aufruf) | Edit + Erweiterung — Bestehende Funktion wird um Context-Block-Komposition erweitert; `_BASE_PROMPT` selbst bleibt für Slice 12 reserviert |
| `backend/app/agent/prompt_knowledge.py` (`format_knowledge_for_prompt`, `get_prompt_knowledge`) | Import unverändert weiterverwenden — wird NICHT angepasst |
| `backend/app/services/project_repository.py` (Slice 05 Output) | Import + Instanzieren analog `SessionRepository` in `AssistantService.__init__`; `await self._project_repo.get_context(...)` |
| `backend/app/services/assistant_service.py` (`stream_response`, `configurable`-Block, `astream_events`-Aufruf) | Edit — bestehende `configurable`-Struktur (Zeile 162-170) um einen Key erweitern, ansonsten unverändert |
| `backend/app/agent/graph.py` (`_call_model_sync`, `_call_model_async`, `build_assistant_system_prompt`-Import) | Edit — beide Nodes parallel erweitern (Zeile 235-257); existierender Import von `build_assistant_system_prompt` bleibt |

**Referenzen:**
- Architecture: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/architecture.md` → Section "System-Prompt Composition" (Block-Reihenfolge, Escape-Rules)
- Architecture: gleiche Datei → Section "Migration Map" → Zeilen für `prompts.py:85-123`, `assistant_service.py:117-185`, `graph.py:235-257`
- Architecture: gleiche Datei → Section "Security & Privacy" → "Newline / fence escape inside `context_instructions`" und "Input Validation & Sanitization"
- Architecture: gleiche Datei → Section "Risks & Mitigations" → "Prompt injection via `context_instructions` jailbreaks the LLM" (Mitigation-Vertrag, den dieser Slice technisch umsetzt)
- Slice 05: `slice-05-project-repository-fastapi.md` → Integration-Contract → `ProjectRepository.get_context`-Signatur und Tuple-Return-Vertrag (None für unset)
- Discovery: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/discovery.md` → Slice D "System-Prompt-Komposition" + Open Question #11 (Prompt-Injection-Mitigations)
- Wireframes: nicht relevant (Backend-only, kein UI-Mount)
