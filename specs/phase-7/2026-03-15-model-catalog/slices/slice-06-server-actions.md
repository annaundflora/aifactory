# Slice 6: Server Actions (getModels, getModelSchema, triggerSync)

> **Slice 6 von 12** fuer `Model Catalog`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-06-server-actions` |
| **Test** | `pnpm test app/actions/__tests__/models.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-catalog-service"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test app/actions/__tests__/models.test.ts` |
| **Integration Command** | -- (Services + DB gemockt) |
| **Acceptance Command** | `pnpm test app/actions/__tests__/models.test.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (ModelCatalogService, Replicate API, DB-Modul, requireAuth werden gemockt) |

---

## Ziel

Die bestehende `app/actions/models.ts` umbauen: `getCollectionModels` durch `getModels` ersetzen (DB-Read via ModelCatalogService), `getModelSchema` auf DB-first mit On-the-fly-Fallback umstellen, `checkImg2ImgSupport` entfernen, und `triggerSync` als Delegation an den Sync Route Handler hinzufuegen.

---

## Acceptance Criteria

1) GIVEN ein authentifizierter User und 5 aktive Models mit `capabilities.txt2img = true` in der DB
   WHEN `getModels({ capability: "txt2img" })` aufgerufen wird
   THEN wird ein Array mit exakt 5 Model-Objekten zurueckgegeben (Typ: `Model[]` aus `models.$inferSelect`)

2) GIVEN ein authentifizierter User
   WHEN `getModels({})` (ohne capability-Filter) aufgerufen wird
   THEN werden alle aktiven Models aus der DB zurueckgegeben

3) GIVEN ein NICHT authentifizierter User (requireAuth gibt `{ error: "..." }` zurueck)
   WHEN `getModels({ capability: "txt2img" })` aufgerufen wird
   THEN wird `{ error: string }` zurueckgegeben (Auth-Fehler, kein DB-Zugriff)

4) GIVEN ein authentifizierter User und `capability = "invalid_mode"`
   WHEN `getModels({ capability: "invalid_mode" })` aufgerufen wird
   THEN wird `{ error: "Ungueltige Capability" }` zurueckgegeben

5) GIVEN ein authentifizierter User und ein Model mit `replicate_id = "owner/name"` hat `input_schema != null` in DB
   WHEN `getModelSchema({ modelId: "owner/name" })` aufgerufen wird
   THEN wird `{ properties: <input_schema aus DB> }` zurueckgegeben ohne Replicate-API-Call

6) GIVEN ein authentifizierter User und ein Model mit `replicate_id = "owner/name"` hat `input_schema = null` in DB
   WHEN `getModelSchema({ modelId: "owner/name" })` aufgerufen wird
   THEN wird Schema von Replicate API geholt, `resolveSchemaRefs` angewendet, Ergebnis in DB gespeichert (`upsertModel` oder direktes Schema-Update), und `{ properties: <resolved schema> }` zurueckgegeben

7) GIVEN ein authentifizierter User und ein Model mit `replicate_id = "owner/unknown"` existiert NICHT in DB
   WHEN `getModelSchema({ modelId: "owner/unknown" })` aufgerufen wird
   THEN wird Schema von Replicate API geholt (On-the-fly-Fallback), und `{ properties: <resolved schema> }` zurueckgegeben

8) GIVEN ein authentifizierter User
   WHEN `getModelSchema({ modelId: "invalid" })` aufgerufen wird (kein `owner/name`-Format)
   THEN wird `{ error: "Ungueltiges Model-ID-Format" }` zurueckgegeben

9) GIVEN ein NICHT authentifizierter User
   WHEN `getModelSchema({ modelId: "owner/name" })` aufgerufen wird
   THEN wird `{ error: string }` zurueckgegeben (Auth-Fehler)

10) GIVEN ein authentifizierter User
    WHEN `triggerSync()` aufgerufen wird
    THEN wird `{ status: "started" }` zurueckgegeben (Delegation an Route Handler; Server Action startet NICHT selbst den Sync)

11) GIVEN ein NICHT authentifizierter User
    WHEN `triggerSync()` aufgerufen wird
    THEN wird `{ error: string }` zurueckgegeben (Auth-Fehler)

12) GIVEN die Datei `app/actions/models.ts`
    WHEN die exportierten Funktionen geprueft werden
    THEN existiert KEINE `getCollectionModels`-Funktion und KEINE `checkImg2ImgSupport`-Funktion mehr

13) GIVEN die `modelId`-Validierung in `getModelSchema`
    WHEN das Format geprueft wird
    THEN wird der Regex `/^[a-z0-9-]+\/[a-z0-9._-]+$/` (oder gleichwertiger Check) angewendet

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Der Test-Writer implementiert die Assertions.

### Test-Datei: `app/actions/__tests__/models.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('getModels', () => {
  // AC-1: Capability-Filter txt2img
  it.todo('should return models filtered by txt2img capability from DB')

  // AC-2: Ohne Capability-Filter alle aktiven Models
  it.todo('should return all active models when no capability provided')

  // AC-3: Auth-Fehler
  it.todo('should return error when user is not authenticated')

  // AC-4: Ungueltige Capability
  it.todo('should return error for invalid capability value')
})

describe('getModelSchema', () => {
  // AC-5: Schema aus DB (input_schema vorhanden)
  it.todo('should return schema from DB without API call when input_schema exists')

  // AC-6: On-the-fly Fetch bei input_schema = null
  it.todo('should fetch schema from Replicate API when input_schema is null and store in DB')

  // AC-7: On-the-fly Fetch bei Model nicht in DB
  it.todo('should fetch schema from Replicate API when model not in DB')

  // AC-8: Ungueltiges modelId-Format
  it.todo('should return error for invalid modelId format')

  // AC-9: Auth-Fehler
  it.todo('should return error when user is not authenticated')

  // AC-13: modelId-Regex-Validierung
  it.todo('should validate modelId against owner/name regex pattern')
})

describe('triggerSync', () => {
  // AC-10: Erfolgreiche Delegation
  it.todo('should return status started when authenticated')

  // AC-11: Auth-Fehler
  it.todo('should return error when user is not authenticated')
})

describe('removed exports', () => {
  // AC-12: Alte Funktionen entfernt
  it.todo('should not export getCollectionModels or checkImg2ImgSupport')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03-catalog-service` | `ModelCatalogService` | Service Object | `getByCapability(cap)`, `getAll()`, `getSchema(replicateId)` aufrufbar |
| `slice-03-catalog-service` | `getModelsByCapability` | Query Function | `(capability: string) => Promise<Model[]>` |
| `slice-03-catalog-service` | `getActiveModels` | Query Function | `() => Promise<Model[]>` |
| `slice-03-catalog-service` | `getModelSchema` (Query) | Query Function | `(replicateId: string) => Promise<unknown \| null>` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `getModels` | Server Action | UI-Components (Settings-Dialog Dropdowns) | `(input: { capability?: GenerationMode }) => Promise<Model[] \| { error: string }>` |
| `getModelSchema` | Server Action | `useModelSchema` Hook | `(input: { modelId: string }) => Promise<{ properties: Record<string, unknown> } \| { error: string }>` |
| `triggerSync` | Server Action | UI-Components (Sync-Button) | `() => Promise<{ status: "started" } \| { error: string }>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/actions/models.ts` -- MODIFY: `getCollectionModels` entfernen, `checkImg2ImgSupport` entfernen, `getModels` hinzufuegen, `getModelSchema` auf DB-first umstellen, `triggerSync` hinzufuegen. Imports auf ModelCatalogService + Query-Funktionen umstellen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE UI-Aenderungen, KEINE Client-Components
- KEINE Aenderung an `model-catalog-service.ts`, `queries.ts` oder `model-sync-service.ts`
- KEIN Route Handler (existiert bereits aus Slice 5)
- KEINE Aenderung an `lib/types.ts` (GenerationMode-Erweiterung kommt in anderem Slice)
- KEIN Streaming in Server Actions (triggerSync delegiert nur, Streaming passiert im Route Handler)

**Technische Constraints:**
- `"use server"` Directive bleibt erhalten
- `requireAuth()` Guard auf ALLEN drei Actions (bestehendes Pattern aus `lib/auth/guard.ts`)
- Return-Pattern: `T | { error: string }` (bestehendes Pattern, konsistent mit allen anderen Server Actions)
- `modelId`-Validierung: Regex `/^[a-z0-9-]+\/[a-z0-9._-]+$/` gemaess architecture.md → Section "Validation Rules"
- `capability`-Validierung: Pruefen ob Wert ein gueltiger `GenerationMode` ist (via `VALID_GENERATION_MODES` aus `lib/types.ts`)
- On-the-fly Schema-Fetch in `getModelSchema`: Replicate API `GET /v1/models/{owner}/{name}` → Schema-Extraktion → `resolveSchemaRefs` → DB-Speicherung → Rueckgabe

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `app/actions/models.ts` | MODIFY — Bestehende Datei komplett umbauen. `"use server"` und `requireAuth`-Pattern beibehalten |
| `lib/auth/guard.ts` | Import `requireAuth` — unveraendert, bestehendes Auth-Pattern |
| `lib/services/model-catalog-service.ts` | Import `ModelCatalogService` — DB-Reads delegieren, NICHT neu implementieren |
| `lib/services/capability-detection.ts` | Import `resolveSchemaRefs` — fuer On-the-fly Schema-Resolution im Fallback-Pfad |
| `lib/types.ts` | Import `GenerationMode`, `VALID_GENERATION_MODES` — fuer Capability-Validierung |

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "API Design" → "Server Actions" Tabelle (getModels, getModelSchema, triggerSync)
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "Validation Rules" (modelId-Regex, Capability-Validierung)
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "Architecture Layers" → "Read Flow" + "Schema Read Flow"
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` → Section "Migration Map" → `app/actions/models.ts` Zeile
