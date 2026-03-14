# Gate 0: Discovery <-> Wireframe Compliance

**Discovery:** `specs/phase-5/2026-03-14-model-handling-redesign/discovery.md`
**Wireframes:** `specs/phase-5/2026-03-14-model-handling-redesign/wireframes.md`
**Design Decisions:** Not present (Phase 5 skipped)
**Prufdatum:** 2026-03-14

---

## Summary

| Status | Count |
|--------|-------|
| Pass | 28 |
| Auto-Fixed | 6 |
| Blocking | 0 |

**Verdict:** APPROVED

**100% Compliance:** Keine Warnings - alles wurde gefixt oder war bereits vorhanden.

---

## A) Discovery -> Wireframe

### User Flow Coverage

| Discovery Flow | Steps | Wireframe Screens | Status |
|----------------|-------|-------------------|--------|
| Flow 1: Generation mit Draft (Default) | 4 | Workspace Prompt-Area (Draft selected) -> Generate button | Pass |
| Flow 2: Wechsel zu Quality | 5 | Workspace Prompt-Area (Quality selected) + Max Quality toggle | Pass |
| Flow 3: Settings konfigurieren | 7 | Workspace Header (settings-button) -> Settings Dialog (Default + Dropdown open) | Pass |
| Flow 4: Canvas Iteration (Popovers) | 5 | Canvas Tool Popovers (Variation Draft, Variation Quality+Max, Upscale) | Pass |
| Flow 5: Canvas Chat | 5 | Canvas Chat Panel (Draft, Quality+Max) | Pass |

**Details:**
- Flow 1: Workspace Prompt-Area wireframe shows Draft as active segment with Generate button. Mode Selector preserved above.
- Flow 2: Quality wireframe shows toggle flipped to Quality, Max Quality toggle appears below. Both states (Quality, Quality+Max) are wireframed.
- Flow 3: Settings button in Workspace Header wireframe (annotation 1). Settings Dialog shows all 3 mode sections with Draft/Quality/Max dropdowns. Dropdown-open state shows model list with incompatible model greyed out.
- Flow 4: Variation Popover wireframed in Draft and Quality+Max states. Upscale Popover wireframed with no Max Quality. Img2Img popover shares structure with Variation (documented in Component Coverage table).
- Flow 5: Chat Panel wireframed in Draft and Quality+Max states. Tier-Toggle positioned above chat input.

### UI State Coverage

| Component | Discovery States | Wireframe States | Missing | Status |
|-----------|------------------|------------------|---------|--------|
| `tier-toggle` | draft, quality | draft-selected, quality-selected, quality-max-selected, generating | -- | Pass |
| `max-quality-toggle` | hidden, off, on | hidden (Draft), appears (Quality off), on (Quality+Max) | -- | Pass |
| `settings-button` | default, hover | default, hover | -- | Pass |
| `settings-dialog` | open, closed | open, dropdown-open, model-selected, incompatible-model, collection-load-error | -- | Pass |
| `model-dropdown-draft` | default, open, selected | closed (default), open with model list, selected (checkmark), incompatible (greyed) | -- | Pass |
| `model-dropdown-quality` | default, open, selected | Same as draft | -- | Pass |
| `model-dropdown-max` | default, open, selected | Same as draft; absent for upscale section | -- | Pass |

### Interactive Elements

| Discovery Element | Wireframe Location | Annotation | Status |
|-------------------|-------------------|------------|--------|
| `tier-toggle` (Workspace) | Workspace Prompt-Area, above Generate button | Annotation 1 | Pass |
| `max-quality-toggle` (Workspace) | Workspace Prompt-Area, below Tier-Toggle (Quality state) | Annotation 2 | Pass |
| `tier-toggle` (Variation Popover) | Variation Popover, above Generate button | Annotation 1 | Pass |
| `max-quality-toggle` (Variation Popover) | Variation Popover, below Tier-Toggle (Quality state) | Annotation 2 | Pass |
| `tier-toggle` (Upscale Popover) | Upscale Popover, above action buttons | Annotation 1 | Pass |
| No Max Quality (Upscale) | Correctly absent from Upscale Popover | -- | Pass |
| `tier-toggle` (Chat Panel) | Canvas Chat Panel, above chat input | Annotation 1 | Pass |
| `max-quality-toggle` (Chat Panel) | Canvas Chat Panel, inline next to Tier-Toggle (Quality state) | Annotation 2 | Pass |
| `settings-button` | Workspace Header, left of theme toggle | Annotation 1 | Pass |
| `settings-dialog` | Modal overlay with title + close button | Annotation 1, 2 | Pass |
| `model-dropdown-draft` (per section) | Settings Dialog, per mode section | Annotation 4 | Pass |
| `model-dropdown-quality` (per section) | Settings Dialog, per mode section | Annotation 5 | Pass |
| `model-dropdown-max` (txt2img, img2img only) | Settings Dialog, txt2img + img2img sections | Annotation 6 | Pass |

### Error State Coverage

| Error Path (Discovery) | Wireframe Representation | Status |
|-------------------------|--------------------------|--------|
| Inkompatibles Model ausgegraut + Tooltip | Settings Dialog Dropdown-open wireframe: annotation 8 shows greyed model + tooltip text | Pass |
| Collection nicht ladbar -> Fehlermeldung | Settings Dialog State Variations: `collection-load-error` state documented | Pass |
| Model nicht verfuegbar (Replicate-Fehler) | Not wireframed (runtime error, standard toast — not a new UI pattern) | Pass |

### Removed Elements Coverage

| Removed Element (Discovery) | Wireframe Documentation | Status |
|------------------------------|-------------------------|--------|
| ModelTrigger + ModelBrowserDrawer (Workspace) | Workspace Prompt-Area "Removed Elements" table | Pass |
| ParameterPanel (Workspace) | Workspace Prompt-Area "Removed Elements" table | Pass |
| Multi-Model notice (Workspace) | Workspace Prompt-Area "Removed Elements" table | Pass |
| CanvasModelSelector (Canvas Header) | Canvas Header "Removed Elements" table | Pass |

---

## B) Wireframe -> Discovery (Auto-Fix Ruckfluss)

### Visual Specs - Auto-Fixed

| Wireframe Spec | Value | Discovery Section | Status |
|----------------|-------|-------------------|--------|
| Tier-Toggle disabled during generation | `disabled` state, visible but not interactive | UI Components & States - `tier-toggle` states | Auto-Fixed |
| Chat Tier-Toggle interactive during streaming | Remains interactive while AI response streams, disabled only during generation | UI Components & States - `tier-toggle` behavior | Auto-Fixed |
| Dropdown item display format | Model name (bold) + owner (muted) + checkmark for current | UI Components & States - `model-dropdown-*` behavior | Auto-Fixed |
| Incompatible model display | Greyed out + disabled + not selectable | UI Components & States - `model-dropdown-*` states | Auto-Fixed |
| Collection load error in dropdown | Error message replaces dropdown content | UI Components & States - `model-dropdown-*` states | Auto-Fixed |
| Workspace panel width | 480px | UI Layout & Context | Already Present |
| Canvas Chat panel width | 320-480px, resizable | UI Layout & Context | Already Present |
| Canvas Header height | h-12 | UI Layout & Context | Already Present |
| Settings Dialog: 3 mode sections layout | txt2img, img2img, upscale as card-like sections | UI Layout & Context - Settings Dialog | Already Present |
| Upscale: No Max dropdown | Only Draft + Quality rows in Upscale section | Business Rules + UI Components | Already Present |
| Per-tool independent tier state | Each popover + chat has own state | Business Rules | Already Present |

### Implicit Constraints - Auto-Fixed

| Wireframe Shows | Implied Constraint | Discovery Section | Status |
|-----------------|-------------------|-------------------|--------|
| `generating` state across all screens | Generation blocks tier-toggle interaction; needs state machine entry | Feature State Machine - States Overview + Transitions | Auto-Fixed |
| `streaming` state in Chat Panel | Chat streaming is separate from generation; tier-toggle stays interactive during stream | Feature State Machine - States Overview + Transitions | Auto-Fixed |
| Tooltip text: "Model does not support this mode." | Exact English tooltip text for incompatible models | Error Paths | Auto-Fixed |
| Error text: "Could not load models. Please try again." | Exact English error message for collection load failure | Error Paths | Auto-Fixed |
| Img2Img Popover shares Variation wireframe structure | Img2Img Popover is structurally identical to Variation Popover (same fields: Prompt, Strength, Count, Tier-Toggle, Max Quality, Generate) | Component Coverage table in wireframes | Already Present |

---

## C) Auto-Fix Summary

### Discovery Updates Applied (Auto-Fixed)

| Section | Content Added |
|---------|---------------|
| Feature State Machine - States Overview | Added `generating` state: "Generate/Upscale-Button zeigt Spinner + Generating.../Upscaling.... Tier-Toggle sichtbar aber disabled." |
| Feature State Machine - States Overview | Added `streaming` state: "(Nur Canvas Chat) Chat-Input disabled, Tier-Toggle bleibt interaktiv waehrend AI-Antwort streamt." |
| Feature State Machine - Transitions | Added transitions: tier-states -> `generating` (Click Generate), `generating` -> previous (Generation done), tier-states -> `streaming` (Send Message in Chat), `streaming` -> `generating` or previous (AI done) |
| UI Components & States - `tier-toggle` | Added `disabled` state; documented behavior during generation vs. streaming |
| UI Components & States - `model-dropdown-*` | Added `incompatible-model` and `collection-load-error` states; documented display format (model name bold + owner muted + checkmark) |
| Error Paths | Updated with exact tooltip text ("Model does not support this mode.") and error message text ("Could not load models. Please try again.") |

### Wireframe Updates Needed (Blocking)

None.

---

## D) Design Decisions -> Wireframe

**Skipped.** No `design-decisions.md` found in spec folder.

---

## Blocking Issues

None.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Auto-Fixed Discovery Updates:** 6
**Required Wireframe Updates:** 0

**Next Steps:**
- [x] All discovery features are visualized in wireframes
- [x] All wireframe details have been back-ported to discovery
- [ ] Proceed to architecture/implementation phase
