# Slice 16: Generation Delete + Retry + Toast-Provider

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
| **Mocking Strategy** | `mock_external` (Server Actions gemockt, Toast-Calls verifiziert) |

---

## Ziel

Toast-Provider (sonner) global im Root Layout einbinden und Retry-Button auf fehlgeschlagenen Generation-Placeholdern mit der `retryGeneration` Server Action verknuepfen. Error-Toast-Notifications fuer alle definierten Fehlerszenarien (Replicate API, R2 Upload, Rate Limit) integrieren.

---

## Acceptance Criteria

1) GIVEN das Root Layout (`app/layout.tsx`) wird gerendert
   WHEN die Seite geladen wird
   THEN ist ein `<Toaster />` (sonner) im Layout eingebunden und bereit Toast-Notifications anzuzeigen

2) GIVEN eine Generation mit `status: "failed"` und `error_message: "Replicate API error: model timeout"`
   WHEN der Retry-Button auf dem Placeholder geklickt wird
   THEN wird `retryGeneration({ id: generationId })` aufgerufen und der Placeholder wechselt zurueck in den Pending/Skeleton-State

3) GIVEN `retryGeneration` gibt ein Fehler-Objekt `{ error: "..." }` zurueck (z.B. Generation nicht gefunden)
   WHEN der Retry-Button geklickt wurde
   THEN wird ein Error-Toast mit der Fehlermeldung angezeigt

4) GIVEN eine `generateImages` Action schlaegt fehl (Replicate API Error)
   WHEN die Generation fehlschlaegt und der Status auf "failed" wechselt
   THEN wird ein Error-Toast angezeigt mit dem Text der `error_message` aus der Generation

5) GIVEN eine `generateImages` Action schlaegt fehl (R2 Upload Error)
   WHEN die Generation fehlschlaegt
   THEN wird ein Error-Toast angezeigt: "Bild konnte nicht gespeichert werden"

6) GIVEN Replicate antwortet mit HTTP 429 (Rate Limit)
   WHEN die Generation fehlschlaegt
   THEN wird ein Error-Toast angezeigt: "Zu viele Anfragen. Bitte kurz warten."

7) GIVEN ein Toast wird angezeigt
   WHEN die konfigurierte Dauer ablaeuft (Standard: 5 Sekunden)
   THEN verschwindet der Toast automatisch

8) GIVEN der Retry-Button wird geklickt und `retryGeneration` ist erfolgreich
   WHEN die Generation erneut pending wird
   THEN wird KEIN zusaetzlicher Toast angezeigt (stilles Retry, Placeholder zeigt Skeleton)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/shared/__tests__/toast-provider.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ToastProvider', () => {
  // AC-1: Toaster im Layout
  it.todo('should render sonner Toaster component')

  // AC-7: Auto-Dismiss
  it.todo('should auto-dismiss toast after configured duration')
})
```
</test_spec>

### Test-Datei: `components/workspace/__tests__/generation-retry.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Generation Retry + Error Toasts', () => {
  // AC-2: Retry ruft retryGeneration auf
  it.todo('should call retryGeneration action and switch placeholder back to pending state on retry click')

  // AC-3: Retry-Fehler zeigt Toast
  it.todo('should show error toast when retryGeneration returns error object')

  // AC-4: Replicate API Error Toast
  it.todo('should show error toast with error_message when generation fails due to Replicate API error')

  // AC-5: R2 Upload Error Toast
  it.todo('should show error toast "Bild konnte nicht gespeichert werden" for R2 upload failure')

  // AC-6: Rate Limit Toast
  it.todo('should show error toast "Zu viele Anfragen. Bitte kurz warten." for HTTP 429 rate limit')

  // AC-8: Kein Toast bei erfolgreichem Retry
  it.todo('should not show any toast when retry is successful and generation returns to pending')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-08` | `retryGeneration` | Server Action | `(input: { id: string }) => Promise<Generation \| { error: string }>` |
| `slice-10` | `GenerationPlaceholder` | Client Component | Placeholder mit failed-State und Retry-Button-Slot |
| `slice-10` | `useGenerationPolling` | Custom Hook | Liefert aktuelle Generation-Status inkl. `error_message` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ToastProvider` | Client Component | `app/layout.tsx` (Root Layout) | `<ToastProvider />` wrapping `<Toaster />` von sonner |
| `toast` Aufrufe | Utility | Alle Slices mit Fehlerbehandlung | `toast.error(message: string)` via sonner API |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/shared/toast-provider.tsx` -- Client Component: Wraps sonner `<Toaster />` mit App-weiter Konfiguration, eingebunden in Root Layout
<!-- DELIVERABLES_END -->

> **Hinweis:** Die Retry-Logik und Toast-Aufrufe werden in bestehende Dateien integriert (`generation-placeholder.tsx` aus Slice 10, `app/layout.tsx`). Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE neuen Server Actions -- `retryGeneration` existiert bereits aus Slice 08
- KEINE delete-Funktion fuer fehlgeschlagene Generierungen aus der Galerie -- deleteGeneration ist in Slice 13 (Lightbox Actions)
- KEINE Success-Toasts fuer abgeschlossene Generierungen -- das fertige Bild in der Galerie ist das Feedback
- KEINE Aenderung am Polling-Mechanismus -- kommt aus Slice 10

**Technische Constraints:**
- Toast-Library: `sonner` (via shadcn/ui, bereits als Dependency in architecture.md definiert)
- `ToastProvider` als Client Component (`"use client"`)
- Toast-Aufrufe via `toast.error()` von sonner -- kein eigenes Toast-System
- Fehler-Kategorisierung basierend auf `error_message` String-Matching (Replicate, R2, Rate Limit)
- Tailwind v4 fuer Styling

**Referenzen:**
- Architecture: `architecture.md` -> Section "Error Handling Strategy" (alle Error-Types und User-Responses)
- Architecture: `architecture.md` -> Section "Constraints & Integrations" (sonner via shadcn/ui)
- Architecture: `architecture.md` -> Section "Project Structure" (`components/shared/toast-provider.tsx`, `app/layout.tsx`)
- Wireframes: `wireframes.md` -> Section "Screen: Project Workspace" (State "generation-failed" mit retry-btn)
- Discovery: `discovery.md` -> Section "Error Paths" (Toast-Texte fuer Replicate, R2, Rate Limit)
