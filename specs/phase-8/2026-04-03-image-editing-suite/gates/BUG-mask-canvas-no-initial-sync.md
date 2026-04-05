# Bug: Mask Canvas synchronisiert sich nicht beim Mount

**Entdeckt:** 2026-04-05
**Status:** ✅ Behoben (73d772c)
**Priority:** Hoch
**Location:** `components/canvas/mask-canvas.tsx:261-279`

---

## Problembeschreibung

Wenn der User "Brush Edit" klickt und das MaskCanvas-Component zum ersten Mal mounted, bleibt das HTML5 Canvas auf den Default-Dimensionen (300x150) statt sich an die Bildgroesse (z.B. 1024x1024) anzupassen. Die Maske ist dadurch unsichtbar/falsch positioniert und Malen funktioniert nicht.

## Reproduktion

1. Projekt oeffnen, Bild in Canvas Detail View oeffnen
2. "Brush Edit" Button klicken
3. Versuchen auf dem Bild zu malen
4. -> Canvas hat 300x150 Dimensionen statt Bildgroesse
5. -> Maske ist fehlerhaft positioniert (Offset)
6. -> Window Resize (manuell) triggered korrekte Synchronisierung

## Erwartetes Verhalten

- Canvas synchronisiert sich sofort beim Mount auf die Bildgroesse
- Position stimmt exakt mit dem Bild ueberein
- Malen funktioniert direkt nach dem Klick auf "Brush Edit"

## Tatsaechliches Verhalten

- Canvas bleibt auf 300x150 (HTML Canvas Default)
- Position ist falsch (zentriert im Parent statt ueber dem Bild)
- Erst ein Window-Resize-Event triggered die korrekte Synchronisierung

## Test-Evidenz

- `document.querySelector('[data-testid="mask-canvas"]').width` === 300 (erwartet: 1024)
- `document.querySelector('[data-testid="mask-canvas"]').height` === 150 (erwartet: 1024)
- Nach `window.dispatchEvent(new Event('resize'))`: Canvas 1024x1024 korrekt

## Root Cause Analyse

`mask-canvas.tsx:261-279`: Der ResizeObserver-useEffect hat stabile Dependencies (`[imageRef, syncCanvasSize, syncCanvasPosition]`), lauft also nur einmal beim Mount. Wenn `imageRef.current` zu diesem Zeitpunkt `null` ist (React-Timing: Child-Effects laufen vor Parent-Effects), wird der Observer nie aufgesetzt und die initiale Synchronisierung uebersprungen.

**Vermuteter Fix:** Einen zusaetzlichen Effect oder Callback-Ref verwenden, der auf Aenderungen von `imageRef.current` reagiert, z.B.:
- `MutationObserver` oder `requestAnimationFrame`-Loop beim Mount
- Oder `imageRef` durch ein State-basiertes Pattern ersetzen (statt `useRef` + parent-seitiges `useEffect`)

## Naechste Schritte

1. [x] Fix: Canvas-Sizing beim MaskCanvas-Mount zuverlaessig triggern — rAF retry loop gated by editMode (73d772c)
2. [x] Verifizieren dass der Fix auch bei langsamen Image-Loads funktioniert — rAF retries bis imageRef verfuegbar
3. [x] Regressionstest: Window-Resize-Sync darf nicht brechen — separater useEffect bleibt unveraendert
