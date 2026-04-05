# Slice 16: E2E Smoke Tests

> **Slice 16 von 16** fuer `AI Image Editing Suite`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-16-e2e-smoke` |
| **Test** | `npx playwright test e2e/image-editing-suite.spec.ts` |
| **E2E** | `true` |
| **Dependencies** | `["slice-07-inpaint-integration", "slice-08-instruction-editing", "slice-09-erase-flow", "slice-11-click-to-edit", "slice-13-outpaint-integration"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | -- |
| **Integration Command** | -- |
| **Acceptance Command** | `npx playwright test e2e/image-editing-suite.spec.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (Replicate API via Playwright `page.route()` Interception: alle `/api/replicate/`, `/api/sam/segment` und Replicate-Polling-Responses gemockt mit statischen Bild-URLs) |

---

## Ziel

5 Playwright E2E Smoke-Tests fuer die Kern-Editing-Flows schreiben, die gegen gemockte Replicate-API-Responses laufen. Jeder Test validiert einen vollstaendigen User-Flow vom Tool-Aktivieren bis zum ersetzten Bild im Canvas.

---

## Acceptance Criteria

1) GIVEN der User ist im Canvas Detail-View mit einem generierten Bild
   WHEN er den `brush-edit` Toolbar-Button klickt, eine Maske auf das Bild malt, einen Prompt "Replace with a red dress" im Chat-Input eingibt und absendet
   AND die Replicate API (gemockt) eine Bild-URL zurueckgibt
   THEN wird das Canvas-Bild durch das neue Bild ersetzt (Bild-`src` aendert sich)
   AND der Undo-Button ist aktiviert

2) GIVEN der User ist im Canvas Detail-View mit einem generierten Bild
   WHEN er den `erase` Toolbar-Button klickt, eine Maske auf das Bild malt und den "Entfernen"-Button (`erase-action-btn`) klickt
   AND die Replicate API (gemockt) eine Bild-URL zurueckgibt
   THEN wird das Canvas-Bild durch das neue Bild ersetzt
   AND der Undo-Button ist aktiviert

3) GIVEN der User ist im Canvas Detail-View mit einem generierten Bild
   WHEN er ohne ein Edit-Tool zu aktivieren den Prompt "Make the sky bluer" im Chat-Input eingibt und absendet
   AND die Replicate API (gemockt) eine Bild-URL zurueckgibt
   THEN wird das Canvas-Bild durch das neue Bild ersetzt
   AND der Undo-Button ist aktiviert

4) GIVEN der User ist im Canvas Detail-View mit einem generierten Bild
   WHEN er den `click-edit` Toolbar-Button klickt und auf das Bild klickt
   AND die SAM API (gemockt via `page.route('/api/sam/segment')`) eine `mask_url` zurueckgibt
   THEN erscheint ein Mask-Overlay auf dem Bild (MaskCanvas sichtbar)
   AND der `editMode` wechselt zu Painting (Floating Brush Toolbar wird sichtbar)
   WHEN er anschliessend einen Prompt "Replace with a cat" im Chat-Input eingibt und absendet
   AND die Replicate API (gemockt) eine Bild-URL zurueckgibt
   THEN wird das Canvas-Bild durch das neue Bild ersetzt

5) GIVEN der User ist im Canvas Detail-View mit einem generierten Bild
   WHEN er den `expand` Toolbar-Button klickt, mindestens eine Richtung (z.B. "Top") selektiert und einen Prompt "Extend with blue sky" im Chat-Input eingibt und absendet
   AND die Replicate API (gemockt) eine Bild-URL zurueckgibt
   THEN wird das Canvas-Bild durch das neue (erweiterte) Bild ersetzt
   AND der Undo-Button ist aktiviert

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions, Route-Mocks und Helpers selbststaendig.
> **Orientierung:** Bestehendes E2E-Pattern in `e2e/model-slots.spec.ts` (Helper-Funktionen, Navigation, `page.route()` Mocking).

### Test-Datei: `e2e/image-editing-suite.spec.ts`

<test_spec>
```typescript
// AC-1: Inpaint — Maske malen -> Prompt -> Bild ersetzt
test.todo('inpaint: should paint mask, send prompt, and replace canvas image')

// AC-2: Erase — Maske malen -> Entfernen-Button -> Bild ersetzt
test.todo('erase: should paint mask, click remove button, and replace canvas image')

// AC-3: Instruction Edit — Prompt ohne Maske -> Bild aendert sich
test.todo('instruction edit: should send prompt without mask and replace canvas image')

// AC-4: Click-to-Edit — Klick -> Auto-Mask -> Prompt -> Bild ersetzt
test.todo('click-to-edit: should click image for SAM mask, send prompt, and replace canvas image')

// AC-5: Outpaint — Richtung waehlen -> Prompt -> Bild erweitert
test.todo('outpaint: should select direction, send prompt, and replace canvas image with extended result')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-07` | `brush-edit`, `erase`, `click-edit`, `expand` Toolbar-Buttons mit `data-testid` | DOM Elements | Buttons via `getByTestId` oder `getByRole` selektierbar |
| `slice-07` | `handleCanvasGenerate` Inpaint-Branch (SSE -> generateImages -> Bild-Update) | E2E Flow | Gemocker SSE-Stream + Polling liefert Bild-URL |
| `slice-08` | Instruction-Branch in `handleCanvasGenerate` | E2E Flow | Prompt ohne Maske/Tool -> instruction mode |
| `slice-09` | `erase-action-btn` in Floating Brush Toolbar, `handleEraseAction` | DOM Element + Flow | Button klickbar, direkter generateImages-Aufruf |
| `slice-11` | Click-to-Edit Flow (Klick -> SAM API -> Mask-Overlay -> Painting) | E2E Flow | `POST /api/sam/segment` mockbar, Mask-Overlay erscheint |
| `slice-13` | Outpaint Direction Controls + Chat-Integration | DOM Elements + Flow | Direction-Buttons selektierbar, Send uebergibt directions/size |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| E2E Smoke-Test-Suite | Playwright Spec | -- (kein Consumer, finaler Slice) | `npx playwright test e2e/image-editing-suite.spec.ts` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `e2e/image-editing-suite.spec.ts` -- 5 Playwright Smoke-Tests fuer Inpaint, Erase, Instruction Edit, Click-to-Edit und Outpaint mit gemockter Replicate/SAM API
<!-- DELIVERABLES_END -->

> **Hinweis:** Dies ist ein reiner Test-Slice. Das Deliverable IST die Test-Datei.

---

## Constraints

**Scope-Grenzen:**
- KEINE Unit-Tests oder Component-Tests (das ist ein E2E-Slice)
- KEINE Aenderungen an produktiven Dateien
- KEINE neuen API-Endpunkte oder Komponenten
- KEINE Abdeckung von Edge Cases (Fehlerpfade, Mask-Validation) -- Smoke-Tests pruefen nur Happy Paths
- KEIN Test fuer Undo/Redo (bereits in bestehenden Tests abgedeckbar)

**Technische Constraints:**
- API-Mocking via `page.route()` (Playwright Network Interception) -- KEINE echten Replicate-API-Calls
- Gemockte Responses: statische Bild-URLs (z.B. lokale Fixtures oder Data-URLs) fuer alle Generation-Ergebnisse
- SAM-Mock: `POST /api/sam/segment` gibt `{ mask_url: "<fixture-url>" }` mit HTTP 200 zurueck
- Canvas-Malen simulieren via `page.mouse.move()` + `page.mouse.down()` + `page.mouse.move()` + `page.mouse.up()` auf dem MaskCanvas-Element
- Test-Setup: Navigation zum Canvas Detail-View mit bestehendem Bild (analog zu `e2e/model-slots.spec.ts` Helper-Pattern)
- Playwright-Config: bestehende `playwright.config.ts` (testDir: `./e2e`, baseURL: `http://localhost:3000`, Chromium)
- Timeout: 120s pro Test (bestehende Config), Smoke-Tests sollten jeweils < 30s dauern

**Referenzen:**
- Architecture: `architecture.md` -> API Design Zeile 59-94 (Endpoints, DTOs, SSE Events)
- Architecture: `architecture.md` -> Error Handling Strategy Zeile 307-317 (Toast-Texte fuer Fehlerfall-Validierung)
- Architecture: `architecture.md` -> Data Flow Zeile 274-304 (End-to-End Pipeline pro Modus)
- Wireframes: `wireframes.md` -> User Flow Overview Zeile 28-43 (5 Modi und ihre Transitions)
- Wireframes: `wireframes.md` -> Alle Screens (fuer DOM-Selektoren und erwartete UI-States)
- Bestehendes E2E-Pattern: `e2e/model-slots.spec.ts` (Navigation-Helpers, `page.route()` Mocking)
