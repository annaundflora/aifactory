# Integration Map: Model Parameter Controls (Aspect Ratio, Size & Advanced)

**Generated:** 2026-03-16
**Slices:** 7
**Connections:** 14

---

## Dependency Graph (Visual)

```
slice-01 (resolveModel Utility)
    |
    +---> slice-02 (useModelSchema Hook)
    |         |
    |         +---> slice-03 (ParameterPanel Primary/Advanced Split)
    |                   |
    |                   +---> slice-04 (Prompt Panel: imageParams State + Mount)
    |                   |         |
    |                   |         +---> slice-05 (Prompt Panel: imageParams Merge)
    |                   |
    |                   +---> slice-06 (Canvas Popovers: Mount + State + Handler Merge)
    |                                 |
    |                                 +---> slice-07 (Canvas Handlers: Edge Cases)
```

---

## Nodes

### Slice 01: resolveModel Utility

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None |
| Outputs | `resolveModel` function |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| -- | -- | -- |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `resolveModel` | Function (`lib/utils/resolve-model.ts`) | slice-04, slice-05, slice-06 |
| `prompt-area.tsx` refactored import | MODIFY file | slice-04, slice-05 (further modifications) |

---

### Slice 02: useModelSchema Hook

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-01 |
| Outputs | `useModelSchema` hook |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `resolveModel` (indirect) | slice-01 | Consumers (slice-04, slice-06) call resolveModel to produce modelId for this hook |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `useModelSchema` | Hook (`lib/hooks/use-model-schema.ts`) | slice-04, slice-06 |

---

### Slice 03: ParameterPanel Primary/Advanced Split

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-02 |
| Outputs | Extended `ParameterPanel` component |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `useModelSchema` (indirect) | slice-02 | Consumer-Slices connect hook output to ParameterPanel props |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ParameterPanel` (extended) | Component (`components/workspace/parameter-panel.tsx`) | slice-04, slice-06 |
| `INTERNAL_FIELDS` | Set<string> (internal, not exported) | -- (internal use) |

---

### Slice 04: Prompt Panel Mount

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-03 (also uses slice-01 resolveModel, slice-02 useModelSchema) |
| Outputs | imageParams State in prompt-area |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `resolveModel` | slice-01 | Import from `@/lib/utils/resolve-model` |
| `useModelSchema` | slice-02 | Import from `@/lib/hooks/use-model-schema` |
| `ParameterPanel` (extended) | slice-03 | Import from `@/components/workspace/parameter-panel` |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `Txt2ImgState.imageParams` | State field (`Record<string, unknown>`) | slice-05 |
| `Img2ImgState.imageParams` | State field (`Record<string, unknown>`) | slice-05 |

---

### Slice 05: Prompt Panel Merge

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-04 |
| Outputs | Merged params in generateImages |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `resolveModel` | slice-01 | Import -- delivers `resolved.modelParams` |
| `Txt2ImgState.imageParams` | slice-04 | State field in prompt-area.tsx |
| `Img2ImgState.imageParams` | slice-04 | State field in prompt-area.tsx |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Merged `params` in `generateImages()` | Data flow (End-to-End) | -- (final user-facing output) |

---

### Slice 06: Canvas Popovers Mount

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-03 (also uses slice-01 resolveModel, slice-02 useModelSchema) |
| Outputs | imageParams in popover interfaces + handler merge |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `resolveModel` | slice-01 | Import from `@/lib/utils/resolve-model` |
| `useModelSchema` | slice-02 | Import from `@/lib/hooks/use-model-schema` |
| `ParameterPanel` (extended) | slice-03 | Import from `@/components/workspace/parameter-panel` |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `VariationParams.imageParams` | Interface field (`imageParams?: Record<string, unknown>`) | slice-07 |
| `Img2imgParams.imageParams` | Interface field (`imageParams?: Record<string, unknown>`) | slice-07 |
| Merged `params` in `handleVariationGenerate` | Data flow | -- (End-to-End) |
| Merged `params` in `handleImg2imgGenerate` | Data flow | -- (End-to-End) |

---

### Slice 07: Canvas Handlers Merge

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | slice-06 |
| Outputs | Handler merge edge cases |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `VariationParams.imageParams` | slice-06 | Interface field from popover |
| `Img2imgParams.imageParams` | slice-06 | Interface field from popover |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Merged `params` in `handleVariationGenerate` | Data flow (End-to-End) | -- (final user-facing output) |
| Merged `params` in `handleImg2imgGenerate` | Data flow (End-to-End) | -- (final user-facing output) |

---

## Connections

| # | From | To | Resource | Type | Status |
|---|------|-----|----------|------|--------|
| 1 | Slice 01 | Slice 02 | `resolveModel` (indirect) | Function | VALID |
| 2 | Slice 01 | Slice 04 | `resolveModel` | Function | VALID |
| 3 | Slice 01 | Slice 05 | `resolveModel` | Function | VALID |
| 4 | Slice 01 | Slice 06 | `resolveModel` | Function | VALID |
| 5 | Slice 02 | Slice 03 | `useModelSchema` (indirect) | Hook | VALID |
| 6 | Slice 02 | Slice 04 | `useModelSchema` | Hook | VALID |
| 7 | Slice 02 | Slice 06 | `useModelSchema` | Hook | VALID |
| 8 | Slice 03 | Slice 04 | `ParameterPanel` (extended) | Component | VALID |
| 9 | Slice 03 | Slice 06 | `ParameterPanel` (extended) | Component | VALID |
| 10 | Slice 04 | Slice 05 | `Txt2ImgState.imageParams` | State field | VALID |
| 11 | Slice 04 | Slice 05 | `Img2ImgState.imageParams` | State field | VALID |
| 12 | Slice 06 | Slice 07 | `VariationParams.imageParams` | Interface field | VALID |
| 13 | Slice 06 | Slice 07 | `Img2imgParams.imageParams` | Interface field | VALID |
| 14 | Slice 06 | Slice 07 | `canvas-detail-view.tsx` (modified) | MODIFY file | VALID |

---

## Validation Results

### VALID Connections: 14

All declared dependencies have matching outputs. Every input declared in a consumer slice has a corresponding output in a provider slice.

### Orphaned Outputs: 0

All outputs are either consumed by a downstream slice or are final user-facing outputs (End-to-End data flow to `generateImages()` server action).

### Missing Inputs: 0

No slice declares an input without a corresponding output from a prior slice.

### Deliverable-Consumer Gaps: 0

All components created/modified have mount points in consumer slices:

| Component | Defined In | Consumer Page | Page In Deliverables? | Status |
|-----------|------------|---------------|-----------------------|--------|
| `resolveModel` | Slice 01 | prompt-area.tsx (Slice 01 refactor), popovers (Slice 06) | Yes -- Slice 01, Slice 06 | VALID |
| `useModelSchema` | Slice 02 | prompt-area.tsx (Slice 04), popovers (Slice 06) | Yes -- Slice 04, Slice 06 | VALID |
| `ParameterPanel` (extended) | Slice 03 | prompt-area.tsx (Slice 04), popovers (Slice 06) | Yes -- Slice 04, Slice 06 | VALID |
| imageParams merge (prompt) | Slice 05 | prompt-area.tsx handleGenerate | Yes -- Slice 05 | VALID |
| imageParams merge (canvas) | Slice 06/07 | canvas-detail-view.tsx handlers | Yes -- Slice 06, Slice 07 | VALID |

### Runtime Path Gaps: 0

All user flows have complete call chains:

| User Flow | Chain | Coverage |
|-----------|-------|----------|
| Prompt Panel txt2img generate | User -> ParameterPanel -> imageParams state -> handleGenerate -> `{ ...modelParams, ...imageParams }` -> generateImages -> buildReplicateInput -> Replicate API | Slice 04 (mount), Slice 05 (merge), existing server action |
| Prompt Panel img2img generate | Same as above, img2img mode | Slice 04 (mount), Slice 05 (merge) |
| Canvas Variation generate | User -> ParameterPanel in popover -> imageParams -> onGenerate(VariationParams) -> handleVariationGenerate -> `{ prompt_strength, ...imageParams }` -> generateImages | Slice 06 (mount + callback), Slice 07 (handler merge) |
| Canvas Img2img generate | User -> ParameterPanel in popover -> imageParams -> onGenerate(Img2imgParams) -> handleImg2imgGenerate -> `{ ...imageParams }` -> generateImages | Slice 06 (mount + callback), Slice 07 (handler merge) |
| Tier change -> schema refetch | User changes tier -> resolveModel gives new modelId -> useModelSchema refetches -> imageParams reset -> new controls rendered | Slice 01 (resolveModel), Slice 02 (hook refetch), Slice 04/06 (reset logic) |
| Schema error -> graceful degradation | Schema fetch fails -> useModelSchema returns error -> ParameterPanel not rendered -> generate still works without extra params | Slice 02 (error handling), Slice 04 AC-8, Slice 06 AC-9 |

### Semantic Consistency Gaps: 0

**MODIFY-Chain Analysis:**

| File | Modified By | Slices | Consistency |
|------|-----------|--------|-------------|
| `prompt-area.tsx` | Slice 01, Slice 04, Slice 05 | Sequential chain (01 -> 04 -> 05) | VALID -- each slice modifies different aspects: Slice 01 (import refactor), Slice 04 (state + UI mount), Slice 05 (handleGenerate merge). No conflicting changes. |
| `canvas-detail-view.tsx` | Slice 06, Slice 07 | Sequential chain (06 -> 07) | VALID -- Slice 06 passes modelSettings as prop + handler merge (ACs 7-8). Slice 07 adds edge case handling for undefined imageParams (ACs 4-5). Overlap noted in compliance-slice-07.md Advisory. The Orchestrator should treat Slice 07 as a refinement of Slice 06's handler changes. |
| `parameter-panel.tsx` | Slice 03 only | Single slice | VALID -- no cross-slice conflict. |

**Return-Type Consistency:**
- `resolveModel` returns `{ modelId: string; modelParams: Record<string, unknown> } | undefined` -- consumed consistently by Slices 04 and 06 via optional chaining (`?.modelId`).
- `useModelSchema` returns `{ schema, isLoading, error }` -- consumed consistently by Slices 04 and 06 as ParameterPanel props.
- `ParameterPanel` onChange provides `Record<string, unknown>` -- consumed consistently as imageParams state updates.

---

## Discovery Traceability

### UI Components Coverage

| Discovery Element | Type | Location | Covered In | Status |
|-------------------|------|----------|------------|--------|
| Primary Controls (ParameterPanel filtered on whitelist) | Component | Prompt Panel, Variation Popover, Img2img Popover | Slice 03 (split), Slice 04 (prompt mount), Slice 06 (canvas mount) | COVERED |
| Advanced Toggle (Button/Link) | Component | Prompt Panel, Variation Popover, Img2img Popover | Slice 03 (Collapsible toggle) | COVERED |
| Advanced Controls (non-Primary properties) | Component | Prompt Panel, Variation Popover, Img2img Popover | Slice 03 (Collapsible section) | COVERED |

### State Machine Coverage

| State | Required UI | Available Actions | Covered In | Status |
|-------|-------------|-------------------|------------|--------|
| `schema_loading` | Skeleton Placeholders | Warten | Slice 02 (hook isLoading), Slice 03 (ParameterPanel skeleton), Slice 04 AC-4, Slice 06 AC-5 | COVERED |
| `schema_ready` | Primary Controls visible, Advanced collapsed | Selection, Advanced toggle, Generate | Slice 03 (rendering), Slice 04 AC-1/2, Slice 06 AC-1/2 | COVERED |
| `schema_empty` | No Controls | Generate without params | Slice 03 AC-7 (no primary fields), Slice 04 AC-7 (upscale), Slice 04 AC-8 (error) | COVERED |
| `schema_error` | No Controls | Generate without params | Slice 02 AC-3 (hook error), Slice 04 AC-8, Slice 06 AC-9 | COVERED |

### Transitions Coverage

| From | Trigger | To | Covered In | Status |
|------|---------|-----|------------|--------|
| `schema_loading` | Schema loaded, primary fields present | `schema_ready` | Slice 02 AC-1 (hook success), Slice 04 AC-1 (panel appears) | COVERED |
| `schema_loading` | Schema loaded, no primary/advanced fields | `schema_empty` | Slice 03 AC-7 (empty primary), Slice 03 AC-8 (no advanced) | COVERED |
| `schema_loading` | Schema fetch failed | `schema_error` | Slice 02 AC-3 (hook error), Slice 04 AC-8 (no panel) | COVERED |
| `schema_ready` | Tier change -> other model | `schema_loading` -> `schema_ready` | Slice 02 AC-5 (refetch), Slice 04 AC-5 (reset), Slice 06 AC-6 (reset) | COVERED |
| `schema_ready` | Mode switch (txt2img <-> img2img) | `schema_ready` | Slice 04 AC-6 (mode persistence) | COVERED |

### Business Rules Coverage

| Rule | Covered In | Status |
|------|------------|--------|
| Schema-Properties dynamisch aus Replicate Model-Schema geladen | Slice 02 (useModelSchema hook), Slice 03 (ParameterPanel renders dynamically) | COVERED |
| Primary-Whitelist: aspect_ratio, megapixels, resolution | Slice 03 AC-1 (primaryFields prop), Slice 04/06 (pass whitelist) | COVERED |
| Advanced: All other Schema-Properties except INTERNAL_FIELDS | Slice 03 AC-2 (Advanced section), AC-3 (INTERNAL_FIELDS exclusion) | COVERED |
| INTERNAL_FIELDS exclusion (prompt, image fields, seed, etc.) | Slice 03 AC-3 (field names), AC-4 (type filter) | COVERED |
| User-selected values override Model-Defaults | Slice 05 AC-4 (imageParams overrides modelParams), Slice 07 AC-1 | COVERED |
| Tier change -> reset invalid values to defaults | Slice 04 AC-5 (prompt panel), Slice 06 AC-6 (canvas popovers) | COVERED |
| Upscale Mode shows no controls | Slice 04 AC-7, Slice 05 AC-5 | COVERED |
| Mode persistence for imageParams | Slice 04 AC-6 (mode switch preserves imageParams) | COVERED |
| Canvas Popover imageParams flow (VariationParams, Img2imgParams) | Slice 06 AC-3/4 (onGenerate callback), Slice 07 AC-1/2 (handler merge) | COVERED |
| Aspect ratio grouping for >8 options (Common vs Extreme) | Slice 03 AC-5 (separator), AC-6 (no separator when <=8) | COVERED |

### Data Fields Coverage

| Field | Required | Covered In | Status |
|-------|----------|------------|--------|
| `aspect_ratio` | No | Slice 03 (Primary rendering), Slice 04 AC-1 (prompt mount), Slice 06 AC-1 (canvas mount) | COVERED |
| `megapixels` | No | Slice 03 AC-1 (Primary rendering), Slice 04 AC-2 (prompt mount) | COVERED |
| `resolution` | No | Slice 03 (Primary rendering), Slice 06 AC-2 (canvas mount with resolution) | COVERED |
| Advanced params (quality, background, etc.) | No | Slice 03 AC-2 (Advanced section rendering) | COVERED |

**Discovery Coverage:** 25/25 (100%)

---

## Advisories

### Advisory 1: Scope Overlap between Slice 06 and Slice 07

Slice 06 Deliverables include `canvas-detail-view.tsx` with handler merge logic (ACs 7-8), and Slice 07 covers the same file with the same handler merge plus edge cases (undefined imageParams). The compliance report for Slice 07 flagged this as a non-blocking advisory. The Orchestrator should treat Slice 07 as a refinement/edge-case hardening step that builds on Slice 06's initial implementation. During implementation, the agent implementing Slice 07 should verify Slice 06's handler merge is already in place and add only the defensive `?? {}` fallback patterns.

### Advisory 2: No Infrastructure Prerequisites

No health endpoint needed (no new API endpoints or services). No new log channels. No database migrations. All existing infrastructure is sufficient.

---

## Summary

| Metric | Value |
|--------|-------|
| Total Slices | 7 |
| Total Connections | 14 |
| Valid Connections | 14 |
| Orphaned Outputs | 0 |
| Missing Inputs | 0 |
| Deliverable-Consumer Gaps | 0 |
| Runtime Path Gaps | 0 |
| Semantic Consistency Gaps | 0 |
| Discovery Coverage | 100% |

**VERDICT: READY FOR ORCHESTRATION**
