# Codebase Scan

**Feature:** iPad Canvas Download Fix + Gallery Scroll Restore
**Scan-Datum:** 2026-04-10
**Discovery:** `specs/2026-04-10-25-ipad-canvas-download-dismiss-gallery-scroll/discovery.md`

---

## Identified Patterns

| # | Pattern | Locations | Count | Type |
|---|---------|-----------|-------|------|
| 1 | Download via Anchor-Click (fetch+blob) | `lib/utils.ts:53-73` | 1 implementation, 1 call site (`canvas-toolbar.tsx:95`) | EXTEND |
| 2 | Gallery hide via display:none | `components/workspace/workspace-content.tsx:344` | 1 | EXTEND |
| 3 | View Transition for Canvas open/close | `lib/utils/view-transition.ts:13-27`, `components/workspace/workspace-content.tsx:299,308` | 2 call sites | REUSE |
| 4 | Toast error handling (sonner) | `components/canvas/canvas-toolbar.tsx:97`, + 15 files total | 15 | REUSE |
| 5 | AbortError silent handling | `lib/clients/openrouter.ts:70`, `components/settings/settings-dialog.tsx:241` | 2 | REUSE |
| 6 | Feature Detection (no User-Agent sniffing) | `hooks/use-mobile.ts` (viewport-based), codebase-wide: 0 `userAgent` references | 0 UA sniffing | NEW |
| 7 | useRef for DOM element references | `components/workspace/gallery-grid.tsx:39`, `components/canvas/canvas-detail-view.tsx:135-136`, + 20 files | 20+ | REUSE |
| 8 | requestAnimationFrame in resize handlers | `components/workspace/workspace-content.tsx:112,194`, `components/canvas/canvas-chat-panel.tsx:266` | 3 | REUSE |
| 9 | iOS touch handling (long-press, callout suppression) | `components/workspace/generation-card.tsx:52-110`, `app/globals.css:167-170` | 2 | REUSE |

---

## Existing Abstractions

| Abstraction | Location | Used by | Recommendation | Rationale |
|-------------|----------|---------|----------------|-----------|
| `downloadImage()` | `lib/utils.ts:53-73` | 1 call site (canvas-toolbar.tsx) + 10 test mocks | EXTEND | Needs Web Share API branch for iOS; fetch+blob logic is reusable, only the delivery mechanism (anchor vs share) changes |
| `generateDownloadFilename()` | `lib/utils.ts:18-47` | 1 call site (canvas-toolbar.tsx) | REUSE | Filename generation is platform-independent, no changes needed |
| `startViewTransitionIfSupported()` | `lib/utils/view-transition.ts:13-27` | 2 call sites (workspace-content.tsx open+close) | REUSE | Already used for canvas open/close transitions; scroll restore must coordinate with this timing |
| `useIsMobile()` | `hooks/use-mobile.ts:5-19` | 1 production consumer (sidebar.tsx) | REUSE | Viewport-based detection; NOT suitable for iOS detection (iPad has desktop viewport) but establishes the hook pattern |
| `toast.error()` | sonner library | 15 files | REUSE | Established error feedback pattern; download error toast already exists in canvas-toolbar.tsx:97 |
| Touch event handling pattern | `components/workspace/generation-card.tsx:52-110` | 1 component | REUSE | Demonstrates pointerType-based touch detection (`e.pointerType !== "touch"`) as the project's platform detection approach |

---

## Recommendations

### REUSE (bestehende Abstraktion wiederverwenden)

| # | What | Where | Why |
|---|------|-------|-----|
| 1 | `generateDownloadFilename()` | `lib/utils.ts:18-47` | Filename generation is platform-independent, already called in canvas-toolbar.tsx |
| 2 | `startViewTransitionIfSupported()` | `lib/utils/view-transition.ts:13-27` | Already wraps canvas open/close; scroll restore hooks into the close callback timing |
| 3 | `toast.error()` pattern | sonner (15 files) | Download error toast already exists at `canvas-toolbar.tsx:97`; no change needed for error path |
| 4 | `useRef` for DOM references | 20+ files | Established pattern for refs; use for gallery scroll container ref and scrollTop value ref |
| 5 | `requestAnimationFrame` for post-render work | `workspace-content.tsx:112,194` | Existing pattern in same file for resize handlers; use for scroll restore after display:none removal |
| 6 | AbortError handling pattern | `lib/clients/openrouter.ts:70`, `settings-dialog.tsx:241` | Check `error.name === "AbortError"` is established; use for Web Share API dismiss detection |

### EXTEND (bestehende Abstraktion erweitern)

| # | What | Where | Extension needed |
|---|------|-------|------------------|
| 1 | `downloadImage()` | `lib/utils.ts:53-73` | Add Web Share API branch: after fetch+blob, check `navigator.canShare({files})` and call `navigator.share({files})` on iOS. Fallback to existing anchor-click. Delay `revokeObjectURL` until after share completes. Current 11 test mocks need updating. |
| 2 | Gallery container in workspace-content.tsx | `components/workspace/workspace-content.tsx:404` | Add `ref` to the `overflow-y-auto` div for scroll position save/restore. Add `scrollTopRef` (useRef<number>) to store position. Save in `handleSelectGeneration`, restore in `handleDetailViewClose` via `requestAnimationFrame`. |

### NEW (neue Implementierung noetig)

| # | What | Why new |
|---|------|---------|
| 1 | Web Share API feature detection (`navigator.canShare({files})`) | No platform/capability detection for file sharing exists in codebase. `useIsMobile` is viewport-based (768px breakpoint), not capability-based. The codebase has zero `userAgent` references, confirming feature detection as the convention. Post-fetch check with `canShare` is the recommended approach per discovery. |

### AVOID (bekannte Schuld, nicht replizieren)

| # | What | Decision Log Entry | Alternative |
|---|------|--------------------|-------------|
| -- | -- | -- | -- |

> No .decisions.md found; no known debt patterns identified.

---

## Conventions Detected

| Convention | Evidence | Count |
|------------|----------|-------|
| `@/` path alias for imports | `canvas-toolbar.tsx`, `workspace-content.tsx`, all components | 40+ files |
| `"use client"` directive on interactive components | `workspace-content.tsx:1`, `canvas-toolbar.tsx:1`, `generation-card.tsx:1` | All interactive components |
| Utility functions in `lib/utils.ts` (root) | `downloadImage`, `generateDownloadFilename`, `cn` | 3 exports, 39 consumers |
| Specialized utils in `lib/utils/{name}.ts` | `view-transition.ts`, `model-display-name.ts`, `resolve-model.ts`, `format-run-count.ts` | 5 files |
| Custom hooks in `hooks/` directory | `use-mobile.ts`, `use-column-count.ts`, `use-touch-drop-target.ts` | 3 hooks |
| `useCallback` for all event handlers | `workspace-content.tsx:297-312`, `canvas-toolbar.tsx:87-142` | Consistent across components |
| Toast messages in German | `"Download fehlgeschlagen"`, `"Zu viele Anfragen"`, `"Loeschen fehlgeschlagen"` | 15+ toast call sites |
| `data-testid` attributes on key elements | `workspace-gallery-view`, `workspace-detail-view`, `canvas-toolbar`, `gallery-grid` | All major components |
| Feature detection over UA sniffing | 0 `userAgent` references, `useIsMobile` uses `matchMedia`, touch uses `pointerType` | Codebase-wide |
| Error handling: try/catch with toast.error() | `canvas-toolbar.tsx:96-98`, `canvas-detail-view.tsx` (30+ instances) | Dominant pattern |

---

## Key Integration Points

| Integration | Current Location | Impact of Feature |
|-------------|------------------|-------------------|
| `downloadImage()` call | `components/canvas/canvas-toolbar.tsx:95` | Must handle Web Share API path; `handleDownload` needs to branch based on `canShare` result |
| Gallery scroll container | `components/workspace/workspace-content.tsx:404` | Needs ref attached; currently anonymous div with no ref |
| `handleSelectGeneration` (canvas open) | `components/workspace/workspace-content.tsx:297-305` | Must save `scrollTop` before `startViewTransitionIfSupported` callback |
| `handleDetailViewClose` (canvas close) | `components/workspace/workspace-content.tsx:307-312` | Must restore `scrollTop` after state update, inside `requestAnimationFrame` |
| `showDetailView` boolean (display toggle) | `components/workspace/workspace-content.tsx:319,344` | Controls `display:none`; scroll restore must happen after this is set to false and browser renders |
| Test mocks for `downloadImage` | 10+ test files (canvas-toolbar.test, canvas-detail-view.test, etc.) | Mocks may need updating if `downloadImage` signature changes or if new `shareImage` function is added |
| `URL.revokeObjectURL` timing | `lib/utils.ts:71` | Currently in `finally` block (immediate); must be deferred when using Web Share API (share is async) |

---

## Decision Log Context

> No .decisions.md found.

---

## Scan Summary

| Metric | Value |
|--------|-------|
| Patterns found | 9 |
| REUSE recommendations | 6 |
| EXTEND recommendations | 2 |
| NEW recommendations | 1 |
| AVOID recommendations | 0 |
| Decision Log entries | 0 |
