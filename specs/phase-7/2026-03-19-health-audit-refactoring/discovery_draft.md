# Feature: Health Audit Refactoring

**Epic:** Health Audit 2026-03-18 Findings
**Status:** Draft
**Wireframes:** --

---

## Problem & Solution

**Problem:**
- 21 Findings aus Health Audit (2026-03-18), davon 4 HIGH, 8 MEDIUM, 9 LOW
- Auth-Boilerplate in 7 Server-Action-Dateien (23 requireAuth, 15 getProjectQuery Aufrufe)
- 4 verschiedene Error-Signaling-Patterns für semantisch gleiche Operationen
- Validierungskonstanten (MODEL_ID_REGEX, UUID_REGEX, ALLOWED_MIME_TYPES) in mehreren Dateien dupliziert
- Sensitive Auth-Logs, Dead Code, Naming-Inkonsistenzen, fehlende Typ-Annotationen

**Solution:**
- Zentralisierung von Auth, Error-Handling, Validierung
- Dead Code entfernen
- Security-Fix für Auth-Logging
- Komplexe Komponenten durch Hook-Extraktion entflechten

**Business Value:**
- Reduzierte Sync-Risiken bei Auth/Validation-Änderungen (aktuell 7+ Dateien manuell)
- Konsistentes Error-Handling = weniger verschluckte Fehler
- Security: Keine sensitiven Daten in Logs

---

## Scope & Boundaries

| In Scope |
|----------|
| F-1: Auth Guard + Ownership Wrapper (`withAuth`, `withProjectAuth`) |
| F-2: Einheitliches Result-Pattern für Server Actions |
| F-3: Validierungskonstanten zentralisieren (`lib/validation/constants.ts`) |
| F-6: Auth-Log Security Fix (console.log in `auth.ts:83` entfernen/reduzieren) |
| F-8: generation-service.ts Parameter-Objekt + Dual-Path-Merge |
| F-9: `useCanvasPopover()` Hook für Popover-Duplikation |
| F-10: Catch-Blocks auf `catch (error: unknown)` vereinheitlichen + tsconfig |
| F-11: `revalidatePath('/')` → `revalidateTag` mit spezifischen Cache-Tags |
| F-15: Raw `<img>` → `next/image` (3 Komponenten) |
| F-18: Naming-Konsistenz (fetchGenerations → getGenerations, addGalleryAsReference angleichen) |
| F-19: Deprecated Components + Tables entfernen |
| F-20: `analysisResult` JSONB-Spalte entfernen |
| F-21: Empty-String-Validierung in Utility extrahieren |
| F-7: PromptArea Hook-Extraktion (usePromptMode, useGenerationSubmit) |
| F-16: canvas-detail-view Polling-Hook extrahieren |
| F-17: canvas-chat-panel SSE/Model-Hooks extrahieren |
| F-4: Polling auf pending Generations einschränken |
| F-14: Test Coverage für Upload-Timeout + R2 Delete Partial Failure |

| Out of Scope |
|--------------|
| F-5: DB-Indexes auf Foreign Keys (kein Query nutzt diese Spalten aktuell) |
| F-12: Rate Limiting (eigenes Feature, nicht Refactoring) |
| F-13: VARCHAR → PostgreSQL ENUMs (TypeScript + Runtime-Validierung schützt bereits) |
| Neue Features oder funktionale Änderungen |
| Performance-Optimierungen über die genannten Findings hinaus |

---

## Current State Reference

- 7 Server-Action-Dateien unter `app/actions/` mit identischem Auth-Guard-Pattern
- Error-Handling: Services werfen Exceptions, Actions fangen und konvertieren zu `{ error }` — Pattern grundsätzlich vorhanden, aber inkonsistent
- `revalidatePath('/')` als einzige Cache-Invalidierung (kein `revalidateTag`)
- Deprecated Code markiert mit `@deprecated` aber nicht entfernt
- Polling in `workspace-content.tsx` mit `hasPending` Guard (zeitlich begrenzt)
- 3 Canvas-Popover-Komponenten mit strukturell ähnlicher handleOpenChange-Logik

---

## Notwendigkeitsbewertung der Findings

### Quick Wins (< 1h, hoher Wert, kein Discovery nötig)

| Finding | Problem | Aufwand | Begründung |
|---------|---------|---------|------------|
| **F-6** | Auth-Log gibt Email + allowedEmails Array aus | 5 min | **Security — sofort fixen.** Ein Log-Leak exponiert alle berechtigten Accounts |
| **F-19** | Deprecated Components (canvas-model-selector, model-browser-drawer) + 2 deprecated DB-Tabellen mit 0 Queries | 30 min | Dead Code entfernen = weniger Noise in IDE/Suche, Schema-Vereinfachung |
| **F-20** | `analysisResult` JSONB-Spalte: 0 Reads, 0 Writes | 15 min | Schema-Ballast, Migration trivial |

### Echtes Refactoring (Strukturänderung, Discovery-relevant)

| Finding | Problem | Impact | Begründung |
|---------|---------|--------|------------|
| **F-1** | Auth-Boilerplate: 23× requireAuth + 15× getProjectQuery über 7 Dateien | HOCH | Jede neue Server Action kopiert 8-15 Zeilen. Auth-Flow-Änderung (z.B. NextAuth 5 GA) erfordert 7-Dateien-Sync |
| **F-2** | 4 Error-Patterns: throw, `{error}`, `{success: false}`, `[]` | HOCH | Aufrufer muss pro Funktion wissen welches Pattern gilt. Falsches Handling → verschluckte Fehler |
| **F-3** | MODEL_ID_REGEX in 3 Dateien, UUID_REGEX in 2, MIME_TYPES in 2 | MITTEL | Validierungsregel-Änderung muss an 3+ Stellen synchronisiert werden |
| **F-8** | generation-service: 12 Parameter, duale Code-Pfade (single/multi) | MITTEL | Bug-Fixes in Processing-Logik müssen an 2 Stellen angewendet werden |

### Hook-Extraktionen (Komplexitäts-Reduktion)

| Finding | Komponente | Zeilen | Hooks | Begründung |
|---------|-----------|--------|-------|------------|
| **F-7** | prompt-area.tsx | 1059 | ~41 | Höchste Churn-Rate (52 Commits). Merge-Konflikte und Regressions-Risiko. Sinnvoll bei nächster Feature-Änderung |
| **F-9** | 3× Canvas-Popovers | 3 Dateien | Identische handleOpenChange | Geringer Aufwand, verhindert Drift bei Popover-Verhaltensänderung |
| **F-16** | canvas-detail-view.tsx | 587 | Polling + State + Dispatch | Zweithäufigst geänderter View. Polling-Hook-Extraktion sinnvoll |
| **F-17** | canvas-chat-panel.tsx | 643 | Chat + Model + SSE | 4 Verantwortlichkeiten in einer Datei. Isoliertes Testen erschwert |

### Konsistenz-Fixes (geringes Risiko, bei Gelegenheit)

| Finding | Problem | Begründung |
|---------|---------|------------|
| **F-10** | Untyped catch blocks (22× bare `catch (error)`) | **Audit-Korrektur:** 0 leere `catch {}` gefunden (nicht 15 wie behauptet). Kein Fehler-Verschlucken, aber TypeScript-Konsistenz verbessern |
| **F-11** | 8× `revalidatePath('/')` invalidiert kompletten Cache | Macht Data-Caching wirkungslos. Umstellung auf revalidateTag erfordert Cache-Tag-Strategie |
| **F-15** | 3× raw `<img>` statt next/image | Fehlende Bildoptimierung (WebP/AVIF, Lazy Loading). R2-Domain muss in remotePatterns |
| **F-18** | fetchGenerations vs getGenerations, addGalleryAsReference vs uploadFromGallery | Naming-Inkonsistenz erzwingt Nachschlagen |
| **F-21** | Empty-String-Validierung 4× wiederholt | Geringer Schaden bei 4 Vorkommen, wächst mit Action-Anzahl |

### Performance (eigener Scope)

| Finding | Problem | Begründung |
|---------|---------|------------|
| **F-4** | Polling holt ALLE Generations statt nur pending | hasPending-Guard begrenzt zeitlich, aber unnötig große Transfers bei vielen Generations |
| **F-14** | Fehlende Tests: Upload-Timeout, R2 Delete Partial Failure | 2 Error-Pfade mit externen Systemen ungetestet |

### Kein Handlungsbedarf

| Finding | Warum nicht |
|---------|-------------|
| **F-5** | DB-Indexes auf Foreign Keys — kein Query nutzt diese Spalten. Impact nur auf CASCADE-Delete |
| **F-12** | Rate Limiting — eigenes Feature, nicht Refactoring. Erfordert Infra-Entscheidung (upstash/custom) |
| **F-13** | VARCHAR ohne DB-Constraints — TypeScript-Typen + Runtime-Validierung schützen bereits. Defense-in-Depth, kein akutes Risiko |

---

## Audit-Qualitätskorrekturen

> Folgende Findings enthielten faktische Fehler oder überzeichnete Zahlen:

| Finding | Audit-Claim | Tatsächlich |
|---------|------------|-------------|
| **F-2** | `models.ts` gibt bare `false` zurück | models.ts gibt `{ error }` zurück |
| **F-2** | `collection-model-service.ts` gibt `{ error }` zurück | Datei existiert nicht im Repo |
| **F-3** | MODEL_ID_REGEX in `model-schema-service.ts` | Datei existiert nicht — 4. Fundort war `generation-service.ts` (bereits gelistet) → 3 unique Dateien |
| **F-7** | 14 useState, 45 Hooks | 13 useState, ~41 Hooks |
| **F-10** | "15 leere `catch {}` Blocks verschlucken Fehler" | **0 leere `catch {}` gefunden.** Untyped catch existiert, aber kein Fehler-Verschlucken |

---

## Context & Research

### Verification (2026-03-19)

| Area | Finding |
|------|---------|
| Auth Pattern | 23× `requireAuth()` + 15× `getProjectQuery()` über 7 Dateien. Pattern konsistent: `const auth = await requireAuth(); if ("error" in auth) return { error: auth.error }` |
| Error Patterns | Services werfen → Actions fangen + konvertieren zu `{ error }`. Ausnahmen: `references.ts` nutzt `{ success: boolean }`, `getSiblingGenerations` gibt `[]` bei Business-Error |
| Regex Duplication | MODEL_ID_REGEX: 3 unique Dateien (generations.ts, model-settings.ts, generation-service.ts). models.ts hat identischen Regex |
| Auth Logging | `auth.ts:83`: `console.log("[auth] signIn attempt:", email, "| allowed:", allowedEmails)` — bestätigt |
| Catch Blocks | 15× `catch (error: unknown)`, 22× bare `catch (error)`, 16× bare `catch (err)`, 0× empty `catch {}` |
| Cache Invalidation | 8× `revalidatePath('/')` in 3 Action-Dateien. 0× `revalidateTag` in Production |
| Deprecated Code | canvas-model-selector.tsx, model-browser-drawer.tsx: 0 Production-Imports. favoriteModels, projectSelectedModels: 0 Queries |
| analysisResult | JSONB-Spalte in assistantImages: 0 Reads, 0 Writes |
| Popovers | Strukturell ähnliche handleOpenChange in 3 Dateien. img2img hat extra `isOpen` Guard |
| generation-service | 596 Zeilen, generate() mit 12 Parametern, duale Code-Pfade für single/multi-model bestätigt |
| prompt-area | 1059 Zeilen, 13 useState, 16 useCallback, 8 useEffect, 4 useRef |
| Naming | fetchGenerations (Action) wraps getGenerations (Query). addGalleryAsReference (Action) calls uploadFromGallery (Service) |
| Raw img tags | canvas-image.tsx:94, sibling-thumbnails.tsx:97, image-preview.tsx:43 — alle bestätigt |

---

## Open Questions

| # | Question | Options | Recommended | Decision |
|---|----------|---------|-------------|----------|
| 1 | Discovery-Tiefe: Alle 18 In-Scope Findings in einer Discovery oder aufteilen? | A) Eine Discovery, mehrere Slices B) Aufteilen nach Kategorie (Auth, Error, Complexity, Cleanup) | A — zusammenhängend, da F-1 + F-2 + F-3 + F-10 denselben Code betreffen | -- |
| 2 | F-2 Result-Pattern: Welches Pattern als Standard? | A) `{ success, data?, error? }` B) `{ data } \| { error }` (Discriminated Union) C) Exceptions durchreichen (kein catch in Actions) | -- | -- |
| 3 | F-11 Cache-Tag-Strategie: Granularität? | A) Per Entity (`project:${id}`, `generations:${projectId}`) B) Per Route (`/projects`, `/workspace/${id}`) | -- | -- |
| 4 | F-7/F-16/F-17 Hook-Extraktion: Jetzt oder bei nächster Feature-Änderung? | A) Jetzt im Refactoring-Scope B) Bei nächster Feature-Berührung mitfixen | -- | -- |
| 5 | Reihenfolge: Quick Wins zuerst oder strukturelle Änderungen? | A) Quick Wins → Struktur → Konsistenz B) Struktur zuerst (Auth/Error) → Rest | -- | -- |

---

## Q&A Log

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Soll ich erst eine umfassende Codebase-Recherche durchführen oder direkt mit den essenziellen Scope-Fragen starten? | Direkt Scope-Fragen — Findings sind bereits verifiziert |
| 2 | Scope: Nur "Echtes Refactoring" (F-1, F-2, F-3, F-8) oder alle Findings? | Eine Discovery für alles, inkl. Notwendigkeitsbewertung |
