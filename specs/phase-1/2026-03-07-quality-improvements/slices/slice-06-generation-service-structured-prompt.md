# Slice 06: Generation Service -- Structured Prompt

> **Slice 06 von 21** fuer `quality-improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-06-generation-service-structured-prompt` |
| **Test** | `pnpm test lib/services/__tests__/generation-service.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-db-schema-generations"]` |
| **Modifies** | `lib/db/queries.ts`, `lib/services/generation-service.ts`, `app/actions/generations.ts` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/services/__tests__/generation-service.test.ts` |
| **Integration Command** | `--` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `--` |
| **Mocking Strategy** | `mock_external` (Replicate, Storage, DB-Queries mocken) |

---

## Ziel

`GenerationService.generate()` und die `generateImages` Server Action erweitern, sodass sie `promptMotiv` und `promptStyle` als separate Felder akzeptieren, daraus den kompositen Prompt (`"{motiv}. {style}"`) bilden und beide strukturierten Felder in der DB speichern. Bestehende Aufrufe mit einem einzigen `prompt`-Feld bleiben abwaertskompatibel.

---

## Acceptance Criteria

1. GIVEN `promptMotiv = "A red fox in a forest"` und `promptStyle = "watercolor painting with soft edges"`
   WHEN `GenerationService.generate()` aufgerufen wird
   THEN wird `createGeneration` mit `prompt = "A red fox in a forest. watercolor painting with soft edges"`, `promptMotiv = "A red fox in a forest"` und `promptStyle = "watercolor painting with soft edges"` aufgerufen

2. GIVEN `promptMotiv = "A red fox in a forest"` und `promptStyle = ""` (leerer String)
   WHEN `GenerationService.generate()` aufgerufen wird
   THEN wird `createGeneration` mit `prompt = "A red fox in a forest"` aufgerufen (kein Punkt und kein Leerzeichen angehaengt), `promptMotiv = "A red fox in a forest"`, `promptStyle = ""`

3. GIVEN `promptMotiv = "  A red fox  "` und `promptStyle = "  oil painting  "`
   WHEN `GenerationService.generate()` aufgerufen wird
   THEN werden beide Felder getrimmt: `promptMotiv = "A red fox"`, `promptStyle = "oil painting"`, `prompt = "A red fox. oil painting"`

4. GIVEN die `generateImages` Server Action
   WHEN mit `{ projectId, promptMotiv: "Eagle", promptStyle: "digital art", modelId, params, count: 1 }` aufgerufen
   THEN werden `promptMotiv` und `promptStyle` an `GenerationService.generate()` weitergereicht und die Action gibt `Generation[]` zurueck

5. GIVEN die `generateImages` Server Action
   WHEN mit `{ projectId, promptMotiv: "", promptStyle: "digital art", modelId, params, count: 1 }` aufgerufen
   THEN gibt die Action `{ error: "Prompt darf nicht leer sein" }` zurueck (Motiv ist Pflichtfeld)

6. GIVEN die `GenerateImagesInput`-Typdefinition in `app/actions/generations.ts`
   WHEN ein TypeScript-Modul das Interface importiert
   THEN enthaelt es `promptMotiv: string` und `promptStyle?: string` statt des bisherigen `prompt: string`

7. GIVEN die Funktion `createGeneration` in `lib/db/queries.ts`
   WHEN sie mit `{ projectId, prompt, negativePrompt, modelId, modelParams, promptMotiv: "Eagle", promptStyle: "digital art" }` aufgerufen wird
   THEN akzeptiert die Input-Typdefinition die neuen Felder `promptMotiv?: string` und `promptStyle?: string` und uebergibt sie an `db.insert(generations).values()`

8. GIVEN bestehende Tests in `lib/services/__tests__/generation-service.test.ts`
   WHEN die neuen Tests ausgefuehrt werden
   THEN bleiben alle bestehenden Tests gruen (Abwaertskompatibilitaet)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/services/__tests__/generation-service-structured.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Generation Service -- Structured Prompt', () => {
  // AC-1: Komposition von promptMotiv + promptStyle
  it.todo('should compose prompt as "{motiv}. {style}" and pass both fields to createGeneration')

  // AC-2: Leerer promptStyle
  it.todo('should use only motiv as prompt when promptStyle is empty')

  // AC-3: Trimming beider Felder
  it.todo('should trim whitespace from promptMotiv and promptStyle before composition')

  // AC-4: Server Action leitet strukturierte Felder weiter
  it.todo('should pass promptMotiv and promptStyle through generateImages action to service')

  // AC-5: Leeres Motiv in Server Action
  it.todo('should return error when promptMotiv is empty in generateImages action')

  // AC-6: TypeScript Interface
  it.todo('should accept promptMotiv and promptStyle in GenerateImagesInput type')

  // AC-7: createGeneration akzeptiert promptMotiv + promptStyle
  it.todo('should accept promptMotiv and promptStyle in createGeneration input and persist them')

  // AC-8: Bestehende Tests gruen
  it.todo('should not break existing generation service tests')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-db-schema-generations` | `generations.promptMotiv` | Schema Column | Spalte existiert in Schema |
| `slice-01-db-schema-generations` | `generations.promptStyle` | Schema Column | Spalte existiert in Schema |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `GenerationService.generate(projectId, promptMotiv, promptStyle, negativePrompt, modelId, params, count)` | Function | UI-Slices, Action-Layer | Erweiterte Signatur mit strukturierten Prompt-Feldern |
| `generateImages(input)` | Server Action | Workspace-UI | `input.promptMotiv: string`, `input.promptStyle?: string` |
| `createGeneration(input)` | DB Query | Generation Service | Input erweitert um `promptMotiv?: string`, `promptStyle?: string` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/generation-service.ts` -- Erweiterte `generate()`-Signatur: akzeptiert `promptMotiv` + `promptStyle`, komponiert composite prompt, uebergibt strukturierte Felder an `createGeneration`
- [ ] `lib/db/queries.ts` -- `createGeneration` Input-Interface erweitern: `promptMotiv?: string` und `promptStyle?: string` akzeptieren und an `db.insert().values()` uebergeben
- [ ] `app/actions/generations.ts` -- `GenerateImagesInput` Interface und `generateImages` Action: `prompt` durch `promptMotiv` + `promptStyle` ersetzen, Komposition und Validierung anpassen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE UI-Aenderungen (gehoert zu separatem Slice fuer strukturiertes Prompt-Feld)
- KEINE Aenderungen an `lib/db/schema.ts` (gehoert zu Slice 01)
- KEINE Aenderungen an `processGeneration`, `buildReplicateInput` oder `retry` -- diese nutzen weiterhin `generation.prompt` (composite)
- KEIN neues Prompt-Kompositions-Utility-Modul -- Logik bleibt inline im Service

**Technische Constraints:**
- Prompt-Komposition: `"{motiv}. {style}"` wenn style nicht leer, sonst nur `"{motiv}"`
- Trimming auf beiden Feldern vor Komposition
- `promptMotiv` ist Pflichtfeld (nicht leer nach Trim)
- `promptStyle` ist optional (leerer String erlaubt)
- Bestehende `retry()`-Funktion bleibt unveraendert (nutzt bereits gespeicherten composite `prompt`)

**Referenzen:**
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` -- Section "Prompt Composition Logic" (Zeilen 186-198)
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` -- Section "API Design > Existing Actions Modified" (Zeilen 135-138)
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` -- Section "Modified Services" (Zeilen 170-173)
