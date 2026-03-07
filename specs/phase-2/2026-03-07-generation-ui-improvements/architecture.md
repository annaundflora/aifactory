# Feature: Generation UI Improvements

**Epic:** Generation UI Improvements (Phase 2)
**Status:** Ready
**Discovery:** `discovery.md` (same folder)
**Wireframes:** `wireframes.md` (same folder)
**Derived from:** Discovery constraints, NFRs, and risks

---

## Problem & Solution

**Problem:**
- Aspect Ratio und Bildgroesse nicht direkt steuerbar — nur indirekt ueber Model-Schema-Parameter
- Bilder koennen nicht zwischen Projekten verschoben werden
- Keine Bulk-Operationen (Multi-Select, Bulk-Delete, Bulk-Move)
- Kein Bildvergleich — nur Prompt-Vergleich existiert
- Prompt-Panel Layout nicht optimiert

**Solution:**
- Aspect Ratio Chips + Size Chips als primaere Steuerelemente
- Move-to-Project via DB-Update (`projectId`)
- Bulk-Select mit Floating Action Bar (Move, Delete, Compare, Favorite, Download)
- Side-by-Side Compare-View (max 4 Bilder) als Fullscreen-Modal
- Optimiertes Prompt-Panel Layout mit klarer Hierarchie

**Business Value:**
- Schnellere, praezisere Bildgenerierung durch direkte Ratio/Size-Kontrolle
- Effizientere Bildverwaltung durch Bulk-Operationen
- Bessere Qualitaetskontrolle durch Bildvergleich

---

## Scope & Boundaries

| In Scope |
|----------|
| Aspect Ratio Chips mit Standard + Custom-Eingabe |
| Size Chips (xs/s/m/l/xl) mit Multiplier-basierter Logik |
| Prompt-Panel Layout-Optimierung |
| Advanced Settings als Collapsible Section |
| Move-to-Project (Einzel + Bulk) |
| Bulk-Select mit Checkbox bei Hover |
| Bulk-Actions: Move, Delete, Compare, Favorite-Toggle, Download (ZIP) |
| Side-by-Side Compare-View (max 4 Bilder) |
| Favoriten-Filter Toggle in Gallery |

| Out of Scope |
|--------------|
| Drag & Drop zwischen Projekten |
| Slider/Overlay Bildvergleich |
| Mehr als 4 Bilder im Compare-View |
| Undo nach Bulk-Delete (nur Confirm-Dialog) |
| Sortierung/Filter der Gallery (ausser Favoriten-Toggle) |
| Bild-Editing (Crop, Resize nach Generation) |

---

## API Design

### Overview

| Aspect | Specification |
|--------|---------------|
| Style | Next.js Server Actions (`"use server"`) |
| Authentication | None (single-user app, no auth) |
| Rate Limiting | None (Replicate API has own limits) |

### Server Actions (New)

| Action | File | Input | Output | Business Logic |
|--------|------|-------|--------|----------------|
| `moveGeneration` | `app/actions/generations.ts` | `{ id: string, targetProjectId: string }` | `{ success: boolean } \| { error: string }` | Validate both IDs are UUIDs, target project exists, target != current project. UPDATE `generations.projectId`. Revalidate path. |
| `moveGenerations` | `app/actions/generations.ts` | `{ ids: string[], targetProjectId: string }` | `{ success: boolean, count: number } \| { error: string }` | Validate target project exists, target != source. Batch UPDATE `projectId` for all IDs. Revalidate path. |
| `deleteGenerations` | `app/actions/generations.ts` | `{ ids: string[] }` | `{ success: boolean, count: number } \| { error: string }` | Fetch all generations for imageUrls. Batch DELETE from DB. Delete R2 objects (fire-and-forget, log errors). Revalidate path. |
| `toggleFavorites` | `app/actions/generations.ts` | `{ ids: string[], favorite: boolean }` | `{ success: boolean } \| { error: string }` | Batch UPDATE `isFavorite` for all IDs. Revalidate path. |

### API Routes (New)

| Method | Path | Request | Response | Business Logic |
|--------|------|---------|----------|----------------|
| GET | `/api/download-zip` | Query: `ids=uuid1,uuid2,...` | `application/zip` stream | Validate max 50 IDs. Fetch generations from DB. Stream images from R2. Create ZIP in-memory using jszip. Filename: `generations-{timestamp}.zip`. Individual files: `{generation-id}.png`. |

### Data Transfer Objects

| DTO | Fields | Validation | Notes |
|-----|--------|------------|-------|
| MoveInput | `id: string, targetProjectId: string` | Both valid UUIDs, target project exists | Single move |
| BulkMoveInput | `ids: string[], targetProjectId: string` | All valid UUIDs, max 100, target exists | Bulk move |
| BulkDeleteInput | `ids: string[]` | All valid UUIDs, max 100 | Bulk delete |
| BulkFavoriteInput | `ids: string[], favorite: boolean` | All valid UUIDs, max 100 | Bulk favorite toggle |
| DownloadZipQuery | `ids: string` | Comma-separated UUIDs, max 50 | ZIP download |

---

## Database Schema

### Entities

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `projects` | Stores projects | id (PK), name, thumbnailUrl, createdAt |
| `generations` | Stores generated images | id (PK), projectId (FK), prompt, modelId, imageUrl, width, height, isFavorite |

### Schema Details — No Changes

Existing schema fully supports all features:
- `generations.projectId` (uuid, FK, NOT NULL) — Move = UPDATE projectId
- `generations.isFavorite` (boolean) — Bulk favorite toggle
- `generations.width`, `generations.height` (integer) — Already stored from generation
- `generations.imageUrl` (text) — For ZIP download, R2 cleanup

No new tables, columns, or migrations required.

### Existing Indexes (Sufficient)

| Table | Index | Used For |
|-------|-------|----------|
| `generations` | `generations_project_id_idx` | Fetch by project, move queries |
| `generations` | `generations_is_favorite_idx` | Favorites filter |
| `generations` | `generations_created_at_idx` | Sort by date |

---

## Server Logic

### Services & Processing

| Service | Responsibility | Input | Output | Side Effects |
|---------|----------------|-------|--------|--------------|
| `moveGeneration` (query) | Update projectId for single generation | generationId, targetProjectId | Generation | DB UPDATE |
| `moveGenerations` (query) | Batch update projectId | ids[], targetProjectId | count | DB batch UPDATE |
| `deleteGenerations` (query) | Batch delete generations | ids[] | deleted Generation[] (for R2 cleanup) | DB batch DELETE |
| `toggleFavorites` (query) | Batch set isFavorite | ids[], favorite | count | DB batch UPDATE |
| `AspectRatioService` (client-side util) | Parse model schema for compatible ratios/sizes | SchemaProperties | `{ ratios: Ratio[], sizes: Size[], mapping: 'enum' \| 'pixels' }` | None |
| `SizeCalculator` (client-side util) | Compute width/height from ratio + size | ratio, sizeValue | `{ width: number, height: number }` | None |
| ZIP route handler | Stream ZIP of images | generation IDs | ZIP file stream | R2 reads |

### Business Logic Flow

#### Aspect Ratio + Size -> Generation

```
ModelChange → LoadSchema → ParseRatioSupport → FilterChips
                                                    ↓
UserSelectsRatio + Size → SizeCalculator → { width, height }
                                                    ↓
                                        BuildReplicateInput:
                                          IF model has aspect_ratio enum → send enum value
                                          IF model has width/height → send pixel values
                                                    ↓
                                              generateImages()
```

#### Bulk Operations

```
UserSelectsImages → SelectionState (React Context)
                          ↓
            FloatingActionBar renders actions
                          ↓
    BulkMove: moveGenerations() → revalidate → clear selection
    BulkDelete: deleteGenerations() → R2 cleanup → revalidate → clear selection
    BulkFavorite: toggleFavorites() → revalidate
    BulkDownload: GET /api/download-zip?ids=... → stream ZIP
    BulkCompare: open CompareModal with selected generations
```

### Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| Custom ratio format | Must match `N:N`, both positive integers, max 10:1 ratio | "Ungueltiges Format (z.B. 21:9)" |
| Custom ratio values | Both sides > 0, ratio <= 10:1 | "Verhaeltnis darf max 10:1 sein" |
| Target projectId | Must be valid UUID, must exist, must != current project | "Projekt nicht gefunden" / "Kann nicht ins gleiche Projekt verschieben" |
| Bulk IDs | Array of valid UUIDs, max 100 for mutations, max 50 for ZIP | "Zu viele Bilder ausgewaehlt" |
| Compare count | Min 2, max 4 | "2-4 Bilder auswaehlen zum Vergleichen" |

---

## Security

### Authentication & Authorization

| Area | Mechanism | Notes |
|------|-----------|-------|
| API Auth | None | Single-user local app, no auth required |
| Resource Access | None | All data accessible to the single user |

### Data Protection

| Data Type | Protection | Notes |
|-----------|------------|-------|
| Image URLs | R2 public URLs | Already existing pattern, no change |
| Project IDs | UUID validation | Prevent SQL injection via parameterized queries (Drizzle ORM) |

### Input Validation & Sanitization

| Input | Validation | Sanitization |
|-------|------------|--------------|
| Generation IDs | UUID format check | Drizzle parameterized queries |
| Project IDs | UUID format check | Drizzle parameterized queries |
| Custom ratio | Regex `^\d+:\d+$`, both > 0, ratio <= 10:1 | Client-side only (no DB storage) |
| ZIP download IDs | UUID format check, max 50 | Query parameter parsing |

### Rate Limiting & Abuse Prevention

| Resource | Limit | Notes |
|----------|-------|-------|
| ZIP download | Max 50 images per request | Prevent memory exhaustion |
| Bulk operations | Max 100 IDs per request | Prevent long-running queries |

---

## Architecture Layers

### Layer Responsibilities

| Layer | Responsibility | Pattern |
|-------|----------------|---------|
| Server Actions (`app/actions/generations.ts`) | Handle mutations, validation, revalidation | Next.js Server Actions |
| API Routes (`app/api/download-zip/route.ts`) | Handle streaming responses (ZIP) | Next.js Route Handler |
| DB Queries (`lib/db/queries.ts`) | Data access, batch operations | Repository pattern (Drizzle ORM) |
| Client Utils (`lib/aspect-ratio.ts`) | Ratio/size calculation, schema parsing | Pure functions |
| React Context (`lib/selection-state.tsx`) | Selection state management | Context + Provider pattern |
| UI Components | Render controls, handle user interaction | React components |

### Data Flow

```
Client Components
    ↓ (user interaction)
Selection Context ← manages selected IDs, selection mode
    ↓
Server Actions (mutations) / API Routes (ZIP download)
    ↓
DB Queries (Drizzle ORM) → PostgreSQL
    ↓
Storage Service → R2 (for delete/download)
    ↓
revalidatePath("/") → UI refresh
```

### Error Handling Strategy

| Error Type | Handling | User Response | Logging |
|------------|----------|---------------|---------|
| Validation (bad UUID, empty input) | Return `{ error: string }` | Toast with error message | None |
| DB error (query failure) | Return `{ error: "Datenbankfehler" }` | Toast: "Datenbankfehler" | `console.error` |
| R2 error (delete/download failure) | Log and continue (non-blocking) | Toast only if all fail | `console.error` |
| ZIP generation error | Return 500 | Toast: "Download fehlgeschlagen" | `console.error` |

---

## Migration Map

### Existing Files Modified

| Existing File | Current Pattern | Target Pattern | Specific Changes |
|---|---|---|---|
| `app/actions/generations.ts` | Single delete, generate, retry, fetch | Add moveGeneration, moveGenerations, deleteGenerations, toggleFavorites | Add 4 new server actions for bulk/move operations |
| `lib/db/queries.ts` | Single CRUD operations | Add batch operations | Add moveGeneration, moveGenerations, deleteGenerations, toggleFavorites query functions |
| `components/workspace/prompt-area.tsx` | Flat layout, ParameterPanel inline, variant buttons 1-4 | Structured layout with ratio/size chips, collapsible advanced settings, variant stepper | Extract ParameterPanel into collapsible section, add AspectRatioChips + SizeChips before it, replace variant buttons with stepper |
| `components/workspace/generation-card.tsx` | Simple button with image + hover overlay | Add checkbox overlay for selection | Add optional checkbox (top-left), selection border, click behavior change in selection mode |
| `components/workspace/gallery-grid.tsx` | Simple masonry grid, onSelectGeneration callback | Add selection mode support, favorites filter | Accept selection state, render checkboxes, change click behavior in selection mode |
| `components/workspace/workspace-content.tsx` | Prompt area + gallery + lightbox | Add SelectionProvider, FloatingActionBar, CompareModal, favorites filter | Wrap in SelectionProvider, add FloatingActionBar, CompareModal, fav filter toggle |
| `components/lightbox/lightbox-modal.tsx` | View/download/delete/variation actions | Add move button, compare checkbox, compare bar | Add MoveDropdown, compare checkbox, LightboxCompareBar |
| `lib/workspace-state.tsx` | Only WorkspaceVariationState | Add WorkspaceVariationState (unchanged) | No changes needed — selection state uses separate context |

### New Files

| New File | Purpose |
|----------|---------|
| `lib/aspect-ratio.ts` | Aspect ratio + size calculation utilities, schema parsing |
| `lib/selection-state.tsx` | SelectionContext + Provider for bulk select state |
| `components/workspace/aspect-ratio-chips.tsx` | Aspect ratio chip group component |
| `components/workspace/size-chips.tsx` | Size chip group component |
| `components/workspace/variant-stepper.tsx` | Stepper component ([-] N [+]) |
| `components/workspace/floating-action-bar.tsx` | Floating action bar for bulk operations |
| `components/workspace/gallery-header.tsx` | Gallery header with title, count, favorites filter toggle |
| `components/compare/compare-modal.tsx` | Compare view modal (fullscreen, 2x2 grid) |
| `components/lightbox/lightbox-compare-bar.tsx` | Floating compare bar in lightbox |
| `components/lightbox/lightbox-move-dropdown.tsx` | Move dropdown in lightbox |
| `app/api/download-zip/route.ts` | API route for ZIP download |

---

## Constraints & Integrations

### Constraints

| Constraint | Technical Implication | Solution |
|------------|----------------------|----------|
| Model schemas vary (aspect_ratio enum vs width/height) | Need dual mapping strategy | `AspectRatioService.parseSchema()` detects schema type and returns appropriate mapping |
| Aspect ratio enum values are model-specific | Cannot hardcode enum values | Parse from model schema at runtime, filter chips based on available enums |
| R2 objects must be cleaned up on bulk delete | Multiple R2 deletes needed | Fire-and-forget batch delete, log errors, don't block on R2 failures |
| ZIP download must handle large images | Memory pressure with many large images | Limit to 50 images, stream response, fetch images sequentially |
| Selection mode changes click behavior | Card click = toggle selection instead of lightbox | Use selection context to determine click handler |

### Integrations

| Area | System / Capability | Interface | Version | Notes |
|------|----------------------|-----------|---------|-------|
| Frontend | Next.js | App Router, Server Actions, Route Handlers | 16.1.6 (package.json) | Streaming response for ZIP |
| Frontend | React | Client components, Context API | 19.2.3 (package.json) | Selection state context |
| Frontend | radix-ui | Collapsible, Tooltip, Select, Dialog | 1.4.3 (package.json) | For advanced settings, chip tooltips, compare modal |
| Frontend | lucide-react | Icons | 0.577.0 (package.json) | Star, Check, Move, Download, Trash, Maximize icons |
| Frontend | sonner | Toast notifications | 2.0.7 (package.json) | Move/delete success toasts |
| Backend | Drizzle ORM | Query builder, batch operations | 0.45.1 (package.json) | `inArray()` for batch queries |
| Backend | @aws-sdk/client-s3 | R2 operations (delete) | 3.1003.0 (package.json) | Bulk R2 delete |
| Backend | Replicate API | Model schema (OpenAPI) | via replicate@1.4.0 (package.json) | Schema parsing for aspect_ratio/width/height detection |
| Backend | jszip | ZIP file generation | 3.10.1 (npmjs.com, stable) | New dependency for bulk download |
| Testing | vitest | Unit + integration tests | 4.0.18 (package.json) | Test ratio/size calculation, server actions |

---

## Quality Attributes (NFRs)

### From Discovery -> Technical Solution

| Attribute | Target | Technical Approach | Measure / Verify |
|-----------|--------|--------------------|------------------|
| Responsiveness | Chip selection < 16ms, no layout shift | Client-side state only for ratio/size, no server round-trip | Chrome DevTools Performance |
| Bulk operation speed | Bulk delete/move < 2s for 50 images | Single batch SQL query (not N individual queries) | Server action timing |
| ZIP download | Handle up to 50 images | Sequential R2 fetches, streaming ZIP response | Manual test with 50 images |
| Selection UX | No accidental lightbox opens in selection mode | Context-based click handler switching | E2E test |
| Schema compatibility | Works with all 9 registered models | Runtime schema parsing, graceful fallback if no ratio/size support | Unit tests per model schema pattern |

### Monitoring & Observability

| Metric | Type | Target | Alert |
|--------|------|--------|-------|
| Bulk operation errors | Error log | 0 errors | Console error monitoring |
| R2 cleanup failures | Warning log | Non-blocking | Console warning |

---

## Risks & Assumptions

### Assumptions

| Assumption | Technical Validation | Impact if Wrong |
|------------|---------------------|-----------------|
| All models support either `aspect_ratio` enum or `width`/`height` params | Parse schema at runtime, check for both patterns | Chips hidden for models without ratio/size support — ParameterPanel remains as fallback |
| R2 public URLs are directly fetchable for ZIP | Already used for image display | Use imageUrl from DB, same domain |
| `projectId` UPDATE is sufficient for move (no cascade issues) | `projectId` is simple FK with ON DELETE CASCADE on project | Move is a simple UPDATE, no side effects |
| Batch operations with `inArray()` are supported by Drizzle + PostgreSQL | Available in drizzle-orm, not yet used in this project — verify with unit test | Fall back to sequential operations |

### Risks & Mitigation

| Risk | Likelihood | Impact | Technical Mitigation | Fallback |
|------|------------|--------|---------------------|----------|
| Model schema doesn't contain aspect_ratio or width/height | Low | Medium | Gracefully hide ratio/size chips, keep ParameterPanel as fallback | User sets params manually via Advanced Settings |
| ZIP download OOM for many large images | Low | High | Limit to 50 images, stream response, sequential fetches | Reduce limit to 20, show warning |
| Bulk delete partial failure (DB success, some R2 failures) | Medium | Low | R2 delete is fire-and-forget, orphaned R2 objects are harmless | Manual R2 cleanup if needed |
| Selection state lost on page navigation | Low | Low | Selection is transient React state, expected to reset | No mitigation needed — matches user expectation |

---

## Technology Decisions

### Stack Choices

| Area | Technology | Rationale |
|------|------------|-----------|
| Batch DB operations | Drizzle `inArray()` | Available in drizzle-orm@0.45.1, first usage in this project. Single query for N items. |
| ZIP generation | `jszip` (npm package, to be added) | Mature ZIP library, streaming support, small footprint. Max 50 images per request. |
| Selection state | React Context | Consistent with existing workspace-state.tsx pattern |
| Collapsible section | radix-ui `Collapsible` | Already in radix-ui@1.4.3 dependency |
| Chip tooltips | radix-ui `Tooltip` | Already in radix-ui@1.4.3 dependency |
| Compare modal | radix-ui `Dialog` | Already used for other modals |

### Trade-offs

| Decision | Pro | Con | Mitigation |
|----------|-----|-----|------------|
| jszip for ZIP generation | Mature library, streaming support | New dependency | Small footprint, well-maintained, 50 image limit mitigates memory |
| Client-side ratio/size calculation vs server-side | Instant feedback, no round-trip | Logic duplicated if server needs to validate | Server trusts client-computed width/height (already the case) |
| Separate SelectionContext vs extending WorkspaceState | Clean separation of concerns, selection is transient | Additional context provider | Both are lightweight, no performance impact |
| ParameterPanel moved to Advanced Settings | Cleaner UI, ratio/size chips are primary | Power users lose quick access to all params | Collapsible section is one click away |

---

## Component Architecture

### New Component Tree

```
WorkspaceContent
├── SelectionProvider (NEW - wraps entire workspace)
│   ├── PromptArea
│   │   ├── ModelDropdown (existing)
│   │   ├── TemplateSelector (existing)
│   │   ├── PromptMotiv Textarea (existing)
│   │   ├── Builder + Improve Buttons (existing)
│   │   ├── Style/Modifier Textarea (existing)
│   │   ├── NegativePrompt Textarea (existing, conditional)
│   │   ├── AspectRatioChips (NEW)
│   │   │   └── CustomRatioInput (NEW, inline)
│   │   ├── SizeChips (NEW)
│   │   ├── Collapsible Advanced Settings (NEW)
│   │   │   └── ParameterPanel (existing, moved here)
│   │   └── VariantStepper + GenerateButton (NEW layout)
│   ├── Gallery Area
│   │   ├── GalleryHeader (NEW - title, count, fav filter)
│   │   ├── GalleryGrid (modified)
│   │   │   └── GenerationCard (modified - checkbox overlay)
│   │   └── FloatingActionBar (NEW, conditional)
│   ├── LightboxModal (modified)
│   │   ├── LightboxMoveDropdown (NEW)
│   │   ├── LightboxCheckbox (NEW)
│   │   └── LightboxCompareBar (NEW, conditional)
│   └── CompareModal (NEW)
```

### Selection State Design

```typescript
// lib/selection-state.tsx
interface SelectionState {
  selectedIds: Set<string>;
  isSelecting: boolean;  // true when 1+ selected
  source: 'gallery' | 'lightbox' | null;
}

interface SelectionActions {
  toggleSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
  isSelected: (id: string) => boolean;
}
```

### CompareModal Data Contract

```typescript
// components/compare/compare-modal.tsx
interface CompareModalProps {
  generations: Generation[];  // 2-4 Generation objects from DB
  isOpen: boolean;
  onClose: () => void;
}

// Each image cell renders:
// - generation.imageUrl (image source)
// - getModelById(generation.modelId)?.displayName (model name)
// - `${generation.width} x ${generation.height}` (dimensions)
// - Fullscreen toggle button (top-right)
//
// Model name resolution: uses existing getModelById() from lib/models.ts
// All required fields (imageUrl, modelId, width, height) are already
// present on the Generation type from lib/db/queries.ts
```

### Aspect Ratio Schema Parsing

```typescript
// lib/aspect-ratio.ts
interface RatioConfig {
  mapping: 'enum' | 'pixels' | 'none';
  availableRatios: string[];       // e.g. ["1:1", "16:9", ...]
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

// Parse model schema to determine ratio/size support
function parseRatioConfig(schema: SchemaProperties): RatioConfig;

// Calculate pixel dimensions from ratio + size
function calculateDimensions(
  ratio: string,    // e.g. "16:9"
  sizeValue: number // e.g. 1024
): { width: number; height: number };

// Size presets
const SIZE_PRESETS = {
  xs: 512,
  s: 768,
  m: 1024,
  l: 1536,
  xl: 2048,
} as const;
```

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| -- | Keine offenen Fragen | -- | -- | -- |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-07 | Codebase | 9 Models in lib/models.ts, schema via Replicate API OpenAPI spec |
| 2026-03-07 | Codebase | ParameterPanel filters for enum + integer/number types, excludes prompt/negative_prompt |
| 2026-03-07 | Codebase | generations table has projectId FK (NOT NULL, ON DELETE CASCADE), isFavorite boolean, width/height integer — no schema changes needed |
| 2026-03-07 | Codebase | Existing single delete pattern: DB DELETE first, then R2 DELETE (fire-and-forget) |
| 2026-03-07 | Codebase | WorkspaceContent uses polling (3s) for pending generations, manages lightbox state |
| 2026-03-07 | Codebase | GalleryGrid: CSS columns masonry (2-4 columns), GenerationCard is simple button with img |
| 2026-03-07 | Codebase | LightboxModal: fullscreen toggle, detail panel, variation/download/delete actions |
| 2026-03-07 | Codebase | PromptArea: model dropdown, textareas, ParameterPanel inline, variant count buttons 1-4 |
| 2026-03-07 | Codebase | StorageService: @aws-sdk/client-s3, upload + deleteObject, R2 endpoint |
| 2026-03-07 | Codebase | Drizzle ORM 0.45.1 with inArray() for batch queries |
| 2026-03-07 | Codebase | sonner for toast notifications, radix-ui for UI primitives |
| 2026-03-07 | Codebase | No existing ZIP functionality — new API route needed |
| 2026-03-07 | Stack | Next.js 16.1.6, React 19.2.3, radix-ui 1.4.3, TailwindCSS 4 |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| -- | Architecture erstellt ohne interaktive Q&A (automated pipeline) | Basiert auf Discovery + Wireframes + Codebase-Analyse |
