# Slice 16: E2E Flow Verification

> **Slice 16 von 16** fuer `Model Slots`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-16-e2e-flow-verification` |
| **Test** | `pnpm exec playwright test e2e/model-slots.spec.ts` |
| **E2E** | `true` |
| **Dependencies** | `["slice-15-cleanup-legacy"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm exec playwright test e2e/model-slots.spec.ts` |
| **Integration Command** | N/A (dieser Slice IST der Integrationstest) |
| **Acceptance Command** | `pnpm exec playwright test e2e/model-slots.spec.ts --reporter=list` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` (E2E gegen laufende App + DB) |

---

## Ziel

End-to-End-Verifikation der 5 kritischen Model-Slots-Flows gegen die laufende Applikation. Stellt sicher, dass alle Slices (01-15) korrekt zusammenspielen: UI-Interaktionen, DB-Persistenz, Multi-Model-Generierung und Mode-Wechsel funktionieren als Gesamtsystem.

---

## Acceptance Criteria

1) GIVEN die App laeuft auf `localhost:3000` und `model_slots` hat Seed-Defaults (15 Rows)
   WHEN der User im Workspace den Model-Dropdown von Slot 1 oeffnet und ein anderes Model waehlt
   THEN zeigt Slot 1 den neuen Model-Namen an
   AND nach Page-Reload bleibt das geaenderte Model in Slot 1 erhalten (DB-Persistenz)

2) GIVEN der Workspace mit Mode `txt2img` und Slot 1 aktiv (Slot 2 inaktiv)
   WHEN der User Slot 2 per Checkbox aktiviert (nun 2 aktive Slots)
   AND auf "Generate" klickt mit Variant-Count 1
   THEN werden genau 2 Generierungen ausgeloest (1 pro aktivem Slot)
   AND die generierten Bilder erscheinen im Canvas

3) GIVEN der User ist im Workspace mit Mode `txt2img` und hat Slot 1 + Slot 2 aktiv
   WHEN der User zu Mode `img2img` wechselt
   THEN zeigen die Slots die img2img-spezifischen Model-Zuweisungen (aus DB)
   AND wenn der User zurueck zu `txt2img` wechselt, sind Slot 1 + Slot 2 wieder aktiv mit den vorherigen Models

4) GIVEN ein Canvas-Bild ist selektiert und der Variation-Popover wird geoeffnet
   WHEN der User im Popover ModelSlots sieht (kein TierToggle)
   AND auf "Generate" klickt
   THEN wird eine Variation mit den aktiven Slot-ModelIds generiert
   AND das Ergebnis erscheint im Canvas

5) GIVEN der Settings-Dialog wird geoeffnet
   WHEN der User die Model-Slot-Anzeige inspiziert
   THEN zeigt jeder Mode (txt2img, img2img, upscale, ...) genau 3 Slot-Zeilen
   AND aktive Slots haben einen visuell unterscheidbaren Status-Indikator gegenueber inaktiven Slots
   AND kein Dropdown/Edit-Control ist vorhanden (read-only)
   AND der Hint-Text "Change models in the workspace." ist sichtbar

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Playwright-Tests gegen laufende App.
> Playwright muss als devDependency installiert und `playwright.config.ts` konfiguriert werden (Teil dieses Slices).

### Test-Datei: `e2e/model-slots.spec.ts`

<test_spec>
```typescript
import { test } from '@playwright/test'

// AC-1: Quick Model Switch + DB-Persistenz
test.todo('should switch model in slot 1 dropdown and persist after page reload')

// AC-2: Multi-Model-Generierung mit 2 aktiven Slots
test.todo('should generate with 2 active slots and produce 2 results')

// AC-3: Mode-Wechsel behaelt Slot-Konfiguration
test.todo('should preserve slot configuration across txt2img-img2img-txt2img round trip')

// AC-4: Popover-Generierung mit Slots
test.todo('should generate variation from canvas popover using model slots')

// AC-5: Settings Read-Only Anzeige
test.todo('should display read-only slot data in settings dialog with status indicators and hint text')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-15` | Bereinigter Codebase ohne Legacy-Artefakte | Cleanup | `tsc --noEmit` fehlerfrei |
| `slice-01` | `model_slots` Tabelle mit 15 Seed-Rows | Schema + Migration | DB hat 15 Rows nach Seed |
| `slice-06` | `ModelSlots` Komponente (stacked) | UI Component | Rendert 3 Slot-Zeilen mit Checkbox + Dropdown |
| `slice-08` | `prompt-area.tsx` mit Multi-Model-Generate | Integration | `modelIds[]` wird an `generateImages()` gesendet |
| `slice-09` | `variation-popover.tsx` mit ModelSlots | Integration | Popover zeigt Slots statt TierToggle |
| `slice-14` | `settings-dialog.tsx` Read-Only | Integration | Keine Edit-Controls, Hint-Text sichtbar |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| E2E-Testausfuehrung | Verifikation | Kein Consumer (finaler Slice) | Alle 5 Tests gruen |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `e2e/model-slots.spec.ts` -- Playwright E2E Tests fuer 5 kritische Model-Slots-Flows
- [ ] `playwright.config.ts` -- Playwright-Konfiguration (baseURL: localhost:3000, webServer: pnpm dev)
<!-- DELIVERABLES_END -->

> **Hinweis:** `@playwright/test` muss als devDependency in `package.json` hinzugefuegt werden (Teil der Setup-Arbeit dieses Slices).

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an produktivem Anwendungscode — dieser Slice schreibt NUR Tests und Config
- KEINE Unit-Tests oder Vitest-Tests — ausschliesslich Playwright E2E
- KEINE API-Mocking — Tests laufen gegen echte App + DB
- KEIN CI-Pipeline-Setup — lokale Ausfuehrung genuegt

**Technische Constraints:**
- Playwright als devDependency installieren (`@playwright/test`)
- `playwright.config.ts` mit `webServer` Block der `pnpm dev` startet und auf Port 3000 wartet
- Tests muessen idempotent sein: DB-State via Seed-Defaults herstellen (Seed laeuft beim App-Start automatisch)
- Tests brauchen stabile Selektoren: `data-testid` Attribute oder semantische ARIA-Roles bevorzugen
- Generierungs-Tests koennen langsam sein (API-Calls) — grosszuegige Timeouts konfigurieren
- Falls Generierung gegen Replicate-API zu langsam/teuer ist: Test darf nach dem Klick auf "Generate" das Request-Absetzen verifizieren (z.B. Network-Interception) statt auf das fertige Bild zu warten

**Referenzen:**
- Discovery: `discovery.md` -> Section 7 "Flows" (alle 4 User-Flows)
- Wireframes: `wireframes.md` -> Alle Screens (Workspace, Popovers, Settings)
- Architecture: `architecture.md` -> Section "Quality Attributes" (Responsiveness, Data Integrity, Mode Round-Trip)
- Flow-Traceability: `slices/slim-slices.md` -> "Flow-Traceability" Tabelle (Cross-Slice Flows 1-4)
