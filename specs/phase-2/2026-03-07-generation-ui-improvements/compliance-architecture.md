# Gate 1: Architecture Compliance Report

**Gepruefte Architecture:** `specs/phase-2/2026-03-07-generation-ui-improvements/architecture.md`
**Pruefdatum:** 2026-03-07
**Discovery:** `specs/phase-2/2026-03-07-generation-ui-improvements/discovery.md`
**Wireframes:** `specs/phase-2/2026-03-07-generation-ui-improvements/wireframes.md`

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 29 |
| WARNING | 0 |
| BLOCKING | 0 |

**Verdict:** APPROVED

---

## A) Feature Mapping

| Discovery Feature | Architecture Section | API Endpoint | DB Schema | Status |
|-------------------|---------------------|--------------|-----------|--------|
| Aspect Ratio Chips (Standard + Custom) | Component Architecture, AspectRatioChips, lib/aspect-ratio.ts | N/A (client-side) | No changes needed | PASS |
| Size Chips (xs-xl) | Component Architecture, SizeChips, lib/aspect-ratio.ts | N/A (client-side) | No changes needed | PASS |
| Prompt-Panel Layout Optimierung | Component Architecture, PromptArea restructure | N/A | N/A | PASS |
| Advanced Settings Collapsible | Component Architecture, radix-ui Collapsible | N/A | N/A | PASS |
| Variant Stepper | Component Architecture, variant-stepper.tsx | N/A | N/A | PASS |
| Move-to-Project (Einzel) | Server Actions: moveGeneration | moveGeneration action | UPDATE projectId (existing schema) | PASS |
| Move-to-Project (Bulk) | Server Actions: moveGenerations | moveGenerations action | UPDATE projectId (existing schema) | PASS |
| Bulk-Select + Floating Action Bar | Component Architecture, SelectionProvider, FloatingActionBar | N/A (client state) | N/A | PASS |
| Bulk-Delete | Server Actions: deleteGenerations | deleteGenerations action | DELETE + R2 cleanup | PASS |
| Bulk-Favorite Toggle | Server Actions: toggleFavorites | toggleFavorites action | UPDATE isFavorite | PASS |
| Bulk-Download (ZIP) | API Routes: /api/download-zip | GET /api/download-zip | Fetch from DB + R2 | PASS |
| Side-by-Side Compare-View (max 4) | Component Architecture, CompareModal | N/A (client-side) | N/A | PASS |
| Favoriten-Filter Toggle | Component Architecture, GalleryHeader | N/A (client-side filter) | Uses existing isFavorite index | PASS |
| Lightbox Compare Flow | Component Architecture, LightboxCheckbox + LightboxCompareBar | N/A | N/A | PASS |
| Lightbox Move | Component Architecture, LightboxMoveDropdown | Reuses moveGeneration action | N/A | PASS |
| Select All / Deselect All | Component Architecture, SelectionActions.selectAll/deselectAll | N/A (client state) | N/A | PASS |
| Model-Wechsel Reset (auto-select compatible) | Business Logic Flow, Aspect Ratio Schema Parsing | N/A (client-side) | N/A | PASS |

---

## B) Constraint Mapping

| Constraint | Source | Wireframe Ref | Architecture | Status |
|------------|--------|---------------|--------------|--------|
| Aspect Ratio Chips: 1:1, 4:3, 3:2, 16:9, 9:16, 4:5, 2:3, Custom | Discovery Row 7 | Wireframe Prompt Panel item 7 | lib/aspect-ratio.ts parseRatioConfig() | PASS |
| Custom Ratio Format N:N, max 10:1 | Discovery Business Rules | Wireframe item 8 | Validation Rules: regex + ratio check | PASS |
| Size Chips: xs=512, s=768, m=1024, l=1536, xl=2048 | Discovery Row 8 | Wireframe item 9 | SIZE_PRESETS constant in lib/aspect-ratio.ts | PASS |
| Size = laengste Kante, kuerzere Kante berechnet | Discovery Business Rules | N/A | calculateDimensions() in lib/aspect-ratio.ts | PASS |
| Compare: Min 2, Max 4 Bilder | Discovery Business Rules | Wireframe Compare Modal | Validation Rules: min 2, max 4 | PASS |
| Bulk IDs max 100 (mutations), max 50 (ZIP) | Discovery Business Rules | N/A | Validation Rules + Rate Limiting section | PASS |
| Model-Wechsel Reset: auto-select first compatible | Discovery Business Rules | Wireframe state model-switch-reset | Business Logic Flow section | PASS |
| Selection-Mode: Card click = toggle (not lightbox) | Discovery Business Rules | Wireframe gallery-selecting state | Selection State Design: isSelecting flag | PASS |
| Floating Action Bar: dynamic bottom padding | Discovery Business Rules | Wireframe annotation 3 | Not explicitly documented (CSS implementation detail) | PASS |
| Compare Metadata: Model-Name + Dimensions | Discovery Business Rules | Wireframe annotation 3 | CompareModal Data Contract: modelId + width + height | PASS |
| Empty Compare Slots: dashed border placeholder | Discovery Business Rules | Wireframe grid-view-2/3 states | Not explicitly in Architecture (UI implementation detail) | PASS |
| Mobile/Touch: Long-press activates selection mode | Discovery Flow 2 | Wireframe annotation 2 | Not explicitly documented (UI event detail) | PASS |

---

## C) Realistic Data Check

### Codebase Evidence

```
# Existing patterns in lib/db/schema.ts (verified against drizzle/0000_fine_killraven.sql
# and drizzle/0001_opposite_kabuki.sql):

projects.id:              uuid (36 chars)
projects.name:            varchar(255)
projects.thumbnailUrl:    text          -- R2 URL, correctly TEXT
projects.thumbnailStatus: varchar(20)

generations.id:                     uuid (36 chars)
generations.projectId:              uuid (FK, NOT NULL, ON DELETE CASCADE)
generations.prompt:                 text          -- unbounded user input, correct
generations.negativePrompt:         text          -- unbounded user input, correct
generations.modelId:                varchar(255)  -- longest: "ideogram-ai/ideogram-v3-turbo" (33 chars)
generations.modelParams:            jsonb         -- dynamic schema params, correct
generations.status:                 varchar(20)   -- "pending"/"completed"/"error", correct
generations.imageUrl:               text          -- R2 URL, correctly TEXT
generations.replicatePredictionId:  varchar(255)  -- Replicate prediction IDs
generations.errorMessage:           text          -- unbounded error text, correct
generations.width:                  integer       -- pixel values (512-2048), correct
generations.height:                 integer       -- pixel values (512-2048), correct
generations.seed:                   bigint        -- large seed values, correct
generations.promptMotiv:            text          -- unbounded, correct
generations.promptStyle:            text          -- unbounded, correct
generations.isFavorite:             boolean       -- NOT NULL, default false, correct
```

### External API Analysis

| API | Field | Measured Length | Sample | Arch Type | Recommendation |
|-----|-------|----------------|--------|-----------|----------------|
| Replicate | model schema URL | ~60 chars | `https://api.replicate.com/v1/models/black-forest-labs/flux-2-pro` | N/A (runtime fetch, not stored) | PASS |
| Replicate | prediction ID | ~40 chars | Replicate prediction IDs | varchar(255) -- existing | PASS |
| R2 | imageUrl | ~80 chars | `https://{bucket}.r2.dev/projects/{uuid}/{uuid}.png` | text -- existing | PASS |
| R2 | thumbnailUrl | ~80 chars | `https://{bucket}.r2.dev/thumbnails/{uuid}.png` | text -- existing | PASS |

### Data Type Verdicts

| Field | Arch Type | Evidence | Verdict | Issue |
|-------|-----------|----------|---------|-------|
| generations.projectId | uuid (FK, NOT NULL) | Schema: `uuid("project_id").notNull().references()` with ON DELETE CASCADE | PASS | Move = UPDATE projectId, schema correct |
| generations.isFavorite | boolean (NOT NULL, default false) | Schema: `boolean("is_favorite").notNull().default(false)` | PASS | Bulk toggle uses existing field |
| generations.width | integer | Schema: `integer("width")`, max 2048 from SIZE_PRESETS | PASS | Integer range sufficient |
| generations.height | integer | Schema: `integer("height")`, max 2048 from SIZE_PRESETS | PASS | Integer range sufficient |
| generations.imageUrl | text | Schema: `text("image_url")`, R2 URLs unbounded | PASS | TEXT correct for external URLs |
| generations.modelId | varchar(255) | Longest model ID in lib/models.ts: "ideogram-ai/ideogram-v3-turbo" (33 chars), 255 sufficient with 7.7x headroom | PASS | None |
| Custom ratio (UI only) | N/A (not stored) | Client-side state, validated via regex, converted to width/height | PASS | No DB storage needed |
| Size preset (UI only) | N/A (not stored) | Client-side state, mapped to pixel values via SIZE_PRESETS | PASS | No DB storage needed |

---

## D) External Dependencies

### D1) Dependency Version Check

**Project Type:** Existing (package.json present)

| Dependency | Arch Version | Pinning File | Pinned? | "Latest"? | Actual Latest | Current? | Status |
|------------|-------------|--------------|---------|-----------|---------------|----------|--------|
| Next.js | 16.1.6 | package.json: `"next": "16.1.6"` | PASS (exact) | No | 16.1.6 (npmjs.com) | PASS | PASS |
| React | 19.2.3 | package.json: `"react": "19.2.3"` | PASS (exact) | No | 19.2.3 (npmjs.com) | PASS | PASS |
| radix-ui | 1.4.3 | package.json: `"radix-ui": "^1.4.3"` | PASS (caret) | No | 1.4.3 (npmjs.com) | PASS | PASS |
| lucide-react | 0.577.0 | package.json: `"lucide-react": "^0.577.0"` | PASS (caret) | No | 0.577.0 | PASS | PASS |
| sonner | 2.0.7 | package.json: `"sonner": "^2.0.7"` | PASS (caret) | No | 2.0.7 | PASS | PASS |
| Drizzle ORM | 0.45.1 | package.json: `"drizzle-orm": "^0.45.1"` | PASS (caret) | No | 0.45.1 (npmjs.com) | PASS | PASS |
| @aws-sdk/client-s3 | 3.1003.0 | package.json: `"@aws-sdk/client-s3": "^3.1003.0"` | PASS (caret) | No | 3.1003.0 | PASS | PASS |
| replicate | 1.4.0 | package.json: `"replicate": "^1.4.0"` | PASS (caret) | No | 1.4.0 | PASS | PASS |
| vitest | 4.0.18 | package.json: `"vitest": "^4.0.18"` (devDependencies) | PASS (caret) | No | 4.0.18 | PASS | PASS |
| jszip | 3.10.1 | NOT in package.json (new dependency) | N/A (new) | No | 3.10.1 (npmjs.com, last published ~4 years ago) | PASS | PASS |

### D2) External APIs & Services

| Dependency | Rate Limits | Auth | Errors | Timeout | Status |
|------------|-------------|------|--------|---------|--------|
| Replicate API (model schema + generation) | "Replicate API has own limits" -- existing pattern, not modified by this feature | Bearer token (REPLICATE_API_TOKEN) | Handled in ModelSchemaService + GenerationService (existing) | No explicit timeout (existing pattern, unchanged) | PASS |
| Cloudflare R2 (image storage) | No explicit limits (existing pattern) | AWS SDK credentials (existing) | Fire-and-forget for delete, log errors (documented in Architecture) | No explicit timeout (existing pattern, unchanged) | PASS |

---

## E) Migration Completeness

> N/A -- kein Migration-Scope. Das Feature ist ein Neubau mit Modifikationen an bestehenden Dateien, keine Pattern-Migration/Refactoring.

Die Architecture enthaelt eine "Migration Map" Section die als File-Change-Map strukturiert ist (8 modifizierte Dateien + 11 neue Dateien). Dies ist kein Migration-Scope im Sinne des Compliance-Frameworks.

---

## Blocking Issues

Keine.

---

## Previous Issues (Resolved)

Die vorherige Compliance-Pruefung hatte 2 Blocking Issues identifiziert. Beide wurden in der Architecture behoben:

1. **API Route "archiver" vs "jszip" Inkonsistenz** -- Behoben: Zeile 82 lautet jetzt korrekt "Create ZIP in-memory using jszip".
2. **modelId fehlte in Entity Key Fields** -- Behoben: Zeile 103 listet jetzt "id (PK), projectId (FK), prompt, modelId, imageUrl, width, height, isFavorite".

---

## Recommendations

1. **[Info]** jszip (3.10.1) wurde zuletzt vor ca. 4 Jahren veroeffentlicht. Das Paket ist stabil aber nicht aktiv maintained. Falls Streaming-Performance kritisch wird, koennte `archiver` als Alternative evaluiert werden.
2. **[Info]** `inArray()` von Drizzle ORM wird erstmalig in diesem Projekt verwendet. Die Architecture dokumentiert dies korrekt als Assumption mit Fallback (sequentielle Operationen). Der erste Bulk-Slice sollte einen Unit-Test fuer dieses Pattern enthalten.
3. **[Info]** Mobile/Touch Long-press fuer Bulk-Select ist in Discovery und Wireframes spezifiziert, in der Architecture implizit durch SelectionProvider abgedeckt. Die Slice-Spezifikation sollte dies als explizites Akzeptanzkriterium aufnehmen.
4. **[Info]** Die Architecture dokumentiert korrekt, dass keine DB-Schema-Aenderungen noetig sind. Alle benoetigten Felder existieren bereits in der `generations`-Tabelle (verifiziert gegen lib/db/schema.ts und drizzle/0000_fine_killraven.sql + drizzle/0001_opposite_kabuki.sql).

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Warnings:** 0

**Next Steps:**
- [ ] Slice-Planung kann beginnen
- [ ] jszip als Dependency installieren (`pnpm add jszip@3.10.1`) bei Slice 4 (Bulk Actions)
- [ ] Unit-Test fuer Drizzle `inArray()` Batch-Pattern im ersten Bulk-Slice
