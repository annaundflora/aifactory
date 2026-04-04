# Slice 1: Types & Model Slot Defaults

> **Slice 1 von 16** fuer `AI Image Editing Suite`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-01-types-model-slots` |
| **Test** | `pnpm test lib/__tests__/types.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/__tests__/types.test.ts` |
| **Integration Command** | `pnpm test lib/db/__tests__/queries.test.ts` |
| **Acceptance Command** | `pnpm test -- --run` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` (types), `test_containers` (seed-Funktion benoetigt DB) |

---

## Ziel

`GenerationMode`-Type und `VALID_GENERATION_MODES`-Konstante um die zwei neuen Edit-Modi `erase` und `instruction` erweitern. `seedModelSlotDefaults()` aktualisieren: bestehende inpaint/outpaint-Rows mit konkreten Modell-IDs befuellen, neue Rows fuer `erase` (3 Slots) und `instruction` (3 Slots) hinzufuegen.

---

## Acceptance Criteria

1) GIVEN `lib/types.ts` wird importiert
   WHEN `GenerationMode` als Type geprueft wird
   THEN ist es eine Union aus genau 7 Werten: `"txt2img" | "img2img" | "upscale" | "inpaint" | "outpaint" | "erase" | "instruction"`

2) GIVEN `lib/types.ts` wird importiert
   WHEN `VALID_GENERATION_MODES` gelesen wird
   THEN enthaelt das Array genau 7 Eintraege in der Reihenfolge `["txt2img", "img2img", "upscale", "inpaint", "outpaint", "erase", "instruction"]`

3) GIVEN eine leere Datenbank
   WHEN `seedModelSlotDefaults()` aufgerufen wird
   THEN existieren 21 Rows in `model_slots` (7 Modi x 3 Slots)

4) GIVEN eine leere Datenbank
   WHEN `seedModelSlotDefaults()` aufgerufen wird
   THEN hat der Row `mode="inpaint", slot=1` die `modelId` `"black-forest-labs/flux-fill-pro"`
   AND hat der Row `mode="erase", slot=1` die `modelId` `"bria/eraser"`
   AND hat der Row `mode="instruction", slot=1` die `modelId` `"black-forest-labs/flux-kontext-pro"`
   AND hat der Row `mode="outpaint", slot=1` die `modelId` `"black-forest-labs/flux-fill-pro"`

5) GIVEN eine leere Datenbank
   WHEN `seedModelSlotDefaults()` aufgerufen wird
   THEN haben die Rows `mode="erase", slot=2`, `mode="erase", slot=3`, `mode="instruction", slot=2`, `mode="instruction", slot=3` jeweils `modelId = null`

6) GIVEN `seedModelSlotDefaults()` wurde bereits ausgefuehrt
   WHEN `seedModelSlotDefaults()` erneut aufgerufen wird
   THEN bleiben alle 21 Rows unveraendert (Idempotenz via `onConflictDoNothing`)

7) GIVEN bestehende Tests in `lib/__tests__/types.test.ts`
   WHEN die Tests die alte 5er-Union pruefen
   THEN muessen diese Tests auf die neue 7er-Union angepasst werden, damit `pnpm test` gruen bleibt

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/__tests__/types.test.ts`

<test_spec>
```typescript
// AC-1: GenerationMode ist 7er-Union
it.todo('should export GenerationMode as 7-member union including erase and instruction')

// AC-2: VALID_GENERATION_MODES enthaelt 7 Eintraege
it.todo('should export VALID_GENERATION_MODES with 7 entries in correct order')
```
</test_spec>

### Test-Datei: `lib/db/__tests__/queries.seed.test.ts`

<test_spec>
```typescript
// AC-3: 21 Rows nach Seed
it.todo('should create 21 model_slot rows for 7 modes x 3 slots')

// AC-4: Korrekte Default-Modell-IDs fuer Slot 1
it.todo('should set correct default modelId for inpaint, erase, instruction, outpaint slot 1')

// AC-5: Null-Modelle fuer leere Slots
it.todo('should set modelId null for erase slot 2/3 and instruction slot 2/3')

// AC-6: Idempotenz
it.todo('should be idempotent — second call does not change existing rows')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| -- | -- | -- | Erster Slice, keine Abhaengigkeiten |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `GenerationMode` | Type | slice-02, slice-06a, slice-06b, slice-07, slice-08 | `type GenerationMode = "txt2img" \| ... \| "erase" \| "instruction"` |
| `VALID_GENERATION_MODES` | Const Array | slice-06a (Validation) | `readonly GenerationMode[]` mit 7 Eintraegen |
| `seedModelSlotDefaults()` | Function | Deployment/Seed-Script | `() => Promise<void>` — 21 Rows inkl. Default-Modelle |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/types.ts` — `GenerationMode` um `"erase"` und `"instruction"` erweitern, `VALID_GENERATION_MODES` aktualisieren
- [ ] `lib/db/queries.ts` — `seedModelSlotDefaults()` um 6 neue Rows (erase x3, instruction x3) erweitern + bestehende inpaint/outpaint Slot-1-Rows mit Modell-IDs befuellen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE neuen DB-Tabellen oder Spalten (bestehende `model_slots.mode` varchar(20) akzeptiert neue Werte)
- KEINE Aenderungen an `GenerateImagesInput`, `GenerationService` oder anderen Consumern (das ist Slice 06a)
- KEINE UI-Aenderungen
- Bestehende Tests in `lib/__tests__/types.test.ts` muessen angepasst werden (AC-7): die alte 5er-Union-Pruefung (Zeile 74-76, 79-85) muss die 7er-Union reflektieren

**Technische Constraints:**
- `VALID_GENERATION_MODES` muss `as const` behalten und `readonly GenerationMode[]` typisiert bleiben
- Neue Modes am Ende des Arrays anfuegen (bestehende Reihenfolge nicht aendern)
- `seedModelSlotDefaults()` nutzt weiterhin `onConflictDoNothing` auf `[mode, slot]` Composite Key
- Modell-IDs exakt wie in architecture.md → Section "Seed Defaults Update" angegeben

**Reuse (PFLICHT):**

| Existing File | Usage in this Slice |
|---|---|
| `lib/types.ts` | MODIFY — 2 Zeilen aendern (GenerationMode + VALID_GENERATION_MODES) |
| `lib/db/queries.ts` | MODIFY — `seedModelSlotDefaults()` defaults-Array erweitern |
| `lib/__tests__/types.test.ts` | MODIFY — bestehende AC-2-Assertion von 5er auf 7er-Union anpassen |

**Referenzen:**
- Architecture: `architecture.md` → Section "Type Extension" (Zeile 119-124)
- Architecture: `architecture.md` → Section "Seed Defaults Update" (Zeile 126-138)
- Architecture: `architecture.md` → Section "Integrations" (Zeile 365-379) fuer Modell-IDs
