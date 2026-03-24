# Slice 3: Python Lookup-Funktion (Prefix-Matching)

> **Slice 3 von 13** fuer `Model-Aware Prompt Knowledge System`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-03-python-lookup` |
| **Test** | `cd backend && python -m pytest tests/unit/test_prompt_knowledge.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-knowledge-schema"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi` |
| **Test Command** | `cd backend && python -m pytest tests/unit/test_prompt_knowledge.py -v` |
| **Integration Command** | -- |
| **Acceptance Command** | `cd backend && python -c "from app.agent.prompt_knowledge import get_prompt_knowledge, format_knowledge_for_prompt; print('OK')"` |
| **Start Command** | `cd backend && uvicorn app.main:app` |
| **Health Endpoint** | `http://localhost:8000/health` |
| **Mocking Strategy** | `mock_external` (JSON-Datei wird per fixture/monkeypatch bereitgestellt) |

---

## Ziel

Ein reines, seiteneffektfreies Lookup-Modul in Python implementieren, das die Knowledge-JSON-Datei mit module-level Cache laedt, per laengstem Prefix-Match das passende Modell-Wissen findet, nach Generierungs-Modus filtert und bei unbekannten Modellen den Fallback zurueckgibt. Die Logik muss identische Ergebnisse wie die TS-Version (Slice 02) fuer gleiche Inputs liefern.

---

## Acceptance Criteria

1) GIVEN `prompt-knowledge.json` enthaelt Prefixe `flux-2-pro` und `flux-2`
   WHEN `get_prompt_knowledge("flux-2-pro-ultra")` aufgerufen wird
   THEN wird der Eintrag fuer Prefix `flux-2-pro` zurueckgegeben (laengster Match gewinnt, nicht `flux-2`)

2) GIVEN `prompt-knowledge.json` enthaelt Prefix `flux-2`
   WHEN `get_prompt_knowledge("flux-2-max")` aufgerufen wird
   THEN wird der Eintrag fuer Prefix `flux-2` zurueckgegeben (einfacher Prefix-Match)

3) GIVEN `prompt-knowledge.json` enthaelt keinen passenden Prefix fuer "unknown-model-xyz"
   WHEN `get_prompt_knowledge("unknown-model-xyz")` aufgerufen wird
   THEN wird das `fallback`-Objekt zurueckgegeben (mit `displayName` == `"Generic"`)

4) GIVEN ein Modell-Eintrag hat `modes.txt2img` mit Tipps
   WHEN `get_prompt_knowledge("flux-2-pro", "txt2img")` aufgerufen wird
   THEN enthaelt das Ergebnis sowohl die allgemeinen Modell-Tipps als auch die modus-spezifischen `txt2img`-Tipps

5) GIVEN ein Modell-Eintrag hat KEINE `modes.img2img`-Sektion
   WHEN `get_prompt_knowledge("some-model", "img2img")` aufgerufen wird
   THEN enthaelt das Ergebnis nur die allgemeinen Modell-Tipps (kein Fehler, kein Crash)

6) GIVEN `get_prompt_knowledge` wird ohne Modus aufgerufen (`mode` ist `None`)
   WHEN das Ergebnis geprueft wird
   THEN enthaelt es nur die allgemeinen Modell-Tipps (keine Modus-Sektion)

7) GIVEN eine Model-ID im Format `owner/model-name` (z.B. `black-forest-labs/flux-2-pro`)
   WHEN `get_prompt_knowledge("black-forest-labs/flux-2-pro")` aufgerufen wird
   THEN wird der Teil vor dem `/` gestrippt und das Prefix-Matching erfolgt gegen `flux-2-pro`

8) GIVEN eine Model-ID ohne Slash (z.B. `flux-2-pro`)
   WHEN `get_prompt_knowledge("flux-2-pro")` aufgerufen wird
   THEN funktioniert das Matching identisch wie mit Slash (kein Crash bei fehlendem Slash)

9) GIVEN ein gueltiges Lookup-Ergebnis (Modell oder Fallback)
   WHEN `format_knowledge_for_prompt(result)` aufgerufen wird
   THEN wird ein nicht-leerer String zurueckgegeben, der fuer System-Prompt-Injection geeignet ist

10) GIVEN ein Lookup-Ergebnis mit Modell-Tipps UND Modus-Tipps
    WHEN `format_knowledge_for_prompt(result)` aufgerufen wird
    THEN enthaelt der String sowohl die allgemeinen Tipps als auch die Modus-Tipps in lesbarem Format

11) GIVEN die JSON-Datei wurde bereits einmal geladen
    WHEN `get_prompt_knowledge` ein zweites Mal aufgerufen wird
    THEN wird die Datei NICHT erneut vom Dateisystem gelesen (module-level Cache)

12) GIVEN identische Inputs (`model_id="flux-2-pro"`, `mode="txt2img"`)
    WHEN `get_prompt_knowledge` in Python und `getPromptKnowledge` in TS aufgerufen werden
    THEN liefern beide Versionen die gleichen `displayName`-, `tips`- und `avoid`-Werte

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `backend/tests/unit/test_prompt_knowledge.py`

<test_spec>
```python
import pytest


class TestGetPromptKnowledge:
    # AC-1: Laengster Prefix gewinnt
    @pytest.mark.skip(reason="AC-1")
    def test_longest_prefix_wins(self): ...

    # AC-2: Einfacher Prefix-Match
    @pytest.mark.skip(reason="AC-2")
    def test_simple_prefix_match(self): ...

    # AC-3: Fallback bei unbekanntem Modell
    @pytest.mark.skip(reason="AC-3")
    def test_fallback_for_unknown_model(self): ...

    # AC-4: Modus-spezifische Tipps bei txt2img
    @pytest.mark.skip(reason="AC-4")
    def test_includes_txt2img_mode_tips(self): ...

    # AC-5: Graceful bei fehlendem Modus-Eintrag
    @pytest.mark.skip(reason="AC-5")
    def test_graceful_when_mode_section_missing(self): ...

    # AC-6: Kein Modus -> nur allgemeine Tipps
    @pytest.mark.skip(reason="AC-6")
    def test_no_mode_returns_model_tips_only(self): ...

    # AC-7: Slash-Stripping bei owner/model-name
    @pytest.mark.skip(reason="AC-7")
    def test_strips_owner_prefix_before_slash(self): ...

    # AC-8: Model-ID ohne Slash funktioniert
    @pytest.mark.skip(reason="AC-8")
    def test_handles_model_id_without_slash(self): ...

    # AC-11: Module-level Cache
    @pytest.mark.skip(reason="AC-11")
    def test_does_not_reload_json_on_subsequent_calls(self): ...

    # AC-12: Identische Ergebnisse wie TS-Version
    @pytest.mark.skip(reason="AC-12")
    def test_matches_ts_version_output_for_same_inputs(self): ...


class TestFormatKnowledgeForPrompt:
    # AC-9: Nicht-leerer String fuer System-Prompt
    @pytest.mark.skip(reason="AC-9")
    def test_returns_non_empty_string(self): ...

    # AC-10: Modell-Tipps und Modus-Tipps im formatierten String
    @pytest.mark.skip(reason="AC-10")
    def test_includes_model_and_mode_tips(self): ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-01-knowledge-schema | `data/prompt-knowledge.json` | Data File | JSON ist parsebar, enthaelt `models` + `fallback` Keys |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `get_prompt_knowledge` | Function | slice-06 (Assistant System-Prompt), slice-09 (Canvas Chat), slice-10 (recommend_model) | `(model_id: str, mode: str \| None = None) -> dict` |
| `format_knowledge_for_prompt` | Function | slice-06 (Assistant System-Prompt), slice-09 (Canvas Chat) | `(result: dict) -> str` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/agent/prompt_knowledge.py` -- Lookup-Modul mit `get_prompt_knowledge` (Prefix-Matching, Modus-Filter, Fallback, Slash-Stripping) und `format_knowledge_for_prompt` (Ergebnis als System-Prompt-String formatieren). Module-level JSON-Cache.
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Aendern der Knowledge-JSON-Datei (Inhalt ist Slice 01 + Slice 11)
- KEINE TypeScript-Implementierung (ist Slice 02)
- KEINE Integration in prompts.py, canvas_graph.py oder model_tools.py (ist Slice 06/09/10)
- KEIN neuer API-Endpunkt
- KEINE neuen Python-Dependencies (nur stdlib `json`, `pathlib`)

**Technische Constraints:**
- Reine Funktion ohne Side-Effects (ausser dem einmaligen Datei-Read beim ersten Aufruf)
- Module-level Cache: JSON wird einmal geladen und danach aus dem Speicher bedient
- Prefixe muessen nach Laenge absteigend sortiert verglichen werden (laengster Match zuerst)
- Slash-Stripping: `owner/model-name` -> `model-name` (Teil nach dem letzten `/`)
- Pfad zur JSON-Datei relativ zum Repo-Root aufloesen (nicht relativ zum Modul)
- Identische Matching-Logik wie TS-Version in Slice 02 (gleiche Inputs = gleiche Outputs)

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` -- Section "Prefix Matching Algorithm" (Zeilen 366-375)
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` -- Section "Server Logic > Knowledge Lookup (Python)" (Zeile 93)
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` -- Section "Error Handling Strategy" (Zeilen 205-209)
- Discovery: `specs/phase-7/2026-03-22-prompt-knowledge-system/discovery.md` -- Section "Business Rules" (Zeilen 100-107)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `data/prompt-knowledge.json` | Einlesen per `json.load` -- NICHT modifizieren |
