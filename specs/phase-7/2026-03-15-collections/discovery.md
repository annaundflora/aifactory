# Feature: Image Collections

**Epic:** --
**Status:** Draft — Pausiert in CONVERGE/DETAILS (Collection View Anforderungen offen)
**Wireframes:** -- (TODO)

---

## Problem & Solution

**Problem:**
- Bilder die zusammengehoeren (z.B. Sketch -> T-Shirt-Mockup -> Model-Shot -> Flatlay -> POD-Vorlage) haben aktuell keine sichtbare Verbindung
- User muss sich selbst merken welche Bilder zusammengehoeren
- Kein Weg, eine Design-Evolution nachzuvollziehen oder als Einheit zu verwalten

**Solution:**
- Hybrid-Modell: Eigenes Collection-Datenmodell + automatische Erstellung im Canvas
- Auto-Create (nur Canvas): Wenn img2img/Variation generiert wird, entsteht automatisch eine Collection (oder bestehendes wird erweitert)
- Manuelle Verwaltung: Frei erstellen, Bilder hinzufuegen/entfernen, aufloesen
- Canvas: Collection-Navigation ersetzt bisherige SiblingThumbnails (Lineage-UI komplett abgeloest)
- Galerie/Workspace: Collection View — Darstellung noch offen (siehe Open Questions)

**Business Value:**
- Workflow-Beschleunigung: Design-Ketten auf einen Blick erkennen
- Bessere Organisation bei vielen Generationen
- Export-Vorbereitung: zusammengehoerige Assets als Set verwalten

---

## Scope & Boundaries

| In Scope |
|----------|
| Eigenes Collection-Datenmodell (`collections` + `collection_items` Tabellen) |
| Automatische Collection-Bildung bei img2img/Variation im Canvas |
| Manuelle Collection-Erstellung (frei, beliebige Bilder) |
| Bilder zu bestehender Collection hinzufuegen (Kontextmenue + evtl. Drag&Drop) |
| Bilder aus Collection entfernen (Bild bleibt in Galerie) |
| Collection aufloesen (Bilder bleiben, Lineage bleibt intakt) |
| Canvas: Collection-Navigation (ersetzt SiblingThumbnails) mit Collection-Switcher |
| Collection View im Workspace (Darstellung/Ort noch offen — siehe Open Questions) |
| Collection-Benennung: Optional, auto-generiert aus Root-Prompt |

| Out of Scope |
|--------------|
| Collection-Export als ZIP/Bundle |
| Collection-Sharing/Collaboration |
| Collection-Templates/Presets |
| Cross-Project Collections |
| Multi-Select / Selection-Mode |

---

## Current State Reference

### Canvas
- Single-Image-View mit Fullscreen-Overlay (`CanvasDetailView`)
- 3-Column Layout: Toolbar (links) | Canvas Area (mitte) | Chat Panel (rechts, optional)
- `SiblingThumbnails`: Zeigt Variant-Family (Root + direkte Kinder + Batch-Siblings) — nur 1 Level tief
- Toolbar mit Toggle-Popovers (Variation, img2img, Upscale, Download, Delete, Details)
- Kein Kontextmenue, kein Multi-Select, kein Grouping-UI
- Undo/Redo Stack (max 20) fuer Canvas-Navigation
- Canvas ersetzt Gallery temporaer (`display: none` auf Grid)

### Galerie
- Masonry Flexbox Grid (2-7 Spalten je nach Container-Breite, round-robin column distribution)
- Filter-Chips: Alle / Text to Image / Image to Image / Upscale (button-basiert, `aria-pressed`)
- Kein Search, kein Sort (immer newest-first), keine Gruppierung
- `GenerationCard` ist draggable (`draggable="true"`, `GALLERY_DRAG_MIME_TYPE`)
- Klick auf Card → Canvas Fullscreen Overlay (View Transition)
- Cards zeigen: Thumbnail (lazy), Hover-Overlay mit Prompt, Mode-Badge (oben-links), Model-Badge (unten-links)

### Sidebar
- Collapsible ("icon" mode): 256px expanded, 56px collapsed
- SidebarContent: `SidebarGroup "Projects"` → `ProjectList`
- Jedes Projekt: Thumbnail + Name + Dropdown-Menue (Rename, Refresh Thumbnail, Delete)
- "+ New Project" Button am Ende
- Aktives Projekt hervorgehoben via `data-active`
- **Nested Items verfuegbar:** `SidebarMenuSub`, `SidebarMenuSubItem`, `SidebarMenuSubButton` (noch ungenutzt)
- SidebarFooter: User-Info + Back to Overview
- Keyboard Shortcut: Ctrl+B toggle
- Mobile: Sheet-Drawer (288px)

### Datenbank (existierende Beziehungen)
- `sourceGenerationId`: Self-ref FK auf `generations` — verlinkt Variation/img2img-Output zum Parent (SET NULL on delete)
- `batchId`: Shared UUID fuer Generationen aus demselben Request (Siblings)
- `getVariantFamily()` Query: Findet Root + direkte Kinder + Batch-Siblings — **nicht rekursiv** (mehrstufige Ketten A→B→C werden nicht vollstaendig aufgeloest)
- `generation_references` + `reference_images`: Many-to-many fuer img2img Reference-Provenance (role, strength, slotPosition)

### UI-Primitives verfuegbar (noch nicht fuer Collections genutzt)
- `DropdownMenu` (Radix UI) — Content mit Portal, z-50, Animationen
- `Popover` (Radix UI) — mit Anchor-Positionierung
- `AlertDialog` (shadcn) — Confirmation/Cancel Pattern
- `Dialog` (shadcn), `Sheet` (shadcn)

### Relevante Dateien
- DB Schema: `lib/db/schema.ts`
- DB Queries: `lib/db/queries.ts` (`getVariantFamily`)
- Sidebar: `components/sidebar.tsx`, `components/project-list.tsx`
- Sidebar Primitives: `components/ui/sidebar.tsx`
- Canvas Layout: `components/canvas/canvas-detail-view.tsx`
- Canvas Toolbar: `components/canvas/canvas-toolbar.tsx`
- Sibling Thumbnails: `components/canvas/sibling-thumbnails.tsx`
- Canvas Context: `lib/canvas-detail-context.tsx`
- Workspace Layout: `components/workspace/workspace-content.tsx`
- Gallery Grid: `components/workspace/gallery-grid.tsx`
- Generation Card: `components/workspace/generation-card.tsx`
- Filter Chips: `components/workspace/filter-chips.tsx`
- Workspace Header: `components/workspace/workspace-header.tsx`
- Workspace Page: `app/projects/[id]/page.tsx`
- Generation Service: `lib/services/generation-service.ts`
- Server Actions: `app/actions/generations.ts`

---

## UI Patterns

### Reused Patterns

| Pattern | Source | Reuse |
|---------|--------|-------|
| SiblingThumbnails | `components/canvas/sibling-thumbnails.tsx` | Umbauen zu Collection-Navigation (zeigt Collection-Inhalte statt Variant-Family) |
| GenerationCard | `components/workspace/generation-card.tsx` | Wiederverwendung im Collection View |
| Masonry Grid | `components/workspace/gallery-grid.tsx` | Wiederverwendung im Collection View |
| SidebarMenuSub | `components/ui/sidebar.tsx` | Collections als nested Items unter aktivem Projekt |
| DropdownMenu | `components/ui/dropdown-menu.tsx` | Kontextmenue auf Collection-Items |
| Drag & Drop | `GenerationCard` (`draggable="true"`) | Drag aus Gallery auf Sidebar-Collection-Item |

### New Patterns

| Pattern Type | Description | Rationale |
|--------------|-------------|-----------|
| Collection-Navigation (Canvas) | SiblingThumbnails zeigt Collection-Inhalte + Collection-Name-Label | Lineage-UI komplett durch Collections ersetzt |
| Collection-Switcher (Canvas) | Dropdown/Tabs wenn Bild in mehreren Collections | Many-to-many Beziehung erfordert Auswahl |
| Collection View (Workspace) | Dedizierte Ansicht fuer eine einzelne Collection | Ort/Layout noch offen (siehe Open Questions) |
| Sidebar Collection Items | Collections als Children des aktiven Projekts in Sidebar | Navigation + Drag-Target |

---

## User Flow

### Flow 1: Automatische Collection im Canvas

1. User generiert Bild A (txt2img) → Bild erscheint im Canvas
2. User generiert Variation/img2img aus A → Bild B erscheint
3. System prueft: Ist A bereits in einer auto-created Collection?
   - Nein → Neue Collection {A, B} erstellt, Name auto-generiert aus A's Prompt
   - Ja → B wird zu A's bestehender auto-created Collection hinzugefuegt
4. User generiert aus B weiter → Bild C wird automatisch zur selben Collection hinzugefuegt
5. Canvas zeigt Collection-Navigation: [A] [B] [●C] mit Collection-Name darunter

### Flow 2: Manuelle Collection erstellen

1. User erstellt Collection (Mechanismus noch offen: Kontextmenue auf Bild und/oder Sidebar)
2. Collection-Name eingeben (optional, auto-generiert wenn leer)
3. Bilder hinzufuegen: Kontextmenue "Zur Collection hinzufuegen" und/oder Drag aus Gallery auf Sidebar-Collection-Item

### Flow 3: Collection View anzeigen

> **OFFEN:** Wo und wie der Collection View angezeigt wird — siehe Open Questions #9

### Flow 4: Collection verwalten

1. Bild aus Collection entfernen → Bild bleibt in Galerie
2. Collection umbenennen → Inline-Edit oder Dialog
3. Collection aufloesen → Bilder bleiben, Gruppierung verschwindet

**Error Paths:**
- Letztes Bild (Nr. 2) aus auto-created Collection entfernen → Collection wird automatisch aufgeloest (Min. 2 Regel)
- Bild loeschen (Delete) das in Collection ist → Bild verschwindet aus Collection, bei <2 → auto-aufloesen
- Collection mit 0 Bildern (alle geloescht) → Collection wird entfernt

---

## UI Layout & Context

### Screen: Canvas — Collection-Navigation

**Position:** Unterhalb des Canvas-Bildes (bestehende Position von SiblingThumbnails)
**When:** Sobald das aktuelle Bild Teil einer Collection ist
**Content:** Horizontale Thumbnail-Reihe zeigt alle Bilder der Collection + Collection-Name-Label darunter
**Kein Bild in Collection:** Keine Thumbnails (bewusster Opt-in, keine Fallback-Anzeige)
**Mehrere Collections:** Collection-Switcher (Dropdown oder Tabs) zum Wechseln
**Aenderung gegenueber Ist-Zustand:** SiblingThumbnails (Lineage-basiert) wird komplett durch Collection-Navigation ersetzt

### Screen: Workspace — Collection View

> **OFFEN:** Wo lebt der Collection View? Welches Layout? — Siehe Open Questions #9

### Screen: Sidebar — Collection Items

**Position:** Als Children des aktiven Projekts in der Sidebar (`SidebarMenuSub`)
**When:** Wenn Collections fuer das aktive Projekt existieren
**Content:** Collection-Name + Bildzaehler, Dropdown-Menue (Rename, Aufloesen), Klick → Collection View
**Drag-Target:** GenerationCards aus Gallery auf Sidebar-Collection-Item droppen

---

## UI Components & States

> TODO: Nach Klaerung von Open Question #9 (Collection View) ausarbeiten

---

## Feature State Machine

> TODO: Nach Klaerung von Open Question #9 (Collection View) ausarbeiten

---

## Business Rules

- Eine Collection hat mindestens 2 Bilder (Ausnahme: manuell erstellt mit 1 Bild, wird nicht auto-aufgeloest bis User weiteres Bild hinzufuegt — nur auto-created Collections werden bei <2 aufgeloest)
- Ein Bild kann zu mehreren Collections gehoeren (many-to-many)
- Automatische Collection nur bei img2img/Variation im Canvas, nicht bei unabhaengigen txt2img
- Auto-Create Mechanik: Source-Bild in auto-created Collection pruefen → Ja: erweitern. Nein: neue Collection {Source, Output} erstellen. Manuelle Collections bleiben unberuehrt
- Auto-Create ist Convenience — keine Pflicht. User kann auch ohne Collections arbeiten
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
| `auto_created` | Yes | Boolean | Automatisch (Canvas img2img) vs. manuell erstellt |
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

> Grobe Aufteilung, wird nach Klaerung der offenen Fragen und Details-Phase verfeinert

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| 1 | Collection Data Model | DB-Schema (`collections` + `collection_items`), Drizzle Migration, CRUD Queries | CRUD-Tests | -- |
| 2 | Auto-Collection bei Variation/img2img | Generation-Service erweitern: nach img2img auto-create/extend Collection | Generiere Variation → Collection entsteht/waechst | Slice 1 |
| 3 | Canvas: Collection-Navigation | SiblingThumbnails durch Collection-Navigation ersetzen + Collection-Switcher | Collection-Bilder im Canvas sichtbar, Switcher bei mehreren | Slice 1 |
| 4 | Sidebar: Collection Items | Collections als Children des aktiven Projekts, Klick/Dropdown/Drag-Target | Collections in Sidebar sichtbar, Drag&Drop funktioniert | Slice 1 |
| 5 | Collection View | Dedizierte Ansicht einer Collection (Ort/Layout noch offen) | Collection-Bilder sichtbar, Navigation zum Canvas | Slice 1, 4 |
| 6 | Manuelle Collection-Erstellung + Verwaltung | Erstellen, Bilder hinzufuegen/entfernen, umbenennen, aufloesen | Alle Management-Aktionen funktionieren | Slice 1, 4 |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| 1 | Kann ein Bild zu mehreren Collections gehoeren? | A) Nein B) Ja | B) Ja | **B) Ja, mehrere** |
| 2 | Wie sieht der Collection-Indikator im Canvas aus? | A) Lineage-Chain B) Collection-Navigation C) Beides D) Nichts | B) | **B) Collection-Navigation (ersetzt SiblingThumbnails komplett)** |
| 3 | Wie werden Collections in der Galerie dargestellt? | A) Filter-Chip B) Sidebar C) Eigener View-Modus D) Stacked Cards | -- | **IN REVISION — siehe #9** |
| 4 | Welche Interaktionsmuster? | A) Kontextmenue B) Drag&Drop C) Selection-Mode | A+B | **Kontextmenue + Drag&Drop (Sidebar als Drop-Target)** |
| 5 | Soll Collection einen Namen haben? | A) Optional B) Pflicht C) Kein Name | A) | **A) Optional, auto-generiert** |
| 6 | Was passiert wenn Ursprungsbild geloescht wird? | A) Collection bleibt B) aufloesen | A) | **A) Collection bleibt, Bild verschwindet** |
| 7 | Collection-Datenmodell? | A) Lineage-basiert B) Eigenes Modell C) Hybrid | -- | **C) Hybrid (eigenes Modell + Canvas auto-create)** |
| 8 | Auto-Create Logik | A) Source-Bild pruefen B) Lineage-Root C) Immer neu | A) | **A) Source-Bild in auto-created Collection pruefen** |
| **9** | **Collection View: Wo lebt er, welches Layout, welche Interaktionen?** | **Siehe Details unten** | **--** | **OFFEN** |
| **10** | **Sidebar vs Filter-Chip vs beides fuer Collection-Navigation?** | **A) Sidebar only B) Filter-Chip only C) Beides** | **--** | **Tendenz Sidebar, aber Collection View noch unklar** |

### Details zu Open Question #9: Collection View

**Kontext:** Der User hat erkannt dass der Filter-Chip-Ansatz UX-Probleme hat und moechte die Anforderungen an einen Collection View grundsaetzlich klaeren.

**Teilfragen die geklaert werden muessen:**

1. **Wo lebt der Collection View?**
   - A) Ersetzt Gallery temporaer (wie Canvas es heute tut)
   - B) Innerhalb der Gallery als Inline-Section
   - C) Eigene Route (`/projects/[id]/collections/[cid]`)
   - D) Sidebar-Klick filtert Gallery auf Collection-Bilder
   - E) Anderer Ansatz?

2. **Welches Layout fuer den Collection View?**
   - A) Grid (wie Gallery)
   - B) Timeline/Flow (Bilder mit Pfeilen: A → B → C)
   - C) Storyboard (geordnete Sequenz)
   - D) Anderes Layout?

3. **Welche Interaktionen im Collection View?**
   - Bilder hinzufuegen (wie, wenn Collection-View nur Collection-Bilder zeigt?)
   - Bilder entfernen
   - Reihenfolge aendern
   - Klick → Canvas (mit Collection-Kontext)

4. **Wie kommt der User zum Collection View?**
   - Sidebar-Klick auf Collection
   - Kontextmenue auf Bild
   - Canvas → Link zum Collection View

**Evaluierte Optionen (Session 2026-03-21):**

| Option | Evaluiert | Ergebnis |
|--------|-----------|----------|
| Filter-Chip "Collections" | Ja | UX-Problem: Sackgasse beim Hinzufuegen. Non-collection Bilder ausgeblendet. Bricht Standard-Pattern (Lightroom, Google Photos nutzen parallele Navigation, nicht Filter) |
| Sidebar: Collections als Children des aktiven Projekts | Ja | Vorteile: Primitives existieren, Drag&Drop moeglich, kein Filter noetig, established Pattern. Nachteile: Collapsed Mode, Mobile, Drag-Target-Groesse. User: "Immer noch nicht ideal" — will Collection View Anforderungen erst klaeren |
| Eigener View-Modus (Tabs) | Vorgeschlagen | Nicht evaluiert |
| Stacked Cards | Vorgeschlagen | Nicht evaluiert |

**UX-Recherche Findings (2026-03-21):**

- Standard-Pattern: Collections/Albums koexistieren mit Hauptgalerie, ersetzen sie nicht
- Lightroom: Collections-Panel in linker Sidebar, Klick filtert Gallery
- Google Photos: "Albums" als eigener Tab, Hauptfeed bleibt
- Apple Photos: Albums in Sidebar, "Alle Fotos" immer erreichbar
- Pinterest: Boards als separate Ansicht, Pins aus Main Feed hinzufuegen
- Best Practice: "Add to Collection" muss aus jedem View heraus funktionieren

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
| 2026-03-21 | UX-Revision: Canvas | SiblingThumbnails wird komplett durch Collection-Navigation ersetzt. Kein Lineage-Fallback. Collection-Switcher bei mehreren Collections |
| 2026-03-21 | UX-Revision: Auto-Create | Auto-Create nur im Canvas (nicht in Galerie). Mechanik: Source-Bild in auto-created Collection pruefen. Ist Convenience, nicht Pflicht |
| 2026-03-21 | UX-Recherche: Galerie | Filter-Chip "Collections" hat UX-Probleme: Sackgasse beim Hinzufuegen, bricht Standard-Pattern. Recherchiert: Lightroom, Google Photos, Apple Photos, Pinterest — alle nutzen parallele Navigation (Sidebar/Tabs), nicht Filter |
| 2026-03-21 | Codebase: Sidebar | `SidebarMenuSub`/`SidebarMenuSubItem`/`SidebarMenuSubButton` Primitives existieren. Collections als Children des aktiven Projekts technisch moeglich. Drag-Target fuer GenerationCards moeglich |
| 2026-03-21 | UX-Evaluation: Sidebar | Sidebar-Variante evaluiert: Vorteile (Primitives da, D&D, kein Filter noetig). User findet es "noch nicht ideal", will erst Collection View Anforderungen klaeren |
| 2026-03-21 | Brainstorming | Collection View Anforderungen identifiziert: Ueberblick, Evolution verstehen, Weitermachen, Verwalten, Navigieren. Moegliche Orte: Gallery ersetzen, Inline, eigene Route. Layouts: Grid, Timeline/Flow, Storyboard |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| 1 | Soll erst eine umfassende Recherche durchgefuehrt werden oder direkt ein Draft erstellt werden? | Direkt Draft, Recherche spaeter |
| 2 | Collection-Modell: Lineage-basiert, eigenes Modell oder Hybrid? | Erst A) Lineage, dann korrigiert: Hybrid — Lineage auto-create + eigenes Modell fuer freie Erstellung/Bearbeitung. Entfernte Bilder sollen in Galerie bleiben, nur aus Collection verschwinden |
| 3 | Canvas-Visualisierung: Erweiterte SiblingThumbnails, Baumansicht im Details-Overlay oder beides? | Erweiterte SiblingThumbnails (Lineage-Chain unter dem Canvas-Bild) — **Revidiert in #9** |
| 4 | Galerie-Darstellung: Stacked Cards, eigener Tab, Inline-Gruppen oder Toggle? | Filter-Chip "Collections" + gruppiertes Grid mit Collection-Headers — **In Revision, siehe #11-#14** |
| 5 | Interaktionsmuster: Kontextmenue, Selection-Mode oder beides? | Kontextmenue (Rechtsklick) |
| 6 | Kann ein Bild zu mehreren Collections gehoeren? | Ja, mehrere (many-to-many) |
| 7 | Collection-Name: Optional, Pflicht oder kein Name? | Optional, auto-generiert aus Root-Prompt |
| 8 | Was passiert wenn Bild geloescht wird das in Collection ist? | Bild verschwindet aus Collection, bei <2 Bilder auto-Aufloesung |
| 9 | Canvas: Wie sollen Collections im Canvas sichtbar sein? (Erweiterte SiblingThumbnails vs. Collection-Navigation vs. beides vs. nichts) | **Collection-Navigation:** Thumbnails zeigen Collection-Inhalte (nicht Lineage). Collection-Name als Label darunter. Ersetzt SiblingThumbnails komplett |
| 10 | Wenn Bild in KEINER Collection ist: Was zeigen die Thumbnails im Canvas? | **Nichts.** Lineage wird komplett durch Collections ersetzt. Kein Fallback auf bisherige SiblingThumbnails |
| 11 | Wenn Bild in MEHREREN Collections ist: Welche wird im Canvas angezeigt? | **Collection-Switcher** — Dropdown oder Tabs zum Wechseln zwischen Collections |
| 12 | Galerie-Darstellung: Filter-Modus, Badge+Expand, Stacked Cards oder Sidebar? | **Filter-Modus** bestaetigt — dann aber durch UX-Recherche in Frage gestellt |
| 13 | Auto-Create: Soll es Auto-Create geben oder rein manuell? | **Auto-Create als Convenience** — aber nur im Canvas, nicht in der Galerie |
| 14 | Auto-Create Mechanik: Source-Bild pruefen, Lineage-Root verfolgen oder immer neu? | **Source-Bild pruefen:** Ist Source in auto-created Collection? Ja → erweitern. Nein → neue Collection {Source, Output}. Manuelle Collections bleiben unberuehrt |
| 15 | UX-Probleme beim Filter-Chip erkannt → wie soll Collection-Navigation in Galerie funktionieren? | User wollte erst Sidebar evaluieren. Sidebar evaluiert: "Immer noch nicht ideal". **Naechster Schritt: Collection View Anforderungen klaeren** (in naechster Session) |
