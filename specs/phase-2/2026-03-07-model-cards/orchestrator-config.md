# Orchestrator Configuration: Model Cards & Multi-Model Selection

**Integration Map:** `integration-map.md`
**E2E Checklist:** `e2e-checklist.md`
**Generated:** 2026-03-09

---

## Pre-Implementation Gates

```yaml
pre_checks:
  - name: "Gate 1: Architecture Compliance"
    file: "specs/phase-2/2026-03-07-model-cards/compliance-architecture.md"
    required: "Verdict == APPROVED"

  - name: "Gate 2: All Slices Approved"
    files: "specs/phase-2/2026-03-07-model-cards/slices/compliance-slice-*.md"
    required: "ALL Verdict == APPROVED"
    count: 14

  - name: "Gate 3: Integration Map Valid"
    file: "specs/phase-2/2026-03-07-model-cards/integration-map.md"
    required: "VERDICT: READY FOR ORCHESTRATION"
    checks:
      - "Missing Inputs == 0"
      - "Orphaned Outputs == 0"
      - "Deliverable-Consumer Gaps == 0"
      - "Runtime Path Gaps == 0"
      - "Discovery Coverage == 100%"
```

---

## Implementation Order

Based on dependency analysis from `integration-map.md`:

| Order | Slice | Name | Depends On | Parallel With |
|-------|-------|------|------------|---------------|
| 1 | slice-01 | shadcn Badge installieren | -- | slice-02, slice-09 |
| 1 | slice-02 | CollectionModel Type + Service | -- | slice-01, slice-09 |
| 1 | slice-09 | Run Count Formatter Utility | -- | slice-01, slice-02 |
| 2 | slice-03 | Server Action getCollectionModels + Static Models entfernen | slice-02 | -- |
| 3 | slice-04 | Remove Whitelist aus Schema-Service + Generation-Service | slice-03 | slice-05 |
| 3 | slice-05 | Remove Model Lookup aus Lightbox + Prompt-Service | slice-03 | slice-04 |
| 4 | slice-06 | Model Card Component | slice-01, slice-02 | slice-07 |
| 4 | slice-07 | Model Search + Filter Hook | slice-02 | slice-06 |
| 5 | slice-08 | Model Browser Drawer | slice-06, slice-07 | -- |
| 6 | slice-10 | Model Trigger + Prompt Area Integration | slice-08 | -- |
| 7 | slice-11 | Parameter Panel Multi-Model Notice | slice-10 | slice-12 |
| 7 | slice-12 | Parallel Multi-Model Generation | slice-10 | slice-11 |
| 8 | slice-13 | Gallery Model Badge | slice-01, slice-05 | -- |
| 9 | slice-14 | Cleanup + Integration Smoke Test | slice-12, slice-13 | -- |

### Parallelization Notes

- **Wave 1** (no dependencies): slice-01, slice-02, slice-09 can be implemented concurrently
- **Wave 2**: slice-03 must follow slice-02; no other dependencies
- **Wave 3**: slice-04 and slice-05 can be implemented concurrently after slice-03
- **Wave 4**: slice-06 and slice-07 can be implemented concurrently (both depend on slice-02, which is complete by Wave 3)
- **Wave 5**: slice-08 requires both slice-06 and slice-07 to be complete
- **Wave 6**: slice-10 requires slice-08
- **Wave 7**: slice-11 and slice-12 can be implemented concurrently after slice-10
- **Wave 8**: slice-13 requires slice-01 (Wave 1) and slice-05 (Wave 3) — can be started after Wave 3 but is blocked until slice-01 is done (Wave 1); in practice starts after Wave 3
- **Wave 9**: slice-14 requires slice-12 and slice-13 — final integration slice

---

## Pre-Slice Setup (before Wave 1)

```yaml
setup_steps:
  - name: "Verify environment"
    checks:
      - "REPLICATE_API_TOKEN is set in .env.local"
      - "pnpm install has been run (node_modules present)"
      - "pnpm build succeeds on current main branch (baseline)"

  - name: "Playwright setup (required for slice-14 E2E)"
    note: "One-time manual step before slice-14"
    command: "pnpm create playwright"
    creates: "playwright.config.ts (to be reviewed against slice-14 spec)"
```

---

## Per-Slice Implementation Instructions

### Wave 1 — Parallel (no dependencies)

#### slice-01: shadcn Badge installieren

```yaml
slice: slice-01-shadcn-badge
spec: specs/phase-2/2026-03-07-model-cards/slices/slice-01-shadcn-badge.md

implementation_steps:
  - "Run: pnpm dlx shadcn@3 add badge"
  - "Verify: components/ui/badge.tsx exists after command"
  - "Verify: badge.tsx exports Badge and badgeVariants"

deliverables:
  - path: components/ui/badge.tsx
    action: CREATE (via shadcn CLI)

test_command: "pnpm test components/ui/__tests__/badge.test.tsx"
integration_command: "pnpm build"
```

#### slice-02: CollectionModel Type + Service

```yaml
slice: slice-02-collection-model-service
spec: specs/phase-2/2026-03-07-model-cards/slices/slice-02-collection-model-service.md

deliverables:
  - path: lib/types/collection-model.ts
    action: CREATE
    interface: "CollectionModel { url, owner, name, description, cover_image_url, run_count }"

  - path: lib/services/collection-model-service.ts
    action: CREATE
    features:
      - "In-memory Map cache with 1h TTL (3600000ms)"
      - "Cache key: 'text-to-image'"
      - "AbortController with 5000ms timeout"
      - "API endpoint: https://api.replicate.com/v1/collections/text-to-image"
      - "Auth: Bearer REPLICATE_API_TOKEN"
      - "Error responses NOT cached"
      - "clearCache() method for test support"

test_command: "pnpm test lib/services/__tests__/collection-model-service.test.ts"
integration_command: "pnpm build"
```

#### slice-09: Run Count Formatter Utility

```yaml
slice: slice-09-run-count-formatter
spec: specs/phase-2/2026-03-07-model-cards/slices/slice-09-run-count-formatter.md

deliverables:
  - path: lib/utils/format-run-count.ts
    action: CREATE
    function: "formatRunCount(count: number): string"
    thresholds: ">= 1B -> B; >= 1M -> M; >= 1K -> K; else plain number"
    format: "{value}{unit} runs (max 1 decimal, no trailing zeros)"

test_command: "pnpm test lib/utils/__tests__/format-run-count.test.ts"
integration_command: "pnpm build"
```

---

### Wave 2 — Sequential

#### slice-03: Server Action getCollectionModels + Static Models entfernen

```yaml
slice: slice-03-server-action-collection
spec: specs/phase-2/2026-03-07-model-cards/slices/slice-03-server-action-collection.md
requires: ["slice-02 COMPLETE"]

deliverables:
  - path: app/actions/models.ts
    action: MODIFY (existing file)
    changes:
      - "Add getCollectionModels() server action calling CollectionModelService"
      - "Remove getModelById import from lib/models"
      - "Replace whitelist check in getModelSchema with regex validation (string contains /)"

  - path: lib/models.ts
    action: DELETE

  - path: lib/__tests__/models.test.ts
    action: DELETE

  - note: "Other files importing lib/models (lightbox-modal.tsx, prompt-service.ts,
           generation-service.ts, model-schema-service.ts, app/actions/generations.ts)
           must have the import removed with a minimal inline fallback so pnpm build
           compiles. Full replacement of these comes in slices 04 and 05."

test_command: "pnpm test app/actions/__tests__/models.test.ts"
integration_command: "pnpm build"
```

---

### Wave 3 — Parallel (both require slice-03)

#### slice-04: Remove Whitelist aus Schema-Service + Generation-Service

```yaml
slice: slice-04-remove-whitelist-services
spec: specs/phase-2/2026-03-07-model-cards/slices/slice-04-remove-whitelist-services.md
requires: ["slice-03 COMPLETE"]

deliverables:
  - path: lib/services/model-schema-service.ts
    action: MODIFY (existing file)
    changes:
      - "Remove getModelById import"
      - "Add regex validation: ^[a-z0-9-]+/[a-z0-9._-]+$ before API call"
      - "Add AbortController with 5000ms timeout to fetch()"
      - "Error message for invalid format: 'Ungueltiges Model-ID-Format'"

  - path: lib/services/generation-service.ts
    action: MODIFY (existing file)
    changes:
      - "Remove getModelById import and whitelist check"
      - "Add format validation (string contains /)"
      - "Error message: 'Unbekanntes Modell'"
      - "Existing generate() signature UNCHANGED (modelId: string — signature change in slice-12)"

test_command: "pnpm test lib/services/__tests__/model-schema-service.test.ts lib/services/__tests__/generation-service.test.ts"
integration_command: "pnpm build"
```

#### slice-05: Remove Model Lookup aus Lightbox + Prompt-Service

```yaml
slice: slice-05-remove-model-lookup
spec: specs/phase-2/2026-03-07-model-cards/slices/slice-05-remove-model-lookup.md
requires: ["slice-03 COMPLETE"]

deliverables:
  - path: lib/utils/model-display-name.ts
    action: CREATE
    function: "modelIdToDisplayName(modelId: string): string"
    algorithm: "split('/') -> take last segment -> replace hyphens with spaces -> Title Case each word"
    fallback: "No '/' present: treat entire string as name"

  - path: components/lightbox/lightbox-modal.tsx
    action: MODIFY (existing file)
    changes:
      - "Remove import from lib/models"
      - "Replace getModelById(generation.modelId)?.displayName with modelIdToDisplayName(generation.modelId)"

  - path: lib/services/prompt-service.ts
    action: MODIFY (existing file)
    changes:
      - "Remove import from lib/models"
      - "Replace getModelById(modelId)?.displayName ?? modelId with modelIdToDisplayName(modelId)"

test_command: "pnpm test lib/utils/__tests__/model-display-name.test.ts"
integration_command: "pnpm build"
```

---

### Wave 4 — Parallel (both available after Wave 1 + Wave 2)

#### slice-06: Model Card Component

```yaml
slice: slice-06-model-card-component
spec: specs/phase-2/2026-03-07-model-cards/slices/slice-06-model-card-component.md
requires: ["slice-01 COMPLETE", "slice-02 COMPLETE"]

deliverables:
  - path: components/models/model-card.tsx
    action: CREATE (new directory components/models/)
    props: "{ model: CollectionModel; selected: boolean; disabled: boolean; onSelect: (model: CollectionModel) => void }"
    features:
      - "Cover image: <img loading='lazy'> in 16:9 ratio; fallback gradient div when cover_image_url is null"
      - "Checkbox overlay: top-right, shows checkmark when selected"
      - "Name: bold, single line, truncated"
      - "Owner: muted text, single line"
      - "Description: CSS line-clamp-2 + title attribute for tooltip"
      - "Run count: Badge component from components/ui/badge.tsx"
      - "Selected state: ring-2 Tailwind class"
      - "Disabled state: opacity-50 + pointer-events-none; onClick NOT fired"

test_command: "pnpm test components/models/__tests__/model-card.test.tsx"
integration_command: "pnpm build"
```

#### slice-07: Model Search + Filter Hook

```yaml
slice: slice-07-model-search-filter-hook
spec: specs/phase-2/2026-03-07-model-cards/slices/slice-07-model-search-filter-hook.md
requires: ["slice-02 COMPLETE"]

deliverables:
  - path: lib/hooks/use-model-filters.ts
    action: CREATE (new directory lib/hooks/)
    signature: "useModelFilters(models: CollectionModel[], searchQuery: string, ownerFilter: string | null): { filteredModels: CollectionModel[], owners: string[] }"
    features:
      - "Search: case-insensitive match on name + description (null-safe)"
      - "Owner filter: single-select, null or '' = no filter"
      - "AND logic: both search and owner filter applied simultaneously"
      - "Unique owners: first-occurrence order, no duplicates"
      - "useMemo for performance"

test_command: "pnpm test lib/hooks/__tests__/use-model-filters.test.ts"
integration_command: "pnpm build"
```

---

### Wave 5 — Sequential

#### slice-08: Model Browser Drawer

```yaml
slice: slice-08-model-browser-drawer
spec: specs/phase-2/2026-03-07-model-cards/slices/slice-08-model-browser-drawer.md
requires: ["slice-06 COMPLETE", "slice-07 COMPLETE", "slice-09 COMPLETE"]

deliverables:
  - path: components/models/model-browser-drawer.tsx
    action: CREATE
    props: "{ open: boolean; models: CollectionModel[]; selectedModels: CollectionModel[]; isLoading: boolean; error?: string; onConfirm: (models: CollectionModel[]) => void; onClose: () => void; onRetry: () => void }"
    features:
      - "Sheet (shadcn, side='right') with controlled open state"
      - "Header: 'Select Models' title + close button"
      - "Search input: placeholder 'Search models...', wired to useModelFilters"
      - "Owner filter chips: 'All' + one per unique owner from useModelFilters; single-select"
      - "2-column card grid: grid-cols-2 gap-4"
      - "ModelCard with selected/disabled props based on tempSelectedModels"
      - "Max-3 enforcement: when 3 selected, non-selected cards get disabled=true"
      - "Inline hint 'Select up to 3 models' when 3 selected"
      - "tempSelectedModels: local useState, initialized from selectedModels prop on open"
      - "Confirm button: sticky footer; text 'Confirm (N Models)' when N>=1; text 'Select at least 1 model' + disabled when N=0"
      - "On Confirm: call onConfirm(tempSelectedModels) then onClose"
      - "On Close (X or backdrop): call onClose only, tempState discarded"
      - "Loading state: spinner visible, no ModelCards rendered"
      - "Error state: error message + Retry button (calls onRetry)"
      - "Empty state: 'No models available.' when models=[]"
      - "run_count formatted via formatRunCount() from lib/utils/format-run-count.ts"

test_command: "pnpm test components/models/__tests__/model-browser-drawer.test.tsx"
integration_command: "pnpm build"
```

---

### Wave 6 — Sequential

#### slice-10: Model Trigger + Prompt Area Integration

```yaml
slice: slice-10-model-trigger-prompt-area
spec: specs/phase-2/2026-03-07-model-cards/slices/slice-10-model-trigger-prompt-area.md
requires: ["slice-08 COMPLETE", "slice-03 COMPLETE"]

deliverables:
  - path: components/models/model-trigger.tsx
    action: CREATE
    props: "{ models: CollectionModel[]; onRemove: (model: CollectionModel) => void; onBrowse: () => void }"
    features:
      - "One mini-card per model: 32x32 thumbnail (img or fallback gradient), name, owner"
      - "X button on each mini-card (calls onRemove)"
      - "X button HIDDEN (not rendered) when models.length === 1 (min-1 enforcement)"
      - "'Browse Models' link/button always visible (calls onBrowse)"

  - path: components/workspace/prompt-area.tsx
    action: MODIFY (existing file)
    changes:
      - "Remove <Select> dropdown and MODELS import"
      - "Add state: selectedModels: CollectionModel[] (useState, starts as [])"
      - "Add state: drawerOpen: boolean"
      - "Add state: collectionModels: CollectionModel[]"
      - "Add state: collectionError: string | undefined"
      - "Add state: collectionLoading: boolean"
      - "Add useEffect: on mount call getCollectionModels(), set selectedModels to [result[0]]"
      - "Render ModelTrigger with selectedModels, onRemove, onBrowse"
      - "Render ModelBrowserDrawer with drawerOpen, collectionModels, selectedModels, isLoading, error, onConfirm, onClose, onRetry"
      - "Conditionally render ParameterPanel only when selectedModels.length === 1"
      - "Conditionally render Variant-Count selector only when selectedModels.length === 1"
      - "Conditionally render notice text when selectedModels.length > 1 (implemented in slice-11)"
      - "Map selectedModels to modelIds: string[] for generateImages call"

test_command: "pnpm test components/models/__tests__/model-trigger.test.tsx"
integration_command: "pnpm build"
```

---

### Wave 7 — Parallel (both require slice-10)

#### slice-11: Parameter Panel Multi-Model Notice

```yaml
slice: slice-11-parameter-panel-notice
spec: specs/phase-2/2026-03-07-model-cards/slices/slice-11-parameter-panel-notice.md
requires: ["slice-10 COMPLETE"]

deliverables:
  - path: components/workspace/prompt-area.tsx
    action: MODIFY (existing file — continue from slice-10)
    changes:
      - "When selectedModels.length === 1: show ParameterPanel + Variant-Count; hide notice"
      - "When selectedModels.length > 1: hide ParameterPanel; hide Variant-Count; show notice"
      - "Notice text (exact): 'Default parameters will be used for multi-model generation.'"
      - "Conditional render via ternary or && (NOT CSS display:none)"
      - "When calling generateImages with multiple models: pass params: {}, count: 1"

test_command: "pnpm test components/workspace/__tests__/prompt-area.test.tsx"
integration_command: "pnpm build"
```

#### slice-12: Parallel Multi-Model Generation

```yaml
slice: slice-12-parallel-multi-model-generation
spec: specs/phase-2/2026-03-07-model-cards/slices/slice-12-parallel-multi-model-generation.md
requires: ["slice-10 COMPLETE", "slice-04 COMPLETE"]

deliverables:
  - path: app/actions/generations.ts
    action: MODIFY (existing file)
    changes:
      - "Change GenerateImagesInput: modelId: string -> modelIds: string[]"
      - "Validation: modelIds.length >= 1 && <= 3; each ID matches ^[a-z0-9-]+/[a-z0-9._-]+$"
      - "Validation error text: '1-3 Modelle muessen ausgewaehlt sein'"
      - "Update GenerationService.generate() call to pass modelIds"

  - path: lib/services/generation-service.ts
    action: MODIFY (existing file)
    changes:
      - "Change generate() signature: modelId: string -> modelIds: string[]"
      - "Single-model path (modelIds.length === 1): existing sequential logic with count records"
      - "Multi-model path (modelIds.length > 1): create 1 pending record per model ID, params: {}, process via Promise.allSettled"
      - "Promise.allSettled (NOT Promise.all): partial failure allowed"
      - "Each rejected result: mark that generation record as failed via existing error mechanism"

test_command: "pnpm test lib/services/__tests__/generation-service.test.ts"
integration_command: "pnpm build"
```

---

### Wave 8 — Sequential (requires slice-01 + slice-05)

#### slice-13: Gallery Model Badge hinzufuegen

```yaml
slice: slice-13-gallery-model-badge
spec: specs/phase-2/2026-03-07-model-cards/slices/slice-13-gallery-model-badge.md
requires: ["slice-01 COMPLETE", "slice-05 COMPLETE"]

deliverables:
  - path: components/workspace/generation-card.tsx
    action: MODIFY (existing file)
    changes:
      - "Import Badge from @/components/ui/badge"
      - "Import modelIdToDisplayName from @/lib/utils/model-display-name"
      - "Add ModelBadge overlay: absolute, bottom-2 left-2, bg-black/60, white text"
      - "Badge text: modelIdToDisplayName(generation.modelId)"
      - "Text overflow: max-w truncate (CSS truncate class)"
      - "Conditional: only render badge if generation.modelId is non-empty"
      - "Badge is always visible (not just on hover)"

test_command: "pnpm test components/workspace/__tests__/generation-card.test.tsx"
integration_command: "pnpm build"
```

---

### Wave 9 — Final Integration

#### slice-14: Cleanup + Integration Smoke Test

```yaml
slice: slice-14-cleanup-integration-smoke
spec: specs/phase-2/2026-03-07-model-cards/slices/slice-14-cleanup-integration-smoke.md
requires: ["slice-12 COMPLETE", "slice-13 COMPLETE"]

pre_steps:
  - "pnpm create playwright (if not already done)"
  - "Verify playwright.config.ts matches slice-14 spec"

deliverables:
  - path: playwright.config.ts
    action: CREATE
    config:
      - "baseURL: http://localhost:3000"
      - "browser: chromium"
      - "webServer: command=pnpm dev, url=http://localhost:3000"

validation_steps:
  - "Run: pnpm build (must exit 0)"
  - "Run: grep -r 'lib/models' app/ lib/ components/ --include='*.ts' --include='*.tsx' (must return 0 results)"
  - "Run: pnpm exec playwright test e2e/model-cards.spec.ts"

test_command: "pnpm build"
acceptance_command: "pnpm exec playwright test e2e/model-cards.spec.ts"
```

---

## Post-Slice Validation

For each completed slice, the Orchestrator MUST verify:

```yaml
validation_steps:
  - step: "Deliverables Check"
    action: "Verify all files listed between DELIVERABLES_START and DELIVERABLES_END exist (or are deleted for DELETE actions)"

  - step: "Unit Tests"
    action: "Run the Test Command from slice metadata"
    required: "All tests PASS (zero failures)"

  - step: "Build Integrity"
    action: "Run pnpm build (Integration Command)"
    required: "Exit code 0"

  - step: "Integration Points"
    action: "Verify outputs are accessible by the next wave's slices"
    reference: "integration-map.md -> Connections table"
```

---

## E2E Validation

After all 14 slices are complete:

```yaml
e2e_validation:
  - step: "Execute e2e-checklist.md"
    description: "Work through every checkbox in e2e-checklist.md sequentially"

  - step: "For each failing check"
    actions:
      - "Identify the responsible slice from integration-map.md (Nodes section)"
      - "Create a targeted fix task citing the slice ID and the failing AC"
      - "Re-run the slice's Test Command after fix"
      - "Re-run pnpm build"
      - "Re-check the failed item in e2e-checklist.md"

  - step: "Playwright E2E Smoke Test"
    command: "pnpm exec playwright test e2e/model-cards.spec.ts"
    required: "All 7 test cases PASS"

  - step: "Final Approval"
    condition: "ALL checks in e2e-checklist.md PASS AND Playwright reports 0 failures"
    output: "Feature 'Model Cards & Multi-Model Selection' READY FOR MERGE"
```

---

## Rollback Strategy

```yaml
rollback:
  - condition: "Slice N fails (unit tests or build)"
    action: "Revert changes from Slice N only"
    note: "All prior slices are stable. Deliverables from Slice N are the only changed files."
    command: "git checkout HEAD -- {deliverable paths from Slice N}"

  - condition: "Integration fails between two slices (e.g., type mismatch)"
    action: "Review integration-map.md Connections table for the affected connection"
    note: "Check that the Source slice Provides match exactly what the Consumer slice Requires"
    steps:
      - "Compare TypeScript types at the connection boundary"
      - "Run pnpm build to get the specific type error"
      - "Fix the discrepancy in the earlier slice's output or the later slice's import"

  - condition: "E2E smoke test fails"
    action: "Map the failing AC to its responsible slice via e2e-checklist.md Cross-Slice Integration Points"
    steps:
      - "Identify responsible slice(s) from the integration point table"
      - "Re-read the slice spec's ACs for the failing behavior"
      - "Create a targeted fix — do NOT modify other slices"
      - "Re-run full e2e-checklist.md after fix"

  - condition: "lib/models import found after slice-03/04/05"
    action: "grep -r 'lib/models' app/ lib/ components/ to identify the file"
    fix: "Remove the import in the identified file; replace usage with modelIdToDisplayName() or direct string usage"
    responsible_slice: "Depends on file: lightbox-modal.tsx -> slice-05; generation-service.ts -> slice-04; prompt-service.ts -> slice-05; other -> slice-03"
```

---

## Monitoring During Implementation

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| Slice unit test failures | Any failure | Stop, fix before next wave |
| pnpm build exit code | Non-zero | Stop, fix before next wave |
| Missing deliverable file | Any | Stop, complete the deliverable |
| Dead import of lib/models | Any (after slice-03) | Fix in the identified file |
| E2E test failures | Any | Map to responsible slice, fix targeted |
| Playwright setup missing | slice-14 start | Run pnpm create playwright |
| REPLICATE_API_TOKEN missing | E2E run | Set in .env.local before running slice-14 |
