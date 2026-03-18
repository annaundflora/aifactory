# Slice 11: Auto-Sync & On-the-fly Schema-Fetch

> **Slice 11 von 12** fuer `Model Catalog`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-11-auto-sync` |
| **Test** | `pnpm test components/settings/__tests__/settings-dialog-auto-sync.test.ts lib/hooks/__tests__/use-model-schema-loading.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-09-sync-button", "slice-10-dropdown-filter"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/settings/__tests__/settings-dialog-auto-sync.test.ts lib/hooks/__tests__/use-model-schema-loading.test.ts` |
| **Integration Command** | -- (Server Actions + fetch gemockt) |
| **Acceptance Command** | `pnpm test components/settings/__tests__/settings-dialog-auto-sync.test.ts lib/hooks/__tests__/use-model-schema-loading.test.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (Server Action `getModels` gemockt fuer Empty-Check, global fetch gemockt fuer `/api/models/sync` Stream, sonner toast gemockt) |

---

## Ziel

Beim App-Start (Settings-Dialog mount) pruefen ob die `models`-Tabelle leer ist und bei leerem Katalog automatisch einen Sync triggern, sodass der User ohne manuelle Aktion einen befuellten Katalog erhaelt. Zusaetzlich den `useModelSchema`-Hook so erweitern, dass waehrend eines On-the-fly Schema-Fetchs ein Loading-Spinner im Parameter-Panel sichtbar ist.

---

## Acceptance Criteria

1) GIVEN die `models`-Tabelle ist leer (alle `getModels`-Calls geben leere Arrays zurueck)
   WHEN `settings-dialog.tsx` zum ersten Mal gemountet wird (Dialog oeffnet ODER App-Start)
   THEN wird automatisch ein Sync gestartet (gleiche `handleSync`-Logik wie Sync-Button-Klick aus Slice 09), der Sync-Button wechselt in den Zustand `syncing`, und ein Progress-Toast erscheint mit "Syncing Models..."

2) GIVEN die `models`-Tabelle enthaelt mindestens 1 aktives Model
   WHEN `settings-dialog.tsx` gemountet wird
   THEN wird KEIN Auto-Sync gestartet und der Sync-Button bleibt im Zustand `idle`

3) GIVEN ein Auto-Sync laeuft bereits (ausgeloest durch leeren Katalog)
   WHEN der User den Sync-Button manuell klickt
   THEN passiert nichts (Button ist `disabled` im `syncing`-Zustand, identisch zu Slice 09 AC-8)

4) GIVEN ein Auto-Sync laeuft
   WHEN der Workspace hinter dem Toast sichtbar ist
   THEN bleibt der Workspace vollstaendig interaktiv (Toast ist non-blocking Overlay, kein Modal-Blocker)

5) GIVEN ein Auto-Sync schliesst erfolgreich ab (failed === 0)
   WHEN die Complete-Events verarbeitet werden
   THEN werden die Dropdowns automatisch befuellt (via `window.dispatchEvent("model-settings-changed")`, bereits aus Slice 09), und der Success-Toast "X Models synced" erscheint mit auto-dismiss nach 3s

6) GIVEN ein Auto-Sync schliesst mit Teilfehler ab (failed > 0)
   WHEN die Complete-Events verarbeitet werden
   THEN erscheint ein Warning-Toast (user-dismissible) und der Sync-Button zeigt das Warning-Badge (identisch zu Slice 09 AC-5)

7) GIVEN der Auto-Sync-Check hat bereits einmal gelaufen (Dialog wurde geschlossen und wieder geoeffnet)
   WHEN der Dialog erneut geoeffnet wird und Models vorhanden sind
   THEN wird KEIN erneuter Auto-Sync ausgeloest

8) GIVEN ein User waehlt ein Model im Dropdown und `useModelSchema` startet einen Fetch (weil `input_schema` in DB null ist)
   WHEN `isLoading === true` im `useModelSchema`-Hook
   THEN zeigt das Parameter-Panel einen Loading-Spinner an (visueller Indikator unterhalb des Dropdowns, nicht im Dropdown selbst)

9) GIVEN der `useModelSchema`-Hook hat das Schema erfolgreich geladen (`isLoading` wechselt von `true` zu `false`, `schema` ist nicht null)
   WHEN das Schema verfuegbar wird
   THEN verschwindet der Loading-Spinner und das Parameter-Panel rendert die Schema-Properties (Enums als Select, Numbers als Input)

10) GIVEN der `useModelSchema`-Hook gibt einen Fehler zurueck (`error` ist nicht null)
    WHEN der Fehler eintritt
    THEN zeigt das Parameter-Panel eine Fehlermeldung statt des Spinners an

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Der Test-Writer implementiert die Assertions.

### Test-Datei: `components/settings/__tests__/settings-dialog-auto-sync.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('SettingsDialog Auto-Sync', () => {
  // AC-1: Auto-Sync bei leerer models-Tabelle
  it.todo('should trigger sync automatically when all getModels calls return empty arrays')

  // AC-2: Kein Auto-Sync wenn Models vorhanden
  it.todo('should not trigger auto-sync when models exist in database')

  // AC-3: Button disabled waehrend Auto-Sync
  it.todo('should disable sync button during auto-sync')

  // AC-4: Workspace bleibt interaktiv waehrend Auto-Sync (Toast ist non-blocking)
  it.todo('should not block workspace interaction during auto-sync toast')

  // AC-5: Auto-Sync Success -> Dropdowns aktualisiert
  it.todo('should dispatch model-settings-changed event after successful auto-sync')

  // AC-6: Auto-Sync Partial -> Warning-Toast + Badge
  it.todo('should show warning toast and badge after auto-sync with failures')

  // AC-7: Kein erneuter Auto-Sync bei Reopen mit vorhandenen Models
  it.todo('should not trigger auto-sync on dialog reopen when models exist')
})
```
</test_spec>

### Test-Datei: `lib/hooks/__tests__/use-model-schema-loading.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('useModelSchema Loading-State Anzeige', () => {
  // AC-8: Loading-Spinner waehrend Schema-Fetch
  it.todo('should expose isLoading=true while schema fetch is in progress')

  // AC-9: Schema geladen -> isLoading=false, schema nicht null
  it.todo('should set isLoading=false and return schema after successful fetch')

  // AC-10: Fehler -> error gesetzt, schema null
  it.todo('should set error and null schema on fetch failure')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-09-sync-button` | `handleSync()` Logik in `settings-dialog.tsx` | Interne Funktion | Streaming-Fetch + Toast + Button-State-Management bereits implementiert |
| `slice-09-sync-button` | `window.dispatchEvent("model-settings-changed")` | DOM Event | Wird nach Sync dispatched; Dropdowns lauschen darauf |
| `slice-10-dropdown-filter` | `getModels({ capability })` Aufrufe im Dialog | Server Action Calls | 5 Calls beim Mount — Ergebnis dient als Empty-Check |
| `slice-06-server-actions` | `getModelSchema({ modelId })` | Server Action | DB-first mit On-the-fly-Fallback (Backend-seitig bereits implementiert) |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Auto-Sync-Trigger bei leerem Katalog | Logik in `settings-dialog.tsx` | (Endnutzer — erster App-Start) | Automatisch, kein Export |
| Loading-State-Darstellung im Parameter-Panel | UI-Verhalten | (Endnutzer) | `useModelSchema.isLoading` wird visuell abgebildet |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/settings/settings-dialog.tsx` -- MODIFY: Auto-Sync-Check beim Mount hinzufuegen: nach den `getModels`-Calls pruefen ob ALLE Ergebnisse leer sind, wenn ja `handleSync()` automatisch aufrufen. Kein neuer State noetig — nutzt existierenden Sync-State aus Slice 09
- [ ] `lib/hooks/use-model-schema.ts` -- MODIFY (minimal): Sicherstellen dass `isLoading`-State korrekt exponiert wird fuer Parameter-Panel Loading-Spinner. Aktuell bereits implementiert — ggf. nur Verifizierung oder minimale Anpassung fuer konsistenten Loading-State-Uebergang
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderung an Server Actions (`app/actions/models.ts`) — On-the-fly-Fetch Backend-seitig bereits in Slice 06 implementiert
- KEINE Aenderung an der Sync-Route (`app/api/models/sync/route.ts`)
- KEINE Aenderung an `model-mode-section.tsx` — Empty-State-Messages bereits in Slice 10
- KEINE neue Polling-Logik oder Cron-basierter Sync
- KEIN Auto-Sync bei nicht-leerem Katalog (nur bei komplett leerem Katalog)
- KEINE Aenderung an `model-sync-service.ts` oder `model-catalog-service.ts`
- Parameter-Panel Loading-Spinner: Nutzt den bestehenden `isLoading`-State des `useModelSchema`-Hooks — KEINE neue Datenquelle

**Technische Constraints:**
- Auto-Sync-Check MUSS nach dem initialen `getModels`-Daten-Laden erfolgen (nicht vorher), da die Ergebnisse als Empty-Check dienen
- Auto-Sync nutzt dieselbe `handleSync()`-Funktion wie der manuelle Sync-Button (kein separater Codepfad)
- Auto-Sync darf den Dialog NICHT blockieren — Workspace bleibt nutzbar (non-blocking Toast)
- `useModelSchema` Hook-Interface (`schema`, `isLoading`, `error`) bleibt stabil — Parameter-Panel konsumiert diese drei Werte bereits
- Loading-Spinner-Darstellung im Parameter-Panel: Spinner erscheint im Panel-Bereich unterhalb des Dropdowns, NICHT im Dropdown selbst

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/settings/settings-dialog.tsx` | MODIFY — Auto-Sync-Check einbauen. Sync-Button + handleSync-Code (Slice 09) und Dropdown-Filter-Code (Slice 10) bleiben unveraendert |
| `lib/hooks/use-model-schema.ts` | MODIFY (minimal) — Bestehender Hook exponiert bereits `isLoading`. Sicherstellen dass Loading-Uebergang konsistent ist |
| `sonner` (npm Package) | Import `toast` — bestehendes Toast-Pattern, identisch zu Slice 09 |

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` --> Section "Architecture Layers" --> "Schema Read Flow" (DB read first, if null -> fetch from API)
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` --> Section "Data Flow" --> "Sync Flow" (Client reads stream -> updates toast)
- Wireframes: `specs/phase-7/2026-03-15-model-catalog/wireframes.md` --> Section "Workspace -- First Start (Empty DB)" (Auto-Sync Toast im Workspace)
- Wireframes: `specs/phase-7/2026-03-15-model-catalog/wireframes.md` --> Section "Model-Dropdown (Capability-Filtered)" --> State `loading` (Spinner im Parameter-Panel)
- Discovery: `specs/phase-7/2026-03-15-model-catalog/discovery.md` --> Section "User Flow" --> "Flow 1: Erster App-Start (leere DB)"
- Discovery: `specs/phase-7/2026-03-15-model-catalog/discovery.md` --> Section "Feature State Machine" --> Transition `no_models -> syncing`
