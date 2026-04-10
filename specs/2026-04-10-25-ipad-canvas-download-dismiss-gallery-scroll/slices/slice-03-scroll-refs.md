# Slice 3: Gallery Scroll -- Refs am Container

> **Slice 3 von 5** fuer `iPad Canvas Download Fix + Gallery Scroll Restore`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-03-scroll-refs` |
| **Test** | `pnpm vitest run components/workspace/__tests__/workspace-content-detail.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm vitest run components/workspace/__tests__/workspace-content-detail.test.tsx` |
| **Integration Command** | -- |
| **Acceptance Command** | -- |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | -- |
| **Mocking Strategy** | `mock_external` (bestehende Mocks fuer Actions, Context, Router beibehalten) |

---

## Ziel

Zwei `useRef`-Hooks in `workspace-content.tsx` einfuehren: `galleryScrollRef` fuer den Gallery-Scroll-Container (HTMLDivElement) und `scrollTopRef` fuer den gespeicherten Scroll-Wert (number, default 0). Den `galleryScrollRef` als `ref`-Attribut auf das Gallery-Container-`div` (~L404) setzen. Diese Refs sind die Grundlage fuer Scroll-Save/Restore in den Folge-Slices.

---

## Acceptance Criteria

1) GIVEN `workspace-content.tsx` nach der Aenderung
   WHEN die Component gerendert wird
   THEN existiert ein `useRef<HTMLDivElement>(null)` namens `galleryScrollRef` und ein `useRef<number>(0)` namens `scrollTopRef` in der Component

2) GIVEN das Gallery-Container-`div` (das `div` mit `overflow-y-auto` und `className` enthaltend `min-w-[300px] flex-1 overflow-y-auto`, ~L404)
   WHEN die Component gerendert wird
   THEN hat dieses `div` das Attribut `ref={galleryScrollRef}`

3) GIVEN die bestehende Test-Suite `workspace-content-detail.test.tsx`
   WHEN `pnpm vitest run components/workspace/__tests__/workspace-content-detail.test.tsx` ausgefuehrt wird
   THEN sind alle bestehenden Tests gruen (kein Regressionsbruch durch Ref-Hinzufuegung)

4) GIVEN `galleryScrollRef` ist am Gallery-Container gesetzt
   WHEN die Gallery sichtbar ist (kein Canvas offen) und der User scrollt
   THEN ist `galleryScrollRef.current.scrollTop` programmatisch lesbar (Wert > 0 nach Scroll)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.
> **Syntax:** TypeScript/Vitest (erkannter Stack).

### Test-Datei: `components/workspace/__tests__/workspace-content-detail.test.tsx`

<test_spec>
```typescript
// Neue Tests innerhalb des bestehenden describe-Blocks hinzufuegen.
// Bestehende Tests NICHT veraendern.
// Vitest-Environment: jsdom (bereits konfiguriert in Zeile 1)

// AC-1 + AC-2: Ref existiert und ist am Gallery-Container gesetzt
it.todo('should attach a ref to the gallery scroll container div with overflow-y-auto')

// AC-3: Regression (implizit durch bestehende Tests -- kein neuer Test noetig)

// AC-4: scrollTop ist programmatisch les-/setzbar ueber den Ref
it.todo('should expose scrollTop on the gallery container ref after render')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| -- | -- | -- | Keine Dependencies, unabhaengig von Download-Track |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `galleryScrollRef` | `React.RefObject<HTMLDivElement>` | `slice-04-scroll-save-restore` | Ref auf Gallery-Container, `galleryScrollRef.current.scrollTop` lesbar/setzbar |
| `scrollTopRef` | `React.RefObject<number>` | `slice-04-scroll-save-restore` | Gespeicherter Scroll-Wert, `scrollTopRef.current` les-/schreibbar |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/workspace-content.tsx` -- Zwei `useRef`-Hooks hinzufuegen (`galleryScrollRef`, `scrollTopRef`) + `ref={galleryScrollRef}` auf Gallery-Container-`div` setzen (~3 Zeilen Aenderung)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Scroll-Save-Logik in `handleSelectGeneration` (das ist Slice 04)
- KEINE Scroll-Restore-Logik in `handleDetailViewClose` (das ist Slice 04)
- KEINE Aenderung an `handleSelectGeneration` oder `handleDetailViewClose`
- KEINE Aenderung an `lib/utils.ts` oder `canvas-toolbar.tsx` (Download-Track)
- KEINE neuen npm Dependencies
- KEINE neuen Imports noetig (`useRef` ist bereits importiert in Zeile 3)

**Technische Constraints:**
- `useRef` ist bereits im Import auf Zeile 3 vorhanden -- kein zusaetzlicher Import noetig
- `galleryScrollRef` = `useRef<HTMLDivElement>(null)` -- Standard-Pattern fuer DOM-Element-Refs
- `scrollTopRef` = `useRef<number>(0)` -- Default 0 als Fallback-Scroll-Position
- Ref-Deklaration neben den bestehenden State-Hooks platzieren (vor den useCallback-Handlern)
- `ref={galleryScrollRef}` auf das `div` mit `overflow-y-auto` auf ~L404 setzen

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/workspace/workspace-content.tsx` (~L404, Gallery-Container) | EXTEND: `ref`-Attribut hinzufuegen, 2 useRef-Hooks ergaenzen |

**Referenzen:**
- Architecture: `architecture.md` -> Section "Migration Map" -> `workspace-content.tsx` Eintrag (useRef fuer Gallery-Scroll-Container)
- Architecture: `architecture.md` -> Section "Architecture Layers" -> `workspace-content.tsx` (useRef + requestAnimationFrame Pattern)
- Discovery: `discovery.md` -> Section "Data" (scrollTopRef, galleryScrollRef Beschreibung)
- Discovery: `discovery.md` -> Section "User Flow" -> Flow 3 (Gallery Scroll Restore)
