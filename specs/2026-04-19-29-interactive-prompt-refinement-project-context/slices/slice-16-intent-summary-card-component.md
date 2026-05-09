# Slice 16: IntentSummaryCard-Komponente

> **Slice 16 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-16-intent-summary-card-component` |
| **Test** | `pnpm test components/assistant/intent-summary-card` |
| **E2E** | `true` |
| **Dependencies** | `["15-sse-flow-state-events"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/assistant/intent-summary-card` |
| **Integration Command** | `pnpm test components/assistant` |
| **Acceptance Command** | `pnpm test:e2e tests/e2e/intent-summary-card.spec.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/api/health` |
| **Mocking Strategy** | `mock_external` (SSE-Stream + Reducer-Payload gemockt; Generate-Server-Action gemockt) |

---

## Ziel

Visualisiert den vom Assistenten emittierten Intent-Summary inline im Chat-Thread, sobald `flowState === "summarizing"` aktiv wird. User entscheidet via zwei Buttons, ob direkt generiert oder das Interview fortgesetzt wird; Card bleibt nach Click als Frozen-History-Element stehen.

---

## Acceptance Criteria

1) GIVEN Reducer-State mit `flowState === "summarizing"` und einem `intentSummaryPayload` (alle 6 Axes gefüllt, `prompt_preview` als String, kein `settings_diff`)
   WHEN `chat-thread.tsx` rendert
   THEN wird **genau ein** `IntentSummaryCard` mit `data-testid="intent_summary_card"` zwischen den Assistant-Bubbles gerendert; jede gefüllte Axis (`subject`, `medium`, `style`, `lighting`, `composition`, `palette`) erscheint als Listenpunkt mit Label + Value gemäss wireframes.md → "Screen: Intent Summary Card" Annotation ②.

2) GIVEN `intentSummaryPayload.axes` enthält **nur** `subject` und `style` (übrige undefined)
   WHEN Card rendert (State `minimal_axes`)
   THEN werden ausschliesslich diese zwei Axes gerendert; die übrigen Listenpunkte fehlen vollständig (kein leerer Bullet, kein "—").

3) GIVEN `intentSummaryPayload.prompt_preview` ist gesetzt
   WHEN Card rendert
   THEN wird der String in einem Element mit `data-testid="intent_summary_card.prompt_preview"` und Monospace-Schriftbild dargestellt (Tailwind `font-mono` oder Äquivalent gemäss bestehender Code-Block-Konvention).

4) GIVEN `settings_diff` enthält je einen Eintrag in **allen vier** Sub-Arrays (`slotRoles`, `slotStrengths`, `modelId`, `modelParams` gemäss `SettingsDiff`-Schema in architecture.md → Section "SettingsDiff Type Schema")
   WHEN Card rendert
   THEN wird pro Sub-Array eine deklarative Zeile gerendert (z.B. `slotRoles[0]` → "Slot 1 role: subject → style"); jede Zeile referenziert `from`/`to` aus dem typed Schema; die Reihenfolge ist `slotRoles` → `slotStrengths` → `modelId` → `modelParams`.

5) GIVEN `intentSummaryPayload.settings_diff` ist `undefined`
   WHEN Card rendert (State `no_settings_diff`)
   THEN wird der gesamte Settings-Diff-Block ausgelassen (kein Header, kein Container); Card-Höhe entsprechend kompakter.

6) GIVEN Card im State `rendered` (beide Buttons aktiv)
   WHEN User klickt `data-testid="intent_summary_card.discuss_btn"`
   THEN dispatcht der Handler `SET_FLOW_STATE` mit Payload `"interviewing"` und ruft `sendMessage("Was soll anders sein?")`; Card-Instanz bleibt im DOM (History-Erhalt) und wechselt in State `history` (beide Buttons werden via `disabled`-Attribut deaktiviert, Visual-Treatment "frozen" gemäss wireframes.md → Section "State Variations").

7) GIVEN bereits geklickte Card (State `history`)
   WHEN ein neuer Assistant-Turn nachfolgende Messages in den Thread einfügt
   THEN bleibt die ursprüngliche Card-Instanz weiterhin im DOM erhalten und sichtbar (Position oberhalb der neuen Messages, Buttons inaktiv); kein Unmount.

8) GIVEN `chat-thread.tsx` rendert mit `flowState !== "summarizing"` (z.B. `"interviewing"`, `"idle"`, `"generating"`) UND es liegt **kein** früher gesetztes Card-Payload aus History vor
   WHEN Render-Pass erfolgt
   THEN wird **keine** `IntentSummaryCard` gemountet (kein Element mit `data-testid="intent_summary_card"` im DOM).

9) GIVEN E2E-Setup: User durchläuft Interview bis Backend `emit_intent_summary` triggert (SSE-Events `flow-state` + `intent-summary` empfangen)
   WHEN Card erscheint UND User klickt "Nochmal diskutieren"
   THEN ist im Reducer `flowState === "interviewing"` UND eine User-Message `"Was soll anders sein?"` wurde an `/api/assistant/sessions/{id}/messages` gepostet UND die Card-Instanz aus dem Summary-Turn ist weiterhin sichtbar.

> **Hinweis zu Generate-Click:** Click-Handling für `intent_summary_card.generate_btn` (Auto-Apply + Auto-Generate + `useIsGenerationPending`-Precondition) ist Scope von Slice 17. Dieser Slice rendert den Button (mit `data-testid="intent_summary_card.generate_btn"`) und stellt einen Handler-Slot bereit, ruft aber **keine** Generate-Logik auf.

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Mock-Strategie: Reducer-State direkt provisionieren via Test-Wrapper (kein echter SSE-Stream nötig für Unit-Tests); E2E nutzt echten Backend-Mock.

### Test-Datei: `components/assistant/__tests__/intent-summary-card.test.tsx` (Vitest + React Testing Library)

<test_spec>
```typescript
// AC-1: Card rendert bei flowState === "summarizing" mit allen Axes
it.todo('renders card with all six axes when payload contains all axes');

// AC-2: minimal_axes-State — nur gefüllte Axes erscheinen
it.todo('renders only present axes and omits undefined ones (minimal_axes state)');

// AC-3: Prompt-Preview in Monospace
it.todo('renders prompt_preview in monospace block');

// AC-4: SettingsDiff deklarativ pro Sub-Array
it.todo('renders settings diff with slotRoles, slotStrengths, modelId, modelParams in order');

// AC-5: no_settings_diff-State — Block komplett ausgelassen
it.todo('omits settings diff section when payload.settings_diff is undefined');

// AC-6: Discuss-Click dispatcht SET_FLOW_STATE und friert Card ein
it.todo('dispatches SET_FLOW_STATE("interviewing") and sendMessage on discuss click; card freezes');

// AC-7: Card bleibt nach Click im DOM (History-Erhalt)
it.todo('keeps card mounted after discuss click when subsequent messages arrive');

// AC-8: Kein Mount bei flowState !== "summarizing"
it.todo('does not render card when flowState is not summarizing and no history payload');
```
</test_spec>

### Test-Datei: `tests/e2e/intent-summary-card.spec.ts` (Playwright)

<test_spec>
```typescript
// AC-9: E2E Interview → emit_intent_summary → Card → Discuss-Click
test.skip('interview triggers card render; discuss click sets interviewing + posts message; card persists', async () => {
  // AC-9
});
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-15-sse-flow-state-events` | `flowState` Reducer-Field + `intentSummaryPayload` Reducer-Field + `RENDER_INTENT_SUMMARY`/`SET_FLOW_STATE` Actions | Reducer-State + Actions | Component liest beide Felder via `usePromptAssistant()` Hook |
| `slice-15-sse-flow-state-events` | `IntentSummaryPayload` Type (`axes`, `prompt_preview`, `settings_diff`) | TypeScript Type | Importiert aus `lib/assistant/assistant-context.tsx` (oder shared types) |
| existing | `sendMessage(content: string)` Funktion | Function | Bereitgestellt durch `usePromptAssistant()` (existing) |
| existing | `chat-thread.tsx` Render-Loop | Component | Wird per Edit erweitert um Card-Render-Branch |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `<IntentSummaryCard payload={...} frozen={...} onGenerate={...} />` | React Component | `slice-17-auto-apply-generate-handler` | Props `{ payload: IntentSummaryPayload, frozen: boolean, onGenerate: () => void, onDiscuss: () => void }` |
| `data-testid="intent_summary_card.generate_btn"` | DOM-Selector | `slice-17`, `slice-28` (Resume) | Stabiler E2E-Selector |
| `data-testid="intent_summary_card"` | DOM-Selector | `slice-27-paste-detect-card-component`, `slice-28` | Stabiler E2E-Selector |
| Card-Render-Branch in `chat-thread.tsx` | Mount-Point | `slice-28-session-resume-flow-state` | Re-rendert Card aus persistiertem Payload bei Session-Resume |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/assistant/intent-summary-card.tsx` (NEW) — Card-Komponente mit Axes-Liste, Prompt-Preview (monospace), SettingsDiff-Renderer (deklarativ pro Sub-Array), zwei Buttons; Discuss-Handler vollständig, Generate-Handler-Slot leer (Slice 17 verdrahtet)
- [ ] `components/assistant/chat-thread.tsx` (Edit) — Render-Branch ergänzen: bei `flowState === "summarizing"` ODER persistiertem Card-Payload `<IntentSummaryCard>` inline mounten; Frozen-State-Tracking per History-Marker
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Click-Handler für "So generieren" (`useIsGenerationPending`, `applyToWorkspace`, `generateImages`) — Slice 17 verdrahtet
- KEINE neuen Reducer-Actions — `SET_FLOW_STATE` und `RENDER_INTENT_SUMMARY` existieren bereits aus Slice 15
- KEINE SSE-Handler-Erweiterung — Slice 15 hat `intent-summary`/`flow-state`-Branches bereits implementiert
- KEINE Persistierung über Page-Reload hinaus — Hydrate ist Slice 28
- KEIN PasteDetectConfirmCard-Branch in `chat-thread.tsx` — Slice 27

**Technische Constraints:**
- Component ist Client-Component (`"use client"`); subscribed an `usePromptAssistant()`
- Styling über bestehende Tailwind-Konventionen + ggf. `components/ui/card.tsx` Primitive (kein neues Design-System einführen)
- Buttons nutzen bestehendes `Button`-Primitive aus `components/ui/button.tsx` (Variants `primary` für Generate, `secondary` für Discuss)
- `data-testid`-Werte exakt wie in wireframes.md → "Element-Identifier" Tabelle gelistet
- Frozen-State per `disabled`-Attribut + visuell reduzierter Opacity (kein Unmount, kein Re-Render des Inhalts)
- TypeScript: striktes Typing über `IntentSummaryPayload` aus shared Types

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/ui/card.tsx` | Import als Container-Primitive (Header/Body/Footer) — NICHT neu bauen |
| `components/ui/button.tsx` | Import für beide Action-Buttons |
| `lib/assistant/assistant-context.tsx` | `usePromptAssistant()` für `flowState`, `intentSummaryPayload`, `dispatch`, `sendMessage` — Hook unverändert nutzen |
| `components/assistant/chat-thread.tsx` | Edit (Render-Branch ergänzen) — bestehende Bubble-Render-Loop unverändert lassen |

**Referenzen:**
- Architecture: `architecture.md` → Sections "SettingsDiff Type Schema" (Schema), "Frontend State Machine Wiring" (Mount-Strategie + History-Semantik), "Auto-Apply + Auto-Generate Trigger" (Click-Verträge), "Migration Map" Zeile `components/assistant/intent-summary-card.tsx` (Datei-Auftrag)
- Wireframes: `wireframes.md` → "Screen: Intent Summary Card" (Layout, Annotations ①–⑥, State Variations, Element-Identifier-Tabelle)
- Discovery: `discovery.md` → Slice F "Intent-Summary-Card + emit_intent_summary"
