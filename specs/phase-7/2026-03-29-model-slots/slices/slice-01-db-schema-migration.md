# Slice 1: DB Schema + Migration

> **Slice 1 von 7** fuer `Model Slots`

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
| **Integration Command** | `npx drizzle-kit push --dry-run` |
| **Acceptance Command** | `npx drizzle-kit migrate` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | N/A (Schema-only Slice) |
| **Mocking Strategy** | `no_mocks` (Migration laeuft gegen echte DB) |

---

## Ziel

Die bestehende `model_settings` Tabelle (tier-basiert, 9 Rows) durch eine neue `model_slots` Tabelle (slot-basiert, 15 Rows) ersetzen. Bestehende Daten werden migriert (tier-to-slot Mapping), fehlende Modes werden mit Defaults geseeded. Danach wird `model_settings` gedroppt.

---

## Acceptance Criteria

1) GIVEN eine Datenbank mit der bestehenden `model_settings` Tabelle
   WHEN Migration `0012_add_model_slots.sql` ausgefuehrt wird
   THEN existiert eine Tabelle `model_slots` mit den Spalten: `id` (uuid PK), `mode` (varchar(20) NOT NULL), `slot` (integer NOT NULL, CHECK 1-3), `model_id` (varchar(255) NULLABLE), `model_params` (jsonb NOT NULL DEFAULT '{}'), `active` (boolean NOT NULL DEFAULT false), `created_at` (timestamptz), `updated_at` (timestamptz)
   AND ein UNIQUE-Index auf `(mode, slot)` existiert

2) GIVEN `model_settings` enthaelt Rows fuer mode `txt2img` mit tiers `draft`, `quality`, `max`
   WHEN Migration ausgefuehrt wird
   THEN `model_slots` enthaelt fuer mode `txt2img`: slot=1 mit model_id und active=true (aus tier=draft), slot=2 mit model_id und active=false (aus tier=quality), slot=3 mit model_id und active=false (aus tier=max)
   AND `model_params` werden 1:1 uebernommen

3) GIVEN `model_settings` enthaelt KEINE Rows fuer modes `inpaint` und `outpaint`
   WHEN Migration ausgefuehrt wird
   THEN `model_slots` enthaelt fuer jede dieser modes je 3 Rows (slot 1-3) mit model_id=NULL, model_params='{}', slot 1 active=true, slots 2-3 active=false

4) GIVEN Migration wurde vollstaendig ausgefuehrt
   WHEN `SELECT count(*) FROM model_slots` abgefragt wird
   THEN Ergebnis ist exakt 15 (5 modes x 3 slots)
   AND `SELECT count(*) FROM information_schema.tables WHERE table_name='model_settings'` ergibt 0

5) GIVEN die neue `model_slots` Tabelle existiert
   WHEN das Drizzle-Schema in `lib/db/schema.ts` geladen wird
   THEN ist `modelSlots` als pgTable exportiert mit allen Spalten gemaess architecture.md Section "Schema Details"
   AND `modelSettings` pgTable-Export existiert NICHT mehr

6) GIVEN ein INSERT mit slot=4 auf `model_slots` versucht wird
   WHEN die DB den CHECK-Constraint prueft
   THEN wird der INSERT abgelehnt (CHECK violation: slot IN (1,2,3))

7) GIVEN ein INSERT mit identischem (mode, slot) Paar versucht wird
   WHEN die DB den UNIQUE-Constraint prueft
   THEN wird der INSERT abgelehnt (UNIQUE violation)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/db/__tests__/schema.test.ts`

<test_spec>
```typescript
// AC-1: model_slots Tabellen-Struktur
it.todo('should define modelSlots table with all required columns and unique index on (mode, slot)')

// AC-5: Schema-Export korrekt
it.todo('should export modelSlots pgTable and NOT export modelSettings')

// AC-6: CHECK-Constraint slot 1-3 (Schema-Level)
it.todo('should define slot column with integer type')

// AC-7: UNIQUE-Constraint mode+slot (Schema-Level)
it.todo('should define unique index on mode and slot')
```
</test_spec>

### Test-Datei: `drizzle/__tests__/0012-migration.test.ts`

<test_spec>
```typescript
// AC-2: Tier-to-Slot Datenmigration
it.todo('should migrate model_settings tier=draft to slot=1 active=true, tier=quality to slot=2 active=false, tier=max to slot=3 active=false')

// AC-3: Seed-Defaults fuer fehlende Modes
it.todo('should seed 3 rows per missing mode with slot 1 active and model_id NULL')

// AC-4: 15 Rows total + model_settings gedroppt
it.todo('should result in exactly 15 rows in model_slots and model_settings table dropped')

// AC-6: CHECK-Constraint Enforcement
it.todo('should reject insert with slot=4 via CHECK constraint')

// AC-7: UNIQUE-Constraint Enforcement
it.todo('should reject duplicate mode+slot insert via UNIQUE constraint')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| – | – | – | Erster Slice, keine Abhaengigkeiten |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `modelSlots` | Drizzle pgTable | `slice-02-slot-service` | `modelSlots` Export aus `lib/db/schema.ts` |
| `model_slots` DB-Tabelle | SQL Table | `slice-02-slot-service` | 15 Rows, UNIQUE(mode, slot), nullable model_id |
| Seed-Daten | DB Rows | `slice-02-slot-service`, `slice-03-ui` | 5 Modes x 3 Slots mit Defaults gemaess architecture.md Section "Seed Defaults" |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/db/schema.ts` — MODIFY: `modelSlots` pgTable hinzufuegen, `modelSettings` pgTable entfernen
- [ ] `drizzle/0012_add_model_slots.sql` — NEW: Migration mit CREATE TABLE, INSERT...SELECT, SEED, DROP TABLE
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Query-Funktionen (queries.ts) -- das ist Slice 2
- KEINE Server Actions -- das ist Slice 2
- KEINE Service-Klasse -- das ist Slice 2
- KEINE Type-Aenderungen in `lib/types.ts` -- das ist Slice 2
- KEIN Entfernen von `model-settings-service.ts` oder `model-settings.ts` Actions -- spaetere Slices

**Technische Constraints:**
- Drizzle ORM pgTable-Definition (kein raw SQL im Schema)
- Migration als plain SQL in `drizzle/0012_add_model_slots.sql`
- Migration MUSS idempotent-sicher sein (IF NOT EXISTS fuer CREATE TABLE)
- Migration MUSS in einer Transaction laufen
- Seed-Defaults muessen exakt der Tabelle in architecture.md Section "Seed Defaults (15 rows)" entsprechen

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/db/schema.ts` | MODIFY: `modelSettings` pgTable entfernen, `modelSlots` pgTable hinzufuegen. Bestehende Imports/Patterns (uuid, varchar, jsonb etc.) wiederverwenden |

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` → Section "Database Schema" (Schema Details, Migration Strategy, Seed Defaults)
- Discovery: `specs/phase-7/2026-03-29-model-slots/discovery.md` → Section 4 "Datenmodell" (Tier-to-Slot Mapping)
