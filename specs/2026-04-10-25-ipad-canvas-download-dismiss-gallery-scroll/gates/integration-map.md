# Integration Map: iPad Canvas Download Fix + Gallery Scroll Restore

**Generated:** 2026-04-10
**Slices:** 4
**Connections:** 3

---

## Dependency Graph (Visual)

```
  Download Track              Scroll Track
  ==============              ============

┌─────────────────────┐   ┌─────────────────────┐
│  Slice 01           │   │  Slice 03           │
│  download-web-share │   │  scroll-refs        │
└─────────┬───────────┘   └─────────┬───────────┘
          │                         │
          ▼                         ▼
┌─────────────────────┐   ┌─────────────────────┐
│  Slice 02           │   │  Slice 04           │
│  toolbar-abort      │   │  scroll-save-restore│
└─────────────────────┘   └─────────────────────┘

(Two independent tracks, no cross-track dependencies)
```

---

## Nodes

### Slice 01: downloadImage Web Share API Branch

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None (foundation) |
| Outputs | `downloadImage` function |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| -- | -- | No dependencies (first slice) |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `downloadImage` | Function `(url: string, filename: string) => Promise<void>` | Slice 02 (indirectly, signature unchanged) |

---

### Slice 02: Toolbar handleDownload AbortError-Kompatibilitaet

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 01 |
| Outputs | None (terminal verification slice) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `downloadImage` function behavior (AbortError handled internally) | Slice 01 | Slice 01 AC-3 (AbortError resolves silently) + AC-4 (non-AbortError re-thrown) match Slice 02 assumptions |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| -- | -- | Terminal slice, no downstream consumers |

---

### Slice 03: Gallery Scroll -- Refs am Container

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None (foundation) |
| Outputs | `galleryScrollRef`, `scrollTopRef` |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| -- | -- | No dependencies (independent track) |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `galleryScrollRef` | `React.RefObject<HTMLDivElement>` | Slice 04 |
| `scrollTopRef` | `React.RefObject<number>` | Slice 04 |

---

### Slice 04: Gallery Scroll -- Save/Restore in Handlers

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 03 |
| Outputs | Side effects (scroll save/restore) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `galleryScrollRef` | Slice 03 | Slice 03 AC-2 (ref on gallery container), AC-4 (scrollTop readable) |
| `scrollTopRef` | Slice 03 | Slice 03 AC-1 (useRef<number>(0) exists) |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Scroll-Save in `handleSelectGeneration` | Side effect | None (user-facing final behavior) |
| Scroll-Restore in `handleDetailViewClose` | Side effect | None (user-facing final behavior) |

---

## Connections

| # | From | To | Resource | Type | Status |
|---|------|-----|----------|------|--------|
| 1 | Slice 01 | Slice 02 | `downloadImage` behavior (AbortError silent) | Function behavior contract | VALID |
| 2 | Slice 03 | Slice 04 | `galleryScrollRef` | React.RefObject<HTMLDivElement> | VALID |
| 3 | Slice 03 | Slice 04 | `scrollTopRef` | React.RefObject<number> | VALID |

---

## Validation Results

### A) Connection Validation: VALID (3/3)

| Connection | Input exists? | Source APPROVED? | Types match? | Status |
|------------|--------------|-----------------|--------------|--------|
| Slice 02 requires `downloadImage` from Slice 01 | Slice 01 provides `downloadImage` | Slice 01 APPROVED | `(url: string, filename: string) => Promise<void>` -- both sides agree | VALID |
| Slice 04 requires `galleryScrollRef` from Slice 03 | Slice 03 provides `galleryScrollRef` | Slice 03 APPROVED | `React.RefObject<HTMLDivElement>` -- both sides agree | VALID |
| Slice 04 requires `scrollTopRef` from Slice 03 | Slice 03 provides `scrollTopRef` | Slice 03 APPROVED | `React.RefObject<number>` -- both sides agree | VALID |

### B) Orphan Detection: 0 Orphans

| Output | Defined In | Consumers | Status |
|--------|------------|-----------|--------|
| `downloadImage` | Slice 01 | Slice 02 | Consumed |
| `galleryScrollRef` | Slice 03 | Slice 04 | Consumed |
| `scrollTopRef` | Slice 03 | Slice 04 | Consumed |
| Scroll-Save side effect | Slice 04 | User-facing | Final output |
| Scroll-Restore side effect | Slice 04 | User-facing | Final output |

All outputs are either consumed by a downstream slice or are final user-facing behaviors.

### C) Missing Inputs: 0

All declared inputs have matching outputs from upstream slices.

### D) Deliverable-Consumer Gaps: 0

| Component/Function | Defined In | Consumer File | File In Deliverables? | Status |
|--------------------|------------|---------------|-----------------------|--------|
| `downloadImage()` in `lib/utils.ts` | Slice 01 | `components/canvas/canvas-toolbar.tsx` | Slice 02 deliverables: canvas-toolbar.tsx | VALID |
| `galleryScrollRef` + `scrollTopRef` in `workspace-content.tsx` | Slice 03 | `workspace-content.tsx` (same file, handlers) | Slice 04 deliverables: workspace-content.tsx | VALID |

Both consumer-side mount points are covered in downstream slice deliverables.

### E) Runtime Path Gaps: 0

**Flow 1: Download auf iPad**
- User clicks Download-Button -> `handleDownload()` in canvas-toolbar.tsx (Slice 02 verifies) -> `downloadImage(url, filename)` in lib/utils.ts (Slice 01 modifies) -> fetch -> blob -> File -> navigator.canShare -> navigator.share -> Share-Sheet
- Complete chain covered: Slice 01 AC-1 (share path), Slice 02 AC-1 (no toast on success)

**Flow 2: Download auf Desktop**
- User clicks Download-Button -> `handleDownload()` -> `downloadImage()` -> fetch -> blob -> anchor.click
- Covered: Slice 01 AC-2 (fallback path), Slice 02 AC-1 (no toast on success)

**Flow 3: Gallery Scroll Restore**
- User scrolls gallery -> clicks image -> `handleSelectGeneration()` saves scrollTop (Slice 04 AC-1) -> Canvas opens -> User clicks Back -> `handleDetailViewClose()` restores scrollTop via rAF (Slice 04 AC-2)
- Prerequisites: galleryScrollRef on container (Slice 03 AC-2), scrollTopRef exists (Slice 03 AC-1)
- Complete chain covered.

**Error Paths:**
- AbortError: Slice 01 AC-3 (silent resolve) + Slice 02 AC-1 (no toast) -- VALID
- Fetch error: Slice 01 AC-5 (regression) + Slice 02 AC-2 (toast.error) -- VALID
- Non-AbortError: Slice 01 AC-4 (re-throw) + Slice 02 AC-2 (toast.error) -- VALID
- scrollRef null: Slice 04 AC-3 (null safety) -- VALID

### F) Semantic Consistency Gaps: 0

**MODIFY-Chain Analysis:**
- `workspace-content.tsx` is modified by Slice 03 (add refs + ref attribute) and Slice 04 (add save/restore logic to handlers). These modifications are complementary and non-overlapping: Slice 03 adds ref declarations and DOM binding, Slice 04 adds handler logic that uses those refs. No method surface conflicts.
- `lib/utils.ts` is modified only by Slice 01. No cross-slice modification conflicts.
- `canvas-toolbar.tsx` is in Slice 02 deliverables as verification-only (likely no code change). No conflicts.

**Return-Type Consistency:**
- `downloadImage` return type: `Promise<void>` -- Slice 01 maintains this, Slice 02 consumes it. Consistent.
- `galleryScrollRef.current.scrollTop`: Slice 03 provides `HTMLDivElement` ref, Slice 04 reads `.scrollTop` (number property of HTMLDivElement). Consistent.
- `scrollTopRef.current`: Slice 03 provides `number` ref, Slice 04 writes/reads number. Consistent.

### G) Infrastructure Prerequisite Check: N/A

No health endpoints, server routes, or log channels are referenced by any slice. All changes are purely client-side browser code. No infrastructure prerequisites needed.

---

## Discovery Traceability

### UI Components Coverage

| Discovery Element | Type | Location | Covered In | Status |
|-------------------|------|----------|------------|--------|
| Download-Button (idle, downloading states) | Button | Canvas Toolbar | Slice 01 (download behavior), Slice 02 (toolbar verification) | COVERED |
| Gallery Scroll Container (scrolled, restored states) | Container | workspace-content.tsx | Slice 03 (refs), Slice 04 (save/restore) | COVERED |

### State Machine Coverage

| State | Required UI | Available Actions | Covered In | Status |
|-------|-------------|-------------------|------------|--------|
| `idle` | Download-Button aktiv | Download klicken | Slice 01 AC-1/AC-2 (download triggers), Slice 02 AC-1 (resolves to idle) | COVERED |
| `downloading` | Spinner auf Button | Warten | Slice 01 (fetch + blob), Slice 02 AC-3 (double-click guard via isDownloading) | COVERED |
| `sharing` | iOS Share-Sheet offen | Aktion waehlen oder abbrechen | Slice 01 AC-1 (share call), AC-3 (AbortError on dismiss) | COVERED |
| `error` | Toast "Download fehlgeschlagen" | Erneut versuchen | Slice 01 AC-4 (re-throw), Slice 02 AC-2 (toast.error) | COVERED |

### Transitions Coverage

| From | Trigger | To | Covered In | Status |
|------|---------|-----|------------|--------|
| `idle` | Download-Button Click | `downloading` | Slice 02 AC-3 (isDownloading guard), Slice 01 (fetch starts) | COVERED |
| `downloading` | Fetch complete + canShare=true | `sharing` | Slice 01 AC-1 (canShare true -> navigator.share) | COVERED |
| `downloading` | Fetch complete + canShare=false | `idle` (Anchor fallback) | Slice 01 AC-2 (anchor-click fallback) | COVERED |
| `downloading` | Fetch error | `error` | Slice 01 AC-5 (regression, existing fetch error handling), Slice 02 AC-2 (toast) | COVERED |
| `sharing` | User waehlt Aktion / schliesst Sheet | `idle` | Slice 01 AC-3 (AbortError silent), AC-1 (success resolve) | COVERED |
| `error` | Toast verschwindet nach Timeout | `idle` | Existing behavior (sonner auto-dismiss), no slice change needed | COVERED |

### Business Rules Coverage

| Rule | Covered In | Status |
|------|------------|--------|
| iOS/iPadOS-Erkennung via Feature Detection (Post-Fetch) | Slice 01 AC-1 (canShare after blob fetch), Constraints (Feature Detection via canShare NACH Blob-Fetch) | COVERED |
| Kein User-Agent-Sniffing | Slice 01 Constraints (KEINE User-Agent-Sniffing, Feature Detection) | COVERED |
| Fallback auf Anchor-Download wenn Web Share nicht verfuegbar | Slice 01 AC-2 (anchor-click fallback) | COVERED |
| AbortError bei Share-Sheet Dismiss silent catchen | Slice 01 AC-3 (AbortError resolves silently) | COVERED |
| URL.revokeObjectURL() erst NACH Share-Abschluss | Slice 01 AC-1 (revokeObjectURL after share), AC-3/AC-4 (revokeObjectURL trotzdem) | COVERED |
| Scroll-Position nur im Memory (useRef), nicht persistiert | Slice 03 (useRef declarations), Slice 04 Constraints (kein localStorage) | COVERED |
| Scroll-Restore nur fuer Gallery-Scroll-Container | Slice 03 AC-2 (ref on gallery container only), Slice 04 (only gallery handlers) | COVERED |
| Scroll-Restore Timing: requestAnimationFrame nach State-Update | Slice 04 AC-2 (rAF after setDetailViewOpen(false)), AC-4 (inside startViewTransitionIfSupported) | COVERED |

### Data Fields Coverage

| Field | Required | Covered In | Status |
|-------|----------|------------|--------|
| `scrollTopRef` (useRef<number>, Default 0) | -- | Slice 03 AC-1 (declared), Slice 04 AC-1/AC-2 (used) | COVERED |
| `galleryScrollRef` (useRef<HTMLDivElement>) | -- | Slice 03 AC-1/AC-2 (declared + attached), Slice 04 AC-1/AC-2 (used) | COVERED |

**Discovery Coverage:** 22/22 (100%)

---

## Summary

| Metric | Value |
|--------|-------|
| Total Slices | 4 |
| Total Connections | 3 |
| Valid Connections | 3 |
| Missing Inputs | 0 |
| Orphaned Outputs | 0 |
| Deliverable-Consumer Gaps | 0 |
| Runtime Path Gaps | 0 |
| Semantic Consistency Gaps | 0 |
| Infrastructure Prerequisites | 0 |
| Discovery Coverage | 100% |

**Verdict:** READY FOR ORCHESTRATION
