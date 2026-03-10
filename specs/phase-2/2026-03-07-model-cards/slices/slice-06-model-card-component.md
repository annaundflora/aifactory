# Slice 6: Model Card Component

> **Slice 6 von 14** fuer `Model Cards & Multi-Model Selection`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-06-model-card-component` |
| **Test** | `pnpm test components/models/__tests__/model-card.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-shadcn-badge", "slice-02-collection-model-service"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/models/__tests__/model-card.test.tsx` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Praesentationale `ModelCard`-Komponente erstellen, die ein einzelnes `CollectionModel` als auswaehlbare Karte darstellt. Die Komponente ist rein praesentational (keine Server-Calls, kein eigener State) und wird spaeter im Model Browser Drawer (Slice 08) verwendet.

---

## Acceptance Criteria

1) GIVEN ein `CollectionModel`-Objekt mit allen Feldern (inkl. `cover_image_url`)
   WHEN `ModelCard` gerendert wird
   THEN wird ein `<img>`-Tag mit `src={cover_image_url}` im 16:9-Seitenverhaeltnis angezeigt
   AND der Model-Name wird bold und einzeilig truncated angezeigt
   AND der Owner-Name wird in muted-Farbe angezeigt
   AND die Description wird auf maximal 2 Zeilen begrenzt (CSS line-clamp)
   AND der Run-Count wird als `Badge`-Komponente aus `components/ui/badge.tsx` angezeigt

2) GIVEN ein `CollectionModel`-Objekt mit `cover_image_url: null`
   WHEN `ModelCard` gerendert wird
   THEN wird statt eines `<img>`-Tags ein Fallback-Gradient-Div mit fester 16:9-Hoehe angezeigt
   AND kein `<img>`-Tag ist im DOM vorhanden

3) GIVEN eine `ModelCard` mit `selected={true}`
   WHEN die Komponente gerendert wird
   THEN hat die Karte einen sichtbaren Ring (CSS `ring`-Klasse oder gleichwertig)
   AND ein Checkmark-Icon ist im Checkbox-Overlay oben rechts sichtbar
   AND der Checkbox-Bereich zeigt einen gefuellten/aktiven Zustand

4) GIVEN eine `ModelCard` mit `selected={false}` und `disabled={true}`
   WHEN die Komponente gerendert wird
   THEN hat die Karte reduzierte Opacity (CSS `opacity-50` oder gleichwertig)
   AND ein Klick auf die Karte loest `onSelect` NICHT aus
   AND kein Ring oder Checkmark ist sichtbar

5) GIVEN eine `ModelCard` mit `selected={false}` und `disabled={false}`
   WHEN der Nutzer auf die Karte klickt
   THEN wird `onSelect(model)` mit dem uebergebenen `CollectionModel` aufgerufen

6) GIVEN ein `CollectionModel` mit einer langen Description (mehr als 2 Zeilen)
   WHEN `ModelCard` gerendert wird
   THEN ist die Description auf 2 Zeilen begrenzt
   AND das Tooltip-Attribut (`title`) oder ein Tooltip-Wrapper zeigt den vollstaendigen Beschreibungstext

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/models/__tests__/model-card.test.tsx`

<test_spec>
```typescript
// AC-1: Vollstaendige Karte mit allen Feldern rendern
it.todo('should render cover image, name, owner, description and run count badge')

// AC-2: Fallback-Gradient wenn cover_image_url null ist
it.todo('should render fallback gradient div instead of img when cover_image_url is null')

// AC-3: Selected-State zeigt Ring und Checkmark
it.todo('should show ring and checkmark when selected is true')

// AC-4: Disabled-State reduziert Opacity und blockiert Klick
it.todo('should show reduced opacity and not call onSelect when disabled')

// AC-5: Klick ruft onSelect mit CollectionModel auf
it.todo('should call onSelect with the model when card is clicked and not disabled')

// AC-6: Description-Truncation mit Tooltip fuer vollen Text
it.todo('should truncate description to 2 lines and provide full text in tooltip')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-shadcn-badge` | `Badge` | React Component | Import `Badge` aus `components/ui/badge.tsx` muss fehlerfrei sein |
| `slice-02-collection-model-service` | `CollectionModel` | TypeScript Interface | Import `CollectionModel` aus `lib/types/collection-model.ts` muss fehlerfrei sein |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ModelCard` | React Component | `slice-08` (Model Browser Drawer) | `ModelCard: React.FC<ModelCardProps>` |
| `ModelCardProps` | TypeScript Interface | `slice-08` | `{ model: CollectionModel; selected: boolean; disabled: boolean; onSelect: (model: CollectionModel) => void }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/models/model-card.tsx` -- Praesentationale ModelCard-Komponente mit Cover-Image, Fallback-Gradient, Name/Owner/Description, Run-Count-Badge, Checkbox-Overlay, Selected-State (Ring + Checkmark), Disabled-State
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN eigener State in der Komponente (rein praesentational, alle States via Props)
- KEINE Server-Calls oder Data-Fetching
- KEINE Integration in Drawer oder Prompt Area (kommt in Slice 08 und 10)
- KEIN Run-Count-Formatter -- `run_count` wird als Zahl entgegengenommen und direkt via `Badge` angezeigt (Formatter kommt in Slice 09, Integration in Slice 08)
- `components/models/`-Verzeichnis wird mit dieser Datei neu angelegt

**Technische Constraints:**
- Cover-Image: `<img loading="lazy">` (kein `next/image`) -- kein Eintrag in `next.config.ts` noetig (siehe architecture.md Migration Map, Eintrag `next.config.ts`)
- Fallback-Gradient: CSS-Gradient via Tailwind-Klassen, gleiches Seitenverhaeltnis wie Cover-Image (`aspect-video` oder `aspect-[16/9]`)
- Description-Truncation: CSS `line-clamp-2`, Tooltip via natives `title`-Attribut oder shadcn `Tooltip`-Komponente (falls bereits installiert)
- Ring fuer Selected-State: Tailwind `ring-2` oder `ring` Klassen
- Disabled-State: Tailwind `opacity-50` + `pointer-events-none` oder `cursor-not-allowed`
- Checkbox-Overlay oben rechts: `position: absolute`, `top`, `right` via Tailwind
- Basis-Styling: shadcn `Card`-Komponente als Wrapper (bereits im Projekt vorhanden)

**Referenzen:**
- Wireframes: `specs/phase-2/2026-03-07-model-cards/discovery.md` -> Section "Model Card (inside Drawer)" (Layout-Reihenfolge und Felder)
- Wireframes: `specs/phase-2/2026-03-07-model-cards/discovery.md` -> Section "UI Components & States" (Zeile `model-card` -- States und Verhalten)
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` -> Section "Data Transfer Objects" (`CollectionModel` Felder)
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` -> Section "Constraints" (Max 3, Disabled-State-Logik)
