# Slice Decomposition

**Feature:** iPad Canvas Download Fix + Gallery Scroll Restore
**Issue:** #25
**Discovery-Slices:** 2 (iPad-safe Download, Gallery Scroll Restore)
**Atomare Slices:** 4
**Stack:** TypeScript/Next.js (React 19, vitest, Playwright)

---

## Dependency Graph

```
slice-01 (downloadImage Web Share)    slice-03 (Scroll Save/Restore Refs)
     |                                      |
     v                                      v
slice-02 (canvas-toolbar AbortError)  slice-04 (Scroll Wiring in Handlers)
```

- Slice 01 und 03 sind voneinander unabhaengig (parallele Tracks).
- Slice 02 haengt von 01 ab (braucht neues Verhalten von `downloadImage`).
- Slice 04 haengt von 03 ab (braucht die Refs aus Slice 03).

---

## Slice-Liste

### Slice 01: downloadImage -- Web Share API Branch

- **Scope:** `downloadImage()` in `lib/utils.ts` erweitern: Nach Blob-Fetch ein `File`-Objekt erstellen, `navigator.canShare({files})` pruefen. Bei `true`: `navigator.share({files})` aufrufen, danach `revokeObjectURL`. Bei `false`: bestehender Anchor-Click-Pfad. `AbortError` (User schliesst Share-Sheet) wird als Non-Error behandelt (kein throw). Signatur bleibt unveraendert: `(url: string, filename: string) => Promise<void>`.
- **Deliverables:**
  - `lib/utils.ts` (Funktion `downloadImage` erweitern, ~L53-73)
  - `lib/__tests__/download-utils.test.ts` (neue Tests: Web Share Branch, Anchor Fallback, AbortError silent)
- **Done-Signal:** `vitest run lib/__tests__/download-utils.test.ts` -- alle bestehenden Tests gruen + 3 neue Tests: (1) Web Share API wird aufgerufen wenn `canShare` true, (2) Anchor-Fallback wenn `canShare` false/undefined, (3) AbortError von `navigator.share()` wird nicht geworfen
- **Dependencies:** []
- **Discovery-Quelle:** Slice 1 "iPad-safe Download"

---

### Slice 02: canvas-toolbar -- AbortError-Handling im Download-Handler

- **Scope:** `handleDownload` in `canvas-toolbar.tsx` anpassen: Da `downloadImage()` aus Slice 01 bei AbortError nicht mehr wirft, muss sichergestellt sein, dass der catch-Block nur echte Fehler abfaengt. Pruefen ob aktueller catch-Block kompatibel ist (catch ohne Error-Typ-Check). Falls `downloadImage` bei AbortError still resolved (void), ist kein Change noetig -- dann ist dieser Slice ein reiner Verifikations-Slice mit Test. Falls doch Anpassung noetig: Error-Typ-Check im catch-Block.
- **Deliverables:**
  - `components/canvas/canvas-toolbar.tsx` (handleDownload ~L87-101, ggf. Error-Typ-Pruefung)
  - `components/canvas/__tests__/canvas-toolbar.test.tsx` (neuer Test: Download-Button bei Share-Sheet-Dismiss zeigt keinen Error-Toast)
- **Done-Signal:** `vitest run components/canvas/__tests__/canvas-toolbar.test.tsx` -- alle bestehenden Tests gruen + neuer Test: Nach `downloadImage` resolves (AbortError-Fall), wird `toast.error` NICHT aufgerufen, `isDownloading` wird auf false gesetzt
- **Dependencies:** ["slice-01"]
- **Discovery-Quelle:** Slice 1 "iPad-safe Download"

---

### Slice 03: Gallery Scroll -- Refs am Container

- **Scope:** Zwei `useRef`-Hooks in `workspace-content.tsx` hinzufuegen: `galleryScrollRef` (HTMLDivElement) fuer den Gallery-Scroll-Container (L404) und `scrollTopRef` (number, default 0) fuer den gespeicherten Scroll-Wert. `ref={galleryScrollRef}` auf das Gallery-Container-`div` setzen.
- **Deliverables:**
  - `components/workspace/workspace-content.tsx` (2x useRef + ref-Attribut auf Gallery-Container, ~3 Zeilen Aenderung)
- **Done-Signal:** `vitest run components/workspace/__tests__/workspace-content-detail.test.tsx` -- alle bestehenden Tests gruen (kein Regressionsbruch durch Ref-Hinzufuegung). Manuell verifizierbar: Gallery-Container hat `ref` im DOM.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 2 "Gallery Scroll Restore"

---

### Slice 04: Gallery Scroll -- Save/Restore in Handlers

- **Scope:** `handleSelectGeneration` erweitern: Vor `setDetailViewOpen(true)` den aktuellen `galleryScrollRef.current.scrollTop` in `scrollTopRef.current` speichern. `handleDetailViewClose` erweitern: Nach `setDetailViewOpen(false)` via `requestAnimationFrame` den `galleryScrollRef.current.scrollTop` auf `scrollTopRef.current` setzen. Beachte: `startViewTransitionIfSupported()` wrapped den State-Update -- `requestAnimationFrame` muss nach dem Callback laufen.
- **Deliverables:**
  - `components/workspace/workspace-content.tsx` (handleSelectGeneration ~L297-305 + handleDetailViewClose ~L307-312)
  - `components/workspace/__tests__/workspace-content-detail.test.tsx` (neue Tests: scrollTop wird gespeichert bei Canvas-Open, scrollTop wird wiederhergestellt bei Canvas-Close)
- **Done-Signal:** `vitest run components/workspace/__tests__/workspace-content-detail.test.tsx` -- alle bestehenden Tests gruen + 2 neue Tests: (1) Bei Canvas-Open wird scrollTop des Gallery-Containers gelesen und gespeichert, (2) Bei Canvas-Close + requestAnimationFrame wird scrollTop auf gespeicherten Wert gesetzt
- **Dependencies:** ["slice-03"]
- **Discovery-Quelle:** Slice 2 "Gallery Scroll Restore"

---

## Flow-Traceability

| Discovery-Slice | Integration-Testfall | Abgedeckt in Slice | Done-Signal |
|-----------------|----------------------|--------------------|-------------|
| 1 "iPad-safe Download" | Manuell auf iPad: Download oeffnet Share-Sheet statt Quick Look. Canvas bleibt offen. | slice-01 (Web Share Branch) + slice-02 (Toolbar-Integration) | vitest: Web Share API wird aufgerufen wenn canShare true; AbortError wird nicht als Toast gezeigt |
| 1 "iPad-safe Download" | Desktop: Download funktioniert wie bisher. | slice-01 (Anchor Fallback) | vitest: Anchor-Fallback wenn canShare false/undefined; bestehende Tests gruen |
| 2 "Gallery Scroll Restore" | Manuell: Galerie scrollen, Canvas oeffnen, zurueck, Scroll-Position wiederhergestellt. | slice-03 (Refs) + slice-04 (Save/Restore Wiring) | vitest: scrollTop gespeichert bei Open, wiederhergestellt bei Close via requestAnimationFrame |

---

## Qualitaets-Checkliste

- [x] Jeder Slice hat maximal 3 produktive Deliverable-Dateien (max 2 pro Slice)
- [x] Jeder Slice hat ein messbares Done-Signal (vitest-Kommando + Testkriterien)
- [x] Dependencies sind azyklisch (DAG): 01->02, 03->04, keine Zyklen
- [x] Alle Deliverables aus der Discovery sind abgedeckt: `lib/utils.ts`, `canvas-toolbar.tsx`, `workspace-content.tsx`
- [x] Kein Slice hat mehr als ein Concern (Download-Logik vs. Toolbar-Integration vs. Refs vs. Handler-Wiring)
- [x] Schema/Service-Slices kommen vor UI-Slices (Utility vor Component)
- [x] Stack ist korrekt erkannt: TypeScript/Next.js, vitest
- [x] Flow-Completeness: Alle Integration-Testfaelle aus Discovery haben zugehoerige Slices
