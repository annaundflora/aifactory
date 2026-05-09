# Slice 04: Server Action `updateProjectContext`

> **Slice 04 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-04-context-server-action` |
| **Test** | `pnpm test app/actions/__tests__/projects.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-db-queries-helpers"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

> **Quelle:** Auto-detected — TypeScript/Next.js Server Actions + Vitest. Bestehende `projects.test.ts`-Konvention (Zeilen 9-30) mockt `requireAuth`, `next/cache.revalidatePath` und Query-Helpers via `vi.mock`. Neuer Action-Test wird im gleichen `describe`-Stil wie `renameProject` ergänzt.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs + server-actions + vitest` |
| **Test Command** | `pnpm test app/actions/__tests__/projects.test.ts` |
| **Integration Command** | `pnpm test app/actions/__tests__/projects.test.ts` (gleicher Test-Layer; Server-Actions haben keine separate Integration-Schicht) |
| **Acceptance Command** | `pnpm tsc --noEmit` (Type-Check der neuen Action-Signatur) |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | n/a (Server Actions sind kein HTTP-Endpoint mit Health-Check) |
| **Mocking Strategy** | `mock_external` (mocks `@/lib/auth/guard`, `next/cache`, `@/lib/db/queries`; Pattern aus `app/actions/__tests__/projects.test.ts:9-30`) |

---

## Ziel

Stellt eine Server Action `updateProjectContext` in `app/actions/projects.ts` bereit, die das Settings-UI (Slice 06) als Form-Save-Pfad nutzt — Auth + Ownership + Length-Validation + `revalidatePath`. Nutzt den Query-Helper aus Slice 02 als einzigen DB-Touchpoint und gibt eine konsistente Discriminated-Union zurück (Erfolg vs. `{ error }`), passend zum bestehenden Action-Pattern dieser Datei.

---

## Acceptance Criteria

1) **GIVEN** ein angemeldeter User besitzt das Projekt `projectId` UND `contextInstructions` ist ein String mit ≤ 8000 Zeichen (post-trim)
   **WHEN** `updateProjectContext({ projectId, contextInstructions })` aufgerufen wird
   **THEN** die Action ruft `requireAuth()` zuerst, dann den Query-Helper `updateProjectContext({ projectId, userId, contextInstructions })` aus Slice 02 mit dem getrimmten Wert; gibt `{ contextInstructions: string | null, contextUpdatedAt: Date }` zurück (gleiche Felder wie der Helper liefert); ruft `revalidatePath('/projects/' + projectId)` einmal auf.

2) **GIVEN** kein gültiges Auth-Cookie (Session fehlt / abgelaufen)
   **WHEN** `updateProjectContext({ projectId, contextInstructions })` aufgerufen wird
   **THEN** die Action gibt `{ error: "Unauthorized" }` zurück (durchgereichter Wert von `requireAuth()`); KEIN Aufruf des Query-Helpers, KEIN `revalidatePath`. Verifizierbar via `vi.mocked(requireAuth).mockResolvedValueOnce({ error: "Unauthorized" })`.

3) **GIVEN** ein angemeldeter User UND `contextInstructions` ist nach Trim länger als 8000 Zeichen (UTF-8-Codepoints, nicht Bytes)
   **WHEN** `updateProjectContext` aufgerufen wird
   **THEN** die Action gibt `{ error: "Context exceeds maximum length of 8000 characters." }` zurück (exakter Wortlaut aus architecture.md → Section "Validation Rules" → Zeile 337); KEIN Aufruf des Query-Helpers, KEIN `revalidatePath`.

4) **GIVEN** ein angemeldeter User UND `contextInstructions === null` ODER `contextInstructions === ""` (Clear-Pfad)
   **WHEN** `updateProjectContext` aufgerufen wird
   **THEN** die Action ruft den Query-Helper mit `contextInstructions: null` auf (leerer String wird zu `null` normalisiert, weil Discovery "null/empty allowed (clears)" — siehe architecture.md Zeile 141); gibt `{ contextInstructions: null, contextUpdatedAt: Date }` zurück; `revalidatePath` wird aufgerufen.

5) **GIVEN** Auth ist erfolgreich, aber der Query-Helper liefert `null` (Ownership-Mismatch oder Projekt existiert nicht — siehe Slice 02 AC-5)
   **WHEN** `updateProjectContext` aufgerufen wird
   **THEN** die Action gibt `{ error: "Projekt nicht gefunden" }` zurück (gleiche Fehlermeldung wie `getProject` in derselben Datei, Zeile 88, um Existenz-Leakage zu vermeiden — vgl. architecture.md "Project ownership for context endpoints" → 404 statt 403); KEIN `revalidatePath`.

6) **GIVEN** der Query-Helper wirft eine unerwartete DB-Exception
   **WHEN** `updateProjectContext` aufgerufen wird
   **THEN** die Action gibt `{ error: "Datenbankfehler" }` zurück (gleiches Pattern wie `renameProject` Zeile 117); Exception wird per `console.error("updateProjectContext DB error:", err)` geloggt; KEIN `revalidatePath`.

7) **GIVEN** der Caller kompiliert TypeScript (`pnpm tsc --noEmit`)
   **WHEN** die neue Action aus `app/actions/projects.ts` importiert wird
   **THEN** die Signatur lautet exakt:
   `updateProjectContext(input: { projectId: string; contextInstructions: string | null }): Promise<{ contextInstructions: string | null; contextUpdatedAt: Date } | { error: string }>` — Discriminated-Union konsistent mit `renameProject`, `deleteProject` in derselben Datei.

8) **GIVEN** Whitespace-Only-Input (z.B. `"   \n\t  "`)
   **WHEN** `updateProjectContext` aufgerufen wird
   **THEN** der Action trimmt zuerst, normalisiert das leere Resultat zu `null` (Clear-Pfad wie AC-4) — ein Whitespace-Only-Update darf NICHT als 8000-Char-Verletzung enden und MUSS den Helper mit `null` aufrufen.

---

## Test Skeletons

> **Hinweis für Test-Writer:** Bestehende Konvention der Datei (`projects.test.ts`) mockt `requireAuth`, `next/cache.revalidatePath` und alle Query-Helpers. Für AC-1/4/5/6 verifiziert der Test-Writer das Argument, mit dem `updateProjectContextQuery` aufgerufen wird (Object-Pattern `{ projectId, userId, contextInstructions }`) sowie die Anzahl der `revalidatePath`-Calls. Mock-Setup: `vi.mock("@/lib/db/queries", ...)` ergänzt um `updateProjectContext: vi.fn()`.

### Test-Datei: `app/actions/__tests__/projects.test.ts` (Edit: neuer `describe`-Block)

<test_spec>
```typescript
// AC-1: Happy-Path — Auth ok, gültiger Input → Helper-Call + revalidatePath
it.todo('updateProjectContext returns updated row and revalidates project path on success')

// AC-2: Auth-Fail durchgereicht
it.todo('updateProjectContext returns { error: "Unauthorized" } when requireAuth fails')

// AC-3: Length-Cap > 8000 chars (post-trim)
it.todo('updateProjectContext returns length error when contextInstructions exceeds 8000 chars after trim')

// AC-4: null oder leerer String → Helper mit null (Clear-Pfad)
it.todo('updateProjectContext normalizes empty string and null to null when calling query helper')

// AC-5: Helper liefert null → "Projekt nicht gefunden"
it.todo('updateProjectContext returns project-not-found error when query helper returns null')

// AC-6: Helper wirft → "Datenbankfehler" + console.error
it.todo('updateProjectContext returns database-error and logs when query helper throws')

// AC-7: TypeScript-Compile (kann via tsc oder type-only test umgesetzt werden)
it.todo('updateProjectContext signature matches expected discriminated-union shape')

// AC-8: Whitespace-Only Input → Clear-Pfad, KEIN Length-Error
it.todo('updateProjectContext treats whitespace-only input as clear (calls helper with null)')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-02-db-queries-helpers` | `updateProjectContext` (Query-Helper) | async function | Signatur: `(args: { projectId: string; userId: string; contextInstructions: string \| null }) => Promise<{ contextInstructions: string \| null; contextUpdatedAt: Date \| null } \| null>` — Slice 02 Provides-Tabelle |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `updateProjectContext` (Server Action) | async function (`"use server"`) | `slice-06-context-settings-page` (Form-Save-Pfad) | `(input: { projectId: string; contextInstructions: string \| null }) => Promise<{ contextInstructions: string \| null; contextUpdatedAt: Date } \| { error: string }>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/actions/projects.ts` — Edit: neuer Named-Export `updateProjectContext` (Server Action), bestehende Actions (`createProject`, `getProjects`, `getProject`, `renameProject`, `deleteProject`, `generateThumbnail`) unverändert
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Route-Handler-Implementierung (PATCH `/api/projects/[id]/context`) — gehört zu Slice 03
- KEIN UI-Aufruf — Slice 06 (Settings-Modal) verdrahtet die Action später
- KEINE Sanitization wie Null-Bytes-Strip, Fence-Escape, Newline-Run-Collapse — diese Schritte gehören zur Backend-Prompt-Komposition (Slice 11, `_escape_project_context`); architecture.md → Section "Input Validation & Sanitization" macht klar, dass DTO-Layer NUR Length+Trim macht, das Escape passiert backend-seitig vor Prompt-Injection
- KEIN UUID-Format-Check für `projectId` — Slice 02 Helper filtert ownership-strict; ein invalides `projectId` führt zu Helper-Returns `null` → Slice 04 mappt zu "Projekt nicht gefunden" (AC-5). Siehe `getProject` in derselben Datei (Zeile 75-93) — kein UUID-Check dort, gleiches Pattern hier
- KEIN Re-Throw — alle Pfade geben Discriminated-Union zurück, KEIN `throw`

**Technische Constraints:**
- Action MUSS unter `"use server"`-Direktive der Datei stehen (bereits vorhanden Zeile 1)
- Auth-Pattern MUSS `const auth = await requireAuth(); if ("error" in auth) return { error: auth.error };` sein — exakt wie `renameProject` Zeile 99-102
- Validation-Reihenfolge MUSS sein: (1) `requireAuth`, (2) Trim+Normalize zu `string | null`, (3) Length-Check, (4) Helper-Call, (5) Null-Check Helper-Return, (6) `revalidatePath` + Return
- Query-Helper-Import als `updateProjectContext as updateProjectContextQuery` (Alias-Pattern wie `renameProjectQuery`, Zeile 8) um Namens-Kollision mit der Action zu vermeiden
- `revalidatePath` MUSS exakt `'/projects/' + projectId` sein (architecture.md Zeile 215). KEIN `revalidatePath('/')` (das wäre breit, ist nicht das Architecture-Mandate)
- Length-Check operiert auf `String.prototype.length` (UTF-16-Codepoints in TS — pragmatisch nahe genug an UTF-8-Codepoint-Cap; konsistent mit DB-TEXT ohne Constraint, der eigentliche Schutz ist die DTO-Grenze)
- Error-Message-Strings MÜSSEN wortwörtlich sein:
  - `"Unauthorized"` (durchgereicht aus `requireAuth`)
  - `"Context exceeds maximum length of 8000 characters."` (architecture.md Zeile 337)
  - `"Projekt nicht gefunden"` (Konsistenz mit `getProject`/`renameProject` Zeile 88/115)
  - `"Datenbankfehler"` (Konsistenz mit dieser Datei Zeile 57/71/91/118/137)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `app/actions/projects.ts` | Edit — neue Action im gleichen Stil wie `renameProject` (Zeilen 95-120) ergänzen; bestehende Imports `requireAuth`, `revalidatePath`, Query-Helpers wiederverwenden, NICHT neu importieren (außer `updateProjectContext as updateProjectContextQuery` aus `@/lib/db/queries`) |
| `lib/auth/guard.ts` → `requireAuth` | Unverändert nutzen — Discriminated-Union-Returntype ist Vertrag |
| `lib/db/queries.ts` → `updateProjectContext` | Aus Slice 02; Helper macht ownership-Filter und Timestamp-Setzen, Action MUSS NICHT erneut prüfen |
| `next/cache.revalidatePath` | Unverändert nutzen — bereits importiert in Zeile 3 |

**Referenzen:**
- Architecture: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/architecture.md` → Section "Server Logic / Services & Processing" Zeile 215 (Action-Signatur, Side-Effects, `revalidatePath`-Pfad)
- Architecture: dieselbe Datei → Section "Validation Rules" Zeile 337 (Length-Cap-Wortlaut)
- Architecture: dieselbe Datei → Section "Data Transfer Objects" Zeile 141 (`UpdateProjectContextRequest` — null/empty allowed clears, post-trim length-check)
- Architecture: dieselbe Datei → Section "Migration Map" Zeile 513 (Slice-A-Attribution für `app/actions/projects.ts`)
- Architecture: dieselbe Datei → Section "Architecture Layers" Zeile 405 (Server-Action als alternativer Pfad zu PATCH für Forms)
- Discovery: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/discovery.md` → Tabelle "Data" (Semantik: 8000-Char-Cap, leerer String = "kein Context")
- Wireframes: nicht direkt relevant (Action ist UI-frei); Slice 06 verdrahtet das Form-Submit-Pattern
