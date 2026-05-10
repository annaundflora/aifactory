# Systemic Review Report

**Feature:** Interactive Prompt Refinement in Assistant with Per-Project Context
**Branch:** 29-interactive-prompt-refinement-project-context
**Datum:** 2026-05-10

---

## Summary

**Verdict:** FAILED

| Kriterium | Findings |
|-----------|----------|
| Duplicate Solution Paths | 1 |
| Abstraction Reuse | 0 |
| Schema Consistency | 0 |
| Dead Code / Unused Imports | 1 |
| Error Handling Divergence | 2 |
| Configuration Drift | 0 |
| Interface Inconsistency | 2 |
| Dependency Direction | 0 |
| Security Pattern Consistency | 1 |
| Performance Pattern Consistency | 0 |
| **Total** | **7** |

---

## Findings

### SR-1: PATCH-Route fuer Project-Context hat keinen Production-Caller (Duplicate Solution Path)

**Kriterium:** 3.1 Duplicate Solution Paths
**PM-Entscheidung:** Fixen / Bewusst akzeptiert / Abgelehnt

**Problem:**
Es existieren ZWEI Schreibpfade fuer `projects.context_instructions`:
1. Server-Action `updateProjectContext` in `app/actions/projects.ts:156`, aufgerufen von `ProjectContextSettings`-Modal (`components/projects/project-context-settings.tsx:266`).
2. Route-Handler `PATCH /api/projects/[id]/context` in `app/api/projects/[id]/context/route.ts:113`.

Der PATCH-Route-Handler hat KEINEN Production-Caller im Frontend. Suche nach `method: "PATCH"` ueber alle Komponenten / Lib-Dateien (ohne Tests) liefert nur den `/api/assistant/sessions/{id}/title`-Aufruf in `lib/assistant/assistant-context.tsx:881`. Beide Pfade rufen identisch den Drizzle-Helper `updateProjectContext` (`lib/db/queries.ts:102`) auf — Validation/Trim/Length-Check ist in beiden dupliziert (Server-Action: lines 168-183; Route: lines 138-150).

Der GET-Teil des Route-Handlers wird genutzt (`NoContextBanner`, `ProjectContextSettings`). Nur PATCH ist Dead Code.

**Neuer Code:** `app/api/projects/[id]/context/route.ts:113-166` (PATCH handler ungenutzt)
**Bestehendes Pattern:** Server-Actions in `app/actions/projects.ts` sind die etablierte Schreibschicht (siehe alle 7+ Action-Module aus codebase-scan.md Pattern #6); HTTP-Route-Handler werden im Repo nur fuer Domains genutzt, die explizit ueber HTTP angesprochen werden muessen (z.B. SSE-Streaming `app/api/models/sync/route.ts`, externes Tooling `app/api/sam/segment/route.ts`).

**Empfehlung:**
PATCH-Handler entfernen ODER stattdessen auf den Server-Action im Modal verzichten und ueberall PATCH nutzen — eine Entscheidung treffen, nicht beide Pfade pflegen. Wenn FastAPI-Backend spaeter ein "single-source"-Update braucht, dies im Decision-Log dokumentieren. GET-Handler bleibt notwendig fuer Banner / Modal.

---

### SR-2: NoContextBanner verlinkt auf nicht existierende Route (Interface Inconsistency / Dead Code)

**Kriterium:** 3.7 Interface Inconsistency (sekundaer 3.4 Dead Code)
**PM-Entscheidung:** Fixen / Bewusst akzeptiert / Abgelehnt

**Problem:**
`components/assistant/no-context-banner.tsx:48-50` baut die Link-URL `/projects/${projectId}/settings/context`. Diese Route existiert nicht. `find app/projects -type d` zeigt nur `app/projects/[id]` — keine `settings/context`-Subroute. Der Test `components/assistant/__tests__/no-context-banner.test.tsx:433` erwartet zwar diesen Pfad, aber die UX ist tatsaechlich gebrochen: Klick auf den "Hinzufuegen"-Link landet auf 404.

Das eigentliche Edit-UI ist als MODAL implementiert (`ProjectContextSettings` in `components/projects/project-context-settings.tsx`), nicht als Route. Mount-Punkte: `components/project-card.tsx:230` (Edit-Context-Button) und `components/workspace/workspace-header.tsx:195` (Kebab-Menu Eintrag "Edit context"). Der Banner kann das Modal nicht oeffnen, weil er ausserhalb dieser Provider-Trees gerendert wird (`components/assistant/assistant-panel.tsx:221-224`).

**Neuer Code:** `components/assistant/no-context-banner.tsx:48-50,162-168`
**Bestehendes Pattern:** Settings-Modals werden ueber `open + onOpenChange` Props gesteuert — siehe `SettingsDialog` in `components/settings/settings-dialog.tsx:31-34,359` und der Mount in `components/workspace/workspace-header.tsx:190-193`. Keine "/settings/...."-Routen im Repo.

**Empfehlung:**
Banner-Link entweder
(a) durch einen Button ersetzen, der das `ProjectContextSettings`-Modal oeffnet — z.B. via Custom-Event / Context-Provider auf Seite des `WorkspaceContent`-Trees, oder
(b) eine Settings-Route `/projects/[id]/settings/context/page.tsx` neu anlegen und das Modal/Editor dort rendern (architecture.md Slice 06 erwaehnt "route or modal").
Der dazugehoerige Test (`no-context-banner.test.tsx:433`) sollte gegen die finale Wahrheit angepasst werden.

---

### SR-3: Backend-Routes forwarden `project_id`/`user_id` nicht an `stream_response` (Interface Inconsistency)

**Kriterium:** 3.7 Interface Inconsistency
**PM-Entscheidung:** Fixen / Bewusst akzeptiert / Abgelehnt

**Problem:**
`SendMessageRequest` (`backend/app/models/dtos.py:107-110`) definiert `project_id: Optional[UUID]`. `AssistantService.stream_response` (`backend/app/services/assistant_service.py:181-185`) akzeptiert `project_id` UND `user_id` und nutzt beide, um per `ProjectRepository.get_context` den Per-Projekt-Context zu hydrieren (lines 273-291). Aber: in `backend/app/routes/messages.py:71-81` wird beim Aufruf von `_service.stream_response(...)` weder `project_id=request.project_id` noch `user_id=...` durchgereicht. Resultat: `project_context` ist immer `None`, der Block wird nie ins System-Prompt injiziert. Die Slice-11-Pipeline ist aktuell End-zu-End tot.

Der `user_id` ist ohnehin nirgendwo im FastAPI-Layer verfuegbar — es gibt keine Auth-Schicht im Backend (Greps fuer `user_id`, `requireAuth`, `session_user` in `backend/app/routes/` liefern nichts). Das ist eine bekannte Architektur-Eigenheit (Auth lebt ausschliesslich im Next.js-Layer), aber kombiniert mit dem fehlenden Forwarding ist die Feature-Pipeline gebrochen.

**Neuer Code:** `backend/app/routes/messages.py:71-81` (kein Forward von `project_id`); `backend/app/services/assistant_service.py:173-185` (Signatur akzeptiert `project_id`/`user_id`, aber nie geliefert).
**Bestehendes Pattern:** `image_model_id`, `generation_mode`, `reference_slots`, `last_result_image_url` werden alle vom Route an Service geforwardet (`messages.py:75-80`). `project_id` ist die einzige Ausnahme.

**Empfehlung:**
Entweder (a) `request.project_id` UND einen aus dem Forwarded-Auth-Layer abgeleiteten `user_id` (z.B. via Header `X-User-Id` aus dem Next.js Proxy) durchreichen — siehe architecture.md → "Backend Auth Bridge", falls Slice 5 das so vorsieht — oder (b) den `user_id`-Parameter aus `stream_response` entfernen und Ownership rein im Next.js-Layer durchsetzen (dann liefert die Route nur `project_id`, und `ProjectRepository.get_context` koennte das Ownership-Argument optional machen). So wie der Code heute steht, ist der Argument-Block tot.

---

### SR-4: Inkonsistente Sprache der User-facing Error-Messages in API-Routes (Error Handling Divergence)

**Kriterium:** 3.5 Error Handling Divergence (Pattern-Konsistenz von User-facing Messages)
**PM-Entscheidung:** Fixen / Bewusst akzeptiert / Abgelehnt

**Problem:**
Codebase-Konvention (codebase-scan.md → Conventions, "German user-facing messages in chat / toasts; English comments + identifiers"): Bestehende API-Routen + Server-Actions verwenden DEUTSCHE Error-Strings:
- `app/api/sam/segment/route.ts:124,134,141,158,188,261`: "Ungueltiger Request-Body", "image_url ist erforderlich", "Maske konnte nicht geladen werden." etc.
- `app/actions/projects.ts:28,89,116,194,201,239,244,252`: "Projektname darf nicht leer sein", "Projekt nicht gefunden", "Datenbankfehler" etc.

Die NEUEN Routen verwenden ENGLISCHE Error-Strings:
- `app/api/projects/[id]/context/route.ts:34-37`: `"Project not found"`, `"Unauthorized"`, `"Invalid request body"`, `"Context exceeds maximum length of 8000 characters."`
- `app/api/projects/context/generate/route.ts:47-51`: `"Please describe your project briefly (10–500 characters)."`, `"Could not generate. Try again."`, `"Unauthorized"`, `"Invalid request body"`

Diese Inkonsistenz wird im Frontend sichtbar: das `ProjectContextSettings`-Modal zeigt eine deutsche Discard-Confirm-Meldung ("Ungespeicherte Aenderungen verwerfen?"), waehrend Save-Errors auf englisch erscheinen. Das `HelpMeWriteModal` zeigt englische Errors trotz deutscher Header.

**Neuer Code:** `app/api/projects/[id]/context/route.ts:34-37,90,103,128,146,162`; `app/api/projects/context/generate/route.ts:47-51,94,104,109,122,142`
**Bestehendes Pattern:** `app/api/sam/segment/route.ts:124-285` (German), `app/actions/projects.ts:28,89,116,194,201` (German), `lib/assistant/assistant-context.tsx:475,506,510` (German chat).

**Empfehlung:**
Der Architecture.md-Wortlaut (zitiert in den Routes) ist fuer interne API-Spec gedacht; Frontend-Surface-Strings sollten deutsch sein, konsistent mit dem Rest des Repos. Entweder die Routes auf deutsche Strings umstellen ODER eine bewusste Entscheidung im Decision-Log festhalten ("API-Errors englisch, Toasts/UI deutsch") — und dann im `HelpMeWriteModal`/`ProjectContextSettings` die Backend-Fehler in deutsche User-Strings mappen statt direkt durchzureichen.

---

### SR-5: HTTP-Statuscode fuer Invalid-Body inkonsistent (Error Handling Divergence)

**Kriterium:** 3.5 Error Handling Divergence
**PM-Entscheidung:** Fixen / Bewusst akzeptiert / Abgelehnt

**Problem:**
Bestehende Next.js API-Routes mappen Body-Parse-Errors auf 400:
- `app/api/sam/segment/route.ts:122-127`: `JSON.parse` Failure → `{ error: "Ungueltiger Request-Body" }`, status 400.
- `app/api/sam/segment/route.ts:134,141,158`: Validation-Failures (fehlende/ungueltige Felder) → 400.

Die NEUEN Routen mappen sowohl Parse-Failures als auch Validation-Failures auf 422:
- `app/api/projects/[id]/context/route.ts:128,132,146`: `JSON.parse` failure → 422; missing field → 422; over-length → 422.
- `app/api/projects/context/generate/route.ts:104,109,122`: gleiche Behandlung → alles 422.

Das ist nicht falsch (RFC: 422 = "Unprocessable Entity" fuer semantisch ungueltigen, aber syntaktisch validen Content; 400 = "Bad Request" als Catch-all). Aber inkonsistent: ein Frontend-Caller, das beide Routenklassen anspricht, muss beide Codes behandeln. Architecture.md verlangt explizit "401 / 200 / 404 / 422" — das ist OK, aber dann sollten die SAM-Route (oder mindestens die Body-Parse-Branches dort) auch auf 422 umgestellt werden, wenn das die neue Konvention ist.

**Neuer Code:** `app/api/projects/[id]/context/route.ts:128,132,146`; `app/api/projects/context/generate/route.ts:104,109,122`
**Bestehendes Pattern:** `app/api/sam/segment/route.ts:122-160` (alle Body/Validation-Errors → 400)

**Empfehlung:**
Konvention dokumentieren (Decision-Log: "Validation-Errors → 422, Auth → 401, Not-Found → 404, Upstream-Failure → 502") und SAM-Route nachziehen. Alternativ: diese neuen Routes auf 400 fuer Parse-Failures umstellen und 422 nur fuer Field-Length-Violations behalten (engere RFC-Auslegung).

---

### SR-6: Snake_case vs. camelCase im Server-Action-Return-Shape (Interface Inconsistency)

**Kriterium:** 3.7 Interface Inconsistency
**PM-Entscheidung:** Fixen / Bewusst akzeptiert / Abgelehnt

**Problem:**
Der GET/PATCH-Route-Handler liefert das Wire-Format snake_case: `{ id, context_instructions, context_updated_at }` (`app/api/projects/[id]/context/route.ts:60-77`). Konsistent mit den Backend-DTOs (`backend/app/models/dtos.py`).

Der Server-Action `updateProjectContext` liefert camelCase: `{ contextInstructions, contextUpdatedAt }` (`app/actions/projects.ts:159-162,209-212`). Das Modal konsumiert den Server-Action-Return als camelCase (`project-context-settings.tsx:279,285`), liest aber gleichzeitig den GET-Response als snake_case (`project-context-settings.tsx:204,207`). Resultat: das Modal muss zwei Formate parallel handhaben — einmal snake_case beim Initial-Fetch, einmal camelCase beim Save-Return. Beim Date-Handling sogar mit Defensive-Cast (`project-context-settings.tsx:283-285`: `result.contextUpdatedAt instanceof Date ? .toISOString() : result.contextUpdatedAt as unknown as string`).

Die anderen Server-Actions (`createProject`, `getProject`, `renameProject`, `getProjects`) liefern den `Project` Drizzle-Inferred-Type (camelCase), das ist konsistent. Die NEUE `updateProjectContext` ist aber ein Sub-Set des Project-Records (`{ contextInstructions, contextUpdatedAt }`) ohne den Drizzle-Inferred-Wrapper — das verstaerkt die Inkonsistenz, weil das Modal jetzt sowohl mit Server-Action-Camel als auch GET-Snake-Wire arbeitet.

**Neuer Code:** `app/actions/projects.ts:159-162,209-212`; `components/projects/project-context-settings.tsx:75-79,266-286`
**Bestehendes Pattern:** Server-Actions liefern entweder den vollen Drizzle `Project`-Type (camelCase, `getProject`) oder vereinfachte Sub-Shapes (`{ id, name, createdAt }` von `createProject` — ebenfalls camelCase). Wire-Format an HTTP-Boundary ist snake_case (DTO-Layer in `dtos.py`).

**Empfehlung:**
Entweder
(a) Server-Action `updateProjectContext` so anpassen, dass es den vollstaendigen `Project`-Record retourniert (parity mit `renameProject` / `getProject`) — dann muss das Modal nur einmal das Format umrechnen, und das uebrige Project-Caching kann den neuen Wert spiegeln, oder
(b) Auf Modal-Seite einen Mapper schreiben, der beide Shapes zu einer kanonischen Form normalisiert — und kommentieren, dass Server-Action-Return / GET-Wire bewusst differieren.
Status quo (zwei parallele Formate) verteilt das Wissen ueber zwei Stellen.

---

### SR-7: SSRF-Schutz fehlt fuer `last_result_image_url` und `image_url` im neuen Backend-Pfad (Security Pattern Consistency)

**Kriterium:** 3.9 Security Pattern Consistency `ref: ASI01, LLM06`
**PM-Entscheidung:** Fixen / Bewusst akzeptiert / Abgelehnt

**Problem:**
Bestehendes Pattern: `app/api/sam/segment/route.ts:48-61` (`isAllowedImageUrl`) prueft, dass uebergebene `image_url` vom erwarteten R2-Hostname kommt — explizite SSRF-Verteidigung. URLs ausserhalb des erlaubten Hosts werden mit 400 abgelehnt.

In der NEUEN Multimodal-Pipeline (`backend/app/services/assistant_service.py:_build_multimodal_content`, lines 474-676) werden `image_urls`, `reference_slots[].image_url`, `last_result_image_url` verarbeitet und am Ende per `image_url`-Content-Part an den Chat-LLM weitergegeben. Pydantic `HttpUrl` validiert nur das URL-Format, nicht den Hostname — heisst: ein Caller koennte beliebige URLs (interner Loopback, Cloud-Metadata-Endpoints) als `last_result_image_url` schicken. Der Chat-LLM faetcht das Bild (oder mehr) als Server-Side-Request.

`_validate_slot_url` (`assistant_service.py:732-756`) prueft nur die HttpUrl-Syntax. Keine Hostname-Allowlist.

Note: Das ist KEIN Audit-Finding fuer "Vollsicherheit" — es geht um Pattern-Konsistenz: in derselben Codebase existiert eine R2-Hostname-Allowlist (`isAllowedImageUrl`), aber die neuen Endpoints replizieren das Pattern nicht. Wenn die Umgebung Multi-Tenant ist oder LLM-API-Keys exfiltriert werden koennen ueber Server-Side-Fetches, ist das erhoehtes Risiko.

**Neuer Code:** `backend/app/services/assistant_service.py:474-676,732-756` (kein Hostname-Check); `backend/app/models/dtos.py:111-119` (HttpUrl reicht nicht aus)
**Bestehendes Pattern:** `app/api/sam/segment/route.ts:48-61` (SSRF-Verteidigung explizit per Hostname-Allowlist + R2_PUBLIC_URL)

**Empfehlung:**
Ein gemeinsames Helper-Modul (Backend-Variante von `isAllowedImageUrl`) bauen, das anhand von `R2_PUBLIC_URL` (oder einer per-env konfigurierten Liste) die zugelassenen Hostnames prueft. In `_build_multimodal_content` und `_validate_slot_url` einbinden, malformierte URLs als `slot-load-failed` mit `reason: "host_not_allowed"` propagieren. Falls die Architektur bewusst beliebige URLs zulassen soll (z.B. weil der LLM ohnehin nur URLs sieht, die zuvor durch Replicate/R2 gelaufen sind), Decision-Log-Eintrag mit Rationale.

---

## Decision Log Updates

| # | Neuer Eintrag | Date |
|---|---------------|------|

> Falls keine "Bewusst akzeptiert"-Entscheidungen: "None."

None.
