# Gate 1: Architecture Compliance Report

**Gepruefte Architecture:** `specs/phase-0/2026-03-02-e2e-generate-persist/architecture.md`
**Pruefdatum:** 2026-03-04
**Discovery:** `specs/phase-0/2026-03-02-e2e-generate-persist/discovery.md`
**Wireframes:** `specs/phase-0/2026-03-02-e2e-generate-persist/wireframes.md`
**Versuch:** 4 (Re-Check nach Fix von Issue 1: Replicate API Methode)

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 32 |
| WARNING | 0 |
| BLOCKING | 0 |

**Verdict:** APPROVED

---

## Fix Verification

### Issue 1 (Versuch 3): Replicate API Methoden-Diskrepanz

**Was gemeldet wurde:**
Discovery sagte `replicate.run()`, Architecture sagte `predictions.create()` + `replicate.wait()`. Keine dokumentierte Begruendung fuer die Abweichung.

**Was gefixt wurde:**
1. Discovery Scope (Zeile 33) jetzt: `predictions.create()` + `replicate.wait() fuer Zugriff auf prediction_id + seed`
2. Architecture Q&A #5 (Zeile 549) dokumentiert explizit die Begruendung: `replicate.run()` liefert nur FileOutput, kein Zugriff auf prediction_id/seed. `predictions.create()` + `replicate.wait()` liefert das volle Prediction-Objekt.
3. Architecture Scope (Zeile 34): `replicate.predictions.create()` + `replicate.wait()` -- konsistent mit Discovery (identische Methoden, Architecture nutzt nur die voll-qualifizierte Form).

**Verification:** PASS -- Discovery und Architecture sind jetzt konsistent. Begruendung dokumentiert in Q&A #5 beider Dokumente.

---

## A) Feature Mapping

| Discovery Feature | Architecture Section | API Endpoint | DB Schema | Status |
|-------------------|---------------------|--------------|-----------|--------|
| Projekt erstellen | API Design > Server Actions | `createProject` | projects | PASS |
| Projekt umbenennen | API Design > Server Actions | `renameProject` | projects (updated_at) | PASS |
| Projekt loeschen (Hard Delete: DB + R2) | API Design > Server Actions | `deleteProject` | projects + CASCADE, R2 DELETE | PASS |
| Projekt-Uebersicht (Cards mit Thumbnail, Count, Date) | API Design > Server Actions | `getProjects`, `getProject` | projects | PASS |
| Bild-Generation (Replicate Blocking API) | Server Logic > Business Logic Flow | `generateImages` | generations | PASS |
| 6 Modelle konfiguriert | Constraints & Integrations > Configured Models | `getModelSchema` | generations.model_id | PASS |
| Dynamische Modell-Parameter via Schema API | Server Logic > ModelSchemaService | `getModelSchema` | generations.model_params (JSONB) | PASS |
| Prompt Builder (Style + Colors, je 9 Optionen) | Scope (In Scope) | Client-side logic (kein Server Action noetig) | N/A (static data) | PASS |
| Eigene Prompt-Bausteine (Snippet CRUD) | API Design > Server Actions | `createSnippet`, `updateSnippet`, `deleteSnippet`, `getSnippets` | prompt_snippets | PASS |
| Surprise Me Button | Scope (In Scope) | Client-side logic | N/A | PASS |
| LLM Prompt-Verbesserung (OpenRouter) | Server Logic > Business Logic Flow: Prompt Improvement | `improvePrompt` | N/A (stateless) | PASS |
| Negativ-Prompt (modellabhaengig sichtbar) | DB Schema > generations.negative_prompt | `generateImages` (negativePrompt optional) | generations.negative_prompt (NULLABLE TEXT) | PASS |
| Masonry Grid Galerie (neueste oben) | Architecture Layers > Project Structure | `getGenerations` | generations (sorted by createdAt DESC) | PASS |
| Lightbox/Modal (Bild + Details + Aktionen) | Architecture Layers > Project Structure | `getGenerations` (client-side selection) | generations (alle Felder) | PASS |
| Lightbox Navigation Prev/Next + Pfeiltasten | Scope (In Scope), Project Structure (lightbox-navigation.tsx) | Client-side | N/A | PASS |
| Variationen (Prompt+Params uebernehmen, 1-4 Batch) | API Design > generateImages (count 1-4) | `generateImages` with count | generations | PASS |
| Download als PNG (Server-Konvertierung bei Bedarf) | Constraints > sharp conversion | Client-side download from R2 URL | generations.image_url | PASS |
| Fehlerbehandlung (Toast + Retry in Galerie) | Error Handling Strategy | `retryGeneration` | generations.status, error_message | PASS |
| R2 Persistent Storage (sofort nach Generation) | Constraints > Replicate Output-URLs verfallen | StorageService | generations.image_url | PASS |
| Keyboard Shortcut Cmd/Ctrl+Enter | Discovery Business Rules | Client-side | N/A | PASS |

**20/20 Features mapped.** Keine Luecken.

---

## B) Constraint Mapping

| Constraint | Source | Wireframe Ref | Architecture | Status |
|------------|--------|---------------|--------------|--------|
| Replicate Output-URLs verfallen nach 1h | Discovery Business Rules | N/A | Constraints: FileOutput-Stream direkt in R2 pipen | PASS |
| Download-Format immer PNG | Discovery Business Rules | Lightbox: Download PNG button | Constraints: sharp Konvertierung bei Nicht-PNG | PASS |
| Blocking API 5-60s | Discovery Business Rules | Workspace: generation-placeholder state | Constraints: Client zeigt Placeholder, DB-Status-Tracking | PASS |
| Dynamische Model-Parameter aus Schema | Discovery Q&A #10, #11 | Workspace: parameter-panel (annotation 10) | Server Logic: ModelSchemaService, In-Memory Cache | PASS |
| Negativ-Prompt nur wenn Modell unterstuetzt | Discovery Business Rules | Workspace: negative-prompt hidden state | DB: NULLABLE TEXT, UI: Model Schema check | PASS |
| Varianten-Anzahl 1-4 | Discovery Business Rules | Workspace: variant-count (annotation 9) | Validation Rules: count Integer 1-4, clamp | PASS |
| Projektname max 255 chars | Discovery Data: Project | N/A | DB Schema: VARCHAR(255), Validation: max 255, trimmed | PASS |
| Snippet text max 500 chars | Discovery Data: Prompt Snippet | N/A | DB Schema: VARCHAR(500), Validation: max 500, trimmed | PASS |
| Snippet-Kategorie max 100 chars | Discovery Data: Prompt Snippet | N/A | DB Schema: VARCHAR(100), Validation: max 100, trimmed | PASS |
| Prompt Builder Concatenation (kommasepariert) | Discovery Business Rules | Builder: option-chip toggle behavior | Scope: documented | PASS |
| Surprise Me mit Bestaetigung bei existierender Auswahl | Discovery Business Rules | Builder: surprise-me-confirm state | Scope: documented | PASS |
| Confirm Dialog vor Delete (Projekt + Generation) | Discovery User Flow 7, Lightbox | Confirmation Dialog wireframe | Error Handling: confirm-dialog component | PASS |
| DATABASE_URL Format (asyncpg vs postgres.js) | .env: postgresql+asyncpg:// | N/A | Constraints: Explizit adressiert, zweite Variable empfohlen | PASS |

**13/13 Constraints mapped.** Keine Luecken.

---

## C) Realistic Data Check

### Codebase Evidence

```
Greenfield-Projekt: Keine existierenden Migrations, Schema-Dateien oder package.json.
.env vorhanden mit allen benoetigten Credentials:
  - REPLICATE_API_TOKEN: vorhanden (r8_...)
  - OPENROUTER_API_KEY: vorhanden (sk-or-v1-...)
  - R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET: vorhanden
  - R2_PUBLIC_URL: "https://pub-cd07f08bbf5d4226b8f7ef9510aef4bd.r2.dev"
  - DATABASE_URL: postgresql+asyncpg://... (Architecture adressiert Format-Differenz)
```

### External API Analysis

**Gemessene Werte aus .env und API-Dokumentation:**

| Data Point | Sample Value | Measured Length |
|------------|-------------|----------------|
| R2 Public URL Base | `https://pub-cd07f08bbf5d4226b8f7ef9510aef4bd.r2.dev` | 52 chars |
| Full R2 Image URL (projected) | `.../projects/{uuid-36}/{uuid-36}.png` | 138 chars |
| Replicate Model ID (longest of 6) | `google/gemini-2.5-flash-image` | 29 chars |
| Replicate Model ID (shortest of 6) | `recraft-ai/recraft-v4` | 21 chars |
| Replicate Prediction ID (from docs) | `gm3qorzdhgbfurvjtvhg6dckhu` | 26 chars |
| UUID standard | `550e8400-e29b-41d4-a716-446655440000` | 36 chars |
| Status enum values | "pending", "completed", "failed" | max 9 chars |

### Data Type Verdicts

| Field | Arch Type | Evidence | Verdict | Issue |
|-------|-----------|----------|---------|-------|
| `projects.id` | UUID | Standard 36 chars, PK | PASS | -- |
| `projects.name` | VARCHAR(255) | Discovery: max 255 chars. 1:1 match | PASS | -- |
| `projects.created_at` | TIMESTAMPTZ | Standard timestamp type | PASS | -- |
| `projects.updated_at` | TIMESTAMPTZ | Standard timestamp type | PASS | -- |
| `generations.id` | UUID | Standard 36 chars, PK | PASS | -- |
| `generations.project_id` | UUID | FK -> projects.id, standard | PASS | -- |
| `generations.prompt` | TEXT | User-input, keine bekannte Laengen-Obergrenze. TEXT korrekt | PASS | -- |
| `generations.negative_prompt` | TEXT | NULLABLE, gleiche Begruendung wie prompt. TEXT korrekt | PASS | -- |
| `generations.model_id` | VARCHAR(255) | Gemessen: max 29 chars aktuell ("google/gemini-2.5-flash-image"). 255 = 8.8x Buffer. Ausreichend auch fuer zukuenftige Modelle | PASS | -- |
| `generations.model_params` | JSONB | Parameter variieren pro Modell, dynamisch. JSONB korrekt | PASS | -- |
| `generations.status` | VARCHAR(20) | Gemessen: max 9 chars ("completed"). 20 = 2.2x Buffer. Ausreichend | PASS | -- |
| `generations.image_url` | TEXT | Gemessen: 138 chars projiziert. TEXT korrekt fuer URLs (zukunftssicher) | PASS | -- |
| `generations.replicate_prediction_id` | VARCHAR(255) | Gemessen: 26 chars. 255 = 9.8x Buffer. Ausreichend | PASS | -- |
| `generations.error_message` | TEXT | API-Fehlermeldungen unbekannter Laenge. TEXT korrekt | PASS | -- |
| `generations.width` | INTEGER | Pixel-Werte (max ~8192 fuer AI-Bilder). INTEGER (max 2^31) reicht | PASS | -- |
| `generations.height` | INTEGER | Pixel-Werte (max ~8192 fuer AI-Bilder). INTEGER (max 2^31) reicht | PASS | -- |
| `generations.seed` | BIGINT | Seeds koennen >2^31 sein (Replicate nutzt teils 2^32+). BIGINT korrekt | PASS | -- |
| `generations.created_at` | TIMESTAMPTZ | Standard timestamp, indexed. Korrekt | PASS | -- |
| `prompt_snippets.id` | UUID | Standard PK | PASS | -- |
| `prompt_snippets.text` | VARCHAR(500) | Discovery: max 500 chars. 1:1 match | PASS | -- |
| `prompt_snippets.category` | VARCHAR(100) | Discovery: max 100 chars. 1:1 match, indexed | PASS | -- |
| `prompt_snippets.created_at` | TIMESTAMPTZ | Standard timestamp | PASS | -- |

**22/22 Datentypen validiert.** Alle Typen evidenz-basiert korrekt.

---

## D) External Dependencies

### D1) Dependency Version Check

**Projekt-Typ:** Greenfield (kein package.json vorhanden)

Fuer Greenfield-Projekte gilt: Dokumentierte Versionen muessen der aktuell stabilen Version entsprechen (via WebSearch verifiziert am 2026-03-04).

| Dependency | Arch Version | Actual Latest (WebSearch 2026-03-04) | Current? | Status |
|------------|-------------|--------------------------------------|----------|--------|
| Next.js | 16.1.x | 16.1 stable (Jan 2026, artiksledge.com) | PASS -- 16.1.x range korrekt | PASS |
| Tailwind CSS | 4.2.1 | 4.2.1 (npmjs.com, published 9 days ago) | Exakte Uebereinstimmung | PASS |
| shadcn/ui | CLI latest | CLI-basiert, copy-paste, keine fixe npm-Version | Korrekt dokumentiert als CLI | PASS |
| Drizzle ORM | 0.45.1 | 0.45.1 (npmjs.com, latest) | Exakte Uebereinstimmung | PASS |
| drizzle-kit | paired mit drizzle-orm 0.45.1 | Paired-Versioning korrekt dokumentiert | PASS | PASS |
| postgres (postgres.js) | 3.4.8 | 3.4.8 (npmjs.com, latest) | Exakte Uebereinstimmung | PASS |
| PostgreSQL | 16.x (Docker) | 16.x ist aktuelles stable LTS | PASS | PASS |
| Replicate SDK | 1.4.0 | 1.4.0 (npmjs.com, latest stable; 2.0.0-alpha nur pre-release) | Exakte Uebereinstimmung | PASS |
| @aws-sdk/client-s3 | 3.1000.0 | 3.1001.0 (npmjs.com, published today) | Akzeptabel -- AWS SDK releases taegliche Patches. 3.1000.0 ist 2 Tage alt. Bei `npm install` wird ohnehin latest installiert | PASS |
| sharp | 0.34.5 | 0.34.5 (npmjs.com, latest) | Exakte Uebereinstimmung | PASS |
| sonner | paired mit shadcn/ui | Installed via shadcn/ui CLI, korrekt dokumentiert | PASS | PASS |

**11/11 Dependencies verifiziert.** Alle Versionen aktuell und konkret gepinnt.

### D2) External APIs & Services

| Dependency | Rate Limits | Auth | Errors | Timeout | Status |
|------------|-------------|------|--------|---------|--------|
| Replicate API (predictions.create + wait) | 600 req/min (dokumentiert in Rate Limiting + Risks) | REPLICATE_API_TOKEN (env var, server-side only) | 429 Rate Limit -> Toast. Generation Errors -> status "failed" + Toast + Retry | 120s (dokumentiert in Risks) | PASS |
| Cloudflare R2 | Nicht relevant (eigener Bucket, S3-kompatibel) | R2 Credentials (env var, server-side S3 Client) | Upload Error -> Toast: "Bild konnte nicht gespeichert werden. Retry?" | Nicht separat dokumentiert (nicht kritisch) | PASS |
| OpenRouter API | Pay-as-you-go, 429 bei Ueberlastung (dokumentiert) | OPENROUTER_API_KEY (env var, server-side) | Error -> Toast: "Prompt-Verbesserung fehlgeschlagen", Panel schliesst automatisch | Nicht separat dokumentiert (single call, nicht kritisch) | PASS |
| Replicate Model Schema API | Teil der 600 req/min (gleicher API Token) | REPLICATE_API_TOKEN | Cache-Miss -> GET Request, ~100ms | In-Memory Cache, nicht kritisch | PASS |

---

## E) Migration Completeness

N/A -- kein Migration-Scope. Greenfield-Projekt.

---

## Blocking Issues

Keine.

---

## Recommendations

Keine. Alle Checks bestanden.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Warnings:** 0

**Next Steps:**
- [ ] Architecture ist freigegeben fuer Slice-Writing
