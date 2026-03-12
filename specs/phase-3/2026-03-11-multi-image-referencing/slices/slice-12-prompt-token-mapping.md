# Slice 12: Prompt @-Token Mapping

> **Slice 12 von 17** fuer `Multi-Image Referencing`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-12-prompt-token-mapping` |
| **Test** | `pnpm test lib/services/__tests__/compose-multi-reference-prompt` |
| **E2E** | `false` |
| **Dependencies** | `["slice-09"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6 + React 19 + Vitest) |
| **Test Command** | `pnpm test lib/services/__tests__/compose-multi-reference-prompt` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm test lib/services/__tests__/compose-multi-reference-prompt` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` (reine Funktion, keine externen Abhaengigkeiten) |

---

## Ziel

Eine reine Funktion `composeMultiReferencePrompt()` in `generation-service.ts` bereitstellen, die @N-Tokens im Prompt-Text auf @imageN mappt, Role/Strength-Kontext als Referenz-Guidance anhaengt, und unbenutzte Referenzen als zusaetzliche Hints inkludiert. Diese Funktion wird in Slice 13 von `buildReplicateInput()` aufgerufen.

---

## Acceptance Criteria

1) GIVEN ein Prompt "Extract the building from @3 and render it in the style of @1"
   und Referenzen `[{ slotPosition: 1, role: "style", strength: "strong" }, { slotPosition: 3, role: "content", strength: "moderate" }]`
   WHEN `composeMultiReferencePrompt()` aufgerufen wird
   THEN enthaelt der Ergebnis-String "@image1" statt "@1" und "@image3" statt "@3"

2) GIVEN ein Prompt "A painting in @1 style"
   und Referenzen `[{ slotPosition: 1, role: "style", strength: "strong" }, { slotPosition: 3, role: "content", strength: "moderate" }]`
   WHEN `composeMultiReferencePrompt()` aufgerufen wird
   THEN enthaelt der Ergebnis-String den Abschnitt "Reference guidance:" mit Eintraegen fuer BEIDE Referenzen: @image1 (style/strong) und @image3 (content/moderate)

3) GIVEN ein Prompt "A beautiful landscape" OHNE @-Tokens
   und Referenzen `[{ slotPosition: 2, role: "style", strength: "dominant" }]`
   WHEN `composeMultiReferencePrompt()` aufgerufen wird
   THEN enthaelt der Ergebnis-String die Referenz-Guidance mit @image2 als Kontext-Hint (da im Prompt nicht explizit erwaehnt)

4) GIVEN ein Prompt "Use @1 as base"
   und Referenzen `[{ slotPosition: 1, role: "content", strength: "subtle" }, { slotPosition: 5, role: "color", strength: "dominant" }]`
   WHEN `composeMultiReferencePrompt()` aufgerufen wird
   THEN listet die Referenz-Guidance @image1 UND @image5 auf -- @image5 ist als unbenutzte Referenz trotzdem enthalten

5) GIVEN ein Prompt "Hello world"
   und ein leeres Referenzen-Array `[]`
   WHEN `composeMultiReferencePrompt()` aufgerufen wird
   THEN wird der Prompt unveraendert zurueckgegeben (kein "Reference guidance:" Abschnitt angehaengt)

6) GIVEN ein Prompt "Use @7 for reference"
   und Referenzen `[{ slotPosition: 1, role: "style", strength: "moderate" }]`
   WHEN `composeMultiReferencePrompt()` aufgerufen wird
   THEN wird @7 NICHT gemappt (nur @-Tokens mit gueltigem slotPosition 1-5, die einer tatsaechlichen Referenz entsprechen, werden ersetzt), @7 bleibt als "@7" im Text

7) GIVEN ein Prompt mit promptMotiv "Draw @1" und promptStyle "oil painting"
   und Referenzen `[{ slotPosition: 1, role: "style", strength: "strong" }]`
   WHEN `composeMultiReferencePrompt()` mit dem bereits komponierten Prompt "Draw @1. oil painting" aufgerufen wird
   THEN wird "@1" im komponierten Prompt korrekt zu "@image1" gemappt

8) GIVEN Referenzen mit allen 5 Rollen und allen 4 Strength-Stufen
   WHEN `composeMultiReferencePrompt()` aufgerufen wird
   THEN enthaelt die Referenz-Guidance den korrekten englischen Text fuer jede Kombination (z.B. "provides style reference with subtle influence", "provides character reference with dominant influence")

9) GIVEN ein Prompt "@1 @1 @1" (gleicher Token mehrfach)
   und Referenzen `[{ slotPosition: 1, role: "content", strength: "moderate" }]`
   WHEN `composeMultiReferencePrompt()` aufgerufen wird
   THEN werden ALLE Vorkommen von "@1" durch "@image1" ersetzt

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.

### Test-Datei: `lib/services/__tests__/compose-multi-reference-prompt.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('composeMultiReferencePrompt', () => {
  describe('@-Token Replacement', () => {
    // AC-1: @N wird durch @imageN ersetzt
    it.todo('should replace @1 with @image1 and @3 with @image3 in prompt text')

    // AC-9: Mehrfach-Vorkommen desselben Tokens
    it.todo('should replace all occurrences of the same @-token')

    // AC-6: Ungueltiger Token @7 wird nicht ersetzt
    it.todo('should not replace @-tokens that do not match any reference slotPosition')

    // AC-7: Mapping funktioniert im komponierten Prompt (motiv + style)
    it.todo('should correctly map @-tokens in a combined motiv+style prompt string')
  })

  describe('Reference Guidance', () => {
    // AC-2: Guidance enthaelt alle Referenzen mit Role und Strength
    it.todo('should append reference guidance section with role and strength for all references')

    // AC-3: Unbenutzte Referenzen werden als Kontext-Hints inkludiert
    it.todo('should include unreferenced images in the guidance section')

    // AC-4: Explizit erwaehnte und nicht erwaehnte Referenzen in Guidance
    it.todo('should include both mentioned and unmentioned references in guidance')

    // AC-8: Alle Rollen- und Strength-Kombinationen korrekt
    it.todo('should produce correct English text for all role and strength combinations')
  })

  describe('Edge Cases', () => {
    // AC-5: Leeres Referenzen-Array
    it.todo('should return prompt unchanged when references array is empty')
  })
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-07-reference-slot | `ReferenceRole`, `ReferenceStrength` | TypeScript Types | Import aus `@/lib/types/reference` |
| slice-09-prompt-area-integration | `referenceSlots` State-Struktur | Daten-Shape | slotPosition, role, strength Felder vorhanden |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `composeMultiReferencePrompt` | Pure Function | slice-13 (Generation Integration) | `(prompt: string, references: { slotPosition: number, role: ReferenceRole, strength: ReferenceStrength }[]) => string` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/generation-service.ts` -- `composeMultiReferencePrompt()` Funktion exportieren (reine String-Transformation, keine DB/API-Calls)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Aufruf von `composeMultiReferencePrompt` in `buildReplicateInput()` -- das ist Slice 13
- KEIN visuelles Highlighting von @-Tokens im Textarea -- das ist V2 (spaetere Phase)
- KEINE Aenderung der bestehenden `generate()` oder `buildReplicateInput()` Funktionen
- KEINE DB-Queries oder API-Calls -- reine Funktion

**Technische Constraints:**
- Regex `/@(\d+)/g` fuer Token-Erkennung, dabei NUR Tokens ersetzen die einer tatsaechlichen Referenz-slotPosition entsprechen
- Guidance-Text in Englisch (FLUX.2 API erwartet englische Prompts)
- Funktion als benannter Export aus `generation-service.ts` (nicht als Methode auf `GenerationService` Objekt, da reine Hilfsfunktion)
- Guidance-Format entspricht dem Muster aus architecture.md --> Section "Prompt Composition: composeMultiReferencePrompt()"

**Referenzen:**
- Architecture: `architecture.md` --> Section "Prompt Composition: composeMultiReferencePrompt()" (Step 1-3 Algorithmus)
- Architecture: `architecture.md` --> Section "Input Validation & Sanitization" (@-Token Regex)
- Discovery: `discovery.md` --> Section "Business Rules" (Prompt-Mapping, Strength als Prompt-Hint)
