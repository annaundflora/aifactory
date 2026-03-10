# Slice 08: Model Browser Drawer

> **Slice 08 von 14** fuer `Model Cards & Multi-Model Selection`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-08-model-browser-drawer` |
| **Test** | `pnpm test components/models/__tests__/model-browser-drawer.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-06-model-card-component", "slice-07-model-search-filter-hook"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/models/__tests__/model-browser-drawer.test.tsx` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

`ModelBrowserDrawer`-Komponente erstellen, die als shadcn `Sheet` (side="right") den gesamten Model-Auswahlprozess kapselt: Suche, Owner-Filter, 2-Spalten-Card-Grid und Confirm-Button. Die Komponente verwaltet eine temporaere Selektion (`tempSelectedModels`), die erst bei "Confirm" an den Parent uebergeben wird; beim Schliessen ohne Confirm werden alle Aenderungen verworfen.

---

## Acceptance Criteria

1) GIVEN `open={true}` und `models` mit 4 `CollectionModel`-Eintraegen
   WHEN `ModelBrowserDrawer` gerendert wird
   THEN ist das Sheet sichtbar (aria-expanded oder data-state="open")
   AND genau 4 `ModelCard`-Komponenten werden im Grid gerendert
   AND ein `<input>`-Suchfeld mit placeholder "Search models..." ist sichtbar

2) GIVEN Drawer ist geoeffnet mit 4 Modellen
   WHEN der Nutzer `"flux"` in das Suchfeld eingibt
   THEN werden nur die `ModelCard`-Instanzen gerendert, deren `name` oder `description` den String `"flux"` enthaelt (case-insensitive)
   AND Modelle ohne Match sind nicht im DOM

3) GIVEN Drawer ist geoeffnet mit Modellen von Ownern `"black-forest-labs"` und `"stability-ai"`
   WHEN der Nutzer den Filter-Chip `"stability-ai"` klickt
   THEN werden nur `ModelCard`-Instanzen mit `owner === "stability-ai"` angezeigt
   AND der `"stability-ai"`-Chip ist visuell aktiv markiert

4) GIVEN Drawer ist geoeffnet und kein Model ist selektiert
   WHEN der Nutzer eine `ModelCard` klickt
   THEN ist `tempSelectedModels` intern auf dieses Model gesetzt
   AND die angeklickte `ModelCard` erhaelt `selected={true}`
   AND der Confirm-Button zeigt den Text `"Confirm (1 Model)"` und ist nicht disabled

5) GIVEN `tempSelectedModels` hat bereits 3 Eintraege
   WHEN der Nutzer eine weitere (nicht selektierte) `ModelCard` klickt
   THEN bleibt `tempSelectedModels` unveraendert (kein vierter Eintrag)
   AND ein Inline-Hinweis `"Select up to 3 models"` ist sichtbar
   AND die nicht selektierte `ModelCard` hat `disabled={true}`

6) GIVEN `tempSelectedModels` hat 2 Eintraege
   WHEN der Nutzer eine bereits selektierte `ModelCard` klickt
   THEN wird dieses Model aus `tempSelectedModels` entfernt
   AND die `ModelCard` erhaelt `selected={false}`
   AND der Confirm-Button zeigt `"Confirm (1 Model)"`

7) GIVEN Drawer ist geoeffnet mit `selectedModels` vom Parent (1 vorselektiertes Model)
   WHEN der Nutzer ein zweites Model in `tempSelectedModels` hinzufuegt
   AND dann den Close-Button (X) klickt
   THEN wird `onConfirm` NICHT aufgerufen
   AND `onClose` wird aufgerufen
   AND die Aenderung an `tempSelectedModels` ist verworfen (tempState = parent-State)

8) GIVEN `tempSelectedModels` hat 2 Eintraege
   WHEN der Nutzer den Confirm-Button klickt
   THEN wird `onConfirm(tempSelectedModels)` mit genau 2 `CollectionModel`-Eintraegen aufgerufen
   AND `onClose` wird aufgerufen (Drawer schliesst)

9) GIVEN `models` ist ein leeres Array (`[]`)
   WHEN `ModelBrowserDrawer` gerendert wird
   THEN wird kein `ModelCard` gerendert
   AND eine Empty-State-Message `"No models available."` ist im DOM sichtbar

10) GIVEN `isLoading={true}`
    WHEN `ModelBrowserDrawer` gerendert wird
    THEN ist ein Lade-Indikator (Spinner oder Skeleton) sichtbar
    AND keine `ModelCard`-Instanzen werden gerendert

11) GIVEN `error="Could not load models. Please try again."` und `isLoading={false}`
    WHEN `ModelBrowserDrawer` gerendert wird
    THEN wird die Fehlermeldung `"Could not load models. Please try again."` angezeigt
    AND ein Retry-Button ist sichtbar
    AND ein Klick auf Retry ruft `onRetry()` auf

12) GIVEN `tempSelectedModels` ist leer (0 Modelle selektiert)
    WHEN der Confirm-Button gerendert wird
    THEN ist der Confirm-Button disabled
    AND zeigt den Text `"Select at least 1 model"`

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/models/__tests__/model-browser-drawer.test.tsx`

<test_spec>
```typescript
// AC-1: Drawer oeffnet und rendert alle Cards sowie Suchfeld
it.todo('should render all model cards and search input when open')

// AC-2: Suche filtert Cards nach Name/Description
it.todo('should filter model cards by search query')

// AC-3: Owner-Filter-Chip filtert Cards nach Owner
it.todo('should filter model cards by owner when filter chip is clicked')

// AC-4: Klick auf Card setzt tempSelectedModels und aktiviert Confirm-Button
it.todo('should select a card and enable confirm button with correct label')

// AC-5: Max-3-Enforcement — vierte Card blockiert, Inline-Hint erscheint
it.todo('should prevent selecting more than 3 models and show inline hint')

// AC-6: Klick auf selektierte Card deselektiert sie
it.todo('should deselect a card when clicked while already selected')

// AC-7: Close ohne Confirm verwirft tempState und ruft onClose auf
it.todo('should discard temp selection on close without confirm')

// AC-8: Confirm uebergibt tempSelectedModels an onConfirm und ruft onClose auf
it.todo('should call onConfirm with selected models and onClose on confirm click')

// AC-9: Empty-State wenn models-Array leer ist
it.todo('should show empty state message when models array is empty')

// AC-10: Loading-State zeigt Spinner, keine Cards
it.todo('should show loading indicator and no cards when isLoading is true')

// AC-11: Error-State zeigt Fehlermeldung und Retry-Button
it.todo('should show error message and retry button when error prop is set')

// AC-12: Confirm-Button disabled und mit Hinweistext wenn 0 Modelle selektiert
it.todo('should show disabled confirm button with guidance text when no model is selected')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-06-model-card-component` | `ModelCard` | React Component | Import `ModelCard` aus `components/models/model-card.tsx` muss fehlerfrei sein |
| `slice-06-model-card-component` | `ModelCardProps` | TypeScript Interface | Props-Typen muessen kompatibel sein |
| `slice-07-model-search-filter-hook` | `useModelFilters` | Custom Hook | Import aus `lib/hooks/use-model-filters.ts`; Signatur: `(models, searchQuery, ownerFilter) => { filteredModels, owners }` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ModelBrowserDrawer` | React Component | `slice-10` (Prompt Area Trigger) | `ModelBrowserDrawer: React.FC<ModelBrowserDrawerProps>` |
| `ModelBrowserDrawerProps` | TypeScript Interface | `slice-10` | `{ open: boolean; models: CollectionModel[]; selectedModels: CollectionModel[]; isLoading: boolean; error?: string; onConfirm: (models: CollectionModel[]) => void; onClose: () => void; onRetry: () => void }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/models/model-browser-drawer.tsx` — ModelBrowserDrawer-Komponente: Sheet (side="right"), Header mit Titel + Close, Search-Input, Owner-Filter-Chips, 2-Spalten-Card-Grid, sticky Footer mit Confirm-Button, Loading/Error/Empty-States, tempState-Verwaltung
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Integration in `prompt-area.tsx` (kommt in Slice 10)
- KEIN eigener Daten-Fetch — `models`, `isLoading` und `error` werden als Props entgegen genommen
- KEIN Run-Count-Formatter in dieser Komponente — `run_count` wird unveraendert an `ModelCard` weitergegeben
- KEINE Sortier-Logik (Reihenfolge aus `models`-Array bleibt unveraendert)

**Technische Constraints:**
- Sheet-Basis: shadcn `Sheet` mit `side="right"` (bereits im Projekt installiert)
- tempState: `useState<CollectionModel[]>` lokal in der Drawer-Komponente; bei `open`-Wechsel von `false` → `true` mit `selectedModels`-Prop initialisieren
- Filter-Chips: Owner-Liste aus `useModelFilters` → horizontal scrollbare Chip-Reihe; `"All"` als erster Chip (deaktiviert ownerFilter); Single-Select (maximal 1 Owner aktiv)
- Grid: 2 Spalten via Tailwind `grid-cols-2 gap-4`
- Confirm-Button: sticky Footer via `position: sticky; bottom: 0` oder Tailwind `sticky bottom-0`
- Confirm-Button-Text: `"Confirm (N Models)"` wenn N >= 1, `"Select at least 1 model"` + disabled wenn N === 0
- Max-3-Hint: wird sichtbar wenn `tempSelectedModels.length === 3`; nicht selektierte Cards erhalten `disabled={true}` via `ModelCard`-Prop

**Referenzen:**
- Discovery: `specs/phase-2/2026-03-07-model-cards/discovery.md` → Section "Screen: Model Browser Drawer" (Layout, Header, Search, Filter, Grid, Footer)
- Discovery: `specs/phase-2/2026-03-07-model-cards/discovery.md` → Section "Feature State Machine" (Transitions: browsing, browsing-loading, browsing-error)
- Discovery: `specs/phase-2/2026-03-07-model-cards/discovery.md` → Section "Business Rules" (Max 3, Discard on Close, AND-Filter-Logik)
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` → Section "Constraints" (tempState-Discard-Verhalten, Min-1 nicht in diesem Slice)
