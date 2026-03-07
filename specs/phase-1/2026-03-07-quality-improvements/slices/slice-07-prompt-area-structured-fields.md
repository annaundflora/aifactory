# Slice 07: Prompt Area UI -- Structured Fields

> **Slice 07 von 21** fuer `quality-improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-07-prompt-area-structured-fields` |
| **Test** | `pnpm test components/workspace/__tests__/prompt-area.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-06-generation-service-structured-prompt"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/__tests__/prompt-area.test.tsx` |
| **Integration Command** | `--` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `--` |
| **Mocking Strategy** | `mock_external` (Server Actions, workspace-state Context mocken) |

---

## Ziel

Die bestehende `prompt-area.tsx` von einer einzigen Textarea auf drei getrennte, gelabelte Sections umbauen (Motiv mit Pflicht-Markierung, Stil/Modifier, Negative Prompt). Der Workspace-State-Context wird um `promptMotiv` und `promptStyle` erweitert, damit die Variation-Funktion die strukturierten Felder korrekt wiederherstellt. Der Generate-Button wird disabled wenn das Motiv-Feld leer ist.

---

## Acceptance Criteria

1. GIVEN die Prompt Area wird gerendert
   WHEN der User die Komponente sieht
   THEN sind 3 getrennte Textarea-Sections sichtbar: "Motiv *" (mit Pflicht-Markierung), "Style / Modifier", und ein Abschnitt fuer Negative Prompt

2. GIVEN das Motiv-Feld ist leer (nur Whitespace oder komplett leer)
   WHEN der User den Generate-Button betrachtet
   THEN ist der Generate-Button `disabled`

3. GIVEN das Motiv-Feld enthaelt `"A red fox"` und Style enthaelt `"watercolor"`
   WHEN der User "Generate" klickt
   THEN wird `generateImages` mit `promptMotiv: "A red fox"` und `promptStyle: "watercolor"` aufgerufen (nicht mehr mit `prompt`)

4. GIVEN das Negative-Prompt-Feld
   WHEN das aktuell gewaehlte Modell `negative_prompt` NICHT im Schema hat (z.B. `hasNegativePrompt === false`)
   THEN wird die Negative-Prompt-Section nicht gerendert

5. GIVEN das Negative-Prompt-Feld
   WHEN das aktuell gewaehlte Modell `negative_prompt` im Schema hat
   THEN wird die Negative-Prompt-Section sichtbar gerendert

6. GIVEN eine Textarea (Motiv, Style oder Negative Prompt)
   WHEN der User mehrzeiligen Text eingibt
   THEN waechst die Textarea-Hoehe automatisch mit dem Inhalt (Auto-Resize)

7. GIVEN die `WorkspaceVariationState` in `lib/workspace-state.tsx`
   WHEN das Interface inspiziert wird
   THEN enthaelt es `promptMotiv: string` und `promptStyle?: string` statt des bisherigen `prompt: string`

8. GIVEN ein Variation-Event mit `{ promptMotiv: "Eagle", promptStyle: "digital art", negativePrompt: "blurry", modelId, modelParams }`
   WHEN die Prompt Area das Variation-Event konsumiert
   THEN werden alle drei Felder korrekt befuellt: Motiv = "Eagle", Style = "digital art", Negative = "blurry"

9. GIVEN der User hat Text im Motiv-Feld
   WHEN der User Cmd/Ctrl+Enter drueckt
   THEN wird die Generate-Funktion ausgeloest (Keyboard-Shortcut bleibt funktional)

10. GIVEN der Builder-Drawer wird geschlossen mit einem komponierten Prompt
    WHEN der Builder `onClose(composedPrompt)` aufruft
    THEN wird der komponierte Text ins Style/Modifier-Feld geschrieben (nicht ins Motiv-Feld)

11. GIVEN `components/lightbox/lightbox-modal.tsx` ruft `setVariation({ prompt: generation.prompt, ... })` auf
    WHEN das `WorkspaceVariationState` Interface auf `promptMotiv` + `promptStyle` umgestellt wird
    THEN wird der Consumer in `lightbox-modal.tsx` aktualisiert: `setVariation({ promptMotiv: generation.prompt, ... })`, sodass kein TypeScript-Fehler entsteht

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/workspace/__tests__/prompt-area-structured.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Prompt Area -- Structured Fields', () => {
  // AC-1: Drei getrennte Sections
  it.todo('should render three labeled textarea sections: Motiv (required), Style/Modifier, and Negative Prompt')

  // AC-2: Generate disabled bei leerem Motiv
  it.todo('should disable generate button when motiv field is empty or whitespace-only')

  // AC-3: Generate sendet promptMotiv + promptStyle
  it.todo('should call generateImages with promptMotiv and promptStyle instead of single prompt')

  // AC-4: Negative Prompt hidden wenn Modell es nicht unterstuetzt
  it.todo('should not render negative prompt section when model schema has no negative_prompt')

  // AC-5: Negative Prompt sichtbar wenn Modell es unterstuetzt
  it.todo('should render negative prompt section when model schema includes negative_prompt')

  // AC-6: Auto-Resize der Textareas
  it.todo('should auto-resize textarea height when content grows')

  // AC-7: WorkspaceVariationState enthaelt promptMotiv + promptStyle
  it.todo('should use promptMotiv and promptStyle in WorkspaceVariationState interface')

  // AC-8: Variation-Event befuellt alle drei Felder
  it.todo('should populate motiv, style, and negative prompt fields from variation event')

  // AC-9: Cmd/Ctrl+Enter Keyboard-Shortcut
  it.todo('should trigger generation on Cmd/Ctrl+Enter keypress in motiv field')

  // AC-10: Builder-Output ins Style-Feld
  it.todo('should write builder composed prompt to style/modifier field on drawer close')

  // AC-11: Lightbox-Modal Consumer-Migration
  it.todo('should update lightbox-modal setVariation call to use promptMotiv instead of prompt')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-06-generation-service-structured-prompt` | `generateImages(input)` | Server Action | Akzeptiert `promptMotiv` + `promptStyle` statt `prompt` |
| `slice-06-generation-service-structured-prompt` | `GenerateImagesInput` | Type | Enthaelt `promptMotiv: string`, `promptStyle?: string` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `WorkspaceVariationState` | Interface | Lightbox (Variation-Button), andere Workspace-Komponenten | `{ promptMotiv: string; promptStyle?: string; negativePrompt?: string; modelId: string; modelParams: Record<string, unknown> }` |
| Structured Prompt Fields UI | Component | Builder Pro (Slice 03), History (Slice 05), Templates (Slice 06) | Motiv-, Style-, NegativePrompt-Felder als Targets fuer externe Befuellung |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/prompt-area.tsx` -- Rewrite: 3 gelabelte Sections (Motiv *, Style/Modifier, Negative Prompt) mit Auto-Resize Textareas. Generate-Button disabled bei leerem Motiv. Builder-Output geht ins Style-Feld. Generate sendet `promptMotiv` + `promptStyle`.
- [ ] `lib/workspace-state.tsx` -- State-Erweiterung: `WorkspaceVariationState` Interface aendern: `prompt` durch `promptMotiv` + `promptStyle` ersetzen. Provider und Hook entsprechend anpassen.
- [ ] `components/lightbox/lightbox-modal.tsx` -- Consumer-Migration: `setVariation({ prompt: ... })` auf `setVariation({ promptMotiv: ... })` umstellen, damit keine TypeScript-Fehler entstehen.
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Tab-Leiste (Prompt/History/Favoriten) -- gehoert zu spaeteren Slices
- KEINE Template-Selector-Integration -- gehoert zu Slice Templates
- KEIN Improve-Modal-Umbau -- gehoert zu Slice Improve
- KEINE Aenderungen an `generation-service.ts` oder `app/actions/generations.ts` (gehoert zu Slice 06)
- KEINE neuen Komponenten-Dateien -- alles in bestehenden Dateien

**Technische Constraints:**
- Auto-Resize: `el.style.height = "auto"; el.style.height = el.scrollHeight + "px"` Pattern beibehalten
- Motiv-Feld: `data-testid="prompt-motiv-textarea"`, Style-Feld: `data-testid="prompt-style-textarea"`, Negative: `data-testid="negative-prompt-textarea"`
- Generate-Button Disable-Logik: `disabled={isGenerating || !promptMotiv.trim()}`
- Builder `onClose(composedPrompt)` schreibt in Style-State statt Prompt-State
- Negative Prompt Conditional Rendering: weiterhin basierend auf `hasNegativePrompt` aus Schema

**Referenzen:**
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` -- Section "Data Flow: Structured Prompt -> Generation" (Zeilen 269-290)
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` -- Section "Prompt Composition Logic" (Zeilen 186-198)
- Wireframes: `specs/phase-1/2026-03-07-quality-improvements/wireframes.md` -- Section "Workspace (Sidebar Expanded)" Annotationen 4-6 (Zeilen 136-150, 166-176)
- Discovery: `specs/phase-1/2026-03-07-quality-improvements/discovery.md` -- Section "UI Components & States" (Zeilen 218-220)
