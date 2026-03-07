# Slice 02: DB Schema -- Projects Extensions

> **Slice 02 von 21** für `quality-improvements`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-02-db-schema-projects` |
| **Test** | `pnpm vitest run lib/db/__tests__/schema-projects.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm vitest run lib/db/__tests__/schema-projects.test.ts` |
| **Integration Command** | `--` |
| **Acceptance Command** | `--` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `--` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Die `projects`-Tabelle im Drizzle-Schema um zwei Spalten (`thumbnail_url`, `thumbnail_status`) und einen Index auf `thumbnail_status` erweitern. Dies ist die Schema-Grundlage für die Projekt-Thumbnail-Funktion.

---

## Acceptance Criteria

1. GIVEN das Drizzle-Schema in `lib/db/schema.ts`
   WHEN die `projects`-Tabelle inspiziert wird
   THEN existiert eine Spalte `thumbnail_url` vom Typ `text` mit Default `NULL`

2. GIVEN das Drizzle-Schema in `lib/db/schema.ts`
   WHEN die `projects`-Tabelle inspiziert wird
   THEN existiert eine Spalte `thumbnail_status` vom Typ `varchar(20)` mit `NOT NULL` und Default `'none'`

3. GIVEN das Drizzle-Schema in `lib/db/schema.ts`
   WHEN die Indexes der `projects`-Tabelle inspiziert werden
   THEN existiert ein Index `projects_thumbnail_status_idx` auf der Spalte `thumbnail_status`

4. GIVEN die erweiterte Schema-Definition
   WHEN `pnpm tsc --noEmit` ausgefuehrt wird
   THEN kompiliert das Projekt fehlerfrei (Exit Code 0)

5. GIVEN die erweiterte Schema-Definition
   WHEN der inferierte TypeScript-Typ von `projects` geprüft wird
   THEN enthaelt `InferSelectModel<typeof projects>` die Felder `thumbnailUrl: string | null` und `thumbnailStatus: string`

6. GIVEN die bestehenden Spalten der `projects`-Tabelle (`id`, `name`, `createdAt`, `updatedAt`)
   WHEN das Schema nach der Erweiterung inspiziert wird
   THEN sind alle bestehenden Spalten unverändert vorhanden

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstständig.

### Test-Datei: `lib/db/__tests__/schema-projects.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Projects Schema Extensions', () => {
  // AC-1: thumbnail_url Spalte existiert mit korrektem Typ
  it.todo('should have thumbnail_url column of type text with null default')

  // AC-2: thumbnail_status Spalte existiert mit korrektem Typ und Default
  it.todo('should have thumbnail_status column of type varchar(20) not null with default none')

  // AC-3: Index auf thumbnail_status
  it.todo('should have projects_thumbnail_status_idx index on thumbnail_status')

  // AC-4: TypeScript-Kompilierung
  it.todo('should compile without type errors')

  // AC-5: Inferierte Typen korrekt
  it.todo('should infer thumbnailUrl as string | null and thumbnailStatus as string')

  // AC-6: Bestehende Spalten unverändert
  it.todo('should preserve existing columns id, name, createdAt, updatedAt')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| -- | -- | -- | Keine Abhängigkeiten |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `projects.thumbnailUrl` | Schema Column | Thumbnail-Service Slices | `text('thumbnail_url')` |
| `projects.thumbnailStatus` | Schema Column | Thumbnail-Service Slices | `varchar('thumbnail_status', { length: 20 })` |
| `projects_thumbnail_status_idx` | Index | Thumbnail-Query Slices | Index auf `thumbnailStatus` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/db/schema.ts` — 2 neue Spalten (`thumbnail_url`, `thumbnail_status`) + Index auf `thumbnail_status` in der `projects`-Tabelle
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Migration erstellen (gehört zu Slice 21)
- KEINE Änderungen an `generations`- oder `prompt_snippets`-Tabellen
- KEINE Queries oder Services implementieren
- KEIN `boolean`-Typ für `thumbnail_status` — es ist ein `varchar(20)` Enum mit Werten: `none`, `pending`, `completed`, `failed`

**Technische Constraints:**
- Drizzle ORM Schema-Syntax verwenden (bestehende Patterns in `lib/db/schema.ts` befolgen)
- Die `projects`-Table bekommt einen dritten Parameter (Index-Callback), analog zum Pattern in der `generations`-Tabelle
- Import von `index` ist bereits vorhanden

**Referenzen:**
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` → Section "Database Schema" → "Existing Table: projects (Extensions)"
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` → Section "New Indexes"
