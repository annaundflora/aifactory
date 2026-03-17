<!-- AGENT_DEF_LOADED: ux-expert-review-de-v1 -->

# UX Expert Review: Model Catalog

**Feature:** Model Catalog
**Spec Date:** 2026-03-15
**Review Date:** 2026-03-17
**Reviewer:** UX Expert Agent

---

## Summary

**Verdict:** CHANGES_REQUESTED

| ID | Title | Severity |
|----|-------|----------|
| F-1 | Workspace blocked during first-start auto-sync: no usable models | 🔴 Critical |
| F-2 | `syncing` state traps user: no cancel or escape path | 🟡 Improvement |
| F-3 | Partial-success toast dismisses before user can act on failures | 🟡 Improvement |
| F-4 | Model dropdown shows inpaint/outpaint models mixed into img2img slot | 🟡 Improvement |
| F-5 | `empty` dropdown state in wireframe does not cover pre-sync scenario for img2img/upscale | 💡 Suggestion |
| F-6 | Sync-button placement conflicts with existing close-button affordance | 💡 Suggestion |

**Totals:** 1 Critical, 3 Improvement, 2 Suggestion

---

## Workflow Analysis

### State Machine Assessment

| State | Reachable | Escapable | Notes |
|-------|-----------|-----------|-------|
| `no_models` | Yes (first start) | Yes — auto-transitions to `syncing` | No manual trigger needed |
| `syncing` | Yes (auto + manual) | Partial — only via toast completion, no user-initiated cancel | See F-2 |
| `synced` | Yes | Yes | Healthy terminal state |
| `sync_partial` | Yes | Yes — retry available | |
| `sync_failed` | Yes | Yes — retry available | Error toast is non-dismissible (correct) |

The state machine is mostly sound. The critical gap is the `no_models → synced` transition path: the workspace is fully functional during this ~20-30s window (good), but any user action that depends on models (opening Model Settings, assigning models, generating) hits empty dropdowns with no actionable path other than waiting. The wireframe acknowledges this with the `empty` state message ("Click 'Sync Models' to load") — but that message is wrong during auto-sync: the sync is already running, so telling the user to click Sync is incorrect and will trigger a second redundant sync.

### Flow 3 On-the-Fly Fetch

The on-the-fly schema fetch for models in DB but without a cached schema is well-designed. The `loading` state is placed in the Parameter Panel area (not blocking the dropdown), which is correct. No dead end here.

---

## Findings

### Finding F-1: Workspace blocked during first-start auto-sync: no usable models

**Severity:** 🔴 Critical
**Category:** Workflow / State

**Problem:**
During the ~20-30 second auto-sync on first start, the Model Settings dropdowns show the `empty` state. The empty state message instructs the user to "Click 'Sync Models' to load" — but a sync is already in progress. If the user follows this instruction, they trigger a second concurrent sync. Discovery does not define what happens when sync is triggered while already `syncing` (the `syncing` state only lists "Abbrechen (optional)" as an action). Additionally, the user cannot do any meaningful work in the workspace — prompt submission would use whatever model is currently assigned (possibly a stale `model_settings` seed value) with no visible indication that model data is incomplete.

**Context:**
> **From Discovery (State Machine):**
> ```
> | `no_models` | Dropdowns leer, Auto-Sync startet | Warten |
> | `syncing`   | Progress-Toast sichtbar, Sync-Button disabled | Abbrechen (optional) |
> ```
>
> **From Wireframe (empty state):**
> ```
> │  No models available.             │
> │  Click "Sync Models" to load.     │
> ```

**Impact:**
Two issues collide: (1) A new user's first experience is a 20-30s wait with broken dropdowns. (2) The empty state copy actively misleads the user into clicking Sync when sync is already running, creating undefined behavior. This is a guaranteed confusion point for every new installation.

**Recommendation:**
The `empty` dropdown state message must be context-aware:
- During active sync (`syncing` state): "Loading models... please wait." (no action prompt)
- After failed sync (`sync_failed` state): "Sync failed. Click 'Sync Models' to retry."
- Before any sync has ever run (edge case — should not occur since auto-sync fires immediately, but defensive): "Click 'Sync Models' to load."

Discovery should also clarify that the Sync-Button's `disabled` state applies not only to the button itself but to the entire modal's retry affordance during `syncing`.

**Affects:**
- [x] Wireframe change needed (empty state copy, context-aware message)
- [x] Discovery change needed (clarify `no_models` empty state behavior during concurrent auto-sync)

---

### Finding F-2: `syncing` state traps user with no cancel or escape path

**Severity:** 🟡 Improvement
**Category:** Usability (User Control & Freedom)

**Problem:**
The state machine marks "Abbrechen (optional)" as an available action in `syncing`, but neither Discovery nor Wireframe defines what cancel actually does, what the resulting state is, or how it is surfaced. Without a cancel path, the modal's Sync-Button is disabled and the user must wait up to 30s for a sync they may have triggered accidentally, or that is clearly failing (slow network). The progress toast has no dismiss action during `progress` state. The user is stuck observing.

**Context:**
> **From Discovery (State Machine):**
> ```
> | `syncing` | Progress-Toast sichtbar, Sync-Button disabled | Abbrechen (optional) |
> ```
>
> **From Wireframe (sync-toast progress):**
> ```
> | `progress` | Spinner icon + "Syncing Models... X / Y" count | No (stays until complete) |
> ```

**Impact:**
A 20-30s forced wait with no escape is a known frustration point, especially on slow connections or when the user clicked Sync by mistake. The "optional" label in Discovery suggests this was considered but never resolved.

**Recommendation:**
Make the decision explicit in Discovery:
- Option A (simpler): Remove "Abbrechen" from available actions. Accept the forced wait. Add a timeout after which the operation auto-transitions to `sync_failed` (e.g., 60s). Document this clearly.
- Option B (better UX): Add a dismiss action to the progress toast that aborts the sync and returns to the previous stable state (`synced` or `sync_failed`). The wireframe needs a close/dismiss affordance on the progress toast variant.

**Affects:**
- [x] Wireframe change needed (if Option B: add dismiss to progress toast)
- [x] Discovery change needed (resolve "optional" cancel — define behavior or remove)

---

### Finding F-3: Partial-success toast auto-dismisses before user can act on failures

**Severity:** 🟡 Improvement
**Category:** Usability (Error Recovery)

**Problem:**
The `partial` toast auto-dismisses after ~5 seconds. It contains actionable information: how many models failed. The user's likely next action is to retry — but by the time they read "25 failed", process it, and look for the Model Settings button to re-trigger sync, the toast is gone. There is no persistent failure indicator after the toast disappears. The user has no way to know sync was partial without opening the modal and seeing which dropdowns are empty. This is compounded when the partial sync happens as the background auto-sync (Flow 1), where the user may not even be watching the corner of the screen.

**Context:**
> **From Wireframe (sync-toast state variations):**
> ```
> | `partial` | Warning icon + summary with counts | Yes (~5s) |
> ```
>
> **From Discovery (Flow 2, step 7):**
> ```
> Toast: "95 Models synced, 3 new, 1 updated, 25 failed" (Partial Success)
> ```

**Impact:**
Users on unreliable connections (exactly those who experience partial failures) lose their one chance to understand the problem and retry. The missing models silently affect all dropdowns without any contextual explanation.

**Recommendation:**
Two complementary changes:
1. Extend partial-toast auto-dismiss to ~8-10s, or make it user-dismissible only (like the error toast).
2. After partial toast disappears, show a persistent but low-prominence indicator — e.g., a small warning badge on the Sync-Button in idle state ("Last sync: 25 failed — retry?"). This requires a new `sync_partial` button sub-state in the wireframe.

**Affects:**
- [x] Wireframe change needed (partial toast dismiss behavior, optional: sync-button partial state)
- [x] Discovery change needed (state machine: `sync_partial` should have a persistent indicator)

---

### Finding F-4: Model dropdown mixes inpaint/outpaint models into img2img capability filter

**Severity:** 🟡 Improvement
**Category:** Workflow / Information Architecture

**Problem:**
Discovery defines five capabilities: `txt2img`, `img2img`, `upscale`, `inpaint`, `outpaint`. The Model Settings Modal has three mode sections: TEXT TO IMAGE, IMAGE TO IMAGE, UPSCALE. The dropdown filter for the IMAGE TO IMAGE section shows "only models with `capabilities.img2img = true`". But per the capability detection rules, a model has `img2img = true` if it has an image input WITHOUT a mask field. Models with `inpaint` capability (image + mask) are separately tagged `inpaint = true` — but there is no section for inpaint or outpaint in the modal, and there is no guidance on whether inpaint models should appear in the img2img dropdown.

This creates ambiguity: if an inpaint model has `img2img = false` (because it has a mask field, so it doesn't qualify), it will never appear in any dropdown — it becomes an orphan in the catalog. If inpaint models also have `img2img = true`, they will pollute the IMAGE TO IMAGE dropdown with models that require a mask input that the UI never provides.

**Context:**
> **From Discovery (Capability Detection):**
> ```
> `img2img`: Model hat Image-Input-Feld OHNE `mask`-Feld
> `inpaint`: Model hat `image` + `mask` Felder, ODER Description enthält "inpainting"
> ```
>
> **From Discovery (Dropdown-Filter):**
> ```
> Dropdown-Filter: txt2img-Dropdown zeigt nur Models mit `capabilities.txt2img = true`, analog für andere Modes
> ```
>
> **From Wireframe (capability-filtered dropdown):**
> ```
> ② Model-Dropdown: Shows only models matching the capability of the row's mode
>    (txt2img row → only capabilities.txt2img = true). Same for img2img and upscale.
> ```

**Impact:**
Either inpaint/outpaint models are silently unreachable via any dropdown (orphan models), or they appear in the img2img dropdown and can be assigned to a slot where they will fail at generation time (no mask input available). Both outcomes are silent and confusing.

**Recommendation:**
Discovery must explicitly state the mapping between the 5 capabilities and the 3 modal sections. Two reasonable options:
- Option A: img2img dropdown includes models where `img2img = true` OR `inpaint = true` (pragmatic, but the dropdown contains models that need a mask the UI won't provide).
- Option B: Clarify that inpaint/outpaint are explicitly out of scope for the modal and add a note to the catalog data that these models are stored but not surfaced in current UI. This is consistent with "Manuelle Eingabe beliebiger Model-IDs" being out of scope.

The wireframe's `empty` state message may need updating to account for modes that have no assignable models due to this filter.

**Affects:**
- [ ] Wireframe change needed
- [x] Discovery change needed (define capability → modal section mapping for inpaint/outpaint)

---

### Finding F-5: `empty` dropdown state not shown for img2img/upscale after a txt2img-only partial sync

**Severity:** 💡 Suggestion
**Category:** Lücke / Edge Case

**Problem:**
The wireframe shows an `empty` dropdown state for the case "no models synced yet." But after a partial sync where only text-to-image collection succeeded, the img2img and upscale dropdowns would be empty while the txt2img dropdown is populated. This looks identical to the "not yet synced" empty state but has a different cause: some models were fetched, others failed. The existing empty state message ("Click 'Sync Models' to load") is still correct here, but there is no visual differentiation between "never synced" and "partially synced with zero matches."

**Context:**
> **From Wireframe (empty state):**
> ```
> │  No models available.             │
> │  Click "Sync Models" to load.     │
> ```
>
> **From Discovery (Partial Success):**
> ```
> Erfolgreiche Models werden gespeichert, fehlgeschlagene übersprungen
> ```

**Impact:**
Minor confusion in an already-covered edge case. The Sync-Button call-to-action is still correct regardless of the cause.

**Recommendation:**
No wireframe change strictly required. Acceptable to leave as-is. If polish is desired, consider a tooltip on empty dropdowns explaining why they are empty post-sync.

**Affects:**
- [ ] Wireframe change needed
- [ ] Discovery change needed

---

### Finding F-6: Sync-button placement creates visual crowding with close button

**Severity:** 💡 Suggestion
**Category:** Usability (Layout)

**Problem:**
The wireframe places "Sync Models" immediately to the left of the close button (✕) in the modal header. In the existing `SettingsDialog` (`settings-dialog.tsx`), the DialogHeader contains only a title and description — the close button is rendered by the `Dialog` component as an absolutely-positioned element in the top-right corner. Inserting a Sync button to the left of this absolutely-positioned close button requires custom layout work and risks creating a tap-target crowding problem on narrow viewports, where two interactive elements compete in a 32-40px vertical band.

**Context:**
> **From Wireframe:**
> ```
> │  Model Settings                 [↻ Sync Models]  ✕ │
> ```
>
> **From Discovery:**
> ```
> NEU: Sync-Button rechts oben neben Close oder unter dem Header-Text
> ```

**Impact:**
Cosmetic on desktop, minor tap-target issue on mobile. Discovery already offers the alternative "unter dem Header-Text" which avoids the crowding entirely and is more consistent with the existing DialogHeader pattern.

**Recommendation:**
Place Sync-Button below the header description text (right-aligned), not adjacent to the close button. This matches the "unter dem Header-Text" alternative already listed in Discovery and avoids fighting the Dialog component's close button positioning. No behavioral change needed.

**Affects:**
- [x] Wireframe change needed (update modal header wireframe to show button below header text)
- [ ] Discovery change needed

---

## Fachliche Bewertung

The overall concept is architecturally correct and the right solution for the stated problem. Moving from a live-API in-memory cache to a persistent DB-backed catalog is a meaningful infrastructure upgrade that directly unblocks the UI capability-filtering problem.

The interaction surface is appropriately minimal: one new button, one toast with four states, and filtered dropdowns. The decision to reuse Sonner (existing `toast-provider.tsx`) for the progress toast is practical; however, Sonner's default API (`toast()` / `toast.loading()`) does not natively support a counter update ("45 / 120"). The progress toast will require either polling a server-sent count or using `toast.loading()` with `toast.dismiss()` + re-trigger pattern. This is a technical concern but the wireframe's assumption that the counter updates in real-time is worth validating — if the count cannot be updated live (e.g., due to server action streaming limitations), the toast should fall back to an indeterminate spinner without the X/Y counter. The wireframe shows "45 / 120" which implies a live update mechanism that Discovery does not specify.

The Auto-Sync on first start is well-designed (non-blocking, background), but the 20-30s duration means the app is technically usable but the model assignment workflow is broken for that window. For a power-user tool where model assignment is a deliberate admin action, this is acceptable. The critical fix (F-1) is simply the copy in the empty state.

The capability-to-modal mapping gap (F-4) is the most substantive conceptual issue: five capabilities mapped to three UI sections leaves inpaint and outpaint capabilities in the catalog with no UI surface. This is not necessarily wrong — they may be V2 scope — but it needs to be explicitly stated to avoid silent orphan models.

---

## Verdict

**CHANGES_REQUESTED**

Required before implementation:
1. **F-1 (Critical):** Fix empty dropdown state copy to be context-aware during auto-sync. Add Discovery clarification for the `no_models + syncing` overlap.
2. **F-2 (Improvement):** Resolve the "Abbrechen (optional)" ambiguity — either define cancel behavior in wireframe + Discovery, or explicitly remove it from the state machine.
3. **F-3 (Improvement):** Change partial-toast auto-dismiss policy. 5s is insufficient for a message with multiple counts that requires a decision.
4. **F-4 (Improvement):** Define the capability → modal section mapping for inpaint/outpaint in Discovery. Prevents silent orphan models.
