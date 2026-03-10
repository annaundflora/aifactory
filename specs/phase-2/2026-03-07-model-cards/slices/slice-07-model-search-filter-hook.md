# Slice 07: Model Search + Filter Logic (Hook)

> **Slice 07 von 14** fuer `Model Cards & Multi-Model Selection`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-07-model-search-filter-hook` |
| **Test** | `pnpm test lib/hooks/__tests__/use-model-filters.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/hooks/__tests__/use-model-filters.test.ts` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Custom Hook `useModelFilters` erstellen, der ein `CollectionModel[]`-Array client-seitig nach Suchbegriff (Name + Description) und Owner filtert. Liefert ausserdem die eindeutige Owner-Liste fuer die Filter-Chips. Dieser Hook wird von `ModelBrowserDrawer` (Slice 08) genutzt.

---

## Acceptance Criteria

1) GIVEN ein Array von 3 `CollectionModel`-Objekten mit unterschiedlichen Namen
   WHEN `searchQuery` auf `"flux"` gesetzt wird (case-insensitive)
   THEN gibt `filteredModels` nur die Modelle zurueck, deren `name` oder `description` den String `"flux"` enthaelt (unabhaengig von Gross-/Kleinschreibung)

2) GIVEN ein Array von 3 `CollectionModel`-Objekten mit unterschiedlichen Namen
   WHEN `searchQuery` auf `"FLUX"` gesetzt wird
   THEN gibt `filteredModels` dieselben Ergebnisse wie bei Kleinschreibung `"flux"` zurueck (case-insensitive matching)

3) GIVEN ein Array von 3 `CollectionModel`-Objekten, von denen eines `description: null` hat
   WHEN `searchQuery` einem Begriff entspricht, der nur in der Description eines anderen Modells vorkommt
   THEN wird das Modell mit `description: null` nicht in `filteredModels` aufgenommen
   AND es wird kein Fehler geworfen (null-safe)

4) GIVEN ein Array von `CollectionModel`-Objekten mit verschiedenen Ownern (`"black-forest-labs"`, `"stability-ai"`, `"fal-ai"`)
   WHEN `ownerFilter` auf `"stability-ai"` gesetzt wird
   THEN gibt `filteredModels` nur Modelle mit `owner === "stability-ai"` zurueck

5) GIVEN ein Array von `CollectionModel`-Objekten
   WHEN `ownerFilter` auf `null` oder `""` gesetzt wird
   THEN werden alle Modelle angezeigt (kein Owner-Filter aktiv)

6) GIVEN `searchQuery` auf `"pro"` und `ownerFilter` auf `"black-forest-labs"` gesetzt
   WHEN `filteredModels` ausgewertet wird
   THEN enthaelt das Ergebnis nur Modelle, die BEIDE Bedingungen erfuellen (AND-Logik):
   — Owner ist `"black-forest-labs"` UND Name/Description enthaelt `"pro"`

7) GIVEN ein Array von `CollectionModel`-Objekten mit Ownern `["black-forest-labs", "stability-ai", "black-forest-labs", "fal-ai"]`
   WHEN `owners` aus dem Hook gelesen wird
   THEN gibt `owners` ein Array zurueck mit genau 3 eindeutigen Eintraegen: `["black-forest-labs", "stability-ai", "fal-ai"]` (ohne Duplikate, Reihenfolge: erste Occurrence)

8) GIVEN ein leeres `CollectionModel[]`-Array
   WHEN der Hook initialisiert wird
   THEN gibt `filteredModels` ein leeres Array zurueck
   AND gibt `owners` ein leeres Array zurueck (kein Fehler)

9) GIVEN der Hook mit einem `CollectionModel[]`-Array initialisiert wird
   WHEN `searchQuery` leer ist und `ownerFilter` nicht gesetzt ist
   THEN gibt `filteredModels` alle Modelle ungefiltert zurueck

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/hooks/__tests__/use-model-filters.test.ts`

<test_spec>
```typescript
// AC-1: Suche nach Name/Description (lowercase match)
it.todo('should filter models by name or description (case-insensitive, lowercase query)')

// AC-2: Suche case-insensitive (uppercase query)
it.todo('should return same results for uppercase and lowercase search query')

// AC-3: null-Description — kein Fehler, kein Match
it.todo('should handle models with null description without throwing')

// AC-4: Owner-Filter — nur Modelle des gesetzten Owners
it.todo('should filter models by owner when ownerFilter is set')

// AC-5: Kein Owner-Filter — alle Modelle
it.todo('should return all models when ownerFilter is null or empty string')

// AC-6: AND-Logik fuer kombinierte Filter
it.todo('should apply search and owner filter simultaneously with AND logic')

// AC-7: Unique Owner-Liste ohne Duplikate
it.todo('should return unique owners in order of first occurrence')

// AC-8: Leeres Array — kein Fehler
it.todo('should return empty filteredModels and empty owners for empty input array')

// AC-9: Keine Filter aktiv — alle Modelle ungefiltert
it.todo('should return all models when no filters are active')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-02` | `CollectionModel` | TypeScript Interface | Import: `import type { CollectionModel } from '@/lib/types/collection-model'` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `useModelFilters` | Custom React Hook | `slice-08` (ModelBrowserDrawer) | `useModelFilters(models: CollectionModel[], searchQuery: string, ownerFilter: string \| null): { filteredModels: CollectionModel[], owners: string[] }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/hooks/use-model-filters.ts` — Custom Hook mit Suche (Name + Description, case-insensitive), Owner-Filter (Single-Select), AND-Logik und eindeutiger Owner-Extraktion
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN UI-Code (keine Render-Logik, keine Komponenten)
- KEIN State fuer `searchQuery` oder `ownerFilter` — der Hook nimmt diese als Parameter entgegen, haelt sie NICHT intern
- KEINE Server-Aufrufe; rein client-seitige Array-Filterung
- KEINE Sort-Logik (Reihenfolge aus `models`-Array bleibt unveraendert)
- KEINE Multi-Select-Logik fuer Owner (Single-Select; max 1 Owner aktiv)

**Technische Constraints:**
- Filterung via `Array.filter()` + `String.includes()` (kein externes Search-Library)
- `useMemo` fuer `filteredModels` und `owners` (performance-optimiert, re-berechnung nur bei Input-Aenderungen)
- `description: null` muss ohne Fehler behandelt werden (null-safe String-Check)
- Owner-Extraktion: `[...new Set(models.map(m => m.owner))]` oder aequivalent (Reihenfolge beibehalten)
- Kein Hook-State intern; Hook ist zustandslos (reine Transformation)

**Referenzen:**
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` → Section "Data Transfer Objects" (CollectionModel Felder)
- Discovery: `specs/phase-2/2026-03-07-model-cards/discovery.md` → Section "Business Rules" (Search + Filter AND-Logik, Owner-Chips)
- Discovery: `specs/phase-2/2026-03-07-model-cards/discovery.md` → Section "UI Components & States" (`model-search`, `model-filter-chips`)
