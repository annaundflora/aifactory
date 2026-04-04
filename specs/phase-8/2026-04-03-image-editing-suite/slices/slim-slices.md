# Slice Decomposition

**Feature:** AI Image Editing Suite
**Discovery-Slices:** 7 (grobe Slices)
**Atomare Slices:** 16
**Stack:** TypeScript/Next.js (vitest + playwright)

---

## Dependency Graph

```
slice-01 (Types & Model Slot Defaults)
    |
    +---> slice-02 (Canvas Detail Context Extension)
    |         |
    |         +---> slice-03 (Mask Canvas Component)
    |         |         |
    |         |         +---> slice-04 (Floating Brush Toolbar)
    |         |         |         |
    |         |         |         +---> slice-07 (Inpaint Chat-Panel Integration)
    |         |         |         |         |
    |         |         |         |         +---> slice-09 (Erase Direct Flow)
    |         |         |         |         |
    |         |         |         |         +---> slice-10 (SAM API Route)
    |         |         |         |         |         |
    |         |         |         |         |         +---> slice-11 (Click-to-Edit Frontend)
    |         |         |         |         |
    |         |         |         |         +---> slice-13 (Outpaint Chat Integration)
    |         |         |         |
    |         |         +---> slice-05 (Mask Service)
    |         |
    |         +---> slice-12 (Outpaint Controls UI)
    |
    +---> slice-06a (Generation Service Extension)
    |
    +---> slice-06b (Canvas Agent Extension - Python)
    |
    +---> slice-08 (Instruction Editing Flow)

slice-06a + slice-06b ---> slice-07
slice-05 ---> slice-07
slice-07 ---> slice-08 (Agent already extended)
```

Vereinfachte Darstellung der Haupt-Pfade:

```
                    slice-01 (Types & Slots)
                   /          |            \
            slice-02       slice-06a     slice-06b
          (Context)      (GenService)   (Agent/Py)
           /      \           |            |
     slice-03   slice-12     |            |
    (MaskCanvas) (Outpaint)  |            |
        |                    |            |
     slice-04             slice-05        |
   (BrushToolbar)       (MaskService)     |
        |                    |            |
        +--------------------+------------+
                    |
               slice-07 (Inpaint Integration)
              /    |     \
       slice-08  slice-09  slice-13
      (Instruct) (Erase)  (Outpaint Integr.)
                             |
               slice-10 ---> slice-11
             (SAM API)    (Click-to-Edit FE)
                             |
                          slice-14
                      (Keyboard Shortcuts)
                             |
                          slice-15
                        (Nav-Sperre)
                             |
                          slice-16
                        (E2E Smoke)
```

---

## Slice-Liste

### Slice 01: Types & Model Slot Defaults
- **Scope:** GenerationMode-Type um `erase` und `instruction` erweitern. VALID_GENERATION_MODES aktualisieren. Seed-Defaults fuer neue model_slots (inpaint, erase, instruction, outpaint) mit konkreten Modell-IDs befuellen.
- **Deliverables:**
  - `lib/types.ts` (2 Zeilen: GenerationMode + VALID_GENERATION_MODES erweitern)
  - `lib/db/queries.ts` (seedModelSlotDefaults um neue Mode-Rows + Default-Modelle erweitern)
- **Done-Signal:** `vitest run` -- Tests fuer VALID_GENERATION_MODES enthalten `erase` und `instruction`. Seed-Funktion erzeugt Rows fuer alle 4 Edit-Modi mit korrekten Replicate-IDs.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 4 "Edit Model Slots"

### Slice 02: Canvas Detail Context Extension
- **Scope:** `CanvasDetailState` um Edit-Mode-Fields erweitern: `editMode`, `maskData`, `brushSize`, `brushTool`, `outpaintDirections`, `outpaintSize`. Neue Action-Types: `SET_EDIT_MODE`, `SET_MASK_DATA`, `SET_BRUSH_SIZE`, `SET_BRUSH_TOOL`, `SET_OUTPAINT_DIRECTIONS`, `SET_OUTPAINT_SIZE`, `CLEAR_MASK`. Reducer-Cases implementieren.
- **Deliverables:**
  - `lib/canvas-detail-context.tsx` (State-Interface erweitern, ~7 neue Actions, ~7 neue Reducer-Cases)
- **Done-Signal:** `vitest run` -- Unit-Tests fuer jeden neuen Reducer-Case: dispatch SET_EDIT_MODE setzt editMode, dispatch CLEAR_MASK setzt maskData auf null, etc.
- **Dependencies:** ["slice-01"]
- **Discovery-Quelle:** Slice 1 "Mask Canvas Layer" (State-Anteil)

### Slice 03: Mask Canvas Component
- **Scope:** HTML5 Canvas Overlay-Component (`mask-canvas.tsx`) die exakt ueber dem Bild liegt. Unterstuetzt Brush-Painting (mousedown/mousemove/mouseup), Eraser-Modus, dynamische Brush-Groesse, Clear-All. Rendert Maske als semi-transparentes Rot (50% Opacity). Cursor als Kreis in Brush-Groesse.
- **Deliverables:**
  - `components/canvas/mask-canvas.tsx` (neues Component)
- **Done-Signal:** Component rendert im Storybook/isoliert. Manueller Test: Maske malen, Brush-Groesse aendern, Eraser nutzen, Clear. Canvas-Pixel enthalten rote Mask-Daten nach Painting.
- **Dependencies:** ["slice-02"]
- **Discovery-Quelle:** Slice 1 "Mask Canvas Layer" (Canvas-Component-Anteil)

### Slice 04: Floating Brush Toolbar
- **Scope:** Horizontale schwebende Toolbar ueber dem Canvas-Bereich (`floating-brush-toolbar.tsx`). Enthaelt: Brush-Size-Slider (1-100px), Brush/Eraser-Toggle, Clear-Mask-Button, Erase-Action-Button (nur im Erase-Modus sichtbar). Verbindet sich mit Context-State (brushSize, brushTool).
- **Deliverables:**
  - `components/canvas/floating-brush-toolbar.tsx` (neues Component)
- **Done-Signal:** Component rendert korrekt. Slider aendert brushSize im Context. Toggle wechselt brushTool. Clear-Button dispatcht CLEAR_MASK. Erase-Action-Button nur sichtbar wenn editMode === 'erase'.
- **Dependencies:** ["slice-02", "slice-03"]
- **Discovery-Quelle:** Slice 1 "Mask Canvas Layer" (Toolbar-Anteil)

### Slice 05: Mask Service
- **Scope:** Frontend-Utility-Service (`mask-service.ts`) fuer Mask-Operationen: (1) RGBA Canvas-Daten zu Grayscale-PNG konvertieren (weiss=Edit, schwarz=Keep), (2) 10px Gaussian-Blur Feathering auf Mask-Kanten, (3) Skalierung von Display-Aufloesung auf Original-Bildaufloesung, (4) Mask-Minimum-Size-Validation (>= 10px Bounding Box).
- **Deliverables:**
  - `lib/services/mask-service.ts` (neuer Service)
- **Done-Signal:** `vitest run` -- Unit-Tests: (a) Konvertierung erzeugt valides Grayscale-PNG, (b) Feathering weicht Kanten auf, (c) Skalierung produziert korrekte Dimensionen, (d) Validation erkennt zu kleine Masken.
- **Dependencies:** ["slice-03"]
- **Discovery-Quelle:** Slice 1 "Mask Canvas Layer" (Service-Anteil)

### Slice 06a: Generation Service Extension
- **Scope:** `GenerationService.generate()` um Mode-Validation fuer neue Modi erweitern. `buildReplicateInput()` um Branches fuer `inpaint` (image + mask + prompt), `erase` (image + mask), `instruction` (image + prompt), `outpaint` (extended-image + mask + prompt) erweitern. `GenerateImagesInput` um `maskUrl`, `outpaintDirections`, `outpaintSize` Felder erweitern.
- **Deliverables:**
  - `lib/services/generation-service.ts` (Validation + buildReplicateInput erweitern)
  - `app/actions/generations.ts` (GenerateImagesInput-Type erweitern, Felder durchreichen)
- **Done-Signal:** `vitest run` -- Unit-Tests: buildReplicateInput erzeugt korrektes Input-Objekt fuer jeden neuen Modus. Validation akzeptiert alle 7 Modi.
- **Dependencies:** ["slice-01"]
- **Discovery-Quelle:** Slice 2 "Inpaint Generation Flow" (Backend-Service-Anteil)

### Slice 06b: Canvas Agent Extension (Python)
- **Scope:** Canvas Agent System-Prompt um Edit-Intent-Klassifikation erweitern: Mask vorhanden + Prompt -> action="inpaint", keine Mask + Edit-Intent -> action="instruction", Outpaint-Kontext -> action="outpaint". `generate_image` Tool um neue Actions (`inpaint`, `erase`, `instruction`, `outpaint`) und Parameter (`mask_url`, `outpaint_directions`, `outpaint_size`) erweitern. `CanvasImageContext` DTO um `mask_url` Feld erweitern.
- **Deliverables:**
  - `backend/app/agent/canvas_graph.py` (System-Prompt erweitern)
  - `backend/app/agent/tools/image_tools.py` (Tool-Signatur + Validation erweitern)
  - `backend/app/routes/canvas_sessions.py` (CanvasImageContext DTO erweitern)
- **Done-Signal:** Python-Tests: Agent routet Mask+Prompt zu action="inpaint", No-Mask+Edit-Intent zu action="instruction", Outpaint-Kontext zu action="outpaint". Tool akzeptiert neue Actions und Parameter.
- **Dependencies:** ["slice-01"]
- **Discovery-Quelle:** Slice 2 "Inpaint Generation Flow" (Agent-Anteil) + Slice 7 "Instruction Editing" (Agent-Anteil)

### Slice 07: Inpaint Chat-Panel Integration
- **Scope:** `handleCanvasGenerate` in `canvas-chat-panel.tsx` erweitern: Bei SSE-Event mit action="inpaint" Mask-PNG ueber MaskService exportieren, zu R2 hochladen, maskUrl + generationMode="inpaint" an `generateImages()` uebergeben. `SSECanvasGenerateEvent` in `canvas-chat-service.ts` um neue Actions und Felder erweitern. `parseSSEEvent` anpassen. Toolbar-Buttons (brush-edit, erase, click-edit, expand) in `canvas-toolbar.tsx` registrieren. MaskCanvas + FloatingBrushToolbar in `canvas-detail-view.tsx` einbinden.
- **Deliverables:**
  - `components/canvas/canvas-chat-panel.tsx` (handleCanvasGenerate erweitern)
  - `lib/canvas-chat-service.ts` (SSECanvasGenerateEvent + parseSSEEvent erweitern)
  - `components/canvas/canvas-toolbar.tsx` (4 neue ToolDef-Eintraege)
- **Done-Signal:** Integration-Test: Maske malen -> Prompt im Chat senden -> SSE-Event mit action="inpaint" -> Mask-Upload -> generateImages() mit maskUrl aufgerufen -> Polling -> Bild ersetzt -> PUSH_UNDO. Toolbar zeigt 4 neue Buttons.
- **Dependencies:** ["slice-02", "slice-04", "slice-05", "slice-06a", "slice-06b"]
- **Discovery-Quelle:** Slice 2 "Inpaint Generation Flow" (Integration-Anteil)

### Slice 08: Instruction Editing Flow
- **Scope:** Instruction-Editing End-to-End verdrahten: Wenn User im Canvas-Chat einen Edit-Intent-Prompt sendet (ohne Maske, kein Edit-Tool aktiv), routet der Canvas Agent zu action="instruction". `handleCanvasGenerate` erkennt action="instruction", setzt generationMode="instruction", uebergibt nur sourceImageUrl + Prompt (keine Maske). Slot-Resolution fuer instruction-Mode.
- **Deliverables:**
  - `components/canvas/canvas-chat-panel.tsx` (instruction-Branch in handleCanvasGenerate)
- **Done-Signal:** Integration-Test: Kein Edit-Tool aktiv -> "Mach den Himmel blauer" im Chat -> Agent routet zu instruction -> generateImages(mode="instruction") -> FLUX Kontext Pro API Call -> Bild ersetzt.
- **Dependencies:** ["slice-07"]
- **Discovery-Quelle:** Slice 7 "Instruction Editing"

### Slice 09: Erase Direct Flow
- **Scope:** Erase-Flow ohne Canvas Agent: Wenn User im Erase-Modus den "Entfernen"-Button klickt, wird `generateImages()` direkt aufgerufen (kein SSE, kein Agent). Mask-PNG Export + R2-Upload + mode="erase" + sourceImageUrl. Erase-Modus-Upgrade zu Inpaint wenn Prompt gesendet wird (Chat-Prompt im Erase-Modus -> Inpaint statt Erase).
- **Deliverables:**
  - `components/canvas/canvas-detail-view.tsx` (handleEraseAction + Mask-Canvas/Toolbar Einbindung in Center-Column)
  - `components/canvas/floating-brush-toolbar.tsx` (Erase-Action-Button onClick-Handler verdrahten)
- **Done-Signal:** Integration-Test: Erase-Modus -> Maske malen -> "Entfernen" klicken -> generateImages(mode="erase", maskUrl=...) aufgerufen -> Bria Eraser API -> Bild ersetzt -> Undo funktioniert. Chat-Prompt im Erase-Modus -> Inpaint statt Erase.
- **Dependencies:** ["slice-07"]
- **Discovery-Quelle:** Slice 3 "Erase Generation Flow"

### Slice 10: SAM API Route
- **Scope:** Neuer Next.js Route Handler `POST /api/sam/segment`. Nimmt `SAMSegmentRequest` (image_url, click_x, click_y) entgegen, validiert Eingaben (Koordinaten 0-1, URL-Check), ruft SAM 2 via Replicate auf, laedt resultierende Mask-PNG zu R2 hoch (temporaer, 24h TTL), gibt `SAMSegmentResponse` (mask_url) zurueck.
- **Deliverables:**
  - `app/api/sam/segment/route.ts` (neuer Route Handler)
- **Done-Signal:** `vitest run` -- Unit-Test: Route validiert Input, ruft Replicate auf, gibt mask_url zurueck. Integration-Test: POST mit gueltigen Koordinaten -> 200 + mask_url. Ungueltige Koordinaten -> 400.
- **Dependencies:** ["slice-07"]
- **Discovery-Quelle:** Slice 5 "Click-to-Edit (SAM)" (Backend-Anteil)

### Slice 11: Click-to-Edit Frontend
- **Scope:** Click-to-Edit UI-Flow: Wenn `click-edit-btn` aktiv -> Cursor wird Fadenkreuz -> Klick auf Bild berechnet normalisierte Koordinaten -> POST `/api/sam/segment` -> Loading-Indicator -> SAM-Mask als rotes Overlay im MaskCanvas rendern -> Transition zu Painting-State (Floating Toolbar erscheint). Confirmation-Dialog wenn bereits Maske vorhanden. Error-Handling (kein Objekt erkannt, API-Fehler).
- **Deliverables:**
  - `components/canvas/canvas-detail-view.tsx` (Click-Handler auf Bild, SAM-API-Call, Mask-Rendering)
- **Done-Signal:** Integration-Test: Click-Edit aktivieren -> auf Objekt klicken -> Loading -> Auto-Mask erscheint als rotes Overlay -> Floating Toolbar erscheint -> User kann Maske verfeinern. Error-Toast bei SAM-Fehler.
- **Dependencies:** ["slice-07", "slice-10"]
- **Discovery-Quelle:** Slice 5 "Click-to-Edit (SAM)" (Frontend-Anteil)

### Slice 12: Outpaint Controls UI
- **Scope:** Neues Component `outpaint-controls.tsx` mit Direction-Buttons an den 4 Bildkanten (Top, Bottom, Left, Right) und Size-Selection (25%, 50%, 100%) pro Richtung. Verbindet sich mit Context-State (outpaintDirections, outpaintSize). Erscheint wenn expand-btn aktiv. Default: 50% vorausgewaehlt.
- **Deliverables:**
  - `components/canvas/outpaint-controls.tsx` (neues Component)
- **Done-Signal:** Component rendert Direction-Buttons an den Bildkanten. Klick auf Richtung togglet Selection im Context. Size-Buttons aendern outpaintSize. Default 50% ist vorausgewaehlt.
- **Dependencies:** ["slice-02"]
- **Discovery-Quelle:** Slice 6 "Outpainting" (UI-Anteil)

### Slice 13: Outpaint Chat Integration & Canvas Extension
- **Scope:** Outpaint End-to-End verdrahten: OutpaintControls in `canvas-detail-view.tsx` einbinden. `handleCanvasGenerate` bei action="outpaint" -> outpaintDirections + outpaintSize an generateImages() uebergeben. Server-seitige Canvas-Erweiterung via `sharp` (Bild + transparentes Padding) in GenerationService. Mask-Generierung fuer erweiterten Bereich. Send-Button disabled wenn keine Richtung gewaehlt. Inline-Hinweis.
- **Deliverables:**
  - `components/canvas/canvas-detail-view.tsx` (OutpaintControls einbinden)
  - `components/canvas/canvas-chat-panel.tsx` (outpaint-Branch in handleCanvasGenerate)
  - `lib/services/generation-service.ts` (Outpaint Canvas-Extension mit sharp)
- **Done-Signal:** Integration-Test: Expand aktivieren -> Richtung waehlen -> Prompt senden -> Canvas-Erweiterung + Mask-Generierung -> FLUX Fill Pro API -> erweitertes Bild ersetzt Original -> Undo funktioniert. Ohne Richtung: Send-Button disabled.
- **Dependencies:** ["slice-07", "slice-12"]
- **Discovery-Quelle:** Slice 6 "Outpainting" (Integration-Anteil)

### Slice 14: Keyboard Shortcuts & Mask Undo
- **Scope:** Keyboard-Event-Handler fuer Mask-Painting-Modi: `[`/`]` fuer Brush-Groesse, `E` fuer Brush/Eraser-Toggle, `Ctrl+Z`/`Cmd+Z` fuer Mask-Undo (eigener Undo-Stack, getrennt vom Bild-Undo). Shortcuts nur aktiv wenn ein Painting-Modus aktiv ist.
- **Deliverables:**
  - `components/canvas/mask-canvas.tsx` (Mask-Undo-Stack + Keyboard-Event-Listener)
- **Done-Signal:** Manueller Test: `[` verkleinert Brush, `]` vergroessert, `E` togglet Eraser, `Ctrl+Z` macht letzten Mask-Stroke rueckgaengig. Shortcuts inaktiv ausserhalb des Painting-Modus.
- **Dependencies:** ["slice-03", "slice-04"]
- **Discovery-Quelle:** Slice 1 "Mask Canvas Layer" (Keyboard-Anteil, aus Business Rules)

### Slice 15: Navigation Lock & State Cleanup
- **Scope:** Prev/Next-Navigation blockieren wenn Maske existiert. Toolbar-Mutual-Exclusion sicherstellen: Klick auf Toggle-Tool (Details, Variation, img2img, Upscale) waehrend Edit-Modus aktiv -> Edit deaktiviert, Maske bleibt im State. Mask-Canvas visibility an editMode gekoppelt.
- **Deliverables:**
  - `components/canvas/canvas-detail-view.tsx` (Navigation-Lock-Logik)
  - `components/canvas/canvas-toolbar.tsx` (Mutual-Exclusion bei Tool-Wechsel)
- **Done-Signal:** Manueller Test: Maske malen -> Prev/Next-Buttons disabled. Tool-Wechsel zu Variation -> Edit-UI hidden, Maske im State. Zurueck zu Brush Edit -> Maske wieder sichtbar.
- **Dependencies:** ["slice-07"]
- **Discovery-Quelle:** Slice 1 "Mask Canvas Layer" (Business Rules: Navigation-Sperre, Mutual Exclusion)

### Slice 16: E2E Smoke Tests
- **Scope:** Playwright E2E-Tests fuer die Kern-Flows: (1) Inpaint: Maske malen -> Prompt -> Bild ersetzt, (2) Erase: Maske -> Entfernen -> Bild ersetzt, (3) Instruction Edit: Prompt ohne Maske -> Bild aendert sich, (4) Click-to-Edit: Klick -> Auto-Mask -> Prompt, (5) Outpaint: Richtung -> Prompt -> Bild erweitert.
- **Deliverables:**
  - `e2e/image-editing-suite.spec.ts` (neues E2E-Test-File)
- **Done-Signal:** `npx playwright test e2e/image-editing-suite.spec.ts` -- Alle 5 Smoke-Tests bestehen (mit gemockter Replicate API).
- **Dependencies:** ["slice-07", "slice-08", "slice-09", "slice-11", "slice-13"]
- **Discovery-Quelle:** Alle Slices (Querschnitt)

---

## Flow-Traceability

| Discovery-Slice | Integration-Testfall | Abgedeckt in Slice | Done-Signal |
|-----------------|----------------------|--------------------|-------------|
| Slice 1 "Mask Canvas Layer" | Maske auf Bild malen, Brush-Groesse aendern, Clear, Eraser nutzen | slice-03, slice-04, slice-14 | MaskCanvas rendert, Brush-Controls funktionieren, Keyboard Shortcuts aktiv |
| Slice 1 "Mask Canvas Layer" | Mask-PNG Export pruefen | slice-05 | Unit-Tests: Grayscale-PNG korrekt, Feathering, Skalierung |
| Slice 2 "Inpaint Generation Flow" | Maske malen -> Prompt im Chat -> Inpaint-Ergebnis ersetzt Bild -> Undo funktioniert | slice-07 | handleCanvasGenerate bei action="inpaint" -> maskUrl -> generateImages -> Polling -> PUSH_UNDO |
| Slice 3 "Erase Generation Flow" | Maske malen -> "Entfernen" klicken -> Objekt entfernt -> Undo funktioniert | slice-09 | handleEraseAction -> generateImages(mode="erase") -> Polling -> PUSH_UNDO |
| Slice 3 "Erase Generation Flow" | Chat-Prompt im Erase-Modus -> Upgrade zu Inpaint | slice-09 | Erase + Prompt -> Inpaint-Flow statt Erase |
| Slice 4 "Edit Model Slots" | Model Slots fuer inpaint/erase/outpaint konfigurierbar, Default-Modelle gesetzt | slice-01 | Seed-Funktion erzeugt korrekte Rows mit Replicate-IDs |
| Slice 5 "Click-to-Edit (SAM)" | Objekt klicken -> Auto-Mask erscheint -> anpassen moeglich -> Prompt -> Inpaint | slice-10, slice-11 | SAM-Route gibt mask_url zurueck. Frontend rendert Auto-Mask, Transition zu Painting-State |
| Slice 6 "Outpainting" | Richtung waehlen -> Groesse waehlen -> Prompt -> Bild erweitert | slice-12, slice-13 | Outpaint-Controls funktional. Canvas-Extension + Mask -> API -> erweitertes Bild |
| Slice 7 "Instruction Editing" | Im Chat "Mach den Himmel blauer" -> Bild aendert sich -> Undo | slice-08 | Agent routet zu instruction -> FLUX Kontext Pro -> Bild ersetzt |
| Business Rule: Navigation-Sperre | Prev/Next blockiert bei aktiver Maske | slice-15 | Navigation-Buttons disabled wenn maskData !== null |
| Business Rule: Toolbar Mutual Exclusion | Edit-Tool deaktiviert bei Toggle-Tool-Wechsel, Maske bleibt | slice-15 | Tool-Wechsel -> Edit-UI hidden, Maske im State erhalten |
| Business Rule: Mask bleibt nach Edit | Maske nach erfolgreichem Edit weiterhin sichtbar | slice-07 | Nach PUSH_UNDO: maskData bleibt im State, MaskCanvas bleibt sichtbar |
| E2E: Alle 5 Kern-Flows | Inpaint, Erase, Instruction, Click-to-Edit, Outpaint | slice-16 | Playwright-Tests bestehen mit gemockter API |

---

## Qualitaets-Checkliste

- [x] Jeder Slice hat maximal 3 produktive Deliverable-Dateien
- [x] Jeder Slice hat ein messbares Done-Signal
- [x] Dependencies sind azyklisch (DAG)
- [x] Alle Deliverables aus der Discovery sind abgedeckt (nichts vergessen)
- [x] Kein Slice hat mehr als ein Concern (DB+UI = zu viel)
- [x] Schema/Service-Slices kommen vor UI-Slices
- [x] Stack ist korrekt erkannt und dokumentiert
- [x] Flow-Completeness: Jeder Integration-Testfall aus Discovery-Testability hat einen zugehoerigen Slice mit passendem Done-Signal
