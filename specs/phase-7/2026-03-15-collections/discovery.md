# Feature: Image Collections

**Epic:** --
**Status:** Review
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
- Collection View: Eigene Route (`/projects/[id]/collections/[cid]`) mit Masonry Grid

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
| Manuelle Collection-Erstellung via Bild-Kontextmenue + Sidebar + Header-Dropdown |
| Bilder zu bestehender Collection hinzufuegen (Kontextmenue in Gallery + Canvas, Drag&Drop auf Sidebar) |
| Bilder aus Collection entfernen (Bild bleibt in Galerie) |
| Collection aufloesen (Bilder bleiben, Lineage bleibt intakt) |
| Canvas: Collection-Navigation (ersetzt SiblingThumbnails) mit Collection-Switcher |
| Collection View: Eigene Route mit Masonry Grid, Sortierung, Drag&Drop Reorder |
| Sidebar: Collections als nested Items unter aktivem Projekt (optional, nicht Pflicht) |
| Header-Breadcrumb: Navigation zwischen Gallery und Collection View |
| Canvas-Rueckkehr: Kontextsensitiv (zurueck zum Aufrufer — Gallery oder Collection View) |
| Collection-Benennung: Optional, auto-generiert aus Root-Prompt |
| Leere Collections erlaubt (manuell erstellt, werden spaeter befuellt) |

| Out of Scope |
|--------------|
| Collection-Export als ZIP/Bundle |
| Collection-Sharing/Collaboration |
| Collection-Templates/Presets |
| Cross-Project Collections |
| Multi-Select / Bulk-Selection-Mode |

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

### Workspace Header
- Nur Projekt-Name (klickbar fuer Rename)
- Keine Breadcrumbs
- Layout: SidebarTrigger (mobile) | Project Name | Settings, Theme Toggle, More Menu

### Workspace Architektur
- Single-Page (`/projects/[id]`), kein Sub-Routing
- View-Switching: State-basiert, Gallery & Canvas beide gemounted, Sichtbarkeit per `display: none`
- View Transitions: `startViewTransitionIfSupported()` vorhanden
- Filter State: `modeFilter` lokal in `WorkspaceContent`

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
| GenerationCard | `components/workspace/generation-card.tsx` | Wiederverwendung im Collection View Grid |
| Masonry Grid | `components/workspace/gallery-grid.tsx` | Wiederverwendung im Collection View |
| SidebarMenuSub | `components/ui/sidebar.tsx` | Collections als nested Items unter aktivem Projekt |
| DropdownMenu | `components/ui/dropdown-menu.tsx` | Kontextmenue auf Bildern (Gallery + Canvas + Collection View) |
| Drag & Drop | `GenerationCard` (`draggable="true"`) | Drag aus Gallery auf Sidebar-Collection-Item + Reorder im Collection View |
| View Transition | `startViewTransitionIfSupported()` | Uebergang Gallery ↔ Collection View |

### New Patterns

| Pattern Type | Description | Rationale |
|--------------|-------------|-----------|
| Collection-Navigation (Canvas) | SiblingThumbnails zeigt Collection-Inhalte + Collection-Name-Label | Lineage-UI komplett durch Collections ersetzt |
| Collection-Switcher (Canvas) | Dropdown wenn Bild in mehreren Collections | Many-to-many Beziehung erfordert Auswahl |
| Header-Breadcrumb / View-Switcher | Header zeigt "Projekt > Collection Name" mit Zurueck-Navigation | Sidebar-unabhaengige Navigation, funktioniert auch bei collapsed Sidebar |
| Collection View Page | Eigene Route `/projects/[id]/collections/[cid]` mit Masonry Grid | Industry-Standard: Eigene Route fuer Collections (Google Photos, Pinterest, Lightroom) |
| Sidebar Collection Items | Collections als Children des aktiven Projekts in Sidebar | Navigation + Drag-Target (optional, Sidebar muss nicht offen sein) |
| Kontextmenue "Zur Collection" | Submenu mit Collection-Liste + "Neue Collection" im Bild-Kontextmenue | Standard-Pattern (Google Photos "Add to Album", Pinterest "Save to Board") |
| Drag&Drop Reorder | Bilder im Collection View per Drag&Drop umsortieren | Manuelle Reihenfolge fuer kuratierte Collections (Lightroom Custom Sort Order) |

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

**Weg A: Aus Bild heraus**
1. User rechtsklickt auf Bild (Gallery oder Canvas) → Kontextmenue erscheint
2. "Neue Collection erstellen" waehlen
3. Name-Input (optional, auto-generiert wenn leer) → Collection erstellt mit diesem Bild
4. Collection erscheint in Sidebar (wenn offen) und Header-Dropdown

**Weg B: Aus Sidebar/Header**
1. User klickt "+ Neue Collection" in Sidebar oder Header-Dropdown
2. Name-Input (optional) → Leere Collection erstellt
3. User fuegt spaeter Bilder hinzu (Kontextmenue oder Drag&Drop)

### Flow 3: Bilder zu Collection hinzufuegen

**Weg A: Kontextmenue (Gallery + Canvas)**
1. User rechtsklickt auf Bild → Kontextmenue
2. "Zur Collection hinzufuegen" → Submenu zeigt bestehende Collections + "Neue Collection"
3. Collection waehlen → Bild wird hinzugefuegt, kurzes Feedback (Toast)

**Weg B: Drag&Drop (Gallery → Sidebar)**
1. User zieht GenerationCard aus Gallery
2. Sidebar-Collection-Item wird als Drop-Target hervorgehoben (Highlight bei Hover)
3. Drop → Bild zur Collection hinzugefuegt, kurzes Feedback

### Flow 4: Collection View anzeigen

**Weg A: Sidebar-Klick**
1. User klickt auf Collection-Item in Sidebar
2. Browser navigiert zu `/projects/[id]/collections/[cid]`
3. Collection View zeigt: Header (Name, Breadcrumb, Aktionen) + Masonry Grid mit Collection-Bildern

**Weg B: Header-Dropdown**
1. User oeffnet View-Switcher/Dropdown im Header
2. Waehlt Collection aus Liste
3. Navigation zur Collection-Route

**Weg C: Kontextmenue auf Bild**
1. User rechtsklickt Bild → "In Collection anzeigen" (wenn Bild in Collection ist)
2. Bei mehreren Collections: Submenu zur Auswahl
3. Navigation zur Collection-Route

### Flow 5: Collection View → Canvas → Zurueck

1. User ist im Collection View
2. Klickt auf Bild → Canvas oeffnet sich
3. Canvas merkt sich Herkunft: Collection View
4. User schliesst Canvas (X-Button oder ESC) → zurueck zum Collection View (nicht zur Gallery)
5. Browser-Back funktioniert ebenfalls (History-basiert)

### Flow 6: Collection verwalten

**Im Collection View:**
1. Bild aus Collection entfernen → Kontextmenue auf Bild → "Aus Collection entfernen" → Bild verschwindet aus Grid, bleibt in Gallery
2. Collection umbenennen → Klick auf Collection-Name im Header → Inline-Edit
3. Collection aufloesen → Drei-Punkt-Menue im Header → "Collection aufloesen" → Confirmation-Dialog → Bilder bleiben, Collection verschwindet, Navigation zurueck zur Gallery
4. Sortierung aendern → Dropdown: "Chronologisch" / "Manuell" → bei "Manuell": Drag&Drop Reorder aktiv
5. "Bilder hinzufuegen" Button → navigiert zur Gallery (Collection bleibt als Ziel im Kontextmenue)

**In Sidebar:**
1. Rechtsklick/Drei-Punkt-Menue auf Collection-Item → Rename, Aufloesen

**Error Paths:**
- Letztes Bild (Nr. 2) aus auto-created Collection entfernen → Collection wird automatisch aufgeloest (Min. 2 Regel)
- Bild loeschen (Delete) das in Collection ist → Bild verschwindet aus Collection, bei <2 → auto-aufloesen
- Collection mit 0 Bildern (alle geloescht) → Collection wird entfernt
- Collection View einer aufgeloesten Collection → Redirect zur Gallery + Info-Toast

---

## UI Layout & Context

### Screen: Canvas — Collection-Navigation

**Position:** Unterhalb des Canvas-Bildes (bestehende Position von SiblingThumbnails)
**When:** Sobald das aktuelle Bild Teil einer Collection ist
**Content:** Horizontale Thumbnail-Reihe zeigt alle Bilder der Collection + Collection-Name-Label darunter
**Kein Bild in Collection:** Keine Thumbnails (bewusster Opt-in, keine Fallback-Anzeige)
**Mehrere Collections:** Collection-Switcher (Dropdown) zum Wechseln
**Aenderung gegenueber Ist-Zustand:** SiblingThumbnails (Lineage-basiert) wird komplett durch Collection-Navigation ersetzt

### Screen: Collection View (`/projects/[id]/collections/[cid]`)

**Position:** Eigene Route, ersetzt Workspace-Content
**When:** User navigiert zu einer Collection (Sidebar-Klick, Header-Dropdown, Kontextmenue)
**Layout:**
- Header-Bereich: Zurueck-Button (← Projekt) | Collection-Name (klickbar fuer Rename) | Bild-Zaehler | Drei-Punkt-Menue (Aufloesen) | Sortierungs-Dropdown
- Filter-Chips: Gleiche Mode-Filter wie Gallery (Alle / txt2img / img2img / upscale)
- Content: Masonry Grid mit GenerationCards (gleiche Komponente wie Gallery)
- "Bilder hinzufuegen" Button (fuehrt zur Gallery)
- Empty State: "Diese Collection ist leer. Fuege Bilder ueber die Galerie hinzu." + Button zur Gallery

### Screen: Workspace Header — View-Switcher

**Position:** Im bestehenden Workspace-Header, ersetzt einfachen Projekt-Namen
**When:** Immer (zeigt aktuelle Position)
**Content:**
- Gallery-Modus: "Projekt-Name" (wie bisher) + optional Dropdown-Indikator
- Collection-Modus: "← Projekt-Name > Collection-Name"
- Dropdown zeigt: "Alle Bilder" + Liste aller Collections + "+ Neue Collection"

### Screen: Sidebar — Collection Items

**Position:** Als Children des aktiven Projekts in der Sidebar (`SidebarMenuSub`)
**When:** Wenn Collections fuer das aktive Projekt existieren
**Content:** Collection-Name + Bildzaehler, Dropdown-Menue (Rename, Aufloesen), Klick → Collection View Route
**Drag-Target:** GenerationCards aus Gallery auf Sidebar-Collection-Item droppen → Highlight-Feedback bei Hover
**Collapsed Sidebar:** Collections nicht sichtbar (Header-Navigation als Alternative)

---

## UI Components & States

| Element | Type | Location | States | Behavior |
|---------|------|----------|--------|----------|
| Collection-Navigation | Thumbnail-Strip | Canvas, unterhalb Bild | `hidden` (kein Collection-Bild), `visible` (Bild in Collection), `multi` (mehrere Collections → Switcher) | Klick auf Thumbnail → Canvas wechselt Bild |
| Collection-Switcher | Dropdown | Canvas, ueber Collection-Navigation | `single` (nur 1 Collection, nicht sichtbar), `multi` (Dropdown mit Collection-Liste) | Dropdown-Auswahl wechselt angezeigte Collection |
| Header View-Switcher | Breadcrumb + Dropdown | Workspace Header | `gallery` (Projekt-Name + Dropdown), `collection` (← Projekt > Coll-Name + Dropdown) | Klick auf Dropdown zeigt Collections, Klick auf ← zurueck zur Gallery |
| Sidebar Collection-Item | SidebarMenuSubItem | Sidebar, unter aktivem Projekt | `default`, `active` (aktuell angezeigt), `drag-over` (Bild wird drueber gezogen) | Klick → Collection View, Drag-Target fuer Bilder |
| Collection View Grid | Masonry Grid | Collection View Page | `loading`, `empty` (keine Bilder), `populated`, `reorder` (Drag&Drop aktiv) | Zeigt Collection-Bilder, Klick → Canvas |
| Kontextmenue "Zur Collection" | DropdownMenu + Submenu | Gallery, Canvas, Collection View | `no-collections` (nur "Neue Collection"), `has-collections` (Liste + "Neue Collection") | Submenu zeigt Collections, Klick fuegt hinzu |
| Sort-Dropdown | DropdownMenu | Collection View Header | `chronological` (default), `manual` | Wechselt Sortierung, bei `manual` wird Drag&Drop Reorder aktiv |
| Reorder-Drag | Drag&Drop | Collection View Grid (nur bei Sort: Manual) | `idle`, `dragging` (Bild wird gezogen), `drag-over` (Zielposition hervorgehoben) | Drag&Drop aendert `collection_items.position` |
| Collection-Name-Edit | Inline-Input | Collection View Header | `display` (Name als Text), `editing` (Input-Feld) | Klick → Edit-Modus, Enter/Blur → speichern |

---

## Feature State Machine

### States Overview

| State | UI | Available Actions |
|-------|----|--------------------|
| `gallery` | Gallery-Grid mit allen Bildern | Bilder anzeigen, filtern, zu Collection hinzufuegen (Kontextmenue), Drag auf Sidebar-Collection, neue Collection erstellen |
| `collection-view` | Collection-Grid mit Collection-Bildern | Bilder anzeigen, filtern, sortieren, reordern, entfernen, Collection umbenennen/aufloesen, Bild im Canvas oeffnen |
| `collection-view-empty` | Empty State mit Hinweis | Zur Gallery navigieren, Collection umbenennen/aufloesen |
| `canvas-from-gallery` | Canvas mit Bild aus Gallery | Alle Canvas-Aktionen, Collection-Navigation (wenn Bild in Collection), Schliessen → zurueck zur Gallery |
| `canvas-from-collection` | Canvas mit Bild aus Collection View | Alle Canvas-Aktionen, Collection-Navigation, Schliessen → zurueck zum Collection View |

### Transitions

| Current State | Trigger | UI Feedback | Next State | Business Rules |
|---------------|---------|-------------|------------|----------------|
| `gallery` | Sidebar-Klick auf Collection | Page-Navigation | `collection-view` | -- |
| `gallery` | Header-Dropdown → Collection waehlen | Page-Navigation | `collection-view` | -- |
| `gallery` | Kontextmenue → "In Collection anzeigen" | Page-Navigation | `collection-view` | Nur wenn Bild in Collection |
| `gallery` | Klick auf Bild | View Transition | `canvas-from-gallery` | -- |
| `collection-view` | Klick auf Bild | View Transition | `canvas-from-collection` | -- |
| `collection-view` | Header ← Zurueck | Page-Navigation | `gallery` | -- |
| `collection-view` | Letztes Bild entfernt (auto-created Collection) | Redirect + Toast | `gallery` | Auto-Aufloesung bei <2 Bildern |
| `collection-view` | Collection aufloesen | Confirmation → Redirect + Toast | `gallery` | -- |
| `collection-view` | Alle Bilder entfernt (manuell) | UI-Update | `collection-view-empty` | Leere Collection bleibt bestehen |
| `collection-view-empty` | "Zur Gallery" Button | Page-Navigation | `gallery` | -- |
| `canvas-from-gallery` | Schliessen (X / ESC) | View Transition | `gallery` | -- |
| `canvas-from-collection` | Schliessen (X / ESC) | View Transition | `collection-view` | Herkunft wird in State/History gespeichert |
| `canvas-*` | img2img / Variation generieren | Toast "Zur Collection hinzugefuegt" | `canvas-*` | Auto-Create Logik greift |

---

## Business Rules

- Eine Collection hat mindestens 2 Bilder (Ausnahme: manuell erstellt — auch leere/1-Bild Collections bleiben bestehen. Nur auto-created Collections werden bei <2 aufgeloest)
- Ein Bild kann zu mehreren Collections gehoeren (many-to-many)
- Automatische Collection nur bei img2img/Variation im Canvas, nicht bei unabhaengigen txt2img
- Auto-Create Mechanik: Source-Bild in auto-created Collection pruefen → Ja: erweitern. Nein: neue Collection {Source, Output} erstellen. Manuelle Collections bleiben unberuehrt
- Auto-Create ist Convenience — keine Pflicht. User kann auch ohne Collections arbeiten
- Collection-Name: Optional, auto-generiert aus Root-Bild-Prompt (erste Woerter), jederzeit umbenennbar
- Lineage (`sourceGenerationId`) wird NIE durch Collection-Aktionen veraendert
- Bild aus Collection entfernen = nur aus `collection_items` loeschen, Bild bleibt in Galerie
- Collection aufloesen = `collection_items` + `collections` Eintrag loeschen, Bilder bleiben
- Bild loeschen (Delete) → verschwindet aus allen Collections, bei <2 Bilder → auto-Aufloesung (nur auto-created)
- Canvas-Rueckkehr: Kontextsensitiv — Browser-History bestimmt Ziel (Gallery oder Collection View)
- Drag&Drop Reorder: Nur im Collection View, nur bei Sortierung "Manuell". Position wird in `collection_items.position` gespeichert
- Default-Sortierung: Chronologisch nach `added_at`

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
| `position` | No | Integer | Reihenfolge in der Collection (fuer manuelles Reorder) |

**Unique Constraint:** `(collection_id, generation_id)` — ein Bild max. einmal pro Collection

---

## Trigger-Inventory

| Trigger | Quelle | Collection-Aktion | Kontext |
|---------|--------|-------------------|---------|
| img2img/Variation generiert | Canvas Generation-Service | Auto-Create oder Auto-Extend Collection | Nur auto-created Collections, Source-Bild pruefen |
| "Neue Collection erstellen" | Kontextmenue (Gallery, Canvas), Sidebar, Header-Dropdown | Collection INSERT + optional erstes Bild | Manuell erstellt (`auto_created: false`) |
| "Zur Collection hinzufuegen" | Kontextmenue (Gallery, Canvas) | collection_items INSERT | Submenu mit Collection-Liste |
| Drag&Drop auf Sidebar-Item | Gallery → Sidebar | collection_items INSERT | Nur wenn Sidebar offen |
| "Aus Collection entfernen" | Kontextmenue (Collection View) | collection_items DELETE, ggf. Auto-Aufloesung | Pruefe Min-2-Regel bei auto-created |
| "Collection aufloesen" | Collection View Header, Sidebar Kontextmenue | collection_items DELETE ALL + collections DELETE | Confirmation-Dialog |
| "Collection umbenennen" | Collection View Header (Inline-Edit), Sidebar Kontextmenue | collections UPDATE name | -- |
| Bild loeschen (Delete) | Canvas Toolbar, Gallery Kontextmenue | CASCADE: collection_items DELETE, ggf. Auto-Aufloesung | Pruefe alle betroffenen Collections |
| Drag&Drop Reorder | Collection View Grid (nur bei Sort: Manual) | collection_items UPDATE position | Batch-Update aller betroffenen Positionen |
| Sortierung wechseln | Collection View Sort-Dropdown | UI-only (kein DB-Write) | Wechsel zwischen chronologisch/manuell |

---

## Implementation Slices

### Dependencies

```
Slice 1 (Data Model) → Slice 2 (Auto-Create)
                     → Slice 3 (Canvas Nav)
                     → Slice 4 (CRUD + Kontextmenue)
                                ↓
                        Slice 5 (Sidebar)
                        Slice 6 (Collection View Route)
                                ↓
                        Slice 7 (Reorder + Sort)
```

### Slices

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| 1 | Collection Data Model | DB-Schema (`collections` + `collection_items`), Drizzle Migration, CRUD Queries (create, get, list, addItem, removeItem, delete, updateName, updatePosition) | CRUD-Tests gegen DB | -- |
| 2 | Auto-Collection bei Variation/img2img | Generation-Service erweitern: nach img2img/Variation auto-create/extend Collection. Auto-Aufloesung bei <2 Bildern | Generiere Variation → Collection entsteht/waechst. Loesche Bild → Auto-Aufloesung | Slice 1 |
| 3 | Canvas: Collection-Navigation | SiblingThumbnails durch Collection-Navigation ersetzen. Collection-Switcher (Dropdown) bei mehreren Collections. Keine Thumbnails wenn kein Collection-Bild | Collection-Bilder im Canvas sichtbar, Switcher bei mehreren, nichts bei keiner Collection | Slice 1 |
| 4 | Collection CRUD + Kontextmenue | Server Actions fuer Collection-Management. Kontextmenue auf Bildern in Gallery + Canvas: "Neue Collection", "Zur Collection hinzufuegen", "In Collection anzeigen" | Erstelle Collection via Kontextmenue, fuege Bild hinzu, navigiere zu Collection | Slice 1 |
| 5 | Sidebar: Collection Items | Collections als `SidebarMenuSubItem` unter aktivem Projekt. Klick → Navigation zur Collection-Route. Dropdown-Menue (Rename, Aufloesen). Drag&Drop Target fuer GenerationCards | Collections in Sidebar sichtbar, Klick navigiert, Drag&Drop funktioniert | Slice 1, 4 |
| 6 | Collection View Route + Header | Eigene Route `/projects/[id]/collections/[cid]`. Page-Komponente mit Masonry Grid (GalleryGrid wiederverwendet). Header-Breadcrumb (← Projekt > Collection-Name). Kontextsensitive Canvas-Rueckkehr. Empty State | Collection-Bilder sichtbar, Navigation Gallery ↔ Collection View ↔ Canvas funktioniert | Slice 1, 4 |
| 7 | Collection View: Sort + Reorder | Sort-Dropdown (Chronologisch / Manuell). Drag&Drop Reorder im manuellen Modus. Position in `collection_items.position` persistieren | Sortierung wechseln, Bilder umsortieren, Reihenfolge bleibt nach Reload | Slice 6 |

### Recommended Order

1. **Slice 1:** Data Model — Fundament, keine UI-Abhaengigkeiten
2. **Slice 2:** Auto-Create — Kernfeature, erste sichtbare Wirkung
3. **Slice 3:** Canvas Navigation — Wichtigster Touchpoint, ersetzt SiblingThumbnails
4. **Slice 4:** CRUD + Kontextmenue — Manuelle Verwaltung, Grundlage fuer alle weiteren Slices
5. **Slice 5:** Sidebar — Optionale Navigation, Drag&Drop
6. **Slice 6:** Collection View Route — Dedizierte Ansicht
7. **Slice 7:** Sort + Reorder — Nice-to-have, aufbauend auf Collection View

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| 1 | Kann ein Bild zu mehreren Collections gehoeren? | A) Nein B) Ja | B) Ja | **B) Ja, mehrere** |
| 2 | Wie sieht der Collection-Indikator im Canvas aus? | A) Lineage-Chain B) Collection-Navigation C) Beides D) Nichts | B) | **B) Collection-Navigation (ersetzt SiblingThumbnails komplett)** |
| 3 | Wie werden Collections in der Galerie dargestellt? | A) Filter-Chip B) Sidebar C) Eigener View-Modus D) Stacked Cards | -- | **Sidebar (optional) + Header-Dropdown + eigene Route** |
| 4 | Welche Interaktionsmuster? | A) Kontextmenue B) Drag&Drop C) Selection-Mode | A+B | **Kontextmenue (Gallery + Canvas) + Drag&Drop (Sidebar als Drop-Target)** |
| 5 | Soll Collection einen Namen haben? | A) Optional B) Pflicht C) Kein Name | A) | **A) Optional, auto-generiert** |
| 6 | Was passiert wenn Ursprungsbild geloescht wird? | A) Collection bleibt B) aufloesen | A) | **A) Collection bleibt, Bild verschwindet** |
| 7 | Collection-Datenmodell? | A) Lineage-basiert B) Eigenes Modell C) Hybrid | -- | **C) Hybrid (eigenes Modell + Canvas auto-create)** |
| 8 | Auto-Create Logik | A) Source-Bild pruefen B) Lineage-Root C) Immer neu | A) | **A) Source-Bild in auto-created Collection pruefen** |
| 9 | Collection View: Wo, Layout, Interaktionen? | Siehe Details | -- | **Eigene Route + Masonry Grid + Standard-Interaktionen (Sort, Reorder, Entfernen)** |
| 10 | Navigation zu Collections? | A) Sidebar only B) Header only C) Sidebar + Header | C) | **C) Sidebar optional + Header-Breadcrumb (beide Wege gleichwertig)** |

---

## Context & Research

### UX-Recherche: Collection View Patterns (2026-03-22)

| App | Collection-Ansatz | Layout | Navigation |
|-----|-------------------|--------|------------|
| Google Photos | Albums als eigene Route mit shareabler URL | Quilted Grid (3 Layout-Modi: Comfortable, Day, Month) | Library Tab → Albums → Album-Route |
| Apple Photos (iOS 18) | Albums als Push-Navigation (voller Screen) | Uniform Grid | Einzelne scrollbare Seite, Albums darunter |
| Apple Photos (macOS) | Albums in Sidebar, Content-Area wechselt | Uniform Grid | Sidebar-Klick aendert Content |
| Lightroom | Collections in Sidebar, eigene Ansicht | Square Grid | Sidebar-Klick → Grid View |
| Pinterest | Boards als eigene Route | Masonry Grid | Profile → Boards Grid → Board-Route |
| Dribbble | Collections als eigene Full-Page-Route | Grid | Profil → Collections → Collection-Page |
| Figma | Projects als eigene Route | Grid mit File-Covers | Sidebar → Team → Project → Files |
| Canva | Folders als eigene Route, verschachtelbar | Grid / List umschaltbar | Projects Tab → Folder → Inhalt |

**Kern-Findings:**
- Alle untersuchten Apps nutzen eigene Route/View fuer Collections — kein Modal, kein Overlay
- Manuelle Collections erlauben Drag&Drop Reorder (Lightroom Custom Sort Order)
- "Add to Collection" muss aus jedem View funktionieren (nicht nur aus Collection View)
- Mobile: Push-Navigation (Collection als voller Screen, zurueck per Back-Button/Swipe)
- Sidebar + Content Area ist Standard-Desktop-Pattern (Apple Photos macOS, Lightroom)

### Codebase-Recherche: Workspace-Architektur (2026-03-22)

| Aspekt | Finding |
|--------|---------|
| Routing | Single-Page (`/projects/[id]`), kein Sub-Routing. Eigene Collection-Route erfordert neue Page |
| View-Switching | State-basiert: Gallery & Canvas gemounted, Sichtbarkeit per `display: none` |
| Sidebar | Flache Projekt-Liste, `SidebarMenuSub` Primitives vorhanden aber ungenutzt |
| Header | Nur Projekt-Name, keine Breadcrumbs. Muss erweitert werden |
| Filter | `modeFilter` lokal in `WorkspaceContent` (`useState`) |
| View Transitions | `startViewTransitionIfSupported()` vorhanden |

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
| 2026-03-22 | UX-Recherche: Collection View | Alle grossen Apps (Google Photos, Apple Photos, Lightroom, Pinterest, Dribbble, Figma, Canva) nutzen eigene Route/View. Kein Modal/Overlay. Grid-Layout Standard. Sidebar + Content Area ist Desktop-Pattern |
| 2026-03-22 | Codebase: Workspace-Architektur | Single-Page, State-basiertes View-Switching, keine Breadcrumbs. Eigene Route erfordert neue Page-Komponente |
| 2026-03-22 | Entscheidung: Collection View | Eigene Route `/projects/[id]/collections/[cid]`, Masonry Grid, Sidebar optional + Header-Breadcrumb |
| 2026-03-22 | Entscheidung: Interaktionen | Kontextmenue (Gallery + Canvas) + Drag&Drop (Sidebar). Standard-Interaktionen im Collection View (Sort, Reorder, Entfernen). Canvas-Rueckkehr kontextsensitiv |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| 1 | Soll erst eine umfassende Recherche durchgefuehrt werden oder direkt ein Draft erstellt werden? | Direkt Draft, Recherche spaeter |
| 2 | Collection-Modell: Lineage-basiert, eigenes Modell oder Hybrid? | Erst A) Lineage, dann korrigiert: Hybrid — Lineage auto-create + eigenes Modell fuer freie Erstellung/Bearbeitung. Entfernte Bilder sollen in Galerie bleiben, nur aus Collection verschwinden |
| 3 | Canvas-Visualisierung: Erweiterte SiblingThumbnails, Baumansicht im Details-Overlay oder beides? | Erweiterte SiblingThumbnails (Lineage-Chain unter dem Canvas-Bild) — **Revidiert in #9** |
| 4 | Galerie-Darstellung: Stacked Cards, eigener Tab, Inline-Gruppen oder Toggle? | Filter-Chip "Collections" + gruppiertes Grid mit Collection-Headers — **Revidiert in #15-#16** |
| 5 | Interaktionsmuster: Kontextmenue, Selection-Mode oder beides? | Kontextmenue (Rechtsklick) |
| 6 | Kann ein Bild zu mehreren Collections gehoeren? | Ja, mehrere (many-to-many) |
| 7 | Collection-Name: Optional, Pflicht oder kein Name? | Optional, auto-generiert aus Root-Prompt |
| 8 | Was passiert wenn Bild geloescht wird das in Collection ist? | Bild verschwindet aus Collection, bei <2 Bilder auto-Aufloesung |
| 9 | Canvas: Wie sollen Collections im Canvas sichtbar sein? | **Collection-Navigation:** Thumbnails zeigen Collection-Inhalte (nicht Lineage). Collection-Name als Label darunter. Ersetzt SiblingThumbnails komplett |
| 10 | Wenn Bild in KEINER Collection ist: Was zeigen die Thumbnails im Canvas? | **Nichts.** Lineage wird komplett durch Collections ersetzt. Kein Fallback auf bisherige SiblingThumbnails |
| 11 | Wenn Bild in MEHREREN Collections ist: Welche wird im Canvas angezeigt? | **Collection-Switcher** — Dropdown zum Wechseln zwischen Collections |
| 12 | Galerie-Darstellung: Filter-Modus, Badge+Expand, Stacked Cards oder Sidebar? | **Filter-Modus** bestaetigt — dann aber durch UX-Recherche in Frage gestellt |
| 13 | Auto-Create: Soll es Auto-Create geben oder rein manuell? | **Auto-Create als Convenience** — aber nur im Canvas, nicht in der Galerie |
| 14 | Auto-Create Mechanik: Source-Bild pruefen, Lineage-Root verfolgen oder immer neu? | **Source-Bild pruefen:** Ist Source in auto-created Collection? Ja → erweitern. Nein → neue Collection {Source, Output}. Manuelle Collections bleiben unberuehrt |
| 15 | UX-Probleme beim Filter-Chip erkannt → wie soll Collection-Navigation in Galerie funktionieren? | User wollte erst Sidebar evaluieren. Sidebar evaluiert: "Immer noch nicht ideal". Collection View Anforderungen klaeren |
| 16 | Wo soll der Collection View leben? (State-basiert, eigene Route, Hybrid URL-Param) | **Eigene Route** (`/projects/[id]/collections/[cid]`). Bedenken: Sidebar auf iPad nimmt Platz, muss aber nicht offen sein fuer Collection-Navigation |
| 17 | Wie soll die Collection-Navigation funktionieren? (Header-Dropdown, Content-Tabs, Sidebar+Header) | **Sidebar optional + Header-Breadcrumb.** Sidebar zeigt Collections wenn offen, Header-Breadcrumb navigiert wenn Sidebar zu. Beide Wege gleichwertig |
| 18 | Welches Layout soll der Collection View nutzen? (Masonry Grid, Horizontaler Flow, Grid+Reorder) | **Masonry Grid** wie Gallery. Vertraut, konsistent, GalleryGrid wiederverwendbar |
| 19 | Wie fuegt der User Bilder manuell zu einer Collection hinzu? (Kontextmenue, +Drag&Drop, +Canvas-Button) | **Kontextmenue + Drag&Drop.** Kontextmenue in Gallery UND Canvas. Drag&Drop auf Sidebar-Collection-Items wenn Sidebar offen |
| 20 | Welche Interaktionen im Collection View? (Minimal, Standard, Erweitert) | **Standard:** Klick→Canvas, Kontextmenue entfernen, Rename/Aufloesen, Sortierung (Chronologisch/Manuell), Drag&Drop Reorder, "Bilder hinzufuegen" Button |
| 21 | Collections erstellen: Nur via Bild-Kontextmenue oder auch via Sidebar/Header? | **Auch via Sidebar/Header.** Leere Collections erlaubt, die spaeter befuellt werden |
| 22 | Canvas-Rueckkehr: Wohin fuehrt Schliessen? | **Kontextsensitiv:** Kam von Gallery → zurueck zur Gallery. Kam von Collection View → zurueck zum Collection View. Browser-History basiert |
| 23 | Reorder im Collection View? | **Ja, Drag&Drop Reorder.** Position in `collection_items.position` gespeichert. Nur bei Sortierung "Manuell" aktiv |
