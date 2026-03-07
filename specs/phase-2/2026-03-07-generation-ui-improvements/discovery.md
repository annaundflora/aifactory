# Feature: Generation UI Improvements

**Epic:** Generation UI Improvements (Phase 2)
**Status:** Ready
**Wireframes:** `wireframes.md` (pending)

---

## Problem & Solution

**Problem:**
- Aspect Ratio und Bildgroesse sind nicht direkt steuerbar — nur indirekt ueber Model-Schema-Parameter
- Bilder koennen nicht zwischen Projekten verschoben werden
- Keine Bulk-Operationen (Multi-Select, Bulk-Delete, Bulk-Move)
- Kein Bildvergleich — nur Prompt-Vergleich existiert
- Prompt-Panel Layout ist nicht optimiert (Controls nicht effizient angeordnet)

**Solution:**
- Aspect Ratio Chips + Size Chips als primaere Steuerelemente
- Move-to-Project Funktion via DB-Update (`projectId`)
- Bulk-Select mit Floating Action Bar (Move, Delete, Compare, Favorite, Download)
- Side-by-Side Compare-View (max 4 Bilder) als Fullscreen-Modal
- Optimiertes Prompt-Panel Layout mit klarer Hierarchie

**Business Value:**
- Schnellere, praezisere Bildgenerierung durch direkte Ratio/Size-Kontrolle
- Effizientere Bildverwaltung durch Bulk-Operationen
- Bessere Qualitaetskontrolle durch Bildvergleich

---

## Scope & Boundaries

| In Scope |
|----------|
| Aspect Ratio Chips mit Standard + Social Presets + Custom-Eingabe |
| Size Chips (xs/s/m/l/xl) mit Multiplier-basierter Logik |
| Prompt-Panel Layout-Optimierung |
| Advanced Settings als Collapsible Section |
| Move-to-Project (Einzel + Bulk) |
| Bulk-Select mit Checkbox bei Hover |
| Bulk-Actions: Move, Delete, Compare, Favorite-Toggle, Download (ZIP) |
| Side-by-Side Compare-View (max 4 Bilder) |
| Favoriten-Filter Toggle in Gallery |

| Out of Scope |
|--------------|
| Drag & Drop zwischen Projekten |
| Slider/Overlay Bildvergleich |
| Mehr als 4 Bilder im Compare-View |
| Undo nach Bulk-Delete (nur Confirm-Dialog) |
| Sortierung/Filter der Gallery (ausser Favoriten-Toggle) |
| Bild-Editing (Crop, Resize nach Generation) |

---

## Current State Reference

> Existing functionality that will be reused (unchanged).

- Generation-Workflow: Prompt -> Replicate API -> R2 Storage -> DB (generation-service.ts)
- Model Registry: 9 Models mit dynamischem Schema-Loading via Replicate API (models.ts, model-schema-service.ts)
- ParameterPanel: Dynamische Controls aus Model-Schema (parameter-panel.tsx)
- Gallery-Grid: CSS Masonry mit 2-4 Spalten (gallery-grid.tsx)
- GenerationCard: Thumbnail mit Hover-Overlay (generation-card.tsx)
- Lightbox: Fullscreen-Toggle, Details, Navigation, Variation, Download, Delete (lightbox-modal.tsx)
- Einzel-Delete: Mit ConfirmDialog + R2 Cleanup (generations.ts)
- Favoriten: Star-Toggle per Generation, DB-Flag `isFavorite` (favorites-list.tsx)
- DB-Schema: `generations` Tabelle mit projectId FK, width, height, seed
- Workspace-State: Variation-Context (workspace-state.tsx)

---

## UI Patterns

### Reused Patterns

| Pattern Type | Component | Usage in this Feature |
|--------------|-----------|----------------------|
| Select/Dropdown | shadcn/ui `<Select>` | Model-Dropdown, Move-to-Project Dropdown |
| ConfirmDialog | `components/ui/confirm-dialog` | Bulk-Delete Bestaetigung |
| Modal/Dialog | shadcn/ui `<Dialog>` | Compare-View Fullscreen-Modal |
| Lightbox | `components/lightbox/lightbox-modal.tsx` | Erweiterung um "Vergleichen mit..." Button |
| Tooltip | shadcn/ui `<Tooltip>` | Social-Format-Namen, Disabled-Chips Erklaerung |

### New Patterns

| Pattern Type | Description | Rationale |
|--------------|-------------|-----------|
| Toggle Chip Group | Horizontal scrollbare Chip-Reihe, Single-Select, Disabled-State mit Tooltip | Fuer Aspect Ratio und Size — kompakter als Dropdowns, schnellerer Zugriff |
| Floating Action Bar | Sticky Bottom-Bar mit Actions, erscheint bei 1+ Selektion | Bulk-Actions — SOTA Pattern fuer Multi-Select (PatternFly, Google Photos) |
| Checkbox Overlay | Checkbox oben-links im Bild, erscheint bei Hover | Bulk-Select ohne permanenten visuellen Noise |
| Compare Grid Modal | Fullscreen-Modal mit 2x2 Grid, Fullscreen-Toggle pro Bild | Bildvergleich — kein bestehendes Pattern vorhanden |
| Stepper | +/- Buttons mit Zahl dazwischen | Variant Count (ersetzt aktuelle Button-Reihe 1-4) |

---

## User Flow

### Flow 1: Aspect Ratio + Size waehlen

1. User waehlt Model -> System laedt Model-Schema, filtert kompatible Aspect Ratios und Sizes
2. User klickt Aspect Ratio Chip (z.B. "16:9") -> Chip wird aktiv, inkompatible Size-Chips werden disabled
3. User klickt Size Chip (z.B. "m") -> Chip wird aktiv
4. System berechnet Pixel-Dimensions: laengste Kante = Size-Wert, kuerzere Kante = Size-Wert * (kleinere Ratio-Seite / groessere Ratio-Seite)
5. User klickt "Custom" Ratio-Chip -> Input-Feld erscheint (Format N:N), User gibt z.B. "21:9" ein
6. User klickt Generate -> System sendet berechnete width/height (oder aspect_ratio enum wenn Model das erwartet) an Replicate API

**Error Paths:**
- Model unterstuetzt gewaehltes Ratio nicht -> Chip disabled mit Tooltip "Nicht verfuegbar fuer {Model}"
- Custom Ratio ungueltig (z.B. "0:5", "abc") -> Validierungsfehler unter Input

### Flow 2: Bulk Select + Actions

1. Desktop: User hovert ueber Bild in Gallery -> Checkbox erscheint oben-links. Mobile/Touch: Long-press auf Bild aktiviert Selection-Mode
2. User klickt Checkbox -> Bild wird selektiert (blaue Umrandung), Floating Action Bar erscheint unten
3. Im Selection-Mode: Klick auf Bild-Karte = Toggle Selektion (NICHT Lightbox oeffnen). Lightbox nur im Default-Mode
4. User selektiert weitere Bilder via Checkbox-Klick
5. Floating Action Bar zeigt: Anzahl selektiert, Select All/Deselect All, Move-Dropdown, Delete-Button, Compare-Button (mit Tooltip wenn disabled), Favorite-Toggle, Download-Button
6. User waehlt Aktion (siehe Sub-Flows)
7. ESC oder Klick auf "Abbrechen" -> Selektion aufheben, Action Bar verschwindet

**Sub-Flow: Bulk Move**
1. User klickt Move-Dropdown in Action Bar -> Liste aller Projekte (ausser aktuelles)
2. User waehlt Ziel-Projekt -> Confirm: "{N} Bilder nach '{Projekt}' verschieben?"
3. Bestaetigung -> DB-Update: `projectId` der selektierten Generations aendern
4. Bilder verschwinden aus aktueller Gallery, Action Bar schliesst

**Sub-Flow: Bulk Delete**
1. User klickt Delete in Action Bar -> ConfirmDialog: "{N} Bilder unwiderruflich loeschen?"
2. Bestaetigung -> DB-Delete + R2-Delete fuer alle selektierten Generations
3. Bilder verschwinden aus Gallery, Action Bar schliesst

**Sub-Flow: Bulk Compare**
1. User hat 2-4 Bilder selektiert -> Compare-Button aktiv
2. User klickt Compare -> Compare-View Modal oeffnet (Fullscreen)
3. Bilder werden im 2x2 Grid angezeigt (bei 2-3 Bildern: leere Slots)
4. User klickt Fullscreen-Toggle auf einem Bild -> Bild wird Fullscreen
5. ESC oder Klick -> zurueck zum Compare-Grid
6. X-Button schliesst Compare-View

**Sub-Flow: Bulk Favorite**
1. User klickt Favorite-Toggle in Action Bar -> Alle selektierten Bilder werden zu Favoriten (oder alle entfavorisiert wenn alle bereits Favoriten)

**Sub-Flow: Bulk Download**
1. User klickt Download in Action Bar -> ZIP wird generiert mit allen selektierten Bildern
2. Download startet automatisch

### Flow 3: Compare aus Lightbox

1. User ist in Lightbox -> Checkbox wird angezeigt (aktuelles Bild kann selektiert werden)
2. User navigiert via Lightbox-Navigation (Prev/Next) und selektiert weitere Bilder via Checkbox (max 4)
3. Floating-Button zeigt Anzahl selektierter Bilder + "Compare" Button
4. User klickt "Compare" (min 2 selektiert) -> Compare-View oeffnet als Fullscreen-Modal
5. "Abbrechen" oder ESC -> Selektion aufheben, zurueck zur normalen Lightbox-Ansicht

### Flow 4: Move Einzelbild (aus Lightbox)

1. User ist in Lightbox -> Klickt "Verschieben" Button
2. Dropdown mit Projekten erscheint
3. User waehlt Ziel-Projekt -> Bild wird verschoben, Success-Toast "Bild verschoben nach '{Projekt}'" (sonner), Lightbox schliesst, Gallery aktualisiert sich

### Flow 5: Favoriten-Filter

1. User klickt Star-Icon Toggle im Gallery-Header -> Gallery zeigt nur Favoriten
2. Erneuter Klick -> Gallery zeigt alle Bilder

---

## UI Layout & Context

### Screen: Prompt-Panel (links)

**Position:** Linke Spalte des Workspace (bestehend)
**When:** Immer sichtbar im Workspace

**Layout (neu, optimiert):**
- Row 1: Model-Dropdown (100% Breite)
- Row 2: Template-Dropdown (100% Breite)
- Row 3: Prompt Motiv Textarea (100% Breite, 3 Zeilen, Auto-Resize)
- Row 4: Builder-Button + Improve-Button (50/50)
- Row 5: Style/Modifier Textarea (100% Breite, 2 Zeilen)
- Row 6: Negative Prompt Textarea (100% Breite, conditional)
- Row 7: Aspect Ratio Label + Chip-Reihe (horizontal scrollbar)
- Row 8: Size Label + Chip-Reihe
- Row 9: Collapsible "Advanced Settings" Section (default: zu)
- Row 10: Variant-Stepper ([-] 2 [+]) + Generate-Button (Rest-Breite)

### Screen: Gallery (rechts)

**Position:** Rechte Spalte des Workspace (bestehend)
**When:** Immer sichtbar im Workspace

**Layout (Aenderungen):**
- Header: Titel + Bild-Count + Favoriten-Filter-Toggle (Star-Icon)
- Grid: Bestehend, mit Checkbox-Overlay bei Hover (oben-links pro Bild)
- Footer (conditional): Floating Action Bar bei 1+ Selektion

### Screen: Floating Action Bar

**Position:** Sticky bottom ueber Gallery, zentriert
**When:** Mindestens 1 Bild selektiert

**Layout:**
- Links: "{N} ausgewaehlt" + "Abbrechen" Link
- Rechts: [Move v] [Favorite] [Compare] [Download] [Delete]

### Screen: Compare-View Modal

**Position:** Fullscreen-Overlay ueber gesamtem Viewport
**When:** Compare-Aktion ausgeloest (Bulk oder Lightbox)

**Layout:**
- Header: "Vergleich ({N})" + X-Close-Button
- Body: 2x2 Grid mit Bildern, jedes Bild hat:
  - Bild (max verfuegbarer Platz)
  - Fullscreen-Toggle Button (oben-rechts im Bild)
  - Dimensions-Anzeige (unten: z.B. "1024 x 576")
- Fullscreen-Sub-View: Einzelbild auf 100% Viewport, ESC/Click zurueck zum Grid

---

## UI Components & States

| Element | Type | Location | States | Behavior |
|---------|------|----------|--------|----------|
| `aspect-ratio-chips` | Toggle Chip Group | Prompt-Panel Row 7 | `default` (keiner aktiv), `selected` (einer aktiv), `chip-disabled` (ausgegraut + Tooltip) | Klick waehlt Ratio, filtert inkompatible Sizes. Chips: 1:1, 4:3, 3:2, 16:9, 9:16, 4:5, 2:3, Custom |
| `custom-ratio-input` | Text Input | Inline nach Custom-Chip | `hidden`, `visible`, `error` | Erscheint wenn Custom-Chip aktiv. Format: N:N. Validierung bei Eingabe |
| `size-chips` | Toggle Chip Group | Prompt-Panel Row 8 | `default`, `selected`, `chip-disabled` | Klick waehlt Size. Chips: xs (512), s (768), m (1024), l (1536), xl (2048) |
| `advanced-settings` | Collapsible Section | Prompt-Panel Row 9 | `collapsed` (default), `expanded` | Klick auf Header toggled. Inhalt: Model-spezifische Parameter aus Schema |
| `variant-stepper` | Stepper | Prompt-Panel Row 10 links | `min` (1, minus disabled), `normal`, `max` (4, plus disabled) | +/- Buttons, Zahl 1-4 in der Mitte |
| `gallery-checkbox` | Checkbox Overlay | GenerationCard oben-links | `hidden` (default), `visible` (hover/touch), `checked` (selektiert) | Desktop: Erscheint bei Hover. Mobile/Touch: Long-press aktiviert Selection-Mode. Im Selection-Mode: Karten-Klick = Toggle Selektion (nicht Lightbox). Selektierte Bilder erhalten blaue Umrandung (border) als visuellen Indikator |
| `floating-action-bar` | Sticky Bar | Gallery unten | `hidden` (0 selektiert), `visible` (1+ selektiert) | Zeigt Aktionen fuer selektierte Bilder |
| `move-dropdown` | Select | Floating Action Bar | `closed`, `open` | Listet alle Projekte ausser aktuelles |
| `compare-modal` | Fullscreen Modal | Viewport Overlay | `closed`, `grid-view` (2x2), `fullscreen-single` (1 Bild) | 2x2 Grid, Fullscreen-Toggle pro Bild. Leere Slots (bei 2-3 Bildern) werden mit dashed border placeholder dargestellt |
| `fav-filter-toggle` | Toggle Button | Gallery Header | `inactive` (alle Bilder), `active` (nur Favoriten) | Star-Icon, togglet Gallery-Filter |
| `lightbox-checkbox` | Checkbox Overlay | Lightbox Bild | `unchecked`, `checked` | Checkbox auf aktuellem Lightbox-Bild fuer Compare-Selektion |
| `lightbox-compare-bar` | Floating Bar | Lightbox unten | `hidden` (0 selektiert), `visible` (1+ selektiert) | Zeigt Anzahl + Compare-Button (aktiv bei 2-4) + Abbrechen |
| `lightbox-move-btn` | Button + Dropdown | Lightbox Actions | `default`, `open` (Dropdown sichtbar) | Verschieben-Aktion fuer Einzelbild |

---

## Feature State Machine

### States Overview

| State | UI | Available Actions |
|-------|----|--------------------|
| `gallery-default` | Gallery-Grid, keine Selektion | Hover -> Checkbox, Click -> Lightbox, Fav-Filter Toggle |
| `gallery-selecting` | Gallery-Grid mit Checkboxen + Floating Action Bar | Select/Deselect Bilder, Move, Delete, Compare (2-4), Favorite, Download, Abbrechen |
| `compare-grid` | Compare-Modal mit 2x2 Grid | Fullscreen pro Bild, Close |
| `compare-fullscreen` | Ein Bild Fullscreen im Compare-Modal | ESC/Click -> zurueck zu Grid |
| `lightbox-compare-select` | Lightbox mit Checkbox + Floating Compare Bar | Navigate, Toggle Checkbox (max 4), Compare (2+), Abbrechen |

### Transitions

| Current State | Trigger | UI Feedback | Next State | Business Rules |
|---------------|---------|-------------|------------|----------------|
| `gallery-default` | Checkbox-Klick auf Bild | Bild selektiert (Umrandung), Action Bar erscheint | `gallery-selecting` | -- |
| `gallery-default` | Fav-Filter Toggle | Gallery filtert auf Favoriten / alle | `gallery-default` | -- |
| `gallery-selecting` | Weitere Checkbox-Klicks | Selektion togglet, Count in Action Bar aktualisiert | `gallery-selecting` | -- |
| `gallery-selecting` | Letzte Checkbox deselektiert oder "Abbrechen" | Action Bar verschwindet | `gallery-default` | -- |
| `gallery-selecting` | Compare-Button (2-4 selektiert) | Compare-Modal oeffnet | `compare-grid` | Min 2, Max 4 Bilder |
| `gallery-selecting` | Delete-Button | ConfirmDialog -> Bilder geloescht | `gallery-default` | Confirm required |
| `gallery-selecting` | Move-Dropdown -> Projekt | Confirm -> Bilder verschoben | `gallery-default` | Confirm required |
| `gallery-selecting` | Favorite-Toggle | Alle selektierten Bilder favorisiert/entfavorisiert | `gallery-selecting` | Wenn alle Favs -> entfavorisieren, sonst alle favorisieren |
| `gallery-selecting` | Download-Button | ZIP wird generiert und heruntergeladen | `gallery-selecting` | -- |
| `compare-grid` | Fullscreen-Toggle auf Bild | Bild wird Fullscreen | `compare-fullscreen` | -- |
| `compare-grid` | X-Close | Modal schliesst | `gallery-default` | Selektion wird aufgehoben |
| `compare-fullscreen` | ESC oder Click | Zurueck zum Grid | `compare-grid` | -- |
| Lightbox | Checkbox-Klick auf Bild | Bild selektiert, Floating Compare Bar erscheint | `lightbox-compare-select` | -- |
| `lightbox-compare-select` | Navigieren + Checkbox togglen | Selektion togglet, Count aktualisiert | `lightbox-compare-select` | Max 4 Bilder |
| `lightbox-compare-select` | "Compare" Button (2+ selektiert) | Compare-Modal oeffnet | `compare-grid` | Min 2 Bilder |
| `lightbox-compare-select` | "Abbrechen" oder ESC | Selektion aufgehoben, Bar verschwindet | Lightbox (normal) | -- |

---

## Business Rules

- Aspect Ratio Chips: Nur Ratios anzeigen, die das aktuelle Model unterstuetzt (aus Schema). Nicht-unterstuetzte = disabled + Tooltip
- Size Chips: Nur Sizes anzeigen, die das Model unterstuetzt (basierend auf min/max width/height aus Schema). Nicht-unterstuetzte = disabled + Tooltip
- Size-Berechnung: Laengste Kante = Size-Wert. Kuerzere Kante = Size-Wert * (kleinere Ratio-Seite / groessere Ratio-Seite). Ergebnis auf naechste gerade Zahl runden
- Custom Ratio: Format N:N, beide Werte muessen positive Integers sein, max 10:1 Verhaeltnis
- Aspect Ratio Mapping: Wenn Model `aspect_ratio` als enum hat -> direkt den Enum-Wert senden. Wenn Model `width`/`height` hat -> berechnete Pixel-Werte senden
- Model-Wechsel Reset: Wenn aktuell gewaehltes Ratio/Size nach Model-Wechsel inkompatibel wird -> automatisch erste kompatible Option waehlen + Chip kurz hervorheben (Pulse-Animation)
- Compare: Min 2, Max 4 Bilder. Compare-Button in Action Bar nur aktiv bei 2-4 Selektion. Disabled-Tooltip: "2-4 Bilder auswaehlen zum Vergleichen"
- Lightbox Compare Max Enforcement: Wenn 4 Bilder selektiert, werden Checkboxen auf nicht-selektierten Bildern disabled mit Tooltip "Max 4 Bilder"
- Select All: "Alle auswaehlen" / "Auswahl aufheben" Toggle in der Floating Action Bar (links neben Count)
- Selection-Mode Verhalten: Im Selection-Mode oeffnet Klick auf Bild-Karte NICHT die Lightbox, sondern togglet die Selektion. Lightbox nur im Default-Mode
- Mobile/Touch Bulk-Select: Long-press auf Bild aktiviert Selection-Mode (kein Hover verfuegbar)
- Floating Action Bar Padding: Gallery erhaelt dynamisches Bottom-Padding in Hoehe der Action Bar wenn im Selection-Mode
- Bulk-Move: Ziel-Projekt darf nicht das aktuelle Projekt sein
- Bulk-Move Confirm: Bestaetigung erforderlich via ConfirmDialog: "{N} Bilder nach '{Projekt}' verschieben?" mit Cancel/Move Buttons
- Bulk-Delete: Loescht DB-Records UND R2-Objekte. Bestaetigung erforderlich
- Bulk-Download: ZIP-Generierung serverseitig, Dateinamen = Generation-ID + .png
- Compare-View Metadata: Jedes Bild im Compare-View zeigt immer Model-Name + Dimensions (nicht optional)
- Compare Empty Slots: Bei 2 Bildern ist die untere Reihe leer (dashed border placeholder), bei 3 Bildern ist der untere rechte Slot leer (dashed border placeholder)
- Move Success Feedback: Nach Move (Einzel oder Bulk) Success-Toast via sonner: "Bild verschoben nach '{Projekt}'" bzw "{N} Bilder verschoben nach '{Projekt}'". Gallery aktualisiert sich
- Favoriten-Filter: Filtert Gallery-Grid clientseitig (oder serverseitig wenn Pagination)
- Floating Action Bar: Verschwindet wenn 0 Bilder selektiert

---

## Data

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `aspect_ratio` (UI-State) | No | Format N:N, positive Integers, max 10:1 | Wird in width/height oder enum konvertiert |
| `size` (UI-State) | No | Enum: xs, s, m, l, xl | Mapping: xs=512, s=768, m=1024, l=1536, xl=2048 |
| `width` (Generation Input) | No | Positive Integer, Model-spezifisch | Berechnet aus Ratio + Size |
| `height` (Generation Input) | No | Positive Integer, Model-spezifisch | Berechnet aus Ratio + Size |
| `projectId` (Move Target) | Yes | Existierendes Projekt, nicht aktuelles | FK auf projects.id |

---

## Trigger-Inventory

| Trigger | Source | Action |
|---------|--------|--------|
| Model-Wechsel | Model-Dropdown | Schema neu laden, Aspect Ratio + Size Chips filtern |
| Aspect Ratio Klick | Chip-Klick | Ratio setzen, Size-Kompatibilitaet pruefen |
| Size Klick | Chip-Klick | Size setzen |
| Generate | Generate-Button oder Cmd+Enter | Width/Height berechnen, Generation starten |
| Checkbox Klick | Gallery Bild-Hover | Bild zur Selektion hinzufuegen/entfernen |
| Bulk Move | Action Bar Move-Dropdown | projectId Update fuer alle selektierten |
| Bulk Delete | Action Bar Delete-Button | Delete Generations + R2 Objects |
| Bulk Compare | Action Bar Compare-Button | Compare-Modal oeffnen |
| Bulk Favorite | Action Bar Favorite-Toggle | isFavorite Toggle fuer alle selektierten |
| Bulk Download | Action Bar Download-Button | ZIP generieren + Download |
| Fav-Filter Toggle | Gallery Header Star-Icon | Gallery filtern |
| Lightbox Compare | Lightbox "Vergleichen" Button | Compare-Collect-Modus starten |
| Lightbox Move | Lightbox "Verschieben" Button | Einzelbild verschieben |

---

## Implementation Slices

### Dependencies

```
Slice 1 (Aspect Ratio + Size) ──┐
Slice 2 (Layout)                ├── unabhaengig
Slice 3 (Move)                  │
Slice 4 (Bulk) ─────────────────┘
       │
Slice 5 (Compare) ── abhaengig von Slice 4 (nutzt Bulk-Selektion)
```

### Slices

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| 1 | Aspect Ratio + Size Chips | Ratio-Chips (Standard + Social + Custom), Size-Chips (xs-xl), Model-Kompatibilitaets-Filterung, Size-Berechnung (laengste Kante), Mapping auf Model-Input (enum oder width/height) | Unit: Size-Berechnung, Ratio-Validierung. UI: Chips rendern, Disabled-State, Custom-Input. Integration: Generate mit Ratio+Size sendet korrekte params | -- |
| 2 | Prompt-Panel Layout | Layout-Optimierung: 100%/50-50 Rows, Variant-Stepper, Generate-Button Restbreite, Advanced Settings Collapsible | UI: Layout korrekt, Stepper +/- funktioniert, Collapsible toggled, Responsive | -- |
| 3 | Move-to-Project | Einzelbild-Move aus Lightbox (Dropdown + DB-Update), Neue Server Action `moveGeneration(id, targetProjectId)` | Unit: Server Action. UI: Dropdown in Lightbox, Bild verschwindet nach Move | -- |
| 4 | Bulk Select + Actions | Checkbox bei Hover, Selektion-State, Floating Action Bar, Bulk-Move, Bulk-Delete (Confirm), Bulk-Favorite, Bulk-Download (ZIP), Favoriten-Filter Toggle | UI: Checkbox erscheint bei Hover, Action Bar bei Selektion. Integration: Bulk-Delete loescht korrekt, Bulk-Move aktualisiert projectId | Slice 3 (Move-Logic) |
| 5 | Image Compare | Compare-Modal (Fullscreen, 2x2 Grid), Fullscreen-Toggle pro Bild, Entry via Bulk-Selektion, Entry via Lightbox ("Vergleichen" + "Hinzufuegen") | UI: Modal oeffnet mit selektierten Bildern, Fullscreen-Toggle funktioniert, ESC schliesst | Slice 4 (Bulk-Selektion) |

### Recommended Order

1. **Slice 1:** Aspect Ratio + Size Chips -- Kernfunktionalitaet, verbessert sofort die Generation-UX
2. **Slice 2:** Prompt-Panel Layout -- Rein visuell, keine Backend-Aenderungen, unabhaengig
3. **Slice 3:** Move-to-Project -- Einfache Server-Action + Lightbox-Erweiterung, Grundlage fuer Bulk-Move
4. **Slice 4:** Bulk Select + Actions -- Groesster Slice, baut auf Move-Logic auf
5. **Slice 5:** Image Compare -- Baut auf Bulk-Selektion auf, eigenstaendiger Modal

---

## Context & Research

### Similar Patterns in Codebase

| Feature | Location | Relevant because |
|---------|----------|------------------|
| ParameterPanel (Dynamic Controls) | `components/workspace/parameter-panel.tsx` | Zeigt wie Model-Schema-Parameter gerendert werden. Aspect Ratio + Size ersetzen/ergaenzen diese |
| LLM Comparison Modal | `components/prompt-improve/llm-comparison.tsx` | Side-by-Side Pattern fuer Prompts. Compare-View fuer Bilder folgt aehnlichem Modal-Pattern |
| Builder Chip Selection | `components/prompt-builder/category-tabs.tsx` | Chip/Toggle-Selection Pattern existiert bereits fuer Fragments |
| Lightbox Actions | `components/lightbox/lightbox-modal.tsx` | Bestehende Actions (Delete, Download, Variation). Move + Compare werden hier ergaenzt |
| ConfirmDialog | Lightbox Delete | Wiederverwendbar fuer Bulk-Delete Bestaetigung |
| Favorites Toggle | `components/workspace/favorites-list.tsx` | isFavorite DB-Flag existiert bereits, Bulk-Toggle erweitert dies |

### Web Research

| Source | Finding |
|--------|---------|
| [Midjourney Docs](https://docs.midjourney.com/docs/aspect-ratios) | Midjourney v6 unterstuetzt bis 3:1, Default 1:1, v7 = 2048x2048 |
| [DALL-E 3](https://bulkimagegeneration.com/tools/aspect-ratio-calculator) | Nur 3 Presets: 1:1, 16:9, 9:16. Max 1792x1024 |
| [Artificial Analysis](https://artificialanalysis.ai/image/explore) | Side-by-Side Model-Vergleich als SOTA Pattern |
| [PatternFly Bulk Selection](https://www.patternfly.org/patterns/bulk-selection/) | Split-Button Pattern, Checkbox in Toolbar, Partial/All/None States |
| [Eleken Bulk Actions UX](https://www.eleken.co/blog-posts/bulk-actions-ux) | 8 Design Guidelines: Floating Bar, Undo-Toast, Keyboard-Navigation |
| [img-comparison-slider](https://github.com/sneas/img-comparison-slider) | Web Component fuer Slider-Overlay (Out of Scope, aber Referenz) |
| [TonySpegel/image-comparison](https://github.com/TonySpegel/image-comparison) | 3 Modi: Slider, Overlay, Side-by-Side |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| -- | Keine offenen Fragen | -- | -- | -- |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-07 | Codebase | 9 Models via Replicate API, Schema dynamisch geladen, aspect_ratio als enum oder width/height |
| 2026-03-07 | Codebase | ParameterPanel rendert ALLE Schema-Params — kein eigener Aspect Ratio / Size UI-Layer |
| 2026-03-07 | Codebase | Kein Bulk-Select, kein Multi-Select State in Gallery-Komponenten |
| 2026-03-07 | Codebase | projectId ist NOT NULL FK — Move = einfacher UPDATE, kein Schema-Change noetig |
| 2026-03-07 | Codebase | Nur Prompt-Comparison (LLM Comparison), kein Image-Compare |
| 2026-03-07 | Web | SOTA Aspect Ratios: 1:1, 4:3, 3:2, 16:9, 9:16, 4:5, 2:3 |
| 2026-03-07 | Web | SOTA Bulk: Checkbox bei Hover, Floating Action Bar, Undo-Toast |
| 2026-03-07 | Web | SOTA Compare: Side-by-Side Grid, Slider Overlay, Zoom/Pan |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| 1 | Meinst du mit "vergleichen" eine Bildvergleichs-Funktion? | Ja, SOTA UX dafuer recherchieren |
| 2 | Welche Aspect Ratios sollen als Presets verfuegbar sein? | Alle Standard + Social + Custom-Eingabe, aber nur N:N Darstellung mit Tooltip fuer Social-Format-Namen |
| 3 | Layout der Prompt-Spalte? | 100% fuer einzelne Controls (Model, Template), 50/50 fuer Paare (Builder/Improve), Variants als Stepper, Generate-Button fuellt Restplatz |
| 4 | Size-Chips: Welche Pixel-Groessen? | Multiplier-basiert: xs=512, s=768, m=1024, l=1536, xl=2048 (laengste Kante) |
| 5 | Bildvergleich: Wie soll er funktionieren? | Side-by-Side Grid (2-4 Bilder) mit Fullscreen-Toggle pro Bild, schnell Vollbild pro Bild triggern und wieder zurueck |
| 6 | Size bestimmt laengste Kante — einverstanden? | Ja, laengste Kante. Qualitaet konstant unabhaengig von Orientation |
| 7 | Wo wird der Compare-View geoeffnet? | Beides: aus Bulk-Selektion UND aus Lightbox heraus |
| 8 | Wie sollen Advanced Settings dargestellt werden? | Collapsible Section, default zugeklappt |
| 9 | Wie soll Bulk-Select aktiviert werden? | Checkbox bei Hover (erscheint oben-links im Bild) |
| 10 | Move-to-Project: Wie soll das Ziel-Projekt gewaehlt werden? | Dropdown/Select mit allen Projekten in der Floating Action Bar |
| 11 | Scope: Ein Epic oder aufteilen? | Ein Epic, 5 Slices |
| 12 | Inkompatible Ratios/Sizes bei Model-Wechsel? | Disabled + Tooltip "Nicht verfuegbar fuer dieses Model" |
| 13 | Floating Action Bar: Welche Aktionen? | Move, Delete, Compare, Favorite-Toggle, Download (ZIP) |
| 14 | Favoriten in Gallery? | Als zusaetzlicher Filter-Toggle im Gallery-Header (Star-Icon) |
| 15 | Compare: Max wie viele Bilder? | Max 4 Bilder (2x2 Grid) |
| 16 | Prompt-Panel Layout-Reihenfolge? | Option A: Model -> Template -> Prompts -> Ratio -> Size -> Advanced -> Variants+Generate |
| 17 | Bulk-Delete Sicherheit? | Nur Confirm-Dialog ("X Bilder loeschen?"), kein Undo |
| 18 | Compare-View: Wo angezeigt? | Eigener Fullscreen-Modal mit 2x2 Grid, Fullscreen-Toggle pro Bild |
| 19 | Custom Ratio: Wie eingeben? | Einzelnes Input-Feld im Format N:N (z.B. "21:9") |
| 20 | Favoriten-Filter in Gallery? | Toggle-Button im Gallery-Header (Star-Icon, togglet Alle/Nur Favoriten) |
| 21 | Compare-View: Zusaetzliche Infos pro Bild? | Nur Bild + Dimensions, maximaler Platz fuers Bild |
