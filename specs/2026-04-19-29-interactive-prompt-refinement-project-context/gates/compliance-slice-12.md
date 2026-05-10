# Gate 2: Compliance Report — Slice 12

**Geprüfter Slice:** `specs/2026-04-19-29-interactive-prompt-refinement-project-context/slices/slice-12-base-prompt-rewrite-interview.md`
**Prüfdatum:** 2026-05-09

---

## Phase 2: Deterministic Checks

| Check | Status | Detail |
|-------|--------|--------|
| D-1: Metadata | PASS | ID=`slice-12-base-prompt-rewrite-interview`; Test=`pytest tests/unit/test_base_prompt_eval.py -v`; E2E=`false`; Dependencies=`["11-prompts-context-block"]` |
| D-2: Test-Strategy | PASS | Alle 7 Felder vorhanden (Stack, Test/Integration/Acceptance/Start Command, Health Endpoint, Mocking Strategy `mock_external`) |
| D-3: AC Format | PASS | 10 ACs, jedes mit GIVEN/WHEN/THEN |
| D-4: Test Skeletons | PASS | 12 `@pytest.mark.skip`-Stubs (5 in snapshot, 6 in eval, 1 aggregate) >= 10 ACs; pytest/asyncio Pattern |
| D-5: Integration Contract | PASS | Requires-From-Tabelle (4 Einträge: Slice 11, `_BASE_PROMPT`, `SYSTEM_PROMPT`, bestehende Tools) und Provides-To-Tabelle (4 Einträge: rewritten string, Verhaltens-Verträge) vorhanden |
| D-6: Deliverables Marker | PASS | DELIVERABLES_START/END Marker vorhanden; 1 Deliverable mit Pfad `backend/app/agent/prompts.py` |
| D-7: Constraints | PASS | Umfangreiche Constraints mit Scope-Grenzen, Technische Constraints, Test-Strategie-Constraints, Reuse-Tabelle, Referenzen |
| D-8: Größe | PASS | 263 Zeilen (< 400 Warn-Schwelle); keine Code-Blöcke > 20 Zeilen ausserhalb der Test-Skeleton-Sektion (die ist legitim) |
| D-9: Anti-Bloat | PASS | Keine "Code Examples" Section, keine ASCII-Art-Wireframes, kein DB-Schema kopiert, keine Type-Definitionen mit > 5 Feldern; Test-Skeletons enthalten nur stubbed Funktions-Signaturen |
| D-10: Codebase Reference | PASS | `_BASE_PROMPT` an `backend/app/agent/prompts.py:17-82` verifiziert (line 17 `_BASE_PROMPT = """...`, schliesst um line 82); `SYSTEM_PROMPT` Alias an line 129 verifiziert; `build_assistant_system_prompt` an lines 85-123 verifiziert; alle 5 bestehenden Tools (`draft_prompt`, `refine_prompt`, `analyze_image`, `recommend_model`, `web_search`) im Tool-Catalog referenziert. Slice 11 Funktion-Signatur (`build_assistant_system_prompt(image_model_id, generation_mode, project_context)`) ist in Slice 11 AC-1 dokumentiert. |

**Phase 2 Verdict:** PASS

---

## Phase 3: LLM Content Checks

| Check | Status | Detail |
|-------|--------|--------|
| L-1: AC-Qualität | PASS | Alle 10 ACs sind testbar; Substring-Matches mit konkreten Phrasen ("Du sprichst Deutsch", "emit_intent_summary", "Zwischen-Check", etc.); Mock-Response-Shapes präzise spezifiziert (`AIMessage` mit/ohne `tool_calls`); Längen-Bounds numerisch (1500..8000); GIVEN/WHEN/THEN durchgängig spezifisch |
| L-2: Architecture Alignment | PASS | Architecture-Sections korrekt referenziert: "Migration Map" (Zeile `prompts.py:17-82` Rewrite), "System-Prompt Composition" (Block-Reihenfolge), "Frontend State Machine Wiring" (FSM-States `idle/interviewing/summarizing/reviewing/refining`), Open Questions Q1 + Q8, Risks "LLM never reaches semantic confidence". Tool-Namen (`emit_intent_summary`, `set_slot_role`) stimmen mit Architecture-LangGraph-Tool-Schema-Tabelle überein. FSM-State-Liste exakt (`generating` wird Frontend-side gesetzt — korrekt aus Architecture übernommen). |
| L-3: Contract Konsistenz | PASS | Requires-From: Slice 11 bietet `build_assistant_system_prompt(image_model_id, generation_mode, project_context)` — geprüft in Slice 11 AC-1. `_BASE_PROMPT`/`SYSTEM_PROMPT` als bestehende Module-Konstanten verifiziert. Provides-To: `slice-13-emit-intent-summary-tool` (Tool-Name nur Erwähnung), `slice-14-fsm-state-extension`, `slice-15-sse-flow-state-events`, `slice-25-multi-reference-eval` — alle als Verhaltens-Verträge formuliert (kein Code-Interface, was korrekt ist da Slice nur Prompt-String ändert). |
| L-4: Deliverable-Coverage | PASS | Einziges Deliverable (`_BASE_PROMPT` Rewrite in `prompts.py`) deckt alle ACs ab: AC-1 Pflicht-Phrasen direkt im String; AC-2..AC-6 Verhaltensregeln im String formuliert; AC-7 Längen-Bounds des Strings; AC-9 unverändertes Composition-Gerüst aus Slice 11; AC-10 SYSTEM_PROMPT-Alias bleibt. Test-Files explizit ausserhalb Deliverables — korrekt (Test-Writer-Agent erstellt sie). |
| L-5: Discovery Compliance | PASS | Discovery Slice E (System-Prompt-Redesign) + Slice K (Multi-Reference-Interview) korrekt umgesetzt. Business Rule "Zwischen-Checks während des Interviews lösen niemals Apply oder Generate aus" → AC-4 + Constraints Pflicht-Inhalt #5 (FSM-Transitions). Business Rule "Sequenzielles Multi-Reference-Interview" → AC-5 + Constraints Pflicht-Inhalt #5 (Multi-Reference-Regeln). DE-Chat / EN-Prompt → AC-1 Pflicht-Phrasen. Semantic-Confidence-Stop → AC-1 + Constraints Pflicht-Phrase `"semantisch"`/`"semantic"`. Pflicht-Achsen Subject/Style/Zweck → AC-3. |
| L-6: Consumer Coverage | PASS (mit Hinweis) | Consumers von `_BASE_PROMPT`/`SYSTEM_PROMPT` im Backend gefunden: (1) `tests/unit/test_build_assistant_prompt.py` → `build_assistant_system_prompt(None, None) == _BASE_PROMPT` und `SYSTEM_PROMPT == build_assistant_system_prompt(None, None)` — abgedeckt durch AC-9 + AC-10. (2) `tests/test_knowledge_integration.py:128` → identische Assertion — abgedeckt durch AC-9. (3) `tests/acceptance/test_slice_03_langgraph_agent.py:190-192` → prüft Tool-Namen `draft_prompt`, `analyze_image`, `recommend_model` in Prompt — abgedeckt durch Constraints Pflicht-Inhalt #4 (Tool-Catalog). (4) `tests/unit/test_agent_state.py:140-156` → prüft Substrings `deutsch` + `englisch`/`english` — abgedeckt durch AC-1 Pflicht-Phrasen `"Du sprichst Deutsch"` + `"Englisch"`. (5) `test_agent_state.py:166` `assert "fragebogen" in prompt_lower` — bleibt bestehen, da Constraints Pflicht-Inhalt #1 die Phrase "Fragebogen-Bot" zulässt. (6) `test_slice_08_assistant_backend_tools.py` + `test_prompt_tools_simplified.py` → prüfen `"prompt"`-Keyword-Existenz und Single-Prompt-Field-Output — Constraints Pflicht-Inhalt #6 (PROMPT-ERSTELLUNG, "Tool-Argument muss EXAKT mit Chat-Antwort übereinstimmen") covered. **Hinweis (nicht-blockend):** `test_agent_state.py:171-196` prüft Substrings `"motiv"/"subjekt"`, `"stil"`, `"zweck"` (alte Pflicht-Achsen-Bezeichnung). Neue Pflicht-Achsen heissen "Subject" / "Style" / "Zweck" — `"zweck"` bleibt, aber `"motiv"` und `"stil"` als Substrings gehen verloren (`"subject"` enthält nicht `"motiv"` und `"style"` enthält nicht `"stil"`). Diese Tests werden brechen. Slice AC-10 erwähnt nur `"kein Fragebogen"` als Breakage. Architecture-Vermerk "Tests update if relying on phrase `kein Fragebogen`" deckt streng genommen nur die eine Phrase ab. **Empfehlung:** Test-Writer-Agent oder Implementer sollte alte Slice-03-Acceptance-Tests beim Rewrite mit-aktualisieren; die Architecture macht klar dass dies ein Major-Rewrite ist und alte Achsen-Bezeichnungen ersetzt werden. Da diese Tests fachlich obsolet werden (alte Pflicht-Achsen-Liste ≠ neue Pflicht-Achsen-Liste), ist ihr Aufweichen erwartbar und kein Blocker. |

---

## Verdict

**VERDICT: APPROVED**

**Blocking Issues:** 0

**Hinweise (nicht-blockend):**
- L-6: Bestehende Tests in `backend/tests/unit/test_agent_state.py` (`test_system_prompt_must_haves_motiv`, `test_system_prompt_must_haves_stil`) werden nach dem Rewrite vermutlich brechen, da die alten Substring-Tokens `"motiv"`/`"stil"` durch `"Subject"`/`"Style"` ersetzt werden. Slice AC-10 erwähnt explizit nur `"kein Fragebogen"` als bekannte Bruch-Stelle. Empfehlung an Implementer/Test-Writer: ältere Slice-03/08-Acceptance-Tests beim Rewrite mit anpassen (oder mindestens FAIL-Reason dokumentieren). Dies ist erwartbares Outfall eines Major-Rewrites und blockt diesen Slice nicht.
