# Slice 02: DB-Query-Helpers für Project-Context

> **Slice 02 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-02-db-queries-helpers` |
| **Test** | `pnpm test lib/db/__tests__/queries.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-schema-migration"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

> **Quelle:** Auto-detected — TypeScript/Next.js + Drizzle ORM. Bestehende `queries.test.ts`-Konvention nutzt **gemockte Drizzle-Chain** (vitest `vi.fn`), KEIN echter Postgres. Integration-Tests gegen echte DB sind separat (siehe `queries.seed.test.ts` Pattern).

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs + drizzle-orm + vitest` |
| **Test Command** | `pnpm test lib/db/__tests__/queries.test.ts` |
| **Integration Command** | `pnpm test lib/db/__tests__/queries.seed.test.ts` (Seed-DB-Pattern, optional) |
| **Acceptance Command** | `pnpm tsc --noEmit` (Type-Check der neuen Helper) |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | n/a (Library-Slice ohne Runtime-Endpoint) |
| **Mocking Strategy** | `mock_external` (Drizzle-Chain via `vi.fn` gemockt; bestehendes Pattern in `queries.test.ts:22-90`) |

---

## Ziel

Zwei reine Drizzle-Query-Helper in `lib/db/queries.ts` ergänzen, die Project-Context lesen (`getProjectContext`) und schreiben (`updateProjectContext`) — beide ownership-geprüft via kombiniertem `id`+`userId`-Filter. Folge-Slices (03 Route-Handler, 04 Server-Action) bauen ihre Auth-+-Validation-Layer darauf auf.

---

## Acceptance Criteria

1) **GIVEN** Slice 01 ist gemerged (Spalten `context_instructions`, `context_updated_at` existieren in `projects`)
   **WHEN** `getProjectContext({ projectId, userId })` für ein Projekt aufgerufen wird, das dem `userId` gehört
   **THEN** das Ergebnis ist ein Object mit Shape `{ contextInstructions: string | null, contextUpdatedAt: Date | null }` und enthält die Werte beider Spalten aus der DB-Zeile; KEIN Throw, KEIN Fetch unbenötigter Spalten (Helper selektiert exakt diese zwei Felder).

2) **GIVEN** ein Projekt existiert, gehört aber einem anderen User (Ownership-Mismatch)
   **WHEN** `getProjectContext({ projectId, userId })` mit dem fremden `userId` aufgerufen wird
   **THEN** das Ergebnis ist `null` (NICHT throw, NICHT 404-Error im Helper — das ist Aufgabe der Route in Slice 03); WHERE-Klausel kombiniert `eq(projects.id, projectId)` UND `eq(projects.userId, userId)`, NICHT nur `id`.

3) **GIVEN** kein Projekt mit der gegebenen `projectId` existiert
   **WHEN** `getProjectContext({ projectId, userId })` aufgerufen wird
   **THEN** das Ergebnis ist `null` (gleiches Verhalten wie Ownership-Mismatch — keine Existenz-Leakage; vgl. architecture.md → Section "Authentication & Authorization").

4) **GIVEN** ein Projekt existiert und gehört dem aufrufenden User
   **WHEN** `updateProjectContext({ projectId, userId, contextInstructions })` mit einem String oder `null` aufgerufen wird
   **THEN** der Helper führt ein UPDATE auf `projects` mit `contextInstructions` UND `contextUpdatedAt = now()` aus (per `sql\`now()\``), gefiltert auf `id` UND `userId`; gibt das aktualisierte Row als `{ contextInstructions, contextUpdatedAt }` via `.returning()` zurück.

5) **GIVEN** ein Projekt existiert, gehört aber einem anderen User
   **WHEN** `updateProjectContext({ projectId, userId, contextInstructions })` mit fremdem `userId` aufgerufen wird
   **THEN** das Ergebnis ist `null` (kein Throw); KEIN UPDATE wird ausgeführt (DB-Affected-Rows = 0), weil die WHERE-Klausel `id` UND `userId` kombiniert.

6) **GIVEN** der Helper wird aufgerufen
   **WHEN** der Caller in TypeScript kompiliert wird (`pnpm tsc --noEmit`)
   **THEN** die Signaturen entsprechen exakt:
   - `getProjectContext(args: { projectId: string; userId: string }): Promise<{ contextInstructions: string | null; contextUpdatedAt: Date | null } | null>`
   - `updateProjectContext(args: { projectId: string; userId: string; contextInstructions: string | null }): Promise<{ contextInstructions: string | null; contextUpdatedAt: Date | null } | null>`

7) **GIVEN** beide Helper sind implementiert
   **WHEN** `lib/db/queries.ts` durchsucht wird
   **THEN** bestehende Helper (`getProject`, `getProjects`, `renameProject`, etc.) sind unverändert; neue Helper sind im gleichen Stil (named exports, `async function`, Drizzle-Chain) ergänzt.

---

## Test Skeletons

> **Hinweis für Test-Writer:** Bestehende Konvention (`queries.test.ts:14-40`) mockt die Drizzle-Chain via `vi.fn`. Die Tests verifizieren Argumente, mit denen Drizzle-Methoden aufgerufen werden, NICHT echte DB-Resultate. Für AC-1/AC-2/AC-4/AC-5 prüft der Test-Writer mit dem Chainable-Mock, dass die WHERE-Klausel beide Filter kombiniert und das Resultat null vs. Row korrekt mappt.

### Test-Datei: `lib/db/__tests__/queries.test.ts` (Edit: neuer `describe`-Block)

<test_spec>
```typescript
// AC-1: getProjectContext liefert Owner-Daten als typed shape
it.todo('getProjectContext returns { contextInstructions, contextUpdatedAt } for owner')

// AC-2: getProjectContext mit fremdem userId → null (Ownership-Filter aktiv)
it.todo('getProjectContext returns null when userId does not match project owner')

// AC-3: getProjectContext für nicht-existente projectId → null
it.todo('getProjectContext returns null when project does not exist')

// AC-4: updateProjectContext setzt contextUpdatedAt via sql`now()` und gibt Row zurück
it.todo('updateProjectContext sets context_updated_at to now() and returns updated row')

// AC-5: updateProjectContext mit fremdem userId → null, kein Side-Effect
it.todo('updateProjectContext returns null and performs no UPDATE on ownership mismatch')

// AC-4 (Variante): updateProjectContext akzeptiert null als contextInstructions (Clear-Pfad)
it.todo('updateProjectContext accepts null contextInstructions to clear the field')

// AC-6: TypeScript-Compile (kann via tsc oder als type-only Test umgesetzt werden)
it.todo('helper signatures match expected typed shape (compile-time check)')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-schema-migration` | `projects.contextInstructions` | Drizzle column (text, nullable) | `$inferSelect` enthält Feld als `string \| null` |
| `slice-01-schema-migration` | `projects.contextUpdatedAt` | Drizzle column (timestamptz, nullable) | `$inferSelect` enthält Feld als `Date \| null` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `getProjectContext` | async function | `slice-03-context-routes` (GET-Handler), `slice-10-no-context-banner` (Banner-Sichtbarkeitsabfrage) | `(args: { projectId: string; userId: string }) => Promise<{ contextInstructions: string \| null; contextUpdatedAt: Date \| null } \| null>` |
| `updateProjectContext` | async function | `slice-03-context-routes` (PATCH-Handler), `slice-04-context-server-action` (Server-Action) | `(args: { projectId: string; userId: string; contextInstructions: string \| null }) => Promise<{ contextInstructions: string \| null; contextUpdatedAt: Date \| null } \| null>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/db/queries.ts` — Edit: zwei neue Named-Exports `getProjectContext` und `updateProjectContext`; bestehende Helper unverändert
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Auth-Guard (`requireAuth()`) im Helper — gehört zur Route/Action-Layer (Slice 03/04)
- KEINE Length-Validation (≤ 8000 chars) im Helper — gehört zur DTO-Validation der Route (Slice 03)
- KEINE Whitespace-Trim-Logik im Helper — gehört zur Route/Action (vgl. architecture.md → Section "Input Validation & Sanitization")
- KEIN `revalidatePath`-Aufruf im Helper — gehört zur Server-Action (Slice 04)
- KEIN Throw-on-Mismatch (gleiches Pattern wie SELECT-mit-Filter, gibt `null` zurück); Slice 03 entscheidet ob 404 daraus wird
- KEINE neuen Drizzle-Imports nötig — `eq`, `and`, `sql` sind bereits in `queries.ts` importiert

**Technische Constraints:**
- Drizzle-ORM-Pattern wie bestehender `getProject` (vgl. `lib/db/queries.ts:35-44`): `db.select().from(projects).where(and(eq(...), eq(...)))`
- WHERE-Klausel MUSS `and(eq(projects.id, projectId), eq(projects.userId, userId))` sein — Reihenfolge der `eq`-Argumente egal, aber beide MÜSSEN kombiniert mit `and` geprüft werden
- `getProjectContext` selektiert NUR die zwei benötigten Spalten (`select({ contextInstructions: ..., contextUpdatedAt: ... })`), NICHT `select()` über alle Spalten — Defence-in-Depth gegen versehentliches Leak unrelated Felder
- `updateProjectContext` setzt `contextUpdatedAt: sql\`now()\`` (Drizzle-SQL-Tagged-Template), NICHT `new Date()` (lässt Postgres die Zeit setzen — Konsistenz mit DB-Clock)
- `updateProjectContext` nutzt `.returning({ contextInstructions: ..., contextUpdatedAt: ... })`, sodass kein Round-Trip-SELECT nötig ist; bei 0-Row-Match ist das Result-Array leer → Helper gibt `null` zurück
- Argumente als Object-Pattern (`{ projectId, userId, contextInstructions }`), passend zur Architecture-Signature in `architecture.md:216` — KEINE positional args

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/db/queries.ts` | Edit — Helper im gleichen Stil wie `getProject` (Zeilen 35-44) ergänzen; bestehende Imports (`db`, `projects`, `eq`, `and`, `sql`) wiederverwenden, NICHT neu importieren |
| `lib/db/schema.ts` | Unverändert nutzen — `projects.contextInstructions` und `projects.contextUpdatedAt` sind durch Slice 01 bereits deklariert |
| `lib/db/index.ts` | Unverändert nutzen — exportiert bereits die `db`-Instanz |

**Referenzen:**
- Architecture: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/architecture.md` → Section "Server Logic / Services & Processing" (Zeile 215-216, exakte Helper-Signaturen)
- Architecture: dieselbe Datei → Section "Migration Map" → Zeile `lib/db/queries.ts` (Slice-A-Attribution, Beschreibung der zwei neuen Helper)
- Architecture: dieselbe Datei → Section "Authentication & Authorization" (Zeile 356) — Begründung für Ownership-Filter via kombiniertem `id`+`userId`
- Discovery: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/discovery.md` → Tabelle "Data" (semantische Bedeutung von `context_updated_at`)
- Wireframes: nicht relevant für diesen Slice (Library-only, kein UI)
