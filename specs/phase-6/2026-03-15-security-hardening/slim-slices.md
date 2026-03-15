# Slim Slice Decomposition

**Feature:** Security Hardening for Public Deployment
**Discovery-Slices:** 6 grobe Slices
**Atomare Slices:** 14 Slices
**Stack:** TypeScript (Next.js 16.1.6 App Router) + Python (Backend Service) | Drizzle ORM | Shadcn UI | vitest + playwright

---

## Dependency Graph

```
slice-01 (Auth.js Setup + Config)
    |
    v
slice-02 (Login Page UI)
    |
    v
slice-03 (Middleware + Route Protection)
    |
    v
slice-04 (DB Schema: Auth-Tabellen)
    |
    v
slice-05 (DB Schema: userId Migration)
    |
    v
slice-06 (Auth Guard Helper)
    |
    +---> slice-07 (Auth: projects.ts + queries.ts)
    |         |
    |         +---> slice-08 (Auth: generations.ts + references.ts)
    |         |
    |         +---> slice-09 (Auth: prompts.ts + models.ts + model-settings.ts)
    |
    +---> slice-10 (Auth: upload.ts + SSRF Fix)

slice-11 (Sidebar Auth: User-Info + Logout)  [nach slice-06]

slice-12 (Security Headers)  [unabhaengig]

slice-13 (Dockerfile + Production Compose)  [nach slice-12]
    |
    v
slice-14 (Caddy + .env.example)  [nach slice-13]
```

---

## Slice-Liste

### Slice 01: Auth.js Setup + Config

- **Scope:** Auth.js v5 installieren, Root-Config `auth.ts` erstellen mit Google OAuth Provider, Drizzle Adapter, signIn-Callback fuer Email-Allowlist, Session-Callbacks. SessionProvider in Layout einbinden.
- **Deliverables:**
  - `auth.ts` (NEU)
  - `app/api/auth/[...nextauth]/route.ts` (NEU)
  - `app/layout.tsx` (AENDERUNG: SessionProvider wrappen)
- **Done-Signal:** `npm run build` erfolgreich; `/api/auth/session` antwortet mit leerem Session-Objekt (200 OK)
- **Dependencies:** []
- **Discovery-Quelle:** Slice 1 "Auth Setup + Login Page"

---

### Slice 02: Login Page UI

- **Scope:** Login-Page mit Google Sign-In Button, Error-Handling (nicht autorisiert, OAuth-Fehler), App-Logo. Nutzt Auth.js `signIn("google")` Action.
- **Deliverables:**
  - `app/login/page.tsx` (NEU)
- **Done-Signal:** `/login` rendert; Google Sign-In Button sichtbar; Klick startet OAuth-Flow; Fehlermeldungen bei `?error=` Query-Params sichtbar
- **Dependencies:** ["slice-01"]
- **Discovery-Quelle:** Slice 1 "Auth Setup + Login Page"

---

### Slice 03: Middleware + Route Protection

- **Scope:** Next.js Middleware erstellen, die alle Routen ausser `/login`, `/api/auth/*`, `/_next/*`, `/favicon.ico` schuetzt. Unauthentifizierte Requests werden zu `/login` redirected.
- **Deliverables:**
  - `middleware.ts` (NEU)
- **Done-Signal:** Unauthentifizierter Zugriff auf `/` resultiert in Redirect zu `/login`; Zugriff auf `/login` funktioniert ohne Auth; `/api/auth/*` ist erreichbar ohne Auth
- **Dependencies:** ["slice-02"]
- **Discovery-Quelle:** Slice 1 "Auth Setup + Login Page"

---

### Slice 04: DB Schema - Auth.js Tabellen

- **Scope:** `users`, `accounts`, `sessions` Tabellen in Drizzle-Schema definieren (Auth.js Adapter Format). Drizzle-Migration generieren.
- **Deliverables:**
  - `lib/db/schema.ts` (AENDERUNG: +users, +accounts, +sessions Tabellen)
  - `drizzle/0008_auth_tables.sql` (NEU)
- **Done-Signal:** `npx drizzle-kit generate` erfolgreich; `npx drizzle-kit push` erstellt Tabellen in DB; Auth.js Login-Flow speichert User in DB
- **Dependencies:** ["slice-03"]
- **Discovery-Quelle:** Slice 2 "DB Migration + User-Isolation"

---

### Slice 05: DB Schema - userId Migration

- **Scope:** `userId` FK-Spalte auf `projects` und `favorite_models` hinzufuegen. Migration-Script: Default-User aus erster ALLOWED_EMAILS erstellen, bestehende Daten zuweisen, NOT NULL setzen. UNIQUE Constraint auf `favorite_models` aendern zu `(userId, modelId)`.
- **Deliverables:**
  - `lib/db/schema.ts` (AENDERUNG: +userId auf projects, +userId auf favorite_models, UNIQUE aendern)
  - `drizzle/0009_add_user_id.sql` (NEU)
- **Done-Signal:** Migration laeuft ohne Fehler; bestehende Projekte haben userId des Default-Users; `projects.userId` ist NOT NULL; `favorite_models` hat UNIQUE(userId, modelId)
- **Dependencies:** ["slice-04"]
- **Discovery-Quelle:** Slice 2 "DB Migration + User-Isolation"

---

### Slice 06: Auth Guard Helper

- **Scope:** `requireAuth()` Helper-Funktion erstellen, die Session via `auth()` prueft und `{ userId, email }` oder `{ error: "Unauthorized" }` zurueckgibt. Wiederverwendbar fuer alle Server Actions.
- **Deliverables:**
  - `lib/auth/guard.ts` (NEU)
- **Done-Signal:** Unit-Test: `requireAuth()` gibt userId zurueck bei guelter Session; gibt `{ error: "Unauthorized" }` bei fehlender Session
- **Dependencies:** ["slice-05"]
- **Discovery-Quelle:** Slice 3 "Server Action Authorization"

---

### Slice 07: Server Action Auth - Projects + Queries

- **Scope:** `requireAuth()` in alle Server Actions in `projects.ts` einbauen (createProject, getProjects, getProject, renameProject, deleteProject, generateThumbnail). `queries.ts` um userId-Parameter erweitern: alle Project-Queries filtern nach `userId`.
- **Deliverables:**
  - `app/actions/projects.ts` (AENDERUNG)
  - `lib/db/queries.ts` (AENDERUNG)
- **Done-Signal:** Alle Project-Actions geben `{ error: "Unauthorized" }` ohne Session; User sieht nur eigene Projekte; Zugriff auf fremdes Projekt gibt `{ error: "Not found" }`
- **Dependencies:** ["slice-06"]
- **Discovery-Quelle:** Slice 3 "Server Action Authorization"

---

### Slice 08: Server Action Auth - Generations + References

- **Scope:** `requireAuth()` in alle Server Actions in `generations.ts` einbauen (generateImages, retryGeneration, fetchGenerations, upscaleImage, deleteGeneration, getSiblingGenerations, getVariantFamilyAction). `references.ts` Auth einbauen (uploadReferenceImage, deleteReferenceImage, addGalleryAsReference, getReferenceCount, getProvenanceData). Ownership via Project-Zugehoerigkeit pruefen.
- **Deliverables:**
  - `app/actions/generations.ts` (AENDERUNG)
  - `app/actions/references.ts` (AENDERUNG)
- **Done-Signal:** Alle Generation/Reference-Actions geben `{ error: "Unauthorized" }` ohne Session; Zugriff auf Generierungen eines fremden Projekts gibt `{ error: "Not found" }`
- **Dependencies:** ["slice-07"]
- **Discovery-Quelle:** Slice 3 "Server Action Authorization"

---

### Slice 09: Server Action Auth - Prompts + Models + Model-Settings

- **Scope:** `requireAuth()` in alle Server Actions in `prompts.ts` einbauen (getPromptHistory, getFavoritePrompts, toggleFavorite, improvePrompt). `models.ts` Auth einbauen (getCollectionModels, checkImg2ImgSupport, getModelSchema + userId-Filter fuer Favorites/SelectedModels). `model-settings.ts` Auth einbauen (getModelSettings, updateModelSetting).
- **Deliverables:**
  - `app/actions/prompts.ts` (AENDERUNG)
  - `app/actions/models.ts` (AENDERUNG)
  - `app/actions/model-settings.ts` (AENDERUNG)
- **Done-Signal:** Alle Prompt/Model/ModelSetting-Actions geben `{ error: "Unauthorized" }` ohne Session; Favorite-Models sind User-isoliert
- **Dependencies:** ["slice-07"]
- **Discovery-Quelle:** Slice 3 "Server Action Authorization"

---

### Slice 10: Server Action Auth - Upload + SSRF Fix

- **Scope:** `requireAuth()` in `upload.ts` einbauen. URL-Validator erstellen (`lib/security/url-validator.ts`) mit HTTPS-only Check, Private-IP-Range Blocklist (127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x, localhost, ::1). Validator vor `fetch()` in `uploadSourceImage` aufrufen.
- **Deliverables:**
  - `lib/security/url-validator.ts` (NEU)
  - `app/actions/upload.ts` (AENDERUNG)
- **Done-Signal:** Unit-Tests: `http://evil.com` rejected; `file:///etc/passwd` rejected; `https://169.254.169.254/metadata` rejected; `https://valid-host.com/img.png` accepted; Upload-Action gibt `{ error: "Unauthorized" }` ohne Session
- **Dependencies:** ["slice-06"]
- **Discovery-Quelle:** Slice 4 "SSRF Fix" + Slice 3 "Server Action Authorization"

---

### Slice 11: Sidebar Auth - User-Info + Logout

- **Scope:** Bestehende Sidebar erweitern: User-Info im SidebarFooter (Google Avatar 32x32 rund, Display Name, Email). Logout-Button der `signOut()` aufruft und zu `/login` redirected.
- **Deliverables:**
  - `components/sidebar.tsx` (AENDERUNG)
- **Done-Signal:** Eingeloggt: Avatar, Name, Email sichtbar im Sidebar-Footer; Logout-Button klickbar; nach Logout Redirect zu `/login`
- **Dependencies:** ["slice-06"]
- **Discovery-Quelle:** Slice 1 "Auth Setup + Login Page"

---

### Slice 12: Security Headers

- **Scope:** `next.config.ts` um `headers()` Funktion erweitern: Content-Security-Policy, X-Frame-Options (DENY), X-Content-Type-Options (nosniff), Referrer-Policy (strict-origin-when-cross-origin), Strict-Transport-Security (max-age=31536000; includeSubDomains).
- **Deliverables:**
  - `next.config.ts` (AENDERUNG)
- **Done-Signal:** `curl -I http://localhost:3000` zeigt alle 5 Security Headers; `npm run build` erfolgreich
- **Dependencies:** []
- **Discovery-Quelle:** Slice 5 "Security Headers"

---

### Slice 13: Dockerfile + Production Docker Compose

- **Scope:** Multi-Stage Dockerfile fuer Next.js App (node:22.14.0-slim, standalone output). Production `docker-compose.prod.yml` mit App-Service + DB-Service (private network, starke Credentials via .env, kein exposed DB-Port).
- **Deliverables:**
  - `Dockerfile` (NEU)
  - `docker-compose.prod.yml` (NEU)
  - `next.config.ts` (AENDERUNG: `output: "standalone"`)
- **Done-Signal:** `docker compose -f docker-compose.prod.yml build` erfolgreich; Image-Groesse < 500MB; `docker compose -f docker-compose.prod.yml up` startet App + DB; App erreichbar auf konfiguriertem Port
- **Dependencies:** ["slice-12"]
- **Discovery-Quelle:** Slice 6 "Docker + Deployment"

---

### Slice 14: Caddy Reverse Proxy + .env.example

- **Scope:** Caddyfile mit Reverse-Proxy zu App-Container + automatischem SSL via Let's Encrypt. Caddy-Service in `docker-compose.prod.yml` ergaenzen. `.env.example` mit allen Required Env-Vars dokumentiert.
- **Deliverables:**
  - `Caddyfile` (NEU)
  - `docker-compose.prod.yml` (AENDERUNG: +caddy Service)
  - `.env.example` (NEU)
- **Done-Signal:** `docker compose -f docker-compose.prod.yml up` startet App + DB + Caddy; Caddy leitet Requests an App weiter; `.env.example` listet alle Required Vars (AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, ALLOWED_EMAILS, DATABASE_URL, DOMAIN)
- **Dependencies:** ["slice-13"]
- **Discovery-Quelle:** Slice 6 "Docker + Deployment"

---

## Qualitaets-Checkliste

- [x] Jeder Slice hat maximal 3 produktive Deliverable-Dateien
- [x] Jeder Slice hat ein messbares Done-Signal
- [x] Dependencies sind azyklisch (DAG)
- [x] Alle Deliverables aus der Discovery sind abgedeckt (nichts vergessen)
- [x] Kein Slice hat mehr als ein Concern (DB+UI = zu viel)
- [x] Schema/Service-Slices kommen vor UI-Slices
- [x] Stack ist korrekt erkannt und dokumentiert

---

## Coverage-Matrix

| Discovery-Slice | Abgedeckt durch Slim-Slices |
|---|---|
| Slice 1: Auth Setup + Login Page | 01, 02, 03, 11 |
| Slice 2: DB Migration + User-Isolation | 04, 05 |
| Slice 3: Server Action Authorization | 06, 07, 08, 09 |
| Slice 4: SSRF Fix | 10 |
| Slice 5: Security Headers | 12 |
| Slice 6: Docker + Deployment | 13, 14 |

### Neue Dateien (vollstaendig)

| Datei | Slice |
|---|---|
| `auth.ts` | 01 |
| `app/api/auth/[...nextauth]/route.ts` | 01 |
| `app/login/page.tsx` | 02 |
| `middleware.ts` | 03 |
| `drizzle/0008_auth_tables.sql` | 04 |
| `drizzle/0009_add_user_id.sql` | 05 |
| `lib/auth/guard.ts` | 06 |
| `lib/security/url-validator.ts` | 10 |
| `Dockerfile` | 13 |
| `docker-compose.prod.yml` | 13 + 14 |
| `Caddyfile` | 14 |
| `.env.example` | 14 |

### Geaenderte Dateien (vollstaendig)

| Datei | Slice(s) |
|---|---|
| `app/layout.tsx` | 01 |
| `lib/db/schema.ts` | 04, 05 |
| `lib/db/queries.ts` | 07 |
| `app/actions/projects.ts` | 07 |
| `app/actions/generations.ts` | 08 |
| `app/actions/references.ts` | 08 |
| `app/actions/prompts.ts` | 09 |
| `app/actions/models.ts` | 09 |
| `app/actions/model-settings.ts` | 09 |
| `app/actions/upload.ts` | 10 |
| `components/sidebar.tsx` | 11 |
| `next.config.ts` | 12, 13 |
