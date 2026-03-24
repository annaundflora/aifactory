# Slice 2: TS Lookup-Funktion (Prefix-Matching)

> **Slice 2 von 13** fuer `Model-Aware Prompt Knowledge System`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-02-ts-lookup` |
| **Test** | `pnpm test lib/services/__tests__/prompt-knowledge.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-knowledge-schema"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/services/__tests__/prompt-knowledge.test.ts` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm exec tsc --noEmit` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | -- |
| **Mocking Strategy** | `mock_external` (JSON-Datei wird per mock bereitgestellt) |

---

## Ziel

Einen reinen, seiteneffektfreien Lookup-Service in TypeScript implementieren, der die Knowledge-JSON-Datei mit module-level Cache laedt, per laengstem Prefix-Match das passende Modell-Wissen findet, nach Generierungs-Modus filtert und bei unbekannten Modellen den Fallback zurueckgibt. Dieser Service ist die Grundlage fuer alle TS-seitigen Knowledge-Konsumenten (Improver, UI).

---

## Acceptance Criteria

1) GIVEN `prompt-knowledge.json` enthaelt Prefixe `flux-2-pro` und `flux-2`
   WHEN `getPromptKnowledge("flux-2-pro-ultra")` aufgerufen wird
   THEN wird der Eintrag fuer Prefix `flux-2-pro` zurueckgegeben (laengster Match gewinnt, nicht `flux-2`)

2) GIVEN `prompt-knowledge.json` enthaelt Prefix `flux-2`
   WHEN `getPromptKnowledge("flux-2-max")` aufgerufen wird
   THEN wird der Eintrag fuer Prefix `flux-2` zurueckgegeben (einfacher Prefix-Match)

3) GIVEN `prompt-knowledge.json` enthaelt keinen passenden Prefix fuer "unknown-model-xyz"
   WHEN `getPromptKnowledge("unknown-model-xyz")` aufgerufen wird
   THEN wird das `fallback`-Objekt zurueckgegeben (mit `displayName: "Generic"`)

4) GIVEN ein Modell-Eintrag hat `modes.txt2img` mit Tipps
   WHEN `getPromptKnowledge("flux-2-pro", "txt2img")` aufgerufen wird
   THEN enthaelt das Ergebnis sowohl die allgemeinen Modell-Tipps als auch die modus-spezifischen `txt2img`-Tipps

5) GIVEN ein Modell-Eintrag hat KEINE `modes.img2img`-Sektion
   WHEN `getPromptKnowledge("some-model", "img2img")` aufgerufen wird
   THEN enthaelt das Ergebnis nur die allgemeinen Modell-Tipps (kein Fehler, kein Crash)

6) GIVEN `getPromptKnowledge` wird ohne Modus aufgerufen (`mode` ist `undefined`)
   WHEN das Ergebnis geprueft wird
   THEN enthaelt es nur die allgemeinen Modell-Tipps (keine Modus-Sektion)

7) GIVEN eine Model-ID im Format `owner/model-name` (z.B. `black-forest-labs/flux-2-pro`)
   WHEN `getPromptKnowledge("black-forest-labs/flux-2-pro")` aufgerufen wird
   THEN wird der Teil vor dem `/` gestrippt und das Prefix-Matching erfolgt gegen `flux-2-pro`

8) GIVEN eine Model-ID ohne Slash (z.B. `flux-2-pro`)
   WHEN `getPromptKnowledge("flux-2-pro")` aufgerufen wird
   THEN funktioniert das Matching identisch wie mit Slash (kein Crash bei fehlendem Slash)

9) GIVEN ein gueltiges Lookup-Ergebnis (Modell oder Fallback)
   WHEN `formatKnowledgeForPrompt(result)` aufgerufen wird
   THEN wird ein nicht-leerer String zurueckgegeben, der fuer System-Prompt-Injection geeignet ist

10) GIVEN ein Lookup-Ergebnis mit Modell-Tipps UND Modus-Tipps
    WHEN `formatKnowledgeForPrompt(result)` aufgerufen wird
    THEN enthaelt der String sowohl die allgemeinen Tipps als auch die Modus-Tipps in lesbarem Format

11) GIVEN die JSON-Datei wurde bereits einmal geladen
    WHEN `getPromptKnowledge` ein zweites Mal aufgerufen wird
    THEN wird die Datei NICHT erneut vom Dateisystem gelesen (module-level Cache)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/services/__tests__/prompt-knowledge.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('getPromptKnowledge', () => {
  // AC-1: Laengster Prefix gewinnt
  it.todo('should match longest prefix when multiple prefixes match')

  // AC-2: Einfacher Prefix-Match
  it.todo('should match simple prefix for model ID')

  // AC-3: Fallback bei unbekanntem Modell
  it.todo('should return fallback for unknown model ID')

  // AC-4: Modus-spezifische Tipps bei txt2img
  it.todo('should include txt2img mode tips when mode is txt2img')

  // AC-5: Graceful bei fehlendem Modus-Eintrag
  it.todo('should return model tips only when requested mode section is missing')

  // AC-6: Kein Modus -> nur allgemeine Tipps
  it.todo('should return model tips only when mode is undefined')

  // AC-7: Slash-Stripping bei owner/model-name
  it.todo('should strip owner prefix before slash from model ID')

  // AC-8: Model-ID ohne Slash funktioniert
  it.todo('should handle model ID without slash')

  // AC-11: Module-level Cache
  it.todo('should not reload JSON file on subsequent calls')
})

describe('formatKnowledgeForPrompt', () => {
  // AC-9: Nicht-leerer String fuer System-Prompt
  it.todo('should return non-empty string for valid lookup result')

  // AC-10: Modell-Tipps und Modus-Tipps im formatierten String
  it.todo('should include both model tips and mode tips in formatted output')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-01-knowledge-schema | `data/prompt-knowledge.json` | Data File | JSON ist parsebar, enthaelt `models` + `fallback` Keys |
| slice-01-knowledge-schema | `PromptKnowledgeFile`, `ModelKnowledge`, `ModeKnowledge`, `FallbackKnowledge` | TypeScript Interfaces | `import type` kompiliert fehlerfrei |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `getPromptKnowledge` | Function | slice-04 (Improver Service) | `(modelId: string, mode?: GenerationMode) => PromptKnowledgeLookupResult` |
| `formatKnowledgeForPrompt` | Function | slice-04 (Improver Service) | `(result: PromptKnowledgeLookupResult) => string` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/prompt-knowledge.ts` -- Lookup-Service mit `getPromptKnowledge` (Prefix-Matching, Modus-Filter, Fallback, Slash-Stripping) und `formatKnowledgeForPrompt` (Ergebnis als System-Prompt-String formatieren). Module-level JSON-Cache.
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Aendern der Knowledge-JSON-Datei (Inhalt ist Slice 01 + Slice 11)
- KEINE Python-Implementierung (ist Slice 03)
- KEINE Integration in den Improver/prompt-service.ts (ist Slice 04)
- KEIN neuer API-Endpunkt
- KEIN Aendern bestehender Dateien ausser der neuen Service-Datei

**Technische Constraints:**
- Reine Funktion ohne Side-Effects (ausser dem einmaligen Datei-Read beim ersten Aufruf)
- Module-level Cache: JSON wird einmal geladen und danach aus dem Speicher bedient
- Prefixe muessen nach Laenge absteigend sortiert verglichen werden (laengster Match zuerst)
- Slash-Stripping: `owner/model-name` -> `model-name` (Teil nach dem letzten `/`)
- Return-Type muss die Interfaces aus Slice 01 verwenden (`ModelKnowledge`, `ModeKnowledge`, `FallbackKnowledge`)
- `GenerationMode` Type aus `lib/types.ts` importieren (nicht neu definieren)

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` -- Section "Prefix Matching Algorithm" (Zeilen 366-375)
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` -- Section "Server Logic > Knowledge Lookup (TS)" (Zeile 92)
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` -- Section "Error Handling Strategy" (Zeilen 205-209)
- Discovery: `specs/phase-7/2026-03-22-prompt-knowledge-system/discovery.md` -- Section "Business Rules" (Zeilen 100-107)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/types/prompt-knowledge.ts` | Import der Interfaces `PromptKnowledgeFile`, `ModelKnowledge`, `ModeKnowledge`, `FallbackKnowledge` aus Slice 01 |
| `lib/types.ts` | Import von `GenerationMode` -- NICHT neu definieren |
| `data/prompt-knowledge.json` | Einlesen per `fs.readFileSync` oder `import` -- NICHT modifizieren |
