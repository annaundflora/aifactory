# Slice 6: MaskCanvas + SAM Zoom-Koordinaten-Fix

> **Slice 6 von 9** fuer `Canvas Zoom & Pan`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-06-mask-zoom-fix` |
| **Test** | `pnpm test __tests__/components/canvas/mask-canvas.test.tsx __tests__/components/canvas/canvas-detail-view-sam.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-zoom-hook-transform"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test __tests__/components/canvas/mask-canvas.test.tsx __tests__/components/canvas/canvas-detail-view-sam.test.tsx` |
| **Integration Command** | -- |
| **Acceptance Command** | -- |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | -- |
| **Mocking Strategy** | `mock_external` (CanvasDetailContext mocken fuer zoomLevel-Injektion) |

---

## Ziel

Pointer-Koordinaten in `mask-canvas.tsx` und SAM-Click-Koordinaten in `canvas-detail-view.tsx` durch `zoomLevel` dividieren, damit Mask-Striche und SAM-Klicks bei allen Zoom-Stufen korrekt auf der Bildposition unter dem Cursor landen. `syncCanvasSize` muss die natuerlichen (nicht-transformierten) Bild-Dimensionen verwenden statt der durch CSS-Transform skalierten `getBoundingClientRect`-Werte.

---

## Acceptance Criteria

1) GIVEN MaskCanvas bei zoomLevel=2.0 und ein Pointer-Event bei clientX=300, clientY=200 (Canvas rect.left=100, rect.top=50)
   WHEN `getCanvasCoords` aufgerufen wird
   THEN x === 100, y === 75 (Formel: (clientX - rect.left) / zoomLevel → (300-100)/2=100, (200-50)/2=75)

2) GIVEN MaskCanvas bei zoomLevel=1.0 (Fit)
   WHEN `getCanvasCoords` aufgerufen wird mit clientX=300, clientY=200 (Canvas rect.left=100, rect.top=50)
   THEN x === 200, y === 150 (Division durch 1.0 aendert nichts -- Rueckwaertskompatibilitaet)

3) GIVEN MaskCanvas bei zoomLevel=2.0, Bild naturalWidth=800, naturalHeight=600
   WHEN `syncCanvasSize` aufgerufen wird
   THEN canvas.width === 800, canvas.height === 600 (natuerliche Dimensionen, NICHT die von getBoundingClientRect zurueckgegebenen 1600x1200)

4) GIVEN MaskCanvas mit existierenden Mask-Daten und Container-Resize bei zoomLevel=1.5
   WHEN `syncCanvasSize` aufgerufen wird
   THEN existierende Mask-Daten werden skaliert auf die neuen Canvas-Dimensionen beibehalten (bestehendes Preserve-Verhalten bleibt intakt)

5) GIVEN canvas-detail-view.tsx mit isClickEditActive=true, zoomLevel=2.0 und ein Klick bei clientX=500, clientY=400 (imgElement rect.left=100, rect.top=50, rect.width=1600, rect.height=1200)
   WHEN `handleClickEditImageClick` aufgerufen wird
   THEN click_x === (500-100) / zoomLevel / (naturalWidth) und click_y === (400-50) / zoomLevel / (naturalHeight) — normalisierte Koordinaten beziehen sich auf die un-transformierten Bild-Dimensionen

6) GIVEN canvas-detail-view.tsx mit isClickEditActive=true, zoomLevel=1.0
   WHEN `handleClickEditImageClick` aufgerufen wird
   THEN normalisierte Koordinaten sind identisch zum bisherigen Verhalten (Rueckwaertskompatibilitaet bei Fit-Zoom)

7) GIVEN MaskCanvas bei zoomLevel=3.0 (Maximum) und ein Mask-Strich von Punkt A nach Punkt B
   WHEN der Strich gezeichnet wird
   THEN landen die gezeichneten Pixel exakt auf den Bildkoordinaten unter dem Cursor (kein Offset-Drift bei hohem Zoom)

8) GIVEN canvas-detail-view.tsx mit zoomLevel=2.0 und ein Klick ausserhalb der un-transformierten Bild-Bounds
   WHEN `handleClickEditImageClick` aufgerufen wird
   THEN wird der Klick ignoriert (Bounds-Check verwendet zoom-kompensierte Koordinaten)

---

## Test Skeletons

### Test-Datei: `__tests__/components/canvas/mask-canvas.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('MaskCanvas - Zoom Coordinate Compensation', () => {
  // AC-1: getCanvasCoords dividiert durch zoomLevel
  it.todo('should divide pointer offset by zoomLevel in getCanvasCoords at zoom 2.0')

  // AC-2: getCanvasCoords bei zoomLevel 1.0 (Rueckwaertskompatibilitaet)
  it.todo('should return unchanged coordinates when zoomLevel is 1.0')

  // AC-3: syncCanvasSize verwendet natuerliche Dimensionen
  it.todo('should set canvas dimensions to natural image size, not transformed size')

  // AC-4: syncCanvasSize bewahrt existierende Mask-Daten
  it.todo('should preserve and rescale existing mask data during syncCanvasSize')

  // AC-7: Kein Offset-Drift bei zoomLevel 3.0
  it.todo('should produce correct coordinates at maximum zoom level 3.0')
})
```
</test_spec>

### Test-Datei: `__tests__/components/canvas/canvas-detail-view-sam.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('handleClickEditImageClick - Zoom Compensation', () => {
  // AC-5: SAM-Klick normalisiert mit Zoom-Kompensation
  it.todo('should compute zoom-compensated normalized coordinates for SAM at zoom 2.0')

  // AC-6: SAM-Klick bei zoomLevel 1.0 (Rueckwaertskompatibilitaet)
  it.todo('should produce identical normalized coordinates at zoomLevel 1.0')

  // AC-8: Klick ausserhalb Bild-Bounds wird ignoriert
  it.todo('should ignore clicks outside un-transformed image bounds at zoom 2.0')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-zoom-state` | `zoomLevel` | State-Feld | `state.zoomLevel` via `useCanvasDetail()` |
| `slice-02-zoom-hook-transform` | Transform-Wrapper | DOM-Element | MaskCanvas liegt innerhalb des Transform-Wrappers (CSS scale wirkt auf getBoundingClientRect) |
| `slice-02-zoom-hook-transform` | CanvasImage forwardRef | Ref | `imageRef` fuer naturalWidth/naturalHeight Zugriff |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Zoom-korrekte `getCanvasCoords` | Funktion (intern) | -- (kein externer Consumer) | Interne Funktion in mask-canvas.tsx |
| Zoom-korrekte SAM-Koordinaten | Funktion (intern) | -- (kein externer Consumer) | Interne Funktion in canvas-detail-view.tsx |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/mask-canvas.tsx` -- MODIFY: `getCanvasCoords` um zoomLevel-Division erweitern, `syncCanvasSize` auf natuerliche Bild-Dimensionen umstellen statt transformierter getBoundingClientRect-Werte
- [ ] `components/canvas/canvas-detail-view.tsx` -- MODIFY: `handleClickEditImageClick` Koordinaten-Normalisierung um zoomLevel-Kompensation erweitern, Bounds-Check anpassen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN neues Brush-Cursor-Scaling (liegt im Transform-Wrapper, skaliert automatisch via CSS)
- KEINE Aenderung an der Draw-Logik (drawStroke, drawDot bleiben unveraendert)
- KEINE Touch-Gesten-Logik (kommt in Slice 5/7)
- KEINE Aenderung an syncCanvasPosition (Position wird weiterhin via getBoundingClientRect relativ zum Parent berechnet -- CSS Transform beeinflusst Parent-Relative-Werte nicht)
- KEIN Zoom-State oder Reducer-Aenderungen (Slice 1)
- KEIN Transform-Wrapper-Code (Slice 2)

**Technische Constraints:**
- `zoomLevel` wird via `useCanvasDetail()` gelesen (bereits in mask-canvas.tsx importiert)
- `getCanvasCoords`: `(e.clientX - rect.left) / zoomLevel` — rect gibt transformierte Werte, Division hebt die Skalierung auf
- `syncCanvasSize`: `img.naturalWidth` / `img.naturalHeight` verwenden statt `rect.width` / `rect.height`
- `handleClickEditImageClick`: Normalisierung muss `naturalWidth`/`naturalHeight` des Image-Elements verwenden statt `clientWidth`/`clientHeight` (die bei CSS-Transform skaliert sind)
- Bestehende Mask-Daten-Preserve-Logik in syncCanvasSize muss funktional bleiben

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/canvas/mask-canvas.tsx` | MODIFY: getCanvasCoords (Zeile ~354), syncCanvasSize (Zeile ~189). Bestehende Draw-Logik, Undo-Stack, Cursor-Drawing bleiben unberuehrt |
| `components/canvas/canvas-detail-view.tsx` | MODIFY: handleClickEditImageClick (Zeile ~451). Bestehende SAM-Flow-Logik (executeSamSegment, Dialog) bleibt unberuehrt |

**Referenzen:**
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Architecture Detail: MaskCanvas Koordinaten-Fix"
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Constraints & Integrations" -> "Pointer-Koordinaten muessen Zoom/Pan rueckrechnen"
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Constraints & Integrations" -> "SAM Click-Koordinaten"
- Architecture: `specs/phase-8/2026-04-10-canvas-zoom/architecture.md` -> Section "Migration Map" -> mask-canvas.tsx Zeile
