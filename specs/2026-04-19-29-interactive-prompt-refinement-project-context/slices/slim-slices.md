# Slice Decomposition

**Feature:** Interactive Prompt Refinement in Assistant with Per-Project Context
**Discovery-Slices:** 13 (A–M)
**Atomare Slices:** 28
**Stack:** TypeScript/Next.js 16 (Frontend) + Python/FastAPI + LangGraph (Backend) | Tests: vitest + playwright (FE), pytest (BE)

---

## Dependency Graph

```
Foundation (DB + System-Prompt)
─────────────────────────────────────────────────────────────────
  01-schema-migration
        │
        ├──► 02-db-queries-helpers
        │       │
        │       └──► 03-context-routes (GET/PATCH)
        │               │
        │               ├──► 04-context-server-action
        │               │
        │               ├──► 06-context-settings-page (B)
        │               │       │
        │               │       └──► 07-project-list-edit-entry (B)
        │               │       │
        │               │       └──► 08-helper-modal-route (C)
        │               │               │
        │               │               └──► 09-helper-modal-component (C)
        │               │
        │               └──► 10-no-context-banner (M)
        │
        └──► 05-project-repository-fastapi
                │
                └──► 11-prompts-context-block (D)
                        │
                        └──► 12-base-prompt-rewrite-interview (E)
                                │
                                ├──► 13-emit-intent-summary-tool (F)
                                │       │
                                │       ├──► 14-fsm-state-extension (F)
                                │       │       │
                                │       │       └──► 15-sse-flow-state-events (F)
                                │       │               │
                                │       │               └──► 16-intent-summary-card-component (F)
                                │       │                       │
                                │       │                       └──► 17-auto-apply-generate-handler (G)
                                │       │                               │
                                │       │                               └──► 18-result-image-multimodal (H)
                                │
                                ├──► 19-reference-slots-dto (I)
                                │       │
                                │       └──► 20-chat-llm-limits-module (I)
                                │               │
                                │               └──► 21-multimodal-pipeline-budget (I)
                                │                       │
                                │                       └──► 22-multimodal-indicator-ui (I)
                                │
                                ├──► 23-i2i-settings-tools (J)
                                │       │
                                │       └──► 24-slot-tool-frontend-handler (J)
                                │
                                ├──► 25-multi-reference-eval (K)
                                │
                                └──► 26-paste-detect-heuristic (L)
                                        │
                                        └──► 27-paste-detect-card-component (L)

  28-session-resume-flow-state (cross-cutting hydrate)
```

---

## Slice-Liste

### Slice 01: Schema Migration für Project-Context
- **Scope:** Drizzle-Schema um `contextInstructions` (text) und `contextUpdatedAt` (timestamptz) erweitern; Migration-File generieren.
- **Deliverables:**
  - `lib/db/schema.ts` (Edit: zwei neue Spalten in `projects`-Definition)
  - `drizzle/0015_add_project_context.sql` (NEW)
  - `drizzle/meta/0015_snapshot.json` (NEW, via `drizzle-kit generate`)
- **Done-Signal:** `pnpm drizzle-kit migrate` läuft up + down ohne Fehler; Spalten in DB sichtbar via `\d projects`.
- **Dependencies:** []
- **Discovery-Quelle:** Slice A "Project-Context DB + API"

### Slice 02: DB-Query-Helpers für Context
- **Scope:** Drizzle-Query-Funktionen `getProjectContext` und `updateProjectContext` mit Ownership-Check.
- **Deliverables:**
  - `lib/db/queries.ts` (Edit: zwei neue Helper)
- **Done-Signal:** Vitest-Unit-Test: `getProjectContext({id, userId})` liefert null bei fremdem User, korrekte Werte beim Owner; `updateProjectContext` setzt `contextUpdatedAt`.
- **Dependencies:** ["01-schema-migration"]
- **Discovery-Quelle:** Slice A

### Slice 03: Next.js Route Handlers GET/PATCH `/api/projects/[id]/context`
- **Scope:** Route-Handler mit `requireAuth()`, Ownership-Check, DTO-Validation (max 8000 chars), Aufruf der Query-Helpers.
- **Deliverables:**
  - `app/api/projects/[id]/context/route.ts` (NEW)
- **Done-Signal:** Vitest-Integration-Test: GET 200 für Owner, 404 für Fremd-User, PATCH validiert >8000 chars als 422, gespeicherter Wert per GET zurücklesbar.
- **Dependencies:** ["02-db-queries-helpers"]
- **Discovery-Quelle:** Slice A

### Slice 04: Server Action `updateProjectContext`
- **Scope:** Server Action für Form-Save-Pfad mit `requireAuth` + `revalidatePath`.
- **Deliverables:**
  - `app/actions/projects.ts` (Edit: neue Action `updateProjectContext`)
- **Done-Signal:** Vitest: Action validiert Auth, ruft Query-Helper, revalidiert Pfad.
- **Dependencies:** ["02-db-queries-helpers"]
- **Discovery-Quelle:** Slice A

### Slice 05: FastAPI ProjectRepository
- **Scope:** Read-only Python-Repository, das `context_instructions` mit Ownership-Check via psycopg lädt.
- **Deliverables:**
  - `backend/app/services/project_repository.py` (NEW)
- **Done-Signal:** Pytest: `get_context(project_id, user_id)` liefert `(context, owner_id)`; raises 403 bei Mismatch.
- **Dependencies:** ["01-schema-migration"]
- **Discovery-Quelle:** Slice D (Backend-Seite)

### Slice 06: Project-Context-Settings UI
- **Scope:** Modal/Page-Komponente mit `context_textarea`, Char-Counter (max 8000), Save/Cancel; Cancel-mit-Dirty zeigt Confirm-Dialog.
- **Deliverables:**
  - `components/projects/project-context-settings.tsx` (NEW)
- **Done-Signal:** Playwright: Open → Type → Save → Reopen zeigt gespeicherten Wert; >8000 Zeichen disabled Save; Cancel-mit-Dirty zeigt Confirm.
- **Dependencies:** ["03-context-routes", "04-context-server-action"]
- **Discovery-Quelle:** Slice B "Project-Context Edit-UI"

### Slice 07: Project-List + Workspace-Header Edit-Entries
- **Scope:** "Edit context"-Eintrag in Projekt-Card-Menü und Workspace-Header → öffnet Settings-Modal.
- **Deliverables:**
  - `components/project-card.tsx` (Edit: Menu-Item)
  - `components/workspace/workspace-header.tsx` (Edit: Settings-Eintrag)
- **Done-Signal:** Playwright: Klick auf Menu-Item öffnet Settings-View des korrekten Projekts.
- **Dependencies:** ["06-context-settings-page"]
- **Discovery-Quelle:** Slice B

### Slice 08: Help-Me-Write Route Handler
- **Scope:** `POST /api/projects/context/generate` mit Brief-Validation (10–500), single OpenRouter-Call, gibt `{draft}` zurück.
- **Deliverables:**
  - `app/api/projects/context/generate/route.ts` (NEW)
- **Done-Signal:** Vitest: gültiger Brief → 200 mit Draft-String; Brief <10 → 422; Auth-fail → 401.
- **Dependencies:** ["03-context-routes"]
- **Discovery-Quelle:** Slice C "Help me write this"

### Slice 09: Help-Me-Write Modal-Komponente
- **Scope:** Radix-Dialog mit `helper_brief_input`, Generate/Regenerate/Accept/Cancel-Buttons; ruft Route 08; Draft-Übernahme in Parent-Textarea.
- **Deliverables:**
  - `components/projects/help-me-write-modal.tsx` (NEW)
- **Done-Signal:** Playwright: Brief eingeben → Generate → Draft erscheint → Accept füllt `context_textarea` der Settings-Seite; Regenerate ersetzt Draft; Cancel ändert nichts.
- **Dependencies:** ["08-helper-modal-route", "06-context-settings-page"]
- **Discovery-Quelle:** Slice C

### Slice 10: No-Context-Hint-Banner
- **Scope:** Dezentes Banner im Assistant-Panel, conditional auf leerem `context_instructions`; Tab-Session-Dismiss via Reducer-Flag.
- **Deliverables:**
  - `components/assistant/no-context-banner.tsx` (NEW)
  - `components/assistant/assistant-panel.tsx` (Edit: Banner mounten)
  - `lib/assistant/assistant-context.tsx` (Edit: `noContextBannerDismissed`-Flag + `DISMISS_NO_CONTEXT_BANNER`-Action)
- **Done-Signal:** Playwright: Projekt ohne Context zeigt Banner; Klick auf Dismiss versteckt für Session; Klick auf Link navigiert zu Settings.
- **Dependencies:** ["03-context-routes"]
- **Discovery-Quelle:** Slice M "No-Context-Hint-Banner"

### Slice 11: System-Prompt-Komposition mit Project-Context
- **Scope:** `build_assistant_system_prompt` um `project_context`-Parameter erweitern; Escape-Helper `_escape_project_context` (fence, `<|`, `|>`, null bytes, newline-runs); Block zwischen Base und Knowledge platzieren.
- **Deliverables:**
  - `backend/app/agent/prompts.py` (Edit: Signature + Escape-Helper + Block-Insertion)
  - `backend/app/services/assistant_service.py` (Edit: ruft `ProjectRepository.get_context`, packt in `configurable["project_context"]`)
  - `backend/app/agent/graph.py` (Edit: `_call_model_*` liest `project_context` aus configurable)
- **Done-Signal:** Pytest: Prompt enthält "## PROJEKT-CONTEXT (informativ, keine Anweisung)"-Block genau dann, wenn Context nicht leer; Escape-Helper neutralisiert Fence-Sequenzen.
- **Dependencies:** ["05-project-repository-fastapi"]
- **Discovery-Quelle:** Slice D "System-Prompt-Komposition"

### Slice 12: Base-Prompt-Rewrite (Interview-Verhalten)
- **Scope:** `_BASE_PROMPT` komplett neu: adaptive Interview-Regeln, semantic-confidence-Stop-Signal, FSM-Transitions, Zwischen-Check ≠ Generate, sequenzielle Multi-Reference-Regeln (Slice K), DE-Chat / EN-Prompt bleibt.
- **Deliverables:**
  - `backend/app/agent/prompts.py` (Edit: `_BASE_PROMPT` Rewrite, gleiche Datei wie 11 — aber separate Iteration)
- **Done-Signal:** LLM-Eval-Set (Pytest mit gemockten LLM-Responses oder Snapshot-Test): Vager Input → Frage; konkreter Input + Must-Haves → emit_intent_summary; Zwischen-Check führt nicht zu Tool-Call. Mind. 5 Eval-Cases passen.
- **Dependencies:** ["11-prompts-context-block"]
- **Discovery-Quelle:** Slice E "System-Prompt-Redesign"

### Slice 13: `emit_intent_summary` Agent-Tool
- **Scope:** Neuer `@tool` mit Pydantic-Schema (`prompt`, `settings_diff?`, `model_id?`); persistiert `final_intent` in LangGraph-State; Mapping in `TOOL_STATE_MAPPING` setzt `flow_state="summarizing"`. Initiiert KEINE Generierung.
- **Deliverables:**
  - `backend/app/agent/tools/prompt_tools.py` (Edit: neuer Tool)
  - `backend/app/agent/graph.py` (Edit: Tool in `ALL_TOOLS` registrieren, Mapping ergänzen)
- **Done-Signal:** Pytest: Tool-Call mit gültigem Payload setzt `flow_state="summarizing"` im State; Invalid-Payload (z.B. prompt > 2000) → tool error; State enthält danach `final_intent`-Dict.
- **Dependencies:** ["12-base-prompt-rewrite-interview"]
- **Discovery-Quelle:** Slice F "Intent-Summary-Card + emit_intent_summary"

### Slice 14: FSM-State-Extension in PromptAssistantState
- **Scope:** `PromptAssistantState` erweitern um `flow_state: str = "idle"`, `intent_axes: dict = {}`, `final_intent: dict | None`; `DEFAULT_STATE_VALUES` aktualisieren.
- **Deliverables:**
  - `backend/app/agent/state.py` (Edit)
  - `backend/app/models/dtos.py` (Edit: `SessionStateDTO` um `flow_state`, `intent_axes` ergänzen)
- **Done-Signal:** Pytest: neue Session hat `flow_state="idle"`; LangGraph-Checkpointer serialisiert/deserialisiert Felder verlustfrei; bestehende Sessions ohne Felder lesen Default `"idle"`.
- **Dependencies:** ["13-emit-intent-summary-tool"]
- **Discovery-Quelle:** Slice F

### Slice 15: SSE-Events `flow-state` + `intent-summary`
- **Scope:** Neue SSE-Event-Typen im AssistantService emittieren: `flow-state` bei jedem State-Übergang, `intent-summary` mit `IntentSummaryPayload` (axes, prompt_preview, settings_diff). Frontend-SSE-Handler parsed neue Events und dispatcht Reducer-Actions `SET_FLOW_STATE`, `RENDER_INTENT_SUMMARY`.
- **Deliverables:**
  - `backend/app/services/assistant_service.py` (Edit: SSE-Emit-Funktionen)
  - `lib/assistant/use-assistant-runtime.ts` (Edit: SSE-Handler-Branches)
  - `lib/assistant/assistant-context.tsx` (Edit: `SET_FLOW_STATE`, `RENDER_INTENT_SUMMARY` Actions im Reducer)
- **Done-Signal:** Vitest mock SSE-Stream: `flow-state` event → `flowState`-Feld im Reducer aktualisiert; `intent-summary` event → `intentSummaryPayload` im State.
- **Dependencies:** ["14-fsm-state-extension"]
- **Discovery-Quelle:** Slice F

### Slice 16: IntentSummaryCard-Komponente
- **Scope:** Neue Card-Komponente mit Axes-Liste, Prompt-Preview (monospace), `SettingsDiff`-Renderer (deklarativ pro Sub-Array: slotRoles, slotStrengths, modelId, modelParams), Buttons "So generieren" + "Nochmal diskutieren". Card bleibt als History-Element nach Click (frozen state). Mounting in `chat-thread.tsx` per `flowState === "summarizing"`.
- **Deliverables:**
  - `components/assistant/intent-summary-card.tsx` (NEW)
  - `components/assistant/chat-thread.tsx` (Edit: Card-Render-Branch)
- **Done-Signal:** Playwright: Interview → emit_intent_summary triggern → Card rendert mit allen Axes + Prompt + Settings-Diff; Click "Nochmal diskutieren" friert Card ein und triggert `SET_FLOW_STATE("interviewing")`.
- **Dependencies:** ["15-sse-flow-state-events"]
- **Discovery-Quelle:** Slice F

### Slice 17: Auto-Apply + Auto-Generate Handler
- **Scope:** Click-Handler für "So generieren" in IntentSummaryCard: `useIsGenerationPending`-Precondition (Toast bei Block + Auto-Retry on settle), `SET_FLOW_STATE("generating")`, `applyToWorkspace(prompt, modelId, modelParams)`, `generateImages()` Server-Action. Error-Path: Toast + Rollback `flow_state` zu `summarizing`.
- **Deliverables:**
  - `lib/hooks/use-is-generation-pending.ts` (NEW)
  - `components/assistant/intent-summary-card.tsx` (Edit: Click-Handler verdrahten)
  - `lib/assistant/assistant-context.tsx` (Edit: `SET_FLOW_STATE`-Reducer-Branch komplettieren)
- **Done-Signal:** Playwright E2E: Card-Click → Bild erscheint im Workspace; bei laufender Generierung Toast "Es läuft bereits eine Generierung" + nach settle automatischer Retry; Generate-Fehler → Card bleibt mit Retry-fähigem Button.
- **Dependencies:** ["16-intent-summary-card-component"]
- **Discovery-Quelle:** Slice G "Auto-Apply + Auto-Generate"

### Slice 18: Result-Image als Multimodal-Input
- **Scope:** Nach erfolgreichem Generate: Frontend speichert `lastResultImageUrl` in Ref; sendet bei nächstem Turn `last_result_image_url` mit; Backend hängt als `image_url`-Part an HumanMessage; Assistant proaktiv-Starter via Base-Prompt-Regel. Frontend-Render: `result_message`-Variante mit Inline-Thumbnail.
- **Deliverables:**
  - `lib/assistant/use-assistant-runtime.ts` (Edit: `lastResultImageUrlRef` + Body-Field)
  - `lib/assistant/assistant-context.tsx` (Edit: `SET_LAST_RESULT_IMAGE_URL` Action)
  - `components/assistant/chat-thread.tsx` (Edit: `result_message`-Variante mit Thumbnail + bestehender `canvas-detail-view` öffnen on click)
- **Done-Signal:** Playwright: Generate → nächster Assistant-Turn zeigt Thumbnail + Kommentar mit Bezug zum Bild; Klick auf Thumbnail öffnet Detail-View.
- **Dependencies:** ["17-auto-apply-generate-handler"]
- **Discovery-Quelle:** Slice H "Result-Image als Multimodal"

### Slice 19: ReferenceSlot-DTO + SendMessageRequest-Erweiterung
- **Scope:** Pydantic-DTO `ReferenceSlotDTO` (slot_index, image_url, role?, strength?); `SendMessageRequest` um `project_id`, `reference_slots: list[ReferenceSlotDTO] (max 5)`, `last_result_image_url`. Frontend sendet Snapshot — Slot-Inclusion gated auf `generationMode === "img2img"`.
- **Deliverables:**
  - `backend/app/models/dtos.py` (Edit)
  - `lib/assistant/use-assistant-runtime.ts` (Edit: `referenceSlotsRef`, `projectIdRef`, Body-Erweiterung mit Modus-Gate)
- **Done-Signal:** Pytest: SendMessageRequest mit `reference_slots` validiert; >5 Slots → 422; Vitest: Frontend sendet Slots nur bei `img2img`.
- **Dependencies:** ["12-base-prompt-rewrite-interview"]
- **Discovery-Quelle:** Slice I "ReferenceBar → Multimodal-Pipeline"

### Slice 20: chat_llm_limits-Modul
- **Scope:** Neues Konstanten-Modul mit `CHAT_LLM_LIMITS`-Dict (max_images, max_total_bytes, vision pro Allowlist-Modell), `DEFAULT_LIMITS`, Lookup-Helper `get_chat_llm_limits(model_id)`.
- **Deliverables:**
  - `backend/app/agent/chat_llm_limits.py` (NEW)
- **Done-Signal:** Pytest: Helper liefert per Modell korrekten Eintrag; unbekanntes Modell → DEFAULT_LIMITS mit `vision=False`.
- **Dependencies:** ["19-reference-slots-dto"]
- **Discovery-Quelle:** Slice I

### Slice 21: Multimodal-Pipeline + Budget-Enforcement
- **Scope:** `AssistantService._build_human_message` (oder Equivalent) baut Multimodal-Content: text + chat-uploads + reference-slots (img2img only) + last_result_image_url; wendet Priority-Drop an (1=Refs, 2=Result, 3=Uploads); Vision-Fallback strippt alle images bei Non-Vision-Model; SSE-Event `slot-load-failed` bei Fetch-Failure.
- **Deliverables:**
  - `backend/app/services/assistant_service.py` (Edit: Pipeline + Budget + Vision-Fallback)
  - `lib/assistant/assistant-context.tsx` (Edit: `RENDER_SYSTEM_MESSAGE`-Action für `slot-load-failed`)
- **Done-Signal:** Pytest: 6 Bilder + Cap=4 → 2 niedrigster Prio gedroppt; Non-Vision-Model strippt alle; Vitest: SSE `slot-load-failed` rendert inline System-Message im Chat.
- **Dependencies:** ["20-chat-llm-limits-module"]
- **Discovery-Quelle:** Slice I

### Slice 22: Multimodal-Indicator UI
- **Scope:** Kleine Zeile unter ChatInput: "Sieht: X Refs + letztes Ergebnis"; subscribed an `referenceSlotsRef` + `lastResultImageUrlRef`; versteckt wenn nichts angehängt; "Sieht: nur Text" bei Non-Vision-Model.
- **Deliverables:**
  - `components/assistant/multimodal-indicator.tsx` (NEW)
  - `components/assistant/assistant-panel.tsx` (Edit: Indicator unter ChatInput mounten)
- **Done-Signal:** Playwright: 2 Refs + Result attached → Indicator zeigt "Sieht: 2 Refs + letztes Ergebnis"; txt2img ohne Anhang → Indicator versteckt.
- **Dependencies:** ["21-multimodal-pipeline-budget"]
- **Discovery-Quelle:** Slice I (UI-Layer)

### Slice 23: i2i-Settings-Tools (set_slot_role, set_slot_strength, set_model_params)
- **Scope:** Drei neue `@tool`-Definitionen mit Pydantic-Schemas; Validierung gegen aktive Model-Knowledge bei `set_model_params`; emit SSE tool-result. Tools persistieren NICHT im LangGraph-State.
- **Deliverables:**
  - `backend/app/agent/tools/workspace_tools.py` (NEW, alle drei Tools)
  - `backend/app/agent/graph.py` (Edit: in `ALL_TOOLS` registrieren)
- **Done-Signal:** Pytest: Payload-Validation pro Tool (z.B. strength >1.0 → error, role außerhalb Enum → error); Tool-Result enthält Payload für Frontend.
- **Dependencies:** ["13-emit-intent-summary-tool"]
- **Discovery-Quelle:** Slice J "i2i-Settings-Tools"

### Slice 24: Frontend-Handler für Slot-Tools
- **Scope:** SSE-Handler-Branches für `set_slot_role`, `set_slot_strength`, `set_model_params`; dispatcht Reducer-Actions `SET_SLOT_ROLE`, `SET_SLOT_STRENGTH`; ruft `setVariation({modelParams})` für `set_model_params`.
- **Deliverables:**
  - `lib/assistant/use-assistant-runtime.ts` (Edit: SSE-Branches)
  - `lib/assistant/assistant-context.tsx` (Edit: drei neue Reducer-Actions)
- **Done-Signal:** Vitest mock SSE: tool-result(set_slot_role) → Workspace-Slot-Role aktualisiert in PromptArea-State; tool-result(set_model_params) → modelParams im Workspace-Variation aktualisiert.
- **Dependencies:** ["23-i2i-settings-tools"]
- **Discovery-Quelle:** Slice J

### Slice 25: Multi-Reference-Interview Eval-Suite
- **Scope:** Eval-Tests, die das sequenzielle Multi-Reference-Verhalten gegen das Base-Prompt prüfen (3 Slots → Assistant fragt sequentiell pro Slot, ruft `set_slot_role`, geht weiter). Kein eigener Code-Slice, sondern Test-Suite, die Slice 12's Prompt-Regeln gegen 3-Slot-Szenario validiert.
- **Deliverables:**
  - `backend/tests/agent/test_multi_reference_flow.py` (NEW)
- **Done-Signal:** Pytest: 3-Slot-Session-Mock → Assistant stellt 3 sequenzielle Fragen, ruft `set_slot_role` 3-mal mit eindeutigen `slot_index`-Werten.
- **Dependencies:** ["24-slot-tool-frontend-handler", "12-base-prompt-rewrite-interview"]
- **Discovery-Quelle:** Slice K "Multi-Reference-Interview-Flow" (verhaltensbasiert in Slice E's Prompt + Eval hier)

### Slice 26: Paste-Detect-Heuristik
- **Scope:** Pure Frontend-Funktion `detectPastedPrompt(text): boolean` (Length ≥80, Komma-Tokens ≥6, Style-Keyword-Treffer ≥2 aus kurierter Liste).
- **Deliverables:**
  - `lib/assistant/paste-detect.ts` (NEW)
- **Done-Signal:** Vitest: 5+ Test-Cases (kurzer Input → false, langer Style-Prompt → true, Edge-Cases).
- **Dependencies:** ["12-base-prompt-rewrite-interview"]
- **Discovery-Quelle:** Slice L "Paste-Detect-Confirm"

### Slice 27: PasteDetectConfirmCard-Komponente
- **Scope:** Inline-Card-Komponente mit "Direkt verfeinern" / "Interview starten"-Buttons; einmalig pro Session bei erster User-Message-Match; Card wird nach Click aus History entfernt (im Gegensatz zu IntentSummaryCard). Reducer-Action `RENDER_PASTE_CONFIRM` + `DISMISS_PASTE_CONFIRM`. "Direkt verfeinern" triggert `refine_prompt`-Tool-Call via Frontend; "Interview starten" sendet einfach normale Message.
- **Deliverables:**
  - `components/assistant/paste-detect-confirm-card.tsx` (NEW)
  - `components/assistant/chat-thread.tsx` (Edit: Card-Render-Branch + Heuristik-Trigger nach erster User-Message)
  - `lib/assistant/assistant-context.tsx` (Edit: `RENDER_PASTE_CONFIRM` + `DISMISS_PASTE_CONFIRM` Actions)
- **Done-Signal:** Playwright: Paste eines langen Style-Prompts als erste Message → Card erscheint; Click "Direkt verfeinern" → Card verschwindet, Intent-Summary-Card folgt; Click "Interview starten" → Card verschwindet, Assistant stellt erste Frage.
- **Dependencies:** ["26-paste-detect-heuristic", "16-intent-summary-card-component"]
- **Discovery-Quelle:** Slice L

### Slice 28: Session-Resume mit FSM-Hydrate
- **Scope:** `GET /api/assistant/sessions/{id}` liefert `flow_state` + `intent_axes` zurück; Frontend-Hydrate dispatcht `SET_FLOW_STATE` beim Session-Reload. Re-rendert Intent-Summary-Card aus persistiertem `final_intent` falls `flow_state === "summarizing"`.
- **Deliverables:**
  - `backend/app/routes/sessions.py` (Edit: SessionStateDTO um neue Felder ergänzen, falls noch nicht via Slice 14 erfasst)
  - `lib/assistant/assistant-context.tsx` (Edit: Hydrate-Effekt um `SET_FLOW_STATE`-Dispatch erweitern)
- **Done-Signal:** Playwright: Interview bis Summary → Page-Reload → Intent-Summary-Card wird mit gleichem Inhalt erneut gerendert; FSM-State korrekt wiederhergestellt.
- **Dependencies:** ["16-intent-summary-card-component"]
- **Discovery-Quelle:** Slice F (Resume-Aspekt) — implizit aus Architecture "Resume on session reload"

---

## Flow-Traceability

| Discovery-Slice | Integration-Testfall | Abgedeckt in Slice | Done-Signal |
|-----------------|----------------------|--------------------|-------------|
| A | Migration up+down | 01-schema-migration | drizzle-kit migrate up+down ohne Fehler |
| A | Endpoint-Integration GET, PATCH, Auth-Deny | 03-context-routes | Vitest-Integration mit allen drei Pfaden |
| B | Edit + Save + Re-Open zeigt Wert | 06-context-settings-page | Playwright Round-Trip |
| B | Entry-Point aus Projekt-Liste | 07-project-list-edit-entry | Playwright öffnet Settings via Menu |
| C | Brief → Draft → Accept | 09-helper-modal-component | Playwright Round-Trip |
| C | LLM-Call-Shape | 08-helper-modal-route | Vitest-Mock OpenRouter-Call |
| D | Prompt enthält Block genau bei Context | 11-prompts-context-block | Pytest Snapshot mit/ohne Context |
| E | Vager Input → Frage; konkret → Draft; Zwischen-Check ≠ Generate | 12-base-prompt-rewrite-interview | LLM-Eval mit ≥5 Cases |
| F | Card rendert + Buttons funktionieren + History-Erhalt | 16-intent-summary-card-component | Playwright Click-Pfade |
| F | Tool persistiert `final_intent`, setzt `flow_state` | 13-emit-intent-summary-tool, 14-fsm-state-extension | Pytest State-Assertions |
| F | Resume-Hydrate | 28-session-resume-flow-state | Playwright Reload-Test |
| G | Card-Click E2E → Bild erscheint | 17-auto-apply-generate-handler | Playwright E2E |
| G | Concurrent-Block + Auto-Retry on settle | 17-auto-apply-generate-handler | Playwright mit pending-Gen-Fixture |
| G | Error-Path mit Rollback | 17-auto-apply-generate-handler | Playwright mit Generate-Fail-Fixture |
| H | Generate → nächster Turn zeigt Bild-Bezug | 18-result-image-multimodal | Playwright Bild im result_message-Bubble |
| I | Slots → Assistant kann Bilder beschreiben | 21-multimodal-pipeline-budget, 22-multimodal-indicator-ui | Playwright i2i mit gerendertem Indicator |
| I | Budget-Regeln | 21-multimodal-pipeline-budget | Pytest Drop-Order |
| I | Vision-Fallback | 21-multimodal-pipeline-budget | Pytest Strip bei Non-Vision-Model |
| J | Tool-Call ändert State nachweisbar | 23-i2i-settings-tools, 24-slot-tool-frontend-handler | Vitest SSE-Mock + Reducer-Assertion |
| K | 3-Slots-Interview sequenziell | 25-multi-reference-eval | Pytest Eval mit 3-Slot-Session |
| L | Heuristik-Unit-Test | 26-paste-detect-heuristic | Vitest mit ≥5 Cases |
| L | Paste-Input löst Card, Buttons führen zu richtigem Next-State | 27-paste-detect-card-component | Playwright Click-Pfade |
| M | Banner zeigt + dismiss versteckt | 10-no-context-banner | Playwright + Reducer-Assertion |

---

## Recommended Order

Implementierungs-Reihenfolge (DAG-respektierend, schnellster User-Value-Pfad):

1. **01-schema-migration** — Fundament
2. **02-db-queries-helpers**
3. **03-context-routes** + **04-context-server-action** (parallel)
4. **05-project-repository-fastapi** (parallel zu 3/4)
5. **06-context-settings-page** + **07-project-list-edit-entry** (Slice B abschließen)
6. **11-prompts-context-block** — Assistant nutzt Context schon vor Interview-Redesign
7. **10-no-context-banner** (parallel zu 11)
8. **08-helper-modal-route** + **09-helper-modal-component** (Slice C)
9. **12-base-prompt-rewrite-interview** — Kern-Delta
10. **13-emit-intent-summary-tool** + **14-fsm-state-extension** + **15-sse-flow-state-events**
11. **16-intent-summary-card-component**
12. **17-auto-apply-generate-handler** — schließt Haupt-Flow
13. **18-result-image-multimodal** — schließt Refinement-Loop
14. **19-reference-slots-dto** + **20-chat-llm-limits-module** + **21-multimodal-pipeline-budget** + **22-multimodal-indicator-ui** (Slice I)
15. **23-i2i-settings-tools** + **24-slot-tool-frontend-handler** (Slice J)
16. **25-multi-reference-eval** (Slice K Validierung)
17. **26-paste-detect-heuristic** + **27-paste-detect-card-component** (Slice L)
18. **28-session-resume-flow-state** (cross-cutting Polish)

---

## Qualitäts-Checkliste

- [x] Jeder Slice hat maximal 3 produktive Deliverable-Dateien (Slice 11, 17, 18, 21, 22, 24, 27, 10 sind Multi-File aber innerhalb Limit)
- [x] Jeder Slice hat ein messbares Done-Signal (Pytest-Assertion / Playwright-Step / Vitest-Mock)
- [x] Dependencies sind azyklisch (DAG, siehe Graph)
- [x] Alle Deliverables aus der Discovery sind abgedeckt (A–M alle gemappt in Flow-Traceability)
- [x] Kein Slice mischt Concerns (Schema/Service/UI getrennt; Slice 10/11/15/17/18/21/24/27 sind FE+BE-übergreifend nur dort, wo das Concern nicht trennbar ist — z.B. SSE-Event braucht beide Seiten)
- [x] Schema/Service-Slices kommen vor UI-Slices (01–05 vor 06+; 11–15 vor 16+)
- [x] Stack korrekt erkannt: TypeScript/Next.js + Python/FastAPI + LangGraph; Tests vitest + playwright (FE), pytest (BE)
- [x] **Flow-Completeness:** Alle Discovery-Integration-Testfälle aus der Testability-Spalte haben einen Slice mit passendem Done-Signal (siehe Flow-Traceability-Tabelle)

### Anmerkungen zu Regel 3 (max 3 produktive Dateien)

Folgende Slices fassen mehrere Edits in **einer Datei** zusammen, was die Regel respektiert (≤3 distinkte Dateien):

- Slice 11: 3 Dateien (prompts.py, assistant_service.py, graph.py) — alle drei sind das gleiche Concern "Project-Context durchreichen"
- Slice 17: 3 Dateien — alle für den Click-Handler-Pfad
- Slice 21: 2 Dateien (assistant_service.py + assistant-context.tsx) — Pipeline + Frontend-System-Message-Render gehören zum gleichen Daten-Pfad
- Slice 27: 3 Dateien — Card + Mount-Punkt + Reducer-Action

Slices mit Edits in `lib/assistant/assistant-context.tsx`: das Reducer-File wird in mehreren Slices erweitert (15, 17, 18, 21, 24, 27). Das ist akzeptabel weil jeder Slice nur seine eigene Action(s) ergänzt — kein Slice ändert Actions eines anderen Slices.
