# Slice Decomposition

**Feature:** Prompt-Felder Vereinfachung
**Discovery-Slices:** 3 (grob)
**Atomare Slices:** 11
**Stack:** TypeScript/Next.js (Vitest) + Python/FastAPI Backend (pytest)

---

## Dependency Graph

```
slice-01  DB Schema & Migration
    |
    +---> slice-02  DB Queries & Prompt History Service
    |         |
    |         +---> slice-04  Generation Service & Server Action
    |         |         |
    |         |         +---> slice-05  Prompt Area UI (Hauptkomponente)
    |         |         |         |
    |         |         |         +---> slice-07  Canvas UI Bereinigung
    |         |         |
    |         |         +---> slice-06  Workspace State & Prompt Tabs/Lists UI
    |         |
    |         +---> slice-08  Assistant Backend (Python Tools & Prompt)
    |                   |
    |                   +---> slice-09  Assistant Backend (Knowledge & DTO)
    |                   |
    |                   +---> slice-10  Assistant Frontend Integration
    |
    +---> slice-03  Frontend Test-Infrastruktur (Mock-Daten bereinigen)

slice-11  End-to-End Verifikation (abhaengig von allen)
```

---

## Slice-Liste

### Slice 01: DB Schema & Migration

- **Scope:** Spalten `promptStyle` und `negativePrompt` aus dem Drizzle-Schema entfernen und die zugehoerige SQL-Migration erstellen.
- **Deliverables:**
  - `lib/db/schema.ts` (Spalten `promptStyle`, `negativePrompt` entfernen)
  - `drizzle/0012_drop_prompt_style_negative.sql` (neue Migration)
  - `drizzle/meta/_journal.json` (Journal-Eintrag fuer Migration 0012)
- **Done-Signal:** `npx drizzle-kit generate` laeuft ohne Fehler, Migration-SQL ist korrekt generiert, TypeScript-Compiler meldet keine Fehler in `schema.ts`.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 2 "DB-Migration"

---

### Slice 02: DB Queries & Prompt History Service

- **Scope:** Alle Drizzle-Queries und den Prompt-History-Service von den entfernten Spalten bereinigen: `createGeneration` Insert, `getPromptHistoryQuery` DISTINCT ON, `getFavoritesQuery` Select, `PromptHistoryEntry` Interface.
- **Deliverables:**
  - `lib/db/queries.ts` (createGeneration, getPromptHistoryQuery, getFavoritesQuery anpassen)
  - `lib/services/prompt-history-service.ts` (PromptHistoryEntry Interface + Mapping bereinigen)
- **Done-Signal:** TypeScript-Compiler fehlerfrei. Bestehende Query-Tests (`lib/db/__tests__/queries-batch.test.ts`, `lib/db/__tests__/schema-generations.test.ts`, `lib/db/__tests__/schema.test.ts`, `lib/services/__tests__/prompt-history-service.test.ts`) passen nach Anpassung und laufen gruen.
- **Dependencies:** ["slice-01"]
- **Discovery-Quelle:** Slice 2 "DB-Migration"

---

### Slice 03: Frontend Test-Infrastruktur (Mock-Daten bereinigen)

- **Scope:** Gemeinsame Test-Fixtures und Mock-Daten, die `promptStyle` oder `negativePrompt` referenzieren, zentral bereinigen. Dies betrifft Mock-Factories und geteilte Test-Utilities, die von vielen Test-Dateien importiert werden. Ohne diesen Slice wuerden nachfolgende UI-Slices an fehlenden Mock-Feldern scheitern.
- **Deliverables:**
  - Test-Fixtures/Mocks die `promptStyle`/`negativePrompt` enthalten (Dateien abhaengig vom konkreten Mock-Setup -- maximal 3 zentrale Mock-Dateien)
- **Done-Signal:** TypeScript-Compiler zeigt keine Fehler in Test-Utilities. Alle Tests, die nur Mock-Daten pruefen, laufen gruen.
- **Dependencies:** ["slice-01"]
- **Discovery-Quelle:** Slice 1 "UI + Generation Service" (Test-Aspekt), Slice 2 "DB-Migration" (Test-Aspekt)

---

### Slice 04: Generation Service & Server Action

- **Scope:** Im Generation-Service die Style-Concatenation entfernen (prompt = promptMotiv.trim(), kein negative_prompt mehr an API senden). In der Server Action `generateImages` die Parameter `promptStyle` und `negativePrompt` aus dem Interface und der Aufrufkette entfernen.
- **Deliverables:**
  - `lib/services/generation-service.ts` (Style-Concat entfernen, negative_prompt Passthrough entfernen)
  - `app/actions/generations.ts` (GenerateImagesInput Interface + Aufruf bereinigen)
- **Done-Signal:** TypeScript-Compiler fehlerfrei. Tests `lib/services/__tests__/generation-service.test.ts`, `app/actions/__tests__/generations.test.ts`, `app/actions/__tests__/generations-multi-ref.test.ts`, `app/actions/__tests__/generations-upscale.test.ts` laufen gruen nach Anpassung.
- **Dependencies:** ["slice-02"]
- **Discovery-Quelle:** Slice 1 "UI + Generation Service"

---

### Slice 05: Prompt Area UI (Hauptkomponente)

- **Scope:** In `prompt-area.tsx` die Style- und Negative-Prompt-Textareas samt Collapsible-Sections entfernen. State-Typen `Txt2ImgState` und `Img2ImgState` auf 1 Prompt-Feld vereinfachen. Label von "Motiv" auf "Prompt" aendern, Placeholder anpassen. `promptStyle`/`negativePrompt` aus dem `generateImages`-Aufruf und der Variation-Konsumierung entfernen.
- **Deliverables:**
  - `components/workspace/prompt-area.tsx` (Hauptaenderung: Felder, State, Collapsibles, generateImages-Call)
- **Done-Signal:** Komponente rendert mit einem einzigen Prompt-Feld. TypeScript-Compiler fehlerfrei. Test `lib/__tests__/workspace-state.test.ts` laeuft gruen nach Anpassung.
- **Dependencies:** ["slice-04"]
- **Discovery-Quelle:** Slice 1 "UI + Generation Service"

---

### Slice 06: Workspace State & Prompt Tabs/Lists UI

- **Scope:** `WorkspaceVariationState` in `workspace-state.tsx` um `promptStyle`/`negativePrompt` bereinigen. `PromptTabs`, `HistoryList` und `FavoritesList` von den entfernten Props befreien. Content-Check in HistoryList/FavoritesList vereinfachen.
- **Deliverables:**
  - `lib/workspace-state.tsx` (WorkspaceVariationState Interface bereinigen)
  - `components/workspace/prompt-tabs.tsx` (Props entfernen, Forwarding bereinigen)
  - `components/workspace/history-list.tsx` + `components/workspace/favorites-list.tsx` (Props + hasAnyPromptContent vereinfachen -- zaehlt als 1 Concern da identisches Pattern)
- **Done-Signal:** TypeScript-Compiler fehlerfrei. Tests `app/actions/__tests__/prompts-history.test.ts` laufen gruen.
- **Dependencies:** ["slice-04"]
- **Discovery-Quelle:** Slice 1 "UI + Generation Service" (Architecture erweitert)

---

### Slice 07: Canvas UI Bereinigung

- **Scope:** Canvas-Komponenten von `promptStyle`/`negativePrompt` bereinigen: `VariationPopover` (Interface, State, Textareas, onGenerate), `CanvasDetailView` (generateImages-Aufruf), `DetailsOverlay` (Style/Negative Sections entfernen).
- **Deliverables:**
  - `components/canvas/popovers/variation-popover.tsx` (Interface + State + Textareas + onGenerate)
  - `components/canvas/canvas-detail-view.tsx` (generateImages-Aufruf bereinigen)
  - `components/canvas/details-overlay.tsx` (Style/Negative Sections entfernen)
- **Done-Signal:** TypeScript-Compiler fehlerfrei. Canvas-Tests (ca. 20 betroffene Test-Dateien laut Architecture) laufen gruen nach Anpassung.
- **Dependencies:** ["slice-05"]
- **Discovery-Quelle:** Slice 1 "UI + Generation Service" (Architecture erweitert: Canvas-Module)

---

### Slice 08: Assistant Backend -- Python Tools & System-Prompt

- **Scope:** `draft_prompt` und `refine_prompt` Tools auf 1-Feld-Output (`{ prompt }`) umbauen. System-Prompt in `prompts.py` von 3-Felder-Anweisung auf 1 Feld aendern. `state.py` Docstring anpassen.
- **Deliverables:**
  - `backend/app/agent/tools/prompt_tools.py` (draft_prompt + refine_prompt: Return `{ prompt }`)
  - `backend/app/agent/prompts.py` (System-Prompt: 1-Feld-Anweisung)
  - `backend/app/agent/state.py` (Docstring anpassen)
- **Done-Signal:** `pytest backend/tests/unit/test_prompt_tools.py` und `pytest backend/tests/integration/test_prompt_tools_integration.py` laufen gruen nach Anpassung. Tool-Return ist `{ "prompt": "..." }`.
- **Dependencies:** ["slice-02"]
- **Discovery-Quelle:** Slice 3 "Assistant Vereinfachung"

---

### Slice 09: Assistant Backend -- Knowledge & DTO

- **Scope:** `negativePrompts`-Eintraege aus dem Prompt-Knowledge-System entfernen (JSON-Daten + Python-Formatter). `DraftPromptDTO` auf 1 Feld vereinfachen.
- **Deliverables:**
  - `data/prompt-knowledge.json` (negativePrompts aus allen 13 Model-Eintraegen entfernen)
  - `backend/app/agent/prompt_knowledge.py` (negativePrompts-Rendering entfernen)
  - `backend/app/models/dtos.py` (DraftPromptDTO: `motiv/style/negative_prompt` -> `prompt`)
- **Done-Signal:** `pytest backend/tests/acceptance/test_slice_12_prompt_tools_backend.py` laeuft gruen nach Anpassung. JSON ist valide, Formatter gibt keine negativePrompts-Section aus. DraftPromptDTO hat nur `prompt`-Feld.
- **Dependencies:** ["slice-08"]
- **Discovery-Quelle:** Slice 3 "Assistant Vereinfachung"

---

### Slice 10: Assistant Frontend Integration

- **Scope:** `DraftPrompt`-Interface in `assistant-context.tsx` auf 1 Feld umbauen (`{ prompt }` statt `{ motiv, style, negativePrompt }`). `applyToWorkspace`-Mapping, `loadSession`-Conversion und `getWorkspaceFieldsForChip` vereinfachen. SSE-Parsing in `use-assistant-runtime.ts` von 3 Feldern auf 1 Feld umstellen. Backwards-Compatibility fuer alte Sessions: `{ prompt: draft.motiv }`.
- **Deliverables:**
  - `lib/assistant/assistant-context.tsx` (DraftPrompt Interface, applyToWorkspace, loadSession, getWorkspaceFieldsForChip)
  - `lib/assistant/use-assistant-runtime.ts` (SSE-Parsing: SET_DRAFT_PROMPT Dispatch)
- **Done-Signal:** Tests `lib/assistant/__tests__/assistant-context-apply.test.tsx`, `lib/assistant/__tests__/assistant-context.test.tsx`, `lib/assistant/__tests__/assistant-context-resume.test.tsx`, `lib/assistant/__tests__/assistant-context-persistence.test.tsx`, `lib/assistant/__tests__/use-assistant-runtime.test.ts` laufen gruen nach Anpassung.
- **Dependencies:** ["slice-08"]
- **Discovery-Quelle:** Slice 3 "Assistant Vereinfachung"

---

### Slice 11: End-to-End Verifikation

- **Scope:** Sicherstellen, dass die gesamte Pipeline funktioniert: UI -> Server Action -> Generation Service -> Replicate API (kein negative_prompt). Assistant -> SSE -> Frontend -> Workspace (1 Feld). DB-Migration laeuft auf Dev-DB. Alle verbleibenden Tests (`app/actions/__tests__/get-siblings.test.ts` etc.) laufen gruen.
- **Deliverables:**
  - Keine neuen Dateien -- reine Verifikation und ggf. Restbereinigung in bis zu 3 Dateien
- **Done-Signal:** `npm run test` (Vitest, alle Suites gruen). `pytest` (alle Backend-Tests gruen). Manuelle Verifikation: Bild generieren mit einem Flux-Model ergibt keinen API-Error. Assistant-Draft wird als 1 Feld angezeigt und angewendet.
- **Dependencies:** ["slice-05", "slice-06", "slice-07", "slice-09", "slice-10"]
- **Discovery-Quelle:** Alle 3 Discovery-Slices

---

## Flow-Traceability

Die Discovery definiert keine expliziten "Integration:"-Testfaelle in einer Testability-Spalte. Stattdessen werden die kritischen Flows aus den Risiken und dem Business-Logic-Flow abgeleitet.

| Discovery-Slice | Integration-Testfall | Abgedeckt in Slice | Done-Signal |
|-----------------|----------------------|--------------------|-------------|
| Slice 1 "UI + Generation Service" | UI sendet nur promptMotiv an generateImages (keine Style/Negative Parameter) | slice-05 (Prompt Area UI) | TypeScript-Compiler erzwingt Interface-Konformitaet, generateImages-Call hat nur 1 Prompt-Param |
| Slice 1 "UI + Generation Service" | Generation Service sendet kein negative_prompt an Replicate API | slice-04 (Generation Service) | generation-service.test.ts: kein `input.negative_prompt` in API-Call |
| Slice 1 "UI + Generation Service" | Style-Concatenation entfaellt (prompt = promptMotiv.trim()) | slice-04 (Generation Service) | generation-service.test.ts: prompt ist identisch mit promptMotiv.trim() |
| Slice 1 "UI + Generation Service" | Canvas VariationPopover generiert ohne Style/Negative | slice-07 (Canvas UI) | TypeScript-Compiler + Canvas-Tests |
| Slice 2 "DB-Migration" | Migration DROP COLUMN laeuft fehlerfrei | slice-01 (DB Schema & Migration) | drizzle-kit generate erfolgreich, Migration SQL korrekt |
| Slice 2 "DB-Migration" | Queries funktionieren ohne promptStyle/negativePrompt | slice-02 (DB Queries) | queries-batch.test.ts, schema-generations.test.ts gruen |
| Slice 2 "DB-Migration" | Prompt History DISTINCT ON nur noch (prompt_motiv, model_id) | slice-02 (DB Queries) | prompt-history-service.test.ts gruen |
| Slice 3 "Assistant" | draft_prompt/refine_prompt liefern `{ prompt }` statt 3 Felder | slice-08 (Assistant Backend Tools) | test_prompt_tools.py + test_prompt_tools_integration.py gruen |
| Slice 3 "Assistant" | SSE tool-call-result wird als 1-Feld-Payload geparsed | slice-10 (Assistant Frontend) | use-assistant-runtime.test.ts gruen |
| Slice 3 "Assistant" | DraftPrompt wird korrekt auf Workspace-Prompt-Feld angewendet | slice-10 (Assistant Frontend) | assistant-context-apply.test.tsx gruen |
| Slice 3 "Assistant" | Alte Sessions mit 3-Feld-Draft werden auf `{ prompt: motiv }` gemappt | slice-10 (Assistant Frontend) | assistant-context-resume.test.tsx gruen |
| Slice 3 "Assistant" | Prompt Knowledge zeigt keine negativePrompts-Section | slice-09 (Knowledge & DTO) | test_slice_12_prompt_tools_backend.py gruen |
| Alle Slices | Kompletter Flow: UI -> Action -> Service -> API ohne Fehler bei Flux-Model | slice-11 (E2E Verifikation) | Manuelle Verifikation + alle Tests gruen |

---

## Qualitaets-Checkliste

- [x] Jeder Slice hat maximal 3 produktive Deliverable-Dateien
- [x] Jeder Slice hat ein messbares Done-Signal
- [x] Dependencies sind azyklisch (DAG)
- [x] Alle Deliverables aus Discovery UND Architecture sind abgedeckt (nichts vergessen)
- [x] Kein Slice hat mehr als ein Concern (DB+UI = zu viel)
- [x] Schema/Service-Slices kommen vor UI-Slices
- [x] Stack ist korrekt erkannt und dokumentiert
- [x] Flow-Completeness: Alle kritischen Integration-Flows haben zugehoerige Slices mit Done-Signalen

### Deliverable-Abdeckung (Vollstaendigkeitspruefung)

| Datei (aus Architecture Migration Map) | Slice |
|-----------------------------------------|-------|
| `lib/db/schema.ts` | slice-01 |
| `drizzle/0012_drop_prompt_style_negative.sql` | slice-01 |
| `drizzle/meta/_journal.json` | slice-01 |
| `lib/db/queries.ts` | slice-02 |
| `lib/services/prompt-history-service.ts` | slice-02 |
| `lib/services/generation-service.ts` | slice-04 |
| `app/actions/generations.ts` | slice-04 |
| `components/workspace/prompt-area.tsx` | slice-05 |
| `lib/workspace-state.tsx` | slice-06 |
| `components/workspace/prompt-tabs.tsx` | slice-06 |
| `components/workspace/history-list.tsx` | slice-06 |
| `components/workspace/favorites-list.tsx` | slice-06 |
| `components/canvas/popovers/variation-popover.tsx` | slice-07 |
| `components/canvas/canvas-detail-view.tsx` | slice-07 |
| `components/canvas/details-overlay.tsx` | slice-07 |
| `backend/app/agent/tools/prompt_tools.py` | slice-08 |
| `backend/app/agent/prompts.py` | slice-08 |
| `backend/app/agent/state.py` | slice-08 |
| `data/prompt-knowledge.json` | slice-09 |
| `backend/app/agent/prompt_knowledge.py` | slice-09 |
| `backend/app/models/dtos.py` | slice-09 |
| `lib/assistant/assistant-context.tsx` | slice-10 |
| `lib/assistant/use-assistant-runtime.ts` | slice-10 |
