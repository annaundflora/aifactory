# Slice 27: PasteDetectConfirmCard-Komponente

> **Slice 27 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-27-paste-detect-card-component` |
| **Test** | `pnpm test components/assistant/paste-detect-confirm-card` |
| **E2E** | `true` |
| **Dependencies** | `["slice-26-paste-detect-heuristic", "slice-16-intent-summary-card-component"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/assistant/paste-detect-confirm-card` |
| **Integration Command** | `pnpm test components/assistant` |
| **Acceptance Command** | `pnpm test:e2e tests/e2e/paste-detect-confirm-card.spec.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/api/health` |
| **Mocking Strategy** | `mock_external` (Backend-SSE für `refine_prompt`-Tool-Result + Intent-Summary gemockt; Reducer-State-Wrapper für Unit-Tests) |

---

## Ziel

Inline-Card im Chat-Thread, die nach der ersten User-Message erscheint, wenn die Paste-Heuristik (Slice 26) anschlägt. User entscheidet via zwei Buttons, ob direkt verfeinert wird (`refine_prompt`-Tool-Call ausgelöst) oder das normale Interview startet. Card verschwindet nach Click vollständig aus der History — bewusster Unterschied zur IntentSummaryCard.

---

## Acceptance Criteria

1) GIVEN eine frisch gestartete Session ohne vorhergehende User-Messages UND `flowState === "idle"`
   WHEN User eine erste Message absendet, deren Inhalt `detectPastedPrompt(text) === true` ergibt
   THEN dispatcht `chat-thread.tsx` (oder ein dedizierter Trigger-Effect) genau einmal die Reducer-Action `RENDER_PASTE_CONFIRM` mit Payload `{ seedText: <originalText> }`; nach Render existiert genau ein DOM-Element mit `data-testid="paste_confirm_card"` zwischen den Bubbles.

2) GIVEN eine Session, in der bereits **mindestens eine** User-Message existiert
   WHEN User eine weitere Message absendet, die `detectPastedPrompt` ebenfalls als true klassifizieren würde
   THEN wird **keine** weitere `RENDER_PASTE_CONFIRM`-Action dispatcht; es existiert kein zweites `paste_confirm_card`-Element im DOM (Heuristik triggert ausschliesslich auf der ersten User-Message der Session).

3) GIVEN User-Message ist erste Message der Session, aber `detectPastedPrompt(text) === false`
   WHEN Render-Pass läuft
   THEN wird **keine** Card gemountet; Reducer-Field `pasteConfirmPayload` bleibt `null`/`undefined`.

4) GIVEN Reducer-State enthält `pasteConfirmPayload` (Card sichtbar, beide Buttons aktiv)
   WHEN User klickt `data-testid="paste_confirm_card.refine_btn"`
   THEN wird (a) Reducer-Action `DISMISS_PASTE_CONFIRM` dispatcht UND (b) `sendMessage(seedText)` mit dem Original-Seed-Text und einem zusätzlichen Tool-Hint aufgerufen, der den Backend-LLM zur Nutzung von `refine_prompt` veranlasst (siehe architecture.md → Section "Migration Map" Zeile `prompt_tools.py` und Tabelle Tools — `refine_prompt` ist existing). Die Card-Instanz verschwindet vollständig aus dem DOM (kein `data-testid="paste_confirm_card"` mehr auffindbar).

5) GIVEN Reducer-State enthält `pasteConfirmPayload` (Card sichtbar, beide Buttons aktiv)
   WHEN User klickt `data-testid="paste_confirm_card.interview_btn"`
   THEN wird (a) Reducer-Action `DISMISS_PASTE_CONFIRM` dispatcht UND (b) `sendMessage(seedText)` mit dem Original-Seed-Text als normale User-Message aufgerufen (kein Tool-Hint, normaler Interview-Pfad). Die Card-Instanz verschwindet vollständig aus dem DOM.

6) GIVEN Card wurde durch einen der beiden Buttons dismissed
   WHEN ein nachfolgender Assistant-Turn neue Messages in den Thread streamt
   THEN bleibt das `paste_confirm_card`-Element abwesend; im Gegensatz zur IntentSummaryCard wird es **nicht** als History-Element konserviert (Wireframes: "Card does NOT remain in chat history").

7) GIVEN der Reducer wird mit Default-State initialisiert
   WHEN `assistantReducer` ohne Actions inspiziert wird
   THEN existiert ein neues State-Feld `pasteConfirmPayload: { seedText: string } | null` mit Initial-Wert `null`.

8) GIVEN Reducer-State `pasteConfirmPayload === null`
   WHEN Action `RENDER_PASTE_CONFIRM` mit Payload `{ seedText: "..." }` dispatcht wird
   THEN ist `state.pasteConfirmPayload` danach `{ seedText: "..." }`; ein erneuter `RENDER_PASTE_CONFIRM`-Dispatch in derselben Session wird vom Trigger-Layer (AC-2) blockiert, der Reducer selbst überschreibt aber idempotent (kein zweiter Card-Mount durch State-Logik).

9) GIVEN Reducer-State `pasteConfirmPayload !== null`
   WHEN Action `DISMISS_PASTE_CONFIRM` dispatcht wird
   THEN ist `state.pasteConfirmPayload` danach `null`; nachfolgende `RENDER_PASTE_CONFIRM`-Actions in derselben Session werden weiterhin durch den Trigger-Layer (AC-2) blockiert.

10) GIVEN E2E-Setup: leere Session, Heuristik-passender Style-Prompt im Input
    WHEN User Send drückt UND danach `data-testid="paste_confirm_card.refine_btn"` klickt
    THEN verschwindet die Card UND es folgt ein Assistant-Turn, der via `refine_prompt`-Tool zu einer IntentSummaryCard (`data-testid="intent_summary_card"`) führt (Slice 16 Mount-Branch).

11) GIVEN E2E-Setup: leere Session, Heuristik-passender Style-Prompt im Input
    WHEN User Send drückt UND danach `data-testid="paste_confirm_card.interview_btn"` klickt
    THEN verschwindet die Card UND der Assistant streamt eine erste Interview-Frage als Text-Bubble (kein Tool-Call, `flowState` wechselt zu `"interviewing"`).

> **Hinweis zu "Tool-Hint" in AC-4:** Die konkrete Mechanik (z.B. zusätzlicher hidden-prefix in der User-Message oder explizites Body-Field) ist Implementer-Choice innerhalb der bestehenden `sendMessage`-Signatur. Verbindlich ist nur, dass Backend infolgedessen `refine_prompt` aufruft — verifizierbar durch nachfolgenden IntentSummaryCard-Mount (AC-10).

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Unit-Tests provisionieren Reducer-State direkt via Test-Wrapper. E2E nutzt Backend-SSE-Fixtures, die `refine_prompt`-Tool-Result + Intent-Summary für AC-10 bzw. eine normale Interview-Frage für AC-11 simulieren.

### Test-Datei: `components/assistant/__tests__/paste-detect-confirm-card.test.tsx` (Vitest + RTL)

<test_spec>
```typescript
// AC-1: Erste User-Message + Heuristik-Treffer triggert RENDER_PASTE_CONFIRM
it.todo('dispatches RENDER_PASTE_CONFIRM and mounts card on first user message when heuristic matches');

// AC-2: Zweite Message triggert nicht erneut
it.todo('does not dispatch RENDER_PASTE_CONFIRM on subsequent user messages');

// AC-3: Heuristik false → keine Card
it.todo('does not mount card when detectPastedPrompt returns false');

// AC-4: Refine-Click dispatcht DISMISS + sendMessage mit Tool-Hint
it.todo('dismisses card and invokes refine path on refine_btn click');

// AC-5: Interview-Click dispatcht DISMISS + sendMessage normal
it.todo('dismisses card and invokes normal interview path on interview_btn click');

// AC-6: Card bleibt nach Click NICHT in History
it.todo('does not retain card in DOM after dismiss when new assistant messages arrive');
```
</test_spec>

### Test-Datei: `lib/assistant/__tests__/assistant-context.paste-confirm.test.tsx` (Vitest, Reducer-Pure)

<test_spec>
```typescript
// AC-7: Default-State enthält pasteConfirmPayload === null
it.todo('initializes pasteConfirmPayload as null in default state');

// AC-8: RENDER_PASTE_CONFIRM setzt Payload
it.todo('sets pasteConfirmPayload to { seedText } on RENDER_PASTE_CONFIRM action');

// AC-9: DISMISS_PASTE_CONFIRM setzt Payload zurück auf null
it.todo('resets pasteConfirmPayload to null on DISMISS_PASTE_CONFIRM action');
```
</test_spec>

### Test-Datei: `tests/e2e/paste-detect-confirm-card.spec.ts` (Playwright)

<test_spec>
```typescript
// AC-10: E2E Refine-Pfad → IntentSummaryCard erscheint
test.skip('first paste-like message → card → refine_btn click → intent_summary_card appears', async () => {
  // AC-10
});

// AC-11: E2E Interview-Pfad → erste Assistant-Frage erscheint
test.skip('first paste-like message → card → interview_btn click → assistant streams interview question', async () => {
  // AC-11
});
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-26-paste-detect-heuristic` | `detectPastedPrompt(text: string): boolean` | Pure Function | Trigger-Layer importiert direkt aus `lib/assistant/paste-detect.ts` |
| `slice-16-intent-summary-card-component` | `chat-thread.tsx` Card-Render-Branch + `data-testid="intent_summary_card"` | Mount-Point + Selector | E2E-Test (AC-10) verifiziert nachfolgenden Mount |
| existing | `usePromptAssistant()` Hook (`flowState`, `messages`, `dispatch`, `sendMessage`) | Hook | Component + Trigger-Layer konsumieren via Hook |
| existing | `refine_prompt` Tool im Backend | Backend-Tool | Vorhandenen Tool nutzen — kein Backend-Change in diesem Slice |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `<PasteDetectConfirmCard />` | React Component | (terminal — kein Folge-Slice mountet sie weiter) | Liest `pasteConfirmPayload` via Hook; Buttons sind interne Handler |
| `pasteConfirmPayload` Reducer-Field | State-Field | `slice-28-session-resume-flow-state` (informativ — Resume rendert Card NICHT erneut, da transient) | `{ seedText: string } \| null` |
| Reducer-Actions `RENDER_PASTE_CONFIRM`, `DISMISS_PASTE_CONFIRM` | Actions | (terminal) | `RENDER_PASTE_CONFIRM` Payload `{ seedText: string }`; `DISMISS_PASTE_CONFIRM` ohne Payload |
| `data-testid="paste_confirm_card"` (+ `.refine_btn`, `.interview_btn`) | DOM-Selectors | E2E-Suite | Stabile E2E-Selectors |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/assistant/paste-detect-confirm-card.tsx` (NEW) — Card-Komponente mit Hint-Text, zwei Buttons (`refine_btn`, `interview_btn`); konsumiert `pasteConfirmPayload` über `usePromptAssistant()`; Click-Handler dispatchen `DISMISS_PASTE_CONFIRM` + rufen `sendMessage` mit Seed-Text (Refine-Pfad mit Tool-Hint, Interview-Pfad normal)
- [ ] `components/assistant/chat-thread.tsx` (Edit) — (a) Render-Branch ergänzen: `<PasteDetectConfirmCard>` mounten wenn `pasteConfirmPayload !== null`; (b) Trigger-Layer ergänzen, der bei der ersten User-Message der Session `detectPastedPrompt` aufruft und bei Treffer einmalig `RENDER_PASTE_CONFIRM` dispatcht (z.B. via `useEffect`-Watch auf `messages`-Array oder Equivalent — Implementer-Choice; Single-Fire-Garantie ist verbindlich)
- [ ] `lib/assistant/assistant-context.tsx` (Edit) — (a) `AssistantState` um Feld `pasteConfirmPayload: { seedText: string } | null` (Default `null`) erweitern; (b) `AssistantAction`-Union um `RENDER_PASTE_CONFIRM` (Payload `{ seedText: string }`) und `DISMISS_PASTE_CONFIRM` (kein Payload) erweitern; (c) Reducer-Branches für beide Actions implementieren
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Änderung an der Heuristik-Funktion selbst — Slice 26 ist Source of Truth.
- KEINE Backend-Änderung — `refine_prompt` ist existing, `paste-confirm-suggestion` SSE-Event aus architecture.md wird in diesem Slice **nicht** konsumiert (Heuristik ist frontend-pure, siehe architecture.md Q&A 9). Frontend triggert die Card unabhängig vom Backend.
- KEINE Resume-Persistierung — Card ist transient (siehe wireframes.md → State Variation `dismissed`); Slice 28 muss sie bei Reload **nicht** restoren.
- KEINE History-Konservierung der Card (im Gegensatz zu Slice 16's IntentSummaryCard).
- KEIN Mehrfach-Trigger pro Session — Single-Fire ausschliesslich auf erster User-Message.

**Technische Constraints:**
- Component ist Client-Component (`"use client"`), subscribed an `usePromptAssistant()` (NICHT `useAssistantContext`).
- `data-testid`-Werte exakt gemäss wireframes.md → "Component Coverage" Tabelle: `paste_confirm_card`, `paste_confirm_card.refine_btn`, `paste_confirm_card.interview_btn`.
- Buttons nutzen bestehendes `Button`-Primitive aus `components/ui/button.tsx`; Card-Container nutzt `components/ui/card.tsx`.
- Trigger-Layer muss Single-Fire garantieren: bei zweiter User-Message darf `RENDER_PASTE_CONFIRM` nicht erneut dispatcht werden, auch wenn Heuristik anschlägt (Detection: User-Message-Count im `messages`-Array oder Session-Flag).
- Reducer-Field-Naming: `pasteConfirmPayload` (camelCase, konsistent mit existierendem `intentSummaryPayload`).
- Action-Type-Strings: `RENDER_PASTE_CONFIRM`, `DISMISS_PASTE_CONFIRM` (SCREAMING_SNAKE, konsistent mit existierenden Actions).
- Refine-Pfad nutzt bestehende `sendMessage(content, imageUrls?)`-Signatur — kein neuer Body-Field. Tool-Hint-Mechanik ist Implementer-Choice (z.B. Suffix wie "(refine)" am Text, der Backend-Prompt-Regeln triggert) — verbindlich ist nur, dass `refine_prompt` resultiert.

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/ui/card.tsx` | Import als Container-Primitive — NICHT neu bauen |
| `components/ui/button.tsx` | Import für beide Action-Buttons |
| `lib/assistant/paste-detect.ts` | Import `detectPastedPrompt` (aus Slice 26) — NICHT neu implementieren |
| `lib/assistant/assistant-context.tsx` | `usePromptAssistant()` Hook + `AssistantState`/`AssistantAction` erweitern — Hook-API selbst unverändert lassen |
| `components/assistant/chat-thread.tsx` | Edit (Render-Branch + Trigger-Layer) — bestehende Bubble-Render-Loop unverändert lassen; integriert sich neben dem in Slice 16 ergänzten IntentSummaryCard-Branch |
| existing `refine_prompt` Tool (`backend/app/agent/tools/prompt_tools.py`) | Wird durch Refine-Pfad indirekt ausgelöst — KEINE Änderung |

**Referenzen:**
- Architecture: `architecture.md` → Section "Frontend State Machine Wiring" (Card-History-Semantik), Section "Paste-Detect Heuristic (Frontend)" (Trigger nur auf erster User-Message), Migration Map Zeilen `paste-detect-confirm-card.tsx` und `assistant-context.tsx:104-252` (Reducer-Actions), Q&A 9 (Frontend-pure Heuristik)
- Wireframes: `wireframes.md` → "Screen: Paste Detect Confirm Card" (Layout, Annotations ①–③, State Variations `rendered` / `dismissed`, History-Semantik)
- Discovery: `discovery.md` → Slice L "Paste-Detect-Confirm" (Flow-Beschreibung)
