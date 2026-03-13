# Slice 14: In-Place Generation + Polling Integration

> **Slice 14 von 18** fuer `Canvas Detail-View & Editing Flow`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-14-in-place-generation` |
| **Test** | `pnpm test components/canvas/__tests__/in-place-generation.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-11-variation-popover", "slice-12-img2img-popover", "slice-13-upscale-popover"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/__tests__/in-place-generation.test.tsx` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | `pnpm test components/canvas/__tests__/in-place-generation.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Popover-Callbacks (onGenerate / onUpscale) mit den bestehenden Server Actions (`generateImages()` / `upscaleImage()`) verbinden, Loading-Overlay auf dem Canvas-Image anzeigen, Polling-Completion erkennen, neues Bild in-place ersetzen, altes Bild auf den Undo-Stack pushen und alle Inputs waehrend der Generation deaktivieren. Zusaetzlich Model-Selector im Header als gemeinsame Model-Quelle fuer Variation und img2img.

---

## Acceptance Criteria

1) GIVEN der User klickt "Generate" im Variation-Popover mit `{ prompt: "A dramatic sunset", strength: "creative", count: 2 }`
   WHEN der Callback ausgefuehrt wird
   THEN wird `generateImages()` Server Action aufgerufen mit dem aktuellen Bild als img2img-Input, dem Prompt, dem Model aus dem Header-Selector und count 2, und das Popover schliesst sich

2) GIVEN der User klickt "Generate" im img2img-Popover mit References, Prompt und Variants
   WHEN der Callback ausgefuehrt wird
   THEN wird `generateImages()` Server Action aufgerufen mit den Reference-Inputs, dem Prompt, dem Model aus dem Header-Selector und der gewaehlten Variant-Anzahl

3) GIVEN der User klickt "4x Upscale" im Upscale-Popover
   WHEN der Callback ausgefuehrt wird
   THEN wird `upscaleImage()` Server Action aufgerufen mit der aktuellen Bild-URL und `scale: 4` (hardcoded Model `nightmareai/real-esrgan`, ignoriert Header-Selector)

4) GIVEN eine Generation wurde via Popover getriggert
   WHEN der `isGenerating`-State auf `true` gesetzt wird
   THEN zeigt das Canvas-Image einen semi-transparenten Overlay mit dem Text "Generating" und einem Spinner

5) GIVEN `isGenerating` ist `true`
   WHEN die UI gerendert wird
   THEN sind alle Toolbar-Icons disabled (nicht klickbar), der Chat-Input ist disabled, und Undo/Redo-Buttons sind disabled

6) GIVEN eine Generation laeuft (pending in DB)
   WHEN das Polling (bestehendes 3s-Intervall aus WorkspaceContent) eine Generation mit `status: "completed"` erkennt
   THEN wird das neue Bild als `currentGenerationId` gesetzt, `isGenerating` wird auf `false` gesetzt, und der Loading-Overlay verschwindet

7) GIVEN eine Generation wurde completed und das neue Bild ersetzt das aktuelle
   WHEN der Replace-Flow ausgefuehrt wird
   THEN wird die vorherige `currentGenerationId` auf den Undo-Stack gepusht und der Redo-Stack geleert

8) GIVEN eine Generation laeuft und das Polling `status: "failed"` erkennt
   WHEN der Fehler verarbeitet wird
   THEN wird `isGenerating` auf `false` gesetzt, ein Toast mit Fehlermeldung angezeigt, und das aktuelle Bild bleibt unveraendert

9) GIVEN der User oeffnet die Detail-View fuer ein Bild mit `modelId: "flux-2-max"`
   WHEN der Model-Selector im Header gerendert wird
   THEN zeigt er `flux-2-max` als vorausgewaehltes Model (initialisiert aus dem Bild-Model)

10) GIVEN der User aendert das Model im Header-Selector auf ein anderes Model
    WHEN der User danach "Generate" im Variation-Popover klickt
    THEN wird das neu gewaehlte Model an `generateImages()` uebergeben (nicht das Original-Model des Bildes)

11) GIVEN der User waehlt ein Model das img2img nicht unterstuetzt
    WHEN der Selector das Model akzeptiert
    THEN wird automatisch zum ersten img2img-faehigen Model gewechselt und ein Toast-Hinweis angezeigt

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/__tests__/in-place-generation.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('In-Place Generation Flow', () => {
  // AC-1: Variation-Popover triggert generateImages mit korrekten Params
  it.todo('should call generateImages with current image as img2img input, prompt, header model, and count when variation popover generates')

  // AC-2: img2img-Popover triggert generateImages mit References
  it.todo('should call generateImages with references, prompt, header model, and variants when img2img popover generates')

  // AC-3: Upscale-Popover triggert upscaleImage mit hardcoded Model
  it.todo('should call upscaleImage with current image URL, scale 4, and hardcoded real-esrgan model')

  // AC-4: Loading-Overlay bei isGenerating
  it.todo('should show semi-transparent overlay with "Generating" text and spinner when isGenerating is true')

  // AC-5: Alle Inputs disabled waehrend Generation
  it.todo('should disable toolbar icons, chat input, and undo/redo buttons when isGenerating is true')

  // AC-6: Polling-Completion ersetzt Bild
  it.todo('should set new generation as currentGenerationId and clear isGenerating when polling detects completed status')

  // AC-7: Altes Bild auf Undo-Stack bei Replace
  it.todo('should push previous currentGenerationId to undo stack and clear redo stack on image replace')

  // AC-8: Fehler-Handling bei failed Generation
  it.todo('should clear isGenerating, show error toast, and keep current image when polling detects failed status')
})

describe('CanvasModelSelector', () => {
  // AC-9: Model-Selector initialisiert aus Bild-Model
  it.todo('should initialize with the current image model as selected model')

  // AC-10: Geaendertes Model wird bei Generation verwendet
  it.todo('should pass the user-selected model to generateImages instead of the original image model')

  // AC-11: Auto-Switch bei nicht-img2img-faehigem Model
  it.todo('should auto-switch to first img2img-capable model and show toast when incompatible model is selected')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03-canvas-detail-context` | `useCanvasDetail()` | React Hook | `state.isGenerating`, `state.currentGenerationId`, `dispatch(SET_GENERATING)`, `dispatch(PUSH_UNDO)`, `dispatch(CLEAR_REDO)`, `dispatch(SET_CURRENT_IMAGE)` |
| `slice-05-detail-view-shell` | `CanvasDetailView` | React Component | Mounting-Container fuer Generation-Flow und Header-Slots |
| `slice-08-siblings-navigation` | `CanvasImage` | React Component | Erweitern um Loading-Overlay-State |
| `slice-11-variation-popover` | `VariationPopover.onGenerate` | Callback | `(params: VariationParams) => void` |
| `slice-12-img2img-popover` | `Img2imgPopover.onGenerate` | Callback | `(params: Img2imgParams) => void` |
| `slice-13-upscale-popover` | `UpscalePopover.onUpscale` | Callback | `(params: { scale: 2 \| 4 }) => void` |
| Existing | `generateImages()` | Server Action | `app/actions/generations.ts` |
| Existing | `upscaleImage()` | Server Action | `app/actions/generations.ts` |
| Existing | Polling-Mechanismus | WorkspaceContent | 3s-Intervall erkennt `status: "completed"` / `"failed"` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `isGenerating` State-Reaktion | Context Dispatch | `slice-15` (Undo/Redo) | Undo/Redo disabled waehrend `isGenerating === true` |
| Undo-Stack Push bei Replace | Context Dispatch | `slice-15` (Undo/Redo) | `PUSH_UNDO` mit vorheriger `currentGenerationId` |
| `CanvasModelSelector` | React Component | `slice-05` (Header-Slot) | `<CanvasModelSelector />` liest/schreibt `selectedModelId` im Context |
| Generation-Flow Pattern | Architecture | `slice-17` (Chat Frontend) | Chat `canvas-generate` Event nutzt gleichen Flow: `generateImages()` -> Polling -> Replace |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/canvas-detail-view.tsx` -- Generation-Flow: Popover-Callbacks -> Server Action Aufruf -> isGenerating setzen -> Polling-Completion -> Replace + Undo-Push
- [ ] `components/canvas/canvas-image.tsx` -- Loading-Overlay-State: semi-transparenter Overlay mit "Generating" + Spinner bei `isGenerating === true`
- [ ] `components/canvas/canvas-model-selector.tsx` -- Header Model-Selector: initialisiert aus Bild-Model, aenderbar, Auto-Switch bei nicht-img2img-faehigem Model, "Browse Models" oeffnet ModelBrowserDrawer
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Undo/Redo-Button-Rendering oder Keyboard-Shortcuts (Slice 15)
- KEINE Chat-Backend-Anbindung oder canvas-generate Event-Handling (Slice 17)
- KEINE neuen Server Actions — bestehende `generateImages()` und `upscaleImage()` werden aufgerufen
- KEIN Polling-Mechanismus implementieren — bestehendes Polling aus WorkspaceContent wird genutzt/erweitert
- KEINE Sibling-Aktualisierung nach Generation (Sibling-Query laueft automatisch ueber batchId)

**Technische Constraints:**
- `"use client"` Direktive fuer alle drei Deliverables
- Variation = img2img mit aktuellem Bild als einzigem Input, Strength mapped auf `prompt_strength`
- Upscale nutzt hardcoded `nightmareai/real-esrgan`, ignoriert Header-Selector
- Toast-Notifications via Sonner (`toast.error()` bei Fehler, `toast()` bei Auto-Switch)
- ModelBrowserDrawer aus bestehendem Projekt wiederverwenden

**Referenzen:**
- Architecture: `architecture.md` -> Section "Server Logic" fuer Generation-Flow und Business Logic
- Architecture: `architecture.md` -> Section "Error Handling Strategy" fuer Fehler-Toast-Pattern
- Architecture: `architecture.md` -> Section "Constraints" -> Polling 3s und hardcoded Upscale-Model
- Discovery: `discovery.md` -> "Feature State Machine" -> `detail-generating` State und Transitions
- Discovery: `discovery.md` -> "Business Rules" -> Model-Selector Verhalten und Loading-State-Regeln
- Wireframes: `wireframes.md` -> "Screen: Loading State (Generating)" fuer Overlay-Layout
- Wireframes: `wireframes.md` -> "Screen: Canvas-Detail-View (Idle)" Annotation 2 fuer Model-Selector
