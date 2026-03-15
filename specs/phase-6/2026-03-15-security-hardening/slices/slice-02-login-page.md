# Slice 02: Login Page UI

> **Slice 2 von 14** fuer `Security Hardening for Public Deployment`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-02-login-page` |
| **Test** | `pnpm vitest run __tests__/slice-02` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-auth-setup"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm vitest run __tests__/slice-02` |
| **Integration Command** | `pnpm run build` |
| **Acceptance Command** | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/login` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Login-Page unter `/login` erstellen, die einen Google Sign-In Button anzeigt, Fehlermeldungen bei OAuth-Fehlern oder nicht-autorisierten Emails darstellt und das App-Logo enthaelt. Die Page nutzt die `signIn("google")` Action aus Slice 01.

---

## Acceptance Criteria

1) GIVEN die Route `/login` existiert
   WHEN ein User `/login` im Browser aufruft
   THEN wird die Login-Page gerendert mit HTTP 200

2) GIVEN die Login-Page ist gerendert
   WHEN der User die Seite betrachtet
   THEN ist ein Google Sign-In Button sichtbar mit dem Text "Mit Google anmelden" (oder "Sign in with Google")

3) GIVEN die Login-Page ist gerendert
   WHEN der User die Seite betrachtet
   THEN ist das App-Logo (oder App-Name "AI Factory") sichtbar oberhalb des Sign-In Buttons

4) GIVEN die Login-Page ist gerendert
   WHEN der User auf den Google Sign-In Button klickt
   THEN wird `signIn("google", { redirectTo: "/" })` aufgerufen und der OAuth-Flow gestartet

5) GIVEN ein OAuth-Fehler ist aufgetreten
   WHEN die Login-Page mit Query-Parameter `?error=OAuthAccountNotLinked` oder `?error=OAuthCallbackError` aufgerufen wird
   THEN wird eine Fehlermeldung angezeigt: "Login fehlgeschlagen. Bitte erneut versuchen."

6) GIVEN ein User mit nicht-autorisierter Email hat sich versucht einzuloggen
   WHEN die Login-Page mit Query-Parameter `?error=AccessDenied` aufgerufen wird
   THEN wird eine Fehlermeldung angezeigt: "Kein Zugang. Bitte kontaktiere den Administrator."

7) GIVEN die Login-Page ist gerendert ohne `?error=` Query-Parameter
   WHEN der User die Seite betrachtet
   THEN ist keine Fehlermeldung sichtbar

8) GIVEN die Login-Page ist gerendert
   WHEN der User die Seite betrachtet
   THEN ist der Sign-In Button zentriert auf der Seite (zentrierter Container)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `__tests__/slice-02/login-page.test.tsx`

<test_spec>
```typescript
// AC-1: Route rendert mit HTTP 200
it.todo('should render login page at /login')

// AC-2: Google Sign-In Button sichtbar
it.todo('should display a Google Sign-In button')

// AC-3: App-Logo/Name sichtbar
it.todo('should display the app logo or app name above the sign-in button')

// AC-4: Button klick ruft signIn auf
it.todo('should call signIn("google") when the sign-in button is clicked')

// AC-5: OAuth-Fehler Fehlermeldung
it.todo('should display generic error message when ?error=OAuthCallbackError is present')

// AC-6: AccessDenied Fehlermeldung
it.todo('should display access denied message when ?error=AccessDenied is present')

// AC-7: Keine Fehlermeldung ohne error param
it.todo('should not display any error message when no error query param is present')

// AC-8: Zentriertes Layout
it.todo('should render the sign-in button in a centered container')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-auth-setup` | `signIn()` | Function | Import aus `next-auth/react` oder `auth.ts` -- Aufruf mit `signIn("google", { redirectTo: "/" })` |
| `slice-01-auth-setup` | `SessionProvider` | Component | Muss in `app/layout.tsx` vorhanden sein (aus Slice 01) |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `/login` Route | Page | `slice-03-middleware` | Middleware redirected unauthentifizierte Requests hierhin |
| Error-Handling via Query-Params | URL Convention | `auth.ts` signIn Callback | `?error=AccessDenied`, `?error=OAuthCallbackError` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/login/page.tsx` -- Login-Page mit Google Sign-In Button, Error-Handling, App-Logo
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Middleware / Route Protection (das ist Slice 03)
- KEIN Logout-Button (das ist Slice 11)
- KEINE Session-Pruefung ob User bereits eingeloggt ist (kann in Slice 03 via Middleware geloest werden)
- KEINE DB-Operationen

**Technische Constraints:**
- Shadcn UI Komponenten nutzen (Button, Alert/Card fuer Error-Anzeige)
- `signIn` aus `next-auth/react` verwenden (Client Component noetig fuer den Button-Click-Handler)
- Error-Query-Params werden von Auth.js automatisch gesetzt -- die Page muss sie nur auslesen und mappen
- Auth.js setzt `?error=AccessDenied` wenn der `signIn` Callback `false` zurueckgibt (Allowlist-Check aus Slice 01)
- Zentrierter Container mit max-width ~400px, vertikal und horizontal zentriert

**Referenzen:**
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Architecture Layers" (Login Page Layer)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Error Handling Strategy" (Error Types + User Response)
- Discovery: `specs/phase-6/2026-03-15-security-hardening/discovery.md` --> Section "UI Layout & Context" (Login Page Layout)
- Discovery: `specs/phase-6/2026-03-15-security-hardening/discovery.md` --> Section "UI Components & States" (google_sign_in_btn, login_error_msg)
- Discovery: `specs/phase-6/2026-03-15-security-hardening/discovery.md` --> Section "Feature State Machine" (unauthenticated, auth_error, not_allowed States)
