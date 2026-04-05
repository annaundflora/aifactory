# Gate 2: Compliance Report -- Slice 06b

**Gepruefter Slice:** `slices/slice-06b-canvas-agent.md`
**Pruefdatum:** 2026-04-04

---

## Phase 2: Deterministic Checks

| Check | Status | Detail |
|-------|--------|--------|
| D-1: Metadata | PASS | ID=`slice-06b-canvas-agent`, Test=pytest command, E2E=false, Dependencies=`["slice-01-types-model-slots"]` |
| D-2: Test-Strategy | PASS | Alle 7 Felder vorhanden (Stack=python-fastapi, Mocking=mock_external) |
| D-3: AC Format | PASS | 12 ACs, alle mit GIVEN/WHEN/THEN |
| D-4: Test Skeletons | PASS | 12 Tests (`def test_*` Python-Pattern) vs 12 ACs -- 1:1 Mapping |
| D-5: Integration Contract | PASS | "Requires From" Tabelle (1 Eintrag: slice-01), "Provides To" Tabelle (4 Eintraege) |
| D-6: Deliverables Marker | PASS | 3 Deliverables zwischen DELIVERABLES_START/END, alle mit Dateipfaden |
| D-7: Constraints | PASS | 5 Scope-Grenzen, 6 technische Constraints, Reuse-Tabelle mit 3 Eintraegen |
| D-8: Groesse | PASS | 220 Zeilen (weit unter 500). Test-Skeleton-Block 56 Zeilen (>20), aber Test Skeletons sind Pflicht-Struktur, kein Code Example |
| D-9: Anti-Bloat | PASS | Keine "Code Examples" Section, keine ASCII-Art, kein DB-Schema, keine grossen Type-Definitionen |
| D-10: Codebase Reference | PASS | Alle 3 MODIFY-Dateien existieren: `canvas_graph.py` (build_canvas_system_prompt gefunden Zeile 161), `image_tools.py` (generate_image gefunden Zeile 307), `canvas_sessions.py` (CanvasImageContext gefunden Zeile 41) |

**Phase 2 Verdict:** PASS

---

## Phase 3: LLM Content Checks

### L-1: AC-Qualitaet

| Status | Detail |
|--------|--------|
| PASS | Alle 12 ACs sind testbar, spezifisch und messbar |

**Detail-Analyse:**

- **Testbarkeit:** Alle ACs sind unit-testbar (Pydantic-Validation, String-Contains, Dict-Rueckgabe). Kein AC erfordert LLM-Aufruf oder Netzwerk.
- **Spezifitaet:** ACs enthalten konkrete Werte (URLs, Action-Strings, Fehlermeldungen, Feldnamen). AC-6 bis AC-12 spezifizieren exakte Dict-Strukturen.
- **GIVEN Vollstaendigkeit:** Jedes GIVEN definiert praezise Eingabedaten inkl. konkreter Parameterwerte.
- **WHEN Eindeutigkeit:** Jede Aktion ist ein einzelner Funktionsaufruf.
- **THEN Messbarkeit:** Alle THENs sind maschinell pruefbar (Dict-Vergleich, String-Suche, None-Check, Typ-Check).

### L-2: Architecture Alignment

| Status | Detail |
|--------|--------|
| PASS | Slice aligned mit architecture.md Sections "Server Logic", "API Design > Endpoints", "Migration Map" |

**Detail-Analyse:**

- **CanvasImageContext + mask_url:** Architecture Zeile 90 definiert `mask_url: Optional[HttpUrl]` -- Slice AC-1/AC-2 implementieren genau das.
- **generate_image Tool-Erweiterung:** Architecture Zeile 337 definiert 6 Actions + 3 neue Params -- Slice AC-6 bis AC-12 decken alle 4 neuen Actions ab (inpaint, erase, instruction, outpaint) plus Validation.
- **System-Prompt Edit-Routing:** Architecture Zeile 151 definiert Intent-Klassifikation (Mask+Prompt->inpaint, No-Mask+Edit->instruction, Outpaint->outpaint) -- Slice AC-3 bis AC-5 pruefen genau diese Routing-Regeln.
- **Action-Validation:** Architecture Zeile 337 listet 6 gueltige Actions -- Slice AC-10 prueft Fallback bei ungueltiger Action.
- **Keine Widersprueche** zu Architecture-Vorgaben gefunden.

### L-3: Integration Contract Konsistenz

| Status | Detail |
|--------|--------|
| PASS | Requires/Provides konsistent mit Dependency-Graph |

**Detail-Analyse:**

- **Requires:** `slice-01-types-model-slots` liefert `GenerationMode` mit `"erase"` und `"instruction"` (Provides To in slice-01 bestaetigt: "slice-06b" ist explizit als Consumer gelistet). Der Slice importiert diese Types nicht direkt (Python-Backend vs. TypeScript), aber stellt sicher, dass die Action-Strings konsistent sind. Korrekt dokumentiert.
- **Provides:** 4 Ressourcen (CanvasImageContext.mask_url, generate_image erweitert, System-Prompt Routing, SSE Event erweitert) fuer slice-06a, slice-08 und interne Consumer. Interfaces sind praezise typisiert.

### L-4: Deliverable-Coverage

| Status | Detail |
|--------|--------|
| PASS | Alle ACs referenzieren Deliverables, kein verwaistes Deliverable |

**Detail-Analyse:**

| Deliverable | Abgedeckt durch ACs |
|---|---|
| `backend/app/routes/canvas_sessions.py` (CanvasImageContext) | AC-1, AC-2 |
| `backend/app/agent/canvas_graph.py` (build_canvas_system_prompt) | AC-3, AC-4, AC-5 |
| `backend/app/agent/tools/image_tools.py` (generate_image) | AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12 |

Kein Deliverable verwaist. Test-Deliverable implizit durch Test-Skeleton abgedeckt.

### L-5: Discovery Compliance

| Status | Detail |
|--------|--------|
| PASS | Alle relevanten Business Rules aus discovery.md abgedeckt |

**Detail-Analyse:**

- **Modell-Routing (discovery.md Zeile 289-296):**
  - "Maske vorhanden + Prompt -> Inpaint-Modell" -> AC-3 (Prompt-Routing-Regel) + AC-6 (inpaint action)
  - "Keine Maske + Edit-Intent -> Instruction-Modell" -> AC-4 (instruction Routing) + AC-9 (instruction action)
  - "Outpaint-Kontext -> Outpaint-Modell" -> AC-5 (outpaint Routing) + AC-8 (outpaint action)
  - "Erase" -> AC-7 (erase action)
- **Default-Modelle:** AC-6 nutzt `flux-fill-pro`, AC-7 nutzt `bria/eraser`, AC-9 nutzt `flux-kontext-pro` -- konsistent mit discovery.md Zeile 291-295.
- **Scope korrekt begrenzt:** Erase-Direct-Flow (ohne Agent), Frontend, GenerationService, SAM explizit als Out-of-Scope markiert -- konsistent mit Discovery Slice-Aufteilung.

### L-6: Consumer Coverage

| Status | Detail |
|--------|--------|
| PASS | Alle Consumer-Call-Patterns abgedeckt oder backward-kompatibel |

**Detail-Analyse:**

Alle 3 Deliverables sind MODIFY-Dateien:

1. **`CanvasImageContext`** -- Neues `mask_url: Optional[HttpUrl] = None` Feld. Consumer: `CreateCanvasSessionRequest`, `CanvasSendMessageRequest`, `canvas_graph.py`. Da `Optional` mit Default `None`, ist keine bestehende Instanziierung betroffen. AC-2 prueft explizit den Default-Fall.

2. **`generate_image`** -- Neue Optional-Parameter (`mask_url`, `outpaint_directions`, `outpaint_size`). Consumer: LLM-Agent (ruft Tool auf, kein Code-Caller), `canvas_assistant_service.py` (prueft nur `tool_name == "generate_image"` und leitet Output-Dict weiter, inspiziert keine spezifischen Felder). Bestehende "variation"/"img2img" Calls funktionieren weiterhin (AC-10 prueft Fallback). Backward-kompatibel.

3. **`build_canvas_system_prompt`** -- Prompt-String wird erweitert. Consumer: `canvas_graph.py` Zeilen 350/363 (intern), Tests. Funktion gibt weiterhin `str` zurueck, Signatur unveraendert (`image_context: Optional[dict] = None`). Backward-kompatibel.

---

## Blocking Issues

Keine.

---

## Verdict

**VERDICT: APPROVED**

**Blocking Issues:** 0
