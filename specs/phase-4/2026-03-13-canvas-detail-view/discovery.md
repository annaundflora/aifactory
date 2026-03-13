# Feature: Canvas Detail-View & Editing Flow

**Epic:** AI Image Studio - Phase 4
**Status:** Ready
**Phase:** 4

---

## Problem & Solution

**Problem:**
- Iteratives Arbeiten bricht den Flow: Lightbox -> Aktion -> Lightbox schliesst -> Gallery -> neues Bild suchen
- Kein In-Place-Ergebnis: Neue Generierungen erscheinen in der Gallery, nicht dort wo der User arbeitet
- Prompt-Panel ist auf Erst-Generierung optimiert, nicht auf Iteration auf einem bestehenden Bild
- Chat/Assistant existiert im Backend (LangGraph Agent), aber nicht als bild-bezogener Editing-Kanal
- img2img Referenz-System funktioniert nur fuer neue Generierungen, nicht als Iterations-Tool auf einem bestehenden Bild

**Solution:**
- Lightbox ersetzen durch Canvas-Detail-View: Fullscreen-Ansicht mit persistentem Bild, Tools und Chat
- Photoshop-Toolbar Pattern: Schmale Icon-Leiste links + schwebende Popovers fuer Tool-Optionen
- Chat rechts als bild-bezogener Editing-Kanal: LangGraph Agent erhaelt aktuelles Bild als Kontext, triggert Generierungs-Actions
- Einheitliches Undo/History-Pattern: Jede Aktion (Chat oder Tool) ersetzt sofort das Bild, Undo-Stack ermoeglicht Ruecknavigation
- Sibling-Thumbnails (E-Commerce Detail Pattern) fuer Varianten-Navigation innerhalb einer Generation

**Business Value:**
- Drastische Reduktion der Klicks pro Iteration (von ~5 auf ~1-2)
- Chat-basiertes Editing senkt die Articulation Barrier (NNGroup) fuer nicht-technische User
- Grundlage fuer spaetere Canvas-Features (Inpainting, Outpainting)

---

## Scope & Boundaries

| In Scope |
|----------|
| Canvas-Detail-View als Fullscreen-Ersatz fuer die aktuelle Lightbox |
| Animated Transition von Gallery zu Detail-View (Bild fliegt) |
| Photoshop-Toolbar: Schmale Icon-Leiste links mit schwebenden Popovers |
| Tools: Variation (img2img auf sich selbst, prompt_strength Slider), img2img + Referenzen (wie Status Quo im Popover), Upscale (2x/4x), Download, Delete |
| Chat-Panel rechts (collapsible, resizable 320-480px): Text-Nachrichten, Bild-Ergebnis erscheint im Canvas (nicht als Chat-Thumbnail), Bild-Kontext |
| Chat-Init mit Bild-Kontext (Modell, Prompt, Key-Params) |
| Sibling-Thumbnails unter dem Bild (Varianten einer Generation) |
| Prev/Next Navigation durch alle Gallery-Bilder |
| Einheitliches Undo/History-Pattern: Sofort-Replace + Undo-Stack pro Session |
| Collapsible Prompt/Details-Info (Prompt, Modell, Parameter, Provenance) |
| Gallery-View bleibt unveraendert (Masonry, flach, kein Varianten-Grouping) |
| Prompt-Panel bleibt in Gallery-View (neue Generierungen starten dort) |

| Out of Scope |
|--------------|
| Inpainting / Outpainting (spaetere Discovery) |
| Generation Frame auf Canvas |
| Infinite Canvas / Multi-Image Canvas |
| Chat kennt Referenzen als Kontext |
| Collapsed Reference-Indikator am Toolbar |
| Gallery-Varianten-Grouping |
| Chat in Gallery-View (bleibt Prompt-Panel) |
| Mobile/Touch-Optimierung der Detail-View |

---

## Current State Reference

> Existierende Funktionalitaet die wiederverwendet wird (unveraendert):

- Gallery-View: Masonry Grid mit GenerationCard, Filter (txt2img/img2img/upscale), Lazy Loading
- Prompt-Panel: Motiv/Style/Negative-Prompt, Parameter-Panel (dynamisch pro Modell), Variant-Count, Mode-Selector
- Reference-Bar: 5 Slots mit Role (style/content/structure/character/color) + Strength (subtle/moderate/strong/dominant)
- Server Actions: `generateImages()`, `upscaleImage()`, `deleteGeneration()`
- Polling: WorkspaceContent pollt alle 3s bei pending Generierungen
- Provenance: ProvenanceRow zeigt Input-Referenzen als Thumbnails mit Rollen
- Backend Assistant: FastAPI + LangGraph Agent mit Tools fuer Image/Prompt-Operationen
- Drag & Drop: GALLERY_DRAG_MIME_TYPE fuer Gallery-to-Reference
- Model Selection: ModelBrowserDrawer mit Search/Filter/Favorites

---

## UI Patterns

### Reused Patterns

| Pattern Type | Component | Usage in this Feature |
|--------------|-----------|----------------------|
| Masonry Gallery | `components/workspace/gallery-grid.tsx` | Bleibt als Browse-View unveraendert |
| Reference Slots | `components/workspace/reference-bar.tsx`, `reference-slot.tsx` | Wiederverwendet im img2img Tool-Popover |
| Generation Card | `components/workspace/generation-card.tsx` | Bleibt in Gallery, Klick oeffnet Detail-View statt Lightbox |
| Provenance Row | `components/lightbox/provenance-row.tsx` | Wiederverwendet im Collapsible Details-Bereich |
| Image Dropzone | `components/workspace/image-dropzone.tsx` | Wiederverwendet im img2img Tool-Popover |

### New Patterns

| Pattern Type | Description | Rationale |
|--------------|-------------|-----------|
| Canvas-Detail-View | Fullscreen-View mit zentriertem Bild, Toolbar links, Chat rechts | Ersetzt Lightbox; persistenter Arbeitsbereich fuer Iteration |
| Photoshop-Toolbar | Schmale vertikale Icon-Leiste (~48px) mit schwebenden Popovers | Maximaler Platz fuer Bild+Chat; kontextuelle Tool-Optionen |
| Tool-Popover | Schwebendes Panel neben Tool-Icon; unterschiedliche Groessen pro Tool | Kein Drawer/Sidebar; verdeckt Canvas nur temporaer |
| Sibling-Thumbnails | Horizontale Thumbnail-Reihe unter dem Hauptbild; Klick wechselt Bild | E-Commerce Detail Pattern; universell gelerntes Muster |
| Chat-Panel | Rechte Spalte mit Text+Bild-Nachrichten; Clarification-Flow mit Chips | Bild-bezogener Editing-Kanal via LangGraph Agent |
| Undo-Stack | Visuelles Undo/Redo (Cmd+Z / Cmd+Shift+Z) ueber alle Aktionen | Einheitliches Pattern fuer Chat-Actions und Tool-Actions |
| Animated View Transition | Bild wachst von Gallery-Position zur Detail-View; schrumpft zurueck | Raeumliche Orientierung beim Wechsel |

---

## User Flow

### Flow 1: Gallery -> Detail-View -> Iteration via Tool

1. User klickt auf Bild in Gallery -> Animated Transition: Bild wachst zur Detail-View
2. Detail-View zeigt: Toolbar links, Bild zentriert, Chat rechts, Siblings unten
3. User klickt Variation-Icon in Toolbar -> Popover erscheint (Prompt vorausgefuellt, Strength-Dropdown, Count, Generate-Button)
4. User waehlt Strength (Subtle/Balanced/Creative wie existierender StrengthSlider), klickt Generate -> Popover schliesst, Loading-State auf Bild
5. Technisch: img2img mit aktuellem Bild als einzigem Input (keine Reference-Roles)
6. Neues Bild ersetzt aktuelles im Canvas -> Neue Sibling-Gruppe. Undo fuehrt zum vorherigen Bild zurueck.
6. User kann via Undo (Cmd+Z) zum vorherigen Bild zurueckkehren

### Flow 2: Detail-View -> Iteration via Chat

1. User ist in Detail-View, Chat zeigt Bild-Kontext (Modell, Prompt, Key-Params)
2. User tippt: "Mach den Hintergrund blauer"
3. Chat-Agent erkennt Intent, stellt ggf. Rueckfrage: "Subtil oder dramatisch?" mit Chips [Subtil] [Dramatisch]
4. User klickt [Dramatisch]
5. Agent generiert optimierten Prompt, triggert Generation
6. Chat zeigt: "Generiere... ⏳" -> "Fertig! ✔ Prompt: '...'" (kein Thumbnail — Bild erscheint im Canvas)
7. Neues Bild ersetzt aktuelles im Canvas -> Neue Sibling-Gruppe (Generation-B)
8. User kann via Undo zurueck

### Flow 3: Detail-View -> img2img mit Referenzen

1. User klickt img2img-Icon in Toolbar -> Grosses Popover erscheint
2. Popover zeigt: Layout wie bestehendes Prompt-Panel (References mit Dropzone, Prompt: Motiv + Style/Modifier, Variants-Counter, Generate-Button). Ohne Assistent/Improve, ohne Parameters, ohne Model-Selector (Model kommt aus Header).
3. User fuegt Referenzbilder hinzu (Upload, Drag aus Siblings/Gallery)
4. User setzt Rollen und Strengths, schreibt Prompt
5. User klickt Generate -> Popover schliesst, Loading-State
6. Neues Bild ersetzt aktuelles -> Altes in Siblings

### Flow 4: Navigation innerhalb Detail-View

1. User klickt Sibling-Thumbnail -> Hauptbild wechselt (kein Popover-State-Verlust)
2. User klickt Prev/Next-Button -> Wechselt zum naechsten/vorherigen Gallery-Bild (anderer Kontext). Chat zeigt visuellen Separator mit neuem Bild-Kontext.
3. User drueckt ESC oder Zurueck-Button -> Animated Transition zurueck zur Gallery

### Flow 5: Upscale

1. User klickt Upscale-Icon in Toolbar -> Popover mit [2x] [4x] Buttons
2. User klickt [4x] -> Popover schliesst, Loading-State
3. Upscale-Ergebnis ersetzt aktuelles Bild -> Original in Siblings

**Error Paths:**
- Generation fehlgeschlagen -> Toast-Notification, Bild bleibt unveraendert, Chat zeigt Fehlermeldung
- Chat-Agent Timeout -> Chat zeigt "Keine Antwort. Bitte erneut versuchen."
- Upscale nicht verfuegbar (Bild zu gross) -> Upscale-Icon deaktiviert, Tooltip: "Image too large for upscale"

---

## UI Layout & Context

### Screen: Gallery-View (unveraendert)

**Position:** `/projects/[id]` - Hauptansicht des Workspaces
**When:** Standardansicht beim Oeffnen eines Projekts

**Layout:**
- Links: Prompt-Panel (480px) mit Motiv, Style, Negative-Prompt, Parameter, Variants, Generate-Button
- Rechts: Gallery Grid (flex: 1) mit Masonry-Layout, Filter-Chips oben
- Header: WorkspaceHeader mit Projekt-Name

### Screen: Canvas-Detail-View (NEU)

**Position:** Ersetzt Gallery-View vollstaendig (Fullscreen)
**When:** Klick auf ein Bild in der Gallery

**Layout:**
- Projekt-Sidebar: Auto-collapsed beim Oeffnen der Detail-View (ist aktuell ohnehin default-collapsed). Maximiert Canvas-Platz.
- Links: Toolbar (48px) mit vertikalen Tool-Icons
- Mitte: Canvas-Bereich (flex: 1) mit zentriertem Bild (max-fit), Siblings-Thumbnails darunter
- Rechts: Chat-Panel (collapsible, resizable min 320px / max 480px) mit Nachrichten-Verlauf und Eingabefeld
- Oben-Links: Zurueck-Button (→ Gallery) im Header, nicht in der Toolbar
- Header: Model-Selector (gemeinsam fuer Variation + img2img). Auto-Switch wenn nicht img2img-faehig. Upscale nutzt hardcoded Model.
- Schwebend: Tool-Popovers (erscheinen bei Tool-Klick neben dem Icon)

---

## UI Components & States

| Element | Type | Location | States | Behavior |
|---------|------|----------|--------|----------|
| `toolbar` | Vertical Icon Bar | Links, 48px breit | `default`, `tool-active` | Schmale Leiste, Icons vertikal (Reihenfolge top-down: Variation, img2img, Upscale, Download, Delete, Details), aktives Tool hervorgehoben |
| `toolbar.variation` | Icon Button | Toolbar | `default`, `active`, `disabled` | Klick oeffnet Variation-Popover |
| `toolbar.img2img` | Icon Button | Toolbar | `default`, `active`, `disabled` | Klick oeffnet img2img-Popover (groesser) |
| `toolbar.upscale` | Icon Button | Toolbar | `default`, `active`, `disabled` | Klick oeffnet Upscale-Popover |
| `toolbar.download` | Icon Button | Toolbar | `default` | Klick triggert Download direkt |
| `toolbar.delete` | Icon Button | Toolbar | `default` | Klick oeffnet Confirm-Dialog ("Delete Image? This action cannot be undone." mit Cancel/Delete Buttons) |
| `toolbar.details` | Icon Button | Toolbar | `default`, `expanded` | Klick toggled Collapsible Details-Overlay |
| `popover.variation` | Floating Panel | Neben toolbar.variation | `visible`, `hidden` | Prompt (vorausgefuellt aus Original, editierbar), Strength-Dropdown (Subtle/Balanced/Creative, wie existierender StrengthSlider), Count (1-4), Generate-Button. Technisch: img2img mit aktuellem Bild als einzigem Input, keine Reference-Roles. |
| `popover.img2img` | Floating Panel (gross) | Neben toolbar.img2img | `visible`, `hidden` | Layout wie bestehendes Prompt-Panel (ohne Assistent/Improve, ohne Parameters, ohne Model-Selector): References (collapsible, [n/5], Dropzone), Prompt (Motiv + Style/Modifier), Variants-Counter, Generate-Button. Model kommt aus Header-Selector. |
| `popover.upscale` | Floating Panel | Neben toolbar.upscale | `visible`, `hidden` | [2x] und [4x] Buttons |
| `canvas-image` | Zoomable Image | Mitte, zentriert | `default`, `loading`, `error` | Zeigt aktuelles Bild, Loading-Overlay bei Generation (semi-transparenter Overlay mit Label "Generating" + Spinner) |
| `siblings` | Thumbnail Row | Unter canvas-image | `empty`, `has-items` | Horizontale Thumbnails, aktives Bild hervorgehoben, Klick wechselt |
| `prev-next` | Navigation Arrows | Links/Rechts vom Bild | `visible`, `hidden` (wenn erstes/letztes) | Nur Maus-Klick auf Buttons, keine Pfeiltasten. Wechselt durch alle Gallery-Bilder |
| `chat-panel` | Chat Container | Rechts, collapsible+resizable (min 320px, max 480px) | `collapsed`, `expanded-empty`, `expanded-has-messages` | Eingeklappt: Icon-Leiste. Ausgeklappt: Nachrichten-Verlauf, Eingabefeld unten. Resize-Handle links. |
| `chat-init` | Context Message | Chat, erste Nachricht | `visible` | Zeigt: Model, Prompt (gekuerzt), Steps, CFG des aktuellen Bildes |
| `chat-input` | Text Input + Send | Chat, unten | `default`, `sending`, `disabled` | Placeholder: "Beschreibe Aenderungen am Bild..." |
| `chat-message.user` | Message Bubble | Chat | `default` | User-Text |
| `chat-message.bot` | Message Bubble | Chat | `default`, `loading`, `error` | Bot-Text, Prompt-Info, Quick-Chips. Kein Thumbnail — Bild-Ergebnis erscheint im Canvas (Sofort-Replace). |
| `chat-chips` | Action Chips | In Bot-Nachricht | `default` | Klickbare Optionen fuer Clarification/Quick-Actions |
| `details-overlay` | Collapsible Panel | Ueber Canvas, oben (push-down Layout) | `collapsed`, `expanded` | Prompt (volltext), Model, Steps, CFG, Seed, Size, Provenance Row. Expanded-State schiebt Canvas-Inhalt nach unten. |
| `undo-button` | Icon Button | Header | `default`, `disabled` (kein History) | Cmd+Z Shortcut, stellt vorheriges Bild wieder her |
| `redo-button` | Icon Button | Header | `default`, `disabled` (kein Redo-Stack) | Cmd+Shift+Z Shortcut, stellt naechstes Bild wieder her |
| `chat-context-separator` | Divider | Chat-Panel | `visible` | Visueller Trenner bei Bildwechsel: "--- Kontext: [neues Bild] ---" mit neuem Bild-Kontext |
| `chat-new-session` | Button | Chat-Panel Header | `default` | Startet neue Chat-Session (leert History), wie beim Prompt-Assistenten |
| `model-selector` | Dropdown + Browse | Header, zwischen Back und Undo | `default`, `browse-open` | Gemeinsamer Model-Selector fuer Variation + img2img. Zeigt aktuelles Model (Icon + Name + Provider). "Browse Models" oeffnet ModelBrowserDrawer. Auto-Switch bei nicht-img2img-faehigem Model. Upscale ignoriert diesen Selector (hardcoded `nightmareai/real-esrgan`). |
| `back-button` | Icon Button | Oben links | `default` | Navigiert zurueck zur Gallery mit Reverse-Animation |

---

## Feature State Machine

### States Overview

| State | UI | Available Actions |
|-------|----|--------------------|
| `gallery` | Gallery-View mit Masonry Grid | Klick auf Bild -> `transitioning` |
| `transitioning-in` | Animated Transition (Bild wachst) | Keine (Animation laeuft) |
| `detail-idle` | Canvas-Detail-View, Bild geladen, kein Tool aktiv | Tool-Klick, Chat-Eingabe, Sibling-Klick, Prev/Next, Undo, Redo, Back |
| `detail-tool-open` | Detail-View mit aktivem Tool-Popover | Popover-Interaktion, Generate, Popover-Close |
| `detail-generating` | Detail-View mit Loading-State auf Bild | Warten (Chat zeigt Progress), Undo nicht moeglich waehrend Generation |
| `detail-chat-active` | Detail-View, Chat-Eingabe oder Bot-Antwort laeuft | Warten auf Bot-Antwort, Weitere Eingabe |
| `transitioning-out` | Animated Transition zurueck (Bild schrumpft) | Keine (Animation laeuft) |

### Transitions

| Current State | Trigger | UI Feedback | Next State | Business Rules |
|---------------|---------|-------------|------------|----------------|
| `gallery` | Klick auf GenerationCard | Bild beginnt zu wachsen | `transitioning-in` | -- |
| `transitioning-in` | Animation abgeschlossen | Detail-View vollstaendig sichtbar | `detail-idle` | Chat-Init-Message laden |
| `detail-idle` | Klick auf Tool-Icon | Popover erscheint neben Icon | `detail-tool-open` | Nur ein Popover gleichzeitig |
| `detail-idle` | Text in Chat eingeben + Send | Message erscheint, Bot verarbeitet | `detail-chat-active` | Agent erhaelt aktuelles Bild als Kontext |
| `detail-idle` | Klick auf Sibling-Thumbnail | Hauptbild wechselt | `detail-idle` | Chat-Kontext aktualisiert sich auf neues Bild |
| `detail-idle` | Klick auf Prev/Next-Button | Bild wechselt, Siblings aktualisieren | `detail-idle` | Chat zeigt Separator + neuen Bild-Kontext. Keine Pfeiltasten. |
| `detail-idle` | Undo (Cmd+Z) | Vorheriges Bild erscheint | `detail-idle` | Aktuelles Bild auf redoStack pushen. Nur moeglich wenn undoStack nicht leer |
| `detail-idle` | Redo (Cmd+Shift+Z) | Naechstes Bild erscheint | `detail-idle` | Aktuelles Bild auf undoStack pushen. Nur moeglich wenn redoStack nicht leer |
| `detail-idle` | Klick Back / ESC | Bild beginnt zu schrumpfen | `transitioning-out` | -- |
| `detail-tool-open` | Generate-Klick im Popover | Popover schliesst, Loading-State auf Bild | `detail-generating` | Server Action aufrufen |
| `detail-tool-open` | Klick ausserhalb Popover | Popover schliesst | `detail-idle` | -- |
| `detail-tool-open` | Klick auf anderes Tool-Icon | Aktuelles Popover schliesst, neues oeffnet | `detail-tool-open` | -- |
| `detail-chat-active` | Agent triggert Generation | Loading-State auf Bild | `detail-generating` | Agent ruft generateImages Server Action auf |
| `detail-chat-active` | Agent antwortet nur Text (kein Generate) | Bot-Nachricht erscheint | `detail-idle` | z.B. bei Prompt-Verbesserung oder Bild-Analyse |
| `detail-generating` | Generation abgeschlossen | Neues Bild ersetzt aktuelles, altes in Siblings | `detail-idle` | Undo-Stack: vorheriges Bild pushen. Redo-Stack leeren. |
| `detail-generating` | Generation fehlgeschlagen | Error-Toast, Bild bleibt | `detail-idle` | Chat zeigt Fehlermeldung |
| `transitioning-out` | Animation abgeschlossen | Gallery-View sichtbar | `gallery` | -- |

---

## Business Rules

- Nur ein Tool-Popover gleichzeitig geoeffnet
- Undo-Stack ist pro Detail-View Session (wird beim Verlassen verworfen)
- Redo-Stack ist pro Detail-View Session (wird beim Verlassen verworfen)
- Undo-Stack Maximum: 20 Eintraege (aelteste werden verworfen)
- Redo-Verhalten: Undo pusht aktuelles Bild auf redoStack, Redo pusht aktuelles auf undoStack. Neue Generation leert redoStack (standard Undo/Redo Pattern).
- Chat-Agent erhaelt aktuelles Bild-URL + Original-Prompt als Kontext
- Chat-Agent hat KEINEN Zugriff auf Reference-Slots (Out of Scope)
- Chat-Agent Clarification: Bei unvollstaendigem Intent stellt der Agent Rueckfragen (existiert bereits aehnlich im Backend-Agent, braucht neuen Prompt/Agent aber guter Startpunkt)
- Neue Generierung aus Detail-View: Ergebnis wird in Gallery UND als neuer Sibling gespeichert
- Prev/Next Navigation: Reihenfolge = Gallery-Sortierung (neueste zuerst)
- Sibling-Definition: Alle Bilder derselben Generation-Request (gleicher Batch). Folge-Generierungen erzeugen NEUE Sibling-Gruppen. Vorherige Gruppe via Prev/Next oder Undo erreichbar.
- Prev/Next Navigation: Nur Maus-Klick auf Buttons, keine Pfeiltasten-Shortcuts
- Bei Wechsel auf anderes Bild (Prev/Next): Chat zeigt visuellen Separator ("--- Kontext: [neues Bild] ---") mit neuem Bild-Kontext darunter. History bleibt sichtbar.
- Bei Wechsel auf Sibling: Chat-History bleibt erhalten, Bild-Kontext aktualisiert sich
- Chat "Neue Session" Button: Startet frische Chat-Session (leert History), analog zum existierenden Prompt-Assistenten
- Keyboard-Shortcuts (Cmd+Z, Cmd+Shift+Z) werden unterdrueckt wenn Fokus in Input/Textarea liegt
- Loading-State waehrend Generation: Toolbar-Icons disabled, Chat-Input disabled, Undo/Redo disabled
- "Als Referenz verwenden" entfaellt: In Detail-View arbeiten alle Tools direkt auf dem aktuellen Bild. Lightbox-Button wird mit Lightbox-Entfernung obsolet.
- Model-Selector im Header: Gemeinsam fuer Variation + img2img. Beim Oeffnen der Detail-View wird das Gallery-Model uebernommen. Falls nicht img2img-faehig: Auto-Switch zum ersten kompatiblen Model (Toast-Hinweis). Upscale nutzt hardcoded Model (`nightmareai/real-esrgan`), ignoriert Header-Selector.
- Download-Aktion: Kein Popover, direkter Download des aktuellen Bildes
- Delete-Aktion: Confirmation-Dialog, bei Bestaetigung zurueck zur Gallery (wenn letztes Bild) oder naechstes Bild laden

---

## Data

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `batchId` | Ja | UUID | DB-Feld in `generations` Tabelle: Gruppiert Bilder derselben Generation-Request. `generateImages()` erzeugt eine shared batchId fuer alle Rows eines Requests. Sibling-Query: `WHERE batchId = :currentBatchId`. |
| `undoStack` | Nein | Max 20 Eintraege | Client-State: Array von Generation-IDs |
| `redoStack` | Nein | Max 20 Eintraege | Client-State: Array von Generation-IDs. Wird bei neuer Generation geleert. |
| `currentGenerationId` | Ja | Muss in DB existieren | ID des aktuell angezeigten Bildes |
| `chatSessionId` | Nein | -- | Verknuepft Chat-History mit Detail-View Session |
| `chatMessages` | Nein | -- | Array von {role, content, timestamp, thumbnail?} |
| `activeToolId` | Nein | Einer von: variation, img2img, upscale, details, null | Client-State: Welches Popover ist offen |

> Neues DB-Feld: `batchId` (UUID) in `generations` Tabelle fuer Sibling-Gruppierung.
> Undo/Redo-Stack und aktives Tool sind reiner Client-State.
> Chat nutzt existierende `assistant_sessions` Tabelle.

---

## Trigger-Inventory

| Trigger | Source | Action |
|---------|--------|--------|
| Klick auf GenerationCard in Gallery | Gallery-View | Detail-View oeffnen mit Animated Transition |
| Tool-Icon Klick | Toolbar | Popover oeffnen/schliessen |
| Generate-Button in Popover | Tool-Popover | `generateImages()` oder `upscaleImage()` Server Action |
| Chat-Send | Chat-Panel | LangGraph Agent aufrufen mit Bild-Kontext |
| Agent-Tool-Call (generate) | LangGraph Agent | `generateImages()` Server Action |
| Sibling-Thumbnail Klick | Siblings-Leiste | `currentGenerationId` wechseln |
| Prev/Next Button-Klick | Navigation Arrows | `currentGenerationId` wechseln (Gallery-Reihenfolge). Chat: Separator einfuegen. |
| Cmd+Z / Undo-Button | Keyboard / UI | Aktuelles auf redoStack, `currentGenerationId` = `undoStack.pop()`. Unterdrueckt in Input-Fokus. |
| Cmd+Shift+Z / Redo-Button | Keyboard / UI | Aktuelles auf undoStack, `currentGenerationId` = `redoStack.pop()`. Unterdrueckt in Input-Fokus. |
| ESC / Back-Button | Keyboard / UI | Animated Transition zurueck zur Gallery |
| Generation abgeschlossen (Polling) | WorkspaceContent Polling | Bild im Canvas ersetzen, altes in Undo-Stack + Siblings |

---

## Implementation Slices

### Dependencies

```
Slice 1 (Detail-View Shell) -> Slice 2 (Toolbar + Popovers)
                             -> Slice 3 (Siblings + Navigation)
                             -> Slice 4 (Chat-Panel)
Slice 2 -> Slice 5 (In-Place Generation + Undo)
Slice 4 -> Slice 5
Slice 5 -> Slice 6 (Chat-Agent Tools)
```

### Slices

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| 1 | Detail-View Shell + Animated Transition | Fullscreen-View mit zentriertem Bild, Back-Button, Animated Transition von/zur Gallery. Entfernt Lightbox-Trigger. | Klick auf Gallery-Bild oeffnet Detail-View mit Animation, ESC/Back fuehrt zurueck | -- |
| 2 | Toolbar + Tool-Popovers | Icon-Toolbar links, Popovers fuer Variation (Strength+Count), img2img (Reference-Slots+Prompt), Upscale (2x/4x), Download, Delete. Collapsible Details-Overlay. | Jedes Tool-Icon oeffnet korrektes Popover, nur eins gleichzeitig, Klick aussen schliesst | Slice 1 |
| 3 | Siblings + Prev/Next Navigation | Sibling-Thumbnails unter Bild (gleiche Generation), Prev/Next Pfeile (alle Gallery-Bilder), Keyboard-Navigation | Siblings zeigen korrekte Bilder, Klick wechselt Hauptbild, Pfeiltasten funktionieren | Slice 1 |
| 4 | Chat-Panel UI | Chat-Container rechts, Nachrichten-Verlauf, Eingabefeld, Bot-Messages mit Thumbnails+Chips, Init-Message mit Bild-Kontext | Chat zeigt Init-Kontext, User kann Nachrichten senden, Bot antwortet (text-only erstmal) | Slice 1 |
| 5 | In-Place Generation + Undo | Tool-Popovers triggern Server Actions, Ergebnis ersetzt Bild im Canvas, Undo-Stack (Cmd+Z), Loading-State | Generate via Variation-Popover erzeugt neues Bild in-place, Undo stellt vorheriges her | Slice 2, Slice 4 |
| 6 | Chat-Agent Integration | LangGraph Agent erhaelt Bild-Kontext, Clarification-Flow, Agent triggert Generierung, Ergebnis in-place | Chat-Nachricht "mach den Hintergrund blauer" fuehrt zu neuer Generation im Canvas | Slice 5 |

### Recommended Order

1. **Slice 1:** Detail-View Shell + Animated Transition -- Grundgeruest, ersetzt Lightbox
2. **Slice 3:** Siblings + Prev/Next Navigation -- Navigation innerhalb Detail-View
3. **Slice 2:** Toolbar + Tool-Popovers -- Aktionsmoeglichkeiten (UI-only, noch kein Generate)
4. **Slice 4:** Chat-Panel UI -- Chat-Grundstruktur (UI-only, Backend-Anbindung spaeter)
5. **Slice 5:** In-Place Generation + Undo -- Kernfunktionalitaet: Generate und Ergebnis in-place
6. **Slice 6:** Chat-Agent Integration -- Chat triggert tatsaechlich Generierungen

---

## Context & Research

### Similar Patterns in Codebase

| Feature | Location | Relevant because |
|---------|----------|------------------|
| LightboxModal | `components/lightbox/lightbox-modal.tsx` | Wird durch Canvas-Detail-View ersetzt; Actions und Layout als Referenz |
| LightboxNavigation | `components/lightbox/lightbox-navigation.tsx` | Prev/Next Pattern wird wiederverwendet |
| ProvenanceRow | `components/lightbox/provenance-row.tsx` | Wird im Collapsible Details-Bereich wiederverwendet |
| WorkspaceVariationContext | `lib/workspace-state.tsx` | Variation/Lightbox-Actions als Referenz fuer Tool-Integration |
| ReferenceBar + ReferenceSlot | `components/workspace/reference-bar.tsx`, `reference-slot.tsx` | Wird im img2img Popover wiederverwendet |
| PromptArea | `components/workspace/prompt-area.tsx` | Prompt-Felder und Parameter-Panel als Referenz fuer Tool-Popovers |
| AssistantService | `backend/app/services/assistant_service.py` | LangGraph Agent fuer Chat-Integration erweitern |

### Web Research

| Source | Finding |
|--------|---------|
| Leonardo.ai Canvas | Generation Frame Pattern, Focus Mode als vereinfachte Canvas-Ansicht, 5 Canvas-Modi |
| Midjourney Editor | 2-Tier Editor (Light/Full), In-Editor Queue eliminiert Kontextwechsel, 1-Click Variation via Hover |
| Ideogram Canvas | Arrow-Cycling durch 4 Varianten in-place, Remix mit Image Weight Slider (1-100) |
| Playground AI | Auto-Advance Frame nach Generation, Instruct-to-Edit Feature |
| Krea.ai | Echtzeit-Canvas mit <50ms Feedback, Split-Screen Input/Output |
| NNGroup | 4-Stufen-Modell (Define/Explore/Refine/Export), Articulation Barrier bei AI Image Tools |
| HistoryPalette (arxiv) | 4 History-Views (Position/Concept/Time/Linear), kein kommerzielles Tool hat Tree-View |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| 1 | Wie gross soll der Chat-Panel sein? | A) Fixed 350px B) Resizable C) Collapsible | B) Resizable mit default 350px | Collapsible + Resizable (min 320px, max 480px). Eingeklappt: nur Icon-Leiste. |
| 2 | Soll der Undo-Stack persistiert werden (DB) oder nur Client-Session? | A) Client-only B) DB-persistiert | A) Client-only (einfacher, Session-bezogen) | Client-only |
| 3 | Wie verhaelt sich die Sidebar im Detail-View? | A) Versteckt B) Collapsed (nur Icons) C) Wie heute | A) Versteckt (max Platz fuer Detail-View) | Auto-collapsed (ist ohnehin default). Maximiert Canvas-Platz. |
| 4 | Soll der Chat-Agent eigene Prompt-Felder im Popover kennen oder sind Chat und Popovers komplett getrennt? | A) Getrennt B) Synchronisiert | A) Getrennt (einfacher, Out of Scope fuer V1) | Getrennt |
| 5 | Wie wird die Animated Transition technisch umgesetzt? | A) CSS View Transitions API B) Framer Motion C) Custom FLIP Animation | TBD (Architecture-Phase) | Architecture-Phase entscheidet |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-13 | Codebase | Aktuelles Layout: Sidebar + PromptArea (480px links) + GalleryGrid (rechts, Masonry) + LightboxModal (Overlay) |
| 2026-03-13 | Codebase | LangGraph Agent im Backend existiert mit Tool-System fuer Image/Prompt-Operationen |
| 2026-03-13 | Codebase | Reference-System: 5 Slots, Roles, Strengths, Drag-from-Gallery |
| 2026-03-13 | Web (Leonardo.ai) | Generation Frame auf Infinite Canvas, Focus Mode, 5 Canvas-Modi, Inpaint/Outpaint |
| 2026-03-13 | Web (Midjourney) | Light Editor vs Full Editor, In-Editor Queue, 1-Click Variation, Remix mit Prompt-Edit |
| 2026-03-13 | Web (Ideogram) | Gallery-first mit Canvas-Bridge, Remix mit Image Weight Slider (1-100), Magic Fill Inpainting |
| 2026-03-13 | Web (Playground AI) | Infinite Canvas, Auto-Advance Frame, Instruct-to-Edit, Multi-Model |
| 2026-03-13 | Web (Krea.ai) | Echtzeit Split-Screen Canvas, <50ms Feedback, AI Strength Slider |
| 2026-03-13 | Web (NNGroup) | 4 Stages: Define/Explore/Refine/Export, Articulation Barrier, Hybrid GUI+Text empfohlen |
| 2026-03-13 | Web (HistoryPalette) | Akademisch: 4 History-Views fuer AI Image Editing, kein kommerzielles Tool hat branching |
| 2026-03-13 | Web (General) | Canvas > Lightbox fuer Iteration, Lightbox > Canvas fuer Browsing, Hybrid ist optimal |

---

## Q&A Log

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Soll ich zuerst die essenziellen Fragen stellen oder eine tiefere Recherche machen? | Erst Recherche vertiefen |
| 2 | Welche Bereiche soll ich tiefer recherchieren? | Alle drei: Canvas-Patterns, Iterations-Flow, Variations-Management |
| 3 | Welche grundlegende Layout-Strategie resoniert am meisten? (Gallery+Canvas-Detail / Canvas-First / Hybrid) | Gallery + Canvas-Detail (A). Siblings als Thumbnails wie E-Commerce. Chat rechts, gross. Tools und Chat getrennt. |
| 4 | Wie soll die Beziehung zwischen Chat und direkten Actions sein? | Noch offen — erst Aktionen/Funktionen durchgehen. Tendenz: links Tools, rechts Chat, getrennt. Chat soll Tools haben und sich auf aktuelles Bild beziehen. |
| 5 | Welche Aktionen sollen in der Detail-View moeglich sein? | Variation (subtle/strong), img2img + Referenzen, Inpainting (OUT OF SCOPE), Outpainting (OUT OF SCOPE), Upscale. Prompt+Details collapsible. |
| 6 | Was soll der Chat koennen? | Bild beschreiben, Aenderungen prompten, Prompt verbessern. Agent braucht Bild als Kontext und Tools zum Triggern von Aktionen. |
| 7 | Reference-Tool im Popover: Collapsed-State + Chat-Integration? | Einfach halten. Chat kennt Referenzen NICHT. Popover zeigt ganzen State (Prompt, Strengths, Types, Thumbnails wie Status Quo). Kein Collapsed-State. |
| 8 | Wie soll die Detail-View die linke Seite organisieren? | Toolbar (Icons vertikal, ~48px) mit schwebendem Popover bei Tool-Klick. Wie Photoshop-Toolbar. |
| 9 | Soll Detail-View Fullscreen oder Overlay sein? | Fullscreen-Ersatz. Zurueck-Button fuehrt zur Gallery. |
| 10 | Wie soll das Reference-Tool im Popover funktionieren? | Groesseres Popover nur fuer dieses Tool. Zeigt ganzen State wie im aktuellen Prompt-Panel. |
| 11 | Sollen Varianten in der Gallery gruppiert werden? | Nein, flach wie heute. Visuelles Browsen ist agnostisch gegenueber Varianten-Herkunft. |
| 12 | Wie soll die Navigation Gallery <-> Detail funktionieren? | Animated Transition (Bild fliegt von Gallery-Position zur Detail-View, schrumpft zurueck). |
| 13 | Wie navigiert man zwischen Bildern in der Detail-View? | Siblings + Prev/Next. Zwei Ebenen: Siblings fuer Varianten einer Generation, Prev/Next fuer alle Gallery-Bilder. |
| 14 | Wo startet man eine komplett neue Generation? | Prompt-Panel bleibt in Gallery-View. Detail-View ist rein fuer Iteration. Neue Generation = zurueck zur Gallery. |
| 15 | Wie soll das neue Bild in der Detail-View erscheinen? | Ersetzt aktuelles Bild sofort. Altes wandert in Siblings-Leiste. Undo moeglich. |
| 16 | Chat-Nachrichten-Typen? | Text + Bild-Ergebnisse. Generiertes Bild erscheint als Thumbnail im Chat UND ersetzt Canvas. |
| 17 | Sofort-Replace + Undo als einheitliches Pattern fuer Chat UND Tools? | Ja. Einheitliches Undo-Pattern. Jede Aktion ersetzt sofort, Cmd+Z geht zurueck. |
| 18 | Chat-Init: Leer, mit Kontext oder mit Suggestions? | Mit Bild-Kontext (Modell, Prompt, Key-Params). Agent soll Clarification-Flow haben: bei unvollstaendigem Intent Rueckfragen stellen. |
| 19 | Inpainting/Outpainting, Transition-Details? | Inpainting/Outpainting OUT OF SCOPE. Transition-Details werden in Architecture/Implementation geklaert. |
| 20 | Wie gross soll das Chat-Panel sein? | Collapsible + Resizable: min 320px, max 480px. Eingeklappt nur Icon-Leiste. |
| 21 | Wie verhaelt sich die Sidebar im Detail-View? | Auto-collapsed beim Oeffnen der Detail-View (ist ohnehin default-collapsed). Maximiert Canvas-Platz. Sidebar klappt bei Rueckkehr zur Gallery wieder auf (falls vorher offen). |
| 22 | Wie sind Siblings definiert bei Folge-Generierungen? (3 Siblings, dann 4 neue vom ausgewaehlten) | Siblings = gleiche Generation (Batch). Folge-Generierungen erzeugen NEUE Sibling-Gruppe. Vorherige via Prev/Next oder Undo erreichbar. |
| 23 | Soll Variation technisch als img2img auf sich selbst (prompt_strength) funktionieren? | Ja. Variation = img2img mit aktuellem Bild als einzigem Input + prompt_strength Slider (0.0-1.0). Keine Reference-Roles. |
| 24 | Chat: Bild-Ergebnis als Thumbnail im Chat oder nur im Canvas? | Nur im Canvas (Sofort-Replace + Undo). Chat zeigt nur Textbestaetigung. |
| 25 | Clarification-Flow: Neues Feature oder existierend? | Existiert aehnlich im Backend-Agent (fragt z.B. nach T-Shirt Farbe). Guter Startpunkt, braucht neuen Prompt/Agent aber kein grundlegend neues Feature. |
