# Feature: iPad Canvas Download Fix + Gallery Scroll Restore

**Epic:** --
**Issue:** #25
**Status:** Ready
**Discovery:** `discovery.md` (same folder)
**Derived from:** Discovery constraints, NFRs, and risks

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

## API Design

N/A -- Rein clientseitige Aenderungen, keine API-Endpoints betroffen.

---

## Database Schema

N/A -- Keine Datenbank-Aenderungen.

---

## Server Logic

N/A -- Keine serverseitige Logik betroffen. Alle Aenderungen im Browser-Client.

---

## Security

### Input Validation & Sanitization

| Input | Validation | Notes |
|-------|------------|-------|
| `navigator.canShare({files})` | Browser-API validiert File-Objekt | Kein User-Input, nur programmatisch erstellte File-Objekte aus fetch-Response |
| Blob from `fetch(imageUrl)` | Response-Status-Check (`!response.ok`) | Existiert bereits in `downloadImage()` |

### Transient Activation

| Constraint | Mechanism | Notes |
|------------|-----------|-------|
| Web Share API erfordert User-Gesture | `navigator.share()` wird im `onClick`-Handler aufgerufen | Transient activation ist gegeben, da der Aufruf in der synchronen Kette ab Button-Click liegt. Fetch ist async, aber die Activation bleibt bis zum naechsten User-Idle erhalten (5s Timeout in WebKit) |

### Data Protection

| Data Type | Protection | Notes |
|-----------|------------|-------|
| Image-Blob | Wird nur in-memory gehalten | `URL.revokeObjectURL()` nach Share-Abschluss bzw. im Anchor-Fallback sofort. Kein Persistieren ausserhalb des Share-Flows |

---

## Architecture Layers

### Layer Responsibilities

| Layer | Responsibility | Pattern |
|-------|----------------|---------|
| Utility (`lib/utils.ts`) | Download/Share-Logik: Fetch, Blob-Erstellung, Plattform-Branching | Utility-Function Pattern (EXTEND bestehende `downloadImage()`) |
| Component (`canvas-toolbar.tsx`) | Download-Button Handler, Loading-State, Error-Handling | useCallback + try/catch + toast (REUSE) |
| Component (`workspace-content.tsx`) | Gallery-Scroll-Container Ref, scrollTop Save/Restore | useRef + requestAnimationFrame (REUSE + EXTEND) |

### Data Flow

```
Download (iOS):
  Button Click → handleDownload() → downloadImage(url, filename)
    → fetch(url) → blob → new File([blob])
    → navigator.canShare({files}) ?
      YES → navigator.share({files}) → Share-Sheet → revokeObjectURL
      NO  → anchor.click() → revokeObjectURL (Fallback, wie bisher)

Download (Desktop, unveraendert):
  Button Click → handleDownload() → downloadImage(url, filename)
    → fetch(url) → blob → anchor.click() → revokeObjectURL

Scroll Restore:
  Canvas Open:  handleSelectGeneration() → save galleryScrollRef.scrollTop → setDetailViewOpen(true)
  Canvas Close: handleDetailViewClose() → setDetailViewOpen(false) → requestAnimationFrame → restore scrollTop
```

### Error Handling Strategy

| Error Type | Handling | User Response | Logging |
|------------|----------|---------------|---------|
| Fetch-Fehler (Network/404) | try/catch in `downloadImage()` | `toast.error("Download fehlgeschlagen")` (existiert) | -- |
| `navigator.share()` AbortError | Catch + check `error.name === "AbortError"` | Kein Toast (User hat Share-Sheet geschlossen) | -- |
| `navigator.share()` anderer Fehler | Catch + re-throw | `toast.error("Download fehlgeschlagen")` | -- |
| ScrollTop-Restore fehlschlaegt | Ref null-check | Stille Degradation (Scroll-Position 0) | -- |

---

## Migration Map

| Existing File | Current Pattern | Target Pattern | Specific Changes |
|---|---|---|---|
| `lib/utils.ts` (L53-73) | `downloadImage()`: fetch → blob → objectURL → anchor.click() → revokeObjectURL (immediate) | `downloadImage()`: fetch → blob → File → canShare-Check → Web Share API Branch ODER Anchor-Fallback. revokeObjectURL nach async Share-Abschluss | 1. Nach `blob` Erstellung: `new File([blob], filename, {type: blob.type})` erstellen. 2. `navigator.canShare({files: [file]})` pruefen. 3. Bei `true`: `await navigator.share({files: [file]})`, dann `revokeObjectURL`. 4. Bei `false`: Bestehender Anchor-Click-Pfad. 5. AbortError im Share-Pfad fangen und ignorieren. |
| `components/canvas/canvas-toolbar.tsx` (L87-101) | `handleDownload()`: try/catch, jeder Error → `toast.error()` | Unveraendert | `downloadImage()` Signatur bleibt gleich. AbortError-Handling geschieht in `downloadImage()` selbst. Kein Change in canvas-toolbar noetig sofern AbortError als Non-Error aus downloadImage zurueckkommt. |
| `components/workspace/workspace-content.tsx` (L297-312, L344, L404) | Gallery-Container ohne Ref, kein scrollTop-Management. `handleSelectGeneration` + `handleDetailViewClose` ohne Scroll-Logik | Zwei neue useRefs: `galleryScrollRef` (HTMLDivElement) + `scrollTopRef` (number). Save in handleSelectGeneration, Restore in handleDetailViewClose via requestAnimationFrame | 1. `useRef<HTMLDivElement>(null)` fuer Gallery-Scroll-Container (L404). 2. `useRef<number>(0)` fuer scrollTop-Wert. 3. In `handleSelectGeneration`: `scrollTopRef.current = galleryScrollRef.current?.scrollTop ?? 0` VOR state-update. 4. In `handleDetailViewClose`: Nach `setDetailViewOpen(false)` ein `requestAnimationFrame` das `galleryScrollRef.current.scrollTop = scrollTopRef.current` setzt. |

---

## Constraints & Integrations

### Constraints

| Constraint | Technical Implication | Solution |
|------------|----------------------|----------|
| Kein User-Agent-Sniffing (Codebase-Konvention) | Plattform-Erkennung muss ueber Feature Detection laufen | `navigator.canShare({files: [file]})` nach Blob-Fetch. Gibt `true` zurueck wenn Browser File-Sharing unterstuetzt (iOS Safari, Android Chrome), `false` auf Desktop |
| Web Share API erfordert User-Gesture (Transient Activation) | Share muss in der Event-Handler-Kette aufgerufen werden | Download-Button onClick → fetch → share ist erlaubt solange Activation nicht abgelaufen ist (5s in WebKit). Kein async Timeout-Problem da fetch typischerweise < 5s |
| `URL.revokeObjectURL` Timing | Bei Web Share API darf objectURL nicht sofort revoked werden (Share ist async) | Anchor-Pfad: revokeObjectURL sofort (wie bisher). Share-Pfad: revokeObjectURL nach `await navigator.share()` resolved/rejected |
| Gallery `display: none` Toggle | Browser stellt scrollTop bei display-Wechsel nicht automatisch her | Manuelles Save (vor display:none) + Restore (nach display:block + requestAnimationFrame fuer naechsten Render-Cycle) |
| View Transition API im Close-Handler | `startViewTransitionIfSupported()` wrapped den State-Update; scrollTop-Restore muss NACH dem Callback laufen | requestAnimationFrame innerhalb der Callback-Kette, nach setDetailViewOpen(false) |

### Integrations

| Area | System / Capability | Interface | Version | Notes |
|------|----------------------|-----------|---------|-------|
| Web Share API | Browser-Standard | `navigator.share()`, `navigator.canShare()` | Web Share API Level 2 (Files) | iOS Safari 15+, Chrome 89+, Firefox 96+. Kein npm-Paket noetig. |
| View Transition API | Browser-Standard | `document.startViewTransition()` | CSS View Transitions Level 1 | Bereits genutzt via `startViewTransitionIfSupported()`. Keine Version-Aenderung. |
| Next.js | Frontend-Framework | -- | 16.1.6 (package.json) | Keine Aenderung am Framework noetig |
| React | UI-Library | useRef, useCallback, requestAnimationFrame | 19.2.3 (package.json) | Keine neuen Dependencies |
| sonner | Toast-Library | `toast.error()` | 2.0.7 (package.json) | REUSE: Bestehende Error-Toasts bleiben unveraendert |

---

## Quality Attributes (NFRs)

| Attribute | Target | Technical Approach | Measure / Verify |
|-----------|--------|--------------------|------------------|
| Kein Page-Navigation auf iPad | Download oeffnet Share-Sheet, Canvas bleibt offen | Web Share API statt Anchor-Click auf iOS | Manueller Test: iPad Safari, Download-Button → Share-Sheet erscheint, Canvas bleibt offen |
| Scroll-Position erhalten | Galerie zeigt gleiche Position nach Canvas-Roundtrip | useRef-basiertes scrollTop Save/Restore mit requestAnimationFrame | Manueller Test: Galerie scrollen, Canvas oeffnen, zurueck → gleiche Scroll-Position |
| Keine Regression Desktop | Desktop-Download funktioniert wie bisher (Anchor-Click) | Feature Detection: `canShare` ist `false` auf Desktop → Anchor-Fallback | Manueller Test: Desktop Chrome/Firefox, Download → Browser-Download-Dialog |
| Keine neue Dependency | Kein neues npm-Paket | Web Share API ist Browser-Standard | `package.json` diff zeigt keine neuen entries |
| Transient Activation eingehalten | Web Share API Call innerhalb 5s nach User-Gesture | fetch + share in synchroner Event-Handler-Kette | iPad-Test: Share-Sheet oeffnet sich ohne Security-Error |

---

## Risks & Assumptions

### Assumptions

| Assumption | Technical Validation | Impact if Wrong |
|------------|---------------------|-----------------|
| `navigator.canShare({files})` gibt `false` auf Desktop-Browsern zurueck | MDN Docs bestaetigen: Desktop Chrome/Firefox geben `false` fuer Files zurueck (oder `canShare` existiert nicht) | Fallback auf Anchor-Click greift trotzdem (Feature Detection) |
| Transient Activation bleibt waehrend fetch erhalten | WebKit-Spec: 5s Timeout fuer Transient Activation. Fetch fuer einzelnes Bild sollte < 5s dauern | Bei sehr grossen Bildern oder langsamem Netz: Share-API wirft NotAllowedError. Fallback auf Anchor-Click (mit bekanntem iPad-Bug) |
| `scrollTop` ist les-/setzbar auf dem Gallery-Container nach display-Wechsel | Standard-Browser-Verhalten: nach `display: none` Entfernung + Render-Cycle (requestAnimationFrame) ist scrollTop setzbar | Stille Degradation: Galerie startet bei Position 0 (aktuelles Verhalten, kein Regression) |
| View Transition Callback laueft synchron im naechsten Frame | `startViewTransitionIfSupported` ruft Callback synchron auf (wenn API nicht verfuegbar) oder im naechsten Animation Frame (wenn verfuegbar) | requestAnimationFrame im Close-Handler deckt beide Faelle ab |

### Risks & Mitigation

| Risk | Likelihood | Impact | Technical Mitigation | Fallback |
|------|------------|--------|---------------------|----------|
| Web Share API nicht verfuegbar (aelterer Browser) | Low | Low | Feature Detection via `canShare` | Anchor-Click-Fallback (identisch mit aktuellem Verhalten) |
| Transient Activation expired bei langsamem Netz | Low | Medium | Fetch sollte fuer Einzelbild < 5s dauern | `NotAllowedError` catchen, Anchor-Fallback ausfuehren |
| `revokeObjectURL` zu frueh (vor Share-Abschluss) | Medium | High | `revokeObjectURL` erst nach `await navigator.share()` resolved/rejected | In finally-Block nach Share, nicht im globalen finally |
| requestAnimationFrame reicht nicht fuer scrollTop-Restore | Low | Low | Browser benoetigt ggf. 2 Frames nach display-Wechsel | Doppeltes rAF (`requestAnimationFrame(() => requestAnimationFrame(() => ...))`) als Eskalation falls noetig |

---

## Technology Decisions

### Stack Choices

| Area | Technology | Rationale |
|------|------------|-----------|
| Plattform-Detection | Web Share API Feature Detection (`navigator.canShare`) | Browser-Standard, kein UA-Sniffing, Zero-Dependency. Codebase-Konvention: kein einziger `userAgent`-Zugriff im Projekt |
| Scroll-Persistence | `useRef` (in-memory) | Scroll-Position muss nur waehrend Canvas-Roundtrip erhalten bleiben, nicht ueber Page-Reloads. Kein localStorage noetig |
| Render-Timing | `requestAnimationFrame` | Bereits 3x im gleichen File (`workspace-content.tsx`) genutzt fuer Post-Render-Operations. Etabliertes Pattern |

### Trade-offs

| Decision | Pro | Con | Mitigation |
|----------|-----|-----|------------|
| Web Share API statt custom Download-Dialog | Native iOS-Experience, kein eigenes UI, kein Page-Navigation-Bug | Share-Sheet zeigt mehr Optionen als nur "Speichern" (AirDrop etc.) | Akzeptabel: User kennt das native Share-Sheet |
| `downloadImage()` erweitern statt neue Funktion | Eine Funktion fuer alle Plattformen, keine doppelte Fetch-Logik | Funktion wird komplexer (Branching) | Branching ist minimal: ein if/else nach Blob-Erstellung. 10+ existierende Test-Mocks bleiben kompatibel da Signatur unveraendert |
| scrollTop in useRef statt useState | Kein Re-Render bei Scroll-Save, performanter | Wert nicht reaktiv (kein UI-Update) | Scroll-Position braucht kein UI-Update, nur imperatives Set bei Restore |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| -- | Keine offenen Fragen | -- | -- | -- |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-04-10 | Codebase | `downloadImage()` in `lib/utils.ts:53-73` nutzt Anchor-Click mit Blob-URL. Sofortiges `revokeObjectURL` im finally-Block |
| 2026-04-10 | Codebase | Gallery-Scroll-Container in `workspace-content.tsx:404` hat `overflow-y-auto` aber keinen Ref |
| 2026-04-10 | Codebase | Gallery wird via `style={{display: "none"}}` versteckt bei Canvas-Open (`workspace-content.tsx:344`) |
| 2026-04-10 | Codebase | `handleDetailViewClose` + `handleSelectGeneration` nutzen `startViewTransitionIfSupported()` |
| 2026-04-10 | Codebase | `requestAnimationFrame` bereits 3x in `workspace-content.tsx` fuer Resize-Handler genutzt |
| 2026-04-10 | Codebase | Zero `userAgent` Referenzen im gesamten Projekt — Feature Detection ist Konvention |
| 2026-04-10 | Codebase | AbortError-Handling existiert in `openrouter.ts:70` und `settings-dialog.tsx:241` |
| 2026-04-10 | Codebase | Toast-Messages in Deutsch (`"Download fehlgeschlagen"`) |
| 2026-04-10 | Codebase | 10+ Test-Mocks fuer `downloadImage` — Signatur darf sich nicht aendern |
| 2026-04-10 | Web | iPad Safari navigiert bei Blob-URL `anchor.click()` zur URL statt Download (WebKit Bug #167341) |
| 2026-04-10 | Web | Web Share API Level 2 unterstuetzt File-Sharing auf iOS Safari 15+ |
| 2026-04-10 | Web | `navigator.canShare({files})` fuer Feature Detection. Files-Array mit image/png unterstuetzt |
| 2026-04-10 | Web | `navigator.share()` rejected mit `AbortError` wenn User Share-Sheet dismissed |
| 2026-04-10 | Web | WebKit Transient Activation Timeout: 5 Sekunden nach letzter User-Gesture |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| -- | Keine Fragen gestellt (Bug-Fix mit klarer Discovery, keine Architektur-Entscheidungen offen) | -- |
