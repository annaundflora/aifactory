# Slice 1: DB Schema + Migration

> **Slice 1 von 13** fuer `Model Handling Redesign`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-01-db-schema-migration` |
| **Test** | `pnpm test lib/db` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/db` |
| **Integration Command** | `pnpm drizzle-kit push` |
| **Acceptance Command** | `pnpm test lib/db` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `test_containers` (echte DB fuer Schema-Tests) |

---

## Ziel

Drizzle-Schema um die `modelSettings` Tabelle erweitern und eine Migration generieren, die die Tabelle anlegt und 8 Default-Eintraege (Seed-Daten) einfuegt. Damit wird die Datengrundlage fuer das gesamte Tier-System geschaffen.

---

## Acceptance Criteria

1) GIVEN eine leere Datenbank ohne `model_settings` Tabelle
   WHEN die Migration `0007_*.sql` ausgefuehrt wird
   THEN existiert die Tabelle `model_settings` mit den Spalten `id` (uuid PK), `mode` (varchar(20) NOT NULL), `tier` (varchar(20) NOT NULL), `model_id` (varchar(255) NOT NULL), `model_params` (jsonb NOT NULL DEFAULT '{}'), `created_at` (timestamptz NOT NULL DEFAULT now()), `updated_at` (timestamptz NOT NULL DEFAULT now())

2) GIVEN die Tabelle `model_settings` existiert
   WHEN `SELECT count(*) FROM model_settings` ausgefuehrt wird
   THEN ist das Ergebnis `8`

3) GIVEN die Tabelle `model_settings` existiert mit Seed-Daten
   WHEN `SELECT mode, tier, model_id FROM model_settings ORDER BY mode, tier` ausgefuehrt wird
   THEN enthaelt das Ergebnis exakt diese 8 Kombinationen:
   - `(img2img, draft, black-forest-labs/flux-schnell)`
   - `(img2img, max, black-forest-labs/flux-2-max)`
   - `(img2img, quality, black-forest-labs/flux-2-pro)`
   - `(txt2img, draft, black-forest-labs/flux-schnell)`
   - `(txt2img, max, black-forest-labs/flux-2-max)`
   - `(txt2img, quality, black-forest-labs/flux-2-pro)`
   - `(upscale, draft, nightmareai/real-esrgan)`
   - `(upscale, quality, philz1337x/crystal-upscaler)`

4) GIVEN die Tabelle `model_settings` existiert
   WHEN ein INSERT mit einer bereits existierenden `(mode, tier)` Kombination versucht wird
   THEN wird der INSERT durch den unique constraint auf `(mode, tier)` abgelehnt (conflict)

5) GIVEN das Drizzle-Schema in `lib/db/schema.ts`
   WHEN `modelSettings` exportiert wird
   THEN hat die Tabellen-Definition eine `uniqueIndex` oder `unique` Constraint auf den Spalten `(mode, tier)`

6) GIVEN die Seed-Daten fuer `img2img` Eintraege
   WHEN die `model_params` Spalte gelesen wird
   THEN enthalten alle 3 img2img-Eintraege `{ "prompt_strength": 0.6 }`, der `upscale/draft`-Eintrag enthaelt `{ "scale": 2 }`, und der `upscale/quality`-Eintrag enthaelt `{ "scale": 4 }`

7) GIVEN die Migration laeuft auf einer DB die bereits alle vorherigen Migrationen (0000-0006) hat
   WHEN die Migration `0007_*.sql` ausgefuehrt wird
   THEN laeuft sie fehlerfrei durch ohne bestehende Tabellen zu veraendern

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/db/__tests__/schema.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('modelSettings schema definition', () => {
  // AC-1: Tabellen-Struktur
  it.todo('should define modelSettings table with all required columns and correct types')

  // AC-4: Unique Constraint
  it.todo('should have a unique constraint on (mode, tier)')

  // AC-5: Export und Schema-Shape
  it.todo('should export modelSettings with correct table name and column configuration')
})
```
</test_spec>

### Test-Datei: `lib/db/__tests__/migration-seed.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('model_settings migration and seed data', () => {
  // AC-2: Seed-Anzahl
  it.todo('should contain exactly 8 seed entries after migration')

  // AC-3: Korrekte mode/tier/model_id Kombinationen
  it.todo('should contain all 8 expected mode/tier/model_id combinations')

  // AC-6: model_params Werte
  it.todo('should have correct model_params for img2img and upscale entries')

  // AC-7: Migration-Kompatibilitaet
  it.todo('should run successfully on a database with existing migrations 0000-0006')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| — | Keine | — | Erster Slice, keine Dependencies |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `modelSettings` | Drizzle pgTable | slice-02 (Service) | `typeof modelSettings` — Drizzle table reference fuer Queries |
| `model_settings` DB-Tabelle | PostgreSQL Table | slice-02 (Service) | SQL-Tabelle mit unique constraint `(mode, tier)` |
| Seed-Daten (8 Eintraege) | DB Rows | slice-02 (Service), slice-03 (Actions) | Vorausgefuellte Default-Konfiguration fuer alle Modes/Tiers |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/db/schema.ts` — Bestehende Datei erweitern: `modelSettings` pgTable Definition mit allen Spalten und unique constraint auf `(mode, tier)`
- [ ] `drizzle/0007_*.sql` — Neue Migration (via `drizzle-kit generate`): CREATE TABLE + INSERT Seed-Daten (8 Default-Eintraege)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Query-Funktionen (kommen in Slice 2)
- KEINE Server Actions (kommen in Slice 3)
- KEINE Service-Logik (kommen in Slice 2)
- KEINE Typ-Definitionen fuer `Tier` oder `GenerationMode` (kommen in Slice 3)

**Technische Constraints:**
- Nutze Drizzle ORM pgTable-API (bestehendes Pattern aus `schema.ts`)
- Migration via `drizzle-kit generate` generieren, Seed-Daten manuell als INSERT-Statements in die Migration-Datei einfuegen
- Seed-INSERT mit `ON CONFLICT DO NOTHING` fuer Idempotenz
- UUID Primary Key mit `gen_random_uuid()` (bestehendes Pattern)
- Timestamp-Spalten mit `withTimezone: true` (bestehendes Pattern)
- Letzte existierende Migration: `0006_add_batch_id.sql`

**Referenzen:**
- Schema-Details: `architecture.md` -> Section "Database Schema" -> "Schema Details -- model_settings (new)"
- Seed-Daten: `architecture.md` -> Section "Database Schema" -> "Seed Data (migration inserts)"
- Discovery Daten-Tabelle: `discovery.md` -> Section "Data" -> "Neue Tabelle: model_settings"
