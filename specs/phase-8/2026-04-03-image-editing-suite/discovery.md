# Feature: AI Image Editing Suite

**Epic:** --
**Issue:** --
**Status:** Ready
**Wireframes:** `wireframes.md` (optional)

---

## Problem & Solution

**Problem:**
- User kann generierte Bilder nicht punktuell bearbeiten (Objekte entfernen, ersetzen, hinzufuegen)
- Fuer jede Aenderung muss ein komplett neues Bild generiert werden (txt2img/img2img)
- Kein Weg, gezielte Bereiche eines Bildes zu modifizieren ohne den Rest zu veraendern

**Solution:**
- 5 Edit-Modi im bestehenden Canvas Detail-View: Mask-Inpainting, Object Removal (Erase), Instruction Editing, Click-to-Edit (SAM), Outpainting
- Canvas-Chat als zentraler Prompt-Hub fuer alle Modi (ausser Erase)
- Canvas Agent (Backend) waehlt automatisch das richtige Modell basierend auf Kontext (Maske vorhanden? Prompt vorhanden? Outpaint-Kontext?)

**Business Value:**
- Iteratives Arbeiten: Bilder verfeinern statt neu generieren (weniger API-Kosten, schnellere Ergebnisse)
- Professionellerer Workflow: naeher an Photoshop Generative Fill / Figma AI Edit
- Neue Use Cases: Object Removal, Background Extension, Detail-Korrekturen

---

## Scope & Boundaries

| In Scope |
|----------|
| Mask-Inpainting: Brush-basierte Masken-Erstellung + Prompt -> AI fuellt maskierten Bereich |
| Object Removal (Erase): Maske malen -> ohne Prompt entfernen |
| Instruction Editing: Text-Instruktion ueber Canvas-Chat -> AI erkennt und aendert Bereich (kein Maske noetig) |
| Click-to-Edit: Objekt klicken -> SAM 2 Auto-Mask -> Prompt fuer Replacement |
| Outpainting: Bildrand erweitern in gewaehlte Richtung(en) + optionaler Prompt |
| Neue Model Slots pro Modus (inpaint, erase, outpaint) mit Smart Defaults |
| Canvas Agent erweitern: Edit-Intent-Erkennung, Modell-Routing, Mask-Verarbeitung |
| Mask Canvas Layer (HTML5 Canvas ueber dem Bild) |
| Floating Brush Toolbar (Size, Brush/Eraser Toggle, Clear) |
| Automatisches Mask-Edge-Feathering (10px Gaussian Blur) |

| Out of Scope |
|--------------|
| Mask-Persistierung in DB (Masken sind Session-only) |
| Lasso/Polygon Selection Tools |
| Multi-Layer Masken |
| Batch-Editing (gleicher Edit auf mehrere Bilder) |
| Echtzeit-Preview des Inpainting-Ergebnisses |
| Pressure Sensitivity fuer Tablets |
| Dedizierter Editor-Screen (alles im bestehenden Canvas) |
| Mobile-optimierte Brush-Interaktion |

---

## Current State Reference

> Bestehende Funktionalitaet die wiederverwendet wird (unveraendert):

- **Canvas Detail-View** (`components/canvas/canvas-detail-view.tsx`): 3-Spalten-Layout (Toolbar | Bild | Chat)
- **Canvas Toolbar** (`components/canvas/canvas-toolbar.tsx`): Toolbar-Button-System mit Toggle-Logik und Popover-Pattern
- **Canvas Image** (`components/canvas/canvas-image.tsx`): Bild-Anzeige mit Loading-Overlay
- **Undo/Redo Stack** (`lib/canvas-detail-context.tsx`): PUSH_UNDO, SET_CURRENT_IMAGE Dispatches
- **Canvas Chat Panel** (`components/canvas/canvas-chat-panel.tsx`): Chat-Integration mit Generation-Polling
- **Canvas Agent** (`backend/app/agent/canvas_graph.py`): LangGraph Agent mit `generate_image` Tool
- **Capability Detection** (`lib/services/capability-detection.ts`): Erkennt Inpaint-faehige Modelle (`image` + `mask` Schema-Felder)
- **Generation Mode Enum**: `generationMode` Column in `generations` Tabelle (bereits `inpaint`, `outpaint` als Werte unterstuetzt)
- **Model Slots System** (`model_slots` Tabelle): Mode-basierte Slot-Zuordnung mit 3 Slots pro Modus
- **Replicate Client** (`lib/clients/replicate.ts`): API-Wrapper mit Rate Limiting
- **R2 Storage** (`lib/clients/storage.ts`): Bild-Upload Pipeline
- **Generation Service** (`lib/services/generation-service.ts`): `processGeneration()` Pipeline
- **Generation Polling**: Bestehendes Polling-Pattern fuer async Generation-Ergebnisse

---

## UI Patterns

### Reused Patterns

| Pattern Type | Component | Usage in this Feature |
|--------------|-----------|----------------------|
| Toolbar Button | `components/canvas/toolbar-button.tsx` | Neue Edit-Buttons (Brush, Erase, Click, Outpaint) |
| Toggle Tool | Canvas Toolbar dispatch `SET_ACTIVE_TOOL` | Mode-Wechsel zwischen Edit-Modi |
| Generation Polling | `canvas-detail-view.tsx` Polling-Pattern | Warten auf Inpaint/Erase/Outpaint Ergebnis |
| In-Place Replace | `PUSH_UNDO` + `SET_CURRENT_IMAGE` | Ergebnis ersetzt aktuelles Bild, altes in Undo Stack |
| Toast Notifications | sonner | Error/Success Feedback |

### New Patterns

| Pattern Type | Description | Rationale |
|--------------|-------------|-----------|
| Canvas Overlay Layer | HTML5 Canvas `<canvas>` Element ueber dem Bild fuer Mask-Painting | Kein bestehendes Pattern fuer Freihand-Zeichnen auf Bildern |
| Floating Toolbar | Schwebende Leiste oben am Canvas-Bereich mit Brush-Controls | Brush-Controls muessen nah am Bild sein, bestehende Toolbar ist vertikal links |
| Floating Action Button | "Entfernen"-Button in Floating Toolbar fuer Erase-Modus | Erase braucht direkten Action-Trigger ohne Chat-Umweg |
| Direction Controls | Buttons/Handles an 4 Bildkanten fuer Outpainting | Neues Interaktions-Pattern fuer Richtungswahl |
| SAM Click Handler | Click auf Bild -> API Call -> Auto-Mask Visualisierung | Neues Interaktions-Pattern fuer AI-gestuetzte Selektion |

---

## User Flows

### Flow 1: Mask-Inpainting (Object Replacement)

1. User ist im Canvas Detail-View, sieht ein generiertes Bild
2. User klickt "Brush Edit" in der Toolbar -> Floating Brush Toolbar erscheint, Cursor wird zum Kreis
3. User malt Maske ueber den zu ersetzenden Bereich (semi-transparentes Rot)
4. User kann Brush-Groesse anpassen (Slider), Eraser nutzen, Clear All klicken
5. User tippt Prompt im Canvas-Chat: "ersetze mit einem roten Kleid"
6. System: Canvas Agent erkennt Maske + Prompt -> waehlt Inpaint-Modell (Default: FLUX Fill Pro)
7. System: Maske wird zu Grayscale PNG konvertiert (weiss = edit, schwarz = behalten), 10px Feathering
8. System: Bild + Maske + Prompt -> Replicate API
9. System: Loading-Overlay auf Bild, Maske bleibt sichtbar
10. System: Ergebnis ersetzt aktuelles Bild, altes in Undo Stack, Maske bleibt
11. User kann iterieren: Maske anpassen oder neuen Prompt im Chat eingeben

**Error Paths:**
- API-Fehler -> Error-Toast, Maske + Bild bleiben, User kann erneut versuchen
- Leere Maske + Prompt -> Canvas Agent nutzt Instruction Editing statt Inpaint
- Maske zu klein (< 10px) -> Warnung: "Markiere einen groesseren Bereich"

### Flow 2: Object Removal (Erase)

1. User klickt "Erase" in der Toolbar -> Floating Brush Toolbar erscheint (gleiche Controls wie Brush Edit)
2. User malt Maske ueber das zu entfernende Objekt
3. User klickt "Entfernen"-Button in der Floating Toolbar
4. System: Maske -> Grayscale PNG + Feathering -> Bria Eraser API (kein Prompt)
5. System: Loading-Overlay, Ergebnis ersetzt Bild, Undo Stack, Maske bleibt

**Error Paths:**
- Leere Maske + "Entfernen" -> Warnung: "Markiere zuerst einen Bereich"

### Flow 3: Instruction Editing (Text-only)

1. User ist im Canvas, kein Edit-Tool aktiv
2. User tippt im Canvas-Chat: "Mach den Himmel blauer" / "Aendere die Haarfarbe zu blond"
3. Canvas Agent klassifiziert Prompt via LLM: Edit-Intent erkannt (keine Maske vorhanden) -> waehlt FLUX Kontext Pro
4. System: Bild + Text-Instruktion -> Replicate API
5. System: Loading-Overlay, Ergebnis ersetzt Bild, Undo Stack

**Error Paths:**
- Modell kann Intent nicht umsetzen -> Ergebnis zeigt wenig/keine Aenderung, User kann reformulieren
- Canvas Agent klassifiziert Prompt als Generate-Intent -> bestehender txt2img Flow (neues Bild statt Edit)

### Flow 4: Click-to-Edit (SAM Auto-Mask)

1. User klickt "Click Edit" in der Toolbar -> Cursor wird zum Fadenkreuz
2. User klickt auf ein Objekt im Bild
3. System: Klick-Koordinaten -> SAM 2 API -> Auto-generierte Maske wird als rotes Overlay angezeigt
4. System: Floating Brush Toolbar erscheint (User kann Maske manuell anpassen)
5. User tippt Prompt im Chat: "ersetze mit einer Katze" (oder leer fuer Removal)
6. Weiter wie Flow 1 (mit Prompt) oder Flow 2 (ohne Prompt/mit "Entfernen"-Button)

**Error Paths:**
- SAM kann kein Objekt erkennen -> Warnung: "Kein Objekt erkannt. Versuche einen anderen Punkt."
- SAM API-Fehler -> Error-Toast, Fallback: manuelles Masken-Malen vorschlagen

### Flow 5: Outpainting (Bild erweitern)

1. User klickt "Expand" in der Toolbar -> Richtungs-Controls erscheinen an den 4 Bildkanten
2. User klickt eine oder mehrere Richtungen (oben, unten, links, rechts)
3. User waehlt Erweiterungsgroesse: 25%, 50%, 100% der aktuellen Bildgroesse
4. Optional: User tippt Prompt im Chat ("erweitere mit Strand und Meer")
5. System: Originalbild + erweiterter Canvas -> Erweiterter Bereich als Maske -> FLUX Fill Pro
6. System: Loading-Overlay, erweitertes Bild ersetzt aktuelles, Undo Stack

**Error Paths:**
- Erweiterung wuerde API-Limit ueberschreiten (Bildgroesse) -> Warnung mit Max-Wert
- API-Fehler -> Error-Toast, Original bleibt

---

## UI Layout & Context

### Screen: Canvas Detail-View (erweitert)

**Position:** Bestehender Canvas Detail-View (`/projects/[id]` -> Bild oeffnen)
**When:** User oeffnet ein generiertes Bild aus der Gallery

**Layout (3 Spalten, bestehend):**
- **Links: Toolbar** - Bestehende Buttons + 4 neue Edit-Buttons (Brush Edit, Erase, Click Edit, Expand)
- **Mitte: Canvas-Bereich** - Bild + neuer Mask-Overlay-Layer + Floating Brush Toolbar + Outpaint Direction Controls
- **Rechts: Chat Panel** - Bestehender Canvas-Chat (wird zum Prompt-Hub fuer Edit-Modi)

### Neue UI-Elemente im Canvas-Bereich

**Floating Brush Toolbar:**
- Position: Oben mittig ueber dem Bild, horizontal
- Erscheint wenn: Brush Edit, Erase, oder Click Edit aktiv
- Elemente: Brush-Groesse Slider | Brush/Eraser Toggle | Clear All Button | (nur Erase-Modus:) "Entfernen" Action-Button
- Verschwindet wenn: User anderes Tool waehlt

**Mask Canvas Overlay:**
- Position: Exakt ueber dem Bild, gleiche Dimensionen
- Visuell: Semi-transparentes Rot (50% Opacity) auf maskierten Bereichen
- Interaktion: Maus/Touch-Events fuer Brush-Painting
- Cursor: Kreis in Brush-Groesse (Brush/Erase), Fadenkreuz (Click Edit)

**Outpaint Direction Controls:**
- Position: An den 4 Kanten des Bildes (oben, unten, links, rechts)
- Erscheint wenn: Expand-Tool aktiv
- Elemente pro Richtung: Richtungs-Button + Groessen-Auswahl (25% | 50% | 100%)

---

## UI Components & States

| Element | Type | Location | States | Behavior |
|---------|------|----------|--------|----------|
| `brush-edit-btn` | Toolbar Button | Toolbar links | `inactive`, `active` | Toggle: aktiviert Mask-Painting-Modus |
| `erase-btn` | Toolbar Button | Toolbar links | `inactive`, `active` | Toggle: aktiviert Erase-Modus |
| `click-edit-btn` | Toolbar Button | Toolbar links | `inactive`, `active` | Toggle: aktiviert Click-to-Edit-Modus |
| `expand-btn` | Toolbar Button | Toolbar links | `inactive`, `active` | Toggle: aktiviert Outpaint-Modus |
| `mask-canvas` | Canvas Layer | Ueber dem Bild | `hidden`, `visible`, `has-mask` | Zeichenflaeche fuer Masken |
| `brush-size-slider` | Slider | Floating Toolbar | `1px` - `100px` | Aendert Brush-Durchmesser, Cursor-Preview passt sich an |
| `brush-eraser-toggle` | Toggle Button | Floating Toolbar | `brush`, `eraser` | Wechsel zwischen Hinzufuegen/Entfernen von Maske |
| `clear-mask-btn` | Button | Floating Toolbar | `enabled`, `disabled` (wenn keine Maske) | Loescht gesamte Maske |
| `erase-action-btn` | Button | Floating Toolbar | `enabled`, `disabled` (wenn keine Maske) | Nur im Erase-Modus: Loest Object Removal aus |
| `outpaint-direction` | Button Group | An Bildkanten | `unselected`, `selected` (pro Richtung) | Waehlt Erweiterungsrichtung(en) |
| `outpaint-size` | Button Group | Bei Direction Controls | `25%`, `50%`, `100%` | Waehlt Erweiterungsgroesse |

---

## Feature State Machine

### States Overview

| State | UI | Available Actions |
|-------|----|--------------------|
| `idle` | Normaler Canvas, kein Edit-Tool aktiv | Toolbar-Buttons klicken, Chat nutzen, Prev/Next Navigation |
| `painting` | Mask-Overlay sichtbar, Floating Toolbar, Cursor als Kreis | Malen, Radieren, Clear, Brush-Groesse aendern, Chat-Prompt senden, Erase-Action (nur Erase-Modus) |
| `click-waiting` | Cursor als Fadenkreuz, kein Overlay | Auf Bild klicken |
| `sam-processing` | Loading-Indicator auf Bild | Warten auf SAM-Ergebnis |
| `sam-confirm` | Confirmation Dialog ueber dem Bild | Bestaetigen oder Abbrechen (nur wenn Maske bereits existiert) |
| `outpaint-config` | Direction Controls an Bildkanten | Richtung(en) waehlen, Groesse waehlen, Chat-Prompt senden |
| `generating` | Loading-Overlay auf Bild, Tools disabled | Warten auf API-Ergebnis |
| `result` | Neues Bild angezeigt, Maske bleibt (wenn vorher Mask-Modus) | Undo, weitere Edits, Navigation (blockiert wenn Maske existiert) |

### Transitions

| Current State | Trigger | UI Feedback | Next State | Business Rules |
|---------------|---------|-------------|------------|----------------|
| `idle` | Klick auf brush-edit-btn | Floating Toolbar erscheint, Cursor wird Kreis | `painting` | -- |
| `idle` | Klick auf erase-btn | Floating Toolbar erscheint (mit Entfernen-Button), Cursor wird Kreis | `painting` | -- |
| `idle` | Klick auf click-edit-btn | Cursor wird Fadenkreuz | `click-waiting` | -- |
| `idle` | Klick auf expand-btn | Direction Controls erscheinen an Bildkanten | `outpaint-config` | -- |
| `idle` | Chat-Prompt | Loading-Overlay | `generating` | Canvas Agent klassifiziert Intent via LLM (Edit vs. Generate). Edit -> Instruction Editing. Generate -> txt2img |
| `painting` | Chat-Prompt senden | Loading-Overlay, Maske bleibt | `generating` | Maske + Prompt -> Inpaint-Modell |
| `painting` | Erase-Action-Button klicken | Loading-Overlay, Maske bleibt | `generating` | Maske ohne Prompt -> Erase-Modell |
| `painting` | Klick auf expand-btn | Direction Controls erscheinen, Mask-Canvas hidden | `outpaint-config` | Maske bleibt im State, wird ausgeblendet |
| `painting` | Klick auf click-edit-btn | Cursor wird Fadenkreuz, Mask-Canvas hidden | `click-waiting` | Maske bleibt im State, wird ausgeblendet |
| `painting` | Klick auf aktiven Edit-Button (gleicher Button) | Floating Toolbar verschwindet, Mask-Canvas hidden, Cursor normal | `idle` | Maske bleibt im State (Toggle-Off, nutzt bestehendes SET_ACTIVE_TOOL Pattern) |
| `painting` | Klick auf Toggle-Tool (Details, Variation, img2img, Upscale) | Edit-Mode deaktiviert, Floating Toolbar hidden, Mask-Canvas hidden, Toggle-Tool Popover oeffnet | `idle` | Maske bleibt im State. Mutual Exclusion: nur ein activeToolId gleichzeitig |
| `painting` | Klick auf anderes Tool (Download, Delete, etc.) | Tool-Aktion ausfuehren | `painting` | Maske bleibt bei Tool-Wechsel |
| `painting` | Klick auf Clear | Maske wird geloescht | `painting` | -- |
| `click-waiting` | Klick auf click-edit-btn (gleicher Button) | Cursor normal | `idle` | Toggle-Off |
| `click-waiting` | Klick auf Toggle-Tool (Details, Variation, etc.) | Toggle-Tool Popover oeffnet | `idle` | Mutual Exclusion |
| `click-waiting` | Klick auf brush-edit-btn / erase-btn | Floating Toolbar erscheint, Mask-Canvas visible | `painting` | Vorherige Maske wiederhergestellt (falls vorhanden) |
| `click-waiting` | Klick auf expand-btn | Direction Controls erscheinen | `outpaint-config` | -- |
| `click-waiting` | Klick auf Bild (keine Maske vorhanden) | Loading-Indicator | `sam-processing` | Klick-Koordinaten an SAM 2 API |
| `click-waiting` | Klick auf Bild (Maske vorhanden) | Confirmation Dialog: "Maske ersetzen?" | `sam-confirm` | Verhindert versehentlichen Mask-Verlust |
| `sam-confirm` | User bestaetigt "Ersetzen" | Loading-Indicator | `sam-processing` | Bestehende Maske wird verworfen, SAM-Mask ersetzt |
| `sam-confirm` | User klickt "Abbrechen" | Dialog schliesst | `click-waiting` | Maske bleibt erhalten |
| `sam-processing` | SAM-Ergebnis erfolgreich | Auto-Mask als rotes Overlay, Floating Toolbar erscheint | `painting` | User kann Maske anpassen |
| `sam-processing` | SAM-Fehler | Error-Toast | `click-waiting` | -- |
| `outpaint-config` | Klick auf expand-btn (gleicher Button) | Direction Controls verschwinden | `idle` | Toggle-Off |
| `outpaint-config` | Klick auf Toggle-Tool (Details, Variation, etc.) | Toggle-Tool Popover oeffnet, Direction Controls hidden | `idle` | Mutual Exclusion |
| `outpaint-config` | Klick auf brush-edit-btn / erase-btn | Floating Toolbar erscheint, Mask-Canvas visible | `painting` | Vorherige Maske wiederhergestellt (falls vorhanden) |
| `outpaint-config` | Klick auf click-edit-btn | Cursor wird Fadenkreuz | `click-waiting` | -- |
| `outpaint-config` | Chat-Prompt senden (mit Richtung gewaehlt) | Loading-Overlay | `generating` | Bild + Canvas-Erweiterung + Maske -> Outpaint-Modell |
| `outpaint-config` | Chat-Prompt senden (keine Richtung gewaehlt) | Warnung: "Waehle mindestens eine Richtung" | `outpaint-config` | Send-Button disabled wenn keine Richtung gewaehlt. Falls trotzdem ausgeloest: Inline-Warnung |
| `generating` | API-Erfolg | Neues Bild, PUSH_UNDO | `result` | Altes Bild in Undo Stack |
| `generating` | API-Fehler | Error-Toast | Vorheriger State (painting/outpaint-config) | Bild + Maske bleiben |
| `result` | Undo | Vorheriges Bild aus Stack | `result` | -- |
| `result` | Neuer Edit-Modus | Floating Toolbar / Controls | `painting` / `click-waiting` / `outpaint-config` | Maske von vorherigem Edit bleibt |
| `result` | Prev/Next Navigation | Blockiert wenn Maske existiert | `result` | Navigation blockiert bei aktiver Maske |

---

## Business Rules

- **Mask-Feathering:** Automatisch 10px Gaussian Blur auf Mask-Kanten vor API-Call (unsichtbar fuer User)
- **Mask-Format:** Grayscale PNG, gleiche Dimensionen wie Bild. Weiss = Edit-Bereich, Schwarz = Beibehalten
- **Mask-Lifecycle:** Session-only. Bleibt im State bei Tool-Wechsel und nach Edit. Wird verworfen bei: Browser-Refresh, Navigation weg vom Canvas, explizitem Clear
- **Mask-Sichtbarkeit:** Mask-Canvas nur sichtbar in Modi die Masken nutzen (Brush Edit, Erase, Click Edit). In Outpaint-Modus: Maske hidden aber im State erhalten. Bei Rueckwechsel zu Mask-Modus: Maske wieder sichtbar
- **SAM-Mask ersetzt manuelle Maske:** Click-to-Edit generiert neue SAM-Maske die eine vorhandene manuelle Maske ersetzt (kein Merge). Wenn bereits eine Maske existiert: Confirmation Dialog ("Diese Aktion ersetzt deine aktuelle Maske. Fortfahren?" mit Abbrechen/Ersetzen). Ohne bestehende Maske: kein Dialog
- **Navigation-Sperre:** Prev/Next Navigation blockiert wenn Maske existiert. User muss erst Clear oder das Bild verlassen
- **Minimum Mask Size:** Warnung wenn markierter Bereich < 10px in beiden Dimensionen
- **Intent-Erkennung (Canvas Agent):** Chat-Prompt im Canvas Detail-View wird vom Canvas Agent via LLM klassifiziert: Edit-Intent (Bild veraendern) vs. Generate-Intent (neues Bild). Edit -> Instruction Editing Flow. Generate -> bestehender txt2img Flow
- **Modell-Routing (Canvas Agent):**
  - Maske vorhanden + Prompt -> Inpaint-Modell (Default: FLUX Fill Pro)
  - Maske vorhanden + kein Prompt / Erase-Action -> Erase-Modell (Default: Bria Eraser)
  - Keine Maske + Edit-Intent -> Instruction-Modell (Default: FLUX Kontext Pro)
  - Keine Maske + Generate-Intent -> txt2img (bestehendes Verhalten)
  - Outpaint-Kontext -> Outpaint-Modell (Default: FLUX Fill Pro)
  - SAM-Click -> SAM 2 fuer Mask, dann Inpaint/Erase je nach Folge-Aktion
- **Model Slots:** Neue `mode`-Werte: `inpaint`, `erase`, `outpaint`. Je 3 Slots mit Smart Defaults
- **Smart Default + Override:** Jeder Modus hat ein Default-Modell. User kann im Model-Slot-System ein anderes Modell konfigurieren
- **Outpaint-Groessen:** Prozent-basiert (25%, 50%, 100% der aktuellen Bildgroesse in der gewaehlten Richtung). Default: 50% (vorausgewaehlt bei Aktivierung des Expand-Tools)
- **Outpaint-Richtungen:** Mehrere Richtungen gleichzeitig waehlbar (z.B. oben + rechts)
- **Mask-Export Skalierung:** Mask-Canvas wird in Display-Aufloesung gerendert, beim Export auf Original-Bildaufloesung skaliert. Maske muss exakt auf Original-Koordinaten gemappt sein (Skalierungsfaktor = Original / Display)
- **Post-Edit:** In-Place Replace + Undo Stack. Ergebnis ersetzt aktuelles Bild, altes wird in Undo Stack gepusht
- **Toolbar Mutual Exclusion:** Nur ein activeToolId gleichzeitig (bestehendes Pattern). Klick auf Toggle-Tool (Details, Variation, img2img, Upscale) waehrend Edit-Modus aktiv: Edit-Modus wird deaktiviert (Floating Toolbar/Controls hidden), Maske bleibt im State erhalten. Rueckwechsel zum Edit-Tool stellt Maske wieder her
- **Erase-Modus + Chat:** Chat-Panel bleibt im Erase-Modus sichtbar und aktiv. Wenn User im Erase-Modus einen Chat-Prompt sendet, wird dies als Inpaint-Request behandelt (Maske + Prompt -> Inpaint-Modell). Erase-Modus wird implizit zu Inpaint "upgraded"
- **Outpaint-Validierung:** Send-Button im Chat disabled wenn Outpaint-Modus aktiv aber keine Richtung gewaehlt. Inline-Hinweis: "Waehle mindestens eine Richtung zum Erweitern"
- **Keyboard Shortcuts (Mask-Painting):** `[` / `]` fuer Brush-Groesse verkleinern/vergroessern, `E` fuer Brush/Eraser Toggle, `Ctrl+Z` / `Cmd+Z` fuer Mask-Undo (eigener Mask-Undo-Stack, getrennt vom Bild-Undo)

---

## Data

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `mask` (Canvas State) | Ja (fuer Inpaint/Erase) | Min 10px in beiden Dimensionen | Session-only, nicht in DB. HTML5 Canvas -> Grayscale PNG Konvertierung |
| `generationMode` | Ja | `inpaint`, `erase`, `outpaint` (neue Werte) | Bestehendes DB-Feld, neue Enum-Werte |
| `sourceImageUrl` | Ja (fuer alle Edit-Modi) | Gueltige R2 URL | Bestehendes DB-Feld |
| `model_slots.mode` | Ja | `inpaint`, `erase`, `outpaint` (neue Werte) | Bestehendes System, neue Mode-Werte |
| `maskUrl` (API Input) | Ja (fuer Inpaint/Erase) | Grayscale PNG, gleiche Dimensionen wie Bild | Temporaer: wird als Data-URL oder kurzfristiger R2 Upload an API gesendet |
| `outpaintDirections` | Ja (fuer Outpaint) | Array von: `top`, `bottom`, `left`, `right` | Mindestens eine Richtung |
| `outpaintSize` | Ja (fuer Outpaint) | `25`, `50`, `100` (Prozent) | -- |
| `clickCoordinates` | Ja (fuer Click-to-Edit) | `{x: number, y: number}` normalisiert auf Bildgroesse | Wird an SAM 2 API gesendet |

---

## Implementation Slices

### Dependencies

```
Slice 1 (Mask Canvas) -> Slice 2 (Inpaint API) -> Slice 5 (Click-to-Edit)
                       -> Slice 3 (Erase API)
                       -> Slice 6 (Outpainting)
Slice 4 (Model Slots) -> Slice 2, 3, 6
Slice 7 (Instruction Edit) -- unabhaengig (nutzt bestehenden Chat)
```

### Slices

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| 1 | Mask Canvas Layer | HTML5 Canvas Overlay, Brush/Eraser Painting, Size Slider, Clear, Floating Toolbar, Mask -> PNG Konvertierung, Feathering | Manuell: Maske auf Bild malen, Brush-Groesse aendern, Clear, Eraser nutzen. Mask-PNG Export pruefen | -- |
| 2 | Inpaint Generation Flow | Toolbar Button, Canvas Agent Erweiterung (Mask-Erkennung, Modell-Routing), Mask Upload, FLUX Fill Pro API Call, In-Place Replace + Undo | Maske malen -> Prompt im Chat -> Inpaint-Ergebnis ersetzt Bild -> Undo funktioniert | Slice 1 |
| 3 | Erase Generation Flow | Erase Toolbar Button, Erase-Action-Button in Floating Toolbar, Bria Eraser API Call, kein Prompt | Maske malen -> "Entfernen" klicken -> Objekt entfernt -> Undo funktioniert | Slice 1 |
| 4 | Edit Model Slots | Neue mode-Werte (inpaint, erase, outpaint) in model_slots, Smart Defaults, Override-Moeglichkeit | Model Slots fuer inpaint/erase/outpaint konfigurierbar, Default-Modelle gesetzt | -- |
| 5 | Click-to-Edit (SAM) | Click Edit Toolbar Button, Fadenkreuz-Cursor, SAM 2 API Call, Auto-Mask Visualisierung, Uebergang zu Painting-State | Objekt klicken -> Auto-Mask erscheint -> anpassen moeglich -> Prompt -> Inpaint | Slice 1, 2 |
| 6 | Outpainting | Expand Toolbar Button, Direction Controls, Groessen-Auswahl, Canvas-Erweiterung, Mask-Generierung fuer erweiterten Bereich, FLUX Fill Pro API | Richtung waehlen -> Groesse waehlen -> Prompt -> Bild erweitert | Slice 2 |
| 7 | Instruction Editing | Canvas Agent Erweiterung: Edit-Intent ohne Maske -> FLUX Kontext Pro Routing, Bild als Input | Im Chat "Mach den Himmel blauer" -> Bild aendert sich -> Undo | -- |

### Recommended Order

1. **Slice 1:** Mask Canvas Layer -- Fundament fuer Inpaint, Erase, Click-to-Edit
2. **Slice 4:** Edit Model Slots -- Infrastruktur fuer Modell-Auswahl
3. **Slice 2:** Inpaint Generation Flow -- Kern-Feature, verbindet Maske mit API
4. **Slice 3:** Erase Generation Flow -- Aufbauend auf Inpaint, einfachere Variante
5. **Slice 7:** Instruction Editing -- Unabhaengig, nutzt bestehenden Chat
6. **Slice 5:** Click-to-Edit (SAM) -- Aufbauend auf Mask + Inpaint
7. **Slice 6:** Outpainting -- Eigener UI-Flow, nutzt Inpaint-Backend

---

## Context & Research

### Similar Patterns in Codebase

| Feature | Location | Relevant because |
|---------|----------|------------------|
| Canvas Detail-View | `components/canvas/canvas-detail-view.tsx` | Host fuer alle neuen Edit-UI-Elemente |
| Canvas Toolbar + Toggle | `components/canvas/canvas-toolbar.tsx` | Pattern fuer neue Tool-Buttons |
| Variation/Img2img Popovers | `components/canvas/popovers/` | Pattern fuer Tool-spezifische UI-Panels |
| Canvas Agent (LangGraph) | `backend/app/agent/canvas_graph.py` | Muss erweitert werden fuer Edit-Intent-Routing |
| Capability Detection | `lib/services/capability-detection.ts` | Erkennt bereits `inpaint`/`outpaint` Capabilities |
| Generation Service | `lib/services/generation-service.ts` | `buildReplicateInput()` muss um Mask-Handling erweitert werden |
| Canvas Detail Context | `lib/canvas-detail-context.tsx` | State-Management, PUSH_UNDO, SET_GENERATING |

### Web Research

| Source | Finding |
|--------|---------|
| FLUX Fill Pro (Replicate) | SOTA Inpainting-Modell. Input: image + mask (Grayscale PNG) + prompt. Unterstuetzt auch Outpainting |
| Bria Eraser (Replicate) | Spezialisiert auf Object Removal ohne Prompt. Kommerziell sichere Trainingsdaten |
| FLUX Kontext Pro (Replicate) | Instruction-based Editing ohne Maske. Text-Instruktion + Bild -> gezielte Aenderung |
| SAM 2 (Meta/Replicate) | Click-based Segmentation. Input: Bild + Punkt-Koordinaten -> Objekt-Maske |
| Photoshop Generative Fill | UX-Referenz: Brush-Maske -> Prompt -> Fill. Third-Party-Modelle (FLUX, Nano Banana) seit 2026 |
| Figma AI Edit Tools | UX-Referenz: Prompt-freie Tools (Erase, Isolate, Expand). Minimal-UI Ansatz |
| Mask Best Practice | Automatisches Feathering (5-15px Blur) an Mask-Kanten verhindert sichtbare Naehte |
| FLUX.2 Pro | Unterstuetzt Inpaint + Outpaint + Directive Editing. Alternative zu separaten Modellen |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| 1 | Soll FLUX.2 Pro als einziges Modell fuer Inpaint + Outpaint + Instruction Edit genutzt werden (statt 3 separate Modelle)? | A) Ein Modell B) Separate Modelle | B) Separate -- spezialisierte Modelle liefern bessere Ergebnisse | Offen -- Architecture entscheidet |
| 2 | Mask-Upload: Data-URL direkt an API oder erst R2 Upload? | A) Data-URL B) R2 Upload | Architecture entscheidet | Offen |
| 3 | SAM 2 Latenz: Wie lange dauert die Auto-Mask-Generierung? | Performance-Test noetig | -- | Offen -- Architecture/POC |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-04-03 | Codebase | Canvas Detail-View hat 3-Spalten-Layout, Toolbar mit Toggle-System, Undo/Redo Stack, Chat-Panel. Inpaint/Outpaint als Enum definiert aber nicht implementiert |
| 2026-04-03 | Codebase | Capability Detection erkennt bereits Inpaint-faehige Modelle (image + mask Schema-Felder). Generation Service hat img2img + upscale Flows, aber keinen Inpaint-Flow |
| 2026-04-03 | Codebase | Model Slots System unterstuetzt mode-basierte Slot-Zuordnung. Neue Modes (inpaint, erase, outpaint) koennen hinzugefuegt werden |
| 2026-04-03 | Web | FLUX Fill Pro ist SOTA fuer Mask-Inpainting (Replicate). Bria Eraser fuer Object Removal. FLUX Kontext Pro fuer Instruction Editing. SAM 2 fuer Auto-Masking |
| 2026-04-03 | Web | Trend: Mask-freies Editing wird Standard (FLUX Kontext). Click-to-Edit via SAM 2. AI als Beschleuniger, nicht Ersatz fuer manuelle Tools |
| 2026-04-03 | Web | Mask Best Practice: Grayscale PNG (weiss=edit, schwarz=keep), automatisches 10px Feathering, min. Mask-Groesse beachten |

---

## Q&A Log

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Gibt es ein GitHub Issue zum Inpainting Feature? | Nein, kein Issue vorhanden |
| 2 | Soll zuerst eine umfassende Recherche durchgefuehrt werden oder direkt Q&A starten? | Recherche zuerst -- Codebase, Git-History, Web |
| 3 | Was ist der Hauptanwendungsfall fuer Inpainting in AI Factory? | Alles -- User moechte die Grenzen von Inpainting verstehen und welche Modelle das unterstuetzen |
| 4 | Welche Paradigmen sollen in den Scope? (Mask-Inpaint, Removal, Instruction, Click-to-Edit) | Alles (Full Suite) -- alle 4 Paradigmen |
| 5 | Soll die Full Suite in eine Discovery oder aufgeteilt werden? | Eine Discovery, Slices spaeter -- Gesamtbild erst verstehen |
| 6 | Wo soll der Einstieg ins Bild-Editing stattfinden? | Canvas Detail-View -- baut auf Phase 4 auf |
| 7 | Wie wechselt der User zwischen den Edit-Modi? | Toolbar-Buttons -- neue Icons in der linken Toolbar |
| 8 | Soll das Brush-Tool direkt auf dem Bild malen oder in separatem Overlay? | Direkt auf dem Bild -- Canvas-Layer ueber dem Bild, wie Photoshop |
| 9 | Welche Brush-Controls braucht der User? | Minimal -- Brush + Eraser + Size Slider + Clear All |
| 10 | Wie soll Instruction Editing im UI aussehen? | Ueber Canvas-Chat -- bestehender Chat, AI erkennt Edit-Intent |
| 11 | Wie soll Click-to-Edit (SAM) funktionieren? | Click -> Auto-Mask -> Prompt-Feld. SAM erstellt Maske, User gibt Prompt fuer Replacement |
| 12 | Soll Object Removal ein eigener Button oder Teil des Inpaint-Flows sein? | Eigener "Erase" Button in der Toolbar |
| 13 | Welches Modell pro Modus? User-waehlbar? | Smart Default + Override -- feste Defaults (FLUX Fill Pro, Bria Eraser, FLUX Kontext Pro), User kann im Model-Slot-System aendern |
| 14 | Was passiert nach einem Edit? | In-Place Replace + Undo Stack -- konsistent mit bestehendem Variation-Flow |
| 15 | Was passiert mit der Maske nach einem Edit? | Maske beibehalten -- User kann iterieren |
| 16 | Soll Outpainting Teil dieses Features sein? | Ja, als Teil der Edit Suite |
| 17 | Wie soll Outpainting im UI funktionieren? | Richtungs-Controls an den 4 Bildkanten |
| 18 | Wie viele Pixel beim Outpainting? | Prozent-basiert: 25%, 50%, 100% der aktuellen Bildgroesse |
| 19 | Automatisches Mask-Feathering? | Ja, automatisch 10px Gaussian Blur (unsichtbar fuer User) |
| 20 | Eigene Model Slots pro Edit-Modus? | Ja, pro Modus (inpaint, erase, outpaint) mit je 3 Slots |
| 21 | Maske in DB persistieren? | Nein, nur Session -- wird bei Navigation weg oder Refresh verworfen |
| 22 | Wo sollen die Brush-Controls erscheinen? | Floating Toolbar ueber dem Bild -- schwebende Leiste oben am Canvas |
| 23 | Wo erscheint das Prompt-Feld nach dem Masken-Malen? | Canvas-Chat als zentraler Prompt-Hub fuer ALLE Edit-Modi (ausser Erase: direkter Action-Button) |
| 24 | Soll der Canvas-Chat der zentrale Prompt-Kanal fuer alle Edit-Modi sein? | Ja -- ein Kanal, iterativ, kein neues UI |
| 25 | Erase-Modus: Chat oder direkter Action-Button? | Direkter Action-Button in der Floating Toolbar -- schneller fuer simplen Delete |
| 26 | Was passiert mit der Maske bei Tool-Wechsel? | Maske beibehalten -- erst bei explizitem Clear oder Navigation weg |
| 27 | Navigation (Prev/Next) bei aktiver Maske? | Navigation blockieren -- User muss erst Clear/Generate |
| 28 | Visuelle Darstellung der Maske? | Semi-transparentes Rot (50% Opacity) auf maskierten Bereichen |
| 29 | Wie werden State-Transitions zwischen Edit-Modi gehandhabt? | Direkte Transitions zwischen allen Modi. Maske bleibt im State erhalten bei Wechsel |
| 30 | Wie unterscheidet der Canvas Agent Edit-Intent von Generate-Intent im Chat? | LLM-basierte Intent-Erkennung. Canvas Agent klassifiziert jeden Prompt als Edit oder Generate |
| 31 | Was ist der Default fuer Outpaint-Groesse? | 50% vorausgewaehlt bei Aktivierung des Expand-Tools |
| 32 | Was passiert mit der Maske bei Wechsel zu einem Modus der keine Maske nutzt (z.B. Outpaint)? | Maske wird ausgeblendet (hidden) aber im State behalten. Bei Rueckwechsel zu Mask-Modus wieder sichtbar |
| 33 | Wie werden Mask-Koordinaten auf die Original-Bildgroesse gemappt? | Mask-Canvas rendert in Display-Aufloesung, Export skaliert auf Original-Bildaufloesung. Explizite Business Rule |
| 34 | Aendert sich das Canvas-Layout nach Outpainting (groesseres Bild)? | Nein -- bestehendes object-fit Verhalten. Groesseres Bild wird in gleichen Container eingepasst |
