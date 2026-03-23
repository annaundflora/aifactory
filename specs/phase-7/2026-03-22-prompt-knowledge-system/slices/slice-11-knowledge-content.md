# Slice 11: Knowledge-Inhalt fuer alle 9 Modell-Prefixe befuellen

> **Slice 11 von 13** fuer `Model-Aware Prompt Knowledge System`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-11-knowledge-content` |
| **Test** | `pnpm test data/__tests__/prompt-knowledge-content.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-knowledge-schema"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test data/__tests__/prompt-knowledge-content.test.ts` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm exec tsc --noEmit` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | -- |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Die in Slice 01 erstellte Skeleton-Datei `data/prompt-knowledge.json` mit vollstaendigem, kuratiertem Prompting-Wissen fuer alle 9 Modell-Prefixe befuellen. Der Implementer extrahiert das Wissen aus zwei Quellen und haelt das Token-Budget (~200 Tokens pro Modell-Sektion) ein.

---

## Acceptance Criteria

1) GIVEN die Datei `data/prompt-knowledge.json` geladen wird
   WHEN die Keys in `models` gezaehlt werden
   THEN existieren exakt 9 Eintraege: `flux-2`, `flux-schnell`, `nano-banana`, `gpt-image`, `seedream`, `stable-diffusion`, `recraft`, `ideogram`, `hunyuan`

2) GIVEN ein beliebiger Modell-Eintrag in `models` (z.B. `models["recraft"]`)
   WHEN seine Pflichtfelder geprueft werden
   THEN enthaelt er: `displayName` (non-empty string), `promptStyle` ("natural" oder "keywords"), `negativePrompts` (Objekt mit `supported: boolean` und `note: non-empty string`), `strengths` (string[], 2-4 Eintraege), `tips` (string[], 3-6 Eintraege), `avoid` (string[], 2-4 Eintraege)

3) GIVEN der Eintrag `models["flux-2"]`
   WHEN das Feld `modes` geprueft wird
   THEN enthaelt es `txt2img` mit `tips` (string[], 2-4 Eintraege) UND `img2img` mit `tips` (string[], 2-4 Eintraege)

4) GIVEN der Eintrag `models["seedream"]`
   WHEN das Feld `modes` geprueft wird
   THEN enthaelt es `txt2img` mit `tips` (string[], 2-4 Eintraege) UND `img2img` mit `tips` (string[], 2-4 Eintraege)

5) GIVEN der Eintrag `models["nano-banana"]`
   WHEN das Feld `modes` geprueft wird
   THEN enthaelt es `txt2img` mit `tips` (string[], 2-4 Eintraege) UND `img2img` mit `tips` (string[], 2-4 Eintraege)

6) GIVEN ein beliebiger Modell-Eintrag in `models`
   WHEN der Token-Count der Sektion geschaetzt wird (alle Strings konkateniert, Whitespace-tokenisiert)
   THEN liegt der Wert unter 250 Tokens

7) GIVEN die gesamte `data/prompt-knowledge.json` Datei
   WHEN ein JSON-Parser sie laedt
   THEN ist das Ergebnis valides JSON ohne Parse-Fehler

8) GIVEN der bestehende `fallback`-Eintrag aus Slice 01
   WHEN er nach dem Befuellen der Modelle geprueft wird
   THEN ist er unveraendert (Slice 01 Inhalt beibehalten)

9) GIVEN die Eintraege `flux-2` und `flux-schnell`
   WHEN ihre `promptStyle`-Werte verglichen werden
   THEN haben beide den Wert `"natural"` (Flux-Familie nutzt natuerliche Sprache)

10) GIVEN der Eintrag `models["stable-diffusion"]`
    WHEN sein `negativePrompts.supported`-Wert geprueft wird
    THEN ist er `true` (SD unterstuetzt Negative Prompts nativ)

11) GIVEN der Eintrag `models["flux-2"]`
    WHEN sein `negativePrompts.supported`-Wert geprueft wird
    THEN ist er `false` (Flux hat keinen separaten Negative-Prompt-Parameter)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `data/__tests__/prompt-knowledge-content.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('prompt-knowledge.json content completeness', () => {
  // AC-1: Alle 9 Prefixe vorhanden
  it.todo('should contain exactly 9 model prefixes')

  // AC-2: Jeder Eintrag hat alle Pflichtfelder
  it.todo('should have all required fields for every model entry')

  // AC-7: JSON ist valide
  it.todo('should be valid JSON')

  // AC-8: Fallback unveraendert
  it.todo('should preserve the fallback section from slice-01')
})

describe('prompt-knowledge.json mode coverage', () => {
  // AC-3: flux-2 hat txt2img + img2img modes
  it.todo('should have txt2img and img2img modes for flux-2')

  // AC-4: seedream hat txt2img + img2img modes
  it.todo('should have txt2img and img2img modes for seedream')

  // AC-5: nano-banana hat txt2img + img2img modes
  it.todo('should have txt2img and img2img modes for nano-banana')
})

describe('prompt-knowledge.json token budget', () => {
  // AC-6: Jede Modell-Sektion < 250 Tokens
  it.todo('should keep each model section under 250 tokens')
})

describe('prompt-knowledge.json factual correctness', () => {
  // AC-9: Flux-Familie nutzt natural prompt style
  it.todo('should set promptStyle to natural for flux-2 and flux-schnell')

  // AC-10: SD unterstuetzt negative prompts
  it.todo('should set negativePrompts.supported to true for stable-diffusion')

  // AC-11: Flux hat keine nativen negative prompts
  it.todo('should set negativePrompts.supported to false for flux-2')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-01-knowledge-schema | `data/prompt-knowledge.json` | Data File (Skeleton) | Datei existiert mit `models` + `fallback` Keys, `flux-2` als Vorlage |
| slice-01-knowledge-schema | `ModelKnowledge`, `ModeKnowledge` | TypeScript Interfaces | Typen definieren die Struktur die jeder Modell-Eintrag einhalten muss |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `data/prompt-knowledge.json` (vollstaendig) | Data File | slice-02 (TS Lookup), slice-03 (Python Lookup), slice-12 (Integration-Test), slice-13 (Integration-Test) | 9 Modell-Eintraege + Fallback, konform zu `ModelKnowledge` Schema |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `data/prompt-knowledge.json` -- EXTEND: Alle 9 Modell-Prefixe mit kuratiertem Inhalt befuellen (flux-2, flux-schnell, nano-banana, gpt-image, seedream, stable-diffusion, recraft, ideogram, hunyuan)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Schema-Aenderung — das Schema steht in Slice 01 fest
- KEIN Lookup-Code — Prefix-Matching ist Slice 02/03
- KEIN neues TypeScript — nur die JSON-Datei wird erweitert
- Fallback-Sektion NICHT aendern — Slice 01 Inhalt beibehalten
- Der existierende `flux-2` Skeleton-Eintrag aus Slice 01 wird UEBERSCHRIEBEN mit vollstaendigem Inhalt

**Wissensquellen (PFLICHT-Lektuere fuer den Implementer):**

| Quelle | Pfad | Abdeckung |
|--------|------|-----------|
| Best-Practices Leitfaden | `specs/best-practices-prompting.md` | Flux 2, GPT Image, SD 3.5, Ideogram, Recraft, Hunyuan, allgemeine Techniken |
| Discovery Web-Recherche | `specs/phase-7/2026-03-22-prompt-knowledge-system/discovery.md` Section "Web-Recherche: Seedream" | Seedream 4.5/5: Prompt-Stil, Negative Prompts, Staerken, Tipps |
| Discovery Web-Recherche | `specs/phase-7/2026-03-22-prompt-knowledge-system/discovery.md` Section "Web-Recherche: Nano Banana 2" | Nano Banana 2: Prompt-Stil, Negative Prompts, Staerken, img2img |

**Technische Constraints:**
- Token-Budget: ~200 Tokens pro Modell-Sektion, MAXIMAL 250 Tokens (alle Strings konkateniert)
- Jeder String-Eintrag in `tips`, `strengths`, `avoid` soll praegnant sein (1 Satz, keine Absaetze)
- `promptStyle` ist entweder `"natural"` oder `"keywords"` — basierend auf der Modell-Dokumentation
- `negativePrompts.note` MUSS einen konkreten Workaround nennen wenn `supported: false`
- Alle Inhalte in Englisch (werden in englische System-Prompts injiziert)
- Mindestens 3 Modelle MUESSEN `modes` haben: flux-2, seedream, nano-banana (aus slim-slices.md Done-Signal)

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` -- Section "Knowledge File Schema" (Struktur)
- Architecture: `specs/phase-7/2026-03-22-prompt-knowledge-system/architecture.md` -- Section "Covered Prefixes" (Prefix-Liste + Wissensquellen-Zuordnung)
- Discovery: `specs/phase-7/2026-03-22-prompt-knowledge-system/discovery.md` -- Section "Abgedeckte Modelle" (Prefix-Tabelle)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `data/prompt-knowledge.json` | EXTEND: Skeleton aus Slice 01, neue Modell-Eintraege hinzufuegen, flux-2 Inhalt vervollstaendigen |
