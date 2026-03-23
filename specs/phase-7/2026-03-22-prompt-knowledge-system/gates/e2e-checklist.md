# E2E Checklist: Model-Aware Prompt Knowledge System

**Integration Map:** `integration-map.md`
**Generated:** 2026-03-23

---

## Pre-Conditions

- [x] All slices APPROVED (Gate 2) -- 13/13 APPROVED
- [x] Architecture APPROVED (Gate 1)
- [x] Integration Map has no MISSING INPUTS -- 0 missing

---

## Happy Path Tests

### Flow 1: Improver with Known Model + txt2img

1. [ ] **Slice 01+11:** `data/prompt-knowledge.json` exists with `flux-2` entry containing `tips` and `modes.txt2img.tips`
2. [ ] **Slice 02:** `getPromptKnowledge("black-forest-labs/flux-2-pro", "txt2img")` returns flux-2 model knowledge with txt2img mode tips
3. [ ] **Slice 04:** `buildSystemPrompt("black-forest-labs/flux-2-pro", "Flux 2 Pro", "txt2img")` returns system prompt with Flux-specific tips and txt2img tips, no old static hints
4. [ ] **Slice 05:** `improvePrompt({ prompt: "a cat", modelId: "black-forest-labs/flux-2-pro", generationMode: "txt2img" })` passes generationMode to `PromptService.improve`
5. [ ] **Slice 05:** `prompt-area.tsx` renders `<LLMComparison ... generationMode={currentMode} />`
6. [ ] **Slice 12:** Integration test: System prompt contains both Flux model tips AND txt2img mode tips

### Flow 2: Improver with Known Model + img2img

1. [ ] **Slice 04:** `buildSystemPrompt("black-forest-labs/flux-2-pro", "Flux 2 Pro", "img2img")` returns system prompt with Flux model tips AND img2img-specific tips
2. [ ] **Slice 05:** `improvePrompt` with `generationMode: "img2img"` passes value through to service
3. [ ] **Slice 12:** Integration test: Flux + img2img contains img2img tips, does NOT contain txt2img tips

### Flow 3: Improver with Unknown Model (Fallback)

1. [ ] **Slice 02:** `getPromptKnowledge("unknown-vendor/mystery-model")` returns fallback with `displayName: "Generic"`
2. [ ] **Slice 04:** `buildSystemPrompt("unknown-vendor/mystery-model", "Mystery", "txt2img")` returns system prompt with generic fallback tips
3. [ ] **Slice 12:** Integration test: Unknown model returns fallback tips, no model-specific tips

### Flow 4: Assistant with Model Context

1. [ ] **Slice 03:** `get_prompt_knowledge("flux-2-pro", "txt2img")` returns flux-2 knowledge with txt2img mode
2. [ ] **Slice 06:** `build_assistant_system_prompt("flux-2-pro", "txt2img")` returns base prompt + Flux knowledge section
3. [ ] **Slice 06:** `build_assistant_system_prompt(None, None)` returns base prompt without knowledge (backward compat)
4. [ ] **Slice 07:** POST `/sessions/{id}/messages` with `image_model_id` + `generation_mode` validates correctly (200)
5. [ ] **Slice 07:** POST `/sessions/{id}/messages` without new fields validates correctly (backward compat, 200)
6. [ ] **Slice 07:** `stream_response` sets `image_model_id` and `generation_mode` in `config["configurable"]`
7. [ ] **Slice 08:** Frontend POST body includes `image_model_id` + `generation_mode` when workspace has model+mode
8. [ ] **Slice 08:** Frontend POST body omits new fields when no workspace context
9. [ ] **Slice 13:** Integration test: Assistant system prompt with Flux model contains Flux tips

### Flow 5: Assistant with Seedream Model + img2img

1. [ ] **Slice 06:** `build_assistant_system_prompt("seedream-5", "img2img")` returns base prompt + Seedream knowledge section
2. [ ] **Slice 08:** Frontend sends `image_model_id: "google/seedream-5"` and `generation_mode: "img2img"` in POST body
3. [ ] **Slice 13:** Integration test: Assistant system prompt with Seedream model contains Seedream tips

### Flow 6: Canvas Chat with Model Context

1. [ ] **Slice 09:** `build_canvas_system_prompt({"model_id": "flux-2-pro", ...})` returns prompt with knowledge block after context section
2. [ ] **Slice 09:** `build_canvas_system_prompt(None)` returns base prompt only (no crash)
3. [ ] **Slice 09:** `build_canvas_system_prompt({"model_id": "unknown-model"})` returns prompt with fallback knowledge
4. [ ] **Slice 13:** Integration test: Canvas prompt with Seedream model contains Seedream tips

### Flow 7: recommend_model with Knowledge Enrichment

1. [ ] **Slice 10:** `_match_model("product photography", ["photorealistic"], available_models)` returns reason with knowledge-specific strengths (not static reason_de)
2. [ ] **Slice 10:** `_match_model` with no-match returns `None` unchanged
3. [ ] **Slice 10:** Knowledge-unavailable scenario falls back to static reason_de
4. [ ] **Slice 13:** Integration test: match_model reason contains knowledge strengths

---

## Edge Cases

### Error Handling

- [ ] **Slice 02 AC-3:** Unknown model ID returns fallback (no crash)
- [ ] **Slice 03 AC-3:** Unknown model ID in Python returns fallback (no crash)
- [ ] **Slice 06 AC-5:** Empty string model ID treated as no-model (backward compat)
- [ ] **Slice 07 AC-3:** Invalid `generation_mode` (e.g. "inpaint") returns HTTP 422
- [ ] **Slice 07 AC-4:** `image_model_id` over 200 chars returns HTTP 422
- [ ] **Slice 08 AC-4:** Upscale mode does not send `generation_mode` (only txt2img/img2img allowed)
- [ ] **Slice 09 AC-4:** Empty dict image_context handled gracefully
- [ ] **Slice 09 AC-7:** Knowledge lookup exception does not crash canvas prompt builder
- [ ] **Slice 10 AC-5:** Knowledge file unavailable: falls back to static reason_de

### Backward Compatibility

- [ ] **Slice 04 AC-7:** `improve(prompt, modelId)` with 2 args compiles (Default txt2img)
- [ ] **Slice 05 AC-2:** `improvePrompt` without generationMode calls improve without 3rd param
- [ ] **Slice 06 AC-2:** `build_assistant_system_prompt(None, None)` returns identical base prompt
- [ ] **Slice 06 AC-7:** Config without image_model_id/generation_mode keys works
- [ ] **Slice 07 AC-2:** POST without new fields validates (200)
- [ ] **Slice 07 AC-7:** `stream_response` without new params sets None defaults
- [ ] **Slice 08 AC-3:** No workspace context = no new fields in POST body

### Prefix Matching

- [ ] **Slice 02 AC-1:** Longest prefix wins (`flux-2-pro-ultra` matches `flux-2-pro` not `flux-2`)
- [ ] **Slice 02 AC-7:** Slash stripping (`owner/model-name` -> `model-name`)
- [ ] **Slice 02 AC-8:** Model ID without slash works
- [ ] **Slice 03 AC-1:** Python longest prefix matching identical to TS
- [ ] **Slice 03 AC-12:** Cross-runtime consistency (same inputs = same outputs)

### Caching

- [ ] **Slice 02 AC-11:** TS module-level cache prevents re-reading JSON
- [ ] **Slice 03 AC-11:** Python module-level cache prevents re-reading JSON

### Mode Handling

- [ ] **Slice 02 AC-4:** txt2img mode includes mode-specific tips alongside model tips
- [ ] **Slice 02 AC-5:** Missing mode section returns model tips only (no crash)
- [ ] **Slice 02 AC-6:** Undefined mode returns model tips only

---

## Cross-Slice Integration Points

| # | Integration Point | Slices | How to Verify |
|---|-------------------|--------|---------------|
| 1 | JSON schema shared between TS and Python lookups | 01 -> 02, 03 | Slice 03 AC-12: identical outputs for identical inputs |
| 2 | Knowledge content consumed by lookups | 11 -> 02, 03 | Slice 12 + 13 integration tests with real JSON |
| 3 | TS Lookup consumed by Improver service | 02 -> 04 | Slice 04 AC-1: buildSystemPrompt uses knowledge tips |
| 4 | Python Lookup consumed by Assistant prompt | 03 -> 06 | Slice 06 AC-1: build_assistant_system_prompt uses knowledge |
| 5 | Python Lookup consumed by Canvas prompt | 03 -> 09 | Slice 09 AC-1: build_canvas_system_prompt uses knowledge |
| 6 | Python Lookup consumed by recommend_model | 03 -> 10 | Slice 10 AC-1: _match_model uses knowledge strengths |
| 7 | Improver service consumed by action+UI chain | 04 -> 05 | Slice 05 AC-6: E2E generationMode passthrough |
| 8 | Assistant prompt builder consumed via config | 06 -> 07 | Slice 07 AC-6: config contains image_model_id |
| 9 | DTO fields consumed by frontend | 07 -> 08 | Slice 08 AC-1: POST body includes new fields |
| 10 | Complete Improver chain (E2E) | 02+04+05+11 -> 12 | Slice 12: all 6 integration test ACs |
| 11 | Complete Python chain (E2E) | 03+06+09+10+11 -> 13 | Slice 13: all 7 integration test ACs |

---

## Sign-Off

| Tester | Date | Result |
|--------|------|--------|
| -- | -- | Pending |

**Notes:**
This feature has no UI changes. All verification is through unit tests, integration tests, and system prompt content inspection. The E2E validation in Slices 12 and 13 is the primary quality gate.
