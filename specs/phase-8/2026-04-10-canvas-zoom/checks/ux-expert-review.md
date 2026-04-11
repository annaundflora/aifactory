<!-- AGENT_DEF_LOADED: ux-expert-review-de-v1 -->

# UX Expert Review: Canvas Zoom & Pan

**Feature:** Canvas Zoom & Pan
**Discovery:** `discovery.md`
**Wireframes:** `wireframes.md`
**Reviewer:** UX Expert Agent
**Date:** 2026-04-07

---

## Summary

**Verdict:** CHANGES_REQUESTED

| ID | Title | Severity |
|----|-------|----------|
| F-1 | One-finger pan missing for zoomed-in idle state on touch | 🔴 Critical |
| F-2 | Zoom controls overlap with CanvasNavigation "next" button | 🟡 Improvement |
| F-3 | Keyboard shortcut conflict: +/- keys vs. existing mask brush shortcuts | 🟡 Improvement |
| F-4 | Space+Drag pan conflicts with mask painting in inpaint/erase mode | 🟡 Improvement |
| F-5 | Double-tap collision with drawing on touch during masking | 🟡 Improvement |
| F-6 | Missing mask data invalidation on zoom-reset at image change | 💡 Suggestion |
| F-7 | Zoom percent text not tappable -- missed quick-access opportunity | 💡 Suggestion |

**Totals:** 1 Critical, 4 Improvement, 2 Suggestion

**High-Level Assessment:** The concept is well-researched and follows established design-tool conventions (Figma, Procreate). The state machine is thorough and the Procreate-style stroke-undo is a strong design decision for tablet users. However, one critical gap in the touch interaction model and several interaction-layer conflicts need resolution before implementation.

---

## Workflow Analysis

### State Machine Reachability

The state machine covers five states: `fit`, `zoomed-in`, `zoomed-out`, `panning`, `gesture-active`. All states are reachable and have exit paths -- no dead ends.

**Positive observations:**
- Every state can reach `fit` (via Fit button, 0 key, or Double-Tap)
- `panning` and `gesture-active` are transient states with clear exit triggers
- The `ANY (masking) -> gesture-active` transition with automatic stroke undo is elegant

**Concern identified:** The `zoomed-in` state on touch devices has a significant interaction gap. See F-1.

### Flow Completeness

All 8 user flows are well-defined with clear entry/exit. Error paths for min/max zoom are handled (disabled buttons). Image-wechsel correctly resets state. The swipe-navigation guard (only at fit) prevents accidental navigation while zoomed.

---

## Findings

### Finding F-1: One-finger pan missing for zoomed-in idle state on touch

**Severity:** 🔴 Critical
**Category:** Workflow / Lücke

**Problem:**
On touch devices, when the user is zoomed in but NOT in a masking mode (editMode is null, "instruction", or "outpaint"), there is no way to pan with a single finger. The wireframe explicitly states:

> **Aus Wireframe (line 215-216):**
> ```
> 1 finger:
>   zoomed  = (no action)
> ```

This means a user who zoomed in with the zoom buttons (no second hand available, e.g., holding tablet with one hand) is stuck: they cannot navigate the zoomed image with one finger. Two-finger pan requires both hands or awkward grip repositioning.

Every image viewer and map application (Google Maps, Apple Photos, Safari) allows single-finger panning when zoomed. Users will instinctively try to drag with one finger and nothing will happen -- this breaks a deeply ingrained mental model.

> **Aus Discovery (line 108-109):**
> ```
> ### Flow 5: Touch Zwei-Finger-Pan
> 1. User bewegt zwei Finger parallel -> Bild verschiebt sich in Bewegungsrichtung
> ```

Only two-finger pan is specified. No one-finger pan flow exists.

**Impact:**
Users on iPads/tablets who zoom via buttons and want to pan to a specific area cannot do so with one finger. They must always use two fingers, which is unnatural for non-masking modes. This is the equivalent of removing scroll from a desktop browser.

**Recommendation:**
In non-masking modes (editMode null, "instruction", "outpaint"), one-finger drag on a zoomed image should pan. This matches every touch image viewer convention. The conflict only arises in masking modes (where one-finger = paint stroke), which is already correctly handled by the Procreate-style two-finger gesture.

Update the touch gesture table:
- `1 finger, zoomed, no mask mode` = pan
- `1 finger, zoomed, mask mode` = draw stroke (unchanged)

**Affects:**
- [x] Discovery change needed (Flow 5, Touch interactions, State machine)
- [x] Wireframe change needed (Touch interaction screen)

---

### Finding F-2: Zoom controls overlap with CanvasNavigation "next" button

**Severity:** 🟡 Improvement
**Category:** Usability / Layout

**Problem:**
The zoom controls panel is positioned "bottom-right" in the canvas area. The existing CanvasNavigation component places the "next" chevron button at `right-3 top-1/2` (vertically centered on the right edge of the canvas main area). At certain viewport heights, especially on smaller laptops or when the DetailsOverlay is expanded, the zoom panel's top edge will collide with the "next" navigation button.

> **Aus Discovery (line 135-143):**
> ```
> Position: Unten rechts im Canvas-Bereich (main area), floating
> ...
> Z-Index ueber Bild, unter Floating Brush Toolbar
> Nicht ueberlappend mit OutpaintControls oder DetailsOverlay
> ```

The discovery mentions non-overlap with OutpaintControls and DetailsOverlay, but does not mention CanvasNavigation.

> **Aus Codebase (canvas-navigation.tsx line 89):**
> ```
> className="absolute right-3 top-1/2 z-10 -translate-y-1/2 ..."
> ```

The nav button sits at `z-10`; zoom controls need to be between image (`z-10` for mask) and FloatingBrushToolbar (`z-30`). If both are at `z-10` or nearby, visual stacking could be ambiguous.

**Impact:**
Visual collision makes one or both controls harder to tap/click. On narrow viewports, the "next" button may be fully or partially hidden behind the zoom panel.

**Recommendation:**
Either:
(a) Offset the zoom panel to account for the navigation button (e.g., `right-14` or `right-16` to leave space), or
(b) Move zoom controls to bottom-center or bottom-left, or
(c) Add an explicit rule in discovery: "Zoom controls must have `>= 48px` clearance from CanvasNavigation buttons."

Also explicitly define the z-index layer for zoom controls relative to mask canvas (z-10), nav buttons (z-10), SAM overlay (z-20), and FloatingBrushToolbar (z-30).

**Affects:**
- [x] Wireframe change needed (positioning clarification)
- [x] Discovery change needed (z-index layer specification, non-overlap rule)

---

### Finding F-3: Keyboard shortcut conflict: +/- keys vs. existing mask brush shortcuts

**Severity:** 🟡 Improvement
**Category:** Inkonsistenz

**Problem:**
Discovery defines `+` and `-` as zoom keyboard shortcuts. However, the existing mask-canvas already uses `]` and `[` for brush size adjustment when in inpaint/erase mode. While these are different keys, the mental model is similar: `+/-` means "more/less" regardless of what's being controlled. A user in masking mode pressing `+` will zoom instead of expecting brush size increase.

More critically, Discovery states:

> **Aus Discovery (line 200):**
> ```
> Keyboard-Shortcuts nur aktiv wenn Maus/Fokus ueber Canvas-Bereich (nicht Chat-Panel)
> ```

But there is no specification of how `+/-` zoom shortcuts coexist with the masking keyboard shortcuts (`[`, `]`, `E`, `Ctrl+Z`). Should `+/-` zoom while in masking mode? If yes, the user loses the ability to zoom AND paint with keyboard alone (no conflict per se, but worth specifying). If no, zoom shortcuts are disabled during masking, which is also problematic.

**Impact:**
Without explicit precedence rules, implementation will be ambiguous. Either zoom shortcuts work during masking (potentially surprising) or they don't (limiting the workflow where keyboard zoom during masking is valuable).

**Recommendation:**
Add explicit business rule: "Zoom keyboard shortcuts (+/-/0) remain active in all edit modes, including masking. They do not conflict with brush shortcuts ([/]/E) since different keys are used." This removes ambiguity for implementation.

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed (explicit precedence rule for keyboard shortcuts)

---

### Finding F-4: Space+Drag pan conflicts with mask painting in inpaint/erase mode

**Severity:** 🟡 Improvement
**Category:** Usability / Interaction Conflict

**Problem:**
Discovery defines Space+Drag as the pan mechanism on desktop. However, during inpaint/erase mode, the pointer events are captured by the mask canvas (`pointer-events-auto` + `setPointerCapture`). The mask canvas currently captures all pointer-down events for drawing.

> **Aus Discovery (line 178):**
> ```
> zoomed-in | Space gedrueckt | Cursor -> Grab-Hand | panning | Nur Desktop
> ```

> **Aus Codebase (mask-canvas.tsx line 586):**
> ```
> className="pointer-events-auto absolute z-10 touch-none"
> ```

When a user holds Space and then drags over the mask canvas, the mask canvas will still receive the pointer-down event and start drawing a stroke instead of panning. The discovery does not define the interaction priority: does Space override masking input?

**Impact:**
Users in masking mode who want to pan to a different area of the zoomed image cannot use Space+Drag without accidentally painting a mask stroke. They would need to exit masking, pan, then re-enter masking -- a significant workflow disruption.

**Recommendation:**
Add explicit business rule: "When Space key is held, mask canvas ignores pointer events (treat as pan mode). Mask painting is suppressed until Space is released." This is how Photoshop and Procreate handle this -- Space temporarily activates the hand tool regardless of current tool.

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed (Space key precedence over mask painting)

---

### Finding F-5: Double-tap collision with drawing on touch during masking

**Severity:** 🟡 Improvement
**Category:** Usability / Interaction Conflict

**Problem:**
Double-tap toggles between Fit and 100%. But during masking on touch devices, a tap on the canvas starts a mask dot (pointer-down + pointer-up). Two quick taps would create two dots AND trigger a zoom toggle. This is a classic gesture disambiguation problem.

> **Aus Discovery (line 112-113):**
> ```
> ### Flow 6: Double-Tap
> 1. User doppelt-tippt auf Canvas -> Toggle zwischen Fit-Ansicht und 100%
> ```

There is no rule specifying whether double-tap is active/inactive during masking modes.

**Impact:**
During masking, every double-tap would simultaneously paint two dots on the mask and zoom the canvas -- an unpredictable, destructive interaction. Users will accidentally zoom while painting, or accidentally paint while trying to zoom.

**Recommendation:**
Add business rule: "Double-tap to toggle zoom is disabled when editMode is inpaint or erase (masking modes). User must use zoom buttons or pinch gesture instead." Alternatively, require double-tap only on the zoom controls panel or empty canvas area outside the image.

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed (double-tap disabled during masking)

---

### Finding F-6: Missing mask data invalidation on zoom-reset at image change

**Severity:** 💡 Suggestion
**Category:** Workflow

**Problem:**
Discovery specifies zoom reset on image change but does not address mask state. The existing codebase already blocks swipe navigation when `maskData !== null`, which is good. But it's worth explicitly stating: "Zoom-Reset bei Image-Wechsel does not affect maskData -- existing navigation lock (swipe + button disabled when maskData !== null) prevents this scenario."

> **Aus Discovery (line 198):**
> ```
> Zoom-Reset bei Image-Wechsel: Zurueck auf Fit, Pan auf (0,0)
> ```

> **Aus Codebase (canvas-detail-view.tsx line 215-216):**
> ```
> if (state.maskData !== null) {
>   touchStartXRef.current = null;
> ```

The navigation lock already prevents image changes during masking. But if a future change removes this lock, zoom-resetting while a mask exists could desync mask coordinates from the image.

**Impact:**
Low -- current codebase handles this correctly via navigation lock. This is a documentation/future-proofing concern.

**Recommendation:**
Add a note in Discovery under Business Rules: "Image-Wechsel is already blocked when maskData exists (existing navigation lock). No special mask handling needed for zoom-reset."

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed (documentation note)

---

### Finding F-7: Zoom percent text not tappable -- missed quick-access opportunity

**Severity:** 💡 Suggestion
**Category:** Usability

**Problem:**
The zoom percentage display is read-only. In many professional tools (Figma, Sketch, Illustrator), clicking the percentage opens a dropdown or input field to type an exact zoom level.

> **Aus Discovery (line 153):**
> ```
> Zoom-Prozent | Text | ... | Nur Anzeige, nicht klickbar
> ```

**Impact:**
Minor -- the feature works without this. But power users who want to jump to exactly 100% or 200% must click +/- multiple times or use keyboard shortcuts.

**Recommendation:**
Consider for V2: tapping the percentage text could cycle through preset zoom levels (50 -> 75 -> 100 -> 150 -> 200 -> 300 -> Fit -> repeat), or open a small popover with preset buttons. No change needed for V1.

**Affects:**
- [ ] Wireframe change needed
- [ ] Discovery change needed

---

## Positive Highlights

1. **Procreate-style stroke-undo** (Flow 7) is an excellent design decision. This is the industry standard for professional touch drawing apps and will make the iPad experience feel native and polished.

2. **Swipe navigation guard** (only at fit zoom) correctly prevents accidental image changes during zoomed work. This shows thoughtful consideration of gesture conflicts.

3. **Zoom anchor at cursor/finger position** is the correct behavior. Zooming to center-of-viewport (as many simpler implementations do) is disorienting -- this matches Figma, Maps, and Procreate conventions.

4. **Stufenloser (continuous) zoom for gestures** while maintaining discrete steps for buttons is the right balance between precision (buttons) and fluidity (gestures).

5. **Container-resize handling** (zoom level maintained, pan adjusted) correctly handles the chat panel toggle -- a subtle edge case that is often overlooked.

---

## Fachliche Bewertung (Strategic Assessment)

**Is this the right solution?** Yes. The problem is real and well-scoped. Users editing masks at the pixel level need zoom, and touch users expect pinch-to-zoom as a baseline interaction. The solution follows established conventions from Figma (Ctrl+Scroll, Space+Drag) and Procreate (stroke-undo on gesture) -- this is the right hybrid approach for a tool that serves both desktop and tablet users.

**Scope is appropriate.** Excluding rotation, minimap, and zoom persistence keeps V1 focused. The two-slice implementation plan (Desktop first, then Touch) is pragmatic -- Slice 1 is testable without a touch device.

**Risk:** The main implementation risk is the gesture disambiguation layer (Finding F-1, F-4, F-5). Multi-touch gesture handling alongside pointer-captured mask painting is complex. The Procreate-style stroke-undo (Flow 7) must be rock-solid or users will lose mask work. This deserves thorough manual QA on actual iPad hardware.

---

## Verdict

**CHANGES_REQUESTED**

**Rationale:** One critical finding (F-1: no single-finger pan on touch when zoomed and not masking) represents a fundamental interaction gap that would make the feature feel broken on tablets. Four improvement findings address interaction conflicts between zoom gestures and existing masking behavior that need explicit resolution before implementation to avoid ambiguity.

**Required before implementation:**
1. **F-1 (Critical):** Define one-finger pan behavior for zoomed-in non-masking modes on touch
2. **F-2 (Improvement):** Clarify zoom controls positioning relative to CanvasNavigation buttons
3. **F-3 (Improvement):** Add explicit keyboard shortcut coexistence rule
4. **F-4 (Improvement):** Define Space key precedence over mask painting
5. **F-5 (Improvement):** Define double-tap behavior during masking modes

**Suggestions (non-blocking):** F-6, F-7 -- address at your discretion.
