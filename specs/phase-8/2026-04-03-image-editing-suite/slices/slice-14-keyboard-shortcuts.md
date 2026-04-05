# Slice 14: Keyboard Shortcuts & Mask Undo

> **Slice 14 von 16** fuer `AI Image Editing Suite`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-14-keyboard-shortcuts` |
| **Test** | `pnpm test components/canvas/__tests__/mask-canvas-keyboard.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-mask-canvas", "slice-04-floating-brush-toolbar"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/__tests__/mask-canvas-keyboard.test.tsx` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm test -- --run` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (CanvasDetailContext mocken, HTMLCanvasElement fuer Undo-Stack-Snapshot) |

---

## Ziel

Keyboard-Shortcuts fuer Brush-Groesse (`[`/`]`), Brush/Eraser-Toggle (`E`) und Mask-Undo (`Ctrl+Z`/`Cmd+Z`) in der MaskCanvas-Component implementieren. Shortcuts sind NUR aktiv wenn ein Painting-Modus (`inpaint` oder `erase`) aktiv ist. Der Mask-Undo-Stack ist getrennt vom bestehenden Bild-Undo-Stack (PUSH_UNDO).

---

## Acceptance Criteria

1) GIVEN `editMode` ist `"inpaint"` oder `"erase"`
   WHEN der User `]` drueckt
   THEN wird `SET_BRUSH_SIZE` mit `currentBrushSize + 5` dispatched
   AND der Wert wird auf maximal `100` begrenzt (Clamp)

2) GIVEN `editMode` ist `"inpaint"` oder `"erase"`
   WHEN der User `[` drueckt
   THEN wird `SET_BRUSH_SIZE` mit `currentBrushSize - 5` dispatched
   AND der Wert wird auf minimal `1` begrenzt (Clamp)

3) GIVEN `editMode` ist `"inpaint"` oder `"erase"`
   WHEN der User `E` drueckt (Gross- oder Kleinbuchstabe)
   THEN wird `SET_BRUSH_TOOL` dispatched: `"brush"` -> `"eraser"` bzw. `"eraser"` -> `"brush"`

4) GIVEN `editMode` ist `null`, `"instruction"`, `"outpaint"` oder `"click-edit"`
   WHEN der User `[`, `]`, `E` oder `Ctrl+Z` drueckt
   THEN passiert NICHTS (keine Dispatch-Aufrufe, kein Undo)

5) GIVEN der User hat 3 Mask-Strokes gemalt (mouseup wurde 3x ausgeloest)
   WHEN der User `Ctrl+Z` (Windows/Linux) oder `Cmd+Z` (macOS) drueckt
   THEN wird der letzte Stroke rueckgaengig gemacht (Canvas-Zustand vor dem 3. Stroke wiederhergestellt)
   AND der Undo-Stack enthaelt noch 2 Eintraege

6) GIVEN der Mask-Undo-Stack ist leer (kein Stroke gemalt oder alle rueckgaengig gemacht)
   WHEN der User `Ctrl+Z`/`Cmd+Z` drueckt
   THEN passiert NICHTS (kein Fehler, kein Dispatch)

7) GIVEN der User macht einen Stroke rueckgaengig via `Ctrl+Z`
   WHEN der Undo den Canvas-Zustand wiederherstellt
   THEN wird `SET_MASK_DATA` mit den wiederhergestellten ImageData dispatched (oder `null` wenn Stack leer)
   AND das Bild-Undo (PUSH_UNDO) bleibt UNBERUEHRT

8) GIVEN ein `<input>`, `<textarea>` oder `[contenteditable]` Element hat den Focus
   WHEN der User `E`, `[`, `]` oder `Ctrl+Z` drueckt
   THEN werden die Shortcuts NICHT ausgeloest (kein Conflict mit Text-Eingabe)

9) GIVEN `CLEAR_MASK` wird dispatched (z.B. via Clear-Button der FloatingBrushToolbar)
   WHEN die Maske geleert wird
   THEN wird der Mask-Undo-Stack ebenfalls geleert (Reset)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/__tests__/mask-canvas-keyboard.test.tsx`

<test_spec>
```typescript
// AC-1: ] vergroessert Brush-Size um 5 (max 100)
it.todo('should dispatch SET_BRUSH_SIZE with currentSize + 5 on ] key')
it.todo('should clamp brush size to 100 when ] would exceed maximum')

// AC-2: [ verkleinert Brush-Size um 5 (min 1)
it.todo('should dispatch SET_BRUSH_SIZE with currentSize - 5 on [ key')
it.todo('should clamp brush size to 1 when [ would go below minimum')

// AC-3: E togglet Brush/Eraser
it.todo('should dispatch SET_BRUSH_TOOL toggling brush to eraser on E key')
it.todo('should dispatch SET_BRUSH_TOOL toggling eraser to brush on E key')
it.todo('should handle both uppercase and lowercase E')

// AC-4: Shortcuts inaktiv ausserhalb Painting-Modus
it.todo('should not dispatch on ] key when editMode is null')
it.todo('should not dispatch on [ key when editMode is instruction')
it.todo('should not dispatch on E key when editMode is outpaint')
it.todo('should not dispatch on Ctrl+Z when editMode is null')

// AC-5: Ctrl+Z macht letzten Stroke rueckgaengig
it.todo('should restore canvas state before last stroke on Ctrl+Z')
it.todo('should support Cmd+Z on macOS for mask undo')

// AC-6: Ctrl+Z bei leerem Undo-Stack
it.todo('should do nothing when Ctrl+Z pressed with empty undo stack')

// AC-7: SET_MASK_DATA dispatch nach Undo
it.todo('should dispatch SET_MASK_DATA with restored ImageData after undo')
it.todo('should dispatch SET_MASK_DATA with null when undo stack fully exhausted')
it.todo('should not trigger PUSH_UNDO on mask undo')

// AC-8: Shortcuts inaktiv bei Focus auf Input-Elementen
it.todo('should not trigger shortcuts when input element has focus')
it.todo('should not trigger shortcuts when textarea has focus')
it.todo('should not trigger shortcuts when contenteditable has focus')

// AC-9: Clear-Mask leert Undo-Stack
it.todo('should reset undo stack when CLEAR_MASK is dispatched')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03-mask-canvas` | `MaskCanvas` Component mit Canvas-Ref und Paint-Loop | Component | Canvas rendert, mousedown/mousemove/mouseup funktionieren |
| `slice-03-mask-canvas` | `SET_MASK_DATA` Dispatch bei mouseup | Action | Undo-Stack-Eintrag wird VOR dem mouseup-Dispatch erstellt |
| `slice-04-floating-brush-toolbar` | `SET_BRUSH_SIZE`, `SET_BRUSH_TOOL` Actions | Action Types | Keyboard-Shortcuts dispatchen dieselben Actions wie Toolbar-Controls |
| `slice-02-canvas-detail-context` | `editMode`, `brushSize`, `brushTool` aus State | State Fields | State korrekt lesbar via `useCanvasDetail()` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Mask-Undo-Stack | Internal (component-local) | -- | Kein externer Consumer, stack-intern in MaskCanvas |
| Keyboard-Event-Handler | Internal | -- | Registriert via `useEffect` auf `document.addEventListener('keydown', ...)` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/mask-canvas.tsx` -- MODIFY: Mask-Undo-Stack (ImageData-Snapshots vor jedem Stroke), Keyboard-Event-Listener (`keydown` auf `document`), Shortcut-Handler fuer `[`, `]`, `E`, `Ctrl+Z`/`Cmd+Z`, Input-Focus-Guard
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Redo-Funktion fuer Mask-Strokes (nur Undo)
- KEINE Aenderung am Bild-Undo-Stack (PUSH_UNDO bleibt unberuehrt)
- KEINE neuen UI-Elemente (alle Shortcuts spiegeln bestehende Toolbar-Controls)
- KEINE Touch/Pointer-Event-Shortcuts
- KEIN Shortcut-Overlay / Hilfe-Dialog

**Technische Constraints:**
- Undo-Stack als Array von `ImageData`-Snapshots, component-lokal (nicht im Context-State, da zu gross fuer Reducer-State)
- Snapshot wird NACH mousedown / VOR dem Malen erstellt (Canvas-Zustand vor dem aktuellen Stroke)
- `keydown`-Event-Listener auf `document` Level via `useEffect` (cleanup bei unmount)
- Input-Focus-Guard: `event.target` pruefen auf `tagName === 'INPUT' || 'TEXTAREA'` oder `contentEditable === 'true'`
- `metaKey` (macOS Cmd) und `ctrlKey` (Windows/Linux) beruecksichtigen fuer Undo
- `event.preventDefault()` bei Ctrl+Z/Cmd+Z um Browser-Undo zu unterdruecken (nur in Painting-Modi)
- Brush-Size-Step: 5px pro Tastendruck, geclampt auf [1, 100]

**Reuse (PFLICHT):**

| Existing File | Usage in this Slice |
|---|---|
| `components/canvas/mask-canvas.tsx` | MODIFY -- Keyboard-Listener und Undo-Stack als Erweiterung der bestehenden Paint-Logik |
| `lib/canvas-detail-context.tsx` | IMPORT -- `useCanvasDetail()` fuer State-Reads (editMode, brushSize, brushTool) und Dispatches (SET_BRUSH_SIZE, SET_BRUSH_TOOL, SET_MASK_DATA) |

**Referenzen:**
- Architecture: `architecture.md` --> Section "Quality Attributes" (Zeile 396: Mask undo als separater Stack)
- Architecture: `architecture.md` --> Section "Technology Decisions" (Zeile 457: Mask undo vs extending existing undo)
- Wireframes: `wireframes.md` --> Screen "Painting Mode (Brush Edit)" (Keyboard Shortcuts Absatz: `[`, `]`, `E`, `Ctrl+Z`)
- Discovery: `discovery.md` --> Section "Business Rules" (Keyboard Shortcuts nur in Painting-Modi aktiv)
