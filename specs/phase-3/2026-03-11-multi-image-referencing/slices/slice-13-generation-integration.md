# Slice 13: Generation Integration

> **Slice 13 von 17** fuer `Multi-Image Referencing`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-13-generation-integration` |
| **Test** | `pnpm test lib/services/__tests__/generation-multi-ref app/actions/__tests__/generations-multi-ref` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-reference-queries", "slice-09-prompt-area-integration", "slice-12-prompt-token-mapping"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6 + Drizzle ORM 0.45 + Vitest) |
| **Test Command** | `pnpm test lib/services/__tests__/generation-multi-ref` |
| **Integration Command** | `pnpm test app/actions/__tests__/generations-multi-ref` |
| **Acceptance Command** | `pnpm test lib/services/__tests__/generation-multi-ref app/actions/__tests__/generations-multi-ref` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (Replicate API + DB mocken, `composeMultiReferencePrompt` als echte Funktion) |

---

## Ziel

Die bestehende `generateImages` Server Action und `buildReplicateInput()` Funktion um Multi-Reference-Support erweitern, sodass mehrere Referenz-Bilder als `input_images`-Array an die Replicate API gesendet werden und die zugehoerigen `generation_references`-Records nach erfolgreicher Generation in der DB erstellt werden. Total-Megapixel-Validierung (max 9 MP) verhindert API-Fehler bei zu grossen Inputs.

---

## Acceptance Criteria

1) GIVEN `generateImages` wird mit `references: [{ referenceImageId: "ref-1", role: "style", strength: "strong", slotPosition: 1, imageUrl: "https://r2.example/a.png", width: 1920, height: 1080 }]` aufgerufen
   WHEN die Generation erfolgreich ist
   THEN existiert ein `generation_references`-Record mit `generationId` der neuen Generation, `referenceImageId: "ref-1"`, `role: "style"`, `strength: "strong"`, `slotPosition: 1`

2) GIVEN `generateImages` wird mit 3 References (slotPosition 1, 3, 5) aufgerufen
   WHEN `buildReplicateInput()` den Replicate-Input baut
   THEN enthaelt `input[img2imgField]` ein Array mit 3 URLs, sortiert nach `slotPosition` aufsteigend

3) GIVEN `generateImages` wird mit References aufgerufen und die Referenz-Bilder haben eine Gesamt-Aufloesung von 10 MP (z.B. 3x 2000x1667)
   WHEN die Megapixel-Validierung prueft
   THEN wird `{ error: "Gesamte Bildgroesse ueberschreitet API-Limit (max 9 MP)" }` zurueckgegeben und KEIN Replicate API-Call ausgefuehrt

4) GIVEN `generateImages` wird mit References aufgerufen und die Gesamt-Aufloesung ist 8.5 MP
   WHEN die Megapixel-Validierung prueft
   THEN wird die Generation normal ausgefuehrt (kein Fehler)

5) GIVEN `generateImages` wird OHNE `references` aufgerufen (undefined oder leeres Array) und die Generation hat `sourceImageUrl` gesetzt
   WHEN `buildReplicateInput()` den Input baut
   THEN wird der bestehende Fallback-Pfad genutzt: `input[img2imgField]` enthaelt `sourceImageUrl` (als Array oder String je nach `isArray`-Flag)

6) GIVEN `generateImages` wird mit References aufgerufen und promptMotiv "Extract @3 in style of @1", promptStyle "oil painting"
   WHEN der Prompt komponiert wird
   THEN wird `composeMultiReferencePrompt()` mit dem komponierten Prompt und den References aufgerufen und das Ergebnis als `prompt` an Replicate gesendet

7) GIVEN `generateImages` wird mit 2 References aufgerufen und die Generation ist erfolgreich
   WHEN die generation_references-Records erstellt werden
   THEN werden genau 2 Records via `createGenerationReferences()` Batch-Insert erstellt (ein Call, kein Loop)

8) GIVEN `generateImages` wird mit `references: []` (leeres Array) aufgerufen
   WHEN die Generation ausgefuehrt wird
   THEN wird `composeMultiReferencePrompt` NICHT aufgerufen, keine `generation_references`-Records erstellt, und die Generation laeuft wie bisher (Rueckwaertskompatibilitaet)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.

### Test-Datei: `lib/services/__tests__/generation-multi-ref.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('buildReplicateInput - Multi-Reference', () => {
  // AC-2: Array von Reference-URLs sortiert nach slotPosition
  it.todo('should build input_images array with URLs sorted by slotPosition ascending')

  // AC-5: Fallback auf sourceImageUrl wenn keine References
  it.todo('should fall back to sourceImageUrl when no references exist')

  // AC-6: composeMultiReferencePrompt wird mit References aufgerufen
  it.todo('should call composeMultiReferencePrompt and use result as prompt when references exist')

  // AC-8: Kein composeMultiReferencePrompt bei leerem References-Array
  it.todo('should not call composeMultiReferencePrompt when references array is empty')
})

describe('validateTotalMegapixels', () => {
  // AC-3: Ablehnung bei > 9 MP
  it.todo('should return error when total megapixels exceed 9 MP')

  // AC-4: Durchlassen bei <= 9 MP
  it.todo('should pass validation when total megapixels are within 9 MP limit')
})
```
</test_spec>

### Test-Datei: `app/actions/__tests__/generations-multi-ref.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('generateImages - Multi-Reference Integration', () => {
  // AC-1: generation_references Record nach erfolgreicher Generation
  it.todo('should create generation_references record after successful generation')

  // AC-7: Batch-Insert fuer mehrere References
  it.todo('should batch-insert all generation_references in a single call')

  // AC-8: Keine generation_references bei leerem References-Array
  it.todo('should not create generation_references when references array is empty')

  // AC-3: Megapixel-Validierung vor API-Call
  it.todo('should return error and skip API call when total megapixels exceed 9 MP')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-02-reference-queries | `createGenerationReferences` | Async Function | `(refs: { generationId, referenceImageId, role, strength, slotPosition }[]) => Promise<GenerationReference[]>` |
| slice-02-reference-queries | `getGenerationReferences` | Async Function | `(generationId: string) => Promise<GenerationReference[]>` |
| slice-09-prompt-area-integration | `referenceSlots` Daten im Generate-Flow | Daten-Shape | `references` Array wird von PromptArea an `generateImages` uebergeben |
| slice-12-prompt-token-mapping | `composeMultiReferencePrompt` | Pure Function | `(prompt: string, references: { slotPosition, role, strength }[]) => string` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `generateImages` mit References-Support | Server Action | slice-09 (PromptArea) | `generateImages({ ...existing, references?: ReferenceInput[] })` |
| `generation_references` Records in DB | DB-Daten | slice-15 (Provenance), slice-17 (Migration) | Records via `getGenerationReferences(generationId)` abrufbar |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/actions/generations.ts` -- Erweitert: `references?: ReferenceInput[]` Parameter, Megapixel-Validierung, `createGenerationReferences` Batch-Insert nach Generation
- [ ] `lib/services/generation-service.ts` -- Erweitert: `buildReplicateInput()` Multi-Image-Pfad mit Reference-URLs-Array + `composeMultiReferencePrompt`-Aufruf
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Implementierung von `composeMultiReferencePrompt` -- bereits in Slice 12 erledigt
- KEINE Aenderungen an Query-Funktionen -- bereits in Slice 02 vorhanden
- KEINE UI-Aenderungen -- PromptArea reicht References bereits durch (Slice 09)
- KEINE Provenance-Anzeige -- das ist Slice 15
- KEINE Migration bestehender sourceImageUrl-Daten -- das ist Slice 17
- KEIN Download oder Re-Upload von Reference-Bildern -- URLs werden direkt an Replicate gesendet

**Technische Constraints:**
- `buildReplicateInput()` muss den bestehenden Fallback-Pfad fuer `sourceImageUrl` beibehalten (Rueckwaertskompatibilitaet)
- Reference-URLs sortiert nach `slotPosition ASC` an die API senden (Reihenfolge entspricht @image1-@imageN Mapping)
- Megapixel-Berechnung: `sum(width * height)` aller References, Validierung vor API-Call
- `generation_references`-Records erst NACH erfolgreicher Generation erstellen (nicht bei Fehler)
- `ReferenceInput` Type: `{ referenceImageId: string, role: RoleEnum, strength: StrengthEnum, slotPosition: number, imageUrl: string, width?: number, height?: number }`

**Referenzen:**
- Architecture: `architecture.md` --> Section "buildReplicateInput() Extension" (Zeilen 199-219)
- Architecture: `architecture.md` --> Section "Validation Rules" (Total input megapixels <= 9 MP)
- Architecture: `architecture.md` --> Section "Server Actions" (generateImages EXTEND)
