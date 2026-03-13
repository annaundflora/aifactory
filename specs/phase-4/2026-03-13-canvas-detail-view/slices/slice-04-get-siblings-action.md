# Slice 4: getSiblingGenerations Server Action

> **Slice 4 von 18** fuer `Canvas Detail-View & Editing Flow`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-04-get-siblings-action` |
| **Test** | `pnpm test app/actions/__tests__/get-siblings.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-batch-id-service-queries"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test app/actions/__tests__/get-siblings.test.ts` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | `pnpm test app/actions/__tests__/get-siblings.test.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Neue Server Action `getSiblingGenerations(batchId)` in die bestehende `app/actions/generations.ts` hinzufuegen. Diese Action kapselt die in Slice 2 erstellte Query `getSiblingsByBatchId()` als Next.js Server Action, damit UI-Komponenten Sibling-Generierungen einer Batch-Gruppe laden koennen.

---

## Acceptance Criteria

1) GIVEN eine `batchId` die 3 completed Generations in der DB hat
   WHEN `getSiblingGenerations("aaa-bbb-ccc")` aufgerufen wird
   THEN wird ein `Generation[]` mit genau 3 Eintraegen zurueckgegeben, sortiert nach `createdAt ASC`

2) GIVEN eine `batchId` die keine Generations in der DB hat
   WHEN `getSiblingGenerations("nonexistent-id")` aufgerufen wird
   THEN wird ein leeres Array `[]` zurueckgegeben

3) GIVEN `batchId` ist `null` oder `undefined`
   WHEN `getSiblingGenerations(null)` aufgerufen wird
   THEN wird ein leeres Array `[]` zurueckgegeben (kein DB-Aufruf fuer null-Werte)

4) GIVEN eine gueltige `batchId` die Generations mit gemischten Status hat (completed + failed + pending)
   WHEN `getSiblingGenerations("mixed-batch")` aufgerufen wird
   THEN werden nur Generations mit `status: "completed"` zurueckgegeben

5) GIVEN die Query `getSiblingsByBatchId()` wirft einen Fehler
   WHEN `getSiblingGenerations("any-id")` aufgerufen wird
   THEN wird ein leeres Array `[]` zurueckgegeben und der Fehler wird geloggt

6) GIVEN die Server Action `getSiblingGenerations`
   WHEN deren Signatur geprueft wird
   THEN akzeptiert sie einen Parameter `batchId: string | null` und gibt `Promise<Generation[]>` zurueck

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `app/actions/__tests__/get-siblings.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('getSiblingGenerations', () => {
  // AC-1: Liefert completed Generations sortiert nach createdAt ASC
  it.todo('should return completed generations for a valid batchId sorted by createdAt ASC')

  // AC-2: Leeres Array bei nicht-existierender batchId
  it.todo('should return empty array when no generations match the batchId')

  // AC-3: Leeres Array bei null/undefined batchId
  it.todo('should return empty array when batchId is null or undefined')

  // AC-4: Nur completed Generations zurueckgeben
  it.todo('should only return generations with status completed')

  // AC-5: Fehlerbehandlung — leeres Array bei Query-Fehler
  it.todo('should return empty array and log error when query throws')

  // AC-6: Korrekte Signatur (batchId: string | null) => Promise<Generation[]>
  it.todo('should accept string or null as batchId parameter')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-02-batch-id-service-queries` | `getSiblingsByBatchId()` | Query Function | `(batchId: string \| null) => Promise<Generation[]>` — liefert completed Generations sortiert nach createdAt ASC |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `getSiblingGenerations()` | Server Action | `slice-08-siblings-prev-next` | `(batchId: string \| null) => Promise<Generation[]>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/actions/generations.ts` — Neue exportierte Server Action `getSiblingGenerations` hinzufuegen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderung an bestehenden Server Actions (`generateImages`, `upscaleImage`, `deleteGeneration`, etc.)
- KEINE UI-Komponenten erstellen oder aendern
- KEINE neue Query schreiben — `getSiblingsByBatchId()` aus Slice 2 wird wiederverwendet
- KEINE neuen Dateien erstellen — nur `app/actions/generations.ts` erweitern

**Technische Constraints:**
- `"use server"` Direktive ist bereits in `app/actions/generations.ts` vorhanden
- Import von `getSiblingsByBatchId` aus `@/lib/db/queries`
- Null-Guard: bei `null`/`undefined` als `batchId` direkt leeres Array zurueckgeben ohne DB-Aufruf
- Error-Handling: try/catch mit `console.error` und leerem Array als Fallback (keine Error-Objekte wie bei `generateImages`)

**Referenzen:**
- Architecture: `specs/phase-4/2026-03-13-canvas-detail-view/architecture.md` → Section "API Design" (New Endpoints: `getSiblingGenerations`)
- Architecture: `specs/phase-4/2026-03-13-canvas-detail-view/architecture.md` → Section "Server Logic" (Business Logic Flow)
- Bestehender Code: `app/actions/generations.ts` → Bestehendes Pattern fuer Server Actions (Import-Struktur, Error-Handling)
