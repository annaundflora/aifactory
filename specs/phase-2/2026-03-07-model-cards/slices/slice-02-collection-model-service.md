# Slice 2: CollectionModel Type + Service

> **Slice 2 von 14** fuer `Model Cards & Multi-Model Selection`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-02-collection-model-service` |
| **Test** | `pnpm test lib/services/__tests__/collection-model-service.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/services/__tests__/collection-model-service.test.ts` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

`CollectionModelService` erstellen, der die Replicate Collections API (`GET /v1/collections/text-to-image`) aufruft und die Antwort in-memory cached (1h TTL). Definiert das `CollectionModel`-Interface als zentralen Datentyp fuer alle nachfolgenden Slices. Fetch-Aufrufe werden mit 5s Timeout via `AbortController` abgesichert.

---

## Acceptance Criteria

1) GIVEN kein Cache-Eintrag existiert
   WHEN `getCollectionModels()` aufgerufen wird
   THEN wird `GET /v1/collections/text-to-image` mit Bearer-Token (`REPLICATE_API_TOKEN`) aufgerufen
   AND das Ergebnis als `CollectionModel[]` zurueckgegeben
   AND das Ergebnis im Cache gespeichert

2) GIVEN ein gueltiger Cache-Eintrag existiert (juenger als 3.600.000ms)
   WHEN `getCollectionModels()` aufgerufen wird
   THEN wird KEIN HTTP-Request gesendet
   AND das gecachte `CollectionModel[]` zurueckgegeben

3) GIVEN ein Cache-Eintrag aelter als 3.600.000ms existiert
   WHEN `getCollectionModels()` aufgerufen wird
   THEN wird ein neuer HTTP-Request gesendet
   AND der Cache mit dem neuen Ergebnis aktualisiert

4) GIVEN die API einen HTTP-Error zurueckgibt (z.B. Status 500)
   WHEN `getCollectionModels()` aufgerufen wird
   THEN wird `{ error: string }` zurueckgegeben
   AND der fehlerhafte Response wird NICHT gecacht

5) GIVEN die API laenger als 5000ms nicht antwortet
   WHEN `getCollectionModels()` aufgerufen wird
   THEN wird der Request via `AbortController` abgebrochen
   AND `{ error: string }` zurueckgegeben (keine haengende Verbindung)

6) GIVEN ein Cache-Eintrag existiert
   WHEN `clearCache()` aufgerufen wird
   THEN ist der Cache leer
   AND der naechste `getCollectionModels()`-Aufruf sendet einen neuen HTTP-Request

7) GIVEN das `CollectionModel`-Interface
   WHEN es importiert wird aus `lib/types/collection-model.ts`
   THEN enthaelt es die Felder `url`, `owner`, `name`, `description`, `cover_image_url`, `run_count` gemaess architecture.md Section "Data Transfer Objects"

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/services/__tests__/collection-model-service.test.ts`

<test_spec>
```typescript
// AC-1: Cache-Miss — API wird aufgerufen, Ergebnis zurueckgegeben und gecacht
it.todo('should fetch from API on cache miss and return CollectionModel[]')

// AC-2: Cache-Hit — kein HTTP-Request, gecachtes Ergebnis
it.todo('should return cached result without HTTP request on cache hit')

// AC-3: Cache-Expiry — neuer Request nach TTL-Ablauf
it.todo('should refetch from API after cache TTL (3600000ms) expires')

// AC-4: API-Error — Fehler zurueckgeben, nicht cachen
it.todo('should return error object on API failure and not cache the error')

// AC-5: Fetch-Timeout — Request nach 5000ms abbrechen
it.todo('should abort fetch after 5000ms timeout and return error')

// AC-6: clearCache — Cache leeren
it.todo('should clear cache so next call fetches from API again')

// AC-7: CollectionModel Interface — korrekte Felder
it.todo('should export CollectionModel type with required fields')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| -- | -- | -- | Keine Abhaengigkeiten; nutzt nur `REPLICATE_API_TOKEN` Env-Variable (bestehendes Setup) |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `CollectionModel` | TypeScript Interface | `slice-03`, `slice-06`, `slice-07`, `slice-08`, `slice-10` | `import type { CollectionModel } from '@/lib/types/collection-model'` |
| `getCollectionModels` | Async Function | `slice-03` | `getCollectionModels(): Promise<CollectionModel[] \| { error: string }>` |
| `clearCache` | Function | Test-Support | `clearCache(): void` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/types/collection-model.ts` -- Interface `CollectionModel` (zentraler Datentyp)
- [ ] `lib/services/collection-model-service.ts` -- Service mit In-Memory-Cache (1h TTL), Fetch mit AbortController (5s), `getCollectionModels()` und `clearCache()`
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Server Action (kommt in Slice 03)
- KEINE UI-Komponenten
- KEINE Aenderungen an bestehenden Dateien (kein Refactoring von `lib/models.ts` etc.)
- KEIN externes Cache-System (kein Redis); nur In-Memory `Map`

**Technische Constraints:**
- Cache-Pattern analog zu `lib/services/model-schema-service.ts` (In-Memory Map mit Timestamp), erweitert um TTL-Pruefung (3.600.000ms)
- Cache-Key: `"text-to-image"` (Collection-Slug)
- Fetch mit `AbortController` + `setTimeout(5000)` fuer Timeout
- API-Endpoint: `https://api.replicate.com/v1/collections/text-to-image`
- Auth-Header: `Authorization: Bearer ${process.env.REPLICATE_API_TOKEN}`
- Fehlerhafte Responses (non-2xx) werden NICHT gecacht
- `CollectionModel`-Interface mappt nur die relevanten Felder; `default_example` und `latest_version` werden nicht uebernommen

**Referenzen:**
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` -> Section "Data Transfer Objects" (CollectionModel Felder)
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` -> Section "CollectionModelService Cache Design" (TTL, Cache Key, Error Handling)
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` -> Section "Services & Processing" (CollectionModelService Verantwortlichkeiten)
