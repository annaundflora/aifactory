# Slim Slice Decomposition

**Feature:** Model Cards & Multi-Model Selection
**Discovery-Slices:** 6 grobe Slices
**Atomare Slices:** 14 nach Decomposition
**Stack:** TypeScript / Next.js 16.1.6 / React 19.2.3 / shadcn/ui / Tailwind CSS 4 / Vitest

---

## Dependency Graph

```
slice-01 (shadcn Badge Setup)
    |
    v
slice-02 (CollectionModel Types + Service)
    |
    +---> slice-03 (Server Action getCollectionModels + Remove Static Models)
    |         |
    |         +---> slice-06 (Model Card Component)
    |         |         |
    |         |         +---> slice-08 (Model Browser Drawer)
    |         |                   |
    |         |                   +---> slice-10 (Model Trigger + Prompt Area Integration)
    |         |                               |
    |         |                               +---> slice-12 (Parallel Multi-Model Generation)
    |         |                                         |
    |         |                                         +---> slice-13 (Gallery Model Badge)
    |         |                                                     |
    |         |                                                     +---> slice-14 (Cleanup + Smoke Test)
    |         |
    |         +---> slice-04 (Remove Static Model Whitelist from Schema Service)
    |         |
    |         +---> slice-05 (Remove Static Model Whitelist from Lightbox + Prompt Service)
    |
    +---> slice-07 (Model Search + Filter Logic)
    |
    +---> slice-09 (Run Count Formatter Utility)

slice-11 (Parameter Panel Multi-Model Notice)  <-- abhaengig von slice-10
```

Vereinfacht:

```
01 ──> 02 ──> 03 ──┬──> 04
                    ├──> 05
                    ├──> 06 ──> 08 ──> 10 ──┬──> 11
                    |                        └──> 12 ──> 13 ──> 14
       02 ──> 07
       02 ──> 09
```

---

## Slice-Liste

### Slice 01: shadcn Badge installieren

- **Scope:** shadcn/ui Badge-Komponente zum Projekt hinzufuegen. Wird fuer Model Badge (Gallery) und Run Count (Model Card) benoetigt.
- **Deliverables:**
  - `components/ui/badge.tsx` (generiert via `pnpm dlx shadcn@3 add badge`)
- **Done-Signal:** Datei `components/ui/badge.tsx` existiert und exportiert `Badge` und `badgeVariants`. Projekt kompiliert fehlerfrei.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 2 "Model Card Component" + Slice 6 "Gallery Model Badge" (Badge wird in beiden benoetigt)

---

### Slice 02: CollectionModel Type + Service

- **Scope:** Neuen `CollectionModelService` erstellen, der die Replicate Collections API (`/v1/collections/text-to-image`) aufruft und die Antwort in-memory cached (1h TTL). Definiert das `CollectionModel`-Interface als zentralen Datentyp fuer alle nachfolgenden Slices.
- **Deliverables:**
  - `lib/types/collection-model.ts` (Interface `CollectionModel`)
  - `lib/services/collection-model-service.ts` (Service mit Cache + Fetch + Timeout)
  - `lib/services/__tests__/collection-model-service.test.ts` (Unit Tests)
- **Done-Signal:** Unit Tests passen: Cache-Hit, Cache-Miss, Cache-Expiry, API-Error, Fetch-Timeout (5s). Service exportiert `getCollectionModels()` und `clearCache()`.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 1 "Collections API Service + Cache"

---

### Slice 03: Server Action getCollectionModels + Static Models entfernen

- **Scope:** Server Action `getCollectionModels()` in `app/actions/models.ts` erstellen, die den `CollectionModelService` aufruft. Statische `MODELS`-Datei (`lib/models.ts`) und zugehoerigen Test (`lib/__tests__/models.test.ts`) loeschen.
- **Deliverables:**
  - `app/actions/models.ts` (erweitern: `getCollectionModels` Action hinzufuegen, `getModelById`-Import entfernen)
  - `lib/models.ts` (LOESCHEN)
  - `lib/__tests__/models.test.ts` (LOESCHEN)
- **Done-Signal:** `getCollectionModels()` Server Action gibt `CollectionModel[]` oder `{ error: string }` zurueck. Keine Referenz auf `lib/models.ts` mehr im Projekt. Build kompiliert.
- **Dependencies:** ["slice-02"]
- **Discovery-Quelle:** Slice 1 "Collections API Service + Cache"

---

### Slice 04: Static Model Whitelist aus Schema-Service + Generation-Service entfernen

- **Scope:** `getModelById()`-Whitelist-Check aus `model-schema-service.ts` und `generation-service.ts` entfernen. Stattdessen Model-ID-Format per Regex validieren (`^[a-z0-9-]+/[a-z0-9._-]+$`). Fetch-Timeout (5s) zum Schema-Service hinzufuegen.
- **Deliverables:**
  - `lib/services/model-schema-service.ts` (Whitelist entfernen, Regex-Validierung, AbortController Timeout)
  - `lib/services/generation-service.ts` (`getModelById`-Import + Check entfernen)
  - `lib/services/__tests__/model-schema-service.test.ts` (Tests anpassen/erweitern)
- **Done-Signal:** Kein Import von `lib/models` in `model-schema-service.ts` oder `generation-service.ts`. Schema-Fetch akzeptiert beliebige `owner/name`-IDs. Timeout-Test besteht.
- **Dependencies:** ["slice-03"]
- **Discovery-Quelle:** Slice 1 "Collections API Service + Cache" (Migration Map)

---

### Slice 05: Static Model Lookup aus Lightbox + Prompt-Service entfernen

- **Scope:** `getModelById()`-Referenzen aus `lightbox-modal.tsx` und `prompt-service.ts` entfernen. Display-Name stattdessen aus der Model-ID ableiten (Split auf `/`, Name-Teil, Bindestriche durch Leerzeichen ersetzen, Title-Case). Shared Helper-Funktion erstellen.
- **Deliverables:**
  - `lib/utils/model-display-name.ts` (Helper: `modelIdToDisplayName(modelId: string): string`)
  - `components/lightbox/lightbox-modal.tsx` (Import aendern: `getModelById` -> `modelIdToDisplayName`)
  - `lib/services/prompt-service.ts` (Import aendern: `getModelById` -> `modelIdToDisplayName`)
- **Done-Signal:** Kein Import von `lib/models` im gesamten Projekt. `modelIdToDisplayName("black-forest-labs/flux-1.1-pro")` gibt `"Flux 1.1 Pro"` zurueck. Bestehende Tests passen.
- **Dependencies:** ["slice-03"]
- **Discovery-Quelle:** Slice 1 "Collections API Service + Cache" (Migration Map)

---

### Slice 06: Model Card Component

- **Scope:** Praesentationale `ModelCard`-Komponente erstellen: Cover-Image (16:9, Fallback-Gradient), Name (bold, truncated), Owner (muted), Description (2 Zeilen, Tooltip fuer vollen Text), Run-Count-Badge, Checkbox-Overlay (Top-Right), Selected-State (Ring + Checkmark), Disabled-State (reduzierte Opacity).
- **Deliverables:**
  - `components/models/model-card.tsx`
  - `components/models/__tests__/model-card.test.tsx`
- **Done-Signal:** Unit Tests: Card rendert mit Mock-Daten, Cover-Fallback bei fehlender URL, Selected-State zeigt Ring/Checkmark, Disabled-State bei max-reached, Description-Truncation.
- **Dependencies:** ["slice-01", "slice-02"]
- **Discovery-Quelle:** Slice 2 "Model Card Component"

---

### Slice 07: Model Search + Filter Logic (Hook)

- **Scope:** Custom Hook `useModelFilters` erstellen: Client-seitige Suche (Name + Description, case-insensitive) und Owner-Filter (Single-Select Chips). AND-Logik fuer kombinierte Filter. Extrahiert unique Owner-Liste aus Model-Array.
- **Deliverables:**
  - `lib/hooks/use-model-filters.ts`
  - `lib/hooks/__tests__/use-model-filters.test.ts`
- **Done-Signal:** Unit Tests: Suche filtert nach Name/Description, Owner-Filter filtert nach Owner, Kombination funktioniert mit AND-Logik, Owner-Liste wird korrekt extrahiert.
- **Dependencies:** ["slice-02"]
- **Discovery-Quelle:** Slice 3 "Model Browser Drawer" (Search + Filter-Logik)

---

### Slice 08: Model Browser Drawer

- **Scope:** `ModelBrowserDrawer`-Komponente erstellen: Sheet (side="right"), Header mit Titel + Close, Search-Input, Filter-Chips (Owner), 2-Spalten-Card-Grid, Confirm-Button (sticky Footer). States: Loading, Loaded, Error (mit Retry), Empty. Tempstate-Selektion (Discard on Close, Commit on Confirm). Max-3-Enforcement mit Inline-Hint.
- **Deliverables:**
  - `components/models/model-browser-drawer.tsx`
  - `components/models/__tests__/model-browser-drawer.test.tsx`
- **Done-Signal:** Unit Tests: Drawer oeffnet/schliesst, Cards werden gerendert, Suche filtert, Owner-Filter filtert, Max 3 Selektion, Confirm gibt Selection zurueck, Close verwirft Aenderungen, Loading/Error/Empty States.
- **Dependencies:** ["slice-06", "slice-07"]
- **Discovery-Quelle:** Slice 3 "Model Browser Drawer"

---

### Slice 09: Run Count Formatter Utility

- **Scope:** Utility-Funktion `formatRunCount(count: number): string` erstellen, die Zahlen menschenlesbar formatiert (z.B. 2300000 -> "2.3M runs", 150000 -> "150K runs", 800 -> "800 runs").
- **Deliverables:**
  - `lib/utils/format-run-count.ts`
  - `lib/utils/__tests__/format-run-count.test.ts`
- **Done-Signal:** Unit Tests: 0 -> "0 runs", 999 -> "999 runs", 1500 -> "1.5K runs", 2300000 -> "2.3M runs", 1000000000 -> "1B runs".
- **Dependencies:** []
- **Discovery-Quelle:** Slice 2 "Model Card Component" (Run Count Badge)

---

### Slice 10: Model Trigger + Prompt Area Integration

- **Scope:** `ModelTrigger`-Komponente erstellen (Compact Trigger Card): Gestackte Mini-Cards (1-3) mit Thumbnail (32x32), Name, Owner, X-Button. "Browse Models"-Link. Min-1-Enforcement (X ausgeblendet bei letztem Model). In `prompt-area.tsx` den `<Select>`-Dropdown durch `ModelTrigger` + `ModelBrowserDrawer` ersetzen. State von `selectedModelId: string` auf `selectedModels: CollectionModel[]` aendern.
- **Deliverables:**
  - `components/models/model-trigger.tsx`
  - `components/workspace/prompt-area.tsx` (Refactoring: Select -> ModelTrigger + Drawer)
  - `components/models/__tests__/model-trigger.test.tsx`
- **Done-Signal:** Unit Tests: Trigger zeigt 1-3 Models, X entfernt Model (nicht das letzte), "Browse Models" oeffnet Drawer. Integration: Prompt Area rendert Trigger statt Select. Collection Models werden beim Mount geladen.
- **Dependencies:** ["slice-08"]
- **Discovery-Quelle:** Slice 4 "Multi-Select + Compact Trigger"

---

### Slice 11: Parameter Panel Multi-Model Notice

- **Scope:** Wenn mehr als 1 Model ausgewaehlt ist, wird der Parameter Panel und Variant-Count-Selector in der Prompt Area ausgeblendet. Stattdessen erscheint eine Info-Nachricht: "Default parameters will be used for multi-model generation."
- **Deliverables:**
  - `components/workspace/prompt-area.tsx` (Bedingte Anzeige: Panel vs. Notice)
- **Done-Signal:** Bei 1 Model: Parameter Panel + Variant Count sichtbar. Bei 2-3 Models: Panel/Count versteckt, Notice-Text sichtbar.
- **Dependencies:** ["slice-10"]
- **Discovery-Quelle:** Slice 4 "Multi-Select + Compact Trigger" (parameter-panel-notice)

---

### Slice 12: Parallel Multi-Model Generation

- **Scope:** `generateImages` Server Action und `GenerationService.generate()` erweitern: `modelId` -> `modelIds: string[]` (Array). Single-Model: wie bisher (count Records, sequentiell). Multi-Model (2-3): 1 Record pro Model mit Default-Params, parallel via `Promise.allSettled`. Input-DTO `GenerateImagesInput` anpassen. Validierung: `modelIds.length 1-3`, Format-Regex pro ID.
- **Deliverables:**
  - `app/actions/generations.ts` (Input-Typ aendern, modelIds-Validierung)
  - `lib/services/generation-service.ts` (Multi-Model-Branch, Promise.allSettled)
  - `lib/services/__tests__/generation-service.test.ts` (Unit Tests fuer multi-model)
- **Done-Signal:** Unit Tests: Single-Model erzeugt N Records (wie bisher). Multi-Model (2 IDs) erzeugt 2 Records parallel. Partial Failure: 1 fehlgeschlagen, 1 erfolgreich. Validierung: >3 Models wird abgelehnt.
- **Dependencies:** ["slice-10"]
- **Discovery-Quelle:** Slice 5 "Parallel Multi-Model Generation"

---

### Slice 13: Gallery Model Badge

- **Scope:** `ModelBadge`-Overlay auf allen Gallery-Thumbnails hinzufuegen. Badge zeigt Model-Display-Name (abgeleitet via `modelIdToDisplayName`). Positioniert: bottom-left, semi-transparent Hintergrund, Text-Overflow Ellipsis bei langen Namen.
- **Deliverables:**
  - `components/workspace/generation-card.tsx` (Model Badge hinzufuegen)
  - `components/workspace/__tests__/generation-card.test.tsx` (Test fuer Badge-Rendering)
- **Done-Signal:** Unit Test: Badge wird mit korrektem Model-Namen gerendert. Badge ist visuell sichtbar (bottom-left, semi-transparent). Langer Name wird truncated.
- **Dependencies:** ["slice-01", "slice-05"]
- **Discovery-Quelle:** Slice 6 "Gallery Model Badge"

---

### Slice 14: Cleanup + Integration Smoke Test

- **Scope:** Finale Bereinigung: Sicherstellen, dass kein Import von `lib/models` im Projekt existiert, alle TypeScript-Errors behoben sind, Build (`pnpm build`) erfolgreich laeuft. E2E-Smoke-Test: Workspace oeffnen -> Trigger zeigt Default-Model -> Browse Models -> Card sichtbar -> Confirm -> Generate.
- **Deliverables:**
  - `e2e/model-cards.spec.ts` (oder aehnlicher E2E-Testpfad -- Smoke Test)
- **Done-Signal:** `pnpm build` erfolgreich. Keine TypeScript-Fehler. Kein toter Import von `lib/models`. E2E-Smoke-Test besteht: Models laden, Drawer oeffnet, Selection funktioniert, Generation startet.
- **Dependencies:** ["slice-12", "slice-13"]
- **Discovery-Quelle:** Alle Slices (Integration)

---

## Qualitaets-Checkliste

- [x] Jeder Slice hat maximal 3 produktive Deliverable-Dateien
- [x] Jeder Slice hat ein messbares Done-Signal
- [x] Dependencies sind azyklisch (DAG)
- [x] Alle Deliverables aus der Discovery sind abgedeckt (nichts vergessen)
- [x] Kein Slice hat mehr als ein Concern (DB+UI = zu viel)
- [x] Schema/Service-Slices kommen vor UI-Slices
- [x] Stack ist korrekt erkannt und dokumentiert

## Coverage-Matrix (Discovery-Slice -> Atomare Slices)

| Discovery-Slice | Atomare Slices |
|-----------------|----------------|
| 1: Collections API Service + Cache | Slice 02, 03, 04, 05 |
| 2: Model Card Component | Slice 01, 06, 09 |
| 3: Model Browser Drawer | Slice 07, 08 |
| 4: Multi-Select + Compact Trigger | Slice 10, 11 |
| 5: Parallel Multi-Model Generation | Slice 12 |
| 6: Gallery Model Badge | Slice 13 |
| -- (Integration) | Slice 14 |
