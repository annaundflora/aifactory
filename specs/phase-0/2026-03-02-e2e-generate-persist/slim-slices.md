# Slim Slice Decomposition

**Feature:** E2E Generate & Persist (Phase 0)
**Discovery-Slices:** 7 grobe Slices
**Atomare Slices:** 21 Slices
**Stack:** Next.js 16.1 (App Router), TypeScript, Tailwind CSS 4.2.1, shadcn/ui, PostgreSQL 16 (Docker), Drizzle ORM 0.45.1, Cloudflare R2, Replicate SDK 1.4.0

---

## Dependency Graph

```
slice-01 (Docker + DB Schema)
    |
slice-02 (DB Connection + Queries)
    |
slice-03 (Project Server Actions)
    |
    +---> slice-04 (Project Overview UI)
    |         |
    |         +---> slice-05 (Project Workspace Layout + Sidebar)
    |
slice-06 (Model Registry + Schema Service)
    |
    +---> slice-07 (Replicate Client + Storage Client)
              |
              +---> slice-08 (Generation Service + Actions)
                        |
                        +---> slice-09 (Prompt Area + Model Dropdown + Parameter Panel)
                        |         |
                        |         +---> slice-10 (Generation Placeholder + Polling)
                        |
                        +---> slice-11 (Gallery Grid + Generation Cards)
                                  |
                                  +---> slice-12 (Lightbox Modal)
                                  |         |
                                  |         +---> slice-13 (Lightbox Navigation + Actions)
                                  |         |
                                  |         +---> slice-14 (Variation Flow)
                                  |
                                  +---> slice-15 (Download als PNG)
                                  |
                                  +---> slice-16 (Generation Delete + Retry)

slice-09 ---> slice-17 (Prompt Builder Drawer + Style/Colors)
                  |
                  +---> slice-18 (Surprise Me)
                  |
                  +---> slice-19 (Snippet CRUD -- DB + Service + Actions)
                            |
                            +---> slice-20 (Snippet UI im Builder)

slice-09 ---> slice-21 (LLM Prompt Improvement)
```

---

## Slice-Liste

### Slice 01: Docker + DB Schema

- **Scope:** Docker Compose fuer PostgreSQL 16, Drizzle ORM Schema-Definition (projects, generations, prompt_snippets Tabellen), Drizzle Kit Config fuer Migrations.
- **Deliverables:**
  - `docker-compose.yml`
  - `lib/db/schema.ts`
  - `drizzle.config.ts`
- **Done-Signal:** `docker compose up -d` startet PostgreSQL, `npx drizzle-kit generate` erzeugt Migration, `npx drizzle-kit migrate` laeuft fehlerfrei
- **Dependencies:** []
- **Discovery-Quelle:** Slice 1 "Infrastruktur & Projekt-CRUD"

---

### Slice 02: DB Connection + Queries

- **Scope:** postgres.js Connection-Setup als Singleton, Drizzle-Instance, typisierte Query-Funktionen fuer Projects und Generations.
- **Deliverables:**
  - `lib/db/index.ts`
  - `lib/db/queries.ts`
- **Done-Signal:** Unit-Test: Queries koennen Projects und Generations lesen/schreiben/loeschen gegen die laufende DB
- **Dependencies:** ["slice-01"]
- **Discovery-Quelle:** Slice 1 "Infrastruktur & Projekt-CRUD"

---

### Slice 03: Project Server Actions

- **Scope:** Server Actions fuer Projekt-CRUD: createProject, getProjects, getProject, renameProject, deleteProject. Input-Validierung (Name non-empty, max 255 chars).
- **Deliverables:**
  - `app/actions/projects.ts`
- **Done-Signal:** Jede Server Action kann aus einer Test-Page aufgerufen werden und liefert korrekte DB-Ergebnisse. Validierung lehnt leere Namen ab.
- **Dependencies:** ["slice-02"]
- **Discovery-Quelle:** Slice 1 "Infrastruktur & Projekt-CRUD"

---

### Slice 04: Project Overview UI

- **Scope:** Root-Page (`/`) mit Projekt-Uebersicht: project-card Grid (Thumbnail, Name, Count, Datum), new-project-btn mit Inline-Input, rename-project-input, delete-project-btn mit confirm-dialog. Empty State.
- **Deliverables:**
  - `app/page.tsx`
  - `components/project-card.tsx`
  - `components/project-list.tsx`
- **Done-Signal:** Seite rendert Projekt-Cards, neues Projekt erstellen funktioniert, Umbenennen und Loeschen mit Bestaetigung funktionieren
- **Dependencies:** ["slice-03"]
- **Discovery-Quelle:** Slice 1 "Infrastruktur & Projekt-CRUD"

---

### Slice 05: Project Workspace Layout + Sidebar

- **Scope:** Workspace-Page (`/projects/[id]`), Root-Layout mit Toaster, Sidebar mit Projekt-Navigation (sidebar-project-list, aktives Projekt hervorgehoben), new-project-btn in Sidebar, "Zurueck zur Uebersicht" Link.
- **Deliverables:**
  - `app/projects/[id]/page.tsx`
  - `app/layout.tsx`
  - `components/shared/confirm-dialog.tsx`
- **Done-Signal:** Navigation zwischen Overview und Workspace funktioniert, Sidebar zeigt alle Projekte, aktives ist hervorgehoben
- **Dependencies:** ["slice-04"]
- **Discovery-Quelle:** Slice 1 "Infrastruktur & Projekt-CRUD"

---

### Slice 06: Model Registry + Schema Service

- **Scope:** Statische Model-Registry (6 Modelle mit IDs, Display-Namen, Preisen), ModelSchemaService mit In-Memory-Cache (laedt openapi_schema von Replicate API), Server Action getModelSchema.
- **Deliverables:**
  - `lib/models.ts`
  - `lib/services/model-schema-service.ts`
  - `app/actions/models.ts`
- **Done-Signal:** getModelSchema liefert Parameter-Properties fuer jedes der 6 Modelle. Cache verhindert redundante API-Calls.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 2 "Bild-Generation Pipeline"

---

### Slice 07: Replicate Client + Storage Client

- **Scope:** ReplicateClient-Wrapper (predictions.create + replicate.wait, liefert ReplicateRunResult mit output Stream, predictionId, seed), StorageService fuer R2 (Upload via PutObject, Delete via DeleteObject, Public URL Konstruktion).
- **Deliverables:**
  - `lib/clients/replicate.ts`
  - `lib/clients/storage.ts`
- **Done-Signal:** ReplicateClient kann ein Bild generieren und gibt Stream + Metadaten zurueck. StorageService kann einen Stream nach R2 uploaden und die Public URL zurueckgeben. DeleteObject entfernt das Objekt.
- **Dependencies:** ["slice-06"]
- **Discovery-Quelle:** Slice 2 "Bild-Generation Pipeline"

---

### Slice 08: Generation Service + Actions

- **Scope:** GenerationService (Orchestrierung: DB-Insert pending, Replicate-Call, R2-Upload, DB-Update completed/failed, PNG-Konvertierung via sharp bei Nicht-PNG), Server Actions generateImages und retryGeneration.
- **Deliverables:**
  - `lib/services/generation-service.ts`
  - `app/actions/generations.ts`
- **Done-Signal:** generateImages erstellt pending-Eintraege, ruft Replicate auf, speichert in R2, aktualisiert DB auf completed mit image_url. Bei Fehler: status=failed mit error_message. retryGeneration wiederholt fehlgeschlagene Generation.
- **Dependencies:** ["slice-07", "slice-02"]
- **Discovery-Quelle:** Slice 2 "Bild-Generation Pipeline"

---

### Slice 09: Prompt Area + Model Dropdown + Parameter Panel

- **Scope:** Client Components fuer den oberen Workspace-Bereich: model-dropdown (Modellname + Preis, laedt Schema bei Wechsel), prompt-textarea (mehrzeilig, Auto-Resize, Cmd/Ctrl+Enter), negative-prompt-input (nur sichtbar wenn Modell es unterstuetzt), parameter-panel (dynamisch generierte Controls aus Model Schema), generate-btn, variant-count Selector.
- **Deliverables:**
  - `components/workspace/prompt-area.tsx`
  - `components/workspace/parameter-panel.tsx`
- **Done-Signal:** Modell-Wechsel laedt Parameter-Panel neu. Prompt-Eingabe + Generate-Button triggert generateImages Action. Negativ-Prompt ist modellabhaengig sichtbar/versteckt. Parameter-Controls werden aus Schema generiert.
- **Dependencies:** ["slice-08", "slice-06", "slice-05"]
- **Discovery-Quelle:** Slice 2 "Bild-Generation Pipeline"

---

### Slice 10: Generation Placeholder + Polling

- **Scope:** generation-placeholder Component (Skeleton waehrend Generation, Error-State bei Fehler), Status-Polling oder Revalidation um pending-Generierungen zu tracken und UI zu aktualisieren wenn completed/failed.
- **Deliverables:**
  - `components/workspace/generation-placeholder.tsx`
- **Done-Signal:** Placeholder erscheint sofort nach Generate-Klick, wird durch fertiges Bild ersetzt wenn Generation completed, zeigt Error-State bei failed
- **Dependencies:** ["slice-09"]
- **Discovery-Quelle:** Slice 2 "Bild-Generation Pipeline"

---

### Slice 11: Gallery Grid + Generation Cards

- **Scope:** Masonry Grid Layout fuer die Galerie (CSS columns), generation-card Component (Thumbnail, Hover-State), Sortierung neueste oben, Empty State.
- **Deliverables:**
  - `components/workspace/gallery-grid.tsx`
  - `components/workspace/generation-card.tsx`
- **Done-Signal:** Galerie zeigt alle completed Generierungen im Masonry-Layout, neueste oben. Klick auf Card oeffnet Lightbox (Event wird nach oben propagiert).
- **Dependencies:** ["slice-08"]
- **Discovery-Quelle:** Slice 3 "Galerie & Lightbox"

---

### Slice 12: Lightbox Modal

- **Scope:** lightbox-modal Component: grosses Bild zentriert, Detail-Panel (Prompt, Negativ-Prompt, Modell, Parameter, Bildabmessungen, Erstelldatum). Overlay mit Schliessen via X-Button oder Klick auf Hintergrund.
- **Deliverables:**
  - `components/lightbox/lightbox-modal.tsx`
- **Done-Signal:** Klick auf Galerie-Bild oeffnet Modal mit grossem Bild und allen Details. Schliessen funktioniert via X und Overlay-Klick.
- **Dependencies:** ["slice-11"]
- **Discovery-Quelle:** Slice 3 "Galerie & Lightbox"

---

### Slice 13: Lightbox Navigation + Actions

- **Scope:** Prev/Next Navigation (Chevron-Buttons + Pfeiltasten + Wrap-Around), delete-generation-btn mit Bestaetigung (loescht aus DB + R2), Server Action deleteGeneration.
- **Deliverables:**
  - `components/lightbox/lightbox-navigation.tsx`
- **Done-Signal:** Pfeiltasten und Buttons navigieren durch Bilder mit Wrap-Around. Loeschen entfernt Bild aus DB und R2 nach Bestaetigung.
- **Dependencies:** ["slice-12"]
- **Discovery-Quelle:** Slice 3 "Galerie & Lightbox"

---

### Slice 14: Variation Flow

- **Scope:** variation-btn in Lightbox: Uebernimmt Prompt, Modell und Parameter in die Eingabefelder. Lightbox schliesst sich. User kann anpassen und mit variant-count 1-4 erneut generieren.
- **Deliverables:**
  - (Integration in bestehende Components: `components/lightbox/lightbox-modal.tsx` und `components/workspace/prompt-area.tsx` via shared State/Context)
  - `lib/utils.ts` (Shared state/types fuer Variation-Uebernahme)
- **Done-Signal:** Klick auf "Variation" in Lightbox fuellt Prompt-Feld, waehlt Modell, setzt Parameter. Lightbox schliesst. User kann Batch 1-4 waehlen und generieren.
- **Dependencies:** ["slice-13", "slice-09"]
- **Discovery-Quelle:** Slice 6 "Variationen & Batch"

---

### Slice 15: Download als PNG

- **Scope:** download-btn in Lightbox: Laedt Bild als PNG herunter (Client-seitiger Download via fetch + Blob + anchor-click).
- **Deliverables:**
  - (Integration in `components/lightbox/lightbox-modal.tsx`)
  - `lib/utils.ts` (Download-Helper-Funktion)
- **Done-Signal:** Klick auf "Download PNG" startet Browser-Download der PNG-Datei mit sinnvollem Dateinamen
- **Dependencies:** ["slice-12"]
- **Discovery-Quelle:** Slice 3 "Galerie & Lightbox"

---

### Slice 16: Generation Delete + Retry

- **Scope:** retry-btn auf failed generation-placeholder (re-triggert Generation mit gleichen Parametern). Error-Toast-Notifications fuer alle Fehlerszenarien (Replicate, R2, Rate Limit). Toast-Provider Setup.
- **Deliverables:**
  - `components/shared/toast-provider.tsx`
- **Done-Signal:** Retry auf fehlgeschlagener Generation startet neuen API-Call. Toast-Notifications erscheinen bei allen definierten Fehlerszenarien.
- **Dependencies:** ["slice-10", "slice-08"]
- **Discovery-Quelle:** Slice 3 "Galerie & Lightbox"

---

### Slice 17: Prompt Builder Drawer + Style/Colors

- **Scope:** builder-drawer Component (Drawer von rechts), category-tab (Style, Colors Tabs), option-chip Grid (3x3 Text-Labels pro Kategorie, Toggle-Auswahl), Prompt Concatenation (kommasepariert), Live-Preview des aktuellen Prompts, Done-Button.
- **Deliverables:**
  - `components/prompt-builder/builder-drawer.tsx`
  - `components/prompt-builder/category-tabs.tsx`
  - `components/prompt-builder/option-chip.tsx`
- **Done-Signal:** Drawer oeffnet sich, Tabs wechseln zwischen Style und Colors, Klick auf Chip toggelt Auswahl und aktualisiert Prompt. Done schliesst Drawer, Prompt ist im Eingabefeld.
- **Dependencies:** ["slice-09"]
- **Discovery-Quelle:** Slice 4 "Prompt Builder"

---

### Slice 18: Surprise Me

- **Scope:** surprise-me-btn im Prompt Builder: Wuerfelt zufaellige Kombination aus allen Kategorien. Bestaetigung wenn bereits Optionen ausgewaehlt sind ("Aktuelle Auswahl ersetzen?").
- **Deliverables:**
  - `components/prompt-builder/surprise-me-button.tsx`
- **Done-Signal:** Button wuerfelt zufaellige Style + Color Kombination. Bei bestehender Auswahl erscheint Bestaetigung. Prompt wird aktualisiert.
- **Dependencies:** ["slice-17"]
- **Discovery-Quelle:** Slice 4 "Prompt Builder"

---

### Slice 19: Snippet CRUD -- DB + Service + Actions

- **Scope:** SnippetService (CRUD-Operationen fuer prompt_snippets), Server Actions createSnippet, updateSnippet, deleteSnippet, getSnippets. Validierung (text non-empty max 500, category non-empty max 100).
- **Deliverables:**
  - `lib/services/snippet-service.ts`
  - `app/actions/prompts.ts`
- **Done-Signal:** Alle CRUD-Actions funktionieren korrekt. getSnippets liefert Snippets gruppiert nach Kategorie. Validierung lehnt leere/zu lange Eingaben ab.
- **Dependencies:** ["slice-02"]
- **Discovery-Quelle:** Slice 7 "Eigene Prompt-Bausteine"

---

### Slice 20: Snippet UI im Builder

- **Scope:** "Meine Bausteine" Tab im Prompt Builder: snippet-form (Inline-Formular fuer neuen Baustein mit Text + Kategorie-Dropdown), snippet-chip (User-Snippets gruppiert nach Kategorie, Toggle-Auswahl, Hover zeigt Edit/Delete), new-snippet-btn, Edit/Delete Flow.
- **Deliverables:**
  - `components/prompt-builder/snippet-form.tsx`
  - (Integration: `components/prompt-builder/category-tabs.tsx` erweitern um "Meine Bausteine" Tab)
- **Done-Signal:** Neuer Baustein erstellen, im Tab sichtbar, Klick fuegt zum Prompt hinzu, Edit oeffnet Form vorbefuellt, Delete mit Inline-Bestaetigung entfernt Baustein.
- **Dependencies:** ["slice-19", "slice-17"]
- **Discovery-Quelle:** Slice 7 "Eigene Prompt-Bausteine"

---

### Slice 21: LLM Prompt Improvement

- **Scope:** OpenRouter Client (plain fetch), PromptService.improve (System-Prompt + User-Prompt an OpenRouter senden), Server Action improvePrompt, llm-comparison Panel (Original vs. Improved nebeneinander), adopt-btn und discard-btn, Loading- und Error-States.
- **Deliverables:**
  - `lib/clients/openrouter.ts`
  - `lib/services/prompt-service.ts`
  - `components/prompt-improve/llm-comparison.tsx`
- **Done-Signal:** Klick auf "Prompt verbessern" zeigt Loading, dann Original und verbesserter Prompt nebeneinander. "Uebernehmen" ersetzt Prompt im Eingabefeld. "Verwerfen" schliesst Panel. Bei Fehler: Toast + Panel schliesst automatisch.
- **Dependencies:** ["slice-09"]
- **Discovery-Quelle:** Slice 5 "LLM Prompt-Verbesserung"

---

## Discovery-Coverage Check

| Discovery Slice | Atomare Slices | Abgedeckt |
|-----------------|---------------|-----------|
| 1: Infrastruktur & Projekt-CRUD | 01, 02, 03, 04, 05 | Ja |
| 2: Bild-Generation Pipeline | 06, 07, 08, 09, 10 | Ja |
| 3: Galerie & Lightbox | 11, 12, 13, 15, 16 | Ja |
| 4: Prompt Builder | 17, 18 | Ja |
| 5: LLM Prompt-Verbesserung | 21 | Ja |
| 6: Variationen & Batch | 14 | Ja |
| 7: Eigene Prompt-Bausteine | 19, 20 | Ja |

## Qualitaets-Checkliste

- [x] Jeder Slice hat maximal 3 produktive Deliverable-Dateien
- [x] Jeder Slice hat ein messbares Done-Signal
- [x] Dependencies sind azyklisch (DAG)
- [x] Alle Deliverables aus der Discovery sind abgedeckt (nichts vergessen)
- [x] Kein Slice hat mehr als ein Concern (DB+UI = zu viel)
- [x] Schema/Service-Slices kommen vor UI-Slices
- [x] Stack ist korrekt erkannt und dokumentiert
