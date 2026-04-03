# Systemic Review Report

**Feature:** Prompt-Felder Vereinfachung (3 -> 1)
**Branch:** worktree-discovery+prompt-simplification
**Datum:** 2026-03-29

---

## Summary

**Verdict:** FAILED

| Kriterium | Findings |
|-----------|----------|
| Duplicate Solution Paths | 0 |
| Abstraction Reuse | 1 |
| Schema Consistency | 0 |
| Dead Code / Unused Imports | 1 |
| Error Handling Divergence | 0 |
| Configuration Drift | 0 |
| Interface Inconsistency | 0 |
| Dependency Direction | 0 |
| Security Pattern Consistency | 0 |
| Performance Pattern Consistency | 0 |
| **Total** | **2** |

---

## Findings

### SR-1: Old test files reference removed DB columns and DTO fields -- will break compilation/runtime

**Kriterium:** 3.4 Dead Code / Unused Imports
**PM-Entscheidung:** Fixen / Bewusst akzeptiert / Abgelehnt

**Problem:**
The feature removed `negativePrompt` and `promptStyle` from the Drizzle schema (`lib/db/schema.ts`), which changes the inferred `Generation` type. It also changed `DraftPromptDTO` from 3 fields (`motiv`, `style`, `negative_prompt`) to 1 field (`prompt`). However, ~12 TypeScript test files and ~3 Python test files from prior features were NOT updated and still reference the old fields. These tests will fail at compile time (TS) or runtime (Python).

**TypeScript test files NOT modified but referencing removed `Generation` fields:**
- `components/workspace/__tests__/generation-card-drag.test.tsx:20,32`
- `components/workspace/__tests__/generation-card-transition.test.tsx:19,31`
- `components/workspace/__tests__/generation-card.test.tsx:20,32`
- `components/workspace/__tests__/generation-placeholder.test.tsx:61`
- `components/workspace/__tests__/workspace-content-detail.test.tsx:277,289`
- `components/workspace/__tests__/gallery-grid.test.tsx:74,86`
- `components/workspace/__tests__/gallery-filter-badge.test.tsx:165,177`
- `components/workspace/__tests__/generation-retry.test.tsx:39`
- `lib/services/__tests__/thumbnail-service.test.ts:125,127`
- `lib/db/__tests__/queries-batch.test.ts:63,73,144,151,189,196`
- `app/actions/__tests__/prompts-history.test.ts:49-50,80-81`
- `app/actions/__tests__/get-siblings.test.ts:43,54`

**Python test files NOT modified but referencing old `DraftPromptDTO` or tool output format:**
- `backend/tests/acceptance/test_slice_12_prompt_tools_backend.py:49,111,156,202` -- asserts `draft_prompt` returns `{"motiv", "style", "negative_prompt"}`
- `backend/tests/acceptance/test_slice_13c_session_resume_switcher.py:603-610,660-661` -- constructs `DraftPromptDTO(motiv=..., style=..., negative_prompt=...)`
- `backend/tests/integration/test_prompt_tools_integration.py:342` -- asserts SSE data keys are `{"motiv", "style", "negative_prompt"}`

**Neuer Code:** `lib/db/schema.ts:58-70` (removed `negativePrompt`, `promptStyle` columns); `backend/app/models/dtos.py:146-149` (changed `DraftPromptDTO` to single `prompt` field)
**Bestehendes Pattern:** All listed test files above use local `makeGeneration()` helpers or direct `DraftPromptDTO()` construction with the old field names

**Empfehlung:**
Update all listed test files to remove references to `negativePrompt`, `promptStyle` from `makeGeneration` helpers and update `DraftPromptDTO` construction to use `prompt=` instead of `motiv=, style=, negative_prompt=`. The new shared factory in `lib/__tests__/factories.ts` already has the correct shape -- existing tests could be migrated to use it, or at minimum have their local helpers fixed.

---

### SR-2: Shared test factory introduced but not adopted by existing tests (40+ duplicate `makeGeneration` helpers)

**Kriterium:** 3.2 Abstraction Reuse
**PM-Entscheidung:** Fixen / Bewusst akzeptiert / Abgelehnt

**Problem:**
The feature introduced a shared test factory (`lib/__tests__/factories.ts`) exporting `makeGeneration()` and `makeEntry()` with the correct simplified schema. However, approximately 40+ existing test files still define their own local `makeGeneration()` helper, each duplicating the same pattern. The new factory is only used by tests added in this feature (e.g., `lib/__tests__/factories.test.ts`). The pre-existing test files were not migrated to use the shared factory.

**Neuer Code:** `lib/__tests__/factories.ts:10-35` (shared `makeGeneration` factory)
**Bestehendes Pattern:** 40+ test files each defining their own local `function makeGeneration(overrides: Partial<Generation>)` -- e.g. `components/canvas/__tests__/canvas-detail-view.test.tsx:103`, `lib/services/__tests__/generation-service.test.ts:78`, `app/actions/__tests__/get-siblings.test.ts:38`

**Empfehlung:**
This is a pre-existing pattern that the feature does not need to fix in full. However, at minimum the ~12 tests from SR-1 that currently BREAK because their local `makeGeneration` references removed fields should be updated -- and the simplest fix is to import from the shared factory instead of maintaining local copies. A broader migration of all 40+ files to the shared factory can be tracked as a separate tech-debt item.

---

## Decision Log Updates

| # | Neuer Eintrag | Date |
|---|---------------|------|
| - | None. | - |

> Falls keine "Bewusst akzeptiert"-Entscheidungen: "None."
