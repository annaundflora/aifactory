# Gate 0: Discovery <-> Wireframe Compliance

**Discovery:** `specs/phase-7/2026-03-29-model-slots/discovery.md`
**Wireframes:** `specs/phase-7/2026-03-29-model-slots/wireframes.md`
**Design Decisions:** nicht vorhanden (Phase 5 uebersprungen)
**Pruefdatum:** 2026-03-29

---

## Summary

| Status | Count |
|--------|-------|
| Pass | 40 |
| Auto-Fixed | 5 |
| Blocking | 0 |

**Verdict:** APPROVED

**100% Compliance:** Keine Warnings - alles wird gefixt oder blockiert.

---

## A) Discovery -> Wireframe

### User Flow Coverage

| Discovery Flow | Steps | Wireframe Screens | Status |
|----------------|-------|-------------------|--------|
| Flow 1: Quick Model Switch | 4 | Workspace Prompt Area (Dropdown interaction, annotation 2) | Pass |
| Flow 2: Multi-Model Vergleich | 6 | Workspace Prompt Area (Checkbox toggle annotation 1, Variant stepper annotation 6, Generate annotation 7) | Pass |
| Flow 3: Mode-Wechsel | 5 | Workspace Prompt Area (state: mode-switch), Settings Dialog (per-mode sections: txt2img, img2img, upscale) | Pass |
| Flow 4: Neues Model einrichten | 4 | Workspace Prompt Area (empty slot annotations 3+4, state: model-selected-on-empty) | Pass |

### UI State Coverage

| Component | Discovery States | Wireframe States | Missing | Status |
|-----------|------------------|------------------|---------|--------|
| Slot (Aktiv + Model) | aktiv + model gesetzt | Workspace annotation 1+2, all screens show active slots | none | Pass |
| Slot (Inaktiv + Model) | inaktiv + model gesetzt, ausgegraut | Workspace/Variation/Img2img show unchecked slots with model names | none | Pass |
| Slot (Inaktiv + Kein Model) | checkbox disabled, auto-activate | Workspace annotations 3+4, state: model-selected-on-empty | none | Pass |
| Loading State | skeleton-placeholder in dropdowns | Workspace state: loading ("Dropdowns show skeleton placeholders, checkboxes disabled") | none | Pass |
| Generating State | all controls disabled | Workspace/Variation/Img2img/Upscale/Chat all have generating state | none | Pass |
| Streaming (Chat) | slots bleiben interaktiv | Chat Panel state: streaming ("Slots remain interactive") | none | Pass |
| Last-Active-Toggle | checkbox bleibt aktiv (min 1) | Workspace state: last-active-toggle ("checkbox stays checked, no-op") | none | Pass |
| Model inkompatibel nach Mode-Switch | slot deaktiviert + hinweis | Img2img state: incompatible-model ("Model grayed out in dropdown") | none | Pass |
| Kein Model im Katalog | sync-hinweis | Workspace state: no-models-synced, Settings state: no-models | none | Pass |
| Gleicher Model in 2 Slots | erlaubt | No restriction in wireframe (consistent with Discovery) | none | Pass |
| Generate mit 0 Slots | button disabled | Covered by min-1 rule in annotation 1 | none | Pass |
| Upscale Mode | consistent 3 slots | Workspace state: upscale-mode + dedicated Upscale Popover screen with 3 slots | none | Pass |

### Interactive Elements

| Discovery Element | Wireframe Location | Annotation | Status |
|-------------------|-------------------|------------|--------|
| Slot Checkbox (active/inactive) | All 6 screens | WS:1, Var:1, Img:1, Up:1, Chat:1 | Pass |
| Model Dropdown (compatibility-filtered) | All 6 screens | WS:2/4, Var:2, Img:1, Up:1, Chat:1 | Pass |
| Disabled Checkbox (empty slot) | All screens with slots | WS:3, Component Coverage table | Pass |
| Empty Slot Dropdown (auto-activate) | All screens with slots | WS:4, Component Coverage table | Pass |
| Generate Button (multi-model) | Workspace, Variation, Img2img | WS:7, Var:4, Img2img wireframe | Pass |
| Variant Count Stepper | Workspace, Img2img | WS:6, Img2img wireframe | Pass |
| Per-Slot Parameter Panel (stacked) | Workspace, Variation, Img2img | WS:5, Var:5, Img:2 | Pass |
| No Per-Slot Params (Chat exception) | Chat Panel | Chat annotation 1: "No Per-Slot Parameters in compact layout" | Pass |
| No Per-Slot Params (Upscale exception) | Upscale Popover | Upscale annotation 1: "No Per-Slot ParameterPanel" | Pass |
| Scale Buttons (2x/4x) | Upscale Popover | Upscale annotation 2 | Pass |
| Settings Read-Only Display | Settings Dialog | Settings annotations 1-4 (slot label, model name, status dot, hint) | Pass |
| Sync Models Button | Settings Dialog | Settings wireframe top area | Pass |

### Layout Variants

| Discovery Variant | Wireframe Implementation | Status |
|-------------------|------------------------|--------|
| Stacked (Workspace, Variation/Img2img Popovers) | All 3 show vertical rows, full model names, inline per-slot params | Pass |
| Compact (Chat Panel) | Chat: horizontal single-line, truncated names ("Schnell"), no params | Pass |

### Business Rules Visualization

| Discovery Rule | Wireframe Evidence | Status |
|----------------|-------------------|--------|
| Min 1, Max 3 active slots | WS annotation 1 + last-active-toggle state | Pass |
| Mode-specific assignments | mode-switch state + Settings per-mode sections | Pass |
| Auto-activation on model select | WS annotations 3+4 + model-selected-on-empty state | Pass |
| Variants per model (NxM) | WS annotation 6: "2 active slots x 2 variants = 4 images" | Pass |
| Duplicate models allowed | Not blocked in wireframe (consistent) | Pass |
| Chat uses default parameters | Chat annotation 1 confirms no params (matches Discovery exception) | Pass |
| Upscale uses action buttons, not Generate | Upscale wireframe has 2x/4x buttons, no Generate button (matches Discovery exception) | Pass |

---

## B) Wireframe -> Discovery (Auto-Fix Rueckfluss)

### Visual Specs

| Wireframe Spec | Value | Discovery Section | Status |
|----------------|-------|-------------------|--------|
| Per-Slot Parameter Panel inline below dropdown | Schema-based per active slot | Section 3 "Per-Slot Parameter" | Pass - Already Present |
| Chat Panel compact horizontal layout | Truncated names, no params | Section 3 "Layout-Varianten: Compact" | Pass - Already Present |
| Chat Panel model name truncation | "Names truncate to fit available width" | Section 3 "Compact: gekuerzte Model-Namen" | Pass - Already Present |
| Upscale uses action buttons not ParameterPanel | 2x/4x buttons | Section 3 "Per-Slot Parameter: Ausnahmen: Upscale" | Pass - Already Present |
| Workspace separator between prompt and slots | Horizontal rule | Cosmetic layout detail | Pass - cosmetic |
| Img2img per-slot params inline below slot dropdown | Annotation 2: "same as Workspace/Variation" | Section 3 "Layout-Varianten: Stacked" includes Img2img Popovers | Pass - Already Present |
| Streaming state in Chat Panel | Slots remain interactive | Section 6 "Streaming (Chat Panel)" | Pass - Already Present |
| Variation Popover: Count as button group [1][2][3][4] | Fixed count buttons vs stepper in Workspace | NOT in Discovery | Auto-Fixed |
| Settings: Status dot indicators (filled/unfilled) | Read-only active/inactive visualization | NOT in Discovery | Auto-Fixed |
| Settings: Hint text "Change models in the workspace" | Redirect hint directing user to workspace | NOT in Discovery | Auto-Fixed |
| Upscale Popover: No Generate button | Direct scale action buttons replace Generate | NOT explicit in Discovery (action buttons mentioned but not the absence of Generate) | Auto-Fixed |
| Img2img Popover: Strength slider with value 0.6 | Top-level popover control, pre-existing UI element | NOT specific to model-slots feature (pre-existing), but default value is new detail | Auto-Fixed |

### Implicit Constraints

| Wireframe Shows | Implied Constraint | Discovery Has | Status |
|-----------------|-------------------|---------------|--------|
| Variation Popover has [1][2][3][4] button group while Workspace has [-]N[+] stepper | Two different variant-count UI patterns exist per context | Yes (variants documented) but not the UI pattern difference | Auto-Fixed |
| Settings shows filled dot = active, unfilled dot = inactive | Read-only indicator pattern for Settings Dialog | No - only "Read-Only Anzeige" documented | Auto-Fixed |
| Settings shows redirect hint text | Must include user guidance text in Settings | No - only role described, not specific UI text | Auto-Fixed |
| Upscale Popover has no Generate button | Upscale flow triggered by scale buttons, not a separate Generate action | Partially - action buttons documented but Generate absence not explicit | Auto-Fixed |
| Img2img has Strength slider above model slots | Strength is a popover-level control, not a per-slot parameter | No - Img2img strength not addressed in Discovery (pre-existing) | Auto-Fixed |

---

## C) Auto-Fix Summary

### Discovery Updates Needed (Auto-Fix)

| # | Section | Content to Add |
|---|---------|---------------|
| 1 | Section 3 (Regeln) - Variant Count UI | Variant count UI differs per context: Workspace/Img2img use a stepper control ([ - ] N [ + ]), Variation Popover uses a fixed button group ([ 1 ] [ 2 ] [ 3 ] [ 4 ]). |
| 2 | Section 5 (Betroffene Stellen) - Settings Dialog detail | Settings Dialog displays slot status using filled dot (active) / unfilled dot (inactive) as read-only indicator. Includes hint text: "Change models in the workspace." |
| 3 | Section 3 (Regeln) - Upscale flow clarification | Upscale Popover has NO Generate button. Scale action buttons (2x/4x) directly trigger the upscale operation, replacing the standard Generate flow. |
| 4 | Section 5 or 6 - Img2img Strength default | Img2img Popover includes a top-level Strength slider (default: 0.6) as a popover-level control above the model slots. This is a pre-existing parameter, not part of per-slot parameters. |
| 5 | Section 6 (States) - Img2img no Negative Prompt | Img2img Popover does not include a Negative Prompt field (unlike Variation Popover which does). This difference reflects the existing popover designs. |

### Wireframe Updates Needed (Blocking)

None.

**Only Wireframe issues are Blocking** - Discovery gaps are auto-fixed.

---

## D) Design Decisions -> Wireframe

**Skipped:** `design-decisions.md` does not exist in spec folder.

---

## Blocking Issues

None.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Required Discovery Updates (Auto-Fix):** 5 (minor detail backflow from wireframes)
**Required Wireframe Updates:** 0

**Key Finding:** The prior compliance run found 3 blocking issues around Per-Slot Parameters in Chat Panel, Upscale Popover, and Img2img Popover. All three were false positives:
- **Chat Panel:** Discovery Section 3 explicitly lists "Chat Panel" as an exception: "Kompaktes horizontales Layout ohne ParameterPanel"
- **Upscale Popover:** Discovery Section 3 explicitly lists "Upscale Popover" as an exception: "Nutzt direkte Action-Buttons (2x/4x) statt ParameterPanel"
- **Img2img Popover:** Wireframe annotation 2 confirms per-slot params ARE shown inline ("same as Workspace/Variation"). The Aspect Ratio IS inside the slot container, not shared outside.

**Next Steps:**
- [ ] Apply 5 auto-fix detail updates to Discovery before Architecture phase
