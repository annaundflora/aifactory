# Slice 20: chat_llm_limits-Modul

> **Slice 20 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-20-chat-llm-limits-module` |
| **Test** | `cd backend && python -m pytest tests/agent/test_chat_llm_limits.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["19-reference-slots-dto"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi` |
| **Test Command** | `cd backend && python -m pytest tests/agent/test_chat_llm_limits.py -v` |
| **Integration Command** | `cd backend && python -m pytest tests/agent/ -v` |
| **Acceptance Command** | `cd backend && python -m pytest -v` |
| **Start Command** | `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | `http://localhost:8000/health` |
| **Mocking Strategy** | `no_mocks` (pure Konstanten + Lookup-Funktion, kein I/O) |

---

## Ziel

Konstanten-Modul `chat_llm_limits.py` erzeugen, das Multimodal-Caps (max_images, max_total_bytes, vision-flag) pro Allowlist-Chat-LLM zentralisiert und einen fail-safe Lookup-Helper bereitstellt. Wird von Slice 21 als Cap-Quelle für Budget-Enforcement und Vision-Fallback konsumiert.

---

## Acceptance Criteria

1) **CHAT_LLM_LIMITS-Dict enthält alle Allowlist-Modelle**
   GIVEN das neue Modul `backend/app/agent/chat_llm_limits.py`
   WHEN `CHAT_LLM_LIMITS` importiert wird
   THEN enthält das Dict exakt die drei Keys aus der Allowlist (`anthropic/claude-sonnet-4.6`, `openai/gpt-5.4`, `google/gemini-3.1-pro-preview`); jeder Wert hat die Pflicht-Felder `max_images: int`, `max_total_bytes: int`, `vision: bool` mit Werten aus architecture.md → Section "Cap source"

2) **Bekannte Modelle liefern korrekte Werte**
   GIVEN ein Allowlist-Modell-ID
   WHEN `get_chat_llm_limits("anthropic/claude-sonnet-4.6")` aufgerufen wird
   THEN ist das Ergebnis `{"max_images": 5, "max_total_bytes": 20_000_000, "vision": True}` (Werte aus architecture.md verifizieren)

3) **Unbekanntes Modell → DEFAULT_LIMITS mit vision=False**
   GIVEN ein nicht-allowlistetes Modell-ID (z.B. `"unknown/model-xyz"`)
   WHEN `get_chat_llm_limits("unknown/model-xyz")` aufgerufen wird
   THEN ist das Ergebnis identisch zu `DEFAULT_LIMITS` und `result["vision"] is False` (fail-safe text-only)

4) **DEFAULT_LIMITS hat vision=False**
   GIVEN das Modul-Konstantenset
   WHEN `DEFAULT_LIMITS` inspiziert wird
   THEN ist `DEFAULT_LIMITS["vision"] is False` und enthält die Felder `max_images`, `max_total_bytes`, `vision` (Werte gemäß architecture.md `{"max_images": 4, "max_total_bytes": 16_000_000, "vision": False}`)

5) **Lookup ist Pure (keine Mutation)**
   GIVEN wiederholte Calls mit gleichem Modell-ID
   WHEN `get_chat_llm_limits(model_id)` zweimal hintereinander aufgerufen wird
   THEN ist das Ergebnis strukturell identisch und Mutation am zurückgegebenen Dict beeinflusst NICHT das Ergebnis eines nachfolgenden Calls (Helper liefert Kopie oder unveränderbare Sicht)

6) **None / Empty-String fällt auf DEFAULT_LIMITS zurück**
   GIVEN `model_id` ist `None` oder `""`
   WHEN `get_chat_llm_limits(model_id)` aufgerufen wird
   THEN ist das Ergebnis identisch zu `DEFAULT_LIMITS` (kein Exception-Throw)

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Test-Writer implementiert die Assertions selbstständig.

### Test-Datei: `backend/tests/agent/test_chat_llm_limits.py`

<test_spec>
```python
import pytest

# AC-1: CHAT_LLM_LIMITS-Dict enthält alle Allowlist-Modelle
@pytest.mark.skip(reason="AC-1")
def test_chat_llm_limits_contains_all_allowlist_models():
    ...

# AC-2: Bekannte Modelle liefern korrekte Werte
@pytest.mark.skip(reason="AC-2")
def test_get_chat_llm_limits_returns_correct_entry_for_claude():
    ...

@pytest.mark.skip(reason="AC-2")
def test_get_chat_llm_limits_returns_correct_entry_for_gpt():
    ...

@pytest.mark.skip(reason="AC-2")
def test_get_chat_llm_limits_returns_correct_entry_for_gemini():
    ...

# AC-3: Unbekanntes Modell → DEFAULT_LIMITS mit vision=False
@pytest.mark.skip(reason="AC-3")
def test_get_chat_llm_limits_unknown_model_returns_defaults_with_vision_false():
    ...

# AC-4: DEFAULT_LIMITS hat vision=False
@pytest.mark.skip(reason="AC-4")
def test_default_limits_has_vision_false_and_required_fields():
    ...

# AC-5: Lookup ist Pure (keine Mutation)
@pytest.mark.skip(reason="AC-5")
def test_get_chat_llm_limits_repeated_call_is_idempotent():
    ...

# AC-6: None / Empty-String fällt auf DEFAULT_LIMITS zurück
@pytest.mark.skip(reason="AC-6")
def test_get_chat_llm_limits_none_or_empty_returns_defaults():
    ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| 19-reference-slots-dto | (logical dependency only — keine Code-Imports) | -- | Slice 19 ist Vorbedingung im DAG (slim-slices.md), aber `chat_llm_limits.py` importiert nichts aus Slice 19. Reihenfolge ist konzeptionell: ohne ReferenceSlotDTO gibt es keinen Multimodal-Pipeline-Use-Case. |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `CHAT_LLM_LIMITS` | `dict[str, dict[str, int \| bool]]` (module-level constant) | 21-multimodal-pipeline-budget | Read-only Dict-Lookup |
| `DEFAULT_LIMITS` | `dict[str, int \| bool]` (module-level constant) | 21-multimodal-pipeline-budget | Read-only Dict |
| `get_chat_llm_limits` | Function | 21-multimodal-pipeline-budget, 22-multimodal-indicator-ui (indirekt via Service) | `get_chat_llm_limits(model_id: str \| None) -> dict` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/agent/chat_llm_limits.py` — NEW: `CHAT_LLM_LIMITS`-Dict (3 Allowlist-Modelle), `DEFAULT_LIMITS`, `get_chat_llm_limits(model_id)` Lookup-Helper.
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Budget-Enforcement-Logik (das ist Slice 21 in `assistant_service.py`).
- KEINE Vision-Fallback-Strip-Logik (das ist Slice 21).
- KEINE Anbindung an `prompt_knowledge.json` — bewusste Trennung (architecture.md Q9: Image-Model-Knowledge bleibt separat).
- KEINE Modell-Allowlist-Validierung (existiert bereits in `backend/app/config.py`).
- KEINE Persistenz, KEIN I/O — reines Konstanten-Modul.

**Technische Constraints:**
- Plain Python `dict` (keine Pydantic-Models, keine Frozen-Dataclasses) — Werte sind Konstanten, nicht user-input.
- Allowlist-Modell-IDs MÜSSEN exakt mit `backend/app/config.py` Allowlist übereinstimmen (architecture.md Section "Cap source").
- Lookup-Helper MUSS fail-safe sein: jeder unerwartete Input → `DEFAULT_LIMITS`, kein Exception.
- Helper SOLLTE eine Kopie zurückgeben (oder dict-flat reproduzieren), damit Caller-Mutation nicht das Modul-State korrumpiert (siehe AC-5).

**Referenzen:**
- Architecture: `architecture.md` → Section "Multimodal Pipeline Architecture" → Subsection "Cap source" (Werte für `CHAT_LLM_LIMITS` + `DEFAULT_LIMITS`).
- Architecture: `architecture.md` → Section "Architectural Decisions" Q9 (Begründung getrennt von `prompt_knowledge.py`).
- Architecture: `architecture.md` → "Constraints & Trade-Offs" Tabelle (Vision-Fallback + Multimodal-Budget Konsumenten).
- Discovery: `discovery.md` → Q4 "Multimodal-Budget — konkrete Caps" (Begründung Modell-spezifischer Caps).

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `backend/app/config.py` (Allowlist-Definition) | Read-only Referenz: Modell-IDs in `CHAT_LLM_LIMITS` MÜSSEN mit OpenRouter-Allowlist übereinstimmen. NICHT importieren — Konstanten dupliziert man bewusst (architecture.md Q9). |
| `backend/app/agent/prompt_knowledge.py` / `data/prompt-knowledge.json` | NICHT verwenden — bewusste Trennung; Image-Model-Knowledge ≠ Chat-LLM-Caps. |
