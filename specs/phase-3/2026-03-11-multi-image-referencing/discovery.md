# Feature: Multi-Image Referencing

**Epic:** AI Image Studio - Phase 3
**Status:** Ready
**Phase:** 3

---

## Problem & Solution

**Problem:**
- img2img unterstuetzt nur 1 Source-Image — kein Weg, Motiv, Stil und Farben aus verschiedenen Quellen zu kombinieren
- Keine semantische Zuordnung: User kann nicht steuern ob ein Bild als Stil-Referenz, Inhalts-Referenz oder Struktur-Referenz dient
- Keine Inline-Referenzierung im Prompt ("nimm das Objekt von Bild A und den Stil von Bild B")
- Referenz-Bilder nicht persistent — bei jedem Session-Start erneut hochladen

**Solution:**
- Erweiterung des img2img-Modus: bis zu 5 Referenz-Bilder mit semantischen Rollen (Style, Content, Structure, Character, Color)
- Hybrid UX: Bild-Slots mit Rollen-Dropdown + optionale @1-@5 Inline-Referenzen im Prompt-Text
- Per-Image Strength-Dropdown mit 4 Stufen (Subtle/Moderate/Strong/Dominant) fuer ehrliche Einfluss-Kontrolle (FLUX.2 Edit hat keine nativen per-Image Weights)
- Persistente Referenz-Bibliothek pro Projekt (DB + R2)

**Business Value:**
- Ermoeglicht komplexe kreative Workflows: "Motiv von A, Stil von B, Farben von C"
- Grundlage fuer AI Image Studio Vision (Character Consistency, Compositing, Workflow Builder)
- Iteratives Arbeiten mit konsistenten Referenzen ueber Sessions hinweg

---

## Scope & Boundaries

| In Scope |
|----------|
| Bis zu 5 Referenz-Bilder pro Generation |
| 5 Rollen: Style, Content, Structure, Character, Color (per Dropdown) |
| Per-Image Strength-Dropdown mit 4 Stufen: Subtle, Moderate, Strong, Dominant |
| @1-@5 Inline-Referenz-Syntax im Prompt-Text (optional) + Hint-Banner fuer Discoverability |
| Vertikale Slot-Liste (1 Slot pro Zeile, 480px Panel) mit 80x80 Thumbnails |
| Farbcodierung pro Rolle: Style=Violett, Content=Blau, Structure=Gruen, Character=Amber, Color=Pink |
| Bildquellen: File Upload (Drag & Drop, Click, URL Paste) + Gallery (Drag & Drop + Lightbox-Button) |
| Persistente Referenz-Bilder pro Projekt (DB + R2) |
| Provenance: Lightbox zeigt verwendete Referenzen als Thumbnail-Reihe mit Rollen |
| Modell-Kompatibilitaet: Warnung wenn Modell weniger Images unterstuetzt als hochgeladen |
| Ersetzt Single-Image img2img: 1 Referenz mit Rolle "Content" = klassisches img2img |
| Einklappbare Referenz-Section wenn keine Bilder vorhanden |

| Out of Scope |
|--------------|
| IP-Adapter / ControlNet mit expliziten API-Parametern (spaetere Phase mit fal.ai) |
| Inpainting / Outpainting (Phase 4) |
| Background Removal / Compositing (Phase 5) |
| Character Consistency ueber Sessions/Generierungen hinweg (Phase 6) |
| Workflow Builder / Pipeline-Verkettung (Phase 7) |
| Frei benennbare Referenzen (@katze, @hintergrund) |
| Node-basierte Komposition |

---

## Current State Reference

> Existing functionality that will be reused (unchanged).

- Generation-Flow: Replicate API, pending/completed/failed States, fire-and-forget Verarbeitung
- Gallery Grid: Masonry-Layout mit Generation-Cards, Polling bei pending
- Lightbox Modal: Details-Panel, Navigation, Download, Variation, Delete, Favorite, img2img-Button, Upscale-Popover
- Mode-Selector: Segmented Control (txt2img / img2img / upscale) in Prompt-Area
- Image Upload: ImageDropzone mit Drag & Drop, Click-to-Browse, URL Paste (aktuell 1 Bild)
- Strength-Slider: Presets (Subtle/Balanced/Creative), 0-1 Range
- R2 Storage Client: Upload/Delete, public URL unter `sources/{projectId}/`
- Workspace State Context: `lib/workspace-state.tsx` fuer Cross-Mode Daten
- Model Schema Service: dynamische Parameter aus Replicate OpenAPI Schema
- DB Schema: `generationMode`, `sourceImageUrl`, `sourceGenerationId` in generations

---

## UI Patterns

### Reused Patterns

| Pattern Type | Component | Usage in this Feature |
|--------------|-----------|----------------------|
| ImageDropzone | `components/workspace/image-dropzone.tsx` | Basis fuer einzelne Reference-Slots (erweitert) |
| Mode-Selector | `components/workspace/mode-selector.tsx` | Unveraendert |
| Select (shadcn) | `components/ui/select.tsx` | Rollen-Dropdown + Strength-Dropdown pro Referenz-Slot |
| Badge (shadcn) | `components/ui/badge.tsx` | @-Nummer Badges + farbcodierte Rollen-Badges |
| Toast (Sonner) | -- | Warnungen bei Modell-Inkompatibilitaet |
| Lightbox | `components/lightbox/lightbox-modal.tsx` | Provenance-Anzeige + "Als Referenz nutzen" Button |

### New Patterns

| Pattern Type | Description | Rationale |
|--------------|-------------|-----------|
| Reference Slot | 80x80 Thumbnail + farbcodierte Rollen-Badge + Rollen-Dropdown + Strength-Dropdown + Remove-Button + @-Label als Card (1 pro Zeile) | Kein existierendes Pattern fuer multi-image mit Rollen |
| Reference Bar | Vertikale Slot-Liste ueber Prompt-Feldern, einklappbar, Collapsible Header mit Counter-Badge | Neues Layout-Element fuer Referenz-Bilder |
| Inline Reference Tag | @1-@5 Tokens im Prompt-Text, visuell hervorgehoben | Neues Pattern fuer Bild-Referenzen im Freitext |
| Ref Hint Banner | Info-Banner unter Prompt-Feldern: "Tipp: Nutze @1, @2, @3 im Prompt um Referenzen anzusprechen" | Discoverability fuer @-Syntax |

---

## User Flows

### Flow 1: Referenz-Bilder hochladen und Rollen zuweisen

1. User ist im img2img-Modus
2. Reference Bar zeigt [+ Add Reference] Button (oder leere Slots)
3. User klickt [+ Add Reference] → Datei-Dialog oeffnet / Drag & Drop Zone erscheint
4. User laedt Bild hoch (Drag & Drop, Click-to-Browse, oder URL Paste)
5. Slot zeigt: 80x80 Thumbnail + farbcodierte Rollen-Badge + Rollen-Dropdown (Default: "Content") + Strength-Dropdown (Default: "Moderate") + Label "@1" + Remove [x]
6. User waehlt Rolle aus Dropdown: Style / Content / Structure / Character / Color — Slot-Border und Badge wechseln Farbe
7. User waehlt Strength aus Dropdown: Subtle / Moderate / Strong / Dominant
8. User wiederholt Schritte 3-7 fuer weitere Bilder (bis max 5, vertikal gestapelt)

### Flow 2: Gallery-Bild als Referenz nutzen (Drag & Drop)

1. User hat Referenz-Slots sichtbar (img2img-Modus)
2. User zieht ein Bild aus der Gallery in einen leeren Referenz-Slot
3. Slot wird befuellt: Thumbnail des Gallery-Bildes + Default-Rolle "Content" + Strength "Moderate"
4. Bild-URL des Gallery-Bildes wird als Referenz-URL verwendet (kein Re-Upload noetig)

### Flow 3: Gallery-Bild als Referenz nutzen (Lightbox-Button)

1. User oeffnet ein Bild in der Lightbox
2. User klickt "Als Referenz nutzen" Button in den Lightbox-Aktionen
3. Falls nicht im img2img-Modus: Auto-Switch zu img2img
4. Bild wird in den naechsten freien Referenz-Slot gelegt (Rolle: Content, Strength: Moderate)
5. Lightbox schliesst
6. Falls alle 5 Slots belegt: Toast "Maximale Anzahl Referenzen erreicht (5). Entferne ein Bild."

### Flow 4: @image Inline-Referenzierung im Prompt

1. User hat 3 Referenz-Bilder geladen (@1 = Style, @2 = Content, @3 = Color)
2. User tippt im Motiv-Prompt: "Extrahiere nur das Gebaeude von @2 und stelle es im Stil von @1 dar, mit der Farbpalette von @3"
3. @1, @2, @3 werden visuell hervorgehoben im Prompt-Text (Badge/Tag-Styling)
4. Beim Generieren: Prompt wird mit @image1, @image2, @image3 an die API gesendet (Mapping @N → @imageN)

### Flow 5: Generieren mit Multi-Reference

1. User hat Referenz-Bilder + Prompt + Modell konfiguriert
2. User klickt "Generate"
3. Alle Referenz-Bilder werden (falls noetig) zu R2 hochgeladen
4. Prompt wird zusammengesetzt: Motiv + Style + Referenz-Kontext (Rollen + Strengths als Prompt-Hints)
5. API-Call mit allen Referenz-Bild-URLs + Prompt
6. Placeholder erscheinen in Gallery
7. Ergebnisse erscheinen mit img2img-Badge
8. In Lightbox: Provenance-Section zeigt alle verwendeten Referenzen

**Error Paths:**
- Upload-Fehler (Netzwerk, Dateityp, Groesse) → Toast: "Upload failed: {Grund}. Bitte erneut versuchen."
- Modell unterstuetzt weniger Bilder als hochgeladen → Warning-Banner ueber Slots: "Modell {Name} unterstuetzt max {N} Referenzen. Bilder @{N+1}-@{max} werden ignoriert." + betroffene Slots visuell gedimmt
- Modell unterstuetzt kein Multi-Image → Warning: "Modell {Name} unterstuetzt keine Referenz-Bilder. Wechsle zu FLUX 2 Pro oder einem kompatiblen Modell."
- Alle Slots belegt + User versucht weiteres Bild → Toast: "Maximale Anzahl Referenzen erreicht (5)"

---

## UI Layout & Context

### Reference Bar (NEU, oberhalb Prompt-Felder)

**Position:** Innerhalb der Prompt-Area (linkes Panel, 480px breit), zwischen Mode-Selector und Prompt-Feldern
**When:** Sichtbar im img2img-Modus. Einklappbar wenn keine Referenzen vorhanden.
**Wireframe:** Siehe `wireframes.md` — Screen "Prompt Area — img2img Mode"
**Design:** `.design/pencil-new.pen` (Pencil Design File)

**Beschreibung:** Vertikale Slot-Liste unterhalb des bestehenden Model Card Bereichs. Jeder Slot zeigt ein 80x80 Thumbnail mit farbkodierter Rollen-Badge, Rollen-Dropdown und Strength-Dropdown. Collapsible Header mit Counter-Badge [N/5] und [+ Add] Button. Unterhalb der letzten gefuellten Slot-Karte wird immer eine leere Drop-Zone angezeigt (solange < 5 Slots belegt). Nach den Slots folgen die bestehenden Prompt-Felder (Motiv, Style, Negative).

**Rollen-Farbschema:**
| Rolle | Border | Badge-BG | Text/Dot |
|-------|--------|----------|----------|
| Style | `#C084FC50` | `#F3E8FF` | `#9333EA` |
| Content | `#3B82F650` | `#DBEAFE` | `#3B82F6` |
| Structure | `#10B98150` | `#D1FAE5` | `#059669` |
| Character | `#F59E0B50` | `#FEF3C7` | `#D97706` |
| Color | `#EC489950` | `#FCE7F3` | `#DB2777` |

**Collapsed States:**
- Keine Referenzen: Header zeigt "References (0) [+ Add]", eingeklappt
- Mit Referenzen: Header zeigt "References (3/5)" mit Mini-Thumbnails als Vorschau

### Lightbox Provenance Section (NEU)

**Position:** Unterhalb der bestehenden Bild-Details in der Lightbox
**When:** Nur sichtbar wenn Generation Referenz-Bilder hatte
**Wireframe:** Siehe `wireframes.md` — Screen "Lightbox — With Provenance"

**Beschreibung:** Horizontale Thumbnail-Reihe der verwendeten Referenz-Bilder. Jedes Thumbnail zeigt @-Nummer, Rollen-Name und Strength-Stufe. Erscheint unterhalb der bestehenden Details (Prompt, Model, Size, Created).

### Lightbox Aktionen (erweitert)

**Wireframe:** Siehe `wireframes.md` — Screen "Lightbox — With Provenance"

**Beschreibung:** Neuer "Als Referenz" Button in der bestehenden Lightbox-Aktionsleiste. Position zwischen "Variation" und "img2img". Legt Bild in naechsten freien Referenz-Slot (Default: Content, Moderate). Auto-Switch zu img2img-Modus falls noetig. Bestehende Buttons (Variation, img2img, Upscale, Download PNG, Delete) bleiben unveraendert.

---

## UI Components & States

| Element | Type | Location | States | Behavior |
|---------|------|----------|--------|----------|
| ReferenceBar | Collapsible Section | Prompt-Area (480px Panel), zwischen Mode-Selector und Prompt-Feldern | `collapsed-empty` (keine Refs, eingeklappt), `collapsed-filled` (Refs vorhanden, eingeklappt, Mini-Thumbnails), `expanded` (aufgeklappt, volle Slots) | Toggle via Header-Click. Auto-expand bei erstem Bild-Upload. |
| ReferenceSlot | Composite Card (volle Breite, 1 pro Zeile) | Innerhalb ReferenceBar, vertikal gestapelt | `empty` (gestrichelte Umrandung, Drop-Zone), `drag-over` (Accent-farbige Hervorhebung, "Drop to add" Text), `uploading` (Progress), `ready` (80x80 Thumbnail + farbcodierte Controls), `dimmed` (Modell-Inkompatibel, wird ignoriert) | Drop, Click, URL Paste zum Befuellen. Remove zum Leeren. Farbcodierter Border passend zur Rolle. **Trailing Empty-Dropzone:** Unterhalb des letzten gefuellten Slots wird immer ein leerer Slot als Drop-Zone angezeigt (solange < 5 Slots belegt). Bietet persistentes Drag-Target fuer Gallery-Drag und File-Drop. |
| RoleDropdown | Select (shadcn) | Pro ReferenceSlot, mit farbigem Dot-Indikator | Style, Content, Structure, Character, Color | Default: Content. Aenderung aktualisiert Slot-Border-Farbe, Badge-Farbe und Dot-Farbe. |
| StrengthDropdown | Select (shadcn) | Pro ReferenceSlot, mit Gauge-Icon | Subtle, Moderate, Strong, Dominant | Default: Moderate. 4 diskrete Stufen statt Slider, da FLUX.2 Edit keine nativen per-Image Weights hat. Stufen werden als Prompt-Hints umgesetzt. |
| SlotLabel | Badge (shadcn, primary) | Pro ReferenceSlot, neben Rollen-Badge | @1, @2, @3, @4, @5 | Stabil: Label wird bei Erstellung vergeben und aendert sich nie. Bei Entfernung bleiben Labels der verbleibenden Slots (sparse: z.B. @2, @3 ohne @1). Neue Bilder fuellen die niedrigste freie Nummer. |
| RoleBadge | Badge (shadcn, secondary, farbcodiert) | Pro ReferenceSlot, neben @-Label | "Style", "Content", etc. in Rollen-Farbe | Zeigt aktuelle Rolle visuell an. Farbe entspricht Rollen-Farbschema. |
| AddReferenceButton | Button/Outline (shadcn) | Im Reference-Header rechts | `idle`, `disabled` (5 Slots belegt) | Klick oeffnet Datei-Dialog. Disabled wenn max erreicht. |
| UseAsReferenceButton | Button | Lightbox Aktions-Leiste | `idle`, `disabled` (5 Slots belegt: Tooltip "Alle 5 Slots belegt", oder nicht im img2img Modus: Tooltip "Wechsle zu img2img") | Klick legt Bild in naechsten freien Slot (niedrigste freie @-Nummer), schliesst Lightbox. Auto-Switch zu img2img falls noetig. |
| InlineRefTag | Plain Text (V1) | Im Prompt-Textarea | @1-@5 als normaler Text | V1: Kein visuelles Highlighting — @-Tokens werden als Plain Text getippt und serverseitig erkannt. RefHintBanner sorgt fuer Discoverability. V2 (spaeter): Visuelles Highlighting via Overlay oder ContentEditable. |
| RefHintBanner | Info-Banner (accent bg) | Unter Prompt-Feldern, innerhalb Prompt-Section | Sichtbar wenn Referenz-Bilder geladen sind UND nicht dismissed, dismissible | Dynamischer Text mit tatsaechlichen sparse @-Nummern: z.B. "Tipp: Nutze @1, @3, @5 im Prompt um Referenzen anzusprechen". Dismiss [x] Button, Zustand in localStorage persistiert. Verbessert Discoverability der @-Syntax. |
| ProvenanceRow | Thumbnail-Reihe | Lightbox Details-Panel | Sichtbar wenn Generation Referenzen hatte | Zeigt Thumbnails + Rollen + Strength-Stufen der verwendeten Referenzen. |
| CompatibilityWarning | Alert/Banner | Ueber ReferenceBar | `hidden`, `partial` (Modell-Limit ueberschritten), `no-support` (Modell hat kein img2img) | Zeigt Warnung + dimmt betroffene Slots. Bei `no-support`: Actionable Link "[Switch to FLUX 2 Pro]" der direkt das Modell wechselt + Link zum Model Browser. Generate disabled bis kompatibles Modell gewaehlt. |

---

## Feature State Machine

### Reference Bar State

| State | UI | Available Actions |
|-------|----|--------------------|
| `collapsed-empty` | Eingeklappt, "References (0) [+ Add]" | Aufklappen, Add Reference |
| `collapsed-filled` | Eingeklappt, Mini-Thumbnails sichtbar, "References (3/5)" | Aufklappen |
| `expanded` | Alle Slots sichtbar mit vollen Controls | Add/Remove Reference, Change Role, Adjust Strength, Collapse |

### Reference Slot State

| State | UI | Available Actions |
|-------|----|--------------------|
| `empty` | Gestrichelte Umrandung, Drop-Zone Hint | File Drop, Click Browse, URL Paste, Gallery Drag |
| `drag-over` | Accent-farbige Hervorhebung der gestrichelten Umrandung, Text "Drop to add" | Drop to complete, DragLeave to revert |
| `uploading` | Progress Indicator | Cancel (optional) |
| `ready` | 80x80 Thumbnail + @Label + farbcodierte Rollen-Badge + Rollen-Dropdown + Strength-Dropdown + Remove | Change Role, Change Strength, Remove |
| `dimmed` | Ausgegraut mit Warning-Icon, Label "Wird ignoriert" | Remove (um Platz fuer priorisierte Bilder zu schaffen) |
| `error` | Fehlermeldung + Retry | Retry Upload, Remove |

### Transitions

| Current State | Trigger | UI Feedback | Next State | Business Rules |
|---------------|---------|-------------|------------|----------------|
| `collapsed-empty` | Click [+ Add] | Datei-Dialog oeffnet, Bar expandiert | `expanded` | -- |
| `collapsed-empty` | Click Header | Bar expandiert | `expanded` | -- |
| `collapsed-filled` | Click Header | Volle Slots sichtbar | `expanded` | -- |
| `expanded` | Click Header | Nur Mini-Thumbnails | `collapsed-filled` / `collapsed-empty` | Je nach Anzahl Refs |
| Slot `empty` | DragEnter (File oder Gallery-Card) | Accent-Highlight, "Drop to add" | Slot `drag-over` | -- |
| Slot `drag-over` | DragLeave | Zurueck zu Drop-Zone Hint | Slot `empty` | -- |
| Slot `drag-over` | Drop (File oder Gallery-Card) | Upload startet | Slot `uploading`, Bar `expanded` | Max 5 Bilder, Formate PNG/JPG/JPEG/WebP, max 10MB |
| Slot `empty` | Click / URL Paste | Upload startet | Slot `uploading`, Bar `expanded` | Max 5 Bilder, Formate PNG/JPG/JPEG/WebP, max 10MB |
| Slot `uploading` | Upload complete | Thumbnail + Controls | Slot `ready` | Bild persistent in R2 + DB |
| Slot `uploading` | Upload error | Fehlermeldung | Slot `error` | Toast mit Fehlergrund |
| Slot `ready` | Click Remove [x] | Slot verschwindet, verbleibende Labels bleiben stabil (sparse) | Slot entfernt, KEINE Re-Nummerierung | DB-Eintrag bleibt (Referenz-Bibliothek), nur Slot-Zuweisung entfernt. Neue Bilder fuellen niedrigste freie Nummer. |
| Slot `ready` | Modell gewechselt, Slot-Nr > Modell-Limit | Warning-Icon, Ausgegraut | Slot `dimmed` | -- |
| Slot `dimmed` | Modell gewechselt zu kompatiblerem | Warning entfernt | Slot `ready` | -- |
| Slot `dimmed` | Click Remove | Slot entfernt | Slot entfernt | -- |
| Any Slot | Mode Switch zu txt2img | Slots hidden (nicht destroyed) | State preserved | Referenzen bleiben erhalten fuer Rueckwechsel |
| Any Slot | Mode Switch zu upscale | Slots hidden (nicht destroyed) | State preserved | -- |

---

## Business Rules

| Rule | Description |
|------|-------------|
| Max 5 Referenzen | Maximal 5 Referenz-Bilder gleichzeitig pro Generation |
| 5 Rollen | Style, Content, Structure, Character, Color — jede Rolle mehrfach verwendbar (keine Exklusivitaet) |
| Default-Rolle | Neue Referenz bekommt Default-Rolle "Content" |
| Default-Strength | Neue Referenz bekommt Default-Strength "Moderate" |
| Strength-Stufen | 4 diskrete Level: Subtle, Moderate, Strong, Dominant. Werden als Prompt-Hints an FLUX.2 Edit kommuniziert (z.B. "with subtle/moderate/strong/dominant influence from @image1 style"). Kein numerischer Slider, da Backend keine praezisen Weights unterstuetzt. |
| Slot-Labels | Stabil: @1 bis @5 werden bei Erstellung vergeben und aendern sich nie. Bei Entfernung bleiben Labels der verbleibenden Slots (sparse, z.B. @2, @3 ohne @1). Neue Bilder fuellen die niedrigste freie Nummer. Kein Re-Numbering — schuetzt @-Referenzen im Prompt vor stillem Verweisbruch. |
| Upload-Formate | PNG, JPG, JPEG, WebP. Max 10MB pro Bild. |
| Modell-Kompatibilitaet | Warnung wenn Modell weniger Images unterstuetzt als geladen. Betroffene Slots dimmed. Generierung trotzdem moeglich (ueberschuessige ignoriert). |
| Kein Multi-Image Support | Wenn Modell gar kein img2img unterstuetzt: Warning-Banner mit actionable Link "[Switch to FLUX 2 Pro]" + Link zum Model Browser anzeigen. Referenz-Slots sichtbar aber Generate disabled. Ein-Klick Recovery-Path statt nur Text-Hinweis. |
| Rueckwaertskompatibilitaet | 1 Referenz mit Rolle "Content" = identisch zum bisherigen Single-Image img2img |
| Prompt-Mapping | @1-@5 im Prompt werden zu @image1-@image5 fuer die FLUX.2 Edit API gemappt |
| Gallery-Bilder als Referenz | Nutzen die existierende imageUrl, kein Re-Upload noetig |
| Persistenz | Referenz-Bilder pro Projekt in DB gespeichert, beim naechsten Oeffnen verfuegbar |
| Provenance | Jede Generation speichert die verwendeten Referenzen (URLs, Rollen, Strengths) in den Metadaten |
| Mode-Switch Erhalt | Referenz-Bilder bleiben bei Mode-Switch erhalten (hidden, nicht destroyed) |
| Strength als Prompt-Hint | Da FLUX.2 Edit keine nativen per-Image Weights hat: Strength-Stufe wird als Prompt-Instruktion eingebaut (z.B. "with subtle/moderate/strong/dominant influence from @image1 style"). 4 diskrete Stufen verhindern Precision-Illusion. |
| Rollen-Farbcodierung | Jede Rolle hat eine eigene Farbe fuer Border, Badge und Dot-Indikator. Verbessert Scanbarkeit bei mehreren Referenzen. |
| Panel-Breite | Prompt-Area Panel ist 480px breit (statt 320px w-80) um genug Platz fuer Referenz-Slots mit allen Controls zu bieten. |

---

## Data

### Reference Images (NEU, eigene Tabelle oder JSONB)

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `id` | Yes | UUID | Primaerschluessel |
| `projectId` | Yes | FK → projects | Zuordnung zum Projekt |
| `imageUrl` | Yes | URL String | R2 URL oder Gallery-Image URL |
| `originalFilename` | No | String | Dateiname bei Upload, null bei Gallery-Referenz |
| `width` | No | Integer > 0 | Bildbreite in Pixel |
| `height` | No | Integer > 0 | Bildhoehe in Pixel |
| `sourceType` | Yes | "upload" / "gallery" | Herkunft des Bildes |
| `sourceGenerationId` | No | FK → generations | Nur bei Gallery-Referenz: Link zur Quell-Generation |
| `createdAt` | Yes | Timestamp | Erstellungszeitpunkt |

### Generation Reference Assignments (NEU, pro Generation)

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `generationId` | Yes | FK → generations | Zuordnung zur Generation |
| `referenceImageId` | Yes | FK → reference_images | Zuordnung zum Referenz-Bild |
| `role` | Yes | "style" / "content" / "structure" / "character" / "color" | Semantische Rolle |
| `strength` | Yes | "subtle" / "moderate" / "strong" / "dominant" | Einfluss-Stufe (wird als Prompt-Hint umgesetzt) |
| `slotPosition` | Yes | 1-5 (Integer) | Position im Slot = @-Nummer |

### Generations Tabelle (AENDERUNG)

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `sourceImageUrl` | Deprecated | -- | Ersetzt durch Reference Assignments. Migration: bestehende sourceImageUrl-Werte als einzelne "Content" Referenz migrieren. |

---

## Implementation Slices

### Dependencies

```
Slice 1 (DB Schema) --> Slice 2 (DB Queries + Service)
                    --> Slice 3 (Reference Upload)
                            |
                            v
                     Slice 4 (Reference Bar UI)
                            |
                     Slice 5 (@image Prompt Syntax)
                            |
                     Slice 6 (Generation Integration)
                            |
                     Slice 7 (Gallery-to-Reference)
                            |
                     Slice 8 (Provenance Lightbox)
                            |
                     Slice 9 (Migration + Cleanup)
```

### Slices

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| 1 | DB Schema: Reference Tables | `reference_images` + `generation_references` Tabellen, Drizzle Migration, Indexes | Migration laeuft, Tabellen existieren in DB | -- |
| 2 | DB Queries + Reference Service | CRUD fuer Reference Images, Query fuer Generation References, Service-Layer | Unit Tests: Create/Read/Delete Reference, Query by Project/Generation | Slice 1 |
| 3 | Reference Upload Action | Server Action fuer Referenz-Bild Upload (File + URL), R2 Storage, Validierung (Format, Groesse) | Upload via Action, Bild in R2, Eintrag in DB | Slice 1, Slice 2 |
| 4 | Reference Bar UI | ReferenceBar Component, ReferenceSlot (80x80 Thumb, farbcodiert), RoleDropdown, StrengthDropdown (4 Stufen), RoleBadge, AddButton, RefHintBanner (dismissible), Collapsible (shadcn: `npx shadcn add collapsible` als Pre-Requisite), Trailing Empty-Dropzone, 480px Panel | Slots hinzufuegen/entfernen, Rolle aendern, Strength-Stufe waehlen, Collapse/Expand, stabile Labels (kein Re-Numbering) | Slice 3 |
| 5 | @image Prompt Syntax | @1-@5 Token-Erkennung im Prompt-Text (V1: Plain Text, kein visuelles Highlighting), Mapping zu @imageN. V2 (spaeter): Visuelles Highlighting | @-Tokens korrekt an API gemappt, RefHintBanner zeigt verfuegbare @-Nummern | Slice 4 |
| 6 | Generation Integration | Multi-Reference in generateImages Action, Prompt-Komposition mit Rollen+Strengths, FLUX.2 Edit API-Mapping, Modell-Kompatibilitaetspruefung | Multi-Reference Generation produziert Bild, Warnung bei Inkompatibilitaet | Slice 2, Slice 4, Slice 5 |
| 7 | Gallery-to-Reference | "Als Referenz nutzen" Button in Lightbox + Drag & Drop aus Gallery in Slot. Drag-Infrastruktur: Gallery Cards `draggable` machen, Custom `dataTransfer` Format fuer Generation-Daten, Unterscheidung native File-Drop vs. Intra-App-Drag in Reference-Slot. Auto-Switch zu img2img bei Lightbox-Button. | Lightbox-Button legt Bild in Slot, Gallery-Bild per Drag in Slot gezogen | Slice 4 |
| 8 | Provenance in Lightbox | Thumbnail-Reihe mit Rollen + Strengths in Lightbox Details, Query Generation References | Lightbox zeigt verwendete Referenzen korrekt an | Slice 2, Slice 6 |
| 9 | Migration + Cleanup | Bestehende sourceImageUrl-Werte als "Content" Referenz migrieren, alte Felder deprecaten | Alte img2img-Generierungen zeigen korrekte Referenz in Lightbox | Slice 1, Slice 6, Slice 8 |

### Recommended Order

1. **Slice 1:** DB Schema — Fundament fuer alle weiteren Slices
2. **Slice 2:** DB Queries + Service — Datenzugriff fuer UI und Generation
3. **Slice 3:** Reference Upload — Server-Side Upload bevor UI gebaut wird
4. **Slice 4:** Reference Bar UI — Kernkomponente der User Experience
5. **Slice 5:** @image Prompt Syntax — Prompt-Enhancement
6. **Slice 6:** Generation Integration — Alles zusammenfuehren, tatsaechlich generieren
7. **Slice 7:** Gallery-to-Reference — Workflow-Erweiterung
8. **Slice 8:** Provenance in Lightbox — Nachvollziehbarkeit
9. **Slice 9:** Migration + Cleanup — Backwards Compatibility

---

## Context & Research

### Similar Patterns in Codebase

| Feature | Location | Relevant because |
|---------|----------|------------------|
| ImageDropzone (Single Upload) | `components/workspace/image-dropzone.tsx` | Basis-Pattern fuer ReferenceSlot Upload-Logik |
| StrengthSlider | `components/workspace/strength-slider.tsx` | Nicht direkt wiederverwendet — stattdessen Select-Dropdown mit 4 Stufen. Preset-Konzept (Subtle/Balanced/Creative) inspiriert die Strength-Stufen. |
| Mode-Selector + State Persistence | `components/workspace/prompt-area.tsx` | Mode-Switch Logik und State-Erhalt Pattern |
| WorkspaceVariationState | `lib/workspace-state.tsx` | Cross-Mode Datenfluss (Lightbox → Prompt-Area) |
| Model Schema Service | `lib/services/model-schema-service.ts` | Erkennung von img2img-Feldern, erweiterbar fuer Multi-Image Detection |
| Upload Source Image Action | `app/actions/generations.ts` | Bestehende Upload-Logik fuer R2 |
| Lightbox Actions | `components/lightbox/lightbox-modal.tsx` | Erweiterbar um "Als Referenz nutzen" Button |
| Generation Service | `lib/services/generation-service.ts` | buildReplicateInput() erweitern fuer Multi-Image |

### Web Research

| Source | Finding |
|--------|---------|
| FLUX.2 Edit API (fal.ai/Replicate) | Bis zu 8 Input Images via `image_urls` Array, @image1-@image8 Syntax im Prompt, natuerliche Sprache fuer Rollensteuerung |
| FLUX General (fal.ai) | Explizite IP-Adapter + ControlNet Parameter mit per-Source `scale` — relevanter fuer spaetere Phase mit fal.ai |
| Midjourney V7 | --sref (Style), --cref (Character), --oref (Omni) mit individuellen Weights — goldener Standard der UX |
| Leonardo.ai | Dropdown pro Bild fuer Guidance Type (Style/Content/Character/Edge/Depth/Pose) + Strength-Stufen |
| getimg.ai | Typ-Exklusivitaet (max 1 pro Typ), bis zu 3 Referenzen, 120 Kombinationen — gutes UX-Guardrail |
| IP-Adapter (Forschung) | Decoupled Cross-Attention: separate Attention fuer Text- und Bild-Embeddings. Ermoeglicht Style/Content-Trennung auf Embedding-Ebene. |
| FLUX Kontext | Multi-Image via Chained Latents (sequentiell) oder Stitched Canvas (raeumlich). Experimentell. |
| Adobe Firefly | Style Reference + Structure Reference gleichzeitig kombinierbar via API |
| Gemini Image Generation | Bis zu 14 Referenz-Bilder, Multi-Image Fusion |

---

## AI Image Studio Roadmap (Kontext)

| Phase | Name | Kern-Features |
|-------|------|---------------|
| 0 | E2E Generate & Persist | txt2img, Gallery, Lightbox, Prompt Builder (abgeschlossen) |
| 1 | Quality Improvements | Structured Prompt, Builder Pro, Templates, History (in Arbeit) |
| 2 | Multi-Mode Generation | img2img (Single), Upscale, Mode-Selector (abgeschlossen) |
| **3** | **Multi-Image Referencing** | **Dieses Feature** |
| 4 | Inpainting & Outpainting | Bereiche markieren + neu generieren, Canvas erweitern |
| 5 | Background & Compositing | Background Removal, Replacement, Layer-Compositing |
| 6 | Character Consistency & Serien | Character Reference ueber Generierungen, Batch mit gleichem Style |
| 7 | Workflow Builder | Node-basierte Pipeline, Operationen verketten |

**Provider-Strategie:** fal.ai als zweiter Provider wird hinzugefuegt wenn ein Feature es erfordert (vermutlich Phase 4-6 fuer IP-Adapter/ControlNet). Keine separate Provider-Phase.

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| 1 | Soll die @-Syntax im Prompt per Regex erkannt werden oder ueber ein Autocomplete/Mention-System? | A) Regex B) Mention-System wie @-Mentions in Chat | A) Regex — einfacher, reicht fuer @1-@5 | -- |
| 2 | Wie genau werden Strengths an FLUX.2 Edit kommuniziert (keine native API-Parameter)? | A) Prompt-Hints ("with strong/subtle influence") B) Zusammen mit Rollen in System-Instruktion C) Ignorieren, nur Rollen nutzen | B) System-Instruktion | **Entschieden:** 4 diskrete Stufen (Subtle/Moderate/Strong/Dominant) als Prompt-Hints in System-Instruktion. Kein numerischer Slider. |
| 3 | Sollen Referenz-Bilder eine "Reference Library" pro Projekt bilden (alle je hochgeladenen Bilder browsebar)? | A) Ja, Library mit Wiederverwendung B) Nein, nur aktive Slots | A) Library — natuerliche Evolution | Spaetere Phase |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-11 | Codebase | Phase 2 (Multi-Mode) vollstaendig implementiert: img2img mit 1 Source, Upscale, Mode-Selector, Cross-Mode Flows |
| 2026-03-11 | Codebase | ImageDropzone unterstuetzt Drag & Drop + Click + URL Paste — wiederverwendbar fuer Reference Slots |
| 2026-03-11 | Codebase | Model Schema Service erkennt dynamisch img2img-Felder (image, image_prompt, init_image) — erweiterbar fuer Multi-Image Detection |
| 2026-03-11 | Codebase | Replicate als einziger Provider, FLUX 2 Pro als leistungsfaehigstes Modell |
| 2026-03-11 | Web | FLUX.2 Edit unterstuetzt bis zu 8 Input Images mit @image1-@image8 Syntax — ideale Basis fuer Phase 3 |
| 2026-03-11 | Web | Industrie-Standard-Taxonomie: Style, Content, Structure, Character Reference — etabliert durch Midjourney, Leonardo, Adobe |
| 2026-03-11 | Web | IP-Adapter ermoeglicht Style/Content-Trennung via Decoupled Cross-Attention — relevant fuer spaetere fal.ai Integration |
| 2026-03-11 | Web | fal.ai FLUX General bietet explizite IP-Adapter + ControlNet Parameter — beste Option fuer zukuenftige Phase mit parametrischer Kontrolle |
| 2026-03-11 | Web | Per-Image Weights sind bei FLUX.2 Edit NICHT nativ vorhanden — muessen als Prompt-Hints implementiert werden |
| 2026-03-11 | Web | Leonardo.ai/getimg.ai bieten die beste UX-Referenz: Rollen-Dropdowns + Strength-Slider pro Bild |
| 2026-03-11 | UX Review | Panel von 320px auf 480px verbreitert — 3 Slots pro Zeile bei 320px nicht machbar mit allen Controls |
| 2026-03-11 | UX Review | Vertikale Slot-Liste (1 pro Zeile) statt horizontales 3er-Grid — besser lesbar, mehr Platz fuer Dropdowns |
| 2026-03-11 | UX Review | Strength: 4 diskrete Stufen (Subtle/Moderate/Strong/Dominant) statt 0-100% Slider — verhindert Precision-Illusion bei Prompt-basiertem Backend |
| 2026-03-11 | UX Review | Farbcodierung pro Rolle (Violett/Blau/Gruen/Amber/Pink) — verbessert Scanbarkeit bei mehreren Referenzen |
| 2026-03-11 | UX Review | @-Reference Hint-Banner unter Prompt-Feldern fuer Discoverability der @1-@5 Syntax |
| 2026-03-11 | UX Review | Model Card an oberster Position im Panel (vor Mode-Selector) |
| 2026-03-11 | Design | Wireframe in Pencil erstellt: `.design/pencil-new.pen` — shadcn Komponenten (Tabs, Select, Badge, Button, Input, Textarea) |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| 1 | Soll ich zuerst eine umfassende Recherche durchfuehren (Codebase, Git-History, Web) oder direkt Q&A? | Recherche zuerst |
| 2 | Welchen technischen Ansatz findest du am vielversprechendsten: FLUX.2 Edit, FLUX General (IP-Adapter), Hybrid, oder alle offen lassen? | Frage zur Machbarkeit: Ist die Standard-Taxonomie mit FLUX.2 Edit komplett umsetzbar? Sollten andere APIs angebunden werden? → Antwort: FLUX.2 Edit teilweise (via Prompt), volle Taxonomie braucht fal.ai (spaeter). OpenRouter bietet keine Image-APIs. fal.ai ist beste Option als 2. Provider. |
| 3 | Soll der Scope auf Multi-Image fokussiert bleiben oder Editor-Vision mit-discovern? | Roadmap + Feature: Erst Editor-Roadmap skizzieren, dann Multi-Image als erstes Feature im Detail discovern. |
| 4 | Was ist die Vision fuer den AI Native Editor: Design-Tool, AI Image Studio, Workflow-Builder, oder eigene Vision? | AI Image Studio (wie Leonardo/Krea) mit Option auf Workflow-Builder spaeter. |
| 5 | Wer ist die primaere Zielgruppe? | Erst selbst und Partnerin, dann ggf. oeffnen. Nutzung: Beides (Print-on-Demand/E-Commerce + kreativ). |
| 6 | Welche Workflows sind am relevantesten? (Mehrfachauswahl) | Alle relevant (Product Shot, Style Transfer, Character Consistency, Design Iteration). Umfassendes Studio bauen, aber mit Multi-Image starten. |
| 7 | Passt die Roadmap-Reihenfolge (Phase 3-9)? | Multi-Provider als eigene Phase bringt keinen Mehrwert — Provider-Integration passiert wenn Feature es braucht. Phase 9 (Export) entfernen. Sonst passt es. |
| 8 | Wie soll die Multi-Image UX grundlegend funktionieren? | Hybrid: Upload-Slots mit Rollen-Dropdown + @image Inline-Referencing im Prompt. |
| 9 | Wie viele Referenz-Bilder maximal? | 5 Bilder |
| 10 | Welche Rollen-Labels sollen verfuegbar sein? | Erweitert: Style + Content + Structure + Character + Color (5 Rollen) |
| 11 | Eigener Modus oder Erweiterung von img2img? | Erweiterung von img2img (kein neuer Modus) |
| 12 | Wie soll die @image-Referenz im Prompt funktionieren? | Als optionaler Zusatz: Rollen-Dropdown gibt Richtung vor, @-Referenz im Prompt verfeinert (z.B. "nur Objekt XYZ von @1"). Technisch moeglich mit FLUX.2 Edit. |
| 13 | Soll jedes Bild einen individuellen Strength-Slider haben? | Ja, pro Bild — aber als Dropdown mit 4 Stufen (Subtle/Moderate/Strong/Dominant) statt 0-100% Slider, da FLUX.2 Edit keine nativen per-Image Weights hat. Vermeidet Precision-Illusion. (UX-Review Entscheidung) |
| 14 | Sollen Bilder auch aus der Gallery als Referenz nutzbar sein? | Ja, Gallery + Upload (Drag & Drop aus Gallery + Button in Lightbox) |
| 15 | Wie sollen die Referenz-Slots in der UI angeordnet sein? | Vertikal, 1 Slot pro Zeile, UEBER den Prompt-Feldern. Panel auf 480px verbreitert. 80x80 Thumbnails. Farbcodierung pro Rolle. (UX-Review Entscheidung — 3 pro Zeile bei 320px war zu eng) |
| 16 | Sollen Referenz-Bilder persistent gespeichert werden? | Ja, pro Projekt in DB — eroeglicht Reference Library spaeter |
| 17 | Was passiert mit dem bestehenden Single-Image img2img? | Ersetzt durch Multi-Reference: 1 Referenz mit "Content" Rolle = klassisches img2img |
| 18 | Wie soll Gallery-to-Reference funktionieren? | Beides: Drag & Drop aus Gallery UND Button in Lightbox |
| 19 | Sollen Referenzen in der Lightbox der fertigen Generation angezeigt werden? | Ja, als Thumbnail-Reihe mit Rollen und Strengths |
| 20 | Was bei Modell-Inkompatibilitaet (weniger Bilder als hochgeladen)? | Warnung + automatisch begrenzen (betroffene Slots dimmed) |
| 21 | Wie soll die @image-Syntax konkret aussehen? | @1, @2, @3, @4, @5 (nummern-basiert, mappt auf FLUX.2 @image1-@image5) |
