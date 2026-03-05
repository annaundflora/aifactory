# Slice 16: Generation Retry + Toast Provider

> **Slice 16 von 21** fuer `E2E Generate & Persist`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-16-generation-delete-retry` |
| **Test** | `pnpm test components/shared/__tests__/toast-provider.test.tsx components/workspace/__tests__/generation-retry.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-10-generation-placeholder-polling", "slice-08-generation-service-actions"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/shared/__tests__/toast-provider.test.tsx components/workspace/__tests__/generation-retry.test.tsx` |
| **Integration Command** | `pnpm test components/shared/__tests__/toast-provider.test.tsx components/workspace/__tests__/generation-retry.test.tsx` |
| **Acceptance Command** | `pnpm test components/shared/__tests__/toast-provider.test.tsx components/workspace/__tests__/generation-retry.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/` |
| **Mocking Strategy** | `mock_external` (Server Actions gemockt, sonner toast-Aufrufe verifiziert) |

---

## Ziel

Toast-Provider (sonner) global im Root Layout einbinden und Error-Toast-Handling fuer alle definierten Fehlerszenarien implementieren (Replicate API, R2 Upload, Rate Limit 429). Retry-Button auf fehlgeschlagenen Generation-Placeholdern wird mit der `retryGeneration` Server Action verknuepft und loest Toast-Feedback bei Fehler aus.

---

## Acceptance Criteria

1) GIVEN das Root Layout (`app/layout.tsx`) wird gerendert
   WHEN die Seite geladen wird
   THEN ist der `ToastProvider` (`<Toaster />` von sonner) im Layout eingebunden und bereit Notifications anzuzeigen

2) GIVEN eine Generation mit `status: "failed"`
   WHEN der Retry-Button auf dem Placeholder geklickt wird
   THEN wird `retryGeneration({ id: generationId })` aufgerufen und der Placeholder wechselt zurueck in den Pending/Skeleton-State (kein Toast bei Erfolg)

3) GIVEN `retryGeneration` gibt `{ error: "..." }` zurueck
   WHEN der Retry-Button geklickt wurde
   THEN wird ein Error-Toast mit der Fehlermeldung aus dem error-Objekt angezeigt

4) GIVEN eine Generation schlaegt fehl mit Replicate API Error (error_message enthaelt "Replicate API error")
   WHEN der Generation-Status auf "failed" wechselt und der Polling-Hook die Aenderung erkennt
   THEN wird ein Error-Toast mit dem Text der `error_message` aus der Generation angezeigt

5) GIVEN eine Generation schlaegt fehl mit R2 Upload Error (error_message enthaelt "R2" oder "upload")
   WHEN der Generation-Status auf "failed" wechselt
   THEN wird ein Error-Toast angezeigt: "Bild konnte nicht gespeichert werden"

6) GIVEN Replicate antwortet mit HTTP 429 (error_message enthaelt "429" oder "rate limit")
   WHEN der Generation-Status auf "failed" wechselt
   THEN wird ein Error-Toast angezeigt: "Zu viele Anfragen. Bitte kurz warten."

7) GIVEN ein Toast wird angezeigt
   WHEN die konfigurierte Anzeigedauer (Standard: 5 Sekunden) ablaeuft
   THEN verschwindet der Toast automatisch ohne User-Interaktion

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/shared/__tests__/toast-provider.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ToastProvider', () => {
  // AC-1: Toaster im Layout eingebunden
  it.todo('should render sonner Toaster in root layout')

  // AC-7: Auto-Dismiss nach konfigurierter Dauer
  it.todo('should auto-dismiss toast after configured duration')
})
```
</test_spec>

### Test-Datei: `components/workspace/__tests__/generation-retry.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Generation Retry Button', () => {
  // AC-2: Retry ruft retryGeneration auf, kein Toast bei Erfolg
  it.todo('should call retryGeneration and switch placeholder to pending state without toast on success')

  // AC-3: Retry-Fehler zeigt Toast
  it.todo('should show error toast with message when retryGeneration returns error object')
})

describe('Generation Error Toast Handling', () => {
  // AC-4: Replicate API Error Toast
  it.todo('should show error toast with error_message when generation fails due to Replicate API error')

  // AC-5: R2 Upload Error Toast
  it.todo('should show error toast "Bild konnte nicht gespeichert werden" for R2 upload failure')

  // AC-6: Rate Limit Toast
  it.todo('should show error toast "Zu viele Anfragen. Bitte kurz warten." for HTTP 429 rate limit')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-08` | `retryGeneration` | Server Action | `(input: { id: string }) => Promise<Generation \| { error: string }>` |
| `slice-10` | `GenerationPlaceholder` | Client Component | Placeholder mit failed-State, Retry-Button und `onError` Callback |
| `slice-10` | `useGenerationPolling` | Custom Hook | Liefert Generation-Updates inkl. `status` und `error_message` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ToastProvider` | Client Component | `app/layout.tsx` | `<ToastProvider />` wrapping sonner `<Toaster />` mit 5s duration |
| Error-Toast-Logik | Integration in `GenerationPlaceholder` | slice-10 (Erweiterung) | `toast.error(message: string)` via sonner |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/shared/toast-provider.tsx` -- Client Component: Wraps sonner `<Toaster />` mit App-weiter Konfiguration (duration: 5000ms), eingebunden in `app/layout.tsx`
- [ ] `components/workspace/generation-placeholder.tsx` -- MODIFY EXISTING: Retry-Button mit `retryGeneration`-Aufruf verknuepfen, `onError` Callback fuer Error-Toast-Handling im failed-State (AC-2, AC-3, AC-4, AC-5, AC-6)
- [ ] `app/layout.tsx` -- MODIFY EXISTING: `<ToastProvider />` ins Root Layout einbinden (AC-1)
<!-- DELIVERABLES_END -->

---

## Constraints

**Scope-Grenzen:**
- KEIN deleteGeneration -- gehoert zu Slice 13 (Lightbox Actions)
- KEINE neuen Server Actions -- `retryGeneration` existiert bereits aus Slice 08
- KEINE Success-Toasts fuer abgeschlossene Generierungen -- fertiges Bild in der Galerie ist das Feedback
- KEIN eigenes Toast-System -- nur sonner API (`toast.error()`)
- KEINE Aenderung am Polling-Mechanismus -- kommt aus Slice 10

**Technische Constraints:**
- Toast-Library: `sonner` (via shadcn/ui, bereits als Dependency in architecture.md)
- `ToastProvider` als Client Component (`"use client"`)
- Fehler-Kategorisierung basierend auf `error_message` String-Matching
- Tailwind v4 fuer Styling

**Referenzen:**
- Architecture: `architecture.md` -> Section "Error Handling Strategy" (alle Error-Types, User-Responses und Toast-Texte)
- Architecture: `architecture.md` -> Section "Project Structure" (`components/shared/toast-provider.tsx`, `app/layout.tsx`)
- Architecture: `architecture.md` -> Section "Constraints & Integrations" (sonner via shadcn/ui)
- Wireframes: `wireframes.md` -> Section "Screen: Project Workspace" (State "generation-failed" mit retry-btn)
