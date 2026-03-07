# Feature: Quality Improvements

**Epic:** Quality Improvements
**Status:** Ready
**Wireframes:** --

---

## Problem & Solution

**Problem:**
- Prompt-Qualitaet ist mittelmassig: Builder haengt nur Woerter an ("Oil Painting"), Improve ist generisch und nicht adaptiv
- Prompt-Feld zu schmal (320px), keine Struktur (alles in einer Textarea)
- Kein Prompt-Speichern, keine History -- gute Prompts gehen verloren
- Lightbox zeigt Bilder nicht in Vollbild
- Navigation nicht einklappbar, verschwendet Platz
- Projekte haben keine visuellen Thumbnails (nur graue Platzhalter)

**Solution:**
- Sophisticated Prompt-System: strukturiertes Feld, ausformulierte Builder-Fragmente, adaptiver Improve
- Prompt History + Favoriten + Templates als Prompt-Workflow
- UI-Verbesserungen: einklappbare shadcn Sidebar, Lightbox Vollbild, Projekt-Thumbnails

**Business Value:**
- Hoehere Bildqualitaet durch bessere Prompts
- Schnellerer Workflow durch gespeicherte Prompts und Templates
- Professionellere Anmutung der gesamten App

---

## Scope & Boundaries

| In Scope |
|----------|
| Lightbox Vollbild Toggle-Button |
| shadcn Sidebar (einklappbar, ersetzt Custom-Sidebar) |
| Strukturiertes Prompt-Feld (Motiv + Stil/Modifier + Negative Prompt) |
| Prompt Builder Pro: 5 Kategorien mit ausformulierten Fragmenten |
| Adaptiver Improve mit Prompt-Analyse und Modell-Beruecksichtigung |
| Prompt History (automatisch) + Favoriten (manuell) als Tabs |
| Prompt-Versioning: kompletter Prompt bei Generation in DB speichern |
| Prompt Templates (vorgefertigte Presets) |
| Projekt-Thumbnails: automatisch bei Erstellung, manuell re-generierbar |
| Modell-spezifische Prompt-Optimierung (nur Improve) |

| Out of Scope |
|--------------|
| Prompt-Feld Breitenaenderung (wird durch Sidebar-Collapse geloest) |
| Wechsel des LLM-Modells fuer Improve (bleibt OpenRouter) |
| Builder modell-spezifisch machen (nur Improve ist modell-aware) |
| Thumbnail automatisch nach X Generationen aktualisieren |

---

## Current State Reference

> Existing functionality that will be reused (unchanged).

- Generation-Flow: Replicate API mit 6 Modellen, pending/completed/failed States
- Gallery Grid: Masonry-Layout mit Generation-Cards
- Lightbox Modal: Overlay mit Details-Panel, Navigation, Download, Variation, Delete
- Prompt Snippets System: DB-Tabelle `prompt_snippets`, CRUD via Server Actions
- Model Schema Service: dynamisches Laden von Modell-Parametern
- OpenRouter Client: `lib/clients/openrouter.ts` fuer LLM-Calls
- Sheet-Komponente (shadcn/ui): bereits installiert
- Workspace State Context: `lib/workspace-state.tsx`

---

## UI Patterns

### Reused Patterns

| Pattern Type | Component | Usage in this Feature |
|--------------|-----------|----------------------|
| Sheet/Drawer | `components/ui/sheet.tsx` | Builder Drawer bleibt Sheet |
| Toast | Sonner | Fehler-Feedback bei Improve, Thumbnail-Generierung |
| Dialog | shadcn Dialog | Bestaetigung bei Template-Ueberschreibung |
| Tabs | shadcn Tabs | Prompt/History/Favoriten Tabs im Prompt-Bereich |

### New Patterns

| Pattern Type | Description | Rationale |
|--------------|-------------|-----------|
| shadcn Sidebar | Offizielle shadcn/ui Sidebar-Komponente mit Collapse | Ersetzt Custom-Sidebar, bringt Collapse, Icon-Mode, Keyboard-Shortcut, Mobile-Drawer mit |
| Labeled Form Sections | Visuell getrennte Bereiche mit Labels und Trennlinien | Strukturiertes Prompt-Feld braucht klare Trennung |
| Star Toggle | Favoriten-Stern auf History-Eintraegen | Neues UI-Element fuer Prompt-Favoriten |

---

## User Flow

### Flow 1: Strukturiertes Prompt eingeben

1. User oeffnet Projekt -> Prompt-Bereich zeigt 3 Sections: Motiv (leer, Pflicht), Stil/Modifier (leer), Negative Prompt (leer)
2. User tippt Motiv in oberstes Feld
3. User tippt optional Stil-Modifiers oder nutzt Builder
4. User tippt optional Negative Prompt
5. User klickt "Generate" -> alle 3 Felder werden zu einem Prompt zusammengefuegt und an Generation-Service gesendet

### Flow 2: Builder Pro nutzen

1. User klickt "Builder" Button -> Drawer oeffnet rechts
2. Drawer zeigt 5 Kategorie-Tabs: Style, Colors, Composition, Lighting, Mood (+ My Snippets)
3. User waehlt Optionen per Chip-Click (Toggle)
4. Live-Preview zeigt zusammengesetzten Stil-Text
5. User klickt "Done" -> ausformulierte Fragmente werden ins Stil/Modifier-Feld geschrieben

### Flow 3: Improve nutzen

1. User hat Prompt in Motiv-Feld geschrieben
2. User klickt "Improve" -> Loading-State
3. Modal oeffnet sich mit Loading-State
4. System analysiert: Motiv-Erkennung, Stil, Detailgrad, gewaehltes Modell (modelId wird uebergeben)
5. Verbesserter Prompt erscheint im Modal als Side-by-Side Vergleich (Original links, Improved rechts)
6. Modal zeigt Hinweis "Optimized for: {Modellname}"
7. User klickt "Adopt" -> verbesserter Prompt ersetzt Motiv-Feld (und ggf. Stil-Feld), Modal schliesst
8. User klickt "Discard" -> Modal schliesst, nichts aendert sich

### Flow 4: Prompt aus History laden

1. User klickt "History" Tab im Prompt-Bereich
2. Chronologische Liste erscheint (initial 50 Eintraege, scroll-to-load-more): Prompt-Preview, Modell, Datum, Stern-Icon
3. User klickt auf Eintrag -> wenn Felder nicht leer: Confirmation Dialog. Bei Bestaetigung: alle 3 Prompt-Felder + Modell + Parameter werden geladen
4. User kann Prompt anpassen und neu generieren

### Flow 5: Prompt als Favorit markieren

1. In History-Tab: User klickt Stern-Icon neben einem Eintrag -> Stern wird ausgefuellt
2. In Favoriten-Tab: nur markierte Prompts sichtbar
3. Erneuter Klick auf Stern -> Favorit entfernt

### Flow 6: Template verwenden

1. User oeffnet Templates (eigener Bereich/Button im Prompt-Tab)
2. Liste vorgefertigter Templates: "Product Shot", "Landscape", "Character Design", "Logo", "Abstract Art" etc.
3. User klickt Template -> wenn Felder nicht leer: Confirmation Dialog ("This will replace your current prompt. Continue?")
4. Bei Bestaetigung oder leeren Feldern: Motiv-Feld bekommt Platzhalter-Text, Stil-Feld wird vorbefuellt, Negative Prompt gesetzt
5. User ersetzt Platzhalter im Motiv-Feld mit eigenem Inhalt
5. User generiert

### Flow 7: Lightbox Vollbild

1. User klickt Bild in Gallery -> Lightbox oeffnet (wie bisher)
2. User klickt "Vollbild" Toggle-Button in der Lightbox
3. Bild skaliert auf 100% Viewport, Details-Panel verschwindet
4. Nur Bild + Close-Button + Navigation sichtbar
5. Erneuter Klick auf Toggle oder Escape -> zurueck zur normalen Lightbox-Ansicht

### Flow 8: Sidebar einklappen

1. User klickt Collapse-Toggle der shadcn Sidebar
2. Sidebar klappt auf Icon-Mode (schmale Leiste mit Icons/Initialen)
3. Prompt-Bereich und Gallery haben mehr Platz
4. User klickt erneut -> Sidebar klappt wieder aus

### Flow 9: Projekt-Thumbnail

1. User erstellt neues Projekt (gibt Projektnamen ein)
2. System generiert im Hintergrund ein Thumbnail via Recraft V4 basierend auf Projektname
3. Thumbnail erscheint auf der Projekt-Karte (ersetzt grauen Platzhalter)
4. Spaeter: User klickt "Thumbnail aktualisieren" auf Projekt-Karte
5. System analysiert vorhandene Bilder im Projekt und generiert neues, repraesentatives Thumbnail

**Error Paths:**
- Improve fehlschlaegt -> Toast: "Prompt konnte nicht verbessert werden. Bitte erneut versuchen."
- Thumbnail-Generierung fehlschlaegt -> Grauer Platzhalter bleibt, kein Error fuer User (silent retry moeglich)
- History leer -> Hinweistext: "Noch keine Prompts generiert. Starte deine erste Generation!"

---

## UI Layout & Context

### Screen: Workspace (Projekt-Seite)

**Position:** `/projects/[id]`
**When:** User oeffnet ein Projekt

**Layout (NEU mit shadcn Sidebar):**
- shadcn Sidebar (links): Projektliste, einklappbar auf Icon-Mode
- Mobile: Hamburger-Button im Header, Sidebar als Overlay-Drawer von links, Prompt-Bereich und Gallery vertikal gestapelt
- Main Content Area:
  - Header: Projektname
  - Prompt-Bereich (links, w-80):
    - Tab-Leiste: [Prompt] [History] [Favoriten]
    - Prompt-Tab: Motiv-Textarea + Stil/Modifier-Textarea + Negative Prompt-Textarea + Model-Selector + Builder/Improve Buttons + Parameter-Panel + Variant-Count + Generate-Button
    - History-Tab: chronologische Liste mit Stern-Toggle
    - Favoriten-Tab: gefilterte Liste (nur Favoriten)
  - Gallery (rechts, flex-1): Masonry Grid

### Screen: Lightbox (Vollbild-Modus)

**Position:** Overlay ueber Workspace
**When:** User klickt Vollbild-Toggle in Lightbox

**Layout:**
- Bild: 100% Viewport (object-contain), schwarzer Hintergrund
- Close-Button: oben rechts
- Vollbild-Toggle: oben rechts (neben Close)
- Navigation: Links/Rechts Pfeile (wie bisher)
- Kein Details-Panel sichtbar

### Screen: Home (Projekt-Uebersicht)

**Position:** `/`
**When:** App-Start

**Layout-Aenderung:**
- Projekt-Karten zeigen Thumbnail statt grauem Platzhalter
- "Thumbnail aktualisieren" Button bei Hover auf Karte (neben Edit/Delete)

---

## UI Components & States

| Element | Type | Location | States | Behavior |
|---------|------|----------|--------|----------|
| Motiv-Textarea | Textarea | Prompt-Tab, Section 1 | `empty`, `filled` | Pflichtfeld, auto-resize, Placeholder: "Beschreibe das Hauptmotiv..." |
| Stil-Textarea | Textarea | Prompt-Tab, Section 2 | `empty`, `filled`, `builder-filled` | Optional, wird vom Builder befuellt |
| Negative-Textarea | Textarea | Prompt-Tab, Section 3 | `empty`, `filled` | Optional, nur sichtbar wenn Modell es unterstuetzt |
| Prompt-Tab-Leiste | Tabs | Prompt-Bereich, oben | `prompt`, `history`, `favorites` | Wechselt Inhalt des Prompt-Bereichs |
| History-Liste | List | History-Tab | `empty`, `loaded` | Chronologisch, neueste oben |
| History-Eintrag | ListItem | History-Tab | `default`, `favorited` | Zeigt: Prompt-Preview (gekuerzt), Modell, Datum, Stern |
| Stern-Toggle | IconButton | History-Eintrag | `unfavorited` (Stern-Outline), `favorited` (Stern-Filled) | Klick toggled Favorit-Status |
| Vollbild-Toggle | IconButton | Lightbox Modal | `normal`, `fullscreen` | Klick wechselt zwischen normaler Ansicht und Vollbild |
| Lightbox-Image | Image | Lightbox Modal | `normal` (max 70vh), `fullscreen` (100% viewport, object-contain) | Bildgroesse wechselt mit Vollbild-Toggle |
| Sidebar-Collapse | Toggle | shadcn Sidebar | `expanded`, `collapsed` | Klappt Sidebar auf Icon-Mode |
| Thumbnail | Image | Projekt-Karte | `placeholder`, `loading`, `loaded`, `error` | Zeigt generiertes Thumbnail oder Platzhalter |
| Thumbnail-Refresh | Button | Projekt-Karte (Hover) | `idle`, `loading` | Triggert Thumbnail Re-Generierung |
| Template-Selector | List/Grid | Prompt-Tab | `closed`, `open` | Zeigt vorgefertigte Prompt-Templates |
| Builder Kategorie-Tabs | Tabs | Builder Drawer | `style`, `colors`, `composition`, `lighting`, `mood`, `snippets` | 6 Tabs in 2 Reihen (3+3), statt bisher 3 |
| Mobile-Hamburger | IconButton | Workspace Header (mobile) | `visible` (mobile), `hidden` (desktop) | Oeffnet Sidebar als Overlay-Drawer |

---

## Feature State Machine

### States Overview

| State | UI | Available Actions |
|-------|----|--------------------|
| `prompt-input` | Strukturiertes Prompt-Feld mit 3 Sections, Prompt-Tab aktiv | Tippen, Builder oeffnen, Improve, Template laden, Tab wechseln, Generate |
| `history-view` | History-Liste sichtbar | Eintrag klicken (laedt Prompt), Stern toggling, Tab wechseln |
| `favorites-view` | Nur favorisierte Prompts | Eintrag klicken (laedt Prompt), Stern toggling, Tab wechseln |
| `builder-open` | Builder Drawer offen (rechts) | Optionen waehlen, Kategorie wechseln, Done, Schliessen |
| `improve-loading` | Modal offen mit Loading-Skeleton | Warten, Modal schliessen |
| `improve-compare` | Modal mit Side-by-Side: Original (links) vs. Improved (rechts) + Modell-Hinweis | Adopt, Discard |
| `lightbox-normal` | Lightbox mit Bild + Details-Panel | Vollbild-Toggle, Navigate, Download, Variation, Delete, Close |
| `lightbox-fullscreen` | Bild auf 100% Viewport, kein Details-Panel | Vollbild-Toggle (zurueck), Navigate, Close |
| `sidebar-expanded` | Sidebar mit voller Projektliste (w-64) | Collapse, Projekt wechseln |
| `sidebar-collapsed` | Sidebar als Icon-Leiste | Expand, Projekt wechseln |

### Transitions

| Current State | Trigger | UI Feedback | Next State | Business Rules |
|---------------|---------|-------------|------------|----------------|
| `prompt-input` | Klick "History" Tab | Tab wechselt | `history-view` | -- |
| `prompt-input` | Klick "Favoriten" Tab | Tab wechselt | `favorites-view` | -- |
| `prompt-input` | Klick "Builder" | Drawer slides in | `builder-open` | -- |
| `prompt-input` | Klick "Improve" | Modal oeffnet mit Loading-Skeleton | `improve-loading` | Motiv-Feld darf nicht leer sein, uebergibt gewaehlte modelId an Improve-Pipeline |
| `prompt-input` | Klick Template | Confirmation Dialog wenn Felder nicht leer, dann Felder befuellt | `prompt-input` | Wenn Felder nicht leer: Dialog "This will replace your current prompt. Continue?" mit Cancel/Apply. Wenn leer: direkt anwenden |
| `history-view` | Klick History-Eintrag | Confirmation Dialog wenn Felder nicht leer, dann Felder befuellt, Tab wechselt | `prompt-input` | Wenn Felder nicht leer: Dialog "This will replace your current prompt. Continue?" mit Cancel/Apply. Laedt Motiv, Stil, Negative, Modell, Parameter |
| `history-view` | Klick Stern | Stern-Icon wechselt | `history-view` | DB-Update: `isFavorite` toggle |
| `favorites-view` | Klick Eintrag | Felder werden befuellt, Tab wechselt | `prompt-input` | Wie History |
| `builder-open` | Klick "Done" / Schliessen | Drawer slides out, Stil-Feld aktualisiert | `prompt-input` | Builder-Output ERSETZT Stil-Feld komplett (kein Append) |
| `improve-loading` | LLM Response erhalten | Modal zeigt Side-by-Side Vergleich + "Optimized for: {Modell}" | `improve-compare` | -- |
| `improve-loading` | LLM Error | Toast-Fehler, Modal schliesst | `prompt-input` | -- |
| `improve-compare` | Klick "Adopt" | Modal schliesst, Prompt-Felder aktualisiert | `prompt-input` | Improved Prompt ersetzt Felder |
| `improve-compare` | Klick "Discard" | Modal schliesst | `prompt-input` | Keine Aenderung |
| `lightbox-normal` | Klick Vollbild-Toggle | Details-Panel verschwindet, Bild skaliert | `lightbox-fullscreen` | -- |
| `lightbox-fullscreen` | Klick Vollbild-Toggle / Escape | Details-Panel erscheint, Bild verkleinert | `lightbox-normal` | -- |
| `sidebar-expanded` | Klick Collapse-Toggle | Sidebar animiert auf Icon-Mode | `sidebar-collapsed` | -- |
| `sidebar-collapsed` | Klick Expand-Toggle | Sidebar animiert auf volle Breite | `sidebar-expanded` | -- |

---

## Business Rules

- Motiv-Feld ist Pflicht fuer Generation (wie bisher)
- Stil/Modifier-Feld und Negative Prompt sind optional
- Prompt-Zusammensetzung fuer Generation: `{Motiv}. {Stil/Modifier}` (mit Punkt getrennt), Negative Prompt separat
- History speichert automatisch bei jeder Generation (kein User-Action noetig)
- History ist projektuebergreifend (alle Projekte)
- Favoriten sind projektuebergreifend
- Builder-Fragmente sind modell-agnostisch (gleiches Fragment fuer alle Modelle)
- Improve beruecksichtigt gewaehltes Modell im System-Prompt
- Thumbnail-Generierung via Recraft V4, Aufloesung: niedrig (z.B. 256x256 oder kleinstes vom Modell unterstuetztes Format)
- Thumbnail-Prompt bei Erstellung: System-Prompt generiert aus Projektname ein passendes Thumbnail-Motiv
- Thumbnail Re-Generierung: System analysiert Prompts/Bilder im Projekt und generiert repraesentatives Thumbnail
- Templates sind hardcoded (keine User-erstellten Templates in V1)
- Beim Laden eines History-Eintrags werden bestehende Feldinhalte ueberschrieben (kein Merge). Confirmation Dialog wenn Felder nicht leer
- Builder-Output ERSETZT das Stil-Feld komplett (kein Append an bestehenden Inhalt)
- Sidebar Collapse-State persistiert via Cookie/localStorage ueber Sessions hinweg
- History laedt initial die letzten 50 Eintraege, Scroll-to-load-more fuer weitere Batches von 50
- Improve oeffnet als Modal (nicht inline im Prompt-Bereich), Side-by-Side Vergleich, uebergibt modelId

---

## Data

### Neue Felder: `generations` Tabelle (Erweiterung)

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `promptMotiv` | Yes | max 2000 chars | Hauptmotiv-Teil des Prompts |
| `promptStyle` | No | max 1000 chars | Stil/Modifier-Teil |
| `isFavorite` | Yes | boolean, default false | Favoriten-Markierung |

### Neue Tabelle: `prompt_history`

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `id` | Yes | uuid | Primary Key |
| `promptMotiv` | Yes | max 2000 chars | Hauptmotiv |
| `promptStyle` | No | max 1000 chars | Stil/Modifier |
| `negativePrompt` | No | max 1000 chars | Negative Prompt |
| `modelId` | Yes | varchar | Referenz auf Modell |
| `params` | No | jsonb | Modell-Parameter |
| `isFavorite` | Yes | boolean, default false | Favoriten-Markierung |
| `createdAt` | Yes | timestamp | Erstellungszeitpunkt |

### Neue Felder: `projects` Tabelle (Erweiterung)

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `thumbnailUrl` | No | URL string | R2-URL des generierten Thumbnails |
| `thumbnailStatus` | Yes | enum: pending, completed, failed | Status der Thumbnail-Generierung |

### Prompt Builder Fragmente (Hardcoded Config)

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `category` | Yes | enum: style, colors, composition, lighting, mood | Kategorie |
| `label` | Yes | string | Anzeigename (z.B. "Oil Painting") |
| `fragment` | Yes | string | Ausformulierter Prompt-Text |

---

## Trigger Inventory

| Trigger | Action | Service |
|---------|--------|---------|
| User klickt "Generate" | Prompt zusammensetzen (Motiv + Stil), History-Eintrag erstellen, Generation starten | generation-service, prompt-history |
| User klickt "Improve" | Modal oeffnet, Prompt + modelId an LLM mit adaptivem System-Prompt senden | prompt-service, openrouter |
| User klickt "Builder Done" | Ausformulierte Fragmente ins Stil-Feld schreiben | Client-side |
| User klickt History-Eintrag | Alle Prompt-Felder + Modell + Parameter laden | prompt-history |
| User klickt Stern | isFavorite toggle in DB | prompt-history |
| User erstellt Projekt | Thumbnail-Generierung via Recraft V4 im Hintergrund starten | generation-service (thumbnail) |
| User klickt "Thumbnail aktualisieren" | Projekt-Bilder analysieren, neues Thumbnail generieren | generation-service (thumbnail) |
| User klickt Vollbild-Toggle | Lightbox-Layout wechseln (mit/ohne Details-Panel) | Client-side |
| User klickt Sidebar-Collapse | Sidebar-State wechseln (expanded/collapsed) | Client-side |
| User klickt Template | Alle Prompt-Felder mit Template-Werten befuellen | Client-side |

---

## Implementation Slices

### Dependencies

```
Slice 1 (Sidebar) -----> eigenstaendig
Slice 2 (Prompt-Feld) -> Slice 3 (Builder Pro)
                       -> Slice 5 (History)
                       -> Slice 6 (Templates)
Slice 4 (Improve) -----> eigenstaendig
Slice 5 (History) -----> Slice 2 (braucht strukturiertes Feld)
Slice 6 (Templates) ---> Slice 2 (braucht strukturiertes Feld)
Slice 7 (Lightbox) ----> eigenstaendig
Slice 8 (Thumbnails) --> eigenstaendig
```

### Slices

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| 1 | shadcn Sidebar | shadcn Sidebar installieren, Custom-Sidebar ersetzen, Collapse-Funktion, Icon-Mode | Sidebar klappt ein/aus, Projekte navigierbar, Mobile funktioniert | -- |
| 2 | Strukturiertes Prompt-Feld | 3 Labeled Sections (Motiv, Stil, Negative), Prompt-Zusammensetzung bei Generate | Generation funktioniert mit neuem Feld-Layout, Motiv ist Pflicht | -- |
| 3 | Builder Pro | 5 Kategorien (Style, Colors, Composition, Lighting, Mood), ausformulierte Fragmente, fuellt Stil-Feld | Builder-Auswahl erscheint als ausformulierter Text im Stil-Feld | Slice 2 |
| 4 | Adaptiver Improve | Neuer System-Prompt mit Prompt-Analyse + Modell-Beruecksichtigung | Improve liefert modell-spezifische, auf den Input abgestimmte Verbesserungen | -- |
| 5 | Prompt History + Favoriten | DB-Tabelle, automatisches Speichern bei Generation, Tabs im Prompt-Bereich, Stern-Toggle, Laden | History zeigt vergangene Prompts, Favoriten filterbar, Laden befuellt Felder | Slice 2 |
| 6 | Prompt Templates | Hardcoded Template-Presets, Template-Auswahl im Prompt-Tab, befuellt alle Felder | Template-Auswahl befuellt Motiv + Stil + Negative korrekt | Slice 2 |
| 7 | Lightbox Vollbild | Toggle-Button in Lightbox, Bild auf 100% Viewport, Details-Panel verstecken | Vollbild-Toggle schaltet zwischen normal und Vollbild, Navigation funktioniert in beiden Modi | -- |
| 8 | Projekt-Thumbnails | DB-Erweiterung, Thumbnail bei Projekterstellung generieren, Anzeige auf Karte, Re-Generierung Button | Neues Projekt zeigt generiertes Thumbnail, Refresh-Button generiert neues | -- |

### Recommended Order

1. **Slice 1:** shadcn Sidebar -- Unabhaengig, schafft Platz fuer alles andere, grundlegendes Layout
2. **Slice 2:** Strukturiertes Prompt-Feld -- Basis fuer Builder, History und Templates
3. **Slice 7:** Lightbox Vollbild -- Quick Win, unabhaengig, kleine Aenderung
4. **Slice 4:** Adaptiver Improve -- Unabhaengig, verbessert sofort die Prompt-Qualitaet
5. **Slice 3:** Builder Pro -- Baut auf Slice 2 auf, braucht Recherche fuer gute Fragmente
6. **Slice 5:** Prompt History + Favoriten -- Baut auf Slice 2 auf, DB-Aenderungen
7. **Slice 6:** Prompt Templates -- Baut auf Slice 2 auf, braucht kuratierte Templates
8. **Slice 8:** Projekt-Thumbnails -- Kann jederzeit, hat eigene Komplexitaet (Bild-Generierung)

---

## Context & Research

### Similar Patterns in Codebase

| Feature | Location | Relevant because |
|---------|----------|------------------|
| Custom Sidebar | `components/sidebar.tsx` | Wird durch shadcn Sidebar ersetzt |
| Project List | `components/project-list.tsx` | Muss in shadcn Sidebar integriert werden |
| Builder Drawer | `components/prompt-builder/builder-drawer.tsx` | Wird erweitert (5 Kategorien, ausformulierte Fragmente) |
| LLM Comparison | `components/prompt-improve/llm-comparison.tsx` | Improve-UI bleibt, System-Prompt wird angepasst |
| Prompt Service | `lib/services/prompt-service.ts` | Improve System-Prompt wird erweitert |
| Lightbox Modal | `components/lightbox/lightbox-modal.tsx` | Wird um Vollbild-Toggle erweitert |
| Project Card | `components/project-card.tsx` | Bekommt Thumbnail statt Platzhalter |
| Prompt Area | `components/workspace/prompt-area.tsx` | Wird komplett umgebaut (strukturiert, Tabs) |
| Snippet Service | `lib/services/snippet-service.ts` | Pattern fuer DB-Service, wiederverwendbar fuer History |
| Generation Service | `lib/services/generation-service.ts` | Pattern fuer Thumbnail-Generierung |
| Workspace State | `lib/workspace-state.tsx` | Muss Sidebar-State und Prompt-Struktur erweitert werden |
| DB Schema | `lib/db/schema.ts` | Erweiterung: prompt_history, projects.thumbnailUrl |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| -- | Keine offenen Fragen | -- | -- | -- |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-07 | Codebase | App ist Next.js 16 + React 19 + Tailwind v4 + shadcn/ui + Drizzle ORM + PostgreSQL |
| 2026-03-07 | Codebase | 6 Modelle via Replicate API, davon 5 kostenlos (Recraft V4 fuer Thumbnails geeignet) |
| 2026-03-07 | Codebase | Improve nutzt OpenRouter mit `openai/gpt-oss-120b:exacto`, generischer System-Prompt |
| 2026-03-07 | Codebase | Builder hat 9 Style + 9 Color Optionen, werden nur als Woerter angefuegt |
| 2026-03-07 | Codebase | Prompt-Feld ist w-80 (320px) fix, 3 Zeilen Textarea |
| 2026-03-07 | Codebase | Sidebar ist Custom-Komponente (w-64), nicht einklappbar |
| 2026-03-07 | Codebase | Lightbox hat max 70vh Bild, kein Vollbild-Modus |
| 2026-03-07 | Codebase | Projekt-Karten zeigen grauen Platzhalter mit Icon statt Thumbnail |
| 2026-03-07 | Codebase | shadcn Sheet ist installiert, shadcn Sidebar nicht |
| 2026-03-07 | Codebase | Snippet-System existiert (DB + Service + UI), Pattern fuer History wiederverwendbar |

---

## Q&A Log

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Sollen wir das als ein grosses Epic behandeln oder in separate Discoveries aufteilen? | Ein Epic, eine Discovery |
| 2 | Lightbox Vollbild: Wie soll das Vollbild funktionieren? | Toggle-Button im Lightbox (Bild auf 100% Viewport ohne Details-Panel) |
| 3 | Navigation einklappen: Wie soll die eingeklappte Navigation aussehen? | shadcn Sidebar-Komponente mit eingebautem Collapse nutzen |
| 4 | Welchen Ansatz fuer die einklappbare Navigation? | shadcn Sidebar installieren (ersetzt Custom-Sidebar) |
| 5 | Prompt Builder: Was meinst du mit 'sophistiziertem Prompt pro Option'? | Ausformulierte Prompt-Fragmente statt einzelner Woerter (z.B. "rendered as a classical oil painting with visible brushstrokes...") |
| 6 | Improve-Prompt Adaptivitaet: Wie soll er sich auf den User-Prompt adaptieren? | Prompt-Analyse vorab: System analysiert erst den User-Prompt (Motiv, Stil, Stimmung, Detailgrad) und passt Verbesserungsstrategie an |
| 7 | Prompt-Feld Struktur: Was schwebt dir vor? | Labeled Sections mit Trennlinien: Motiv (Pflicht) + Stil/Modifier + Negative Prompt |
| 8 | Prompts speichern: Was genau soll gespeichert werden? | Beides: automatische History + manuelle Favoriten (wie Browser-History + Lesezeichen) |
| 9 | Welches Free-Modell fuer Thumbnail-Generierung? | Recraft V4 |
| 10 | Prompt-Feld Breite: grundsaetzlich breiter oder Sidebar-Collapse schafft Platz? | Sidebar-Collapse schafft Platz (keine fixe Breitenaenderung) |
| 11 | Zusaetzliche Vorschlaege in Scope nehmen? | Alle 3: Prompt-Versioning, Modell-spezifische Optimierung, Prompt-Templates |
| 12 | Thumbnail: Wann soll das Thumbnail generiert werden? | Bei Projekterstellung (basierend auf Projektname), mit Moeglichkeit zur Re-Generierung basierend auf Projektbildern |
| 13 | Builder Kategorien: Welche zusaetzlichen Kategorien? | Bestehende Style/Color verbessern + 3 neue: Composition, Lighting, Mood |
| 14 | History Tab: Wie soll die Prompt-History dargestellt werden? | Chronologische Liste (neueste oben): Prompt-Preview, Modell, Datum, Stern-Icon |
| 15 | Modell-spezifische Prompt-Optimierung: Wie tief? | Nur Improve beruecksichtigt Modell (Builder bleibt modell-agnostisch) |
| 16 | Builder + Strukturiertes Feld: Wohin sollen Builder-Auswahlen gehen? | Builder fuellt das Stil/Modifier-Feld |
| 17 | Prompt Templates: Wie sollen die funktionieren? | Template fuellt alle Felder (Motiv mit Platzhalter, Stil vorbefuellt, Negative gesetzt) |
| 18 | Strukturiertes Prompt-Feld: Wie visuell getrennt? | Labeled Sections mit Trennlinien (Formular-Stil) |
| 19 | Prompt-Versioning: Wie soll die Verbindung Generation-Prompt funktionieren? | Kompletter Prompt (Motiv + Stil + Negative + Parameter + Modell) bei Generation in DB speichern |
| 20 | Thumbnail-Prompt: Wie soll der Prompt entstehen? | Aus Projektname ableiten, mit manueller Re-Generierung auf Basis der Projektbilder |
| 21 | Thumbnail Re-Generierung: Wann? | Manuell per Button auf der Projekt-Karte |
| 22 | Epic-Name? | quality-improvements |
