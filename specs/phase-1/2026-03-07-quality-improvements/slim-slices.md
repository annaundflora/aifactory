# Slim Slice Decomposition

**Feature:** Quality Improvements
**Discovery-Slices:** 8 grobe Slices
**Atomare Slices:** 21 Slices
**Stack:** TypeScript/Next.js 16 + React 19 + Tailwind v4 + shadcn/ui + Drizzle ORM + PostgreSQL (vitest + @testing-library/react)

---

## Dependency Graph

```
slice-01 (DB Schema: generations extensions)
    |
    +---> slice-06 (Generation Service: structured prompt)
    |         |
    |         +---> slice-07 (Prompt Area UI: structured fields)
    |                   |
    |                   +---> slice-08 (Prompt Tabs Container)
    |                   |         |
    |                   |         +---> slice-12 (History List UI)
    |                   |         |         |
    |                   |         |         +---> slice-13 (Favorites List UI)
    |                   |         |
    |                   |         +---> slice-15 (Template Selector UI)
    |                   |
    |                   +---> slice-09 (Builder Fragments Config)
    |                             |
    |                             +---> slice-10 (Builder Drawer Pro UI)
    |
    +---> slice-11 (History Service + Actions)
              |
              +---> slice-12 (History List UI)

slice-02 (DB Schema: projects extensions)
    |
    +---> slice-16 (Thumbnail Service)
              |
              +---> slice-17 (Thumbnail UI: Project Card)

slice-03 (shadcn Sidebar Setup)
    |
    +---> slice-04 (Sidebar Content Migration)
              |
              +---> slice-05 (Sidebar Layout Integration)

slice-14 (Adaptive Improve Service) -----> eigenstaendig

slice-18 (Improve Modal UI) -----> eigenstaendig (nutzt bestehende llm-comparison.tsx)

slice-19 (Lightbox Fullscreen) -----> eigenstaendig

slice-20 (OpenRouter Timeout) -----> eigenstaendig

slice-21 (DB Migration SQL) -----> nach slice-01 + slice-02
```

---

## Slice-Liste

### Slice 01: DB Schema -- Generations Extensions
- **Scope:** Drizzle-Schema um `prompt_motiv`, `prompt_style`, `is_favorite` in der `generations`-Tabelle erweitern. Index auf `is_favorite` anlegen.
- **Deliverables:**
  - `lib/db/schema.ts` (3 neue Spalten + Index)
- **Done-Signal:** `drizzle-kit generate` erzeugt eine gueltige Migration. Schema-Typen kompilieren fehlerfrei.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 5 "Prompt History + Favoriten", Slice 2 "Strukturiertes Prompt-Feld"

### Slice 02: DB Schema -- Projects Extensions
- **Scope:** Drizzle-Schema um `thumbnail_url` und `thumbnail_status` in der `projects`-Tabelle erweitern. Index auf `thumbnail_status` anlegen.
- **Deliverables:**
  - `lib/db/schema.ts` (2 neue Spalten + Index)
- **Done-Signal:** `drizzle-kit generate` erzeugt eine gueltige Migration. Schema-Typen kompilieren fehlerfrei.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 8 "Projekt-Thumbnails"

### Slice 03: shadcn Sidebar Setup
- **Scope:** shadcn Sidebar-Komponente installieren (`npx shadcn@latest add sidebar`). Pruefen, dass alle shadcn Sidebar-Primitives verfuegbar sind (SidebarProvider, Sidebar, SidebarTrigger, SidebarContent etc.).
- **Deliverables:**
  - `components/ui/sidebar.tsx` (generiert durch shadcn CLI)
- **Done-Signal:** Import von `SidebarProvider`, `Sidebar`, `SidebarTrigger` kompiliert fehlerfrei.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 1 "shadcn Sidebar"

### Slice 04: Sidebar Content Migration
- **Scope:** Bestehende Sidebar-Inhalte (Projektliste, "New Project", "Back to Overview") in shadcn Sidebar-Struktur migrieren. Collapse-Funktion (Icon-Mode mit Projekt-Initialen) implementieren. Cookie-Persistierung des Collapse-States (shadcn built-in).
- **Deliverables:**
  - `components/sidebar.tsx` (Rewrite: shadcn Sidebar-Primitives nutzen)
  - `components/project-list.tsx` (Anpassung fuer SidebarMenu-Integration)
- **Done-Signal:** Sidebar zeigt Projektliste, klappt auf Icon-Mode ein/aus, State persistiert ueber Page-Reload.
- **Dependencies:** ["slice-03"]
- **Discovery-Quelle:** Slice 1 "shadcn Sidebar"

### Slice 05: Sidebar Layout Integration
- **Scope:** Workspace-Layout (`app/projects/[id]/page.tsx`) in `SidebarProvider` wrappen. Mobile-Hamburger-Button im Header. Sidebar als Overlay-Drawer auf Mobile.
- **Deliverables:**
  - `app/projects/[id]/page.tsx` (SidebarProvider-Wrapper, Layout-Anpassung)
- **Done-Signal:** Desktop: Sidebar einklappbar mit Keyboard-Shortcut. Mobile: Hamburger oeffnet Sidebar als Overlay.
- **Dependencies:** ["slice-04"]
- **Discovery-Quelle:** Slice 1 "shadcn Sidebar"

### Slice 06: Generation Service -- Structured Prompt
- **Scope:** `generation-service.ts` erweitern: akzeptiert `promptMotiv` + `promptStyle` separat, komponiert `prompt = "{motiv}. {style}"`, speichert beide strukturierten Felder in DB. `generateImages` Server Action anpassen.
- **Deliverables:**
  - `lib/services/generation-service.ts` (structured prompt handling)
  - `app/actions/generations.ts` (Input-Erweiterung: promptMotiv, promptStyle)
- **Done-Signal:** Unit-Test: Generation mit promptMotiv + promptStyle erzeugt korrekt komponierten prompt. Bestehende Tests bleiben gruen.
- **Dependencies:** ["slice-01"]
- **Discovery-Quelle:** Slice 2 "Strukturiertes Prompt-Feld"

### Slice 07: Prompt Area UI -- Structured Fields
- **Scope:** `prompt-area.tsx` umbauen: 3 Labeled Sections (Motiv mit Pflicht-Markierung, Stil/Modifier, Negative Prompt). Auto-Resize Textareas. Prompt-Zusammensetzung bei Generate. Negative Prompt nur anzeigen wenn Modell es unterstuetzt. Workspace-State-Context anpassen.
- **Deliverables:**
  - `components/workspace/prompt-area.tsx` (Rewrite: 3 Sections statt 1 Textarea)
  - `lib/workspace-state.tsx` (State-Erweiterung: promptMotiv, promptStyle)
- **Done-Signal:** UI zeigt 3 getrennte Felder. Generate sendet korrekt komponierten Prompt. Motiv-Feld ist Pflicht (Generate-Button disabled wenn leer).
- **Dependencies:** ["slice-06"]
- **Discovery-Quelle:** Slice 2 "Strukturiertes Prompt-Feld"

### Slice 08: Prompt Tabs Container
- **Scope:** Tab-Leiste ueber dem Prompt-Bereich erstellen: [Prompt] [History] [Favorites]. Tab-Wechsel zeigt entsprechenden Content. Prompt-Tab zeigt bestehende structured fields.
- **Deliverables:**
  - `components/workspace/prompt-tabs.tsx` (neuer Tab-Container)
  - `components/workspace/prompt-area.tsx` (Integration der Tabs)
- **Done-Signal:** 3 Tabs sind klickbar und wechseln den Inhalt. Prompt-Tab zeigt die strukturierten Felder.
- **Dependencies:** ["slice-07"]
- **Discovery-Quelle:** Slice 5 "Prompt History + Favoriten"

### Slice 09: Builder Fragments Config
- **Scope:** Hardcoded Builder-Fragmente als TypeScript-Config definieren. 5 Kategorien (Style, Colors, Composition, Lighting, Mood) mit je 6-9 ausformulierten Fragmenten. TypeScript-Typen fuer BuilderFragment und BuilderCategory.
- **Deliverables:**
  - `lib/builder-fragments.ts` (neue Datei: Kategorien + Fragmente)
- **Done-Signal:** Import und Iteration ueber alle Kategorien/Fragmente funktioniert. Jedes Fragment hat id, label und ausformulierten fragment-Text.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 3 "Builder Pro"

### Slice 10: Builder Drawer Pro UI
- **Scope:** `builder-drawer.tsx` erweitern: 6 Tabs (Style, Colors, Composition, Lighting, Mood, My Snippets) in 2 Reihen. Chips als Toggles mit ausformulierten Fragmenten. Live-Preview des zusammengesetzten Stil-Texts. "Done" schreibt in Stil/Modifier-Feld (ersetzt, kein Append). `category-tabs.tsx` anpassen.
- **Deliverables:**
  - `components/prompt-builder/builder-drawer.tsx` (6 Tabs, Fragment-Chips, Preview)
  - `components/prompt-builder/category-tabs.tsx` (erweiterte Kategorien)
- **Done-Signal:** Drawer zeigt 6 Tabs. Chip-Auswahl zeigt Vorschau des zusammengesetzten Texts. "Done" schreibt Text ins Stil-Feld.
- **Dependencies:** ["slice-09", "slice-07"]
- **Discovery-Quelle:** Slice 3 "Builder Pro"

### Slice 11: Prompt History Service + Actions
- **Scope:** Neuen `prompt-history-service.ts` erstellen: `getHistory(offset, limit)` mit DISTINCT ON Query, `getFavorites(offset, limit)`, `toggleFavorite(generationId)`. Queries in `lib/db/queries.ts` hinzufuegen. Server Actions in `app/actions/prompts.ts`: `getPromptHistory`, `getFavoritePrompts`, `toggleFavorite`.
- **Deliverables:**
  - `lib/services/prompt-history-service.ts` (neue Datei)
  - `lib/db/queries.ts` (neue Queries: getPromptHistory, getFavorites, toggleFavorite)
  - `app/actions/prompts.ts` (3 neue Actions)
- **Done-Signal:** Unit-Tests: getHistory gibt paginierte Eintraege zurueck. toggleFavorite wechselt den Status. getFavorites filtert korrekt.
- **Dependencies:** ["slice-01"]
- **Discovery-Quelle:** Slice 5 "Prompt History + Favoriten"

### Slice 12: History List UI
- **Scope:** `history-list.tsx` erstellen: chronologische Liste mit Prompt-Preview (gekuerzt), Modell-Badge, relativem Zeitstempel, Stern-Toggle. Pagination via scroll-to-load-more (50 pro Batch). Klick auf Eintrag laedt Prompt-Felder (mit Confirmation Dialog wenn Felder nicht leer).
- **Deliverables:**
  - `components/workspace/history-list.tsx` (neue Datei)
- **Done-Signal:** History-Tab zeigt Eintraege mit Stern-Toggle. Scroll laedt weitere Batches. Klick auf Eintrag befuellt Prompt-Felder.
- **Dependencies:** ["slice-08", "slice-11"]
- **Discovery-Quelle:** Slice 5 "Prompt History + Favoriten"

### Slice 13: Favorites List UI
- **Scope:** `favorites-list.tsx` erstellen: gefilterte Ansicht (nur favorisierte Prompts). Gleiche Darstellung wie History, aber mit `is_favorite = true` Filter. Empty-State: "No favorites yet. Star prompts in History to save them here."
- **Deliverables:**
  - `components/workspace/favorites-list.tsx` (neue Datei)
- **Done-Signal:** Favorites-Tab zeigt nur markierte Eintraege. Stern-Toggle entfernt Eintrag aus der Liste. Empty-State bei leerer Liste.
- **Dependencies:** ["slice-12"]
- **Discovery-Quelle:** Slice 5 "Prompt History + Favoriten"

### Slice 14: Adaptive Improve Service
- **Scope:** `prompt-service.ts` anpassen: `improve()` akzeptiert `modelId` Parameter. Neuer adaptiver System-Prompt mit Prompt-Analyse (Motiv, Stil, Detailgrad) und modell-spezifischer Optimierung. Modell-Display-Name aus `lib/models.ts` laden.
- **Deliverables:**
  - `lib/services/prompt-service.ts` (adaptiver System-Prompt, modelId-Parameter)
  - `app/actions/prompts.ts` (improvePrompt: modelId hinzufuegen)
- **Done-Signal:** Unit-Test: improve() baut System-Prompt mit korrektem Modellnamen. Verschiedene Prompts (minimal/moderat/reich) erzeugen unterschiedliche Strategien.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 4 "Adaptiver Improve"

### Slice 15: Template Selector UI
- **Scope:** `prompt-templates.ts` als hardcoded Config erstellen (5 Templates: Product Shot, Landscape, Character Design, Logo Design, Abstract Art). `template-selector.tsx` als Dropdown/Popover im Prompt-Tab. Klick befuellt alle 3 Prompt-Felder. Confirmation Dialog wenn Felder nicht leer.
- **Deliverables:**
  - `lib/prompt-templates.ts` (neue Datei: Template-Definitionen)
  - `components/workspace/template-selector.tsx` (neue Datei: Dropdown UI)
- **Done-Signal:** Templates-Dropdown zeigt 5 Optionen. Klick befuellt Motiv (Platzhalter), Stil und Negative Prompt korrekt. Confirmation Dialog erscheint bei nicht-leeren Feldern.
- **Dependencies:** ["slice-08"]
- **Discovery-Quelle:** Slice 6 "Prompt Templates"

### Slice 16: Thumbnail Service
- **Scope:** `thumbnail-service.ts` erstellen: `generateForProject(projectId)` -- LLM generiert Thumbnail-Prompt aus Projektname, Recraft V4 generiert Bild (1024x1024), Sharp resize auf 512x512, Upload zu R2 (`thumbnails/{projectId}.png`), DB-Update. `refreshForProject(projectId)` -- analysiert letzte 10 Prompts. Server Action `generateThumbnail` in `app/actions/projects.ts`. Queries in `lib/db/queries.ts` (updateProjectThumbnail).
- **Deliverables:**
  - `lib/services/thumbnail-service.ts` (neue Datei)
  - `lib/db/queries.ts` (updateProjectThumbnail Query)
  - `app/actions/projects.ts` (generateThumbnail Action)
- **Done-Signal:** Unit-Test: generateForProject setzt Status auf pending, ruft Replicate + Sharp + R2 auf, setzt Status auf completed. Fehlerfall setzt Status auf failed.
- **Dependencies:** ["slice-02"]
- **Discovery-Quelle:** Slice 8 "Projekt-Thumbnails"

### Slice 17: Thumbnail UI -- Project Card
- **Scope:** `project-card.tsx` anpassen: Thumbnail-Bild statt grauem Platzhalter anzeigen. Loading-State (Spinner/Pulse). Fallback auf Platzhalter bei failed/none. "Thumbnail aktualisieren" Button bei Hover (neben Edit/Delete). Thumbnail-Generierung bei Projekterstellung in `createProject` Action einbauen.
- **Deliverables:**
  - `components/project-card.tsx` (Thumbnail-Anzeige + Refresh-Button)
  - `app/actions/projects.ts` (createProject: Thumbnail-Generierung fire-and-forget)
- **Done-Signal:** Neue Projekte zeigen nach kurzer Zeit ein Thumbnail. Refresh-Button loest neue Generierung aus. Fehlerfall zeigt Platzhalter.
- **Dependencies:** ["slice-16"]
- **Discovery-Quelle:** Slice 8 "Projekt-Thumbnails"

### Slice 18: Improve Modal UI
- **Scope:** `llm-comparison.tsx` von Inline-Ansicht zu Modal (shadcn Dialog) umbauen. Side-by-Side Layout: Original (links) vs. Improved (rechts). Loading-State mit Skeleton. Badge "Optimized for: {Modellname}". Adopt/Discard Buttons. modelId an improve Action uebergeben.
- **Deliverables:**
  - `components/prompt-improve/llm-comparison.tsx` (Modal statt inline, Side-by-Side)
  - `components/workspace/prompt-area.tsx` (Improve-Button uebergibt modelId)
- **Done-Signal:** Improve oeffnet als Modal. Loading-Skeleton waehrend LLM-Call. Side-by-Side mit Modell-Badge. Adopt uebernimmt Text, Discard schliesst ohne Aenderung.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 4 "Adaptiver Improve"

### Slice 19: Lightbox Fullscreen
- **Scope:** `lightbox-modal.tsx` um Vollbild-Toggle erweitern. Normal-Modus: Bild max 70vh + Details-Panel (wie bisher). Fullscreen-Modus: Bild 100% Viewport mit object-contain, Details-Panel versteckt, schwarzer Hintergrund. Toggle-Button (Maximize2/Minimize2 Icons) neben Close-Button. ESC kehrt zu Normal zurueck. Navigation funktioniert in beiden Modi.
- **Deliverables:**
  - `components/lightbox/lightbox-modal.tsx` (Fullscreen-Toggle + CSS-States)
- **Done-Signal:** Toggle-Button wechselt zwischen Normal und Fullscreen. ESC funktioniert. Navigation (Pfeile) in beiden Modi.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 7 "Lightbox Vollbild"

### Slice 20: OpenRouter Client Timeout
- **Scope:** `lib/clients/openrouter.ts` um konfigurierbaren Fetch-Timeout via AbortController erweitern. Default: 30s. Optionaler `timeout` Parameter in `chat()` Methode. Thumbnail-Calls nutzen 15s.
- **Deliverables:**
  - `lib/clients/openrouter.ts` (AbortController + timeout Parameter)
- **Done-Signal:** Unit-Test: Timeout wird korrekt gesetzt. AbortController bricht nach konfigurierter Zeit ab.
- **Dependencies:** []
- **Discovery-Quelle:** Architecture "External API Constraints"

### Slice 21: DB Migration SQL
- **Scope:** `drizzle-kit generate` ausfuehren um Migration-SQL zu erzeugen. Backfill-Statement hinzufuegen: `UPDATE generations SET prompt_motiv = prompt WHERE prompt_motiv = ''`. Migration mit `drizzle-kit migrate` anwenden.
- **Deliverables:**
  - `drizzle/0001_*.sql` (generierte Migration + Backfill)
- **Done-Signal:** Migration laeuft fehlerfrei durch. Bestehende Generations haben `prompt_motiv` befuellt. Neue Spalten sind in der DB sichtbar.
- **Dependencies:** ["slice-01", "slice-02"]
- **Discovery-Quelle:** Architecture "Migration Map"

---

## Recommended Order

```
Phase A (Parallel, keine Dependencies):
  slice-01  DB Schema: Generations Extensions
  slice-02  DB Schema: Projects Extensions
  slice-03  shadcn Sidebar Setup
  slice-09  Builder Fragments Config
  slice-14  Adaptive Improve Service
  slice-19  Lightbox Fullscreen
  slice-20  OpenRouter Client Timeout

Phase B (nach Phase A):
  slice-21  DB Migration SQL (nach slice-01, slice-02)
  slice-04  Sidebar Content Migration (nach slice-03)
  slice-06  Generation Service: Structured Prompt (nach slice-01)
  slice-11  Prompt History Service + Actions (nach slice-01)
  slice-16  Thumbnail Service (nach slice-02)
  slice-18  Improve Modal UI (eigenstaendig)

Phase C (nach Phase B):
  slice-05  Sidebar Layout Integration (nach slice-04)
  slice-07  Prompt Area UI: Structured Fields (nach slice-06)
  slice-17  Thumbnail UI: Project Card (nach slice-16)

Phase D (nach Phase C):
  slice-08  Prompt Tabs Container (nach slice-07)
  slice-10  Builder Drawer Pro UI (nach slice-09, slice-07)

Phase E (nach Phase D):
  slice-12  History List UI (nach slice-08, slice-11)
  slice-15  Template Selector UI (nach slice-08)

Phase F (nach Phase E):
  slice-13  Favorites List UI (nach slice-12)
```

---

## Discovery-Abdeckung

| Discovery Slice | Atomare Slices |
|-----------------|---------------|
| Slice 1: shadcn Sidebar | slice-03, slice-04, slice-05 |
| Slice 2: Strukturiertes Prompt-Feld | slice-01 (teilw.), slice-06, slice-07 |
| Slice 3: Builder Pro | slice-09, slice-10 |
| Slice 4: Adaptiver Improve | slice-14, slice-18 |
| Slice 5: Prompt History + Favoriten | slice-01 (teilw.), slice-08, slice-11, slice-12, slice-13 |
| Slice 6: Prompt Templates | slice-15 |
| Slice 7: Lightbox Vollbild | slice-19 |
| Slice 8: Projekt-Thumbnails | slice-02, slice-16, slice-17 |
| (Infrastruktur) | slice-20, slice-21 |
