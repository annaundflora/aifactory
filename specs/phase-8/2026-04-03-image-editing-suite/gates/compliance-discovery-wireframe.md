# Gate 0: Discovery <-> Wireframe Compliance

**Discovery:** `specs/phase-8/2026-04-03-image-editing-suite/discovery.md`
**Wireframes:** `specs/phase-8/2026-04-03-image-editing-suite/wireframes.md`
**Pruefdatum:** 2026-04-04

---

## Summary

| Status | Count |
|--------|-------|
| Pass | 51 |
| Auto-Fixed | 0 |
| Blocking | 0 |

**Verdict:** APPROVED

**100% Compliance:** All previously blocking issues have been resolved in wireframes.

---

## A) Discovery -> Wireframe

### User Flow Coverage

| Discovery Flow | Steps | Wireframe Screens | Status |
|----------------|-------|-------------------|--------|
| Flow 1: Mask-Inpainting | 11 | Canvas Detail-View (Idle), Painting Mode (Brush Edit), Generating State, Result State | Pass |
| Flow 2: Object Removal (Erase) | 5 | Canvas Detail-View (Idle), Painting Mode (Erase), Generating State, Result State | Pass |
| Flow 3: Instruction Editing | 5 | Canvas Detail-View (Idle), Generating State, Result State | Pass |
| Flow 4: Click-to-Edit (SAM) | 6 | Canvas Detail-View (Idle), Click-to-Edit Mode, Painting Mode (Brush Edit), Generating State, Result State | Pass |
| Flow 5: Outpainting | 6 | Canvas Detail-View (Idle), Outpaint Mode, Generating State, Result State | Pass |

### UI State Coverage

| Component | Discovery States | Wireframe States | Missing | Status |
|-----------|------------------|------------------|---------|--------|
| State Machine: `idle` | idle | Canvas Detail-View (Idle): idle, tool-hover | -- | Pass |
| State Machine: `painting` | painting (brush edit), painting (erase) | Painting Mode (Brush Edit): 5 variations, Painting Mode (Erase): 4 variations | -- | Pass |
| State Machine: `click-waiting` | click-waiting | Click-to-Edit Mode: click-waiting, click-waiting (mask exists) | -- | Pass |
| State Machine: `sam-processing` | sam-processing | Click-to-Edit Mode: sam-processing | -- | Pass |
| State Machine: `sam-confirm` | sam-confirm (confirmation dialog) | Click-to-Edit Mode: click-waiting (mask exists) shows dialog text with [Abbrechen] [Ersetzen] | -- | Pass |
| State Machine: `outpaint-config` | outpaint-config | Outpaint Mode: 3 variations (no direction, direction selected, multi-direction) | -- | Pass |
| State Machine: `generating` | generating (4 sub-states) | Generating State: 4 variations (inpaint, erase, instruction, outpaint) + api-error | -- | Pass |
| State Machine: `result` | result | Result State: 4 variations (inpaint/erase, instruction, outpaint, navigation blocked) | -- | Pass |
| `brush-edit-btn` | inactive, active | Idle (inactive) + Painting Brush Edit (active/highlighted) | -- | Pass |
| `erase-btn` | inactive, active | Idle (inactive) + Painting Erase (active/highlighted) | -- | Pass |
| `click-edit-btn` | inactive, active | Idle (inactive) + Click-to-Edit (active/highlighted) | -- | Pass |
| `expand-btn` | inactive, active | Idle (inactive) + Outpaint Mode (active/highlighted) | -- | Pass |
| `mask-canvas` | hidden, visible, has-mask | Painting (no mask): empty overlay, Painting (has mask): red mask visible | -- | Pass |
| `brush-size-slider` | 1px-100px range | Floating Brush Toolbar, annotated 1px to 100px | -- | Pass |
| `brush-eraser-toggle` | brush, eraser | Floating Toolbar as [Brush\|Eraser], eraser state variation documented | -- | Pass |
| `clear-mask-btn` | enabled, disabled | Documented: disabled when no mask, enabled when mask painted | -- | Pass |
| `erase-action-btn` | enabled, disabled | Documented: disabled when no mask (tooltip on click), enabled when mask painted, only in Erase mode | -- | Pass |
| `outpaint-direction` | unselected, selected | Shown at 4 edges with toggle selection | -- | Pass |
| `outpaint-size` | 25%, 50%, 100% | Shown as [25%\|50%\|100%] button group at each direction | -- | Pass |

### Interactive Elements

| Discovery Element | Wireframe Location | Annotation | Status |
|-------------------|-------------------|------------|--------|
| `brush-edit-btn` | Canvas Detail-View (Idle), toolbar left | Annotation 2 | Pass |
| `erase-btn` | Canvas Detail-View (Idle), toolbar left | Annotation 3 | Pass |
| `click-edit-btn` | Canvas Detail-View (Idle), toolbar left | Annotation 4 | Pass |
| `expand-btn` | Canvas Detail-View (Idle), toolbar left | Annotation 5 | Pass |
| `mask-canvas` | Painting Mode (Brush Edit), over image | Annotation 5 | Pass |
| `brush-size-slider` | Floating Brush Toolbar | Annotation 2 | Pass |
| `brush-eraser-toggle` | Floating Brush Toolbar | Annotation 3 | Pass |
| `clear-mask-btn` | Floating Brush Toolbar | Annotation 4 | Pass |
| `erase-action-btn` | Floating Brush Toolbar (Erase Mode) | Annotation 1 (Erase screen) | Pass |
| `outpaint-direction` (4x) | Outpaint Mode, at image edges | Annotations 1, 3, 4, 6 | Pass |
| `outpaint-size` | Outpaint Mode, at each direction | Annotation 2 | Pass |
| Undo button | Result State, toolbar left | Annotation 3 | Pass |

### Error State Coverage

| Error State (from Discovery) | Wireframe Coverage | Status |
|------------------------------|--------------------|--------|
| API-Fehler (all modes) | Generating State: `api-error` -- Error toast, overlay removed, returns to previous mode | Pass |
| SAM kein Objekt erkannt | Click-to-Edit: `sam-error (no object)` -- "Kein Objekt erkannt. Versuche einen anderen Punkt." | Pass |
| SAM API-Fehler (separate) | Click-to-Edit: `sam-error (api failure)` -- "SAM-Fehler. Versuche manuelles Maskieren." Suggests Brush Edit | Pass |
| Leere Maske + Prompt (no mask) | Handled by Agent routing logic (Instruction Editing), not an error state | Pass |
| Leere Maske + "Entfernen" | Erase `(no mask)`: button disabled, tooltip on click: "Markiere zuerst einen Bereich" | Pass |
| Outpaint keine Richtung | `outpaint-config (no direction)`: send disabled, inline hint shown | Pass |
| Mask zu klein (< 10px) | Painting `(mask too small)`: Warning toast "Markiere einen groesseren Bereich" on submit | Pass |
| Erase mask too small | Erase `(mask too small)`: Warning toast "Markiere einen groesseren Bereich" on erase action | Pass |

### Keyboard Shortcuts Coverage

| Discovery Feature | Wireframe Coverage | Status |
|-------------------|--------------------|--------|
| `[` / `]` Brush size | Painting Mode (Brush Edit): documented in Keyboard Shortcuts section | Pass |
| `E` Brush/Eraser Toggle | Painting Mode (Brush Edit): documented in Keyboard Shortcuts section | Pass |
| `Ctrl+Z` / `Cmd+Z` Mask-Undo | Painting Mode (Brush Edit): documented with note about separate mask undo stack | Pass |

---

## B) Wireframe -> Discovery (Rueckfluss-Check)

### Visual Specs

| Wireframe Spec | Value | In Discovery | Status |
|----------------|-------|--------------|--------|
| Mask overlay color | Semi-transparent red, 50% opacity | Discovery "Mask Canvas Overlay": "Semi-transparentes Rot (50% Opacity)" | Pass -- already present |
| Brush size range | 1px to 100px | Discovery UI Components: "`1px` - `100px`" | Pass -- already present |
| Brush cursor | Circle matching brush size | Discovery "Mask Canvas Overlay": "Cursor: Kreis in Brush-Groesse" | Pass -- already present |
| Click-edit cursor | Crosshair | Discovery "Mask Canvas Overlay": "Fadenkreuz (Click Edit)" | Pass -- already present |
| Outpaint size options | 25%, 50%, 100% | Discovery UI Components + Business Rules | Pass -- already present |
| Outpaint default | 50% pre-selected | Discovery Business Rules: "Default: 50% (vorausgewaehlt)" | Pass -- already present |
| Floating Toolbar position | Top-center above image, horizontal | Discovery "Floating Brush Toolbar": "Position: Oben mittig ueber dem Bild, horizontal" | Pass -- already present |
| Loading overlay | Semi-transparent covering entire image | Discovery references Loading-Overlay in flows | Pass -- already present |
| Erase chat hint | "Type prompt to replace instead" | Discovery Business Rule "Erase-Modus + Chat" | Pass -- semantically present |
| Outpaint inline hint | "Waehle mindestens eine Richtung zum Erweitern" | Discovery Business Rule "Outpaint-Validierung": exact text match | Pass -- already present |
| SAM error (no object) | "Kein Objekt erkannt. Versuche einen anderen Punkt." | Discovery Flow 4 Error Paths: exact text match | Pass -- already present |
| SAM error (api failure) | "SAM-Fehler. Versuche manuelles Maskieren." | Discovery Flow 4 Error Paths: "SAM API-Fehler -> Error-Toast, Fallback: manuelles Masken-Malen vorschlagen" | Pass -- already present |
| SAM confirm dialog | "Diese Aktion ersetzt deine aktuelle Maske. Fortfahren?" [Abbrechen] [Ersetzen] | Discovery Business Rule "SAM-Mask ersetzt manuelle Maske": exact match | Pass -- already present |
| Result: mask stays visible | Previous mask still visible after result | Discovery Business Rule: "Maske bleibt" after edit | Pass -- already present |
| Result: navigation blocked | Prev/Next disabled when mask exists | Discovery Business Rule "Navigation-Sperre" | Pass -- already present |
| Generating: mask visible under overlay | Mask remains visible under loading overlay | Discovery Flow 1 step 9: "Maske bleibt sichtbar" | Pass -- already present |
| Generating: tools disabled | All toolbar buttons disabled during generation | Discovery state machine: `generating` -- "Tools disabled" | Pass -- already present |
| Direction controls: per-direction size selector | Each direction has its own size selector | Discovery "Outpaint Direction Controls": "Elemente pro Richtung" | Pass -- already present |
| Erase disabled button tooltip | "Markiere zuerst einen Bereich" on disabled button click | Discovery Flow 2 Error Paths: exact text match | Pass -- already present |
| Mask too small warning | Toast "Markiere einen groesseren Bereich" when < 10px | Discovery Error Path + Business Rule "Minimum Mask Size" | Pass -- already present |

### Implicit Constraints

| Wireframe Shows | Implied Constraint | In Discovery | Status |
|-----------------|-------------------|--------------|--------|
| Floating Brush Toolbar shared between Brush Edit and Erase | Shared component with conditional erase-action-btn | Discovery "Floating Brush Toolbar" lists all elements including conditional erase-action | Pass -- already present |
| Chat input disabled during generating state | Input field must be disabled when generating | Discovery state machine: generating blocks all tools | Pass -- already present |
| Chat panel visible in all modes (including Erase) | Chat remains accessible for prompt upgrade | Discovery Business Rule "Erase-Modus + Chat" | Pass -- already present |
| Click-to-Edit has no Floating Toolbar until SAM result | Toolbar appears only after SAM auto-mask | Discovery Flow 4 step 4: "Floating Brush Toolbar erscheint" after SAM success | Pass -- already present |
| Erase prompt upgrades to inpaint | Sending prompt in Erase mode uses inpaint model | Discovery Business Rule "Erase-Modus + Chat": Prompt -> Inpaint upgrade | Pass -- already present |
| Outpaint mode hides mask canvas | Mask hidden but retained in state | Discovery Business Rule "Mask-Sichtbarkeit" | Pass -- already present |
| Keyboard shortcuts: separate mask undo stack | Ctrl+Z in painting mode undoes mask, not image | Discovery: "eigener Mask-Undo-Stack, getrennt vom Bild-Undo" | Pass -- already present |

---

## C) Design Decisions -> Wireframe

**Skipped** -- `design-decisions.md` does not exist.

---

## Blocking Issues

None.

---

## Previously Blocking Issues (Resolved)

The following 4 issues from the previous compliance check are now resolved:

| # | Previous Issue | Resolution |
|---|---------------|------------|
| 1 | Minimum Mask Size Warning not visualized | Wireframe now includes `painting (mask too small)` and `erase (mask too small)` state variations with warning toast |
| 2 | SAM API-Fehler Fallback not visualized | Wireframe now includes `sam-error (api failure)` state with fallback suggestion to Brush Edit |
| 3 | Keyboard Shortcuts not annotated | Wireframe now includes "Keyboard Shortcuts" section in Painting Mode (Brush Edit) |
| 4 | Erase empty mask warning not visualized | Wireframe now includes tooltip text on disabled button: "Markiere zuerst einen Bereich" |

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Required Discovery Updates:** 0
**Required Wireframe Updates:** 0

**Next Steps:**
- Gate 0 passed. Proceed to Architecture phase.
