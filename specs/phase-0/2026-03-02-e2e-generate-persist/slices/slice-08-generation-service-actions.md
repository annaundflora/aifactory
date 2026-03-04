# Slice 8: Generation Service + Actions implementieren

> **Slice 8 von 21** fuer `E2E Generate & Persist`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-08-generation-service-actions` |
| **Test** | `pnpm test lib/services/__tests__/generation-service.test.ts app/actions/__tests__/generations.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-07-replicate-storage-clients", "slice-02-db-connection-queries"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/services/__tests__/generation-service.test.ts app/actions/__tests__/generations.test.ts` |
| **Integration Command** | `docker compose up -d && pnpm drizzle-kit migrate && pnpm test lib/services/__tests__/generation-service.integration.test.ts` |
| **Acceptance Command** | `docker compose up -d && pnpm drizzle-kit migrate && pnpm test lib/services/__tests__/generation-service.integration.test.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `localhost:3000` |
| **Mocking Strategy** | `mock_external` (Unit-Tests mocken ReplicateClient, StorageService und DB-Queries; Integration-Tests gegen echte DB + gemockte externe APIs) |

---

## Ziel

GenerationService als Orchestrierungs-Schicht implementieren, die den kompletten Generation-Flow steuert: DB-Insert mit Status "pending", Replicate-Call, optionale PNG-Konvertierung via sharp, R2-Upload, DB-Update auf "completed" oder "failed". Server Actions `generateImages` und `retryGeneration` exponieren den Service fuer UI-Slices.

---

## Acceptance Criteria

1) GIVEN ein gueltiges Projekt und Prompt
   WHEN `generateImages({ projectId, prompt: "A fox", modelId: "black-forest-labs/flux-2-pro", params: {}, count: 2 })` aufgerufen wird
   THEN werden 2 Generation-Datensaetze mit `status: "pending"` in der DB erstellt und als Array zurueckgegeben

2) GIVEN pending Generations wurden erstellt
   WHEN der Generation-Flow fuer eine Generation erfolgreich durchlaeuft
   THEN wird ReplicateClient.run() mit modelId und Input aufgerufen, der Output-Stream an StorageService.upload() mit Key `"projects/{projectId}/{generationId}.png"` uebergeben, und die Generation in der DB auf `status: "completed"` mit `image_url`, `width`, `height`, `seed` und `replicate_prediction_id` aktualisiert

3) GIVEN der Replicate-Call schlaegt fehl (API-Fehler)
   WHEN der Generation-Flow fuer diese Generation laeuft
   THEN wird die Generation in der DB auf `status: "failed"` mit `error_message` aktualisiert und KEIN R2-Upload durchgefuehrt

4) GIVEN der R2-Upload schlaegt fehl nach erfolgreichem Replicate-Call
   WHEN der Generation-Flow fuer diese Generation laeuft
   THEN wird die Generation in der DB auf `status: "failed"` mit `error_message` aktualisiert

5) GIVEN count=3 und eine der 3 Generierungen schlaegt fehl
   WHEN der Generation-Flow laeuft
   THEN werden die anderen 2 Generierungen unabhaengig davon erfolgreich abgeschlossen (parallele Verarbeitung, kein Abbruch)

6) GIVEN Replicate liefert ein Nicht-PNG-Format (z.B. WebP)
   WHEN der Generation-Flow laeuft
   THEN wird der Output vor dem R2-Upload via sharp nach PNG konvertiert

7) GIVEN eine Generation mit `status: "failed"` und bekannter ID
   WHEN `retryGeneration({ id })` aufgerufen wird
   THEN wird die Generation auf `status: "pending"` zurueckgesetzt und der Generation-Flow erneut gestartet (Replicate-Call, R2-Upload, DB-Update)

8) GIVEN `retryGeneration` wird mit einer ID aufgerufen, deren Status NICHT "failed" ist
   WHEN die Action ausgefuehrt wird
   THEN wird ein Fehler-Objekt `{ error: "Nur fehlgeschlagene Generierungen koennen wiederholt werden" }` zurueckgegeben

9) GIVEN `generateImages` wird mit leerem Prompt aufgerufen
   WHEN die Action ausgefuehrt wird
   THEN wird ein Fehler-Objekt `{ error: "Prompt darf nicht leer sein" }` zurueckgegeben

10) GIVEN `generateImages` wird mit unbekanntem modelId aufgerufen
    WHEN die Action ausgefuehrt wird
    THEN wird ein Fehler-Objekt `{ error: "Unbekanntes Modell" }` zurueckgegeben

11) GIVEN `generateImages` wird mit count=5 aufgerufen
    WHEN die Action ausgefuehrt wird
    THEN wird ein Fehler-Objekt `{ error: "Anzahl muss zwischen 1 und 4 liegen" }` zurueckgegeben

12) GIVEN `app/actions/generations.ts` existiert
    WHEN die Datei inspiziert wird
    THEN beginnt sie mit `"use server"` als erste Zeile

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/services/__tests__/generation-service.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('GenerationService', () => {
  // AC-1: Pending-Eintraege erstellen
  it.todo('should create N pending generation records in DB and return them')

  // AC-2: Erfolgreicher Flow
  it.todo('should call ReplicateClient.run, upload to R2, and update DB to completed with image_url, width, height, seed, predictionId')

  // AC-3: Replicate-Fehler
  it.todo('should set status to failed with error_message when Replicate call fails')

  // AC-4: R2-Upload-Fehler
  it.todo('should set status to failed with error_message when R2 upload fails')

  // AC-5: Parallele Verarbeitung
  it.todo('should process multiple generations independently without aborting on single failure')

  // AC-6: PNG-Konvertierung
  it.todo('should convert non-PNG output to PNG via sharp before uploading to R2')

  // AC-7: Retry bei failed
  it.todo('should reset failed generation to pending and re-run the generation flow')

  // AC-8: Retry bei nicht-failed
  it.todo('should return error when retrying a generation that is not failed')
})
```
</test_spec>

### Test-Datei: `app/actions/__tests__/generations.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('generateImages Server Action', () => {
  // AC-9: Leerer Prompt
  it.todo('should return error object for empty prompt')

  // AC-10: Unbekanntes Modell
  it.todo('should return error object for unknown model ID')

  // AC-11: Count ausserhalb 1-4
  it.todo('should return error object for count outside 1-4 range')

  // AC-12: "use server" Direktive
  it.todo('should have "use server" as first line')
})

describe('retryGeneration Server Action', () => {
  // AC-7: Retry Delegation
  it.todo('should delegate to GenerationService for failed generation')

  // AC-8: Retry Validierung
  it.todo('should return error for non-failed generation')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-02` | `createGeneration` | Query Function | `(input) => Promise<Generation>` aus `lib/db/queries.ts` |
| `slice-02` | `updateGeneration` | Query Function | `(id, data) => Promise<Generation>` aus `lib/db/queries.ts` |
| `slice-02` | `getGenerations` | Query Function | `(projectId) => Promise<Generation[]>` aus `lib/db/queries.ts` |
| `slice-07` | `ReplicateClient.run` | Async Function | `(modelId, input) => Promise<ReplicateRunResult>` aus `lib/clients/replicate.ts` |
| `slice-07` | `StorageService.upload` | Async Function | `(stream, key) => Promise<string>` aus `lib/clients/storage.ts` |
| `slice-06` | `getModelById` | Lookup Function | `(id) => Model \| undefined` aus `lib/models.ts` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `GenerationService.generate` | Async Function | slice-09, slice-16 | `(projectId, prompt, negativePrompt, modelId, params, count) => Promise<Generation[]>` |
| `GenerationService.retry` | Async Function | slice-16 | `(generationId) => Promise<Generation>` |
| `generateImages` | Server Action | slice-09 | `(input: GenerateImagesInput) => Promise<Generation[] \| { error: string }>` |
| `retryGeneration` | Server Action | slice-16 | `(input: { id: string }) => Promise<Generation \| { error: string }>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/generation-service.ts` -- GenerationService: Orchestrierung des Generation-Flows (DB pending, Replicate, sharp PNG-Konvertierung, R2-Upload, DB completed/failed)
- [ ] `app/actions/generations.ts` -- Server Actions generateImages und retryGeneration mit Input-Validierung
<!-- DELIVERABLES_END -->

---

## Constraints

**Scope-Grenzen:**
- KEINE UI-Komponenten (Placeholder, Gallery, Buttons) -- kommt in Slice 09-11
- KEINE Polling/Revalidation-Logik -- kommt in Slice 10
- KEINE deleteGeneration Action -- kommt in Slice 13
- KEINE Toast-Notifications -- kommt in Slice 16
- KEIN Error-Retry-Mechanismus auf Service-Ebene (kein Auto-Retry) -- Consumer entscheidet

**Technische Constraints:**
- `"use server"` Direktive in `app/actions/generations.ts`
- Input-Validierung in Server Actions: Prompt non-empty, modelId gegen Registry (Whitelist), count 1-4
- Parallele Verarbeitung der N Generierungen via `Promise.allSettled` oder aequivalent
- PNG-Konvertierung via `sharp` (nur bei Nicht-PNG)
- Fehler als Objekt `{ error: string }` zurueckgeben (kein throw in Server Actions)
- Storage-Key Format: `"projects/{projectId}/{generationId}.png"`

**Referenzen:**
- Architecture: `architecture.md` -> Section "Business Logic Flow: Image Generation" (kompletter Flow)
- Architecture: `architecture.md` -> Section "Server Logic > Services" (GenerationService Responsibility)
- Architecture: `architecture.md` -> Section "API Design > Server Actions" (generateImages + retryGeneration Signaturen)
- Architecture: `architecture.md` -> Section "Validation Rules" (Prompt, modelId, count Regeln)
- Architecture: `architecture.md` -> Section "Error Handling Strategy" (Replicate/R2 Fehlerbehandlung)
