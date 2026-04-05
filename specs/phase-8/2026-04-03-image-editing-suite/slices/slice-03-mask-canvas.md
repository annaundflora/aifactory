# Slice 3: Mask Canvas Component

> **Slice 3 von 16** fuer `AI Image Editing Suite`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-03-mask-canvas` |
| **Test** | `pnpm test components/canvas/__tests__/mask-canvas.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-canvas-detail-context"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/__tests__/mask-canvas.test.tsx` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm test -- --run` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (HTMLCanvasElement + CanvasRenderingContext2D muessen gemockt werden) |

---

## Ziel

HTML5 Canvas Overlay-Component erstellen, das pixelgenau ueber dem Bild im Canvas Detail-View liegt. Unterstuetzt Brush-Painting (mousedown/mousemove/mouseup), Eraser-Modus, dynamische Brush-Groesse, Clear-All und rendert die Maske als semi-transparentes Rot (rgba 255,0,0 bei 50% Opacity). Cursor wird als Kreis in aktueller Brush-Groesse dargestellt.

---

## Acceptance Criteria

1) GIVEN das MaskCanvas-Component wird mit einer Bild-Referenz gerendert
   WHEN das Component im DOM erscheint
   THEN hat das `<canvas>`-Element exakt die gleiche Breite und Hoehe (in px) wie das darunterliegende Bild-Element
   AND das Canvas ist absolut positioniert ueber dem Bild (position: absolute, top: 0, left: 0)

2) GIVEN `editMode` im CanvasDetailState ist `"inpaint"` oder `"erase"`
   WHEN der User mousedown auf dem Canvas ausfuehrt und die Maus bewegt (mousemove)
   THEN werden rote Pixel (rgba 255,0,0,128) entlang des Maus-Pfades auf das Canvas gezeichnet
   AND der Strich-Durchmesser entspricht dem aktuellen `brushSize`-Wert aus dem State

3) GIVEN der User hat Pixel auf das Canvas gemalt
   WHEN mouseup ausgeloest wird
   THEN wird `SET_MASK_DATA` mit den aktuellen Canvas-ImageData dispatched
   AND der Strich ist persistent auf dem Canvas sichtbar

4) GIVEN `brushTool` im State ist `"eraser"`
   WHEN der User auf dem Canvas malt (mousedown + mousemove)
   THEN werden die uebermalten Pixel transparent (globalCompositeOperation `destination-out`)
   AND zuvor gemalte Masken-Bereiche werden entfernt

5) GIVEN der User hat eine Maske gemalt
   WHEN `CLEAR_MASK` dispatched wird
   THEN wird das gesamte Canvas geleert (keine roten Pixel mehr sichtbar)
   AND `SET_MASK_DATA` wird mit `null` dispatched

6) GIVEN `brushSize` im State wird von `40` auf `80` geaendert
   WHEN der User anschliessend auf dem Canvas malt
   THEN hat der neue Strich einen Durchmesser von `80` Pixeln

7) GIVEN die Maus befindet sich ueber dem Canvas
   WHEN der User die Maus bewegt (ohne zu klicken)
   THEN wird ein kreisfoermiger Cursor-Indicator angezeigt, dessen Durchmesser dem aktuellen `brushSize` entspricht
   AND der native Cursor ist versteckt (CSS `cursor: none`)

8) GIVEN `editMode` ist `null` (kein Edit-Modus aktiv)
   WHEN das MaskCanvas-Component gerendert wird
   THEN ist das Canvas nicht sichtbar (hidden/unmounted) und akzeptiert keine Mouse-Events

9) GIVEN das Bild-Element aendert seine Groesse (z.B. durch Window-Resize)
   WHEN ein ResizeObserver die Aenderung erkennt
   THEN wird das Canvas auf die neue Bild-Groesse angepasst
   AND bestehende Masken-Daten bleiben erhalten

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/__tests__/mask-canvas.test.tsx`

<test_spec>
```typescript
// AC-1: Canvas-Dimensionen matchen Bild
it.todo('should render canvas with same dimensions as the image element')

// AC-2: Brush-Painting erzeugt rote Pixel
it.todo('should paint red pixels along mouse path on mousedown and mousemove')

// AC-3: SET_MASK_DATA dispatch bei mouseup
it.todo('should dispatch SET_MASK_DATA with canvas ImageData on mouseup')

// AC-4: Eraser entfernt Masken-Pixel
it.todo('should erase painted pixels when brushTool is eraser')

// AC-5: Clear-Mask leert Canvas
it.todo('should clear all canvas pixels when CLEAR_MASK is dispatched')

// AC-6: Brush-Size-Aenderung wirkt auf naechsten Strich
it.todo('should use updated brushSize for new strokes after state change')

// AC-7: Cursor-Indicator folgt der Maus
it.todo('should show circle cursor matching brushSize and hide native cursor')

// AC-8: Canvas versteckt wenn kein editMode
it.todo('should not render canvas when editMode is null')

// AC-9: ResizeObserver passt Canvas an
it.todo('should resize canvas when image element dimensions change')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-02-canvas-detail-context` | `CanvasDetailState` (editMode, maskData, brushSize, brushTool) | State Fields | State-Felder vorhanden, Default-Werte korrekt |
| `slice-02-canvas-detail-context` | `SET_MASK_DATA`, `CLEAR_MASK`, `SET_EDIT_MODE` | Action Types | Dispatch aendert State wie in Slice 02 spezifiziert |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `MaskCanvas` | React Component | slice-04 (FloatingToolbar mount point), canvas-detail-view | `<MaskCanvas imageRef={RefObject<HTMLImageElement>} />` |
| Canvas-Pixel-Daten | ImageData (via State) | slice-06a (MaskService fuer PNG-Export) | `state.maskData: ImageData \| null` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/mask-canvas.tsx` -- Neues HTML5 Canvas Overlay-Component mit Brush-Paint, Eraser, Clear, Cursor-Indicator, ResizeObserver
- [ ] `components/canvas/canvas-detail-view.tsx` -- MODIFY: MaskCanvas einbinden (Import + Mount im Center-Column ueber dem Bild-Element)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Mask-to-PNG-Konvertierung (das ist MaskService in einem spaeteren Slice)
- KEINE Mask-Feathering-Logik (10px Gaussian Blur passiert beim Export, nicht beim Malen)
- KEINE Floating Brush Toolbar UI (Slice 04)
- KEINE Keyboard Shortcuts (`[`, `]`, `E`, Ctrl+Z) -- spaeterer Slice
- KEINE Mask-Undo-Stack-Logik in diesem Slice (separater Undo-Stack fuer Mask-Strokes ist spaeterer Slice)
- KEIN Touch/Pointer-Event Support (Out of Scope gemaess Discovery: "Mobile-optimierte Brush-Interaktion")

**Technische Constraints:**
- Canvas 2D Context (`getContext('2d')`) verwenden, keine WebGL
- Painting-Loop via requestAnimationFrame oder direkte Canvas-API (kein React State waehrend des Malens updaten -- Performance NFR < 16ms pro Frame)
- Masken-Farbe: `rgba(255, 0, 0, 0.5)` fuer die Visualisierung
- Eraser via `globalCompositeOperation: 'destination-out'`
- `lineCap: 'round'` und `lineJoin: 'round'` fuer weiche Brush-Striche
- Canvas-Dimensionen muessen dem gerenderten Bild-Element entsprechen (nicht dem Original-Bild)
- `cursor: none` auf dem Canvas-Element, eigener Cursor-Circle via separatem Overlay oder Canvas-Redraw

**Reuse (PFLICHT):**

| Existing File | Usage in this Slice |
|---|---|
| `components/canvas/canvas-detail-view.tsx` | MODIFY -- MaskCanvas als neues Child-Element im Center-Column mounten, `imageRef` durchreichen |
| `lib/canvas-detail-context.tsx` | IMPORT -- `useCanvasDetail()` fuer State (editMode, brushSize, brushTool, maskData) und dispatch |

**Referenzen:**
- Architecture: `architecture.md` --> Section "New Files" (Zeile 344: mask-canvas.tsx als neues Component)
- Architecture: `architecture.md` --> Section "Technology Decisions" (Zeile 443-445: Canvas 2D API, Feathering, Export)
- Architecture: `architecture.md` --> Section "NFRs" (Zeile 393: Painting < 16ms, Zeile 394: Mask persists across tool switches)
- Architecture: `architecture.md` --> Section "Constraints" (Zeile 358-359: Mask als ImageData, pixel-perfect alignment)
- Architecture: `architecture.md` --> Section "Risks" (Zeile 429: ResizeObserver fuer coordinate drift)
- Wireframes: `wireframes.md` --> Screen "Painting Mode (Brush Edit)" (Annotations 5+6: Mask Overlay + Brush Cursor)
- Discovery: `discovery.md` --> Section "UI Components" (mask-canvas Spezifikation)
