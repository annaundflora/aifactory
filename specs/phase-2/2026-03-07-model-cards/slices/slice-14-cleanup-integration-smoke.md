# Slice 14: Cleanup + Integration Smoke Test

> **Slice 14 von 14** fuer `Model Cards & Multi-Model Selection`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-14-cleanup-integration-smoke` |
| **Test** | `pnpm build` |
| **E2E** | `true` |
| **Dependencies** | `["slice-12-parallel-multi-model-generation", "slice-13-gallery-model-badge"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm build` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm exec playwright test e2e/model-cards.spec.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

> **Hinweis:** Playwright ist im Projekt noch nicht installiert. Setup: `pnpm create playwright` (konfiguriert `playwright.config.ts` und installiert Browser). E2E-Tests laufen gegen `pnpm dev` (localhost:3000).

---

## Ziel

Alle 13 vorherigen Slices als integriertes System validieren: Build muss fehlerfrei laufen, kein toter Import von `lib/models` darf noch existieren, und ein E2E-Smoke-Test beweist den vollstaendigen User-Flow von Workspace-Oeffnen bis Generation-Start.

---

## Acceptance Criteria

1) GIVEN das gesamte Projekt nach Abschluss aller Slices 01-13
   WHEN `pnpm build` ausgefuehrt wird
   THEN beendet der Prozess mit Exit-Code 0 (kein TypeScript-Fehler, kein Compile-Fehler)

2) GIVEN das gesamte Projekt nach Abschluss aller Slices 01-13
   WHEN eine Code-Suche nach `from.*lib/models` oder `require.*lib/models` ausgefuehrt wird
   THEN werden keine Treffer in produktiven Quelldateien gefunden (`.ts`, `.tsx` unter `app/`, `lib/`, `components/`)

3) GIVEN ein laufender Dev-Server (`pnpm dev`)
   WHEN der Workspace geoeffnet wird (Navigation zu `/`)
   THEN zeigt der Model-Trigger mindestens ein Model aus der Collections API (Standard-Selektion)
   AND kein JavaScript-Error erscheint in der Browser-Konsole

4) GIVEN der Workspace ist geladen und der Trigger zeigt das Default-Model
   WHEN der Nutzer auf "Browse Models" klickt
   THEN oeffnet sich der Model-Browser-Drawer von rechts
   AND mindestens eine Model-Card ist sichtbar (Cover oder Fallback, Name, Run-Count)

5) GIVEN der Model-Browser-Drawer ist offen mit mindestens einer Card
   WHEN der Nutzer eine Model-Card auswaehlt und auf "Confirm" klickt
   THEN schliesst der Drawer
   AND der Trigger zeigt das ausgewaehlte Model

6) GIVEN ein Model ist im Trigger ausgewaehlt und ein Prompt ist eingegeben
   WHEN der Nutzer auf "Generate" klickt
   THEN erscheint mindestens ein Loading-Placeholder in der Gallery
   AND kein JavaScript-Error erscheint in der Browser-Konsole

7) GIVEN der Model-Browser-Drawer ist offen
   WHEN der Nutzer den Drawer schliesst (X-Button oder Backdrop) ohne zu confirmen
   THEN bleibt die vorherige Model-Selektion im Trigger unveraendert

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.
> **Syntax:** Playwright (`test.todo`)

### Test-Datei: `e2e/model-cards.spec.ts`

<test_spec>
```typescript
// AC-1: Build laeuft fehlerfrei (wird als CI-Check validiert, kein Browser-Test noetig)
test.todo('build exits with code 0 and no TypeScript errors')

// AC-2: Kein toter Import von lib/models
test.todo('no file in app/ lib/ components/ imports from lib/models')

// AC-3: Workspace oeffnet sich mit Default-Model im Trigger
test.todo('workspace loads and trigger shows at least one model from collections API without console errors')

// AC-4: Model-Browser-Drawer oeffnet sich mit Cards
test.todo('clicking Browse Models opens drawer and displays at least one model card')

// AC-5: Confirm-Flow aktualisiert Trigger
test.todo('selecting a model card and confirming closes drawer and updates trigger')

// AC-6: Generate startet und zeigt Loading-Placeholder
test.todo('clicking Generate with a model selected and prompt entered shows loading placeholder in gallery')

// AC-7: Drawer-Close ohne Confirm verwirft Aenderungen
test.todo('closing drawer without confirming preserves previous model selection in trigger')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03-server-action-getCollectionModels` | `getCollectionModels()` | Server Action | Workspace-Mount liefert Models; Trigger zeigt Default-Model |
| `slice-08-model-browser-drawer` | `ModelBrowserDrawer` | React Component | Drawer oeffnet bei Browse-Klick, Cards sichtbar |
| `slice-10-model-trigger-prompt-area` | `ModelTrigger` in `prompt-area.tsx` | React Component | Trigger zeigt ausgewaehlte Models; Browse-Link vorhanden |
| `slice-12-parallel-multi-model-generation` | `generateImages` (refactored) | Server Action | Akzeptiert `modelIds: string[]`; startet Generation |
| `slice-13-gallery-model-badge` | `GenerationCard` mit Badge | React Component | Badge sichtbar auf Gallery-Thumbnails |
| `slice-05-remove-model-lookup` | Kein Import von `lib/models` | Refactoring | Pruefbar via Code-Suche (`grep`) |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `e2e/model-cards.spec.ts` | Playwright E2E Test Suite | CI/CD Pipeline | Smoke-Test-Signal fuer das gesamte Feature |
| `playwright.config.ts` | Playwright Konfiguration | CI/CD Pipeline | Basisconfig fuer zukuenftige E2E-Tests |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `playwright.config.ts` — Playwright-Basiskonfiguration (baseURL: `http://localhost:3000`, browser: chromium, webServer mit `pnpm dev`)
<!-- DELIVERABLES_END -->

> **Hinweis:** `e2e/model-cards.spec.ts` wird vom Test-Writer-Agent basierend auf den Test Skeletons oben erstellt. Playwright-Installation via `pnpm create playwright` ist manueller Setup-Schritt vor dem Slice.

---

## Constraints

**Scope-Grenzen:**
- KEIN neues Feature-Code — nur Konfiguration und Verifikation
- KEINE Fixes an bestehenden Slices (Fehler, die hier gefunden werden, muessen in den jeweiligen Slices korrigiert werden)
- KEINE visuellen Regressionstests oder Performance-Benchmarks
- KEIN Testing der Multi-Model-Parallel-Generation (Replicate-API-Calls) im E2E — nur den Generation-Start (Loading-Placeholder) validieren

**Technische Constraints:**
- Playwright als neues E2E-Framework: `pnpm create playwright` (generiert `playwright.config.ts`)
- E2E-Tests laufen gegen `pnpm dev` (nicht `pnpm start`) da Build-Artefakte nicht erwartet werden
- Mock-Strategie: Collections-API wird NICHT gemockt im Smoke-Test (echter Replicate-API-Call erwartet); `REPLICATE_API_TOKEN` muss in `.env.local` gesetzt sein
- Build-Check (`pnpm build`) ist eigenstaendiger AC-1/AC-2-Validator und laeuft separat vom Playwright-Test
- Import-Pruefung (AC-2): kann via `grep -r "lib/models" app/ lib/ components/ --include="*.ts" --include="*.tsx"` validiert werden

**Referenzen:**
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` → Section "Migration Map" (vollstaendige Liste aller Dateien die `lib/models` importiert haben)
- Discovery: `specs/phase-2/2026-03-07-model-cards/discovery.md` → Section "User Flow" (Schritt 1-10 als Basis fuer Smoke-Test-Szenario)
