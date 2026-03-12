# E2E Checklist: Multi-Image Referencing

**Integration Map:** `integration-map.md`
**Generated:** 2026-03-12

---

## Pre-Conditions

- [x] All slices APPROVED (Gate 2) -- 17/17 APPROVED
- [x] Architecture APPROVED (Gate 1)
- [x] Integration Map has no MISSING INPUTS -- 0 gaps

---

## Happy Path Tests

### Flow 1: Upload Reference Images and Assign Roles

1. [ ] **Slice 06:** Workspace loads with 480px prompt panel (wider than previous 320px)
2. [ ] **Slice 09:** Switch to img2img mode -- ReferenceBar appears between Model Card and prompt fields
3. [ ] **Slice 08:** ReferenceBar shows collapsed-empty state: "References (0)" with [+ Add] button
4. [ ] **Slice 08:** Click [+ Add] -- file dialog opens with accept filter (png, jpeg, webp)
5. [ ] **Slice 07:** Select a PNG file -- slot shows uploading state with spinner
6. [ ] **Slice 04/03:** Upload completes -- slot shows 80x80 thumbnail, "@1" label, "Content" role badge (blue), "Moderate" strength
7. [ ] **Slice 08:** ReferenceBar auto-expands and shows "[1/5]" counter
8. [ ] **Slice 07:** Change role dropdown to "Style" -- border color changes to violet, badge changes to "Style" in violet
9. [ ] **Slice 07:** Change strength dropdown to "Strong"
10. [ ] **Slice 08:** Add second image via [+ Add] -- new slot gets position @2, counter shows "[2/5]"
11. [ ] **Slice 08:** Add images until 5 slots filled -- [+ Add] button becomes disabled, no trailing dropzone

### Flow 2: Gallery Drag to Reference Slot

1. [ ] **Slice 14:** Gallery card has `draggable="true"` attribute
2. [ ] **Slice 14:** Start dragging a gallery card -- drag ghost appears
3. [ ] **Slice 14:** Drag over empty reference slot -- slot shows accent border with "Drop to add" text
4. [ ] **Slice 14:** Drop gallery card on slot -- `addGalleryAsReference` called (no R2 re-upload)
5. [ ] **Slice 05:** Slot shows gallery image thumbnail with default role "Content" and strength "Moderate"
6. [ ] **Slice 14:** Drag over filled slot -- no drop allowed (no visual feedback)

### Flow 3: Lightbox UseAsReference Button

1. [ ] **Slice 16:** Open lightbox for a generated image
2. [ ] **Slice 16:** "Als Referenz" button visible between Variation and img2img buttons
3. [ ] **Slice 16:** Click "Als Referenz" -- lightbox closes
4. [ ] **Slice 09:** PromptArea auto-switches to img2img mode if not already
5. [ ] **Slice 09:** Image appears in next free reference slot with role "Content", strength "Moderate"
6. [ ] **Slice 16:** With 5 slots filled, "Als Referenz" button is disabled with tooltip "Alle 5 Slots belegt"

### Flow 4: @-Token Inline Referencing

1. [ ] **Slice 10:** With references loaded, RefHintBanner appears below prompt fields: "Tipp: Nutze @1, @3 im Prompt..."
2. [ ] **Slice 10:** Dismiss banner -- localStorage `ref-hint-dismissed` set to "true"
3. [ ] **Slice 10:** Reload page -- banner stays dismissed
4. [ ] **Slice 12:** Type "@1" and "@3" in prompt -- tokens remain as plain text (V1)
5. [ ] **Slice 12:** On generate, @1 becomes @image1 and @3 becomes @image3 in API prompt
6. [ ] **Slice 12:** Reference guidance section appended with role and strength hints for all references

### Flow 5: Generate with Multi-Reference

1. [ ] **Slice 09:** Have 3 reference images loaded with different roles
2. [ ] **Slice 09:** Write prompt with @-tokens, click Generate
3. [ ] **Slice 13:** `composeMultiReferencePrompt()` builds enhanced prompt with @imageN mapping and guidance
4. [ ] **Slice 13:** `buildReplicateInput()` sends URL array sorted by slotPosition to Replicate API
5. [ ] **Slice 13:** Generation succeeds -- `generation_references` records created in DB (batch insert)
6. [ ] **Slice 13:** Gallery shows new generation with img2img badge

### Flow 6: Provenance in Lightbox

1. [ ] **Slice 15:** Open lightbox for a generation that used references
2. [ ] **Slice 15:** ProvenanceRow visible below details -- shows thumbnails with @-number, role, strength, color-coded
3. [ ] **Slice 15:** Open lightbox for a txt2img generation (no references) -- ProvenanceRow not visible
4. [ ] **Slice 15:** Toggle fullscreen -- ProvenanceRow hidden (inside detail panel)

### Flow 7: Mode Switch Preservation

1. [ ] **Slice 09:** In img2img mode, load 3 references with custom roles/strengths
2. [ ] **Slice 09:** Switch to txt2img -- ReferenceBar hidden but not destroyed
3. [ ] **Slice 09:** Switch back to img2img -- all 3 references preserved with correct roles/strengths
4. [ ] **Slice 09:** Switch to upscale and back -- references still preserved

### Flow 8: Sparse Slot Numbering

1. [ ] **Slice 08:** Add images to get @1, @2, @3
2. [ ] **Slice 08:** Remove @2 -- remaining slots stay @1 and @3 (no re-numbering), counter shows "[2/5]"
3. [ ] **Slice 08:** Add new image -- gets position @2 (lowest free), not @4
4. [ ] **Slice 10:** RefHintBanner updates dynamically to show current @-numbers

---

## Edge Cases

### Error Handling

- [ ] Upload a GIF file -- toast: "Nur PNG, JPG, JPEG und WebP erlaubt" (Slice 03)
- [ ] Upload a 15MB file -- toast: "Datei darf maximal 10MB gross sein" (Slice 03)
- [ ] Upload reference with invalid project ID -- error: "Ungueltige Projekt-ID" (Slice 04)
- [ ] Upload without file or URL -- error: "Datei oder URL erforderlich" (Slice 04)
- [ ] Gallery-as-reference with empty URL -- error: "Bild-URL erforderlich" (Slice 05)
- [ ] Gallery-as-reference with empty generationId -- error: "Generation-ID erforderlich" (Slice 05)
- [ ] Generate with references totaling > 9 MP -- error: "Gesamte Bildgroesse ueberschreitet API-Limit" (Slice 13)
- [ ] Generate with references totaling <= 9 MP -- no error, generation proceeds (Slice 13)
- [ ] All 5 slots full + attempt to add more -- toast: "Maximale Anzahl Referenzen erreicht (5)"

### Model Compatibility

- [ ] Model with `maxItems: 3` and 5 references loaded -- partial warning shows, slots @4/@5 dimmed (Slice 11)
- [ ] Model with no img2img support (`maxImageCount === 0`) -- no-support warning with "Switch to FLUX 2 Pro" link (Slice 11)
- [ ] Click "Switch to FLUX 2 Pro" -- `onSwitchModel` callback fires with correct model ID (Slice 11)
- [ ] No-support model -- Generate button disabled via `onGenerateDisabled(true)` (Slice 11)
- [ ] Switch to compatible model -- warning disappears, dimmed slots become ready (Slice 11)
- [ ] Model supports all loaded references -- no warning visible (Slice 11)

### State Transitions

- [ ] `collapsed-empty` -> Click Header -> `expanded` (Slice 08)
- [ ] `collapsed-filled` -> Click Header -> `expanded` (Slice 08)
- [ ] `expanded` -> Click Header -> `collapsed-*` (Slice 08)
- [ ] Slot `empty` -> DragEnter -> `drag-over` -> DragLeave -> `empty` (Slice 07)
- [ ] Slot `drag-over` -> Drop -> `uploading` -> complete -> `ready` (Slice 07)
- [ ] Slot `ready` -> Remove -> Slot removed (Slice 07/08)
- [ ] Slot `ready` -> Model change exceeds limit -> `dimmed` -> Model change back -> `ready` (Slice 11)

### Boundary Conditions

- [ ] 0 references + Generate -- generation runs without references (backwards compatible, Slice 13)
- [ ] 1 reference with role "Content" -- equivalent to classic img2img (Slice 13)
- [ ] @7 in prompt with only @1 reference -- @7 stays as plain text, not mapped (Slice 12)
- [ ] @1 @1 @1 in prompt -- all occurrences replaced with @image1 (Slice 12)
- [ ] Empty references array to `composeMultiReferencePrompt` -- prompt returned unchanged (Slice 12)
- [ ] Delete reference while in collapsed state -- counter updates correctly (Slice 08)

---

## Migration Tests

- [ ] Run `migrateSourceImages()` -- old generations with `sourceImageUrl` get `reference_images` + `generation_references` records (Slice 17)
- [ ] Migrated records have role "content", strength "moderate", slotPosition 1 (Slice 17)
- [ ] Run migration twice -- no duplicates (idempotent, Slice 17)
- [ ] `sourceImageUrl` column preserved (not deleted, Slice 17)
- [ ] Open lightbox for old migrated generation -- ProvenanceRow shows @1 Content Moderate (Slice 17 + Slice 15)

---

## Cross-Slice Integration Points

| # | Integration Point | Slices | How to Verify |
|---|-------------------|--------|---------------|
| 1 | Schema -> Queries | 01 -> 02 | Query functions import and use table definitions from schema.ts |
| 2 | Queries -> Service | 02 -> 03 | ReferenceService calls query functions for CRUD operations |
| 3 | Service -> Actions | 03 -> 04 | Server Actions delegate to ReferenceService methods |
| 4 | Actions -> UI | 04 -> 07 | ReferenceSlot calls uploadReferenceImage on file drop |
| 5 | Gallery Service -> Gallery Drag | 05 -> 14 | Gallery drop triggers addGalleryAsReference (DB-only, no R2) |
| 6 | Gallery Service -> Lightbox Button | 05 -> 16 | UseAsReference button calls addGalleryAsReference |
| 7 | Collapsible -> ReferenceBar | 06 -> 08 | ReferenceBar uses Collapsible for expand/collapse behavior |
| 8 | ReferenceSlot -> ReferenceBar | 07 -> 08 | ReferenceBar renders multiple ReferenceSlot components |
| 9 | ReferenceBar -> PromptArea | 08 -> 09 | PromptArea mounts ReferenceBar in img2img mode |
| 10 | PromptArea -> Hint Banner | 09 -> 10 | RefHintBanner receives referenceSlots for dynamic @-numbers |
| 11 | PromptArea -> Compatibility | 09 -> 11 | CompatibilityWarning receives slot count and positions |
| 12 | Token Mapping -> Generation | 12 -> 13 | buildReplicateInput calls composeMultiReferencePrompt |
| 13 | Generation -> Provenance | 13 -> 15 | generation_references records queried by ProvenanceRow |
| 14 | Workspace Context -> Lightbox | 09 -> 16 | addReference field consumed by PromptArea from Lightbox button |
| 15 | Generation -> Migration | 13 -> 17 | Migration creates records in same schema as generation flow |

---

## Sign-Off

| Tester | Date | Result |
|--------|------|--------|
| | | |

**Notes:**
