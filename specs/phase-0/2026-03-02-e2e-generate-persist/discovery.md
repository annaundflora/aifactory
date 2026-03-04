# Feature: E2E Generate & Persist (Phase 0)

**Epic:** --
**Status:** Draft
**Wireframes:** `wireframes.md`

---

## Problem & Solution

**Problem:**
- Der Weg von "Idee" zu "POD-Design" erfordert zu viele Tools und manuelle Schritte
- Kittl kommt nah dran, bietet aber keine Kontrolle ueber AI-Modelle
- Generierte Bilder gehen verloren wenn man sie nicht sofort speichert

**Solution:**
- Ein eigenes AI Design Tool mit Replicate-Anbindung, visuellem Prompt Builder und persistenter Speicherung
- Alle Generierungen werden automatisch in PostgreSQL + Cloudflare R2 gespeichert

**Business Value:**
- Schnellere Design-Iterationen fuer den eigenen POD-Workflow (Spreadshirt)
- Volle Kontrolle ueber Modelle, Parameter und Prompts

---

## Scope & Boundaries

| In Scope |
|----------|
| Next.js App mit App Router, TypeScript, Tailwind v4, shadcn/ui |
| PostgreSQL (Docker) mit Drizzle ORM |
| Cloudflare R2 Bild-Storage (Public Bucket) |
| Replicate API: Blocking API (`predictions.create()` + `replicate.wait()` fuer Zugriff auf prediction_id + seed) |
| 6 Modelle: FLUX 2 Pro, Nano Banana 2, Recraft V4, Seedream 5 Lite, Seedream 4.5, Gemini 2.5 Flash Image |
| Dynamische Modell-Parameter via Replicate Schema API |
| Prompt Builder: Style + Colors Kategorien (je 9 Optionen, Text-Labels) |
| Eigene Prompt-Bausteine (user-erstellte Snippets als Kategorie im Builder) |
| "Surprise Me" globaler Zufalls-Button |
| LLM Prompt-Verbesserung via OpenRouter (Button, Ergebnis nebeneinander) |
| Negativ-Prompt Feld (modellabhaengig ein-/ausgeblendet) |
| Projekt-Organisation (Name + Generierungen) |
| Masonry Grid Galerie mit Lightbox/Modal |
| Variationen: Prompt + Parameter uebernehmen, anpassbar, 1-4 Batch |
| Download als PNG |
| Fehlerbehandlung: Toast + Retry in Galerie |

| Out of Scope |
|--------------|
| User Authentication (Personal Tool, kein Login) |
| Bildbearbeitung / Editor (Phase 1) |
| Export / Upscaling auf 4000x4000 (Phase 2) |
| Spreadshirt Direct Upload (Phase 3) |
| Fine-Tuning eigener Modelle (Phase 3) |
| Bild-Previews fuer Prompt Builder Optionen (spaeter nachruestbar) |
| Webhook-basierte Generation (Blocking API reicht) |

---

## Current State Reference

> Greenfield -- no existing functionality.

---

## UI Patterns

### Reused Patterns

> Greenfield -- keine existierenden Patterns.

### New Patterns

| Pattern Type | Description | Rationale |
|--------------|-------------|-----------|
| Sidebar + Main Layout | Sidebar links (Projekte, Navigation), Main rechts (Prompt + Galerie) | Standard-Pattern fuer Tool-Apps |
| Masonry Grid | Pinterest-Style Bildergalerie mit variablen Aspect Ratios | Beste Darstellung fuer Bilder unterschiedlicher Formate |
| Lightbox Modal | Bild gross + Details (Prompt, Parameter, Modell, Datum) + Aktionen | Standard-Pattern fuer Bildergalerien |
| Prompt Builder Drawer | Modal/Drawer mit Kategorie-Tabs + Options-Grid | Kittl-inspiriertes Pattern fuer visuelle Prompt-Komposition |
| Dynamic Parameter Panel | Parameter-Controls generiert aus Replicate Model Schema | Flexibel, keine Hardcoded-Parameter pro Modell |
| Inline Loading Placeholder | Platzhalter in Galerie waehrend Generation laeuft | Visuelles Feedback ohne Page-Wechsel |

---

## User Flow

### Flow 1: Projekt erstellen und Bild generieren

1. User oeffnet App -> Sieht Projekt-Uebersicht (Liste aller Projekte)
2. User klickt "Neues Projekt" -> Gibt Projektnamen ein -> Projekt wird erstellt
3. User ist im Projekt -> Sieht: Prompt-Feld, Modell-Dropdown, Generate-Button, leere Galerie
4. User waehlt Modell aus Dropdown -> Parameter-Panel aktualisiert sich dynamisch (laedt Schema vom Modell)
5. User tippt Prompt ein -> Optional: Negativ-Prompt Feld ausfuellen (nur sichtbar wenn Modell es unterstuetzt)
6. User klickt "Generate" -> Loading-Placeholder erscheint in Galerie
7. System: Replicate API wird aufgerufen (blocking), Bild wird heruntergeladen, in R2 gespeichert, DB-Eintrag erstellt
8. Bild erscheint in Galerie (ersetzt Placeholder)

### Flow 2: Prompt Builder nutzen

1. User klickt "Prompt Builder" Button -> Drawer/Modal oeffnet sich
2. User sieht Kategorie-Tabs: Style, Colors, Meine Bausteine
3. User klickt auf Style-Tab -> 9 Optionen als Text-Labels (z.B. "Oil Painting", "Flat Vector", "Anime")
4. User klickt Option -> Snippet wird zum Prompt hinzugefuegt (Concatenation, sichtbar im Prompt-Feld)
5. User wechselt zu Colors -> Waehlt Option -> Wird ebenfalls angehaengt
6. Optional: User klickt "Surprise Me" -> Zufaellige Kombination aus allen Kategorien
7. User schliesst Builder -> Prompt ist fertig zusammengesetzt im Eingabefeld

### Flow 3: Prompt verbessern (LLM)

1. User hat Prompt im Eingabefeld
2. User klickt "Prompt verbessern" Button
3. System: Sendet Prompt an OpenRouter API
4. Verbesserter Prompt erscheint neben dem Original (nebeneinander)
5. User klickt "Uebernehmen" -> Verbesserter Prompt ersetzt Original
6. Oder: User klickt "Verwerfen" -> Original bleibt

### Flow 4: Variation erstellen

1. User klickt auf Bild in Galerie -> Lightbox/Modal oeffnet sich
2. User sieht: Grosses Bild, Prompt, Modell, Parameter, Datum
3. User klickt "Variation" -> Prompt + Modell + Parameter werden in Eingabe uebernommen
4. User kann anpassen (Prompt aendern, Modell wechseln, Parameter tweaken)
5. User waehlt Anzahl Varianten (1-4 via Slider/Dropdown)
6. User klickt "Generate" -> 1-4 Loading-Placeholders erscheinen in Galerie

### Flow 5: Prompt-Baustein erstellen

1. User oeffnet Prompt Builder -> Tab "Meine Bausteine"
2. User klickt "Neuer Baustein"
3. User gibt ein: Snippet-Text (z.B. "on white background, centered, clean lines") + Kategorie (z.B. "POD Basics")
4. Baustein wird gespeichert und erscheint unter der gewaehlten Kategorie
5. Beim naechsten Prompt-Bauen: Klick auf Baustein fuegt Snippet zum Prompt hinzu

### Flow 5b: Prompt-Baustein bearbeiten/loeschen

1. User oeffnet Prompt Builder -> Tab "Meine Bausteine"
2. User hovert ueber Baustein -> Edit-Icon und Loeschen-Icon werden sichtbar
3. Klick auf Edit-Icon -> snippet-form oeffnet sich, vorbefuellt mit Snippet-Text und Kategorie
4. User aendert Text oder Kategorie -> Klickt "Speichern" -> Baustein wird aktualisiert
5. Klick auf Loeschen-Icon -> Inline-Bestaetigung: "Baustein loeschen?" -> Bestaetigen entfernt Baustein

### Flow 6: Bild herunterladen

1. User klickt auf Bild in Galerie -> Lightbox
2. User klickt "Download" -> Bild wird als PNG heruntergeladen

### Flow 7: Projekt loeschen

1. User ist in Projekt-Uebersicht
2. User klickt Loeschen-Icon bei Projekt -> Bestaetigungs-Dialog: "Projekt und alle Generierungen loeschen?"
3. User bestaetigt -> Projekt, alle Generierungen in DB und alle Bilder in R2 werden geloescht

### Flow 8: Projekt umbenennen

1. User ist im Projekt-Workspace oder Projekt-Uebersicht
2. User klickt auf Projekt-Namen (oder Edit-Icon neben dem Namen) -> Name wird editierbar (Inline-Input)
3. User aendert Namen -> Enter oder Blur speichert neuen Namen
4. Projektname wird in DB aktualisiert, Sidebar und Card zeigen neuen Namen

**Error Paths:**
- Generation fehlgeschlagen -> Toast-Notification mit Fehlermeldung, Platzhalter in Galerie zeigt "Fehlgeschlagen" + Retry-Button
- R2 Upload fehlgeschlagen -> Toast: "Bild konnte nicht gespeichert werden. Retry?"
- LLM-Verbesserung fehlgeschlagen -> Toast: "Prompt-Verbesserung fehlgeschlagen", Original bleibt unveraendert, Panel schliesst sich automatisch
- Replicate Rate Limit -> Toast: "Zu viele Anfragen. Bitte kurz warten."

---

## UI Layout & Context

### Screen: Projekt-Uebersicht

**Position:** Root-Seite der App (`/`)
**When:** App wird geoeffnet, kein Projekt ausgewaehlt

**Layout:**
- Header: App-Name "POD Design Studio"
- Main: Grid mit Projekt-Cards (Projektname, Anzahl Generierungen, letztes Bild als Thumbnail, Erstelldatum)
- CTA: "Neues Projekt" Button (prominent)
- Pro Card: Loeschen-Icon

### Screen: Projekt-Workspace

**Position:** Projekt-Detailseite (`/projects/[id]`)
**When:** User hat Projekt geoeffnet

**Layout:**
- Sidebar (links, persistent):
  - Projekt-Navigation (Liste aller Projekte, aktives hervorgehoben)
  - "Neues Projekt" Button
  - "Zurueck zur Uebersicht" Link
- Main Area (rechts):
  - **Oberer Bereich: Prompt & Controls**
    - Modell-Dropdown (Modellname + Preis pro Bild)
    - Prompt-Eingabefeld (Textarea, mehrzeilig)
    - Negativ-Prompt Feld (nur sichtbar wenn Modell es unterstuetzt)
    - Aktions-Buttons: "Generate", "Prompt Builder", "Prompt verbessern"
    - Varianten-Anzahl: Slider/Dropdown 1-4 (immer sichtbar, Default: 1)
  - **Mittlerer Bereich: Parameter-Panel**
    - Dynamisch generierte Controls basierend auf Modell-Schema (Slider, Dropdowns, Number-Inputs)
    - Aspect Ratio, Seed, Output Format, modellspezifische Parameter
  - **Unterer Bereich: Galerie**
    - Masonry Grid mit allen Generierungen des Projekts
    - Neueste oben
    - Loading-Placeholders fuer laufende Generierungen
    - Fehlgeschlagene Generierungen mit Retry-Button

### Screen: Lightbox/Modal (Bild-Detail)

**Position:** Overlay ueber Projekt-Workspace
**When:** User klickt auf Bild in Galerie

**Layout:**
- Overlay (dunkler Hintergrund)
- Grosses Bild (zentriert, max verfuegbare Groesse)
- Detail-Panel (unter oder neben dem Bild):
  - Prompt (vollstaendig)
  - Negativ-Prompt (falls vorhanden)
  - Modell-Name
  - Parameter (alle, die bei Generation gesetzt waren)
  - Erstelldatum
  - Bildabmessungen
- Navigation: Prev/Next Chevron-Buttons links/rechts vom Bild + Pfeiltasten
- Aktions-Buttons: "Download (PNG)", "Variation", "Loeschen"
- Schliessen: X-Button oder Klick auf Overlay

### Screen: Prompt Builder (Drawer/Modal)

**Position:** Drawer von rechts oder Modal
**When:** User klickt "Prompt Builder" Button

**Layout:**
- Kategorie-Tabs oben: "Style", "Colors", "Meine Bausteine"
- Options-Grid: 3x3 Grid mit Text-Labels pro Kategorie
- "Surprise Me" Button (global, ueber den Tabs)
- Aktueller Prompt unten (Live-Preview, editierbar)
- "Fertig" / Schliessen Button

### Screen: Prompt-Baustein erstellen (innerhalb Builder)

**Position:** Inline-Formular im "Meine Bausteine" Tab
**When:** User klickt "Neuer Baustein"

**Layout:**
- Text-Input: Snippet-Text
- Dropdown/Input: Kategorie (bestehende waehlen oder neue erstellen)
- "Speichern" Button
- Bestehende Bausteine gruppiert nach Kategorie darunter

### Screen: LLM Prompt-Verbesserung

**Position:** Inline unter/neben dem Prompt-Feld
**When:** User klickt "Prompt verbessern"

**Layout:**
- Links: Original-Prompt (readonly)
- Rechts: Verbesserter Prompt (readonly, erscheint nach LLM-Antwort)
- Loading-State waehrend LLM arbeitet
- Buttons: "Uebernehmen", "Verwerfen"

---

## UI Components & States

| Element | Type | Location | States | Behavior |
|---------|------|----------|--------|----------|
| `project-card` | Card | Projekt-Uebersicht | `default`, `hover`, `renaming` | Klick oeffnet Projekt-Workspace. Doppelklick auf Namen oder Edit-Icon ermoeglicht Umbenennung |
| `new-project-btn` | Button | Uebersicht + Sidebar | `default`, `hover` | Oeffnet Inline-Input fuer Projektname |
| `project-name-input` | Input | Uebersicht | `empty`, `filled`, `error` | Enter oder Blur speichert Projekt |
| `rename-project-input` | Input | Projekt-Uebersicht, Sidebar | `hidden`, `visible`, `saving` | Edit-Icon neben Projektname. Klick macht Namen editierbar (Inline-Input). Enter/Blur speichert |
| `model-dropdown` | Select | Workspace Header | `default`, `open`, `selected` | Zeigt Modellname + Preis. Aenderung laedt Parameter-Schema neu |
| `prompt-textarea` | Textarea | Workspace Header | `empty`, `filled` | Mehrzeilig, Auto-Resize. Cmd/Ctrl+Enter triggert Generation |
| `negative-prompt-input` | Textarea | Workspace Header | `hidden`, `empty`, `filled` | Nur sichtbar wenn Modell Negativ-Prompt unterstuetzt |
| `generate-btn` | Button | Workspace Header | `default`, `loading` | Startet Generation. Zeigt Spinner waehrend API Call, Prompt-Bereich bleibt bedienbar |
| `prompt-builder-btn` | Button | Workspace Header | `default`, `active` | Oeffnet Prompt Builder Drawer |
| `improve-prompt-btn` | Button | Workspace Header | `default`, `loading`, `disabled` | Startet LLM-Verbesserung |
| `variant-count` | Slider/Select | Workspace Header | `default`, `selected` | Werte: 1, 2, 3, 4 |
| `parameter-panel` | Dynamic Form | Workspace Mitte | `loading`, `ready`, `empty` | Controls aus Modell-Schema generiert |
| `gallery-grid` | Masonry Grid | Workspace Unten | `empty`, `populated` | Zeigt alle Generierungen, neueste oben |
| `generation-placeholder` | Card | Gallery Grid | `loading`, `failed` | Skeleton waehrend Generation, Error-State bei Fehler |
| `generation-card` | Card | Gallery Grid | `default`, `hover` | Thumbnail, Klick oeffnet Lightbox |
| `retry-btn` | Button | Generation Placeholder | `default` | Re-triggert fehlgeschlagene Generation |
| `lightbox-modal` | Modal | Overlay | `open`, `closed` | Grosses Bild + Details + Aktionen. Prev/Next Navigation via Pfeiltasten und Chevron-Buttons |
| `lightbox-prev-btn` | Button | Lightbox | `default` | Vorheriges Bild in Galerie. Auch via linke Pfeiltaste. Wrap-Around am Anfang |
| `lightbox-next-btn` | Button | Lightbox | `default` | Naechstes Bild in Galerie. Auch via rechte Pfeiltaste. Wrap-Around am Ende |
| `download-btn` | Button | Lightbox | `default`, `downloading` | Download als PNG |
| `variation-btn` | Button | Lightbox | `default` | Uebernimmt Prompt + Parameter in Eingabe |
| `delete-generation-btn` | Button | Lightbox | `default`, `confirm` | Loescht Generierung nach Bestaetigung |
| `builder-drawer` | Drawer/Modal | Overlay | `open`, `closed` | Prompt Builder mit Kategorie-Tabs |
| `category-tab` | Tab | Builder | `inactive`, `active` | Wechselt zwischen Style, Colors, Meine Bausteine |
| `option-chip` | Button | Builder Grid | `default`, `selected` | Klick toggelt Selection, fuegt/entfernt Snippet im Prompt |
| `surprise-me-btn` | Button | Builder Header | `default` | Wuerfelt zufaellige Kombination |
| `snippet-form` | Form | Builder (Meine Bausteine) | `hidden`, `visible` | Eingabe fuer neuen Baustein |
| `new-snippet-btn` | Button | Builder (Meine Bausteine) | `default` | Toggelt Sichtbarkeit des snippet-form Formulars |
| `snippet-chip` | Button | Builder (Meine Bausteine) | `default`, `selected`, `hover` | Eigener Baustein, Klick fuegt zum Prompt hinzu. Hover zeigt Edit/Loeschen-Icons |
| `llm-comparison` | Panel | Unter Prompt-Feld | `hidden`, `loading`, `ready` | Zeigt Original vs. Verbesserter Prompt |
| `adopt-btn` | Button | LLM Panel | `default` | Uebernimmt verbesserten Prompt |
| `discard-btn` | Button | LLM Panel | `default` | Verwirft Verbesserung |
| `delete-project-btn` | Icon Button | Projekt-Card / Sidebar | `default`, `confirm` | Bestaetigung-Dialog vor Loeschung |
| `confirm-dialog` | Dialog | Overlay | `open`, `closed` | "Projekt und alle Generierungen loeschen?" mit Bestaetigen/Abbrechen |
| `sidebar-project-list` | List | Sidebar | `empty`, `populated` | Liste aller Projekte, aktives hervorgehoben |

---

## Feature State Machine

### States Overview

| State | UI | Available Actions |
|-------|----|--------------------|
| `project-list` | Projekt-Uebersicht mit Cards | Projekt oeffnen, Neues Projekt, Projekt loeschen |
| `workspace-empty` | Projekt offen, keine Generierungen | Prompt eingeben, Modell waehlen, Parameter setzen, Builder oeffnen, Prompt verbessern, Generate |
| `workspace-ready` | Projekt offen, Prompt eingegeben | Generate, Builder oeffnen, Prompt verbessern |
| `generating` | Loading-Placeholder(s) in Galerie, Generate-Button zeigt Spinner | Prompt editieren, Builder oeffnen, Prompt verbessern, erneut Generate (queued) |
| `workspace-populated` | Generierungen in Galerie sichtbar | Alle workspace-ready Aktionen + Variation, Bild anschauen |
| `lightbox-open` | Bild-Detail Modal offen | Download, Variation, Loeschen, Schliessen |
| `builder-open` | Prompt Builder Drawer offen | Kategorie wechseln, Option waehlen, Surprise Me, Baustein erstellen, Schliessen |
| `improving-prompt` | LLM arbeitet, Vergleichspanel sichtbar | Warten |
| `prompt-improved` | Original + Verbesserter Prompt nebeneinander | Uebernehmen, Verwerfen |
| `generation-failed` | Platzhalter mit Error-State in Galerie | Retry, anderes generieren |

### Transitions

| Current State | Trigger | UI Feedback | Next State | Business Rules |
|---------------|---------|-------------|------------|----------------|
| `project-list` | Klick auf Projekt-Card | Navigation zu Workspace | `workspace-empty` oder `workspace-populated` | -- |
| `project-list` | Klick "Neues Projekt" | Inline-Input erscheint | `project-list` | Projektname darf nicht leer sein |
| `project-list` | Projekt-Name eingegeben + Enter | Projekt wird erstellt, Navigation | `workspace-empty` | -- |
| `project-list` | Loeschen-Icon -> Bestaetigen | Projekt + Generierungen + R2-Bilder geloescht | `project-list` | Bestaetigung erforderlich |
| `workspace-empty` | Prompt eingeben | Prompt-Feld gefuellt | `workspace-ready` | -- |
| `workspace-ready` | Klick "Generate" oder Cmd/Ctrl+Enter | Placeholder(s) in Galerie, Button zeigt Spinner | `generating` | Prompt darf nicht leer sein, Modell muss gewaehlt sein |
| `generating` | Replicate API antwortet (Erfolg) | Bild erscheint, Placeholder wird ersetzt | `workspace-populated` | Bild wird in R2 gespeichert, DB-Eintrag erstellt |
| `generating` | Replicate API antwortet (Fehler) | Placeholder zeigt Error + Retry | `generation-failed` | Toast-Notification mit Fehlermeldung |
| `generation-failed` | Klick "Retry" | Neuer Placeholder, API-Call wiederholt | `generating` | Gleicher Prompt + Parameter |
| `workspace-populated` | Klick auf Bild | Lightbox oeffnet | `lightbox-open` | -- |
| `lightbox-open` | Klick "Variation" | Prompt + Parameter in Eingabe uebernommen, Lightbox schliesst | `workspace-ready` | -- |
| `lightbox-open` | Klick "Download" | PNG-Download startet | `lightbox-open` | -- |
| `lightbox-open` | Klick "Loeschen" -> Bestaetigen | Generierung + R2-Bild geloescht | `workspace-populated` oder `workspace-empty` | Bestaetigung erforderlich |
| `lightbox-open` | Klick Prev/Next oder Pfeiltasten | Naechstes/Vorheriges Bild wird angezeigt | `lightbox-open` | Wrap-Around am Ende/Anfang der Galerie |
| `lightbox-open` | Klick Schliessen/Overlay | Lightbox schliesst | `workspace-populated` | -- |
| `workspace-ready` | Klick "Prompt Builder" | Drawer oeffnet | `builder-open` | -- |
| `builder-open` | Klick auf Option-Chip | Snippet zum Prompt hinzugefuegt/entfernt | `builder-open` | Toggle-Verhalten |
| `builder-open` | Klick "Surprise Me" | Falls Auswahl existiert: Bestaetigung. Dann zufaellige Auswahl in allen Kategorien | `builder-open` | Bestaetigung wenn bestehende Auswahl vorhanden |
| `builder-open` | Klick Schliessen | Drawer schliesst, Prompt ist aktualisiert | `workspace-ready` | -- |
| `workspace-ready` | Klick "Prompt verbessern" | LLM-Panel erscheint, Loading | `improving-prompt` | Prompt darf nicht leer sein |
| `improving-prompt` | LLM-Antwort erhalten | Verbesserter Prompt erscheint neben Original | `prompt-improved` | -- |
| `prompt-improved` | Klick "Uebernehmen" | Verbesserter Prompt ersetzt Original, Panel schliesst | `workspace-ready` | -- |
| `prompt-improved` | Klick "Verwerfen" | Panel schliesst, Original bleibt | `workspace-ready` | -- |

---

## Business Rules

- Projektname darf nicht leer sein
- Prompt darf nicht leer sein fuer Generation
- Ein Modell muss ausgewaehlt sein fuer Generation
- Varianten-Anzahl: 1-4
- Negativ-Prompt Feld: Nur sichtbar wenn das ausgewaehlte Modell `negative_prompt` im Input-Schema hat
- Parameter-Panel: Controls werden dynamisch aus dem Replicate Model Input-Schema generiert
- Replicate Output-URLs verfallen nach 1 Stunde -> Bilder muessen sofort in R2 gespeichert werden
- Download-Format: Immer PNG (Server-Konvertierung wenn Replicate anderes Format liefert)
- Projekt loeschen: Hard Delete -- Projekt, alle Generierungen (DB) und alle zugehoerigen Bilder (R2) werden geloescht
- Prompt Builder Concatenation: Ausgewaehlte Snippets werden kommasepariert an den Base-Prompt angehaengt
- Surprise Me: Ersetzt bestehende Prompt-Builder-Auswahl durch zufaellige Kombination. Falls bereits Optionen ausgewaehlt sind, wird vorher eine Bestaetigung angezeigt: "Aktuelle Auswahl ersetzen?"
- Prompt-Bausteine: User kann beliebig viele Snippets in beliebig vielen eigenen Kategorien erstellen
- LLM-Verbesserung: OpenRouter API, Default-Modell `openai/gpt-oss-120b:exacto`
- Keyboard Shortcut: Cmd/Ctrl+Enter im Prompt-Feld triggert Generation
- UI waehrend Generation: Prompt-Bereich bleibt bedienbar (nicht gesperrt). Generation laeuft im Hintergrund, Placeholder in Galerie trackt Status unabhaengig
- Projekt umbenennen: Doppelklick auf Projektname oder Edit-Icon, Inline-Input, Enter/Blur speichert

---

## Data

### Project

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `id` | Yes | UUID, auto-generated | Primary Key |
| `name` | Yes | Non-empty string, max 255 chars | Vom User vergeben |
| `created_at` | Yes | Timestamp, auto-generated | -- |
| `updated_at` | Yes | Timestamp, auto-updated | -- |

### Generation

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `id` | Yes | UUID, auto-generated | Primary Key |
| `project_id` | Yes | FK -> Project | Zugehoeriges Projekt |
| `prompt` | Yes | Non-empty string | Der verwendete Prompt |
| `negative_prompt` | No | String or null | Falls Modell es unterstuetzt |
| `model_id` | Yes | Non-empty string | Replicate Model ID (z.B. "black-forest-labs/flux-2-pro") |
| `model_params` | Yes | JSON | Alle Parameter die bei Generation gesetzt waren |
| `status` | Yes | Enum: "pending", "completed", "failed" | Aktueller Status |
| `image_url` | No | URL string or null | R2 Public URL des gespeicherten Bildes |
| `replicate_prediction_id` | No | String or null | Replicate Prediction ID fuer Debugging |
| `error_message` | No | String or null | Fehlermeldung bei status="failed" |
| `width` | No | Integer or null | Bildbreite in Pixel |
| `height` | No | Integer or null | Bildhoehe in Pixel |
| `seed` | No | Integer or null | Verwendeter Seed (fuer Reproduzierbarkeit) |
| `created_at` | Yes | Timestamp, auto-generated | -- |

### Prompt Snippet (Baustein)

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `id` | Yes | UUID, auto-generated | Primary Key |
| `text` | Yes | Non-empty string, max 500 chars | Der Snippet-Text |
| `category` | Yes | Non-empty string, max 100 chars | User-definierte Kategorie (z.B. "POD Basics") |
| `created_at` | Yes | Timestamp, auto-generated | -- |

---

## Implementation Slices

### Dependencies

```
Slice 1 (Infra) -> Slice 2 (Generation) -> Slice 3 (Galerie) -> Slice 4 (Builder)
                                                                -> Slice 5 (LLM)
                                                                -> Slice 6 (Variationen)
                                                 Slice 3 -> Slice 7 (Bausteine)
```

### Slices

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| 1 | Infrastruktur & Projekt-CRUD | Next.js Setup, PostgreSQL Docker, Drizzle Schema, R2 Client, Projekt erstellen/oeffnen/loeschen | Projekt anlegen, DB-Eintrag pruefen, Projekt loeschen | -- |
| 2 | Bild-Generation Pipeline | Replicate Integration (Blocking API), R2 Upload, DB-Eintrag, Modell-Dropdown mit dynamischen Parametern | Prompt eingeben, Generate klicken, Bild erscheint und ist in R2 + DB gespeichert | Slice 1 |
| 3 | Galerie & Lightbox | Masonry Grid, Loading-Placeholders, Lightbox Modal mit Details, Download als PNG, Generierung loeschen | Bilder werden korrekt angezeigt, Download funktioniert, Loeschen entfernt Bild aus R2 + DB | Slice 2 |
| 4 | Prompt Builder | Drawer/Modal, Style + Colors Kategorien (je 9 Optionen), Prompt Concatenation, Surprise Me Button | Option klicken fuegt Snippet zum Prompt hinzu, Surprise Me wuerfelt Kombination | Slice 3 |
| 5 | LLM Prompt-Verbesserung | OpenRouter Integration, Button, Nebeneinander-Vergleich, Uebernehmen/Verwerfen | Prompt verbessern klicken, verbesserter Prompt erscheint, Uebernehmen ersetzt Original | Slice 3 |
| 6 | Variationen & Batch | Prompt + Parameter uebernehmen, Anpassung, 1-4 Batch, mehrere Placeholders | Variation klicken, Parameter uebernommen, 4 Varianten generieren | Slice 3 |
| 7 | Eigene Prompt-Bausteine | Snippet CRUD, Kategorie-Verwaltung, Integration in Builder als eigene Kategorie | Baustein erstellen, erscheint im Builder, Klick fuegt zum Prompt hinzu | Slice 4 |

### Recommended Order

1. **Slice 1:** Infrastruktur & Projekt-CRUD -- Fundament, ohne das nichts geht
2. **Slice 2:** Bild-Generation Pipeline -- Kernfunktion, erster E2E-Durchstich
3. **Slice 3:** Galerie & Lightbox -- Generierte Bilder sichtbar und verwaltbar machen
4. **Slice 4:** Prompt Builder -- Kern-Differenziator, erleichtert Prompt-Erstellung
5. **Slice 5:** LLM Prompt-Verbesserung -- Intelligenz-Layer auf dem Prompt
6. **Slice 6:** Variationen & Batch -- Schnellere Iteration
7. **Slice 7:** Eigene Prompt-Bausteine -- Personalisierung des Builders

---

## Context & Research

### Web Research

| Source | Finding |
|--------|---------|
| Replicate API | Pay-per-use, FLUX Schnell $0.003/Bild, FLUX 2 Pro $0.055/Bild. Output-URLs verfallen nach 1h. Node.js SDK `replicate`, `replicate.run()` fuer Blocking. Rate Limit 600/min |
| Cloudflare R2 | 10GB free, Egress immer $0. Public Bucket + Custom Domain empfohlen. `@aws-sdk/client-s3` mit R2-Endpoint. Fuer Personal Use wahrscheinlich $0/Monat |
| Kittl Prompt Builder | Base Prompt + klickbare Kategorie-Chips. Concatenation-Ansatz (transparent, editierbar). Kategorien: Style, Perspective, Lighting, Effects. Text-Chips, keine Thumbnails im Builder selbst |
| POD Best Practices | "white background", "centered composition" fuer T-Shirt. PNG Pflicht. 300 DPI Standard, AI liefert 72-150 DPI -> Upscaling noetig (Phase 2). sRGB Farbprofil |
| Drizzle vs Prisma | Drizzle: kein Codegen, 57KB Bundle, SQL-first. Prisma 7: Rust-Engine entfernt, warm-Performance vergleichbar. Drizzle fuer Solo-Dev empfohlen |
| Next.js Patterns | Server Actions fuer Mutations, Route Handlers fuer Webhooks/Streaming. SSE fuer Echtzeit-Status. Presigned URLs fuer Client-Uploads |
| OpenRouter | OpenAI-kompatible API, Pay-as-you-go. Default-Modell `openai/gpt-oss-120b:exacto`. Via OpenAI SDK mit Base URL Swap |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| -- | Alle Fragen geklaert | -- | -- | -- |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-02 | Replicate API | Pricing, Modelle, Webhooks vs Polling, SDK, Rate Limits, Output-URL Expiration (1h) |
| 2026-03-02 | Cloudflare R2 | Pricing, Public vs Signed, SDK, Next.js Integration, Image Serving |
| 2026-03-02 | Kittl/UX | Prompt Builder Patterns, Concatenation, POD-spezifische Prompt-Tipps |
| 2026-03-02 | Next.js/DB | Drizzle vs Prisma, Docker Compose, Server Actions, SSE, Projektstruktur |

---

## Q&A Log

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Phase 0 hat 4 Sub-Features. Welchen Scope soll diese Discovery abdecken? | Gesamte Phase 0 |
| 2 | Soll ich zuerst eine umfassende Recherche durchfuehren oder direkt in die Q&A einsteigen? | Recherche zuerst |
| 3 | Replicate: Blocking API (sync) oder Webhook-basiert (async)? | Blocking API (replicate.run()) |
| 4 | ORM: Drizzle oder Prisma? | Drizzle |
| 5 | R2 Zugriff: Public Bucket oder Signed URLs? | Public Bucket (Zugangsdaten bereits in .env vorhanden) |
| 6 | Hast du bereits eine Domain auf Cloudflare DNS fuer R2 Public Access? | R2_PUBLIC_URL steht in der .env, keine separate Public Development URL noetig |
| 7 | Welche Replicate-Modelle willst du initial unterstuetzen? | black-forest-labs/flux-2-pro, google/nano-banana-2, recraft-ai/recraft-v4, bytedance/seedream-5-lite, bytedance/seedream-4.5, google/gemini-2.5-flash-image |
| 8 | Prompt Builder Kategorien: Wie in Roadmap (6 Kategorien) oder anpassen? | Style und Colors zum Anfang, Rest spaeter |
| 9 | LLM Prompt-Assistent: Wie soll die Verbesserung funktionieren? | Button "Prompt verbessern", kein Streaming/Chat |
| 10 | Modell-Parameter: Basis-Set, Erweitert oder Modell-abhaengig? | Modell-abhaengig (dynamisch via Replicate Schema API) |
| 11 | Sollen Parameter dynamisch geladen oder hardcoded werden? | Dynamisch via Replicate API |
| 12 | Projekt-Struktur: Was gehoert zu einem Projekt? | Name + Generierungen (minimal) |
| 13 | Hauptlayout der App? | Sidebar + Main Area |
| 14 | Negativ-Prompts: Separates Feld? | Ja, separates Feld (nur sichtbar wenn Modell es unterstuetzt) |
| 15 | Prompt-History: Wie handhaben? | An Generierung gebunden (jede Generierung speichert ihren Prompt) |
| 16 | Discovery-Tiefe? | Detailliert |
| 17 | Was sieht der User als erstes beim App-Oeffnen? | Projekt-Uebersicht |
| 18 | Was passiert nach Klick auf Generate? | Inline Loading + Galerie-Update (kein Page-Wechsel) |
| 19 | Galerie-Ansicht? | Masonry Grid |
| 20 | Was passiert beim Klick auf ein Bild? | Lightbox/Modal mit Details und Aktionen |
| 21 | Wo erscheint der Prompt Builder? | Modal/Drawer |
| 22 | Wie funktioniert Variation erstellen? | Prompt + Modell + Parameter uebernehmen, Anpassung optional, Batch 1-4 einstellbar |
| 23 | Wo und wie waehlt man das Modell? | Dropdown ueber dem Prompt (Modellname + Preis) |
| 24 | Error Handling bei fehlgeschlagener Generation? | Toast + Retry-Button in Galerie-Platzhalter |
| 25 | Varianten-Batch: Wie viele maximal? | 1-4 |
| 26 | Surprise Me Button? | Ja, globaler Button (wuerfelt aus allen Kategorien) |
| 27 | Download-Format? | Immer PNG |
| 28 | Was passiert beim Loeschen eines Projekts? | Hard Delete (Projekt + alle Generierungen + R2-Bilder) |
| 29 | LLM: Ergebnis ersetzen oder nebeneinander? | Nebeneinander (Original + Verbesserter Prompt, User waehlt) |
| 30 | Prompt Templates / Bausteine? | Eigene Prompt-Bausteine: User-erstellte Text-Snippets mit Kategorie, als eigene Kategorie im Prompt Builder integriert |
| 31 | Prompt-Bausteine: Was ist ein Baustein? | Text-Snippet + Kategorie (z.B. "on white background, centered" in "POD Basics") |
| 32 | Integration der Bausteine? | Eigene Kategorie "Meine Bausteine" im Prompt Builder, gleiche Klick-Mechanik |
