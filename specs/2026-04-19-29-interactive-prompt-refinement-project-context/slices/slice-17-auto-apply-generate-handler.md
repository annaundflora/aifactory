# Slice 17: Auto-Apply + Auto-Generate Handler

> **Slice 17 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-17-auto-apply-generate-handler` |
| **Test** | `pnpm test components/assistant/intent-summary-card lib/hooks/use-is-generation-pending lib/assistant/__tests__/assistant-context` |
| **E2E** | `true` |
| **Dependencies** | `["16-intent-summary-card-component"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/assistant/intent-summary-card lib/hooks/use-is-generation-pending lib/assistant/__tests__/assistant-context` |
| **Integration Command** | `pnpm test components/assistant lib/hooks lib/assistant` |
| **Acceptance Command** | `pnpm test:e2e tests/e2e/auto-apply-generate.spec.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/api/health` |
| **Mocking Strategy** | `mock_external` (Generations-Quelle gemockt für Pending-Hook; `generateImages()` Server-Action gemockt; SSE-Events nur soweit nötig für E2E) |

---

## Ziel

Verdrahtet den "So generieren"-Click in der `IntentSummaryCard` zum vollständigen Auto-Apply + Auto-Generate-Pfad: Precondition gegen laufende Generierung (Toast + Auto-Retry on settle), FSM-Transition `summarizing → generating`, `applyToWorkspace`, `generateImages()`-Aufruf. Error-Path führt zurück nach `summarizing` mit retry-fähiger Card.

---

## Acceptance Criteria

1) GIVEN `generateImages()` ist NICHT pending (kein Eintrag mit `status === "pending"` in der Generations-Quelle des aktiven Projekts) UND `flowState === "summarizing"` UND `intentSummaryPayload` ist gesetzt
   WHEN User klickt `data-testid="intent_summary_card.generate_btn"`
   THEN dispatcht der Handler in dieser Reihenfolge: (a) `SET_FLOW_STATE` mit `flowState="generating"`; (b) ruft `applyToWorkspace()` aus `usePromptAssistant()`; (c) ruft `generateImages()` Server-Action mit `{ projectId, promptMotiv: payload.prompt_preview, modelIds, params, count }` gemäss architecture.md → "Auto-Apply + Auto-Generate Trigger" Tabelle.

2) GIVEN `useIsGenerationPending()` liefert `true` (mindestens eine Generierung im aktiven Projekt hat `status === "pending"`)
   WHEN User klickt `intent_summary_card.generate_btn`
   THEN wird KEIN `SET_FLOW_STATE("generating")` dispatcht UND KEIN `generateImages()` aufgerufen UND ein `sonner`-Toast mit Text `"Es läuft bereits eine Generierung. Bitte warten."` erscheint UND der `flowState` bleibt `"summarizing"` UND beide Card-Buttons bleiben aktiv (kein `disabled`).

3) GIVEN AC-2 wurde gerade ausgelöst (Click blockiert) UND der Handler hat einen Retry-Watcher armiert
   WHEN `useIsGenerationPending()` von `true` zu `false` wechselt (vorherige Generierung settelt)
   THEN wird **genau ein** Retry-Versuch automatisch ausgeführt (entspricht der vollständigen Sequenz aus AC-1) UND der Watcher wird danach disarmiert (kein zweiter Auto-Retry beim nächsten true→false-Übergang).

4) GIVEN AC-1 wurde ausgelöst, `generateImages()` returnt `{ error: string }` (Server-Action-Fehler-Pfad gemäss `app/actions/generations.ts:75-87`)
   WHEN das Promise resolved
   THEN dispatcht der Handler `SET_FLOW_STATE` mit `flowState="summarizing"` (Rollback) UND ein `sonner`-Toast `"Generierung fehlgeschlagen — manuell versuchen?"` erscheint UND beide Card-Buttons sind wieder aktiv (`disabled=false`) UND erneuter Click triggert wieder die volle AC-1-Sequenz.

5) GIVEN AC-1 wurde ausgelöst, `generateImages()` resolved mit `Generation[]` (Erfolg)
   WHEN das Promise resolved
   THEN bleibt `flowState === "generating"` (kein Rollback) UND es wird KEIN Error-Toast gezeigt UND der "Generiere…"-Spinner-State auf dem Generate-Button ist während des laufenden Promise sichtbar (Card-State `pending` gemäss wireframes.md → "State Variations").

6) GIVEN Reducer empfängt `{ type: "SET_FLOW_STATE", flowState: "generating" }`
   WHEN Reducer-Pass erfolgt
   THEN ist `state.flowState === "generating"`; alle anderen Reducer-Felder unverändert; Whitelist `idle | interviewing | summarizing | reviewing | refining | generating` aus Slice 15 weiterhin durchgesetzt (Branch-Komplettierung, kein neuer Action-Type).

7) GIVEN `useIsGenerationPending()` wird mit aktivem `projectId` instanziiert
   WHEN die zugrundeliegende Generations-Quelle keinen Eintrag mit `status === "pending"` für diesen `projectId` enthält
   THEN gibt der Hook `false` zurück; sobald ein Eintrag mit `status === "pending"` für genau diesen `projectId` erscheint, returnt der Hook `true` (Selector mirrored den Filter aus `components/workspace/workspace-content.tsx:217`).

8) GIVEN E2E-Setup: User durchläuft Interview → `emit_intent_summary` → Card erscheint (alle Vor-Slices grün)
   WHEN User klickt "So generieren" UND keine andere Generierung läuft
   THEN erscheint im Workspace-Gallery-Grid mindestens eine `GenerationPlaceholder`-Instanz (gemäss bestehender Polling-Logik in `workspace-content.tsx:215-223`) UND nach Settle wird mindestens ein generiertes Bild sichtbar UND `flowState === "reviewing"` (Übergang wird durch nachfolgende Slices/Backend-Event vorgenommen — Slice 17 prüft nur, dass `flowState === "generating"` während der Pending-Phase aktiv war).

9) GIVEN E2E-Setup: vorherige Generierung läuft (Pending-Fixture)
   WHEN User klickt "So generieren"
   THEN erscheint der Concurrent-Toast aus AC-2; bei Settle der Pending-Generierung wird automatisch ein neuer Generate-Aufruf gestartet (AC-3) und ein neues Bild erscheint im Workspace.

10) GIVEN E2E-Setup: `generateImages()` ist gemockt um `{ error: "..." }` zu liefern
    WHEN User klickt "So generieren"
    THEN erscheint Error-Toast aus AC-4 UND Card bleibt sichtbar mit aktiven Buttons UND ein zweiter Click triggert erneut den vollen Generate-Pfad (Retry über UI).

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Mock-Strategie: Reducer-State direkt provisionieren via Test-Wrapper; `generateImages` über `vi.mock("@/app/actions/generations")`; Generations-Quelle für `useIsGenerationPending` per Test-Provider (oder identische Mock-Strategie wie `workspace-content.tsx` heute nutzt).

### Test-Datei: `lib/hooks/__tests__/use-is-generation-pending.test.ts` (Vitest)

<test_spec>
```typescript
// AC-7: Hook spiegelt den Filter aus workspace-content.tsx:217
it.todo('returns false when no generation has status === "pending" for active projectId');
it.todo('returns true when at least one generation has status === "pending" for active projectId');
it.todo('reacts to generations-source updates (true → false) when pending settles');
```
</test_spec>

### Test-Datei: `components/assistant/__tests__/intent-summary-card.test.tsx` (Vitest + React Testing Library) — erweitert

<test_spec>
```typescript
// AC-1: Click-Handler dispatcht SET_FLOW_STATE("generating") + applyToWorkspace + generateImages
it.todo('dispatches SET_FLOW_STATE("generating"), calls applyToWorkspace, then generateImages on generate click');

// AC-2: Concurrent-Block — Toast + kein Generate
it.todo('shows concurrent-generation toast and skips generateImages when useIsGenerationPending is true');

// AC-3: Auto-Retry on settle (genau einmal)
it.todo('automatically retries generate exactly once when pending flips false after blocked click');

// AC-4: Error-Path Rollback
it.todo('rolls back flowState to "summarizing" and shows error toast on generateImages error');

// AC-5: Success behält generating
it.todo('keeps flowState === "generating" on successful generateImages and shows pending button state');
```
</test_spec>

### Test-Datei: `lib/assistant/__tests__/assistant-context.test.ts` (Vitest) — erweitert

<test_spec>
```typescript
// AC-6: SET_FLOW_STATE("generating") wird vom Reducer akzeptiert
it.todo('SET_FLOW_STATE accepts "generating" and updates only flowState field');
```
</test_spec>

### Test-Datei: `tests/e2e/auto-apply-generate.spec.ts` (Playwright)

<test_spec>
```typescript
// AC-8: E2E Happy-Path
test.skip('intent summary card generate click produces an image in workspace gallery', async () => {
  // AC-8
});

// AC-9: E2E Concurrent-Block + Auto-Retry
test.skip('blocks generate while previous is pending; auto-retries on settle', async () => {
  // AC-9
});

// AC-10: E2E Error-Path mit retry-fähiger Card
test.skip('shows error toast on generate failure; card buttons remain active for retry', async () => {
  // AC-10
});
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-16-intent-summary-card-component` | `<IntentSummaryCard>` mit `data-testid="intent_summary_card.generate_btn"` und Generate-Handler-Slot (Prop `onGenerate`) | React Component | Slot wird in diesem Slice befüllt |
| `slice-15-sse-flow-state-events` | Reducer-Action `SET_FLOW_STATE` mit Whitelist incl. `"generating"` und `"summarizing"` | Reducer-Action | Branch wird hier komplettiert (kein neuer Action-Type) |
| existing | `usePromptAssistant()` (`lib/assistant/assistant-context.tsx:626`) — exposes `applyToWorkspace`, `dispatch`, `flowState`, `intentSummaryPayload` | Hook | Hook unverändert nutzen — NICHT `useAssistantContext` |
| existing | `generateImages()` Server-Action (`app/actions/generations.ts:75`) mit Signature `(input: GenerateImagesInput) => Promise<Generation[] \| { error: string }>` | Server Action | unverändert — keine Signatur-Änderung |
| existing | Generations-Quelle pro Projekt mit `status === "pending"`-Indikator (siehe `workspace-content.tsx:217`) | Data Source | `useIsGenerationPending` mirrored den Filter |
| existing | `sonner.toast()` für Hint-/Error-Toasts | Lib | bestehendes Pattern aus `applyToWorkspace` (`lib/assistant/assistant-context.tsx:506`) |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `useIsGenerationPending(projectId: string): boolean` | React Hook | `slice-17` (intern), erweiterbar für künftige Concurrent-Guards | `(projectId: string) => boolean` |
| Verdrahteter Click-Pfad in `IntentSummaryCard` | Behavior | `slice-18-result-image-multimodal` (setzt `lastResultImageUrl` post-Generate), `slice-28-session-resume-flow-state` | `flowState`-Übergänge `summarizing → generating → (reviewing via Backend)` |
| Reducer-Branch `SET_FLOW_STATE("generating")` | Reducer-State | `slice-18`, `slice-22-multimodal-indicator-ui`, `slice-28` | Reducer-Selector `state.flowState === "generating"` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/hooks/use-is-generation-pending.ts` (NEW) — Selector-Hook `useIsGenerationPending(projectId): boolean`; mirrored den Filter aus `workspace-content.tsx:217`; reagiert auf Quelle-Updates
- [ ] `components/assistant/intent-summary-card.tsx` (Edit) — Generate-Click-Handler vollständig verdrahten: Precondition via `useIsGenerationPending`, FSM-Transition, `applyToWorkspace`, `generateImages`-Aufruf, Auto-Retry-Watcher, Error-Path-Rollback, Pending-Visual-State auf Button
- [ ] `lib/assistant/assistant-context.tsx` (Edit) — `SET_FLOW_STATE`-Reducer-Branch komplettieren (Whitelist-Akzeptanz von `"generating"` sicherstellen — falls Slice 15 `"generating"` aus Whitelist ausgelassen hatte; ansonsten Idempotenz-Check)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Änderung an `app/actions/generations.ts` Signatur oder Logik (Auto-Generate nutzt unveränderten Pfad)
- KEINE Persistierung des `flowState="generating"` ins Backend — Übergang ist frontend-only (architecture.md → "Frontend State Machine Wiring", Q7)
- KEIN `lastResultImageUrl`-Setzen post-Generate — Slice 18
- KEINE `reviewing`-Transition triggern — kommt via Backend-SSE bei `generations.status === "succeeded"`
- KEIN Mehrfach-Retry: bei AC-3 GENAU EINER, danach disarmed (Discovery Q5 + architecture.md → "Concurrent-Generation Handling")
- KEIN Click-Handling in `chat-thread.tsx` — Card kapselt eigenen Handler; chat-thread bleibt unverändert in diesem Slice
- KEINE Erweiterung des `sendMessage`-Pfads oder der SSE-Branches

**Technische Constraints:**
- Hook `useIsGenerationPending` ist Client-only (`"use client"`); liest aus derselben Generations-Quelle wie `workspace-content.tsx:217` (kein paralleler State, kein neuer Provider)
- Click-Handler in `IntentSummaryCard` nutzt `usePromptAssistant()` für `applyToWorkspace`, `dispatch`, `flowState` — KEINE Re-Implementation der Apply-Mechanik
- Apply-Reihenfolge ist STRENG: `SET_FLOW_STATE("generating")` ZUERST, dann `applyToWorkspace`, dann `generateImages` — damit Reducer-Selektoren (z.B. Slice 22 Indicator) korrekt mitziehen
- Concurrent-Toast und Error-Toast nutzen bestehendes `sonner`-Pattern; Error-Toast ohne Action-Button (User klickt erneut auf den Card-Button)
- Auto-Retry-Watcher: `useEffect` auf `useIsGenerationPending`-Wert + lokales `pendingRetryRef` (boolean); Watcher wird beim Click-Block gesetzt, beim erfolgreichen Retry oder bei Card-Unmount disarmed
- Pending-Button-State (AC-5): Button `disabled` + Label-Variation `"Generiere…"` während des laufenden `generateImages`-Promise; gemäss wireframes.md → "State Variations" → `pending`
- Generate-Input für `generateImages()`: `projectId` aus Card-Context (siehe Reuse), `promptMotiv` aus `intentSummaryPayload.prompt_preview`, `modelIds`/`params`/`count` aus Workspace-Variation-State analog zur bestehenden manuellen Generate-Aufruf-Stelle (Implementer prüft existierenden Manual-Generate-Aufruf und replicated dessen Input-Aufbau)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/assistant/assistant-context.tsx` | Edit: `SET_FLOW_STATE`-Branch komplettieren; `usePromptAssistant()` (Zeile 626) für Hook-Konsumtion in der Card — NICHT `useAssistantContext` |
| `app/actions/generations.ts` | Import `generateImages` + `GenerateImagesInput`-Shape — unverändert nutzen |
| `components/workspace/workspace-content.tsx:217` | Filter-Logik (`generations.some(g => g.status === "pending")`) als Vorbild für `useIsGenerationPending` — NICHT kopieren, sondern in Hook abstrahieren mit gleicher Quelle |
| `sonner` (`toast`) | Für Concurrent-Hint und Error-Toast — bestehendes Pattern aus `applyToWorkspace` (`lib/assistant/assistant-context.tsx:506`) |
| `components/assistant/intent-summary-card.tsx` (aus Slice 16) | Edit: Handler-Slot befüllen — Render/Layout/Discuss-Handler unverändert |

**Referenzen:**
- Architecture: `architecture.md` → Sections "Auto-Apply + Auto-Generate Trigger" (Trigger-Tabelle, Sequenz), "Concurrent-Generation Handling" (Block-with-Hint + Auto-Retry-Regel), "Error Handling Strategy" Zeile `generateImages() server-action failure post-auto-apply` (Rollback-Spec), "Migration Map" Zeilen `lib/assistant/assistant-context.tsx:487-551` und `lib/hooks/use-is-generation-pending.ts` (Datei-Aufträge)
- Wireframes: `wireframes.md` → "Screen: Intent Summary Card" → State Variations `rendered` / `pending` / `history` (Visual-Treatments für die Buttons)
- Discovery: `discovery.md` → Slice G "Auto-Apply + Auto-Generate", Q5 (Concurrent-Block-with-Hint), Q8 (Click ist das Gate)
