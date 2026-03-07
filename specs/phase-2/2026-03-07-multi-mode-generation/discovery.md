# Feature: Multi-Mode Generation (img2img + Upscale)

**Epic:** Multi-Mode Generation
**Status:** Ready
**Phase:** 2

---

## Problem & Solution

**Problem:**
- App unterstuetzt nur Text-zu-Bild Generierung (txt2img)
- Kein Weg, ein existierendes Bild als Ausgangspunkt fuer neue Generierungen zu nutzen
- Kein Upscaling fuer generierte Bilder (nur native Aufloesung vom Modell)
- Kein UX-Pattern fuer zukuenftige Modi (Edit, Video, etc.)

**Solution:**
- Mode-Selector (Segmented Control) in der Prompt-Area: erweiterbar fuer zukuenftige Modi
- img2img Modus: Source-Image hochladen + Prompt + Strength-Parameter
- Upscale: als eigener Modus in der Prompt-Area UND als Lightbox-Aktion
- Cross-Mode Interaktionen aus der Lightbox (img2img starten, Upscale ausfuehren)
- Einheitliche Galerie mit Filter-Chips nach Modus

**Business Value:**
- Breiterer Workflow: Nutzer koennen existierende Bilder transformieren und hochskalieren
- Iteratives Arbeiten: txt2img generieren → per img2img verfeinern → per Upscale hochskalieren
- Erweiterbare Architektur fuer zukuenftige Modi (Edit, Video, etc.)

---

## Scope & Boundaries

| In Scope |
|----------|
| Mode-Selector (Segmented Control) oben in der Prompt-Area |
| img2img Modus mit Source-Image Upload (Drag & Drop + Click + URL) |
| Strength-Slider mit Presets (Subtle/Balanced/Creative) |
| Upscale als Modus im Mode-Selector (Upload + Scale 2x/4x) |
| Upscale als Lightbox-Aktion (Popover mit 2x/4x) |
| Cross-Mode: "img2img" Button in Lightbox (setzt Bild als Source) |
| img2img Variation: laedt Source-Image (nicht generiertes Bild) in img2img-Modus |
| Source-Image Upload zu R2 (persistent unter `sources/{projectId}/{id}`) |
| DB-Erweiterung: `sourceImageUrl`, `generationMode`, `sourceGenerationId` |
| Galerie Filter-Chips: [Alle] [Text to Image] [Image to Image] [Upscale] |
| Dynamische Modell-Kompatibilitaet aus Schema (image/image_prompt Parameter erkennen) |
| Varianten-Count (1-4) auch bei img2img |

| Out of Scope |
|--------------|
| Edit / Inpainting (Canvas-UI mit Brush/Mask — separate Discovery) |
| Video-Generation |
| ControlNet / Depth / Canny Modi |
| Modell-spezifische img2img-Einstellungen ueber Strength hinaus |
| Batch-Upload (mehrere Source-Images gleichzeitig) |

---

## Current State Reference

> Existing functionality that will be reused (unchanged).

- Generation-Flow: Replicate API, pending/completed/failed States, fire-and-forget Verarbeitung
- Gallery Grid: Masonry-Layout mit Generation-Cards, Polling bei pending
- Lightbox Modal: Details-Panel, Navigation, Download, Variation, Delete, Favorite
- Model Schema Service: dynamisches Laden von Modell-Parametern aus Replicate OpenAPI Schema
- R2 Storage Client: Upload/Delete, public URL Generation
- Workspace State Context: `lib/workspace-state.tsx` (Variation-Flow) — wird erweitert fuer Cross-Mode Daten
- PromptTabs: Tabs fuer Prompt/History/Favorites
- ParameterPanel: dynamische Parameter aus Schema

---

## UI Patterns

### Reused Patterns

| Pattern Type | Component | Usage in this Feature |
|--------------|-----------|----------------------|
| Tabs (shadcn) | `components/ui/tabs.tsx` | PromptTabs bleiben (Prompt/History/Favorites) |
| Toast (Sonner) | -- | Fehler-Feedback bei Upload, Generation |
| Button Variants | shadcn Button | Lightbox-Aktionen (img2img, Upscale) |

### New Patterns

| Pattern Type | Description | Usage |
|--------------|-------------|-------|
| Popover (shadcn) | `npx shadcn@latest add popover` (neue Dependency) | Upscale Scale-Selector in Lightbox |

| Pattern Type | Description | Usage |
|--------------|-------------|-------|
| Segmented Control | Button-Group mit aktiven/inaktivem State | Mode-Selector (txt2img / img2img / Upscale) |
| Dropzone | Drag & Drop + Click + URL-Input Area | Source-Image Upload bei img2img und Upscale |
| Preset Slider | Slider mit klickbaren Preset-Labels | Strength-Parameter bei img2img |
| Filter Chips | Toggle-Buttons ueber der Galerie | Galerie-Filterung nach Modus |
| Mode Badge | Kleines Label/Icon auf Generation-Card | Zeigt Modus (T/I/U) im Galerie-Grid |

---

## User Flows

### Flow 1: img2img Generation

1. User wechselt Mode-Selector auf "Image to Image"
2. Prompt-Area zeigt: Dropzone + Motiv + Style + Strength-Slider + Parameters
3. User laedt Source-Image hoch (Drag & Drop, Click, oder URL einfuegen)
4. Dropzone zeigt Preview mit Dateiname, Dimensionen und Remove-Button
5. User gibt Prompt ein (Motiv + optional Style)
6. User stellt Strength ein (Presets oder Slider)
7. User waehlt Variant-Count (1-4)
8. User klickt "Generate"
9. Source-Image wird zu R2 hochgeladen (falls noch nicht geschehen)
10. Generation-Requests werden erstellt (wie txt2img, aber mit `image` Parameter)
11. Placeholder erscheinen in der Galerie
12. Ergebnisse erscheinen nach Completion mit img2img-Badge

### Flow 2: Upscale via Modus

1. User wechselt Mode-Selector auf "Upscale"
2. Prompt-Area zeigt: Dropzone + Scale-Selector (2x/4x) + Upscale-Button
3. Prompt-Felder, Strength-Slider, ParameterPanel und Model-Dropdown sind ausgeblendet
4. User laedt Bild hoch
5. User waehlt Scale (2x oder 4x, Default: 2x)
6. User klickt "Upscale"
7. Bild wird zu R2 hochgeladen, Upscale-Request gestartet
8. Ergebnis erscheint in der Galerie mit Upscale-Badge

### Flow 3: Upscale via Lightbox

1. User oeffnet ein Bild in der Lightbox
2. User klickt "Upscale" Button in den Lightbox-Aktionen
3. Popover erscheint mit Scale-Auswahl: [2x] [4x]
4. User waehlt Scale
5. Upscale startet, Lightbox kann geschlossen werden
6. Neues Bild erscheint in der Galerie mit Upscale-Badge und Referenz zum Original (`sourceGenerationId`)

### Flow 4: Cross-Mode — Lightbox zu img2img

1. User oeffnet ein txt2img-Bild in der Lightbox
2. User klickt "img2img" Button in den Lightbox-Aktionen
3. Mode-Selector wechselt auf "Image to Image"
4. Source-Image wird aus dem generierten Bild gesetzt (imageUrl als Source)
5. Prompt (Motiv + Style) wird uebernommen
6. Lightbox schliesst
7. User kann Prompt/Strength anpassen und neu generieren

### Flow 5: img2img Variation (aus Lightbox)

1. User oeffnet ein img2img-generiertes Bild in der Lightbox
2. User klickt "Variation" Button
3. Mode-Selector wechselt auf "Image to Image"
4. Das **Original-Source-Image** (nicht das generierte Bild) wird als Source gesetzt
5. Prompt wird uebernommen, Strength wird uebernommen
6. Lightbox schliesst
7. User kann Prompt/Strength anpassen und nochmal generieren

---

## UI Layout & Context

### Prompt-Area (linkes Panel, w-80)

**Element-Reihenfolge img2img (top-to-bottom):** ModeSelector → ImageDropzone → StrengthSlider → PromptTabs → Prompt Fields → Model → Variants → Generate

**Element-Reihenfolge upscale:** ModeSelector → ImageDropzone → ScaleSelector → Upscale Button. PromptTabs sind hidden (nicht destroyed).

```
+-------------------------------+
| [Text to Image] [Image to Image] [Upscale]   <- Segmented Control (neu)
|-------------------------------|
|                               |
| [Tabs: Prompt | History | Fav]  <- existiert
|                               |
| --- Nur bei img2img/upscale: ---
| +---------------------------+ |
| | Drop image here           | |
| | or click / paste URL      | |
| +---------------------------+ |
|                               |
| --- Nur bei img2img: --------
| Strength:                     |
| [Subtle] [Balanced] [Creative]|
| [========*===] 0.60           |
|                               |
| --- Nur bei txt2img/img2img: -
| Motiv: [__________________]  |
| Style: [__________________]  |
| Neg:   [__________________]  |  <- schema-driven (nur wenn Modell es unterstuetzt)
|                               |
| --- Nur bei txt2img/img2img: -
| Model: [FLUX 2 Pro       v]  |
| Parameters: [...]             |
|                               |
| Variants: [1] [2] [3] [4]    |  <- nur txt2img/img2img
| Scale: [2x] [4x]             |  <- nur upscale
|                               |
| [Generate] / [Upscale]       |
+-------------------------------+
```

### Galerie (rechtes Panel)

```
+------------------------------------------+
| [Alle] [Text to Image] [Image to Image] [Upscale]  <- Filter Chips (neu)
|------------------------------------------|
|                                          |
| +------+ +------+ +------+ +------+     |
| | img  | | img  | | img  | | img  |     |
| | [T]  | | [I]  | | [U]  | | [T]  |     |  <- Mode Badge
| +------+ +------+ +------+ +------+     |
|                                          |
+------------------------------------------+
```

### Lightbox-Aktionen (erweitert)

```
Bisherig:  [Variation] [Download] [Favorite] [Delete]

Bei txt2img/img2img Bild:
           [Variation] [img2img] [Upscale v] [Download] [Favorite] [Delete]
                          ^          ^
                          |          +-- Popover mit 2x/4x
                          +-- Wechselt Modus, setzt Source-Image

Bei Upscale Bild:
           [img2img] [Download] [Favorite] [Delete]
              ^
              +-- img2img auf hochskaliertem Bild (valider Workflow)
              Kein Re-Upscale, keine Variation
```

---

## UI Components

| Component | Type | States | Trigger |
|-----------|------|--------|---------|
| ModeSelector | Segmented Control | txt2img (default), img2img, upscale | Click auf Segment |
| ImageDropzone | Upload Area | empty (dashed border), drag-over (dashed, highlighted), uploading (progress), preview (solid border, thumbnail), error (retry) | Drop, Click, URL paste. Generate/Upscale button disabled bis preview-State. |
| StrengthSlider | Slider + Presets | 0.0-1.0, Presets: Subtle(0.3), Balanced(0.6), Creative(0.85) | Drag, Preset Click |
| ScaleSelector | Toggle Group | 2x (default), 4x | Click |
| FilterChips | Toggle Group (single-select) | Alle (default), Text to Image, Image to Image, Upscale. Nur ein Chip aktiv. | Click |
| ModeBadge | Badge/Label | T, I, U | -- (statisch) |
| UpscalePopover | Popover | closed, open mit 2x/4x Buttons | Click auf Upscale in Lightbox |
| LightboxImg2ImgButton | Button | idle | Click → Cross-Mode Flow (Lightbox hat immer Bild-Kontext) |

---

## Feature State Machine

### Generation Mode State

| State | Trigger | Next State | UI Feedback |
|-------|---------|------------|-------------|
| txt2img (default) | Click "Image to Image" | img2img | Dropzone + Strength erscheinen, Prompt bleibt |
| txt2img | Click "Upscale" | upscale | Nur Dropzone + Scale, Prompt ausgeblendet |
| img2img | Click "Text to Image" | txt2img | Dropzone + Strength verschwinden |
| img2img | Click "Upscale" | upscale | Prompt verschwindet, Strength verschwindet |
| upscale | Click "Text to Image" | txt2img | Dropzone verschwindet, Prompt erscheint |
| upscale | Click "Image to Image" | img2img | Prompt + Strength erscheinen |
| * | Lightbox "img2img" Click | img2img | Source-Image gesetzt, Prompt uebernommen |

### Image Upload State

| State | Trigger | Next State | UI Feedback |
|-------|---------|------------|-------------|
| empty | File drop / Click / URL paste | uploading | Progress indicator |
| uploading | Upload complete | preview | Thumbnail + Filename + Dimensions + Remove |
| uploading | Upload error | error | Error message, Retry option |
| preview | Click Remove | empty | Dropzone wieder leer |
| preview | Mode switch to txt2img | empty | Dropzone verschwindet |
| error | Retry | uploading | Progress indicator |

### Upscale (Lightbox) State

| State | Trigger | Next State | UI Feedback |
|-------|---------|------------|-------------|
| idle | Click Upscale Button | popover-open | Popover mit 2x/4x |
| popover-open | Click 2x oder 4x | processing | Popover schliesst, Toast "Upscaling..." |
| processing | Upscale complete | done | Neues Bild in Galerie, Toast "Upscale complete" |
| processing | Error | error | Toast mit Fehlermeldung |

---

## Business Rules

| Rule | Description |
|------|-------------|
| Modell-Kompatibilitaet | img2img zeigt nur Modelle deren Schema `image`, `image_prompt` oder `init_image` Parameter hat |
| Source-Image persistent | Source-Images werden immer zu R2 hochgeladen unter `sources/{projectId}/{uuid}.{ext}` |
| Source-Image Formate | Akzeptiert: PNG, JPG, JPEG, WebP. Max Groesse: 10MB |
| Strength Default | Default: 0.6 (Balanced). Range: 0.0-1.0 |
| Upscale immer 1 Bild | Upscale generiert immer genau 1 Ergebnis (kein Variant-Count) |
| Upscale Modell | Festes Modell fuer Upscale (Real-ESRGAN oder Clarity Upscaler), nicht user-waehlbar |
| Galerie Filter persistent | Filter-Auswahl wird pro Session beibehalten (nicht persistent in DB) |
| Empty Filter Message | "No {mode} generations yet" — adaptiert sich an gewaehlten FilterChip (z.B. "No Upscale generations yet") |
| Lightbox Variation bei img2img | Laedt das Original-Source-Image, nicht das generierte Bild |
| Cross-Mode Prompt | Bei "img2img" aus Lightbox wird der originale Prompt (Motiv+Style) uebernommen |
| Modus-Wechsel behaelt State | Wechsel zwischen Modi behaelt eingegebenen Prompt/Source-Image wenn moeglich (siehe State Persistence Matrix) |
| Modell Auto-Switch bei img2img | Wenn aktuelles Modell kein img2img unterstuetzt: Auto-Switch zum ersten kompatiblen Modell + Toast "Model switched to [X] (supports img2img)" |
| Negative Prompt schema-driven | Negative Prompt Feld bleibt schema-driven (nur sichtbar wenn Modell es unterstuetzt), gilt fuer alle Modi |
| Upscale Prompt Konvention | Upscale-Generierungen verwenden "Upscale {scale}x" als Prompt-Wert. Bei Lightbox-Upscale (mit sourceGenerationId): Original-Prompt des Quellbildes + " (Upscale {scale}x)" |
| Galerie Filter V1 client-side | Client-side Filter ist fuer V1 akzeptabel. Bei Performance-Problemen oder Pagination: auf Server-side Filter umstellen |

---

## Data Fields

| Field | Table | Type | Required | Validation |
|-------|-------|------|----------|------------|
| generationMode | generations | varchar(20) | Yes | "txt2img" / "img2img" / "upscale" |
| sourceImageUrl | generations | text | No | Nur bei img2img/upscale: R2 URL des Source-Images |
| sourceGenerationId | generations | uuid (FK) | No | Nur bei Lightbox-Upscale/img2img: Referenz zum Quell-Bild |
| strength | generations (in modelParams) | number | No | 0.0-1.0, nur bei img2img |
| upscaleScale | generations (in modelParams) | integer | No | 2 oder 4, nur bei upscale |

---

## WorkspaceState Extension (Cross-Mode)

Die bestehende `WorkspaceVariationState` wird erweitert fuer Cross-Mode Flows:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| targetMode | "txt2img" / "img2img" / "upscale" | Yes | Ziel-Modus nach Lightbox-Aktion |
| sourceImageUrl | string | No | URL des Source-Images (bei img2img aus Lightbox) |
| strength | number | No | Strength-Wert (bei img2img Variation) |
| sourceGenerationId | string | No | ID der Quell-Generation (fuer Referenz) |

**Vertrag Lightbox → PromptArea:** Lightbox setzt WorkspaceState mit obigen Feldern. PromptArea reagiert auf State-Aenderung: wechselt Modus, setzt Source-Image, befuellt Prompt.

---

## State Persistence Matrix (Mode Switch)

| Von | Nach | Prompt (Motiv/Style) | Source-Image | Strength | Model |
|-----|------|---------------------|-------------|----------|-------|
| txt2img | img2img | Behalten | -- (leer) | Default 0.6 | Behalten wenn kompatibel, sonst Auto-Switch |
| txt2img | upscale | Hidden (nicht geloescht) | -- (leer) | -- | -- |
| img2img | txt2img | Behalten | Hidden (nicht geloescht) | Hidden | Behalten |
| img2img | upscale | Hidden (nicht geloescht) | Behalten (uebernehmen) | Hidden | -- |
| upscale | txt2img | Wiederherstellen | Hidden (nicht geloescht) | -- | Wiederherstellen |
| upscale | img2img | Wiederherstellen | Behalten (uebernehmen) | Default 0.6 | Wiederherstellen wenn kompatibel |

**Prinzip:** State wird bei Mode-Switch nie zerstoert, nur versteckt. Beim Zurueckwechseln wird der vorherige State wiederhergestellt.

---

## Trigger-Inventory

| Trigger | Source | Pipeline | Result |
|---------|--------|----------|--------|
| Click "Generate" (img2img mode) | Prompt-Area | Upload Source → Create Generations → Replicate (mit image param) → R2 → DB | Neue Bilder in Galerie |
| Click "Upscale" (upscale mode) | Prompt-Area | Upload Source → Create Generation → Replicate (Upscale-Modell) → R2 → DB | Neues Bild in Galerie |
| Click Upscale in Lightbox | Lightbox Popover | Create Generation (sourceGenerationId) → Replicate → R2 → DB | Neues Bild in Galerie |
| Click "img2img" in Lightbox | Lightbox | Set mode + source image + prompt in WorkspaceState → Close Lightbox | Prompt-Area im img2img-Modus vorbefuellt |
| Click "Variation" on img2img result | Lightbox | Set mode img2img + original source image + prompt in WorkspaceState | Prompt-Area mit Source-Image des Originals |
| Filter Chip Click | Galerie | Client-side Filter auf `generationMode` | Galerie zeigt nur gefilterte Bilder |
| Mode Switch | Segmented Control | Client-side State Update | UI-Elemente ein-/ausblenden |

---

## Implementation Slices

### Slice 1: Mode-Selector + Prompt-Area Refactoring
- Segmented Control in Prompt-Area einfuegen
- Konditionelle UI-Elemente basierend auf Modus
- txt2img bleibt Default, Verhalten unveraendert
- **Abhaengigkeiten:** Keine
- **Testbar:** Mode-Switching aendert sichtbare UI-Elemente

### Slice 2: Image Upload (Dropzone + R2)
- ImageDropzone Component (Drag & Drop + Click + URL)
- Upload-Preview mit Remove-Button
- R2 Upload unter `sources/{projectId}/{uuid}.{ext}`
- Server Action fuer Source-Image Upload
- **Abhaengigkeiten:** Slice 1 (Dropzone wird in img2img/upscale-Modus angezeigt)
- **Testbar:** Bild hochladen, Preview sehen, entfernen, erneut hochladen

### Slice 3: img2img Generation
- Strength-Slider mit Presets
- DB-Schema Erweiterung: `generationMode`, `sourceImageUrl`, `sourceGenerationId`
- Server Action Erweiterung: img2img Generation mit `image` Parameter
- Modell-Kompatibilitaet dynamisch aus Schema erkennen
- Generation-Service Erweiterung: Source-Image als Replicate Input
- **Abhaengigkeiten:** Slice 1, Slice 2
- **Testbar:** img2img Generation mit Source-Image produziert transformiertes Bild

### Slice 4: Upscale Modus + Lightbox-Aktion
- Upscale-Modus UI (minimale Prompt-Area: nur Dropzone + Scale)
- Upscale Server Action (festes Modell, z.B. Real-ESRGAN)
- Lightbox Upscale-Button mit Popover (2x/4x)
- Neues Bild in Galerie mit `sourceGenerationId` Referenz
- **Abhaengigkeiten:** Slice 2, Slice 3 (DB-Schema)
- **Testbar:** Upscale via Modus und via Lightbox produziert hochskaliertes Bild

### Slice 5: Galerie Filter-Chips + Mode Badges
- Filter-Chips Komponente ueber der Galerie
- Mode Badge auf Generation-Cards
- `generationMode` Filter in Galerie-Query
- Filter-Chips immer sichtbar, inaktive Modi nicht ausgegraut
- **Abhaengigkeiten:** Slice 3 (generationMode in DB)
- **Testbar:** Filter-Chips filtern Galerie nach Modus, Badges zeigen korrekten Modus

### Slice 6: Cross-Mode Lightbox-Interaktionen
- "img2img" Button in Lightbox → setzt Source + Prompt + wechselt Modus
- "Variation" bei img2img-Bildern → laedt Original-Source-Image
- WorkspaceState Erweiterung fuer Cross-Mode Daten
- **Abhaengigkeiten:** Slice 3, Slice 4
- **Testbar:** Lightbox "img2img" wechselt Modus und befuellt Prompt-Area korrekt

---

## Q&A Log

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Soll ich erst eine umfassende Recherche machen oder direkt in Q&A einsteigen? | Recherche zuerst |
| 2 | Ist das eine Phase-2 Feature oder soll es in Phase 1 integriert werden? | Phase 2 (neue Phase) |
| 3 | Welches UX-Pattern fuer Mode-Switching bevorzugst du? (Segmented Control / Tabs / Sidebar) | Mode-Selector in Prompt-Area (Segmented Control) |
| 4 | Was ist der Scope? Nur img2img, oder auch Upscale/Edit? | img2img + Upscale. Edit/Inpaint spaeter als Lightbox-Aktion (separate Discovery). Upscale und Edit erstmal durchdenken. |
| 5 | Wie bewerten wir Upscale und Edit nach der Recherche? | img2img + Upscale in scope. Edit separat spaeter, als Lightbox-basierte Aktion. |
| 6 | Beim Upscale: Soll der auch im Segmented Control leben obwohl kein Prompt noetig? | Beides: eigener Modus im Segmented Control UND Lightbox-Aktion |
| 7 | Wie sollen Bilder aus verschiedenen Modi in der Galerie organisiert werden? | Eine Galerie mit Filter-Chips ([Alle] [txt2img] [img2img] [Upscale]) |
| 8 | Upscale via Lightbox: Was passiert mit dem Ergebnis? | Neues Bild in Galerie mit Referenz zum Original (sourceGenerationId) |
| 9 | Cross-Mode: Soll man aus der Lightbox direkt img2img starten koennen? | Ja, "img2img" Button in Lightbox setzt Bild als Source, uebernimmt Prompt |
| 10 | Soll bei einem img2img-Bild in der Lightbox "Variation" das Source-Image laden? | Ja, Variation bei img2img laedt das Original-Source-Image (nicht das generierte Bild) |
| 11 | Welche Modelle sollen img2img unterstuetzen? | Dynamisch aus Schema erkennen (alle die image/image_prompt Parameter haben) |
| 12 | Wie soll der Image-Upload funktionieren? | Drag & Drop + Click + URL-Input |
| 13 | Welche Scale-Optionen fuer Upscale? | 2x und 4x, Default 2x |
| 14 | Strength-Parameter: Wie anbieten? | Slider mit Presets (Subtle 0.3 / Balanced 0.6 / Creative 0.85) |
| 15 | Upscale-Modus UI: Wie aussehen wenn kein Prompt noetig? | Minimale UI: nur Upload + Scale + Button, Prompt ausgeblendet |
| 16 | Mode-Selector Labels: technisch oder user-freundlich? | Technische Labels: Text to Image / Image to Image / Upscale |
| 17 | Source-Image: R2 Upload (persistent) oder nur temporaer/client-side? | R2 Upload (persistent unter sources/) |
| 18 | img2img Variant Count: mehrere Varianten (1-4) moeglich? | Ja, wie bei txt2img (1-4) |
| 19 | Upscale via Lightbox: Scale-Selector oder immer Default? | Kleines Popover mit 2x/4x Auswahl |
| 20 | Filter-Chips: immer sichtbar oder erst wenn relevant? | Immer sichtbar |

---

## Context & Research

### Konkurrenz-Analyse: Mode-Switching Patterns

| Tool | Modi-Konzept | UI-Pattern |
|------|-------------|------------|
| AUTOMATIC1111 | Top-Level Tabs: txt2img / img2img / Extras | Tab-basiert, jeder Tab hat eigene Parameter-Area |
| Leonardo.ai | Separate Bereiche: Image Generation, Realtime Canvas, Canvas Editor, Motion, Upscaler | Sidebar-Navigation, jeder Modus = eigene Seite |
| Krea.ai | Unified Interface mit Modell-Selector | Ein Interface, Modi implizit durch Modell |
| ComfyUI | Node-basiert, kein expliziter Modus | Workflow-driven |

**Entscheidung:** Segmented Control in Prompt-Area — kompakt, kein Context-Switch, erweiterbar.

### Replicate API: img2img Capabilities

- FLUX-Modelle: `image_prompt` oder `image` Parameter, `prompt_strength` (0-1)
- FLUX braucht hoehere Strength (>0.95) als SD-Modelle fuer sichtbare Aenderungen
- Format: URL, Base64, Buffer — Replicate akzeptiert alle
- FLUX.2 Pro hat native img2img und editing capabilities

### Replicate API: Upscale Modelle

- Real-ESRGAN: 2x/4x Scale, GFPGAN Option fuer Gesichter
- Clarity Upscaler: 4x UltraSharp ESRGAN, sehr scharfe Ergebnisse
- Input: Bild + Scale-Faktor. Kein Prompt noetig.

### Zukunftskompatibilitaet: Edit/Inpaint

Edit/Inpaint wird spaeter als **Lightbox-Aktion** implementiert (nicht als Modus im Segmented Control). Grund: Canvas-UI mit Brush/Mask ist fundamental anders als die Prompt-Area. Trigger: Button in der Lightbox oeffnet Canvas-Modal. Die jetzt gebaute Infrastruktur (R2 Upload fuer Source-Images, sourceImageUrl in DB) wird dafuer wiederverwendet.
