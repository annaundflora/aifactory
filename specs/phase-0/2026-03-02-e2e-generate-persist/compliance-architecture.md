# Gate 1: Architecture Compliance Report

**Gepruefte Architecture:** `specs/phase-0/2026-03-02-e2e-generate-persist/architecture.md`
**Pruefdatum:** 2026-03-03
**Discovery:** `specs/phase-0/2026-03-02-e2e-generate-persist/discovery.md`
**Wireframes:** `specs/phase-0/2026-03-02-e2e-generate-persist/wireframes.md`
**Versuch:** 2 (Re-Check nach Fix von 2 Blocking Issues aus Versuch 1)

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 31 |
| WARNING | 0 |
| BLOCKING | 0 |

**Verdict:** APPROVED

---

## Previous Blocking Issues -- Fix Verification

| Issue | Was | Fix | Verified | Status |
|-------|-----|-----|----------|--------|
| postgres.js "latest stable" | Keine konkrete Version | Jetzt: `3.4.8` | npm: 3.4.8 ist latest (last published Jan 2026) | PASS |
| sharp "latest stable" | Keine konkrete Version | Jetzt: `0.34.5` | npm: 0.34.5 ist latest (last published Nov 2025) | PASS |
| Tailwind CSS 4.1.x veraltet | 4.1.x statt 4.2.1 | Jetzt: `4.2.1` | npm: 4.2.1 ist latest (last published Feb 2026) | PASS |

Alle 3 Fixes korrekt angewendet.

---

## A) Feature Mapping

| Discovery Feature | Architecture Section | API Endpoint | DB Schema | Status |
|-------------------|---------------------|--------------|-----------|--------|
| Projekt erstellen | API Design > Server Actions | `createProject` | projects | PASS |
| Projekt umbenennen | API Design > Server Actions | `renameProject` | projects (updated_at) | PASS |
| Projekt loeschen | API Design > Server Actions | `deleteProject` | projects + CASCADE, R2 DELETE | PASS |
| Projekt-Uebersicht | API Design > Server Actions | `getProjects`, `getProject` | projects | PASS |
| Bild-Generation (Replicate Blocking) | Server Logic > Business Logic Flow | `generateImages` | generations | PASS |
| 6 Modelle konfiguriert | Constraints & Integrations > Configured Models | `getModelSchema` | generations.model_id | PASS |
| Dynamische Modell-Parameter | Server Logic > ModelSchemaService | `getModelSchema` | generations.model_params (JSONB) | PASS |
| Prompt Builder (Style + Colors, je 9) | Scope (In Scope) | Client-side logic (no server action needed) | N/A (static data) | PASS |
| Eigene Prompt-Bausteine (Snippets) | API Design > Server Actions | `createSnippet`, `updateSnippet`, `deleteSnippet`, `getSnippets` | prompt_snippets | PASS |
| Surprise Me Button | Scope (In Scope) | Client-side logic | N/A | PASS |
| LLM Prompt-Verbesserung | Server Logic > Business Logic Flow: Prompt Improvement | `improvePrompt` | N/A (stateless) | PASS |
| Negativ-Prompt (modellabhaengig) | DB Schema > generations.negative_prompt | `generateImages` (negativePrompt optional) | generations.negative_prompt (NULLABLE TEXT) | PASS |
| Masonry Grid Galerie | Architecture Layers > Project Structure | `getGenerations` | generations (sorted by createdAt DESC) | PASS |
| Lightbox/Modal | Architecture Layers > Project Structure | `getGenerations` (client-side selection) | generations (all fields exposed) | PASS |
| Navigation Prev/Next + Pfeiltasten | Scope (In Scope), Project Structure (lightbox-navigation.tsx) | Client-side | N/A | PASS |
| Variationen (Prompt+Params uebernehmen, 1-4 Batch) | API Design > generateImages (count 1-4) | `generateImages` with count | generations | PASS |
| Download als PNG | Constraints > sharp conversion | Client-side download from R2 URL | generations.image_url | PASS |
| Fehlerbehandlung (Toast + Retry) | Error Handling Strategy | `retryGeneration` | generations.status, error_message | PASS |
| R2 Persistent Storage | Constraints > Replicate Output-URLs verfallen | StorageService | generations.image_url | PASS |
| Keyboard Shortcut Cmd/Ctrl+Enter | Discovery Business Rules | Client-side | N/A | PASS |

**20/20 Features mapped.** Keine Luecken.

---

## B) Constraint Mapping

| Constraint | Source | Wireframe Ref | Architecture | Status |
|------------|--------|---------------|--------------|--------|
| Replicate Output-URLs verfallen nach 1h | Discovery Business Rules | N/A | Constraints: FileOutput-Stream direkt in R2 pipen | PASS |
| Download-Format immer PNG | Discovery Business Rules | Lightbox: Download PNG | Constraints: sharp Konvertierung bei Nicht-PNG | PASS |
| Blocking API 5-60s | Discovery Business Rules | Workspace: generation-placeholder | Constraints: Client zeigt Placeholder, DB-Status | PASS |
| Dynamische Model-Parameter | Discovery Q&A #10, #11 | Workspace: parameter-panel | Server Logic: ModelSchemaService, In-Memory Cache | PASS |
| Negativ-Prompt nur wenn Modell unterstuetzt | Discovery Business Rules | Workspace: negative-prompt hidden state | Constraints: Model Schema check | PASS |
| Varianten-Anzahl 1-4 | Discovery Business Rules | Workspace: variant-count | Validation Rules: count 1-4 | PASS |
| Projektname max 255 chars | Discovery Data: Project | N/A | DB Schema: VARCHAR(255), Validation: max 255 | PASS |
| Snippet max 500 chars | Discovery Data: Prompt Snippet | N/A | DB Schema: VARCHAR(500), Validation: max 500 | PASS |
| Snippet-Kategorie max 100 chars | Discovery Data: Prompt Snippet | N/A | DB Schema: VARCHAR(100), Validation: max 100 | PASS |
| Prompt Builder Concatenation | Discovery Business Rules | Builder: option-chip toggle | Scope: documented | PASS |
| Surprise Me mit Bestaetigung | Discovery Business Rules | Builder: surprise-me-confirm state | Scope: documented | PASS |
| Confirm Dialog vor Delete | Discovery User Flow 7 | Confirmation Dialog wireframe | Error Handling: confirm-dialog component | PASS |
| DATABASE_URL Format | .env: postgresql+asyncpg:// | N/A | Constraints: postgres.js braucht postgresql:// | PASS |

**13/13 Constraints mapped.** Keine Luecken.

---

## C) Realistic Data Check

### Codebase Evidence

```
Greenfield-Projekt: Keine existierenden Migrations oder Schema-Dateien.
Keine package.json vorhanden.
.env vorhanden mit allen benoetigten API Keys und Credentials:
  - REPLICATE_API_TOKEN
  - OPENROUTER_API_KEY
  - R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET, R2_PUBLIC_URL
  - DATABASE_URL (postgresql+asyncpg:// Format -- Architecture adressiert dies)
```

### External API Analysis

**Gemessene Werte:**

| Data Point | Sample Value | Measured Length |
|------------|-------------|----------------|
| R2 Public URL Base (from .env) | `https://pub-cd07f08bbf5d4226b8f7ef9510aef4bd.r2.dev` | 52 chars |
| Full R2 Image URL | `https://pub-cd07f08bbf5d4226b8f7ef9510aef4bd.r2.dev/projects/{uuid}/{uuid}.png` | ~133 chars |
| Replicate Model ID (longest) | `google/gemini-2.5-flash-image` | 30 chars |
| Replicate Model ID (shortest) | `recraft-ai/recraft-v4` | 22 chars |
| Replicate Prediction ID (from Replicate Docs) | `gm3qorzdhgbfurvjtvhg6dckhu` | 26 chars |
| UUID | `550e8400-e29b-41d4-a716-446655440000` | 36 chars |
| Status values | "pending", "completed", "failed" | max 9 chars |

### Data Type Verdicts

| Field | Arch Type | Evidence | Verdict | Issue |
|-------|-----------|----------|---------|-------|
| `projects.id` | UUID | Standard 36 chars | PASS | -- |
| `projects.name` | VARCHAR(255) | User input, Discovery max 255 | PASS | -- |
| `projects.created_at` | TIMESTAMPTZ | Standard | PASS | -- |
| `projects.updated_at` | TIMESTAMPTZ | Standard | PASS | -- |
| `generations.id` | UUID | Standard 36 chars | PASS | -- |
| `generations.project_id` | UUID | FK, standard | PASS | -- |
| `generations.prompt` | TEXT | Unbegrenzt, korrekt fuer variable Prompt-Laengen | PASS | -- |
| `generations.negative_prompt` | TEXT | Unbegrenzt, korrekt | PASS | -- |
| `generations.model_id` | VARCHAR(255) | Gemessen: max 30 chars, 255 ist 8.5x Buffer | PASS | -- |
| `generations.model_params` | JSONB | Dynamisch pro Modell, korrekt | PASS | -- |
| `generations.status` | VARCHAR(20) | Gemessen: max 9 chars ("completed"), 20 ist 2.2x Buffer | PASS | -- |
| `generations.image_url` | TEXT | Gemessen: ~133 chars, TEXT korrekt fuer URLs | PASS | -- |
| `generations.replicate_prediction_id` | VARCHAR(255) | Gemessen: 26 chars (Replicate Docs), 255 ist 9.8x Buffer | PASS | -- |
| `generations.error_message` | TEXT | Unbekannte Laenge, TEXT korrekt | PASS | -- |
| `generations.width` | INTEGER | Pixel-Werte (max ~8192), INTEGER reicht | PASS | -- |
| `generations.height` | INTEGER | Pixel-Werte (max ~8192), INTEGER reicht | PASS | -- |
| `generations.seed` | BIGINT | Seeds koennen >2^31 sein (z.B. 2^32), BIGINT korrekt | PASS | -- |
| `generations.created_at` | TIMESTAMPTZ | Standard | PASS | -- |
| `prompt_snippets.id` | UUID | Standard | PASS | -- |
| `prompt_snippets.text` | VARCHAR(500) | Discovery max 500, 1:1 Match | PASS | -- |
| `prompt_snippets.category` | VARCHAR(100) | Discovery max 100, 1:1 Match | PASS | -- |
| `prompt_snippets.created_at` | TIMESTAMPTZ | Standard | PASS | -- |

**22/22 Datentypen validiert.** Keine Probleme.

---

## D) External Dependencies

### D1) Dependency Version Check

**Projekt-Typ:** Greenfield (kein package.json vorhanden)

| Dependency | Arch Version | Actual Latest (WebSearch) | Current? | Status |
|------------|-------------|---------------------------|----------|--------|
| Next.js | 16.1.x | 16.1.6 (npm, Feb 2026) | PASS (16.1.x umfasst 16.1.6) | PASS |
| Tailwind CSS | 4.2.1 | 4.2.1 (npm, Feb 2026) | PASS | PASS |
| shadcn/ui | CLI latest | CLI-Tool, copy-paste, keine npm-Version | PASS (korrekt dokumentiert) | PASS |
| Drizzle ORM | 0.45.1 | 0.45.1 (npm, Dec 2025) | PASS | PASS |
| drizzle-kit | paired mit drizzle-orm 0.45.1 | Paired korrekt | PASS | PASS |
| postgres (postgres.js) | 3.4.8 | 3.4.8 (npm, Jan 2026) | PASS | PASS |
| PostgreSQL | 16.x (Docker) | 16.x ist stable LTS | PASS | PASS |
| Replicate SDK | 1.4.0 | 1.4.0 (npm, Dec 2025) | PASS | PASS |
| @aws-sdk/client-s3 | 3.1000.0 | 3.1000.0 (npm, Mar 2026) | PASS | PASS |
| sharp | 0.34.5 | 0.34.5 (npm, Nov 2025) | PASS | PASS |
| sonner | paired mit shadcn/ui | Paired korrekt | PASS | PASS |

**11/11 Dependencies verifiziert.** Alle Versionen aktuell und konkret.

### D2) External APIs & Services

| Dependency | Rate Limits | Auth | Errors | Timeout | Status |
|------------|-------------|------|--------|---------|--------|
| Replicate API | 600 req/min (dokumentiert) | REPLICATE_API_TOKEN (env var, server-side) | 429 Rate Limit, Generation Errors -> status "failed" + Toast + Retry | 120s (dokumentiert in Risks) | PASS |
| Cloudflare R2 | Nicht relevant (eigener Bucket) | R2 Credentials (env var, server-side S3 Client) | Upload Error -> Toast + Retry | Nicht kritisch | PASS |
| OpenRouter API | Pay-as-you-go, 429 bei Ueberlastung (dokumentiert) | OPENROUTER_API_KEY (env var, server-side) | Error -> Toast, Panel schliesst | Nicht kritisch (single call) | PASS |
| Replicate Model Schema API | Teil der 600 req/min | REPLICATE_API_TOKEN | Cache-Miss -> GET Request, ~100ms | Cached, nicht kritisch | PASS |

---

## E) Migration Completeness

N/A -- kein Migration-Scope. Greenfield-Projekt.

---

## Blocking Issues

Keine.

---

## Recommendations

Keine -- alle Checks bestanden.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Warnings:** 0

**Next Steps:**
- Architecture ist bereit fuer Slice-Implementierung
- Slice 1 (Infrastruktur & Projekt-CRUD) kann gestartet werden
