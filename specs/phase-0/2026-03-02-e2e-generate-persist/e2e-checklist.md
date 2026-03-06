# E2E Checklist: E2E Generate & Persist

**Integration Map:** `integration-map.md`
**Generated:** 2026-03-04

---

## Pre-Conditions

- [x] All slices APPROVED (Gate 2) -- 21/21 APPROVED
- [ ] Architecture APPROVED (Gate 1)
- [x] Integration Map has no MISSING INPUTS -- 0 missing

---

## Happy Path Tests

### Flow 1: Project Creation and Image Generation

1. [ ] **Slice 04:** Open root page `/` -- Project Overview renders with empty state "Create your first project"
2. [ ] **Slice 04:** Click `[+ New Project]` -- Inline input appears, auto-focused
3. [ ] **Slice 04:** Type "My Design" and press Enter -- `createProject` action called, new card appears in grid
4. [ ] **Slice 04:** Click on the new project card -- Navigation to `/projects/{id}`
5. [ ] **Slice 05:** Workspace page loads -- Sidebar visible with project list, main area shows placeholder
6. [ ] **Slice 09:** Model dropdown shows 6 models with name + price -- First model pre-selected
7. [ ] **Slice 09:** Select different model -- `getModelSchema` called, parameter panel re-renders with new controls
8. [ ] **Slice 09:** Type prompt "A fox in oil painting style" -- Textarea auto-resizes
9. [ ] **Slice 09:** Press Cmd/Ctrl+Enter -- `generateImages` called with projectId, prompt, modelId, params, count:1
10. [ ] **Slice 10:** Loading placeholder appears in gallery area -- Skeleton animation visible
11. [ ] **Slice 10:** Polling detects status change to "completed" -- Placeholder replaced by finished image
12. [ ] **Slice 11:** Image appears as GenerationCard in GalleryGrid -- Sorted newest first

### Flow 2: Prompt Builder Usage

1. [ ] **Slice 17:** Click "Prompt Builder" button -- Drawer opens from right with title "Prompt Builder"
2. [ ] **Slice 17:** Style tab is active by default -- 9 style options visible in 3x3 grid
3. [ ] **Slice 17:** Click "Oil Painting" chip -- Chip highlighted, live preview shows "A fox, oil painting"
4. [ ] **Slice 17:** Switch to Colors tab -- 9 color options visible, style selection preserved
5. [ ] **Slice 17:** Click "Warm Tones" chip -- Live preview shows "A fox, oil painting, warm tones"
6. [ ] **Slice 17:** Click Done -- Drawer closes, composed prompt transferred to textarea
7. [ ] **Slice 18:** Reopen builder, click "Surprise Me" (no existing selection) -- Random style + color selected
8. [ ] **Slice 18:** With existing selection, click "Surprise Me" -- Confirmation dialog appears
9. [ ] **Slice 20:** Switch to "My Snippets" tab -- Empty state "No snippets yet. Create your first!"
10. [ ] **Slice 20:** Click "New Snippet", enter text "on white background", category "POD Basics", save -- Snippet appears under "POD Basics" header
11. [ ] **Slice 20:** Click snippet chip -- Chip highlighted, text added to live preview

### Flow 3: LLM Prompt Improvement

1. [ ] **Slice 21:** With prompt "A fox" in textarea, click "Improve Prompt" -- Loading state with "Improving prompt..."
2. [ ] **Slice 21:** LLM responds -- Side-by-side panels: "Original" (left) and "Improved" (right) with Adopt/Discard buttons
3. [ ] **Slice 21:** Click "Adopt" -- Improved prompt replaces original in textarea, panel closes
4. [ ] **Slice 21:** Repeat with "Discard" -- Panel closes, original prompt unchanged

### Flow 4: Lightbox and Variation

1. [ ] **Slice 11:** Click on a generation card in gallery -- `onSelect` callback fires
2. [ ] **Slice 12:** Lightbox modal opens -- Large centered image, detail panel (prompt, model, params, dimensions, date)
3. [ ] **Slice 13:** Click next chevron -- Next generation displayed
4. [ ] **Slice 13:** Press right arrow key -- Next generation displayed
5. [ ] **Slice 13:** At last image, click next -- Wraps to first image
6. [ ] **Slice 14:** Click "Variation" button -- Lightbox closes, prompt/model/params transferred to workspace inputs
7. [ ] **Slice 09:** Prompt textarea shows transferred prompt, model dropdown shows transferred model, parameter panel shows transferred params
8. [ ] **Slice 09:** Change variant count to 3, click Generate -- `generateImages` called with count:3

### Flow 5: Snippet CRUD

1. [ ] **Slice 19:** `createSnippet({ text: "centered", category: "POD" })` -- Returns snippet with UUID
2. [ ] **Slice 19:** `getSnippets()` -- Returns `{ "POD": [snippet] }`
3. [ ] **Slice 19:** `updateSnippet({ id, text: "centered, clean", category: "POD" })` -- Returns updated snippet
4. [ ] **Slice 19:** `deleteSnippet({ id })` -- Returns `{ success: true }`

### Flow 6: Download PNG

1. [ ] **Slice 15:** In lightbox, click "Download PNG" -- Loading spinner on button
2. [ ] **Slice 15:** Download completes -- File saved as `a-fox-in-oil-painting-style_{date}.png`
3. [ ] **Slice 15:** Button returns to default state

### Flow 7: Delete Project

1. [ ] **Slice 04:** Click delete icon on project card -- Confirmation dialog: "Delete project and all generations?"
2. [ ] **Slice 04:** Click "Delete" -- Project and all generations removed, card disappears
3. [ ] **Slice 04:** Click "Cancel" instead -- Dialog closes, project preserved

### Flow 8: Delete Generation from Lightbox

1. [ ] **Slice 13:** In lightbox, click delete button -- Confirmation dialog "Delete this generation?"
2. [ ] **Slice 13:** Click "Delete" -- `deleteGeneration` called, DB entry removed, R2 image removed, lightbox shows next image
3. [ ] **Slice 13:** Cancel -- Dialog closes, generation preserved

---

## Edge Cases

### Error Handling

- [ ] **Slice 08:** Replicate API returns error -- Generation status set to "failed" with error_message in DB
- [ ] **Slice 08:** R2 upload fails after successful Replicate call -- Generation status set to "failed"
- [ ] **Slice 08:** 3 generations: 1 fails, 2 succeed -- Failed one marked "failed", other 2 complete independently
- [ ] **Slice 16:** Failed generation shows error state -- Toast notification with error message
- [ ] **Slice 16:** Click Retry on failed generation -- `retryGeneration` called, placeholder returns to pending state
- [ ] **Slice 16:** Retry fails -- Error toast shown
- [ ] **Slice 16:** Rate limit (429) -- Toast: "Zu viele Anfragen. Bitte kurz warten."
- [ ] **Slice 21:** LLM improvement fails -- Toast "Prompt-Verbesserung fehlgeschlagen", panel closes automatically
- [ ] **Slice 15:** Download fetch fails -- Toast "Download fehlgeschlagen"

### Input Validation

- [ ] **Slice 03:** Empty project name -- Error `{ error: "Projektname darf nicht leer sein" }`
- [ ] **Slice 03:** Project name > 255 chars -- Error returned
- [ ] **Slice 03:** Project name with whitespace -- Trimmed before save
- [ ] **Slice 08:** Empty prompt -- Error `{ error: "Prompt darf nicht leer sein" }`
- [ ] **Slice 08:** Unknown modelId -- Error `{ error: "Unbekanntes Modell" }`
- [ ] **Slice 08:** Count = 5 -- Error `{ error: "Anzahl muss zwischen 1 und 4 liegen" }`
- [ ] **Slice 08:** Retry non-failed generation -- Error `{ error: "Nur fehlgeschlagene Generierungen koennen wiederholt werden" }`
- [ ] **Slice 19:** Empty snippet text -- Error "Snippet-Text darf nicht leer sein"
- [ ] **Slice 19:** Snippet text > 500 chars -- Error
- [ ] **Slice 19:** Empty category -- Error "Kategorie darf nicht leer sein"
- [ ] **Slice 21:** Empty prompt for improve -- Error `{ error: "Prompt darf nicht leer sein" }`

### State Transitions

- [ ] `project-list` -> `workspace-empty` (click project with no generations)
- [ ] `project-list` -> `workspace-populated` (click project with generations)
- [ ] `workspace-empty` -> `workspace-ready` (enter prompt)
- [ ] `workspace-ready` -> `generating` (click Generate)
- [ ] `generating` -> `workspace-populated` (Replicate success)
- [ ] `generating` -> `generation-failed` (Replicate error)
- [ ] `generation-failed` -> `generating` (click Retry)
- [ ] `workspace-populated` -> `lightbox-open` (click image)
- [ ] `lightbox-open` -> `workspace-ready` (click Variation)
- [ ] `lightbox-open` -> `lightbox-open` (Download -- stays open)
- [ ] `lightbox-open` -> `workspace-populated` (Delete last visible -> close)
- [ ] `lightbox-open` -> `workspace-populated` (Close/Overlay click)
- [ ] `workspace-ready` -> `builder-open` (click Prompt Builder)
- [ ] `builder-open` -> `workspace-ready` (close drawer)
- [ ] `workspace-ready` -> `improving-prompt` (click Improve Prompt)
- [ ] `improving-prompt` -> `prompt-improved` (LLM responds)
- [ ] `prompt-improved` -> `workspace-ready` (Adopt or Discard)

### Boundary Conditions

- [ ] **Slice 05:** Navigate to `/projects/{non-existent-id}` -- 404 page (notFound())
- [ ] **Slice 09:** Model schema has no `negative_prompt` property -- Negative prompt input hidden
- [ ] **Slice 09:** Model schema has `negative_prompt` property -- Negative prompt input visible
- [ ] **Slice 13:** Lightbox with only 1 generation -- Prev/Next buttons hidden or disabled
- [ ] **Slice 13:** Delete only remaining generation -- Lightbox closes
- [ ] **Slice 10:** All generations complete -- Polling stops
- [ ] **Slice 10:** User navigates away -- Polling interval cleaned up
- [ ] **Slice 04:** Empty project list -- Empty state with "Create your first project" CTA
- [ ] **Slice 11:** Empty gallery -- Empty state "No generations yet. Enter a prompt and hit Generate!"
- [ ] **Slice 17:** Reopen builder after previous selections -- Previously selected chips restored
- [ ] **Slice 15:** Very long prompt (>60 chars) for download filename -- Truncated at word boundary + date

---

## Cross-Slice Integration Points

| # | Integration Point | Slices | How to Verify |
|---|-------------------|--------|---------------|
| 1 | DB Schema -> Queries -> Actions | 01 -> 02 -> 03 | Create project via action, verify DB entry |
| 2 | Project Actions -> UI -> Workspace | 03 -> 04 -> 05 | Create project, navigate, verify sidebar |
| 3 | Model Registry -> Schema Service -> Parameter Panel | 06 -> 09 | Select model, verify dynamic controls |
| 4 | Replicate + Storage -> Generation Service -> Actions | 07 -> 08 | Generate image, verify R2 upload + DB update |
| 5 | Generate Action -> Placeholder -> Polling -> Gallery | 08 -> 09 -> 10 -> 11 | Click Generate, see placeholder, wait for image |
| 6 | Gallery -> Lightbox -> Navigation | 11 -> 12 -> 13 | Click image, navigate prev/next, delete |
| 7 | Lightbox -> Variation -> PromptArea | 12 -> 14 -> 09 | Click Variation, verify fields populated |
| 8 | PromptArea -> Builder Drawer -> Prompt Concatenation | 09 -> 17 | Use builder, verify prompt updated |
| 9 | Snippet CRUD -> Snippet UI in Builder | 19 -> 20 -> 17 | Create snippet, verify in builder tab |
| 10 | PromptArea -> LLM Comparison -> Adopt/Discard | 09 -> 21 | Improve prompt, adopt, verify textarea |
| 11 | Generation failure -> Toast + Retry | 08 -> 10 -> 16 | Trigger error, verify toast and retry flow |
| 12 | Lightbox -> Download PNG | 12 -> 15 | Click download, verify file saved |
| 13 | Delete Generation -> R2 + DB cleanup | 13 -> 07 -> 02 | Delete, verify R2 object and DB entry removed |

---

## Sign-Off

| Tester | Date | Result |
|--------|------|--------|
| -- | -- | -- |

**Notes:**
All 21 slices APPROVED. Integration map shows 48 valid connections with 0 gaps. Ready for orchestrated implementation.
