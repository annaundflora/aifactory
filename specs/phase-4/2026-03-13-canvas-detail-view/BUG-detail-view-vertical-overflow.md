# Bug: Bild + Thumbnails uebersteigen Viewport-Hoehe (vertikaler Overflow)

**Entdeckt:** 2026-03-13
**Status:** 🔴 Neu
**Priority:** Hoch
**Location:** `components/canvas/canvas-detail-view.tsx:435`, `components/canvas/canvas-image.tsx:57,97`

---

## Problembeschreibung

Bei grossen Bildern (besonders Hochformat) uebersteigt die Kombination aus Bild + Sibling-Thumbnails die verfuegbare Viewport-Hoehe. Der User muss vertikal scrollen, was in einer Fullscreen-Detail-View nicht passieren sollte.

Das Bild sollte sich an den verfuegbaren Platz anpassen: so gross wie moeglich, aber nie groesser als der Viewport (minus Header, Padding, Thumbnails).

## Reproduktion

1. Oeffne die Detail-View fuer ein Hochformat-Bild (z.B. Portraet)
2. Beobachte: Bild ist groesser als der verfuegbare Platz
3. Beobachte: Thumbnails werden nach unten aus dem Viewport geschoben
4. Vertikales Scrollen ist noetig um Thumbnails zu sehen

## Erwartetes Verhalten

- Bild passt sich an verfuegbare Hoehe an (Header-Hoehe - Padding - Thumbnail-Hoehe)
- Kein vertikales Scrollen in der Detail-View
- Thumbnails sind immer sichtbar am unteren Rand

## Tatsaechliches Verhalten

- Bild ueberfliesst den Container vertikal
- Thumbnails werden teilweise oder ganz aus dem sichtbaren Bereich geschoben

## Test-Evidenz

- Screenshot: Thumbnails am unteren Bildschirmrand abgeschnitten
- Code: `canvas-detail-view.tsx:435` — Image-Wrapper hat `flex-1` ohne `min-h-0`:
  ```tsx
  <div className="relative flex flex-1 items-center justify-center p-4">
  ```
  Klassisches Flexbox-Problem: `flex-1` ohne `min-h-0` erlaubt dem Content die Container-Grenzen zu ueberschreiten.
- Code: `canvas-image.tsx:57` — Container hat `h-full w-full` aber die Flex-Kette liefert keine korrekte Hoehen-Beschraenkung
- Code: `canvas-image.tsx:97` — `max-h-full` auf dem img-Element greift nicht, weil der Parent keine beschraenkte Hoehe hat

## Loesungsansatz

1. `min-h-0` auf den Image-Wrapper hinzufuegen (`canvas-detail-view.tsx:435`):
   ```tsx
   <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
   ```
2. Eventuell `min-h-0` auch auf den `<main>` Container (`canvas-detail-view.tsx:430`):
   ```tsx
   <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/40">
   ```
3. Sicherstellen, dass die gesamte Flex-Kette von SidebarInset bis zum img-Element `min-h-0` hat wo noetig

## Naechste Schritte

1. [ ] `min-h-0` an den relevanten Flex-Containern hinzufuegen
2. [ ] Testen mit verschiedenen Bild-Formaten (Hochformat, Querformat, Quadrat)
3. [ ] Sicherstellen, dass Thumbnails immer sichtbar bleiben
