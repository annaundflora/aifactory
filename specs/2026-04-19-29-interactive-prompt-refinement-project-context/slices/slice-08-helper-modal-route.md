# Slice 08: Help-Me-Write Route Handler

> **Slice 08 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-08-helper-modal-route` |
| **Test** | `pnpm test app/api/projects/context/generate/__tests__/route.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-context-routes"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

> **Quelle:** Auto-detected — TypeScript/Next.js 16 App Router, Vitest. Repo nutzt **keine Zod**; Validation per inline-Type-Guards (Pattern siehe Slice 03 + `app/api/sam/segment/route.ts`). OpenRouter-Aufruf läuft über existierenden Client `lib/clients/openrouter.ts` und wird in Tests via `vi.mock` ersetzt (Pattern aus `lib/clients/__tests__/openrouter.test.ts` + `lib/services/__tests__/prompt-service.test.ts`).

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs + vitest` |
| **Test Command** | `pnpm test app/api/projects/context/generate/__tests__/route.test.ts` |
| **Integration Command** | `pnpm test app/api/projects/context/generate/__tests__/route.test.ts` (selbe Datei — OpenRouter-Client + `requireAuth` gemockt) |
| **Acceptance Command** | `pnpm tsc --noEmit` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `POST /api/projects/context/generate` mit gültigem Auth-Cookie + Body `{"brief":"<≥10 chars>"}` → `200 { draft: string }` |
| **Mocking Strategy** | `mock_external` (Vitest mockt `@/lib/clients/openrouter` und `@/lib/auth/guard`; KEIN echter HTTP-Call zu OpenRouter, KEINE DB) |

---

## Ziel

Next.js Route Handler für `POST /api/projects/context/generate`: HTTP-Boundary für die Helper-Modal-Komponente (Slice 09). Validiert das `brief`-Feld (10..500 chars, post-trim), ruft den existierenden OpenRouter-Client einmalig auf und liefert `{ draft: string }`. Kein DB-Zugriff, keine Projekt-Bindung, keine Streaming-Antwort.

---

## Acceptance Criteria

1) **GIVEN** kein gültiger Auth-Session-Cookie (oder `requireAuth()` liefert `{ error }`)
   **WHEN** `POST /api/projects/context/generate` aufgerufen wird
   **THEN** Response ist `401 Unauthorized` mit Body `{ error: "Unauthorized" }`; KEIN OpenRouter-Aufruf erfolgt (siehe architecture.md → Section "Authentication & Authorization", Zeile 355).

2) **GIVEN** authentifizierter User und Body `{ brief: "Magic Mushroom POD shop, dark academia, no hyperreal" }`
   **WHEN** der Handler aufgerufen wird und der OpenRouter-Client `"Magic Mushroom POD shop. Aesthetic: dark academia ..."` zurückliefert
   **THEN** Response ist `200 OK` mit JSON-Body matching `GenerateProjectContextResponse` aus architecture.md → Section "DTOs" (Zeile 144): `{ draft: "Magic Mushroom POD shop. Aesthetic: dark academia ..." }`. Der `draft`-String ist nicht leer und ≤ 8000 Zeichen.

3) **GIVEN** authentifizierter User und Body `{ brief: "  Hi  " }` (nach `.trim()` 2 Zeichen)
   **WHEN** der Handler aufgerufen wird
   **THEN** Response ist `422 Unprocessable Entity` mit Body `{ error: "Please describe your project briefly (10–500 characters)." }` (Wortlaut **exakt** aus architecture.md Zeile 338); KEIN OpenRouter-Aufruf.

4) **GIVEN** authentifizierter User und Body mit `brief` von 501 Zeichen (post-trim)
   **WHEN** der Handler aufgerufen wird
   **THEN** Response ist `422` mit demselben Wortlaut wie AC-3; KEIN OpenRouter-Aufruf.

5) **GIVEN** authentifizierter User und Request-Body, der NICHT JSON ist, kein `brief`-Feld enthält, oder `brief` nicht-string ist (z.B. `{}`, `{ brief: 42 }`, `{ foo: "bar" }`, oder rohes `"text"`)
   **WHEN** der Handler aufgerufen wird
   **THEN** Response ist `422` mit Body `{ error: "Invalid request body" }`; KEIN OpenRouter-Aufruf.

6) **GIVEN** authentifizierter User, gültiger Brief, und der OpenRouter-Client wirft eine Exception (Timeout, Non-2xx, leere Response)
   **WHEN** der Handler aufgerufen wird
   **THEN** Response ist `502 Bad Gateway` mit Body `{ error: "Could not generate. Try again." }` (Wortlaut aus architecture.md Zeile 492); der Fehler wird einmal serverseitig geloggt; das Frontend kann via Modal-Regenerate retryen.

7) **GIVEN** authentifizierter User, gültiger Brief
   **WHEN** der Handler den OpenRouter-Client aufruft
   **THEN** der Aufruf nutzt **genau ein** `chat({ model, messages })`-Invocation mit `model = "anthropic/claude-sonnet-4.6"` (Default per architecture.md Zeile 576) und einer `messages`-Liste, die mindestens eine `system`-Message mit Helper-Anweisungen sowie eine `user`-Message mit dem getrimmten Brief enthält. KEIN Streaming, KEINE Schleife, KEIN zweiter Aufruf.

8) **GIVEN** der OpenRouter-Client liefert einen Draft mit `> 8000` Zeichen
   **WHEN** der Handler die Response konstruiert
   **THEN** der Draft wird auf `8000` Zeichen gekürzt (`draft.slice(0, 8000)`), bevor er als `{ draft }` zurückgegeben wird (siehe architecture.md → Section "DTOs", Zeile 144: "draft length ≤ 8000"); Response bleibt `200 OK`.

9) **GIVEN** Next.js 16 App Router Konvention für Route Handler
   **WHEN** der Handler-Implementer die Datei erstellt
   **THEN** der Handler exportiert ausschließlich `POST` (kein `GET`/`PATCH`); `runtime = "nodejs"` ist explizit gesetzt (Pattern aus `app/api/models/sync/route.ts:17-19`); Response wird via `Response.json(payload, { status })` zurückgegeben.

---

## Test Skeletons

> **Hinweis für Test-Writer:** Pattern aus `app/api/models/sync/__tests__/route.test.ts` (Vitest) + `lib/services/__tests__/prompt-service.test.ts` (OpenRouter-Mock). Handler wird direkt aufgerufen mit gemocktem `Request`-Objekt. `vi.mock("@/lib/clients/openrouter", () => ({ openRouterClient: { chat: vi.fn() } }))` und `vi.mock("@/lib/auth/guard", ...)`.

### Test-Datei: `app/api/projects/context/generate/__tests__/route.test.ts`

<test_spec>
```typescript
// AC-1: 401 wenn Auth fehlt
it.todo('POST returns 401 when requireAuth returns { error } and does not call OpenRouter')

// AC-2: 200 mit GenerateProjectContextResponse-Shape
it.todo('POST returns 200 with { draft } when OpenRouter responds with valid content')

// AC-3: 422 wenn brief post-trim < 10 chars (mit exaktem Wortlaut)
it.todo('POST returns 422 with exact length-error message when brief is shorter than 10 chars after trim')

// AC-4: 422 wenn brief post-trim > 500 chars
it.todo('POST returns 422 with same length-error message when brief exceeds 500 chars after trim')

// AC-5: 422 bei malformed body (non-JSON / fehlendes Feld / falscher Typ)
it.todo('POST returns 422 with { error: "Invalid request body" } when body is not JSON or brief is missing/non-string')

// AC-6: 502 wenn OpenRouter wirft
it.todo('POST returns 502 with retry-hint message when openRouterClient.chat throws')

// AC-7: Genau ein OpenRouter-Aufruf mit erwarteter Shape
it.todo('POST invokes openRouterClient.chat exactly once with default model and system+user messages containing trimmed brief')

// AC-8: Draft > 8000 chars wird auf 8000 truncated
it.todo('POST truncates draft to 8000 characters when OpenRouter returns longer content')

// AC-9: Handler exportiert nur POST + runtime = "nodejs"
it.todo('route module exports POST handler and sets runtime to "nodejs" (compile/static check)')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| n/a (existing) | `requireAuth` | async function | Aus `lib/auth/guard.ts:47-73`; liefert Discriminated Union `{ userId, email } \| { error }` (gleiche Konvention wie Slice 03) |
| n/a (existing) | `openRouterClient.chat` | async function | Aus `lib/clients/openrouter.ts`; Signatur `chat({ model, messages, timeout? }) → Promise<string>` (Wirft bei API-Fehler, Timeout, leerer Response) |
| `slice-03-context-routes` | (transitiv) `requireAuth`-Konvention + Response-Style | pattern | Slice 03 ist Dependency, weil dieses Slice dieselben Auth-/Response-Konventionen erbt; Slice 03 muss zuerst gemerged sein, damit das Test-Mocking-Pattern für `requireAuth` etabliert ist |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `POST /api/projects/context/generate` | HTTP endpoint | `slice-09-helper-modal-component` | `Body: GenerateProjectContextRequest` (`{ brief: string }`); `200 → { draft: string }` / `401` / `422` / `502` |

> **Hinweis:** Dieser Endpoint hat **keine** Projekt-Bindung (Auth required, keine Ownership-Prüfung — siehe architecture.md Zeile 359). Slice 09 ruft ihn aus dem Helper-Modal heraus auf.

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/api/projects/context/generate/route.ts` — NEW: Named-Export `POST`; ruft `requireAuth()` → Body-Validation (`brief` 10..500 post-trim) → `openRouterClient.chat()` mit `anthropic/claude-sonnet-4.6` + Helper-System-Prompt → `Response.json({ draft }, { status })`; mappt 401/200/422/502; explizites `runtime = "nodejs"`
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN DB-Zugriff (Endpoint ist projekt-unabhängig — siehe architecture.md Zeile 79 + 359; **kein** Aufruf von Slice-02-Helpern)
- KEIN `revalidatePath` — Endpoint persistiert nichts
- KEIN Streaming / SSE — single-shot Response (architecture.md Zeile 576: "no streaming")
- KEINE Modell-Auswahl im Request — `model` wird **nicht** im Body akzeptiert (architecture.md Zeile 515: "no `model` field"); Modell ist im Handler hardcoded
- KEINE Rate-Limit-Implementierung im Handler (vererbt aus globaler Infra; architecture.md Zeile 392)
- KEIN Verwenden des Helper-Drafts als finale `context_instructions` — der Draft wird NICHT serverseitig in die DB geschrieben; Slice 09 (Modal) übernimmt den Accept-Pfad ins Frontend-Textarea, Slice 06 speichert via PATCH/Server-Action
- KEIN Aufruf von `lib/services/prompt-service.ts` oder anderen Prompt-Helpers — die System-Message wird inline im Handler konstruiert (Helper-Use-Case ist content-spezifisch, nicht Prompt-Engineering)
- KEINE neuen Util-/Service-Files — alles direkt im Route-Handler (Single-File-Slice)

**Technische Constraints:**
- `runtime = "nodejs"` als Modul-Export setzen (Pattern aus `app/api/models/sync/route.ts:17-19`)
- Validation **ohne Zod** — inline Type-Guards (`typeof body === "object" && body !== null && "brief" in body && typeof body.brief === "string"`)
- Trim-Reihenfolge: `body.brief.trim()` und DANN Length-Check 10..500; das **getrimmte** `brief` wird an OpenRouter weitergereicht (nicht das ungetrimmte Original)
- OpenRouter-Modell: `"anthropic/claude-sonnet-4.6"` (architecture.md Zeile 576) — als Konstante am Modul-Anfang deklarieren
- OpenRouter-System-Message MUSS den Helper-Auftrag eindeutig spezifizieren: instruct LLM, einen kompakten Project-Context-Block (≤ 8000 chars) für eine spätere Image-Generation-Assistent-Session zu draften, basierend auf dem User-Brief; keine Anweisungen, nur deskriptive Aesthetic/Subject/Avoid-Hinweise (vgl. Wireframe `wireframes.md` Zeile 326-334 für Beispiel-Output-Form)
- OpenRouter-User-Message: enthält den getrimmten Brief
- Default-Timeout des Clients (30s aus `lib/clients/openrouter.ts:29`) ausreichend; KEIN expliziter Override (architecture.md Zeile 597: "p95 < 8s" Ziel)
- Status-Code-Mapping: `401` (auth fail) / `200` (success) / `422` (validation fail body OR length) / `502` (OpenRouter-Fehler — architecture.md Zeile 492); KEIN `400`, `403`, `500`
- Response-Format: `Response.json({ ... }, { status })` (Next.js Standard)
- Fehler-Messages MÜSSEN den Wortlaut aus architecture.md Zeile 338 (`brief`-Validation) + Zeile 492 (OpenRouter-Failure) verwenden — i18n-Konsistenz mit Frontend-Modal
- Draft-Truncation: `draft.slice(0, 8000)` als letzter Schritt vor `Response.json`, falls LLM zu lang antwortet (defence-in-depth gegen DTO-Cap; architecture.md Zeile 144)
- Logging: bei OpenRouter-Fehler ein `console.error` mit Korrelations-Hint (architecture.md Zeile 492: "Error log w/ correlation id"); bei Validation-Fail Debug-Log ohne den `brief`-Wert (Privacy)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/clients/openrouter.ts` (`openRouterClient.chat`) | Import, **unverändert** — single-call Pattern; KEIN neuer Client, KEINE Erweiterung des Interfaces |
| `lib/auth/guard.ts` (`requireAuth`) | Import, **unverändert** — Discriminated Union direkt verwenden (gleiche Konvention wie Slice 03) |
| `app/api/models/sync/route.ts` | NICHT importieren — nur als **Pattern-Vorlage** für `runtime = "nodejs"`, `requireAuth`-Aufruf-Stil und `Response.json`-Konvention |
| `lib/services/prompt-service.ts` | NICHT importieren — System-Prompt-Logik dort ist für Image-Prompt-Engineering, nicht für Project-Context-Drafting; eigene inline System-Message |

**Referenzen:**
- Architecture: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/architecture.md` → Section "Endpoints — Project Context (NEW)" → Zeile 79 (Endpoint-Definition)
- Architecture: dieselbe Datei → Section "DTOs" → Zeilen 143-144 (`GenerateProjectContextRequest`, `GenerateProjectContextResponse`)
- Architecture: dieselbe Datei → Section "Validation Rules" → Zeile 338 (Wortlaut der Brief-Fehlermeldung)
- Architecture: dieselbe Datei → Section "Error Handling Strategy" → Zeile 492 (Wortlaut der OpenRouter-Failure-Meldung + 502-Mapping)
- Architecture: dieselbe Datei → Section "Authentication & Authorization" → Zeilen 355 + 359 (Auth-Pflicht ohne Project-Binding)
- Architecture: dieselbe Datei → Section "Migration Map" → Zeile 515 (Slice-C-Attribution für `app/api/projects/context/generate/route.ts`)
- Architecture: dieselbe Datei → Section "Technology & Tooling" → Zeile 576 (Default-Modell `anthropic/claude-sonnet-4.6`, no streaming)
- Architecture: dieselbe Datei → Section "Performance & Quality" → Zeile 597 (p95-Latenz-Ziel < 8s)
- Discovery: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/discovery.md` → Slice C ("Help me write this") → Zeile 349 + Open Questions Q2/Q3 (Zeilen 698-699)
- Wireframes: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/wireframes.md` → Section "Help-me-write-this Modal" → Zeilen 299-359 (UI-Konsumenten-Kontext für Slice 09; **kein** Wireframe-Detail in diesem Slice nötig)
