# Slice 21: DB Migration SQL

> **Slice 21 von 21** fuer `quality-improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-21-db-migration-sql` |
| **Test** | `pnpm vitest run lib/db/__tests__/migration.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-db-schema-generations", "slice-02-db-schema-projects"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm vitest run lib/db/__tests__/migration.test.ts` |
| **Integration Command** | `npx drizzle-kit migrate` |
| **Acceptance Command** | `npx drizzle-kit migrate` (Exit Code 0, Spalten in DB sichtbar) |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `--` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Migration-SQL via `drizzle-kit generate` erzeugen, um die in Slice 01 und Slice 02 definierten Schema-Erweiterungen in die Datenbank zu uebertragen. Zusaetzlich ein Backfill-Statement einfuegen, das bestehende `prompt`-Werte nach `prompt_motiv` kopiert. Migration mit `drizzle-kit migrate` anwenden.

---

## Acceptance Criteria

1. GIVEN das erweiterte Drizzle-Schema aus Slice 01 und Slice 02
   WHEN `npx drizzle-kit generate` ausgefuehrt wird
   THEN wird eine SQL-Datei im Verzeichnis `drizzle/` erzeugt (Dateiname-Pattern: `0001_*.sql`)

2. GIVEN die generierte Migration-Datei
   WHEN ihr Inhalt inspiziert wird
   THEN enthaelt sie `ALTER TABLE`-Statements fuer die `generations`-Tabelle mit den Spalten `prompt_motiv` (TEXT NOT NULL DEFAULT ''), `prompt_style` (TEXT DEFAULT ''), `is_favorite` (BOOLEAN NOT NULL DEFAULT false)

3. GIVEN die generierte Migration-Datei
   WHEN ihr Inhalt inspiziert wird
   THEN enthaelt sie `ALTER TABLE`-Statements fuer die `projects`-Tabelle mit den Spalten `thumbnail_url` (TEXT) und `thumbnail_status` (VARCHAR(20) NOT NULL DEFAULT 'none')

4. GIVEN die generierte Migration-Datei
   WHEN ihr Inhalt inspiziert wird
   THEN enthaelt sie `CREATE INDEX`-Statements fuer `generations_is_favorite_idx` und `projects_thumbnail_status_idx`

5. GIVEN die generierte Migration-Datei
   WHEN ihr Inhalt inspiziert wird
   THEN enthaelt sie am Ende das Backfill-Statement: `UPDATE generations SET prompt_motiv = prompt WHERE prompt_motiv = '';`

6. GIVEN eine laufende PostgreSQL-Datenbank mit bestehenden Daten (Generations mit befuelltem `prompt`-Feld)
   WHEN `npx drizzle-kit migrate` ausgefuehrt wird
   THEN laeuft die Migration fehlerfrei durch (Exit Code 0)

7. GIVEN eine erfolgreiche Migration und bestehende Generations mit `prompt = 'A cat on a roof'`
   WHEN die `generations`-Tabelle abgefragt wird
   THEN hat jede bestehende Generation `prompt_motiv` befuellt mit dem Wert aus `prompt` (z.B. `prompt_motiv = 'A cat on a roof'`)

8. GIVEN eine erfolgreiche Migration
   WHEN die DB-Struktur inspiziert wird
   THEN sind alle neuen Spalten und Indexes in der Datenbank sichtbar und die bestehenden Daten intakt

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/db/__tests__/migration.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('DB Migration SQL', () => {
  // AC-1: Migration-Datei existiert
  it.todo('should have generated a migration file matching drizzle/0001_*.sql')

  // AC-2: Generations ALTER TABLE Statements
  it.todo('should contain ALTER TABLE for generations with prompt_motiv, prompt_style, is_favorite')

  // AC-3: Projects ALTER TABLE Statements
  it.todo('should contain ALTER TABLE for projects with thumbnail_url, thumbnail_status')

  // AC-4: CREATE INDEX Statements
  it.todo('should contain CREATE INDEX for generations_is_favorite_idx and projects_thumbnail_status_idx')

  // AC-5: Backfill Statement vorhanden
  it.todo('should contain backfill UPDATE statement for prompt_motiv at end of migration')

  // AC-6: Migration laeuft fehlerfrei
  it.todo('should apply migration without errors (exit code 0)')

  // AC-7: Backfill korrekt ausgefuehrt
  it.todo('should have prompt_motiv populated from prompt for existing generations after migration')

  // AC-8: Neue Spalten und Indexes in DB sichtbar
  it.todo('should have all new columns and indexes visible in database after migration')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-db-schema-generations` | `generations` Schema mit `prompt_motiv`, `prompt_style`, `is_favorite`, `generations_is_favorite_idx` | Schema Definition | Schema-Datei kompiliert fehlerfrei |
| `slice-02-db-schema-projects` | `projects` Schema mit `thumbnail_url`, `thumbnail_status`, `projects_thumbnail_status_idx` | Schema Definition | Schema-Datei kompiliert fehlerfrei |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `drizzle/0001_*.sql` | Migration SQL | Alle nachfolgenden DB-abhaengigen Slices | Angewandte Migration, neue Spalten live in DB |
| Backfill `prompt_motiv` | Data Migration | History-Slices | Bestehende Generations haben `prompt_motiv` befuellt |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `drizzle/0001_*.sql` -- Generierte Migration (via `drizzle-kit generate`) mit manuell eingefuegtem Backfill-Statement
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Schema-Aenderungen in `lib/db/schema.ts` (bereits in Slice 01 und 02 erledigt)
- KEINE neuen Tabellen oder Spalten ueber das definierte Schema hinaus
- KEINE Service- oder Action-Aenderungen
- KEIN Seed-Script oder Test-Daten-Setup

**Technische Constraints:**
- Migration via `npx drizzle-kit generate` generieren (nicht manuell SQL schreiben)
- Backfill-Statement (`UPDATE generations SET prompt_motiv = prompt WHERE prompt_motiv = '';`) MUSS manuell am Ende der generierten SQL-Datei eingefuegt werden
- Migration via `npx drizzle-kit migrate` anwenden
- Drizzle-Kit Output-Verzeichnis: `./drizzle` (siehe `drizzle.config.ts`)
- Die Migration muss idempotent-sicher sein: Backfill betrifft nur Rows mit leerem `prompt_motiv`

**Referenzen:**
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` -- Section "Database Schema" fuer Spaltendefinitionen
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` -- Section "Migration Strategy" (Zeile 55-57) fuer Backfill-Logik
- Config: `drizzle.config.ts` -- Schema-Pfad und Output-Verzeichnis
