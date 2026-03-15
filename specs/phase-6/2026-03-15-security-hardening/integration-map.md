# Integration Map: Security Hardening for Public Deployment

**Generated:** 2026-03-15
**Slices:** 14
**Connections:** 28

---

## Dependency Graph (Visual)

```
                  +-----------------------+       +---------------------------+
                  |  Slice 01             |       |  Slice 12                 |
                  |  Auth Setup + Config  |       |  Security Headers         |
                  +-----------+-----------+       +-------------+-------------+
                              |                                 |
                              v                                 v
                  +-----------+-----------+       +-------------+-------------+
                  |  Slice 02             |       |  Slice 13                 |
                  |  Login Page UI        |       |  Dockerfile + Compose     |
                  +-----------+-----------+       +-------------+-------------+
                              |                                 |
                              v                                 v
                  +-----------+-----------+       +-------------+-------------+
                  |  Slice 03             |       |  Slice 14                 |
                  |  Middleware            |       |  Caddy + .env.example     |
                  +-----------+-----------+       +---------------------------+
                              |
                              v
                  +-----------+-----------+
                  |  Slice 04             |
                  |  DB Auth Tables       |
                  +-----------+-----------+
                              |
                              v
                  +-----------+-----------+
                  |  Slice 05             |
                  |  DB userId Migration  |
                  +-----------+-----------+
                              |
                              v
                  +-----------+-----------+
                  |  Slice 06             |
                  |  Auth Guard Helper    |
                  +---+------+------+----+
                      |      |      |
          +-----------+  +---+  +---+-----------+
          v              v              v       v
  +-------+-------+ +---+---+ +--------+--+ +--+--------+
  | Slice 07      | |Slice 10| | Slice 11  | | (Slice 09)|
  | Auth Projects | |Upload  | | Sidebar   | |  Prompts  |
  +---+-------+---+ |+SSRF  | | Auth      | |  Models   |
      |       |      +-------+ +-----------+ +-----------+
      v       v
  +---+---+ +-+-------+
  |Slice 08| | Slice 09|
  |Gen+Refs| | Prompts |
  +--------+ | Models  |
             +----------+
```

---

## Nodes

### Slice 01: Auth.js Setup + Config

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None (foundation) |
| Outputs | auth(), handlers, signIn(), signOut(), SessionProvider |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| -- | -- | No dependencies |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `auth()` | Function | Slice 03, Slice 06 |
| `handlers` | Object | Slice 01 (own route handler) |
| `signIn()` | Function | Slice 02 |
| `signOut()` | Function | Slice 11 |
| `SessionProvider` | Component | Slice 02, Slice 11 |

---

### Slice 02: Login Page UI

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 01 |
| Outputs | /login Route, Error-Handling via Query-Params |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `signIn()` | Slice 01 | VALID -- slice-01 provides signIn() |
| `SessionProvider` | Slice 01 | VALID -- slice-01 provides SessionProvider via layout.tsx |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `/login` Route | Page | Slice 03 |
| Error-Handling via Query-Params | URL Convention | auth.ts (Slice 01) |

---

### Slice 03: Middleware + Route Protection

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 02 |
| Outputs | Route Protection (Middleware), middleware.ts config |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `auth()` | Slice 01 | VALID -- slice-01 provides auth() |
| `/login` Route | Slice 02 | VALID -- slice-02 provides /login route |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Route Protection | Middleware | All subsequent slices (implicit) |
| `middleware.ts` config export | Config | Next.js Runtime |

---

### Slice 04: DB Schema - Auth.js Tabellen

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 03 |
| Outputs | users/accounts/sessions tables, users.id FK target |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `auth.ts` with Drizzle Adapter Config | Slice 01 | VALID -- slice-01 provides auth.ts |
| Route Protection | Slice 03 | VALID -- slice-03 provides middleware |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `users` Table | Drizzle Schema | Slice 05, Slice 06, Slice 07 |
| `accounts` Table | Drizzle Schema | Slice 01 (Adapter) |
| `sessions` Table | Drizzle Schema | Slice 01 (Adapter) |
| `users.id` FK Target | Column Reference | Slice 05 |

---

### Slice 05: DB Schema - userId Migration

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 04 |
| Outputs | projects.userId, favoriteModels.userId, UNIQUE(userId, modelId) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `users` Table | Slice 04 | VALID -- slice-04 provides users table |
| Migration `0008_auth_tables.sql` | Slice 04 | VALID -- slice-04 provides migration |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `projects.userId` | Column | Slice 07 |
| `favoriteModels.userId` | Column | Slice 09 |
| UNIQUE(userId, modelId) | Constraint | Slice 09 |

---

### Slice 06: Auth Guard Helper

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 05 |
| Outputs | requireAuth() function |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `auth()` | Slice 01 | VALID -- slice-01 provides auth() |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `requireAuth()` | Function | Slice 07, Slice 08, Slice 09, Slice 10, Slice 11 |

---

### Slice 07: Server Action Auth - Projects + Queries

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 06 |
| Outputs | userId-filtered Project-Queries, Auth-Pattern |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `requireAuth()` | Slice 06 | VALID -- slice-06 provides requireAuth() |
| `projects.userId` | Slice 05 | VALID -- slice-05 provides userId column |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| userId-filtered Project-Queries | Functions | Slice 08, Slice 09 |
| Auth-Pattern in Server Actions | Pattern | Slice 08, Slice 09, Slice 10 |

---

### Slice 08: Server Action Auth - Generations + References

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 07 |
| Outputs | Auth-secured Generation/Reference Actions |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `requireAuth()` | Slice 06 | VALID -- slice-06 provides requireAuth() |
| `getProjectQuery(id, userId)` | Slice 07 | VALID -- slice-07 provides userId-filtered queries |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Auth-secured Generation-Actions | Functions | UI Components (final endpoint) |
| Auth-secured Reference-Actions | Functions | UI Components (final endpoint) |

---

### Slice 09: Server Action Auth - Prompts + Models + Model-Settings

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 07 |
| Outputs | Auth-secured Prompt/Model/ModelSetting Actions |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `requireAuth()` | Slice 06 | VALID -- slice-06 provides requireAuth() |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Auth-secured Prompt-Actions | Functions | UI Components (final endpoint) |
| Auth-secured Model-Actions | Functions | UI Components (final endpoint) |
| Auth-secured ModelSetting-Actions | Functions | UI Components (final endpoint) |

---

### Slice 10: Server Action Auth - Upload + SSRF Fix

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 06 |
| Outputs | validateUrl() function (internal) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `requireAuth()` | Slice 06 | VALID -- slice-06 provides requireAuth() |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `validateUrl()` | Function | Internal (upload.ts only) |

---

### Slice 11: Sidebar Auth - User-Info + Logout

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 06 |
| Outputs | User-Info im Sidebar-Footer (final UI) |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `SessionProvider` | Slice 01 | VALID -- slice-01 provides SessionProvider |
| `signOut()` | Slice 01 | VALID -- slice-01 provides signOut() |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| User-Info in Sidebar-Footer | UI Component | None (final user-facing output) |

---

### Slice 12: Security Headers in Next.js Config

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | None (independent) |
| Outputs | Security Headers Config |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| -- | -- | No dependencies |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| Security Headers Config | Next.js headers() | Slice 13 |

---

### Slice 13: Dockerfile + Production Docker Compose

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 12 |
| Outputs | Dockerfile, docker-compose.prod.yml, standalone config |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `next.config.ts` with `headers()` | Slice 12 | VALID -- slice-12 provides headers config |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `Dockerfile` | Docker Build | Slice 14 |
| `docker-compose.prod.yml` | Compose Config | Slice 14 |
| `next.config.ts` with `output: "standalone"` | Config | Slice 14 |

---

### Slice 14: Caddy Reverse Proxy + .env.example

| Field | Value |
|-------|-------|
| Status | APPROVED |
| Dependencies | Slice 13 |
| Outputs | Caddyfile, docker-compose.prod.yml (extended), .env.example |

**Inputs:**

| Input | Source | Validation |
|-------|--------|------------|
| `docker-compose.prod.yml` with app + db Services | Slice 13 | VALID -- slice-13 provides compose config |
| `Dockerfile` | Slice 13 | VALID -- slice-13 provides Docker build |

**Outputs:**

| Output | Type | Consumers |
|--------|------|-----------|
| `Caddyfile` | Caddy Config | None (final deployment artifact) |
| `docker-compose.prod.yml` (extended) | Compose Config | None (final deployment artifact) |
| `.env.example` | Documentation | None (final deployment artifact) |

---

## Connections

| # | From | To | Resource | Type | Status |
|---|------|-----|----------|------|--------|
| 1 | Slice 01 | Slice 02 | `signIn()` | Function | VALID |
| 2 | Slice 01 | Slice 02 | `SessionProvider` | Component | VALID |
| 3 | Slice 01 | Slice 03 | `auth()` | Function | VALID |
| 4 | Slice 01 | Slice 06 | `auth()` | Function | VALID |
| 5 | Slice 01 | Slice 11 | `signOut()` | Function | VALID |
| 6 | Slice 01 | Slice 11 | `SessionProvider` | Component | VALID |
| 7 | Slice 02 | Slice 03 | `/login` Route | Page | VALID |
| 8 | Slice 03 | Slice 04 | Route Protection | Middleware | VALID |
| 9 | Slice 01 | Slice 04 | `auth.ts` with Drizzle Adapter | Config | VALID |
| 10 | Slice 04 | Slice 05 | `users` Table | Schema | VALID |
| 11 | Slice 04 | Slice 05 | Migration 0008 | SQL | VALID |
| 12 | Slice 05 | Slice 07 | `projects.userId` | Column | VALID |
| 13 | Slice 05 | Slice 09 | `favoriteModels.userId` | Column | VALID |
| 14 | Slice 05 | Slice 09 | UNIQUE(userId, modelId) | Constraint | VALID |
| 15 | Slice 06 | Slice 07 | `requireAuth()` | Function | VALID |
| 16 | Slice 06 | Slice 08 | `requireAuth()` | Function | VALID |
| 17 | Slice 06 | Slice 09 | `requireAuth()` | Function | VALID |
| 18 | Slice 06 | Slice 10 | `requireAuth()` | Function | VALID |
| 19 | Slice 06 | Slice 11 | `requireAuth()` | Function | VALID (metadata dep only, not functionally used) |
| 20 | Slice 07 | Slice 08 | `getProjectQuery(id, userId)` | Function | VALID |
| 21 | Slice 07 | Slice 09 | userId-filtered Project-Queries | Functions | VALID |
| 22 | Slice 12 | Slice 13 | `next.config.ts` with headers() | Config | VALID |
| 23 | Slice 13 | Slice 14 | `docker-compose.prod.yml` | Compose Config | VALID |
| 24 | Slice 13 | Slice 14 | `Dockerfile` | Docker Build | VALID |
| 25 | Slice 04 | Slice 01 | `accounts` Table | Schema | VALID (circular: Adapter references tables) |
| 26 | Slice 04 | Slice 01 | `sessions` Table | Schema | VALID (circular: Adapter references tables) |
| 27 | Slice 04 | Slice 06 | `users` Table | Schema | VALID |
| 28 | Slice 04 | Slice 07 | `users` Table | Schema | VALID |

---

## Validation Results

### VALID Connections: 28

All declared dependencies have matching outputs. Every input required by a slice has a corresponding output provided by another slice.

### Orphaned Outputs: 0

All outputs are consumed by at least one downstream slice or are final user-facing/deployment artifacts.

| Output | Defined In | Consumers | Status |
|--------|------------|-----------|--------|
| `validateUrl()` | Slice 10 | Internal (upload.ts) | VALID -- explicitly internal |
| User-Info in Sidebar-Footer | Slice 11 | None | VALID -- final user-facing UI |
| Auth-secured Gen/Ref/Prompt/Model Actions | Slices 08, 09 | UI Components | VALID -- final endpoints |
| Route Protection | Slice 03 | All protected routes | VALID -- implicit middleware |
| Caddyfile | Slice 14 | None | VALID -- final deployment artifact |
| docker-compose.prod.yml (final) | Slice 14 | None | VALID -- final deployment artifact |
| .env.example | Slice 14 | None | VALID -- final documentation |

### Missing Inputs: 0

No inputs reference a non-existent output.

### Deliverable-Consumer Gaps: 0

All deliverables that produce components/functions have consumers that are either:
- Already in the codebase (existing files modified by a slice), or
- Created by the same slice, or
- Final user-facing outputs

**Deliverable-Consumer Traceability Detail:**

| Component/Function | Defined In (Deliverable) | Consumer File | Consumer In Deliverables? | Status |
|--------------------|--------------------------|---------------|---------------------------|--------|
| `auth()`, `signIn()`, `signOut()` | Slice 01: `auth.ts` | Slice 03: `middleware.ts`, Slice 02: `app/login/page.tsx`, Slice 06: `lib/auth/guard.ts`, Slice 11: `components/sidebar.tsx` | Yes -- all consumer files are deliverables in their respective slices | VALID |
| `SessionProvider` | Slice 01: `app/layout.tsx` | Client components using `useSession()` | Slice 01 wraps layout -- auto-available to all client components | VALID |
| `/login` Route | Slice 02: `app/login/page.tsx` | Slice 03: `middleware.ts` (redirect target) | Yes -- middleware.ts is Slice 03 deliverable | VALID |
| `requireAuth()` | Slice 06: `lib/auth/guard.ts` | Slices 07-10 action files | Yes -- all action files are deliverables in Slices 07-10 | VALID |
| users/accounts/sessions tables | Slice 04: `lib/db/schema.ts` | Slice 01: `auth.ts` (Drizzle Adapter), Slice 05: `lib/db/schema.ts` | Yes -- auth.ts (Slice 01), schema.ts (Slice 05) | VALID |
| `projects.userId` | Slice 05: `lib/db/schema.ts` | Slice 07: `lib/db/queries.ts` | Yes -- queries.ts is Slice 07 deliverable | VALID |
| `validateUrl()` | Slice 10: `lib/security/url-validator.ts` | Slice 10: `app/actions/upload.ts` | Yes -- same slice deliverable | VALID |
| Security Headers | Slice 12: `next.config.ts` | Slice 13: `next.config.ts` (adds standalone) | Yes -- next.config.ts is Slice 13 deliverable | VALID |
| Dockerfile + docker-compose.prod.yml | Slice 13 | Slice 14: docker-compose.prod.yml (adds caddy) | Yes -- docker-compose.prod.yml is Slice 14 deliverable | VALID |

### Runtime Path Gaps: 0

All user flows from Discovery have complete call chains through slice deliverables.

**Login Flow Runtime Path:**

```
Browser -> middleware.ts (Slice 03) -> Redirect /login
  -> app/login/page.tsx (Slice 02) -> signIn("google") (Slice 01)
  -> /api/auth/callback/google -> auth.ts signIn callback (Slice 01)
  -> Session created -> Redirect /
  -> middleware.ts (Slice 03) -> Allow (authenticated)
  -> App renders with SessionProvider (Slice 01, layout.tsx)
```
All links present in slice deliverables.

**Logout Flow Runtime Path:**

```
User clicks logout in components/sidebar.tsx (Slice 11)
  -> signOut({ callbackUrl: "/login" }) (Slice 01, next-auth/react)
  -> Session destroyed
  -> Redirect /login
```
All links present in slice deliverables.

**Server Action Auth Flow Runtime Path:**

```
Client calls Server Action (e.g., createProject)
  -> app/actions/projects.ts (Slice 07) calls requireAuth()
  -> lib/auth/guard.ts (Slice 06) calls auth()
  -> auth.ts (Slice 01) checks session
  -> If no session: return { error: "Unauthorized" }
  -> If session: extract userId, call queries with userId filter
  -> lib/db/queries.ts (Slice 07) filters by userId
  -> Return result
```
All links present in slice deliverables.

**Upload + SSRF Prevention Runtime Path:**

```
Client calls uploadSourceImage with URL
  -> app/actions/upload.ts (Slice 10) calls requireAuth()
  -> lib/auth/guard.ts (Slice 06) checks session
  -> lib/security/url-validator.ts (Slice 10) validates URL
  -> If invalid: return error
  -> If valid: fetch(url) proceeds
```
All links present in slice deliverables.

**Docker Deployment Runtime Path:**

```
docker compose -f docker-compose.prod.yml up
  -> Dockerfile (Slice 13) builds Next.js standalone app
  -> docker-compose.prod.yml (Slice 13+14) starts app + db + caddy
  -> Caddyfile (Slice 14) proxies DOMAIN -> app:3000
  -> .env.example (Slice 14) documents all required vars
```
All links present in slice deliverables.

---

## Discovery Traceability

### UI Components Coverage

| Discovery Element | Type | Location | Covered In | Status |
|-------------------|------|----------|------------|--------|
| `google_sign_in_btn` | Button | Login Page | Slice 02 (AC-2, AC-4) | VALID |
| `login_error_msg` | Alert | Login Page | Slice 02 (AC-5, AC-6, AC-7) | VALID |
| `user_info` | Display | Sidebar unten | Slice 11 (AC-1, AC-2, AC-3, AC-4) | VALID |
| `logout_btn` | Button | Sidebar unten | Slice 11 (AC-5) | VALID |

### State Machine Coverage

| State | Required UI | Available Actions | Covered In | Status |
|-------|-------------|-------------------|------------|--------|
| `unauthenticated` | Login Page | Google Sign-In | Slice 02 (Login Page) + Slice 03 (Redirect) | VALID |
| `authenticating` | Login Page, Button loading | -- (warten) | Slice 02 (Button loading state implicit in OAuth redirect) | VALID |
| `not_allowed` | Login Page + Error "Kein Zugang" | Google Sign-In (retry) | Slice 02 (AC-6: ?error=AccessDenied) | VALID |
| `auth_error` | Login Page + Error "Login fehlgeschlagen" | Google Sign-In (retry) | Slice 02 (AC-5: ?error=OAuthCallbackError) | VALID |
| `authenticated` | App (alle Routen) | Logout, alle Features | Slice 01 (SessionProvider), Slice 03 (allows through), Slice 11 (logout) | VALID |

### Transitions Coverage

| From | Trigger | To | Covered In | Status |
|------|---------|-----|------------|--------|
| `unauthenticated` | google_sign_in_btn click | `authenticating` | Slice 02 (AC-4: signIn("google")) | VALID |
| `authenticating` | OAuth success + Email in Allowlist | `authenticated` | Slice 01 (AC-5: signIn callback returns true) | VALID |
| `authenticating` | OAuth success + Email NOT in Allowlist | `not_allowed` | Slice 01 (AC-4: signIn callback returns false), Slice 02 (AC-6: AccessDenied) | VALID |
| `authenticating` | OAuth error/abort | `auth_error` | Slice 02 (AC-5: OAuthCallbackError) | VALID |
| `authenticated` | logout_btn click | `unauthenticated` | Slice 11 (AC-5: signOut with callbackUrl /login) | VALID |
| `authenticated` | Session expired + next request | `unauthenticated` | Slice 03 (AC-1: redirect to /login when no session) | VALID |

### Business Rules Coverage

| Rule | Covered In | Status |
|------|------------|--------|
| Only emails in Allowlist may log in | Slice 01 (AC-4, AC-5) | VALID |
| Allowlist as env var ALLOWED_EMAILS (comma-separated) | Slice 01 (AC-9) | VALID |
| Each user sees only their own projects and generations | Slice 07 (AC-8), Slice 08 (AC-8, AC-9) | VALID |
| Server Actions check ownership: project.userId === session.user.id | Slice 07 (AC-9 to AC-12), Slice 08 (AC-8 to AC-12, AC-18 to AC-20) | VALID |
| Unauthorized access to foreign resources returns { error: "Not found" } | Slice 07 (AC-9), Slice 08 (AC-8) | VALID |
| Upload URLs must use https:// protocol | Slice 10 (AC-3, AC-4) | VALID |
| Upload URLs must not point to private IP ranges | Slice 10 (AC-5 to AC-11, AC-14) | VALID |
| Existing data migrated to default user | Slice 05 (AC-4, AC-5, AC-6) | VALID |

### Data Fields Coverage

| Field | Required | Covered In | Status |
|-------|----------|------------|--------|
| `users.id` | Yes | Slice 04 (AC-2) | VALID |
| `users.email` | Yes | Slice 04 (AC-2) | VALID |
| `users.name` | No | Slice 04 (AC-2) | VALID |
| `users.image` | No | Slice 04 (AC-2) | VALID |
| `users.createdAt` | Yes (Discovery) | Not in any slice | NOTE -- architecture.md Auth.js Adapter schema does not include createdAt. Architecture has priority over discovery. Compliance reports accepted this. |
| `projects.userId` | Yes | Slice 05 (AC-1) | VALID |
| `favorite_models.userId` | Yes | Slice 05 (AC-2) | VALID |
| `ALLOWED_EMAILS` | Yes | Slice 01 (AC-4, AC-5, AC-9) | VALID |

**Discovery Coverage:** 7/8 fields (87.5%) -- `users.createdAt` omitted by architecture decision (Auth.js Adapter schema). Accepted by compliance review.

---

## Summary

| Metric | Value |
|--------|-------|
| Total Slices | 14 |
| All Slices APPROVED | Yes (14/14) |
| Total Connections | 28 |
| Valid Connections | 28 |
| Orphaned Outputs | 0 |
| Missing Inputs | 0 |
| Deliverable-Consumer Gaps | 0 |
| Runtime Path Gaps | 0 |
| Discovery UI Coverage | 4/4 (100%) |
| Discovery State Coverage | 5/5 (100%) |
| Discovery Transition Coverage | 6/6 (100%) |
| Discovery Business Rules Coverage | 8/8 (100%) |
| Discovery Data Fields Coverage | 7/8 (87.5% -- 1 omitted by architecture decision) |

**VERDICT: READY FOR ORCHESTRATION**
