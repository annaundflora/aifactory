# Slice 6: Animated Transition (Gallery <-> Detail)

> **Slice 6 von 18** fuer `Canvas Detail-View & Editing Flow`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-06-animated-transition` |
| **Test** | `pnpm test __tests__/next-config-view-transition.test.ts components/workspace/__tests__/generation-card-transition.test.tsx components/canvas/__tests__/canvas-detail-view-transition.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-05-detail-view-shell"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test __tests__/next-config-view-transition.test.ts components/workspace/__tests__/generation-card-transition.test.tsx components/canvas/__tests__/canvas-detail-view-transition.test.tsx` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | `pnpm test __tests__/next-config-view-transition.test.ts components/workspace/__tests__/generation-card-transition.test.tsx components/canvas/__tests__/canvas-detail-view-transition.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

CSS View Transitions API fuer den Gallery-zu-Detail-Uebergang aktivieren. Das Thumbnail-Bild in der Gallery soll nahtlos zur Fullscreen-Darstellung im Canvas animieren und beim Zurueckkehren die Reverse-Animation zeigen. Bei nicht-unterstuetzten Browsern soll der Uebergang ohne Animation funktionieren (Graceful Degradation).

---

## Acceptance Criteria

1) GIVEN die Datei `next.config.ts`
   WHEN die Config geprueft wird
   THEN enthaelt sie `experimental: { viewTransition: true }` neben den bestehenden `images` und `rewrites` Konfigurationen

2) GIVEN eine `GenerationCard` mit `generation.id === "gen-abc-123"` wird gerendert
   WHEN das Thumbnail-`<img>`-Element geprueft wird
   THEN hat es `style.viewTransitionName === "canvas-image-gen-abc-123"` (dynamisch pro Generation-ID)

3) GIVEN die `CanvasDetailView` ist geoeffnet mit `currentGenerationId === "gen-abc-123"`
   WHEN das Canvas-Image-Element geprueft wird
   THEN hat es `style.viewTransitionName === "canvas-image-gen-abc-123"` (identisch zum Gallery-Thumbnail)

4) GIVEN ein User auf der Gallery-View in einem Browser der CSS View Transitions API unterstuetzt
   WHEN der User auf ein Gallery-Bild klickt
   THEN wird `document.startViewTransition()` aufgerufen und die Detail-View wird innerhalb der Transition-Callback geoeffnet

5) GIVEN die Detail-View ist sichtbar in einem Browser der CSS View Transitions API unterstuetzt
   WHEN der User den Back-Button klickt oder ESC drueckt
   THEN wird `document.startViewTransition()` aufgerufen und die Gallery-View wird innerhalb der Transition-Callback angezeigt (Reverse-Animation)

6) GIVEN ein Browser der `document.startViewTransition` NICHT unterstuetzt
   WHEN der User auf ein Gallery-Bild klickt
   THEN oeffnet sich die Detail-View sofort ohne Animation (identisches Ergebnis, nur ohne visuelle Transition)

7) GIVEN ein Browser der `document.startViewTransition` NICHT unterstuetzt
   WHEN der User die Detail-View schliesst (Back/ESC)
   THEN kehrt die Gallery-View sofort ohne Animation zurueck

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `__tests__/next-config-view-transition.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('next.config.ts — View Transition Flag', () => {
  // AC-1: next.config.ts enthaelt experimental.viewTransition: true
  it.todo('should have experimental.viewTransition set to true in next config')
})
```
</test_spec>

### Test-Datei: `components/workspace/__tests__/generation-card-transition.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('GenerationCard — View Transition', () => {
  // AC-2: Thumbnail hat dynamische view-transition-name basierend auf generation.id
  it.todo('should set viewTransitionName style on thumbnail image matching generation id')
})
```
</test_spec>

### Test-Datei: `components/canvas/__tests__/canvas-detail-view-transition.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('CanvasDetailView — View Transition', () => {
  // AC-3: Canvas-Image hat gleiche view-transition-name wie Gallery-Thumbnail
  it.todo('should set viewTransitionName style on canvas image matching current generation id')

  // AC-4: startViewTransition wird beim Oeffnen aufgerufen (wenn unterstuetzt)
  it.todo('should call document.startViewTransition when opening detail view in supported browser')

  // AC-5: startViewTransition wird beim Schliessen aufgerufen (Reverse)
  it.todo('should call document.startViewTransition when closing detail view via back or ESC')

  // AC-6: Graceful Degradation — Detail-View oeffnet ohne Animation bei nicht-unterstuetztem Browser
  it.todo('should open detail view without animation when startViewTransition is not available')

  // AC-7: Graceful Degradation — Detail-View schliesst ohne Animation bei nicht-unterstuetztem Browser
  it.todo('should close detail view without animation when startViewTransition is not available')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-05-detail-view-shell` | `CanvasDetailView` | React Component | Vorhandene Fullscreen-Shell mit Canvas-Image-Element |
| `slice-05-detail-view-shell` | `WorkspaceContent` detailViewOpen-State | State + Callbacks | `openDetailView(generationId)` und `closeDetailView()` als Transition-Trigger |
| `slice-05-detail-view-shell` | `CanvasHeader` onBack | Callback | `() => void` fuer Back/ESC-Handler als Transition-Wrapper |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `viewTransitionName` auf Canvas-Image | CSS Property | `slice-08`, `slice-14` | `style={{ viewTransitionName: \`canvas-image-\${generationId}\` }}` |
| `experimental.viewTransition` Config | Next.js Config Flag | alle Slices | Globale View Transitions API Aktivierung |
| Transition-Wrapper-Pattern | Function | `slice-18` | `startViewTransitionIfSupported(callback: () => void): void` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `next.config.ts` — `experimental: { viewTransition: true }` Flag hinzufuegen
- [ ] `components/canvas/canvas-detail-view.tsx` — `view-transition-name` auf Canvas-Image setzen, `startViewTransition`-Wrapper fuer Back/Close
- [ ] `components/workspace/generation-card.tsx` — `view-transition-name` auf Thumbnail-Image setzen, `startViewTransition`-Wrapper fuer Click-Handler
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderung am Layout der CanvasDetailView (das ist Slice 5)
- KEINE Toolbar, Siblings, Chat oder andere UI-Inhalte (Slices 7-13)
- KEINE Custom-CSS-Keyframes oder Animationsbibliotheken — nur CSS View Transitions API
- KEINE URL-Aenderungen oder Route-Transitions (State-basiert, nicht Route-basiert)

**Technische Constraints:**
- `document.startViewTransition` mit Feature-Detection wrappen: `if ('startViewTransition' in document)` fuer Graceful Degradation
- `view-transition-name` muss pro Generation-ID eindeutig sein (Format: `canvas-image-{generationId}`)
- Die bestehenden `onSelect` und `onBack` Callbacks in `WorkspaceContent` muessen um den `startViewTransition`-Aufruf erweitert werden, ohne die Signatur zu aendern
- Next.js 16 experimental `viewTransition: true` aktiviert React 19 `startViewTransition` Integration

**Referenzen:**
- Architecture: `specs/phase-4/2026-03-13-canvas-detail-view/architecture.md` → Section "Constraints & Integrations" (View Transitions API Entscheidung, Graceful Degradation)
- Architecture: `architecture.md` → Section "Technology Decisions" (CSS View Transitions vs. framer-motion Trade-off)
- Wireframes: `specs/phase-4/2026-03-13-canvas-detail-view/wireframes.md` → Screen "Animated Transition (Gallery -> Detail)"
- Discovery: `discovery.md` → Section "Feature State Machine" (transitioning-in / transitioning-out States)
- Bestehender Code: `next.config.ts` → Bestehende Config-Struktur (images, rewrites)
- Bestehender Code: `components/workspace/generation-card.tsx` → `onSelect` Handler als Erweiterungspunkt
