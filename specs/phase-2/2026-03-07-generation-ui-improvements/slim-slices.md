# Slim Slice Decomposition

**Feature:** Generation UI Improvements (Phase 2)
**Discovery-Slices:** 5
**Atomare Slices:** 13
**Stack:** TypeScript / Next.js 16 (App Router) + React 19 + Drizzle ORM + Vitest

---

## Dependency Graph

```
slice-01 (Aspect Ratio Utils)
    │
    ├── slice-02 (AspectRatioChips + SizeChips UI)
    │       │
    │       └── slice-03 (PromptArea Layout-Integration)
    │
slice-04 (VariantStepper Component)
    │
    └── slice-03 (PromptArea Layout-Integration)

slice-05 (Bulk DB Queries + Server Actions)
    │
    ├── slice-06 (SelectionContext)
    │       │
    │       ├── slice-07 (GenerationCard Checkbox Overlay)
    │       │
    │       ├── slice-08 (GalleryHeader + GalleryGrid Selection Mode)
    │       │
    │       └── slice-09 (FloatingActionBar Component)
    │               │
    │               └── slice-10 (FloatingActionBar Bulk Actions Integration)
    │
slice-11 (ZIP Download API Route)
    │
    └── slice-10 (FloatingActionBar Bulk Actions Integration)

slice-12 (CompareModal Component)
    │
    └── slice-13 (Lightbox Extensions: Move + Compare)
```

---

## Slice-Liste

### Slice 1: Aspect Ratio Utils
- **Scope:** Pure-function-Bibliothek fuer Aspect-Ratio-Logik: Model-Schema parsen (enum vs. width/height), Pixel-Dimensionen berechnen (laengste Kante), Custom-Ratio validieren, Size-Presets definieren.
- **Deliverables:**
  - `lib/aspect-ratio.ts` (neu)
- **Done-Signal:** Vitest-Unit-Tests fuer `parseRatioConfig`, `calculateDimensions`, `validateCustomRatio` passen fuer alle 3 Schema-Muster (enum, width/height, none).
- **Dependencies:** []
- **Discovery-Quelle:** Slice 1 "Aspect Ratio + Size Chips"

---

### Slice 2: AspectRatioChips + SizeChips Components
- **Scope:** Zwei standalone Toggle-Chip-Group-Components: `AspectRatioChips` (mit eingebettetem `CustomRatioInput`) und `SizeChips`. Jede hat disabled-State mit Tooltip. Keine Integration in prompt-area.tsx — nur isoliertes Rendering.
- **Deliverables:**
  - `components/workspace/aspect-ratio-chips.tsx` (neu)
  - `components/workspace/size-chips.tsx` (neu)
- **Done-Signal:** Vitest-Component-Tests: Chips rendern, ausgewaehlter Chip hat active-State, disabled-Chip zeigt Tooltip, Custom-Chip zeigt/verbirgt Input, CustomRatioInput zeigt Validierungsfehler bei "0:5".
- **Dependencies:** ["slice-01-aspect-ratio-utils"]
- **Discovery-Quelle:** Slice 1 "Aspect Ratio + Size Chips"

---

### Slice 3: VariantStepper Component
- **Scope:** Eigenstaendiger Stepper `[-] N [+]` als wiederverwendbare React-Component. Wert 1-4, Minus-Button bei 1 disabled, Plus-Button bei 4 disabled. Kein Layout-Kontext.
- **Deliverables:**
  - `components/workspace/variant-stepper.tsx` (neu)
- **Done-Signal:** Vitest-Component-Test: Klick auf [+] erhoeht Wert, Klick auf [-] verringert Wert, Buttons an den Grenzen (1 / 4) sind disabled und reagieren nicht.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 2 "Prompt-Panel Layout"

---

### Slice 4: PromptArea Layout-Integration
- **Scope:** Umbau von `prompt-area.tsx` auf das neue 12-Zeilen-Layout: AspectRatioChips + SizeChips einbinden, ParameterPanel in Collapsible "Advanced Settings" verschieben, VariantStepper + Generate-Button in letzter Zeile (50/rest). Model-Wechsel loest Chip-Reset aus.
- **Deliverables:**
  - `components/workspace/prompt-area.tsx` (modifiziert)
- **Done-Signal:** Vitest-Component-Test: Layout rendert alle 12 Reihen, Advanced-Settings-Collapsible ist standardmaessig geschlossen, Klick oeffnet es, Model-Wechsel ruft Reset auf Chips auf.
- **Dependencies:** ["slice-01-aspect-ratio-utils", "slice-02-chips-components", "slice-03-variant-stepper"]
- **Discovery-Quelle:** Slice 1 "Aspect Ratio + Size Chips", Slice 2 "Prompt-Panel Layout"

---

### Slice 5: Bulk DB Queries + Server Actions
- **Scope:** Vier neue Batch-Query-Funktionen in `queries.ts` (moveGeneration, moveGenerations, deleteGenerations, toggleFavorites) und die entsprechenden Server Actions in `generations.ts` mit UUID-Validierung und revalidatePath.
- **Deliverables:**
  - `lib/db/queries.ts` (modifiziert — 4 neue Query-Funktionen)
  - `app/actions/generations.ts` (modifiziert — 4 neue Server Actions)
- **Done-Signal:** Vitest-Unit-Tests (mit gemockter DB): `moveGenerations` mit gueltigem targetProjectId gibt `{ success: true, count: N }`, `deleteGenerations` gibt gelloeschte IDs zurueck, `toggleFavorites` setzt `isFavorite` korrekt, invalid UUID gibt `{ error: string }`.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 3 "Move-to-Project", Slice 4 "Bulk Select + Actions"

---

### Slice 6: SelectionContext
- **Scope:** React-Context + Provider fuer den transienten Bulk-Select-State: `selectedIds` (Set<string>), `isSelecting`, `toggleSelection`, `selectAll`, `deselectAll`, `isSelected`. Kein UI, nur State-Logik.
- **Deliverables:**
  - `lib/selection-state.tsx` (neu)
- **Done-Signal:** Vitest-Unit-Test: `toggleSelection` fuegt hinzu und entfernt, nach `selectAll(["a","b"])` sind beide selektiert, `deselectAll` leert Set, `isSelecting` ist true wenn Set nicht leer.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 4 "Bulk Select + Actions"

---

### Slice 7: GenerationCard Checkbox Overlay
- **Scope:** `generation-card.tsx` erhaelt optionales Checkbox-Overlay (oben-links): erscheint bei Hover (desktop), zeigt blaue Umrandung wenn selektiert, im Selection-Mode ist Karten-Klick = Toggle (kein Lightbox-Oeffnen). Liest Zustand aus SelectionContext.
- **Deliverables:**
  - `components/workspace/generation-card.tsx` (modifiziert)
- **Done-Signal:** Vitest-Component-Test: Im Default-Mode oeffnet Klick die Lightbox (onSelect-Callback), im Selection-Mode (isSelecting=true) togglet Klick die Selektion statt Lightbox, Checkbox ist bei selektierten Karten sichtbar und gecheckt.
- **Dependencies:** ["slice-06-selection-context"]
- **Discovery-Quelle:** Slice 4 "Bulk Select + Actions"

---

### Slice 8: GalleryHeader + GalleryGrid Selection Mode
- **Scope:** Neue `GalleryHeader`-Component (Titel, Bild-Count, Favoriten-Filter-Toggle als Star-Icon). `gallery-grid.tsx` erhaelt Selection-Mode-Unterstuetzung (Checkboxen immer sichtbar im Selection-Mode, dynamisches Bottom-Padding wenn Action-Bar aktiv).
- **Deliverables:**
  - `components/workspace/gallery-header.tsx` (neu)
  - `components/workspace/gallery-grid.tsx` (modifiziert)
- **Done-Signal:** Vitest-Component-Test: GalleryHeader rendert Titel + Count, Star-Toggle wechselt zwischen active/inactive State und ruft onFavFilterToggle auf, GalleryGrid im Selection-Mode hat bottom-Padding und zeigt Checkboxen auf allen Karten.
- **Dependencies:** ["slice-06-selection-context", "slice-07-generation-card-checkbox"]
- **Discovery-Quelle:** Slice 4 "Bulk Select + Actions"

---

### Slice 9: FloatingActionBar Component
- **Scope:** Eigenstaendige `FloatingActionBar`-Component: zeigt "N ausgewaehlt / Select All / Abbrechen" links; Buttons [Move v] [Favorite] [Compare] [Download] [Delete] rechts. Compare-Button disabled mit Tooltip wenn nicht 2-4 selektiert. Kein echtes Ausfuehren der Aktionen — nur Props/Callbacks.
- **Deliverables:**
  - `components/workspace/floating-action-bar.tsx` (neu)
- **Done-Signal:** Vitest-Component-Test: Bar erscheint wenn selectedCount >= 1, Compare-Button ist disabled wenn selectedCount < 2 oder > 4 und zeigt Tooltip, "Abbrechen"-Klick ruft onCancel auf, Move-Dropdown listet uebergebene Projekte.
- **Dependencies:** ["slice-06-selection-context"]
- **Discovery-Quelle:** Slice 4 "Bulk Select + Actions"

---

### Slice 10: FloatingActionBar Bulk Actions Integration
- **Scope:** `workspace-content.tsx` wird mit SelectionProvider gewrappt, FloatingActionBar wird eingebunden und mit echten Bulk-Action-Callbacks verbunden (moveGenerations, deleteGenerations, toggleFavorites, ZIP-Download via fetch). ConfirmDialog fuer Delete + Move. Success-Toasts via sonner.
- **Deliverables:**
  - `components/workspace/workspace-content.tsx` (modifiziert)
- **Done-Signal:** Vitest-Integration-Test: Bulk-Delete-Klick oeffnet ConfirmDialog, nach Bestaetigung wird `deleteGenerations` Server-Action aufgerufen, Toast erscheint, Selektion wird aufgehoben. Bulk-Move zeigt Confirm mit Projektname.
- **Dependencies:** ["slice-05-bulk-db-actions", "slice-08-gallery-grid-selection", "slice-09-floating-action-bar", "slice-11-zip-download-route"]
- **Discovery-Quelle:** Slice 4 "Bulk Select + Actions"

---

### Slice 11: ZIP Download API Route
- **Scope:** Neue Next.js Route `GET /api/download-zip?ids=...`: IDs validieren (max 50), Generations aus DB laden, Bilder sequenziell von R2 fetchen, ZIP mit jszip erstellen und streamen. `jszip` als neue Dependency.
- **Deliverables:**
  - `app/api/download-zip/route.ts` (neu)
- **Done-Signal:** Vitest-Test mit gemockten R2-Responses und DB: Route gibt Content-Type `application/zip` zurueck, Dateinamen im ZIP entsprechen `{generation-id}.png`, bei mehr als 50 IDs gibt Route 400 zurueck.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 4 "Bulk Select + Actions"

---

### Slice 12: CompareModal Component
- **Scope:** Eigenstaendige `CompareModal`-Component als Fullscreen-Dialog: 2x2-Grid mit 2-4 Generations-Objekten, leere Slots als dashed-border-Platzhalter, Fullscreen-Toggle pro Bild (in-Modal Single-View), Model-Name + Dimensions unter jedem Bild, X-Close-Button.
- **Deliverables:**
  - `components/compare/compare-modal.tsx` (neu)
- **Done-Signal:** Vitest-Component-Test: Mit 4 Generations rendert das Grid 4 Bilder mit korrekten Dimensions-Labels, mit 2 Generations hat die untere Reihe 2 leere Slots (dashed-border), Fullscreen-Toggle-Klick zeigt Einzelbild, ESC schliesst Einzelbild-View.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 5 "Image Compare"

---

### Slice 13: Lightbox Extensions: Move + Compare
- **Scope:** `lightbox-modal.tsx` erhaelt drei neue Elemente: (1) `LightboxMoveDropdown` — Button + Projekt-Dropdown, nach Move Success-Toast + Close; (2) `lightbox-checkbox` — Checkbox oben-links auf aktuellem Bild fuer Compare-Selektion; (3) `LightboxCompareBar` — Floating Bar am unteren Rand mit Count + Compare-Button (aktiv bei 2-4) + Abbrechen. Compare-Button oeffnet CompareModal.
- **Deliverables:**
  - `components/lightbox/lightbox-modal.tsx` (modifiziert)
  - `components/lightbox/lightbox-compare-bar.tsx` (neu)
  - `components/lightbox/lightbox-move-dropdown.tsx` (neu)
- **Done-Signal:** Vitest-Component-Test: Move-Dropdown zeigt alle Projekte ausser aktuellem, `moveGeneration` Server-Action wird nach Projekt-Auswahl aufgerufen, Compare-Bar erscheint sobald 1 Bild gecheckt, Compare-Button oeffnet CompareModal bei 2+ Bilder.
- **Dependencies:** ["slice-05-bulk-db-actions", "slice-06-selection-context", "slice-12-compare-modal"]
- **Discovery-Quelle:** Slice 3 "Move-to-Project", Slice 5 "Image Compare"

---

## Qualitaets-Checkliste

- [x] Jeder Slice hat maximal 3 produktive Deliverable-Dateien
- [x] Jeder Slice hat ein messbares Done-Signal (Vitest-Tests oder konkretes Kriterium)
- [x] Dependencies sind azyklisch (DAG) — kein zyklischer Pfad vorhanden
- [x] Alle Deliverables aus der Discovery sind abgedeckt (11 neue + 7 modifizierte Dateien aus architecture.md)
- [x] Kein Slice hat mehr als ein Concern (Utility / Component / Integration / Route je getrennt)
- [x] Service/Util-Slices kommen vor UI-Slices (slice-01, slice-05, slice-06 zuerst)
- [x] Stack korrekt erkannt: TypeScript / Next.js App Router / Vitest

## Discovery-Abdeckungs-Matrix

| architecture.md Datei | Abgedeckt in Slice |
|-----------------------|--------------------|
| `lib/aspect-ratio.ts` (neu) | slice-01 |
| `components/workspace/aspect-ratio-chips.tsx` (neu) | slice-02 |
| `components/workspace/size-chips.tsx` (neu) | slice-02 |
| `components/workspace/variant-stepper.tsx` (neu) | slice-03 |
| `components/workspace/prompt-area.tsx` (mod) | slice-04 |
| `lib/db/queries.ts` (mod) | slice-05 |
| `app/actions/generations.ts` (mod) | slice-05 |
| `lib/selection-state.tsx` (neu) | slice-06 |
| `components/workspace/generation-card.tsx` (mod) | slice-07 |
| `components/workspace/gallery-header.tsx` (neu) | slice-08 |
| `components/workspace/gallery-grid.tsx` (mod) | slice-08 |
| `components/workspace/floating-action-bar.tsx` (neu) | slice-09 |
| `components/workspace/workspace-content.tsx` (mod) | slice-10 |
| `app/api/download-zip/route.ts` (neu) | slice-11 |
| `components/compare/compare-modal.tsx` (neu) | slice-12 |
| `components/lightbox/lightbox-modal.tsx` (mod) | slice-13 |
| `components/lightbox/lightbox-compare-bar.tsx` (neu) | slice-13 |
| `components/lightbox/lightbox-move-dropdown.tsx` (neu) | slice-13 |
