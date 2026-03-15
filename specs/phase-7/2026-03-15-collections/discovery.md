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
- Collections: Gruppierung zusammengehoeriger Bilder mit sichtbaren Indikatoren
- Automatische Collection-Bildung im Canvas (wenn Bild aus anderem Bild generiert wird)
- Manuelle Verwaltung: starten, aufheben, Bilder entfernen/hinzufuegen
- Collections auch im Workspace/Galerie sichtbar und verwaltbar

**Business Value:**
- Workflow-Beschleunigung: Design-Ketten auf einen Blick erkennen
- Bessere Organisation bei vielen Generationen
- Export-Vorbereitung: zusammengehoerige Assets als Set verwalten

---

## Scope & Boundaries

| In Scope |
|----------|
| Automatische Collection-Bildung bei img2img/Variation im Canvas |
| Sichtbare Indikatoren im Canvas (Verbindungslinien, Badge, Rahmen o.ae.) |
| Collection starten/aufheben im Canvas |
| Bilder aus Collection entfernen |
| Collections in Workspace-Galerie anzeigen |
| Collections in Galerie verwalten (hinzufuegen/entfernen/aufloesen) |
| Interaktionsmuster: Drag&Drop, Kontextmenue, etc. (auszuspezifizieren) |

| Out of Scope |
|--------------|
| Collection-Export als ZIP/Bundle |
| Collection-Sharing/Collaboration |
| Collection-Templates/Presets |
| Cross-Project Collections |

---

## Current State Reference

> TODO: Codebase-Recherche ausstehend. Zu klaeren:

- Canvas: Wie werden Bilder aktuell dargestellt? Gibt es parent/child Relationen?
- Galerie: Aktuelle Darstellungs- und Filterlogik
- DB: Gibt es bestehende Beziehungen zwischen Generationen (source_image, parent_generation)?
- img2img: Wie wird aktuell die Verbindung zwischen Input-Bild und Output gespeichert?

---

## UI Patterns

### Reused Patterns

> TODO: Codebase-Recherche

### New Patterns

| Pattern Type | Description | Rationale |
|--------------|-------------|-----------|
| Collection Indicator (Canvas) | Visuelle Gruppierung zusammengehoeriger Bilder | Kein bestehendes Grouping-Pattern im Canvas |
| Collection Badge | Zaehler/Indikator an Bildern die zu einer Collection gehoeren | Schnelle Erkennung |
| Collection View (Galerie) | Gruppierte Ansicht in der Workspace-Galerie | Neue Organisationsebene |

---

## User Flow

### Flow 1: Automatische Collection im Canvas

1. User generiert Bild A (txt2img) -> Bild erscheint im Canvas
2. User waehlt Bild A, generiert Variation/img2img -> Bild B erscheint
3. System erstellt automatisch Collection {A, B} mit sichtbarem Indikator
4. User generiert aus B weiter -> Bild C wird automatisch zur Collection hinzugefuegt

### Flow 2: Collection im Canvas verwalten

1. User sieht Collection-Indikator an Bildgruppe
2. User entfernt Bild aus Collection (Kontextmenue oder anderes Pattern) -> Indikator aktualisiert
3. User loest Collection auf -> alle Indikatoren verschwinden, Bilder bleiben

### Flow 3: Collection in Galerie

1. User oeffnet Workspace-Galerie
2. Collections sind als Gruppen sichtbar (wie genau: TODO)
3. User kann Collection oeffnen, Bilder sehen
4. User kann Bilder hinzufuegen/entfernen (Pattern: TODO - Drag&Drop? Kontextmenue?)

**Error Paths:**
- Letztes Bild aus Collection entfernen -> Collection wird aufgeloest
- Bild loeschen das in Collection ist -> Bild verschwindet aus Collection

---

## UI Layout & Context

> TODO: Nach Codebase-Recherche und Scope-Klaerung detaillieren

### Screen: Canvas
**Position:** Bestehender Canvas-Bereich
**When:** Sobald mind. 2 zusammengehoerige Bilder existieren

### Screen: Workspace Gallery
**Position:** Bestehende Galerie-Ansicht
**When:** Immer, wenn Collections existieren

---

## UI Components & States

> TODO: Nach Scope-Klaerung detaillieren

---

## Feature State Machine

> TODO: Nach Scope-Klaerung detaillieren

---

## Business Rules

- Eine Collection hat mindestens 2 Bilder
- Ein Bild kann zu maximal einer Collection gehoeren (oder mehreren? -> Open Question)
- Collection wird automatisch aufgeloest wenn nur 1 Bild uebrig
- Automatische Collection nur bei img2img/Variation, nicht bei unabhaengigen txt2img

---

## Data

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `collection_id` | Yes | UUID | Eindeutige Collection-ID |
| `collection_name` | No | Max 100 chars | Optional, auto-generiert wenn leer |
| `images` | Yes | Min 2 | Liste der zugehoerigen Bild-IDs |
| `created_at` | Yes | Timestamp | Erstellungszeitpunkt |
| `auto_created` | Yes | Boolean | Automatisch vs. manuell erstellt |

---

## Implementation Slices

> Grobe Aufteilung, wird nach Recherche verfeinert

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| 1 | Collection Data Model | DB-Schema, API Grundstruktur | CRUD-Tests | -- |
| 2 | Auto-Collection im Canvas | Automatische Gruppierung bei img2img | Generiere Variation -> Collection entsteht | Slice 1 |
| 3 | Canvas Collection UI | Visuelle Indikatoren, Interaktion | Indikatoren sichtbar, entfernen/aufloesen | Slice 2 |
| 4 | Galerie Collection View | Collections in Workspace-Galerie | Collections sichtbar, navigierbar | Slice 1 |
| 5 | Galerie Collection Management | Hinzufuegen/Entfernen/Aufloesen in Galerie | Verwaltungsaktionen funktionieren | Slice 4 |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| 1 | Kann ein Bild zu mehreren Collections gehoeren? | A) Nein, exklusiv B) Ja, mehrere | A) Einfacher, klarer | -- |
| 2 | Wie sieht der Collection-Indikator im Canvas aus? | A) Verbindungslinien B) Farbiger Rahmen C) Badge + Rahmen D) Gruppierungs-Container | -- | -- |
| 3 | Wie werden Collections in der Galerie dargestellt? | A) Eigener Tab B) Gruppierte Ansicht im bestehenden Grid C) Collapsible Sections | -- | -- |
| 4 | Welche Interaktionsmuster fuer Collection-Management? | A) Nur Kontextmenue B) Drag&Drop + Kontextmenue C) Selection-Mode + Toolbar | -- | -- |
| 5 | Soll eine Collection einen Namen/Titel haben? | A) Optional, auto-generiert B) Pflicht C) Kein Name, nur ID | A) Optional | -- |
| 6 | Was passiert mit der Collection wenn das "Ursprungsbild" geloescht wird? | A) Collection bleibt B) Collection wird aufgeloest | A) Collection bleibt | -- |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-15 | User Input | Beispiel-Workflow: Sketch -> Photo/Modelshot -> Flatlay -> POD-Vorlage. Bilder bilden eine Design-Evolution |
| -- | Codebase | TODO: Canvas-Struktur, DB-Relationen, Galerie-Patterns recherchieren |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| 1 | Soll erst eine umfassende Recherche durchgefuehrt werden oder direkt ein Draft erstellt werden? | Direkt Draft, Recherche spaeter |
