# Slice 2: Canvas Detail Context Extension

> **Slice 2 von 16** fuer `AI Image Editing Suite`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-02-canvas-detail-context` |
| **Test** | `pnpm test lib/__tests__/canvas-detail-context.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-types-model-slots"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/__tests__/canvas-detail-context.test.ts` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm test -- --run` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` (pure reducer logic) |

---

## Ziel

`CanvasDetailState` um 6 neue Felder fuer Edit-Mode-Steuerung erweitern (`editMode`, `maskData`, `brushSize`, `brushTool`, `outpaintDirections`, `outpaintSize`). 7 neue Action-Types und zugehoerige Reducer-Cases implementieren, damit nachfolgende UI-Slices den Edit-State dispatchen koennen.

---

## Acceptance Criteria

1) GIVEN der initiale `CanvasDetailState`
   WHEN der State ohne Dispatch gelesen wird
   THEN ist `editMode` gleich `null`, `maskData` gleich `null`, `brushSize` gleich `40`, `brushTool` gleich `"brush"`, `outpaintDirections` gleich `[]` (leeres Array), `outpaintSize` gleich `50`

2) GIVEN ein State mit `editMode: null`
   WHEN `{ type: "SET_EDIT_MODE", editMode: "inpaint" }` dispatched wird
   THEN ist `editMode` gleich `"inpaint"`

3) GIVEN ein State mit `editMode: "inpaint"`
   WHEN `{ type: "SET_EDIT_MODE", editMode: null }` dispatched wird
   THEN ist `editMode` gleich `null`

4) GIVEN ein State mit `maskData: null`
   WHEN `{ type: "SET_MASK_DATA", maskData: <ImageData-Instanz> }` dispatched wird
   THEN ist `maskData` die uebergebene ImageData-Instanz (Referenzgleichheit)

5) GIVEN ein State mit `maskData: <ImageData-Instanz>`
   WHEN `{ type: "CLEAR_MASK" }` dispatched wird
   THEN ist `maskData` gleich `null`

6) GIVEN ein State mit `brushSize: 40`
   WHEN `{ type: "SET_BRUSH_SIZE", brushSize: 75 }` dispatched wird
   THEN ist `brushSize` gleich `75`

7) GIVEN ein State mit `brushTool: "brush"`
   WHEN `{ type: "SET_BRUSH_TOOL", brushTool: "eraser" }` dispatched wird
   THEN ist `brushTool` gleich `"eraser"`

8) GIVEN ein State mit `outpaintDirections: []`
   WHEN `{ type: "SET_OUTPAINT_DIRECTIONS", outpaintDirections: ["top", "right"] }` dispatched wird
   THEN ist `outpaintDirections` gleich `["top", "right"]`

9) GIVEN ein State mit `outpaintSize: 50`
   WHEN `{ type: "SET_OUTPAINT_SIZE", outpaintSize: 100 }` dispatched wird
   THEN ist `outpaintSize` gleich `100`

10) GIVEN ein State mit `editMode: "inpaint"` und `maskData: <ImageData-Instanz>`
    WHEN `{ type: "SET_EDIT_MODE", editMode: "outpaint" }` dispatched wird
    THEN ist `editMode` gleich `"outpaint"` AND `maskData` bleibt unveraendert (Maske ueberlebt Mode-Wechsel)

11) GIVEN bestehende Reducer-Cases (`SET_CURRENT_IMAGE`, `SET_ACTIVE_TOOL`, etc.)
    WHEN ein bestehender Action-Type dispatched wird
    THEN bleibt das Verhalten identisch zum bisherigen Reducer (keine Regression)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/__tests__/canvas-detail-context.test.ts`

<test_spec>
```typescript
// AC-1: Default-Werte der neuen State-Felder
it.todo('should initialize editMode as null, maskData as null, brushSize as 40, brushTool as brush, outpaintDirections as empty array, outpaintSize as 50')

// AC-2: SET_EDIT_MODE setzt editMode
it.todo('should set editMode to inpaint when SET_EDIT_MODE dispatched')

// AC-3: SET_EDIT_MODE auf null zuruecksetzen
it.todo('should set editMode to null when SET_EDIT_MODE dispatched with null')

// AC-4: SET_MASK_DATA setzt maskData
it.todo('should set maskData to provided ImageData instance')

// AC-5: CLEAR_MASK setzt maskData auf null
it.todo('should set maskData to null when CLEAR_MASK dispatched')

// AC-6: SET_BRUSH_SIZE setzt brushSize
it.todo('should set brushSize to 75 when SET_BRUSH_SIZE dispatched')

// AC-7: SET_BRUSH_TOOL setzt brushTool
it.todo('should set brushTool to eraser when SET_BRUSH_TOOL dispatched')

// AC-8: SET_OUTPAINT_DIRECTIONS setzt outpaintDirections
it.todo('should set outpaintDirections to top and right when SET_OUTPAINT_DIRECTIONS dispatched')

// AC-9: SET_OUTPAINT_SIZE setzt outpaintSize
it.todo('should set outpaintSize to 100 when SET_OUTPAINT_SIZE dispatched')

// AC-10: Maske ueberlebt Mode-Wechsel
it.todo('should preserve maskData when editMode changes from inpaint to outpaint')

// AC-11: Keine Regression bestehender Cases
it.todo('should handle SET_ACTIVE_TOOL identically to previous behavior')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-types-model-slots` | `GenerationMode` | Type | Import fuer `editMode` Typisierung (Subset: `"inpaint" \| "erase" \| "instruction" \| "outpaint"`) |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `CanvasDetailState` (erweitert) | Interface | slice-03 (MaskCanvas), slice-04 (FloatingToolbar), slice-05 (OutpaintControls), slice-06a (ChatPanel) | 6 neue Felder: `editMode`, `maskData`, `brushSize`, `brushTool`, `outpaintDirections`, `outpaintSize` |
| `CanvasDetailAction` (erweitert) | Union Type | slice-03, slice-04, slice-05, slice-06a | 7 neue Action-Types: `SET_EDIT_MODE`, `SET_MASK_DATA`, `SET_BRUSH_SIZE`, `SET_BRUSH_TOOL`, `SET_OUTPAINT_DIRECTIONS`, `SET_OUTPAINT_SIZE`, `CLEAR_MASK` |
| `canvasDetailReducer` (erweitert) | Function | -- (via Provider) | `(state: CanvasDetailState, action: CanvasDetailAction) => CanvasDetailState` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/canvas-detail-context.tsx` — `CanvasDetailState` um 6 Felder erweitern, `CanvasDetailAction` um 7 Types erweitern, `canvasDetailReducer` um 7 Cases erweitern, Initial-State im Provider anpassen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE neuen Dateien — alles in der bestehenden `lib/canvas-detail-context.tsx`
- KEINE UI-Aenderungen, KEINE neuen Components
- KEINE Aenderung am globalen Ctrl+Z Handler (das ist ein spaeterer Slice, siehe architecture.md Zeile 483/508)
- KEINE Mask-Logik (Canvas-Zeichnen, Feathering, Export) — das ist Slice 03/04
- `editMode`-Type ist `EditMode | null`, wobei `EditMode` als neuer Subtype definiert wird (kein Re-Export von `GenerationMode`)

**Technische Constraints:**
- Bestehende 8 Action-Types und 8 Reducer-Cases duerfen NICHT geaendert werden (Regression-Schutz AC-11)
- `maskData` wird als `ImageData | null` typisiert (Browser-nativer Typ, kein Custom-Wrapper)
- `brushSize` Default `40` (Mitte des Sliders 1-100, siehe wireframes.md → Painting Mode)
- `brushTool` als `"brush" | "eraser"` Literal Union (siehe wireframes.md → Brush/Eraser Toggle)
- `outpaintDirections` als `OutpaintDirection[]` mit `OutpaintDirection = "top" | "bottom" | "left" | "right"` (siehe wireframes.md → Outpaint Mode)
- `outpaintSize` als `25 | 50 | 100` Literal Union mit Default `50` (siehe wireframes.md → Outpaint Mode)
- Initial-State im `CanvasDetailProvider` (`useReducer` Aufruf Zeile 151) muss die 6 neuen Felder enthalten

**Reuse (PFLICHT):**

| Existing File | Usage in this Slice |
|---|---|
| `lib/canvas-detail-context.tsx` | MODIFY — State-Interface, Action-Union, Reducer, Provider Initial-State erweitern |

**Referenzen:**
- Architecture: `architecture.md` → Migration Map Zeile 328 (Context-Erweiterung: 6 State-Felder, 7 Action-Types, 7 Reducer-Cases)
- Architecture: `architecture.md` → Constraints Zeile 358 (Mask als `ImageData` in Reducer State)
- Architecture: `architecture.md` → NFR Zeile 394 (Mask persists across tool switches)
- Wireframes: `wireframes.md` → Painting Mode (Brush-Size 1-100, Brush/Eraser Toggle)
- Wireframes: `wireframes.md` → Outpaint Mode (4 Richtungen, Groessen 25%/50%/100%)
- Discovery: `discovery.md` → State Transitions (Maske ueberlebt Mode-Wechsel)
