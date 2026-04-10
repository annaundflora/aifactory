# E2E Checklist: iPad Canvas Download Fix + Gallery Scroll Restore

**Integration Map:** `integration-map.md`
**Generated:** 2026-04-10

---

## Pre-Conditions

- [x] All slices APPROVED (Gate 2) -- 4/4 APPROVED
- [x] Architecture APPROVED (Gate 1) -- APPROVED
- [x] Integration Map has no MISSING INPUTS -- 0 missing

---

## Happy Path Tests

### Flow 1: Download auf iPad (Web Share API)

1. [ ] **Slice 01:** `downloadImage(url, filename)` is called with a valid image URL
2. [ ] **Slice 01:** Function fetches blob, creates `File` object with correct filename and MIME type
3. [ ] **Slice 01:** `navigator.canShare({ files: [file] })` returns `true` (iOS/iPadOS)
4. [ ] **Slice 01:** `navigator.share({ files: [file] })` is called, native Share-Sheet opens
5. [ ] **Slice 01:** After share completes, `URL.revokeObjectURL` is called
6. [ ] **Slice 02:** `handleDownload()` completes without toast.error, `isDownloading` resets to `false`

### Flow 2: Download auf Desktop (Anchor-Click Fallback)

1. [ ] **Slice 01:** `downloadImage(url, filename)` is called
2. [ ] **Slice 01:** Function fetches blob, creates `File` object
3. [ ] **Slice 01:** `navigator.canShare` is not available OR returns `false`
4. [ ] **Slice 01:** Anchor-click fallback executes (createElement, href, download, click, removeChild, revokeObjectURL)
5. [ ] **Slice 02:** `handleDownload()` completes without toast.error

### Flow 3: Gallery Scroll Restore

1. [ ] **Slice 03:** Gallery scroll container has `ref={galleryScrollRef}` attached
2. [ ] **Slice 03:** `scrollTopRef` initialized with default value `0`
3. [ ] **Slice 04:** User scrolls gallery to position (e.g., scrollTop=420)
4. [ ] **Slice 04:** User clicks image, `handleSelectGeneration()` saves `scrollTopRef.current = 420` BEFORE `setDetailViewOpen(true)`
5. [ ] **Slice 04:** Canvas opens, gallery is hidden via `display: none`
6. [ ] **Slice 04:** User clicks Back, `handleDetailViewClose()` calls `setDetailViewOpen(false)`
7. [ ] **Slice 04:** `requestAnimationFrame` callback sets `galleryScrollRef.current.scrollTop = 420`
8. [ ] **Slice 04:** Gallery is visible at the saved scroll position

---

## Edge Cases

### Error Handling

- [ ] **Slice 01 AC-3:** User dismisses iOS Share-Sheet -> `navigator.share()` rejects with `AbortError` -> `downloadImage()` resolves normally (no throw), `revokeObjectURL` called
- [ ] **Slice 02 AC-1:** After AbortError (handled in downloadImage), `handleDownload()` does NOT show toast.error
- [ ] **Slice 01 AC-4:** `navigator.share()` rejects with non-AbortError (e.g., `NotAllowedError`) -> error is re-thrown, `revokeObjectURL` still called
- [ ] **Slice 02 AC-2:** Real error from `downloadImage()` -> `toast.error("Download fehlgeschlagen")` shown exactly once

### State Transitions

- [ ] **Slice 02 AC-3:** Double-click guard: clicking download while `isDownloading=true` does NOT trigger a second `downloadImage()` call
- [ ] `idle` -> `downloading` -> `sharing` -> `idle` (happy path iOS)
- [ ] `idle` -> `downloading` -> `idle` (happy path Desktop/fallback)
- [ ] `idle` -> `downloading` -> `error` -> `idle` (fetch failure)
- [ ] `sharing` -> `idle` (AbortError on dismiss, silent)

### Boundary Conditions

- [ ] **Slice 04 AC-3:** `galleryScrollRef.current` is `null` during save -> no error, scrollTopRef defaults to `0`
- [ ] **Slice 04 AC-3:** `galleryScrollRef.current` is `null` during restore -> no error, scrollTop assignment skipped
- [ ] **Slice 03 AC-4:** After render, `galleryScrollRef.current.scrollTop` is programmatically readable (value > 0 after scroll)
- [ ] **Slice 04 AC-4:** `requestAnimationFrame` runs INSIDE `startViewTransitionIfSupported` callback, AFTER `setDetailViewOpen(false)`

### Regression

- [ ] **Slice 01 AC-5:** All existing tests in `download-utils.test.ts` still pass
- [ ] **Slice 02 AC-4:** All existing 10 tests in `canvas-toolbar.test.tsx` still pass
- [ ] **Slice 03 AC-3:** All existing tests in `workspace-content-detail.test.tsx` still pass

---

## Cross-Slice Integration Points

| # | Integration Point | Slices | How to Verify |
|---|-------------------|--------|---------------|
| 1 | `downloadImage()` AbortError behavior contract | Slice 01 -> Slice 02 | Slice 01: AC-3 proves AbortError resolves silently. Slice 02: AC-1 proves no toast on resolve. Run both test suites sequentially. |
| 2 | `galleryScrollRef` DOM binding | Slice 03 -> Slice 04 | Slice 03: AC-2 proves ref is attached to gallery div. Slice 04: AC-1/AC-2 prove ref is used for save/restore. Run workspace-content-detail tests. |
| 3 | `scrollTopRef` value transfer | Slice 03 -> Slice 04 | Slice 03: AC-1 proves ref exists with default 0. Slice 04: AC-1 proves value is written on open, AC-2 proves value is read on close. |

---

## Full Test Suite Execution

After all slices completed, run all affected test files:

```bash
pnpm vitest run lib/__tests__/download-utils.test.ts
pnpm vitest run components/canvas/__tests__/canvas-toolbar.test.tsx
pnpm vitest run components/workspace/__tests__/workspace-content-detail.test.tsx
```

All three must pass with zero failures.

---

## Sign-Off

| Tester | Date | Result |
|--------|------|--------|
| | | |

**Notes:**
- Manual iPad testing required for Flow 1 (Web Share API is device-specific)
- Manual testing on desktop browser required for Flow 2 regression
- Manual testing for Flow 3 (scroll position visible confirmation)
- All unit tests can be verified via automated test commands above
