# Slice 03: Next.js Route Handlers GET/PATCH `/api/projects/[id]/context`

> **Slice 03 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-03-context-routes` |
| **Test** | `pnpm test app/api/projects/[id]/context/__tests__/route.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-db-queries-helpers"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

> **Quelle:** Auto-detected — TypeScript/Next.js 16 App Router. Repo nutzt **keine Zod**; Validation per inline-Type-Guards (siehe `app/api/sam/segment/route.ts`). Tests via Vitest + gemockte DB-Helper (Pattern aus `app/api/models/sync/__tests__/route.test.ts`).

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs + vitest` |
| **Test Command** | `pnpm test app/api/projects/[id]/context/__tests__/route.test.ts` |
| **Integration Command** | `pnpm test app/api/projects/[id]/context/__tests__/route.test.ts` (selbe Datei — Helper sind gemockt, Endpoint via Direct-Handler-Invocation getestet) |
| **Acceptance Command** | `pnpm tsc --noEmit` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `GET /api/projects/{seed-uuid}/context` (200 für Owner-Session, 404 sonst) |
| **Mocking Strategy** | `mock_external` (Vitest mockt `@/lib/db/queries` und `@/lib/auth/guard`; KEINE echte DB) |

---

## Ziel

Next.js Route Handler für `GET` und `PATCH /api/projects/{id}/context`: HTTP-Boundary für Settings-UI (Slice 06) und No-Context-Banner (Slice 10). Wraps die Slice-02-Query-Helper mit Auth-Guard, DTO-Validation (≤8000 chars post-trim) und Status-Code-Mapping (401/404/422).

---

## Acceptance Criteria

1) **GIVEN** kein gültiger Auth-Session-Cookie (oder `requireAuth()` liefert `{ error }`)
   **WHEN** `GET` oder `PATCH /api/projects/{id}/context` aufgerufen wird
   **THEN** Response ist `401 Unauthorized` mit Body `{ error: "Unauthorized" }`; KEIN DB-Aufruf erfolgt (siehe architecture.md → Section "Authentication & Authorization", Zeile 355).

2) **GIVEN** authentifizierter User, der ein Projekt besitzt mit `contextInstructions = "draw cyberpunk"` und `contextUpdatedAt = 2026-05-01T10:00:00Z`
   **WHEN** `GET /api/projects/{id}/context` aufgerufen wird
   **THEN** Response ist `200 OK` mit JSON-Body matching `ProjectContextResponse` aus architecture.md → Section "DTO Schemas" (Zeile 142): `{ id: string, context_instructions: "draw cyberpunk", context_updated_at: "2026-05-01T10:00:00.000Z" }`.

3) **GIVEN** authentifizierter User, dem das angefragte Projekt **nicht** gehört (oder Projekt existiert gar nicht)
   **WHEN** `GET /api/projects/{id}/context` aufgerufen wird
   **THEN** Response ist `404 Not Found` mit Body `{ error: "Project not found" }`; **kein** Unterschied zwischen "fremdes Projekt" und "nicht existent" (no-existence-leak; siehe architecture.md → Section "Authentication & Authorization", Zeile 356).

4) **GIVEN** authentifizierter Owner und Request-Body `{ context_instructions: "  hello world  " }`
   **WHEN** `PATCH /api/projects/{id}/context` mit `Content-Type: application/json` aufgerufen wird
   **THEN** Response ist `200 OK` mit Body `{ id, context_instructions: "hello world", context_updated_at: "<ISO timestamp ≥ request-time>" }`; Whitespace ist getrimmt (siehe architecture.md → Section "Input Validation & Sanitization", Zeile 383); Folge-`GET` liefert denselben Wert.

5) **GIVEN** authentifizierter Owner und Request-Body mit `context_instructions` von `8001` Zeichen (post-trim)
   **WHEN** `PATCH /api/projects/{id}/context` aufgerufen wird
   **THEN** Response ist `422 Unprocessable Entity` mit Body `{ error: "Context exceeds maximum length of 8000 characters." }` (Wortlaut exakt aus architecture.md Zeile 337); KEIN DB-UPDATE wird ausgeführt.

6) **GIVEN** authentifizierter Owner und Request-Body `{ context_instructions: null }`
   **WHEN** `PATCH /api/projects/{id}/context` aufgerufen wird
   **THEN** Response ist `200 OK`; `updateProjectContext` wird mit `contextInstructions: null` aufgerufen (Clear-Pfad, siehe Slice 02 AC-4-Variante); Response-Body enthält `context_instructions: null`.

7) **GIVEN** authentifizierter Owner und Request-Body, der NICHT JSON ist oder kein `context_instructions`-Feld enthält (z.B. `{}`, `{ foo: "bar" }`, oder rohes `"text"`)
   **WHEN** `PATCH /api/projects/{id}/context` aufgerufen wird
   **THEN** Response ist `422` mit Body `{ error: "Invalid request body" }`; KEIN DB-Aufruf.

8) **GIVEN** authentifizierter User, dem das Projekt nicht gehört
   **WHEN** `PATCH /api/projects/{id}/context` mit gültigem Body aufgerufen wird
   **THEN** Response ist `404` (gleiche Semantik wie AC-3); `updateProjectContext` liefert `null` → Handler mappt zu 404; KEIN UPDATE ist persistiert (Slice 02 AC-5 Garantie).

9) **GIVEN** Next.js 16 App Router Dynamic-Segment-Konvention
   **WHEN** der Handler-Implementer die `params`-Signatur prüft
   **THEN** beide Handler nutzen `{ params }: { params: Promise<{ id: string }> }` und `await params` zur Extraktion (Pattern aus `app/projects/[id]/page.tsx:14-18`); `runtime = "nodejs"` ist explizit gesetzt (postgres-js benötigt TCP — siehe `app/api/models/sync/route.ts:19`).

---

## Test Skeletons

> **Hinweis für Test-Writer:** Pattern aus `app/api/models/sync/__tests__/route.test.ts` (Vitest, `vi.mock` für `@/lib/auth/guard` und `@/lib/db/queries`). Handler werden direkt aufgerufen mit gemocktem `Request`-Objekt + `{ params: Promise.resolve({ id }) }`. KEIN echter HTTP-Server, KEINE echte DB.

### Test-Datei: `app/api/projects/[id]/context/__tests__/route.test.ts`

<test_spec>
```typescript
// AC-1: 401 wenn Auth fehlt — beide Methoden
it.todo('GET returns 401 when requireAuth returns { error }')
it.todo('PATCH returns 401 when requireAuth returns { error }')

// AC-2: 200 mit ProjectContextResponse-Shape für Owner
it.todo('GET returns 200 with ProjectContextResponse shape (snake_case fields, ISO timestamp)')

// AC-3: 404 für fremden User UND nicht-existentes Projekt — gleiches Verhalten
it.todo('GET returns 404 with { error: "Project not found" } when getProjectContext returns null')

// AC-4: PATCH happy path — trim + persist, Re-GET zeigt neuen Wert
it.todo('PATCH trims whitespace and returns updated context_instructions + new context_updated_at')

// AC-5: PATCH 422 wenn post-trim > 8000 chars (genaue Fehlermeldung)
it.todo('PATCH returns 422 with exact message when context_instructions exceeds 8000 chars post-trim')

// AC-6: PATCH null clears context
it.todo('PATCH accepts context_instructions: null and persists null')

// AC-7: PATCH 422 bei malformed body / fehlendem Feld / Non-JSON
it.todo('PATCH returns 422 with { error: "Invalid request body" } when body is not JSON or missing context_instructions')

// AC-8: PATCH 404 bei Ownership-Mismatch (kein UPDATE persistiert — Slice 02 garantiert)
it.todo('PATCH returns 404 when updateProjectContext returns null (foreign user)')

// AC-9: Next.js 16 params-Promise-Konvention compile-checked (kann via tsc-only oder type-test)
it.todo('handlers accept params as Promise<{ id: string }> and await it')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-02-db-queries-helpers` | `getProjectContext` | async function | Liefert `{ contextInstructions, contextUpdatedAt } \| null` (Owner vs. Mismatch/None) |
| `slice-02-db-queries-helpers` | `updateProjectContext` | async function | Liefert `{ contextInstructions, contextUpdatedAt } \| null`; null bei Ownership-Mismatch (kein Throw) |
| n/a (existing) | `requireAuth` | async function | Aus `lib/auth/guard.ts:47-73`; liefert Discriminated Union `{ userId, email } \| { error }` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `GET /api/projects/{id}/context` | HTTP endpoint | `slice-06-context-settings-page` (Initial-Load), `slice-10-no-context-banner` (Banner-Visibility-Check) | `200 → ProjectContextResponse` / `401` / `404` |
| `PATCH /api/projects/{id}/context` | HTTP endpoint | `slice-06-context-settings-page` (Save-Pfad alternativ zur Server-Action) | `Body: UpdateProjectContextRequest`; `200 → ProjectContextResponse` / `401` / `404` / `422` |

> **Hinweis:** Slice 04 (Server-Action `updateProjectContext`) ist eine **parallele** Schreib-Schiene für Form-Saves mit `revalidatePath`. PATCH und Server-Action teilen denselben Query-Helper aus Slice 02, sind aber unabhängig.

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/api/projects/[id]/context/route.ts` — NEW: zwei Named-Exports `GET` und `PATCH`; ruft `requireAuth()` → `getProjectContext` / `updateProjectContext`; mappt Status 401/200/404/422; explizites `runtime = "nodejs"`
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Server-Action — separate Datei in Slice 04
- KEIN Helper-/Generate-Endpoint (`POST /api/projects/context/generate`) — separate Slice 08
- KEIN Rate-Limiting im Handler (vererbt aus globaler Infra; siehe architecture.md → Section "Rate Limiting", Zeile 393)
- KEINE Telemetrie/Logging-Infra-Erweiterung (nur das Minimum zum Debuggen, falls vorhandenes Logger-Pattern existiert)
- KEINE Verwendung von `getProject()` (existing) — Ownership wird **inline** durch den kombinierten WHERE-Filter in den Slice-02-Helpern enforced (siehe architecture.md Zeile 356); doppelte Lookups vermeiden
- KEIN `revalidatePath` — Route-Handler triggern keine RSC-Revalidation; Slice 04 Server-Action übernimmt diese Verantwortung
- KEIN Escape von Fence-Sequenzen im Handler — passiert backend-seitig vor LLM-Injection (Slice 11)

**Technische Constraints:**
- `runtime = "nodejs"` als Modul-Export setzen (Drizzle/postgres-js funktionieren NICHT in Edge — Pattern aus `app/api/models/sync/route.ts:17-19`)
- `params` MUSS als `Promise<{ id: string }>` typisiert sein (Next.js 16 App-Router-Konvention; vgl. `app/projects/[id]/page.tsx:14`)
- Validation **ohne Zod** — Repo führt keine Schema-Lib; inline Type-Guards (`typeof body === "object"`, `body !== null`, `"context_instructions" in body`, `typeof body.context_instructions === "string" || body.context_instructions === null`)
- DTO-Field-Naming: Request- und Response-JSON nutzt **snake_case** (`context_instructions`, `context_updated_at`) per architecture.md Zeile 141-142; Helper-Aufrufe nutzen weiterhin **camelCase** (`contextInstructions`, `contextUpdatedAt`); Mapping erfolgt im Handler
- Trim-Reihenfolge: `body.context_instructions === null` → `null` durchreichen; sonst `.trim()` und DANN Length-Check (8001 chars vor Trim mit umgebenden Spaces wäre noch valide, wenn post-trim ≤ 8000 — vgl. architecture.md → Section "Input Validation", Zeile 383)
- Status-Codes: `401` (auth fail) / `200` (success) / `404` (not found OR foreign user — gleiche Antwort) / `422` (validation fail body OR length); KEIN `403` (würde Existenz leaken)
- Response-Format: `Response.json({ ... }, { status })` (Next.js Standard, siehe `app/api/models/sync/route.ts:35`)
- Fehler-Messages MÜSSEN den Wortlaut aus architecture.md Zeile 337 + 491 verwenden (für i18n-Konsistenz mit Frontend-Toasts)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/auth/guard.ts` (`requireAuth`) | Import, unverändert — Discriminated Union `{ userId, email } \| { error }` direkt verwenden |
| `lib/db/queries.ts` (`getProjectContext`, `updateProjectContext`) | Import, unverändert — kommt aus Slice 02 |
| `app/api/models/sync/route.ts` | NICHT importieren — nur als **Pattern-Vorlage** für `runtime = "nodejs"`-Export, requireAuth-Aufruf-Stil und Response-Json-Konvention |
| `app/projects/[id]/page.tsx` | NICHT importieren — nur als **Pattern-Vorlage** für `params: Promise<{ id: string }>` + `await params` |

**Referenzen:**
- Architecture: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/architecture.md` → Section "Endpoints — Project Context (NEW)" (Zeile 75-79)
- Architecture: dieselbe Datei → Section "DTO Schemas" → Zeilen 141-142 (`UpdateProjectContextRequest`, `ProjectContextResponse`)
- Architecture: dieselbe Datei → Section "DTO Validation Rules" → Zeile 337 (Wortlaut der Fehlermeldung)
- Architecture: dieselbe Datei → Section "Input Validation & Sanitization" → Zeile 383 (Trim-Strategie)
- Architecture: dieselbe Datei → Section "Authentication & Authorization" → Zeilen 355-356 (401-Pfad und 404-statt-403-Begründung)
- Architecture: dieselbe Datei → Section "Migration Map" → Zeile 514 (Slice-A-Attribution für `app/api/projects/[id]/context/route.ts`)
- Discovery: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/discovery.md` → Slice A (Project-Context DB + API)
- Wireframes: nicht direkt relevant (HTTP-Boundary, kein UI); Slice 06 nutzt diese Endpoints
