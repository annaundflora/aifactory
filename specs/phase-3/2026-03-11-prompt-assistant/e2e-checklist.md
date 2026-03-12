# E2E Checklist: Prompt Assistant

**Integration Map:** `integration-map.md`
**Generated:** 2026-03-12

---

## Pre-Conditions

- [x] All slices APPROVED (Gate 2) -- 22/22 APPROVED
- [x] Architecture APPROVED (Gate 1)
- [x] Integration Map has no MISSING INPUTS -- 0 gaps

---

## Happy Path Tests

### Flow 1: Guided Prompt Creation (Discovery Happy Path 1)

1. [ ] **Slice 08:** User clicks Sparkles trigger button in PromptArea -> AssistantSheet opens from right (480px)
2. [ ] **Slice 09:** Startscreen shows "Womit kann ich dir helfen?" + 4 suggestion chips in 2x2 grid
3. [ ] **Slice 09:** Model-Selector in header shows "Sonnet 4.6" as default
4. [ ] **Slice 09/10:** User clicks "Hilf mir einen Prompt zu schreiben" chip -> chip text appears as user message bubble (right-aligned)
5. [ ] **Slice 10:** POST /api/assistant/sessions creates new session (metadata SSE event with session_id)
6. [ ] **Slice 10:** POST /api/assistant/sessions/{id}/messages sends chip text -> SSE stream starts
7. [ ] **Slice 11:** Streaming indicator (3 animated dots) appears below chat
8. [ ] **Slice 11:** Stop-button (Square icon) replaces send-button during streaming
9. [ ] **Slice 10:** Assistant message bubble (left-aligned) appears with streaming text
10. [ ] **Slice 10:** text-done SSE event marks message as complete
11. [ ] **Slice 10:** User types "Ein Portraet einer Frau im Herbstwald, fotorealistisch" -> sends
12. [ ] **Slice 12:** Agent calls draft_prompt tool -> tool-call-result SSE event received
13. [ ] **Slice 14:** Canvas panel appears, sheet expands from 480px to 780px (animated)
14. [ ] **Slice 14:** Canvas shows 3 textareas: Motiv, Style, Negative Prompt -- all filled
15. [ ] **Slice 14:** Chat thread and Canvas in split-view (50/50)
16. [ ] **Slice 15:** Apply-button at bottom of canvas is enabled
17. [ ] **Slice 15:** User clicks Apply -> button shows "Applied!" with checkmark for 2 seconds
18. [ ] **Slice 15:** Workspace fields (promptMotiv, promptStyle, negativePrompt) are filled with canvas values
19. [ ] **Slice 15:** Undo-toast appears: "Prompt uebernommen." with "Rueckgaengig" action
20. [ ] **Slice 15:** Click "Rueckgaengig" in toast -> workspace fields restored to previous values

### Flow 2: Image Analysis (Discovery Happy Path 2)

1. [ ] **Slice 08:** User opens AssistantSheet
2. [ ] **Slice 09:** User clicks "Analysiere ein Referenzbild" chip
3. [ ] **Slice 17:** Image-upload-button in chat-input opens file picker (JPEG/PNG/WebP filter)
4. [ ] **Slice 17:** User selects valid image (5MB JPEG) -> upload progress shown
5. [ ] **Slice 17:** After upload: thumbnail preview (80x80) appears above textarea
6. [ ] **Slice 17:** User types "Analysiere dieses Bild" and clicks send -> image_url sent with message
7. [ ] **Slice 17:** User message bubble shows inline thumbnail (120x120) above text
8. [ ] **Slice 16:** Backend analyze_image tool executes: download -> resize to 1024px max -> Vision LLM call
9. [ ] **Slice 16:** tool-call-result SSE event with analyze_image data (subject, style, mood, lighting, composition, palette)
10. [ ] **Slice 10:** Agent continues conversation using analysis results
11. [ ] **Slice 12:** Agent calls draft_prompt based on analysis -> Canvas appears
12. [ ] **Slice 18:** Second analysis of same image URL uses DB cache (no Vision API call)

### Flow 3: Session Resume / Iterative Loop (Discovery Happy Path 3 + Session Flow)

1. [ ] **Slice 15/19:** After Apply, user closes sheet (X button or Escape)
2. [ ] **Slice 19:** activeSessionId persists in PromptAssistantContext
3. [ ] **Slice 19:** User reopens sheet -> last active session auto-loaded (chat history + canvas visible)
4. [ ] **Slice 19:** User types "Zu dunkel, aendere den Prompt" -> sends to same session
5. [ ] **Slice 12:** Agent calls refine_prompt -> Canvas fields updated with highlight effect
6. [ ] **Slice 15/19:** User clicks Apply again -> workspace fields updated with new values

### Flow 4: Session Management

1. [ ] **Slice 13c:** User clicks session-switcher button in sheet header -> session-list view appears
2. [ ] **Slice 13b:** Session list shows entries with title, date, message count, draft indicator
3. [ ] **Slice 13b:** Sessions sorted by last_message_at DESC
4. [ ] **Slice 13c:** User clicks on a session -> loading spinner
5. [ ] **Slice 13c:** GET /api/assistant/sessions/{id} returns full state (messages + draft + recommendation)
6. [ ] **Slice 13c:** Chat history restored, Canvas visible if session had draft
7. [ ] **Slice 13c:** User clicks "Neue Session" -> navigates to startscreen with empty chat

### Flow 5: Model Recommendation

1. [ ] **Slice 20:** Agent calls recommend_model tool based on prompt intent
2. [ ] **Slice 20:** ModelService fetches from Replicate Collections API (1h cache)
3. [ ] **Slice 21:** Model recommendation badge appears below canvas textareas
4. [ ] **Slice 21:** Badge shows model name + reason + "Modell verwenden" action link
5. [ ] **Slice 21:** User clicks "Modell verwenden" -> workspace modelId updated via setVariation

### Flow 6: LLM Model Selection

1. [ ] **Slice 09:** Model-Selector dropdown shows 3 options: Sonnet 4.6, GPT-5.4, Gemini 3.1 Pro
2. [ ] **Slice 09:** User selects "GPT-5.4" -> dropdown updates
3. [ ] **Slice 10:** Next message sent with model="openai/gpt-5.4" in request body
4. [ ] **Slice 04:** Backend validates model slug (rejects unknown slugs with 422)

---

## Edge Cases

### Error Handling

- [ ] **Slice 22:** LLM API error -> SSE error event -> red error bubble with warning icon in chat
- [ ] **Slice 22:** Error bubble shows retry button when retryCount < 3
- [ ] **Slice 22:** After 3 failed retries -> permanent error message without retry button
- [ ] **Slice 22:** Backend unreachable (502) -> Toast "Assistent nicht verfuegbar" + error in chat
- [ ] **Slice 22:** Session limit (100 msgs) -> Backend returns 400 -> informational message in chat
- [ ] **Slice 04:** Rate limit exceeded (30 msg/min) -> Backend returns 429 with message
- [ ] **Slice 17:** Image > 10MB -> Toast "Bild darf maximal 10 MB gross sein"
- [ ] **Slice 17:** Invalid image format (.gif) -> Toast "Nur JPEG, PNG und WebP..."
- [ ] **Slice 17:** Image upload fails -> Toast "Bild konnte nicht hochgeladen werden"
- [ ] **Slice 16:** Image download fails -> analyze_image returns error message
- [ ] **Slice 13c:** Session load fails -> Toast "Session konnte nicht geladen werden"

### State Transitions

- [ ] **Slice 08:** Escape key closes sheet
- [ ] **Slice 08:** Trigger button toggles sheet (open/close)
- [ ] **Slice 11:** Stop-button during streaming -> preserves partial text, returns to chatting/drafting
- [ ] **Slice 11:** User can type in textarea during streaming (textarea stays active)
- [ ] **Slice 11:** Text typed during streaming is preserved after stream ends
- [ ] **Slice 14:** Canvas fields are directly editable by user (no API call, local state)
- [ ] **Slice 19:** "Verbessere meinen aktuellen Prompt" with empty workspace fields -> Agent guides to understand phase
- [ ] **Slice 19:** "Verbessere meinen aktuellen Prompt" with filled workspace fields -> fields sent as context
- [ ] **Slice 13b:** Empty session list -> shows "Noch keine Sessions vorhanden"
- [ ] **Slice 09:** Session-history link hidden when no sessions exist

### Boundary Conditions

- [ ] **Slice 04:** Message content exactly 5000 chars -> accepted
- [ ] **Slice 04:** Message content 5001 chars -> rejected (422)
- [ ] **Slice 04:** Empty message content -> rejected (422)
- [ ] **Slice 04:** Invalid model slug -> rejected (422)
- [ ] **Slice 15:** Canvas field is empty -> Apply passes empty string to workspace
- [ ] **Slice 15:** Applied state -> button disabled for 2 seconds
- [ ] **Slice 15:** Undo-toast auto-dismiss after 5 seconds
- [ ] **Slice 14:** Tab order: Motiv -> Style -> Negative Prompt
- [ ] **Slice 21:** Tab order: Negative Prompt -> Model Recommendation -> Apply Button
- [ ] **Slice 16:** Image already under 1024px -> no resize applied

---

## Cross-Slice Integration Points

| # | Integration Point | Slices | How to Verify |
|---|-------------------|--------|---------------|
| 1 | Session creation -> SSE stream | 10 -> 04 | POST /sessions returns session_id via metadata event, POST /messages uses same session_id |
| 2 | Next.js Proxy -> FastAPI | 06 -> 02/04 | Request to localhost:3000/api/assistant/health proxied to localhost:8000 |
| 3 | tool-call-result -> Canvas | 12 -> 10 -> 14 | draft_prompt tool call triggers canvas panel appearance |
| 4 | Apply -> Workspace | 14 -> 15 -> existing | Canvas fields appear in workspace prompt fields |
| 5 | Image upload -> Vision analysis | 17 -> 04 -> 16 | Uploaded image URL processed by backend analyze_image tool |
| 6 | Image cache -> DB | 16 -> 18 -> 05 | Second analysis of same URL skips Vision API |
| 7 | Session list -> Session resume | 13b -> 13c -> 03 | Click session in list loads full state from LangGraph checkpoint |
| 8 | Iterative loop persistence | 19 -> 15 -> 10 | Close/reopen sheet preserves session and canvas state |
| 9 | Model recommendation -> Workspace | 20 -> 21 -> existing | "Modell verwenden" click sets modelId in workspace |
| 10 | LangSmith tracing | 22 -> 01 -> 03 | LLM calls visible in LangSmith dashboard when env vars set |
| 11 | Legacy cleanup -> New UI | 07 -> 08 | Builder/Template buttons removed, Sparkles button appears |
| 12 | Error SSE -> Error UI | 04 -> 22 -> 10 | Backend error event renders as red bubble with retry in chat |

---

## Sign-Off

| Tester | Date | Result |
|--------|------|--------|
| -- | -- | -- |

**Notes:**
All 22 slices APPROVED at Gate 2. Integration Map shows 73 valid connections, 0 gaps. Discovery coverage 100%.
