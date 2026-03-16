# Feature: Model Parameter Controls (Aspect Ratio, Size & Advanced)

**Epic:** --
**Status:** Draft
**Discovery:** `discovery.md` (same folder)
**Derived from:** Discovery constraints, NFRs, and risks

---

## Problem & Solution

**Problem:**
- Nutzer haben aktuell KEINE Moeglichkeit, Seitenverhaeltnis oder Aufloesung zu waehlen
- Alle Generierungen nutzen Model-Defaults (typisch: 1:1, 1 MP)
- Verschiedene Models nutzen unterschiedliche Parameter-Namen fuer Groesse (`megapixels` vs `resolution`)
- Weitere nuetzliche Model-Parameter (quality, background, etc.) sind nicht zugaenglich

**Solution:**
- Schema-basierte Parameter Controls in Prompt Panel (txt2img + img2img) und Canvas Popovers (Variation + Img2img) einbauen
- Primary/Advanced Split: Haeufig genutzte Controls (Aspect Ratio, Groesse) immer sichtbar, Rest unter "Advanced" einklappbar
- Bestehende `ParameterPanel`-Komponente und `getModelSchema` Server Action wiederverwenden

**Business Value:**
- Nutzer koennen Bilder in gewuenschtem Format generieren (Landscape, Portrait, Square, Widescreen)
- Hoehere/niedrigere Aufloesung waehlbar je nach Use Case
- Zugang zu allen Model-spezifischen Parametern (quality, background, etc.) ohne Code-Aenderung bei neuen Models

---

## Scope & Boundaries

| In Scope |
|----------|
| Schema-basierte Controls in Prompt Panel (txt2img + img2img) |
| Schema-basierte Controls in Canvas Variation Popover |
| Schema-basierte Controls in Canvas Img2img Popover |
| Primary/Advanced Split: Primary-Fields immer sichtbar, Advanced einklappbar |
| Primary-Whitelist: `aspect_ratio`, `megapixels`, `resolution` |
| Alle anderen Schema-Properties als Advanced Controls |
| Multi-Model-Support: Flux, Nano Banana 2, GPT Image 1.5, Hunyuan Image 3 |
| Schema-basierte Optionen (dynamisch per Model von Replicate API) |
| Merge von User-gewaehlten Params mit DB-modelParams |

| Out of Scope |
|--------------|
| Model-Auswahl-UI (Model wird in Admin-Settings konfiguriert, nicht im Generierungs-UI) |
| Upscale Mode (keine aspect_ratio/megapixels/resolution relevant) |
| Custom Width/Height Eingabe (nur enum-basierte Optionen) |
| Persistenz der User-Auswahl ueber Sessions hinweg |
| Neue DB-Tabellen oder Migrationen |
| Neue API-Endpoints oder Server Actions |

---

## API Design

### Overview

| Aspect | Specification |
|--------|---------------|
| Style | Existing Next.js Server Actions (no new endpoints) |
| Authentication | Existing `requireAuth()` in Server Actions |
| Rate Limiting | N/A — schema fetch is cached in-memory by `ModelSchemaService` |

### Endpoints

No new API endpoints. Existing Server Action reused:

| Action | Location | Current Usage | New Usage |
|--------|----------|---------------|-----------|
| `getModelSchema` | `app/actions/models.ts:36` | Not called from UI | Called by `useModelSchema` hook in 3 locations |

### Data Transfer Objects (DTOs)

| DTO | Fields | Validation | Notes |
|-----|--------|------------|-------|
| `getModelSchema` input | `{ modelId: string }` | `modelId` must match `owner/name` format | Existing, unchanged |
| `getModelSchema` response | `{ properties: Record<string, unknown> }` | -- | Existing, unchanged. Properties contain `type`, `enum`, `default`, `title`, `description` per field |

---

## Database Schema

No database changes required.

**Rationale:** User-selected imageParams (aspect_ratio, megapixels, etc.) are ephemeral UI state. They flow into the existing `params` field of `generateImages()` server action, which merges them into `generation.modelParams` (JSONB column). The existing `modelParams` column already stores these values — no new columns needed.

**Existing flow (unchanged):**
```
UI imageParams → generateImages({ params: { ...modelParams, ...imageParams } })
  → createGeneration({ modelParams: storedParams })
    → buildReplicateInput({ ...params, prompt })
      → ReplicateClient.run(modelId, input)
```

---

## Server Logic

### Services & Processing

No new services. Existing services reused unchanged:

| Service | Responsibility | Change |
|---------|----------------|--------|
| `ModelSchemaService` | Fetch + cache Replicate model schema, resolve $ref enums | None |
| `GenerationService.generate()` | Create generation records, call Replicate | None — `params` already spread via `buildReplicateInput` |
| `getModelSchema` Server Action | Auth + call ModelSchemaService | None |

### Business Logic Flow

```
[UI] resolveModel(settings, mode, tier)
  → modelId + modelParams

[UI] useModelSchema(modelId)
  → getModelSchema({ modelId })
    → ModelSchemaService.getSchema(modelId) [cached]
      → schema properties

[UI] ParameterPanel renders schema → user selects values → imageParams state

[UI] handleGenerate()
  → generateImages({ params: { ...modelParams, ...imageParams } })
    → [existing flow, unchanged]
```

### Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| Schema enum values | User-selected value must exist in current model's schema enum | N/A — Select dropdown only shows valid options |
| Tier change | If selected value not in new model's schema → reset to default | N/A — automatic reset in useModelSchema hook |

---

## Security

### Authentication & Authorization

| Area | Mechanism | Notes |
|------|-----------|-------|
| `getModelSchema` | `requireAuth()` | Existing, unchanged. Only authenticated users can fetch schemas |

### Data Protection

| Data Type | Protection | Notes |
|-----------|------------|-------|
| Schema data | None needed | Public model schemas from Replicate API, no sensitive data |

### Input Validation & Sanitization

| Input | Validation | Sanitization |
|-------|------------|--------------|
| `modelId` | Regex `/^[a-z0-9-]+\/[a-z0-9._-]+$/` in ModelSchemaService | Existing validation, unchanged |
| User-selected param values | Constrained by Select dropdown enum values | No free-text input — enum-only values passed directly to Replicate API |

### Rate Limiting & Abuse Prevention

| Resource | Limit | Window | Penalty |
|----------|-------|--------|---------|
| `getModelSchema` | In-memory cache per modelId | Unlimited (until server restart) | N/A — cached after first fetch |

---

## Architecture Layers

### Layer Responsibilities

| Layer | Responsibility | Pattern |
|-------|----------------|---------|
| `useModelSchema` Hook | Fetch schema for resolved modelId, manage loading/error states, reset imageParams on model change | Custom React Hook with `useEffect` + `useState` |
| `resolveModel` Utility | Extract model resolution logic (mode+tier → modelId+modelParams) | Pure function, no side effects |
| `ParameterPanel` Component | Render schema properties as UI controls with Primary/Advanced split | Presentational component with filtering logic |
| Integration Points (3x) | Connect hook + panel in PromptArea, VariationPopover, Img2imgPopover | State management + props wiring |

### Data Flow

```
[ModelSettings from DB]
       │
       ▼
[resolveModel(settings, mode, tier)]
       │
       ▼
   modelId ──────────────────────────────┐
       │                                  │
       ▼                                  ▼
[useModelSchema(modelId)]         [modelParams from DB]
       │                                  │
       ▼                                  │
   schema ─► [ParameterPanel]             │
                    │                     │
                    ▼                     │
              imageParams                 │
                    │                     │
                    ▼                     ▼
              handleGenerate({ params: { ...modelParams, ...imageParams } })
                    │
                    ▼
              [generateImages server action] (existing, unchanged)
```

### Error Handling Strategy

| Error Type | Handling | User Response | Logging |
|------------|----------|---------------|---------|
| Schema fetch failed | `useModelSchema` returns `{ error }` | Controls area hidden (graceful degradation), generation still possible without params | Console error in hook |
| Schema fetch timeout | `ModelSchemaService` 5s timeout | Same as fetch failed | Console error |
| Invalid param value after tier change | Hook resets imageParams to `{}` | Controls show new model defaults | None |

---

## Migration Map

### Existing Files Changed

| Existing File | Current Pattern | Target Pattern | Specific Changes |
|---|---|---|---|
| `components/workspace/parameter-panel.tsx` | Flat list of all schema properties, only excludes `prompt`/`negative_prompt` | Primary/Advanced split with INTERNAL_FIELDS exclusion + collapsible Advanced section | Add `primaryFields` prop (whitelist), add `INTERNAL_FIELDS` set, split rendering into Primary (always visible) + Advanced (collapsible), add Advanced toggle button |
| `components/workspace/prompt-area.tsx` | `resolveModel()` inline helper, no schema controls, no imageParams in state | Uses extracted `resolveModel`, adds `useModelSchema` hook, adds ParameterPanel, imageParams in mode state | Extract `resolveModel` to shared utility, add `imageParams` to `Txt2ImgState`/`Img2ImgState`, import+use `useModelSchema` hook, render ParameterPanel between TierToggle and Variants, merge imageParams in handleGenerate |
| `components/canvas/popovers/variation-popover.tsx` | `VariationParams` has prompt/strength/count/tier | `VariationParams` adds `imageParams?: Record<string, unknown>`, popover includes ParameterPanel | Add `imageParams` to VariationParams, add `useModelSchema` hook, render ParameterPanel between TierToggle and Generate, pass imageParams in onGenerate |
| `components/canvas/popovers/img2img-popover.tsx` | `Img2imgParams` has references/motiv/style/variants/tier | `Img2imgParams` adds `imageParams?: Record<string, unknown>`, popover includes ParameterPanel | Add `imageParams` to Img2imgParams, add `useModelSchema` hook, render ParameterPanel between TierToggle and Generate, pass imageParams in onGenerate |
| `components/canvas/canvas-detail-view.tsx` | `handleVariationGenerate` passes `{ prompt_strength }` as params, `handleImg2imgGenerate` passes `{}` as params | Both handlers spread `...imageParams` into params alongside existing fields | Spread `params.imageParams` in handleVariationGenerate and handleImg2imgGenerate |

### New Files

| New File | Purpose | Pattern |
|---|---|---|
| `lib/hooks/use-model-schema.ts` | React hook to fetch model schema via `getModelSchema` server action | Custom hook: `useModelSchema(modelId: string \| undefined)` → `{ schema, isLoading, error }`. Fetches on modelId change, resets on null |
| `lib/utils/resolve-model.ts` | Extracted `resolveModel()` function from prompt-area.tsx | Pure function: `resolveModel(settings, mode, tier)` → `{ modelId, modelParams } \| undefined`. Used by PromptArea + Popovers (via modelSettings prop) |

---

## Constraints & Integrations

### Constraints

| Constraint | Technical Implication | Solution |
|------------|----------------------|----------|
| Schema-Properties are dynamic per Model | UI cannot hardcode field names or enum values | ParameterPanel renders dynamically from schema. Primary-Whitelist is by field name only (`aspect_ratio`, `megapixels`, `resolution`) |
| Models use different param names for size | Flux uses `megapixels`, Nano Banana uses `resolution`, GPT Image 1.5 has neither | Primary-Whitelist approach: show whichever primary fields exist in schema. ParameterPanel handles missing fields gracefully (returns null) |
| INTERNAL_FIELDS must be excluded from ParameterPanel | `prompt`, image input fields, `seed`, `num_outputs`, etc. are set programmatically | Expanded EXCLUDED_KEYS set in ParameterPanel: prompt fields, image input fields, img2img control fields, inpainting fields, backend-only fields, API keys. Additionally exclude `type === "string"` without enum, `type === "boolean"`, `type === "array"` without enum |
| Tier change → different model → different schema | Schema must refetch, invalid param values must reset | `useModelSchema` hook watches `modelId` — when it changes, fetches new schema and resets `imageParams` to `{}` |
| Canvas popovers need model resolution | Popovers don't have direct access to `resolveModel` | Popovers receive `modelSettings` as prop from canvas-detail-view (already loaded there). Use shared `resolveModel` utility |
| Aspect ratio dropdown grouping for >8 options | Nano Banana 2 has 14 values — need visual grouping | ParameterPanel groups aspect_ratio values: Common (1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3) first, then separator, then remaining values. Grouping logic only applies to `aspect_ratio` field |

### Integrations

| Area | System / Capability | Interface | Version | Notes |
|------|----------------------|-----------|---------|-------|
| Frontend Framework | Next.js | App Router, Server Actions, `"use client"` | 16.1.6 (package.json) | Server Actions for schema fetch, client components for UI |
| UI Components | Radix UI (via shadcn) | Select, Popover, Collapsible, Skeleton, Label | radix-ui 1.4.3 (package.json) | Reuse existing shadcn Select for dropdowns, Collapsible for Advanced section |
| Schema Source | Replicate API | GET /v1/models/{owner}/{name} | replicate 1.4.0 (package.json) | Via ModelSchemaService, in-memory cached. Returns OpenAPI schema with Input properties |
| State Management | React useState/useEffect | Hooks | React 19.2.3 (package.json) | No external state library — local component state for imageParams |
| Testing | Vitest + Testing Library | Unit tests | vitest 4.0.18 (package.json) | Hook tests with mocked getModelSchema, ParameterPanel tests with mock schema |

---

## Quality Attributes (NFRs)

### From Discovery → Technical Solution

| Attribute | Target | Technical Approach | Measure / Verify |
|-----------|--------|--------------------|------------------|
| Performance | Schema loads in <100ms after first fetch | ModelSchemaService in-memory cache — first call ~200ms (API), subsequent <1ms | Network tab: verify single fetch per modelId per session |
| Responsiveness | Controls appear instantly after schema loaded | React state update — ParameterPanel re-renders on schema change | Visual: no flicker between loading skeleton and controls |
| Graceful Degradation | Generation works without parameter controls | If schema fetch fails → controls hidden, generation uses model defaults only | Manual test: disable network → generate still works |
| Bundle Size | Minimal additional JS | No new dependencies — reuses existing components (Select, Skeleton, Collapsible) | Build output: check component chunk size |

### Monitoring & Observability

| Metric | Type | Target | Alert |
|--------|------|--------|-------|
| Schema fetch errors | Console error | 0 in normal operation | N/A (client-side only, no server monitoring) |

---

## Risks & Assumptions

### Assumptions

| Assumption | Technical Validation | Impact if Wrong |
|------------|---------------------|-----------------|
| All supported models have `aspect_ratio` as enum in Replicate schema | Verified via Replicate API for Flux Schnell, Flux 2 Pro, Flux 2 Max, Nano Banana 2, GPT Image 1.5, Hunyuan Image 3 | Primary Controls area would be empty for that model (graceful, but poor UX) |
| `buildReplicateInput` spreads all params via `...params` | Verified in `generation-service.ts:272-274` — `{ ...params, prompt }` | User-selected params would not be sent to Replicate (critical bug) |
| Schema enum values match what Replicate API accepts | Enum values come directly from Replicate's OpenAPI schema | Generation fails with invalid parameter error (low risk — schema is authoritative) |
| In-memory schema cache is sufficient (no DB cache needed) | Cache survives for server process lifetime. Cold start = 1 API call per model | If server restarts frequently → many API calls. Mitigated: Replicate API is fast (~200ms), rate limits are generous |

### Risks & Mitigation

| Risk | Likelihood | Impact | Technical Mitigation | Fallback |
|------|------------|--------|---------------------|----------|
| Replicate API schema format changes | Low | High — controls break | Schema parsing is defensive (optional chaining, fallback to empty) | Controls hidden, generation works with defaults |
| Model has unexpected parameter types (not enum/number) | Low | Low — param not shown | `isSupportedType()` filters to enum + integer/number only. INTERNAL_FIELDS + type filters exclude boolean, plain string, array | User cannot set that param, model uses default |
| Canvas popovers don't have modelSettings | Low | Medium — controls not shown | modelSettings already loaded in canvas-detail-view.tsx and passed via props/context | Popover works without parameter controls |
| `resolveModel` extraction breaks existing prompt-area behavior | Low | High — generation fails | Extract as pure function with identical signature, keep import in prompt-area | Inline function as fallback |

---

## Technology Decisions

### Stack Choices

| Area | Technology | Rationale |
|------|------------|-----------|
| Schema fetching | `useModelSchema` custom hook calling existing `getModelSchema` server action | Reuses existing auth + service layer. No new API surface |
| UI Controls | Existing ParameterPanel + shadcn Select/Collapsible | Consistent with existing UI. No new component library |
| State | React `useState` for imageParams per component | Simplest approach — params are ephemeral, no cross-component sharing needed |
| Advanced toggle | Collapsible from Radix UI (via shadcn) | Already available in project, accessible, animated |

### Trade-offs

| Decision | Pro | Con | Mitigation |
|----------|-----|-----|------------|
| No imageParams persistence across sessions | Simpler implementation, no DB migration | User must re-select params each session | Most users want model defaults; power users select quickly |
| In-memory schema cache (not DB) | No migration, simpler architecture | Cache lost on server restart | Fast refetch (~200ms), model-catalog feature will add DB cache later |
| Shared `resolveModel` utility extraction | DRY, used in 3+ locations | Requires refactoring prompt-area.tsx | Small, pure function — low risk extraction |
| INTERNAL_FIELDS as hardcoded set | Simple, predictable | New models with unexpected field names might show internal fields | Set is comprehensive (12+ field names + 3 type filters). Easy to extend |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| -- | -- | -- | -- | -- |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-16 | Codebase | `ParameterPanel` exists at `components/workspace/parameter-panel.tsx` — renders enum→Select, number→Input. Only excludes `prompt`/`negative_prompt`. Needs expanded exclusion list + Primary/Advanced split |
| 2026-03-16 | Codebase | `getModelSchema` server action exists at `app/actions/models.ts:36` — calls `ModelSchemaService.getSchema()`, returns `{ properties }`. Not currently called from any UI component |
| 2026-03-16 | Codebase | `ModelSchemaService` at `lib/services/model-schema-service.ts` — fetches from Replicate API, in-memory cache, resolves $ref enums. 5s timeout |
| 2026-03-16 | Codebase | `resolveModel()` at `prompt-area.tsx:128-141` — pure function: settings+mode+tier → modelId+modelParams. Needs extraction to shared utility |
| 2026-03-16 | Codebase | `buildReplicateInput()` at `generation-service.ts:263-303` — does `{ ...params, prompt }` spread. User imageParams will automatically flow through if merged into params |
| 2026-03-16 | Codebase | `prompt-area.tsx` state types (`Txt2ImgState`, `Img2ImgState`) do NOT have `imageParams` field — must be added |
| 2026-03-16 | Codebase | `VariationParams` has `prompt/strength/count/tier` — needs `imageParams` field added |
| 2026-03-16 | Codebase | `Img2imgParams` has `references/motiv/style/variants/tier` — needs `imageParams` field added |
| 2026-03-16 | Codebase | `handleVariationGenerate` in canvas-detail-view.tsx passes `{ prompt_strength }` as params — needs `...imageParams` spread |
| 2026-03-16 | Codebase | `handleImg2imgGenerate` passes `{}` as params — needs `...imageParams` spread |
| 2026-03-16 | Codebase | Canvas popovers already have TierToggle + MaxQualityToggle — new controls insert between these and Generate button |
| 2026-03-16 | Codebase | modelSettings already loaded in canvas-detail-view.tsx — available for resolveModel in popovers |
| 2026-03-16 | Dependencies | Next.js 16.1.6, React 19.2.3, radix-ui 1.4.3, replicate 1.4.0, vitest 4.0.18 — all current, no upgrades needed |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| -- | Architecture erstellt ohne User-Q&A — alle Entscheidungen durch Codebase-Recherche und Discovery-Analyse ableitbar | -- |
