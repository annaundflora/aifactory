# Slice 10: Assistant Frontend -- DraftPrompt & SSE auf 1 Feld

> **Slice 10 von 11** fuer `Prompt-Felder Vereinfachung`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-10-assistant-frontend` |
| **Test** | `pnpm vitest run lib/assistant/__tests__/assistant-context-apply.test.tsx lib/assistant/__tests__/assistant-context.test.tsx lib/assistant/__tests__/assistant-context-resume.test.tsx lib/assistant/__tests__/assistant-context-persistence.test.tsx lib/assistant/__tests__/use-assistant-runtime.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-08-assistant-backend-tools"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm vitest run lib/assistant/__tests__/` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm vitest run lib/assistant/__tests__/` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Das `DraftPrompt`-Interface in `assistant-context.tsx` von 3 Feldern (`motiv`, `style`, `negativePrompt`) auf 1 Feld (`prompt`) umbauen. Alle abhaengigen Funktionen (applyToWorkspace, loadSession, getWorkspaceFieldsForChip) und das SSE-Parsing in `use-assistant-runtime.ts` entsprechend vereinfachen. Backwards-Compatibility fuer alte Sessions sicherstellen.

---

## Acceptance Criteria

1) GIVEN die Datei `lib/assistant/assistant-context.tsx`
   WHEN das exportierte Interface `DraftPrompt` inspiziert wird
   THEN hat es GENAU einen Key `prompt: string`
   AND die Keys `motiv`, `style`, `negativePrompt` existieren NICHT mehr

2) GIVEN der State enthaelt ein `draftPrompt` mit `{ prompt: "A majestic mountain landscape" }`
   WHEN `applyToWorkspace()` aufgerufen wird
   THEN wird `setVariation` mit `promptMotiv: "A majestic mountain landscape"` aufgerufen
   AND die Properties `promptStyle` und `negativePrompt` werden NICHT an `setVariation` uebergeben

3) GIVEN eine Backend-Session-Response mit `draft_prompt: { motiv: "old motiv text", style: "oil painting", negative_prompt: "blurry" }`
   WHEN `loadSession` die Response verarbeitet (Backwards-Compatibility)
   THEN wird `draftPrompt` auf `{ prompt: "old motiv text" }` gemappt
   AND die alten Keys `style` und `negative_prompt` werden verworfen

4) GIVEN eine Backend-Session-Response mit `draft_prompt: { prompt: "new format prompt" }`
   WHEN `loadSession` die Response verarbeitet
   THEN wird `draftPrompt` auf `{ prompt: "new format prompt" }` gemappt

5) GIVEN eine Backend-Session-Response mit `draft_prompt: null`
   WHEN `loadSession` die Response verarbeitet
   THEN ist `draftPrompt` gleich `null`

6) GIVEN `variationData` mit `promptMotiv: "sunset over the ocean"`
   WHEN `getWorkspaceFieldsForChip(variationData)` aufgerufen wird
   THEN gibt die Funktion einen String zurueck der `promptMotiv` enthaelt
   AND der String enthaelt KEINE Referenzen auf `style=` oder `negative=`

7) GIVEN `variationData` mit `promptMotiv: ""`
   WHEN `getWorkspaceFieldsForChip(variationData)` aufgerufen wird
   THEN gibt die Funktion `null` zurueck

8) GIVEN ein SSE `tool-call-result`-Event mit `tool: "draft_prompt"` und `data: { prompt: "A vibrant coral reef" }`
   WHEN das Event in `use-assistant-runtime.ts` geparst wird
   THEN wird `SET_DRAFT_PROMPT` dispatched mit `draftPrompt: { prompt: "A vibrant coral reef" }`
   AND es wird NICHT auf `motiv`, `style` oder `negative_prompt` im SSE-Payload zugegriffen

9) GIVEN ein SSE `tool-call-result`-Event mit `tool: "refine_prompt"` und `data: { prompt: "refined version" }`
   WHEN das Event in `use-assistant-runtime.ts` geparst wird
   THEN wird `REFINE_DRAFT` dispatched mit `draftPrompt: { prompt: "refined version" }`

10) GIVEN die geaenderten Dateien aus AC-1 bis AC-9
    WHEN alle 5 Test-Dateien (`assistant-context-apply`, `assistant-context`, `assistant-context-resume`, `assistant-context-persistence`, `use-assistant-runtime`) ausgefuehrt werden
    THEN laufen alle Tests gruen (0 failures, 0 errors)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.

### Test-Datei: `lib/assistant/__tests__/assistant-context-apply.test.tsx`

<test_spec>
```typescript
// AC-2: applyToWorkspace mappt prompt auf promptMotiv
it.todo('should apply draftPrompt.prompt to workspace as promptMotiv')

// AC-2: applyToWorkspace sendet keine promptStyle/negativePrompt
it.todo('should not pass promptStyle or negativePrompt to setVariation')
```
</test_spec>

### Test-Datei: `lib/assistant/__tests__/assistant-context-resume.test.tsx`

<test_spec>
```typescript
// AC-3: Backwards-Compatibility fuer alte Sessions mit 3 Feldern
it.todo('should map old 3-field draft_prompt to single prompt field using motiv')

// AC-4: Neue Sessions mit prompt-Key
it.todo('should map new draft_prompt format with prompt key directly')

// AC-5: Null draft_prompt bleibt null
it.todo('should set draftPrompt to null when backend returns null')
```
</test_spec>

### Test-Datei: `lib/assistant/__tests__/assistant-context.test.tsx`

<test_spec>
```typescript
// AC-1: DraftPrompt Interface hat nur prompt-Key
it.todo('should have DraftPrompt with single prompt field')

// AC-6: getWorkspaceFieldsForChip mit promptMotiv
it.todo('should format workspace fields with only promptMotiv')

// AC-7: getWorkspaceFieldsForChip mit leerem promptMotiv
it.todo('should return null when promptMotiv is empty')
```
</test_spec>

### Test-Datei: `lib/assistant/__tests__/use-assistant-runtime.test.ts`

<test_spec>
```typescript
// AC-8: SSE draft_prompt parsed als { prompt }
it.todo('should dispatch SET_DRAFT_PROMPT with single prompt field from SSE')

// AC-9: SSE refine_prompt parsed als { prompt }
it.todo('should dispatch REFINE_DRAFT with single prompt field from SSE')
```
</test_spec>

### Test-Datei: `lib/assistant/__tests__/assistant-context-persistence.test.tsx`

<test_spec>
```typescript
// AC-3: Persistence mit altem Format
it.todo('should handle persisted sessions with old 3-field draft format')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-08` | SSE `tool-call-result` Payload mit `{ prompt: string }` | SSE Event Data | SSE-Events von Backend liefern `{ prompt }` statt `{ motiv, style, negative_prompt }` |
| `slice-08` | Session-Restore-Response mit `draft_prompt: { prompt }` | API Response | Backend liefert neues Format bei `/sessions/{id}` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `DraftPrompt` Interface | TypeScript Interface | UI-Slices (prompt-area, canvas) | `{ prompt: string }` |
| `applyToWorkspace()` | Callback | AssistantProvider consumers | Maps `draftPrompt.prompt` -> `setVariation({ promptMotiv })` |
| `getWorkspaceFieldsForChip()` | Pure Function | AssistantProvider consumers | `(variationData) => string \| null` (nur promptMotiv) |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/assistant/assistant-context.tsx` -- DraftPrompt Interface auf `{ prompt }`, applyToWorkspace-Mapping, loadSession-Conversion (mit Backwards-Compat), getWorkspaceFieldsForChip vereinfachen, DraftPromptField Type anpassen
- [ ] `lib/assistant/use-assistant-runtime.ts` -- SSE-Parsing: `draft_prompt` und `refine_prompt` Events von `{ prompt }` auf DraftPrompt mappen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an `lib/workspace-state.tsx` (WorkspaceVariationState -- eigener Slice)
- KEINE Aenderungen an UI-Components (prompt-area.tsx, canvas -- eigene Slices)
- KEINE Aenderungen an Backend-Dateien (Slice 08)
- KEINE Aenderungen am `usePromptAssistant` Hook-Interface selbst (nur interne Logik)
- `DraftPromptField` Type entfaellt oder wird zu `"prompt"` -- KEIN separater Type noetig wenn nur 1 Key

**Technische Constraints:**
- `applyToWorkspace` mappt `draftPrompt.prompt` auf `promptMotiv` (NICHT auf `prompt` -- promptMotiv-Naming bleibt laut Architecture out-of-scope)
- Backwards-Compatibility in `loadSession`: Wenn Backend alte Session mit `{ motiv, style, negative_prompt }` liefert, mappen auf `{ prompt: draft.motiv }` -- `style` und `negative_prompt` werden verworfen
- SSE-Parsing: Typ-Cast auf `{ prompt: string }` statt auf `{ motiv, style, negative_prompt }`
- Undo-Snapshot in `applyToWorkspace` speichert nur `promptMotiv` (keine promptStyle/negativePrompt mehr)

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "API Design > SSE Contract Change"
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "API Design > Session Restore Response Change"
- Architecture: `specs/phase-7/2026-03-29-prompt-simplification/architecture.md` -- Section "Frontend -- Assistant Integration" (Migration Map)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/assistant/assistant-context.tsx` | MODIFY -- DraftPrompt Interface, applyToWorkspace, loadSession, getWorkspaceFieldsForChip |
| `lib/assistant/use-assistant-runtime.ts` | MODIFY -- SSE-Parsing fuer draft_prompt und refine_prompt Events |
