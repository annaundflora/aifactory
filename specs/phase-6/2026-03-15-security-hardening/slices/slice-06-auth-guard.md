# Slice 06: Auth Guard Helper

> **Slice 6 von 14** fuer `Security Hardening for Public Deployment`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-06-auth-guard` |
| **Test** | `pnpm vitest run __tests__/slice-06` |
| **E2E** | `false` |
| **Dependencies** | `["slice-05-db-userid-migration"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm vitest run __tests__/slice-06` |
| **Integration Command** | `pnpm run build` |
| **Acceptance Command** | `pnpm vitest run __tests__/slice-06` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/api/auth/session` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Eine wiederverwendbare `requireAuth()` Helper-Funktion erstellen, die in allen Server Actions als erste Zeile aufgerufen wird. Sie prueft die Session via `auth()` und gibt entweder `{ userId, email }` bei gueltiger Session oder `{ error: "Unauthorized" }` bei fehlender/ungueltiger Session zurueck.

---

## Acceptance Criteria

1) GIVEN kein User ist eingeloggt (keine gueltige Session)
   WHEN `requireAuth()` aufgerufen wird
   THEN gibt die Funktion `{ error: "Unauthorized" }` zurueck

2) GIVEN ein User ist eingeloggt mit gueltiger Session (auth() gibt Session mit user.id und user.email zurueck)
   WHEN `requireAuth()` aufgerufen wird
   THEN gibt die Funktion `{ userId: string, email: string }` zurueck, wobei userId === session.user.id und email === session.user.email

3) GIVEN auth() gibt eine Session zurueck bei der user.id fehlt (undefined/null)
   WHEN `requireAuth()` aufgerufen wird
   THEN gibt die Funktion `{ error: "Unauthorized" }` zurueck (defensive Validierung)

4) GIVEN auth() gibt eine Session zurueck bei der user.email fehlt (undefined/null)
   WHEN `requireAuth()` aufgerufen wird
   THEN gibt die Funktion `{ error: "Unauthorized" }` zurueck (defensive Validierung)

5) GIVEN `requireAuth()` ist exportiert aus `lib/auth/guard.ts`
   WHEN `pnpm run build` ausgefuehrt wird
   THEN ist der Build erfolgreich ohne TypeScript-Fehler

6) GIVEN der Return-Type von `requireAuth()` ist ein Discriminated Union
   WHEN das Ergebnis geprueft wird
   THEN ist es entweder `{ userId: string; email: string }` (Erfolg, KEIN error-Property) oder `{ error: string }` (Fehler, KEIN userId/email-Property) -- konsistent mit dem bestehenden Server Action Error-Pattern

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `__tests__/slice-06/auth-guard.test.ts`

<test_spec>
```typescript
// AC-1: Keine Session vorhanden
it.todo('should return { error: "Unauthorized" } when no session exists')

// AC-2: Gueltige Session mit userId und email
it.todo('should return { userId, email } when valid session exists')

// AC-3: Session ohne user.id
it.todo('should return { error: "Unauthorized" } when session.user.id is missing')

// AC-4: Session ohne user.email
it.todo('should return { error: "Unauthorized" } when session.user.email is missing')

// AC-5: Build-Kompatibilitaet
it.todo('should export requireAuth as named export from lib/auth/guard.ts')

// AC-6: Discriminated Union Type
it.todo('should return discriminated union without overlapping properties')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-auth-setup` | `auth()` | Function | `() => Promise<Session \| null>` aus `auth.ts` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `requireAuth()` | Function | slice-07, slice-08, slice-09, slice-10, slice-11 | `() => Promise<{ userId: string; email: string } \| { error: string }>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/auth/guard.ts` -- NEU: requireAuth() Helper mit Session-Check via auth(), Discriminated Union Return
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Einbau von requireAuth() in Server Actions (das sind Slices 07-10)
- KEINE Ownership-Checks (project.userId Validierung ist Slice 07+)
- KEINE Aenderungen an auth.ts oder anderen Auth-Dateien
- KEINE Aenderungen am DB-Schema
- KEINE Middleware-Aenderungen

**Technische Constraints:**
- `auth()` Import aus Root-Level `auth.ts` (Slice 01 Deliverable)
- Return-Type als Discriminated Union -- konsistent mit bestehendem Server Action Pattern `{ data } | { error }`
- Funktion ist `async` (auth() ist async)
- Kein Logging bei fehlender Session (kein console.error) -- das ist normaler Flow wenn Middleware nicht greift

**Referenzen:**
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Server Logic" (Auth Guard Pattern)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Architecture Layers" (Auth Guard Layer)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Error Handling Strategy" (Unauthenticated Server Action)
