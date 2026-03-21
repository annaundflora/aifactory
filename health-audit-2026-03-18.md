# Health Audit Report

**Datum:** 2026-03-18
**Scope:** Gesamte Codebase (Full Scan) -- Next.js 16 App Router, React 19, TypeScript, Drizzle ORM, PostgreSQL, NextAuth 5 beta, Tailwind CSS v4, Vitest

---

## Summary

| Priority | Count |
|----------|-------|
| HIGH | 4 |
| MEDIUM | 8 |
| LOW | 9 |
| **Total** | **21** |

---

## Findings

### F-1: Auth Guard + Ownership Verification Boilerplate duplicated across all 7 Server Action files

**Priority:** HIGH
**Kriterium:** Duplicate Solutions
**PM-Entscheidung:** Refactoring-Ticket

**Problem:**
Every server action starts with an identical auth guard pattern (requireAuth + 'error' in auth check), totaling 28 occurrences across all 7 action files. Additionally, 3 action files repeat ownership verification via getProjectQuery() 12 times (generations.ts: 5, references.ts: 5, projects.ts: 2). Every new server action requires copying 8-15 lines of boilerplate, creating a sync risk when the auth flow changes.

**Evidenz:**
- `app/actions/generations.ts:78-82` — ownership verification: fetch project, check userId match
- `app/actions/projects.ts:83-92` — identical ownership verification pattern
- `app/actions/references.ts:49-53` — identical ownership verification pattern
- `app/actions/prompts.ts` — auth guard only (no ownership)
- `app/actions/models.ts` — auth guard only
- `app/actions/model-settings.ts` — auth guard only
- `app/actions/upload.ts` — auth guard only

**Betroffene Dateien:**
- `app/actions/generations.ts`
- `app/actions/projects.ts`
- `app/actions/references.ts`
- `app/actions/prompts.ts`
- `app/actions/models.ts`
- `app/actions/model-settings.ts`
- `app/actions/upload.ts`

**Empfehlung:**
Auth + Ownership-Checks in eine `withAuth()` und `withProjectAuth(projectId)` Wrapper-Funktion extrahieren. Aktuell muss jede neue Server Action 8-15 Zeilen Boilerplate kopieren -- bei Aenderungen am Auth-Flow (z.B. NextAuth 5 API-Aenderung) muessen alle 7 Dateien manuell synchronisiert werden.

---

### F-2: Error Handling Pattern Drift -- throw vs return {error} vs return false vs return []

**Priority:** HIGH
**Kriterium:** Pattern Drift
**PM-Entscheidung:** Refactoring-Ticket

**Problem:**
Server Actions und Services verwenden 4 verschiedene Error-Signaling-Patterns fuer semantisch gleiche Operationen: (1) throw new Error, (2) return { error: string }, (3) return false, (4) return []. Aufrufer muessen pro Funktion wissen, welches Pattern gilt. prompts.ts wirft Exceptions waehrend alle anderen Actions { error } zurueckgeben.

**Evidenz:**
- `app/actions/prompts.ts` — toggleFavorite() throws new Error statt { error } zurueckzugeben
- `app/actions/references.ts` — returns { success: false/true }
- `app/actions/models.ts` — returns bare `false`
- `app/actions/generations.ts` — getSiblingGenerations returns [] on error
- `lib/services/generation-service.ts` — throws Error
- `lib/services/collection-model-service.ts` — returns { error: string }

**Betroffene Dateien:**
- `app/actions/prompts.ts`
- `app/actions/references.ts`
- `app/actions/models.ts`
- `app/actions/generations.ts`
- `lib/services/generation-service.ts`
- `lib/services/collection-model-service.ts`

**Empfehlung:**
Ein einheitliches Result-Pattern definieren (z.B. `{ success: boolean, data?: T, error?: string }`) und in allen Server Actions konsistent verwenden. Aktuell muss jeder Aufrufer das spezifische Error-Pattern der jeweiligen Funktion kennen -- bei falschem Handling werden Fehler verschluckt (z.B. wenn ein Aufrufer auf { error } prueft aber die Funktion wirft).

---

### F-3: MODEL_ID_REGEX und Validierungskonstanten in 4+ Dateien dupliziert

**Priority:** HIGH
**Kriterium:** Duplicate Solutions / Pattern Drift
**PM-Entscheidung:** Refactoring-Ticket

**Problem:**
Die Regex `/^[a-z0-9-]+\/[a-z0-9._-]+$/` fuer Model-ID-Validierung ist in 4 Dateien unabhaengig definiert. UUID_REGEX ist in 2 Dateien dupliziert, ALLOWED_MIME_TYPES und MAX_FILE_SIZE in 2 Dateien. Aenderungen an Validierungsregeln muessen an allen Stellen manuell synchronisiert werden.

**Evidenz:**
- `app/actions/generations.ts:90` — MODEL_ID_REGEX definiert
- `app/actions/model-settings.ts:16` — MODEL_ID_REGEX definiert
- `lib/services/generation-service.ts:14` — MODEL_ID_REGEX definiert
- `lib/services/model-schema-service.ts:5` — MODEL_ID_REGEX definiert
- `app/actions/projects.ts:166-167` — UUID_REGEX definiert
- `app/actions/prompts.ts:14-15` — UUID_REGEX definiert
- `app/actions/upload.ts:11-12` — ALLOWED_MIME_TYPES, MAX_FILE_SIZE definiert
- `lib/services/reference-service.ts:18-19` — ALLOWED_MIME_TYPES, MAX_FILE_SIZE definiert

**Betroffene Dateien:**
- `app/actions/generations.ts`
- `app/actions/model-settings.ts`
- `lib/services/generation-service.ts`
- `lib/services/model-schema-service.ts`
- `app/actions/projects.ts`
- `app/actions/prompts.ts`
- `app/actions/upload.ts`
- `lib/services/reference-service.ts`

**Empfehlung:**
Alle Validierungskonstanten in ein zentrales `lib/validation/constants.ts` Modul extrahieren. Wenn z.B. das Model-ID-Format um Grossbuchstaben erweitert wird, muessen aktuell 4 Regex-Definitionen gefunden und geaendert werden -- eine vergessene Stelle fuehrt zu Validierungsfehlern nur in bestimmten Code-Pfaden.

---

### F-4: Polling ohne Pagination -- alle Generations bei jedem Zyklus

**Priority:** MEDIUM
**Kriterium:** Performance
**PM-Entscheidung:** Refactoring-Ticket

**Problem:**
Wenn pending Generations existieren, pollt Workspace-Content alle 3 Sekunden ALLE Generations eines Projekts (kein LIMIT in der Query), obwohl nur Status-Updates fuer pending Items noetig waeren. Das gesamte Array wird bei jedem Zyklus ersetzt (setGenerations(result)), was Re-Renders ausloest. Polling ist allerdings auf pending-Zustand begrenzt (hasPending guard).

**Evidenz:**
- `components/workspace/workspace-content.tsx:234` — polling fetches ALL generations without LIMIT
- `components/workspace/workspace-content.tsx:236` — setGenerations(result) ersetzt gesamtes Array
- `lib/db/queries.ts:117-121` — getGenerations() Query hat kein .limit()

**Betroffene Dateien:**
- `components/workspace/workspace-content.tsx`
- `lib/db/queries.ts`

**Empfehlung:**
Polling auf pending Generations einschraenken (WHERE status = 'pending') und nur geaenderte Items im State mergen statt das gesamte Array zu ersetzen. Bei Projekten mit vielen Generations werden unnoetig grosse Datensaetze transferiert, auch wenn das Polling durch den hasPending-Guard zeitlich begrenzt ist.

---

### F-5: Missing Database Indexes auf Foreign Keys

**Priority:** LOW
**Kriterium:** Performance
**PM-Entscheidung:** Refactoring-Ticket

**Problem:**
Zwei Foreign-Key-Spalten haben keinen Index: generation_references.referenceImageId und reference_images.sourceGenerationId. Allerdings werden diese Spalten aktuell in keiner WHERE-Klausel oder JOIN-Abfrage verwendet -- der Impact beschraenkt sich auf CASCADE-Delete-Performance.

**Evidenz:**
- `lib/db/schema.ts:255` — generation_references.referenceImageId hat keinen Index (nur generationId indexiert)
- `lib/db/schema.ts:233` — reference_images.sourceGenerationId hat keinen Index (nur projectId indexiert)
- Keine Queries filtern aktuell nach diesen Spalten

**Betroffene Dateien:**
- `lib/db/schema.ts`

**Empfehlung:**
Indexes bei Bedarf hinzufuegen, wenn Queries ueber diese Spalten eingefuehrt werden. Aktuell ist der Performance-Impact minimal, da keine Read-Queries diese Spalten in WHERE/JOIN nutzen.

---

### F-6: Sensitive Information Disclosure in Auth Logs

**Priority:** HIGH
**Kriterium:** Security
**PM-Entscheidung:** Refactoring-Ticket

**Problem:**
Der signIn-Callback loggt bei jedem Login-Versuch die E-Mail-Adresse des Nutzers UND das komplette allowedEmails-Array per console.log. In einem containerisierten Deployment landen diese Daten in zentralen Log-Aggregatoren.

**Evidenz:**
- `auth.ts:83` — console.log gibt Login-E-Mail und komplettes allowedEmails-Array aus

**Betroffene Dateien:**
- `auth.ts`

**Empfehlung:**
Die console.log-Zeile entfernen oder auf ein nicht-sensitives Log reduzieren (z.B. nur "Login attempt" ohne E-Mail). Aktuell wird bei jedem Login die komplette Liste autorisierter E-Mails in Klartext geloggt -- ein Leak des Log-Systems exponiert alle berechtigten Accounts.

---

### F-7: PromptArea -- 1058 Zeilen, 14 useState, 45 Hooks, Nesting-Depth 4

**Priority:** MEDIUM
**Kriterium:** Complexity / High-Churn
**PM-Entscheidung:** Refactoring-Ticket

**Problem:**
PromptArea ist die groesste Komponente der Codebase (1058 Zeilen, 52 Commits) mit 14 useState, 17 useCallback, 7 useEffect, 4 useRef und weiteren Hooks (45 total). State-Persistence-Matrix fuer 3 Modi. handleModeChange hat 4 Nesting-Levels, handleGenerate 3 Levels.

**Evidenz:**
- `components/workspace/prompt-area.tsx:1` — 1058 Zeilen, 52 Commits, 45 Hook-Aufrufe
- `components/workspace/prompt-area.tsx:266` — handleModeChange: 4 Nesting-Levels
- `components/workspace/prompt-area.tsx:671` — handleGenerate: 3 Nesting-Levels

**Betroffene Dateien:**
- `components/workspace/prompt-area.tsx`

**Empfehlung:**
State-Logik in Custom Hooks extrahieren (z.B. usePromptMode, useGenerationSubmit) und handleModeChange/handleGenerate via Early Returns flach halten. Die hohe Churn-Rate (52 Commits) zeigt, dass jede Feature-Aenderung diese Datei anfasst -- Merge-Konflikte und Regressions-Risiko steigen proportional.

---

### F-8: generation-service.ts -- Dual Code Paths, 12-Parameter-Funktion

**Priority:** MEDIUM
**Kriterium:** Complexity / High-Churn
**PM-Entscheidung:** Refactoring-Ticket

**Problem:**
generate() hat separate Implementierungen fuer Single- vs Multi-Model mit duplizierten Processing-Loops und nimmt 12 Parameter entgegen (empfohlen: max 7). Die Datei hat 593 Zeilen und 22 Commits.

**Evidenz:**
- `lib/services/generation-service.ts:319` — generate() mit 12 Parametern
- `lib/services/generation-service.ts:1` — 593 Zeilen, 22 Commits
- `lib/services/generation-service.ts` — Duale Code-Pfade fuer single vs multi-model

**Betroffene Dateien:**
- `lib/services/generation-service.ts`

**Empfehlung:**
Parameter in ein `GenerationRequest`-Objekt buendeln und die Single/Multi-Logik in eine gemeinsame Pipeline mit Strategy-Pattern zusammenfuehren. Aktuell muessen Bug-Fixes in der Processing-Logik an zwei Stellen angewendet werden.

---

### F-9: Popover-Komponenten mit identischer Handler/State-Logik

**Priority:** MEDIUM
**Kriterium:** Duplicate Solutions
**PM-Entscheidung:** Refactoring-Ticket

**Problem:**
Drei Canvas-Popover-Komponenten (img2img, upscale, variation) implementieren strukturell aehnliche handleOpenChange-Handler (gleicher Dispatch-Pattern, aber unterschiedliche Guard-Conditions und toolIds), Tier-State-Initialisierung und ImageParams-Reset-Logik.

**Evidenz:**
- `components/canvas/popovers/img2img-popover.tsx:110-118` — handleOpenChange
- `components/canvas/popovers/upscale-popover.tsx:57-65` — identischer handleOpenChange
- `components/canvas/popovers/variation-popover.tsx:94-102` — identischer handleOpenChange
- `components/canvas/popovers/upscale-popover.tsx:44,47-51` — Tier-State init + reset
- `components/canvas/popovers/variation-popover.tsx:69,82-91` — identischer Tier-State init + reset
- `components/canvas/popovers/img2img-popover.tsx:82,88-91` — ImageParams reset
- `components/canvas/popovers/variation-popover.tsx:70,76-79` — identischer ImageParams reset

**Betroffene Dateien:**
- `components/canvas/popovers/img2img-popover.tsx`
- `components/canvas/popovers/upscale-popover.tsx`
- `components/canvas/popovers/variation-popover.tsx`

**Empfehlung:**
Gemeinsame Logik in einen `useCanvasPopover()`-Hook extrahieren (handleOpenChange, tier state, imageParams reset). Aenderungen am Popover-Verhalten (z.B. Close-Animation) muessen aktuell in 3 Dateien identisch nachgezogen werden.

---

### F-10: Untyped catch blocks (34x) vs. typed catch (7x)

**Priority:** MEDIUM
**Kriterium:** Pattern Drift
**PM-Entscheidung:** Refactoring-Ticket

**Problem:**
Von 33 catch-Blocks verwenden nur 7 die typisierte Form `catch (error: unknown)`, 11 nutzen bare-named `catch (error)` ohne Annotation, und 15 sind leere `catch { }` ohne Variable. Die 15 leeren catch-Blocks verschlucken Fehler komplett.

**Evidenz:**
- `app/actions/generations.ts` — Mix aus typed und untyped catch
- `app/actions/projects.ts` — untyped catch blocks
- `app/actions/references.ts` — untyped catch blocks
- `app/actions/model-settings.ts` — untyped catch blocks

**Betroffene Dateien:**
- `app/actions/generations.ts`
- `app/actions/projects.ts`
- `app/actions/references.ts`
- `app/actions/model-settings.ts`

**Empfehlung:**
Alle catch-Blocks auf `catch (error: unknown)` vereinheitlichen und `useUnknownInCatchVariables` in tsconfig aktivieren. Ohne Typ-Annotation kann in catch-Blocks auf beliebige Properties zugegriffen werden, was zu Runtime-Errors fuehrt wenn der Fehler kein Error-Objekt ist.

---

### F-11: revalidatePath('/') statt granularer Cache-Invalidierung

**Priority:** MEDIUM
**Kriterium:** Performance / Pattern Drift
**PM-Entscheidung:** Refactoring-Ticket

**Problem:**
8 revalidatePath('/')-Aufrufe in 3 Action-Dateien invalidieren jeweils den kompletten Next.js-Cache. Kein einziger revalidateTag-Aufruf in Production-Code (5 Vorkommen sind nur in Test-Mocks).

**Evidenz:**
- `app/actions/generations.ts` — 1x revalidatePath('/')
- `app/actions/projects.ts` — 4x revalidatePath('/')
- `app/actions/references.ts` — 3x revalidatePath('/')
- 0x revalidateTag in Production (5 Matches nur in vi.fn() Mocks)

**Betroffene Dateien:**
- `app/actions/generations.ts`
- `app/actions/projects.ts`
- `app/actions/references.ts`

**Empfehlung:**
Auf revalidateTag mit spezifischen Cache-Tags umstellen (z.B. `project:${id}`, `generations:${projectId}`). Die aktuelle Breitband-Invalidierung macht Data-Caching in Next.js wirkungslos -- jede Mutation invalidiert den Cache fuer ALLE Nutzer und Routen.

---

### F-12: Missing Rate Limiting auf Server Actions

**Priority:** MEDIUM
**Kriterium:** Security
**PM-Entscheidung:** Refactoring-Ticket

**Problem:**
Keine der Server Actions implementiert per-User Rate Limiting. Der Replicate-Client (lib/clients/replicate.ts) hat zwar ein globales Concurrency-Limit und Retry-Logik fuer 429-Fehler, aber auf der Server-Action-Ebene gibt es keinen Schutz gegen Missbrauch durch einzelne authentifizierte Nutzer.

**Evidenz:**
- `app/actions/generations.ts` — kein Rate Limiting
- `app/actions/upload.ts` — kein Rate Limiting
- `app/actions/references.ts` — kein Rate Limiting
- Alle 7 Server Action Dateien ohne Rate Limiting

**Betroffene Dateien:**
- `app/actions/generations.ts`
- `app/actions/projects.ts`
- `app/actions/references.ts`
- `app/actions/prompts.ts`
- `app/actions/models.ts`
- `app/actions/model-settings.ts`
- `app/actions/upload.ts`

**Empfehlung:**
Rate Limiting Middleware fuer Server Actions einfuehren (z.B. via upstash/ratelimit oder custom Token-Bucket). Ohne Rate Limiting kann ein authentifizierter Nutzer unbegrenzt Generations triggern, was zu unkontrollierten Replicate-API-Kosten fuehrt.

---

### F-13: VARCHAR-Spalten fuer Finite State Sets ohne DB-Constraints

**Priority:** LOW
**Kriterium:** Schema Workaround
**PM-Entscheidung:** Refactoring-Ticket

**Problem:**
Mehrere VARCHAR-Spalten modellieren endliche Wertemengen (generationMode, status, thumbnailStatus, role, strength, sourceType) ohne CHECK-Constraints oder PostgreSQL-ENUMs. Ungueltige Werte werden nur auf Applikationsebene verhindert.

**Evidenz:**
- `lib/db/schema.ts` — generationMode: txt2img|img2img|upscale (VARCHAR ohne Constraint)
- `lib/db/schema.ts` — status: pending|completed|failed (VARCHAR ohne Constraint)
- `lib/db/schema.ts:251-252` — role: 6 Werte, strength: 4 Werte (VARCHAR(20) ohne Constraint)
- `lib/db/schema.ts:224` — sourceType: upload|gallery (VARCHAR(20) ohne Constraint)

**Betroffene Dateien:**
- `lib/db/schema.ts`

**Empfehlung:**
Bei Bedarf PostgreSQL-ENUMs oder CHECK-Constraints via Drizzle-Migration einfuehren. VARCHAR ohne DB-Constraints ist ein gaengiges Drizzle-Pattern, da TypeScript-Typen und Runtime-Validierung (z.B. generation-service.ts:354) bereits schuetzen. Defense-in-Depth-Verbesserung, aber kein akutes Risiko.

---

### F-14: Test Coverage Gaps -- Upload Timeout, Storage Config, Delete Partial Failure

**Priority:** MEDIUM
**Kriterium:** Test Coverage
**PM-Entscheidung:** Refactoring-Ticket

**Problem:**
Kritische Error-Pfade in 2 Bereichen sind nicht getestet: (1) AbortSignal.timeout bei URL-Upload, (2) R2 Delete-Fehler bei Generation-Loeschung wird verschluckt. Storage Config (getConfig) ist korrekt getestet (5 Test-Cases fuer alle Env-Vars).

**Evidenz:**
- `app/actions/upload.ts` — AbortSignal.timeout(15_000) ohne Timeout-Test
- `app/actions/generations.ts` — deleteGeneration ignoriert R2 Delete-Fehler, kein Test fuer Partial Failure
- `lib/clients/__tests__/storage.test.ts` — getConfig() IST getestet (5 Env-Var-Tests vorhanden)

**Betroffene Dateien:**
- `app/actions/upload.ts`
- `app/actions/generations.ts`

**Empfehlung:**
Tests fuer diese 2 Error-Pfade ergaenzen: (1) Upload-Timeout simulieren, (2) R2 Delete-Fehler testen und entscheiden ob silent fail akzeptabel ist. Beide Pfade betreffen Datenmutationen mit externen Systemen.

---

### F-15: Raw <img> Tags statt next/image in 3 Komponenten

**Priority:** LOW
**Kriterium:** Performance
**PM-Entscheidung:** Refactoring-Ticket

**Problem:**
Drei Komponenten verwenden rohe `<img>`-Tags statt `next/image`, wodurch automatische Bildoptimierung (WebP/AVIF-Konvertierung, Responsive Sizing, Lazy Loading) nicht genutzt wird.

**Evidenz:**
- `components/canvas/canvas-image.tsx:94` — Main Canvas-Bild als <img>
- `components/canvas/sibling-thumbnails.tsx:97` — Thumbnails in .map() Loop als <img>
- `components/assistant/image-preview.tsx:43` — Upload-Preview als <img>

**Betroffene Dateien:**
- `components/canvas/canvas-image.tsx`
- `components/canvas/sibling-thumbnails.tsx`
- `components/assistant/image-preview.tsx`

**Empfehlung:**
Auf next/image umstellen, insbesondere fuer canvas-image (Haupt-Anzeige) und sibling-thumbnails (Loop). Bei R2-gehosteten Bildern muss die Domain in next.config.ts remotePatterns konfiguriert werden. Ohne Optimierung werden Bilder in voller Groesse und im Original-Format ausgeliefert.

---

### F-16: canvas-detail-view.tsx -- Polling/State-Komplexitaet (587 Zeilen, 22 Commits)

**Priority:** LOW
**Kriterium:** Complexity / High-Churn
**PM-Entscheidung:** Refactoring-Ticket

**Problem:**
Komplexes Polling mit Refs, State und Dispatch erzeugt multiple Sources of Truth. Die Komponente verwaltet Canvas-State, Polling, Model Settings, Popovers und Chat in einer Datei.

**Evidenz:**
- `components/canvas/canvas-detail-view.tsx` — 587 Zeilen, 22 Commits
- `components/canvas/canvas-detail-view.tsx` — Polling mit refs + state + dispatch

**Betroffene Dateien:**
- `components/canvas/canvas-detail-view.tsx`

**Empfehlung:**
Polling-Logik in einen `useGenerationPolling()`-Hook und Popover-State in einen `useCanvasPopovers()`-Hook auslagern. Die Datei ist aktuell der zweit-haeufigst geaenderte View-Component.

---

### F-17: canvas-chat-panel.tsx -- 643 Zeilen mit 4 Verantwortlichkeiten

**Priority:** LOW
**Kriterium:** Complexity
**PM-Entscheidung:** Refactoring-Ticket

**Problem:**
Kombiniert Chat-UI, Model-Selection, Tier-Management und SSE-Processing in einer Datei.

**Evidenz:**
- `components/canvas/canvas-chat-panel.tsx:1` — 643 Zeilen

**Betroffene Dateien:**
- `components/canvas/canvas-chat-panel.tsx`

**Empfehlung:**
SSE-Processing in einen `useChatStream()`-Hook und Model/Tier-Selection in Sub-Komponenten extrahieren. Vier unabhaengige Concerns in einer Datei erschweren isoliertes Testen.

---

### F-18: Naming-Inkonsistenz fetchGenerations vs getGenerations

**Priority:** LOW
**Kriterium:** Naming
**PM-Entscheidung:** Refactoring-Ticket

**Problem:**
fetchGenerations ist das einzige 'fetch'-Prefix in Server Actions -- alle anderen verwenden 'get'. Ebenso verwendet die Server Action 'addGalleryAsReference' waehrend der Service 'uploadFromGallery' heisst.

**Evidenz:**
- `app/actions/generations.ts` — fetchGenerations (einziges 'fetch' Prefix)
- `lib/db/queries.ts` — getGenerations
- `app/actions/references.ts` — addGalleryAsReference
- `lib/services/reference-service.ts` — uploadFromGallery

**Betroffene Dateien:**
- `app/actions/generations.ts`
- `lib/db/queries.ts`
- `app/actions/references.ts`
- `lib/services/reference-service.ts`

**Empfehlung:**
fetchGenerations zu getGenerations umbenennen und addGalleryAsReference/uploadFromGallery angleichen. Die Inkonsistenz erzwingt Nachschlagen statt Konvention.

---

### F-19: Deprecated Components + Tables noch in Codebase

**Priority:** LOW
**Kriterium:** Dead Code
**PM-Entscheidung:** Refactoring-Ticket

**Problem:**
CanvasModelSelector (deprecated seit Slice 12), ModelBrowserDrawer (nur von CanvasModelSelector importiert), und zwei deprecated DB-Tabellen (favoriteModels, projectSelectedModels) existieren noch in der Codebase ohne Produktions-Nutzung.

**Evidenz:**
- `components/canvas/canvas-model-selector.tsx` — @deprecated, 0 Production-Imports
- `components/models/model-browser-drawer.tsx` — nur von deprecated Component importiert
- `lib/db/schema.ts:103-151` — favoriteModels + projectSelectedModels @deprecated, 0 Queries

**Betroffene Dateien:**
- `components/canvas/canvas-model-selector.tsx`
- `components/models/model-browser-drawer.tsx`
- `lib/db/schema.ts`

**Empfehlung:**
Deprecated Components loeschen und deprecated Tabellen via Migration entfernen. Die Tabellen erhoehen Schema-Komplexitaet und die Components tauchen in IDE-Autocomplete und Suchen auf.

---

### F-20: analysisResult JSONB-Spalte ohne Schema und ohne Nutzung

**Priority:** LOW
**Kriterium:** Schema Workaround / Dead Code
**PM-Entscheidung:** Refactoring-Ticket

**Problem:**
Die JSONB-Spalte `analysisResult` in assistant_images hat keine TypeScript-Typdefinition und wird nirgends in der Codebase gelesen oder geschrieben.

**Evidenz:**
- `lib/db/schema.ts:198` — analysisResult: jsonb, keine Typ-Definition
- Codebase-weit: 0 Queries oder Updates auf dieses Feld

**Betroffene Dateien:**
- `lib/db/schema.ts`

**Empfehlung:**
Spalte via Migration entfernen oder, falls zukuenftig geplant, ein TypeScript-Interface definieren. Untypisierte JSONB-Spalten ohne Nutzung sind Schema-Ballast.

---

### F-21: Empty String Validation Pattern 4x wiederholt

**Priority:** LOW
**Kriterium:** Duplicate Solutions
**PM-Entscheidung:** Refactoring-Ticket

**Problem:**
Identisches Pattern fuer Empty-String-Validierung wird in 3 Dateien 4x wiederholt.

**Evidenz:**
- `app/actions/generations.ts:239` — empty string check
- `app/actions/references.ts:56` — identical empty string check
- `app/actions/references.ts:142` — identical empty string check
- `app/actions/upload.ts:37` — identical empty string check

**Betroffene Dateien:**
- `app/actions/generations.ts`
- `app/actions/references.ts`
- `app/actions/upload.ts`

**Empfehlung:**
Eine `validateNonEmpty(value: string, fieldName: string)` Utility-Funktion extrahieren. Bei 4 Vorkommen ist der Duplikationsschaden gering, aber bei wachsender Action-Anzahl steigt die Inkonsistenzgefahr.
