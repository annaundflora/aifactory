# Slice 4: Improver buildSystemPrompt + Knowledge-Injection

> **Slice 4 von 13** fuer `Model-Aware Prompt Knowledge System`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-04-improver-injection` |
| **Test** | `pnpm test lib/services/__tests__/prompt-service.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-ts-lookup"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/services/__tests__/prompt-service.test.ts` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm exec tsc --noEmit` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | -- |
| **Mocking Strategy** | `mock_external` (Knowledge-Lookup und OpenRouter-Client mocken) |

---

## Ziel

Die statischen, einzeiligen Model-Hints in `buildSystemPrompt()` durch dynamisches Knowledge-Lookup ersetzen, sodass der Improver modell- und modus-spezifische Prompting-Tipps aus der zentralen Knowledge-Datei nutzt. Dazu wird `generationMode` als neuer **optionaler** Parameter (Default: `"txt2img"`) in `buildSystemPrompt()` und `improve()` eingefuehrt, damit bestehende Aufrufer ohne Aenderung weiterhin kompilieren.

---

## Acceptance Criteria

1) GIVEN ein bekanntes Modell `"black-forest-labs/flux-2-pro"` und `generationMode = "txt2img"`
   WHEN `buildSystemPrompt("black-forest-labs/flux-2-pro", "Flux 2 Pro", "txt2img")` aufgerufen wird
   THEN enthaelt der zurueckgegebene String die Flux-spezifischen Tipps aus der Knowledge-Datei (NICHT die alten statischen Hints wie "FLUX models: Detailed scene descriptions")
   AND wenn `generationMode` weggelassen wird, wird `"txt2img"` als Default verwendet

2) GIVEN ein bekanntes Modell mit img2img-Modus-Wissen
   WHEN `buildSystemPrompt("black-forest-labs/flux-2-pro", "Flux 2 Pro", "img2img")` aufgerufen wird
   THEN enthaelt der zurueckgegebene String sowohl die allgemeinen Modell-Tipps als auch die img2img-spezifischen Tipps

3) GIVEN ein unbekanntes Modell `"unknown-vendor/mystery-model"`
   WHEN `buildSystemPrompt("unknown-vendor/mystery-model", "Mystery Model", "txt2img")` aufgerufen wird
   THEN enthaelt der zurueckgegebene String die generischen Fallback-Tipps (mit `displayName: "Generic"`)

4) GIVEN der statische Hint-Block (Zeilen 24-31 im aktuellen `prompt-service.ts`)
   WHEN `buildSystemPrompt` mit einem beliebigen Modell aufgerufen wird
   THEN ist KEINER der alten statischen Hint-Strings mehr enthalten (z.B. "FLUX models: Detailed scene descriptions" kommt NICHT vor)

5) GIVEN `buildSystemPrompt` wird mit einem bekannten Modell aufgerufen
   WHEN der zurueckgegebene String geprueft wird
   THEN enthaelt er weiterhin die Sections "Analysis Phase", "Improvement Strategy" und "Rules" (bestehende Prompt-Struktur bleibt erhalten)

6) GIVEN die Funktion `improve(prompt, modelId, generationMode?)` mit optionalem drittem Parameter
   WHEN `improve("a cat", "black-forest-labs/flux-2-pro", "txt2img")` aufgerufen wird
   THEN wird `buildSystemPrompt` intern mit allen drei Parametern (modelId, displayName, generationMode) aufgerufen
   AND wenn `improve("a cat", "black-forest-labs/flux-2-pro")` ohne generationMode aufgerufen wird, wird Default `"txt2img"` verwendet

7) GIVEN die Funktion `improve` mit der neuen Signatur (`generationMode` optional mit Default `"txt2img"`)
   WHEN TypeScript-Kompilierung (`tsc --noEmit`) laeuft
   THEN kompiliert das gesamte Projekt fehlerfrei -- insbesondere bestehende Aufrufer wie `app/actions/prompts.ts:89` die `improve(prompt, modelId)` mit nur 2 Argumenten aufrufen

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/services/__tests__/prompt-service.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('buildSystemPrompt', () => {
  // AC-1: Bekanntes Modell -> Knowledge-Tipps statt statische Hints
  it.todo('should include flux-specific knowledge tips for flux-2-pro model with txt2img')

  // AC-2: img2img-Modus -> allgemeine + modus-spezifische Tipps
  it.todo('should include both model tips and img2img mode tips')

  // AC-3: Unbekanntes Modell -> Fallback-Tipps
  it.todo('should include generic fallback tips for unknown model')

  // AC-4: Keine statischen Hints mehr
  it.todo('should not contain any old static model hint strings')

  // AC-5: Bestehende Prompt-Struktur bleibt erhalten
  it.todo('should still contain Analysis Phase, Improvement Strategy and Rules sections')
})

describe('improve', () => {
  // AC-6: generationMode wird an buildSystemPrompt durchgereicht
  it.todo('should pass generationMode through to buildSystemPrompt')

  // AC-7: Signatur akzeptiert generationMode als optionalen Parameter mit Default txt2img
  it.todo('should compile without errors when called with 2 args (no generationMode)')
  it.todo('should compile without errors when called with 3 args (explicit generationMode)')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-02-ts-lookup | `getPromptKnowledge` | Function | `(modelId: string, mode?: GenerationMode) => PromptKnowledgeLookupResult` |
| slice-02-ts-lookup | `formatKnowledgeForPrompt` | Function | `(result: PromptKnowledgeLookupResult) => string` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `buildSystemPrompt` | Function (erweitert) | slice-05 (Improver Durchreichung) | `(modelId: string, modelDisplayName: string, generationMode?: GenerationMode) => string` -- Default: `"txt2img"` |
| `improve` | Function (erweitert) | slice-05 (Improver Durchreichung) | `(prompt: string, modelId: string, generationMode?: GenerationMode) => Promise<ImproveResult>` -- Default: `"txt2img"` |
| `PromptService.improve` | Export (erweitert) | slice-05 (Action ruft Service auf) | Gleiche Signatur wie `improve` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/prompt-service.ts` -- EXTEND: `buildSystemPrompt` erhaelt `generationMode`, statische Hints durch Knowledge-Lookup ersetzen. `improve` erhaelt `generationMode` und reicht ihn durch.
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderung an der Server Action `app/actions/prompts.ts` (ist Slice 05)
- KEINE Aenderung an UI-Komponenten (ist Slice 05)
- KEINE Aenderung an der Knowledge-JSON-Datei oder den TypeScript-Interfaces (Slice 01/11)
- KEINE Aenderung am Lookup-Service `lib/services/prompt-knowledge.ts` (Slice 02)
- KEIN neuer API-Endpunkt

**Technische Constraints:**
- `GenerationMode` aus `lib/types.ts` importieren (Zeile 21) -- NICHT neu definieren
- `getPromptKnowledge` und `formatKnowledgeForPrompt` aus `lib/services/prompt-knowledge.ts` importieren
- Die bestehende Prompt-Struktur (Analysis Phase, Improvement Strategy, Rules) MUSS erhalten bleiben
- Der statische Hint-Block (aktuelle Zeilen 24-31 "FLUX models: ...", "Recraft V4: ...", etc.) wird vollstaendig entfernt und durch den formatierten Knowledge-String ersetzt
- Die "Model Optimization" Section im System-Prompt bleibt als Ueberschrift, aber der Inhalt wird dynamisch
- `generationMode` ist ein **optionaler** Parameter mit Default `"txt2img"` -- bestehende Aufrufer (`app/actions/prompts.ts:89`, 8 Tests) rufen `improve(prompt, modelId)` mit nur 2 Args auf und MUESSEN ohne Aenderung weiter kompilieren. Slice 05 wird spaeter den expliziten Wert mitliefern.

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` -- Section "Server Logic > buildSystemPrompt" (Zeile 94)
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` -- Section "Migration Map" (Zeilen 217-218)
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` -- Section "Business Logic Flow > Improver" (Zeilen 103-109)
- Existierende Datei: `lib/services/prompt-service.ts` -- aktueller Stand mit statischen Hints

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/services/prompt-service.ts` | MODIFY: bestehende Funktionen `buildSystemPrompt` und `improve` erweitern |
| `lib/services/prompt-knowledge.ts` | Import von `getPromptKnowledge` + `formatKnowledgeForPrompt` -- NICHT modifizieren |
| `lib/utils/model-display-name.ts` | Import bleibt bestehen (`modelIdToDisplayName`) -- unveraendert |
| `lib/clients/openrouter.ts` | Import bleibt bestehen (`openRouterClient`) -- unveraendert |
| `lib/types.ts` | Import von `GenerationMode` -- NICHT neu definieren |
