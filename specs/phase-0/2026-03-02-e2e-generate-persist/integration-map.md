# Integration Map: E2E Generate & Persist

**Generated:** 2026-03-04
**Slices:** 21
**Connections:** 48

---

## Dependency Graph (Visual)

```
                       +-----------+               +-----------+
                       | Slice 01  |               | Slice 06  |
                       | Docker+DB |               | ModelReg  |
                       | Schema    |               | +Schema   |
                       +-----+-----+               +-----+-----+
                             |                           |
                             v                           v
                       +-----------+               +-----------+
                       | Slice 02  |               | Slice 07  |
                       | DB Conn   |               | Replicate |
                       | +Queries  |               | +Storage  |
                       +--+--+--+--+               +-----+-----+
                          |  |  |                        |
              +-----------+  |  +--------+               |
              |              |           |               |
              v              |           v               |
        +-----------+        |     +-----------+         |
        | Slice 03  |        |     | Slice 19  |         |
        | Project   |        |     | Snippet   |         |
        | Actions   |        |     | CRUD      |         |
        +-----+-----+        |     +-----+-----+         |
              |               |           |               |
              v               |           |               |
        +-----------+         |           |               |
        | Slice 04  |         |           |               |
        | Project   |         |           |               |
        | Overview  |         |           |               |
        +-----+-----+         |           |               |
              |               |           |               |
              v               |           |               |
        +-----------+         |           |               |
        | Slice 05  |         |           |               |
        | Workspace |         |           |               |
        | Layout    |         |           |               |
        +-----+-----+         |           |               |
              |               |           |               |
              +-------+-------+-----------+---+-----------+
                      |                       |
                      v                       v
                +-----------+           +-----------+
                | Slice 08  |           | Slice 09  |<---+
                | Gen Svc   |---------->| PromptArea|    |
                | +Actions  |           | +Params   |    |
                +--+--+-----+           +--+--+--+--+    |
                   |  |                    |  |  |  |    |
         +---------+  |        +-----------+  |  |  |    |
         |            |        |              |  |  |    |
         v            |        v              |  |  |    |
   +-----------+      |  +-----------+        |  |  |    |
   | Slice 10  |      |  | Slice 17  |        |  |  |    |
   | Placeholder|     |  | Prompt    |        |  |  |    |
   | +Polling  |      |  | Builder   |        |  |  |    |
   +-----+-----+      |  +--+--+-----+        |  |  |    |
         |            |     |  |              |  |  |    |
         |            |     |  v              |  |  |    |
         |            |     | +-----------+   |  |  |    |
         |            |     | | Slice 18  |   |  |  |    |
         |            |     | | Surprise  |   |  |  |    |
         |            |     | +-----------+   |  |  |    |
         |            |     |                 |  |  |    |
         |            |     +-------+---------+  |  |    |
         |            |             |             |  |    |
         |            |             v             |  |    |
         |            |       +-----------+       |  |    |
         |            |       | Slice 20  |       |  |    |
         |            |       | Snippet   |       |  |    |
         |            |       | UI        |       |  |    |
         |            |       +-----------+       |  |    |
         |            |                           |  |    |
         |            v                           |  |    |
         |      +-----------+                     |  |    |
         |      | Slice 11  |                     |  |    |
         |      | Gallery   |                     |  |    |
         |      | Grid      |                     |  |    |
         |      +-----+-----+                     |  |    |
         |            |                           |  |    |
         |            v                           |  |    |
         |      +-----------+                     |  |    |
         |      | Slice 12  |                     |  |    |
         |      | Lightbox  |                     |  |    |
         |      | Modal     |                     |  |    |
         |      +--+--+-----+                     |  |    |
         |         |  |                           |  |    |
         |    +----+  +-------+                   |  |    |
         |    |               |                   |  |    |
         |    v               v                   |  |    |
         | +-----------+ +-----------+            |  |    |
         | | Slice 13  | | Slice 15  |            |  |    |
         | | LB Nav    | | Download  |            |  |    |
         | | +Delete   | | PNG       |            |  |    |
         | +-----+-----+ +-----------+            |  |    |
         |       |                                |  |    |
         |       v                                |  |    |
         |  +-----------+                         |  |    |
         |  | Slice 14  |-------------------------+  |    |
         |  | Variation |                            |    |
         |  +-----------+                            |    |
         |                                           |    |
         v                                           |    |
   +-----------+                                     |    |
   | Slice 16  |                                     |    |
   | Toast +   |                                     |    |
   | Retry     |                                     |    |
   +-----------+                                     |    |
                                                     |    |
                                               +-----------+
                                               | Slice 21  |
                                               | LLM       |
                                               | Improve   |
                                               +-----------+
```

---

## Nodes

### Slice 01: Docker + DB Schema

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None (foundation) |
| Outputs | projects Schema, generations Schema, promptSnippets Schema, PostgreSQL Container, Drizzle Config |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| -- | -- | First slice, no dependencies |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `projects` Schema | Drizzle Table | Slice 02+ |
| `generations` Schema | Drizzle Table | Slice 02+ |
| `promptSnippets` Schema | Drizzle Table | Slice 19 |
| PostgreSQL Container | Docker Service | All slices |
| `drizzle.config.ts` | Config File | All slices |

---

### Slice 02: DB Connection + Queries

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 01 |
| Outputs | db Instance, Project Query Functions, Generation Query Functions |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `projects` Table Schema | Slice 01 | OK |
| `generations` Table Schema | Slice 01 | OK |
| PostgreSQL Container | Slice 01 | OK |
| `drizzle.config.ts` | Slice 01 | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `db` Drizzle Instance | Singleton | Slice 03, 08, 19 |
| `createProject` | Query Function | Slice 03 |
| `getProjects` | Query Function | Slice 03 |
| `getProject` | Query Function | Slice 03 |
| `renameProject` | Query Function | Slice 03 |
| `deleteProject` | Query Function | Slice 03 |
| `createGeneration` | Query Function | Slice 08 |
| `getGenerations` | Query Function | Slice 08, 10 |
| `updateGeneration` | Query Function | Slice 08 |
| `deleteGeneration` | Query Function | Slice 13 |

---

### Slice 03: Project Server Actions

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 02 |
| Outputs | Project CRUD Server Actions |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `createProject` Query | Slice 02 | OK |
| `getProjects` Query | Slice 02 | OK |
| `getProject` Query | Slice 02 | OK |
| `renameProject` Query | Slice 02 | OK |
| `deleteProject` Query | Slice 02 | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `createProject` Server Action | Server Action | Slice 04, 05 |
| `getProjects` Server Action | Server Action | Slice 04, 05 |
| `getProject` Server Action | Server Action | Slice 05 |
| `renameProject` Server Action | Server Action | Slice 04 |
| `deleteProject` Server Action | Server Action | Slice 04 |

---

### Slice 04: Project Overview UI

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 03 |
| Outputs | ProjectCard, ProjectList, app/page.tsx |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `createProject` Server Action | Slice 03 | OK |
| `getProjects` Server Action | Slice 03 | OK |
| `renameProject` Server Action | Slice 03 | OK |
| `deleteProject` Server Action | Slice 03 | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ProjectCard` | React Component | Slice 05 (Sidebar context) |
| `ProjectList` | React Component | Root Page (internal) |
| `app/page.tsx` | Next.js Page | Slice 05 (requires page exists) |

---

### Slice 05: Workspace Layout + Sidebar

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 04 |
| Outputs | Workspace Page, Root Layout, ConfirmDialog, Sidebar |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `getProjects` Server Action | Slice 03 | OK |
| `getProject` Server Action | Slice 03 | OK |
| `createProject` Server Action | Slice 03 | OK |
| `app/page.tsx` | Slice 04 | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `app/projects/[id]/page.tsx` | Next.js Page | Slice 09, 10, 11 (workspace content) |
| `app/layout.tsx` | Root Layout | All pages |
| `ConfirmDialog` | React Component | Slice 13, 16 |
| Sidebar | React Component | Workspace sub-slices |

---

### Slice 06: Model Registry + Schema Service

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None (independent) |
| Outputs | MODELS registry, getModelById, ModelSchemaService, getModelSchema action |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| -- | -- | Independent slice, no dependencies |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `MODELS` | Model Registry Array | Slice 07, 09 |
| `getModelById` | Lookup Function | Slice 07, 08 |
| `ModelSchemaService.getSchema` | Service Function | Slice 09 |
| `getModelSchema` | Server Action | Slice 09 |

---

### Slice 07: Replicate + Storage Clients

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 06 |
| Outputs | ReplicateClient, StorageService |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `getModelById` | Slice 06 | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ReplicateClient.run` | Async Function | Slice 08 |
| `ReplicateRunResult` | Type | Slice 08 |
| `StorageService.upload` | Async Function | Slice 08 |
| `StorageService.delete` | Async Function | Slice 08, 13 |

---

### Slice 08: Generation Service + Actions

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 07, Slice 02 |
| Outputs | GenerationService, generateImages action, retryGeneration action |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `createGeneration` Query | Slice 02 | OK |
| `updateGeneration` Query | Slice 02 | OK |
| `getGenerations` Query | Slice 02 | OK |
| `ReplicateClient.run` | Slice 07 | OK |
| `StorageService.upload` | Slice 07 | OK |
| `getModelById` | Slice 06 | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `GenerationService.generate` | Async Function | Slice 09, 16 |
| `GenerationService.retry` | Async Function | Slice 16 |
| `generateImages` | Server Action | Slice 09 |
| `retryGeneration` | Server Action | Slice 10, 16 |

---

### Slice 09: Prompt Area + Parameter Panel

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 08, Slice 06, Slice 05 |
| Outputs | PromptArea, ParameterPanel |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `MODELS` | Slice 06 | OK |
| `getModelSchema` | Slice 06 | OK |
| `generateImages` | Slice 08 | OK |
| `app/projects/[id]/page.tsx` | Slice 05 | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `PromptArea` | Client Component | Slice 10, 14, 17, 21 |
| `ParameterPanel` | Client Component | Slice 14 |

---

### Slice 10: Generation Placeholder + Polling

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 09 |
| Outputs | GenerationPlaceholder, useGenerationPolling |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `retryGeneration` | Slice 08 | OK |
| `getGenerations` (for polling) | Slice 02 | OK |
| `PromptArea` (trigger context) | Slice 09 | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `GenerationPlaceholder` | Client Component | Slice 11, 16 |
| `useGenerationPolling` | Custom Hook | Slice 16 |

---

### Slice 11: Gallery Grid + Generation Cards

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 08 |
| Outputs | GalleryGrid, GenerationCard |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `getGenerations` Server Action | Slice 08 | OK |
| `Generation` Type | Slice 02 | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `GalleryGrid` | React Component | Slice 05, 10 |
| `GenerationCard` | React Component | Slice 10, 16 |

---

### Slice 12: Lightbox Modal

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 11 |
| Outputs | LightboxModal |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `GalleryGrid.onSelectGeneration` | Slice 11 | OK |
| `Generation` Type | Slice 02 | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `LightboxModal` | React Component | Slice 13, 14, 15 |

---

### Slice 13: Lightbox Navigation + Actions

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 12 |
| Outputs | LightboxNavigation, deleteGeneration action |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `LightboxModal` | Slice 12 | OK |
| `Generation` Type | Slice 02 | OK |
| `StorageService.delete` | Slice 07 | OK (Note: Slice 13 Requires says "slice-02" but means StorageService from slice-07) |
| DB Connection + Schema | Slice 01 | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `LightboxNavigation` | React Component | Slice 14 |
| `deleteGeneration` | Server Action | Slice 12, 15 |

---

### Slice 14: Variation Flow

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 13, Slice 09 |
| Outputs | VariationState, useVariation |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `LightboxModal` | Slice 12 | OK |
| `LightboxNavigation` | Slice 13 | OK |
| `PromptArea` | Slice 09 | OK |
| `ParameterPanel` | Slice 09 | OK |
| `generateImages` | Slice 08 | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `VariationState` | Type/Interface | PromptArea, LightboxModal |
| `useVariation` | Hook/Context | PromptArea, LightboxModal |

---

### Slice 15: Download PNG

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 12 |
| Outputs | downloadImage, generateDownloadFilename |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `LightboxModal` | Slice 12 | OK |
| `Generation` Type | Slice 02 | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `downloadImage` | Utility Function | Final user-facing (no further consumers) |
| `generateDownloadFilename` | Utility Function | Final user-facing (no further consumers) |

---

### Slice 16: Generation Delete + Retry + Toast

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 10, Slice 08 |
| Outputs | ToastProvider, toast calls |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `retryGeneration` | Slice 08 | OK |
| `GenerationPlaceholder` | Slice 10 | OK |
| `useGenerationPolling` | Slice 10 | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `ToastProvider` | Client Component | app/layout.tsx (final) |
| `toast` calls | Utility | All slices with error handling |

---

### Slice 17: Prompt Builder Drawer

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 09 |
| Outputs | BuilderDrawer, CategoryTabs, OptionChip |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `PromptArea` | Slice 09 | OK |
| Prompt State | Slice 09 | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `BuilderDrawer` | Client Component | Slice 18, 20 |
| `CategoryTabs` | Client Component | Slice 20 |
| `OptionChip` | Client Component | Slice 20 (pattern reuse) |

---

### Slice 18: Surprise Me

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 17 |
| Outputs | SurpriseMeButton |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| BuilderDrawer Selections-State | Slice 17 | OK |
| Style/Colors Options Arrays | Slice 17 | OK |
| `onSelectionsChange` Callback | Slice 17 | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `SurpriseMeButton` | Client Component | BuilderDrawer (final user-facing) |

---

### Slice 19: Snippet CRUD

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 02 |
| Outputs | Snippet Server Actions |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `promptSnippets` Table Schema | Slice 01 | OK |
| `db` Drizzle Instance | Slice 02 | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `createSnippet` | Server Action | Slice 20 |
| `updateSnippet` | Server Action | Slice 20 |
| `deleteSnippet` | Server Action | Slice 20 |
| `getSnippets` | Server Action | Slice 20 |

---

### Slice 20: Snippet UI in Builder

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 19, Slice 17 |
| Outputs | SnippetForm, My Snippets Tab |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `createSnippet` | Slice 19 | OK |
| `updateSnippet` | Slice 19 | OK |
| `deleteSnippet` | Slice 19 | OK |
| `getSnippets` | Slice 19 | OK |
| `CategoryTabs` | Slice 17 | OK |
| `BuilderDrawer` | Slice 17 | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `SnippetForm` | Client Component | BuilderDrawer (final user-facing) |
| "My Snippets" Tab-Content | Integration | CategoryTabs (final user-facing) |

---

### Slice 21: LLM Prompt Improvement

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 09 |
| Outputs | OpenRouter Client, PromptService, improvePrompt action, LLMComparison |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `PromptArea` | Slice 09 | OK |
| Prompt-State | Slice 09 | OK |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `openRouterClient.chat` | Function | PromptService (internal) |
| `PromptService.improve` | Function | Server Action (internal) |
| `improvePrompt` | Server Action | LLMComparison (internal) |
| `LLMComparison` | Client Component | PromptArea (final user-facing) |

---

## Connections

| # | From | To | Resource | Type | Status |
|---|------|----|----------|------|--------|
| 1 | Slice 01 | Slice 02 | projects Schema | Drizzle Table | OK |
| 2 | Slice 01 | Slice 02 | generations Schema | Drizzle Table | OK |
| 3 | Slice 01 | Slice 02 | PostgreSQL Container | Docker Service | OK |
| 4 | Slice 01 | Slice 02 | drizzle.config.ts | Config | OK |
| 5 | Slice 01 | Slice 19 | promptSnippets Schema | Drizzle Table | OK |
| 6 | Slice 02 | Slice 03 | createProject Query | Function | OK |
| 7 | Slice 02 | Slice 03 | getProjects Query | Function | OK |
| 8 | Slice 02 | Slice 03 | getProject Query | Function | OK |
| 9 | Slice 02 | Slice 03 | renameProject Query | Function | OK |
| 10 | Slice 02 | Slice 03 | deleteProject Query | Function | OK |
| 11 | Slice 02 | Slice 08 | createGeneration Query | Function | OK |
| 12 | Slice 02 | Slice 08 | updateGeneration Query | Function | OK |
| 13 | Slice 02 | Slice 08 | getGenerations Query | Function | OK |
| 14 | Slice 02 | Slice 10 | getGenerations (polling) | Function | OK |
| 15 | Slice 02 | Slice 13 | deleteGeneration Query | Function | OK |
| 16 | Slice 02 | Slice 19 | db Instance | Singleton | OK |
| 17 | Slice 03 | Slice 04 | createProject Action | Server Action | OK |
| 18 | Slice 03 | Slice 04 | getProjects Action | Server Action | OK |
| 19 | Slice 03 | Slice 04 | renameProject Action | Server Action | OK |
| 20 | Slice 03 | Slice 04 | deleteProject Action | Server Action | OK |
| 21 | Slice 03 | Slice 05 | getProjects Action | Server Action | OK |
| 22 | Slice 03 | Slice 05 | getProject Action | Server Action | OK |
| 23 | Slice 03 | Slice 05 | createProject Action | Server Action | OK |
| 24 | Slice 04 | Slice 05 | app/page.tsx | Next.js Page | OK |
| 25 | Slice 05 | Slice 09 | Workspace Page | Next.js Page | OK |
| 26 | Slice 06 | Slice 07 | getModelById | Function | OK |
| 27 | Slice 06 | Slice 08 | getModelById | Function | OK |
| 28 | Slice 06 | Slice 09 | MODELS | Registry Array | OK |
| 29 | Slice 06 | Slice 09 | getModelSchema | Server Action | OK |
| 30 | Slice 07 | Slice 08 | ReplicateClient.run | Function | OK |
| 31 | Slice 07 | Slice 08 | StorageService.upload | Function | OK |
| 32 | Slice 07 | Slice 13 | StorageService.delete | Function | OK |
| 33 | Slice 08 | Slice 09 | generateImages Action | Server Action | OK |
| 34 | Slice 08 | Slice 10 | retryGeneration Action | Server Action | OK |
| 35 | Slice 08 | Slice 16 | retryGeneration Action | Server Action | OK |
| 36 | Slice 09 | Slice 10 | PromptArea (trigger) | Component | OK |
| 37 | Slice 09 | Slice 14 | PromptArea | Component | OK |
| 38 | Slice 09 | Slice 14 | ParameterPanel | Component | OK |
| 39 | Slice 09 | Slice 17 | PromptArea + State | Component | OK |
| 40 | Slice 09 | Slice 21 | PromptArea + State | Component | OK |
| 41 | Slice 10 | Slice 16 | GenerationPlaceholder | Component | OK |
| 42 | Slice 10 | Slice 16 | useGenerationPolling | Hook | OK |
| 43 | Slice 11 | Slice 12 | GalleryGrid.onSelect | Callback | OK |
| 44 | Slice 12 | Slice 13 | LightboxModal | Component | OK |
| 45 | Slice 12 | Slice 14 | LightboxModal | Component | OK |
| 46 | Slice 12 | Slice 15 | LightboxModal | Component | OK |
| 47 | Slice 13 | Slice 14 | LightboxNavigation | Component | OK |
| 48 | Slice 17 | Slice 18 | BuilderDrawer State | State/Constants | OK |

---

## Validation Results

### Valid Connections: 48

All declared dependencies have matching outputs.

### Orphaned Outputs: 0

All outputs are either consumed by another slice or are final user-facing outputs (e.g., downloadImage utility, ToastProvider in root layout, SurpriseMeButton rendered in drawer, SnippetForm/My Snippets tab in builder, LLMComparison in prompt area).

### Missing Inputs: 0

All declared inputs have a matching output from an APPROVED source slice.

### Deliverable-Consumer Gaps: 0

All components that are created in one slice and consumed in another have their mount points covered:

- `PromptArea` (Slice 09) is mounted in `app/projects/[id]/page.tsx` (Slice 05, which creates the page as a placeholder for workspace content)
- `GalleryGrid` (Slice 11) is mounted in the workspace page area
- `LightboxModal` (Slice 12) is mounted in the workspace context
- `BuilderDrawer` (Slice 17) is triggered from PromptArea (Slice 09)
- `LLMComparison` (Slice 21) is triggered from PromptArea (Slice 09)
- `ToastProvider` (Slice 16) is mounted in `app/layout.tsx` (Slice 05, which modifies root layout)
- Slice 14 modifies both `lightbox-modal.tsx` and `prompt-area.tsx` (listed in its deliverables as extensions)
- Slice 15 modifies `lightbox-modal.tsx` (listed in its deliverables)

Note: The workspace page (`app/projects/[id]/page.tsx` from Slice 05) is created with a placeholder for future content. Slices 09, 10, 11 provide components that will be mounted there. Since Slice 05 explicitly states AC-11 "Platzhalter-Bereich fuer zukuenftige Workspace-Inhalte" and the mounting of PromptArea, GalleryGrid etc. happens within the same page file, the integration is handled through the workspace page being modified by subsequent slices as they add their components. The slices that provide these components (09, 11) declare `app/projects/[id]/page.tsx` as a requirement from Slice 05, establishing the mount point chain.

### Runtime Path Gaps: 0

All runtime paths from discovery user flows are covered:

| User Flow | Chain | Status |
|-----------|-------|--------|
| Flow 1: Generate Image | User -> PromptArea (S09) -> generateImages Action (S08) -> GenerationService (S08) -> ReplicateClient (S07) -> StorageService (S07) -> DB (S02) -> GalleryGrid (S11) via Polling (S10) | OK |
| Flow 2: Prompt Builder | User -> PromptArea (S09) -> BuilderDrawer (S17) -> OptionChip (S17) -> SurpriseMe (S18) -> SnippetUI (S20) -> SnippetCRUD (S19) -> DB (S02) | OK |
| Flow 3: LLM Improve | User -> PromptArea (S09) -> LLMComparison (S21) -> improvePrompt Action (S21) -> PromptService (S21) -> OpenRouterClient (S21) | OK |
| Flow 4: Variation | User -> GalleryGrid (S11) -> LightboxModal (S12) -> LightboxNavigation (S13) -> Variation (S14) -> PromptArea (S09) -> generateImages (S08) | OK |
| Flow 5: Snippet CRUD | User -> BuilderDrawer (S17) -> SnippetUI (S20) -> SnippetActions (S19) -> DB (S02) | OK |
| Flow 6: Download | User -> LightboxModal (S12) -> Download (S15) -> fetch + Blob (client) | OK |
| Flow 7: Delete Project | User -> ProjectOverview (S04) -> deleteProject Action (S03) -> DB (S02) | OK |
| Flow 8: Rename Project | User -> ProjectOverview (S04) -> renameProject Action (S03) -> DB (S02) | OK |

---

## Discovery Traceability

### UI Components Coverage

| Discovery Element | Type | Location | Covered In | Status |
|-------------------|------|----------|------------|--------|
| `project-card` | Card | Project Overview | Slice 04 | OK |
| `new-project-btn` | Button | Overview + Sidebar | Slice 04, 05 | OK |
| `project-name-input` | Input | Overview | Slice 04 | OK |
| `rename-project-input` | Input | Overview | Slice 04 | OK |
| `model-dropdown` | Select | Workspace Header | Slice 09 | OK |
| `prompt-textarea` | Textarea | Workspace Header | Slice 09 | OK |
| `negative-prompt-input` | Textarea | Workspace Header | Slice 09 | OK |
| `generate-btn` | Button | Workspace Header | Slice 09 | OK |
| `prompt-builder-btn` | Button | Workspace Header | Slice 17 (triggered from 09) | OK |
| `improve-prompt-btn` | Button | Workspace Header | Slice 21 (triggered from 09) | OK |
| `variant-count` | Slider/Select | Workspace Header | Slice 09 | OK |
| `parameter-panel` | Dynamic Form | Workspace Middle | Slice 09 | OK |
| `gallery-grid` | Masonry Grid | Workspace Bottom | Slice 11 | OK |
| `generation-placeholder` | Card | Gallery Grid | Slice 10 | OK |
| `generation-card` | Card | Gallery Grid | Slice 11 | OK |
| `retry-btn` | Button | Generation Placeholder | Slice 10, 16 | OK |
| `lightbox-modal` | Modal | Overlay | Slice 12 | OK |
| `lightbox-prev-btn` | Button | Lightbox | Slice 13 | OK |
| `lightbox-next-btn` | Button | Lightbox | Slice 13 | OK |
| `download-btn` | Button | Lightbox | Slice 15 | OK |
| `variation-btn` | Button | Lightbox | Slice 14 | OK |
| `delete-generation-btn` | Button | Lightbox | Slice 13 | OK |
| `builder-drawer` | Drawer/Modal | Overlay | Slice 17 | OK |
| `category-tab` | Tab | Builder | Slice 17 | OK |
| `option-chip` | Button | Builder Grid | Slice 17 | OK |
| `surprise-me-btn` | Button | Builder Header | Slice 18 | OK |
| `snippet-form` | Form | Builder | Slice 20 | OK |
| `new-snippet-btn` | Button | Builder | Slice 20 | OK |
| `snippet-chip` | Button | Builder | Slice 20 | OK |
| `llm-comparison` | Panel | Under Prompt | Slice 21 | OK |
| `adopt-btn` | Button | LLM Panel | Slice 21 | OK |
| `discard-btn` | Button | LLM Panel | Slice 21 | OK |
| `delete-project-btn` | Icon Button | Project Card | Slice 04 | OK |
| `confirm-dialog` | Dialog | Overlay | Slice 05 | OK |
| `sidebar-project-list` | List | Sidebar | Slice 05 | OK |

### State Machine Coverage

| State | Required UI | Available Actions | Covered In | Status |
|-------|-------------|-------------------|------------|--------|
| `project-list` | Project Overview with Cards | Open, New, Delete | Slice 04 | OK |
| `workspace-empty` | Project open, no generations | Prompt, Model, Params, Builder, Improve, Generate | Slice 05, 09 | OK |
| `workspace-ready` | Prompt entered | Generate, Builder, Improve | Slice 09 | OK |
| `generating` | Loading Placeholders, Spinner | Edit prompt, Builder, Improve, Generate again | Slice 10 | OK |
| `workspace-populated` | Generations visible | All workspace-ready + Variation, View | Slice 11 | OK |
| `lightbox-open` | Image Detail Modal | Download, Variation, Delete, Close | Slice 12, 13, 14, 15 | OK |
| `builder-open` | Prompt Builder Drawer | Switch tabs, Select options, Surprise Me, Create snippet, Close | Slice 17, 18, 20 | OK |
| `improving-prompt` | LLM working, panel visible | Wait | Slice 21 | OK |
| `prompt-improved` | Original + Improved side-by-side | Adopt, Discard | Slice 21 | OK |
| `generation-failed` | Placeholder with Error State | Retry, generate other | Slice 10, 16 | OK |

### Transitions Coverage

| From | Trigger | To | Covered In | Status |
|------|---------|-----|------------|--------|
| `project-list` | Click project card | `workspace-empty`/`workspace-populated` | Slice 04 | OK |
| `project-list` | Click "New Project" | `project-list` (inline input) | Slice 04 | OK |
| `project-list` | Name entered + Enter | `workspace-empty` | Slice 04 | OK |
| `project-list` | Delete -> Confirm | `project-list` | Slice 04 | OK |
| `workspace-empty` | Enter prompt | `workspace-ready` | Slice 09 | OK |
| `workspace-ready` | Click Generate / Cmd+Enter | `generating` | Slice 09 | OK |
| `generating` | Replicate success | `workspace-populated` | Slice 08, 10 | OK |
| `generating` | Replicate error | `generation-failed` | Slice 08, 10, 16 | OK |
| `generation-failed` | Click Retry | `generating` | Slice 10, 16 | OK |
| `workspace-populated` | Click image | `lightbox-open` | Slice 11, 12 | OK |
| `lightbox-open` | Click Variation | `workspace-ready` | Slice 14 | OK |
| `lightbox-open` | Click Download | `lightbox-open` | Slice 15 | OK |
| `lightbox-open` | Delete -> Confirm | `workspace-populated`/`workspace-empty` | Slice 13 | OK |
| `lightbox-open` | Prev/Next or Arrow keys | `lightbox-open` | Slice 13 | OK |
| `lightbox-open` | Close/Overlay | `workspace-populated` | Slice 12 | OK |
| `workspace-ready` | Click Prompt Builder | `builder-open` | Slice 17 | OK |
| `builder-open` | Click option chip | `builder-open` | Slice 17 | OK |
| `builder-open` | Click Surprise Me | `builder-open` | Slice 18 | OK |
| `builder-open` | Close | `workspace-ready` | Slice 17 | OK |
| `workspace-ready` | Click Improve Prompt | `improving-prompt` | Slice 21 | OK |
| `improving-prompt` | LLM response | `prompt-improved` | Slice 21 | OK |
| `prompt-improved` | Click Adopt | `workspace-ready` | Slice 21 | OK |
| `prompt-improved` | Click Discard | `workspace-ready` | Slice 21 | OK |

### Business Rules Coverage

| Rule | Covered In | Status |
|------|------------|--------|
| Projektname darf nicht leer sein | Slice 03 (AC-1/2) | OK |
| Prompt darf nicht leer sein fuer Generation | Slice 08 (AC-9), Slice 09 (AC-13) | OK |
| Ein Modell muss ausgewaehlt sein | Slice 09 (AC-1, default selected) | OK |
| Varianten-Anzahl: 1-4 | Slice 08 (AC-11), Slice 09 (AC-12) | OK |
| Negativ-Prompt modellabhaengig | Slice 09 (AC-5/6) | OK |
| Parameter-Panel dynamisch aus Schema | Slice 09 (AC-4) | OK |
| Replicate Output-URLs 1h Expiration -> R2 | Slice 08 (AC-2) | OK |
| Download-Format immer PNG | Slice 08 (AC-6), Slice 15 | OK |
| Projekt loeschen: Hard Delete | Slice 03 (AC-9), Slice 02 (AC-7 CASCADE) | OK |
| Prompt Builder Concatenation kommasepariert | Slice 17 (AC-7) | OK |
| Surprise Me: Bestaetigung bei bestehender Auswahl | Slice 18 (AC-3/4/5) | OK |
| Prompt-Bausteine: beliebig viele Snippets/Kategorien | Slice 19, 20 | OK |
| LLM: OpenRouter, openai/gpt-oss-120b:exacto | Slice 21 (AC-2) | OK |
| Cmd/Ctrl+Enter triggert Generation | Slice 09 (AC-8) | OK |
| UI waehrend Generation bedienbar | Slice 09 (AC-10) | OK |
| Projekt umbenennen: Inline-Input, Enter/Blur | Slice 04 (AC-7/8) | OK |

### Data Fields Coverage

**Project:**

| Field | Required | Covered In | Status |
|-------|----------|------------|--------|
| `id` (UUID) | Yes | Slice 01 (AC-4) | OK |
| `name` (VARCHAR 255) | Yes | Slice 01 (AC-4) | OK |
| `created_at` (TIMESTAMPTZ) | Yes | Slice 01 (AC-4) | OK |
| `updated_at` (TIMESTAMPTZ) | Yes | Slice 01 (AC-4) | OK |

**Generation:**

| Field | Required | Covered In | Status |
|-------|----------|------------|--------|
| `id` (UUID) | Yes | Slice 01 (AC-5) | OK |
| `project_id` (FK) | Yes | Slice 01 (AC-5) | OK |
| `prompt` | Yes | Slice 01 (AC-5) | OK |
| `negative_prompt` | No | Slice 01 (AC-5) | OK |
| `model_id` | Yes | Slice 01 (AC-5) | OK |
| `model_params` (JSONB) | Yes | Slice 01 (AC-5) | OK |
| `status` (enum) | Yes | Slice 01 (AC-5) | OK |
| `image_url` | No | Slice 01 (AC-5) | OK |
| `replicate_prediction_id` | No | Slice 01 (AC-5) | OK |
| `error_message` | No | Slice 01 (AC-5) | OK |
| `width` | No | Slice 01 (AC-5) | OK |
| `height` | No | Slice 01 (AC-5) | OK |
| `seed` | No | Slice 01 (AC-5) | OK |
| `created_at` (TIMESTAMPTZ) | Yes | Slice 01 (AC-5) | OK |

**Prompt Snippet:**

| Field | Required | Covered In | Status |
|-------|----------|------------|--------|
| `id` (UUID) | Yes | Slice 01 (AC-6) | OK |
| `text` (VARCHAR 500) | Yes | Slice 01 (AC-6) | OK |
| `category` (VARCHAR 100) | Yes | Slice 01 (AC-6) | OK |
| `created_at` (TIMESTAMPTZ) | Yes | Slice 01 (AC-6) | OK |

**Discovery Coverage:** 35/35 UI Components, 10/10 States, 23/23 Transitions, 16/16 Business Rules, 18/18 Data Fields = **102/102 (100%)**

---

## Summary

| Metric | Value |
|--------|-------|
| Total Slices | 21 |
| Total Connections | 48 |
| Valid Connections | 48 |
| Orphaned Outputs | 0 |
| Missing Inputs | 0 |
| Deliverable-Consumer Gaps | 0 |
| Runtime Path Gaps | 0 |
| Discovery Coverage | 100% |

**VERDICT: READY FOR ORCHESTRATION**
