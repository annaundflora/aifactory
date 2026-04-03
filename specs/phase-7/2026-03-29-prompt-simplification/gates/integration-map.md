# Integration Map: Prompt-Felder Vereinfachung

**Generated:** 2026-03-29
**Slices:** 11
**Connections:** 22

---

## Dependency Graph (Visual)

```
                  +-----------------------+
                  |   Slice 01            |
                  |   DB Schema &         |
                  |   Migration           |
                  +-----------+-----------+
                        |     |
            +-----------+     +----------------+
            |                                  |
            v                                  v
+-----------------------+        +-----------------------+
|   Slice 02            |        |   Slice 03            |
|   DB Queries &        |        |   Test-Infra          |
|   Prompt History      |        |   Mocks               |
+-----------+-----------+        +-----------------------+
      |     |     |                (provides factories
      |     |     |                 to slices 04-10)
      |     |     +----------------------------+
      |     |                                  |
      |     +------------------+               |
      |                        |               |
      v                        v               |
+-----------------------+  +-----------------------+
|   Slice 04            |  |   Slice 08            |
|   Generation Service  |  |   Assistant Backend   |
|   & Server Action     |  |   Tools & Prompt      |
+--+-------+----+-------+  +----------+------------+
   |       |    |                      |
   |       |    |                      v
   |       |    |          +-----------------------+
   |       |    |          |   Slice 09            |
   |       |    |          |   Assistant Knowledge |
   |       |    |          |   & DTO               |
   |       |    |          +----------+------------+
   |       |    |                     |
   v       v    v                     v
+------+ +------+         +-----------------------+
| S-05 | | S-06 |         |   Slice 10            |
+------+ +------+         |   Assistant Frontend   |
   |       |              +----------+------------+
   |       |                         |
   v       |                         |
+------+   |                         |
| S-07 |   |                         |
+------+   |                         |
   |       |                         |
   +-------+-------+-----------------+
                    |
                    v
          +-----------------------+
          |   Slice 11            |
          |   E2E Verification    |
          +-----------------------+

Legend:
  S-05 = Slice 05: Prompt Area UI
  S-06 = Slice 06: Workspace State & Tabs
  S-07 = Slice 07: Canvas UI
```

---

## Nodes

### Slice 01: DB Schema & Migration

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | `generations` Schema (bereinigt), Migration 0012 |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| -- | -- | Erster Slice, keine Abhaengigkeiten |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `generations` Schema (ohne `promptStyle`/`negativePrompt`) | Drizzle Table | Slice 02, Slice 03 |
| Migration `0012_drop_prompt_style_negative.sql` | SQL File | Slice 11 |

---

### Slice 02: DB Queries & Prompt History Service

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 01 |
| Outputs | `createGeneration`, `getPromptHistoryQuery`, `getFavoritesQuery`, `PromptHistoryEntry` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `generations` Schema (bereinigt) | Slice 01 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `createGeneration(input)` | Function | Slice 04 |
| `getPromptHistoryQuery(userId, offset, limit)` | Function | Slice 06 |
| `getFavoritesQuery(userId, offset, limit)` | Function | Slice 06 |
| `PromptHistoryEntry` | Interface | Slice 03, Slice 06 |

---

### Slice 03: Test-Infrastruktur -- Mock-Daten bereinigen

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 01, Slice 02 |
| Outputs | `makeGeneration()`, `makeEntry()` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `generations` Schema (bereinigt) | Slice 01 | VALID |
| `PromptHistoryEntry` Interface (bereinigt) | Slice 02 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `makeGeneration(overrides?)` | Factory Function | Slices 04-10 (Test-Anpassungen) |
| `makeEntry(overrides?)` | Factory Function | Slice 06 (Prompt-History/Favorites Tests) |

---

### Slice 04: Generation Service & Server Action bereinigen

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 02 |
| Outputs | `GenerationService.generate()`, `GenerateImagesInput` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `CreateGenerationInput` (bereinigt) | Slice 02 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `GenerationService.generate()` ohne `promptStyle`/`negativePrompt` | Function | Slice 05, Slice 06 |
| `GenerateImagesInput` ohne `promptStyle`/`negativePrompt` | Interface | Slice 05, Slice 06, Slice 07 |

---

### Slice 05: Prompt Area UI vereinfachen

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 04 |
| Outputs | `WorkspaceVariationState`, `PromptArea`, `PromptTabs` Props |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `GenerateImagesInput` (bereinigt) | Slice 04 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `WorkspaceVariationState` ohne `promptStyle`/`negativePrompt` | Interface | Slice 07 |
| `PromptArea` mit 1-Feld-UI | Component | -- (Endpunkt) |
| `PromptTabs` ohne `promptStyle`/`negativePrompt` Props | Interface | Slice 06 |

---

### Slice 06: Workspace State & Prompt Tabs/Lists UI

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 04 |
| Outputs | `WorkspaceVariationState`, `PromptTabs` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `GenerateImagesInput` (bereinigt) | Slice 04 | VALID |
| `PromptHistoryEntry` (bereinigt) | Slice 02 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `WorkspaceVariationState` ohne `promptStyle`/`negativePrompt` | Interface | Slice 05, Slice 07 |
| `PromptTabs` ohne `promptStyle`/`negativePrompt` Props | Component | Slice 05 |

---

### Slice 07: Canvas UI bereinigen

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 05 |
| Outputs | `VariationParams`, `DetailsOverlay` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `WorkspaceVariationState` (bereinigt) | Slice 05 | VALID |
| `GenerateImagesInput` (bereinigt) | Slice 04 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `VariationParams` ohne `promptStyle`/`negativePrompt` | Interface | -- (Endpunkt) |
| `DetailsOverlay` ohne Style/Negative Sections | Component | -- (Endpunkt) |

---

### Slice 08: Assistant Backend -- Python Tools & System-Prompt

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 02 |
| Outputs | `draft_prompt` Tool, `refine_prompt` Tool, SSE Payload, `_BASE_PROMPT` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| Bereinigte DB-Queries | Slice 02 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `draft_prompt` Tool (`{prompt}`) | LangGraph @tool | Slice 09, Slice 10 |
| `refine_prompt` Tool (`{prompt}`) | LangGraph @tool | Slice 09, Slice 10 |
| SSE `tool-call-result` Payload (`{prompt}`) | Dict | Slice 10 |
| `_BASE_PROMPT` | String-Konstante | Intern (graph.py) |

---

### Slice 09: Assistant Backend -- Knowledge & DTO

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 08 |
| Outputs | `DraftPromptDTO`, `get_session_state()`, `format_knowledge_for_prompt()`, `prompt-knowledge.json` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `draft_prompt`/`refine_prompt` Tools mit `{prompt}` Return-Shape | Slice 08 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `DraftPromptDTO(prompt: str)` | Pydantic BaseModel | Slice 10 |
| `get_session_state()` mit neuem DTO-Mapping | Method | Slice 10 |
| `format_knowledge_for_prompt()` (bereinigt) | Function | Intern (prompts.py) |
| `data/prompt-knowledge.json` (bereinigt) | JSON Data | Intern (prompt_knowledge.py) |

---

### Slice 10: Assistant Frontend -- DraftPrompt & SSE auf 1 Feld

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 08 (deklariert), Slice 09 (funktional) |
| Outputs | `DraftPrompt` Interface, `applyToWorkspace()`, `getWorkspaceFieldsForChip()` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| SSE `tool-call-result` Payload mit `{prompt}` | Slice 08 | VALID |
| Session-Restore-Response mit `draft_prompt: {prompt}` | Slice 09 | VALID -- see Semantic Consistency note |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `DraftPrompt` Interface (`{prompt}`) | TypeScript Interface | -- (UI Consumers) |
| `applyToWorkspace()` | Callback | AssistantProvider consumers |
| `getWorkspaceFieldsForChip()` | Pure Function | AssistantProvider consumers |

---

### Slice 11: End-to-End Verifikation

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 05, Slice 06, Slice 07, Slice 09, Slice 10 |
| Outputs | Verifizierter Gesamtstatus |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `PromptArea` mit 1 Textarea | Slice 05 | VALID |
| `PromptTabs`/`HistoryList`/`FavoritesList` bereinigt | Slice 06 | VALID |
| `VariationPopover`/`DetailsOverlay` bereinigt | Slice 07 | VALID |
| `DraftPromptDTO(prompt: str)` + Knowledge JSON | Slice 09 | VALID |
| `DraftPrompt {prompt}` + SSE-Parsing 1-Feld | Slice 10 | VALID |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Verifizierter Gesamtstatus | Signal | -- (Endpunkt, letzter Slice) |

---

## Connections

| # | From | To | Resource | Type | Status |
|---|------|-----|----------|------|--------|
| 1 | Slice 01 | Slice 02 | `generations` Schema (bereinigt) | Drizzle Table | VALID |
| 2 | Slice 01 | Slice 03 | `generations` Schema (bereinigt) | Drizzle Table | VALID |
| 3 | Slice 01 | Slice 11 | Migration `0012` SQL | SQL File | VALID |
| 4 | Slice 02 | Slice 03 | `PromptHistoryEntry` Interface | TypeScript Interface | VALID |
| 5 | Slice 02 | Slice 04 | `CreateGenerationInput` | Interface | VALID |
| 6 | Slice 02 | Slice 06 | `getPromptHistoryQuery` | Function | VALID |
| 7 | Slice 02 | Slice 06 | `getFavoritesQuery` | Function | VALID |
| 8 | Slice 02 | Slice 06 | `PromptHistoryEntry` | Interface | VALID |
| 9 | Slice 02 | Slice 08 | Bereinigte DB-Queries | Query Functions | VALID |
| 10 | Slice 04 | Slice 05 | `GenerateImagesInput` | Interface | VALID |
| 11 | Slice 04 | Slice 06 | `GenerateImagesInput` | Interface | VALID |
| 12 | Slice 04 | Slice 07 | `GenerateImagesInput` | Interface | VALID |
| 13 | Slice 05 | Slice 07 | `WorkspaceVariationState` | Interface | VALID |
| 14 | Slice 05 | Slice 11 | `PromptArea` mit 1 Textarea | Component | VALID |
| 15 | Slice 06 | Slice 05 | `PromptTabs` Props (bereinigt) | Interface | VALID |
| 16 | Slice 06 | Slice 11 | `PromptTabs`/`HistoryList`/`FavoritesList` | Components | VALID |
| 17 | Slice 07 | Slice 11 | `VariationPopover`/`DetailsOverlay` | Components | VALID |
| 18 | Slice 08 | Slice 09 | `draft_prompt`/`refine_prompt` mit `{prompt}` | LangGraph Tools | VALID |
| 19 | Slice 08 | Slice 10 | SSE `tool-call-result` Payload | Dict | VALID |
| 20 | Slice 09 | Slice 10 | `DraftPromptDTO` + `get_session_state()` | DTO + Method | VALID |
| 21 | Slice 09 | Slice 11 | `DraftPromptDTO` + Knowledge JSON | DTO + Data | VALID |
| 22 | Slice 10 | Slice 11 | `DraftPrompt` + SSE-Parsing | Interface + Runtime | VALID |

---

## Validation Results

### VALID Connections: 22

All declared dependencies have matching outputs.

### Orphaned Outputs: 3

| Output | Defined In | Consumers | Action |
|--------|------------|-----------|--------|
| `makeGeneration(overrides?)` | Slice 03 | Slices 04-10 (Test-Anpassungen) -- implicit, not tracked as formal deps | Acceptable: Test-infrastructure utility used ad-hoc by test-writers, not a formal contract |
| `makeEntry(overrides?)` | Slice 03 | Slice 06 (Test-Anpassungen) -- implicit | Acceptable: Same reasoning as above |
| `_BASE_PROMPT` | Slice 08 | Intern (graph.py) | Acceptable: Internal-only resource, no cross-slice consumer expected |

All 3 orphaned outputs are justified: 2 are test-infrastructure factories consumed implicitly by test-writers in later slices (not tracked as formal Integration Contract dependencies), 1 is an internal-only constant.

### Missing Inputs: 0

No missing inputs found. All declared input dependencies have matching provider slices with APPROVED status.

### Deliverable-Consumer Gaps: 0

All components defined in one slice that are consumed by pages/components in other slices have their mount points covered in the respective consumer slice deliverables.

Key verification:
- `PromptTabs` (rendered in `prompt-area.tsx`): `prompt-area.tsx` is Deliverable of Slice 05, `prompt-tabs.tsx` is Deliverable of Slice 06. Both sides covered.
- `HistoryList`/`FavoritesList` (rendered in `prompt-tabs.tsx`): `prompt-tabs.tsx` is Deliverable of Slice 06, `history-list.tsx`/`favorites-list.tsx` are also Deliverables of Slice 06. Same slice -- covered.
- `VariationPopover` (rendered in `canvas-detail-view.tsx`): Both are Deliverables of Slice 07. Same slice -- covered.
- `DetailsOverlay` (rendered in `canvas-detail-view.tsx`): Both are Deliverables of Slice 07. Same slice -- covered.

### Runtime Path Gaps: 0

**Flow 1: User generates image (txt2img)**

| Step | Component | Slice | AC | Status |
|------|-----------|-------|----|--------|
| User enters prompt | `PromptArea` (1 textarea) | Slice 05 | AC-1, AC-2, AC-6 | VALID |
| User clicks Generate | `generateImages({promptMotiv})` | Slice 05 | AC-6 | VALID |
| Server Action receives | `GenerateImagesInput` (no promptStyle/negativePrompt) | Slice 04 | AC-5, AC-6 | VALID |
| Service processes | `GenerationService.generate()` -- `prompt = promptMotiv.trim()` | Slice 04 | AC-2 | VALID |
| API call | Replicate `input.prompt` (no negative_prompt) | Slice 04 | AC-3 | VALID |
| DB insert | `createGeneration` (no promptStyle/negativePrompt) | Slice 02 | AC-1 | VALID |

**Flow 2: User views generation details in Canvas**

| Step | Component | Slice | AC | Status |
|------|-----------|-------|----|--------|
| User clicks generation | `DetailsOverlay` renders | Slice 07 | AC-7 | VALID |
| Overlay shows prompt only | No Style/Negative sections | Slice 07 | AC-7 | VALID |

**Flow 3: User creates variation from Canvas**

| Step | Component | Slice | AC | Status |
|------|-----------|-------|----|--------|
| User opens variation | `VariationPopover` (1 textarea) | Slice 07 | AC-1-4 | VALID |
| User clicks generate | `handleVariationGenerate` -> `generateImages` | Slice 07 | AC-4, AC-5 | VALID |
| Server Action | `GenerateImagesInput` (bereinigt) | Slice 04 | AC-5 | VALID |

**Flow 4: User restores prompt from history**

| Step | Component | Slice | AC | Status |
|------|-----------|-------|----|--------|
| User views history tab | `PromptTabs` -> `HistoryList` (no promptStyle/negativePrompt props) | Slice 06 | AC-2, AC-3 | VALID |
| User restores entry | `onRestore` -> `setPromptMotiv` only | Slice 05 | AC-11 | VALID |

**Flow 5: Assistant drafts a prompt via SSE**

| Step | Component | Slice | AC | Status |
|------|-----------|-------|----|--------|
| User asks assistant | LLM generates prompt | Slice 08 | AC-1, AC-5 | VALID |
| `draft_prompt` tool returns | `{prompt: string}` | Slice 08 | AC-1 | VALID |
| SSE `tool-call-result` sent | `{prompt: string}` payload | Slice 08 | AC-1 | VALID |
| Frontend parses SSE | `SET_DRAFT_PROMPT` dispatched | Slice 10 | AC-8 | VALID |
| User applies to workspace | `applyToWorkspace` maps `prompt` -> `promptMotiv` | Slice 10 | AC-2 | VALID |

**Flow 6: Session restore with old 3-field draft**

| Step | Component | Slice | AC | Status |
|------|-----------|-------|----|--------|
| Backend reads checkpoint | `get_session_state()` constructs `DraftPromptDTO(prompt=...)` | Slice 09 | AC-8 | VALID |
| Frontend loads session | `loadSession` maps `{motiv, ...}` -> `{prompt: motiv}` | Slice 10 | AC-3 | VALID |

### Semantic Consistency Gaps: 1

| Gap Type | Provider Slice | Consumer Slices | Missing | Action |
|----------|---------------|-----------------|---------|--------|
| Shared MODIFY file | Slice 05 + Slice 06 | (both modify same file) | `lib/workspace-state.tsx` is listed as a Deliverable in BOTH Slice 05 AND Slice 06, both removing `promptStyle`/`negativePrompt` from `WorkspaceVariationState` | See analysis below |

**Analysis: `lib/workspace-state.tsx` dual-modification (Slice 05 + Slice 06)**

Both Slice 05 and Slice 06 list `lib/workspace-state.tsx` as a Deliverable with the identical change: removing `promptStyle` and `negativePrompt` from `WorkspaceVariationState`.

**Impact assessment:** This is NOT a true conflict. The change is idempotent -- both slices specify removing the same two properties from the same interface. Whichever slice executes first will perform the change; the second slice will find the change already applied. Since both depend on Slice 04 (and not on each other for this specific file), they can execute in either order.

**Mitigation:** The orchestrator MUST sequence Slice 05 and Slice 06 to execute either (a) sequentially (Slice 06 first since it owns the state file and Slice 05 consumes it), or (b) the orchestrator notes that the `WorkspaceVariationState` change in `lib/workspace-state.tsx` is the SAME change in both slices and is idempotent. The recommended order is Slice 06 before Slice 05, since Slice 06 is the "owner" of `workspace-state.tsx` (4 deliverables including the state file) while Slice 05 is the "consumer" of the state.

**Verdict:** Not blocking. Idempotent change, but orchestrator ordering must be documented.

---

## Discovery Traceability

### Scope Items Coverage

| Discovery Element | Type | Covered In | Status |
|-------------------|------|------------|--------|
| UI: Style/Modifier und Negative Prompt Textareas aus prompt-area.tsx entfernen | UI | Slice 05 | COVERED |
| UI: Per-Mode State (Txt2ImgState, Img2ImgState) auf 1 Prompt-Feld vereinfachen | UI | Slice 05 | COVERED |
| UI: Canvas VariationPopover promptStyle/negativePrompt entfernen | UI | Slice 07 | COVERED |
| UI: Canvas DetailsOverlay Style/Negative-Sections entfernen | UI | Slice 07 | COVERED |
| UI: PromptTabs/HistoryList/FavoritesList promptStyle/negativePrompt Props entfernen | UI | Slice 06 | COVERED |
| Generation-Service: negative_prompt nicht mehr an API senden | Service | Slice 04 | COVERED |
| Generation-Service: Style-Concatenation entfernen | Service | Slice 04 | COVERED |
| Server Action: promptStyle/negativePrompt Parameter aus generateImages entfernen | Action | Slice 04 | COVERED |
| Assistant Backend: prompt_tools.py auf 1-Feld-Output umbauen | Backend | Slice 08 | COVERED |
| Assistant Backend: prompts.py System-Prompt anpassen | Backend | Slice 08 | COVERED |
| Assistant Backend: DraftPromptDTO auf 1 Feld | Backend | Slice 09 | COVERED |
| Assistant Backend: state.py draft_prompt vereinfachen | Backend | Slice 08 | COVERED |
| Assistant Frontend: assistant-context.tsx DraftPrompt auf 1 Feld | Frontend | Slice 10 | COVERED |
| Assistant Frontend: use-assistant-runtime.ts SSE-Parsing vereinfachen | Frontend | Slice 10 | COVERED |
| Assistant Frontend: getWorkspaceFieldsForChip auf 1 Feld | Frontend | Slice 10 | COVERED |
| Prompt Knowledge: negativePrompts-Eintraege entfernen (JSON + Python) | Data | Slice 09 | COVERED |
| DB: Spalten prompt_style und negative_prompt per Migration entfernen | DB | Slice 01 | COVERED |
| DB: Queries anpassen (createGeneration, getPromptHistory, getFavorites) | DB | Slice 02 | COVERED |
| Prompt History Service: promptStyle/negativePrompt entfernen | Service | Slice 02 | COVERED |
| WorkspaceVariationState: promptStyle/negativePrompt entfernen | State | Slice 05 + Slice 06 | COVERED |
| Tests: Alle betroffenen Tests anpassen | Tests | Slice 03 (infrastructure) + Slices 04-11 (per-slice) | COVERED |

### Betroffene Dateien Coverage

| File | Discovery Section | Covered In | Status |
|------|-------------------|------------|--------|
| `components/workspace/prompt-area.tsx` | Frontend UI | Slice 05 | COVERED |
| `lib/assistant/assistant-context.tsx` | Frontend Assistant | Slice 10 | COVERED |
| `lib/assistant/use-assistant-runtime.ts` | Frontend Assistant | Slice 10 | COVERED |
| `lib/services/generation-service.ts` | Backend Generation | Slice 04 | COVERED |
| `app/actions/generations.ts` | Backend Generation | Slice 04 | COVERED |
| `backend/app/agent/tools/prompt_tools.py` | Backend Assistant | Slice 08 | COVERED |
| `backend/app/agent/prompts.py` | Backend Assistant | Slice 08 | COVERED |
| `backend/app/agent/state.py` | Backend Assistant | Slice 08 | COVERED |
| `backend/app/agent/prompt_knowledge.py` | Backend Knowledge | Slice 09 | COVERED |
| `data/prompt-knowledge.json` | Backend Knowledge | Slice 09 | COVERED |
| `backend/app/models/dtos.py` | Backend DTO | Slice 09 | COVERED |
| `backend/app/services/assistant_service.py` | Backend Service | Slice 09 | COVERED |
| `lib/db/schema.ts` | Database | Slice 01 | COVERED |
| `lib/db/queries.ts` | Database | Slice 02 | COVERED |
| `drizzle/0012_drop_prompt_style_negative.sql` | Database | Slice 01 | COVERED |
| `lib/services/prompt-history-service.ts` | Services | Slice 02 | COVERED |
| `lib/workspace-state.tsx` | Frontend State | Slice 05 + 06 | COVERED |
| `components/workspace/prompt-tabs.tsx` | Frontend UI | Slice 06 | COVERED |
| `components/workspace/history-list.tsx` | Frontend UI | Slice 06 | COVERED |
| `components/workspace/favorites-list.tsx` | Frontend UI | Slice 06 | COVERED |
| `components/canvas/popovers/variation-popover.tsx` | Frontend UI | Slice 07 | COVERED |
| `components/canvas/canvas-detail-view.tsx` | Frontend UI | Slice 07 | COVERED |
| `components/canvas/details-overlay.tsx` | Frontend UI | Slice 07 | COVERED |

### Business Rules Coverage

| Rule | Covered In | Status |
|------|------------|--------|
| negative_prompt nicht mehr an Replicate API senden | Slice 04 AC-3 | COVERED |
| Style-Concatenation entfernen (prompt = promptMotiv.trim()) | Slice 04 AC-2 | COVERED |
| UI auf 1 Prompt-Feld reduzieren | Slice 05 AC-1, AC-2, AC-3 | COVERED |
| Assistant gibt nur noch `{prompt}` zurueck | Slice 08 AC-1, AC-4 | COVERED |
| DraftPromptDTO vereinfachen auf 1 Feld | Slice 09 AC-4, AC-5, AC-6 | COVERED |
| SSE-Payload aendern auf `{prompt}` | Slice 08 + Slice 10 AC-8 | COVERED |
| Alte Sessions mit 3-Feld-Format graceful handeln | Slice 10 AC-3 | COVERED |
| DB-Spalten prompt_style und negative_prompt entfernen | Slice 01 AC-1, AC-2 | COVERED |
| DISTINCT ON vereinfachen auf 2 Felder | Slice 02 AC-2 | COVERED |
| Prompt Knowledge: negativePrompts entfernen | Slice 09 AC-1, AC-2 | COVERED |

### Risiken Coverage

| Risiko (Discovery) | Mitigation Covered In | Status |
|----|---------|--------|
| Historische Daten verloren | Slice 01 Constraints (akzeptiert) | COVERED |
| Prompt History DISTINCT aendert sich | Slice 02 AC-2 | COVERED |
| SSE Breaking Change | Slice 08 + 10 (atomic deploy) | COVERED |
| Laufende Sessions mit altem Format | Slice 10 AC-3, AC-5 | COVERED |

**Discovery Coverage:** 23/23 scope items (100%)

---

## Infrastructure Prerequisite Check

### Health Endpoints

| Endpoint | Stack | Found | Status |
|----------|-------|-------|--------|
| `http://localhost:3000` | Next.js (Frontend) | Default Next.js dev server | VALID |
| `http://localhost:8000/health` | FastAPI (Backend) | Route defined at `backend/app/routes/health.py:8` mounted at `/api/assistant/health` | VALID -- Note: actual URL is `http://localhost:8000/api/assistant/health` |

**Note for Orchestrator:** Backend health endpoint is at `http://localhost:8000/api/assistant/health` (not `/health`). Slices 08 and 09 reference `http://localhost:8000/health` which should be corrected in health checks to use the actual path.

---

## Summary

| Metric | Value |
|--------|-------|
| Total Slices | 11 |
| Total Connections | 22 |
| Valid Connections | 22 |
| Orphaned Outputs | 3 (all justified) |
| Missing Inputs | 0 |
| Deliverable-Consumer Gaps | 0 |
| Runtime Path Gaps | 0 |
| Semantic Consistency Gaps | 1 (non-blocking, idempotent shared file) |
| Discovery Coverage | 23/23 (100%) |

**VERDICT: READY FOR ORCHESTRATION**
