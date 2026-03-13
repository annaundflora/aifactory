# Slice 3: CanvasDetailContext (State Management)

> **Slice 3 von 18** fuer `Canvas Detail-View & Editing Flow`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-03-canvas-detail-context` |
| **Test** | `pnpm test lib/__tests__/canvas-detail-context.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-batch-id-service-queries"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/__tests__/canvas-detail-context.test.ts` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | `pnpm test lib/__tests__/canvas-detail-context.test.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

React Context mit useReducer fuer den gesamten Detail-View-State bereitstellen. Der Reducer verwaltet aktuelles Bild, aktives Tool, Undo/Redo-Stacks, Generating-Status, Chat-Session und selektiertes Model. Grundlage fuer alle nachfolgenden UI-Slices (5-18).

---

## Acceptance Criteria

1) GIVEN ein frisch initialisierter CanvasDetailContext mit `currentGenerationId: "gen-abc-123"`
   WHEN der State abgefragt wird
   THEN enthaelt er `currentGenerationId: "gen-abc-123"`, `activeToolId: null`, `undoStack: []`, `redoStack: []`, `isGenerating: false`, `chatSessionId: null`, `selectedModelId: null`

2) GIVEN der Reducer im Initialzustand
   WHEN Action `SET_CURRENT_IMAGE` mit `{ generationId: "gen-xyz-789" }` dispatcht wird
   THEN ist `currentGenerationId` gleich `"gen-xyz-789"`

3) GIVEN der Reducer mit `activeToolId: null`
   WHEN Action `SET_ACTIVE_TOOL` mit `{ toolId: "variation" }` dispatcht wird
   THEN ist `activeToolId` gleich `"variation"`

4) GIVEN der Reducer mit `activeToolId: "variation"`
   WHEN Action `SET_ACTIVE_TOOL` mit `{ toolId: "variation" }` dispatcht wird (gleiches Tool erneut)
   THEN ist `activeToolId` gleich `null` (Toggle-Verhalten)

5) GIVEN der Reducer mit `currentGenerationId: "gen-B"` und `undoStack: ["gen-A"]`
   WHEN Action `PUSH_UNDO` mit `{ generationId: "gen-C" }` dispatcht wird
   THEN ist `undoStack` gleich `["gen-A", "gen-B"]` und `currentGenerationId` gleich `"gen-C"` und `redoStack` gleich `[]`

6) GIVEN der Reducer mit `currentGenerationId: "gen-B"`, `undoStack: ["gen-A"]`, `redoStack: []`
   WHEN Action `POP_UNDO` dispatcht wird
   THEN ist `currentGenerationId` gleich `"gen-A"`, `undoStack` gleich `[]`, `redoStack` gleich `["gen-B"]`

7) GIVEN der Reducer mit `undoStack: []`
   WHEN Action `POP_UNDO` dispatcht wird
   THEN bleibt der State unveraendert (No-Op)

8) GIVEN der Reducer mit `currentGenerationId: "gen-A"`, `redoStack: ["gen-B"]`, `undoStack: []`
   WHEN Action `POP_REDO` dispatcht wird
   THEN ist `currentGenerationId` gleich `"gen-B"`, `redoStack` gleich `[]`, `undoStack` gleich `["gen-A"]`

9) GIVEN der Reducer mit `redoStack: []`
   WHEN Action `POP_REDO` dispatcht wird
   THEN bleibt der State unveraendert (No-Op)

10) GIVEN der Reducer mit `redoStack: ["gen-X", "gen-Y"]`
    WHEN Action `CLEAR_REDO` dispatcht wird
    THEN ist `redoStack` gleich `[]`

11) GIVEN der Reducer mit `undoStack` das bereits 20 Eintraege enthaelt
    WHEN Action `PUSH_UNDO` dispatcht wird
    THEN hat `undoStack` weiterhin maximal 20 Eintraege (aeltester Eintrag an Index 0 wird entfernt)

12) GIVEN der Reducer mit `isGenerating: false`
    WHEN Action `SET_GENERATING` mit `{ isGenerating: true }` dispatcht wird
    THEN ist `isGenerating` gleich `true`

13) GIVEN eine React-Komponente die `useCanvasDetail()` ohne umgebenden `CanvasDetailProvider` aufruft
    WHEN der Hook ausgefuehrt wird
    THEN wird ein Error geworfen (z.B. "useCanvasDetail must be used within CanvasDetailProvider")

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/__tests__/canvas-detail-context.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('canvasDetailReducer', () => {
  // AC-1: Initialzustand korrekt
  it.todo('should initialize with correct default values for all state fields')

  // AC-2: SET_CURRENT_IMAGE aendert currentGenerationId
  it.todo('should set currentGenerationId when SET_CURRENT_IMAGE is dispatched')

  // AC-3: SET_ACTIVE_TOOL setzt activeToolId
  it.todo('should set activeToolId when SET_ACTIVE_TOOL is dispatched')

  // AC-4: SET_ACTIVE_TOOL toggled bei gleichem Tool
  it.todo('should toggle activeToolId to null when same tool is dispatched again')

  // AC-5: PUSH_UNDO verschiebt aktuelles Bild in undoStack und setzt neues Bild, leert redoStack
  it.todo('should push current image to undo stack, set new image, and clear redo stack on PUSH_UNDO')

  // AC-6: POP_UNDO stellt vorheriges Bild wieder her
  it.todo('should restore previous image from undo stack and push current to redo stack on POP_UNDO')

  // AC-7: POP_UNDO bei leerem Stack ist No-Op
  it.todo('should not change state when POP_UNDO is dispatched with empty undo stack')

  // AC-8: POP_REDO stellt naechstes Bild wieder her
  it.todo('should restore next image from redo stack and push current to undo stack on POP_REDO')

  // AC-9: POP_REDO bei leerem Stack ist No-Op
  it.todo('should not change state when POP_REDO is dispatched with empty redo stack')

  // AC-10: CLEAR_REDO leert den Redo-Stack
  it.todo('should clear redo stack when CLEAR_REDO is dispatched')

  // AC-11: Undo-Stack Maximum 20 Eintraege
  it.todo('should cap undo stack at 20 entries by removing oldest entry')

  // AC-12: SET_GENERATING aendert isGenerating
  it.todo('should set isGenerating when SET_GENERATING is dispatched')
})

describe('useCanvasDetail', () => {
  // AC-13: Hook ohne Provider wirft Error
  it.todo('should throw error when used outside of CanvasDetailProvider')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-02-batch-id-service-queries` | `Generation["batchId"]` | TypeScript Type | Type existiert als `string \| null` im Generation-Typ (fuer zukuenftige Sibling-Referenz im Context) |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `CanvasDetailProvider` | React Context Provider | `slice-05-detail-view-shell` | `<CanvasDetailProvider initialGenerationId={string}>` |
| `useCanvasDetail()` | React Hook | `slice-05` bis `slice-18` | `() => { state: CanvasDetailState, dispatch: Dispatch<CanvasDetailAction> }` |
| `canvasDetailReducer` | Reducer Function | `slice-15-undo-redo` | `(state: CanvasDetailState, action: CanvasDetailAction) => CanvasDetailState` |
| `CanvasDetailAction` | Union Type | `slice-05` bis `slice-18` | Actions: `SET_CURRENT_IMAGE`, `SET_ACTIVE_TOOL`, `PUSH_UNDO`, `POP_UNDO`, `POP_REDO`, `CLEAR_REDO`, `SET_GENERATING`, `SET_CHAT_SESSION`, `SET_SELECTED_MODEL` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/canvas-detail-context.tsx` — Context, Provider, Reducer, Actions-Types und `useCanvasDetail()` Hook
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE UI-Komponenten (kein JSX ausser Provider-Wrapper)
- KEINE Keyboard-Shortcut-Handler (das ist Slice 15)
- KEINE Server Actions oder API-Aufrufe
- KEINE Abhaengigkeit von DOM oder Browser-APIs
- KEIN chatMessages-Array im State (Chat verwaltet eigenen State in Slice 9/17)

**Technische Constraints:**
- `useReducer` Pattern analog zu bestehendem `WorkspaceVariationContext` in `lib/workspace-state.tsx`
- `"use client"` Direktive erforderlich
- Undo-Stack Maximum: 20 Eintraege (aelteste werden entfernt wenn Limit ueberschritten)
- Reducer muss pure function sein (keine Side-Effects)
- Alle Action-Types als discriminated union exportieren

**Referenzen:**
- Architecture: `specs/phase-4/2026-03-13-canvas-detail-view/architecture.md` → Section "Architecture Layers" (Context + Reducer Pattern)
- Architecture: `specs/phase-4/2026-03-13-canvas-detail-view/architecture.md` → Section "Technology Decisions" (React Context + useReducer)
- Discovery: `specs/phase-4/2026-03-13-canvas-detail-view/discovery.md` → Section "Business Rules" (Undo-Stack Maximum 20, Redo-Verhalten, Generating-State)
- Discovery: `specs/phase-4/2026-03-13-canvas-detail-view/discovery.md` → Section "Data" (State-Felder und Validierung)
- Bestehendes Pattern: `lib/workspace-state.tsx` → Context/Provider-Pattern als Referenz
