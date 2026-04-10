# Feature: iPad Canvas Download Fix + Gallery Scroll Restore

**Epic:** --
**Issue:** #25
**Status:** Ready
**Wireframes:** -- (Bug fixes, no wireframes needed)

---

## Problem & Solution

**Problem:**
- iPad Safari: Download im Canvas navigiert die Seite zur Blob-URL (Quick Look Preview) statt direkt zu downloaden. Beim Schliessen der Preview wird die SPA neu geladen und der Canvas schliesst sich.
- Alle Geraete: Galerie-Scroll-Position geht verloren beim Rueckkehren aus dem Canvas, weil kein Save/Restore-Mechanismus existiert.

**Solution:**
- Bug 1: Web Share API (`navigator.share()`) auf iOS/iPadOS statt Anchor-Click. Nativer Share-Sheet oeffnet sich (mit "In Fotos speichern"). Kein Page-Navigation.
- Bug 2: `scrollTop` des Galerie-Containers speichern bei Canvas-Open, wiederherstellen bei Canvas-Close.

**Business Value:**
- iPad-User koennen Bilder downloaden ohne Canvas-Kontext zu verlieren
- Galerie-Navigation ist fluessig ohne Scroll-Verlust auf allen Geraeten

---

## Scope & Boundaries

| In Scope |
|----------|
| Web Share API fuer Image-Download auf iOS/iPadOS |
| Feature Detection (`navigator.share` + `navigator.canShare`) statt User-Agent-Sniffing |
| Fallback auf bestehenden Anchor-Download wenn Web Share nicht verfuegbar |
| Gallery Scroll-Position speichern/wiederherstellen bei Canvas-Open/Close |

| Out of Scope |
|--------------|
| Download-UX auf Desktop aendern (funktioniert bereits) |
| Share-Sheet auf Desktop/Android einfuehren |
| Scroll-Virtualisierung der Galerie |
| Scroll-Position ueber Page-Reloads persistieren (localStorage) |

---

## Current State Reference

- Download-Funktion existiert: `lib/utils.ts:53-73` (`downloadImage()` mit Anchor-Click)
- Download-Button im Canvas: `components/canvas/canvas-toolbar.tsx:87-101` (`handleDownload()`)
- Canvas-Overlay: `components/workspace/workspace-content.tsx:326` (fixed z-50 overlay)
- Gallery hidden via `display: none`: `components/workspace/workspace-content.tsx:344`
- Gallery Scroll Container: `components/workspace/workspace-content.tsx:~404` (`overflow-y-auto`)
- Canvas close handler: `components/workspace/workspace-content.tsx:307-312` (`handleDetailViewClose`)
- Toast error handling bei Download-Fehler (existiert bereits)

---

## UI Patterns

### Reused Patterns

| Pattern Type | Component | Usage in this Feature |
|--------------|-----------|----------------------|
| Toast | `sonner` toast | Download-Fehler Feedback (existiert) |
| Download Button | `canvas-toolbar.tsx` | Trigger fuer Download (existiert) |

### New Patterns

| Pattern Type | Description | Rationale |
|--------------|-------------|-----------|
| Platform-aware Download | iOS: Web Share API, Desktop: Anchor-Click | Safari navigiert bei Anchor-Click mit Blob-URL weg |
| Scroll Position Restore | Ref-basierter scrollTop Save/Restore | Browser stellt Scroll bei display:none Toggle nicht automatisch her |

---

## User Flow

### Flow 1: Download auf iPad (SOLL)

1. User klickt Download-Button im Canvas-Toolbar
2. System fetcht Bild als Blob (Spinner auf Button)
3. System erkennt iOS via Feature Detection (`navigator.canShare({ files: [...] })`)
4. System ruft `navigator.share({ files: [imageFile] })` auf
5. Natives iOS Share-Sheet oeffnet sich (Fotos speichern, AirDrop, etc.)
6. User waehlt Aktion oder schliesst Share-Sheet
7. Canvas bleibt offen, Spinner verschwindet

### Flow 2: Download auf Desktop (unveraendert)

1. User klickt Download-Button
2. System fetcht Bild als Blob, erstellt Anchor-Element, triggert Click
3. Browser-Download-Dialog oeffnet sich
4. Datei wird gespeichert

### Flow 3: Gallery Scroll Restore (SOLL)

1. User scrollt in Galerie zu bestimmter Position
2. User klickt auf Bild → Canvas oeffnet sich
3. System speichert `scrollTop` des Gallery-Scroll-Containers
4. Gallery wird via `display: none` versteckt
5. User arbeitet im Canvas
6. User klickt Back → Canvas schliesst sich
7. Gallery wird sichtbar, System setzt `scrollTop` auf gespeicherten Wert
8. User sieht Galerie an gleicher Scroll-Position wie vorher

**Error Paths:**
- Web Share API nicht verfuegbar → Fallback auf Anchor-Download
- Blob-Fetch schlaegt fehl → Toast "Download fehlgeschlagen" (existiert)
- User bricht Share-Sheet ab → `navigator.share()` rejected mit `AbortError` → silent catchen (kein Toast), Canvas bleibt offen

---

## UI Layout & Context

### Screen: Canvas (Download-Aenderung)

**Position:** Canvas-Toolbar, Download-Button (unveraendert)
**When:** User klickt Download-Button auf iOS-Geraet

**Layout:**
- Keine Layout-Aenderung
- Statt Browser-Navigation oeffnet sich natives Share-Sheet (iOS-System-UI, kein eigenes UI)

### Screen: Gallery (Scroll-Restore)

**Position:** Gallery-Grid im Workspace
**When:** User kehrt vom Canvas zur Galerie zurueck

**Layout:**
- Keine Layout-Aenderung
- Galerie startet an gespeicherter Scroll-Position statt Position 0

---

## UI Components & States

| Element | Type | Location | States | Behavior |
|---------|------|----------|--------|----------|
| Download-Button | Button | Canvas Toolbar | `idle`, `downloading` | iOS: oeffnet Share-Sheet. Desktop: triggert Anchor-Download. (Nur Download-Methode aendert sich, Button-UI bleibt gleich) |
| Gallery Scroll Container | Container | workspace-content.tsx | `scrolled`, `restored` | scrollTop wird bei Canvas-Open gespeichert, bei Canvas-Close wiederhergestellt |

---

## Feature State Machine

### States Overview (Download auf iOS)

| State | UI | Available Actions |
|-------|----|--------------------|
| `idle` | Download-Button aktiv | Download klicken |
| `downloading` | Spinner auf Button | Warten |
| `sharing` | iOS Share-Sheet offen | Share-Sheet Aktion waehlen oder abbrechen |
| `error` | Toast "Download fehlgeschlagen" | Erneut versuchen |

### Transitions (Download auf iOS)

| Current State | Trigger | UI Feedback | Next State | Business Rules |
|---------------|---------|-------------|------------|----------------|
| `idle` | Download-Button Click | Spinner startet | `downloading` | `imageUrl` muss vorhanden sein, `!isGenerating` |
| `downloading` | Fetch complete + canShare=true | -- | `sharing` | Feature Detection: `navigator.canShare({ files })` |
| `downloading` | Fetch complete + canShare=false | -- | `idle` (Anchor fallback) | Standard-Download als Fallback |
| `downloading` | Fetch error | Toast "Download fehlgeschlagen" | `error` | -- |
| `sharing` | User waehlt Aktion / schliesst Sheet | Spinner weg | `idle` | Share-Sheet Dismiss rejected mit `AbortError` → silent catchen, kein Toast |
| `error` | -- | Toast verschwindet nach Timeout | `idle` | -- |

---

## Business Rules

- iOS/iPadOS-Erkennung via Feature Detection (Post-Fetch): Blob fetchen → `File` erstellen → `navigator.canShare({ files: [file] })` pruefen. Kein separater Pre-Check mit Dummy-File noetig, da der Fetch ohnehin stattfindet
- Kein User-Agent-Sniffing
- Fallback auf Anchor-Download wenn Web Share nicht verfuegbar
- `navigator.share()` rejected mit `AbortError` wenn User Share-Sheet schliesst → als "kein Fehler" behandeln, keinen Error-Toast zeigen
- `URL.revokeObjectURL()` erst NACH Share-Abschluss (nicht sofort wie aktuell)
- Scroll-Position wird nur im Memory gehalten (useRef), nicht persistiert (kein localStorage)
- Scroll-Restore nur fuer den Gallery-Scroll-Container, kein anderer Scroll-State
- Scroll-Restore Timing: `handleDetailViewClose` nutzt `startViewTransitionIfSupported()` — nach `display: none` Entfernung braucht der Browser einen Render-Cycle bevor `scrollTop` gesetzt werden kann. `requestAnimationFrame` nach State-Update verwenden

---

## Data

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `scrollTopRef` | -- | -- | useRef<number>, Default 0. In-Memory, nicht persistiert |
| `galleryScrollRef` | -- | -- | useRef<HTMLDivElement> fuer den Scroll-Container |

---

## Implementation Slices

### Dependencies

```
Slice 1 (Download)     Slice 2 (Scroll)
     |                      |
     v                      v
  (unabhaengig)        (unabhaengig)
```

### Slices

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| 1 | iPad-safe Download | Web Share API auf iOS, Fallback Anchor-Download. `downloadImage()` refactoren oder neue `shareImage()` Funktion. `canvas-toolbar.tsx` Handler anpassen. | Manuell auf iPad: Download oeffnet Share-Sheet statt Quick Look. Canvas bleibt offen. Desktop: Download funktioniert wie bisher. | -- |
| 2 | Gallery Scroll Restore | Ref auf Gallery Scroll Container. scrollTop speichern bei Canvas-Open (`handleSelectGeneration`), wiederherstellen bei Canvas-Close (nach `display: none` entfernt). Achtung: `requestAnimationFrame` fuer Restore nach Render-Cycle noetig. | Manuell: Galerie scrollen, Canvas oeffnen, zurueck, Scroll-Position wiederhergestellt. | -- |

### Recommended Order

1. **Slice 1:** iPad-safe Download -- Kritischer Bug, Canvas schliesst sich ungewollt
2. **Slice 2:** Gallery Scroll Restore -- UX-Verbesserung, unabhaengig von Slice 1

---

## Context & Research

### Similar Patterns in Codebase

| Feature | Location | Relevant because |
|---------|----------|------------------|
| Touch drag handling | `components/workspace/generation-card.tsx` | Nutzt Pointer Events API, platform-agnostisch |
| iOS long-press prevention | `app/globals.css:167-170` | `-webkit-touch-callout: none` fuer draggable elements |
| View Transition API | `lib/utils/view-transition.ts` | Wird fuer Canvas open/close genutzt, handhabt aber kein Scroll |

### Web Research

| Source | Finding |
|--------|---------|
| [MDN: Navigator.share()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share) | Web Share API unterstuetzt File-Sharing auf iOS Safari. Benoetigt transient activation (User-Gesture). |
| [MDN: Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API) | `navigator.canShare()` fuer Feature Detection. Files-Array mit image/png unterstuetzt. |
| [WebKit Bug #167341](https://bugs.webkit.org/show_bug.cgi?id=167341) | iOS Safari hat historisch Probleme mit download-Attribut. Blob-URLs koennen Navigation statt Download ausloesen. |
| [Apple Developer Forums](https://developer.apple.com/forums/thread/729782) | Web Share API auf Safari unterstuetzt "Save to Photos" im Share-Sheet. |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| -- | Keine offenen Fragen | -- | -- | -- |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-04-10 | Codebase | `downloadImage()` in `lib/utils.ts:53-73` nutzt Anchor-Click mit Blob-URL. Sofortiges `removeChild` + `revokeObjectURL`. |
| 2026-04-10 | Codebase | Gallery Scroll Container in `workspace-content.tsx:~404` hat `overflow-y-auto` aber keinen Ref und kein Scroll-State-Management. |
| 2026-04-10 | Codebase | Gallery wird via `style={{display: "none"}}` versteckt bei Canvas-Open (`workspace-content.tsx:344`). Kein scrollTop Save/Restore. |
| 2026-04-10 | Codebase | Canvas-Close nur via `handleDetailViewClose` (`workspace-content.tsx:307-312`) oder ESC-Key (`canvas-header.tsx:86-105`). Kein popstate-Handler. |
| 2026-04-10 | Codebase | Kein User-Agent-Sniffing im Projekt. `useIsMobile()` Hook basiert auf Viewport-Breakpoint (768px). |
| 2026-04-10 | Web | iPad Safari navigiert bei Blob-URL anchor.click() zur URL statt Download. Quick Look Preview oeffnet sich. |
| 2026-04-10 | Web | Web Share API (`navigator.share({ files })`) funktioniert auf iOS Safari und oeffnet natives Share-Sheet mit "In Fotos speichern". |
| 2026-04-10 | Web | Browser stellt scrollTop bei `display: none` → visible Wechsel nicht automatisch her. Manuelles Save/Restore noetig. |
| 2026-04-10 | Web | `navigator.share()` rejected mit `AbortError` wenn User Share-Sheet dismissed. Muss silent gefangen werden. |
| 2026-04-10 | Codebase | `handleDetailViewClose` nutzt `startViewTransitionIfSupported()` — scrollTop Restore braucht `requestAnimationFrame` nach State-Update wegen Render-Cycle. |

---

## Q&A Log

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Gibt es ein GitHub Issue zu diesen iPad-Bugs? | Nein, Issue #25 wurde in der Session erstellt. |
| 2 | Issue-Titel: 'iPad: Canvas closes on download dialog dismiss + gallery scroll position lost' -- passt das? | Ja, Issue mit diesem Titel erstellen. |
| 3 | Soll ich zuerst die Codebase recherchieren oder direkt Fragen beantworten? | Recherche zuerst. |
| 4 | Wie verhaelt sich der Download-Dialog genau auf dem iPad? | Es ist ein iPad Pro 13 M4 (2024) 7. Generation. Dialog zeigt Bild-Preview mit X und Back-Button (links oben), Share-Button (rechts oben). Nicht sicher ob Vollbild oder Popover. |
| 5 | Ist das Problem nur auf iPad oder auch auf iPhone/Safari Desktop? | Nicht getestet, nur auf iPad getestet. |
| 6 | Wenn du die Preview schliesst und der Canvas sich schliesst: Bist du dann in der Galerie zurueck, oder laedt die Seite neu? | Kurzer Ladevorgang sichtbar (bestaetigt SPA-Reload-Hypothese). |
| 7 | Passiert der Scroll-Position-Verlust auch OHNE Download? | Ja, auch ohne Download. Scroll-Position geht immer verloren beim Rueckkehren vom Canvas. |
| 8 | Download-Strategie: Web Share API auf iOS + Standard-Download auf Desktop? | Ja, Share-Sheet auf iOS, Standard-Download auf Desktop. |
| 9 | Scope: Beide Bugs zusammen oder getrennt? | Beide Bugs zusammen in einer Discovery. |
| 10 | Discovery-Tiefe? | Standard. |
