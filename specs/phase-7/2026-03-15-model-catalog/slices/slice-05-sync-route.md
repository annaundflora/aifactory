# Slice 5: Sync Route Handler (Streaming Endpoint)

> **Slice 5 von 12** fuer `Model Catalog`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-05-sync-route` |
| **Test** | `pnpm test app/api/models/sync/__tests__/route.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-04-sync-service"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test app/api/models/sync/__tests__/route.test.ts` |
| **Integration Command** | -- (auth + SyncService gemockt) |
| **Acceptance Command** | `pnpm test app/api/models/sync/__tests__/route.test.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (auth, ModelSyncService werden gemockt) |

---

## Ziel

POST Route Handler fuer `/api/models/sync`, der eine `ReadableStream`-Response mit newline-delimited JSON Events liefert. Der Handler prueft Auth via `auth()`, schuetzt gegen parallele Syncs mit einem module-scoped Lock und delegiert die Sync-Logik an `ModelSyncService.syncAll()`.

---

## Acceptance Criteria

1) GIVEN ein unauthentifizierter Request (kein Session-Cookie / `auth()` gibt `null` zurueck)
   WHEN POST `/api/models/sync` aufgerufen wird
   THEN antwortet die Route mit HTTP 401 und Body `{ error: "Unauthorized" }`

2) GIVEN ein authentifizierter Request und KEIN laufender Sync
   WHEN POST `/api/models/sync` aufgerufen wird
   THEN antwortet die Route mit HTTP 200 und `Content-Type: text/event-stream` (oder `application/x-ndjson`) und der Body ist ein `ReadableStream`

3) GIVEN ein authentifizierter Request und ein Sync ist BEREITS aktiv (module-scoped Lock ist gesetzt)
   WHEN POST `/api/models/sync` aufgerufen wird
   THEN streamt die Route ein einzelnes Error-Event `{ type: "error", message: "Sync bereits aktiv" }` gefolgt von Stream-Close

4) GIVEN ein laufender Sync mit 6 Models
   WHEN `ModelSyncService.syncAll(onProgress)` den Progress-Callback mit `(3, 6)` aufruft
   THEN wird ein Event `{ type: "progress", completed: 3, total: 6 }\n` in den Stream geschrieben

5) GIVEN ein Sync der erfolgreich abschliesst mit `SyncResult { synced: 5, failed: 1, new: 2, updated: 3 }`
   WHEN `ModelSyncService.syncAll()` resolved
   THEN wird ein Complete-Event `{ type: "complete", synced: 5, failed: 1, new: 2, updated: 3 }\n` in den Stream geschrieben, danach wird der Stream geschlossen und das module-scoped Lock freigegeben

6) GIVEN ein Sync bei dem `ModelSyncService.syncAll()` eine unbehandelte Exception wirft
   WHEN die Exception gefangen wird
   THEN wird ein Error-Event `{ type: "error", message: <error.message> }\n` in den Stream geschrieben, danach wird der Stream geschlossen und das module-scoped Lock freigegeben

7) GIVEN der Route Handler
   WHEN die Response erstellt wird
   THEN enthaelt die Response `export const runtime = "nodejs"` (kein Edge Runtime, da DB-Zugriff ueber postgres-js TCP)

8) GIVEN ein GET-Request an `/api/models/sync`
   WHEN der Request verarbeitet wird
   THEN antwortet die Route mit HTTP 405 (nur POST ist exportiert)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Der Test-Writer implementiert die Assertions.

### Test-Datei: `app/api/models/sync/__tests__/route.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('POST /api/models/sync', () => {
  // AC-1: Unauthentifizierter Request -> 401
  it.todo('should return 401 when auth() returns null')

  // AC-2: Authentifizierter Request -> 200 mit ReadableStream
  it.todo('should return 200 with streaming response when authenticated')

  // AC-3: Doppelter Sync -> Error-Event "Sync bereits aktiv"
  it.todo('should stream error event when sync is already in progress')

  // AC-4: Progress-Events mit completed und total
  it.todo('should stream progress events from onProgress callback')

  // AC-5: Complete-Event mit synced, failed, new, updated
  it.todo('should stream complete event with SyncResult fields and close stream')

  // AC-6: Exception -> Error-Event + Stream-Close + Lock-Release
  it.todo('should stream error event and release lock when syncAll throws')

  // AC-7: Runtime = nodejs
  it.todo('should export runtime as nodejs')

  // AC-8: GET Request -> 405 Method Not Allowed
  it.todo('should return 405 for GET requests')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-04-sync-service` | `ModelSyncService.syncAll` | Service Method | `(onProgress: (completed: number, total: number) => void) => Promise<SyncResult>` aufrufbar |
| `slice-04-sync-service` | `SyncResult` | Type Export | `{ synced: number; failed: number; new: number; updated: number }` importierbar |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `POST /api/models/sync` | Route Handler | `slice-09-sync-button` (Client-seitiger `fetch()`) | `POST -> ReadableStream` mit newline-delimited JSON Events (`progress`, `complete`, `error`) |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/api/models/sync/route.ts` -- NEU: POST Route Handler mit ReadableStream Response, Auth-Check, module-scoped Sync-Lock, newline-delimited JSON Events
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Server Actions (Route Handler ist bewusst kein Server Action wegen Streaming-Requirement)
- KEINE UI-Aenderungen, KEINE Client-Components
- KEIN Client-seitiger Fetch-Code (kommt in Slice 9)
- KEINE Aenderung an `ModelSyncService` oder `queries.ts`
- KEIN GET-Handler exportieren (nur POST)

**Technische Constraints:**
- `export const runtime = "nodejs"` (postgres-js braucht TCP Sockets, kein Edge Runtime)
- Auth-Check via `auth()` aus `@/auth` (bestehendes next-auth Pattern, siehe `app/api/auth/[...nextauth]/route.ts`)
- Module-scoped Lock: `let isSyncing = false` auf Modul-Ebene (nicht in DB, nicht in Redis)
- Lock MUSS im `finally`-Block freigegeben werden (auch bei Exceptions)
- Stream-Events als newline-delimited JSON: jedes Event ist `JSON.stringify(event) + "\n"`
- Drei Event-Typen gemaess architecture.md → Section "Stream Events": `progress`, `complete`, `error`
- `ReadableStream` Response mit `new Response(stream, { headers })` Pattern

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `auth.ts` | Import `auth` — Session-Check, NICHT neu implementieren |
| `lib/services/model-sync-service.ts` | Import `ModelSyncService` — `syncAll(onProgress)` aufrufen, NICHT neu implementieren |

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "API Design" → "Route Handler" Tabelle (Method, Path, Request, Response, Auth, Business Logic)
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "Stream Events" (3 Event-Typen mit Payloads)
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "Security" → "Route Handler `/api/models/sync`" (auth() Pattern)
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "Validation Rules" → "Sync in progress" (module-scoped Flag)
