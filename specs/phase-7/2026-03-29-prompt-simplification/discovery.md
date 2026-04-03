# Feature: Prompt-Felder Vereinfachung

**Epic:** --
**Status:** Ready
**Wireframes:** -- (UI wird einfacher, nicht komplexer)

---

## Problem & Solution

**Problem:**
- Das UI hat 3 Prompt-Felder: Motiv, Style/Modifier, Negative Prompt
- `negative_prompt` wird als separates Feld an die Replicate API gesendet, ohne zu pruefen ob das Model es unterstuetzt
- ~65 von 104 Models (alle modernen: Flux, Imagen, Recraft, Ideogram v3, Seedream, GPT Image, Luma Photon) unterstuetzen `negative_prompt` NICHT
- Das fuehrt zu Replicate API-Errors bei der Bildgenerierung
- Style/Modifier ist zwar technisch sicher (wird in den Prompt-String eingebaut), traegt aber zur UI-Komplexitaet bei
- Der Assistant gibt strukturierte 3-Felder-Prompts zurueck (motiv, style, negative_prompt), was die Komplexitaet verstaerkt

**Solution:**
- Style/Modifier und Negative Prompt UI-Felder entfernen
- Nur noch ein einziges Prompt-Feld (promptMotiv)
- `negative_prompt` nicht mehr an die Replicate API senden
- Assistant auf 1-Feld-Output umbauen
- DB-Spalten `prompt_style` und `negative_prompt` entfernen
- Prompt Knowledge System: negativePrompts-Eintraege bereinigen

**Business Value:**
- Keine API-Errors mehr durch nicht-unterstuetzte Input-Felder
- Einfacheres UI mit weniger Fehlerquellen
- Konsistentes Verhalten ueber alle Models hinweg
- Einfacherer Assistant-Workflow (1 Feld statt 3)

---

## Scope & Boundaries

| In Scope |
|----------|
| UI: Style/Modifier und Negative Prompt Textareas aus prompt-area.tsx entfernen |
| UI: Per-Mode State (Txt2ImgState, Img2ImgState) auf 1 Prompt-Feld vereinfachen |
| Generation-Service: `negative_prompt` nicht mehr an API senden |
| Generation-Service: Style-Concatenation entfernen (promptMotiv = finaler Prompt) |
| Server Action: promptStyle/negativePrompt Parameter aus generateImages entfernen |
| Assistant Backend: prompt_tools.py auf 1-Feld-Output umbauen |
| Assistant Backend: prompts.py System-Prompt anpassen (keine 3-Felder-Anweisung) |
| Assistant Backend: state.py draft_prompt vereinfachen |
| Assistant Frontend: assistant-context.tsx 3-Felder-Mapping auf 1 Feld |
| Assistant Frontend: use-assistant-runtime.ts SSE-Parsing vereinfachen |
| Prompt Knowledge: negativePrompts-Eintraege aus prompt_knowledge.py entfernen |
| DB: Spalten prompt_style und negative_prompt per Migration entfernen |
| DB: Queries anpassen (prompt-history, generation queries) |
| Prompt History Service: Style/Negative aus History-Eintraegen entfernen |
| Tests: Alle betroffenen Tests anpassen |

| Out of Scope |
|--------------|
| Rename promptMotiv -> prompt im gesamten Codebase (zu viel Churn, promptMotiv bleibt) |
| Model-spezifische Input-Validierung (z.B. Schema-Check vor API-Call) — nicht mehr noetig |
| UI-Redesign der Prompt-Area ueber das Entfernen der Felder hinaus |
| Aenderungen am Parameter-Panel (INTERNAL_FIELDS kann negative_prompt behalten als Safety-Net) |

---

## Recherche-Ergebnisse

### DB-Analyse: Model Input Field Support (104 Models)

| Feld | Models MIT Support | Models OHNE Support | Trend |
|------|-------------------|---------------------|-------|
| `negative_prompt` | ~39 (SD-basierte, aeltere) | ~65 (Flux, Imagen, Recraft v3/v4, Ideogram v3, Seedream, GPT Image, Luma) | Neuere Models unterstuetzen es NICHT |
| `style` (API-Feld) | 3 (Recraft v3, Leonardo Lucid) | ~101 | Fast kein Model hat ein echtes Style-Feld |

### Ist-Zustand: Prompt-Verarbeitung

```
UI:        [Motiv] + [Style] + [Negative]
                |         |          |
Service:   motiv.trim()   |    generation.negativePrompt
                |         |          |
Concat:    "{motiv}. {style}"   input.negative_prompt = negativePrompt
                |                    |
API:       input.prompt         input.negative_prompt  <-- ERROR bei ~65% der Models!
```

### Soll-Zustand: Prompt-Verarbeitung

```
UI:        [Prompt]
                |
Service:   promptMotiv.trim()
                |
API:       input.prompt    (kein negative_prompt mehr)
```

### Fehler-Quelle (Ist-Zustand)

`generation-service.ts:278-280`:
```typescript
if (generation.negativePrompt) {
  input.negative_prompt = generation.negativePrompt;  // ERROR wenn Model es nicht kennt
}
```

Replicate validiert Input gegen das OpenAPI-Schema des Models und lehnt unbekannte Felder ab.

---

## Betroffene Dateien

### Frontend — UI (Prompt Area)

| Datei | Aenderung |
|-------|-----------|
| `components/workspace/prompt-area.tsx` | Style + Negative Textareas entfernen, Collapsible-Sections entfernen, State vereinfachen (promptStyle/negativePrompt raus aus Txt2ImgState, Img2ImgState) |

### Frontend — Assistant Integration

| Datei | Aenderung |
|-------|-----------|
| `lib/assistant/assistant-context.tsx` | DraftPrompt-Interface auf 1 Feld, Mapping-Logik vereinfachen, applyVariation auf 1 Feld |
| `lib/assistant/use-assistant-runtime.ts` | SSE-Parsing: `{ motiv, style, negative_prompt }` -> `{ prompt }` |

### Backend — Generation Pipeline

| Datei | Aenderung |
|-------|-----------|
| `lib/services/generation-service.ts` | `negative_prompt` nicht senden, Style-Concat entfernen, prompt = promptMotiv |
| `app/actions/generations.ts` | promptStyle/negativePrompt Parameter entfernen |

### Backend — Assistant (Python)

| Datei | Aenderung |
|-------|-----------|
| `backend/app/agent/prompt_tools.py` | compose_prompt/refine_prompt: nur noch `{ prompt }` zurueckgeben |
| `backend/app/agent/prompts.py` | System-Prompt: 3-Felder-Anweisung auf 1 Feld |
| `backend/app/agent/state.py` | draft_prompt Docstring/Struktur anpassen |

### Backend — Prompt Knowledge

| Datei | Aenderung |
|-------|-----------|
| `backend/app/agent/prompt_knowledge.py` | negativePrompts-Eintraege aus Model Knowledge entfernen |

### Datenbank

| Datei | Aenderung |
|-------|-----------|
| `lib/db/schema.ts` | Spalten `promptStyle` und `negativePrompt` aus generations entfernen |
| `lib/db/queries.ts` | Queries anpassen: createGeneration, getPromptHistory, getSiblings |
| Drizzle Migration | `ALTER TABLE generations DROP COLUMN prompt_style, DROP COLUMN negative_prompt` |

### Services

| Datei | Aenderung |
|-------|-----------|
| `lib/services/prompt-history-service.ts` | PromptHistoryEntry: promptStyle/negativePrompt entfernen |

### Tests (Anpassungen noetig)

| Datei | Betroffenheit |
|-------|---------------|
| `lib/assistant/__tests__/assistant-context-apply.test.tsx` | 3-Felder-Assertions |
| `lib/assistant/__tests__/assistant-context.test.tsx` | Draft-Prompt Assertions |
| `lib/assistant/__tests__/assistant-context-resume.test.tsx` | Resume mit negative_prompt |
| `lib/assistant/__tests__/assistant-context-persistence.test.tsx` | Persistence mit negative_prompt |
| `lib/assistant/__tests__/use-assistant-runtime.test.ts` | SSE-Parsing Tests |
| `lib/services/__tests__/generation-service.test.ts` | Generation mit style/negative |
| `lib/services/__tests__/prompt-history-service.test.ts` | History Queries |
| `lib/db/__tests__/queries-batch.test.ts` | Batch-Query Tests |
| `lib/db/__tests__/schema-generations.test.ts` | Schema Tests |
| `lib/db/__tests__/schema.test.ts` | Schema Tests |
| `lib/__tests__/workspace-state.test.ts` | Workspace State |
| `app/actions/__tests__/generations.test.ts` | Generation Action Tests |
| `app/actions/__tests__/generations-multi-ref.test.ts` | Multi-Ref Tests |
| `app/actions/__tests__/generations-upscale.test.ts` | Upscale Tests |
| `app/actions/__tests__/prompts-history.test.ts` | Prompt History Tests |
| `app/actions/__tests__/get-siblings.test.ts` | Siblings Tests |
| `backend/tests/unit/test_prompt_tools.py` | Prompt Tools Unit Tests |
| `backend/tests/integration/test_prompt_tools_integration.py` | Prompt Tools Integration |
| `backend/tests/acceptance/test_slice_12_prompt_tools_backend.py` | Prompt Tools Acceptance |

---

## Risiken & Mitigations

| Risiko | Schwere | Mitigation |
|--------|---------|-----------|
| Bestehende Generations verlieren prompt_style/negative_prompt Daten | Niedrig | Akzeptiert — User arbeitet nur mit neueren Models, historische Daten nicht relevant |
| Prompt History DISTINCT aendert sich (bisher: motiv+style+negative+model) | Niedrig | History basiert dann nur auf prompt_motiv + model_id — ist sogar besser |
| Assistant SSE-Contract aendert sich (Breaking Change) | Mittel | Frontend + Backend gleichzeitig deployen |
| Laufende Assistant-Sessions mit altem Draft-Format | Niedrig | Sessions werden neu gestartet, alte Drafts ignoriert |

---

## Slices (Vorschlag)

### Slice 1: UI + Generation Service (Frontend-First)
- prompt-area.tsx: Style + Negative Felder entfernen
- generation-service.ts: negative_prompt nicht senden, Style-Concat entfernen
- app/actions/generations.ts: Parameter bereinigen
- Zugehoerige Tests anpassen

### Slice 2: DB-Migration
- schema.ts: Spalten entfernen
- Migration erstellen und ausfuehren
- queries.ts anpassen
- prompt-history-service.ts anpassen
- Zugehoerige Tests anpassen

### Slice 3: Assistant Vereinfachung
- prompt_tools.py: 1-Feld-Output
- prompts.py: System-Prompt anpassen
- state.py: draft_prompt vereinfachen
- assistant-context.tsx: Mapping auf 1 Feld
- use-assistant-runtime.ts: SSE-Parsing
- prompt_knowledge.py: negativePrompts bereinigen
- Zugehoerige Tests anpassen
