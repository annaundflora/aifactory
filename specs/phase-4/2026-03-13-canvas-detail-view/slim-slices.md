# Slim Slice Decomposition

**Feature:** Canvas Detail-View & Editing Flow
**Discovery-Slices:** 6 grobe Slices
**Atomare Slices:** 18 Slices
**Stack:** TypeScript/Next.js 16 (Frontend, vitest) + Python/FastAPI (Backend, pytest)

---

## Dependency Graph

```
slice-01 (DB Schema: batchId)
    |
    v
slice-02 (batchId in GenerationService + Queries)
    |
    +------------------------------------------+
    |                                          |
    v                                          v
slice-03 (CanvasDetailContext)           slice-04 (getSiblingGenerations Action)
    |                                          |
    +------------------+-----------------------+
    |                  |
    v                  v
slice-05 (Detail-View Shell)     slice-06 (Animated Transition)
    |
    +------------------+-------------------+-------------------+
    |                  |                   |                   |
    v                  v                   v                   v
slice-07           slice-08           slice-09           slice-10
(Toolbar UI)       (Siblings +        (Chat Panel UI)    (Details Overlay)
    |               Prev/Next)
    |
    +------------------+-------------------+
    |                  |                   |
    v                  v                   v
slice-11           slice-12           slice-13
(Variation         (img2img            (Upscale
 Popover)           Popover)            Popover)
    |                  |                   |
    +------------------+-------------------+
    |
    v
slice-14 (In-Place Generation + Polling Integration)
    |
    v
slice-15 (Undo/Redo Stack)
    |
    +------------------+
    |                  |
    v                  v
slice-16           slice-17
(Canvas Agent      (Canvas Chat
 Backend)           Frontend Integration)
                       |
                       v
                   slice-18
                   (Lightbox Removal + Cleanup)
```

---

## Slice-Liste

### Slice 1: DB Schema — batchId Column
- **Scope:** Neues nullable UUID-Feld `batch_id` in der `generations`-Tabelle mit Index hinzufuegen. Drizzle-Schema und Migration.
- **Deliverables:**
  - `lib/db/schema.ts` (batchId Column + Index zu `generations` hinzufuegen)
  - `drizzle/XXXX_add_batch_id.sql` (Migration-Datei)
- **Done-Signal:** `pnpm drizzle-kit generate` erzeugt Migration ohne Fehler. Schema-Typ `Generation` enthaelt `batchId: string | null`.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 1 "Detail-View Shell" / Data-Section "batchId"

---

### Slice 2: batchId in GenerationService + Queries
- **Scope:** `GenerationService.generate()` erzeugt shared batchId (UUID) pro Request. `CreateGenerationInput` erhaelt `batchId`-Feld. Neue Query `getSiblingsByBatchId()` in queries.ts.
- **Deliverables:**
  - `lib/db/queries.ts` (CreateGenerationInput erweitern, `getSiblingsByBatchId()` Query)
  - `lib/services/generation-service.ts` (batchId-Generierung pro Batch)
- **Done-Signal:** Unit-Tests: `generate()` erzeugt Rows mit gleicher batchId. `getSiblingsByBatchId()` liefert korrekte Ergebnisse. NULL-batchId liefert leeres Array.
- **Dependencies:** ["slice-01"]
- **Discovery-Quelle:** Slice 1 "Detail-View Shell" / Data-Section "batchId", Architecture "Database Schema"

---

### Slice 3: CanvasDetailContext (State Management)
- **Scope:** Neuer React Context mit useReducer fuer Detail-View-State: currentGenerationId, activeToolId, undoStack, redoStack, isGenerating, chatSessionId, selectedModelId. Reducer-Actions fuer alle State-Transitions.
- **Deliverables:**
  - `lib/canvas-detail-context.tsx` (Context + Provider + Reducer + Hook)
- **Done-Signal:** Unit-Tests: Reducer verarbeitet alle Actions korrekt (SET_CURRENT_IMAGE, SET_ACTIVE_TOOL, PUSH_UNDO, POP_UNDO, PUSH_REDO, POP_REDO, SET_GENERATING, CLEAR_REDO). Undo-Stack Maximum 20 Eintraege.
- **Dependencies:** ["slice-02"]
- **Discovery-Quelle:** Slice 5 "In-Place Generation + Undo", Architecture "State Management"

---

### Slice 4: getSiblingGenerations Server Action
- **Scope:** Neue Server Action `getSiblingGenerations(batchId)` die Query aus Slice 2 aufruft und Generation-Array zurueckgibt.
- **Deliverables:**
  - `app/actions/generations.ts` (neue Action `getSiblingGenerations` hinzufuegen)
- **Done-Signal:** Unit-Test: Action ruft Query auf, liefert completed Generations mit gleicher batchId sortiert nach createdAt ASC.
- **Dependencies:** ["slice-02"]
- **Discovery-Quelle:** Architecture "New Endpoints" — `getSiblingGenerations(batchId)`

---

### Slice 5: Detail-View Shell (Layout + Mounting)
- **Scope:** Neue `CanvasDetailView`-Komponente als Fullscreen-View mit 3-Spalten-Layout (Toolbar-Slot links 48px, Canvas-Bereich mitte flex:1, Chat-Slot rechts collapsible). Back-Button im Header. ESC-Shortcut. WorkspaceContent zeigt CanvasDetailView statt Gallery bei aktivem detailViewOpen-State.
- **Deliverables:**
  - `components/canvas/canvas-detail-view.tsx` (Layout-Shell mit Slots)
  - `components/canvas/canvas-header.tsx` (Back-Button, Model-Selector-Slot, Undo/Redo-Slots)
  - `components/workspace/workspace-content.tsx` (detailViewOpen-State statt lightboxOpen, CanvasDetailView rendern)
- **Done-Signal:** Klick auf Gallery-Bild zeigt Fullscreen-Ansicht mit leerem 3-Spalten-Layout. ESC/Back fuehrt zurueck. Gallery-Grid verschwindet, Detail-View erscheint.
- **Dependencies:** ["slice-03"]
- **Discovery-Quelle:** Slice 1 "Detail-View Shell + Animated Transition"

---

### Slice 6: Animated Transition (Gallery <-> Detail)
- **Scope:** CSS View Transitions API fuer Gallery-zu-Detail-Uebergang. Next.js `experimental.viewTransition: true` in Config. `view-transition-name` auf GenerationCard-Image und Canvas-Image. Reverse-Animation beim Zurueckkehren.
- **Deliverables:**
  - `next.config.ts` (experimental viewTransition flag)
  - `components/canvas/canvas-detail-view.tsx` (view-transition-name auf Canvas-Image)
  - `components/workspace/generation-card.tsx` (view-transition-name auf Thumbnail)
- **Done-Signal:** Klick auf Gallery-Bild zeigt fliegende Animation (Bild waechst von Gallery-Position zu Fullscreen). ESC/Back zeigt Reverse-Animation. Graceful Degradation bei nicht-unterstuetztem Browser.
- **Dependencies:** ["slice-05"]
- **Discovery-Quelle:** Slice 1 "Detail-View Shell + Animated Transition"

---

### Slice 7: Toolbar UI (Icon Bar)
- **Scope:** Vertikale Icon-Toolbar (48px breit) mit 6 Icons: Variation, img2img, Upscale, Download, Delete, Details. Active-State-Highlighting. Nur ein aktives Tool gleichzeitig. Download triggert direkten Download. Delete zeigt Confirmation-Dialog.
- **Deliverables:**
  - `components/canvas/canvas-toolbar.tsx` (Toolbar-Container mit Tool-Icons)
  - `components/canvas/toolbar-button.tsx` (Einzelner Tool-Button mit States)
- **Done-Signal:** Toolbar rendert alle 6 Icons. Klick auf Tool markiert es als aktiv. Zweiter Klick deaktiviert. Download startet Datei-Download. Delete zeigt AlertDialog. Waehrend `isGenerating` sind alle Icons disabled.
- **Dependencies:** ["slice-05"]
- **Discovery-Quelle:** Slice 2 "Toolbar + Tool-Popovers"

---

### Slice 8: Siblings + Prev/Next Navigation
- **Scope:** Sibling-Thumbnails unter dem Hauptbild (Horizontal-Row). Aktives Bild hervorgehoben. Klick wechselt currentGenerationId. Prev/Next-Buttons links/rechts vom Canvas. Navigation durch alle Gallery-Bilder (neueste zuerst).
- **Deliverables:**
  - `components/canvas/sibling-thumbnails.tsx` (Thumbnail-Row mit batchId-Query)
  - `components/canvas/canvas-navigation.tsx` (Prev/Next-Buttons + Gallery-Index-Logic)
  - `components/canvas/canvas-image.tsx` (Zentriertes Hauptbild mit States: default, loading, error)
- **Done-Signal:** Siblings laden per batchId. Klick auf Sibling wechselt Hauptbild. Prev/Next navigiert durch Gallery. Buttons versteckt bei erstem/letztem Bild. Einzelbild-Generierung zeigt keine Sibling-Row.
- **Dependencies:** ["slice-04", "slice-05"]
- **Discovery-Quelle:** Slice 3 "Siblings + Prev/Next Navigation"

---

### Slice 9: Chat Panel UI (Shell + Messages)
- **Scope:** Chat-Container rechts im Detail-View. Collapsible (48px Icon-Strip vs. 320-480px expanded). Resize-Handle. Chat-Init-Message mit Bild-Kontext. Message-Bubbles (User/Bot). Chat-Input mit Send-Button. Neue-Session-Button. Context-Separator bei Bildwechsel.
- **Deliverables:**
  - `components/canvas/canvas-chat-panel.tsx` (Chat-Container mit Collapse/Resize)
  - `components/canvas/canvas-chat-messages.tsx` (Message-Bubbles, Init-Message, Separator, Chips)
  - `components/canvas/canvas-chat-input.tsx` (Input-Feld mit Send-Button)
- **Done-Signal:** Chat rendert mit Bild-Kontext. Collapse/Expand funktioniert. Resize zwischen 320-480px. User kann Text eingeben und absenden (ohne Backend-Anbindung, nur UI). Neue-Session-Button leert History.
- **Dependencies:** ["slice-05"]
- **Discovery-Quelle:** Slice 4 "Chat-Panel UI"

---

### Slice 10: Details Overlay
- **Scope:** Collapsible Details-Panel am oberen Rand des Canvas-Bereichs. Zeigt: Prompt (Volltext), Model, Steps, CFG, Seed, Size, ProvenanceRow (wiederverwendet). Toggle ueber toolbar.details-Button. Push-down-Layout (schiebt Canvas-Inhalt nach unten).
- **Deliverables:**
  - `components/canvas/details-overlay.tsx` (Collapsible Panel mit Metadata + ProvenanceRow)
- **Done-Signal:** Details-Icon in Toolbar toggled Overlay. Overlay zeigt korrekte Bild-Metadaten. ProvenanceRow zeigt Referenz-Thumbnails. Canvas-Inhalt wird nach unten geschoben.
- **Dependencies:** ["slice-07"]
- **Discovery-Quelle:** Slice 2 "Toolbar + Tool-Popovers" (Details-Overlay)

---

### Slice 11: Variation Popover
- **Scope:** Schwebendes Popover neben dem Variation-Icon. Prompt-Feld (vorausgefuellt aus Original), Strength-Dropdown (Subtle/Balanced/Creative), Count-Selector (1-4), Generate-Button. Nutzt Radix Popover.
- **Deliverables:**
  - `components/canvas/popovers/variation-popover.tsx` (Popover mit Prompt, Strength, Count, Generate)
- **Done-Signal:** Klick auf Variation-Icon oeffnet Popover. Prompt ist vorausgefuellt. Strength-Dropdown funktioniert. Count waehlbar 1-4. Klick ausserhalb schliesst. Generate-Button vorhanden (Action-Anbindung in Slice 14).
- **Dependencies:** ["slice-07"]
- **Discovery-Quelle:** Slice 2 "Toolbar + Tool-Popovers"

---

### Slice 12: img2img Popover
- **Scope:** Grosses schwebendes Popover neben img2img-Icon. Referenz-Bereich (ReferenceBar/ReferenceSlot/ImageDropzone wiederverwendet, max 5 Slots mit Rollen + Strengths). Prompt-Felder (Motiv + Style/Modifier). Variants-Counter. Generate-Button. Model kommt aus Header-Selector.
- **Deliverables:**
  - `components/canvas/popovers/img2img-popover.tsx` (Grosses Popover mit References, Prompt, Variants)
- **Done-Signal:** Popover oeffnet mit korrektem Layout. Referenz-Slots funktionieren (Upload, Drag, URL). Rollen/Strength-Dropdowns funktionieren. Prompt-Felder editierbar. Generate-Button vorhanden (Action-Anbindung in Slice 14).
- **Dependencies:** ["slice-07"]
- **Discovery-Quelle:** Slice 2 "Toolbar + Tool-Popovers"

---

### Slice 13: Upscale Popover
- **Scope:** Kleines schwebendes Popover neben Upscale-Icon mit [2x Upscale] und [4x Upscale] Buttons. Disabled-State mit Tooltip wenn Bild zu gross. Nutzt hardcoded Model `nightmareai/real-esrgan`.
- **Deliverables:**
  - `components/canvas/popovers/upscale-popover.tsx` (Popover mit 2x/4x Buttons)
- **Done-Signal:** Popover oeffnet mit zwei Buttons. Bei zu grossem Bild: Icon disabled + Tooltip. Buttons vorhanden (Action-Anbindung in Slice 14).
- **Dependencies:** ["slice-07"]
- **Discovery-Quelle:** Slice 2 "Toolbar + Tool-Popovers"

---

### Slice 14: In-Place Generation + Polling Integration
- **Scope:** Tool-Popovers (Variation, img2img, Upscale) triggern Server Actions (`generateImages()` / `upscaleImage()`). Loading-State auf Canvas-Image (semi-transparenter Overlay mit "Generating" + Spinner). Polling erkennt Completion. Neues Bild ersetzt aktuelles. Altes Bild wird auf Undo-Stack gepusht. Model-Selector im Header (initialisiert aus Bild-Model, aenderbar).
- **Deliverables:**
  - `components/canvas/canvas-detail-view.tsx` (Generation-Flow: Popover -> Server Action -> Polling -> Replace)
  - `components/canvas/canvas-image.tsx` (Loading-Overlay-State)
  - `components/canvas/canvas-model-selector.tsx` (Header Model-Selector mit Auto-Switch)
- **Done-Signal:** Generate via Variation-Popover erzeugt neues Bild in-place. Loading-Overlay waehrend Generation. Polling erkennt Completion. Neues Bild erscheint. Altes auf Undo-Stack. Alle Inputs disabled waehrend Generation.
- **Dependencies:** ["slice-11", "slice-12", "slice-13"]
- **Discovery-Quelle:** Slice 5 "In-Place Generation + Undo"

---

### Slice 15: Undo/Redo Stack (Keyboard + UI)
- **Scope:** Undo-Button (Cmd+Z) und Redo-Button (Cmd+Shift+Z) im Header. Keyboard-Shortcuts (unterdrueckt bei Fokus in Input/Textarea). Undo stellt vorheriges Bild wieder her, Redo geht vorwaerts. Neue Generation leert Redo-Stack.
- **Deliverables:**
  - `components/canvas/canvas-header.tsx` (Undo/Redo-Buttons mit Disabled-States)
  - `lib/canvas-detail-context.tsx` (Keyboard-Shortcut-Handler als useEffect)
- **Done-Signal:** Cmd+Z stellt vorheriges Bild wieder her. Cmd+Shift+Z geht vorwaerts. Buttons disabled wenn Stack leer. Shortcuts unterdrueckt in Input-Fokus. Neue Generation leert Redo-Stack.
- **Dependencies:** ["slice-14"]
- **Discovery-Quelle:** Slice 5 "In-Place Generation + Undo"

---

### Slice 16: Canvas Agent Backend
- **Scope:** Neuer LangGraph-Agent fuer Canvas-Editing im Backend. Separater Graph mit eigenem System-Prompt (Editing-Kontext, Bild-Analyse, Prompt-Optimierung). Tool `generate_image` das strukturierte Parameter via SSE `canvas-generate` Event zurueckgibt. Neuer CanvasAssistantService. Neue FastAPI-Routes `/api/assistant/canvas/sessions` und `/api/assistant/canvas/sessions/{id}/messages`.
- **Deliverables:**
  - `backend/app/agent/canvas_graph.py` (LangGraph Canvas-Agent mit generate_image Tool)
  - `backend/app/services/canvas_assistant_service.py` (SSE-Streaming, Rate-Limiting)
  - `backend/app/routes/canvas_sessions.py` (FastAPI-Routes fuer Session + Messages)
- **Done-Signal:** POST `/api/assistant/canvas/sessions` erstellt Session. POST `.../messages` streamt SSE-Events (text-delta, canvas-generate, error). Agent erkennt Editing-Intent und liefert strukturierte Generation-Parameter. pytest-Tests fuer Service und Routes.
- **Dependencies:** ["slice-15"]
- **Discovery-Quelle:** Slice 6 "Chat-Agent Integration"

---

### Slice 17: Canvas Chat Frontend Integration
- **Scope:** Chat-Panel sendet Nachrichten an Canvas-Agent-Backend. SSE-Streaming fuer Bot-Antworten. `canvas-generate` Event triggert `generateImages()` Server Action. Clarification-Flow mit Chips. Ergebnis erscheint im Canvas (kein Thumbnail im Chat).
- **Deliverables:**
  - `lib/canvas-chat-service.ts` (SSE-Client fuer Canvas-Agent: Session erstellen, Messages senden, Events parsen)
  - `components/canvas/canvas-chat-panel.tsx` (Backend-Anbindung: SSE-Streaming, canvas-generate Handler)
  - `components/canvas/canvas-chat-messages.tsx` (Streaming-Indicator, Error-Messages, Chip-Click-Handler)
- **Done-Signal:** Chat-Nachricht "mach den Hintergrund blauer" fuehrt zu Agent-Antwort (ggf. Clarification). Agent-Antwort mit canvas-generate Event triggert Generation im Canvas. Loading/Streaming-States korrekt. Error-Handling bei Timeout.
- **Dependencies:** ["slice-09", "slice-14", "slice-16"]
- **Discovery-Quelle:** Slice 6 "Chat-Agent Integration"

---

### Slice 18: Lightbox Removal + Cleanup
- **Scope:** Lightbox-Modal-Referenzen aus WorkspaceContent entfernen. LightboxModal-Import entfernen. Lightbox-State-Variablen (lightboxOpen, lightboxIndex) entfernen. Test-Dateien der Lightbox aktualisieren oder entfernen. `components/lightbox/lightbox-modal.tsx` als deprecated markieren oder entfernen.
- **Deliverables:**
  - `components/workspace/workspace-content.tsx` (Lightbox-Imports und State entfernen)
  - `components/lightbox/lightbox-modal.tsx` (Datei entfernen)
  - `components/lightbox/lightbox-navigation.tsx` (Datei entfernen, Logik in canvas-navigation.tsx portiert)
- **Done-Signal:** Keine Lightbox-Referenzen mehr in workspace-content.tsx. Build laeuft ohne Fehler. Alle bestehenden Tests passen oder sind aktualisiert.
- **Dependencies:** ["slice-08"]
- **Discovery-Quelle:** Architecture "Files to Remove"

---

## Qualitaets-Checkliste

- [x] Jeder Slice hat maximal 3 produktive Deliverable-Dateien
- [x] Jeder Slice hat ein messbares Done-Signal
- [x] Dependencies sind azyklisch (DAG)
- [x] Alle Deliverables aus der Discovery sind abgedeckt (Schema, Service, Actions, Context, Detail-View Shell, Animation, Toolbar, Popovers x3, Siblings, Navigation, Chat Panel, Details Overlay, In-Place Generation, Undo/Redo, Canvas Agent Backend, Chat Integration, Lightbox Cleanup)
- [x] Kein Slice hat mehr als ein Concern (DB / Service / Context / UI-Component / Backend)
- [x] Schema/Service-Slices (1-4) kommen vor UI-Slices (5+)
- [x] Stack ist korrekt erkannt und dokumentiert (TypeScript/Next.js + Python/FastAPI)
