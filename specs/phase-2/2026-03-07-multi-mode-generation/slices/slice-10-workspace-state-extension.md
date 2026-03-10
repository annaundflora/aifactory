# Slice 10: WorkspaceState Extension

> **Slice 10 von N** für `Multi-Mode Generation (img2img + Upscale)`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-10-workspace-state-extension` |
| **Test** | `pnpm test lib/__tests__/workspace-state.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/__tests__/workspace-state.test.ts` |
| **Integration Command** | `pnpm test lib/__tests__/` |
| **Acceptance Command** | — |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` (reiner Typ- und Context-Test, kein externe Abhängigkeit) |

---

## Ziel

`WorkspaceVariationState` in `lib/workspace-state.tsx` wird um vier optionale Felder erweitert: `targetMode`, `sourceImageUrl`, `strength` und `sourceGenerationId`. Context-Provider, Hook und alle bestehenden Aufrufer bleiben unverändert — ausschliesslich die Interface-Definition ändert sich.

---

## Acceptance Criteria

1) GIVEN `WorkspaceVariationState` ist in `lib/workspace-state.tsx` definiert
   WHEN der TypeScript-Compiler das Interface auswertet
   THEN enthält es die vier neuen optionalen Felder: `targetMode?: string`, `sourceImageUrl?: string`, `strength?: number`, `sourceGenerationId?: string` — zusätzlich zu den fünf bestehenden Feldern

2) GIVEN ein State-Objekt wird über `setVariation` mit `{ targetMode: "img2img", sourceImageUrl: "https://r2.example.com/sources/p1/abc.png", strength: 0.6, ...requiredFields }` gesetzt
   WHEN `useWorkspaceVariation().variationData` ausgelesen wird
   THEN enthält es exakt `targetMode: "img2img"`, `sourceImageUrl: "https://r2.example.com/sources/p1/abc.png"` und `strength: 0.6`

3) GIVEN ein State-Objekt wird über `setVariation` mit `{ sourceGenerationId: "uuid-abc-123", ...requiredFields }` gesetzt
   WHEN `useWorkspaceVariation().variationData` ausgelesen wird
   THEN enthält es exakt `sourceGenerationId: "uuid-abc-123"`

4) GIVEN ein State-Objekt wird über `setVariation` ohne die neuen Felder gesetzt (nur die bisherigen Pflichtfelder `promptMotiv`, `modelId`, `modelParams`)
   WHEN `useWorkspaceVariation().variationData` ausgelesen wird
   THEN sind die neuen Felder `undefined` — kein Fehler, bestehende Contracts bleiben erfüllt

5) GIVEN `clearVariation` wird aufgerufen nachdem `setVariation` mit neuen Feldern gesetzt hat
   WHEN `useWorkspaceVariation().variationData` ausgelesen wird
   THEN ist es `null`

6) GIVEN `useWorkspaceVariation` wird ausserhalb eines `WorkspaceStateProvider` aufgerufen
   WHEN der Hook ausgewertet wird
   THEN wirft er `Error: "useWorkspaceVariation must be used within a WorkspaceStateProvider"` — unverändertes Verhalten

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Tests wrappen Komponenten in `WorkspaceStateProvider` via `@testing-library/react renderHook`. Keine externen Mocks nötig.

### Test-Datei: `lib/__tests__/workspace-state.test.ts`

<test_spec>
```typescript
// AC-1: Interface enthält alle neuen optionalen Felder
it.todo('should include targetMode, sourceImageUrl, strength, sourceGenerationId as optional fields in WorkspaceVariationState')

// AC-2: Neue Felder werden über setVariation gesetzt und über variationData ausgelesen
it.todo('should store and return targetMode, sourceImageUrl and strength when set via setVariation')

// AC-3: sourceGenerationId wird korrekt gesetzt und ausgelesen
it.todo('should store and return sourceGenerationId when set via setVariation')

// AC-4: Bestehende Aufrufe ohne neue Felder bleiben valide; neue Felder sind undefined
it.todo('should set new fields to undefined when not provided in setVariation call')

// AC-5: clearVariation setzt variationData auf null
it.todo('should reset variationData to null after clearVariation is called')

// AC-6: Hook ausserhalb Provider wirft definierten Error
it.todo('should throw error when useWorkspaceVariation is used outside WorkspaceStateProvider')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| — | — | — | Keine Dependencies — reine Typ-Erweiterung |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `WorkspaceVariationState` | Interface | Lightbox (img2img-Button, Upscale-Popover), PromptArea | `+ targetMode?: string, sourceImageUrl?: string, strength?: number, sourceGenerationId?: string` |
| `useWorkspaceVariation` | Hook | Unverändert alle bisherigen Consumer | `() => { variationData: WorkspaceVariationState \| null, setVariation, clearVariation }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/workspace-state.tsx` — `WorkspaceVariationState` Interface um `targetMode?: string`, `sourceImageUrl?: string`, `strength?: number`, `sourceGenerationId?: string` erweitern; Provider, Hook und Context unverändert
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt `lib/__tests__/workspace-state.test.ts` basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Keine Änderung an `WorkspaceVariationContextValue`, Provider-Implementierung oder Hook-Logik
- Keine neue Context-Variable für per-Mode State (liegt im PromptArea-Local-State, nicht hier)
- Kein neues Interface für separate Upscale- oder img2img-States — nur Erweiterung von `WorkspaceVariationState`
- Keine Änderung am Fehlerverhalten von `useWorkspaceVariation` ausserhalb des Providers

**Technische Constraints:**
- Alle vier neuen Felder sind optional (`?`) — Backwards-Kompatibilität für bestehende `setVariation`-Aufrufer
- `targetMode` als `string` (nicht als Union-Type) — Validation liegt in der konsumierenden Komponente
- Datei bleibt `"use client"` — keine Änderung am Client/Server-Boundary

**Referenzen:**
- Migration Map: `architecture.md` → Zeile zu `lib/workspace-state.tsx` ("Extended with `targetMode`, `sourceImageUrl`, `strength`, `sourceGenerationId`")
- Cross-Mode Lightbox Interaction: `architecture.md` → Section "State Persistence Matrix (Mode Switch)" — letzter Abschnitt "Cross-Mode (Lightbox)"
- Feldnamen und Typen: `architecture.md` → Section "API Design → DTOs → GenerateImagesInput (EXTEND)"
