# Slice 2: Model Settings Service

> **Slice 2 von 13** fuer `Model Handling Redesign`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-02-model-settings-service` |
| **Test** | `pnpm test lib/db lib/services` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-db-schema-migration"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/services/model-settings-service` |
| **Integration Command** | `pnpm test lib/db/queries` |
| **Acceptance Command** | `pnpm test lib/services/model-settings-service lib/db/queries` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (DB-Queries und ModelSchemaService werden gemockt) |

---

## Ziel

Query-Funktionen fuer die `model_settings` Tabelle in `queries.ts` bereitstellen und einen `ModelSettingsService` implementieren, der CRUD-Operationen, Default-Seeding und Model-Kompatibilitaetspruefung kapselt. Damit entsteht die Service-Schicht zwischen DB und den Server Actions (Slice 3).

---

## Acceptance Criteria

1) GIVEN keine Eintraege in `model_settings`
   WHEN `getAllModelSettings()` Query aufgerufen wird
   THEN wird ein leeres Array `[]` zurueckgegeben

2) GIVEN 8 Seed-Eintraege in `model_settings`
   WHEN `getAllModelSettings()` Query aufgerufen wird
   THEN werden alle 8 Eintraege als Array zurueckgegeben mit Feldern `id`, `mode`, `tier`, `modelId`, `modelParams`, `createdAt`, `updatedAt`

3) GIVEN ein Eintrag mit `mode="txt2img"` und `tier="draft"` existiert
   WHEN `getModelSettingByModeTier("txt2img", "draft")` aufgerufen wird
   THEN wird genau dieser eine Eintrag zurueckgegeben

4) GIVEN kein Eintrag fuer `mode="txt2img"` und `tier="max"` existiert
   WHEN `getModelSettingByModeTier("txt2img", "max")` aufgerufen wird
   THEN wird `undefined` zurueckgegeben

5) GIVEN kein Eintrag fuer `(txt2img, draft)` existiert
   WHEN `upsertModelSetting("txt2img", "draft", "owner/new-model", {})` aufgerufen wird
   THEN wird ein neuer Eintrag erstellt und zurueckgegeben mit `modelId="owner/new-model"`

6) GIVEN ein Eintrag fuer `(txt2img, draft)` mit `modelId="old/model"` existiert
   WHEN `upsertModelSetting("txt2img", "draft", "owner/new-model", { "key": "val" })` aufgerufen wird
   THEN wird der bestehende Eintrag aktualisiert: `modelId="owner/new-model"`, `modelParams={ "key": "val" }`, `updatedAt` ist neuer als vorher

7) GIVEN eine leere `model_settings` Tabelle
   WHEN `seedModelSettingsDefaults()` aufgerufen wird
   THEN existieren danach exakt 8 Eintraege (gleiche Daten wie in architecture.md -> "Seed Data")

8) GIVEN 8 bestehende Eintraege in `model_settings`
   WHEN `seedModelSettingsDefaults()` erneut aufgerufen wird
   THEN bleiben exakt 8 Eintraege bestehen (ON CONFLICT DO NOTHING, idempotent), keine Duplikate

9) GIVEN `ModelSettingsService.getAll()` wird aufgerufen und die Tabelle ist leer
   WHEN der Service die Abfrage ausfuehrt
   THEN werden zuerst Defaults geseeded und danach die 8 Default-Eintraege zurueckgegeben

10) GIVEN `ModelSettingsService.getAll()` wird aufgerufen und die Tabelle hat Eintraege
    WHEN der Service die Abfrage ausfuehrt
    THEN werden die vorhandenen Eintraege zurueckgegeben ohne erneutes Seeding

11) GIVEN ein Model mit `modelId="compatible/model"` das img2img unterstuetzt (Schema hat img2img-Feld)
    WHEN `ModelSettingsService.checkCompatibility("compatible/model", "img2img")` aufgerufen wird
    THEN wird `true` zurueckgegeben

12) GIVEN ein Model mit `modelId="incompatible/model"` das kein img2img-Feld im Schema hat
    WHEN `ModelSettingsService.checkCompatibility("incompatible/model", "img2img")` aufgerufen wird
    THEN wird `false` zurueckgegeben

13) GIVEN ein beliebiges Model
    WHEN `ModelSettingsService.checkCompatibility("any/model", "txt2img")` aufgerufen wird
    THEN wird `true` zurueckgegeben (txt2img ist immer kompatibel)

14) GIVEN ein beliebiges Model
    WHEN `ModelSettingsService.checkCompatibility("any/model", "upscale")` aufgerufen wird
    THEN wird `true` zurueckgegeben (upscale-Kompatibilitaet wird nicht per Schema geprueft)

15) GIVEN `ModelSettingsService.update("img2img", "quality", "new/model")` wird aufgerufen
    WHEN `checkCompatibility("new/model", "img2img")` `false` zurueckgibt
    THEN gibt `update()` ein Error-Objekt zurueck `{ error: "Model does not support this mode" }` und schreibt NICHT in die DB

16) GIVEN `ModelSettingsService.update("txt2img", "draft", "valid/model")` wird aufgerufen
    WHEN `checkCompatibility` `true` zurueckgibt
    THEN wird die `upsertModelSetting` Query aufgerufen und der aktualisierte Eintrag zurueckgegeben

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/db/__tests__/queries-model-settings.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('model_settings query functions', () => {
  // AC-1: Leere Tabelle
  it.todo('should return empty array when no model_settings exist')

  // AC-2: Alle Eintraege lesen
  it.todo('should return all model_settings entries with correct fields')

  // AC-3: Eintrag nach mode+tier finden
  it.todo('should return matching entry for getModelSettingByModeTier')

  // AC-4: Kein Eintrag gefunden
  it.todo('should return undefined when no entry matches mode+tier')

  // AC-5: Insert bei neuem mode+tier
  it.todo('should insert new entry via upsertModelSetting when no conflict')

  // AC-6: Update bei bestehendem mode+tier
  it.todo('should update existing entry via upsertModelSetting on conflict')

  // AC-7: Seed-Defaults einfuegen
  it.todo('should seed 8 default entries into empty table')

  // AC-8: Seed-Defaults idempotent
  it.todo('should not create duplicates when seedModelSettingsDefaults called twice')
})
```
</test_spec>

### Test-Datei: `lib/services/__tests__/model-settings-service.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ModelSettingsService', () => {
  describe('getAll()', () => {
    // AC-9: Auto-Seed bei leerer Tabelle
    it.todo('should seed defaults and return 8 entries when table is empty')

    // AC-10: Kein Seeding bei vorhandenen Eintraegen
    it.todo('should return existing entries without seeding when table has data')
  })

  describe('checkCompatibility()', () => {
    // AC-11: Kompatibles img2img Model
    it.todo('should return true for img2img-compatible model')

    // AC-12: Inkompatibles img2img Model
    it.todo('should return false for model without img2img support')

    // AC-13: txt2img immer kompatibel
    it.todo('should return true for any model with txt2img mode')

    // AC-14: upscale immer kompatibel
    it.todo('should return true for any model with upscale mode')
  })

  describe('update()', () => {
    // AC-15: Update abgelehnt bei Inkompatibilitaet
    it.todo('should return error object when model is incompatible with mode')

    // AC-16: Erfolgreicher Update
    it.todo('should upsert and return updated setting when model is compatible')
  })
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-db-schema-migration` | `modelSettings` | Drizzle pgTable | Import aus `lib/db/schema.ts`, Tabelle existiert in DB |
| `slice-01-db-schema-migration` | Seed-Daten (8 Eintraege) | DB Rows | Fuer `seedDefaults()` Referenzwerte |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `getAllModelSettings` | Query Function | slice-03 (Actions) | `() => Promise<ModelSetting[]>` |
| `getModelSettingByModeTier` | Query Function | slice-03 (Actions) | `(mode: string, tier: string) => Promise<ModelSetting \| undefined>` |
| `upsertModelSetting` | Query Function | slice-03 (Actions) | `(mode: string, tier: string, modelId: string, modelParams: Record<string, unknown>) => Promise<ModelSetting>` |
| `seedModelSettingsDefaults` | Query Function | slice-03 (Actions) | `() => Promise<void>` |
| `ModelSettingsService` | Service Module | slice-03 (Actions) | `.getAll()`, `.getForModeTier()`, `.update()`, `.seedDefaults()`, `.checkCompatibility()` |
| `ModelSetting` | TypeAlias (inferred) | slice-03, slice-04, slice-06 | `typeof modelSettings.$inferSelect` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/db/queries.ts` -- Bestehende Datei erweitern: `getAllModelSettings`, `getModelSettingByModeTier`, `upsertModelSetting`, `seedModelSettingsDefaults` Query-Funktionen + `ModelSetting` Type-Export
- [ ] `lib/services/model-settings-service.ts` -- Neuer Service: `getAll()`, `getForModeTier()`, `update()`, `seedDefaults()`, `checkCompatibility()`
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Server Actions (kommen in Slice 3)
- KEINE Typ-Definitionen fuer `Tier` oder `GenerationMode` Enums (kommen in Slice 3) -- Service nutzt string-Parameter
- KEINE UI-Komponenten
- KEINE Aenderungen am DB-Schema oder Migrationen (erledigt in Slice 1)
- KEINE Validierung von `modelId`-Format (kommt in Slice 3 Server Actions)

**Technische Constraints:**
- Nutze Drizzle ORM Query-API (bestehendes Pattern aus `queries.ts`: `db.select()`, `db.insert()`, etc.)
- `upsertModelSetting` nutzt `onConflictDoUpdate` auf dem `(mode, tier)` Unique Constraint
- `seedModelSettingsDefaults` nutzt `onConflictDoNothing` fuer Idempotenz
- `checkCompatibility` delegiert an `ModelSchemaService.supportsImg2Img()` -- nur fuer mode `img2img` relevant
- `ModelSetting` Type via `typeof modelSettings.$inferSelect` aus Schema ableiten (bestehendes Pattern)
- `update()` ruft `checkCompatibility()` VOR dem DB-Write auf und gibt bei Inkompatibilitaet `{ error: string }` zurueck

**Referenzen:**
- Service-Funktionen: `architecture.md` -> Section "New Service: ModelSettingsService"
- Query-Signaturen: `architecture.md` -> Section "Migration Map" -> `lib/db/queries.ts`
- ModelSchemaService: `lib/services/model-schema-service.ts` -> `supportsImg2Img(modelId)`
- Seed-Daten: `architecture.md` -> Section "Seed Data (migration inserts)"
