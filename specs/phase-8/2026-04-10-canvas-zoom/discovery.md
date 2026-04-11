# Feature: Canvas Zoom & Pan

**Epic:** --
**Issue:** #26
**Status:** Ready
**Wireframes:** -- (UI Layout beschrieben)

---

## Problem & Solution

**Problem:**
- Bilder in der Canvas-Ansicht koennen nicht vergroessert werden -- Detailarbeit (z.B. Masking kleiner Bereiche) ist ungenau
- Auf Touch-Geraeten (iPad, Tablet) fehlt die natuerliche Pinch-to-Zoom-Interaktion -- das Bild ist statisch

**Solution:**
- Zoom-Controls (Buttons + Prozentanzeige + Fit) als Floating-Panel unten rechts
- Touch-Gesten: Pinch-to-Zoom + Zwei-Finger-Pan
- Desktop: Ctrl/Cmd+Scroll zum Zoomen, Space+Drag zum Pannen, Wheel zum Scrollen

**Business Value:**
- Hoehere Masking-Praezision bei Inpaint/Erase durch Zoom
- Native Touch-Erfahrung auf Tablets (iPad Pro etc.)

---

## Scope & Boundaries

| In Scope |
|----------|
| Zoom-Controls: +/- Buttons, Prozent-Anzeige, Fit-Button (unten rechts, floating) |
| Touch: Pinch-to-Zoom, Zwei-Finger-Pan |
| Desktop: Ctrl/Cmd+Scroll=Zoom, Space+Drag=Pan, Scroll=V-Scroll, Shift+Scroll=H-Scroll |
| Keyboard: +/-=Zoom, 0=Fit (nur wenn Canvas-Bereich aktiv) |
| Double-Tap: Toggle Fit <-> 100% |
| Zoom in allen Modi (idle, inpaint, erase, outpaint) |
| Procreate-Style Stroke-Undo bei Gestenstart waehrend Masking |
| Zoom-Reset bei Image-Wechsel |
| Zoom-Ankerpunkt: Cursor-/Finger-Position |
| Mask-Canvas synchron mitskalieren/mitverschieben |

| Out of Scope |
|--------------|
| Rotation |
| Minimap / Uebersichtsfenster |
| Zoom-Level Persistenz ueber Image-Wechsel hinaus |
| Zoom-Animations-Easing (Performance-Optimierung) |
| Mobile-spezifische Toolbar-Anpassung |

---

## Current State Reference

> Existing functionality that will be reused (unchanged):

- Canvas-Ansicht mit Bild (img, object-contain) und Mask-Canvas-Overlay
- Edit-Modi: inpaint, erase, instruction, outpaint (Toggle-Logik)
- Canvas State Management via Context/Reducer (CanvasDetailContext)
- Floating Toolbar Pattern (FloatingBrushToolbar als Referenz)
- Toolbar-Button-Komponente (wiederverwendbar fuer Zoom-Controls)
- Pointer Events + setPointerCapture im Mask-Canvas
- touch-action: none auf Mask-Canvas
- Horizontal-Swipe-Navigation (prev/next Image)
- ResizeObserver fuer Mask-Canvas-Positioning
- Undo/Redo Stack fuer Image-History

---

## UI Patterns

### Reused Patterns

| Pattern Type | Component | Usage in this Feature |
|--------------|-----------|----------------------|
| Floating Controls | FloatingBrushToolbar | Zoom-Controls folgen gleichem Pattern (floating, z-index, shadow) |
| Icon Button | ToolbarButton | Fuer +/-/Fit Buttons |
| Lucide Icons | ZoomIn, ZoomOut etc. | Bereits in Imports vorhanden |

### New Patterns

| Pattern Type | Description | Rationale |
|--------------|-------------|-----------|
| Zoom Controls Panel | Vertikales Float-Panel unten rechts: [Fit] [+] 125% [-] | Kein existierendes Zoom-Panel in der Codebase |
| Gesture Layer | Touch-Gesten-Handling (Pinch/Pan) auf Canvas-Container | Aktuell keine Multi-Touch-Gesten-Erkennung |

---

## User Flow

### Flow 1: Button-Zoom
1. User klickt [+] -> Bild zoomt zur naechsten Stufe (50->75->100->150->200->300), Prozent-Anzeige aktualisiert
2. User klickt [-] -> Bild zoomt zur vorherigen Stufe
3. User klickt [Fit] -> Bild wird auf Container-Passend zurueckgesetzt

### Flow 2: Desktop Ctrl+Scroll Zoom
1. User haelt Ctrl/Cmd, scrollt Mausrad ueber Canvas-Bereich -> Bild zoomt stufenlos zur Cursor-Position
2. Bei Zoom > Fit-Groesse: Bild ragt ueber Viewport -> Scroll-Verhalten aktiviert

### Flow 3: Desktop Scroll/Pan (gezoomtes Bild)
1. User scrollt Mausrad -> Bild scrollt vertikal
2. User haelt Shift + scrollt -> Bild scrollt horizontal
3. User haelt Space + Maus-Drag -> Bild wird frei in alle Richtungen verschoben (Pan)

### Flow 4: Touch Pinch-Zoom
1. User setzt zwei Finger auf Canvas -> Pinch-Geste erkannt
2. Finger auseinanderziehen -> Zoom In zum Mittelpunkt der Finger
3. Finger zusammenfuehren -> Zoom Out

### Flow 5: Touch Pan
1. Wenn gezoomt + kein Mask-Modus (editMode null/instruction/outpaint): Ein-Finger-Drag -> Bild verschiebt sich (Pan)
2. In jedem Modus: Zwei-Finger-Drag -> Bild verschiebt sich in Bewegungsrichtung

### Flow 6: Double-Tap
1. User doppelt-tippt auf Canvas -> Toggle zwischen Fit-Ansicht und 100%
2. Deaktiviert wenn editMode = inpaint oder erase (verhindert versehentliche Mask-Punkte + Zoom gleichzeitig)

### Flow 7: Pinch waehrend Mask-Stroke (Procreate-Style)
1. User malt mit einem Finger eine Maske
2. User setzt zweiten Finger auf -> System erkennt Geste
3. Aktueller Stroke wird automatisch rueckgaengig gemacht (undo)
4. Gesten-Modus aktiv (Pinch/Pan)
5. Beide Finger hoch -> Zurueck zu Mask-Modus

### Flow 8: Image-Wechsel
1. User navigiert zu prev/next Image -> Zoom resettet auf Fit, Pan auf (0,0)

**Error Paths:**
- Zoom bei Min (50%) + [-] klick -> Button disabled, kein Effekt
- Zoom bei Max (300%) + [+] klick -> Button disabled, kein Effekt
- Ctrl+Scroll ausserhalb Canvas-Bereich -> Normales Browser-Zoom (kein Eingriff)

---

## UI Layout & Context

### Screen: Canvas Detail View -- Zoom Controls
**Position:** Unten rechts im Canvas-Bereich (main area), floating
**When:** Immer sichtbar (dauerhaft eingeblendet)

**Layout:**
- Vertikaler Block, abgerundet, mit Border und Shadow (wie FloatingBrushToolbar)
- Reihenfolge von oben nach unten: [Fit-Icon] [+] [125%] [-]
- Z-Index ueber Bild, unter Floating Brush Toolbar
- Canvas-Container benoetigt overflow-hidden um gezoomtes Bild zu clippen
- Nicht ueberlappend mit OutpaintControls oder DetailsOverlay

---

## UI Components & States

| Element | Type | Location | States | Behavior |
|---------|------|----------|--------|----------|
| Zoom-In Button | Icon Button | Zoom Controls, 2. Position | `default`, `hover`, `disabled` (bei Max 300%) | Klick -> naechste Zoom-Stufe |
| Zoom-Out Button | Icon Button | Zoom Controls, 4. Position | `default`, `hover`, `disabled` (bei Min 50%) | Klick -> vorherige Zoom-Stufe |
| Fit Button | Icon Button | Zoom Controls, 1. Position | `default`, `hover`, `active` (wenn Fit aktiv) | Klick -> Zoom auf Container-Passend |
| Zoom-Prozent | Text | Zoom Controls, 3. Position | Zeigt aktuellen Zoom: "50%"..."300%" (stufenlos bei Gesten) | Nur Anzeige, nicht klickbar |

---

## Feature State Machine

### States Overview

| State | UI | Available Actions |
|-------|----|-------------------|
| `fit` | Bild passt in Container, Prozent zeigt berechneten Fit-Wert | Zoom-In, Ctrl+Scroll, Pinch, Double-Tap, + Taste |
| `zoomed-in` | Bild groesser als Container, Scroll/Pan moeglich | Zoom-In, Zoom-Out, Fit, Scroll, Pan, Pinch, Double-Tap, +/-/0 Tasten |
| `zoomed-out` | Bild kleiner als Container | Zoom-In, Fit, Ctrl+Scroll, Pinch, Double-Tap, +/0 Tasten |
| `panning` | Cursor: grab (Space gehalten), grabbing (waehrend Drag), Bild wird verschoben | Maus-Drag verschiebt Bild, Space loslassen -> zurueck zu `zoomed-in` |
| `gesture-active` | Touch-Geste laeuft (Pinch oder 2F-Pan) | Zoom/Pan per Geste, Finger hoch -> zurueck zu vorherigem State |

### Transitions

| Current State | Trigger | UI Feedback | Next State | Business Rules |
|---------------|---------|-------------|------------|----------------|
| `fit` | [+] klick / Ctrl+Scroll up / Pinch out / + Taste | Bild skaliert, Anzeige aktualisiert | `zoomed-in` | Zoom-Ankerpunkt: Cursor/Finger-Position |
| `fit` | Ctrl+Scroll down / Pinch in / - Taste | Bild skaliert kleiner | `zoomed-out` | Min 50% |
| `fit` | Double-Tap | Zoom auf 100% | `zoomed-in` (oder `fit` wenn Fit=100%) | -- |
| `zoomed-in` | [-] klick / Ctrl+Scroll down / Pinch in / - Taste | Bild skaliert | `zoomed-in`, `fit`, oder `zoomed-out` | Je nach Ergebnis-Level |
| `zoomed-in` | [Fit] klick / 0 Taste / Double-Tap | Bild zurueck auf Container-Passend | `fit` | Pan reset auf (0,0) |
| `zoomed-in` | Space gedrueckt | Cursor -> Grab-Hand | `panning` | Nur Desktop. Space hat Vorrang ueber Mask-Painting |
| `zoomed-in` | 1-Finger-Drag (Touch, kein Mask-Modus) | Bild verschiebt sich | `zoomed-in` | Nur wenn editMode null/instruction/outpaint |
| `zoomed-in` | Scroll | Bild scrollt vertikal | `zoomed-in` | -- |
| `zoomed-in` | Shift+Scroll | Bild scrollt horizontal | `zoomed-in` | -- |
| `zoomed-in` | Image-Wechsel (prev/next) | Bild wechselt, Zoom resettet | `fit` | Pan reset auf (0,0) |
| `zoomed-out` | [+] / Ctrl+Scroll up / Pinch out / + Taste | Bild skaliert groesser | `zoomed-out`, `fit`, oder `zoomed-in` | -- |
| `zoomed-out` | [Fit] / 0 / Double-Tap | Zurueck auf Fit | `fit` | -- |
| `panning` | Space losgelassen | Cursor -> Default | `zoomed-in` | -- |
| `panning` | Maus-Drag | Bild verschiebt sich | `panning` | -- |
| `gesture-active` | Alle Finger hoch | -- | Vorheriger State | -- |
| ANY (masking) | 2. Finger kommt waehrend Stroke | Stroke wird undo'd, Gesten-Modus | `gesture-active` | Procreate-Style |

---

## Business Rules

- Zoom-Range: 50% bis 300%
- Zoom-Stufen (Buttons/Tasten): 50, 75, 100, 150, 200, 300%
- Ctrl/Cmd+Scroll: Stufenloser Zoom (nicht auf feste Stufen beschraenkt)
- Pinch: Stufenloser Zoom
- Zoom-Ankerpunkt: Position des Cursors (Desktop) oder Mittelpunkt der Finger (Touch). Bei Button-Klick (+/-/Fit) und Keyboard (+/-): Mitte des sichtbaren Ausschnitts
- Zoom-Reset bei Image-Wechsel: Zurueck auf Fit, Pan auf (0,0)
- Zoom bei Container-Resize (z.B. Chat-Panel auf/zu): Zoom-Level beibehalten, Pan-Offset anpassen
- Keyboard-Shortcuts nur aktiv wenn Maus/Fokus ueber Canvas-Bereich (nicht Chat-Panel)
- Swipe-Navigation (prev/next): Nur bei Zoom = Fit (nicht bei gezoomtem Bild)
- Mask-Canvas muss synchron mit Bild transformieren (Zoom + Pan)
- Bei Zoom + Masking: Pointer-Koordinaten muessen Zoom/Pan-Offset zurueckrechnen
- Brush-Cursor (Kreis) skaliert visuell mit dem Zoom-Level -- erscheint gleich gross auf dem Bild unabhaengig vom Zoom
- Zoom-Keyboard-Shortcuts (+/-/0) bleiben in allen Edit-Modi aktiv, auch waehrend Masking. Kein Konflikt mit Brush-Shortcuts ([/]/E) da verschiedene Tasten
- Space-Taste hat Vorrang ueber Mask-Painting: Wenn Space gehalten, werden Pointer Events auf Mask-Canvas unterdrueckt (temporaeres Hand-Tool, wie Photoshop)
- Double-Tap-Zoom ist deaktiviert wenn editMode = inpaint oder erase (verhindert versehentliche Mask-Punkte + Zoom gleichzeitig)
- Touch Ein-Finger-Pan: Bei Zoom > Fit und editMode null/instruction/outpaint -> 1-Finger-Drag pannt das Bild. Bei editMode inpaint/erase -> 1-Finger-Drag malt Mask-Stroke
- Image-Wechsel ist bereits blockiert wenn maskData existiert (bestehende Navigation-Lock). Kein spezielles Mask-Handling fuer Zoom-Reset noetig

---

## Data

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `zoomLevel` | Yes | 0.5 <= x <= 3.0 (float) | 1.0 = 100%, Initial = Fit-Berechnung |
| `panX` | Yes | Number (px) | Horizontal Offset, Initial = 0 |
| `panY` | Yes | Number (px) | Vertikal Offset, Initial = 0 |

---

## Implementation Slices

### Dependencies

```
Slice 1 -> Slice 2
```

### Slices

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| 1 | Desktop Zoom & Pan | Zoom-State, +/-/Fit Buttons, Prozent-Anzeige, Ctrl+Scroll, Keyboard (+/-/0), Space+Drag Pan, Scroll/Shift+Scroll, Mask-Canvas Sync, Zoom-Reset bei Image-Wechsel, Container-Resize-Handling | Button-Klicks testen Zoom-Stufen, Ctrl+Scroll testen, Pan testen, Mask-Overlay-Position verifizieren | -- |
| 2 | Touch Gesten | Pinch-to-Zoom, Zwei-Finger-Pan, Double-Tap Toggle, Procreate-Style Stroke-Undo, Swipe-Nav nur bei Fit, touch-action:none auf Canvas-Container | Pinch/Pan auf Touch-Geraet, Stroke+Pinch Interaktion, Double-Tap zwischen Fit/100% | Slice 1 |

### Recommended Order

1. **Slice 1:** Desktop Zoom & Pan -- Basis-Infrastruktur (State, Transforms, Controls), testbar ohne Touch-Geraet
2. **Slice 2:** Touch Gesten -- Baut auf Zoom-State auf, braucht Touch-Geraet zum Testen

---

## Context & Research

### Similar Patterns in Codebase

| Feature | Location | Relevant because |
|---------|----------|------------------|
| FloatingBrushToolbar | Canvas-Bereich | Floating-Controls-Pattern (Position, Z-Index, Styling) |
| Mask-Canvas Pointer Events | Canvas-Bereich | touch-action:none, Pointer Capture -- koexistiert mit Zoom-Gesten |
| Swipe Navigation | Canvas-Detail-View | Touch-Handler die mit Zoom-Gesten kooperieren muessen |
| CanvasDetailContext | Canvas State | Zoom-State wird hier hinzugefuegt |

### Web Research

| Source | Finding |
|--------|---------|
| Procreate Touch UX | Stroke-Undo bei Gestenstart ist Standard in professionellen Zeichen-Apps |
| Figma/Miro Zoom UX | Ctrl+Scroll=Zoom + Space+Drag=Pan ist etabliertes Pattern fuer Design-Tools |

---

## Open Questions

_Keine offenen Fragen. Alle Punkte in Q&A geklaert._

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-04-07 | Codebase | Canvas nutzt img mit object-contain, MaskCanvas als absolutes Overlay, sync per getBoundingClientRect + ResizeObserver |
| 2026-04-07 | Codebase | Mask-Canvas hat touch-action:none + Pointer Events + setPointerCapture (kuerzlich gefixt in e606069) |
| 2026-04-07 | Codebase | Edit-Modi: null, inpaint, erase, instruction, outpaint -- Toggle-Logik in Toolbar |
| 2026-04-07 | Codebase | Swipe-Navigation ist deaktiviert wenn maskData !== null |
| 2026-04-07 | Codebase | ZoomIn Icon bereits in Lucide-Imports vorhanden |
| 2026-04-07 | Codebase | FloatingBrushToolbar zeigt Floating-Controls-Pattern (absolute, z-30, shadow-md) |
| 2026-04-07 | Codebase | CanvasDetailState enthaelt noch keinen Zoom/Pan-State |
| 2026-04-07 | Spec | Phase 8 Discovery hatte "Mobile-optimierte Brush-Interaktion" explizit als Out-of-Scope |
| 2026-04-07 | Spec | Zoom war nie in Phase 8 geplant -- vollstaendig neues Feature |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| 1 | Gibt es ein GitHub Issue dazu? | Nein, kein Issue |
| 2 | Recherche zuerst oder direkt Q&A? | Recherche zuerst -- Codebase, Git-History, Best Practices |
| 3 | Wann soll Zoom verfuegbar sein? (Nur View-Modus / Immer / Immer ausser bei aktivem Stroke) | Volle Gestenunterstuetzung in jedem Modus. Konflikte sollen evaluiert werden |
| 4 | Soll das gezoomte Bild verschiebbar sein (Pan)? | Zwei-Finger ist Standard fuer Touch-Pan. Desktop-Maus-Drag via Werkzeug oder Scroll/Shift-Scroll |
| 5 | Wie soll Zoom sich bei Image-Wechsel verhalten? | Reset bei jedem Image-Wechsel |
| 6 | Was passiert wenn waehrend eines Mal-Strokes der zweite Finger kommt? | Procreate-Style: Stroke wird undo'd, dann Gesten-Modus |
| 7 | Desktop Zoom/Pan Mapping? | Korrektur: Ctrl/Cmd+Scroll = Zoom. Mousewheel alleine = Scroll (wenn Bild > Viewport). Shift+Wheel = Horizontal-Scroll |
| 8 | Touch Pan: Nur Zwei-Finger oder zusaetzlich Hand-Tool? | Nur Zwei-Finger-Drag |
| 9 | Soll Swipe-Navigation erhalten bleiben? | Ja, aber nur bei Zoom = Fit |
| 10 | Wo sollen die Zoom-Buttons sitzen? | Unten rechts im Canvas-Bereich, floating |
| 11 | Soll Double-Tap funktionieren? | Ja, Toggle Fit <-> 100% |
| 12 | Welche Keyboard-Shortcuts? | Ctrl/Cmd+Scroll = Zoom. +/- und 0 nur bei Canvas-Fokus |
| 13 | Zoom-Range? | 50% bis 300% |
| 14 | Zoom-Ankerpunkt? | Zur Cursor/Finger-Position |
| 15 | Zoom-Stufen fuer Buttons? | Feste Stufen: 50, 75, 100, 150, 200, 300% |
| 16 | Slice-Aufteilung? | 2 Slices: Desktop + Touch |
| 17 | Fit-Button neben +/-? | Ja, Fit + +/- + Prozent-Anzeige |
| 18 | Zoom bei Canvas-Resize? | Zoom-Level beibehalten, Pan anpassen |
| 19 | Controls immer sichtbar oder nur bei Hover? | Immer sichtbar |
