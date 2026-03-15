# Slice 04: DB Schema - Auth.js Tabellen

> **Slice 4 von 14** fuer `Security Hardening for Public Deployment`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-04-db-auth-tables` |
| **Test** | `pnpm vitest run __tests__/slice-04` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-middleware"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm vitest run __tests__/slice-04` |
| **Integration Command** | `npx drizzle-kit generate` |
| **Acceptance Command** | `npx drizzle-kit push` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/api/auth/session` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Die drei Auth.js-Tabellen (`users`, `accounts`, `sessions`) im Drizzle-Schema definieren, damit der `@auth/drizzle-adapter` User-Daten, OAuth-Verknuepfungen und Sessions in der Datenbank persistieren kann. Drizzle-Migration generieren und anwenden.

---

## Acceptance Criteria

1) GIVEN die Datei `lib/db/schema.ts` enthaelt die Tabellen-Definitionen fuer `users`, `accounts`, `sessions`
   WHEN `pnpm run build` ausgefuehrt wird
   THEN ist der Build erfolgreich ohne TypeScript-Fehler

2) GIVEN die `users`-Tabelle ist definiert
   WHEN die Tabellen-Definition geprueft wird
   THEN enthaelt sie die Spalten `id` (UUID PK mit gen_random_uuid()), `name` (TEXT nullable), `email` (TEXT UNIQUE NOT NULL), `emailVerified` (TIMESTAMP WITH TIME ZONE nullable), `image` (TEXT nullable)

3) GIVEN die `accounts`-Tabelle ist definiert
   WHEN die Tabellen-Definition geprueft wird
   THEN hat sie einen Composite Primary Key aus (`provider`, `providerAccountId`) und eine FK-Referenz `userId` auf `users.id` mit CASCADE DELETE

4) GIVEN die `accounts`-Tabelle ist definiert
   WHEN die Tabellen-Definition geprueft wird
   THEN enthaelt sie alle OAuth-Felder: `type`, `provider`, `providerAccountId` (alle NOT NULL), sowie `refresh_token`, `access_token`, `expires_at`, `token_type`, `scope`, `id_token`, `session_state` (alle nullable)

5) GIVEN die `sessions`-Tabelle ist definiert
   WHEN die Tabellen-Definition geprueft wird
   THEN hat sie `sessionToken` (TEXT PK), `userId` (UUID FK auf users.id mit CASCADE DELETE, NOT NULL), `expires` (TIMESTAMP WITH TIME ZONE NOT NULL)

6) GIVEN die drei Tabellen-Definitionen exportiert werden
   WHEN sie als Named Exports geprueft werden
   THEN sind `users`, `accounts`, `sessions` als Named Exports aus `lib/db/schema.ts` verfuegbar

7) GIVEN `npx drizzle-kit generate` wird ausgefuehrt
   WHEN das bestehende Schema mit den neuen Tabellen verglichen wird
   THEN wird eine Migrations-Datei `drizzle/0008_auth_tables.sql` generiert ohne Fehler

8) GIVEN die Migration `drizzle/0008_auth_tables.sql` existiert
   WHEN `npx drizzle-kit push` ausgefuehrt wird
   THEN werden die Tabellen `users`, `accounts`, `sessions` in der Datenbank erstellt

9) GIVEN die Auth.js Tabellen existieren in der Datenbank
   WHEN der Auth.js Login-Flow mit dem Drizzle Adapter durchlaufen wird
   THEN wird ein User-Eintrag in `users` und ein Account-Eintrag in `accounts` erstellt

10) GIVEN die bestehenden 8 Tabellen in `lib/db/schema.ts`
    WHEN die neuen Tabellen hinzugefuegt werden
    THEN bleiben alle bestehenden Tabellen-Definitionen und Exports unveraendert

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `__tests__/slice-04/auth-schema.test.ts`

<test_spec>
```typescript
// AC-1: Build-Kompatibilitaet
it.todo('should compile schema without TypeScript errors')

// AC-2: Users-Tabelle Spalten
it.todo('should define users table with id (UUID PK), name, email (UNIQUE NOT NULL), emailVerified, image')

// AC-3: Accounts-Tabelle Composite PK + FK
it.todo('should define accounts table with composite PK (provider, providerAccountId) and userId FK to users with CASCADE DELETE')

// AC-4: Accounts-Tabelle OAuth-Felder
it.todo('should define accounts table with all OAuth fields (type, provider, providerAccountId, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state)')

// AC-5: Sessions-Tabelle Spalten
it.todo('should define sessions table with sessionToken (TEXT PK), userId (FK CASCADE DELETE), expires (NOT NULL)')

// AC-6: Named Exports
it.todo('should export users, accounts, sessions as named exports from schema.ts')

// AC-10: Bestehende Tabellen unveraendert
it.todo('should preserve all existing table definitions and exports unchanged')
```
</test_spec>

### Test-Datei: `__tests__/slice-04/auth-migration.test.ts`

<test_spec>
```typescript
// AC-7: Migration generiert
it.todo('should generate migration file 0008_auth_tables.sql without errors')

// AC-8: Migration erstellt Tabellen
it.todo('should create users, accounts, sessions tables in database after push')

// AC-9: Auth.js Login-Flow speichert Daten
it.todo('should persist user and account entries when Auth.js login flow completes')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-auth-setup` | `auth.ts` mit Drizzle Adapter Config | Config | Adapter referenziert `users`, `accounts`, `sessions` aus Schema |
| `slice-03-middleware` | Route Protection | Middleware | Auth-Flow muss /api/auth/* durchlassen |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `users` Table | Drizzle Schema | slice-05, slice-06, slice-07 | `pgTable("users", { id, name, email, emailVerified, image })` |
| `accounts` Table | Drizzle Schema | slice-01 (Adapter) | `pgTable("accounts", { userId, type, provider, ... })` |
| `sessions` Table | Drizzle Schema | slice-01 (Adapter) | `pgTable("sessions", { sessionToken, userId, expires })` |
| `users.id` FK Target | Column Reference | slice-05 | `users.id` als FK-Ziel fuer `projects.userId` und `favorite_models.userId` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/db/schema.ts` -- AENDERUNG: +users, +accounts, +sessions Tabellen-Definitionen im Auth.js Adapter Format
- [ ] `drizzle/0008_auth_tables.sql` -- NEU: Generierte Drizzle-Migration fuer die drei Auth-Tabellen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE userId-Spalte auf `projects` oder `favorite_models` (das ist Slice 05)
- KEINE Aenderungen an `auth.ts` oder dem Drizzle Adapter (das ist Slice 01)
- KEINE Query-Aenderungen in `queries.ts` (das ist Slice 07)
- KEINE Daten-Migration bestehender Eintraege (das ist Slice 05)
- KEIN `requireAuth()` Helper (das ist Slice 06)

**Technische Constraints:**
- Drizzle ORM `pgTable` Pattern verwenden (konsistent mit bestehenden 8 Tabellen)
- UUID fuer `users.id` mit `gen_random_uuid()` (konsistent mit bestehendem Pattern)
- `@auth/drizzle-adapter` erwartet exakte Spaltennamen -- siehe architecture.md --> Section "Database Schema"
- Composite PK auf `accounts` via `primaryKey({ columns: [provider, providerAccountId] })`
- Alle FKs mit `onDelete: "cascade"` (User loeschen = alle zugehoerigen Accounts/Sessions loeschen)
- Migrations-Dateiname MUSS `0008_auth_tables.sql` sein (naechste laufende Nummer nach 0007)
- Index auf `accounts.userId` und `sessions.userId` fuer performante Lookups

**Referenzen:**
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Database Schema" (Schema Details - Neue Tabellen)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Database Schema" (Relationships + Cascade Rules)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Constraints & Integrations" (@auth/drizzle-adapter Version 1.11.1)
