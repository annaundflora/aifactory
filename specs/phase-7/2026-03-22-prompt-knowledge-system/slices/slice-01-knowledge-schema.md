# Slice 1: Knowledge JSON Schema + Fallback-Skeleton

> **Slice 1 von 13** fuer `Model-Aware Prompt Knowledge System`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-01-knowledge-schema` |
| **Test** | `pnpm test lib/types/__tests__/prompt-knowledge.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/types/__tests__/prompt-knowledge.test.ts` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm exec tsc --noEmit` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | -- |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Die Daten-Grundlage fuer das gesamte Knowledge-System schaffen: eine JSON-Datei mit korrektem Schema (Fallback + ein exemplarisches Modell als Vorlage) und die zugehoerigen TypeScript-Interfaces. Alle nachfolgenden Slices (TS-Lookup, Python-Lookup, Content-Befuellung) bauen auf diesem Schema auf.

---

## Acceptance Criteria

1) GIVEN die Datei `data/prompt-knowledge.json` existiert
   WHEN ein JSON-Parser sie laedt
   THEN ist das Ergebnis valides JSON ohne Parse-Fehler

2) GIVEN die JSON-Datei geladen ist
   WHEN der Top-Level-Key `models` gelesen wird
   THEN enthaelt er mindestens einen Eintrag mit dem Key `flux-2`

3) GIVEN der Eintrag `models["flux-2"]` existiert
   WHEN seine Felder geprueft werden
   THEN enthaelt er alle Pflichtfelder gemaess Schema in `architecture.md` Section "Knowledge File Schema":
   `displayName` (string), `promptStyle` ("natural" | "keywords"), `negativePrompts` (Objekt mit `supported: boolean` und `note: string`), `strengths` (string[], 2-4 Eintraege), `tips` (string[], 3-6 Eintraege), `avoid` (string[], 2-4 Eintraege)

4) GIVEN der Eintrag `models["flux-2"]` existiert
   WHEN das optionale Feld `modes` geprueft wird
   THEN enthaelt es die Keys `txt2img` und `img2img`, jeweils mit `tips` (string[], 2-4 Eintraege)

5) GIVEN die JSON-Datei geladen ist
   WHEN der Top-Level-Key `fallback` gelesen wird
   THEN enthaelt er `displayName` (string, Wert "Generic"), `tips` (string[], mindestens 3 Eintraege), `avoid` (string[], mindestens 2 Eintraege)

6) GIVEN die Datei `lib/types/prompt-knowledge.ts` existiert
   WHEN `pnpm exec tsc --noEmit` ausgefuehrt wird
   THEN kompiliert sie fehlerfrei

7) GIVEN die TypeScript-Interfaces exportiert sind
   WHEN die Exports geprueft werden
   THEN existieren mindestens: `PromptKnowledgeFile`, `ModelKnowledge`, `ModeKnowledge`, `FallbackKnowledge`, `NegativePromptInfo`

8) GIVEN das Interface `PromptKnowledgeFile` existiert
   WHEN seine Struktur geprueft wird
   THEN hat es ein Feld `models` (Record mit string-Key und `ModelKnowledge`-Value) und ein Feld `fallback` vom Typ `FallbackKnowledge`

9) GIVEN das Interface `ModelKnowledge` existiert
   WHEN seine Felder geprueft werden
   THEN bildet es die Pflichtfelder aus AC-3 ab und hat ein optionales Feld `modes` (Record mit `txt2img`/`img2img` Keys und `ModeKnowledge` Values)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/types/__tests__/prompt-knowledge.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('prompt-knowledge.json schema validation', () => {
  // AC-1: JSON ist valide
  it.todo('should parse prompt-knowledge.json without errors')

  // AC-2: models enthaelt flux-2
  it.todo('should contain flux-2 entry in models')

  // AC-3: flux-2 hat alle Pflichtfelder
  it.todo('should have all required fields in flux-2 entry')

  // AC-4: flux-2 hat modes mit txt2img und img2img
  it.todo('should have txt2img and img2img modes in flux-2 entry')

  // AC-5: fallback hat displayName Generic, tips und avoid
  it.todo('should have valid fallback section with displayName Generic')
})

describe('prompt-knowledge TypeScript types', () => {
  // AC-7: Alle Interfaces sind exportiert
  it.todo('should export PromptKnowledgeFile interface')

  // AC-7: Alle Interfaces sind exportiert
  it.todo('should export ModelKnowledge interface')

  // AC-7: Alle Interfaces sind exportiert
  it.todo('should export ModeKnowledge interface')

  // AC-7: Alle Interfaces sind exportiert
  it.todo('should export FallbackKnowledge interface')

  // AC-7: Alle Interfaces sind exportiert
  it.todo('should export NegativePromptInfo interface')

  // AC-8: PromptKnowledgeFile hat models + fallback
  it.todo('should type-check a valid PromptKnowledgeFile object')

  // AC-9: ModelKnowledge hat optionales modes-Feld
  it.todo('should allow ModelKnowledge with and without modes')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| -- | -- | -- | Kein Vorgaenger-Slice |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `data/prompt-knowledge.json` | Data File | slice-02 (TS Lookup), slice-03 (Python Lookup), slice-11 (Content) | JSON mit `models` + `fallback` Keys |
| `PromptKnowledgeFile` | TypeScript Interface | slice-02 (TS Lookup) | `import type { PromptKnowledgeFile } from '@/lib/types/prompt-knowledge'` |
| `ModelKnowledge` | TypeScript Interface | slice-02 (TS Lookup), slice-04 (Improver) | `import type { ModelKnowledge } from '@/lib/types/prompt-knowledge'` |
| `ModeKnowledge` | TypeScript Interface | slice-02 (TS Lookup) | `import type { ModeKnowledge } from '@/lib/types/prompt-knowledge'` |
| `FallbackKnowledge` | TypeScript Interface | slice-02 (TS Lookup) | `import type { FallbackKnowledge } from '@/lib/types/prompt-knowledge'` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `data/prompt-knowledge.json` -- Skeleton mit fallback-Objekt + flux-2 als exemplarisches Modell (Schema-Vorlage)
- [ ] `lib/types/prompt-knowledge.ts` -- TypeScript-Interfaces: PromptKnowledgeFile, ModelKnowledge, ModeKnowledge, FallbackKnowledge, NegativePromptInfo
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Lookup-Code (Prefix-Matching ist Slice 02/03)
- KEIN vollstaendiger Knowledge-Inhalt fuer alle 8 Modell-Familien (ist Slice 11)
- NUR flux-2 als exemplarisches Modell + fallback -- das genuegt als Schema-Vorlage
- KEINE Python-Typen (Python nutzt das JSON direkt, TypedDict/Pydantic kommt in Slice 03 falls noetig)

**Technische Constraints:**
- JSON-Schema muss exakt der Struktur in `architecture.md` Section "Knowledge File Schema" entsprechen
- `promptStyle` ist ein Union-Type: `"natural" | "keywords"`
- `modes` Keys muessen mit `GenerationMode` aus `lib/types.ts` kompatibel sein (aber nur `txt2img` und `img2img` sind relevant fuer Knowledge)
- Das `data/`-Verzeichnis existiert noch nicht und muss erstellt werden
- Interfaces MUESSEN als `export interface` (nicht `type`) exportiert werden, damit sie in Tests per `import type` pruefbar sind

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` -- Section "Knowledge File Schema" (Zeilen 329-362)
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` -- Section "Covered Prefixes" (Zeilen 377-390)
- Discovery: `specs/phase-7/2026-03-22-prompt-knowledge-system/discovery.md` -- Section "Data > Knowledge-Datei Struktur" (Zeilen 113-128)
- Existierender Type: `lib/types.ts` Zeile 21 -- `GenerationMode` Definition
