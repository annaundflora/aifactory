# Slice 03: Middleware + Route Protection

> **Slice 3 von 14** fuer `Security Hardening for Public Deployment`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-03-middleware` |
| **Test** | `pnpm vitest run __tests__/slice-03` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-login-page"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm vitest run __tests__/slice-03` |
| **Integration Command** | `pnpm run build` |
| **Acceptance Command** | `curl -s -o /dev/null -w "%{http_code}" -L http://localhost:3000/` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/api/auth/session` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Next.js Middleware erstellen, die alle Routen schuetzt ausser einer definierten Allowlist. Unauthentifizierte Requests werden mit HTTP 302 zu `/login` redirected. Damit wird sichergestellt, dass kein unauthentifizierter User auf geschuetzte App-Inhalte zugreifen kann.

---

## Acceptance Criteria

1) GIVEN ein unauthentifizierter User (keine Session)
   WHEN er GET `/` aufruft
   THEN wird er mit HTTP 302 zu `/login` redirected

2) GIVEN ein unauthentifizierter User (keine Session)
   WHEN er GET `/login` aufruft
   THEN wird die Login-Page normal gerendert mit HTTP 200 (kein Redirect)

3) GIVEN ein unauthentifizierter User (keine Session)
   WHEN er GET `/api/auth/session` aufruft
   THEN wird der Request durchgelassen (kein Redirect, HTTP 200)

4) GIVEN ein unauthentifizierter User (keine Session)
   WHEN er GET `/api/auth/callback/google` aufruft
   THEN wird der Request durchgelassen (kein Redirect)

5) GIVEN ein unauthentifizierter User (keine Session)
   WHEN er GET `/_next/static/chunks/main.js` aufruft
   THEN wird der Request durchgelassen (kein Redirect)

6) GIVEN ein unauthentifizierter User (keine Session)
   WHEN er GET `/favicon.ico` aufruft
   THEN wird der Request durchgelassen (kein Redirect)

7) GIVEN ein authentifizierter User (gueltige Session vorhanden)
   WHEN er GET `/` aufruft
   THEN wird der Request durchgelassen (kein Redirect, HTTP 200)

8) GIVEN ein unauthentifizierter User (keine Session)
   WHEN er GET `/projects/abc-123` aufruft
   THEN wird er mit HTTP 302 zu `/login` redirected

9) GIVEN die `middleware.ts` Datei existiert im Projekt-Root
   WHEN `pnpm run build` ausgefuehrt wird
   THEN ist der Build erfolgreich ohne TypeScript-Fehler

10) GIVEN die Middleware hat einen `config` Export mit `matcher`
    WHEN die Matcher-Konfiguration geprueft wird
    THEN schliesst sie `/login`, `/api/auth/:path*`, `/_next/:path*` und `/favicon.ico` aus

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `__tests__/slice-03/middleware.test.ts`

<test_spec>
```typescript
// AC-1: Unauthentifiziert auf / -> Redirect /login
it.todo('should redirect unauthenticated request to / to /login with 302')

// AC-2: /login ist ohne Auth erreichbar
it.todo('should allow unauthenticated access to /login without redirect')

// AC-3: /api/auth/session ist ohne Auth erreichbar
it.todo('should allow unauthenticated access to /api/auth/session')

// AC-4: /api/auth/callback/google ist ohne Auth erreichbar
it.todo('should allow unauthenticated access to /api/auth/callback/google')

// AC-5: /_next/* ist ohne Auth erreichbar
it.todo('should allow unauthenticated access to /_next/static resources')

// AC-6: /favicon.ico ist ohne Auth erreichbar
it.todo('should allow unauthenticated access to /favicon.ico')

// AC-7: Authentifizierter User auf / -> kein Redirect
it.todo('should allow authenticated request to / without redirect')

// AC-8: Unauthentifiziert auf geschuetzte Sub-Route -> Redirect /login
it.todo('should redirect unauthenticated request to /projects/abc-123 to /login')

// AC-9: Build-Kompatibilitaet
it.todo('should export middleware and config without TypeScript errors')

// AC-10: Matcher-Konfiguration schliesst public Routes aus
it.todo('should export config with matcher that excludes /login, /api/auth/*, /_next/*, /favicon.ico')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-auth-setup` | `auth()` | Function | Session-Check via Auth.js -- `auth()` gibt `Session \| null` zurueck |
| `slice-02-login-page` | `/login` Route | Page | Redirect-Ziel muss existieren |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Route Protection | Middleware | Alle nachfolgenden Slices | Unauthentifizierte Requests erreichen keine geschuetzten Routen |
| `middleware.ts` | Config Export | Next.js Runtime | `export const config = { matcher: [...] }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `middleware.ts` -- Next.js Middleware mit Auth-Check und Redirect-Logik fuer unauthentifizierte Requests
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Server Action Auth-Checks (das ist Slice 06+07+08+09+10)
- KEIN `requireAuth()` Helper (das ist Slice 06)
- KEINE DB-Aenderungen
- KEINE Login-Page Aenderungen (Slice 02 ist bereits fertig)
- KEIN Redirect-Loop-Handling bei bereits eingeloggten Usern auf /login (kann spaeter ergaenzt werden)

**Technische Constraints:**
- Auth.js v5 `auth` Export aus `auth.ts` verwenden fuer Session-Check
- Next.js Middleware-Pattern: `middleware.ts` im Projekt-Root (nicht in `app/` oder `src/`)
- Matcher-basierte Route-Exclusion bevorzugen (performanter als if/else in der Middleware-Funktion)
- Redirect-Ziel ist immer `/login` (nicht `/api/auth/signin`)

**Referenzen:**
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Architecture Layers" (Middleware Layer)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Security" (Route Protection)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Data Flow" (Browser -> Middleware -> Route)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Error Handling Strategy" (Unauthenticated Middleware -> 302 Redirect)
