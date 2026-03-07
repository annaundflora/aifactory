# Slice 19: Lightbox Fullscreen Toggle

> **Slice 19** fuer `quality-improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-19-lightbox-fullscreen` |
| **Test** | `pnpm test components/lightbox/__tests__/lightbox-modal.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/lightbox/__tests__/lightbox-modal.test.tsx` |
| **Integration Command** | `pnpm test components/lightbox/` |
| **Acceptance Command** | `pnpm test components/lightbox/` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Die bestehende `lightbox-modal.tsx` um einen Fullscreen-Modus erweitern. Ein Toggle-Button (Maximize2/Minimize2) neben dem Close-Button wechselt zwischen Normal-Modus (Bild max 70vh + Details-Panel) und Fullscreen-Modus (Bild 100% Viewport, object-contain, schwarzer Hintergrund, Details-Panel versteckt). ESC kehrt zum Normal-Modus zurueck, Navigation funktioniert in beiden Modi.

---

## Acceptance Criteria

1) GIVEN die Lightbox ist im Normal-Modus geoeffnet
   WHEN der User den Fullscreen-Toggle-Button klickt
   THEN wechselt die Lightbox in den Fullscreen-Modus: Bild nimmt den gesamten Viewport ein (object-contain), Details-Panel ist nicht sichtbar, Hintergrund ist schwarz

2) GIVEN die Lightbox ist im Fullscreen-Modus
   WHEN der User den Fullscreen-Toggle-Button klickt
   THEN wechselt die Lightbox zurueck in den Normal-Modus: Bild hat max-h-[70vh], Details-Panel ist sichtbar

3) GIVEN die Lightbox ist im Normal-Modus
   WHEN der User den Fullscreen-Toggle-Button betrachtet
   THEN zeigt der Button das Maximize2-Icon (Lucide) und ist neben dem Close-Button (X) positioniert

4) GIVEN die Lightbox ist im Fullscreen-Modus
   WHEN der User den Fullscreen-Toggle-Button betrachtet
   THEN zeigt der Button das Minimize2-Icon (Lucide)

5) GIVEN die Lightbox ist im Fullscreen-Modus
   WHEN der User die ESC-Taste drueckt
   THEN kehrt die Lightbox zum Normal-Modus zurueck (schliesst NICHT die gesamte Lightbox)

6) GIVEN die Lightbox ist im Normal-Modus
   WHEN der User die ESC-Taste drueckt
   THEN schliesst die Lightbox wie bisher (unveraendertes Verhalten)

7) GIVEN die Lightbox ist im Fullscreen-Modus und zeigt Bild 3 von 5
   WHEN der User die Navigations-Pfeile (links/rechts) nutzt
   THEN navigiert die Lightbox zum naechsten/vorherigen Bild und bleibt im Fullscreen-Modus

8) GIVEN die Lightbox ist im Fullscreen-Modus
   WHEN der User die Lightbox ueber den Close-Button schliesst und erneut oeffnet
   THEN startet die Lightbox im Normal-Modus (Fullscreen-State wird nicht persistiert)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/lightbox/__tests__/lightbox-modal.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('LightboxModal Fullscreen', () => {
  // AC-1: Fullscreen aktivieren
  it.todo('should switch to fullscreen mode when toggle button is clicked in normal mode')

  // AC-2: Fullscreen deaktivieren
  it.todo('should switch back to normal mode when toggle button is clicked in fullscreen mode')

  // AC-3: Maximize2 Icon im Normal-Modus
  it.todo('should show Maximize2 icon next to close button in normal mode')

  // AC-4: Minimize2 Icon im Fullscreen-Modus
  it.todo('should show Minimize2 icon in fullscreen mode')

  // AC-5: ESC im Fullscreen kehrt zu Normal zurueck
  it.todo('should return to normal mode when ESC is pressed in fullscreen mode')

  // AC-6: ESC im Normal-Modus schliesst Lightbox
  it.todo('should close lightbox when ESC is pressed in normal mode')

  // AC-7: Navigation bleibt im Fullscreen
  it.todo('should keep fullscreen mode when navigating between images')

  // AC-8: Fullscreen-State wird nicht persistiert
  it.todo('should open in normal mode after closing and reopening')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| -- | Keine Abhaengigkeiten | -- | -- |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `LightboxModal` (erweitert) | Component | Workspace Gallery | Unveraenderte Props-Signatur `LightboxModalProps` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/lightbox/lightbox-modal.tsx` -- Fullscreen-Toggle-State, bedingtes Rendering (Normal vs. Fullscreen CSS-Klassen), angepasste ESC-Logik, Maximize2/Minimize2 Icons
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Keine Navigation-Logik aendern (Pfeile werden extern gesteuert, falls vorhanden)
- Kein neuer State-Context oder Zustand ausserhalb der Komponente
- Keine Aenderungen am Details-Panel-Inhalt
- Props-Interface `LightboxModalProps` bleibt unveraendert

**Technische Constraints:**
- Fullscreen ist ein lokaler `useState`-Boolean, kein persistierter State
- CSS-only Toggle: `object-contain` + voller Viewport vs. `max-h-[70vh]`
- Icons: `Maximize2` und `Minimize2` aus `lucide-react` (bereits als Dependency vorhanden)
- ESC-Handler muss priorisiert werden: Im Fullscreen zuerst zurueck zu Normal, im Normal-Modus Lightbox schliessen

**Referenzen:**
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` --> Migration Map #10, NFR "Lightbox fullscreen responsiveness"
- Wireframes: `specs/phase-1/2026-03-07-quality-improvements/wireframes.md` --> Screen "Lightbox (Normal Mode)" und "Lightbox (Fullscreen Mode)"
- Discovery: `specs/phase-1/2026-03-07-quality-improvements/discovery.md` --> Flow 7 "Lightbox Vollbild"
