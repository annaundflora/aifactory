# E2E Checklist: Interactive Prompt Refinement in Assistant with Per-Project Context

**Integration Map:** `integration-map.md`
**Generated:** 2026-05-09

---

## Pre-Conditions

- [ ] All slices APPROVED (Gate 2) — 28/28 confirmed
- [ ] Architecture APPROVED (Gate 1) — confirmed
- [ ] Integration Map has no MISSING INPUTS — confirmed
- [ ] Frontend-Health-Endpoint `/api/health` existiert (siehe orchestrator-config.md PREREQUISITE)
- [ ] Backend-Health-Endpoint `/api/assistant/health` reachable (existing)
- [ ] Test-Datenbank mit Migration `0014` und Seed-User + Seed-Projekt vorhanden

---

## Happy Path Tests

### Flow 1: txt2img mit vagem Input → Interview → Auto-Generate → Refinement-Loop

> **Quelle:** Discovery → "Haupt-Flow: txt2img mit vagem Input"

1. [ ] **Slice 06+07:** User öffnet Projekt mit gesetztem `context_instructions` (Smoke-Test: Edit-Settings → Save → Reopen zeigt Wert)
2. [ ] **Slice 11:** Backend-System-Prompt enthält `## PROJEKT-CONTEXT`-Block (verify via Pytest snapshot)
3. [ ] **Slice 12:** User sendet "mach was Schönes" — Assistant stellt Klärungsfrage (Eval-Case grün)
4. [ ] **Slice 15-AC1:** SSE-Event `flow-state` mit `interviewing` empfangen — Reducer-State `flowState === "interviewing"`
5. [ ] **Slice 12-AC4:** User bestätigt Zwischen-Check — KEIN Tool-Call, weiter `interviewing`
6. [ ] **Slice 13+14:** Nach mehreren Turns ruft LLM `emit_intent_summary` — `final_intent` im LangGraph-State persistiert
7. [ ] **Slice 15-AC2:** SSE-Events in Reihenfolge: `tool-call-result` → `intent-summary` → `flow-state(summarizing)`
8. [ ] **Slice 16-AC1:** `<IntentSummaryCard>` rendert mit allen Axes + Prompt-Preview + Discuss/Generate-Buttons
9. [ ] **Slice 17-AC1:** User klickt "So generieren" → SET_FLOW_STATE("generating") → applyToWorkspace → generateImages()
10. [ ] **Slice 17-AC8:** GenerationPlaceholder erscheint im Workspace; nach Settle erscheint generiertes Bild
11. [ ] **Slice 18-AC1:** Auto-Apply-Settle-Pfad dispatcht `SET_LAST_RESULT_IMAGE_URL`
12. [ ] **Slice 12+18:** Backend streamt nächsten Assistant-Turn proaktiv (Base-Prompt-Regel)
13. [ ] **Slice 18-AC5/AC8:** Nächster Assistant-Turn rendert `result_message`-Variante mit Inline-Thumbnail + Kommentar mit Bezug
14. [ ] **Slice 18-AC6:** Klick auf Thumbnail öffnet existierende Detail-View (`canvas-detail-view`)
15. [ ] **Slice 18-AC9:** User schickt Refinement-Message — Body enthält `last_result_image_url`

### Flow 2: i2i-Flow mit ReferenceBar-Slots + sequenzielles Multi-Reference-Interview

> **Quelle:** Discovery → "i2i-Flow: mit ReferenceBar-Slots", Slice K

1. [ ] User füllt ReferenceBar mit 3 Slots (UI-Aktion)
2. [ ] **Slice 19-AC8:** User sendet erste Message (img2img) — Body enthält `reference_slots` (3 Snapshots) + `project_id`
3. [ ] **Slice 21-AC1:** Backend HumanMessage-Content-Reihenfolge: text → chat-uploads → reference_slots → last_result
4. [ ] **Slice 21-AC3:** Bei Cap=4 + 6 Bildern: Drop-Order Prio 3→2→1, behält Refs vollständig
5. [ ] **Slice 22-AC1/AC2:** Indicator zeigt korrekten Multimodal-Status (z.B. "Sieht: 3 Refs")
6. [ ] **Slice 25-AC1/AC2:** Assistant fragt sequenziell pro Slot (slot_index 0 → 1 → 2)
7. [ ] **Slice 23-AC2:** Nach jeder User-Antwort ruft LLM `set_slot_role` mit korrektem `slot_index`
8. [ ] **Slice 24-AC1/AC4:** SSE-`tool-call-result` triggert `SET_SLOT_ROLE` — `pendingSlotRolePatch` mit version-counter inkrementiert
9. [ ] **Slice 24-AC6:** Auto-apply-Effekt ruft `setVariation({ modelParams })` für `set_model_params` (kein Prompt-Override)
10. [ ] **Slice 25-AC4:** 2-Slot-Variante erzeugt nur 2 set_slot_role-Calls (kein dritter Call für leeren Slot)
11. [ ] Nach 3 Slots: weitere Frage zum Gesamt-Intent → Intent-Summary-Card → Generate
12. [ ] **Slice 21-AC5:** Wechsel zu Non-Vision-Modell strippt alle Bilder still
13. [ ] **Slice 21-AC6:** Slot mit invalider URL emittiert `slot-load-failed` SSE → Frontend rendert inline System-Message via `RENDER_SYSTEM_MESSAGE`

### Flow 3: Paste-Prompt-Flow

> **Quelle:** Discovery → "Paste-Prompt-Flow", Slice L

1. [ ] User pastet langen Style-Prompt als erste Session-Message (≥80 chars, ≥6 Komma-Tokens, ≥2 Style-Keywords)
2. [ ] **Slice 26:** `detectPastedPrompt(text) === true` (Vitest)
3. [ ] **Slice 27-AC1:** Trigger-Layer dispatcht `RENDER_PASTE_CONFIRM` — Card erscheint
4. [ ] **Slice 27-AC4 (Refine-Pfad):** Klick "Direkt verfeinern" → Card verschwindet → `refine_prompt`-Tool läuft → IntentSummaryCard erscheint (Slice 16-AC1)
5. [ ] **Slice 27-AC5 (Interview-Pfad):** Alternativ: Klick "Interview starten" → Card verschwindet → Assistant streamt erste Frage (`flowState === "interviewing"`)
6. [ ] **Slice 27-AC2:** Bei zweiter User-Message wird KEIN zweiter Card-Mount triggert (Single-Fire)
7. [ ] **Slice 27-AC6:** Card bleibt nach Click NICHT in History (im Gegensatz zu IntentSummaryCard)

### Flow 4: Project-Context-Edit-Flow inkl. Help-Me-Write

> **Quelle:** Discovery → "Project-Context-Edit-Flow", Slices A/B/C

1. [ ] **Slice 07-AC1/AC3:** User klickt "Edit context" in Projekt-Card oder Workspace-Header
2. [ ] **Slice 06-AC1:** `<ProjectContextSettings>` öffnet, lädt initialen Wert via GET (Slice 03-AC2), zeigt Char-Counter + Last-Updated
3. [ ] **Slice 06-AC2:** User tippt Text — Counter aktualisiert live; bei >8000 chars wird Save disabled + Counter rot
4. [ ] **Slice 06-AC3:** User klickt Save — Server Action `updateProjectContext` (Slice 04-AC1) → DB-Update → "Saved"-Indikator
5. [ ] **Slice 09-AC1/AC3 (Help-Me-Write):** User klickt "Help me write this" → HelpMeWriteModal öffnet
6. [ ] **Slice 09-AC3/AC4:** User tippt Brief (10..500 chars) → Generate → POST (Slice 08-AC2) → Draft erscheint
7. [ ] **Slice 09-AC5:** Klick Regenerate → neuer Fetch → Draft ersetzt vollständig
8. [ ] **Slice 09-AC7/AC9:** Klick Accept → onAccept-Callback füllt context_textarea in Settings
9. [ ] **Slice 06-AC5/AC6:** Cancel mit Dirty-State zeigt Confirm-Dialog "Ungespeicherte Änderungen verwerfen?"; ohne Dirty schließt direkt
10. [ ] **Slice 09-AC8:** Cancel im Helper-Modal verwirft Brief/Draft, ändert context_textarea NICHT

### Flow 5: No-Context-Banner-Flow

> **Quelle:** Discovery → Slice M

1. [ ] **Slice 10-AC1:** Projekt ohne Context — Banner sichtbar oberhalb Chat-Thread
2. [ ] **Slice 10-AC2:** Projekt mit Context — Banner NICHT gerendert (DOM-Node fehlt)
3. [ ] **Slice 10-AC3:** Klick Dismiss-✕ → `DISMISS_NO_CONTEXT_BANNER` → Banner verschwindet
4. [ ] **Slice 10-AC4:** Project-Switch ohne Reload → Banner bleibt versteckt (Tab-Session-Scope)
5. [ ] **Slice 10-AC5:** Tab-Reload → Banner erscheint wieder
6. [ ] **Slice 10-AC6:** Klick "Add"-Link → Navigation zu Project-Context-Settings
7. [ ] **Slice 10-AC8:** GET-Fetch fail (401/404) → Banner versteckt (fail-closed, kein Toast)

### Flow 6: Session-Resume-Flow

> **Quelle:** Discovery → Slice F (Resume-Aspekt)

1. [ ] User durchläuft Interview bis IntentSummaryCard rendert (`flowState === "summarizing"`)
2. [ ] User triggert harten Page-Reload (kein Click)
3. [ ] **Slice 28-AC1:** Backend `GET /api/assistant/sessions/{id}` liefert `flow_state="summarizing"`, `intent_axes`, `final_intent`
4. [ ] **Slice 28-AC4/AC5:** Hydrate-Effekt dispatcht SET_FLOW_STATE + RENDER_INTENT_SUMMARY → IntentSummaryCard re-mountet mit identischem Inhalt
5. [ ] **Slice 28-AC8:** Buttons sind aktiv (kein frozen-State, da kein Click vor Reload)
6. [ ] **Slice 28-AC2:** Pre-Slice-14-Checkpoint (legacy session) lädt mit `flow_state="idle"` (Default), kein 500-Error
7. [ ] **Slice 28-AC6:** Edge-Case `summarizing` ohne `final_intent` → nur SET_FLOW_STATE, kein Card-Render, console.warn
8. [ ] **Slice 28-AC7:** Unbekannter `flow_state` → Whitelist-Validation, kein Dispatch, console.warn

---

## Edge Cases

### Error Handling

- [ ] **Slice 03-AC1:** Auth-fail auf GET/PATCH context-route → 401 Unauthorized
- [ ] **Slice 03-AC3:** Fremdes Projekt → 404 (no existence leak; gleiches Verhalten wie nicht-existent)
- [ ] **Slice 03-AC5:** Context >8000 chars (post-trim) → 422 mit exakter Fehlermeldung
- [ ] **Slice 03-AC7:** Malformed PATCH-Body → 422 "Invalid request body"
- [ ] **Slice 04-AC2:** Server-Action Auth-fail → `{ error: "Unauthorized" }` durchgereicht
- [ ] **Slice 04-AC5:** Helper liefert null → `{ error: "Projekt nicht gefunden" }`
- [ ] **Slice 04-AC6:** Helper wirft → `{ error: "Datenbankfehler" }`
- [ ] **Slice 05-AC2/AC3:** ProjectRepository raises HTTP 403 für Ownership-Mismatch UND unknown project (gleiches Verhalten)
- [ ] **Slice 06-AC4:** Server-Action Error → Inline-Error im Modal, Save-Button wieder enabled für Retry
- [ ] **Slice 08-AC6:** OpenRouter wirft → 502 mit "Could not generate. Try again."
- [ ] **Slice 09-AC6:** Modal Generate-Error → Inline-Error mit exaktem Wortlaut, Brief preserved
- [ ] **Slice 13-AC3/AC4:** emit_intent_summary mit prompt >2000 chars ODER strength >1.0 → ValidationError
- [ ] **Slice 15-AC4:** axis >200 chars → error-SSE statt malformed intent-summary-Event
- [ ] **Slice 15-AC9:** Unknown flow_state value → kein Dispatch, console.warn
- [ ] **Slice 15-AC10:** Malformed intent-summary-Payload → kein Dispatch, console.warn
- [ ] **Slice 17-AC4:** generateImages-Fehler → Rollback auf `summarizing` + Error-Toast + Card retry-fähig
- [ ] **Slice 17-AC2:** Concurrent-Generation pending → Toast + auto-retry on settle (genau einmal)
- [ ] **Slice 21-AC6:** Slot-URL-Fetch-Failure → SSE `slot-load-failed` + System-Message inline
- [ ] **Slice 23-AC8/AC9:** set_model_params unknown key OR missing image_model_id → Error-Dict (kein Crash)
- [ ] **Slice 24-AC8:** Malformed slot-tool payload → console.warn, kein Dispatch

### State Transitions

- [ ] **idle → paste_confirmation:** Erste Message + Heuristik-Match (26+27)
- [ ] **idle → interviewing:** Vager Intent (12+15)
- [ ] **idle → summarizing:** Konkret + must-haves (12+13+15)
- [ ] **paste_confirmation → summarizing:** Refine-btn (27+16)
- [ ] **paste_confirmation → interviewing:** Interview-btn (27+12)
- [ ] **interviewing → interviewing:** Zwischen-Check (12-AC4)
- [ ] **interviewing → summarizing:** semantic confidence (12-AC3 + 13 + 15-AC2)
- [ ] **summarizing → generating:** "So generieren" Click (17-AC1)
- [ ] **summarizing → interviewing:** "Nochmal diskutieren" (16-AC6)
- [ ] **generating → reviewing:** Result-URL ready (17-AC8 + 18-AC8)
- [ ] **generating → summarizing:** Generate-fail rollback (17-AC4)
- [ ] **reviewing → refining:** Text-Feedback (12)
- [ ] **reviewing → idle:** "Perfekt" (12)
- [ ] **refining → summarizing:** kleine Änderung (12+16)
- [ ] **refining → interviewing:** große Änderung (12)

### Boundary Conditions

- [ ] **Slice 01:** Down-Verify (Migration up→down→up idempotent)
- [ ] **Slice 02:** WHERE-Klausel kombiniert id + userId (Defence-in-depth)
- [ ] **Slice 06-AC8:** Empty/null context_instructions → Placeholder, last-updated hidden
- [ ] **Slice 09-AC1:** Modal initial state empty → Generate disabled, Cancel enabled
- [ ] **Slice 11-AC1:** Whitespace-only context → kein Block (semantisch gleich None)
- [ ] **Slice 11-AC4-AC7:** Escape-Helper neutralisiert Fences, Delimiter, Null-Bytes, Newline-Runs >5, truncates auf 8000
- [ ] **Slice 14-AC5:** Legacy-Checkpoint ohne FSM-Felder lädt mit Defaults
- [ ] **Slice 17-AC7:** useIsGenerationPending reagiert auf Quelle-Updates (true→false)
- [ ] **Slice 18-AC4:** SET_LAST_RESULT_IMAGE_URL mit null clears
- [ ] **Slice 19-AC6:** >5 reference_slots → 422
- [ ] **Slice 20-AC3/AC6:** Unbekanntes Modell ODER None/Empty → DEFAULT_LIMITS mit vision=False
- [ ] **Slice 21-AC4:** Cap=2 mit 5 Bildern → behält nur die 2 Refs
- [ ] **Slice 21-AC8:** max_total_bytes-Cap droppt unabhängig von max_images
- [ ] **Slice 22-AC4:** txt2img ohne Anhang → Indicator versteckt
- [ ] **Slice 22-AC6:** Singular "Sieht: 1 Ref" für genau 1 Slot
- [ ] **Slice 23-AC6:** strength=0.0 und strength=1.0 sind gültige Boundary-Values
- [ ] **Slice 26-AC5:** Edge-Cases (empty, whitespace, only commas) → false ohne Throw
- [ ] **Slice 26-AC8:** Pure function determinism (idempotent calls)

---

## Cross-Slice Integration Points

| # | Integration Point | Slices | How to Verify |
|---|-------------------|--------|---------------|
| 1 | Frontend GET → Backend Route → DB-Query | 06 → 03 → 02 → 01 | Playwright Round-Trip: Open Settings, see persisted value |
| 2 | Server Action → Query-Helper → DB | 06 → 04 → 02 → 01 | Vitest: action call mit mocked queries |
| 3 | Helper Modal → Helper Route → OpenRouter | 09 → 08 (mocked) | Vitest: fetch wird mit `{ brief }` gerufen |
| 4 | Helper Modal → ProjectContextSettings (callback) | 09 → 06 | Playwright: Accept fills textarea |
| 5 | DB-Schema → FastAPI psycopg | 01 → 05 | Pytest: read context aus DB |
| 6 | ProjectRepository → AssistantService → System-Prompt | 05 → 11 | Pytest: configurable enthält project_context |
| 7 | System-Prompt → Base-Prompt → LLM-Verhalten | 11 → 12 | Eval-Suite: ≥5 Cases passen |
| 8 | LLM-Tool-Call → State-Mapping → SSE-Event → Reducer → Card | 12 → 13 → 14 → 15 → 16 | E2E: Interview triggert Card |
| 9 | Card-Click → Apply → Generate → Settle → Result-URL → next Turn | 16 → 17 → existing → 18 | E2E: Generated image + next-turn thumbnail |
| 10 | ReferenceBar-State → Frontend-Refs → Body → Backend-Pipeline → HumanMessage | UI → 19 → 21 | E2E + Pytest: img2img mit Slots |
| 11 | Multi-Reference-Interview → set_slot_role-Tool → SSE → PromptArea-Slot | 12 → 23 → 24 | Eval (25) + Vitest (24) |
| 12 | Vision-Mismatch → Strip → Indicator | Frontend Model + 21 → 22 | E2E: Switch zu Non-Vision-Model, Indicator zeigt "Sieht: nur Text" |
| 13 | Slot-Fetch-Fail → SSE → System-Message | 21 → 15-Familie → 21-Reducer | Vitest: slot-load-failed dispatcht RENDER_SYSTEM_MESSAGE |
| 14 | Paste-Heuristik → Trigger-Layer → Card → Refine-Pfad → Card 16 | 26 → 27 → existing refine_prompt → 16 | E2E: paste-message → refine_btn → IntentSummaryCard |
| 15 | Page-Reload → GET sessions/{id} → Hydrate → Card re-mount | 14 → 28 → 16 | E2E: reload while summarizing → Card sichtbar |
| 16 | Banner-Visibility → GET context-route | 10 → 03 | Playwright: Banner conditional on context-instructions empty |

---

## Sign-Off

| Tester | Date | Result |
|--------|------|--------|
| _TBD_ | _TBD_ | PASS / FAIL |

**Notes:**
_To be filled by integration test execution_
