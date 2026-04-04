# Slice 4: Floating Brush Toolbar

> **Slice 4 von 16** fuer `AI Image Editing Suite`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-04-floating-brush-toolbar` |
| **Test** | `pnpm test components/canvas/__tests__/floating-brush-toolbar.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-canvas-detail-context", "slice-03-mask-canvas"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/__tests__/floating-brush-toolbar.test.tsx` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm test -- --run` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (Context Provider mocken fuer isolierte Component-Tests) |

---

## Ziel

Horizontale schwebende Toolbar ueber dem Canvas-Bereich erstellen, die Brush-Size-Slider, Brush/Eraser-Toggle, Clear-Mask-Button und einen Erase-Action-Button (nur im Erase-Modus) enthaelt. Alle Controls lesen und schreiben State via `useCanvasDetail()` Context.

---

## Acceptance Criteria

1) GIVEN `editMode` ist `"inpaint"` oder `"erase"` im CanvasDetailState
   WHEN die FloatingBrushToolbar gerendert wird
   THEN ist die Toolbar sichtbar, horizontal positioniert oberhalb des Canvas-Bildbereichs (top-center)

2) GIVEN `editMode` ist `null` oder `"instruction"` oder `"outpaint"`
   WHEN die FloatingBrushToolbar gerendert wird
   THEN ist die Toolbar nicht sichtbar (nicht im DOM oder hidden)

3) GIVEN die Toolbar ist sichtbar
   WHEN der User den Brush-Size-Slider bewegt
   THEN wird `SET_BRUSH_SIZE` mit dem neuen Wert dispatched
   AND der Slider akzeptiert Werte von `1` bis `100`
   AND der aktuelle Wert wird numerisch neben dem Slider angezeigt

4) GIVEN `brushTool` im State ist `"brush"`
   WHEN der User den Brush/Eraser-Toggle klickt
   THEN wird `SET_BRUSH_TOOL` mit `"eraser"` dispatched
   AND der Toggle zeigt visuell "Eraser" als aktiv an

5) GIVEN `brushTool` im State ist `"eraser"`
   WHEN der User den Brush/Eraser-Toggle klickt
   THEN wird `SET_BRUSH_TOOL` mit `"brush"` dispatched
   AND der Toggle zeigt visuell "Brush" als aktiv an

6) GIVEN `maskData` im State ist nicht `null` (Maske vorhanden)
   WHEN der User den Clear-Mask-Button klickt
   THEN wird `CLEAR_MASK` dispatched

7) GIVEN `maskData` im State ist `null` (keine Maske vorhanden)
   WHEN die Toolbar gerendert wird
   THEN ist der Clear-Mask-Button disabled (nicht klickbar)

8) GIVEN `editMode` ist `"erase"`
   WHEN die Toolbar gerendert wird
   THEN ist ein zusaetzlicher "Entfernen"-Button (erase-action-btn) sichtbar

9) GIVEN `editMode` ist `"inpaint"`
   WHEN die Toolbar gerendert wird
   THEN ist der "Entfernen"-Button NICHT sichtbar

10) GIVEN `editMode` ist `"erase"` und `maskData` ist `null`
    WHEN der "Entfernen"-Button gerendert wird
    THEN ist der Button disabled

11) GIVEN `editMode` ist `"erase"` und `maskData` ist nicht `null`
    WHEN der User den "Entfernen"-Button klickt
    THEN wird ein `onEraseAction` Callback aufgerufen (Prop, keine direkte Generation-Logik in diesem Slice)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/__tests__/floating-brush-toolbar.test.tsx`

<test_spec>
```typescript
// AC-1: Toolbar sichtbar bei inpaint/erase
it.todo('should render toolbar when editMode is inpaint')
it.todo('should render toolbar when editMode is erase')

// AC-2: Toolbar nicht sichtbar bei null/instruction/outpaint
it.todo('should not render toolbar when editMode is null')
it.todo('should not render toolbar when editMode is instruction')
it.todo('should not render toolbar when editMode is outpaint')

// AC-3: Brush-Size-Slider dispatcht SET_BRUSH_SIZE
it.todo('should dispatch SET_BRUSH_SIZE when slider value changes')
it.todo('should accept slider values from 1 to 100')
it.todo('should display current brush size value')

// AC-4: Toggle von brush zu eraser
it.todo('should dispatch SET_BRUSH_TOOL with eraser when toggle clicked in brush mode')

// AC-5: Toggle von eraser zu brush
it.todo('should dispatch SET_BRUSH_TOOL with brush when toggle clicked in eraser mode')

// AC-6: Clear-Mask dispatcht CLEAR_MASK
it.todo('should dispatch CLEAR_MASK when clear button clicked with mask present')

// AC-7: Clear-Button disabled ohne Maske
it.todo('should disable clear button when maskData is null')

// AC-8: Erase-Action-Button sichtbar im erase-Modus
it.todo('should show erase action button when editMode is erase')

// AC-9: Erase-Action-Button nicht sichtbar im inpaint-Modus
it.todo('should not show erase action button when editMode is inpaint')

// AC-10: Erase-Action-Button disabled ohne Maske
it.todo('should disable erase action button when maskData is null in erase mode')

// AC-11: Erase-Action-Button ruft onEraseAction auf
it.todo('should call onEraseAction callback when erase action button clicked with mask')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-02-canvas-detail-context` | `CanvasDetailState` (editMode, maskData, brushSize, brushTool) | State Fields | State-Felder vorhanden, Defaults korrekt |
| `slice-02-canvas-detail-context` | `SET_BRUSH_SIZE`, `SET_BRUSH_TOOL`, `CLEAR_MASK` | Action Types | Dispatch aendert State wie in Slice 02 spezifiziert |
| `slice-03-mask-canvas` | `MaskCanvas` gemountet in canvas-detail-view | Component | Toolbar steuert Brush-Parameter die MaskCanvas konsumiert |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `FloatingBrushToolbar` | React Component | canvas-detail-view (Mount Point) | `<FloatingBrushToolbar onEraseAction={() => void} />` |
| `onEraseAction` Callback | Prop | slice-06a (Erase-Flow Integration) | `() => void` — wird in spaeteren Slices mit Generation-Logik verbunden |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/floating-brush-toolbar.tsx` -- Neues Component: Brush-Size-Slider, Brush/Eraser-Toggle, Clear-Mask-Button, Erase-Action-Button
- [ ] `components/canvas/canvas-detail-view.tsx` -- MODIFY: FloatingBrushToolbar importieren und im Center-Column oberhalb des Bild-Bereichs mounten
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Generation-Logik im Component (onEraseAction ist nur ein Callback-Prop)
- KEINE Keyboard Shortcuts (`[`, `]`, `E`) -- spaeterer Slice
- KEINE Mask-Painting-Logik (das ist Slice 03)
- KEIN Disabled-State waehrend Generation (isGenerating-Handling ist spaeterer Slice)
- KEINE Mask-Validierung (min 10px Check ist spaeterer Slice)

**Technische Constraints:**
- Slider-Component: bestehende shadcn/ui `Slider` verwenden falls vorhanden, sonst nativer `<input type="range">`
- Toggle: shadcn/ui `ToggleGroup` oder aequivalentes Pattern aus der Codebase
- Toolbar-Positionierung: `position: absolute` oder `sticky` relativ zum Center-Column, z-index ueber dem Canvas aber unter Modals
- Alle State-Zugriffe ueber `useCanvasDetail()` Hook (kein Prop-Drilling fuer State)
- "Entfernen"-Button-Label auf Deutsch (siehe wireframes.md → Painting Mode Erase)

**Reuse (PFLICHT):**

| Existing File | Usage in this Slice |
|---|---|
| `components/canvas/canvas-detail-view.tsx` | MODIFY -- FloatingBrushToolbar als Child-Element im Center-Column mounten |
| `lib/canvas-detail-context.tsx` | IMPORT -- `useCanvasDetail()` fuer State (editMode, brushSize, brushTool, maskData) und dispatch |

**Referenzen:**
- Architecture: `architecture.md` → Section "New Files" (Zeile 345: floating-brush-toolbar.tsx)
- Architecture: `architecture.md` → Section "Migration Map" (Zeile 330: canvas-detail-view.tsx Erweiterung im Center Column)
- Wireframes: `wireframes.md` → Screen "Painting Mode (Brush Edit)" (Annotations 1-4: Floating Toolbar, Slider, Toggle, Clear)
- Wireframes: `wireframes.md` → Screen "Painting Mode (Erase)" (Annotation 1: erase-action-btn nur im Erase-Modus)
