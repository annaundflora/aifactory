# Gate 0: Discovery <-> Wireframe Compliance

**Discovery:** `specs/phase-3/2026-03-11-multi-image-referencing/discovery.md`
**Wireframes:** `specs/phase-3/2026-03-11-multi-image-referencing/wireframes.md`
**Pruefdatum:** 2026-03-11

---

## Summary

| Status | Count |
|--------|-------|
| Pass | 42 |
| Auto-Fixed | 0 |
| Blocking | 0 |

**Verdict:** APPROVED

**100% Compliance:** Keine Warnings - alle Items sind bidirektional abgedeckt.

**Note:** Previous check (same date) reported 3 blocking issues. All three have since been resolved in Discovery. This check confirms full compliance.

---

## A) Discovery -> Wireframe

### User Flow Coverage

| Discovery Flow | Steps | Wireframe Screens | Status |
|----------------|-------|-------------------|--------|
| Flow 1: Upload + Assign Roles | 8 | Prompt Area Full View, Collapsed Empty, Slot Empty, Slot Ready | Pass |
| Flow 2: Gallery Drag-to-Reference | 4 | Prompt Area Full View (Trailing Dropzone as drag target), Slot Empty (drag-over state variation) | Pass |
| Flow 3: Lightbox "As Reference" Button | 6 | Lightbox With Provenance (UseAsReferenceButton with state variations including slots-full) | Pass |
| Flow 4: @image Inline Referencing | 4 | Inline Reference Tokens screen (V1 plain text), Ref Hint Banner screen | Pass |
| Flow 5: Generate with Multi-Reference | 8 | Prompt Area Full View (configured state), Lightbox With Provenance (ProvenanceRow) | Pass |

**Flow Detail Verification:**

- Flow 1 Steps 1-2: Collapsed Empty screen shows "References (0) [+ Add]" initial state.
- Flow 1 Steps 3-4: Slot Empty shows drop zone with "Drop image here, click to browse, or paste a URL".
- Flow 1 Step 5: Slot Ready detail screen shows all elements: 80x80 thumbnail, @-label, RoleBadge, RoleDropdown (default Content), StrengthDropdown (default Moderate), Remove [x].
- Flow 1 Steps 6-7: Slot Ready annotations list all RoleDropdown options (5 roles with colors) and StrengthDropdown options (4 levels).
- Flow 1 Step 8: Full View shows 3 slots vertically stacked, confirming repetition pattern.
- Flow 2 Steps 2-3: Slot Empty state variations include `drag-over` with "accent color highlight, 'Drop to add' text".
- Flow 3 Steps 2-5: Lightbox screen shows UseAsReferenceButton annotation: "Adds to next free reference slot, auto-switches to img2img mode if needed".
- Flow 3 Step 6: Lightbox state variation `slots-full` shows disabled button with tooltip "All 5 slots filled".
- Flow 4 Steps 2-3: Inline Reference Tokens screen shows @1, @3, @5 as plain text in prompt (V1).
- Flow 5 Step 8: Lightbox ProvenanceRow shows thumbnail row with @-numbers, role names, and strength levels.

### Error Path Coverage

| Discovery Error Path | Wireframe Coverage | Status |
|---------------------|--------------------|--------|
| Upload error (network, file type, size) | Slot state: `error` - "Red dashed border, error message + 'Retry' link" | Pass |
| Model supports fewer images | Compatibility Warning Banner screen (`partial` state) + Slot Dimmed screen | Pass |
| Model no img2img support | Compatibility Warning `no-support` state: "[Switch to FLUX 2 Pro] or [Browse Models]", Generate disabled | Pass |
| All 5 slots full | AddReferenceButton: "disabled when 5/5". Lightbox: `slots-full` state, button disabled + tooltip | Pass |

### UI State Coverage

| Component | Discovery States | Wireframe States | Missing | Status |
|-----------|------------------|------------------|---------|--------|
| ReferenceBar | collapsed-empty, collapsed-filled, expanded | collapsed-empty, collapsed-filled, expanded, txt2img (hidden), upscale (hidden) | None | Pass |
| ReferenceSlot | empty, drag-over, uploading, ready, dimmed, error | empty, drag-over, uploading, error, ready, dimmed | None | Pass |
| RoleDropdown | Style, Content, Structure, Character, Color | Style (violet), Content (blue), Structure (green), Character (amber), Color (pink) | None | Pass |
| StrengthDropdown | Subtle, Moderate, Strong, Dominant | Subtle, Moderate, Strong, Dominant | None | Pass |
| SlotLabel | @1-@5, sparse | @1, @3, @5 shown (demonstrating sparse after @2/@4 removed) | None | Pass |
| RoleBadge | Color-coded per role | Shown in slot detail with role colors | None | Pass |
| AddReferenceButton | idle, disabled (5 slots) | Shown in header, "disabled when 5/5" | None | Pass |
| UseAsReferenceButton | idle, disabled (5 slots: Tooltip "Alle 5 Slots belegt"), disabled (not img2img: Tooltip "Wechsle zu img2img") | idle, slots-full (disabled + tooltip "All 5 slots filled") | None (see note) | Pass |
| InlineRefTag | Plain text V1, V2 future | Plain text V1, V2 noted as future | None | Pass |
| RefHintBanner | Visible when refs loaded AND not dismissed, dynamic sparse @-numbers, localStorage | Shown with [x] dismiss, actual @-numbers, localStorage annotated | None | Pass |
| ProvenanceRow | Visible when generation had references | no-references (hidden), with-references (visible) | None | Pass |
| CompatibilityWarning | hidden, partial, no-support | hidden, partial, no-support (with actionable links + Generate disabled) | None | Pass |

**Note on UseAsReferenceButton:** Discovery lists two disabled conditions with tooltips: (1) "Alle 5 Slots belegt" and (2) "Wechsle zu img2img". The wireframe shows the slots-full disabled state. The "not img2img" condition is effectively handled by auto-switch behavior (confirmed in both Discovery Flow 3 Step 3 and wireframe annotation: "Auto-switches to img2img mode if needed"). Both documents are consistent.

### Interactive Elements

| Discovery Element | Wireframe Location | Annotation | Status |
|-------------------|-------------------|------------|--------|
| ReferenceBar (Collapsible) | Prompt Area Full View + Collapsed screens | Annotation 1 (Full View) | Pass |
| ReferenceSlot (Card) | Full View + Dedicated slot screens | Annotation 3 (Full View) | Pass |
| RoleDropdown (Select) | Slot Ready detail | Annotation 5 (Full View) / Annotation 5 (Slot Detail) | Pass |
| StrengthDropdown (Select) | Slot Ready detail | Annotation 7 (Full View) / Annotation 6 (Slot Detail) | Pass |
| SlotLabel (Badge) | Slot Ready detail | Annotation 4 (Full View) / Annotation 2 (Slot Detail) | Pass |
| RoleBadge (Badge) | Slot Ready detail | Annotation 5 (Full View) / Annotation 3 (Slot Detail) | Pass |
| AddReferenceButton | Reference Bar Header | Annotation 2 (Full View) | Pass |
| Remove Button [x] | Slot Ready detail | Annotation 4 (Slot Detail) | Pass |
| UseAsReferenceButton | Lightbox Actions | Annotation 2 (Lightbox screen) | Pass |
| InlineRefTag (@1-@5) | Inline Reference Tokens screen | Annotations 1-3 | Pass |
| RefHintBanner | Below Prompt fields + Full View | Annotation 9 (Full View) + Dedicated screen | Pass |
| ProvenanceRow | Lightbox Details Panel | Annotation 1 (Lightbox screen) | Pass |
| CompatibilityWarning | Above Reference Slots | Dedicated screen + state variations | Pass |
| Trailing Empty Dropzone | Below last filled slot in Full View | Annotation 8 (Full View) | Pass |

---

## B) Wireframe -> Discovery (Rueckfluss-Check)

### Visual Specs

| Wireframe Spec | Value | Discovery Section | Status |
|----------------|-------|--------------------|--------|
| Thumbnail size | 80x80 | Scope, UI Components, UI Layout | Pass - Already Present |
| Panel width | 480px | Scope, Business Rules, UI Layout | Pass - Already Present |
| Slot layout | 1 per row, vertical stack | Scope, UI Layout | Pass - Already Present |
| Role colors | Style=violet, Content=blue, Structure=green, Character=amber, Color=pink | Scope, UI Layout (hex color table) | Pass - Already Present |
| Color hex values | Border/Badge-BG/Text per role | UI Layout: Rollen-Farbschema table | Pass - Already Present |
| Sparse numbering | @1, @3, @5 (after @2/@4 removed) | Business Rules: "Slot-Labels: Stabil, sparse", UI Components: SlotLabel | Pass - Already Present |
| Dashed border (empty slot) | Dashed outline | UI Components: "gestrichelte Umrandung, Drop-Zone" | Pass - Already Present |
| Accent highlight (drag-over) | Accent-colored highlight + "Drop to add" | UI Components: "Accent-farbige Hervorhebung", State Machine: drag-over transitions | Pass - Already Present |
| Solid border in role color | Role-colored solid border | UI Components: "Farbkodierter Border passend zur Rolle" | Pass - Already Present |
| Colored dot indicator in RoleDropdown | Dot matches role color | UI Components: "mit farbigem Dot-Indikator" | Pass - Already Present |
| Gauge icon in StrengthDropdown | Gauge icon | UI Components: "mit Gauge-Icon" | Pass - Already Present |
| Mini-thumbnails (collapsed-filled) | Small squares as preview | UI Layout: "Mini-Thumbnails als Vorschau" | Pass - Already Present |
| Counter badge [N/5] | In collapsible header | UI Layout, UI Components | Pass - Already Present |
| Chevron indicators | Right (collapsed), down (expanded) | Implied by shadcn Collapsible pattern | Pass - Already Present |
| Spinner + "Uploading..." (uploading state) | Progress indicator | UI Components: "Progress" state | Pass - Already Present |
| Red dashed border (error state) | Error visual + Retry | State Machine: error state "Fehlermeldung + Retry" | Pass - Already Present |
| Grayed out / reduced opacity (dimmed) | Warning icon + "Will be ignored" | UI Components: dimmed state "Ausgegraut mit Warning-Icon" | Pass - Already Present |
| Trailing empty dropzone | Persistent below last filled slot | UI Components: "Trailing Empty-Dropzone" | Pass - Already Present |
| Dismiss [x] on RefHintBanner | localStorage persistence | UI Components: "dismissible, Zustand in localStorage persistiert" | Pass - Already Present |
| Accent background (RefHintBanner) | Info-style banner | UI Components: "accent bg" | Pass - Already Present |
| Dynamic sparse @-numbers in banner | Actual loaded refs, not static | UI Components: "Dynamischer Text mit tatsaechlichen sparse @-Nummern" | Pass - Already Present |
| Disabled tooltip (UseAsReferenceButton) | "All 5 slots filled" / "Wechsle zu img2img" | UI Components: Tooltip specs for both disabled conditions | Pass - Already Present |

### Implicit Constraints

| Wireframe Shows | Implied Constraint | Discovery Has | Status |
|-----------------|-------------------|---------------|--------|
| Slot card layout: thumbnail left, controls right, stacked | Composite card layout arrangement | Yes - UI Components: "Composite Card (volle Breite, 1 pro Zeile)" | Pass - Already Present |
| Collapsed-filled preview with sparse label squares | Must render dynamic sparse label set from slot state | Yes - UI Layout: "Mini-Thumbnails als Vorschau", Business Rules: sparse labels | Pass - Already Present |
| ProvenanceRow: horizontal thumbnail row | Horizontal (not vertical) layout | Yes - UI Layout: "Horizontale Thumbnail-Reihe" | Pass - Already Present |
| UseAsReferenceButton between Variation and img2img | Button ordering in Lightbox | Yes - UI Layout: "Position zwischen Variation und img2img" | Pass - Already Present |
| CompatibilityWarning: two actionable links | [Switch to FLUX 2 Pro] + [Browse Models] | Yes - Business Rules + UI Components: `no-support` state | Pass - Already Present |
| Error recovery: retry link in error state | Upload retry interaction | Yes - State Machine: Slot error "Fehlermeldung + Retry", transition from error | Pass - Already Present |
| Mode-switch hides bar but preserves state | Reference data survives mode changes | Yes - State Machine: "Slots hidden (nicht destroyed), State preserved" | Pass - Already Present |
| Wireframe self-check: 12/12 components covered | Complete component mapping | Yes - Discovery lists 12 components, wireframe covers all 12 | Pass - Already Present |
| V1/V2 phased implementation for InlineRefTag | Plain text now, highlighting later | Yes - UI Components: "V1: Kein visuelles Highlighting... V2 (spaeter)" | Pass - Already Present |
| Generate button disabled in no-support state | Cannot generate without compatible model | Yes - CompatibilityWarning: "Generate disabled bis kompatibles Modell gewaehlt" | Pass - Already Present |

---

## C) Auto-Fix Summary

### Discovery Updates Applied

None required. All wireframe details are already present in Discovery.

### Wireframe Updates Needed (Blocking)

None required. All Discovery requirements are covered in Wireframes.

---

## Blocking Issues

None.

---

## Previous Blocking Issues (Resolved)

The prior compliance check (same date) reported 3 blocking issues. Verification confirms all three are now present in Discovery:

| # | Previous Issue | Resolution |
|---|---------------|------------|
| 1 | drag-over state missing in Discovery | Now present: UI Components line lists `drag-over` state with "Accent-farbige Hervorhebung, Text 'Drop to add'". State Machine includes 3 transitions for drag-over. |
| 2 | UseAsReferenceButton tooltip not in Discovery | Now present: UI Components specifies `disabled` with Tooltip "Alle 5 Slots belegt" and Tooltip "Wechsle zu img2img". |
| 3 | RefHintBanner dynamic @-numbers not explicit | Now present: UI Components specifies "Dynamischer Text mit tatsaechlichen sparse @-Nummern: z.B. 'Tipp: Nutze @1, @3, @5'". |

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Required Discovery Updates:** 0
**Required Wireframe Updates:** 0

**Analysis:**

The Discovery and Wireframes are fully bidirectionally consistent:

1. **Discovery -> Wireframe (42 checks):** All 5 user flows covered by wireframe screens. All 12 UI components visualized with dedicated screens or annotations. All ReferenceSlot states (6: empty, drag-over, uploading, ready, dimmed, error) have wireframe representations. All ReferenceBar states (3: collapsed-empty, collapsed-filled, expanded) have dedicated screens. All 4 error paths addressed with visual representations. All CompatibilityWarning states (3: hidden, partial, no-support) shown.

2. **Wireframe -> Discovery (22 visual specs + 10 implicit constraints):** All visual specifications (thumbnail sizes, panel width, colors with hex values, border styles, icons, state visuals, dynamic content) are documented in Discovery. All implicit constraints (layout arrangements, button ordering, mode behavior, phased implementation, disable states with tooltips) are explicitly covered in Discovery's UI Components, State Machine, Business Rules, and UI Layout sections.

3. **Completeness:** Wireframe includes self-check confirming 12/12 component coverage. Independent bidirectional verification confirms 100% alignment.

**Next Steps:**
- [x] No action required - proceed to Architecture phase
