# Slice 12: CompareModal Component

> **Slice 12** für `Generation UI Improvements`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-12-compare-modal` |
| **Test** | `pnpm test components/compare/compare-modal` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/compare/compare-modal` |
| **Integration Command** | `n/a` |
| **Acceptance Command** | `n/a` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `n/a` |
| **Mocking Strategy** | `mock_external` — `getModelById` aus `lib/models.ts` mocken |

---

## Ziel

Eigenständige `CompareModal`-Komponente als Fullscreen-Dialog: zeigt 2–4 Generation-Objekte in einem 2x2-Grid. Leere Slots werden als dashed-border-Platzhalter dargestellt. Jedes Bild hat einen Fullscreen-Toggle, der eine In-Modal-Einzelansicht öffnet. ESC schließt die Einzelansicht zurück zum Grid. Ein X-Button schließt das gesamte Modal.

---

## Acceptance Criteria

1) GIVEN `isOpen=true` und `generations` mit 4 Einträgen
   WHEN die Komponente rendert
   THEN sind 4 `<img>`-Elemente im Grid sichtbar und unter jedem Bild steht ein Label im Format `"{ModelDisplayName} · {width} x {height}"` (z.B. `"FLUX 1.1 · 1024x576"`)

2) GIVEN `isOpen=true` und `generations` mit 2 Einträgen
   WHEN die Komponente rendert
   THEN sind 2 befüllte Zellen und 2 leere Slot-Zellen sichtbar; die leeren Zellen haben eine dashed-border-Klasse (CSS `border-dashed`) und enthalten kein `<img>`-Element

3) GIVEN `isOpen=true` und `generations` mit 3 Einträgen
   WHEN die Komponente rendert
   THEN sind 3 befüllte Zellen und 1 leere Slot-Zelle sichtbar (unten-rechts); die leere Zelle hat eine dashed-border-Klasse und enthält kein `<img>`-Element

4) GIVEN Grid-View mit 4 Bildern
   WHEN der Fullscreen-Toggle-Button eines Bildes geklickt wird
   THEN wechselt die View in den Einzelbild-Modus: nur dieses eine Bild ist sichtbar, alle anderen Zellen sind nicht sichtbar

5) GIVEN Einzelbild-Modus ist aktiv
   WHEN ESC gedrückt wird
   THEN kehrt die View zum Grid zurück: alle Zellen sind wieder sichtbar, kein Bild ist im Einzelbild-Modus

6) GIVEN Einzelbild-Modus ist aktiv
   WHEN der X-Close-Button im Einzelbild-Modus geklickt wird
   THEN kehrt die View zum Grid zurück (nicht das gesamte Modal schließen)

7) GIVEN `isOpen=true`
   WHEN der X-Close-Button im Modal-Header geklickt wird
   THEN wird `onClose` einmal aufgerufen

8) GIVEN `isOpen=false`
   WHEN die Komponente rendert
   THEN ist kein Modal-Content im DOM sichtbar (Dialog geschlossen)

---

## Test Skeletons

> Für den Test-Writer-Agent: Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstständig.

### Test-Datei: `components/compare/__tests__/compare-modal.test.tsx`

<test_spec>
```typescript
// AC-1: 4 Bilder mit korrekten Dimensions-Labels
it.todo('should render 4 images with model name and dimensions labels')

// AC-2: 2 Bilder — untere Reihe als leere Slots mit dashed border
it.todo('should render 2 empty slots with dashed border when 2 generations provided')

// AC-3: 3 Bilder — unterer rechter Slot leer mit dashed border
it.todo('should render 1 empty slot bottom-right with dashed border when 3 generations provided')

// AC-4: Fullscreen-Toggle zeigt Einzelbild
it.todo('should switch to single-image view when fullscreen toggle is clicked')

// AC-5: ESC schließt Einzelbild zurück zum Grid
it.todo('should return to grid view when ESC is pressed in single-image mode')

// AC-6: X-Button im Einzelbild-Modus kehrt zum Grid zurück
it.todo('should return to grid view when close button clicked in single-image mode')

// AC-7: X-Close-Button im Header ruft onClose auf
it.todo('should call onClose when modal close button is clicked')

// AC-8: isOpen=false — kein Modal-Content im DOM
it.todo('should not render modal content when isOpen is false')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| — (bestehend) | `Generation` (Type) | TypeScript-Typ | `lib/db/queries.ts` — Felder: `id`, `imageUrl`, `modelId`, `width`, `height` |
| — (bestehend) | `getModelById` | Function | `lib/models.ts` — gibt `{ displayName: string }` zurück |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `CompareModal` | React Component | `workspace-content.tsx` (Slice integriert diesen) | `CompareModal({ generations: Generation[], isOpen: boolean, onClose: () => void })` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/compare/compare-modal.tsx` — Fullscreen-Dialog mit 2x2-Grid, Fullscreen-Toggle pro Bild, ESC-Handling, X-Close, leere Slot-Platzhalter
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Keine Integration in `workspace-content.tsx` (das ist Aufgabe eines anderen Slices)
- Keine Anbindung an SelectionContext oder Bulk-Select-State
- Keine Lightbox-Compare-Bar (`lightbox-compare-bar.tsx` ist eigener Slice)
- Keine Slide/Overlay-Vergleichsansicht (Out of Scope laut architecture.md)
- Maximal 4 Generations — keine Validierungslogik nötig (Caller verantwortet Anzahl)

**Technische Constraints:**
- Nutze `radix-ui Dialog` als Modal-Basis (bereits in `radix-ui@1.4.3` vorhanden, siehe architecture.md → Integrations)
- Fullscreen-Toggle-Button: `lucide-react` Icon (`Maximize2` o.ä.), bereits in `lucide-react@0.577.0` vorhanden
- ESC-Handling: entweder über native Dialog-Verhalten oder `keydown`-EventListener
- Model-Name-Auflösung: `getModelById(generation.modelId)?.displayName` aus `lib/models.ts`
- Label-Format exakt: `"{ModelDisplayName} · {width} x {height}"` (Middot `·` als Trennzeichen)
- Leere Slots: CSS `border-dashed` — konkrete Klassen aus bestehendem TailwindCSS 4 Pattern wählen

**Referenzen:**
- Wireframes: `wireframes.md` → "Screen: Compare View Modal" (Grid View 4 Bilder, Grid View 2 Bilder, Fullscreen Single, State Variations)
- Architecture: `architecture.md` → "CompareModal Data Contract" (Props-Interface, Felder-Verwendung)
- Architecture: `architecture.md` → "Integrations" (radix-ui Dialog, lucide-react)
