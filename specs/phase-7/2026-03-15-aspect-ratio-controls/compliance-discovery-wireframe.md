# Gate 0: Discovery <-> Wireframe Compliance

**Discovery:** `specs/phase-7/2026-03-15-aspect-ratio-controls/discovery.md`
**Wireframes:** `specs/phase-7/2026-03-15-aspect-ratio-controls/wireframes.md`
**Pruefdatum:** 2026-03-15

---

## Summary

| Status | Count |
|--------|-------|
| Pass | 18 |
| Auto-Fixed | 1 |
| Blocking | 0 |

**Verdict:** APPROVED

**100% Compliance:** Keine Warnings - alles wurde geprueft und ist abgedeckt oder auto-gefixt.

---

## A) Discovery -> Wireframe

### User Flow Coverage

| Discovery Flow | Steps | Wireframe Screens | Status |
|----------------|-------|-------------------|--------|
| Main Flow (txt2img/img2img): Mode -> Primary Controls -> Select Aspect Ratio -> Select Size -> Optional Advanced -> Generate | 6 | Prompt Panel (collapsed + expanded), Flow Diagram | Pass |
| Canvas Flow: Open Popover -> Configure -> Generate | 2 | Variation Popover, Img2img Popover | Pass |
| Error Path: Schema load failure -> graceful degradation | 1 | Prompt Panel `schema_error` state, Popovers `schema_empty` (identical behavior) | Pass |
| Error Path: Tier switch -> schema refetch -> invalid values reset | 1 | All 3 screens `tier_change` state + Flow Diagram | Pass |
| Error Path: No primary fields -> primary area empty | 1 | Prompt Panel `no_primary_fields` state | Pass |

### UI State Coverage

| Component | Discovery States | Wireframe States | Missing | Status |
|-----------|------------------|------------------|---------|--------|
| Prompt Panel | schema_loading, schema_ready, schema_empty, schema_error | schema_loading, schema_ready, schema_empty, schema_error, advanced_collapsed, advanced_expanded, tier_change, no_primary_fields, no_advanced_fields | -- | Pass |
| Variation Popover | schema_loading, schema_ready, schema_empty, schema_error | schema_loading, schema_ready, schema_empty, advanced_expanded, tier_change | schema_error (but behavior = schema_empty, which IS documented) | Pass |
| Img2img Popover | schema_loading, schema_ready, schema_empty, schema_error | schema_loading, schema_ready, schema_empty, advanced_expanded, tier_change | schema_error (but behavior = schema_empty, which IS documented) | Pass |

**Note on schema_error in Popovers:** Discovery line 156 explicitly states `schema_error` behavior is "Keine Controls (Schema-Fetch fehlgeschlagen)" which is identical to `schema_empty` ("Controls area absent"). Wireframe Prompt Panel line 150 confirms: "Same as schema_empty -- controls area absent, generation still possible without params." Since both Popovers document `schema_empty` with identical behavior, `schema_error` is effectively covered. Not blocking.

### Interactive Elements

| Discovery Element | Wireframe Location | Annotation | Status |
|-------------------|-------------------|------------|--------|
| Primary Controls (ParameterPanel filtered on whitelist) | Prompt Panel, Variation Popover, Img2img Popover | Prompt: (2)(3), Var: (2)(3), Img2img: (2)(3) | Pass |
| Advanced Toggle (Button/Link) | Prompt Panel, Variation Popover, Img2img Popover | Prompt: (4), Var: (4), Img2img: (4) | Pass |
| Advanced Controls (ParameterPanel non-primary) | Prompt Panel (expanded wireframe) | Prompt: (5)(6)(7) | Pass |
| TierToggle (existing, context) | All 3 screens | Prompt: (1), Var: (1), Img2img: (1) | Pass |

### Business Rules Visualization

| Discovery Business Rule | Wireframe Coverage | Status |
|------------------------|-------------------|--------|
| Primary Whitelist: aspect_ratio, megapixels, resolution | All 3 screens show exactly these as Primary Controls | Pass |
| Advanced = non-primary, non-internal schema properties | Prompt Panel expanded shows Quality, Background, Output Format (GPT Image 1.5 examples) | Pass |
| Dropdown grouping for >8 options (Common vs Extreme with separator) | Prompt Panel annotation (2) describes grouping: Common first, separator, then Extreme | Pass |
| Model-specific field visibility (megapixels for Flux, resolution for Nano Banana, neither for GPT) | Annotations on all screens describe conditional visibility | Pass |
| Advanced Toggle hidden if no advanced properties | Prompt Panel annotation (4): "Hidden if model has no advanced properties" | Pass |
| Upscale Mode shows no controls | Prompt Panel context: "Shown in txt2img and img2img modes only (not upscale)" | Pass |

---

## B) Wireframe -> Discovery (Auto-Fix Rueckfluss)

### Visual Specs

| Wireframe Spec | Value | Discovery Section | Status |
|----------------|-------|-------------------|--------|
| Skeleton loading rows | "3 rows: label + select placeholder" | UI Components & States (line 141: schema_loading state) | Auto-Fixed -- Discovery says "Skeleton Placeholders" but wireframe specifies "3 rows: label + select placeholder" |
| Controls position in Prompt Panel | Between TierToggle and Variant Count Stepper, inside `space-y-3` div | UI Layout & Context (line 111-112) | Already Present -- Discovery says "Bereich zwischen Tier Toggle / MaxQuality Toggle und Variant Count Stepper" |
| Controls position in Popovers | Between Tier Toggle and Generate Button | UI Layout & Context (lines 122, 132) | Already Present |
| Advanced expanded shows Quality/Background/Output Format | GPT Image 1.5 example params | Context & Research (line 262) | Already Present |
| Aspect Ratio default value | 1:1 shown in all wireframes | Data section (line 209) | Already Present |
| Megapixels default value | "1" shown in wireframes | Data section (line 210) | Already Present |
| Resolution default value | "2K" shown in Img2img wireframe | Data section (line 211) | Already Present |
| Common group values | 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3 | Data section (line 209) | Already Present |

### Implicit Constraints

| Wireframe Shows | Implied Constraint | Discovery Section | Status |
|-----------------|-------------------|-------------------|--------|
| Prompt Panel: MaxQualityToggle not shown in wireframe (but existing in codebase) | MaxQualityToggle is above new controls area in Prompt Panel | Current State Reference (line 60) | Already Present -- Discovery documents it as existing |
| Variation Popover: Strength dropdown above controls | prompt_strength is INTERNAL_FIELD, not rendered by ParameterPanel | Business Rules (line 178) | Already Present |
| Img2img Popover: References + Prompt fields above controls | Image input fields are INTERNAL_FIELDS | Business Rules (line 177) | Already Present |
| Advanced section uses collapsible container | Collapsible UI pattern for Advanced | UI Components & States (line 142-143) | Already Present |
| Popover becomes shorter when schema_empty | No placeholder/empty state indicator needed | Feature State Machine (line 155) | Already Present |

---

## C) Auto-Fix Summary

### Discovery Updates Needed

| Section | Content to Add |
|---------|---------------|
| UI Components & States > Primary Controls > `loading` state | Specify "3 skeleton rows (label + select placeholder each)" instead of generic "Skeleton" |

### Wireframe Updates Needed (Blocking)

None.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Required Discovery Updates:** 1 (auto-fix: skeleton detail)
**Required Wireframe Updates:** 0

**Next Steps:**
- [ ] Apply 1 Discovery auto-fix (skeleton loading detail)
- [ ] Proceed to Architecture phase
