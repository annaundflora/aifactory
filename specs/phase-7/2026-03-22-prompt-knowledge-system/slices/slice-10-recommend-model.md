# Slice 10: recommend_model Knowledge-Enrichment

> **Slice 10 von 13** fuer `Model-Aware Prompt Knowledge System`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-10-recommend-model` |
| **Test** | `cd backend && python -m pytest tests/unit/test_model_tools_knowledge.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-python-lookup"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi` |
| **Test Command** | `cd backend && python -m pytest tests/unit/test_model_tools_knowledge.py -v` |
| **Integration Command** | -- |
| **Acceptance Command** | `cd backend && python -c "from app.agent.tools.model_tools import _match_model; print('OK')"` |
| **Start Command** | `cd backend && uvicorn app.main:app` |
| **Health Endpoint** | `http://localhost:8000/health` |
| **Mocking Strategy** | `mock_external` (Knowledge-JSON per fixture, ModelService per Mock) |

---

## Ziel

Die `_match_model()`-Funktion in `model_tools.py` erweitern, sodass nach einem erfolgreichen Regel-Match die modellspezifischen `strengths` aus der Knowledge-Datei geladen und in den `reason`-String eingebaut werden. Statt generischer Saetze wie "fotorealistische Bilder mit hoher Detailtreue" soll die Begruendung die konkreten Staerken des gematchten Modells enthalten.

---

## Acceptance Criteria

1) GIVEN `_match_model` findet einen Match fuer Kategorie "photorealistic" mit Modell `flux-2-pro`
   WHEN die Knowledge-Datei `strengths` fuer Prefix `flux-2` enthaelt (z.B. `["Prompt-Treue", "technische Fotografie"]`)
   THEN enthaelt der `reason`-String im Ergebnis diese Staerken (z.B. "Prompt-Treue und technische Fotografie") statt des statischen `reason_de`

2) GIVEN `_match_model` findet einen Match fuer ein Modell, dessen ID KEINEN Knowledge-Eintrag hat
   WHEN die Knowledge-Datei keinen passenden Prefix enthaelt
   THEN wird der bisherige statische `reason_de` aus `_MATCHING_RULES` unveraendert zurueckgegeben (Fallback auf bestehende Logik)

3) GIVEN `_match_model` findet einen Match fuer Kategorie "text-in-image" mit Modell `ideogram-3`
   WHEN die Knowledge-Datei `strengths` fuer Prefix `ideogram` enthaelt
   THEN enthaelt der `reason`-String die Ideogram-spezifischen Staerken (nicht die generische "text-in-image" Begruendung)

4) GIVEN `_match_model` findet KEINEN Match (return `None`)
   WHEN kein Regel-Keyword zutrifft
   THEN ist das Verhalten unveraendert: `None` wird zurueckgegeben, kein Knowledge-Lookup

5) GIVEN die Knowledge-Datei ist nicht ladbar oder leer
   WHEN `_match_model` einen Regel-Match findet
   THEN wird der statische `reason_de` zurueckgegeben (graceful degradation, kein Crash)

6) GIVEN `_match_model("product photography", ["photorealistic"], available_models)` mit einem Flux-Modell in `available_models`
   WHEN das Ergebnis geprueft wird
   THEN enthaelt `result["reason"]` modellspezifische Staerken (z.B. "Prompt-Treue") und NICHT nur "fotorealistische Bilder mit hoher Detailtreue"

7) GIVEN ein gematchtes Modell hat eine Model-ID im Format `owner/name` (z.B. `black-forest-labs/flux-2-pro`)
   WHEN der Knowledge-Lookup fuer den Reason-Enrichment durchgefuehrt wird
   THEN wird korrekt Slash-Stripping angewendet und der Prefix `flux-2` matcht

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `backend/tests/unit/test_model_tools_knowledge.py`

<test_spec>
```python
import pytest


class TestMatchModelKnowledgeEnrichment:
    # AC-1: Reason enthaelt Knowledge-Staerken statt statischem Text
    @pytest.mark.skip(reason="AC-1")
    def test_reason_contains_knowledge_strengths_for_flux(self): ...

    # AC-2: Fallback auf statischen reason_de wenn kein Knowledge-Eintrag
    @pytest.mark.skip(reason="AC-2")
    def test_fallback_to_static_reason_when_no_knowledge(self): ...

    # AC-3: Ideogram-spezifische Staerken im Reason
    @pytest.mark.skip(reason="AC-3")
    def test_reason_contains_ideogram_strengths(self): ...

    # AC-4: Kein Match -> None, kein Knowledge-Lookup
    @pytest.mark.skip(reason="AC-4")
    def test_no_match_returns_none_unchanged(self): ...

    # AC-5: Graceful degradation bei nicht ladbarer Knowledge-Datei
    @pytest.mark.skip(reason="AC-5")
    def test_graceful_fallback_when_knowledge_unavailable(self): ...

    # AC-6: Product-Photography-Szenario mit konkreten Staerken
    @pytest.mark.skip(reason="AC-6")
    def test_product_photography_returns_specific_strengths(self): ...

    # AC-7: Slash-Stripping bei owner/name Model-ID
    @pytest.mark.skip(reason="AC-7")
    def test_slash_stripping_for_knowledge_lookup(self): ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-03-python-lookup | `get_prompt_knowledge` | Function | `(model_id: str, mode: str \| None = None) -> dict` — liefert `strengths`-Liste wenn vorhanden |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `_match_model` (erweitert) | Function (intern) | slice-13 (Integration-Test) | `(prompt_summary: str, style_keywords: list[str], available_models: list[dict]) -> dict \| None` — `reason`-Feld enthaelt Knowledge-basierte Staerken |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/agent/tools/model_tools.py` — EXTEND: `_match_model()` nach erfolgreichem Regel-Match um Knowledge-Lookup erweitern. `get_prompt_knowledge` importieren, `strengths` aus dem Ergebnis extrahieren und in den `reason`-String einbauen. Statischer `reason_de` bleibt als Fallback.
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderung der `_MATCHING_RULES`-Struktur (Keywords, model_patterns, category bleiben)
- KEINE Aenderung an `recommend_model` Tool-Signatur (bleibt `prompt_summary` + `style_keywords`)
- KEINE Aenderung an `get_model_info` Tool
- KEINE Aenderung an `_get_default_model` (Default-Logik bleibt unveraendert)
- KEIN neuer API-Endpunkt oder neue Tool-Definition
- KEINE Aenderung an der Knowledge-JSON-Datei (Inhalt ist Slice 01 + Slice 11)

**Technische Constraints:**
- Knowledge-Lookup NUR nach erfolgreichem Regel-Match (nicht bei `None`-Return)
- `get_prompt_knowledge` aus `app.agent.prompt_knowledge` importieren (Slice 03)
- Reason-Enrichment: `strengths`-Liste aus dem Knowledge-Ergebnis in einen lesbaren deutschen Satz formatieren
- Wenn Knowledge-Lookup fehlschlaegt oder keine `strengths` liefert: statischen `reason_de` beibehalten
- Kein try/except um den gesamten Match-Flow — nur den Knowledge-Lookup-Teil absichern
- Model-ID fuer den Knowledge-Lookup aus dem gematchten `model["owner"]` + `model["name"]` zusammensetzen

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` — Section "Server Logic > _MATCHING_RULES enrichment" (Zeile 97)
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` — Section "Business Logic Flow > recommend_model" (Zeilen 128-131)
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` — Section "Knowledge File Schema > strengths" (Zeile 341)
- Bestehender Code: `backend/app/agent/tools/model_tools.py` — `_match_model()` Zeilen 63-104, `_MATCHING_RULES` Zeilen 29-60

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `backend/app/agent/tools/model_tools.py` | EXTEND: `_match_model()` intern erweitern, oeffentliche Signatur bleibt |
| `backend/app/agent/prompt_knowledge.py` | Import `get_prompt_knowledge` — NICHT modifizieren |
