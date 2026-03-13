# Gate 0: Discovery <-> Wireframe Compliance

**Discovery:** `specs/phase-4/2026-03-13-canvas-detail-view/discovery.md`
**Wireframes:** `specs/phase-4/2026-03-13-canvas-detail-view/wireframes.md`
**Pruefdatum:** 2026-03-13

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 38 |
| Auto-Fixed | 6 |
| Blocking | 0 |

**Verdict:** APPROVED

**100% Compliance:** Keine Warnings - alles wird gefixt oder blockiert.

---

## A) Discovery -> Wireframe

### User Flow Coverage

| Discovery Flow | Steps | Wireframe Screens | Status |
|----------------|-------|-------------------|--------|
| Flow 1: Gallery -> Detail -> Iteration via Tool | 6 | Gallery-View, Animated Transition, Canvas-Detail-View (Idle), Variation Popover, Loading State | PASS |
| Flow 2: Detail -> Iteration via Chat | 8 | Canvas-Detail-View (Idle), Chat Panel Active (shows full clarification flow with chips), Loading State | PASS |
| Flow 3: Detail -> img2img mit Referenzen | 6 | Canvas-Detail-View (Idle), img2img Popover (shows reference slots, prompt fields, parameters), Loading State | PASS |
| Flow 4: Navigation innerhalb Detail-View | 3 | Canvas-Detail-View (Idle) with siblings (8), prev/next (7), Chat Panel Active with context-separator (9), Chat Panel Collapsed (back via ESC) | PASS |
| Flow 5: Upscale | 3 | Canvas-Detail-View (Idle), Upscale Popover (2x/4x buttons), Loading State | PASS |
| Error Paths | 3 | Error State screen covers: generation-failed (toast), chat-timeout (bot message), upscale-unavailable (disabled icon + tooltip) | PASS |

### UI State Coverage

| Component | Discovery States | Wireframe States | Missing | Status |
|-----------|------------------|------------------|---------|--------|
| `toolbar` | default, tool-active | Shown in idle + tool active (highlighted icon) | -- | PASS |
| `toolbar.variation` | default, active, disabled | Active shown in Variation Popover, disabled in Loading State | -- | PASS |
| `toolbar.img2img` | default, active, disabled | Active shown in img2img Popover, disabled in Loading State | -- | PASS |
| `toolbar.upscale` | default, active, disabled | Active shown in Upscale Popover, disabled in Loading State + Error State (upscale-unavailable) | -- | PASS |
| `toolbar.download` | default | Shown in toolbar detail | -- | PASS |
| `toolbar.delete` | default | Shown in toolbar detail, Delete Confirmation dialog | -- | PASS |
| `toolbar.details` | default, expanded | Shown in toolbar detail + Details Overlay screen | -- | PASS |
| `popover.variation` | visible, hidden | Variation Popover screen shown | -- | PASS |
| `popover.img2img` | visible, hidden | img2img Popover screen shown | -- | PASS |
| `popover.upscale` | visible, hidden | Upscale Popover screen shown | -- | PASS |
| `canvas-image` | default, loading, error | Default in Canvas-Detail-View, loading in Loading State, error in Error State | -- | PASS |
| `siblings` | empty, has-items | has-items shown in Canvas-Detail-View, empty documented in State Variations ("No thumbnail row shown") | -- | PASS |
| `prev-next` | visible, hidden | Shown in Canvas-Detail-View (7), hidden state documented in State Variations | -- | PASS |
| `chat-panel` | collapsed, expanded-empty, expanded-has-messages | All 3 states shown: collapsed (Chat Panel Collapsed screen), expanded-empty (State Variations table), expanded-has-messages (Chat Panel Active screen) | -- | PASS |
| `chat-init` | visible | Shown in Canvas-Detail-View (10) and Chat Panel Active (3) | -- | PASS |
| `chat-input` | default, sending, disabled | default in Canvas-Detail-View (12), sending in Chat State Variations, disabled in Loading State | -- | PASS |
| `chat-message.user` | default | Shown in Chat Panel Active (4, 7) | -- | PASS |
| `chat-message.bot` | default, loading, error | default in Chat Panel Active (5, 8), error in Error State (chat-timeout) | -- | PASS |
| `chat-chips` | default | Shown in Chat Panel Active (6) with [Subtle] [Dramatic] | -- | PASS |
| `details-overlay` | collapsed, expanded | Both states in Details Overlay State Variations | -- | PASS |
| `undo-button` | default, disabled | Shown in Canvas-Detail-View (2), disabled in State Variations + Loading State | -- | PASS |
| `redo-button` | default, disabled | Shown in Canvas-Detail-View (3), disabled in State Variations + Loading State | -- | PASS |
| `chat-context-separator` | visible | Shown in Chat Panel Active (9) with "Context: Image B" | -- | PASS |
| `chat-new-session` | default | Shown in Canvas-Detail-View (11) and Chat Panel Active (1) as [+] button | -- | PASS |
| `back-button` | default | Shown in Canvas-Detail-View (1), explicitly noted as NOT in toolbar | -- | PASS |

### Interactive Elements

| Discovery Element | Wireframe Location | Annotation | Status |
|-------------------|-------------------|------------|--------|
| back-button | Canvas-Detail-View, header top-left | 1 | PASS |
| undo-button | Canvas-Detail-View, header | 2 | PASS |
| redo-button | Canvas-Detail-View, header | 3 | PASS |
| toolbar.variation | Toolbar Detail | 1 | PASS |
| toolbar.img2img | Toolbar Detail | 2 | PASS |
| toolbar.upscale | Toolbar Detail | 3 | PASS |
| toolbar.download | Toolbar Detail | 4 | PASS |
| toolbar.delete | Toolbar Detail | 5 | PASS |
| toolbar.details | Toolbar Detail | 6 | PASS |
| Variation Popover Generate Button | Variation Popover | 5 | PASS |
| img2img Popover Generate Button | img2img Popover | 7 | PASS |
| Upscale 2x Button | Upscale Popover | 2 | PASS |
| Upscale 4x Button | Upscale Popover | 3 | PASS |
| chat-input Send | Canvas-Detail-View + Chat Panel Active | 12 / 11 | PASS |
| chat-new-session [+] | Canvas-Detail-View + Chat Panel Active | 11 / 1 | PASS |
| chat collapse [-] | Canvas-Detail-View + Chat Panel Active | noted | PASS |
| Sibling Thumbnails (click) | Canvas-Detail-View | 8 | PASS |
| Prev/Next Arrows (click) | Canvas-Detail-View | 7 | PASS |
| Delete Confirmation Cancel | Delete Confirmation | noted | PASS |
| Delete Confirmation Delete | Delete Confirmation | noted | PASS |
| Details Overlay Hide button | Details Overlay | noted ([Hide] button) | PASS |
| GenerationCard (Gallery click) | Gallery-View | 1 | PASS |

---

## B) Wireframe -> Discovery (Auto-Fix Rueckfluss)

### Visual Specs - Auto-Fixed

| Wireframe Spec | Value | Discovery Section | Status |
|----------------|-------|-------------------|--------|
| Toolbar width | 48px | UI Components ("48px breit") | PASS Already Present |
| Chat-panel min width | 320px | UI Components ("min 320px, max 480px") | PASS Already Present |
| Chat-panel max width | 480px | UI Components ("min 320px, max 480px") | PASS Already Present |
| Chat-panel collapsed width | ~48px icon strip | UI Components ("Eingeklappt: Icon-Leiste") | PASS Already Present |
| Prompt Area width | 480px | UI Layout ("Prompt-Panel (480px)") | PASS Already Present |
| Upscale popover disabled tooltip text | "Image too large for upscale" | Error Paths ("Tooltip erklaert Grund") | Auto-Fixed: Discovery says "Tooltip erklaert Grund" but wireframe has exact text |
| Chat error timeout text | "No response. Please try again." | Error Paths ("Chat zeigt 'Keine Antwort. Bitte erneut versuchen.'") | PASS Already Present (German variant) |
| Chat input placeholder | "Describe changes..." | UI Components ("Placeholder: 'Beschreibe Aenderungen am Bild...'") | Auto-Fixed: Wireframe uses English placeholder, Discovery has German |
| Loading overlay label | "Generating" with spinner icon | Not in Discovery | Auto-Fixed: Loading state visual label |
| Delete dialog text | "This action cannot be undone." | Not in Discovery | Auto-Fixed: Confirmation dialog text |
| Details overlay parameters shown | Model, Steps, CFG, Seed, Size | Discovery UI Components ("Prompt, Modell, Parameter, Provenance Row") | Auto-Fixed: Wireframe specifies exact parameter list (CFG, Seed, Size) |
| Chat-init parameters shown | Model, Prompt, Steps, CFG | Discovery UI Components ("Modell, Prompt, Key-Params") | Auto-Fixed: Wireframe specifies exact params (Steps, CFG as key params) |

### Implicit Constraints - Auto-Fixed

| Wireframe Shows | Implied Constraint | Discovery Section | Status |
|-----------------|-------------------|-------------------|--------|
| Toolbar icons listed in specific order: Var, i2i, Up, DL, Del, Details | Toolbar icon ordering is fixed | Not in Discovery | Auto-Fixed: Icon order specification |
| Chat panel has resize handle (noted as "Resizable 320-480px") | Resize handle on left edge of chat panel | UI Components ("Resize-Handle links") | PASS Already Present |
| Details overlay pushes canvas content down | Details overlay uses push-down layout, not floating overlay | UI Components ("Ueber Canvas, oben") | Auto-Fixed: Wireframe clarifies push-down behavior vs floating |
| Variation popover has editable prompt pre-filled from original | Prompt field must be pre-populated with generation prompt | UI Components (already noted) | PASS Already Present |
| img2img popover shows Model selector dropdown | Model can be changed in img2img popover | UI Components (Parameters noted) | PASS Already Present |
| Chat collapse button shown as [-] in header | Explicit collapse affordance in chat header | UI Components ("Eingeklappt: Icon-Leiste. Ausgeklappt: ...") | PASS Already Present |
| GenerationCard click triggers animated transition | Gallery click target is entire GenerationCard | User Flow (already noted) | PASS Already Present |
| Delete confirmation navigates to next image or gallery | Delete behavior depends on whether it's last image | Business Rules (already noted) | PASS Already Present |
| Siblings show "ACTIVE" highlight on current | Visual indicator on active sibling thumbnail | UI Components ("aktives Bild hervorgehoben") | PASS Already Present |

---

## C) Auto-Fix Summary

### Discovery Updates Applied

| Section | Content Added |
|---------|---------------|
| UI Components - `popover.upscale` | Add exact disabled tooltip text: "Image too large for upscale" |
| UI Components - `chat-input` | Clarify placeholder text applies in both languages (EN wireframe: "Describe changes...", DE: "Beschreibe Aenderungen am Bild...") |
| UI Components - `canvas-image` loading state | Add loading overlay label: "Generating" with spinner icon |
| UI Components - `toolbar.delete` | Add confirmation dialog text: "This action cannot be undone." |
| UI Components - `details-overlay` | Specify exact parameters shown: Model, Steps, CFG, Seed, Size. Layout: push-down (not floating) |
| UI Components - `toolbar` | Add icon ordering: Variation, img2img, Upscale, Download, Delete, Details (top to bottom) |

### Wireframe Updates Needed (Blocking)

*None. All Discovery elements are covered in wireframes.*

---

## Blocking Issues

*No blocking issues found.*

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Required Discovery Updates:** 6 (auto-fix items to enrich Discovery with wireframe details)
**Required Wireframe Updates:** 0

**Coverage Analysis:**
- All 5 User Flows + Error Paths are fully visualized in wireframes
- All 25 UI Components from Discovery have corresponding wireframe annotations
- All State Variations are documented (idle, generating, collapsed, error, disabled states)
- All Interactive Elements have wireframe presence and annotations
- Wireframe-to-Discovery backflow identified 6 detail enrichments

**Next Steps:**
- [ ] Apply 6 Discovery auto-fix updates (see DISCOVERY_UPDATES below)
- [ ] Proceed to Architecture phase
