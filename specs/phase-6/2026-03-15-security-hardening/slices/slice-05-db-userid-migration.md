# Slice 05: DB Schema - userId Migration

> **Slice 5 von 14** fuer `Security Hardening for Public Deployment`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-05-db-userid-migration` |
| **Test** | `pnpm vitest run __tests__/slice-05` |
| **E2E** | `false` |
| **Dependencies** | `["slice-04-db-auth-tables"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm vitest run __tests__/slice-05` |
| **Integration Command** | `npx drizzle-kit generate` |
| **Acceptance Command** | `npx drizzle-kit push` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/api/auth/session` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

`userId` Foreign-Key-Spalte auf `projects` und `favorite_models` hinzufuegen, bestehende Daten einem Default-User zuweisen und den UNIQUE Constraint auf `favorite_models` zu `(userId, modelId)` aendern. Damit wird die Grundlage fuer User-isolierte Daten geschaffen.

---

## Acceptance Criteria

1) GIVEN die Datei `lib/db/schema.ts` enthaelt die aktualisierte `projects`-Definition
   WHEN die Tabellen-Definition geprueft wird
   THEN enthaelt `projects` eine Spalte `userId` (UUID, FK auf `users.id`, NOT NULL, onDelete CASCADE) mit Index

2) GIVEN die Datei `lib/db/schema.ts` enthaelt die aktualisierte `favoriteModels`-Definition
   WHEN die Tabellen-Definition geprueft wird
   THEN enthaelt `favorite_models` eine Spalte `userId` (UUID, FK auf `users.id`, NOT NULL, onDelete CASCADE) mit Index

3) GIVEN die bisherige `favorite_models`-Tabelle hat `UNIQUE(modelId)`
   WHEN die aktualisierte Definition geprueft wird
   THEN ist der UNIQUE Constraint geaendert zu `UNIQUE(userId, modelId)`

4) GIVEN die Migration `drizzle/0009_add_user_id.sql` existiert
   WHEN die Migration ausgefuehrt wird
   THEN wird ein Default-User in `users` eingefuegt mit der ersten Email aus `ALLOWED_EMAILS` (z.B. `default@example.com` als Fallback)

5) GIVEN bestehende Zeilen in `projects` ohne `userId`
   WHEN die Migration ausgefuehrt wird
   THEN haben alle bestehenden Projekte den `userId` des Default-Users zugewiesen bekommen

6) GIVEN bestehende Zeilen in `favorite_models` ohne `userId`
   WHEN die Migration ausgefuehrt wird
   THEN haben alle bestehenden Favorites den `userId` des Default-Users zugewiesen bekommen

7) GIVEN die Migration laeuft die Schritte: (1) userId nullable hinzufuegen, (2) Default-User erstellen, (3) bestehende Daten zuweisen, (4) NOT NULL setzen
   WHEN die Migration vollstaendig ausgefuehrt wird
   THEN ist `projects.userId` NOT NULL und hat einen FK-Constraint auf `users.id`

8) GIVEN die Migration wurde erfolgreich angewendet
   WHEN `pnpm run build` ausgefuehrt wird
   THEN ist der Build erfolgreich ohne TypeScript-Fehler

9) GIVEN die bestehenden 8+ Tabellen in `lib/db/schema.ts` (inkl. Auth-Tabellen aus Slice 04)
   WHEN die Schema-Aenderungen angewendet werden
   THEN bleiben alle bestehenden Tabellen-Definitionen und Exports unveraendert (ausser projects und favoriteModels)

10) GIVEN die `favorite_models`-Tabelle ist als `@deprecated` markiert im Schema
    WHEN die Aenderungen vorgenommen werden
    THEN bleibt der `@deprecated` JSDoc-Kommentar erhalten

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `__tests__/slice-05/userid-schema.test.ts`

<test_spec>
```typescript
// AC-1: projects.userId Spalte definiert
it.todo('should define userId column on projects with UUID FK to users.id, NOT NULL, CASCADE DELETE, indexed')

// AC-2: favoriteModels.userId Spalte definiert
it.todo('should define userId column on favoriteModels with UUID FK to users.id, NOT NULL, CASCADE DELETE, indexed')

// AC-3: UNIQUE Constraint geaendert
it.todo('should change favoriteModels unique constraint from UNIQUE(modelId) to UNIQUE(userId, modelId)')

// AC-8: Build-Kompatibilitaet
it.todo('should compile schema without TypeScript errors')

// AC-9: Bestehende Tabellen unveraendert
it.todo('should preserve all existing table definitions and exports unchanged except projects and favoriteModels')

// AC-10: Deprecated Marker erhalten
it.todo('should preserve @deprecated JSDoc comment on favoriteModels table')
```
</test_spec>

### Test-Datei: `__tests__/slice-05/userid-migration.test.ts`

<test_spec>
```typescript
// AC-4: Default-User wird erstellt
it.todo('should insert a default user into users table during migration')

// AC-5: Bestehende Projekte zugewiesen
it.todo('should assign all existing projects to the default user userId')

// AC-6: Bestehende Favorites zugewiesen
it.todo('should assign all existing favorite_models to the default user userId')

// AC-7: NOT NULL Constraint nach Zuweisung
it.todo('should set projects.userId to NOT NULL after assigning default user')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-04-db-auth-tables` | `users` Table | Drizzle Schema | `users.id` als FK-Ziel fuer `projects.userId` und `favoriteModels.userId` |
| `slice-04-db-auth-tables` | Migration `0008_auth_tables.sql` | SQL | `users`-Tabelle muss existieren bevor 0009 laufen kann |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `projects.userId` | Column | slice-07 | `projects.userId: UUID FK NOT NULL` -- fuer userId-Filter in Queries |
| `favoriteModels.userId` | Column | slice-09 | `favoriteModels.userId: UUID FK NOT NULL` -- fuer userId-Filter in Model-Actions |
| UNIQUE(userId, modelId) | Constraint | slice-09 | Erlaubt gleichen Model-Favorit pro User statt global unique |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/db/schema.ts` -- AENDERUNG: +userId Spalte auf projects und favoriteModels, UNIQUE Constraint aendern
- [ ] `drizzle/0009_add_user_id.sql` -- NEU: Migration mit Default-User-Erstellung, Daten-Zuweisung, NOT NULL
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an `queries.ts` (userId-Filter in Queries ist Slice 07)
- KEINE Aenderungen an Server Actions (Auth-Checks sind Slices 07-10)
- KEINE Aenderungen an `auth.ts` oder Auth-Tabellen (das ist Slice 01/04)
- KEIN `requireAuth()` Helper (das ist Slice 06)
- KEINE neuen Tabellen -- nur Spalten auf bestehenden Tabellen aendern

**Technische Constraints:**
- Drizzle ORM `pgTable` Pattern verwenden (konsistent mit bestehendem Schema)
- UUID fuer `userId` (konsistent mit `users.id` aus Slice 04)
- Migration MUSS multi-step sein: (1) Spalte nullable hinzufuegen, (2) Default-User erstellen/holen, (3) Daten zuweisen, (4) NOT NULL setzen, (5) Constraint aendern
- `onDelete: "cascade"` auf beiden FKs (User loeschen = Projekte/Favorites loeschen)
- Die Migration ist eine handgeschriebene SQL-Datei (nicht von `drizzle-kit generate` generiert), da sie DML-Schritte (INSERT, UPDATE) enthaelt
- `favorite_models` bleibt `@deprecated` -- die userId-Spalte wird trotzdem hinzugefuegt fuer konsistente Migration
- Index auf `projects.userId` und `favorite_models.userId` fuer performante Lookups

**Referenzen:**
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Database Schema" (Schema Details - Geaenderte Tabellen)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Database Schema" (Relationships + Cascade Rules)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Migration Strategy" (Schritte 2-7)
