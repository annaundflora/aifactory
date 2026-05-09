# Slice 28: Session-Resume mit FSM-Hydrate

> **Slice 28 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-28-session-resume-flow-state` |
| **Test** | `pnpm vitest run lib/assistant/__tests__/assistant-context-hydrate.test.tsx` |
| **E2E** | `true` |
| **Dependencies** | `["16-intent-summary-card-component"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

> **Quelle:** Auto-detected — TypeScript/Next.js + React-Testing-Library + vitest (Frontend Hydrate-Reducer); Python/FastAPI + pytest (DTO-Roundtrip falls noch nötig); Playwright für E2E Reload-Test. Slice 14 hat `SessionStateDTO.flow_state` und `SessionStateDTO.intent_axes` bereits eingeführt — dieser Slice prüft die Felder im Resume-Endpoint und ergänzt sie nur, falls Slice 14 sie noch nicht erfasst hatte.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs + python-fastapi + langgraph` |
| **Test Command** | `pnpm vitest run lib/assistant/__tests__/assistant-context-hydrate.test.tsx` |
| **Integration Command** | `cd backend && python -m pytest tests/integration/test_session_detail_resume.py -v` |
| **Acceptance Command** | `pnpm playwright test e2e/assistant-session-resume.spec.ts` |
| **Start Command** | `pnpm dev` (FE) + `cd backend && uvicorn app.main:app --reload` (BE) |
| **Health Endpoint** | `GET http://localhost:8000/health` |
| **Mocking Strategy** | `mock_external` — LLM-Calls werden NICHT ausgelöst (Hydrate liest nur Checkpointer-State); Backend-Tests nutzen Postgres-Test-Fixture (kein OpenRouter), Frontend-Tests mocken `fetch('/api/assistant/sessions/{id}')` |

---

## Ziel

`GET /api/assistant/sessions/{id}` liefert `flow_state` und `intent_axes` (plus `final_intent` falls vorhanden) aus dem persistierten LangGraph-State. Beim Session-Reload dispatcht der Frontend-Hydrate-Effekt `SET_FLOW_STATE` und — wenn `flow_state === "summarizing"` — `RENDER_INTENT_SUMMARY` mit dem persistierten Intent-Payload, sodass die `IntentSummaryCard` mit identischem Inhalt erneut gerendert wird (canonical FSM-Source: Backend-LangGraph-State, siehe architecture.md → Section "Frontend State Machine Wiring", Zeile "Resume on session reload").

---

## Acceptance Criteria

1) **GIVEN** eine persistierte Session, deren LangGraph-Checkpointer-State `flow_state="summarizing"`, `intent_axes={"subject":"moody library","style":"dark academia"}` und `final_intent={"prompt":"...","settings_diff":null,"model_id":null}` enthält
   **WHEN** der Client `GET /api/assistant/sessions/{id}` aufruft
   **THEN** ist die Response `state.flow_state === "summarizing"` und `state.intent_axes` 1:1 das persistierte Dict; `final_intent` darf entweder im DTO mitgeführt werden ODER über das bestehende SessionStateDTO-Feld erreichbar sein, sodass das Frontend den Intent-Payload für `RENDER_INTENT_SUMMARY` rekonstruieren kann (Detail-Mapping → architecture.md → Section "Frontend State Machine Wiring" / "Resume on session reload" und DTO `SessionStateDTO`).

2) **GIVEN** eine ältere persistierte Session ohne `flow_state`/`intent_axes`/`final_intent` (Pre-Slice-14-Checkpoint, simuliert durch Direct-State-Write)
   **WHEN** `GET /api/assistant/sessions/{id}` aufgerufen wird
   **THEN** liefert das Backend `state.flow_state === "idle"` und `state.intent_axes === {}` (Defaults aus `DEFAULT_STATE_VALUES`); kein 500-Error, keine ValidationError; bestehende Felder (`messages`, `draft_prompt`, `recommended_model`) bleiben unverändert.

3) **GIVEN** der Frontend-Hydrate-Pfad in `loadSession` von `lib/assistant/assistant-context.tsx` (siehe Section `loadSession` ab Zeile 425) UND eine Session-Detail-Response mit `state.flow_state === "interviewing"`
   **WHEN** `loadSession(sessionId)` resolved
   **THEN** dispatcht der Hydrate-Effekt zusätzlich zur bestehenden `LOAD_SESSION`-Action genau eine `SET_FLOW_STATE`-Action mit `flowState: "interviewing"`. Der Reducer-State ist nach Settle: `flowState === "interviewing"`, `intentSummaryPayload === undefined`, bestehende Felder (`sessionId`, `messages`, `draftPrompt`) wie von `LOAD_SESSION` gesetzt.

4) **GIVEN** eine Session-Detail-Response mit `state.flow_state === "summarizing"` UND `state.final_intent` enthält ein gültiges Payload-Objekt (mit `prompt`, optional `settings_diff`, `model_id`) UND `state.intent_axes` ist gefüllt
   **WHEN** `loadSession(sessionId)` resolved
   **THEN** dispatcht der Hydrate-Effekt **zwei** Actions in dieser Reihenfolge: (1) `SET_FLOW_STATE` mit `"summarizing"`, (2) `RENDER_INTENT_SUMMARY` mit Payload `{ axes: state.intent_axes, prompt_preview: state.final_intent.prompt, settings_diff: state.final_intent.settings_diff }` (Field-Mapping gemäss architecture.md → `IntentSummaryPayload` DTO; `model_id` wird verworfen, da `IntentSummaryPayload` ihn nicht trägt).

5) **GIVEN** der Reducer-State nach Hydrate aus AC-4 (`flowState === "summarizing"`, `intentSummaryPayload` gesetzt) UND der Chat-Thread aus Slice 16 ist gemountet
   **WHEN** `chat-thread.tsx` re-rendert
   **THEN** wird `<IntentSummaryCard>` exakt einmal inline gemountet; ihre Inhalte (Axes-Liste, Prompt-Preview, Buttons) entsprechen 1:1 dem persistierten `final_intent` und `intent_axes` (kein Diff zum Pre-Reload-Zustand). Frozen-State-Logik (History-Erhalt) aus Slice 16 bleibt verantwortlich; dieser Slice rekonstruiert nur das Render-Trigger-Tupel `(flowState, intentSummaryPayload)`.

6) **GIVEN** eine Session-Detail-Response mit `state.flow_state === "summarizing"` ABER `state.final_intent === null` (Edge-Case: emit_intent_summary-Tool wurde nie aufgerufen, FSM aber via Tool-Mapping-Fehler in `summarizing`)
   **WHEN** `loadSession` resolved
   **THEN** dispatcht der Hydrate-Effekt nur `SET_FLOW_STATE("summarizing")`, KEIN `RENDER_INTENT_SUMMARY` (Defensive Fallback). Frontend logged eine `console.warn`-Meldung. Card wird nicht gemountet (Slice 16 AC-8: kein Mount ohne Payload).

7) **GIVEN** ein unbekannter `flow_state`-Wert in der Response (z.B. `"foobar"`, ein veralteter Wert)
   **WHEN** `loadSession` resolved
   **THEN** dispatcht der Hydrate-Effekt KEIN `SET_FLOW_STATE` (Validation auf Whitelist `idle | interviewing | summarizing | reviewing | refining | generating`); Reducer-State `flowState` bleibt auf dem Initial-Wert `"idle"` (oder dem Wert vor Hydrate); `console.warn` wird gerufen — analog zu Slice 15 AC-9.

8) **GIVEN** ein Playwright-Setup: User führt das Interview bis zur Intent-Summary-Card, klickt KEINEN Button (FSM bleibt `summarizing`), User triggert harten Page-Reload (`page.reload()`)
   **WHEN** die Seite re-hydrated und der Assistant-Panel die zuletzt aktive Session wieder lädt
   **THEN** ist die `IntentSummaryCard` erneut sichtbar mit identischem Prompt-Preview und identischen Axes; FSM-State ist `"summarizing"`; "So generieren"- und "Nochmal diskutieren"-Buttons sind aktiv (nicht frozen, da kein Click vor Reload erfolgte). Done-Signal aus `slim-slices.md`.

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Test-Writer implementiert die Assertions.

### Test-Datei: `backend/tests/integration/test_session_detail_resume.py`

<test_spec>
```python
import pytest

# AC-1: GET /sessions/{id} liefert flow_state + intent_axes aus Checkpointer-State
@pytest.mark.skip(reason="AC-1")
async def test_get_session_returns_flow_state_summarizing_with_intent_axes():
    ...

# AC-1: final_intent ist über Response erreichbar (entweder im DTO oder via state-Mapping)
@pytest.mark.skip(reason="AC-1")
async def test_get_session_exposes_final_intent_for_resume():
    ...

# AC-2: Pre-Slice-14-Checkpoint ohne FSM-Felder → Defaults statt Error
@pytest.mark.skip(reason="AC-2")
async def test_get_session_returns_defaults_for_legacy_checkpoint():
    ...
```
</test_spec>

### Test-Datei: `lib/assistant/__tests__/assistant-context-hydrate.test.tsx`

<test_spec>
```typescript
// AC-3: Hydrate dispatcht SET_FLOW_STATE für non-summarizing flow_state
it.todo('dispatches SET_FLOW_STATE("interviewing") on loadSession when state.flow_state is "interviewing"');

// AC-4: Hydrate dispatcht SET_FLOW_STATE + RENDER_INTENT_SUMMARY in dieser Reihenfolge
it.todo('dispatches SET_FLOW_STATE("summarizing") then RENDER_INTENT_SUMMARY when final_intent + intent_axes present');

// AC-4: Field-Mapping final_intent → IntentSummaryPayload
it.todo('maps final_intent.prompt to prompt_preview and intent_axes to axes; drops model_id');

// AC-6: summarizing aber final_intent === null → kein RENDER_INTENT_SUMMARY, console.warn
it.todo('dispatches only SET_FLOW_STATE and warns when flow_state=summarizing without final_intent');

// AC-7: Unbekannter flow_state → kein Dispatch, console.warn
it.todo('does not dispatch SET_FLOW_STATE for unknown flow_state value, warns');
```
</test_spec>

### Test-Datei: `e2e/assistant-session-resume.spec.ts`

<test_spec>
```typescript
// AC-5 + AC-8: Interview bis Summary → Reload → IntentSummaryCard sichtbar mit gleichem Inhalt
test.describe.skip('AC-5/AC-8: session resume re-renders IntentSummaryCard', () => {
  test.fixme('renders IntentSummaryCard with identical content after page.reload while flowState=summarizing');
});
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-14-fsm-state-extension` | `SessionStateDTO.flow_state: str` (default `"idle"`) + `SessionStateDTO.intent_axes: dict` | Pydantic Field | Inspect `SessionStateDTO.model_fields`; AC-2 verifies legacy default behaviour |
| `slice-14-fsm-state-extension` | `PromptAssistantState.final_intent: dict \| None` als persistiertes Checkpointer-Feld | LangGraph state | AC-1 liest `final_intent` aus Checkpointer-Roundtrip |
| `slice-15-sse-flow-state-events` | Reducer-Actions `SET_FLOW_STATE` und `RENDER_INTENT_SUMMARY`; Reducer-Field `flowState` (Default `"idle"`) und `intentSummaryPayload` | Reducer Action + State-Field | AC-3..AC-7: Hydrate-Effekt dispatcht ausschliesslich vorhandene Actions, fügt KEINE neuen Actions hinzu |
| `slice-16-intent-summary-card-component` | `<IntentSummaryCard>`-Mount-Trigger via `flowState === "summarizing"` + `intentSummaryPayload` (siehe Slice 16 AC-1) | Component | AC-5 verifiziert Re-Render nach Hydrate |
| existing | `loadSession`-Hydrate-Effekt (`lib/assistant/assistant-context.tsx:425`) | Hook callback | AC-3..AC-7: Hydrate wird erweitert, nicht ersetzt |
| existing | `GET /api/assistant/sessions/{id}` Route + `_service.get_session_state()` (`backend/app/routes/sessions.py:74-97`) | FastAPI Route + Service | AC-1/AC-2: Route reicht erweitertes SessionStateDTO durch |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Resume-fähige FSM-Hydrate für `flowState` + `intentSummaryPayload` | Reducer-Side-Effect in `loadSession` | -- (letzter Slice — UX-Polish, keine nachgelagerten Slices) | `loadSession(sessionId: string): Promise<void>` mit erweitertem Side-Effect |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/routes/sessions.py` — Edit (defensiv): SessionStateDTO-Response um `flow_state`/`intent_axes` ergänzen, **falls** Slice 14 sie noch nicht im DTO erfasst hat. Sicherstellen, dass `final_intent` für AC-1 über die Response erreichbar ist (z.B. zusätzliches optionales Feld am DTO oder im bestehenden state-Mapping); KEINE neuen Routen, KEINE Logik-Änderungen am Service.
- [ ] `lib/assistant/assistant-context.tsx` — Edit: `loadSession`-Hydrate-Effekt (ab Zeile 425) um Dispatches `SET_FLOW_STATE` + (conditional) `RENDER_INTENT_SUMMARY` erweitern; `SessionDetailState`-Interface (ab Zeile 44) um `flow_state?`, `intent_axes?`, `final_intent?` ergänzen; Whitelist-Validation für `flow_state`; defensive Fallbacks gemäss AC-6/AC-7.
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.
> **Mount-Point:** `<IntentSummaryCard>` wird bereits in Slice 16 in `chat-thread.tsx` gemountet — keine zusätzliche Mount-Edit nötig.

---

## Constraints

**Scope-Grenzen:**
- KEIN neuer SSE-Event-Typ (Resume ist ein Pull-Pfad via `GET /sessions/{id}`, kein Push).
- KEINE Änderung an `emit_intent_summary` Tool oder `TOOL_STATE_MAPPING`.
- KEINE Änderung an `<IntentSummaryCard>`-Komponente selbst — sie konsumiert nur den hydrierten Reducer-State.
- KEINE Änderung am `loadSession`-Public-API (Signature bleibt `(sessionId: string) => Promise<void>`).
- KEINE Persistierung des Frontend-`isApplied`-Flags (out of scope; bleibt Session-flüchtig).
- KEINE neuen Reducer-Actions — Slice 15 hat `SET_FLOW_STATE` und `RENDER_INTENT_SUMMARY` bereits eingeführt.
- KEINE Änderung am `flow_state`-Schreibpfad (`emit_intent_summary` setzt `summarizing`, `applyToWorkspace`-Click-Handler setzt `generating`); dieser Slice ist read-only.

**Technische Constraints:**
- Hook-Konsum im Frontend ausschliesslich via `usePromptAssistant()` (NICHT `useAssistantContext`).
- Whitelist für `flow_state` strikt: `idle | interviewing | summarizing | reviewing | refining | generating`. Unbekannte Werte → kein Dispatch + `console.warn` (analog Slice 15 AC-9).
- `final_intent → IntentSummaryPayload`-Mapping: 1:1-Übernahme der Felder `prompt → prompt_preview`, `settings_diff → settings_diff` (optional), `axes → state.intent_axes`. `model_id` wird verworfen, da `IntentSummaryPayload` (architecture.md → DTOs) ihn nicht trägt.
- Backend-DTO-Erweiterung MUSS abwärtskompatibel sein: Defaults `flow_state="idle"`, `intent_axes={}`, `final_intent=None` für Legacy-Checkpoints (kein 500/422 für alte Sessions, AC-2).

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `backend/app/routes/sessions.py` (Route Handler `get_session`) | Edit (defensiv) — Schema-Forwarding ergänzen, kein Service-Refactor |
| `backend/app/services/assistant_service.py` → `get_session_state` | Unverändert konsumiert; reicht bereits den vollständigen Checkpointer-State durch (Slice 14 hat dort keine Änderung verlangt) |
| `backend/app/models/dtos.py` → `SessionStateDTO` | Unverändert importiert; ggf. minimale Ergänzung wenn Slice 14 `final_intent` nicht abgedeckt hat |
| `lib/assistant/assistant-context.tsx` → `loadSession` (Zeile 425) | Edit — bestehender Effekt wird erweitert, NICHT neu gebaut |
| `lib/assistant/assistant-context.tsx` → Reducer-Actions `SET_FLOW_STATE`, `RENDER_INTENT_SUMMARY` | Import + Dispatch — vollständig aus Slice 15 wiederverwendet |
| `components/assistant/intent-summary-card.tsx` (Slice 16) | Unverändert konsumiert — re-mountet automatisch wenn Reducer-State `(flowState, intentSummaryPayload)` rekonstruiert ist |
| `components/assistant/chat-thread.tsx` (Slice 16) | Unverändert — Render-Branch aus Slice 16 reagiert ausschliesslich auf Reducer-State |

**Referenzen:**
- Architecture: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/architecture.md` → Section "Frontend State Machine Wiring" → Zeile "Resume on session reload"
- Architecture: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/architecture.md` → DTO-Tabelle → `SessionStateDTO` (extended) und `IntentSummaryPayload`
- Architecture: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/architecture.md` → Risks/Assumptions → "LangGraph state propagation via SSE works for `flow_state` mid-turn" (Polling/Resume als Fallback bestätigt)
- Discovery: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/discovery.md` → Open Question #5 (Concurrent-Generation block — verifiziert, dass FSM nach Reload korrekt im `summarizing`-State landet)
- Wireframes: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/wireframes.md` → Section "Intent Summary Card" → State `rendered` (re-render nach Reload entspricht diesem State)
- Slim-Slices: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/slices/slim-slices.md` → Slice 28 Done-Signal
