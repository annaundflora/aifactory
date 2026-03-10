# E2E Checklist: Generation UI Improvements

**Integration Map:** `integration-map.md`
**Generated:** 2026-03-09

---

## Pre-Conditions

- [x] All slices APPROVED (Gate 2) — 13/13 APPROVED
- [x] Architecture APPROVED (Gate 1)
- [x] Integration Map has no MISSING INPUTS (0 missing)
- [ ] `pnpm dev` server running at `http://localhost:3000`
- [ ] Test database seeded with at least 2 projects and 6 generations
- [ ] At least 2 generations have `isFavorite = true`

---

## Happy Path Tests

### Flow 1: Aspect Ratio + Size Selection

1. [ ] **Slice 01:** `lib/aspect-ratio.ts` exports `parseRatioConfig`, `calculateDimensions`, `validateCustomRatio`, `SIZE_PRESETS` — run `pnpm test lib/aspect-ratio.test.ts`
2. [ ] **Slice 02:** `AspectRatioChips` renders all ratio chips including "Custom" — run `pnpm test components/workspace/aspect-ratio-chips.test.tsx`
3. [ ] **Slice 02:** `SizeChips` renders xs/s/m/l/xl chips with pixel values — run `pnpm test components/workspace/size-chips.test.tsx`
4. [ ] **Slice 04:** PromptArea renders all 10 layout rows with AspectRatioChips and SizeChips visible — run `pnpm test components/workspace/prompt-area`
5. [ ] **E2E:** Open workspace, select a model that supports aspect ratios — Rows 7 and 8 (ratio + size chips) are rendered
6. [ ] **E2E:** Click "16:9" ratio chip — chip becomes active (aria-pressed/data-active), size chips update if needed
7. [ ] **E2E:** Click "m" size chip — chip becomes active
8. [ ] **E2E:** Switch to a model that does not support aspect ratios — chips disappear from DOM (mapping: 'none')
9. [ ] **E2E:** Switch to a model that only supports "1:1" while "16:9" was active — ratio chip resets to "1:1" automatically

#### Sub-Flow: Custom Ratio Input

10. [ ] **E2E:** Click "Custom" chip — `CustomRatioInput` text field appears below chips
11. [ ] **E2E:** Type "0:5" in CustomRatioInput — error message "Ungueltiges Format (z.B. 21:9)" appears with red border
12. [ ] **E2E:** Type "21:9" in CustomRatioInput — no error, valid ratio accepted
13. [ ] **E2E:** Deselect Custom chip — CustomRatioInput disappears from DOM

---

### Flow 2A: Variant Stepper

14. [ ] **Slice 03:** VariantStepper renders correctly at boundaries — run `pnpm test components/workspace/variant-stepper`
15. [ ] **E2E:** PromptArea Row 10 shows `[-] 1 [+]` by default; `[-]` is disabled at value 1
16. [ ] **E2E:** Click `[+]` button — stepper shows `2`, `[-]` becomes enabled
17. [ ] **E2E:** Click `[+]` until value 4 — `[+]` becomes disabled
18. [ ] **E2E:** Generate button fills remaining width beside stepper

---

### Flow 2B: Advanced Settings Collapsible

19. [ ] **E2E:** Advanced Settings collapsible is closed by default (aria-expanded="false")
20. [ ] **E2E:** Click "Advanced Settings" header — collapsible opens, ParameterPanel is visible in DOM
21. [ ] **E2E:** Click header again — collapsible closes, ParameterPanel removed from DOM

---

### Flow 3: Bulk Select + Floating Action Bar

22. [ ] **Slice 06:** SelectionContext works correctly — run `pnpm test lib/selection-state`
23. [ ] **Slice 07:** GenerationCard checkbox overlay correct — run `pnpm test components/workspace/generation-card`
24. [ ] **Slice 08:** GalleryHeader + GalleryGrid selection mode — run `pnpm test components/workspace/gallery-header components/workspace/gallery-grid`
25. [ ] **Slice 09:** FloatingActionBar renders correctly — run `pnpm test components/workspace/floating-action-bar`
26. [ ] **E2E:** Hover over a GenerationCard — checkbox appears top-left
27. [ ] **E2E:** Click checkbox — card gets blue border, Floating Action Bar appears at bottom showing "1 ausgewaehlt"
28. [ ] **E2E:** In Selection Mode, click card body (not checkbox) — toggles selection (NOT lightbox)
29. [ ] **E2E:** Select 2 more cards — action bar shows "3 ausgewaehlt"
30. [ ] **E2E:** Gallery grid has additional bottom padding (pb-24) when selecting
31. [ ] **E2E:** "Alle auswaehlen" button — all visible cards become selected
32. [ ] **E2E:** "Abbrechen" button — all cards deselected, Floating Action Bar disappears

---

### Flow 3A: Bulk Delete

33. [ ] **Slice 05:** deleteGenerations server action — run `pnpm test lib/db/queries.test.ts app/actions/generations.test.ts`
34. [ ] **Slice 10:** workspace-content bulk integration — run `pnpm test components/workspace/__tests__/workspace-content`
35. [ ] **E2E:** Select 2 cards, click Delete button — ConfirmDialog opens with text "2 Bilder werden dauerhaft geloescht"
36. [ ] **E2E:** Click "Abbrechen" in dialog — dialog closes, selection unchanged, deleteGenerations NOT called
37. [ ] **E2E:** Click "Loeschen" — deleteGenerations called, success toast appears, selection cleared, images removed from gallery

---

### Flow 3B: Bulk Move

38. [ ] **E2E:** Select 2 cards, open Move dropdown — lists all projects except current project
39. [ ] **E2E:** Select target project "Alpha" — ConfirmDialog opens "2 Bilder nach 'Alpha' verschieben?"
40. [ ] **E2E:** Click "Verschieben" — moveGenerations called with correct ids + targetProjectId, success toast appears, selection cleared
41. [ ] **E2E:** Images disappear from current gallery (revalidatePath triggered)

---

### Flow 3C: Bulk Favorite

42. [ ] **E2E:** Select 3 cards, click Favorite button — toggleFavorites called with `{ ids: [...], favorite: true }`, success toast appears

---

### Flow 3D: Bulk Download (ZIP)

43. [ ] **Slice 11:** ZIP route returns correct ZIP — run `pnpm test app/api/download-zip/route.test.ts`
44. [ ] **E2E:** Select 2 cards, click Download button — `fetch("/api/download-zip?ids=id1,id2")` called
45. [ ] **E2E:** Response is a valid ZIP file, browser download triggers automatically
46. [ ] **E2E:** Downloaded ZIP contains files named `{generation-id}.png`

---

### Flow 3E: Bulk Compare

47. [ ] **Slice 12:** CompareModal renders correctly — run `pnpm test components/compare/compare-modal`
48. [ ] **E2E:** Select 1 card — Compare button in action bar is disabled with tooltip "2-4 Bilder auswaehlen zum Vergleichen"
49. [ ] **E2E:** Select 5 cards — Compare button is disabled
50. [ ] **E2E:** Select exactly 2 cards — Compare button becomes active
51. [ ] **E2E:** Click Compare — CompareModal opens fullscreen with 2 images and 2 empty slots (dashed border)
52. [ ] **E2E:** Each image shows label format "{ModelDisplayName} · {width} x {height}"
53. [ ] **E2E:** Click Fullscreen-Toggle on one image — only that image is visible (single-image mode)
54. [ ] **E2E:** Press ESC — returns to 2x2 grid view
55. [ ] **E2E:** Click X in modal header — modal closes, `onClose` called

---

### Flow 4: Favoriten-Filter

56. [ ] **E2E:** Click Star-Icon in Gallery Header — gallery filters to show only `isFavorite = true` images
57. [ ] **E2E:** Star-Icon shows active state (filled/text-primary CSS class)
58. [ ] **E2E:** Click Star-Icon again — all images visible again
59. [ ] **E2E:** With filter active and 0 favorites — empty state message shown (e.g. "Keine Favoriten")

---

### Flow 5: Lightbox Move (Single Image)

60. [ ] **Slice 13:** Lightbox extensions — run `pnpm test components/lightbox`
61. [ ] **E2E:** Open Lightbox on a generation — Move button/dropdown visible in lightbox actions
62. [ ] **E2E:** Open Move dropdown in lightbox — shows all projects except current project
63. [ ] **E2E:** Select target project "Beta" — moveGeneration called with `{ id: currentId, targetProjectId: beta.id }`
64. [ ] **E2E:** Success → toast "Image moved to 'Beta'", lightbox closes, gallery refreshes

---

### Flow 6: Lightbox Compare Selection

65. [ ] **E2E:** Open Lightbox — checkbox visible (unchecked) on image top-left
66. [ ] **E2E:** Click checkbox — image ID added to SelectionContext, LightboxCompareBar appears showing "1 selected", Compare button disabled
67. [ ] **E2E:** Navigate to another image via Lightbox navigation, click its checkbox — LightboxCompareBar shows "2 selected", Compare button becomes active
68. [ ] **E2E:** Click Compare — CompareModal opens with 2 selected generation objects
69. [ ] **E2E:** With 4 images selected, checkbox on 5th image is disabled with tooltip "Max 4 images"
70. [ ] **E2E:** Click "Abbrechen" in LightboxCompareBar — deselectAll called, compare bar disappears

---

## Edge Cases

### Error Handling

- [ ] **deleteGenerations DB error** → error toast shown, selection NOT cleared, dialog closes
- [ ] **moveGenerations DB error** → error toast shown, selection NOT cleared
- [ ] **moveGeneration (lightbox) error** → error toast shown, lightbox stays open
- [ ] **ZIP download — more than 50 IDs** → 400 response, error toast shown
- [ ] **ZIP download — R2 fetch fails for 1 of 3 images** → ZIP still returns with remaining 2 images, failed image skipped
- [ ] **ZIP download — DB error** → 500 response, "Download fehlgeschlagen" toast
- [ ] **Custom ratio "abc:9"** → validation error "Ungueltiges Format (z.B. 21:9)"
- [ ] **Custom ratio "21:2" (>10:1 ratio)** → validation error "Verhaeltnis darf max 10:1 sein"
- [ ] **Bulk action with empty ids array** → `{ error: string }` returned, no DB operation

### State Transitions

- [ ] `gallery-default` → `gallery-selecting` (first checkbox click)
- [ ] `gallery-selecting` → `gallery-default` (last item deselected)
- [ ] `gallery-selecting` → `gallery-default` (Abbrechen button)
- [ ] `gallery-selecting` → `compare-grid` (Compare button, 2-4 selected)
- [ ] `compare-grid` → `compare-fullscreen` (Fullscreen-Toggle click)
- [ ] `compare-fullscreen` → `compare-grid` (ESC key)
- [ ] `compare-fullscreen` → `compare-grid` (X button in single-image mode)
- [ ] Lightbox → `lightbox-compare-select` (checkbox click on image)
- [ ] `lightbox-compare-select` → `compare-grid` (Compare button)
- [ ] `lightbox-compare-select` → Lightbox normal (Abbrechen)

### Boundary Conditions

- [ ] **compareModal with exactly 2 images** → 2 filled cells + 2 dashed-border empty slots
- [ ] **compareModal with exactly 3 images** → 3 filled cells + 1 dashed-border empty slot (bottom-right)
- [ ] **compareModal with exactly 4 images** → all 4 cells filled, no empty slots
- [ ] **VariantStepper at min (1)** → `[-]` disabled, `[+]` enabled
- [ ] **VariantStepper at max (4)** → `[-]` enabled, `[+]` disabled
- [ ] **Bulk operations limit > 100 IDs** → `{ error: "Zu viele Bilder ausgewaehlt" }`
- [ ] **moveGeneration to same project** → `{ error: string }` returned
- [ ] **FloatingActionBar with 0 selections** → component not mounted (null, not hidden)

---

## Cross-Slice Integration Points

| # | Integration Point | Slices | How to Verify |
|---|-------------------|--------|---------------|
| 1 | `lib/aspect-ratio.ts` exports consumed by chips | 01 → 02, 04 | `pnpm test lib/aspect-ratio.test.ts components/workspace/aspect-ratio-chips.test.tsx components/workspace/size-chips.test.tsx` |
| 2 | AspectRatioChips + SizeChips mounted in PromptArea | 02 → 04 | `pnpm test components/workspace/prompt-area` |
| 3 | VariantStepper mounted in PromptArea | 03 → 04 | `pnpm test components/workspace/prompt-area` |
| 4 | SelectionContext used in GenerationCard | 06 → 07 | `pnpm test components/workspace/generation-card` with mocked useSelection |
| 5 | GenerationCard (modified) used in GalleryGrid | 07 → 08 | `pnpm test components/workspace/gallery-grid` |
| 6 | GalleryHeader + GalleryGrid mounted in WorkspaceContent | 08 → 10 | `pnpm test components/workspace/__tests__/workspace-content` |
| 7 | FloatingActionBar mounted in WorkspaceContent | 09 → 10 | `pnpm test components/workspace/__tests__/workspace-content` |
| 8 | SelectionProvider wrapping WorkspaceContent | 06 → 10 | `pnpm test components/workspace/__tests__/workspace-content` |
| 9 | deleteGenerations/moveGenerations/toggleFavorites called from WorkspaceContent | 05 → 10 | `pnpm test components/workspace/__tests__/workspace-content` (server actions mocked) |
| 10 | ZIP route called via fetch from WorkspaceContent | 11 → 10 | `pnpm test components/workspace/__tests__/workspace-content` (fetch mocked) |
| 11 | CompareModal mounted in WorkspaceContent | 12 → 10 | `pnpm test components/workspace/__tests__/workspace-content` |
| 12 | moveGeneration called from LightboxModal via LightboxMoveDropdown | 05 → 13 | `pnpm test components/lightbox` |
| 13 | CompareModal mounted in LightboxModal | 12 → 13 | `pnpm test components/lightbox` |
| 14 | useSelection used in LightboxModal | 06 → 13 | `pnpm test components/lightbox` |

---

## Full Test Suite

Run all tests in dependency order:

```
pnpm test lib/aspect-ratio.test.ts
pnpm test lib/selection-state
pnpm test lib/db/queries.test.ts app/actions/generations.test.ts
pnpm test components/workspace/aspect-ratio-chips.test.tsx components/workspace/size-chips.test.tsx
pnpm test components/workspace/variant-stepper
pnpm test components/workspace/generation-card
pnpm test components/workspace/gallery-header components/workspace/gallery-grid
pnpm test components/workspace/floating-action-bar
pnpm test components/compare/compare-modal
pnpm test app/api/download-zip/route.test.ts
pnpm test components/lightbox
pnpm test components/workspace/__tests__/workspace-content
pnpm test components/workspace/prompt-area
```

---

## Sign-Off

| Tester | Date | Result |
|--------|------|--------|
| Orchestrator | — | — |

**Notes:**
All unit tests must pass before E2E validation. E2E validation requires a running dev server (`pnpm dev`) with seeded test data.
