# E2E Checklist: Security Hardening for Public Deployment

**Integration Map:** `integration-map.md`
**Generated:** 2026-03-15

---

## Pre-Conditions

- [x] All slices APPROVED (Gate 2) -- 14/14 APPROVED
- [x] Architecture APPROVED (Gate 1)
- [x] Integration Map has no MISSING INPUTS -- 0 missing

---

## Happy Path Tests

### Flow 1: Login Flow (Unauthenticated -> Authenticated)

1. [ ] **Slice 03:** Open `http://localhost:3000/` without session -> 302 redirect to `/login`
2. [ ] **Slice 02:** Login page renders at `/login` with HTTP 200
3. [ ] **Slice 02:** Google Sign-In button is visible with App-Logo above
4. [ ] **Slice 02:** No error message visible (no `?error=` param)
5. [ ] **Slice 01+02:** Click Sign-In button -> `signIn("google", { redirectTo: "/" })` triggers OAuth flow
6. [ ] **Slice 01:** OAuth callback -> signIn callback checks email against ALLOWED_EMAILS
7. [ ] **Slice 01:** Email in Allowlist -> Session created, session.user.id populated
8. [ ] **Slice 03:** Redirect to `/` -> Middleware allows (authenticated) -> App renders

### Flow 2: Logout Flow (Authenticated -> Unauthenticated)

1. [ ] **Slice 11:** Sidebar shows User-Info (Avatar, Name, Email) in SidebarFooter
2. [ ] **Slice 11:** Click Logout button -> `signOut({ callbackUrl: "/login" })`
3. [ ] **Slice 11:** Session destroyed -> Redirect to `/login`
4. [ ] **Slice 03:** Next request to `/` -> 302 redirect to `/login`

### Flow 3: Project CRUD with User Isolation

1. [ ] **Slice 07:** Authenticated User A calls `createProject({ name: "Test" })` -> Project created with userId = User A
2. [ ] **Slice 07:** User A calls `getProjects()` -> Returns only User A's projects
3. [ ] **Slice 07:** User A calls `renameProject({ id: "own-project", name: "Renamed" })` -> Success
4. [ ] **Slice 07:** User A calls `getProject({ id: "own-project" })` -> Returns project
5. [ ] **Slice 07:** User A calls `deleteProject({ id: "own-project" })` -> Project deleted

### Flow 4: Generation with Ownership via Project

1. [ ] **Slice 08:** Authenticated User A calls `generateImages({ projectId: "own-project", ... })` -> Generation started
2. [ ] **Slice 08:** User A calls `fetchGenerations("own-project")` -> Returns generations for own project
3. [ ] **Slice 08:** User A calls `uploadReferenceImage({ projectId: "own-project", ... })` -> Upload succeeds

### Flow 5: Upload with SSRF Protection

1. [ ] **Slice 10:** Authenticated User calls `uploadSourceImage({ url: "https://valid-host.com/img.png", ... })` -> Fetch proceeds
2. [ ] **Slice 10:** SSRF blocked: `uploadSourceImage({ url: "http://evil.com/img.png", ... })` -> `{ error: "Only HTTPS URLs allowed" }`
3. [ ] **Slice 10:** SSRF blocked: `uploadSourceImage({ url: "https://169.254.169.254/...", ... })` -> `{ error: "URL points to private network" }`

### Flow 6: Docker Production Deployment

1. [ ] **Slice 13:** `docker compose -f docker-compose.prod.yml build` -> Success (exit 0)
2. [ ] **Slice 13:** App image size < 500MB
3. [ ] **Slice 14:** `docker compose -f docker-compose.prod.yml config --quiet` -> Valid (exit 0)
4. [ ] **Slice 14:** `docker compose -f docker-compose.prod.yml up -d` -> All 3 services (app, db, caddy) start
5. [ ] **Slice 14:** `curl http://localhost:80` -> Response (200 or redirect to /login)
6. [ ] **Slice 13:** DB port 5432 NOT exposed externally

---

## Edge Cases

### Error Handling

- [ ] **Slice 02:** OAuth error -> Login page with `?error=OAuthCallbackError` -> "Login fehlgeschlagen. Bitte erneut versuchen."
- [ ] **Slice 02:** Email not in Allowlist -> Login page with `?error=AccessDenied` -> "Kein Zugang. Bitte kontaktiere den Administrator."
- [ ] **Slice 01:** signIn callback with email NOT in ALLOWED_EMAILS -> Returns `false`
- [ ] **Slice 01:** signIn callback with email in ALLOWED_EMAILS (case-insensitive) -> Returns `true`
- [ ] **Slice 06:** requireAuth() with session missing user.id -> Returns `{ error: "Unauthorized" }`
- [ ] **Slice 06:** requireAuth() with session missing user.email -> Returns `{ error: "Unauthorized" }`

### Unauthorized Access (No Session)

- [ ] **Slice 07:** `createProject()` without session -> `{ error: "Unauthorized" }`
- [ ] **Slice 07:** `getProjects()` without session -> `{ error: "Unauthorized" }`
- [ ] **Slice 07:** `getProject()` without session -> `{ error: "Unauthorized" }`
- [ ] **Slice 07:** `renameProject()` without session -> `{ error: "Unauthorized" }`
- [ ] **Slice 07:** `deleteProject()` without session -> `{ error: "Unauthorized" }`
- [ ] **Slice 07:** `generateThumbnail()` without session -> `{ error: "Unauthorized" }`
- [ ] **Slice 08:** All 7 generation actions without session -> `{ error: "Unauthorized" }`
- [ ] **Slice 08:** All 5 reference actions without session -> `{ error: "Unauthorized" }`
- [ ] **Slice 09:** All 4 prompt actions without session -> `{ error: "Unauthorized" }`
- [ ] **Slice 09:** All 3 model actions without session -> `{ error: "Unauthorized" }`
- [ ] **Slice 09:** Both model-settings actions without session -> `{ error: "Unauthorized" }`
- [ ] **Slice 10:** `uploadSourceImage()` without session -> `{ error: "Unauthorized" }`

### Ownership Violations (Cross-User Access)

- [ ] **Slice 07:** User A `getProject()` for User B's project -> `{ error: "Projekt nicht gefunden" }`
- [ ] **Slice 07:** User A `renameProject()` for User B's project -> `{ error: "Projekt nicht gefunden" }`
- [ ] **Slice 07:** User A `deleteProject()` for User B's project -> Project NOT deleted
- [ ] **Slice 08:** User A `generateImages()` for User B's project -> `{ error: "Not found" }`
- [ ] **Slice 08:** User A `fetchGenerations()` for User B's project -> `{ error: "Not found" }`
- [ ] **Slice 08:** User A `uploadReferenceImage()` for User B's project -> `{ error: "Not found" }`

### SSRF Prevention

- [ ] **Slice 10:** `http://` URL -> Rejected
- [ ] **Slice 10:** `file:///etc/passwd` -> Rejected
- [ ] **Slice 10:** `https://127.0.0.1/` -> Rejected
- [ ] **Slice 10:** `https://10.0.0.1/` -> Rejected
- [ ] **Slice 10:** `https://172.16.0.1/` -> Rejected
- [ ] **Slice 10:** `https://192.168.1.1/` -> Rejected
- [ ] **Slice 10:** `https://169.254.169.254/` -> Rejected
- [ ] **Slice 10:** `https://localhost/` -> Rejected
- [ ] **Slice 10:** `https://[::1]/` -> Rejected
- [ ] **Slice 10:** `https://0.0.0.0/` -> Rejected
- [ ] **Slice 10:** Unparsable URL string -> Rejected

### State Transitions

- [ ] **Slice 03:** `unauthenticated` + access `/` -> Redirect `/login` (302)
- [ ] **Slice 03:** `unauthenticated` + access `/projects/abc` -> Redirect `/login` (302)
- [ ] **Slice 03:** `unauthenticated` + access `/login` -> Allow (200)
- [ ] **Slice 03:** `unauthenticated` + access `/api/auth/session` -> Allow (200)
- [ ] **Slice 03:** `unauthenticated` + access `/_next/static/*` -> Allow
- [ ] **Slice 03:** `unauthenticated` + access `/favicon.ico` -> Allow
- [ ] **Slice 03:** `authenticated` + access `/` -> Allow (200)

### Boundary Conditions

- [ ] **Slice 01:** ALLOWED_EMAILS with whitespace and mixed case -> Trimmed, case-insensitive match
- [ ] **Slice 11:** `session.user.image` is null -> Fallback avatar rendered (no broken image)
- [ ] **Slice 11:** `session.user.name` is null -> Email shown as fallback display name
- [ ] **Slice 11:** Sidebar collapsed mode -> Only avatar visible, name/email/logout text hidden
- [ ] **Slice 11:** "Back to Overview" link still functional after auth additions
- [ ] **Slice 05:** Data migration assigns existing projects to default user
- [ ] **Slice 05:** Data migration assigns existing favorites to default user

### Security Headers

- [ ] **Slice 12:** Response includes `X-Frame-Options: DENY`
- [ ] **Slice 12:** Response includes `X-Content-Type-Options: nosniff`
- [ ] **Slice 12:** Response includes `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] **Slice 12:** Response includes `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [ ] **Slice 12:** Response includes `Content-Security-Policy` with `default-src`, `script-src`, `style-src`, `img-src`

### Docker Production

- [ ] **Slice 13:** Dockerfile uses `node:22.14.0-slim` base
- [ ] **Slice 13:** Dockerfile has 3+ stages (deps, build, runner)
- [ ] **Slice 13:** Runner stage uses non-root user
- [ ] **Slice 13:** DB credentials from .env (no hardcoded defaults)
- [ ] **Slice 14:** Caddy image is `caddy:2.11.2-alpine`
- [ ] **Slice 14:** Caddy exposes ports 80 and 443
- [ ] **Slice 14:** Caddy reverse proxies to `app:3000`
- [ ] **Slice 14:** All services in private Docker network
- [ ] **Slice 14:** `.env.example` contains all required vars without real secrets

---

## Cross-Slice Integration Points

| # | Integration Point | Slices | How to Verify |
|---|-------------------|--------|---------------|
| 1 | auth() function used by middleware | 01 -> 03 | Middleware correctly reads session via auth() |
| 2 | signIn() used by login page | 01 -> 02 | Login button triggers OAuth via signIn("google") |
| 3 | signOut() used by sidebar | 01 -> 11 | Logout button calls signOut() and redirects |
| 4 | SessionProvider wraps app | 01 -> 02, 11 | useSession() works in client components |
| 5 | /login route is redirect target | 02 -> 03 | Middleware redirects unauthenticated to /login |
| 6 | Auth tables used by Drizzle Adapter | 04 -> 01 | Auth.js can persist users/accounts/sessions |
| 7 | users.id FK target for projects | 04 -> 05 | Migration adds userId FK referencing users.id |
| 8 | requireAuth() used by all action slices | 06 -> 07, 08, 09, 10 | All Server Actions call requireAuth() first |
| 9 | userId-filtered queries used for ownership | 07 -> 08 | Generation/Reference actions check project ownership via userId-filtered query |
| 10 | projects.userId column used in queries | 05 -> 07 | Queries filter by userId column |
| 11 | Security headers preserved through standalone | 12 -> 13 | Build with output:standalone preserves headers() |
| 12 | Compose extended with caddy service | 13 -> 14 | Caddy service added without breaking app/db services |

---

## Sign-Off

| Tester | Date | Result |
|--------|------|--------|
| -- | -- | Pending |

**Notes:**
- All 14 slices have been verified as APPROVED by Gate 2 compliance checks.
- Integration Map shows 0 gaps, 0 missing inputs, 0 orphaned outputs.
- The `users.createdAt` field from Discovery was omitted by architecture decision (Auth.js Adapter schema). This was accepted by all compliance reviews.
- Slice 11 metadata dependency on Slice 06 is a conservative ordering constraint, not a functional dependency (noted in compliance-slice-11).
