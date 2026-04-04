# Slice 7: Inpaint Chat-Panel Integration

> **Slice 7 von 16** fuer `AI Image Editing Suite`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-07-inpaint-integration` |
| **Test** | `pnpm test components/canvas/__tests__/canvas-chat-panel-inpaint.test.tsx lib/__tests__/canvas-chat-service-edit.test.ts components/canvas/__tests__/canvas-toolbar-edit.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-canvas-detail-context", "slice-04-floating-brush-toolbar", "slice-05-mask-service", "slice-06a-generation-service", "slice-06b-canvas-agent"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/__tests__/canvas-chat-panel-inpaint.test.tsx lib/__tests__/canvas-chat-service-edit.test.ts components/canvas/__tests__/canvas-toolbar-edit.test.tsx` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm test -- --run` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (MaskService, generateImages, R2 Upload, SSE-Stream gemockt) |

---

## Ziel

Drei Dateien erweitern, um den Inpaint-End-to-End-Flow zu verdrahten: (1) SSE-Event-Typ und Parser um die 4 neuen Actions und Edit-Felder erweitern, (2) `handleCanvasGenerate` im Chat-Panel so erweitern, dass bei `action="inpaint"` die Maske exportiert, zu R2 hochgeladen und mit `maskUrl` + `generationMode="inpaint"` an `generateImages()` uebergeben wird, (3) 4 neue Toolbar-Buttons registrieren.

---

## Acceptance Criteria

1) GIVEN `SSECanvasGenerateEvent` in `canvas-chat-service.ts`
   WHEN ein SSE-Event mit `action: "inpaint"` und `mask_url: "https://r2.example.com/mask.png"` geparsed wird
   THEN gibt `parseSSEEvent` ein Objekt zurueck mit `action: "inpaint"` und `mask_url: "https://r2.example.com/mask.png"`

2) GIVEN `SSECanvasGenerateEvent` in `canvas-chat-service.ts`
   WHEN ein SSE-Event mit `action: "outpaint"`, `outpaint_directions: ["top","right"]`, `outpaint_size: 50` geparsed wird
   THEN gibt `parseSSEEvent` ein Objekt zurueck mit allen drei Feldern korrekt gemappt

3) GIVEN ein SSE-Event mit `action: "inpaint"` trifft in `handleCanvasGenerate` ein
   AND `state.maskData` ist eine gueltige `ImageData`-Instanz
   WHEN der Handler ausgefuehrt wird
   THEN wird `MaskService.validateMinSize()` mit `minSize: 10` aufgerufen
   AND `MaskService.applyFeathering()` mit `radius: 10` aufgerufen
   AND `MaskService.scaleToOriginal()` mit den Original-Bilddimensionen aufgerufen
   AND `MaskService.toGrayscalePng()` aufgerufen
   AND der resultierende PNG-Blob wird zu R2 hochgeladen
   AND `generateImages()` wird mit `generationMode: "inpaint"`, `maskUrl` (R2-URL) und `sourceImageUrl` aufgerufen

4) GIVEN ein SSE-Event mit `action: "inpaint"` trifft ein
   AND `state.maskData` ist `null` (keine Maske gemalt)
   WHEN der Handler ausgefuehrt wird
   THEN wird `generateImages()` mit `generationMode: "instruction"` aufgerufen (Fallback, keine Maske -> instruction)

5) GIVEN `MaskService.validateMinSize()` gibt `{ valid: false }` zurueck
   WHEN `handleCanvasGenerate` mit `action: "inpaint"` ausgefuehrt wird
   THEN wird ein Toast mit Nachricht "Markiere einen groesseren Bereich" angezeigt
   AND `generateImages()` wird NICHT aufgerufen

6) GIVEN `generateImages()` wurde erfolgreich aufgerufen und Polling liefert ein Ergebnis
   WHEN das Ergebnis-Bild vorliegt
   THEN wird `PUSH_UNDO` mit dem aktuellen Bild dispatched
   AND `SET_CURRENT_IMAGE` mit der neuen Bild-URL dispatched

7) GIVEN die TOOLS-Array in `canvas-toolbar.tsx`
   WHEN die Toolbar gerendert wird
   THEN enthaelt sie 4 neue Eintraege: `brush-edit` (Label: "Brush Edit"), `erase` (Label: "Erase"), `click-edit` (Label: "Click Edit"), `expand` (Label: "Expand")
   AND alle 4 haben `toggle: true`

8) GIVEN der User klickt den `brush-edit` Button in der Toolbar
   WHEN der Toggle-Handler ausgefuehrt wird
   THEN wird `SET_EDIT_MODE` mit `"inpaint"` dispatched

9) GIVEN der User klickt den `erase` Button in der Toolbar
   WHEN der Toggle-Handler ausgefuehrt wird
   THEN wird `SET_EDIT_MODE` mit `"erase"` dispatched

10) GIVEN ein SSE-Event mit `action: "erase"` trifft in `handleCanvasGenerate` ein
    WHEN der Handler ausgefuehrt wird
    THEN wird `generateImages()` mit `generationMode: "erase"` und `maskUrl` aufgerufen (gleicher Mask-Export-Flow wie inpaint)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/__tests__/canvas-chat-service-edit.test.ts`

<test_spec>
```typescript
// AC-1: parseSSEEvent parsed inpaint action mit mask_url
it.todo('should parse SSE event with action inpaint and mask_url')

// AC-2: parseSSEEvent parsed outpaint action mit directions und size
it.todo('should parse SSE event with action outpaint including outpaint_directions and outpaint_size')
```
</test_spec>

### Test-Datei: `components/canvas/__tests__/canvas-chat-panel-inpaint.test.tsx`

<test_spec>
```typescript
// AC-3: Inpaint-Flow fuehrt Mask-Pipeline aus und ruft generateImages auf
it.todo('should export mask via MaskService pipeline and call generateImages with inpaint mode and maskUrl')

// AC-4: Fallback zu instruction wenn keine Maske vorhanden
it.todo('should fall back to instruction mode when maskData is null on inpaint action')

// AC-5: Toast bei zu kleiner Maske, kein generateImages-Aufruf
it.todo('should show toast and skip generation when mask is too small')

// AC-6: PUSH_UNDO und SET_CURRENT_IMAGE nach erfolgreichem Polling
it.todo('should dispatch PUSH_UNDO and SET_CURRENT_IMAGE after successful generation result')

// AC-10: Erase-Action fuehrt Mask-Export und generateImages mit erase-Mode aus
it.todo('should call generateImages with erase mode and maskUrl on erase action')
```
</test_spec>

### Test-Datei: `components/canvas/__tests__/canvas-toolbar-edit.test.tsx`

<test_spec>
```typescript
// AC-7: 4 neue Toolbar-Buttons vorhanden
it.todo('should render brush-edit, erase, click-edit, and expand buttons with toggle true')

// AC-8: brush-edit Button dispatched SET_EDIT_MODE inpaint
it.todo('should dispatch SET_EDIT_MODE with inpaint when brush-edit toggled')

// AC-9: erase Button dispatched SET_EDIT_MODE erase
it.todo('should dispatch SET_EDIT_MODE with erase when erase toggled')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-02` | `CanvasDetailState.editMode`, `maskData` + Dispatch `SET_EDIT_MODE` | State + Action | State-Felder lesbar, Dispatch aendert State |
| `slice-04` | `FloatingBrushToolbar` | Component | Gemountet in canvas-detail-view, liefert `onEraseAction` Callback |
| `slice-05` | `toGrayscalePng`, `applyFeathering`, `scaleToOriginal`, `validateMinSize` | Functions | Import aus `lib/services/mask-service.ts` |
| `slice-06a` | `generateImages()` mit `maskUrl`, `generationMode` | Server Action | Akzeptiert `"inpaint"`, `"erase"` mit `maskUrl` |
| `slice-06b` | SSE `canvas-generate` Event mit erweiterten Actions | SSE Payload | Backend sendet `action: "inpaint" \| "erase" \| "instruction" \| "outpaint"` + optionale Felder |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `handleCanvasGenerate` (erweitert) | Function | slice-08 (instruction branch), slice-13 (outpaint branch) | Dispatch-basierter Handler mit action-Switch |
| `SSECanvasGenerateEvent` (erweitert) | Type | slice-08, slice-09, slice-13 | `action: "variation" \| "img2img" \| "inpaint" \| "erase" \| "instruction" \| "outpaint"` + optionale Felder |
| `parseSSEEvent` (erweitert) | Function | slice-08, slice-13 | Parsed neue Actions + Felder |
| 4 Toolbar-Buttons | ToolDef[] | slice-09 (erase-Button-State), slice-11 (click-edit Aktivierung) | `brush-edit`, `erase`, `click-edit`, `expand` in TOOLS Array |
| Mask-Upload-Pipeline | Pattern | slice-09 (Erase Direct), slice-13 (Outpaint) | MaskService-Aufrufe + R2-Upload-Sequenz in handleCanvasGenerate |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/canvas-chat-service.ts` -- `SSECanvasGenerateEvent` um 4 Actions + `mask_url`, `outpaint_directions`, `outpaint_size` Felder erweitern; `parseSSEEvent` fuer neue Felder anpassen
- [ ] `components/canvas/canvas-chat-panel.tsx` -- `handleCanvasGenerate` um Inpaint/Erase-Branch erweitern: Mask-Export-Pipeline (validate, feather, scale, grayscale, upload) + generateImages-Aufruf mit maskUrl
- [ ] `components/canvas/canvas-toolbar.tsx` -- 4 neue ToolDef-Eintraege (brush-edit, erase, click-edit, expand) mit toggle: true und SET_EDIT_MODE Dispatch
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Instruction-Editing-Branch in handleCanvasGenerate (nur Fallback-Erkennung wenn keine Maske bei inpaint -> instruction) -- vollstaendiger instruction-Branch ist Slice 08
- KEIN Erase-Direct-Flow (Entfernen-Button -> generateImages ohne Agent) -- das ist Slice 09
- KEINE Outpaint-spezifische Logik (Canvas-Extension, Direction-Handling) -- das ist Slice 13
- KEINE Click-to-Edit-Logik (SAM API Call bei Toolbar-Button) -- das ist Slice 10/11
- KEINE Keyboard Shortcuts -- das ist Slice 14
- KEIN MaskCanvas-Mounting in canvas-detail-view (bereits in Slice 03/04 erledigt)
- KEIN isGenerating-State-Handling fuer Toolbar-Disabling waehrend Generation

**Technische Constraints:**
- Mask-Upload zu R2 via bestehende `StorageService.upload()` (temporaer, Mask-Dateien bekommen Prefix `masks/`)
- `action`-zu-`generationMode`-Mapping: `"inpaint"` -> `"inpaint"`, `"erase"` -> `"erase"`, `"instruction"` -> `"instruction"`, `"outpaint"` -> `"outpaint"`
- Slot-Resolution: `resolveSlotForMode(action)` nutzt bestehende Model-Slot-Logik mit dem gemappten generationMode
- Toast-Meldungen auf Deutsch (konsistent mit architecture.md → Error Handling Strategy)
- `parseSSEEvent` muss rueckwaertskompatibel bleiben: bestehende `"variation"` und `"img2img"` Events duerfen nicht brechen

**Reuse (PFLICHT):**

| Existing File | Usage in this Slice |
|---|---|
| `components/canvas/canvas-chat-panel.tsx` | MODIFY -- `handleCanvasGenerate` um action-Switch erweitern |
| `lib/canvas-chat-service.ts` | MODIFY -- `SSECanvasGenerateEvent` Type + `parseSSEEvent` Funktion erweitern |
| `components/canvas/canvas-toolbar.tsx` | MODIFY -- TOOLS Array um 4 Eintraege erweitern |
| `lib/services/mask-service.ts` | IMPORT -- `validateMinSize`, `applyFeathering`, `scaleToOriginal`, `toGrayscalePng` |
| `app/actions/generations.ts` | IMPORT -- `generateImages()` mit erweiterten Parametern |
| `lib/canvas-detail-context.tsx` | IMPORT -- `useCanvasDetail()` fuer State (maskData, editMode) und dispatch |

**Referenzen:**
- Architecture: `architecture.md` → Migration Map Zeile 331-332 (canvas-chat-panel + canvas-chat-service Aenderungen)
- Architecture: `architecture.md` → Migration Map Zeile 329 (canvas-toolbar 4 neue ToolDefs)
- Architecture: `architecture.md` → Data Flow Zeile 274-304 (MaskCanvas → MaskService → R2 → handleCanvasGenerate → generateImages Pipeline)
- Architecture: `architecture.md` → API Design Zeile 94 (SSECanvasGenerateEvent erweiterte Felder)
- Architecture: `architecture.md` → Error Handling Strategy Zeile 310-311 (Mask too small Toast, Mask upload failed Toast)
- Wireframes: `wireframes.md` → Screen "Canvas Detail-View (Idle)" (Annotations 2-5: 4 neue Toolbar-Buttons)
- Wireframes: `wireframes.md` → Screen "Generating State" (Loading overlay, mask bleibt sichtbar)
