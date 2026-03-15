# Slice 11: Sidebar Auth - User-Info + Logout

> **Slice 11 von 14** fuer `Security Hardening for Public Deployment`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-11-sidebar-auth` |
| **Test** | `pnpm vitest run __tests__/slice-11` |
| **E2E** | `false` |
| **Dependencies** | `["slice-06-auth-guard"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm vitest run __tests__/slice-11` |
| **Integration Command** | `pnpm run build` |
| **Acceptance Command** | `pnpm vitest run __tests__/slice-11` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/api/auth/session` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Die bestehende Sidebar-Komponente um User-Informationen (Google Avatar, Display Name, Email) und einen Logout-Button im SidebarFooter erweitern. Nach Logout wird der User zu `/login` redirected.

---

## Acceptance Criteria

1) GIVEN ein User ist eingeloggt mit einer gueltigen Session (useSession liefert `session.user`)
   WHEN die Sidebar gerendert wird
   THEN wird im SidebarFooter das Google-Profilbild als Avatar angezeigt (32x32px, rund via `rounded-full`)

2) GIVEN ein User ist eingeloggt mit `session.user.name = "Max Mustermann"` und `session.user.email = "max@example.com"`
   WHEN die Sidebar gerendert wird
   THEN wird im SidebarFooter der Display Name "Max Mustermann" und die Email "max@example.com" als Text angezeigt

3) GIVEN ein User ist eingeloggt aber `session.user.image` ist `null` oder `undefined`
   WHEN die Sidebar gerendert wird
   THEN wird ein Fallback-Avatar angezeigt (z.B. Initialen oder generisches User-Icon) statt eines gebrochenen Bild-Elements

4) GIVEN ein User ist eingeloggt aber `session.user.name` ist `null` oder `undefined`
   WHEN die Sidebar gerendert wird
   THEN wird die Email-Adresse als Fallback fuer den Display Name angezeigt

5) GIVEN ein User ist eingeloggt und sieht den SidebarFooter
   WHEN der User auf den Logout-Button klickt
   THEN wird `signOut()` von `next-auth/react` aufgerufen mit `{ callbackUrl: "/login" }`

6) GIVEN die Session via `useSession()` den Status `"loading"` hat
   WHEN die Sidebar gerendert wird
   THEN wird kein User-Info-Bereich im Footer angezeigt (keine Skeleton-Flicker, kein leerer Bereich)

7) GIVEN die Sidebar im collapsed/icon-Modus ist (`collapsible="icon"`)
   WHEN die Sidebar gerendert wird
   THEN sind Name, Email und Logout-Text ausgeblendet und nur der Avatar sichtbar (konsistent mit bestehendem `group-data-[collapsible=icon]:hidden` Pattern)

8) GIVEN die User-Info wird im SidebarFooter angezeigt
   WHEN die bestehende "Back to Overview"-Funktionalitaet geprueft wird
   THEN ist der "Back to Overview"-Link weiterhin vorhanden und funktional (keine Regression)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `__tests__/slice-11/sidebar-auth.test.tsx`

<test_spec>
```typescript
// AC-1: Avatar-Anzeige mit Google-Profilbild
it.todo('should render user avatar as 32x32 rounded image when session has user.image')

// AC-2: Display Name und Email
it.todo('should render user name and email in SidebarFooter when session is authenticated')

// AC-3: Fallback-Avatar bei fehlendem Bild
it.todo('should render fallback avatar when session.user.image is null')

// AC-4: Email als Fallback fuer fehlenden Namen
it.todo('should render email as display name when session.user.name is null')

// AC-5: Logout-Button ruft signOut auf
it.todo('should call signOut with callbackUrl /login when logout button is clicked')

// AC-6: Loading-State ohne User-Info
it.todo('should not render user info section when session status is loading')

// AC-7: Collapsed-Modus zeigt nur Avatar
it.todo('should hide name, email, and logout text in collapsed icon mode')

// AC-8: Back to Overview Link bleibt erhalten
it.todo('should still render Back to Overview link in SidebarFooter')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-auth-setup` | `SessionProvider` | Component | Wrappt Layout, stellt `useSession()` bereit |
| `slice-01-auth-setup` | `signOut()` | Function | `next-auth/react` Export, via SessionProvider verfuegbar |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| User-Info im Sidebar-Footer | UI Component | -- (kein Downstream-Consumer) | Visuell: Avatar + Name + Email + Logout |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/sidebar.tsx` -- AENDERUNG: User-Info (Avatar, Name, Email) + Logout-Button im SidebarFooter, useSession()-Integration
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an der Auth-Config (`auth.ts`)
- KEINE Aenderungen an der Middleware oder Route Protection
- KEINE neuen Server Actions oder API-Routes
- KEIN Einbau von `requireAuth()` in bestehende Actions (das sind Slices 07-10)
- KEINE Aenderungen am SidebarHeader oder SidebarContent (nur SidebarFooter)

**Technische Constraints:**
- `useSession()` von `next-auth/react` verwenden (Client Component, `"use client"` bereits vorhanden)
- `signOut()` von `next-auth/react` verwenden (NICHT aus `auth.ts` -- das ist nur fuer Server-Side)
- Avatar als `next/image` oder `<img>` mit `width={32} height={32}` und `className="rounded-full"`
- Bestehendes Sidebar-Pattern beibehalten: Shadcn `SidebarFooter`, `SidebarGroup`, `SidebarGroupContent`
- Collapsed-Mode via `group-data-[collapsible=icon]:hidden` -- bestehendes Pattern aus der Sidebar uebernehmen
- "Back to Overview"-Link darf NICHT entfernt werden

**Referenzen:**
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Architecture Layers" (Sidebar Auth Layer)
- Architecture: `specs/phase-6/2026-03-15-security-hardening/architecture.md` --> Section "Migration Map" (components/sidebar.tsx Aenderungen)
- Discovery: `specs/phase-6/2026-03-15-security-hardening/discovery.md` --> Section "UI Components & States" (user_info, logout_btn)
- Bestehende Sidebar: `components/sidebar.tsx` -- SidebarFooter mit "Back to Overview" als Referenz-Pattern
