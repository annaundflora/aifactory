# Bug: Details-Overlay wird nicht gerendert

**Entdeckt:** 2026-03-14
**Status:** 🔴 Neu
**Priority:** Hoch
**Location:** `components/canvas/canvas-detail-view.tsx`

---

## Problembeschreibung

Die `DetailsOverlay`-Komponente (`components/canvas/details-overlay.tsx`) existiert und ist korrekt implementiert, wird aber in `canvas-detail-view.tsx` weder importiert noch gerendert. Klick auf das Details-Icon in der Toolbar toggelt nur `activeToolId = "details"` im Context, aber kein UI wird sichtbar.

## Reproduktion

1. Oeffne die Detail-View
2. Klicke auf das Details-Icon (unterstes Icon, Info-Symbol)
3. Beobachte: Nichts passiert visuell, nur das Icon zeigt active-state

## Erwartetes Verhalten

- Details-Overlay erscheint am oberen Rand des Canvas-Bereichs
- Zeigt: Prompt, Model, Steps, CFG, Seed, Size, ProvenanceRow
- Push-down-Layout: schiebt Canvas-Inhalt nach unten
- Erneuter Klick schliesst Overlay

## Tatsaechliches Verhalten

- Kein Overlay sichtbar
- `DetailsOverlay` nicht importiert in `canvas-detail-view.tsx`

## Test-Evidenz

- `Grep "DetailsOverlay|details-overlay" canvas-detail-view.tsx` → Kein Treffer
- `details-overlay.tsx` existiert mit korrekter Implementierung (Zeile 61-160)
- `canvas-detail-view.tsx` importiert alle anderen Komponenten (Toolbar, Popovers, Chat, Navigation, Siblings) aber nicht DetailsOverlay

## Loesungsansatz

1. `DetailsOverlay` in `canvas-detail-view.tsx` importieren
2. Im `<main>` Tag vor dem Image-Bereich rendern:
   ```tsx
   <DetailsOverlay generation={currentGeneration} />
   ```
3. Position: Oberhalb der Image-Area im flex-col Layout

## Naechste Schritte

1. [ ] `DetailsOverlay` importieren und im Canvas-Layout einbinden
2. [ ] Testen: Push-down-Layout korrekt (Canvas verschiebt sich nach unten)
