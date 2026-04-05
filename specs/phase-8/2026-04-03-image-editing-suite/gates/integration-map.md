# Integration Map: AI Image Editing Suite

**Generated:** 2026-04-04
**Slices:** 16
**Connections:** 42

---

## Dependency Graph (Visual)

```
                    +-----------------------+
                    |  Slice 01             |
                    |  Types & Model Slots  |
                    +-----------+-----------+
                        |       |       |
               +--------+    |    +--------+
               |              |             |
               v              v             v
  +--------------------+ +-------------------+ +--------------------+
  | Slice 02           | | Slice 06a         | | Slice 06b          |
  | Canvas Detail Ctx  | | Generation Service| | Canvas Agent (Py)  |
  +----+------+--------+ +-------------------+ +--------------------+
       |      |      |            |                      |
       |      |      |            +----------+-----------+
       |      |      |                       |
       v      |      v                       |
  +--------+  | +----------+                 |
  | Sl. 03 |  | | Sl. 12   |                 |
  | Mask   |  | | Outpaint |                 |
  | Canvas |  | | Controls |                 |
  +---+----+  | +----+-----+                 |
      |       |      |                       |
      v       v      |                       |
  +--------+ |       |                       |
  | Sl. 04 | |       |                       |
  | Float. | |       |                       |
  | Toolbar| |       |                       |
  +---+----+ |       |                       |
      |      |       |                       |
      v      |       |                       |
  +--------+ |       |                       |
  | Sl. 05 | |       |                       |
  | Mask   | |       |                       |
  | Service| |       |                       |
  +---+----+ |       |                       |
      |      |       |                       |
      +--+---+-------+-----------------------+
         |
         v
  +------+---------+
  | Slice 07       |
  | Inpaint Integ. |
  +--+--+--+--+---+
     |  |  |  |
     |  |  |  +---------------------------+
     |  |  +----------------+             |
     |  +---------+         |             |
     v            v         v             v
  +--------+ +--------+ +--------+ +----------+
  | Sl. 08 | | Sl. 09 | | Sl. 10 | | Sl. 15   |
  | Instr. | | Erase  | | SAM    | | Nav Lock |
  | Editing| | Flow   | | API    | |          |
  +--------+ +--------+ +---+----+ +----------+
                             |
                             v
                        +--------+
                        | Sl. 11 |
                        | Click  |
                        | Edit   |
                        +--------+

  +--------+   +--------+
  | Sl. 12 |-->| Sl. 13 |
  | Outpnt |   | Outpnt |
  | Ctrl   |   | Integ. |
  +--------+   +--------+

  +------+   +------+
  | Sl.03|-->| Sl.14|
  | Mask |   | Key- |
  | Canv.|   | board|
  +------+   +------+

  +----------------------------------------------+
  |                Slice 16                      |
  |             E2E Smoke Tests                  |
  | (depends: 07, 08, 09, 11, 13)               |
  +----------------------------------------------+
```

---

## Nodes

### Slice 01: Types & Model Slot Defaults

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None (foundation) |
| Outputs | `GenerationMode`, `VALID_GENERATION_MODES`, `seedModelSlotDefaults()` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| -- | -- | First slice, no dependencies |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `GenerationMode` (7er-Union) | Type | slice-02, slice-06a, slice-06b, slice-07, slice-08 |
| `VALID_GENERATION_MODES` | Const Array | slice-06a |
| `seedModelSlotDefaults()` | Function | Deployment/Seed-Script |

---

### Slice 02: Canvas Detail Context Extension

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-01 |
| Outputs | `CanvasDetailState` (extended), `CanvasDetailAction` (extended), `canvasDetailReducer` (extended) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `GenerationMode` | Slice 01 | Type import for editMode typing |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `CanvasDetailState` (6 new fields) | Interface | slice-03, slice-04, slice-12, slice-07 (transitive) |
| `CanvasDetailAction` (7 new types) | Union Type | slice-03, slice-04, slice-12, slice-07 (transitive) |
| `canvasDetailReducer` (extended) | Function | via Provider |

---

### Slice 03: Mask Canvas Component

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-02 |
| Outputs | `MaskCanvas`, Canvas-Pixel-Daten (via State) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `CanvasDetailState` (editMode, maskData, brushSize, brushTool) | Slice 02 | State fields present |
| `SET_MASK_DATA`, `CLEAR_MASK`, `SET_EDIT_MODE` | Slice 02 | Action types |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `MaskCanvas` | React Component | slice-04 (mount point), canvas-detail-view |
| Canvas-Pixel-Daten (maskData) | ImageData (via State) | slice-05 (MaskService), slice-07 (handleCanvasGenerate) |

---

### Slice 04: Floating Brush Toolbar

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-02, slice-03 |
| Outputs | `FloatingBrushToolbar`, `onEraseAction` Callback |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `CanvasDetailState` (editMode, maskData, brushSize, brushTool) | Slice 02 | State fields |
| `SET_BRUSH_SIZE`, `SET_BRUSH_TOOL`, `CLEAR_MASK` | Slice 02 | Action types |
| `MaskCanvas` mounted in canvas-detail-view | Slice 03 | Component |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `FloatingBrushToolbar` | React Component | canvas-detail-view (mount point) |
| `onEraseAction` Callback | Prop | slice-09 (Erase Flow Integration) |

---

### Slice 05: Mask Service

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-03 |
| Outputs | `toGrayscalePng`, `applyFeathering`, `scaleToOriginal`, `validateMinSize` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `state.maskData: ImageData` | Slice 03 (via State) | MaskCanvas delivers ImageData |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `toGrayscalePng` | Function | slice-07 |
| `applyFeathering` | Function | slice-07 |
| `scaleToOriginal` | Function | slice-07 |
| `validateMinSize` | Function | slice-07, slice-09 |

---

### Slice 06a: Generation Service Extension

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-01 |
| Outputs | `GenerationService.generate()` (extended), `GenerateImagesInput` (extended), `buildReplicateInput()` (extended) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `GenerationMode` | Slice 01 | Type import |
| `VALID_GENERATION_MODES` | Slice 01 | Validation array |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `GenerationService.generate()` (extended) | Function | slice-07, slice-09 |
| `GenerateImagesInput` (extended) | Interface | slice-07, slice-09 |
| `buildReplicateInput()` (extended) | Function (internal) | slice-13 (outpaint branch) |

---

### Slice 06b: Canvas Agent Extension (Python)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-01 |
| Outputs | `CanvasImageContext.mask_url`, `generate_image` Tool (extended), System-Prompt Routing, SSE Event (extended) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `GenerationMode` consistency | Slice 01 | Action strings must align with frontend modes |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `CanvasImageContext.mask_url` | Pydantic Field | slice-07 (Frontend SSE Client) |
| `generate_image` Tool (extended) | LangGraph Tool | Canvas Agent Graph (internal) |
| System-Prompt Edit-Routing | Prompt-String | Canvas Agent Graph (internal) |
| SSE `canvas-generate` Event (extended) | SSE Event Payload | slice-07, slice-08 |

---

### Slice 07: Inpaint Chat-Panel Integration

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-02, slice-04, slice-05, slice-06a, slice-06b |
| Outputs | `handleCanvasGenerate` (extended), `SSECanvasGenerateEvent` (extended), `parseSSEEvent` (extended), 4 Toolbar-Buttons, Mask-Upload-Pipeline |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `CanvasDetailState.editMode`, `maskData` + Dispatch | Slice 02 | State + Actions |
| `FloatingBrushToolbar` with `onEraseAction` | Slice 04 | Component |
| `toGrayscalePng`, `applyFeathering`, `scaleToOriginal`, `validateMinSize` | Slice 05 | Functions |
| `generateImages()` with `maskUrl`, `generationMode` | Slice 06a | Server Action |
| SSE `canvas-generate` Event with extended actions | Slice 06b | SSE Payload |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `handleCanvasGenerate` (extended) | Function | slice-08, slice-13 |
| `SSECanvasGenerateEvent` (extended) | Type | slice-08, slice-09, slice-13 |
| `parseSSEEvent` (extended) | Function | slice-08, slice-13 |
| 4 Toolbar-Buttons (brush-edit, erase, click-edit, expand) | ToolDef[] | slice-09, slice-11, slice-15 |
| Mask-Upload-Pipeline | Pattern | slice-09, slice-13 |

---

### Slice 08: Instruction Editing Flow

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-07 |
| Outputs | `handleCanvasGenerate` instruction-Branch, Instruction-Mode Slot-Resolution Pattern |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `handleCanvasGenerate` with action-Switch | Slice 07 | Function |
| `SSECanvasGenerateEvent` with `action: "instruction"` | Slice 07 | Type |
| `parseSSEEvent` for `action: "instruction"` | Slice 07 | Function |
| `CanvasDetailState.editMode`, `maskData` | Slice 02 (transitive) | State |
| `generateImages()` with `generationMode: "instruction"` | Slice 06a (transitive) | Server Action |
| `resolveActiveSlots(modelSlots, "instruction")` | Slice 01 (transitive) | Function |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `handleCanvasGenerate` instruction-Branch | Function Branch | slice-13 (pattern) |
| Instruction-Mode Slot-Resolution Pattern | Pattern | slice-13 |

---

### Slice 09: Erase Direct Flow

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-07 |
| Outputs | `handleEraseAction()`, Erase-to-Inpaint Upgrade Pattern |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `CanvasDetailState.editMode`, `maskData`, `currentImageUrl` + Dispatches | Slice 02 (transitive) | State + Actions |
| `FloatingBrushToolbar` with `onEraseAction` Callback | Slice 04 (transitive) | Component |
| `validateMinSize`, `applyFeathering`, `scaleToOriginal`, `toGrayscalePng` | Slice 05 (transitive) | Functions |
| `generateImages()` with `generationMode`, `maskUrl` | Slice 06a (transitive) | Server Action |
| `handleCanvasGenerate` Inpaint-Branch, Mask-Upload Pipeline, `erase-btn` Toolbar | Slice 07 | Function + Pattern |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `handleEraseAction()` | Function | slice-11 (Click-to-Edit -> Erase) |
| Erase-to-Inpaint Upgrade Pattern | Behavior | -- (terminal) |

---

### Slice 10: SAM API Route

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-07 |
| Outputs | `POST /api/sam/segment` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `StorageService.upload()` with `masks/` Prefix | Slice 07 (pattern) | Function |
| `requireAuth()` | Existing utility | Auth check |
| Replicate Client | Existing client | Rate limited |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `POST /api/sam/segment` | REST Endpoint | slice-11 |

---

### Slice 11: Click-to-Edit Frontend

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-07, slice-10 |
| Outputs | Click-to-Edit Flow, SAM Mask as `maskData` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `click-edit` Toolbar-Button | Slice 07 | ToolDef |
| `SET_EDIT_MODE`, `SET_MASK_DATA` Dispatch | Slice 02 (transitive) | Actions |
| Mask-Upload-Pipeline Pattern | Slice 07 | Pattern |
| `POST /api/sam/segment` | Slice 10 | REST API |
| `CanvasDetailState.editMode`, `maskData`, `currentImageUrl` | Slice 02 (transitive) | State |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Click-to-Edit Flow | UI Flow | slice-14 (if shortcuts), slice-16 (E2E) |
| SAM Mask as `maskData` | ImageData | slice-07 (handleCanvasGenerate uses maskData) |

---

### Slice 12: Outpaint Controls UI

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-02 |
| Outputs | `OutpaintControls` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `outpaintDirections` | Slice 02 | State field |
| `outpaintSize` | Slice 02 | State field |
| `SET_OUTPAINT_DIRECTIONS` | Slice 02 | Action type |
| `SET_OUTPAINT_SIZE` | Slice 02 | Action type |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `OutpaintControls` | React Component | slice-13 (mount in canvas-detail-view) |

---

### Slice 13: Outpaint Chat Integration & Canvas Extension

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-07, slice-12 |
| Outputs | Outpaint-Branch (final), Canvas-Extension via sharp |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `handleCanvasGenerate` with action-Switch | Slice 07 | Function |
| `SSECanvasGenerateEvent` with `outpaint_directions`, `outpaint_size` | Slice 07 | Type |
| Mask-Upload-Pipeline (R2 Upload Pattern) | Slice 07 | Pattern |
| `OutpaintControls` Component | Slice 12 | React Component |
| `outpaintDirections`, `outpaintSize`, `editMode` | Slice 02 (transitive) | State fields |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `handleCanvasGenerate` outpaint-Branch | Function | -- (terminal) |
| `buildReplicateInput` outpaint-Branch | Function | -- (terminal) |
| `OutpaintControls` mounted | Component Mount | -- (terminal) |

---

### Slice 14: Keyboard Shortcuts & Mask Undo

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-03, slice-04 |
| Outputs | Mask-Undo-Stack (internal), Keyboard-Event-Handler (internal) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `MaskCanvas` Component with Canvas-Ref and Paint-Loop | Slice 03 | Component |
| `SET_MASK_DATA` Dispatch on mouseup | Slice 03 | Action |
| `SET_BRUSH_SIZE`, `SET_BRUSH_TOOL` Actions | Slice 04 | Action Types |
| `editMode`, `brushSize`, `brushTool` | Slice 02 (transitive) | State Fields |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Mask-Undo-Stack | Internal (component-local) | -- (no external consumer) |
| Keyboard-Event-Handler | Internal | -- (no external consumer) |

---

### Slice 15: Navigation Lock & State Cleanup

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-07 |
| Outputs | Navigation-Lock-Logic, Mutual-Exclusion-Pattern, Mask-Canvas Visibility-Coupling |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `CanvasDetailState.editMode`, `maskData`, `SET_EDIT_MODE` | Slice 02 (transitive) | State + Action |
| `SET_ACTIVE_TOOL` Action | Slice 02 (existing) | Action |
| `MaskCanvas` Component | Slice 03 (transitive) | Component |
| `FloatingBrushToolbar` Component | Slice 04 (transitive) | Component |
| 4 Toolbar-Buttons (brush-edit, erase, click-edit, expand) | Slice 07 | ToolDef[] |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Navigation-Lock-Logic | Prop/Condition | -- (terminal) |
| Mutual-Exclusion-Pattern | Reducer-Logic | -- (terminal) |
| Mask-Canvas Visibility-Coupling | Render-Condition | -- (terminal) |

---

### Slice 16: E2E Smoke Tests

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-07, slice-08, slice-09, slice-11, slice-13 |
| Outputs | E2E Smoke-Test-Suite (terminal) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| Toolbar-Buttons with `data-testid` | Slice 07 | DOM Elements |
| `handleCanvasGenerate` Inpaint-Branch | Slice 07 | E2E Flow |
| Instruction-Branch | Slice 08 | E2E Flow |
| `erase-action-btn`, `handleEraseAction` | Slice 09 | DOM Element + Flow |
| Click-to-Edit Flow | Slice 11 | E2E Flow |
| Outpaint Direction Controls + Chat | Slice 13 | DOM Elements + Flow |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| E2E Smoke-Test-Suite | Playwright Spec | -- (terminal, final slice) |

---

## Connections

| # | From | To | Resource | Type | Status |
|---|------|-----|----------|------|--------|
| 1 | Slice 01 | Slice 02 | `GenerationMode` | Type | VALID |
| 2 | Slice 01 | Slice 06a | `GenerationMode` | Type | VALID |
| 3 | Slice 01 | Slice 06a | `VALID_GENERATION_MODES` | Const Array | VALID |
| 4 | Slice 01 | Slice 06b | `GenerationMode` consistency | Type (cross-stack) | VALID |
| 5 | Slice 02 | Slice 03 | `CanvasDetailState` (editMode, maskData, brushSize, brushTool) | State Fields | VALID |
| 6 | Slice 02 | Slice 03 | `SET_MASK_DATA`, `CLEAR_MASK`, `SET_EDIT_MODE` | Action Types | VALID |
| 7 | Slice 02 | Slice 04 | `CanvasDetailState` (editMode, maskData, brushSize, brushTool) | State Fields | VALID |
| 8 | Slice 02 | Slice 04 | `SET_BRUSH_SIZE`, `SET_BRUSH_TOOL`, `CLEAR_MASK` | Action Types | VALID |
| 9 | Slice 02 | Slice 12 | `outpaintDirections`, `outpaintSize` | State Fields | VALID |
| 10 | Slice 02 | Slice 12 | `SET_OUTPAINT_DIRECTIONS`, `SET_OUTPAINT_SIZE` | Action Types | VALID |
| 11 | Slice 03 | Slice 04 | `MaskCanvas` mounted in canvas-detail-view | Component | VALID |
| 12 | Slice 03 | Slice 05 | `state.maskData: ImageData` | State Field | VALID |
| 13 | Slice 03 | Slice 14 | `MaskCanvas` Component + Paint-Loop | Component | VALID |
| 14 | Slice 04 | Slice 07 | `FloatingBrushToolbar` with `onEraseAction` | Component | VALID |
| 15 | Slice 04 | Slice 14 | `SET_BRUSH_SIZE`, `SET_BRUSH_TOOL` Actions | Action Types | VALID |
| 16 | Slice 05 | Slice 07 | `toGrayscalePng` | Function | VALID |
| 17 | Slice 05 | Slice 07 | `applyFeathering` | Function | VALID |
| 18 | Slice 05 | Slice 07 | `scaleToOriginal` | Function | VALID |
| 19 | Slice 05 | Slice 07 | `validateMinSize` | Function | VALID |
| 20 | Slice 06a | Slice 07 | `generateImages()` extended | Server Action | VALID |
| 21 | Slice 06a | Slice 07 | `GenerateImagesInput` extended | Interface | VALID |
| 22 | Slice 06b | Slice 07 | SSE `canvas-generate` Event (extended) | SSE Payload | VALID |
| 23 | Slice 07 | Slice 08 | `handleCanvasGenerate` with action-Switch | Function | VALID |
| 24 | Slice 07 | Slice 08 | `SSECanvasGenerateEvent` with `action: "instruction"` | Type | VALID |
| 25 | Slice 07 | Slice 08 | `parseSSEEvent` | Function | VALID |
| 26 | Slice 07 | Slice 09 | `handleCanvasGenerate` Inpaint-Branch + Mask-Upload Pipeline | Function + Pattern | VALID |
| 27 | Slice 07 | Slice 09 | `erase-btn` Toolbar-Button | ToolDef | VALID |
| 28 | Slice 07 | Slice 10 | `StorageService.upload()` with `masks/` Prefix (Pattern) | Function | VALID |
| 29 | Slice 07 | Slice 11 | `click-edit` Toolbar-Button | ToolDef | VALID |
| 30 | Slice 07 | Slice 11 | `SET_EDIT_MODE`, `SET_MASK_DATA` Actions | Actions | VALID |
| 31 | Slice 07 | Slice 11 | Mask-Upload-Pipeline Pattern | Pattern | VALID |
| 32 | Slice 07 | Slice 13 | `handleCanvasGenerate` with action-Switch | Function | VALID |
| 33 | Slice 07 | Slice 13 | `SSECanvasGenerateEvent` with outpaint fields | Type | VALID |
| 34 | Slice 07 | Slice 13 | Mask-Upload-Pipeline (R2 Upload Pattern) | Pattern | VALID |
| 35 | Slice 07 | Slice 15 | 4 Toolbar-Buttons | ToolDef[] | VALID |
| 36 | Slice 07 | Slice 16 | Toolbar-Buttons with `data-testid` | DOM Elements | VALID |
| 37 | Slice 08 | Slice 16 | Instruction-Branch | E2E Flow | VALID |
| 38 | Slice 09 | Slice 16 | `erase-action-btn` + `handleEraseAction` | DOM + Flow | VALID |
| 39 | Slice 10 | Slice 11 | `POST /api/sam/segment` | REST Endpoint | VALID |
| 40 | Slice 11 | Slice 16 | Click-to-Edit Flow | E2E Flow | VALID |
| 41 | Slice 12 | Slice 13 | `OutpaintControls` Component | React Component | VALID |
| 42 | Slice 13 | Slice 16 | Outpaint Direction Controls + Chat | DOM + Flow | VALID |

---

## Validation Results

### Valid Connections: 42

All declared dependencies have matching outputs. Every declared input in each slice has a corresponding output in a prior (or parallel) slice.

### Orphaned Outputs: 2

| Output | Defined In | Consumers | Action |
|--------|------------|-----------|--------|
| `seedModelSlotDefaults()` | Slice 01 | Deployment/Seed-Script (external) | User-facing final output -- OK, not a gap |
| Erase-to-Inpaint Upgrade Pattern | Slice 09 | None (behavioral pattern) | Internal behavior, no downstream consumer needed -- OK |

Both orphaned outputs are terminal/user-facing and require no downstream consumer. No action needed.

### Missing Inputs: 0

No input is declared without a matching output from a prior slice.

### Deliverable-Consumer Gaps: 0

All components created by one slice and consumed by another have corresponding mount points in deliverables:

| Component | Defined In | Consumer Page | Page In Deliverables? | Status |
|-----------|------------|---------------|-----------------------|--------|
| `MaskCanvas` | Slice 03 | `canvas-detail-view.tsx` | Yes -- Slice 03 MODIFY deliverable | OK |
| `FloatingBrushToolbar` | Slice 04 | `canvas-detail-view.tsx` | Yes -- Slice 04 MODIFY deliverable | OK |
| `OutpaintControls` | Slice 12 | `canvas-detail-view.tsx` | Yes -- Slice 13 MODIFY deliverable | OK |

### Runtime Path Gaps: 0

All 5 user flows have been traced through their complete call chains:

**Flow 1 (Inpaint):** User -> brush-edit button (Slice 07) -> MaskCanvas paint (Slice 03) -> Chat prompt -> SSE (Slice 06b) -> parseSSEEvent (Slice 07) -> handleCanvasGenerate inpaint branch (Slice 07) -> MaskService pipeline (Slice 05) -> R2 upload (Slice 07) -> generateImages (Slice 06a) -> buildReplicateInput inpaint (Slice 06a) -> Replicate API -> PUSH_UNDO + SET_CURRENT_IMAGE (Slice 07 AC-6). Complete.

**Flow 2 (Erase):** User -> erase button (Slice 07) -> MaskCanvas paint (Slice 03) -> erase-action-btn click (Slice 04) -> handleEraseAction (Slice 09) -> MaskService pipeline (Slice 05) -> R2 upload -> generateImages with mode "erase" (Slice 06a) -> PUSH_UNDO + SET_CURRENT_IMAGE (Slice 09 AC-2). Complete.

**Flow 3 (Instruction):** User -> Chat prompt (no edit tool) -> SSE (Slice 06b) -> parseSSEEvent (Slice 07) -> handleCanvasGenerate instruction branch (Slice 08) -> resolveActiveSlots("instruction") -> generateImages with mode "instruction" (Slice 06a) -> PUSH_UNDO + SET_CURRENT_IMAGE (Slice 08 AC-4). Complete.

**Flow 4 (Click-to-Edit):** User -> click-edit button (Slice 07) -> click on image (Slice 11) -> POST /api/sam/segment (Slice 10) -> SAM mask -> SET_MASK_DATA + SET_EDIT_MODE "inpaint" (Slice 11 AC-4) -> FloatingBrushToolbar visible -> Chat prompt -> inpaint flow (Slice 07). Complete.

**Flow 5 (Outpaint):** User -> expand button (Slice 07) -> OutpaintControls (Slice 12) -> select directions -> Chat prompt -> SSE (Slice 06b) -> parseSSEEvent (Slice 07) -> handleCanvasGenerate outpaint branch (Slice 13) -> generateImages with outpaint params (Slice 06a) -> buildReplicateInput outpaint with sharp canvas-extension (Slice 13) -> PUSH_UNDO + SET_CURRENT_IMAGE (Slice 13 AC-9). Complete.

### Semantic Consistency Gaps: 0

**MODIFY-Chain Analysis:**

Files modified by multiple slices have been analyzed for semantic consistency:

| File | Modified By | Analysis | Status |
|------|-------------|----------|--------|
| `canvas-detail-view.tsx` | Slice 03, 04, 09, 11, 13, 15 | Each slice adds distinct functionality (MaskCanvas mount, FloatingToolbar mount, handleEraseAction, Click-Handler, OutpaintControls mount, Navigation-Lock). No method conflicts -- all additions are additive (new children, new handlers, new props). | OK |
| `canvas-chat-panel.tsx` | Slice 07, 08, 13 | Slice 07 creates the action-Switch in handleCanvasGenerate. Slice 08 adds `case "instruction":`. Slice 13 adds `case "outpaint":`. Each adds a new branch -- no overlap. | OK |
| `canvas-toolbar.tsx` | Slice 07, 15 | Slice 07 adds 4 ToolDef entries. Slice 15 adds mutual-exclusion dispatch in handleToolClick. Different concerns -- no conflict. | OK |
| `generation-service.ts` | Slice 06a, 13 | Slice 06a adds validation + buildReplicateInput branches for inpaint/erase/instruction/outpaint. Slice 13 adds the outpaint-specific sharp canvas-extension logic within the outpaint branch. Slice 06a provides the framework, Slice 13 fills in the outpaint specifics. Sequenced correctly. | OK |
| `floating-brush-toolbar.tsx` | Slice 04, 09 | Slice 04 creates the component. Slice 09 wires the onClick handler for erase-action-btn. Different concerns -- creation vs. wiring. | OK |
| `mask-canvas.tsx` | Slice 03, 14 | Slice 03 creates the component. Slice 14 adds keyboard shortcuts + undo stack. Additive -- no method overlap. | OK |

**Return-Type Consistency:** All provider functions maintain consistent return types across consumer chains. MaskService functions return `ImageData`, `Blob`, and validation objects consistently. `generateImages()` maintains its existing return signature with additive optional parameters.

---

## Discovery Traceability

### UI Components Coverage

| Discovery Element | Type | Location | Covered In | Status |
|-------------------|------|----------|------------|--------|
| `brush-edit-btn` | Toolbar Button | Toolbar links | slice-07 (AC-7) | COVERED |
| `erase-btn` | Toolbar Button | Toolbar links | slice-07 (AC-9) | COVERED |
| `click-edit-btn` | Toolbar Button | Toolbar links | slice-07 (AC-7) | COVERED |
| `expand-btn` | Toolbar Button | Toolbar links | slice-07 (AC-7) | COVERED |
| `mask-canvas` | Canvas Layer | Over image | slice-03 (AC-1 to AC-9) | COVERED |
| `brush-size-slider` | Slider | Floating Toolbar | slice-04 (AC-3) | COVERED |
| `brush-eraser-toggle` | Toggle Button | Floating Toolbar | slice-04 (AC-4, AC-5) | COVERED |
| `clear-mask-btn` | Button | Floating Toolbar | slice-04 (AC-6, AC-7) | COVERED |
| `erase-action-btn` | Button | Floating Toolbar | slice-04 (AC-8 to AC-11), slice-09 (AC-1) | COVERED |
| `outpaint-direction` | Button Group | At image edges | slice-12 (AC-1 to AC-8) | COVERED |
| `outpaint-size` | Button Group | With Direction Controls | slice-12 (AC-5, AC-7) | COVERED |

### State Machine Coverage

| State | Required UI | Available Actions | Covered In | Status |
|-------|-------------|-------------------|------------|--------|
| `idle` | Normal Canvas | Toolbar, Chat, Navigation | slice-07 (toolbar buttons), slice-08 (chat prompt), existing | COVERED |
| `painting` | Mask-Overlay, Floating Toolbar, Circle cursor | Paint, Erase, Clear, Size, Chat, Erase-Action | slice-03 (painting), slice-04 (toolbar), slice-07 (chat), slice-09 (erase action) | COVERED |
| `click-waiting` | Crosshair cursor, no overlay | Click on image | slice-11 (AC-1, AC-2) | COVERED |
| `sam-processing` | Loading indicator | Wait | slice-11 (AC-3) | COVERED |
| `sam-confirm` | Confirmation Dialog | Confirm or Cancel | slice-11 (AC-5, AC-6, AC-7) | COVERED |
| `outpaint-config` | Direction Controls | Select directions, size, chat | slice-12 (controls), slice-13 (integration) | COVERED |
| `generating` | Loading overlay, tools disabled | Wait | slice-07 (AC-6), slice-09 (AC-7) | COVERED |
| `result` | New image, mask remains | Undo, more edits, nav blocked | slice-07 (AC-6), slice-15 (navigation lock) | COVERED |

### Transitions Coverage

| From | Trigger | To | Covered In | Status |
|------|---------|-----|------------|--------|
| `idle` | brush-edit-btn click | `painting` | slice-07 AC-8 | COVERED |
| `idle` | erase-btn click | `painting` | slice-07 AC-9 | COVERED |
| `idle` | click-edit-btn click | `click-waiting` | slice-07 AC-7 + slice-11 AC-1 | COVERED |
| `idle` | expand-btn click | `outpaint-config` | slice-07 AC-7 + slice-13 AC-1 | COVERED |
| `idle` | Chat-Prompt | `generating` | slice-08 AC-1 (instruction) | COVERED |
| `painting` | Chat-Prompt | `generating` | slice-07 AC-3 (inpaint) | COVERED |
| `painting` | Erase-Action-Button | `generating` | slice-09 AC-1 | COVERED |
| `painting` | expand-btn click | `outpaint-config` | slice-15 AC-3 (mutual exclusion) | COVERED |
| `painting` | click-edit-btn click | `click-waiting` | slice-15 AC-3/4 (mutual exclusion) | COVERED |
| `painting` | Same edit-btn (toggle off) | `idle` | slice-15 AC-3 (toggle pattern) | COVERED |
| `painting` | Toggle-Tool (Details etc.) | `idle` | slice-15 AC-3, AC-4 | COVERED |
| `painting` | Clear | `painting` | slice-04 AC-6 | COVERED |
| `click-waiting` | Same btn (toggle off) | `idle` | slice-15 mutual exclusion | COVERED |
| `click-waiting` | Toggle-Tool | `idle` | slice-15 mutual exclusion | COVERED |
| `click-waiting` | brush-edit/erase click | `painting` | slice-15 AC-5 | COVERED |
| `click-waiting` | expand-btn click | `outpaint-config` | slice-15 mutual exclusion | COVERED |
| `click-waiting` | Click on image (no mask) | `sam-processing` | slice-11 AC-2 | COVERED |
| `click-waiting` | Click on image (mask exists) | `sam-confirm` | slice-11 AC-5 | COVERED |
| `sam-confirm` | Confirm "Ersetzen" | `sam-processing` | slice-11 AC-6 | COVERED |
| `sam-confirm` | Cancel "Abbrechen" | `click-waiting` | slice-11 AC-7 | COVERED |
| `sam-processing` | SAM success | `painting` | slice-11 AC-4 | COVERED |
| `sam-processing` | SAM error | `click-waiting` | slice-11 AC-8, AC-9 | COVERED |
| `outpaint-config` | Same btn (toggle off) | `idle` | slice-15 mutual exclusion | COVERED |
| `outpaint-config` | Toggle-Tool | `idle` | slice-15 mutual exclusion | COVERED |
| `outpaint-config` | brush-edit/erase click | `painting` | slice-15 AC-5 | COVERED |
| `outpaint-config` | click-edit-btn | `click-waiting` | slice-15 mutual exclusion | COVERED |
| `outpaint-config` | Chat-Prompt (direction selected) | `generating` | slice-13 AC-4 | COVERED |
| `outpaint-config` | Chat-Prompt (no direction) | `outpaint-config` (warning) | slice-13 AC-3 | COVERED |
| `generating` | API success | `result` | slice-07 AC-6, slice-08 AC-4, slice-09 AC-2, slice-13 AC-9 | COVERED |
| `generating` | API error | Previous state | slice-07 AC-5, slice-08 AC-5, slice-09 AC-6 | COVERED |
| `result` | Undo | `result` | existing PUSH_UNDO pattern | COVERED |
| `result` | New Edit-Modus | Various | slice-15 AC-5 | COVERED |
| `result` | Prev/Next (mask exists) | Blocked | slice-15 AC-1 | COVERED |

### Business Rules Coverage

| Rule | Covered In | Status |
|------|------------|--------|
| Mask-Feathering: 10px Gaussian Blur | slice-05 AC-2 | COVERED |
| Mask-Format: Grayscale PNG (white=edit, black=keep) | slice-05 AC-1 | COVERED |
| Mask-Lifecycle: Session-only, persists on tool switch | slice-02 AC-10, slice-15 AC-3/4/5 | COVERED |
| Mask-Sichtbarkeit: Only visible in mask-using modes | slice-15 AC-6, AC-7 | COVERED |
| SAM-Mask replaces manual mask + confirmation dialog | slice-11 AC-5, AC-6, AC-7 | COVERED |
| Navigation-Sperre at active mask | slice-15 AC-1, AC-2 | COVERED |
| Minimum Mask Size >= 10px | slice-05 AC-4/5/6, slice-07 AC-5 | COVERED |
| Intent-Erkennung (Canvas Agent) | slice-06b AC-3/4/5 | COVERED |
| Modell-Routing: Mask+Prompt -> Inpaint | slice-06b AC-3, slice-07 AC-3 | COVERED |
| Modell-Routing: Mask+No Prompt -> Erase | slice-06b AC-7, slice-09 AC-1 | COVERED |
| Modell-Routing: No Mask+Edit -> Instruction | slice-06b AC-4, slice-08 AC-1 | COVERED |
| Modell-Routing: Outpaint-Kontext -> Outpaint | slice-06b AC-5, slice-13 AC-4 | COVERED |
| Modell-Routing: SAM-Click -> SAM 2 | slice-10 AC-5 | COVERED |
| Model Slots: New modes inpaint, erase, outpaint | slice-01 AC-3/4/5 | COVERED |
| Smart Default + Override | slice-01 AC-4 (defaults), slice-08 AC-2 (resolution) | COVERED |
| Outpaint-Groessen: 25%, 50%, 100% (Default 50%) | slice-02 AC-9, slice-12 AC-1/5 | COVERED |
| Outpaint-Richtungen: Multi-select | slice-12 AC-2/3/4 | COVERED |
| Mask-Export Skalierung: Display -> Original | slice-05 AC-3 | COVERED |
| Post-Edit: In-Place Replace + Undo Stack | slice-07 AC-6, slice-08 AC-4, slice-09 AC-2, slice-13 AC-9 | COVERED |
| Toolbar Mutual Exclusion | slice-15 AC-3, AC-4 | COVERED |
| Erase-Modus + Chat: upgrade to Inpaint | slice-09 AC-5 | COVERED |
| Outpaint-Validierung: Send disabled if no direction | slice-13 AC-3 | COVERED |
| Keyboard Shortcuts: [, ], E, Ctrl+Z | slice-14 AC-1 to AC-9 | COVERED |

### Data Fields Coverage

| Field | Required | Covered In | Status |
|-------|----------|------------|--------|
| `mask` (Canvas State) | Yes (inpaint/erase) | slice-03 (canvas), slice-05 (service) | COVERED |
| `generationMode` | Yes | slice-01 (type), slice-06a (validation) | COVERED |
| `sourceImageUrl` | Yes (all edit modes) | slice-06a AC-1/2/3/4 | COVERED |
| `model_slots.mode` | Yes | slice-01 AC-3/4/5 | COVERED |
| `maskUrl` (API Input) | Yes (inpaint/erase) | slice-06a AC-5/6, slice-07 AC-3 | COVERED |
| `outpaintDirections` | Yes (outpaint) | slice-02 AC-8, slice-06a AC-7, slice-12, slice-13 AC-4 | COVERED |
| `outpaintSize` | Yes (outpaint) | slice-02 AC-9, slice-06a AC-8, slice-12, slice-13 AC-5/6/7 | COVERED |
| `clickCoordinates` | Yes (click-to-edit) | slice-11 AC-2 (normalized coordinates) | COVERED |

**Discovery Coverage:** 56/56 (100%)

---

## Infrastructure Prerequisite Check

| Check | Status | Detail |
|-------|--------|--------|
| Frontend Health Endpoint (`http://localhost:3000`) | EXISTS | Next.js dev server default |
| Backend Health Endpoint (`http://localhost:8000/api/assistant/health`) | EXISTS | Route defined in `backend/app/routes/health.py` |
| Replicate Client | EXISTS | `lib/clients/replicate.ts` with rate limiting |
| R2 Storage Service | EXISTS | `lib/clients/storage.ts` with upload function |

No infrastructure prerequisites needed before Wave 1.

---

## Summary

| Metric | Value |
|--------|-------|
| Total Slices | 16 |
| Total Connections | 42 |
| Valid Connections | 42 |
| Orphaned Outputs | 2 (both terminal/user-facing -- OK) |
| Missing Inputs | 0 |
| Deliverable-Consumer Gaps | 0 |
| Runtime Path Gaps | 0 |
| Semantic Consistency Gaps | 0 |
| Discovery Coverage | 100% (56/56) |

**VERDICT: READY FOR ORCHESTRATION**
