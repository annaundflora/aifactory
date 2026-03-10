# Slice 13: StrengthSlider Component

> **Slice 13 von N** für `Multi-Mode Generation (img2img + Upscale)`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-13-strength-slider-component` |
| **Test** | `pnpm test components/workspace/__tests__/strength-slider.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/__tests__/strength-slider.test.tsx` |
| **Integration Command** | `pnpm test components/workspace/__tests__/` |
| **Acceptance Command** | — |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` (rein presentationale Komponente, keine externen Abhängigkeiten) |

---

## Ziel

Neue rein presentationale Komponente `StrengthSlider` — ein Slider (0.0–1.0) mit drei klickbaren Preset-Buttons (Subtle=0.3, Balanced=0.6, Creative=0.85) und Anzeige des aktuellen Wertes. Die Komponente ist vollständig von aussen kontrolliert (`value` + `onChange`) und enthält keine eigene State-Logik. Der Default-Wert 0.6 wird vom Parent gesetzt, nicht intern.

---

## Acceptance Criteria

1) GIVEN `StrengthSlider` mit `value={0.6}` gerendert wird
   WHEN die Komponente im DOM erscheint
   THEN sind alle drei Preset-Buttons sichtbar mit den Labels "Subtle", "Balanced" und "Creative"; der angezeigte numerische Wert ist "0.60" (zwei Dezimalstellen); der Slider-Input zeigt Wert 0.6

2) GIVEN `StrengthSlider` mit `value={0.6}` gerendert wird
   WHEN die Komponente im DOM erscheint
   THEN ist exakt der Button "Balanced" visuell aktiv markiert (z.B. via `aria-pressed="true"` oder aktive CSS-Klasse); "Subtle" und "Creative" sind nicht aktiv markiert

3) GIVEN `StrengthSlider` mit `value={0.3}` gerendert wird
   WHEN die Komponente im DOM erscheint
   THEN ist exakt der Button "Subtle" aktiv markiert; "Balanced" und "Creative" sind nicht aktiv markiert; der angezeigte Wert ist "0.30"

4) GIVEN `StrengthSlider` mit `value={0.85}` gerendert wird
   WHEN die Komponente im DOM erscheint
   THEN ist exakt der Button "Creative" aktiv markiert; "Subtle" und "Balanced" sind nicht aktiv markiert; der angezeigte Wert ist "0.85"

5) GIVEN `StrengthSlider` mit `value={0.5}` gerendert wird (kein Preset-Match)
   WHEN die Komponente im DOM erscheint
   THEN ist kein Preset-Button aktiv markiert; der angezeigte Wert ist "0.50"

6) GIVEN `StrengthSlider` mit einem `onChange`-Spy gerendert wird
   WHEN der Nutzer auf den Button "Balanced" klickt
   THEN wird `onChange` einmal mit dem Argument `0.6` (number) aufgerufen

7) GIVEN `StrengthSlider` mit einem `onChange`-Spy gerendert wird
   WHEN der Nutzer auf den Button "Subtle" klickt
   THEN wird `onChange` einmal mit dem Argument `0.3` (number) aufgerufen

8) GIVEN `StrengthSlider` mit einem `onChange`-Spy gerendert wird
   WHEN der Nutzer auf den Button "Creative" klickt
   THEN wird `onChange` einmal mit dem Argument `0.85` (number) aufgerufen

9) GIVEN `StrengthSlider` mit `value={0.6}` und einem `onChange`-Spy gerendert wird
   WHEN der Slider-Input auf den Wert `0.4` geändert wird (change-Event mit value="0.4")
   THEN wird `onChange` einmal mit dem Argument `0.4` (number) aufgerufen

10) GIVEN `StrengthSlider` mit `value={0.6}` gerendert wird
    WHEN der Slider-Input geändert wird auf einen Wert ausserhalb des Preset-Bereichs (z.B. `0.7`)
    THEN ist kein Preset-Button aktiv markiert; der angezeigte numerische Wert aktualisiert sich auf "0.70"

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Tests nutzen `@testing-library/react render` + `userEvent`. Kein Provider-Wrapper nötig (reine presentationale Komponente). Der Test-Writer implementiert alle Assertions selbstständig.

### Test-Datei: `components/workspace/__tests__/strength-slider.test.tsx`

<test_spec>
```typescript
// AC-1: Alle drei Preset-Buttons sichtbar; Wert 0.60 angezeigt; Slider zeigt 0.6
it.todo('should render all three preset buttons and display value 0.60 when value is 0.6')

// AC-2: Balanced ist aktiv markiert bei value=0.6
it.todo('should mark Balanced preset as active when value is 0.6')

// AC-3: Subtle ist aktiv markiert bei value=0.3; Wert 0.30 angezeigt
it.todo('should mark Subtle preset as active and display 0.30 when value is 0.3')

// AC-4: Creative ist aktiv markiert bei value=0.85; Wert 0.85 angezeigt
it.todo('should mark Creative preset as active and display 0.85 when value is 0.85')

// AC-5: Kein Preset aktiv bei Nicht-Preset-Wert (0.5)
it.todo('should mark no preset as active when value does not match any preset')

// AC-6: Klick auf Balanced ruft onChange mit 0.6 auf
it.todo('should call onChange with 0.6 when Balanced preset button is clicked')

// AC-7: Klick auf Subtle ruft onChange mit 0.3 auf
it.todo('should call onChange with 0.3 when Subtle preset button is clicked')

// AC-8: Klick auf Creative ruft onChange mit 0.85 auf
it.todo('should call onChange with 0.85 when Creative preset button is clicked')

// AC-9: Slider-Änderung auf 0.4 ruft onChange mit 0.4 auf
it.todo('should call onChange with 0.4 when slider input is changed to 0.4')

// AC-10: Slider-Änderung auf Nicht-Preset-Wert deaktiviert alle Preset-Buttons
it.todo('should deactivate all preset buttons when slider is set to a non-preset value')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| — | — | — | Keine Dependencies — eigenständige presentationale Komponente |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `StrengthSlider` | Component | PromptArea img2img-Mode (spätere Slices) | `({ value: number, onChange: (value: number) => void }) => JSX.Element` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/strength-slider.tsx` — Rein presentationaler Slider 0.0–1.0 mit drei Preset-Buttons (Subtle=0.3, Balanced=0.6, Creative=0.85); Wertanzeige (2 Dezimalstellen); Props: `value`, `onChange`
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt `components/workspace/__tests__/strength-slider.test.tsx` basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Keine eigene State-Logik — vollständig controlled component; Default-Wert 0.6 wird vom Parent gesetzt
- Kein Fetch, keine Server Actions, keine Context-Anbindung
- Keine Integration in `PromptArea` — das ist Aufgabe eines späteren Slice
- Kein Tooltip oder Erklärungstext zu modellspezifischem Strength-Verhalten (liegt ausserhalb Scope)

**Technische Constraints:**
- `"use client"` Direktive erforderlich (interaktive Komponente)
- Slider-Range: min=0.0, max=1.0, step=0.01 (nativer `<input type="range">` oder shadcn/ui Slider)
- Preset-Werte sind Konstanten: Subtle=0.3, Balanced=0.6, Creative=0.85
- Aktiver Preset wird per exaktem Wertvergleich bestimmt (kein Fuzzy-Matching)
- Numerische Anzeige immer mit zwei Dezimalstellen (z.B. "0.60", "0.85")
- `onChange` liefert `number` (nicht string), konvertiert aus Slider-Event-Value

**Referenzen:**
- Visuelles Layout: `wireframes.md` → "Screen: Prompt Area — Image to Image" → Annotation ③
- Preset-Werte und Strength-Bereich: `architecture.md` → Section "Validation Rules" → Feld `strength`
- Constraint-Kontext FLUX/Strength: `architecture.md` → Section "Constraints & Integrations" → "FLUX models need higher strength"
