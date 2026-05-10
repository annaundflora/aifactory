# Slice 12: Base-Prompt-Rewrite (Interview-Verhalten)

> **Slice 12 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-12-base-prompt-rewrite-interview` |
| **Test** | `cd backend && python -m pytest tests/unit/test_base_prompt_eval.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["11-prompts-context-block"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

> **Quelle:** Auto-detected — Python/FastAPI + LangGraph + pytest. Kein Live-LLM-Call: Eval-Suite arbeitet mit gemockten LLM-Responses (`AsyncMock` über `ChatOpenRouter`) und/oder Snapshot-Vergleich des `_BASE_PROMPT`-Strings auf Pflicht-Phrasen. Vorbild: bestehende Prompt-Tests im Backend, AsyncMock-Pattern aus Slice 11 (`tests/unit/test_assistant_service_project_context.py`).

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi + langgraph + pytest` |
| **Test Command** | `cd backend && python -m pytest tests/unit/test_base_prompt_eval.py tests/unit/test_base_prompt_snapshot.py -v` |
| **Integration Command** | `cd backend && python -m pytest tests/integration/ -v -k base_prompt` (optional) |
| **Acceptance Command** | `cd backend && python -m pytest tests/unit/test_base_prompt_eval.py tests/unit/test_base_prompt_snapshot.py -v` |
| **Start Command** | `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | `GET http://localhost:8000/health` |
| **Mocking Strategy** | `mock_external` (LLM-Responses via `AsyncMock`-stubbed `ChatOpenRouter`-Calls; tool-call-Verhalten wird über `tool_calls`-Felder im gemockten `AIMessage`-Return simuliert) |

---

## Ziel

`_BASE_PROMPT` in `backend/app/agent/prompts.py` wird vollständig neu formuliert: weg vom "kein-Fragebogen"-Modus, hin zu einem adaptiven Interview-Verhalten mit Stop-Signal über semantic confidence, FSM-bewusster Tool-Auswahl (insb. `emit_intent_summary` als Abschluss-Tool, NICHT als Generate-Trigger), strikter Trennung von Zwischen-Check vs. Final-Summary und sequenziellen Multi-Reference-Regeln (Slice K). DE-Chat / EN-Prompt-Konvention bleibt unverändert; bestehende Tools (`draft_prompt`, `refine_prompt`, `analyze_image`, `recommend_model`, `web_search`) behalten ihre Rolle.

---

## Acceptance Criteria

1) **GIVEN** der Inhalt von `_BASE_PROMPT` nach Rewrite
   **WHEN** der String inspiziert wird
   **THEN** er enthält EXAKT die folgenden Pflicht-Phrasen (Substring-Match, case-sensitive): `"Du sprichst Deutsch"`, `"Prompts immer auf Englisch"`, `"emit_intent_summary"`, `"Zwischen-Check"`, `"semantic"` (oder deutsch `"semantisch"`), `"flow_state"` ODER `"FSM"` (mind. einer der beiden Begriffe), `"set_slot_role"` (Multi-Reference-Regel referenziert Tool); KEINE Anti-Phrase `"kein Fragebogen"` mehr (bewusste Abkehr vom alten Verhalten).

2) **GIVEN** ein Eval-Case mit gemocktem LLM, in dem die User-Message vager Intent ist (`"mach was Schönes"`, keine Must-Haves erkennbar)
   **WHEN** der Agent mit `_BASE_PROMPT` als System-Message gestartet wird und der Mock einen `AIMessage` ohne Tool-Calls zurückgibt (= Assistant stellt eine Frage)
   **THEN** das Test-Setup verifiziert, dass KEIN `emit_intent_summary`-Tool-Call und KEIN `draft_prompt`-Tool-Call im Mock-Response erwartet wird; das System-Prompt-Design steuert den LLM zu einer Klärungsfrage. (Eval-Style: Pflicht-Regel im Prompt-Text testbar via Substring-Match auf Phrasen wie `"frage zuerst"`, `"keine Annahmen"`, `"vager Intent"` o.ä. — exakte Formulierung Implementer-Wahl, aber Substring-Match-Phrasen werden in Constraints fixiert.)

3) **GIVEN** ein Eval-Case mit konkretem User-Input + allen Must-Haves im Verlauf (`"Cyberpunk-Portrait, Ölgemälde-Stil, für Print"`, Subject + Style + Zweck klar)
   **WHEN** der Agent läuft und der Mock einen `AIMessage` mit `tool_calls=[{"name": "emit_intent_summary", "args": {"prompt": "...", ...}}]` zurückgibt
   **THEN** der Test verifiziert, dass die Prompt-Regel erlaubt/erzwingt, `emit_intent_summary` zu rufen, sobald die 3 Pflicht-Achsen Subject + Style + Zweck (oder eine Achsen-Kombi gemäß den Must-Haves im Prompt) bedeckt sind; KEIN Fallback auf `draft_prompt` für Final-Summaries.

4) **GIVEN** ein Eval-Case mit Zwischen-Check (`"Verstehe ich richtig, dass du Cyberpunk willst?"` als Assistant-Frage), gefolgt von User-Bestätigung
   **WHEN** der Mock-LLM auf die User-Bestätigung antwortet
   **THEN** der erwartete Mock-Response ist eine reine Text-Antwort oder eine Folge-Frage — KEIN Tool-Call (weder `emit_intent_summary` noch `draft_prompt`); die Prompt-Regel "Zwischen-Check ≠ Generate" verhindert vorzeitiges Tool-Feuern. Eval prüft via Substring-Match im Prompt-Text auf eine Pflicht-Regel à la `"Zwischen-Check ist KEIN Generate"` o.ä.

5) **GIVEN** ein Eval-Case mit `generation_mode="img2img"` und 3 belegten Reference-Slots (Slot 0, 1, 2 mit `image_url` populated, ohne Rolle)
   **WHEN** der Agent läuft
   **THEN** die Prompt-Regel beschreibt explizit den sequenziellen Multi-Reference-Flow: pro Slot eine Frage (`"Was übernehmen wir von Slot N? Subject, Style oder Composition?"`), gefolgt von einem `set_slot_role`-Tool-Call mit `slot_index=N`, dann zum nächsten Slot. Substring-Match-Phrasen im Prompt: `"sequenziell"` oder `"ein Bild nach dem anderen"`; Regel referenziert das Tool `set_slot_role` namentlich.

6) **GIVEN** ein Eval-Case, in dem der LLM nach erfolgreichem `emit_intent_summary`-Call eine weitere User-Message bekommt (`"Nochmal, aber dunkler"`)
   **WHEN** der Mock-Response simuliert wird
   **THEN** die Prompt-Regel erlaubt `refine_prompt` (für inkrementelle Refinements im `refining`-State), aber NICHT erneutes `emit_intent_summary` ohne neue Klärung; Substring-Match-Phrase im Prompt: `"refine_prompt"` als Refinement-Pfad, `"emit_intent_summary"` nur einmal pro Final-Confirm.

7) **GIVEN** der Snapshot-Test des `_BASE_PROMPT`-Strings
   **WHEN** die Datei geladen wird
   **THEN** die Länge ist > 1500 Zeichen UND < 8000 Zeichen (deutlich umfangreicher als der alte Prompt durch FSM/Tool/Multi-Reference-Regeln, aber unter dem Cap, der den Context-Block + Knowledge nicht erdrückt); KEIN deutscher Tippfehler aus dem Alt-Bestand bleibt zurück (`"Anfaengern"`, `"sprichst"`, etc. sind erlaubt — Umlaut-frei ist Convention; das ist kein Verstoß).

8) **GIVEN** das gemeinsame Eval-Set aus AC-2 bis AC-6 läuft als Pytest-Suite
   **WHEN** alle Eval-Cases ausgeführt werden
   **THEN** mindestens 5 Eval-Cases sind grün (AC-2 vager Input, AC-3 konkreter Input, AC-4 Zwischen-Check, AC-5 Multi-Reference, AC-6 Refine-nach-Summary); das Done-Signal "Mind. 5 Eval-Cases passen" ist erfüllt.

9) **GIVEN** der Rewrite ist erfolgt
   **WHEN** `build_assistant_system_prompt(image_model_id=None, generation_mode=None, project_context=None)` aufgerufen wird (Slice-11-Vertrag)
   **THEN** der Output enthält den neuen `_BASE_PROMPT` (alle Pflicht-Phrasen aus AC-1 sichtbar) UND keine Reste des alten Prompts (Anti-Phrase `"kein Fragebogen"` weiterhin abwesend); Slice-11-Komposition (Block-Reihenfolge Base → Context → Knowledge) bleibt strukturell unverändert.

10) **GIVEN** der `SYSTEM_PROMPT`-Backward-Compat-Alias in `prompts.py` existiert (Zeile 129)
    **WHEN** Code/Tests `from app.agent.prompts import SYSTEM_PROMPT` importieren
    **THEN** der Alias verweist weiterhin auf `_BASE_PROMPT` (jetzt mit neuem Inhalt); kein Crash, keine fehlende Konstante; existierende Konsumenten brechen nur, wenn sie auf die alte Anti-Phrase `"kein Fragebogen"` regex-matchen (akzeptiert per Architecture-Vermerk: "Tests update if relying on phrase `kein Fragebogen`").

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Eval-Cases nutzen `AsyncMock` auf `ChatOpenRouter`-Aufrufen oder direkt auf `_call_model_*`-Output (vorgemockte `AIMessage`-Returns). Das Test-Pattern ist: System-Prompt + History → Mock-Response asserten, dass die im Prompt definierten Regeln sich im erwarteten Verhalten manifestieren (Substring-Match auf Prompt-Text + Tool-Call-Shape im Mock-Response). Snapshot-Tests vergleichen Substring-Präsenz, NICHT exakten Wortlaut.

### Test-Datei: `backend/tests/unit/test_base_prompt_snapshot.py`

<test_spec>
```python
# AC-1: Pflicht-Phrasen im _BASE_PROMPT
@pytest.mark.skip(reason='AC-1: _BASE_PROMPT contains all required substrings (DE-chat, EN-prompt, emit_intent_summary, Zwischen-Check, semantic, flow_state, set_slot_role)')
def test_base_prompt_contains_required_phrases():
    ...

@pytest.mark.skip(reason='AC-1: _BASE_PROMPT does NOT contain anti-phrase "kein Fragebogen"')
def test_base_prompt_omits_old_anti_phrase():
    ...

# AC-7: Längen-Bounds
@pytest.mark.skip(reason='AC-7: _BASE_PROMPT length is between 1500 and 8000 characters')
def test_base_prompt_length_bounds():
    ...

# AC-9: Slice-11-Komposition bleibt funktional mit neuem Base-Prompt
@pytest.mark.skip(reason='AC-9: build_assistant_system_prompt(None, None, None) returns base-only output containing the new prompt phrases')
def test_build_assistant_system_prompt_uses_new_base():
    ...

# AC-10: SYSTEM_PROMPT-Alias bleibt importierbar
@pytest.mark.skip(reason='AC-10: SYSTEM_PROMPT alias still exports _BASE_PROMPT after rewrite')
def test_system_prompt_alias_still_exports_base():
    ...
```
</test_spec>

### Test-Datei: `backend/tests/unit/test_base_prompt_eval.py`

<test_spec>
```python
# AC-2: Vager Input → Frage (kein Tool-Call erwartet)
@pytest.mark.skip(reason='AC-2: vague input case — prompt rule steers LLM to clarification question, no emit_intent_summary')
@pytest.mark.asyncio
async def test_eval_vague_input_yields_question_not_tool_call():
    ...

# AC-3: Konkreter Input + Must-Haves → emit_intent_summary
@pytest.mark.skip(reason='AC-3: concrete input + all must-haves — prompt rule allows emit_intent_summary tool-call')
@pytest.mark.asyncio
async def test_eval_concrete_input_triggers_emit_intent_summary():
    ...

# AC-4: Zwischen-Check ≠ Generate
@pytest.mark.skip(reason='AC-4: mid-interview clarification check does not trigger emit_intent_summary or draft_prompt')
@pytest.mark.asyncio
async def test_eval_intermediate_check_does_not_call_tool():
    ...

# AC-5: Sequenzielles Multi-Reference-Interview (Slice K)
@pytest.mark.skip(reason='AC-5: img2img with 3 unrolled reference slots — prompt encodes sequential per-slot questioning + set_slot_role calls')
@pytest.mark.asyncio
async def test_eval_multi_reference_sequential_interview():
    ...

# AC-6: Nach Summary → refine_prompt (nicht erneut emit_intent_summary)
@pytest.mark.skip(reason='AC-6: post-summary refinement uses refine_prompt; emit_intent_summary not re-fired without new clarification')
@pytest.mark.asyncio
async def test_eval_post_summary_refinement_uses_refine_prompt():
    ...

# AC-8: Mind. 5 Eval-Cases passen (Aggregat-Test)
@pytest.mark.skip(reason='AC-8: at least 5 eval cases pass — aggregate gate test')
def test_eval_set_minimum_five_cases_pass():
    ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-11-prompts-context-block` | `build_assistant_system_prompt(image_model_id, generation_mode, project_context) -> str` | Python function (erweiterte Signatur) | Funktion existiert mit drittem Keyword-Arg `project_context`; ruft intern `_BASE_PROMPT` als ersten Block ab (Block-Reihenfolge Slice 11 AC-3) |
| Bestehender Code | `_BASE_PROMPT` Module-Level-String in `backend/app/agent/prompts.py:17-82` | Python string constant | Ziel des Rewrites — Inhalt wird vollständig ersetzt, Variable bleibt |
| Bestehender Code | `SYSTEM_PROMPT`-Alias in `backend/app/agent/prompts.py:129` | Module-Level-Alias | Bleibt unverändert auf `_BASE_PROMPT` zeigend (AC-10) |
| Bestehende Tools (Namen-Vertrag) | `draft_prompt`, `refine_prompt`, `analyze_image`, `recommend_model`, `web_search` | LangGraph `@tool`-Definitionen in `backend/app/agent/tools/` | Werden im Prompt namentlich referenziert; Tool-Implementations bleiben unverändert |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `_BASE_PROMPT` (rewritten content) | Python module-level string | `slice-13-emit-intent-summary-tool` (Tool wird im Prompt genannt + erwartetes Verhalten beschrieben) | Substring-Match: `"emit_intent_summary"` muss vorkommen |
| Verhaltens-Vertrag "Zwischen-Check ≠ Generate" | Prompt-Regel (kein Code) | `slice-14-fsm-state-extension`, `slice-15-sse-flow-state-events` | LLM ruft `emit_intent_summary` nur bei Final-Summary, nicht bei Zwischen-Check; FSM-Transition `interviewing → summarizing` triggert nur dann |
| Verhaltens-Vertrag "Sequenzielles Multi-Reference" | Prompt-Regel (kein Code) | `slice-25-multi-reference-eval` | Eval-Suite in Slice 25 testet das Verhalten gegen den hier formulierten Prompt-Text |
| Verhaltens-Vertrag "DE-Chat / EN-Prompt" | Prompt-Regel (kein Code) | alle Folge-Slices, die Assistant-Output rendern (16, 18, 27) | Assistant-Messages bleiben Deutsch; Prompt-Strings in `emit_intent_summary.prompt` sind Englisch |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/agent/prompts.py` — Edit: `_BASE_PROMPT` (aktuell Zeilen 17-82) vollständig neu schreiben. Pflicht-Inhalte (siehe Constraints für Detail-Liste): (1) DE-Chat / EN-Prompt-Regel, (2) adaptives Interview-Verhalten mit semantic-confidence-Stop, (3) FSM-Transitions-Hinweise (`interviewing → summarizing → reviewing → refining`), (4) Tool-Catalog inklusive `emit_intent_summary` mit expliziter Regel "ist KEIN Generate-Trigger", (5) Zwischen-Check ≠ Generate-Regel, (6) sequenzielle Multi-Reference-Regeln mit `set_slot_role`-Aufruf-Pattern (Slice K), (7) Verweis auf bestehende Tools (`draft_prompt`, `refine_prompt`, `analyze_image`, `recommend_model`, `web_search`) mit ihren Rollen. Funktion `build_assistant_system_prompt` und Helper `_escape_project_context` aus Slice 11 bleiben UNVERÄNDERT — dieser Slice fasst nur den Module-Level-String an. `SYSTEM_PROMPT`-Alias (Zeile 129) bleibt unverändert (zeigt automatisch auf neuen `_BASE_PROMPT`).
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt die zwei Test-Dateien (`test_base_prompt_snapshot.py`, `test_base_prompt_eval.py`) basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN neues Tool registrieren — `emit_intent_summary` wird im Prompt nur namentlich genannt; Tool-Definition + `ALL_TOOLS`-Eintrag passieren erst in Slice 13
- KEIN State-Feld hinzufügen — `flow_state` lebt erst ab Slice 14 in `PromptAssistantState`; im Prompt wird es nur als FSM-Konzept referenziert (textuelle Beschreibung der Übergänge)
- KEIN SSE-Event-Hook — Slice 15 emittiert die `flow-state`/`intent-summary`-Events; dieser Slice baut nur das LLM-Verhalten, das die Tool-Calls auslöst
- KEINE Änderungen an `build_assistant_system_prompt`, `_escape_project_context` oder dem Composition-Gerüst aus Slice 11 — der String-Inhalt von `_BASE_PROMPT` ist die einzige Berührfläche
- KEIN Anlegen von `emit_intent_summary` als Tool-Symbol; nur Erwähnung im Prompt-Text
- KEINE Frontend-Änderungen
- KEIN Live-LLM-Eval — alle Eval-Cases laufen mit gemockten Mock-Responses; Snapshot-Tests vergleichen Substrings, nicht semantisches LLM-Verhalten

**Technische Constraints:**
- `_BASE_PROMPT` bleibt Module-Level-Triple-Quoted-String; KEINE Konvertierung zu Datei-basierter Resource oder Builder-Funktion
- DE-Chat / EN-Prompt-Konvention bleibt EXAKT erhalten (Pflicht-Phrase `"Prompts immer auf Englisch"` muss laut AC-1 vorkommen — Wortlaut darf variieren, Phrase muss als Substring auffindbar sein, Test-Writer matcht via Regex `r"Prompts.*Englisch"`)
- Pflicht-Phrasen für AC-1 (Substring-Matches, Implementer wählt exakte Formulierung im Prompt-Text):
  - `"Du sprichst Deutsch"` (DE-Chat-Regel)
  - `"Englisch"` als Token in der Prompt-Erstellungs-Sektion (EN-Prompt-Regel)
  - `"emit_intent_summary"` (Tool-Name, exakt)
  - `"Zwischen-Check"` (FSM-Konzept, exakt)
  - `"semantisch"` ODER `"semantic"` (Stop-Signal)
  - `"flow_state"` ODER `"FSM"` (mind. einer)
  - `"set_slot_role"` (Multi-Reference-Tool-Name)
  - `"sequenziell"` ODER `"ein Bild nach dem anderen"` (Multi-Reference-Regel; einer reicht)
- Anti-Phrase `"kein Fragebogen"` MUSS entfernt werden (war Kernaussage des alten Prompts; Rewrite wendet sich davon ab)
- Längen-Bounds laut AC-7: 1500 < `len(_BASE_PROMPT)` < 8000
- Umlaut-Schreibweise im Prompt-Text: bestehende Konvention beibehalten (ae/oe/ue für UTF-8-robusten Output), KEIN Wechsel zu echten Umlauten
- Pflicht-Inhalt-Sektionen (Reihenfolge frei wählbar, Inhalt zwingend):
  1. **ROLLE** — DE-Chat / EN-Prompt; kreativer Partner statt Fragebogen-Bot
  2. **INTERVIEW-VERHALTEN** — adaptives Fragen statt Komplett-Fragebogen; semantic-confidence als Stop-Signal; Zwischen-Check vs. Final-Summary; Pflicht-Achsen (Subject, Style/Medium, Zweck/Composition) als Mindest-Set für Final-Summary
  3. **FSM-TRANSITIONS** — Hinweis auf `interviewing → summarizing` (durch `emit_intent_summary`-Tool-Call), `summarizing → reviewing` (durch User-Click "So generieren"), `reviewing → refining` (Refinement-Loop); Klarstellung "Tool initiiert KEIN Generate, User-Click ist der einzige Gate"
  4. **TOOL-CATALOG** — Auflistung der Tools mit Einsatz-Regeln:
     - `draft_prompt` für Initial-Draft
     - `refine_prompt` für inkrementelle Anpassungen
     - `emit_intent_summary` für Final-Summary nach semantischer Sicherheit (Pflicht-Hinweis: "ist KEIN Generate-Trigger")
     - `analyze_image` für Bildanalyse
     - `recommend_model` für Modell-Empfehlung mid-interview
     - `web_search` für unbekannte Stilbegriffe / Künstler / Orte
     - `set_slot_role` für Multi-Reference-Slots (Slice K, sequenziell)
  5. **MULTI-REFERENCE-REGELN** — explizit sequenziell pro Slot; pro Slot eine Frage à la "Was übernehmen wir von Slot N? Subject, Style oder Composition?", danach `set_slot_role(slot_index=N, role=...)`-Aufruf, dann nächster Slot
  6. **PROMPT-ERSTELLUNG** — Best-Practices (front-loading, beschreibende Begriffe, Lighting/Composition/Mood); Tool-Argument muss EXAKT mit Chat-Antwort übereinstimmen (bestehende Regel aus altem Prompt, bleibt erhalten)
- Bestehende Sektionen aus dem alten Prompt, die fachlich gültig bleiben, dürfen sinngemäß übernommen werden (Bildanalyse, Web-Recherche, Modell-Empfehlung, Phasen-Leitfaden) — aber Phasen sind jetzt FSM-States, nicht "Verstehen/Erkunden/Entwerfen/Verfeinern"

**Test-Strategie-Constraints:**
- Eval-Cases (AC-2 bis AC-6) testen das **Prompt-Design** über zwei Mechanismen kombiniert:
  1. **Substring-Match auf `_BASE_PROMPT`-Text:** prüft, dass Pflicht-Regel-Phrasen vorhanden sind
  2. **Mock-Response-Verifikation:** prüft, dass das simulierte LLM-Verhalten zur Regel passt (z.B. bei vagem Input wird ein Mock ohne Tool-Call gesetzt → Test verifiziert, dass das mit der Prompt-Regel konsistent ist)
- KEIN Live-LLM-Aufruf; KEINE OpenRouter-Calls; alle Mocks sind deterministisch
- Aggregat-Gate (AC-8): Eval-Set hat mindestens 5 Cases, alle 5 müssen grün sein für Slice-Done

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `backend/app/agent/prompts.py` (`_BASE_PROMPT` String, `build_assistant_system_prompt`-Function-Body, `_escape_project_context`-Helper, `SYSTEM_PROMPT`-Alias) | Edit nur des `_BASE_PROMPT`-String-Inhalts; alles andere in der Datei bleibt UNVERÄNDERT |
| `backend/app/agent/prompt_knowledge.py` | NICHT angefasst — Knowledge-Block bleibt orthogonal zum Base-Prompt |
| `backend/app/agent/tools/prompt_tools.py` | NICHT angefasst — Tool-Definitionen bleiben für Slice 13 reserviert; im Prompt nur namentliche Erwähnung |
| `backend/app/agent/state.py` | NICHT angefasst — `flow_state`-Feld kommt erst in Slice 14 |
| Slice 11 (`build_assistant_system_prompt`, `_escape_project_context`, Block-Composition) | Vollständig wiederverwendet — `_BASE_PROMPT` ist Block 1 in der Composition; neuer Inhalt ändert keine Strukturen |

**Referenzen:**
- Architecture: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/architecture.md` → Section "Migration Map" → Zeile `backend/app/agent/prompts.py:17-82` (`_BASE_PROMPT` Rewrite-Auftrag mit Slice-K-Multi-Reference-Regeln)
- Architecture: gleiche Datei → Section "System-Prompt Composition" (Block-Reihenfolge bleibt Base → Context → Knowledge)
- Architecture: gleiche Datei → Section "Frontend State Machine Wiring" → FSM-States `idle/interviewing/summarizing/reviewing/refining`; "generating" wird frontend-side gesetzt (KEIN Tool-Trigger)
- Architecture: gleiche Datei → Open Questions → Q1 (semantic-confidence als Stop-Signal: explizite Regel + Eval-Set), Q8 (`emit_intent_summary` ist Payload-Emit, KEIN Generate-Trigger)
- Architecture: gleiche Datei → Section "Risks & Mitigations" → "LLM never reaches semantic confidence (loops on questions)" (Mitigation = Slice-E-Eval-Set + explizite Regel; "mach einfach"-Escape erlaubt)
- Discovery: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/discovery.md` → Slice E "System-Prompt-Redesign: Interview + Stop-Kriterium" + Slice K "Multi-Reference-Interview-Flow"
- Discovery: gleiche Datei → Section "Transitions" → FSM-Übergänge inkl. `interviewing` → `interviewing` für Zwischen-Check
- Discovery: gleiche Datei → Section "Business Rules" → "Zwischen-Checks während des Interviews lösen niemals Apply oder Generate aus"
- Slice 11: `slice-11-prompts-context-block.md` → Composition-Vertrag und Block-Reihenfolge (bleibt durch diesen Slice unberührt)
- Wireframes: nicht relevant (Backend-only, Prompt-Inhalt)
