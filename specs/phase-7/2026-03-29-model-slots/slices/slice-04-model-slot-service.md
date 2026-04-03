# Slice 4: ModelSlotService

> **Slice 4 von 7** fuer `Model Slots`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-04-model-slot-service` |
| **Test** | `pnpm test lib/services/model-slot-service` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-db-queries", "slice-03-types-resolve-model"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/services/model-slot-service` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | N/A |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | N/A |
| **Mocking Strategy** | `mock_external` (DB-Queries via Vitest mocks, kein echter DB-Zugriff) |

---

## Ziel

Neuen `ModelSlotService` erstellen, der die gesamte Business-Logik fuer Model Slots kapselt: CRUD-Operationen, Kompatibilitaets-Check, min-1-active Regel, Auto-Aktivierung bei Model-Zuweisung auf leere Slots und Seed-Defaults. Ersetzt den bestehenden `ModelSettingsService` vollstaendig.

---

## Acceptance Criteria

1) GIVEN die `model_slots` Tabelle enthaelt 15 Rows (5 Modes x 3 Slots)
   WHEN `ModelSlotService.getAll()` aufgerufen wird
   THEN wird ein Array mit 15 Elementen zurueckgegeben

2) GIVEN die `model_slots` Tabelle ist leer (0 Rows)
   WHEN `ModelSlotService.getAll()` aufgerufen wird
   THEN werden erst Defaults geseeded (15 Rows) und danach alle 15 Rows zurueckgegeben

3) GIVEN `model_slots` enthaelt Rows fuer 5 Modes
   WHEN `ModelSlotService.getForMode("txt2img")` aufgerufen wird
   THEN wird ein Array mit exakt 3 Elementen zurueckgegeben (slot 1, 2, 3)
   AND alle Elemente haben `mode === "txt2img"`

4) GIVEN slot 1 fuer mode `txt2img` hat model_id `black-forest-labs/flux-schnell`
   WHEN `ModelSlotService.update("txt2img", 1, "black-forest-labs/flux-2-pro")` aufgerufen wird
   AND das Model `flux-2-pro` ist kompatibel mit `txt2img`
   THEN wird die aktualisierte Row zurueckgegeben mit `modelId === "black-forest-labs/flux-2-pro"`

5) GIVEN ein Model `some-org/img-only-model` das in der `models` Tabelle `capabilities.txt2img === false` hat
   WHEN `ModelSlotService.update("txt2img", 1, "some-org/img-only-model")` aufgerufen wird
   THEN wird `{ error: "Model not compatible with mode" }` zurueckgegeben
   AND die bestehende Row bleibt unveraendert

6) GIVEN ein Model das NICHT in der `models` Tabelle existiert (kein DB-Eintrag)
   WHEN `ModelSlotService.update("img2img", 1, "unknown-org/new-model")` aufgerufen wird
   THEN wird der Update durchgefuehrt (Fallback: allow if model not in catalog)

7) GIVEN slot 2 fuer mode `txt2img` hat model_id=NULL (leerer Slot)
   WHEN `ModelSlotService.update("txt2img", 2, "black-forest-labs/flux-2-pro")` aufgerufen wird
   THEN wird die Row aktualisiert mit dem neuen model_id
   AND `active` wird automatisch auf `true` gesetzt (Auto-Aktivierung)

8) GIVEN fuer mode `txt2img` sind slot 1 (active=true) und slot 2 (active=true) aktiv, slot 3 (active=false) inaktiv
   WHEN `ModelSlotService.toggleActive("txt2img", 2, false)` aufgerufen wird
   THEN wird slot 2 auf `active=false` gesetzt und die aktualisierte Row zurueckgegeben

9) GIVEN fuer mode `txt2img` ist NUR slot 1 aktiv (active=true), slots 2+3 sind inactive
   WHEN `ModelSlotService.toggleActive("txt2img", 1, false)` aufgerufen wird
   THEN wird `{ error: "Cannot deactivate last active slot" }` zurueckgegeben
   AND slot 1 bleibt `active=true`

10) GIVEN slot 3 fuer mode `txt2img` hat model_id=NULL (leerer Slot)
    WHEN `ModelSlotService.toggleActive("txt2img", 3, true)` aufgerufen wird
    THEN wird `{ error: "Cannot activate empty slot" }` zurueckgegeben
    AND slot 3 bleibt `active=false`

11) GIVEN die `model_slots` Tabelle ist leer
    WHEN `ModelSlotService.seedDefaults()` aufgerufen wird
    THEN enthaelt die Tabelle exakt 15 Rows (5 Modes x 3 Slots)
    AND die Seed-Daten entsprechen architecture.md Section "Seed Defaults (15 rows)"

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/services/__tests__/model-slot-service.test.ts`

<test_spec>
```typescript
// AC-1: getAll liefert alle Slots
it.todo('should return all 15 model slots')

// AC-2: getAll seeded Defaults wenn Tabelle leer
it.todo('should seed defaults and return 15 rows when table is empty')

// AC-3: getForMode filtert nach Mode
it.todo('should return exactly 3 slots for the given mode')

// AC-4: update aendert model_id bei kompatiblem Model
it.todo('should update model_id when model is compatible with mode')

// AC-5: update lehnt inkompatibles Model ab
it.todo('should return error when model capabilities indicate incompatibility')

// AC-6: update erlaubt unbekanntes Model (Fallback)
it.todo('should allow update when model is not found in catalog')

// AC-7: update auto-aktiviert leeren Slot bei Model-Zuweisung
it.todo('should auto-activate slot when assigning model to empty slot')

// AC-8: toggleActive deaktiviert Slot wenn min-1 erfuellt
it.todo('should deactivate slot when at least one other slot remains active')

// AC-9: toggleActive verhindert Deaktivierung des letzten aktiven Slots
it.todo('should return error when attempting to deactivate last active slot')

// AC-10: toggleActive verhindert Aktivierung eines leeren Slots
it.todo('should return error when attempting to activate slot with no model')

// AC-11: seedDefaults erzeugt 15 Default-Rows
it.todo('should seed 15 default rows matching architecture.md seed defaults')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-02-db-queries` | `getAllModelSlots()` | Async Query Function | Import kompiliert |
| `slice-02-db-queries` | `getModelSlotsByMode(mode)` | Async Query Function | Import kompiliert |
| `slice-02-db-queries` | `upsertModelSlot(mode, slot, modelId, modelParams, active)` | Async Query Function | Import kompiliert |
| `slice-02-db-queries` | `seedModelSlotDefaults()` | Async Query Function | Import kompiliert |
| `slice-02-db-queries` | `getModelByReplicateId(replicateId)` | Async Query Function | Import kompiliert (fuer Compatibility-Check) |
| `slice-02-db-queries` | `ModelSlot` | Inferred Type | Import kompiliert |
| `slice-03-types-resolve-model` | `SlotNumber` | Type Export | Import kompiliert |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ModelSlotService.getAll()` | Async Method | `slice-05-server-actions` | `() => Promise<ModelSlot[]>` |
| `ModelSlotService.getForMode(mode)` | Async Method | `slice-05-server-actions` | `(mode: string) => Promise<ModelSlot[]>` |
| `ModelSlotService.update(mode, slot, modelId, modelParams?)` | Async Method | `slice-05-server-actions` | `(mode: string, slot: SlotNumber, modelId: string, modelParams?: Record<string, unknown>) => Promise<ModelSlot \| {error: string}>` |
| `ModelSlotService.toggleActive(mode, slot, active)` | Async Method | `slice-05-server-actions` | `(mode: string, slot: SlotNumber, active: boolean) => Promise<ModelSlot \| {error: string}>` |
| `ModelSlotService.seedDefaults()` | Async Method | `slice-05-server-actions` | `() => Promise<void>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/model-slot-service.ts` — NEW: `ModelSlotService` Objekt mit `getAll()`, `getForMode()`, `update()`, `toggleActive()`, `seedDefaults()` und interner `checkCompatibility()` Methode
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Server Actions (kommt in einem spaeteren Slice)
- KEINE UI-Aenderungen
- KEIN Entfernen von `model-settings-service.ts` — wird in einem spaeteren Cleanup-Slice entfernt
- KEINE Aenderungen an `lib/db/queries.ts` oder `lib/db/schema.ts` (Slice 01 + 02)
- KEINE Aenderungen an `lib/types.ts` oder `lib/utils/resolve-model.ts` (Slice 03)

**Technische Constraints:**
- Service als exportiertes Objekt-Literal (gleicher Pattern wie `ModelSettingsService`)
- Compatibility-Check-Logik aus `ModelSettingsService.checkCompatibility` uebernehmen (txt2img immer kompatibel, Fallback true bei fehlendem Model/fehlenden Capabilities)
- `update()` MUSS Auto-Aktivierung implementieren: wenn bestehender Slot model_id=NULL hat und ein Model zugewiesen wird, wird `active=true` gesetzt
- `toggleActive()` MUSS min-1-active Regel pruefen: vor Deaktivierung zaehlen wie viele aktive Slots der Mode noch hat
- `toggleActive()` MUSS Aktivierung von Slots mit model_id=NULL ablehnen
- Alle Methoden geben bei Business-Fehler `{ error: string }` zurueck (kein Throw)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/services/model-settings-service.ts` | Pattern-Referenz: gleiche Objekt-Struktur, `getAll()` mit auto-seed Pattern, `checkCompatibility()` Logik 1:1 uebernehmen. Datei wird NICHT modifiziert, nur als Vorlage genutzt |

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "Server Logic" (Business Logic Flow, Validation Rules)
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "API Design" (DTOs, Server Actions — fuer Input/Output-Verstaendnis)
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "Error Handling Strategy"
