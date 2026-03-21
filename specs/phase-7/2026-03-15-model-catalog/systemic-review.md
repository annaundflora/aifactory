# Systemic Review — Model Catalog

| Key | Value |
|-----|-------|
| Feature | model-catalog |
| Branch | `feature/model-catalog` |
| Base | `master` (0d26f04) |
| Diff Scope | 78 files changed, +8403 / -2043, 32 commits |
| Reviewed | 2026-03-19 |
| Verdict | **PENDING** (4 findings, 0 resolved) |

---

## Findings

### SR-1: Duplicate Concurrency Limiter

| Field | Value |
|-------|-------|
| Kriterium | 3.1 Duplicate Solution Paths |
| Severity | Medium |
| Status | PENDING |

**Problem:**
`lib/services/model-sync-service.ts:62-86` implementiert `createConcurrencyLimiter()` — ein queue-basiertes Slot-System mit `acquire()/release()`. Dies ist funktional identisch mit dem bestehenden `acquireSlot()/releaseSlot()` Pattern in `lib/clients/replicate.ts:27-47`. Der Codebase-Scan (Pattern #11) hatte den bestehenden Limiter explizit als EXTEND fuer Sync-Concurrency markiert.

**Neuer Code:** `lib/services/model-sync-service.ts:62-86`
**Bestehendes Pattern:** `lib/clients/replicate.ts:27-47`

**Empfehlung:** Shared Utility `lib/utils/concurrency-limiter.ts` extrahieren. Die Factory-Funktion aus dem neuen Code (`createConcurrencyLimiter`) ist das bessere Pattern — `replicate.ts` sollte ebenfalls refactored werden.

---

### SR-2: Schwacherer Auth Check in Route Handler

| Field | Value |
|-------|-------|
| Kriterium | 3.5 Error Handling Divergence |
| Severity | High |
| Status | PENDING |

**Problem:**
`app/api/models/sync/route.ts:33-35` nutzt `auth()` direkt und prueft nur `!session`. Das etablierte Auth-Pattern ist `requireAuth()` aus `lib/auth/guard.ts:25-46`, welches zusaetzlich `session?.user?.id` und `session?.user?.email` validiert. Der schwachere Check koennte Sessions ohne valide User-Daten durchlassen. Dies ist der erste API Route Handler im Projekt — die hier gesetzte Praezedenz ist relevant.

**Neuer Code:** `app/api/models/sync/route.ts:33-35`
**Bestehendes Pattern:** `lib/auth/guard.ts:25-46` (verwendet in allen 7 Server-Action-Dateien)

**Empfehlung:** `requireAuth()` direkt im Route Handler verwenden (funktioniert in jedem Server-Side-Kontext) oder zumindest die vollstaendige Validierungslogik (`session?.user?.id && session?.user?.email`) replizieren.

---

### SR-3: Inkonsistente Model Identity

| Field | Value |
|-------|-------|
| Kriterium | 3.7 Interface Inconsistency |
| Severity | Medium |
| Status | PENDING |

**Problem:**
`model-browser-drawer.tsx` konstruiert die Model-Identity via `${model.owner}/${model.name}` (Lines 106, 129, 140, 185, 391, 396), waehrend `canvas-model-selector.tsx:95` und `model-mode-section.tsx:132` `model.replicateId` verwenden. Der `Model`-Typ stellt `replicateId` als kanonischen Identifier bereit. Zwei verschiedene Wege dieselbe Identity abzuleiten erzeugt Wartungsrisiko.

**Neuer Code:** `components/models/model-browser-drawer.tsx:106,129,140,185,391,396`
**Bestehendes Pattern:** `components/canvas/canvas-model-selector.tsx:95`, `components/settings/model-mode-section.tsx:132`

**Empfehlung:** Alle `${model.owner}/${model.name}` Konstruktionen und `m.owner === model.owner && m.name === model.name` Vergleiche in `model-browser-drawer.tsx` durch `model.replicateId` bzw. `m.replicateId === model.replicateId` ersetzen.

---

### SR-4: Type Import aus Service Layer statt Queries

| Field | Value |
|-------|-------|
| Kriterium | 3.8 Dependency Direction |
| Severity | Low |
| Status | PENDING |

**Problem:**
5 Client-Components importieren `type Model` aus `@/lib/services/model-catalog-service` statt aus `@/lib/db/queries`:
- `components/models/model-browser-drawer.tsx`
- `components/models/model-card.tsx`
- `components/models/model-trigger.tsx`
- `components/canvas/canvas-model-selector.tsx`
- `hooks/use-model-filters.ts`

Das etablierte Codebase-Pattern: 20+ Components importieren Types (`Project`, `Generation`, `ModelSetting`) aus `@/lib/db/queries`. `Model` ist in `lib/db/queries.ts` definiert und exportiert, aber Components nehmen den Umweg ueber den Service Layer — das erzeugt unnoetige Kopplung.

**Neuer Code:** 5 Component-Dateien mit Import aus `@/lib/services/model-catalog-service`
**Bestehendes Pattern:** `components/settings/settings-dialog.tsx:21` (`import type { ModelSetting } from "@/lib/db/queries"`)

**Empfehlung:** Alle Component-Level `import type { Model } from "@/lib/services/model-catalog-service"` auf `import type { Model } from "@/lib/db/queries"` aendern.

---

## Summary

| # | Kriterium | Finding | Severity | Status |
|---|-----------|---------|----------|--------|
| SR-1 | 3.1 Duplicate Solution Paths | Concurrency Limiter dupliziert | Medium | PENDING |
| SR-2 | 3.5 Error Handling Divergence | Auth Check schwaecher als Pattern | High | PENDING |
| SR-3 | 3.7 Interface Inconsistency | owner/name vs. replicateId | Medium | PENDING |
| SR-4 | 3.8 Dependency Direction | Type Import via Service statt Queries | Low | PENDING |

### Nicht beanstandete Kriterien

| Kriterium | Status |
|-----------|--------|
| 3.2 Abstraction Reuse | OK — Bestehende Abstractions korrekt genutzt |
| 3.3 Schema Consistency | OK — Drizzle-Schema folgt bestehenden Conventions |
| 3.4 Dead Code | OK — Kein ungenutzter Code identifiziert |
| 3.6 Config Drift | OK — Env-Vars und Config konsistent |
