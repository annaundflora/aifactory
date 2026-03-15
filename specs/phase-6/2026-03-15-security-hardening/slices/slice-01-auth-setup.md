# Slice 01: Auth.js Setup + Config

> **Slice 1 von 14** fuer `Security Hardening for Public Deployment`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-01-auth-setup` |
| **Test** | `pnpm test __tests__/slice-01` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm vitest run __tests__/slice-01` |
| **Integration Command** | `pnpm run build` |
| **Acceptance Command** | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/auth/session` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/api/auth/session` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Auth.js v5 als Authentication-Framework einrichten, sodass die App einen funktionierenden OAuth-Endpoint hat. Dieser Slice legt das Fundament fuer alle nachfolgenden Auth-Slices (Login-Page, Middleware, Server Action Guards).

---

## Acceptance Criteria

1) GIVEN Auth.js v5 Packages sind installiert (`next-auth@beta`, `@auth/drizzle-adapter`)
   WHEN `pnpm run build` ausgefuehrt wird
   THEN Build ist erfolgreich ohne TypeScript-Fehler

2) GIVEN die Auth-Config `auth.ts` existiert im Projekt-Root
   WHEN die Config exportiert wird
   THEN sind folgende Named Exports vorhanden: `auth`, `handlers`, `signIn`, `signOut`

3) GIVEN Google OAuth Provider ist konfiguriert in `auth.ts`
   WHEN die Env-Vars `AUTH_GOOGLE_ID` und `AUTH_GOOGLE_SECRET` gesetzt sind
   THEN verwendet der Provider diese Credentials fuer den OAuth-Flow

4) GIVEN der `signIn` Callback ist konfiguriert
   WHEN ein User sich mit einer Email einloggt die NICHT in `ALLOWED_EMAILS` steht
   THEN gibt der Callback `false` zurueck (Login verweigert)

5) GIVEN der `signIn` Callback ist konfiguriert
   WHEN ein User sich mit einer Email einloggt die in `ALLOWED_EMAILS` steht (case-insensitive)
   THEN gibt der Callback `true` zurueck (Login erlaubt)

6) GIVEN der `session` Callback ist konfiguriert
   WHEN eine Session erstellt wird
   THEN enthaelt `session.user.id` die User-ID aus der Datenbank

7) GIVEN der Route Handler existiert unter `app/api/auth/[...nextauth]/route.ts`
   WHEN ein GET Request an `/api/auth/session` gesendet wird
   THEN antwortet der Endpoint mit HTTP 200 und einem JSON-Body (leeres Objekt `{}` wenn nicht eingeloggt)

8) GIVEN `app/layout.tsx` wurde mit `SessionProvider` gewrappt
   WHEN die App gerendert wird
   THEN ist `useSession()` in Client Components verfuegbar ohne Fehler

9) GIVEN `ALLOWED_EMAILS` ist gesetzt als kommaseparierte Liste (z.B. `"user@example.com, admin@test.de"`)
   WHEN der Allowlist-Check durchgefuehrt wird
   THEN werden Leerzeichen getrimmt und der Vergleich ist case-insensitive

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `__tests__/slice-01/auth-config.test.ts`

<test_spec>
```typescript
// AC-1: Build-Kompatibilitaet
it.todo('should export auth config without TypeScript errors')

// AC-2: Named Exports
it.todo('should export auth, handlers, signIn, signOut from auth.ts')

// AC-3: Google OAuth Provider Credentials
it.todo('should configure Google provider with AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET env vars')

// AC-4: Allowlist - Email nicht erlaubt
it.todo('should reject sign-in for email not in ALLOWED_EMAILS')

// AC-5: Allowlist - Email erlaubt
it.todo('should allow sign-in for email in ALLOWED_EMAILS')

// AC-6: Session Callback - User ID
it.todo('should include user.id in session via session callback')

// AC-9: Allowlist-Parsing mit Trimming und Case-Insensitivity
it.todo('should trim whitespace and compare case-insensitively in allowlist check')
```
</test_spec>

### Test-Datei: `__tests__/slice-01/auth-route.test.ts`

<test_spec>
```typescript
// AC-7: Session Endpoint
it.todo('should respond with 200 and JSON body on GET /api/auth/session')
```
</test_spec>

### Test-Datei: `__tests__/slice-01/layout-session-provider.test.ts`

<test_spec>
```typescript
// AC-8: SessionProvider in Layout
it.todo('should wrap children with SessionProvider in RootLayout')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| -- | Keine | -- | Erster Slice, keine Dependencies |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `auth()` | Function | slice-03 (Middleware), slice-06 (Auth Guard) | `() => Promise<Session \| null>` |
| `handlers` | Object | slice-01 (eigener Route Handler) | `{ GET: NextRouteHandler, POST: NextRouteHandler }` |
| `signIn()` | Function | slice-02 (Login Page) | `(provider: string) => Promise<void>` |
| `signOut()` | Function | slice-11 (Sidebar Logout) | `() => Promise<void>` |
| `SessionProvider` | Component | slice-02, slice-11 (Client Components) | React Context Provider via Layout |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `auth.ts` -- Auth.js v5 Root-Config mit Google Provider, Drizzle Adapter, signIn/session Callbacks
- [ ] `app/api/auth/[...nextauth]/route.ts` -- Route Handler der GET/POST aus auth.ts handlers re-exportiert
- [ ] `app/layout.tsx` -- AENDERUNG: SessionProvider aus next-auth/react um children wrappen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Login-Page UI (das ist Slice 02)
- KEINE Middleware / Route Protection (das ist Slice 03)
- KEINE DB-Schema-Aenderungen (Auth.js Tabellen sind Slice 04)
- KEIN `requireAuth()` Helper (das ist Slice 06)
- Drizzle Adapter wird konfiguriert, aber die Auth-Tabellen im Schema existieren erst nach Slice 04 -- bis dahin sind DB-basierte Sessions nicht funktional

**Technische Constraints:**
- Auth.js v5 (`next-auth@beta` Version 5.0.0-beta.30) verwenden
- `@auth/drizzle-adapter` Version 1.11.1 verwenden
- Session-Strategy: `database` (nicht JWT) -- siehe architecture.md --> Technology Decisions
- `ALLOWED_EMAILS` als kommaseparierte Env-Variable, Parsing mit `split(",").map(e => e.trim().toLowerCase())`
- SessionProvider muss als Client Component gewrappt werden (separate Wrapper-Datei oder inline "use client" Boundary)

**Referenzen:**
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Server Logic" (Auth Config)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Technology Decisions" (Auth.js v5, Database Sessions)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "API Design" (Auth.js Route Handler)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Constraints & Integrations" (Package Versions)
