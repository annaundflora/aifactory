# Slice 3: Types + resolve-model Refactor

> **Slice 3 von 7** fuer `Model Slots`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-03-types-resolve-model` |
| **Test** | `pnpm test lib/utils/resolve-model lib/__tests__/types` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-db-queries"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/utils/resolve-model lib/__tests__/types` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | `pnpm tsc --noEmit` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | N/A (Utility-only Slice) |
| **Mocking Strategy** | `no_mocks` (Pure Functions, kein I/O) |

---

## Ziel

Den `Tier` Type und `VALID_TIERS` durch `SlotNumber` und `VALID_SLOTS` ersetzen. Die Funktion `resolveModel()` in `resolveActiveSlots()` refactoren: statt eines einzelnen Ergebnis-Objekts basierend auf mode+tier gibt die neue Funktion ein Array von `{modelId, modelParams}` zurueck, gefiltert nach mode + active-Flag.

---

## Acceptance Criteria

1) GIVEN `lib/types.ts` wird importiert
   WHEN die Exports geprueft werden
   THEN existiert ein Type `SlotNumber = 1 | 2 | 3`
   AND existiert eine Konstante `VALID_SLOTS` mit Wert `[1, 2, 3] as const`
   AND der Type `Tier` existiert NICHT mehr
   AND die Konstante `VALID_TIERS` existiert NICHT mehr
   AND der `UpdateModelSettingInput` DTO existiert NICHT mehr

2) GIVEN `lib/types.ts` enthaelt weiterhin
   WHEN `GenerationMode` und `VALID_GENERATION_MODES` geprueft werden
   THEN sind beide unveraendert vorhanden

3) GIVEN ein Array von `ModelSlot[]` mit 3 Eintraegen fuer mode `txt2img`:
   slot 1 (active=true, modelId=`black-forest-labs/flux-schnell`, modelParams=`{}`),
   slot 2 (active=true, modelId=`black-forest-labs/flux-2-pro`, modelParams=`{guidance: 3.5}`),
   slot 3 (active=false, modelId=`black-forest-labs/flux-2-max`, modelParams=`{}`)
   WHEN `resolveActiveSlots(slots, "txt2img")` aufgerufen wird
   THEN wird ein Array mit exakt 2 Elementen zurueckgegeben
   AND Element 0 hat `modelId === "black-forest-labs/flux-schnell"` und `modelParams === {}`
   AND Element 1 hat `modelId === "black-forest-labs/flux-2-pro"` und `modelParams === {guidance: 3.5}`

4) GIVEN ein Array von `ModelSlot[]` mit Eintraegen fuer `txt2img` und `img2img`
   WHEN `resolveActiveSlots(slots, "img2img")` aufgerufen wird
   THEN enthaelt das Ergebnis-Array NUR Eintraege mit mode `img2img`
   AND keine Eintraege mit mode `txt2img`

5) GIVEN ein Array von `ModelSlot[]` wo KEIN Slot fuer mode `outpaint` active ist
   WHEN `resolveActiveSlots(slots, "outpaint")` aufgerufen wird
   THEN wird ein leeres Array `[]` zurueckgegeben

6) GIVEN ein `ModelSlot` mit active=true aber modelId=null
   WHEN `resolveActiveSlots(slots, mode)` aufgerufen wird
   THEN wird dieser Slot NICHT im Ergebnis-Array enthalten (null modelId wird uebersprungen)

7) GIVEN ein `ModelSlot` mit active=true und modelParams=null
   WHEN `resolveActiveSlots(slots, mode)` aufgerufen wird
   THEN wird modelParams zu `{}` normalisiert (gleicher Pattern wie bisheriges `resolveModel`)

8) GIVEN `lib/utils/resolve-model.ts` wird importiert
   WHEN die Exports geprueft werden
   THEN existiert `resolveActiveSlots` als Named Export
   AND die Funktion `resolveModel` existiert NICHT mehr
   AND der Import-Type ist `ModelSlot` (aus `@/lib/db/queries`), NICHT `ModelSetting`
   AND der Import-Type `Tier` (aus `@/lib/types`) existiert NICHT mehr

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/__tests__/types.test.ts`

<test_spec>
```typescript
// AC-1: SlotNumber Type und VALID_SLOTS Konstante existieren
it.todo('should export SlotNumber type and VALID_SLOTS constant [1, 2, 3]')

// AC-1: Tier und VALID_TIERS entfernt
it.todo('should NOT export Tier type or VALID_TIERS constant')

// AC-1: UpdateModelSettingInput DTO entfernt
it.todo('should NOT export UpdateModelSettingInput')

// AC-2: GenerationMode und VALID_GENERATION_MODES unveraendert
it.todo('should still export GenerationMode and VALID_GENERATION_MODES unchanged')
```
</test_spec>

### Test-Datei: `lib/utils/resolve-model.test.ts`

<test_spec>
```typescript
// AC-3: Filtert nach mode + active und gibt Array zurueck
it.todo('should return array of {modelId, modelParams} for active slots matching the given mode')

// AC-4: Filtert nur den angegebenen Mode
it.todo('should only include slots matching the requested mode, not other modes')

// AC-5: Leeres Array wenn kein aktiver Slot fuer Mode
it.todo('should return empty array when no active slots exist for the given mode')

// AC-6: Ueberspringt aktive Slots mit null modelId
it.todo('should skip active slots where modelId is null')

// AC-7: Normalisiert null modelParams zu leerem Objekt
it.todo('should normalize null modelParams to empty object')

// AC-8: Export-Pruefung — resolveActiveSlots statt resolveModel
it.todo('should export resolveActiveSlots and NOT export resolveModel')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-02-db-queries` | `ModelSlot` | Inferred Type Export | `import type { ModelSlot } from "@/lib/db/queries"` kompiliert |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `SlotNumber` | Type Export | `slice-04-service-actions`, `slice-05-ui`, weitere | `1 \| 2 \| 3` |
| `VALID_SLOTS` | Const Export | `slice-04-service-actions` | `readonly [1, 2, 3]` |
| `resolveActiveSlots` | Pure Function | `slice-05-workspace`, `slice-06-canvas` | `(slots: ModelSlot[], mode: GenerationMode) => {modelId: string, modelParams: Record<string, unknown>}[]` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/types.ts` — MODIFY: `Tier` Type entfernen, `VALID_TIERS` entfernen, `UpdateModelSettingInput` entfernen; `SlotNumber` Type hinzufuegen, `VALID_SLOTS` Konstante hinzufuegen
- [ ] `lib/utils/resolve-model.ts` — MODIFY: `resolveModel()` durch `resolveActiveSlots()` ersetzen, Import von `ModelSlot` statt `ModelSetting`, Import von `Tier` entfernen, Return-Type auf Array aendern
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an Consumer-Dateien (prompt-area.tsx, popovers, canvas-detail-view.tsx, settings etc.) — das sind spaetere Slices
- KEINE Server Actions oder Service-Klasse
- KEINE DB-Query-Aenderungen (Slice 02)
- KEINE Schema-Aenderungen (Slice 01)
- KEINE Entfernung von `tier-toggle.tsx` oder `max-quality-toggle.tsx` — spaetere Slices
- Consumer-Dateien, die `Tier` oder `resolveModel` importieren, werden in diesem Slice NICHT angepasst. TypeScript-Fehler in Consumern sind erwartet und werden durch spaetere Slices behoben. `pnpm tsc --noEmit` bezieht sich auf die Kompilierung der EIGENEN Deliverables, nicht des gesamten Projekts.

**Technische Constraints:**
- `resolveActiveSlots()` MUSS eine pure Function bleiben (kein I/O, keine Side Effects)
- `resolveActiveSlots()` MUSS Slots mit `modelId === null` aus dem Ergebnis filtern
- `resolveActiveSlots()` MUSS `null`/`undefined` modelParams zu `{}` normalisieren (bestehender Pattern aus `resolveModel`)
- Ergebnis-Array-Reihenfolge folgt der Slot-Reihenfolge im Input-Array (keine eigene Sortierung)
- `SlotNumber` als Union Type `1 | 2 | 3` (nicht als enum)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/types.ts` | MODIFY: Bestehende `GenerationMode` und `VALID_GENERATION_MODES` bleiben unveraendert. Nur Tier-bezogene Exports entfernen und Slot-Exports hinzufuegen |
| `lib/utils/resolve-model.ts` | MODIFY: Bestehende Datei komplett refactoren. Null-Normalisierung-Pattern aus `resolveModel` uebernehmen |

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "Migration Map" (Modified Files: `lib/types.ts`, `lib/utils/resolve-model.ts`)
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "Server Logic" (Business Logic Flow: `resolveActiveSlots(slots, mode)` Signatur)
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "Architecture Layers" (Utility Layer)
