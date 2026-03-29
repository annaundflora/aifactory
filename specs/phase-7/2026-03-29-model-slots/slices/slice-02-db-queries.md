# Slice 2: DB Queries

> **Slice 2 von 7** fuer `Model Slots`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-02-db-queries` |
| **Test** | `pnpm test lib/db` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-db-schema-migration"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/db` |
| **Integration Command** | N/A |
| **Acceptance Command** | N/A |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | N/A |
| **Mocking Strategy** | `mock_external` (DB via Vitest mocks, kein echter DB-Zugriff) |

---

## Ziel

Vier neue Query-Funktionen fuer die `model_slots` Tabelle erstellen und die vier veralteten `model_settings`-Query-Funktionen entfernen. Damit wird die Datenzugriffs-Schicht vollstaendig auf das Slot-Modell umgestellt.

---

## Acceptance Criteria

1) GIVEN die `model_slots` Tabelle enthaelt 15 Rows (5 Modes x 3 Slots)
   WHEN `getAllModelSlots()` aufgerufen wird
   THEN wird ein Array mit exakt 15 Elementen zurueckgegeben
   AND jedes Element entspricht dem `ModelSlot` inferred Type (aus `modelSlots.$inferSelect`)

2) GIVEN `model_slots` enthaelt Rows fuer mode `txt2img` (slot 1, 2, 3) und mode `img2img` (slot 1, 2, 3)
   WHEN `getModelSlotsByMode("txt2img")` aufgerufen wird
   THEN wird ein Array mit exakt 3 Elementen zurueckgegeben
   AND alle Elemente haben `mode === "txt2img"`
   AND die Elemente sind nach `slot` aufsteigend sortiert (1, 2, 3)

3) GIVEN `model_slots` enthaelt fuer mode `txt2img`, slot 1 den model_id `black-forest-labs/flux-schnell`
   WHEN `upsertModelSlot("txt2img", 1, "black-forest-labs/flux-2-pro", { guidance: 3.5 }, true)` aufgerufen wird
   THEN wird die bestehende Row aktualisiert (kein neuer INSERT)
   AND die zurueckgegebene Row hat `modelId === "black-forest-labs/flux-2-pro"`, `modelParams === { guidance: 3.5 }`, `active === true`
   AND `updatedAt` ist auf den aktuellen Zeitpunkt gesetzt

4) GIVEN `model_slots` enthaelt KEINE Row fuer mode `inpaint`, slot 2
   WHEN `upsertModelSlot("inpaint", 2, "some-model/id", {}, false)` aufgerufen wird
   THEN wird eine neue Row inserted
   AND die zurueckgegebene Row hat mode `inpaint`, slot `2`, modelId `some-model/id`

5) GIVEN `model_slots` ist leer (0 Rows)
   WHEN `seedModelSlotDefaults()` aufgerufen wird
   THEN enthaelt `model_slots` exakt 15 Rows
   AND die Seed-Daten entsprechen der Tabelle in architecture.md Section "Seed Defaults (15 rows)"
   AND fuer jeden Mode ist slot 1 `active=true`, slots 2 und 3 `active=false`

6) GIVEN `model_slots` enthaelt bereits 15 Rows (vollstaendig geseeded)
   WHEN `seedModelSlotDefaults()` erneut aufgerufen wird
   THEN bleiben alle 15 Rows unveraendert (idempotent, ON CONFLICT DO NOTHING)
   AND kein Fehler wird geworfen

7) GIVEN `queries.ts` wird importiert
   WHEN die Exports geprueft werden
   THEN existieren KEINE Exports fuer `getAllModelSettings`, `getModelSettingByModeTier`, `upsertModelSetting`, `seedModelSettingsDefaults`
   AND der Import von `modelSettings` aus `./schema` ist entfernt
   AND der `ModelSetting` Type-Export ist entfernt

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/db/__tests__/queries-model-slots.test.ts`

<test_spec>
```typescript
// AC-1: getAllModelSlots liefert alle Rows
it.todo('should return all 15 model slot rows')

// AC-2: getModelSlotsByMode filtert nach Mode und sortiert nach Slot
it.todo('should return only slots for the given mode sorted by slot asc')

// AC-3: upsertModelSlot aktualisiert bestehende Row
it.todo('should update existing row on conflict and set updatedAt')

// AC-4: upsertModelSlot inserted neue Row
it.todo('should insert new row when no conflict exists')

// AC-5: seedModelSlotDefaults erzeugt 15 Rows
it.todo('should seed 15 default rows matching architecture.md defaults')

// AC-6: seedModelSlotDefaults ist idempotent
it.todo('should not modify existing rows when called again')

// AC-7: Alte model_settings Exports entfernt
it.todo('should not export getAllModelSettings, getModelSettingByModeTier, upsertModelSetting, seedModelSettingsDefaults, or ModelSetting type')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-db-schema-migration` | `modelSlots` pgTable | Drizzle Schema Export | `import { modelSlots } from "./schema"` kompiliert |
| `slice-01-db-schema-migration` | `model_slots` DB-Tabelle | SQL Table | Tabelle existiert mit UNIQUE(mode, slot) |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `getAllModelSlots()` | Async Query Function | `slice-02-slot-service` (Server Actions / Service) | `() => Promise<ModelSlot[]>` |
| `getModelSlotsByMode(mode)` | Async Query Function | `slice-02-slot-service` | `(mode: string) => Promise<ModelSlot[]>` |
| `upsertModelSlot(mode, slot, modelId, modelParams, active)` | Async Query Function | `slice-02-slot-service` | `(mode: string, slot: number, modelId: string, modelParams: Record<string, unknown>, active: boolean) => Promise<ModelSlot>` |
| `seedModelSlotDefaults()` | Async Query Function | `slice-02-slot-service` | `() => Promise<void>` |
| `ModelSlot` | Inferred Type Export | `slice-02-slot-service`, weitere Slices | `typeof modelSlots.$inferSelect` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/db/queries.ts` — MODIFY: 4 neue Slot-Query-Funktionen hinzufuegen (`getAllModelSlots`, `getModelSlotsByMode`, `upsertModelSlot`, `seedModelSlotDefaults`), 4 alte Settings-Query-Funktionen entfernen (`getAllModelSettings`, `getModelSettingByModeTier`, `upsertModelSetting`, `seedModelSettingsDefaults`), `ModelSetting` Type-Export entfernen, `modelSettings` Schema-Import entfernen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Server Actions (das ist ein spaeterer Slice)
- KEINE Service-Klasse / Business-Logic (Kompatibilitaets-Check, min-1-Regel etc.)
- KEINE Type-Aenderungen in `lib/types.ts` (SlotNumber etc. kommen spaeter)
- KEIN Entfernen von `model-settings-service.ts` oder `app/actions/model-settings.ts`
- KEINE UI-Aenderungen

**Technische Constraints:**
- Drizzle ORM Query-Builder verwenden (kein raw SQL, ausser fuer komplexe Faelle)
- `upsertModelSlot` MUSS `onConflictDoUpdate` auf `[modelSlots.mode, modelSlots.slot]` nutzen (gleicher Pattern wie bestehendes `upsertModelSetting`)
- `seedModelSlotDefaults` MUSS `onConflictDoNothing` nutzen (gleicher Pattern wie bestehendes `seedModelSettingsDefaults`)
- `getModelSlotsByMode` MUSS nach `slot` aufsteigend sortieren (deterministische Reihenfolge)
- Neuer Type-Export: `export type ModelSlot = typeof modelSlots.$inferSelect` (gleicher Pattern wie bestehender `ModelSetting` Type)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/db/queries.ts` | MODIFY: Bestehende Query-Patterns (upsert mit onConflict, seed mit onConflictDoNothing) als Vorlage fuer neue Funktionen nutzen. Zeilen 487-562 (Model Settings Section) werden durch neue Model Slots Section ersetzt |
| `lib/db/schema.ts` | Import: `modelSlots` statt `modelSettings` importieren (Schema-Aenderung aus Slice 01) |

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "Database Schema" (Schema Details, Seed Defaults 15 rows)
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "Architecture Layers" (Query-Layer Verantwortlichkeiten)
- Bestehender Code: `lib/db/queries.ts` Zeilen 487-562 als Pattern-Referenz fuer die neuen Funktionen
