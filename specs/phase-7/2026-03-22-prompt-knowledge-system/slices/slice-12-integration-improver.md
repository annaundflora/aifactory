# Slice 12: Integration-Test Improver End-to-End

> **Slice 12 von 13** fuer `Model-Aware Prompt Knowledge System`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-12-integration-improver` |
| **Test** | `pnpm test lib/services/__tests__/prompt-service.integration.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-05-improver-passthrough", "slice-11-knowledge-content"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/services/__tests__/prompt-service.integration.test.ts` |
| **Integration Command** | `pnpm test lib/services/__tests__/prompt-service.integration.test.ts` |
| **Acceptance Command** | `pnpm exec tsc --noEmit` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | -- |
| **Mocking Strategy** | `mock_external` (OpenRouter-Client mocken, Knowledge-Lookup NICHT mocken -- reale JSON-Datei verwenden) |

---

## Ziel

Die vollstaendige Improver-Kette End-to-End validieren: `PromptService.improve()` mit realem Knowledge-Lookup (nicht gemockt) aufrufen und pruefen, dass der System-Prompt modell- UND modus-spezifisches Wissen aus `data/prompt-knowledge.json` enthaelt. Sicherstellen, dass Fallback-Logik fuer unbekannte Modelle korrekt greift.

---

## Acceptance Criteria

1) GIVEN ein Flux-Modell `"black-forest-labs/flux-2-pro"` und `generationMode = "img2img"`
   WHEN `PromptService.improve("a cat on a rooftop", "black-forest-labs/flux-2-pro", "img2img")` aufgerufen wird (OpenRouter-Client gemockt, Knowledge-Lookup real)
   THEN enthaelt der an den OpenRouter-Client uebergebene System-Prompt mindestens einen Tipp aus `models["flux-2"].tips`
   AND enthaelt mindestens einen Tipp aus `models["flux-2"].modes.img2img.tips`

2) GIVEN ein Flux-Modell `"black-forest-labs/flux-2-pro"` und `generationMode = "txt2img"`
   WHEN `PromptService.improve("a cat on a rooftop", "black-forest-labs/flux-2-pro", "txt2img")` aufgerufen wird
   THEN enthaelt der System-Prompt mindestens einen Tipp aus `models["flux-2"].tips`
   AND enthaelt mindestens einen Tipp aus `models["flux-2"].modes.txt2img.tips`
   AND enthaelt KEINEN Tipp aus `models["flux-2"].modes.img2img.tips`

3) GIVEN ein unbekanntes Modell `"unknown-vendor/mystery-model-v9"`
   WHEN `PromptService.improve("a landscape", "unknown-vendor/mystery-model-v9", "txt2img")` aufgerufen wird
   THEN enthaelt der System-Prompt mindestens einen Tipp aus `fallback.tips`
   AND enthaelt KEINEN Tipp aus irgendeinem spezifischen Modell-Eintrag (kein Flux, kein Seedream, etc.)

4) GIVEN ein Flux-Modell und ein beliebiger generationMode
   WHEN `PromptService.improve` aufgerufen wird
   THEN enthaelt der System-Prompt weiterhin die Sections "Analysis Phase", "Improvement Strategy" und "Rules" (bestehende Prompt-Struktur bleibt erhalten)
   AND enthaelt KEINEN der alten statischen Hints (z.B. "FLUX models: Detailed scene descriptions" kommt NICHT vor)

5) GIVEN ein Seedream-Modell `"google/seedream-5"` und `generationMode = "img2img"`
   WHEN `PromptService.improve("product photo", "google/seedream-5", "img2img")` aufgerufen wird
   THEN enthaelt der System-Prompt mindestens einen Tipp aus `models["seedream"].tips`
   AND enthaelt mindestens einen Tipp aus `models["seedream"].modes.img2img.tips`

6) GIVEN ein Flux-Modell `"black-forest-labs/flux-2-pro"` und KEIN expliziter `generationMode`
   WHEN `PromptService.improve("a sunset", "black-forest-labs/flux-2-pro")` aufgerufen wird (nur 2 Argumente)
   THEN enthaelt der System-Prompt die Flux-Modell-Tipps
   AND enthaelt die txt2img-Modus-Tipps (Default-Verhalten aus Slice 04)

---

## Test Skeletons

> **Hinweis:** Dieses Slice erstellt eine NEUE Test-Datei. Das Deliverable IST die Test-Datei -- der Test-Writer-Agent uebernimmt die Implementierung basierend auf diesen Skeletons.

### Test-Datei: `lib/services/__tests__/prompt-service.integration.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('PromptService.improve -- Integration mit realem Knowledge-Lookup', () => {
  // AC-1: Flux-Modell + img2img -> Modell-Tipps UND img2img-Tipps im System-Prompt
  it.todo('should include flux-2 model tips AND img2img mode tips for flux-2-pro with img2img')

  // AC-2: Flux-Modell + txt2img -> Modell-Tipps UND txt2img-Tipps, KEINE img2img-Tipps
  it.todo('should include flux-2 model tips AND txt2img mode tips but NOT img2img tips for flux-2-pro with txt2img')

  // AC-3: Unbekanntes Modell -> Fallback-Tipps, keine modellspezifischen Tipps
  it.todo('should include fallback tips and no model-specific tips for unknown model')

  // AC-4: Bestehende Prompt-Struktur erhalten, keine alten statischen Hints
  it.todo('should preserve Analysis Phase, Improvement Strategy and Rules sections and exclude old static hints')

  // AC-5: Seedream-Modell + img2img -> Seedream-Tipps UND img2img-Tipps
  it.todo('should include seedream model tips AND img2img mode tips for seedream-5 with img2img')

  // AC-6: Ohne expliziten generationMode -> Default txt2img-Tipps
  it.todo('should default to txt2img mode tips when generationMode is omitted')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-04-improver-injection | `PromptService.improve` | Function (erweitert) | `(prompt, modelId, generationMode?) => Promise<ImproveResult>` -- mit Knowledge-Injection |
| slice-05-improver-passthrough | `improvePrompt` Action | Server Action (erweitert) | Reicht `generationMode` an `PromptService.improve` durch |
| slice-02-ts-lookup | `getPromptKnowledge` | Function | Realer Lookup gegen `data/prompt-knowledge.json` (nicht gemockt) |
| slice-11-knowledge-content | `data/prompt-knowledge.json` | Data File (vollstaendig) | 9 Modell-Prefixe mit Tipps + Modes + Fallback |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Integration-Test-Suite | Test | -- (kein Consumer, Qualitaets-Gate) | Validiert die gesamte Improver-Kette E2E |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/__tests__/prompt-service.integration.test.ts` -- NEW: Integration-Test der Improver-Kette mit realem Knowledge-Lookup (OpenRouter gemockt)
<!-- DELIVERABLES_END -->

> **Hinweis:** Dieses Slice erstellt ausschliesslich eine Test-Datei. Das ist beabsichtigt -- der Zweck dieses Slices ist die End-to-End-Validierung der Improver-Kette.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderung an produktiven Dateien (kein `prompt-service.ts`, kein `prompt-knowledge.ts`, kein `prompts.ts`)
- KEINE Aenderung an der Knowledge-JSON-Datei
- KEINE UI-Aenderungen
- KEIN Test der Python-Seite (ist Slice 13)
- Nur die TS-Improver-Kette wird getestet

**Technische Constraints:**
- OpenRouter-Client (`lib/clients/openrouter`) MUSS gemockt werden (kein externer API-Call)
- Knowledge-Lookup NICHT mocken -- die Integration mit der realen `data/prompt-knowledge.json` ist der Kern dieses Tests
- System-Prompt aus den Mock-Call-Arguments extrahieren (Vorlage: bestehender `prompt-service.test.ts` Mock-Pattern)
- Konkrete Tipp-Strings aus der realen `data/prompt-knowledge.json` in den Assertions verwenden (Datei zur Testzeit laden und Werte vergleichen)
- Bestehende Unit-Tests in `prompt-service.test.ts` NICHT veraendern -- diese neue Datei ist ein separater Integration-Test

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` -- Section "Business Logic Flow > Improver" (Zeilen 103-109)
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` -- Section "Error Handling Strategy" (Zeilen 204-209)
- Bestehender Test-Pattern: `lib/services/__tests__/prompt-service.test.ts` -- Mock-Setup und System-Prompt-Extraktion als Vorlage

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/services/__tests__/prompt-service.test.ts` | Referenz fuer Mock-Pattern (OpenRouter-Mock, System-Prompt-Extraktion) -- NICHT modifizieren |
| `lib/services/prompt-service.ts` | Import von `PromptService` -- unveraendert |
| `lib/services/prompt-knowledge.ts` | Wird indirekt durch `prompt-service.ts` aufgerufen -- unveraendert, NICHT mocken |
| `data/prompt-knowledge.json` | Wird zur Laufzeit geladen -- reale Datei, NICHT mocken |
