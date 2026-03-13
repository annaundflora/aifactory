# Integration Map: Canvas Detail-View & Editing Flow

**Generated:** 2026-03-13
**Slices:** 18
**Connections:** 42

---

## Dependency Graph (Visual)

```
                    ┌──────────────────────┐
                    │  Slice 01            │
                    │  DB Schema batchId   │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Slice 02            │
                    │  batchId Service +   │
                    │  Queries             │
                    └──────┬───────┬───────┘
                           │       │
              ┌────────────▼──┐  ┌─▼──────────────┐
              │  Slice 03     │  │  Slice 04       │
              │  Context      │  │  getSiblings    │
              │  (Reducer)    │  │  Action          │
              └──────┬────────┘  └────────┬────────┘
                     │                    │
              ┌──────▼────────────────────┤
              │  Slice 05                 │
              │  Detail-View Shell        │
              └──┬────┬────┬─────┬───────┘
                 │    │    │     │
    ┌────────────▼┐ ┌─▼────▼──┐ ┌▼────────────────┐
    │  Slice 06   │ │ Slice 07│ │  Slice 09        │
    │  Animated   │ │ Toolbar │ │  Chat Panel UI   │
    │  Transition │ │ UI      │ └──────┬───────────┘
    └─────────────┘ └─┬──┬──┬┘        │
                      │  │  │         │
        ┌─────────────▼┐ │ ┌▼──────┐  │
        │  Slice 10    │ │ │Sl. 11 │  │
        │  Details     │ │ │Variat.│  │
        │  Overlay     │ │ │Popov. │  │
        └──────────────┘ │ └───┬───┘  │
                         │     │      │
              ┌──────────▼──┐  │      │
              │  Slice 12   │  │      │
              │  img2img    │  │      │
              │  Popover    │  │      │
              └──────┬──────┘  │      │
                     │         │      │
              ┌──────▼──┐      │      │
              │ Slice 13│      │      │
              │ Upscale │      │      │
              │ Popover │      │      │
              └────┬────┘      │      │
                   │           │      │
              ┌────▼───────────▼──────┤
              │  Slice 14             │
              │  In-Place Generation  │
              └──────────┬────────────┘
                         │
              ┌──────────▼────────────┐
              │  Slice 15             │
              │  Undo/Redo            │
              └──────────┬────────────┘
                         │
              ┌──────────▼────────────┐
              │  Slice 16             │
              │  Canvas Agent Backend │
              └──────────┬────────────┘
                         │
              ┌──────────▼────────────┐
              │  Slice 17             │
              │  Chat Frontend Integ. │◄── Slice 09, 14, 16
              └───────────────────────┘

              ┌───────────────────────┐
              │  Slice 18             │◄── Slice 05, 08
              │  Lightbox Removal     │
              └───────────────────────┘

  ┌───────────────────┐
  │ Slice 08          │◄── Slice 04, 05
  │ Siblings +        │
  │ Prev/Next Nav     │
  └───────────────────┘
```

---

## Nodes

### Slice 01: DB Schema -- batchId Column

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | `generations.batchId` column, `generations_batch_id_idx` index, `Generation["batchId"]` TypeScript type |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| -- | -- | First slice, no inputs |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `generations.batchId` | Schema Column | slice-02 |
| `generations_batch_id_idx` | DB Index | slice-02 |
| `Generation["batchId"]` | TypeScript Type | slice-02, slice-04 |

---

### Slice 02: batchId in GenerationService + Queries

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-01 |
| Outputs | `CreateGenerationInput.batchId`, `getSiblingsByBatchId()`, `GenerationService.generate()` (batchId) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `generations.batchId` column | Slice 01 | Column exists in Drizzle schema |
| `generations_batch_id_idx` index | Slice 01 | Index exists for WHERE queries |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `CreateGenerationInput.batchId` | Type Extension | Internal |
| `getSiblingsByBatchId()` | Query Function | slice-04 |
| `GenerationService.generate()` (batchId) | Service Enhancement | All subsequent slices |

---

### Slice 03: CanvasDetailContext (State Management)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-02 |
| Outputs | `CanvasDetailProvider`, `useCanvasDetail()`, `canvasDetailReducer`, `CanvasDetailAction` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `Generation["batchId"]` | Slice 02 | Type exists as `string \| null` |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `CanvasDetailProvider` | React Context Provider | slice-05 |
| `useCanvasDetail()` | React Hook | slice-05 through slice-18 |
| `canvasDetailReducer` | Reducer Function | slice-15 |
| `CanvasDetailAction` | Union Type | slice-05 through slice-18 |

---

### Slice 04: getSiblingGenerations Server Action

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-02 |
| Outputs | `getSiblingGenerations()` server action |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `getSiblingsByBatchId()` | Slice 02 | `(batchId: string \| null) => Promise<Generation[]>` |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `getSiblingGenerations()` | Server Action | slice-08 |

---

### Slice 05: Detail-View Shell (Layout + Mounting)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-03 |
| Outputs | `CanvasDetailView`, `CanvasHeader`, Layout Slots, `detailViewOpen` state |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `CanvasDetailProvider` | Slice 03 | `<CanvasDetailProvider initialGenerationId={string}>` |
| `useCanvasDetail()` | Slice 03 | `() => { state, dispatch }` |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `CanvasDetailView` | React Component | slice-06 through slice-15 |
| `CanvasHeader` | React Component | slice-14, slice-15 |
| Toolbar-Slot (left, 48px) | Layout Slot | slice-07 |
| Chat-Slot (right) | Layout Slot | slice-09 |
| `detailViewOpen` State | WorkspaceContent State | slice-18 |

---

### Slice 06: Animated Transition (Gallery <-> Detail)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-05 |
| Outputs | `viewTransitionName` CSS property, `experimental.viewTransition` config, Transition-Wrapper-Pattern |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `CanvasDetailView` | Slice 05 | Existing Fullscreen-Shell |
| `WorkspaceContent` detailViewOpen-State | Slice 05 | State + callbacks |
| `CanvasHeader` onBack | Slice 05 | `() => void` callback |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `viewTransitionName` on Canvas-Image | CSS Property | slice-08, slice-14 |
| `experimental.viewTransition` Config | Next.js Config Flag | All slices |
| Transition-Wrapper-Pattern | Function | slice-18 |

---

### Slice 07: Toolbar UI (Icon Bar)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-05 |
| Outputs | `CanvasToolbar`, `ToolbarButton`, `activeToolId` State-Changes |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `useCanvasDetail()` | Slice 03 | `state.activeToolId`, `state.isGenerating`, `dispatch(SET_ACTIVE_TOOL)` |
| Toolbar-Slot (left column, 48px) | Slice 05 | CanvasDetailView renders toolbar in left slot |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `CanvasToolbar` | React Component | slice-05 (Toolbar-Slot) |
| `ToolbarButton` | React Component | Internal |
| `activeToolId` State-Changes | Context Dispatch | slice-10, slice-11, slice-12, slice-13 |

---

### Slice 08: Siblings + Prev/Next Navigation

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-04, slice-05 |
| Outputs | `SiblingThumbnails`, `CanvasNavigation`, `CanvasImage` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `getSiblingGenerations()` | Slice 04 | `(batchId: string \| null) => Promise<Generation[]>` |
| `CanvasDetailView` | Slice 05 | Layout-Shell with Canvas area |
| `useCanvasDetail()` | Slice 03 | `() => { state: { currentGenerationId }, dispatch }` |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `SiblingThumbnails` | React Component | slice-05 (Canvas area) |
| `CanvasNavigation` | React Component | slice-05 (Canvas area), slice-18 |
| `CanvasImage` | React Component | slice-14, slice-05 |

---

### Slice 09: Chat Panel UI (Shell + Messages)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-05 |
| Outputs | `CanvasChatPanel`, `CanvasChatMessages`, `CanvasChatInput`, Chat-Message-Types |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| Chat-Slot (right column) | Slice 05 | Panel renders in right slot |
| `CanvasDetailView` generation Prop | Slice 05 | Access to generation metadata |
| `useCanvasDetail()` | Slice 03 | `currentGenerationId` for context |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `CanvasChatPanel` | React Component | slice-17 |
| `CanvasChatMessages` | React Component | slice-17 |
| `CanvasChatInput` | React Component | slice-17 |
| `ChatMessage` Type | TypeScript Type | slice-17 |

---

### Slice 10: Details Overlay

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-07 |
| Outputs | `DetailsOverlay` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `useCanvasDetail()` | Slice 03 | `state.activeToolId`, `dispatch(SET_ACTIVE_TOOL)` |
| `activeToolId === "details"` | Slice 07 | State signal |
| `ProvenanceRow` | Existing | `<ProvenanceRow generationId={string} />` |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `DetailsOverlay` | React Component | slice-05 (Canvas area) |

---

### Slice 11: Variation Popover

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-07 |
| Outputs | `VariationPopover`, `VariationParams` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `useCanvasDetail()` | Slice 03 | `state.activeToolId`, `dispatch(SET_ACTIVE_TOOL)` |
| `activeToolId === "variation"` | Slice 07 | Context State |
| Current Generation (prompt) | Slice 05 | `generation.prompt` for prefill |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `VariationPopover` | React Component | slice-05 / slice-14 |
| `VariationParams` | TypeScript Type | slice-14 |

---

### Slice 12: img2img Popover

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-07 |
| Outputs | `Img2imgPopover`, `Img2imgParams` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `useCanvasDetail()` | Slice 03 | `state.activeToolId`, `dispatch(SET_ACTIVE_TOOL)` |
| `activeToolId` State-Changes | Slice 07 | Popover opens/closes based on activeToolId |
| `ReferenceBar`, `ReferenceSlot`, `ImageDropzone` | Existing | Reused components |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `Img2imgPopover` | React Component | slice-14 |
| `Img2imgParams` | TypeScript Type | slice-14 |

---

### Slice 13: Upscale Popover

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-07 |
| Outputs | `UpscalePopover` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `useCanvasDetail()` | Slice 03 | `state.activeToolId`, `dispatch(SET_ACTIVE_TOOL)` |
| `activeToolId === "upscale"` | Slice 07 | Context State |
| `ToolbarButton` disabled-Prop | Slice 07 | Disabled state for upscale icon |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `UpscalePopover` | React Component | slice-05 / slice-14 |

---

### Slice 14: In-Place Generation + Polling Integration

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-11, slice-12, slice-13 |
| Outputs | `isGenerating` State-Reaction, Undo-Stack Push, `CanvasModelSelector`, Generation-Flow Pattern |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `useCanvasDetail()` | Slice 03 | Multiple state fields and dispatch actions |
| `CanvasDetailView` | Slice 05 | Mounting-Container |
| `CanvasImage` | Slice 08 | Extended with Loading-Overlay |
| `VariationPopover.onGenerate` | Slice 11 | `(params: VariationParams) => void` |
| `Img2imgPopover.onGenerate` | Slice 12 | `(params: Img2imgParams) => void` |
| `UpscalePopover.onUpscale` | Slice 13 | `(params: { scale: 2 \| 4 }) => void` |
| `generateImages()` | Existing | Server Action |
| `upscaleImage()` | Existing | Server Action |
| Polling-Mechanismus | Existing | WorkspaceContent 3s interval |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `isGenerating` State-Reaction | Context Dispatch | slice-15 |
| Undo-Stack Push bei Replace | Context Dispatch | slice-15 |
| `CanvasModelSelector` | React Component | slice-05 (Header-Slot) |
| Generation-Flow Pattern | Architecture | slice-17 |

---

### Slice 15: Undo/Redo Stack (Keyboard + UI)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-14 |
| Outputs | Undo/Redo-Buttons in Header, Keyboard-Shortcut-Handler |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `useCanvasDetail()` | Slice 03 | `state.undoStack`, `state.redoStack`, `state.isGenerating`, `dispatch(POP_UNDO/POP_REDO)` |
| `canvasDetailReducer` | Slice 03 | PUSH_UNDO clears redoStack |
| `CanvasHeader` | Slice 05 | Children-Slots for Undo/Redo buttons |
| `isGenerating` State | Slice 14 | true during generation, disables Undo/Redo |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Undo/Redo-Buttons in Header | React UI | slice-16, slice-17 (auto-react to stack changes) |
| Keyboard-Shortcut-Handler | useEffect | No direct consumers |

---

### Slice 16: Canvas Agent Backend

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-15 |
| Outputs | Canvas Session/Message REST endpoints, `canvas-generate` SSE Event |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `AssistantService` | Existing | SSE-Streaming pattern |
| `create_agent()` | Existing | Graph structure as template |
| `SessionRepository` | Existing | Session-CRUD |
| `MemorySaver` / `PostgresSaver` | Existing | Checkpointer |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `POST /api/assistant/canvas/sessions` | REST Endpoint | slice-17 |
| `POST /api/assistant/canvas/sessions/{id}/messages` | SSE Endpoint | slice-17 |
| `canvas-generate` SSE Event | Event Schema | slice-17 |

---

### Slice 17: Canvas Chat Frontend Integration

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-09, slice-14, slice-16 |
| Outputs | `canvasChatService`, Chat-Backend-Integration |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `CanvasChatPanel`, `CanvasChatMessages`, `CanvasChatInput` | Slice 09 | React Components to extend |
| `ChatMessage` Type | Slice 09 | Base type for streaming messages |
| Generation-Flow Pattern | Slice 14 | `generateImages()` -> Polling -> Replace |
| `isGenerating` State | Slice 14 | Disable Chat-Input during generation |
| `POST /api/assistant/canvas/sessions` | Slice 16 | REST Endpoint |
| `POST /api/assistant/canvas/sessions/{id}/messages` | Slice 16 | SSE Endpoint |
| `useCanvasDetail()` | Slice 03 | `currentGenerationId`, `isGenerating`, `dispatch` |
| `generateImages()` | Existing | Server Action |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `canvasChatService` | Service Module | Internal |
| Chat-Backend-Integration | Feature-Complete | slice-18 |

---

### Slice 18: Lightbox Removal + Cleanup

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-08 |
| Outputs | Cleaned `workspace-content.tsx` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `CanvasNavigation` | Slice 08 | Replaces LightboxNavigation |
| `CanvasDetailView` | Slice 05 | Replaces LightboxModal |
| `detailViewOpen` State | Slice 05 | Replaces `lightboxOpen` |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Cleaned `workspace-content.tsx` | Refactored File | All subsequent work |

---

## Connections

| # | From | To | Resource | Type | Status |
|---|------|-----|----------|------|--------|
| 1 | Slice 01 | Slice 02 | `generations.batchId` column | Schema Column | validated |
| 2 | Slice 01 | Slice 02 | `generations_batch_id_idx` index | DB Index | validated |
| 3 | Slice 01 | Slice 02 | `Generation["batchId"]` type | TypeScript Type | validated |
| 4 | Slice 02 | Slice 03 | `Generation["batchId"]` type | TypeScript Type | validated |
| 5 | Slice 02 | Slice 04 | `getSiblingsByBatchId()` | Query Function | validated |
| 6 | Slice 03 | Slice 05 | `CanvasDetailProvider` | React Context Provider | validated |
| 7 | Slice 03 | Slice 05 | `useCanvasDetail()` | React Hook | validated |
| 8 | Slice 03 | Slice 07 | `useCanvasDetail()` | React Hook | validated |
| 9 | Slice 03 | Slice 08 | `useCanvasDetail()` | React Hook | validated |
| 10 | Slice 03 | Slice 09 | `useCanvasDetail()` | React Hook | validated |
| 11 | Slice 03 | Slice 10 | `useCanvasDetail()` | React Hook | validated |
| 12 | Slice 03 | Slice 11 | `useCanvasDetail()` | React Hook | validated |
| 13 | Slice 03 | Slice 12 | `useCanvasDetail()` | React Hook | validated |
| 14 | Slice 03 | Slice 13 | `useCanvasDetail()` | React Hook | validated |
| 15 | Slice 03 | Slice 14 | `useCanvasDetail()` | React Hook | validated |
| 16 | Slice 03 | Slice 15 | `useCanvasDetail()`, `canvasDetailReducer` | React Hook + Reducer | validated |
| 17 | Slice 03 | Slice 17 | `useCanvasDetail()` | React Hook | validated |
| 18 | Slice 04 | Slice 08 | `getSiblingGenerations()` | Server Action | validated |
| 19 | Slice 05 | Slice 06 | `CanvasDetailView`, `WorkspaceContent` state, `CanvasHeader` | Component + State + Callback | validated |
| 20 | Slice 05 | Slice 07 | Toolbar-Slot (48px) | Layout Slot | validated |
| 21 | Slice 05 | Slice 08 | `CanvasDetailView` (Canvas area) | Layout | validated |
| 22 | Slice 05 | Slice 09 | Chat-Slot (right) | Layout Slot | validated |
| 23 | Slice 05 | Slice 14 | `CanvasDetailView`, `CanvasHeader` | Component | validated |
| 24 | Slice 05 | Slice 15 | `CanvasHeader` | Component (children-Slots) | validated |
| 25 | Slice 05 | Slice 18 | `CanvasDetailView`, `detailViewOpen` State | Component + State | validated |
| 26 | Slice 07 | Slice 10 | `activeToolId === "details"` | State-Signal | validated |
| 27 | Slice 07 | Slice 11 | `activeToolId === "variation"` | Context State | validated |
| 28 | Slice 07 | Slice 12 | `activeToolId === "img2img"` | Context State | validated |
| 29 | Slice 07 | Slice 13 | `activeToolId === "upscale"` | Context State | validated |
| 30 | Slice 08 | Slice 14 | `CanvasImage` | React Component | validated |
| 31 | Slice 08 | Slice 18 | `CanvasNavigation` | React Component | validated |
| 32 | Slice 09 | Slice 17 | `CanvasChatPanel`, `CanvasChatMessages`, `CanvasChatInput` | React Components | validated |
| 33 | Slice 09 | Slice 17 | `ChatMessage` Type | TypeScript Type | validated |
| 34 | Slice 11 | Slice 14 | `VariationPopover.onGenerate` | Callback | validated |
| 35 | Slice 12 | Slice 14 | `Img2imgPopover.onGenerate` | Callback | validated |
| 36 | Slice 13 | Slice 14 | `UpscalePopover.onUpscale` | Callback | validated |
| 37 | Slice 14 | Slice 15 | `isGenerating` State | Context Dispatch | validated |
| 38 | Slice 14 | Slice 17 | Generation-Flow Pattern | Architecture | validated |
| 39 | Slice 15 | Slice 16 | (ordering dependency) | Sequence | validated |
| 40 | Slice 16 | Slice 17 | `POST /api/assistant/canvas/sessions` | REST Endpoint | validated |
| 41 | Slice 16 | Slice 17 | `POST /api/assistant/canvas/sessions/{id}/messages` | SSE Endpoint | validated |
| 42 | Slice 16 | Slice 17 | `canvas-generate` SSE Event | Event Schema | validated |

---

## Validation Results

### Valid Connections: 42

All declared dependencies have matching outputs. Every input declared in a slice's "Requires From Other Slices" table has a corresponding output in the source slice's "Provides To Other Slices" table. Type signatures are compatible across all connections.

### Orphaned Outputs: 0

All outputs are consumed by at least one downstream slice or represent user-facing final outputs.

| Output | Defined In | Consumers | Status |
|--------|------------|-----------|--------|
| `CanvasToolbar` | Slice 07 | slice-05 (Toolbar-Slot integration) | Used |
| `ToolbarButton` | Slice 07 | Internal use within Toolbar | Used |
| `DetailsOverlay` | Slice 10 | slice-05 (Canvas area) | Used |
| `UpscalePopover` | Slice 13 | slice-14 (Generation-Flow) | Used |
| Undo/Redo-Buttons | Slice 15 | User-facing UI (final output) | Used |
| Keyboard-Shortcut-Handler | Slice 15 | Global active while detail-view open | Used |
| `canvasChatService` | Slice 17 | Internal to slice-17 | Used |
| Chat-Backend-Integration | Slice 17 | Feature-complete (final output) | Used |
| Cleaned `workspace-content.tsx` | Slice 18 | All future development | Used |

### Missing Inputs: 0

No inputs are missing from any slice.

### Deliverable-Consumer Gaps: 0

All components created by slices are properly consumed. Key mount-point verifications:

| Component | Defined In | Consumer File | Mount Point | Status |
|-----------|------------|---------------|-------------|--------|
| `CanvasToolbar` | Slice 07 | `canvas-detail-view.tsx` (Slice 05) | Toolbar-Slot (left) | Slice 05 declares Toolbar-Slot as provided |
| `CanvasChatPanel` | Slice 09 | `canvas-detail-view.tsx` (Slice 05) | Chat-Slot (right) | Slice 05 declares Chat-Slot as provided |
| `SiblingThumbnails` | Slice 08 | `canvas-detail-view.tsx` (Slice 05) | Canvas area | Slice 05 provides Canvas area |
| `CanvasNavigation` | Slice 08 | `canvas-detail-view.tsx` (Slice 05) | Canvas area | Slice 05 provides Canvas area |
| `CanvasImage` | Slice 08 | `canvas-detail-view.tsx` (Slice 05/14) | Canvas area | Slice 14 modifies canvas-detail-view.tsx |
| `DetailsOverlay` | Slice 10 | `canvas-detail-view.tsx` (Slice 05) | Canvas area top | Slice 05 provides Canvas area |
| `VariationPopover` | Slice 11 | `canvas-detail-view.tsx` (Slice 14) | Adjacent to toolbar | Slice 14 deliverable: canvas-detail-view.tsx |
| `Img2imgPopover` | Slice 12 | `canvas-detail-view.tsx` (Slice 14) | Adjacent to toolbar | Slice 14 deliverable: canvas-detail-view.tsx |
| `UpscalePopover` | Slice 13 | `canvas-detail-view.tsx` (Slice 14) | Adjacent to toolbar | Slice 14 deliverable: canvas-detail-view.tsx |
| `CanvasModelSelector` | Slice 14 | `canvas-header.tsx` (Slice 05/14) | Header model-selector slot | Slice 14 deliverable: canvas-detail-view.tsx |
| Undo/Redo Buttons | Slice 15 | `canvas-header.tsx` (Slice 05/15) | Header undo/redo slots | Slice 15 deliverable: canvas-header.tsx |
| Backend Endpoints | Slice 16 | `canvas-chat-service.ts` (Slice 17) | HTTP calls | Slice 17 deliverable: canvas-chat-service.ts |

### Runtime Path Gaps: 0

All user flows from Discovery have complete call chains through Slice deliverables:

| User-Flow | Chain | Status |
|-----------|-------|--------|
| Gallery -> Detail-View | GenerationCard click -> WorkspaceContent (Sl.05) -> CanvasDetailView (Sl.05) -> Animation (Sl.06) | Complete |
| Tool-Popover Generation | ToolbarButton (Sl.07) -> Popover (Sl.11/12/13) -> onGenerate -> generateImages() (Sl.14) -> Polling -> Replace + Undo (Sl.14) | Complete |
| Chat-triggered Generation | ChatInput (Sl.09) -> canvasChatService (Sl.17) -> POST /api/assistant/canvas (Sl.16) -> canvas-generate SSE -> generateImages() (Sl.17/14) -> Polling -> Replace | Complete |
| Sibling Navigation | SiblingThumbnails (Sl.08) -> getSiblingGenerations (Sl.04) -> getSiblingsByBatchId (Sl.02) -> DB query (Sl.01 schema) | Complete |
| Prev/Next Navigation | CanvasNavigation (Sl.08) -> SET_CURRENT_IMAGE -> context update -> Chat separator (Sl.09) | Complete |
| Undo/Redo | Keyboard/Button (Sl.15) -> POP_UNDO/POP_REDO (Sl.03 reducer) -> currentGenerationId change -> CanvasImage update | Complete |
| Upscale | UpscalePopover (Sl.13) -> onUpscale -> upscaleImage() (Sl.14) -> Polling -> Replace + Undo (Sl.14) | Complete |
| Back/ESC to Gallery | CanvasHeader (Sl.05) -> startViewTransition (Sl.06) -> detailViewOpen=false (Sl.05) -> Gallery visible | Complete |
| Delete Image | Toolbar Delete (Sl.07) -> AlertDialog -> onDelete -> deleteGeneration() (Existing) -> Back to gallery or next image | Complete |

---

## Discovery Traceability

### UI Components Coverage

| Discovery Element | Type | Location | Covered In | Status |
|-------------------|------|----------|------------|--------|
| `toolbar` | Vertical Icon Bar | Links, 48px | slice-07 | covered |
| `toolbar.variation` | Icon Button | Toolbar | slice-07 | covered |
| `toolbar.img2img` | Icon Button | Toolbar | slice-07 | covered |
| `toolbar.upscale` | Icon Button | Toolbar | slice-07 | covered |
| `toolbar.download` | Icon Button | Toolbar | slice-07 | covered |
| `toolbar.delete` | Icon Button | Toolbar | slice-07 | covered |
| `toolbar.details` | Icon Button | Toolbar | slice-07 | covered |
| `popover.variation` | Floating Panel | Neben toolbar.variation | slice-11 | covered |
| `popover.img2img` | Floating Panel | Neben toolbar.img2img | slice-12 | covered |
| `popover.upscale` | Floating Panel | Neben toolbar.upscale | slice-13 | covered |
| `canvas-image` | Zoomable Image | Mitte, zentriert | slice-08 | covered |
| `siblings` | Thumbnail Row | Unter canvas-image | slice-08 | covered |
| `prev-next` | Navigation Arrows | Links/Rechts vom Bild | slice-08 | covered |
| `chat-panel` | Chat Container | Rechts, collapsible+resizable | slice-09 | covered |
| `chat-init` | Context Message | Chat, erste Nachricht | slice-09 | covered |
| `chat-input` | Text Input + Send | Chat, unten | slice-09 | covered |
| `chat-message.user` | Message Bubble | Chat | slice-09 | covered |
| `chat-message.bot` | Message Bubble | Chat | slice-09 | covered |
| `chat-chips` | Action Chips | In Bot-Nachricht | slice-09 | covered |
| `details-overlay` | Collapsible Panel | Ueber Canvas | slice-10 | covered |
| `undo-button` | Icon Button | Header | slice-15 | covered |
| `redo-button` | Icon Button | Header | slice-15 | covered |
| `chat-context-separator` | Divider | Chat-Panel | slice-09 | covered |
| `chat-new-session` | Button | Chat-Panel Header | slice-09 | covered |
| `model-selector` | Dropdown + Browse | Header | slice-14 | covered |
| `back-button` | Icon Button | Oben links | slice-05 | covered |

**UI Components Coverage:** 26/26 (100%)

### State Machine Coverage

| State | Required UI | Available Actions | Covered In | Status |
|-------|-------------|-------------------|------------|--------|
| `gallery` | Gallery-View mit Masonry Grid | Klick auf Bild -> transitioning | slice-05, slice-06 | covered |
| `transitioning-in` | Animated Transition (Bild wachst) | Keine | slice-06 | covered |
| `detail-idle` | Canvas-Detail-View, kein Tool aktiv | Tool-Klick, Chat, Sibling, Prev/Next, Undo, Redo, Back | slice-05, slice-07, slice-08, slice-09, slice-15 | covered |
| `detail-tool-open` | Detail-View mit aktivem Tool-Popover | Popover-Interaktion, Generate, Close | slice-11, slice-12, slice-13 | covered |
| `detail-generating` | Detail-View mit Loading-State | Warten, Undo nicht moeglich | slice-14 | covered |
| `detail-chat-active` | Chat-Eingabe oder Bot-Antwort | Warten, weitere Eingabe | slice-09, slice-17 | covered |
| `transitioning-out` | Animated Transition zurueck | Keine | slice-06 | covered |

**State Machine Coverage:** 7/7 (100%)

### Transitions Coverage

| From | Trigger | To | Covered In | Status |
|------|---------|-----|------------|--------|
| `gallery` | Klick auf GenerationCard | `transitioning-in` | slice-05, slice-06 | covered |
| `transitioning-in` | Animation abgeschlossen | `detail-idle` | slice-06 | covered |
| `detail-idle` | Klick auf Tool-Icon | `detail-tool-open` | slice-07 | covered |
| `detail-idle` | Text in Chat + Send | `detail-chat-active` | slice-09, slice-17 | covered |
| `detail-idle` | Klick auf Sibling-Thumbnail | `detail-idle` | slice-08 | covered |
| `detail-idle` | Klick auf Prev/Next-Button | `detail-idle` | slice-08 | covered |
| `detail-idle` | Undo (Cmd+Z) | `detail-idle` | slice-15 | covered |
| `detail-idle` | Redo (Cmd+Shift+Z) | `detail-idle` | slice-15 | covered |
| `detail-idle` | Klick Back / ESC | `transitioning-out` | slice-05, slice-06 | covered |
| `detail-tool-open` | Generate-Klick | `detail-generating` | slice-14 | covered |
| `detail-tool-open` | Klick ausserhalb | `detail-idle` | slice-11, slice-12, slice-13 | covered |
| `detail-tool-open` | Klick auf anderes Tool | `detail-tool-open` | slice-07 | covered |
| `detail-chat-active` | Agent triggert Generation | `detail-generating` | slice-17 | covered |
| `detail-chat-active` | Agent antwortet nur Text | `detail-idle` | slice-17 | covered |
| `detail-generating` | Generation completed | `detail-idle` | slice-14 | covered |
| `detail-generating` | Generation failed | `detail-idle` | slice-14 | covered |
| `transitioning-out` | Animation abgeschlossen | `gallery` | slice-06 | covered |

**Transitions Coverage:** 17/17 (100%)

### Business Rules Coverage

| Rule | Covered In | Status |
|------|------------|--------|
| Nur ein Tool-Popover gleichzeitig | slice-07 (AC-4) | covered |
| Undo-Stack pro Session (verworfen beim Verlassen) | slice-03 (AC-1), slice-15 | covered |
| Redo-Stack pro Session (verworfen beim Verlassen) | slice-03 (AC-1), slice-15 | covered |
| Undo-Stack Maximum: 20 Eintraege | slice-03 (AC-11) | covered |
| Redo-Verhalten: neue Generation leert redoStack | slice-03 (AC-5), slice-14 (AC-7) | covered |
| Chat-Agent erhaelt aktuelles Bild als Kontext | slice-16 (AC-9), slice-17 (AC-1) | covered |
| Chat-Agent hat KEINEN Zugriff auf Reference-Slots | slice-16 Constraints | covered |
| Neue Generierung: Ergebnis in Gallery UND als Sibling | slice-14 (via generateImages + batchId) | covered |
| Prev/Next: Gallery-Sortierung (neueste zuerst) | slice-08 (AC-4) | covered |
| Sibling-Definition: gleiche batchId | slice-01, slice-02 (AC-4/5), slice-08 (AC-1) | covered |
| Prev/Next: nur Maus-Klick, keine Pfeiltasten | slice-08 (AC-11) | covered |
| Bildwechsel: Chat zeigt Separator mit neuem Kontext | slice-09 (AC-9) | covered |
| Sibling-Wechsel: Chat-History bleibt, Kontext aktualisiert | slice-09 (AC-9), slice-17 (AC-10) | covered |
| Chat "Neue Session": leert History | slice-09 (AC-12), slice-17 (AC-11) | covered |
| Keyboard-Shortcuts unterdrueckt bei Input-Fokus | slice-15 (AC-7/8), slice-05 (AC-6) | covered |
| Loading-State: Toolbar disabled, Chat disabled, Undo/Redo disabled | slice-14 (AC-5), slice-15 (AC-9) | covered |
| Model-Selector im Header: gemeinsam fuer Variation + img2img | slice-14 (AC-9/10/11) | covered |
| Download-Aktion: kein Popover, direkter Download | slice-07 (AC-5) | covered |
| Delete-Aktion: Confirmation-Dialog | slice-07 (AC-6/7/8) | covered |
| Upscale: hardcoded Model `nightmareai/real-esrgan` | slice-14 (AC-3), slice-13 Constraints | covered |

**Business Rules Coverage:** 20/20 (100%)

### Data Fields Coverage

| Field | Required | Covered In | Status |
|-------|----------|------------|--------|
| `batchId` (UUID) | Ja | slice-01 (AC-1/2), slice-02 (AC-4/5) | covered |
| `undoStack` (max 20) | Nein | slice-03 (AC-5/6/7/11) | covered |
| `redoStack` (max 20) | Nein | slice-03 (AC-8/9/10) | covered |
| `currentGenerationId` | Ja | slice-03 (AC-1/2), slice-05 (AC-7/8) | covered |
| `chatSessionId` | Nein | slice-03 (Action: SET_CHAT_SESSION), slice-17 (AC-1) | covered |
| `chatMessages` | Nein | slice-09 (local state), slice-17 | covered |
| `activeToolId` | Nein | slice-03 (AC-3/4), slice-07 | covered |

**Data Fields Coverage:** 7/7 (100%)

**Discovery Coverage:** 77/77 (100%)

---

## Summary

| Metric | Value |
|--------|-------|
| Total Slices | 18 |
| Total Connections | 42 |
| Valid Connections | 42 |
| Orphaned Outputs | 0 |
| Missing Inputs | 0 |
| Deliverable-Consumer Gaps | 0 |
| Runtime Path Gaps | 0 |
| Discovery Coverage | 100% |

**VERDICT: READY FOR ORCHESTRATION**
