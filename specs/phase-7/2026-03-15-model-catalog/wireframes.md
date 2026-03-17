# Wireframes: Model Catalog

**Discovery:** `discovery.md` (same folder)
**Status:** Draft

---

## Component Coverage

| UI Component (from Discovery) | Screen |
|-------------------------------|--------|
| `sync-button` | Model Settings Modal |
| `sync-toast` | Global Toast Area (all flows) |
| `model-dropdown` | Model Settings Modal (per Mode/Tier) |
| `inpaint-dropdown` | Model Settings Modal — INPAINT section |
| `outpaint-dropdown` | Model Settings Modal — OUTPAINT section |

---

## User Flow Overview

```
[App Start: Empty DB]
  └──auto-trigger──> sync-toast (progress)
                         │
                         └──complete──> sync-toast (success/partial/error)
                                            │
                                            └──> Model Settings Modal (dropdowns filled)

[User: Settings Icon]
  └──click──> [Model Settings Modal]
                  │
                  ├──click "Sync Models" ──> sync-toast (progress)
                  │                              │
                  │                              └──complete──> sync-toast (success/partial)
                  │
                  └──open dropdown (Mode/Tier)
                          │
                          ├──model in DB ──> Parameter Panel updates instantly
                          └──model NOT in DB ──> loading spinner (~1-2s) ──> Panel updates
```

---

## Screen: Model Settings Modal (Extended)

**Context:** Modal dialog, opened via Settings icon in Workspace. Shows Mode/Tier model assignments + new Sync button.

### Wireframe

```
┌────────────────────────────────────────────────────┐
│  Model Settings                                  ✕ │
│  ① [↻ Sync Models]                                 │
├────────────────────────────────────────────────────┤
│                                                    │
│  TEXT TO IMAGE                                     │
│  ──────────────────────────────────────────────── │
│  Draft      ② [flux-1-schnell            ▼]       │
│  Quality    ② [flux-2-pro                ▼]       │
│  Max        ② [imagen-4                  ▼]       │
│                                                    │
│  IMAGE TO IMAGE                                    │
│  ──────────────────────────────────────────────── │
│  Draft      ② [flux-fill-dev             ▼]       │
│  Quality    ② [sdxl                      ▼]       │
│                                                    │
│  UPSCALE                                           │
│  ──────────────────────────────────────────────── │
│  Quality    ② [real-esrgan               ▼]       │
│  Max        ② [clarity-upscaler          ▼]       │
│                                                    │
│  INPAINT                                           │
│  ──────────────────────────────────────────────── │
│  Quality    ② [stable-diffusion-inpaint  ▼]       │
│                                                    │
│  OUTPAINT                                          │
│  ──────────────────────────────────────────────── │
│  Quality    ② [sdxl-outpainting          ▼]       │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Annotations:**
- ① Sync-Button: "↻ Sync Models" label. Positioned below the modal header title (right-aligned), NOT adjacent to the close button. `idle` state = normal button. `syncing` state = spinner icon + disabled. `sync_partial` state = warning badge ("⚠ Last sync had failures").
- ② Model-Dropdown: Shows only models matching the capability of the row's mode. `txt2img` row → `capabilities.txt2img = true`. `img2img` row → `capabilities.img2img = true`. `upscale` row → `capabilities.upscale = true`. `inpaint` row → `capabilities.inpaint = true`. `outpaint` row → `capabilities.outpaint = true`.

---

## Screen: Model Settings Modal — Sync-Button States

### State: `idle`

```
┌────────────────────────────────────────────────────┐
│  Model Settings                                  ✕ │
│  [↻ Sync Models]                                   │
├────────────────────────────────────────────────────┤
│  ...                                               │
└────────────────────────────────────────────────────┘
```

### State: `syncing` (Button disabled during sync)

```
┌────────────────────────────────────────────────────┐
│  Model Settings                                  ✕ │
│  [◌ Syncing...]                                    │
├────────────────────────────────────────────────────┤
│  ...                                               │
└────────────────────────────────────────────────────┘
```

### State: `sync_partial` (Last sync had failures)

```
┌────────────────────────────────────────────────────┐
│  Model Settings                                  ✕ │
│  [↻ Sync Models  ⚠]                                │
├────────────────────────────────────────────────────┤
│  ...                                               │
└────────────────────────────────────────────────────┘
```

*Tooltip on hover: "Last sync: X models failed. Click to retry."*

### State Variations

| State | Visual Change |
|-------|---------------|
| `idle` | "↻ Sync Models" label, normal style, clickable |
| `syncing` | Spinner icon + "Syncing..." label, disabled/muted style, not clickable |
| `sync_partial` | "↻ Sync Models ⚠" — warning badge persists until next successful sync |

---

## Screen: Model-Dropdown (Capability-Filtered)

**Context:** Dropdown opened within a Mode/Tier row in Model Settings Modal.

### State: `loaded` (models available)

```
  Draft      ┌──────────────────────────────────┐
             │ ✓ flux-1-schnell                  │
             │   flux-2-dev                      │
             │   sdxl                            │
             │   seedream-5                      │
             │   recraft-v4                      │
             │   imagen-4                        │
             └──────────────────────────────────┘
```

### State: `empty:syncing` (sync in progress — auto-sync or manual)

```
  Draft      ┌──────────────────────────────────┐
             │  Loading models... please wait.   │
             └──────────────────────────────────┘
```

*No action prompt — sync is already running.*

### State: `empty:never-synced` (no sync has ever run — defensive edge case)

```
  Draft      ┌──────────────────────────────────┐
             │  No models available.             │
             │  Click "Sync Models" to load.     │
             └──────────────────────────────────┘
```

### State: `empty:failed` (last sync completed with error)

```
  Draft      ┌──────────────────────────────────┐
             │  Sync failed.                     │
             │  Click "Sync Models" to retry.    │
             └──────────────────────────────────┘
```

### State: `empty:partial` (sync succeeded for other capabilities, none for this mode)

```
  Draft      ┌──────────────────────────────────┐
             │  No models for this mode yet.     │
             │  Click "Sync Models" to retry.    │
             └──────────────────────────────────┘
```

*Tooltip: "Other modes synced successfully. This capability had no results."*

### State: `loading` (on-the-fly schema fetch)

```
  Draft      [flux-2-pro                ▼]
              ◌  Loading schema...
```

*Shown in Parameter Panel area below, not in dropdown itself.*

### State Variations

| State | Visual Change |
|-------|---------------|
| `loaded` | Scrollable list of model names matching capability. Current selection has checkmark. |
| `empty:syncing` | "Loading models... please wait." — no action prompt |
| `empty:never-synced` | "No models available. Click 'Sync Models' to load." |
| `empty:failed` | "Sync failed. Click 'Sync Models' to retry." |
| `empty:partial` | "No models for this mode yet." + tooltip explaining partial sync context |
| `loading` | Parameter Panel shows spinner while on-the-fly schema fetch runs (~1-2s) |

---

## Screen: Sync Toast — All States

**Context:** Global toast area (bottom-right or top-right of viewport). Appears during and after sync.

### State: `progress` (Flow 1: Auto-Sync or Flow 2: Manual Sync)

```
  ┌─────────────────────────────────────────┐
  │  ◌  Syncing Models...  45 / 120         │
  └─────────────────────────────────────────┘
```

### State: `success`

```
  ┌─────────────────────────────────────────┐
  │  ✓  120 Models synced                   │
  └─────────────────────────────────────────┘
```

### State: `partial`

```
  ┌─────────────────────────────────────────┐
  │  ⚠  95 synced · 3 new · 1 updated    ✕ │
  │     25 failed                           │
  └─────────────────────────────────────────┘
```

*User must explicitly dismiss. Does not auto-dismiss.*

### State: `error` (complete failure)

```
  ┌─────────────────────────────────────────┐
  │  ✕  Sync failed: API not reachable.     │
  │     Existing data unchanged.            │
  └─────────────────────────────────────────┘
```

### State Variations

| State | Visual Change | Auto-dismiss |
|-------|---------------|--------------|
| `progress` | Spinner icon + "Syncing Models... X / Y" count | No (stays until complete; no cancel/dismiss affordance) |
| `success` | Checkmark + "X Models synced" | Yes (~3s) |
| `partial` | Warning icon + summary with counts + ✕ dismiss button | No (user must dismiss — action required) |
| `error` | X icon + error message + ✕ dismiss button | No (user must dismiss) |

---

## Screen: Workspace — First Start (Empty DB)

**Context:** Workspace page, models table empty. Auto-sync triggers immediately in background.

```
┌────────────────────────────────────────────────────────────┐
│  Workspace                                        [⚙ ...]  │
│  ...                                                       │
│  [... existing workspace content ...]                      │
│                                                            │
│                              ┌───────────────────────────┐ │
│                              │ ◌  Syncing Models...  0/120│ │
│                              └───────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

*Auto-sync progress toast appears in corner; workspace remains fully usable.*

### After Auto-Sync Complete

```
┌────────────────────────────────────────────────────────────┐
│  Workspace                                        [⚙ ...]  │
│  ...                                                       │
│  [... existing workspace content ...]                      │
│                                                            │
│                              ┌───────────────────────────┐ │
│                              │ ✓  120 Models synced       │ │
│                              └───────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

---

## Completeness Check

| Check | Status |
|-------|--------|
| All UI Components from Discovery covered | ✅ |
| All relevant state variations documented | ✅ |
| All screens from UI Layout (Discovery) covered | ✅ |
| No logic/rules duplicated (stays in Discovery) | ✅ |
