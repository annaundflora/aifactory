# Slice 06a: Generation Service Extension

> **Slice 06a von 16** fuer `AI Image Editing Suite`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-06a-generation-service` |
| **Test** | `pnpm test lib/services/__tests__/generation-service-edit.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-types-model-slots"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/services/__tests__/generation-service-edit.test.ts` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm test -- --run` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (ReplicateClient, DB, StorageService gemockt) |

---

## Ziel

`GenerationService.generate()` Validation und `buildReplicateInput()` um die vier neuen Edit-Modi (`inpaint`, `erase`, `instruction`, `outpaint`) erweitern. `GenerateImagesInput` in der Server Action um die Felder `maskUrl`, `outpaintDirections`, `outpaintSize` erweitern und an den Service durchreichen.

---

## Acceptance Criteria

1) GIVEN `generationMode` ist `"inpaint"`
   WHEN `GenerationService.generate()` aufgerufen wird mit gueltigem `sourceImageUrl` und `maskUrl`
   THEN wird KEIN Validation-Error geworfen (Modus wird akzeptiert)

2) GIVEN `generationMode` ist `"erase"`
   WHEN `GenerationService.generate()` aufgerufen wird mit gueltigem `sourceImageUrl` und `maskUrl`
   THEN wird KEIN Validation-Error geworfen (Modus wird akzeptiert)

3) GIVEN `generationMode` ist `"instruction"`
   WHEN `GenerationService.generate()` aufgerufen wird mit gueltigem `sourceImageUrl` und Prompt
   THEN wird KEIN Validation-Error geworfen (Modus wird akzeptiert)

4) GIVEN `generationMode` ist `"outpaint"`
   WHEN `GenerationService.generate()` aufgerufen wird mit gueltigem `sourceImageUrl`, `outpaintDirections: ["top"]` und `outpaintSize: 50`
   THEN wird KEIN Validation-Error geworfen (Modus wird akzeptiert)

5) GIVEN `generationMode` ist `"inpaint"` und `maskUrl` fehlt
   WHEN `GenerationService.generate()` aufgerufen wird
   THEN wird Error `"Maske ist erforderlich fuer Inpaint/Erase"` geworfen

6) GIVEN `generationMode` ist `"erase"` und `maskUrl` fehlt
   WHEN `GenerationService.generate()` aufgerufen wird
   THEN wird Error `"Maske ist erforderlich fuer Inpaint/Erase"` geworfen

7) GIVEN `generationMode` ist `"outpaint"` und `outpaintDirections` ist leer
   WHEN `GenerationService.generate()` aufgerufen wird
   THEN wird Error `"Mindestens eine Richtung erforderlich"` geworfen

8) GIVEN `generationMode` ist `"outpaint"` und `outpaintSize` ist `99`
   WHEN `GenerationService.generate()` aufgerufen wird
   THEN wird Error `"Ungueltiger Erweiterungswert"` geworfen

9) GIVEN eine Generation mit `generationMode: "inpaint"`, `sourceImageUrl` und `maskUrl`
   WHEN `buildReplicateInput()` das Input-Objekt baut
   THEN enthaelt das Result die Keys `image` (= sourceImageUrl), `mask` (= maskUrl), `prompt`

10) GIVEN eine Generation mit `generationMode: "erase"`, `sourceImageUrl` und `maskUrl`
    WHEN `buildReplicateInput()` das Input-Objekt baut
    THEN enthaelt das Result die Keys `image` (= sourceImageUrl), `mask` (= maskUrl) und KEINEN Key `prompt`

11) GIVEN eine Generation mit `generationMode: "instruction"`, `sourceImageUrl` und Prompt
    WHEN `buildReplicateInput()` das Input-Objekt baut
    THEN enthaelt das Result die Keys `image_url` (= sourceImageUrl), `prompt` und KEINEN Key `mask`

12) GIVEN eine Generation mit `generationMode: "outpaint"`, `sourceImageUrl`, `maskUrl` und Prompt
    WHEN `buildReplicateInput()` das Input-Objekt baut
    THEN enthaelt das Result die Keys `image` (= sourceImageUrl), `mask` (= maskUrl), `prompt`

13) GIVEN `generationMode` ist `"invalidmode"`
    WHEN `GenerationService.generate()` aufgerufen wird
    THEN wird Error `"Ungueltiger Generierungsmodus"` geworfen

14) GIVEN die Server Action `generateImages` wird mit `maskUrl: "https://r2.example.com/mask.png"` aufgerufen
    WHEN `generationMode` ist `"inpaint"`
    THEN wird `maskUrl` an `GenerationService.generate()` durchgereicht

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/services/__tests__/generation-service-edit.test.ts`

<test_spec>
```typescript
// --- Validation Tests ---

// AC-1: inpaint accepted
it.todo('should accept generationMode "inpaint" with sourceImageUrl and maskUrl')

// AC-2: erase accepted
it.todo('should accept generationMode "erase" with sourceImageUrl and maskUrl')

// AC-3: instruction accepted
it.todo('should accept generationMode "instruction" with sourceImageUrl and prompt')

// AC-4: outpaint accepted
it.todo('should accept generationMode "outpaint" with sourceImageUrl, outpaintDirections, and outpaintSize')

// AC-5: inpaint without mask rejects
it.todo('should throw "Maske ist erforderlich fuer Inpaint/Erase" when inpaint without maskUrl')

// AC-6: erase without mask rejects
it.todo('should throw "Maske ist erforderlich fuer Inpaint/Erase" when erase without maskUrl')

// AC-7: outpaint without directions rejects
it.todo('should throw "Mindestens eine Richtung erforderlich" when outpaint without outpaintDirections')

// AC-8: outpaint with invalid size rejects
it.todo('should throw "Ungueltiger Erweiterungswert" when outpaintSize is 99')

// AC-13: unknown mode rejects
it.todo('should throw "Ungueltiger Generierungsmodus" for unknown generationMode')

// --- buildReplicateInput Tests ---

// AC-9: inpaint input shape
it.todo('should build inpaint input with image, mask, and prompt keys')

// AC-10: erase input shape
it.todo('should build erase input with image and mask keys, without prompt')

// AC-11: instruction input shape
it.todo('should build instruction input with image_url and prompt keys, without mask')

// AC-12: outpaint input shape
it.todo('should build outpaint input with image, mask, and prompt keys')
```
</test_spec>

### Test-Datei: `app/actions/__tests__/generations-edit.test.ts`

<test_spec>
```typescript
// AC-14: maskUrl passthrough
it.todo('should pass maskUrl through to GenerationService.generate for inpaint mode')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-types-model-slots` | `GenerationMode` | Type | Import aus `lib/types.ts`, 7er-Union inkl. `"erase"`, `"instruction"` |
| `slice-01-types-model-slots` | `VALID_GENERATION_MODES` | Const Array | Import fuer Validation in `generate()` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `GenerationService.generate()` (extended) | Function | slice-07 (Canvas Chat Panel), slice-08 (Erase Flow) | `generate(..., maskUrl?: string, outpaintDirections?: string[], outpaintSize?: number)` |
| `GenerateImagesInput` (extended) | Interface | slice-07 (Canvas Chat Panel), slice-08 (Erase Flow) | `+ maskUrl?: string, outpaintDirections?: string[], outpaintSize?: number` |
| `buildReplicateInput()` (extended) | Function (internal) | Intern — aufgerufen von `processGeneration()` | Neue Branches fuer `inpaint`, `erase`, `instruction`, `outpaint` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/generation-service.ts` — Validation fuer alle 7 Modi, `buildReplicateInput()` Branches fuer `inpaint`/`erase`/`instruction`/`outpaint`
- [ ] `app/actions/generations.ts` — `GenerateImagesInput` um `maskUrl`, `outpaintDirections`, `outpaintSize` erweitern; Validation + Durchreichen an Service
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE neuen Dateien (nur bestehende erweitern)
- KEINE Outpaint-Canvas-Extension mit sharp (das ist Aufgabe des Callers / spaeterer Slice)
- KEINE Aenderung an `processGeneration()` oder `streamToPngBuffer()` — nur `buildReplicateInput()` und `generate()` Validation
- KEINE UI-Aenderungen, KEIN Canvas Agent, KEIN SSE
- KEINE Aenderung an `lib/types.ts` (bereits in Slice 01 erledigt)

**Technische Constraints:**
- Validation in `generate()`: `VALID_GENERATION_MODES` aus `lib/types.ts` importieren und statt Hardcoded-Array verwenden
- `maskUrl` in `modelParams` (JSONB) fuer Generation-Record persistieren (fuer Retry/Audit, siehe architecture.md → Validation Rules)
- `sourceImageUrl` ist Pflicht fuer alle Edit-Modi (`inpaint`, `erase`, `instruction`, `outpaint`)
- `buildReplicateInput()` Feld-Mapping gemaess architecture.md → Integrations: `image`+`mask`+`prompt` fuer inpaint, `image`+`mask` fuer erase, `image_url`+`prompt` fuer instruction
- `outpaintDirections` muss Subset von `["top","bottom","left","right"]` sein
- `outpaintSize` muss einer von `[25, 50, 100]` sein
- Erase-Modus: Prompt wird NICHT an Replicate gesendet (Bria Eraser braucht keinen Prompt)
- `generate()` Signatur erweitern um `maskUrl`, `outpaintDirections`, `outpaintSize` Parameter

**Reuse (PFLICHT):**

| Existing File | Usage in this Slice |
|---|---|
| `lib/services/generation-service.ts` | MODIFY — `generate()` Validation erweitern, `buildReplicateInput()` 4 neue Branches |
| `app/actions/generations.ts` | MODIFY — `GenerateImagesInput` Interface + Validation + Durchreichen |
| `lib/types.ts` | IMPORT — `VALID_GENERATION_MODES` fuer Validation (NICHT modifizieren) |

**Referenzen:**
- Architecture: `architecture.md` → Section "Server Logic / Validation Rules" (Zeile 203-212)
- Architecture: `architecture.md` → Section "Server Logic / Services & Processing" (Zeile 144-151)
- Architecture: `architecture.md` → Section "Integrations" (Zeile 365-379) fuer Replicate Input-Felder
- Architecture: `architecture.md` → Section "Migration Map" (Zeile 333-334) fuer Datei-Aenderungen
