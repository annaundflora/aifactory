# Slice 9: Sync-Button & Progress-Toast

> **Slice 9 von 12** fuer `Model Catalog`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-09-sync-button` |
| **Test** | `pnpm test components/settings/__tests__/settings-dialog-sync.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-05-sync-route", "slice-08-types-seed"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/settings/__tests__/settings-dialog-sync.test.ts` |
| **Integration Command** | -- (fetch + sonner gemockt) |
| **Acceptance Command** | `pnpm test components/settings/__tests__/settings-dialog-sync.test.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (global fetch gemockt fuer `/api/models/sync` Stream-Response, sonner toast gemockt) |

---

## Ziel

Sync-Button in `settings-dialog.tsx` integrieren, der via Streaming-Fetch an `POST /api/models/sync` den Sync ausloest und Progress/Success/Partial/Error-Toasts via sonner anzeigt. Der Button hat 3 visuelle States (idle, syncing, sync_partial) und ein 60s Client-Timeout.

---

## Acceptance Criteria

1) GIVEN das Settings-Dialog ist geoeffnet und kein Sync laeuft
   WHEN der Dialog gerendert wird
   THEN ist ein Button mit Label "Sync Models" sichtbar, positioniert unterhalb des Dialog-Header-Titels (rechts-aligned), im Zustand `idle` und klickbar

2) GIVEN der Sync-Button im Zustand `idle`
   WHEN der User auf "Sync Models" klickt
   THEN wird ein `fetch("POST", "/api/models/sync")` mit `AbortController` (60s Timeout) abgefeuert, der Button wechselt in den Zustand `syncing` (disabled, Spinner-Icon, Label "Syncing..."), und ein Loading-Toast via `toast.loading()` erscheint mit initialem Text "Syncing Models..."

3) GIVEN ein laufender Sync mit Streaming-Response
   WHEN ein Progress-Event `{ type: "progress", completed: 45, total: 120 }` empfangen wird
   THEN wird der bestehende Loading-Toast via `toast.loading("Syncing Models... 45/120", { id })` aktualisiert (gleiche Toast-ID, Text-Update)

4) GIVEN ein laufender Sync
   WHEN ein Complete-Event `{ type: "complete", synced: 120, failed: 0, new: 5, updated: 3 }` empfangen wird (failed === 0)
   THEN wird der Loading-Toast dismissed und ein Success-Toast `toast.success("120 Models synced")` angezeigt (auto-dismiss nach 3s), der Button wechselt zurueck in den Zustand `idle`, und `window.dispatchEvent(new Event("model-settings-changed"))` wird ausgeloest

5) GIVEN ein laufender Sync
   WHEN ein Complete-Event `{ type: "complete", synced: 95, failed: 25, new: 3, updated: 1 }` empfangen wird (failed > 0)
   THEN wird der Loading-Toast dismissed und ein Warning-Toast erscheint mit Text "95 synced, 25 failed" (user-dismissible, KEIN auto-dismiss), der Button wechselt in den Zustand `sync_partial` mit Warning-Badge und Tooltip "Last sync: 25 models failed. Click to retry.", und `window.dispatchEvent(new Event("model-settings-changed"))` wird ausgeloest

6) GIVEN ein laufender Sync
   WHEN ein Error-Event `{ type: "error", message: "Sync bereits aktiv" }` empfangen wird
   THEN wird der Loading-Toast dismissed und ein Error-Toast `toast.error("Sync failed: Sync bereits aktiv")` angezeigt (user-dismissible, KEIN auto-dismiss), der Button wechselt zurueck in den vorherigen Zustand

7) GIVEN ein laufender Sync
   WHEN 60 Sekunden vergehen ohne dass der Stream endet
   THEN wird der Fetch via `AbortController.abort()` abgebrochen, der Loading-Toast dismissed, ein Error-Toast `toast.error("Sync timed out")` angezeigt (user-dismissible), und der Button wechselt in den Zustand `idle`

8) GIVEN der Button im Zustand `syncing`
   WHEN der User versucht den Button zu klicken
   THEN passiert nichts (Button ist `disabled`)

9) GIVEN der Button im Zustand `sync_partial` (Warning-Badge sichtbar)
   WHEN ein neuer Sync erfolgreich abschliesst (failed === 0)
   THEN wird das Warning-Badge entfernt und der Button wechselt in den Zustand `idle`

10) GIVEN ein Fetch-Error (Netzwerkfehler, nicht-2xx Status)
    WHEN der Fetch fehlschlaegt
    THEN wird der Loading-Toast dismissed, ein Error-Toast mit der Fehlermeldung angezeigt (user-dismissible), und der Button wechselt in den vorherigen Zustand

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Der Test-Writer implementiert die Assertions.

### Test-Datei: `components/settings/__tests__/settings-dialog-sync.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('SettingsDialog Sync-Button', () => {
  // AC-1: Sync-Button sichtbar im idle-Zustand
  it.todo('should render Sync Models button in idle state below dialog header')

  // AC-2: Klick startet Fetch + Button wird syncing + Loading-Toast
  it.todo('should start streaming fetch and show loading toast on click')

  // AC-3: Progress-Event aktualisiert Toast-Text
  it.todo('should update loading toast with progress count on progress event')

  // AC-4: Complete-Event (failed=0) -> Success-Toast + idle + dispatchEvent
  it.todo('should show success toast and reset to idle on complete with zero failures')

  // AC-5: Complete-Event (failed>0) -> Warning-Toast + sync_partial + Badge
  it.todo('should show warning toast and switch to sync_partial on complete with failures')

  // AC-6: Error-Event -> Error-Toast
  it.todo('should show error toast on error event from stream')

  // AC-7: 60s Timeout -> Abort + Error-Toast
  it.todo('should abort fetch and show timeout error toast after 60 seconds')

  // AC-8: Button disabled waehrend syncing
  it.todo('should be disabled during syncing state')

  // AC-9: Erfolgreicher Sync nach sync_partial entfernt Badge
  it.todo('should clear warning badge after successful sync following partial')

  // AC-10: Netzwerkfehler -> Error-Toast
  it.todo('should show error toast on fetch network failure')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-05-sync-route` | `POST /api/models/sync` | Route Handler | Streaming Response mit newline-delimited JSON Events (`progress`, `complete`, `error`) |
| `slice-08-types-seed` | `GenerationMode` (5 Werte) | Type Export | Button-State ist unabhaengig von Modes, aber Dialog-Context braucht 5 Modes |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `handleSync()` in settings-dialog | Client-side Function | (kein weiterer Consumer) | Interne Logik, nicht exportiert |
| `window.dispatchEvent("model-settings-changed")` | DOM Event | Dropdown-Components (spaetere Slices) | `window.addEventListener("model-settings-changed", callback)` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/settings/settings-dialog.tsx` -- MODIFY: Sync-Button unterhalb DialogHeader (rechts-aligned) mit 3 States (idle/syncing/sync_partial), `handleSync()` Funktion mit Streaming-Fetch + AbortController (60s Timeout), Toast-Management via sonner (loading/success/warning/error), Warning-Badge + Tooltip bei sync_partial, `window.dispatchEvent("model-settings-changed")` nach erfolgreichem Sync
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an der Sync-Route (`app/api/models/sync/route.ts`)
- KEINE Aenderungen an Server Actions
- KEINE Dropdown-Filter-Logik (kommt in spaeteren Slices)
- KEINE Auto-Sync-Logik bei leerem Katalog (kommt in spaeteren Slices)
- KEIN Cancel-Button im Toast (bewusst vereinfacht, siehe Discovery)
- KEINE Aenderungen an `model-mode-section.tsx`

**Technische Constraints:**
- `settings-dialog.tsx` ist eine Client Component (`"use client"`)
- Toast via `sonner`: `toast.loading()` gibt eine ID zurueck, `toast.loading(msg, { id })` fuer Updates, `toast.success()` / `toast.error()` / `toast.warning()` fuer Ergebnis
- Stream-Parsing: `response.body.getReader()` + `TextDecoder` + Split by `"\n"` + `JSON.parse()` pro Event
- AbortController mit `setTimeout(60_000)` — Timeout MUSS im `finally`-Block gecleant werden
- Warning-Badge State (`failedCount`) muss als React-State persistiert werden (ueberlebt Dialog open/close NICHT — wird bei Reopen auf idle zurueckgesetzt, es sei denn in Parent-State gehoben)
- `window.dispatchEvent(new Event("model-settings-changed"))` nach jedem erfolgreichen/partiellen Sync

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/settings/settings-dialog.tsx` | MODIFY — Sync-Button + handleSync + Toast-Logic hinzufuegen |
| `sonner` (npm Package) | Import `toast` — bestehendes Toast-Pattern der App nutzen |
| `components/ui/button.tsx` | Import — shadcn Button Component fuer Sync-Button |

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` --> Section "Stream Events" (3 Event-Typen mit Payloads)
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` --> Section "Data Flow" --> "Sync Flow" (Client reads stream -> updates toast)
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` --> Section "Rate Limiting" --> "Client sync timeout" (60s)
- Wireframes: `specs/phase-7/2026-03-15-model-catalog/wireframes.md` --> Section "Sync-Button States" (idle/syncing/sync_partial Visuals)
- Wireframes: `specs/phase-7/2026-03-15-model-catalog/wireframes.md` --> Section "Sync Toast — All States" (progress/success/partial/error)
- Discovery: `specs/phase-7/2026-03-15-model-catalog/discovery.md` --> Section "Feature State Machine" (Transitions)
