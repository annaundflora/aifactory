# Feature: Image Collections

**Epic:** --
**Status:** Draft
**Wireframes:** -- (TODO)

---

## Problem & Solution

**Problem:**
- Bilder die zusammengehoeren (z.B. Sketch -> T-Shirt-Mockup -> Model-Shot -> Flatlay -> POD-Vorlage) haben aktuell keine sichtbare Verbindung
- User muss sich selbst merken welche Bilder zusammengehoeren
- Kein Weg, eine Design-Evolution nachzuvollziehen oder als Einheit zu verwalten

**Solution:**
- Hybrid-Modell: Eigenes Collection-Datenmodell + automatische Erstellung aus Lineage
- Auto-Create: Wenn img2img/Variation generiert wird, entsteht automatisch eine Collection (oder bestehendes wird erweitert)
- Manuelle Verwaltung: Frei erstellen, Bilder hinzufuegen/entfernen, aufloesen — per Kontextmenue
- Collections in Workspace-Galerie als eigener Filter mit gruppiertem Grid
- Im Canvas: Erweiterte SiblingThumbnails zeigen die gesamte Lineage-Chain

**Business Value:**
- Workflow-Beschleunigung: Design-Ketten auf einen Blick erkennen
- Bessere Organisation bei vielen Generationen
- Export-Vorbereitung: zusammengehoerige Assets als Set verwalten

---

## Scope & Boundaries

| In Scope |
|----------|
| Eigenes Collection-Datenmodell (`collections` + `collection_items` Tabellen) |
| Automatische Collection-Bildung bei img2img/Variation (Lineage-basiert) |
| Manuelle Collection-Erstellung (frei, beliebige Bilder) |
| Bilder zu bestehender Collection hinzufuegen (Kontextmenue) |
| Bilder aus Collection entfernen (Bild bleibt in Galerie) |
| Collection aufloesen (Bilder bleiben, Lineage bleibt intakt) |
| Canvas: Erweiterte SiblingThumbnails als Lineage-Chain |
| Galerie: Neuer Filter-Chip "Collections" + gruppiertes Grid mit Collection-Headers |
| Galerie: Kontextmenue fuer Collection-Management |
| Collection-Benennung: Optional, auto-generiert aus Root-Prompt |

| Out of Scope |
|--------------|
| Collection-Export als ZIP/Bundle |
| Collection-Sharing/Collaboration |
| Collection-Templates/Presets |
| Cross-Project Collections |
| Drag&Drop fuer Collection-Management |
| Multi-Select / Selection-Mode |

---

## Current State Reference

### Canvas
- Single-Image-View mit Fullscreen-Overlay (`CanvasDetailView`)
- `SiblingThumbnails`: Zeigt Variant-Family (Root + direkte Kinder + Batch-Siblings) — nur 1 Level tief
- Toolbar mit Toggle-Popovers (Variation, img2img, Upscale, Download, Delete, Details)
- Kein Kontextmenue, kein Multi-Select, kein Grouping-UI
- Undo/Redo Stack (max 20) fuer Canvas-Navigation

### Galerie
- Masonry Flexbox Grid (2-7 Spalten je nach Container-Breite)
- Filter-Chips: Alle / Text to Image / Image to Image / Upscale
- Kein Search, kein Sort (immer newest-first), keine Gruppierung
- `GenerationCard` ist draggable (fuer Reference-Slots im img2img-Popover)
- Klick auf Card → Canvas Fullscreen Overlay (View Transition)

### Datenbank (existierende Beziehungen)
- `sourceGenerationId`: Self-ref FK auf `generations` — verlinkt Variation/img2img-Output zum Parent (SET NULL on delete)
- `batchId`: Shared UUID fuer Generationen aus demselben Request (Siblings)
- `getVariantFamily()` Query: Findet Root + direkte Kinder + Batch-Siblings — **nicht rekursiv** (mehrstufige Ketten A→B→C werden nicht vollstaendig aufgeloest)
- `generation_references` + `reference_images`: Many-to-many fuer img2img Reference-Provenance (role, strength, slotPosition)

### Relevante Dateien
- DB Schema: `lib/db/schema.ts`
- DB Queries: `lib/db/queries.ts` (`getVariantFamily`)
- Canvas Layout: `components/canvas/canvas-detail-view.tsx`
- Sibling Thumbnails: `components/canvas/sibling-thumbnails.tsx`
- Canvas Context: `lib/canvas-detail-context.tsx`
- Gallery Grid: `components/workspace/gallery-grid.tsx`
- Generation Card: `components/workspace/generation-card.tsx`
- Filter Chips: `components/workspace/filter-chips.tsx`
- Generation Service: `lib/services/generation-service.ts`
- Server Actions: `app/actions/generations.ts`

---

## UI Patterns

### Reused Patterns

| Pattern | Source | Reuse |
|---------|--------|-------|
| Filter-Chips | `components/workspace/filter-chips.tsx` | Neuer Chip "Collections" hinzufuegen |
| SiblingThumbnails | `components/canvas/sibling-thumbnails.tsx` | Erweitern zur vollstaendigen Lineage-Chain |
| GenerationCard | `components/workspace/generation-card.tsx` | Wiederverwendung in Collection-Grid |
| Masonry Grid | `components/workspace/gallery-grid.tsx` | Wiederverwendung innerhalb Collection-Gruppen |

### New Patterns

| Pattern Type | Description | Rationale |
|--------------|-------------|-----------|
| Collection-Header (Galerie) | Trennlinie mit Collection-Name + Bildzaehler zwischen Gruppen | Visuelle Gruppierung im Collections-Filter |
| Kontextmenue (Galerie) | Rechtsklick-Menue auf GenerationCards + Collection-Headers | Aktuell kein Kontextmenue vorhanden |
| Erweiterte Lineage-Chain (Canvas) | SiblingThumbnails zeigt gesamten Baum statt nur 1 Level | Mehrstufige Design-Evolutionen sichtbar machen |

---

## User Flow

### Flow 1: Automatische Collection im Canvas

1. User generiert Bild A (txt2img) → Bild erscheint im Canvas
2. User generiert Variation/img2img aus A → Bild B erscheint
3. System prueft: Ist A bereits in einer Collection?
   - Nein → Neue Collection {A, B} erstellt, Name auto-generiert aus A's Prompt
   - Ja → B wird zu A's bestehender Collection hinzugefuegt
4. User generiert aus B weiter → Bild C wird automatisch zur selben Collection hinzugefuegt
5. Erweiterte SiblingThumbnails zeigt die gesamte Chain

### Flow 2: Manuelle Collection in Galerie erstellen

1. User rechtsklickt auf ein Bild in der Galerie
2. Kontextmenue: "Neue Collection erstellen"
3. Dialog: Collection-Name eingeben (optional)
4. Collection wird erstellt mit diesem einen Bild
5. User rechtsklickt auf weitere Bilder → "Zur Collection hinzufuegen" → Submenue mit bestehenden Collections

### Flow 3: Collection in Galerie anzeigen

1. User klickt Filter-Chip "Collections"
2. Galerie wechselt zu gruppierter Ansicht
3. Jede Collection als Gruppe: Header (Name + Zaehler) + Bilder im Grid darunter
4. Jedes Bild einzeln klickbar → oeffnet Canvas
5. Bilder die in keiner Collection sind werden nicht angezeigt

### Flow 4: Collection in Galerie verwalten

1. Rechtsklick auf Bild in Collection → "Aus Collection entfernen" → Bild verschwindet aus Gruppe, bleibt in Galerie
2. Rechtsklick auf Collection-Header → "Umbenennen" → Inline-Edit oder Dialog
3. Rechtsklick auf Collection-Header → "Collection aufloesen" → Bilder bleiben, Gruppierung verschwindet

**Error Paths:**
- Letztes Bild (Nr. 2) aus Collection entfernen → Collection wird automatisch aufgeloest (Min. 2 Regel)
- Bild loeschen (Delete) das in Collection ist → Bild verschwindet aus Collection, bei <2 → auto-aufloesen
- Collection mit 0 Bildern (alle geloescht) → Collection wird entfernt

---

## UI Layout & Context

### Screen: Canvas — Erweiterte SiblingThumbnails

**Position:** Unterhalb des Canvas-Bildes (bestehende Position von SiblingThumbnails)
**When:** Sobald das aktuelle Bild Teil einer Lineage-Chain ist (sourceGenerationId vorhanden)
**Content:** Horizontale Thumbnail-Reihe zeigt alle Bilder der Chain, aktuelles Bild hervorgehoben
**Aenderung gegenueber Ist-Zustand:** Rekursive Aufloesung der gesamten Kette statt nur 1 Level

### Screen: Workspace Gallery — Collections Filter

**Position:** Neuer Filter-Chip rechts neben "Upscale" in bestehender FilterChips-Leiste
**When:** Immer sichtbar (auch wenn keine Collections existieren)
**Content bei Aktivierung:** Gruppiertes Grid — Collection-Header + zugehoerige Bilder darunter

### Screen: Workspace Gallery — Kontextmenue

**Position:** Rechtsklick auf GenerationCard oder Collection-Header
**When:** Immer verfuegbar (auch ausserhalb Collections-Filter)

---

## UI Components & States

> TODO: Nach Details-Phase ausarbeiten (Kontextmenue-Items, Collection-Header States, Dialog-States)

---

## Feature State Machine

> TODO: Nach Details-Phase ausarbeiten

---

## Business Rules

- Eine Collection hat mindestens 2 Bilder (Ausnahme: manuell erstellt mit 1 Bild, wird nicht auto-aufgeloest bis User weiteres Bild hinzufuegt — nur auto-created Collections werden bei <2 aufgeloest)
- Ein Bild kann zu mehreren Collections gehoeren (many-to-many)
- Automatische Collection nur bei img2img/Variation, nicht bei unabhaengigen txt2img
- Auto-Create Logik: Source-Bild in Collection? → Ja: erweitern. Nein: neue Collection erstellen (TODO: exakte Regeln noch offen)
- Collection-Name: Optional, auto-generiert aus Root-Bild-Prompt (erste Woerter), jederzeit umbenennbar
- Lineage (`sourceGenerationId`) wird NIE durch Collection-Aktionen veraendert
- Bild aus Collection entfernen = nur aus `collection_items` loeschen, Bild bleibt in Galerie
- Collection aufloesen = `collection_items` + `collections` Eintrag loeschen, Bilder bleiben
- Bild loeschen (Delete) → verschwindet aus allen Collections, bei <2 Bilder → auto-Aufloesung

---

## Data

### Tabelle: `collections`

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `id` | Yes | UUID | PK |
| `project_id` | Yes | UUID FK → projects | Scope pro Projekt |
| `name` | No | Max 100 chars | Auto-generiert aus Root-Prompt wenn leer |
| `auto_created` | Yes | Boolean | Automatisch (Lineage) vs. manuell erstellt |
| `created_at` | Yes | Timestamp | Erstellungszeitpunkt |

### Tabelle: `collection_items`

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `id` | Yes | UUID | PK |
| `collection_id` | Yes | UUID FK → collections | CASCADE delete |
| `generation_id` | Yes | UUID FK → generations | CASCADE delete |
| `added_at` | Yes | Timestamp | Wann hinzugefuegt |
| `position` | No | Integer | Reihenfolge in der Collection |

**Unique Constraint:** `(collection_id, generation_id)` — ein Bild max. einmal pro Collection

---

## Trigger-Inventory

> TODO: Vollstaendige Liste aller Entry Points die Collection-Aenderungen ausloesen

---

## Implementation Slices

> Grobe Aufteilung, wird nach Details-Phase verfeinert

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| 1 | Collection Data Model | DB-Schema (`collections` + `collection_items`), Drizzle Migration, CRUD Queries | CRUD-Tests | -- |
| 2 | Auto-Collection bei Variation/img2img | Generation-Service erweitern: nach img2img auto-create/extend Collection | Generiere Variation → Collection entsteht/waechst | Slice 1 |
| 3 | Canvas: Erweiterte Lineage-Chain | SiblingThumbnails rekursiv machen (gesamte Kette statt 1 Level) | Mehrstufige Kette A→B→C vollstaendig sichtbar | Slice 1 |
| 4 | Galerie: Collections-Filter + gruppiertes Grid | Neuer Filter-Chip, Collection-Header, gruppierte Ansicht | Collections-Filter zeigt Gruppen, Bilder klickbar | Slice 1 |
| 5 | Galerie: Kontextmenue | Rechtsklick auf Bilder + Collection-Headers, alle Management-Aktionen | Kontextmenue oeffnet, Aktionen funktionieren | Slice 1, 4 |
| 6 | Galerie: Manuelle Collection-Erstellung | "Neue Collection" + "Zur Collection hinzufuegen" im Kontextmenue | Manuelle Collection erstellen + Bilder hinzufuegen | Slice 1, 5 |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| 1 | Kann ein Bild zu mehreren Collections gehoeren? | A) Nein B) Ja | B) Ja | **B) Ja, mehrere** |
| 2 | Wie sieht der Collection-Indikator im Canvas aus? | A) Verbindungslinien B) Rahmen C) Badge D) Container | -- | **Erweiterte SiblingThumbnails (Lineage-Chain)** |
| 3 | Wie werden Collections in der Galerie dargestellt? | A) Tab B) Gruppiertes Grid C) Collapsible | B) | **Filter-Chip + gruppiertes Grid mit Headers** |
| 4 | Welche Interaktionsmuster? | A) Kontextmenue B) Drag&Drop C) Selection-Mode | A) | **A) Kontextmenue (Rechtsklick)** |
| 5 | Soll Collection einen Namen haben? | A) Optional B) Pflicht C) Kein Name | A) | **A) Optional, auto-generiert** |
| 6 | Was passiert wenn Ursprungsbild geloescht wird? | A) Collection bleibt B) aufloesen | A) | **A) Collection bleibt, Bild verschwindet** |
| 7 | Collection-Datenmodell? | A) Lineage-basiert B) Eigenes Modell C) Hybrid | -- | **C) Hybrid (eigenes Modell + Lineage auto-create)** |
| **8** | **Auto-Create Logik: Wie entscheidet das System ob neue Collection oder bestehende erweitern?** | **A) Source-Bild pruefen B) Immer neu C) User entscheidet** | **A)** | **OFFEN** |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-15 | User Input | Beispiel-Workflow: Sketch -> Photo/Modelshot -> Flatlay -> POD-Vorlage. Bilder bilden eine Design-Evolution |
| 2026-03-15 | Codebase: DB | `sourceGenerationId` (self-ref FK) + `batchId` existieren. `getVariantFamily()` nur 1 Level tief, nicht rekursiv |
| 2026-03-15 | Codebase: Canvas | Single-Image-View, SiblingThumbnails zeigt Variant Family (1 Level). Kein Kontextmenue, kein Grouping |
| 2026-03-15 | Codebase: Galerie | Masonry Grid, Filter-Chips (4 Modi), kein Search/Sort/Grouping. Cards sind draggable |
| 2026-03-15 | Codebase: Generation | img2img/Variation setzt `sourceGenerationId` + `batchId`. Chat-Agent setzt sourceGenerationId NICHT (Gap) |
| 2026-03-15 | Architektur-Entscheidung | Hybrid-Modell: Eigene `collections` + `collection_items` Tabellen, Auto-Create aus Lineage-Kette |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| 1 | Soll erst eine umfassende Recherche durchgefuehrt werden oder direkt ein Draft erstellt werden? | Direkt Draft, Recherche spaeter |
| 2 | Collection-Modell: Lineage-basiert, eigenes Modell oder Hybrid? | Erst A) Lineage, dann korrigiert: Hybrid — Lineage auto-create + eigenes Modell fuer freie Erstellung/Bearbeitung. Entfernte Bilder sollen in Galerie bleiben, nur aus Collection verschwinden |
| 3 | Canvas-Visualisierung: Erweiterte SiblingThumbnails, Baumansicht im Details-Overlay oder beides? | Erweiterte SiblingThumbnails (Lineage-Chain unter dem Canvas-Bild) |
| 4 | Galerie-Darstellung: Stacked Cards, eigener Tab, Inline-Gruppen oder Toggle? | Filter-Chip "Collections" + gruppiertes Grid mit Collection-Headers. Jedes Bild einzeln klickbar |
| 5 | Interaktionsmuster: Kontextmenue, Selection-Mode oder beides? | Kontextmenue (Rechtsklick) |
| 6 | Kann ein Bild zu mehreren Collections gehoeren? | Ja, mehrere (many-to-many) |
| 7 | Collection-Name: Optional, Pflicht oder kein Name? | Optional, auto-generiert aus Root-Prompt |
| 8 | Was passiert wenn Bild geloescht wird das in Collection ist? | Bild verschwindet aus Collection, bei <2 Bilder auto-Aufloesung |
