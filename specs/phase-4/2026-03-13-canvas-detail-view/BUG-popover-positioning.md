# Bug: Tool-Popovers falsch positioniert (alle am oberen Rand)

**Entdeckt:** 2026-03-14
**Status:** 🔴 Neu
**Priority:** Hoch
**Location:** `components/canvas/canvas-detail-view.tsx:407-427`, `components/canvas/popovers/*.tsx`

---

## Problembeschreibung

Alle drei Tool-Popovers (Variation, img2img, Upscale) erscheinen an der gleichen Position: oben links, direkt am Header-Rand. Sie ueberdecken die Toolbar-Leiste und sind nicht neben ihrem jeweiligen Icon positioniert.

Ursache: Die `PopoverAnchor`-Elemente sind unsichtbare `<span>`-Tags ohne spezifische Positionierung. Alle Popovers sind als Geschwister der Toolbar im `<aside>` gerendert, ihre Anchors haben keine Beziehung zu den Tool-Icons.

## Reproduktion

1. Oeffne die Detail-View
2. Klicke auf Variation-Icon (1. Icon) → Popover erscheint oben an Header-Linie
3. Klicke auf img2img-Icon (2. Icon) → Popover erscheint an gleicher Stelle
4. Klicke auf Upscale-Icon (3. Icon) → Popover erscheint an gleicher Stelle

## Erwartetes Verhalten

- Jedes Popover erscheint rechts neben seinem jeweiligen Tool-Icon
- Variation-Popover: neben dem 1. Icon
- img2img-Popover: neben dem 2. Icon
- Upscale-Popover: neben dem 3. Icon
- Popovers ueberdecken NICHT die Toolbar

## Tatsaechliches Verhalten

- Alle Popovers kleben oben am Header
- Popovers ueberdecken die Toolbar-Icons
- Keine visuelle Zuordnung zwischen Icon und Popover

## Test-Evidenz

- Screenshot: img2img-Popover ueberdeckt Toolbar, positioniert am Header-Rand
- Code `canvas-detail-view.tsx:407-427`: Popovers sind als Geschwister der Toolbar im `<aside>` gerendert
- Code `variation-popover.tsx:108-112`: Anchor ist `absolute` ohne top/left
- Code `img2img-popover.tsx:294-296`: Anchor ist `sr-only` (Screen-Reader only)
- Code `upscale-popover.tsx:103-105`: Anchor ist leerer `<span>`

## Loesungsansatz

**Option A: Anchor ans Icon binden** — Jeder `ToolbarButton` erhaelt eine ref, die als Popover-Anchor genutzt wird. Die Popovers werden neben den Buttons gerendert statt als separate Elemente in der Aside.

**Option B: Radix Popover Trigger** — Statt `PopoverAnchor` den Toolbar-Button selbst als `PopoverTrigger` verwenden. Das bindet das Popover automatisch an die Position des Buttons.

## Naechste Schritte

1. [ ] Architektur-Entscheidung: Anchor-ref vs. PopoverTrigger
2. [ ] Popovers neben ihren jeweiligen Icons positionieren
3. [ ] Testen: Alle 3 Popovers erscheinen neben dem korrekten Icon
