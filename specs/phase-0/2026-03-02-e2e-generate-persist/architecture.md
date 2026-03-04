# Architecture: E2E Generate & Persist (Phase 0)

**Epic:** --
**Status:** Draft
**Discovery:** `discovery.md` (same folder)
**Derived from:** Discovery constraints, NFRs, and risks

---

## Problem & Solution

**Problem:**
- Der Weg von "Idee" zu "POD-Design" erfordert zu viele Tools und manuelle Schritte
- Kittl kommt nah dran, bietet aber keine Kontrolle ueber AI-Modelle
- Generierte Bilder gehen verloren wenn man sie nicht sofort speichert

**Solution:**
- Ein eigenes AI Design Tool mit Replicate-Anbindung, visuellem Prompt Builder und persistenter Speicherung
- Alle Generierungen werden automatisch in PostgreSQL + Cloudflare R2 gespeichert

**Business Value:**
- Schnellere Design-Iterationen fuer den eigenen POD-Workflow (Spreadshirt)
- Volle Kontrolle ueber Modelle, Parameter und Prompts

---

## Scope & Boundaries

| In Scope |
|----------|
| Next.js App mit App Router, TypeScript, Tailwind v4, shadcn/ui |
| PostgreSQL (Docker) mit Drizzle ORM |
| Cloudflare R2 Bild-Storage (Public Bucket) |
| Replicate API: Blocking API (`replicate.predictions.create()` + `replicate.wait()`) |
| 6 Modelle: FLUX 2 Pro, Nano Banana 2, Recraft V4, Seedream 5 Lite, Seedream 4.5, Gemini 2.5 Flash Image |
| Dynamische Modell-Parameter via Replicate Schema API |
| Prompt Builder: Style + Colors Kategorien (je 9 Optionen, Text-Labels) |
| Eigene Prompt-Bausteine (user-erstellte Snippets als Kategorie im Builder) |
| "Surprise Me" globaler Zufalls-Button |
| LLM Prompt-Verbesserung via OpenRouter (Button, Ergebnis nebeneinander) |
| Negativ-Prompt Feld (modellabhaengig ein-/ausgeblendet) |
| Projekt-Organisation (Name + Generierungen) |
| Masonry Grid Galerie mit Lightbox/Modal |
| Variationen: Prompt + Parameter uebernehmen, anpassbar, 1-4 Batch |
| Download als PNG |
| Fehlerbehandlung: Toast + Retry in Galerie |

| Out of Scope |
|--------------|
| User Authentication (Personal Tool, kein Login) |
| Bildbearbeitung / Editor (Phase 1) |
| Export / Upscaling auf 4000x4000 (Phase 2) |
| Spreadshirt Direct Upload (Phase 3) |
| Fine-Tuning eigener Modelle (Phase 3) |
| Bild-Previews fuer Prompt Builder Optionen (spaeter nachruestbar) |
| Webhook-basierte Generation (Blocking API reicht) |

---

## API Design

### Overview

| Aspect | Specification |
|--------|---------------|
| Style | Next.js Server Actions (direkte Funktionsaufrufe, kein REST) |
| Authentication | Keine (Personal Tool, Single User) |
| Rate Limiting | Keine eigene (Replicate: 600 req/min, OpenRouter: pay-as-you-go) |

### Server Actions

| Action | Input | Output | Side Effects |
|--------|-------|--------|--------------|
| `createProject` | `{ name: string }` | `{ id, name, createdAt }` | DB INSERT projects |
| `renameProject` | `{ id: UUID, name: string }` | `{ id, name, updatedAt }` | DB UPDATE projects |
| `deleteProject` | `{ id: UUID }` | `{ success: boolean }` | DB DELETE project + generations, R2 DELETE all project images |
| `getProjects` | -- | `Project[]` | -- |
| `getProject` | `{ id: UUID }` | `Project` with generation count + latest thumbnail | -- |
| `getGenerations` | `{ projectId: UUID }` | `Generation[]` sorted by createdAt DESC | -- |
| `generateImages` | `{ projectId, prompt, negativePrompt?, modelId, params: JSON, count: 1-4 }` | `Generation[]` (initial status: "pending") | DB INSERT generations, Replicate API call, R2 upload, DB UPDATE status |
| `retryGeneration` | `{ id: UUID }` | `Generation` | Replicate API call, R2 upload, DB UPDATE status |
| `deleteGeneration` | `{ id: UUID }` | `{ success: boolean }` | DB DELETE generation, R2 DELETE image |
| `improvePrompt` | `{ prompt: string }` | `{ original: string, improved: string }` | OpenRouter API call |
| `getModelSchema` | `{ modelId: string }` | `{ properties: JSON }` | Replicate API call (GET model, extract openapi_schema) |
| `createSnippet` | `{ text: string, category: string }` | `Snippet` | DB INSERT prompt_snippets |
| `updateSnippet` | `{ id: UUID, text: string, category: string }` | `Snippet` | DB UPDATE prompt_snippets |
| `deleteSnippet` | `{ id: UUID }` | `{ success: boolean }` | DB DELETE prompt_snippets |
| `getSnippets` | -- | `Snippet[]` grouped by category | -- |

### Data Transfer Objects (DTOs)

| DTO | Fields | Validation | Notes |
|-----|--------|------------|-------|
| `CreateProjectInput` | `name: string` | Non-empty, max 255 chars, trimmed | -- |
| `GenerateImagesInput` | `projectId: UUID, prompt: string, negativePrompt?: string, modelId: string, params: Record<string, unknown>, count: number` | prompt non-empty, modelId non-empty, count 1-4, params validated client-side via model schema | -- |
| `ImprovePromptInput` | `prompt: string` | Non-empty | -- |
| `CreateSnippetInput` | `text: string, category: string` | text non-empty max 500, category non-empty max 100, both trimmed | -- |

---

## Database Schema

### Entities

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `projects` | Projekt-Container fuer Generierungen | id, name, created_at, updated_at |
| `generations` | Einzelne Bild-Generierungen mit allen Metadaten | id, project_id (FK), prompt, model_id, status, image_url |
| `prompt_snippets` | User-erstellte Prompt-Bausteine | id, text, category, created_at |

### Schema Details

| Table | Column | Type | Constraints | Index |
|-------|--------|------|-------------|-------|
| `projects` | `id` | UUID | PK, DEFAULT gen_random_uuid() | Yes (PK) |
| `projects` | `name` | VARCHAR(255) | NOT NULL | No |
| `projects` | `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | No |
| `projects` | `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | No |
| `generations` | `id` | UUID | PK, DEFAULT gen_random_uuid() | Yes (PK) |
| `generations` | `project_id` | UUID | FK -> projects.id, NOT NULL | Yes |
| `generations` | `prompt` | TEXT | NOT NULL | No |
| `generations` | `negative_prompt` | TEXT | NULLABLE | No |
| `generations` | `model_id` | VARCHAR(255) | NOT NULL | No |
| `generations` | `model_params` | JSONB | NOT NULL, DEFAULT '{}' | No |
| `generations` | `status` | VARCHAR(20) | NOT NULL, DEFAULT 'pending' | Yes |
| `generations` | `image_url` | TEXT | NULLABLE | No |
| `generations` | `replicate_prediction_id` | VARCHAR(255) | NULLABLE | No |
| `generations` | `error_message` | TEXT | NULLABLE | No |
| `generations` | `width` | INTEGER | NULLABLE | No |
| `generations` | `height` | INTEGER | NULLABLE | No |
| `generations` | `seed` | BIGINT | NULLABLE | No |
| `generations` | `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Yes |
| `prompt_snippets` | `id` | UUID | PK, DEFAULT gen_random_uuid() | Yes (PK) |
| `prompt_snippets` | `text` | VARCHAR(500) | NOT NULL | No |
| `prompt_snippets` | `category` | VARCHAR(100) | NOT NULL | Yes |
| `prompt_snippets` | `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | No |

### Data Type Rationale

| Column | Type | Rationale |
|--------|------|-----------|
| `generations.prompt` | TEXT | Prompts koennen beliebig lang sein (kein Limit bekannt) |
| `generations.negative_prompt` | TEXT | Gleiche Begruendung wie prompt |
| `generations.image_url` | TEXT | R2 Public URLs (z.B. `https://pub-cd07f08bbf5d4226b8f7ef9510aef4bd.r2.dev/projects/{id}/{file}.png`) koennen >255 Zeichen sein |
| `generations.error_message` | TEXT | API-Fehlermeldungen haben unbekannte Laenge |
| `generations.model_params` | JSONB | Parameter variieren pro Modell, Schema ist dynamisch |
| `generations.seed` | BIGINT | Seeds koennen grosse Zahlen sein (z.B. 2^32) |
| `generations.model_id` | VARCHAR(255) | Replicate Model IDs wie "black-forest-labs/flux-2-pro" (max ~60 Zeichen, 255 als Buffer) |
| `generations.status` | VARCHAR(20) | Enum-artig: "pending", "completed", "failed" (max 9 Zeichen, 20 als Buffer) |

### Relationships

| From | To | Relationship | Cascade |
|------|-----|--------------|---------|
| `generations` | `projects` | N:1 (many generations per project) | ON DELETE CASCADE (Projekt loeschen loescht alle Generierungen) |

---

## Server Logic

### Services & Processing

| Service | Responsibility | Input | Output | Side Effects |
|---------|----------------|-------|--------|--------------|
| `ProjectService` | Projekt-CRUD | name, id | Project | DB writes |
| `GenerationService` | Bild-Generierung orchestrieren | prompt, model, params, count | Generation[] | Replicate API, R2 Upload, DB writes |
| `ReplicateClient` | Replicate API Kommunikation | model_id, input params | ReplicateRunResult { output: ReadableStream, predictionId: string, seed: number \| null } | Replicate API call (predictions.create + wait) |
| `StorageService` | R2 Bild-Upload/Delete | ReadableStream oder Buffer, key | Public URL | R2 PUT/DELETE |
| `PromptService` | LLM Prompt-Verbesserung | prompt string | improved prompt string | OpenRouter fetch call |
| `ModelSchemaService` | Modell-Parameter-Schema laden | model_id | OpenAPI Schema Properties | Replicate API call (model metadata), In-Memory Cache |
| `SnippetService` | Prompt-Baustein CRUD | text, category | Snippet | DB writes |

### Business Logic Flow: Image Generation

```
Client (Server Action call)
  → GenerationService.generate(projectId, prompt, modelId, params, count)
    → Validate input (prompt non-empty, model exists, count 1-4)
    → Create N generation records in DB (status: "pending")
    → Return pending generations to client (optimistic UI)
    → For each generation (parallel):
      → ReplicateClient.run(modelId, input) [via predictions.create() + replicate.wait()]
        → Returns ReplicateRunResult { output: ReadableStream, predictionId: string, seed: number | null }
      → StorageService.upload(stream, key: "projects/{projectId}/{generationId}.png")
        → Returns R2 Public URL
      → If Replicate returns non-PNG: convert via sharp before upload
      → Update generation in DB (status: "completed", image_url, width, height, seed, replicate_prediction_id)
    → On error per generation:
      → Update generation in DB (status: "failed", error_message)
```

### Business Logic Flow: Prompt Improvement

```
Client (Server Action call)
  → PromptService.improve(prompt)
    → fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: "Bearer ${OPENROUTER_API_KEY}" },
        body: { model: "openai/gpt-oss-120b:exacto", messages: [
          { role: "system", content: IMPROVE_SYSTEM_PROMPT },
          { role: "user", content: prompt }
        ]}
      })
    → Extract improved prompt from response
    → Return { original, improved }
```

### Business Logic Flow: Model Schema

```
Client (Server Action call)
  → ModelSchemaService.getSchema(modelId)
    → Check in-memory cache (Map)
    → If miss: GET https://api.replicate.com/v1/models/{owner}/{name}
      → Extract .latest_version.openapi_schema.components.schemas.Input.properties
      → Cache result
    → Return properties (JSON)
```

### Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `project.name` | Non-empty, max 255, trimmed | "Projektname darf nicht leer sein" |
| `generation.prompt` | Non-empty | "Prompt darf nicht leer sein" |
| `generation.modelId` | Must be one of 6 configured models | "Unbekanntes Modell" |
| `generation.count` | Integer 1-4 | "Anzahl muss zwischen 1 und 4 liegen" |
| `snippet.text` | Non-empty, max 500, trimmed | "Snippet-Text darf nicht leer sein" |
| `snippet.category` | Non-empty, max 100, trimmed | "Kategorie darf nicht leer sein" |

---

## Security

### Authentication & Authorization

| Area | Mechanism | Notes |
|------|-----------|-------|
| App Access | Keine Authentifizierung | Personal Tool, Single User, nur lokal oder per Deploy |
| API Keys | Server-side only (env vars) | REPLICATE_API_TOKEN, OPENROUTER_API_KEY, R2 credentials -- niemals client-side |

### Data Protection

| Data Type | Protection | Notes |
|-----------|------------|-------|
| API Keys | Environment Variables (.env) | .gitignore enthaelt .env |
| R2 Credentials | Server-side S3 Client | Credentials nur in Server Actions / Services |
| User Prompts | Keine Verschluesselung | Keine PII, Personal Tool |

### Input Validation & Sanitization

| Input | Validation | Sanitization |
|-------|------------|--------------|
| Project name | Non-empty, max 255 chars | trim(), kein HTML |
| Prompt text | Non-empty (kein Max -- Modell entscheidet) | Keine Sanitization (wird direkt an Replicate gesendet) |
| Snippet text | Non-empty, max 500 chars | trim() |
| Model ID | Whitelist (6 konfigurierte Modelle) | Strict equality check |
| Model params | Dynamisch validiert gegen Model Schema | Type coercion, Range checks aus Schema |
| Count (Batch) | Integer, 1-4 | parseInt, clamp(1, 4) |

### Rate Limiting & Abuse Prevention

| Resource | Limit | Window | Penalty |
|----------|-------|--------|---------|
| Replicate API | 600 requests | per minute | 429 (Replicate-seitig) |
| OpenRouter API | Pay-as-you-go | -- | 429 bei Ueberlastung |
| Eigene App | Kein Rate Limiting | -- | Personal Tool, kein Bedarf |

---

## Architecture Layers

### Layer Responsibilities

| Layer | Responsibility | Pattern |
|-------|----------------|---------|
| Pages (`app/`) | Routing, Layout, UI Composition | Next.js App Router (Server Components default, Client Components wo noetig) |
| Server Actions (`app/actions/`) | Request Handling, Input Validation, Service Orchestration | "use server" functions, aufgerufen aus Client Components |
| Services (`lib/services/`) | Business Logic, Orchestration, External API Calls | Service Pattern (stateless functions) |
| Database (`lib/db/`) | Schema Definition, Queries, Connection | Drizzle ORM, Repository-artig |
| External Clients (`lib/clients/`) | Replicate SDK, R2 S3 Client, OpenRouter fetch | Thin Wrappers um externe APIs |
| UI Components (`components/`) | Reusable UI Elemente | shadcn/ui + custom components |

### Data Flow

```
Browser (Client Component)
  → Server Action (app/actions/*.ts)
    → Service (lib/services/*.ts)
      → Database (lib/db/queries.ts) → PostgreSQL
      → Replicate Client (lib/clients/replicate.ts) → Replicate API
      → Storage Client (lib/clients/storage.ts) → Cloudflare R2
      → OpenRouter fetch (lib/clients/openrouter.ts) → OpenRouter API
    ← Return data
  ← Revalidate + return to client
```

### Project Structure

```
app/
├── layout.tsx                    # Root Layout (Toaster, global styles)
├── page.tsx                      # Projekt-Uebersicht (/)
├── projects/
│   └── [id]/
│       └── page.tsx              # Projekt-Workspace (/projects/[id])
├── actions/
│   ├── projects.ts               # Project CRUD actions
│   ├── generations.ts            # Generation actions
│   ├── prompts.ts                # Prompt improve + Snippet CRUD
│   └── models.ts                 # Model schema action
components/
├── ui/                           # shadcn/ui components
├── project-card.tsx
├── project-list.tsx
├── workspace/
│   ├── prompt-area.tsx           # Prompt textarea + buttons
│   ├── parameter-panel.tsx       # Dynamic model parameters
│   ├── gallery-grid.tsx          # Masonry gallery
│   ├── generation-card.tsx       # Single gallery item
│   └── generation-placeholder.tsx
├── lightbox/
│   ├── lightbox-modal.tsx
│   └── lightbox-navigation.tsx
├── prompt-builder/
│   ├── builder-drawer.tsx
│   ├── category-tabs.tsx
│   ├── option-chip.tsx
│   ├── snippet-form.tsx
│   └── surprise-me-button.tsx
├── prompt-improve/
│   └── llm-comparison.tsx
└── shared/
    ├── confirm-dialog.tsx
    └── toast-provider.tsx
lib/
├── db/
│   ├── schema.ts                 # Drizzle Schema (projects, generations, prompt_snippets)
│   ├── index.ts                  # DB Connection (postgres.js + drizzle)
│   └── queries.ts                # Typed queries
├── services/
│   ├── project-service.ts
│   ├── generation-service.ts
│   ├── prompt-service.ts
│   ├── model-schema-service.ts
│   └── snippet-service.ts
├── clients/
│   ├── replicate.ts              # Replicate SDK wrapper
│   ├── storage.ts                # R2 S3 Client
│   └── openrouter.ts             # Plain fetch wrapper
├── models.ts                     # Model registry (6 models, IDs, names, prices)
└── utils.ts                      # Shared utilities
drizzle/                          # Migration files (generated by drizzle-kit)
drizzle.config.ts                 # Drizzle Kit config
docker-compose.yml                # PostgreSQL container
```

### Error Handling Strategy

| Error Type | Handling | User Response | Logging |
|------------|----------|---------------|---------|
| Validation Error | Return error object from Server Action | Toast mit Validation-Message | console.warn |
| Replicate API Error | Catch in GenerationService, update generation status to "failed" | Toast + Retry-Button in Galerie-Placeholder | console.error mit prediction_id |
| Replicate Rate Limit (429) | Catch in ReplicateClient | Toast: "Zu viele Anfragen. Bitte kurz warten." | console.warn |
| R2 Upload Error | Catch in StorageService | Toast: "Bild konnte nicht gespeichert werden. Retry?" | console.error |
| OpenRouter Error | Catch in PromptService | Toast: "Prompt-Verbesserung fehlgeschlagen", Panel schliesst automatisch | console.error |
| DB Error | Catch in queries, re-throw | Toast: "Datenbankfehler" | console.error |
| Unknown Error | Global error boundary | Toast: "Unbekannter Fehler" | console.error |

---

## Constraints & Integrations

### Constraints

| Constraint | Technical Implication | Solution |
|------------|----------------------|----------|
| Replicate Output-URLs verfallen nach 1h | Bilder muessen sofort nach Generation persistent gespeichert werden | FileOutput-Stream direkt in R2 pipen, kein Zwischenspeichern der URL |
| Download-Format immer PNG | Replicate liefert je nach Modell unterschiedliche Formate (webp, jpg) | Server-seitige Konvertierung via `sharp` bei Nicht-PNG-Output |
| Blocking API (predictions.create + wait) | Server Action blockiert bis Bild fertig (5-60s je nach Modell) | Client zeigt Placeholder, Action laeuft async im Hintergrund, DB-Status-Polling oder Revalidation |
| Dynamische Model-Parameter | Parameter-UI muss zur Laufzeit aus Schema generiert werden | Model Schema cachen (in-memory Map), UI-Controls dynamisch rendern |
| Personal Tool, kein Auth | Keine Multi-User-Isolation noetig | Alle Daten gehoeren dem einen User, kein RLS |
| DATABASE_URL Format | .env hat `postgresql+asyncpg://` (Python-Format) | Fuer postgres.js auf `postgresql://` aendern oder zweite Variable `DATABASE_URL_JS` |

### Integrations

| Area | System / Capability | Interface | Version | Notes |
|------|----------------------|-----------|---------|-------|
| Frontend | Next.js | App Router, Server Actions, Server/Client Components | 16.1.x (recherchiert via releasebot.io, Feb 2026) | Turbopack fuer Dev |
| Styling | Tailwind CSS | Utility Classes, CSS-first Config | 4.2.1 (recherchiert via npmjs.com, Feb 2026) | v4 CSS-native Config |
| UI Components | shadcn/ui | CLI-installed components (Radix-based) | CLI latest (recherchiert via ui.shadcn.com, Feb 2026) | Radix UI primitives |
| ORM | Drizzle ORM | Schema-first, typed queries | 0.45.1 (recherchiert via npmjs.com, Mar 2026) | mit postgres.js driver |
| Migrations | drizzle-kit | generate + migrate CLI | paired mit drizzle-orm 0.45.1 | SQL migration files |
| DB Driver | postgres (postgres.js) | PostgreSQL client | 3.4.8 (recherchiert via npmjs.com, Jan 2026) | Schnellster JS PG driver |
| Database | PostgreSQL | SQL, JSONB | 16.x (Docker Image) | docker-compose.yml |
| Image Generation | Replicate | `predictions.create()` + `replicate.wait()`, FileOutput stream, Model Schema API | SDK 1.4.0 (recherchiert via npmjs.com, Mar 2026) | 6 konfigurierte Modelle |
| Object Storage | Cloudflare R2 | S3-compatible API (PutObject, DeleteObject, GetObject) | @aws-sdk/client-s3 3.1000.0 (recherchiert via npmjs.com, Mar 2026) | Public Bucket, Egress $0 |
| LLM (Prompt Improve) | OpenRouter | OpenAI-compatible REST API | Plain fetch, kein SDK | Modell: openai/gpt-oss-120b:exacto |
| Image Processing | sharp | PNG conversion | 0.34.5 (recherchiert via npmjs.com, Mar 2026) | Nur bei Nicht-PNG Replicate Output |
| Toasts | sonner (via shadcn/ui) | Toast notifications | paired mit shadcn/ui | Standard Toast Library |

### Configured Models

| Model ID | Display Name | Price/Image | Notes |
|----------|-------------|-------------|-------|
| `black-forest-labs/flux-2-pro` | FLUX 2 Pro | $0.055 | Flagship, hoechste Qualitaet |
| `google/nano-banana-2` | Nano Banana 2 | varies | Google Image Model |
| `recraft-ai/recraft-v4` | Recraft V4 | varies | Design-focused |
| `bytedance/seedream-5-lite` | Seedream 5 Lite | varies | ByteDance lightweight |
| `bytedance/seedream-4.5` | Seedream 4.5 | varies | ByteDance standard |
| `google/gemini-2.5-flash-image` | Gemini 2.5 Flash Image | varies | Google multimodal |

---

## Quality Attributes (NFRs)

### From Discovery -> Technical Solution

| Attribute | Target | Technical Approach | Measure / Verify |
|-----------|--------|--------------------|------------------|
| Generation Speed | Abhaengig vom Modell (5-60s), kein eigenes Target | Blocking API (`predictions.create()` + `replicate.wait()`), UI zeigt Placeholder waehrend Wartezeit | Replicate prediction metrics |
| Storage Persistence | 100% -- kein Bild darf verloren gehen | Sofortiger R2-Upload nach Generation, DB-Eintrag erst nach erfolgreichem Upload als "completed" | DB status check, R2 object existence |
| UI Responsiveness | Prompt-Bereich bedienbar waehrend Generation | Generation laeuft server-side async, UI nicht gesperrt, Placeholder trackt Status | Manual testing |
| Galerie-Performance | Smooth scrolling bei 100+ Bildern | Masonry Grid mit CSS columns oder Virtualisierung bei Bedarf, Thumbnail-Groessen optimiert | Lighthouse, manual testing |
| Cost Efficiency | Minimale laufende Kosten | R2 Free Tier (10GB, $0 Egress), PostgreSQL Docker lokal, Pay-per-use APIs | Monatliche Kosten < $5 bei normalem Use |
| Data Integrity | Konsistenz zwischen DB und R2 | Bei Project/Generation Delete: DB + R2 in Transaction-artiger Reihenfolge (DB first, then R2) | Manual testing |
| Model Schema Freshness | Schema aktuell bei Modellwechsel | In-Memory Cache mit TTL oder Cache-Bust bei Modellwechsel | Schema-Vergleich |

### Monitoring & Observability

| Metric | Type | Target | Alert |
|--------|------|--------|-------|
| Generation success rate | Counter | > 90% | console.error bei Fehler |
| R2 upload success | Counter | 100% | console.error bei Fehler |
| Replicate API response time | Timer | < 60s | console.warn bei > 60s |

---

## Risks & Assumptions

### Assumptions

| Assumption | Technical Validation | Impact if Wrong |
|------------|---------------------|-----------------|
| Replicate Blocking API reicht fuer 1-4 gleichzeitige Generierungen | Server Action kann mehrere parallele `predictions.create()` + `replicate.wait()` Calls machen | Bei Timeout: Webhook-basierte Generation (Out of Scope, Phase 1+) |
| R2 Public Bucket URLs sind stabil (aendern sich nicht) | URL-Format: `{R2_PUBLIC_URL}/{key}` | Bei URL-Aenderung: DB-Migration fuer image_url |
| postgres.js funktioniert mit Next.js Server Actions ohne Connection-Pool-Probleme | Singleton DB-Instance in lib/db/index.ts | Fallback: node-postgres mit explizitem Pool |
| 6 Modelle haben kompatibles Input-Schema fuer dynamische UI | Replicate OpenAPI Schema je Modell pruefen | Hardcoded Fallback-Parameter pro Modell |
| OpenRouter API ist OpenAI-kompatibel fuer Chat Completions | Standard fetch POST, gleiche Response-Struktur | Minimaler Aufwand: Response-Parsing anpassen |
| sharp funktioniert in Next.js Server-Umgebung | Standard Node.js native module | Fallback: Canvas API oder client-seitige Konvertierung |

### Risks & Mitigation

| Risk | Likelihood | Impact | Technical Mitigation | Fallback |
|------|------------|--------|---------------------|----------|
| Replicate API Timeout bei langen Generierungen (>60s) | Medium | Medium | Großzuegiges Timeout (120s), Status-Tracking in DB | Retry-Button, User wartet |
| R2 Upload fehlschlaegt nach erfolgreicher Generation | Low | High | Replicate FileOutput in Memory/Temp buffern, Retry R2 Upload | Generierung als "failed" markieren mit Retry |
| Model Schema aendert sich (Breaking Change) | Low | Medium | Schema-Cache mit TTL, dynamische UI passt sich an | Hardcoded Defaults pro Modell |
| postgres.js Connection Issues bei vielen parallelen Actions | Low | Medium | Connection Pool konfigurieren, max connections | Singleton + Queue |
| sharp native Build Problems | Low | Low | sharp als optional dependency, PNG-Check vor Konvertierung | Bilder im Original-Format speichern |
| OpenRouter Rate Limit / Downtime | Low | Low | Error Handling mit Toast | User verbessert Prompt manuell |

---

## Technology Decisions

### Stack Choices

| Area | Technology | Rationale |
|------|------------|-----------|
| Framework | Next.js 16.1 (App Router) | Server Actions, Server Components, Turbopack Dev, Standard fuer React-Apps |
| Styling | Tailwind CSS 4.2.1 | CSS-first Config, Utility-first, schnell fuer Solo-Dev |
| UI Components | shadcn/ui (Radix-based) | Copy-paste Components, volle Kontrolle, kein Vendor Lock-in |
| ORM | Drizzle ORM 0.45.1 | Kein Codegen, SQL-first, TypeScript-native, kleiner Bundle (57KB) |
| DB Driver | postgres.js | Schnellster JS PostgreSQL-Driver, kein native Build |
| Database | PostgreSQL 16 (Docker) | Robust, JSONB fuer flexible Params, kostenlos lokal |
| Object Storage | Cloudflare R2 | S3-kompatibel, 10GB free, $0 Egress, Public Bucket |
| Image Generation | Replicate SDK 1.4.0 | FileOutput Streaming, Model Registry, Schema API |
| LLM Integration | Plain fetch() an OpenRouter | Minimaler Code (~15 Zeilen), kein SDK-Overhead fuer einen Call |
| Image Processing | sharp | Schnellstes Node.js Image Processing, PNG Conversion |
| Toasts | sonner (via shadcn/ui) | Standard, integriert in shadcn/ui |

### Trade-offs

| Decision | Pro | Con | Mitigation |
|----------|-----|-----|------------|
| Server Actions statt REST | Einfacher, weniger Boilerplate, Type-safe | Nicht testbar mit curl, kein externer API-Consumer | Personal Tool, kein externer Zugriff noetig |
| Blocking API statt Webhooks | Einfacher Code, kein Webhook-Server noetig | Server Action blockiert 5-60s | Parallel execution, UI bleibt responsiv |
| postgres.js statt node-postgres | Schneller, kein native Build | Weniger Community-Resourcen | Gut dokumentiert, Drizzle-empfohlen |
| In-Memory Schema Cache statt Redis | Keine zusaetzliche Dependency | Cache verloren bei Server-Restart | Schema-Fetch ist schnell (~100ms), Cache rebuilt on demand |
| Plain fetch statt OpenAI SDK | Keine Dependency, minimaler Code | Kein Auto-Retry, keine Type-Safety | Ein einziger Endpoint, Error Handling einfach |
| R2 Public Bucket statt Signed URLs | Einfacher, keine URL-Expiration | Bilder theoretisch oeffentlich zugaenglich | Personal Tool, keine sensitiven Bilder, Bucket-Name nicht erratbar |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| -- | Alle Fragen geklaert | -- | -- | -- |

---

## Context & Research

### Web Research (Maerz 2026)

| Source | Finding |
|--------|---------|
| npmjs.com/replicate | SDK v1.4.0: `predictions.create()` + `replicate.wait()` fuer Zugriff auf Prediction-Metadaten (prediction_id, seed aus logs). FileOutput-Objekte (ReadableStream). Output-Files auto-deleted nach 1h |
| Replicate Docs (Output Files) | FileOutput implementiert ReadableStream, kann direkt an fs.writeFile oder Response uebergeben werden. `useFileOutput: false` fuer Legacy URL-Verhalten |
| Replicate Docs (OpenAPI Schema) | Model Schema via GET /v1/models/{owner}/{name} -> .latest_version.openapi_schema.components.schemas.Input.properties |
| npmjs.com/drizzle-orm | v0.45.1, paired mit drizzle-kit. postgres.js als empfohlener Driver. Schema in TypeScript, Migrations via CLI |
| npmjs.com/@aws-sdk/client-s3 | v3.1000.0. Standard S3 Client, kompatibel mit R2 via custom endpoint |
| GitHub openai/openai-node | v6.25.0 (Feb 2026). Nicht benoetigt -- plain fetch reicht fuer OpenRouter |
| npmjs.com/@openrouter/sdk | v0.8.0 (pre-1.0). Nicht benoetigt -- plain fetch reicht |
| Replicate Pricing | FLUX 2 Pro $0.055/image. Andere Modelle variieren. Pay-per-use |
| R2 Pricing | 10GB free storage, $0 Egress immer. Fuer Personal Use wahrscheinlich $0/Monat |
| Next.js | v16.1 stable (Jan 2026). Turbopack default fuer dev. Server Actions stable |
| Tailwind CSS | v4.2.1 (Feb 2026). CSS-first config, kein tailwind.config.js mehr noetig |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-03 | Next.js | v16.1 stable (Jan 2026), v15.5.11 LTS backport |
| 2026-03-03 | Tailwind CSS | v4.2.1 aktuell (Feb 2026), CSS-first Config |
| 2026-03-03 | Drizzle ORM | v0.45.1, postgres.js empfohlen, Schema in TypeScript |
| 2026-03-03 | Replicate SDK | v1.4.0, FileOutput-Objekte statt URLs seit v1.0.0, Output verfaellt nach 1h |
| 2026-03-03 | Replicate Schema | GET /v1/models/{owner}/{name} liefert openapi_schema mit Input.properties |
| 2026-03-03 | @aws-sdk/client-s3 | v3.1000.0, kompatibel mit R2 |
| 2026-03-03 | OpenRouter | OpenAI-kompatible API, plain fetch reicht, kein SDK noetig |
| 2026-03-03 | shadcn/ui | CLI-based, Radix + Base UI support (Feb 2026) |
| 2026-03-03 | sharp | Standard fuer PNG-Konvertierung in Node.js |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| 1 | Soll ich erst umfassend recherchieren oder direkt mit der Architecture starten? | Recherche zuerst |
| 2 | Welchen API-Style soll die App nutzen? (Server Actions vs Route Handlers vs Mix) | Server Actions (direkte Funktionsaufrufe, kein REST) |
| 3 | PostgreSQL-Driver fuer Drizzle: postgres.js oder node-postgres? | postgres.js (schneller, reiner JS, kein native Build) |
| 4 | OpenRouter-Anbindung: SDK oder plain fetch? | Plain fetch (kein SDK noetig fuer einen einzigen API Call) |
