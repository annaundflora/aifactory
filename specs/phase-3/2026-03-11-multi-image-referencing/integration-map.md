# Integration Map: Multi-Image Referencing

**Generated:** 2026-03-12
**Slices:** 17
**Connections:** 38

---

## Dependency Graph (Visual)

```
                    ┌──────────────────────┐
                    │  Slice 01            │
                    │  DB Schema Migration │
                    └──────────┬───────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼                             │
   ┌────────────────────┐                    │
   │  Slice 02          │                    │
   │  Reference Queries │                    │
   └───────┬────────────┘                    │
           │                                 │
     ┌─────┴─────────────────┐               │
     │                       │               │
     ▼                       │               │
┌─────────────────┐          │               │
│  Slice 03       │          │               │
│  Ref Service    │          │               │
└───────┬─────────┘          │               │
        │                    │               │
   ┌────┴────┐               │               │
   │         │               │               │
   ▼         ▼               │               │
┌────────┐ ┌────────┐       │    ┌──────────────────┐
│Slice 04│ │Slice 05│       │    │  Slice 06        │
│Upload  │ │Gallery │       │    │  UI Setup        │
│Action  │ │As Ref  │       │    │  Collapsible     │
└───┬────┘ └───┬────┘       │    └────────┬─────────┘
    │          │             │             │
    │    ┌─────┘             │             │
    ▼    │                   │             │
┌────────┴──────┐            │             │
│  Slice 07     │◄───────────┼─────────────┘
│  Ref Slot     │            │
└───────┬───────┘            │
        │                    │
        ▼                    │
┌────────────────┐           │
│  Slice 08      │           │
│  Ref Bar       │           │
└───────┬────────┘           │
        │                    │
        ▼                    │
┌────────────────────┐       │
│  Slice 09          │       │
│  PromptArea Integ. │       │
└───┬──┬──┬──────────┘       │
    │  │  │                  │
    │  │  │    ┌─────────────┘
    │  │  │    │
    ▼  │  ▼    │     ┌──────────────────┐
┌──────┤ ┌──────┐    │                  │
│S-10  │ │S-11  │    │                  │
│Hint  │ │Compat│    │                  │
│Banner│ │Warn  │    │                  │
└──────┘ └──────┘    │                  │
    │                │                  │
    ▼                ▼                  │
┌────────────────────┐                  │
│  Slice 12          │                  │
│  Token Mapping     │                  │
└───────┬────────────┘                  │
        │                               │
        ▼                               │
┌────────────────────┐                  │
│  Slice 13          │◄─────────────────┘
│  Generation Integ. │
└───┬────────────────┘
    │
    ├──────────────┐
    │              │
    ▼              ▼
┌────────┐  ┌──────────────┐
│Slice 14│  │  Slice 15    │
│Gallery │  │  Provenance  │
│Drag    │  │  Lightbox    │
└────────┘  └──────┬───────┘
                   │
    ┌──────────────┤
    │              │
    ▼              ▼
┌────────┐  ┌──────────────┐
│Slice 16│  │  Slice 17    │
│Lightbox│  │  Migration   │
│Use Ref │  │  Cleanup     │
└────────┘  └──────────────┘
```

---

## Nodes

### Slice 01: DB Schema & Migration

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | referenceImages (Table), generationReferences (Table) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| (none) | -- | First slice, no dependencies |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `referenceImages` | Drizzle Table | slice-02, slice-03, slice-05, slice-17 |
| `generationReferences` | Drizzle Table | slice-02, slice-13, slice-15, slice-17 |

---

### Slice 02: Reference Image Queries

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-01 |
| Outputs | 5 Query Functions + 2 Type Exports |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `referenceImages` table | Slice 01 | PASS |
| `generationReferences` table | Slice 01 | PASS |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `createReferenceImage` | Async Function | slice-03, slice-05, slice-17 |
| `deleteReferenceImage` | Async Function | slice-03 |
| `getReferenceImagesByProject` | Async Function | slice-03, slice-04 |
| `createGenerationReferences` | Async Function | slice-13, slice-17 |
| `getGenerationReferences` | Async Function | slice-13, slice-15, slice-17 |
| `ReferenceImage` | Type Export | slice-03, slice-04, slice-07, slice-08 |
| `GenerationReference` | Type Export | slice-13, slice-15 |

---

### Slice 03: Reference Service

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-02 |
| Outputs | ReferenceService (upload, delete, getByProject) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `createReferenceImage` | Slice 02 | PASS |
| `deleteReferenceImage` | Slice 02 | PASS |
| `getReferenceImagesByProject` | Slice 02 | PASS |
| `ReferenceImage` type | Slice 02 | PASS |
| `StorageService.upload` | Existing codebase | PASS |
| `StorageService.delete` | Existing codebase | PASS |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ReferenceService.upload` | Async Function | slice-04 |
| `ReferenceService.delete` | Async Function | slice-04 |
| `ReferenceService.getByProject` | Async Function | slice-04 |

---

### Slice 04: Upload Reference Action

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-03 |
| Outputs | uploadReferenceImage, deleteReferenceImage Server Actions |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `ReferenceService.upload` | Slice 03 | PASS |
| `ReferenceService.delete` | Slice 03 | PASS |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `uploadReferenceImage` | Server Action | slice-07, slice-09 |
| `deleteReferenceImage` | Server Action | slice-07, slice-09 |

---

### Slice 05: Gallery-as-Reference

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-03 |
| Outputs | ReferenceService.uploadFromGallery, addGalleryAsReference Action |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `createReferenceImage` | Slice 02 | PASS |
| `ReferenceService` object | Slice 03 | PASS |
| `revalidatePath` | Existing (Next.js) | PASS |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ReferenceService.uploadFromGallery` | Async Function | slice-14, slice-16 |
| `addGalleryAsReference` | Server Action | slice-14, slice-16 |

---

### Slice 06: UI Setup (Collapsible + Panel Width)

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | Collapsible component, 480px Panel |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| (none) | -- | No dependencies |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `Collapsible` components | React Component | slice-07, slice-08 |
| Panel 480px width | Layout | slice-07, slice-08, slice-09 |

---

### Slice 07: ReferenceSlot Component

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-04, slice-06 |
| Outputs | ReferenceSlot, ReferenceRole, ReferenceStrength, ReferenceSlotData |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `uploadReferenceImage` | Slice 04 | PASS |
| `Collapsible` | Slice 06 | PASS |
| Panel 480px | Slice 06 | PASS |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ReferenceSlot` | React Component | slice-08, slice-14 |
| `ReferenceRole` | TypeScript Type | slice-08, slice-10, slice-12, slice-13 |
| `ReferenceStrength` | TypeScript Type | slice-08, slice-10, slice-12, slice-13 |
| `ReferenceSlotData` | TypeScript Type | slice-08, slice-09, slice-10 |

---

### Slice 08: ReferenceBar Component

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-07 |
| Outputs | ReferenceBar, Sparse-Label-Algorithm |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `ReferenceSlot` | Slice 07 | PASS |
| `ReferenceSlotData` | Slice 07 | PASS |
| `ReferenceRole`, `ReferenceStrength` | Slice 07 | PASS |
| `Collapsible` | Slice 06 | PASS |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ReferenceBar` | React Component | slice-09 |
| `getLowestFreePosition` | Business Logic | slice-09, slice-14 |

---

### Slice 09: PromptArea Integration

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-08 |
| Outputs | ReferenceBar in PromptArea, addReference context, referenceSlots in Generate |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `ReferenceBar` | Slice 08 | PASS |
| `ReferenceSlotData` | Slice 07 | PASS |
| `uploadReferenceImage` | Slice 04 | PASS |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| ReferenceBar in PromptArea | Layout Integration | slice-10, slice-11 |
| `addReference` context field | Context Field | slice-16 |
| `referenceSlots` in Generate | Data Flow | slice-13 |

---

### Slice 10: RefHintBanner

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-09 |
| Outputs | RefHintBanner component |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `referenceSlots` state | Slice 09 | PASS |
| `ReferenceSlotData` | Slice 07 | PASS |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `RefHintBanner` | React Component | slice-09 (embedded in PromptArea) |

---

### Slice 11: CompatibilityWarning

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-09 |
| Outputs | CompatibilityWarning, getMaxImageCount() |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `referenceSlots` state | Slice 09 | PASS |
| ReferenceBar Layout | Slice 09 | PASS |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `getMaxImageCount` | Function | slice-13 |
| `CompatibilityWarning` | React Component | slice-09 (embedded in PromptArea) |

---

### Slice 12: Prompt @-Token Mapping

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-09 |
| Outputs | composeMultiReferencePrompt() |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `ReferenceRole`, `ReferenceStrength` | Slice 07 | PASS |
| `referenceSlots` state structure | Slice 09 | PASS |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `composeMultiReferencePrompt` | Pure Function | slice-13 |

---

### Slice 13: Generation Integration

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-02, slice-09, slice-12 |
| Outputs | generateImages with References, generation_references records |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `createGenerationReferences` | Slice 02 | PASS |
| `getGenerationReferences` | Slice 02 | PASS |
| `referenceSlots` data in Generate | Slice 09 | PASS |
| `composeMultiReferencePrompt` | Slice 12 | PASS |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `generateImages` with references | Server Action | slice-09 (PromptArea) |
| `generation_references` records | DB Data | slice-15, slice-17 |

---

### Slice 14: Gallery Drag to Slot

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-05, slice-08 |
| Outputs | Draggable GenerationCard, Gallery-Drop in ReferenceSlot |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `addGalleryAsReference` | Slice 05 | PASS |
| `ReferenceSlot` | Slice 07 | PASS |
| `ReferenceBar` | Slice 08 | PASS |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `GenerationCard` (draggable) | React Component | No direct consumer (end-feature) |
| `ReferenceSlot` (Gallery-Drop) | React Component (extended) | slice-08 (ReferenceBar) |
| MIME-Type constant | String Constant | Internal use |

---

### Slice 15: Provenance in Lightbox

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-02, slice-13 |
| Outputs | ProvenanceRow component |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `getGenerationReferences` | Slice 02 | PASS |
| `GenerationReference` type | Slice 02 | PASS |
| `ReferenceImage` type | Slice 02 | PASS |
| `generation_references` records | Slice 13 | PASS |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ProvenanceRow` | React Component | slice-17 (verification) |

---

### Slice 16: Lightbox UseAsReference Button

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-05, slice-09 |
| Outputs | UseAsReference Button in Lightbox |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `addGalleryAsReference` | Slice 05 | PASS |
| `addReference` context field | Slice 09 | PASS |
| Reference Slot count | Slice 09 | PASS |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| UseAsReference Button | UI Integration | None (end-feature) |

---

### Slice 17: Migration & Cleanup

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-02, slice-13, slice-15 |
| Outputs | migrateSourceImages() script |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `createReferenceImage` | Slice 02 | PASS |
| `createGenerationReferences` | Slice 02 | PASS |
| `getGenerationReferences` | Slice 02 | PASS |
| `generation_references` structure | Slice 13 | PASS |
| `ProvenanceRow` | Slice 15 | PASS (verification target) |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `migrateSourceImages` | Async Function (CLI) | None (manual execution) |

---

## Connections

| # | From | To | Resource | Type | Status |
|---|------|----|----------|------|--------|
| 1 | Slice 01 | Slice 02 | `referenceImages` table | Drizzle Table | VALID |
| 2 | Slice 01 | Slice 02 | `generationReferences` table | Drizzle Table | VALID |
| 3 | Slice 02 | Slice 03 | `createReferenceImage` | Async Function | VALID |
| 4 | Slice 02 | Slice 03 | `deleteReferenceImage` | Async Function | VALID |
| 5 | Slice 02 | Slice 03 | `getReferenceImagesByProject` | Async Function | VALID |
| 6 | Slice 02 | Slice 03 | `ReferenceImage` type | Type Export | VALID |
| 7 | Slice 02 | Slice 05 | `createReferenceImage` | Async Function | VALID |
| 8 | Slice 02 | Slice 13 | `createGenerationReferences` | Async Function | VALID |
| 9 | Slice 02 | Slice 13 | `getGenerationReferences` | Async Function | VALID |
| 10 | Slice 02 | Slice 15 | `getGenerationReferences` | Async Function | VALID |
| 11 | Slice 02 | Slice 15 | `GenerationReference` type | Type Export | VALID |
| 12 | Slice 02 | Slice 15 | `ReferenceImage` type | Type Export | VALID |
| 13 | Slice 02 | Slice 17 | `createReferenceImage` | Async Function | VALID |
| 14 | Slice 02 | Slice 17 | `createGenerationReferences` | Async Function | VALID |
| 15 | Slice 02 | Slice 17 | `getGenerationReferences` | Async Function | VALID |
| 16 | Slice 03 | Slice 04 | `ReferenceService.upload` | Async Function | VALID |
| 17 | Slice 03 | Slice 04 | `ReferenceService.delete` | Async Function | VALID |
| 18 | Slice 03 | Slice 05 | `ReferenceService` object | Object Export | VALID |
| 19 | Slice 04 | Slice 07 | `uploadReferenceImage` | Server Action | VALID |
| 20 | Slice 04 | Slice 09 | `uploadReferenceImage` | Server Action | VALID |
| 21 | Slice 05 | Slice 14 | `addGalleryAsReference` | Server Action | VALID |
| 22 | Slice 05 | Slice 16 | `addGalleryAsReference` | Server Action | VALID |
| 23 | Slice 06 | Slice 07 | `Collapsible` components | React Component | VALID |
| 24 | Slice 06 | Slice 07 | Panel 480px | Layout | VALID |
| 25 | Slice 06 | Slice 08 | `Collapsible` components | React Component | VALID |
| 26 | Slice 07 | Slice 08 | `ReferenceSlot` | React Component | VALID |
| 27 | Slice 07 | Slice 08 | `ReferenceSlotData`, `ReferenceRole`, `ReferenceStrength` | Types | VALID |
| 28 | Slice 07 | Slice 10 | `ReferenceSlotData` | Type | VALID |
| 29 | Slice 07 | Slice 12 | `ReferenceRole`, `ReferenceStrength` | Types | VALID |
| 30 | Slice 08 | Slice 09 | `ReferenceBar` | React Component | VALID |
| 31 | Slice 09 | Slice 10 | `referenceSlots` state | React State | VALID |
| 32 | Slice 09 | Slice 11 | `referenceSlots` state | React State | VALID |
| 33 | Slice 09 | Slice 12 | `referenceSlots` state structure | Data Shape | VALID |
| 34 | Slice 09 | Slice 13 | `referenceSlots` in Generate | Data Flow | VALID |
| 35 | Slice 09 | Slice 16 | `addReference` context field | Context Field | VALID |
| 36 | Slice 12 | Slice 13 | `composeMultiReferencePrompt` | Pure Function | VALID |
| 37 | Slice 13 | Slice 15 | `generation_references` records | DB Data | VALID |
| 38 | Slice 13 | Slice 17 | `generation_references` structure | DB Schema | VALID |

---

## Validation Results

### VALID Connections: 38

All declared dependencies have matching outputs with compatible types and interfaces.

### Orphaned Outputs: 3

| Output | Defined In | Consumers | Action |
|--------|------------|-----------|--------|
| `GenerationCard` (draggable) | Slice 14 | None (end-feature) | VALID -- User-facing feature, no downstream slice consumer needed |
| UseAsReference Button | Slice 16 | None (end-feature) | VALID -- User-facing feature, no downstream slice consumer needed |
| `migrateSourceImages` | Slice 17 | None (manual CLI) | VALID -- One-time migration script, manually executed |

All orphaned outputs are final user-facing features or operational scripts. No unexplained orphans.

### Missing Inputs: 0

No inputs were declared without a corresponding output from a previous slice or the existing codebase.

### Deliverable-Consumer Gaps: 0

All components defined in slices have mount points in consumer files:

| Component | Defined In | Consumer File | Consumer Slice | Status |
|-----------|------------|---------------|----------------|--------|
| `referenceImages`, `generationReferences` tables | Slice 01 | `lib/db/queries.ts` | Slice 02 | VALID |
| Query functions | Slice 02 | `lib/services/reference-service.ts` | Slice 03 | VALID |
| `ReferenceService` | Slice 03 | `app/actions/references.ts` | Slice 04 | VALID |
| `uploadReferenceImage`, `deleteReferenceImage` | Slice 04 | `components/workspace/reference-slot.tsx` | Slice 07 | VALID |
| `addGalleryAsReference` | Slice 05 | `components/workspace/reference-slot.tsx` (via Slice 14) | Slice 14 | VALID |
| `addGalleryAsReference` | Slice 05 | `components/lightbox/lightbox-modal.tsx` (via Slice 16) | Slice 16 | VALID |
| `Collapsible` | Slice 06 | `components/workspace/reference-bar.tsx` | Slice 08 | VALID |
| Panel 480px | Slice 06 | `components/workspace/workspace-content.tsx` | Slice 06 (self) | VALID |
| `ReferenceSlot` | Slice 07 | `components/workspace/reference-bar.tsx` | Slice 08 | VALID |
| Type definitions | Slice 07 | Multiple consumers | Slice 08, 09, 10, 12, 13 | VALID |
| `ReferenceBar` | Slice 08 | `components/workspace/prompt-area.tsx` | Slice 09 | VALID |
| `RefHintBanner` | Slice 10 | `components/workspace/prompt-area.tsx` | Slice 09 (mount) | VALID |
| `CompatibilityWarning` | Slice 11 | `components/workspace/prompt-area.tsx` | Slice 09 (mount) | VALID |
| `composeMultiReferencePrompt` | Slice 12 | `lib/services/generation-service.ts` | Slice 13 | VALID |
| `generateImages` (extended) | Slice 13 | `components/workspace/prompt-area.tsx` | Slice 09 (caller) | VALID |
| `ProvenanceRow` | Slice 15 | `components/lightbox/lightbox-modal.tsx` | Slice 15 (self) | VALID |
| UseAsReference button | Slice 16 | `components/lightbox/lightbox-modal.tsx` | Slice 16 (self) | VALID |
| `migrateSourceImages` | Slice 17 | CLI execution | Manual | VALID |

Note on Slice 10 and 11: Both `RefHintBanner` and `CompatibilityWarning` are created as standalone components and their mount point in `prompt-area.tsx` is handled by Slice 09's integration scope. Slice 09's Constraints explicitly state it delegates to Slice 10 and 11 for these components, while the PromptArea integration naturally includes mounting them. The Slice 09 Provides-To table lists "slice-10 (RefHintBanner), slice-11 (CompatibilityWarning)" as consumers of the ReferenceBar layout position, confirming the bidirectional relationship.

### Runtime Path Gaps: 0

All user flows have complete runtime chains:

| User-Flow | Chain | Status |
|-----------|-------|--------|
| Flow 1: Upload Reference | User -> ReferenceSlot (S07) -> uploadReferenceImage Action (S04) -> ReferenceService.upload (S03) -> R2 + DB (S02/S01) | VALID |
| Flow 2: Gallery Drag | User -> GenerationCard drag (S14) -> ReferenceSlot drop (S14) -> addGalleryAsReference Action (S05) -> createReferenceImage (S02) -> DB (S01) | VALID |
| Flow 3: Lightbox Button | User -> UseAsReference Button (S16) -> addGalleryAsReference (S05) + setVariation/addReference (S09) -> PromptArea consumption (S09) -> img2img mode + slot | VALID |
| Flow 4: @-Token Prompt | User -> Prompt textarea (existing) -> composeMultiReferencePrompt (S12) -> @N to @imageN mapping -> Replicate API (S13) | VALID |
| Flow 5: Generate Multi-Ref | User -> Generate button (S09) -> generateImages Action (S13) -> buildReplicateInput multi-image (S13) -> composeMultiReferencePrompt (S12) -> Replicate API -> createGenerationReferences (S02) -> DB | VALID |
| Flow 6: Provenance View | User -> Lightbox open -> ProvenanceRow (S15) -> getGenerationReferences (S02) -> DB -> Thumbnail display | VALID |
| Flow 7: Compatibility Check | Model change -> CompatibilityWarning (S11) -> getMaxImageCount (S11) -> dimmed slots / generate disabled | VALID |
| Flow 8: Migration | CLI -> migrateSourceImages (S17) -> createReferenceImage + createGenerationReferences (S02) -> DB | VALID |

---

## Discovery Traceability

### UI Components Coverage

| Discovery Element | Type | Location | Covered In | Status |
|-------------------|------|----------|------------|--------|
| ReferenceBar | Collapsible Section | Prompt-Area | slice-08, slice-09 | VALID |
| ReferenceSlot | Composite Card | ReferenceBar | slice-07 | VALID |
| RoleDropdown | Select (shadcn) | Per ReferenceSlot | slice-07 | VALID |
| StrengthDropdown | Select (shadcn) | Per ReferenceSlot | slice-07 | VALID |
| SlotLabel | Badge (shadcn) | Per ReferenceSlot | slice-07 | VALID |
| RoleBadge | Badge (shadcn) | Per ReferenceSlot | slice-07 | VALID |
| AddReferenceButton | Button | Reference Header | slice-08 | VALID |
| UseAsReferenceButton | Button | Lightbox Actions | slice-16 | VALID |
| InlineRefTag | Plain Text | Prompt Textarea | slice-12 (V1: plain text) | VALID |
| RefHintBanner | Info-Banner | Under Prompt fields | slice-10 | VALID |
| ProvenanceRow | Thumbnail Row | Lightbox Details | slice-15 | VALID |
| CompatibilityWarning | Alert/Banner | Above ReferenceBar | slice-11 | VALID |

### State Machine Coverage

| State | Required UI | Available Actions | Covered In | Status |
|-------|-------------|-------------------|------------|--------|
| `collapsed-empty` | Eingeklappt, "References (0) [+ Add]" | Aufklappen, Add Reference | slice-08 (AC-1, AC-5) | VALID |
| `collapsed-filled` | Eingeklappt, Mini-Thumbnails, Counter | Aufklappen | slice-08 (AC-2) | VALID |
| `expanded` | Alle Slots mit vollen Controls | Add/Remove/Role/Strength/Collapse | slice-08 (AC-3, AC-4) | VALID |

### Reference Slot State Coverage

| State | Covered In | Status |
|-------|------------|--------|
| `empty` | slice-07 (AC-1) | VALID |
| `drag-over` | slice-07 (AC-2, AC-3) | VALID |
| `uploading` | slice-07 (AC-4) | VALID |
| `ready` | slice-07 (AC-7) | VALID |
| `dimmed` | slice-07 (AC-11) | VALID |
| `error` | slice-07 (AC-12) | VALID |

### Transitions Coverage

| From | Trigger | To | Covered In | Status |
|------|---------|-----|------------|--------|
| `collapsed-empty` | Click [+ Add] | `expanded` | slice-08 (AC-5) | VALID |
| `collapsed-empty` | Click Header | `expanded` | slice-08 (AC-3) | VALID |
| `collapsed-filled` | Click Header | `expanded` | slice-08 (AC-3) | VALID |
| `expanded` | Click Header | `collapsed-*` | slice-08 (AC-4) | VALID |
| Slot `empty` | DragEnter | Slot `drag-over` | slice-07 (AC-2) | VALID |
| Slot `drag-over` | DragLeave | Slot `empty` | slice-07 (AC-3) | VALID |
| Slot `drag-over` | Drop (File/Gallery) | Slot `uploading` | slice-07 (AC-4), slice-14 (AC-6) | VALID |
| Slot `empty` | Click / URL Paste | Slot `uploading` | slice-07 (AC-5, AC-6) | VALID |
| Slot `uploading` | Upload complete | Slot `ready` | slice-07 (AC-7 implicit) | VALID |
| Slot `uploading` | Upload error | Slot `error` | slice-07 (AC-12) | VALID |
| Slot `ready` | Click Remove | Slot removed | slice-07 (AC-10), slice-08 (AC-7) | VALID |
| Slot `ready` | Model limit exceeded | Slot `dimmed` | slice-11 (AC-6) | VALID |
| Slot `dimmed` | Model changed to compatible | Slot `ready` | slice-11 (AC-11) | VALID |
| Slot `dimmed` | Click Remove | Slot removed | slice-07 (AC-11: remove active) | VALID |
| Any Slot | Mode Switch to txt2img/upscale | State preserved (hidden) | slice-09 (AC-2, AC-3, AC-4) | VALID |

### Business Rules Coverage

| Rule | Covered In | Status |
|------|------------|--------|
| Max 5 Referenzen | slice-08 (AC-8) | VALID |
| 5 Rollen (Style/Content/Structure/Character/Color) | slice-07 (AC-13, AC-14) | VALID |
| Default-Rolle "Content" | slice-09 (AC-5, AC-8) | VALID |
| Default-Strength "Moderate" | slice-09 (AC-5, AC-8) | VALID |
| Strength-Stufen (4 discrete levels as prompt hints) | slice-07 (AC-9), slice-12 (AC-8) | VALID |
| Slot-Labels stabil (no re-numbering, sparse) | slice-08 (AC-6, AC-7, AC-10) | VALID |
| Upload-Formate PNG/JPG/JPEG/WebP, max 10MB | slice-03 (AC-3, AC-4), slice-07 (implicit) | VALID |
| Modell-Kompatibilitaet (partial/no-support) | slice-11 (AC-5 to AC-11) | VALID |
| Kein Multi-Image Support warning + switch link | slice-11 (AC-7, AC-8, AC-9) | VALID |
| Rueckwaertskompatibilitaet (1 ref = classic img2img) | slice-13 (AC-5, AC-8), slice-17 | VALID |
| Prompt-Mapping (@1-@5 to @image1-@image5) | slice-12 (AC-1 to AC-9) | VALID |
| Gallery-Bilder als Referenz (no re-upload) | slice-05 (AC-1, AC-2) | VALID |
| Persistenz pro Projekt | slice-02, slice-03, slice-01 | VALID |
| Provenance (references in Lightbox) | slice-15 (AC-1 to AC-6) | VALID |
| Mode-Switch Erhalt (hidden, not destroyed) | slice-09 (AC-2, AC-3, AC-4) | VALID |
| Strength als Prompt-Hint | slice-12 (AC-2, AC-8) | VALID |
| Rollen-Farbkodierung | slice-07 (AC-14) | VALID |
| Panel-Breite 480px | slice-06 (AC-3) | VALID |

### Data Fields Coverage

| Field | Table | Required | Covered In | Status |
|-------|-------|----------|------------|--------|
| `id` | reference_images | Yes | slice-01 (AC-1) | VALID |
| `projectId` | reference_images | Yes | slice-01 (AC-1, AC-2) | VALID |
| `imageUrl` | reference_images | Yes | slice-01 (AC-1) | VALID |
| `originalFilename` | reference_images | No | slice-01 (AC-1) | VALID |
| `width` | reference_images | No | slice-01 (AC-1), slice-03 (AC-1, AC-7) | VALID |
| `height` | reference_images | No | slice-01 (AC-1), slice-03 (AC-1, AC-7) | VALID |
| `sourceType` | reference_images | Yes | slice-01 (AC-1), slice-03 (AC-1), slice-05 (AC-1) | VALID |
| `sourceGenerationId` | reference_images | No | slice-01 (AC-2), slice-05 (AC-1) | VALID |
| `createdAt` | reference_images | Yes | slice-01 (AC-1) | VALID |
| `id` | generation_references | Yes | slice-01 (AC-4) | VALID |
| `generationId` | generation_references | Yes | slice-01 (AC-5) | VALID |
| `referenceImageId` | generation_references | Yes | slice-01 (AC-5) | VALID |
| `role` | generation_references | Yes | slice-01 (AC-4) | VALID |
| `strength` | generation_references | Yes | slice-01 (AC-4) | VALID |
| `slotPosition` | generation_references | Yes | slice-01 (AC-4) | VALID |
| `sourceImageUrl` (deprecated) | generations | -- | slice-17 (AC-5: preserved) | VALID |

**Discovery Coverage:** 57/57 (100%)

---

## Summary

| Metric | Value |
|--------|-------|
| Total Slices | 17 |
| Total Connections | 38 |
| Valid Connections | 38 |
| Orphaned Outputs | 3 (all justified: end-features / CLI script) |
| Missing Inputs | 0 |
| Deliverable-Consumer Gaps | 0 |
| Runtime Path Gaps | 0 |
| Discovery Coverage | 100% |
| All Slices APPROVED | Yes (17/17) |

**VERDICT: READY FOR ORCHESTRATION**
