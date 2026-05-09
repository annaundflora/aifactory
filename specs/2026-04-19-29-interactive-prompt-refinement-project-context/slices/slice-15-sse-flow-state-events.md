# Slice 15: SSE-Events `flow-state` + `intent-summary`

> **Slice 15 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-15-sse-flow-state-events` |
| **Test** | `pnpm test lib/assistant/__tests__/use-assistant-runtime.test.ts && cd backend && python -m pytest tests/unit/test_assistant_service_sse.py -v` |
| **E2E** | `false` |
| **Dependencies** | `["14-fsm-state-extension"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

> **Quelle:** Auto-detected — Cross-stack Slice. Backend = Python/FastAPI + LangGraph (pytest gegen `AssistantService.stream_response` mit gemocktem Graph). Frontend = TypeScript/Next.js + Vitest gegen den SSE-Handler in `use-assistant-runtime.ts` und den Reducer in `assistant-context.tsx` (jsdom + Mock-`Response`-Stream). Kein E2E — der UI-Render der Card erfolgt in Slice 16.

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi + langgraph (backend) + typescript-nextjs + vitest (frontend)` |
| **Test Command** | `pnpm test lib/assistant/__tests__/use-assistant-runtime.test.ts lib/assistant/__tests__/assistant-context.test.ts && cd backend && python -m pytest tests/unit/test_assistant_service_sse.py -v` |
| **Integration Command** | `pnpm test lib/assistant && cd backend && python -m pytest tests/integration/test_sse_flow_state_stream.py -v` |
| **Acceptance Command** | (siehe Test Command + Integration Command) |
| **Start Command** | `pnpm dev` (Frontend) + `cd backend && uvicorn app.main:app --reload` |
| **Health Endpoint** | `GET http://localhost:8000/health` |
| **Mocking Strategy** | `mock_external` — Frontend mockt `Response.body.getReader` (siehe bestehende Patterns in `use-assistant-runtime.test.ts`); Backend mockt LangGraph-Stream (`self._agent.astream_events`) und treibt damit `AssistantService.stream_response` |

---

## Ziel

Zwei neue SSE-Event-Typen verdrahten: `flow-state` bei jedem Backend-FSM-Übergang und `intent-summary` bei `emit_intent_summary`-Tool-Call. Frontend-SSE-Handler erweitern, neue Reducer-Actions `SET_FLOW_STATE` + `RENDER_INTENT_SUMMARY` einführen. Damit ist die Brücke zwischen LangGraph-State (Slice 14) und Frontend-FSM-Mirror gebaut — Voraussetzung für die IntentSummaryCard (Slice 16).

---

## Acceptance Criteria

1) **GIVEN** `AssistantService.stream_response` läuft mit einer Session, deren LangGraph-State `flow_state` von `"idle"` auf `"interviewing"` wechselt
   **WHEN** der SSE-Stream konsumiert wird
   **THEN** wird genau ein SSE-Event mit `event: flow-state` und `data: {"flow_state": "interviewing"}` ausgegeben (Wire-Format laut architecture.md → "Frontend State Machine Wiring", `FlowStateEvent`-Payload-Schema). Mehrfach-Emits für denselben Wert werden unterdrückt (nur bei tatsächlichem Übergang).

2) **GIVEN** der LangGraph-Lauf ruft das `emit_intent_summary`-Tool mit gültigem Payload auf (siehe Slice 13)
   **WHEN** der Tool-Result-Branch im AssistantService verarbeitet wird
   **THEN** werden in dieser Reihenfolge drei SSE-Events emittiert: `tool-call-result` (existing, mit `tool: "emit_intent_summary"`), `intent-summary` (NEW, mit `data` entsprechend `IntentSummaryPayload` aus architecture.md → DTOs: `axes`, `prompt_preview`, `settings_diff?`), `flow-state` (NEW, mit `flow_state: "summarizing"`).

3) **GIVEN** der `intent-summary`-Event-Payload wird gebaut
   **WHEN** der Tool-Aufruf weder `settings_diff` noch leeres `settings_diff` enthält
   **THEN** wird das Feld `settings_diff` aus dem JSON weggelassen (nicht `null` gesendet) — entspricht Wireframe-State `no_settings_diff`. Wenn `settings_diff` Sub-Arrays mit Einträgen enthält, wird es 1:1 als `SettingsDiff`-Schema (architecture.md → `SettingsDiff` Type Schema) durchgereicht.

4) **GIVEN** das `axes`-Objekt im `intent-summary`-Payload enthält Werte
   **WHEN** ein Achse-String länger als 200 Zeichen ist
   **THEN** schlägt der Payload-Build mit einem definierten Pydantic-Validation-Error fehl, der serverseitig als `error`-SSE-Event (existing) propagiert wird; der Stream beendet sauber. Kein malformed `intent-summary`-Event wird gesendet.

5) **GIVEN** der Frontend-SSE-Handler in `use-assistant-runtime.ts` empfängt ein Event `event: flow-state\ndata: {"flow_state":"summarizing"}`
   **WHEN** das Event geparst wird
   **THEN** dispatcht der Handler genau eine Reducer-Action `{ type: "SET_FLOW_STATE", flowState: "summarizing" }` und keine anderen Actions.

6) **GIVEN** der Frontend-SSE-Handler empfängt ein Event `event: intent-summary\ndata: {<IntentSummaryPayload>}`
   **WHEN** das Event geparst wird
   **THEN** dispatcht der Handler genau eine Reducer-Action `{ type: "RENDER_INTENT_SUMMARY", payload: <IntentSummaryPayload> }`. Die Felder `axes`, `prompt_preview`, `settings_diff?` werden 1:1 aus dem SSE-`data`-Payload übernommen (kein Field-Mapping, keine snake_case→camelCase-Transformation außer den im Wire-Schema bereits vereinbarten Feldnamen).

7) **GIVEN** der Reducer in `assistant-context.tsx` empfängt `{ type: "SET_FLOW_STATE", flowState: "interviewing" }`
   **WHEN** der Reducer angewendet wird
   **THEN** ist das State-Feld `flowState` auf `"interviewing"` gesetzt; bestehende Felder (z.B. `messages`, `draftPrompt`, `sessionId`) bleiben unverändert. Initialwert von `flowState` im Reducer-Initial-State ist `"idle"`.

8) **GIVEN** der Reducer empfängt `{ type: "RENDER_INTENT_SUMMARY", payload: <IntentSummaryPayload> }`
   **WHEN** der Reducer angewendet wird
   **THEN** ist ein neues State-Feld `intentSummaryPayload` mit dem Payload-Objekt belegt; ein erneutes `RENDER_INTENT_SUMMARY` ersetzt den vorherigen Wert (idempotenter Re-Render möglich).

9) **GIVEN** ein unbekannter `flow_state`-String (z.B. `"unknown_phase"`) erreicht den Frontend-Handler
   **WHEN** das Event geparst wird
   **THEN** wird der Wert verworfen und kein `SET_FLOW_STATE` dispatcht; ein `console.warn` wird geloggt. Whitelist (Frontend-side Validation per Slice-14-Constraints): `idle | interviewing | summarizing | reviewing | refining | generating`.

10) **GIVEN** ein malformed JSON-Payload für `intent-summary` (fehlendes `prompt_preview` oder `axes` ist kein Object)
    **WHEN** das Event geparst wird
    **THEN** wird der Handler defensiv: kein Dispatch, ein `console.warn` mit der Event-Quelle wird geloggt, der Stream-Konsum läuft weiter (kein Throw). Konsistent mit dem bestehenden Pattern in `handleSSEEvent` (`use-assistant-runtime.ts:217-222`).

---

## Test Skeletons

> Test-Writer-Agent implementiert die Assertions; Skeletons referenzieren ACs.

### Test-Datei: `backend/tests/unit/test_assistant_service_sse.py`

<test_spec>
```python
import pytest

# AC-1: flow-state event emitted on backend FSM transition (idle -> interviewing)
@pytest.mark.skip(reason="AC-1")
async def test_flow_state_event_emitted_on_idle_to_interviewing_transition():
    ...

@pytest.mark.skip(reason="AC-1")
async def test_flow_state_event_not_re_emitted_for_same_value():
    ...

# AC-2: tool-call-result -> intent-summary -> flow-state ordering on emit_intent_summary
@pytest.mark.skip(reason="AC-2")
async def test_emit_intent_summary_produces_three_events_in_order():
    ...

# AC-3: settings_diff omitted when empty / present when populated
@pytest.mark.skip(reason="AC-3")
async def test_intent_summary_omits_settings_diff_when_empty():
    ...

@pytest.mark.skip(reason="AC-3")
async def test_intent_summary_includes_settings_diff_when_populated():
    ...

# AC-4: axis > 200 chars yields error SSE event, no intent-summary
@pytest.mark.skip(reason="AC-4")
async def test_axis_too_long_produces_error_event_not_intent_summary():
    ...
```
</test_spec>

### Test-Datei: `lib/assistant/__tests__/use-assistant-runtime.test.ts`

<test_spec>
```typescript
import { describe, it } from "vitest";

describe("SSE flow-state event handling", () => {
  // AC-5: flow-state event dispatches SET_FLOW_STATE
  it.todo("AC-5: dispatches SET_FLOW_STATE on flow-state event with whitelisted value");

  // AC-9: invalid flow_state value is rejected
  it.todo("AC-9: ignores flow-state event with unknown flowState value and warns");
});

describe("SSE intent-summary event handling", () => {
  // AC-6: intent-summary event dispatches RENDER_INTENT_SUMMARY with full payload
  it.todo("AC-6: dispatches RENDER_INTENT_SUMMARY with axes + prompt_preview + settings_diff");

  it.todo("AC-6: dispatches RENDER_INTENT_SUMMARY with axes + prompt_preview when settings_diff omitted");

  // AC-10: malformed payload silently ignored
  it.todo("AC-10: ignores intent-summary event with missing prompt_preview and warns");
});
```
</test_spec>

### Test-Datei: `lib/assistant/__tests__/assistant-context.test.ts`

<test_spec>
```typescript
import { describe, it } from "vitest";

describe("assistantReducer — SET_FLOW_STATE", () => {
  // AC-7: reducer applies flowState; other fields untouched
  it.todo("AC-7: SET_FLOW_STATE updates flowState field only");

  it.todo("AC-7: initial state has flowState = 'idle'");
});

describe("assistantReducer — RENDER_INTENT_SUMMARY", () => {
  // AC-8: payload stored; idempotent replace
  it.todo("AC-8: RENDER_INTENT_SUMMARY sets intentSummaryPayload");

  it.todo("AC-8: subsequent RENDER_INTENT_SUMMARY replaces previous payload");
});
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-14-fsm-state-extension` | `PromptAssistantState.flow_state`, `intent_axes`, `final_intent` als TypedDict-Felder; `DEFAULT_STATE_VALUES["flow_state"] == "idle"` | LangGraph state schema | AC-1 + AC-2 lesen `state["flow_state"]` und `state["final_intent"]` direkt; nicht aufrufbar, wenn Schema nicht erweitert ist |
| `slice-13-emit-intent-summary-tool` | `emit_intent_summary`-Tool registriert; `TOOL_STATE_MAPPING["emit_intent_summary"] = "summarizing"`; `final_intent`-Persist im `post_process_node` | LangGraph tool + node hook | Slice 13 AC-6 verifiziert; Slice 15 AC-2 baut darauf auf |
| (existing) | `AssistantService.stream_response` (async) + `_convert_event` mit bestehendem `tool-call-result`-Branch | service emitter | Existing implementation in `assistant_service.py:117` (stream_response) und `assistant_service.py:267-308` (_convert_event, tool-call-result-Branch in 305-308) |
| (existing) | Frontend `parseSSEEvents` + `handleSSEEvent`-Switch in `use-assistant-runtime.ts:149-216` | hook | Existing |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| SSE event `flow-state` | wire event (`event: flow-state\ndata: {"flow_state": str}`) | Slice 17 (Auto-Apply Handler liest `flowState` aus Reducer), Slice 28 (Resume-Hydrate kann optional zusätzlich Initial-Event nachreichen) | Whitelist-Werte: `idle | interviewing | summarizing | reviewing | refining` (backend); `generating` wird nur frontend-side gesetzt (architecture.md → Q7) |
| SSE event `intent-summary` | wire event mit `IntentSummaryPayload` | Slice 16 (IntentSummaryCard), Slice 28 (Resume re-render) | Schema: `{ axes: { subject?, medium?, style?, lighting?, composition?, palette? }, prompt_preview: string, settings_diff?: SettingsDiff }` |
| Reducer-Action `SET_FLOW_STATE` | `{ type: "SET_FLOW_STATE", flowState: FlowState }` | Slice 17, Slice 18, Slice 28 | `FlowState = "idle" \| "interviewing" \| "summarizing" \| "reviewing" \| "refining" \| "generating"` |
| Reducer-Action `RENDER_INTENT_SUMMARY` | `{ type: "RENDER_INTENT_SUMMARY", payload: IntentSummaryPayload }` | Slice 16 | siehe IntentSummaryPayload-Schema oben |
| Reducer-State-Feld `flowState` | `FlowState` (default `"idle"`) | Slice 16 (mountet Card bei `flowState === "summarizing"`), Slice 17 | Reducer-Selector |
| Reducer-State-Feld `intentSummaryPayload` | `IntentSummaryPayload \| null` (default `null`) | Slice 16 | Reducer-Selector |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/services/assistant_service.py` — Edit: zwei neue SSE-Emit-Pfade in `stream_response` (Zeile 117) bzw. `_convert_event` (Zeile 267-308). (a) `flow-state`-Emitter beobachtet State-Übergänge und sendet `event: flow-state\ndata: {"flow_state": <new>}` mit Dedup gegen den letzten gesendeten Wert (Hook im `astream_events`-Loop in `stream_response` ab Zeile 175 ODER neuer Branch in `_convert_event` für `on_chain_end`/`on_chat_model_end`-Events, die State-Snapshots liefern). (b) `intent-summary`-Emitter wird im `tool-call-result`-Branch von `_convert_event` (Zeilen 305-308) für `tool_name == "emit_intent_summary"` aktiviert und baut das `IntentSummaryPayload` aus dem Tool-Output (`prompt`, `axes`, `settings_diff?`) → emittiert `event: intent-summary` direkt nach dem bestehenden `tool-call-result`. Da `_convert_event` aktuell nur ein Event pro Aufruf zurückgibt, MUSS entweder die Signatur auf `Iterable[dict]` erweitert oder die Emit-Logik zusätzlich in `stream_response` (nach `yield sse_event`) geführt werden — Implementer wählt. Pydantic-Validation für Axes-Length (≤200) MUSS über die `IntentSummaryPayload`-Pydantic-Klasse aus `dtos.py` (existing aus Slice 13/14) laufen.
- [ ] `lib/assistant/use-assistant-runtime.ts` — Edit: zwei neue `case`-Branches in `handleSSEEvent` (zwischen Zeile 154-216): `case "flow-state"` (parsed Payload, Whitelist-Validierung, Dispatch `SET_FLOW_STATE`) und `case "intent-summary"` (parsed Payload, Strukturvalidierung auf `axes` + `prompt_preview`, Dispatch `RENDER_INTENT_SUMMARY`). Zusätzlich zwei neue `interface SSEFlowStateEvent` + `interface SSEIntentSummaryEvent` zu den existierenden SSE-Type-Aliases ergänzen.
- [ ] `lib/assistant/assistant-context.tsx` — Edit: (a) `AssistantState`-Interface um `flowState: FlowState` (default `"idle"`) und `intentSummaryPayload: IntentSummaryPayload | null` (default `null`) erweitern. (b) `AssistantAction`-Union um `SET_FLOW_STATE` und `RENDER_INTENT_SUMMARY` erweitern. (c) Reducer-Branches für beide Actions ergänzen. (d) Type-Aliases `FlowState`, `IntentSummaryPayload`, `SettingsDiff` definieren oder aus einem neuen Sub-Modul `lib/assistant/types.ts` importieren — Implementer entscheidet, KEIN extra Deliverable hier nötig wenn Inline-Definition reicht.
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Card-Komponente — `IntentSummaryCard` ist Slice 16. Dieser Slice stellt nur den Daten-Pfad her.
- KEIN Frontend-seitiges `SET_FLOW_STATE("generating")`-Trigger via Click — Slice 17.
- KEIN Resume-Hydrate-Flow im Frontend — Slice 28.
- KEINE neuen SSE-Events außer `flow-state` und `intent-summary` (`paste-confirm-suggestion` = Slice 27, `slot-load-failed` = Slice 21, weitere Tool-Result-Branches für `set_slot_*` = Slice 24).
- KEIN Auto-Apply / Auto-Generate-Effekt — der Reducer setzt nur State; existing `apply`-Effekt-Pfad (`assistant-context.tsx:487-551`) bleibt unangetastet.
- KEIN `Literal`-Narrowing auf Backend-Seite für `flow_state` (Slice 14 Constraint), aber Frontend-Whitelist auf TypeScript-Union-Type-Ebene ist Pflicht (siehe Architecture → "FlowStateEvent" → enum).

**Technische Constraints:**
- Pydantic-Modell `IntentSummaryPayload` (mit Sub-Modell `IntentAxes` und Wiederverwendung des `SettingsDiff` aus Slice 13/14) wird im AssistantService instantiiert; die JSON-Serialisierung erfolgt via `model_dump(exclude_none=True, by_alias=False)` damit AC-3 (omit `settings_diff`) automatisch greift.
- Wire-Format der SSE-Events: konsistent zu existierendem Pattern in `assistant_service.py:305-308` (`{"event": "<name>", "data": <json.dumps(...)>}` als async-iterator-yield aus `stream_response`).
- `flow-state`-Emit-Hook: existing `_after_node`-Lifecycle ODER `TOOL_STATE_MAPPING`-Verarbeitung — Implementer wählt, beide Pfade sind in architecture.md → "Backend → Frontend propagation" als zulässig benannt. Dedup via In-Memory-Variable `_last_emitted_flow_state` pro Stream-Iterator.
- Frontend-SSE-Handler bleibt synchron-defensiv (try/catch um JSON.parse, früheres Pattern in Zeile 217-222) — KEIN throw bei malformed Payload.
- Reducer-Branches sind pure (kein side-effect, kein `useEffect`-Trigger im Reducer); State-Update via Spread-Pattern wie alle existierenden Branches.
- TypeScript-Type `FlowState` ist in diesem Slice Source-of-Truth für Frontend; Slice 17/28 importieren von hier.

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `backend/app/services/assistant_service.py` — `stream_response` (Zeile 117-185 Stream-Body) + `_convert_event` (Zeile 267-308, `tool-call-result`-Branch in 305-308) | EDIT: zwei neue Emit-Pfade ergänzen. Bestehender `tool-call-result`-Branch unverändert (additiv: zusätzliches `intent-summary`-Event nachschieben). |
| `backend/app/models/dtos.py` (`IntentSummaryPayload` aus Slice 14, `SettingsDiff`) | IMPORT + verwenden für Pydantic-Validation. NICHT neu definieren. |
| `lib/assistant/use-assistant-runtime.ts` (`handleSSEEvent`-Switch Zeile 149-216, `parseSSEEvents`-Helper Zeile 45) | EDIT: zwei neue `case`-Branches. Existierende Branches (`metadata`, `text-delta`, `text-done`, `tool-call-result`, `error`) NICHT ändern. |
| `lib/assistant/assistant-context.tsx` (Reducer Zeile 104-252) | EDIT: zwei neue Action-Branches additiv. Bestehende Actions (`SET_SESSION_ID`, `APPEND_ASSISTANT_DELTA`, `MARK_ASSISTANT_DONE`, `SET_DRAFT_PROMPT`, `REFINE_DRAFT`, `ADD_TOOL_CALL_RESULT`, `ADD_ERROR_MESSAGE`) unverändert. |
| `langgraph` Stream / `astream` API | Wird weiterverwendet; KEIN Wechsel auf custom Event-Bridge. |

**Referenzen:**
- Architecture → "Frontend State Machine Wiring" → `Backend → Frontend propagation` (Wire-Schema von `flow-state`-Event und Trigger-Logik).
- Architecture → "Data Transfer Objects" → `IntentSummaryPayload`, `FlowStateEvent` (Payload-Schemas + Validation-Constraints).
- Architecture → "SettingsDiff Type Schema" (Struktur des `settings_diff`-Felds; AC-3 Omit-Regel).
- Architecture → "Business Logic Flow — Assistant Turn" (Sequenz `tool-result → intent-summary → flow-state`).
- Architecture → "Open Decisions" → Q7 (Source-of-Truth für FSM = Backend-State, Frontend mirrort via SSE).
- Architecture → "Migration Map" → `lib/assistant/use-assistant-runtime.ts:154-216` (genauer Edit-Punkt).
- Architecture → "Migration Map" → `lib/assistant/assistant-context.tsx:104-252` (Reducer-Erweiterung).
