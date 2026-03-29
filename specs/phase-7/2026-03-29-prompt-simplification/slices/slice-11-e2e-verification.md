# Slice 11: End-to-End Verifikation

> **Slice 11 von 11** fuer `Prompt-Felder Vereinfachung`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-11-e2e-verification` |
| **Test** | `pnpm test && cd backend && python -m pytest -v` |
| **E2E** | `true` |
| **Dependencies** | `["slice-05-prompt-area-ui", "slice-06-workspace-state-tabs", "slice-07-canvas-ui", "slice-09-assistant-knowledge-dto", "slice-10-assistant-frontend"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs + python-fastapi` (Dual-Stack) |
| **Test Command** | `pnpm test` |
| **Integration Command** | `cd backend && python -m pytest -v` |
| **Acceptance Command** | `pnpm test && cd backend && python -m pytest -v && npx tsc --noEmit` |
| **Start Command** | `pnpm dev` (Frontend) + `cd backend && uvicorn app.main:app --reload` (Backend) |
| **Health Endpoint** | `http://localhost:3000` (Frontend) + `http://localhost:8000/health` (Backend) |
| **Mocking Strategy** | `no_mocks` (Verifikation gegen echte Services, manuelle Schritte gegen Replicate API) |

---

## Ziel

Sicherstellen, dass nach allen vorherigen Slices die gesamte Pipeline von UI ueber Server Action und Generation Service bis zur Replicate API fehlerfrei funktioniert, der Assistant-Flow (SSE -> Frontend -> Workspace) korrekt ein 1-Feld-Draft liefert, die DB-Migration auf der Dev-DB laeuft, und alle Test-Suites (Vitest + pytest) gruen sind. Keine neuen Dateien -- nur Verifikation und ggf. Restbereinigung in maximal 3 bestehenden Dateien.

---

## Acceptance Criteria

1) GIVEN alle vorherigen Slices (01-10) sind implementiert
   WHEN `pnpm test` im Projekt-Root ausgefuehrt wird
   THEN laufen ALLE Vitest-Suites gruen mit 0 Failures und 0 Errors
   AND es gibt KEINE skipped Tests die auf promptStyle oder negativePrompt referenzieren

2) GIVEN alle vorherigen Slices (01-10) sind implementiert
   WHEN `cd backend && python -m pytest -v` ausgefuehrt wird
   THEN laufen ALLE pytest-Suites gruen mit 0 Failures und 0 Errors
   AND es gibt KEINE skipped Tests die auf negativePrompts, motiv/style/negative_prompt (3-Feld-Shape) referenzieren

3) GIVEN alle vorherigen Slices (01-10) sind implementiert
   WHEN `npx tsc --noEmit` ausgefuehrt wird
   THEN meldet der TypeScript-Compiler exakt 0 Fehler

4) GIVEN die Dev-Datenbank mit existierenden Generations-Daten
   WHEN die Migration `0012_drop_prompt_style_negative` via `pnpm drizzle-kit push` oder SQL-Ausfuehrung angewendet wird
   THEN existieren die Spalten `prompt_style` und `negative_prompt` NICHT mehr in der Tabelle `generations`
   AND bestehende Rows sind weiterhin abrufbar (kein Data-Corruption)

5) GIVEN der User oeffnet die Prompt Area im Browser (txt2img-Modus)
   WHEN die UI geladen ist
   THEN sieht der User genau 1 Textarea mit Label "Prompt"
   AND es gibt KEINE Collapsible-Sections fuer Style oder Negative Prompt
   AND die Prompt Tools Row (Assistant, Improve, Clear) ist weiterhin sichtbar

6) GIVEN der User gibt einen Prompt ein und waehlt ein Flux-Model (z.B. `flux-1.1-pro`)
   WHEN der User auf "Generate" klickt
   THEN wird die Bildgenerierung erfolgreich gestartet (kein API-Error)
   AND die Replicate API erhaelt KEIN `negative_prompt` Input-Feld
   AND der HTTP-Response-Status ist NICHT 422 (Validation Error)

7) GIVEN der User startet den Assistant und fragt nach einem Prompt-Vorschlag
   WHEN der Assistant via SSE ein `tool-call-result` mit `tool: "draft_prompt"` sendet
   THEN enthaelt die SSE-Payload das Format `{ prompt: string }` (NICHT `{ motiv, style, negative_prompt }`)
   AND der Draft wird im UI als ein einzelner Prompt-Block angezeigt
   AND "Apply to Prompt" uebernimmt den Draft in das einzige Prompt-Textarea

8) GIVEN die Generation History im Canvas (DetailsOverlay)
   WHEN der User eine bestehende Generation anklickt
   THEN zeigt das Overlay NUR eine "Prompt"-Section
   AND es gibt KEINE "Style"- oder "Negative Prompt"-Section

9) GIVEN maximal 3 Dateien mussten fuer Restbereinigung angepasst werden
   WHEN die Aenderungen geprueft werden
   THEN enthalten die Aenderungen ausschliesslich Bereinigungen von verbleibenden Referenzen auf `promptStyle`, `negativePrompt`, `style`, `negative_prompt` im alten 3-Feld-Kontext
   AND es werden KEINE neuen Features oder Verhaltensaenderungen eingefuehrt

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Die E2E-Verifikation laeuft primaer ueber die vorhandenen Test-Suites.
> Diese Skeletons definieren die Smoke-Tests die ueber Slice-Grenzen hinweg validieren.

### Test-Datei: `__tests__/e2e/prompt-simplification-smoke.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Prompt Simplification - E2E Smoke', () => {
  // AC-1: Alle Vitest-Suites gruen
  it.todo('should have all Vitest suites passing with 0 failures')

  // AC-3: TypeScript-Compiler ohne Fehler
  it.todo('should compile without TypeScript errors')

  // AC-5: UI rendert genau 1 Textarea, keine Collapsibles
  it.todo('should render exactly 1 Prompt textarea and no collapsible Style/Negative sections')

  // AC-6: Generation ohne negative_prompt API-Error
  it.todo('should generate image with Flux model without API validation error')

  // AC-7: Assistant SSE liefert 1-Feld-Draft
  it.todo('should receive SSE draft_prompt with single prompt field')

  // AC-8: DetailsOverlay zeigt nur Prompt-Section
  it.todo('should show only Prompt section in DetailsOverlay without Style or Negative sections')

  // AC-9: Keine verbleibenden 3-Feld-Referenzen in produktivem Code
  it.todo('should have no remaining promptStyle or negativePrompt references in production code')
})
```
</test_spec>

### Test-Datei: `backend/tests/e2e/test_prompt_simplification_smoke.py`

<test_spec>
```python
import pytest

# AC-2: Alle pytest-Suites gruen
@pytest.mark.skip(reason="AC-2")
def test_all_pytest_suites_pass():
    ...

# AC-4: DB-Migration -- Spalten entfernt, bestehende Rows intakt
@pytest.mark.skip(reason="AC-4")
def test_migration_drops_prompt_style_negative_columns_and_preserves_rows():
    ...

# AC-7: draft_prompt Tool gibt { prompt } zurueck
@pytest.mark.skip(reason="AC-7")
def test_draft_prompt_returns_single_field():
    ...
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-05` | `PromptArea` mit 1 Textarea | Component | Visuell: 1 Textarea, kein Style/Negative |
| `slice-06` | `PromptTabs`/`HistoryList`/`FavoritesList` ohne `promptStyle`/`negativePrompt` Props | Interfaces | `npx tsc --noEmit` |
| `slice-07` | `VariationPopover`/`DetailsOverlay` ohne Style/Negative | Components | Visuell + `npx tsc --noEmit` |
| `slice-09` | `DraftPromptDTO(prompt: str)` + bereinigte Knowledge JSON | DTO + Data | `pytest` |
| `slice-10` | `DraftPrompt { prompt }` + SSE-Parsing 1-Feld | Interface + Runtime | `pnpm test lib/assistant/__tests__/` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Verifizierter Gesamtstatus | Signal | -- (Endpunkt, letzter Slice) | Alle Tests gruen, Pipeline funktional |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `__tests__/e2e/prompt-simplification-smoke.test.ts` -- E2E Smoke-Tests (Vitest) fuer Cross-Slice-Verifikation
- [ ] `backend/tests/e2e/test_prompt_simplification_smoke.py` -- E2E Smoke-Tests (pytest) fuer Backend-Verifikation
<!-- DELIVERABLES_END -->

> **Hinweis:** Dieser Slice erstellt primaer die beiden Smoke-Test-Dateien. Restbereinigung (max 3 bestehende Dateien) erfolgt nur falls Tests oder Compiler konkrete Fehler melden. Verifikations-Checks (pnpm test, pytest, tsc, DB-Migration, manuelle Tests) sind in der Verifikations-Checkliste unter Constraints dokumentiert.

---

## Constraints

**Scope-Grenzen:**
- KEINE neuen Features -- ausschliesslich Verifikation und Restbereinigung
- KEINE neuen Dateien -- hoechstens bestehende Dateien anpassen (max 3)
- KEINE Aenderungen die ueber das Entfernen von promptStyle/negativePrompt-Referenzen hinausgehen
- KEIN Rename von `promptMotiv` zu `prompt` (Out of Scope per Architecture)
- KEINE Aenderungen am Parameter-Panel

**Technische Constraints:**
- Restbereinigung NUR wenn Tests oder Compiler konkrete Fehler melden
- Jede Restbereinigung muss durch einen konkreten Fehler (Test-Failure, TS-Error, API-Error) motiviert sein
- DB-Migration darf nicht auf Produktion ausgefuehrt werden (nur Dev-DB in diesem Slice)
- Manuelle Verifikation erfordert gueltige Replicate API-Credentials

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "Architecture Layers > Data Flow (Target)"
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "API Design > SSE Contract Change"
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "Database Schema > Migration"
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "Quality Attributes (NFRs)"

**Verifikations-Checkliste (manuell abzuarbeiten):**

| # | Check | Command / Action | Expected |
|---|-------|-----------------|----------|
| 1 | Vitest | `pnpm test` | 0 Failures |
| 2 | pytest | `cd backend && python -m pytest -v` | 0 Failures |
| 3 | TypeScript | `npx tsc --noEmit` | 0 Errors |
| 4 | DB-Migration | `pnpm drizzle-kit push` oder SQL manuell | Spalten entfernt |
| 5 | Bildgenerierung | Browser: Prompt eingeben, Flux-Model waehlen, Generate | Bild wird generiert, kein 422 |
| 6 | Assistant Draft | Browser: Assistant oeffnen, Prompt anfordern | 1-Feld-Draft, Apply funktioniert |
| 7 | Canvas Details | Browser: Generation anklicken, Overlay pruefen | Keine Style/Negative Sections |
| 8 | Codebase-Grep | `grep -r "negativePrompt\|promptStyle" --include="*.ts" --include="*.tsx" lib/ app/ components/` | Keine produktiven Treffer (nur Tests/Specs erlaubt) |
