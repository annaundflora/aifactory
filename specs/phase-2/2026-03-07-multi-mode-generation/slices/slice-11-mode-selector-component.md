# Slice 11: ModeSelector Component

> **Slice 11 von N** für `Multi-Mode Generation (img2img + Upscale)`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-11-mode-selector-component` |
| **Test** | `pnpm test components/workspace/__tests__/mode-selector.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/__tests__/mode-selector.test.tsx` |
| **Integration Command** | `pnpm test components/workspace/__tests__/` |
| **Acceptance Command** | — |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` (rein presentationale Komponente, keine externen Abhängigkeiten) |

---

## Ziel

Neue rein presentationale Komponente `ModeSelector` — ein Segmented Control mit drei fixen Segmenten (`txt2img`, `img2img`, `upscale`). Die Komponente ist vollständig von aussen kontrolliert (`value` + `onChange`) und enthält keine eigene State-Logik. Sie bildet den Einstiegspunkt für die Mode-Auswahl im Prompt-Area-Layout.

---

## Acceptance Criteria

1) GIVEN `ModeSelector` mit `value="txt2img"` gerendert wird
   WHEN die Komponente im DOM erscheint
   THEN sind alle drei Segmente sichtbar mit den Labels "Text to Image", "Image to Image" und "Upscale" — und exakt das Segment mit Wert `"txt2img"` trägt das aktive Styling (Attribut oder Klasse, die den aktiven Zustand signalisiert)

2) GIVEN `ModeSelector` mit `value="img2img"` gerendert wird
   WHEN die Komponente im DOM erscheint
   THEN ist exakt das Segment mit Wert `"img2img"` aktiv markiert — die anderen zwei Segmente sind nicht aktiv

3) GIVEN `ModeSelector` mit `value="upscale"` gerendert wird
   WHEN die Komponente im DOM erscheint
   THEN ist exakt das Segment mit Wert `"upscale"` aktiv markiert — die anderen zwei Segmente sind nicht aktiv

4) GIVEN `ModeSelector` mit `value="txt2img"` und einem `onChange`-Spy gerendert wird
   WHEN der Nutzer auf das Segment "Image to Image" klickt
   THEN wird `onChange` einmal mit dem Argument `"img2img"` aufgerufen

5) GIVEN `ModeSelector` mit `value="txt2img"` und einem `onChange`-Spy gerendert wird
   WHEN der Nutzer auf das Segment "Upscale" klickt
   THEN wird `onChange` einmal mit dem Argument `"upscale"` aufgerufen

6) GIVEN `ModeSelector` mit `value="img2img"` und einem `onChange`-Spy gerendert wird
   WHEN der Nutzer auf das bereits aktive Segment "Image to Image" klickt
   THEN wird `onChange` nicht aufgerufen (oder wird mit `"img2img"` aufgerufen — konsistentes Verhalten ist ausreichend, kein Fehler)

7) GIVEN `ModeSelector` mit `value="txt2img"` gerendert wird
   WHEN das Segment "Image to Image" `disabled` erhält (via `disabledModes={["img2img"]}` Prop)
   THEN ist das Segment nicht anklickbar und `onChange` wird beim Klick nicht aufgerufen

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Tests nutzen `@testing-library/react render` + `userEvent`. Kein Provider-Wrapper nötig (reine presentationale Komponente).

### Test-Datei: `components/workspace/__tests__/mode-selector.test.tsx`

<test_spec>
```typescript
// AC-1: Alle drei Segmente sichtbar; txt2img ist aktiv
it.todo('should render all three segments with txt2img active when value is txt2img')

// AC-2: img2img-Segment ist aktiv
it.todo('should mark img2img segment as active when value is img2img')

// AC-3: Upscale-Segment ist aktiv
it.todo('should mark upscale segment as active when value is upscale')

// AC-4: Klick auf inaktives Segment ruft onChange mit korrektem Modus auf
it.todo('should call onChange with "img2img" when Image to Image segment is clicked')

// AC-5: Klick auf Upscale-Segment ruft onChange mit "upscale" auf
it.todo('should call onChange with "upscale" when Upscale segment is clicked')

// AC-6: Klick auf bereits aktives Segment löst keinen Fehler aus
it.todo('should not throw when clicking the already active segment')

// AC-7: Disabled-Segment ist nicht anklickbar
it.todo('should not call onChange when a disabled segment is clicked')
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
| `ModeSelector` | Component | PromptArea (spätere Slices) | `({ value: string, onChange: (mode: string) => void, disabledModes?: string[] }) => JSX.Element` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/mode-selector.tsx` — Rein presentationaler Segmented Control mit drei fixen Segmenten; Props: `value`, `onChange`, optional `disabledModes`
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt `components/workspace/__tests__/mode-selector.test.tsx` basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Keine eigene State-Logik — vollständig controlled component
- Kein Fetch, keine Server Actions, keine Context-Anbindung
- Keine Integration in `PromptArea` — das ist Aufgabe eines späteren Slice
- Kein Auto-Switch-Verhalten bei Model-Kompatibilität (liegt in PromptArea)

**Technische Constraints:**
- Nutze shadcn/ui oder Radix UI Primitives, die bereits im Projekt installiert sind (radix-ui 1.4.3)
- `"use client"` Direktive erforderlich (interaktive Komponente)
- Segmentwerte sind Strings: `"txt2img"`, `"img2img"`, `"upscale"`
- Segment-Labels sind fix: "Text to Image", "Image to Image", "Upscale"

**Referenzen:**
- Visuelles Layout: `wireframes.md` → Section "Screen: Prompt Area — Text to Image (Default)" → Annotation ①
- Disabled-Edge-Case: `architecture.md` → Section "Model Auto-Switch" → "Edge Case: No compatible model"
- Modewerte: `architecture.md` → Section "Validation Rules" → Feld `generationMode`
