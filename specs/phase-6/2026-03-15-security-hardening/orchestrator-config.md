# Orchestrator Configuration: Security Hardening for Public Deployment

**Integration Map:** `integration-map.md`
**E2E Checklist:** `e2e-checklist.md`
**Generated:** 2026-03-15

---

## Pre-Implementation Gates

```yaml
pre_checks:
  - name: "Gate 1: Architecture Compliance"
    file: "compliance-architecture.md"
    required: "Verdict == APPROVED"

  - name: "Gate 2: All Slices Approved"
    files: "slices/compliance-slice-*.md"
    required: "ALL Verdict == APPROVED"
    count: 14

  - name: "Gate 3: Integration Map Valid"
    file: "integration-map.md"
    required: "Missing Inputs == 0, Orphaned Outputs == 0, Deliverable-Consumer Gaps == 0, Runtime Path Gaps == 0"
```

---

## Implementation Order

Based on dependency analysis, slices form two independent chains that can be parallelized:

**Chain A: Auth + Server Actions (Slices 01-11)**
**Chain B: Infrastructure (Slices 12-14)**

| Order | Slice | Name | Depends On | Parallel? |
|-------|-------|------|------------|-----------|
| 1 | 01 | Auth.js Setup + Config | -- | Yes, with Slice 12 |
| 1 | 12 | Security Headers | -- | Yes, with Slice 01 |
| 2 | 02 | Login Page UI | Slice 01 | No |
| 2 | 13 | Dockerfile + Compose | Slice 12 | Yes, with Slice 02 |
| 3 | 03 | Middleware + Route Protection | Slice 02 | No |
| 3 | 14 | Caddy + .env.example | Slice 13 | Yes, with Slice 03 |
| 4 | 04 | DB Auth Tables | Slice 03 | No |
| 5 | 05 | DB userId Migration | Slice 04 | No |
| 6 | 06 | Auth Guard Helper | Slice 05 | No |
| 7 | 07 | Auth Projects + Queries | Slice 06 | No |
| 8 | 08 | Auth Generations + References | Slice 07 | Yes, with Slice 09, 10, 11 |
| 8 | 09 | Auth Prompts + Models | Slice 07 | Yes, with Slice 08, 10, 11 |
| 8 | 10 | Auth Upload + SSRF | Slice 06 | Yes, with Slice 08, 09, 11 |
| 8 | 11 | Sidebar Auth | Slice 06 | Yes, with Slice 08, 09, 10 |

**Critical Path:** Slice 01 -> 02 -> 03 -> 04 -> 05 -> 06 -> 07 -> 08/09 (longest chain = 9 slices)

**Parallel Groups:**

- **Group 1 (independent starts):** Slice 01 + Slice 12
- **Group 2 (after Group 1):** Slice 02 + Slice 13
- **Group 3 (after Group 2):** Slice 03 + Slice 14
- **Group 4-7 (sequential):** Slices 04, 05, 06, 07
- **Group 8 (after Slice 07 + Slice 06):** Slices 08, 09, 10, 11 (all parallel)

---

## Slice Execution Details

### Slice 01: Auth.js Setup + Config

```yaml
id: slice-01-auth-setup
spec: slices/slice-01-auth-setup.md
dependencies: []
test_command: "pnpm vitest run __tests__/slice-01"
integration_command: "pnpm run build"
acceptance_command: 'curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/auth/session'
deliverables:
  - auth.ts
  - app/api/auth/[...nextauth]/route.ts
  - app/layout.tsx  # MODIFY: add SessionProvider
```

### Slice 02: Login Page UI

```yaml
id: slice-02-login-page
spec: slices/slice-02-login-page.md
dependencies: [slice-01-auth-setup]
test_command: "pnpm vitest run __tests__/slice-02"
integration_command: "pnpm run build"
acceptance_command: 'curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login'
deliverables:
  - app/login/page.tsx
```

### Slice 03: Middleware + Route Protection

```yaml
id: slice-03-middleware
spec: slices/slice-03-middleware.md
dependencies: [slice-02-login-page]
test_command: "pnpm vitest run __tests__/slice-03"
integration_command: "pnpm run build"
acceptance_command: 'curl -s -o /dev/null -w "%{http_code}" -L http://localhost:3000/'
deliverables:
  - middleware.ts
```

### Slice 04: DB Auth Tables

```yaml
id: slice-04-db-auth-tables
spec: slices/slice-04-db-auth-tables.md
dependencies: [slice-03-middleware]
test_command: "pnpm vitest run __tests__/slice-04"
integration_command: "npx drizzle-kit generate"
acceptance_command: "npx drizzle-kit push"
deliverables:
  - lib/db/schema.ts  # MODIFY: add users, accounts, sessions tables
  - drizzle/0008_auth_tables.sql
```

### Slice 05: DB userId Migration

```yaml
id: slice-05-db-userid-migration
spec: slices/slice-05-db-userid-migration.md
dependencies: [slice-04-db-auth-tables]
test_command: "pnpm vitest run __tests__/slice-05"
integration_command: "npx drizzle-kit generate"
acceptance_command: "npx drizzle-kit push"
deliverables:
  - lib/db/schema.ts  # MODIFY: add userId to projects and favoriteModels
  - drizzle/0009_add_user_id.sql
```

### Slice 06: Auth Guard Helper

```yaml
id: slice-06-auth-guard
spec: slices/slice-06-auth-guard.md
dependencies: [slice-05-db-userid-migration]
test_command: "pnpm vitest run __tests__/slice-06"
integration_command: "pnpm run build"
acceptance_command: "pnpm vitest run __tests__/slice-06"
deliverables:
  - lib/auth/guard.ts
```

### Slice 07: Auth Projects + Queries

```yaml
id: slice-07-auth-projects
spec: slices/slice-07-auth-projects.md
dependencies: [slice-06-auth-guard]
test_command: "pnpm vitest run __tests__/slice-07"
integration_command: "pnpm run build"
acceptance_command: "pnpm vitest run __tests__/slice-07"
deliverables:
  - app/actions/projects.ts  # MODIFY: add requireAuth() + userId to all 6 actions
  - lib/db/queries.ts  # MODIFY: add userId parameter to 5 project queries
```

### Slice 08: Auth Generations + References

```yaml
id: slice-08-auth-generations-refs
spec: slices/slice-08-auth-generations-refs.md
dependencies: [slice-07-auth-projects]
test_command: "pnpm vitest run __tests__/slice-08"
integration_command: "pnpm run build"
acceptance_command: "pnpm vitest run __tests__/slice-08"
deliverables:
  - app/actions/generations.ts  # MODIFY: add requireAuth() + ownership to 7 actions
  - app/actions/references.ts  # MODIFY: add requireAuth() + ownership to 5 actions
```

### Slice 09: Auth Prompts + Models

```yaml
id: slice-09-auth-prompts-models
spec: slices/slice-09-auth-prompts-models.md
dependencies: [slice-07-auth-projects]
test_command: "pnpm vitest run __tests__/slice-09"
integration_command: "pnpm run build"
acceptance_command: "pnpm vitest run __tests__/slice-09"
deliverables:
  - app/actions/prompts.ts  # MODIFY: add requireAuth() to 4 actions
  - app/actions/models.ts  # MODIFY: add requireAuth() to 3 actions
  - app/actions/model-settings.ts  # MODIFY: add requireAuth() to 2 actions
```

### Slice 10: Auth Upload + SSRF

```yaml
id: slice-10-auth-upload-ssrf
spec: slices/slice-10-auth-upload-ssrf.md
dependencies: [slice-06-auth-guard]
test_command: "pnpm vitest run __tests__/slice-10"
integration_command: "pnpm run build"
acceptance_command: "pnpm vitest run __tests__/slice-10"
deliverables:
  - lib/security/url-validator.ts
  - app/actions/upload.ts  # MODIFY: add requireAuth() + validateUrl()
```

### Slice 11: Sidebar Auth

```yaml
id: slice-11-sidebar-auth
spec: slices/slice-11-sidebar-auth.md
dependencies: [slice-06-auth-guard]
test_command: "pnpm vitest run __tests__/slice-11"
integration_command: "pnpm run build"
acceptance_command: "pnpm vitest run __tests__/slice-11"
deliverables:
  - components/sidebar.tsx  # MODIFY: add User-Info + Logout in SidebarFooter
```

### Slice 12: Security Headers

```yaml
id: slice-12-security-headers
spec: slices/slice-12-security-headers.md
dependencies: []
test_command: "pnpm test __tests__/config/security-headers"
integration_command: "pnpm build"
acceptance_command: 'curl -sI http://localhost:3000 | grep -iE "(content-security-policy|x-frame-options|x-content-type-options|referrer-policy|strict-transport-security)"'
deliverables:
  - next.config.ts  # MODIFY: add headers() function
```

### Slice 13: Dockerfile + Compose

```yaml
id: slice-13-dockerfile-compose
spec: slices/slice-13-dockerfile-compose.md
dependencies: [slice-12-security-headers]
test_command: "pnpm test __tests__/docker/dockerfile-compose"
integration_command: "docker compose -f docker-compose.prod.yml build"
acceptance_command: "docker compose -f docker-compose.prod.yml up -d && sleep 10 && curl -sf http://localhost:3000 && docker compose -f docker-compose.prod.yml down"
deliverables:
  - Dockerfile
  - docker-compose.prod.yml
  - next.config.ts  # MODIFY: add output: "standalone"
```

### Slice 14: Caddy + .env.example

```yaml
id: slice-14-caddy-env
spec: slices/slice-14-caddy-env.md
dependencies: [slice-13-dockerfile-compose]
test_command: "pnpm test __tests__/docker/caddy-env"
integration_command: "docker compose -f docker-compose.prod.yml config --quiet"
acceptance_command: "docker compose -f docker-compose.prod.yml up -d && sleep 15 && curl -sf http://localhost:80 && docker compose -f docker-compose.prod.yml down"
deliverables:
  - Caddyfile
  - docker-compose.prod.yml  # MODIFY: add caddy service
  - .env.example
```

---

## Post-Slice Validation

FOR each completed slice:

```yaml
validation_steps:
  - step: "Deliverables Check"
    action: "Verify all files listed in DELIVERABLES_START..DELIVERABLES_END exist"
    method: "Check file existence on disk for each deliverable path"

  - step: "Unit Tests"
    action: "Run slice-specific test command"
    method: "Execute test_command from slice metadata"
    pass_criteria: "All tests pass (exit code 0)"

  - step: "Integration Build"
    action: "Run integration_command from slice"
    method: "Execute integration_command (usually pnpm build or drizzle-kit)"
    pass_criteria: "Build succeeds (exit code 0)"

  - step: "Integration Points"
    action: "Verify outputs are accessible by dependent slices"
    reference: "integration-map.md -> Connections table"
    method: "Check that exported functions/types/components exist and have correct signatures"
```

---

## E2E Validation

AFTER all slices completed:

```yaml
e2e_validation:
  - step: "Execute e2e-checklist.md"
    action: "Go through every checkbox in e2e-checklist.md"
    method: "Manual testing or automated E2E test runner"

  - step: "FOR each failing check"
    actions:
      - "Identify responsible slice from Integration Map (Slice column in checklist)"
      - "Create fix task referencing the specific AC in the slice spec"
      - "Re-run affected slice tests after fix"
      - "Re-verify the failing E2E check"

  - step: "Cross-Slice Integration Verification"
    action: "Verify all 12 integration points from e2e-checklist.md"
    method: "Test each connection from the Cross-Slice Integration Points table"

  - step: "Security Headers Verification"
    action: "curl -sI http://localhost:3000 and verify all 5 security headers"

  - step: "Docker Production Deployment Verification"
    action: "docker compose -f docker-compose.prod.yml up -d and verify all services"

  - step: "Final Approval"
    condition: "ALL checks in e2e-checklist.md PASS"
    output: "Feature READY for merge"
```

---

## Shared File Modification Sequence

Multiple slices modify the same files. The orchestrator MUST enforce this sequence:

### `lib/db/schema.ts`

| Order | Slice | Change |
|-------|-------|--------|
| 1 | Slice 04 | Add users, accounts, sessions tables |
| 2 | Slice 05 | Add userId column to projects and favoriteModels |

### `next.config.ts`

| Order | Slice | Change |
|-------|-------|--------|
| 1 | Slice 12 | Add headers() function |
| 2 | Slice 13 | Add output: "standalone" |

### `docker-compose.prod.yml`

| Order | Slice | Change |
|-------|-------|--------|
| 1 | Slice 13 | Create file with app + db services |
| 2 | Slice 14 | Add caddy service, volumes, remove app port exposure |

---

## Rollback Strategy

IF implementation fails:

```yaml
rollback:
  - condition: "Slice N fails unit tests"
    action: "Revert Slice N changes only (git checkout for deliverable files)"
    note: "Dependencies are stable -- earlier slices remain valid"

  - condition: "Slice N fails integration build"
    action: "Check for type mismatches with upstream slice outputs"
    note: "May indicate contract violation -- re-read upstream slice spec"

  - condition: "DB Migration fails (Slice 04 or 05)"
    action: "Drop new tables/columns manually, re-run migration"
    note: "Backup database before running migrations"

  - condition: "Docker build fails (Slice 13)"
    action: "Check Dockerfile syntax, verify output:standalone in next.config.ts"
    note: "App code changes are independent of Docker config"

  - condition: "Integration fails across slices"
    action: "Review integration-map.md for the specific connection that fails"
    note: "Identify which slice's output does not match the consumer's expected interface"

  - condition: "E2E flow fails"
    action: "Trace the runtime path from integration-map.md to find the break point"
    note: "Use the Runtime Path Analysis section to identify missing links"
```

---

## Monitoring

During implementation:

| Metric | Alert Threshold |
|--------|-----------------|
| Slice completion time | > 2x estimate |
| Test failures per slice | > 0 blocking |
| Deliverable missing after slice completion | Any |
| Integration build failure | Any |
| Type mismatch between slices | Any |
| DB migration failure | Any |

---

## Notes

- Slice 11 has a metadata dependency on Slice 06 (auth-guard) that is an ordering constraint only. Functionally, Slice 11 depends on Slice 01 (SessionProvider, signOut). This does not affect implementation order since Slice 06 completes before Slice 11 in all valid orderings.
- The `users.createdAt` field from Discovery was deliberately omitted in Architecture (Auth.js Adapter schema does not include it). This is accepted and documented.
- Migration file numbering: Slice 04 uses 0008 (after existing 0007), Slice 05 uses 0009. This matches the existing 8 migrations (0000-0007) in the drizzle/ directory.
