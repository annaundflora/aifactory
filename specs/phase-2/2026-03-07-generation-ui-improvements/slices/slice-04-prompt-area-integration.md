# Slice 04: PromptArea Layout-Integration

> **Slice 04 von 05** fuer `Generation UI Improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-04-prompt-area-integration` |
| **Test** | `pnpm test components/workspace/prompt-area` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-aspect-ratio-utils", "slice-02-chips-components", "slice-03-variant-stepper"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/prompt-area` |
| **Integration Command** | `pnpm test components/workspace/prompt-area` |
| **Acceptance Command** | `pnpm test components/workspace/prompt-area` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

`prompt-area.tsx` wird auf das neue 10-Zeilen-Layout umgebaut: `AspectRatioChips` und `SizeChips` aus Slice 02 werden als Rows 7 und 8 eingebunden, `ParameterPanel` wandert in eine Collapsible "Advanced Settings" Section (Row 9), und `VariantStepper` aus Slice 03 ersetzt die bisherigen Variant-Count-Buttons neben dem Generate-Button (Row 10). Ein Model-Wechsel loest automatisch einen Chip-Reset auf die erste kompatible Option aus.

---

## Acceptance Criteria

1) GIVEN `PromptArea` ist gerendert
   WHEN die Komponente initial geladen wird
   THEN sind alle 10 Layout-Reihen im DOM vorhanden: Model-Dropdown, Template-Dropdown, Prompt-Motiv-Textarea, Builder-+Improve-Buttons (50/50), Style-Modifier-Textarea, Negative-Prompt-Textarea (conditional), AspectRatioChips, SizeChips, Advanced-Settings-Collapsible, VariantStepper-+Generate-Button-Row

2) GIVEN `PromptArea` ist gerendert
   WHEN die Komponente initial geladen wird
   THEN ist die Advanced-Settings-Collapsible geschlossen (Inhalt nicht im DOM oder `aria-expanded="false"`)

3) GIVEN die Advanced-Settings-Collapsible ist geschlossen
   WHEN der Nutzer auf den "Advanced Settings" Header klickt
   THEN ist die Collapsible geoeffnet (`aria-expanded="true"`) und der `ParameterPanel` ist im DOM sichtbar

4) GIVEN die Advanced-Settings-Collapsible ist geoeffnet
   WHEN der Nutzer erneut auf den "Advanced Settings" Header klickt
   THEN ist die Collapsible wieder geschlossen und der `ParameterPanel` ist nicht mehr sichtbar

5) GIVEN `PromptArea` mit einem Model, das Aspect Ratios `["1:1", "16:9"]` unterstuetzt
   WHEN ein anderes Model gewaehlt wird, das nur `["1:1"]` unterstuetzt und der aktuelle Chip-State `"16:9"` ist
   THEN wird der Aspect-Ratio-Chip automatisch auf `"1:1"` zurueckgesetzt (erster kompatibler Wert)

6) GIVEN `PromptArea` mit einem Model, das Size `"xl"` nicht unterstuetzt
   WHEN ein anderes Model gewaehlt wird, das `"xl"` nicht unterstuetzt und `"xl"` aktuell selektiert ist
   THEN wird der Size-Chip automatisch auf den ersten kompatiblen Size-Wert zurueckgesetzt

7) GIVEN `PromptArea` ist gerendert
   WHEN der Model-Wechsel einen Chip-Reset ausloest
   THEN werden `AspectRatioChips` und `SizeChips` mit den neuen `disabledRatios` / `disabledSizes` des neuen Models neu gerendert

8) GIVEN `VariantStepper` mit `value=2` ist in der letzten Zeile eingebunden
   WHEN der Nutzer auf `[+]` klickt
   THEN wird der interne Variant-Count-State auf `3` aktualisiert und der Stepper zeigt `3` an

9) GIVEN der Generate-Button in Row 10
   WHEN der Button gerendert wird
   THEN nimmt er die verbleibende Breite neben dem `VariantStepper` ein (kein festes Width-Wert, `flex-1` oder aequivalent)

10) GIVEN `PromptArea` und ein Model, dessen Schema `parseRatioConfig` mit `mapping: 'none'` zurueckgibt
    WHEN die Komponente gerendert wird
    THEN sind `AspectRatioChips` und `SizeChips` nicht im DOM (oder nicht sichtbar)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/workspace/prompt-area.test.tsx`

<test_spec>
```typescript
// AC-1: Alle 10 Layout-Reihen im DOM
it.todo('should render all layout rows including AspectRatioChips, SizeChips, Advanced Settings and VariantStepper')

// AC-2: Advanced Settings initial geschlossen
it.todo('should render Advanced Settings collapsible as closed by default')

// AC-3: Klick oeffnet Advanced Settings und zeigt ParameterPanel
it.todo('should open Advanced Settings and show ParameterPanel when header is clicked')

// AC-4: Zweiter Klick schliesst Advanced Settings wieder
it.todo('should close Advanced Settings when header is clicked again')

// AC-5: Model-Wechsel setzt inkompatiblen Ratio-Chip zurueck
it.todo('should reset aspect ratio chip to first compatible value when model changes and current ratio is incompatible')

// AC-6: Model-Wechsel setzt inkompatiblen Size-Chip zurueck
it.todo('should reset size chip to first compatible value when model changes and current size is incompatible')

// AC-7: Chips erhalten neue disabled-Props nach Model-Wechsel
it.todo('should re-render chips with updated disabledRatios and disabledSizes after model change')

// AC-8: VariantStepper aktualisiert Variant-Count-State
it.todo('should update variant count state when VariantStepper onChange is triggered')

// AC-9: Generate-Button fuellt verbleibende Breite neben Stepper
it.todo('should render Generate button with flex-grow filling remaining width beside VariantStepper')

// AC-10: Chips nicht sichtbar wenn Modell ratio mapping none hat
it.todo('should not render AspectRatioChips and SizeChips when model schema has mapping none')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-aspect-ratio-utils` | `parseRatioConfig`, `SIZE_PRESETS`, `RatioConfig` | Functions + Type | Import aus `lib/aspect-ratio.ts` aufloes bar |
| `slice-02-chips-components` | `AspectRatioChips` | Component | `({ ratios, selected, disabledRatios, modelName, onSelect, onCustomRatioChange }) => JSX` |
| `slice-02-chips-components` | `SizeChips` | Component | `({ sizes, selected, disabledSizes, modelName, onSelect }) => JSX` |
| `slice-03-variant-stepper` | `VariantStepper` | Component | `({ value: number; onChange: (value: number) => void }) => JSX.Element` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `PromptArea` (modifiziert) | Component | `slice-05` (WorkspaceContent) | Bestehendes Interface, keine neuen Props — interner State-Umbau |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/prompt-area.tsx` — Umbau auf 10-Reihen-Layout: AspectRatioChips + SizeChips (Rows 7–8), ParameterPanel in radix-ui Collapsible (Row 9), VariantStepper + Generate-Button flexbox (Row 10), Model-Wechsel-Reset-Logik
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Keine Aenderungen an `AspectRatioChips`, `SizeChips` oder `VariantStepper` — nur Einbindung
- Kein Umbau von Gallery, FloatingActionBar oder CompareModal (andere Slices)
- Das externe Props-Interface von `PromptArea` bleibt unveraendert

**Technische Constraints:**
- Collapsible via `radix-ui Collapsible` (bereits in `radix-ui@1.4.3` vorhanden), default `open={false}`
- Model-Wechsel-Reset: `parseRatioConfig(newModelSchema)` aufrufen, aktuelle Chip-Werte pruefen, bei Inkompatibilitaet ersten verfuegbaren Wert setzen
- `VariantStepper` + Generate-Button in einer `flex`-Row — Stepper hat feste Breite, Generate-Button `flex-1`
- Wenn `mapping === 'none'`: `AspectRatioChips` und `SizeChips` nicht rendern (bedingtes Rendering)

**Referenzen:**
- Wireframes: `specs/phase-2/2026-03-07-generation-ui-improvements/wireframes.md` → Screen: Prompt Panel, Wireframe-Annotationen ①–⑫, State Variation `model-switch-reset` + `advanced-expanded` / `advanced-collapsed`
- Architecture: `specs/phase-2/2026-03-07-generation-ui-improvements/architecture.md` → Component Architecture (New Component Tree), Migration Map (Existing Files Modified: `prompt-area.tsx`), Technology Decisions (Collapsible via radix-ui)
- Discovery: `specs/phase-2/2026-03-07-generation-ui-improvements/discovery.md` → Business Rules (Model-Wechsel Reset, Aspect Ratio Mapping, Advanced Settings)
