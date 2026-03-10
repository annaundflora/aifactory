# Slice 10: FloatingActionBar Bulk Actions Integration

> **Slice 10** fuer `Generation UI Improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-10-floating-action-bar-integration` |
| **Test** | `pnpm test components/workspace/__tests__/workspace-content` |
| **E2E** | `false` |
| **Dependencies** | `["slice-05-bulk-db-actions", "slice-08-gallery-grid-selection", "slice-09-floating-action-bar", "slice-11-zip-download-route", "slice-12-compare-modal"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/__tests__/workspace-content` |
| **Integration Command** | `pnpm test components/workspace/__tests__/workspace-content --reporter=verbose` |
| **Acceptance Command** | `pnpm test components/workspace/__tests__/workspace-content` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` — Server Actions via `vi.mock`, `fetch` via `vi.mock`, `sonner` via `vi.mock` |

---

## Ziel

`workspace-content.tsx` wird mit `SelectionProvider` gewrappt und mit `FloatingActionBar`, `GalleryHeader` und einem `ConfirmDialog` verbunden. Die Komponente verdrahtet alle Bulk-Action-Callbacks mit echten Server Actions (`deleteGenerations`, `moveGenerations`, `toggleFavorites`) sowie dem ZIP-Download via `fetch`. Nach jeder Aktion wird eine Erfolgsmeldung via sonner angezeigt und die Selektion aufgehoben.

---

## Acceptance Criteria

1) GIVEN die Komponente ist gemountet und `selectedIds` enthaelt 0 IDs im SelectionContext
   WHEN das DOM ausgewertet wird
   THEN ist die `FloatingActionBar` nicht im DOM (nicht gerendert)

2) GIVEN 2 Generierungen sind selektiert (`selectedIds.size === 2`)
   WHEN das DOM ausgewertet wird
   THEN ist die `FloatingActionBar` im DOM und zeigt den Text "2 ausgewaehlt"

3) GIVEN 3 Generierungen sind selektiert und der Delete-Button wird geklickt
   WHEN der Klick ausgefuehrt wird
   THEN ist ein ConfirmDialog sichtbar mit dem Text "3 Bilder werden dauerhaft geloescht" (oder aequivalent mit N=3) und zwei Buttons: "Abbrechen" und "Loeschen"

4) GIVEN der ConfirmDialog fuer Bulk-Delete ist offen
   WHEN der "Abbrechen"-Button geklickt wird
   THEN schliesst der Dialog, `deleteGenerations` wird NICHT aufgerufen, die Selektion bleibt unveraendert

5) GIVEN der ConfirmDialog fuer Bulk-Delete ist offen (3 IDs selektiert)
   WHEN der "Loeschen"-Button geklickt wird
   THEN wird `deleteGenerations({ ids: [id1, id2, id3] })` aufgerufen, nach Erfolg erscheint ein Toast ("3 Bilder geloescht" o.ae.), und `deselectAll()` wird aufgerufen

6) GIVEN der ConfirmDialog fuer Bulk-Delete ist offen und `deleteGenerations` gibt `{ error: "Datenbankfehler" }` zurueck
   WHEN der "Loeschen"-Button geklickt wird
   THEN erscheint ein Error-Toast mit dem Fehlertext, `deselectAll()` wird NICHT aufgerufen

7) GIVEN 2 Generierungen sind selektiert und der Move-Dropdown zeigt Projekt "Alpha" (id: `proj-alpha`)
   WHEN "Alpha" im Dropdown ausgewaehlt wird
   THEN oeffnet sich ein ConfirmDialog mit dem Text "2 Bilder nach 'Alpha' verschieben?" und den Buttons "Abbrechen" und "Verschieben"

8) GIVEN der ConfirmDialog fuer Bulk-Move ist offen (Ziel: "Alpha", 2 IDs)
   WHEN der "Verschieben"-Button geklickt wird
   THEN wird `moveGenerations({ ids: [id1, id2], targetProjectId: "proj-alpha" })` aufgerufen, nach Erfolg erscheint ein Toast ("2 Bilder verschoben" o.ae.), und `deselectAll()` wird aufgerufen

9) GIVEN 3 Generierungen sind selektiert und der Favorite-Button wird geklickt
   WHEN der Klick ausgefuehrt wird
   THEN wird `toggleFavorites({ ids: [id1, id2, id3], favorite: true })` aufgerufen und nach Erfolg erscheint ein Toast

10) GIVEN 2 Generierungen sind selektiert und der Download-Button wird geklickt
    WHEN der Klick ausgefuehrt wird
    THEN wird `fetch("/api/download-zip?ids=id1,id2")` aufgerufen, die Response als Blob heruntergeladen, und ein `<a>`-Tag mit `download`-Attribut ausgeloest

11) GIVEN `favFilterActive === false` im lokalen State
    WHEN der Favoriten-Filter-Toggle in `GalleryHeader` geklickt wird
    THEN wechselt `favFilterActive` auf `true` und die Gallery zeigt nur Generierungen mit `isFavorite === true`

12) GIVEN `favFilterActive === true` und 0 Favoriten vorhanden
    WHEN das DOM ausgewertet wird
    THEN zeigt die Gallery eine Leer-State-Meldung (z.B. "Keine Favoriten") statt der leeren Grid

13) GIVEN 2–4 Generierungen sind selektiert und der Compare-Button in FloatingActionBar wird geklickt
    WHEN `onCompare` aufgerufen wird
    THEN wird `isCompareOpen` auf `true` gesetzt, `compareGenerations` enthaelt die selektierten Generation-Objekte (gefiltert aus `initialGenerations` nach `selectedIds`), und `<CompareModal isOpen={true} generations={compareGenerations} />` wird gemountet

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.
> Server Actions (`deleteGenerations`, `moveGenerations`, `toggleFavorites`), `fetch` und `sonner` werden via `vi.mock` gemockt.

### Test-Datei: `components/workspace/__tests__/workspace-content.test.tsx`

<test_spec>
```typescript
// AC-1: FloatingActionBar nicht im DOM wenn keine Selektion
it.todo('should not render FloatingActionBar when no items are selected')

// AC-2: FloatingActionBar sichtbar mit korrektem Count-Text bei 2 Selektionen
it.todo('should render FloatingActionBar with "2 ausgewaehlt" when 2 items are selected')

// AC-3: Bulk-Delete-Klick oeffnet ConfirmDialog mit Bild-Anzahl
it.todo('should open ConfirmDialog with count when Delete button is clicked')

// AC-4: Abbrechen im ConfirmDialog verhindert deleteGenerations-Aufruf
it.todo('should not call deleteGenerations when cancel is clicked in confirm dialog')

// AC-5: Bestaetigung ruft deleteGenerations auf und zeigt Success-Toast, Selektion wird aufgehoben
it.todo('should call deleteGenerations, show success toast, and clear selection on confirm')

// AC-6: Error-Toast bei deleteGenerations-Fehler, Selektion bleibt
it.todo('should show error toast and keep selection when deleteGenerations returns error')

// AC-7: Bulk-Move-Klick oeffnet ConfirmDialog mit Projektname
it.todo('should open ConfirmDialog with project name when a project is selected in Move dropdown')

// AC-8: Bestaetigung ruft moveGenerations auf und zeigt Success-Toast, Selektion wird aufgehoben
it.todo('should call moveGenerations with correct ids and targetProjectId, show toast, clear selection')

// AC-9: Favorite-Button ruft toggleFavorites auf und zeigt Toast
it.todo('should call toggleFavorites and show success toast when Favorite button is clicked')

// AC-10: Download-Button loest ZIP-Fetch aus
it.todo('should call fetch with correct download-zip URL when Download button is clicked')

// AC-11: Favoriten-Filter-Toggle filtert Gallery auf isFavorite === true
it.todo('should filter gallery to show only favorited generations when fav filter is toggled on')

// AC-12: Leer-State wenn Favoriten-Filter aktiv und keine Favoriten vorhanden
it.todo('should show empty state message when fav filter is active and no favorites exist')

// AC-13: Compare-Button oeffnet CompareModal mit selektierten Generations
it.todo('should open CompareModal with selected generations when Compare button is clicked')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-05-bulk-db-actions` | `deleteGenerations`, `moveGenerations`, `toggleFavorites` | Server Actions | Signaturen gemaess slice-05 Integration Contract |
| `slice-08-gallery-grid-selection` | `GalleryHeader` | React Component | `GalleryHeader({ title, imageCount, favFilterActive, onFavFilterToggle })` |
| `slice-08-gallery-grid-selection` | `GalleryGrid` (modifiziert) | React Component | liest `isSelecting` aus Context, unveraenderte Props-Signatur |
| `slice-09-floating-action-bar` | `FloatingActionBar` | React Component | Vollstaendige Props-Signatur gemaess slice-09 Integration Contract |
| `slice-11-zip-download-route` | `GET /api/download-zip` | Route Handler | `?ids=uuid1,uuid2` → `application/zip` |
| `slice-12-compare-modal` | `CompareModal` | React Component | `CompareModal({ isOpen, onClose, generations })` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `WorkspaceContent` (modifiziert) | React Component | `app/workspace/[projectId]/page.tsx` | Props-Signatur unveraendert: `{ projectId: string, initialGenerations: Generation[] }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/workspace-content.tsx` — Modifiziert: SelectionProvider-Wrapper, GalleryHeader-Integration, FloatingActionBar-Einbindung mit Bulk-Action-Callbacks (deleteGenerations, moveGenerations, toggleFavorites, ZIP-fetch), ConfirmDialog fuer Delete und Move, Success/Error-Toasts via sonner, Favoriten-Filter-State, CompareModal-Import + `isCompareOpen`-State + `compareGenerations`-State + `onCompare`-Handler (filtert selectedIds aus initialGenerations) + `<CompareModal>`-Mount in JSX
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Kein Lightbox-Move in diesem Slice (separater Slice)
- Keine neuen Routing-Aenderungen — `revalidatePath` wird von den Server Actions ausgefuehrt
- Kein Undo nach Bulk-Delete — nur ConfirmDialog (architecture.md → Scope Out of Scope)

**Technische Constraints:**
- `SelectionProvider` aus `lib/selection-state.tsx` wrappt die gesamte Workspace-Struktur (architecture.md → Component Architecture)
- ConfirmDialog: radix-ui `Dialog` (bereits genutzt im Codebase) — kein separates Package
- Toast-Pattern: `toast.success(...)` und `toast.error(...)` via sonner (konsistent mit bestehendem Pattern in workspace-content.tsx)
- ZIP-Download: `fetch` + `URL.createObjectURL` + temporaerer `<a>`-Tag (kein Redirect, kein neues Tab)
- Favoriten-Filter-State ist lokaler `useState` in `workspace-content.tsx` (nicht im SelectionContext)
- `deselectAll()` wird nach jeder erfolgreichen Bulk-Action aufgerufen (nicht bei Fehler)
- `toggleFavorites` wird immer mit `favorite: true` aufgerufen (kein Toggle-State in diesem Slice — Slice-Scope begrenzt auf "markiere als Favorit")

**Referenzen:**
- Architecture: `architecture.md` → Component Architecture (Component Tree, Bulk Operations Flow)
- Architecture: `architecture.md` → Error Handling Strategy
- Architecture: `architecture.md` → Migration Map → `workspace-content.tsx` (Existing Files Modified)
- Wireframes: `wireframes.md` → Screen "Gallery with Bulk Select" — State Variations `bulk-delete-confirm`, `bulk-move-confirm`
