# Slice 24: Frontend-Handler für Slot-Tools

> **Slice 24 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-24-slot-tool-frontend-handler` |
| **Test** | `pnpm vitest run lib/assistant/__tests__/use-assistant-runtime-slot-tools.test.ts lib/assistant/__tests__/assistant-context-slot-tools.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["23-i2i-settings-tools"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

> **Quelle:** Auto-detected — TypeScript/Next.js 16 + React + Vitest. Dieser Slice erweitert (a) den existierenden SSE-Handler in `lib/assistant/use-assistant-runtime.ts` (Branch in `tool-call-result`) und (b) den existierenden Reducer in `lib/assistant/assistant-context.tsx`. Vorbild ist die Behandlung von `draft_prompt` / `refine_prompt` (siehe Zeilen 184-201 von `use-assistant-runtime.ts`). Tests verwenden ein gemocktes SSE-Event und prüfen Reducer-State nach Dispatch.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs + vitest + @testing-library/react` |
| **Test Command** | `pnpm vitest run lib/assistant/__tests__/use-assistant-runtime-slot-tools.test.ts lib/assistant/__tests__/assistant-context-slot-tools.test.tsx` |
| **Integration Command** | `pnpm vitest run lib/assistant` |
| **Acceptance Command** | `pnpm vitest run lib/assistant` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `GET http://localhost:3000/api/health` |
| **Mocking Strategy** | `mock_external` — `useWorkspaceVariation()` wird gemockt (Pattern aus `assistant-context-apply.test.tsx`); SSE-Events werden via `handleSSEEvent` direkt eingespeist (Pattern aus `use-assistant-runtime.test.ts`). Kein Live-Backend, kein Real-FS. |

---

## Ziel

SSE-`tool-call-result`-Branches für die drei Slice-23-Tools (`set_slot_role`, `set_slot_strength`, `set_model_params`) im Frontend-Handler ergänzen. Die ersten beiden Tools dispatchen neue Reducer-Actions (`SET_SLOT_ROLE`, `SET_SLOT_STRENGTH`), die als Patch-Request an die `PromptArea`-Slot-State propagiert werden. `set_model_params` dispatcht `SET_MODEL_PARAMS_PATCH`, das vom existierenden auto-apply-Effekt via `setVariation({ modelParams })` an die Workspace-Variation weitergereicht wird.

---

## Acceptance Criteria

1) **GIVEN** der SSE-Handler in `lib/assistant/use-assistant-runtime.ts` empfängt ein `tool-call-result`-Event mit `tool: "set_slot_role"` und `data: { slot_index: 1, role: "style" }`
   **WHEN** `handleSSEEvent("tool-call-result", JSON.stringify(...))` aufgerufen wird
   **THEN** Reducer dispatcht (a) bestehende `ADD_TOOL_CALL_RESULT`-Action mit dem Tool-Result UND (b) neue `SET_SLOT_ROLE`-Action mit `{ slotIndex: 1, role: "style" }` (camelCase Frontend-Konvention; snake_case → camelCase Mapping erfolgt im Handler).

2) **GIVEN** der SSE-Handler empfängt `tool-call-result` mit `tool: "set_slot_strength"` und `data: { slot_index: 2, strength: 0.7 }`
   **WHEN** das Event verarbeitet wird
   **THEN** `SET_SLOT_STRENGTH`-Action wird dispatcht mit `{ slotIndex: 2, strength: 0.7 }`.

3) **GIVEN** der SSE-Handler empfängt `tool-call-result` mit `tool: "set_model_params"` und `data: { params: { aspect_ratio: "16:9", guidance: 7 } }`
   **WHEN** das Event verarbeitet wird
   **THEN** `SET_MODEL_PARAMS_PATCH`-Action wird dispatcht mit `{ modelParams: { aspect_ratio: "16:9", guidance: 7 } }`.

4) **GIVEN** der Reducer empfängt `SET_SLOT_ROLE` mit `{ slotIndex: 0, role: "subject" }`
   **WHEN** die Action verarbeitet wird
   **THEN** `state.pendingSlotRolePatch` enthält `{ slotIndex: 0, role: "subject", version: <inkrementiert> }`. Der `version`-Counter dient als Trigger für den `PromptArea`-Subscriber (analog zu `draftVersion` in `assistant-context.tsx:75-76`); zwei aufeinanderfolgende identische Payloads triggern zwei distinkte Patches.

5) **GIVEN** der Reducer empfängt `SET_SLOT_STRENGTH` mit `{ slotIndex: 3, strength: 0.5 }`
   **WHEN** die Action verarbeitet wird
   **THEN** `state.pendingSlotStrengthPatch` enthält `{ slotIndex: 3, strength: 0.5, version: <inkrementiert> }`.

6) **GIVEN** der Reducer empfängt `SET_MODEL_PARAMS_PATCH` mit `{ modelParams: { aspect_ratio: "1:1" } }`
   **WHEN** die Action verarbeitet wird
   **THEN** der existierende auto-apply-Effekt im `AssistantProvider` (siehe `assistant-context.tsx:487-540`) ruft `setVariation({ modelParams: { aspect_ratio: "1:1" } })` mit GENAU diesen Keys — `promptMotiv`, `promptStyle`, `negativePrompt` werden NICHT mit gepatcht. Verhalten konsistent mit dem AC-2-Test in `assistant-context-apply.test.tsx` (Slice-Boundary-Disziplin).

7) **GIVEN** ein `tool-call-result`-Event mit unbekanntem `tool` (z.B. `"set_unknown_tool"`)
   **WHEN** das Event verarbeitet wird
   **THEN** nur die bestehende `ADD_TOOL_CALL_RESULT`-Action wird dispatcht; KEINE der drei neuen Actions wird ausgelöst (Default-Branch unverändert).

8) **GIVEN** ein `tool-call-result`-Event mit `tool: "set_slot_role"` aber malformiertem `data` (z.B. `{ slot_index: "not_a_number" }` oder fehlender `role`-Key)
   **WHEN** das Event verarbeitet wird
   **THEN** der Handler wirft KEINE unhandled Exception; eine `console.warn`-Zeile wird emittiert (Pattern aus `use-assistant-runtime.ts:217-221`); KEINE der drei neuen Actions wird dispatcht. (Frontend ist Defense-in-Depth, Backend hat bereits via Pydantic in Slice 23 validiert.)

9) **GIVEN** der initiale `AssistantState`
   **WHEN** der `AssistantProvider` initial gerendert wird
   **THEN** `state.pendingSlotRolePatch === null`, `state.pendingSlotStrengthPatch === null`; KEIN `setVariation`-Call für `modelParams` erfolgt vor dem ersten Tool-Result.

10) **GIVEN** der existierende Reducer-State (Slice 15/17/etc.)
    **WHEN** dieser Slice die drei neuen Actions hinzufügt
    **THEN** existierende Action-Branches (`SET_DRAFT_PROMPT`, `REFINE_DRAFT`, `MARK_ASSISTANT_DONE`, `LOAD_SESSION`, `RESET_SESSION`) bleiben unverändert; kein bestehender Test in `lib/assistant/__tests__/*.test.tsx` schlägt fehl. `RESET_SESSION` setzt `pendingSlotRolePatch` und `pendingSlotStrengthPatch` zurück auf `null`.

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Test-Writer implementiert die Assertions.

### Test-Datei: `lib/assistant/__tests__/use-assistant-runtime-slot-tools.test.ts`

<test_spec>
```typescript
// AC-1: SSE tool-call-result(set_slot_role) dispatches SET_SLOT_ROLE with mapped payload
it.todo("AC-1: should dispatch SET_SLOT_ROLE on tool-call-result(set_slot_role)");

// AC-2: SSE tool-call-result(set_slot_strength) dispatches SET_SLOT_STRENGTH
it.todo("AC-2: should dispatch SET_SLOT_STRENGTH on tool-call-result(set_slot_strength)");

// AC-3: SSE tool-call-result(set_model_params) dispatches SET_MODEL_PARAMS_PATCH
it.todo("AC-3: should dispatch SET_MODEL_PARAMS_PATCH on tool-call-result(set_model_params)");

// AC-7: Unknown tool name does not trigger any of the three new actions
it.todo("AC-7: should not dispatch slot-tool actions for unknown tool name");

// AC-8: Malformed payload is logged and does not throw
it.todo("AC-8: should warn and skip dispatch on malformed slot-tool payload");
```
</test_spec>

### Test-Datei: `lib/assistant/__tests__/assistant-context-slot-tools.test.tsx`

<test_spec>
```typescript
// AC-4: SET_SLOT_ROLE updates pendingSlotRolePatch with incremented version
it.todo("AC-4: should set pendingSlotRolePatch with incremented version on SET_SLOT_ROLE");

// AC-5: SET_SLOT_STRENGTH updates pendingSlotStrengthPatch with incremented version
it.todo("AC-5: should set pendingSlotStrengthPatch with incremented version on SET_SLOT_STRENGTH");

// AC-6: SET_MODEL_PARAMS_PATCH triggers setVariation({ modelParams }) without prompt fields
it.todo("AC-6: should call setVariation only with modelParams keys on SET_MODEL_PARAMS_PATCH");

// AC-9: Initial state has null slot-patch fields and no setVariation call
it.todo("AC-9: should have null slot-patch fields in initial state");

// AC-10: Existing actions and tests remain green; RESET_SESSION clears slot patches
it.todo("AC-10: should reset pendingSlotRolePatch + pendingSlotStrengthPatch on RESET_SESSION");
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-23-i2i-settings-tools` | Backend-Tool-Result-Events `set_slot_role`, `set_slot_strength`, `set_model_params` | SSE event payload | Backend emittiert `tool-call-result` mit `data` matching Tool-Schema (`{slot_index, role}`, `{slot_index, strength}`, `{params}`); siehe Slice 23 AC-2/AC-5/AC-7. |
| `lib/assistant/use-assistant-runtime.ts:176-203` (existing) | `tool-call-result`-Switch-Branch | TypeScript switch case | Bestehender Branch ist erweiterbar (existierende Tools `draft_prompt`, `refine_prompt` als Vorlage). |
| `lib/assistant/assistant-context.tsx:104-127` (existing) | `AssistantAction`-Union + Reducer | Discriminated Union | Bestehende Actions bleiben unverändert; nur Erweiterung. |
| `lib/assistant/assistant-context.tsx:487-540` (existing) | Auto-apply-Effekt + `setVariation`-Call | React useEffect | Bestehender Effekt liest `draftPrompt` und ruft `setVariation`; Slice 24 erweitert die Trigger-Quellen um `pendingModelParamsPatch` (analog zu `draftVersion`). |
| `useWorkspaceVariation()` (existing, `components/workspace/variation-context.tsx` o.ä.) | `setVariation({...})` Funktion | React hook | Akzeptiert partielles `VariationData`-Objekt; `modelParams` ist als Top-Level-Feld bereits vorhanden (siehe `prompt-area.tsx:127` Anwendungs-Stelle). |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `state.pendingSlotRolePatch` | `{ slotIndex: number; role: "subject" \| "style" \| "composition"; version: number } \| null` | Slice 25 (Multi-Reference Eval — observational); `components/workspace/prompt-area.tsx` (subscriber via `useEffect` auf `version`) | Read-only Selektor; nicht als prop-drilled API |
| `state.pendingSlotStrengthPatch` | `{ slotIndex: number; strength: number; version: number } \| null` | wie oben | wie oben |
| `state.pendingModelParamsPatch` | `{ modelParams: Record<string, unknown>; version: number } \| null` | Auto-apply-Effekt im AssistantProvider (intern) | wird von `setVariation({modelParams})` konsumiert; nicht extern referenziert |
| `AssistantAction`-Union erweitert um drei Varianten | TypeScript discriminated union | Zukünftige Slices, die SSE-Tools mappen | `SET_SLOT_ROLE \| SET_SLOT_STRENGTH \| SET_MODEL_PARAMS_PATCH` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/assistant/use-assistant-runtime.ts` — Edit: drei neue `else if`-Branches im bestehenden `case "tool-call-result"`-Switch (Zeile ~184-202). Snake_case → camelCase Mapping (`slot_index` → `slotIndex`, `params` → `modelParams`). Defensive Payload-Checks (typeof-Guards), bei Malformatur `console.warn` + Skip (AC-8).
- [ ] `lib/assistant/assistant-context.tsx` — Edit: (a) drei neue Felder in `AssistantState` (`pendingSlotRolePatch`, `pendingSlotStrengthPatch`, `pendingModelParamsPatch`, je `null` initial); (b) drei neue Action-Varianten in `AssistantAction`-Union (`SET_SLOT_ROLE`, `SET_SLOT_STRENGTH`, `SET_MODEL_PARAMS_PATCH`); (c) drei neue Reducer-Branches mit `version`-Counter-Inkrement; (d) `RESET_SESSION`-Branch erweitert (Patches → `null`); (e) auto-apply-Effekt erweitert um `pendingModelParamsPatch`-Trigger → `setVariation({ modelParams })` (kein `promptMotiv`/`promptStyle`/`negativePrompt`).
- [ ] `components/workspace/prompt-area.tsx` — Edit: zwei neue `useEffect`-Subscriber für `pendingSlotRolePatch.version` und `pendingSlotStrengthPatch.version`; jeder Effect ruft die existierenden Helpers (siehe Reuse-Tabelle) auf, wenn der Patch nicht-null ist und `version` sich geändert hat. KEINE Neuimplementierung der Slot-Update-Logik — nur Verkabelung.
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Backend-Code (Slice 23 deckt Tools ab).
- KEINE neuen UI-Komponenten — nur Reducer- + Subscriber-Verkabelung.
- KEIN `setVariation`-Call mit `promptMotiv`/`promptStyle`/`negativePrompt` im neuen `SET_MODEL_PARAMS_PATCH`-Pfad (Slice-Boundary-Disziplin, siehe `assistant-context-apply.test.tsx` AC-2).
- KEIN State-Schreiben in `state.toolCallResults` außerhalb der bestehenden `ADD_TOOL_CALL_RESULT`-Action (die Tool-Result-History bleibt unverändert nutzbar).
- KEIN `setVariation`-Call innerhalb des SSE-Handlers selbst — alle Workspace-Mutationen laufen über den existierenden Reducer + auto-apply-Effekt.
- KEIN Persisting der `pending*Patch`-Felder im LangGraph-Resume (Slice 28 macht Resume; diese Felder sind transient pro Tool-Result).

**Technische Constraints:**
- Reducer ist pure: kein `useCallback`, kein `setVariation`-Call innerhalb des Reducer-Body. Side-Effects laufen ausschließlich im existierenden auto-apply-`useEffect` (`assistant-context.tsx:487-540`).
- Action-Naming: `SET_SLOT_ROLE` / `SET_SLOT_STRENGTH` / `SET_MODEL_PARAMS_PATCH` (Architecture-Vorgabe Zeile 272 + 529).
- Field-Naming: `pendingSlotRolePatch` / `pendingSlotStrengthPatch` / `pendingModelParamsPatch` mit `version: number` (analog zum existierenden `draftVersion`-Pattern).
- Snake_case → camelCase Mapping NUR im SSE-Handler (`use-assistant-runtime.ts`), nicht im Reducer (Reducer arbeitet bereits in Frontend-Konvention).
- Defense-in-Depth-Validation: typeof-Guards für `slot_index` (`number`), `role` (string-in-Enum), `strength` (number 0..1), `params` (object). Bei Verstoß → `console.warn` + Skip (Pattern aus `use-assistant-runtime.ts:217-221`).
- `pendingModelParamsPatch` triggert `setVariation` über den existierenden auto-apply-Effekt — NICHT über einen neuen separaten Effekt; Vorlage ist die `draftPrompt`-Verarbeitung in `assistant-context.tsx:487-540`.
- TypeScript: Tool-Payload-Types als lokale Interface-Definitionen im SSE-Handler (z.B. `interface SetSlotRoleData { slot_index: number; role: string }`); KEINE neuen DTO-Files in `lib/types/`.

**Reuse:**

Dieser Slice nutzt existierende Frontend-Pfade — KEINE Neu-Implementierung folgender Bausteine:

| Existing File | Usage in this Slice |
|---|---|
| `lib/assistant/use-assistant-runtime.ts` (`handleSSEEvent`, Zeile 149-225) | EDIT: bestehender `case "tool-call-result"`-Branch wird um drei neue Tool-Names erweitert. Pattern-Vorlage: `draft_prompt` / `refine_prompt`-Behandlung Zeile 184-201. |
| `lib/assistant/assistant-context.tsx` (`assistantReducer`, Zeile 133+) | EDIT: drei neue Action-Varianten + drei neue Reducer-Branches. Pattern-Vorlage: existierender `SET_DRAFT_PROMPT`-Branch (Zeile 194). |
| `lib/assistant/assistant-context.tsx` (auto-apply-`useEffect`, Zeile 487-540) | EDIT: erweitert um `pendingModelParamsPatch`-Trigger → `setVariation({ modelParams })`. Bestehende `draftPrompt`-Branch unverändert. |
| `useWorkspaceVariation()` Hook (existing) | IMPORT + `setVariation({ modelParams })`-Call wie bisher. NICHT verändern. |
| `components/workspace/prompt-area.tsx` (`handleReferenceRoleChange`, Zeile 469-477; `handleReferenceStrengthChange`, Zeile 480-488) | IMPORT/Anwenden via neue `useEffect`-Subscriber. KEINE neue Slot-Update-Logik schreiben — die existierenden Handler werden vom Subscriber aufgerufen. |
| Bestehende Test-Files (`assistant-context-apply.test.tsx`, `use-assistant-runtime.test.ts`) | Pattern-Vorlage für neue Tests; `useWorkspaceVariation`-Mock + `handleSSEEvent`-Stub-Pattern. |

**Referenzen:**
- Architecture → API → "LangGraph Tool Schemas" (Zeilen 99-101): Payload-Schemas der drei Tools.
- Architecture → Server Logic → Business-Flow (Zeilen 264-272): SSE-Event-Mapping zu Reducer-Actions.
- Architecture → Layered Mapping (Zeile 225): `Frontend SSE handler (EXTEND)` — explizit als Erweiterung um diese Tool-Branches gelistet.
- Architecture → Layered Mapping (Zeile 529): Reducer um `SET_SLOT_ROLE`, `SET_SLOT_STRENGTH` erweitern (Slice J).
- Architecture → Open Decisions → Q17 (Zeile 749): Tools persistieren NICHT — UI ist authoritative Slot-Quelle, Tool-Result wird im Frontend-Handler konsumiert.
- Slice 23 (`slice-23-i2i-settings-tools.md`) → Provides-Tabelle: definiert die Tool-Names + Payload-Shapes, die hier konsumiert werden.
