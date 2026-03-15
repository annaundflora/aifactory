# Feature: Security Hardening for Public Deployment

**Epic:** --
**Status:** Ready
**Discovery:** `discovery.md` (same folder)
**Derived from:** Discovery constraints, NFRs, and risks

---

## Problem & Solution

**Problem:**
- App hat zero Authentication — alle Server Actions sind anonym aufrufbar
- Keine User-Isolation — alle Daten (Projekte, Generierungen) sind ungeschützt zugänglich
- SSRF-Vulnerability in `uploadSourceImage` — beliebige URLs werden server-seitig gefetcht
- Keine Security Headers (CSP, HSTS, X-Frame-Options)
- Docker-Setup exposed DB-Port mit Default-Credentials
- Deployment auf Hetzner VPS geplant — App wird öffentlich erreichbar

**Solution:**
- Google OAuth + Email-Allowlist für Zugangskontrolle
- User-isolierte Daten via `userId` auf allen Tabellen
- SSRF-Fix via URL-Validierung
- Security Headers via Next.js config
- Docker-Härtung + Caddy Reverse Proxy für Production

**Business Value:**
- App kann sicher öffentlich deployed werden
- Daten sind pro User isoliert
- API-Kosten (Replicate, OpenRouter) geschützt vor Missbrauch

---

## Scope & Boundaries

| In Scope |
|----------|
| Authentication via Auth.js (v5) + Google OAuth Provider |
| Email-Allowlist (Env-Variable) |
| Login-Page mit Google Sign-In Button |
| Next.js Middleware für Route-Protection |
| Users-Tabelle in DB |
| `userId`-Spalte auf `projects`, `favorite_models` Tabellen |
| Ownership-Checks in allen Server Actions |
| SSRF-Fix: URL-Scheme + IP-Range Validierung in `uploadSourceImage` |
| Security Headers via `next.config.ts` |
| Docker-Härtung: Private Network, starke DB-Credentials, kein exposed Port |
| Caddy Reverse Proxy Config mit automatischem SSL |
| Production Docker Compose mit App + DB + Caddy |
| Datenmigration: bestehende Daten einem Default-User zuweisen |

| Out of Scope |
|--------------|
| Admin-Dashboard für User-Management |
| Self-Service Registration / Invite-Flow |
| Role-Based Access Control (RBAC) |
| Rate Limiting |
| Audit Logging |
| Zweiter OAuth-Provider (GitHub) |
| Passwort-basierter Login |
| Two-Factor Authentication (2FA) |

---

## API Design

### Overview

| Aspect | Specification |
|--------|---------------|
| Style | Next.js Server Actions + Auth.js Route Handler |
| Authentication | Session-based via Auth.js (cookie `authjs.session-token`) |
| Rate Limiting | Out of scope |

### Endpoints

| Method | Path | Request | Response | Auth | Business Logic |
|--------|------|---------|----------|------|----------------|
| GET/POST | `/api/auth/*` | Auth.js managed | Auth.js managed | Public | OAuth flow, session management, CSRF |
| -- | Alle Server Actions | `+ session.user.id` implizit | `{ error: "Unauthorized" }` bei fehlender Session | Required | Session-Check + Ownership-Check |

### Auth.js Route Handler

| Aspect | Detail |
|--------|--------|
| Location | `app/api/auth/[...nextauth]/route.ts` |
| Exports | `GET`, `POST` von `handlers` aus `auth.ts` |
| Managed Routes | `/api/auth/signin`, `/api/auth/signout`, `/api/auth/callback/google`, `/api/auth/session` |

### Data Transfer Objects (DTOs)

| DTO | Fields | Validation | Notes |
|-----|--------|------------|-------|
| Session User | `id: string`, `email: string`, `name: string?`, `image: string?` | Auth.js managed | Von `auth()` zurückgegeben |
| Auth Error Response | `{ error: string }` | -- | Konsistent mit bestehendem Error-Pattern |

---

## Database Schema

### Entities

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` (NEU) | Auth.js User-Daten | `id`, `email`, `name`, `image` |
| `accounts` (NEU) | OAuth Provider-Verknüpfungen | `userId`, `provider`, `providerAccountId` |
| `sessions` (NEU) | Active Sessions | `userId`, `sessionToken`, `expires` |
| `projects` (ÄNDERUNG) | +userId FK | `userId` (neue Spalte) |
| `favorite_models` (ÄNDERUNG) | +userId FK | `userId` (neue Spalte) |

### Schema Details — Neue Tabellen

> Auth.js erfordert ein spezifisches Schema. Der `@auth/drizzle-adapter` definiert die exakten Spalten.

| Table | Column | Type | Constraints | Index |
|-------|--------|------|-------------|-------|
| `users` | `id` | UUID | PK, DEFAULT gen_random_uuid() | -- |
| `users` | `name` | TEXT | -- | -- |
| `users` | `email` | TEXT | UNIQUE, NOT NULL | Yes |
| `users` | `emailVerified` | TIMESTAMP(tz) | -- | -- |
| `users` | `image` | TEXT | -- | -- |
| `accounts` | `userId` | UUID | FK → users.id, NOT NULL | Yes |
| `accounts` | `type` | TEXT | NOT NULL | -- |
| `accounts` | `provider` | TEXT | NOT NULL | -- |
| `accounts` | `providerAccountId` | TEXT | NOT NULL | -- |
| `accounts` | `refresh_token` | TEXT | -- | -- |
| `accounts` | `access_token` | TEXT | -- | -- |
| `accounts` | `expires_at` | INTEGER | -- | -- |
| `accounts` | `token_type` | TEXT | -- | -- |
| `accounts` | `scope` | TEXT | -- | -- |
| `accounts` | `id_token` | TEXT | -- | -- |
| `accounts` | `session_state` | TEXT | -- | -- |
| `accounts` | -- | -- | COMPOSITE PK (provider, providerAccountId) | -- |
| `sessions` | `sessionToken` | TEXT | PK | -- |
| `sessions` | `userId` | UUID | FK → users.id, NOT NULL | Yes |
| `sessions` | `expires` | TIMESTAMP(tz) | NOT NULL | -- |

### Schema Details — Geänderte Tabellen

| Table | Column | Type | Constraints | Index |
|-------|--------|------|-------------|-------|
| `projects` | `userId` | UUID | FK → users.id, NOT NULL | Yes |
| `favorite_models` | `userId` | UUID | FK → users.id, NOT NULL | Yes |
| `favorite_models` | `modelId` | VARCHAR(255) | -- | -- |
| `favorite_models` | -- | -- | UNIQUE(userId, modelId) statt UNIQUE(modelId) | -- |

### Relationships

| From | To | Relationship | Cascade |
|------|-----|--------------|---------|
| `accounts` | `users` | N:1 | DELETE CASCADE |
| `sessions` | `users` | N:1 | DELETE CASCADE |
| `projects` | `users` | N:1 | DELETE CASCADE |
| `favorite_models` | `users` | N:1 | DELETE CASCADE |

### Migration Strategy

1. Auth.js Tabellen erstellen (`users`, `accounts`, `sessions`)
2. Default-User in `users` einfügen (erste Email aus `ALLOWED_EMAILS`)
3. `userId`-Spalte auf `projects` hinzufügen (nullable)
4. Alle bestehenden Projekte dem Default-User zuweisen
5. `userId` auf NOT NULL setzen
6. `favorite_models`: `userId`-Spalte hinzufügen, UNIQUE Constraint ändern
7. Alle bestehenden Favorites dem Default-User zuweisen

---

## Server Logic

### Services & Processing

| Service | Responsibility | Input | Output | Side Effects |
|---------|----------------|-------|--------|--------------|
| Auth Config (`auth.ts`) | NextAuth Konfiguration, Google Provider, Allowlist-Check, Drizzle Adapter | Env-Vars (AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_SECRET, ALLOWED_EMAILS) | `auth()`, `handlers`, `signIn`, `signOut` exports | Session-Cookie setzen/löschen |
| Auth Guard (in jeder Server Action) | Session prüfen, userId extrahieren | -- | `userId: string` oder `{ error: "Unauthorized" }` | -- |
| Ownership Guard (in jeder Server Action) | Resource gehört User? | `projectId` + `userId` | boolean | -- |
| URL Validator (`lib/security/url-validator.ts`) | URL-Scheme + IP-Range prüfen | `url: string` | `{ valid: true } \| { valid: false, reason: string }` | -- |

### Business Logic Flow

```
Client Request
    → Middleware (Session prüfen → Redirect /login wenn fehlt)
    → Server Action
        → auth() → Session holen
        → Session vorhanden? → Nein: { error: "Unauthorized" }
        → userId extrahieren
        → Resource laden mit userId-Filter
        → Resource gefunden? → Nein: { error: "Not found" }
        → Business Logic ausführen
        → Response
```

### Auth Guard Pattern (für alle Server Actions)

| Aspect | Detail |
|--------|--------|
| Funktion | Helper `requireAuth()` in `lib/auth/guard.ts` |
| Input | -- (liest Session via `auth()`) |
| Output | `{ userId: string, email: string }` |
| Error | `{ error: "Unauthorized" }` |
| Verwendung | Erste Zeile jeder Server Action |

### Ownership Check Pattern

| Aspect | Detail |
|--------|--------|
| Prinzip | Alle DB-Queries filtern immer nach `userId` |
| Umsetzung | `where: eq(projects.userId, userId)` in allen Queries |
| Fehler bei fremder Resource | `{ error: "Not found" }` (kein Informationsleck) |
| Indirekte Ownership | `generations`, `reference_images`, `assistant_sessions`, `project_selected_models` erben Ownership via `projectId` → `projects.userId` — Project-Ownership prüfen vor Zugriff |

### URL Validation Rules

| Check | Rule | Reject Response |
|-------|------|-----------------|
| Protocol | Nur `https://` erlaubt | "Only HTTPS URLs allowed" |
| Hostname Parse | `new URL(url)` muss gültig sein | "Invalid URL" |
| Private IP Ranges | 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, 0.0.0.0 | "URL points to private network" |
| Localhost | `localhost`, `[::1]` | "URL points to private network" |

### Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `ALLOWED_EMAILS` (env) | Kommasepariert, mindestens 1 Email | Server-Start Fehler wenn leer |
| `AUTH_SECRET` (env) | Non-empty string | Server-Start Fehler wenn leer |
| `AUTH_GOOGLE_ID` (env) | Non-empty string | Server-Start Fehler wenn leer |
| `AUTH_GOOGLE_SECRET` (env) | Non-empty string | Server-Start Fehler wenn leer |
| Upload URL | HTTPS + nicht-private IP | "Only HTTPS URLs allowed" / "URL points to private network" |

---

## Security

### Authentication & Authorization

| Area | Mechanism | Notes |
|------|-----------|-------|
| Authentication | Auth.js v5 Session-based (Cookie) | `authjs.session-token` Cookie, HttpOnly, Secure, SameSite=Lax |
| OAuth Provider | Google | `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` Env-Vars |
| Email Allowlist | `signIn` Callback prüft Email gegen `ALLOWED_EMAILS` Env-Var | Kommaseparierte Liste, case-insensitive Vergleich |
| Route Protection | Next.js Middleware redirected zu `/login` | Ausnahmen: `/login`, `/api/auth/*`, `/_next/*`, `/favicon.ico` |
| Server Action Auth | `requireAuth()` Helper in jeder Action | Gibt `{ error: "Unauthorized" }` zurück |
| Resource Ownership | userId-Filter in allen DB Queries | Gibt `{ error: "Not found" }` für fremde Resources |

### Data Protection

| Data Type | Protection | Notes |
|-----------|------------|-------|
| Session Token | HttpOnly Cookie, Secure Flag, SameSite=Lax | Auth.js Standard |
| OAuth Tokens | Encrypted in `accounts` Tabelle | Auth.js managed |
| Passwords | N/A — kein Password-Login | Nur OAuth |
| User Email | In DB gespeichert, nicht an andere User exponiert | Nur eigene Session sichtbar |

### Input Validation & Sanitization

| Input | Validation | Sanitization |
|-------|------------|--------------|
| Upload URL | HTTPS-only + IP-Range-Blocklist | `new URL()` Parsing |
| OAuth Callback | Auth.js CSRF Token Validation | Auth.js managed |
| Server Action Params | Bestehende Validierung bleibt | Drizzle parametrisiert |

### SSRF Prevention

| Layer | Mechanism |
|-------|-----------|
| Protocol | Nur `https://` erlaubt |
| IP Range | Private Ranges blockiert (RFC 1918, Link-Local, Loopback) |
| DNS Rebinding | Hostname wird vor fetch validiert |
| Location | `lib/security/url-validator.ts`, aufgerufen in `app/actions/upload.ts` |

---

## Architecture Layers

### Layer Responsibilities

| Layer | Responsibility | Pattern |
|-------|----------------|---------|
| Middleware (`middleware.ts`) | Route Protection, Session-Check, Redirect zu /login | Auth.js Middleware-Wrapper |
| Auth Config (`auth.ts`) | OAuth Provider, Callbacks, Adapter, Session-Config | Auth.js Config Pattern |
| Auth Route Handler (`app/api/auth/[...nextauth]/route.ts`) | OAuth Callbacks, Session API | Auth.js Route Handler |
| Auth Guard (`lib/auth/guard.ts`) | Session-Extraktion für Server Actions | Helper-Funktion `requireAuth()` |
| Server Actions (`app/actions/*.ts`) | Auth-Check + Ownership-Check + Business Logic | Bestehendes Pattern + Auth Guard |
| DB Queries (`lib/db/queries.ts`) | userId-Filter in allen Queries | Drizzle `where` clause |
| URL Validator (`lib/security/url-validator.ts`) | SSRF Prevention | Pure Function |
| Login Page (`app/login/page.tsx`) | Google Sign-In UI | Server Component + Client Form |
| Sidebar Auth (`components/sidebar.tsx`) | User-Info + Logout | Client Component |

### Data Flow

```
Browser → Middleware → Route?
                        ├── /login → Login Page → Google OAuth → Auth.js Callback → Session Cookie
                        ├── /api/auth/* → Auth.js Route Handler
                        └── /* (protected) → Server Component/Action
                                              → requireAuth() → userId
                                              → DB Query mit userId Filter
                                              → Response
```

### Error Handling Strategy

| Error Type | Handling | User Response | Logging |
|------------|----------|---------------|---------|
| Unauthenticated (Middleware) | 302 Redirect | → `/login` | -- |
| Unauthenticated (Server Action) | Return error | `{ error: "Unauthorized" }` | console.error |
| Not Allowed (Allowlist) | signIn returns false | Login Page + Fehlermeldung | console.warn |
| Not Found (Ownership) | Return error | `{ error: "Not found" }` | -- |
| OAuth Error | Auth.js error page | Login Page + Fehlermeldung | console.error |
| Invalid URL (SSRF) | Return error | `{ error: "Only HTTPS URLs allowed" }` | console.warn |

---

## Migration Map

| Existing File | Current Pattern | Target Pattern | Specific Changes |
|---|---|---|---|
| `lib/db/schema.ts` | 8 Tabellen ohne User-Bezug | +3 Auth.js Tabellen, +userId FK auf projects/favorite_models | `users`, `accounts`, `sessions` Tabellen hinzufügen; `userId` Spalte + FK auf `projects` und `favorite_models`; UNIQUE Constraint auf `favorite_models` ändern zu (userId, modelId) |
| `lib/db/queries.ts` | Queries ohne userId-Filter | Alle Queries mit userId-Parameter | Jede Query-Funktion bekommt `userId` Parameter; `where`-Clauses um `eq(table.userId, userId)` erweitert |
| `app/actions/projects.ts` | Keine Auth-Checks | requireAuth() + userId-Filter | `requireAuth()` am Anfang jeder Action; userId an Query-Funktionen durchreichen |
| `app/actions/generations.ts` | Keine Auth-Checks | requireAuth() + Ownership via projectId→userId | `requireAuth()` am Anfang; Project-Ownership prüfen vor Generation-Zugriff |
| `app/actions/references.ts` | Keine Auth-Checks | requireAuth() + Ownership via projectId→userId | `requireAuth()` am Anfang; Project-Ownership prüfen |
| `app/actions/prompts.ts` | Keine Auth-Checks | requireAuth() + Ownership via projectId→userId | `requireAuth()` am Anfang; Project-Ownership prüfen |
| `app/actions/models.ts` | Keine Auth-Checks, favoriteModels ohne User | requireAuth() + userId-Filter auf favoriteModels + Project-Ownership für selectedModels | `requireAuth()` am Anfang; userId-Filter für Favorites; Project-Ownership prüfen vor `getProjectSelectedModels` und `saveProjectSelectedModels` |
| `app/actions/upload.ts` | Keine Auth-Checks, keine URL-Validierung | requireAuth() + URL-Validator vor fetch() | `requireAuth()` am Anfang; `validateUrl()` vor `fetch(input.url)` |
| `app/layout.tsx` | ThemeProvider + ToastProvider | +SessionProvider wrapping | `SessionProvider` von `next-auth/react` um children wrappen |
| `components/sidebar.tsx` | SidebarFooter mit "Back to Overview" Link | +User-Info + Logout-Button im Footer | Session-Daten anzeigen (Avatar, Name, Email); signOut Button hinzufügen |
| `next.config.ts` | Keine Headers, kein standalone output | +Security Headers, +output: "standalone" | `headers()` Funktion mit CSP, HSTS, X-Frame-Options etc.; `output: "standalone"` für Docker |
| `docker-compose.yml` | Nur postgres, Port exposed | Dev-only, Port bleibt für Entwicklung | Kommentar: "Development only" |

### Neue Dateien

| New File | Purpose |
|----------|---------|
| `auth.ts` | Auth.js Konfiguration (Providers, Callbacks, Adapter) |
| `middleware.ts` | Route Protection |
| `app/api/auth/[...nextauth]/route.ts` | Auth.js Route Handler |
| `app/login/page.tsx` | Login Page UI |
| `lib/auth/guard.ts` | `requireAuth()` Helper |
| `lib/security/url-validator.ts` | SSRF Prevention |
| `drizzle/0007_auth_tables.sql` | Migration: Auth.js Tabellen |
| `drizzle/0008_add_user_id.sql` | Migration: userId auf projects/favorite_models |
| `docker-compose.prod.yml` | Production Compose (App + DB + Caddy) |
| `Dockerfile` | Multi-Stage Next.js Build |
| `Caddyfile` | Reverse Proxy + Auto-SSL Config |
| `.env.example` | Dokumentation aller Required Env-Vars |

---

## Constraints & Integrations

### Constraints

| Constraint | Technical Implication | Solution |
|------------|----------------------|----------|
| Email-Allowlist als Env-Var | Kein DB-Roundtrip beim Login, aber Restart bei Änderung nötig | `ALLOWED_EMAILS` kommasepariert, case-insensitive split+trim beim signIn Callback |
| Bestehende Daten migrieren | Projekte/Favorites haben kein userId | Migration-Script weist Default-User zu (erste Email aus Allowlist) |
| Auth.js v5 ist Beta | Potenzielle Breaking Changes | Version pinnen auf 5.0.0-beta.30, Lock-File committen |
| Next.js 16 Middleware | Middleware-Pattern ggf. abweichend von Docs | Testen mit Next.js 16.1.6 spezifisch |

### Integrations

| Area | System / Capability | Interface | Version | Notes |
|------|----------------------|-----------|---------|-------|
| Auth Framework | Auth.js (next-auth) | npm Package | 5.0.0-beta.30 | Beta, aber weit verbreitet für App Router |
| Auth DB Adapter | @auth/drizzle-adapter | npm Package | 1.11.1 | Offizielle Drizzle-Integration |
| OAuth Provider | Google Cloud OAuth 2.0 | OAuth 2.0 Protocol | -- | Requires Google Cloud Console Project |
| Reverse Proxy | Caddy Server | Docker Image | 2.11.2-alpine | Auto-SSL via Let's Encrypt, Alpine für minimale Image-Größe |
| Docker Base | node | Docker Image | 22.14.0-slim | Exakt gepinnt für reproduzierbare Builds |
| Existing: Drizzle ORM | drizzle-orm | npm Package | 0.45.1 | Bereits im Projekt |
| Existing: PostgreSQL | postgres:16 | Docker Image | 16 | Bereits im Projekt |
| Existing: Next.js | next | npm Package | 16.1.6 | Bereits im Projekt |

---

## Quality Attributes (NFRs)

### From Discovery → Technical Solution

| Attribute | Target | Technical Approach | Measure / Verify |
|-----------|--------|--------------------|------------------|
| Auth Latency | Login < 3s | OAuth Redirect + Session Cookie (kein DB-Lookup pro Request in Middleware) | Manuell testen |
| Session Expiry | Auto-Expire nach 30 Tagen | Auth.js Default Session-Maxage | Auth.js Config |
| SSRF Block | 100% private IPs blockiert | URL Validator mit IP-Range-Check | Unit Tests mit bekannten Private IPs |
| SSL | Auto-Renewal | Caddy Let's Encrypt Integration | `curl -I https://domain` |
| Docker Image Size | < 500MB | Multi-Stage Build, standalone output | `docker images` |

### Monitoring & Observability

| Metric | Type | Target | Alert |
|--------|------|--------|-------|
| Auth Errors | Counter (console.error) | < 10/Tag | Manuell (Logs prüfen) |
| SSRF Blocked | Counter (console.warn) | Any = suspicious | Manuell (Logs prüfen) |

---

## Risks & Assumptions

### Assumptions

| Assumption | Technical Validation | Impact if Wrong |
|------------|---------------------|-----------------|
| Auth.js v5 Beta ist stabil genug für Production | Weit verbreitet, >2 Jahre in Beta, aktive Maintenance | Fallback: Auth.js v4 (stable) mit Pages Router Adapter |
| Google OAuth bleibt kostenlos für <100 User | Google Cloud Free Tier | Kein Impact bei 1-5 Usern |
| Hetzner VPS hat Ports 80/443 offen | Standard bei Hetzner Cloud | Firewall-Rules anpassen |
| Bestehende Daten können einem User zugewiesen werden | Migration-Script mit Default-User | Manuelles SQL falls Migration fehlschlägt |

### Risks & Mitigation

| Risk | Likelihood | Impact | Technical Mitigation | Fallback |
|------|------------|--------|---------------------|----------|
| Auth.js v5 Breaking Change bei Update | Low | Medium | Version pinnen, Lock-File committen | Auf gepinnte Version bleiben |
| Google OAuth Credentials leaked | Low | High | Nur in .env, nie im Git, .env.example ohne echte Werte | Credentials in Google Console rotieren |
| Migration löscht Daten | Low | High | Migration in Transaktion, Backup vor Migration | Backup wiederherstellen |
| Caddy SSL Cert Renewal Fehler | Low | Medium | Caddy managed automatisch, Let's Encrypt Fallback zu ZeroSSL | Manuell Cert erneuern |
| SSRF Bypass via DNS Rebinding | Low | Medium | Hostname-Validierung vor fetch, kein Custom DNS Resolver | Einfache IP-Check reicht für 1-5 User Szenario |

---

## Technology Decisions

### Stack Choices

| Area | Technology | Rationale |
|------|------------|-----------|
| Auth | Auth.js v5 (next-auth@beta) | Beste Next.js App Router Integration, offizieller Drizzle Adapter, Google Provider built-in |
| Auth DB Adapter | @auth/drizzle-adapter | Projekt nutzt bereits Drizzle ORM, kein zusätzliches ORM nötig |
| Reverse Proxy | Caddy 2.11.2 | Auto-SSL ohne Konfiguration, einfachste Option für Single-VPS |
| Docker Build | Multi-Stage mit `output: "standalone"` | Minimale Image-Größe, Next.js Best Practice |
| Session Strategy | Database Sessions (nicht JWT) | Sofortiger Revoke möglich, Auth.js Default mit DB Adapter |

### Trade-offs

| Decision | Pro | Con | Mitigation |
|----------|-----|-----|------------|
| Auth.js v5 Beta statt v4 Stable | Native App Router Support, modernere API | Beta = potenzielle Breaking Changes | Version pinnen, Lock-File committen |
| Database Sessions statt JWT | Sofortiger Session-Revoke, kein Token-Leak-Risiko | DB-Lookup pro Auth-Check in Server Actions | Auth.js cached Sessions, minimaler Overhead |
| Email-Allowlist als Env-Var statt DB | Kein Admin-UI nötig, einfachste Lösung für 1-5 User | Restart bei Allowlist-Änderung nötig | Akzeptabel für 1-5 User, DB-Migration später möglich |
| Caddy statt Nginx/Traefik | Zero-Config SSL, einfachste Caddyfile | Weniger verbreitet als Nginx | Gut dokumentiert, aktive Community |
| userId nur auf projects + favorite_models | Minimaler Schema-Change, generations erben Ownership via project | Kein direkter User-Filter auf generations möglich | Ownership-Check immer über project.userId |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| -- | -- | -- | -- | Alle Fragen geklärt |

---

## Research Log

| Date | Area | Finding |
|------|------|---------|
| 2026-03-15 | npm Registry | next-auth latest=4.24.13, beta=5.0.0-beta.30, @auth/drizzle-adapter=1.11.1 |
| 2026-03-15 | Codebase | Next.js 16.1.6, Drizzle ORM 0.45.1, postgres-js 3.4.8, React 19.2.3 |
| 2026-03-15 | Codebase | 8 DB-Tabellen, alle UUID PKs mit gen_random_uuid(), Drizzle pgTable Pattern |
| 2026-03-15 | Codebase | Server Actions: "use server" + discriminated union returns `{ data } \| { error }` |
| 2026-03-15 | Codebase | Sidebar: Shadcn SidebarFooter vorhanden, perfekt für User-Info + Logout |
| 2026-03-15 | Codebase | DB Connection: Singleton postgres-js Client, MODULE_URL format conversion |
| 2026-03-15 | Codebase | 7 Drizzle Migrations in drizzle/ Ordner (0000-0006) |
| 2026-03-15 | Web | Auth.js v5: signIn Callback für Allowlist, auth() für Server Actions, middleware.ts für Route Protection |
| 2026-03-15 | Web | Caddy 2.11.2: Minimale Caddyfile für Reverse Proxy + Auto-SSL (3 Zeilen) |
| 2026-03-15 | Web | Next.js Security Headers: headers() in next.config.ts, CSP/HSTS/X-Frame-Options Pattern |
| 2026-03-15 | Web | Docker: Multi-Stage Build mit output: "standalone", node:slim Base, non-root User |

---

## Q&A Log

| # | Question | Answer |
|---|----------|--------|
| 1 | wireframes.md fehlt — zuerst Wireframes erstellen? | Nein, UI-Infos stehen in Discovery (Login Page + Sidebar). Zu simpel für Wireframes. |
