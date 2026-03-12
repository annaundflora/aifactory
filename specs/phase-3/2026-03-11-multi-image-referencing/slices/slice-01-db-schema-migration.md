# Slice 1: DB Schema & Migration definieren

> **Slice 1 von 9** fuer `Multi-Image Referencing`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-01-db-schema-migration` |
| **Test** | `pnpm test lib/db/schema` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6 + Drizzle ORM 0.45 + Vitest 4) |
| **Test Command** | `pnpm test lib/db/schema` |
| **Integration Command** | `npx drizzle-kit push` |
| **Acceptance Command** | `npx drizzle-kit push` (Exit-Code 0 = Tabellen existieren) |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | N/A (Schema-Only Slice) |
| **Mocking Strategy** | `no_mocks` (Schema-Definition ist deklarativ, Migration gegen echte DB) |

---

## Ziel

Drizzle-Schema fuer die Tabellen `reference_images` und `generation_references` definieren, damit alle nachfolgenden Slices (Queries, Upload, UI) auf einer stabilen Datenbankstruktur aufbauen koennen. Migration generieren und erfolgreich anwenden.

---

## Acceptance Criteria

1) GIVEN das bestehende Schema in `lib/db/schema.ts` mit 5 Tabellen
   WHEN der Implementer die Datei erweitert
   THEN existiert eine `referenceImages` Tabellen-Definition mit allen Spalten gemaess `architecture.md` Section "Schema Details: reference_images" (id, projectId, imageUrl, originalFilename, width, height, sourceType, sourceGenerationId, createdAt)

2) GIVEN die `referenceImages` Tabellen-Definition
   WHEN die Tabelle inspiziert wird
   THEN existiert ein FK von `projectId` auf `projects.id` mit `ON DELETE CASCADE` und ein FK von `sourceGenerationId` auf `generations.id` mit `ON DELETE SET NULL`

3) GIVEN die `referenceImages` Tabellen-Definition
   WHEN die Indexes inspiziert werden
   THEN existiert ein Index auf `projectId`

4) GIVEN das bestehende Schema in `lib/db/schema.ts`
   WHEN der Implementer die Datei erweitert
   THEN existiert eine `generationReferences` Tabellen-Definition mit allen Spalten gemaess `architecture.md` Section "Schema Details: generation_references" (id, generationId, referenceImageId, role, strength, slotPosition)

5) GIVEN die `generationReferences` Tabellen-Definition
   WHEN die Tabelle inspiziert wird
   THEN existiert ein FK von `generationId` auf `generations.id` mit `ON DELETE CASCADE` und ein FK von `referenceImageId` auf `referenceImages.id` mit `ON DELETE CASCADE`

6) GIVEN die `generationReferences` Tabellen-Definition
   WHEN die Indexes inspiziert werden
   THEN existiert ein Index auf `generationId`

7) GIVEN die erweiterten Schema-Definitionen
   WHEN `npx drizzle-kit generate` ausgefuehrt wird
   THEN wird eine Migration-Datei im `drizzle/` Verzeichnis erzeugt (Exit-Code 0)

8) GIVEN die generierte Migration
   WHEN `npx drizzle-kit push` ausgefuehrt wird
   THEN laeuft der Befehl erfolgreich (Exit-Code 0) und beide Tabellen `reference_images` und `generation_references` existieren in der DB mit korrekten Spalten, FKs und Indexes

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/db/__tests__/schema.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('referenceImages table definition', () => {
  // AC-1: referenceImages hat alle erforderlichen Spalten
  it.todo('should define referenceImages table with all required columns')

  // AC-2: referenceImages FKs korrekt definiert
  it.todo('should define projectId FK to projects with ON DELETE CASCADE')
  it.todo('should define sourceGenerationId FK to generations with ON DELETE SET NULL')

  // AC-3: referenceImages Index auf projectId
  it.todo('should define index on projectId')
})

describe('generationReferences table definition', () => {
  // AC-4: generationReferences hat alle erforderlichen Spalten
  it.todo('should define generationReferences table with all required columns')

  // AC-5: generationReferences FKs korrekt definiert
  it.todo('should define generationId FK to generations with ON DELETE CASCADE')
  it.todo('should define referenceImageId FK to referenceImages with ON DELETE CASCADE')

  // AC-6: generationReferences Index auf generationId
  it.todo('should define index on generationId')
})
```
</test_spec>

> **Hinweis:** AC-7 und AC-8 (Migration generieren + push) werden als manuelle Acceptance-Tests via CLI validiert, nicht als Unit-Tests.

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| (keine) | — | — | Erster Slice, keine Dependencies |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `referenceImages` | Drizzle Table | slice-02 (Queries+Service), slice-03 (Upload), slice-09 (Migration) | `typeof referenceImages` — Drizzle pgTable Export |
| `generationReferences` | Drizzle Table | slice-02 (Queries+Service), slice-06 (Generation), slice-08 (Provenance), slice-09 (Migration) | `typeof generationReferences` — Drizzle pgTable Export |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/db/schema.ts` — Erweitert: 2 neue Tabellen-Definitionen (`referenceImages`, `generationReferences`) mit FKs und Indexes
- [ ] `drizzle/` — Generierte Migration-Datei via `npx drizzle-kit generate`
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Queries oder CRUD-Funktionen (Slice 2)
- KEINE Server Actions oder Services (Slice 3+)
- KEINE Aenderung an bestehenden Tabellen-Definitionen (sourceImageUrl bleibt unveraendert, Deprecation in Slice 9)
- KEINE Relations-Definitionen (Drizzle `relations()`) — nur Tabellen + Indexes

**Technische Constraints:**
- Nutze Drizzle ORM pgTable-Pattern konsistent mit bestehenden Tabellen in `lib/db/schema.ts`
- UUID-PKs mit `gen_random_uuid()` Default (bestehendes Pattern)
- Timestamps mit `withTimezone: true` und `defaultNow()` (bestehendes Pattern)
- Index-Namenskonvention: `{table}_{column}_idx` (bestehendes Pattern)
- Migration via `npx drizzle-kit generate` + `npx drizzle-kit push` (Config: `drizzle.config.ts`)

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-multi-image-referencing/architecture.md` Section "Database Schema" (Zeilen 89-131)
- Schema-Pattern: `lib/db/schema.ts` (bestehendes Pattern fuer pgTable, uuid, FK, Index)
- Drizzle Config: `drizzle.config.ts` (out: `./drizzle`, schema: `./lib/db/schema.ts`)
