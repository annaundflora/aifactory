# Architecture: Quality Improvements

**Discovery:** `discovery.md` (same folder)
**Wireframes:** `wireframes.md` (same folder)
**Status:** Ready

---

## Problem & Solution

**Problem:**
- Prompt quality is mediocre: Builder appends single words, Improve is generic and not adaptive
- Prompt field too narrow (320px), no structure (single textarea)
- No prompt saving, no history -- good prompts are lost
- Lightbox shows images at max 70vh, no fullscreen
- Navigation not collapsible, wastes space
- Projects have no visual thumbnails (gray placeholders only)

**Solution:**
- Structured prompt field (Motiv + Style/Modifier + Negative Prompt)
- Builder Pro with 5 categories and articulated fragments
- Adaptive Improve with prompt analysis and model-awareness
- Prompt History + Favorites + Templates
- shadcn Sidebar (collapsible), Lightbox fullscreen, Project thumbnails

---

## Scope & Boundaries

| In Scope | Out of Scope |
|----------|--------------|
| Lightbox fullscreen toggle | Prompt field width change (solved by sidebar collapse) |
| shadcn Sidebar (collapsible, replaces custom sidebar) | Switching LLM model for Improve (stays OpenRouter) |
| Structured prompt field (3 sections) | Builder model-specific (only Improve is model-aware) |
| Builder Pro: 5 categories with articulated fragments | Auto-update thumbnail after N generations |
| Adaptive Improve with prompt analysis + model awareness | |
| Prompt History (auto) + Favorites (manual) as tabs | |
| Prompt versioning: full prompt stored per generation | |
| Prompt Templates (hardcoded presets) | |
| Project thumbnails: auto on creation, manual refresh | |

---

## Database Schema

### Existing Table: `generations` (Extensions)

| Column | Type | Constraint | Notes |
|--------|------|------------|-------|
| `prompt_motiv` | TEXT | NOT NULL DEFAULT '' | Main subject portion of prompt. Migrated: existing `prompt` values copied here |
| `prompt_style` | TEXT | DEFAULT '' | Style/modifier portion |
| `is_favorite` | BOOLEAN | NOT NULL DEFAULT false | Favorite flag for prompt history |

**Migration Strategy:**
- Add 3 new columns with defaults (non-breaking)
- Backfill: `UPDATE generations SET prompt_motiv = prompt WHERE prompt_motiv = ''`
- Existing `prompt` column kept as-is (composite prompt sent to Replicate, remains source of truth for generation)
- New columns are for UI display and history loading only

### Existing Table: `projects` (Extensions)

| Column | Type | Constraint | Notes |
|--------|------|------------|-------|
| `thumbnail_url` | TEXT | DEFAULT NULL | R2 URL of generated thumbnail |
| `thumbnail_status` | VARCHAR(20) | NOT NULL DEFAULT 'none' | Enum: none, pending, completed, failed |

### New Table: `prompt_templates` (NOT needed)

Templates are hardcoded in a TypeScript config file -- no DB table needed.

### Prompt History Approach (Decision)

**No separate `prompt_history` table.** Instead, reuse the existing `generations` table:
- Every generation already stores `prompt`, `negative_prompt`, `model_id`, `model_params`, `created_at`
- New columns `prompt_motiv`, `prompt_style`, `is_favorite` extend it
- History = query `generations` grouped by unique prompt combinations, ordered by `created_at DESC`
- Favorites = filter by `is_favorite = true`

**Rationale:**
- Avoids data duplication (generation already captures everything)
- Discovery says "History speichert automatisch bei jeder Generation" -- this is already the case
- Simpler schema, fewer migrations, no sync issues
- History is cross-project: query `generations` without `project_id` filter, ordered by `created_at DESC` (per Discovery: "projektuebergreifend")

### New Indexes

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `generations_is_favorite_idx` | generations | is_favorite | Fast favorite filtering |
| `projects_thumbnail_status_idx` | projects | thumbnail_status | Query pending thumbnails |

### Schema Diagram

```
projects (existing)
├── id (uuid, PK)
├── name (varchar 255)
├── thumbnail_url (text, NEW)
├── thumbnail_status (varchar 20, NEW)
├── created_at (timestamptz)
└── updated_at (timestamptz)

generations (existing, extended)
├── id (uuid, PK)
├── project_id (uuid, FK → projects.id CASCADE)
├── prompt (text) ← composite prompt for Replicate (unchanged)
├── prompt_motiv (text, NEW) ← UI: main subject
├── prompt_style (text, NEW) ← UI: style/modifier
├── negative_prompt (text)
├── model_id (varchar 255)
├── model_params (jsonb)
├── status (varchar 20)
├── image_url (text)
├── replicate_prediction_id (varchar 255)
├── error_message (text)
├── width (integer)
├── height (integer)
├── seed (bigint)
├── is_favorite (boolean, NEW)
└── created_at (timestamptz)

prompt_snippets (unchanged)
├── id (uuid, PK)
├── text (varchar 500)
├── category (varchar 100)
└── created_at (timestamptz)
```

---

## API Design (Server Actions)

### Existing Actions (Modified)

| Action | File | Changes |
|--------|------|---------|
| `generateImages(input)` | `app/actions/generations.ts` | Input adds `promptMotiv`, `promptStyle`. Composes `prompt = "{motiv}. {style}"` before calling service. Stores structured fields in DB |
| `improvePrompt(input)` | `app/actions/prompts.ts` | Input adds `modelId`. Passes to PromptService for model-aware improvement |

### New Actions

| Action | File | Input | Output | Purpose |
|--------|------|-------|--------|---------|
| `getPromptHistory(input)` | `app/actions/prompts.ts` | `{ offset?: number, limit?: number }` | `PromptHistoryEntry[]` | Paginated history (cross-project) |
| `getFavoritePrompts(input)` | `app/actions/prompts.ts` | `{ offset?: number, limit?: number }` | `PromptHistoryEntry[]` | Paginated favorites |
| `toggleFavorite(input)` | `app/actions/prompts.ts` | `{ generationId: string }` | `{ isFavorite: boolean }` | Toggle favorite on generation |
| `generateThumbnail(input)` | `app/actions/projects.ts` | `{ projectId: string }` | `Project` | Generate/refresh thumbnail |

### PromptHistoryEntry Type

```typescript
{
  generationId: string
  promptMotiv: string
  promptStyle: string
  negativePrompt: string | null
  modelId: string
  modelParams: Record<string, unknown>
  isFavorite: boolean
  createdAt: Date
}
```

---

## Server Logic

### Modified Services

| Service | Method | Changes |
|---------|--------|---------|
| `generation-service.ts` | `generate()` | Accepts `promptMotiv`, `promptStyle` separately. Composes composite prompt. Stores both structured and composite in DB |
| `prompt-service.ts` | `improve()` | Accepts `modelId` parameter. New adaptive system prompt with prompt analysis + model-specific optimization |

### New Services

| Service | Method | Input | Output | Side Effects |
|---------|--------|-------|--------|--------------|
| `prompt-history-service.ts` | `getHistory(offset, limit)` | Pagination params | `PromptHistoryEntry[]` | None (read-only) |
| `prompt-history-service.ts` | `getFavorites(offset, limit)` | Pagination params | `PromptHistoryEntry[]` | None (read-only) |
| `prompt-history-service.ts` | `toggleFavorite(generationId)` | Generation ID | `{ isFavorite: boolean }` | DB update |
| `thumbnail-service.ts` | `generateForProject(projectId)` | Project ID | `Project` | Replicate API call, R2 upload, DB update |
| `thumbnail-service.ts` | `refreshForProject(projectId)` | Project ID | `Project` | Analyses project prompts, generates new thumbnail, R2 upload, DB update |

### Prompt Composition Logic

```
Input:  promptMotiv = "A majestic eagle soaring over mountains"
        promptStyle = "rendered as a classical oil painting with visible brushstrokes"
        negativePrompt = "blurry, low quality"

Stored: prompt = "A majestic eagle soaring over mountains. rendered as a classical oil painting with visible brushstrokes"
        prompt_motiv = "A majestic eagle soaring over mountains"
        prompt_style = "rendered as a classical oil painting with visible brushstrokes"
        negative_prompt = "blurry, low quality"

Sent to Replicate: prompt (composite), negative_prompt
```

### Adaptive Improve System Prompt

```
You are an expert prompt engineer for AI image generation.

## Analysis Phase
First, analyze the user's prompt:
1. Identify the main subject/motif
2. Detect existing style keywords
3. Assess detail level (minimal/moderate/rich)
4. Note any composition or lighting cues

## Improvement Strategy
Based on your analysis:
- If minimal detail: Add specific visual details (lighting, composition, perspective, texture)
- If moderate detail: Refine and enhance existing details, add missing dimensions
- If already rich: Polish language, improve specificity, fix contradictions

## Model Optimization
The target model is: {modelId} ({modelDisplayName})
Optimize the prompt for this specific model's strengths:
- FLUX models: Detailed scene descriptions, specific art styles, lighting keywords
- Recraft V4: Design-focused language, clean compositions, professional aesthetics
- Seedream: Dreamlike qualities, atmospheric descriptions, cinematic framing
- Imagen: Natural language descriptions, photorealistic detail cues
- GPT Image: Balanced descriptions, creative concepts
- Ideogram: Text rendering support, graphic design terminology
- Gemini Flash: Quick, efficient prompts with clear subject and style

## Rules
- Keep the core intent and subject of the original prompt
- Output ONLY the improved prompt text, nothing else
- Keep the improved prompt concise but effective
```

### Thumbnail Generation Logic

**On Project Creation:**
1. Set `thumbnail_status = 'pending'`
2. Fire-and-forget: Call OpenRouter LLM to generate a thumbnail prompt from project name
3. Call Replicate API with Recraft V4 model (1024x1024)
4. Resize to 512x512 via Sharp (save bandwidth/storage)
5. Upload to R2: `thumbnails/{projectId}.png`
6. Update project: `thumbnail_url`, `thumbnail_status = 'completed'`
7. On error: `thumbnail_status = 'failed'` (silent, gray placeholder stays)

**On Thumbnail Refresh:**
1. Query latest 10 prompts from project's generations
2. Send to LLM: "Based on these prompts, generate a representative thumbnail prompt"
3. Same flow as above (Replicate → Sharp resize → R2 → DB update)

---

## Security

| Area | Approach |
|------|----------|
| Input Validation | Server actions validate all inputs (non-empty prompts, valid modelId, count 1-4, valid UUIDs) |
| SQL Injection | Drizzle ORM parameterized queries (existing pattern) |
| XSS | React auto-escapes output, no dangerouslySetInnerHTML |
| Rate Limiting | Not in scope (no auth system, single-user app) |
| Secrets | Environment variables for API keys (existing pattern) |
| Image Upload | Only server-side upload to R2 via S3 client (no user file upload) |
| LLM Prompt Injection | Improve service uses system prompt with strict output rules. User prompt is in user message role only |

---

## Architecture Layers

### Data Flow: Structured Prompt → Generation

```
UI (PromptArea)
  │ promptMotiv, promptStyle, negativePrompt, modelId, params
  ▼
Server Action (generateImages)
  │ validate, compose prompt = "{motiv}. {style}"
  ▼
Generation Service (generate)
  │ create DB records with structured + composite fields
  │ fire-and-forget processing
  ▼
Replicate Client (replicateRun)
  │ send composite prompt + negativePrompt
  ▼
Storage Client (upload)
  │ upload PNG to R2
  ▼
DB (updateGeneration)
  │ status=completed, imageUrl, dimensions, seed
```

### Data Flow: Prompt History

```
UI (History Tab)
  │ offset, limit
  ▼
Server Action (getPromptHistory)
  ▼
Prompt History Service (getHistory)
  │ SELECT DISTINCT ON (prompt_motiv, prompt_style, negative_prompt, model_id)
  │ FROM generations
  │ ORDER BY created_at DESC
  │ OFFSET, LIMIT
  ▼
UI renders list with star toggle
```

### Data Flow: Thumbnail Generation

```
UI (Create Project / Refresh Button)
  ▼
Server Action (createProject / generateThumbnail)
  │ set thumbnail_status = 'pending'
  ▼
Thumbnail Service (generateForProject)
  │ 1. LLM generates thumbnail prompt from project name/prompts
  │ 2. Replicate API (Recraft V4) generates image
  │ 3. Sharp resizes to 512x512
  │ 4. Upload to R2
  │ 5. Update DB
  ▼
UI (Project Card) shows thumbnail via thumbnail_url
```

### Data Flow: Adaptive Improve

```
UI (PromptArea → Improve Button)
  │ prompt, modelId
  ▼
Server Action (improvePrompt)
  ▼
Prompt Service (improve)
  │ 1. Build adaptive system prompt with {modelId}, {modelDisplayName}
  │ 2. Call OpenRouter (google/gemini-3.1-pro-preview)
  │ 3. Return { original, improved }
  ▼
UI (LLM Comparison Modal)
  │ Side-by-side: original vs improved
  │ "Optimized for: {modelName}"
  │ Adopt / Discard
```

### Layer Map

| Layer | Files | Responsibility |
|-------|-------|----------------|
| Routes | `app/page.tsx`, `app/projects/[id]/page.tsx` | Server components, data fetching |
| Actions | `app/actions/*.ts` | Validation, orchestration, error wrapping |
| Services | `lib/services/*.ts` | Business logic, external API coordination |
| Clients | `lib/clients/*.ts` | External API wrappers (Replicate, OpenRouter, R2) |
| DB | `lib/db/queries.ts`, `lib/db/schema.ts` | Data access, schema definition |
| UI | `components/**/*.tsx` | React components, state management |
| Config | `lib/models.ts`, `lib/prompt-templates.ts` (NEW), `lib/builder-fragments.ts` (NEW) | Static configuration |

---

## Migration Map

| # | File | Current State | Target State |
|---|------|---------------|--------------|
| 1 | `lib/db/schema.ts` | 3 tables (projects, generations, prompt_snippets) | Add columns: generations.prompt_motiv, prompt_style, is_favorite; projects.thumbnail_url, thumbnail_status |
| 2 | `lib/db/queries.ts` | CRUD for projects, generations | Add: getPromptHistory, getFavorites, toggleFavorite, updateProjectThumbnail |
| 3 | `lib/services/generation-service.ts` | Single prompt field | Accept promptMotiv + promptStyle, compose + store |
| 4 | `lib/services/prompt-service.ts` | Generic system prompt, no model awareness | Adaptive system prompt with prompt analysis + modelId |
| 5 | `components/sidebar.tsx` | Custom sidebar (w-64, not collapsible) | Replace with shadcn Sidebar (collapsible, icon-mode) |
| 6 | `components/workspace/prompt-area.tsx` | Single textarea, builder/improve inline | 3 structured textareas, tab system (Prompt/History/Favorites) |
| 7 | `components/prompt-builder/builder-drawer.tsx` | 3 tabs (Style, Colors, Snippets), single-word options | 6 tabs (Style, Colors, Composition, Lighting, Mood, Snippets), articulated fragments |
| 8 | `components/prompt-builder/category-tabs.tsx` | STYLE_OPTIONS and COLOR_OPTIONS arrays | Expanded with 3 new categories, all options as articulated fragments |
| 9 | `components/prompt-improve/llm-comparison.tsx` | Side-by-side in workspace area | Modal with "Optimized for: {model}" badge |
| 10 | `components/lightbox/lightbox-modal.tsx` | max 70vh image, no fullscreen | Add fullscreen toggle (100% viewport, hide details panel) |
| 11 | `components/project-card.tsx` | Gray placeholder with ImageIcon | Show thumbnail image, refresh button on hover |
| 12 | `app/projects/[id]/page.tsx` | Sidebar + Content side-by-side | Wrap in SidebarProvider, use shadcn Sidebar |
| 13 | `app/actions/prompts.ts` | improvePrompt, snippet CRUD | Add: getPromptHistory, getFavoritePrompts, toggleFavorite. Extend improvePrompt with modelId |
| 14 | `app/actions/projects.ts` | CRUD | Add: generateThumbnail action |
| 15 | `lib/clients/openrouter.ts` | No fetch timeout, single use case | Add configurable timeout via AbortController (default 30s). Accept optional `timeout` param in `chat()` |

### New Files

| File | Purpose |
|------|---------|
| `lib/services/prompt-history-service.ts` | History queries, favorite toggle |
| `lib/services/thumbnail-service.ts` | Thumbnail generation + refresh |
| `lib/prompt-templates.ts` | Hardcoded template presets (Product Shot, Landscape, etc.) |
| `lib/builder-fragments.ts` | Articulated builder fragments for 5 categories |
| `components/workspace/prompt-tabs.tsx` | Tab container: Prompt / History / Favorites |
| `components/workspace/history-list.tsx` | History entries with star toggle, pagination |
| `components/workspace/favorites-list.tsx` | Filtered favorites view |
| `components/workspace/template-selector.tsx` | Template dropdown/popover |
| `drizzle/0001_*.sql` | Migration: new columns + indexes |

---

## Constraints & Integrations

| Dependency | Role | Version (Project) | Version (Current Stable) | Breaking Changes | Notes |
|------------|------|-------------------|--------------------------|------------------|-------|
| Next.js | Framework | 16.1.6 | 16.1.6 | N/A (same) | App Router, Server Components, Server Actions |
| React | UI Library | 19.2.3 | 19.2.3 | N/A (same) | |
| shadcn/ui | Component Library | 3.8.5 (CLI) | 3.8.5 (npm, March 2026) | N/A | Sidebar component needs installation via `npx shadcn@latest add sidebar` |
| Tailwind CSS | Styling | 4 | 4 | N/A | CSS-first config, v4 patterns |
| Drizzle ORM | Database ORM | 0.45.1 | 0.45.1 | N/A | Schema-first, PostgreSQL |
| Drizzle Kit | Migration Tool | 0.31.9 | 0.31.9 | N/A | `drizzle-kit generate` + `drizzle-kit migrate` |
| Replicate | Image Generation | 1.4.0 | 1.4.0 | N/A | Used for image + thumbnail generation. See External API Constraints below |
| Sharp | Image Processing | 0.34.5 | 0.34.5 | N/A | Used for PNG conversion + thumbnail resize |
| OpenRouter | LLM API | Custom client | N/A (REST API) | N/A | Model: google/gemini-3.1-pro-preview. See External API Constraints below |
| Cloudflare R2 | Object Storage | @aws-sdk/client-s3 3.1003.0 | 3.1003.0 | N/A | S3-compatible, used for images + thumbnails |
| Lucide React | Icons | 0.577.0 | 0.577.0 | N/A | Maximize2, Minimize2 for fullscreen toggle |
| Sonner | Toast | 2.0.7 | 2.0.7 | N/A | Error feedback |
| radix-ui | Primitives | 1.4.3 | 1.4.3 | N/A | AlertDialog for confirmations |

### shadcn Sidebar Installation

```bash
npx shadcn@latest add sidebar
```

Provides: `SidebarProvider`, `Sidebar`, `SidebarTrigger`, `SidebarContent`, `SidebarHeader`, `SidebarFooter`, `SidebarGroup`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`

Features: collapsible state (cookie-persisted), icon-mode, keyboard shortcut, mobile drawer (responsive).

### External API Constraints

| API | Rate Limit | Timeout | Priority | Error Handling |
|-----|-----------|---------|----------|----------------|
| Replicate (Image Generation) | Sequential processing per existing pattern (1 concurrent prediction at a time). Existing code already queues generations sequentially to respect rate limits | 120s per prediction (existing `replicate.wait()` default) | User-triggered generations have priority over thumbnail generation | Existing: status → "failed", errorMessage stored |
| Replicate (Thumbnail) | Same sequential queue. Thumbnail requests are enqueued AFTER any pending user generations | 120s per prediction | Low priority: fire-and-forget, does not block user | thumbnail_status → "failed", gray placeholder stays |
| OpenRouter (Improve) | Single-user app, no rate limit concern. OpenRouter free tier: 200 req/min | 30s fetch timeout (NEW: add `AbortController` with 30s timeout to `openrouter.ts`) | User-triggered, blocks UI with loading skeleton | Toast error on timeout/failure |
| OpenRouter (Thumbnail Prompt) | Same client, same limits | 15s fetch timeout (shorter, prompt is simple) | Low priority: fire-and-forget | thumbnail_status → "failed" on timeout |

**Client Change Required:** Add configurable fetch timeout to `lib/clients/openrouter.ts` via `AbortController`. Default: 30s. Thumbnail calls use 15s.

---

## Quality Attributes (NFRs)

| NFR | Technical Approach |
|-----|-------------------|
| History pagination performance | DISTINCT ON query with index on `created_at`. Offset/limit pagination (50 per batch). History index: `(is_favorite)` |
| Thumbnail generation reliability | Fire-and-forget with status tracking. Failed = gray placeholder stays. No user-facing error. Silent retry via refresh button |
| Sidebar collapse persistence | shadcn Sidebar uses cookie-based persistence (built-in). State survives page reload and navigation |
| Lightbox fullscreen responsiveness | CSS-only toggle: `object-contain` + `w-full h-full` vs `max-h-[70vh]`. No layout shift |
| Builder fragment quality | Fragments are curated, hardcoded strings. No runtime generation. Reviewed for prompt engineering quality |
| Improve latency | OpenRouter returns complete JSON response (non-streaming). Modal shows loading skeleton during wait. Typical latency: 2-5s. Fetch timeout: 30s |
| Structured prompt backward compat | Existing `prompt` column unchanged. New columns have defaults. Backfill migration for existing data |
| Mobile responsiveness | shadcn Sidebar handles mobile automatically (drawer overlay). Prompt area and gallery stack vertically |

---

## Risks & Assumptions

| # | Risk/Assumption | Type | Mitigation |
|---|----------------|------|------------|
| 1 | Recraft V4 1024x1024 is oversized for thumbnails (512x512 sufficient) | Risk | Resize via Sharp after generation. Storage cost minimal (PNG ~100KB at 512x512) |
| 2 | LLM-generated thumbnail prompts may produce irrelevant thumbnails | Risk | Fallback to gray placeholder. Manual refresh button as escape hatch |
| 3 | History DISTINCT ON query may be slow with large datasets | Risk | Index on `created_at DESC`. If >10k generations, consider materialized view |
| 4 | OpenRouter model `google/gemini-3.1-pro-preview` availability | Assumption | Model assumed available. If deprecated, swap model ID in config |
| 5 | shadcn Sidebar component compatible with current shadcn CLI version 3.8.5 | Assumption | Official component, well-maintained. Tested via `npx shadcn@latest add sidebar` |
| 6 | Existing generations without prompt_motiv/prompt_style | Risk | Backfill migration copies `prompt` → `prompt_motiv`. Style left empty (acceptable) |
| 7 | Cross-project history query performance | Assumption | Acceptable for single-user app. No multi-tenant concerns |
| 8 | Builder fragments hardcoded (not user-editable) | Assumption | V1 decision per discovery. "My Snippets" tab covers user custom content |
| 9 | Template presets hardcoded | Assumption | V1 decision per discovery. 5-7 templates sufficient for launch |
| 10 | Thumbnail R2 storage path conflicts | Risk | Use `thumbnails/{projectId}.png` with overwrite on refresh. Single file per project |

---

## Builder Fragments Architecture

### Categories & Fragment Structure

```typescript
// lib/builder-fragments.ts
type BuilderFragment = {
  id: string
  label: string        // Display name (e.g., "Oil Painting")
  fragment: string     // Full articulated prompt text
}

type BuilderCategory = {
  id: string
  label: string
  fragments: BuilderFragment[]
}
```

### Categories

| Category | Fragment Count | Example Fragment |
|----------|---------------|-----------------|
| Style | ~9 | "rendered as a classical oil painting with visible brushstrokes, rich impasto texture, and dramatic chiaroscuro lighting" |
| Colors | ~9 | "warm color palette dominated by golden ambers, burnt sienna, and deep crimson tones" |
| Composition | ~6 | "shot from a low angle perspective with dramatic foreshortening, subject towering above the viewer" |
| Lighting | ~6 | "bathed in soft golden hour sunlight with long shadows and warm highlights" |
| Mood | ~6 | "conveying a sense of serene tranquility with soft focus and muted atmospheric haze" |

### Fragment Composition

- Multiple fragments across categories are concatenated with ", " separator
- Preview in drawer shows composed text in real-time
- "Done" writes composed text to Style/Modifier textarea (replaces, not appends)

---

## Prompt Templates Architecture

### Template Structure

```typescript
// lib/prompt-templates.ts
type PromptTemplate = {
  id: string
  label: string
  motiv: string          // Placeholder text for motiv field
  style: string          // Pre-filled style text
  negativePrompt: string // Pre-filled negative prompt
}
```

### Predefined Templates

| Template | Motiv (Placeholder) | Style | Negative Prompt |
|----------|-------------------|-------|-----------------|
| Product Shot | "[Your product] on a clean surface" | "professional product photography, studio lighting, white background, sharp focus, commercial quality" | "blurry, dark, cluttered background, low quality" |
| Landscape | "[Describe the landscape]" | "breathtaking landscape photography, golden hour, dramatic sky, high dynamic range, ultra sharp" | "people, buildings, text, watermark" |
| Character Design | "[Describe your character]" | "detailed character design, full body, concept art style, clean lines, professional illustration" | "blurry, deformed, extra limbs, bad anatomy" |
| Logo Design | "[Your brand/concept]" | "minimalist logo design, clean vector style, professional branding, simple shapes, scalable" | "photorealistic, complex, 3D, gradients, text" |
| Abstract Art | "[Your abstract concept]" | "abstract expressionist artwork, bold colors, dynamic composition, textured brushstrokes, gallery quality" | "realistic, photographic, text, faces" |

---

## Context & Research

### Codebase Patterns (Reusable)

| Pattern | Source | Reuse For |
|---------|--------|-----------|
| Fire-and-forget with DB status tracking | `generation-service.ts` | Thumbnail generation |
| Server Action with validation + error wrapping | `app/actions/generations.ts` | All new actions |
| Drizzle schema extension + migration | `lib/db/schema.ts` | New columns + indexes |
| Sheet drawer (right slide-in) | `components/prompt-builder/builder-drawer.tsx` | Builder Pro (same pattern, expanded) |
| Side-by-side comparison UI | `components/prompt-improve/llm-comparison.tsx` | Improve modal (extract to Dialog) |
| Star/toggle pattern | N/A (new) | History favorite toggle |
| Pagination pattern | N/A (new) | History scroll-to-load-more |

### Key Architecture Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | No separate prompt_history table | Generations already capture all needed data. Avoids duplication and sync issues |
| 2 | Thumbnail via Recraft V4 + Sharp resize | Recraft V4 produces high-quality images. Sharp resize to 512x512 saves storage |
| 3 | Builder fragments as hardcoded config | V1 simplicity. Curated quality > user-generated. "My Snippets" covers custom needs |
| 4 | Templates as hardcoded config | V1 simplicity. 5 templates sufficient for launch. Easy to extend later |
| 5 | Improve modal instead of inline | Side-by-side comparison needs width. Modal provides dedicated space |
| 6 | shadcn Sidebar (official) | Built-in collapse, icon-mode, mobile drawer, cookie persistence. Replaces custom sidebar |
| 7 | Lightbox fullscreen via CSS toggle | No additional library. CSS-only state change (object-contain + full viewport) |
| 8 | Prompt composition at action layer | Actions compose "{motiv}. {style}" before passing to service. Service stays agnostic |

---

## Q&A Log

| # | Question | Answer |
|---|---------|--------|
| -- | No interactive Q&A conducted | Architecture derived directly from comprehensive Discovery + Wireframes + Codebase research |
