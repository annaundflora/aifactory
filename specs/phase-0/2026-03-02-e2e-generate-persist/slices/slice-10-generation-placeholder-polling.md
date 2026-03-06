# Slice 10: Generation Placeholder + Status-Polling implementieren

> **Slice 10 von 21** fuer `E2E Generate & Persist`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-10-generation-placeholder-polling` |
| **Test** | `pnpm test components/workspace/__tests__/generation-placeholder.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-09-prompt-area-parameter-panel"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/__tests__/generation-placeholder.test.tsx` |
| **Integration Command** | `pnpm test components/workspace/__tests__/generation-placeholder.test.tsx` |
| **Acceptance Command** | `pnpm test components/workspace/__tests__/generation-placeholder.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/` |
| **Mocking Strategy** | `mock_external` (Server Actions und Polling-Responses werden gemockt) |

---

## Ziel

Generation-Placeholder-Component die sofort nach dem Generate-Klick als Skeleton in der Galerie erscheint, den Status pending/completed/failed visuell abbildet und bei Completion durch das fertige Bild ersetzt wird. Dazu ein Polling- oder Revalidation-Mechanismus der den Generation-Status aus der DB abfragt und die UI aktualisiert.

---

## Acceptance Criteria

1) GIVEN eine Generation mit `status: "pending"` existiert
   WHEN der Placeholder gerendert wird
   THEN zeigt er eine Skeleton-Animation (pulsierendes Rechteck) mit der gleichen Grundgroesse wie eine generation-card

2) GIVEN eine Generation mit `status: "pending"` existiert
   WHEN der Placeholder gerendert wird
   THEN zeigt er einen visuellen Indikator dass eine Generierung laeuft (z.B. Spinner oder animierter Skeleton-Shimmer)

3) GIVEN eine Generation wechselt von `status: "pending"` zu `status: "completed"` mit gesetzter `image_url`
   WHEN das naechste Polling-Intervall die Aenderung erkennt
   THEN wird der Placeholder durch das fertige Bild ersetzt (Transition zum fertigen Zustand)

4) GIVEN eine Generation wechselt von `status: "pending"` zu `status: "failed"` mit gesetzter `error_message`
   WHEN das naechste Polling-Intervall die Aenderung erkennt
   THEN zeigt der Placeholder einen Error-State mit Fehler-Icon, den Text "Generation fehlgeschlagen" und einen Retry-Button

5) GIVEN der Placeholder im Error-State (`status: "failed"`)
   WHEN der User den Retry-Button klickt
   THEN wird die `retryGeneration` Server Action mit der Generation-ID aufgerufen und der Placeholder wechselt zurueck in den Pending/Skeleton-State

6) GIVEN es gibt 3 pending Generierungen (z.B. count=3 Batch)
   WHEN die Placeholders gerendert werden
   THEN werden 3 separate Placeholder-Elemente angezeigt, jeder mit eigenem Status-Tracking

7) GIVEN es existieren pending Generierungen
   WHEN Polling aktiv ist
   THEN wird der Generation-Status in einem regelmaessigen Intervall (2-5 Sekunden) per Server Action abgefragt

8) GIVEN keine pending Generierungen mehr existieren (alle completed oder failed)
   WHEN das Polling-Intervall laeuft
   THEN wird das Polling gestoppt (kein unnoetriger Netzwerk-Traffic)

9) GIVEN der User navigiert weg von der Workspace-Seite
   WHEN Polling aktiv war
   THEN wird das Polling-Intervall aufgeraeumt (kein Memory Leak, kein weiter laufendes Interval)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/workspace/__tests__/generation-placeholder.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('GenerationPlaceholder', () => {
  // AC-1: Skeleton bei pending
  it.todo('should render a skeleton animation for a pending generation')

  // AC-2: Loading-Indikator
  it.todo('should show a visual loading indicator (spinner or shimmer) for pending state')

  // AC-3: Completed ersetzt Placeholder
  it.todo('should replace placeholder with completed image when status changes to completed')

  // AC-4: Error-State bei failed
  it.todo('should show error icon, failure text, and retry button when status is failed')

  // AC-5: Retry-Button ruft retryGeneration auf
  it.todo('should call retryGeneration action and return to pending state when retry is clicked')

  // AC-6: Mehrere Placeholders fuer Batch
  it.todo('should render separate placeholder elements for each pending generation in a batch')
})

describe('Generation Status Polling', () => {
  // AC-7: Regelmaessiges Polling-Intervall
  it.todo('should poll generation status at regular intervals while pending generations exist')

  // AC-8: Polling stoppt wenn keine pending mehr
  it.todo('should stop polling when no pending generations remain')

  // AC-9: Cleanup bei Unmount
  it.todo('should clean up polling interval on component unmount')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-08` | `retryGeneration` | Server Action | `(input: { id: string }) => Promise<Generation \| { error: string }>` |
| `slice-02` | `getGenerations` | Query Function / Server Action | `(projectId) => Promise<Generation[]>` -- fuer Polling der aktuellen Statuswerte |
| `slice-09` | `PromptArea` | Client Component | Liefert den Trigger-Kontext: nach `generateImages` Call werden pending Generations zurueckgegeben |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `GenerationPlaceholder` | Client Component | slice-11 (Gallery Grid) | `<GenerationPlaceholder generation={Generation} onCompleted={callback} onRetry={callback} />` |
| `useGenerationPolling` | Custom Hook | Workspace Page / Gallery | `(projectId: string, pendingIds: string[]) => Generation[]` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/generation-placeholder.tsx` -- Client Component: Skeleton-Placeholder (pending), Error-State (failed) mit Retry-Button, Polling-Hook fuer Status-Updates
<!-- DELIVERABLES_END -->

---

## Constraints

**Scope-Grenzen:**
- KEINE Gallery-Grid-Anordnung -- kommt in Slice 11
- KEINE generation-card fuer completed Bilder -- kommt in Slice 11
- KEINE Toast-Notifications bei Fehler -- kommt in Slice 16
- KEINE Lightbox-Integration -- kommt in Slice 12
- KEIN Delete von fehlgeschlagenen Generierungen -- kommt in Slice 16

**Technische Constraints:**
- Client Component (`"use client"`)
- Polling via `setInterval` + `useEffect` Cleanup oder `useSWR`/`useQuery` mit Refetch-Intervall
- shadcn/ui Skeleton fuer Loading-State
- shadcn/ui Button fuer Retry-Button
- Tailwind v4 fuer Styling
- Polling-Intervall zwischen 2-5 Sekunden (konfigurierbar)

**Referenzen:**
- Wireframes: `wireframes.md` -> Section "Screen: Project Workspace" (State "generating" und "generation-failed")
- Architecture: `architecture.md` -> Section "Constraints & Integrations" (Blocking API, DB-Status-Polling oder Revalidation)
- Architecture: `architecture.md` -> Section "Business Logic Flow: Image Generation" (Status-Uebergaenge pending -> completed/failed)
- Discovery: `discovery.md` -> Section "UI Components & States" (generation-placeholder: States loading, failed)
- Discovery: `discovery.md` -> Section "Feature State Machine" (Transitions generating -> workspace-populated / generation-failed)
