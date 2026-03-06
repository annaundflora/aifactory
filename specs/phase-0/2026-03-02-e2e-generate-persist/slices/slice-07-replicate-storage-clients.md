# Slice 7: Replicate Client + Storage Client implementieren

> **Slice 7 von 21** fuer `E2E Generate & Persist`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-07-replicate-storage-clients` |
| **Test** | `pnpm test lib/clients/__tests__/replicate.test.ts lib/clients/__tests__/storage.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-06"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/clients/__tests__/replicate.test.ts lib/clients/__tests__/storage.test.ts` |
| **Integration Command** | `pnpm test lib/clients/__tests__/replicate.integration.test.ts lib/clients/__tests__/storage.integration.test.ts` |
| **Acceptance Command** | `pnpm test lib/clients/__tests__/storage.integration.test.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `localhost:3000` |
| **Mocking Strategy** | `mock_external` (Unit-Tests mocken Replicate SDK + S3 Client, Integration-Tests gegen echte APIs) |

---

## Ziel

Thin Wrapper um das Replicate SDK (`predictions.create` + `replicate.wait`) und den S3-kompatiblen R2-Client (`PutObject`, `DeleteObject`) bereitstellen. Diese Clients kapseln die externe API-Kommunikation und liefern typisierte Ergebnisse fuer den GenerationService (Slice 08).

---

## Acceptance Criteria

1) GIVEN ein gueltiger `modelId` und `input`-Parameter
   WHEN `ReplicateClient.run(modelId, input)` aufgerufen wird
   THEN wird ein `ReplicateRunResult` zurueckgegeben mit `output` (ReadableStream), `predictionId` (string) und `seed` (number | null)

2) GIVEN `ReplicateClient.run()` wird aufgerufen
   WHEN die Replicate API intern aufgerufen wird
   THEN wird `predictions.create()` gefolgt von `replicate.wait()` verwendet (NICHT `replicate.run()`)

3) GIVEN die Replicate API antwortet mit einem Fehler (z.B. 422 Invalid Input)
   WHEN `ReplicateClient.run()` aufgerufen wird
   THEN wird ein Error mit einer aussagekraeftigen Fehlermeldung geworfen

4) GIVEN die Replicate API antwortet mit Rate Limit (429)
   WHEN `ReplicateClient.run()` aufgerufen wird
   THEN wird ein Error mit der Nachricht "Zu viele Anfragen. Bitte kurz warten." geworfen

5) GIVEN ein ReadableStream und ein Storage-Key `"projects/{projectId}/{generationId}.png"`
   WHEN `StorageService.upload(stream, key)` aufgerufen wird
   THEN wird das Objekt via S3 `PutObject` nach R2 hochgeladen und die Public URL im Format `{R2_PUBLIC_URL}/{key}` zurueckgegeben

6) GIVEN ein Storage-Key `"projects/{projectId}/{generationId}.png"`
   WHEN `StorageService.delete(key)` aufgerufen wird
   THEN wird das Objekt via S3 `DeleteObject` aus R2 entfernt

7) GIVEN der R2-Upload schlaegt fehl (z.B. Netzwerkfehler)
   WHEN `StorageService.upload()` aufgerufen wird
   THEN wird ein Error mit einer aussagekraeftigen Fehlermeldung geworfen

8) GIVEN `StorageService.upload()` wird aufgerufen
   WHEN der Upload erfolgreich ist
   THEN hat der `PutObject`-Call den `ContentType` auf `"image/png"` gesetzt

9) GIVEN der ReplicateClient wird instanziiert
   WHEN die Umgebungsvariable `REPLICATE_API_TOKEN` nicht gesetzt ist
   THEN wird ein Fehler geworfen

10) GIVEN der StorageService wird instanziiert
    WHEN die Umgebungsvariablen `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT` oder `R2_PUBLIC_URL` nicht gesetzt sind
    THEN wird ein Fehler geworfen

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/clients/__tests__/replicate.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ReplicateClient', () => {
  // AC-1: Run liefert ReplicateRunResult
  it.todo('should return ReplicateRunResult with output stream, predictionId, and seed')

  // AC-2: Verwendet predictions.create + replicate.wait
  it.todo('should call predictions.create followed by replicate.wait instead of replicate.run')

  // AC-3: API-Fehler
  it.todo('should throw error with descriptive message on API failure')

  // AC-4: Rate Limit
  it.todo('should throw error with rate limit message on 429 response')

  // AC-9: Fehlende Umgebungsvariable
  it.todo('should throw error when REPLICATE_API_TOKEN is not set')
})
```
</test_spec>

### Test-Datei: `lib/clients/__tests__/storage.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('StorageService', () => {
  // AC-5: Upload + Public URL
  it.todo('should upload stream via PutObject and return public URL in correct format')

  // AC-6: Delete
  it.todo('should delete object via DeleteObject')

  // AC-7: Upload-Fehler
  it.todo('should throw error with descriptive message on upload failure')

  // AC-8: ContentType
  it.todo('should set ContentType to image/png on PutObject call')

  // AC-10: Fehlende Umgebungsvariablen
  it.todo('should throw error when R2 environment variables are not set')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-06 | `getModelById` | Function | Model-ID Validierung vor Replicate-Call (optional, kann auch im GenerationService erfolgen) |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ReplicateClient.run` | Async Function | slice-08 (GenerationService) | `(modelId: string, input: Record<string, unknown>) => Promise<ReplicateRunResult>` |
| `ReplicateRunResult` | Type | slice-08 | `{ output: ReadableStream, predictionId: string, seed: number \| null }` |
| `StorageService.upload` | Async Function | slice-08 (GenerationService) | `(stream: ReadableStream \| Buffer, key: string) => Promise<string>` |
| `StorageService.delete` | Async Function | slice-08, slice-16 | `(key: string) => Promise<void>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/clients/replicate.ts` -- ReplicateClient-Wrapper mit predictions.create + replicate.wait
- [ ] `lib/clients/storage.ts` -- StorageService fuer R2 mit PutObject, DeleteObject, Public URL
<!-- DELIVERABLES_END -->

---

## Constraints

**Scope-Grenzen:**
- KEINE Generation-Orchestrierung (DB-Insert, Status-Updates) -- kommt in Slice 08
- KEINE PNG-Konvertierung via sharp -- kommt in Slice 08
- KEINE Server Actions -- kommt in Slice 08
- KEIN Retry-Mechanismus -- Error wird geworfen, Consumer entscheidet

**Technische Constraints:**
- Replicate SDK v1.4.0: `predictions.create()` + `replicate.wait()` (nicht `replicate.run()`)
- R2 via `@aws-sdk/client-s3` mit Custom Endpoint aus `R2_ENDPOINT`
- Public URL Konstruktion: `{R2_PUBLIC_URL}/{key}` (keine Signed URLs)
- Env-Variablen: `REPLICATE_API_TOKEN`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_PUBLIC_URL`, `R2_BUCKET_NAME`
- Beide Clients als stateless Functions oder Singleton-Instanzen exportieren

**Referenzen:**
- Architecture: `architecture.md` → Section "Server Logic > Services" (ReplicateClient + StorageService Responsibility)
- Architecture: `architecture.md` → Section "Business Logic Flow: Image Generation" (predictions.create + wait Flow)
- Architecture: `architecture.md` → Section "Constraints & Integrations" (R2 S3-kompatibel, Replicate FileOutput)
- Architecture: `architecture.md` → Section "Context & Research" (Replicate SDK FileOutput-Objekte, Output-URL Expiration)
