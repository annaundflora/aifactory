# E2E Checklist: Quality Improvements

**Integration Map:** `integration-map.md`
**Generated:** 2026-03-07

---

## Pre-Conditions

- [x] All slices APPROVED (Gate 2) -- 21/21
- [x] Architecture APPROVED (Gate 1)
- [x] Integration Map has no MISSING INPUTS

---

## Happy Path Tests

### Flow 1: Structured Prompt Input + Generation

1. [ ] **Slice 07:** Open a project -- Prompt area shows 3 sections: Motiv (required marker), Style/Modifier, Negative Prompt
2. [ ] **Slice 07:** Type "A red fox in a forest" in Motiv field -- field accepts input, auto-resizes
3. [ ] **Slice 07:** Type "watercolor painting" in Style field -- field accepts input
4. [ ] **Slice 07:** Generate button is enabled (Motiv not empty)
5. [ ] **Slice 06:** Click "Generate" -- `generateImages` called with `promptMotiv: "A red fox in a forest"`, `promptStyle: "watercolor painting"`
6. [ ] **Slice 06:** Generation created in DB with `prompt = "A red fox in a forest. watercolor painting"`, `prompt_motiv = "A red fox in a forest"`, `prompt_style = "watercolor painting"`
7. [ ] **Slice 07:** Verify Generate button disabled when Motiv is empty

### Flow 2: Builder Pro

1. [ ] **Slice 10:** Click "Builder" button -- Drawer opens from right
2. [ ] **Slice 10:** Drawer shows 6 tabs in 2 rows: Style, Colors, Composition (row 1), Lighting, Mood, My Snippets (row 2)
3. [ ] **Slice 10:** Click "Oil Painting" chip in Style tab -- chip becomes highlighted
4. [ ] **Slice 10:** Switch to Lighting tab, click "Golden Hour" -- chip highlighted
5. [ ] **Slice 10:** Preview section shows composed fragment text (Oil Painting fragment + Golden Hour fragment, separated by ", ")
6. [ ] **Slice 10:** Click "Done" -- Drawer closes, Style/Modifier field populated with composed fragment text
7. [ ] **Slice 07:** Verify Style field contains the composed text (not Motiv field)

### Flow 3: Adaptive Improve

1. [ ] **Slice 18:** Type "sunset beach" in Motiv field, select a model (e.g., FLUX 2 Pro)
2. [ ] **Slice 18:** Click "Improve" -- Modal opens with title "Improve Prompt"
3. [ ] **Slice 18:** Modal shows loading state: Original prompt on left, Skeleton on right, "Improving prompt..." text
4. [ ] **Slice 14:** Verify OpenRouter receives system prompt with model name and analysis instructions
5. [ ] **Slice 18:** After LLM response -- Modal shows Side-by-Side: Original (left) vs Improved (right), Badge "Optimized for: FLUX 2 Pro"
6. [ ] **Slice 18:** Click "Adopt" -- Modal closes, improved prompt replaces Motiv field
7. [ ] **Slice 18:** Re-do flow, click "Discard" -- Modal closes, Motiv field unchanged

### Flow 4: Prompt History

1. [ ] **Slice 08:** Click "History" tab -- Tab switches to History content
2. [ ] **Slice 12:** History list shows past generations with: truncated prompt preview (max 80 chars), model badge, relative timestamp, star icon
3. [ ] **Slice 12:** Click star on an entry -- Star becomes filled, `toggleFavorite` called
4. [ ] **Slice 12:** Click on a history entry with empty prompt fields -- All 3 fields populate, tab switches to "Prompt"
5. [ ] **Slice 12:** Type something in Motiv field, click another history entry -- Confirmation dialog "Replace current prompt?" appears
6. [ ] **Slice 12:** Click "Apply" -- Fields replaced, tab switches to "Prompt"
7. [ ] **Slice 12:** Repeat with "Cancel" -- Fields unchanged
8. [ ] **Slice 12:** Verify empty state message when no history exists: "No prompts generated yet. Start your first generation!"

### Flow 5: Favorites

1. [ ] **Slice 08:** Click "Favorites" tab
2. [ ] **Slice 13:** Favorites list shows only entries with filled star
3. [ ] **Slice 13:** Click star on a favorite -- Star unfills, entry disappears from list
4. [ ] **Slice 13:** Click on a favorite entry -- Same load/confirm behavior as History
5. [ ] **Slice 13:** Verify empty state: "No favorites yet. Star prompts in History to save them here."

### Flow 6: Templates

1. [ ] **Slice 15:** In Prompt tab, click "Templates" button -- Dropdown opens with 5 options
2. [ ] **Slice 15:** Click "Product Shot" with empty fields -- All 3 fields populated with template values
3. [ ] **Slice 15:** Type something in Motiv, click "Landscape" -- Confirmation dialog appears
4. [ ] **Slice 15:** Click "Apply" -- Fields replaced with Landscape template values
5. [ ] **Slice 15:** Click "Cancel" -- Fields unchanged

### Flow 7: Lightbox Fullscreen

1. [ ] **Slice 19:** Click an image in gallery -- Lightbox opens (normal mode, max-h-[70vh])
2. [ ] **Slice 19:** Click fullscreen toggle (Maximize2 icon) -- Image fills viewport, details panel hidden, black background
3. [ ] **Slice 19:** Click navigation arrows -- Navigate between images while staying in fullscreen
4. [ ] **Slice 19:** Click fullscreen toggle again (Minimize2 icon) -- Back to normal mode
5. [ ] **Slice 19:** In fullscreen, press ESC -- Returns to normal mode (not close)
6. [ ] **Slice 19:** In normal mode, press ESC -- Closes lightbox
7. [ ] **Slice 19:** Close and reopen lightbox -- Starts in normal mode

### Flow 8: Sidebar Collapse

1. [ ] **Slice 05:** Open workspace -- Sidebar visible with project list
2. [ ] **Slice 04:** Click collapse toggle -- Sidebar collapses to icon mode (initials)
3. [ ] **Slice 04:** Hover over initial -- Tooltip shows full project name
4. [ ] **Slice 04:** Click expand toggle -- Sidebar returns to full width
5. [ ] **Slice 05:** Press Ctrl+B -- Sidebar toggles
6. [ ] **Slice 04:** Collapse sidebar, reload page -- Sidebar stays collapsed (cookie persistence)
7. [ ] **Slice 05:** On mobile (< 768px) -- Hamburger button visible, sidebar opens as overlay drawer

### Flow 9: Project Thumbnails

1. [ ] **Slice 17:** Create a new project -- Thumbnail generation starts (fire-and-forget)
2. [ ] **Slice 17:** Project card shows pulse animation while pending
3. [ ] **Slice 16:** Thumbnail flow: LLM generates prompt from name -> Replicate generates image -> Sharp resizes to 512x512 -> R2 upload -> DB update
4. [ ] **Slice 17:** After completion -- Project card shows generated thumbnail
5. [ ] **Slice 17:** Hover over project card -- Refresh button visible alongside Edit/Delete
6. [ ] **Slice 17:** Click refresh button -- Spinning icon, new thumbnail generated
7. [ ] **Slice 17:** On failure -- Gray placeholder stays, no error shown to user

---

## Edge Cases

### Error Handling

- [ ] Improve LLM call fails -> Toast "Prompt-Verbesserung fehlgeschlagen", modal closes automatically (Slice 18 AC-6)
- [ ] Thumbnail generation fails -> `thumbnail_status = 'failed'`, gray placeholder stays (Slice 16 AC-5)
- [ ] Empty Motiv field + Generate click -> Button is disabled (Slice 07 AC-2)
- [ ] Invalid UUID for toggleFavorite -> Error returned (Slice 11 AC-7/11)
- [ ] OpenRouter timeout exceeded -> Descriptive error with timeout duration (Slice 20 AC-3)
- [ ] Empty modelId for improvePrompt -> Validation error (Slice 14 AC-7)

### State Transitions

- [ ] `prompt-input` -> `history-view` (click History tab) -> `prompt-input` (click entry)
- [ ] `prompt-input` -> `favorites-view` (click Favorites tab) -> `prompt-input` (click entry)
- [ ] `prompt-input` -> `builder-open` (click Builder) -> `prompt-input` (click Done)
- [ ] `prompt-input` -> `improve-loading` (click Improve) -> `improve-compare` (LLM response) -> `prompt-input` (Adopt/Discard)
- [ ] `lightbox-normal` -> `lightbox-fullscreen` (toggle) -> `lightbox-normal` (toggle/ESC)
- [ ] `sidebar-expanded` -> `sidebar-collapsed` (collapse) -> `sidebar-expanded` (expand)

### Boundary Conditions

- [ ] History with > 50 entries -> First 50 load, scroll-to-load-more loads next 50 (Slice 12 AC-6/7)
- [ ] Prompt preview truncation at exactly 80 characters (Slice 12 AC-2/3)
- [ ] Negative Prompt field hidden for models without `negative_prompt` support (Slice 07 AC-4)
- [ ] Builder fragment text minimum 20 characters (Slice 09 AC-4)
- [ ] All fragment IDs globally unique across categories (Slice 09 AC-5)
- [ ] Prompt with only whitespace in Motiv -> Generate disabled (Slice 07 AC-2)
- [ ] Existing generations backfilled: `prompt_motiv = prompt` (Slice 21 AC-7)

---

## Cross-Slice Integration Points

| # | Integration Point | Slices | How to Verify |
|---|-------------------|--------|---------------|
| 1 | Schema -> Service | 01 -> 06 | Generate with structured fields, check DB columns populated |
| 2 | Schema -> History | 01 -> 11 | Query history after generation, verify prompt_motiv/style/isFavorite |
| 3 | Schema -> Migration | 01+02 -> 21 | Run drizzle-kit migrate, verify columns exist in live DB |
| 4 | Sidebar Setup -> Content -> Layout | 03 -> 04 -> 05 | Full sidebar works: collapse, expand, mobile drawer |
| 5 | Service -> UI | 06 -> 07 | Type in structured fields, generate, verify composite prompt |
| 6 | Prompt Area -> Tabs | 07 -> 08 | Tabs visible, prompt content in Prompt tab, switching works |
| 7 | Builder Config -> Drawer | 09 -> 10 | Open builder, see 5 categories with articulated fragments |
| 8 | History Service -> History UI | 11 -> 12 | History tab shows entries from DB, star toggle works |
| 9 | History UI -> Favorites UI | 12 -> 13 | Star in history, see in favorites, unstar removes from favorites |
| 10 | Tabs -> Templates | 08 -> 15 | Template button in prompt tab, selection fills all fields |
| 11 | Thumbnail Service -> Card | 16 -> 17 | Create project, see thumbnail appear on card |
| 12 | Improve Service -> Modal | 14 -> 18 | Click improve, see modal with model-specific optimization |
| 13 | prompt-area.tsx multi-slice | 07+08+15+18 | All features work together: structured fields, tabs, templates, improve |
| 14 | OpenRouter Timeout -> Consumers | 20 -> 14, 16 | Improve and thumbnail calls respect timeout settings |

---

## Sign-Off

| Tester | Date | Result |
|--------|------|--------|
| | | |

**Notes:**
- `prompt-area.tsx` is modified by 4 slices (07, 08, 15, 18) -- verify no regressions after each
- `lib/db/schema.ts` is modified by 2 slices (01, 02) -- verify both table extensions coexist
- `app/actions/prompts.ts` is modified by 2 slices (11, 14) -- verify all actions work together
- shadcn Dialog component may need installation (`npx shadcn@latest add dialog`) before Slice 18
- DB migration (Slice 21) should be run before testing any DB-dependent features in production
