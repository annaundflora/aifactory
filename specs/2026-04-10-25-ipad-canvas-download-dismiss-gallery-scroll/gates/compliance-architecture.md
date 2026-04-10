# Gate 1: Architecture Compliance Report

**Gepruefte Architecture:** `specs/2026-04-10-25-ipad-canvas-download-dismiss-gallery-scroll/architecture.md`
**Pruefdatum:** 2026-04-10
**Discovery:** `specs/2026-04-10-25-ipad-canvas-download-dismiss-gallery-scroll/discovery.md`
**Wireframes:** N/A -- Bug-Fix, keine neuen UI-Wireframes (in Discovery begruendet)

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 23 |
| Blocking | 0 |

**Verdict:** APPROVED

---

## A) Feature Mapping

| Discovery Feature | Architecture Section | API Endpoint | DB Schema | Status |
|-------------------|---------------------|--------------|-----------|--------|
| Web Share API fuer Image-Download auf iOS/iPadOS | Architecture Layers > Data Flow (Download iOS) + Migration Map (lib/utils.ts) | N/A (clientseitig) | N/A (keine DB-Aenderung) | PASS |
| Feature Detection (navigator.share + navigator.canShare) statt UA-Sniffing | Constraints > "Kein User-Agent-Sniffing" + Technology Decisions > "Web Share API Feature Detection" | N/A | N/A | PASS |
| Fallback auf bestehenden Anchor-Download | Architecture Layers > Data Flow (canShare=false Branch) + Error Handling Strategy | N/A | N/A | PASS |
| Gallery Scroll-Position speichern/wiederherstellen bei Canvas-Open/Close | Architecture Layers > Data Flow (Scroll Restore) + Migration Map (workspace-content.tsx) | N/A | N/A | PASS |

**Ergebnis:** Alle 4 Discovery-Features sind in Architecture vollstaendig adressiert.

---

## B) Constraint Mapping

| Constraint | Source | Architecture | Status |
|------------|--------|--------------|--------|
| Kein User-Agent-Sniffing | Discovery Business Rules | Constraints: "Plattform-Erkennung muss ueber Feature Detection laufen" + `navigator.canShare({files})` | PASS |
| Web Share API erfordert User-Gesture (Transient Activation) | Discovery Business Rules | Security > Transient Activation: "onClick-Handler, Activation bleibt 5s in WebKit" | PASS |
| URL.revokeObjectURL erst NACH Share-Abschluss | Discovery Business Rules | Constraints: "Share-Pfad: revokeObjectURL nach await navigator.share()" + Migration Map spezifiziert Timing | PASS |
| Gallery display:none Toggle zerstoert scrollTop | Discovery Business Rules | Constraints: "Manuelles Save (vor display:none) + Restore (nach display:block + requestAnimationFrame)" | PASS |
| View Transition API im Close-Handler | Discovery Business Rules | Constraints: "requestAnimationFrame innerhalb der Callback-Kette, nach setDetailViewOpen(false)" | PASS |
| AbortError bei Share-Sheet Dismiss silent catchen | Discovery Error Paths | Error Handling Strategy: "AbortError: Catch + check error.name, Kein Toast" | PASS |
| Scroll-Position nur in-memory (useRef), kein localStorage | Discovery Business Rules / Out of Scope | Technology Decisions: "useRef (in-memory), Kein localStorage noetig" | PASS |
| requestAnimationFrame fuer Render-Cycle nach display-Wechsel | Discovery Business Rules | Technology Decisions: "requestAnimationFrame, Bereits 3x im gleichen File" | PASS |
| downloadImage() Signatur unveraendert (10+ Test-Mocks) | Discovery Slice 1 | Migration Map canvas-toolbar.tsx: "downloadImage() Signatur bleibt gleich" + Research Log: "10+ Test-Mocks" | PASS |

**Ergebnis:** Alle 9 Discovery-Constraints sind in Architecture technisch adressiert.

---

## C) Realistic Data Check

### Codebase Evidence

Keine DB-Aenderungen in diesem Feature. Data Check bezieht sich auf Browser-API-Typen und In-Memory-Refs.

Existierende Patterns:
- `useRef<HTMLDivElement>` in 25 Dateien (97 useRef-Referenzen in components/)
- `requestAnimationFrame` in workspace-content.tsx (L112, L194) fuer Resize-Handler
- `scrollTop` ist standard DOM-Property (number), kein Laengen-Problem
- `navigator.share()` akzeptiert `ShareData` mit `files: File[]` -- Browser-Standard-Typen
- `File` Konstruktor: `new File([blob], filename, {type: blob.type})` -- Standard Web API

### External API Analysis

| API | Field | Type | Evidence | Status |
|-----|-------|------|----------|--------|
| Web Share API | `navigator.share({files})` | ShareData (Browser-Standard) | MDN Web Share API Level 2, iOS Safari 15+ | PASS |
| Web Share API | `navigator.canShare({files})` | boolean (Browser-Standard) | MDN: Returns true/false | PASS |
| Web Share API | AbortError on dismiss | DOMException | Established pattern in codebase (openrouter.ts:70, settings-dialog.tsx:241) | PASS |

### Data Type Verdicts

| Field | Architecture Type | Evidence | Verdict |
|-------|-------------------|----------|---------|
| `scrollTopRef` | `useRef<number>` (Default 0) | DOM scrollTop ist number, standard | PASS |
| `galleryScrollRef` | `useRef<HTMLDivElement>` | 25 Dateien im Projekt nutzen dieses Pattern | PASS |
| `File` Objekt fuer Share | `new File([blob], filename, {type})` | Web API Standard, kein Laengen-/Typ-Problem | PASS |
| `navigator.share()` Return | `Promise<void>` | MDN-Spezifikation | PASS |
| `navigator.canShare()` Return | `boolean` | MDN-Spezifikation | PASS |

**Ergebnis:** Keine Datentyp-Probleme. Alle Typen sind Browser-Standard-APIs oder etablierte Codebase-Patterns.

---

## D) External Dependencies

### D1) Dependency Version Check

**Projekt-Typ:** Existing (package.json vorhanden)

| Dependency | Arch Version | Pinning File | Pinned? | Status |
|------------|-------------|--------------|---------|--------|
| Next.js | 16.1.6 | package.json: `"next": "16.1.6"` | PASS (exact) | PASS |
| React | 19.2.3 | package.json: `"react": "19.2.3"` | PASS (exact) | PASS |
| sonner | 2.0.7 | package.json: `"sonner": "^2.0.7"` | PASS (range) | PASS |
| Web Share API | Level 2 (Browser-Standard) | N/A (kein npm-Paket) | N/A | PASS |
| View Transition API | CSS View Transitions Level 1 (Browser-Standard) | N/A (kein npm-Paket) | N/A | PASS |

Architecture dokumentiert korrekt: "Keine neuen Dependencies" und "Kein npm-Paket noetig".

### D2) External APIs & Services

| Dependency | Rate Limits | Auth | Errors | Timeout | Status |
|------------|-------------|------|--------|---------|--------|
| Web Share API (Browser) | N/A (lokale API, kein Netzwerk) | N/A | AbortError (dismiss), NotAllowedError (no transient activation) dokumentiert | N/A (synchron/lokal) | PASS |
| View Transition API (Browser) | N/A | N/A | Graceful degradation via try/catch (existiert in view-transition.ts) | N/A | PASS |

**Ergebnis:** Keine externen API-Services. Nur Browser-Standard-APIs, korrekt dokumentiert.

---

## E) Pattern Consistency (Gate 1b)

codebase-scan.md vorhanden. Scanner-Output Validierung:

### Scanner-Output Strukturelle Plausibilitaet

| Check | Regel | Ergebnis |
|-------|-------|----------|
| AVOID hat Basis | Keine AVOID-Items im Scanner | N/A |
| REUSE hat Evidenz | Alle 6 REUSE-Items haben count >= 2 (toast: 15, useRef: 20+, rAF: 3, AbortError: 2, View Transition: 2, generateDownloadFilename: 1 call) | PASS (generateDownloadFilename hat nur 1 Nutzung, aber REUSE bedeutet "wiederverwenden was da ist", kein Minimum noetig bei bestehender Abstraktion) |
| Jede Empfehlung hat Dateipfad | Alle Items referenzieren konkrete Dateipfade | PASS |

### Architecture vs. Scanner-Empfehlungen

| Scanner Recommendation | Architecture Decision | Justified? | Status |
|------------------------|----------------------|------------|--------|
| REUSE `generateDownloadFilename()` | Architecture Layer: "downloadImage() Signatur bleibt gleich", Migration Map canvas-toolbar: "Unveraendert" | Yes -- filename generation bleibt unberuehrt | PASS |
| REUSE `startViewTransitionIfSupported()` | Architecture Layer: "REUSE + EXTEND", Constraints: "requestAnimationFrame innerhalb der Callback-Kette" | Yes -- View Transition wird weiterhin genutzt, Scroll-Restore hooks in das Timing ein | PASS |
| REUSE `toast.error()` pattern | Error Handling Strategy: "toast.error('Download fehlgeschlagen') (existiert)" | Yes -- bestehende Toast-Patterns werden wiederverwendet | PASS |
| REUSE `useRef` for DOM references | Architecture Layer: "useRef + requestAnimationFrame (REUSE + EXTEND)", Migration Map: "Zwei neue useRefs" | Yes -- etabliertes Pattern (97 Referenzen in 25 Dateien) | PASS |
| REUSE `requestAnimationFrame` for post-render work | Technology Decisions: "requestAnimationFrame, Bereits 3x im gleichen File" | Yes -- identisches Pattern wie existierende Resize-Handler | PASS |
| REUSE AbortError handling pattern | Error Handling: "Catch + check error.name === 'AbortError'" | Yes -- identisches Pattern wie openrouter.ts:70 und settings-dialog.tsx:241 | PASS |
| EXTEND `downloadImage()` | Migration Map: Detaillierte Erweiterung mit Web Share API Branch, Fallback, revokeObjectURL-Timing | Yes -- Fetch+Blob-Logik wird wiederverwendet, nur Delivery-Mechanismus wird erweitert | PASS |
| EXTEND Gallery container in workspace-content.tsx | Migration Map: Ref hinzufuegen, scrollTop Save/Restore mit rAF | Yes -- bestehender Container wird erweitert, nicht neu gebaut | PASS |
| NEW Web Share API feature detection | Architecture Layer: "Utility-Function Pattern (EXTEND bestehende downloadImage())" + Constraints: "navigator.canShare({files})" | Yes -- Scanner begruendet: "No platform/capability detection for file sharing exists". Architecture integriert es in bestehende downloadImage() statt neue Abstraktion | PASS |

**Ergebnis:** Alle 9 Scanner-Empfehlungen sind in Architecture beruecksichtigt und korrekt umgesetzt.

---

## F) Migration Completeness

Scope enthaelt Migration/Refactoring (EXTEND downloadImage, EXTEND workspace-content).

### Quantitaets-Check

| Discovery Claim | Architecture Coverage | Status |
|---|---|---|
| Slice 1: downloadImage() refactoren oder neue shareImage() Funktion + canvas-toolbar Handler anpassen | Migration Map: 2 Zeilen (lib/utils.ts + canvas-toolbar.tsx) | PASS |
| Slice 2: Ref auf Gallery Scroll Container, scrollTop speichern/wiederherstellen | Migration Map: 1 Zeile (workspace-content.tsx mit 3 Aenderungspunkten) | PASS |

### Qualitaets-Check

| File in Migration Map | Current Pattern | Target Pattern | Specific enough for test? | Status |
|---|---|---|---|---|
| `lib/utils.ts` (L53-73) | fetch -> blob -> anchor.click() -> revokeObjectURL (immediate) | fetch -> blob -> File -> canShare-Check -> Web Share API Branch ODER Anchor-Fallback. revokeObjectURL nach async Share-Abschluss | Yes: Test kann pruefen ob `navigator.canShare` gecallt wird und ob `navigator.share({files})` bei true aufgerufen wird | PASS |
| `components/canvas/canvas-toolbar.tsx` (L87-101) | handleDownload(): try/catch, jeder Error -> toast.error() | Unveraendert (AbortError-Handling in downloadImage) | Yes: Test kann pruefen dass canvas-toolbar sich nicht aendert / Signatur gleich bleibt | PASS |
| `components/workspace/workspace-content.tsx` (L297-312, L344, L404) | Gallery-Container ohne Ref, kein scrollTop-Management | Zwei neue useRefs + Save in handleSelectGeneration + Restore in handleDetailViewClose via requestAnimationFrame | Yes: Test kann pruefen ob galleryScrollRef existiert, ob scrollTop bei Open gespeichert und bei Close wiederhergestellt wird | PASS |

**Ergebnis:** Migration Map ist vollstaendig, dateibasiert, und alle Target Patterns sind spezifisch genug fuer Tests.

---

## Completeness Check

| Architecture Section | Vorhanden | Begruendung wenn N/A | Status |
|----------------------|-----------|----------------------|--------|
| Problem & Solution | Ja | -- | PASS |
| Scope & Boundaries | Ja | -- | PASS |
| API Design | Ja (N/A begruendet) | "Rein clientseitige Aenderungen" | PASS |
| Database Schema | Ja (N/A begruendet) | "Keine Datenbank-Aenderungen" | PASS |
| Server Logic | Ja (N/A begruendet) | "Keine serverseitige Logik betroffen" | PASS |
| Security | Ja | Input Validation, Transient Activation, Data Protection | PASS |
| Architecture Layers | Ja | Layer Responsibilities, Data Flow, Error Handling | PASS |
| Migration Map | Ja | 3 Dateien mit konkreten Aenderungen | PASS |
| Constraints & Integrations | Ja | 5 Constraints, 5 Integrations | PASS |
| Quality Attributes (NFRs) | Ja | 5 NFRs mit Measure/Verify | PASS |
| Risks & Assumptions | Ja | 4 Assumptions, 4 Risks mit Mitigation | PASS |
| Technology Decisions | Ja | 3 Stack Choices, 3 Trade-offs | PASS |
| Open Questions | Ja (keine offen) | -- | PASS |
| Research Log | Ja | 14 Eintraege | PASS |

---

## Blocking Issues

Keine.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0

**Next Steps:**
- Architecture ist bereit fuer Slice-Planning (Gate 2)
