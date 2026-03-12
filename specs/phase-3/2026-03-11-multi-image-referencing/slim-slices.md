# Slim Slice Decomposition

**Feature:** Multi-Image Referencing
**Discovery-Slices:** 9 grobe Slices
**Atomare Slices:** 17 Slices nach Decomposition
**Stack:** TypeScript (Next.js 16 App Router + Drizzle ORM 0.45 + React 19 + Vitest)

---

## Dependency Graph

```
slice-01 (DB Schema + Migration)
    |
    +---> slice-02 (Reference Queries)
    |         |
    |         +---> slice-03 (Reference Service)
    |         |         |
    |         |         +---> slice-04 (Upload Server Action)
    |         |         |         |
    |         |         |         +---> slice-07 (ReferenceSlot Component)
    |         |         |         |         |
    |         |         |         |         +---> slice-08 (ReferenceBar Component)
    |         |         |         |                   |
    |         |         |         |                   +---> slice-09 (PromptArea Integration)
    |         |         |         |                   |         |
    |         |         |         |                   |         +---> slice-10 (RefHintBanner)
    |         |         |         |                   |         |
    |         |         |         |                   |         +---> slice-11 (CompatibilityWarning)
    |         |         |         |                   |
    |         |         |         |                   +---> slice-12 (Prompt @-Token Mapping)
    |         |         |         |                   |
    |         |         |         |                   +---> slice-13 (Generation Integration)
    |         |         |         |                   |         |
    |         |         |         |                   |         +---> slice-15 (Provenance Lightbox)
    |         |         |         |                   |         |
    |         |         |         |                   |         +---> slice-17 (Migration + Cleanup)
    |         |         |         |                   |
    |         |         |         |                   +---> slice-14 (Gallery Drag to Slot)
    |         |         |         |
    |         |         +---> slice-05 (Gallery-as-Reference Service)
    |         |                   |
    |         |                   +---> slice-16 (Lightbox UseAsReference Button)
    |
    +---> slice-06 (Collapsible + Panel Width Setup)
```

---

## Slice-Liste

### Slice 01: DB Schema & Migration

- **Scope:** Drizzle-Schema fuer `reference_images` und `generation_references` Tabellen definieren. Indexes auf `projectId` und `generationId`. Migration generieren und anwenden.
- **Deliverables:**
  - `lib/db/schema.ts` (erweitert: 2 neue Tabellen-Definitionen)
  - `drizzle/` (generierte Migration-Datei via `drizzle-kit generate`)
- **Done-Signal:** `npx drizzle-kit push` laeuft erfolgreich, beide Tabellen existieren in der DB mit korrekten FKs und Indexes.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 1 "DB Schema: Reference Tables"

---

### Slice 02: Reference Image Queries

- **Scope:** CRUD-Queries fuer `reference_images` Tabelle: `createReferenceImage`, `deleteReferenceImage`, `getReferenceImagesByProject`. CRUD fuer `generation_references`: `createGenerationReferences`, `getGenerationReferences`.
- **Deliverables:**
  - `lib/db/queries.ts` (erweitert: 5 neue Query-Funktionen)
- **Done-Signal:** Vitest Unit-Tests pruefen: Insert/Select/Delete fuer reference_images, Insert/Select fuer generation_references.
- **Dependencies:** ["slice-01"]
- **Discovery-Quelle:** Slice 2 "DB Queries + Reference Service"

---

### Slice 03: Reference Service (Upload + Delete)

- **Scope:** `ReferenceService` mit `upload()` (File + URL → R2 + DB), `delete()` (R2 + DB), `getByProject()`. Validierung: MIME-Type (PNG/JPG/JPEG/WebP), Dateigroesse (max 10MB). R2-Key-Pattern: `references/{projectId}/{uuid}.{ext}`. Sharp fuer Width/Height-Extraktion.
- **Deliverables:**
  - `lib/services/reference-service.ts` (neu)
- **Done-Signal:** Vitest Unit-Tests: Upload erzeugt R2-Objekt + DB-Eintrag mit korrekten Dimensionen, Delete entfernt beides, getByProject liefert korrekte Liste.
- **Dependencies:** ["slice-02"]
- **Discovery-Quelle:** Slice 2 "DB Queries + Reference Service" + Slice 3 "Reference Upload Action"

---

### Slice 04: Upload Reference Server Action

- **Scope:** Server Action `uploadReferenceImage({ projectId, file?, url? })` und `deleteReferenceImage({ id })` in neuer Actions-Datei. Ruft ReferenceService auf. Revalidiert Path.
- **Deliverables:**
  - `app/actions/references.ts` (neu)
- **Done-Signal:** Server Action aufrufbar, liefert `{ id, imageUrl, width, height }` bei Erfolg bzw. `{ error }` bei Fehler. Delete liefert `{ success: true }`.
- **Dependencies:** ["slice-03"]
- **Discovery-Quelle:** Slice 3 "Reference Upload Action"

---

### Slice 05: Gallery-as-Reference Service

- **Scope:** `ReferenceService.uploadFromGallery(projectId, generationId, imageUrl)` — erstellt DB-Eintrag mit `sourceType: "gallery"` ohne R2-Upload (nutzt existierende Gallery-URL). Server Action `addGalleryAsReference` in references.ts.
- **Deliverables:**
  - `lib/services/reference-service.ts` (erweitert: `uploadFromGallery` Methode)
  - `app/actions/references.ts` (erweitert: `addGalleryAsReference` Action)
- **Done-Signal:** Gallery-Bild als Referenz anlegbar ohne R2-Upload. DB-Eintrag hat `sourceType: "gallery"` und korrekte `sourceGenerationId`.
- **Dependencies:** ["slice-03"]
- **Discovery-Quelle:** Slice 7 "Gallery-to-Reference"

---

### Slice 06: UI Setup (Collapsible + Panel Width)

- **Scope:** shadcn Collapsible installieren (`npx shadcn add collapsible`). Panel-Breite in workspace-content.tsx von `w-80` (320px) auf `w-[480px]` aendern.
- **Deliverables:**
  - `components/ui/collapsible.tsx` (neu, via shadcn CLI)
  - `components/workspace/workspace-content.tsx` (geaendert: Panel-Width)
- **Done-Signal:** Collapsible-Component importierbar. Prompt-Area Panel ist 480px breit. App startet ohne Fehler.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 4 "Reference Bar UI" (Pre-Requisite)

---

### Slice 07: ReferenceSlot Component

- **Scope:** Einzelner ReferenceSlot als Card-Component: 80x80 Thumbnail, farbcodierter Border (Style=Violet, Content=Blue, Structure=Green, Character=Amber, Color=Pink), RoleDropdown (shadcn Select mit farbigem Dot), StrengthDropdown (4 Stufen: Subtle/Moderate/Strong/Dominant), SlotLabel (@N Badge), RoleBadge, Remove-Button. States: empty (Dropzone mit gestricheltem Rand), drag-over, uploading, ready, dimmed, error. File-Upload via Drag & Drop, Click-to-Browse, URL Paste.
- **Deliverables:**
  - `components/workspace/reference-slot.tsx` (neu)
  - `lib/types/reference.ts` (neu: ReferenceRole, ReferenceStrength, ReferenceSlotData Type-Definitionen)
- **Done-Signal:** Component rendert in allen 6 States. Rolle/Strength aenderbar, farbkodierter Border wechselt korrekt. Upload-Flow (File Drop, Click, URL Paste) funktioniert.
- **Dependencies:** ["slice-04", "slice-06"]
- **Discovery-Quelle:** Slice 4 "Reference Bar UI"

---

### Slice 08: ReferenceBar Component

- **Scope:** Collapsible Container fuer ReferenceSlots. Header mit Counter-Badge [N/5], Collapse/Expand Toggle. States: collapsed-empty (Chevron right, "References (0)"), collapsed-filled (Mini-Thumbnails Vorschau mit sparse Labels), expanded (volle Slots). AddReferenceButton im Header (disabled bei 5/5). Trailing Empty Dropzone unterhalb letztem Slot (solange < 5). Stabile sparse Slot-Labels: @-Nummern bleiben bei Remove erhalten, neue Bilder fuellen niedrigste freie Nummer.
- **Deliverables:**
  - `components/workspace/reference-bar.tsx` (neu)
- **Done-Signal:** Bar zeigt alle 3 Collapsed/Expanded States korrekt. Slots hinzufuegen/entfernen funktioniert. Labels bleiben stabil (kein Re-Numbering). Max 5 Slots enforced. Auto-expand bei erstem Upload.
- **Dependencies:** ["slice-07"]
- **Discovery-Quelle:** Slice 4 "Reference Bar UI"

---

### Slice 09: PromptArea Integration

- **Scope:** ReferenceBar in prompt-area.tsx einbinden: zwischen Mode-Selector/Model-Card und Prompt-Feldern im img2img-Modus. Bestehende ImageDropzone + StrengthSlider durch ReferenceBar ersetzen. Reference-State in React State (nicht destroyed bei Mode-Switch, nur hidden wenn nicht img2img). WorkspaceState erweitern fuer "Als Referenz nutzen"-Flow (`addReference` Feld).
- **Deliverables:**
  - `components/workspace/prompt-area.tsx` (geaendert: ReferenceBar statt ImageDropzone)
  - `lib/workspace-state.tsx` (erweitert: `addReference` Feld im Context)
- **Done-Signal:** ReferenceBar sichtbar im img2img-Modus, hidden in txt2img/upscale. Referenzen bleiben bei Mode-Switch erhalten. Bestehende Single-Image-Funktionalitaet durch ReferenceBar abgeloest.
- **Dependencies:** ["slice-08"]
- **Discovery-Quelle:** Slice 4 "Reference Bar UI"

---

### Slice 10: RefHintBanner

- **Scope:** Info-Banner unterhalb der Prompt-Felder: "Tipp: Nutze @1, @3, @5 im Prompt um Referenzen anzusprechen" (dynamisch mit tatsaechlichen sparse @-Nummern). Dismissible mit [x] Button. Dismiss-State in localStorage persistiert. Nur sichtbar wenn mindestens eine Referenz geladen und nicht dismissed.
- **Deliverables:**
  - `components/workspace/ref-hint-banner.tsx` (neu)
- **Done-Signal:** Banner erscheint mit korrekten @-Nummern wenn Referenzen vorhanden. Dismiss persistiert ueber Page-Reload. Banner verschwindet wenn keine Referenzen.
- **Dependencies:** ["slice-09"]
- **Discovery-Quelle:** Slice 4 "Reference Bar UI" + Slice 5 "@image Prompt Syntax"

---

### Slice 11: CompatibilityWarning

- **Scope:** Warning-Banner ueber den Referenz-Slots bei Modell-Inkompatibilitaet. `getMaxImageCount()` Funktion in model-schema-service.ts (prueft Schema `maxItems` oder aehnlich). Zwei Varianten: `partial` ("Modell X unterstuetzt max N Referenzen, @N+1-@max werden ignoriert" + Slots dimmen) und `no-support` ("Modell unterstuetzt keine Referenz-Bilder. [Switch to FLUX 2 Pro]" + Generate disabled). Actionable Link der direkt Modell wechselt.
- **Deliverables:**
  - `components/workspace/compatibility-warning.tsx` (neu)
  - `lib/services/model-schema-service.ts` (erweitert: `getMaxImageCount()`)
- **Done-Signal:** Warning erscheint korrekt bei Model-Wechsel. Ueberschuessige Slots werden gedimmt. "Switch to FLUX 2 Pro" Link wechselt Modell. Bei no-support ist Generate disabled.
- **Dependencies:** ["slice-09"]
- **Discovery-Quelle:** Slice 6 "Generation Integration" (Modell-Kompatibilitaet)

---

### Slice 12: Prompt @-Token Mapping

- **Scope:** `composeMultiReferencePrompt()` Funktion: @N im Prompt-Text durch @imageN ersetzen (Regex `/@(\d+)/g`). Role/Strength-Kontext als System-Instruktion anhaengen ("Reference guidance: @image1 provides style reference with strong influence..."). Unbenutzte Referenzen (ohne @-Mention) als Kontext-Hints anhaengen. V1: Plain Text im Textarea, kein visuelles Highlighting.
- **Deliverables:**
  - `lib/services/generation-service.ts` (erweitert: `composeMultiReferencePrompt()` Funktion)
- **Done-Signal:** Vitest Unit-Tests: @1 → @image1 Mapping korrekt. Role/Strength-Kontext korrekt komponiert. Unbenutzte Referenzen enthalten. Leere Referenzen produzieren keinen Kontext.
- **Dependencies:** ["slice-09"]
- **Discovery-Quelle:** Slice 5 "@image Prompt Syntax"

---

### Slice 13: Generation Integration

- **Scope:** `generateImages` Server Action erweitern: `references?: ReferenceInput[]` als neuen Parameter akzeptieren. `buildReplicateInput()` erweitern: statt einzelner `sourceImageUrl` Array aus generation_references-URLs bauen. Nach Generation: `generation_references`-Records in DB erstellen. Total-Megapixel-Validierung (max 9 MP) vor API-Call.
- **Deliverables:**
  - `app/actions/generations.ts` (erweitert: references Parameter + generation_references Insert)
  - `lib/services/generation-service.ts` (erweitert: `buildReplicateInput()` Multi-Image + `composeMultiReferencePrompt` Aufruf)
- **Done-Signal:** Multi-Reference Generation produziert Bild via Replicate API. generation_references-Records in DB vorhanden. Fallback auf sourceImageUrl bei alten Generierungen funktioniert. Megapixel-Warnung bei Ueberschreitung.
- **Dependencies:** ["slice-02", "slice-09", "slice-12"]
- **Discovery-Quelle:** Slice 6 "Generation Integration"

---

### Slice 14: Gallery Drag to Reference Slot

- **Scope:** Generation-Cards `draggable` machen. Custom `dataTransfer` Format mit Generation-Daten (imageUrl, generationId). ReferenceSlot erweitern: Unterscheidung native File-Drop vs. Intra-App Gallery-Drag (verschiedene `dataTransfer` MIME-Types). Bei Gallery-Drag: `addGalleryAsReference` Action aufrufen (kein R2-Upload).
- **Deliverables:**
  - `components/workspace/generation-card.tsx` (erweitert: `draggable`, `onDragStart`)
  - `components/workspace/reference-slot.tsx` (erweitert: Gallery-Drag Handler)
- **Done-Signal:** Gallery-Card per Drag & Drop in leeren Referenz-Slot ziehbar. Slot zeigt Thumbnail der Gallery-Generation. Kein R2-Upload, nur DB-Eintrag.
- **Dependencies:** ["slice-05", "slice-08"]
- **Discovery-Quelle:** Slice 7 "Gallery-to-Reference"

---

### Slice 15: Provenance in Lightbox

- **Scope:** ProvenanceRow Component: Horizontale Thumbnail-Reihe der verwendeten Referenzen mit @-Nummer, Rollen-Name und Strength-Stufe. In lightbox-modal.tsx unterhalb der bestehenden Details einfuegen. Query: `getGenerationReferences(generationId)` aufrufen und anzeigen. Nur sichtbar wenn Generation Referenzen hatte.
- **Deliverables:**
  - `components/lightbox/provenance-row.tsx` (neu)
  - `components/lightbox/lightbox-modal.tsx` (erweitert: ProvenanceRow einbinden)
- **Done-Signal:** Lightbox zeigt bei Generierungen mit Referenzen die korrekte Thumbnail-Reihe mit Rollen und Strengths. Bei Generierungen ohne Referenzen ist die Section hidden.
- **Dependencies:** ["slice-02", "slice-13"]
- **Discovery-Quelle:** Slice 8 "Provenance in Lightbox"

---

### Slice 16: Lightbox UseAsReference Button

- **Scope:** "Als Referenz" Button in der Lightbox-Aktionsleiste (zwischen "Variation" und "img2img"). Klick legt Bild in naechsten freien Referenz-Slot (niedrigste freie @-Nummer, Default: Content/Moderate). Auto-Switch zu img2img-Modus falls noetig via WorkspaceState. Lightbox schliesst nach Aktion. Disabled wenn alle 5 Slots belegt (Tooltip "Alle 5 Slots belegt").
- **Deliverables:**
  - `components/lightbox/lightbox-modal.tsx` (erweitert: UseAsReferenceButton)
- **Done-Signal:** Button sichtbar in Lightbox. Klick fuegt Bild als Referenz hinzu, wechselt zu img2img, schliesst Lightbox. Disabled-State bei 5/5 Slots korrekt.
- **Dependencies:** ["slice-05", "slice-09"]
- **Discovery-Quelle:** Slice 7 "Gallery-to-Reference"

---

### Slice 17: Migration + Cleanup

- **Scope:** Bestehende `sourceImageUrl`-Werte in `generations` als einzelne "Content"-Referenz in `generation_references` migrieren (Migration-Script). `sourceImageUrl`-Spalte bleibt erhalten (deprecated, nicht geloescht). Alte img2img-Generierungen zeigen korrekte Referenz in Lightbox-Provenance.
- **Deliverables:**
  - `lib/db/migrations/migrate-source-images.ts` (neu: Migrations-Script)
- **Done-Signal:** Alle bestehenden Generierungen mit `sourceImageUrl` haben korrespondierende `generation_references`-Records. Lightbox-Provenance zeigt alte Referenzen korrekt an. Keine Daten verloren.
- **Dependencies:** ["slice-02", "slice-13", "slice-15"]
- **Discovery-Quelle:** Slice 9 "Migration + Cleanup"

---

## Recommended Implementation Order

```
Phase A — Fundament (parallel moeglich):
  slice-01: DB Schema & Migration
  slice-06: UI Setup (Collapsible + Panel Width)

Phase B — Datenzugriff:
  slice-02: Reference Image Queries

Phase C — Service Layer:
  slice-03: Reference Service (Upload + Delete)

Phase D — Server Actions:
  slice-04: Upload Reference Server Action
  slice-05: Gallery-as-Reference Service (parallel zu slice-04)

Phase E — UI Components:
  slice-07: ReferenceSlot Component
  slice-08: ReferenceBar Component

Phase F — Integration:
  slice-09: PromptArea Integration

Phase G — Enhancements (parallel moeglich):
  slice-10: RefHintBanner
  slice-11: CompatibilityWarning
  slice-12: Prompt @-Token Mapping

Phase H — Generation:
  slice-13: Generation Integration

Phase I — Workflows (parallel moeglich):
  slice-14: Gallery Drag to Slot
  slice-15: Provenance in Lightbox
  slice-16: Lightbox UseAsReference Button

Phase J — Cleanup:
  slice-17: Migration + Cleanup
```

---

## Qualitaets-Checkliste

- [x] Jeder Slice hat maximal 3 produktive Deliverable-Dateien
- [x] Jeder Slice hat ein messbares Done-Signal
- [x] Dependencies sind azyklisch (DAG)
- [x] Alle Deliverables aus der Discovery sind abgedeckt (9 Discovery-Slices → 17 atomare Slices)
- [x] Kein Slice hat mehr als ein Concern (DB / Service / UI / Integration jeweils getrennt)
- [x] Schema/Service-Slices kommen vor UI-Slices
- [x] Stack ist korrekt erkannt und dokumentiert

---

## Coverage-Matrix: Discovery-Slices → Atomare Slices

| Discovery-Slice | Atomare Slices |
|-----------------|----------------|
| 1: DB Schema: Reference Tables | slice-01 |
| 2: DB Queries + Reference Service | slice-02, slice-03 |
| 3: Reference Upload Action | slice-04 |
| 4: Reference Bar UI | slice-06, slice-07, slice-08, slice-09, slice-10 |
| 5: @image Prompt Syntax | slice-10, slice-12 |
| 6: Generation Integration | slice-11, slice-13 |
| 7: Gallery-to-Reference | slice-05, slice-14, slice-16 |
| 8: Provenance in Lightbox | slice-15 |
| 9: Migration + Cleanup | slice-17 |
