# Slice 4: Gallery Scroll -- Save/Restore in Handlers

> **Slice 4 von 5** fuer `iPad Canvas Download Fix + Gallery Scroll Restore`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-04-scroll-save-restore` |
| **Test** | `pnpm vitest run components/workspace/__tests__/workspace-content-detail.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-scroll-refs"]` |

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

`handleSelectGeneration` und `handleDetailViewClose` in `workspace-content.tsx` um Scroll-Save/Restore-Logik erweitern. Beim Oeffnen des Canvas wird die aktuelle `scrollTop`-Position des Gallery-Containers in `scrollTopRef` gespeichert. Beim Schliessen wird die Position via `requestAnimationFrame` wiederhergestellt, damit der Browser nach dem `display: none`-Entfernen einen Render-Cycle abschliessen kann.

---

## Acceptance Criteria

1) GIVEN die Gallery ist sichtbar und der Scroll-Container hat `scrollTop = 420`
   WHEN `handleSelectGeneration(id)` aufgerufen wird
   THEN wird `scrollTopRef.current` auf `420` gesetzt BEVOR `setDetailViewOpen(true)` ausgefuehrt wird

2) GIVEN `scrollTopRef.current` ist `420` und der Canvas ist offen
   WHEN `handleDetailViewClose()` aufgerufen wird
   THEN wird nach `setDetailViewOpen(false)` ein `requestAnimationFrame`-Callback registriert, das `galleryScrollRef.current.scrollTop` auf `420` setzt

3) GIVEN `galleryScrollRef.current` ist `null` (Container nicht gemountet)
   WHEN `handleSelectGeneration(id)` oder `handleDetailViewClose()` aufgerufen wird
   THEN wird kein Fehler geworfen -- Save faellt auf `0` zurueck (Nullish-Coalescing), Restore ueberspringt `scrollTop`-Zuweisung (Null-Guard)

4) GIVEN `handleDetailViewClose()` nutzt `startViewTransitionIfSupported()` als Wrapper
   WHEN der Close-Handler ausgefuehrt wird
   THEN laeuft der `requestAnimationFrame`-Aufruf INNERHALB des `startViewTransitionIfSupported`-Callbacks, NACH `setDetailViewOpen(false)`

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
// requestAnimationFrame muss ggf. via vi.stubGlobal gemockt werden,
// damit der Callback synchron aufrufbar ist.

// AC-1: scrollTop wird bei Canvas-Open gespeichert
it.todo('should save gallery scrollTop to scrollTopRef when selecting a generation')

// AC-2: scrollTop wird bei Canvas-Close via requestAnimationFrame wiederhergestellt
it.todo('should restore gallery scrollTop via requestAnimationFrame when closing detail view')

// AC-3: Null-Safety -- kein Fehler wenn galleryScrollRef.current null ist
it.todo('should not throw when galleryScrollRef.current is null during save or restore')

// AC-4: rAF laeuft innerhalb startViewTransitionIfSupported, nach setDetailViewOpen(false)
it.todo('should call requestAnimationFrame inside startViewTransitionIfSupported callback after setDetailViewOpen(false)')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03-scroll-refs` | `galleryScrollRef` | `React.RefObject<HTMLDivElement>` | Ref ist am Gallery-Container-`div` gesetzt, `galleryScrollRef.current.scrollTop` lesbar/setzbar |
| `slice-03-scroll-refs` | `scrollTopRef` | `React.RefObject<number>` | Ref existiert mit Default `0`, Wert les-/schreibbar via `.current` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Scroll-Save in `handleSelectGeneration` | Seiteneffekt | -- (kein direkter Consumer) | `scrollTopRef.current` wird vor Canvas-Open beschrieben |
| Scroll-Restore in `handleDetailViewClose` | Seiteneffekt | -- (kein direkter Consumer) | `galleryScrollRef.current.scrollTop` wird nach Canvas-Close gesetzt |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/workspace-content.tsx` -- `handleSelectGeneration` (~L297-305): scrollTop-Save vor State-Update. `handleDetailViewClose` (~L307-312): scrollTop-Restore via requestAnimationFrame nach State-Update.
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderung an `lib/utils.ts` oder `canvas-toolbar.tsx` (Download-Track)
- KEINE Aenderung an der Ref-Deklaration oder dem `ref`-Attribut am Gallery-Container (das ist Slice 03)
- KEINE Scroll-Persistierung ueber Page-Reloads (kein localStorage)
- KEINE neuen npm Dependencies
- KEINE neuen Imports noetig (`requestAnimationFrame` ist global, Refs existieren bereits aus Slice 03)
- KEINE Aenderung an `startViewTransitionIfSupported` selbst

**Technische Constraints:**
- scrollTop-Save MUSS vor `setDetailViewOpen(true)` passieren (innerhalb des `startViewTransitionIfSupported`-Callbacks, vor dem State-Update)
- scrollTop-Restore MUSS via `requestAnimationFrame` geschehen, da der Browser nach dem Entfernen von `display: none` einen Render-Cycle braucht bevor `scrollTop` setzbar ist
- `requestAnimationFrame` MUSS innerhalb des `startViewTransitionIfSupported`-Callbacks laufen, NACH `setDetailViewOpen(false)`
- Null-Safety: `galleryScrollRef.current?.scrollTop ?? 0` fuer Save, `if (galleryScrollRef.current)` Guard fuer Restore

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/workspace/workspace-content.tsx` (L297-305, `handleSelectGeneration`) | EXTEND: scrollTop-Save-Zeile vor State-Update hinzufuegen |
| `components/workspace/workspace-content.tsx` (L307-312, `handleDetailViewClose`) | EXTEND: requestAnimationFrame-Block nach State-Update hinzufuegen |
| `lib/utils/view-transition.ts` (`startViewTransitionIfSupported`) | REUSE unveraendert -- Callback-Wrapper bleibt bestehen |

**Referenzen:**
- Architecture: `architecture.md` -> Section "Migration Map" -> `workspace-content.tsx` Eintrag (scrollTop Save/Restore Details)
- Architecture: `architecture.md` -> Section "Data Flow" -> "Scroll Restore" (Save bei Open, Restore bei Close)
- Architecture: `architecture.md` -> Section "Constraints & Integrations" -> "Gallery display:none Toggle" und "View Transition API im Close-Handler"
- Discovery: `discovery.md` -> Section "User Flow" -> Flow 3 (Gallery Scroll Restore)
- Slice 03: `slice-03-scroll-refs.md` -> Provides (galleryScrollRef, scrollTopRef)
